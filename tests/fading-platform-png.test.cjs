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
    path: "assets/platforms/fading_platform_left.png",
    canvas: [140, 150],
    bounds: {x: 75, y: 48, w: 65, h: 53},
    source: {x: 75, y: 47, w: 65, h: 55},
    drawWidth: 24
  }),
  middle: Object.freeze({
    path: "assets/platforms/fading_platform_middle.png",
    canvas: [280, 150],
    bounds: {x: 0, y: 47, w: 280, h: 51},
    source: {x: 0, y: 47, w: 280, h: 55},
    drawWidth: 52
  }),
  right: Object.freeze({
    path: "assets/platforms/fading_platform_right.png",
    canvas: [140, 150],
    bounds: {x: 0, y: 48, w: 65, h: 54},
    source: {x: 0, y: 47, w: 65, h: 55},
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

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let transparentPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[y * stride + x * bytesPerPixel + 3];
      if (alpha === 0) {
        transparentPixels++;
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    width,
    height,
    transparentPixels,
    bounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1}
  };
}

for (const contract of Object.values(assetContracts)) {
  const decoded = decodeRgbaPng(contract.path);
  assert.deepEqual([decoded.width, decoded.height], contract.canvas);
  assert.deepEqual(decoded.bounds, contract.bounds);
  assert.ok(decoded.transparentPixels > 0, `${contract.path} must retain transparency`);
}

const rendererSource = read("js/renderer.js");
const assetStart = rendererSource.indexOf("  const FADING_PLATFORM_ASSET_CONTRACT");
const assetEnd = rendererSource.indexOf("  const TUTORIAL_DRAG_HAND_RENDER_SIZE", assetStart);
const drawStart = rendererSource.indexOf("  function areFadingPlatformAssetsReady");
const drawEnd = rendererSource.indexOf("  function drawCanvasBouncePadFallback", drawStart);
const platformsStart = rendererSource.indexOf("  function drawPlatforms(");
const platformsEnd = rendererSource.indexOf("  function drawGoal(", platformsStart);
assert.ok(assetStart >= 0 && assetEnd > assetStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart);
assert.ok(platformsStart >= 0 && platformsEnd > platformsStart);
const fadingRendererSource = [
  rendererSource.slice(assetStart, assetEnd),
  rendererSource.slice(drawStart, drawEnd),
  rendererSource.slice(platformsStart, platformsEnd)
].join("\n");
assert.doesNotMatch(fadingRendererSource, /Math\.random\(/);

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
const canvasCalls = [];
const alphaAssignments = [];
const fakeCanvasContext = new Proxy({}, {
  get(target, property) {
    if (property === "drawImage") return (...args) => drawCalls.push(args);
    if (["fill", "stroke", "moveTo", "lineTo"].includes(property)) {
      return (...args) => canvasCalls.push([property, ...args]);
    }
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    if (property === "globalAlpha") alphaAssignments.push(value);
    target[property] = value;
    return true;
  }
});

let meadowBaseCalls = 0;
let ghostStepOutlineCalls = 0;
const rendererContext = vm.createContext({
  Image: FakeImage,
  MEADOW_ASSET_VISUALS: {
    drawPlatformBase: () => {
      meadowBaseCalls++;
      return true;
    },
    resolvePlatformRole: platform => platform.h === 26 ? "FLOATING" : null
  },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx: fakeCanvasContext,
  currentLevel: () => ({seed: 73, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: () => false,
  drawGhostStepFadeOutline: platform => {
    if (platform?.fade) ghostStepOutlineCalls++;
  },
  drawIcePlatformAsset: () => false,
  drawStandardPlatformDetails: () => {},
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => rendererContext.platforms,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  platforms: [],
  roundedRect: () => {},
  worldTime: 1.25
});
vm.runInContext(`${fadingRendererSource}
  globalThis.fadingPlatformTestApi = {
    contract: FADING_PLATFORM_ASSET_CONTRACT,
    seamOverlap: FADING_PLATFORM_SEAM_OVERLAP,
    images: fadingPlatformImages,
    draw: drawFadingPlatformAsset,
    ready: areFadingPlatformAssetsReady,
    drawPlatforms
  };
`, rendererContext, {filename: "fading-platform-renderer-fixture.js"});
const api = rendererContext.fadingPlatformTestApi;
assert.equal(api.ready(), true);
assert.equal(api.seamOverlap, 1);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.contract)),
  Object.fromEntries(Object.entries(assetContracts).map(([name, contract]) => [name, {
    path: contract.path,
    canvas: {w: contract.canvas[0], h: contract.canvas[1]},
    source: contract.source,
    drawWidth: contract.drawWidth
  }]))
);

for (const width of [100, 126, 154, 176]) {
  const platform = {
    x: 310.125,
    y: 417.25,
    w: width,
    h: 26,
    fade: true,
    fadeData: {opacity: 0.72, solid: true}
  };
  const before = JSON.stringify(platform);
  drawCalls.length = 0;
  assert.equal(api.draw(fakeCanvasContext, platform), true);
  assert.equal(JSON.stringify(platform), before, "visual drawing must not mutate Fade geometry");

  const expectedMiddleCount = Math.ceil((width - 48) / 52);
  assert.equal(drawCalls.length, expectedMiddleCount + 2);
  assert.deepEqual(
    drawCalls[0].slice(1),
    [75, 47, 65, 55, platform.x, platform.y, 25, 26]
  );
  assert.deepEqual(
    drawCalls.at(-1).slice(1),
    [0, 47, 65, 55, platform.x + width - 24, platform.y, 24, 26]
  );

  const destinations = drawCalls.map(call => ({x: call[5], y: call[6], w: call[7], h: call[8]}));
  assert.equal(destinations[0].x, platform.x);
  assert.equal(destinations.at(-1).x + destinations.at(-1).w, platform.x + width);
  assert.ok(destinations.every(destination => destination.y === platform.y));
  assert.ok(destinations.every(destination => destination.h === 26));
  for (let index = 1; index < destinations.length; index++) {
    assert.equal(
      destinations[index - 1].x + destinations[index - 1].w - destinations[index].x,
      1,
      `width ${width} must use exactly 1px internal overlap at index ${index}`
    );
  }
  assert.equal(
    destinations.at(-1).x + destinations.at(-1).w - destinations[0].x,
    width,
    "internal overlap must not change the outer platform width"
  );
  assert.ok(destinations.every(destination => (
    destination.x >= platform.x &&
    destination.x + destination.w <= platform.x + width
  )), "no overlapped segment may exceed the outer platform bounds");

  const middleCalls = drawCalls.slice(1, -1);
  for (const [index, call] of middleCalls.entries()) {
    const remaining = width - 48 - index * 52;
    const expectedDestinationWidth = Math.min(52, remaining);
    assert.equal(call[0].src, assetContracts.middle.path);
    assert.equal(call[1], 0);
    assert.equal(call[2], 47);
    assert.equal(call[3], 280 * expectedDestinationWidth / 52);
    assert.equal(call[4], 55);
    assert.equal(call[5], platform.x + 24 + index * 52);
    assert.equal(call[7], expectedDestinationWidth + 1);
    assert.equal(call[8], 26);
    if (remaining >= 52) {
      assert.equal(call[3], 280);
      assert.equal(call[7], 53);
    }
  }
  assert.equal(platform.h, 26);
}

assert.deepEqual(
  Object.values(assetContracts).map(contract => [contract.source.y, contract.source.h]),
  [[47, 55], [47, 55], [47, 55]],
  "all three master segments must use one shared vertical source scale"
);

assert.equal(api.draw(fakeCanvasContext, {x: 0, y: 0, w: 126, h: 26}, 0), false);
assert.equal(api.draw(fakeCanvasContext, {x: 0, y: 0, w: 47, h: 26, fade: true}, 0), false);

const fadeFixture = {
  x: 310.125,
  y: 417.25,
  w: 126,
  h: 26,
  fade: true,
  fadeData: {opacity: 0.72, solid: true}
};
const fadeSnapshot = JSON.stringify(fadeFixture);
rendererContext.platforms = [fadeFixture];
for (const useMeadowAssets of [false, true]) {
  drawCalls.length = 0;
  canvasCalls.length = 0;
  alphaAssignments.length = 0;
  meadowBaseCalls = 0;
  ghostStepOutlineCalls = 0;
  api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, useMeadowAssets);
  assert.ok(drawCalls.length > 0, "global Fading PNG must render in every biome path");
  assert.equal(meadowBaseCalls, 0, "Meadow/Canvas base must not render behind valid Fading PNGs");
  assert.equal(canvasCalls.filter(call => call[0] === "stroke").length, 0,
    "legacy dashed outline must be suppressed when the PNG set is active");
  assert.ok(alphaAssignments.includes(0.72), "existing fadeData.opacity must wrap the asset draw");
  assert.equal(ghostStepOutlineCalls, 1, "Ghost-Step overlay hook must remain after the asset");
  assert.equal(JSON.stringify(fadeFixture), fadeSnapshot);
}

api.images.right.naturalWidth = 0;
drawCalls.length = 0;
canvasCalls.length = 0;
meadowBaseCalls = 0;
ghostStepOutlineCalls = 0;
api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, true);
assert.equal(drawCalls.length, 0, "an incomplete set must never render partially");
assert.equal(meadowBaseCalls, 1, "Meadow fallback must remain available");
assert.ok(canvasCalls.some(call => call[0] === "stroke"),
  "legacy dashed outline must remain in the fallback");
assert.equal(ghostStepOutlineCalls, 1);

drawCalls.length = 0;
canvasCalls.length = 0;
meadowBaseCalls = 0;
api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, false);
assert.equal(drawCalls.length, 0);
assert.ok(canvasCalls.some(call => call[0] === "fill"), "Canvas body fallback must remain");
assert.ok(canvasCalls.some(call => call[0] === "stroke"),
  "Canvas fallback must retain the dashed outline");
api.images.right.naturalWidth = assetContracts.right.canvas[0];

const otherPlatformTypes = [
  {x: 100, y: 200, w: 126, h: 26},
  {x: 240, y: 220, w: 126, h: 26, moving: true},
  {
    x: 380, y: 240, w: 126, h: 26, fragile: true,
    fallingPlatform: {triggered: false, falling: false, timer: 1}
  },
  {x: 520, y: 260, w: 126, h: 26, ice: true},
  {
    x: 660, y: 280, w: 126, h: 26, conveyor: true,
    conveyorSpeed: 42, conveyorData: {phase: 0}
  },
  {
    x: 800, y: 300, w: 126, h: 26, spikePlatform: true,
    spikeData: {dangerous: false, warning: false, extension: 0}
  }
];
const otherPlatformSnapshot = JSON.stringify(otherPlatformTypes);
rendererContext.platforms = otherPlatformTypes;
drawCalls.length = 0;
api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, false);
assert.equal(drawCalls.length, 0, "other platform types must never use Fading assets");
assert.equal(JSON.stringify(otherPlatformTypes), otherPlatformSnapshot);

const platformSource = read("js/platforms.js");
assert.match(platformSource, /const wave = \(Math\.cos\(elapsed \* platform\.speed \+ platform\.phase\) \+ 1\) \* 0\.5;/);
assert.match(platformSource, /platform\.opacity = 0\.06 \+ wave \* 0\.94;/);
assert.match(platformSource, /platform\.solid && platform\.opacity <= 0\.30/);
assert.match(platformSource, /!platform\.solid && platform\.opacity >= 0\.40/);
assert.match(rendererSource, /drawGhostStepFadeOutline\(p, drawX\);/);

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

console.log("Fading platform PNG bounds, alpha, global tiling, fallback and frozen-scope tests passed.");
