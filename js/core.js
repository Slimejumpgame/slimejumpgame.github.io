"use strict";

  // Slime Jump 2.10 – neues How-to-Menü mit eingebauten Artwork-Screens, getrennten Musik-/FX-Mute-Buttons und Online-Top-10-Highscores via Supabase.

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const BOTTOM_DEATH_THRESHOLD = H + 140;
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
  const GRAPHICS_MODE_STORAGE_KEY = "slimejumperGraphicsMode";
  const GRAPHICS_MODE_FAIRY_TALE = "fairyTale";
  const GRAPHICS_MODE_LEGACY = "legacy";

  function isValidGraphicsMode(mode) {
    return mode === GRAPHICS_MODE_FAIRY_TALE || mode === GRAPHICS_MODE_LEGACY;
  }

  function loadGraphicsMode() {
    try {
      const storedMode = localStorage.getItem(GRAPHICS_MODE_STORAGE_KEY);
      return isValidGraphicsMode(storedMode)
        ? storedMode
        : GRAPHICS_MODE_FAIRY_TALE;
    } catch (_) {
      return GRAPHICS_MODE_FAIRY_TALE;
    }
  }

  const ui = {
    level: document.getElementById("levelLabel"),
    lives: document.getElementById("livesLabel"),
    stars: document.getElementById("starsLabel"),
    shots: document.getElementById("shotsLabel"),
    score: document.getElementById("scoreLabel"),
    gameToast: document.getElementById("gameToast"),
    menu: document.getElementById("menuOverlay"),
    mainMenuScreen: document.getElementById("mainMenuScreen"),
    menuPersonalBest: document.getElementById("menuPersonalBest"),
    personalBestValue: document.getElementById("personalBestValue"),
    menuXPProgress: document.getElementById("menuXPProgress"),
    menuXPProgressText: document.getElementById("menuXPProgressText"),
    menuXPProgressBar: document.getElementById("menuXPProgressBar"),
    menuXPProgressBarFill: document.getElementById("menuXPProgressBarFill"),
    menuXPPlayerLevel: document.getElementById("menuXPPlayerLevel"),
    personalGlobalRank: document.getElementById("personalGlobalRank"),
    personalGlobalRankValue: document.getElementById("personalGlobalRankValue"),
    menuStarBalance: document.getElementById("menuStarBalance"),
    starBalanceValue: document.getElementById("starBalanceValue"),
    recentAchievements: document.getElementById("recentAchievements"),
    mainMenuGraphics: document.getElementById("mainMenuGraphics"),
    mainMenuOnboardingOverlay: document.getElementById("mainMenuOnboardingOverlay"),
    mainMenuOnboardingSafeArea: document.getElementById("mainMenuOnboardingSafeArea"),
    mainMenuOnboardingHighlight: document.getElementById("mainMenuOnboardingHighlight"),
    mainMenuOnboardingBubble: document.getElementById("mainMenuOnboardingBubble"),
    mainMenuOnboardingTitle: document.getElementById("mainMenuOnboardingTitle"),
    mainMenuOnboardingCount: document.getElementById("mainMenuOnboardingCount"),
    mainMenuOnboardingText: document.getElementById("mainMenuOnboardingText"),
    mainMenuOnboardingNavigation: document.getElementById("mainMenuOnboardingNavigation"),
    mainMenuOnboardingDecision: document.getElementById("mainMenuOnboardingDecision"),
    mainMenuOnboardingBackBtn: document.getElementById("mainMenuOnboardingBackBtn"),
    mainMenuOnboardingNextBtn: document.getElementById("mainMenuOnboardingNextBtn"),
    mainMenuOnboardingSkipBtn: document.getElementById("mainMenuOnboardingSkipBtn"),
    mainMenuOnboardingLaterBtn: document.getElementById("mainMenuOnboardingLaterBtn"),
    mainMenuOnboardingNeverBtn: document.getElementById("mainMenuOnboardingNeverBtn"),
    wardrobeScreen: document.getElementById("wardrobeScreen"),
    achievementScreen: document.getElementById("achievementScreen"),
    perksScreen: document.getElementById("perksScreen"),
    howToScreen: document.getElementById("howToScreen"),
    highscoreScreen: document.getElementById("highscoreScreen"),
    highscoreRows: document.getElementById("highscoreRows"),
    menuPlayerLevel: document.getElementById("menuPlayerLevel"),
    menuPrestigeBtn: document.getElementById("menuPrestigeBtn"),
    menuPrestigeEmblem: document.getElementById("menuPrestigeEmblem"),
    menuPrestigeLabel: document.getElementById("menuPrestigeLabel"),
    updateOverlay: document.getElementById("updateOverlay"),
    updateInstalledVersion: document.getElementById("updateInstalledVersion"),
    updateNewVersion: document.getElementById("updateNewVersion"),
    updateNotesList: document.getElementById("updateNotesList"),
    updateOpenStoreBtn: document.getElementById("updateOpenStoreBtn"),
    updateLaterBtn: document.getElementById("updateLaterBtn"),
    prestigeConfirmOverlay: document.getElementById("prestigeConfirmOverlay"),
    prestigeConfirmCancelBtn: document.getElementById("prestigeConfirmCancelBtn"),
    prestigeConfirmBtn: document.getElementById("prestigeConfirmBtn"),
    prestigeCustomizationOverlay: document.getElementById("prestigeCustomizationOverlay"),
    prestigeCustomizationEmblem: document.getElementById("prestigeCustomizationEmblem"),
    prestigeCustomizationLevel: document.getElementById("prestigeCustomizationLevel"),
    prestigePermanentUnlockCount: document.getElementById("prestigePermanentUnlockCount"),
    prestigeFrameSelect: document.getElementById("prestigeFrameSelect"),
    prestigeTitleSelect: document.getElementById("prestigeTitleSelect"),
    prestigeAuraSelect: document.getElementById("prestigeAuraSelect"),
    prestigeTrailSelect: document.getElementById("prestigeTrailSelect"),
    prestigeCustomizationCloseBtn: document.getElementById("prestigeCustomizationCloseBtn"),
    prestigeCustomizationActivateBtn: document.getElementById("prestigeCustomizationActivateBtn"),
    prestigeWardrobeChoiceOverlay: document.getElementById("prestigeWardrobeChoiceOverlay"),
    prestigeWardrobeChoiceText: document.getElementById("prestigeWardrobeChoiceText"),
    prestigeWardrobeChoiceCategories: document.getElementById("prestigeWardrobeChoiceCategories"),
    prestigeWardrobeChoiceOptions: document.getElementById("prestigeWardrobeChoiceOptions"),
    prestigeWardrobeChoiceConfirmation: document.getElementById("prestigeWardrobeChoiceConfirmation"),
    prestigeWardrobeChoiceConfirmationName: document.getElementById("prestigeWardrobeChoiceConfirmationName"),
    prestigeWardrobeChoiceConfirmBtn: document.getElementById("prestigeWardrobeChoiceConfirmBtn"),
    prestigeWardrobeChoiceBackBtn: document.getElementById("prestigeWardrobeChoiceBackBtn"),
    prestigeWardrobeChoiceCloseBtn: document.getElementById("prestigeWardrobeChoiceCloseBtn"),
    message: document.getElementById("messageOverlay"),
    checkpointOverlay: document.getElementById("checkpointOverlay"),
    checkpointDialogTitle: document.getElementById("checkpointDialogTitle"),
    checkpointDialogText: document.getElementById("checkpointDialogText"),
    checkpointIntroPreference: document.getElementById("checkpointIntroPreference"),
    checkpointIntroCheckbox: document.getElementById("checkpointIntroCheckbox"),
    checkpointIntroConfirmBtn: document.getElementById("checkpointIntroConfirmBtn"),
    checkpointLevelOneBtn: document.getElementById("checkpointLevelOneBtn"),
    checkpointLevelOneValue: document.getElementById("checkpointLevelOneValue"),
    checkpointLevelOneMultiplier: document.getElementById("checkpointLevelOneMultiplier"),
    checkpointLevelBtn: document.getElementById("checkpointLevelBtn"),
    checkpointLevelValue: document.getElementById("checkpointLevelValue"),
    checkpointLevelMultiplier: document.getElementById("checkpointLevelMultiplier"),
    perkConflictPurchaseInfoOverlay: document.getElementById("perkConflictPurchaseInfoOverlay"),
    perkConflictPurchaseInfoTitle: document.getElementById("perkConflictPurchaseInfoTitle"),
    perkConflictPurchaseInfoText: document.getElementById("perkConflictPurchaseInfoText"),
    perkConflictPurchaseInfoConfirmBtn: document.getElementById("perkConflictPurchaseInfoConfirmBtn"),
    goldShopIntroOverlay: document.getElementById("goldShopIntroOverlay"),
    goldShopIntroSkipCheckbox: document.getElementById("goldShopIntroSkipCheckbox"),
    goldShopIntroConfirmBtn: document.getElementById("goldShopIntroConfirmBtn"),
    checkpointBonusHud: document.getElementById("checkpointBonusHud"),
    checkpointBonusMultiplier: document.getElementById("checkpointBonusMultiplier"),
    runXPBonusHud: document.getElementById("runXPBonusHud"),
    runXPBonusMultiplier: document.getElementById("runXPBonusMultiplier"),
    prestigeXPBonusHud: document.getElementById("prestigeXPBonusHud"),
    prestigeXPBonusMultiplier: document.getElementById("prestigeXPBonusMultiplier"),
    tutorialCompleteOverlay: document.getElementById("tutorialCompleteOverlay"),
    tutorialSkipConfirmBtn: document.getElementById("tutorialSkipConfirmBtn"),
    tutorialSkipDeclineBtn: document.getElementById("tutorialSkipDeclineBtn"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    messageTitle: document.getElementById("messageTitle"),
    messageText: document.getElementById("messageText"),
    gameOverXPPanel: document.getElementById("gameOverXPPanel"),
    gameOverXPEarned: document.getElementById("gameOverXPEarned"),
    gameOverLevelUp: document.getElementById("gameOverLevelUp"),
    gameOverPlayerLevel: document.getElementById("gameOverPlayerLevel"),
    gameOverXPBar: document.getElementById("gameOverXPBar"),
    gameOverXPBarFill: document.getElementById("gameOverXPBarFill"),
    gameOverXPProgress: document.getElementById("gameOverXPProgress"),
    nicknameEntry: document.getElementById("nicknameEntry"),
    nicknameInput: document.getElementById("nicknameInput"),
    nicknameHint: document.getElementById("nicknameHint"),
    continueBtn: document.getElementById("continueBtn"),
    startBtn: document.getElementById("startBtn"),
    achievementsBtn: document.getElementById("achievementsBtn"),
    wardrobeBtn: document.getElementById("wardrobeBtn"),
    perksBtn: document.getElementById("perksBtn"),
    highScoresBtn: document.getElementById("highScoresBtn"),
    achievementsBackBtn: document.getElementById("achievementsBackBtn"),
    perksBackBtn: document.getElementById("perksBackBtn"),
    perksSummary: document.getElementById("perksSummary"),
    perksSummaryLabel: document.getElementById("perksSummaryLabel"),
    activePerkCount: document.getElementById("activePerkCount"),
    perkGrid: document.getElementById("perkGrid"),
    devPerkPurchaseResetBtn: document.getElementById("devPerkPurchaseResetBtn"),
    wardrobeBackBtn: document.getElementById("wardrobeBackBtn"),
    wardrobeHome: document.getElementById("wardrobeHome"),
    wardrobeColorView: document.getElementById("wardrobeColorView"),
    wardrobeCosmeticsView: document.getElementById("wardrobeCosmeticsView"),
    wardrobeBeardsView: document.getElementById("wardrobeBeardsView"),
    wardrobeGoldView: document.getElementById("wardrobeGoldView"),
    wardrobePrestigeView: document.getElementById("wardrobePrestigeView"),
    wardrobeColorMenuBtn: document.getElementById("wardrobeColorMenuBtn"),
    wardrobeCosmeticsMenuBtn: document.getElementById("wardrobeCosmeticsMenuBtn"),
    wardrobeBeardsMenuBtn: document.getElementById("wardrobeBeardsMenuBtn"),
    wardrobeGoldMenuBtn: document.getElementById("wardrobeGoldMenuBtn"),
    wardrobePrestigeMenuBtn: document.getElementById("wardrobePrestigeMenuBtn"),
    wardrobeColorBackBtn: document.getElementById("wardrobeColorBackBtn"),
    wardrobeCosmeticsBackBtn: document.getElementById("wardrobeCosmeticsBackBtn"),
    wardrobeBeardsBackBtn: document.getElementById("wardrobeBeardsBackBtn"),
    wardrobeGoldBackBtn: document.getElementById("wardrobeGoldBackBtn"),
    wardrobePrestigeBackBtn: document.getElementById("wardrobePrestigeBackBtn"),
    goldShopStatusText: document.getElementById("goldShopStatusText"),
    goldShopStatusHint: document.getElementById("goldShopStatusHint"),
    goldHatProgress: document.getElementById("goldHatProgress"),
    goldBeardProgress: document.getElementById("goldBeardProgress"),
    goldWardrobeCategories: document.getElementById("goldWardrobeCategories"),
    goldCategoryUnlockInfo: document.getElementById("goldCategoryUnlockInfo"),
    goldWardrobeOptions: document.getElementById("goldWardrobeOptions"),
    wardrobePrestigeEmblem: document.getElementById("wardrobePrestigeEmblem"),
    wardrobePrestigeLevel: document.getElementById("wardrobePrestigeLevel"),
    wardrobePrestigeActivateBtn: document.getElementById("wardrobePrestigeActivateBtn"),
    wardrobePrestigeCategories: document.getElementById("wardrobePrestigeCategories"),
    wardrobePrestigeOptions: document.getElementById("wardrobePrestigeOptions"),
    howToTopPanel: document.getElementById("howToTopPanel"),
    howToBackBtn: document.getElementById("howToBackBtn"),
    howToMechanicsPanel: document.getElementById("howToMechanicsPanel"),
    highScoresBackBtn: document.getElementById("highScoresBackBtn"),
    menuMascot: document.getElementById("menuMascot"),
    slimeColorOptions: document.getElementById("slimeColorOptions"),
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
    fairyTaleGraphicsBtn: document.getElementById("fairyTaleGraphicsBtn"),
    legacyGraphicsBtn: document.getElementById("legacyGraphicsBtn"),
    pauseFairyTaleGraphicsBtn: document.getElementById("pauseFairyTaleGraphicsBtn"),
    pauseLegacyGraphicsBtn: document.getElementById("pauseLegacyGraphicsBtn"),
    endRunBtn: document.getElementById("endRunBtn"),
    endRunConfirmOverlay: document.getElementById("endRunConfirmOverlay"),
    endRunConfirmCancelBtn: document.getElementById("endRunConfirmCancelBtn"),
    endRunConfirmBtn: document.getElementById("endRunConfirmBtn"),
    skipEndRunWarningCheckbox: document.getElementById("skipEndRunWarningCheckbox"),
    devPanel: document.getElementById("devPanel"),
    devPreviousLevelBtn: document.getElementById("devPreviousLevelBtn"),
    devLevelInput: document.getElementById("devLevelInput"),
    devStartLevelBtn: document.getElementById("devStartLevelBtn"),
    devCheckpoint100Btn: document.getElementById("devCheckpoint100Btn"),
    devNextLevelBtn: document.getElementById("devNextLevelBtn"),
    devModeToggleBtn: document.getElementById("devModeToggleBtn"),
    devTutorialToggleBtn: document.getElementById("devTutorialToggleBtn"),
    devStoryTestBtn: document.getElementById("devStoryTestBtn"),
    devShopTestBtn: document.getElementById("devShopTestBtn"),
    devGoldSlimeTestBtn: document.getElementById("devGoldSlimeTestBtn"),
    devGoldHatsTestBtn: document.getElementById("devGoldHatsTestBtn"),
    devGoldBeardsTestBtn: document.getElementById("devGoldBeardsTestBtn"),
    devGoldAllTestBtn: document.getElementById("devGoldAllTestBtn"),
    devGoldShopTestBtn: document.getElementById("devGoldShopTestBtn"),
    devGoldSlimeBoundaryBtn: document.getElementById("devGoldSlimeBoundaryBtn"),
    devGoldHatBoundaryBtn: document.getElementById("devGoldHatBoundaryBtn"),
    devGoldBeardBoundaryBtn: document.getElementById("devGoldBeardBoundaryBtn"),
    devGoldResetBtn: document.getElementById("devGoldResetBtn"),
    devPlayerLevel100Btn: document.getElementById("devPlayerLevel100Btn"),
    devPlayerLevel99NearBtn: document.getElementById("devPlayerLevel99NearBtn"),
    devPlayerLevel100NearBtn: document.getElementById("devPlayerLevel100NearBtn"),
    devPrestigeReadyBtn: document.getElementById("devPrestigeReadyBtn"),
    devPrestigeDownBtn: document.getElementById("devPrestigeDownBtn"),
    devPrestigeUpBtn: document.getElementById("devPrestigeUpBtn"),
    devPrestigeZeroBtn: document.getElementById("devPrestigeZeroBtn"),
    devPrestigeFlowBtn: document.getElementById("devPrestigeFlowBtn"),
    devPrestigePermanentChoiceBtn: document.getElementById("devPrestigePermanentChoiceBtn"),
    devPrestigeRewardInspectorBtn: document.getElementById("devPrestigeRewardInspectorBtn"),
    devPrestigeRewardInspector: document.getElementById("devPrestigeRewardInspector"),
    devUnlockPerksBtn: document.getElementById("devUnlockPerksBtn"),
    devForceLuckyStarBtn: document.getElementById("devForceLuckyStarBtn"),
    devPerkInspectorBtn: document.getElementById("devPerkInspectorBtn"),
    devPerkInspector: document.getElementById("devPerkInspector"),
    devUpdateScreenTestBtn: document.getElementById("devUpdateScreenTestBtn")
  };

  let graphicsMode = loadGraphicsMode();

  function isFairyTaleGraphicsMode() {
    return graphicsMode === GRAPHICS_MODE_FAIRY_TALE;
  }

  function updateGraphicsModeButtons() {
    const buttonModes = [
      [ui.fairyTaleGraphicsBtn, GRAPHICS_MODE_FAIRY_TALE],
      [ui.legacyGraphicsBtn, GRAPHICS_MODE_LEGACY],
      [ui.pauseFairyTaleGraphicsBtn, GRAPHICS_MODE_FAIRY_TALE],
      [ui.pauseLegacyGraphicsBtn, GRAPHICS_MODE_LEGACY]
    ];
    for (const [button, mode] of buttonModes) {
      if (!button) continue;
      const active = graphicsMode === mode;
      button.classList.toggle("active", active);
      button.classList.toggle("uiButton--primary", active);
      button.classList.toggle("uiButton--secondary", !active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function setGraphicsMode(mode) {
    if (!isValidGraphicsMode(mode)) return false;
    const changed = graphicsMode !== mode;
    graphicsMode = mode;
    try {
      localStorage.setItem(GRAPHICS_MODE_STORAGE_KEY, graphicsMode);
    } catch (_) {}
    updateGraphicsModeButtons();
    if (changed) {
      if (typeof refreshMenuBiomeBackgroundForGraphicsMode === "function") {
        refreshMenuBiomeBackgroundForGraphicsMode();
      }
      if (typeof renderMenuMascot === "function") renderMenuMascot();
    }
    return true;
  }

  ui.fairyTaleGraphicsBtn?.addEventListener("click", () => {
    setGraphicsMode(GRAPHICS_MODE_FAIRY_TALE);
  });
  ui.legacyGraphicsBtn?.addEventListener("click", () => {
    setGraphicsMode(GRAPHICS_MODE_LEGACY);
  });
  ui.pauseFairyTaleGraphicsBtn?.addEventListener("click", () => {
    setGraphicsMode(GRAPHICS_MODE_FAIRY_TALE);
  });
  ui.pauseLegacyGraphicsBtn?.addEventListener("click", () => {
    setGraphicsMode(GRAPHICS_MODE_LEGACY);
  });
  updateGraphicsModeButtons();

  let generatedLevel = null;
  let pendingGameOverScore = null;
  let activeRunXPAwarded = true;
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
  let runStartLevel = 1;
  let runStartedFromCheckpoint = false;
  let runScoreMultiplier = 1;
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

