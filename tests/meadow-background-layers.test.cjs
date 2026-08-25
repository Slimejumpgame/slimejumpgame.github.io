"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");

const layerAssets = Object.freeze({
  "assets/environments/meadow/background/meadow_background_sky_base.png": 2,
  "assets/environments/meadow/background/meadow_background_clouds_back.png": 6,
  "assets/environments/meadow/background/meadow_background_landscape.png": 6,
  "assets/environments/meadow/background/meadow_background_clouds_front.png": 6
});
for (const [relativePath, expectedColorType] of Object.entries(layerAssets)) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1280, 720]);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], expectedColorType);
}

const visualSource = read("js/visual-meadow-assets.js");
const platformKitSource = read("js/visual-platform-kit.js");
const rendererSource = read("js/renderer.js");

function loadVisuals(failedAssetSuffixes = []) {
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
      const failed = failedAssetSuffixes.some(suffix => value.endsWith(suffix));
      const platformSize = value.endsWith("floating_middle.png")
        ? [256, 128]
        : value.endsWith("floating_left.png") || value.endsWith("floating_right.png")
          ? [128, 128]
          : value.includes("/platforms/")
            ? [352, 128]
            : [1280, 720];
      this.complete = true;
      this.naturalWidth = failed ? 0 : platformSize[0];
      this.naturalHeight = failed ? 0 : platformSize[1];
      (failed ? this.onerror : this.onload)?.();
    }

    get src() {
      return this._src;
    }
  }

  const math = Object.create(Math);
  math.random = () => {
    throw new Error("background rendering must not consume Math.random()");
  };
  const context = vm.createContext({Image: FakeImage, Math: math, Promise});
  vm.runInContext(`${platformKitSource}
    ${visualSource}
    globalThis.backgroundVisualsForTest = MEADOW_ASSET_VISUALS;
  `, context, {filename: "meadow-background-layers-fixture.js"});
  return context.backgroundVisualsForTest;
}

function captureBackground(api, visualTime) {
  const drawCalls = [];
  const propertyWrites = [];
  const context = new Proxy({
    save() {},
    restore() {},
    drawImage(...args) { drawCalls.push(args); }
  }, {
    set(target, property, value) {
      propertyWrites.push([property, value]);
      target[property] = value;
      return true;
    }
  });
  return {
    result: api.drawBackground(context, 1280, 720, visualTime),
    drawCalls,
    propertyWrites
  };
}

const visuals = loadVisuals();
const atZero = captureBackground(visuals, 0);
const later = captureBackground(visuals, 3.75);
const expectedOrder = [
  "meadow_background_sky_base.png",
  "meadow_background_clouds_back.png",
  "meadow_background_landscape.png",
  "meadow_background_clouds_front.png"
];
assert.equal(atZero.result, true);
assert.deepEqual(
  atZero.drawCalls.map(call => path.basename(call[0].src)),
  expectedOrder
);
assert.deepEqual(atZero.drawCalls[0].slice(5), [0, 0, 1280, 720]);
assert.deepEqual(atZero.drawCalls[2].slice(5), [0, 0, 1280, 720]);
assert.deepEqual(later.drawCalls[0].slice(5), [0, 0, 1280, 720]);
assert.deepEqual(later.drawCalls[2].slice(5), [0, 0, 1280, 720]);
assert.notEqual(atZero.drawCalls[1][5], later.drawCalls[1][5]);
assert.notEqual(atZero.drawCalls[3][5], later.drawCalls[3][5]);
assert.notEqual(later.drawCalls[1][5], later.drawCalls[3][5]);
assert.equal(atZero.drawCalls[1][6], 0);
assert.equal(atZero.drawCalls[3][6], 0);
assert.ok(Math.abs(later.drawCalls[1][5]) <= 15);
assert.ok(Math.abs(later.drawCalls[3][5]) <= 22);
assert.ok(atZero.propertyWrites.some(write => (
  write[0] === "imageSmoothingEnabled" && write[1] === true
)));
assert.ok(atZero.propertyWrites.some(write => (
  write[0] === "imageSmoothingQuality" && write[1] === "high"
)));

const withoutClouds = loadVisuals([
  "meadow_background_clouds_back.png",
  "meadow_background_clouds_front.png"
]);
assert.equal(withoutClouds.areAllReady(), true);
const withoutCloudCalls = captureBackground(withoutClouds, 4);
assert.equal(withoutCloudCalls.result, true);
assert.deepEqual(
  withoutCloudCalls.drawCalls.map(call => path.basename(call[0].src)),
  ["meadow_background_sky_base.png", "meadow_background_landscape.png"]
);

const legacyFallback = loadVisuals(["meadow_background_sky_base.png"]);
const legacyCalls = captureBackground(legacyFallback, 4);
assert.equal(legacyCalls.result, true);
assert.deepEqual(
  legacyCalls.drawCalls.map(call => path.basename(call[0].src)),
  ["meadow_background.png"]
);

const canvasFallback = loadVisuals([
  "meadow_background.png",
  "meadow_background_sky_base.png"
]);
assert.equal(captureBackground(canvasFallback, 4).result, false);

assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?drawPlatforms\(biome, biomePlatformVisuals, "without-floating"\)/
);
assert.doesNotMatch(
  visualSource.slice(
    visualSource.indexOf("    function drawBackgroundLayer"),
    visualSource.indexOf("    function resolvePlatformRole")
  ),
  /Math\.random\(/
);

for (const relativePath of [
  "js/biomes.js",
  "js/core.js",
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
    `${relativePath} must remain unchanged by the layered background update`
  );
}

console.log("Meadow layered background assets, motion, fallbacks, ordering and scope tests passed.");
