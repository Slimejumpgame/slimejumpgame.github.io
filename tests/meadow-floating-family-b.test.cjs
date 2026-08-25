"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const floatingAssets = Object.freeze({
  "assets/environments/meadow/platforms/floating_left.png": [128, 128],
  "assets/environments/meadow/platforms/floating_middle.png": [256, 128],
  "assets/environments/meadow/platforms/floating_right.png": [128, 128]
});

function decodeRgbaPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0, inputOffset = 0; y < height; y++) {
    const filter = packed[inputOffset++];
    for (let x = 0; x < stride; x++) {
      const raw = packed[inputOffset++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
  }
  return {width, height, pixels};
}

function alphaBounds(decoded, threshold) {
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1};
}

const decodedFloatingAssets = Object.fromEntries(
  Object.keys(floatingAssets).map(relativePath => [relativePath, decodeRgbaPng(relativePath)])
);

for (const [relativePath, expectedSize] of Object.entries(floatingAssets)) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], expectedSize);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must use RGBA`);
}

assert.deepEqual(alphaBounds(decodedFloatingAssets[
  "assets/environments/meadow/platforms/floating_left.png"
], 0), {x: 0, y: 9, w: 128, h: 110});
assert.deepEqual(alphaBounds(decodedFloatingAssets[
  "assets/environments/meadow/platforms/floating_middle.png"
], 0), {x: 0, y: 9, w: 256, h: 91});
assert.deepEqual(alphaBounds(decodedFloatingAssets[
  "assets/environments/meadow/platforms/floating_right.png"
], 0), {x: 0, y: 25, w: 128, h: 78});
assert.deepEqual(alphaBounds(decodedFloatingAssets[
  "assets/environments/meadow/platforms/floating_left.png"
], 8), {x: 1, y: 27, w: 127, h: 76});
assert.deepEqual(alphaBounds(decodedFloatingAssets[
  "assets/environments/meadow/platforms/floating_middle.png"
], 8), {x: 0, y: 24, w: 256, h: 74});
assert.deepEqual(alphaBounds(decodedFloatingAssets[
  "assets/environments/meadow/platforms/floating_right.png"
], 8), {x: 0, y: 27, w: 127, h: 74});

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
    const size = floatingAssets[value] || [1, 1];
    this.complete = true;
    this.naturalWidth = size[0];
    this.naturalHeight = size[1];
    this.pixelData = decodedFloatingAssets[value]?.pixels;
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

const fakeDocument = {
  createElement(type) {
    assert.equal(type, "canvas");
    let drawnImage = null;
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          clearRect() {},
          drawImage(image) {
            drawnImage = image;
          },
          getImageData() {
            return {data: drawnImage.pixelData};
          }
        };
      }
    };
  }
};

const context = vm.createContext({Image: FakeImage, Math, Promise, document: fakeDocument});
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-decor-kit.js")}
${read("js/visual-portal-kit.js")}
${read("js/visual-meadow-assets.js")}
  globalThis.meadowFloatingTestApi = MEADOW_ASSET_VISUALS;
`, context, {filename: "meadow-floating-family-b-fixture.js"});
const api = context.meadowFloatingTestApi;
const manifest = JSON.parse(JSON.stringify(api.getManifest()));

assert.deepEqual(manifest.platforms.contract.floating, {
  height: 26,
  leftWidth: 26,
  middleTileWidth: 52,
  middleTileAdvance: 51,
  rightWidth: 26,
  middleMode: "repeat-source-crop",
  contentFit: {
    alphaThreshold: 8,
    bodyRowMinimumCoverage: 0.5,
    topOverhang: 2,
    bottomOverhang: 3,
    mode: "shared-robust-alpha-body-band"
  }
});
assert.deepEqual(
  [
    manifest.platforms.slots.floating_left,
    manifest.platforms.slots.floating_middle,
    manifest.platforms.slots.floating_right
  ],
  [
    {asset: "floating_left", w: 128, h: 128, source: {x: 0, y: 0, w: 128, h: 128}},
    {asset: "floating_middle", w: 256, h: 128, source: {x: 0, y: 0, w: 256, h: 128}},
    {asset: "floating_right", w: 128, h: 128, source: {x: 0, y: 0, w: 128, h: 128}}
  ]
);
assert.deepEqual(JSON.parse(JSON.stringify(api.getStatus().floatingContentFit)), {
  analyzed: true,
  alphaThreshold: 8,
  bodyRowMinimumCoverage: 0.5,
  topOverhang: 2,
  bottomOverhang: 3,
  topDecorSource: {y: 24, h: 10},
  bodySource: {y: 34, h: 51},
  bottomDecorSource: {y: 85, h: 18}
});

const drawCalls = [];
const canvasContext = {
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  arcTo() {},
  closePath() {},
  clip() {},
  stroke() {},
  drawImage(...args) {
    drawCalls.push(args);
  }
};

function assertFloating(width, expectedMiddleWidths) {
  const platform = {x: 420.25, y: 310.5, w: width, h: 26};
  const snapshot = JSON.stringify(platform);
  drawCalls.length = 0;
  assert.equal(api.drawPlatformBase(canvasContext, platform), true);
  assert.equal(JSON.stringify(platform), snapshot, "drawing must not mutate gameplay geometry");

  assert.equal(drawCalls.length % 3, 0);
  const segments = Array.from({length: drawCalls.length / 3}, (_, index) => (
    drawCalls.slice(index * 3, index * 3 + 3)
  ));
  const middleSegments = segments.slice(0, -2);
  const leftSegment = segments.at(-2);
  const rightSegment = segments.at(-1);
  assert.deepEqual(middleSegments.map(calls => calls[0][7]), expectedMiddleWidths);
  assert.ok(middleSegments.every(calls => (
    calls.every(call => call[0].src === "assets/environments/meadow/platforms/floating_middle.png")
  )));
  assert.ok(leftSegment.every(call => (
    call[0].src === "assets/environments/meadow/platforms/floating_left.png"
  )));
  assert.ok(rightSegment.every(call => (
    call[0].src === "assets/environments/meadow/platforms/floating_right.png"
  )));

  for (const calls of segments) {
    assert.deepEqual(calls.map(call => call.slice(2, 5)), [
      [24, calls[0][3], 10],
      [34, calls[1][3], 51],
      [85, calls[2][3], 18]
    ]);
    assert.deepEqual(calls.map(call => call.slice(6, 9)), [
      [platform.y - 2, calls[0][7], 2],
      [platform.y, calls[1][7], 26],
      [platform.y + 26, calls[2][7], 3]
    ]);
    assert.ok(calls.every(call => call[5] === calls[0][5] && call[7] === calls[0][7]));
  }

  assert.equal(leftSegment[0][5], platform.x);
  assert.equal(leftSegment[0][7], 26);
  assert.equal(rightSegment[0][5] + rightSegment[0][7], platform.x + width);
  assert.equal(leftSegment[0][7], rightSegment[0][7], "LEFT and RIGHT must be symmetric");

  const middleStartX = platform.x + 25;
  const middleEndX = platform.x + width - 25;
  assert.equal(middleSegments[0][0][5], middleStartX);
  assert.equal(middleSegments.at(-1)[0][5] + middleSegments.at(-1)[0][7], middleEndX);
  for (const [index, calls] of middleSegments.entries()) {
    const call = calls[0];
    const destinationWidth = call[7];
    assert.ok(calls.every(item => item[1] === 0));
    assert.ok(calls.every(item => item[3] === 256 * destinationWidth / 52));
    if (index < middleSegments.length - 1) {
      assert.equal(destinationWidth, 52);
      assert.equal(middleSegments[index + 1][0][5] - call[5], 51);
      assert.equal(call[5] + call[7] - middleSegments[index + 1][0][5], 1);
    }
  }
  assert.equal(leftSegment[0][5] + leftSegment[0][7] - middleSegments[0][0][5], 1);
  assert.equal(
    middleSegments.at(-1)[0][5] + middleSegments.at(-1)[0][7] - rightSegment[0][5],
    1
  );
}

assertFloating(100, [50]);
assertFloating(138, [52, 37]);
assertFloating(176, [52, 52, 24]);
assert.equal(26 / 128, 52 / 256, "all Family-B slots must share one scale");

for (const width of [40, 52]) {
  const platform = {x: 420.25, y: 310.5, w: width, h: 26};
  drawCalls.length = 0;
  assert.equal(api.drawPlatformBase(canvasContext, platform), true);
  assert.equal(drawCalls.length, 6, "narrow platforms must use two three-zone caps");
  const capSegments = [drawCalls.slice(0, 3), drawCalls.slice(3, 6)];
  assert.deepEqual(capSegments.map(calls => calls[0][7]), [width / 2, width / 2]);
  assert.equal(drawCalls[0][5], platform.x);
  assert.equal(drawCalls[3][5] + drawCalls[3][7], platform.x + platform.w);
}

drawCalls.length = 0;
assert.equal(api.drawPlatformBase(canvasContext, {x: 100, y: 200, w: 138, h: 27}), false);
assert.equal(drawCalls.length, 0, "Family-B rendering must keep the 26px gameplay-height gate");

function syntheticPixels(width, height, robustTop, robustBottom, bodyTop, bodyBottom) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = robustTop; y <= robustBottom; y++) {
    pixels[(y * width) * 4 + 3] = 255;
  }
  for (let y = bodyTop; y <= bodyBottom; y++) {
    for (let x = 0; x < width; x++) pixels[(y * width + x) * 4 + 3] = 255;
  }
  return pixels;
}

const syntheticProfiles = {
  "assets/environments/meadow/platforms/floating_left.png": syntheticPixels(
    128, 128, 5, 90, 20, 70
  ),
  "assets/environments/meadow/platforms/floating_middle.png": syntheticPixels(
    256, 128, 7, 100, 18, 75
  ),
  "assets/environments/meadow/platforms/floating_right.png": syntheticPixels(
    128, 128, 6, 95, 22, 72
  )
};
class SyntheticImage extends FakeImage {
  set src(value) {
    this._src = value;
    const size = floatingAssets[value] || [1, 1];
    this.complete = true;
    this.naturalWidth = size[0];
    this.naturalHeight = size[1];
    this.pixelData = syntheticProfiles[value];
    this.onload?.();
  }
}
const syntheticContext = vm.createContext({
  Image: SyntheticImage,
  Math,
  Promise,
  document: fakeDocument
});
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-decor-kit.js")}
${read("js/visual-portal-kit.js")}
${read("js/visual-meadow-assets.js")}
  globalThis.syntheticFamilyBApi = MEADOW_ASSET_VISUALS;
`, syntheticContext, {filename: "synthetic-family-b-fixture.js"});
assert.deepEqual(
  JSON.parse(JSON.stringify(syntheticContext.syntheticFamilyBApi.getStatus().floatingContentFit)),
  {
    analyzed: true,
    alphaThreshold: 8,
    bodyRowMinimumCoverage: 0.5,
    topOverhang: 2,
    bottomOverhang: 3,
    topDecorSource: {y: 5, h: 17},
    bodySource: {y: 22, h: 49},
    bottomDecorSource: {y: 71, h: 30}
  },
  "content-fit bounds must derive from pixels rather than Meadow-specific source rows"
);

const coastAssets = Object.freeze({
  "assets/environments/coast/platforms/coast_floating_left.png": [112, 127],
  "assets/environments/coast/platforms/coast_floating_middle.png": [300, 127],
  "assets/environments/coast/platforms/coast_floating_right.png": [108, 127]
});
for (const [relativePath, expectedSize] of Object.entries(coastAssets)) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], expectedSize);
}

class FakeCoastImage {
  set src(value) {
    this._src = value;
    const size = coastAssets[value] || [0, 0];
    this.complete = size[0] > 0;
    this.naturalWidth = size[0];
    this.naturalHeight = size[1];
  }

  get src() {
    return this._src;
  }
}

const coastContext = vm.createContext({Image: FakeCoastImage});
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-coast-assets.js")}
  globalThis.coastSmokeTestApi = COAST_ASSET_VISUALS;
`, coastContext, {filename: "coast-floating-smoke-fixture.js"});
const coastApi = coastContext.coastSmokeTestApi;
const coastDrawCalls = [];
const coastCanvasContext = {
  ...canvasContext,
  drawImage(...args) {
    coastDrawCalls.push(args);
  }
};
const coastPlatform = {x: 420.25, y: 310.5, w: 138, h: 26};
const coastStatus = JSON.parse(JSON.stringify(coastApi.getStatus()));
assert.equal(coastApi.areAllReady(), false);
assert.equal(coastStatus.familyBReady, false);
assert.deepEqual(coastStatus.expectedNativeSizes.coast_floating_left, {w: 128, h: 128});
assert.deepEqual(coastStatus.expectedNativeSizes.coast_floating_middle, {w: 256, h: 128});
assert.deepEqual(coastStatus.expectedNativeSizes.coast_floating_right, {w: 128, h: 128});
assert.equal(coastApi.drawPlatformBase(coastCanvasContext, coastPlatform), false);
assert.equal(
  coastDrawCalls.length,
  0,
  "invalid old Coast files must leave rendering to the vector fallback"
);

console.log("meadow floating Family-B contract: ok");
