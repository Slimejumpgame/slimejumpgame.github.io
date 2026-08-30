"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-neon-city-assets.js");
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const hazardDirectory = "assets/environments/neonCity/hazards";
const hazardFiles = Object.freeze([
  "neonCity_hazard_laser_base.png",
  "neonCity_hazard_laser_spiral.png"
]);
const hazardPaths = Object.freeze(hazardFiles.map(file => (
  `${hazardDirectory}/${file}`
)));
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const neonCityBiome = Object.freeze({
  id: "neonCity",
  hazard: Object.freeze({
    type: "abyss",
    fill: "#07091a",
    deep: "#010208",
    surface: "#24485e",
    accent: "#e14fc2"
  })
});

function decodeRgbaPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must retain RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") {
      chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const channels = 4;
  const packed = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  let packedOffset = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let visiblePixels = 0;
  let transparentPixels = 0;
  let partialAlphaPixels = 0;
  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    const current = Buffer.alloc(stride);
    for (let index = 0; index < stride; index++) {
      const left = index >= channels ? current[index - channels] : 0;
      const up = previous[index];
      const upperLeft = index >= channels ? previous[index - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      current[index] = (packed[packedOffset++] + predictor) & 0xff;
    }
    current.copy(pixels, y * stride);
    for (let x = 0; x < width; x++) {
      const alpha = current[x * channels + 3];
      if (alpha > 0) {
        visiblePixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else {
        transparentPixels++;
      }
      if (alpha > 0 && alpha < 255) partialAlphaPixels++;
    }
    previous = current;
  }
  return Object.freeze({
    width,
    height,
    pixels,
    bounds: Object.freeze({
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1
    }),
    visiblePixels,
    transparentPixels,
    partialAlphaPixels
  });
}

function findDominantHorizontalPeriod(decoded, minimum, maximum) {
  const scores = [];
  for (let shift = minimum; shift <= maximum; shift++) {
    let error = 0;
    let samples = 0;
    for (let y = 0; y < decoded.height; y++) {
      for (let x = 0; x < decoded.width - shift; x += 2) {
        const left = (y * decoded.width + x) * 4;
        const right = (y * decoded.width + x + shift) * 4;
        for (let channel = 0; channel < 4; channel++) {
          error += Math.abs(
            decoded.pixels[left + channel] - decoded.pixels[right + channel]
          );
          samples++;
        }
      }
    }
    scores.push({shift, error: error / samples});
  }
  scores.sort((left, right) => left.error - right.error);
  return scores[0].shift;
}

function circularShiftError(decoded, shift) {
  let error = 0;
  let samples = 0;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x += 2) {
      const otherX = (x + shift) % decoded.width;
      const left = (y * decoded.width + x) * 4;
      const right = (y * decoded.width + otherX) * 4;
      for (let channel = 0; channel < 4; channel++) {
        error += Math.abs(
          decoded.pixels[left + channel] - decoded.pixels[right + channel]
        );
        samples++;
      }
    }
  }
  return error / samples;
}

function adjacentColumnError(decoded) {
  let error = 0;
  let samples = 0;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width - 1; x++) {
      const left = (y * decoded.width + x) * 4;
      const right = left + 4;
      for (let channel = 0; channel < 4; channel++) {
        error += Math.abs(
          decoded.pixels[left + channel] - decoded.pixels[right + channel]
        );
        samples++;
      }
    }
  }
  return error / samples;
}

function findBestEdgeOverlap(decoded, minimum, maximum) {
  const scores = [];
  for (let overlap = minimum; overlap <= maximum; overlap++) {
    let error = 0;
    let samples = 0;
    for (let y = 0; y < decoded.height; y++) {
      for (let x = 0; x < overlap; x++) {
        const left = (y * decoded.width + decoded.width - overlap + x) * 4;
        const right = (y * decoded.width + x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          error += Math.abs(
            decoded.pixels[left + channel] - decoded.pixels[right + channel]
          );
          samples++;
        }
      }
    }
    scores.push({overlap, error: error / samples});
  }
  scores.sort((left, right) => left.error - right.error);
  return scores[0].overlap;
}

assert.deepEqual(
  fs.readdirSync(path.join(root, hazardDirectory)).sort(),
  [...hazardFiles].sort()
);
const decodedBase = decodeRgbaPng(hazardPaths[0]);
const decodedSpiral = decodeRgbaPng(hazardPaths[1]);
for (const decoded of [decodedBase, decodedSpiral]) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 1650, h: 60});
  assert.ok(decoded.visiblePixels > 0);
  assert.ok(decoded.transparentPixels > 0);
  assert.ok(decoded.partialAlphaPixels > 0);
}
assert.deepEqual(decodedBase.bounds, {x: 0, y: 0, w: 1650, h: 59});
assert.deepEqual(decodedSpiral.bounds, {x: 3, y: 0, w: 1647, h: 60});
assert.equal(findDominantHorizontalPeriod(decodedSpiral, 130, 170), 145);
assert.ok(
  circularShiftError(decodedSpiral, 145) >
    adjacentColumnError(decodedSpiral) * 3,
  "145 px shape period is not pixel-seamless enough for the final wrap"
);
assert.equal(findBestEdgeOverlap(decodedSpiral, 1, 200), 32);

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    closePath() { calls.push(["closePath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    clip() { calls.push(["clip"]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    stroke() { calls.push(["stroke"]); },
    fill() { calls.push(["fill"]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop(...stopArgs) { calls.push(["colorStop", ...stopArgs]); }
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
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      const isHazard = value.includes("/hazards/");
      this.complete = true;
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
    platformMarker: "generic-neon-city-platform-kit",
    drawPlatformBase() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "neonCity");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "neonCity");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Neon City hazard must remain deterministic");
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
    globalThis.neonCityHazardForTest = NEON_CITY_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "neon-city-hazard-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    platformVisuals,
    api: context.neonCityHazardForTest,
    drawDeathZone: context.drawDeathZoneForTest,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function drawAt(fixture, visualTime, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, neonCityBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
}

function hazardDraws(calls) {
  return calls.filter(call => (
    call[0] === "drawImage" && call[1].src.includes("/hazards/")
  ));
}

function lastSetBefore(calls, callIndex, property) {
  for (let index = callIndex - 1; index >= 0; index--) {
    if (calls[index][0] === "set" && calls[index][1] === property) {
      return calls[index][2];
    }
  }
  return undefined;
}

function closeTo(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/hazards/")),
  hazardPaths
);
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);

const status = JSON.parse(JSON.stringify(fixture.api.getNeonHazardStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, {
  base: hazardPaths[0],
  spiral: hazardPaths[1]
});
assert.deepEqual(status.contract, {
  native: {w: 1650, h: 60},
  runtime: {x: 235, y: 690, w: 825, h: 30},
  nativeToRuntimeScale: 0.5
});
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.deepEqual(status.animation, {
  drawOrder: ["laserBase", "spiral"],
  axisOffsetY: 15,
  spiral: {
    leftSpeed: 24,
    ySpeed: 0,
    alpha: 0.95,
    nativeWrapOverlap: 32,
    runtimeWrapOverlap: 16,
    wrapDistance: 809,
    drawCopies: 2,
    direction: "right-to-left",
    wrapMode: "horizontal-continuous-full-png",
    fullAsset: true,
    segmented: false,
    rotation: 0,
    compositeOperation: "screen"
  },
  laserPulse: {
    periodSeconds: 1.5,
    minimumAlpha: 0.55,
    maximumAlpha: 1,
    phase: 0.55,
    xMovement: 0,
    yMovement: 0,
    rotation: 0,
    compositeOperation: "source-over"
  },
  deterministic: true
});

const mappingAtZero = fixture.api.getNeonHazardMapping(0, hazardRect);
const mappingAtOne = fixture.api.getNeonHazardMapping(1, hazardRect);
const mappingAtTwo = fixture.api.getNeonHazardMapping(2, hazardRect);
const mappingAfterCycle = fixture.api.getNeonHazardMapping(809 / 24, hazardRect);
const laserPeakTime = (Math.PI / 2 - 0.55) / (Math.PI * 2) * 1.5;
const laserMinimumTime = (Math.PI * 3 / 2 - 0.55) / (Math.PI * 2) * 1.5;
closeTo(
  fixture.api.getNeonHazardMapping(laserPeakTime, hazardRect).base.alpha,
  1
);
closeTo(
  fixture.api.getNeonHazardMapping(laserMinimumTime, hazardRect).base.alpha,
  0.55
);
assert.equal(mappingAtZero.spiral.offsetX, 0);
assert.equal(mappingAtOne.spiral.offsetX, -24);
assert.equal(mappingAtTwo.spiral.offsetX, -48);
assert.equal(mappingAfterCycle.spiral.offsetX, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAfterCycle.spiral)),
  JSON.parse(JSON.stringify(mappingAtZero.spiral))
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.spiral.destinations)),
  [
    {x: 211, y: 690, w: 825, h: 30},
    {x: 1020, y: 690, w: 825, h: 30}
  ]
);
for (const mapping of [
  mappingAtZero,
  mappingAtOne,
  mappingAtTwo,
  mappingAfterCycle
]) {
  assert.equal(mapping.axisY, 705);
  assert.equal(mapping.base.offsetX, 0);
  assert.equal(mapping.base.offsetY, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(mapping.base.destination)),
    {x: 235, y: 690, w: 825, h: 30}
  );
  assert.equal(mapping.spiral.offsetY, 0);
  assert.equal(mapping.spiral.wrapDistance, 809);
  assert.equal(mapping.spiral.alpha, 0.95);
  assert.ok(mapping.spiral.offsetX <= 0 && mapping.spiral.offsetX > -809);
  assert.ok(mapping.base.alpha >= 0.55 && mapping.base.alpha <= 1);
  assert.ok(mapping.spiral.destinations.every(destination => (
    destination.y === 690 && destination.h === 30
  )));
  assert.equal("back" in mapping.spiral, false);
  assert.equal("front" in mapping.spiral, false);
  assert.equal("segments" in mapping.spiral, false);
}
assert.notEqual(mappingAtZero.base.alpha, mappingAtOne.base.alpha);
assert.equal(
  fixture.api.getNeonHazardMapping(1, {...hazardRect, w: 824}),
  null
);

const atZero = drawAt(fixture, 0);
const atOne = drawAt(fixture, 1);
const drawsAtZero = hazardDraws(atZero);
const drawsAtOne = hazardDraws(atOne);
assert.deepEqual(
  drawsAtZero.map(call => path.basename(call[1].src)),
  [
    hazardFiles[0],
    hazardFiles[1],
    hazardFiles[1]
  ]
);
for (const draw of drawsAtZero) {
  assert.deepEqual(draw.slice(2, 6), [0, 0, 1650, 60]);
  assert.equal(draw[7], 690);
  assert.equal(draw[8], 825);
  assert.equal(draw[9], 30);
}
assert.deepEqual(drawsAtZero[0].slice(6), [235, 690, 825, 30]);
assert.deepEqual(
  drawsAtZero.slice(1).map(draw => draw.slice(6)),
  [
    [235, 690, 825, 30],
    [1044, 690, 825, 30]
  ]
);
assert.deepEqual(
  drawsAtOne[0],
  drawsAtZero[0],
  "laser base destination must remain spatially static"
);
assert.notDeepEqual(
  drawsAtOne.slice(1).map(draw => draw[6]),
  drawsAtZero.slice(1).map(draw => draw[6])
);
const drawIndices = drawsAtZero.map(draw => atZero.indexOf(draw));
assert.ok(lastSetBefore(atZero, drawIndices[0], "globalAlpha") >= 0.55);
assert.equal(lastSetBefore(atZero, drawIndices[1], "globalAlpha"), 0.95);
assert.equal(lastSetBefore(
  atZero,
  drawIndices[0],
  "globalCompositeOperation"
), "source-over");
assert.equal(lastSetBefore(
  atZero,
  drawIndices[1],
  "globalCompositeOperation"
), "screen");
assert.ok(atZero.some(call => (
  call[0] === "rect" &&
  JSON.stringify(call.slice(1)) === JSON.stringify([235, 690, 825, 30])
)));
assert.deepEqual(
  atZero.filter(call => call[0] === "rect").map(call => call.slice(1)),
  [[235, 690, 825, 30]],
  "no segmented front/back masks may be created"
);
assert.equal(atZero.filter(call => call[0] === "clip").length, 1);
assert.equal(atZero.some(call => call[0] === "rotate"), false);
assert.equal(atZero.some(call => call[0] === "fillRect"), false);
assert.equal(atZero.some(call => call[0] === "stroke"), false);

for (const hazardFile of hazardFiles) {
  for (const failure of [
    {failedFile: hazardFile},
    {invalidFile: hazardFile}
  ]) {
    const fallback = loadFixture(failure);
    const calls = drawAt(fallback, 1);
    assert.equal(fallback.api.isNeonHazardReady(), false);
    assert.equal(hazardDraws(calls).length, 0);
    assert.ok(calls.some(call => call[0] === "fillRect"));
    assert.ok(calls.some(call => call[0] === "stroke"));
  }
}
assert.ok(drawAt(fixture, 1, null).some(call => call[0] === "fillRect"));
assert.ok(drawAt(fixture, 1, {}).some(call => call[0] === "fillRect"));
assert.equal(fixture.api.drawBottomDeathHazard(null, hazardRect, 0), false);
assert.equal(fixture.api.drawBottomDeathHazard(
  fixture.recording.context,
  {...hazardRect, y: 689},
  0
), false);

assert.match(
  rendererSource,
  /for \(const s of level\.spikes\) drawDeathZone\(s, biome, platformVisuals\);/
);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)/
);
assert.match(
  hazardsSource,
  /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
);
assert.match(
  read("js/level-generator.js"),
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  read("js/physics.js"),
  /return \{x: spike\.x \+ 5, y: spike\.y \+ 5, w: spike\.w - 10, h: spike\.h \+ 22\};/
);
assert.doesNotMatch(visualSource, /Math\.random\s*\(/);

console.log("Neon City pulsing fixed laser, continuous full-PNG spiral wrap and safe fallback tests passed.");
