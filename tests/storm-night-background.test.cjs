"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-storm-night-assets.js");
const rendererSource = read("js/renderer.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/stormNight/background";
const backgroundFiles = Object.freeze([
  "stormNight_background_skybox.png",
  "stormNight_background_clouds_back.png",
  "stormNight_background_moon.png",
  "stormNight_lightning_01.png",
  "stormNight_lightning_02.png",
  "stormNight_lightning_03.png",
  "stormNight_background_clouds_front.png"
]);
const backgroundPaths = backgroundFiles.map(file => (
  `${backgroundDirectory}/${file}`
));
const lightningFiles = backgroundFiles.slice(3, 6);

function inspectPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8, `${relativePath} must use 8-bit channels`);
  assert.ok(colorType === 2 || colorType === 6);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);
  if (colorType === 2) {
    return Object.freeze({
      width,
      height,
      colorType,
      hasVisiblePixels: true,
      hasTransparentPixels: false,
      horizontalMargins: Object.freeze({left: 0, right: 0}),
      maxInternalTransparentColumns: 0
    });
  }

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
  const visibleColumns = new Uint8Array(width);
  let previous = Buffer.alloc(stride);
  let packedOffset = 0;
  let hasVisiblePixels = false;
  let hasTransparentPixels = false;
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
        hasVisiblePixels = true;
        visibleColumns[x] = 1;
      }
      if (alpha < 255) hasTransparentPixels = true;
    }
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
    horizontalMargins: Object.freeze({
      left: firstVisible,
      right: width - 1 - lastVisible
    }),
    maxInternalTransparentColumns: largestRun
  });
}

const inspectedAssets = Object.fromEntries(backgroundPaths.map(relativePath => (
  [relativePath, inspectPng(relativePath)]
)));
for (const [relativePath, inspected] of Object.entries(inspectedAssets)) {
  assert.deepEqual(
    {w: inspected.width, h: inspected.height},
    {w: 1280, h: 720},
    `${relativePath} must use the native Storm Night background size`
  );
  assert.equal(inspected.hasVisiblePixels, true);
}
assert.equal(inspectedAssets[backgroundPaths[0]].colorType, 2);
for (const relativePath of backgroundPaths.slice(1)) {
  assert.equal(inspectedAssets[relativePath].colorType, 6);
  assert.equal(inspectedAssets[relativePath].hasTransparentPixels, true);
}
const backCloudInspection = inspectedAssets[backgroundPaths[1]];
const frontCloudInspection = inspectedAssets[backgroundPaths[6]];
assert.deepEqual(backCloudInspection.horizontalMargins, {left: 11, right: 12});
assert.equal(backCloudInspection.maxInternalTransparentColumns, 3);
assert.deepEqual(frontCloudInspection.horizontalMargins, {left: 114, right: 85});
assert.equal(frontCloudInspection.maxInternalTransparentColumns, 16);

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
      this.complete = true;
      const isHazard = value.includes("/hazards/");
      this.naturalWidth = isHazard ? 1650 : file === invalidFile ? 1279 : 1280;
      this.naturalHeight = isHazard ? 60 : 720;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "generic-storm-night-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "stormNight");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "stormNight");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Storm Night background rendering must remain deterministic");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.stormNightBackgroundForTest = STORM_NIGHT_ASSET_VISUALS;
  `, context, {filename: "storm-night-background-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.stormNightBackgroundForTest,
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
  cloudsBack: backgroundPaths[1],
  moon: backgroundPaths[2],
  lightning01: backgroundPaths[3],
  lightning02: backgroundPaths[4],
  lightning03: backgroundPaths[5],
  cloudsFront: backgroundPaths[6]
});
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, [
  "skybox",
  "cloudsBack",
  "moon",
  "cloudsFront"
]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(status.cloudAnimation, {
  back: {
    leftSpeed: 6,
    ySpeed: 0,
    wrapDistance: 1260,
    overlap: 20,
    drawCopies: 2
  },
  front: {
    leftSpeed: 12,
    ySpeed: 0,
    wrapDistance: 1097,
    overlap: 183,
    drawCopies: 2
  },
  direction: "right-to-left",
  wrapMode: "horizontal-continuous"
});
assert.equal(
  status.cloudAnimation.back.overlap,
  backCloudInspection.horizontalMargins.left +
    backCloudInspection.horizontalMargins.right -
    backCloudInspection.maxInternalTransparentColumns
);
assert.equal(
  status.cloudAnimation.front.overlap,
  frontCloudInspection.horizontalMargins.left +
    frontCloudInspection.horizontalMargins.right -
    frontCloudInspection.maxInternalTransparentColumns
);
assert.ok(
  status.cloudAnimation.front.leftSpeed > status.cloudAnimation.back.leftSpeed
);

const lightningStatus = status.lightningAnimation;
assert.equal(lightningStatus.deterministic, true);
assert.equal(lightningStatus.eventCount, 12);
assert.equal(lightningStatus.spriteCount, 3);
assert.deepEqual(lightningStatus.gapRangeSeconds, [2.5, 7.5]);
assert.deepEqual(lightningStatus.primaryDurationRangeSeconds, [0.07, 0.13]);
assert.deepEqual(lightningStatus.secondaryDelayRangeSeconds, [0.06, 0.15]);
assert.deepEqual(lightningStatus.secondaryDurationRangeSeconds, [0.045, 0.075]);
assert.deepEqual(lightningStatus.placement, {
  xOffset: 0,
  yOffset: 48,
  unit: "reference-pixels"
});
assert.equal(lightningStatus.drawOrder, "after-moon-before-clouds-front");
assert.equal(lightningStatus.globalFlash, false);
assert.equal(lightningStatus.events.length, 12);
assert.ok(lightningStatus.events.every(event => (
  event.gap >= 2.5 &&
  event.gap <= 7.5 &&
  event.primaryDuration >= 0.07 &&
  event.primaryDuration <= 0.13
)));
const secondaryEvents = lightningStatus.events.filter(event => event.hasSecondary);
assert.ok(secondaryEvents.length > 0);
assert.ok(secondaryEvents.length < lightningStatus.events.length);
assert.ok(secondaryEvents.every(event => (
  event.secondaryDelay >= 0.06 &&
  event.secondaryDelay <= 0.15 &&
  event.secondaryDuration >= 0.045 &&
  event.secondaryDuration <= 0.075 &&
  event.secondaryPeak < event.primaryPeak
)));
for (let index = 0; index < lightningStatus.events.length; index += 3) {
  assert.deepEqual(
    [...new Set(lightningStatus.events.slice(index, index + 3).map(
      event => event.spriteIndex
    ))].sort(),
    [0, 1, 2]
  );
}

const atZero = captureBackground(fixture, 0);
assert.equal(atZero.drawn, true);
assert.deepEqual(
  imageDraws(atZero).map(call => path.basename(call[1].src)),
  [
    backgroundFiles[0],
    backgroundFiles[1],
    backgroundFiles[1],
    backgroundFiles[2],
    backgroundFiles[6],
    backgroundFiles[6]
  ]
);
assert.deepEqual(JSON.parse(JSON.stringify(visuals.getLightningState(0))), {
  visible: false,
  phase: "idle",
  alpha: 0,
  spriteIndex: null,
  asset: null,
  eventIndex: null,
  cycleTime: 0
});
for (const call of imageDraws(atZero)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}

const mapping = visuals.getBackgroundMapping(1280, 720);
const backAtOne = visuals.getCloudsBackMapping(1, mapping);
const backAtTwo = visuals.getCloudsBackMapping(2, mapping);
const frontAtOne = visuals.getCloudsFrontMapping(1, mapping);
const frontAtTwo = visuals.getCloudsFrontMapping(2, mapping);
assert.equal(backAtOne.offsetX, -6);
assert.equal(backAtTwo.offsetX, -12);
assert.equal(backAtOne.offsetY, 0);
assert.equal(backAtOne.wrapDistance, 1260);
assert.deepEqual(
  [...backAtOne.destinations].map(destination => destination.x),
  [-6, 1254]
);
assert.equal(frontAtOne.offsetX, -12);
assert.equal(frontAtTwo.offsetX, -24);
assert.equal(frontAtOne.offsetY, 0);
assert.equal(frontAtOne.wrapDistance, 1097);
assert.deepEqual(
  [...frontAtOne.destinations].map(destination => destination.x),
  [-12, 1085]
);
const quietLater = captureBackground(fixture, 1);
assert.deepEqual(
  drawForFile(atZero, backgroundFiles[0]),
  drawForFile(quietLater, backgroundFiles[0])
);
assert.deepEqual(
  drawForFile(atZero, backgroundFiles[2]),
  drawForFile(quietLater, backgroundFiles[2])
);
assert.ok(drawsForFile(quietLater, backgroundFiles[1]).every(call => call[7] === 0));
assert.ok(drawsForFile(quietLater, backgroundFiles[6]).every(call => call[7] === 0));

const firstEvent = lightningStatus.events[0];
const primaryTime = firstEvent.start + lightningStatus.attackSeconds;
const primaryState = JSON.parse(JSON.stringify(visuals.getLightningState(primaryTime)));
assert.equal(primaryState.visible, true);
assert.equal(primaryState.phase, "primary");
assert.equal(primaryState.spriteIndex, firstEvent.spriteIndex);
assert.ok(primaryState.alpha > 0.85 && primaryState.alpha <= 1);
assert.deepEqual(
  JSON.parse(JSON.stringify(visuals.getLightningState(primaryTime))),
  primaryState,
  "Lightning selection and alpha must be deterministic for equal time"
);
const selectedLightningFile = lightningFiles[primaryState.spriteIndex];
const primaryCapture = captureBackground(fixture, primaryTime);
assert.deepEqual(
  imageDraws(primaryCapture).map(call => path.basename(call[1].src)),
  [
    backgroundFiles[0],
    backgroundFiles[1],
    backgroundFiles[1],
    backgroundFiles[2],
    selectedLightningFile,
    backgroundFiles[6],
    backgroundFiles[6]
  ]
);
assert.equal(
  imageDraws(primaryCapture).filter(call => lightningFiles.includes(
    path.basename(call[1].src)
  )).length,
  1
);
const moonIndex = primaryCapture.calls.findIndex(call => (
  call[0] === "drawImage" && path.basename(call[1].src) === backgroundFiles[2]
));
const lightningIndex = primaryCapture.calls.findIndex(call => (
  call[0] === "drawImage" && lightningFiles.includes(path.basename(call[1].src))
));
const frontIndex = primaryCapture.calls.findIndex(call => (
  call[0] === "drawImage" && path.basename(call[1].src) === backgroundFiles[6]
));
assert.ok(moonIndex < lightningIndex && lightningIndex < frontIndex);
assert.ok(primaryCapture.calls.some(call => (
  call[0] === "set" && call[1] === "globalAlpha" && call[2] === primaryState.alpha
)));
for (let spriteIndex = 0; spriteIndex < lightningFiles.length; spriteIndex++) {
  const spriteEvent = lightningStatus.events.find(event => (
    event.spriteIndex === spriteIndex
  ));
  const spriteCapture = captureBackground(
    fixture,
    spriteEvent.start + lightningStatus.attackSeconds
  );
  const spriteDraw = drawForFile(spriteCapture, lightningFiles[spriteIndex]);
  assert.deepEqual(spriteDraw.slice(2, 6), [0, 0, 1280, 720]);
  assert.deepEqual(spriteDraw.slice(6), [0, 48, 1280, 720]);
}
const scaledLightningCapture = captureBackground(
  fixture,
  primaryTime,
  640,
  360
);
assert.deepEqual(
  drawForFile(scaledLightningCapture, selectedLightningFile).slice(6),
  [0, 24, 640, 360]
);

const secondaryEvent = secondaryEvents[0];
const secondaryTime = secondaryEvent.secondaryStart + lightningStatus.attackSeconds;
const secondaryState = JSON.parse(JSON.stringify(
  visuals.getLightningState(secondaryTime)
));
assert.equal(secondaryState.visible, true);
assert.equal(secondaryState.phase, "secondary");
assert.ok(secondaryState.alpha < secondaryEvent.primaryPeak);
for (const event of lightningStatus.events) {
  const quietTime = event.start - event.gap / 2;
  assert.equal(visuals.getLightningState(quietTime).visible, false);
}

for (const essentialFile of [
  backgroundFiles[0],
  backgroundFiles[1],
  backgroundFiles[2],
  backgroundFiles[6]
]) {
  for (const failure of [
    {failedFile: essentialFile},
    {invalidFile: essentialFile}
  ]) {
    const failed = loadFixture(failure);
    assert.equal(failed.api.isBackgroundReady(), false);
    assert.equal(captureBackground(failed).drawn, false);
  }
}
const missingSelectedLightning = loadFixture({failedFile: selectedLightningFile});
const missingLightningCapture = captureBackground(
  missingSelectedLightning,
  primaryTime
);
assert.equal(missingLightningCapture.drawn, true);
assert.equal(imageDraws(missingLightningCapture).some(call => (
  lightningFiles.includes(path.basename(call[1].src))
)), false);

assert.equal(visuals.drawBackground(fixture.recording.context, 0, 720), false);
assert.equal(visuals.drawBackground(null, 1280, 720), false);
assert.equal(lightningFiles.length, 3);
assert.doesNotMatch(visualSource, /Math\.random\s*\(|Math\.sin\s*\(/);
assert.doesNotMatch(visualSource, /rain/i);
assert.match(
  visualSource,
  /BIOME_PLATFORM_VISUALS\.resolve\("stormNight"\)/
);
assert.match(
  visualSource,
  /BIOME_PLATFORM_VISUALS\.register\("stormNight", stormNightVisuals\)/
);
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\)[\s\S]*?drawBackground\(biome\);[\s\S]*?drawPlatforms\(/
);
const stormScriptIndex = indexSource.indexOf("./js/visual-storm-night-assets.js");
const rendererScriptIndex = indexSource.indexOf("./js/renderer.js");
assert.ok(stormScriptIndex >= 0);
assert.ok(stormScriptIndex < rendererScriptIndex);

console.log("Storm Night five-stage background, continuous clouds and deterministic PNG lightning tests passed.");
