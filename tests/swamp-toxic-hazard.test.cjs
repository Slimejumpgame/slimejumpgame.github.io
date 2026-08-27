"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-swamp-assets.js");
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const hazardDirectory = "assets/environments/swamp/hazards";
const hazardFiles = Object.freeze([
  "swamp_hazard_base.png",
  "swamp_hazard_wave_01.png",
  "swamp_hazard_wave_02.png"
]);
const hazardPaths = hazardFiles.map(file => `${hazardDirectory}/${file}`);
const hazardRect = Object.freeze({x: 235, y: 690, w: 825, h: 30});
const swampBiome = Object.freeze({
  id: "swamp",
  hazard: Object.freeze({
    type: "toxic",
    fill: "#548c2f",
    deep: "#203d24",
    surface: "#a8e94e",
    accent: "#d7ff74"
  })
});

for (const relativePath of hazardPaths) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1650, 60]);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
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
    arc(...args) { calls.push(["arc", ...args]); },
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
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return false; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "swamp");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "swamp");
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
    throw new Error("Swamp toxic hazard must not consume Math.random()");
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
    globalThis.swampHazardForTest = SWAMP_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "swamp-toxic-hazard-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    platformVisuals,
    api: context.swampHazardForTest,
    drawDeathZone: context.drawDeathZoneForTest
  };
}

function drawAt(fixture, visualTime, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, swampBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
}

function imageNames(calls) {
  return calls
    .filter(call => call[0] === "drawImage")
    .map(call => path.basename(call[1].src));
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/hazards/")),
  hazardPaths
);
assert.equal(fixture.api.resolvePlatformRole, fixture.platformVisuals.resolvePlatformRole);
assert.equal(fixture.api.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);

const status = JSON.parse(JSON.stringify(fixture.api.getToxicHazardStatus()));
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
assert.deepEqual(status.validNativeSizes, {base: true, wave01: true, wave02: true});
assert.deepEqual(status.layerReady, {base: true, wave01: true, wave02: true});
assert.deepEqual(status.waveAlphaUsage, {
  wave01: {hasVisiblePixels: true, hasTransparentPixels: true},
  wave02: {hasVisiblePixels: true, hasTransparentPixels: true}
});
assert.deepEqual(status.animation, {
  wave01: {xSpeed: 10, ySpeed: 0, wrapAxis: "x", drawCopies: 2},
  wave02: {xSpeed: 0, riseSpeed: 6, wrapAxis: "y", drawCopies: 2}
});

const atZero = drawAt(fixture, 0);
const pngDrawsAtZero = atZero.filter(call => call[0] === "drawImage");
assert.deepEqual(imageNames(atZero), [
  "swamp_hazard_base.png",
  "swamp_hazard_wave_01.png",
  "swamp_hazard_wave_01.png",
  "swamp_hazard_wave_02.png",
  "swamp_hazard_wave_02.png"
]);
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
assert.deepEqual(pngDrawsAtOne[0], pngDrawsAtZero[0], "toxic base must be static");
const mappingAtOne = fixture.api.getToxicHazardMapping(1, hazardRect);
assert.equal(mappingAtOne.wave01.offsetX, 10);
assert.equal(mappingAtOne.wave01.offsetY, 0);
assert.equal(mappingAtOne.wave02.offsetX, 0);
assert.equal(mappingAtOne.wave02.offsetY, -6);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave01.destinations.map(item => item.x))),
  [-580, 245]
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mappingAtOne.wave02.destinations.map(item => item.y))),
  [684, 714]
);
assert.equal(mappingAtOne.wave01.destinations[1].x, mappingAtOne.wave01.destinations[0].x + hazardRect.w);
assert.ok(mappingAtOne.wave01.destinations[0].x <= hazardRect.x);
assert.ok(mappingAtOne.wave01.destinations[1].x + hazardRect.w >= hazardRect.x + hazardRect.w);
assert.equal(mappingAtOne.wave02.destinations[1].y, mappingAtOne.wave02.destinations[0].y + hazardRect.h);
assert.ok(mappingAtOne.wave02.destinations[0].y <= hazardRect.y);
assert.ok(mappingAtOne.wave02.destinations[1].y + hazardRect.h >= hazardRect.y + hazardRect.h);
assert.ok(Math.abs(fixture.api.getToxicHazardMapping(5, hazardRect).wave02.offsetY) < 1e-12);

for (const failedFile of hazardFiles) {
  const failed = loadFixture({failedFile});
  const calls = drawAt(failed, 2);
  if (failedFile === hazardFiles[0]) {
    assert.equal(calls.some(call => call[0] === "drawImage"), false);
    assert.ok(calls.some(call => call[0] === "fillRect"));
    assert.ok(calls.some(call => call[0] === "stroke"));
  } else {
    assert.equal(calls.some(call => call[0] === "fillRect"), false);
    assert.ok(imageNames(calls).includes("swamp_hazard_base.png"));
    assert.equal(imageNames(calls).includes(failedFile), false);
  }
}
for (const invalidFile of hazardFiles) {
  const invalid = loadFixture({invalidFile});
  const calls = drawAt(invalid, 2);
  if (invalidFile === hazardFiles[0]) {
    assert.ok(calls.some(call => call[0] === "fillRect"));
  } else {
    assert.equal(calls.some(call => call[0] === "fillRect"), false);
    assert.equal(imageNames(calls).includes(invalidFile), false);
  }
}
for (const opaqueWave of hazardFiles.slice(1)) {
  const opaque = loadFixture({opaqueWave});
  const calls = drawAt(opaque, 2);
  assert.equal(opaque.api.isToxicHazardReady(), true);
  assert.equal(opaque.api.isToxicHazardLayerReady(
    opaqueWave.endsWith("01.png") ? "wave01" : "wave02"
  ), false);
  assert.equal(imageNames(calls).includes(opaqueWave), false);
  assert.equal(calls.some(call => call[0] === "fillRect"), false);
}
assert.ok(drawAt(fixture, 2, null).some(call => call[0] === "fillRect"));
assert.ok(drawAt(fixture, 2, {}).some(call => call[0] === "fillRect"));
assert.equal(fixture.api.getToxicHazardMapping(0, {...hazardRect, w: 824}), null);

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
  /js\/visual-snow-assets\.js[\s\S]*js\/visual-swamp-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(visualSource, /Math\.random\(/);
assert.doesNotMatch(visualSource, /swamp_hazard_wave_03\.png/);
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

console.log("Swamp 2x PNG toxic hazard mapping, horizontal waves, rising bubbles and fallback tests passed.");
