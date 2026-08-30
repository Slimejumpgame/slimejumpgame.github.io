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
  const setCounts = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (failure?.type === "set" && failure.key === key) {
        failure = null;
        throw new Error(`simulated set failure: ${key}`);
      }
      mutationCount++;
      setCounts.set(key, (setCounts.get(key) ?? 0) + 1);
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
    getMutationCount() { return mutationCount; },
    getSetCount(key) { return setCounts.get(key) ?? 0; }
  };
}

function initializeFreshStarEconomy(localStorage) {
  localStorage.setItem("slimejumperStarBalance", "0");
  localStorage.setItem("slimejumperStarEconomyVersion", "star-economy-v1");
}

function runMigration(localStorage, activeRunIds = ["air_brake"]) {
  let active = activeRunIds.slice();
  let resetCalls = 0;
  let starBalanceWrites = 0;
  let balance = Math.floor(Number(localStorage.getItem("slimejumperStarBalance")) || 0);
  const window = {
    SlimePerks: {
      resetTemporaryStateForMigration() {
        resetCalls++;
        active = [];
        return true;
      },
      getActiveRunPerkIds() { return active.slice(); }
    },
    SlimeStarEconomy: {
      getBalance() { return balance; },
      applyPerkMigrationBalance(targetBalance) {
        starBalanceWrites++;
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
  return {activeRunIds: active, balance, resetCalls, starBalanceWrites};
}

function createExistingPlayerStorage() {
  return createStorage({
    slimejumperUnlockedPerks: '["air_hop","air_brake","star_shield"]',
    slimejumperSelectedPerks: '["air_brake","star_shield"]',
    slimejumperAirHopConflictPurchaseInfoSeen: "true",
    slimejumperAirBrakeConflictPurchaseInfoSeen: "true",
    slimejumperStarBalance: "347",
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
    slimejumperSelectedAchievementBadges: '["first_jump"]',
    slimejumperCallingCardBadgesConfigured: "true",
    slimejumperHighestCheckpointLevel: "190",
    slimejumperBest: "123456",
    slimejumperBestLevel: "211",
    slimejumperRecentScores: '[{"score":123456}]',
    slimejumperHighscoresV14: '[{"score":123456}]',
    slimejumperPrestigePermanentWardrobeUnlocks: '{"color":["gold"]}',
    slimejumperGlobalRankBestV1: "123456",
    slimejumperGlobalRankBestPayloadV1: '{"score":123456}',
    slimejumperGraphicsMode: "legacy",
    slimejumperMainMenuOnboardingSeenVersion: "main-menu-onboarding-v1"
  });
}

function assertFreshInstallKeepsZeroBalance() {
  const storage = createStorage();
  initializeFreshStarEconomy(storage);
  const starSetsBeforeMigration = storage.getSetCount("slimejumperStarBalance");

  const result = runMigration(storage, []);
  const afterFirstStart = storage.snapshot();
  assert.equal(afterFirstStart.slimejumperStarBalance, "0");
  assert.equal(afterFirstStart.slimejumperPerkMigrationVersion, "perk-migration-2.65");
  assert.equal(afterFirstStart.slimejumperPerkMigrationTransaction, undefined);
  assert.deepEqual(JSON.parse(afterFirstStart.slimejumperUnlockedPerks), []);
  assert.deepEqual(JSON.parse(afterFirstStart.slimejumperSelectedPerks), []);
  assert.deepEqual(result.activeRunIds, []);
  assert.equal(result.resetCalls, 1);
  assert.equal(result.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), starSetsBeforeMigration);

  const mutationsBeforeReload = storage.getMutationCount();
  const reloadResult = runMigration(storage, ["star_shield"]);
  assert.deepEqual(storage.snapshot(), afterFirstStart);
  assert.equal(storage.getMutationCount(), mutationsBeforeReload);
  assert.deepEqual(reloadResult.activeRunIds, ["star_shield"]);
  assert.equal(reloadResult.resetCalls, 0);
  assert.equal(reloadResult.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), starSetsBeforeMigration);
}

function assertFreshInstallWithUiPreferencesKeepsZeroBalance() {
  const storage = createStorage({
    slimejumperGraphicsMode: "legacy",
    slimejumperMainMenuOnboardingSeenVersion: "main-menu-onboarding-v1"
  });
  initializeFreshStarEconomy(storage);

  const result = runMigration(storage, []);
  const after = storage.snapshot();
  assert.equal(after.slimejumperStarBalance, "0");
  assert.equal(after.slimejumperGraphicsMode, "legacy");
  assert.equal(
    after.slimejumperMainMenuOnboardingSeenVersion,
    "main-menu-onboarding-v1"
  );
  assert.equal(result.starBalanceWrites, 0);
}

function assertSuccessfulMigrationAndReloads() {
  const storage = createExistingPlayerStorage();
  const before = storage.snapshot();
  const result = runMigration(storage, ["air_brake"]);
  const after = storage.snapshot();

  assert.equal(after.slimejumperStarBalance, "347");
  assert.deepEqual(JSON.parse(after.slimejumperUnlockedPerks), []);
  assert.deepEqual(JSON.parse(after.slimejumperSelectedPerks), []);
  assert.deepEqual(result.activeRunIds, []);
  assert.equal(result.resetCalls, 1);
  assert.equal(result.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), 0);
  assert.equal(after.slimejumperAirHopConflictPurchaseInfoSeen, undefined);
  assert.equal(after.slimejumperAirBrakeConflictPurchaseInfoSeen, undefined);
  assert.equal(after.slimejumperPerkMigrationVersion, "perk-migration-2.65");
  assert.equal(after.slimejumperPerkMigrationTransaction, undefined);

  const allowedChanges = new Set([
    "slimejumperUnlockedPerks",
    "slimejumperSelectedPerks",
    "slimejumperAirHopConflictPurchaseInfoSeen",
    "slimejumperAirBrakeConflictPurchaseInfoSeen",
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
    "lifetimeStars must remain unchanged"
  );

  const afterFirstRun = storage.snapshot();
  const firstReload = runMigration(storage, ["star_shield"]);
  assert.deepEqual(storage.snapshot(), afterFirstRun, "first reload must not mutate storage");
  assert.deepEqual(firstReload.activeRunIds, ["star_shield"]);
  assert.equal(firstReload.resetCalls, 0);
  assert.equal(firstReload.starBalanceWrites, 0);
  const secondReload = runMigration(storage, ["ghost_step"]);
  assert.deepEqual(storage.snapshot(), afterFirstRun, "second reload must not mutate storage");
  assert.deepEqual(secondReload.activeRunIds, ["ghost_step"]);
  assert.equal(secondReload.resetCalls, 0);
  assert.equal(secondReload.starBalanceWrites, 0);
}

function assertRecoveryAfterPerkWriteFailure() {
  const storage = createExistingPlayerStorage();
  storage.failOnce("set", "slimejumperUnlockedPerks");
  const interruptedResult = runMigration(storage);

  const interrupted = storage.snapshot();
  assert.equal(interrupted.slimejumperStarBalance, "347");
  assert.equal(interrupted.slimejumperPerkMigrationVersion, undefined);
  assert.equal(interruptedResult.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), 0);

  const recoveredResult = runMigration(storage);
  assert.equal(storage.snapshot().slimejumperStarBalance, "347");
  assert.equal(storage.snapshot().slimejumperPerkMigrationVersion, "perk-migration-2.65");
  assert.equal(recoveredResult.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), 0);
}

function assertRecoveryOfPreviousBonusTransactionWithoutPayout() {
  const storage = createExistingPlayerStorage();
  storage.setItem(
    "slimejumperPerkMigrationTransaction",
    JSON.stringify({
      version: "perk-migration-2.65",
      originalBalance: 347,
      targetBalance: 1847
    })
  );
  storage.failOnce("set", "slimejumperPerkMigrationVersion");
  const interruptedResult = runMigration(storage);

  const interrupted = storage.snapshot();
  assert.equal(interrupted.slimejumperStarBalance, "347");
  assert.equal(interrupted.slimejumperPerkMigrationVersion, undefined);
  assert.equal(JSON.parse(interrupted.slimejumperPerkMigrationTransaction).targetBalance, 1847);
  assert.equal(interruptedResult.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), 0);

  const recoveredResult = runMigration(storage);
  assert.equal(storage.snapshot().slimejumperStarBalance, "347");
  assert.equal(storage.snapshot().slimejumperPerkMigrationVersion, "perk-migration-2.65");
  assert.equal(storage.snapshot().slimejumperPerkMigrationTransaction, undefined);
  assert.equal(recoveredResult.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), 0);
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
  const result = runMigration(storage, ["air_brake"]);
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(storage.getMutationCount(), mutationsBefore);
  assert.deepEqual(result.activeRunIds, ["air_brake"]);
  assert.equal(result.resetCalls, 0);
  assert.equal(result.starBalanceWrites, 0);
  assert.equal(storage.getSetCount("slimejumperStarBalance"), 0);
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
  const progressIndex = html.indexOf("./js/slime-player-progress.js");
  const achievementsIndex = html.indexOf("./js/slime-achievements.js");
  const migrationIndex = html.indexOf("./js/slime-perk-migration.js");
  const playerIndex = html.indexOf("./js/player.js");
  assert.ok(prestigeIndex >= 0 && prestigeIndex < achievementsIndex);
  assert.ok(prestigeIndex < progressIndex && progressIndex < achievementsIndex);
  assert.ok(achievementsIndex < migrationIndex && migrationIndex < playerIndex);
  assert.match(
    read("js/slime-achievements.js"),
    /function loadStarBalance\(\) \{\s+let balance = 0;/
  );
  assert.match(read("js/slime-achievements.js"), /recoverInterruptedRun[\s\S]*?checkStateAchievements/);

  const resetSource = read("js/slime-progress-reset.js");
  const migrationSource = read("js/slime-perk-migration.js");
  assert.match(resetSource, /RESET_VERSION = "progress-reset-2\.43"/);
  assert.match(resetSource, /PREFERENCE_RESET_VERSION = "preferences-reset-2\.58"/);
  assert.doesNotMatch(migrationSource, /highscore|leaderboard|supabase/i);
  assert.doesNotMatch(
    migrationSource,
    /\b1500\b|STAR_BONUS|SlimeStarEconomy|applyPerkMigrationBalance/
  );
  assert.doesNotMatch(
    read("js/slime-player-progress.js"),
    /hadStoredProgressBeforeInitialization/
  );
}

assertFreshInstallKeepsZeroBalance();
assertFreshInstallWithUiPreferencesKeepsZeroBalance();
assertSuccessfulMigrationAndReloads();
assertRecoveryAfterPerkWriteFailure();
assertRecoveryOfPreviousBonusTransactionWithoutPayout();
assertCompletedMarkerIsMutationFree();
assertRealTemporaryPerkReset();
assertStarShieldUsesNewId();
assertIdsAndStartupOrder();

console.log("v2.65 perk migration tests passed.");
