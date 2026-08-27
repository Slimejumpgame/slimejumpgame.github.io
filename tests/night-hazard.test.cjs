"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-night-assets.js");
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const hazardDirectory = "assets/environments/night/hazards";
const hazardFiles = Object.freeze([
  "night_hazard_base.png",
  "night_hazard_wave_01.png",
  "night_hazard_wave_02.png"
]);
const hazardPaths = hazardFiles.map(file => `${hazardDirectory}/${file}`);
const hazardRect = Object.freeze({x: 235, y: 690, w: 825, h: 30});
const nightBiome = Object.freeze({
  id: "night",
  hazard: Object.freeze({
    type: "abyss",
    fill: "#050713",
    deep: "#000106",
    surface: "#5c68a0",
    accent: "#aebeff"
  })
});

for (const relativePath of hazardPaths) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1650, 60]);
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
  assert.equal(
    zlib.inflateSync(Buffer.concat(idat)).length,
    (1650 * 4 + 1) * 60,
    `${relativePath} must contain a valid non-interlaced RGBA payload`
  );
}

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
  opaqueWave = null,
  transparentWave = null
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
    platformMarker: "generic-night-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "night");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "night");
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
              const file = path.posix.basename(analyzedImage.src);
              return {
                data: file === opaqueWave
                  ? new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])
                  : file === transparentWave
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
    throw new Error("Night hazard rendering must not consume Math.random()");
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
    globalThis.nightHazardForTest = NIGHT_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "night-hazard-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    platformVisuals,
    api: context.nightHazardForTest,
    drawDeathZone: context.drawDeathZoneForTest,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function drawAt(fixture, visualTime, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, nightBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
}

function hazardDraws(calls) {
  return calls.filter(call => (
    call[0] === "drawImage" && call[1].src.includes("/hazards/")
  ));
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/hazards/")),
  hazardPaths
);
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(fixture.api.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);

const status = JSON.parse(JSON.stringify(fixture.api.getNightHazardStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, {
  base: hazardPaths[0],
  wave01: hazardPaths[1],
  wave02: hazardPaths[2]
});
assert.deepEqual(status.contract, {
  native: {w: 1650, h: 60},
  runtime: {w: 825, h: 30},
  nativeToRuntimeScale: 0.5
});
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(status.waveAlphaUsage, {
  wave01: {hasVisiblePixels: true, hasTransparentPixels: true},
  wave02: {hasVisiblePixels: true, hasTransparentPixels: true}
});
assert.deepEqual(status.animation, {
  wave01: {xSpeed: 10, ySpeed: 0, wrapAxis: "x", drawCopies: 2},
  wave02: {xSpeed: -16, ySpeed: 0, wrapAxis: "x", drawCopies: 2}
});

const backgroundStatus = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(backgroundStatus.ready, true);
assert.equal(backgroundStatus.starPulseAnimation.count, 26);
assert.equal(backgroundStatus.cloudAnimation.back.xAmplitude, 24);
assert.equal(backgroundStatus.cloudAnimation.front.xAmplitude, 18);

const atZero = drawAt(fixture, 0);
const pngDrawsAtZero = hazardDraws(atZero);
assert.deepEqual(
  pngDrawsAtZero.map(call => path.basename(call[1].src)),
  [
    "night_hazard_base.png",
    "night_hazard_wave_02.png",
    "night_hazard_wave_02.png",
    "night_hazard_wave_01.png",
    "night_hazard_wave_01.png"
  ]
);
assert.deepEqual(pngDrawsAtZero[0].slice(2), [0, 0, 1650, 60, 235, 690, 825, 30]);
for (const call of pngDrawsAtZero.slice(1)) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1650, 60]);
  assert.equal(call[7], 690);
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
const pngDrawsAtOne = hazardDraws(atOne);
assert.deepEqual(pngDrawsAtOne[0], pngDrawsAtZero[0], "Night hazard base must be static");
assert.notDeepEqual(pngDrawsAtOne.slice(1), pngDrawsAtZero.slice(1));
const mappingAtOne = fixture.api.getNightHazardMapping(1, hazardRect);
assert.equal(mappingAtOne.wave01.offsetX, 10);
assert.equal(mappingAtOne.wave02.offsetX, -16);
assert.equal(mappingAtOne.wave01.offsetY, 0);
assert.equal(mappingAtOne.wave02.offsetY, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave01.destinations.map(item => item.x))),
  [-580, 245]
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave02.destinations.map(item => item.x))),
  [219, 1044]
);
for (const wave of [mappingAtOne.wave01, mappingAtOne.wave02]) {
  assert.equal(wave.destinations.length, 2);
  assert.equal(wave.destinations[1].x, wave.destinations[0].x + hazardRect.w);
  assert.ok(wave.destinations[0].x <= hazardRect.x);
  assert.ok(wave.destinations[1].x + hazardRect.w >= hazardRect.x + hazardRect.w);
  assert.ok(wave.destinations.every(destination => destination.y === hazardRect.y));
}
assert.equal(fixture.api.getNightHazardMapping(1, {...hazardRect, w: 824}), null);

for (const baseFailure of [
  {failedFile: "night_hazard_base.png"},
  {invalidFile: "night_hazard_base.png"}
]) {
  const fallback = loadFixture(baseFailure);
  const calls = drawAt(fallback, 2);
  assert.equal(hazardDraws(calls).length, 0);
  assert.ok(calls.some(call => call[0] === "fillRect"));
  assert.ok(calls.some(call => call[0] === "stroke"));
}

for (const optionalFile of [
  "night_hazard_wave_01.png",
  "night_hazard_wave_02.png"
]) {
  for (const failure of [
    {failedFile: optionalFile},
    {invalidFile: optionalFile},
    {opaqueWave: optionalFile},
    {transparentWave: optionalFile}
  ]) {
    const partial = loadFixture(failure);
    const calls = drawAt(partial, 2);
    const files = hazardDraws(calls).map(call => path.basename(call[1].src));
    const remainingWave = optionalFile.endsWith("01.png")
      ? "night_hazard_wave_02.png"
      : "night_hazard_wave_01.png";
    assert.equal(partial.api.isNightHazardReady(), true);
    assert.deepEqual(files, [
      "night_hazard_base.png",
      remainingWave,
      remainingWave
    ]);
    assert.equal(calls.some(call => call[0] === "fillRect"), false);
    assert.equal(calls.some(call => call[0] === "stroke"), false);
  }
}

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
  read("js/level-generator.js"),
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  read("js/physics.js"),
  /return \{x: spike\.x \+ 5, y: spike\.y \+ 5, w: spike\.w - 10, h: spike\.h \+ 22\};/
);
assert.doesNotMatch(visualSource, /Math\.random\(/);

console.log("Night three-layer PNG hazard, horizontal dual-wave wrapping and partial fallback tests passed.");
