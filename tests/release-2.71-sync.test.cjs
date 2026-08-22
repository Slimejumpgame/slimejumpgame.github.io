"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const wwwRoot = path.join(projectRoot, "www");
const androidRoot = path.join(
  projectRoot,
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public"
);
const read = (base, relativePath) =>
  fs.readFileSync(path.join(base, relativePath), "utf8");
const hash = filePath => crypto
  .createHash("sha256")
  .update(fs.readFileSync(filePath))
  .digest("hex");
const extract = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source block: ${start}`);
  return source.slice(startIndex, endIndex);
};
const listFiles = base => {
  const results = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else results.push(path.relative(base, absolutePath).replace(/\\/g, "/"));
    }
  };
  visit(base);
  return results.sort();
};

const releaseRuntimeFiles = Object.freeze([
  "css/style.css",
  "index.html",
  "js/audio.js",
  "js/biomes.js",
  "js/core.js",
  "js/game.js",
  "js/renderer.js",
  "js/slime-achievements.js",
  "js/slime-beards.js",
  "js/slime-colors.js",
  "js/slime-cosmetics.js",
  "js/slime-gold.js",
  "js/slime-jump-highscores.js",
  "js/slime-perks.js",
  "js/slime-player-progress.js",
  "js/slime-prestige.js",
  "js/slime-progress-reset.js",
  "js/slime-wardrobe.js",
  "js/ui.js"
]);

for (const relativePath of releaseRuntimeFiles) {
  const rootPath = path.join(projectRoot, relativePath);
  const wwwPath = path.join(wwwRoot, relativePath);
  const androidPath = path.join(androidRoot, relativePath);
  assert.equal(hash(wwwPath), hash(rootPath), `Root/www mismatch: ${relativePath}`);
  assert.equal(hash(androidPath), hash(wwwPath), `www/Android mismatch: ${relativePath}`);
}

const wwwFiles = listFiles(wwwRoot);
for (const relativePath of wwwFiles) {
  const androidPath = path.join(androidRoot, relativePath);
  assert.equal(fs.existsSync(androidPath), true, `Android asset missing: ${relativePath}`);
  assert.equal(
    hash(androidPath),
    hash(path.join(wwwRoot, relativePath)),
    `www/Android mismatch: ${relativePath}`
  );
}

const gradle = read(projectRoot, "android/app/build.gradle");
assert.match(gradle, /versionCode 16/);
assert.match(gradle, /versionName "2\.71"/);
const publishedUpdate = JSON.parse(read(projectRoot, "android-update.json"));
assert.equal(publishedUpdate.android.versionCode, 15);
assert.equal(publishedUpdate.android.versionName, "2.70");

const index = read(androidRoot, "index.html");
const biomes = read(androidRoot, "js/biomes.js");
const biomeBlock = extract(biomes, "  const BIOMES = [", "  function getBiomeForLevel");
const biomeIds = [...biomeBlock.matchAll(/^\s+id: "([^"]+)",$/gm)]
  .map(match => match[1]);
assert.equal(biomeIds.length, 20);
assert.equal(new Set(biomeIds).size, 20);
assert.deepEqual(biomeIds.slice(10), [
  "stormNight",
  "neonCity",
  "mushroomCave",
  "abandonedMine",
  "bambooNight",
  "pirateHarbor",
  "alienJungle",
  "enchantedGarden",
  "redMoon",
  "undergroundTemple"
]);
const biomeAtLevel = level => biomeIds[Math.floor((level - 1) / 10) % biomeIds.length];
assert.equal(biomeAtLevel(101), "stormNight");
assert.equal(biomeAtLevel(200), "undergroundTemple");
assert.equal(biomeAtLevel(201), "meadow");
assert.match(
  biomes,
  /Math\.floor\(\(normalizedLevel - 1\) \/ 10\) % BIOMES\.length/
);

const audio = read(androidRoot, "js/audio.js");
const newMusicThemeIds = [
  "stormNight",
  "neonCity",
  "mushroomCave",
  "abandonedMine",
  "bambooNight",
  "pirateHarbor",
  "alienJungle",
  "enchantedGarden",
  "redMoon",
  "undergroundTemple"
];
for (const themeId of newMusicThemeIds) {
  assert.match(audio, new RegExp(`^    ${themeId}: \\{`, "m"));
}
assert.match(
  audio,
  /function playLaunch\(\) \{ tone\(240, 0\.12, "triangle", 0\.0924, 520\); \}/
);

const gold = read(androidRoot, "js/slime-gold.js");
assert.match(gold, /const GOLD_PROGRESS_STORAGE_KEY = "slimejumperGoldProgressV1";/);
assert.match(gold, /const GOLD_SLIME_STAR_PRICE = 5000;/);
assert.match(gold, /const GOLD_SHOP_ITEM_STAR_PRICE = 1000;/);
assert.match(gold, /const GOLD_MASTERY_LEVEL_REQUIREMENT = 500;/);
assert.match(gold, /const GOLD_MASTERY_DISTINCT_REQUIREMENT = 5;/);
const goldView = extract(
  index,
  '<section id="wardrobeGoldView"',
  '<section id="wardrobePrestigeView"'
);
assert.equal((goldView.match(/data-gold-category=/g) ?? []).length, 2);
assert.match(goldView, /data-gold-category="hats"/);
assert.match(goldView, /data-gold-category="beards"/);
assert.doesNotMatch(goldView, /data-gold-category="slime"/);
const ui = read(androidRoot, "js/ui.js");
assert.match(ui, /slimejumperSkipGoldShopIntro/);

const prestige = read(androidRoot, "js/slime-prestige.js");
const prestigePackages = extract(
  prestige,
  "  const PRESTIGE_REWARD_PACKAGES = Object.freeze({",
  "  const PRESTIGE_DEFINITIONS = Object.freeze(["
);
assert.equal((prestigePackages.match(/Object\.freeze\(\{type:/g) ?? []).length, 32);
assert.match(index, /id="wardrobePrestigeView"/);
assert.match(ui, /const hasEmblem = prestigeLevel > 0;/);
assert.match(ui, /classList\.toggle\("prestigeInvisible", !hasEmblem\)/);
assert.match(ui, /menuPrestigeEmblem\.innerHTML = hasEmblem[\s\S]*?: "";/);

const achievements = read(androidRoot, "js/slime-achievements.js");
const registry = extract(
  achievements,
  "  const ACHIEVEMENT_REGISTRY = Object.freeze([",
  "  const NEW_BIOME_IDS = Object.freeze(["
);
const achievementIds = [...registry.matchAll(/Object\.freeze\(\{id: "([^"]+)"/g)]
  .map(match => match[1]);
assert.equal(achievementIds.length, 101);
assert.equal(new Set(achievementIds).size, 101);
assert.equal((registry.match(/secret: true/g) ?? []).length, 15);
assert.match(
  registry,
  /id: "ein_richtiger_kevin"[\s\S]*?name: "EIN RICHTIGER KEVIN"/
);
assert.match(
  achievements,
  /existingBiomeIds\.every\(existingId =>[\s\S]*?achievementProgress\.discoveredBiomeIds\.includes\(existingId\)[\s\S]*?unlockAchievement\("world_traveler"\)/
);
assert.match(achievements, /const LEVELS_PER_BIOME = 10;/);
assert.match(
  achievements,
  /const rotationLevelCount = getExistingBiomeIds\(\)\.length \* LEVELS_PER_BIOME;/
);

const core = read(androidRoot, "js/core.js");
assert.match(
  core,
  /personalGlobalRankValue: document\.getElementById\("personalGlobalRankValue"\)/
);
assert.match(index, /id="personalGlobalRankValue"/);
const css = read(androidRoot, "css/style.css");
assert.match(
  css,
  /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?#mainMenuScreen \.menuStatusBadge--rank\s*\{[\s\S]*?border-radius: clamp\(9px, 2\.5dvh, 13px\);[\s\S]*?background: rgba\(16, 28, 45, 0\.82\);/
);
const highscores = read(androidRoot, "js/slime-jump-highscores.js");
assert.match(highscores, /const GAME_VERSION = "2\.71";/);

const reset = read(androidRoot, "js/slime-progress-reset.js");
const migration = read(androidRoot, "js/slime-perk-migration.js");
assert.match(reset, /const RESET_VERSION = "progress-reset-2\.43";/);
assert.match(reset, /const PREFERENCE_RESET_VERSION = "preferences-reset-2\.58";/);
assert.match(migration, /const MIGRATION_VERSION = "perk-migration-2\.65";/);

console.log(
  `v2.71 release sync tests passed (${wwwFiles.length} web assets, ` +
  `${biomeIds.length} biomes, ${newMusicThemeIds.length} new music themes, ` +
  `${achievementIds.length} achievements).`
);
