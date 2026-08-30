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
const visualSource = read("js/visual-snow-assets.js");
const rendererSource = read("js/renderer.js");
const backgroundDirectory = "assets/environments/snow/background";
const backgroundFiles = Object.freeze([
  "snow_background_sky_base.png",
  "snow_background_clouds_back.png",
  "snow_background_mountains.png",
  "snow_background_clouds_front.png",
  "snow_background_snowflakes.png"
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
  let hasVisiblePixels = colorType === 2;
  let hasTransparentPixels = false;
  if (colorType === 6) {
    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha > 0) hasVisiblePixels = true;
      if (alpha < 255) hasTransparentPixels = true;
      if (hasVisiblePixels && hasTransparentPixels) break;
    }
  }
  return Object.freeze({
    width,
    height,
    bitDepth,
    colorType,
    hasVisiblePixels,
    hasTransparentPixels
  });
}

const decodedAssets = Object.fromEntries(backgroundPaths.map(relativePath => (
  [relativePath, decodePng(relativePath)]
)));
for (const decoded of Object.values(decodedAssets)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 1280, h: 720});
}
assert.equal(decodedAssets[backgroundPaths[0]].colorType, 2);
assert.equal(decodedAssets[backgroundPaths[0]].hasTransparentPixels, false);
for (const relativePath of backgroundPaths.slice(1)) {
  assert.equal(decodedAssets[relativePath].colorType, 6);
  assert.equal(decodedAssets[relativePath].hasVisiblePixels, true);
  assert.equal(decodedAssets[relativePath].hasTransparentPixels, true);
}

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
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
      const isBackground = value.includes("/background/");
      this.complete = true;
      this.naturalWidth = file === invalidFile
        ? (isBackground ? 1279 : 1649)
        : (isBackground ? 1280 : 1650);
      this.naturalHeight = isBackground ? 720 : 60;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "generic-snow-platform-kit",
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "snow");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "snow");
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
    throw new Error("Snow background rendering must not consume Math.random()");
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
    globalThis.snowBackgroundForTest = SNOW_ASSET_VISUALS;
  `, context, {filename: "snow-background-layers-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.snowBackgroundForTest,
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
assert.equal(visuals.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(visuals.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);

const status = JSON.parse(JSON.stringify(visuals.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, ["skyBase", "mountains"]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(Object.keys(status.alphaUsage).sort(), [
  "cloudsBack",
  "cloudsFront",
  "mountains",
  "snowflakes"
]);
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.backCloudAnimation, {
  leftSpeed: 6,
  ySpeed: 0,
  wrapDistance: 1265,
  overlap: 15,
  drawCopies: 2,
  direction: "right-to-left"
});
assert.deepEqual(status.frontCloudAnimation, {
  leftSpeed: 12,
  ySpeed: 0,
  wrapDistance: 1003,
  overlap: 277,
  drawCopies: 3,
  direction: "right-to-left"
});
assert.ok(
  status.frontCloudAnimation.leftSpeed >
  status.backCloudAnimation.leftSpeed
);
assert.deepEqual(status.snowflakeAnimation, {
  fallSpeed: 8,
  xSwayAmplitude: 3,
  xSwayPeriodSeconds: 13,
  xSwayPhase: 0.7,
  wrapCopies: 4
});

const atZero = captureBackground(fixture);
const later = captureBackground(fixture, 4.25);
assert.equal(atZero.drawn, true);
assert.deepEqual(
  imageDraws(atZero).map(call => path.basename(call[1].src)),
  [
    "snow_background_sky_base.png",
    "snow_background_clouds_back.png",
    "snow_background_clouds_back.png",
    "snow_background_mountains.png",
    "snow_background_clouds_front.png",
    "snow_background_clouds_front.png",
    "snow_background_clouds_front.png",
    "snow_background_snowflakes.png",
    "snow_background_snowflakes.png",
    "snow_background_snowflakes.png",
    "snow_background_snowflakes.png"
  ]
);
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}
for (const staticFile of [
  "snow_background_sky_base.png",
  "snow_background_mountains.png"
]) {
  assert.deepEqual(drawForFile(atZero, staticFile), drawForFile(later, staticFile));
  assert.deepEqual(drawForFile(atZero, staticFile).slice(6), [0, 0, 1280, 720]);
}
for (const cloudFile of [
  "snow_background_clouds_back.png",
  "snow_background_clouds_front.png"
]) {
  assert.ok(drawsForFile(atZero, cloudFile).length >= 2);
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
assert.equal(backCloudsAtOne.wrapDistance, 1265);
assert.deepEqual(
  [...backCloudsAtOne.destinations].map(destination => destination.x),
  [-6, 1259]
);
assert.equal(frontCloudsAtOne.offsetX, -12);
assert.equal(frontCloudsAtTwo.offsetX, -24);
assert.equal(frontCloudsAtOne.offsetY, 0);
assert.equal(frontCloudsAtOne.wrapDistance, 1003);
assert.deepEqual(
  [...frontCloudsAtOne.destinations].map(destination => destination.x),
  [-1015, -12, 991]
);

const snowAtOne = visuals.getSnowflakeMapping(1, mapping);
const snowAtTwo = visuals.getSnowflakeMapping(2, mapping);
assert.equal(snowAtOne.offsetY, -712);
assert.equal(snowAtTwo.offsetY, -704);
assert.ok(snowAtTwo.offsetY > snowAtOne.offsetY, "snowflakes must move downward");
assert.ok(Math.abs(snowAtOne.offsetX) <= 3);
assert.notEqual(snowAtOne.offsetX, snowAtTwo.offsetX);
for (const snowflakes of [snowAtOne, snowAtTwo]) {
  assert.equal(snowflakes.destinations.length, 4);
  assert.equal(
    snowflakes.destinations[1].x,
    snowflakes.destinations[0].x + 1280
  );
  assert.equal(
    snowflakes.destinations[2].y,
    snowflakes.destinations[0].y + 720
  );
  assert.equal(
    snowflakes.destinations[3].x,
    snowflakes.destinations[2].x + 1280
  );
  assert.ok(snowflakes.destinations[0].x <= 0);
  assert.ok(snowflakes.destinations[1].x + 1280 >= 1280);
  assert.ok(snowflakes.destinations[0].y <= 0);
  assert.ok(snowflakes.destinations[2].y + 720 >= 720);
}
const swayPeakTime = (Math.PI / 2 - 0.7) * 13 / (Math.PI * 2);
assert.ok(Math.abs(
  visuals.getSnowflakeMapping(swayPeakTime, mapping).offsetX - 3
) < 1e-12);

for (const essentialFile of [
  "snow_background_sky_base.png",
  "snow_background_mountains.png"
]) {
  const failures = [
    {failedFile: essentialFile},
    {invalidFile: essentialFile}
  ];
  if (essentialFile.endsWith("mountains.png")) {
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
  "snow_background_clouds_back.png",
  "snow_background_clouds_front.png",
  "snow_background_snowflakes.png"
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
  read("index.html"),
  /js\/visual-volcano-assets\.js[\s\S]*js\/visual-snow-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(visualSource, /coast|desert|volcano|Math\.random\(/i);

for (const relativePath of [
  "js/biomes.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/visual-desert-assets.js",
  "js/visual-volcano-assets.js"
]) {
  const current = read(relativePath);
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the Snow background integration`
  );
}

console.log("Snow layered background motion, 2x2 snowfall wrapping and fallback tests passed.");
