"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

const EXISTING_BIOME_IDS = Object.freeze([
  "meadow",
  "coast",
  "desert",
  "volcano",
  "snow",
  "swamp",
  "crystalCave",
  "night",
  "autumn",
  "sky"
]);

const NEW_BIOMES = Object.freeze([
  Object.freeze({id: "stormNight", name: "Gewitternacht", hazard: "abyss", detail: "nightStone", motionElements: 11, music: "night"}),
  Object.freeze({id: "neonCity", name: "Neon City", hazard: "abyss", detail: "nightStone", motionElements: 8, music: "crystalCave"}),
  Object.freeze({id: "mushroomCave", name: "Pilzh\u00f6hle", hazard: "toxic", detail: "moss", motionElements: 12, music: "crystalCave"}),
  Object.freeze({id: "abandonedMine", name: "Verlassene Mine", hazard: "quicksand", detail: "earth", motionElements: 10, music: "swamp"}),
  Object.freeze({id: "bambooNight", name: "Bambusnacht", hazard: "cloudAbyss", detail: "moss", motionElements: 9, music: "night"}),
  Object.freeze({id: "pirateHarbor", name: "Piratenhafen bei Nacht", hazard: "water", detail: "earth", motionElements: 8, music: "coast"}),
  Object.freeze({id: "alienJungle", name: "Alien-Dschungel", hazard: "toxic", detail: "moss", motionElements: 12, music: "crystalCave"}),
  Object.freeze({id: "enchantedGarden", name: "Verzauberter Nachtgarten", hazard: "cloudAbyss", detail: "autumnEarth", motionElements: 13, music: "night"}),
  Object.freeze({id: "redMoon", name: "Rote Mondnacht", hazard: "abyss", detail: "nightStone", motionElements: 5, music: "volcano"}),
  Object.freeze({id: "undergroundTemple", name: "Unterirdische Tempelruinen", hazard: "abyss", detail: "sandstone", motionElements: 11, music: "desert"})
]);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function createRecordingContext() {
  const calls = [];
  const context = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    shadowColor: "transparent",
    shadowBlur: 0
  };
  const methods = [
    "save", "restore", "beginPath", "closePath", "moveTo", "lineTo",
    "quadraticCurveTo", "bezierCurveTo", "arc", "ellipse", "arcTo",
    "fill", "stroke", "fillRect", "strokeRect", "rect", "clip",
    "translate", "rotate", "scale"
  ];
  for (const method of methods) {
    context[method] = (...args) => calls.push([method, ...args]);
  }
  context.createLinearGradient = (...args) => {
    calls.push(["createLinearGradient", ...args]);
    return {
      addColorStop(...stopArgs) {
        calls.push(["addColorStop", ...stopArgs]);
      }
    };
  };
  return {context, calls};
}

function loadBiomeFixture() {
  const recording = createRecordingContext();
  const context = vm.createContext({
    console,
    ctx: recording.context,
    W: 1280,
    H: 720,
    levelIndex: 0,
    worldTime: 0
  });
  vm.runInContext(`
    ${read("js/biomes.js")}
    ${read("js/hazards.js")}
    globalThis.biomeTestApi = {
      biomes: BIOMES,
      getBiomeForLevel,
      backgroundRenderers: BACKGROUND_RENDERERS,
      deathZoneRenderers: DEATH_ZONE_RENDERERS,
      drawBackground,
      drawDeathZone
    };
  `, context, {filename: "biome-expansion-fixture.js"});
  return {context, recording, api: context.biomeTestApi};
}

function loadAudioFixture() {
  const context = vm.createContext({console, window: {}});
  vm.runInContext(`
    ${read("js/audio.js")}
    globalThis.audioTestApi = {themes: MUSIC_THEMES, aliases: BIOME_MUSIC_ALIASES};
  `, context, {filename: "audio-biome-alias-fixture.js"});
  return context.audioTestApi;
}

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source markers missing: ${startMarker}`);
  return source.slice(start, end);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function whiteContrast(hex) {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

function assertRegistryAndRotation() {
  const {api} = loadBiomeFixture();
  const biomes = plain(api.biomes);
  const ids = biomes.map(biome => biome.id);

  assert.equal(biomes.length, 20);
  assert.equal(new Set(ids).size, 20);
  assert.deepEqual(ids.slice(0, 10), EXISTING_BIOME_IDS);
  assert.deepEqual(ids.slice(10), NEW_BIOMES.map(biome => biome.id));

  for (let index = 0; index < NEW_BIOMES.length; index++) {
    const expected = NEW_BIOMES[index];
    const actual = biomes[index + 10];
    assert.equal(actual.name, expected.name);
    assert.equal(actual.background.renderer, expected.id);
    assert.equal(actual.hazard.type, expected.hazard);
    assert.equal(actual.platform.detail, expected.detail);
    assert.equal(actual.background.motionElements, expected.motionElements);
  }

  const expectedLevels = new Map([
    [1, "meadow"],
    [10, "meadow"],
    [11, "coast"],
    [100, "sky"],
    [101, "stormNight"],
    [110, "stormNight"],
    [111, "neonCity"],
    [200, "undergroundTemple"],
    [201, "meadow"],
    [210, "meadow"],
    [211, "coast"]
  ]);
  for (const [level, expectedId] of expectedLevels) {
    assert.equal(api.getBiomeForLevel(level).id, expectedId, `wrong biome for level ${level}`);
  }

  assert.match(
    api.getBiomeForLevel.toString(),
    /Math\.floor\(\(normalizedLevel - 1\) \/ 10\) % BIOMES\.length/
  );
}

function assertVisualBindingsAndBudgets() {
  const fixture = loadBiomeFixture();
  const rendererSource = read("js/renderer.js");
  const audio = loadAudioFixture();

  for (let index = 0; index < NEW_BIOMES.length; index++) {
    const expected = NEW_BIOMES[index];
    const biome = fixture.api.biomes[index + 10];

    assert.equal(typeof fixture.api.backgroundRenderers[biome.background.renderer], "function");
    assert.equal(typeof fixture.api.deathZoneRenderers[biome.hazard.type], "function");
    assert.match(biome.platform.body, HEX_COLOR);
    assert.match(biome.platform.top, HEX_COLOR);
    assert.match(biome.platform.detailColor, HEX_COLOR);
    assert.match(
      rendererSource,
      new RegExp(`\\b${biome.platform.detail}:\\s*draw[A-Za-z]+PlatformDetail`)
    );
    assert.ok(biome.background.motionElements >= 5);
    assert.ok(biome.background.motionElements <= 14);

    assert.equal(audio.aliases[expected.id], expected.music);
    assert.ok(audio.themes[expected.id]);
    assert.equal(audio.themes[expected.id], audio.themes[expected.music]);

    for (const time of [0, 5.25]) {
      fixture.context.levelIndex = 100 + index * 10;
      fixture.context.worldTime = time;
      fixture.recording.calls.length = 0;
      assert.doesNotThrow(() => fixture.api.drawBackground(biome));
      assert.doesNotThrow(() => fixture.api.drawDeathZone(
        {x: 235, y: 690, w: 825, h: 30},
        biome
      ));
      assert.ok(fixture.recording.calls.some(call => call[0] === "fillRect" || call[0] === "fill"));
      assert.ok(fixture.recording.calls.length < 1200, `${expected.id} draw loop is unexpectedly large`);
      assert.equal(
        fixture.recording.calls.flat().filter(value => typeof value === "number").every(Number.isFinite),
        true,
        `${expected.id} emitted a non-finite canvas coordinate`
      );
    }
  }
}

function assertAimContrast() {
  const {api} = loadBiomeFixture();
  for (const biome of api.biomes.slice(10)) {
    const contrasts = biome.background.gradient.map(([, color]) => whiteContrast(color));
    assert.ok(
      Math.min(...contrasts) >= 7,
      `${biome.id} background is too bright for the unchanged white aim line`
    );
  }

  const rendererSource = read("js/renderer.js");
  assert.match(rendererSource, /rgba\(255,255,255,0\.55\)/);
  assert.match(rendererSource, /ctx\.fillStyle = "#e9ffef"/);
}

function assertDynamicMenuAndDevAccess() {
  const uiSource = read("js/ui.js");
  assert.match(
    uiSource,
    /const selectedBiome = BIOMES\[Math\.floor\(Math\.random\(\) \* BIOMES\.length\)\]/
  );
  const reachableIndexes = Array.from(
    {length: 20},
    (_, index) => Math.floor(((index + 0.5) / 20) * 20)
  );
  assert.deepEqual(reachableIndexes, Array.from({length: 20}, (_, index) => index));

  const htmlSource = read("index.html");
  const gameSource = read("js/game.js");
  assert.match(htmlSource, /id="devLevelInput" type="number" min="1" step="1"/);
  assert.match(
    gameSource,
    /ui\.devStartLevelBtn\.addEventListener\("click", \(\) => startDevLevel\(ui\.devLevelInput\.value\)\)/
  );
}

function assertDynamicAchievements() {
  const achievementSource = read("js/slime-achievements.js");
  const biomeIds = [...EXISTING_BIOME_IDS, ...NEW_BIOMES.map(biome => biome.id)];
  const biomeRegistry = biomeIds.map(id => ({id}));
  const getExistingBiomeIdsSource = extract(
    achievementSource,
    "  function getExistingBiomeIds()",
    "  function getNonNegativeInteger("
  );
  const progressChecksSource = extract(
    achievementSource,
    "  function checkPersistentProgressAchievements()",
    "  function resetLevelState("
  );

  const unlocked = [];
  const achievementProgress = {
    discoveredBiomeIds: biomeIds.slice(0, 10),
    perfectBiomeIds: [],
    deathFreeBiomeIds: biomeIds.slice(0, 10),
    completedLookIds: [],
    lifetimeStars: 0,
    lifetimePerfects: 0,
    lifetimeCompletedLevels: 0,
    lifetimeDeaths: 0
  };
  const context = vm.createContext({
    BIOMES: biomeRegistry,
    achievementProgress,
    runState: {runBiomeIds: new Set()},
    saveAchievementProgress() {},
    unlockAchievement: id => unlocked.push(id),
    getLifetimeAirTime: () => 0
  });
  vm.runInContext(`
    ${getExistingBiomeIdsSource}
    ${progressChecksSource}
    globalThis.achievementTestApi = {getExistingBiomeIds, checkPersistentProgressAchievements, recordBiomeReached};
  `, context, {filename: "dynamic-biome-achievement-fixture.js"});

  assert.deepEqual(plain(context.achievementTestApi.getExistingBiomeIds()), biomeIds);
  context.achievementTestApi.recordBiomeReached("stormNight");
  assert.equal(unlocked.includes("world_traveler"), false);
  achievementProgress.discoveredBiomeIds = biomeIds.slice(0, -1);
  context.achievementTestApi.recordBiomeReached(biomeIds.at(-1));
  assert.equal(unlocked.includes("world_traveler"), true);

  unlocked.length = 0;
  context.achievementTestApi.checkPersistentProgressAchievements();
  assert.equal(unlocked.includes("biome_master"), false);
  achievementProgress.deathFreeBiomeIds = [...biomeIds];
  context.achievementTestApi.checkPersistentProgressAchievements();
  assert.equal(unlocked.includes("biome_master"), true);

  const unlockLoaderSource = extract(
    achievementSource,
    "  function safeParseStorage(",
    "  function getExistingBiomeIds()"
  );
  const storedWorldTraveler = [{id: "world_traveler", unlockedAt: 123456}];
  const unlockContext = vm.createContext({
    localStorage: {getItem: () => JSON.stringify(storedWorldTraveler)}
  });
  vm.runInContext(`
    const ACHIEVEMENTS_STORAGE_KEY = "test-achievements";
    const ACHIEVEMENT_BY_ID = new Map([["world_traveler", {id: "world_traveler"}]]);
    ${unlockLoaderSource}
    globalThis.loadedUnlocks = loadAchievementUnlocks();
  `, unlockContext, {filename: "achievement-unlock-preservation-fixture.js"});
  assert.deepEqual(plain(unlockContext.loadedUnlocks), storedWorldTraveler);
}

function assertScopeBoundaries() {
  const biomeSource = read("js/biomes.js");
  assert.match(
    biomeSource,
    /const biomeIndex = Math\.floor\(\(normalizedLevel - 1\) \/ 10\) % BIOMES\.length;/
  );
  assert.doesNotMatch(biomeSource, /new\s+(Worker|WebGLRenderingContext)\b/);
  assert.doesNotMatch(biomeSource, /requestAnimationFrame\s*\(/);
}

assertRegistryAndRotation();
assertVisualBindingsAndBudgets();
assertAimContrast();
assertDynamicMenuAndDevAccess();
assertDynamicAchievements();
assertScopeBoundaries();
console.log("Biome expansion tests passed.");
