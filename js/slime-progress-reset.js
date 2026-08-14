(() => {
  "use strict";

  const RESET_MARKER_STORAGE_KEY = "slimejumperGlobalProgressResetVersion";
  const RESET_VERSION = "progress-reset-2.43";

  const PROGRESS_STORAGE_KEYS = Object.freeze([
    "slimejumperUnlockedSlimeColors",
    "slimejumperSelectedSlimeColor",
    "slimejumperUnlockedSlimeCosmetics",
    "slimejumperSelectedSlimeCosmetic",
    "slimejumperUnlockedSlimeBeards",
    "slimejumperSelectedSlimeBeard",
    "slimejumperPendingWardrobeUnlockChoices",
    "slimejumperActiveRunRecovery",
    "slimejumperHighestCheckpointLevel",
    "slimejumperWardrobeProgressVersion",
    "slimejumperAchievements",
    "slimejumperAchievementProgress",
    "slimejumperAchievementProgressVersion",
    "slimejumperSelectedAchievementBadges",
    "slimejumperStarBalance",
    "slimejumperStarEconomyVersion",
    "slimejumperBest",
    "slimejumperBestLevel",
    "slimejumperRecentScores",
    "slimejumperHighscoresV14"
  ]);

  const START_DEFAULTS = Object.freeze({
    slimejumperUnlockedSlimeColors: JSON.stringify(["green"]),
    slimejumperSelectedSlimeColor: "green",
    slimejumperUnlockedSlimeCosmetics: JSON.stringify([]),
    slimejumperSelectedSlimeCosmetic: "none",
    slimejumperUnlockedSlimeBeards: JSON.stringify([]),
    slimejumperSelectedSlimeBeard: "none",
    slimejumperPendingWardrobeUnlockChoices: "0",
    slimejumperHighestCheckpointLevel: "0",
    slimejumperWardrobeProgressVersion: "unified-wardrobe-v1",
    slimejumperAchievements: JSON.stringify([]),
    slimejumperAchievementProgress: JSON.stringify({
      discoveredBiomeIds: [],
      perfectBiomeIds: [],
      deathFreeBiomeIds: [],
      completedLookIds: [],
      lifetimeStars: 0,
      lifetimeAirTime: 0,
      lifetimeCompletedLevels: 0,
      lifetimeDeaths: 0,
      lifetimePerfects: 0
    }),
    slimejumperAchievementProgressVersion: "achievements-v1",
    slimejumperSelectedAchievementBadges: JSON.stringify([]),
    slimejumperStarBalance: "0",
    slimejumperStarEconomyVersion: "star-economy-v1",
    slimejumperBest: "0",
    slimejumperBestLevel: "0",
    slimejumperRecentScores: JSON.stringify([]),
    slimejumperHighscoresV14: JSON.stringify([])
  });

  try {
    if (localStorage.getItem(RESET_MARKER_STORAGE_KEY) === RESET_VERSION) return;

    PROGRESS_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    Object.entries(START_DEFAULTS).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    // Erst nach einem vollstaendigen Wipe markieren, damit ein Teilfehler
    // beim naechsten Start sicher erneut versucht wird.
    localStorage.setItem(RESET_MARKER_STORAGE_KEY, RESET_VERSION);
  } catch (_) {}
})();

(() => {
  "use strict";

  const PREFERENCE_RESET_MARKER_STORAGE_KEY =
    "slimejumperPreferenceResetVersion";
  const PREFERENCE_RESET_VERSION = "preferences-reset-2.54";
  const PREFERENCE_STORAGE_KEYS = Object.freeze([
    "slimejumperSkipTutorial",
    "slimejumperSkipEndRunWarning",
    "slimejumperSkipCheckpointIntro"
  ]);

  try {
    if (
      localStorage.getItem(PREFERENCE_RESET_MARKER_STORAGE_KEY) ===
      PREFERENCE_RESET_VERSION
    ) return;

    PREFERENCE_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(
      PREFERENCE_RESET_MARKER_STORAGE_KEY,
      PREFERENCE_RESET_VERSION
    );
  } catch (_) {}
})();
