"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function createStorage(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key, String(value)])
  );
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

class FakeClassList {
  constructor() { this.values = new Set(["hidden"]); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor() {
    this.attributes = {};
    this.checked = false;
    this.classList = new FakeClassList();
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  focus() { this.focusCount += 1; }
}

function loadIntroController({unlocked = false, storage = createStorage()} = {}) {
  const ui = {
    goldShopIntroOverlay: new FakeElement(),
    goldShopIntroSkipCheckbox: new FakeElement(),
    goldShopIntroConfirmBtn: new FakeElement()
  };
  const previousFocus = new FakeElement();
  const openedViews = [];
  const source = read("js/ui.js");
  const sliceStart = source.indexOf("  const GOLD_SHOP_INTRO_SKIP_STORAGE_KEY");
  const sliceEnd = source.indexOf("  function showUpdateScreen", sliceStart);
  assert.ok(sliceStart >= 0 && sliceEnd > sliceStart);

  const context = vm.createContext({
    ui,
    localStorage: storage,
    document: {activeElement: previousFocus},
    window: {
      SlimeGold: {isGoldShopUnlocked: () => unlocked},
      requestAnimationFrame: callback => callback()
    },
    showWardrobeView(viewName) { openedViews.push(viewName); },
    console
  });
  vm.runInContext(
    source.slice(sliceStart, sliceEnd) + `
      globalThis.goldShopIntroTestApi = {
        requestGoldWardrobeOpen,
        confirmGoldShopIntro,
        closeGoldShopIntro,
        shouldSkipGoldShopIntro
      };
    `,
    context,
    {filename: "js/ui-gold-shop-intro-test-slice.js"}
  );
  return {
    api: context.goldShopIntroTestApi,
    openedViews,
    previousFocus,
    storage,
    ui
  };
}

function assertLockedPopupFlow() {
  const unchecked = loadIntroController();
  assert.equal(unchecked.api.requestGoldWardrobeOpen(), true);
  assert.equal(unchecked.ui.goldShopIntroOverlay.classList.contains("hidden"), false);
  assert.equal(unchecked.ui.goldShopIntroOverlay.attributes["aria-hidden"], "false");
  assert.equal(unchecked.ui.goldShopIntroConfirmBtn.focusCount, 1);
  assert.deepEqual(unchecked.openedViews, []);

  unchecked.api.confirmGoldShopIntro();
  assert.equal(unchecked.ui.goldShopIntroOverlay.classList.contains("hidden"), true);
  assert.equal(unchecked.ui.goldShopIntroOverlay.attributes["aria-hidden"], "true");
  assert.equal(unchecked.storage.snapshot().slimejumperSkipGoldShopIntro, undefined);
  assert.deepEqual(unchecked.openedViews, ["gold"]);

  const checkedStorage = createStorage();
  const checked = loadIntroController({storage: checkedStorage});
  checked.api.requestGoldWardrobeOpen();
  checked.ui.goldShopIntroSkipCheckbox.checked = true;
  checked.api.confirmGoldShopIntro();
  assert.equal(checkedStorage.snapshot().slimejumperSkipGoldShopIntro, "true");
  assert.deepEqual(checked.openedViews, ["gold"]);

  const reloaded = loadIntroController({storage: checkedStorage});
  reloaded.api.requestGoldWardrobeOpen();
  assert.equal(reloaded.ui.goldShopIntroOverlay.classList.contains("hidden"), true);
  assert.deepEqual(reloaded.openedViews, ["gold"]);

  const dismissedStorage = createStorage();
  const dismissed = loadIntroController({storage: dismissedStorage});
  dismissed.api.requestGoldWardrobeOpen();
  dismissed.ui.goldShopIntroSkipCheckbox.checked = true;
  dismissed.api.closeGoldShopIntro();
  assert.equal(dismissedStorage.snapshot().slimejumperSkipGoldShopIntro, undefined);
  assert.deepEqual(dismissed.openedViews, []);
  assert.equal(dismissed.previousFocus.focusCount, 1);
}

function assertUnlockedDirectFlow() {
  const withoutSkip = loadIntroController({unlocked: true});
  withoutSkip.api.requestGoldWardrobeOpen();
  assert.deepEqual(withoutSkip.openedViews, ["gold"]);
  assert.equal(withoutSkip.ui.goldShopIntroOverlay.classList.contains("hidden"), true);

  const withSkip = loadIntroController({
    unlocked: true,
    storage: createStorage({slimejumperSkipGoldShopIntro: "true"})
  });
  withSkip.api.requestGoldWardrobeOpen();
  assert.deepEqual(withSkip.openedViews, ["gold"]);
  assert.equal(withSkip.ui.goldShopIntroOverlay.classList.contains("hidden"), true);
}

function assertReleasePreferenceReset() {
  const storage = createStorage({
    slimejumperGlobalProgressResetVersion: "progress-reset-2.43",
    slimejumperPreferenceResetVersion: "older-reset",
    slimejumperSkipTutorial: "true",
    slimejumperSkipEndRunWarning: "true",
    slimejumperSkipCheckpointIntro: "true",
    slimejumperSkipGoldShopIntro: "true",
    slimejumperPlayerLevel: "73",
    slimejumperGoldProgressV1: "gold-progress",
    unrelatedProgress: "keep-me"
  });
  vm.runInContext(
    read("js/slime-progress-reset.js"),
    vm.createContext({localStorage: storage}),
    {filename: "js/slime-progress-reset.js"}
  );
  const stored = storage.snapshot();
  assert.equal(stored.slimejumperSkipTutorial, undefined);
  assert.equal(stored.slimejumperSkipEndRunWarning, undefined);
  assert.equal(stored.slimejumperSkipCheckpointIntro, undefined);
  assert.equal(stored.slimejumperSkipGoldShopIntro, undefined);
  assert.equal(stored.slimejumperPreferenceResetVersion, "preferences-reset-2.58");
  assert.equal(stored.slimejumperGlobalProgressResetVersion, "progress-reset-2.43");
  assert.equal(stored.slimejumperPlayerLevel, "73");
  assert.equal(stored.slimejumperGoldProgressV1, "gold-progress");
  assert.equal(stored.unrelatedProgress, "keep-me");
}

function assertMarkupAndScopedIntegration() {
  const html = read("index.html");
  assert.match(
    html,
    /id="goldShopIntroOverlay" class="overlay checkpointOverlay hidden"[\s\S]*?id="goldShopIntroTitle">GOLD-SHOP<[\s\S]*?500 abgeschlossenen Leveln[\s\S]*?5 normalen Slime-Farben[\s\S]*?5\.000 Sterne[\s\S]*?id="goldShopIntroSkipCheckbox"[\s\S]*?Nicht mehr anzeigen[\s\S]*?id="goldShopIntroConfirmBtn"[\s\S]*?VERSTANDEN/
  );

  const coreSource = read("js/core.js");
  assert.match(coreSource, /goldShopIntroOverlay: document\.getElementById/);
  assert.match(coreSource, /goldShopIntroSkipCheckbox: document\.getElementById/);
  assert.match(coreSource, /goldShopIntroConfirmBtn: document\.getElementById/);

  const gameSource = read("js/game.js");
  assert.match(
    gameSource,
    /ui\.wardrobeGoldMenuBtn\.addEventListener\("click", \(\) => runMenuButtonAction\(ui\.wardrobeGoldMenuBtn, requestGoldWardrobeOpen\)\)/
  );
  assert.equal(
    (gameSource.match(/requestGoldWardrobeOpen/g) ?? []).length,
    1,
    "the intro request must only be wired to the active Gold wardrobe menu click"
  );

  const resetSource = read("js/slime-progress-reset.js");
  assert.match(resetSource, /PREFERENCE_RESET_VERSION = "preferences-reset-2\.58"/);
  assert.match(resetSource, /"slimejumperSkipGoldShopIntro"/);
  assert.doesNotMatch(read("js/slime-prestige.js"), /slimejumperSkipGoldShopIntro/);
}

assertLockedPopupFlow();
assertUnlockedDirectFlow();
assertReleasePreferenceReset();
assertMarkupAndScopedIntegration();
console.log("Gold Shop intro tests passed.");
