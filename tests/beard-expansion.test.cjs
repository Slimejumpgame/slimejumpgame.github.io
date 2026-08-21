"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

const EXISTING_BEARD_IDS = Object.freeze([
  "none",
  "stubble",
  "mustache",
  "goatee",
  "full_beard",
  "cowboy_mustache",
  "viking_beard",
  "wizard_beard",
  "braided_beard",
  "lumberjack_beard",
  "imperial_beard"
]);

const NEW_BEARDS = Object.freeze([
  Object.freeze({id: "walrus_mustache", name: "Walrossbart"}),
  Object.freeze({id: "horseshoe_mustache", name: "Hufeisenbart"}),
  Object.freeze({id: "soul_patch", name: "Soul Patch"}),
  Object.freeze({id: "chinstrap_beard", name: "Kinnriemenbart"}),
  Object.freeze({id: "mutton_chops", name: "Koteletten"}),
  Object.freeze({id: "ducktail_beard", name: "Entenschwanzbart"}),
  Object.freeze({id: "forked_beard", name: "Gabelbart"}),
  Object.freeze({id: "curly_beard", name: "Lockenbart"}),
  Object.freeze({id: "box_beard", name: "Kastenbart"}),
  Object.freeze({id: "pharaoh_beard", name: "Pharaonenbart"}),
  Object.freeze({id: "fan_beard", name: "Fächerbart"}),
  Object.freeze({id: "pencil_mustache", name: "Bleistiftbart"}),
  Object.freeze({id: "circle_beard", name: "Rundbart"})
]);

const EXPECTED_COLOR_IDS = Object.freeze([
  "purple", "blue", "cyan", "green", "yellow", "orange", "red", "pink",
  "crimson", "burgundy", "apricot", "gold", "lime", "forest", "mint", "teal",
  "ice_blue", "navy", "indigo", "magenta", "hot_pink", "vanilla", "silver", "charcoal"
]);

const EXPECTED_COSMETIC_IDS = Object.freeze([
  "none", "sunglasses", "cap", "crown", "top_hat", "wizard_hat", "pirate_hat",
  "headphones", "bow", "cowboy_hat", "devil_horns", "halo", "ninja_headband",
  "viking_helmet", "party_hat", "chef_hat", "propeller_hat", "cat_ears", "bunny_ears",
  "graduation_cap", "construction_helmet", "mushroom_hat", "jester_hat", "chinese_straw_hat"
]);

function createStorage(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key, String(value)])
  );
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

function loadRegistry(relativePath, exportSource, storage = createStorage()) {
  const context = vm.createContext({localStorage: storage, console});
  vm.runInContext(`${read(relativePath)}\n${exportSource}`, context, {
    filename: relativePath
  });
  return {context, storage, api: context.registryTestApi};
}

function loadBeards(storage = createStorage()) {
  return loadRegistry(
    "js/slime-beards.js",
    `globalThis.registryTestApi = {
      order: SLIME_BEARD_ORDER,
      unlockable: UNLOCKABLE_SLIME_BEARDS,
      definitions: BEARD_DEFINITIONS,
      normalize: normalizeSlimeBeard,
      isUnlocked: isSlimeBeardUnlocked,
      unlock: unlockSlimeBeard,
      select: selectSlimeBeard,
      getSelected: () => selectedSlimeBeard,
      getUnlocked: () => [...unlockedSlimeBeards]
    };`,
    storage
  );
}

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source markers missing: ${startMarker}`);
  return source.slice(start, end);
}

function assertRegistryAndUnchangedCatalogs() {
  const beards = loadBeards().api;
  const colors = loadRegistry(
    "js/slime-colors.js",
    "globalThis.registryTestApi = {order: SLIME_COLOR_ORDER};"
  ).api;
  const cosmetics = loadRegistry(
    "js/slime-cosmetics.js",
    "globalThis.registryTestApi = {order: SLIME_COSMETIC_ORDER, unlockable: UNLOCKABLE_SLIME_COSMETICS};"
  ).api;

  assert.deepEqual(plain(colors.order), EXPECTED_COLOR_IDS);
  assert.deepEqual(plain(cosmetics.order), EXPECTED_COSMETIC_IDS);
  assert.equal(beards.order.length, 24);
  assert.equal(beards.unlockable.length, 23);
  assert.equal(beards.order.filter(id => id === "none").length, 1);
  assert.equal(new Set(plain(beards.order)).size, beards.order.length);
  assert.deepEqual(
    plain(beards.order.slice(0, EXISTING_BEARD_IDS.length)),
    EXISTING_BEARD_IDS
  );
  assert.deepEqual(
    plain(beards.order.slice(EXISTING_BEARD_IDS.length)),
    NEW_BEARDS.map(beard => beard.id)
  );

  const names = beards.order.map(id => beards.definitions[id]?.name);
  assert.equal(names.every(Boolean), true);
  assert.equal(new Set(plain(names)).size, names.length);
  for (const beard of NEW_BEARDS) {
    assert.equal(beards.definitions[beard.id].name, beard.name);
    assert.equal(beards.unlockable.includes(beard.id), true);
  }

  const uiSource = read("js/ui.js");
  const wardrobeSource = read("js/slime-wardrobe.js");
  assert.match(
    uiSource,
    /SLIME_BEARD_ORDER\.map\(beard => createSlimeBeardOption\(beard\)\)/
  );
  assert.match(
    wardrobeSource,
    /beard:\s*\{[\s\S]*?items: SLIME_BEARD_ORDER\.map\(id => \(\{/
  );
  assert.match(read("index.html"), /id="wardrobeBeardsMenuBtn"[^>]*>Bärte</);
}

function assertUnlockRequirements() {
  const colors = loadRegistry(
    "js/slime-colors.js",
    "globalThis.registryTestApi = {order: SLIME_COLOR_ORDER};"
  ).api;
  const cosmetics = loadRegistry(
    "js/slime-cosmetics.js",
    "globalThis.registryTestApi = {unlockable: UNLOCKABLE_SLIME_COSMETICS};"
  ).api;
  const beards = loadBeards().api;
  const wardrobeSource = read("js/slime-wardrobe.js");
  const requirementSource = extract(
    wardrobeSource,
    "  const WARDROBE_UNLOCK_START = 15;",
    "  const WARDROBE_PROGRESS_VERSION_STORAGE_KEY"
  );
  const context = vm.createContext({
    SLIME_COLOR_ORDER: plain(colors.order),
    UNLOCKABLE_SLIME_COSMETICS: plain(cosmetics.unlockable),
    UNLOCKABLE_SLIME_BEARDS: plain(beards.unlockable)
  });
  vm.runInContext(`
    ${requirementSource}
    globalThis.requirementTestApi = {
      start: WARDROBE_UNLOCK_START,
      step: WARDROBE_UNLOCK_STEP,
      itemCount: WARDROBE_UNLOCK_ITEM_COUNT,
      requirements: WARDROBE_UNLOCK_REQUIREMENTS
    };
  `, context, {filename: "js/wardrobe-requirements-test-slice.js"});

  const api = context.requirementTestApi;
  const requirements = plain(api.requirements);
  assert.equal(api.start, 15);
  assert.equal(api.step, 5);
  assert.equal(api.itemCount, 69);
  assert.equal(requirements.length, 69);
  assert.deepEqual(requirements.slice(0, 5), [15, 20, 25, 30, 35]);
  assert.equal(requirements.at(-1), 355);
  assert.equal(new Set(requirements).size, requirements.length);
  assert.equal(
    requirements.slice(1).every((value, index) => value - requirements[index] === 5),
    true
  );
}

function assertPersistenceAndExistingSaves() {
  const existingStorage = createStorage({
    slimejumperUnlockedSlimeBeards: '["braided_beard","imperial_beard"]',
    slimejumperSelectedSlimeBeard: "imperial_beard"
  });
  const existing = loadBeards(existingStorage).api;
  assert.deepEqual(plain(existing.getUnlocked()), ["braided_beard", "imperial_beard"]);
  assert.equal(existing.getSelected(), "imperial_beard");

  for (const {id} of NEW_BEARDS) {
    const storage = createStorage();
    const firstLoad = loadBeards(storage).api;
    assert.equal(firstLoad.isUnlocked(id), false);
    assert.equal(firstLoad.unlock(id), true);
    assert.equal(firstLoad.getSelected(), id);
    assert.equal(firstLoad.select("none"), true);
    assert.equal(firstLoad.getSelected(), "none");
    assert.equal(firstLoad.select(id), true);

    const stored = storage.snapshot();
    assert.equal(JSON.parse(stored.slimejumperUnlockedSlimeBeards).includes(id), true);
    assert.equal(stored.slimejumperSelectedSlimeBeard, id);

    const reload = loadBeards(storage).api;
    assert.equal(reload.isUnlocked(id), true);
    assert.equal(reload.getSelected(), id);
    assert.equal(reload.select("none"), true);
    assert.equal(reload.getSelected(), "none");
  }
}

function assertFreeUnlockPath() {
  const wardrobeSource = read("js/slime-wardrobe.js");
  const redeemFunction = extract(
    wardrobeSource,
    "  function redeemPendingWardrobeUnlockChoice(",
    "  function migrateUnifiedWardrobeProgress("
  );

  for (const {id} of NEW_BEARDS) {
    const fixture = loadBeards();
    vm.runInContext(`
      const DEV_MODE = false;
      let pendingWardrobeUnlockChoices = 1;
      const savePendingWardrobeUnlockChoices = () => true;
      ${redeemFunction}
      globalThis.freeUnlockTestApi = {
        redeem: redeemPendingWardrobeUnlockChoice,
        pending: () => pendingWardrobeUnlockChoices
      };
    `, fixture.context, {filename: "js/beard-free-unlock-test-slice.js"});
    assert.equal(fixture.context.freeUnlockTestApi.redeem("beard", id), true);
    assert.equal(fixture.context.freeUnlockTestApi.pending(), 0);
    assert.equal(fixture.api.isUnlocked(id), true);
    assert.equal(fixture.api.getSelected(), id);
  }
}

function createPurchaseFixture() {
  const fixture = loadBeards();
  const achievementSource = read("js/slime-achievements.js");
  const targetFunctions = extract(
    achievementSource,
    "  function getWardrobePurchaseTarget(",
    "  function resetDevShopTestSession("
  );
  const purchaseFunctions = extract(
    achievementSource,
    "  function canPurchaseWardrobeItem(",
    "  function addUniqueProgressValue("
  );

  vm.runInContext(`
    const WARDROBE_ITEM_STAR_PRICE = 250;
    const DEV_MODE = false;
    const activeWardrobePurchases = new Set();
    let starBalance = 5000;
    const saveStarBalance = () => true;
    const checkWardrobeAchievements = () => {};
    ${targetFunctions}
    ${purchaseFunctions}
    globalThis.purchaseTestApi = {
      canPurchaseWardrobeItem,
      purchaseWardrobeItem,
      getBalance: () => starBalance,
      isUnlocked: isSlimeBeardUnlocked
    };
  `, fixture.context, {filename: "js/beard-purchase-test-slice.js"});
  return fixture.context.purchaseTestApi;
}

function assertNormalPurchasePathAndPrice() {
  const purchase = createPurchaseFixture();
  for (const {id} of NEW_BEARDS) {
    assert.equal(purchase.canPurchaseWardrobeItem("beard", id), true);
    const result = plain(purchase.purchaseWardrobeItem("beard", id));
    assert.deepEqual(result, {
      ok: true,
      category: "beard",
      id,
      price: 250,
      balance: purchase.getBalance()
    });
    assert.equal(purchase.isUnlocked(id), true);
  }
  assert.equal(purchase.getBalance(), 1750);

  const achievementSource = read("js/slime-achievements.js");
  assert.match(achievementSource, /const WARDROBE_ITEM_STAR_PRICE = 250;/);
  assert.match(
    achievementSource,
    /normalizedCategory === "beard"[\s\S]*?UNLOCKABLE_SLIME_BEARDS\.includes\(normalizedId\)/
  );
}

function createRecordingContext() {
  const calls = [];
  const styles = {};
  const gradient = type => ({
    addColorStop(...args) {
      calls.push([`${type}.addColorStop`, ...args]);
    }
  });
  const methods = {
    createLinearGradient: (...args) => {
      calls.push(["createLinearGradient", ...args]);
      return gradient("linearGradient");
    },
    createRadialGradient: (...args) => {
      calls.push(["createRadialGradient", ...args]);
      return gradient("radialGradient");
    }
  };
  return {
    calls,
    context: new Proxy(methods, {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push([String(property), ...args]);
      },
      set(_target, property, value) {
        styles[property] = value;
        return true;
      }
    })
  };
}

function getLocalDrawingBounds(calls) {
  const bounds = {minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity};
  const point = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const [method, ...args] of calls) {
    if (method === "moveTo" || method === "lineTo") point(args[0], args[1]);
    if (method === "quadraticCurveTo") {
      point(args[0], args[1]);
      point(args[2], args[3]);
    }
    if (method === "bezierCurveTo") {
      point(args[0], args[1]);
      point(args[2], args[3]);
      point(args[4], args[5]);
    }
    if (method === "arc") {
      point(args[0] - args[2], args[1] - args[2]);
      point(args[0] + args[2], args[1] + args[2]);
    }
    if (method === "ellipse") {
      point(args[0] - args[2], args[1] - args[3]);
      point(args[0] + args[2], args[1] + args[3]);
    }
    if (method === "fillRect" || method === "strokeRect" || method === "rect") {
      point(args[0], args[1]);
      point(args[0] + args[2], args[1] + args[3]);
    }
  }
  return bounds;
}

function assertBoundsFitPreview(bounds, definition, layout) {
  const projectX = x => layout.centerX + layout.scale * (
    definition.anchorX * 30 + definition.scale * x
  );
  const projectY = y => layout.centerY + layout.scale * (
    definition.anchorY * 30 + definition.scale * y
  );
  assert.ok(projectX(bounds.minX) >= 0);
  assert.ok(projectX(bounds.maxX) <= layout.width);
  assert.ok(projectY(bounds.minY) >= 0);
  assert.ok(projectY(bounds.maxY) <= layout.height);
}

function assertRendererCoverageAndVisualBounds() {
  const fixture = loadBeards();
  const rendererSource = read("js/renderer.js");
  const beardRenderer = extract(
    rendererSource,
    "  function roundedCosmeticRectPath(",
    "  function drawSlimeCharacterPreview("
  );
  vm.runInContext(`
    ${beardRenderer}
    globalThis.rendererTestApi = {draw: drawSlimeBeard};
  `, fixture.context, {filename: "js/beard-renderer-test-slice.js"});

  const definitions = fixture.api.definitions;
  const signatures = new Map();
  for (const id of fixture.api.unlockable) {
    const recording = createRecordingContext();
    assert.doesNotThrow(() => fixture.context.rendererTestApi.draw(recording.context, id, 30));
    assert.ok(recording.calls.some(call =>
      ["fill", "stroke", "fillRect", "strokeRect"].includes(call[0])
    ), `${id} has no paint operation`);
    assert.equal(
      recording.calls.flat().filter(value => typeof value === "number").every(Number.isFinite),
      true
    );
    signatures.set(id, JSON.stringify(recording.calls));

    if (NEW_BEARDS.some(beard => beard.id === id)) {
      const bounds = getLocalDrawingBounds(recording.calls);
      const maximumWidth = id === "mutton_chops" ? 78 : 72;
      assert.ok(bounds.maxX - bounds.minX <= maximumWidth, `${id} is too wide`);
      assert.ok(bounds.maxY - bounds.minY <= 42, `${id} is too tall`);
      assert.ok(bounds.minY >= -8, `${id} reaches into the eyes`);
      assertBoundsFitPreview(bounds, definitions[id], {
        width: 88,
        height: 70,
        centerX: 44,
        centerY: 48,
        scale: 0.66
      });
      assertBoundsFitPreview(bounds, definitions[id], {
        width: 116,
        height: 100,
        centerX: 68,
        centerY: 54,
        scale: 0.8
      });
      assertBoundsFitPreview(bounds, definitions[id], {
        width: 180,
        height: 170,
        centerX: 90,
        centerY: 128,
        scale: 1.35
      });
    }
  }

  const existingSignatures = new Set(
    EXISTING_BEARD_IDS.filter(id => id !== "none").map(id => signatures.get(id))
  );
  const newSignatures = NEW_BEARDS.map(beard => signatures.get(beard.id));
  assert.equal(new Set(newSignatures).size, NEW_BEARDS.length);
  assert.equal(newSignatures.some(signature => existingSignatures.has(signature)), false);

  assert.match(
    rendererSource,
    /drawSlimeCharacterPreview[\s\S]*?drawSlimeBeard\(\s*previewContext,\s*normalizeSlimeBeard\(beard\),\s*30,\s*\{gold: options\.goldBeard === true\}\s*\)/
  );
  assert.match(
    rendererSource,
    /drawSlimeBeard\(ctx, activeBeard, player\.r, \{[\s\S]*?gold: goldAppearance\.beardId === activeBeard/
  );
}

async function assertLeaderboardRoundTrip() {
  const fixture = loadBeards();
  const submittedBodies = [];
  const leaderboardRows = NEW_BEARDS.map(({id}, index) => ({
    name: "BAR",
    score: 6000 - index,
    level: 12,
    game_version: "2.70",
    created_at: "2026-08-21T00:00:00Z",
    slime_color: "green",
    slime_cosmetic: "none",
    slime_beard: id,
    slime_achievements: [],
    calling_card_snapshot: null
  }));
  fixture.context.window = {
    SlimeAchievements: {registry: []},
    SlimePrestige: {
      normalizeIdentitySnapshot: value => ({...value, prestigeEmblemId: "none"})
    }
  };
  fixture.context.console = {log() {}, info() {}, warn() {}, error: console.error};
  fixture.context.normalizeSlimeColor = value => value;
  fixture.context.normalizeSlimeCosmetic = value => value;
  fixture.context.URLSearchParams = URLSearchParams;
  fixture.context.fetch = async (_url, options) => {
    if (options.method === "POST") {
      submittedBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => [{best_score: 6000, improved: true}],
        text: async () => ""
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => leaderboardRows,
      text: async () => ""
    };
  };
  vm.runInContext(read("js/slime-jump-highscores.js"), fixture.context, {
    filename: "js/slime-jump-highscores.js"
  });

  const snapshot = {
    playerLevel: 1,
    prestigeLevel: 0,
    prestigeFrame: "none",
    prestigeTitle: "none",
    prestigeAura: "none",
    prestigeTrail: "none",
    slimeAchievements: []
  };
  for (let index = 0; index < NEW_BEARDS.length; index++) {
    await fixture.context.window.SlimeJumpHighscores.submitScore({
      playerId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: "BAR",
      score: 6000 - index,
      level: 12,
      slimeColor: "green",
      slimeCosmetic: "none",
      slimeBeard: NEW_BEARDS[index].id,
      callingCardSnapshot: snapshot
    });
  }
  assert.deepEqual(
    submittedBodies.map(body => body.p_slime_beard),
    NEW_BEARDS.map(beard => beard.id)
  );
  const rows = await fixture.context.window.SlimeJumpHighscores.getTopScores(20);
  assert.deepEqual(
    plain(rows.map(row => row.slimeBeard)),
    NEW_BEARDS.map(beard => beard.id)
  );
}

(async () => {
  assertRegistryAndUnchangedCatalogs();
  assertUnlockRequirements();
  assertPersistenceAndExistingSaves();
  assertFreeUnlockPath();
  assertNormalPurchasePathAndPrice();
  assertRendererCoverageAndVisualBounds();
  await assertLeaderboardRoundTrip();
  console.log("Beard expansion tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
