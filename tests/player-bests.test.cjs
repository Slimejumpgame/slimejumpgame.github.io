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
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

function response({ok = true, status = 200, json = [], text = ""} = {}) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text
  };
}

function loadApi({storage = {}, fetchImplementation, randomUUID, cryptoImplementation} = {}) {
  const localStorage = createStorage(storage);
  const calls = [];
  let randomUuidCalls = 0;
  const window = {};
  const context = vm.createContext({
    window,
    localStorage,
    fetch: async (url, options) => {
      calls.push({url, options});
      return fetchImplementation
        ? fetchImplementation(url, options)
        : response();
    },
    crypto: cryptoImplementation ?? {
      randomUUID: () => {
        randomUuidCalls++;
        return randomUUID?.() ?? GENERATED_ID;
      }
    },
    Uint8Array,
    Math,
    console: {warn() {}}
  });

  vm.runInContext(read("js/slime-jump-player-bests.js"), context, {
    filename: "js/slime-jump-player-bests.js"
  });

  return {
    api: window.SlimeJumpPlayerBests,
    localStorage,
    calls,
    getRandomUuidCalls: () => randomUuidCalls
  };
}

function assertInstallationIdLifecycle() {
  const fresh = loadApi();
  assert.equal(fresh.api.getOrCreateInstallationId(), GENERATED_ID);
  assert.equal(fresh.localStorage.snapshot().slimejumperInstallationId, GENERATED_ID);
  assert.equal(fresh.api.getOrCreateInstallationId(), GENERATED_ID);
  assert.equal(fresh.getRandomUuidCalls(), 1);

  const existing = loadApi({
    storage: {slimejumperInstallationId: EXISTING_ID}
  });
  assert.equal(existing.api.getOrCreateInstallationId(), EXISTING_ID);
  assert.equal(existing.getRandomUuidCalls(), 0);

  const fallback = loadApi({
    cryptoImplementation: {
      getRandomValues: bytes => bytes.fill(0)
    }
  });
  const fallbackId = fallback.api.getOrCreateInstallationId();
  assert.equal(fallbackId, "00000000-0000-4000-8000-000000000000");
  assert.equal(fallback.localStorage.snapshot().slimejumperInstallationId, fallbackId);
}

async function assertInvalidLocalScoresAreSkipped() {
  for (const invalidValue of [null, "", "NaN", "-1", "0"]) {
    const storage = invalidValue === null
      ? {}
      : {slimejumperBest: invalidValue};
    const fixture = loadApi({storage});
    assert.equal(await fixture.api.syncLocalPersonalBest(), null);
    assert.equal(fixture.calls.length, 0, `unexpected submit for ${invalidValue}`);
  }
}

async function assertValidLocalScoreIsSubmitted() {
  const fixture = loadApi({
    storage: {slimejumperBest: "85000"},
    fetchImplementation: async () => response({
      json: [{best_score: 85000, improved: true}]
    })
  });

  assert.deepEqual(
    plain(await fixture.api.syncLocalPersonalBest()),
    {bestScore: 85000, improved: true}
  );
  assert.equal(fixture.calls.length, 1);
  assert.match(
    fixture.calls[0].url,
    /\/rest\/v1\/rpc\/submit_slime_jump_personal_best$/
  );
  assert.deepEqual(
    JSON.parse(fixture.calls[0].options.body),
    {p_player_id: GENERATED_ID, p_best_score: 85000}
  );
}

async function assertRankNormalizationAndErrorHandling() {
  const ranked = loadApi({
    fetchImplementation: async () => response({
      json: [{best_score: "85000", rank: "47"}]
    })
  });
  assert.deepEqual(
    plain(await ranked.api.getPersonalGlobalRank()),
    {bestScore: 85000, rank: 47}
  );

  const missing = loadApi({
    fetchImplementation: async () => response({
      json: [{best_score: null, rank: null}]
    })
  });
  assert.deepEqual(
    plain(await missing.api.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );

  const offline = loadApi({
    fetchImplementation: async () => {
      throw new Error("offline");
    }
  });
  assert.equal(await offline.api.submitPersonalBest(90000), null);
  assert.deepEqual(
    plain(await offline.api.getPersonalGlobalRank()),
    {bestScore: null, rank: null}
  );
}

function assertSqlSafetyAndIsolation() {
  const sql = read("supabase/slime-jump-player-bests.sql");
  const executableSql = sql.replace(/^--.*$/gm, "");
  assert.match(sql, /create table if not exists public\.slime_jump_player_bests/i);
  assert.match(sql, /on conflict \(player_id\) do update[\s\S]*?where excluded\.best_score > player_best\.best_score/i);
  assert.match(sql, /where player_best\.best_score > stored_best_score/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /set search_path = ''/i);
  assert.doesNotMatch(executableSql, /\bdelete\b|\btruncate\b/i);
  assert.doesNotMatch(executableSql, /\bslime_jump_highscores\b/i);

  const index = read("index.html");
  assert.match(index, /<script src="\.\/js\/slime-jump-player-bests\.js"><\/script>/);
  assert.doesNotMatch(index, /syncLocalPersonalBest\s*\(/);
}

(async () => {
  assertInstallationIdLifecycle();
  await assertInvalidLocalScoresAreSkipped();
  await assertValidLocalScoreIsSubmitted();
  await assertRankNormalizationAndErrorHandling();
  assertSqlSafetyAndIsolation();
  console.log("Player bests tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
