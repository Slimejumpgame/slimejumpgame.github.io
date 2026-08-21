"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const PLAYER_ID = "11111111-2222-4333-8444-555555555555";

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

function playerId(index) {
  return index === 3
    ? PLAYER_ID
    : `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function createFixture({
  native = false,
  timeoutMs = 5000,
  failInstallationIdReadAfterFirst = false
} = {}) {
  const rows = new Map([
    [playerId(1), {player_id: playerId(1), name: "AAA", score: 30000, level: 9}],
    [playerId(2), {player_id: playerId(2), name: "BBB", score: 20000, level: 8}],
    [PLAYER_ID, {player_id: PLAYER_ID, name: "CCC", score: 10000, level: 7}]
  ]);
  const storage = new Map([["slimejumperInstallationId", PLAYER_ID]]);
  const calls = [];
  const submittedPlayerIds = [];
  let failDirectRankReads = false;
  let failRpcRankReads = false;
  let hangRankReads = false;
  let installationIdReads = 0;

  const window = {
    Capacitor: {
      isNativePlatform: () => native,
      getPlatform: () => native ? "android" : "web"
    },
    dispatchEvent() {},
    SlimeAchievements: {registry: []},
    SlimePrestige: {
      normalizeIdentitySnapshot: value => ({
        ...value,
        prestigeEmblemId: value.prestigeEmblemId ?? "none"
      })
    }
  };

  async function fetchImplementation(url, options) {
    calls.push({url, options});
    const parsedUrl = new URL(url);
    const isRankRpc = parsedUrl.pathname.endsWith("/rpc/get_slime_jump_personal_rank");
    const isHighscoreTable = parsedUrl.pathname.endsWith("/rest/v1/slime_jump_highscores");
    const isRankTableRead = isHighscoreTable &&
      !String(parsedUrl.searchParams.get("select") || "").includes("name");

    if (hangRankReads && (isRankRpc || isRankTableRead)) {
      return new Promise((_, reject) => {
        const rejectAbort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (options.signal?.aborted) rejectAbort();
        else options.signal?.addEventListener("abort", rejectAbort, {once: true});
      });
    }
    if (
      (failDirectRankReads && isRankTableRead) ||
      (failRpcRankReads && isRankRpc)
    ) {
      return response({ok: false, status: 503, text: "rank unavailable"});
    }

    if (parsedUrl.pathname.endsWith("/rpc/submit_slime_jump_global_best")) {
      const payload = JSON.parse(options.body);
      submittedPlayerIds.push(payload.p_player_id);
      const previous = rows.get(payload.p_player_id);
      if (!previous || payload.p_score > previous.score) {
        rows.set(payload.p_player_id, {
          player_id: payload.p_player_id,
          name: payload.p_name,
          score: payload.p_score,
          level: payload.p_level
        });
      }
      return response({
        json: [{best_score: rows.get(payload.p_player_id).score, improved: true}]
      });
    }

    if (isRankRpc) {
      const payload = JSON.parse(options.body);
      const row = rows.get(payload.p_player_id);
      if (!row) return response({json: [{best_score: null, rank: null}]});
      const rank = [...rows.values()].filter(entry => entry.score > row.score).length + 1;
      return response({json: [{best_score: row.score, rank}]});
    }

    if (isHighscoreTable && options.method === "GET") {
      const selectedColumns = parsedUrl.searchParams.get("select") || "";
      if (selectedColumns.includes("name")) {
        const limit = Number(parsedUrl.searchParams.get("limit")) || 10;
        const sorted = [...rows.values()].sort((left, right) => right.score - left.score);
        return response({json: sorted.slice(0, limit).map(row => ({
          ...row,
          game_version: "2.68",
          created_at: "2026-08-21T00:00:00Z",
          slime_color: "green",
          slime_cosmetic: "none",
          slime_beard: "none",
          slime_achievements: [],
          calling_card_snapshot: null
        }))});
      }

      const playerIdFilter = parsedUrl.searchParams.get("player_id");
      if (playerIdFilter?.startsWith("eq.")) {
        const row = rows.get(playerIdFilter.slice(3));
        return response({json: row ? [{score: row.score}] : []});
      }

      const bestScore = Number(
        String(parsedUrl.searchParams.get("score") || "").replace(/^gt\./, "")
      );
      const count = [...rows.values()].filter(row => row.score > bestScore).length;
      return response({
        json: count > 0 ? [{player_id: [...rows.keys()][0]}] : [],
        headers: {"content-range": `0-0/${count}`}
      });
    }

    throw new Error(`unexpected request: ${options.method} ${url}`);
  }

  const context = vm.createContext({
    window,
    localStorage: {
      getItem: key => {
        if (key === "slimejumperInstallationId") {
          installationIdReads++;
          if (failInstallationIdReadAfterFirst && installationIdReads > 1) {
            throw new Error("native storage read failed");
          }
        }
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => storage.set(key, String(value))
    },
    fetch: fetchImplementation,
    crypto: {randomUUID: () => PLAYER_ID},
    Uint8Array,
    Math,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    normalizeSlimeColor: value => value,
    normalizeSlimeCosmetic: value => value,
    normalizeSlimeBeard: value => value,
    console: {info() {}, warn() {}, error() {}}
  });
  vm.runInContext(read("js/slime-jump-highscores.js"), context, {
    filename: "js/slime-jump-highscores.js"
  });
  const playerBestsSource = read("js/slime-jump-player-bests.js").replace(
    "const RPC_TIMEOUT_MS = 5000;",
    `const RPC_TIMEOUT_MS = ${timeoutMs};`
  );
  vm.runInContext(playerBestsSource, context, {
    filename: "js/slime-jump-player-bests.js"
  });

  return {
    online: window.SlimeJumpHighscores,
    ranking: window.SlimeJumpPlayerBests,
    rows,
    calls,
    submittedPlayerIds,
    setDirectRankFailure(value) {
      failDirectRankReads = value;
    },
    setRpcRankFailure(value) {
      failRpcRankReads = value;
    },
    setRankHang(value) {
      hangRankReads = value;
    }
  };
}

function globalPayload(score) {
  return {
    name: "CCC",
    score,
    level: 7,
    slimeColor: "green",
    slimeCosmetic: "none",
    slimeBeard: "none",
    slimeAchievements: [],
    callingCardSnapshot: {
      playerLevel: 3,
      prestigeLevel: 0,
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    }
  };
}

async function assertWebAndNativeUseTheSameDirectRankRead() {
  for (const native of [false, true]) {
    const fixture = createFixture({native});
    assert.deepEqual(
      plain(await fixture.ranking.getPersonalGlobalRank()),
      {bestScore: 10000, rank: 3}
    );
    assert.deepEqual(
      plain(fixture.ranking.getLastPersonalRankReadStatus()),
      {status: "ok", source: "postgrest"}
    );
    assert.equal(
      fixture.calls.some(call => call.url.includes("/rpc/get_slime_jump_personal_rank")),
      false
    );
    const countCall = fixture.calls.find(call => call.options.headers?.Prefer === "count=exact");
    assert.equal(countCall.options.headers.Range, "0-0");
    assert.equal(new URL(countCall.url).searchParams.get("limit"), "1");
  }
}

async function assertWorkingTopTenAndBrokenRpcStillProduceRank() {
  const fixture = createFixture({native: true});
  fixture.setRpcRankFailure(true);
  assert.equal((await fixture.online.getTopScores(10)).length, 3);
  assert.deepEqual(
    plain(await fixture.ranking.getPersonalGlobalRank()),
    {bestScore: 10000, rank: 3}
  );
  assert.equal(fixture.ranking.getLastPersonalRankReadStatus().source, "postgrest");
}

async function assertSubmitAndRankUseTheSamePlayerId() {
  const fixture = createFixture({
    native: true,
    failInstallationIdReadAfterFirst: true
  });
  await fixture.ranking.recordGlobalBestCandidate(globalPayload(11000));
  await fixture.ranking.getPersonalGlobalRank();

  const ownRowCall = fixture.calls.find(call => {
    const url = new URL(call.url);
    return url.searchParams.get("player_id")?.startsWith("eq.");
  });
  assert.equal(fixture.submittedPlayerIds[0], PLAYER_ID);
  assert.equal(
    new URL(ownRowCall.url).searchParams.get("player_id"),
    `eq.${PLAYER_ID}`
  );
}

async function assertDynamicRankShift() {
  const fixture = createFixture({native: true});
  assert.equal((await fixture.ranking.getPersonalGlobalRank()).rank, 3);
  fixture.rows.set(playerId(4), {
    player_id: playerId(4),
    name: "DDD",
    score: 25000,
    level: 8
  });
  assert.equal((await fixture.ranking.getPersonalGlobalRank()).rank, 4);
}

async function assertMissingPlayerHasAnExplicitStatus() {
  const fixture = createFixture({native: true});
  fixture.rows.delete(PLAYER_ID);
  assert.deepEqual(
    plain(await fixture.ranking.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );
  assert.deepEqual(
    plain(fixture.ranking.getLastPersonalRankReadStatus()),
    {
      status: "not-found",
      source: null,
      primaryStatus: "not-found",
      fallbackStatus: "not-found"
    }
  );
}

async function assertRpcFallbackAndDiagnostics() {
  const fixture = createFixture({native: true});
  fixture.setDirectRankFailure(true);
  assert.deepEqual(
    plain(await fixture.ranking.getPersonalGlobalRank()),
    {bestScore: 10000, rank: 3}
  );
  assert.deepEqual(
    plain(fixture.ranking.getLastPersonalRankReadStatus()),
    {status: "ok", source: "rpc-fallback", primaryStatus: "http-error"}
  );

  fixture.setRpcRankFailure(true);
  assert.deepEqual(
    plain(await fixture.ranking.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );
  const failureStatus = fixture.ranking.getLastPersonalRankReadStatus();
  assert.equal(failureStatus.status, "http-error");
  assert.equal(failureStatus.primaryStatus, "http-error");
  assert.equal(failureStatus.fallbackStatus, "http-error");
  assert.ok(fixture.calls.some(call => call.url.includes("/rpc/get_slime_jump_personal_rank")));

  fixture.setDirectRankFailure(false);
  fixture.setRpcRankFailure(false);
  assert.equal((await fixture.ranking.getPersonalGlobalRank()).rank, 3);
  assert.equal(fixture.ranking.getLastPersonalRankReadStatus().source, "postgrest");
}

async function assertTimeoutDoesNotHang() {
  const fixture = createFixture({native: true, timeoutMs: 5});
  fixture.setRankHang(true);
  assert.deepEqual(
    plain(await fixture.ranking.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );
  assert.equal(fixture.ranking.getLastPersonalRankReadStatus().status, "timeout");
}

async function assertNativeVisibilityTriggersAnotherRead() {
  const uiSource = read("js/ui.js");
  const start = uiSource.indexOf("  function renderPersonalGlobalRank(");
  const end = uiSource.indexOf("  function populatePrestigeRewardSelect(", start);
  const rankFunctions = uiSource.slice(start, end);
  let visibilityListener = null;
  let rankCalls = 0;
  const ui = {
    personalGlobalRankValue: {textContent: "—"},
    menu: {classList: {contains: () => false}},
    mainMenuScreen: {classList: {contains: () => false}}
  };
  const window = {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => "android"
    },
    addEventListener() {},
    SlimeJumpPlayerBests: {
      syncLocalGlobalBest: () => Promise.resolve(null),
      async getPersonalGlobalRank() {
        rankCalls++;
        return {bestScore: 10000, rank: 3};
      }
    }
  };
  const document = {
    visibilityState: "visible",
    addEventListener(type, listener) {
      if (type === "visibilitychange") visibilityListener = listener;
    }
  };
  const context = vm.createContext({ui, window, document});
  vm.runInContext(`
    let globalBestBootstrapPromise = null;
    let personalGlobalRankRequestId = 0;
    ${rankFunctions}
  `, context);

  visibilityListener();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rankCalls, 1);
  assert.equal(ui.personalGlobalRankValue.textContent, "3");
}

(async () => {
  await assertWebAndNativeUseTheSameDirectRankRead();
  await assertWorkingTopTenAndBrokenRpcStillProduceRank();
  await assertSubmitAndRankUseTheSamePlayerId();
  await assertDynamicRankShift();
  await assertMissingPlayerHasAnExplicitStatus();
  await assertRpcFallbackAndDiagnostics();
  await assertTimeoutDoesNotHang();
  await assertNativeVisibilityTriggersAnotherRead();
  console.log("Android/web rank differential tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
