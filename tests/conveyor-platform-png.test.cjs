"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const assetContracts = Object.freeze({
  left: Object.freeze({
    path: "assets/platforms/conveyor_left.png",
    canvas: [320, 1024],
    bounds: {x: 0, y: 230, w: 320, h: 677},
    visibleBounds: {x: 0, y: 240, w: 320, h: 458},
    source: {x: 0, y: 240, w: 320, h: 476},
    drawWidth: 24
  }),
  middle: Object.freeze({
    path: "assets/platforms/conveyor_middle.png",
    canvas: [1408, 1024],
    bounds: {x: 0, y: 13, w: 1408, h: 898},
    visibleBounds: {x: 0, y: 228, w: 1408, h: 476},
    source: {x: 0, y: 228, w: 1408, h: 476},
    drawWidth: 52
  }),
  right: Object.freeze({
    path: "assets/platforms/conveyor_right.png",
    canvas: [320, 1024],
    bounds: {x: 0, y: 234, w: 320, h: 659},
    visibleBounds: {x: 0, y: 240, w: 320, h: 458},
    source: {x: 0, y: 240, w: 320, h: 476},
    drawWidth: 24
  })
});

function decodeRgbaPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must be RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);

  const idatChunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0, sourceOffset = 0; y < height; y++) {
    const filter = inflated[sourceOffset++];
    for (let x = 0; x < stride; x++, sourceOffset++) {
      const raw = inflated[sourceOffset];
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[(y - 1) * stride + x - bytesPerPixel]
        : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + up
            : filter === 3 ? raw + Math.floor((left + up) / 2)
              : raw + paeth(left, up, upperLeft);
      pixels[y * stride + x] = value & 0xff;
    }
  }

  function getBounds(minimumAlpha) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = pixels[y * stride + x * bytesPerPixel + 3];
        if (alpha < minimumAlpha) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1};
  }

  return {width, height, bounds: getBounds(1), visibleBounds: getBounds(2)};
}

for (const contract of Object.values(assetContracts)) {
  const decoded = decodeRgbaPng(contract.path);
  assert.deepEqual([decoded.width, decoded.height], contract.canvas);
  assert.deepEqual(decoded.bounds, contract.bounds);
  assert.deepEqual(decoded.visibleBounds, contract.visibleBounds);
}

const rendererSource = read("js/renderer.js");
const assetStart = rendererSource.indexOf("  const CONVEYOR_PLATFORM_ASSET_CONTRACT");
const assetEnd = rendererSource.indexOf("  const SPIKE_PLATFORM_ASSET_CONTRACT", assetStart);
const drawStart = rendererSource.indexOf("  function areConveyorPlatformAssetsReady");
const drawEnd = rendererSource.indexOf("  function drawPlatforms(", drawStart);
const platformsStart = drawEnd;
const platformsEnd = rendererSource.indexOf("  function drawGoal(", platformsStart);
assert.ok(assetStart >= 0 && assetEnd > assetStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart);
assert.ok(platformsStart >= 0 && platformsEnd > platformsStart);
const fixtureSource = [
  rendererSource.slice(assetStart, assetEnd),
  rendererSource.slice(drawStart, drawEnd),
  rendererSource.slice(platformsStart, platformsEnd)
].join("\n");
assert.doesNotMatch(fixtureSource, /Math\.random\(/);

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._src = "";
  }

  set src(value) {
    this._src = value;
    const contract = Object.values(assetContracts).find(item => item.path === value);
    this.complete = Boolean(contract);
    this.naturalWidth = contract?.canvas[0] ?? 0;
    this.naturalHeight = contract?.canvas[1] ?? 0;
  }

  get src() {
    return this._src;
  }
}

const events = [];
const stateStack = [];
const state = {fillStyle: "", strokeStyle: "", globalAlpha: 1};
const ctx = {
  save() {
    stateStack.push({...state});
    events.push({type: "save"});
  },
  restore() {
    Object.assign(state, stateStack.pop());
    events.push({type: "restore"});
  },
  drawImage(...args) {
    events.push({type: "drawImage", args});
  },
  fill() {
    events.push({type: "fill", style: state.fillStyle});
  },
  stroke() {
    events.push({type: "stroke", style: state.strokeStyle});
  },
  beginPath() {
    events.push({type: "beginPath"});
  },
  moveTo(...args) {
    events.push({type: "moveTo", args});
  },
  lineTo(...args) {
    events.push({type: "lineTo", args});
  },
  arc(...args) {
    events.push({type: "arc", args});
  },
  rect(...args) {
    events.push({type: "rect", args});
  },
  translate(...args) {
    events.push({type: "translate", args});
  },
  scale(...args) {
    events.push({type: "scale", args});
  },
  closePath() {
    events.push({type: "closePath"});
  },
  clip() {
    events.push({type: "clip"});
  },
  setLineDash() {}
};
for (const property of [
  "fillStyle", "strokeStyle", "globalAlpha", "lineWidth", "lineCap",
  "imageSmoothingEnabled", "imageSmoothingQuality"
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
let meadowBaseCalls = 0;
const rendererContext = vm.createContext({
  Image: FakeImage,
  MEADOW_ASSET_VISUALS: {
    resolvePlatformRole: platform => platform.h === 26 ? "FLOATING" : null,
    drawPlatformBase: () => {
      meadowBaseCalls++;
      return true;
    }
  },
  SPIKE_PLATFORM_FULL_DRAW_WIDTH: 20,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx,
  currentLevel: () => ({seed: 73, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: () => false,
  drawGhostStepFadeOutline: () => {},
  drawIcePlatformAsset: () => false,
  drawSpikePlatformAsset: () => false,
  drawStandardPlatformDetails: () => {},
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => platforms,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  roundedRect: (...args) => events.push({type: "roundedRect", args}),
  worldTime: 1.25
});
vm.runInContext(`${fixtureSource}
  globalThis.conveyorPlatformTestApi = {
    contract: CONVEYOR_PLATFORM_ASSET_CONTRACT,
    drawHeight: CONVEYOR_PLATFORM_DRAW_HEIGHT,
    seamOverlap: CONVEYOR_PLATFORM_SEAM_OVERLAP,
    beltChannel: CONVEYOR_PLATFORM_BELT_CHANNEL,
    images: conveyorPlatformImages,
    ready: areConveyorPlatformAssetsReady,
    draw: drawConveyorPlatformAsset,
    drawOverlay: drawConveyorPlatformBeltOverlay,
    drawPlatforms
  };
`, rendererContext, {filename: "conveyor-platform-renderer-fixture.js"});
const api = rendererContext.conveyorPlatformTestApi;
assert.equal(api.ready(), true);
assert.equal(api.drawHeight, 26);
assert.equal(api.seamOverlap, 1);
assert.deepEqual(JSON.parse(JSON.stringify(api.beltChannel)), {
  top: 7,
  height: 9,
  stripeSpacing: 32,
  stripeWidth: 4,
  stripeLean: 6
});
assert.deepEqual(
  JSON.parse(JSON.stringify(api.contract)),
  Object.fromEntries(Object.entries(assetContracts).map(([name, contract]) => [name, {
    path: contract.path,
    canvas: {w: contract.canvas[0], h: contract.canvas[1]},
    source: contract.source,
    drawWidth: contract.drawWidth
  }]))
);
assert.deepEqual(
  Object.values(assetContracts).map(contract => [contract.source.h, contract.drawWidth]),
  [[476, 24], [476, 52], [476, 24]]
);

function resetEvents() {
  events.length = 0;
  stateStack.length = 0;
  meadowBaseCalls = 0;
  Object.assign(state, {fillStyle: "", strokeStyle: "", globalAlpha: 1});
}

for (const width of [100, 126, 154, 176]) {
  const platform = {
    x: 310.125,
    y: 417.25,
    w: width,
    h: 26,
    conveyor: true,
    conveyorSpeed: 42,
    conveyorData: {phase: 7}
  };
  const snapshot = JSON.stringify(platform);
  resetEvents();
  assert.equal(api.draw(ctx, platform), true);
  assert.equal(JSON.stringify(platform), snapshot);
  const draws = events.filter(event => event.type === "drawImage").map(event => event.args);
  const expectedMiddleCount = Math.ceil((width - 48) / 52);
  assert.equal(draws.length, expectedMiddleCount + 2);
  assert.deepEqual(draws[0].slice(1), [
    0, 240, 320, 476, platform.x, platform.y, 25, 26
  ]);
  assert.deepEqual(draws.at(-1).slice(1), [
    0, 240, 320, 476, platform.x + width - 24, platform.y, 24, 26
  ]);

  const destinations = draws.map(call => ({x: call[5], y: call[6], w: call[7], h: call[8]}));
  assert.ok(destinations.every(destination => destination.y === platform.y));
  assert.ok(destinations.every(destination => destination.h === 26));
  assert.equal(destinations[0].x, platform.x);
  assert.equal(destinations.at(-1).x + destinations.at(-1).w, platform.x + width);
  for (let index = 1; index < destinations.length; index++) {
    assert.equal(
      destinations[index - 1].x + destinations[index - 1].w - destinations[index].x,
      1,
      `width ${width} must use exactly 1px internal overlap at index ${index}`
    );
  }
  assert.equal(
    destinations.at(-1).x + destinations.at(-1).w - destinations[0].x,
    width
  );
  assert.ok(destinations.every(destination => (
    destination.x >= platform.x &&
    destination.x + destination.w <= platform.x + width
  )));

  const middleCalls = draws.slice(1, -1);
  for (const [index, call] of middleCalls.entries()) {
    const remaining = width - 48 - index * 52;
    const destinationWidth = Math.min(52, remaining);
    assert.equal(call[0].src, assetContracts.middle.path);
    assert.deepEqual(call.slice(1, 3), [0, 228]);
    assert.equal(call[3], 1408 * (destinationWidth / 52));
    assert.equal(call[4], 476);
    assert.equal(call[5], platform.x + 24 + index * 52);
    assert.equal(call[6], platform.y);
    assert.equal(call[7], destinationWidth + 1);
    assert.equal(call[8], 26);
  }
}

const leftFacingPlatform = {
  x: 310.125,
  y: 417.25,
  w: 126,
  h: 26,
  conveyor: true,
  conveyorSpeed: -42,
  conveyorData: {phase: 7}
};
resetEvents();
assert.equal(api.draw(ctx, leftFacingPlatform), true);
const leftFacingDraws = events
  .filter(event => event.type === "drawImage")
  .map(event => event.args);
assert.deepEqual(leftFacingDraws[0].slice(1), [
  0, 240, 320, 476,
  leftFacingPlatform.x, leftFacingPlatform.y, 25, 26
]);
assert.deepEqual(leftFacingDraws.at(-1).slice(1), [
  0, 240, 320, 476,
  leftFacingPlatform.x + leftFacingPlatform.w - 24,
  leftFacingPlatform.y, 24, 26
]);
const leftFacingMiddleDraws = leftFacingDraws.slice(1, -1);
assert.deepEqual(leftFacingMiddleDraws.map(call => call.slice(1, 5)), [
  [0, 228, 1408, 476],
  [704, 228, 704, 476]
], "mirrored final crop must sample the right side of the Middle source");
assert.deepEqual(
  events.filter(event => event.type === "scale").map(event => event.args),
  [[-1, 1], [-1, 1]],
  "left-facing Middles must use horizontal-only mirroring"
);
assert.deepEqual(
  events.filter(event => event.type === "translate").map(event => event.args),
  leftFacingMiddleDraws.map(call => [call[5] * 2 + call[7], 0]),
  "mirroring must preserve every Middle destination rectangle"
);
assert.equal(stateStack.length, 0, "Middle mirroring must not leak Canvas state");

const conveyorFixture = {
  x: 310.125,
  y: 417.25,
  w: 126,
  h: 26,
  conveyor: true,
  conveyorSpeed: 42,
  conveyorData: {phase: 7}
};
platforms = [conveyorFixture];
resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, true);
assert.ok(events.some(event => event.type === "drawImage"));
assert.equal(meadowBaseCalls, 0, "valid Conveyor assets must replace the Meadow base");
assert.equal(events.some(event => event.type === "stroke"), false,
  "the old white Chevron overlay must be suppressed above the PNG base");
assert.equal(events.some(event => event.type === "arc"), false,
  "legacy static Canvas rollers must not duplicate the PNG rollers");
assert.deepEqual(
  events.filter(event => event.type === "rect").map(event => event.args),
  [[conveyorFixture.x + 24, conveyorFixture.y + 7, conveyorFixture.w - 48, 9]],
  "animation must clip exactly to the dark Middle channel"
);
const rightMoveEvents = events.filter(event => event.type === "moveTo");
const rightLineEvents = events.filter(event => event.type === "lineTo");
assert.ok(rightMoveEvents.length >= 2);
assert.ok(
  rightLineEvents[1].args[0] > rightMoveEvents[0].args[0],
  "right-facing stripe must lean down-right like \\\\"
);
assert.ok(events.some(event => (
  event.type === "fill" && event.style === "rgba(188,198,210,0.42)"
)), "PNG Conveyor must draw the silver-gray belt overlay");
const rightStripeXAtFirstTime = rightMoveEvents[0].args[0];
rendererContext.worldTime = 1.3;
resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, true);
const rightStripeXAtSecondTime = events.find(event => event.type === "moveTo").args[0];
assert.ok(rightStripeXAtSecondTime > rightStripeXAtFirstTime,
  "right-facing stripe animation must move right");

conveyorFixture.conveyorSpeed = -42;
rendererContext.worldTime = 1.25;
resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, true);
const leftMoveEvents = events.filter(event => event.type === "moveTo");
const leftLineEvents = events.filter(event => event.type === "lineTo");
assert.ok(
  leftLineEvents[1].args[0] < leftMoveEvents[0].args[0],
  "left-facing stripe must lean down-left like ////"
);
const leftStripeXAtFirstTime = leftMoveEvents[0].args[0];
rendererContext.worldTime = 1.3;
resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, true);
const leftStripeXAtSecondTime = events.find(event => event.type === "moveTo").args[0];
assert.ok(leftStripeXAtSecondTime < leftStripeXAtFirstTime,
  "left-facing stripe animation must move left");
conveyorFixture.conveyorSpeed = 42;
rendererContext.worldTime = 1.25;

api.images.middle.naturalWidth = 0;
resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, false);
assert.equal(events.some(event => event.type === "drawImage"), false);
assert.ok(events.some(event => event.type === "fill"), "Canvas base fallback must remain");
assert.ok(events.some(event => event.type === "stroke"), "Chevron fallback must remain");
assert.ok(events.some(event => event.type === "arc"), "legacy roller fallback must remain");
assert.equal(events.some(event => event.type === "rect"), false,
  "new Middle-channel overlay must not run in the fallback path");

resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, true);
assert.equal(events.some(event => event.type === "drawImage"), false);
assert.equal(meadowBaseCalls, 1, "Meadow fallback must remain complete");
api.images.middle.naturalWidth = assetContracts.middle.canvas[0];

const otherPlatformTypes = [
  {x: 100, y: 200, w: 126, h: 26},
  {x: 240, y: 220, w: 126, h: 26, moving: true},
  {x: 380, y: 240, w: 126, h: 26, fade: true, fadeData: {opacity: 0.7}},
  {
    x: 520, y: 260, w: 126, h: 26, fragile: true,
    fallingPlatform: {triggered: false, falling: false, timer: 1}
  },
  {x: 660, y: 280, w: 126, h: 26, ice: true, iceData: {}},
  {
    x: 800, y: 300, w: 126, h: 26, spikePlatform: true,
    spikeData: {dangerous: false, warning: false, extension: 0}
  }
];
platforms = otherPlatformTypes;
resetEvents();
api.drawPlatforms({platform: {body: "#123", top: "#456"}}, false);
assert.equal(events.some(event => event.type === "drawImage"), false);

assert.match(rendererSource,
  /const direction = Math\.sign\(p\.conveyorSpeed\) \|\| 1;/);
assert.match(rendererSource,
  /worldTime \* Math\.abs\(p\.conveyorSpeed\) \* 0\.72 \+[\s\S]*?p\.conveyorData\.phase/);
assert.doesNotMatch(rendererSource, /conveyor_middle_belt\.png/);

const generatorSource = read("js/level-generator.js");
assert.match(generatorSource, /direction: random\(\) < 0\.5 \? -1 : 1/);
assert.match(generatorSource,
  /beltSpeed: randomRange\(random, 92, 126 \+ intensityFactor \* 48\) \* 0\.40/);
const platformsSource = read("js/platforms.js");
assert.match(platformsSource,
  /conveyorSpeed: conveyor\.direction \* conveyor\.beltSpeed/);
assert.match(platformsSource,
  /const beltShift = conveyor\.direction \* conveyor\.beltSpeed \* dt;[\s\S]*?player\.x \+= beltShift;[\s\S]*?pointer\.x \+= beltShift;/);
const physicsSource = read("js/physics.js");
assert.match(physicsSource,
  /const beltShift = player\.conveyorSpeed \* dt;[\s\S]*?player\.x \+= beltShift;/);

for (const relativePath of [
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/visual-meadow-assets.js"
]) {
  const headSource = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(normalize(read(relativePath)), normalize(headSource));
}

console.log("Conveyor 3-part PNG mapping, directional Middle, clipped overlay, fallback and frozen-scope tests passed.");
