"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const INSTALLATION_ID = "11111111-2222-4333-8444-555555555555";

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  assert.ok(end > start, `missing marker: ${endMarker}`);
  return source.slice(start, end);
}

function response(json) {
  return {
    ok: true,
    status: 200,
    json: async () => json,
    text: async () => ""
  };
}

function createBootstrapFixture({localBest, networkFails = false} = {}) {
  const storage = new Map([["slimejumperBest", String(localBest ?? 0)]]);
  const calls = [];
  const ui = {personalGlobalRankValue: {textContent: "initial"}};
  const window = {};
  const context = vm.createContext({
    window,
    testUi: ui,
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    fetch: async (url, options) => {
      calls.push({url, options});
      if (networkFails) throw new Error("offline");
      if (url.endsWith("/submit_slime_jump_personal_best")) {
        const payload = JSON.parse(options.body);
        return response([{
          best_score: payload.p_best_score,
          improved: true
        }]);
      }
      if (url.endsWith("/get_slime_jump_personal_rank")) {
        return localBest > 0
          ? response([{best_score: localBest, rank: 37}])
          : response([{best_score: null, rank: null}]);
      }
      throw new Error(`unexpected URL: ${url}`);
    },
    crypto: {randomUUID: () => INSTALLATION_ID},
    Uint8Array,
    Math,
    console: {warn() {}}
  });

  vm.runInContext(read("js/slime-jump-player-bests.js"), context, {
    filename: "js/slime-jump-player-bests.js"
  });

  const uiSource = read("js/ui.js");
  const rankFunctions = extract(
    uiSource,
    "  function renderPersonalGlobalRank(",
    "  function populatePrestigeRewardSelect("
  );
  vm.runInContext(`
    const ui = testUi;
    let personalBestBootstrapPromise = null;
    let personalGlobalRankRequestId = 0;
    ${rankFunctions}
    globalThis.bootstrapTestApi = {updatePersonalGlobalRank};
  `, context, {filename: "js/ui-personal-best-bootstrap-slice.js"});

  return {
    update: context.bootstrapTestApi.updatePersonalGlobalRank,
    calls,
    rankValue: ui.personalGlobalRankValue
  };
}

async function assertExistingPlayerIsBootstrappedBeforeRank() {
  const fixture = createBootstrapFixture({localBest: 50000});
  await fixture.update();

  assert.equal(fixture.calls.length, 2);
  assert.match(fixture.calls[0].url, /\/submit_slime_jump_personal_best$/);
  assert.deepEqual(
    JSON.parse(fixture.calls[0].options.body),
    {p_player_id: INSTALLATION_ID, p_best_score: 50000}
  );
  assert.match(fixture.calls[1].url, /\/get_slime_jump_personal_rank$/);
  assert.equal(fixture.rankValue.textContent, "37");
}

async function assertZeroBestDoesNotSubmit() {
  const fixture = createBootstrapFixture({localBest: 0});
  await fixture.update();

  assert.equal(
    fixture.calls.filter(call => /submit_slime_jump_personal_best$/.test(call.url)).length,
    0
  );
  assert.equal(fixture.rankValue.textContent, "—");
}

async function assertNetworkFailureIsIsolated() {
  const fixture = createBootstrapFixture({localBest: 50000, networkFails: true});
  await assert.doesNotReject(() => fixture.update());
  assert.equal(fixture.rankValue.textContent, "—");
}

async function assertBootstrapRunsOnlyOncePerSession() {
  const fixture = createBootstrapFixture({localBest: 50000});
  await fixture.update();
  await fixture.update();

  assert.equal(
    fixture.calls.filter(call => /submit_slime_jump_personal_best$/.test(call.url)).length,
    1
  );
  assert.equal(
    fixture.calls.filter(call => /get_slime_jump_personal_rank$/.test(call.url)).length,
    2
  );
}

function assertMainMenuAndTopTenIsolation() {
  const uiSource = read("js/ui.js");
  assert.match(
    uiSource,
    /if \(screenName === "main"\)[\s\S]*?void updatePersonalGlobalRank\(\);/
  );
  assert.match(
    uiSource,
    /function syncPersonalBestForCommittedHighScore\(\)[\s\S]*?syncLocalPersonalBest/
  );

  const topTenSource = read("js/slime-jump-highscores.js");
  assert.doesNotMatch(
    topTenSource,
    /personalBestBootstrap|syncLocalPersonalBest|SlimeJumpPlayerBests/
  );
}

(async () => {
  await assertExistingPlayerIsBootstrappedBeforeRank();
  await assertZeroBestDoesNotSubmit();
  await assertNetworkFailureIsIsolated();
  await assertBootstrapRunsOnlyOncePerSession();
  assertMainMenuAndTopTenIsolation();
  console.log("Personal best bootstrap tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
