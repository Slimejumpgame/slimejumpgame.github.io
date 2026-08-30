"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const runtimeFiles = [
  "js/visual-platform-kit.js",
  "js/visual-meadow-assets.js",
  "js/visual-coast-assets.js",
  "js/renderer.js",
  "index.html"
];
const runtimeSource = runtimeFiles.map(read).join("\n");
const removedLegacyAssets = [
  "assets/environments/meadow/platforms/floating_left.png",
  "assets/environments/meadow/platforms/floating_middle.png",
  "assets/environments/meadow/platforms/floating_right.png",
  "assets/environments/coast/platforms/coast_floating_left.png",
  "assets/environments/coast/platforms/coast_floating_middle.png",
  "assets/environments/coast/platforms/coast_floating_right.png"
];

for (const relativePath of removedLegacyAssets) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), false,
    `${relativePath} must remain deleted after the Whole-only migration`);
  assert.equal(runtimeSource.includes(relativePath), false,
    `${relativePath} must have no runtime reference`);
}

const platformKitSource = read("js/visual-platform-kit.js");
const rendererSource = read("js/renderer.js");
assert.doesNotMatch(platformKitSource,
  /floatingLeft|floatingMiddle|floatingRight|familyBLegacy|legacyFamilyB|drawLegacyFloating/);
assert.doesNotMatch(platformKitSource, /middleTileWidth|middleTileAdvance|repeat-source-crop/);
assert.match(platformKitSource, /defineAsset\(`\$\{biome\}_floating_platform`\)/);
assert.match(platformKitSource, /floatingWhole: Object\.freeze\(\{w: 512, h: 128\}\)/);
assert.match(platformKitSource, /function drawWholeFloatingPlatform/);
assert.match(platformKitSource, /return isWholeFamilyBReady\(\);/);

assert.doesNotMatch(rendererSource, /p\.moving && biomeAssetPlatform/);
assert.doesNotMatch(rendererSource, /rgba\(167,210,255,0\.62\)/);
assert.match(rendererSource, /platform\.moving[\s\S]*?\? "#5e7592"/,
  "the Moving Canvas basis must remain available as fallback");
assert.match(rendererSource, /platform\.moving[\s\S]*?\? "#a7d2ff"/,
  "the Moving Canvas top must remain available as fallback");
assert.doesNotMatch(rendererSource, /drawGhostStepFadeOutline|rgba\(230,215,255,0\.8\)/);

for (const fallback of [
  "drawLegacyFallingPlatformAsset",
  "drawLegacyIcePlatformAsset",
  "drawLegacyConveyorPlatformAsset"
]) {
  assert.match(rendererSource, new RegExp(`function ${fallback}\\(`));
}

console.log("Whole-only biome Floating cleanup, deleted assets and Moving residue: ok");
