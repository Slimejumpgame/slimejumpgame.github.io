"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-storm-night-assets.js");
const hazardsSource = read("js/hazards.js");
const generatorSource = read("js/level-generator.js");
const physicsSource = read("js/physics.js");
const hazardDirectory = "assets/environments/stormNight/hazards";
const hazardFiles = Object.freeze([
  "stormNight_hazard_base.png",
  "stormNight_hazard_clouds.png"
]);
const hazardPaths = hazardFiles.map(file => `${hazardDirectory}/${file}`);
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const stormNightBiome = Object.freeze({
  id: "stormNight",
  hazard: Object.freeze({
    type: "abyss",
    fill: "#07101a",
    deep: "#010306",
    surface: "#304b61",
    accent: "#6d93ad"
  })
});

function inspectPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6, `${relativePath} must be RGBA`);
  assert.equal(bytes[28], 0);
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const channels = 4;
  const stride = width * channels;
  let previous = Buffer.alloc(stride);
  let packedOffset = 0;
  const visibleColumns = new Uint8Array(width);
  let hasVisiblePixels = false;
  let hasTransparentPixels = false;
  let maximumLeftAlpha = 0;
  let maximumRightAlpha = 0;
  const paeth = (left, up, upperLeft) => {
    const value = left + up - upperLeft;
    const leftDistance = Math.abs(value - left);
    const upDistance = Math.abs(value - up);
    const upperLeftDistance = Math.abs(value - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      current[x] = (packed[packedOffset++] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const alpha = current[x * channels + 3];
      if (alpha > 0) {
        visibleColumns[x] = 1;
        hasVisiblePixels = true;
      }
      if (alpha < 255) hasTransparentPixels = true;
    }
    maximumLeftAlpha = Math.max(maximumLeftAlpha, current[3]);
    maximumRightAlpha = Math.max(
      maximumRightAlpha,
      current[(width - 1) * channels + 3]
    );
    previous = current;
  }
  const firstVisible = visibleColumns.indexOf(1);
  const lastVisible = visibleColumns.lastIndexOf(1);
  let run = 0;
  let largestRun = 0;
  for (let x = firstVisible; x <= lastVisible; x++) {
    if (visibleColumns[x]) {
      run = 0;
    } else {
      run++;
      largestRun = Math.max(largestRun, run);
    }
  }
  return Object.freeze({
    width,
    height,
    colorType,
    hasVisiblePixels,
    hasTransparentPixels,
    margins: Object.freeze({
      left: firstVisible,
      right: width - 1 - lastVisible
    }),
    maximumEdgeAlpha: Object.freeze({
      left: maximumLeftAlpha,
      right: maximumRightAlpha
    }),
    maxInternalTransparentColumns: largestRun
  });
}

const inspectedAssets = hazardPaths.map(inspectPng);
for (let index = 0; index < inspectedAssets.length; index++) {
  assert.deepEqual(
    {w: inspectedAssets[index].width, h: inspectedAssets[index].height},
    {w: 1650, h: 60},
    `${hazardPaths[index]} must retain the 2x hazard contract`
  );
  assert.equal(inspectedAssets[index].hasVisiblePixels, true);
  assert.equal(inspectedAssets[index].hasTransparentPixels, true);
}
const cloudInspection = inspectedAssets[1];
assert.deepEqual(cloudInspection.margins, {left: 0, right: 0});
assert.equal(cloudInspection.maxInternalTransparentColumns, 0);
assert.ok(cloudInspection.maximumEdgeAlpha.left > 0);
assert.ok(cloudInspection.maximumEdgeAlpha.right > 0);

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    clip() { calls.push(["clip"]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    stroke() { calls.push(["stroke"]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop(...stopArgs) {
          calls.push(["addColorStop", ...stopArgs]);
        }
      };
    }
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

function loadFixture({failedFile = null, invalidFile = null} = {}) {
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
      if (value.includes("/background/") || file === failedFile) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      this.naturalWidth = file === invalidFile ? 1649 : 1650;
      this.naturalHeight = 60;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const registry = {
    resolve(id) {
      assert.equal(id, "stormNight");
      return registeredVisuals || Object.freeze({platformMarker: "stormNight"});
    },
    register(id, visuals) {
      assert.equal(id, "stormNight");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Storm Night hazard must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    ctx: recording.context,
    worldTime: 0
  });
  vm.runInContext(`${visualSource}
    ${hazardsSource}
    globalThis.stormNightHazardForTest = STORM_NIGHT_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "storm-night-hazard-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    api: context.stormNightHazardForTest,
    drawDeathZone: context.drawDeathZoneForTest
  };
}

function drawAt(fixture, visualTime) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, stormNightBiome, fixture.api);
  return fixture.recording.calls.map(call => [...call]);
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/hazards/")),
  hazardPaths
);
const status = JSON.parse(JSON.stringify(fixture.api.getStormNightHazardStatus()));
assert.deepEqual(status, {
  ready: true,
  paths: {
    base: hazardPaths[0],
    clouds: hazardPaths[1]
  },
  contract: {
    native: {w: 1650, h: 60},
    runtime: {w: 825, h: 30},
    nativeToRuntimeScale: 0.5
  },
  validNativeSizes: {base: true, clouds: true},
  cloudAnimation: {
    leftSpeed: 12,
    ySpeed: 0,
    direction: "right-to-left",
    wrapDistance: 825,
    overlap: 0,
    drawCopies: 2,
    wrapMode: "horizontal-continuous-seamless-tile"
  }
});

const atZero = drawAt(fixture, 0);
const imageDrawsAtZero = atZero.filter(call => call[0] === "drawImage");
assert.deepEqual(
  imageDrawsAtZero.map(call => path.basename(call[1].src)),
  [hazardFiles[0], hazardFiles[1], hazardFiles[1]]
);
assert.deepEqual(
  imageDrawsAtZero[0].slice(2),
  [0, 0, 1650, 60, 235, 690, 825, 30]
);
assert.deepEqual(
  imageDrawsAtZero[1].slice(2),
  [0, 0, 1650, 60, 235, 690, 825, 30]
);
assert.deepEqual(
  imageDrawsAtZero[2].slice(2),
  [0, 0, 1650, 60, 1060, 690, 825, 30]
);
assert.ok(atZero.findIndex(call => call[0] === "clip") < atZero.findIndex(
  call => call[0] === "drawImage"
));
assert.equal(atZero.some(call => (
  ["createLinearGradient", "fillRect", "stroke"].includes(call[0])
)), false, "valid Storm Night PNGs must suppress the generic abyss fallback");

const atOne = drawAt(fixture, 1);
const imageDrawsAtOne = atOne.filter(call => call[0] === "drawImage");
assert.deepEqual(imageDrawsAtOne[0], imageDrawsAtZero[0]);
assert.deepEqual(
  imageDrawsAtOne.slice(1).map(call => call.slice(6)),
  [
    [223, 690, 825, 30],
    [1048, 690, 825, 30]
  ]
);
const mappingAtOne = JSON.parse(JSON.stringify(
  fixture.api.getStormNightHazardMapping(1, hazardRect)
));
assert.equal(mappingAtOne.clouds.offsetX, -12);
assert.equal(mappingAtOne.clouds.offsetY, 0);
assert.equal(mappingAtOne.clouds.wrapDistance, 825);
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getStormNightHazardMapping(
    825 / 12,
    hazardRect
  ).clouds.destinations)),
  [
    {x: 235, y: 690, w: 825, h: 30},
    {x: 1060, y: 690, w: 825, h: 30}
  ]
);
assert.equal(fixture.api.drawBottomDeathHazard(
  fixture.recording.context,
  hazardRect,
  2
), true);

for (const failure of [
  {failedFile: hazardFiles[0]},
  {failedFile: hazardFiles[1]},
  {invalidFile: hazardFiles[0]},
  {invalidFile: hazardFiles[1]}
]) {
  const fallback = loadFixture(failure);
  assert.equal(fallback.api.isStormNightHazardReady(), false);
  fallback.recording.calls.length = 0;
  assert.equal(fallback.api.drawBottomDeathHazard(
    fallback.recording.context,
    hazardRect,
    1
  ), false);
  const fallbackCalls = drawAt(fallback, 1);
  assert.equal(fallbackCalls.some(call => call[0] === "drawImage"), false);
  assert.equal(fallbackCalls.some(call => call[0] === "fillRect"), true);
}

assert.equal(fixture.loadedPaths.some(assetPath => (
  assetPath.includes("/meadow/") ||
  assetPath.includes("/night/hazards/")
)), false);
assert.match(
  generatorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  physicsSource,
  /function getBottomDeathHazard[\s\S]*?isBottomDeathHazard === true[\s\S]*?function isPlayerTouchingBottomDeathHazard/
);
assert.match(
  hazardsSource,
  /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
);
const hazardFunctionStart = visualSource.indexOf(
  "  function getStormNightHazardMapping"
);
const hazardFunctionEnd = visualSource.indexOf(
  "  const stormNightVisuals",
  hazardFunctionStart
);
assert.ok(hazardFunctionStart >= 0 && hazardFunctionEnd > hazardFunctionStart);
const hazardFunctionSource = visualSource.slice(
  hazardFunctionStart,
  hazardFunctionEnd
);
assert.doesNotMatch(
  hazardFunctionSource,
  /Math\.random|Math\.sin|rain|particle|glow|lightning/i
);

console.log("Storm Night 2x cloud abyss hazard mapping, seamless drift and fallback tests passed.");
