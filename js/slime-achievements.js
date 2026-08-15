(() => {
  "use strict";

  const ACHIEVEMENTS_STORAGE_KEY = "slimejumperAchievements";
  const SELECTED_ACHIEVEMENT_BADGES_STORAGE_KEY =
    "slimejumperSelectedAchievementBadges";
  const CALLING_CARD_BADGE_LIMIT = 5;
  const ACHIEVEMENT_PROGRESS_STORAGE_KEY = "slimejumperAchievementProgress";
  const ACHIEVEMENT_PROGRESS_VERSION_STORAGE_KEY = "slimejumperAchievementProgressVersion";
  const ACHIEVEMENT_PROGRESS_VERSION = "achievements-v1";
  const STAR_BALANCE_STORAGE_KEY = "slimejumperStarBalance";
  const STAR_ECONOMY_VERSION_STORAGE_KEY = "slimejumperStarEconomyVersion";
  const STAR_ECONOMY_VERSION = "star-economy-v1";
  const WARDROBE_ITEM_STAR_PRICE = 250;
  const DEV_SHOP_TEST_INITIAL_BALANCE = 1000;

  const ACHIEVEMENT_REGISTRY = Object.freeze([
    Object.freeze({id: "hp_gen", icon: "❤️", name: "HP GEN", description: "Schaffe 3 Perfects direkt hintereinander.", secret: false}),
    Object.freeze({id: "perfectionist", icon: "🎯", name: "PERFECTIONIST", description: "Schaffe 5 Perfects direkt hintereinander.", secret: false}),
    Object.freeze({id: "untouchable", icon: "🔥", name: "UNTOUCHABLE", description: "Schaffe 10 Perfects direkt hintereinander.", secret: false}),
    Object.freeze({id: "starstruck", icon: "⭐", name: "STARSTRUCK", description: "Sammle 50 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "star_hoarder", icon: "🌟", name: "STAR HOARDER", description: "Sammle 100 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "galaxy_brain", icon: "💫", name: "GALAXY BRAIN", description: "Sammle 200 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "not_today", icon: "😅", name: "NOT TODAY", description: "Schließe ein Level mit kritisch wenig Slime-Health ab.", secret: false}),
    Object.freeze({id: "clean_run", icon: "🧼", name: "CLEAN RUN", description: "Schließe 10 Level hintereinander ab, ohne zu sterben.", secret: false}),
    Object.freeze({id: "ghostbuster", icon: "👻", name: "GHOSTBUSTER", description: "Schließe ein Geister-Level ab, ohne von einem Geist getroffen zu werden.", secret: false}),
    Object.freeze({id: "speed_slime", icon: "⚡", name: "SPEED SLIME", description: "Schließe ein Level in höchstens 5 Sekunden ab.", secret: false}),
    Object.freeze({id: "bounce_master", icon: "🛝", name: "BOUNCE MASTER", description: "Nutze 3 Bounce-Pads in Folge, ohne normal zu landen.", secret: false}),
    Object.freeze({id: "ice_cold", icon: "🧊", name: "ICE COLD", description: "Schließe ein Schneewelt-Level ab, ohne zu sterben.", secret: false}),
    Object.freeze({id: "hot_stuff", icon: "🌋", name: "HOT STUFF", description: "Schließe ein Vulkan-Level ab, ohne zu sterben.", secret: false}),
    Object.freeze({id: "head_in_the_clouds", icon: "☁️", name: "HEAD IN THE CLOUDS", description: "Erreiche erstmals die Himmelswelt.", secret: false}),
    Object.freeze({id: "world_traveler", icon: "🌍", name: "WORLD TRAVELER", description: "Erreiche alle existierenden Biome.", secret: false}),
    Object.freeze({id: "round_two", icon: "🔁", name: "ROUND TWO", description: "Durchlaufe eine komplette Biomrotation und erreiche erneut das erste Biom.", secret: false}),
    Object.freeze({id: "fashion_slime", icon: "👑", name: "FASHION SLIME", description: "Schalte mindestens ein normales Cosmetic frei.", secret: false}),
    Object.freeze({id: "glorious_beard", icon: "🧔", name: "GLORIOUS BEARD", description: "Schalte mindestens einen Bart frei.", secret: false}),
    Object.freeze({id: "dressed_to_slime", icon: "🎩", name: "DRESSED TO SLIME", description: "Trage gleichzeitig ein Cosmetic und einen Bart.", secret: false}),
    Object.freeze({id: "wardrobe_warrior", icon: "🛍️", name: "WARDROBE WARRIOR", description: "Besitze mindestens 25 freischaltbare Wardrobe-Items.", secret: false}),
    Object.freeze({id: "rainbow_slime", icon: "🌈", name: "RAINBOW SLIME", description: "Schalte alle vorhandenen Slime-Farben frei.", secret: false}),
    Object.freeze({id: "perfect_clear", icon: "✅", name: "PERFECT CLEAR", description: "Sammle alle Sterne eines Levels und erreiche das Ziel.", secret: false}),
    Object.freeze({id: "long_haul", icon: "🚚", name: "LONG HAUL", description: "Schließe 25 Level in einem Run ab.", secret: false}),
    Object.freeze({id: "empty_handed", icon: "🕳️", name: "EMPTY HANDED", description: "Schließe ein Level ab, ohne einen Stern einzusammeln.", secret: false}),
    Object.freeze({id: "full_wardrobe", icon: "🎨", name: "FULL WARDROBE", description: "Schalte deine komplette Wardrobe frei.", secret: false}),
    Object.freeze({id: "fashion_icon", icon: "🕶️", name: "FASHION ICON", description: "Schalte alle Cosmetics frei.", secret: false}),
    Object.freeze({id: "beard_baron", icon: "🤴", name: "BEARD BARON", description: "Schalte alle Bärte frei.", secret: false}),
    Object.freeze({id: "marathon_slime", icon: "🏃", name: "MARATHON SLIME", description: "Schließe 50 Level in einem Run ab.", secret: false}),
    Object.freeze({id: "century_slime", icon: "💯", name: "CENTURY SLIME", description: "Schließe 100 Level in einem Run ab.", secret: false}),
    Object.freeze({id: "clean_machine", icon: "⚙️", name: "CLEAN MACHINE", description: "Schließe 25 Level hintereinander ohne Tod ab.", secret: false}),
    Object.freeze({id: "ghost_whisperer", icon: "🔮", name: "GHOST WHISPERER", description: "Schaffe 5 Geister-Level in einem Run ohne getroffen zu werden.", secret: false}),
    Object.freeze({id: "bounce_addict", icon: "🏀", name: "BOUNCE ADDICT", description: "Schaffe 10 Bounce-Kontakte ohne normale Landung.", secret: false}),
    Object.freeze({id: "perfect_tourist", icon: "📸", name: "PERFECT TOURIST", description: "Schaffe in jedem Biom mindestens ein Perfect.", secret: false}),
    Object.freeze({id: "biome_master", icon: "🗺️", name: "BIOME MASTER", description: "Schließe jedes Biom mindestens einmal ohne Tod ab.", secret: false}),
    Object.freeze({id: "speed_demon", icon: "😈", name: "SPEED DEMON", description: "Schaffe 3 Level in einem Run in höchstens 5 Sekunden.", secret: false}),
    Object.freeze({id: "clean_sweep", icon: "🧹", name: "CLEAN SWEEP", description: "Schaffe 3 Perfect Clears in einem Run.", secret: false}),
    Object.freeze({id: "star_magnet", icon: "🧲", name: "STAR MAGNET", description: "Sammle 300 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "star_bank", icon: "🏦", name: "STAR BANK", description: "Sammle insgesamt 1.000 Sterne.", secret: false}),
    Object.freeze({id: "frequent_flyer", icon: "✈️", name: "FREQUENT FLYER", description: "Verbringe insgesamt 60 Sekunden in der Luft.", secret: false}),
    Object.freeze({id: "style_master", icon: "✨", name: "STYLE MASTER", description: "Beende 10 Level mit 10 verschiedenen Looks.", secret: false}),
    Object.freeze({id: "perfect_25", icon: "🏅", name: "PERFECT 25", description: "Schaffe insgesamt 25 Perfects.", secret: false}),
    Object.freeze({id: "veteran_slime", icon: "🏁", name: "VETERAN SLIME", description: "Schließe insgesamt 100 Level ab.", secret: false}),
    Object.freeze({id: "ouch", icon: "💀", name: "OUCH!", description: "Stirb insgesamt 25-mal.", secret: false}),
    Object.freeze({id: "achievement_hunter", icon: "🏆", name: "ACHIEVEMENT HUNTER", description: "Schalte alle anderen Achievements frei.", secret: false}),
    Object.freeze({id: "secret_one_shot", icon: "🏹", name: "ONE SHOT WONDER", description: "Schaffe ein Level mit nur einem Schuss.", secret: true}),
    Object.freeze({id: "secret_star_sniper", icon: "🌠", name: "STAR SNIPER", description: "Sammle 3 Sterne mit einem einzigen Schuss.", secret: true}),
    Object.freeze({id: "secret_second_chance", icon: "🩹", name: "SECOND CHANCE", description: "Nutze deine zweite Chance und erreiche trotzdem das Ziel.", secret: true}),
    Object.freeze({id: "secret_air_time", icon: "🛸", name: "AIR TIME", description: "Bleib 5 Sekunden in der Luft und lande sicher.", secret: true}),
    Object.freeze({id: "secret_ragequitter", icon: "🤬", name: "RAGEQUITTER", description: "Stirb 3-mal innerhalb von 5 Sekunden.", secret: true}),
    Object.freeze({id: "secret_groundhog_slime", icon: "⏰", name: "GROUNDHOG SLIME", description: "Stirb 5-mal im selben Level und schaffe es danach trotzdem.", secret: true}),
    Object.freeze({id: "secret_take_your_time", icon: "🐌", name: "TAKE YOUR TIME", description: "Schließe ein Level erst nach 120 Sekunden ohne Tod ab.", secret: true})
  ]);

  const ACHIEVEMENT_BY_ID = new Map(
    ACHIEVEMENT_REGISTRY.map(achievement => [achievement.id, achievement])
  );

  function safeParseStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function loadAchievementUnlocks() {
    const stored = safeParseStorage(ACHIEVEMENTS_STORAGE_KEY, []);
    if (!Array.isArray(stored)) return [];

    const validById = new Map();
    for (const entry of stored) {
      const id = String(entry?.id ?? "");
      const unlockedAt = Math.floor(Number(entry?.unlockedAt));
      if (!ACHIEVEMENT_BY_ID.has(id) || !Number.isFinite(unlockedAt) || unlockedAt <= 0) {
        continue;
      }
      const previous = validById.get(id);
      if (!previous || unlockedAt > previous.unlockedAt) {
        validById.set(id, {id, unlockedAt});
      }
    }
    return [...validById.values()];
  }

  function getExistingBiomeIds() {
    if (typeof BIOMES === "undefined" || !Array.isArray(BIOMES)) return [];
    return BIOMES.map(biome => String(biome.id));
  }

  function getNonNegativeInteger(value) {
    const numericValue = Math.floor(Number(value));
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
  }

  function getNonNegativeNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
  }

  function getStoredBiomeIds(value, existingBiomeIds) {
    if (!Array.isArray(value)) return [];
    return [...new Set(
      value
        .map(id => String(id))
        .filter(id => existingBiomeIds.has(id))
    )];
  }

  function isRegisteredLookKey(value) {
    if (
      typeof SLIME_COLOR_ORDER === "undefined" ||
      typeof SLIME_COSMETIC_ORDER === "undefined" ||
      typeof SLIME_BEARD_ORDER === "undefined"
    ) {
      return false;
    }
    const parts = String(value).split("|");
    return parts.length === 3 &&
      SLIME_COLOR_ORDER.includes(parts[0]) &&
      SLIME_COSMETIC_ORDER.includes(parts[1]) &&
      SLIME_BEARD_ORDER.includes(parts[2]);
  }

  function loadAchievementProgress() {
    const stored = safeParseStorage(ACHIEVEMENT_PROGRESS_STORAGE_KEY, {});
    const existingBiomeIds = new Set(getExistingBiomeIds());
    const completedLookIds = Array.isArray(stored?.completedLookIds)
      ? [...new Set(
          stored.completedLookIds
            .map(lookId => String(lookId))
            .filter(isRegisteredLookKey)
        )]
      : [];
    return {
      discoveredBiomeIds: getStoredBiomeIds(stored?.discoveredBiomeIds, existingBiomeIds),
      perfectBiomeIds: getStoredBiomeIds(stored?.perfectBiomeIds, existingBiomeIds),
      deathFreeBiomeIds: getStoredBiomeIds(stored?.deathFreeBiomeIds, existingBiomeIds),
      completedLookIds,
      lifetimeStars: getNonNegativeInteger(stored?.lifetimeStars),
      lifetimeAirTime: getNonNegativeNumber(stored?.lifetimeAirTime),
      lifetimeCompletedLevels: getNonNegativeInteger(stored?.lifetimeCompletedLevels),
      lifetimeDeaths: getNonNegativeInteger(stored?.lifetimeDeaths),
      lifetimePerfects: getNonNegativeInteger(stored?.lifetimePerfects)
    };
  }

  let unlockedAchievements = loadAchievementUnlocks();
  const unlockedById = new Map(
    unlockedAchievements.map(unlock => [unlock.id, unlock])
  );
  let selectedAchievementBadges = loadSelectedAchievementBadges();
  let devCallingCardPreview = null;
  let lastUnlockTimestamp = unlockedAchievements.reduce(
    (latest, unlock) => Math.max(latest, unlock.unlockedAt),
    0
  );
  const achievementProgress = loadAchievementProgress();
  let starBalance = loadStarBalance();
  const popupQueue = [];
  const recentDeathTimestamps = [];
  const activeWardrobePurchases = new Set();
  const devShopTestUnlocks = new Set();
  let devShopTestActive = false;
  let devShopTestBalance = DEV_SHOP_TEST_INITIAL_BALANCE;
  let popupActive = false;
  let popupGeneration = 0;
  let runProgressSnapshot = null;

  const runState = {
    perfectStreak: 0,
    cleanLevelStreak: 0,
    completedLevels: 0,
    ghostCleanLevels: 0,
    speedLevels: 0,
    perfectClearLevels: 0,
    runStars: 0,
    runBiomeIds: new Set(),
    rotationComplete: false,
    previousBiomeId: null,
    previousLevelNumber: 0,
    levelNumber: 1,
    biomeId: null,
    levelElapsed: 0,
    levelHadDeath: false,
    levelHasGhost: false,
    ghostHit: false,
    bounceStreak: 0,
    levelShots: 0,
    shotActive: false,
    starsSinceShot: 0,
    airTime: 0,
    lifetimeAirTimePending: 0,
    rescueUsed: false,
    groundhogLevelNumber: null,
    groundhogDeaths: 0
  };

  function saveAchievementUnlocks() {
    try {
      localStorage.setItem(
        ACHIEVEMENTS_STORAGE_KEY,
        JSON.stringify(unlockedAchievements)
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveAchievementProgress({writeVersion = true} = {}) {
    try {
      localStorage.setItem(
        ACHIEVEMENT_PROGRESS_STORAGE_KEY,
        JSON.stringify(achievementProgress)
      );
      if (writeVersion) {
        localStorage.setItem(
          ACHIEVEMENT_PROGRESS_VERSION_STORAGE_KEY,
          ACHIEVEMENT_PROGRESS_VERSION
        );
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadStarBalance() {
    let balance = 0;
    try {
      const storedBalance = localStorage.getItem(STAR_BALANCE_STORAGE_KEY);
      const economyWasInitialized =
        localStorage.getItem(STAR_ECONOMY_VERSION_STORAGE_KEY) ===
        STAR_ECONOMY_VERSION;
      if (storedBalance !== null) {
        balance = getNonNegativeInteger(storedBalance);
      } else if (!economyWasInitialized) {
        const storedProgress = safeParseStorage(ACHIEVEMENT_PROGRESS_STORAGE_KEY, {});
        const hasReliableLifetimeStars =
          storedProgress &&
          typeof storedProgress === "object" &&
          Object.prototype.hasOwnProperty.call(storedProgress, "lifetimeStars");
        if (hasReliableLifetimeStars) {
          balance = getNonNegativeInteger(storedProgress.lifetimeStars);
        }
      }
      localStorage.setItem(STAR_BALANCE_STORAGE_KEY, String(balance));
      localStorage.setItem(
        STAR_ECONOMY_VERSION_STORAGE_KEY,
        STAR_ECONOMY_VERSION
      );
    } catch (_) {}
    return balance;
  }

  function saveStarBalance() {
    try {
      localStorage.setItem(STAR_BALANCE_STORAGE_KEY, String(starBalance));
      return true;
    } catch (_) {
      return false;
    }
  }

  function cloneAchievementProgress() {
    return {
      discoveredBiomeIds: achievementProgress.discoveredBiomeIds.slice(),
      perfectBiomeIds: achievementProgress.perfectBiomeIds.slice(),
      deathFreeBiomeIds: achievementProgress.deathFreeBiomeIds.slice(),
      completedLookIds: achievementProgress.completedLookIds.slice(),
      lifetimeStars: achievementProgress.lifetimeStars,
      lifetimeAirTime: achievementProgress.lifetimeAirTime,
      lifetimeCompletedLevels: achievementProgress.lifetimeCompletedLevels,
      lifetimeDeaths: achievementProgress.lifetimeDeaths,
      lifetimePerfects: achievementProgress.lifetimePerfects
    };
  }

  function cloneRunState() {
    return {
      ...runState,
      runBiomeIds: [...runState.runBiomeIds]
    };
  }

  function isNonNegativeIntegerSnapshotValue(value) {
    return Number.isInteger(value) && value >= 0;
  }

  function isNonNegativeNumberSnapshotValue(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function normalizeUniqueStringSnapshotValues(values, isValidValue) {
    if (!Array.isArray(values)) return null;
    const normalized = [];
    for (const value of values) {
      if (typeof value !== "string" || !isValidValue(value) || normalized.includes(value)) {
        return null;
      }
      normalized.push(value);
    }
    return normalized;
  }

  function normalizeAchievementProgressSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const existingBiomeIds = new Set(getExistingBiomeIds());
    const isExistingBiomeId = id => existingBiomeIds.has(id);
    const discoveredBiomeIds = normalizeUniqueStringSnapshotValues(
      value.discoveredBiomeIds,
      isExistingBiomeId
    );
    const perfectBiomeIds = normalizeUniqueStringSnapshotValues(
      value.perfectBiomeIds,
      isExistingBiomeId
    );
    const deathFreeBiomeIds = normalizeUniqueStringSnapshotValues(
      value.deathFreeBiomeIds,
      isExistingBiomeId
    );
    const completedLookIds = normalizeUniqueStringSnapshotValues(
      value.completedLookIds,
      isRegisteredLookKey
    );
    if (
      !discoveredBiomeIds ||
      !perfectBiomeIds ||
      !deathFreeBiomeIds ||
      !completedLookIds ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimeStars) ||
      !isNonNegativeNumberSnapshotValue(value.lifetimeAirTime) ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimeCompletedLevels) ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimeDeaths) ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimePerfects)
    ) {
      return null;
    }
    return {
      discoveredBiomeIds,
      perfectBiomeIds,
      deathFreeBiomeIds,
      completedLookIds,
      lifetimeStars: value.lifetimeStars,
      lifetimeAirTime: value.lifetimeAirTime,
      lifetimeCompletedLevels: value.lifetimeCompletedLevels,
      lifetimeDeaths: value.lifetimeDeaths,
      lifetimePerfects: value.lifetimePerfects
    };
  }

  function normalizeAchievementRunStateSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const existingBiomeIds = new Set(getExistingBiomeIds());
    const runBiomeIds = normalizeUniqueStringSnapshotValues(
      value.runBiomeIds,
      id => existingBiomeIds.has(id)
    );
    const integerFields = [
      "perfectStreak",
      "cleanLevelStreak",
      "completedLevels",
      "ghostCleanLevels",
      "speedLevels",
      "perfectClearLevels",
      "runStars",
      "previousLevelNumber",
      "bounceStreak",
      "levelShots",
      "starsSinceShot",
      "groundhogDeaths"
    ];
    const numberFields = [
      "levelElapsed",
      "airTime",
      "lifetimeAirTimePending"
    ];
    const booleanFields = [
      "rotationComplete",
      "levelHadDeath",
      "levelHasGhost",
      "ghostHit",
      "shotActive",
      "rescueUsed"
    ];
    const biomeFieldsAreValid = [value.previousBiomeId, value.biomeId].every(
      id => id === null || (typeof id === "string" && existingBiomeIds.has(id))
    );
    if (
      !runBiomeIds ||
      integerFields.some(field => !isNonNegativeIntegerSnapshotValue(value[field])) ||
      numberFields.some(field => !isNonNegativeNumberSnapshotValue(value[field])) ||
      booleanFields.some(field => typeof value[field] !== "boolean") ||
      !Number.isInteger(value.levelNumber) ||
      value.levelNumber < 1 ||
      !biomeFieldsAreValid ||
      (
        value.groundhogLevelNumber !== null &&
        (!Number.isInteger(value.groundhogLevelNumber) || value.groundhogLevelNumber < 1)
      )
    ) {
      return null;
    }
    return {
      perfectStreak: value.perfectStreak,
      cleanLevelStreak: value.cleanLevelStreak,
      completedLevels: value.completedLevels,
      ghostCleanLevels: value.ghostCleanLevels,
      speedLevels: value.speedLevels,
      perfectClearLevels: value.perfectClearLevels,
      runStars: value.runStars,
      runBiomeIds,
      rotationComplete: value.rotationComplete,
      previousBiomeId: value.previousBiomeId,
      previousLevelNumber: value.previousLevelNumber,
      levelNumber: value.levelNumber,
      biomeId: value.biomeId,
      levelElapsed: value.levelElapsed,
      levelHadDeath: value.levelHadDeath,
      levelHasGhost: value.levelHasGhost,
      ghostHit: value.ghostHit,
      bounceStreak: value.bounceStreak,
      levelShots: value.levelShots,
      shotActive: value.shotActive,
      starsSinceShot: value.starsSinceShot,
      airTime: value.airTime,
      lifetimeAirTimePending: value.lifetimeAirTimePending,
      rescueUsed: value.rescueUsed,
      groundhogLevelNumber: value.groundhogLevelNumber,
      groundhogDeaths: value.groundhogDeaths
    };
  }

  function normalizeRunProgressSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!Array.isArray(value.unlockedAchievements)) return null;

    const normalizedUnlocks = [];
    const unlockIds = new Set();
    for (const unlock of value.unlockedAchievements) {
      if (
        !unlock ||
        typeof unlock !== "object" ||
        Array.isArray(unlock) ||
        typeof unlock.id !== "string" ||
        !ACHIEVEMENT_BY_ID.has(unlock.id) ||
        unlockIds.has(unlock.id) ||
        !Number.isInteger(unlock.unlockedAt) ||
        unlock.unlockedAt <= 0
      ) {
        return null;
      }
      unlockIds.add(unlock.id);
      normalizedUnlocks.push({id: unlock.id, unlockedAt: unlock.unlockedAt});
    }

    const normalizedProgress = normalizeAchievementProgressSnapshot(
      value.achievementProgress
    );
    const normalizedRunState = normalizeAchievementRunStateSnapshot(value.runState);
    const recentDeathTimestamps = Array.isArray(value.recentDeathTimestamps) &&
      value.recentDeathTimestamps.every(isNonNegativeNumberSnapshotValue)
      ? value.recentDeathTimestamps.slice()
      : null;
    const popupQueueIds = normalizeUniqueStringSnapshotValues(
      value.popupQueueIds,
      id => ACHIEVEMENT_BY_ID.has(id)
    );
    const latestUnlockTimestamp = normalizedUnlocks.reduce(
      (latest, unlock) => Math.max(latest, unlock.unlockedAt),
      0
    );
    if (
      !normalizedProgress ||
      !normalizedRunState ||
      !recentDeathTimestamps ||
      !popupQueueIds ||
      !isNonNegativeIntegerSnapshotValue(value.starBalance) ||
      !isNonNegativeIntegerSnapshotValue(value.lastUnlockTimestamp) ||
      value.lastUnlockTimestamp < latestUnlockTimestamp
    ) {
      return null;
    }
    return {
      unlockedAchievements: normalizedUnlocks,
      achievementProgress: normalizedProgress,
      starBalance: value.starBalance,
      lastUnlockTimestamp: value.lastUnlockTimestamp,
      runState: normalizedRunState,
      recentDeathTimestamps,
      popupQueueIds
    };
  }

  function isRunProgressSnapshotValid(value) {
    return normalizeRunProgressSnapshot(value) !== null;
  }

  function captureRunProgressSnapshot() {
    runProgressSnapshot = {
      unlockedAchievements: unlockedAchievements.map(unlock => ({...unlock})),
      achievementProgress: cloneAchievementProgress(),
      starBalance,
      lastUnlockTimestamp,
      runState: cloneRunState(),
      recentDeathTimestamps: recentDeathTimestamps.slice(),
      popupQueueIds: popupQueue.map(achievement => achievement.id)
    };
    return normalizeRunProgressSnapshot(runProgressSnapshot);
  }

  function restoreRunProgressSnapshot(snapshot = runProgressSnapshot) {
    const normalizedSnapshot = normalizeRunProgressSnapshot(snapshot);
    if (!normalizedSnapshot) return false;

    unlockedAchievements = normalizedSnapshot.unlockedAchievements.map(
      unlock => ({...unlock})
    );
    unlockedById.clear();
    unlockedAchievements.forEach(unlock => unlockedById.set(unlock.id, unlock));
    lastUnlockTimestamp = normalizedSnapshot.lastUnlockTimestamp;

    Object.assign(
      achievementProgress,
      normalizedSnapshot.achievementProgress,
      {
        discoveredBiomeIds:
          normalizedSnapshot.achievementProgress.discoveredBiomeIds.slice(),
        perfectBiomeIds:
          normalizedSnapshot.achievementProgress.perfectBiomeIds.slice(),
        deathFreeBiomeIds:
          normalizedSnapshot.achievementProgress.deathFreeBiomeIds.slice(),
        completedLookIds:
          normalizedSnapshot.achievementProgress.completedLookIds.slice()
      }
    );
    starBalance = normalizedSnapshot.starBalance;

    Object.assign(runState, normalizedSnapshot.runState, {
      runBiomeIds: new Set(normalizedSnapshot.runState.runBiomeIds)
    });
    recentDeathTimestamps.splice(
      0,
      recentDeathTimestamps.length,
      ...normalizedSnapshot.recentDeathTimestamps
    );

    popupGeneration++;
    popupActive = false;
    popupQueue.splice(
      0,
      popupQueue.length,
      ...normalizedSnapshot.popupQueueIds
        .map(id => ACHIEVEMENT_BY_ID.get(id))
        .filter(Boolean)
    );
    if (typeof document !== "undefined") {
      document.getElementById("achievementPopup")?.classList.remove("visible");
    }

    const unlocksSaved = saveAchievementUnlocks();
    const progressSaved = saveAchievementProgress({writeVersion: false});
    const balanceSaved = saveStarBalance();
    renderAchievementViews();
    showNextAchievementPopup();
    return unlocksSaved && progressSaved && balanceSaved;
  }

  function discardRunProgressSnapshot() {
    runProgressSnapshot = null;
  }

  function formatUnlockDate(unlockedAt) {
    try {
      return new Date(unlockedAt).toLocaleDateString("de-DE");
    } catch (_) {
      return "";
    }
  }

  function getRecentAchievements(limit = 5) {
    return unlockedAchievements
      .slice()
      .sort((a, b) => b.unlockedAt - a.unlockedAt)
      .slice(0, Math.max(0, Math.floor(limit)))
      .map(unlock => ({
        ...ACHIEVEMENT_BY_ID.get(unlock.id),
        unlockedAt: unlock.unlockedAt
      }));
  }

  function normalizeSelectedAchievementBadgeIds(value) {
    if (!Array.isArray(value)) return [];

    const normalized = [];
    value.forEach(id => {
      if (normalized.length >= CALLING_CARD_BADGE_LIMIT || typeof id !== "string") {
        return;
      }
      const cleanId = id.trim();
      if (
        !cleanId ||
        !ACHIEVEMENT_BY_ID.has(cleanId) ||
        !unlockedById.has(cleanId) ||
        normalized.includes(cleanId)
      ) {
        return;
      }
      normalized.push(cleanId);
    });
    return normalized;
  }

  function loadSelectedAchievementBadges() {
    return normalizeSelectedAchievementBadgeIds(
      safeParseStorage(SELECTED_ACHIEVEMENT_BADGES_STORAGE_KEY, [])
    );
  }

  function saveSelectedAchievementBadges() {
    try {
      localStorage.setItem(
        SELECTED_ACHIEVEMENT_BADGES_STORAGE_KEY,
        JSON.stringify(selectedAchievementBadges)
      );
    } catch (_) {}
  }

  function getSelectedAchievementBadgeIds() {
    return selectedAchievementBadges.slice(0, CALLING_CARD_BADGE_LIMIT);
  }

  function getCallingCardDisplayIds() {
    if (isDevModeEnabled() && devCallingCardPreview !== null) {
      return devCallingCardPreview.slice(0, CALLING_CARD_BADGE_LIMIT);
    }
    return getSelectedAchievementBadgeIds();
  }

  function toggleCallingCardAchievement(id) {
    const achievementId = String(id ?? "");
    if (!ACHIEVEMENT_BY_ID.has(achievementId)) return false;

    const actuallyUnlocked = unlockedById.has(achievementId);
    const devPreviewAllowed = isDevModeEnabled() && !actuallyUnlocked;
    if (!actuallyUnlocked && !devPreviewAllowed) return false;

    if (devPreviewAllowed && devCallingCardPreview === null) {
      devCallingCardPreview = getSelectedAchievementBadgeIds();
    }

    const displaySelection = getCallingCardDisplayIds();
    const selectedIndex = displaySelection.indexOf(achievementId);
    if (selectedIndex < 0 && displaySelection.length >= CALLING_CARD_BADGE_LIMIT) {
      return false;
    }

    if (selectedIndex >= 0) {
      displaySelection.splice(selectedIndex, 1);
    } else {
      displaySelection.push(achievementId);
    }

    if (actuallyUnlocked) {
      const persistentIndex = selectedAchievementBadges.indexOf(achievementId);
      if (selectedIndex >= 0 && persistentIndex >= 0) {
        selectedAchievementBadges.splice(persistentIndex, 1);
      } else if (
        selectedIndex < 0 &&
        persistentIndex < 0 &&
        selectedAchievementBadges.length < CALLING_CARD_BADGE_LIMIT
      ) {
        selectedAchievementBadges.push(achievementId);
      }
      saveSelectedAchievementBadges();
    }

    if (isDevModeEnabled() && devCallingCardPreview !== null) {
      devCallingCardPreview = displaySelection;
    }

    renderAchievementViews();
    return true;
  }

  function renderRecentAchievements() {
    if (typeof document === "undefined") return;
    const list = document.getElementById("recentAchievementList");
    if (!list) return;
    const title = document.getElementById("recentAchievementsTitle");
    const recentPanel = document.getElementById("recentAchievements");
    const selectedPrestigeFrame = window.SlimePrestige?.getSelectedReward?.("frame") ?? "none";
    const selectedPrestigeTitle = window.SlimePrestige?.getSelectedReward?.("title") ?? "none";
    const prestigeTitleDefinition = window.SlimePrestige?.getRewardDefinition?.(
      "title",
      selectedPrestigeTitle
    );
    if (recentPanel) recentPanel.dataset.prestigeFrame = selectedPrestigeFrame;
    const callingCardIds = getCallingCardDisplayIds();
    const achievements = callingCardIds.length > 0
      ? callingCardIds
          .map(id => ACHIEVEMENT_BY_ID.get(id))
          .filter(Boolean)
          .slice(0, CALLING_CARD_BADGE_LIMIT)
      : getRecentAchievements(CALLING_CARD_BADGE_LIMIT);
    if (title) {
      title.textContent = callingCardIds.length > 0
        ? prestigeTitleDefinition
          ? `Calling Card · ${prestigeTitleDefinition.displayName}`
          : "Calling Card"
        : "Letzte Erfolge";
    }
    list.replaceChildren();

    if (achievements.length === 0) {
      const empty = document.createElement("span");
      empty.className = "recentAchievementEmpty";
      empty.textContent = "Noch keine Erfolge";
      list.appendChild(empty);
      return;
    }

    for (const achievement of achievements) {
      const item = document.createElement("span");
      item.className = "recentAchievementItem";
      item.setAttribute("aria-label", achievement.name);
      const icon = document.createElement("span");
      icon.className = "recentAchievementIcon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = achievement.icon;
      item.appendChild(icon);
      list.appendChild(item);
    }
  }

  function renderCallingCardPreview() {
    if (typeof document === "undefined") return;
    const preview = document.getElementById("achievementCallingCardSlots");
    if (!preview) return;
    const previewPanel = preview.closest(".achievementCallingCardPreview");
    const selectedPrestigeFrame = window.SlimePrestige?.getSelectedReward?.("frame") ?? "none";
    if (previewPanel) previewPanel.dataset.prestigeFrame = selectedPrestigeFrame;
    const title = document.getElementById("achievementPrestigeTitle");
    const selectedPrestigeTitle = window.SlimePrestige?.getSelectedReward?.("title") ?? "none";
    const titleDefinition = window.SlimePrestige?.getRewardDefinition?.(
      "title",
      selectedPrestigeTitle
    );
    if (title) {
      title.textContent = titleDefinition?.displayName ?? "";
      title.classList.toggle("hidden", !titleDefinition);
    }

    const selectedIds = getCallingCardDisplayIds();
    preview.replaceChildren();

    for (let index = 0; index < CALLING_CARD_BADGE_LIMIT; index++) {
      const achievement = ACHIEVEMENT_BY_ID.get(selectedIds[index]);
      const slot = document.createElement("span");
      slot.className = "achievementCallingCardPreviewSlot";
      slot.classList.toggle("filled", Boolean(achievement));
      slot.setAttribute(
        "aria-label",
        achievement
          ? `Slot ${index + 1}: ${achievement.name}`
          : `Slot ${index + 1}: nicht belegt`
      );
      slot.textContent = achievement ? achievement.icon : String(index + 1);
      preview.appendChild(slot);
    }
  }

  function renderAchievementMenu() {
    if (typeof document === "undefined") return;
    const grid = document.getElementById("achievementGrid");
    const progressText = document.getElementById("achievementProgressText");
    if (!grid || !progressText) return;

    const previousScrollTop = grid.scrollTop;
    const devPreview = typeof DEV_MODE !== "undefined" && DEV_MODE;
    const callingCardIds = getCallingCardDisplayIds();
    const visibleUnlockCount = devPreview
      ? ACHIEVEMENT_REGISTRY.length
      : unlockedAchievements.length;
    progressText.textContent =
      `${visibleUnlockCount} / ${ACHIEVEMENT_REGISTRY.length} freigeschaltet`;
    renderCallingCardPreview();
    grid.replaceChildren();

    for (const achievement of ACHIEVEMENT_REGISTRY) {
      const unlock = unlockedById.get(achievement.id);
      const isActuallyUnlocked = Boolean(unlock);
      const isVisuallyUnlocked = isActuallyUnlocked || devPreview;
      const hidesSecret = achievement.secret && !isVisuallyUnlocked;
      const callingCardSlot = callingCardIds.indexOf(achievement.id);
      const isCallingCardSelected = callingCardSlot >= 0;
      const card = document.createElement("article");
      card.className = "achievementCard";
      card.classList.toggle("unlocked", isVisuallyUnlocked);
      card.classList.toggle("locked", !isVisuallyUnlocked);
      card.classList.toggle("secret", hidesSecret);
      card.classList.toggle("callingCardSelected", isCallingCardSelected);
      card.setAttribute(
        "aria-label",
        hidesSecret
          ? "Geheimes Achievement gesperrt"
          : `${achievement.name}: ${achievement.description}${
              isCallingCardSelected
                ? `, Calling Card Slot ${callingCardSlot + 1}`
                : ", für Calling Card auswählen"
            }`
      );

      const icon = document.createElement("span");
      icon.className = "achievementCardIcon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = hidesSecret ? "?" : achievement.icon;

      const content = document.createElement("div");
      content.className = "achievementCardContent";
      const name = document.createElement("h3");
      name.textContent = hidesSecret ? "???" : achievement.name;
      const description = document.createElement("p");
      description.textContent = hidesSecret ? "???" : achievement.description;
      const status = document.createElement("span");
      status.className = "achievementCardStatus";
      status.textContent = isActuallyUnlocked
        ? `Freigeschaltet · ${formatUnlockDate(unlock.unlockedAt)}`
        : devPreview
          ? "DEV-Vorschau"
          : "Gesperrt";
      if (isCallingCardSelected) {
        status.textContent =
          `${isActuallyUnlocked ? "Calling Card" : "DEV-Calling Card"} · ` +
          `Slot ${callingCardSlot + 1}`;
      }
      content.append(name, description, status);
      card.append(icon, content);

      if (isCallingCardSelected) {
        const slotBadge = document.createElement("span");
        slotBadge.className = "achievementCallingCardSlotBadge";
        slotBadge.setAttribute("aria-hidden", "true");
        slotBadge.textContent = String(callingCardSlot + 1);
        card.appendChild(slotBadge);
      }

      if (isVisuallyUnlocked) {
        card.setAttribute("role", "button");
        card.setAttribute("aria-pressed", String(isCallingCardSelected));
        card.tabIndex = 0;
        card.addEventListener("click", () => {
          toggleCallingCardAchievement(achievement.id);
        });
        card.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggleCallingCardAchievement(achievement.id);
        });
      }
      grid.appendChild(card);
    }
    grid.scrollTop = previousScrollTop;
  }

  function renderAchievementViews() {
    renderAchievementMenu();
    renderRecentAchievements();
  }

  function showNextAchievementPopup() {
    if (popupActive || popupQueue.length === 0 || typeof document === "undefined") return;
    const popup = document.getElementById("achievementPopup");
    const icon = document.getElementById("achievementPopupIcon");
    const name = document.getElementById("achievementPopupName");
    if (!popup || !icon || !name) return;

    const achievement = popupQueue.shift();
    const generation = popupGeneration;
    popupActive = true;
    icon.textContent = achievement.icon;
    name.textContent = achievement.name;
    popup.classList.remove("visible");
    void popup.offsetWidth;
    popup.classList.add("visible");

    window.setTimeout(() => {
      if (generation !== popupGeneration) return;
      popup.classList.remove("visible");
      window.setTimeout(() => {
        if (generation !== popupGeneration) return;
        popupActive = false;
        showNextAchievementPopup();
      }, 260);
    }, 2400);
  }

  function queueAchievementPopup(achievement) {
    popupQueue.push(achievement);
    showNextAchievementPopup();
  }

  function unlockAchievement(id) {
    const achievement = ACHIEVEMENT_BY_ID.get(String(id));
    if (!achievement || unlockedById.has(achievement.id)) return false;

    const unlockedAt = Math.max(Date.now(), lastUnlockTimestamp + 1);
    lastUnlockTimestamp = unlockedAt;
    const unlock = {id: achievement.id, unlockedAt};
    unlockedAchievements.push(unlock);
    unlockedById.set(achievement.id, unlock);
    saveAchievementUnlocks();
    renderAchievementViews();
    queueAchievementPopup(achievement);
    if (achievement.id !== "achievement_hunter") {
      checkAchievementHunter();
    }
    return true;
  }

  function checkAchievementHunter() {
    if (unlockedById.has("achievement_hunter")) return;
    const allOtherAchievementsUnlocked = ACHIEVEMENT_REGISTRY
      .filter(achievement => achievement.id !== "achievement_hunter")
      .every(achievement => unlockedById.has(achievement.id));
    if (allOtherAchievementsUnlocked) {
      unlockAchievement("achievement_hunter");
    }
  }

  function checkPerfectAchievements() {
    if (runState.perfectStreak >= 3) unlockAchievement("hp_gen");
    if (runState.perfectStreak >= 5) unlockAchievement("perfectionist");
    if (runState.perfectStreak >= 10) unlockAchievement("untouchable");
  }

  function checkStarAchievements() {
    if (runState.runStars >= 50) unlockAchievement("starstruck");
    if (runState.runStars >= 100) unlockAchievement("star_hoarder");
    if (runState.runStars >= 200) unlockAchievement("galaxy_brain");
    if (runState.runStars >= 300) unlockAchievement("star_magnet");
  }

  function checkWardrobeAchievements() {
    if (
      typeof unlockedSlimeColors === "undefined" ||
      typeof unlockedSlimeCosmetics === "undefined" ||
      typeof unlockedSlimeBeards === "undefined"
    ) {
      return;
    }

    if (unlockedSlimeCosmetics.length > 0) unlockAchievement("fashion_slime");
    if (unlockedSlimeBeards.length > 0) unlockAchievement("glorious_beard");
    if (selectedSlimeCosmetic !== "none" && selectedSlimeBeard !== "none") {
      unlockAchievement("dressed_to_slime");
    }

    const unlockedWardrobeItemIds = new Set([
      ...unlockedSlimeColors,
      ...unlockedSlimeCosmetics,
      ...unlockedSlimeBeards
    ]);
    unlockedWardrobeItemIds.delete("none");
    if (unlockedWardrobeItemIds.size >= 25) {
      unlockAchievement("wardrobe_warrior");
    }

    const allColorsUnlocked =
      typeof SLIME_COLOR_ORDER !== "undefined" &&
      SLIME_COLOR_ORDER.length > 0 &&
      SLIME_COLOR_ORDER.every(color => unlockedSlimeColors.includes(color));
    const allCosmeticsUnlocked =
      typeof UNLOCKABLE_SLIME_COSMETICS !== "undefined" &&
      UNLOCKABLE_SLIME_COSMETICS.length > 0 &&
      UNLOCKABLE_SLIME_COSMETICS.every(cosmetic =>
        unlockedSlimeCosmetics.includes(cosmetic)
      );
    const allBeardsUnlocked =
      typeof UNLOCKABLE_SLIME_BEARDS !== "undefined" &&
      UNLOCKABLE_SLIME_BEARDS.length > 0 &&
      UNLOCKABLE_SLIME_BEARDS.every(beard => unlockedSlimeBeards.includes(beard));

    if (allColorsUnlocked) {
      unlockAchievement("rainbow_slime");
    }
    if (allCosmeticsUnlocked) unlockAchievement("fashion_icon");
    if (allBeardsUnlocked) unlockAchievement("beard_baron");
    if (allColorsUnlocked && allCosmeticsUnlocked && allBeardsUnlocked) {
      unlockAchievement("full_wardrobe");
    }
  }

  function getWardrobePurchaseTarget(category, itemId) {
    const normalizedCategory = String(category ?? "").toLowerCase();
    const normalizedId = String(itemId ?? "").toLowerCase();

    if (
      normalizedCategory === "color" &&
      typeof SLIME_COLOR_ORDER !== "undefined" &&
      SLIME_COLOR_ORDER.includes(normalizedId) &&
      typeof isSlimeColorUnlocked === "function" &&
      typeof unlockSlimeColor === "function"
    ) {
      return {
        category: normalizedCategory,
        id: normalizedId,
        isUnlocked: () => isSlimeColorUnlocked(normalizedId),
        unlock: () => unlockSlimeColor(normalizedId)
      };
    }

    if (
      normalizedCategory === "cosmetic" &&
      typeof UNLOCKABLE_SLIME_COSMETICS !== "undefined" &&
      UNLOCKABLE_SLIME_COSMETICS.includes(normalizedId) &&
      typeof isSlimeCosmeticUnlocked === "function" &&
      typeof unlockSlimeCosmetic === "function"
    ) {
      return {
        category: normalizedCategory,
        id: normalizedId,
        isUnlocked: () => isSlimeCosmeticUnlocked(normalizedId),
        unlock: () => unlockSlimeCosmetic(normalizedId)
      };
    }

    if (
      normalizedCategory === "beard" &&
      typeof UNLOCKABLE_SLIME_BEARDS !== "undefined" &&
      UNLOCKABLE_SLIME_BEARDS.includes(normalizedId) &&
      typeof isSlimeBeardUnlocked === "function" &&
      typeof unlockSlimeBeard === "function"
    ) {
      return {
        category: normalizedCategory,
        id: normalizedId,
        isUnlocked: () => isSlimeBeardUnlocked(normalizedId),
        unlock: () => unlockSlimeBeard(normalizedId)
      };
    }

    return null;
  }

  function isDevModeEnabled() {
    return typeof DEV_MODE !== "undefined" && DEV_MODE;
  }

  function getWardrobePurchaseKey(target) {
    return `${target.category}:${target.id}`;
  }

  function resetDevShopTestSession() {
    devShopTestBalance = DEV_SHOP_TEST_INITIAL_BALANCE;
    devShopTestUnlocks.clear();
  }

  function setDevShopTestActive(active) {
    if (!isDevModeEnabled()) return false;
    const nextActive = Boolean(active);
    if (nextActive === devShopTestActive) return devShopTestActive;

    resetDevShopTestSession();
    devShopTestActive = nextActive;
    return devShopTestActive;
  }

  function isDevShopTestItemUnlocked(category, itemId) {
    if (!devShopTestActive || !isDevModeEnabled()) return false;
    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target) return false;
    return target.isUnlocked() || devShopTestUnlocks.has(getWardrobePurchaseKey(target));
  }

  function canPurchaseDevShopTestItem(category, itemId) {
    if (!devShopTestActive || !isDevModeEnabled()) return false;
    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target || target.isUnlocked()) return false;
    const purchaseKey = getWardrobePurchaseKey(target);
    return !devShopTestUnlocks.has(purchaseKey) &&
      !activeWardrobePurchases.has(purchaseKey) &&
      devShopTestBalance >= WARDROBE_ITEM_STAR_PRICE;
  }

  function purchaseDevShopTestItem(category, itemId) {
    if (!devShopTestActive || !isDevModeEnabled()) {
      return {ok: false, reason: "dev-shop-inactive", balance: devShopTestBalance};
    }

    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target) {
      return {ok: false, reason: "invalid-item", balance: devShopTestBalance};
    }

    const purchaseKey = getWardrobePurchaseKey(target);
    if (target.isUnlocked() || devShopTestUnlocks.has(purchaseKey)) {
      return {ok: false, reason: "already-unlocked", balance: devShopTestBalance};
    }
    if (devShopTestBalance < WARDROBE_ITEM_STAR_PRICE) {
      return {ok: false, reason: "insufficient-stars", balance: devShopTestBalance};
    }
    if (activeWardrobePurchases.has(purchaseKey)) {
      return {ok: false, reason: "purchase-in-progress", balance: devShopTestBalance};
    }

    activeWardrobePurchases.add(purchaseKey);
    try {
      if (target.isUnlocked() || devShopTestUnlocks.has(purchaseKey)) {
        return {ok: false, reason: "already-unlocked", balance: devShopTestBalance};
      }

      devShopTestBalance -= WARDROBE_ITEM_STAR_PRICE;
      devShopTestUnlocks.add(purchaseKey);
      return {
        ok: true,
        test: true,
        category: target.category,
        id: target.id,
        price: WARDROBE_ITEM_STAR_PRICE,
        balance: devShopTestBalance
      };
    } finally {
      activeWardrobePurchases.delete(purchaseKey);
    }
  }

  function canPurchaseWardrobeItem(category, itemId) {
    if (isDevModeEnabled()) return false;
    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target || target.isUnlocked()) return false;
    const purchaseKey = getWardrobePurchaseKey(target);
    return !activeWardrobePurchases.has(purchaseKey) &&
      starBalance >= WARDROBE_ITEM_STAR_PRICE;
  }

  function purchaseWardrobeItem(category, itemId) {
    if (isDevModeEnabled()) {
      return {ok: false, reason: "dev-mode", balance: starBalance};
    }

    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target) return {ok: false, reason: "invalid-item", balance: starBalance};
    if (target.isUnlocked()) {
      return {ok: false, reason: "already-unlocked", balance: starBalance};
    }
    if (starBalance < WARDROBE_ITEM_STAR_PRICE) {
      return {ok: false, reason: "insufficient-stars", balance: starBalance};
    }

    const purchaseKey = getWardrobePurchaseKey(target);
    if (activeWardrobePurchases.has(purchaseKey)) {
      return {ok: false, reason: "purchase-in-progress", balance: starBalance};
    }

    activeWardrobePurchases.add(purchaseKey);
    try {
      if (target.isUnlocked()) {
        return {ok: false, reason: "already-unlocked", balance: starBalance};
      }

      starBalance -= WARDROBE_ITEM_STAR_PRICE;
      let unlocked = false;
      try {
        unlocked = target.unlock();
      } catch (_) {
        unlocked = false;
      }
      if (!unlocked) {
        starBalance += WARDROBE_ITEM_STAR_PRICE;
        return {ok: false, reason: "unlock-failed", balance: starBalance};
      }

      saveStarBalance();
      checkWardrobeAchievements();
      return {
        ok: true,
        category: target.category,
        id: target.id,
        price: WARDROBE_ITEM_STAR_PRICE,
        balance: starBalance
      };
    } finally {
      activeWardrobePurchases.delete(purchaseKey);
    }
  }

  function addUniqueProgressValue(values, value) {
    if (!value || values.includes(value)) return false;
    values.push(value);
    return true;
  }

  function getCurrentLookKey() {
    if (
      typeof selectedSlimeColor === "undefined" ||
      typeof selectedSlimeCosmetic === "undefined" ||
      typeof selectedSlimeBeard === "undefined"
    ) {
      return null;
    }
    const lookKey = [
      selectedSlimeColor,
      selectedSlimeCosmetic,
      selectedSlimeBeard
    ].join("|");
    return isRegisteredLookKey(lookKey) ? lookKey : null;
  }

  function getLifetimeAirTime() {
    return achievementProgress.lifetimeAirTime + runState.lifetimeAirTimePending;
  }

  function flushLifetimeAirTime({save = true} = {}) {
    if (runState.lifetimeAirTimePending <= 0) return false;
    achievementProgress.lifetimeAirTime += runState.lifetimeAirTimePending;
    runState.lifetimeAirTimePending = 0;
    if (save) saveAchievementProgress();
    if (achievementProgress.lifetimeAirTime >= 60) {
      unlockAchievement("frequent_flyer");
    }
    return true;
  }

  function checkPersistentProgressAchievements() {
    const existingBiomeIds = getExistingBiomeIds();
    if (
      existingBiomeIds.length > 0 &&
      existingBiomeIds.every(id => achievementProgress.perfectBiomeIds.includes(id))
    ) {
      unlockAchievement("perfect_tourist");
    }
    if (
      existingBiomeIds.length > 0 &&
      existingBiomeIds.every(id => achievementProgress.deathFreeBiomeIds.includes(id))
    ) {
      unlockAchievement("biome_master");
    }
    if (achievementProgress.lifetimeStars >= 1000) unlockAchievement("star_bank");
    if (getLifetimeAirTime() >= 60) unlockAchievement("frequent_flyer");
    if (achievementProgress.completedLookIds.length >= 10) unlockAchievement("style_master");
    if (achievementProgress.lifetimePerfects >= 25) unlockAchievement("perfect_25");
    if (achievementProgress.lifetimeCompletedLevels >= 100) {
      unlockAchievement("veteran_slime");
    }
    if (achievementProgress.lifetimeDeaths >= 25) unlockAchievement("ouch");
  }

  function recordBiomeReached(biomeId) {
    const id = String(biomeId ?? "");
    const existingBiomeIds = getExistingBiomeIds();
    if (!existingBiomeIds.includes(id)) return;

    runState.runBiomeIds.add(id);
    if (!achievementProgress.discoveredBiomeIds.includes(id)) {
      achievementProgress.discoveredBiomeIds.push(id);
      saveAchievementProgress();
    }

    if (id === "sky") unlockAchievement("head_in_the_clouds");
    if (
      existingBiomeIds.length > 0 &&
      existingBiomeIds.every(existingId =>
        achievementProgress.discoveredBiomeIds.includes(existingId)
      )
    ) {
      unlockAchievement("world_traveler");
    }
  }

  function resetLevelState({levelNumber = 1, biomeId = null, hasGhost = false} = {}) {
    runState.levelNumber = Math.max(1, Math.floor(Number(levelNumber) || 1));
    runState.biomeId = biomeId === null ? null : String(biomeId);
    runState.levelElapsed = 0;
    runState.levelHadDeath = false;
    runState.levelHasGhost = Boolean(hasGhost);
    runState.ghostHit = false;
    runState.bounceStreak = 0;
    runState.levelShots = 0;
    runState.shotActive = false;
    runState.starsSinceShot = 0;
    runState.airTime = 0;
    runState.rescueUsed = false;
  }

  function onBiomeReached({levelNumber = 1, biomeId = null} = {}) {
    const id = String(biomeId ?? "");
    const biomeIds = getExistingBiomeIds();
    if (!biomeIds.includes(id)) return;

    const firstBiomeId = biomeIds[0];
    const lastBiomeId = biomeIds[biomeIds.length - 1];
    const numericLevel = Math.max(1, Math.floor(Number(levelNumber) || 1));

    if (
      runState.rotationComplete &&
      id === firstBiomeId &&
      runState.previousBiomeId === lastBiomeId &&
      numericLevel > runState.previousLevelNumber
    ) {
      unlockAchievement("round_two");
    }

    recordBiomeReached(id);
    if (biomeIds.every(existingId => runState.runBiomeIds.has(existingId))) {
      runState.rotationComplete = true;
    }
    runState.previousBiomeId = id;
    runState.previousLevelNumber = numericLevel;
  }

  function onLevelStart({levelNumber = 1, biomeId = null, hasGhost = false} = {}) {
    const numericLevel = Math.max(1, Math.floor(Number(levelNumber) || 1));
    if (runState.groundhogLevelNumber !== numericLevel) {
      runState.groundhogLevelNumber = numericLevel;
      runState.groundhogDeaths = 0;
    }
    resetLevelState({levelNumber, biomeId, hasGhost});
    onBiomeReached({levelNumber, biomeId});
  }

  function onRunStart({levelNumber = 1, biomeId = null, hasGhost = false} = {}) {
    flushLifetimeAirTime();
    runState.perfectStreak = 0;
    runState.cleanLevelStreak = 0;
    runState.completedLevels = 0;
    runState.ghostCleanLevels = 0;
    runState.speedLevels = 0;
    runState.perfectClearLevels = 0;
    runState.runStars = 0;
    runState.runBiomeIds = new Set();
    runState.rotationComplete = false;
    runState.previousBiomeId = null;
    runState.previousLevelNumber = 0;
    onLevelStart({levelNumber, biomeId, hasGhost});
  }

  function onFrame(dt, {grounded = false} = {}) {
    const elapsed = Math.max(0, Number(dt) || 0);
    runState.levelElapsed += elapsed;
    if (!grounded) {
      runState.airTime += elapsed;
      runState.lifetimeAirTimePending += elapsed;
      if (
        runState.lifetimeAirTimePending >= 10 ||
        (!unlockedById.has("frequent_flyer") && getLifetimeAirTime() >= 60)
      ) {
        flushLifetimeAirTime();
      }
    }
  }

  function onShot({levelShots = null, usedRescue = false} = {}) {
    const providedShots = levelShots === null ? NaN : Math.floor(Number(levelShots));
    runState.levelShots = Number.isFinite(providedShots)
      ? Math.max(0, providedShots)
      : runState.levelShots + 1;
    runState.shotActive = true;
    runState.starsSinceShot = 0;
    if (usedRescue) onRescueUsed();
  }

  function onStarCollected({runStars = null} = {}) {
    const providedStars = runStars === null ? NaN : Math.floor(Number(runStars));
    runState.runStars = Number.isFinite(providedStars)
      ? Math.max(0, providedStars)
      : runState.runStars + 1;
    achievementProgress.lifetimeStars++;
    starBalance++;
    saveAchievementProgress();
    saveStarBalance();
    checkStarAchievements();
    if (achievementProgress.lifetimeStars >= 1000) unlockAchievement("star_bank");

    if (runState.shotActive) {
      runState.starsSinceShot++;
      if (runState.starsSinceShot >= 3) {
        unlockAchievement("secret_star_sniper");
      }
    }
  }

  function onBounce() {
    runState.bounceStreak++;
    if (runState.bounceStreak >= 3) unlockAchievement("bounce_master");
    if (runState.bounceStreak >= 10) unlockAchievement("bounce_addict");
  }

  function onLanding() {
    if (runState.airTime >= 5) unlockAchievement("secret_air_time");
    runState.airTime = 0;
    runState.bounceStreak = 0;
    runState.shotActive = false;
    runState.starsSinceShot = 0;
  }

  function onGhostHit() {
    runState.ghostHit = true;
  }

  function onRescueUsed() {
    runState.rescueUsed = true;
  }

  function getDeathTimestamp() {
    return Date.now();
  }

  function checkRagequitter() {
    const now = getDeathTimestamp();
    recentDeathTimestamps.push(now);
    while (
      recentDeathTimestamps.length > 0 &&
      now - recentDeathTimestamps[0] > 5000
    ) {
      recentDeathTimestamps.shift();
    }
    if (
      recentDeathTimestamps.length >= 3 &&
      now - recentDeathTimestamps[recentDeathTimestamps.length - 3] <= 5000
    ) {
      unlockAchievement("secret_ragequitter");
    }
  }

  function onDeath() {
    flushLifetimeAirTime({save: false});
    runState.levelHadDeath = true;
    runState.perfectStreak = 0;
    runState.cleanLevelStreak = 0;
    runState.groundhogDeaths++;
    runState.bounceStreak = 0;
    runState.airTime = 0;
    runState.shotActive = false;
    runState.starsSinceShot = 0;
    achievementProgress.lifetimeDeaths++;
    saveAchievementProgress();
    if (achievementProgress.lifetimeDeaths >= 25) unlockAchievement("ouch");
    checkRagequitter();
  }

  function onLevelCompleted({
    isPerfect = false,
    hadDeath = false,
    hasGhost = null,
    biomeId = null,
    levelNumber = null,
    levelShots = null,
    remainingLives = null,
    collectedStars = null,
    totalStars = null
  } = {}) {
    const diedInLevel = Boolean(hadDeath || runState.levelHadDeath);
    const perfectLevel = Boolean(isPerfect && !diedInLevel);
    if (perfectLevel) {
      runState.perfectStreak++;
      checkPerfectAchievements();
    } else {
      runState.perfectStreak = 0;
    }

    if (diedInLevel) {
      runState.cleanLevelStreak = 0;
    } else {
      runState.cleanLevelStreak++;
      if (runState.cleanLevelStreak >= 10) unlockAchievement("clean_run");
      if (runState.cleanLevelStreak >= 25) unlockAchievement("clean_machine");
    }

    runState.completedLevels++;
    if (runState.completedLevels >= 25) unlockAchievement("long_haul");
    if (runState.completedLevels >= 50) unlockAchievement("marathon_slime");
    if (runState.completedLevels >= 100) unlockAchievement("century_slime");

    const actualCollectedStars = collectedStars === null
      ? NaN
      : Math.floor(Number(collectedStars));
    const actualTotalStars = totalStars === null
      ? NaN
      : Math.floor(Number(totalStars));
    const hasCollectibleStars =
      Number.isFinite(actualCollectedStars) &&
      Number.isFinite(actualTotalStars) &&
      actualCollectedStars >= 0 &&
      actualTotalStars > 0;
    const isPerfectClear =
      hasCollectibleStars && actualCollectedStars === actualTotalStars;
    if (isPerfectClear) {
      unlockAchievement("perfect_clear");
      runState.perfectClearLevels++;
      if (runState.perfectClearLevels >= 3) unlockAchievement("clean_sweep");
    }
    if (hasCollectibleStars && actualCollectedStars === 0) {
      unlockAchievement("empty_handed");
    }

    if (Math.floor(Number(remainingLives)) === 1) unlockAchievement("not_today");

    const levelHasGhost = hasGhost === null
      ? runState.levelHasGhost
      : Boolean(hasGhost);
    if (levelHasGhost && !runState.ghostHit) {
      unlockAchievement("ghostbuster");
      runState.ghostCleanLevels++;
      if (runState.ghostCleanLevels >= 5) unlockAchievement("ghost_whisperer");
    }
    if (runState.levelElapsed <= 5) {
      unlockAchievement("speed_slime");
      runState.speedLevels++;
      if (runState.speedLevels >= 3) unlockAchievement("speed_demon");
    }
    if (runState.levelElapsed >= 120 && !diedInLevel) {
      unlockAchievement("secret_take_your_time");
    }

    const completedBiomeId = String(biomeId ?? runState.biomeId ?? "");
    if (!diedInLevel && completedBiomeId === "snow") unlockAchievement("ice_cold");
    if (!diedInLevel && completedBiomeId === "volcano") unlockAchievement("hot_stuff");

    const completedLevelNumber = levelNumber === null
      ? runState.levelNumber
      : Math.max(1, Math.floor(Number(levelNumber) || 1));
    if (
      runState.groundhogLevelNumber === completedLevelNumber &&
      runState.groundhogDeaths >= 5
    ) {
      unlockAchievement("secret_groundhog_slime");
    }

    const providedShots = levelShots === null ? NaN : Math.floor(Number(levelShots));
    const actualShots = Number.isFinite(providedShots)
      ? Math.max(0, providedShots)
      : runState.levelShots;
    if (actualShots === 1) unlockAchievement("secret_one_shot");
    if (runState.rescueUsed) unlockAchievement("secret_second_chance");

    flushLifetimeAirTime({save: false});
    achievementProgress.lifetimeCompletedLevels++;
    if (perfectLevel) achievementProgress.lifetimePerfects++;

    const existingBiomeIds = getExistingBiomeIds();
    if (existingBiomeIds.includes(completedBiomeId)) {
      if (perfectLevel) {
        addUniqueProgressValue(achievementProgress.perfectBiomeIds, completedBiomeId);
      }
      if (!diedInLevel) {
        addUniqueProgressValue(achievementProgress.deathFreeBiomeIds, completedBiomeId);
      }
    }

    const lookKey = getCurrentLookKey();
    if (lookKey) addUniqueProgressValue(achievementProgress.completedLookIds, lookKey);
    saveAchievementProgress();
    checkPersistentProgressAchievements();
  }

  try {
    localStorage.setItem(
      ACHIEVEMENT_PROGRESS_VERSION_STORAGE_KEY,
      ACHIEVEMENT_PROGRESS_VERSION
    );
  } catch (_) {}

  window.SlimeAchievements = Object.freeze({
    registry: ACHIEVEMENT_REGISTRY,
    unlock: unlockAchievement,
    getUnlocked: () => unlockedAchievements.map(unlock => ({...unlock})),
    getRecent: getRecentAchievements,
    getSelectedBadgeIds: getSelectedAchievementBadgeIds,
    getProgress: () => ({
      discoveredBiomeIds: achievementProgress.discoveredBiomeIds.slice(),
      perfectBiomeIds: achievementProgress.perfectBiomeIds.slice(),
      deathFreeBiomeIds: achievementProgress.deathFreeBiomeIds.slice(),
      completedLookIds: achievementProgress.completedLookIds.slice(),
      lifetimeStars: achievementProgress.lifetimeStars,
      lifetimeAirTime: getLifetimeAirTime(),
      lifetimeCompletedLevels: achievementProgress.lifetimeCompletedLevels,
      lifetimeDeaths: achievementProgress.lifetimeDeaths,
      lifetimePerfects: achievementProgress.lifetimePerfects
    }),
    getLifetimeStats: () => ({
      stars: achievementProgress.lifetimeStars,
      airTime: getLifetimeAirTime(),
      completedLevels: achievementProgress.lifetimeCompletedLevels,
      deaths: achievementProgress.lifetimeDeaths,
      perfects: achievementProgress.lifetimePerfects
    }),
    renderMenu: renderAchievementMenu,
    renderRecent: renderRecentAchievements,
    checkWardrobe: checkWardrobeAchievements,
    isRunProgressSnapshotValid,
    captureRunProgressSnapshot,
    restoreRunProgressSnapshot,
    discardRunProgressSnapshot,
    onRunStart,
    onLevelStart,
    onLevelCompleted,
    onFrame,
    onShot,
    onStarCollected,
    onBounce,
    onLanding,
    onDeath,
    onGhostHit,
    onRescueUsed,
    onBiomeReached
  });

  window.SlimeStarEconomy = Object.freeze({
    itemPrice: WARDROBE_ITEM_STAR_PRICE,
    getBalance: () => starBalance,
    getLifetimeStars: () => achievementProgress.lifetimeStars,
    isPurchaseInProgress: () => activeWardrobePurchases.size > 0,
    canPurchaseWardrobeItem,
    purchaseWardrobeItem
  });

  window.SlimeDevShopTest = Object.freeze({
    itemPrice: WARDROBE_ITEM_STAR_PRICE,
    initialBalance: DEV_SHOP_TEST_INITIAL_BALANCE,
    isActive: () => devShopTestActive && isDevModeEnabled(),
    setActive: setDevShopTestActive,
    getBalance: () => devShopTestBalance,
    isItemUnlocked: isDevShopTestItemUnlocked,
    canPurchaseWardrobeItem: canPurchaseDevShopTestItem,
    purchaseWardrobeItem: purchaseDevShopTestItem
  });

  window.SlimeRunRecovery?.recoverInterruptedRun?.({
    isAchievementSnapshotValid: isRunProgressSnapshotValid,
    isWardrobeSnapshotValid: isWardrobeRunProgressSnapshotValid,
    restoreAchievementSnapshot: restoreRunProgressSnapshot,
    restoreWardrobeSnapshot: restoreWardrobeRunProgressSnapshot
  });

  checkWardrobeAchievements();
  checkPersistentProgressAchievements();
  checkAchievementHunter();
  renderAchievementViews();
})();
