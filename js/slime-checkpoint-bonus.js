(() => {
  "use strict";

  const STORAGE_KEY = "slimejumperCheckpointBonusV1";
  const STATE_VERSION = 1;
  const GOLD_GATE_CHANCE = 0.001;
  const SPIN_STEP_MS = 70;
  const AUTO_STOP_MS = 5000;
  const DECELERATION_MS = 2350;
  const DECELERATION_MIN_STEPS = 14;
  const MAX_LIVES = 5;
  const REWARD_IDS = Object.freeze([
    "stars_100",
    "life_refill",
    "stars_500",
    "color_voucher",
    "hat_voucher",
    "beard_voucher",
    "gold_slime"
  ]);
  const VOUCHER_REWARD_IDS = Object.freeze([
    "color_voucher", "hat_voucher", "beard_voucher"
  ]);
  const REWARDS = Object.freeze({
    stars_100: Object.freeze({
      id: "stars_100", baseWeight: 45, icon: "⭐", reelLabel: "100 STERNE",
      winTitle: "100 STERNE!", kind: "stars", amount: 100
    }),
    life_refill: Object.freeze({
      id: "life_refill", baseWeight: 20, icon: "❤️", reelLabel: "LEBEN",
      winTitle: "LEBEN AUFGEFÜLLT!", kind: "life"
    }),
    stars_500: Object.freeze({
      id: "stars_500", baseWeight: 10, icon: "🌟", reelLabel: "500 STERNE",
      winTitle: "500 STERNE!", kind: "stars", amount: 500
    }),
    color_voucher: Object.freeze({
      id: "color_voucher", baseWeight: 10, icon: "🎨", reelLabel: "FARBE",
      winTitle: "FARB-GUTSCHEIN!", kind: "voucher", category: "color"
    }),
    hat_voucher: Object.freeze({
      id: "hat_voucher", baseWeight: 7.45, icon: "🎩", reelLabel: "HUT",
      winTitle: "HUT-GUTSCHEIN!", kind: "voucher", category: "hat"
    }),
    beard_voucher: Object.freeze({
      id: "beard_voucher", baseWeight: 7.45, icon: "🧔", reelLabel: "BART",
      winTitle: "BART-GUTSCHEIN!", kind: "voucher", category: "beard"
    }),
    gold_slime: Object.freeze({
      id: "gold_slime", baseWeight: 0.10, icon: "🟡", reelLabel: "GOLD-SLIME",
      winTitle: "JACKPOT! GOLD-SLIME!", kind: "gold"
    })
  });
  const NORMAL_REWARD_IDS = Object.freeze(
    REWARD_IDS.filter(rewardId => rewardId !== "gold_slime")
  );

  let bonusState = null;
  let configured = false;
  let gameBridge = {};
  let runtimeMode = "closed";
  let animationFrameId = null;
  let autoStopTimerId = null;
  let visualRewardIndex = 0;
  let spinStartedAt = 0;
  let completionCallback = null;
  let listenersAttached = false;
  let devLifePreviewActive = false;
  const soundTimerIds = new Set();
  const devEligibilityOverrides = {
    fullLives: false,
    goldOwned: false,
    fullColor: false,
    fullHat: false,
    fullBeard: false
  };
  let lastDevAntiFarmingCheck = null;

  const dom = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeCheckpoint(value) {
    const level = Math.floor(Number(value));
    return Number.isSafeInteger(level) && level >= 10
      ? Math.floor(level / 10) * 10
      : 0;
  }

  function isValidTransactionId(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 160 &&
      /^[a-zA-Z0-9:._-]+$/.test(value);
  }

  function createInitialState(highestCheckpoint = 0) {
    return {
      version: STATE_VERSION,
      highestClaimedCheckpoint: normalizeCheckpoint(highestCheckpoint),
      pending: null
    };
  }

  function normalizePending(value) {
    if (!isObject(value)) return null;
    const checkpointLevel = normalizeCheckpoint(value.checkpointLevel);
    const rewardId = REWARD_IDS.includes(value.rewardId) ? value.rewardId : null;
    if (!checkpointLevel || !rewardId || !isValidTransactionId(value.transactionId)) {
      return null;
    }
    let phase = [
      "prepared", "landed", "awaiting_voucher", "payout_applied"
    ].includes(value.phase)
      ? value.phase
      : "prepared";
    if (value.phase === "spinning" || value.phase === "decelerating") {
      phase = "prepared";
    }
    const selectedVoucherItemId = typeof value.selectedVoucherItemId === "string" &&
      value.selectedVoucherItemId.length > 0
      ? value.selectedVoucherItemId
      : null;
    const payout = isObject(value.payout) && value.payout.status === "applied"
      ? clone(value.payout)
      : null;
    if (phase === "payout_applied" && !payout) phase = "landed";
    return {
      checkpointLevel,
      transactionId: value.transactionId,
      rewardId,
      phase,
      selectedVoucherItemId,
      payout
    };
  }

  function normalizeState(value) {
    const source = isObject(value) ? value : {};
    return {
      version: STATE_VERSION,
      highestClaimedCheckpoint: normalizeCheckpoint(
        source.highestClaimedCheckpoint
      ),
      pending: normalizePending(source.pending)
    };
  }

  function readStoredState() {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);
      if (rawValue === null) return {kind: "missing"};
      return {kind: "stored", state: normalizeState(JSON.parse(rawValue))};
    } catch (_) {
      return {kind: "invalid"};
    }
  }

  function persistState(nextState) {
    const normalized = normalizeState(nextState);
    const serialized = JSON.stringify(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      if (localStorage.getItem(STORAGE_KEY) !== serialized) return false;
    } catch (_) {
      return false;
    }
    bonusState = normalized;
    renderDevInspector();
    return true;
  }

  function ensureState(highestCheckpoint = 0) {
    if (bonusState) return bonusState;
    const stored = readStoredState();
    if (stored.kind === "stored") {
      bonusState = stored.state;
      persistState(bonusState);
      return bonusState;
    }
    bonusState = createInitialState(highestCheckpoint);
    persistState(bonusState);
    return bonusState;
  }

  function getLockedVoucherItems(category) {
    try {
      if (category === "color") {
        return typeof getLockedSlimeColors === "function"
          ? getLockedSlimeColors().slice()
          : [];
      }
      if (category === "hat") {
        return typeof getLockedSlimeCosmetics === "function"
          ? getLockedSlimeCosmetics().slice()
          : [];
      }
      if (category === "beard") {
        return typeof getLockedSlimeBeards === "function"
          ? getLockedSlimeBeards().slice()
          : [];
      }
    } catch (_) {}
    return [];
  }

  function getEligibility(overrides = null) {
    const requested = isObject(overrides) ? overrides : {};
    const useDevOverrides = typeof DEV_MODE !== "undefined" && DEV_MODE;
    const fullLives = requested.fullLives === true ||
      (useDevOverrides && devEligibilityOverrides.fullLives) ||
      Math.floor(Number(gameBridge.getLives?.())) >= MAX_LIVES;
    const colorCount = requested.lockedColorCount === undefined
      ? getLockedVoucherItems("color").length
      : Math.max(0, Math.floor(Number(requested.lockedColorCount) || 0));
    const hatCount = requested.lockedHatCount === undefined
      ? getLockedVoucherItems("hat").length
      : Math.max(0, Math.floor(Number(requested.lockedHatCount) || 0));
    const beardCount = requested.lockedBeardCount === undefined
      ? getLockedVoucherItems("beard").length
      : Math.max(0, Math.floor(Number(requested.lockedBeardCount) || 0));
    const goldOwned = requested.goldOwned === true ||
      (useDevOverrides && devEligibilityOverrides.goldOwned) ||
      window.SlimeGold?.ownsGoldSlime?.() === true;
    return {
      stars_100: true,
      life_refill: !fullLives,
      stars_500: true,
      color_voucher: colorCount > 0 && !(useDevOverrides && devEligibilityOverrides.fullColor),
      hat_voucher: hatCount > 0 && !(useDevOverrides && devEligibilityOverrides.fullHat),
      beard_voucher: beardCount > 0 && !(useDevOverrides && devEligibilityOverrides.fullBeard),
      gold_slime: !goldOwned,
      lockedColorCount: useDevOverrides && devEligibilityOverrides.fullColor ? 0 : colorCount,
      lockedHatCount: useDevOverrides && devEligibilityOverrides.fullHat ? 0 : hatCount,
      lockedBeardCount: useDevOverrides && devEligibilityOverrides.fullBeard ? 0 : beardCount,
      lives: fullLives ? MAX_LIVES : Math.max(0, Math.floor(Number(gameBridge.getLives?.()) || 0)),
      goldOwned
    };
  }

  function getEffectiveWeights(eligibility = getEligibility()) {
    const eligibleNormalIds = NORMAL_REWARD_IDS.filter(
      rewardId => eligibility[rewardId] === true
    );
    const normalWeightTotal = eligibleNormalIds.reduce(
      (sum, rewardId) => sum + REWARDS[rewardId].baseWeight,
      0
    );
    const normalProbability = eligibility.gold_slime ? 1 - GOLD_GATE_CHANCE : 1;
    const weights = {};
    for (const rewardId of REWARD_IDS) weights[rewardId] = 0;
    for (const rewardId of eligibleNormalIds) {
      weights[rewardId] = normalWeightTotal > 0
        ? REWARDS[rewardId].baseWeight / normalWeightTotal * normalProbability
        : 0;
    }
    weights.gold_slime = eligibility.gold_slime ? GOLD_GATE_CHANCE : 0;
    return weights;
  }

  function normalizedRandom(random) {
    const value = Number(random());
    if (!Number.isFinite(value)) return 0;
    return Math.min(1 - Number.EPSILON, Math.max(0, value));
  }

  function selectReward(eligibility = getEligibility(), random = Math.random) {
    if (typeof random !== "function") throw new TypeError("random must be a function");
    if (eligibility.gold_slime === true && normalizedRandom(random) < GOLD_GATE_CHANCE) {
      return "gold_slime";
    }
    const eligibleNormalIds = NORMAL_REWARD_IDS.filter(
      rewardId => eligibility[rewardId] === true
    );
    const weightTotal = eligibleNormalIds.reduce(
      (sum, rewardId) => sum + REWARDS[rewardId].baseWeight,
      0
    );
    const roll = normalizedRandom(random) * weightTotal;
    let cumulative = 0;
    for (const rewardId of eligibleNormalIds) {
      cumulative += REWARDS[rewardId].baseWeight;
      if (roll < cumulative) return rewardId;
    }
    return eligibleNormalIds.at(-1) ?? "stars_100";
  }

  function getPrestigeCycleId() {
    return Math.max(0, Math.floor(Number(window.SlimePrestige?.getLevel?.()) || 0));
  }

  function createTransactionId(checkpointLevel, {dev = false} = {}) {
    const suffix = dev ? `:dev${Date.now()}${Math.floor(Math.random() * 1000000)}` : "";
    return `checkpoint_bonus:p${getPrestigeCycleId()}:cp${checkpointLevel}${suffix}`;
  }

  function prepareCheckpoint(checkpointLevel, {
    forcedRewardId = null,
    random = Math.random,
    dev = false
  } = {}) {
    const checkpoint = normalizeCheckpoint(checkpointLevel);
    ensureState(gameBridge.getHighestCheckpoint?.() ?? 0);
    if (!checkpoint || bonusState.pending) return null;
    if (checkpoint <= bonusState.highestClaimedCheckpoint) return null;
    const forced = dev && REWARD_IDS.includes(forcedRewardId)
      ? forcedRewardId
      : null;
    const rewardId = forced ?? selectReward(getEligibility(), random);
    const nextState = clone(bonusState);
    nextState.pending = {
      checkpointLevel: checkpoint,
      transactionId: createTransactionId(checkpoint, {dev}),
      rewardId,
      phase: "prepared",
      selectedVoucherItemId: null,
      payout: null
    };
    if (!persistState(nextState)) return null;
    window.SlimeAchievements?.setPopupsPaused?.(true);
    return clone(bonusState.pending);
  }

  function recoverMissingCheckpoint(highestCheckpoint) {
    const highest = normalizeCheckpoint(highestCheckpoint);
    ensureState(highest);
    if (bonusState.pending || highest <= bonusState.highestClaimedCheckpoint) {
      return bonusState.pending ? clone(bonusState.pending) : null;
    }
    return prepareCheckpoint(highest);
  }

  function setPendingPhase(phase, extra = {}) {
    if (!bonusState?.pending) return false;
    const nextState = clone(bonusState);
    nextState.pending = {...nextState.pending, ...extra, phase};
    return persistState(nextState);
  }

  function fallbackVoucherToStars() {
    if (!bonusState?.pending || !VOUCHER_REWARD_IDS.includes(bonusState.pending.rewardId)) {
      return false;
    }
    const nextState = clone(bonusState);
    nextState.pending.rewardId = "stars_100";
    nextState.pending.phase = "landed";
    nextState.pending.selectedVoucherItemId = null;
    nextState.pending.payout = null;
    if (!persistState(nextState)) return false;
    return applyPendingPayout().ok === true;
  }

  function applyPendingPayout() {
    const pending = bonusState?.pending;
    if (!pending) return {ok: false, reason: "no-pending"};
    if (pending.phase === "payout_applied") {
      return {ok: true, duplicate: true, payout: clone(pending.payout)};
    }
    const reward = REWARDS[pending.rewardId];
    if (!reward) return {ok: false, reason: "invalid-reward"};
    let result;
    if (reward.kind === "stars") {
      result = window.SlimeStarEconomy?.awardStars?.(reward.amount, {
        transactionId: pending.transactionId,
        source: "checkpoint_bonus"
      }) ?? {ok: false, reason: "economy-unavailable"};
    } else if (reward.kind === "gold") {
      result = window.SlimeGold?.grantGoldSlimeFromCheckpointBonus?.({
        transactionId: pending.transactionId
      }) ?? {ok: false, reason: "gold-unavailable"};
      if (result.ok) window.SlimeAchievements?.checkState?.();
    } else if (reward.kind === "life") {
      const devPreviewCanApply = typeof DEV_MODE !== "undefined" &&
        DEV_MODE && devLifePreviewActive;
      if (gameBridge.isRunAvailable?.() !== true && !devPreviewCanApply) {
        return {ok: false, deferred: true, reason: "run-required"};
      }
      gameBridge.setLives?.(MAX_LIVES);
      gameBridge.updateHUD?.();
      result = {ok: Number(gameBridge.getLives?.()) === MAX_LIVES, lives: MAX_LIVES};
    } else {
      return {ok: false, reason: "voucher-selection-required"};
    }
    if (!result?.ok) return result ?? {ok: false, reason: "payout-failed"};
    const payout = {
      status: "applied",
      rewardId: reward.id,
      appliedAt: Date.now()
    };
    if (!setPendingPhase("payout_applied", {payout})) {
      return {ok: false, reason: "claim-storage-error", payoutApplied: true};
    }
    return {ok: true, duplicate: result.duplicate === true, payout: clone(payout)};
  }

  function isVoucherItemUnlocked(category, itemId) {
    if (category === "color") return typeof isSlimeColorUnlocked === "function" &&
      isSlimeColorUnlocked(itemId);
    if (category === "hat") return typeof isSlimeCosmeticUnlocked === "function" &&
      isSlimeCosmeticUnlocked(itemId);
    if (category === "beard") return typeof isSlimeBeardUnlocked === "function" &&
      isSlimeBeardUnlocked(itemId);
    return false;
  }

  function unlockVoucherItem(category, itemId) {
    if (category === "color") return typeof unlockSlimeColor === "function" &&
      unlockSlimeColor(itemId);
    if (category === "hat") return typeof unlockSlimeCosmetic === "function" &&
      unlockSlimeCosmetic(itemId);
    if (category === "beard") return typeof unlockSlimeBeard === "function" &&
      unlockSlimeBeard(itemId);
    return false;
  }

  function chooseVoucherItem(itemId) {
    const pending = bonusState?.pending;
    const reward = REWARDS[pending?.rewardId];
    if (!pending || reward?.kind !== "voucher") {
      return {ok: false, reason: "voucher-not-pending"};
    }
    const lockedItems = getLockedVoucherItems(reward.category);
    const normalizedItemId = String(itemId ?? "");
    if (!pending.selectedVoucherItemId && !lockedItems.includes(normalizedItemId)) {
      if (lockedItems.length === 0) {
        return {ok: fallbackVoucherToStars(), fallback: true};
      }
      return {ok: false, reason: "invalid-voucher-item"};
    }
    if (!pending.selectedVoucherItemId) {
      if (!setPendingPhase("awaiting_voucher", {
        selectedVoucherItemId: normalizedItemId
      })) {
        return {ok: false, reason: "selection-storage-error"};
      }
    }
    const selectedItemId = bonusState.pending.selectedVoucherItemId;
    const unlocked = unlockVoucherItem(reward.category, selectedItemId) ||
      isVoucherItemUnlocked(reward.category, selectedItemId);
    if (!unlocked) return {ok: false, reason: "unlock-failed"};
    window.SlimeAchievements?.checkWardrobe?.();
    window.SlimeAchievements?.checkState?.();
    const payout = {
      status: "applied",
      rewardId: reward.id,
      category: reward.category,
      itemId: selectedItemId,
      appliedAt: Date.now()
    };
    if (!setPendingPhase("payout_applied", {payout})) {
      return {ok: false, reason: "claim-storage-error", payoutApplied: true};
    }
    return {ok: true, itemId: selectedItemId};
  }

  function claimPending() {
    const pending = bonusState?.pending;
    if (!pending || pending.phase !== "payout_applied") return false;
    const nextState = clone(bonusState);
    nextState.highestClaimedCheckpoint = Math.max(
      nextState.highestClaimedCheckpoint,
      pending.checkpointLevel
    );
    nextState.pending = null;
    return persistState(nextState);
  }

  function cacheDom() {
    if (typeof document === "undefined") return false;
    const ids = [
      "checkpointBonusOverlay", "checkpointBonusPanel", "checkpointBonusCheckpoint",
      "checkpointBonusMachine", "checkpointBonusPrevious", "checkpointBonusCurrent",
      "checkpointBonusNext", "checkpointBonusLever", "checkpointBonusStatus",
      "checkpointBonusReward", "checkpointBonusVoucherChoices", "checkpointBonusAction",
      "checkpointBonusError", "devCheckpointBonusInspector"
    ];
    for (const id of ids) dom[id] = document.getElementById(id);
    return Boolean(dom.checkpointBonusOverlay && dom.checkpointBonusAction);
  }

  function setSymbol(element, rewardId, {center = false} = {}) {
    if (!element) return;
    const reward = REWARDS[rewardId];
    element.innerHTML = `<span class="checkpointBonusSymbolIcon" aria-hidden="true">${reward.icon}</span>` +
      `<strong>${reward.reelLabel}</strong>`;
    element.dataset.rewardId = rewardId;
    element.classList.toggle("checkpointBonusReelCell--center", center);
  }

  function renderReel(index = visualRewardIndex) {
    visualRewardIndex = (index % REWARD_IDS.length + REWARD_IDS.length) % REWARD_IDS.length;
    setSymbol(dom.checkpointBonusPrevious, REWARD_IDS[(visualRewardIndex + 6) % 7]);
    setSymbol(dom.checkpointBonusCurrent, REWARD_IDS[visualRewardIndex], {center: true});
    setSymbol(dom.checkpointBonusNext, REWARD_IDS[(visualRewardIndex + 1) % 7]);
  }

  function getVoucherItemLabel(category, itemId) {
    if (category === "color" && typeof SLIME_COLOR_NAMES !== "undefined") {
      return SLIME_COLOR_NAMES[itemId] ?? itemId;
    }
    if (category === "hat" && typeof getSlimeCosmeticDefinition === "function") {
      return getSlimeCosmeticDefinition(itemId)?.name ?? itemId;
    }
    if (category === "beard" && typeof getSlimeBeardDefinition === "function") {
      return getSlimeBeardDefinition(itemId)?.name ?? itemId;
    }
    return itemId;
  }

  function renderVoucherChoices() {
    const pending = bonusState?.pending;
    const reward = REWARDS[pending?.rewardId];
    if (reward?.kind !== "voucher") return false;
    const lockedItems = getLockedVoucherItems(reward.category);
    if (pending.selectedVoucherItemId && isVoucherItemUnlocked(
      reward.category,
      pending.selectedVoucherItemId
    )) {
      chooseVoucherItem(pending.selectedVoucherItemId);
      renderPending();
      return true;
    }
    if (lockedItems.length === 0) {
      fallbackVoucherToStars();
      renderPending();
      return true;
    }
    setPendingPhase("awaiting_voucher");
    dom.checkpointBonusVoucherChoices.innerHTML = "";
    for (const itemId of lockedItems) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "checkpointBonusVoucherOption uiButton uiButton--secondary";
      button.dataset.itemId = itemId;
      button.textContent = getVoucherItemLabel(reward.category, itemId);
      button.addEventListener("click", () => {
        const result = chooseVoucherItem(itemId);
        if (!result.ok) {
          showError("Auswahl konnte nicht sicher gespeichert werden. Bitte erneut versuchen.");
          return;
        }
        playNormalRewardSound();
        renderPending();
      });
      dom.checkpointBonusVoucherChoices.appendChild(button);
    }
    dom.checkpointBonusVoucherChoices.classList.remove("hidden");
    dom.checkpointBonusAction.classList.add("hidden");
    dom.checkpointBonusStatus.textContent = "WÄHLE GENAU EIN ITEM";
    return true;
  }

  function showError(message) {
    if (!dom.checkpointBonusError) return;
    dom.checkpointBonusError.textContent = message;
    dom.checkpointBonusError.classList.remove("hidden");
  }

  function clearError() {
    if (!dom.checkpointBonusError) return;
    dom.checkpointBonusError.textContent = "";
    dom.checkpointBonusError.classList.add("hidden");
  }

  function renderPending() {
    if (!cacheDom() || !bonusState?.pending) return false;
    const pending = bonusState.pending;
    const reward = REWARDS[pending.rewardId];
    clearError();
    dom.checkpointBonusCheckpoint.textContent = `CHECKPOINT ${pending.checkpointLevel}`;
    dom.checkpointBonusPanel.classList.toggle(
      "checkpointBonusPanel--jackpot",
      pending.rewardId === "gold_slime" && pending.phase === "payout_applied"
    );
    dom.checkpointBonusVoucherChoices.classList.add("hidden");
    dom.checkpointBonusVoucherChoices.innerHTML = "";
    dom.checkpointBonusAction.classList.remove("hidden");
    if (pending.phase === "prepared") {
      runtimeMode = "prepared";
      renderReel(0);
      dom.checkpointBonusStatus.textContent = "DEIN CHECKPOINT-GEWINN WARTET";
      dom.checkpointBonusReward.textContent = "";
      dom.checkpointBonusReward.classList.add("hidden");
      dom.checkpointBonusAction.textContent = "SPIN STARTEN";
      dom.checkpointBonusAction.disabled = false;
      return true;
    }
    visualRewardIndex = REWARD_IDS.indexOf(pending.rewardId);
    renderReel(visualRewardIndex);
    dom.checkpointBonusReward.textContent = reward.winTitle;
    dom.checkpointBonusReward.classList.remove("hidden");
    if (pending.phase === "landed") {
      runtimeMode = "landed";
      dom.checkpointBonusStatus.textContent = "GEWINN!";
      dom.checkpointBonusAction.textContent = reward.kind === "voucher"
        ? "AUSWÄHLEN"
        : "AUSZAHLUNG WIEDERHOLEN";
      dom.checkpointBonusAction.disabled = false;
      if (reward.kind !== "voucher") {
        const payoutResult = applyPendingPayout();
        if (payoutResult.ok) return renderPending();
        if (payoutResult.deferred) {
          dom.checkpointBonusStatus.textContent = "LIFE REFILL WIRD BEIM NÄCHSTEN RUN ANGEWENDET";
          dom.checkpointBonusAction.classList.add("hidden");
          return true;
        }
        showError("Auszahlung konnte nicht sicher abgeschlossen werden.");
      }
      return true;
    }
    if (pending.phase === "awaiting_voucher") {
      runtimeMode = "voucher";
      return renderVoucherChoices();
    }
    runtimeMode = "paid";
    dom.checkpointBonusStatus.textContent = pending.rewardId === "gold_slime"
      ? "JACKPOT SICHER VERGEBEN"
      : "BELOHNUNG SICHER VERGEBEN";
    dom.checkpointBonusAction.textContent = "EINSAMMELN";
    dom.checkpointBonusAction.disabled = false;
    return true;
  }

  function scheduleSound(callback, delay) {
    const timerId = window.setTimeout(() => {
      soundTimerIds.delete(timerId);
      callback();
    }, delay);
    soundTimerIds.add(timerId);
  }

  function playTick() {
    if (typeof tone === "function") tone(360, 0.035, "square", 0.018, 430);
  }

  function playNormalRewardSound() {
    if (typeof playWin === "function") playWin();
  }

  function playLandedRewardSound(rewardId) {
    if (rewardId === "gold_slime") {
      if (typeof tone === "function") {
        tone(392, 0.13, "triangle", 0.055, 523);
        scheduleSound(() => tone(523, 0.13, "triangle", 0.06, 659), 110);
        scheduleSound(() => tone(659, 0.16, "triangle", 0.065, 988), 220);
        scheduleSound(() => tone(988, 0.24, "sine", 0.07, 1318), 350);
      }
      return;
    }
    if (["stars_100", "stars_500"].includes(rewardId) && typeof playStar === "function") {
      playStar();
      scheduleSound(playNormalRewardSound, 130);
      return;
    }
    playNormalRewardSound();
  }

  function cancelAnimation() {
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    if (autoStopTimerId !== null) window.clearTimeout(autoStopTimerId);
    animationFrameId = null;
    autoStopTimerId = null;
  }

  function startSpin() {
    if (runtimeMode !== "prepared" || !bonusState?.pending) return false;
    runtimeMode = "spinning";
    setPendingPhase("prepared");
    dom.checkpointBonusLever.classList.remove("checkpointBonusLever--pulled");
    void dom.checkpointBonusLever.offsetWidth;
    dom.checkpointBonusLever.classList.add("checkpointBonusLever--pulled");
    dom.checkpointBonusStatus.textContent = "DIE WALZE LÄUFT";
    dom.checkpointBonusAction.textContent = "TIPPE ZUM STOPPEN";
    spinStartedAt = performance.now();
    let lastStep = -1;
    const animate = now => {
      if (runtimeMode !== "spinning") return;
      const step = Math.floor((now - spinStartedAt) / SPIN_STEP_MS);
      if (step !== lastStep) {
        renderReel(step);
        if (lastStep >= 0) playTick();
        lastStep = step;
      }
      animationFrameId = window.requestAnimationFrame(animate);
    };
    animationFrameId = window.requestAnimationFrame(animate);
    autoStopTimerId = window.setTimeout(beginDeceleration, AUTO_STOP_MS);
    return true;
  }

  function beginDeceleration() {
    if (runtimeMode !== "spinning" || !bonusState?.pending) return false;
    runtimeMode = "decelerating";
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    if (autoStopTimerId !== null) window.clearTimeout(autoStopTimerId);
    animationFrameId = null;
    autoStopTimerId = null;
    dom.checkpointBonusAction.disabled = true;
    dom.checkpointBonusAction.textContent = "WALZE BREMST …";
    dom.checkpointBonusStatus.textContent = "JETZT WIRD ES SPANNEND";
    const startIndex = visualRewardIndex;
    const targetIndex = REWARD_IDS.indexOf(bonusState.pending.rewardId);
    const alignmentSteps = (targetIndex - startIndex + REWARD_IDS.length) % REWARD_IDS.length;
    const totalSteps = DECELERATION_MIN_STEPS + alignmentSteps;
    const startedAt = performance.now();
    let lastRenderedStep = 0;
    const decelerate = now => {
      if (runtimeMode !== "decelerating") return;
      const elapsed = Math.max(0, now - startedAt);
      const progress = Math.min(1, elapsed / DECELERATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const renderedStep = Math.min(totalSteps, Math.floor(eased * totalSteps));
      if (renderedStep !== lastRenderedStep) {
        renderReel(startIndex + renderedStep);
        playTick();
        lastRenderedStep = renderedStep;
      }
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(decelerate);
        return;
      }
      animationFrameId = null;
      renderReel(targetIndex);
      setPendingPhase("landed");
      runtimeMode = "landed";
      playLandedRewardSound(bonusState.pending.rewardId);
      renderPending();
    };
    animationFrameId = window.requestAnimationFrame(decelerate);
    return true;
  }

  function onAction() {
    if (runtimeMode === "prepared") {
      startSpin();
      return;
    }
    if (runtimeMode === "spinning") {
      beginDeceleration();
      return;
    }
    if (runtimeMode === "landed") {
      const reward = REWARDS[bonusState?.pending?.rewardId];
      if (reward?.kind === "voucher") renderVoucherChoices();
      else renderPending();
      return;
    }
    if (runtimeMode === "paid") finishOpenFlow();
  }

  function preventEscape(event) {
    if (event.key !== "Escape" || runtimeMode === "closed") return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function preventBackdropClose(event) {
    if (event.target === dom.checkpointBonusOverlay) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function attachOpenListeners() {
    if (listenersAttached || typeof document === "undefined") return;
    document.addEventListener("keydown", preventEscape, true);
    dom.checkpointBonusOverlay.addEventListener("pointerdown", preventBackdropClose);
    listenersAttached = true;
  }

  function detachOpenListeners() {
    if (!listenersAttached || typeof document === "undefined") return;
    document.removeEventListener("keydown", preventEscape, true);
    dom.checkpointBonusOverlay.removeEventListener("pointerdown", preventBackdropClose);
    listenersAttached = false;
  }

  function openPending({onComplete = null} = {}) {
    ensureState(gameBridge.getHighestCheckpoint?.() ?? 0);
    if (!bonusState.pending || !cacheDom()) return false;
    if (
      REWARDS[bonusState.pending.rewardId].kind === "life" &&
      gameBridge.isRunAvailable?.() !== true &&
      !(typeof DEV_MODE !== "undefined" && DEV_MODE && devLifePreviewActive) &&
      bonusState.pending.phase !== "payout_applied"
    ) {
      return false;
    }
    cancelAnimation();
    completionCallback = typeof onComplete === "function" ? onComplete : null;
    gameBridge.setGameState?.("checkpointBonus");
    window.SlimeAchievements?.setPopupsPaused?.(true);
    dom.checkpointBonusOverlay.classList.remove("hidden");
    dom.checkpointBonusOverlay.setAttribute("aria-hidden", "false");
    attachOpenListeners();
    return renderPending();
  }

  function closeOverlay() {
    cancelAnimation();
    detachOpenListeners();
    for (const timerId of soundTimerIds) window.clearTimeout(timerId);
    soundTimerIds.clear();
    if (dom.checkpointBonusOverlay) {
      dom.checkpointBonusOverlay.classList.add("hidden");
      dom.checkpointBonusOverlay.setAttribute("aria-hidden", "true");
    }
    runtimeMode = "closed";
    devLifePreviewActive = false;
  }

  function finishOpenFlow() {
    if (!claimPending()) {
      showError("Claim konnte nicht sicher gespeichert werden. Bitte erneut versuchen.");
      return false;
    }
    const callback = completionCallback;
    completionCallback = null;
    closeOverlay();
    window.SlimeAchievements?.setPopupsPaused?.(false);
    if (callback) callback();
    else gameBridge.setGameState?.("menu");
    return true;
  }

  function handleTrueRunStart() {
    ensureState(gameBridge.getHighestCheckpoint?.() ?? 0);
    const pending = bonusState.pending;
    if (!pending || REWARDS[pending.rewardId].kind !== "life") return false;
    const result = applyPendingPayout();
    if (!result.ok) return false;
    const claimed = claimPending();
    if (claimed) window.SlimeAchievements?.setPopupsPaused?.(false);
    return claimed;
  }

  function getInspectorData() {
    const eligibility = getEligibility();
    return {
      storageKey: STORAGE_KEY,
      pool: REWARD_IDS.filter(rewardId => eligibility[rewardId]),
      effectiveWeights: getEffectiveWeights(eligibility),
      goldEligible: eligibility.gold_slime,
      lives: eligibility.lives,
      lockedColorCount: eligibility.lockedColorCount,
      lockedHatCount: eligibility.lockedHatCount,
      lockedBeardCount: eligibility.lockedBeardCount,
      pendingReward: bonusState?.pending?.rewardId ?? null,
      transactionId: bonusState?.pending?.transactionId ?? null,
      phase: bonusState?.pending?.phase ?? null,
      highestClaimedCheckpoint: bonusState?.highestClaimedCheckpoint ?? 0,
      goldOwned: window.SlimeGold?.ownsGoldSlime?.() === true,
      goldShopUnlocked: window.SlimeGold?.isGoldShopUnlocked?.() === true,
      goldMastery: window.SlimeGold?.isGoldSlimeMasteryUnlocked?.() === true,
      lastDevAntiFarmingCheck,
      overrides: clone(devEligibilityOverrides)
    };
  }

  function renderDevInspector() {
    if (!dom.devCheckpointBonusInspector) cacheDom();
    if (!dom.devCheckpointBonusInspector || dom.devCheckpointBonusInspector.hidden) return;
    dom.devCheckpointBonusInspector.textContent = JSON.stringify(getInspectorData(), null, 2);
  }

  function resetStateForDev() {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE) return false;
    closeOverlay();
    return persistState(createInitialState(0));
  }

  function createDevPending(rewardId, phase = "prepared") {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE || !REWARD_IDS.includes(rewardId)) {
      return false;
    }
    if (bonusState?.pending) resetStateForDev();
    const checkpoint = Math.max(10, (bonusState?.highestClaimedCheckpoint ?? 0) + 10);
    if (!prepareCheckpoint(checkpoint, {forcedRewardId: rewardId, dev: true})) return false;
    if (phase === "landed") setPendingPhase("landed");
    if (phase === "payout_applied") {
      setPendingPhase("landed");
      applyPendingPayout();
    }
    renderDevInspector();
    return true;
  }

  function devForceReward(rewardId) {
    if (!createDevPending(rewardId, "prepared")) return false;
    devLifePreviewActive = rewardId === "life_refill";
    return openPending();
  }

  function simulateDevCheckpoint() {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE) return false;
    if (bonusState?.pending) return openPending();
    const highest = Math.max(
      bonusState?.highestClaimedCheckpoint ?? 0,
      normalizeCheckpoint(gameBridge.getHighestCheckpoint?.())
    );
    const pending = prepareCheckpoint(highest + 10, {dev: true});
    return Boolean(pending && openPending());
  }

  function testClaimedCheckpointReplayForDev() {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE) return false;
    const checkpoint = bonusState?.highestClaimedCheckpoint ?? 0;
    const blocked = checkpoint > 0 && prepareCheckpoint(checkpoint, {dev: true}) === null;
    lastDevAntiFarmingCheck = {
      kind: "claimed-replay",
      checkpoint,
      blocked
    };
    renderDevInspector();
    return blocked;
  }

  function testCheckpointRollbackForDev() {
    if (typeof DEV_MODE === "undefined" || !DEV_MODE) return false;
    const claimedCheckpoint = bonusState?.highestClaimedCheckpoint ?? 0;
    const rolledBackCheckpoint = Math.max(0, claimedCheckpoint - 10);
    const pendingBefore = bonusState?.pending?.transactionId ?? null;
    recoverMissingCheckpoint(rolledBackCheckpoint);
    const blocked = (bonusState?.pending?.transactionId ?? null) === pendingBefore;
    lastDevAntiFarmingCheck = {
      kind: "checkpoint-rollback",
      claimedCheckpoint,
      rolledBackCheckpoint,
      blocked
    };
    renderDevInspector();
    return blocked;
  }

  function bindDevControls() {
    if (typeof document === "undefined" || typeof DEV_MODE === "undefined" || !DEV_MODE) return;
    const forceButtons = document.querySelectorAll("[data-dev-checkpoint-reward]");
    forceButtons.forEach(button => button.addEventListener("click", () => {
      devForceReward(button.dataset.devCheckpointReward);
    }));
    document.getElementById("devCheckpointBonusOpenBtn")?.addEventListener("click", () => {
      if (!openPending()) devForceReward("stars_100");
    });
    document.getElementById("devCheckpointBonusSimulateBtn")?.addEventListener(
      "click", simulateDevCheckpoint
    );
    document.getElementById("devCheckpointBonusResetBtn")?.addEventListener(
      "click", resetStateForDev
    );
    document.getElementById("devCheckpointBonusPendingPreparedBtn")?.addEventListener(
      "click", () => createDevPending("stars_100", "prepared")
    );
    document.getElementById("devCheckpointBonusPendingLandedBtn")?.addEventListener(
      "click", () => createDevPending("stars_100", "landed")
    );
    document.getElementById("devCheckpointBonusPendingPaidBtn")?.addEventListener(
      "click", () => createDevPending("stars_100", "payout_applied")
    );
    document.getElementById("devCheckpointBonusReplayClaimedBtn")?.addEventListener(
      "click", testClaimedCheckpointReplayForDev
    );
    document.getElementById("devCheckpointBonusRollbackBtn")?.addEventListener(
      "click", testCheckpointRollbackForDev
    );
    document.getElementById("devCheckpointBonusInspectorBtn")?.addEventListener("click", () => {
      dom.devCheckpointBonusInspector.hidden = !dom.devCheckpointBonusInspector.hidden;
      renderDevInspector();
    });
    document.querySelectorAll("[data-dev-checkpoint-condition]").forEach(button => {
      button.addEventListener("click", () => {
        const condition = button.dataset.devCheckpointCondition;
        if (!(condition in devEligibilityOverrides)) return;
        devEligibilityOverrides[condition] = !devEligibilityOverrides[condition];
        button.setAttribute("aria-pressed", String(devEligibilityOverrides[condition]));
        renderDevInspector();
      });
    });
  }

  function configureGame(bridge = {}) {
    gameBridge = isObject(bridge) ? bridge : {};
    cacheDom();
    const highest = normalizeCheckpoint(gameBridge.getHighestCheckpoint?.());
    ensureState(highest);
    configured = true;
    if (dom.checkpointBonusAction && !dom.checkpointBonusAction.dataset.bound) {
      dom.checkpointBonusAction.dataset.bound = "1";
      dom.checkpointBonusAction.addEventListener("click", onAction);
    }
    bindDevControls();
    const pending = recoverMissingCheckpoint(highest);
    if (pending && !(REWARDS[pending.rewardId].kind === "life" &&
      gameBridge.isRunAvailable?.() !== true)) {
      window.setTimeout(() => openPending(), 0);
    }
    renderDevInspector();
    return clone(bonusState);
  }

  window.SlimeCheckpointBonus = Object.freeze({
    storageKey: STORAGE_KEY,
    stateVersion: STATE_VERSION,
    goldGateChance: GOLD_GATE_CHANCE,
    autoStopMs: AUTO_STOP_MS,
    decelerationMs: DECELERATION_MS,
    rewardIds: REWARD_IDS,
    rewards: REWARDS,
    createInitialState,
    normalizeState,
    getEligibility,
    getEffectiveWeights,
    selectReward,
    configureGame,
    prepareCheckpoint,
    recoverMissingCheckpoint,
    openPending,
    applyPendingPayout,
    chooseVoucherItem,
    claimPending,
    handleTrueRunStart,
    getState: () => clone(ensureState(gameBridge.getHighestCheckpoint?.() ?? 0)),
    getInspectorData,
    isOpen: () => runtimeMode !== "closed",
    isConfigured: () => configured,
    devForceReward,
    simulateDevCheckpoint,
    testClaimedCheckpointReplayForDev,
    testCheckpointRollbackForDev,
    createDevPending,
    resetStateForDev,
    setDevEligibilityOverride(condition, enabled) {
      if (typeof DEV_MODE === "undefined" || !DEV_MODE || !(condition in devEligibilityOverrides)) {
        return false;
      }
      devEligibilityOverrides[condition] = Boolean(enabled);
      renderDevInspector();
      return true;
    }
  });
})();
