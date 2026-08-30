"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const faceAssets = Object.freeze({
  normal: "assets/slime/face/slime_face_normal.png",
  action: "assets/slime/face/slime_face_action.png",
  blink: "assets/slime/face/slime_face_blink.png",
  left: "assets/slime/face/slime_face_left.png",
  right: "assets/slime/face/slime_face_right.png"
});

for (const relativePath of Object.values(faceAssets)) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 256, `${relativePath} must be 256 px wide`);
  assert.equal(bytes.readUInt32BE(20), 256, `${relativePath} must be 256 px high`);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must be RGBA`);
}

const rendererSource = fs.readFileSync(path.join(root, "js/renderer.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const gameSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const assetStart = rendererSource.indexOf("  const SLIME_FACE_SOURCE_SIZE");
const assetEnd = rendererSource.indexOf("  const COLLECTIBLE_STAR_ASSET_PATH", assetStart);
const helperStart = rendererSource.indexOf("  function isSlimeFaceImageReady(");
const helperEnd = rendererSource.indexOf("  function redrawPendingSlimeBodyPreviews(", helperStart);
const previewStart = rendererSource.indexOf("  function drawSlimeCharacterPreview(");
const previewEnd = rendererSource.indexOf("  function drawSlimeCosmeticPreview(", previewStart);
const playerStart = rendererSource.indexOf("  function drawPlayer(");
const playerEnd = rendererSource.indexOf("  function drawParticles(", playerStart);
assert.ok(assetStart >= 0 && assetEnd > assetStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart);
assert.ok(playerStart >= 0 && playerEnd > playerStart);

const images = [];
class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.decoding = "";
    this.onload = null;
    this.onerror = null;
    images.push(this);
  }

  set src(value) {
    this._src = value;
  }

  get src() {
    return this._src;
  }
}

const safeMath = Object.create(Math);
safeMath.random = () => {
  throw new Error("Face animation must not consume Math.random");
};
const sandbox = {
  Image: FakeImage,
  Map,
  Math: safeMath,
  Object,
  Uint32Array,
  Date,
  state: "playing",
  aiming: false,
  player: {onGround: true, squish: 0},
  airHopFlightActive: false,
  worldTime: 0,
  validAimSupport: true
};
const context = vm.createContext(sandbox);
vm.runInContext(`
${rendererSource.slice(assetStart, assetEnd)}
function hasValidAimSupport() { return validAimSupport; }
${rendererSource.slice(helperStart, helperEnd)}
globalThis.slimeFaceTestApi = {
  states: SLIME_FACE_STATES,
  phases: SLIME_FACE_IDLE_PHASES,
  paths: SLIME_FACE_ASSET_PATHS,
  images: slimeFaceImages,
  draw: drawSlimeFace,
  select: getSlimeFaceState,
  reset: resetSlimeFaceIdleAnimation,
  timings: {
    interval: [SLIME_FACE_IDLE_INTERVAL_MIN, SLIME_FACE_IDLE_INTERVAL_MAX],
    blink: [SLIME_FACE_BLINK_DURATION_MIN, SLIME_FACE_BLINK_DURATION_MAX],
    transitionBlink: [
      SLIME_FACE_TRANSITION_BLINK_DURATION_MIN,
      SLIME_FACE_TRANSITION_BLINK_DURATION_MAX
    ],
    look: [SLIME_FACE_LOOK_DURATION_MIN, SLIME_FACE_LOOK_DURATION_MAX],
    weights: [
      SLIME_FACE_BLINK_EVENT_WEIGHT,
      SLIME_FACE_LEFT_EVENT_WEIGHT,
      1 - SLIME_FACE_BLINK_EVENT_WEIGHT - SLIME_FACE_LEFT_EVENT_WEIGHT
    ]
  },
  snapshot() {
    return {
      event: slimeFaceIdleEvent,
      phase: slimeFaceIdlePhase,
      lookTarget: slimeFaceIdleLookTarget,
      endsAt: slimeFaceIdleEventEndsAt,
      nextAt: slimeFaceNextIdleEventAt
    };
  }
};
`, context, {filename: "slime-face-renderer-fixture.js"});

const api = context.slimeFaceTestApi;
assert.deepEqual(JSON.parse(JSON.stringify(api.paths)), faceAssets);
assert.equal(images.length, 5, "all five face PNGs load exactly once");
assert.deepEqual(images.map(image => image.src), Object.values(faceAssets));
assert.ok(images.every(image => image.decoding === "async"));

function createRecordingContext() {
  const calls = [];
  const writes = [];
  const target = {
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    beginPath: () => calls.push(["beginPath"]),
    arc: (...args) => calls.push(["arc", ...args]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"])
  };
  return {
    calls,
    writes,
    context: new Proxy(target, {
      set(object, property, value) {
        writes.push([property, value]);
        object[property] = value;
        return true;
      }
    })
  };
}

const palette = {face: "#123456"};
for (const [faceState, expectedPath] of Object.entries(faceAssets)) {
  const image = api.images[faceState];
  image.complete = true;
  image.naturalWidth = 256;
  image.naturalHeight = 256;
  const recording = createRecordingContext();
  assert.equal(api.draw(recording.context, palette, faceState), true);
  const drawCall = recording.calls.find(call => call[0] === "drawImage");
  assert.ok(drawCall);
  assert.equal(drawCall[1].src, expectedPath);
  assert.deepEqual(drawCall.slice(2), [-40, -40, 80, 80]);
  assert.equal(recording.calls.some(call => call[0] === "arc"), false);
  assert.equal(
    recording.writes.some(write => write[1] === palette.face),
    false,
    "ready face PNGs must retain original RGBA without palette tint"
  );
}

api.images.normal.complete = false;
const normalFallback = createRecordingContext();
assert.equal(api.draw(normalFallback.context, palette, api.states.NORMAL), false);
assert.equal(normalFallback.calls.filter(call => call[0] === "arc").length, 3);
assert.ok(normalFallback.writes.some(write => write[0] === "fillStyle" && write[1] === palette.face));
assert.ok(normalFallback.writes.some(write => write[0] === "strokeStyle" && write[1] === palette.face));

api.images.action.naturalWidth = 255;
const actionFallback = createRecordingContext();
assert.equal(api.draw(actionFallback.context, palette, api.states.ACTION), false);
assert.ok(actionFallback.calls.some(call => (
  call[0] === "arc" && call[1] === 0 && call[2] === 10 && call[3] === 7
)));

function values(...items) {
  let index = 0;
  return () => items[Math.min(index++, items.length - 1)];
}

function assertApprox(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} must equal ${expected}`);
}

function setIdleConditions(overrides = {}) {
  context.state = overrides.state ?? "playing";
  context.aiming = overrides.aiming ?? false;
  context.player.onGround = overrides.onGround ?? true;
  context.player.squish = overrides.squish ?? 0;
  context.airHopFlightActive = overrides.airHopFlightActive ?? false;
  context.validAimSupport = overrides.validAimSupport ?? true;
}

function scheduleAtMinimumInterval() {
  api.reset();
  setIdleConditions();
  context.worldTime = 0;
  assert.equal(api.select(0, values(0)), api.states.NORMAL);
  assert.equal(api.snapshot().nextAt, 1.8);
}

assert.deepEqual(JSON.parse(JSON.stringify(api.timings)), {
  interval: [1.8, 9],
  blink: [0.08, 0.14],
  transitionBlink: [0.04, 0.07],
  look: [0.5, 1.2],
  weights: [0.4, 0.3, 0.3]
});

scheduleAtMinimumInterval();
context.worldTime = 1.799;
assert.equal(api.select(0, values(0)), api.states.NORMAL);
context.worldTime = 1.8;
assert.equal(api.select(0, values(0, 0)), api.states.BLINK);
assert.equal(api.snapshot().phase, api.phases.BLINK);
assertApprox(api.snapshot().endsAt, 1.88);
context.worldTime = 1.879;
assert.equal(api.select(0, values(0)), api.states.BLINK);
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0)), api.states.NORMAL);
assert.equal(api.snapshot().phase, api.phases.NONE);
assertApprox(api.snapshot().nextAt, 3.68);

scheduleAtMinimumInterval();
context.worldTime = 1.8;
assert.equal(api.select(0, values(0.45, 0)), api.states.BLINK);
assert.equal(api.snapshot().phase, api.phases.LOOK_TRANSITION_IN);
assert.equal(api.snapshot().lookTarget, api.states.LEFT);
assertApprox(api.snapshot().endsAt, 1.84);
context.worldTime = 1.839;
assert.equal(api.select(0, values(0)), api.states.BLINK);
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0)), api.states.LEFT);
assert.equal(api.snapshot().phase, api.phases.LOOK);
assertApprox(api.snapshot().endsAt, 2.34);
context.worldTime = 2.339;
assert.equal(api.select(0, values(0)), api.states.LEFT, "look event cannot overlap another event");
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0)), api.states.BLINK);
assert.equal(api.snapshot().phase, api.phases.LOOK_TRANSITION_OUT);
assertApprox(api.snapshot().endsAt, 2.38);
context.worldTime = 2.379;
assert.equal(api.select(0, values(0)), api.states.BLINK);
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0)), api.states.NORMAL);
assert.equal(api.snapshot().phase, api.phases.NONE);
assertApprox(api.snapshot().nextAt, 4.18);

scheduleAtMinimumInterval();
context.worldTime = 1.8;
assert.equal(api.select(0, values(0.72, 0.999)), api.states.BLINK);
assert.equal(api.snapshot().lookTarget, api.states.RIGHT);
assertApprox(api.snapshot().endsAt, 1.86997);
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0.999)), api.states.RIGHT);
assertApprox(api.snapshot().endsAt, 3.06927);
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0.999)), api.states.BLINK);
assertApprox(api.snapshot().endsAt, 3.13924);
context.worldTime = api.snapshot().endsAt;
assert.equal(api.select(0, values(0.999)), api.states.NORMAL);
assertApprox(api.snapshot().nextAt, 12.13204);

function assertActionCancelsRuntimeSequence(prepareSequence) {
  scheduleAtMinimumInterval();
  prepareSequence();
  assert.equal(api.select(721, values(0)), api.states.ACTION);
  assert.deepEqual(JSON.parse(JSON.stringify(api.snapshot())), {
    event: "normal",
    phase: "none",
    lookTarget: "normal",
    endsAt: 0,
    nextAt: null
  });
}

assertActionCancelsRuntimeSequence(() => {
  context.worldTime = 1.8;
  api.select(0, values(0, 0));
});
assertActionCancelsRuntimeSequence(() => {
  context.worldTime = 1.8;
  api.select(0, values(0.45, 0));
});
assertActionCancelsRuntimeSequence(() => {
  context.worldTime = 1.8;
  api.select(0, values(0.45, 0));
  context.worldTime = api.snapshot().endsAt;
  api.select(0, values(0));
});
assertActionCancelsRuntimeSequence(() => {
  context.worldTime = 1.8;
  api.select(0, values(0.45, 0));
  context.worldTime = api.snapshot().endsAt;
  api.select(0, values(0));
  context.worldTime = api.snapshot().endsAt;
  api.select(0, values(0));
});
assert.equal(api.select(720, values(0)), api.states.NORMAL, "the legacy action threshold stays strict");

for (const nonIdle of [
  {aiming: true},
  {onGround: false},
  {validAimSupport: false},
  {squish: 0.02},
  {airHopFlightActive: true}
]) {
  scheduleAtMinimumInterval();
  context.worldTime = 1.8;
  assert.equal(api.select(0, values(0.45, 0)), api.states.BLINK);
  setIdleConditions(nonIdle);
  assert.equal(api.select(0, values(0)), api.states.NORMAL);
  assert.equal(api.snapshot().event, api.states.NORMAL);
  assert.equal(api.snapshot().phase, api.phases.NONE);
  assert.equal(api.snapshot().nextAt, null);
}

scheduleAtMinimumInterval();
context.worldTime = 1.8;
assert.equal(api.select(30, values(0)), api.states.NORMAL, "movement at 30 px/s cancels idle");
assert.equal(api.snapshot().nextAt, null);

api.reset();
setIdleConditions({aiming: true});
context.worldTime = 2;
assert.equal(api.select(0, values(0, 0)), api.states.NORMAL, "blink cannot begin outside idle");
assert.equal(api.snapshot().nextAt, null);

api.reset();
setIdleConditions();
context.worldTime = 10;
assert.equal(api.select(0, values(0.999)), api.states.NORMAL);
assertApprox(api.snapshot().nextAt, 18.9928);

api.reset();
setIdleConditions();
context.worldTime = 20;
assert.equal(api.select(0), api.states.NORMAL, "the default visual PRNG must not call Math.random");
assert.ok(api.snapshot().nextAt >= 21.8 && api.snapshot().nextAt < 29);

const helperSource = rendererSource.slice(helperStart, helperEnd);
assert.doesNotMatch(helperSource, /Math\.random\s*\(/);
assert.match(helperSource, /globalThis\.crypto\?\.getRandomValues/);
assert.match(helperSource, /randomState \^= randomState << 13/);

const previewSource = rendererSource.slice(previewStart, previewEnd);
const playerSource = rendererSource.slice(playerStart, playerEnd);
assert.match(previewSource, /normalizeSlimePreviewFaceState\(options\.faceState\)/);
assert.match(previewSource, /drawSlimeFace\([\s\S]*previewFaceState,[\s\S]*\{preview: true\}/);
assert.doesNotMatch(previewSource, /getSlimeFaceState/);
assert.match(playerSource, /const faceState = getSlimeFaceState\(speed\)/);
assert.match(playerSource, /drawSlimeFace\(ctx, palette, faceState\)/);
assert.ok(playerSource.indexOf("drawSlimeBody(ctx") < playerSource.indexOf("drawSlimeFace(ctx"));
assert.ok(playerSource.indexOf("drawSlimeFace(ctx") < playerSource.indexOf("drawSlimeBeard(ctx"));
assert.equal((rendererSource.match(/drawSlimeFace\(/g) ?? []).length, 3);

const menuFaceStart = uiSource.indexOf("  let mainMenuMascotFaceState");
const menuFaceEnd = uiSource.indexOf("  function getPersonalBestScore(", menuFaceStart);
const showMenuStart = uiSource.indexOf("  function showMenuScreen(");
const showMenuEnd = uiSource.indexOf("  function getHowToThumbOffset(", showMenuStart);
assert.ok(menuFaceStart >= 0 && menuFaceEnd > menuFaceStart);
assert.ok(showMenuStart >= 0 && showMenuEnd > showMenuStart);

const menuRenders = [];
const menuSandbox = {
  console,
  Date,
  Math: safeMath,
  Number,
  Uint32Array,
  document: {visibilityState: "visible"},
  state: "menu",
  menuHidden: false,
  mainScreenHidden: false
};
menuSandbox.menuRenders = menuRenders;
menuSandbox.ui = {
  menuMascot: {},
  menu: {classList: {contains: () => menuSandbox.menuHidden}},
  mainMenuScreen: {classList: {contains: () => menuSandbox.mainScreenHidden}}
};
const menuContext = vm.createContext(menuSandbox);
vm.runInContext(`
const SLIME_FACE_STATES = Object.freeze({
  NORMAL: "normal",
  ACTION: "action",
  BLINK: "blink",
  LEFT: "left",
  RIGHT: "right"
});
const SLIME_FACE_IDLE_PHASES = Object.freeze({
  NONE: "none",
  BLINK: "blink",
  LOOK_TRANSITION_IN: "look-transition-in",
  LOOK: "look",
  LOOK_TRANSITION_OUT: "look-transition-out"
});
const SLIME_FACE_IDLE_INTERVAL_MIN = 1.8;
const SLIME_FACE_IDLE_INTERVAL_MAX = 9;
const SLIME_FACE_BLINK_DURATION_MIN = 0.08;
const SLIME_FACE_BLINK_DURATION_MAX = 0.14;
const SLIME_FACE_TRANSITION_BLINK_DURATION_MIN = 0.04;
const SLIME_FACE_TRANSITION_BLINK_DURATION_MAX = 0.07;
const SLIME_FACE_LOOK_DURATION_MIN = 0.5;
const SLIME_FACE_LOOK_DURATION_MAX = 1.2;
const SLIME_FACE_BLINK_EVENT_WEIGHT = 0.4;
const SLIME_FACE_LEFT_EVENT_WEIGHT = 0.3;
${uiSource.slice(menuFaceStart, menuFaceEnd)}
renderMenuMascot = () => menuRenders.push(mainMenuMascotFaceState);
globalThis.mainMenuFaceTestApi = {
  update: updateMainMenuMascotFaceAnimation,
  reset: resetMainMenuMascotFaceAnimation,
  snapshot() {
    return {
      state: mainMenuMascotFaceState,
      phase: mainMenuMascotFacePhase,
      lookTarget: mainMenuMascotFaceLookTarget,
      endsAt: mainMenuMascotFaceEventEndsAt,
      nextAt: mainMenuMascotNextFaceEventAt,
      active: mainMenuMascotFaceAnimationActive
    };
  }
};
`, menuContext, {
  filename: "main-menu-slime-face-fixture.js"
});

const menuApi = menuSandbox.mainMenuFaceTestApi;
assert.ok(menuApi);

function startMenuAnimation(randomValue = 0) {
  menuApi.reset();
  menuSandbox.state = "menu";
  menuSandbox.menuHidden = false;
  menuSandbox.mainScreenHidden = false;
  menuSandbox.document.visibilityState = "visible";
  menuRenders.length = 0;
  assert.equal(menuApi.update(0, values(randomValue)), true);
  assert.deepEqual(menuRenders, ["normal"]);
}

startMenuAnimation(0);
assert.equal(menuApi.snapshot().nextAt, 1.8);
assert.equal(menuApi.update(1799, values(0)), false);
assert.deepEqual(menuRenders, ["normal"], "steady frames must not redraw the mascot");
assert.equal(menuApi.update(1800, values(0, 0)), true);
assert.equal(menuApi.snapshot().state, "blink");
assert.equal(menuApi.snapshot().phase, "blink");
assertApprox(menuApi.snapshot().endsAt, 1.88);
assert.deepEqual(menuRenders, ["normal", "blink"]);
assert.equal(menuApi.update(1879, values(0)), false);
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0)), true);
assert.equal(menuApi.snapshot().state, "normal");

startMenuAnimation(0);
assert.equal(menuApi.update(1800, values(0.45, 0)), true);
assert.equal(menuApi.snapshot().state, "blink");
assert.equal(menuApi.snapshot().phase, "look-transition-in");
assert.equal(menuApi.snapshot().lookTarget, "left");
assertApprox(menuApi.snapshot().endsAt, 1.84);
assert.equal(menuApi.update(1839, values(0)), false);
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0)), true);
assert.equal(menuApi.snapshot().state, "left");
assert.equal(menuApi.snapshot().phase, "look");
assertApprox(menuApi.snapshot().endsAt, 2.34);
assert.equal(menuApi.update(2339, values(0)), false, "look events remain exclusive");
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0)), true);
assert.equal(menuApi.snapshot().state, "blink");
assert.equal(menuApi.snapshot().phase, "look-transition-out");
assertApprox(menuApi.snapshot().endsAt, 2.38);
assert.equal(menuApi.update(2379, values(0)), false);
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0)), true);
assert.equal(menuApi.snapshot().state, "normal");
assert.deepEqual(menuRenders, ["normal", "blink", "left", "blink", "normal"]);

startMenuAnimation(0);
assert.equal(menuApi.update(1800, values(0.72, 0.999)), true);
assert.equal(menuApi.snapshot().state, "blink");
assert.equal(menuApi.snapshot().lookTarget, "right");
assertApprox(menuApi.snapshot().endsAt, 1.86997);
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0.999)), true);
assert.equal(menuApi.snapshot().state, "right");
assertApprox(menuApi.snapshot().endsAt, 3.06927);
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0.999)), true);
assert.equal(menuApi.snapshot().state, "blink");
assertApprox(menuApi.snapshot().endsAt, 3.13924);
assert.equal(menuApi.update(menuApi.snapshot().endsAt * 1000, values(0)), true);
assert.equal(menuApi.snapshot().state, "normal");
assert.doesNotMatch(uiSource.slice(menuFaceStart, menuFaceEnd), /SLIME_FACE_STATES\.ACTION/);

menuSandbox.mainScreenHidden = true;
assert.equal(menuApi.update(900, values(0)), false);
assert.deepEqual(JSON.parse(JSON.stringify(menuApi.snapshot())), {
  state: "normal",
  phase: "none",
  lookTarget: "normal",
  endsAt: 0,
  nextAt: null,
  active: false
});
menuSandbox.mainScreenHidden = false;
assert.equal(menuApi.update(1000, values(0)), true);
assert.deepEqual(menuRenders.slice(-1), ["normal"]);
assert.equal(menuApi.update(1001, values(0)), false, "the existing frame loop activates only one state machine");

const menuFaceSource = uiSource.slice(menuFaceStart, menuFaceEnd);
assert.doesNotMatch(menuFaceSource, /Math\.random\s*\(/);
assert.match(menuFaceSource, /faceState: mainMenuMascotFaceState/);
for (const sharedTimingName of [
  "SLIME_FACE_IDLE_INTERVAL_MIN",
  "SLIME_FACE_IDLE_INTERVAL_MAX",
  "SLIME_FACE_BLINK_DURATION_MIN",
  "SLIME_FACE_BLINK_DURATION_MAX",
  "SLIME_FACE_TRANSITION_BLINK_DURATION_MIN",
  "SLIME_FACE_TRANSITION_BLINK_DURATION_MAX",
  "SLIME_FACE_LOOK_DURATION_MIN",
  "SLIME_FACE_LOOK_DURATION_MAX",
  "SLIME_FACE_BLINK_EVENT_WEIGHT",
  "SLIME_FACE_LEFT_EVENT_WEIGHT"
]) {
  assert.match(menuFaceSource, new RegExp(sharedTimingName));
}
const showMenuSource = uiSource.slice(showMenuStart, showMenuEnd);
assert.match(showMenuSource, /resetMainMenuMascotFaceAnimation\(\)/);
assert.match(gameSource, /updateLiveDevPerkTelemetry\(now\);\s*updateMainMenuMascotFaceAnimation\(now\);\s*draw\(\);/);
assert.equal((gameSource.match(/updateMainMenuMascotFaceAnimation\(now\)/g) ?? []).length, 1);

const previewCallOptions = [...uiSource.matchAll(/drawSlimeCharacterPreview\([\s\S]*?\n\s*\);/g)]
  .map(match => match[0]);
assert.equal(previewCallOptions.filter(call => /faceState:/.test(call)).length, 1);
assert.match(previewCallOptions.find(call => /faceState:/.test(call)), /ui\.menuMascot/);

const normalize = source => source.replace(/\r\n/g, "\n");
for (const relativePath of [
  "js/level-generator.js",
  "js/physics.js",
  "js/player.js"
]) {
  const current = fs.readFileSync(path.join(root, relativePath), "utf8");
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the face PNG integration`
  );
}

const baselineGameSource = execFileSync("git", ["show", "HEAD:js/game.js"], {
  cwd: root,
  encoding: "utf8"
});
assert.equal(
  normalize(gameSource),
  normalize(baselineGameSource),
  "game.js must match the final HEAD mascot-face integration contract"
);

console.log("Slime face PNG loading, shared renderer, idle states, visual RNG and fallback tests passed.");
