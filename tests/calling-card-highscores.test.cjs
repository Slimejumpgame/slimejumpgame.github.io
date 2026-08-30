"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

function response({ok = true, status = 200, json = null, text = ""} = {}) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text
  };
}

const achievementRegistry = Object.freeze(
  [
    ...Array.from({length: 6}, (_value, index) => `badge-${index + 1}`),
    "century_slime",
    "biome_master",
    "achievement_hunter",
    "secret_star_sniper",
    "secret_second_chance"
  ].map((id, index) => Object.freeze({
    id,
    name: id.replaceAll("_", " ").toUpperCase(),
    icon: String((index % 9) + 1)
  }))
);

const historicalGoldAppearance = Object.freeze({
  slime: true,
  hatId: "top_hat",
  beardId: "full_beard"
});

function loadPrestigeApi() {
  const localStorage = createStorage({
    slimejumperPrestigeLevel: "10",
    slimejumperSelectedPrestigeFrame: "prestige-frame-p10",
    slimejumperSelectedPrestigeTitle: "prestige-title-p10",
    slimejumperSelectedPrestigeAura: "prestige-aura-p8",
    slimejumperSelectedPrestigeTrail: "prestige-trail-p9"
  });
  const selectedBadges = achievementRegistry.map(entry => entry.id);
  const playerProgress = {level: 42};
  const window = {
    SlimePlayerProgress: {getPlayerProgress: () => ({...playerProgress})},
    SlimeAchievements: {
      getEffectiveBadgeIds: () => selectedBadges.slice(),
      getSelectedBadgeIds: () => ["badge-6"]
    }
  };
  const context = vm.createContext({window, localStorage, console});
  vm.runInContext(read("js/slime-prestige.js"), context, {
    filename: "js/slime-prestige.js"
  });
  return {api: window.SlimePrestige, playerProgress, selectedBadges};
}

function assertHistoricalSnapshotIsolation(prestige) {
  const snapshot = prestige.api.capturePlayerIdentitySnapshot();
  assert.deepEqual(
    JSON.parse(JSON.stringify(snapshot)),
    {
      playerLevel: 42,
      prestigeLevel: 10,
      prestigeEmblemId: "prestige-final-crest",
      prestigeFrame: "prestige-frame-p10",
      prestigeTitle: "prestige-title-p10",
      prestigeAura: "prestige-aura-p8",
      prestigeTrail: "prestige-trail-p9",
      slimeAchievements: ["badge-1", "badge-2", "badge-3", "badge-4", "badge-5"]
    }
  );

  prestige.playerProgress.level = 99;
  prestige.selectedBadges.splice(0, prestige.selectedBadges.length, "badge-6");
  prestige.api.selectReward("frame", "prestige-frame-p1");
  prestige.api.selectReward("title", "prestige-title-p1");
  prestige.api.selectReward("aura", "prestige-aura-p3");
  prestige.api.selectReward("trail", "prestige-trail-p5");

  assert.equal(snapshot.playerLevel, 42);
  assert.equal(snapshot.prestigeFrame, "prestige-frame-p10");
  assert.equal(snapshot.prestigeTitle, "prestige-title-p10");
  assert.deepEqual(Array.from(snapshot.slimeAchievements), [
    "badge-1", "badge-2", "badge-3", "badge-4", "badge-5"
  ]);

  const emblemMarkup = [
    prestige.api.getEmblemMarkup(7),
    prestige.api.getEmblemMarkup(7),
    prestige.api.getEmblemMarkup(10)
  ].join("");
  const ids = [...emblemMarkup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, "Prestige emblem DOM IDs must be unique");
  return snapshot;
}

function assertGameOverGoldSnapshotCapture() {
  const source = read("js/game.js");
  const captureStart = source.indexOf(
    "  function captureHighScoreGoldAppearanceSnapshot()"
  );
  const captureEnd = source.indexOf("  function loseLife()", captureStart);
  assert.ok(captureStart >= 0 && captureEnd > captureStart);

  const liveAppearance = {
    slime: true,
    hatId: "top_hat",
    beardId: "full_beard"
  };
  const context = vm.createContext({
    window: {
      SlimeGold: {getEquippedAppearance: () => liveAppearance}
    }
  });
  vm.runInContext(
    source.slice(captureStart, captureEnd) +
      "\nglobalThis.captureGoldSnapshot = captureHighScoreGoldAppearanceSnapshot;",
    context,
    {filename: "js/game-gold-highscore-snapshot-test-slice.js"}
  );

  const snapshot = context.captureGoldSnapshot();
  liveAppearance.slime = false;
  liveAppearance.hatId = "cap";
  liveAppearance.beardId = "stubble";
  assert.deepEqual(
    JSON.parse(JSON.stringify(snapshot)),
    historicalGoldAppearance
  );
  assert.equal(Object.isFrozen(snapshot), true);
  assert.match(
    source,
    /pendingGameOverScore\s*=\s*\{[\s\S]*?identitySnapshot:\s*\{[\s\S]*?goldAppearance:\s*captureHighScoreGoldAppearanceSnapshot\(\)/
  );
}

function createOnlineApi(prestigeApi, fetchImplementation) {
  const window = {
    SlimePrestige: prestigeApi,
    SlimeAchievements: {registry: achievementRegistry}
  };
  const context = vm.createContext({
    window,
    fetch: fetchImplementation,
    URLSearchParams,
    console: {info() {}, error() {}, warn() {}},
    normalizeSlimeColor: value => typeof value === "string" ? value : "green",
    normalizeSlimeCosmetic: value =>
      ["none", "cap", "top_hat", "wizard_hat"].includes(value) ? value : "none",
    normalizeSlimeBeard: value =>
      ["none", "stubble", "full_beard", "braided_beard"].includes(value)
        ? value
        : "none"
  });
  vm.runInContext(read("js/slime-jump-highscores.js"), context, {
    filename: "js/slime-jump-highscores.js"
  });
  return window.SlimeJumpHighscores;
}

async function assertGlobalSnapshotRoundTrip(prestigeApi, snapshot) {
  const calls = [];
  const goldSnapshot = {
    ...JSON.parse(JSON.stringify(snapshot)),
    goldAppearance: {...historicalGoldAppearance}
  };
  const globalRows = [
    {
      name: "NEW",
      score: 9000,
      level: 12,
      game_version: "2.58",
      created_at: "2026-08-15T00:00:00Z",
      slime_color: "green",
      slime_cosmetic: "none",
      slime_beard: "none",
      slime_achievements: ["badge-1"],
      calling_card_snapshot: {...goldSnapshot, formatVersion: 1}
    },
    {
      name: "OLD",
      score: 8000,
      level: 11,
      game_version: "2.57",
      created_at: "2026-08-14T00:00:00Z",
      slime_color: "green",
      slime_cosmetic: "none",
      slime_beard: "none",
      slime_achievements: ["badge-2"]
    },
    {
      name: "VON",
      score: 7500,
      level: 10,
      game_version: "2.71",
      created_at: "2026-08-13T00:00:00Z",
      slime_color: "purple",
      slime_cosmetic: "cap",
      slime_beard: "stubble",
      slime_achievements: ["badge-3"],
      calling_card_snapshot: {
        ...JSON.parse(JSON.stringify(snapshot)),
        formatVersion: 1
      }
    }
  ];
  const api = createOnlineApi(prestigeApi, async (url, options) => {
    calls.push({url, options});
    return options.method === "GET"
      ? response({json: globalRows})
      : response({json: [{best_score: 9000, improved: true}]});
  });

  const rows = await api.getTopScores(10);
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get("order"), "score.desc,level.desc,created_at.asc");
  assert.match(query.get("select"), /calling_card_snapshot/);
  assert.equal(rows[0].playerLevel, 42);
  assert.equal(rows[0].prestigeLevel, 10);
  assert.equal(rows[0].prestigeTitle, "prestige-title-p10");
  assert.equal(rows[0].prestigeFrame, "prestige-frame-p10");
  assert.equal(rows[0].prestigeAura, "prestige-aura-p8");
  assert.equal(rows[0].prestigeTrail, "prestige-trail-p9");
  assert.equal(rows[0].slimeAchievements.length, 5);
  assert.deepEqual(
    JSON.parse(JSON.stringify(rows[0].goldAppearance)),
    historicalGoldAppearance
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(rows[0].callingCardSnapshot.goldAppearance)),
    historicalGoldAppearance
  );
  assert.equal(rows[0].hasIdentitySnapshot, true);
  assert.equal(rows[1].hasIdentitySnapshot, false);
  assert.deepEqual(Array.from(rows[1].slimeAchievements), ["badge-2"]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(rows[1].goldAppearance)),
    {slime: false, hatId: null, beardId: null}
  );
  assert.equal(rows[2].hasIdentitySnapshot, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(rows[2].goldAppearance)),
    {slime: false, hatId: null, beardId: null}
  );

  const requestSignal = {aborted: false};
  await api.submitScore({
    playerId: "11111111-2222-4333-8444-555555555555",
    name: "NEW",
    score: 9000,
    level: 12,
    slimeAchievements: snapshot.slimeAchievements,
    goldAppearance: historicalGoldAppearance,
    callingCardSnapshot: goldSnapshot
  }, {signal: requestSignal});
  const submitted = JSON.parse(calls.at(-1).options.body);
  assert.equal(calls.at(-1).options.signal, requestSignal);
  assert.match(calls.at(-1).url, /\/rpc\/submit_slime_jump_global_best$/);
  assert.equal(submitted.p_calling_card_snapshot.playerLevel, 42);
  assert.equal(submitted.p_calling_card_snapshot.prestigeLevel, 10);
  assert.equal(submitted.p_calling_card_snapshot.prestigeEmblemId, "prestige-final-crest");
  assert.equal(submitted.p_calling_card_snapshot.prestigeTitle, "prestige-title-p10");
  assert.equal(submitted.p_calling_card_snapshot.prestigeFrame, "prestige-frame-p10");
  assert.equal(submitted.p_calling_card_snapshot.prestigeAura, "prestige-aura-p8");
  assert.equal(submitted.p_calling_card_snapshot.prestigeTrail, "prestige-trail-p9");
  assert.equal(submitted.p_calling_card_snapshot.slimeAchievements.length, 5);
  assert.deepEqual(
    submitted.p_calling_card_snapshot.goldAppearance,
    historicalGoldAppearance
  );
}

async function assertInvalidGoldDoesNotInvalidateSnapshot(prestigeApi, snapshot) {
  const calls = [];
  const invalidGoldSnapshot = {
    ...JSON.parse(JSON.stringify(snapshot)),
    formatVersion: 1,
    goldAppearance: {
      slime: "true",
      hatId: "unknown_hat",
      beardId: 123
    }
  };
  const api = createOnlineApi(prestigeApi, async (url, options) => {
    calls.push({url, options});
    return options.method === "GET"
      ? response({json: [{
          name: "BAD",
          score: 7000,
          level: 9,
          game_version: "2.71",
          created_at: "2026-08-23T00:00:00Z",
          slime_color: "gold",
          slime_cosmetic: "cap",
          slime_beard: "stubble",
          slime_achievements: [],
          calling_card_snapshot: invalidGoldSnapshot
        }]})
      : response({json: [{best_score: 7000, improved: true}]});
  });

  const [row] = await api.getTopScores(1);
  assert.equal(row.hasIdentitySnapshot, true);
  assert.equal(row.slimeColor, "gold");
  assert.deepEqual(
    JSON.parse(JSON.stringify(row.goldAppearance)),
    {slime: false, hatId: null, beardId: null}
  );

  await api.submitScore({
    playerId: "11111111-2222-4333-8444-555555555555",
    name: "BAD",
    score: 7000,
    level: 9,
    callingCardSnapshot: invalidGoldSnapshot
  });
  const submitted = JSON.parse(calls.at(-1).options.body);
  assert.equal(submitted.p_calling_card_snapshot.playerLevel, 42);
  assert.deepEqual(
    submitted.p_calling_card_snapshot.goldAppearance,
    {slime: false, hatId: null, beardId: null}
  );
}

async function assertMissingColumnFallback(prestigeApi, snapshot) {
  const calls = [];
  const api = createOnlineApi(prestigeApi, async (url, options) => {
    calls.push({url, options});
    if (options.method === "GET" && calls.length === 1) {
      return response({
        ok: false,
        status: 400,
        text: JSON.stringify({
          code: "42703",
          message: "column slime_jump_highscores.calling_card_snapshot does not exist"
        })
      });
    }
    if (options.method === "GET") {
      return response({json: [{
        name: "OLD",
        score: 7000,
        level: 8,
        game_version: "2.57",
        created_at: null,
        slime_color: "green",
        slime_cosmetic: "none",
        slime_beard: "none",
        slime_achievements: ["badge-1"]
      }]});
    }
    return response({json: [{best_score: 7100, improved: true}]});
  });

  const rows = await api.getTopScores(10);
  assert.equal(calls.length, 2);
  assert.doesNotMatch(new URL(calls[1].url).searchParams.get("select"), /calling_card_snapshot/);
  assert.equal(rows[0].hasIdentitySnapshot, false);

  await api.submitScore({
    playerId: "11111111-2222-4333-8444-555555555555",
    name: "NEW",
    score: 7100,
    level: 9,
    slimeAchievements: snapshot.slimeAchievements,
    callingCardSnapshot: snapshot
  });
  const fallbackPayload = JSON.parse(calls.at(-1).options.body);
  assert.equal(fallbackPayload.p_calling_card_snapshot.playerLevel, 42);
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.innerHTML = "";
    this.title = "";
    const classes = new Set();
    this.classList = {
      toggle(value, force) {
        const enabled = force === undefined ? !classes.has(value) : Boolean(force);
        if (enabled) classes.add(value);
        else classes.delete(value);
        return enabled;
      },
      contains: value => classes.has(value)
    };
    const styles = new Map();
    this.style = {
      setProperty: (name, value) => styles.set(name, String(value)),
      removeProperty: name => styles.delete(name),
      getPropertyValue: name => styles.get(name) ?? ""
    };
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}

function collectText(element) {
  return [element.textContent, ...element.children.map(collectText)].join(" ");
}

function assertLocalPersistenceAndRendering(prestigeApi, snapshot) {
  const goldSnapshot = {
    ...JSON.parse(JSON.stringify(snapshot)),
    goldAppearance: {...historicalGoldAppearance}
  };
  const source = read("js/ui.js");
  const modelStart = source.indexOf("  function loadRecentScores(");
  const modelEnd = source.indexOf("  function showNicknameEntry(");
  const renderStart = source.indexOf("  let devCallingCardTestEntry = null;");
  const renderEnd = source.indexOf("  async function updateHighScores(");
  assert.ok(modelStart >= 0 && modelEnd > modelStart && renderStart >= 0 && renderEnd > renderStart);

  const legacyRecord = Object.freeze({
    name: "OLD",
    score: 100,
    level: 2,
    slimeAchievements: ["badge-1"]
  });
  const localStorage = createStorage({
    slimejumperHighscoresV14: JSON.stringify([legacyRecord]),
    slimejumperRecentScores: "[]"
  });
  const highscoreRows = new FakeElement("div");
  const openedScreens = [];
  const renderedSlimeSnapshots = [];
  let onlineSubmitCount = 0;
  const window = {
    SlimePrestige: prestigeApi,
    SlimeAchievements: {
      registry: achievementRegistry,
      getEffectiveBadgeIds: () => ["badge-6"]
    },
    SlimeJumpHighscores: {submitScore: () => { onlineSubmitCount += 1; }}
  };
  const context = vm.createContext({
    window,
    DEV_MODE: true,
    localStorage,
    console: {info() {}, error() {}, warn() {}},
    document: {createElement: tagName => new FakeElement(tagName)},
    ui: {
      highscoreRows,
      menu: {classList: {remove() {}}}
    },
    normalizeSlimeColor: value => value ?? "green",
    normalizeSlimeCosmetic: value =>
      ["none", "cap", "top_hat", "wizard_hat"].includes(value)
        ? value
        : "none",
    normalizeSlimeBeard: value =>
      ["none", "stubble", "full_beard", "braided_beard"].includes(value)
        ? value
        : "none",
    selectedSlimeColor: "purple",
    selectedSlimeCosmetic: "cap",
    selectedSlimeBeard: "stubble",
    createLeaderboardSlimePreview: (
      color,
      cosmetic,
      beard,
      prestigeAura,
      prestigeTrail,
      goldAppearance
    ) => {
      const renderedSnapshot = {
        color,
        cosmetic,
        beard,
        prestigeAura,
        prestigeTrail
      };
      if (goldAppearance !== undefined) {
        renderedSnapshot.goldAppearance = JSON.parse(JSON.stringify(goldAppearance));
      }
      renderedSlimeSnapshots.push(renderedSnapshot);
      return new FakeElement("canvas");
    },
    showMenuScreen: screenName => openedScreens.push(screenName)
  });
  const prelude = `
    const recentScoresStorageKey = "slimejumperRecentScores";
    const highScoresStorageKey = "slimejumperHighscoresV14";
    let lastOnlineScoreSubmit = Promise.resolve(null);
  `;
  vm.runInContext(
    prelude + source.slice(modelStart, modelEnd) + source.slice(renderStart, renderEnd) + `
      globalThis.highscoreTestApi = {
        loadHighScores,
        saveHighScore,
        saveRecentScore,
        sanitizeScoreEntries,
        renderHighScoreRows,
        createHighScoreCallingCard,
        createDevCallingCardTestEntry,
        showDevCallingCardTest
      };
    `,
    context,
    {filename: "js/ui-highscore-test-slice.js"}
  );

  context.highscoreTestApi.saveHighScore("NEW", 500, 7, goldSnapshot);
  const stored = JSON.parse(localStorage.snapshot().slimejumperHighscoresV14);
  assert.deepEqual(stored.find(entry => entry.name === "OLD"), legacyRecord);
  const newRecord = stored.find(entry => entry.name === "NEW");
  assert.equal(newRecord.playerLevel, 42);
  assert.equal(newRecord.prestigeLevel, 10);
  assert.equal(newRecord.prestigeTitle, "prestige-title-p10");
  assert.equal(newRecord.prestigeFrame, "prestige-frame-p10");
  assert.equal(newRecord.prestigeAura, "prestige-aura-p8");
  assert.equal(newRecord.prestigeTrail, "prestige-trail-p9");
  assert.equal(newRecord.slimeAchievements.length, 5);
  assert.deepEqual(newRecord.goldAppearance, historicalGoldAppearance);
  assert.deepEqual(stored.map(entry => entry.score), [500, 100]);

  const sanitized = context.highscoreTestApi.sanitizeScoreEntries(stored);
  context.highscoreTestApi.renderHighScoreRows(sanitized);
  assert.equal(highscoreRows.children.length, 10);
  const renderedNewCard = highscoreRows.children[0].children[1];
  const renderedLegacyCard = highscoreRows.children[1].children[1];
  assert.match(collectText(renderedNewCard), /NEW/);
  assert.match(collectText(renderedNewCard), /LEVEL 42/);
  assert.doesNotMatch(collectText(renderedNewCard), /P10/);
  assert.match(collectText(renderedNewCard), /PRESTIGE MASTER/);
  assert.match(collectText(renderedNewCard), /500/);
  assert.match(collectText(renderedLegacyCard), /LEGACY/);
  assert.match(collectText(renderedLegacyCard), /OLD/);
  assert.equal(renderedNewCard.children.length, 6);
  assert.equal(renderedNewCard.children[0].className, "highscoreCallingCardIdentity");
  assert.equal(renderedNewCard.children[1].className, "highscoreCallingCardPlayerLevel");
  assert.equal(renderedNewCard.children[2].className, "highscoreCallingCardPrestigeBlock");
  assert.equal(renderedNewCard.children[3].className, "highscoreCallingCardCore");
  assert.equal(renderedNewCard.children[4].className, "highscoreCallingCardRunLevel");
  assert.equal(renderedNewCard.children[5].className, "highscoreCallingCardScore");
  assert.equal(renderedNewCard.children[3].dataset.prestigeFrame, "prestige-frame-p10");
  assert.deepEqual(renderedSlimeSnapshots[0], {
    color: "purple",
    cosmetic: "cap",
    beard: "stubble",
    prestigeAura: "prestige-aura-p8",
    prestigeTrail: "prestige-trail-p9",
    goldAppearance: historicalGoldAppearance
  });
  assert.deepEqual(renderedSlimeSnapshots[1], {
    color: "green",
    cosmetic: "none",
    beard: "none",
    prestigeAura: "none",
    prestigeTrail: "none",
    goldAppearance: {slime: false, hatId: null, beardId: null}
  });
  assert.equal(
    renderedNewCard.children[3].children.at(-1).children.length,
    5,
    "Der Auto-5-Snapshot rendert fünf gespeicherte Badge-Icons"
  );

  const [invalidGoldEntry] = context.highscoreTestApi.sanitizeScoreEntries([{
    name: "BAD",
    score: 350,
    level: 6,
    callingCardSnapshot: {
      ...JSON.parse(JSON.stringify(snapshot)),
      goldAppearance: {
        slime: 1,
        hatId: "unknown_hat",
        beardId: "unknown_beard"
      }
    }
  }]);
  assert.equal(invalidGoldEntry.hasIdentitySnapshot, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(invalidGoldEntry.goldAppearance)),
    {slime: false, hatId: null, beardId: null}
  );

  const manualFiveIds = ["badge-5", "badge-3", "badge-1", "badge-4", "badge-2"];
  const [manualFiveEntry] = context.highscoreTestApi.sanitizeScoreEntries([{
    name: "MAN",
    score: 300,
    level: 6,
    callingCardSnapshot: {
      ...JSON.parse(JSON.stringify(snapshot)),
      slimeAchievements: manualFiveIds
    }
  }]);
  const manualFiveCard = context.highscoreTestApi.createHighScoreCallingCard(
    manualFiveEntry
  );
  assert.deepEqual(
    manualFiveCard.children[3].children.at(-1).children.map(child => child.textContent),
    manualFiveIds.map(id => achievementRegistry.find(entry => entry.id === id).icon)
  );

  const [manualEmptyEntry] = context.highscoreTestApi.sanitizeScoreEntries([{
    name: "EMP",
    score: 290,
    level: 6,
    callingCardSnapshot: {
      ...JSON.parse(JSON.stringify(snapshot)),
      slimeAchievements: []
    }
  }]);
  const manualEmptyCard = context.highscoreTestApi.createHighScoreCallingCard(
    manualEmptyEntry
  );
  assert.equal(
    manualEmptyCard.children[3].children.at(-1).children.length,
    0,
    "Ein historischer Manual-0-Snapshot bleibt ohne visuellen Live-Fallback leer"
  );

  const [prestigeZeroEntry] = context.highscoreTestApi.sanitizeScoreEntries([{
    name: "ZER",
    score: 250,
    level: 4,
    callingCardSnapshot: {
      playerLevel: 7,
      prestigeLevel: 0,
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    }
  }]);
  const prestigeZeroCard = context.highscoreTestApi.createHighScoreCallingCard(
    prestigeZeroEntry
  );
  assert.equal(
    prestigeZeroCard.className,
    "highscoreCallingCard"
  );
  assert.equal(prestigeZeroCard.children.length, 6);
  assert.equal(prestigeZeroCard.children[2].className, "highscoreCallingCardPrestigeBlock");
  assert.equal(prestigeZeroCard.children[2].children.length, 0);
  assert.equal(prestigeZeroCard.children[3].className, "highscoreCallingCardCore");
  assert.equal(
    prestigeZeroCard.children.some(child =>
      child.className === "highscoreCallingCardPrestigeBlock"
    ),
    true
  );
  assert.doesNotMatch(collectText(prestigeZeroCard), /\bP0\b/);
  assert.doesNotMatch(prestigeZeroCard.attributes["aria-label"], /Prestige P0/);

  const [prestigeOneEntry] = context.highscoreTestApi.sanitizeScoreEntries([{
    name: "ONE",
    score: 275,
    level: 5,
    callingCardSnapshot: {
      playerLevel: 8,
      prestigeLevel: 1,
      prestigeFrame: "prestige-frame-p1",
      prestigeTitle: "prestige-title-p1",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    }
  }]);
  const prestigeOneCard = context.highscoreTestApi.createHighScoreCallingCard(
    prestigeOneEntry
  );
  assert.equal(prestigeOneCard.className, "highscoreCallingCard");
  assert.equal(prestigeOneCard.children.length, 6);
  assert.equal(
    prestigeOneCard.children[2].className,
    "highscoreCallingCardPrestigeBlock"
  );
  assert.equal(
    prestigeOneCard.children[2].children[0].className,
    "highscorePrestigeEmblem"
  );
  assert.equal(prestigeOneCard.children[2].children.length, 1);
  assert.doesNotMatch(collectText(prestigeOneCard), /\bP1\b/);

  const storageBeforeDevTest = localStorage.snapshot();
  const devEntry = context.highscoreTestApi.createDevCallingCardTestEntry();
  assert.equal(devEntry.name, "DEV TEST");
  assert.equal(devEntry.score, 999999);
  assert.equal(devEntry.level, 100);
  assert.equal(devEntry.slimeColor, "hot_pink");
  assert.equal(devEntry.slimeCosmetic, "wizard_hat");
  assert.equal(devEntry.slimeBeard, "braided_beard");
  assert.equal(devEntry.playerLevel, 100);
  assert.equal(devEntry.prestigeLevel, 10);
  assert.equal(devEntry.prestigeEmblemId, "prestige-final-crest");
  assert.equal(devEntry.prestigeFrame, "prestige-frame-p10");
  assert.equal(devEntry.prestigeTitle, "prestige-title-p10");
  assert.equal(devEntry.prestigeAura, "prestige-aura-prism-p8");
  assert.equal(devEntry.prestigeTrail, "prestige-trail-prism-p9");
  assert.deepEqual(Array.from(devEntry.slimeAchievements), [
    "century_slime",
    "biome_master",
    "achievement_hunter",
    "secret_star_sniper",
    "secret_second_chance"
  ]);
  assert.equal(context.highscoreTestApi.showDevCallingCardTest(), true);
  assert.deepEqual(openedScreens, ["highscores"]);
  assert.deepEqual(localStorage.snapshot(), storageBeforeDevTest);
  assert.equal(onlineSubmitCount, 0);

  renderedSlimeSnapshots.length = 0;
  context.highscoreTestApi.renderHighScoreRows(sanitized);
  assert.equal(highscoreRows.children.length, 11);
  const previewRow = highscoreRows.children[0];
  assert.match(collectText(previewRow), /DEV PREVIEW/);
  assert.match(collectText(previewRow), /DEV TEST/);
  assert.match(collectText(previewRow), /LEVEL 100/);
  assert.match(collectText(previewRow), /RUN LEVEL 100/);
  assert.doesNotMatch(collectText(previewRow), /P10/);
  assert.match(collectText(previewRow), /PRESTIGE MASTER/);
  const previewCard = previewRow.children[1];
  const previewPrestige = previewCard.children[2];
  const previewCallingCard = previewCard.children[3];
  assert.equal(previewPrestige.children[0].className, "highscorePrestigeEmblem");
  assert.equal(previewPrestige.children.length, 1);
  assert.equal(previewCallingCard.dataset.prestigeFrame, "prestige-frame-p10");
  assert.equal(Object.hasOwn(previewCallingCard.dataset, "prestigeAura"), false);
  assert.equal(Object.hasOwn(previewCallingCard.dataset, "prestigeTrail"), false);
  assert.equal(previewCallingCard.children.length, 2);
  assert.deepEqual(renderedSlimeSnapshots[0], {
    color: "hot_pink",
    cosmetic: "wizard_hat",
    beard: "braided_beard",
    prestigeAura: "prestige-aura-prism-p8",
    prestigeTrail: "prestige-trail-prism-p9"
  });
  assert.equal(
    previewCallingCard.children.at(-1).children.length,
    5,
    "all five badges stay inside the framed calling card"
  );
  assert.equal(highscoreRows.children[1].children[0].textContent, "1");

  context.highscoreTestApi.saveRecentScore("REC", 450, 6, goldSnapshot);
  const recentScores = JSON.parse(
    localStorage.snapshot().slimejumperRecentScores
  );
  assert.equal(recentScores[0].name, "REC");
  assert.deepEqual(recentScores[0].goldAppearance, historicalGoldAppearance);
}

function assertMainMenuPrestigePreview() {
  const source = read("js/ui.js");
  const previewStart = source.indexOf("  function getSelectedPrestigeSlimePreviewOptions(");
  const previewEnd = source.indexOf("  function getPersonalBestScore(");
  assert.ok(previewStart >= 0 && previewEnd > previewStart);

  const selectedRewards = {
    aura: "prestige-aura-prism-p8",
    trail: "prestige-trail-prism-p9"
  };
  const draws = [];
  const context = vm.createContext({
    window: {
      SlimePrestige: {
        getSelectedReward: type => selectedRewards[type] ?? "none"
      }
    },
    ui: {menuMascot: new FakeElement("canvas")},
    getActiveSlimeCosmetic: () => "wizard_hat",
    getActiveSlimeBeard: () => "braided_beard",
    getActiveSlimeColor: () => "hot_pink",
    getSlimeCosmeticDefinition: () => ({type: "hat"}),
    drawSlimeCharacterPreview: (...args) => draws.push(args),
    document: {createElement: tagName => new FakeElement(tagName)},
    normalizeSlimeCosmetic: value => value,
    normalizeSlimeBeard: value => value,
    normalizeSlimeColor: value => value
  });
  vm.runInContext(
    source.slice(previewStart, previewEnd) + `
      globalThis.menuPreviewTestApi = {
        getSelectedPrestigeSlimePreviewOptions,
        renderMenuMascot
      };
    `,
    context,
    {filename: "js/ui-menu-preview-test-slice.js"}
  );

  context.menuPreviewTestApi.renderMenuMascot();
  assert.equal(draws[0][1], "wizard_hat");
  assert.equal(draws[0][2], "braided_beard");
  assert.equal(draws[0][3], "hot_pink");
  assert.equal(draws[0][4].prestigeAura, "prestige-aura-prism-p8");
  assert.equal(draws[0][4].prestigeTrail, "prestige-trail-prism-p9");
  assert.equal(draws[0][4].prestigeEffectRadius, 30);
  assert.equal(draws[0][4].prestigeTrailRadius, 20);
  assert.equal(draws[0][4].centerY, 105);
  assert.equal(draws[0][4].scale, 1.08);
  assert.equal(
    context.ui.menuMascot.classList.contains("menuMascot--prestigeAura"),
    true
  );

  selectedRewards.aura = "prestige-aura-p8";
  selectedRewards.trail = "prestige-trail-p9";
  context.menuPreviewTestApi.renderMenuMascot();
  assert.equal(draws[1][4].prestigeAura, "prestige-aura-p8");
  assert.equal(draws[1][4].prestigeTrail, "prestige-trail-p9");

  selectedRewards.aura = "none";
  selectedRewards.trail = "none";
  context.menuPreviewTestApi.renderMenuMascot();
  assert.equal(draws[2][4].prestigeAura, "none");
  assert.equal(draws[2][4].prestigeTrail, "none");
}

function assertLeaderboardSlimePreviewScale() {
  const source = read("js/ui.js");
  const previewStart = source.indexOf("  function createLeaderboardSlimePreview(");
  const previewEnd = source.indexOf("  function renderMenuMascot(", previewStart);
  const goldNormalizeStart = source.indexOf(
    "  function normalizeHighScoreGoldAppearance("
  );
  const goldNormalizeEnd = source.indexOf(
    "  function normalizeHighScoreIdentitySnapshot(",
    goldNormalizeStart
  );
  assert.ok(
    previewStart >= 0 &&
    previewEnd > previewStart &&
    goldNormalizeStart >= 0 &&
    goldNormalizeEnd > goldNormalizeStart
  );
  assert.doesNotMatch(
    source.slice(previewStart, previewEnd),
    /SlimeGold|localStorage|sessionStorage/
  );

  const draws = [];
  const context = vm.createContext({
    document: {createElement: tagName => new FakeElement(tagName)},
    normalizeSlimeColor: value => value,
    normalizeSlimeCosmetic: value =>
      ["none", "cap", "top_hat"].includes(value) ? value : "none",
    normalizeSlimeBeard: value =>
      ["none", "stubble", "full_beard"].includes(value) ? value : "none",
    drawSlimeCharacterPreview: (...args) => draws.push(args)
  });
  vm.runInContext(
    source.slice(goldNormalizeStart, goldNormalizeEnd) +
    source.slice(previewStart, previewEnd) + `
      globalThis.leaderboardPreviewTestApi = {createLeaderboardSlimePreview};
    `,
    context,
    {filename: "js/ui-leaderboard-slime-preview-test-slice.js"}
  );

  const preview = context.leaderboardPreviewTestApi.createLeaderboardSlimePreview(
    "purple",
    "cap",
    "stubble",
    "prestige-aura-prism-p8",
    "prestige-trail-prism-p9",
    historicalGoldAppearance
  );
  assert.equal(preview.className, "slimeLeaderboardPreview");
  assert.equal(preview.width, 116);
  assert.equal(preview.height, 100);
  assert.equal(draws.length, 1);
  assert.equal(draws[0][1], "top_hat");
  assert.equal(draws[0][2], "full_beard");
  assert.equal(draws[0][3], "purple");
  assert.deepEqual(JSON.parse(JSON.stringify(draws[0][4])), {
    centerX: 68,
    centerY: 56,
    scale: 0.92,
    prestigeAura: "prestige-aura-prism-p8",
    prestigeTrail: "prestige-trail-prism-p9",
    goldSlime: true,
    goldCosmetic: true,
    goldBeard: true
  });
  assert.equal(draws[0][4].scale / 0.8, 1.15);

  const combinations = [
    [{slime: false, hatId: null, beardId: null}, false, false, false],
    [{slime: true, hatId: null, beardId: null}, true, false, false],
    [{slime: false, hatId: "top_hat", beardId: null}, false, true, false],
    [{slime: false, hatId: null, beardId: "full_beard"}, false, false, true],
    [{slime: true, hatId: "top_hat", beardId: null}, true, true, false],
    [{slime: true, hatId: null, beardId: "full_beard"}, true, false, true],
    [{slime: false, hatId: "top_hat", beardId: "full_beard"}, false, true, true],
    [{slime: true, hatId: "top_hat", beardId: "full_beard"}, true, true, true]
  ];
  combinations.forEach(([goldAppearance, goldSlime, goldCosmetic, goldBeard]) => {
    context.leaderboardPreviewTestApi.createLeaderboardSlimePreview(
      "purple",
      "cap",
      "stubble",
      "none",
      "none",
      goldAppearance
    );
    const draw = draws.at(-1);
    assert.equal(draw[1], goldCosmetic ? "top_hat" : "cap");
    assert.equal(draw[2], goldBeard ? "full_beard" : "stubble");
    assert.equal(draw[4].goldSlime, goldSlime);
    assert.equal(draw[4].goldCosmetic, goldCosmetic);
    assert.equal(draw[4].goldBeard, goldBeard);
  });

  context.leaderboardPreviewTestApi.createLeaderboardSlimePreview(
    "gold",
    "cap",
    "stubble"
  );
  const amberDraw = draws.at(-1);
  assert.equal(amberDraw[3], "gold");
  assert.equal(amberDraw[4].goldSlime, false);
  assert.equal(amberDraw[4].goldCosmetic, false);
  assert.equal(amberDraw[4].goldBeard, false);
}

function assertStaticReleaseGuards() {
  const html = read("index.html");
  const staticIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(staticIds.length, new Set(staticIds).size, "index.html contains duplicate IDs");
  assert.match(
    html,
    /id="devCallingCardTestBtn" data-dev-mode-only[^>]*>DEV CALLING CARD TEST</
  );

  const uiSource = read("js/ui.js");
  const highscoreModelSource = uiSource.slice(
    uiSource.indexOf("  function normalizeHighScoreGoldAppearance("),
    uiSource.indexOf("  function showNicknameEntry(")
  );
  assert.doesNotMatch(highscoreModelSource, /SlimeGold/);
  const selectPrestigeStart = uiSource.indexOf("  function selectPrestigeReward(");
  const selectPrestigeEnd = uiSource.indexOf("  function hideGameOverXPProgress(");
  const selectPrestigeSource = uiSource.slice(selectPrestigeStart, selectPrestigeEnd);
  assert.match(selectPrestigeSource, /renderMenuMascot\(\)/);
  assert.match(
    uiSource,
    /function createSlimeCosmeticPreview[\s\S]*?getSelectedPrestigeSlimePreviewOptions\(\)/
  );
  assert.match(
    uiSource,
    /function createSlimeBeardPreview[\s\S]*?getSelectedPrestigeSlimePreviewOptions\(\)/
  );
  const devTestStart = uiSource.indexOf("  function createDevCallingCardTestEntry(");
  const devTestEnd = uiSource.indexOf("  function createHighScoreCallingCard(");
  const devTestSource = uiSource.slice(devTestStart, devTestEnd);
  assert.doesNotMatch(
    devTestSource,
    /localStorage|sessionStorage|fetch\(|submitScore|saveHighScore|console\./
  );

  const prestigeSource = read("js/slime-prestige.js");
  assert.match(prestigeSource, /SlimeAchievements\?\.getEffectiveBadgeIds\?\.\(\)/);
  assert.match(
    uiSource,
    /function getHighScoreAchievementSnapshot\(\)[\s\S]*?getEffectiveBadgeIds\?\.\(\)/
  );
  for (const id of [
    "prestige-frame-p10",
    "prestige-title-p10",
    "prestige-final-crest",
    "prestige-aura-prism-p8",
    "prestige-trail-prism-p9"
  ]) {
    assert.match(prestigeSource, new RegExp(id));
  }
  const achievementsSource = read("js/slime-achievements.js");
  for (const id of [
    "century_slime",
    "biome_master",
    "achievement_hunter",
    "secret_star_sniper",
    "secret_second_chance"
  ]) {
    assert.match(achievementsSource, new RegExp(`id: "${id}"`));
  }
  assert.match(read("js/slime-colors.js"), /hot_pink:\s*Object\.freeze\(/);
  assert.match(read("js/slime-cosmetics.js"), /wizard_hat:\s*Object\.freeze\(/);
  assert.match(read("js/slime-beards.js"), /braided_beard:\s*Object\.freeze\(/);

  const css = read("css/style.css");
  assert.match(css, /\.highscoreCallingCard\s*\{/);
  assert.doesNotMatch(css, /\.highscoreCallingCard--noPrestige\s*\{/);
  assert.match(css, /\.highscoreCallingCardCore\s*\{/);
  assert.match(css, /grid-template-columns:[\s\S]*?minmax\(150px, 2fr\)/);
  assert.match(css, /\.highscoreCallingCardCore\[data-prestige-frame="prestige-frame-p10"\] \.highscoreCallingCardTitle/);
  assert.doesNotMatch(css, /\.highscoreCallingCardAura\b/);
  assert.doesNotMatch(css, /\.highscoreCallingCardTrail\b/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /grid-template-columns:\s*clamp\(28px, 9vw, 42px\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /@keyframes\s+highscoreCallingCard/i);

  const rendererSource = read("js/renderer.js");
  const staticTrailStart = rendererSource.indexOf("  function drawStaticPrestigeTrail(");
  const previewEnd = rendererSource.indexOf("  function drawSlimeCosmeticPreview(");
  const leaderboardEffectSource = rendererSource.slice(staticTrailStart, previewEnd);
  assert.ok(staticTrailStart >= 0 && previewEnd > staticTrailStart);
  assert.match(leaderboardEffectSource, /PRESTIGE_AURA_STYLES\[options\.prestigeAura\]/);
  assert.match(leaderboardEffectSource, /PRESTIGE_TRAIL_STYLES\[options\.prestigeTrail\]/);
  assert.match(leaderboardEffectSource, /drawStaticPrestigeTrail\(previewContext, prestigeTrail, prestigeTrailRadius\)/);
  assert.match(leaderboardEffectSource, /drawPrestigeAura\(previewContext, prestigeAura, prestigeEffectRadius\)/);
  assert.doesNotMatch(
    leaderboardEffectSource,
    /requestAnimationFrame|getSelectedReward|localStorage|sessionStorage|fetch\(|console\./
  );

  const migrationWithoutComments = read(
    "supabase/slime-jump-highscore-calling-card-migration.DRAFT.sql"
  ).replace(/^--.*$/gm, "");
  assert.doesNotMatch(migrationWithoutComments, /\b(drop|delete|truncate|update)\b/i);
  assert.match(migrationWithoutComments, /add column if not exists calling_card_snapshot jsonb/i);

  assert.match(read("js/slime-progress-reset.js"), /progress-reset-2\.43/);
  assert.match(read("js/slime-jump-highscores.js"), /GAME_VERSION = "2\.73"/);
}

(async () => {
  const prestige = loadPrestigeApi();
  const snapshot = assertHistoricalSnapshotIsolation(prestige);
  assertGameOverGoldSnapshotCapture();
  await assertGlobalSnapshotRoundTrip(prestige.api, snapshot);
  await assertInvalidGoldDoesNotInvalidateSnapshot(prestige.api, snapshot);
  await assertMissingColumnFallback(prestige.api, snapshot);
  assertLocalPersistenceAndRendering(prestige.api, snapshot);
  assertMainMenuPrestigePreview();
  assertLeaderboardSlimePreviewScale();
  assertStaticReleaseGuards();
  console.log("Calling-card highscore tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
