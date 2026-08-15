(() => {
  "use strict";

  const PRESTIGE_LEVEL_STORAGE_KEY = "slimejumperPrestigeLevel";
  const PRESTIGE_TRANSACTION_STORAGE_KEY = "slimejumperPrestigeTransaction";
  const PERMANENT_WARDROBE_UNLOCKS_STORAGE_KEY =
    "slimejumperPrestigePermanentWardrobeUnlocks";
  const PENDING_WARDROBE_CHOICE_STORAGE_KEY =
    "slimejumperPendingPrestigeWardrobeChoice";
  const PRESTIGE_TRANSACTION_FORMAT_VERSION = "prestige-transaction-v1";
  const MAX_AVAILABLE_PRESTIGE = 10;
  const PRESTIGE_BALANCE = Object.freeze({xpBonusPerPrestige: 0.00});
  const PRESTIGE_REWARD_TYPES = Object.freeze([
    "frame", "title", "aura", "trail"
  ]);
  const PRESTIGE_SELECTION_STORAGE_KEYS = Object.freeze({
    frame: "slimejumperSelectedPrestigeFrame",
    title: "slimejumperSelectedPrestigeTitle",
    aura: "slimejumperSelectedPrestigeAura",
    trail: "slimejumperSelectedPrestigeTrail"
  });
  const PERMANENT_WARDROBE_CATEGORIES = Object.freeze([
    "color", "cosmetic", "beard"
  ]);
  const EXCLUDED_PERMANENT_WARDROBE_IDS = Object.freeze({
    color: Object.freeze(["green", "silver", "gold"]),
    cosmetic: Object.freeze(["none"]),
    beard: Object.freeze(["none"])
  });

  const ACHIEVEMENT_PROGRESS_DEFAULT = Object.freeze({
    discoveredBiomeIds: [],
    perfectBiomeIds: [],
    deathFreeBiomeIds: [],
    completedLookIds: [],
    lifetimeStars: 0,
    lifetimeAirTime: 0,
    lifetimeCompletedLevels: 0,
    lifetimeDeaths: 0,
    lifetimePerfects: 0
  });

  const PRESTIGE_CYCLE_DEFAULTS = Object.freeze({
    slimejumperPlayerLevel: "1",
    slimejumperPlayerLevelXP: "0",
    slimejumperHighestCheckpointLevel: "0",
    slimejumperStarBalance: "0",
    slimejumperUnlockedSlimeColors: JSON.stringify(["green"]),
    slimejumperSelectedSlimeColor: "green",
    slimejumperUnlockedSlimeCosmetics: JSON.stringify([]),
    slimejumperSelectedSlimeCosmetic: "none",
    slimejumperUnlockedSlimeBeards: JSON.stringify([]),
    slimejumperSelectedSlimeBeard: "none",
    slimejumperPendingWardrobeUnlockChoices: "0",
    slimejumperAchievements: JSON.stringify([]),
    slimejumperAchievementProgress: JSON.stringify(ACHIEVEMENT_PROGRESS_DEFAULT),
    slimejumperSelectedAchievementBadges: JSON.stringify([])
    // Future cycle-bound perk and mastery keys belong in this explicit allowlist.
  });

  const PRESTIGE_DEFINITIONS = Object.freeze([
    Object.freeze({level: 1, symbolId: "prestige-drop-ring", displayLabel: "P1", theme: "verdant", reward: Object.freeze({type: "frame", id: "prestige-frame-p1", displayName: "Verdant Frame"})}),
    Object.freeze({level: 2, symbolId: "prestige-single-chevron", displayLabel: "P2", theme: "bronze", reward: Object.freeze({type: "title", id: "prestige-title-p2", displayName: "Slimebound"})}),
    Object.freeze({level: 3, symbolId: "prestige-double-chevron", displayLabel: "P3", theme: "silver", reward: Object.freeze({type: "aura", id: "prestige-aura-p3", displayName: "Moon Glow"})}),
    Object.freeze({level: 4, symbolId: "prestige-winged-slime", displayLabel: "P4", theme: "sky", reward: Object.freeze({type: "frame", id: "prestige-frame-p4", displayName: "Skywing Frame"})}),
    Object.freeze({level: 5, symbolId: "prestige-starburst", displayLabel: "P5", theme: "gold", reward: Object.freeze({type: "trail", id: "prestige-trail-p5", displayName: "Star Slime Trail"})}),
    Object.freeze({level: 6, symbolId: "prestige-ornament-shield", displayLabel: "P6", theme: "royal", reward: Object.freeze({type: "title", id: "prestige-title-p6", displayName: "Crown Hopper"})}),
    Object.freeze({level: 7, symbolId: "prestige-crowned-slime", displayLabel: "P7", theme: "crown", reward: Object.freeze({type: "frame", id: "prestige-frame-p7", displayName: "Crowned Frame"})}),
    Object.freeze({level: 8, symbolId: "prestige-speed-flame", displayLabel: "P8", theme: "inferno", reward: Object.freeze({type: "aura", id: "prestige-aura-p8", displayName: "Cosmic Glow"})}),
    Object.freeze({level: 9, symbolId: "prestige-cosmic-halo", displayLabel: "P9", theme: "cosmic", reward: Object.freeze({type: "trail", id: "prestige-trail-p9", displayName: "Cosmic Slime Trail"})}),
    Object.freeze({level: 10, symbolId: "prestige-final-crest", displayLabel: "P10", theme: "legendary", reward: Object.freeze({type: "frame", id: "prestige-frame-p10", displayName: "Master Crest Frame"})})
  ]);

  const ROMAN_PRESTIGE_LEVELS = Object.freeze([
    "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"
  ]);

  let transactionInProgress = false;
  let wardrobeRegistry = null;
  const selectedRewardCache = Object.create(null);

  function normalizePrestigeLevel(value) {
    const numericValue = Math.floor(Number(value));
    return Number.isSafeInteger(numericValue) && numericValue >= 0
      ? numericValue
      : 0;
  }

  function readPrestigeLevel() {
    let storedValue = null;
    try {
      storedValue = localStorage.getItem(PRESTIGE_LEVEL_STORAGE_KEY);
    } catch (_) {
      return 0;
    }

    const prestigeLevel = normalizePrestigeLevel(storedValue);
    if (storedValue !== String(prestigeLevel)) {
      try {
        localStorage.setItem(PRESTIGE_LEVEL_STORAGE_KEY, String(prestigeLevel));
      } catch (_) {}
    }
    return prestigeLevel;
  }

  function writeVerifiedStorageValue(key, value) {
    try {
      localStorage.setItem(key, value);
      return localStorage.getItem(key) === value;
    } catch (_) {
      return false;
    }
  }

  function removeVerifiedStorageValue(key) {
    try {
      localStorage.removeItem(key);
      return localStorage.getItem(key) === null;
    } catch (_) {
      return false;
    }
  }

  function getPrestigeDefinition(level = readPrestigeLevel()) {
    const normalizedLevel = normalizePrestigeLevel(level);
    return PRESTIGE_DEFINITIONS.find(
      definition => definition.level === normalizedLevel
    ) ?? null;
  }

  function getDisplayPrestigeDefinition(level = readPrestigeLevel()) {
    const normalizedLevel = Math.min(
      MAX_AVAILABLE_PRESTIGE,
      normalizePrestigeLevel(level)
    );
    return getPrestigeDefinition(normalizedLevel);
  }

  function getUnlockedRewards(level = readPrestigeLevel()) {
    const normalizedLevel = normalizePrestigeLevel(level);
    return PRESTIGE_DEFINITIONS
      .filter(definition => definition.level <= normalizedLevel && definition.reward !== null)
      .map(definition => definition.reward);
  }

  function normalizeRewardType(value) {
    const type = String(value ?? "").toLowerCase();
    return PRESTIGE_REWARD_TYPES.includes(type) ? type : null;
  }

  function getRewardDefinition(type, id) {
    const normalizedType = normalizeRewardType(type);
    const normalizedId = String(id ?? "");
    if (!normalizedType || normalizedId === "none") return null;
    return PRESTIGE_DEFINITIONS.find(definition =>
      definition.reward?.type === normalizedType &&
      definition.reward.id === normalizedId
    )?.reward ?? null;
  }

  function getUnlockedRewardsByType(type, level = readPrestigeLevel()) {
    const normalizedType = normalizeRewardType(type);
    if (!normalizedType) return [];
    return getUnlockedRewards(level).filter(reward => reward.type === normalizedType);
  }

  function normalizeRewardSelection(type, id, level = readPrestigeLevel()) {
    const normalizedType = normalizeRewardType(type);
    const normalizedId = String(id ?? "none");
    if (!normalizedType || normalizedId === "none") return "none";
    return getUnlockedRewardsByType(normalizedType, level)
      .some(reward => reward.id === normalizedId)
      ? normalizedId
      : "none";
  }

  function getSelectedReward(type) {
    const normalizedType = normalizeRewardType(type);
    if (!normalizedType) return "none";
    if (Object.prototype.hasOwnProperty.call(selectedRewardCache, normalizedType)) {
      return selectedRewardCache[normalizedType];
    }
    const storageKey = PRESTIGE_SELECTION_STORAGE_KEYS[normalizedType];
    let storedValue = "none";
    try {
      storedValue = localStorage.getItem(storageKey) ?? "none";
    } catch (_) {}
    const selectedId = normalizeRewardSelection(normalizedType, storedValue);
    if (storedValue !== selectedId) writeVerifiedStorageValue(storageKey, selectedId);
    selectedRewardCache[normalizedType] = selectedId;
    return selectedId;
  }

  function selectReward(type, id) {
    const normalizedType = normalizeRewardType(type);
    if (!normalizedType) return false;
    const selectedId = normalizeRewardSelection(normalizedType, id);
    if (String(id ?? "none") !== selectedId) return false;
    const saved = writeVerifiedStorageValue(
      PRESTIGE_SELECTION_STORAGE_KEYS[normalizedType],
      selectedId
    );
    if (saved) selectedRewardCache[normalizedType] = selectedId;
    return saved;
  }

  function getPrestigeXpMultiplier(level = readPrestigeLevel()) {
    const prestigeLevel = normalizePrestigeLevel(level);
    return 1 + prestigeLevel * PRESTIGE_BALANCE.xpBonusPerPrestige;
  }

  function normalizePermanentWardrobeChoice(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const category = String(value.category ?? "").toLowerCase();
    const id = String(value.id ?? "").toLowerCase();
    if (!PERMANENT_WARDROBE_CATEGORIES.includes(category) || !id) return null;
    if (EXCLUDED_PERMANENT_WARDROBE_IDS[category].includes(id)) return null;
    if (wardrobeRegistry && !wardrobeRegistry.items[category].has(id)) return null;
    return {category, id};
  }

  function normalizePermanentWardrobeUnlockMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const normalized = {};
    const usedItems = new Set();
    Object.keys(value)
      .map(stage => normalizePrestigeLevel(stage))
      .filter(stage => stage > 0 && getPrestigeDefinition(stage))
      .sort((a, b) => a - b)
      .forEach(stage => {
        const choice = normalizePermanentWardrobeChoice(value[String(stage)]);
        if (!choice) return;
        const itemKey = `${choice.category}:${choice.id}`;
        if (usedItems.has(itemKey)) return;
        usedItems.add(itemKey);
        normalized[String(stage)] = choice;
      });
    return normalized;
  }

  function readPermanentWardrobeUnlockMap() {
    let parsedValue = {};
    try {
      parsedValue = JSON.parse(
        localStorage.getItem(PERMANENT_WARDROBE_UNLOCKS_STORAGE_KEY) || "{}"
      );
    } catch (_) {}
    const normalized = normalizePermanentWardrobeUnlockMap(parsedValue);
    writeVerifiedStorageValue(
      PERMANENT_WARDROBE_UNLOCKS_STORAGE_KEY,
      JSON.stringify(normalized)
    );
    return normalized;
  }

  function getPermanentWardrobeUnlocks() {
    const unlockMap = readPermanentWardrobeUnlockMap();
    return Object.keys(unlockMap)
      .map(stage => ({prestigeLevel: Number(stage), ...unlockMap[stage]}))
      .sort((a, b) => a.prestigeLevel - b.prestigeLevel);
  }

  function normalizePendingWardrobeChoice(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prestigeLevel = normalizePrestigeLevel(value.prestigeLevel);
    if (
      prestigeLevel < 1 ||
      prestigeLevel > readPrestigeLevel() ||
      !getPrestigeDefinition(prestigeLevel)
    ) return null;
    return {prestigeLevel};
  }

  function getPendingPermanentWardrobeChoice() {
    let parsedValue = null;
    try {
      const rawValue = localStorage.getItem(PENDING_WARDROBE_CHOICE_STORAGE_KEY);
      if (rawValue !== null) parsedValue = JSON.parse(rawValue);
    } catch (_) {}
    const pendingChoice = normalizePendingWardrobeChoice(parsedValue);
    const unlockMap = readPermanentWardrobeUnlockMap();
    if (!pendingChoice || unlockMap[String(pendingChoice.prestigeLevel)]) {
      removeVerifiedStorageValue(PENDING_WARDROBE_CHOICE_STORAGE_KEY);
      return null;
    }
    return pendingChoice;
  }

  function ensurePendingPermanentWardrobeChoice(prestigeLevel) {
    const normalizedLevel = normalizePrestigeLevel(prestigeLevel);
    if (!getPrestigeDefinition(normalizedLevel)) return false;
    const unlockMap = readPermanentWardrobeUnlockMap();
    if (unlockMap[String(normalizedLevel)]) {
      removeVerifiedStorageValue(PENDING_WARDROBE_CHOICE_STORAGE_KEY);
      return true;
    }
    return writeVerifiedStorageValue(
      PENDING_WARDROBE_CHOICE_STORAGE_KEY,
      JSON.stringify({prestigeLevel: normalizedLevel})
    );
  }

  function configureWardrobeRegistry(configuration) {
    if (!configuration || typeof configuration !== "object") return false;
    const items = {};
    for (const category of PERMANENT_WARDROBE_CATEGORIES) {
      const categoryItems = Array.isArray(configuration[category]?.items)
        ? configuration[category].items
        : [];
      items[category] = new Map();
      categoryItems.forEach(item => {
        const id = String(item?.id ?? "").toLowerCase();
        if (
          !id ||
          EXCLUDED_PERMANENT_WARDROBE_IDS[category].includes(id) ||
          items[category].has(id)
        ) return;
        items[category].set(id, Object.freeze({
          category,
          id,
          displayName: String(item?.displayName || id)
        }));
      });
    }
    wardrobeRegistry = {
      items,
      applyUnlock: typeof configuration.applyUnlock === "function"
        ? configuration.applyUnlock
        : null
    };

    const unlocks = getPermanentWardrobeUnlocks();
    unlocks.forEach(unlock => wardrobeRegistry.applyUnlock?.(unlock.category, unlock.id));
    getPendingPermanentWardrobeChoice();
    return true;
  }

  function getPermanentWardrobeCandidates(category) {
    const normalizedCategory = String(category ?? "").toLowerCase();
    if (!wardrobeRegistry || !PERMANENT_WARDROBE_CATEGORIES.includes(normalizedCategory)) {
      return [];
    }
    const permanentlyUsed = new Set(
      getPermanentWardrobeUnlocks().map(unlock => `${unlock.category}:${unlock.id}`)
    );
    return [...wardrobeRegistry.items[normalizedCategory].values()]
      .filter(item => !permanentlyUsed.has(`${item.category}:${item.id}`))
      .map(item => ({...item}));
  }

  function choosePermanentWardrobeUnlock(category, id) {
    const pendingChoice = getPendingPermanentWardrobeChoice();
    if (!pendingChoice || !wardrobeRegistry) return false;
    const normalizedCategory = String(category ?? "").toLowerCase();
    const normalizedId = String(id ?? "").toLowerCase();
    const candidate = getPermanentWardrobeCandidates(normalizedCategory)
      .find(item => item.id === normalizedId);
    if (!candidate) return false;

    const unlockMap = readPermanentWardrobeUnlockMap();
    const stageKey = String(pendingChoice.prestigeLevel);
    if (unlockMap[stageKey]) return false;
    unlockMap[stageKey] = {category: candidate.category, id: candidate.id};
    if (!writeVerifiedStorageValue(
      PERMANENT_WARDROBE_UNLOCKS_STORAGE_KEY,
      JSON.stringify(unlockMap)
    )) return false;

    wardrobeRegistry.applyUnlock?.(candidate.category, candidate.id);
    return removeVerifiedStorageValue(PENDING_WARDROBE_CHOICE_STORAGE_KEY);
  }

  function normalizeIdentitySnapshot(value) {
    const snapshot = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const playerLevelNumber = Math.floor(Number(snapshot.playerLevel));
    const playerLevel = Number.isSafeInteger(playerLevelNumber) && playerLevelNumber >= 1
      ? Math.min(100, playerLevelNumber)
      : 1;
    const prestigeLevel = Math.min(
      MAX_AVAILABLE_PRESTIGE,
      normalizePrestigeLevel(snapshot.prestigeLevel)
    );
    const definition = getDisplayPrestigeDefinition(prestigeLevel);
    const slimeAchievements = [];
    (Array.isArray(snapshot.slimeAchievements) ? snapshot.slimeAchievements : [])
      .forEach(id => {
        const normalizedId = typeof id === "string" ? id.trim() : "";
        if (normalizedId && !slimeAchievements.includes(normalizedId) && slimeAchievements.length < 5) {
          slimeAchievements.push(normalizedId);
        }
      });
    return Object.freeze({
      playerLevel,
      prestigeLevel,
      prestigeEmblemId: definition?.symbolId ?? "none",
      prestigeFrame: normalizeRewardSelection("frame", snapshot.prestigeFrame, prestigeLevel),
      prestigeTitle: normalizeRewardSelection("title", snapshot.prestigeTitle, prestigeLevel),
      prestigeAura: normalizeRewardSelection("aura", snapshot.prestigeAura, prestigeLevel),
      prestigeTrail: normalizeRewardSelection("trail", snapshot.prestigeTrail, prestigeLevel),
      slimeAchievements: Object.freeze(slimeAchievements.slice())
    });
  }

  function capturePlayerIdentitySnapshot() {
    return normalizeIdentitySnapshot({
      playerLevel: window.SlimePlayerProgress?.getPlayerProgress?.().level ?? 1,
      prestigeLevel: readPrestigeLevel(),
      prestigeFrame: getSelectedReward("frame"),
      prestigeTitle: getSelectedReward("title"),
      prestigeAura: getSelectedReward("aura"),
      prestigeTrail: getSelectedReward("trail"),
      slimeAchievements: window.SlimeAchievements?.getSelectedBadgeIds?.() ?? []
    });
  }

  function isPrestigeReady() {
    return window.SlimePlayerProgress?.isPrestigeReady?.() === true;
  }

  function isPrestigeMastered() {
    return readPrestigeLevel() >= MAX_AVAILABLE_PRESTIGE && isPrestigeReady();
  }

  function normalizePrestigeTransaction(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const fromPrestige = normalizePrestigeLevel(value.fromPrestige);
    const targetPrestige = normalizePrestigeLevel(value.targetPrestige);
    if (
      value.formatVersion !== PRESTIGE_TRANSACTION_FORMAT_VERSION ||
      value.status !== "pending" ||
      targetPrestige !== fromPrestige + 1 ||
      targetPrestige > MAX_AVAILABLE_PRESTIGE
    ) {
      return null;
    }
    return {
      formatVersion: PRESTIGE_TRANSACTION_FORMAT_VERSION,
      status: "pending",
      fromPrestige,
      targetPrestige
    };
  }

  function readPrestigeTransaction() {
    let rawValue = null;
    try {
      rawValue = localStorage.getItem(PRESTIGE_TRANSACTION_STORAGE_KEY);
    } catch (_) {
      return {kind: "error"};
    }
    if (rawValue === null) return {kind: "none"};

    try {
      const transaction = normalizePrestigeTransaction(JSON.parse(rawValue));
      return transaction
        ? {kind: "pending", transaction}
        : {kind: "invalid"};
    } catch (_) {
      return {kind: "invalid"};
    }
  }

  function isPrestigeTransactionPending() {
    return readPrestigeTransaction().kind !== "none";
  }

  function resetPrestigeCycleStorage() {
    for (const [key, value] of Object.entries(PRESTIGE_CYCLE_DEFAULTS)) {
      if (!writeVerifiedStorageValue(key, value)) return false;
    }
    return Object.entries(PRESTIGE_CYCLE_DEFAULTS).every(([key, value]) => {
      try {
        return localStorage.getItem(key) === value;
      } catch (_) {
        return false;
      }
    });
  }

  function completePrestigeTransaction(transaction) {
    const normalizedTransaction = normalizePrestigeTransaction(transaction);
    if (!normalizedTransaction) return false;

    if (!writeVerifiedStorageValue(
      PRESTIGE_LEVEL_STORAGE_KEY,
      String(normalizedTransaction.targetPrestige)
    )) {
      return false;
    }
    if (!ensurePendingPermanentWardrobeChoice(normalizedTransaction.targetPrestige)) {
      return false;
    }
    if (!resetPrestigeCycleStorage()) return false;
    return removeVerifiedStorageValue(PRESTIGE_TRANSACTION_STORAGE_KEY);
  }

  function recoverPendingPrestigeTransaction() {
    const storedTransaction = readPrestigeTransaction();
    if (storedTransaction.kind === "none") return true;
    if (storedTransaction.kind === "invalid") {
      return removeVerifiedStorageValue(PRESTIGE_TRANSACTION_STORAGE_KEY);
    }
    if (storedTransaction.kind !== "pending") return false;
    return completePrestigeTransaction(storedTransaction.transaction);
  }

  function performPrestigeReset({validateSafeState} = {}) {
    if (transactionInProgress || typeof validateSafeState !== "function") {
      return false;
    }
    if (!isPrestigeReady() || validateSafeState() !== true) return false;

    const currentPrestige = readPrestigeLevel();
    if (currentPrestige >= MAX_AVAILABLE_PRESTIGE) return false;

    const transaction = {
      formatVersion: PRESTIGE_TRANSACTION_FORMAT_VERSION,
      status: "pending",
      fromPrestige: currentPrestige,
      targetPrestige: currentPrestige + 1
    };
    const serializedTransaction = JSON.stringify(transaction);

    transactionInProgress = true;
    let completed = false;
    try {
      if (!writeVerifiedStorageValue(
        PRESTIGE_TRANSACTION_STORAGE_KEY,
        serializedTransaction
      )) {
        return false;
      }
      if (!completePrestigeTransaction(transaction)) return false;
      completed = true;
      window.location.reload();
      return true;
    } finally {
      if (!completed) transactionInProgress = false;
    }
  }

  function isDevModeEnabled() {
    return typeof DEV_MODE !== "undefined" && DEV_MODE;
  }

  function setPrestigeLevelForDev(level) {
    if (
      !isDevModeEnabled() ||
      transactionInProgress ||
      isPrestigeTransactionPending()
    ) return false;
    const nextLevel = Math.min(
      MAX_AVAILABLE_PRESTIGE,
      normalizePrestigeLevel(level)
    );
    if (!writeVerifiedStorageValue(PRESTIGE_LEVEL_STORAGE_KEY, String(nextLevel))) {
      return false;
    }
    for (const type of PRESTIGE_REWARD_TYPES) {
      const selectedId = normalizeRewardSelection(type, getSelectedReward(type), nextLevel);
      selectedRewardCache[type] = selectedId;
      writeVerifiedStorageValue(PRESTIGE_SELECTION_STORAGE_KEYS[type], selectedId);
    }
    return true;
  }

  function adjustPrestigeLevelForDev(offset) {
    if (!isDevModeEnabled()) return false;
    const numericOffset = Math.trunc(Number(offset));
    if (!Number.isFinite(numericOffset)) return false;
    return setPrestigeLevelForDev(readPrestigeLevel() + numericOffset);
  }

  function createPendingPermanentChoiceForDev() {
    if (!isDevModeEnabled()) return false;
    const prestigeLevel = readPrestigeLevel();
    if (prestigeLevel < 1 || getPendingPermanentWardrobeChoice()) return false;
    const unlockMap = readPermanentWardrobeUnlockMap();
    if (unlockMap[String(prestigeLevel)]) return false;
    return ensurePendingPermanentWardrobeChoice(prestigeLevel);
  }

  function getRewardInspectorData() {
    const prestigeLevel = readPrestigeLevel();
    const selected = Object.fromEntries(
      PRESTIGE_REWARD_TYPES.map(type => [type, getSelectedReward(type)])
    );
    const unlocked = Object.fromEntries(
      PRESTIGE_REWARD_TYPES.map(type => [
        type,
        getUnlockedRewardsByType(type, prestigeLevel).map(reward => reward.id)
      ])
    );
    return {
      prestigeLevel,
      mastered: isPrestigeMastered(),
      permanentWardrobeUnlocks: getPermanentWardrobeUnlocks(),
      pendingPermanentChoice: getPendingPermanentWardrobeChoice(),
      unlocked,
      selected,
      xpMultiplier: getPrestigeXpMultiplier(prestigeLevel)
    };
  }

  function getPrestigeEmblemMarkup(level) {
    const definition = getDisplayPrestigeDefinition(level);
    if (!definition) return "";

    const decorations = {
      1: '<circle class="prestigeMetal" cx="50" cy="51" r="39"/><circle class="prestigeInset" cx="50" cy="51" r="32"/>',
      2: '<circle class="prestigeMetal" cx="50" cy="47" r="35"/><path class="prestigeAccent" d="M31 78 50 90 69 78 64 71 50 80 36 71Z"/>',
      3: '<circle class="prestigeMetal" cx="50" cy="42" r="32"/><path class="prestigeAccent" d="M29 71 50 84 71 71 65 64 50 74 35 64Z"/><path class="prestigeAccent prestigeAccentLight" d="M32 82 50 94 68 82 63 77 50 85 37 77Z"/>',
      4: '<path class="prestigeWing" d="M32 39C19 26 8 29 6 47c8-4 14-2 20 4-10-1-15 4-16 12 9-3 16-1 25 8Z"/><path class="prestigeWing" d="M68 39c13-13 24-10 26 8-8-4-14-2-20 4 10-1 15 4 16 12-9-3-16-1-25 8Z"/><circle class="prestigeMetal" cx="50" cy="52" r="30"/>',
      5: '<path class="prestigeBurst" d="M50 4 59 20 76 12 78 31 96 34 86 50 98 64 80 70 80 89 61 83 50 98 39 83 20 89 20 70 2 64 14 50 4 34 22 31 24 12 41 20Z"/><circle class="prestigeInset" cx="50" cy="51" r="30"/>',
      6: '<path class="prestigeOrnament" d="M27 34C15 23 6 30 8 44c6-5 12-4 18 1-11 1-15 8-12 17 5-5 11-6 17-3Z"/><path class="prestigeOrnament" d="M73 34c12-11 21-4 19 10-6-5-12-4-18 1 11 1 15 8 12 17-5-5-11-6-17-3Z"/><path class="prestigeShield" d="M50 9 80 20v28c0 23-14 36-30 46C34 84 20 71 20 48V20Z"/>',
      7: '<circle class="prestigeMetal" cx="50" cy="54" r="32"/><path class="prestigeCrown" d="M27 27 25 8 41 20 50 4 59 20 75 8 73 27Z"/><path class="prestigeCrownBand" d="M28 27h44l-3 10H31Z"/>',
      8: '<path class="prestigeFlame" d="M22 80C5 64 15 48 27 41c-5 15 4 17 9 8 7-11 0-24 17-40-2 18 15 18 10 36 9-9 14-15 13-27 18 19 21 46 2 63Z"/><path class="prestigeSpeed" d="M8 35h25M4 47h23M10 59h18"/><circle class="prestigeMetal" cx="54" cy="55" r="29"/>',
      9: '<circle class="prestigeCosmic" cx="50" cy="52" r="34"/><ellipse class="prestigeOrbit" cx="50" cy="52" rx="48" ry="19" transform="rotate(-18 50 52)"/><circle class="prestigeStar" cx="11" cy="61" r="4"/><circle class="prestigeStar" cx="87" cy="31" r="3"/><path class="prestigeHalo" d="M29 22c10-8 32-8 42 0-8 7-34 7-42 0Z"/>',
      10: '<path class="prestigeFinalWing" d="M34 31C20 12 5 15 2 37c9-5 16-2 24 6-14-2-21 5-22 16 10-4 19-1 31 10Z"/><path class="prestigeFinalWing" d="M66 31C80 12 95 15 98 37c-9-5-16-2-24 6 14-2 21 5 22 16-10-4-19-1-31 10Z"/><path class="prestigeShield prestigeShieldFinal" d="M50 13 79 24v28c0 22-14 34-29 44C35 86 21 74 21 52V24Z"/><path class="prestigeCrown" d="M29 24 27 6 42 17 50 2 58 17 73 6 71 24Z"/><path class="prestigeCrownBand" d="M30 23h40l-3 9H33Z"/>'
    };

    return `
      <svg class="prestigeEmblem prestigeEmblem--${definition.theme}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="prestigeMetalGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fff4a8"/><stop offset="0.48" stop-color="#d89138"/><stop offset="1" stop-color="#71336f"/>
          </linearGradient>
          <linearGradient id="prestigeSlimeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#dcff83"/><stop offset="0.55" stop-color="#79ed35"/><stop offset="1" stop-color="#2d9d2d"/>
          </linearGradient>
        </defs>
        <g class="prestigeDecoration">${decorations[definition.level] ?? ""}</g>
        <g class="prestigeSlimeCore">
          <path d="M50 19C40 31 30 42 30 57c0 14 8 23 20 23s20-9 20-23C70 42 60 31 50 19Z"/>
          <ellipse class="prestigeSlimeShine" cx="42" cy="41" rx="7" ry="10"/>
          <circle class="prestigeSlimeFace" cx="43" cy="58" r="3"/><circle class="prestigeSlimeFace" cx="57" cy="58" r="3"/>
          <path class="prestigeSlimeSmile" d="M43 67c4 4 10 4 14 0"/>
        </g>
        <text class="prestigeRoman" x="50" y="96">${ROMAN_PRESTIGE_LEVELS[definition.level]}</text>
      </svg>`;
  }

  recoverPendingPrestigeTransaction();
  readPrestigeLevel();
  readPermanentWardrobeUnlockMap();
  getPendingPermanentWardrobeChoice();
  PRESTIGE_REWARD_TYPES.forEach(getSelectedReward);

  window.SlimePrestige = Object.freeze({
    prestigeLevelStorageKey: PRESTIGE_LEVEL_STORAGE_KEY,
    prestigeTransactionStorageKey: PRESTIGE_TRANSACTION_STORAGE_KEY,
    permanentWardrobeUnlocksStorageKey: PERMANENT_WARDROBE_UNLOCKS_STORAGE_KEY,
    pendingWardrobeChoiceStorageKey: PENDING_WARDROBE_CHOICE_STORAGE_KEY,
    selectionStorageKeys: PRESTIGE_SELECTION_STORAGE_KEYS,
    maxAvailablePrestige: MAX_AVAILABLE_PRESTIGE,
    balance: PRESTIGE_BALANCE,
    definitions: PRESTIGE_DEFINITIONS,
    getLevel: readPrestigeLevel,
    getDefinition: getPrestigeDefinition,
    getDisplayDefinition: getDisplayPrestigeDefinition,
    getUnlockedRewards,
    getUnlockedRewardsByType,
    getRewardDefinition,
    getSelectedReward,
    selectReward,
    getXpMultiplier: getPrestigeXpMultiplier,
    configureWardrobeRegistry,
    getPermanentWardrobeUnlocks,
    getPermanentWardrobeCandidates,
    getPendingPermanentWardrobeChoice,
    choosePermanentWardrobeUnlock,
    capturePlayerIdentitySnapshot,
    normalizeIdentitySnapshot,
    getRewardInspectorData,
    getEmblemMarkup: getPrestigeEmblemMarkup,
    isReady: isPrestigeReady,
    isMastered: isPrestigeMastered,
    isTransactionPending: isPrestigeTransactionPending,
    performPrestigeReset,
    setLevelForDev: setPrestigeLevelForDev,
    adjustLevelForDev: adjustPrestigeLevelForDev,
    createPendingPermanentChoiceForDev
  });
})();
