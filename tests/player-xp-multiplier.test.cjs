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
  assert.equal(multiplier(0, 200), 2.00);
  assert.equal(multiplier(0, 250), 2.25);
  assert.equal(multiplier(0, 300), 2.50);
  assert.equal(multiplier(0, 10000), 2.50);
  assert.equal(multiplier(10, 200), 3.00);
  assert.equal(multiplier(10, 300), 3.50);
  assert.equal(multiplier(99, 10000), 3.50);
  assert.equal(multiplier(0, 0), 1.00, "an unlocked checkpoint cannot affect a Level 1 start");
  assert.equal(multiplier(-4, -30), 1.00);
  assert.equal(multiplier("invalid", Infinity), 1.00);

  assert.equal(api.prestigeXPBonusPerLevel, 0.10);
  assert.equal(api.prestigeXPBonusMax, 1.00);
  assert.equal(api.checkpointXPBonusPer10Levels, 0.05);
  assert.equal(api.checkpointXPBonusMax, 1.50);
  assert.equal(api.totalXPMultiplierMax, 3.50);
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
  assert.equal(api.calculateRunXP(150, 200), 30);
  assert.equal(api.calculateRunXP(150, 300), 35);

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

class FakeClassList {
  constructor() { this.values = new Set(["hidden"]); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }
  contains(name) { return this.values.has(name); }
}

class FakeHudElement {
  constructor() {
    this.textContent = "";
    this.innerHTML = "";
    this.attributes = {};
    this.style = {};
    this.classList = new FakeClassList();
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}

function assertPrestigeXPDisplay(api) {
  const gameSource = read("js/game.js");
  const displayStart = gameSource.indexOf("  function formatScoreMultiplier(");
  const displayEnd = gameSource.indexOf("  function initializeRunScoreState(");
  assert.ok(displayStart >= 0 && displayEnd > displayStart);

  let prestigeLevel = 0;
  const ui = {
    checkpointBonusHud: new FakeHudElement(),
    checkpointBonusMultiplier: new FakeHudElement(),
    runXPBonusHud: new FakeHudElement(),
    runXPBonusMultiplier: new FakeHudElement(),
    prestigeXPBonusHud: new FakeHudElement(),
    prestigeXPBonusMultiplier: new FakeHudElement()
  };
  const context = vm.createContext({
    window: {
      SlimePrestige: {getLevel: () => prestigeLevel},
      SlimePlayerProgress: api
    },
    ui
  });
  vm.runInContext(
    `
      let state = "playing";
      let runScoreMultiplier = 1;
      let runStartLevel = 1;
      let runStartedFromCheckpoint = false;
    ` + gameSource.slice(displayStart, displayEnd) + `
      globalThis.prestigeXPDisplayTestApi = {
        updateCheckpointBonusHUD,
        setPrestigeLevel(value) { prestigeLevel = value; },
        setCheckpoint(multiplier, level) {
          runScoreMultiplier = multiplier;
          runStartLevel = level;
          runStartedFromCheckpoint = multiplier > 1;
        }
      };
    `,
    context,
    {filename: "js/game-prestige-xp-display-test-slice.js"}
  );

  prestigeLevel = 0;
  context.prestigeXPDisplayTestApi.updateCheckpointBonusHUD();
  assert.equal(ui.runXPBonusMultiplier.textContent, "x1,00");
  assert.equal(ui.runXPBonusHud.classList.contains("hidden"), false);
  assert.equal(ui.prestigeXPBonusMultiplier.textContent, "x1,00");
  assert.equal(ui.prestigeXPBonusHud.classList.contains("hidden"), true);

  context.prestigeXPDisplayTestApi.setCheckpoint(1.50, 100);
  context.prestigeXPDisplayTestApi.updateCheckpointBonusHUD();
  assert.equal(ui.checkpointBonusMultiplier.textContent, "x1.50");
  assert.equal(ui.runXPBonusMultiplier.textContent, "x1,50");
  assert.equal(ui.prestigeXPBonusHud.classList.contains("hidden"), true);

  prestigeLevel = 4;
  context.prestigeXPDisplayTestApi.updateCheckpointBonusHUD();
  assert.equal(ui.checkpointBonusMultiplier.textContent, "x1.50");
  assert.equal(ui.checkpointBonusHud.classList.contains("hidden"), false);
  assert.equal(ui.runXPBonusMultiplier.textContent, "x1,90");
  assert.equal(ui.prestigeXPBonusMultiplier.textContent, "x1,40");
  assert.equal(ui.prestigeXPBonusHud.classList.contains("hidden"), false);

  context.prestigeXPDisplayTestApi.setCheckpoint(2.00, 200);
  prestigeLevel = 10;
  context.prestigeXPDisplayTestApi.updateCheckpointBonusHUD();
  assert.equal(ui.runXPBonusMultiplier.textContent, "x3,00");
  assert.equal(ui.prestigeXPBonusMultiplier.textContent, "x2,00");

  context.prestigeXPDisplayTestApi.setCheckpoint(2.00, 300);
  context.prestigeXPDisplayTestApi.updateCheckpointBonusHUD();
  assert.equal(ui.checkpointBonusMultiplier.textContent, "x2.00");
  assert.equal(ui.runXPBonusMultiplier.textContent, "x3,50");
  assert.equal(ui.prestigeXPBonusMultiplier.textContent, "x2,00");
}

function assertMainMenuPlayerLevelDisplay() {
  const uiSource = read("js/ui.js");
  const displayStart = uiSource.indexOf("  function renderMainMenuPrestige(");
  const displayEnd = uiSource.indexOf("  function renderMainMenuStats(");
  assert.ok(displayStart >= 0 && displayEnd > displayStart);

  let prestigeLevel = 0;
  const progress = {
    level: 1,
    levelXP: 0,
    requiredXP: 200,
    isPrestigeReady: false
  };
  const ui = {
    menuPlayerLevel: new FakeHudElement(),
    menuXPPlayerLevel: new FakeHudElement(),
    menuXPProgress: new FakeHudElement(),
    menuXPProgressText: new FakeHudElement(),
    menuXPProgressBar: new FakeHudElement(),
    menuXPProgressBarFill: new FakeHudElement(),
    menuPrestigeBtn: new FakeHudElement(),
    menuPrestigeEmblem: new FakeHudElement(),
    menuPrestigeLabel: new FakeHudElement()
  };
  const prestige = {
    getLevel: () => prestigeLevel,
    maxAvailablePrestige: 10,
    isTransactionPending: () => false,
    getPendingPermanentWardrobeChoice: () => null,
    getDisplayDefinition: level => ({displayLabel: `P${level}`}),
    getEmblemMarkup: level => `<svg>P${level}</svg>`
  };
  const context = vm.createContext({
    window: {
      SlimePlayerProgress: {getPlayerProgress: () => ({...progress})},
      SlimePrestige: prestige
    },
    ui
  });
  vm.runInContext(
    uiSource.slice(displayStart, displayEnd) + `
      globalThis.mainMenuLevelTestApi = {renderMainMenuPlayerProgress};
    `,
    context,
    {filename: "js/ui-main-menu-level-test-slice.js"}
  );

  for (const level of [1, 7]) {
    progress.level = level;
    context.mainMenuLevelTestApi.renderMainMenuPlayerProgress();
    assert.equal(ui.menuPlayerLevel.textContent, `#${level}`);
    assert.equal(ui.menuXPPlayerLevel.textContent, `#${level}`);
    assert.equal(ui.menuPrestigeBtn.classList.contains("hidden"), false);
    assert.equal(ui.menuPrestigeBtn.classList.contains("prestigeInvisible"), true);
    assert.equal(ui.menuPrestigeEmblem.innerHTML, "");
  }

  prestigeLevel = 1;
  for (const level of [20, 50]) {
    progress.level = level;
    context.mainMenuLevelTestApi.renderMainMenuPlayerProgress();
    assert.equal(ui.menuPlayerLevel.textContent, `#${level}`);
    assert.equal(ui.menuXPPlayerLevel.textContent, `#${level}`);
    assert.equal(ui.menuPrestigeBtn.classList.contains("prestigeInvisible"), false);
    assert.equal(ui.menuPrestigeEmblem.innerHTML, "<svg>P1</svg>");
  }
}

function assertReleaseUILayout() {
  const html = read("index.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, "index.html contains duplicate IDs");
  assert.match(
    html,
    /class="menuBestProgressGroup"[\s\S]*?id="personalBestValue"[\s\S]*?id="menuXPProgress"[\s\S]*?id="menuXPPlayerLevel"[\s\S]*?id="menuXPProgressText"[\s\S]*?id="menuXPProgressBar"/
  );
  assert.match(
    html,
    /class="menuRankStarsGroup"[\s\S]*?id="personalGlobalRank"[\s\S]*?id="personalGlobalRankValue"[\s\S]*?id="starBalanceValue"/
  );
  assert.match(
    html,
    /class="menuMascotRow"[\s\S]*?id="menuPrestigeBtn"[\s\S]*?id="menuMascot"[\s\S]*?id="menuPlayerLevel"/
  );
  assert.match(
    html,
    /class="hudMultiplierGroup"[\s\S]*?id="checkpointBonusHud"[\s\S]*?id="runXPBonusHud"[\s\S]*?id="prestigeXPBonusHud"/
  );

  const coreSource = read("js/core.js");
  assert.match(coreSource, /runXPBonusHud: document\.getElementById\("runXPBonusHud"\)/);
  assert.match(coreSource, /runXPBonusMultiplier: document\.getElementById\("runXPBonusMultiplier"\)/);
  assert.match(coreSource, /prestigeXPBonusHud: document\.getElementById\("prestigeXPBonusHud"\)/);
  assert.match(coreSource, /prestigeXPBonusMultiplier: document\.getElementById\("prestigeXPBonusMultiplier"\)/);
  assert.match(coreSource, /menuXPPlayerLevel: document\.getElementById\("menuXPPlayerLevel"\)/);
  assert.match(coreSource, /personalGlobalRankValue: document\.getElementById\("personalGlobalRankValue"\)/);

  const css = read("css/style.css");
  assert.match(css, /\.menuBestProgressGroup\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;/);
  assert.match(
    css,
    /\.menuMascotRow\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(64px, 1fr\) auto minmax\(64px, 1fr\);[\s\S]*?align-items: center;/
  );
  assert.match(css, /\.menuXPProgress\s*\{[\s\S]*?width: clamp\(120px, 17vw, 165px\)/);
  assert.match(css, /\.menuMascot\s*\{[\s\S]*?align-self: center;/);
  assert.match(css, /\.menuPrestigeButton\s*\{[\s\S]*?align-self: center;/);
  assert.match(css, /\.menuPlayerLevel\s*\{[\s\S]*?align-self: center;/);
  assert.doesNotMatch(
    css,
    /#mainMenuScreen \.menuMascotRow \.menuPlayerLevel\s*\{[\s\S]*?visibility: hidden;/
  );
  assert.match(css, /\.menuXPPlayerLevel\s*\{[\s\S]*?display: none;/);
  assert.match(
    css,
    /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?#mainMenuScreen \.menuBestProgressGroup\s*\{[\s\S]*?width: clamp\(124px, 18vw, 152px\);[\s\S]*?flex-direction: column;[\s\S]*?align-items: stretch;[\s\S]*?#mainMenuScreen \.menuRankStarsGroup\s*\{[\s\S]*?width: clamp\(124px, 18vw, 152px\);[\s\S]*?flex-direction: column;[\s\S]*?#mainMenuScreen \.menuStatusBadge\s*\{[\s\S]*?min-height: clamp\(34px, 10dvh, 46px\);[\s\S]*?#mainMenuScreen \.menuStatusBadge--stars\s*\{[\s\S]*?order: -1;[\s\S]*?#mainMenuScreen \.menuXPProgress\s*\{[\s\S]*?width: 100%;[\s\S]*?#mainMenuScreen \.menuXPProgressBar\s*\{[\s\S]*?height: clamp\(8px, 2\.5dvh, 12px\);/
  );
  assert.match(css, /\.hudMultiplierGroup\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;/);
  assert.match(
    css,
    /\.prestigeXPBonusHud\s*\{[\s\S]*?var\(--ui-purple-light\)[\s\S]*?var\(--ui-purple\)[\s\S]*?var\(--ui-purple-dark\)/
  );
  assert.match(css, /\.runXPBonusHud\s*\{[\s\S]*?border-color: #baff72;/);
  assert.match(css, /\.checkpointBonusHud\s*\{[\s\S]*?border: 2px solid #9beaff;/);
  assert.match(css, /@media \(max-height: 520px\)[\s\S]*?\.prestigeXPBonusHud/);
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
  assert.match(read("js/slime-jump-highscores.js"), /GAME_VERSION = "2\.69"/);
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
assertPrestigeXPDisplay(fixture.api);
assertMainMenuPlayerLevelDisplay();
assertReleaseUILayout();
assertReleaseGuards();
console.log("Player XP multiplier tests passed.");
