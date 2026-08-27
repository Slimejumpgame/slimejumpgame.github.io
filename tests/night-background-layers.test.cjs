"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-night-assets.js");
const rendererSource = read("js/renderer.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/night/background";
const backgroundFiles = Object.freeze([
  "night_background_skybox.png",
  "night_background_stars.png",
  "night_background_clouds_back.png",
  "night_background_moon.png",
  "night_background_landscape.png",
  "night_background_clouds_front.png"
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

function getMaximumEdgeAlpha(decoded, x) {
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
    `${relativePath} must use the native Night background size`
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
for (const relativePath of [backgroundPaths[2], backgroundPaths[5]]) {
  const decoded = decodedAssets[relativePath];
  assert.equal(
    getMaximumEdgeAlpha(decoded, 0),
    0,
    `${relativePath} left edge must remain transparent for small sine drift`
  );
  assert.equal(
    getMaximumEdgeAlpha(decoded, decoded.width - 1),
    0,
    `${relativePath} right edge must remain transparent for small sine drift`
  );
}

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    createRadialGradient(...args) {
      calls.push(["createRadialGradient", ...args]);
      return {
        addColorStop(offset, color) {
          calls.push(["radialColorStop", offset, color]);
        }
      };
    },
    beginPath() { calls.push(["beginPath"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    fill() { calls.push(["fill"]); }
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
    platformMarker: "generic-night-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "night");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "night");
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
    throw new Error("Night background rendering must not consume Math.random()");
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
    globalThis.nightBackgroundForTest = NIGHT_ASSET_VISUALS;
  `, context, {filename: "night-background-layers-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.nightBackgroundForTest,
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

function drawForFile(capture, file) {
  return imageDraws(capture).find(call => path.basename(call[1].src) === file);
}

function drawsForFile(capture, file) {
  return imageDraws(capture).filter(call => path.basename(call[1].src) === file);
}

const fixture = loadFixture();
const visuals = fixture.api;
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/background/")),
  backgroundPaths
);
assert.equal(fixture.getRegisteredVisuals(), visuals);
assert.equal(visuals.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(visuals.resolvePlatformRole, fixture.platformVisuals.resolvePlatformRole);
assert.equal(visuals.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(visuals.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);

const status = JSON.parse(JSON.stringify(visuals.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, {
  skybox: backgroundPaths[0],
  stars: backgroundPaths[1],
  cloudsBack: backgroundPaths[2],
  moon: backgroundPaths[3],
  landscape: backgroundPaths[4],
  cloudsFront: backgroundPaths[5]
});
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, ["skybox", "moon", "landscape"]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(Object.keys(status.alphaUsage).sort(), [
  "cloudsBack",
  "cloudsFront",
  "landscape",
  "moon",
  "stars"
]);
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.cloudAnimation, {
  back: {
    leftSpeed: 6,
    ySpeed: 0,
    wrapDistance: 1215,
    overlap: 65,
    drawCopies: 2
  },
  front: {
    leftSpeed: 12,
    ySpeed: 0,
    wrapDistance: 1235,
    overlap: 45,
    drawCopies: 2
  },
  direction: "right-to-left",
  wrapMode: "horizontal-continuous"
});
assert.ok(
  status.cloudAnimation.front.leftSpeed >
  status.cloudAnimation.back.leftSpeed
);
assert.deepEqual(status.starPulseAnimation, {
  count: 26,
  pulseMinimumFactor: 0.2,
  compositeOperation: "screen",
  drawOrder: "after-stars-before-clouds-back"
});
assert.equal(status.starPulses.length, 26);
assert.equal(new Set(status.starPulses.map(star => `${star.x},${star.y}`)).size, 26);
assert.equal(new Set(status.starPulses.map(star => star.period)).size, 26);
assert.equal(new Set(status.starPulses.map(star => star.phase)).size, 26);
assert.ok(status.starPulses.every(star => {
  const colorValue = Number.parseInt(star.color.slice(1), 16);
  const red = colorValue >> 16 & 0xff;
  const green = colorValue >> 8 & 0xff;
  const blue = colorValue & 0xff;
  return (
    star.x >= 0 && star.x <= 1280 &&
    star.y >= 0 && star.y <= 720 &&
    star.radius >= 10 && star.radius <= 26 &&
    star.strength >= 0.78 && star.strength <= 1.00 &&
    blue > green && green > red
  );
}), "star pulses must remain small, cool blue and inside the Night sky");

const atZero = captureBackground(fixture);
const later = captureBackground(fixture, 5.25);
assert.equal(atZero.drawn, true);
assert.deepEqual(
  imageDraws(atZero).map(call => path.basename(call[1].src)),
  [
    backgroundFiles[0],
    backgroundFiles[1],
    backgroundFiles[2],
    backgroundFiles[2],
    backgroundFiles[3],
    backgroundFiles[4],
    backgroundFiles[5],
    backgroundFiles[5]
  ]
);
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}
for (const staticFile of [
  "night_background_skybox.png",
  "night_background_stars.png",
  "night_background_moon.png",
  "night_background_landscape.png"
]) {
  assert.deepEqual(drawForFile(atZero, staticFile), drawForFile(later, staticFile));
  assert.deepEqual(drawForFile(atZero, staticFile).slice(6), [0, 0, 1280, 720]);
}
for (const cloudFile of [
  "night_background_clouds_back.png",
  "night_background_clouds_front.png"
]) {
  assert.equal(drawsForFile(atZero, cloudFile).length, 2);
  assert.notDeepEqual(
    drawForFile(atZero, cloudFile).slice(6),
    drawForFile(later, cloudFile).slice(6)
  );
  assert.ok(drawsForFile(atZero, cloudFile).every(draw => draw[7] === 0));
  assert.ok(drawsForFile(later, cloudFile).every(draw => draw[7] === 0));
}

const mapping = visuals.getBackgroundMapping(1280, 720);
const backCloudsAtOne = visuals.getCloudMapping(1, mapping, "back");
const backCloudsAtTwo = visuals.getCloudMapping(2, mapping, "back");
const frontCloudsAtOne = visuals.getCloudMapping(1, mapping, "front");
const frontCloudsAtTwo = visuals.getCloudMapping(2, mapping, "front");
assert.equal(backCloudsAtOne.offsetX, -6);
assert.equal(backCloudsAtTwo.offsetX, -12);
assert.equal(backCloudsAtOne.offsetY, 0);
assert.equal(backCloudsAtOne.wrapDistance, 1215);
assert.deepEqual(
  [...backCloudsAtOne.destinations].map(destination => destination.x),
  [-6, 1209]
);
assert.equal(frontCloudsAtOne.offsetX, -12);
assert.equal(frontCloudsAtTwo.offsetX, -24);
assert.equal(frontCloudsAtOne.offsetY, 0);
assert.equal(frontCloudsAtOne.wrapDistance, 1235);
assert.deepEqual(
  [...frontCloudsAtOne.destinations].map(destination => destination.x),
  [-12, 1223]
);

const pulsesAtZero = JSON.parse(JSON.stringify(visuals.getStarPulseMapping(0)));
const pulsesLater = JSON.parse(JSON.stringify(visuals.getStarPulseMapping(5.25)));
assert.deepEqual(
  JSON.parse(JSON.stringify(visuals.getStarPulseMapping(5.25))),
  pulsesLater,
  "star pulse mapping must be deterministic for the same visual time"
);
assert.notDeepEqual(pulsesLater, pulsesAtZero);
for (let index = 0; index < pulsesLater.length; index++) {
  const source = status.starPulses[index];
  const before = pulsesAtZero[index];
  const after = pulsesLater[index];
  assert.deepEqual(
    {x: after.x, y: after.y, radius: after.radius, color: after.color},
    {x: before.x, y: before.y, radius: before.radius, color: before.color}
  );
  assert.ok(after.alpha >= source.strength * 0.2 - 1e-12);
  assert.ok(after.alpha <= source.strength + 1e-12);
}
assert.equal(
  atZero.calls.filter(call => call[0] === "createRadialGradient").length,
  26
);
assert.equal(atZero.calls.filter(call => call[0] === "arc").length, 26);
assert.equal(
  atZero.calls.filter(call => call[0] === "radialColorStop").length,
  26 * 4
);
const firstPulseStops = atZero.calls.filter(
  call => call[0] === "radialColorStop"
).slice(0, 4);
assert.deepEqual(firstPulseStops.map(call => call[1]), [0, 0.22, 0.52, 1]);
const getStopAlpha = call => Number.parseFloat(
  call[2].match(/^rgba\(\d+,\d+,\d+,([^)]+)\)$/)[1]
);
assert.ok(Math.abs(getStopAlpha(firstPulseStops[0]) - pulsesAtZero[0].alpha) < 1e-12);
assert.ok(Math.abs(
  getStopAlpha(firstPulseStops[1]) - pulsesAtZero[0].alpha * 0.90
) < 1e-12);
assert.ok(Math.abs(
  getStopAlpha(firstPulseStops[2]) - pulsesAtZero[0].alpha * 0.60
) < 1e-12);
assert.equal(getStopAlpha(firstPulseStops[3]), 0);
const starsDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "night_background_stars.png"
));
const firstPulseIndex = atZero.calls.findIndex(call => (
  call[0] === "createRadialGradient"
));
const backCloudDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "night_background_clouds_back.png"
));
assert.ok(starsDrawIndex < firstPulseIndex && firstPulseIndex < backCloudDrawIndex);
assert.ok(atZero.calls.some(call => (
  call[0] === "set" &&
  call[1] === "globalCompositeOperation" &&
  call[2] === "screen"
)));
assert.equal(atZero.calls.some(call => call[1] === "globalAlpha"), false);
assert.equal(atZero.calls.some(call => call[1] === "filter"), false);
assert.equal(visuals.drawBackground(fixture.recording.context, 0, 720), false);
assert.equal(visuals.drawBackground(null, 1280, 720), false);

for (const essentialFile of [
  "night_background_skybox.png",
  "night_background_moon.png",
  "night_background_landscape.png"
]) {
  const failures = [
    {failedFile: essentialFile},
    {invalidFile: essentialFile}
  ];
  if (!essentialFile.endsWith("skybox.png")) {
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
  "night_background_stars.png",
  "night_background_clouds_back.png",
  "night_background_clouds_front.png"
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
    if (optionalFile.endsWith("stars.png")) {
      assert.equal(
        capture.calls.some(call => call[0] === "createRadialGradient"),
        false
      );
    }
  }
}

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
assert.match(
  indexSource,
  /js\/visual-crystal-cave-assets\.js[\s\S]*js\/visual-night-assets\.js[\s\S]*js\/renderer\.js/
);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.resolve\("night"\)/);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.register\("night", nightVisuals\)/);
assert.doesNotMatch(visualSource, /Math\.random\(/);

console.log("Night six-layer background, horizontal cloud drift, 26 fixed star pulses and fallback tests passed.");
