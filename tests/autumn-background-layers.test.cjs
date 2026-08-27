"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-autumn-assets.js");
const rendererSource = read("js/renderer.js");
const biomesSource = read("js/biomes.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/autumn/background";
const backgroundFiles = Object.freeze([
  "autumn_background_skybox.png",
  "autumn_background_clouds.png",
  "autumn_background_forest.png",
  "autumn_background_leaves.png"
]);
const backgroundPaths = backgroundFiles.map(file => (
  `${backgroundDirectory}/${file}`
));

function decodePng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8, `${relativePath} must use 8-bit channels`);
  assert.ok(
    colorType === 2 || colorType === 6,
    `${relativePath} must be an RGB or RGBA PNG`
  );
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);
  const channels = colorType === 6 ? 4 : 3;
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left, up, upperLeft) => {
    const value = left + up - upperLeft;
    const leftDistance = Math.abs(value - left);
    const upDistance = Math.abs(value - up);
    const upperLeftDistance = Math.abs(value - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0, packedOffset = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= channels
        ? pixels[(y - 1) * stride + x - channels]
        : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (packed[packedOffset++] + predictor) & 0xff;
    }
  }
  return Object.freeze({width, height, colorType, channels, pixels});
}

function getAlphaUsage(decoded) {
  if (decoded.channels === 3) {
    return Object.freeze({
      hasVisiblePixels: true,
      hasTransparentPixels: false
    });
  }
  let hasVisiblePixels = false;
  let hasTransparentPixels = false;
  for (let index = 3; index < decoded.pixels.length; index += 4) {
    const alpha = decoded.pixels[index];
    if (alpha > 0) hasVisiblePixels = true;
    if (alpha < 255) hasTransparentPixels = true;
    if (hasVisiblePixels && hasTransparentPixels) break;
  }
  return Object.freeze({hasVisiblePixels, hasTransparentPixels});
}

function getMaximumHorizontalEdgeAlpha(decoded, y) {
  assert.equal(decoded.channels, 4);
  let maximum = 0;
  for (let x = 0; x < decoded.width; x++) {
    maximum = Math.max(
      maximum,
      decoded.pixels[(y * decoded.width + x) * 4 + 3]
    );
  }
  return maximum;
}

function getMaximumVerticalEdgeAlpha(decoded, x) {
  assert.equal(decoded.channels, 4);
  let maximum = 0;
  for (let y = 0; y < decoded.height; y++) {
    maximum = Math.max(
      maximum,
      decoded.pixels[(y * decoded.width + x) * 4 + 3]
    );
  }
  return maximum;
}

const decodedAssets = Object.fromEntries(backgroundPaths.map(relativePath => (
  [relativePath, decodePng(relativePath)]
)));
for (const [relativePath, decoded] of Object.entries(decodedAssets)) {
  assert.deepEqual(
    {w: decoded.width, h: decoded.height},
    {w: 1280, h: 720},
    `${relativePath} must use the native Autumn background size`
  );
}
assert.equal(decodedAssets[backgroundPaths[0]].colorType, 2);
assert.deepEqual(getAlphaUsage(decodedAssets[backgroundPaths[0]]), {
  hasVisiblePixels: true,
  hasTransparentPixels: false
});
for (const relativePath of backgroundPaths.slice(1)) {
  assert.equal(decodedAssets[relativePath].colorType, 6);
  assert.deepEqual(getAlphaUsage(decodedAssets[relativePath]), {
    hasVisiblePixels: true,
    hasTransparentPixels: true
  });
}
const decodedClouds = decodedAssets[backgroundPaths[1]];
assert.equal(getMaximumVerticalEdgeAlpha(decodedClouds, 0), 0);
assert.equal(getMaximumVerticalEdgeAlpha(decodedClouds, decodedClouds.width - 1), 0);
const decodedLeaves = decodedAssets[backgroundPaths[3]];
assert.equal(getMaximumHorizontalEdgeAlpha(decodedLeaves, 0), 0);
assert.equal(
  getMaximumHorizontalEdgeAlpha(decodedLeaves, decodedLeaves.height - 1),
  0
);

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    clip() { calls.push(["clip"]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); }
  };
  const context = new Proxy(target, {
    set(object, property, value) {
      calls.push(["set", property, value]);
      object[property] = value;
      return true;
    }
  });
  return {context, calls};
}

function loadFixture({
  failedFile = null,
  invalidFile = null,
  opaqueLayer = null,
  transparentLayer = null
} = {}) {
  const recording = createRecordingContext();
  const loadedPaths = [];
  let registeredVisuals = null;
  let analyzedImage = null;

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
      loadedPaths.push(value);
      const file = path.posix.basename(value);
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      this.naturalWidth = file === invalidFile ? 1279 : 1280;
      this.naturalHeight = 720;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "generic-autumn-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "autumn");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "autumn");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const document = {
    createElement(type) {
      assert.equal(type, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(typeName, options) {
          assert.equal(typeName, "2d");
          assert.equal(options?.willReadFrequently, true);
          return {
            clearRect() {},
            drawImage(image) { analyzedImage = image; },
            getImageData() {
              const file = path.posix.basename(analyzedImage.src);
              return {
                data: file === opaqueLayer
                  ? new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])
                  : file === transparentLayer
                    ? new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0])
                    : new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255])
              };
            }
          };
        }
      };
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Autumn background rendering must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    Uint8ClampedArray,
    document
  });
  vm.runInContext(`${visualSource}
    globalThis.autumnBackgroundForTest = AUTUMN_ASSET_VISUALS;
  `, context, {filename: "autumn-background-layers-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.autumnBackgroundForTest,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function captureBackground(fixture, visualTime = 0, width = 1280, height = 720) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBackground(
    fixture.recording.context,
    width,
    height,
    visualTime
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

function imageDraws(capture) {
  return capture.calls.filter(call => call[0] === "drawImage");
}

function drawsForFile(capture, file) {
  return imageDraws(capture).filter(call => path.basename(call[1].src) === file);
}

const fixture = loadFixture();
const visuals = fixture.api;
assert.deepEqual(fixture.loadedPaths, backgroundPaths);
assert.equal(fixture.getRegisteredVisuals(), visuals);
assert.equal(visuals.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(visuals.resolvePlatformRole, fixture.platformVisuals.resolvePlatformRole);
assert.equal(visuals.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(visuals.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);

const status = JSON.parse(JSON.stringify(visuals.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, {
  skybox: backgroundPaths[0],
  clouds: backgroundPaths[1],
  forest: backgroundPaths[2],
  leaves: backgroundPaths[3]
});
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, ["skybox", "forest"]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(Object.keys(status.alphaUsage).sort(), [
  "clouds",
  "forest",
  "leaves"
]);
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.cloudAnimation, {
  xAmplitude: 20,
  xPeriodSeconds: 34,
  xPhase: 0,
  yAmplitude: 0,
  drawCopies: 1,
  wrapMode: "single-sine-no-wrap"
});
assert.deepEqual(status.leavesAnimation, {
  fallSpeed: 14,
  xSpeed: 0,
  topInset: 40,
  wrapAxis: "y",
  wrapHeight: 720,
  drawCopies: 2
});

const atZero = captureBackground(fixture, 0);
const later = captureBackground(fixture, 5.25);
assert.equal(atZero.drawn, true);
assert.deepEqual(
  imageDraws(atZero).map(call => path.basename(call[1].src)),
  [
    "autumn_background_skybox.png",
    "autumn_background_clouds.png",
    "autumn_background_forest.png",
    "autumn_background_leaves.png",
    "autumn_background_leaves.png"
  ]
);
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}
for (const staticFile of [
  "autumn_background_skybox.png",
  "autumn_background_forest.png"
]) {
  assert.deepEqual(drawsForFile(atZero, staticFile), drawsForFile(later, staticFile));
  assert.deepEqual(drawsForFile(atZero, staticFile)[0].slice(6), [0, 0, 1280, 720]);
}
assert.notDeepEqual(
  drawsForFile(atZero, "autumn_background_clouds.png"),
  drawsForFile(later, "autumn_background_clouds.png")
);
assert.notDeepEqual(
  drawsForFile(atZero, "autumn_background_leaves.png"),
  drawsForFile(later, "autumn_background_leaves.png")
);
assert.deepEqual(
  drawsForFile(atZero, "autumn_background_leaves.png").map(call => call.slice(6)),
  [[0, -680, 1280, 720], [0, 40, 1280, 720]]
);
assert.ok(atZero.calls.some(call => (
  call[0] === "rect" &&
  JSON.stringify(call.slice(1)) === JSON.stringify([0, 40, 1280, 680])
)));
const forestDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "autumn_background_forest.png"
));
const leavesClipIndex = atZero.calls.findIndex(call => call[0] === "clip");
const firstLeavesDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "autumn_background_leaves.png"
));
assert.ok(forestDrawIndex < leavesClipIndex && leavesClipIndex < firstLeavesDrawIndex);
assert.equal(atZero.calls.some(call => call[1] === "globalAlpha"), false);
assert.equal(atZero.calls.some(call => call[1] === "filter"), false);

const mapping = visuals.getBackgroundMapping(1280, 720);
const cloudsAtOne = visuals.getCloudMapping(1, mapping);
assert.ok(Math.abs(cloudsAtOne.offsetX) <= 20);
assert.equal(cloudsAtOne.offsetY, 0);
assert.equal(cloudsAtOne.destination.y, 0);
const cloudPeak = visuals.getCloudMapping(8.5, mapping);
assert.ok(Math.abs(cloudPeak.offsetX - 20) < 1e-12);

const leavesAtOne = visuals.getLeavesMapping(1, mapping);
const leavesAtTwo = visuals.getLeavesMapping(2, mapping);
assert.equal(leavesAtOne.offsetX, 0);
assert.equal(leavesAtOne.offsetY, 14);
assert.equal(leavesAtTwo.offsetY, 28);
assert.deepEqual(
  JSON.parse(JSON.stringify(leavesAtOne.destinations)),
  [
    {x: 0, y: -666, w: 1280, h: 720},
    {x: 0, y: 54, w: 1280, h: 720}
  ]
);
for (const visualTime of [0, 1, 51]) {
  const leaves = visuals.getLeavesMapping(visualTime, mapping);
  const [first, second] = leaves.destinations;
  assert.equal(second.y, first.y + 720);
  assert.equal(first.x, 0);
  assert.equal(second.x, 0);
  assert.ok(first.y <= 40);
  assert.ok(first.y + first.h >= 40);
  assert.ok(second.y + second.h >= 720);
  assert.deepEqual(JSON.parse(JSON.stringify(leaves.clip)), {
    x: 0,
    y: 40,
    w: 1280,
    h: 680
  });
}
const scaledMapping = visuals.getBackgroundMapping(640, 360);
assert.deepEqual(
  JSON.parse(JSON.stringify(visuals.getLeavesMapping(0, scaledMapping).clip)),
  {x: 0, y: 20, w: 640, h: 340}
);

for (const essentialFile of [
  "autumn_background_skybox.png",
  "autumn_background_forest.png"
]) {
  const failures = [
    {failedFile: essentialFile},
    {invalidFile: essentialFile}
  ];
  if (essentialFile.endsWith("forest.png")) {
    failures.push({opaqueLayer: essentialFile}, {transparentLayer: essentialFile});
  }
  for (const failure of failures) {
    const fallback = loadFixture(failure);
    const capture = captureBackground(fallback);
    assert.equal(capture.drawn, false);
    assert.equal(imageDraws(capture).length, 0, "essential fallback must be atomic");
  }
}

for (const optionalFile of [
  "autumn_background_clouds.png",
  "autumn_background_leaves.png"
]) {
  for (const failure of [
    {failedFile: optionalFile},
    {invalidFile: optionalFile},
    {opaqueLayer: optionalFile},
    {transparentLayer: optionalFile}
  ]) {
    const optional = loadFixture(failure);
    const capture = captureBackground(optional);
    assert.equal(capture.drawn, true);
    assert.equal(optional.api.isBackgroundReady(), true);
    assert.equal(imageDraws(capture).some(call => (
      path.basename(call[1].src) === optionalFile
    )), false);
  }
}
assert.equal(visuals.drawBackground(fixture.recording.context, 0, 720), false);
assert.equal(visuals.drawBackground(null, 1280, 720), false);

assert.match(
  rendererSource,
  /typeof biomePlatformVisuals\.drawBackground === "function"[\s\S]*biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)/
);
assert.match(
  rendererSource,
  /if \(!assetBackgroundDrawn\) \{\s*drawBackground\(biome\);\s*\}/
);
const rendererDrawSource = rendererSource.slice(rendererSource.indexOf("  function draw()"));
assert.ok(
  rendererDrawSource.indexOf("biomePlatformVisuals.drawBackground") <
  rendererDrawSource.indexOf("drawPlatforms(")
);
assert.match(biomesSource, /function drawAutumnBackground\(biome\)/);
assert.match(biomesSource, /autumn:\s*drawAutumnBackground/);
assert.match(
  indexSource,
  /js\/visual-night-assets\.js[\s\S]*js\/visual-autumn-assets\.js[\s\S]*js\/renderer\.js/
);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.resolve\("autumn"\)/);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.register\("autumn", autumnVisuals\)/);
assert.doesNotMatch(visualSource, /Math\.random\(|hazard|night|sky\/background/i);

console.log("Autumn four-layer background, sine clouds, clipped two-copy falling leaves and fallback tests passed.");
