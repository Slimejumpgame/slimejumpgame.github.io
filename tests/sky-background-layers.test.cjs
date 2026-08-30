"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-sky-assets.js");
const hazardsSource = read("js/hazards.js");
const generatorSource = read("js/level-generator.js");
const physicsSource = read("js/physics.js");
const playerSource = read("js/player.js");
const rendererSource = read("js/renderer.js");
const biomesSource = read("js/biomes.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/sky/background";
const backgroundFiles = Object.freeze([
  "sky_background_skybox.png",
  "sky_background_clouds_back.png",
  "sky_background_islands.png",
  "sky_background_clouds_front.png"
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
    if (type === "IDAT") {
      idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
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

function getTransparentHorizontalMargins(decoded) {
  assert.equal(decoded.channels, 4);
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

function getLargestInternalTransparentRun(decoded) {
  assert.equal(decoded.channels, 4);
  const visibleColumns = new Uint8Array(decoded.width);
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] > 0) {
        visibleColumns[x] = 1;
      }
    }
  }
  const firstVisibleX = visibleColumns.indexOf(1);
  const lastVisibleX = visibleColumns.lastIndexOf(1);
  let largestRun = 0;
  let currentRun = 0;
  for (let x = firstVisibleX; x <= lastVisibleX; x++) {
    if (visibleColumns[x]) {
      currentRun = 0;
    } else {
      currentRun++;
      largestRun = Math.max(largestRun, currentRun);
    }
  }
  return largestRun;
}

const decodedAssets = Object.fromEntries(backgroundPaths.map(relativePath => (
  [relativePath, decodePng(relativePath)]
)));
for (const [relativePath, decoded] of Object.entries(decodedAssets)) {
  assert.deepEqual(
    {w: decoded.width, h: decoded.height},
    {w: 1280, h: 720},
    `${relativePath} must use the native Sky background size`
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
const cloudsBackMargins = getTransparentHorizontalMargins(
  decodedAssets[backgroundPaths[1]]
);
const cloudsFrontMargins = getTransparentHorizontalMargins(
  decodedAssets[backgroundPaths[3]]
);
assert.deepEqual(cloudsBackMargins, {left: 20, right: 103});
assert.deepEqual(cloudsFrontMargins, {left: 68, right: 123});
const cloudsBackSeamGap = cloudsBackMargins.left +
  cloudsBackMargins.right - 54;
const cloudsFrontSeamGap = cloudsFrontMargins.left +
  cloudsFrontMargins.right - 123;
assert.equal(cloudsBackSeamGap, 69);
assert.equal(cloudsFrontSeamGap, 68);
assert.ok(cloudsBackSeamGap <= 70);
assert.ok(cloudsFrontSeamGap <= 70);
assert.ok(54 <= cloudsBackMargins.right);
assert.ok(123 <= cloudsFrontMargins.right);
assert.ok(
  getLargestInternalTransparentRun(decodedAssets[backgroundPaths[1]]) <=
  cloudsBackSeamGap
);
assert.ok(
  getLargestInternalTransparentRun(decodedAssets[backgroundPaths[3]]) <=
  cloudsFrontSeamGap
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
  invalidFile = null
} = {}) {
  const recording = createRecordingContext();
  const loadedPaths = [];
  let registeredVisuals = null;

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
    platformMarker: "generic-sky-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "sky");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "sky");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Sky background rendering must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    ctx: recording.context,
    worldTime: 4.25
  });
  vm.runInContext(`${visualSource}
    ${hazardsSource}
    globalThis.skyBackgroundForTest = SKY_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "sky-background-layers-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.skyBackgroundForTest,
    drawDeathZone: context.drawDeathZoneForTest,
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
  return imageDraws(capture).filter(call => (
    path.basename(call[1].src) === file
  ));
}

function drawForFile(capture, file) {
  const draws = drawsForFile(capture, file);
  assert.equal(draws.length, 1, `${file} must be drawn exactly once`);
  return draws[0];
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}`);
}

const fixture = loadFixture();
const visuals = fixture.api;
assert.deepEqual(fixture.loadedPaths, backgroundPaths);
assert.equal(fixture.getRegisteredVisuals(), visuals);
assert.equal(visuals.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(visuals.resolvePlatformRole, fixture.platformVisuals.resolvePlatformRole);
assert.equal(visuals.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(visuals.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);

const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const skyBiome = Object.freeze({
  id: "sky",
  hazard: Object.freeze({
    type: "cloudAbyss",
    fill: "#dff8ff",
    deep: "#82bfdc",
    surface: "#ffffff",
    accent: "#a9e8ff"
  })
});
fixture.recording.calls.length = 0;
assert.equal(visuals.drawBottomDeathHazard(
  fixture.recording.context,
  hazardRect,
  4.25
), true);
assert.deepEqual(fixture.recording.calls, []);
fixture.drawDeathZone(hazardRect, skyBiome, visuals);
assert.deepEqual(fixture.recording.calls, [
  ["save"],
  ["beginPath"],
  ["rect", 235, 690, 825, 30],
  ["clip"],
  ["restore"]
]);

const status = JSON.parse(JSON.stringify(visuals.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, {
  skybox: backgroundPaths[0],
  cloudsBack: backgroundPaths[1],
  islands: backgroundPaths[2],
  cloudsFront: backgroundPaths[3]
});
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, ["skybox", "islands"]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(status.cloudsBackAnimation, {
  leftSpeed: 6,
  ySpeed: 0,
  direction: "right-to-left",
  wrapDistance: 1226,
  overlap: 54,
  drawCopies: 2,
  wrapMode: "horizontal-continuous"
});
assert.deepEqual(status.islandsAnimation, {
  xAmplitude: 0,
  yAmplitude: 4,
  yPeriodSeconds: 8.5,
  yPhase: 0.7,
  drawCopies: 1,
  wrapMode: "single-sine-no-wrap"
});
assert.deepEqual(status.cloudsFrontAnimation, {
  leftSpeed: 12,
  ySpeed: 0,
  direction: "right-to-left",
  wrapDistance: 1157,
  overlap: 123,
  drawCopies: 2,
  wrapMode: "horizontal-continuous"
});
assert.ok(
  status.cloudsFrontAnimation.leftSpeed >
  status.cloudsBackAnimation.leftSpeed
);

const atZero = captureBackground(fixture, 0);
const later = captureBackground(fixture, 5.25);
assert.equal(atZero.drawn, true);
assert.deepEqual(
  imageDraws(atZero).map(call => path.basename(call[1].src)),
  [
    backgroundFiles[0],
    backgroundFiles[1],
    backgroundFiles[1],
    backgroundFiles[2],
    backgroundFiles[3],
    backgroundFiles[3]
  ]
);
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}
const skyAtZero = drawForFile(atZero, backgroundFiles[0]);
const skyLater = drawForFile(later, backgroundFiles[0]);
assert.deepEqual(skyAtZero.slice(6), skyLater.slice(6));
const backAtZero = drawsForFile(atZero, backgroundFiles[1]);
const backLater = drawsForFile(later, backgroundFiles[1]);
assert.equal(backAtZero.length, 2);
assert.equal(backLater.length, 2);
assert.ok(backAtZero.every(draw => draw[7] === 0));
assert.ok(backLater.every(draw => draw[7] === 0));
assert.ok(backLater[0][6] < backAtZero[0][6]);
const islandsAtZero = drawForFile(atZero, backgroundFiles[2]);
const islandsLater = drawForFile(later, backgroundFiles[2]);
assert.equal(islandsAtZero[6], 0);
assert.equal(islandsLater[6], 0);
assert.notEqual(islandsAtZero[7], islandsLater[7]);
const frontAtZero = drawsForFile(atZero, backgroundFiles[3]);
const frontLater = drawsForFile(later, backgroundFiles[3]);
assert.equal(frontAtZero.length, 2);
assert.equal(frontLater.length, 2);
assert.ok(frontAtZero.every(draw => draw[7] === 0));
assert.ok(frontLater.every(draw => draw[7] === 0));
assert.ok(frontLater[0][6] < frontAtZero[0][6]);

const nativeMapping = visuals.getBackgroundMapping(1280, 720);
const cloudsBackAtZero = visuals.getCloudsBackMapping(0, nativeMapping);
const cloudsBackAtOne = visuals.getCloudsBackMapping(1, nativeMapping);
const cloudsBackAtTwo = visuals.getCloudsBackMapping(2, nativeMapping);
assert.deepEqual([...cloudsBackAtZero.destinations].map(item => item.x), [0, 1226]);
assert.deepEqual([...cloudsBackAtOne.destinations].map(item => item.x), [-6, 1220]);
assert.equal(cloudsBackAtTwo.offsetX, -12);
assert.equal(cloudsBackAtOne.offsetY, 0);
assert.equal(cloudsBackAtOne.wrapDistance, 1226);
const cloudsFrontAtZero = visuals.getCloudsFrontMapping(0, nativeMapping);
const cloudsFrontAtOne = visuals.getCloudsFrontMapping(1, nativeMapping);
const cloudsFrontAtTwo = visuals.getCloudsFrontMapping(2, nativeMapping);
assert.deepEqual([...cloudsFrontAtZero.destinations].map(item => item.x), [0, 1157]);
assert.deepEqual([...cloudsFrontAtOne.destinations].map(item => item.x), [-12, 1145]);
assert.equal(cloudsFrontAtTwo.offsetX, -24);
assert.equal(cloudsFrontAtOne.offsetY, 0);
assert.equal(cloudsFrontAtOne.wrapDistance, 1157);
assert.equal(
  visuals.getCloudsBackMapping(1226 / 6, nativeMapping).offsetX,
  0
);
assert.equal(
  visuals.getCloudsFrontMapping(1157 / 12, nativeMapping).offsetX,
  0
);
const islandsPeakTime = (Math.PI / 2 - 0.7) * 8.5 / (Math.PI * 2);
const islandsTroughTime = (Math.PI * 3 / 2 - 0.7) * 8.5 / (Math.PI * 2);
assertClose(
  visuals.getIslandsMapping(islandsPeakTime, nativeMapping).offsetY,
  4,
  "islands peak"
);
assertClose(
  visuals.getIslandsMapping(islandsTroughTime, nativeMapping).offsetY,
  -4,
  "islands trough"
);
const scaled = captureBackground(fixture, islandsPeakTime, 640, 360);
assertClose(drawForFile(scaled, backgroundFiles[2])[7], 2, "scaled islands peak");

for (const essentialFile of [backgroundFiles[0], backgroundFiles[2]]) {
  for (const failure of [
    {failedFile: essentialFile},
    {invalidFile: essentialFile}
  ]) {
    const failed = loadFixture(failure);
    assert.equal(failed.api.isBackgroundReady(), false);
    assert.equal(captureBackground(failed).drawn, false);
  }
}
for (const optionalFile of [backgroundFiles[1], backgroundFiles[3]]) {
  for (const failure of [
    {failedFile: optionalFile},
    {invalidFile: optionalFile}
  ]) {
    const partial = loadFixture(failure);
    const capture = captureBackground(partial);
    assert.equal(capture.drawn, true);
    assert.ok(!imageDraws(capture).some(call => (
      path.basename(call[1].src) === optionalFile
    )));
    assert.ok(imageDraws(capture).some(call => (
      path.basename(call[1].src) === backgroundFiles[0]
    )));
    assert.ok(imageDraws(capture).some(call => (
      path.basename(call[1].src) === backgroundFiles[2]
    )));
  }
}

assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.register\("sky", skyVisuals\)/);
assert.doesNotMatch(visualSource, /Math\.random\s*\(/);
assert.doesNotMatch(visualSource, /getImageData|gameplay|generator|tiling/i);
assert.match(
  generatorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  physicsSource,
  /function getBottomDeathHazard[\s\S]*?isBottomDeathHazard === true[\s\S]*?function isPlayerTouchingBottomDeathHazard/
);
assert.match(
  physicsSource,
  /for \(const spike of level\.spikes\)[\s\S]*?intersectsRect[\s\S]*?loseLife\(\);/
);
assert.match(
  playerSource,
  /reason === "bottom_death_hazard"[\s\S]*?isBottomDeathHazard === true/
);
assert.match(
  hazardsSource,
  /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
);
assert.match(biomesSource, /sky:\s*drawSkyBackground/);
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\)[\s\S]*?drawBackground\(biome\);[\s\S]*?drawPlatforms\(/
);
const skyScriptIndex = indexSource.indexOf("./js/visual-sky-assets.js");
const rendererScriptIndex = indexSource.indexOf("./js/renderer.js");
assert.ok(skyScriptIndex >= 0);
assert.ok(skyScriptIndex < rendererScriptIndex);

console.log("Sky background layer regression tests passed.");
