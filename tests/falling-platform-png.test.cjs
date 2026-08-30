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
    path: "assets/platforms/falling_platform_left.png",
    canvas: [120, 130],
    bounds: {x: 2, y: 24, w: 118, h: 77},
    source: {x: 4, y: 26, w: 116, h: 77},
    drawWidth: 24
  }),
  middle: Object.freeze({
    path: "assets/platforms/falling_platform_middle.png",
    canvas: [260, 130],
    bounds: {x: 0, y: 26, w: 260, h: 97},
    source: {x: 0, y: 26, w: 260, h: 77},
    drawWidth: 52
  }),
  right: Object.freeze({
    path: "assets/platforms/falling_platform_right.png",
    canvas: [120, 130],
    bounds: {x: 0, y: 23, w: 118, h: 80},
    source: {x: 0, y: 26, w: 116, h: 77},
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * stride + x * bytesPerPixel + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    width,
    height,
    bounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1}
  };
}

for (const contract of Object.values(assetContracts)) {
  const decoded = decodeRgbaPng(contract.path);
  assert.deepEqual([decoded.width, decoded.height], contract.canvas);
  assert.deepEqual(decoded.bounds, contract.bounds);
}
assert.deepEqual(
  Object.values(assetContracts).map(contract => [contract.source.y, contract.source.h]),
  [[26, 77], [26, 77], [26, 77]],
  "all three master slices must use one shared vertical source zone"
);
assert.deepEqual(
  Object.values(assetContracts).map(contract => contract.drawWidth),
  [24, 52, 24],
  "the nominal LEFT/MIDDLE/RIGHT segment widths must stay frozen"
);

const rendererSource = read("js/renderer.js");
const assetStart = rendererSource.indexOf("  const GLOBAL_WHOLE_PLATFORM_SOURCE_SIZE");
const assetEnd = rendererSource.indexOf("  const TUTORIAL_DRAG_HAND_RENDER_SIZE", assetStart);
const helperStart = rendererSource.indexOf("  function isGlobalWholePlatformAssetReady");
const helperEnd = rendererSource.indexOf("  function areLegacyFallingPlatformAssetsReady", helperStart);
const drawStart = rendererSource.indexOf("  function areLegacyFallingPlatformAssetsReady");
const drawEnd = rendererSource.indexOf("  function drawCanvasBouncePadFallback", drawStart);
const platformsStart = rendererSource.indexOf("  function drawVectorPlatformSurface(");
const platformsEnd = rendererSource.indexOf("  function drawGoal(", platformsStart);
assert.ok(assetStart >= 0 && assetEnd > assetStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart);
assert.ok(platformsStart >= 0 && platformsEnd > platformsStart);
const fallingRendererSource = [
  rendererSource.slice(assetStart, assetEnd),
  rendererSource.slice(helperStart, helperEnd),
  rendererSource.slice(drawStart, drawEnd),
  rendererSource.slice(platformsStart, platformsEnd)
].join("\n");
assert.doesNotMatch(fallingRendererSource, /Math\.random\(/);

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
const fakeCanvasContext = new Proxy({}, {
  get(target, property) {
    if (property === "drawImage") return (...args) => drawCalls.push(args);
    if (["fill", "stroke", "moveTo", "lineTo", "beginPath", "rect", "clip"].includes(property)) {
      return (...args) => canvasCalls.push([property, ...args]);
    }
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});

let meadowBaseCalls = 0;
let anchorWarningCalls = 0;
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
  drawAnchorStepWarningBorder: () => {
    anchorWarningCalls++;
  },
  drawConveyorPlatformAsset: () => false,
  drawDeathZone: () => {},
  drawGhostStepFadeOutline: () => {},
  drawStandardPlatformDetails: () => {},
  getFallingPlatformActivationDelay: () => 1,
  getSpikePlatformSlotVisual: () => ({phase: "CLOSED", openness: 0}),
  getPlatforms: () => rendererContext.platforms,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  platforms: [],
  roundedRect: () => {},
  worldTime: 1.25
});
vm.runInContext(`${fallingRendererSource}
  globalThis.fallingPlatformTestApi = {
    contract: FALLING_PLATFORM_ASSET_CONTRACT,
    seamOverlap: FALLING_PLATFORM_SEAM_OVERLAP,
    edgeOverhang: SPECIAL_PLATFORM_EDGE_OVERHANG,
    bodyHeight: SPECIAL_PLATFORM_BODY_DRAW_HEIGHT,
    bodyTopOffset: SPECIAL_PLATFORM_BODY_TOP_OFFSET,
    images: fallingPlatformImages,
    draw: drawFallingPlatformAsset,
    ready: areFallingPlatformAssetsReady,
    drawPlatforms
  };
`, rendererContext, {filename: "falling-platform-renderer-fixture.js"});
const api = rendererContext.fallingPlatformTestApi;
assert.equal(api.ready(), true);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.contract)),
  Object.fromEntries(Object.entries(assetContracts).map(([name, contract]) => [name, {
    path: contract.path,
    canvas: {w: contract.canvas[0], h: contract.canvas[1]},
    source: contract.source,
    drawWidth: contract.drawWidth
  }]))
);
assert.equal(api.seamOverlap, 1);
assert.equal(api.edgeOverhang, 1);
assert.equal(api.bodyHeight, 28);
assert.equal(api.bodyTopOffset, -1);

for (const width of [100, 126, 138, 154, 176]) {
  const platform = {
    x: 310,
    y: 417.25,
    w: width,
    h: 26,
    fragile: true,
    fallingPlatform: {x: 310, y: 280, currentY: 417.25}
  };
  const before = JSON.stringify(platform);
  const drawX = platform.x + 3.375;
  drawCalls.length = 0;
  canvasCalls.length = 0;
  assert.equal(api.draw(fakeCanvasContext, platform, drawX), true);
  assert.equal(JSON.stringify(platform), before, "visual drawing must not mutate collision data");

  const expectedMiddleCount = Math.ceil((width - 48) / 52);
  assert.equal(drawCalls.length, expectedMiddleCount + 4);
  assert.deepEqual(
    drawCalls[0].slice(1),
    [4, 26, 116, 77, drawX - 1, 416.25, 25, 28]
  );
  assert.deepEqual(
    drawCalls[1].slice(1),
    [0, 26, 116, 77, drawX + width - 23, 416.25, 24, 28]
  );
  assert.deepEqual(
    canvasCalls.filter(call => call[0] === "rect"),
    [
      ["rect", drawX - 1, 416.25, 1, 28],
      ["rect", drawX + width, 416.25, 1, 28]
    ],
    "only the two outer 1px cap strips may extend beyond platform.w"
  );

  const mainDrawCalls = drawCalls.slice(2);
  assert.deepEqual(mainDrawCalls[0].slice(1), [4, 26, 116, 77, drawX, 416.25, 25, 28]);
  assert.deepEqual(
    mainDrawCalls.at(-1).slice(1),
    [0, 26, 116, 77, drawX + width - 24, 416.25, 24, 28]
  );
  const destinations = mainDrawCalls.map(call => (
    {x: call[5], y: call[6], w: call[7], h: call[8]}
  ));
  assert.equal(destinations[0].x, drawX);
  assert.equal(destinations.at(-1).x + destinations.at(-1).w, drawX + width);
  assert.ok(destinations.every(destination => destination.y === 416.25));
  assert.ok(destinations.every(destination => destination.h === 28));
  assert.equal((drawX + width + 1) - (drawX - 1), width + 2);
  assert.equal(destinations[0].y, platform.y - 1);
  assert.equal(destinations[0].y + destinations[0].h, platform.y + platform.h + 1);
  for (let index = 1; index < destinations.length; index++) {
    const overlap = destinations[index - 1].x + destinations[index - 1].w - destinations[index].x;
    assert.equal(overlap, 1, `width ${width} must have a 1 px internal overlap at index ${index}`);
  }

  const middleCalls = mainDrawCalls.slice(1, -1);
  for (const [index, call] of middleCalls.entries()) {
    const isFinal = index === middleCalls.length - 1;
    const remaining = width - 48 - index * 52;
    const expectedDestinationWidth = Math.min(52, remaining);
    assert.equal(call[0].src, assetContracts.middle.path);
    assert.equal(call[1], 0);
    assert.equal(call[2], 26);
    assert.equal(call[3], 260 * expectedDestinationWidth / 52);
    assert.equal(call[4], 77);
    assert.equal(call[7], expectedDestinationWidth + 1);
    assert.equal(call[8], 28);
    if (!isFinal || remaining >= 52) {
      assert.equal(call[3], 260);
      assert.equal(call[7], 53);
    }
  }
}

assert.equal(api.draw(fakeCanvasContext, {x: 0, y: 0, w: 126, h: 26}, 0), false);

const otherPlatformTypes = [
  {x: 100, y: 200, w: 126, h: 26},
  {x: 240, y: 220, w: 126, h: 26, moving: true},
  {x: 380, y: 240, w: 126, h: 26, fade: true, fadeData: {opacity: 0.7}},
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
meadowBaseCalls = 0;
api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, false);
assert.equal(drawCalls.length, 0, "other platform types must never use Falling assets");
assert.equal(meadowBaseCalls, 0);
assert.equal(JSON.stringify(otherPlatformTypes), otherPlatformSnapshot);

drawCalls.length = 0;
meadowBaseCalls = 0;
api.drawPlatforms(
  {platform: {body: "#000", top: "#fff"}},
  rendererContext.MEADOW_ASSET_VISUALS
);
assert.equal(drawCalls.length, 0, "Meadow platform types must not use Falling assets");
assert.equal(meadowBaseCalls, otherPlatformTypes.length);
assert.equal(JSON.stringify(otherPlatformTypes), otherPlatformSnapshot);

const fallingFixture = {
  x: 310,
  y: 417.25,
  w: 126,
  h: 26,
  fragile: true,
  fallingPlatform: {
    x: 310,
    y: 280,
    currentY: 417.25,
    triggered: true,
    falling: false,
    timer: 0.5
  }
};
const fallingSnapshot = JSON.stringify(fallingFixture);
rendererContext.platforms = [fallingFixture];
drawCalls.length = 0;
canvasCalls.length = 0;
meadowBaseCalls = 0;
anchorWarningCalls = 0;
api.drawPlatforms(
  {platform: {body: "#000", top: "#fff"}},
  rendererContext.MEADOW_ASSET_VISUALS
);
const expectedWobbleX = fallingFixture.x + Math.sin(1.25 * 42) * (1.2 + 0.5 * 3.4);
assert.ok(Math.abs(drawCalls[0][5] - (expectedWobbleX - 1)) < 1e-12);
assert.ok(Math.abs(drawCalls[2][5] - expectedWobbleX) < 1e-12);
assert.ok(drawCalls.every(call => call[6] === fallingFixture.fallingPlatform.currentY - 1));
assert.equal(meadowBaseCalls, 0, "Meadow must not draw its floating base behind the Falling PNG");
assert.equal(anchorWarningCalls, 1, "Anchor-Step warning hook must remain active");
assert.equal(canvasCalls.filter(call => call[0] === "stroke").length, 0);
assert.equal(JSON.stringify(fallingFixture), fallingSnapshot);

drawCalls.length = 0;
canvasCalls.length = 0;
meadowBaseCalls = 0;
anchorWarningCalls = 0;
api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, false);
assert.ok(Math.abs(drawCalls[0][5] - (expectedWobbleX - 1)) < 1e-12);
assert.ok(Math.abs(drawCalls[2][5] - expectedWobbleX) < 1e-12);
assert.equal(meadowBaseCalls, 0);
assert.equal(anchorWarningCalls, 1);
assert.equal(canvasCalls.filter(call => call[0] === "stroke").length, 0);

api.images.right.naturalWidth = 0;
drawCalls.length = 0;
canvasCalls.length = 0;
meadowBaseCalls = 0;
anchorWarningCalls = 0;
api.drawPlatforms(
  {platform: {body: "#000", top: "#fff"}},
  rendererContext.MEADOW_ASSET_VISUALS
);
assert.equal(drawCalls.length, 0, "an incomplete set must never render partially");
assert.equal(meadowBaseCalls, 1, "Meadow fallback must remain available");
assert.equal(canvasCalls.filter(call => call[0] === "stroke").length, 1);
assert.equal(anchorWarningCalls, 1);

drawCalls.length = 0;
canvasCalls.length = 0;
meadowBaseCalls = 0;
api.drawPlatforms({platform: {body: "#000", top: "#fff"}}, false);
assert.equal(drawCalls.length, 0);
assert.ok(canvasCalls.some(call => call[0] === "fill"), "Canvas body fallback must remain");
assert.equal(canvasCalls.filter(call => call[0] === "stroke").length, 1);
api.images.right.naturalWidth = assetContracts.right.canvas[0];

const protectedFiles = [
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js"
];
for (const relativePath of protectedFiles) {
  const headSource = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(normalize(read(relativePath)), normalize(headSource));
}
assert.match(read("js/level-generator.js"), /delay: Math\.max\(0\.68, 1\.15 - intensityFactor \* 0\.47\) \* 1\.25/);
assert.match(read("js/platforms.js"), /platform\.vy = 35;[\s\S]*?platform\.vy \+= 1055\.7 \* dt;[\s\S]*?platform\.currentY > H \+ 180/);

console.log("Falling platform PNG bounds, tiling, crop, fallback, wobble and frozen-scope tests passed.");
