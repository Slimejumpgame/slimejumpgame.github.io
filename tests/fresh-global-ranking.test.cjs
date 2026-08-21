"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function response({ok = true, status = 200, json = [], text = ""} = {}) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text
  };
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    snapshot: () => Object.fromEntries(values)
  };
}

function createServer() {
  const rows = new Map();
  let timestamp = 0;

  function sortedRows() {
    return [...rows.values()].sort((left, right) =>
      right.score - left.score ||
      right.level - left.level ||
      left.created_at.localeCompare(right.created_at)
    );
  }

  async function fetchImplementation(url, options) {
    const parsedUrl = new URL(url);
    const payload = options.body ? JSON.parse(options.body) : null;

    if (parsedUrl.pathname.endsWith("/rpc/submit_slime_jump_global_best")) {
      const previous = rows.get(payload.p_player_id);
      const improved = !previous || payload.p_score > previous.score;
      if (improved) {
        timestamp++;
        rows.set(payload.p_player_id, {
          player_id: payload.p_player_id,
          name: payload.p_name,
          score: payload.p_score,
          level: payload.p_level,
          game_version: payload.p_game_version,
          slime_color: payload.p_slime_color,
          slime_cosmetic: payload.p_slime_cosmetic,
          slime_beard: payload.p_slime_beard,
          slime_achievements: payload.p_slime_achievements,
          calling_card_snapshot: payload.p_calling_card_snapshot,
          created_at: String(timestamp).padStart(6, "0")
        });
      }
      return response({
        json: [{best_score: rows.get(payload.p_player_id).score, improved}]
      });
    }

    if (parsedUrl.pathname.endsWith("/rpc/get_slime_jump_personal_rank")) {
      const row = rows.get(payload.p_player_id);
      if (!row) return response({json: [{best_score: null, rank: null}]});
      const rank = [...rows.values()].filter(entry => entry.score > row.score).length + 1;
      return response({json: [{best_score: row.score, rank}]});
    }

    if (
      options.method === "GET" &&
      parsedUrl.pathname.endsWith("/rest/v1/slime_jump_highscores")
    ) {
      const limit = Number(parsedUrl.searchParams.get("limit")) || 10;
      return response({json: sortedRows().slice(0, limit)});
    }

    throw new Error(`unexpected request: ${options.method} ${url}`);
  }

  return {rows, sortedRows, fetchImplementation};
}

function playerId(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function nickname(index) {
  return `A${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + index % 26)}`;
}

function scorePayload(index, score, overrides = {}) {
  const slimeAchievements = [`badge-${index}`];
  return {
    name: nickname(index),
    score,
    level: Math.max(1, Math.floor(score / 1000)),
    slimeColor: "green",
    slimeCosmetic: "none",
    slimeBeard: "none",
    slimeAchievements,
    playerLevel: index + 1,
    prestigeLevel: 0,
    prestigeFrame: "none",
    prestigeTitle: "none",
    prestigeAura: "none",
    prestigeTrail: "none",
    callingCardSnapshot: {
      playerLevel: index + 1,
      prestigeLevel: 0,
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements
    },
    ...overrides
  };
}

function createClient(server, index, {storage, network} = {}) {
  const localStorage = storage ?? createStorage({
    slimejumperInstallationId: playerId(index)
  });
  const networkState = network ?? {offline: false};
  const window = {
    SlimeAchievements: {registry: []},
    SlimePrestige: {
      normalizeIdentitySnapshot: value => ({
        ...value,
        prestigeEmblemId: value.prestigeEmblemId ?? "none"
      })
    }
  };
  const context = vm.createContext({
    window,
    localStorage,
    fetch: async (url, options) => {
      if (networkState.offline) throw new Error("offline");
      return server.fetchImplementation(url, options);
    },
    crypto: {randomUUID: () => playerId(index)},
    Uint8Array,
    Math,
    URLSearchParams,
    normalizeSlimeColor: value => value,
    normalizeSlimeCosmetic: value => value,
    normalizeSlimeBeard: value => value,
    console: {info() {}, warn() {}, error() {}}
  });

  vm.runInContext(read("js/slime-jump-highscores.js"), context, {
    filename: "js/slime-jump-highscores.js"
  });
  vm.runInContext(read("js/slime-jump-player-bests.js"), context, {
    filename: "js/slime-jump-player-bests.js"
  });

  return {
    online: window.SlimeJumpHighscores,
    ranking: window.SlimeJumpPlayerBests,
    localStorage,
    network: networkState
  };
}

async function assertOnePlayerKeepsOneBestRow() {
  const server = createServer();
  const client = createClient(server, 1);
  await client.ranking.recordGlobalBestCandidate(scorePayload(1, 1000));
  await client.ranking.recordGlobalBestCandidate(scorePayload(1, 2000));
  await client.ranking.recordGlobalBestCandidate(scorePayload(1, 3000));

  assert.equal(server.rows.size, 1);
  assert.equal(server.rows.get(playerId(1)).score, 3000);
  assert.equal(client.localStorage.snapshot().slimejumperGlobalRankBestV1, "3000");
}

async function assertCanonicalRanksAndVisibleTopTen() {
  const server = createServer();
  const clients = [];
  for (let index = 1; index <= 15; index++) {
    const client = createClient(server, index);
    clients.push(client);
    await client.ranking.recordGlobalBestCandidate(
      scorePayload(index, 16000 - index * 1000)
    );
  }

  assert.equal(server.rows.size, 15);
  assert.equal((await clients[0].online.getTopScores(10)).length, 10);
  assert.deepEqual(
    plain(await clients[10].ranking.getPersonalGlobalRank()),
    {bestScore: 5000, rank: 11}
  );
  assert.deepEqual(
    plain(await clients[14].ranking.getPersonalGlobalRank()),
    {bestScore: 1000, rank: 15}
  );

  await clients[14].ranking.recordGlobalBestCandidate(scorePayload(15, 9500));
  assert.equal(server.rows.size, 15);
  assert.deepEqual(
    plain(await clients[14].ranking.getPersonalGlobalRank()),
    {bestScore: 9500, rank: 7}
  );
  const visible = await clients[14].online.getTopScores(10);
  assert.equal(visible[6].score, 9500);
  assert.equal(visible[6].name, nickname(15));
}

async function assertLowerRunCannotOverwriteBestRunData() {
  const server = createServer();
  const client = createClient(server, 3);
  await client.ranking.recordGlobalBestCandidate(scorePayload(3, 10000, {
    name: "BEST",
    level: 10
  }));
  const bestRow = plain(server.rows.get(playerId(3)));

  await client.ranking.recordGlobalBestCandidate(scorePayload(3, 5000, {
    name: "LOW",
    level: 99,
    slimeColor: "purple"
  }));
  assert.deepEqual(plain(server.rows.get(playerId(3))), bestRow);
  assert.deepEqual(
    plain(await client.ranking.getPersonalGlobalRank()),
    {bestScore: 10000, rank: 1}
  );
}

async function assertFreshStartRanksAndTies() {
  const server = createServer();
  const first = createClient(server, 1);
  const second = createClient(server, 2);
  const third = createClient(server, 3);

  await first.ranking.recordGlobalBestCandidate(scorePayload(1, 6000));
  assert.equal((await first.ranking.getPersonalGlobalRank()).rank, 1);
  await second.ranking.recordGlobalBestCandidate(scorePayload(2, 5000));
  assert.equal((await second.ranking.getPersonalGlobalRank()).rank, 2);
  await third.ranking.recordGlobalBestCandidate(scorePayload(3, 5000));
  assert.equal((await second.ranking.getPersonalGlobalRank()).rank, 2);
  assert.equal((await third.ranking.getPersonalGlobalRank()).rank, 2);
}

async function assertHistoricalBestIsIgnoredAndRetryWorks() {
  const server = createServer();
  const storage = createStorage({
    slimejumperInstallationId: playerId(8),
    slimejumperBest: "500000"
  });
  const network = {offline: true};
  const offlineClient = createClient(server, 8, {storage, network});

  assert.equal(await offlineClient.ranking.syncLocalGlobalBest(), null);
  assert.equal(server.rows.size, 0);
  assert.equal(storage.snapshot().slimejumperBest, "500000");

  await offlineClient.ranking.recordGlobalBestCandidate(scorePayload(8, 6000));
  assert.equal(storage.snapshot().slimejumperGlobalRankBestV1, "6000");
  assert.equal(server.rows.size, 0);

  network.offline = false;
  const reloadedClient = createClient(server, 8, {storage, network});
  await reloadedClient.ranking.syncLocalGlobalBest();
  assert.equal(server.rows.size, 1);
  assert.equal(server.rows.get(playerId(8)).score, 6000);
  assert.equal(storage.snapshot().slimejumperBest, "500000");
}

function assertSqlSeparationAndSafety() {
  const migration = read("supabase/slime-jump-global-ranking-v2.sql");
  const migrationSql = migration.replace(/^--.*$/gm, "");
  assert.match(migration, /add column if not exists player_id uuid/i);
  assert.match(migration, /create unique index if not exists slime_jump_highscores_player_id_uidx/i);
  assert.match(migration, /create or replace function public\.submit_slime_jump_global_best/i);
  assert.match(migration, /on conflict \(player_id\) do update[\s\S]*?where excluded\.score > leaderboard\.score/i);
  assert.match(migration, /calling_card_snapshot = excluded\.calling_card_snapshot/i);
  assert.match(migration, /from public\.slime_jump_highscores as leaderboard[\s\S]*?leaderboard\.score > stored_best_score/i);
  assert.match(migration, /revoke insert, update, delete on table public\.slime_jump_highscores/i);
  assert.doesNotMatch(migrationSql, /\b(?:delete\s+from|truncate|drop\s+table)\b/i);

  const reset = read("supabase/slime-jump-global-ranking-reset.sql");
  const resetSql = reset.replace(/^--.*$/gm, "");
  assert.match(reset, /slime_jump_highscores_backup_20260821/i);
  assert.match(reset, /slime_jump_player_bests_backup_20260821/i);
  assert.match(reset, /truncate table\s+public\.slime_jump_highscores,\s+public\.slime_jump_player_bests/i);
  assert.match(reset, /alter column player_id set not null/i);
  assert.doesNotMatch(
    resetSql,
    /(?:truncate|delete\s+from|update|drop\s+table)[\s\S]{0,80}(?:backup_20260821)/i
  );
}

function assertClientUsesOnlyPostResetBestForBootstrap() {
  const playerBestSource = read("js/slime-jump-player-bests.js");
  assert.match(playerBestSource, /slimejumperGlobalRankBestV1/);
  assert.match(playerBestSource, /slimejumperGlobalRankBestPayloadV1/);
  assert.doesNotMatch(playerBestSource, /["']slimejumperBest["']/);

  const uiSource = read("js/ui.js");
  assert.match(uiSource, /recordGlobalBestCandidate\(submittedScore\)/);
  assert.match(uiSource, /syncLocalGlobalBest\(\)/);
  assert.doesNotMatch(uiSource, /qualifiesForOnlineTopTen/);

  const onlineSource = read("js/slime-jump-highscores.js");
  assert.match(onlineSource, /\/rest\/v1\/rpc\/\$\{SUBMIT_GLOBAL_BEST_RPC\}/);
  assert.match(onlineSource, /limit: String\(safeLimit\)/);
  assert.match(onlineSource, /order: "score\.desc,level\.desc,created_at\.asc"/);
}

(async () => {
  await assertOnePlayerKeepsOneBestRow();
  await assertCanonicalRanksAndVisibleTopTen();
  await assertLowerRunCannotOverwriteBestRunData();
  await assertFreshStartRanksAndTies();
  await assertHistoricalBestIsIgnoredAndRetryWorks();
  assertSqlSeparationAndSafety();
  assertClientUsesOnlyPostResetBestForBootstrap();
  console.log("Fresh global ranking tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
