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
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const hazardDirectory = "assets/environments/snow/hazards";
const hazardFiles = Object.freeze([
  "snow_hazard_base.png",
  "snow_hazard_wave_01.png"
]);
const hazardPaths = hazardFiles.map(file => `${hazardDirectory}/${file}`);
const hazardRect = Object.freeze({x: 235, y: 690, w: 825, h: 30});
const snowBiome = Object.freeze({
  id: "snow",
  hazard: Object.freeze({
    type: "iceWater",
    fill: "#286b91",
    deep: "#12374f",
    surface: "#d9fbff",
    accent: "#8eeaff"
  })
});

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

function getAlphaBounds(decoded, threshold) {
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return Object.freeze({
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  });
}

const decodedAssets = Object.fromEntries(hazardPaths.map(relativePath => (
  [relativePath, decodeRgba8Png(relativePath)]
)));
for (const decoded of Object.values(decodedAssets)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 1650, h: 60});
}
const waveAlphaBounds = getAlphaBounds(decodedAssets[hazardPaths[1]], 8);
assert.deepEqual(waveAlphaBounds, {x: 2, y: 8, w: 1648, h: 48});
assert.ok(waveAlphaBounds.y < 20, "Wave alpha reaches the ice area and requires a water-only clip");

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
    closePath() { calls.push(["closePath"]); },
    stroke() { calls.push(["stroke"]); },
    fill() { calls.push(["fill"]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop(...stopArgs) { calls.push(["addColorStop", ...stopArgs]); }
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

function loadFixture({
  failedFile = null,
  invalidFile = null,
  opaqueWave = false,
  transparentWave = false
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
      this.naturalWidth = file === invalidFile ? 1649 : 1650;
      this.naturalHeight = 60;
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
              assert.ok(analyzedImage.src.endsWith("snow_hazard_wave_01.png"));
              return {
                data: opaqueWave
                  ? new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])
                  : transparentWave
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
    throw new Error("Snow ice-water hazard must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    Uint8ClampedArray,
    document,
    ctx: recording.context,
    worldTime: 0
  });
  vm.runInContext(`${visualSource}
    ${hazardsSource}
    globalThis.snowHazardForTest = SNOW_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "snow-ice-water-hazard-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    platformVisuals,
    api: context.snowHazardForTest,
    drawDeathZone: context.drawDeathZoneForTest
  };
}

function drawAt(fixture, visualTime, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, snowBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/hazards/")),
  hazardPaths
);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(fixture.api.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(fixture.api.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);
const status = JSON.parse(JSON.stringify(fixture.api.getIceWaterHazardStatus()));
assert.equal(status.ready, true);
assert.equal(status.waveReady, true);
assert.deepEqual(status.contract, {
  native: {w: 1650, h: 60},
  runtime: {w: 825, h: 30},
  nativeToRuntimeScale: 0.5
});
assert.deepEqual(status.validNativeSizes, {base: true, wave01: true});
assert.deepEqual(status.waveAlphaUsage, {
  hasVisiblePixels: true,
  hasTransparentPixels: true
});
assert.deepEqual(status.waveAnimation, {
  speed: 10,
  bobSpeed: 1.1,
  bobAmplitude: 0.5
});
assert.deepEqual(status.waterClip, {sourceY: 20, runtimeTopOffset: 10});

const atZero = drawAt(fixture, 0);
const pngDrawsAtZero = atZero.filter(call => call[0] === "drawImage");
assert.deepEqual(
  pngDrawsAtZero.map(call => path.basename(call[1].src)),
  ["snow_hazard_base.png", "snow_hazard_wave_01.png", "snow_hazard_wave_01.png"]
);
assert.deepEqual(pngDrawsAtZero[0].slice(2), [0, 0, 1650, 60, 235, 690, 825, 30]);
for (const call of pngDrawsAtZero.slice(1)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1650, 60]);
  assert.equal(call[8], 825);
  assert.equal(call[9], 30);
}
assert.deepEqual(
  atZero.filter(call => call[0] === "rect").map(call => call.slice(1)),
  [[235, 690, 825, 30], [235, 700, 825, 20]]
);
assert.equal(atZero.filter(call => call[0] === "clip").length, 2);
assert.equal(atZero.some(call => call[0] === "fillRect"), false);
assert.equal(atZero.some(call => call[0] === "stroke"), false);

const atOne = drawAt(fixture, 1);
const pngDrawsAtOne = atOne.filter(call => call[0] === "drawImage");
assert.deepEqual(pngDrawsAtOne[0], pngDrawsAtZero[0], "Snow base must remain static");
const mappingAtOne = fixture.api.getIceWaterHazardMapping(1, hazardRect);
assert.equal(mappingAtOne.wave01.offsetX, 10);
assert.ok(Math.abs(mappingAtOne.wave01.offsetY - Math.sin(1.1) * 0.5) < 1e-12);
assert.equal(mappingAtOne.protectedIceHeight, 10);
assert.deepEqual(JSON.parse(JSON.stringify(mappingAtOne.waveClip)), {
  x: 235,
  y: 700,
  w: 825,
  h: 20
});
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave01.destinations.map(item => item.x))),
  [-580, 245]
);
assert.equal(
  mappingAtOne.wave01.destinations[1].x,
  mappingAtOne.wave01.destinations[0].x + hazardRect.w
);
assert.ok(mappingAtOne.wave01.destinations[0].x <= hazardRect.x);
assert.ok(
  mappingAtOne.wave01.destinations[1].x + hazardRect.w >=
    hazardRect.x + hazardRect.w
);
const wavePeak = fixture.api.getIceWaterHazardMapping(
  Math.PI / (2 * 1.1),
  hazardRect
);
const waveTrough = fixture.api.getIceWaterHazardMapping(
  Math.PI * 3 / (2 * 1.1),
  hazardRect
);
assert.ok(Math.abs(wavePeak.wave01.offsetY - 0.5) < 1e-12);
assert.ok(Math.abs(waveTrough.wave01.offsetY + 0.5) < 1e-12);

for (const baseFailure of [
  {failedFile: "snow_hazard_base.png"},
  {invalidFile: "snow_hazard_base.png"}
]) {
  const fallback = loadFixture(baseFailure);
  const calls = drawAt(fallback, 2);
  assert.equal(calls.some(call => call[0] === "drawImage"), false);
  assert.ok(calls.some(call => call[0] === "fillRect"));
  assert.ok(calls.some(call => call[0] === "stroke"));
}

for (const waveFailure of [
  {failedFile: "snow_hazard_wave_01.png"},
  {invalidFile: "snow_hazard_wave_01.png"},
  {opaqueWave: true},
  {transparentWave: true}
]) {
  const baseOnly = loadFixture(waveFailure);
  const calls = drawAt(baseOnly, 2);
  assert.equal(baseOnly.api.isIceWaterHazardReady(), true);
  assert.equal(baseOnly.api.isIceWaterWaveReady(), false);
  assert.deepEqual(
    calls.filter(call => call[0] === "drawImage").map(call => path.basename(call[1].src)),
    ["snow_hazard_base.png"]
  );
  assert.equal(calls.some(call => call[0] === "fillRect"), false);
  assert.equal(calls.some(call => call[0] === "stroke"), false);
  assert.deepEqual(
    calls.filter(call => call[0] === "rect").map(call => call.slice(1)),
    [[235, 690, 825, 30]]
  );
}
assert.ok(drawAt(fixture, 2, null).some(call => call[0] === "fillRect"));
assert.ok(drawAt(fixture, 2, {}).some(call => call[0] === "fillRect"));
assert.equal(fixture.api.getIceWaterHazardMapping(0, {...hazardRect, h: 29}), null);

assert.match(
  rendererSource,
  /for \(const s of level\.spikes\) drawDeathZone\(s, biome, platformVisuals\);/
);
assert.match(
  hazardsSource,
  /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
);
assert.match(
  read("index.html"),
  /js\/visual-volcano-assets\.js[\s\S]*js\/visual-snow-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(visualSource, /coast|desert|volcano|Math\.random\(/i);
assert.match(
  read("js/level-generator.js"),
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  read("js/physics.js"),
  /return \{x: spike\.x \+ 5, y: spike\.y \+ 5, w: spike\.w - 10, h: spike\.h \+ 22\};/
);
assert.match(read("js/physics.js"), /player\.r \* 0\.72/);
assert.match(read("js/core.js"), /const BOTTOM_DEATH_THRESHOLD = H \+ 140;/);

for (const relativePath of [
  "js/biomes.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js"
]) {
  const current = read(relativePath);
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the Snow hazard integration`
  );
}

console.log("Snow Base + optional clipped Wave ice-water hazard tests passed.");
