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
const visualSource = read("js/visual-swamp-assets.js");
const rendererSource = read("js/renderer.js");
const biomesSource = read("js/biomes.js");
const backgroundDirectory = "assets/environments/swamp/background";
const backgroundFiles = Object.freeze([
  "swamp_background_skybox.png",
  "swamp_background_trees_back.png",
  "swamp_background_fog_back.png",
  "swamp_background_trees_middle.png",
  "swamp_background_fog_front.png",
  "swamp_background_trees_front.png"
]);
const backgroundPaths = backgroundFiles.map(file => (
  `${backgroundDirectory}/${file}`
));

function decodeRgba8Png(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must retain an RGBA channel`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
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
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (packed[packedOffset++] + predictor) & 0xff;
    }
  }
  return Object.freeze({width, height, pixels});
}

function getAlphaUsage(decoded) {
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
  let maximum = 0;
  for (let y = 0; y < decoded.height; y++) {
    maximum = Math.max(
      maximum,
      decoded.pixels[(y * decoded.width + x) * 4 + 3]
    );
  }
  return maximum;
}

function getTransparentHorizontalMargins(decoded) {
  let firstVisibleX = decoded.width;
  let lastVisibleX = -1;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] > 0) {
        firstVisibleX = Math.min(firstVisibleX, x);
        lastVisibleX = Math.max(lastVisibleX, x);
      }
    }
  }
  return Object.freeze({
    left: firstVisibleX,
    right: decoded.width - 1 - lastVisibleX
  });
}

const decodedAssets = Object.fromEntries(backgroundPaths.map(relativePath => (
  [relativePath, decodeRgba8Png(relativePath)]
)));
for (const [relativePath, decoded] of Object.entries(decodedAssets)) {
  assert.deepEqual(
    {w: decoded.width, h: decoded.height},
    {w: 1280, h: 720},
    `${relativePath} must use the native Swamp background size`
  );
}
assert.deepEqual(getAlphaUsage(decodedAssets[backgroundPaths[0]]), {
  hasVisiblePixels: true,
  hasTransparentPixels: false
});
for (const relativePath of backgroundPaths.slice(1)) {
  assert.deepEqual(getAlphaUsage(decodedAssets[relativePath]), {
    hasVisiblePixels: true,
    hasTransparentPixels: true
  });
}
const fogBack = decodedAssets[backgroundPaths[2]];
assert.equal(getMaximumEdgeAlpha(fogBack, 0), 0);
assert.equal(getMaximumEdgeAlpha(fogBack, fogBack.width - 1), 0);
assert.deepEqual(getTransparentHorizontalMargins(fogBack), {
  left: 31,
  right: 61
});
const fogFront = decodedAssets[backgroundPaths[4]];
assert.equal(getMaximumEdgeAlpha(fogFront, 0), 0);
assert.equal(getMaximumEdgeAlpha(fogFront, fogFront.width - 1), 0);
assert.deepEqual(getTransparentHorizontalMargins(fogFront), {
  left: 18,
  right: 43
});

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
      this.complete = true;
      const isHazard = value.includes("/hazards/");
      this.naturalWidth = file === invalidFile
        ? (isHazard ? 1649 : 1279)
        : (isHazard ? 1650 : 1280);
      this.naturalHeight = isHazard ? 60 : 720;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "generic-swamp-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "swamp");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "swamp");
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
    throw new Error("Swamp background rendering must not consume Math.random()");
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
    globalThis.swampBackgroundForTest = SWAMP_ASSET_VISUALS;
  `, context, {filename: "swamp-background-layers-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.swampBackgroundForTest,
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
  treesBack: backgroundPaths[1],
  fogBack: backgroundPaths[2],
  treesMiddle: backgroundPaths[3],
  fogFront: backgroundPaths[4],
  treesFront: backgroundPaths[5]
});
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, [
  "skybox",
  "treesBack",
  "treesMiddle",
  "treesFront"
]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(Object.keys(status.alphaUsage).sort(), [
  "fogBack",
  "fogFront",
  "treesBack",
  "treesFront",
  "treesMiddle"
]);
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.fogAnimation, {
  back: {
    leftSpeed: 6,
    ySpeed: 0,
    wrapDistance: 1219,
    overlap: 61,
    drawCopies: 2
  },
  front: {
    leftSpeed: 10,
    ySpeed: 0,
    wrapDistance: 1237,
    overlap: 43,
    drawCopies: 2
  },
  direction: "right-to-left",
  wrapMode: "horizontal-continuous",
  blendMode: "source-over"
});
assert.ok(
  status.fogAnimation.front.leftSpeed >
  status.fogAnimation.back.leftSpeed
);

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
    backgroundFiles[4],
    backgroundFiles[5]
  ]
);
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}
for (const staticFile of [
  "swamp_background_skybox.png",
  "swamp_background_trees_back.png",
  "swamp_background_trees_middle.png",
  "swamp_background_trees_front.png"
]) {
  assert.deepEqual(drawForFile(atZero, staticFile), drawForFile(later, staticFile));
  assert.deepEqual(drawForFile(atZero, staticFile).slice(6), [0, 0, 1280, 720]);
}
for (const fogFile of [
  "swamp_background_fog_back.png",
  "swamp_background_fog_front.png"
]) {
  assert.equal(drawsForFile(atZero, fogFile).length, 2);
  assert.notDeepEqual(
    drawForFile(atZero, fogFile).slice(6),
    drawForFile(later, fogFile).slice(6)
  );
  assert.ok(drawsForFile(atZero, fogFile).every(draw => draw[7] === 0));
  assert.ok(drawsForFile(later, fogFile).every(draw => draw[7] === 0));
}
assert.ok(atZero.calls.some(call => (
  call[0] === "set" &&
  call[1] === "globalCompositeOperation" &&
  call[2] === "source-over"
)));
assert.equal(atZero.calls.some(call => call[1] === "globalAlpha"), false);
assert.equal(atZero.calls.some(call => call[1] === "filter"), false);

const mapping = visuals.getBackgroundMapping(1280, 720);
const fogBackAtOne = visuals.getFogMapping(1, mapping, "back");
const fogBackAtTwo = visuals.getFogMapping(2, mapping, "back");
const fogFrontAtOne = visuals.getFogMapping(1, mapping, "front");
const fogFrontAtTwo = visuals.getFogMapping(2, mapping, "front");
assert.equal(fogBackAtOne.offsetX, -6);
assert.equal(fogBackAtTwo.offsetX, -12);
assert.equal(fogBackAtOne.offsetY, 0);
assert.equal(fogBackAtOne.wrapDistance, 1219);
assert.deepEqual(
  JSON.parse(JSON.stringify(fogBackAtOne.destinations)),
  [
    {x: -6, y: 0, w: 1280, h: 720},
    {x: 1213, y: 0, w: 1280, h: 720}
  ]
);
assert.equal(fogFrontAtOne.offsetX, -10);
assert.equal(fogFrontAtTwo.offsetX, -20);
assert.equal(fogFrontAtOne.offsetY, 0);
assert.equal(fogFrontAtOne.wrapDistance, 1237);
assert.deepEqual(
  JSON.parse(JSON.stringify(fogFrontAtOne.destinations)),
  [
    {x: -10, y: 0, w: 1280, h: 720},
    {x: 1227, y: 0, w: 1280, h: 720}
  ]
);
assert.equal(visuals.getFogMapping(1219 / 6, mapping, "back").offsetX, 0);
assert.equal(visuals.getFogMapping(1237 / 10, mapping, "front").offsetX, 0);

for (const essentialFile of [
  "swamp_background_skybox.png",
  "swamp_background_trees_back.png",
  "swamp_background_trees_middle.png",
  "swamp_background_trees_front.png"
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
  "swamp_background_fog_back.png",
  "swamp_background_fog_front.png"
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
assert.match(biomesSource, /function drawSwampBackground\(biome\)/);
assert.match(biomesSource, /swamp:\s*drawSwampBackground/);
assert.match(
  read("index.html"),
  /js\/visual-snow-assets\.js[\s\S]*js\/visual-swamp-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(
  visualSource,
  /Math\.random\(|Math\.sin\(|coast|desert|volcano|snow_background/i
);

for (const relativePath of [
  "js/biomes.js",
  "js/core.js",
  "js/game.js",
  "js/hazards.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/renderer.js",
  "js/visual-platform-kit.js",
  "js/visual-decor-kit.js",
  "js/visual-portal-kit.js",
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
    `${relativePath} must remain unchanged by the Swamp background integration`
  );
}

console.log("Swamp six-layer background order, continuous fog wrapping, alpha edges and fallback tests passed.");
