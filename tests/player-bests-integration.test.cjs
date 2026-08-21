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

function createCommitFixture({submitFails = false, rankingAvailable = true} = {}) {
  const source = read("js/ui.js");
  const submitFunction = extract(
    source,
    "  function submitOnlineHighScore(",
    "  function saveRecentScore("
  );
  const commitFunction = extract(
    source,
    "  async function commitPendingHighScore()",
    "  let devCallingCardTestEntry"
  );
  const counters = {
    globalSubmits: 0,
    localSaves: 0,
    hides: 0,
    refreshes: 0
  };
  const submittedPayloads = [];
  const pendingScore = {
    score: 7000,
    reachedLevel: 12,
    identitySnapshot: {
      playerLevel: 9,
      prestigeLevel: 0,
      prestigeEmblemId: "none",
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    }
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
  if (rankingAvailable) {
    window.SlimeJumpPlayerBests = {
      recordGlobalBestCandidate(payload) {
        counters.globalSubmits++;
        submittedPayloads.push(JSON.parse(JSON.stringify(payload)));
        return submitFails
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({bestScore: payload.score, improved: true});
      }
    };
  }
  const context = vm.createContext({
    window,
    Promise,
    console: {info() {}, error() {}, warn() {}},
    localStorage: {setItem() {}},
    testState: {pendingScore, ui, counters}
  });

  vm.runInContext(`
    let pendingGameOverScore = testState.pendingScore;
    let lastOnlineScoreSubmit = Promise.resolve(null);
    const selectedSlimeColor = "green";
    const selectedSlimeCosmetic = "none";
    const selectedSlimeBeard = "none";
    const ui = testState.ui;
    const normalizeNickname = value => String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    const normalizeHighScoreIdentitySnapshot = value => value;
    const normalizeHighScoreAchievementIds = value => Array.isArray(value) ? value : [];
    const getHighScoreAchievementSnapshot = () => [];
    const saveRecentScore = () => { testState.counters.localSaves++; };
    const hideNicknameEntry = () => { testState.counters.hides++; };
    const updateHighScores = () => { testState.counters.refreshes++; };
    ${submitFunction}
    ${commitFunction}
    globalThis.freshCommitTestApi = {commitPendingHighScore};
  `, context, {filename: "js/ui-fresh-global-ranking-integration-slice.js"});

  return {
    api: context.freshCommitTestApi,
    counters,
    submittedPayloads
  };
}

async function assertEveryConfirmedRunUsesCanonicalSubmit() {
  const fixture = createCommitFixture();
  assert.equal(await fixture.api.commitPendingHighScore(), true);
  assert.equal(fixture.counters.globalSubmits, 1);
  assert.equal(fixture.counters.localSaves, 1);
  assert.equal(fixture.submittedPayloads[0].score, 7000);
  assert.equal(fixture.submittedPayloads[0].callingCardSnapshot.playerLevel, 9);
}

async function assertNetworkFailureDoesNotBlockLocalFlow() {
  const fixture = createCommitFixture({submitFails: true});
  assert.equal(await fixture.api.commitPendingHighScore(), true);
  assert.equal(fixture.counters.globalSubmits, 1);
  assert.equal(fixture.counters.localSaves, 1);
  assert.equal(fixture.counters.hides, 1);
  assert.equal(fixture.counters.refreshes, 1);

  const unavailable = createCommitFixture({rankingAvailable: false});
  assert.equal(await unavailable.api.commitPendingHighScore(), true);
  assert.equal(unavailable.counters.globalSubmits, 0);
  assert.equal(unavailable.counters.localSaves, 1);
}

function assertNoTopTenQualificationOrSecondUi() {
  const uiSource = read("js/ui.js");
  assert.doesNotMatch(uiSource, /qualifiesForOnlineTopTen/);
  assert.match(uiSource, /recordGlobalBestCandidate\(submittedScore\)/);

  const index = read("index.html");
  assert.doesNotMatch(index, />\s*Rang speichern\s*</i);
  assert.doesNotMatch(index, />\s*Bestscore speichern\s*</i);
}

(async () => {
  await assertEveryConfirmedRunUsesCanonicalSubmit();
  await assertNetworkFailureDoesNotBlockLocalFlow();
  assertNoTopTenQualificationOrSecondUi();
  console.log("Player bests integration tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
