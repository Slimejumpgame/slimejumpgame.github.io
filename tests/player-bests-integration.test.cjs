"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

function extractFunction(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  assert.ok(end > start, `missing marker: ${endMarker}`);
  return source.slice(start, end);
}

function createCommitFixture({
  topTenQualifies = false,
  rankSyncFails = false,
  rankModuleAvailable = true
} = {}) {
  const source = read("js/ui.js");
  const syncHelper = extractFunction(
    source,
    "  function syncPersonalBestForCommittedHighScore()",
    "  function showNicknameEntry()"
  );
  const commitFunction = extractFunction(
    source,
    "  async function commitPendingHighScore()",
    "  let devCallingCardTestEntry"
  );
  const counters = {
    rankSyncs: 0,
    topTenChecks: 0,
    topTenSubmits: 0,
    localSaves: 0,
    hides: 0,
    refreshes: 0
  };
  const pendingScore = {
    score: 7000,
    reachedLevel: 12,
    identitySnapshot: {playerLevel: 9, prestigeLevel: 0}
  };
  const ui = {
    nicknameInput: {value: "ABC", focus() {}},
    nicknameEntry: {
      offsetWidth: 1,
      classList: {add() {}, remove() {}}
    },
    nicknameHint: {textContent: ""}
  };
  const window = {};
  if (rankModuleAvailable) {
    window.SlimeJumpPlayerBests = {
      syncLocalPersonalBest() {
        counters.rankSyncs++;
        return rankSyncFails
          ? Promise.reject(new Error("rank offline"))
          : Promise.resolve({bestScore: 7000, improved: true});
      }
    };
  }
  const context = vm.createContext({
    window,
    Promise,
    console: {info() {}, error() {}, warn() {}},
    localStorage: {setItem() {}},
    testState: {pendingScore, ui, counters, topTenQualifies}
  });

  vm.runInContext(`
    let pendingGameOverScore = testState.pendingScore;
    const ui = testState.ui;
    const normalizeNickname = value => String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    const normalizeHighScoreIdentitySnapshot = value => value;
    const getHighScoreAchievementSnapshot = () => [];
    const submitOnlineHighScore = async () => {
      testState.counters.topTenChecks++;
      if (testState.topTenQualifies) testState.counters.topTenSubmits++;
      return null;
    };
    const saveRecentScore = () => { testState.counters.localSaves++; };
    const hideNicknameEntry = () => { testState.counters.hides++; };
    const updateHighScores = () => { testState.counters.refreshes++; };
    ${syncHelper}
    ${commitFunction}
    globalThis.phase2TestApi = {commitPendingHighScore};
  `, context, {filename: "js/ui-player-bests-integration-slice.js"});

  return {api: context.phase2TestApi, counters};
}

async function flushPromiseHandlers() {
  await Promise.resolve();
  await Promise.resolve();
}

async function assertNonTopTenStillSyncsPersonalBest() {
  const fixture = createCommitFixture({topTenQualifies: false});
  assert.equal(await fixture.api.commitPendingHighScore(), true);
  await flushPromiseHandlers();
  assert.equal(fixture.counters.rankSyncs, 1);
  assert.equal(fixture.counters.topTenChecks, 1);
  assert.equal(fixture.counters.topTenSubmits, 0);
  assert.equal(fixture.counters.localSaves, 1);
}

async function assertTopTenKeepsBothSystems() {
  const fixture = createCommitFixture({topTenQualifies: true});
  assert.equal(await fixture.api.commitPendingHighScore(), true);
  await flushPromiseHandlers();
  assert.equal(fixture.counters.rankSyncs, 1);
  assert.equal(fixture.counters.topTenChecks, 1);
  assert.equal(fixture.counters.topTenSubmits, 1);
  assert.equal(fixture.counters.localSaves, 1);
}

async function assertRankFailureDoesNotBlockExistingFlow() {
  const fixture = createCommitFixture({
    topTenQualifies: true,
    rankSyncFails: true
  });
  assert.equal(await fixture.api.commitPendingHighScore(), true);
  await flushPromiseHandlers();
  assert.equal(fixture.counters.rankSyncs, 1);
  assert.equal(fixture.counters.topTenSubmits, 1);
  assert.equal(fixture.counters.localSaves, 1);
  assert.equal(fixture.counters.hides, 1);
  assert.equal(fixture.counters.refreshes, 1);

  const unavailable = createCommitFixture({
    topTenQualifies: false,
    rankModuleAvailable: false
  });
  assert.equal(await unavailable.api.commitPendingHighScore(), true);
  assert.equal(unavailable.counters.rankSyncs, 0);
  assert.equal(unavailable.counters.topTenChecks, 1);
  assert.equal(unavailable.counters.localSaves, 1);
}

function assertNoSecondUiAndTopTenIsolation() {
  const index = read("index.html");
  assert.doesNotMatch(index, /id="(?:personal|global)?Rank/i);
  assert.doesNotMatch(index, />\s*Rang speichern\s*</i);
  assert.doesNotMatch(index, />\s*Bestscore speichern\s*</i);

  const existingTopTenModule = read("js/slime-jump-highscores.js");
  assert.doesNotMatch(
    existingTopTenModule,
    /SlimeJumpPlayerBests|syncLocalPersonalBest|slime_jump_player_bests/
  );
}

(async () => {
  await assertNonTopTenStillSyncsPersonalBest();
  await assertTopTenKeepsBothSystems();
  await assertRankFailureDoesNotBlockExistingFlow();
  assertNoSecondUiAndTopTenIsolation();
  console.log("Player bests integration tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
