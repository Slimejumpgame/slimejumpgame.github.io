"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function createBonusFixture({
  storage = createStorage(),
  highestCheckpoint = 0,
  lives = 3,
  runAvailable = true,
  lockedColors = ["blue"],
  lockedHats = ["cap"],
  lockedBeards = ["goatee"],
  starLedger = {balance: 0, lifetime: 0, transactions: new Set()},
  goldLedger = {owned: false, mastery: false, transactions: new Set()},
  failVoucherUnlock = false,
  devMode = true
} = {}) {
  const bridge = {
    highestCheckpoint,
    lives,
    runAvailable,
    hudUpdates: 0
  };
  const wardrobe = {
    colors: lockedColors,
    hats: lockedHats,
    beards: lockedBeards,
    failVoucherUnlock
  };
  const window = {
    setTimeout() { return 0; },
    clearTimeout() {},
    SlimePrestige: {getLevel: () => 0},
    SlimeAchievements: {
      setPopupsPaused() {},
      checkWardrobe() {},
      checkState() {}
    },
    SlimeStarEconomy: {
      awardStars(amount, {transactionId, source}) {
        assert.equal(source, "checkpoint_bonus");
        if (starLedger.transactions.has(transactionId)) {
          return {ok: true, duplicate: true, balance: starLedger.balance};
        }
        starLedger.transactions.add(transactionId);
        starLedger.balance += amount;
        starLedger.lifetime += amount;
        return {ok: true, duplicate: false, balance: starLedger.balance};
      }
    },
    SlimeGold: {
      ownsGoldSlime: () => goldLedger.owned,
      isGoldShopUnlocked: () => goldLedger.owned,
      isGoldSlimeMasteryUnlocked: () => goldLedger.mastery,
      grantGoldSlimeFromCheckpointBonus({transactionId}) {
        if (goldLedger.transactions.has(transactionId)) {
          return {ok: true, duplicate: true, owned: goldLedger.owned};
        }
        goldLedger.transactions.add(transactionId);
        goldLedger.owned = true;
        return {ok: true, duplicate: false, owned: true, shopUnlocked: true};
      }
    }
  };
  const context = vm.createContext({
    window,
    localStorage: storage,
    console,
    DEV_MODE: devMode,
    getLockedSlimeColors: () => wardrobe.colors.slice(),
    getLockedSlimeCosmetics: () => wardrobe.hats.slice(),
    getLockedSlimeBeards: () => wardrobe.beards.slice(),
    isSlimeColorUnlocked: id => !wardrobe.colors.includes(id),
    isSlimeCosmeticUnlocked: id => !wardrobe.hats.includes(id),
    isSlimeBeardUnlocked: id => !wardrobe.beards.includes(id),
    unlockSlimeColor(id) {
      if (wardrobe.failVoucherUnlock) return false;
      const index = wardrobe.colors.indexOf(id);
      if (index < 0) return false;
      wardrobe.colors.splice(index, 1);
      return true;
    },
    unlockSlimeCosmetic(id) {
      if (wardrobe.failVoucherUnlock) return false;
      const index = wardrobe.hats.indexOf(id);
      if (index < 0) return false;
      wardrobe.hats.splice(index, 1);
      return true;
    },
    unlockSlimeBeard(id) {
      if (wardrobe.failVoucherUnlock) return false;
      const index = wardrobe.beards.indexOf(id);
      if (index < 0) return false;
      wardrobe.beards.splice(index, 1);
      return true;
    }
  });
  vm.runInContext(read("js/slime-checkpoint-bonus.js"), context, {
    filename: "js/slime-checkpoint-bonus.js"
  });
  const api = window.SlimeCheckpointBonus;
  api.configureGame({
    getHighestCheckpoint: () => bridge.highestCheckpoint,
    getLives: () => bridge.lives,
    setLives: value => { bridge.lives = value; },
    updateHUD: () => { bridge.hudUpdates++; },
    isRunAvailable: () => bridge.runAvailable,
    setGameState() {}
  });
  return {api, storage, bridge, wardrobe, starLedger, goldLedger};
}

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function assertProbabilityContract() {
  const {api} = createBonusFixture();
  const weights = api.rewardIds.map(id => api.rewards[id].baseWeight);
  assert.deepEqual(plain(weights), [45, 20, 10, 10, 7.45, 7.45, 0.10]);
  assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(api.goldGateChance, 0.001);

  const allEligible = Object.fromEntries(api.rewardIds.map(id => [id, true]));
  assert.equal(api.selectReward(allEligible, sequence([0.000999])), "gold_slime");
  assert.equal(api.selectReward(allEligible, sequence([0.001, 0])), "stars_100");
  assert.equal(api.selectReward(allEligible, sequence([0.7, 0.999999])), "beard_voucher");

  const reduced = {
    stars_100: true,
    life_refill: false,
    stars_500: true,
    color_voucher: false,
    hat_voucher: false,
    beard_voucher: false,
    gold_slime: true
  };
  const reducedWeights = api.getEffectiveWeights(reduced);
  assert.equal(reducedWeights.gold_slime, 0.001);
  assert.ok(Math.abs(reducedWeights.stars_100 - 45 / 55 * 0.999) < 1e-12);
  assert.ok(Math.abs(reducedWeights.stars_500 - 10 / 55 * 0.999) < 1e-12);
  assert.ok(Math.abs(Object.values(reducedWeights).reduce((a, b) => a + b, 0) - 1) < 1e-12);

  reduced.gold_slime = false;
  const noGoldWeights = api.getEffectiveWeights(reduced);
  assert.equal(noGoldWeights.gold_slime, 0);
  assert.ok(Math.abs(noGoldWeights.stars_100 - 45 / 55) < 1e-12);
  assert.ok(Math.abs(Object.values(noGoldWeights).reduce((a, b) => a + b, 0) - 1) < 1e-12);
}

function assertExistingPlayerAndCheckpointJournal() {
  const existing = createBonusFixture({highestCheckpoint: 70});
  assert.equal(existing.api.getState().highestClaimedCheckpoint, 70);
  assert.equal(existing.api.prepareCheckpoint(70, {forcedRewardId: "stars_100", dev: true}), null);
  assert.equal(existing.api.prepareCheckpoint(80, {forcedRewardId: "stars_100", dev: true}).checkpointLevel, 80);
  assert.equal(existing.api.applyPendingPayout().ok, true);
  assert.equal(existing.api.claimPending(), true);
  assert.equal(existing.api.prepareCheckpoint(80, {forcedRewardId: "stars_500", dev: true}), null);

  const fresh = createBonusFixture();
  for (const checkpoint of [10, 20, 200, 210, 220]) {
    assert.equal(
      fresh.api.prepareCheckpoint(checkpoint, {forcedRewardId: "stars_100", dev: true}).checkpointLevel,
      checkpoint
    );
    assert.equal(fresh.api.applyPendingPayout().ok, true);
    assert.equal(fresh.api.claimPending(), true);
    assert.equal(fresh.api.prepareCheckpoint(checkpoint, {forcedRewardId: "stars_100", dev: true}), null);
  }
  assert.equal(fresh.api.getState().highestClaimedCheckpoint, 220);

  const beforePendingStorage = createStorage({
    slimejumperCheckpointBonusV1: JSON.stringify({
      version: 1,
      highestClaimedCheckpoint: 0,
      pending: null
    })
  });
  const recovered = createBonusFixture({storage: beforePendingStorage, highestCheckpoint: 10});
  assert.equal(recovered.api.getState().pending.checkpointLevel, 10);
}

function assertPendingAndPayoutRecovery() {
  const storage = createStorage();
  const starLedger = {balance: 0, lifetime: 0, transactions: new Set()};
  const first = createBonusFixture({storage, starLedger});
  const prepared = first.api.prepareCheckpoint(10, {
    forcedRewardId: "stars_100",
    dev: true
  });
  assert.equal(prepared.rewardId, "stars_100");

  const beforeAnimationReload = createBonusFixture({storage, starLedger});
  assert.equal(beforeAnimationReload.api.getState().pending.rewardId, "stars_100");
  assert.equal(beforeAnimationReload.api.getState().pending.transactionId, prepared.transactionId);
  assert.equal(beforeAnimationReload.api.applyPendingPayout().ok, true);
  assert.equal(starLedger.balance, 100);

  const afterPayoutReload = createBonusFixture({storage, starLedger});
  assert.equal(afterPayoutReload.api.applyPendingPayout().duplicate, true);
  assert.equal(starLedger.balance, 100);
  assert.equal(afterPayoutReload.api.claimPending(), true);
  assert.equal(afterPayoutReload.api.prepareCheckpoint(10, {
    forcedRewardId: "stars_500",
    dev: true
  }), null);

  const goldStorage = createStorage();
  const goldLedger = {owned: false, mastery: false, transactions: new Set()};
  const gold = createBonusFixture({storage: goldStorage, goldLedger});
  gold.api.prepareCheckpoint(10, {forcedRewardId: "gold_slime", dev: true});
  assert.equal(gold.api.applyPendingPayout().ok, true);
  assert.equal(goldLedger.owned, true);
  const goldReload = createBonusFixture({storage: goldStorage, goldLedger});
  assert.equal(goldReload.api.applyPendingPayout().duplicate, true);
  assert.equal(goldLedger.transactions.size, 1);
  assert.equal(goldReload.api.claimPending(), true);
}

function assertEligibilityLifeAndVouchers() {
  const full = createBonusFixture({lives: 5, lockedColors: [], lockedHats: [], lockedBeards: []});
  full.goldLedger.owned = true;
  const eligibility = full.api.getEligibility();
  assert.equal(eligibility.life_refill, false);
  assert.equal(eligibility.color_voucher, false);
  assert.equal(eligibility.hat_voucher, false);
  assert.equal(eligibility.beard_voucher, false);
  assert.equal(eligibility.gold_slime, false);
  assert.equal(eligibility.stars_100, true);
  assert.equal(eligibility.stars_500, true);

  const lifeStorage = createStorage();
  const life = createBonusFixture({storage: lifeStorage, runAvailable: false});
  life.api.prepareCheckpoint(10, {forcedRewardId: "life_refill", dev: true});
  assert.equal(life.api.applyPendingPayout().deferred, true);
  assert.equal(life.api.getState().pending.rewardId, "life_refill");
  const lifeReload = createBonusFixture({storage: lifeStorage, lives: 3, runAvailable: true});
  assert.equal(lifeReload.api.handleTrueRunStart(), true);
  assert.equal(lifeReload.bridge.lives, 5);
  assert.equal(lifeReload.bridge.hudUpdates, 1);
  assert.equal(lifeReload.api.getState().pending, null);
  assert.equal(lifeReload.api.handleTrueRunStart(), false);

  const voucherStorage = createStorage();
  const voucher = createBonusFixture({
    storage: voucherStorage,
    lockedColors: ["blue"],
    failVoucherUnlock: true
  });
  voucher.api.prepareCheckpoint(10, {forcedRewardId: "color_voucher", dev: true});
  assert.equal(voucher.api.chooseVoucherItem("blue").ok, false);
  assert.equal(voucher.api.getState().pending.selectedVoucherItemId, "blue");
  const voucherReload = createBonusFixture({
    storage: voucherStorage,
    lockedColors: ["blue"],
    failVoucherUnlock: false
  });
  assert.equal(voucherReload.api.chooseVoucherItem("blue").ok, true);
  assert.equal(voucherReload.api.getState().pending.payout.itemId, "blue");
  assert.equal(voucherReload.api.claimPending(), true);

  const fallback = createBonusFixture({lockedHats: ["cap"]});
  fallback.api.prepareCheckpoint(10, {forcedRewardId: "hat_voucher", dev: true});
  fallback.wardrobe.hats.splice(0);
  const fallbackResult = fallback.api.chooseVoucherItem("cap");
  assert.equal(fallbackResult.fallback, true);
  assert.equal(fallback.api.getState().pending.rewardId, "stars_100");
  assert.equal(fallback.starLedger.balance, 100);
}

function createAchievementGoldFixture() {
  const localStorage = createStorage();
  const listeners = new Map();
  const context = vm.createContext({
    console,
    localStorage,
    DEV_MODE: false,
    BIOMES: ["meadow"].map(id => ({id})),
    SLIME_COLOR_ORDER: ["green", "blue", "yellow", "red", "purple", "orange"],
    SLIME_COSMETIC_ORDER: ["none", "cap", "crown", "top_hat", "wizard_hat", "halo"],
    UNLOCKABLE_SLIME_COSMETICS: ["cap", "crown", "top_hat", "wizard_hat", "halo"],
    SLIME_BEARD_ORDER: ["none", "goatee", "full", "stubble", "mustache", "viking"],
    UNLOCKABLE_SLIME_BEARDS: ["goatee", "full", "stubble", "mustache", "viking"],
    unlockedSlimeColors: ["green"],
    unlockedSlimeCosmetics: [],
    unlockedSlimeBeards: [],
    selectedSlimeColor: "green",
    selectedSlimeCosmetic: "none",
    selectedSlimeBeard: "none"
  });
  context.window = context;
  context.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  context.addEventListener = (name, callback) => listeners.set(name, callback);
  context.dispatchEvent = event => listeners.get(event.type)?.(event);
  context.SlimePlayerProgress = {
    getPlayerProgress: () => ({level: 1, levelXP: 0, isPrestigeReady: false}),
    isPrestigeReady: () => false
  };
  context.SlimePrestige = {
    getLevel: () => 0,
    getPermanentWardrobeUnlocks: () => [],
    getSelectedReward: () => "none",
    getRewardDefinition: () => null
  };
  context.SlimePerks = {
    definitions: [],
    getStoredUnlockedPerkIds: () => [],
    getStoredSelectedPerkIds: () => [],
    getActiveRunPerkIds: () => []
  };
  vm.runInContext(read("js/slime-achievements.js"), context, {
    filename: "js/slime-achievements.js"
  });
  vm.runInContext(read("js/slime-gold.js"), context, {filename: "js/slime-gold.js"});
  return {context, localStorage};
}

function assertRealStarAndGoldTransactions() {
  const starFixture = createAchievementGoldFixture();
  const starApi = starFixture.context.SlimeStarEconomy;
  const beforeAwardSnapshot = starFixture.context.SlimeAchievements.captureRunProgressSnapshot();
  const first = starApi.awardStars(500, {
    transactionId: "checkpoint_bonus:p0:cp10",
    source: "checkpoint_bonus"
  });
  assert.equal(first.ok, true);
  assert.equal(starApi.getBalance(), 500);
  assert.equal(starApi.getLifetimeStars(), 500);
  assert.equal(starFixture.context.SlimeAchievements.captureRunProgressSnapshot().runState.runStars, 0);
  assert.equal(starApi.awardStars(500, {
    transactionId: "checkpoint_bonus:p0:cp10",
    source: "checkpoint_bonus"
  }).duplicate, true);
  assert.equal(starApi.getBalance(), 500);
  assert.equal(starFixture.context.SlimeAchievements.restoreRunProgressSnapshot(beforeAwardSnapshot), true);
  assert.equal(starApi.getBalance(), 500, "durable bonus stars were rolled back with the run");
  starApi.awardStars(500, {
    transactionId: "checkpoint_bonus:p0:cp20",
    source: "checkpoint_bonus"
  });
  assert.equal(starApi.getLifetimeStars(), 1000);
  assert.ok(starFixture.context.SlimeAchievements.getUnlocked().some(({id}) => id === "star_bank"));

  const goldFixture = createAchievementGoldFixture();
  const goldApi = goldFixture.context.SlimeGold;
  const before = plain(goldApi.getProgress().slime);
  const grant = goldApi.grantGoldSlimeFromCheckpointBonus({
    transactionId: "checkpoint_bonus:p0:cp10"
  });
  assert.equal(grant.ok, true);
  assert.equal(grant.masteryUnchanged, true);
  assert.equal(goldApi.ownsGoldSlime(), true);
  assert.equal(goldApi.isGoldShopUnlocked(), true);
  assert.equal(goldApi.isGoldSlimeMasteryUnlocked(), false);
  const after = plain(goldApi.getProgress().slime);
  assert.equal(after.completedLevels, before.completedLevels);
  assert.deepEqual(after.distinctColorIds, before.distinctColorIds);
  assert.equal(after.masteryUnlocked, before.masteryUnlocked);
  const unlocked = goldFixture.context.SlimeAchievements.getUnlocked().map(({id}) => id);
  assert.ok(unlocked.includes("golden_ticket"));
  assert.ok(!unlocked.includes("true_alchemy"));
  assert.ok(!unlocked.includes("all_that_glitters"));
  assert.equal(goldApi.grantGoldSlimeFromCheckpointBonus({
    transactionId: "checkpoint_bonus:p0:cp10"
  }).duplicate, true);
  assert.equal(goldApi.getProgress().checkpointBonusTransactionIds.length, 1);
}

function assertPrestigeCycleReset() {
  const storage = createStorage({
    slimejumperPrestigeLevel: "0",
    slimejumperCheckpointBonusV1: JSON.stringify({
      version: 1,
      highestClaimedCheckpoint: 100,
      pending: {
        checkpointLevel: 110,
        transactionId: "checkpoint_bonus:p0:cp110",
        rewardId: "stars_100",
        phase: "prepared",
        selectedVoucherItemId: null,
        payout: null
      }
    }),
    slimejumperStarAwardReceiptsV1: JSON.stringify({
      version: 1,
      totalAwarded: 100,
      receipts: {
        "checkpoint_bonus:p0:cp100": {
          amount: 100,
          source: "checkpoint_bonus",
          beforeBalance: 0,
          beforeLifetimeStars: 0,
          status: "applied"
        }
      }
    })
  });
  const window = {
    location: {reload() {}},
    SlimePlayerProgress: {
      isPrestigeReady: () => true,
      getPlayerProgress: () => ({level: 100})
    },
    SlimeAchievements: {getSelectedBadgeIds: () => [], checkState() {}}
  };
  const context = vm.createContext({window, localStorage: storage, console, DEV_MODE: false});
  vm.runInContext(read("js/slime-prestige.js"), context, {filename: "js/slime-prestige.js"});
  assert.equal(
    window.SlimePrestige.performPrestigeReset({validateSafeState: () => true}),
    true
  );
  assert.deepEqual(JSON.parse(storage.getItem("slimejumperCheckpointBonusV1")), {
    version: 1,
    highestClaimedCheckpoint: 0,
    pending: null
  });
  assert.deepEqual(JSON.parse(storage.getItem("slimejumperStarAwardReceiptsV1")), {
    version: 1,
    totalAwarded: 0,
    receipts: {}
  });
  const goldState = JSON.parse(storage.getItem("slimejumperGoldProgressV1"));
  assert.deepEqual(goldState.checkpointBonusTransactionIds, []);
  const newCycle = createBonusFixture({storage, highestCheckpoint: 0});
  assert.equal(
    newCycle.api.prepareCheckpoint(10, {forcedRewardId: "stars_100", dev: true}).checkpointLevel,
    10
  );
}

assertProbabilityContract();
assertExistingPlayerAndCheckpointJournal();
assertPendingAndPayoutRecovery();
assertEligibilityLifeAndVouchers();
assertRealStarAndGoldTransactions();
assertPrestigeCycleReset();

console.log("Checkpoint bonus domain, probability, payout, recovery, Prestige-cycle and Gold tests passed.");
