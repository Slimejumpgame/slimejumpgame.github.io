(() => {
  "use strict";

  const PLAYER_LEVEL_STORAGE_KEY = "slimejumperPlayerLevel";
  const PLAYER_LEVEL_XP_STORAGE_KEY = "slimejumperPlayerLevelXP";

  const RUN_SCORE_TO_XP_DIVISOR = 15;
  const MAX_PLAYER_LEVEL = 100;
  const LEVEL_XP_BASE = 200;
  const LEVEL_XP_LINEAR_GROWTH = 60;
  const LEVEL_XP_QUADRATIC_GROWTH = 6;

  function calculateRunXP(finalScore) {
    const normalizedScore = Number(finalScore);
    if (!Number.isFinite(normalizedScore) || normalizedScore <= 0) return 0;
    const baseRunXP = Math.max(
      0,
      Math.floor(normalizedScore / RUN_SCORE_TO_XP_DIVISOR)
    );
    const prestigeMultiplier = window.SlimePrestige?.getXpMultiplier?.() ?? 1;
    return Math.max(0, Math.floor(baseRunXP * prestigeMultiplier));
  }

  function getXPRequiredForNextLevel(level) {
    const normalizedLevel = Math.floor(Number(level));
    if (
      !Number.isSafeInteger(normalizedLevel) ||
      normalizedLevel < 1 ||
      normalizedLevel > MAX_PLAYER_LEVEL
    ) {
      return 0;
    }

    const completedLevels = normalizedLevel - 1;
    return Math.floor(
      LEVEL_XP_BASE +
      LEVEL_XP_LINEAR_GROWTH * completedLevels +
      LEVEL_XP_QUADRATIC_GROWTH * completedLevels * completedLevels
    );
  }

  function normalizePlayerLevel(value) {
    const numericValue = Math.floor(Number(value));
    if (!Number.isSafeInteger(numericValue)) return 1;
    return Math.min(MAX_PLAYER_LEVEL, Math.max(1, numericValue));
  }

  function normalizePlayerLevelXP(value) {
    const numericValue = Math.floor(Number(value));
    return Number.isSafeInteger(numericValue) && numericValue > 0
      ? numericValue
      : 0;
  }

  function applyLevelThresholds(level, levelXP) {
    let nextLevel = normalizePlayerLevel(level);
    let nextLevelXP = normalizePlayerLevelXP(levelXP);

    while (nextLevel < MAX_PLAYER_LEVEL) {
      const requiredXP = getXPRequiredForNextLevel(nextLevel);
      if (nextLevelXP < requiredXP) break;
      nextLevelXP -= requiredXP;
      nextLevel++;
    }

    if (nextLevel >= MAX_PLAYER_LEVEL) {
      nextLevelXP = Math.min(
        nextLevelXP,
        getXPRequiredForNextLevel(MAX_PLAYER_LEVEL)
      );
    }
    return {level: nextLevel, levelXP: nextLevelXP};
  }

  function isProgressPrestigeReady(progress) {
    const requiredXP = getXPRequiredForNextLevel(MAX_PLAYER_LEVEL);
    return progress.level === MAX_PLAYER_LEVEL &&
      requiredXP > 0 &&
      progress.levelXP >= requiredXP;
  }

  function restoreStorageValue(key, value) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }

  function persistPlayerProgress(progress) {
    let previousLevel = null;
    let previousLevelXP = null;

    try {
      previousLevel = localStorage.getItem(PLAYER_LEVEL_STORAGE_KEY);
      previousLevelXP = localStorage.getItem(PLAYER_LEVEL_XP_STORAGE_KEY);
      localStorage.setItem(PLAYER_LEVEL_STORAGE_KEY, String(progress.level));
      localStorage.setItem(PLAYER_LEVEL_XP_STORAGE_KEY, String(progress.levelXP));

      if (
        localStorage.getItem(PLAYER_LEVEL_STORAGE_KEY) !== String(progress.level) ||
        localStorage.getItem(PLAYER_LEVEL_XP_STORAGE_KEY) !== String(progress.levelXP)
      ) {
        throw new Error("gespeicherter Fortschritt konnte nicht verifiziert werden");
      }
      return true;
    } catch (error) {
      console.error("[PlayerProgress] Level-Fortschritt konnte nicht gespeichert werden:", error);
      try {
        restoreStorageValue(PLAYER_LEVEL_STORAGE_KEY, previousLevel);
        restoreStorageValue(PLAYER_LEVEL_XP_STORAGE_KEY, previousLevelXP);
      } catch (rollbackError) {
        console.error("[PlayerProgress] Speicher-Rollback ist fehlgeschlagen:", rollbackError);
      }
      return false;
    }
  }

  function loadPlayerProgress() {
    let storedLevel = null;
    let storedLevelXP = null;

    try {
      storedLevel = localStorage.getItem(PLAYER_LEVEL_STORAGE_KEY);
      storedLevelXP = localStorage.getItem(PLAYER_LEVEL_XP_STORAGE_KEY);
    } catch (error) {
      console.error("[PlayerProgress] Level-Fortschritt konnte nicht gelesen werden:", error);
    }

    const progress = applyLevelThresholds(
      storedLevel === null ? 1 : storedLevel,
      storedLevelXP === null ? 0 : storedLevelXP
    );

    if (
      storedLevel !== String(progress.level) ||
      storedLevelXP !== String(progress.levelXP)
    ) {
      persistPlayerProgress(progress);
    }
    return progress;
  }

  let playerProgress = loadPlayerProgress();

  function getPlayerProgress() {
    const requiredXP = getXPRequiredForNextLevel(playerProgress.level);
    return {
      level: playerProgress.level,
      levelXP: playerProgress.levelXP,
      requiredXP,
      isMaxLevel: playerProgress.level >= MAX_PLAYER_LEVEL,
      isPrestigeReady: isProgressPrestigeReady(playerProgress)
    };
  }

  function isPrestigeReady() {
    return isProgressPrestigeReady(playerProgress);
  }

  function setPlayerProgressForDev(level, levelXP) {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE) return false;
    const nextProgress = applyLevelThresholds(level, levelXP);
    if (!persistPlayerProgress(nextProgress)) return false;
    playerProgress = nextProgress;
    return true;
  }

  function awardRunXP(finalScore) {
    const earnedXP = calculateRunXP(finalScore);
    const previousProgress = getPlayerProgress();
    const nextProgress = applyLevelThresholds(
      previousProgress.level,
      previousProgress.levelXP + earnedXP
    );
    const persisted = earnedXP === 0 || persistPlayerProgress(nextProgress);

    if (persisted) playerProgress = nextProgress;

    const currentProgress = getPlayerProgress();
    return {
      earnedXP: persisted ? earnedXP : 0,
      previousLevel: previousProgress.level,
      level: currentProgress.level,
      levelXP: currentProgress.levelXP,
      requiredXP: currentProgress.requiredXP,
      levelsGained: currentProgress.level - previousProgress.level,
      isMaxLevel: currentProgress.isMaxLevel,
      isPrestigeReady: currentProgress.isPrestigeReady,
      persisted
    };
  }

  window.SlimePlayerProgress = Object.freeze({
    playerLevelStorageKey: PLAYER_LEVEL_STORAGE_KEY,
    playerLevelXPStorageKey: PLAYER_LEVEL_XP_STORAGE_KEY,
    runScoreToXPDivisor: RUN_SCORE_TO_XP_DIVISOR,
    maxPlayerLevel: MAX_PLAYER_LEVEL,
    levelXPBase: LEVEL_XP_BASE,
    levelXPLinearGrowth: LEVEL_XP_LINEAR_GROWTH,
    levelXPQuadraticGrowth: LEVEL_XP_QUADRATIC_GROWTH,
    calculateRunXP,
    getXPRequiredForNextLevel,
    getPlayerProgress,
    isPrestigeReady,
    awardRunXP,
    setPlayerProgressForDev
  });
})();
