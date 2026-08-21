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

function retryPayload(score) {
  return {
    name: "ABC",
    score,
    level: 7,
    slimeColor: "green",
    slimeCosmetic: "none",
    slimeBeard: "none",
    slimeAchievements: [],
    callingCardSnapshot: {
      playerLevel: 9,
      prestigeLevel: 0,
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    }
  };
}

function createBootstrapFixture({
  lifetimeBest = 50000,
  globalBest = null,
  networkFails = false
} = {}) {
  const storage = new Map([
    ["slimejumperInstallationId", INSTALLATION_ID],
    ["slimejumperBest", String(lifetimeBest)]
  ]);
  if (globalBest !== null) {
    storage.set("slimejumperGlobalRankBestV1", String(globalBest));
    storage.set(
      "slimejumperGlobalRankBestPayloadV1",
      JSON.stringify(retryPayload(globalBest))
    );
  }
  const calls = [];
  const ui = {personalGlobalRankValue: {textContent: "initial"}};
  const window = {
    SlimeAchievements: {registry: []},
    SlimePrestige: {
      normalizeIdentitySnapshot: value => ({...value, prestigeEmblemId: "none"})
    }
  };
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
      if (url.endsWith("/submit_slime_jump_global_best")) {
        const payload = JSON.parse(options.body);
        return response([{best_score: payload.p_score, improved: true}]);
      }
      if (url.endsWith("/get_slime_jump_personal_rank")) {
        return globalBest !== null
          ? response([{best_score: globalBest, rank: 37}])
          : response([{best_score: null, rank: null}]);
      }
      throw new Error(`unexpected URL: ${url}`);
    },
    crypto: {randomUUID: () => INSTALLATION_ID},
    Uint8Array,
    Math,
    URLSearchParams,
    normalizeSlimeColor: value => value,
    normalizeSlimeCosmetic: value => value,
    normalizeSlimeBeard: value => value,
    console: {info() {}, warn() {}}
  });

  vm.runInContext(read("js/slime-jump-highscores.js"), context, {
    filename: "js/slime-jump-highscores.js"
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
    let globalBestBootstrapPromise = null;
    let personalGlobalRankRequestId = 0;
    ${rankFunctions}
    globalThis.bootstrapTestApi = {updatePersonalGlobalRank};
  `, context, {filename: "js/ui-global-best-bootstrap-slice.js"});

  return {
    update: context.bootstrapTestApi.updatePersonalGlobalRank,
    calls,
    rankValue: ui.personalGlobalRankValue,
    storage
  };
}

async function assertHistoricalLifetimeBestIsIgnored() {
  const fixture = createBootstrapFixture({lifetimeBest: 50000});
  await fixture.update();

  assert.equal(
    fixture.calls.filter(call => /submit_slime_jump_global_best$/.test(call.url)).length,
    0
  );
  assert.equal(fixture.storage.get("slimejumperBest"), "50000");
  assert.equal(fixture.storage.has("slimejumperGlobalRankBestV1"), false);
  assert.equal(fixture.rankValue.textContent, "—");
}

async function assertPostResetBestSyncRunsInBackground() {
  const fixture = createBootstrapFixture({globalBest: 6000});
  await fixture.update();

  assert.equal(fixture.calls.length, 2);
  assert.match(fixture.calls[0].url, /\/get_slime_jump_personal_rank$/);
  assert.match(fixture.calls[1].url, /\/submit_slime_jump_global_best$/);
  assert.equal(JSON.parse(fixture.calls[1].options.body).p_score, 6000);
  assert.equal(fixture.rankValue.textContent, "37");
}

async function assertFailureIsIsolatedAndBootstrapCanRetry() {
  const offline = createBootstrapFixture({globalBest: 6000, networkFails: true});
  await assert.doesNotReject(() => offline.update());
  await Promise.resolve();
  await Promise.resolve();
  await assert.doesNotReject(() => offline.update());
  assert.equal(offline.rankValue.textContent, "—");

  assert.equal(
    offline.calls.filter(call => /submit_slime_jump_global_best$/.test(call.url)).length,
    2
  );

  const online = createBootstrapFixture({globalBest: 6000});
  await online.update();
  await online.update();
  assert.equal(
    online.calls.filter(call => /submit_slime_jump_global_best$/.test(call.url)).length,
    1
  );
  assert.equal(
    online.calls.filter(call => /get_slime_jump_personal_rank$/.test(call.url)).length,
    2
  );
}

(async () => {
  await assertHistoricalLifetimeBestIsIgnored();
  await assertPostResetBestSyncRunsInBackground();
  await assertFailureIsIsolatedAndBootstrapCanRetry();
  console.log("Personal best bootstrap tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
