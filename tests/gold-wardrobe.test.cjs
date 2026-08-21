"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function readHead(relativePath) {
  return execFileSync("git", ["show", `HEAD:${relativePath.replace(/\\/g, "/")}`], {
    cwd: root,
    encoding: "utf8"
  });
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function createEconomy(initialBalance = 0) {
  let balance = initialBalance;
  const active = new Set();
  return {
    getBalance: () => balance,
    setBalance(value) { balance = value; },
    canPurchaseUnlock(request) {
      return !request.isUnlocked() && !active.has(request.purchaseKey) && balance >= request.price;
    },
    purchaseUnlock(request) {
      if (request.isUnlocked()) return {ok: false, reason: "already-unlocked", balance};
      if (balance < request.price) return {ok: false, reason: "insufficient-stars", balance};
      if (active.has(request.purchaseKey)) {
        return {ok: false, reason: "purchase-in-progress", balance};
      }
      active.add(request.purchaseKey);
      const previousBalance = balance;
      try {
        balance -= request.price;
        if (request.unlock() !== true || request.isUnlocked() !== true) {
          request.rollback?.();
          balance = previousBalance;
          return {ok: false, reason: "unlock-failed", balance};
        }
        return {ok: true, purchaseKey: request.purchaseKey, price: request.price, balance};
      } finally {
        active.delete(request.purchaseKey);
      }
    }
  };
}

function createDefaultState() {
  return {
    slime: {completedLevels: 0, distinctColorIds: [], masteryUnlocked: false, purchased: false},
    hats: {completedLevels: 0, distinctHatIds: [], masteryUnlocked: false, purchasedGoldHatIds: []},
    beards: {completedLevels: 0, distinctBeardIds: [], masteryUnlocked: false, purchasedGoldBeardIds: []},
    equipped: {slime: false, hatId: null, beardId: null}
  };
}

function loadGold({state = null, storage = null, balance = 0, devMode = false} = {}) {
  const localStorage = storage ?? createStorage(
    state === null ? {} : {slimejumperGoldProgressV1: JSON.stringify(state)}
  );
  const economy = createEconomy(balance);
  const window = {
    SlimeStarEconomy: economy,
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    dispatchEvent() {}
  };
  const context = vm.createContext({
    window,
    localStorage,
    console,
    DEV_MODE: devMode,
    SLIME_COLOR_ORDER: ["purple", "blue", "cyan", "green", "yellow", "orange"],
    UNLOCKABLE_SLIME_COSMETICS: ["cap", "crown", "top_hat", "wizard_hat", "pirate_hat", "halo"],
    UNLOCKABLE_SLIME_BEARDS: ["stubble", "mustache", "goatee", "full_beard", "viking_beard", "circle_beard"]
  });
  vm.runInContext(read("js/slime-gold.js"), context, {filename: "js/slime-gold.js"});
  return {api: window.SlimeGold, localStorage, economy, context};
}

function masteryState(category, overrides = {}) {
  const state = createDefaultState();
  const ids = category === "slime"
    ? ["purple", "blue", "cyan", "green", "yellow"]
    : category === "hats"
      ? ["cap", "crown", "top_hat", "wizard_hat", "pirate_hat"]
      : ["stubble", "mustache", "goatee", "full_beard", "viking_beard"];
  const target = state[category];
  target.completedLevels = 500;
  target[category === "slime" ? "distinctColorIds" : category === "hats" ? "distinctHatIds" : "distinctBeardIds"] = ids;
  Object.assign(target, overrides);
  return state;
}

function assertFreshAndDefensiveState() {
  const fresh = loadGold();
  assert.deepEqual(plain(fresh.api.getProgress()), createDefaultState());
  assert.equal(fresh.api.isGoldShopUnlocked(), false);
  assert.equal(fresh.api.ownsGoldSlime(), false);
  assert.equal(fresh.api.ownsGoldHat("cap"), false);
  assert.equal(fresh.api.ownsGoldBeard("stubble"), false);
  assert.equal(fresh.api.slimePrice, 5000);
  assert.equal(fresh.api.itemPrice, 1000);
  assert.ok(fresh.localStorage.snapshot().slimejumperGoldProgressV1);

  const corrupt = createDefaultState();
  corrupt.slime.completedLevels = -40;
  corrupt.slime.distinctColorIds = ["green", "green", "unknown", "purple"];
  corrupt.hats.completedLevels = 999999999999999999999;
  corrupt.hats.distinctHatIds = ["crown", "unknown", "crown"];
  corrupt.hats.purchasedGoldHatIds = ["cap", "cap", "bad"];
  corrupt.beards.completedLevels = "broken";
  corrupt.beards.distinctBeardIds = ["stubble", "stubble", "bad"];
  corrupt.beards.purchasedGoldBeardIds = ["circle_beard", "bad", "circle_beard"];
  corrupt.equipped = {slime: true, hatId: "unknown", beardId: "unknown"};
  const defensive = loadGold({state: corrupt}).api.getProgress();
  assert.equal(defensive.slime.completedLevels, 0);
  assert.deepEqual(plain(defensive.slime.distinctColorIds), ["purple", "green"]);
  assert.equal(defensive.hats.completedLevels, 0);
  assert.deepEqual(plain(defensive.hats.distinctHatIds), ["crown"]);
  assert.deepEqual(plain(defensive.hats.purchasedGoldHatIds), ["cap"]);
  assert.deepEqual(plain(defensive.beards.distinctBeardIds), ["stubble"]);
  assert.deepEqual(plain(defensive.beards.purchasedGoldBeardIds), ["circle_beard"]);
  assert.deepEqual(plain(defensive.equipped), {slime: false, hatId: null, beardId: null});
}

function assertProgressionBoundaries() {
  for (const category of ["slime", "hats", "beards"]) {
    const idsKey = category === "slime"
      ? "distinctColorIds"
      : category === "hats"
        ? "distinctHatIds"
        : "distinctBeardIds";
    const masteryMethod = category === "slime"
      ? "isGoldSlimeMasteryUnlocked"
      : category === "hats"
        ? "isGoldHatMasteryUnlocked"
        : "isGoldBeardMasteryUnlocked";
    const state499 = masteryState(category, {completedLevels: 499});
    assert.equal(loadGold({state: state499}).api[masteryMethod](), false, `${category} unlocked at 499`);

    const stateFour = masteryState(category);
    stateFour[category][idsKey].pop();
    assert.equal(loadGold({state: stateFour}).api[masteryMethod](), false, `${category} unlocked with four IDs`);
    assert.equal(loadGold({state: masteryState(category)}).api[masteryMethod](), true);
  }

  const repeated = loadGold();
  for (let index = 0; index < 500; index++) {
    repeated.api.recordCompletedLevel({
      colorId: "green",
      cosmeticId: "cap",
      beardId: "stubble"
    });
  }
  const repeatedProgress = repeated.api.getProgress();
  assert.equal(repeatedProgress.slime.completedLevels, 500);
  assert.equal(repeatedProgress.hats.completedLevels, 500);
  assert.equal(repeatedProgress.beards.completedLevels, 500);
  assert.deepEqual(plain(repeatedProgress.slime.distinctColorIds), ["green"]);
  assert.deepEqual(plain(repeatedProgress.hats.distinctHatIds), ["cap"]);
  assert.deepEqual(plain(repeatedProgress.beards.distinctBeardIds), ["stubble"]);
  assert.equal(repeated.api.isGoldShopUnlocked(), false);

  const noAccessories = loadGold();
  noAccessories.api.recordCompletedLevel({colorId: "green", cosmeticId: "none", beardId: "none"});
  const noAccessoryProgress = noAccessories.api.getProgress();
  assert.equal(noAccessoryProgress.slime.completedLevels, 1);
  assert.deepEqual(plain(noAccessoryProgress.slime.distinctColorIds), ["green"]);
  assert.equal(noAccessoryProgress.hats.completedLevels, 0);
  assert.equal(noAccessoryProgress.beards.completedLevels, 0);

  const parallel = loadGold();
  parallel.api.recordCompletedLevel({colorId: "purple", cosmeticId: "crown", beardId: "goatee"});
  parallel.api.recordCompletedLevel({colorId: "purple", cosmeticId: "crown", beardId: "goatee"});
  const parallelProgress = parallel.api.getProgress();
  assert.equal(parallelProgress.slime.completedLevels, 2);
  assert.equal(parallelProgress.hats.completedLevels, 2);
  assert.equal(parallelProgress.beards.completedLevels, 2);
  assert.equal(parallelProgress.slime.distinctColorIds.length, 1);
  assert.equal(parallelProgress.hats.distinctHatIds.length, 1);
  assert.equal(parallelProgress.beards.distinctBeardIds.length, 1);

  const goldEquipped = loadGold();
  goldEquipped.api.recordCompletedLevel({
    colorId: "green",
    cosmeticId: "cap",
    beardId: "stubble",
    usesGoldSlime: true,
    usesGoldHat: true,
    usesGoldBeard: true
  });
  const goldEquippedProgress = goldEquipped.api.getProgress();
  assert.equal(goldEquippedProgress.slime.completedLevels, 1);
  assert.equal(goldEquippedProgress.slime.distinctColorIds.length, 0);
  assert.equal(goldEquippedProgress.hats.completedLevels, 0);
  assert.equal(goldEquippedProgress.beards.completedLevels, 0);
}

function assertNaturalMasteryAndShopGate() {
  const fresh = loadGold({balance: 10000});
  assert.equal(fresh.api.ownsGoldSlime(), false);
  assert.equal(fresh.api.isGoldShopUnlocked(), false);
  assert.equal(fresh.api.canPurchaseGoldItem("hat", "cap"), false);
  assert.equal(fresh.api.purchaseGoldItem("hat", "cap").reason, "shop-locked");

  const slimeMastery = loadGold({state: masteryState("slime")});
  assert.equal(slimeMastery.api.isGoldSlimeMasteryUnlocked(), true);
  assert.equal(slimeMastery.api.ownsGoldSlime(), true);
  assert.equal(slimeMastery.api.isGoldShopUnlocked(), true);

  const hatMastery = loadGold({state: masteryState("hats"), balance: 10000});
  assert.equal(hatMastery.api.isGoldHatMasteryUnlocked(), true);
  assert.equal(hatMastery.api.ownsGoldSlime(), false);
  assert.equal(hatMastery.api.isGoldShopUnlocked(), false);
  hatMastery.api.getGoldHatIds().forEach(
    id => assert.equal(hatMastery.api.ownsGoldHat(id), true)
  );
  assert.equal(hatMastery.api.canPurchaseGoldItem("beard", "stubble"), false);

  const beardMastery = loadGold({state: masteryState("beards"), balance: 10000});
  assert.equal(beardMastery.api.isGoldBeardMasteryUnlocked(), true);
  assert.equal(beardMastery.api.ownsGoldSlime(), false);
  assert.equal(beardMastery.api.isGoldShopUnlocked(), false);
  beardMastery.api.getGoldBeardIds().forEach(
    id => assert.equal(beardMastery.api.ownsGoldBeard(id), true)
  );
}

function assertPurchasesAndPersistence() {
  const belowSlime = loadGold({balance: 4999});
  assert.equal(belowSlime.api.canPurchaseGoldSlime(), false);
  assert.equal(belowSlime.api.purchaseGoldSlime().reason, "insufficient-stars");
  assert.equal(belowSlime.economy.getBalance(), 4999);
  assert.equal(belowSlime.api.ownsGoldSlime(), false);
  assert.equal(belowSlime.api.isGoldShopUnlocked(), false);

  const exactSlime = loadGold({balance: 5000});
  const exactSlimePurchase = exactSlime.api.purchaseGoldSlime();
  assert.equal(exactSlimePurchase.ok, true);
  assert.equal(exactSlimePurchase.price, 5000);
  assert.equal(exactSlimePurchase.balance, 0);
  assert.equal(exactSlime.api.ownsGoldSlime(), true);
  assert.equal(exactSlime.api.isGoldSlimeMasteryUnlocked(), false);
  assert.equal(exactSlime.api.isGoldShopUnlocked(), true);
  assert.equal(exactSlime.api.purchaseGoldSlime().reason, "already-unlocked");
  assert.equal(exactSlime.economy.getBalance(), 0);
  const slimeReloaded = loadGold({storage: exactSlime.localStorage, balance: 0});
  assert.equal(slimeReloaded.api.ownsGoldSlime(), true);
  assert.equal(slimeReloaded.api.isGoldSlimeMasteryUnlocked(), false);
  assert.equal(slimeReloaded.api.isGoldShopUnlocked(), true);

  const extraSlime = loadGold({balance: 5500});
  assert.equal(extraSlime.api.purchaseGoldSlime().ok, true);
  assert.equal(extraSlime.economy.getBalance(), 500);

  const state = createDefaultState();
  state.slime.purchased = true;
  const belowHat = loadGold({state, balance: 999});
  assert.equal(belowHat.api.canPurchaseGoldItem("hat", "cap"), false);
  assert.equal(belowHat.api.purchaseGoldItem("hat", "cap").reason, "insufficient-stars");
  assert.equal(belowHat.economy.getBalance(), 999);

  const exact = loadGold({state, balance: 1000});
  const exactPurchase = exact.api.purchaseGoldItem("hat", "cap");
  assert.equal(exactPurchase.ok, true);
  assert.equal(exactPurchase.balance, 0);
  assert.equal(exact.api.ownsGoldHat("cap"), true);
  assert.equal(exact.api.isGoldHatMasteryUnlocked(), false);
  assert.equal(exact.api.purchaseGoldItem("hat", "cap").reason, "already-unlocked");
  assert.equal(exact.economy.getBalance(), 0);
  const reloaded = loadGold({storage: exact.localStorage, balance: 0});
  assert.equal(reloaded.api.ownsGoldHat("cap"), true);
  assert.equal(reloaded.api.isGoldHatMasteryUnlocked(), false);

  const partial = loadGold({state, balance: 1500});
  const partialPurchase = partial.api.purchaseGoldItem("beard", "stubble");
  assert.equal(partialPurchase.ok, true);
  assert.equal(partialPurchase.balance, 500);
  assert.equal(partial.api.ownsGoldBeard("stubble"), true);

}

function assertMasteryAfterSlimePurchase() {
  const state = createDefaultState();
  state.slime.completedLevels = 499;
  state.slime.distinctColorIds = ["purple", "blue", "cyan", "green", "yellow"];
  state.slime.purchased = true;
  const fixture = loadGold({state, balance: 321});
  assert.equal(fixture.api.ownsGoldSlime(), true);
  assert.equal(fixture.api.isGoldSlimeMasteryUnlocked(), false);
  const result = fixture.api.recordCompletedLevel({
    colorId: "green",
    cosmeticId: "none",
    beardId: "none"
  });
  assert.deepEqual(plain(result.newlyUnlocked), ["slime"]);
  assert.equal(result.shopJustUnlocked, false);
  assert.equal(fixture.api.ownsGoldSlime(), true);
  assert.equal(fixture.api.isGoldSlimeMasteryUnlocked(), true);
  assert.equal(fixture.economy.getBalance(), 321);
  assert.equal(fixture.api.getProgress().slime.purchased, true);
}

function assertDevGoldSlimePurchaseAndBoundary() {
  const fixture = loadGold({devMode: true});
  assert.equal(fixture.api.setDevShopUnlocked(true), true);
  assert.equal(fixture.api.setDevShopBalance(4999), true);
  assert.equal(fixture.api.purchaseGoldSlime().reason, "insufficient-stars");
  assert.equal(fixture.api.ownsGoldSlime(), false);
  assert.equal(fixture.api.isGoldShopUnlocked(), false);

  assert.equal(fixture.api.setDevShopBalance(5000), true);
  const purchase = fixture.api.purchaseGoldSlime();
  assert.equal(purchase.ok, true);
  assert.equal(purchase.test, true);
  assert.equal(purchase.balance, 0);
  assert.equal(fixture.api.ownsGoldSlime(), true);
  assert.equal(fixture.api.isGoldSlimeMasteryUnlocked(), false);
  assert.equal(fixture.api.isGoldShopUnlocked(), true);

  assert.equal(fixture.api.prepareDevMasteryBoundary("slime"), true);
  assert.equal(fixture.api.ownsGoldSlime(), true, "DEV purchase was lost at 499/500 prep");
  assert.equal(fixture.api.getDevState().balance, 0);
  fixture.api.recordCompletedLevel({colorId: "green", cosmeticId: "none", beardId: "none"});
  assert.equal(fixture.api.isGoldSlimeMasteryUnlocked(), true);
  assert.equal(fixture.api.ownsGoldSlime(), true);
  assert.equal(fixture.api.isGoldShopUnlocked(), true);
  assert.equal(fixture.api.getDevState().balance, 0, "DEV mastery refunded the purchase");
}

function assertAccessoryMasteryBeforeGoldSlime() {
  for (const category of ["hats", "beards"]) {
    const state = masteryState(category, {completedLevels: 499});
    const fixture = loadGold({state, balance: 5000});
    const result = fixture.api.recordCompletedLevel({
      colorId: "green",
      cosmeticId: category === "hats" ? "cap" : "none",
      beardId: category === "beards" ? "stubble" : "none"
    });
    assert.deepEqual(plain(result.newlyUnlocked), [category]);
    assert.equal(fixture.api.ownsGoldSlime(), false);
    assert.equal(fixture.api.isGoldShopUnlocked(), false, `${category} opened the shop`);
    if (category === "hats") {
      fixture.api.getGoldHatIds().forEach(id => assert.equal(fixture.api.ownsGoldHat(id), true));
    } else {
      fixture.api.getGoldBeardIds().forEach(id => assert.equal(fixture.api.ownsGoldBeard(id), true));
    }
    assert.equal(fixture.api.purchaseGoldSlime().ok, true);
    assert.equal(fixture.api.isGoldShopUnlocked(), true);
  }
}

function assertLaterMasteryAfterPurchases() {
  const state = masteryState("slime");
  state.hats.completedLevels = 499;
  state.hats.distinctHatIds = ["cap", "crown", "top_hat", "wizard_hat", "pirate_hat"];
  state.hats.purchasedGoldHatIds = ["cap", "crown", "top_hat"];
  const fixture = loadGold({state, balance: 500});
  const result = fixture.api.recordCompletedLevel({
    colorId: "green",
    cosmeticId: "cap",
    beardId: "none"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(plain(result.newlyUnlocked), ["hats"]);
  assert.equal(fixture.api.isGoldHatMasteryUnlocked(), true);
  fixture.api.getGoldHatIds().forEach(id => assert.equal(fixture.api.ownsGoldHat(id), true));
  assert.deepEqual(
    plain(fixture.api.getProgress().hats.purchasedGoldHatIds),
    ["cap", "crown", "top_hat"]
  );
  assert.equal(fixture.economy.getBalance(), 500, "mastery refunded stars");
}

function assertIndependentEquipment() {
  const state = masteryState("slime");
  state.hats.masteryUnlocked = true;
  state.beards.masteryUnlocked = true;
  const fixture = loadGold({state});
  assert.equal(fixture.api.equipGoldSlime(), true);
  assert.equal(fixture.api.equipGoldHat("crown"), true);
  assert.equal(fixture.api.equipGoldBeard("goatee"), true);
  assert.deepEqual(
    plain(fixture.api.getEquippedAppearance()),
    {slime: true, hatId: "crown", beardId: "goatee"}
  );
  const reloaded = loadGold({storage: fixture.localStorage});
  assert.deepEqual(
    plain(reloaded.api.getEquippedAppearance()),
    {slime: true, hatId: "crown", beardId: "goatee"}
  );
  assert.equal(reloaded.api.useNormalAppearance("hat"), true);
  assert.deepEqual(
    plain(reloaded.api.getEquippedAppearance()),
    {slime: true, hatId: null, beardId: "goatee"}
  );
}

function loadPrestige(localStorage) {
  let reloads = 0;
  const window = {
    location: {reload() { reloads++; }},
    SlimePlayerProgress: {
      isPrestigeReady: () => true,
      getPlayerProgress: () => ({level: 100})
    },
    SlimeAchievements: {getSelectedBadgeIds: () => []}
  };
  const context = vm.createContext({window, localStorage, console, DEV_MODE: false});
  vm.runInContext(read("js/slime-prestige.js"), context, {filename: "js/slime-prestige.js"});
  return {api: window.SlimePrestige, getReloads: () => reloads};
}

function assertPrestigeWipesGoldOnlyAsConfigured() {
  const permanentUnlocks = JSON.stringify({"1": {category: "cosmetic", id: "crown"}});
  const gold = createDefaultState();
  gold.slime.completedLevels = 140;
  gold.slime.distinctColorIds = ["purple", "blue", "cyan", "green", "yellow"];
  gold.slime.purchased = true;
  gold.hats.purchasedGoldHatIds = ["cap", "crown"];
  gold.beards.purchasedGoldBeardIds = ["goatee"];
  gold.equipped = {slime: true, hatId: "cap", beardId: "goatee"};
  const localStorage = createStorage({
    slimejumperPrestigeLevel: "0",
    slimejumperPrestigePermanentWardrobeUnlocks: permanentUnlocks,
    slimejumperGoldProgressV1: JSON.stringify(gold),
    slimejumperSkipGoldShopIntro: "true",
    unrelatedProgress: "keep-me"
  });
  const prestige = loadPrestige(localStorage);
  assert.equal(prestige.api.performPrestigeReset({validateSafeState: () => true}), true);
  assert.equal(prestige.getReloads(), 1);
  const stored = localStorage.snapshot();
  assert.deepEqual(JSON.parse(stored.slimejumperGoldProgressV1), createDefaultState());
  assert.equal(stored.slimejumperSelectedSlimeColor, "green");
  assert.equal(stored.slimejumperSelectedSlimeCosmetic, "none");
  assert.equal(stored.slimejumperSelectedSlimeBeard, "none");
  assert.equal(stored.slimejumperPrestigePermanentWardrobeUnlocks, permanentUnlocks);
  assert.equal(stored.slimejumperSkipGoldShopIntro, "true");
  assert.equal(stored.unrelatedProgress, "keep-me");
}

function createRecordingContext() {
  const geometry = [];
  const colors = new Set();
  const gradient = {addColorStop(_offset, color) { colors.add(String(color).toLowerCase()); }};
  const methods = new Set([
    "save", "restore", "translate", "scale", "rotate", "beginPath", "closePath",
    "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "ellipse",
    "rect", "roundRect", "fill", "stroke", "fillRect", "strokeRect", "clearRect",
    "setLineDash"
  ]);
  const context = new Proxy({}, {
    get(_target, property) {
      if (property === "createLinearGradient" || property === "createRadialGradient") {
        return (...args) => {
          geometry.push([property, ...args]);
          return gradient;
        };
      }
      if (methods.has(property)) {
        return (...args) => geometry.push([property, ...args]);
      }
      return undefined;
    },
    set(_target, property, value) {
      if (["fillStyle", "strokeStyle", "shadowColor"].includes(property) && typeof value === "string") {
        colors.add(value.toLowerCase());
      }
      return true;
    }
  });
  return {context, geometry, colors};
}

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing slice ${startMarker}`);
  return source.slice(start, end);
}

function assertDynamicGoldRendering() {
  const localStorage = createStorage();
  const window = {
    CustomEvent: class CustomEvent {},
    dispatchEvent() {},
    SlimeStarEconomy: createEconomy(0)
  };
  const context = vm.createContext({window, localStorage, console, DEV_MODE: false});
  vm.runInContext(read("js/slime-colors.js"), context);
  assert.equal(vm.runInContext("SLIME_COLOR_ORDER.length", context), 24);
  assert.equal(vm.runInContext("SLIME_COLOR_ORDER.includes('gold_slime')", context), false);
  vm.runInContext(read("js/slime-cosmetics.js"), context);
  vm.runInContext(read("js/slime-beards.js"), context);
  vm.runInContext(read("js/slime-gold.js"), context);
  const rendererSlice = extract(
    read("js/renderer.js"),
    "  function roundedCosmeticRectPath(",
    "  function drawSlimeCharacterPreview("
  );
  vm.runInContext(`${rendererSlice}\nwindow.goldRendererTest = {drawSlimeCosmetic, drawSlimeBeard};`, context);

  const goldColors = new Set([
    "#6a4300", "#a96f00", "#dfaf24", "#f5d76e", "#fff1b0", "#8a5900"
  ]);
  const hats = plain(window.SlimeGold.getGoldHatIds());
  const beards = plain(window.SlimeGold.getGoldBeardIds());
  assert.equal(hats.includes("none"), false);
  assert.equal(beards.includes("none"), false);

  for (const [category, ids, draw] of [
    ["hat", hats, window.goldRendererTest.drawSlimeCosmetic],
    ["beard", beards, window.goldRendererTest.drawSlimeBeard]
  ]) {
    for (const id of ids) {
      const normal = createRecordingContext();
      const gold = createRecordingContext();
      assert.doesNotThrow(() => draw(normal.context, id, 30));
      assert.doesNotThrow(() => draw(gold.context, id, 30, {gold: true}));
      assert.deepEqual(gold.geometry, normal.geometry, `${category} geometry changed for ${id}`);
      const usedGoldColors = [...gold.colors].filter(color => goldColors.has(color));
      assert.ok(new Set(usedGoldColors).size >= 2, `${category} ${id} lacks metallic gold tones`);
    }
  }

  const rendererSource = read("js/renderer.js");
  assert.match(rendererSource, /getMaterialPalette/);
  assert.match(rendererSource, /goldAppearance\.slime/);
  assert.match(rendererSource, /goldAppearance\.hatId === activeCosmetic/);
  assert.match(rendererSource, /goldAppearance\.beardId === activeBeard/);
  assert.equal((rendererSource.match(/function drawSlimeCosmetic\(/g) ?? []).length, 1);
  assert.equal((rendererSource.match(/function drawSlimeBeard\(/g) ?? []).length, 1);
}

function assertUiDevCompletionAndScope() {
  const html = read("index.html");
  const css = read("css/style.css");
  const ui = read("js/ui.js");
  const core = read("js/core.js");
  const game = read("js/game.js");
  const achievements = read("js/slime-achievements.js");

  assert.match(html, /id="wardrobeGoldMenuBtn"[^>]*>GOLD-GARDEROBE</);
  assert.doesNotMatch(html, /id="wardrobeGoldMenuBtn"[^>]*\bhidden\b/);
  assert.match(html, /id="wardrobeGoldView"/);
  assert.match(html, /id="goldHatProgress"/);
  assert.match(html, /id="goldBeardProgress"/);
  assert.match(html, /id="goldCategoryUnlockInfo"/);
  assert.match(html, /id="goldWardrobeOptions"/);
  const goldViewSource = extract(
    html,
    '<section id="wardrobeGoldView"',
    '<section id="wardrobePrestigeView"'
  );
  assert.doesNotMatch(goldViewSource, /data-gold-category="slime"|goldSlimeProgress/);
  assert.equal((goldViewSource.match(/data-gold-category=/g) ?? []).length, 2);
  assert.match(goldViewSource, /data-gold-category="hats"/);
  assert.match(goldViewSource, /data-gold-category="beards"/);
  assert.doesNotMatch(html, /wardrobeProgressPanel|Unlock Progress|slimeColorRequirement/);
  assert.match(html, /js\/slime-achievements\.js[\s\S]*?js\/slime-gold\.js[\s\S]*?js\/ui\.js/);
  assert.match(css, /\.goldWardrobePanel/);
  assert.match(css, /\.goldItemOption\.selected/);
  assert.match(css, /\.goldSlimeColorSlot/);
  assert.match(css, /\.goldCategoryUnlockInfo/);
  assert.match(css, /@media \(max-height: 520px\)[\s\S]*?\.goldWardrobePanel/);
  assert.match(ui, /KAUFEN · \$\{price\.toLocaleString\("de-DE"\)\} ⭐/);
  assert.match(ui, /createGoldSlimeColorOption\(\)/);
  assert.match(ui, /KAUF: \$\{price\.toLocaleString\("de-DE"\)\} ⭐ · ODER HERAUSFORDERUNG/);
  assert.match(ui, /KAUF: 1\.000 ⭐ PRO \$\{itemLabel\} · ODER HERAUSFORDERUNG/);
  assert.match(ui, /Gold-Slime-Besitz öffnet den Gold-Shop/);
  assert.match(ui, /GOLD-SHOP GESPERRT/);
  assert.match(ui, /MASTERY FREIGESCHALTET/);
  assert.match(ui, /prepareDevGoldMastery/);

  assert.match(game, /recordCompletedLevel\?\.\(/);
  assert.match(core, /IS_LOCALHOST_TEST_ENVIRONMENT[\s\S]*?localhost[\s\S]*?127\.0\.0\.1/);
  assert.match(core, /!isNativeCapacitorRuntime\(\)[\s\S]*?!IS_ANDROID_BROWSER_RUNTIME/);
  assert.doesNotMatch(
    `${core}\n${game}\n${ui}`,
    /[?&]gold=|(?:URLSearchParams|searchParams)\s*\.\s*(?:get|has)\(\s*["']gold["']\s*\)/i
  );
  assert.match(html, /id="devGoldAllTestBtn"[^>]*data-dev-mode-only/);
  assert.match(html, /id="devGoldShopTestBtn"[^>]*data-dev-mode-only/);
  assert.match(html, /id="devGoldResetBtn"[^>]*data-dev-mode-only/);

  const finishStart = game.indexOf("  function finishLevel() {");
  const finishEnd = game.indexOf("  function loseLife() {", finishStart);
  const finishSource = game.slice(finishStart, finishEnd);
  assert.ok(finishStart >= 0 && finishEnd > finishStart);
  assert.match(finishSource, /if \(state !== "playing"\) return;/);
  assert.equal((game.match(/recordCompletedLevel\?\.\(/g) ?? []).length, 1);
  assert.match(finishSource, /if \(isTutorialStage\(\)\)[\s\S]*?return;[\s\S]*?recordCompletedLevel/);

  for (const relativePath of [
    "js/biomes.js",
    "js/audio.js",
    "js/level-generator.js",
    "js/physics.js",
    "android-update.json"
  ]) {
    const normalizeAuthorizedLaunchGain = source => relativePath === "js/audio.js"
      ? source.replace(
        /(function playLaunch\(\) \{ tone\(240, 0\.12, "triangle", )[0-9.]+(, 520\); \})/,
        "$1<launch-gain>$2"
      )
      : source;
    assert.equal(
      normalizeAuthorizedLaunchGain(read(relativePath)).replace(/\r\n/g, "\n"),
      normalizeAuthorizedLaunchGain(readHead(relativePath)).replace(/\r\n/g, "\n")
    );
  }
  for (const helper of [
    "ownsGoldSlime", "isGoldSlimeMasteryUnlocked",
    "isGoldHatMasteryUnlocked", "isGoldBeardMasteryUnlocked"
  ]) {
    assert.match(achievements, new RegExp(`\\.${helper}\\?\\.\\(`));
  }
}

assertFreshAndDefensiveState();
assertProgressionBoundaries();
assertNaturalMasteryAndShopGate();
assertPurchasesAndPersistence();
assertMasteryAfterSlimePurchase();
assertDevGoldSlimePurchaseAndBoundary();
assertAccessoryMasteryBeforeGoldSlime();
assertLaterMasteryAfterPurchases();
assertIndependentEquipment();
assertPrestigeWipesGoldOnlyAsConfigured();
assertDynamicGoldRendering();
assertUiDevCompletionAndScope();

console.log("Gold wardrobe tests passed.");
