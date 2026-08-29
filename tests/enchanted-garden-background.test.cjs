"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-enchanted-garden-assets.js");
const rendererSource = read("js/renderer.js");
const biomeSource = read("js/biomes.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/enchantedGarden/background";
const backgroundPaths = Object.freeze({
  skybox:
    `${backgroundDirectory}/enchantedGarden_background_skybox.png`,
  cloudsBack:
    `${backgroundDirectory}/enchantedGarden_background_clouds_back.png`,
  sun:
    `${backgroundDirectory}/enchantedGarden_background_sun.png`,
  cloudsFront:
    `${backgroundDirectory}/enchantedGarden_background_clouds_front.png`,
  gardenBack:
    `${backgroundDirectory}/enchantedGarden_background_garden_back.png`
});
const backgroundSize = Object.freeze({w: 1280, h: 720});
const hazardPath =
  "assets/environments/enchantedGarden/hazards/enchantedGarden_hazard_main.png";
const hazardSize = Object.freeze({w: 1650, h: 60});
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
assert.deepEqual(
  fs.readdirSync(path.join(root, backgroundDirectory)).sort(),
  Object.values(backgroundPaths).map(file => path.posix.basename(file)).sort()
);

function decodePng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8);
  assert.ok(colorType === 2 || colorType === 6);
  assert.equal(bytes[28], 0);
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
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
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

function getAlphaBounds(decoded, threshold = 8) {
  assert.equal(decoded.channels, 4);
  const columnMaximum = new Uint8Array(decoded.width);
  const rowMaximum = new Uint8Array(decoded.height);
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      const alpha = decoded.pixels[(y * decoded.width + x) * 4 + 3];
      columnMaximum[x] = Math.max(columnMaximum[x], alpha);
      rowMaximum[y] = Math.max(rowMaximum[y], alpha);
    }
  }
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  while (left < decoded.width && columnMaximum[left] <= threshold) left++;
  while (
    right < decoded.width &&
    columnMaximum[decoded.width - 1 - right] <= threshold
  ) right++;
  while (top < decoded.height && rowMaximum[top] <= threshold) top++;
  while (
    bottom < decoded.height &&
    rowMaximum[decoded.height - 1 - bottom] <= threshold
  ) bottom++;
  return Object.freeze({left, right, top, bottom});
}

const decodedAssets = Object.freeze(Object.fromEntries(
  Object.entries(backgroundPaths).map(([name, relativePath]) => (
    [name, decodePng(relativePath)]
  ))
));
for (const decoded of Object.values(decodedAssets)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, backgroundSize);
}
assert.equal(decodedAssets.skybox.colorType, 2);
assert.deepEqual(getAlphaUsage(decodedAssets.skybox), {
  hasVisiblePixels: true,
  hasTransparentPixels: false
});
for (const name of ["cloudsBack", "sun", "cloudsFront", "gardenBack"]) {
  assert.equal(decodedAssets[name].colorType, 6);
  assert.deepEqual(getAlphaUsage(decodedAssets[name]), {
    hasVisiblePixels: true,
    hasTransparentPixels: true
  });
}
assert.deepEqual(
  getAlphaBounds(decodedAssets.cloudsBack),
  {left: 34, right: 26, top: 4, bottom: 408}
);
assert.deepEqual(
  getAlphaBounds(decodedAssets.cloudsFront),
  {left: 22, right: 11, top: 49, bottom: 392}
);
assert.deepEqual(
  getAlphaBounds(decodedAssets.sun),
  {left: 870, right: 212, top: 120, bottom: 402}
);
assert.deepEqual(
  getAlphaBounds(decodedAssets.gardenBack),
  {left: 0, right: 0, top: 331, bottom: 0}
);
const decodedHazard = decodePng(hazardPath);
assert.deepEqual(
  {w: decodedHazard.width, h: decodedHazard.height},
  hazardSize
);
assert.equal(decodedHazard.colorType, 6);
assert.deepEqual(getAlphaUsage(decodedHazard), {
  hasVisiblePixels: true,
  hasTransparentPixels: true
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
      const isHazard = value === hazardPath;
      assert.ok(Object.values(backgroundPaths).includes(value) || isHazard);
      const file = path.posix.basename(value);
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      const expectedSize = isHazard ? hazardSize : backgroundSize;
      this.naturalWidth = file === invalidFile
        ? expectedSize.w - 1
        : expectedSize.w;
      this.naturalHeight = expectedSize.h;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const document = {
    createElement(name) {
      assert.equal(name, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(type) {
          assert.equal(type, "2d");
          return {
            clearRect() {},
            drawImage(image) { analyzedImage = image; },
            getImageData() {
              const file = path.posix.basename(analyzedImage.src);
              const alphas = file === opaqueLayer
                ? [255, 255]
                : file === transparentLayer ? [0, 0] : [180, 0];
              return {
                data: new Uint8ClampedArray([
                  0, 0, 0, alphas[0],
                  0, 0, 0, alphas[1]
                ])
              };
            }
          };
        }
      };
    }
  };
  const platformVisuals = Object.freeze({
    platformMarker: "enchanted-garden-platform-kit"
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "enchantedGarden");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "enchantedGarden");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Enchanted Garden visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    document,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.enchantedGardenVisualsForTest = ENCHANTED_GARDEN_ASSET_VISUALS;
  `, context, {filename: "enchanted-garden-background-fixture.js"});
  return {
    api: context.enchantedGardenVisualsForTest,
    loadedPaths,
    platformVisuals,
    recording,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function captureBackground(fixture, visualTime, width = 1280, height = 720) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBackground(
    fixture.recording.context,
    width,
    height,
    visualTime
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

function captureHazard(fixture, rect = hazardRect) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBottomDeathHazard(
    fixture.recording.context,
    rect
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

const fixture = loadFixture();
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.deepEqual(fixture.loadedPaths, [...Object.values(backgroundPaths), hazardPath]);
const status = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, backgroundPaths);
assert.deepEqual(status.expectedNativeSize, backgroundSize);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.renderOrder, [
  "skybox",
  "cloudsBack",
  "sun",
  "cloudsFront",
  "gardenBack",
  "gameplay"
]);
assert.deepEqual(status.staticLayers, ["skybox", "sun", "gardenBack"]);
assert.deepEqual(status.cloudAnimation, {
  back: {
    leftSpeed: 6,
    ySpeed: 0,
    wrapDistance: 1280,
    overlap: 0,
    drawCopies: 2,
    transparentEdges: {left: 34, right: 26}
  },
  front: {
    leftSpeed: 11,
    ySpeed: 0,
    wrapDistance: 1280,
    overlap: 0,
    drawCopies: 2,
    transparentEdges: {left: 22, right: 11}
  },
  direction: "right-to-left",
  wrapMode: "full-width-continuous"
});
assert.ok(
  status.cloudAnimation.front.leftSpeed >
  status.cloudAnimation.back.leftSpeed
);

const mapping = fixture.api.getBackgroundMapping(1280, 720);
const backAtOne = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(1, mapping, "back")
));
const backAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(2, mapping, "back")
));
const frontAtOne = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(1, mapping, "front")
));
const frontAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(2, mapping, "front")
));
assert.equal(backAtOne.offsetX, -6);
assert.equal(backAtTwo.offsetX, -12);
assert.equal(frontAtOne.offsetX, -11);
assert.equal(frontAtTwo.offsetX, -22);
assert.ok(Math.abs(frontAtTwo.offsetX) > Math.abs(backAtTwo.offsetX));
for (const clouds of [backAtOne, backAtTwo, frontAtOne, frontAtTwo]) {
  assert.equal(clouds.offsetY, 0);
  assert.equal(clouds.wrapDistance, 1280);
  assert.equal(clouds.overlap, 0);
  assert.equal(clouds.destinations.length, 2);
  assert.equal(clouds.destinations[1].x - clouds.destinations[0].x, 1280);
  assert.ok(clouds.destinations.every(destination => (
    destination.y === 0 && destination.w === 1280 && destination.h === 720
  )));
}
assert.equal(fixture.api.getCloudMapping(-10, mapping, "back").offsetX, 0);
assert.equal(fixture.api.getCloudMapping(-10, mapping, "front").offsetX, 0);
assert.equal(fixture.api.getCloudMapping(1280 / 6, mapping, "back").offsetX, 0);
assert.equal(fixture.api.getCloudMapping(1280 / 11, mapping, "front").offsetX, 0);
assert.equal(fixture.api.getCloudMapping(1, mapping, "invalid"), null);

const atOne = captureBackground(fixture, 1);
const atTwo = captureBackground(fixture, 2);
assert.equal(atOne.drawn, true);
const getDraws = capture => capture.calls.filter(call => call[0] === "drawImage");
const drawsAtOne = getDraws(atOne);
const drawsAtTwo = getDraws(atTwo);
assert.deepEqual(drawsAtOne.map(call => call[1].src), [
  backgroundPaths.skybox,
  backgroundPaths.cloudsBack,
  backgroundPaths.cloudsBack,
  backgroundPaths.sun,
  backgroundPaths.cloudsFront,
  backgroundPaths.cloudsFront,
  backgroundPaths.gardenBack
]);
assert.ok(drawsAtOne.every(call => (
  call[2] === 0 && call[3] === 0 &&
  call[4] === 1280 && call[5] === 720 &&
  call[8] === 1280 && call[9] === 720
)));
const staticPaths = new Set([
  backgroundPaths.skybox,
  backgroundPaths.sun,
  backgroundPaths.gardenBack
]);
assert.deepEqual(
  drawsAtTwo.filter(call => staticPaths.has(call[1].src)).map(call => call.slice(2)),
  drawsAtOne.filter(call => staticPaths.has(call[1].src)).map(call => call.slice(2))
);
assert.ok(drawsAtOne.filter(call => (
  call[1].src === backgroundPaths.cloudsBack ||
  call[1].src === backgroundPaths.cloudsFront
)).every(call => call[7] === 0));
assert.notDeepEqual(
  drawsAtTwo.filter(call => call[1].src === backgroundPaths.cloudsBack)
    .map(call => call.slice(6)),
  drawsAtOne.filter(call => call[1].src === backgroundPaths.cloudsBack)
    .map(call => call.slice(6))
);
assert.notDeepEqual(
  drawsAtTwo.filter(call => call[1].src === backgroundPaths.cloudsFront)
    .map(call => call.slice(6)),
  drawsAtOne.filter(call => call[1].src === backgroundPaths.cloudsFront)
    .map(call => call.slice(6))
);
assert.equal(atOne.calls.some(call => call[0] === "fillRect"), false);

const halfSize = captureBackground(fixture, 2, 640, 360);
assert.ok(getDraws(halfSize).every(call => call[8] === 640 && call[9] === 360));
assert.ok(getDraws(halfSize).every(call => call[7] === 0));
assert.equal(fixture.api.drawBackground(null, 1280, 720, 0), false);
assert.equal(fixture.api.drawBackground(fixture.recording.context, 0, 720, 0), false);

for (const relativePath of Object.values(backgroundPaths)) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["failedFile", "invalidFile"]) {
    const unavailable = loadFixture({[mode]: file});
    assert.equal(unavailable.api.isBackgroundReady(), false);
    const capture = captureBackground(unavailable, 2);
    assert.equal(capture.drawn, false);
    assert.equal(getDraws(capture).length, 0);
  }
}
for (const relativePath of Object.values(backgroundPaths).filter(path => (
  path !== backgroundPaths.skybox
))) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["opaqueLayer", "transparentLayer"]) {
    const unavailable = loadFixture({[mode]: file});
    assert.equal(unavailable.api.isBackgroundReady(), false);
    assert.equal(captureBackground(unavailable, 2).drawn, false);
  }
}

const hazardStatus = JSON.parse(JSON.stringify(fixture.api.getHazardStatus()));
assert.deepEqual(hazardStatus, {
  ready: true,
  path: hazardPath,
  expectedNativeSize: hazardSize,
  validNativeSize: true,
  source: {x: 0, y: 0, w: 1650, h: 60},
  destination: {x: 235, y: 690, w: 825, h: 30},
  layerCount: 1,
  animated: false
});
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getBottomHazardMapping(hazardRect))),
  {
    source: {x: 0, y: 0, w: 1650, h: 60},
    destination: {x: 235, y: 690, w: 825, h: 30}
  }
);
const hazardAtOne = captureHazard(fixture);
const hazardAtTwo = captureHazard(fixture);
assert.equal(hazardAtOne.drawn, true);
assert.deepEqual(hazardAtTwo, hazardAtOne);
assert.deepEqual(
  hazardAtOne.calls.filter(call => call[0] === "drawImage").map(call => (
    [call[1].src, ...call.slice(2)]
  )),
  [[hazardPath, 0, 0, 1650, 60, 235, 690, 825, 30]]
);
assert.equal(captureHazard(fixture, {...hazardRect, y: 689}).drawn, false);
assert.equal(fixture.api.drawBottomDeathHazard(null, hazardRect), false);
for (const mode of ["failedFile", "invalidFile"]) {
  const unavailable = loadFixture({
    [mode]: path.posix.basename(hazardPath)
  });
  assert.equal(unavailable.api.isBackgroundReady(), true);
  assert.equal(captureBackground(unavailable, 2).drawn, true);
  assert.equal(unavailable.api.isHazardReady(), false);
  assert.equal(captureHazard(unavailable).drawn, false);
}

const scriptIndex = indexSource.indexOf("./js/visual-enchanted-garden-assets.js");
assert.ok(scriptIndex >= 0);
assert.ok(scriptIndex > indexSource.indexOf("./js/visual-platform-kit.js"));
assert.ok(scriptIndex < indexSource.indexOf("./js/renderer.js"));
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{[\s\S]*?drawBackground\(biome\)/
);
assert.match(biomeSource, /enchantedGarden: drawEnchantedGardenBackground/);
assert.match(
  visualSource,
  /BIOME_PLATFORM_VISUALS\.register\("enchantedGarden"/
);
assert.doesNotMatch(visualSource, /Math\.random\(/);
assert.doesNotMatch(visualSource, /glow|firefl|mote|particle/i);
assert.doesNotMatch(visualSource, /fillRect|fillStyle|globalAlpha|filter/);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)/
);
assert.match(
  hazardsSource,
  /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\)/
);
assert.match(
  levelGeneratorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\)/
);

console.log(
  "Enchanted Garden background, continuous clouds and static hazard tests passed."
);
