"use strict";

  const recentScoresStorageKey = "slimejumperRecentScores";
  const highScoresStorageKey = "slimejumperHighscoresV14";
  let lastOnlineScoreSubmit = Promise.resolve(null);
  let gameToastTimer = null;
  let devPreviewSlimeColor = null;
  let devPreviewSlimeCosmetic = null;
  let devPreviewSlimeBeard = null;

  function isDevShopTestActive() {
    return DEV_MODE && Boolean(window.SlimeDevShopTest?.isActive?.());
  }

  function getWardrobePurchaseEconomy() {
    return isDevShopTestActive()
      ? window.SlimeDevShopTest
      : window.SlimeStarEconomy;
  }

  function renderDevShopTestControl() {
    if (!ui.devShopTestBtn || !DEV_MODE) return;
    const shopTest = window.SlimeDevShopTest;
    const active = Boolean(shopTest?.isActive?.());
    const balance = Math.max(0, Number(shopTest?.getBalance?.()) || 0);
    ui.devShopTestBtn.setAttribute("aria-pressed", String(active));
    ui.devShopTestBtn.textContent = active
      ? `SHOP TEST · ${balance.toLocaleString("de-DE")} ⭐`
      : "SHOP TEST";
  }

  function toggleDevShopTest() {
    if (!DEV_MODE || !window.SlimeDevShopTest) return;
    window.SlimeDevShopTest.setActive(!isDevShopTestActive());
    devPreviewSlimeColor = null;
    devPreviewSlimeCosmetic = null;
    devPreviewSlimeBeard = null;
    renderDevShopTestControl();
    renderSlimeColorPicker();
    renderSlimeCosmeticPicker();
    renderSlimeBeardPicker();
    renderMenuMascot();
  }

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

  function getPersonalBestScore() {
    try {
      return Math.max(
        0,
        Math.floor(Number(localStorage.getItem("slimejumperBest")) || 0)
      );
    } catch (_) {
      return 0;
    }
  }

  function renderMainMenuPrestige(progress) {
    const prestige = window.SlimePrestige;
    if (!prestige || !ui.menuPrestigeBtn) return;

    const prestigeLevel = prestige.getLevel();
    const isReady = progress?.isPrestigeReady === true;
    const isMastered = isReady && prestigeLevel >= prestige.maxAvailablePrestige;
    const hasEmblem = prestigeLevel > 0;
    const transactionPending = prestige.isTransactionPending();

    ui.menuPrestigeBtn.classList.remove("hidden");
    ui.menuPrestigeBtn.classList.toggle("prestigeInvisible", !hasEmblem && !isReady);
    ui.menuPrestigeBtn.classList.toggle("prestigeReady", isReady && !isMastered);
    ui.menuPrestigeBtn.classList.toggle("prestigeMastered", isMastered);
    ui.menuPrestigeBtn.classList.toggle("prestigeZeroReady", !hasEmblem && isReady);
    ui.menuPrestigeBtn.disabled = !isReady || isMastered || transactionPending;

    if (ui.menuPrestigeEmblem) {
      ui.menuPrestigeEmblem.innerHTML = hasEmblem
        ? prestige.getEmblemMarkup(prestigeLevel)
        : "";
    }

    const displayDefinition = prestige.getDisplayDefinition(prestigeLevel);
    const label = transactionPending
      ? "RESET AUSSTEHEND"
      : isMastered
        ? "PRESTIGE MASTERED"
        : isReady
          ? "PRESTIGE READY"
          : displayDefinition?.displayLabel ?? `P${prestigeLevel}`;
    if (ui.menuPrestigeLabel) ui.menuPrestigeLabel.textContent = label;
    ui.menuPrestigeBtn.setAttribute(
      "aria-label",
      isMastered
        ? `Prestige ${prestigeLevel} gemeistert`
        : isReady
          ? `Prestige ${prestigeLevel + 1} aktivieren`
          : `Prestige ${prestigeLevel}`
    );
  }

  function renderMainMenuPlayerProgress() {
    const progress = window.SlimePlayerProgress?.getPlayerProgress?.();
    if (!progress) return;

    if (ui.menuPlayerLevel) {
      ui.menuPlayerLevel.textContent = `#${progress.level}`;
      ui.menuPlayerLevel.setAttribute("aria-label", `Spielerlevel ${progress.level}`);
    }

    if (
      !ui.menuXPProgress ||
      !ui.menuXPProgressText ||
      !ui.menuXPProgressBar ||
      !ui.menuXPProgressBarFill
    ) return;

    const levelXP = Math.max(0, Math.floor(Number(progress.levelXP) || 0));
    const requiredXP = Math.max(0, Math.floor(Number(progress.requiredXP) || 0));
    const isPrestigeReady = progress.isPrestigeReady === true;
    const prestigeLevel = window.SlimePrestige?.getLevel?.() ?? 0;
    const isPrestigeMastered = isPrestigeReady &&
      prestigeLevel >= (window.SlimePrestige?.maxAvailablePrestige ?? Infinity);
    const progressPercent = requiredXP === 0
      ? 0
      : Math.min(100, levelXP / requiredXP * 100);

    ui.menuXPProgressText.textContent = isPrestigeMastered
      ? "PRESTIGE MASTERED"
      : isPrestigeReady
        ? "PRESTIGE READY"
        : `${levelXP.toLocaleString("de-DE")} / ${requiredXP.toLocaleString("de-DE")}`;
    ui.menuXPProgressBarFill.style.width = `${progressPercent}%`;
    ui.menuXPProgressBar.setAttribute("aria-valuemax", String(requiredXP));
    ui.menuXPProgressBar.setAttribute("aria-valuenow", String(levelXP));
    ui.menuXPProgressBar.setAttribute(
      "aria-valuetext",
      isPrestigeMastered
        ? "Prestige gemeistert"
        : isPrestigeReady
          ? "Prestige bereit"
          : `${levelXP} von ${requiredXP} XP`
    );
    ui.menuXPProgress.setAttribute(
      "aria-label",
      isPrestigeMastered
        ? "XP · Prestige gemeistert"
        : isPrestigeReady
          ? "XP · Prestige bereit"
          : `XP ${levelXP} von ${requiredXP}`
    );
    renderMainMenuPrestige(progress);
  }

  function renderMainMenuStats() {
    if (ui.personalBestValue) {
      ui.personalBestValue.textContent = getPersonalBestScore().toLocaleString("de-DE");
    }
    if (ui.starBalanceValue) {
      const balance = window.SlimeStarEconomy?.getBalance?.() ?? 0;
      ui.starBalanceValue.textContent = Math.max(0, balance).toLocaleString("de-DE");
    }
    renderMainMenuPlayerProgress();
  }

  function hideGameOverXPProgress() {
    ui.gameOverXPPanel?.classList.add("hidden");
  }

  function renderGameOverXPProgress(runXPResult) {
    if (!ui.gameOverXPPanel || !runXPResult) {
      hideGameOverXPProgress();
      return;
    }

    const earnedXP = Math.max(0, Math.floor(Number(runXPResult.earnedXP) || 0));
    const level = Math.max(1, Math.floor(Number(runXPResult.level) || 1));
    const levelXP = Math.max(0, Math.floor(Number(runXPResult.levelXP) || 0));
    const requiredXP = Math.max(0, Math.floor(Number(runXPResult.requiredXP) || 0));
    const isPrestigeReady = runXPResult.isPrestigeReady === true;
    const prestigeLevel = window.SlimePrestige?.getLevel?.() ?? 0;
    const isPrestigeMastered = isPrestigeReady &&
      prestigeLevel >= (window.SlimePrestige?.maxAvailablePrestige ?? Infinity);
    const levelsGained = Math.max(
      0,
      Math.floor(Number(runXPResult.levelsGained) || 0)
    );
    const progressPercent = requiredXP === 0
      ? 0
      : Math.min(100, levelXP / requiredXP * 100);

    ui.gameOverXPEarned.textContent = `+${earnedXP.toLocaleString("de-DE")} XP`;
    ui.gameOverLevelUp.textContent = levelsGained > 1
      ? `${levelsGained} LEVEL UPS!`
      : "LEVEL UP!";
    ui.gameOverLevelUp.classList.toggle("hidden", levelsGained === 0);
    ui.gameOverPlayerLevel.textContent = isPrestigeMastered
      ? `LEVEL ${level} · PRESTIGE MASTERED`
      : isPrestigeReady
        ? `LEVEL ${level} · PRESTIGE READY`
        : `LEVEL ${level}`;
    ui.gameOverXPBarFill.style.width = `${progressPercent}%`;
    ui.gameOverXPBar.setAttribute("aria-valuemax", String(requiredXP));
    ui.gameOverXPBar.setAttribute("aria-valuenow", String(levelXP));
    ui.gameOverXPBar.setAttribute(
      "aria-valuetext",
      isPrestigeMastered
        ? "Prestige gemeistert"
        : isPrestigeReady
          ? "Prestige bereit"
          : `${levelXP} von ${requiredXP} XP`
    );
    ui.gameOverXPProgress.textContent = isPrestigeMastered
      ? "PRESTIGE MASTERED"
      : isPrestigeReady
        ? "PRESTIGE READY"
        : `${levelXP.toLocaleString("de-DE")} / ${requiredXP.toLocaleString("de-DE")} XP`;
    ui.gameOverXPPanel.classList.remove("hidden");
    renderMainMenuPlayerProgress();
  }

  function getWardrobePurchaseRequirementText() {
    const pendingChoices = DEV_MODE ? 0 : getPendingWardrobeUnlockChoiceCount();
    return pendingChoices > 0
      ? `🎁 ${pendingChoices} freie Auswahl${pendingChoices === 1 ? "" : "en"} verfügbar`
      : "🔒 Freie Auswahl über Run-Meilenstein";
  }

  function createWardrobePurchaseSlot(category, itemId, itemName, optionButton) {
    const economy = getWardrobePurchaseEconomy();
    const price = economy?.itemPrice ?? 250;
    const slot = document.createElement("div");
    slot.className = "wardrobePurchaseSlot";

    const normalRequirement = document.createElement("span");
    normalRequirement.className = "wardrobePurchaseRequirement";
    normalRequirement.textContent = getWardrobePurchaseRequirementText();

    const freeUnlockButton = document.createElement("button");
    freeUnlockButton.type = "button";
    freeUnlockButton.className = "wardrobeFreeUnlockButton";
    freeUnlockButton.textContent = "GRATIS FREISCHALTEN";
    freeUnlockButton.setAttribute(
      "aria-label",
      `${itemName} mit einer freien Wardrobe-Auswahl freischalten`
    );
    freeUnlockButton.addEventListener("click", event => {
      event.stopPropagation();
      if (!redeemPendingWardrobeUnlockChoice(category, itemId)) return;

      wardrobeUnlockCategory = null;
      showGameToast(`🎁 ${itemName} gratis freigeschaltet!`);
      window.SlimeAchievements?.checkWardrobe?.();
      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    const buyButton = document.createElement("button");
    buyButton.type = "button";
    buyButton.className = "wardrobeBuyButton";
    buyButton.textContent = `KAUFEN · ${price} ⭐`;
    buyButton.disabled = !economy?.canPurchaseWardrobeItem?.(category, itemId);
    buyButton.setAttribute(
      "aria-label",
      `${itemName} für ${price} Sterne kaufen`
    );
    buyButton.addEventListener("click", event => {
      event.stopPropagation();
      const result = economy?.purchaseWardrobeItem?.(category, itemId);
      if (!result?.ok) return;

      showGameToast(result.test
        ? `🧪 ${itemName} testweise für ${price} Sterne gekauft!`
        : `⭐ ${itemName} für ${price} Sterne gekauft!`);
      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      if (result.test) renderDevShopTestControl();
      else renderMainMenuStats();
      renderWardrobeUnlockPanel();
    });

    slot.append(optionButton, normalRequirement);
    if (!DEV_MODE && getPendingWardrobeUnlockChoiceCount() > 0) {
      slot.appendChild(freeUnlockButton);
    }
    slot.appendChild(buyButton);
    return slot;
  }

  function getWardrobeOptionDevState(category, itemId, unlocked, unlockMode) {
    const shopTestActive = isDevShopTestActive() && !unlockMode;
    const testUnlocked = shopTestActive &&
      !unlocked &&
      Boolean(window.SlimeDevShopTest?.isItemUnlocked?.(category, itemId));
    return {
      shopTestActive,
      available: unlocked || testUnlocked,
      devPreviewAvailable: DEV_MODE && !shopTestActive && !unlockMode && !unlocked
    };
  }

  function createSlimeColorOption(color, unlockMode = false) {
    const unlocked = isSlimeColorUnlocked(color);
    const {shopTestActive, available, devPreviewAvailable} =
      getWardrobeOptionDevState("color", color, unlocked, unlockMode);
    const canUnlock =
      !DEV_MODE &&
      unlockMode &&
      getPendingWardrobeUnlockChoiceCount() > 0 &&
      wardrobeUnlockCategory === "color" &&
      !unlocked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption";
    button.dataset.color = color;
    applySlimePaletteCss(button, color);
    button.classList.toggle("selected", color === getActiveSlimeColor());
    button.classList.toggle("locked", !available && !devPreviewAvailable);
    button.classList.toggle("unlockable", canUnlock);
    button.disabled = unlockMode ? !canUnlock : !available && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      shopTestActive && available
        ? `${SLIME_COLOR_NAMES[color]} temporär im Shop Test ansehen`
        : unlocked
        ? `${SLIME_COLOR_NAMES[color]} auswählen`
        : devPreviewAvailable
          ? `${SLIME_COLOR_NAMES[color]} temporär im Dev Mode ansehen`
          : unlockMode
            ? `${SLIME_COLOR_NAMES[color]} als Wardrobe-Item freischalten`
            : `${SLIME_COLOR_NAMES[color]} ist gesperrt`
    );

    button.appendChild(createSlimeColorPreview(color));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = SLIME_COLOR_NAMES[color];
    button.appendChild(label);

    if (!available) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable
        ? "DEV"
        : unlockMode
          ? "+"
          : "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (shopTestActive && available) {
        devPreviewSlimeColor = normalizeSlimeColor(color);
      } else if (isSlimeColorUnlocked(color)) {
        devPreviewSlimeColor = null;
        selectSlimeColor(color);
      } else if (devPreviewAvailable) {
        devPreviewSlimeColor = normalizeSlimeColor(color);
      } else {
        if (!canUnlock) return;
        if (!redeemPendingWardrobeUnlockChoice("color", color)) return;
        wardrobeUnlockCategory = null;
        showGameToast(`🎨 ${SLIME_COLOR_NAMES[color]} freigeschaltet!`);
      }

      if (!shopTestActive) window.SlimeAchievements?.checkWardrobe?.();
      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    return !available && !devPreviewAvailable && !unlockMode
      ? createWardrobePurchaseSlot(
          "color",
          color,
          SLIME_COLOR_NAMES[color],
          button
        )
      : button;
  }

  function renderWardrobeProgress() {
    const requiredStars = getNextWardrobeUnlockRequirement();
    const pendingChoices = getPendingWardrobeUnlockChoiceCount();
    if (ui.slimeColorRequirement) {
      const pendingText = pendingChoices > 0
        ? `${pendingChoices} freie Wardrobe-Auswahl${pendingChoices === 1 ? "" : "en"} verfügbar`
        : "";
      ui.slimeColorRequirement.textContent = requiredStars === null
        ? pendingText || "Wardrobe komplett!"
        : pendingText
          ? `${pendingText} · Nächster Unlock bei ${requiredStars} ⭐ in einem Run`
          : `Nächster Unlock bei ${requiredStars} ⭐ in einem Run`;
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
    const {shopTestActive, available, devPreviewAvailable} =
      getWardrobeOptionDevState("cosmetic", cosmetic, unlocked, unlockMode);
    const canUnlock =
      !DEV_MODE &&
      unlockMode &&
      getPendingWardrobeUnlockChoiceCount() > 0 &&
      wardrobeUnlockCategory === "cosmetic" &&
      !unlocked;
    const definition = getSlimeCosmeticDefinition(cosmetic);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption slimeCosmeticOption";
    button.dataset.cosmetic = cosmetic;
    button.classList.toggle("selected", cosmetic === getActiveSlimeCosmetic());
    button.classList.toggle("locked", !available && !devPreviewAvailable);
    button.classList.toggle("unlockable", canUnlock);
    button.disabled = unlockMode ? !canUnlock : !available && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      shopTestActive && available
        ? `${definition.name} temporär im Shop Test ansehen`
        : unlocked
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

    if (!available) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable ? "DEV" : "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (shopTestActive && available) {
        devPreviewSlimeCosmetic = normalizeSlimeCosmetic(cosmetic);
      } else if (isSlimeCosmeticUnlocked(cosmetic)) {
        devPreviewSlimeCosmetic = null;
        selectSlimeCosmetic(cosmetic);
      } else if (devPreviewAvailable) {
        devPreviewSlimeCosmetic = normalizeSlimeCosmetic(cosmetic);
      } else {
        if (!canUnlock) return;
        if (!redeemPendingWardrobeUnlockChoice("cosmetic", cosmetic)) return;
        wardrobeUnlockCategory = null;
        showGameToast(`🎩 ${definition.name} freigeschaltet!`);
      }

      if (!shopTestActive) window.SlimeAchievements?.checkWardrobe?.();
      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    return !available && !devPreviewAvailable && !unlockMode
      ? createWardrobePurchaseSlot("cosmetic", cosmetic, definition.name, button)
      : button;
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
    const {shopTestActive, available, devPreviewAvailable} =
      getWardrobeOptionDevState("beard", beard, unlocked, unlockMode);
    const canUnlock =
      !DEV_MODE &&
      unlockMode &&
      getPendingWardrobeUnlockChoiceCount() > 0 &&
      wardrobeUnlockCategory === "beard" &&
      !unlocked;
    const definition = getSlimeBeardDefinition(beard);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption slimeBeardOption";
    button.dataset.beard = beard;
    button.classList.toggle("selected", beard === getActiveSlimeBeard());
    button.classList.toggle("locked", !available && !devPreviewAvailable);
    button.classList.toggle("unlockable", canUnlock);
    button.disabled = unlockMode ? !canUnlock : !available && !devPreviewAvailable;
    button.setAttribute(
      "aria-label",
      shopTestActive && available
        ? `${definition.name} temporär im Shop Test ansehen`
        : unlocked
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

    if (!available) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock";
      lock.textContent = devPreviewAvailable ? "DEV" : "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (shopTestActive && available) {
        devPreviewSlimeBeard = normalizeSlimeBeard(beard);
      } else if (isSlimeBeardUnlocked(beard)) {
        devPreviewSlimeBeard = null;
        selectSlimeBeard(beard);
      } else if (devPreviewAvailable) {
        devPreviewSlimeBeard = normalizeSlimeBeard(beard);
      } else {
        if (!canUnlock) return;
        if (!redeemPendingWardrobeUnlockChoice("beard", beard)) return;
        wardrobeUnlockCategory = null;
        showGameToast(`🧔 ${definition.name} freigeschaltet!`);
      }

      if (!shopTestActive) window.SlimeAchievements?.checkWardrobe?.();
      renderSlimeColorPicker();
      renderSlimeCosmeticPicker();
      renderSlimeBeardPicker();
      renderMenuMascot();
      renderWardrobeUnlockPanel();
    });

    return !available && !devPreviewAvailable && !unlockMode
      ? createWardrobePurchaseSlot("beard", beard, definition.name, button)
      : button;
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
    ui.wardrobeColorBackBtn.classList.toggle("hidden", viewName !== "color");
    ui.wardrobeCosmeticsBackBtn.classList.toggle("hidden", viewName !== "cosmetics");
    ui.wardrobeBeardsBackBtn.classList.toggle("hidden", viewName !== "beards");
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
      if (
        button.disabled ||
        DEV_MODE ||
        getPendingWardrobeUnlockChoiceCount() <= 0
      ) {
        return;
      }
      wardrobeUnlockCategory = category;
      renderWardrobeUnlockPanel();
    });
    return button;
  }

  function renderWardrobeUnlockPanel() {
    if (!ui.wardrobeUnlockPanel || !ui.wardrobeUnlockOptions) return;
    if (DEV_MODE || getPendingWardrobeUnlockChoiceCount() <= 0) {
      hideWardrobeUnlockPanel();
      return;
    }

    const lockedColors = getLockedSlimeColors();
    const lockedCosmetics = getLockedSlimeCosmetics();
    const lockedBeards = getLockedSlimeBeards();
    if (lockedColors.length + lockedCosmetics.length + lockedBeards.length === 0) {
      hideWardrobeUnlockPanel();
      return;
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
      const pendingChoices = getPendingWardrobeUnlockChoiceCount();
      ui.wardrobeUnlockText.textContent =
        `${pendingChoices} freie Auswahl${pendingChoices === 1 ? "" : "en"}: ` +
        "Was möchtest du freischalten?";
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
    if (DEV_MODE || getPendingWardrobeUnlockChoiceCount() <= 0) return true;
    renderWardrobeUnlockPanel();
    showGameToast("🎁 Wähle zuerst deine freien Wardrobe-Items.");
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

  function normalizeHighScoreAchievementIds(value) {
    if (!Array.isArray(value)) return [];

    const registry = window.SlimeAchievements?.registry;
    if (!Array.isArray(registry)) return [];
    const knownIds = new Set(registry.map(achievement => achievement?.id).filter(Boolean));
    const normalized = [];

    value.forEach(id => {
      if (typeof id !== "string") return;
      const cleanId = id.trim();
      if (!cleanId || !knownIds.has(cleanId) || normalized.includes(cleanId)) return;
      normalized.push(cleanId);
    });

    return normalized;
  }

  function getHighScoreAchievementSnapshot() {
    const selectedCallingCardIds = window.SlimeAchievements?.getSelectedBadgeIds?.();
    return normalizeHighScoreAchievementIds(
      Array.isArray(selectedCallingCardIds) ? selectedCallingCardIds : []
    );
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
        slimeBeard: normalizeSlimeBeard(entry?.slimeBeard ?? entry?.slime_beard),
        slimeAchievements: normalizeHighScoreAchievementIds(
          entry?.slimeAchievements ?? entry?.slime_achievements
        )
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

  function saveHighScore(name, finalScore, reachedLevel, slimeAchievements) {
    const highScores = loadHighScores();
    highScores.push({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard,
      slimeAchievements: normalizeHighScoreAchievementIds(slimeAchievements)
    });

    highScores.sort((a, b) => b.score - a.score || b.level - a.level);

    try {
      localStorage.setItem(highScoresStorageKey, JSON.stringify(highScores.slice(0, 10)));
    } catch (_) {}
  }

  function qualifiesForOnlineTopTen(finalScore, onlineScores) {
    const validOnlineScores = (Array.isArray(onlineScores) ? onlineScores : [])
      .map(entry => Number(entry?.score))
      .filter(scoreValue => Number.isFinite(scoreValue) && scoreValue >= 0);

    if (validOnlineScores.length < 10) return true;
    const lowestTopTenScore = Math.min(...validOnlineScores.slice(0, 10));
    return Math.max(0, Math.floor(Number(finalScore) || 0)) > lowestTopTenScore;
  }

  function submitOnlineHighScore(name, finalScore, reachedLevel, slimeAchievements) {
    const online = window.SlimeJumpHighscores;
    if (!online?.isConfigured?.()) {
      console.info("[Highscore] COMMIT SKIPPED reason=online-not-configured");
      lastOnlineScoreSubmit = Promise.resolve(null);
      return lastOnlineScoreSubmit;
    }

    const submittedScore = {
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard,
      slimeAchievements: normalizeHighScoreAchievementIds(slimeAchievements)
    };

    lastOnlineScoreSubmit = (async () => {
      const onlineScores = await online.getTopScores(10);
      const validEntryCount = (Array.isArray(onlineScores) ? onlineScores : [])
        .filter(entry => Number.isFinite(Number(entry?.score)) && Number(entry.score) >= 0)
        .length;
      const qualifies = qualifiesForOnlineTopTen(submittedScore.score, onlineScores);

      console.info(`[Highscore] ONLINE ENTRIES=${validEntryCount}`);
      console.info(`[Highscore] QUALIFIES=${qualifies}`);
      if (!qualifies) {
        console.info("[Highscore] COMMIT SKIPPED reason=not-qualified");
        return null;
      }

      console.info(`[Highscore] NAME CONFIRMED=${submittedScore.name}`);
      await online.submitScore(submittedScore);
      return submittedScore;
    })()
      .catch(error => {
        console.error("[Highscore] Online submit failed:", error);
        throw error;
      });
    return lastOnlineScoreSubmit;
  }

  function saveRecentScore(
    name,
    finalScore,
    reachedLevel,
    slimeAchievements = getHighScoreAchievementSnapshot()
  ) {
    const recentScores = sanitizeScoreEntries(loadRecentScores());
    recentScores.unshift({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard,
      slimeAchievements: slimeAchievements.slice()
    });

    try {
      localStorage.setItem(
        recentScoresStorageKey,
        JSON.stringify(recentScores.slice(0, 3))
      );
    } catch (_) {}

    saveHighScore(name, finalScore, reachedLevel, slimeAchievements);
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

  async function commitPendingHighScore() {
    const pendingScore = pendingGameOverScore;
    if (!pendingScore) {
      console.info("[Highscore] COMMIT SKIPPED reason=no-pending-run");
      return true;
    }
    if (pendingScore.commitPromise) {
      console.info("[Highscore] COMMIT SKIPPED reason=commit-in-progress");
      return false;
    }

    console.info("[Highscore] COMMIT START");

    const nickname = normalizeNickname(ui.nicknameInput.value, "");
    if (nickname.length !== 3) {
      console.info("[Highscore] COMMIT SKIPPED reason=invalid-name");
      ui.nicknameEntry.classList.remove("invalid");
      void ui.nicknameEntry.offsetWidth;
      ui.nicknameEntry.classList.add("invalid");
      ui.nicknameHint.textContent = "Bitte genau 3 Buchstaben eingeben.";
      ui.nicknameInput.focus();
      return false;
    }

    const slimeAchievements = getHighScoreAchievementSnapshot();

    pendingScore.commitPromise = (async () => {
      try {
        await submitOnlineHighScore(
          nickname,
          pendingScore.score,
          pendingScore.reachedLevel,
          slimeAchievements
        );
      } catch (error) {
        console.info("[Highscore] COMMIT SKIPPED reason=online-error");
        ui.nicknameEntry.classList.remove("invalid");
        ui.nicknameHint.textContent = "Speichern nicht möglich.";
      }

      try {
        saveRecentScore(
          nickname,
          pendingScore.score,
          pendingScore.reachedLevel,
          slimeAchievements
        );
        try { localStorage.setItem("slimejumperLastNickname", nickname); } catch (_) {}
      } catch (error) {
        console.error("[Highscore] Local score save failed:", error);
      }

      if (pendingGameOverScore === pendingScore) pendingGameOverScore = null;
      hideNicknameEntry();
      void updateHighScores();
      return true;
    })();

    return pendingScore.commitPromise;
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

      const badges = document.createElement("span");
      badges.className = "highscoreBadges";
      badges.setAttribute("aria-hidden", "true");
      if (entry) {
        const registry = window.SlimeAchievements?.registry;
        const achievementById = new Map(
          (Array.isArray(registry) ? registry : []).map(achievement => [
            achievement.id,
            achievement
          ])
        );

        normalizeHighScoreAchievementIds(entry.slimeAchievements).forEach(id => {
          const achievement = achievementById.get(id);
          if (!achievement?.icon) return;
          const icon = document.createElement("span");
          icon.className = "highscoreBadgeIcon";
          icon.textContent = achievement.icon;
          badges.appendChild(icon);
        });
      }

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

      row.append(rank, badges, name, points, level);
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
      const submittedScore = await lastOnlineScoreSubmit;
      const highScores = await online.getTopScores(10);
      const visibleHighScores = highScores.length === 0 && submittedScore
        ? sanitizeScoreEntries([submittedScore])
        : highScores;
      renderHighScoreRows(visibleHighScores);
    } catch (error) {
      console.error("[Highscore] Leaderboard refresh failed:", error);
      renderHighScoreRows(
        loadHighScores(),
        "Online-Highscores sind gerade nicht erreichbar."
      );
    }
  }

  function showMenuScreen(screenName = "main") {
    ui.mainMenuScreen.classList.toggle("hidden", screenName !== "main");
    ui.wardrobeScreen.classList.toggle("hidden", screenName !== "wardrobe");
    ui.achievementScreen.classList.toggle("hidden", screenName !== "achievements");
    ui.howToScreen.classList.toggle("hidden", screenName !== "howto");
    ui.highscoreScreen.classList.toggle("hidden", screenName !== "highscores");
    if (screenName === "main") {
      renderMenuMascot();
      renderMainMenuStats();
      window.SlimeAchievements?.renderRecent?.();
    }
    if (screenName === "wardrobe") {
      showWardrobeView("home");
    }
    if (screenName === "achievements") {
      window.SlimeAchievements?.renderMenu?.();
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

  if (DEV_MODE && ui.devShopTestBtn) {
    ui.devShopTestBtn.addEventListener("click", toggleDevShopTest);
    renderDevShopTestControl();
  }

