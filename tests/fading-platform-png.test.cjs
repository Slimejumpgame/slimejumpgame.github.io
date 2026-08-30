"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const rendererSource = read("js/renderer.js");
const platformSource = read("js/platforms.js");

assert.doesNotMatch(rendererSource, /fading_platform_(?:left|middle|right)\.png/);
assert.doesNotMatch(rendererSource, /FADING_PLATFORM_ASSET_CONTRACT/);
assert.doesNotMatch(rendererSource, /fadingPlatformImages/);
assert.doesNotMatch(rendererSource, /drawFadingPlatformAsset/);
assert.doesNotMatch(rendererSource, /areFadingPlatformAssetsReady/);

const platformsStart = rendererSource.indexOf("  function drawVectorPlatformSurface(");
const platformsEnd = rendererSource.indexOf("  function drawGoal(", platformsStart);
assert.ok(platformsStart >= 0 && platformsEnd > platformsStart);
const fadingRendererSource = rendererSource.slice(platformsStart, platformsEnd);
assert.doesNotMatch(fadingRendererSource, /Math\.random\(/);
assert.doesNotMatch(rendererSource, /drawGhostStepFadeOutline/);
assert.doesNotMatch(rendererSource, /rgba\(230,215,255,0\.8\)/);
assert.doesNotMatch(rendererSource, /rgba\(221,205,255,0\.92\)/);

const events = [];
const roundedRects = [];
const stateStack = [];
const state = {
  globalAlpha: 1,
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  shadowColor: "",
  shadowBlur: 0,
  lineDash: []
};
const ctx = {
  save() {
    stateStack.push({...state, lineDash: [...state.lineDash]});
  },
  restore() {
    Object.assign(state, stateStack.pop());
  },
  fill() {
    events.push({type: "fill", style: state.fillStyle, alpha: state.globalAlpha});
  },
  stroke() {
    events.push({
      type: "stroke",
      style: state.strokeStyle,
      alpha: state.globalAlpha,
      lineDash: [...state.lineDash]
    });
  },
  setLineDash(value) {
    state.lineDash = [...value];
    events.push({type: "lineDash", value: [...value]});
  },
  beginPath() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  closePath() {}
};
for (const property of [
  "globalAlpha", "fillStyle", "strokeStyle", "lineWidth", "shadowColor", "shadowBlur"
]) {
  Object.defineProperty(ctx, property, {
    get: () => state[property],
    set: value => {
      state[property] = value;
      events.push({type: "set", property, value});
    }
  });
}

let platforms = [];
let meadowAssetsReady = true;
const meadowBaseCalls = [];
const standardDetailCalls = [];
const context = vm.createContext({
  MEADOW_ASSET_VISUALS: {
    resolvePlatformRole: platform => platform.h === 26 ? "FLOATING" : null,
    drawPlatformBase: (canvasContext, platform, drawX, levelSeed) => {
      meadowBaseCalls.push({platform, drawX, levelSeed, alpha: canvasContext.globalAlpha});
      return meadowAssetsReady;
    }
  },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx,
  currentLevel: () => ({seed: 73, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: () => false,
  drawIcePlatformAsset: () => false,
  drawStandardPlatformDetails: (x, y, w, h, biomePlatform) => {
    standardDetailCalls.push({x, y, w, h, biomePlatform, alpha: ctx.globalAlpha});
  },
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => platforms,
  isGhostStepActive: () => true,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  roundedRect: (...args) => roundedRects.push(args),
  worldTime: 1.25
});
vm.runInContext(`${fadingRendererSource}
  globalThis.fadingBiomeBaseTestApi = {drawPlatforms};
`, context, {filename: "fading-biome-base-renderer-fixture.js"});
const api = context.fadingBiomeBaseTestApi;

const biome = {
  platform: {
    body: "#b86f3f",
    top: "#f1c46d",
    detail: "sandstone",
    detailColor: "#7f472f"
  }
};
const fadeFixture = {
  x: 310.125,
  y: 417.25,
  w: 126,
  h: 26,
  fade: true,
  fadeData: {opacity: 0.37, solid: true}
};
const fadeSnapshot = JSON.stringify(fadeFixture);

function resetDrawAudit() {
  events.length = 0;
  roundedRects.length = 0;
  meadowBaseCalls.length = 0;
  standardDetailCalls.length = 0;
  stateStack.length = 0;
  Object.assign(state, {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowColor: "",
    shadowBlur: 0,
    lineDash: []
  });
}

platforms = [fadeFixture];
resetDrawAudit();
api.drawPlatforms(biome, context.MEADOW_ASSET_VISUALS);
assert.equal(meadowBaseCalls.length, 1,
  "Meadow Fading must use the normal Meadow floating base renderer");
assert.deepEqual(meadowBaseCalls[0], {
  platform: fadeFixture,
  drawX: fadeFixture.x,
  levelSeed: 73,
  alpha: 0.37
});
assert.equal(events.filter(event => event.type === "fill").length, 0,
  "the Canvas base must not draw behind a ready Meadow floating base");
assert.equal(standardDetailCalls.length, 0);

assert.equal(events.filter(event => event.type === "stroke").length, 0,
  "Fading/Ghost must not draw an extra outline around the Whole base");
assert.equal(events.filter(event => event.type === "lineDash").length, 0,
  "Fading/Ghost must not draw the former dashed frame");
assert.equal(roundedRects.length, 0,
  "a ready Whole base must be the only Fading/Ghost platform body");

resetDrawAudit();
api.drawPlatforms(biome, false);
assert.equal(meadowBaseCalls.length, 0);
assert.deepEqual(
  events.filter(event => event.type === "fill").map(event => [event.style, event.alpha]),
  [[biome.platform.body, 0.37], [biome.platform.top, 0.37]],
  "non-Meadow Fading must use the current biome body/top colors"
);
assert.equal(standardDetailCalls.length, 1,
  "non-Meadow Fading must retain the normal biome detail renderer");
assert.deepEqual(standardDetailCalls[0], {
  x: fadeFixture.x,
  y: fadeFixture.y,
  w: fadeFixture.w,
  h: fadeFixture.h,
  biomePlatform: biome.platform,
  alpha: 0.37
});
assert.equal(events.filter(event => event.type === "stroke").length, 0,
  "Canvas fallback must not reintroduce the removed Fading/Ghost frame");
assert.equal(events.filter(event => event.type === "lineDash").length, 0);
assert.equal(roundedRects.length, 2,
  "Canvas fallback keeps only its body and top surface, without a third frame box");

meadowAssetsReady = false;
resetDrawAudit();
api.drawPlatforms(biome, context.MEADOW_ASSET_VISUALS);
assert.equal(meadowBaseCalls.length, 1);
assert.deepEqual(
  events.filter(event => event.type === "fill").map(event => event.style),
  [biome.platform.body, biome.platform.top],
  "missing Meadow assets must fall back to a visible biome Canvas base"
);
assert.equal(standardDetailCalls.length, 1);
assert.equal(events.filter(event => event.type === "stroke").length, 0);
assert.equal(events.filter(event => event.type === "lineDash").length, 0);
meadowAssetsReady = true;

const movingFixture = {
  x: 220.375,
  y: 340.625,
  w: 126,
  h: 26,
  moving: true,
  movingData: {}
};
const movingSnapshot = JSON.stringify(movingFixture);
platforms = [movingFixture];
resetDrawAudit();
api.drawPlatforms(biome, context.MEADOW_ASSET_VISUALS);
assert.equal(meadowBaseCalls.length, 1,
  "Moving and Fading must share the normal Meadow platform-base route");
assert.deepEqual(meadowBaseCalls[0], {
  platform: movingFixture,
  drawX: movingFixture.x,
  levelSeed: 73,
  alpha: 1
}, "Moving Whole mapping must receive the current animated x/y geometry unchanged");
assert.equal(events.filter(event => event.type === "fill").length, 0,
  "a successful Moving Whole render must not receive a second Canvas basis or top strip");
assert.equal(roundedRects.length, 0,
  "Moving Whole must consist of exactly the platform-kit base draw");
assert.equal(JSON.stringify(movingFixture), movingSnapshot);

meadowAssetsReady = false;
resetDrawAudit();
api.drawPlatforms(biome, context.MEADOW_ASSET_VISUALS);
assert.equal(meadowBaseCalls.length, 1);
assert.deepEqual(
  events.filter(event => event.type === "fill").map(event => event.style).slice(0, 2),
  ["#5e7592", "#a7d2ff"],
  "Moving must retain its complete Canvas basis when Whole is unavailable"
);
assert.equal(roundedRects.length, 2);
meadowAssetsReady = true;

const normalFloatingFixture = {x: 180.5, y: 290.25, w: 138, h: 26};
platforms = [normalFloatingFixture];
meadowAssetsReady = false;
resetDrawAudit();
api.drawPlatforms(biome, context.MEADOW_ASSET_VISUALS);
assert.equal(meadowBaseCalls.length, 1);
assert.deepEqual(
  events.filter(event => event.type === "fill").map(event => event.style).slice(0, 2),
  [biome.platform.body, biome.platform.top],
  "normal Floating must fall directly back to its Canvas basis when Whole is unavailable"
);
assert.equal(roundedRects.length, 2);
assert.equal(standardDetailCalls.length, 1);
meadowAssetsReady = true;

assert.equal(JSON.stringify(fadeFixture), fadeSnapshot,
  "visual drawing must not mutate Fading geometry or state");
assert.match(platformSource,
  /const wave = \(Math\.cos\(elapsed \* platform\.speed \+ platform\.phase\) \+ 1\) \* 0\.5;/);
assert.match(platformSource, /platform\.opacity = 0\.06 \+ wave \* 0\.94;/);
assert.match(platformSource, /platform\.solid && platform\.opacity <= 0\.30/);
assert.match(platformSource, /!platform\.solid && platform\.opacity >= 0\.40/);
assert.match(read("js/level-generator.js"),
  /speed: randomRange\(random, 1\.02, 1\.22 \+ intensityFactor \* 0\.18\)/);
assert.match(rendererSource, /if \(p\.fade\) ctx\.globalAlpha = p\.fadeData\.opacity;/);
assert.doesNotMatch(rendererSource, /drawGhostStepFadeOutline\(p, drawX\);/);
assert.doesNotMatch(rendererSource, /p\.moving && biomeAssetPlatform/);
assert.doesNotMatch(rendererSource, /rgba\(167,210,255,0\.62\)/);

const protectedFiles = [
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js"
];
for (const relativePath of protectedFiles) {
  const headSource = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(normalize(read(relativePath)), normalize(headSource));
}

console.log("Fading Whole base, alpha, no-frame, fallback and frozen-scope tests passed.");
