"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const INSTALLATION_ID = "11111111-2222-4333-8444-555555555555";
const RETRY_BADGES = Object.freeze([
  "hp_gen",
  "golden_ticket",
  "first_ascent",
  "secret_star_sniper",
  "ein_richtiger_kevin"
]);
const RETRY_BADGE_REGISTRY = Object.freeze(
  [...RETRY_BADGES, "secret_bare_minimum"].map(id => Object.freeze({id, icon: id}))
);

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  assert.ok(end > start, `missing marker: ${endMarker}`);
  return source.slice(start, end);
}

function response(json, headers = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
  return {
    ok: true,
    status: 200,
    json: async () => json,
    text: async () => "",
    headers: {get: name => normalizedHeaders.get(String(name).toLowerCase()) ?? null}
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
    slimeAchievements: RETRY_BADGES.slice(),
    callingCardSnapshot: {
      playerLevel: 9,
      prestigeLevel: 0,
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: RETRY_BADGES.slice()
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
  const liveBadges = RETRY_BADGES.slice();
  const ui = {personalGlobalRankValue: {textContent: "initial"}};
  const window = {
    SlimeAchievements: {
      registry: RETRY_BADGE_REGISTRY,
      getEffectiveBadgeIds: () => liveBadges.slice()
    },
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
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.endsWith("/rest/v1/slime_jump_highscores")) {
        if (parsedUrl.searchParams.get("player_id")?.startsWith("eq.")) {
          return response(globalBest === null ? [] : [{score: globalBest}]);
        }
        return response(
          [{player_id: INSTALLATION_ID}],
          {"content-range": "0-0/36"}
        );
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
    URL,
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
    storage,
    unlockBadge: id => liveBadges.unshift(id)
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

  assert.equal(fixture.calls.length, 3);
  assert.match(fixture.calls[0].url, /\/rest\/v1\/slime_jump_highscores\?/);
  assert.match(fixture.calls[1].url, /\/submit_slime_jump_global_best$/);
  const submittedPayload = JSON.parse(fixture.calls[1].options.body);
  assert.equal(submittedPayload.p_score, 6000);
  assert.deepEqual(
    submittedPayload.p_calling_card_snapshot.slimeAchievements,
    RETRY_BADGES
  );
  assert.match(fixture.calls[2].url, /\/rest\/v1\/slime_jump_highscores\?/);
  assert.equal(fixture.rankValue.textContent, "37");
}

async function assertFailureIsIsolatedAndBootstrapCanRetry() {
  const offline = createBootstrapFixture({globalBest: 6000, networkFails: true});
  await assert.doesNotReject(() => offline.update());
  await Promise.resolve();
  await Promise.resolve();
  offline.unlockBadge("secret_bare_minimum");
  await assert.doesNotReject(() => offline.update());
  assert.equal(offline.rankValue.textContent, "—");

  const offlineSubmits = offline.calls
    .filter(call => /submit_slime_jump_global_best$/.test(call.url));
  assert.equal(offlineSubmits.length, 2);
  offlineSubmits.forEach(call => {
    const payload = JSON.parse(call.options.body);
    assert.deepEqual(
      payload.p_calling_card_snapshot.slimeAchievements,
      RETRY_BADGES,
      "Retries müssen den gespeicherten historischen Snapshot unverändert senden"
    );
  });

  const online = createBootstrapFixture({globalBest: 6000});
  await online.update();
  await online.update();
  assert.equal(
    online.calls.filter(call => /submit_slime_jump_global_best$/.test(call.url)).length,
    1
  );
  assert.equal(
    online.calls.filter(call => /rest\/v1\/slime_jump_highscores\?/.test(call.url)).length,
    4
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
