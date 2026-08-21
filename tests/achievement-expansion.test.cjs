"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

const biomeIds = [
  "meadow", "coast", "desert", "volcano", "snow", "swamp", "crystalCave",
  "night", "autumn", "sky", "stormNight", "neonCity", "mushroomCave",
  "abandonedMine", "bambooNight", "pirateHarbor", "alienJungle",
  "enchantedGarden", "redMoon", "undergroundTemple"
];

const legacyAchievementIds = [
  "hp_gen", "perfectionist", "untouchable", "starstruck", "star_hoarder",
  "galaxy_brain", "not_today", "clean_run", "ghostbuster", "speed_slime",
  "bounce_master", "ice_cold", "hot_stuff", "head_in_the_clouds",
  "world_traveler", "round_two", "fashion_slime", "glorious_beard",
  "dressed_to_slime", "wardrobe_warrior", "rainbow_slime", "perfect_clear",
  "long_haul", "empty_handed", "full_wardrobe", "fashion_icon", "beard_baron",
  "marathon_slime", "century_slime", "clean_machine", "ghost_whisperer",
  "bounce_addict", "perfect_tourist", "biome_master", "speed_demon",
  "clean_sweep", "star_magnet", "star_bank", "frequent_flyer", "style_master",
  "perfect_25", "veteran_slime", "ouch", "achievement_hunter",
  "secret_one_shot", "secret_star_sniper", "secret_second_chance",
  "secret_air_time", "secret_ragequitter", "secret_groundhog_slime",
  "secret_take_your_time"
];

const newAchievementIds = [
  "slime_scholar", "rising_prodigy", "halfway_to_prestige", "upper_class_slime",
  "level_cap", "ready_to_ascend", "meadow_graduate", "old_world_complete",
  "worlds_end", "beyond_the_map", "storm_chaser", "temple_threshold",
  "after_dark", "cave_connoisseur", "new_world_perfection",
  "secret_pirates_code", "secret_first_contact", "secret_blood_moon",
  "secret_temple_raider", "golden_ticket", "true_alchemy", "crowned_in_gold",
  "beard_of_midas", "gold_rush", "bullion_barber", "all_that_glitters",
  "secret_gold_standard", "first_ascent", "seasoned_soul", "high_society",
  "beyond_mortal", "prestige_legend", "forever_fashionable", "three_of_a_kind",
  "heirloom_collection", "legacy_closet", "perk_up", "fully_loaded",
  "triple_threat", "build_online", "double_tap", "two_out_of_three",
  "bounce_marathon", "flawless_20", "clean_50", "run_200", "the_long_memory",
  "secret_achievement_404", "secret_bare_minimum", "ein_richtiger_kevin"
];

function loadAchievements({storageValues = {}} = {}) {
  const localStorage = createStorage(storageValues);
  const player = {level: 1, levelXP: 0, isPrestigeReady: false};
  const prestige = {level: 0, permanentUnlocks: []};
  const perks = {
    definitions: [
      {id: "air_hop", implemented: true},
      {id: "extra_life", implemented: true},
      {id: "lucky_charm", implemented: true}
    ],
    unlocked: [],
    selected: [],
    active: []
  };
  const gold = {
    ownsSlime: false,
    slimeMastery: false,
    hatMastery: false,
    beardMastery: false,
    purchasedHats: [],
    purchasedBeards: [],
    equipped: {slime: false, hatId: null, beardId: null}
  };
  const goldHatIds = ["cap", "crown"];
  const goldBeardIds = ["goatee", "full"];
  const listeners = new Map();

  const context = vm.createContext({
    console,
    localStorage,
    DEV_MODE: false,
    BIOMES: biomeIds.map(id => ({id})),
    SLIME_COLOR_ORDER: ["green", "blue"],
    SLIME_COSMETIC_ORDER: ["none", "cap", "crown"],
    UNLOCKABLE_SLIME_COSMETICS: ["cap", "crown"],
    SLIME_BEARD_ORDER: ["none", "goatee", "full"],
    UNLOCKABLE_SLIME_BEARDS: ["goatee", "full"],
    unlockedSlimeColors: ["green"],
    unlockedSlimeCosmetics: [],
    unlockedSlimeBeards: [],
    selectedSlimeColor: "green",
    selectedSlimeCosmetic: "none",
    selectedSlimeBeard: "none"
  });
  context.window = context;
  context.addEventListener = (name, callback) => listeners.set(name, callback);
  context.SlimePlayerProgress = {
    getPlayerProgress: () => ({...player}),
    isPrestigeReady: () => player.isPrestigeReady
  };
  context.SlimePrestige = {
    getLevel: () => prestige.level,
    getPermanentWardrobeUnlocks: () => prestige.permanentUnlocks.map(item => ({...item})),
    getSelectedReward: () => "none",
    getRewardDefinition: () => null
  };
  context.SlimePerks = {
    definitions: perks.definitions,
    getStoredUnlockedPerkIds: () => perks.unlocked.slice(),
    getStoredSelectedPerkIds: () => perks.selected.slice(),
    getActiveRunPerkIds: () => perks.active.slice()
  };
  context.SlimeGold = {
    ownsGoldSlime: () => gold.ownsSlime || gold.slimeMastery,
    isGoldSlimeMasteryUnlocked: () => gold.slimeMastery,
    isGoldHatMasteryUnlocked: () => gold.hatMastery,
    isGoldBeardMasteryUnlocked: () => gold.beardMastery,
    getProgress: () => ({
      hats: {purchasedGoldHatIds: gold.purchasedHats.slice()},
      beards: {purchasedGoldBeardIds: gold.purchasedBeards.slice()}
    }),
    getGoldHatIds: () => goldHatIds.slice(),
    getGoldBeardIds: () => goldBeardIds.slice(),
    ownsGoldHat: id => gold.hatMastery || gold.purchasedHats.includes(id),
    ownsGoldBeard: id => gold.beardMastery || gold.purchasedBeards.includes(id),
    getEquippedAppearance: () => ({...gold.equipped})
  };

  vm.runInContext(read("js/slime-achievements.js"), context, {
    filename: "js/slime-achievements.js"
  });

  return {
    context,
    api: context.SlimeAchievements,
    localStorage,
    player,
    prestige,
    perks,
    gold,
    listeners
  };
}

function unlockedIds(fixture) {
  return fixture.api.getUnlocked().map(unlock => unlock.id);
}

function assertRegistryContract() {
  const {api} = loadAchievements();
  const registry = Array.from(api.registry);
  const ids = registry.map(achievement => achievement.id);
  const icons = registry.map(achievement => achievement.icon);
  const descriptions = registry.map(achievement => achievement.description);
  const secrets = registry.filter(achievement => achievement.secret);
  const newAchievements = registry.filter(achievement => newAchievementIds.includes(achievement.id));

  assert.equal(legacyAchievementIds.length, 51);
  assert.equal(newAchievementIds.length, 50);
  assert.equal(api.registry.length, 101);
  assert.equal(new Set(ids).size, 101);
  assert.equal(new Set(icons).size, 101);
  assert.equal(new Set(descriptions).size, 101);
  assert.deepEqual(ids.slice(0, 51), legacyAchievementIds);
  assert.deepEqual(ids.slice(51), newAchievementIds);
  assert.equal(secrets.length, 15);
  assert.equal(newAchievements.filter(achievement => achievement.secret).length, 8);
  assert.equal(api.registry.at(-1).id, "ein_richtiger_kevin");
  assert.equal(api.registry.at(-1).secret, true);
  assert.equal(api.registry.find(item => item.id === "halfway_to_prestige").conditionKey, "player-level-50");
  assert.equal(
    new Set(newAchievements.map(achievement => achievement.conditionKey)).size,
    newAchievements.length
  );
}

function assertLegacyUnlockPreservation() {
  const storedUnlocks = [
    {id: "world_traveler", unlockedAt: 10},
    {id: "round_two", unlockedAt: 20},
    {id: "achievement_hunter", unlockedAt: 30}
  ];
  const fixture = loadAchievements({
    storageValues: {slimejumperAchievements: JSON.stringify(storedUnlocks)}
  });
  for (const unlock of storedUnlocks) {
    assert.ok(unlockedIds(fixture).includes(unlock.id));
  }
}

function assertWorldTravelerUsesAllTwentyBiomes() {
  const fixture = loadAchievements();
  fixture.api.onRunStart({levelNumber: 1, biomeId: biomeIds[0]});
  for (let index = 1; index < 19; index++) {
    fixture.api.onBiomeReached({levelNumber: index * 10 + 1, biomeId: biomeIds[index]});
  }
  assert.equal(unlockedIds(fixture).includes("world_traveler"), false);
  fixture.api.onBiomeReached({levelNumber: 191, biomeId: biomeIds[19]});
  assert.equal(unlockedIds(fixture).includes("world_traveler"), true);
}

function assertPlayerLevelAndPrestigeStateChecks() {
  const fixture = loadAchievements();
  fixture.player.level = 49;
  fixture.api.checkState();
  assert.equal(unlockedIds(fixture).includes("halfway_to_prestige"), false);
  fixture.api.onLevelCompleted({
    levelNumber: 50,
    biomeId: "snow",
    collectedStars: 1,
    totalStars: 3
  });
  assert.equal(
    unlockedIds(fixture).includes("halfway_to_prestige"),
    false,
    "Map-Level 50 darf das Player-Level-Achievement nicht freischalten"
  );
  fixture.player.level = 50;
  fixture.api.checkState();
  assert.equal(unlockedIds(fixture).includes("halfway_to_prestige"), true);

  fixture.prestige.level = 0;
  fixture.api.checkState();
  assert.equal(unlockedIds(fixture).includes("first_ascent"), false);
  fixture.prestige.level = 10;
  fixture.api.checkState();
  for (const id of [
    "first_ascent", "seasoned_soul", "high_society", "beyond_mortal", "prestige_legend"
  ]) {
    assert.ok(unlockedIds(fixture).includes(id));
  }
}

function assertDynamicPerfectAndDeathFreeBiomeTargets() {
  const progress = {
    discoveredBiomeIds: biomeIds.slice(),
    perfectBiomeIds: biomeIds.slice(0, -1),
    deathFreeBiomeIds: biomeIds.slice(0, -1),
    completedLookIds: [],
    lifetimeStars: 0,
    lifetimeAirTime: 0,
    lifetimeCompletedLevels: 0,
    lifetimeDeaths: 0,
    lifetimePerfects: 0
  };
  const fixture = loadAchievements({
    storageValues: {slimejumperAchievementProgress: JSON.stringify(progress)}
  });
  assert.equal(unlockedIds(fixture).includes("perfect_tourist"), false);
  assert.equal(unlockedIds(fixture).includes("biome_master"), false);
  fixture.api.onLevelCompleted({
    levelNumber: 200,
    biomeId: biomeIds.at(-1),
    isPerfect: true,
    hadDeath: false,
    collectedStars: 3,
    totalStars: 3
  });
  assert.equal(unlockedIds(fixture).includes("perfect_tourist"), true);
  assert.equal(unlockedIds(fixture).includes("biome_master"), true);
}

function assertRotationCompletesAtLevelTwoHundred() {
  const fixture = loadAchievements();
  fixture.api.onRunStart({levelNumber: 1, biomeId: biomeIds[0]});
  for (let index = 1; index < biomeIds.length; index++) {
    fixture.api.onLevelStart({levelNumber: index * 10 + 1, biomeId: biomeIds[index]});
  }
  fixture.api.onLevelCompleted({
    levelNumber: 199,
    biomeId: biomeIds.at(-1),
    collectedStars: 1,
    totalStars: 3
  });
  assert.equal(unlockedIds(fixture).includes("round_two"), false);
  fixture.api.onLevelCompleted({
    levelNumber: 200,
    biomeId: biomeIds.at(-1),
    collectedStars: 1,
    totalStars: 3
  });
  assert.equal(unlockedIds(fixture).includes("round_two"), true);
  assert.equal(unlockedIds(fixture).includes("worlds_end"), true);
  fixture.api.onLevelStart({levelNumber: 201, biomeId: biomeIds[0]});
  assert.equal(fixture.api.getProgress().discoveredBiomeIds.length, 20);
}

function assertGoldOwnedAndMasteryAreSeparate() {
  const fixture = loadAchievements();
  fixture.gold.ownsSlime = true;
  fixture.api.checkState();
  assert.equal(unlockedIds(fixture).includes("golden_ticket"), true);
  assert.equal(unlockedIds(fixture).includes("true_alchemy"), false);

  fixture.gold.slimeMastery = true;
  fixture.gold.hatMastery = true;
  fixture.gold.beardMastery = true;
  fixture.api.checkState();
  for (const id of ["true_alchemy", "crowned_in_gold", "beard_of_midas", "all_that_glitters"]) {
    assert.ok(unlockedIds(fixture).includes(id));
  }
}

function assertTwoOfThreeUsesTheRealStarLayout() {
  const fixture = loadAchievements();
  fixture.api.onLevelCompleted({
    levelNumber: 1,
    biomeId: "meadow",
    collectedStars: 1,
    totalStars: 3
  });
  assert.equal(unlockedIds(fixture).includes("two_out_of_three"), false);
  fixture.api.onLevelCompleted({
    levelNumber: 2,
    biomeId: "meadow",
    collectedStars: 2,
    totalStars: 3
  });
  assert.equal(unlockedIds(fixture).includes("two_out_of_three"), true);
}

function assertMasterKevinChain() {
  const fixture = loadAchievements();
  const requiredIds = fixture.api.registry
    .map(achievement => achievement.id)
    .filter(id => id !== "achievement_hunter" && id !== "ein_richtiger_kevin");
  assert.equal(requiredIds.length, 99);
  requiredIds.slice(0, -1).forEach(id => fixture.api.unlock(id));
  assert.equal(unlockedIds(fixture).includes("achievement_hunter"), false);
  assert.equal(unlockedIds(fixture).includes("ein_richtiger_kevin"), false);

  fixture.api.unlock(requiredIds.at(-1));
  const unlocks = fixture.api.getUnlocked();
  const hunter = unlocks.find(unlock => unlock.id === "achievement_hunter");
  const kevin = unlocks.find(unlock => unlock.id === "ein_richtiger_kevin");
  assert.ok(hunter);
  assert.ok(kevin);
  assert.ok(hunter.unlockedAt < kevin.unlockedAt);

  const negative = loadAchievements();
  const missingId = "slime_scholar";
  negative.api.registry
    .map(achievement => achievement.id)
    .filter(id => id !== "ein_richtiger_kevin" && id !== missingId)
    .forEach(id => negative.api.unlock(id));
  assert.equal(unlockedIds(negative).includes("ein_richtiger_kevin"), false);
}

function assertUiAndResetCompatibility() {
  const html = read("index.html");
  const source = read("js/slime-achievements.js");
  const prestige = read("js/slime-prestige.js");
  const reset = read("js/slime-progress-reset.js");
  assert.match(html, /id="achievementProgressText">0 \/ 101 freigeschaltet/);
  assert.doesNotMatch(html, /achievementProgressText[^<]*\/ 51/);
  assert.match(source, /ACHIEVEMENT_REGISTRY\.length/);
  assert.match(source, /filter\(achievement => achievement\.id !== "ein_richtiger_kevin"\)/);
  assert.match(source, /for \(let pass = 0; pass < 3; pass\+\+\)/);
  assert.match(prestige, /ACHIEVEMENT_PROGRESS_DEFAULT/);
  assert.match(prestige, /slimejumperAchievements: JSON\.stringify\(\[\]\)/);
  assert.match(source, /const ACHIEVEMENT_PROGRESS_VERSION = "achievements-v1"/);
  assert.match(reset, /achievements-v1/);
}

assertRegistryContract();
assertLegacyUnlockPreservation();
assertWorldTravelerUsesAllTwentyBiomes();
assertPlayerLevelAndPrestigeStateChecks();
assertDynamicPerfectAndDeathFreeBiomeTargets();
assertRotationCompletesAtLevelTwoHundred();
assertGoldOwnedAndMasteryAreSeparate();
assertTwoOfThreeUsesTheRealStarLayout();
assertMasterKevinChain();
assertUiAndResetCompatibility();

console.log("Achievement expansion tests passed.");
