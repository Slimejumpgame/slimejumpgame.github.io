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
    path: "assets/environments/coast/platforms/coast_floating_left.png",
    canvas: [112, 127],
    alphaBounds: {x: 1, y: 22, w: 111, h: 87}
  }),
  middle: Object.freeze({
    path: "assets/environments/coast/platforms/coast_floating_middle.png",
    canvas: [300, 127],
    alphaBounds: {x: 0, y: 18, w: 300, h: 91}
  }),
  right: Object.freeze({
    path: "assets/environments/coast/platforms/coast_floating_right.png",
    canvas: [108, 127],
    alphaBounds: {x: 0, y: 25, w: 107, h: 83}
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

  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const stride = width * 4;
  const inflated = zlib.inflateSync(Buffer.concat(chunks));
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
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + up
            : filter === 3 ? raw + Math.floor((left + up) / 2)
              : raw + paeth(left, up, upperLeft);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * stride + x * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    width,
    height,
    alphaBounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1}
  };
}

for (const contract of Object.values(assetContracts)) {
  const decoded = decodeRgbaPng(contract.path);
  assert.deepEqual([decoded.width, decoded.height], contract.canvas);
  assert.deepEqual(decoded.alphaBounds, contract.alphaBounds);
}

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

const drawCalls = [];
const clipCalls = [];
const canvasContext = {
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  arcTo() {},
  closePath() {},
  clip() {
    clipCalls.push(true);
  },
  drawImage(...args) {
    drawCalls.push(args);
  }
};
const coastContext = vm.createContext({Image: FakeImage});
vm.runInContext(`${read("js/visual-coast-assets.js")}
  globalThis.coastTestApi = COAST_ASSET_VISUALS;
`, coastContext, {filename: "visual-coast-assets-test.js"});
const coastApi = coastContext.coastTestApi;
const status = JSON.parse(JSON.stringify(coastApi.getStatus()));
const sourceScale = 26 / 86;
assert.equal(status.ready, true);
assert.equal(status.drawHeight, 26);
assert.equal(status.seamOverlap, 1);
assert.deepEqual(status.segmentWidths, {
  left: 112 * sourceScale,
  middle: 300 * sourceScale,
  right: 108 * sourceScale
});
assert.deepEqual(
  Object.values(status.contract).map(contract => contract.source),
  [
    {x: 0, y: 22, w: 112, h: 86},
    {x: 0, y: 22, w: 300, h: 86},
    {x: 0, y: 22, w: 108, h: 86}
  ]
);

for (const width of [100, 138, 176]) {
  const platform = {x: 420.25, y: 310.5, w: width, h: 26};
  const snapshot = JSON.stringify(platform);
  drawCalls.length = 0;
  clipCalls.length = 0;
  assert.equal(coastApi.drawPlatformBase(canvasContext, platform), true);
  assert.equal(JSON.stringify(platform), snapshot);
  assert.equal(clipCalls.length, 1);

  const leftWidth = status.segmentWidths.left;
  const middleTileWidth = status.segmentWidths.middle;
  const rightWidth = status.segmentWidths.right;
  const middleAvailableWidth = width - leftWidth - rightWidth;
  const middleCount = Math.ceil(middleAvailableWidth / middleTileWidth);
  assert.equal(drawCalls.length, middleCount + 2);

  const middleCalls = drawCalls.slice(0, -2);
  const leftCall = drawCalls.at(-2);
  const rightCall = drawCalls.at(-1);
  assert.deepEqual(leftCall.slice(1, 5), [0, 22, 112, 86]);
  assert.deepEqual(leftCall.slice(5), [platform.x, platform.y, leftWidth + 1, 26]);
  assert.deepEqual(rightCall.slice(1, 5), [0, 22, 108, 86]);
  assert.deepEqual(rightCall.slice(5), [
    platform.x + width - rightWidth, platform.y, rightWidth, 26
  ]);

  for (const [index, call] of middleCalls.entries()) {
    const remaining = middleAvailableWidth - index * middleTileWidth;
    const destinationWidth = Math.min(middleTileWidth, remaining);
    assert.deepEqual(call.slice(1, 3), [0, 22]);
    assert.equal(call[3], 300 * (destinationWidth / middleTileWidth));
    assert.equal(call[4], 86);
    assert.deepEqual(call.slice(5), [
      platform.x + leftWidth + index * middleTileWidth,
      platform.y,
      destinationWidth + 1,
      26
    ]);
  }

  assert.equal(leftCall[5], platform.x);
  assert.equal(rightCall[5] + rightCall[7], platform.x + width);
  assert.equal(leftCall[5] + leftCall[7] - middleCalls[0][5], 1);
  assert.equal(
    middleCalls.at(-1)[5] + middleCalls.at(-1)[7] - rightCall[5],
    1
  );
  for (let index = 1; index < middleCalls.length; index++) {
    assert.equal(
      middleCalls[index - 1][5] + middleCalls[index - 1][7] - middleCalls[index][5],
      1
    );
  }
}

coastContext.coastTestApi.getStatus().contract.middle;
const coastImages = vm.runInContext("images", coastContext);
coastImages.middle.naturalWidth = 0;
drawCalls.length = 0;
assert.equal(
  coastApi.drawPlatformBase(canvasContext, {x: 0, y: 0, w: 126, h: 26}),
  false
);
assert.equal(drawCalls.length, 0, "invalid Coast set must leave the safe renderer fallback intact");
coastImages.middle.naturalWidth = 300;

const rendererSource = read("js/renderer.js");
const drawStart = rendererSource.indexOf("  function drawPlatforms(");
const drawEnd = rendererSource.indexOf("  function drawGoal(", drawStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart);
const rendererCalls = {coast: 0, meadow: 0, details: 0, fallback: 0};
let rendererPlatforms = [];
const rendererCanvas = new Proxy({
  save() {}, restore() {}, beginPath() {}, closePath() {}, clip() {},
  fill() { rendererCalls.fallback++; }, stroke() {}, setLineDash() {},
  moveTo() {}, lineTo() {}, arc() {}
}, {
  get(target, property) {
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});
const rendererContext = vm.createContext({
  COAST_ASSET_VISUALS: {
    drawPlatformBase: () => {
      rendererCalls.coast++;
      return true;
    }
  },
  MEADOW_ASSET_VISUALS: {
    resolvePlatformRole: platform => platform.h === 26 ? "FLOATING" : null,
    drawPlatformBase: () => {
      rendererCalls.meadow++;
      return true;
    }
  },
  SPIKE_PLATFORM_FULL_DRAW_WIDTH: 20,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx: rendererCanvas,
  currentLevel: () => ({seed: 73, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawConveyorPlatformAsset: (context, platform) => Boolean(platform.conveyor),
  drawConveyorPlatformBeltOverlay: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: (context, platform) => Boolean(platform.fragile),
  drawGhostStepFadeOutline: () => {},
  drawIcePlatformAsset: (context, platform) => Boolean(platform.ice),
  drawSpikePlatformAsset: () => true,
  drawStandardPlatformDetails: () => { rendererCalls.details++; },
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => rendererPlatforms,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  roundedRect: () => {},
  worldTime: 1.25
});
vm.runInContext(`${rendererSource.slice(drawStart, drawEnd)}
  globalThis.drawPlatformsForCoastTest = drawPlatforms;
`, rendererContext, {filename: "coast-renderer-test.js"});
const drawPlatforms = rendererContext.drawPlatformsForCoastTest;
const resetRendererCalls = () => Object.assign(rendererCalls, {
  coast: 0, meadow: 0, details: 0, fallback: 0
});
const coastBiome = {id: "coast", platform: {body: "#123", top: "#456"}};
const meadowBiome = {id: "meadow", platform: {body: "#123", top: "#456"}};

rendererPlatforms = [{x: 100, y: 200, w: 126, h: 26}];
resetRendererCalls();
drawPlatforms(coastBiome, false);
assert.deepEqual(rendererCalls, {coast: 1, meadow: 0, details: 0, fallback: 0});
resetRendererCalls();
drawPlatforms(meadowBiome, true);
assert.deepEqual(rendererCalls, {coast: 0, meadow: 1, details: 0, fallback: 0});

for (const platform of [
  {x: 100, y: 200, w: 126, h: 26, moving: true},
  {x: 100, y: 200, w: 126, h: 26, fade: true, fadeData: {opacity: 0.7}},
  {
    x: 100, y: 200, w: 126, h: 26, spikePlatform: true,
    spikeData: {warning: false, dangerous: false, extension: 0}
  }
]) {
  rendererPlatforms = [platform];
  resetRendererCalls();
  drawPlatforms(coastBiome, false);
  assert.equal(rendererCalls.coast, 1, "Moving/Fading/Spike must reuse the Coast base");
  assert.equal(rendererCalls.meadow, 0);
  assert.equal(rendererCalls.details, 0);
}

for (const platform of [
  {
    x: 100, y: 200, w: 126, h: 26, fragile: true,
    fallingPlatform: {triggered: false, falling: false, timer: 1}
  },
  {x: 100, y: 200, w: 126, h: 26, ice: true},
  {
    x: 100, y: 200, w: 126, h: 26, conveyor: true,
    conveyorSpeed: 42, conveyorData: {phase: 0}
  }
]) {
  rendererPlatforms = [platform];
  resetRendererCalls();
  drawPlatforms(coastBiome, false);
  assert.equal(rendererCalls.coast, 0, "global special visuals must bypass Coast assets");
}

const biomeContext = vm.createContext({});
vm.runInContext(`${read("js/biomes.js")}
  globalThis.getBiomeForCoastTest = getBiomeForLevel;
`, biomeContext, {filename: "coast-biome-test.js"});
assert.equal(biomeContext.getBiomeForCoastTest(11).id, "coast");
assert.equal(biomeContext.getBiomeForCoastTest(1).id, "meadow");

assert.match(read("index.html"), /visual-coast-assets\.js[\s\S]*renderer\.js/);
assert.doesNotMatch(read("js/visual-coast-assets.js"), /Math\.random\(/);
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

console.log("Coast floating PNG bounds, proportional tiling, fallback and biome scope tests passed.");
