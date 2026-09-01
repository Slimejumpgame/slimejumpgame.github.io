"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const uiSource = read("js/ui.js");
const gameSource = read("js/game.js");
const rendererSource = read("js/renderer.js");
const biomeSource = read("js/biomes.js");

const expectedBiomeIds = Object.freeze([
  "meadow",
  "coast",
  "desert",
  "volcano",
  "snow",
  "swamp",
  "crystalCave",
  "night",
  "autumn",
  "sky",
  "stormNight",
  "neonCity",
  "mushroomCave",
  "abandonedMine",
  "bambooNight",
  "pirateHarbor",
  "alienJungle",
  "enchantedGarden",
  "redMoon",
  "undergroundTemple"
]);
const biomeBlock = biomeSource.slice(
  biomeSource.indexOf("  const BIOMES = ["),
  biomeSource.indexOf("  function getBiomeForLevel")
);
const biomeIds = [...biomeBlock.matchAll(/^\s+id: "([^"]+)",$/gm)]
  .map(match => match[1]);
assert.deepEqual(biomeIds, expectedBiomeIds);

const menuStart = uiSource.indexOf("  let menuBiomeBackgroundState = null;");
const menuEnd = uiSource.indexOf("  function getActiveSlimeColor", menuStart);
assert.ok(menuStart >= 0 && menuEnd > menuStart);
const menuSource = uiSource.slice(menuStart, menuEnd);
assert.match(
  menuSource,
  /const selectedBiome = BIOMES\[Math\.floor\(Math\.random\(\) \* BIOMES\.length\)\]/
);
assert.deepEqual(
  Array.from(
    {length: expectedBiomeIds.length},
    (_, index) => Math.floor(
      ((index + 0.5) / expectedBiomeIds.length) * expectedBiomeIds.length
    )
  ),
  Array.from({length: expectedBiomeIds.length}, (_, index) => index)
);

let randomCalls = 0;
let registryResolveCalls = 0;
let menuHidden = false;
const graphicsState = {mode: "fairyTale"};
let menuContext = null;
const drawTimes = [];
const contextCalls = [];
const legacyDraws = [];
const math = Object.create(Math);
math.random = () => {
  randomCalls++;
  return 15.25 / expectedBiomeIds.length;
};
const menuCanvas = {
  className: "",
  width: 0,
  height: 0,
  dataset: {},
  setAttribute() {},
  getContext(type) {
    assert.equal(type, "2d");
    menuContext = {
      clearRect(...args) { contextCalls.push(["clearRect", ...args]); },
      drawImage(...args) { contextCalls.push(["drawImage", ...args]); }
    };
    return menuContext;
  }
};
const menuBackdrop = {
  dataset: {},
  child: null,
  querySelector(selector) {
    assert.equal(selector, ".menuBiomeBackground");
    return this.child;
  },
  prepend(element) {
    this.child = element;
  }
};
const document = {
  hidden: false,
  querySelector(selector) {
    assert.equal(selector, ".menuBackdrop");
    return menuBackdrop;
  },
  createElement(name) {
    assert.equal(name, "canvas");
    return menuCanvas;
  }
};
const visual = {
  drawBackground(context, width, height, elapsedSeconds) {
    assert.equal(context, menuContext);
    assert.equal(width, 1280);
    assert.equal(height, 720);
    drawTimes.push(elapsedSeconds);
    return drawTimes.length !== 1;
  },
  drawPlatform() {
    assert.fail("Menu background must not draw platforms");
  },
  drawBottomDeathHazard() {
    assert.fail("Menu background must not draw hazards");
  }
};
const context = vm.createContext({
  BIOMES: expectedBiomeIds.map(id => ({id})),
  W: 1280,
  H: 720,
  Math: math,
  console,
  document,
  graphicsState,
  canvas: {kind: "game-canvas"},
  drawBackground(biome) {
    legacyDraws.push(biome.id);
  },
  isFairyTaleGraphicsMode() {
    return graphicsState.mode === "fairyTale";
  },
  ui: {
    menu: {
      classList: {
        contains(name) {
          assert.equal(name, "hidden");
          return menuHidden;
        }
      }
    }
  }
});
vm.runInContext(`${menuSource}
  globalThis.menuBackgroundForTest = {
    initializeMenuBiomeBackground,
    updateMenuBiomeBackground,
    pauseMenuBiomeBackgroundClock,
    refreshMenuBiomeBackgroundForGraphicsMode,
    setGraphicsMode(mode) {
      graphicsState.mode = mode;
      refreshMenuBiomeBackgroundForGraphicsMode();
    }
  };
`, context, {filename: "main-menu-background-fixture.js"});

assert.equal(randomCalls, 1);
assert.equal(menuBackdrop.dataset.biomeId, "pirateHarbor");
assert.equal(menuCanvas.dataset.biomeId, "pirateHarbor");
assert.equal(menuCanvas.width, 1280);
assert.equal(menuCanvas.height, 720);
assert.equal(menuBackdrop.child, menuCanvas);
context.menuBackgroundForTest.initializeMenuBiomeBackground();
assert.equal(randomCalls, 1);

assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(1000), false);
assert.equal(registryResolveCalls, 0);
assert.equal(drawTimes.length, 0);

context.BIOME_PLATFORM_VISUALS = {
  resolve(id) {
    registryResolveCalls++;
    assert.equal(id, "pirateHarbor");
    return visual;
  }
};
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(1016), false);
assert.equal(registryResolveCalls, 1);
assert.deepEqual(drawTimes, [0.016]);
assert.deepEqual(contextCalls, []);
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(1040), true);
assert.deepEqual(drawTimes, [0.016, 0.04]);
assert.equal(registryResolveCalls, 1);
assert.equal(randomCalls, 1);

menuHidden = true;
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(5000), false);
assert.deepEqual(drawTimes, [0.016, 0.04]);
menuHidden = false;
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(6000), true);
assert.deepEqual(drawTimes, [0.016, 0.04, 0.04]);
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(6010), true);
assert.deepEqual(drawTimes, [0.016, 0.04, 0.04, 0.05]);

document.hidden = true;
context.menuBackgroundForTest.pauseMenuBiomeBackgroundClock();
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(9000), false);
document.hidden = false;
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(12000), true);
assert.deepEqual(drawTimes, [0.016, 0.04, 0.04, 0.05, 0.05]);
assert.equal(randomCalls, 1);
assert.deepEqual(contextCalls, []);

context.menuBackgroundForTest.setGraphicsMode("legacy");
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(13000), true);
assert.deepEqual(legacyDraws, ["pirateHarbor"]);
assert.deepEqual(contextCalls, [["drawImage", context.canvas, 0, 0, 1280, 720]]);
assert.deepEqual(drawTimes, [0.016, 0.04, 0.04, 0.05, 0.05]);
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(19000), true);
assert.deepEqual(legacyDraws, ["pirateHarbor"]);

context.menuBackgroundForTest.setGraphicsMode("fairyTale");
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(20000), true);
assert.equal(context.menuBackgroundForTest.updateMenuBiomeBackground(20010), true);
assert.deepEqual(drawTimes.slice(0, -1), [0.016, 0.04, 0.04, 0.05, 0.05, 0.05]);
assert.ok(Math.abs(drawTimes.at(-1) - 0.06) < Number.EPSILON);
assert.equal(randomCalls, 1);

assert.doesNotMatch(menuSource, /requestAnimationFrame/);
assert.doesNotMatch(menuSource, /setTimeout|setInterval/);
assert.doesNotMatch(menuSource, /clearRect/);
assert.doesNotMatch(menuSource, /\bdraw\s*\(/);
assert.doesNotMatch(menuSource, /drawPlatforms|drawBottomDeathHazard|drawHUD/);
assert.match(
  menuSource,
  /BIOME_PLATFORM_VISUALS\.resolveBackground[\s\S]*?selectedBiome\.id/
);
assert.match(
  menuSource,
  /visuals\.requestBackgroundAssets\?\.\(\)/
);
assert.match(
  menuSource,
  /drawBackground\(menuBiomeBackgroundState\.selectedBiome\)[\s\S]*?context\.drawImage\(canvas, 0, 0, W, H\)/
);
assert.match(
  gameSource,
  /function frame\(now\)[\s\S]*?updateMainMenuMascotFaceAnimation\(now\);[\s\S]*?draw\(\);[\s\S]*?requestAnimationFrame\(frame\);/
);
assert.equal((gameSource.match(/requestAnimationFrame\(frame\)/g) || []).length, 2);
assert.match(
  uiSource,
  /function updateMainMenuMascotFaceAnimation\([\s\S]*?updateMenuBiomeBackground\(timestamp\);/
);
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{\s*drawBackground\(biome\);\s*\}/
);

console.log("Animated, pausable final-biome main-menu background tests passed.");
