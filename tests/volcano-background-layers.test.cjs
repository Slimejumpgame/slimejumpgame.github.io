"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const visualSource = read("js/visual-volcano-assets.js");
const rendererSource = read("js/renderer.js");
const backgroundDirectory = "assets/environments/volcano/background";
const backgroundFiles = Object.freeze([
  "volcano_background_sky_base.png",
  "volcano_background_smoke.png",
  "volcano_background_landscape.png",
  "volcano_background_lava_glow.png",
  "volcano_background_embers.png"
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
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    createRadialGradient(...args) {
      calls.push(["createRadialGradient", ...args]);
      return {
        addColorStop(...stopArgs) { calls.push(["addColorStop", ...stopArgs]); }
      };
    },
    beginPath() { calls.push(["beginPath"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    fill() { calls.push(["fill"]); }
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

function loadFixture({failedFile = null, invalidFile = null, opaqueLayer = null} = {}) {
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
      const isBackground = value.includes("/background/");
      this.complete = true;
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
    platformMarker: "generic-volcano-platform-kit",
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "volcano");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "volcano");
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
                data: file === opaqueLayer
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
    throw new Error("Volcano background rendering must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    Uint8ClampedArray,
    document
  });
  vm.runInContext(`${visualSource}
    globalThis.volcanoBackgroundForTest = VOLCANO_ASSET_VISUALS;
  `, context, {filename: "volcano-background-layers-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.volcanoBackgroundForTest,
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

const fixture = loadFixture();
const visuals = fixture.api;
assert.deepEqual(
  fixture.loadedPaths.filter(assetPath => assetPath.includes("/background/")),
  backgroundPaths
);
assert.equal(fixture.getRegisteredVisuals(), visuals);
assert.equal(visuals.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(visuals.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(visuals.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);

const status = JSON.parse(JSON.stringify(visuals.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.deepEqual(status.essentialLayers, ["skyBase", "landscape"]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(Object.keys(status.alphaUsage).sort(), [
  "embers",
  "landscape",
  "lavaGlow",
  "smoke"
]);
assert.ok(Object.values(status.alphaUsage).every(usage => (
  usage.hasVisiblePixels && usage.hasTransparentPixels
)));
assert.deepEqual(status.smokeAnimation, {
  xAmplitude: 5,
  xPeriodSeconds: 22,
  yAmplitude: 2,
  yPeriodSeconds: 14,
  yPhase: 0.65,
  glowZones: [
    {x: 250, y: 310, radius: 72, periodSeconds: 5.7, phase: 0.2, minAlpha: 0.13, maxAlpha: 0.30},
    {x: 475, y: 160, radius: 66, periodSeconds: 7.1, phase: 1.4, minAlpha: 0.11, maxAlpha: 0.26},
    {x: 685, y: 225, radius: 82, periodSeconds: 6.3, phase: 2.6, minAlpha: 0.15, maxAlpha: 0.34},
    {x: 965, y: 350, radius: 64, periodSeconds: 8.4, phase: 4.1, minAlpha: 0.11, maxAlpha: 0.28},
    {x: 1040, y: 265, radius: 70, periodSeconds: 6.9, phase: 5.2, minAlpha: 0.13, maxAlpha: 0.32}
  ]
});
assert.deepEqual(status.lavaGlowAnimation, {
  periodSeconds: 6.8,
  minAlpha: 0.74,
  maxAlpha: 1.00,
  minBrightness: 1.00,
  maxBrightness: 1.58
});
assert.deepEqual(status.embersAnimation, {
  riseSpeed: 6,
  xAmplitude: 3,
  xPeriodSeconds: 13,
  wrapCopies: 4
});

const atZero = captureBackground(fixture);
assert.equal(atZero.drawn, true);
const drawsAtZero = imageDraws(atZero);
assert.deepEqual(
  drawsAtZero.map(call => path.basename(call[1].src)),
  [
    "volcano_background_sky_base.png",
    "volcano_background_smoke.png",
    "volcano_background_smoke.png",
    "volcano_background_landscape.png",
    "volcano_background_lava_glow.png",
    "volcano_background_embers.png",
    "volcano_background_embers.png",
    "volcano_background_embers.png",
    "volcano_background_embers.png"
  ]
);
for (const call of drawsAtZero) {
  assert.deepEqual(call.slice(2, 6), [0, 0, 1280, 720]);
  assert.equal(call[8], 1280);
  assert.equal(call[9], 720);
}
assert.deepEqual(drawsAtZero[0].slice(6), [0, 0, 1280, 720]);
assert.deepEqual(drawsAtZero[3].slice(6), [0, 0, 1280, 720]);
assert.deepEqual(drawsAtZero[4].slice(6), [0, 0, 1280, 720]);
assert.equal(
  atZero.calls.filter(call => call[0] === "createRadialGradient").length,
  5
);
assert.equal(atZero.calls.filter(call => call[0] === "arc").length, 5);
assert.ok(atZero.calls.some(call => (
  call[0] === "set" &&
  call[1] === "globalCompositeOperation" &&
  call[2] === "lighter"
)));

const mapping = visuals.getBackgroundMapping(1280, 720);
const smokeAtZero = visuals.getSmokeMapping(0, mapping);
const smokeLater = visuals.getSmokeMapping(4.25, mapping);
assert.notEqual(smokeLater.offsetX, smokeAtZero.offsetX);
assert.notEqual(smokeLater.offsetY, smokeAtZero.offsetY);
assert.ok(Math.abs(smokeLater.offsetX) <= 5);
assert.ok(Math.abs(smokeLater.offsetY) <= 2);
for (const smoke of [smokeAtZero, smokeLater]) {
  assert.equal(smoke.destinations.length, 2);
  assert.equal(smoke.destinations[1].x, smoke.destinations[0].x + 1280);
  assert.ok(smoke.destinations[0].x <= 0);
  assert.ok(smoke.destinations[1].x + 1280 >= 1280);
}
assert.equal(smokeLater.glowZones.length, 5);
assert.equal(new Set(
  smokeLater.glowZones.map(zone => zone.normalizedPulse.toFixed(8))
).size, 5, "smoke glow zones must pulse independently");
assert.ok(smokeLater.glowZones.every(zone => zone.alpha >= 0.11 && zone.alpha <= 0.34));

const lavaAtNeutral = visuals.getLavaGlowMapping(0);
const lavaAtPeak = visuals.getLavaGlowMapping(6.8 / 4);
const lavaAtTrough = visuals.getLavaGlowMapping(6.8 * 3 / 4);
assert.ok(Math.abs(lavaAtNeutral.alpha - 0.87) < 1e-12);
assert.ok(Math.abs(lavaAtNeutral.brightness - 1.29) < 1e-12);
assert.ok(Math.abs(lavaAtPeak.alpha - 1.00) < 1e-12);
assert.ok(Math.abs(lavaAtPeak.brightness - 1.58) < 1e-12);
assert.ok(Math.abs(lavaAtTrough.alpha - 0.74) < 1e-12);
assert.ok(Math.abs(lavaAtTrough.brightness - 1.00) < 1e-12);
const atLavaPeak = captureBackground(fixture, 6.8 / 4);
const glowDrawIndex = atLavaPeak.calls.findIndex(call => (
  call[0] === "drawImage" &&
  path.basename(call[1].src) === "volcano_background_lava_glow.png"
));
assert.ok(atLavaPeak.calls.slice(0, glowDrawIndex).some(call => (
  call[0] === "set" && call[1] === "globalAlpha" && call[2] === 1.00
)));
assert.ok(atLavaPeak.calls.slice(0, glowDrawIndex).some(call => (
  call[0] === "set" && call[1] === "filter" && call[2] === "brightness(1.58)"
)));

const embersAtTen = visuals.getEmbersMapping(10, mapping);
assert.equal(embersAtTen.offsetY, -60);
assert.ok(Math.abs(embersAtTen.offsetX) <= 3);
assert.equal(embersAtTen.destinations.length, 4);
assert.equal(embersAtTen.destinations[1].x, embersAtTen.destinations[0].x + 1280);
assert.equal(embersAtTen.destinations[2].y, embersAtTen.destinations[0].y + 720);
assert.equal(embersAtTen.destinations[3].x, embersAtTen.destinations[2].x + 1280);
assert.ok(embersAtTen.destinations[0].x <= 0);
assert.ok(embersAtTen.destinations[1].x + 1280 >= 1280);
assert.ok(embersAtTen.destinations[0].y <= 0);
assert.ok(embersAtTen.destinations[2].y + 720 >= 720);
const embersAtRightPeak = visuals.getEmbersMapping(13 / 4, mapping);
assert.ok(Math.abs(embersAtRightPeak.offsetX - 3) < 1e-12);

for (const essentialFile of [
  "volcano_background_sky_base.png",
  "volcano_background_landscape.png"
]) {
  for (const failure of [
    {failedFile: essentialFile},
    {invalidFile: essentialFile},
    ...(essentialFile.endsWith("landscape.png")
      ? [{opaqueLayer: essentialFile}]
      : [])
  ]) {
    const fallback = loadFixture(failure);
    const capture = captureBackground(fallback);
    assert.equal(capture.drawn, false);
    assert.equal(imageDraws(capture).length, 0, "essential fallback must be atomic");
  }
}

for (const optionalFile of [
  "volcano_background_smoke.png",
  "volcano_background_lava_glow.png",
  "volcano_background_embers.png"
]) {
  for (const failure of [
    {failedFile: optionalFile},
    {invalidFile: optionalFile},
    {opaqueLayer: optionalFile}
  ]) {
    const optional = loadFixture(failure);
    const capture = captureBackground(optional);
    assert.equal(capture.drawn, true);
    assert.equal(optional.api.isBackgroundReady(), true);
    assert.equal(imageDraws(capture).some(call => (
      path.basename(call[1].src) === optionalFile
    )), false);
    if (optionalFile.endsWith("smoke.png")) {
      assert.equal(capture.calls.some(call => call[0] === "createRadialGradient"), false);
    }
  }
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
assert.match(
  read("index.html"),
  /js\/visual-desert-assets\.js[\s\S]*js\/visual-volcano-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(visualSource, /coast|desert|Math\.random\(/i);

for (const relativePath of [
  "js/biomes.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/visual-coast-assets.js",
  "js/visual-desert-assets.js",
  "js/visual-meadow-assets.js"
]) {
  const current = read(relativePath);
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the Volcano background update`
  );
}

console.log("Volcano layered background motion, local glows, wrapping and fallback tests passed.");
