"use strict";

  // Slime Jump 2.10 – neues How-to-Menü mit eingebauten Artwork-Screens, getrennten Musik-/FX-Mute-Buttons und Online-Top-10-Highscores via Supabase.

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const LOCAL_DEV_MODE_SESSION_KEY = "slimejumperLocalDevMode";

  function isNativeCapacitorRuntime() {
    const capacitor = window.Capacitor;
    if (!capacitor) return false;

    try {
      if (
        typeof capacitor.isNativePlatform === "function" &&
        capacitor.isNativePlatform()
      ) {
        return true;
      }
      if (typeof capacitor.getPlatform === "function") {
        return ["android", "ios"].includes(capacitor.getPlatform());
      }
    } catch (_) {}
    return false;
  }

  const IS_ANDROID_BROWSER_RUNTIME =
    typeof navigator !== "undefined" &&
    /Android/i.test(String(navigator.userAgent || ""));

  const IS_LOCALHOST_TEST_ENVIRONMENT =
    !isNativeCapacitorRuntime() &&
    !IS_ANDROID_BROWSER_RUNTIME &&
    (location.protocol === "http:" || location.protocol === "https:") &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1");

  function loadLocalDevModeEnabled() {
    if (!IS_LOCALHOST_TEST_ENVIRONMENT) return false;
    try {
      return sessionStorage.getItem(LOCAL_DEV_MODE_SESSION_KEY) !== "off";
    } catch (_) {
      return true;
    }
  }

  function setLocalDevModeEnabled(enabled) {
    if (!IS_LOCALHOST_TEST_ENVIRONMENT) return false;
    try {
      sessionStorage.setItem(
        LOCAL_DEV_MODE_SESSION_KEY,
        enabled ? "on" : "off"
      );
    } catch (error) {
      console.warn("Lokaler DEV-Modus konnte nicht umgeschaltet werden:", error);
      return false;
    }
    location.reload();
    return true;
  }

  const DEV_MODE = loadLocalDevModeEnabled();

  const ui = {
    level: document.getElementById("levelLabel"),
    lives: document.getElementById("livesLabel"),
    stars: document.getElementById("starsLabel"),
    shots: document.getElementById("shotsLabel"),
    score: document.getElementById("scoreLabel"),
    gameToast: document.getElementById("gameToast"),
    menu: document.getElementById("menuOverlay"),
    mainMenuScreen: document.getElementById("mainMenuScreen"),
    personalBestValue: document.getElementById("personalBestValue"),
    starBalanceValue: document.getElementById("starBalanceValue"),
    wardrobeScreen: document.getElementById("wardrobeScreen"),
    achievementScreen: document.getElementById("achievementScreen"),
    howToScreen: document.getElementById("howToScreen"),
    highscoreScreen: document.getElementById("highscoreScreen"),
    highscoreRows: document.getElementById("highscoreRows"),
    message: document.getElementById("messageOverlay"),
    tutorialCompleteOverlay: document.getElementById("tutorialCompleteOverlay"),
    tutorialSkipConfirmBtn: document.getElementById("tutorialSkipConfirmBtn"),
    tutorialSkipDeclineBtn: document.getElementById("tutorialSkipDeclineBtn"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    messageTitle: document.getElementById("messageTitle"),
    messageText: document.getElementById("messageText"),
    nicknameEntry: document.getElementById("nicknameEntry"),
    nicknameInput: document.getElementById("nicknameInput"),
    nicknameHint: document.getElementById("nicknameHint"),
    continueBtn: document.getElementById("continueBtn"),
    startBtn: document.getElementById("startBtn"),
    achievementsBtn: document.getElementById("achievementsBtn"),
    wardrobeBtn: document.getElementById("wardrobeBtn"),
    howToBtn: document.getElementById("howToBtn"),
    highScoresBtn: document.getElementById("highScoresBtn"),
    achievementsBackBtn: document.getElementById("achievementsBackBtn"),
    wardrobeBackBtn: document.getElementById("wardrobeBackBtn"),
    wardrobeHome: document.getElementById("wardrobeHome"),
    wardrobeColorView: document.getElementById("wardrobeColorView"),
    wardrobeCosmeticsView: document.getElementById("wardrobeCosmeticsView"),
    wardrobeBeardsView: document.getElementById("wardrobeBeardsView"),
    wardrobeColorMenuBtn: document.getElementById("wardrobeColorMenuBtn"),
    wardrobeCosmeticsMenuBtn: document.getElementById("wardrobeCosmeticsMenuBtn"),
    wardrobeBeardsMenuBtn: document.getElementById("wardrobeBeardsMenuBtn"),
    wardrobeColorBackBtn: document.getElementById("wardrobeColorBackBtn"),
    wardrobeCosmeticsBackBtn: document.getElementById("wardrobeCosmeticsBackBtn"),
    wardrobeBeardsBackBtn: document.getElementById("wardrobeBeardsBackBtn"),
    howToTopPanel: document.getElementById("howToTopPanel"),
    howToBackBtn: document.getElementById("howToBackBtn"),
    howToMechanicsPanel: document.getElementById("howToMechanicsPanel"),
    highScoresBackBtn: document.getElementById("highScoresBackBtn"),
    menuMascot: document.getElementById("menuMascot"),
    slimeColorOptions: document.getElementById("slimeColorOptions"),
    slimeColorRequirement: document.getElementById("slimeColorRequirement"),
    slimeCosmeticOptions: document.getElementById("slimeCosmeticOptions"),
    slimeBeardOptions: document.getElementById("slimeBeardOptions"),
    wardrobeUnlockPanel: document.getElementById("wardrobeUnlockPanel"),
    wardrobeUnlockText: document.getElementById("wardrobeUnlockText"),
    wardrobeUnlockCategories: document.getElementById("wardrobeUnlockCategories"),
    wardrobeUnlockOptions: document.getElementById("wardrobeUnlockOptions"),
    wardrobeUnlockBackBtn: document.getElementById("wardrobeUnlockBackBtn"),
    restartBtn: document.getElementById("restartBtn"),
    messageRestartBtn: document.getElementById("messageRestartBtn"),
    musicBtn: document.getElementById("musicBtn"),
    sfxBtn: document.getElementById("sfxBtn"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    pauseMusicBtn: document.getElementById("pauseMusicBtn"),
    pauseSfxBtn: document.getElementById("pauseSfxBtn"),
    endRunBtn: document.getElementById("endRunBtn"),
    endRunConfirmOverlay: document.getElementById("endRunConfirmOverlay"),
    endRunConfirmCancelBtn: document.getElementById("endRunConfirmCancelBtn"),
    endRunConfirmBtn: document.getElementById("endRunConfirmBtn"),
    skipEndRunWarningCheckbox: document.getElementById("skipEndRunWarningCheckbox"),
    devPanel: document.getElementById("devPanel"),
    devPreviousLevelBtn: document.getElementById("devPreviousLevelBtn"),
    devLevelInput: document.getElementById("devLevelInput"),
    devStartLevelBtn: document.getElementById("devStartLevelBtn"),
    devNextLevelBtn: document.getElementById("devNextLevelBtn"),
    devModeToggleBtn: document.getElementById("devModeToggleBtn"),
    devShopTestBtn: document.getElementById("devShopTestBtn")
  };

  let generatedLevel = null;
  let pendingGameOverScore = null;
  const STAGE_KIND_RUN = "run";
  const STAGE_KIND_TUTORIAL = "tutorial";
  let activeStageKind = STAGE_KIND_RUN;
  let tutorialStageIndex = null;

  function isTutorialStage() {
    return activeStageKind === STAGE_KIND_TUTORIAL;
  }

  function enterTutorialStage(stageIndex) {
    activeStageKind = STAGE_KIND_TUTORIAL;
    tutorialStageIndex = Math.max(0, Math.floor(Number(stageIndex) || 0));
  }

  function enterRunStage() {
    activeStageKind = STAGE_KIND_RUN;
    tutorialStageIndex = null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function random() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function randomRange(random, min, max) {
    return min + (max - min) * random();
  }

  function randomInt(random, min, max) {
    return Math.floor(randomRange(random, min, max + 1));
  }

  function chooseRandom(random, values) {
    return values[Math.floor(random() * values.length)];
  }

  function rectanglesOverlap(a, b, padding = 0) {
    return (
      a.x < b.x + b.w + padding &&
      a.x + a.w + padding > b.x &&
      a.y < b.y + b.h + padding &&
      a.y + a.h + padding > b.y
    );
  }

  let state = "menu";
  let levelIndex = 0;
  let lives = 3;
  let perfectLevelStreak = 0;
  let levelHadDeath = false;
  let score = 0;
  let shots = 0;
  let collected = [];
  let runStarsCollected = 0;
  let wardrobeUnlockCategory = null;
  let aiming = false;
  let pointer = {x: 0, y: 0};
  let drag = {x: 0, y: 0};
  let lastTime = performance.now();
  let worldTime = 0;
  let sfxMuted = false;
  let musicMuted = false;
  let audioCtx = null;
  let musicBus = null;
  let musicTimer = null;
  let musicMode = "menu";
  let musicStep = 0;
  let musicStarted = false;
  let nextAction = "next";
  let shake = 0;
  let particles = [];
  function currentLevel() { return generatedLevel; }

