"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-desert-assets.js");
const rendererSource = read("js/renderer.js");
const backgroundDirectory = "assets/environments/desert/background";
const backgroundFiles = Object.freeze([
  "desert_background_base.png",
  "desert_background_sun_glow.png"
]);
const backgroundPaths = backgroundFiles.map(file => (
  `${backgroundDirectory}/${file}`
));

for (const relativePath of backgroundPaths) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1280, 720]);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6, `${relativePath} must retain an RGBA channel`);
}

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

function loadFixture({failedFile = null, invalidFile = null, opaqueGlow = false} = {}) {
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
      const isBackground = value.includes("/background/");
      this.naturalWidth = file === invalidFile
        ? (isBackground ? 1279 : 1649)
        : (isBackground ? 1280 : 1650);
      this.naturalHeight = isBackground ? 720 : 60;
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
          assert.equal(options?.willReadFrequently, true);
          return {
            clearRect() {},
            drawImage(image) { analyzedImage = image; },
            getImageData() {
              const file = path.posix.basename(analyzedImage.src);
              const isOpaqueGlow = opaqueGlow &&
                file === "desert_background_sun_glow.png";
              return {
                data: isOpaqueGlow
                  ? new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])
                  : new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255])
              };
            }
          };
        }
      };
    }
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math,
    Promise,
    Uint8ClampedArray,
    document
  });
  vm.runInContext(`${visualSource}
    globalThis.desertBackgroundForTest = DESERT_ASSET_VISUALS;
  `, context, {filename: "desert-background-fixture.js"});
  return {
    recording,
    loadedPaths,
    api: context.desertBackgroundForTest
  };
}

function drawBackground(
  fixture,
  width = 1280,
  height = 720,
  visualTime = 0
) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBackground(
    fixture.recording.context,
    width,
    height,
    visualTime
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

const fixture = loadFixture();
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/background/")),
  backgroundPaths
);
const status = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.validNativeSizes, {base: true, sunGlow: true});
assert.deepEqual(status.sunGlowAlphaUsage, {
  hasVisiblePixels: true,
  hasTransparentPixels: true
});
assert.deepEqual(status.sunGlowAnimation, {
  anchor: {x: 1057.5, y: 122.5},
  periodSeconds: 6.5,
  minAlpha: 0.82,
  maxAlpha: 0.98,
  minScale: 0.988,
  maxScale: 1.012,
  minBrightness: 0.9,
  maxBrightness: 1.12
});
assert.equal(Object.hasOwn(status, "heatShimmer"), false);

const neutral = drawBackground(fixture);
assert.equal(neutral.drawn, true);
const neutralDraws = neutral.calls.filter(call => call[0] === "drawImage");
assert.deepEqual(
  neutralDraws.map(call => path.basename(call[1].src)),
  ["desert_background_base.png", "desert_background_sun_glow.png"]
);
for (const call of neutralDraws) {
  assert.deepEqual(call.slice(2), [0, 0, 1280, 720, 0, 0, 1280, 720]);
}
const baseDrawIndex = neutral.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "desert_background_base.png"
));
const glowDrawIndex = neutral.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "desert_background_sun_glow.png"
));
const alphaSetIndex = neutral.calls.findIndex(call => (
  call[0] === "set" && call[1] === "globalAlpha"
));
const brightnessSetIndex = neutral.calls.findIndex(call => (
  call[0] === "set" && call[1] === "filter"
));
assert.ok(baseDrawIndex >= 0);
assert.ok(alphaSetIndex > baseDrawIndex && alphaSetIndex < glowDrawIndex);
assert.ok(brightnessSetIndex > baseDrawIndex && brightnessSetIndex < glowDrawIndex);
assert.ok(Math.abs(neutral.calls[alphaSetIndex][2] - 0.9) < 1e-12);
assert.equal(neutral.calls[brightnessSetIndex][2], "brightness(1.01)");

const backgroundMapping = fixture.api.getBackgroundMapping(1280, 720);
const glowAtNeutral = fixture.api.getSunGlowMapping(0, backgroundMapping);
const glowAtPeak = fixture.api.getSunGlowMapping(
  status.sunGlowAnimation.periodSeconds / 4,
  backgroundMapping
);
const glowAtTrough = fixture.api.getSunGlowMapping(
  status.sunGlowAnimation.periodSeconds * 3 / 4,
  backgroundMapping
);
assert.ok(Math.abs(glowAtNeutral.normalizedPulse - 0.5) < 1e-12);
assert.ok(Math.abs(glowAtNeutral.alpha - 0.9) < 1e-12);
assert.ok(Math.abs(glowAtNeutral.scale - 1) < 1e-12);
assert.ok(Math.abs(glowAtNeutral.brightness - 1.01) < 1e-12);
assert.ok(Math.abs(glowAtPeak.normalizedPulse - 1) < 1e-12);
assert.ok(Math.abs(glowAtPeak.alpha - 0.98) < 1e-12);
assert.ok(Math.abs(glowAtPeak.scale - 1.012) < 1e-12);
assert.ok(Math.abs(glowAtPeak.brightness - 1.12) < 1e-12);
assert.ok(Math.abs(glowAtTrough.normalizedPulse) < 1e-12);
assert.ok(Math.abs(glowAtTrough.alpha - 0.82) < 1e-12);
assert.ok(Math.abs(glowAtTrough.scale - 0.988) < 1e-12);
assert.ok(Math.abs(glowAtTrough.brightness - 0.9) < 1e-12);

for (const visualTime of [0, 0.7, 2.4, 5.9]) {
  const glow = fixture.api.getSunGlowMapping(visualTime, backgroundMapping);
  const normalizedPulse = (
    Math.sin(visualTime * Math.PI * 2 / 6.5) + 1
  ) / 2;
  assert.ok(Math.abs(glow.normalizedPulse - normalizedPulse) < 1e-12);
  assert.ok(Math.abs(glow.alpha - (0.82 + normalizedPulse * 0.16)) < 1e-12);
  assert.ok(Math.abs(glow.scale - (0.988 + normalizedPulse * 0.024)) < 1e-12);
  assert.ok(Math.abs(glow.brightness - (0.9 + normalizedPulse * 0.22)) < 1e-12);
  const projectedAnchorX = glow.destination.x +
    1057.5 / 1280 * glow.destination.w;
  const projectedAnchorY = glow.destination.y +
    122.5 / 720 * glow.destination.h;
  assert.ok(Math.abs(projectedAnchorX - glow.anchor.x) < 1e-9);
  assert.ok(Math.abs(projectedAnchorY - glow.anchor.y) < 1e-9);
}

for (const optionalGlowFailure of [
  {failedFile: "desert_background_sun_glow.png"},
  {invalidFile: "desert_background_sun_glow.png"},
  {opaqueGlow: true}
]) {
  const withoutGlow = loadFixture(optionalGlowFailure);
  const result = drawBackground(withoutGlow);
  assert.equal(result.drawn, true);
  assert.deepEqual(
    result.calls
      .filter(call => call[0] === "drawImage")
      .map(call => path.basename(call[1].src)),
    ["desert_background_base.png"]
  );
  assert.equal(result.calls.some(call => call[1] === "filter"), false);
}

for (const baseFailure of [
  {failedFile: "desert_background_base.png"},
  {invalidFile: "desert_background_base.png"}
]) {
  const withoutBase = loadFixture(baseFailure);
  const result = drawBackground(withoutBase);
  assert.equal(result.drawn, false);
  assert.equal(result.calls.some(call => call[0] === "drawImage"), false);
}

assert.match(
  rendererSource,
  /typeof biomePlatformVisuals\.drawBackground === "function"[\s\S]*biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)/
);
assert.match(
  rendererSource,
  /if \(!assetBackgroundDrawn\) \{\s*drawBackground\(biome\);\s*\}/
);
const rendererDrawSource = rendererSource.slice(rendererSource.indexOf("  function draw()"));
assert.ok(
  rendererDrawSource.indexOf("biomePlatformVisuals.drawBackground") <
  rendererDrawSource.indexOf("drawPlatforms(")
);
assert.doesNotMatch(
  visualSource,
  /HEAT_SHIMMER|heatShimmer|backgroundBuffer|drawHeat|horizontal-slices|sliceIndex/
);
assert.doesNotMatch(visualSource, /dust|parallax|coast_background|Math\.random\(/i);

console.log("Desert Base + synchronized alpha/scale/brightness Sun Glow tests passed.");
