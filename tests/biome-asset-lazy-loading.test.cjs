"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualModules = Object.freeze([
  "visual-meadow-assets.js",
  "visual-coast-assets.js",
  "visual-desert-assets.js",
  "visual-volcano-assets.js",
  "visual-snow-assets.js",
  "visual-swamp-assets.js",
  "visual-crystal-cave-assets.js",
  "visual-night-assets.js",
  "visual-autumn-assets.js",
  "visual-sky-assets.js",
  "visual-storm-night-assets.js",
  "visual-neon-city-assets.js",
  "visual-mushroom-cave-assets.js",
  "visual-abandoned-mine-assets.js",
  "visual-bamboo-night-assets.js",
  "visual-pirate-harbor-assets.js",
  "visual-alien-jungle-assets.js",
  "visual-enchanted-garden-assets.js",
  "visual-red-moon-assets.js",
  "visual-underground-temple-assets.js"
]);

const imagePaths = [];
let completeImagesImmediately = true;

function getNativeSize(assetPath) {
  if (assetPath.includes("/platforms/")) {
    return assetPath.endsWith("_floating_platform.png") ? [512, 128] : [352, 128];
  }
  if (assetPath.includes("/decor/")) return [1536, 1024];
  if (assetPath.includes("/portal/")) return [256, 272];
  if (assetPath.endsWith("meadow_background.png")) return [1672, 941];
  if (assetPath.includes("/background/")) return [1280, 720];
  if (assetPath.endsWith("meadow_bottom_spike_tile.png")) return [256, 320];
  return [1650, 60];
}

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
    imagePaths.push(value);
    if (!completeImagesImmediately) return;
    [this.naturalWidth, this.naturalHeight] = getNativeSize(value);
    this.complete = true;
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

const idleCallbacks = [];
const sandbox = {
  Image: FakeImage,
  Promise,
  Math,
  Set,
  console,
  fairyTaleMode: true,
  requestIdleCallback(callback) {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  }
};
sandbox.isFairyTaleGraphicsMode = () => sandbox.fairyTaleMode;
const context = vm.createContext(sandbox);
const source = [
  read("js/biomes.js"),
  read("js/visual-platform-kit.js"),
  read("js/visual-decor-kit.js"),
  read("js/visual-portal-kit.js"),
  ...visualModules.map(file => read(`js/${file}`)),
  `globalThis.lazyBiomeTestApi = {
    BIOME_PLATFORM_VISUALS,
    getNextBiome,
    requestFairyTaleBiomeGameplayAssets,
    scheduleNextBiomeVisualPreload,
    requestCurrentBiomeVisualAssets
  };`
].join("\n");
vm.runInContext(source, context, {filename: "biome-asset-lazy-loading-fixture.js"});
const api = context.lazyBiomeTestApi;

const pathsFor = (biomeId, category = null) => imagePaths.filter(assetPath => (
  assetPath.includes(`/environments/${biomeId}/`) &&
  (!category || assetPath.includes(`/${category}/`))
));

assert.equal(imagePaths.length, 0, "all 20 visual modules must register with zero Image/src work");
assert.equal(pathsFor("meadow", "background").length, 0);
assert.equal(pathsFor("meadow", "platforms").length, 0);
assert.equal(pathsFor("meadow", "hazards").length, 0);

const menuVisuals = api.BIOME_PLATFORM_VISUALS.resolveBackground(
  "undergroundTemple"
);
assert.equal(imagePaths.length, 0, "background lookup must not resolve a platform kit");
const firstMenuRequest = menuVisuals.requestBackgroundAssets();
const repeatedMenuRequest = menuVisuals.requestBackgroundAssets();
assert.equal(firstMenuRequest, repeatedMenuRequest, "loading requests must reuse one promise");
assert.ok(pathsFor("undergroundTemple", "background").length > 0);
assert.equal(pathsFor("undergroundTemple", "platforms").length, 0);
assert.equal(pathsFor("undergroundTemple", "hazards").length, 0);
assert.equal(pathsFor("undergroundTemple", "decor").length, 0);
assert.equal(pathsFor("undergroundTemple", "portal").length, 0);
assert.equal(new Set(imagePaths).size, imagePaths.length, "menu requests must not duplicate src");

const beforePlatformResolve = imagePaths.length;
const autumnVisuals = api.BIOME_PLATFORM_VISUALS.resolve("autumn");
const afterPlatformResolve = imagePaths.length;
assert.ok(afterPlatformResolve > beforePlatformResolve);
assert.equal(pathsFor("autumn", "platforms").length, 12);
assert.equal(api.BIOME_PLATFORM_VISUALS.resolve("autumn"), autumnVisuals);
assert.equal(imagePaths.length, afterPlatformResolve, "repeated resolve must reuse the kit");

const beforeMeadow = imagePaths.length;
const meadowRequest = api.requestFairyTaleBiomeGameplayAssets("meadow");
assert.equal(meadowRequest.biomeId, "meadow");
for (const category of ["background", "platforms", "hazards", "decor", "portal"]) {
  assert.ok(pathsFor("meadow", category).length > 0, `Meadow ${category} must load`);
}
assert.ok(imagePaths.length > beforeMeadow);
const afterMeadow = imagePaths.length;
api.requestFairyTaleBiomeGameplayAssets("meadow");
assert.equal(imagePaths.length, afterMeadow, "current-biome requests must be idempotent");

assert.equal(api.getNextBiome("meadow").id, "coast");
assert.equal(api.getNextBiome("coast").id, "desert");
assert.equal(api.getNextBiome("undergroundTemple").id, "meadow");

api.requestCurrentBiomeVisualAssets(1);
assert.equal(idleCallbacks.length, 1, "Meadow must schedule exactly one Coast preload");
assert.equal(pathsFor("coast", "background").length, 0, "next preload must stay deferred");
idleCallbacks.shift()();
for (const category of ["background", "platforms", "hazards", "decor", "portal"]) {
  assert.ok(pathsFor("coast", category).length > 0, `Coast ${category} must preload`);
}
const afterCoast = imagePaths.length;
api.requestCurrentBiomeVisualAssets(1);
assert.equal(idleCallbacks.length, 0);
assert.equal(imagePaths.length, afterCoast);

api.requestCurrentBiomeVisualAssets(11);
assert.equal(idleCallbacks.length, 1, "Coast must schedule Desert");
assert.equal(pathsFor("desert", "background").length, 0);
idleCallbacks.shift()();
assert.ok(pathsFor("desert", "platforms").length > 0);
assert.ok(pathsFor("desert", "background").length > 0);
assert.ok(pathsFor("desert", "hazards").length > 0);

const meadowPathCountBeforeWrap = pathsFor("meadow").length;
assert.equal(api.scheduleNextBiomeVisualPreload("undergroundTemple").id, "meadow");
assert.equal(idleCallbacks.length, 1, "Underground Temple must wrap to Meadow");
idleCallbacks.shift()();
assert.equal(
  pathsFor("meadow").length,
  meadowPathCountBeforeWrap,
  "wrap preload must reuse already loaded Meadow assets"
);

sandbox.fairyTaleMode = false;
const beforeLegacyRequest = imagePaths.length;
assert.equal(api.requestCurrentBiomeVisualAssets(181), null);
assert.equal(imagePaths.length, beforeLegacyRequest, "Legacy mode must not request Fairy assets");
sandbox.fairyTaleMode = true;
assert.equal(api.requestCurrentBiomeVisualAssets(181).biomeId, "redMoon");
assert.ok(pathsFor("redMoon", "platforms").length > 0);
assert.equal(idleCallbacks.length, 1, "Red Moon must schedule Underground Temple");
sandbox.fairyTaleMode = false;
idleCallbacks.shift()();
assert.equal(
  pathsFor("undergroundTemple", "platforms").length,
  0,
  "an idle callback reached in Legacy must not start Fairy assets"
);
sandbox.fairyTaleMode = true;
api.scheduleNextBiomeVisualPreload("redMoon");
assert.equal(idleCallbacks.length, 1, "a skipped Legacy idle preload must be retryable");
idleCallbacks.shift()();
assert.ok(pathsFor("undergroundTemple", "platforms").length > 0);

completeImagesImmediately = false;
const loadingVisuals = api.BIOME_PLATFORM_VISUALS.resolveBackground("alienJungle");
const loadingPromise = loadingVisuals.requestBackgroundAssets();
assert.equal(loadingVisuals.requestBackgroundAssets(), loadingPromise);
assert.equal(
  loadingVisuals.drawBackground({}, 1280, 720, 0),
  false,
  "an in-flight background must preserve the existing fallback contract"
);
assert.equal(new Set(imagePaths).size, imagePaths.length, "all lazy requests must assign src once");

console.log(
  "Lazy biome registration, selected background priority, current/next loading, wrap, Legacy and fallback tests passed."
);
