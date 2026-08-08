"use strict";

  const recentScoresStorageKey = "slimejumperRecentScores";
  const highScoresStorageKey = "slimejumperHighscoresV14";
  let lastOnlineScoreSubmit = Promise.resolve();
  let gameToastTimer = null;
  let devPreviewSlimeColor = null;

  function getActiveSlimeColor() {
    return DEV_MODE && devPreviewSlimeColor
      ? normalizeSlimeColor(devPreviewSlimeColor)
      : selectedSlimeColor;
  }

  function hideGameToast() {
    if (gameToastTimer !== null) window.clearTimeout(gameToastTimer);
    gameToastTimer = null;
    ui.gameToast.classList.remove("visible");
  }

  function showGameToast(message, duration = 1800) {
    hideGameToast();
    ui.gameToast.textContent = message;
    void ui.gameToast.offsetWidth;
    ui.gameToast.classList.add("visible");
    gameToastTimer = window.setTimeout(hideGameToast, duration);
  }

  function applySlimePaletteCss(element, color) {
    const palette = getSlimeColorPalette(color);
    element.style.setProperty("--slime-light", palette.light);
    element.style.setProperty("--slime-main", palette.main);
    element.style.setProperty("--slime-dark", palette.dark);
    element.style.setProperty("--slime-outline", palette.outline);
    element.style.setProperty("--slime-glow", palette.glow);
  }

  function createSlimeColorPreview(color, markerOnly = false) {
    const preview = document.createElement("span");
    preview.className = markerOnly ? "slimeColorMarker" : "slimeColorPreview";
    preview.setAttribute("aria-hidden", "true");
    applySlimePaletteCss(preview, color);
    return preview;
  }

  function createSlimeColorOption(color, unlockMode = false) {
    const unlocked = isSlimeColorUnlocked(color);
    const devPreviewAvailable = DEV_MODE && !unlockMode;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption";
    button.dataset.color = color;
    applySlimePaletteCss(button, color);
    button.classList.toggle("selected", color === getActiveSlimeColor());
    button.classList.toggle("locked", !unlocked && !devPreviewAvailable);
    button.classList.toggle("unlockable", unlockMode && !unlocked && pendingColorUnlocks > 0);
    button.disabled = !unlocked && !unlockMode && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${SLIME_COLOR_NAMES[color]} auswählen`
        : devPreviewAvailable
          ? `${SLIME_COLOR_NAMES[color]} temporär im Dev Mode ansehen`
          : unlockMode
            ? `${SLIME_COLOR_NAMES[color]} freischalten`
            : `${SLIME_COLOR_NAMES[color]} ist gesperrt`
    );

    button.appendChild(createSlimeColorPreview(color));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = SLIME_COLOR_NAMES[color];
    button.appendChild(label);

    if (!unlocked) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable ? "DEV" : unlockMode ? "+" : "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (isSlimeColorUnlocked(color)) {
        devPreviewSlimeColor = null;
        selectSlimeColor(color);
      } else if (devPreviewAvailable) {
        devPreviewSlimeColor = normalizeSlimeColor(color);
      } else {
        if (!unlockMode || pendingColorUnlocks <= 0) return;
        if (!unlockSlimeColor(color)) return;
        pendingColorUnlocks--;
        showGameToast(`🎨 ${SLIME_COLOR_NAMES[color]} freigeschaltet!`);
      }

      renderSlimeColorPicker();
      renderSlimeColorUnlockPanel();
    });

    return button;
  }

  function renderSlimeColorPicker() {
    if (!ui.slimeColorOptions) return;
    const requiredStars = getNextSlimeColorUnlockRequirement();
    if (ui.slimeColorRequirement) {
      ui.slimeColorRequirement.textContent = requiredStars === null
        ? "Alle Farben freigeschaltet"
        : `Nächste Farbe: ${requiredStars} ⭐ in einem Run`;
    }
    ui.slimeColorOptions.replaceChildren(
      ...SLIME_COLOR_ORDER.map(color => createSlimeColorOption(color))
    );
  }

  function hideSlimeColorUnlockPanel() {
    ui.slimeColorUnlockPanel?.classList.add("hidden");
  }

  function renderSlimeColorUnlockPanel() {
    if (!ui.slimeColorUnlockPanel || !ui.slimeColorUnlockOptions) return;
    if (pendingColorUnlocks <= 0) {
      hideSlimeColorUnlockPanel();
      return;
    }

    ui.slimeColorUnlockPanel.classList.remove("hidden");
    ui.slimeColorUnlockText.textContent =
      `${runStarsCollected} Run-Sterne: Wähle noch ${pendingColorUnlocks} ` +
      `${pendingColorUnlocks === 1 ? "Farbe" : "Farben"}.`;
    ui.slimeColorUnlockOptions.replaceChildren(
      ...SLIME_COLOR_ORDER.map(color => createSlimeColorOption(color, true))
    );
  }

  function requirePendingColorUnlockSelection() {
    if (pendingColorUnlocks <= 0) return true;
    renderSlimeColorUnlockPanel();
    showGameToast(
      pendingColorUnlocks === 1
        ? "🎨 Wähle zuerst deine neue Slime-Farbe."
        : `🎨 Wähle zuerst deine ${pendingColorUnlocks} neuen Slime-Farben.`
    );
    return false;
  }

  function loadRecentScores() {
    try {
      const saved = JSON.parse(localStorage.getItem(recentScoresStorageKey) || "[]");
      return Array.isArray(saved) ? saved.slice(0, 3) : [];
    } catch (_) {
      return [];
    }
  }

  function normalizeNickname(value, fallback = "---") {
    const cleaned = String(value ?? "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
    return cleaned.length === 3 ? cleaned : fallback;
  }

  function sanitizeScoreEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(entry => ({
        name: normalizeNickname(entry?.name, "---"),
        score: Math.max(0, Math.floor(Number(entry?.score) || 0)),
        level: Math.max(1, Math.floor(Number(entry?.level) || 1)),
        slimeColor: normalizeSlimeColor(entry?.slimeColor ?? entry?.slime_color)
      }))
      .filter(entry => Number.isFinite(entry.score) && Number.isFinite(entry.level));
  }

  function loadHighScores() {
    try {
      const stored = JSON.parse(localStorage.getItem(highScoresStorageKey) || "[]");
      let entries = sanitizeScoreEntries(stored);

      // Alte lokale Highscores aus früheren Versionen bleiben erhalten.
      if (entries.length === 0) entries = sanitizeScoreEntries(loadRecentScores());

      return entries
        .sort((a, b) => b.score - a.score || b.level - a.level)
        .slice(0, 10);
    } catch (_) {
      return sanitizeScoreEntries(loadRecentScores())
        .sort((a, b) => b.score - a.score || b.level - a.level)
        .slice(0, 10);
    }
  }

  function saveHighScore(name, finalScore, reachedLevel) {
    const highScores = loadHighScores();
    highScores.push({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor
    });

    highScores.sort((a, b) => b.score - a.score || b.level - a.level);

    try {
      localStorage.setItem(highScoresStorageKey, JSON.stringify(highScores.slice(0, 10)));
    } catch (_) {}
  }

  function submitOnlineHighScore(name, finalScore, reachedLevel) {
    const online = window.SlimeJumpHighscores;
    if (!online?.isConfigured?.()) return;

    lastOnlineScoreSubmit = online.submitScore({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor
    }).catch(error => {
      console.warn("Online-Highscore konnte nicht gespeichert werden:", error);
    });
  }

  function saveRecentScore(name, finalScore, reachedLevel) {
    const recentScores = sanitizeScoreEntries(loadRecentScores());
    recentScores.unshift({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor
    });

    try {
      localStorage.setItem(
        recentScoresStorageKey,
        JSON.stringify(recentScores.slice(0, 3))
      );
    } catch (_) {}

    saveHighScore(name, finalScore, reachedLevel);
    submitOnlineHighScore(name, finalScore, reachedLevel);
  }

  function showNicknameEntry() {
    const remembered = normalizeNickname(localStorage.getItem("slimejumperLastNickname"), "");
    ui.nicknameInput.value = remembered;
    ui.nicknameEntry.classList.remove("hidden", "invalid");
    ui.nicknameHint.textContent = remembered.length === 3
      ? "Name wird mit deinem Highscore gespeichert."
      : "Genau 3 Buchstaben (A–Z)";
  }

  function hideNicknameEntry() {
    ui.nicknameEntry.classList.add("hidden");
    ui.nicknameEntry.classList.remove("invalid");
    ui.nicknameInput.value = "";
  }

  function commitPendingHighScore() {
    if (!pendingGameOverScore) return true;

    const nickname = normalizeNickname(ui.nicknameInput.value, "");
    if (nickname.length !== 3) {
      ui.nicknameEntry.classList.remove("invalid");
      void ui.nicknameEntry.offsetWidth;
      ui.nicknameEntry.classList.add("invalid");
      ui.nicknameHint.textContent = "Bitte genau 3 Buchstaben eingeben.";
      ui.nicknameInput.focus();
      return false;
    }

    saveRecentScore(
      nickname,
      pendingGameOverScore.score,
      pendingGameOverScore.reachedLevel
    );
    try { localStorage.setItem("slimejumperLastNickname", nickname); } catch (_) {}

    pendingGameOverScore = null;
    hideNicknameEntry();
    void updateHighScores();
    return true;
  }

  function renderHighScoreRows(highScores, emptyText = "Noch keine Highscores – spiel deine erste Runde!") {
    ui.highscoreRows.replaceChildren();

    if (highScores.length === 0) {
      const empty = document.createElement("div");
      empty.className = "highscoreEmpty";
      empty.textContent = emptyText;
      ui.highscoreRows.appendChild(empty);
      return;
    }

    for (let index = 0; index < 10; index++) {
      const entry = highScores[index];
      const row = document.createElement("div");
      row.className = "highscoreRow";

      const rank = document.createElement("span");
      rank.className = "rankBadge";
      rank.textContent = String(index + 1);

      const name = document.createElement("span");
      name.className = "scoreName";
      if (entry) {
        name.append(
          createSlimeColorPreview(normalizeSlimeColor(entry.slimeColor), true),
          document.createTextNode(normalizeNickname(entry.name, "---"))
        );
      } else {
        name.textContent = "—";
      }

      const points = document.createElement("span");
      points.className = "scorePoints";
      points.textContent = entry ? Number(entry.score).toLocaleString("de-DE") : "—";

      const level = document.createElement("span");
      level.className = "scoreLevel";
      level.textContent = entry ? `Level ${entry.level}` : "—";

      row.append(rank, name, points, level);
      ui.highscoreRows.appendChild(row);
    }
  }

  async function updateHighScores() {
    const online = window.SlimeJumpHighscores;

    if (!online?.isConfigured?.()) {
      renderHighScoreRows(loadHighScores());
      return;
    }

    renderHighScoreRows([], "Online-Highscores werden geladen …");

    try {
      await lastOnlineScoreSubmit;
      const highScores = await online.getTopScores(10);
      renderHighScoreRows(highScores);
    } catch (error) {
      console.warn("Online-Highscores konnten nicht geladen werden:", error);
      renderHighScoreRows(
        loadHighScores(),
        "Online-Highscores sind gerade nicht erreichbar."
      );
    }
  }

  function showMenuScreen(screenName = "main") {
    ui.mainMenuScreen.classList.toggle("hidden", screenName !== "main");
    ui.howToScreen.classList.toggle("hidden", screenName !== "howto");
    ui.highscoreScreen.classList.toggle("hidden", screenName !== "highscores");
    if (screenName === "main") renderSlimeColorPicker();
    if (screenName === "howto") {
      const scrollArea = ui.howToScreen.querySelector(".howToScrollArea");
      initializeHowToScrollbar();
      if (scrollArea) scrollArea.scrollTop = 0;
      window.requestAnimationFrame(updateHowToScrollbar);
    }
    if (screenName === "highscores") void updateHighScores();
  }

  function getHowToThumbOffset(scrollTop, scrollHeight, clientHeight, trackHeight, thumbHeight) {
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const maxThumbTravel = Math.max(0, trackHeight - thumbHeight);
    if (maxScroll === 0 || maxThumbTravel === 0) return 0;
    const scrollProgress = Math.min(1, Math.max(0, scrollTop / maxScroll));
    return scrollProgress * maxThumbTravel;
  }

  function updateHowToScrollbar() {
    const scrollArea = ui.howToScreen.querySelector(".howToScrollArea");
    const track = ui.howToScreen.querySelector(".howToCustomScrollbar");
    const thumb = ui.howToScreen.querySelector(".howToScrollbarThumb");
    if (!scrollArea || !track || !thumb) return;

    const thumbOffset = getHowToThumbOffset(
      scrollArea.scrollTop,
      scrollArea.scrollHeight,
      scrollArea.clientHeight,
      track.clientHeight,
      thumb.offsetHeight
    );
    thumb.style.transform = `translateY(${thumbOffset}px)`;
  }

  function initializeHowToScrollbar() {
    const scrollArea = ui.howToScreen.querySelector(".howToScrollArea");
    if (!scrollArea || scrollArea.dataset.slimeScrollbarReady === "1") return;

    scrollArea.dataset.slimeScrollbarReady = "1";
    scrollArea.addEventListener("scroll", updateHowToScrollbar, {passive: true});
    ui.howToScreen.querySelector(".howToLongArtwork")
      ?.addEventListener("load", updateHowToScrollbar);
    window.addEventListener("resize", updateHowToScrollbar);
  }

