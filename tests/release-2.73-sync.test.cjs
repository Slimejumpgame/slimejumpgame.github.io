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
const requestedPhase = process.argv[2] || "--all";
assert.ok(
  ["--root-www", "--android", "--all"].includes(requestedPhase),
  `unknown release sync phase: ${requestedPhase}`
);
const runRootWwwContract = requestedPhase !== "--android";
const runAndroidContract = requestedPhase !== "--root-www";
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

const ROOT_TOP_LEVEL_FILES = Object.freeze([
  "apple-touch-icon.png",
  "datenschutz.html",
  "index.html",
  "manifest.json",
  "slime-icon-192.png",
  "slime-icon-512.png",
  "slime_icon.png"
]);
const ROOT_PAYLOAD_DIRECTORIES = Object.freeze(["assets", "css", "js"]);
const WWW_GENERATED_ALLOWLIST = Object.freeze([]);
const ANDROID_GENERATED_ALLOWLIST = Object.freeze([
  "cordova.js",
  "cordova_plugins.js"
]);
const REQUIRED_RUNTIME_FILES = Object.freeze([
  "css/style.css",
  "index.html",
  "js/audio.js",
  "js/biomes.js",
  "js/core.js",
  "js/enemies.js",
  "js/game.js",
  "js/hazards.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/renderer.js",
  "js/slime-achievements.js",
  "js/slime-beards.js",
  "js/slime-checkpoint-bonus.js",
  "js/slime-colors.js",
  "js/slime-cosmetics.js",
  "js/slime-gold.js",
  "js/slime-jump-highscores.js",
  "js/slime-jump-player-bests.js",
  "js/slime-perks.js",
  "js/slime-perk-migration.js",
  "js/slime-player-progress.js",
  "js/slime-prestige.js",
  "js/slime-progress-reset.js",
  "js/slime-run-recovery.js",
  "js/slime-wardrobe.js",
  "js/tutorials.js",
  "js/ui.js"
]);
const PRE_VISUAL_UPDATE_PNG_FILES = Object.freeze([
  "assets/tutorial/slime_adventure_how_to_play.png",
  "assets/tutorial/tutorial-drag-hand.png",
  "assets/ui/howto_scrollbar_slime.png"
]);
const SPLIT_PLATFORM_FALLBACK_FILES = Object.freeze([
  "assets/platforms/conveyor_left.png",
  "assets/platforms/conveyor_middle.png",
  "assets/platforms/conveyor_right.png",
  "assets/platforms/falling_platform_left.png",
  "assets/platforms/falling_platform_middle.png",
  "assets/platforms/falling_platform_right.png",
  "assets/platforms/ice_platform_left.png",
  "assets/platforms/ice_platform_middle.png",
  "assets/platforms/ice_platform_right.png"
]);

const rootPayloadFiles = [
  ...ROOT_TOP_LEVEL_FILES,
  ...ROOT_PAYLOAD_DIRECTORIES.flatMap(directory =>
    listFiles(path.join(projectRoot, directory))
      .map(relativePath => `${directory}/${relativePath}`)
  )
].sort();
assert.equal(new Set(rootPayloadFiles).size, rootPayloadFiles.length);

for (const relativePath of REQUIRED_RUNTIME_FILES) {
  assert.ok(rootPayloadFiles.includes(relativePath), `Root runtime file missing: ${relativePath}`);
}

const visualModuleFiles = rootPayloadFiles
  .filter(relativePath => /^js\/visual-.*\.js$/.test(relativePath));
assert.equal(visualModuleFiles.length, 23, "Root must contain all 23 visual modules");

const assetPngFiles = rootPayloadFiles
  .filter(relativePath => /^assets\/.*\.png$/i.test(relativePath));
for (const relativePath of PRE_VISUAL_UPDATE_PNG_FILES) {
  assert.ok(assetPngFiles.includes(relativePath), `Pre-visual PNG missing: ${relativePath}`);
}
const visualUpdatePngFiles = assetPngFiles
  .filter(relativePath => !PRE_VISUAL_UPDATE_PNG_FILES.includes(relativePath));
assert.equal(visualUpdatePngFiles.length, 511, "Root must contain all 511 visual-update PNGs");
for (const relativePath of SPLIT_PLATFORM_FALLBACK_FILES) {
  assert.ok(rootPayloadFiles.includes(relativePath), `Split fallback missing: ${relativePath}`);
}

const assertExactMirror = ({sourceRoot, sourceFiles, targetRoot, targetAllowlist, label}) => {
  const allowed = new Set(targetAllowlist);
  const targetFiles = listFiles(targetRoot);
  const mirroredTargetFiles = targetFiles.filter(relativePath => !allowed.has(relativePath));
  assert.deepEqual(mirroredTargetFiles, sourceFiles, `${label} inventory mismatch`);

  for (const relativePath of sourceFiles) {
    assert.equal(
      hash(path.join(targetRoot, relativePath)),
      hash(path.join(sourceRoot, relativePath)),
      `${label} SHA-256 mismatch: ${relativePath}`
    );
  }
  return targetFiles;
};

const wwwFiles = listFiles(wwwRoot);
if (runRootWwwContract) {
  assertExactMirror({
    sourceRoot: projectRoot,
    sourceFiles: rootPayloadFiles,
    targetRoot: wwwRoot,
    targetAllowlist: WWW_GENERATED_ALLOWLIST,
    label: "Root/www"
  });
}
if (runAndroidContract) {
  assertExactMirror({
    sourceRoot: wwwRoot,
    sourceFiles: wwwFiles,
    targetRoot: androidRoot,
    targetAllowlist: ANDROID_GENERATED_ALLOWLIST,
    label: "www/Android"
  });
}

const gradle = read(projectRoot, "android/app/build.gradle");
assert.match(gradle, /versionCode 18/);
assert.match(gradle, /versionName "2\.73"/);
const publishedUpdate = JSON.parse(read(projectRoot, "android-update.json"));
assert.equal(publishedUpdate.android.versionCode, 18);
assert.equal(publishedUpdate.android.versionName, "2.73");

const index = read(projectRoot, "index.html");
const biomes = read(projectRoot, "js/biomes.js");
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

const audio = read(projectRoot, "js/audio.js");
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

const gold = read(projectRoot, "js/slime-gold.js");
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
const ui = read(projectRoot, "js/ui.js");
assert.match(ui, /slimejumperSkipGoldShopIntro/);

const prestige = read(projectRoot, "js/slime-prestige.js");
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

const achievements = read(projectRoot, "js/slime-achievements.js");
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

const core = read(projectRoot, "js/core.js");
assert.match(
  core,
  /personalGlobalRankValue: document\.getElementById\("personalGlobalRankValue"\)/
);
assert.match(index, /id="personalGlobalRankValue"/);
const css = read(projectRoot, "css/style.css");
assert.match(
  css,
  /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?#mainMenuScreen \.menuStatusBadge--rank\s*\{[\s\S]*?border-radius: clamp\(9px, 2\.5dvh, 13px\);[\s\S]*?background: rgba\(16, 28, 45, 0\.82\);/
);
const highscores = read(projectRoot, "js/slime-jump-highscores.js");
assert.match(highscores, /const GAME_VERSION = "2\.73";/);

const reset = read(projectRoot, "js/slime-progress-reset.js");
const migration = read(projectRoot, "js/slime-perk-migration.js");
assert.match(reset, /const RESET_VERSION = "progress-reset-2\.43";/);
assert.match(reset, /const PREFERENCE_RESET_VERSION = "preferences-reset-2\.58";/);
assert.match(migration, /const MIGRATION_VERSION = "perk-migration-2\.65";/);

console.log(
  `v2.73 release sync ${requestedPhase} passed (${rootPayloadFiles.length} web files, ` +
  `${visualModuleFiles.length} visual modules, ${visualUpdatePngFiles.length} visual PNGs, ` +
  `${biomeIds.length} biomes, ${newMusicThemeIds.length} new music themes, ` +
  `${achievementIds.length} achievements).`
);
