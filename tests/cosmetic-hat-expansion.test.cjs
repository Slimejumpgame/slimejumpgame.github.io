"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

const EXISTING_COSMETIC_IDS = Object.freeze([
  "none",
  "sunglasses",
  "cap",
  "crown",
  "top_hat",
  "wizard_hat",
  "pirate_hat",
  "headphones",
  "bow",
  "cowboy_hat",
  "devil_horns",
  "halo",
  "ninja_headband",
  "viking_helmet",
  "party_hat",
  "chef_hat",
  "propeller_hat",
  "cat_ears",
  "bunny_ears"
]);

const NEW_HATS = Object.freeze([
  Object.freeze({id: "graduation_cap", name: "Doktorhut"}),
  Object.freeze({id: "construction_helmet", name: "Bauhelm"}),
  Object.freeze({id: "mushroom_hat", name: "Pilzhut"}),
  Object.freeze({id: "jester_hat", name: "Narrenmütze"}),
  Object.freeze({id: "ufo_hat", name: "UFO-Hut"})
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

function loadCosmetics(storage = createStorage()) {
  return loadRegistry(
    "js/slime-cosmetics.js",
    `globalThis.registryTestApi = {
      order: SLIME_COSMETIC_ORDER,
      unlockable: UNLOCKABLE_SLIME_COSMETICS,
      definitions: COSMETIC_DEFINITIONS,
      normalize: normalizeSlimeCosmetic,
      isUnlocked: isSlimeCosmeticUnlocked,
      unlock: unlockSlimeCosmetic,
      select: selectSlimeCosmetic,
      getSelected: () => selectedSlimeCosmetic,
      getUnlocked: () => [...unlockedSlimeCosmetics]
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

function assertRegistryCountsAndExistingIds() {
  const colors = loadRegistry(
    "js/slime-colors.js",
    "globalThis.registryTestApi = {order: SLIME_COLOR_ORDER};"
  ).api;
  const cosmetics = loadCosmetics().api;
  const beards = loadRegistry(
    "js/slime-beards.js",
    "globalThis.registryTestApi = {order: SLIME_BEARD_ORDER};"
  ).api;

  assert.equal(colors.order.length, 24);
  assert.equal(cosmetics.order.length, colors.order.length);
  assert.equal(new Set(plain(cosmetics.order)).size, cosmetics.order.length);
  assert.deepEqual(
    plain(cosmetics.order.slice(0, EXISTING_COSMETIC_IDS.length)),
    EXISTING_COSMETIC_IDS
  );
  assert.deepEqual(
    plain(cosmetics.order.slice(EXISTING_COSMETIC_IDS.length)),
    NEW_HATS.map(hat => hat.id)
  );
  assert.equal(cosmetics.unlockable.length, 23);
  assert.equal(cosmetics.unlockable.includes("none"), false);

  const names = cosmetics.order.map(id => cosmetics.definitions[id]?.name);
  assert.equal(names.every(Boolean), true);
  assert.equal(new Set(plain(names)).size, names.length);
  for (const hat of NEW_HATS) {
    const definition = cosmetics.definitions[hat.id];
    assert.equal(definition.name, hat.name);
    assert.equal(definition.type, "hat");
    assert.equal(cosmetics.unlockable.includes(hat.id), true);
  }

  const wardrobeSource = read("js/slime-wardrobe.js");
  const requirementBlock = extract(
    wardrobeSource,
    "  const WARDROBE_UNLOCK_REQUIREMENTS = Object.freeze([",
    "  ]);"
  );
  const requirements = [...requirementBlock.matchAll(/\b\d+\b/g)]
    .map(match => Number(match[0]));
  const unlockableWardrobeItems =
    (colors.order.length - 1) + cosmetics.unlockable.length + (beards.order.length - 1);
  assert.equal(requirements.length, unlockableWardrobeItems);
  assert.equal(requirements.at(-1), 560);

  const uiSource = read("js/ui.js");
  assert.match(
    uiSource,
    /SLIME_COSMETIC_ORDER\.map\(cosmetic => createSlimeCosmeticOption\(cosmetic\)\)/
  );
  assert.match(
    wardrobeSource,
    /cosmetic:\s*\{[\s\S]*?items: SLIME_COSMETIC_ORDER\.map\(id => \(\{/
  );
  assert.match(read("index.html"), /id="wardrobeCosmeticsMenuBtn"[^>]*>HÜTE</);
}

function assertPersistenceAndExistingSaves() {
  const existingStorage = createStorage({
    slimejumperUnlockedSlimeCosmetics: '["crown","wizard_hat"]',
    slimejumperSelectedSlimeCosmetic: "wizard_hat"
  });
  const existing = loadCosmetics(existingStorage).api;
  assert.deepEqual(plain(existing.getUnlocked()), ["crown", "wizard_hat"]);
  assert.equal(existing.getSelected(), "wizard_hat");

  for (const {id} of NEW_HATS) {
    const storage = createStorage();
    const firstLoad = loadCosmetics(storage).api;
    assert.equal(firstLoad.isUnlocked(id), false);
    assert.equal(firstLoad.unlock(id), true);
    assert.equal(firstLoad.getSelected(), id);
    assert.equal(firstLoad.select("none"), true);
    assert.equal(firstLoad.select(id), true);
    assert.equal(firstLoad.getSelected(), id);

    const stored = storage.snapshot();
    assert.equal(JSON.parse(stored.slimejumperUnlockedSlimeCosmetics).includes(id), true);
    assert.equal(stored.slimejumperSelectedSlimeCosmetic, id);

    const reload = loadCosmetics(storage).api;
    assert.equal(reload.isUnlocked(id), true);
    assert.equal(reload.getSelected(), id);
    assert.equal(reload.select("none"), true);
    assert.equal(reload.getSelected(), "none");
  }
}

function createPurchaseFixture() {
  const fixture = loadCosmetics();
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
    let starBalance = 2000;
    const saveStarBalance = () => true;
    const checkWardrobeAchievements = () => {};
    ${targetFunctions}
    ${purchaseFunctions}
    globalThis.purchaseTestApi = {
      canPurchaseWardrobeItem,
      purchaseWardrobeItem,
      getBalance: () => starBalance,
      isUnlocked: isSlimeCosmeticUnlocked
    };
  `, fixture.context, {filename: "js/cosmetic-purchase-test-slice.js"});
  return fixture.context.purchaseTestApi;
}

function assertNormalPurchasePathAndPrice() {
  const purchase = createPurchaseFixture();
  for (const {id} of NEW_HATS) {
    assert.equal(purchase.canPurchaseWardrobeItem("cosmetic", id), true);
    const result = plain(purchase.purchaseWardrobeItem("cosmetic", id));
    assert.deepEqual(result, {
      ok: true,
      category: "cosmetic",
      id,
      price: 250,
      balance: purchase.getBalance()
    });
    assert.equal(purchase.isUnlocked(id), true);
  }
  assert.equal(purchase.getBalance(), 750);

  const achievementSource = read("js/slime-achievements.js");
  assert.match(achievementSource, /const WARDROBE_ITEM_STAR_PRICE = 250;/);
  assert.match(
    achievementSource,
    /normalizedCategory === "cosmetic"[\s\S]*?UNLOCKABLE_SLIME_COSMETICS\.includes\(normalizedId\)/
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
  const fixture = loadCosmetics();
  const rendererSource = read("js/renderer.js");
  const cosmeticRenderer = extract(
    rendererSource,
    "  function roundedCosmeticRectPath(",
    "  function drawSlimeBeard("
  );
  vm.runInContext(`
    ${cosmeticRenderer}
    globalThis.rendererTestApi = {draw: drawSlimeCosmetic};
  `, fixture.context, {filename: "js/cosmetic-renderer-test-slice.js"});

  const definitions = fixture.api.definitions;
  const signatures = new Map();
  for (const id of fixture.api.unlockable) {
    const recording = createRecordingContext();
    assert.doesNotThrow(() => fixture.context.rendererTestApi.draw(recording.context, id, 30));
    assert.ok(recording.calls.some(call =>
      ["fill", "stroke", "fillRect", "strokeRect"].includes(call[0])
    ), `${id} has no paint operation`);
    if (NEW_HATS.some(hat => hat.id === id)) {
      assert.ok(recording.calls.some(call => call[0] === "fill"), `${id} has no fill`);
      assert.ok(recording.calls.some(call => call[0] === "stroke"), `${id} has no stroke`);
    }
    assert.equal(
      recording.calls.flat().filter(value => typeof value === "number").every(Number.isFinite),
      true
    );
    signatures.set(id, JSON.stringify(recording.calls));

    if (NEW_HATS.some(hat => hat.id === id)) {
      const bounds = getLocalDrawingBounds(recording.calls);
      assert.ok(bounds.maxX - bounds.minX <= 82, `${id} is too wide`);
      assert.ok(bounds.maxY - bounds.minY <= 65, `${id} is too tall`);
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
    EXISTING_COSMETIC_IDS.filter(id => id !== "none").map(id => signatures.get(id))
  );
  const newSignatures = NEW_HATS.map(hat => signatures.get(hat.id));
  assert.equal(new Set(newSignatures).size, NEW_HATS.length);
  assert.equal(newSignatures.some(signature => existingSignatures.has(signature)), false);

  assert.match(
    rendererSource,
    /drawSlimeCharacterPreview[\s\S]*?drawSlimeCosmetic\(previewContext, cosmetic, 30\)/
  );
  assert.match(
    rendererSource,
    /drawSlimeCosmetic\(ctx, getActiveSlimeCosmetic\(\), player\.r\)/
  );
}

async function assertLeaderboardRoundTrip() {
  const fixture = loadCosmetics();
  const submittedBodies = [];
  const leaderboardNames = ["HAT", "CAP", "UFO", "FUN", "MUS"];
  const leaderboardRows = NEW_HATS.map(({id}, index) => ({
    name: leaderboardNames[index],
    score: 5000 - index,
    level: 10,
    game_version: "2.70",
    created_at: "2026-08-21T00:00:00Z",
    slime_color: "green",
    slime_cosmetic: id,
    slime_beard: "none",
    slime_achievements: [],
    calling_card_snapshot: null
  }));
  fixture.context.window = {
    SlimeAchievements: {registry: []},
    SlimePrestige: {
      normalizeIdentitySnapshot: value => ({...value, prestigeEmblemId: "none"})
    }
  };
  fixture.context.normalizeSlimeColor = value => value;
  fixture.context.normalizeSlimeBeard = value => value;
  fixture.context.URLSearchParams = URLSearchParams;
  fixture.context.fetch = async (_url, options) => {
    if (options.method === "POST") {
      submittedBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => [{best_score: 5000, improved: true}],
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
  for (let index = 0; index < NEW_HATS.length; index++) {
    await fixture.context.window.SlimeJumpHighscores.submitScore({
      playerId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: "HAT",
      score: 5000 - index,
      level: 10,
      slimeColor: "green",
      slimeCosmetic: NEW_HATS[index].id,
      slimeBeard: "none",
      callingCardSnapshot: snapshot
    });
  }
  assert.deepEqual(
    submittedBodies.map(body => body.p_slime_cosmetic),
    NEW_HATS.map(hat => hat.id)
  );
  const rows = await fixture.context.window.SlimeJumpHighscores.getTopScores(10);
  assert.deepEqual(
    plain(rows.map(row => row.slimeCosmetic)),
    NEW_HATS.map(hat => hat.id)
  );
}

(async () => {
  assertRegistryCountsAndExistingIds();
  assertPersistenceAndExistingSaves();
  assertNormalPurchasePathAndPrice();
  assertRendererCoverageAndVisualBounds();
  await assertLeaderboardRoundTrip();
  console.log("Cosmetic hat expansion tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
