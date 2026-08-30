"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-neon-city-assets.js");
const rendererSource = read("js/renderer.js");
const biomesSource = read("js/biomes.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/neonCity/background";
const backgroundFiles = Object.freeze([
  "neonCity_background_skybox.png",
  "neonCity_background_city_back.png",
  "neonCity_background_clouds.png",
  "neonCity_background_city_front.png"
]);
const backgroundPaths = Object.freeze(backgroundFiles.map(file => (
  `${backgroundDirectory}/${file}`
)));

function decodePng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8, `${relativePath} must use 8-bit channels`);
  assert.ok(colorType === 2 || colorType === 6, `${relativePath} must be RGB/RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);

  const channels = colorType === 6 ? 4 : 3;
  const idatChunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idatChunks));
  const sourceStride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(sourceStride);
  let packedOffset = 0;
  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  let hasTransparentPixels = false;
  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    const current = Buffer.alloc(sourceStride);
    for (let x = 0; x < sourceStride; x++) {
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
      const sourceOffset = x * channels;
      const targetOffset = (y * width + x) * 4;
      pixels[targetOffset] = current[sourceOffset];
      pixels[targetOffset + 1] = current[sourceOffset + 1];
      pixels[targetOffset + 2] = current[sourceOffset + 2];
      pixels[targetOffset + 3] = channels === 4
        ? current[sourceOffset + 3]
        : 255;
      if (pixels[targetOffset + 3] < 255) hasTransparentPixels = true;
    }
    previous = current;
  }
  return Object.freeze({
    width,
    height,
    colorType,
    pixels,
    hasTransparentPixels
  });
}

function hasNeonPixelNear(decoded, glow) {
  const minX = Math.max(0, Math.floor(glow.x - glow.radiusX));
  const maxX = Math.min(decoded.width - 1, Math.ceil(glow.x + glow.radiusX));
  const minY = Math.max(0, Math.floor(glow.y - glow.radiusY));
  const maxY = Math.min(decoded.height - 1, Math.ceil(glow.y + glow.radiusY));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const offset = (y * decoded.width + x) * 4;
      const red = decoded.pixels[offset];
      const green = decoded.pixels[offset + 1];
      const blue = decoded.pixels[offset + 2];
      const alpha = decoded.pixels[offset + 3];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (alpha > 32 && maximum >= 150 && maximum - minimum >= 45) return true;
    }
  }
  return false;
}

function inspectAlpha(decoded) {
  const visibleColumns = new Uint8Array(decoded.width);
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      const alpha = decoded.pixels[(y * decoded.width + x) * 4 + 3];
      if (alpha === 0) continue;
      visibleColumns[x] = 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  let currentGap = 0;
  let maxInternalTransparentColumnGap = 0;
  for (let x = minX; x <= maxX; x++) {
    if (visibleColumns[x]) {
      currentGap = 0;
    } else {
      currentGap++;
      maxInternalTransparentColumnGap = Math.max(
        maxInternalTransparentColumnGap,
        currentGap
      );
    }
  }
  return Object.freeze({
    alphaBounds: Object.freeze({
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1
    }),
    transparentMargins: Object.freeze({
      left: minX,
      right: decoded.width - 1 - maxX,
      top: minY,
      bottom: decoded.height - 1 - maxY
    }),
    maxInternalTransparentColumnGap
  });
}

assert.deepEqual(
  fs.readdirSync(path.join(root, backgroundDirectory)).sort(),
  [...backgroundFiles].sort(),
  "Neon City background folder must contain the four exact layer filenames"
);
const decodedAssets = backgroundPaths.map(decodePng);
for (const decoded of decodedAssets) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 1280, h: 720});
}
assert.equal(decodedAssets[0].colorType, 2, "skybox must be RGB PNG");
for (const decoded of decodedAssets.slice(1)) {
  assert.equal(decoded.colorType, 6, "city/cloud layers must be RGBA PNGs");
  assert.equal(decoded.hasTransparentPixels, true);
}
const cloudInspection = inspectAlpha(decodedAssets[2]);
assert.deepEqual(cloudInspection, {
  alphaBounds: {x: 119, y: 29, w: 1082, h: 553},
  transparentMargins: {left: 119, right: 79, top: 29, bottom: 138},
  maxInternalTransparentColumnGap: 12
});

function createRecordingContext() {
  const calls = [];
  let gradientIndex = 0;
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    scale(...args) { calls.push(["scale", ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    fill() { calls.push(["fill"]); },
    createRadialGradient(...args) {
      const id = gradientIndex++;
      calls.push(["createRadialGradient", id, ...args]);
      return {
        addColorStop(...stopArgs) {
          calls.push(["radialColorStop", id, ...stopArgs]);
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
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
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
    throw new Error("Neon City background must remain deterministic");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.neonCityBackgroundForTest = NEON_CITY_ASSET_VISUALS;
  `, context, {filename: "neon-city-background-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.neonCityBackgroundForTest,
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

function drawForFile(capture, file) {
  const draws = drawsForFile(capture, file);
  assert.equal(draws.length, 1, `${file} must be drawn exactly once`);
  return draws[0];
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
  cityBack: backgroundPaths[1],
  clouds: backgroundPaths[2],
  cityFront: backgroundPaths[3]
});
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.deepEqual(status.layerOrder, [
  "skybox",
  "cityBack",
  "backWindowGlows",
  "clouds",
  "cityFront",
  "frontWindowGlows",
  "frontNeonFlicker"
]);
assert.deepEqual(status.cloudsAsset, cloudInspection);
assert.deepEqual(status.cloudsAnimation, {
  leftSpeed: 6,
  ySpeed: 0,
  direction: "right-to-left",
  motion: "linear",
  wrapDistance: 1094,
  overlap: 186,
  drawCopies: 2,
  wrapMode: "horizontal-continuous"
});
assert.equal(
  status.cloudsAnimation.overlap,
  cloudInspection.transparentMargins.left +
    cloudInspection.transparentMargins.right -
    cloudInspection.maxInternalTransparentColumnGap
);
assert.equal(status.glowAnimation.backCount, 14);
assert.equal(status.glowAnimation.frontCount, 13);
assert.equal(status.glowAnimation.totalCount, 27);
assert.equal(status.glowAnimation.compositeOperation, "screen");
assert.equal(status.glowAnimation.deterministic, true);
assert.equal(status.glowAnimation.innerColorStopPosition, 0.24);
assert.equal(status.glowAnimation.innerColorStopAlphaFactor, 0.88);
assert.equal(status.glowAnimation.middleColorStopPosition, 0.68);
assert.equal(status.glowAnimation.middleColorStopAlphaFactor, 0.46);
assert.deepEqual(status.glowAnimation.periodRangeSeconds, [4.5, 6.5]);
assert.deepEqual(status.glowAnimation.pulseMinimumFactorRange, [0.16, 0.32]);
assert.deepEqual(status.glowAnimation.profiles, {
  back: {
    strengthRange: [0.22, 0.34],
    periodRangeSeconds: [5.2, 6.5],
    pulseMinimumFactorRange: [0.2, 0.32]
  },
  front: {
    strengthRange: [0.46, 0.58],
    periodRangeSeconds: [4.5, 5.8],
    pulseMinimumFactorRange: [0.16, 0.26]
  }
});

const backGlows = status.backWindowGlows;
const frontGlows = status.frontWindowGlows;
const allGlows = [...backGlows, ...frontGlows];
assert.ok(allGlows.every(glow => (
  glow.x >= 0 && glow.x <= 1280 &&
  glow.y >= 0 && glow.y <= 720 &&
  glow.period >= 4.5 && glow.period <= 6.5 &&
  glow.minimumFactor >= 0.16 && glow.minimumFactor <= 0.32
)));
assert.ok(new Set(allGlows.map(glow => glow.phase)).size >= 20);
assert.ok(Math.max(...backGlows.map(glow => glow.strength)) <
  Math.min(...frontGlows.map(glow => glow.strength)));
const averageArea = glows => glows.reduce((sum, glow) => (
  sum + glow.radiusX * glow.radiusY
), 0) / glows.length;
assert.ok(averageArea(frontGlows) > averageArea(backGlows));
assert.ok(backGlows.every(glow => hasNeonPixelNear(decodedAssets[1], glow)));
assert.ok(frontGlows.every(glow => hasNeonPixelNear(decodedAssets[3], glow)));

const backAtZero = JSON.parse(JSON.stringify(visuals.getBackWindowGlowMapping(0)));
const backAtOne = JSON.parse(JSON.stringify(visuals.getBackWindowGlowMapping(1)));
const frontAtZero = JSON.parse(JSON.stringify(visuals.getFrontWindowGlowMapping(0)));
assert.deepEqual(
  JSON.parse(JSON.stringify(visuals.getBackWindowGlowMapping(0))),
  backAtZero,
  "equal times must produce equal glow mappings"
);
assert.ok(backAtZero.some((glow, index) => glow.alpha !== backAtOne[index].alpha));
for (const glow of [...backAtZero, ...frontAtZero]) {
  assert.ok(glow.alpha >= glow.strength * glow.minimumFactor - 1e-12);
  assert.ok(glow.alpha <= glow.strength + 1e-12);
}

assert.equal(status.flickerAnimation.count, 12);
assert.equal(status.flickerAnimation.deterministic, true);
assert.deepEqual(status.flickerAnimation.gapRangeSeconds, [1.8, 6.5]);
assert.deepEqual(status.flickerAnimation.durationRangeSeconds, [0.045, 0.12]);
assert.deepEqual(status.flickerAnimation.dipCountRange, [1, 3]);
assert.deepEqual(status.flickerAnimation.peakDipDepthRange, [0.72, 0.95]);
assert.deepEqual(status.flickerAnimation.strengthRange, [0.66, 0.78]);
assert.equal(status.flickerAnimation.eventsPerZone, 8);
assert.equal(status.flickerAnimation.behavior, "normally-bright-short-local-dips");
assert.equal(status.flickerAnimation.drawOrder, "after-front-window-glows");
assert.equal(status.flickerZones.length, 12);
assert.ok(status.flickerZones.every(zone => (
  zone.x >= 0 && zone.x <= 1280 &&
  zone.y >= 0 && zone.y <= 720 &&
  zone.strength >= 0.66 && zone.strength <= 0.78 &&
  hasNeonPixelNear(decodedAssets[3], zone)
)));

for (const schedule of status.flickerAnimation.schedules) {
  assert.equal(schedule.events.length, 8);
  let previousEnd = 0;
  for (const event of schedule.events) {
    const gap = event.start - previousEnd;
    assert.ok(gap >= 1.8 - 1e-12 && gap <= 6.5 + 1e-12);
    assert.ok(event.duration >= 0.045 && event.duration <= 0.120);
    assert.ok(event.dipCount >= 1 && event.dipCount <= 3);
    assert.ok(event.dipDepth >= 0.72 && event.dipDepth <= 0.95);
    previousEnd = event.start + event.duration;
  }
  const trailingGap = schedule.cycleDuration - previousEnd;
  assert.ok(trailingGap >= 1.8 - 1e-12 && trailingGap <= 6.5 + 1e-12);
}
assert.ok(new Set(status.flickerAnimation.schedules.map(
  schedule => schedule.cycleDuration
)).size > 1);
const idleAtZero = JSON.parse(JSON.stringify(visuals.getFlickerMapping(0)));
const idleAtOne = JSON.parse(JSON.stringify(visuals.getFlickerMapping(1)));
assert.ok(idleAtZero.every(zone => (
  zone.active === false &&
  zone.brightnessFactor === 1 &&
  zone.alpha === zone.strength
)));
assert.ok(idleAtOne.every(zone => (
  zone.active === false &&
  zone.brightnessFactor === 1 &&
  zone.alpha === zone.strength
)));
const firstFlickerEvent = status.flickerAnimation.schedules[0].events[0];
const firstDipTime = firstFlickerEvent.start +
  firstFlickerEvent.duration / (2 * firstFlickerEvent.dipCount);
const flickerAtDip = JSON.parse(JSON.stringify(
  visuals.getFlickerMapping(firstDipTime)
));
assert.equal(flickerAtDip[0].active, true);
assert.ok(flickerAtDip[0].brightnessFactor >= 0.05);
assert.ok(flickerAtDip[0].brightnessFactor <= 0.28);
assert.ok(flickerAtDip[0].alpha < flickerAtDip[0].strength);
assert.ok(flickerAtDip.filter(zone => zone.active).length < status.flickerZones.length);
assert.deepEqual(
  JSON.parse(JSON.stringify(visuals.getFlickerMapping(firstDipTime))),
  flickerAtDip,
  "flicker timing must be deterministic"
);

const atZero = captureBackground(fixture, 0);
const atOne = captureBackground(fixture, 1);
const atTwo = captureBackground(fixture, 2);
const later = captureBackground(fixture, 73.25);
assert.equal(atZero.drawn, true);
assert.equal(later.drawn, true);
assert.deepEqual(
  imageDraws(atZero).map(call => path.basename(call[1].src)),
  [
    backgroundFiles[0],
    backgroundFiles[1],
    backgroundFiles[2],
    backgroundFiles[2],
    backgroundFiles[3]
  ]
);
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
}
for (const staticFile of [backgroundFiles[0], backgroundFiles[1], backgroundFiles[3]]) {
  assert.deepEqual(
    drawForFile(later, staticFile),
    drawForFile(atZero, staticFile),
    `${staticFile} must stay spatially static`
  );
  assert.deepEqual(drawForFile(atZero, staticFile).slice(6), [0, 0, 1280, 720]);
}
assert.deepEqual(
  drawsForFile(atZero, backgroundFiles[2]).map(call => call.slice(6)),
  [
    [0, 0, 1280, 720],
    [1094, 0, 1280, 720]
  ]
);
const backgroundMapping = visuals.getBackgroundMapping(1280, 720);
const cloudsAtZero = visuals.getCloudsMapping(0, backgroundMapping);
const cloudsAtOne = visuals.getCloudsMapping(1, backgroundMapping);
const cloudsAtTwo = visuals.getCloudsMapping(2, backgroundMapping);
const cloudsAfterOneCycle = visuals.getCloudsMapping(1094 / 6, backgroundMapping);
assert.equal(cloudsAtZero.offsetX, 0);
assert.equal(cloudsAtOne.offsetX, -6);
assert.equal(cloudsAtTwo.offsetX, -12);
assert.equal(cloudsAtOne.offsetY, 0);
assert.equal(cloudsAtOne.wrapDistance, 1094);
assert.deepEqual(
  JSON.parse(JSON.stringify(cloudsAtOne.destinations)),
  [
    {x: -6, y: 0, w: 1280, h: 720},
    {x: 1088, y: 0, w: 1280, h: 720}
  ]
);
assert.equal(cloudsAfterOneCycle.offsetX, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(cloudsAfterOneCycle.destinations)),
  JSON.parse(JSON.stringify(cloudsAtZero.destinations))
);
assert.deepEqual(
  drawsForFile(atOne, backgroundFiles[2]).map(call => call.slice(6)),
  [
    [-6, 0, 1280, 720],
    [1088, 0, 1280, 720]
  ]
);
assert.ok(cloudsAtTwo.offsetX < cloudsAtOne.offsetX);
const backDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" && path.basename(call[1].src) === backgroundFiles[1]
));
const firstCloudDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" && path.basename(call[1].src) === backgroundFiles[2]
));
const frontDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" && path.basename(call[1].src) === backgroundFiles[3]
));
const glowIndices = atZero.calls.map((call, index) => (
  call[0] === "createRadialGradient" ? index : -1
)).filter(index => index >= 0);
assert.equal(glowIndices.length, 14 + 13 + 12);
assert.equal(glowIndices.filter(index => (
  index > backDrawIndex && index < firstCloudDrawIndex
)).length, 14);
assert.ok(firstCloudDrawIndex < frontDrawIndex);
assert.equal(glowIndices.filter(index => index > frontDrawIndex).length, 13 + 12);
assert.ok(atZero.calls.some(call => (
  call[0] === "set" &&
  call[1] === "globalCompositeOperation" &&
  call[2] === "screen"
)));

const scaled = captureBackground(fixture, 0, 640, 360);
for (const staticFile of [backgroundFiles[0], backgroundFiles[1], backgroundFiles[3]]) {
  assert.deepEqual(drawForFile(scaled, staticFile).slice(6), [0, 0, 640, 360]);
}
assert.deepEqual(
  drawsForFile(scaled, backgroundFiles[2]).map(call => call.slice(6)),
  [
    [0, 0, 640, 360],
    [547, 0, 640, 360]
  ]
);
assert.ok(scaled.calls.some(call => (
  call[0] === "scale" && call[1] === 0.5 && call[2] === 0.5
)));

for (const backgroundFile of backgroundFiles) {
  for (const failure of [
    {failedFile: backgroundFile},
    {invalidFile: backgroundFile}
  ]) {
    const failed = loadFixture(failure);
    const capture = captureBackground(failed);
    assert.equal(failed.api.isBackgroundReady(), false);
    assert.equal(capture.drawn, false);
    assert.equal(imageDraws(capture).length, 0);
  }
}
assert.equal(visuals.drawBackground(fixture.recording.context, 0, 720), false);
assert.equal(visuals.drawBackground(null, 1280, 720), false);

assert.doesNotMatch(visualSource, /Math\.random\s*\(/);
assert.doesNotMatch(visualSource, /rain/i);
assert.match(visualSource, /function drawBottomDeathHazard\(/);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.resolve\("neonCity"\)/);
assert.match(
  visualSource,
  /BIOME_PLATFORM_VISUALS\.register\("neonCity", neonCityVisuals\)/
);
assert.match(biomesSource, /function drawNeonCityBackground\(biome\)/);
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\)[\s\S]*?drawBackground\(biome\);[\s\S]*?drawPlatforms\(/
);
const neonScriptMatches = indexSource.match(
  /\.\/js\/visual-neon-city-assets\.js/g
) || [];
assert.equal(neonScriptMatches.length, 1);
const neonScriptIndex = indexSource.indexOf("./js/visual-neon-city-assets.js");
const rendererScriptIndex = indexSource.indexOf("./js/renderer.js");
assert.ok(neonScriptIndex >= 0);
assert.ok(neonScriptIndex < rendererScriptIndex);

console.log("Neon City continuous clouds, static city layers, local glows and deterministic flicker tests passed.");
