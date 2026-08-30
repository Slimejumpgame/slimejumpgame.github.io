"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-bamboo-night-assets.js");
const rendererSource = read("js/renderer.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/bambooNight/background";
const backgroundPaths = Object.freeze({
  skybox: `${backgroundDirectory}/bambooNight_background_skybox.png`,
  moon: `${backgroundDirectory}/bambooNight_background_moon.png`,
  fogBack: `${backgroundDirectory}/bambooNight_background_fog_back.png`,
  bambooBack: `${backgroundDirectory}/bambooNight_background_bamboo_back.png`,
  fogFront: `${backgroundDirectory}/bambooNight_background_fog_front.png`,
  bambooFront: `${backgroundDirectory}/bambooNight_background_bamboo_front.png`
});
const hazardPath =
  "assets/environments/bambooNight/hazards/bamboo_hazard_main.png";
const backgroundSize = Object.freeze({w: 1280, h: 720});
const hazardSize = Object.freeze({w: 1650, h: 60});
const expectedBackgroundFiles = Object.values(backgroundPaths).map(file => (
  path.posix.basename(file)
)).sort();
assert.deepEqual(
  fs.readdirSync(path.join(root, backgroundDirectory)).sort(),
  expectedBackgroundFiles,
  "only the six requested Bamboo Night background roles should be present"
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
    if (type === "IDAT") {
      idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const alpha = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
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
      alpha[y * width + x] = channels === 4
        ? current[x * channels + 3]
        : 255;
    }
    previous = current;
  }
  return Object.freeze({width, height, colorType, alpha});
}

function getAlphaUsage(decoded) {
  let hasVisiblePixels = false;
  let hasTransparentPixels = false;
  for (const alpha of decoded.alpha) {
    if (alpha > 0) hasVisiblePixels = true;
    if (alpha < 255) hasTransparentPixels = true;
    if (hasVisiblePixels && hasTransparentPixels) break;
  }
  return {hasVisiblePixels, hasTransparentPixels};
}

function getRightSoftEdgeWidth(decoded, maximumAlpha) {
  let width = 0;
  for (let x = decoded.width - 1; x >= 0; x--) {
    let columnMaximum = 0;
    for (let y = 0; y < decoded.height; y++) {
      columnMaximum = Math.max(
        columnMaximum,
        decoded.alpha[y * decoded.width + x]
      );
    }
    if (columnMaximum > maximumAlpha) break;
    width++;
  }
  return width;
}

const decodedBackgrounds = Object.freeze(Object.fromEntries(
  Object.entries(backgroundPaths).map(([name, relativePath]) => (
    [name, decodePng(relativePath)]
  ))
));
for (const [name, decoded] of Object.entries(decodedBackgrounds)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, backgroundSize);
  if (name === "skybox") {
    assert.equal(decoded.colorType, 2);
    assert.deepEqual(getAlphaUsage(decoded), {
      hasVisiblePixels: true,
      hasTransparentPixels: false
    });
  } else {
    assert.equal(decoded.colorType, 6);
    assert.deepEqual(getAlphaUsage(decoded), {
      hasVisiblePixels: true,
      hasTransparentPixels: true
    });
  }
}
assert.ok(getRightSoftEdgeWidth(decodedBackgrounds.fogBack, 16) >= 49);
assert.ok(getRightSoftEdgeWidth(decodedBackgrounds.fogFront, 16) >= 43);
const decodedHazard = decodePng(hazardPath);
assert.deepEqual(
  {w: decodedHazard.width, h: decodedHazard.height},
  hazardSize
);
assert.equal(decodedHazard.colorType, 6);

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

function loadFixture({failedFile = null, invalidFile = null, opaqueFile = null} = {}) {
  const recording = createRecordingContext();
  const loadedPaths = [];
  let registeredVisuals = null;
  let analyzedImage = null;
  const sizeByPath = Object.freeze({
    ...Object.fromEntries(Object.values(backgroundPaths).map(assetPath => (
      [assetPath, backgroundSize]
    ))),
    [hazardPath]: hazardSize
  });

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
      const expected = sizeByPath[value];
      assert.ok(expected, `unexpected asset path ${value}`);
      this.complete = true;
      this.naturalWidth = file === invalidFile ? expected.w - 1 : expected.w;
      this.naturalHeight = expected.h;
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
              const opaque = path.posix.basename(analyzedImage.src) === opaqueFile;
              return {
                data: new Uint8ClampedArray(opaque
                  ? [0, 0, 0, 255, 0, 0, 0, 255]
                  : [0, 0, 0, 160, 0, 0, 0, 0])
              };
            }
          };
        }
      };
    }
  };
  const platformVisuals = Object.freeze({
    platformMarker: "bamboo-night-platform-kit"
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "bambooNight");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "bambooNight");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Bamboo Night visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    document,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.bambooNightVisualsForTest = BAMBOO_NIGHT_ASSET_VISUALS;
  `, context, {filename: "bamboo-night-visuals-fixture.js"});
  return {
    api: context.bambooNightVisualsForTest,
    loadedPaths,
    platformVisuals,
    recording,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function captureBackground(fixture, time, width = 1280, height = 720) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBackground(
    fixture.recording.context,
    width,
    height,
    time
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

function captureHazard(fixture, time, rect) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBottomDeathHazard(
    fixture.recording.context,
    rect,
    time
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

const fixture = loadFixture();
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.deepEqual(fixture.loadedPaths, [
  ...Object.values(backgroundPaths),
  hazardPath
]);
const status = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, backgroundPaths);
assert.deepEqual(status.expectedNativeSize, backgroundSize);
assert.deepEqual(status.essentialLayers, [
  "skybox", "moon", "bambooBack", "bambooFront"
]);
assert.deepEqual(status.renderOrder, [
  "skybox", "moon", "fogBack", "bambooBack",
  "fogFront", "bambooFront", "gameplay"
]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(status.fogAnimation, {
  back: {leftSpeed: 7, ySpeed: 0, wrapDistance: 1231, overlap: 49, drawCopies: 2},
  front: {leftSpeed: 12, ySpeed: 0, wrapDistance: 1237, overlap: 43, drawCopies: 2},
  direction: "right-to-left",
  wrapMode: "horizontal-continuous",
  densityAnimation: false
});

const mapping = fixture.api.getBackgroundMapping(1280, 720);
const backAtOne = JSON.parse(JSON.stringify(
  fixture.api.getFogMapping(1, mapping, "back")
));
const backAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getFogMapping(2, mapping, "back")
));
const frontAtOne = JSON.parse(JSON.stringify(
  fixture.api.getFogMapping(1, mapping, "front")
));
const frontAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getFogMapping(2, mapping, "front")
));
assert.equal(backAtTwo.offsetX - backAtOne.offsetX, -7);
assert.equal(frontAtTwo.offsetX - frontAtOne.offsetX, -12);
assert.ok(frontAtOne.leftSpeed > backAtOne.leftSpeed);
for (const fog of [backAtOne, backAtTwo, frontAtOne, frontAtTwo]) {
  assert.equal(fog.offsetY, 0);
  assert.equal(fog.destinations.length, 2);
  assert.ok(fog.destinations.every(destination => (
    destination.y === 0 && destination.w === 1280 && destination.h === 720
  )));
  assert.equal(
    fog.destinations[0].x + 1280 - fog.destinations[1].x,
    fog.overlap
  );
}
assert.ok(Math.abs(
  fixture.api.getFogMapping(1231 / 7, mapping, "back").offsetX
) < 1e-9);
assert.ok(Math.abs(
  fixture.api.getFogMapping(1237 / 12, mapping, "front").offsetX
) < 1e-9);

const atOne = captureBackground(fixture, 1);
const atTwo = captureBackground(fixture, 2);
assert.equal(atOne.drawn, true);
const getDraws = capture => capture.calls.filter(call => call[0] === "drawImage");
const drawsAtOne = getDraws(atOne);
const drawsAtTwo = getDraws(atTwo);
assert.deepEqual(drawsAtOne.map(call => call[1].src), [
  backgroundPaths.skybox,
  backgroundPaths.moon,
  backgroundPaths.fogBack,
  backgroundPaths.fogBack,
  backgroundPaths.bambooBack,
  backgroundPaths.fogFront,
  backgroundPaths.fogFront,
  backgroundPaths.bambooFront
]);
const staticPaths = new Set([
  backgroundPaths.skybox,
  backgroundPaths.moon,
  backgroundPaths.bambooBack,
  backgroundPaths.bambooFront
]);
assert.deepEqual(
  drawsAtTwo.filter(call => staticPaths.has(call[1].src)).map(call => call.slice(2)),
  drawsAtOne.filter(call => staticPaths.has(call[1].src)).map(call => call.slice(2)),
  "Skybox, Moon and both Bamboo layers must remain static"
);
for (const [fogPath, expectedDelta] of [
  [backgroundPaths.fogBack, -7],
  [backgroundPaths.fogFront, -12]
]) {
  const first = drawsAtOne.filter(call => call[1].src === fogPath);
  const later = drawsAtTwo.filter(call => call[1].src === fogPath);
  assert.equal(first.length, 2);
  assert.equal(later.length, 2);
  for (let index = 0; index < 2; index++) {
    assert.equal(later[index][6] - first[index][6], expectedDelta);
    assert.equal(later[index][7], first[index][7]);
  }
}

const missingFog = loadFixture({
  failedFile: path.posix.basename(backgroundPaths.fogBack)
});
assert.equal(missingFog.api.isBackgroundReady(), true);
assert.equal(captureBackground(missingFog, 1).drawn, true);
assert.equal(captureBackground(missingFog, 1).calls.some(call => (
  call[0] === "drawImage" && call[1].src === backgroundPaths.fogBack
)), false);
const invalidMoon = loadFixture({
  invalidFile: path.posix.basename(backgroundPaths.moon)
});
assert.equal(invalidMoon.api.isBackgroundReady(), false);
assert.equal(captureBackground(invalidMoon, 1).drawn, false);
const opaqueFrontFog = loadFixture({
  opaqueFile: path.posix.basename(backgroundPaths.fogFront)
});
assert.equal(opaqueFrontFog.api.isBackgroundLayerReady("fogFront"), false);
assert.equal(opaqueFrontFog.api.isBackgroundReady(), true);

const hazardRect = Object.freeze({
  x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true
});
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
const hazardAtZero = captureHazard(fixture, 0, hazardRect);
const hazardAtLaterTime = captureHazard(fixture, 100, hazardRect);
assert.equal(hazardAtZero.drawn, true);
assert.deepEqual(hazardAtLaterTime.calls, hazardAtZero.calls);
const hazardDraws = getDraws(hazardAtZero);
assert.equal(hazardDraws.length, 1);
assert.equal(hazardDraws[0][1].src, hazardPath);
assert.deepEqual(hazardDraws[0].slice(2), [
  0, 0, 1650, 60, 235, 690, 825, 30
]);
assert.equal(captureHazard(fixture, 0, {...hazardRect, h: 29}).drawn, false);
const missingHazard = loadFixture({failedFile: path.posix.basename(hazardPath)});
assert.equal(missingHazard.api.isHazardReady(), false);
assert.equal(captureHazard(missingHazard, 0, hazardRect).drawn, false);

const bambooScriptIndex = indexSource.indexOf("./js/visual-bamboo-night-assets.js");
assert.ok(bambooScriptIndex >= 0);
assert.ok(bambooScriptIndex < indexSource.indexOf("./js/renderer.js"));
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{[\s\S]*?drawBackground\(biome\)/
);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)[\s\S]*?if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
);
assert.match(
  levelGeneratorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.doesNotMatch(visualSource, /Math\.random\(/);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.register\("bambooNight"/);

console.log(
  "Bamboo Night six-layer background, continuous dual fog and static hazard tests passed."
);
