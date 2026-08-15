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

function loadPlayerProgressApi() {
  let prestigeLevel = 0;
  const localStorage = createStorage({
    slimejumperPlayerLevel: "1",
    slimejumperPlayerLevelXP: "0"
  });
  const window = {
    SlimePrestige: {getLevel: () => prestigeLevel}
  };
  vm.runInNewContext(
    read("js/slime-player-progress.js"),
    {window, localStorage, console},
    {filename: "js/slime-player-progress.js"}
  );
  return {
    api: window.SlimePlayerProgress,
    localStorage,
    setPrestigeLevel(value) { prestigeLevel = value; }
  };
}

function assertMultiplierBalance(api) {
  const multiplier = api.calculateRunXPMultiplier;
  assert.equal(multiplier(0, 0), 1.00);
  assert.equal(multiplier(1, 0), 1.10);
  assert.equal(multiplier(4, 30), 1.55);
  assert.equal(multiplier(10, 0), 2.00);
  assert.equal(multiplier(10, 100), 2.50);
  assert.equal(multiplier(99, 0), 2.00);
  assert.equal(multiplier(0, 10000), 2.00);
  assert.equal(multiplier(99, 10000), 3.00);
  assert.equal(multiplier(0, 0), 1.00, "an unlocked checkpoint cannot affect a Level 1 start");
  assert.equal(multiplier(-4, -30), 1.00);
  assert.equal(multiplier("invalid", Infinity), 1.00);

  assert.equal(api.prestigeXPBonusPerLevel, 0.10);
  assert.equal(api.prestigeXPBonusMax, 1.00);
  assert.equal(api.checkpointXPBonusPer10Levels, 0.05);
  assert.equal(api.checkpointXPBonusMax, 1.00);
  assert.equal(api.totalXPMultiplierMax, 3.00);
}

function assertRunXPCalculation(fixture) {
  const {api, localStorage, setPrestigeLevel} = fixture;
  setPrestigeLevel(0);
  assert.equal(api.calculateRunXP(150, 0), 10);
  assert.equal(api.calculateRunXP(149, 0), 9);

  setPrestigeLevel(1);
  assert.equal(api.calculateRunXP(150, 0), 11);

  setPrestigeLevel(4);
  assert.equal(api.calculateRunXP(150, 30), 15);
  assert.equal(api.calculateRunXP(149, 30), 13, "final XP is floored once after the multiplier");

  setPrestigeLevel(10);
  assert.equal(api.calculateRunXP(150, 0), 20);
  assert.equal(api.calculateRunXP(150, 100), 25);

  setPrestigeLevel(4);
  const award = api.awardRunXP(150, 30);
  assert.equal(award.earnedXP, 15);
  assert.equal(award.levelXP, 15);
  assert.equal(localStorage.snapshot().slimejumperPlayerLevelXP, "15");
  assert.equal(Number.isInteger(award.earnedXP), true);
}

function assertLegitimateGameOverIntegration() {
  const gameSource = read("js/game.js");
  assert.match(
    gameSource,
    /if \(recoveryCompleted && !activeRunXPAwarded\) \{[\s\S]*?activeRunXPAwarded = true;[\s\S]*?selectedRunStartCheckpoint = runStartedFromCheckpoint[\s\S]*?\? runStartLevel[\s\S]*?: 0;[\s\S]*?awardRunXP\?\.\([\s\S]*?score,[\s\S]*?selectedRunStartCheckpoint/
  );
  assert.equal(
    (gameSource.match(/awardRunXP\?\.\(/g) ?? []).length,
    1,
    "XP has exactly one game-over award call"
  );

  const manualEndStart = gameSource.indexOf("  async function endCurrentRun(");
  const manualEndEnd = gameSource.indexOf("  function shouldSkipEndRunWarning(");
  assert.doesNotMatch(gameSource.slice(manualEndStart, manualEndEnd), /awardRunXP/);

  assert.match(gameSource, /const CHECKPOINT_SCORE_MULTIPLIER_STEP = 0\.05;/);
  assert.match(gameSource, /const MAX_CHECKPOINT_SCORE_MULTIPLIER = 2;/);
  assert.match(
    gameSource,
    /Math\.round\(positivePoints \* runScoreMultiplier\) - safeDeduction/
  );
}

function assertReleaseGuards() {
  const progressSource = read("js/slime-player-progress.js");
  assert.equal(
    (progressSource.match(/const PLAYER_LEVEL(?:_XP)?_STORAGE_KEY/g) ?? []).length,
    2,
    "no Player-XP storage key was added"
  );
  assert.match(progressSource, /Math\.floor\(normalizedScore \/ RUN_SCORE_TO_XP_DIVISOR\)/);
  assert.match(progressSource, /Math\.floor\(baseRunXP \* xpMultiplier\)/);
  assert.doesNotMatch(progressSource, /slimejumperBest|slimejumperStars|Supabase|calling_card/);

  assert.match(read("js/slime-prestige.js"), /const PRESTIGE_BALANCE = Object\.freeze\(\{xpBonusPerPrestige: 0\.00\}\);/);
  assert.match(read("js/slime-jump-highscores.js"), /GAME_VERSION = "2\.58"/);
  assert.match(read("js/slime-progress-reset.js"), /RESET_VERSION = "progress-reset-2\.43"/);
  assert.match(
    read("js/slime-progress-reset.js"),
    /PREFERENCE_RESET_VERSION = "preferences-reset-2\.58"/
  );
}

const fixture = loadPlayerProgressApi();
assertMultiplierBalance(fixture.api);
assertRunXPCalculation(fixture);
assertLegitimateGameOverIntegration();
assertReleaseGuards();
console.log("Player XP multiplier tests passed.");
