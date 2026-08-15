"use strict";

  const recentScoresStorageKey = "slimejumperRecentScores";
  const highScoresStorageKey = "slimejumperHighscoresV14";
  let lastOnlineScoreSubmit = Promise.resolve(null);
  let gameToastTimer = null;
  let devPreviewSlimeColor = null;
  let devPreviewSlimeCosmetic = null;
  let devPreviewSlimeBeard = null;
  let prestigeWardrobeChoiceCategory = null;
  let prestigeWardrobeChoiceCandidate = null;
  let prestigeWardrobeCategory = "frame";
  const PERK_POST_PURCHASE_GUARD_MS = 450;
  let perkPurchaseGuardUntil = 0;

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

  function createLeaderboardSlimePreview(
    color,
    cosmetic,
    beard = "none",
    prestigeAura = "none",
    prestigeTrail = "none"
  ) {
    const preview = document.createElement("canvas");
    preview.className = "slimeLeaderboardPreview";
    preview.width = 116;
    preview.height = 100;
    preview.setAttribute("aria-hidden", "true");
    drawSlimeCharacterPreview(
      preview,
      normalizeSlimeCosmetic(cosmetic),
      normalizeSlimeBeard(beard),
      normalizeSlimeColor(color),
      {
        centerX: 68,
        centerY: 54,
        scale: 0.8,
        prestigeAura,
        prestigeTrail
      }
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
    const pendingPermanentChoice = prestige.getPendingPermanentWardrobeChoice?.();

    ui.menuPrestigeBtn.classList.remove("hidden");
    ui.menuPrestigeBtn.classList.toggle(
      "prestigeInvisible",
      !hasEmblem && !isReady && !pendingPermanentChoice
    );
    ui.menuPrestigeBtn.classList.toggle(
      "prestigeReady",
      (isReady && !isMastered) || Boolean(pendingPermanentChoice)
    );
    ui.menuPrestigeBtn.classList.toggle("prestigeMastered", isMastered);
    ui.menuPrestigeBtn.classList.toggle(
      "prestigeZeroReady",
      (!hasEmblem && isReady) || Boolean(pendingPermanentChoice)
    );
    ui.menuPrestigeBtn.disabled = transactionPending || (
      !pendingPermanentChoice && !hasEmblem && !isReady
    );

    if (ui.menuPrestigeEmblem) {
      ui.menuPrestigeEmblem.innerHTML = hasEmblem
        ? prestige.getEmblemMarkup(prestigeLevel)
        : "";
    }

    const displayDefinition = prestige.getDisplayDefinition(prestigeLevel);
    const label = transactionPending
      ? "RESET AUSSTEHEND"
      : pendingPermanentChoice
        ? "PERMANENT UNLOCK WÄHLEN"
      : isMastered
        ? "PRESTIGE MASTERED"
        : isReady
          ? "PRESTIGE READY"
          : displayDefinition?.displayLabel ?? `P${prestigeLevel}`;
    if (ui.menuPrestigeLabel) ui.menuPrestigeLabel.textContent = label;
    ui.menuPrestigeBtn.setAttribute(
      "aria-label",
      pendingPermanentChoice
        ? `P${pendingPermanentChoice.prestigeLevel} Permanent Unlock wählen`
        : isMastered
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

  function populatePrestigeRewardSelect(select, type) {
    if (!select) return;
    const prestige = window.SlimePrestige;
    const selectedId = prestige?.getSelectedReward?.(type) ?? "none";
    const rewards = prestige?.getUnlockedRewardsByType?.(type) ?? [];
    const options = [{id: "none", displayName: "NONE"}, ...rewards];
    select.replaceChildren(...options.map(reward => {
      const option = document.createElement("option");
      option.value = reward.id;
      option.textContent = reward.displayName;
      option.selected = reward.id === selectedId;
      return option;
    }));
    select.disabled = rewards.length === 0;
  }

  function createPrestigeRewardPreview(type, reward) {
    const preview = document.createElement("span");
    preview.className = `prestigeRewardPreview prestigeRewardPreview--${type}`;
    preview.dataset.rewardId = reward.id;
    preview.setAttribute("aria-hidden", "true");

    if (reward.id === "none") {
      preview.classList.add("prestigeRewardPreview--none");
      preview.textContent = "NONE";
    } else if (type === "frame") {
      preview.dataset.prestigeFrame = reward.id;
      for (let index = 0; index < 5; index++) {
        const badge = document.createElement("i");
        badge.textContent = "•";
        preview.appendChild(badge);
      }
    } else if (type === "title") {
      preview.textContent = reward.displayName;
    } else if (type === "aura") {
      preview.appendChild(document.createElement("i"));
    } else if (type === "trail") {
      for (let index = 0; index < 5; index++) {
        preview.appendChild(document.createElement("i"));
      }
    }
    return preview;
  }

  function createPrestigeWardrobeOption(type, reward, selectedId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prestigeWardrobeOption";
    button.dataset.rewardId = reward.id;
    button.classList.toggle("selected", reward.id === selectedId);
    button.setAttribute("aria-pressed", String(reward.id === selectedId));
    button.setAttribute("aria-label", `${reward.displayName} auswählen`);
    button.appendChild(createPrestigeRewardPreview(type, reward));
    const label = document.createElement("span");
    label.textContent = reward.displayName;
    button.appendChild(label);
    button.addEventListener("click", () => {
      selectPrestigeReward(type, reward.id);
    });
    return button;
  }

  function renderWardrobePrestigePicker() {
    const prestige = window.SlimePrestige;
    if (!prestige || !ui.wardrobePrestigeOptions) return;
    const prestigeLevel = prestige.getLevel();
    const definition = prestige.getDisplayDefinition(prestigeLevel);
    if (ui.wardrobePrestigeEmblem) {
      ui.wardrobePrestigeEmblem.innerHTML = prestigeLevel > 0
        ? prestige.getEmblemMarkup(prestigeLevel)
        : "";
    }
    if (ui.wardrobePrestigeLevel) {
      ui.wardrobePrestigeLevel.textContent = definition?.displayLabel ?? "P0";
    }
    ui.wardrobePrestigeCategories?.querySelectorAll("[data-prestige-category]")
      .forEach(button => {
        const active = button.dataset.prestigeCategory === prestigeWardrobeCategory;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });

    const selectedId = prestige.getSelectedReward(prestigeWardrobeCategory);
    const rewards = prestige.getUnlockedRewardsByType(prestigeWardrobeCategory);
    const options = [{id: "none", displayName: "NONE"}, ...rewards];
    ui.wardrobePrestigeOptions.replaceChildren(
      ...options.map(reward => createPrestigeWardrobeOption(
        prestigeWardrobeCategory,
        reward,
        selectedId
      ))
    );
  }

  function renderPrestigeCustomization() {
    const prestige = window.SlimePrestige;
    if (!prestige) return;
    const prestigeLevel = prestige.getLevel();
    const displayDefinition = prestige.getDisplayDefinition(prestigeLevel);
    if (ui.prestigeCustomizationEmblem) {
      ui.prestigeCustomizationEmblem.innerHTML = prestige.getEmblemMarkup(prestigeLevel);
    }
    if (ui.prestigeCustomizationLevel) {
      ui.prestigeCustomizationLevel.textContent =
        `${displayDefinition?.displayLabel ?? `P${prestigeLevel}`} · AKTUELLES PRESTIGE`;
    }
    if (ui.prestigePermanentUnlockCount) {
      ui.prestigePermanentUnlockCount.textContent =
        `${prestige.getPermanentWardrobeUnlocks().length} / ${prestige.maxAvailablePrestige} Permanent Unlocks`;
    }
    populatePrestigeRewardSelect(ui.prestigeFrameSelect, "frame");
    populatePrestigeRewardSelect(ui.prestigeTitleSelect, "title");
    populatePrestigeRewardSelect(ui.prestigeAuraSelect, "aura");
    populatePrestigeRewardSelect(ui.prestigeTrailSelect, "trail");
    ui.prestigeCustomizationActivateBtn?.classList.toggle(
      "hidden",
      !prestige.isReady() || prestige.isMastered()
    );
  }

  function showPrestigeCustomization() {
    if (!ui.prestigeCustomizationOverlay || window.SlimePrestige?.getLevel?.() < 1) {
      return false;
    }
    renderPrestigeCustomization();
    ui.prestigeCustomizationOverlay.classList.remove("hidden");
    window.requestAnimationFrame(() => ui.prestigeCustomizationCloseBtn?.focus());
    return true;
  }

  function hidePrestigeCustomization() {
    ui.prestigeCustomizationOverlay?.classList.add("hidden");
    ui.menuPrestigeBtn?.focus();
  }

  function createPermanentWardrobeChoicePreview(item) {
    if (item.category === "color") return createSlimeColorPreview(item.id);
    if (item.category === "cosmetic") return createSlimeCosmeticPreview(item.id);
    return createSlimeBeardPreview(item.id);
  }

  function renderPrestigeWardrobeChoice() {
    const prestige = window.SlimePrestige;
    const pendingChoice = prestige?.getPendingPermanentWardrobeChoice?.();
    if (!pendingChoice || !ui.prestigeWardrobeChoiceCategories) return false;

    ui.prestigeWardrobeChoiceText.textContent =
      `P${pendingChoice.prestigeLevel}: Wähle genau ein normales Wardrobe-Item, das alle künftigen Prestige-Resets übersteht.`;
    const categories = [
      {id: "color", label: "🎨 FARBE"},
      {id: "cosmetic", label: "🎩 COSMETIC"},
      {id: "beard", label: "🧔 BART"}
    ];
    ui.prestigeWardrobeChoiceCategories.replaceChildren(...categories.map(category => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "uiButton uiButton--secondary";
      button.textContent = category.label;
      button.disabled = prestige.getPermanentWardrobeCandidates(category.id).length === 0;
      button.addEventListener("click", () => {
        prestigeWardrobeChoiceCategory = category.id;
        prestigeWardrobeChoiceCandidate = null;
        renderPrestigeWardrobeChoice();
      });
      return button;
    }));

    const candidates = prestigeWardrobeChoiceCategory
      ? prestige.getPermanentWardrobeCandidates(prestigeWardrobeChoiceCategory)
      : [];
    ui.prestigeWardrobeChoiceOptions.replaceChildren(...candidates.map(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slimeColorOption prestigeWardrobeChoiceOption";
      button.appendChild(createPermanentWardrobeChoicePreview(item));
      const label = document.createElement("span");
      label.className = "slimeColorLabel";
      label.textContent = item.displayName;
      button.appendChild(label);
      button.addEventListener("click", () => {
        prestigeWardrobeChoiceCandidate = {...item};
        renderPrestigeWardrobeChoice();
      });
      return button;
    }));

    const hasCategory = Boolean(prestigeWardrobeChoiceCategory);
    const hasCandidate = Boolean(prestigeWardrobeChoiceCandidate);
    ui.prestigeWardrobeChoiceCategories.classList.toggle("hidden", hasCategory);
    ui.prestigeWardrobeChoiceOptions.classList.toggle("hidden", !hasCategory || hasCandidate);
    ui.prestigeWardrobeChoiceConfirmation.classList.toggle("hidden", !hasCandidate);
    ui.prestigeWardrobeChoiceBackBtn.classList.toggle("hidden", !hasCategory);
    if (hasCandidate) {
      ui.prestigeWardrobeChoiceConfirmationName.textContent =
        prestigeWardrobeChoiceCandidate.displayName;
    }
    return true;
  }

  function showPrestigeWardrobeChoice() {
    if (!renderPrestigeWardrobeChoice()) return false;
    ui.prestigeWardrobeChoiceOverlay.classList.remove("hidden");
    window.requestAnimationFrame(() => ui.prestigeWardrobeChoiceCloseBtn?.focus());
    return true;
  }

  function hidePrestigeWardrobeChoice() {
    ui.prestigeWardrobeChoiceOverlay?.classList.add("hidden");
    prestigeWardrobeChoiceCategory = null;
    prestigeWardrobeChoiceCandidate = null;
    ui.menuPrestigeBtn?.focus();
  }

  function confirmPrestigeWardrobeChoice() {
    const choice = prestigeWardrobeChoiceCandidate;
    if (!choice) return false;
    if (!window.SlimePrestige?.choosePermanentWardrobeUnlock?.(choice.category, choice.id)) {
      showGameToast("Permanent Unlock konnte nicht sicher gespeichert werden.");
      return false;
    }
    hidePrestigeWardrobeChoice();
    showGameToast(`✨ ${choice.displayName} ist jetzt permanent!`);
    renderMainMenuStats();
    renderSlimeColorPicker();
    renderSlimeCosmeticPicker();
    renderSlimeBeardPicker();
    renderMenuMascot();
    window.SlimeAchievements?.checkWardrobe?.();
    window.SlimeAchievements?.renderMenu?.();
    window.SlimeAchievements?.renderRecent?.();
    if (typeof renderDevPrestigeRewardInspector === "function") {
      renderDevPrestigeRewardInspector();
    }
    return true;
  }

  function selectPrestigeReward(type, id) {
    if (!window.SlimePrestige?.selectReward?.(type, id)) return false;
    renderPrestigeCustomization();
    window.SlimeAchievements?.renderMenu?.();
    window.SlimeAchievements?.renderRecent?.();
    renderWardrobePrestigePicker();
    if (typeof renderDevPrestigeRewardInspector === "function") {
      renderDevPrestigeRewardInspector();
    }
    return true;
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
    ui.wardrobePrestigeView.classList.toggle("hidden", viewName !== "prestige");
    ui.wardrobeColorBackBtn.classList.toggle("hidden", viewName !== "color");
    ui.wardrobeCosmeticsBackBtn.classList.toggle("hidden", viewName !== "cosmetics");
    ui.wardrobeBeardsBackBtn.classList.toggle("hidden", viewName !== "beards");
    ui.wardrobePrestigeBackBtn.classList.toggle("hidden", viewName !== "prestige");
    renderWardrobeProgress();
    if (viewName === "color") renderSlimeColorPicker();
    if (viewName === "cosmetics") renderSlimeCosmeticPicker();
    if (viewName === "beards") renderSlimeBeardPicker();
    if (viewName === "prestige") renderWardrobePrestigePicker();
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
      if (
        !cleanId ||
        !knownIds.has(cleanId) ||
        normalized.includes(cleanId) ||
        normalized.length >= 5
      ) return;
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

  function normalizeHighScoreIdentitySnapshot(value) {
    const source = value && typeof value === "object" ? value : {};
    const nestedSnapshot = source.callingCardSnapshot ?? source.calling_card_snapshot;
    const identitySource = nestedSnapshot && typeof nestedSnapshot === "object"
      ? nestedSnapshot
      : source;
    const normalized = window.SlimePrestige?.normalizeIdentitySnapshot?.({
      playerLevel: identitySource.playerLevel ?? identitySource.player_level,
      prestigeLevel: identitySource.prestigeLevel ?? identitySource.prestige_level,
      prestigeFrame: identitySource.prestigeFrame ?? identitySource.prestige_frame,
      prestigeTitle: identitySource.prestigeTitle ?? identitySource.prestige_title,
      prestigeAura: identitySource.prestigeAura ?? identitySource.prestige_aura,
      prestigeTrail: identitySource.prestigeTrail ?? identitySource.prestige_trail,
      slimeAchievements:
        identitySource.slimeAchievements ??
        identitySource.slime_achievements ??
        source.slimeAchievements ??
        source.slime_achievements
    });
    return normalized ?? {
      playerLevel: 1,
      prestigeLevel: 0,
      prestigeEmblemId: "none",
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    };
  }

  function hasHighScoreIdentitySnapshot(value) {
    if (!value || typeof value !== "object") return false;
    if (typeof value.hasIdentitySnapshot === "boolean") {
      return value.hasIdentitySnapshot;
    }
    const nestedSnapshot = value.callingCardSnapshot ?? value.calling_card_snapshot;
    if (nestedSnapshot && typeof nestedSnapshot === "object") return true;
    return [
      "playerLevel", "player_level", "prestigeLevel", "prestige_level",
      "prestigeFrame", "prestige_frame", "prestigeTitle", "prestige_title",
      "prestigeAura", "prestige_aura", "prestigeTrail", "prestige_trail"
    ].some(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  function hasHighScoreSnapshotField(value, camelKey, snakeKey, explicitFlag) {
    if (!value || typeof value !== "object") return false;
    if (typeof value[explicitFlag] === "boolean") return value[explicitFlag];
    const nestedSnapshot = value.callingCardSnapshot ?? value.calling_card_snapshot;
    const source = nestedSnapshot && typeof nestedSnapshot === "object"
      ? nestedSnapshot
      : value;
    return Object.prototype.hasOwnProperty.call(source, camelKey) ||
      Object.prototype.hasOwnProperty.call(source, snakeKey);
  }

  function sanitizeScoreEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(entry => {
        const identity = normalizeHighScoreIdentitySnapshot(entry);
        return {
          name: normalizeNickname(entry?.name, "---"),
          score: Math.max(0, Math.floor(Number(entry?.score) || 0)),
          level: Math.max(1, Math.floor(Number(entry?.level) || 1)),
          slimeColor: normalizeSlimeColor(entry?.slimeColor ?? entry?.slime_color),
          slimeCosmetic: normalizeSlimeCosmetic(
            entry?.slimeCosmetic ?? entry?.slime_cosmetic
          ),
          slimeBeard: normalizeSlimeBeard(entry?.slimeBeard ?? entry?.slime_beard),
          slimeAchievements: normalizeHighScoreAchievementIds(identity.slimeAchievements),
          playerLevel: identity.playerLevel,
          prestigeLevel: identity.prestigeLevel,
          prestigeEmblemId: identity.prestigeEmblemId,
          prestigeFrame: identity.prestigeFrame,
          prestigeTitle: identity.prestigeTitle,
          prestigeAura: identity.prestigeAura,
          prestigeTrail: identity.prestigeTrail,
          hasPlayerLevelSnapshot: hasHighScoreSnapshotField(
            entry,
            "playerLevel",
            "player_level",
            "hasPlayerLevelSnapshot"
          ),
          hasPrestigeLevelSnapshot: hasHighScoreSnapshotField(
            entry,
            "prestigeLevel",
            "prestige_level",
            "hasPrestigeLevelSnapshot"
          ),
          hasIdentitySnapshot: hasHighScoreIdentitySnapshot(entry)
        };
      })
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

  function loadStoredHighScoreRecords() {
    try {
      const stored = JSON.parse(localStorage.getItem(highScoresStorageKey) || "[]");
      return Array.isArray(stored)
        ? stored.filter(entry => entry && typeof entry === "object" && !Array.isArray(entry))
        : [];
    } catch (_) {
      return [];
    }
  }

  function saveHighScore(name, finalScore, reachedLevel, identitySnapshot) {
    const storedHighScores = loadStoredHighScoreRecords();
    const highScores = storedHighScores.length > 0
      ? storedHighScores
      : loadRecentScores().filter(
          entry => entry && typeof entry === "object" && !Array.isArray(entry)
        );
    const identity = normalizeHighScoreIdentitySnapshot(identitySnapshot);
    highScores.push({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard,
      slimeAchievements: normalizeHighScoreAchievementIds(identity.slimeAchievements),
      playerLevel: identity.playerLevel,
      prestigeLevel: identity.prestigeLevel,
      prestigeEmblemId: identity.prestigeEmblemId,
      prestigeFrame: identity.prestigeFrame,
      prestigeTitle: identity.prestigeTitle,
      prestigeAura: identity.prestigeAura,
      prestigeTrail: identity.prestigeTrail,
      hasIdentitySnapshot: true
    });

    highScores.sort((a, b) =>
      (Math.max(0, Math.floor(Number(b?.score) || 0)) -
        Math.max(0, Math.floor(Number(a?.score) || 0))) ||
      (Math.max(1, Math.floor(Number(b?.level) || 1)) -
        Math.max(1, Math.floor(Number(a?.level) || 1)))
    );

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

  function submitOnlineHighScore(name, finalScore, reachedLevel, identitySnapshot) {
    const online = window.SlimeJumpHighscores;
    if (!online?.isConfigured?.()) {
      console.info("[Highscore] COMMIT SKIPPED reason=online-not-configured");
      lastOnlineScoreSubmit = Promise.resolve(null);
      return lastOnlineScoreSubmit;
    }

    const identity = normalizeHighScoreIdentitySnapshot(identitySnapshot);
    const submittedScore = {
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard,
      slimeAchievements: normalizeHighScoreAchievementIds(identity.slimeAchievements),
      playerLevel: identity.playerLevel,
      prestigeLevel: identity.prestigeLevel,
      prestigeEmblemId: identity.prestigeEmblemId,
      prestigeFrame: identity.prestigeFrame,
      prestigeTitle: identity.prestigeTitle,
      prestigeAura: identity.prestigeAura,
      prestigeTrail: identity.prestigeTrail,
      callingCardSnapshot: identity
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
    identitySnapshot = window.SlimePrestige?.capturePlayerIdentitySnapshot?.()
  ) {
    const recentScores = sanitizeScoreEntries(loadRecentScores());
    const identity = normalizeHighScoreIdentitySnapshot(identitySnapshot);
    recentScores.unshift({
      name: normalizeNickname(name),
      score: Math.max(0, Math.floor(finalScore)),
      level: Math.max(1, Math.floor(reachedLevel)),
      slimeColor: selectedSlimeColor,
      slimeCosmetic: selectedSlimeCosmetic,
      slimeBeard: selectedSlimeBeard,
      slimeAchievements: normalizeHighScoreAchievementIds(identity.slimeAchievements),
      playerLevel: identity.playerLevel,
      prestigeLevel: identity.prestigeLevel,
      prestigeEmblemId: identity.prestigeEmblemId,
      prestigeFrame: identity.prestigeFrame,
      prestigeTitle: identity.prestigeTitle,
      prestigeAura: identity.prestigeAura,
      prestigeTrail: identity.prestigeTrail,
      hasIdentitySnapshot: true
    });

    try {
      localStorage.setItem(
        recentScoresStorageKey,
        JSON.stringify(recentScores.slice(0, 3))
      );
    } catch (_) {}

    saveHighScore(name, finalScore, reachedLevel, identity);
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

    const identitySnapshot = normalizeHighScoreIdentitySnapshot(
      pendingScore.identitySnapshot ?? {
        ...window.SlimePrestige?.capturePlayerIdentitySnapshot?.(),
        slimeAchievements: getHighScoreAchievementSnapshot()
      }
    );

    pendingScore.commitPromise = (async () => {
      try {
        await submitOnlineHighScore(
          nickname,
          pendingScore.score,
          pendingScore.reachedLevel,
          identitySnapshot
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
          identitySnapshot
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

  let devCallingCardTestEntry = null;

  function createDevCallingCardTestEntry() {
    const badgeIds = [
      "century_slime",
      "biome_master",
      "achievement_hunter",
      "secret_star_sniper",
      "secret_second_chance"
    ];
    const registryIds = new Set(
      (window.SlimeAchievements?.registry ?? []).map(achievement => achievement.id)
    );
    if (!badgeIds.every(id => registryIds.has(id))) return null;

    const identity = normalizeHighScoreIdentitySnapshot({
      playerLevel: 100,
      prestigeLevel: 10,
      prestigeFrame: "prestige-frame-p10",
      prestigeTitle: "prestige-title-p10",
      prestigeAura: "prestige-aura-prism-p8",
      prestigeTrail: "prestige-trail-prism-p9",
      slimeAchievements: badgeIds
    });
    return Object.freeze({
      name: "DEV TEST",
      score: 999999,
      level: 100,
      slimeColor: "hot_pink",
      slimeCosmetic: "wizard_hat",
      slimeBeard: "braided_beard",
      slimeAchievements: identity.slimeAchievements,
      playerLevel: identity.playerLevel,
      prestigeLevel: identity.prestigeLevel,
      prestigeEmblemId: identity.prestigeEmblemId,
      prestigeFrame: identity.prestigeFrame,
      prestigeTitle: identity.prestigeTitle,
      prestigeAura: identity.prestigeAura,
      prestigeTrail: identity.prestigeTrail,
      hasPlayerLevelSnapshot: true,
      hasPrestigeLevelSnapshot: true,
      hasIdentitySnapshot: true,
      isDevCallingCardPreview: true
    });
  }

  function showDevCallingCardTest() {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE) return false;
    const entry = createDevCallingCardTestEntry();
    if (!entry) return false;
    devCallingCardTestEntry = entry;
    ui.menu.classList.remove("hidden");
    showMenuScreen("highscores");
    return true;
  }

  function createHighScoreCallingCard(entry) {
    const card = document.createElement("span");
    card.className = "highscoreCallingCard";

    const titleReward = window.SlimePrestige?.getRewardDefinition?.(
      "title",
      entry.prestigeTitle
    );
    const nickname = (
      typeof DEV_MODE !== "undefined" &&
      DEV_MODE &&
      entry.isDevCallingCardPreview === true
    )
      ? String(entry.name).trim().toUpperCase().slice(0, 16)
      : normalizeNickname(entry.name, "---");
    const snapshotIdentityParts = [];
    if (entry.hasPlayerLevelSnapshot) {
      snapshotIdentityParts.push(`Level ${entry.playerLevel}`);
    }
    if (entry.hasPrestigeLevelSnapshot) {
      snapshotIdentityParts.push(`Prestige P${entry.prestigeLevel}`);
    }
    const snapshotIdentity = snapshotIdentityParts.length > 0
      ? snapshotIdentityParts.join(", ")
      : "Legacy-Eintrag ohne Level- und Prestige-Snapshot";
    card.setAttribute(
      "aria-label",
      `${nickname}, ${Number(entry.score).toLocaleString("de-DE")} Punkte, ` +
      `${snapshotIdentity}, Run-Level ${entry.level}`
    );

    const identity = document.createElement("span");
    identity.className = "highscoreCallingCardIdentity";
    const portrait = createLeaderboardSlimePreview(
      entry.slimeColor,
      entry.slimeCosmetic,
      entry.slimeBeard,
      entry.prestigeAura,
      entry.prestigeTrail
    );
    const name = document.createElement("strong");
    name.textContent = nickname;
    identity.append(portrait, name);

    const playerLevelBlock = document.createElement("span");
    playerLevelBlock.className = "highscoreCallingCardPlayerLevel";
    if (entry.hasPlayerLevelSnapshot) {
      const playerLevelLabel = document.createElement("small");
      playerLevelLabel.textContent = "PLAYER";
      const playerLevel = document.createElement("strong");
      playerLevel.textContent = `LEVEL ${entry.playerLevel}`;
      playerLevelBlock.append(playerLevelLabel, playerLevel);
    } else {
      const playerLevelLabel = document.createElement("small");
      playerLevelLabel.textContent = "PLAYER LEVEL";
      const unavailablePlayerLevel = document.createElement("strong");
      unavailablePlayerLevel.textContent = "—";
      playerLevelBlock.append(playerLevelLabel, unavailablePlayerLevel);
    }

    const prestigeBlock = document.createElement("span");
    prestigeBlock.className = "highscoreCallingCardPrestigeBlock";
    if (entry.hasPrestigeLevelSnapshot) {
      if (entry.prestigeLevel > 0) {
        const emblem = document.createElement("span");
        emblem.className = "highscorePrestigeEmblem";
        emblem.dataset.prestigeEmblem = entry.prestigeEmblemId ?? "none";
        emblem.innerHTML = window.SlimePrestige?.getEmblemMarkup?.(
          entry.prestigeLevel
        ) ?? "";
        prestigeBlock.appendChild(emblem);
      }
      const prestige = document.createElement("strong");
      prestige.className = "highscoreCallingCardPrestige";
      prestige.textContent = `P${entry.prestigeLevel}`;
      prestigeBlock.appendChild(prestige);
    } else {
      prestigeBlock.setAttribute("aria-hidden", "true");
    }

    const callingCard = document.createElement("span");
    callingCard.className = "highscoreCallingCardCore";
    callingCard.dataset.prestigeFrame = entry.prestigeFrame ?? "none";

    const title = document.createElement("small");
    title.className = "highscoreCallingCardTitle";
    title.textContent = titleReward?.displayName ?? (
      entry.hasIdentitySnapshot ? "CALLING CARD" : "LEGACY"
    );
    callingCard.appendChild(title);

    const badges = document.createElement("span");
    badges.className = "highscoreCallingCardBadges";
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
      icon.title = achievement.name;
      icon.setAttribute("aria-label", achievement.name);
      badges.appendChild(icon);
    });
    callingCard.appendChild(badges);

    const runLevel = document.createElement("span");
    runLevel.className = "highscoreCallingCardRunLevel";
    const runLevelLabel = document.createElement("small");
    runLevelLabel.textContent = "RUN LEVEL";
    const runLevelValue = document.createElement("strong");
    runLevelValue.textContent = String(entry.level);
    runLevel.append(runLevelLabel, runLevelValue);

    const score = document.createElement("span");
    score.className = "highscoreCallingCardScore";
    const scoreLabel = document.createElement("small");
    scoreLabel.textContent = "PUNKTE";
    const scoreValue = document.createElement("strong");
    scoreValue.textContent = Number(entry.score).toLocaleString("de-DE");
    score.append(scoreLabel, scoreValue);

    card.append(
      identity,
      playerLevelBlock,
      prestigeBlock,
      callingCard,
      runLevel,
      score
    );
    return card;
  }

  function renderHighScoreRows(highScores, emptyText = "Noch keine Highscores – spiel deine erste Runde!") {
    ui.highscoreRows.replaceChildren();

    const hasDevCallingCardTest =
      typeof DEV_MODE !== "undefined" && DEV_MODE && devCallingCardTestEntry !== null;
    if (hasDevCallingCardTest) {
      ui.highscoreRows.dataset.devCallingCardTest = "true";
      const previewRow = document.createElement("div");
      previewRow.className = "highscoreRow highscoreDevCallingCardPreview";
      const previewLabel = document.createElement("span");
      previewLabel.className = "highscoreDevPreviewLabel";
      previewLabel.textContent = "DEV PREVIEW";
      previewRow.append(
        previewLabel,
        createHighScoreCallingCard(devCallingCardTestEntry)
      );
      ui.highscoreRows.appendChild(previewRow);
    } else {
      delete ui.highscoreRows.dataset.devCallingCardTest;
    }

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

      const card = entry
        ? createHighScoreCallingCard(entry)
        : document.createElement("span");
      if (!entry) {
        card.className = "highscoreCallingCard highscoreCallingCard--empty";
        card.textContent = "—";
      }

      row.append(rank, card);
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

  function createPerkIcon(iconDefinition) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", iconDefinition.viewBox);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("perkCardIconSvg");
    iconDefinition.paths.forEach(pathDefinition => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathDefinition.d);
      if (pathDefinition.accent) path.classList.add("perkIconAccent");
      svg.appendChild(path);
    });
    return svg;
  }

  function canChangePerkSelection() {
    return state === "menu" &&
      !ui.menu.classList.contains("hidden") &&
      !ui.perksScreen.classList.contains("hidden") &&
      window.SlimeRunRecovery?.hasStoredRecord?.() !== true;
  }

  function renderPerksScreen() {
    const perks = window.SlimePerks;
    if (!perks || !ui.perkGrid || !ui.activePerkCount) return;

    const unlocked = new Set(perks.getUnlockedPerkIds());
    const selected = new Set(perks.getSelectedPerkIds());
    ui.activePerkCount.textContent = `${selected.size} / ${perks.maxSelected}`;
    ui.perkGrid.replaceChildren();

    perks.definitions.forEach(perk => {
      const isUnlocked = unlocked.has(perk.id);
      const isSelected = selected.has(perk.id);
      const unlockCost = perks.balance.PERK_UNLOCK_COST;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "perkCard";
      card.dataset.perkId = perk.id;
      card.classList.toggle("locked", !isUnlocked);
      card.classList.toggle("active", isSelected);
      card.classList.toggle("comingSoon", !perk.implemented);
      card.classList.toggle("purchasable", perk.implemented && !isUnlocked);
      card.disabled = !perk.implemented;
      card.setAttribute("aria-pressed", String(isSelected));
      card.setAttribute(
        "aria-label",
        `${perk.name}: ${!perk.implemented ? "Coming Soon" : isSelected ? "Active" : isUnlocked ? "Unlocked" : `Unlock für ${unlockCost} Sterne`}`
      );

      const icon = document.createElement("span");
      icon.className = "perkCardIcon";
      icon.appendChild(createPerkIcon(perk.icon));

      const content = document.createElement("span");
      content.className = "perkCardContent";
      const name = document.createElement("strong");
      name.textContent = perk.name;
      const description = document.createElement("span");
      description.className = "perkCardDescription";
      description.textContent = perk.description;
      const statuses = document.createElement("span");
      statuses.className = "perkCardStatuses";

      const availability = document.createElement("span");
      availability.className = "perkStatus";
      availability.textContent = isUnlocked
        ? "UNLOCKED"
        : perk.implemented
          ? `UNLOCK · ${unlockCost} ★`
          : "LOCKED";
      statuses.appendChild(availability);
      if (isSelected) {
        const active = document.createElement("span");
        active.className = "perkStatus perkStatus--active";
        active.textContent = "ACTIVE";
        statuses.appendChild(active);
      }
      if (!perk.implemented) {
        const comingSoon = document.createElement("span");
        comingSoon.className = "perkStatus perkStatus--soon";
        comingSoon.textContent = "COMING SOON";
        statuses.appendChild(comingSoon);
      }

      content.append(name, description, statuses);
      card.append(icon, content);
      card.addEventListener("click", () => {
        if (!canChangePerkSelection()) return;
        if (performance.now() < perkPurchaseGuardUntil) return;
        if (!isUnlocked) {
          const purchase = perks.purchasePerk(perk.id);
          if (!purchase.ok) {
            if (purchase.reason === "insufficient-stars") {
              showGameToast(`Nicht genug Sterne · ${unlockCost} ★ benötigt.`);
            } else if (purchase.reason === "dev-mode") {
              showGameToast("Für einen echten Kauf DEV MODE ausschalten.");
            } else if (purchase.reason !== "purchase-in-progress") {
              showGameToast("Fähigkeit konnte nicht freigeschaltet werden.");
            }
            return;
          }

          perkPurchaseGuardUntil = performance.now() + PERK_POST_PURCHASE_GUARD_MS;
          showGameToast(`⭐ ${perk.name} für ${unlockCost} Sterne freigeschaltet!`);
          renderMainMenuStats();
          renderPerksScreen();
          window.dispatchEvent(new CustomEvent("slimeperkschange"));
          return;
        }
        const result = perks.toggleSelectedPerk(perk.id);
        if (!result.ok) {
          if (result.reason === "max-selected") {
            showGameToast(`Maximal ${perks.maxSelected} Fähigkeiten gleichzeitig aktiv.`);
          } else if (result.reason === "storage-error") {
            showGameToast("Fähigkeiten-Auswahl konnte nicht gespeichert werden.");
          }
          return;
        }
        renderPerksScreen();
        window.dispatchEvent(new CustomEvent("slimeperkschange"));
      });
      ui.perkGrid.appendChild(card);
    });
  }

  function showMenuScreen(screenName = "main") {
    ui.mainMenuScreen.classList.toggle("hidden", screenName !== "main");
    ui.wardrobeScreen.classList.toggle("hidden", screenName !== "wardrobe");
    ui.achievementScreen.classList.toggle("hidden", screenName !== "achievements");
    ui.perksScreen.classList.toggle("hidden", screenName !== "perks");
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
    if (screenName === "perks") renderPerksScreen();
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

  if (DEV_MODE) {
    document.getElementById("devCallingCardTestBtn")
      ?.addEventListener("click", showDevCallingCardTest);
  }

