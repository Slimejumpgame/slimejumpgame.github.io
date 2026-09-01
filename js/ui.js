"use strict";

  const recentScoresStorageKey = "slimejumperRecentScores";
  const highScoresStorageKey = "slimejumperHighscoresV14";
  let lastOnlineScoreSubmit = Promise.resolve(null);
  let globalBestBootstrapPromise = null;
  let personalGlobalRankRequestId = 0;
  let gameToastTimer = null;
  let devPreviewSlimeColor = null;
  let devPreviewSlimeCosmetic = null;
  let devPreviewSlimeBeard = null;
  let prestigeWardrobeChoiceCategory = null;
  let prestigeWardrobeChoiceCandidate = null;
  let prestigeWardrobeCategory = "frame";
  let goldWardrobeCategory = "hats";
  const GOLD_SHOP_INTRO_SKIP_STORAGE_KEY = "slimejumperSkipGoldShopIntro";
  const PERK_POST_PURCHASE_GUARD_MS = 450;
  const UPDATE_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.slimejumpgame.app";
  const ANDROID_UPDATE_ENDPOINT =
    "https://slimejumpgame.github.io/android-update.json";
  const ANDROID_UPDATE_TIMEOUT_MS = 2500;
  const ANDROID_UPDATE_RETRY_DELAYS_MS = Object.freeze([5000, 15000]);
  const ANDROID_UPDATE_CHECK_RESULT = Object.freeze({
    SUCCESS_NO_UPDATE: "SUCCESS_NO_UPDATE",
    UPDATE_AVAILABLE: "UPDATE_AVAILABLE",
    TECHNICAL_FAILURE: "TECHNICAL_FAILURE"
  });
  const MAX_ANDROID_UPDATE_NOTES = 12;
  const MAX_ANDROID_UPDATE_NOTE_LENGTH = 240;
  const PERK_CONFLICT_PURCHASE_INFO = Object.freeze({
    air_hop: Object.freeze({
      seenStorageKey: "slimejumperAirHopConflictPurchaseInfoSeen",
      title: "AIR HOP",
      text: "Air Hop kann nicht gleichzeitig mit Air Brake in einem Run verwendet werden. Wähle immer nur eine der beiden Fähigkeiten aus."
    }),
    air_brake: Object.freeze({
      seenStorageKey: "slimejumperAirBrakeConflictPurchaseInfoSeen",
      title: "AIR BRAKE",
      text: "Air Brake kann nicht gleichzeitig mit Air Hop in einem Run verwendet werden. Wähle immer nur eine der beiden Fähigkeiten aus."
    })
  });
  const MAX_ANDROID_VERSION_NAME_LENGTH = 64;
  const TEST_UPDATE_DATA = Object.freeze({
    installedVersion: "2.61",
    versionName: "2.62",
    notes: Object.freeze([
      "Bugfixes und Stabilitätsverbesserungen",
      "Verbessertes Slime-Verhalten",
      "Weitere Verbesserungen"
    ])
  });
  let perkPurchaseGuardUntil = 0;
  let updateScreenPreviousFocus = null;
  let androidUpdateCheckInFlight = null;
  let androidUpdateRetryTimeoutId = null;
  let androidUpdateRetryIndex = 0;
  let androidUpdateHadTechnicalFailure = false;
  let androidUpdateScreenShown = false;
  let androidUpdateOnlineListenerRegistered = false;
  let androidUpdateAppStateListenerRegistrationStarted = false;
  let perkConflictPurchaseInfoPreviousFocus = null;
  let goldShopIntroPreviousFocus = null;

  function hasSeenPerkConflictPurchaseInfo(storageKey) {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch (_) {
      return false;
    }
  }

  function markPerkConflictPurchaseInfoSeen(storageKey) {
    try {
      localStorage.setItem(storageKey, "true");
      return localStorage.getItem(storageKey) === "true";
    } catch (_) {
      return false;
    }
  }

  function showPerkConflictPurchaseInfo(perkId) {
    const info = PERK_CONFLICT_PURCHASE_INFO[perkId];
    if (
      !info ||
      !ui.perkConflictPurchaseInfoOverlay ||
      !ui.perkConflictPurchaseInfoTitle ||
      !ui.perkConflictPurchaseInfoText ||
      hasSeenPerkConflictPurchaseInfo(info.seenStorageKey)
    ) return false;

    ui.perkConflictPurchaseInfoTitle.textContent = info.title;
    ui.perkConflictPurchaseInfoText.textContent = info.text;
    perkConflictPurchaseInfoPreviousFocus = document.activeElement;
    markPerkConflictPurchaseInfoSeen(info.seenStorageKey);
    ui.perkConflictPurchaseInfoOverlay.classList.remove("hidden");
    ui.perkConflictPurchaseInfoOverlay.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() =>
      ui.perkConflictPurchaseInfoConfirmBtn?.focus()
    );
    return true;
  }

  function closePerkConflictPurchaseInfo() {
    if (!ui.perkConflictPurchaseInfoOverlay) return;
    ui.perkConflictPurchaseInfoOverlay.classList.add("hidden");
    ui.perkConflictPurchaseInfoOverlay.setAttribute("aria-hidden", "true");
    perkConflictPurchaseInfoPreviousFocus?.focus?.();
    perkConflictPurchaseInfoPreviousFocus = null;
  }

  function shouldSkipGoldShopIntro() {
    try {
      return localStorage.getItem(GOLD_SHOP_INTRO_SKIP_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function persistGoldShopIntroSkipPreference() {
    try {
      localStorage.setItem(GOLD_SHOP_INTRO_SKIP_STORAGE_KEY, "true");
      return localStorage.getItem(GOLD_SHOP_INTRO_SKIP_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function showGoldShopIntro() {
    if (
      !ui.goldShopIntroOverlay ||
      !ui.goldShopIntroSkipCheckbox ||
      !ui.goldShopIntroConfirmBtn
    ) return false;

    ui.goldShopIntroSkipCheckbox.checked = false;
    goldShopIntroPreviousFocus = document.activeElement;
    ui.goldShopIntroOverlay.classList.remove("hidden");
    ui.goldShopIntroOverlay.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => ui.goldShopIntroConfirmBtn.focus());
    return true;
  }

  function closeGoldShopIntro() {
    if (!ui.goldShopIntroOverlay) return;
    ui.goldShopIntroOverlay.classList.add("hidden");
    ui.goldShopIntroOverlay.setAttribute("aria-hidden", "true");
    ui.goldShopIntroSkipCheckbox.checked = false;
    goldShopIntroPreviousFocus?.focus?.();
    goldShopIntroPreviousFocus = null;
  }

  function requestGoldWardrobeOpen() {
    const shopUnlocked = window.SlimeGold?.isGoldShopUnlocked?.() === true;
    if (!shopUnlocked && !shouldSkipGoldShopIntro()) {
      return showGoldShopIntro();
    }
    showWardrobeView("gold");
    return true;
  }

  function confirmGoldShopIntro() {
    if (ui.goldShopIntroSkipCheckbox?.checked) {
      persistGoldShopIntroSkipPreference();
    }
    closeGoldShopIntro();
    showWardrobeView("gold");
    return true;
  }

  function showUpdateScreen(updateData) {
    if (
      !ui.updateOverlay ||
      !ui.updateInstalledVersion ||
      !ui.updateNewVersion ||
      !ui.updateNotesList
    ) {
      return false;
    }

    const notes = Array.isArray(updateData?.notes) ? updateData.notes : [];
    ui.updateInstalledVersion.textContent = String(updateData?.installedVersion ?? "-");
    ui.updateNewVersion.textContent = String(updateData?.versionName ?? "-");
    ui.updateNotesList.replaceChildren();
    notes.forEach(note => {
      const item = document.createElement("li");
      item.textContent = String(note);
      ui.updateNotesList.appendChild(item);
    });

    pauseMainMenuOnboardingForModal();
    updateScreenPreviousFocus = document.activeElement;
    ui.updateOverlay.classList.remove("hidden");
    ui.updateOverlay.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => ui.updateOpenStoreBtn?.focus());
    return true;
  }

  function closeUpdateScreen() {
    if (!ui.updateOverlay) return;
    ui.updateOverlay.classList.add("hidden");
    ui.updateOverlay.setAttribute("aria-hidden", "true");
    updateScreenPreviousFocus?.focus?.();
    updateScreenPreviousFocus = null;
    if (!resumeMainMenuOnboardingAfterModal()) {
      maybeStartMainMenuOnboarding();
    }
  }

  const MAIN_MENU_ONBOARDING_VERSION = "main-menu-onboarding-v1";
  const MAIN_MENU_ONBOARDING_STORAGE_KEY =
    "slimejumperMainMenuOnboardingSeenVersion";
  const MAIN_MENU_ONBOARDING_STEPS = Object.freeze([
    Object.freeze({
      id: "best",
      title: "BESTWERT",
      targetId: "menuPersonalBest",
      text: "Hier siehst du deinen persönlichen Bestwert. Versuche, ihn mit jedem Run weiter zu verbessern."
    }),
    Object.freeze({
      id: "xp",
      title: "XP & PRESTIGE",
      targetId: "menuXPProgress",
      text: "Hier sammelst du XP und steigst im Spielerlevel auf. Ab Level 100 und vollem letzten XP-Balken wird Prestige bereit. Deine permanenten Prestige-Belohnungen siehst du schon vorher unter Garderobe → Prestige-Garderobe."
    }),
    Object.freeze({
      id: "stars",
      title: "STERNE",
      targetId: "menuStarBalance",
      text: "Sterne bringen Punkte und sind deine Währung für Garderobe und Fähigkeiten. Sammelst du alle Pflichtsterne eines Levels ohne zu sterben, zählt das als Perfect Run. Drei in Folge geben dir ein zusätzliches Leben."
    }),
    Object.freeze({
      id: "rank",
      title: "RANG",
      targetId: "personalGlobalRank",
      text: "Hier siehst du deinen Platz im globalen Bestscore-Ranking. Je besser dein eingereichter Bestscore, desto höher dein Rang; ohne verfügbaren Rang steht hier —."
    }),
    Object.freeze({
      id: "callingCard",
      title: "CALLING CARD",
      targetId: "recentAchievements",
      text: "Das ist deine Calling Card. Anfangs zeigt sie deine letzten Erfolge; im Erfolge-Menü kannst du bis zu fünf Lieblings-Badges wählen. Sie erscheinen auch im Leaderboard und bringen keinen Spielvorteil."
    }),
    Object.freeze({
      id: "achievements",
      title: "ERFOLGE",
      targetId: "achievementsBtn",
      text: "Unter Erfolge findest du freigeschaltete Herausforderungen und Auszeichnungen. Dort wählst du auch die Badges für deine Calling Card."
    }),
    Object.freeze({
      id: "wardrobe",
      title: "GARDEROBE",
      targetId: "wardrobeBtn",
      text: "In der Garderobe passt du deinen Slime an. Dort findest du Farben, Hüte, Bärte, Gold-Garderobe und Prestige-Garderobe."
    }),
    Object.freeze({
      id: "perks",
      title: "FÄHIGKEITEN",
      targetId: "perksBtn",
      text: "Hier schaltest du mit Sternen Fähigkeiten frei. Du kannst bis zu drei gleichzeitig auswählen; deine Auswahl gilt für den nächsten Run."
    }),
    Object.freeze({
      id: "highscores",
      title: "HIGHSCORES",
      targetId: "highScoresBtn",
      text: "Hier findest du die besten Scores. Online werden die globalen Top 10 angezeigt; falls das nicht verfügbar ist, zeigt das Spiel lokale Bestwerte."
    }),
    Object.freeze({
      id: "graphics",
      title: "GRAFIKSTIL",
      targetId: "mainMenuGraphics",
      text: "Hier wechselst du den Grafikstil. FAIRY TALE nutzt die neue Grafik, LEGACY den ursprünglichen klassischen Look. Das Gameplay bleibt in beiden Modi gleich."
    })
  ]);
  const MAIN_MENU_ONBOARDING_PLACEMENTS = Object.freeze([
    "top",
    "bottom",
    "left",
    "right"
  ]);
  const MAIN_MENU_ONBOARDING_HIGHLIGHT_PADDING = 6;
  const MAIN_MENU_ONBOARDING_BUBBLE_GAP = 14;
  let mainMenuOnboardingActive = false;
  let mainMenuOnboardingPaused = false;
  let mainMenuOnboardingDecisionOpen = false;
  let mainMenuOnboardingStepIndex = 0;
  let mainMenuOnboardingEntryId = 0;
  let mainMenuOnboardingSuppressedEntryId = -1;
  let mainMenuOnboardingPreviousFocus = null;
  let mainMenuOnboardingMenuWasInert = false;
  let mainMenuOnboardingLayoutFrame = null;
  let mainMenuOnboardingFocusPending = false;
  let mainMenuOnboardingResizeObserver = null;
  let mainMenuOnboardingTarget = null;

  function hasSeenCurrentMainMenuOnboarding() {
    try {
      return localStorage.getItem(MAIN_MENU_ONBOARDING_STORAGE_KEY) ===
        MAIN_MENU_ONBOARDING_VERSION;
    } catch (_) {
      return false;
    }
  }

  function persistCurrentMainMenuOnboardingVersion() {
    try {
      localStorage.setItem(
        MAIN_MENU_ONBOARDING_STORAGE_KEY,
        MAIN_MENU_ONBOARDING_VERSION
      );
      return localStorage.getItem(MAIN_MENU_ONBOARDING_STORAGE_KEY) ===
        MAIN_MENU_ONBOARDING_VERSION;
    } catch (_) {
      return false;
    }
  }

  function getMainMenuOnboardingTarget(stepIndex = mainMenuOnboardingStepIndex) {
    const step = MAIN_MENU_ONBOARDING_STEPS[stepIndex];
    return step ? document.getElementById(step.targetId) : null;
  }

  function isMainMenuOnboardingTargetMeasurable(target) {
    if (!target || target.closest?.(".hidden")) return false;
    const rect = target.getBoundingClientRect?.();
    return Boolean(
      rect &&
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.top) &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function areMainMenuOnboardingTargetsMeasurable() {
    return MAIN_MENU_ONBOARDING_STEPS.every((_, index) =>
      isMainMenuOnboardingTargetMeasurable(getMainMenuOnboardingTarget(index))
    );
  }

  function hasHigherPriorityMainMenuModal() {
    const activeModal = Array.from(
      document.querySelectorAll?.('[aria-modal="true"]') ?? []
    ).some(modal =>
      modal !== ui.mainMenuOnboardingOverlay &&
      !modal.classList.contains("hidden") &&
      modal.getAttribute("aria-hidden") !== "true"
    );
    return activeModal || Boolean(ui.message && !ui.message.classList.contains("hidden"));
  }

  function canStartMainMenuOnboarding() {
    return Boolean(
      state === "menu" &&
      isMainMenuVisible() &&
      !ui.mainMenuScreen.hasAttribute("inert") &&
      !hasHigherPriorityMainMenuModal() &&
      areMainMenuOnboardingTargetsMeasurable()
    );
  }

  function setMainMenuOnboardingPopupPause(paused) {
    window.SlimeAchievements?.setPopupsPaused?.(paused);
  }

  function setMainMenuOnboardingInteractionLock(locked) {
    if (!ui.mainMenuScreen) return;
    if (locked) {
      ui.mainMenuScreen.setAttribute("inert", "");
    } else if (!mainMenuOnboardingMenuWasInert) {
      ui.mainMenuScreen.removeAttribute("inert");
    }
  }

  function cancelMainMenuOnboardingLayout() {
    if (mainMenuOnboardingLayoutFrame !== null) {
      window.cancelAnimationFrame(mainMenuOnboardingLayoutFrame);
      mainMenuOnboardingLayoutFrame = null;
    }
  }

  function disconnectMainMenuOnboardingObserver() {
    mainMenuOnboardingResizeObserver?.disconnect();
    mainMenuOnboardingResizeObserver = null;
  }

  function observeMainMenuOnboardingLayout() {
    disconnectMainMenuOnboardingObserver();
    const ResizeObserverConstructor = window.ResizeObserver;
    if (
      typeof ResizeObserverConstructor !== "function" ||
      !mainMenuOnboardingTarget ||
      !ui.mainMenuOnboardingBubble
    ) return;
    mainMenuOnboardingResizeObserver = new ResizeObserverConstructor(
      scheduleMainMenuOnboardingLayout
    );
    mainMenuOnboardingResizeObserver.observe(mainMenuOnboardingTarget);
    mainMenuOnboardingResizeObserver.observe(ui.mainMenuOnboardingBubble);
  }

  function getMainMenuOnboardingSafeRect() {
    const fallbackMargin = 8;
    const fallback = {
      left: fallbackMargin,
      top: fallbackMargin,
      right: Math.max(fallbackMargin, window.innerWidth - fallbackMargin),
      bottom: Math.max(fallbackMargin, window.innerHeight - fallbackMargin)
    };
    const measured = ui.mainMenuOnboardingSafeArea?.getBoundingClientRect?.();
    const base = measured?.width > 0 && measured?.height > 0
      ? measured
      : fallback;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return base;
    const visualRight = visualViewport.offsetLeft + visualViewport.width;
    const visualBottom = visualViewport.offsetTop + visualViewport.height;
    return {
      left: Math.max(base.left, visualViewport.offsetLeft),
      top: Math.max(base.top, visualViewport.offsetTop),
      right: Math.min(base.right, visualRight),
      bottom: Math.min(base.bottom, visualBottom)
    };
  }

  function clampMainMenuOnboardingPosition(value, minimum, maximum) {
    return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
  }

  function setMainMenuOnboardingRect(element, left, top, width, height) {
    if (!element) return;
    element.style.left = `${Math.max(0, left)}px`;
    element.style.top = `${Math.max(0, top)}px`;
    element.style.width = `${Math.max(0, width)}px`;
    element.style.height = `${Math.max(0, height)}px`;
  }

  function updateMainMenuOnboardingSpotlight(targetRect) {
    const viewportWidth = Math.max(0, window.innerWidth);
    const viewportHeight = Math.max(0, window.innerHeight);
    const holeLeft = Math.max(
      0,
      targetRect.left - MAIN_MENU_ONBOARDING_HIGHLIGHT_PADDING
    );
    const holeTop = Math.max(
      0,
      targetRect.top - MAIN_MENU_ONBOARDING_HIGHLIGHT_PADDING
    );
    const holeRight = Math.min(
      viewportWidth,
      targetRect.right + MAIN_MENU_ONBOARDING_HIGHLIGHT_PADDING
    );
    const holeBottom = Math.min(
      viewportHeight,
      targetRect.bottom + MAIN_MENU_ONBOARDING_HIGHLIGHT_PADDING
    );
    const holeWidth = Math.max(0, holeRight - holeLeft);
    const holeHeight = Math.max(0, holeBottom - holeTop);
    const dimElements = Object.fromEntries(
      Array.from(ui.mainMenuOnboardingOverlay.querySelectorAll("[data-onboarding-dim]"))
        .map(element => [element.dataset.onboardingDim, element])
    );

    setMainMenuOnboardingRect(dimElements.top, 0, 0, viewportWidth, holeTop);
    setMainMenuOnboardingRect(
      dimElements.bottom,
      0,
      holeBottom,
      viewportWidth,
      viewportHeight - holeBottom
    );
    setMainMenuOnboardingRect(
      dimElements.left,
      0,
      holeTop,
      holeLeft,
      holeHeight
    );
    setMainMenuOnboardingRect(
      dimElements.right,
      holeRight,
      holeTop,
      viewportWidth - holeRight,
      holeHeight
    );
    setMainMenuOnboardingRect(
      ui.mainMenuOnboardingHighlight,
      holeLeft,
      holeTop,
      holeWidth,
      holeHeight
    );
  }

  function getMainMenuOnboardingPlacementCandidate(
    placement,
    targetRect,
    bubbleRect,
    safeRect
  ) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    let left = targetCenterX - bubbleRect.width / 2;
    let top = targetCenterY - bubbleRect.height / 2;
    let availableArea = 0;

    if (placement === "top") {
      top = targetRect.top - MAIN_MENU_ONBOARDING_BUBBLE_GAP - bubbleRect.height;
      availableArea = Math.max(
        0,
        targetRect.top - MAIN_MENU_ONBOARDING_BUBBLE_GAP - safeRect.top
      ) * Math.max(0, safeRect.right - safeRect.left);
    } else if (placement === "bottom") {
      top = targetRect.bottom + MAIN_MENU_ONBOARDING_BUBBLE_GAP;
      availableArea = Math.max(
        0,
        safeRect.bottom - targetRect.bottom - MAIN_MENU_ONBOARDING_BUBBLE_GAP
      ) * Math.max(0, safeRect.right - safeRect.left);
    } else if (placement === "left") {
      left = targetRect.left - MAIN_MENU_ONBOARDING_BUBBLE_GAP - bubbleRect.width;
      availableArea = Math.max(
        0,
        targetRect.left - MAIN_MENU_ONBOARDING_BUBBLE_GAP - safeRect.left
      ) * Math.max(0, safeRect.bottom - safeRect.top);
    } else {
      left = targetRect.right + MAIN_MENU_ONBOARDING_BUBBLE_GAP;
      availableArea = Math.max(
        0,
        safeRect.right - targetRect.right - MAIN_MENU_ONBOARDING_BUBBLE_GAP
      ) * Math.max(0, safeRect.bottom - safeRect.top);
    }

    const overflow =
      Math.max(0, safeRect.left - left) +
      Math.max(0, left + bubbleRect.width - safeRect.right) +
      Math.max(0, safeRect.top - top) +
      Math.max(0, top + bubbleRect.height - safeRect.bottom);
    return {
      placement,
      left,
      top,
      fits: overflow === 0,
      availableArea,
      overflow
    };
  }

  function updateMainMenuOnboardingBubble(targetRect) {
    const bubble = ui.mainMenuOnboardingBubble;
    if (!bubble) return;
    bubble.style.visibility = "hidden";
    bubble.style.left = "0px";
    bubble.style.top = "0px";
    const bubbleRect = bubble.getBoundingClientRect();
    const safeRect = getMainMenuOnboardingSafeRect();
    const candidates = MAIN_MENU_ONBOARDING_PLACEMENTS.map(placement =>
      getMainMenuOnboardingPlacementCandidate(
        placement,
        targetRect,
        bubbleRect,
        safeRect
      )
    );
    const fittingCandidates = candidates.filter(candidate => candidate.fits);
    const candidate = (fittingCandidates.length > 0
      ? fittingCandidates
      : candidates
    ).sort((left, right) =>
      right.availableArea - left.availableArea || left.overflow - right.overflow
    )[0];
    if (!candidate) return;

    const left = clampMainMenuOnboardingPosition(
      candidate.left,
      safeRect.left,
      safeRect.right - bubbleRect.width
    );
    const top = clampMainMenuOnboardingPosition(
      candidate.top,
      safeRect.top,
      safeRect.bottom - bubbleRect.height
    );
    const pointsVertically = candidate.placement === "left" ||
      candidate.placement === "right";
    const pointerCenter = pointsVertically
      ? targetRect.top + targetRect.height / 2 - top
      : targetRect.left + targetRect.width / 2 - left;
    const pointerLimit = pointsVertically ? bubbleRect.height : bubbleRect.width;
    const pointerOffset = clampMainMenuOnboardingPosition(
      pointerCenter,
      22,
      Math.max(22, pointerLimit - 22)
    );

    bubble.dataset.placement = candidate.placement;
    bubble.style.setProperty("--onboarding-tail-offset", `${pointerOffset}px`);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.visibility = "visible";
  }

  function layoutMainMenuOnboarding() {
    if (!mainMenuOnboardingActive || mainMenuOnboardingPaused) return;
    const target = getMainMenuOnboardingTarget();
    if (!isMainMenuOnboardingTargetMeasurable(target)) return;
    mainMenuOnboardingTarget = target;
    const targetRect = target.getBoundingClientRect();
    updateMainMenuOnboardingSpotlight(targetRect);
    updateMainMenuOnboardingBubble(targetRect);
    if (mainMenuOnboardingFocusPending) {
      mainMenuOnboardingFocusPending = false;
      focusMainMenuOnboardingAction();
    }
  }

  function scheduleMainMenuOnboardingLayout() {
    if (
      !mainMenuOnboardingActive ||
      mainMenuOnboardingPaused ||
      mainMenuOnboardingLayoutFrame !== null
    ) return;
    mainMenuOnboardingLayoutFrame = window.requestAnimationFrame(() => {
      mainMenuOnboardingLayoutFrame = null;
      layoutMainMenuOnboarding();
    });
  }

  function focusMainMenuOnboardingAction() {
    const button = mainMenuOnboardingDecisionOpen
      ? ui.mainMenuOnboardingLaterBtn
      : ui.mainMenuOnboardingNextBtn;
    button?.focus();
  }

  function renderMainMenuOnboardingStep() {
    const step = MAIN_MENU_ONBOARDING_STEPS[mainMenuOnboardingStepIndex];
    if (!step || !ui.mainMenuOnboardingOverlay) return false;
    mainMenuOnboardingDecisionOpen = false;
    ui.mainMenuOnboardingBubble.style.visibility = "hidden";
    ui.mainMenuOnboardingOverlay.dataset.step = step.id;
    ui.mainMenuOnboardingTitle.textContent = step.title;
    ui.mainMenuOnboardingText.textContent = step.text;
    ui.mainMenuOnboardingCount.textContent =
      `${mainMenuOnboardingStepIndex + 1} / ${MAIN_MENU_ONBOARDING_STEPS.length}`;
    ui.mainMenuOnboardingBackBtn.disabled = mainMenuOnboardingStepIndex === 0;
    ui.mainMenuOnboardingNextBtn.textContent =
      mainMenuOnboardingStepIndex === MAIN_MENU_ONBOARDING_STEPS.length - 1
        ? "FERTIG"
        : "WEITER";
    ui.mainMenuOnboardingNavigation.classList.remove("hidden");
    ui.mainMenuOnboardingDecision.classList.add("hidden");
    mainMenuOnboardingTarget = getMainMenuOnboardingTarget();
    observeMainMenuOnboardingLayout();
    mainMenuOnboardingFocusPending = true;
    scheduleMainMenuOnboardingLayout();
    return true;
  }

  function showMainMenuOnboardingDecision() {
    if (!mainMenuOnboardingActive || mainMenuOnboardingPaused) return false;
    mainMenuOnboardingDecisionOpen = true;
    ui.mainMenuOnboardingBubble.style.visibility = "hidden";
    ui.mainMenuOnboardingOverlay.dataset.step = "decision";
    ui.mainMenuOnboardingTitle.textContent = "ERKLÄRUNG BEENDET";
    ui.mainMenuOnboardingText.textContent =
      "Möchtest du dir diese Menü-Erklärung später noch einmal ansehen?";
    ui.mainMenuOnboardingCount.textContent =
      `${mainMenuOnboardingStepIndex + 1} / ${MAIN_MENU_ONBOARDING_STEPS.length}`;
    ui.mainMenuOnboardingNavigation.classList.add("hidden");
    ui.mainMenuOnboardingDecision.classList.remove("hidden");
    observeMainMenuOnboardingLayout();
    mainMenuOnboardingFocusPending = true;
    scheduleMainMenuOnboardingLayout();
    return true;
  }

  function endMainMenuOnboarding({restoreFocus = true} = {}) {
    if (!mainMenuOnboardingActive) return false;
    cancelMainMenuOnboardingLayout();
    disconnectMainMenuOnboardingObserver();
    ui.mainMenuOnboardingOverlay.classList.add("hidden");
    ui.mainMenuOnboardingOverlay.setAttribute("aria-hidden", "true");
    setMainMenuOnboardingInteractionLock(false);
    setMainMenuOnboardingPopupPause(false);
    mainMenuOnboardingActive = false;
    mainMenuOnboardingPaused = false;
    mainMenuOnboardingDecisionOpen = false;
    mainMenuOnboardingFocusPending = false;
    mainMenuOnboardingTarget = null;
    const previousFocus = mainMenuOnboardingPreviousFocus;
    mainMenuOnboardingPreviousFocus = null;
    if (restoreFocus) {
      const focusTarget = previousFocus && previousFocus !== document.body
        ? previousFocus
        : ui.startBtn;
      focusTarget?.focus?.();
    }
    return true;
  }

  function startMainMenuOnboarding() {
    if (mainMenuOnboardingActive || !canStartMainMenuOnboarding()) return false;
    mainMenuOnboardingActive = true;
    mainMenuOnboardingPaused = false;
    mainMenuOnboardingDecisionOpen = false;
    mainMenuOnboardingStepIndex = 0;
    mainMenuOnboardingPreviousFocus = document.activeElement;
    mainMenuOnboardingMenuWasInert = ui.mainMenuScreen.hasAttribute("inert");
    ui.mainMenuOnboardingOverlay.classList.remove("hidden");
    ui.mainMenuOnboardingOverlay.setAttribute("aria-hidden", "false");
    setMainMenuOnboardingInteractionLock(true);
    setMainMenuOnboardingPopupPause(true);
    return renderMainMenuOnboardingStep();
  }

  function maybeStartMainMenuOnboarding() {
    if (
      mainMenuOnboardingActive ||
      mainMenuOnboardingEntryId <= 0 ||
      mainMenuOnboardingSuppressedEntryId === mainMenuOnboardingEntryId ||
      hasSeenCurrentMainMenuOnboarding() ||
      !canStartMainMenuOnboarding()
    ) return false;
    return startMainMenuOnboarding();
  }

  function beginMainMenuOnboardingEntry() {
    mainMenuOnboardingEntryId += 1;
    return maybeStartMainMenuOnboarding();
  }

  function pauseMainMenuOnboardingForModal() {
    if (!mainMenuOnboardingActive || mainMenuOnboardingPaused) return false;
    mainMenuOnboardingPaused = true;
    mainMenuOnboardingFocusPending = false;
    cancelMainMenuOnboardingLayout();
    disconnectMainMenuOnboardingObserver();
    ui.mainMenuOnboardingOverlay.classList.add("hidden");
    ui.mainMenuOnboardingOverlay.setAttribute("aria-hidden", "true");
    setMainMenuOnboardingInteractionLock(false);
    setMainMenuOnboardingPopupPause(false);
    return true;
  }

  function resumeMainMenuOnboardingAfterModal() {
    if (
      !mainMenuOnboardingActive ||
      !mainMenuOnboardingPaused ||
      state !== "menu" ||
      !isMainMenuVisible() ||
      hasHigherPriorityMainMenuModal()
    ) return false;
    mainMenuOnboardingPaused = false;
    ui.mainMenuOnboardingBubble.style.visibility = "hidden";
    ui.mainMenuOnboardingOverlay.classList.remove("hidden");
    ui.mainMenuOnboardingOverlay.setAttribute("aria-hidden", "false");
    setMainMenuOnboardingInteractionLock(true);
    setMainMenuOnboardingPopupPause(true);
    mainMenuOnboardingTarget = getMainMenuOnboardingTarget();
    observeMainMenuOnboardingLayout();
    mainMenuOnboardingFocusPending = true;
    scheduleMainMenuOnboardingLayout();
    return true;
  }

  function showPreviousMainMenuOnboardingStep() {
    if (
      !mainMenuOnboardingActive ||
      mainMenuOnboardingPaused ||
      mainMenuOnboardingDecisionOpen ||
      mainMenuOnboardingStepIndex <= 0
    ) return false;
    mainMenuOnboardingStepIndex -= 1;
    return renderMainMenuOnboardingStep();
  }

  function showNextMainMenuOnboardingStep() {
    if (
      !mainMenuOnboardingActive ||
      mainMenuOnboardingPaused ||
      mainMenuOnboardingDecisionOpen
    ) return false;
    if (mainMenuOnboardingStepIndex >= MAIN_MENU_ONBOARDING_STEPS.length - 1) {
      return showMainMenuOnboardingDecision();
    }
    mainMenuOnboardingStepIndex += 1;
    return renderMainMenuOnboardingStep();
  }

  function postponeMainMenuOnboarding() {
    if (!mainMenuOnboardingActive) return false;
    mainMenuOnboardingSuppressedEntryId = mainMenuOnboardingEntryId;
    return endMainMenuOnboarding();
  }

  function dismissMainMenuOnboardingPermanently() {
    if (!mainMenuOnboardingActive) return false;
    persistCurrentMainMenuOnboardingVersion();
    mainMenuOnboardingSuppressedEntryId = mainMenuOnboardingEntryId;
    return endMainMenuOnboarding();
  }

  function getMainMenuOnboardingFocusableButtons() {
    if (!ui.mainMenuOnboardingOverlay) return [];
    return Array.from(
      ui.mainMenuOnboardingOverlay.querySelectorAll("button:not([disabled])")
    ).filter(button => !button.closest(".hidden"));
  }

  function handleMainMenuOnboardingKeydown(event) {
    if (!mainMenuOnboardingActive || mainMenuOnboardingPaused) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (!mainMenuOnboardingDecisionOpen) showMainMenuOnboardingDecision();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getMainMenuOnboardingFocusableButtons();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openUpdateStorePage() {
    window.open(UPDATE_STORE_URL, "_blank", "noopener,noreferrer");
  }

  function isPrivateUpdateTestHostname(hostname) {
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;

    const segments = hostname.split(".");
    if (
      segments.length !== 4 ||
      segments.some(segment => !/^\d{1,3}$/.test(segment))
    ) {
      return false;
    }

    const octets = segments.map(Number);
    if (octets.some(octet => octet < 0 || octet > 255)) return false;

    return (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  function shouldShowUpdateScreenFromLocalTestUrl() {
    if (isNativeCapacitorRuntime()) return false;
    if (location.protocol !== "http:" || location.port !== "8129") return false;
    if (!isPrivateUpdateTestHostname(location.hostname.toLowerCase())) return false;

    return new URLSearchParams(location.search).get("testUpdate") === "1";
  }

  function isNativeAndroidUpdateRuntime() {
    if (!isNativeCapacitorRuntime()) return false;

    try {
      return window.Capacitor?.getPlatform?.() === "android";
    } catch (_) {
      return false;
    }
  }

  function parseInstalledAndroidVersion(appInfo) {
    const versionName = typeof appInfo?.version === "string"
      ? appInfo.version.trim()
      : "";
    const versionCode = Number(appInfo?.build);

    if (
      !versionName ||
      versionName.length > MAX_ANDROID_VERSION_NAME_LENGTH ||
      !Number.isSafeInteger(versionCode) ||
      versionCode <= 0
    ) {
      return null;
    }

    return {versionCode, versionName};
  }

  function validateRemoteAndroidUpdateData(payload) {
    const android = payload?.android;
    if (!android || typeof android !== "object" || Array.isArray(android)) return null;
    if (
      typeof android.versionCode !== "number" ||
      !Number.isSafeInteger(android.versionCode) ||
      android.versionCode <= 0
    ) {
      return null;
    }

    const versionName = typeof android.versionName === "string"
      ? android.versionName.trim()
      : "";
    if (!versionName || versionName.length > MAX_ANDROID_VERSION_NAME_LENGTH) {
      return null;
    }
    if (
      !Array.isArray(android.notes) ||
      android.notes.length === 0 ||
      android.notes.length > MAX_ANDROID_UPDATE_NOTES
    ) {
      return null;
    }

    const notes = [];
    for (const note of android.notes) {
      if (typeof note !== "string") return null;
      const normalizedNote = note.trim();
      if (!normalizedNote || normalizedNote.length > MAX_ANDROID_UPDATE_NOTE_LENGTH) {
        return null;
      }
      notes.push(normalizedNote);
    }

    return {
      versionCode: android.versionCode,
      versionName,
      notes
    };
  }

  async function fetchRemoteAndroidUpdateData() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      ANDROID_UPDATE_TIMEOUT_MS
    );

    try {
      const cacheBuster = encodeURIComponent(String(Date.now()));
      const response = await fetch(`${ANDROID_UPDATE_ENDPOINT}?_=${cacheBuster}`, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Update-Check HTTP ${response.status}`);
      return validateRemoteAndroidUpdateData(await response.json());
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function performAndroidUpdateCheck() {
    try {
      const appPlugin = window.Capacitor?.Plugins?.App;
      if (typeof appPlugin?.getInfo !== "function") {
        return ANDROID_UPDATE_CHECK_RESULT.TECHNICAL_FAILURE;
      }

      const installedVersion = parseInstalledAndroidVersion(
        await appPlugin.getInfo()
      );
      if (!installedVersion) {
        return ANDROID_UPDATE_CHECK_RESULT.TECHNICAL_FAILURE;
      }

      const remoteUpdate = await fetchRemoteAndroidUpdateData();
      if (!remoteUpdate) {
        return ANDROID_UPDATE_CHECK_RESULT.TECHNICAL_FAILURE;
      }
      if (remoteUpdate.versionCode <= installedVersion.versionCode) {
        return ANDROID_UPDATE_CHECK_RESULT.SUCCESS_NO_UPDATE;
      }

      if (androidUpdateScreenShown) {
        return ANDROID_UPDATE_CHECK_RESULT.UPDATE_AVAILABLE;
      }
      const screenShown = showUpdateScreen({
        installedVersion: installedVersion.versionName,
        versionName: remoteUpdate.versionName,
        notes: remoteUpdate.notes
      });
      if (!screenShown) {
        return ANDROID_UPDATE_CHECK_RESULT.TECHNICAL_FAILURE;
      }
      androidUpdateScreenShown = true;
      return ANDROID_UPDATE_CHECK_RESULT.UPDATE_AVAILABLE;
    } catch (_) {
      return ANDROID_UPDATE_CHECK_RESULT.TECHNICAL_FAILURE;
    }
  }

  function cancelAndroidUpdateRetry({resetIndex = false} = {}) {
    if (androidUpdateRetryTimeoutId !== null) {
      window.clearTimeout(androidUpdateRetryTimeoutId);
      androidUpdateRetryTimeoutId = null;
    }
    if (resetIndex) androidUpdateRetryIndex = 0;
  }

  function scheduleAndroidUpdateRetry() {
    if (
      androidUpdateRetryTimeoutId !== null ||
      androidUpdateRetryIndex >= ANDROID_UPDATE_RETRY_DELAYS_MS.length ||
      !androidUpdateHadTechnicalFailure ||
      androidUpdateScreenShown
    ) {
      return false;
    }

    const delay = ANDROID_UPDATE_RETRY_DELAYS_MS[androidUpdateRetryIndex];
    androidUpdateRetryIndex += 1;
    androidUpdateRetryTimeoutId = window.setTimeout(() => {
      androidUpdateRetryTimeoutId = null;
      if (!androidUpdateHadTechnicalFailure || androidUpdateScreenShown) return;
      void requestAndroidUpdateCheck();
    }, delay);
    return true;
  }

  function handleAndroidUpdateCheckResult(result) {
    if (result === ANDROID_UPDATE_CHECK_RESULT.TECHNICAL_FAILURE) {
      androidUpdateHadTechnicalFailure = true;
      scheduleAndroidUpdateRetry();
      return result;
    }

    androidUpdateHadTechnicalFailure = false;
    cancelAndroidUpdateRetry({resetIndex: true});
    return result;
  }

  function registerAndroidUpdateRecoveryListeners() {
    if (!isNativeAndroidUpdateRuntime()) return;

    if (!androidUpdateOnlineListenerRegistered) {
      window.addEventListener("online", () => {
        if (!androidUpdateHadTechnicalFailure || androidUpdateScreenShown) return;
        void requestAndroidUpdateCheck({resetRetryBudget: true});
      });
      androidUpdateOnlineListenerRegistered = true;
    }

    const appPlugin = window.Capacitor?.Plugins?.App;
    if (
      androidUpdateAppStateListenerRegistrationStarted ||
      typeof appPlugin?.addListener !== "function"
    ) {
      return;
    }

    androidUpdateAppStateListenerRegistrationStarted = true;
    try {
      Promise.resolve(appPlugin.addListener("appStateChange", appState => {
        if (appState?.isActive !== true || androidUpdateScreenShown) return;
        void requestAndroidUpdateCheck({resetRetryBudget: true});
      })).catch(() => {
        androidUpdateAppStateListenerRegistrationStarted = false;
      });
    } catch (_) {
      androidUpdateAppStateListenerRegistrationStarted = false;
    }
  }

  function requestAndroidUpdateCheck({resetRetryBudget = false} = {}) {
    if (!isNativeAndroidUpdateRuntime()) {
      return Promise.resolve(ANDROID_UPDATE_CHECK_RESULT.SUCCESS_NO_UPDATE);
    }

    registerAndroidUpdateRecoveryListeners();
    if (androidUpdateScreenShown) {
      return Promise.resolve(ANDROID_UPDATE_CHECK_RESULT.UPDATE_AVAILABLE);
    }
    if (androidUpdateCheckInFlight) return androidUpdateCheckInFlight;

    if (resetRetryBudget) {
      cancelAndroidUpdateRetry({resetIndex: true});
    }
    androidUpdateCheckInFlight = performAndroidUpdateCheck()
      .then(handleAndroidUpdateCheckResult)
      .finally(() => {
        androidUpdateCheckInFlight = null;
      });
    return androidUpdateCheckInFlight;
  }

  function initializeAndroidUpdateCheck() {
    return requestAndroidUpdateCheck();
  }

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
    renderPerksScreen();
    renderMenuMascot();
  }

  function resetDevPerkPurchaseTest() {
    if (!isDevShopTestActive()) return false;
    const perks = window.SlimePerks;
    if (perks?.resetDevPerkPurchaseTestState?.() !== true) {
      showGameToast("DEV-Perk-Kauftest konnte nicht zurückgesetzt werden.");
      return false;
    }

    let infoFlagsReset = true;
    try {
      Object.values(PERK_CONFLICT_PURCHASE_INFO).forEach(info => {
        localStorage.removeItem(info.seenStorageKey);
        if (localStorage.getItem(info.seenStorageKey) !== null) {
          infoFlagsReset = false;
        }
      });
    } catch (_) {
      infoFlagsReset = false;
    }
    if (!infoFlagsReset) {
      showGameToast("DEV-Kaufhinweise konnten nicht zurückgesetzt werden.");
      return false;
    }

    window.SlimeDevShopTest?.refillBalance?.();
    closePerkConflictPurchaseInfo();
    if (ui.devUnlockPerksBtn) {
      ui.devUnlockPerksBtn.setAttribute("aria-pressed", "false");
      ui.devUnlockPerksBtn.textContent = "DEV FÄHIGKEITEN FREISCHALTEN";
    }
    renderDevShopTestControl();
    renderPerksScreen();
    window.dispatchEvent(new CustomEvent("slimeperkschange"));
    showGameToast("DEV-Perk-Kauftest zurückgesetzt.");
    return true;
  }

  let menuBiomeBackgroundState = null;

  function initializeMenuBiomeBackground() {
    const menuBackdrop = document.querySelector(".menuBackdrop");
    if (
      !menuBackdrop ||
      menuBiomeBackgroundState ||
      menuBackdrop.querySelector(".menuBiomeBackground") ||
      !Array.isArray(BIOMES) ||
      BIOMES.length === 0
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
    menuBiomeBackgroundState = {
      selectedBiome,
      context: menuBackgroundContext,
      visuals: null,
      elapsedSeconds: 0,
      lastVisibleFrameTime: null,
      renderedGraphicsMode: null,
      warnedAboutRenderFailure: false,
      warnedAboutLegacyRenderFailure: false
    };
    menuBackdrop.dataset.biomeId = selectedBiome.id;
    menuBackdrop.prepend(menuBackground);
  }

  function isMenuBiomeBackgroundVisible() {
    return Boolean(
      ui.menu &&
      !ui.menu.classList.contains("hidden") &&
      document.hidden !== true
    );
  }

  function pauseMenuBiomeBackgroundClock() {
    if (menuBiomeBackgroundState) {
      menuBiomeBackgroundState.lastVisibleFrameTime = null;
    }
  }

  function refreshMenuBiomeBackgroundForGraphicsMode() {
    if (!menuBiomeBackgroundState) return false;
    menuBiomeBackgroundState.renderedGraphicsMode = null;
    pauseMenuBiomeBackgroundClock();
    return true;
  }

  function isFairyTaleMenuGraphicsMode() {
    return typeof isFairyTaleGraphicsMode !== "function" ||
      isFairyTaleGraphicsMode();
  }

  function drawLegacyMenuBiomeBackgroundSnapshot() {
    if (
      !menuBiomeBackgroundState ||
      typeof drawBackground !== "function" ||
      typeof menuBiomeBackgroundState.context?.drawImage !== "function"
    ) return false;
    try {
      drawBackground(menuBiomeBackgroundState.selectedBiome);
      menuBiomeBackgroundState.context.drawImage(canvas, 0, 0, W, H);
      return true;
    } catch (error) {
      if (!menuBiomeBackgroundState.warnedAboutLegacyRenderFailure) {
        menuBiomeBackgroundState.warnedAboutLegacyRenderFailure = true;
        console.warn("Legacy-Menü-Hintergrund konnte nicht gerendert werden:", error);
      }
      return false;
    }
  }

  function updateMenuBiomeBackground(now) {
    if (!menuBiomeBackgroundState) return false;
    if (!isMenuBiomeBackgroundVisible()) {
      pauseMenuBiomeBackgroundClock();
      return false;
    }

    if (!isFairyTaleMenuGraphicsMode()) {
      pauseMenuBiomeBackgroundClock();
      if (menuBiomeBackgroundState.renderedGraphicsMode === "legacy") {
        return true;
      }
      const snapshotDrawn = drawLegacyMenuBiomeBackgroundSnapshot();
      if (snapshotDrawn) {
        menuBiomeBackgroundState.renderedGraphicsMode = "legacy";
      }
      return snapshotDrawn;
    }

    if (menuBiomeBackgroundState.renderedGraphicsMode !== "fairyTale") {
      pauseMenuBiomeBackgroundClock();
      menuBiomeBackgroundState.renderedGraphicsMode = "fairyTale";
    }

    const frameTime = Number(now);
    if (!Number.isFinite(frameTime)) return false;
    if (menuBiomeBackgroundState.lastVisibleFrameTime !== null) {
      menuBiomeBackgroundState.elapsedSeconds += Math.max(
        0,
        (frameTime - menuBiomeBackgroundState.lastVisibleFrameTime) / 1000
      );
    }
    menuBiomeBackgroundState.lastVisibleFrameTime = frameTime;

    if (!menuBiomeBackgroundState.visuals) {
      if (typeof BIOME_PLATFORM_VISUALS === "undefined") return false;
      const resolveBackground =
        typeof BIOME_PLATFORM_VISUALS.resolveBackground === "function"
          ? BIOME_PLATFORM_VISUALS.resolveBackground.bind(BIOME_PLATFORM_VISUALS)
          : BIOME_PLATFORM_VISUALS.resolve.bind(BIOME_PLATFORM_VISUALS);
      const visuals = resolveBackground(menuBiomeBackgroundState.selectedBiome.id);
      if (!visuals || typeof visuals.drawBackground !== "function") return false;
      visuals.requestBackgroundAssets?.();
      menuBiomeBackgroundState.visuals = visuals;
    }

    try {
      return Boolean(menuBiomeBackgroundState.visuals.drawBackground(
        menuBiomeBackgroundState.context,
        W,
        H,
        menuBiomeBackgroundState.elapsedSeconds
      ));
    } catch (error) {
      if (!menuBiomeBackgroundState.warnedAboutRenderFailure) {
        menuBiomeBackgroundState.warnedAboutRenderFailure = true;
        console.warn("Menü-Biom-Hintergrund konnte nicht gerendert werden:", error);
      }
      return false;
    }
  }

  initializeMenuBiomeBackground();
  document.addEventListener?.(
    "visibilitychange",
    pauseMenuBiomeBackgroundClock
  );

  function getActiveSlimeColor() {
    return DEV_MODE && devPreviewSlimeColor
      ? normalizeSlimeColor(devPreviewSlimeColor)
      : selectedSlimeColor;
  }

  function getActiveSlimeCosmetic() {
    if (DEV_MODE && devPreviewSlimeCosmetic) {
      return normalizeSlimeCosmetic(devPreviewSlimeCosmetic);
    }
    return window.SlimeGold?.getEquippedAppearance?.().hatId ?? selectedSlimeCosmetic;
  }

  function getActiveSlimeBeard() {
    if (DEV_MODE && devPreviewSlimeBeard) {
      return normalizeSlimeBeard(devPreviewSlimeBeard);
    }
    return window.SlimeGold?.getEquippedAppearance?.().beardId ?? selectedSlimeBeard;
  }

  function getSelectedPrestigeSlimePreviewOptions(
    prestigeEffectRadius = 20,
    prestigeTrailRadius = prestigeEffectRadius
  ) {
    const prestige = window.SlimePrestige;
    return {
      prestigeAura: prestige?.getSelectedReward?.("aura") ?? "none",
      prestigeTrail: prestige?.getSelectedReward?.("trail") ?? "none",
      prestigeEffectRadius,
      prestigeTrailRadius
    };
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
    prestigeTrail = "none",
    goldAppearance = null
  ) {
    const historicalGoldAppearance = normalizeHighScoreGoldAppearance(goldAppearance);
    const visibleCosmetic = historicalGoldAppearance.hatId ??
      normalizeSlimeCosmetic(cosmetic);
    const visibleBeard = historicalGoldAppearance.beardId ??
      normalizeSlimeBeard(beard);
    const preview = document.createElement("canvas");
    preview.className = "slimeLeaderboardPreview";
    preview.width = 116;
    preview.height = 100;
    preview.setAttribute("aria-hidden", "true");
    drawSlimeCharacterPreview(
      preview,
      visibleCosmetic,
      visibleBeard,
      normalizeSlimeColor(color),
      {
        centerX: 68,
        centerY: 56,
        scale: 0.92,
        prestigeAura,
        prestigeTrail,
        goldSlime: historicalGoldAppearance.slime,
        goldCosmetic: historicalGoldAppearance.hatId !== null,
        goldBeard: historicalGoldAppearance.beardId !== null
      }
    );
    return preview;
  }

  let mainMenuMascotFaceState = "normal";
  let mainMenuMascotFacePhase = "none";
  let mainMenuMascotFaceLookTarget = "normal";
  let mainMenuMascotFaceEventEndsAt = 0;
  let mainMenuMascotNextFaceEventAt = null;
  let mainMenuMascotFaceAnimationActive = false;
  let mainMenuMascotFaceVisualRandomState = 0;

  function seedMainMenuMascotFaceVisualRandom() {
    let seed = 0;
    try {
      const randomValues = new Uint32Array(1);
      globalThis.crypto?.getRandomValues?.(randomValues);
      seed = randomValues[0] >>> 0;
    } catch (_) {}
    if (seed === 0) seed = (Date.now() ^ 0x7f4a7c15) >>> 0;
    mainMenuMascotFaceVisualRandomState = seed || 0x9e3779b9;
  }

  function nextMainMenuMascotFaceVisualRandom() {
    if (mainMenuMascotFaceVisualRandomState === 0) {
      seedMainMenuMascotFaceVisualRandom();
    }
    let randomState = mainMenuMascotFaceVisualRandomState;
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    mainMenuMascotFaceVisualRandomState = randomState >>> 0;
    return mainMenuMascotFaceVisualRandomState / 4294967296;
  }

  function getMainMenuMascotFaceVisualRange(random, min, max) {
    return min + (max - min) * random();
  }

  function resetMainMenuMascotFaceAnimation() {
    mainMenuMascotFaceState = SLIME_FACE_STATES.NORMAL;
    mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.NONE;
    mainMenuMascotFaceLookTarget = SLIME_FACE_STATES.NORMAL;
    mainMenuMascotFaceEventEndsAt = 0;
    mainMenuMascotNextFaceEventAt = null;
    mainMenuMascotFaceAnimationActive = false;
  }

  function isMainMenuMascotFaceAnimationVisible() {
    return Boolean(
      ui.menuMascot &&
      state === "menu" &&
      document.visibilityState !== "hidden" &&
      !ui.menu.classList.contains("hidden") &&
      !ui.mainMenuScreen.classList.contains("hidden")
    );
  }

  function scheduleNextMainMenuMascotFaceEvent(now, random) {
    mainMenuMascotNextFaceEventAt = now + getMainMenuMascotFaceVisualRange(
      random,
      SLIME_FACE_IDLE_INTERVAL_MIN,
      SLIME_FACE_IDLE_INTERVAL_MAX
    );
  }

  function beginMainMenuMascotFaceEvent(now, random) {
    const eventRoll = random();
    if (eventRoll < SLIME_FACE_BLINK_EVENT_WEIGHT) {
      mainMenuMascotFaceState = SLIME_FACE_STATES.BLINK;
      mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.BLINK;
      mainMenuMascotFaceEventEndsAt = now + getMainMenuMascotFaceVisualRange(
        random,
        SLIME_FACE_BLINK_DURATION_MIN,
        SLIME_FACE_BLINK_DURATION_MAX
      );
    } else {
      mainMenuMascotFaceLookTarget = eventRoll <
          SLIME_FACE_BLINK_EVENT_WEIGHT + SLIME_FACE_LEFT_EVENT_WEIGHT
        ? SLIME_FACE_STATES.LEFT
        : SLIME_FACE_STATES.RIGHT;
      mainMenuMascotFaceState = SLIME_FACE_STATES.BLINK;
      mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.LOOK_TRANSITION_IN;
      mainMenuMascotFaceEventEndsAt = now + getMainMenuMascotFaceVisualRange(
        random,
        SLIME_FACE_TRANSITION_BLINK_DURATION_MIN,
        SLIME_FACE_TRANSITION_BLINK_DURATION_MAX
      );
    }
    mainMenuMascotNextFaceEventAt = null;
  }

  function advanceMainMenuMascotFaceEvent(now, random) {
    if (mainMenuMascotFacePhase === SLIME_FACE_IDLE_PHASES.LOOK_TRANSITION_IN) {
      mainMenuMascotFaceState = mainMenuMascotFaceLookTarget;
      mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.LOOK;
      mainMenuMascotFaceEventEndsAt = now + getMainMenuMascotFaceVisualRange(
        random,
        SLIME_FACE_LOOK_DURATION_MIN,
        SLIME_FACE_LOOK_DURATION_MAX
      );
      return;
    }

    if (mainMenuMascotFacePhase === SLIME_FACE_IDLE_PHASES.LOOK) {
      mainMenuMascotFaceState = SLIME_FACE_STATES.BLINK;
      mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.LOOK_TRANSITION_OUT;
      mainMenuMascotFaceEventEndsAt = now + getMainMenuMascotFaceVisualRange(
        random,
        SLIME_FACE_TRANSITION_BLINK_DURATION_MIN,
        SLIME_FACE_TRANSITION_BLINK_DURATION_MAX
      );
      return;
    }

    mainMenuMascotFaceState = SLIME_FACE_STATES.NORMAL;
    mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.NONE;
    mainMenuMascotFaceLookTarget = SLIME_FACE_STATES.NORMAL;
    mainMenuMascotFaceEventEndsAt = 0;
    scheduleNextMainMenuMascotFaceEvent(now, random);
  }

  function updateMainMenuMascotFaceAnimation(
    timestamp,
    random = nextMainMenuMascotFaceVisualRandom
  ) {
    if (typeof updateMenuBiomeBackground === "function") {
      updateMenuBiomeBackground(timestamp);
    }
    if (!isMainMenuMascotFaceAnimationVisible()) {
      if (mainMenuMascotFaceAnimationActive) resetMainMenuMascotFaceAnimation();
      return false;
    }

    const now = Math.max(0, Number(timestamp) || 0) / 1000;
    if (!mainMenuMascotFaceAnimationActive) {
      mainMenuMascotFaceAnimationActive = true;
      mainMenuMascotFaceState = SLIME_FACE_STATES.NORMAL;
      mainMenuMascotFacePhase = SLIME_FACE_IDLE_PHASES.NONE;
      mainMenuMascotFaceLookTarget = SLIME_FACE_STATES.NORMAL;
      scheduleNextMainMenuMascotFaceEvent(now, random);
      renderMenuMascot();
      return true;
    }

    if (mainMenuMascotFacePhase !== SLIME_FACE_IDLE_PHASES.NONE) {
      if (now < mainMenuMascotFaceEventEndsAt) return false;
      advanceMainMenuMascotFaceEvent(now, random);
      renderMenuMascot();
      return true;
    }

    if (now < mainMenuMascotNextFaceEventAt) return false;
    beginMainMenuMascotFaceEvent(now, random);
    renderMenuMascot();
    return true;
  }

  function renderMenuMascot() {
    if (!ui.menuMascot) return;
    const cosmetic = getActiveSlimeCosmetic();
    const beard = getActiveSlimeBeard();
    const prestigePreviewOptions = getSelectedPrestigeSlimePreviewOptions(30, 20);
    const hasPrestigeAura = prestigePreviewOptions.prestigeAura !== "none";
    const goldAppearance = window.SlimeGold?.getEquippedAppearance?.() ?? {
      slime: false,
      hatId: null,
      beardId: null
    };
    const definition = getSlimeCosmeticDefinition(cosmetic);
    const isHat = definition?.type === "hat";
    const isBow = cosmetic === "bow";
    const basePreviewLayout = isHat
      ? {centerY: 128, scale: 1.35}
      : isBow
        ? {centerY: 96, scale: 1.7}
        : {centerY: 95, scale: 2};
    const previewLayout = hasPrestigeAura
      ? isHat
        ? {centerY: 105, scale: 1.08}
        : {centerY: 85, scale: 1.5}
      : basePreviewLayout;
    ui.menuMascot.classList.toggle("menuMascot--prestigeAura", hasPrestigeAura);
    if (hasPrestigeAura) {
      ui.menuMascot.style.setProperty(
        "--menu-mascot-aura-visual-scale",
        String(basePreviewLayout.scale / previewLayout.scale)
      );
    } else {
      ui.menuMascot.style.removeProperty("--menu-mascot-aura-visual-scale");
    }
    drawSlimeCharacterPreview(
      ui.menuMascot,
      cosmetic,
      beard,
      getActiveSlimeColor(),
      {
        ...previewLayout,
        ...prestigePreviewOptions,
        faceState: mainMenuMascotFaceState,
        goldSlime: goldAppearance.slime,
        goldCosmetic: goldAppearance.hatId === cosmetic,
        goldBeard: goldAppearance.beardId === beard
      }
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
    ui.menuPrestigeBtn.classList.toggle("prestigeInvisible", !hasEmblem);
    ui.menuPrestigeBtn.classList.toggle(
      "prestigeReady",
      (isReady && !isMastered) || Boolean(pendingPermanentChoice)
    );
    ui.menuPrestigeBtn.classList.toggle("prestigeMastered", isMastered);
    ui.menuPrestigeBtn.classList.remove("prestigeZeroReady");
    ui.menuPrestigeBtn.disabled = transactionPending || !hasEmblem;

    if (ui.menuPrestigeEmblem) {
      ui.menuPrestigeEmblem.innerHTML = hasEmblem
        ? prestige.getEmblemMarkup(prestigeLevel)
        : "";
    }

    if (ui.menuPrestigeLabel) ui.menuPrestigeLabel.textContent = "";
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

    [ui.menuPlayerLevel, ui.menuXPPlayerLevel].forEach(levelDisplay => {
      if (!levelDisplay) return;
      levelDisplay.textContent = `#${progress.level}`;
      levelDisplay.setAttribute("aria-label", `Spielerlevel ${progress.level}`);
    });

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

  function renderPersonalGlobalRank(rank) {
    if (!ui.personalGlobalRankValue) return;
    const numericRank = Number(rank);
    ui.personalGlobalRankValue.textContent =
      Number.isSafeInteger(numericRank) && numericRank > 0
        ? numericRank.toLocaleString("de-DE")
        : "—";
  }

  function bootstrapLocalGlobalBest() {
    if (globalBestBootstrapPromise) return globalBestBootstrapPromise;
    const playerBests = window.SlimeJumpPlayerBests;

    if (typeof playerBests?.syncLocalGlobalBest !== "function") {
      globalBestBootstrapPromise = Promise.resolve(null);
      return globalBestBootstrapPromise;
    }

    try {
      globalBestBootstrapPromise = Promise.resolve(
        playerBests.syncLocalGlobalBest()
      ).catch(() => null);
    } catch (_) {
      globalBestBootstrapPromise = Promise.resolve(null);
    }

    const activeBootstrapPromise = globalBestBootstrapPromise;
    void activeBootstrapPromise.then(result => {
      if (result === null && globalBestBootstrapPromise === activeBootstrapPromise) {
        globalBestBootstrapPromise = null;
      }
    });
    return activeBootstrapPromise;
  }

  async function updatePersonalGlobalRank({syncGlobalBest = true} = {}) {
    const requestId = ++personalGlobalRankRequestId;
    renderPersonalGlobalRank(null);
    if (syncGlobalBest) void bootstrapLocalGlobalBest();

    const playerBests = window.SlimeJumpPlayerBests;
    if (typeof playerBests?.getPersonalGlobalRank !== "function") return;

    try {
      const result = await playerBests.getPersonalGlobalRank();
      if (requestId !== personalGlobalRankRequestId) return;
      renderPersonalGlobalRank(result?.rank);
    } catch (_) {
      if (requestId === personalGlobalRankRequestId) {
        renderPersonalGlobalRank(null);
      }
    }
  }

  function isMainMenuVisible() {
    return Boolean(
      ui.menu &&
      ui.mainMenuScreen &&
      !ui.menu.classList.contains("hidden") &&
      !ui.mainMenuScreen.classList.contains("hidden")
    );
  }

  function refreshPersonalGlobalRankIfMainMenuVisible(options) {
    if (!isMainMenuVisible()) return false;
    void updatePersonalGlobalRank(options);
    return true;
  }

  window.addEventListener?.("slimeglobalbestsubmitsettled", () => {
    refreshPersonalGlobalRankIfMainMenuVisible({syncGlobalBest: false});
  });

  globalThis.document?.addEventListener?.("visibilitychange", () => {
    if (globalThis.document?.visibilityState !== "visible") return;
    refreshPersonalGlobalRankIfMainMenuVisible();
  });

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

  function getPrestigeRewardCatalogByType(prestige, type) {
    return prestige.definitions.flatMap(definition =>
      (definition.rewards ?? (definition.reward ? [definition.reward] : []))
        .filter(reward => reward.type === type)
        .map(reward => ({
          ...reward,
          requiredPrestige: definition.level
        }))
    );
  }

  function createPrestigeWardrobeOption(type, reward, selectedId, prestigeLevel) {
    const requiredPrestige = Math.max(0, Number(reward.requiredPrestige) || 0);
    const unlocked = reward.id === "none" || requiredPrestige <= prestigeLevel;
    const selected = unlocked && reward.id === selectedId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption prestigeWardrobeOption";
    button.dataset.rewardId = reward.id;
    button.dataset.requiredPrestige = String(requiredPrestige);
    button.dataset.unlocked = String(unlocked);
    button.classList.toggle("selected", selected);
    button.classList.toggle("locked", !unlocked);
    button.disabled = !unlocked;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${reward.displayName} auswählen`
        : `${reward.displayName} gesperrt, Prestige ${requiredPrestige} erforderlich`
    );
    button.appendChild(createPrestigeRewardPreview(type, reward));
    if (reward.id !== "none" && type !== "title") {
      const label = document.createElement("span");
      label.className = "slimeColorLabel prestigeRewardName";
      label.textContent = reward.displayName;
      button.appendChild(label);
    }
    const requirement = document.createElement("small");
    requirement.className = "prestigeRewardRequirement";
    requirement.textContent = reward.id === "none"
      ? "STANDARD"
      : unlocked
        ? `FREIGESCHALTET · P${requiredPrestige}`
        : `PRESTIGE ${requiredPrestige} ERFORDERLICH`;
    button.appendChild(requirement);
    if (!unlocked) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock prestigeRewardLock";
      lock.textContent = "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    } else {
      button.addEventListener("click", () => {
        selectPrestigeReward(type, reward.id);
      });
    }
    return button;
  }

  function renderWardrobePrestigePicker() {
    const prestige = window.SlimePrestige;
    if (!prestige || !ui.wardrobePrestigeOptions) return;
    const prestigeLevel = prestige.getLevel();
    if (ui.wardrobePrestigeEmblem) {
      ui.wardrobePrestigeEmblem.innerHTML = prestigeLevel > 0
        ? prestige.getEmblemMarkup(prestigeLevel)
        : "";
    }
    if (ui.wardrobePrestigeLevel) {
      ui.wardrobePrestigeLevel.textContent = prestigeLevel > 0
        ? `PRESTIGE-STUFE ${prestigeLevel}`
        : "NOCH KEIN PRESTIGE";
    }
    if (ui.wardrobePrestigeActivateBtn) {
      const transactionPending = prestige.isTransactionPending();
      const pendingPermanentChoice = prestige.getPendingPermanentWardrobeChoice?.();
      const mastered = prestige.isMastered();
      const ready = prestige.isReady() && !mastered &&
        !transactionPending && !pendingPermanentChoice;
      ui.wardrobePrestigeActivateBtn.disabled = !ready;
      ui.wardrobePrestigeActivateBtn.textContent = transactionPending
        ? "RESET AUSSTEHEND"
        : pendingPermanentChoice
          ? "PERMANENT UNLOCK WÄHLEN"
          : mastered
            ? "PRESTIGE ABGESCHLOSSEN"
            : ready
              ? "PRESTIGE AKTIVIEREN"
              : "PRESTIGE NICHT BEREIT";
    }
    ui.wardrobePrestigeCategories?.querySelectorAll("[data-prestige-category]")
      .forEach(button => {
        const active = button.dataset.prestigeCategory === prestigeWardrobeCategory;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });

    const selectedId = prestige.getSelectedReward(prestigeWardrobeCategory);
    const rewards = getPrestigeRewardCatalogByType(
      prestige,
      prestigeWardrobeCategory
    );
    const options = [
      {id: "none", displayName: "NONE", requiredPrestige: 0},
      ...rewards
    ];
    ui.wardrobePrestigeOptions.replaceChildren(
      ...options.map(reward => createPrestigeWardrobeOption(
        prestigeWardrobeCategory,
        reward,
        selectedId,
        prestigeLevel
      ))
    );
  }

  function renderPrestigeCustomization() {
    const prestige = window.SlimePrestige;
    if (!prestige) return;
    const prestigeLevel = prestige.getLevel();
    if (ui.prestigeCustomizationEmblem) {
      ui.prestigeCustomizationEmblem.innerHTML = prestigeLevel > 0
        ? prestige.getEmblemMarkup(prestigeLevel)
        : "";
    }
    if (ui.prestigeCustomizationLevel) {
      ui.prestigeCustomizationLevel.textContent =
        `${prestigeLevel > 0 ? `PRESTIGE-STUFE ${prestigeLevel}` : "NOCH KEIN PRESTIGE"} · AKTUELLES PRESTIGE`;
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
    if (!ui.wardrobeScreen || !ui.wardrobePrestigeView) return false;
    showMenuScreen("wardrobe");
    showWardrobeView("prestige");
    window.requestAnimationFrame(() =>
      ui.wardrobePrestigeCategories
        ?.querySelector("[data-prestige-category].active")
        ?.focus()
    );
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
      `P${pendingChoice.prestigeLevel}: Wähle genau ein normales Garderoben-Item, das alle künftigen Prestige-Resets übersteht.`;
    const categories = [
      {id: "color", label: "🎨 FARBE"},
      {id: "cosmetic", label: "🎩 HÜTE"},
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
    renderMenuMascot();
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
      `${itemName} mit einer freien Garderoben-Auswahl freischalten`
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
            ? `${SLIME_COLOR_NAMES[color]} als Garderoben-Item freischalten`
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
        window.SlimeGold?.useNormalAppearance?.("slime");
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

  function renderSlimeColorPicker() {
    if (!ui.slimeColorOptions) return;
    const options = SLIME_COLOR_ORDER.map(color => createSlimeColorOption(color));
    if (window.SlimeGold) options.unshift(createGoldSlimeColorOption());
    ui.slimeColorOptions.replaceChildren(...options);
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
      getActiveSlimeColor(),
      {
        ...getSelectedPrestigeSlimePreviewOptions(),
        goldSlime: window.SlimeGold?.getEquippedAppearance?.().slime === true,
        goldBeard:
          window.SlimeGold?.getEquippedAppearance?.().beardId === getActiveSlimeBeard()
      }
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
            ? `${definition.name} als Garderoben-Item freischalten`
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
        window.SlimeGold?.useNormalAppearance?.("hat");
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
      getActiveSlimeColor(),
      {
        ...getSelectedPrestigeSlimePreviewOptions(),
        goldSlime: window.SlimeGold?.getEquippedAppearance?.().slime === true,
        goldCosmetic:
          window.SlimeGold?.getEquippedAppearance?.().hatId === getActiveSlimeCosmetic()
      }
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
            ? `${definition.name} als Garderoben-Item freischalten`
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
        window.SlimeGold?.useNormalAppearance?.("beard");
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
    ui.slimeBeardOptions.replaceChildren(
      ...SLIME_BEARD_ORDER.map(beard => createSlimeBeardOption(beard))
    );
  }

  function applyGoldPaletteCss(element) {
    const palette = window.SlimeGold?.getSlimePalette?.();
    if (!palette) return;
    element.style.setProperty("--slime-light", palette.light);
    element.style.setProperty("--slime-main", palette.main);
    element.style.setProperty("--slime-dark", palette.dark);
    element.style.setProperty("--slime-outline", palette.outline);
    element.style.setProperty("--slime-glow", palette.glow);
    element.style.setProperty("--slime-face", palette.face);
  }

  function renderGoldProgressCard(element, title, completedLevels, distinctCount, distinctLabel, mastery) {
    if (!element) return;
    const heading = document.createElement("strong");
    heading.textContent = title;
    const levels = document.createElement("span");
    levels.textContent = `Level: ${Math.min(500, completedLevels)} / 500`;
    const distinct = document.createElement("span");
    distinct.textContent = `${distinctLabel}: ${Math.min(5, distinctCount)} / 5`;
    const status = document.createElement("small");
    status.textContent = mastery ? "MASTERY FREIGESCHALTET" : "MASTERY GESPERRT";
    element.classList.toggle("mastered", mastery);
    element.replaceChildren(heading, levels, distinct, status);
  }

  function renderGoldWardrobeStatus() {
    const gold = window.SlimeGold;
    if (!gold) return;
    const progress = gold.getProgress();
    const realShopUnlocked = gold.isGoldShopUnlocked();
    const shopAccessible = gold.isGoldShopAccessible();
    const devShop = DEV_MODE && gold.getDevState().shopUnlocked;

    ui.goldShopStatusText.textContent = realShopUnlocked
      ? "GOLD-SHOP FREIGESCHALTET"
      : devShop
        ? "GOLD-SHOP TEST FREIGESCHALTET"
        : "GOLD-SHOP GESPERRT";
    ui.goldShopStatusText.classList.toggle("unlocked", shopAccessible);
    ui.goldShopStatusHint.textContent = shopAccessible
      ? "Gold-Hüte und Gold-Bärte: einzeln kaufen ODER per Herausforderung kostenlos freischalten."
      : "Schalte den Gold-Slime frei: 500 Level + 5 Farben ODER 5.000 Sterne.";

    renderGoldProgressCard(
      ui.goldHatProgress,
      "GOLD-HÜTE",
      progress.hats.completedLevels,
      progress.hats.distinctHatIds.length,
      "Hüte",
      progress.hats.masteryUnlocked
    );
    renderGoldProgressCard(
      ui.goldBeardProgress,
      "GOLD-BÄRTE",
      progress.beards.completedLevels,
      progress.beards.distinctBeardIds.length,
      "Bärte",
      progress.beards.masteryUnlocked
    );
  }

  function renderGoldCategoryUnlockInfo() {
    if (!ui.goldCategoryUnlockInfo || !window.SlimeGold) return;
    const progress = window.SlimeGold.getProgress();
    const hats = goldWardrobeCategory === "hats";
    const categoryProgress = hats ? progress.hats : progress.beards;
    const distinctCount = hats
      ? categoryProgress.distinctHatIds.length
      : categoryProgress.distinctBeardIds.length;
    const itemLabel = hats ? "HUT" : "BART";
    const categoryName = hats ? "Gold-Hüte" : "Gold-Bärte";

    const paths = document.createElement("strong");
    paths.textContent = `KAUF: 1.000 ⭐ PRO ${itemLabel} · ODER HERAUSFORDERUNG`;
    const criteria = document.createElement("span");
    criteria.textContent = hats
      ? `Level mit Hut: ${categoryProgress.completedLevels} / 500 · Verschiedene Hüte: ${Math.min(5, distinctCount)} / 5`
      : `Level mit Bart: ${categoryProgress.completedLevels} / 500 · Verschiedene Bärte: ${Math.min(5, distinctCount)} / 5`;
    const reward = document.createElement("small");
    reward.textContent = `Bei Abschluss werden alle ${categoryName} kostenlos freigeschaltet.`;
    ui.goldCategoryUnlockInfo.classList.toggle(
      "mastered",
      categoryProgress.masteryUnlocked
    );
    ui.goldCategoryUnlockInfo.replaceChildren(paths, criteria, reward);
  }

  function getGoldItemName(category, itemId) {
    if (category === "slime") return "Gold-Slime";
    if (category === "hat") {
      return `Gold-${getSlimeCosmeticDefinition(itemId)?.name ?? itemId}`;
    }
    return `Gold-${getSlimeBeardDefinition(itemId)?.name ?? itemId}`;
  }

  function isGoldItemAvailable(category, itemId) {
    const gold = window.SlimeGold;
    if (category === "slime") return gold?.canUseGoldSlime?.() === true;
    if (category === "hat") return gold?.canUseGoldHat?.(itemId) === true;
    return gold?.canUseGoldBeard?.(itemId) === true;
  }

  function isGoldItemSelected(category, itemId) {
    const appearance = window.SlimeGold?.getEquippedAppearance?.() ?? {};
    if (category === "slime") return appearance.slime === true;
    if (category === "hat") return appearance.hatId === itemId;
    return appearance.beardId === itemId;
  }

  function createGoldItemPreview(category, itemId) {
    const preview = document.createElement("canvas");
    preview.className = "slimeCosmeticPreview goldItemPreview";
    preview.width = 88;
    preview.height = 70;
    preview.setAttribute("aria-hidden", "true");
    const appearance = window.SlimeGold?.getEquippedAppearance?.() ?? {
      slime: false,
      hatId: null,
      beardId: null
    };
    const cosmetic = category === "hat" ? itemId : getActiveSlimeCosmetic();
    const beard = category === "beard" ? itemId : getActiveSlimeBeard();
    drawSlimeCharacterPreview(
      preview,
      cosmetic,
      beard,
      getActiveSlimeColor(),
      {
        ...getSelectedPrestigeSlimePreviewOptions(),
        goldSlime: category === "slime" || appearance.slime,
        goldCosmetic: category === "hat" || appearance.hatId === cosmetic,
        goldBeard: category === "beard" || appearance.beardId === beard
      }
    );
    return preview;
  }

  function createGoldSlimeColorOption() {
    const gold = window.SlimeGold;
    const progress = gold.getProgress().slime;
    const owned = gold.ownsGoldSlime();
    const available = gold.canUseGoldSlime();
    const selected = gold.getEquippedAppearance().slime === true;
    const price = gold.slimePrice ?? 5000;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption goldItemOption goldSlimeColorOption";
    button.dataset.goldCategory = "slime";
    applyGoldPaletteCss(button);
    button.classList.toggle("selected", selected);
    button.classList.toggle("locked", !available);
    button.disabled = !available;
    button.setAttribute(
      "aria-label",
      available ? "Gold-Slime auswählen" : "Gold-Slime ist gesperrt"
    );
    button.appendChild(createGoldItemPreview("slime", null));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = "GOLD-SLIME";
    button.appendChild(label);
    if (!available) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock goldItemLock";
      lock.textContent = "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (!available) return;
      devPreviewSlimeColor = null;
      if (selected) gold.useNormalAppearance("slime");
      else gold.equipGoldSlime();
      refreshGoldWardrobeViews();
    });

    const slot = document.createElement("div");
    slot.className = "wardrobePurchaseSlot goldPurchaseSlot goldSlimeColorSlot";
    const unlockPaths = document.createElement("strong");
    unlockPaths.className = "goldSlimeUnlockPaths";
    unlockPaths.textContent = owned
      ? progress.masteryUnlocked
        ? "IM BESITZ · MASTERY FREIGESCHALTET"
        : "IM BESITZ · MASTERY LÄUFT WEITER"
      : `KAUF: ${price.toLocaleString("de-DE")} ⭐ · ODER HERAUSFORDERUNG`;
    const criteria = document.createElement("span");
    criteria.className = "goldSlimeCriteria";
    criteria.textContent =
      `Level: ${progress.completedLevels} / 500 · Farben: ${Math.min(5, progress.distinctColorIds.length)} / 5`;
    const reward = document.createElement("small");
    reward.className = "goldSlimeReward";
    reward.textContent = "Gold-Slime-Besitz öffnet den Gold-Shop.";
    slot.append(button, unlockPaths, criteria, reward);

    if (!owned) {
      const buyButton = document.createElement("button");
      buyButton.type = "button";
      buyButton.className = "wardrobeBuyButton goldBuyButton goldSlimeBuyButton";
      buyButton.textContent = `KAUFEN · ${price.toLocaleString("de-DE")} ⭐`;
      buyButton.disabled = !gold.canPurchaseGoldSlime();
      buyButton.setAttribute(
        "aria-label",
        `Gold-Slime für ${price.toLocaleString("de-DE")} Sterne kaufen`
      );
      buyButton.addEventListener("click", event => {
        event.stopPropagation();
        const result = gold.purchaseGoldSlime();
        if (!result?.ok) return;
        showGameToast(result.test
          ? `🧪 Gold-Slime testweise für ${price.toLocaleString("de-DE")} Sterne gekauft!`
          : `⭐ Gold-Slime für ${price.toLocaleString("de-DE")} Sterne gekauft!`);
        refreshGoldWardrobeViews();
      });
      slot.appendChild(buyButton);
    }
    return slot;
  }

  function refreshGoldWardrobeViews() {
    renderGoldWardrobe();
    renderSlimeColorPicker();
    renderSlimeCosmeticPicker();
    renderSlimeBeardPicker();
    renderMenuMascot();
    renderMainMenuStats();
    updateDevGoldControls();
  }

  function createGoldPurchaseSlot(category, itemId, itemName, optionButton) {
    const gold = window.SlimeGold;
    const price = gold?.itemPrice ?? 1000;
    const slot = document.createElement("div");
    slot.className = "wardrobePurchaseSlot goldPurchaseSlot";
    const requirement = document.createElement("span");
    requirement.className = "wardrobePurchaseRequirement";
    requirement.textContent = gold?.isGoldShopAccessible?.()
      ? "Einzelkauf · oder Mastery"
      : "Gold-Slime öffnet den Shop";

    const buyButton = document.createElement("button");
    buyButton.type = "button";
    buyButton.className = "wardrobeBuyButton goldBuyButton";
    buyButton.textContent = `KAUFEN · ${price.toLocaleString("de-DE")} ⭐`;
    buyButton.disabled = !gold?.canPurchaseGoldItem?.(category, itemId);
    buyButton.setAttribute(
      "aria-label",
      `${itemName} für ${price.toLocaleString("de-DE")} Sterne kaufen`
    );
    buyButton.addEventListener("click", event => {
      event.stopPropagation();
      const result = gold?.purchaseGoldItem?.(category, itemId);
      if (!result?.ok) return;
      showGameToast(result.test
        ? `🧪 ${itemName} testweise für ${price.toLocaleString("de-DE")} Sterne gekauft!`
        : `⭐ ${itemName} für ${price.toLocaleString("de-DE")} Sterne gekauft!`);
      refreshGoldWardrobeViews();
    });

    slot.append(optionButton, requirement, buyButton);
    return slot;
  }

  function createGoldItemOption(category, itemId = null) {
    const gold = window.SlimeGold;
    const itemName = getGoldItemName(category, itemId);
    const available = isGoldItemAvailable(category, itemId);
    const selected = isGoldItemSelected(category, itemId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slimeColorOption goldItemOption";
    button.dataset.goldCategory = category;
    if (itemId) button.dataset.goldItemId = itemId;
    applyGoldPaletteCss(button);
    button.classList.toggle("selected", selected);
    button.classList.toggle("locked", !available);
    button.disabled = !available;
    button.setAttribute(
      "aria-label",
      available ? `${itemName} auswählen` : `${itemName} ist gesperrt`
    );
    button.appendChild(createGoldItemPreview(category, itemId));

    const label = document.createElement("span");
    label.className = "slimeColorLabel";
    label.textContent = itemName;
    button.appendChild(label);

    if (!available) {
      const lock = document.createElement("span");
      lock.className = "slimeColorLock goldItemLock";
      lock.textContent = "🔒";
      lock.setAttribute("aria-hidden", "true");
      button.appendChild(lock);
    }

    button.addEventListener("click", () => {
      if (!available) return;
      devPreviewSlimeColor = null;
      devPreviewSlimeCosmetic = null;
      devPreviewSlimeBeard = null;
      if (selected) {
        window.SlimeGold?.useNormalAppearance?.(category);
      } else if (category === "slime") {
        window.SlimeGold?.equipGoldSlime?.();
      } else if (category === "hat") {
        window.SlimeGold?.equipGoldHat?.(itemId);
      } else {
        window.SlimeGold?.equipGoldBeard?.(itemId);
      }
      refreshGoldWardrobeViews();
    });

    return available
      ? button
      : createGoldPurchaseSlot(category, itemId, itemName, button);
  }

  function renderGoldWardrobeOptions() {
    if (!ui.goldWardrobeOptions || !window.SlimeGold) return;
    const options = goldWardrobeCategory === "hats"
      ? window.SlimeGold.getGoldHatIds().map(id => createGoldItemOption("hat", id))
      : window.SlimeGold.getGoldBeardIds().map(id => createGoldItemOption("beard", id));
    ui.goldWardrobeOptions.replaceChildren(...options);
  }

  function renderGoldWardrobe() {
    if (!window.SlimeGold || !ui.goldWardrobeOptions) return;
    renderGoldWardrobeStatus();
    renderGoldCategoryUnlockInfo();
    ui.goldWardrobeCategories
      ?.querySelectorAll("[data-gold-category]")
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.goldCategory === goldWardrobeCategory
        );
      });
    renderGoldWardrobeOptions();
  }

  function showWardrobeView(viewName = "home") {
    ui.wardrobeHome.classList.toggle("hidden", viewName !== "home");
    ui.wardrobeColorView.classList.toggle("hidden", viewName !== "color");
    ui.wardrobeCosmeticsView.classList.toggle("hidden", viewName !== "cosmetics");
    ui.wardrobeBeardsView.classList.toggle("hidden", viewName !== "beards");
    ui.wardrobeGoldView.classList.toggle("hidden", viewName !== "gold");
    ui.wardrobePrestigeView.classList.toggle("hidden", viewName !== "prestige");
    ui.wardrobeColorBackBtn.classList.toggle("hidden", viewName !== "color");
    ui.wardrobeCosmeticsBackBtn.classList.toggle("hidden", viewName !== "cosmetics");
    ui.wardrobeBeardsBackBtn.classList.toggle("hidden", viewName !== "beards");
    ui.wardrobeGoldBackBtn.classList.toggle("hidden", viewName !== "gold");
    ui.wardrobePrestigeBackBtn.classList.toggle("hidden", viewName !== "prestige");
    if (viewName === "color") renderSlimeColorPicker();
    if (viewName === "cosmetics") renderSlimeCosmeticPicker();
    if (viewName === "beards") renderSlimeBeardPicker();
    if (viewName === "gold") renderGoldWardrobe();
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
        createWardrobeCategoryButton("cosmetic", "🎩 HÜTE", lockedCosmetics.length === 0),
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
        ? "Wähle einen noch gesperrten Hut."
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
    showGameToast("🎁 Wähle zuerst deine freien Garderoben-Items.");
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
    const selectedCallingCardIds =
      window.SlimeAchievements?.getEffectiveBadgeIds?.() ??
      window.SlimeAchievements?.getSelectedBadgeIds?.();
    return normalizeHighScoreAchievementIds(
      Array.isArray(selectedCallingCardIds) ? selectedCallingCardIds : []
    );
  }

  function normalizeHighScoreGoldAppearance(value) {
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const normalizedHatId = typeof source.hatId === "string"
      ? normalizeSlimeCosmetic(source.hatId)
      : "none";
    const normalizedBeardId = typeof source.beardId === "string"
      ? normalizeSlimeBeard(source.beardId)
      : "none";
    return {
      slime: source.slime === true,
      hatId: normalizedHatId === "none" ? null : normalizedHatId,
      beardId: normalizedBeardId === "none" ? null : normalizedBeardId
    };
  }

  function normalizeHighScoreIdentitySnapshot(value) {
    const source = value && typeof value === "object" ? value : {};
    const nestedSnapshot = source.callingCardSnapshot ?? source.calling_card_snapshot;
    const identitySource = nestedSnapshot && typeof nestedSnapshot === "object"
      ? nestedSnapshot
      : source;
    const goldAppearance = normalizeHighScoreGoldAppearance(
      identitySource.goldAppearance ??
      identitySource.gold_appearance ??
      source.goldAppearance ??
      source.gold_appearance
    );
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
    const identity = normalized ?? {
      playerLevel: 1,
      prestigeLevel: 0,
      prestigeEmblemId: "none",
      prestigeFrame: "none",
      prestigeTitle: "none",
      prestigeAura: "none",
      prestigeTrail: "none",
      slimeAchievements: []
    };
    return {...identity, goldAppearance};
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
          goldAppearance: {...identity.goldAppearance},
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
      goldAppearance: {...identity.goldAppearance},
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

  function submitOnlineHighScore(name, finalScore, reachedLevel, identitySnapshot) {
    const playerBests = window.SlimeJumpPlayerBests;
    if (typeof playerBests?.recordGlobalBestCandidate !== "function") {
      console.info("[Highscore] COMMIT SKIPPED reason=global-ranking-unavailable");
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
      goldAppearance: {...identity.goldAppearance},
      callingCardSnapshot: {
        ...identity,
        goldAppearance: {...identity.goldAppearance}
      }
    };

    console.info(`[Highscore] NAME CONFIRMED=${submittedScore.name}`);
    lastOnlineScoreSubmit = Promise.resolve(
      playerBests.recordGlobalBestCandidate(submittedScore)
    )
      .then(result => result ? submittedScore : null)
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
      goldAppearance: {...identity.goldAppearance},
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
    const hasVisiblePrestige = entry.hasPrestigeLevelSnapshot && entry.prestigeLevel > 0;
    if (hasVisiblePrestige) {
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
      entry.prestigeTrail,
      entry.goldAppearance
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
    if (hasVisiblePrestige) {
      const emblem = document.createElement("span");
      emblem.className = "highscorePrestigeEmblem";
      emblem.dataset.prestigeEmblem = entry.prestigeEmblemId ?? "none";
      emblem.innerHTML = window.SlimePrestige?.getEmblemMarkup?.(
        entry.prestigeLevel
      ) ?? "";
      prestigeBlock.appendChild(emblem);
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

    card.append(identity, playerLevelBlock, prestigeBlock);
    card.append(callingCard, runLevel, score);
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
      !ui.perksScreen.classList.contains("hidden");
  }

  function renderPerksScreen() {
    const perks = window.SlimePerks;
    if (!perks || !ui.perkGrid || !ui.activePerkCount) return;

    const devShopTestActive = isDevShopTestActive();
    if (ui.perksSummary) {
      ui.perksSummary.classList.toggle("devPerkShopTestActive", devShopTestActive);
    }
    if (ui.perksSummaryLabel) {
      ui.perksSummaryLabel.textContent = devShopTestActive
        ? "FÄHIGKEITEN / PERKS"
        : "Aktive Fähigkeiten";
    }
    if (ui.devPerkPurchaseResetBtn) {
      ui.devPerkPurchaseResetBtn.classList.toggle("hidden", !devShopTestActive);
    }

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
          if (purchase.test) renderDevShopTestControl();
          renderPerksScreen();
          window.dispatchEvent(new CustomEvent("slimeperkschange"));
          showPerkConflictPurchaseInfo(perk.id);
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
    resetMainMenuMascotFaceAnimation();
    if (screenName === "main") {
      renderMenuMascot();
      renderMainMenuStats();
      void updatePersonalGlobalRank();
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

  function updateDevGoldControls() {
    if (!DEV_MODE || !window.SlimeGold) return;
    const dev = window.SlimeGold.getDevState();
    const controls = [
      [ui.devGoldSlimeTestBtn, dev.visualSlime],
      [ui.devGoldHatsTestBtn, dev.visualHats],
      [ui.devGoldBeardsTestBtn, dev.visualBeards],
      [ui.devGoldAllTestBtn, dev.visualSlime && dev.visualHats && dev.visualBeards],
      [ui.devGoldShopTestBtn, dev.shopUnlocked]
    ];
    controls.forEach(([button, active]) => {
      button?.setAttribute("aria-pressed", String(active));
    });
    if (ui.devGoldShopTestBtn) {
      ui.devGoldShopTestBtn.textContent = dev.shopUnlocked
        ? `GOLD-SHOP TEST · ${dev.balance.toLocaleString("de-DE")} ⭐`
        : "GOLD-SHOP TEST";
    }
  }

  function toggleDevGoldVisual(category) {
    if (!DEV_MODE || !window.SlimeGold) return;
    const dev = window.SlimeGold.getDevState();
    const active = category === "slime"
      ? dev.visualSlime
      : category === "hats"
        ? dev.visualHats
        : dev.visualBeards;
    window.SlimeGold.setDevVisualCategory(category, !active);
    refreshGoldWardrobeViews();
  }

  function toggleDevAllGoldVisuals() {
    if (!DEV_MODE || !window.SlimeGold) return;
    const dev = window.SlimeGold.getDevState();
    window.SlimeGold.setDevVisualAll(
      !(dev.visualSlime && dev.visualHats && dev.visualBeards)
    );
    refreshGoldWardrobeViews();
  }

  function toggleDevGoldShop() {
    if (!DEV_MODE || !window.SlimeGold) return;
    const dev = window.SlimeGold.getDevState();
    window.SlimeGold.setDevShopUnlocked(!dev.shopUnlocked);
    refreshGoldWardrobeViews();
  }

  function prepareDevGoldMastery(category, label) {
    if (!DEV_MODE || !window.SlimeGold?.prepareDevMasteryBoundary?.(category)) return;
    showGameToast(
      `🧪 ${label}: 499/500 und 5/5 vorbereitet. Jetzt ein passendes normales Item tragen und ein echtes Level abschließen.`,
      4200
    );
    refreshGoldWardrobeViews();
  }

  function resetDevGoldTest() {
    if (!DEV_MODE || !window.SlimeGold?.resetGoldProgressForDev?.()) return;
    devPreviewSlimeColor = null;
    devPreviewSlimeCosmetic = null;
    devPreviewSlimeBeard = null;
    showGameToast("🧪 Ausschließlich Gold-Testdaten wurden zurückgesetzt.");
    refreshGoldWardrobeViews();
  }

  ui.goldWardrobeCategories
    ?.querySelectorAll("[data-gold-category]")
    .forEach(button => {
      button.addEventListener("click", () => {
        goldWardrobeCategory = button.dataset.goldCategory;
        renderGoldWardrobe();
      });
    });

  if (DEV_MODE && ui.devShopTestBtn) {
    ui.devShopTestBtn.addEventListener("click", toggleDevShopTest);
    ui.devPerkPurchaseResetBtn?.addEventListener(
      "click",
      resetDevPerkPurchaseTest
    );
    renderDevShopTestControl();
  }

  if (DEV_MODE) {
    ui.devGoldSlimeTestBtn?.addEventListener("click", () => toggleDevGoldVisual("slime"));
    ui.devGoldHatsTestBtn?.addEventListener("click", () => toggleDevGoldVisual("hats"));
    ui.devGoldBeardsTestBtn?.addEventListener("click", () => toggleDevGoldVisual("beards"));
    ui.devGoldAllTestBtn?.addEventListener("click", toggleDevAllGoldVisuals);
    ui.devGoldShopTestBtn?.addEventListener("click", toggleDevGoldShop);
    ui.devGoldSlimeBoundaryBtn?.addEventListener(
      "click",
      () => prepareDevGoldMastery("slime", "Gold-Slime")
    );
    ui.devGoldHatBoundaryBtn?.addEventListener(
      "click",
      () => prepareDevGoldMastery("hats", "Gold-Hüte")
    );
    ui.devGoldBeardBoundaryBtn?.addEventListener(
      "click",
      () => prepareDevGoldMastery("beards", "Gold-Bärte")
    );
    ui.devGoldResetBtn?.addEventListener("click", resetDevGoldTest);
    updateDevGoldControls();
    document.getElementById("devCallingCardTestBtn")
      ?.addEventListener("click", showDevCallingCardTest);
    ui.devUpdateScreenTestBtn
      ?.addEventListener("click", () => showUpdateScreen(TEST_UPDATE_DATA));
  }

  ui.updateOpenStoreBtn?.addEventListener("click", openUpdateStorePage);
  ui.updateLaterBtn?.addEventListener("click", closeUpdateScreen);
  ui.mainMenuOnboardingBackBtn?.addEventListener(
    "click",
    showPreviousMainMenuOnboardingStep
  );
  ui.mainMenuOnboardingNextBtn?.addEventListener(
    "click",
    showNextMainMenuOnboardingStep
  );
  ui.mainMenuOnboardingSkipBtn?.addEventListener(
    "click",
    showMainMenuOnboardingDecision
  );
  ui.mainMenuOnboardingLaterBtn?.addEventListener(
    "click",
    postponeMainMenuOnboarding
  );
  ui.mainMenuOnboardingNeverBtn?.addEventListener(
    "click",
    dismissMainMenuOnboardingPermanently
  );
  ui.mainMenuOnboardingOverlay?.addEventListener(
    "keydown",
    handleMainMenuOnboardingKeydown
  );
  window.addEventListener("resize", scheduleMainMenuOnboardingLayout, {passive: true});
  window.addEventListener("orientationchange", scheduleMainMenuOnboardingLayout, {
    passive: true
  });
  window.visualViewport?.addEventListener(
    "resize",
    scheduleMainMenuOnboardingLayout,
    {passive: true}
  );
  ui.perkConflictPurchaseInfoConfirmBtn?.addEventListener(
    "click",
    closePerkConflictPurchaseInfo
  );
  ui.goldShopIntroConfirmBtn?.addEventListener("click", confirmGoldShopIntro);

  if (shouldShowUpdateScreenFromLocalTestUrl()) {
    showUpdateScreen(TEST_UPDATE_DATA);
  }

