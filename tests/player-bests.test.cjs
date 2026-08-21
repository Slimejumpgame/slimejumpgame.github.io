"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const GENERATED_ID = "11111111-2222-4333-8444-555555555555";
const EXISTING_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    snapshot: () => Object.fromEntries(values)
  };
}

function response({ok = true, status = 200, json = [], text = "", headers = {}} = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text,
    headers: {get: name => normalizedHeaders.get(String(name).toLowerCase()) ?? null}
  };
}

function loadApi({
  storage = {},
  rankResponse = [{best_score: null, rank: null}],
  rankNeverSettles = false,
  submitFails = false,
  submitNeverSettles = false,
  rpcTimeoutMs = null,
  randomUUID,
  cryptoImplementation
} = {}) {
  const localStorage = createStorage(storage);
  const rankCalls = [];
  const submissions = [];
  const submissionOptions = [];
  const dispatchedEvents = [];
  let randomUuidCalls = 0;
  const window = {
    dispatchEvent(event) {
      dispatchedEvents.push(event.type);
    },
    SlimeJumpHighscores: {
      isConfigured: () => true,
      async submitScore(payload, options) {
        submissions.push(plain(payload));
        submissionOptions.push(options);
        if (submitNeverSettles) return new Promise(() => {});
        if (submitFails) throw new Error("offline");
        return {bestScore: payload.score, improved: true};
      }
    }
  };
  const context = vm.createContext({
    window,
    localStorage,
    fetch: async (url, options) => {
      rankCalls.push({url, options});
      if (rankNeverSettles) {
        return new Promise((_, reject) => {
          const rejectAbort = () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          if (options.signal.aborted) rejectAbort();
          else options.signal.addEventListener("abort", rejectAbort, {once: true});
        });
      }
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.endsWith("/rest/v1/slime_jump_highscores")) {
        const row = rankResponse[0] ?? null;
        if (parsedUrl.searchParams.get("player_id")?.startsWith("eq.")) {
          const score = row?.best_score ?? row?.bestScore;
          return response({json: score == null ? [] : [{score}]});
        }
        const higherScoreCount = Math.max(0, Number(row?.rank) - 1 || 0);
        return response({
          json: higherScoreCount > 0 ? [{player_id: EXISTING_ID}] : [],
          headers: {"content-range": `0-0/${higherScoreCount}`}
        });
      }
      return response({json: rankResponse});
    },
    crypto: cryptoImplementation ?? {
      randomUUID: () => {
        randomUuidCalls++;
        return randomUUID?.() ?? GENERATED_ID;
      }
    },
    Uint8Array,
    Math,
    URL,
    URLSearchParams,
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    ...(rpcTimeoutMs === null
      ? {}
      : {AbortController, setTimeout, clearTimeout}),
    console: {warn() {}}
  });

  const source = rpcTimeoutMs === null
    ? read("js/slime-jump-player-bests.js")
    : read("js/slime-jump-player-bests.js").replace(
      "const RPC_TIMEOUT_MS = 5000;",
      `const RPC_TIMEOUT_MS = ${rpcTimeoutMs};`
    );
  vm.runInContext(source, context, {
    filename: "js/slime-jump-player-bests.js"
  });

  return {
    api: window.SlimeJumpPlayerBests,
    localStorage,
    rankCalls,
    submissions,
    submissionOptions,
    dispatchedEvents,
    getRandomUuidCalls: () => randomUuidCalls
  };
}

function globalPayload(score, overrides = {}) {
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
    },
    ...overrides
  };
}

function assertInstallationIdLifecycle() {
  const fresh = loadApi();
  assert.equal(fresh.api.getOrCreateInstallationId(), GENERATED_ID);
  assert.equal(fresh.localStorage.snapshot().slimejumperInstallationId, GENERATED_ID);
  assert.equal(fresh.api.getOrCreateInstallationId(), GENERATED_ID);
  assert.equal(fresh.getRandomUuidCalls(), 1);

  const existing = loadApi({storage: {slimejumperInstallationId: EXISTING_ID}});
  assert.equal(existing.api.getOrCreateInstallationId(), EXISTING_ID);
  assert.equal(existing.getRandomUuidCalls(), 0);

  const fallback = loadApi({
    cryptoImplementation: {getRandomValues: bytes => bytes.fill(0)}
  });
  assert.equal(
    fallback.api.getOrCreateInstallationId(),
    "00000000-0000-4000-8000-000000000000"
  );
}

async function assertHistoricalLifetimeBestIsNeverBootstrapped() {
  const fixture = loadApi({storage: {slimejumperBest: "85000"}});
  assert.equal(await fixture.api.syncLocalGlobalBest(), null);
  assert.equal(fixture.submissions.length, 0);
  assert.equal(fixture.localStorage.snapshot().slimejumperBest, "85000");
}

async function assertPostResetBestAndPayloadAreRetried() {
  const fixture = loadApi();
  assert.deepEqual(
    plain(await fixture.api.recordGlobalBestCandidate(globalPayload(85000))),
    {bestScore: 85000, improved: true}
  );
  const stored = fixture.localStorage.snapshot();
  assert.equal(stored.slimejumperGlobalRankBestV1, "85000");
  assert.equal(JSON.parse(stored.slimejumperGlobalRankBestPayloadV1).score, 85000);
  assert.equal(fixture.submissions[0].playerId, GENERATED_ID);
  assert.deepEqual(fixture.dispatchedEvents, ["slimeglobalbestsubmitsettled"]);

  await fixture.api.recordGlobalBestCandidate(globalPayload(70000, {name: "LOW"}));
  assert.equal(fixture.localStorage.snapshot().slimejumperGlobalRankBestV1, "85000");
  assert.equal(fixture.submissions.at(-1).score, 85000);
}

async function assertRankNormalizationAndErrorHandling() {
  const ranked = loadApi({rankResponse: [{best_score: "85000", rank: "47"}]});
  assert.deepEqual(
    plain(await ranked.api.getPersonalGlobalRank()),
    {bestScore: 85000, rank: 47}
  );

  const missing = loadApi();
  assert.deepEqual(
    plain(await missing.api.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );

  const offline = loadApi({submitFails: true});
  assert.equal(await offline.api.recordGlobalBestCandidate(globalPayload(90000)), null);
  assert.equal(offline.localStorage.snapshot().slimejumperGlobalRankBestV1, "90000");
}

async function assertHangingSubmitDoesNotBlockRankRead() {
  const fixture = loadApi({
    rankResponse: [{best_score: 25628, rank: 1}],
    submitNeverSettles: true
  });
  void fixture.api.recordGlobalBestCandidate(globalPayload(25628));

  assert.deepEqual(
    plain(await fixture.api.getPersonalGlobalRank()),
    {bestScore: 25628, rank: 1}
  );
  assert.equal(fixture.rankCalls.length, 2);
  assert.equal(fixture.api.getLastPersonalRankReadStatus().source, "postgrest");
}

async function assertHangingRequestsReachTheirTimeout() {
  const hangingSubmit = loadApi({
    submitNeverSettles: true,
    rpcTimeoutMs: 5
  });
  assert.equal(
    await hangingSubmit.api.recordGlobalBestCandidate(globalPayload(25628)),
    null
  );
  assert.equal(hangingSubmit.submissionOptions[0].signal.aborted, true);

  const hangingRank = loadApi({
    rankNeverSettles: true,
    rpcTimeoutMs: 5
  });
  assert.deepEqual(
    plain(await hangingRank.api.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );
  assert.equal(hangingRank.rankCalls[0].options.signal.aborted, true);
}

function assertFreshRankingConfiguration() {
  const source = read("js/slime-jump-player-bests.js");
  assert.match(source, /slimejumperGlobalRankBestV1/);
  assert.match(source, /slimejumperGlobalRankBestPayloadV1/);
  assert.match(source, /const RPC_TIMEOUT_MS = 5000/);
  assert.match(source, /AbortController/);
  assert.match(source, /signal: timeout\.signal/);
  assert.doesNotMatch(source, /["']slimejumperBest["']/);
  assert.doesNotMatch(source, /submit_slime_jump_personal_best/);

  const index = read("index.html");
  assert.match(index, /<script src="\.\/js\/slime-jump-highscores\.js"><\/script>[\s\S]*?<script src="\.\/js\/slime-jump-player-bests\.js"><\/script>/);
}

(async () => {
  assertInstallationIdLifecycle();
  await assertHistoricalLifetimeBestIsNeverBootstrapped();
  await assertPostResetBestAndPayloadAreRetried();
  await assertRankNormalizationAndErrorHandling();
  await assertHangingSubmitDoesNotBlockRankRead();
  await assertHangingRequestsReachTheirTimeout();
  assertFreshRankingConfiguration();
  console.log("Player bests tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
