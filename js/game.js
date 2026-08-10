"use strict";

  const MAX_LIVES = 5;
  const PERFECT_LEVEL_STREAK_TARGET = 3;

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

  async function startGame(levelNumber = 1) {
    if (pendingGameOverScore && !(await commitPendingHighScore())) return false;
    hideNicknameEntry();
    hideGameToast();
    getAudio();
    state = "playing";
    levelIndex = levelNumber - 1;
    setMusicForLevel(levelIndex + 1);
    if (!musicMuted) startBackgroundMusic();
    lives = 3;
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
    return true;
  }

  async function startDevLevel(levelNumber) {
    if (!DEV_MODE) return;
    const parsedLevel = Math.floor(Number(levelNumber));
    const targetLevel = Number.isFinite(parsedLevel) ? Math.max(1, parsedLevel) : levelIndex + 1;
    return startGame(targetLevel);
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
    ui.devNextLevelBtn.addEventListener("click", () => startDevLevel(levelIndex + 2));

    document.addEventListener("keydown", event => {
      if (event.key !== "PageUp" && event.key !== "PageDown") return;
      event.preventDefault();
      const offset = event.key === "PageUp" ? 1 : -1;
      startDevLevel(levelIndex + 1 + offset);
    });
  }

  async function restartCurrent() {
    if (state === "gameover") {
      if (!(await commitPendingHighScore())) return;
      if (!requirePendingWardrobeUnlockSelection()) return;
      await startGame();
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
    state = "menu";
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
    hideNicknameEntry();
    showMenuScreen("main");
    updateHighScores();
    ui.menu.classList.remove("hidden");
    return true;
  }

  function updateHUD() {
    ui.level.textContent = `Level ${levelIndex + 1}`;
    ui.lives.textContent = `❤️ ${lives}`;
    ui.stars.textContent = `⭐ ${collected.filter(Boolean).length}/${currentLevel().stars.length}`;
    ui.shots.textContent = `Schüsse: ${shots}`;
    ui.score.textContent = `Punkte: ${score}`;
  }

  function registerRunStarCollected() {
    runStarsCollected++;
    window.SlimeAchievements?.onStarCollected?.({runStars: runStarsCollected});

    if (DEV_MODE) return;

    const earnedChoices = awardWardrobeUnlockChoicesForRun(runStarsCollected);
    if (earnedChoices <= 0) return;

    wardrobeUnlockCategory = null;
    showGameToast(earnedChoices === 1
      ? "🎁 Freie Wardrobe-Auswahl verdient!"
      : `🎁 ${earnedChoices} freie Wardrobe-Auswahlen verdient!`);
  }

  function showMessage(title, text, buttonText, action) {
    if (action !== "gameover") hideNicknameEntry();
    state = action === "gameover" ? "gameover" : "paused";
    nextAction = action;
    ui.messageTitle.textContent = title;
    ui.messageText.textContent = text;
    ui.continueBtn.textContent = buttonText;
    ui.message.classList.remove("hidden");
  }

  function updatePerfectLevelStreak(stars) {
    if (stars === 3 && !levelHadDeath) {
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

  function finishLevel() {
    if (state !== "playing") return;

    const completedLevel = levelIndex + 1;
    const stars = collected.filter(Boolean).length;
    const bonus =
      Math.max(0, 650 + completedLevel * 45 - shots * 55) +
      stars * 250;

    const achievementContext = getAchievementLevelContext();
    window.SlimeAchievements?.onLevelCompleted?.({
      ...achievementContext,
      isPerfect: stars === 3 && !levelHadDeath,
      hadDeath: levelHadDeath,
      levelShots: shots,
      remainingLives: lives,
      collectedStars: stars,
      totalStars: currentLevel().stars.length
    });

    score += bonus;
    const streakMessage = updatePerfectLevelStreak(stars);

    updateHUD();
    if (streakMessage) showGameToast(streakMessage);
    playWin();

    showMessage(
      `Level ${completedLevel} geschafft!`,
      `${stars}/3 Sterne gesammelt. Levelbonus: ${bonus} Punkte.`,
      "Nächstes Zufallslevel",
      "next"
    );
  }

  function loseLife() {
    if (state !== "playing") return;
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
      const reachedLevel = levelIndex + 1;
      console.info(`[Highscore] RUN FINISHED score=${score}`);
      const previousBest = Number(localStorage.getItem("slimejumperBest") || 0);
      const previousBestLevel = Number(localStorage.getItem("slimejumperBestLevel") || 0);
      const best = Math.max(previousBest, score);
      const bestLevel = Math.max(previousBestLevel, reachedLevel);

      localStorage.setItem("slimejumperBest", String(best));
      localStorage.setItem("slimejumperBestLevel", String(bestLevel));
      pendingGameOverScore = { score, reachedLevel };

      showMessage(
        "Game Over",
        `Punkte: ${score} · Erreichtes Level: ${reachedLevel} · Highscore: ${best} · Bestes Level: ${bestLevel}`,
        "Highscore speichern & neue Runde",
        "gameover"
      );
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
    }
  }

  async function doContinue() {
    if (nextAction === "gameover" && !(await commitPendingHighScore())) return;
    if (nextAction === "gameover" && !requirePendingWardrobeUnlockSelection()) return;
    ui.message.classList.add("hidden");
    if (nextAction === "next") {
      levelIndex++;
      levelHadDeath = false;
      setMusicForLevel(levelIndex + 1);
      generatedLevel = generateProceduralLevel(levelIndex + 1);
      state = "playing";
      resetLevel(true);
      window.SlimeAchievements?.onLevelStart?.(getAchievementLevelContext());
    } else {
      await startGame();
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
  }

  function resumeGame() {
    if (state !== "gamePaused") return;
    lastTime = performance.now();
    state = "playing";
    ui.pauseBtn.textContent = "⏸";
    ui.pauseBtn.setAttribute("aria-label", "Pause");
  }

  function frame(now) {
    const dt = Math.min(0.026, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  async function toggleFullscreen() {
    getAudio();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        if (screen.orientation?.lock) {
          try { await screen.orientation.lock("landscape"); } catch (_) {}
        }
      } else {
        await document.exitFullscreen?.();
      }
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
    setMenuButtonArtwork(ui.howToBtn, ui.mainMenuScreen,
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
    ui.startBtn, ui.achievementsBtn, ui.wardrobeBtn, ui.howToBtn, ui.highScoresBtn,
    ui.achievementsBackBtn,
    ui.wardrobeBackBtn, ui.wardrobeColorMenuBtn, ui.wardrobeCosmeticsMenuBtn,
    ui.wardrobeBeardsMenuBtn, ui.wardrobeColorBackBtn,
    ui.wardrobeCosmeticsBackBtn, ui.wardrobeBeardsBackBtn,
    ui.howToBackBtn, ui.highScoresBackBtn
  ]) {
    button.addEventListener("pointerdown", () => button.classList.add("menuPressed"));
    button.addEventListener("pointerup", () => button.classList.remove("menuPressed"));
    button.addEventListener("pointercancel", () => button.classList.remove("menuPressed"));
    button.addEventListener("pointerleave", () => button.classList.remove("menuPressed"));
  }

  ui.startBtn.addEventListener("click", () => runMenuButtonAction(ui.startBtn, startGame));
  ui.achievementsBtn.addEventListener("click", () => runMenuButtonAction(ui.achievementsBtn, () => showMenuScreen("achievements")));
  ui.wardrobeBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBtn, () => showMenuScreen("wardrobe")));
  ui.howToBtn.addEventListener("click", () => runMenuButtonAction(ui.howToBtn, () => showMenuScreen("howto")));
  ui.highScoresBtn.addEventListener("click", () => runMenuButtonAction(ui.highScoresBtn, () => showMenuScreen("highscores")));
  ui.achievementsBackBtn.addEventListener("click", () => runMenuButtonAction(ui.achievementsBackBtn, () => showMenuScreen("main")));
  ui.wardrobeBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBackBtn, () => showMenuScreen("main")));
  ui.wardrobeColorMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeColorMenuBtn, () => showWardrobeView("color")));
  ui.wardrobeCosmeticsMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeCosmeticsMenuBtn, () => showWardrobeView("cosmetics")));
  ui.wardrobeBeardsMenuBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBeardsMenuBtn, () => showWardrobeView("beards")));
  ui.wardrobeColorBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeColorBackBtn, () => showWardrobeView("home")));
  ui.wardrobeCosmeticsBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeCosmeticsBackBtn, () => showWardrobeView("home")));
  ui.wardrobeBeardsBackBtn.addEventListener("click", () => runMenuButtonAction(ui.wardrobeBeardsBackBtn, () => showWardrobeView("home")));
  ui.howToBackBtn.addEventListener("click", () => runMenuButtonAction(ui.howToBackBtn, () => showMenuScreen("main")));
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
  ui.musicBtn.addEventListener("click", () => {
    musicMuted = !musicMuted;
    updateAudioButtons();
    updateMusicMute();

    if (!musicMuted) {
      if (state === "playing") setMusicForLevel(levelIndex + 1);
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
    if (musicStarted || musicMuted || event.target === ui.musicBtn || event.target === ui.sfxBtn) return;
    if (state === "playing") setMusicForLevel(levelIndex + 1);
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
