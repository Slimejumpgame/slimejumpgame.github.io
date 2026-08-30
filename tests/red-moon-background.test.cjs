"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-red-moon-assets.js");
const rendererSource = read("js/renderer.js");
const biomeSource = read("js/biomes.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const physicsSource = read("js/physics.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/redMoon/background";
const backgroundPaths = Object.freeze({
  skybox: `${backgroundDirectory}/redMoon_background_skybox.png`,
  cloudsBack: `${backgroundDirectory}/redMoon_background_clouds_back.png`,
  moon: `${backgroundDirectory}/redMoon_background_moon.png`,
  cloudsFront: `${backgroundDirectory}/redMoon_background_clouds_front.png`
});
const backgroundSize = Object.freeze({w: 1280, h: 720});
const hazardDirectory = "assets/environments/redMoon/hazards";
const hazardPaths = Object.freeze({
  base: `${hazardDirectory}/redMoon_hazard_base.png`,
  waveBack: `${hazardDirectory}/redMoon_hazard_wave_back.png`,
  waveFront: `${hazardDirectory}/redMoon_hazard_wave_front.png`
});
const hazardSize = Object.freeze({w: 1650, h: 60});
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const allAssetPaths = Object.freeze([
  ...Object.values(backgroundPaths),
  ...Object.values(hazardPaths)
]);

assert.deepEqual(
  fs.readdirSync(path.join(root, backgroundDirectory)).sort(),
  Object.values(backgroundPaths).map(file => path.posix.basename(file)).sort()
);
assert.deepEqual(
  fs.readdirSync(path.join(root, hazardDirectory)).sort(),
  Object.values(hazardPaths).map(file => path.posix.basename(file)).sort()
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
for (const name of ["cloudsBack", "moon", "cloudsFront"]) {
  assert.equal(decodedAssets[name].colorType, 6);
  assert.deepEqual(getAlphaUsage(decodedAssets[name]), {
    hasVisiblePixels: true,
    hasTransparentPixels: true
  });
}
assert.deepEqual(
  getAlphaBounds(decodedAssets.cloudsBack),
  {left: 93, right: 11, top: 81, bottom: 343}
);
assert.deepEqual(
  getAlphaBounds(decodedAssets.cloudsFront),
  {left: 91, right: 316, top: 60, bottom: 439}
);
assert.deepEqual(
  getAlphaBounds(decodedAssets.moon),
  {left: 884, right: 111, top: 14, bottom: 421}
);

const decodedHazardAssets = Object.freeze(Object.fromEntries(
  Object.entries(hazardPaths).map(([name, relativePath]) => (
    [name, decodePng(relativePath)]
  ))
));
for (const decoded of Object.values(decodedHazardAssets)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, hazardSize);
  assert.equal(decoded.colorType, 6);
  assert.deepEqual(getAlphaUsage(decoded), {
    hasVisiblePixels: true,
    hasTransparentPixels: true
  });
}
assert.deepEqual(
  getAlphaBounds(decodedHazardAssets.base),
  {left: 1, right: 0, top: 0, bottom: 0}
);
assert.deepEqual(
  getAlphaBounds(decodedHazardAssets.waveBack),
  {left: 2, right: 2, top: 2, bottom: 0}
);
assert.deepEqual(
  getAlphaBounds(decodedHazardAssets.waveFront),
  {left: 4, right: 6, top: 0, bottom: 0}
);

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); }
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
      assert.ok(allAssetPaths.includes(value));
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      const expectedSize = Object.values(hazardPaths).includes(value)
        ? hazardSize
        : backgroundSize;
      this.complete = true;
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
              if (file === opaqueLayer) {
                return {data: new Uint8ClampedArray([0, 0, 0, 255])};
              }
              if (file === transparentLayer) {
                return {data: new Uint8ClampedArray([0, 0, 0, 0])};
              }
              return {
                data: new Uint8ClampedArray([
                  0, 0, 0, 180,
                  0, 0, 0, 0
                ])
              };
            }
          };
        }
      };
    }
  };
  const platformVisuals = Object.freeze({
    platformMarker: "red-moon-platform-kit"
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "redMoon");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "redMoon");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Red Moon background must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    document,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.redMoonVisualsForTest = RED_MOON_ASSET_VISUALS;
  `, context, {filename: "red-moon-background-fixture.js"});
  return {
    api: context.redMoonVisualsForTest,
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

function captureHazard(fixture, visualTime, rect = hazardRect) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBottomDeathHazard(
    fixture.recording.context,
    rect,
    visualTime
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

const plain = value => JSON.parse(JSON.stringify(value));
const getDraws = capture => capture.calls.filter(call => call[0] === "drawImage");

const fixture = loadFixture();
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.deepEqual(fixture.loadedPaths, allAssetPaths);
assert.equal(typeof fixture.api.whenBackgroundReady, "function");
assert.equal(typeof fixture.api.whenHazardReady, "function");

const status = plain(fixture.api.getBackgroundStatus());
assert.equal(status.ready, true);
assert.deepEqual(status.paths, backgroundPaths);
assert.deepEqual(status.expectedNativeSize, backgroundSize);
assert.deepEqual(status.essentialLayers, [
  "skybox",
  "cloudsBack",
  "moon",
  "cloudsFront"
]);
assert.deepEqual(status.renderOrder, [
  "skybox",
  "cloudsBack",
  "moon",
  "cloudsFront",
  "gameplay"
]);
assert.deepEqual(status.staticLayers, ["skybox", "moon"]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(Object.keys(status.alphaUsage).sort(), [
  "cloudsBack",
  "cloudsFront",
  "moon"
]);
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.cloudAnimation, {
  back: {
    leftSpeed: 6,
    ySpeed: 0,
    wrapDistance: 1280,
    overlap: 0,
    drawCopies: 2,
    transparentEdges: {left: 93, right: 11}
  },
  front: {
    leftSpeed: 11,
    ySpeed: 0,
    wrapDistance: 1280,
    overlap: 0,
    drawCopies: 2,
    transparentEdges: {left: 91, right: 316}
  },
  direction: "right-to-left",
  motion: "linear-horizontal",
  wrapMode: "full-width-continuous"
});
assert.ok(
  status.cloudAnimation.front.leftSpeed >
  status.cloudAnimation.back.leftSpeed
);

const mapping = fixture.api.getBackgroundMapping(1280, 720);
assert.deepEqual(plain(mapping), {
  source: backgroundSize,
  scaleX: 1,
  scaleY: 1,
  destination: {x: 0, y: 0, w: 1280, h: 720}
});
const backAtOne = plain(fixture.api.getCloudMapping(1, mapping, "back"));
const backAtTwo = plain(fixture.api.getCloudMapping(2, mapping, "back"));
const frontAtOne = plain(fixture.api.getCloudMapping(1, mapping, "front"));
const frontAtTwo = plain(fixture.api.getCloudMapping(2, mapping, "front"));
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
assert.equal(atTwo.drawn, true);
const drawsAtOne = getDraws(atOne);
const drawsAtTwo = getDraws(atTwo);
assert.deepEqual(drawsAtOne.map(call => call[1].src), [
  backgroundPaths.skybox,
  backgroundPaths.cloudsBack,
  backgroundPaths.cloudsBack,
  backgroundPaths.moon,
  backgroundPaths.cloudsFront,
  backgroundPaths.cloudsFront
]);
assert.deepEqual(
  drawsAtTwo.filter(call => call[1].src === backgroundPaths.skybox)
    .map(call => call.slice(2)),
  drawsAtOne.filter(call => call[1].src === backgroundPaths.skybox)
    .map(call => call.slice(2))
);
assert.deepEqual(
  drawsAtTwo.filter(call => call[1].src === backgroundPaths.moon)
    .map(call => call.slice(2)),
  drawsAtOne.filter(call => call[1].src === backgroundPaths.moon)
    .map(call => call.slice(2))
);
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
assert.ok(drawsAtOne.every(call => (
  call[2] === 0 && call[3] === 0 &&
  call[4] === 1280 && call[5] === 720 &&
  call[7] === 0 && call[8] === 1280 && call[9] === 720
)));
assert.equal(atOne.calls.some(call => call[0] === "translate"), false);
assert.equal(atOne.calls.some(call => call[0] === "rotate"), false);

const halfSize = captureBackground(fixture, 2, 640, 360);
assert.ok(getDraws(halfSize).every(call => call[8] === 640 && call[9] === 360));
assert.ok(getDraws(halfSize).every(call => call[7] === 0));
assert.equal(fixture.api.drawBackground(null, 1280, 720, 0), false);
assert.equal(fixture.api.drawBackground(fixture.recording.context, 0, 720, 0), false);
assert.equal(fixture.api.getBackgroundMapping(Number.NaN, 720), null);

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
for (const relativePath of Object.values(backgroundPaths).filter(file => (
  file !== backgroundPaths.skybox
))) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["opaqueLayer", "transparentLayer"]) {
    const unavailable = loadFixture({[mode]: file});
    assert.equal(unavailable.api.isBackgroundReady(), false);
    assert.equal(captureBackground(unavailable, 2).drawn, false);
  }
}

let fallbackDraws = 0;
const readyAssetDrawn = Boolean(captureBackground(fixture, 2).drawn);
if (!readyAssetDrawn) fallbackDraws++;
assert.equal(readyAssetDrawn, true);
assert.equal(fallbackDraws, 0);
const missingMoon = loadFixture({
  failedFile: path.posix.basename(backgroundPaths.moon)
});
const unavailableAssetDrawn = Boolean(captureBackground(missingMoon, 2).drawn);
if (!unavailableAssetDrawn) fallbackDraws++;
assert.equal(unavailableAssetDrawn, false);
assert.equal(fallbackDraws, 1);

const hazardStatus = plain(fixture.api.getHazardStatus());
assert.equal(hazardStatus.ready, true);
assert.deepEqual(hazardStatus.paths, hazardPaths);
assert.deepEqual(hazardStatus.contract, {
  native: {w: 1650, h: 60},
  runtime: {x: 235, y: 690, w: 825, h: 30},
  nativeToRuntimeScale: 0.5
});
assert.ok(Object.values(hazardStatus.validNativeSizes).every(Boolean));
assert.deepEqual(hazardStatus.animation, {
  drawOrder: ["base", "waveBack", "waveFront"],
  base: {
    xSpeed: 0,
    ySpeed: 0,
    rotation: 0,
    motion: "static"
  },
  waveBack: {
    leftSpeed: 16,
    ySpeed: 0,
    rotation: 0,
    direction: "right-to-left",
    nativeWrapOverlap: 0,
    runtimeWrapOverlap: 0,
    wrapDistance: 825,
    drawCopies: 2
  },
  waveFront: {
    leftSpeed: 24,
    ySpeed: 0,
    rotation: 0,
    direction: "right-to-left",
    nativeWrapOverlap: 0,
    runtimeWrapOverlap: 0,
    wrapDistance: 825,
    drawCopies: 2
  },
  bobbing: false,
  deterministic: true,
  wrapMode: "full-width-continuous"
});
assert.ok(
  hazardStatus.animation.waveFront.leftSpeed >
  hazardStatus.animation.waveBack.leftSpeed
);

const hazardAtZeroMapping = plain(
  fixture.api.getBottomHazardMapping(0, hazardRect)
);
const hazardAtOneMapping = plain(
  fixture.api.getBottomHazardMapping(1, hazardRect)
);
const hazardAtTwoMapping = plain(
  fixture.api.getBottomHazardMapping(2, hazardRect)
);
assert.deepEqual(hazardAtZeroMapping.source, hazardSize);
assert.deepEqual(hazardAtZeroMapping.base, {
  offsetX: 0,
  offsetY: 0,
  destination: {x: 235, y: 690, w: 825, h: 30}
});
assert.deepEqual(hazardAtTwoMapping.base, hazardAtZeroMapping.base);
assert.equal(hazardAtOneMapping.waveBack.offsetX, -16);
assert.equal(hazardAtTwoMapping.waveBack.offsetX, -32);
assert.equal(hazardAtOneMapping.waveFront.offsetX, -24);
assert.equal(hazardAtTwoMapping.waveFront.offsetX, -48);
assert.ok(
  Math.abs(hazardAtTwoMapping.waveFront.offsetX) >
  Math.abs(hazardAtTwoMapping.waveBack.offsetX)
);
for (const wave of [
  hazardAtZeroMapping.waveBack,
  hazardAtZeroMapping.waveFront,
  hazardAtOneMapping.waveBack,
  hazardAtOneMapping.waveFront,
  hazardAtTwoMapping.waveBack,
  hazardAtTwoMapping.waveFront
]) {
  assert.equal(wave.offsetY, 0);
  assert.equal(wave.runtimeOverlap, 0);
  assert.equal(wave.wrapDistance, 825);
  assert.equal(wave.destinations.length, 2);
  assert.equal(wave.destinations[1].x - wave.destinations[0].x, 825);
  assert.ok(wave.destinations.every(destination => (
    destination.y === 690 && destination.w === 825 && destination.h === 30
  )));
}
assert.equal(
  fixture.api.getBottomHazardMapping(-10, hazardRect).waveBack.offsetX,
  0
);
assert.equal(
  fixture.api.getBottomHazardMapping(-10, hazardRect).waveFront.offsetX,
  0
);
assert.equal(
  fixture.api.getBottomHazardMapping(825 / 16, hazardRect).waveBack.offsetX,
  0
);
assert.equal(
  fixture.api.getBottomHazardMapping(825 / 24, hazardRect).waveFront.offsetX,
  0
);
for (const changedRect of [
  {...hazardRect, x: 234},
  {...hazardRect, y: 689},
  {...hazardRect, w: 824},
  {...hazardRect, h: 29}
]) {
  assert.equal(fixture.api.getBottomHazardMapping(1, changedRect), null);
}

const hazardAtOne = captureHazard(fixture, 1);
const hazardAtTwo = captureHazard(fixture, 2);
assert.equal(hazardAtOne.drawn, true);
assert.equal(hazardAtTwo.drawn, true);
const hazardDrawsAtOne = getDraws(hazardAtOne);
const hazardDrawsAtTwo = getDraws(hazardAtTwo);
assert.deepEqual(hazardDrawsAtOne.map(call => call[1].src), [
  hazardPaths.base,
  hazardPaths.waveBack,
  hazardPaths.waveBack,
  hazardPaths.waveFront,
  hazardPaths.waveFront
]);
assert.deepEqual(hazardDrawsAtOne[0].slice(2), [
  0, 0, 1650, 60, 235, 690, 825, 30
]);
assert.deepEqual(
  hazardDrawsAtTwo[0].slice(2),
  hazardDrawsAtOne[0].slice(2),
  "Red Moon hazard base must remain static"
);
assert.equal(hazardDrawsAtOne[1][6], 219);
assert.equal(hazardDrawsAtTwo[1][6], 203);
assert.equal(hazardDrawsAtOne[3][6], 211);
assert.equal(hazardDrawsAtTwo[3][6], 187);
assert.ok(hazardDrawsAtOne.every(call => call[7] === 690));
assert.ok(hazardDrawsAtTwo.every(call => call[7] === 690));
assert.equal(hazardAtTwo.calls.some(call => call[0] === "translate"), false);
assert.equal(hazardAtTwo.calls.some(call => call[0] === "rotate"), false);
assert.equal(fixture.api.drawBottomDeathHazard(null, hazardRect, 0), false);

for (const relativePath of Object.values(hazardPaths)) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["failedFile", "invalidFile"]) {
    const unavailable = loadFixture({[mode]: file});
    assert.equal(unavailable.api.isBackgroundReady(), true);
    assert.equal(unavailable.api.isHazardReady(), false);
    const capture = captureHazard(unavailable, 2);
    assert.equal(capture.drawn, false);
    assert.equal(getDraws(capture).length, 0);
  }
}

let genericHazardFallbackDraws = 0;
if (!captureHazard(fixture, 2).drawn) genericHazardFallbackDraws++;
assert.equal(genericHazardFallbackDraws, 0);
const missingWaveBack = loadFixture({
  failedFile: path.posix.basename(hazardPaths.waveBack)
});
if (!captureHazard(missingWaveBack, 2).drawn) genericHazardFallbackDraws++;
assert.equal(genericHazardFallbackDraws, 1);

assert.match(biomeSource, /redMoon: drawRedMoonBackground/);
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{[\s\S]*?drawBackground\(biome\)/
);
const rendererDrawSource = rendererSource.slice(rendererSource.indexOf("  function draw()"));
assert.ok(
  rendererDrawSource.indexOf("biomePlatformVisuals.drawBackground") <
  rendererDrawSource.indexOf("drawPlatforms(")
);
const redMoonScriptIndex = indexSource.indexOf("./js/visual-red-moon-assets.js");
const rendererScriptIndex = indexSource.indexOf("./js/renderer.js");
assert.ok(redMoonScriptIndex >= 0);
assert.ok(redMoonScriptIndex < rendererScriptIndex);
assert.match(
  visualSource,
  /BIOME_PLATFORM_VISUALS\.register\("redMoon", redMoonVisuals\)/
);
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
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(physicsSource, /isBottomDeathHazard === true/);
assert.doesNotMatch(visualSource, /Math\.random\(/);
assert.doesNotMatch(visualSource, /Math\.sin\(/);
assert.doesNotMatch(visualSource, /\b(?:fog|firefl(?:y|ies)|particle|lightning)\b/i);

console.log(
  "Red Moon background and static-base, two-speed horizontal hazard tests passed."
);
