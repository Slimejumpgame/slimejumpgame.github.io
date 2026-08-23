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
  const removeFailures = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      const remainingFailures = removeFailures.get(key) ?? 0;
      if (remainingFailures > 0) {
        removeFailures.set(key, remainingFailures - 1);
        throw new Error(`forced remove failure for ${key}`);
      }
      values.delete(key);
    },
    failNextRemove(key, count = 1) {
      removeFailures.set(key, Math.max(0, Number(count) || 0));
    },
    snapshot() {
      return Object.fromEntries(values);
    }
  };
}

class FakeClassList {
  constructor(hidden = false) {
    this.values = new Set(hidden ? ["hidden"] : []);
  }
  add(...values) {
    values.forEach(value => this.values.add(value));
  }
  remove(...values) {
    values.forEach(value => this.values.delete(value));
  }
  contains(value) {
    return this.values.has(value);
  }
}

const quietConsole = {
  log() {},
  info() {},
  warn() {},
  error() {}
};

function loadRecoveryApi(localStorage) {
  const window = {};
  vm.runInNewContext(read("js/slime-run-recovery.js"), {
    window,
    localStorage,
    console: quietConsole
  }, {filename: "js/slime-run-recovery.js"});
  return window.SlimeRunRecovery;
}

function loadGuardFixture({
  initialState = "menu",
  menuHidden = false,
  perksHidden = false,
  storedRecord = false
} = {}) {
  let recoveryChecks = 0;
  const context = vm.createContext({
    state: initialState,
    ui: {
      menu: {classList: new FakeClassList(menuHidden)},
      perksScreen: {classList: new FakeClassList(perksHidden)}
    },
    window: {
      SlimeRunRecovery: {
        hasStoredRecord() {
          recoveryChecks++;
          return storedRecord;
        }
      }
    }
  });
  const source = read("js/ui.js");
  const start = source.indexOf("  function canChangePerkSelection()");
  const end = source.indexOf("  function renderPerksScreen()", start);
  assert.ok(start >= 0 && end > start);
  const guardSource = source.slice(start, end);
  vm.runInContext(guardSource + `
    globalThis.perkMenuGuardTestApi = {
      canChange: canChangePerkSelection,
      setState(value) { state = value; }
    };
  `, context, {filename: "js/ui-perk-menu-guard-test-slice.js"});
  return {
    api: context.perkMenuGuardTestApi,
    guardSource,
    getRecoveryChecks: () => recoveryChecks
  };
}

function loadPerkFixture({
  localStorage = createStorage(),
  balance = 0,
  unlocked = [],
  selected = []
} = {}) {
  if (localStorage.getItem("slimejumperStarBalance") === null) {
    localStorage.setItem("slimejumperStarBalance", String(balance));
  }
  if (localStorage.getItem("slimejumperUnlockedPerks") === null) {
    localStorage.setItem("slimejumperUnlockedPerks", JSON.stringify(unlocked));
  }
  if (localStorage.getItem("slimejumperSelectedPerks") === null) {
    localStorage.setItem("slimejumperSelectedPerks", JSON.stringify(selected));
  }

  const window = {};
  const context = vm.createContext({
    window,
    localStorage,
    console: quietConsole,
    DEV_MODE: false,
    initialBalance: Number(localStorage.getItem("slimejumperStarBalance"))
  });
  const achievementSource = read("js/slime-achievements.js");
  const economyStart = achievementSource.indexOf("  function normalizeStarUnlockRequest(request)");
  const economyEnd = achievementSource.indexOf("  function canPurchaseWardrobeItem", economyStart);
  assert.ok(economyStart >= 0 && economyEnd > economyStart);
  vm.runInContext(`
    const activeWardrobePurchases = new Set();
    let starBalance = initialBalance;
    function isDevModeEnabled() { return false; }
    function saveStarBalance() {
      try {
        localStorage.setItem("slimejumperStarBalance", String(starBalance));
        return true;
      } catch (_) {
        return false;
      }
    }
    function saveStarBalanceVerified() {
      return saveStarBalance() &&
        localStorage.getItem("slimejumperStarBalance") === String(starBalance);
    }
  ` + achievementSource.slice(economyStart, economyEnd) + `
    window.SlimeStarEconomy = {
      getBalance: () => starBalance,
      purchaseUnlock
    };
  `, context, {filename: "js/slime-achievements-perk-economy-test-slice.js"});
  vm.runInContext(read("js/slime-perks.js"), context, {
    filename: "js/slime-perks.js"
  });
  return {api: window.SlimePerks, economy: window.SlimeStarEconomy, localStorage};
}

function loadReturnToMenuFixture({initialState, recovery}) {
  let clearedPerkSnapshot = 0;
  const toasts = [];
  const context = vm.createContext({
    pendingGameOverScore: null,
    commitPendingHighScore: async () => true,
    enterRunStage() {},
    window: {
      SlimeRunRecovery: recovery,
      SlimePerks: {
        clearRunPerkSnapshot() {
          clearedPerkSnapshot++;
        }
      },
      SlimeAchievements: {
        restoreRunProgressSnapshot: () => true,
        discardRunProgressSnapshot() {}
      }
    },
    state: initialState,
    initializeRunScoreState() {},
    setMusicMode() {},
    musicMuted: true,
    startBackgroundMusic() {},
    aiming: true,
    activeTouchId: 1,
    drag: {x: 1, y: 1},
    player: {vx: 1, vy: 1},
    stuckAimFallbackActive: true,
    resetStuckAimTimer() {},
    canvas: {classList: new FakeClassList()},
    ui: {
      message: {classList: new FakeClassList()},
      tutorialCompleteOverlay: {classList: new FakeClassList()},
      menu: {classList: new FakeClassList(true)},
      pauseOverlay: {classList: new FakeClassList()},
      pauseBtn: {textContent: "", setAttribute() {}}
    },
    isTutorialStage: () => false,
    restoreWardrobeRunProgressSnapshot: () => true,
    restoreCheckpointLevelAtRunStart: () => true,
    discardWardrobeRunProgressSnapshot() {},
    hideNicknameEntry() {},
    showMenuScreen() {},
    updateHighScores() {},
    renderDevPerkInspector() {},
    showGameToast(message) { toasts.push(message); },
    console: quietConsole
  });
  const source = read("js/game.js");
  const start = source.indexOf("  async function returnToMenu()");
  const end = source.indexOf("  function updateHUD()", start);
  const manualEndStart = source.indexOf("  async function endCurrentRun()");
  const manualEndEnd = source.indexOf("  function shouldSkipEndRunWarning()", manualEndStart);
  assert.ok(start >= 0 && end > start);
  assert.ok(manualEndStart >= 0 && manualEndEnd > manualEndStart);
  vm.runInContext(source.slice(start, end) + source.slice(manualEndStart, manualEndEnd) + `
    globalThis.returnToMenuTestApi = {
      returnToMenu,
      endCurrentRun,
      getState: () => state
    };
  `, context, {filename: "js/game-return-to-menu-test-slice.js"});
  return {
    api: context.returnToMenuTestApi,
    getClearedPerkSnapshot: () => clearedPerkSnapshot,
    toasts
  };
}

function assertMenuStateIsTheOnlyRunAuthorization() {
  const freshMenu = loadGuardFixture();
  assert.equal(freshMenu.api.canChange(), true);

  const staleRecoveryMenu = loadGuardFixture({storedRecord: true});
  assert.equal(staleRecoveryMenu.api.canChange(), true);
  assert.equal(staleRecoveryMenu.getRecoveryChecks(), 0);
  assert.doesNotMatch(staleRecoveryMenu.guardSource, /SlimeRunRecovery|hasStoredRecord/);

  const completedRecoveryMenu = loadGuardFixture({storedRecord: true});
  assert.equal(completedRecoveryMenu.api.canChange(), true);

  for (const activeState of [
    "playing",
    "paused",
    "gamePaused",
    "checkpointBonus",
    "gameover"
  ]) {
    const fixture = loadGuardFixture({initialState: activeState});
    assert.equal(fixture.api.canChange(), false, `${activeState} must remain locked`);
  }

  assert.equal(loadGuardFixture({menuHidden: true}).api.canChange(), false);
  assert.equal(loadGuardFixture({perksHidden: true}).api.canChange(), false);
}

function assertPerkDomainRulesRemainUnchanged() {
  const uiSource = read("js/ui.js");
  assert.match(uiSource, /const PERK_POST_PURCHASE_GUARD_MS = 450;/);
  assert.match(uiSource, /performance\.now\(\) < perkPurchaseGuardUntil/);

  const purchaseFixture = loadPerkFixture({balance: 1000});
  const purchase = purchaseFixture.api.purchasePerk("air_hop");
  assert.equal(purchase.ok, true);
  assert.equal(purchaseFixture.economy.getBalance(), 500);
  assert.equal(purchaseFixture.api.getStoredUnlockedPerkIds().includes("air_hop"), true);
  const duplicatePurchase = purchaseFixture.api.purchasePerk("air_hop");
  assert.equal(duplicatePurchase.reason, "already-unlocked");
  assert.equal(purchaseFixture.economy.getBalance(), 500);

  const insufficientFixture = loadPerkFixture({balance: 499});
  const insufficient = insufficientFixture.api.purchasePerk("air_hop");
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.reason, "insufficient-stars");
  assert.equal(insufficientFixture.economy.getBalance(), 499);

  const selectionFixture = loadPerkFixture({
    balance: 0,
    unlocked: ["air_hop", "air_brake", "extra_life", "mud_shoes", "power_shot"],
    selected: ["extra_life", "mud_shoes", "power_shot"]
  });
  assert.equal(selectionFixture.api.toggleSelectedPerk("air_hop").reason, "max-selected");
  assert.equal(selectionFixture.api.toggleSelectedPerk("power_shot").ok, true);
  assert.equal(selectionFixture.api.toggleSelectedPerk("air_hop").ok, true);
  const airBrakeSelection = selectionFixture.api.toggleSelectedPerk("air_brake");
  assert.equal(airBrakeSelection.ok, true);
  assert.equal(airBrakeSelection.selected.length, 3);
  assert.equal(airBrakeSelection.selected.includes("air_brake"), true);
  assert.equal(airBrakeSelection.selected.includes("air_hop"), false);
}

async function assertAllMenuReturnPathsNeutralizeRecovery() {
  for (const initialState of ["playing", "paused", "gamePaused", "gameover"] ) {
    let neutralizeCalls = 0;
    const fixture = loadReturnToMenuFixture({
      initialState,
      recovery: {
        neutralizeForMenu() {
          neutralizeCalls++;
          return true;
        }
      }
    });
    assert.equal(await fixture.api.returnToMenu(), true);
    assert.equal(fixture.api.getState(), "menu");
    assert.equal(neutralizeCalls, 1);
    assert.equal(fixture.getClearedPerkSnapshot(), 1);
  }

  const blockedFixture = loadReturnToMenuFixture({
    initialState: "playing",
    recovery: {neutralizeForMenu: () => false}
  });
  assert.equal(await blockedFixture.api.returnToMenu(), false);
  assert.equal(blockedFixture.api.getState(), "playing");
  assert.equal(blockedFixture.getClearedPerkSnapshot(), 0);
  assert.equal(blockedFixture.toasts.length, 1);

  let rollbackClears = 0;
  let manualNeutralizeCalls = 0;
  const manualEndFixture = loadReturnToMenuFixture({
    initialState: "gamePaused",
    recovery: {
      clearAfterRollback() {
        rollbackClears++;
        return true;
      },
      neutralizeForMenu() {
        manualNeutralizeCalls++;
        return true;
      }
    }
  });
  assert.equal(await manualEndFixture.api.endCurrentRun(), true);
  assert.equal(manualEndFixture.api.getState(), "menu");
  assert.equal(rollbackClears, 1);
  assert.equal(manualNeutralizeCalls, 1);
}

function assertStaleMenuRecoveryCannotRefundAPerk() {
  const localStorage = createStorage({
    slimejumperStarBalance: "1000",
    slimejumperUnlockedPerks: "[]",
    slimejumperSelectedPerks: "[]"
  });
  const recovery = loadRecoveryApi(localStorage);
  assert.equal(recovery.beginActiveRun({
    achievementSnapshot: {starBalance: 100},
    wardrobeSnapshot: {selectedColor: "green"}
  }), true);

  localStorage.failNextRemove(recovery.storageKey);
  assert.equal(recovery.neutralizeForMenu(), true);
  const completedMarker = JSON.parse(localStorage.getItem(recovery.storageKey));
  assert.equal(completedMarker.status, "completed");

  const purchaseFixture = loadPerkFixture({localStorage});
  const purchase = purchaseFixture.api.purchasePerk("air_hop");
  assert.equal(purchase.ok, true);
  assert.equal(purchaseFixture.economy.getBalance(), 500);
  assert.equal(purchaseFixture.api.getStoredUnlockedPerkIds().includes("air_hop"), true);

  let restoreCalls = 0;
  const reloadedRecovery = loadRecoveryApi(localStorage);
  const reloadResult = reloadedRecovery.recoverInterruptedRun({
    isAchievementSnapshotValid: () => true,
    isWardrobeSnapshotValid: () => true,
    restoreAchievementSnapshot: () => {
      restoreCalls++;
      localStorage.setItem("slimejumperStarBalance", "100");
      return true;
    },
    restoreWardrobeSnapshot: () => {
      restoreCalls++;
      return true;
    }
  });
  assert.equal(reloadResult.found, true);
  assert.equal(reloadResult.recovered, false);
  assert.equal(restoreCalls, 0);
  assert.equal(localStorage.getItem("slimejumperStarBalance"), "500");

  const afterReload = loadPerkFixture({localStorage});
  assert.equal(afterReload.api.getStoredUnlockedPerkIds().includes("air_hop"), true);
  assert.equal(afterReload.api.purchasePerk("air_hop").reason, "already-unlocked");
  assert.equal(afterReload.economy.getBalance(), 500);
}

function assertRecoveredRunUsesCompletionSafeCleanup() {
  const localStorage = createStorage();
  const recovery = loadRecoveryApi(localStorage);
  assert.equal(recovery.beginActiveRun({
    achievementSnapshot: {starBalance: 100},
    wardrobeSnapshot: {selectedColor: "green"}
  }), true);
  localStorage.failNextRemove(recovery.storageKey);
  const result = recovery.recoverInterruptedRun({
    isAchievementSnapshotValid: () => true,
    isWardrobeSnapshotValid: () => true,
    restoreAchievementSnapshot: () => true,
    restoreWardrobeSnapshot: () => true
  });
  assert.equal(result.recovered, true);
  assert.equal(result.blocked, false);
  assert.equal(JSON.parse(localStorage.getItem(recovery.storageKey)).status, "completed");
}

async function main() {
  assertMenuStateIsTheOnlyRunAuthorization();
  assertPerkDomainRulesRemainUnchanged();
  await assertAllMenuReturnPathsNeutralizeRecovery();
  assertStaleMenuRecoveryCannotRefundAPerk();
  assertRecoveredRunUsesCompletionSafeCleanup();
  console.log("Perk menu state-lock and recovery tests passed.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
