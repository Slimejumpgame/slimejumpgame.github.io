"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-desert-assets.js");
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const hazardDirectory = "assets/environments/desert/hazards";
const hazardFiles = Object.freeze([
  "desert_hazard_base.png",
  "desert_hazard_wave_01.png",
  "desert_hazard_wave_02.png"
]);
const hazardPaths = hazardFiles.map(file => `${hazardDirectory}/${file}`);
const hazardRect = Object.freeze({x: 235, y: 690, w: 825, h: 30});
const desertBiome = Object.freeze({
  id: "desert",
  hazard: Object.freeze({
    type: "quicksand",
    fill: "#bd7138",
    deep: "#754126",
    surface: "#f0b657",
    accent: "#ffd98b"
  })
});

for (const relativePath of hazardPaths) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1650, 60]);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6, `${relativePath} must retain an RGBA channel`);
}

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
    ellipse(...args) { calls.push(["ellipse", ...args]); },
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

function loadFixture({failedFile = null, invalidFile = null, opaqueWave = null} = {}) {
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
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return false; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "desert");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "desert");
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
          assert.equal(options.willReadFrequently, true);
          return {
            clearRect() {},
            drawImage(image) { analyzedImage = image; },
            getImageData() {
              const file = path.posix.basename(analyzedImage.src);
              return {
                data: file === opaqueWave
                  ? new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])
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
    throw new Error("Desert quicksand hazard must not consume Math.random()");
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
    globalThis.desertHazardForTest = DESERT_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "desert-quicksand-hazard-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    api: context.desertHazardForTest,
    drawDeathZone: context.drawDeathZoneForTest
  };
}

function drawAt(fixture, visualTime, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, desertBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/hazards/")),
  hazardPaths
);
const status = JSON.parse(JSON.stringify(fixture.api.getQuicksandHazardStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.contract, {
  native: {w: 1650, h: 60},
  runtime: {w: 825, h: 30},
  nativeToRuntimeScale: 0.5
});
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.deepEqual(status.waveAlphaUsage, {
  wave01: {hasVisiblePixels: true, hasTransparentPixels: true},
  wave02: {hasVisiblePixels: true, hasTransparentPixels: true}
});

const atZero = drawAt(fixture, 0);
const pngDrawsAtZero = atZero.filter(call => call[0] === "drawImage");
assert.deepEqual(
  pngDrawsAtZero.map(call => path.basename(call[1].src)),
  [
    "desert_hazard_base.png",
    "desert_hazard_wave_01.png",
    "desert_hazard_wave_01.png",
    "desert_hazard_wave_02.png",
    "desert_hazard_wave_02.png"
  ]
);
assert.deepEqual(pngDrawsAtZero[0].slice(2), [0, 0, 1650, 60, 235, 690, 825, 30]);
for (const call of pngDrawsAtZero.slice(1)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1650, 60]);
  assert.equal(call[8], 825);
  assert.equal(call[9], 30);
}
assert.ok(atZero.some(call => (
  call[0] === "rect" && JSON.stringify(call.slice(1)) === JSON.stringify([235, 690, 825, 30])
)));
assert.ok(atZero.some(call => call[0] === "clip"));
assert.equal(atZero.some(call => call[0] === "fillRect"), false);
assert.equal(atZero.some(call => call[0] === "stroke"), false);

const atOne = drawAt(fixture, 1);
const pngDrawsAtOne = atOne.filter(call => call[0] === "drawImage");
assert.deepEqual(pngDrawsAtOne[0], pngDrawsAtZero[0], "quicksand base must be static");
const mappingAtOne = fixture.api.getQuicksandHazardMapping(1, hazardRect);
assert.equal(mappingAtOne.wave01.offsetX, 10);
assert.equal(mappingAtOne.wave02.offsetX, -16);
assert.ok(Math.abs(mappingAtOne.wave01.offsetY - Math.sin(1.1) * 0.75) < 1e-12);
assert.ok(Math.abs(mappingAtOne.wave02.offsetY - Math.sin(2.5) * 0.4) < 1e-12);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave01.destinations.map(item => item.x))),
  [-580, 245]
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave02.destinations.map(item => item.x))),
  [219, 1044]
);
for (const wave of [mappingAtOne.wave01, mappingAtOne.wave02]) {
  assert.equal(wave.destinations[1].x, wave.destinations[0].x + hazardRect.w);
  assert.ok(wave.destinations[0].x <= hazardRect.x);
  assert.ok(wave.destinations[1].x + hazardRect.w >= hazardRect.x + hazardRect.w);
}

const wave01Peak = fixture.api.getQuicksandHazardMapping(
  Math.PI / (2 * 1.1),
  hazardRect
);
const wave01Trough = fixture.api.getQuicksandHazardMapping(
  Math.PI * 3 / (2 * 1.1),
  hazardRect
);
const wave02Peak = fixture.api.getQuicksandHazardMapping(
  (Math.PI / 2 - 1.7 + Math.PI * 2) / 0.8,
  hazardRect
);
const wave02Trough = fixture.api.getQuicksandHazardMapping(
  (Math.PI * 3 / 2 - 1.7) / 0.8,
  hazardRect
);
assert.ok(Math.abs(wave01Peak.wave01.offsetY - 0.75) < 1e-12);
assert.ok(Math.abs(wave01Trough.wave01.offsetY + 0.75) < 1e-12);
assert.ok(Math.abs(wave02Peak.wave02.offsetY - 0.4) < 1e-12);
assert.ok(Math.abs(wave02Trough.wave02.offsetY + 0.4) < 1e-12);

for (const failedFile of hazardFiles) {
  const fallback = loadFixture({failedFile});
  const calls = drawAt(fallback, 2);
  assert.equal(calls.some(call => call[0] === "drawImage"), false);
  assert.ok(calls.some(call => call[0] === "fillRect"));
  assert.ok(calls.some(call => call[0] === "stroke"));
}
for (const invalidFile of hazardFiles) {
  const invalid = loadFixture({invalidFile});
  assert.ok(drawAt(invalid, 2).some(call => call[0] === "fillRect"));
}
const opaque = loadFixture({opaqueWave: "desert_hazard_wave_02.png"});
assert.equal(opaque.api.isQuicksandHazardReady(), false);
assert.ok(drawAt(opaque, 2).some(call => call[0] === "fillRect"));
assert.ok(drawAt(fixture, 2, null).some(call => call[0] === "fillRect"));
assert.ok(drawAt(fixture, 2, {}).some(call => call[0] === "fillRect"));

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
  /js\/visual-coast-assets\.js[\s\S]*js\/visual-desert-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(visualSource, /coast/i);
assert.doesNotMatch(visualSource, /Math\.random\(/);
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

console.log("Desert 2x PNG quicksand hazard mapping, motion, clipping and fallback tests passed.");
