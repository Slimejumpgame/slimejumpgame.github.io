"use strict";

  const recentScoresStorageKey = "slimejumperRecentScores";
  const highScoresStorageKey = "slimejumperHighscoresV14";
  let lastOnlineScoreSubmit = Promise.resolve();
  let gameToastTimer = null;
  let devPreviewSlimeColor = null;
  let devPreviewSlimeCosmetic = null;
  let devPreviewSlimeBeard = null;

  function initializeMenuBiomeBackground() {
    const menuBackdrop = document.querySelector(".menuBackdrop");
    if (
      !menuBackdrop ||
      menuBackdrop.querySelector(".menuBiomeBackground") ||
      !Array.isArray(BIOMES) ||
      BIOMES.length === 0 ||
      typeof drawBackground !== "function"
    ) {
      return;
    }

    const selectedBiome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
    const menuBackground = document.createElement("canvas");
    const menuBackgroundContext = menuBackground.getContext("2d");
    if (!menuBackgroundContext) return;

    menuBackground.className = "menuBiomeBackground";
    menuBackground.width = W;
    menuBackground.height = H;
    menuBackground.setAttribute("aria-hidden", "true");
    menuBackground.dataset.biomeId = selectedBiome.id;

    try {
      // Ausschließlich den zentralen Biom-Hintergrund rendern und als statischen
      // Session-Snapshot übernehmen. Gameplay-Objekte werden nicht gezeichnet.
      drawBackground(selectedBiome);
      menuBackgroundContext.drawImage(canvas, 0, 0, W, H);
      menuBackdrop.dataset.biomeId = selectedBiome.id;
      menuBackdrop.prepend(menuBackground);
    } catch (error) {
      console.warn("Menü-Biom-Hintergrund konnte nicht gerendert werden:", error);
    }
  }

  initializeMenuBiomeBackground();

  function getActiveSlimeColor() {
    return DEV_MODE && devPreviewSlimeColor
      ? normalizeSlimeColor(devPreviewSlimeColor)
      : selectedSlimeColor;
  }

  function getActiveSlimeCosmetic() {
    return DEV_MODE && devPreviewSlimeCosmetic
      ? normalizeSlimeCosmetic(devPreviewSlimeCosmetic)
      : selectedSlimeCosmetic;
  }

  function getActiveSlimeBeard() {
    return DEV_MODE && devPreviewSlimeBeard
      ? normalizeSlimeBeard(devPreviewSlimeBeard)
      : selectedSlimeBeard;
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
    element.style.setProperty("--slime-face", palette.face ?? "#0b2c1a");
  }

  function createSlimeColorPreview(color, markerOnly = false) {
    const preview = document.createElement("span");
    preview.className = markerOnly ? "slimeColorMarker" : "slimeColorPreview";
    preview.setAttribute("aria-hidden", "true");
    applySlimePaletteCss(preview, color);
    return preview;
  }

  function createLeaderboardSlimePreview(color, cosmetic, beard = "none") {
    const preview = document.createElement("canvas");
    preview.className = "slimeLeaderboardPreview";
    preview.width = 88;
    preview.height = 70;
    preview.setAttribute("aria-hidden", "true");
    drawSlimeCharacterPreview(
      preview,
      normalizeSlimeCosmetic(cosmetic),
      normalizeSlimeBeard(beard),
      normalizeSlimeColor(color)
    );
    return preview;
  }

  function renderMenuMascot() {
    if (!ui.menuMascot) return;
    const cosmetic = getActiveSlimeCosmetic();
    const definition = getSlimeCosmeticDefinition(cosmetic);
    const isHat = definition?.type === "hat";
    const isBow = cosmetic === "bow";
    drawSlimeCharacterPreview(
      ui.menuMascot,
      cosmetic,
      getActiveSlimeBeard(),
      getActiveSlimeColor(),
      isHat
        ? {centerY: 128, scale: 1.35}
        : isBow
          ? {centerY: 96, scale: 1.7}
          : {centerY: 95, scale: 2}
    );
  }

  function createSlimeColorOption(color, unlockMode = false) {
    const unlocked = isSlimeColorUnlocked(color);
    const unlockRequirement = getWardrobeUnlockRequirementForTarget("color", color);
    const devPreviewAvailable = DEV_MODE && !unlockMode;
    const canUnlock =
      unlockMode &&
      pendingWardrobeUnlock &&
      wardrobeUnlockCategory === "color" &&
      !unlocked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption";
    button.dataset.color = color;
    applySlimePaletteCss(button, color);
    button.classList.toggle("selected", color === getActiveSlimeColor());
    button.classList.toggle("locked", !unlocked && !devPreviewAvailable);
    button.classList.toggle("unlockable", canUnlock);
    button.disabled = unlockMode ? !canUnlock : !unlocked && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${SLIME_COLOR_NAMES[color]} auswählen`
        : devPreviewAvailable
          ? `${SLIME_COLOR_NAMES[color]} temporär im Dev Mode ansehen`
          : unlockMode
            ? `${SLIME_COLOR_NAMES[color]} als Wardrobe-Item freischalten`
            : unlockRequirement === null
              ? `${SLIME_COLOR_NAMES[color]} ist gesperrt`
              : `${SLIME_COLOR_NAMES[color]} ist gesperrt und benötigt ${unlockRequirement} Sterne in einem Run`
    );

    button.appendChild(createSlimeColorPreview(color));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = SLIME_COLOR_NAMES[color];
    button.appendChild(label);

    if (!unlocked) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable
        ? "DEV"
        : unlockMode
          ? "+"
          : unlockRequirement === null
            ? "🔒"
            : `${unlockRequirement}★`;
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
        if (!canUnlock) return;
        if (!unlockSlimeColor(color)) return;
        pendingWardrobeUnlock = false;
        wardrobeUnlockCategory = null;
        showGameToast(`🎨 ${SLIME_COLOR_NAMES[color]} freigeschaltet!`);
      }

      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    return button;
  }

  function renderWardrobeProgress() {
    const requiredStars = getNextWardrobeUnlockRequirement();
    const fixedTarget = getNextWardrobeUnlockTarget();
    const fixedTargetName = fixedTarget?.category === "color"
      ? SLIME_COLOR_NAMES[fixedTarget.id]
      : fixedTarget?.category === "cosmetic"
        ? getSlimeCosmeticDefinition(fixedTarget.id).name
        : fixedTarget?.category === "beard"
          ? getSlimeBeardDefinition(fixedTarget.id).name
          : null;
    if (ui.slimeColorRequirement) {
      ui.slimeColorRequirement.textContent = requiredStars === null
        ? "Wardrobe komplett!"
        : fixedTargetName
          ? `Nächstes Ziel: ${fixedTargetName} · ${requiredStars} ⭐ in einem Run`
          : `Nächster Unlock: ${requiredStars} ⭐ in einem Run`;
    }
  }

  function renderSlimeColorPicker() {
    if (!ui.slimeColorOptions) return;
    renderWardrobeProgress();
    ui.slimeColorOptions.replaceChildren(
      ...SLIME_COLOR_ORDER.map(color => createSlimeColorOption(color))
    );
  }

  function createSlimeCosmeticPreview(cosmetic) {
    const preview = document.createElement("canvas");
    preview.className = "slimeCosmeticPreview";
    preview.width = 88;
    preview.height = 70;
    preview.setAttribute("aria-hidden", "true");
    drawSlimeCharacterPreview(
      preview,
      cosmetic,
      getActiveSlimeBeard(),
      getActiveSlimeColor()
    );
    return preview;
  }

  function createSlimeCosmeticOption(cosmetic, unlockMode = false) {
    const unlocked = isSlimeCosmeticUnlocked(cosmetic);
    const devPreviewAvailable = DEV_MODE && !unlockMode && !unlocked;
    const canUnlock =
      unlockMode &&
      pendingWardrobeUnlock &&
      wardrobeUnlockCategory === "cosmetic" &&
      !unlocked;
    const definition = getSlimeCosmeticDefinition(cosmetic);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption slimeCosmeticOption";
    button.dataset.cosmetic = cosmetic;
    button.classList.toggle("selected", cosmetic === getActiveSlimeCosmetic());
    button.classList.toggle("locked", !unlocked && !devPreviewAvailable);
    button.classList.toggle("unlockable", canUnlock);
    button.disabled = unlockMode ? !canUnlock : !unlocked && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${definition.name} auswählen`
        : devPreviewAvailable
          ? `${definition.name} temporär im Dev Mode ansehen`
          : unlockMode
            ? `${definition.name} als Wardrobe-Item freischalten`
            : `${definition.name} ist gesperrt`
    );

    button.appendChild(createSlimeCosmeticPreview(cosmetic));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = definition.name;
    button.appendChild(label);

    if (!unlocked) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable ? "DEV" : "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (isSlimeCosmeticUnlocked(cosmetic)) {
        devPreviewSlimeCosmetic = null;
        selectSlimeCosmetic(cosmetic);
      } else if (devPreviewAvailable) {
        devPreviewSlimeCosmetic = normalizeSlimeCosmetic(cosmetic);
      } else {
        if (!canUnlock) return;
        if (!unlockSlimeCosmetic(cosmetic)) return;
        pendingWardrobeUnlock = false;
        wardrobeUnlockCategory = null;
        showGameToast(`🎩 ${definition.name} freigeschaltet!`);
      }

      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    return button;
  }

  function renderSlimeCosmeticPicker() {
    if (!ui.slimeCosmeticOptions) return;
    renderWardrobeProgress();
    ui.slimeCosmeticOptions.replaceChildren(
      ...SLIME_COSMETIC_ORDER.map(cosmetic => createSlimeCosmeticOption(cosmetic))
    );
  }

  function createSlimeBeardPreview(beard) {
    const preview = document.createElement("canvas");
    preview.className = "slimeCosmeticPreview slimeBeardPreview";
    preview.width = 88;
    preview.height = 70;
    preview.setAttribute("aria-hidden", "true");
    drawSlimeCharacterPreview(
      preview,
      getActiveSlimeCosmetic(),
      beard,
      getActiveSlimeColor()
    );
    return preview;
  }

  function createSlimeBeardOption(beard, unlockMode = false) {
    const unlocked = isSlimeBeardUnlocked(beard);
    const devPreviewAvailable = DEV_MODE && !unlockMode && !unlocked;
    const canUnlock =
      unlockMode &&
      pendingWardrobeUnlock &&
      wardrobeUnlockCategory === "beard" &&
      !unlocked;
    const definition = getSlimeBeardDefinition(beard);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption slimeBeardOption";
    button.dataset.beard = beard;
    button.classList.toggle("selected", beard === getActiveSlimeBeard());
    button.classList.toggle("locked", !unlocked && !devPreviewAvailable);
    button.classList.toggle("unlockable", canUnlock);
    button.disabled = unlockMode ? !canUnlock : !unlocked && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${definition.name} auswählen`
        : devPreviewAvailable
          ? `${definition.name} temporär im Dev Mode ansehen`
          : unlockMode
            ? `${definition.name} als Wardrobe-Item freischalten`
            : `${definition.name} ist gesperrt`
    );

    button.appendChild(createSlimeBeardPreview(beard));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = definition.name;
    button.appendChild(label);

    if (!unlocked) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable ? "DEV" : "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (isSlimeBeardUnlocked(beard)) {
        devPreviewSlimeBeard = null;
        selectSlimeBeard(beard);
      } else if (devPreviewAvailable) {
        devPreviewSlimeBeard = normalizeSlimeBeard(beard);
      } else {
        if (!canUnlock) return;
        if (!unlockSlimeBeard(beard)) return;
        pendingWardrobeUnlock = false;
        wardrobeUnlockCategory = null;
        showGameToast(`🧔 ${definition.name} freigeschaltet!`);
      }

      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    return button;
  }

  function renderSlimeBeardPicker() {
    if (!ui.slimeBeardOptions) return;
    renderWardrobeProgress();
    ui.slimeBeardOptions.replaceChildren(
      ...SLIME_BEARD_ORDER.map(beard => createSlimeBeardOption(beard))
    );
  }

  function showWardrobeView(viewName = "home") {
    ui.wardrobeHome.classList.toggle("hidden", viewName !== "home");
    ui.wardrobeColorView.classList.toggle("hidden", viewName !== "color");
    ui.wardrobeCosmeticsView.classList.toggle("hidden", viewName !== "cosmetics");
    ui.wardrobeBeardsView.classList.toggle("hidden", viewName !== "beards");
    renderWardrobeProgress();
    if (viewName === "color") renderSlimeColorPicker();
    if (viewName === "cosmetics") renderSlimeCosmeticPicker();
    if (viewName === "beards") renderSlimeBeardPicker();
  }

  function hideWardrobeUnlockPanel() {
    ui.wardrobeUnlockPanel?.classList.add("hidden");
  }

  function createWardrobeCategoryButton(category, label, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wardrobeCategoryButton";
    button.dataset.category = category;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => {
      if (button.disabled || !pendingWardrobeUnlock) return;
      wardrobeUnlockCategory = category;
      renderWardrobeUnlockPanel();
    });
    return button;
  }

  function renderWardrobeUnlockPanel() {
    if (!ui.wardrobeUnlockPanel || !ui.wardrobeUnlockOptions) return;
    if (!pendingWardrobeUnlock || getNextWardrobeUnlockRequirement() === null) {
      hideWardrobeUnlockPanel();
      return;
    }

    const fixedTarget = getNextWardrobeUnlockTarget();
    let lockedColors = getLockedSlimeColors();
    let lockedCosmetics = getLockedSlimeCosmetics();
    let lockedBeards = getLockedSlimeBeards();
    if (fixedTarget) {
      lockedColors = fixedTarget.category === "color"
        ? lockedColors.filter(color => color === fixedTarget.id)
        : [];
      lockedCosmetics = fixedTarget.category === "cosmetic"
        ? lockedCosmetics.filter(cosmetic => cosmetic === fixedTarget.id)
        : [];
      lockedBeards = fixedTarget.category === "beard"
        ? lockedBeards.filter(beard => beard === fixedTarget.id)
        : [];
    } else {
      lockedColors = lockedColors.filter(
        color => getWardrobeUnlockRequirementForTarget("color", color) === null
      );
      lockedCosmetics = lockedCosmetics.filter(
        cosmetic => getWardrobeUnlockRequirementForTarget("cosmetic", cosmetic) === null
      );
      lockedBeards = [];
    }
    if (wardrobeUnlockCategory === "color" && lockedColors.length === 0) {
      wardrobeUnlockCategory = null;
    }
    if (wardrobeUnlockCategory === "cosmetic" && lockedCosmetics.length === 0) {
      wardrobeUnlockCategory = null;
    }
    if (wardrobeUnlockCategory === "beard" && lockedBeards.length === 0) {
      wardrobeUnlockCategory = null;
    }

    ui.wardrobeUnlockPanel.classList.remove("hidden");
    ui.wardrobeUnlockCategories.classList.toggle("hidden", wardrobeUnlockCategory !== null);
    ui.wardrobeUnlockOptions.classList.toggle("hidden", wardrobeUnlockCategory === null);
    ui.wardrobeUnlockBackBtn.classList.toggle("hidden", wardrobeUnlockCategory === null);

    if (wardrobeUnlockCategory === null) {
      ui.wardrobeUnlockText.textContent =
        `${runStarsCollected} Run-Sterne: Was möchtest du freischalten?`;
      ui.wardrobeUnlockCategories.replaceChildren(
        createWardrobeCategoryButton("color", "🎨 FARBE", lockedColors.length === 0),
        createWardrobeCategoryButton("cosmetic", "🎩 COSMETIC", lockedCosmetics.length === 0),
        createWardrobeCategoryButton("beard", "🧔 BART", lockedBeards.length === 0)
      );
      ui.wardrobeUnlockOptions.replaceChildren();
      return;
    }

    const unlocksColor = wardrobeUnlockCategory === "color";
    const unlocksCosmetic = wardrobeUnlockCategory === "cosmetic";
    ui.wardrobeUnlockText.textContent = unlocksColor
      ? "Wähle eine noch gesperrte Farbe."
      : unlocksCosmetic
        ? "Wähle ein noch gesperrtes Cosmetic."
        : "Wähle einen noch gesperrten Bart.";
    ui.wardrobeUnlockOptions.replaceChildren(
      ...(unlocksColor
        ? lockedColors.map(color => createSlimeColorOption(color, true))
        : unlocksCosmetic
          ? lockedCosmetics.map(cosmetic => createSlimeCosmeticOption(cosmetic, true))
          : lockedBeards.map(beard => createSlimeBeardOption(beard, true)))
    );
  }

  function requirePendingWardrobeUnlockSelection() {
    if (!pendingWardrobeUnlock) return true;
    renderWardrobeUnlockPanel();
    showGameToast("🎁 Wähle zuerst dein neues Wardrobe-Item.");
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
        slimeColor: normalizeSlimeColor(entry?.slimeColor ?? entry?.slime_color),
        slimeCosmetic: normalizeSlimeCosmetic(
          entry?.slimeCosmetic ?? entry?.slime_cosmetic
        ),
        slimeBeard: normalizeSlimeBeard(entry?.slimeBeard ?? entry?.slime_beard)
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
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard
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
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard
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
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard
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
          createLeaderboardSlimePreview(
            entry.slimeColor,
            entry.slimeCosmetic,
            entry.slimeBeard
          ),
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
    ui.wardrobeScreen.classList.toggle("hidden", screenName !== "wardrobe");
    ui.howToScreen.classList.toggle("hidden", screenName !== "howto");
    ui.highscoreScreen.classList.toggle("hidden", screenName !== "highscores");
    if (screenName === "main") {
      renderMenuMascot();
    }
    if (screenName === "wardrobe") {
      showWardrobeView("home");
    }
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

