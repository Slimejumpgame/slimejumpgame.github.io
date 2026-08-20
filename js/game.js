"use strict";

  const MAX_LIVES = 5;
  const PERFECT_LEVEL_STREAK_TARGET = 3;
  const SKIP_END_RUN_WARNING_STORAGE_KEY = "slimejumperSkipEndRunWarning";
  const SKIP_TUTORIAL_STORAGE_KEY = "slimejumperSkipTutorial";
  const HIGHEST_CHECKPOINT_STORAGE_KEY = "slimejumperHighestCheckpointLevel";
  const SKIP_CHECKPOINT_INTRO_STORAGE_KEY = "slimejumperSkipCheckpointIntro";
  const CHECKPOINT_SCORE_MULTIPLIER_STEP = 0.05;
  const MAX_CHECKPOINT_SCORE_MULTIPLIER = 2;

  function normalizeCheckpointLevel(value) {
    const numericValue = Number(value);
    if (!Number.isSafeInteger(numericValue)) return 0;
    if (numericValue === 0) return 0;
    return numericValue >= 10 && numericValue % 10 === 0
      ? numericValue
      : 0;
  }

  function getCheckpointFromReachedLevel(value) {
    const numericValue = Math.floor(Number(value));
    if (!Number.isSafeInteger(numericValue) || numericValue < 10) return 0;
    return Math.floor(numericValue / 10) * 10;
  }

  function loadHighestCheckpointLevel() {
    try {
      const storedValue = localStorage.getItem(HIGHEST_CHECKPOINT_STORAGE_KEY);
      if (storedValue !== null) {
        const checkpoint = normalizeCheckpointLevel(storedValue);
        if (storedValue !== String(checkpoint)) {
          localStorage.setItem(HIGHEST_CHECKPOINT_STORAGE_KEY, String(checkpoint));
        }
        return checkpoint;
      }

      const migratedCheckpoint = getCheckpointFromReachedLevel(
        localStorage.getItem("slimejumperBestLevel")
      );
      localStorage.setItem(
        HIGHEST_CHECKPOINT_STORAGE_KEY,
        String(migratedCheckpoint)
      );
      return migratedCheckpoint;
    } catch (_) {
      return 0;
    }
  }

  let highestCheckpointLevel = loadHighestCheckpointLevel();
  let checkpointLevelAtRunStart = highestCheckpointLevel;
  let checkpointIntroShownThisSession = false;

  function getHighestCheckpointLevel() {
    try {
      const storedValue = localStorage.getItem(HIGHEST_CHECKPOINT_STORAGE_KEY);
      const storedCheckpoint = normalizeCheckpointLevel(
        storedValue
      );
      highestCheckpointLevel = Math.max(
        highestCheckpointLevel,
        storedCheckpoint
      );
      if (storedValue !== String(highestCheckpointLevel)) {
        localStorage.setItem(
          HIGHEST_CHECKPOINT_STORAGE_KEY,
          String(highestCheckpointLevel)
        );
      }
    } catch (_) {}
    return highestCheckpointLevel;
  }

  function recordReachedCheckpoint(levelNumber) {
    const reachedCheckpoint = normalizeCheckpointLevel(levelNumber);
    if (reachedCheckpoint === 0) return getHighestCheckpointLevel();

    let storedCheckpoint = 0;
    try {
      storedCheckpoint = normalizeCheckpointLevel(
        localStorage.getItem(HIGHEST_CHECKPOINT_STORAGE_KEY)
      );
    } catch (_) {}

    const nextCheckpoint = Math.max(
      highestCheckpointLevel,
      storedCheckpoint,
      reachedCheckpoint
    );
    highestCheckpointLevel = nextCheckpoint;

    if (nextCheckpoint > storedCheckpoint) {
      try {
        localStorage.setItem(
          HIGHEST_CHECKPOINT_STORAGE_KEY,
          String(nextCheckpoint)
        );
      } catch (_) {}
    }

    return highestCheckpointLevel;
  }

  function captureCheckpointLevelAtRunStart() {
    checkpointLevelAtRunStart = getHighestCheckpointLevel();
    return checkpointLevelAtRunStart;
  }

  function restoreCheckpointLevelAtRunStart() {
    const checkpoint = normalizeCheckpointLevel(checkpointLevelAtRunStart);
    try {
      localStorage.setItem(HIGHEST_CHECKPOINT_STORAGE_KEY, String(checkpoint));
    } catch (_) {
      return false;
    }
    highestCheckpointLevel = checkpoint;
    return true;
  }

  function getCheckpointScoreMultiplier(levelNumber) {
    const checkpoint = normalizeCheckpointLevel(levelNumber);
    if (checkpoint === 0) return 1;
    const multiplier = 1 + checkpoint / 10 * CHECKPOINT_SCORE_MULTIPLIER_STEP;
    return Math.min(
      MAX_CHECKPOINT_SCORE_MULTIPLIER,
      Number(multiplier.toFixed(2))
    );
  }

  function formatScoreMultiplier(multiplier) {
    return `x${multiplier.toFixed(2)}`;
  }

  function getPrestigeXPDisplayMultiplier() {
    const prestigeLevel = window.SlimePrestige?.getLevel?.() ?? 0;
    return window.SlimePlayerProgress?.calculateRunXPMultiplier?.(
      prestigeLevel,
      0
    ) ?? 1;
  }

  function getRunXPDisplayMultiplier() {
    const prestigeLevel = window.SlimePrestige?.getLevel?.() ?? 0;
    const selectedRunStartCheckpoint = runStartedFromCheckpoint
      ? runStartLevel
      : 0;
    return window.SlimePlayerProgress?.calculateRunXPMultiplier?.(
      prestigeLevel,
      selectedRunStartCheckpoint
    ) ?? 1;
  }

  function formatPrestigeXPMultiplier(multiplier) {
    const normalizedMultiplier = Number.isFinite(Number(multiplier))
      ? Number(multiplier)
      : 1;
    return `x${normalizedMultiplier.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function updateCheckpointBonusHUD() {
    const multiplierText = formatScoreMultiplier(runScoreMultiplier);
    ui.checkpointBonusMultiplier.textContent = multiplierText;
    ui.checkpointBonusHud.setAttribute(
      "aria-label",
      `Checkpoint-Bonus ab Level ${runStartLevel}: ${multiplierText}`
    );
    const runIsVisible = ["playing", "paused", "gamePaused"].includes(state);
    ui.checkpointBonusHud.classList.toggle(
      "hidden",
      !runIsVisible || !runStartedFromCheckpoint || runScoreMultiplier <= 1
    );
    if (ui.runXPBonusHud && ui.runXPBonusMultiplier) {
      const runXPMultiplierText = formatPrestigeXPMultiplier(
        getRunXPDisplayMultiplier()
      );
      ui.runXPBonusMultiplier.textContent = runXPMultiplierText;
      ui.runXPBonusHud.setAttribute(
        "aria-label",
        `Run-XP-Multiplikator ${runXPMultiplierText}`
      );
      ui.runXPBonusHud.classList.toggle("hidden", !runIsVisible);
    }
    if (ui.prestigeXPBonusHud && ui.prestigeXPBonusMultiplier) {
      const prestigeLevel = window.SlimePrestige?.getLevel?.() ?? 0;
      const prestigeMultiplierText = formatPrestigeXPMultiplier(
        getPrestigeXPDisplayMultiplier()
      );
      ui.prestigeXPBonusMultiplier.textContent = prestigeMultiplierText;
      ui.prestigeXPBonusHud.setAttribute(
        "aria-label",
        `Prestige-XP-Bonus ${prestigeMultiplierText}`
      );
      ui.prestigeXPBonusHud.classList.toggle(
        "hidden",
        !runIsVisible || prestigeLevel < 1
      );
    }
  }

  function initializeRunScoreState(startLevel, {fromCheckpoint = false} = {}) {
    const numericStartLevel = Math.floor(Number(startLevel));
    runStartLevel = Number.isSafeInteger(numericStartLevel) && numericStartLevel > 0
      ? numericStartLevel
      : 1;
    runStartedFromCheckpoint =
      fromCheckpoint && normalizeCheckpointLevel(runStartLevel) === runStartLevel;
    runScoreMultiplier = runStartedFromCheckpoint
      ? getCheckpointScoreMultiplier(runStartLevel)
      : 1;
    updateCheckpointBonusHUD();
  }

  function awardRunScore(points, {deduction = 0} = {}) {
    const positivePoints = Number(points);
    if (!Number.isFinite(positivePoints) || positivePoints <= 0) return 0;
    const numericDeduction = Number(deduction);
    const safeDeduction = Number.isFinite(numericDeduction)
      ? Math.round(Math.max(0, numericDeduction))
      : 0;
    const awardedPoints = Math.max(
      0,
      Math.round(positivePoints * runScoreMultiplier) - safeDeduction
    );
    score += awardedPoints;
    return awardedPoints;
  }

  function getAchievementLevelContext() {
    const levelNumber = levelIndex + 1;
    const level = currentLevel();
    return {
      levelNumber,
      biomeId: getBiomeForLevel(levelNumber).id,
      hasGhost: Array.isArray(level?.enemies) && level.enemies.length > 0
    };
  }

  function resetFallingPlatforms(level = currentLevel()) {
    if (!level?.fallingPlatforms) return;
    for (const platform of level.fallingPlatforms) {
      platform.currentY = platform.y;
      platform.timer = 0;
      platform.vy = 0;
      platform.triggered = false;
      platform.falling = false;
      platform.removed = false;
    }
  }

  function resetLevel(resetShots = true) {
    if (!generatedLevel) {
      generatedLevel = generateProceduralLevel(levelIndex + 1);
    }
    const level = currentLevel();
    resetFlightPerkState();
    if (isTutorialStage() && level.showDragHand === true) {
      resetTutorialDragHand();
    }
    resetFallingPlatforms(level);
    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.onIce = false;
    player.squish = 0;
    player.trail = [];
    aiming = false;
    stuckAimFallbackActive = false;
    resetStuckAimTimer();
    drag.x = drag.y = 0;
    if (resetShots) shots = 0;
    collected = level.stars.map(() => false);
    particles = [];
    updateHUD();
    if (DEV_MODE) ui.devLevelInput.value = String(levelIndex + 1);
  }

  async function startGame(levelNumber = 1, {fromCheckpoint = false} = {}) {
    if (pendingGameOverScore && !(await commitPendingHighScore())) return false;
    const achievementRunSnapshot =
      window.SlimeAchievements?.captureRunProgressSnapshot?.();
    const wardrobeRunSnapshot = captureWardrobeRunProgressSnapshot();
    const recoveryStarted = window.SlimeRunRecovery?.beginActiveRun?.({
      achievementSnapshot: achievementRunSnapshot,
      wardrobeSnapshot: wardrobeRunSnapshot
    }) === true;
    if (!recoveryStarted) {
      window.SlimeAchievements?.discardRunProgressSnapshot?.();
      discardWardrobeRunProgressSnapshot();
      console.error("[RunRecovery] Runstart ohne persistenten Pre-Run-Snapshot verhindert.");
      showGameToast("Run konnte nicht sicher gestartet werden.");
      return false;
    }
    activeRunXPAwarded = false;

    captureCheckpointLevelAtRunStart();
    initializeRunScoreState(levelNumber, {fromCheckpoint});
    window.SlimePerks?.captureRunPerkSnapshot?.();
    resetRunPerkConsumables();
    enterRunStage();
    hideNicknameEntry();
    hideGameToast();
    getAudio();
    state = "playing";
    levelIndex = levelNumber - 1;
    setMusicForLevel(levelIndex + 1);
    if (!musicMuted) startBackgroundMusic();
    const extraLifeBonus = window.SlimePerks?.isActiveForRun?.("extra_life")
      ? window.SlimePerks.balance.EXTRA_LIFE_BONUS
      : 0;
    lives = Math.min(MAX_LIVES, 3 + extraLifeBonus);
    perfectLevelStreak = 0;
    levelHadDeath = false;
    score = 0;
    shots = 0;
    runStarsCollected = 0;
    resetWardrobeUnlockAwardForRun();
    wardrobeUnlockCategory = null;
    hideWardrobeUnlockPanel();
    generatedLevel = generateProceduralLevel(levelNumber);
    ui.menu.classList.add("hidden");
    showMenuScreen("main");
    ui.message.classList.add("hidden");
    resetLevel(true);
    window.SlimeAchievements?.onRunStart?.(getAchievementLevelContext());
    renderDevPerkInspector();
    return true;
  }

  async function startTutorialSequence() {
    if (pendingGameOverScore && !(await commitPendingHighScore())) return false;
    hideNicknameEntry();
    hideGameToast();
    initializeRunScoreState(1);
    window.SlimePerks?.clearRunPerkSnapshot?.();
    resetRunPerkConsumables();
    getAudio();
    enterTutorialStage(0);
    state = "playing";
    setMusicForLevel(1);
    if (!musicMuted) startBackgroundMusic();
    lives = 3;
    score = 0;
    shots = 0;
    generatedLevel = createTutorialLevel(tutorialStageIndex);
    ui.menu.classList.add("hidden");
    showMenuScreen("main");
    ui.message.classList.add("hidden");
    resetLevel(true);
    return true;
  }

  function shouldSkipTutorialFromPlay() {
    try {
      return localStorage.getItem(SKIP_TUTORIAL_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function shouldSkipCheckpointIntro() {
    try {
      return localStorage.getItem(SKIP_CHECKPOINT_INTRO_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function showCheckpointIntro() {
    checkpointIntroShownThisSession = true;
    ui.checkpointDialogTitle.textContent = "Checkpoint freigeschaltet!";
    ui.checkpointDialogText.textContent =
      "Starte neue Runs bei Level 1 oder deinem höchsten Checkpoint. Je höher dein gewählter Checkpoint, desto höher dein Score-Multiplikator.";
    ui.checkpointIntroPreference.classList.remove("hidden");
    ui.checkpointIntroCheckbox.checked = false;
    ui.checkpointIntroConfirmBtn.classList.remove("hidden");
    ui.checkpointLevelOneBtn.classList.add("hidden");
    ui.checkpointLevelBtn.classList.add("hidden");
    ui.checkpointOverlay.classList.remove("hidden");
    return true;
  }

  function showCheckpointStartSelection() {
    const checkpoint = getHighestCheckpointLevel();
    if (checkpoint === 0) return startGame(1);

    ui.checkpointDialogTitle.textContent = "Run starten";
    ui.checkpointDialogText.textContent = "Wähle dein Startlevel.";
    ui.checkpointIntroPreference.classList.add("hidden");
    ui.checkpointIntroConfirmBtn.classList.add("hidden");
    ui.checkpointLevelOneValue.textContent = "Level 1";
    ui.checkpointLevelOneMultiplier.textContent =
      `Score ${formatScoreMultiplier(1)}`;
    ui.checkpointLevelOneBtn.classList.remove("hidden");
    ui.checkpointLevelValue.textContent = `Level ${checkpoint}`;
    ui.checkpointLevelMultiplier.textContent =
      `Score ${formatScoreMultiplier(getCheckpointScoreMultiplier(checkpoint))}`;
    ui.checkpointLevelBtn.classList.remove("hidden");
    ui.checkpointLevelOneBtn.disabled = false;
    ui.checkpointLevelBtn.disabled = false;
    ui.checkpointOverlay.classList.remove("hidden");
    return true;
  }

  function openCheckpointStartFlow({showIntro = false} = {}) {
    if (getHighestCheckpointLevel() === 0) return startGame(1);
    if (
      showIntro &&
      !checkpointIntroShownThisSession &&
      !shouldSkipCheckpointIntro()
    ) {
      return showCheckpointIntro();
    }
    return showCheckpointStartSelection();
  }

  function confirmCheckpointIntro() {
    if (ui.checkpointIntroCheckbox.checked) {
      try {
        localStorage.setItem(SKIP_CHECKPOINT_INTRO_STORAGE_KEY, "true");
      } catch (_) {}
    }
    return showCheckpointStartSelection();
  }

  async function startFromCheckpointSelection(levelNumber) {
    const checkpoint = getHighestCheckpointLevel();
    const selectedLevel = levelNumber === 1
      ? 1
      : normalizeCheckpointLevel(levelNumber) === checkpoint
        ? checkpoint
        : 1;

    ui.checkpointLevelOneBtn.disabled = true;
    ui.checkpointLevelBtn.disabled = true;
    const started = await startGame(selectedLevel, {
      fromCheckpoint: selectedLevel > 1
    });
    if (started) ui.checkpointOverlay.classList.add("hidden");
    else {
      ui.checkpointLevelOneBtn.disabled = false;
      ui.checkpointLevelBtn.disabled = false;
    }
    return started;
  }

  function startFromPlay() {
    if (!shouldSkipTutorialFromPlay()) return startTutorialSequence();
    return openCheckpointStartFlow({showIntro: true});
  }

  function updateDevTutorialToggle() {
    if (!ui.devTutorialToggleBtn) return;
    const tutorialEnabled = !shouldSkipTutorialFromPlay();
    ui.devTutorialToggleBtn.textContent = `Einführung: ${tutorialEnabled ? "AN" : "AUS"}`;
    ui.devTutorialToggleBtn.setAttribute("aria-pressed", String(tutorialEnabled));
  }

  function toggleDevTutorial() {
    if (!DEV_MODE || !ui.devTutorialToggleBtn) return false;
    try {
      if (shouldSkipTutorialFromPlay()) {
        localStorage.removeItem(SKIP_TUTORIAL_STORAGE_KEY);
      } else {
        localStorage.setItem(SKIP_TUTORIAL_STORAGE_KEY, "true");
      }
    } catch (error) {
      console.warn("DEV-Einführung konnte nicht umgeschaltet werden:", error);
      return false;
    }
    updateDevTutorialToggle();
    return true;
  }

  async function startDevLevel(levelNumber) {
    if (!DEV_MODE) return;
    const parsedLevel = Math.floor(Number(levelNumber));
    const targetLevel = Number.isFinite(parsedLevel) ? Math.max(1, parsedLevel) : levelIndex + 1;
    return startGame(targetLevel);
  }

  function canActivatePrestige({allowPrestigeDialog = false} = {}) {
    const prestige = window.SlimePrestige;
    if (
      !prestige ||
      !prestige.isReady() ||
      prestige.getLevel() >= prestige.maxAvailablePrestige ||
      prestige.isTransactionPending() ||
      prestige.getPendingPermanentWardrobeChoice?.() ||
      state !== "menu" ||
      pendingGameOverScore !== null ||
      getPendingWardrobeUnlockChoiceCount() > 0 ||
      window.SlimeStarEconomy?.isPurchaseInProgress?.() === true ||
      window.SlimeRunRecovery?.isBlocked?.() === true ||
      window.SlimeRunRecovery?.hasStoredRecord?.() === true ||
      ui.menu.classList.contains("hidden") ||
      ui.mainMenuScreen.classList.contains("hidden")
    ) {
      return false;
    }

    const criticalOverlays = [
      ui.checkpointOverlay,
      ui.tutorialCompleteOverlay,
      ui.pauseOverlay,
      ui.message,
      ui.endRunConfirmOverlay,
      ui.prestigeCustomizationOverlay,
      ui.prestigeWardrobeChoiceOverlay
    ];
    if (criticalOverlays.some(overlay => overlay && !overlay.classList.contains("hidden"))) {
      return false;
    }
    if (
      !allowPrestigeDialog &&
      ui.prestigeConfirmOverlay &&
      !ui.prestigeConfirmOverlay.classList.contains("hidden")
    ) {
      return false;
    }
    return true;
  }

  function canOpenPrestigeMenu() {
    return state === "menu" &&
      pendingGameOverScore === null &&
      !window.SlimePrestige?.isTransactionPending?.() &&
      !ui.menu.classList.contains("hidden") &&
      !ui.mainMenuScreen.classList.contains("hidden") &&
      [
        ui.checkpointOverlay,
        ui.tutorialCompleteOverlay,
        ui.pauseOverlay,
        ui.message,
        ui.endRunConfirmOverlay,
        ui.prestigeConfirmOverlay,
        ui.prestigeCustomizationOverlay,
        ui.prestigeWardrobeChoiceOverlay
      ].every(overlay => !overlay || overlay.classList.contains("hidden"));
  }

  function openPrestigeMenu() {
    if (!canOpenPrestigeMenu()) return false;
    const prestige = window.SlimePrestige;
    if (prestige.getPendingPermanentWardrobeChoice?.()) {
      return showPrestigeWardrobeChoice();
    }
    if (prestige.getLevel() > 0) return showPrestigeCustomization();
    return showPrestigeConfirmation();
  }

  function showPrestigeConfirmation() {
    if (!canActivatePrestige()) return false;
    ui.prestigeConfirmBtn.disabled = false;
    ui.prestigeConfirmOverlay.classList.remove("hidden");
    window.requestAnimationFrame(() => ui.prestigeConfirmCancelBtn.focus());
    return true;
  }

  function hidePrestigeConfirmation() {
    ui.prestigeConfirmOverlay.classList.add("hidden");
    ui.prestigeConfirmBtn.disabled = false;
    ui.menuPrestigeBtn.focus();
  }

  function confirmPrestige() {
    if (!canActivatePrestige({allowPrestigeDialog: true})) {
      hidePrestigeConfirmation();
      showGameToast("Prestige ist gerade nicht sicher verfügbar.");
      renderMainMenuStats();
      return false;
    }

    ui.prestigeConfirmBtn.disabled = true;
    const completed = window.SlimePrestige.performPrestigeReset({
      validateSafeState: () => canActivatePrestige({allowPrestigeDialog: true})
    });
    if (!completed) {
      ui.prestigeConfirmBtn.disabled = false;
      showGameToast("Prestige-Reset konnte nicht sicher abgeschlossen werden.");
    }
    return completed;
  }

  function setDevPlayerProgress(level, levelXP) {
    if (!DEV_MODE || state !== "menu") return false;
    const updated = window.SlimePlayerProgress?.setPlayerProgressForDev?.(
      level,
      levelXP
    ) === true;
    if (!updated) return false;
    renderMainMenuStats();
    renderDevPrestigeRewardInspector();
    console.info(`[DEV Prestige] Player-Level=${level}, XP=${levelXP}`);
    return true;
  }

  function setDevPrestigeLevel(level) {
    if (!DEV_MODE || state !== "menu") return false;
    const updated = window.SlimePrestige?.setLevelForDev?.(level) === true;
    if (!updated) return false;
    renderMainMenuStats();
    renderDevPrestigeRewardInspector();
    console.info(`[DEV Prestige] Prestige=${window.SlimePrestige.getLevel()}`);
    return true;
  }

  function prepareDevPrestigeReady() {
    const requiredXP = window.SlimePlayerProgress?.getXPRequiredForNextLevel?.(
      window.SlimePlayerProgress.maxPlayerLevel
    ) ?? 0;
    return setDevPlayerProgress(
      window.SlimePlayerProgress.maxPlayerLevel,
      requiredXP
    );
  }

  function renderDevPrestigeRewardInspector() {
    if (!DEV_MODE || !ui.devPrestigeRewardInspector) return;
    const inspector = window.SlimePrestige?.getRewardInspectorData?.();
    if (!inspector) return;
    const list = values => values.length > 0 ? values.join(", ") : "none";
    ui.devPrestigeRewardInspector.textContent = [
      `prestige: P${inspector.prestigeLevel}`,
      `mastered: ${inspector.mastered}`,
      `permanent: ${JSON.stringify(inspector.permanentWardrobeUnlocks)}`,
      `pending: ${JSON.stringify(inspector.pendingPermanentChoice)}`,
      `frames: ${list(inspector.unlocked.frame)}`,
      `selected frame: ${inspector.selected.frame}`,
      `titles: ${list(inspector.unlocked.title)}`,
      `title count: ${inspector.unlocked.title.length}`,
      `selected title: ${inspector.selected.title}`,
      `auras: ${list(inspector.unlocked.aura)}`,
      `aura count: ${inspector.unlocked.aura.length}`,
      `selected aura: ${inspector.selected.aura}`,
      `trails: ${list(inspector.unlocked.trail)}`,
      `trail count: ${inspector.unlocked.trail.length}`,
      `selected trail: ${inspector.selected.trail}`,
      `xp multiplier: x${inspector.xpMultiplier.toFixed(2)}`
    ].join("\n");
  }

  function renderDevPerkInspector() {
    if (!DEV_MODE || !ui.devPerkInspector) return;
    const perks = window.SlimePerks;
    if (!perks) return;
    updateDevForceLuckyStarButton();
    const storedUnlocked = perks.getStoredUnlockedPerkIds();
    const storedSelected = perks.getStoredSelectedPerkIds();
    const selected = perks.getSelectedPerkIds();
    const active = perks.getActiveRunPerkIds();
    const extraLifeActive = active.includes("extra_life");
    const powerShotActive = active.includes("power_shot");
    const starMagnetActive = active.includes("star_magnet");
    const bounceMasterActive = active.includes("bounce_master");
    const anchorStepActive = active.includes("anchor_step");
    const luckyCharmActive = active.includes("lucky_charm");
    const airHopActive = active.includes("air_hop");
    const lastBubbleActive = active.includes("last_bubble");
    const mudShoesActive = active.includes("mud_shoes");
    const airBrakeActive = active.includes("air_brake");
    const starShieldActive = active.includes("star_shield");
    const ghostStepActive = active.includes("ghost_step");
    const runIsActive = !isTutorialStage() &&
      ["playing", "paused", "gamePaused"].includes(state);
    const luckyBonusStarThisLevel = runIsActive &&
      currentLevel().stars.some(star => star?.isLuckyCharmBonus === true);
    const currentAimBounceHit =
      typeof hasCurrentAimBouncePreviewHit === "function" &&
      hasCurrentAimBouncePreviewHit();
    const forceNextLuckyStar = perks.isDevForceNextLuckyStarPending?.() === true;
    const luckyRollThisLevel = perks.getLastLuckyCharmRollResult?.() ?? "NOT ROLLED";
    const expectedExtraLifeBonus = (runIsActive
      ? extraLifeActive
      : selected.includes("extra_life"))
      ? perks.balance.EXTRA_LIFE_BONUS
      : 0;
    ui.devPerkInspector.textContent = [
      `Gespeicherte freigeschaltete Fähigkeiten: ${JSON.stringify(storedUnlocked)}`,
      `Gespeicherte ausgewählte Fähigkeiten: ${JSON.stringify(storedSelected)}`,
      `Aktuell ausgewählte Fähigkeiten: ${JSON.stringify(selected)}`,
      `Aktive Run-Fähigkeiten: ${JSON.stringify(active)}`,
      `Selected Count: ${selected.length} / ${perks.maxSelected}`,
      `Current Run Lives: ${runIsActive ? lives : "-"}`,
      "Base Run Lives: 3",
      `Extra Life Bonus: +${expectedExtraLifeBonus}`,
      `Expected Run Start Lives: ${Math.min(MAX_LIVES, 3 + expectedExtraLifeBonus)}`,
      "",
      `Extra Life: ${extraLifeActive ? "active" : "inactive"}`,
      `Power Shot: ${powerShotActive ? "active" : "inactive"}`,
      `multiplier: x${(powerShotActive ? perks.balance.POWER_SHOT_MULTIPLIER : 1).toFixed(2)}`,
      `Star Magnet: ${starMagnetActive ? "active" : "inactive"}`,
      `pull radius: ${starMagnetActive ? perks.balance.STAR_MAGNET_PULL_RADIUS : 0}`,
      `pull speed: ${starMagnetActive ? perks.balance.STAR_MAGNET_PULL_SPEED : 0}`,
      `Bounce Master: ${bounceMasterActive ? "ACTIVE" : "inactive"}`,
      "Bounce Preview: AVAILABLE",
      `Current Aim Bounce Hit: ${currentAimBounceHit ? "YES" : "NO"}`,
      `Anchor Step: ${anchorStepActive ? "ACTIVE" : "inactive"}`,
      `Falling Platform Stability: ${perks.balance.ANCHOR_STEP_STABILITY_DURATION.toFixed(1)} s`,
      `Lucky Charm: ${luckyCharmActive ? "ACTIVE" : "inactive"}`,
      `Chance: ${Math.round(perks.balance.LUCKY_CHARM_EXTRA_STAR_CHANCE * 100)} %`,
      `Force Next Lucky Star: ${forceNextLuckyStar ? "YES" : "NO"}`,
      `Lucky Bonus Star Current Level: ${runIsActive ? (luckyBonusStarThisLevel ? "YES" : "NO") : "-"}`,
      `Lucky Roll This Level: ${luckyRollThisLevel}`,
      `Air Hop: ${airHopActive ? "ACTIVE" : "inactive"}`,
      `Airborne: ${runIsActive && !player.onGround && !hasValidAimSupport() ? "YES" : "NO"}`,
      `Flight Active: ${airHopActive && isAirHopFlightActive() ? "YES" : "NO"}`,
      `Available This Flight: ${airHopActive && isAirHopAvailableThisFlight() ? "YES" : "NO"}`,
      `Used This Flight: ${airHopActive && isAirHopUsedThisFlight() ? "YES" : "NO"}`,
      `Horizontal Speed: ${perks.balance.AIR_HOP_HORIZONTAL_SPEED}`,
      `Vertical Speed: ${perks.balance.AIR_HOP_VERTICAL_SPEED}`,
      `Last Air Hop Trigger: ${getLastAirHopTrigger()}`,
      `Last Bubble: ${lastBubbleActive ? "ACTIVE" : "inactive"}`,
      `Available This Level: ${lastBubbleActive && isLastBubbleAvailableThisLevel() ? "YES" : "NO"}`,
      `Used This Level: ${lastBubbleActive && isLastBubbleUsedThisLevel() ? "YES" : "NO"}`,
      `Bubble Protection Active: ${isLastBubbleProtectionActive() ? "YES" : "NO"}`,
      `Bubble Time Remaining: ${getLastBubbleProtectionTimeRemaining().toFixed(2)} s`,
      `Bottom Hazard Contact: ${runIsActive && isPlayerTouchingBottomDeathHazard() ? "YES" : "NO"}`,
      `Mud Shoes: ${mudShoesActive ? "ACTIVE" : "inactive"}`,
      `Horizontal Damping: ${perks.balance.MUD_SHOES_HORIZONTAL_DAMPING.toFixed(2)}`,
      `Rebound Multiplier: ${perks.balance.MUD_SHOES_REBOUND_MULTIPLIER.toFixed(2)}`,
      `Air Brake: ${airBrakeActive ? "ACTIVE" : "inactive"}`,
      "Function: AIR BRAKE",
      `Flight Active: ${airBrakeActive && isAirHopFlightActive() ? "YES" : "NO"}`,
      `Available This Flight: ${airBrakeActive && isAirHopAvailableThisFlight() ? "YES" : "NO"}`,
      `Used This Flight: ${airBrakeActive && isAirHopUsedThisFlight() ? "YES" : "NO"}`,
      `Horizontal Multiplier: x${perks.balance.AIR_BRAKE_HORIZONTAL_MULTIPLIER.toFixed(2)}`,
      `Current |vx|: ${Math.round(Math.abs(player.vx))} px/s`,
      `Star Shield: ${starShieldActive ? "ACTIVE" : "inactive"}`,
      `Ready This Life: ${starShieldActive && isStarShieldReadyThisLife() ? "YES" : "NO"}`,
      `Consumed This Life: ${starShieldActive && isStarShieldConsumedThisLife() ? "YES" : "NO"}`,
      `Shield Protection Active: ${isStarShieldProtectionActive() ? "YES" : "NO"}`,
      `Shield Time Remaining: ${getStarShieldProtectionTimeRemaining().toFixed(2)} s`,
      `Valid Normal Support: ${runIsActive && Boolean(getValidNormalSafeSupportPlatform()) ? "YES" : "NO"}`,
      `Normal Ground Damping Active: ${isNormalSafeGroundDampingActive() ? "YES" : "NO"}`,
      `Normal Ground Current |vx|: ${Math.round(Math.abs(player.vx))} px/s`,
      `Normal Ground Damping: ${NORMAL_SAFE_GROUND_DAMPING.toFixed(2)} @ 60 Hz reference`,
      `Ghost Step: ${ghostStepActive ? "ACTIVE" : "inactive"}`,
      `Fade Platforms Solid For Player: ${ghostStepActive ? "YES" : "normal phase state"}`
    ].join("\n");
  }

  let lastDevPerkTelemetryUpdate = 0;

  function updateLiveDevPerkTelemetry(now) {
    if (
      !DEV_MODE ||
      !ui.devPerkInspector ||
      ui.devPerkInspector.hidden ||
      state !== "playing" ||
      now - lastDevPerkTelemetryUpdate < 50
    ) return;

    lastDevPerkTelemetryUpdate = now;
    renderDevPerkInspector();
  }

  function updateDevForceLuckyStarButton() {
    if (!DEV_MODE || !ui.devForceLuckyStarBtn) return;
    const pending =
      window.SlimePerks?.isDevForceNextLuckyStarPending?.() === true;
    ui.devForceLuckyStarBtn.setAttribute("aria-pressed", String(pending));
    ui.devForceLuckyStarBtn.textContent = pending
      ? "DEV FORCE LUCKY STAR: READY"
      : "DEV FORCE LUCKY STAR";
  }

  function initializeDevMode() {
    if (
      !IS_LOCALHOST_TEST_ENVIRONMENT ||
      !ui.devPanel ||
      !ui.devModeToggleBtn
    ) {
      return;
    }

    ui.devPanel.querySelectorAll("[data-dev-mode-only]").forEach(control => {
      control.hidden = !DEV_MODE;
    });
    if (ui.devPrestigeRewardInspector) {
      ui.devPrestigeRewardInspector.hidden = true;
    }
    if (ui.devPerkInspector) ui.devPerkInspector.hidden = true;
    updateDevForceLuckyStarButton();
    ui.devModeToggleBtn.textContent = `DEV MODE: ${DEV_MODE ? "ON" : "OFF"}`;
    ui.devModeToggleBtn.setAttribute("aria-pressed", String(DEV_MODE));
    ui.devModeToggleBtn.addEventListener("click", async () => {
      if (pendingGameOverScore && !(await commitPendingHighScore())) return;
      setLocalDevModeEnabled(!DEV_MODE);
    });

    ui.devPanel.hidden = false;
    if (!DEV_MODE) return;

    ui.devPreviousLevelBtn.addEventListener("click", () => startDevLevel(levelIndex));
    ui.devStartLevelBtn.addEventListener("click", () => startDevLevel(ui.devLevelInput.value));
    ui.devCheckpoint100Btn.addEventListener("click", () => {
      startGame(100, {fromCheckpoint: true});
    });
    ui.devNextLevelBtn.addEventListener("click", () => startDevLevel(levelIndex + 2));
    updateDevTutorialToggle();
    ui.devTutorialToggleBtn.addEventListener("click", toggleDevTutorial);
    ui.devPlayerLevel100Btn.addEventListener("click", () => {
      setDevPlayerProgress(window.SlimePlayerProgress.maxPlayerLevel, 0);
    });
    ui.devPlayerLevel99NearBtn.addEventListener("click", () => {
      const level = window.SlimePlayerProgress.maxPlayerLevel - 1;
      const requiredXP = window.SlimePlayerProgress.getXPRequiredForNextLevel(level);
      setDevPlayerProgress(level, Math.max(0, requiredXP - 100));
    });
    ui.devPlayerLevel100NearBtn.addEventListener("click", () => {
      const level = window.SlimePlayerProgress.maxPlayerLevel;
      const requiredXP = window.SlimePlayerProgress.getXPRequiredForNextLevel(level);
      setDevPlayerProgress(level, Math.max(0, requiredXP - 1));
    });
    ui.devPrestigeReadyBtn.addEventListener("click", prepareDevPrestigeReady);
    ui.devPrestigeDownBtn.addEventListener("click", () => {
      setDevPrestigeLevel(window.SlimePrestige.getLevel() - 1);
    });
    ui.devPrestigeUpBtn.addEventListener("click", () => {
      setDevPrestigeLevel(window.SlimePrestige.getLevel() + 1);
    });
    ui.devPrestigeZeroBtn.addEventListener("click", () => {
      setDevPrestigeLevel(0);
    });
    ui.devPrestigeFlowBtn.addEventListener("click", () => {
      if (!prepareDevPrestigeReady()) return;
      showMenuScreen("main");
      renderMainMenuStats();
      console.info("[DEV Prestige] Echter Prestige-Flow ist bereit.");
    });
    ui.devPrestigePermanentChoiceBtn.addEventListener("click", () => {
      if (!window.SlimePrestige?.createPendingPermanentChoiceForDev?.()) {
        showGameToast("Für dieses Prestige ist keine neue Test-Wahl verfügbar.");
        return;
      }
      renderMainMenuStats();
      renderDevPrestigeRewardInspector();
      showPrestigeWardrobeChoice();
    });
    ui.devPrestigeRewardInspectorBtn.addEventListener("click", () => {
      ui.devPrestigeRewardInspector.hidden = !ui.devPrestigeRewardInspector.hidden;
      renderDevPrestigeRewardInspector();
    });
    ui.devUnlockPerksBtn.addEventListener("click", () => {
      const enabled = !window.SlimePerks.isDevUnlockOverrideActive();
      window.SlimePerks.setDevUnlockOverride(enabled);
      ui.devUnlockPerksBtn.setAttribute("aria-pressed", String(enabled));
      ui.devUnlockPerksBtn.textContent = enabled
        ? "DEV FÄHIGKEITEN FREIGESCHALTET"
        : "DEV FÄHIGKEITEN FREISCHALTEN";
      renderPerksScreen();
      renderDevPerkInspector();
    });
    ui.devForceLuckyStarBtn.addEventListener("click", () => {
      window.SlimePerks?.requestDevForceNextLuckyStar?.();
      updateDevForceLuckyStarButton();
      renderDevPerkInspector();
    });
    ui.devPerkInspectorBtn.addEventListener("click", () => {
      ui.devPerkInspector.hidden = !ui.devPerkInspector.hidden;
      renderDevPerkInspector();
    });
    window.addEventListener("slimeperkschange", renderDevPerkInspector);
    renderDevPerkInspector();

    document.addEventListener("keydown", event => {
      if (event.key !== "PageUp" && event.key !== "PageDown") return;
      event.preventDefault();
      const offset = event.key === "PageUp" ? 1 : -1;
      startDevLevel(levelIndex + 1 + offset);
    });
  }

  async function restartCurrent() {
    if (isTutorialStage()) {
      state = "playing";
      ui.message.classList.add("hidden");
      resetLevel(true);
      return;
    }
    if (state === "gameover") {
      if (!(await completePendingGameOverFlow())) return;
      ui.message.classList.add("hidden");
      await openCheckpointStartFlow();
      return;
    }
    if (state === "menu") {
      await startGame();
      return;
    }
    state = "playing";
    ui.message.classList.add("hidden");
    resetLevel(true);
    window.SlimeAchievements?.onLevelStart?.(getAchievementLevelContext());
  }

  async function returnToMenu() {
    if (pendingGameOverScore && !(await commitPendingHighScore())) return false;
    enterRunStage();
    window.SlimePerks?.clearRunPerkSnapshot?.();
    state = "menu";
    initializeRunScoreState(1);
    setMusicMode("menu");
    if (!musicMuted) startBackgroundMusic("menu");
    aiming = false;
    activeTouchId = null;
    drag.x = 0;
    drag.y = 0;
    player.vx = 0;
    player.vy = 0;
    stuckAimFallbackActive = false;
    resetStuckAimTimer();
    canvas.classList.remove("aiming");
    ui.message.classList.add("hidden");
    ui.tutorialCompleteOverlay.classList.add("hidden");
    hideNicknameEntry();
    showMenuScreen("main");
    updateHighScores();
    ui.menu.classList.remove("hidden");
    renderDevPerkInspector();
    return true;
  }

  function updateHUD() {
    ui.level.textContent = isTutorialStage()
      ? `Tutorial ${tutorialStageIndex + 1}`
      : `Level ${levelIndex + 1}`;
    ui.lives.textContent = "❤️".repeat(Math.max(0, Math.floor(lives)));
    ui.lives.setAttribute("aria-label", `${lives} Leben`);
    const starProgress = getStarProgress();
    ui.stars.textContent = starProgress.bonusTotal > 0
      ? `⭐ ${starProgress.requiredCollected}/${starProgress.requiredTotal} · 🍀 ${starProgress.bonusCollected}/${starProgress.bonusTotal}`
      : `⭐ ${starProgress.requiredCollected}/${starProgress.requiredTotal}`;
    ui.shots.textContent = `Schüsse: ${shots}`;
    ui.score.textContent = `Punkte: ${score}`;
    updateCheckpointBonusHUD();
    renderDevPerkInspector();
  }

  function getStarProgress(level = currentLevel()) {
    let requiredTotal = 0;
    let requiredCollected = 0;
    let bonusTotal = 0;
    let bonusCollected = 0;

    level.stars.forEach((star, index) => {
      if (star?.isLuckyCharmBonus === true) {
        bonusTotal++;
        if (collected[index]) bonusCollected++;
      } else {
        requiredTotal++;
        if (collected[index]) requiredCollected++;
      }
    });

    return {requiredTotal, requiredCollected, bonusTotal, bonusCollected};
  }

  function registerRunStarCollected() {
    runStarsCollected++;
    window.SlimeAchievements?.onStarCollected?.({runStars: runStarsCollected});

    if (DEV_MODE) return;

    const earnedChoices = awardWardrobeUnlockChoicesForRun(runStarsCollected);
    if (earnedChoices <= 0) return;

    wardrobeUnlockCategory = null;
    showGameToast(earnedChoices === 1
      ? "🎁 Freie Garderoben-Auswahl verdient!"
      : `🎁 ${earnedChoices} freie Garderoben-Auswahlen verdient!`);
  }

  function showMessage(title, text, buttonText, action) {
    if (action !== "gameover") hideNicknameEntry();
    if (action !== "gameover") hideGameOverXPProgress();
    state = action === "gameover" ? "gameover" : "paused";
    renderDevPerkInspector();
    nextAction = action;
    ui.messageTitle.textContent = title;
    ui.messageText.textContent = text;
    ui.continueBtn.textContent = buttonText;
    ui.message.classList.remove("hidden");
    updateCheckpointBonusHUD();
  }

  function updatePerfectLevelStreak(requiredStars, requiredStarTotal) {
    if (requiredStars === requiredStarTotal && !levelHadDeath) {
      perfectLevelStreak++;

      if (perfectLevelStreak >= PERFECT_LEVEL_STREAK_TARGET) {
        perfectLevelStreak = 0;

        if (lives < MAX_LIVES) {
          lives = Math.min(MAX_LIVES, lives + 1);
          return "❤️ BONUSLEBEN! +1";
        }

        return "";
      }

      return `⭐ Perfekte Serie: ${perfectLevelStreak}/${PERFECT_LEVEL_STREAK_TARGET}`;
    }

    if (perfectLevelStreak > 0) {
      perfectLevelStreak = 0;
      return "💔 Perfekte Serie verloren! 0/3";
    }

    return "";
  }

  function showTutorialCompletePrompt() {
    stopAiming();
    activeTouchId = null;
    shake = 0;
    state = "tutorialCompletePrompt";
    ui.tutorialCompleteOverlay.classList.remove("hidden");
  }

  function hideTutorialCompletePrompt() {
    ui.tutorialCompleteOverlay.classList.add("hidden");
  }

  function resolveTutorialCompletePrompt(skipNextTime) {
    if (state !== "tutorialCompletePrompt") return false;
    if (skipNextTime) {
      try {
        localStorage.setItem(SKIP_TUTORIAL_STORAGE_KEY, "true");
      } catch (_) {}
    }
    hideTutorialCompletePrompt();
    return startGame(1);
  }

  function finishLevel() {
    if (state !== "playing") return;
    if (isTutorialStage()) {
      playWin();
      if (tutorialStageIndex === 0) {
        state = "tutorialTransition";
        window.setTimeout(() => {
          enterTutorialStage(1);
          generatedLevel = createTutorialLevel(tutorialStageIndex);
          state = "playing";
          resetLevel(true);
        }, 0);
      } else if (tutorialStageIndex === 1) {
        showTutorialCompletePrompt();
      }

      return;
    }

    const completedLevel = levelIndex + 1;
    recordReachedCheckpoint(completedLevel);
    const stars = collected.filter(Boolean).length;
    const starProgress = getStarProgress();
    const levelScoreBase = 650 + completedLevel * 45;
    const shotPenalty = shots * 55;
    const starScoreBonus = stars * 250;

    const achievementContext = getAchievementLevelContext();
    window.SlimeAchievements?.onLevelCompleted?.({
      ...achievementContext,
      isPerfect:
        starProgress.requiredCollected === starProgress.requiredTotal &&
        !levelHadDeath,
      hadDeath: levelHadDeath,
      levelShots: shots,
      remainingLives: lives,
      collectedStars: starProgress.requiredCollected,
      totalStars: starProgress.requiredTotal
    });

    const awardedBonus =
      awardRunScore(levelScoreBase, {deduction: shotPenalty}) +
      awardRunScore(starScoreBonus);
    const streakMessage = updatePerfectLevelStreak(
      starProgress.requiredCollected,
      starProgress.requiredTotal
    );

    updateHUD();
    if (streakMessage) showGameToast(streakMessage);
    playWin();

    const collectedStarSummary = starProgress.bonusTotal > 0
      ? `${starProgress.requiredCollected}/${starProgress.requiredTotal} Pflichtsterne · Bonusstern ${starProgress.bonusCollected}/${starProgress.bonusTotal}`
      : `${starProgress.requiredCollected}/${starProgress.requiredTotal} Sterne gesammelt`;

    showMessage(
      `Level ${completedLevel} geschafft!`,
      `${collectedStarSummary}. Levelbonus: ${awardedBonus} Punkte.`,
      "Nächstes Zufallslevel",
      "next"
    );
  }

  function loseLife() {
    if (state !== "playing") return;
    if (isTutorialStage()) {
      shake = 18;
      playHurt();
      resetLevel(true);
      return;
    }
    clearStarShieldProtection();
    window.SlimeAchievements?.onDeath?.();
    stuckAimFallbackActive = false;
    resetStuckAimTimer();
    levelHadDeath = true;
    if (perfectLevelStreak > 0) {
      perfectLevelStreak = 0;
      showGameToast("💔 Perfekte Serie verloren! 0/3");
    }
    lives--;
    shake = 18;
    playHurt();
    updateHUD();

    if (lives <= 0) {
      const recoveryCompleted =
        window.SlimeRunRecovery?.markRunCompleted?.() === true;
      if (!recoveryCompleted) {
        console.error("[RunRecovery] Active-Run-Datensatz konnte bei Game Over nicht sicher abgeschlossen werden.");
      }
      window.SlimeAchievements?.discardRunProgressSnapshot?.();
      discardWardrobeRunProgressSnapshot();
      const reachedLevel = levelIndex + 1;
      console.info(`[Highscore] RUN FINISHED score=${score}`);
      const previousBest = Number(localStorage.getItem("slimejumperBest") || 0);
      const previousBestLevel = Number(localStorage.getItem("slimejumperBestLevel") || 0);
      const best = Math.max(previousBest, score);
      const bestLevel = Math.max(previousBestLevel, reachedLevel);

      localStorage.setItem("slimejumperBest", String(best));
      localStorage.setItem("slimejumperBestLevel", String(bestLevel));
      pendingGameOverScore = {
        score,
        reachedLevel,
        identitySnapshot: window.SlimePrestige?.capturePlayerIdentitySnapshot?.()
      };
      let runXPResult = null;
      if (recoveryCompleted && !activeRunXPAwarded) {
        activeRunXPAwarded = true;
        const selectedRunStartCheckpoint = runStartedFromCheckpoint
          ? runStartLevel
          : 0;
        runXPResult = window.SlimePlayerProgress?.awardRunXP?.(
          score,
          selectedRunStartCheckpoint
        ) ?? null;
      }

      showMessage(
        "Game Over",
        `Punkte: ${score} · Erreichtes Level: ${reachedLevel} · Highscore: ${best} · Bestes Level: ${bestLevel}`,
        "Highscore speichern & neue Runde",
        "gameover"
      );
      renderGameOverXPProgress(runXPResult);
      showNicknameEntry();
      renderWardrobeUnlockPanel();
    } else {
      const level = currentLevel();
      resetFallingPlatforms(level);
      player.x = level.spawn.x;
      player.y = level.spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.onIce = false;
      player.trail = [];
      aiming = false;
      resetStuckAimTimer();
      resetFlightPerkState();
      resetStarShieldForNewLife();
    }
  }

  async function completePendingGameOverFlow() {
    if (!(await commitPendingHighScore())) return false;
    if (!requirePendingWardrobeUnlockSelection()) return false;
    return true;
  }

  async function doContinue() {
    if (
      nextAction === "gameover" &&
      !(await completePendingGameOverFlow())
    ) return;
    ui.message.classList.add("hidden");
    if (nextAction === "next") {
      levelIndex++;
      levelHadDeath = false;
      setMusicForLevel(levelIndex + 1);
      generatedLevel = generateProceduralLevel(levelIndex + 1);
      resetLastBubbleForNewLevel();
      resetStarShieldForNewLife();
      state = "playing";
      resetLevel(true);
      window.SlimeAchievements?.onLevelStart?.(getAchievementLevelContext());
    } else {
      await openCheckpointStartFlow();
    }
  }

  function pauseGame() {
    if (state !== "playing") return;
    stopAiming();
    activeTouchId = null;
    shake = 0;
    state = "gamePaused";
    ui.pauseBtn.textContent = "▶";
    ui.pauseBtn.setAttribute("aria-label", "Fortsetzen");
    ui.pauseOverlay.classList.remove("hidden");
  }

  function resumeGame() {
    if (state !== "gamePaused") return;
    lastTime = performance.now();
    state = "playing";
    ui.pauseBtn.textContent = "⏸";
    ui.pauseBtn.setAttribute("aria-label", "Pause");
    ui.pauseOverlay.classList.add("hidden");
  }

  async function endCurrentRun() {
    if (state !== "gamePaused") return false;
    if (!isTutorialStage()) {
      const achievementRestored =
        window.SlimeAchievements?.restoreRunProgressSnapshot?.() === true;
      const wardrobeRestored = restoreWardrobeRunProgressSnapshot() === true;
      if (!achievementRestored || !wardrobeRestored) {
        console.error("[RunRecovery] Manueller Run-Rollback konnte nicht vollstaendig gespeichert werden.");
        showGameToast("Run-Fortschritt konnte nicht sicher zurueckgesetzt werden.");
        return false;
      }
      if (!restoreCheckpointLevelAtRunStart()) {
        console.error("[RunRecovery] Checkpoint vor dem Run konnte nicht wiederhergestellt werden.");
        showGameToast("Checkpoint konnte nicht sicher zurueckgesetzt werden.");
        return false;
      }
      if (window.SlimeRunRecovery?.clearAfterRollback?.() !== true) {
        console.error("[RunRecovery] Recovery-Datensatz blieb nach manuellem Rollback aktiv.");
        showGameToast("Run-Abbruch konnte nicht sicher abgeschlossen werden.");
        return false;
      }
      window.SlimeAchievements?.discardRunProgressSnapshot?.();
      discardWardrobeRunProgressSnapshot();
    }
    ui.pauseOverlay.classList.add("hidden");
    ui.pauseBtn.textContent = "⏸";
    ui.pauseBtn.setAttribute("aria-label", "Pause");
    return returnToMenu();
  }

  function shouldSkipEndRunWarning() {
    try {
      return localStorage.getItem(SKIP_END_RUN_WARNING_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function showEndRunConfirmation() {
    if (state !== "gamePaused") return false;
    ui.skipEndRunWarningCheckbox.checked = false;
    ui.endRunConfirmOverlay.classList.remove("hidden");
    return true;
  }

  function hideEndRunConfirmation() {
    ui.endRunConfirmOverlay.classList.add("hidden");
    ui.skipEndRunWarningCheckbox.checked = false;
  }

  function requestEndCurrentRun() {
    if (state !== "gamePaused") return false;
    if (shouldSkipEndRunWarning()) return endCurrentRun();
    return showEndRunConfirmation();
  }

  function cancelEndCurrentRun() {
    hideEndRunConfirmation();
  }

  function confirmEndCurrentRun() {
    if (state !== "gamePaused") return false;
    if (ui.skipEndRunWarningCheckbox.checked) {
      try {
        localStorage.setItem(SKIP_END_RUN_WARNING_STORAGE_KEY, "true");
      } catch (_) {}
    }
    hideEndRunConfirmation();
    return endCurrentRun();
  }

  function frame(now) {
    const dt = Math.min(0.026, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    updateLiveDevPerkTelemetry(now);
    draw();
    requestAnimationFrame(frame);
  }

  async function requestFullscreenLandscape() {
    getAudio();

    try {
      await document.documentElement.requestFullscreen?.();
    } catch (_) {}

    if (document.fullscreenElement && screen.orientation?.lock) {
      try {
        const orientationLock = screen.orientation.lock("landscape");
        orientationLock?.catch?.(() => {});
      } catch (_) {}
    }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await requestFullscreenLandscape();
      return;
    }

    getAudio();
    try {
      await document.exitFullscreen?.();
    } catch (_) {}
  }

  function setMenuButtonArtwork(button, screenElement, geometry) {
    const art = screenElement?.querySelector(".menuArt");
    if (!button || !art) return;

    const {left, top, width, height} = geometry;
    button.style.left = `${left}%`;
    button.style.top = `${top}%`;
    button.style.width = `${width}%`;
    button.style.height = `${height}%`;
    button.style.setProperty("--menu-art-url", `url("${art.currentSrc || art.src}")`);
    button.style.backgroundImage = `url("${art.currentSrc || art.src}")`;
    button.style.backgroundSize = `${10000 / width}% ${10000 / height}%`;
    button.style.backgroundPosition =
      `${left / (100 - width) * 100}% ${top / (100 - height) * 100}%`;
  }

  function prepareMenuButtonArtwork() {
    setMenuButtonArtwork(ui.startBtn, ui.mainMenuScreen,
      {left: 34.57, top: 56.75, width: 32.18, height: 16.58});
    setMenuButtonArtwork(ui.perksBtn, ui.mainMenuScreen,
      {left: 34.27, top: 72.69, width: 32.36, height: 13.92});
    setMenuButtonArtwork(ui.highScoresBtn, ui.mainMenuScreen,
      {left: 34.15, top: 86.08, width: 32.18, height: 13.39});
    setMenuButtonArtwork(ui.howToBackBtn, ui.howToTopPanel,
      {left: 38.0, top: 86.7, width: 23.45, height: 11.6});
    setMenuButtonArtwork(ui.highScoresBackBtn, ui.highscoreScreen,
      {left: 36.18, top: 84.59, width: 27.15, height: 13.71});
  }

  function runMenuButtonAction(button, action) {
    if (!button || button.dataset.busy === "1") return;
    button.dataset.busy = "1";
    button.classList.remove("menuTapFeedback");
    void button.offsetWidth;
    button.classList.add("menuTapFeedback");

    window.setTimeout(() => {
      button.classList.remove("menuTapFeedback", "menuPressed");
      button.dataset.busy = "0";
      action();
    }, 220);
  }

  for (const button of [
    ui.startBtn, ui.achievementsBtn, ui.wardrobeBtn, ui.perksBtn, ui.highScoresBtn,
    ui.achievementsBackBtn,
    ui.wardrobeBackBtn, ui.wardrobeColorMenuBtn, ui.wardrobeCosmeticsMenuBtn,
    ui.wardrobeBeardsMenuBtn, ui.wardrobePrestigeMenuBtn, ui.wardrobeColorBackBtn,
    ui.wardrobeCosmeticsBackBtn, ui.wardrobeBeardsBackBtn, ui.wardrobePrestigeBackBtn,
    ui.perksBackBtn, ui.howToBackBtn, ui.highScoresBackBtn
  ]) {
    button.addEventListener("pointerdown", () => button.classList.add("menuPressed"));
    button.addEventListener("pointerup", () => button.classList.remove("menuPressed"));
    button.addEventListener("pointercancel", () => button.classList.remove("menuPressed"));
    button.addEventListener("pointerleave", () => button.classList.remove("menuPressed"));
  }

  ui.startBtn.addEventListener("click", () => runMenuButtonAction(ui.startBtn, startFromPlay));
  ui.menuPrestigeBtn.addEventListener("click", openPrestigeMenu);
  ui.prestigeConfirmCancelBtn.addEventListener("click", hidePrestigeConfirmation);
  ui.prestigeConfirmBtn.addEventListener("click", confirmPrestige);
  ui.prestigeCustomizationCloseBtn.addEventListener("click", hidePrestigeCustomization);
  ui.prestigeCustomizationActivateBtn.addEventListener("click", () => {
    hidePrestigeCustomization();
    showPrestigeConfirmation();
  });
  ui.prestigeFrameSelect.addEventListener("change", event => {
    selectPrestigeReward("frame", event.currentTarget.value);
  });
  ui.prestigeTitleSelect.addEventListener("change", event => {
    selectPrestigeReward("title", event.currentTarget.value);
  });
  ui.prestigeAuraSelect.addEventListener("change", event => {
    selectPrestigeReward("aura", event.currentTarget.value);
  });
  ui.prestigeTrailSelect.addEventListener("change", event => {
    selectPrestigeReward("trail", event.currentTarget.value);
  });
  ui.prestigeWardrobeChoiceCloseBtn.addEventListener("click", hidePrestigeWardrobeChoice);
  ui.prestigeWardrobeChoiceBackBtn.addEventListener("click", () => {
    if (prestigeWardrobeChoiceCandidate) {
      prestigeWardrobeChoiceCandidate = null;
    } else {
      prestigeWardrobeChoiceCategory = null;
    }
    renderPrestigeWardrobeChoice();
  });
  ui.prestigeWardrobeChoiceConfirmBtn.addEventListener("click", confirmPrestigeWardrobeChoice);
  ui.achievementsBtn.addEventListener("click", () => runMenuButtonAction(ui.achievementsBtn, () => showMenuScreen("achievements")));
  ui.wardrobeBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBtn, () => showMenuScreen("wardrobe")));
  ui.perksBtn.addEventListener("click", () => runMenuButtonAction(ui.perksBtn, () => showMenuScreen("perks")));
  ui.highScoresBtn.addEventListener("click", () => runMenuButtonAction(ui.highScoresBtn, () => showMenuScreen("highscores")));
  ui.achievementsBackBtn.addEventListener("click", () => runMenuButtonAction(ui.achievementsBackBtn, () => showMenuScreen("main")));
  ui.wardrobeBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBackBtn, () => showMenuScreen("main")));
  ui.wardrobeColorMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeColorMenuBtn, () => showWardrobeView("color")));
  ui.wardrobeCosmeticsMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeCosmeticsMenuBtn, () => showWardrobeView("cosmetics")));
  ui.wardrobeBeardsMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBeardsMenuBtn, () => showWardrobeView("beards")));
  ui.wardrobePrestigeMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobePrestigeMenuBtn, () => showWardrobeView("prestige")));
  ui.wardrobeColorBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeColorBackBtn, () => showWardrobeView("home")));
  ui.wardrobeCosmeticsBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeCosmeticsBackBtn, () => showWardrobeView("home")));
  ui.wardrobeBeardsBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBeardsBackBtn, () => showWardrobeView("home")));
  ui.wardrobePrestigeBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobePrestigeBackBtn, () => showWardrobeView("home")));
  ui.wardrobePrestigeCategories.querySelectorAll("[data-prestige-category]").forEach(button => {
    button.addEventListener("click", () => {
      prestigeWardrobeCategory = button.dataset.prestigeCategory;
      renderWardrobePrestigePicker();
    });
  });
  ui.howToBackBtn.addEventListener("click", () => runMenuButtonAction(ui.howToBackBtn, () => showMenuScreen("main")));
  ui.perksBackBtn.addEventListener("click", () => runMenuButtonAction(ui.perksBackBtn, () => showMenuScreen("main")));
  ui.highScoresBackBtn.addEventListener("click", () => runMenuButtonAction(ui.highScoresBackBtn, () => showMenuScreen("main")));
  ui.nicknameInput.addEventListener("input", () => {
    const cleaned = ui.nicknameInput.value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
    ui.nicknameInput.value = cleaned;
    ui.nicknameEntry.classList.remove("invalid");
    ui.nicknameHint.textContent = cleaned.length === 3
      ? "Name wird mit deinem Highscore gespeichert."
      : "Genau 3 Buchstaben (A–Z)";
  });

  ui.nicknameInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && nextAction === "gameover") {
      event.preventDefault();
      doContinue();
    }
  });

  async function returnToMenuWithPendingScore() {
    if (pendingGameOverScore && !(await commitPendingHighScore())) return;
    if (nextAction === "gameover" && !requirePendingWardrobeUnlockSelection()) return;
    await returnToMenu();
  }

  ui.continueBtn.addEventListener("click", doContinue);
  ui.checkpointIntroConfirmBtn.addEventListener("click", confirmCheckpointIntro);
  ui.checkpointLevelOneBtn.addEventListener("click", () => {
    startFromCheckpointSelection(1);
  });
  ui.checkpointLevelBtn.addEventListener("click", () => {
    startFromCheckpointSelection(getHighestCheckpointLevel());
  });
  ui.tutorialSkipConfirmBtn.addEventListener("click", () => resolveTutorialCompletePrompt(true));
  ui.tutorialSkipDeclineBtn.addEventListener("click", () => resolveTutorialCompletePrompt(false));
  ui.wardrobeUnlockBackBtn.addEventListener("click", () => {
    wardrobeUnlockCategory = null;
    renderWardrobeUnlockPanel();
  });
  ui.restartBtn.addEventListener("click", returnToMenuWithPendingScore);
  ui.messageRestartBtn.addEventListener("click", returnToMenuWithPendingScore);
  ui.fullscreenBtn.addEventListener("click", toggleFullscreen);
  ui.pauseBtn.addEventListener("click", () => {
    if (state === "playing") pauseGame();
    else if (state === "gamePaused") resumeGame();
  });
  ui.resumeBtn.addEventListener("click", resumeGame);
  ui.pauseMusicBtn.addEventListener("click", () => ui.musicBtn.click());
  ui.pauseSfxBtn.addEventListener("click", () => ui.sfxBtn.click());
  ui.endRunBtn.addEventListener("click", requestEndCurrentRun);
  ui.endRunConfirmCancelBtn.addEventListener("click", cancelEndCurrentRun);
  ui.endRunConfirmBtn.addEventListener("click", confirmEndCurrentRun);
  ui.musicBtn.addEventListener("click", () => {
    musicMuted = !musicMuted;
    updateAudioButtons();
    updateMusicMute();

    if (!musicMuted) {
      if (state === "playing" || state === "gamePaused") setMusicForLevel(levelIndex + 1);
      else setMusicMode("menu");
      startBackgroundMusic();
    }
  });

  ui.sfxBtn.addEventListener("click", () => {
    sfxMuted = !sfxMuted;
    updateAudioButtons();

    if (!sfxMuted) {
      tone(520, 0.08, "sine", 0.035, 700);
    }
  });

  // Browser erlauben Audio normalerweise erst nach einer Nutzeraktion.
  // Der erste Tap/Klick startet deshalb die Menümusik automatisch.
  function unlockBackgroundMusic(event) {
    if (
      musicStarted ||
      musicMuted ||
      event.target === ui.musicBtn ||
      event.target === ui.sfxBtn ||
      event.target === ui.pauseMusicBtn ||
      event.target === ui.pauseSfxBtn
    ) return;
    if (state === "playing" || state === "gamePaused") setMusicForLevel(levelIndex + 1);
    else setMusicMode("menu");
    startBackgroundMusic();
    document.removeEventListener("pointerdown", unlockBackgroundMusic, true);
  }

  document.addEventListener("pointerdown", unlockBackgroundMusic, true);

  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
  });

  updateAudioButtons();
  renderHowToAdvancedIcons();
  prepareMenuButtonArtwork();
  updateHighScores();
  showMenuScreen("main");
  initializeDevMode();
  resetLevel(true);
  requestAnimationFrame(frame);
  void initializeAndroidUpdateCheck();
