"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  assert.ok(end > start, `missing marker: ${endMarker}`);
  return source.slice(start, end);
}

function createRankFixture({result, error, moduleAvailable = true} = {}) {
  const uiSource = read("js/ui.js");
  const rankFunctions = extract(
    uiSource,
    "  function renderPersonalGlobalRank(",
    "  function populatePrestigeRewardSelect("
  );
  const ui = {personalGlobalRankValue: {textContent: "initial"}};
  const window = {};
  let calls = 0;

  if (moduleAvailable) {
    window.SlimeJumpPlayerBests = {
      async getPersonalGlobalRank() {
        calls++;
        if (error) throw error;
        return result;
      }
    };
  }

  const context = vm.createContext({ui, window});
  vm.runInContext(`
    let globalBestBootstrapPromise = null;
    let personalGlobalRankRequestId = 0;
    ${rankFunctions}
    globalThis.rankMenuTestApi = {updatePersonalGlobalRank};
  `, context, {filename: "js/ui-personal-global-rank-slice.js"});

  return {
    update: context.rankMenuTestApi.updatePersonalGlobalRank,
    value: ui.personalGlobalRankValue,
    getCalls: () => calls
  };
}

async function assertSuccessfulRank() {
  const fixture = createRankFixture({
    result: {bestScore: 6885, rank: 27}
  });
  await fixture.update();
  assert.equal(fixture.value.textContent, "27");
  assert.equal(fixture.getCalls(), 1);

  const html = read("index.html");
  assert.match(
    html,
    /id="personalGlobalRank"[\s\S]*?>RANG<[\s\S]*?id="personalGlobalRankValue">—</
  );
}

async function assertMissingRankFallback() {
  const fixture = createRankFixture({
    result: {bestScore: null, rank: null}
  });
  await fixture.update();
  assert.equal(fixture.value.textContent, "—");
}

async function assertFailureFallbackDoesNotEscape() {
  const offline = createRankFixture({error: new Error("offline")});
  await assert.doesNotReject(() => offline.update());
  assert.equal(offline.value.textContent, "—");

  const unavailable = createRankFixture({moduleAvailable: false});
  await assert.doesNotReject(() => unavailable.update());
  assert.equal(unavailable.value.textContent, "—");
}

function assertPlayerLevelRemainsSeparate() {
  const uiSource = read("js/ui.js");
  const progressFunction = extract(
    uiSource,
    "  function renderMainMenuPlayerProgress(",
    "  function renderMainMenuStats("
  );
  const createElement = () => ({
    textContent: "",
    style: {},
    setAttribute() {}
  });
  const ui = {
    menuPlayerLevel: createElement(),
    menuXPPlayerLevel: createElement(),
    menuXPProgress: createElement(),
    menuXPProgressText: createElement(),
    menuXPProgressBar: createElement(),
    menuXPProgressBarFill: createElement()
  };
  const window = {
    SlimePlayerProgress: {
      getPlayerProgress: () => ({
        level: 64,
        levelXP: 25,
        requiredXP: 200,
        isPrestigeReady: false
      })
    },
    SlimePrestige: {getLevel: () => 0, maxAvailablePrestige: 10}
  };
  const context = vm.createContext({ui, window});
  vm.runInContext(`
    const renderMainMenuPrestige = () => {};
    ${progressFunction}
    renderMainMenuPlayerProgress();
  `, context, {filename: "js/ui-player-level-rank-isolation-slice.js"});
  assert.equal(ui.menuPlayerLevel.textContent, "#64");
  assert.equal(ui.menuXPPlayerLevel.textContent, "#64");
}

function assertRefreshAndResponsiveLayout() {
  const uiSource = read("js/ui.js");
  const mainScreenBlock = extract(
    uiSource,
    "  function showMenuScreen(",
    "  function getHowToThumbOffset("
  );
  assert.match(
    mainScreenBlock,
    /if \(screenName === "main"\)[\s\S]*?renderMainMenuStats\(\);[\s\S]*?void updatePersonalGlobalRank\(\);/
  );

  const html = read("index.html");
  const rightGroup = extract(
    html,
    "          <div class=\"menuRankStarsGroup\">",
    "        </div>\n        <header class=\"menuHero\">"
  );
  assert.ok(
    rightGroup.indexOf("personalGlobalRank") < rightGroup.indexOf("starBalanceValue"),
    "desktop rank must precede stars"
  );

  const css = read("css/style.css");
  assert.match(css, /\.menuRankStarsGroup\s*\{[\s\S]*?display: flex;[\s\S]*?justify-content: flex-end;/);
  assert.match(
    css,
    /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?#mainMenuScreen \.menuRankStarsGroup\s*\{[\s\S]*?flex-direction: column;[\s\S]*?#mainMenuScreen \.menuStatusBadge--stars\s*\{[\s\S]*?order: -1;/
  );
}

function assertTopTenModuleIsIsolated() {
  const topTenSource = read("js/slime-jump-highscores.js");
  assert.doesNotMatch(
    topTenSource,
    /personalGlobalRank|SlimeJumpPlayerBests|getPersonalGlobalRank/
  );
}

(async () => {
  await assertSuccessfulRank();
  await assertMissingRankFallback();
  await assertFailureFallbackDoesNotEscape();
  assertPlayerLevelRemainsSeparate();
  assertRefreshAndResponsiveLayout();
  assertTopTenModuleIsIsolated();
  console.log("Personal global rank menu tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
