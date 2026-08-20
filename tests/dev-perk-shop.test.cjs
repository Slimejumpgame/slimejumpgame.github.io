"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function createDevPerkShopFixture() {
  const protectedProgress = {
    slimejumperPlayerLevel: "73",
    slimejumperPlayerLevelXP: "4567",
    slimejumperPrestigeLevel: "4",
    slimejumperStarBalance: "777",
    slimejumperUnlockedSlimeColors: '["green","blue"]',
    slimejumperUnlockedSlimeCosmetics: '["crown"]',
    slimejumperUnlockedSlimeBeards: '["wizard"]',
    slimejumperAchievements: '["first_jump"]',
    slimejumperHighestCheckpointLevel: "190",
    slimejumperBest: "123456",
    slimejumperHighscoresV14: '[{"score":123456}]'
  };
  const localStorage = createStorage({
    ...protectedProgress,
    slimejumperUnlockedPerks: "[]",
    slimejumperSelectedPerks: "[]"
  });
  const window = {};
  const context = vm.createContext({
    window,
    localStorage,
    console,
    DEV_MODE: true
  });

  const achievementSource = read("js/slime-achievements.js");
  const economyStart = achievementSource.indexOf("  function canPurchaseDevShopTestUnlock");
  const economyEnd = achievementSource.indexOf("  function canPurchaseUnlock", economyStart);
  assert.ok(economyStart >= 0 && economyEnd > economyStart);
  vm.runInContext(
    `
      const DEV_SHOP_TEST_INITIAL_BALANCE = 1000;
      const activeWardrobePurchases = new Set();
      let devShopTestActive = true;
      let devShopTestBalance = DEV_SHOP_TEST_INITIAL_BALANCE;
      function isDevModeEnabled() { return DEV_MODE === true; }
    ` + achievementSource.slice(economyStart, economyEnd) + `
      window.SlimeDevShopTest = {
        isActive: () => devShopTestActive && isDevModeEnabled(),
        setActive: value => { devShopTestActive = Boolean(value); },
        getBalance: () => devShopTestBalance,
        purchaseUnlock: purchaseDevShopTestUnlock,
        refillBalance: refillDevShopTestBalance
      };
    `,
    context,
    {filename: "js/slime-achievements-dev-perk-shop-test-slice.js"}
  );
  vm.runInContext(
    read("js/slime-perks.js"),
    context,
    {filename: "js/slime-perks.js"}
  );

  return {
    api: window.SlimePerks,
    context,
    localStorage,
    protectedProgress,
    window
  };
}

function assertRealPurchasePerkPathUsesDevEconomy() {
  const fixture = createDevPerkShopFixture();
  const {api, window, localStorage} = fixture;

  const airHopPurchase = api.purchasePerk("air_hop");
  assert.equal(airHopPurchase.ok, true);
  assert.equal(airHopPurchase.test, true);
  assert.equal(airHopPurchase.price, api.balance.PERK_UNLOCK_COST);
  assert.equal(window.SlimeDevShopTest.getBalance(), 500);
  assert.equal(api.getStoredUnlockedPerkIds().includes("air_hop"), true);

  const airBrakePurchase = api.purchasePerk("air_brake");
  assert.equal(airBrakePurchase.ok, true);
  assert.equal(airBrakePurchase.test, true);
  assert.equal(window.SlimeDevShopTest.getBalance(), 0);
  assert.equal(api.getStoredUnlockedPerkIds().includes("air_brake"), true);
  assert.equal(localStorage.snapshot().slimejumperStarBalance, "777");

  return fixture;
}

function runUiReset(fixture) {
  const {api, context, localStorage, window} = fixture;
  api.toggleSelectedPerk("air_hop");
  api.captureRunPerkSnapshot();
  api.setDevUnlockOverride(true);
  localStorage.setItem("slimejumperAirHopConflictPurchaseInfoSeen", "true");
  localStorage.setItem("slimejumperAirBrakeConflictPurchaseInfoSeen", "true");

  context.PERK_CONFLICT_PURCHASE_INFO = {
    air_hop: {seenStorageKey: "slimejumperAirHopConflictPurchaseInfoSeen"},
    air_brake: {seenStorageKey: "slimejumperAirBrakeConflictPurchaseInfoSeen"}
  };
  context.isDevShopTestActive = () => window.SlimeDevShopTest.isActive();
  context.showGameToast = () => {};
  context.closePerkConflictPurchaseInfo = () => {};
  context.renderDevShopTestControl = () => {};
  context.renderPerksScreen = () => {};
  context.CustomEvent = function CustomEvent(type) { this.type = type; };
  context.ui = {
    devUnlockPerksBtn: {
      textContent: "",
      setAttribute() {}
    }
  };
  window.dispatchEvent = () => {};

  const uiSource = read("js/ui.js");
  const resetStart = uiSource.indexOf("  function resetDevPerkPurchaseTest()");
  const resetEnd = uiSource.indexOf("  function initializeMenuBiomeBackground", resetStart);
  assert.ok(resetStart >= 0 && resetEnd > resetStart);
  vm.runInContext(
    uiSource.slice(resetStart, resetEnd) + `
      globalThis.resetDevPerkPurchaseTestForTest = resetDevPerkPurchaseTest;
    `,
    context,
    {filename: "js/ui-dev-perk-reset-test-slice.js"}
  );
  return context.resetDevPerkPurchaseTestForTest();
}

function assertScopedResetProtectsProgression() {
  const fixture = assertRealPurchasePerkPathUsesDevEconomy();
  assert.equal(runUiReset(fixture), true);

  const stored = fixture.localStorage.snapshot();
  assert.deepEqual(JSON.parse(stored.slimejumperUnlockedPerks), []);
  assert.deepEqual(JSON.parse(stored.slimejumperSelectedPerks), []);
  assert.deepEqual(Array.from(fixture.api.getActiveRunPerkIds()), []);
  assert.equal(fixture.api.isDevUnlockOverrideActive(), false);
  assert.equal(stored.slimejumperAirHopConflictPurchaseInfoSeen, undefined);
  assert.equal(stored.slimejumperAirBrakeConflictPurchaseInfoSeen, undefined);
  assert.equal(fixture.window.SlimeDevShopTest.getBalance(), 1000);

  Object.entries(fixture.protectedProgress).forEach(([key, value]) => {
    assert.equal(stored[key], value, `${key} must remain untouched by the DEV perk reset`);
  });
}

function assertDevOnlyAndDynamicUiGuards() {
  const fixture = createDevPerkShopFixture();
  fixture.context.DEV_MODE = false;
  fixture.localStorage.setItem("slimejumperUnlockedPerks", '["air_hop"]');
  assert.equal(fixture.api.resetDevPerkPurchaseTestState(), false);
  assert.deepEqual(JSON.parse(fixture.localStorage.snapshot().slimejumperUnlockedPerks), ["air_hop"]);

  const uiSource = read("js/ui.js");
  assert.match(uiSource, /perks\.definitions\.forEach\(perk => \{/);
  assert.match(uiSource, /\? "FÄHIGKEITEN \/ PERKS"/);
  assert.match(uiSource, /if \(DEV_MODE && ui\.devShopTestBtn\) \{[\s\S]*?resetDevPerkPurchaseTest/);
  assert.match(uiSource, /const purchase = perks\.purchasePerk\(perk\.id\);/);
}

assertScopedResetProtectsProgression();
assertDevOnlyAndDynamicUiGuards();
console.log("DEV perk shop tests passed.");
