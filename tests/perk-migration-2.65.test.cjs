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
  const values = new Map(Object.entries(initialValues).map(([key, value]) => [key, String(value)]));
  let failure = null;
  let mutationCount = 0;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (failure?.type === "set" && failure.key === key) {
        failure = null;
        throw new Error(`simulated set failure: ${key}`);
      }
      mutationCount++;
      values.set(key, String(value));
    },
    removeItem(key) {
      if (failure?.type === "remove" && failure.key === key) {
        failure = null;
        throw new Error(`simulated remove failure: ${key}`);
      }
      mutationCount++;
      values.delete(key);
    },
    failOnce(type, key) { failure = {type, key}; },
    snapshot() { return Object.fromEntries(values); },
    getMutationCount() { return mutationCount; }
  };
}

function runMigration(localStorage, activeRunIds = ["air_brake"]) {
  let active = activeRunIds.slice();
  let balance = Math.floor(Number(localStorage.getItem("slimejumperStarBalance")) || 0);
  const window = {
    SlimePerks: {
      resetTemporaryStateForMigration() {
        active = [];
        return true;
      },
      getActiveRunPerkIds() { return active.slice(); }
    },
    SlimeStarEconomy: {
      getBalance() { return balance; },
      applyPerkMigrationBalance(targetBalance) {
        const previousBalance = balance;
        balance = targetBalance;
        try {
          localStorage.setItem("slimejumperStarBalance", String(balance));
          return localStorage.getItem("slimejumperStarBalance") === String(balance);
        } catch (_) {
          balance = previousBalance;
          return false;
        }
      }
    }
  };
  vm.runInNewContext(
    read("js/slime-perk-migration.js"),
    {window, localStorage, console, Number, JSON, Object},
    {filename: "js/slime-perk-migration.js"}
  );
  return {activeRunIds: active, balance};
}

function createExistingPlayerStorage() {
  return createStorage({
    slimejumperUnlockedPerks: '["air_hop","air_brake","star_shield"]',
    slimejumperSelectedPerks: '["air_brake","star_shield"]',
    slimejumperAirHopConflictPurchaseInfoSeen: "true",
    slimejumperAirBrakeConflictPurchaseInfoSeen: "true",
    slimejumperStarBalance: "820",
    slimejumperStarEconomyVersion: "star-economy-v1",
    slimejumperPlayerLevel: "73",
    slimejumperPlayerLevelXP: "4567",
    slimejumperPrestigeLevel: "4",
    slimejumperUnlockedSlimeColors: '["green","blue"]',
    slimejumperSelectedSlimeColor: "blue",
    slimejumperUnlockedSlimeCosmetics: '["crown"]',
    slimejumperSelectedSlimeCosmetic: "crown",
    slimejumperUnlockedSlimeBeards: '["wizard"]',
    slimejumperSelectedSlimeBeard: "wizard",
    slimejumperAchievements: '[{"id":"first_jump","unlockedAt":1}]',
    slimejumperAchievementProgress: JSON.stringify({lifetimeStars: 999, lifetimeDeaths: 12}),
    slimejumperHighestCheckpointLevel: "190",
    slimejumperBest: "123456",
    slimejumperBestLevel: "211",
    slimejumperRecentScores: '[{"score":123456}]',
    slimejumperHighscoresV14: '[{"score":123456}]',
    slimejumperPrestigePermanentWardrobeUnlocks: '{"color":["gold"]}'
  });
}

function assertSuccessfulMigrationAndReloads() {
  const storage = createExistingPlayerStorage();
  const before = storage.snapshot();
  const result = runMigration(storage);
  const after = storage.snapshot();

  assert.equal(after.slimejumperStarBalance, "2320");
  assert.deepEqual(JSON.parse(after.slimejumperUnlockedPerks), []);
  assert.deepEqual(JSON.parse(after.slimejumperSelectedPerks), []);
  assert.deepEqual(result.activeRunIds, []);
  assert.equal(after.slimejumperAirHopConflictPurchaseInfoSeen, undefined);
  assert.equal(after.slimejumperAirBrakeConflictPurchaseInfoSeen, undefined);
  assert.equal(after.slimejumperPerkMigrationVersion, "perk-migration-2.65");
  assert.equal(after.slimejumperPerkMigrationTransaction, undefined);

  const allowedChanges = new Set([
    "slimejumperUnlockedPerks",
    "slimejumperSelectedPerks",
    "slimejumperAirHopConflictPurchaseInfoSeen",
    "slimejumperAirBrakeConflictPurchaseInfoSeen",
    "slimejumperStarBalance",
    "slimejumperPerkMigrationVersion"
  ]);
  Object.entries(before).forEach(([key, value]) => {
    if (!allowedChanges.has(key)) {
      assert.equal(after[key], value, `${key} must remain unchanged`);
    }
  });
  assert.equal(
    JSON.parse(after.slimejumperAchievementProgress).lifetimeStars,
    999,
    "lifetimeStars must not receive the migration bonus"
  );

  const afterFirstRun = storage.snapshot();
  runMigration(storage, ["star_shield"]);
  assert.deepEqual(storage.snapshot(), afterFirstRun, "first reload must not mutate storage");
  runMigration(storage, ["ghost_step"]);
  assert.deepEqual(storage.snapshot(), afterFirstRun, "second reload must not mutate storage");
}

function assertRecoveryAfterTransactionWrite() {
  const storage = createExistingPlayerStorage();
  storage.failOnce("set", "slimejumperUnlockedPerks");
  runMigration(storage);

  const interrupted = storage.snapshot();
  const transaction = JSON.parse(interrupted.slimejumperPerkMigrationTransaction);
  assert.equal(transaction.originalBalance, 820);
  assert.equal(transaction.targetBalance, 2320);
  assert.equal(interrupted.slimejumperStarBalance, "820");
  assert.equal(interrupted.slimejumperPerkMigrationVersion, undefined);

  runMigration(storage);
  assert.equal(storage.snapshot().slimejumperStarBalance, "2320");
  assert.equal(storage.snapshot().slimejumperPerkMigrationVersion, "perk-migration-2.65");
}

function assertRecoveryAfterBalanceWrite() {
  const storage = createExistingPlayerStorage();
  storage.failOnce("set", "slimejumperPerkMigrationVersion");
  runMigration(storage);

  const interrupted = storage.snapshot();
  assert.equal(interrupted.slimejumperStarBalance, "2320");
  assert.equal(interrupted.slimejumperPerkMigrationVersion, undefined);
  assert.equal(
    JSON.parse(interrupted.slimejumperPerkMigrationTransaction).targetBalance,
    2320
  );

  runMigration(storage);
  assert.equal(storage.snapshot().slimejumperStarBalance, "2320");
  assert.equal(storage.snapshot().slimejumperPerkMigrationVersion, "perk-migration-2.65");
}

function assertCompletedMarkerIsMutationFree() {
  const storage = createStorage({
    slimejumperPerkMigrationVersion: "perk-migration-2.65",
    slimejumperStarBalance: "2320",
    slimejumperUnlockedPerks: "[]",
    slimejumperSelectedPerks: "[]"
  });
  const before = storage.snapshot();
  const mutationsBefore = storage.getMutationCount();
  runMigration(storage, ["air_brake"]);
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(storage.getMutationCount(), mutationsBefore);
}

function assertRealTemporaryPerkReset() {
  const localStorage = createStorage({
    slimejumperUnlockedPerks: '["air_brake","star_shield"]',
    slimejumperSelectedPerks: '["air_brake","star_shield"]'
  });
  const window = {};
  vm.runInNewContext(
    read("js/slime-perks.js"),
    {window, localStorage, console},
    {filename: "js/slime-perks.js"}
  );
  window.SlimePerks.captureRunPerkSnapshot();
  window.SlimePerks.setDevUnlockOverride(true);
  window.SlimePerks.requestDevForceNextLuckyStar();
  assert.equal(window.SlimePerks.resetTemporaryStateForMigration(), true);
  assert.deepEqual(Array.from(window.SlimePerks.getActiveRunPerkIds()), []);
  assert.equal(window.SlimePerks.isDevUnlockOverrideActive(), false);
  assert.equal(window.SlimePerks.isDevForceNextLuckyStarPending(), false);
}

function assertRealStarBalanceSetter() {
  const source = read("js/slime-achievements.js");
  const start = source.indexOf("  function saveStarBalance()");
  const end = source.indexOf("  function cloneAchievementProgress()", start);
  assert.ok(start >= 0 && end > start);
  const localStorage = createStorage({slimejumperStarBalance: "820"});
  const context = vm.createContext({localStorage});
  vm.runInContext(`
    const STAR_BALANCE_STORAGE_KEY = "slimejumperStarBalance";
    let starBalance = 820;
  ` + source.slice(start, end) + `
    globalThis.balanceTestApi = {
      applyPerkMigrationBalance,
      getBalance: () => starBalance
    };
  `, context, {filename: "js/slime-achievements-migration-balance-test-slice.js"});
  assert.equal(context.balanceTestApi.applyPerkMigrationBalance(2320), true);
  assert.equal(context.balanceTestApi.getBalance(), 2320);
  assert.equal(localStorage.getItem("slimejumperStarBalance"), "2320");
  assert.equal(context.balanceTestApi.applyPerkMigrationBalance(-1), false);
  assert.equal(context.balanceTestApi.getBalance(), 2320);
}

function assertStarShieldUsesNewId() {
  const source = read("js/player.js");
  const start = source.indexOf("  function resetStarShieldForNewLife()");
  const end = source.indexOf("  function resetFlightPerkState()", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({});
  vm.runInContext(`
    let activePerkId = null;
    let now = 1000;
    let starShieldConsumedThisLife = false;
    let starShieldProtectionUntil = 0;
    const performance = {now: () => now};
    const window = {SlimePerks: {
      balance: {STAR_SHIELD_DURATION: 1},
      isActiveForRun: id => id === activePerkId
    }};
    function isTutorialStage() { return false; }
  ` + source.slice(start, end) + `
    globalThis.starShieldTestApi = {
      tryActivateStarShieldFromStarPickup,
      isStarShieldProtectionActive,
      isStarShieldConsumedThisLife,
      resetStarShieldForNewLife,
      setActivePerk(id) { activePerkId = id; }
    };
  `, context, {filename: "js/player-star-shield-id-test-slice.js"});
  assert.equal(context.starShieldTestApi.tryActivateStarShieldFromStarPickup(), false);
  context.starShieldTestApi.setActivePerk("star_shield");
  assert.equal(context.starShieldTestApi.tryActivateStarShieldFromStarPickup(), true);
  assert.equal(context.starShieldTestApi.isStarShieldProtectionActive(), true);
  assert.equal(context.starShieldTestApi.tryActivateStarShieldFromStarPickup(), false);
  context.starShieldTestApi.resetStarShieldForNewLife();
  assert.equal(context.starShieldTestApi.isStarShieldConsumedThisLife(), false);
}

function assertIdsAndStartupOrder() {
  const productionFiles = [
    "js/slime-perks.js",
    "js/player.js",
    "js/platforms.js",
    "js/game.js",
    "js/ui.js"
  ];
  const productionSource = productionFiles.map(read).join("\n");
  for (const id of ["star_shield", "air_brake", "ghost_step", "anchor_step"]) {
    assert.match(productionSource, new RegExp(`\\b${id}\\b`), `${id} must exist`);
  }
  for (const id of ["sticky_slime", "quick_recovery", "safe_return", "slow_fall"]) {
    assert.doesNotMatch(productionSource, new RegExp(`\\b${id}\\b`), `${id} must be removed`);
  }

  const html = read("index.html");
  const prestigeIndex = html.indexOf("./js/slime-prestige.js");
  const achievementsIndex = html.indexOf("./js/slime-achievements.js");
  const migrationIndex = html.indexOf("./js/slime-perk-migration.js");
  const playerIndex = html.indexOf("./js/player.js");
  assert.ok(prestigeIndex >= 0 && prestigeIndex < achievementsIndex);
  assert.ok(achievementsIndex < migrationIndex && migrationIndex < playerIndex);
  assert.match(read("js/slime-achievements.js"), /recoverInterruptedRun[\s\S]*?checkWardrobeAchievements/);

  const resetSource = read("js/slime-progress-reset.js");
  assert.match(resetSource, /RESET_VERSION = "progress-reset-2\.43"/);
  assert.match(resetSource, /PREFERENCE_RESET_VERSION = "preferences-reset-2\.58"/);
  assert.doesNotMatch(read("js/slime-perk-migration.js"), /highscore|leaderboard|supabase/i);
}

assertSuccessfulMigrationAndReloads();
assertRecoveryAfterTransactionWrite();
assertRecoveryAfterBalanceWrite();
assertCompletedMarkerIsMutationFree();
assertRealTemporaryPerkReset();
assertRealStarBalanceSetter();
assertStarShieldUsesNewId();
assertIdsAndStartupOrder();

console.log("v2.65 perk migration tests passed.");
