(() => {
  "use strict";

  const UNLOCKED_PERKS_STORAGE_KEY = "slimejumperUnlockedPerks";
  const SELECTED_PERKS_STORAGE_KEY = "slimejumperSelectedPerks";
  const MAX_SELECTED_PERKS = 3;
  const EXCLUSIVE_FLIGHT_ACTION_PERK_IDS = Object.freeze([
    "air_hop",
    "quick_recovery"
  ]);

  const PERK_BALANCE = Object.freeze({
    PERK_UNLOCK_COST: 500,
    EXTRA_LIFE_BONUS: 1,
    POWER_SHOT_MULTIPLIER: 1.09,
    STAR_MAGNET_PULL_RADIUS: 200,
    STAR_MAGNET_PULL_SPEED: 500,
    ANCHOR_STEP_STABILITY_DURATION: 5.0,
    LUCKY_CHARM_EXTRA_STAR_CHANCE: 0.15,
    AIR_HOP_HORIZONTAL_SPEED: 420,
    AIR_HOP_VERTICAL_SPEED: 650,
    LAST_BUBBLE_DURATION: 2.5,
    MUD_SHOES_HORIZONTAL_DAMPING: 0.75,
    MUD_SHOES_REBOUND_MULTIPLIER: 0.55,
    AIR_BRAKE_HORIZONTAL_MULTIPLIER: 0.25,
    STAR_SHIELD_DURATION: 1.0
  });

  function createIcon(paths) {
    return Object.freeze({
      viewBox: "0 0 24 24",
      paths: Object.freeze(paths.map(path => Object.freeze({...path})))
    });
  }

  const PERK_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "air_hop",
      name: "AIR HOP",
      description: "Ein zusätzlicher gerichteter Impuls während einer Flugphase.",
      icon: createIcon([{d: "M5 15 12 4l7 11-7-4Z"}, {d: "M7 20h10", accent: true}]),
      implemented: true,
      category: "mobility"
    }),
    Object.freeze({
      id: "last_bubble",
      name: "LAST BUBBLE",
      description: "Rettet einmal pro Run vor der unteren Death-Zone.",
      icon: createIcon([{d: "M12 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"}, {d: "M8 8c1-2 3-3 5-3", accent: true}]),
      implemented: true,
      category: "survival"
    }),
    Object.freeze({
      id: "extra_life",
      name: "EXTRA LIFE",
      description: "Startet jeden Run mit einem zusätzlichen Leben.",
      icon: createIcon([{d: "M12 20S4 15 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 6-6 11-6 11Z"}, {d: "M12 8v6M9 11h6", accent: true}]),
      implemented: true,
      category: "survival"
    }),
    Object.freeze({
      id: "mud_shoes",
      name: "SCHLAMMSCHUHE",
      description: "Verringert Rollen, Rutschen und Nachfedern nach Landungen.",
      icon: createIcon([{d: "M4 15h7l2 3h7v3H4Z"}, {d: "M7 12v3m3-3v3", accent: true}]),
      implemented: true,
      category: "control"
    }),
    Object.freeze({
      id: "power_shot",
      name: "POWER SHOT",
      description: "Erhöht die maximale Kraft normaler Slingshot-Schüsse.",
      icon: createIcon([{d: "m14 2-8 11h6l-2 9 8-12h-6Z"}]),
      implemented: true,
      category: "power"
    }),
    Object.freeze({
      id: "quick_recovery",
      name: "AIR BRAKE",
      description: "Bremst dich einmal pro Flugphase in der Luft stark ab.",
      icon: createIcon([{d: "M20 8a8 8 0 1 0 1 6"}, {d: "M20 3v5h-5", accent: true}]),
      implemented: true,
      category: "control"
    }),
    Object.freeze({
      id: "sticky_slime",
      name: "STAR SHIELD",
      description: "Der erste Stern eines Lebens gewährt einmalig 1 Sekunde Unverwundbarkeit.",
      icon: createIcon([{d: "M12 2.5 20 5v6c0 5-3.4 8.6-8 10.5C7.4 19.6 4 16 4 11V5Z"}, {d: "m12 7 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z", accent: true}]),
      implemented: true,
      category: "survival"
    }),
    Object.freeze({
      id: "bounce_master",
      name: "BOUNCE MASTER",
      description: "Zeigt beim Zielen die erwartete Flugbahn nach einem Bounce-Pad-Treffer.",
      icon: createIcon([{d: "M4 18h16v3H4Z"}, {d: "m7 14 5-8 5 8-5-3Z", accent: true}]),
      implemented: true,
      category: "power"
    }),
    Object.freeze({
      id: "star_magnet",
      name: "STAR MAGNET",
      description: "Vergrößert die Sammelreichweite für Sterne.",
      icon: createIcon([{d: "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9L6.6 20l1-6.1-4.4-4.3 6.1-.9Z"}]),
      implemented: true,
      category: "utility"
    }),
    Object.freeze({
      id: "slow_fall",
      name: "ANCHOR STEP",
      description: "Fallende Plattformen bleiben nach dem Betreten 5 Sekunden stabil.",
      icon: createIcon([{d: "M12 3v14"}, {d: "m7 12 5 5 5-5M5 21h14", accent: true}]),
      implemented: true,
      category: "mobility"
    }),
    Object.freeze({
      id: "safe_return",
      name: "GHOST STEP",
      description: "Fade-Plattformen bleiben für dich dauerhaft begehbar.",
      icon: createIcon([{d: "M20 11a8 8 0 1 1-3-6"}, {d: "M20 4v7h-7", accent: true}]),
      implemented: true,
      category: "survival"
    }),
    Object.freeze({
      id: "lucky_charm",
      name: "LUCKY CHARM",
      description: "Kann in normalen Levels einen zusätzlichen Stern erzeugen.",
      icon: createIcon([{d: "M12 4a4 4 0 1 0-4 4 4 4 0 1 0 4 4 4 4 0 1 0 4-4 4 4 0 0 0-4-4Z"}, {d: "M12 12v8", accent: true}]),
      implemented: true,
      category: "utility"
    })
  ]);

  const perkById = new Map(PERK_DEFINITIONS.map(perk => [perk.id, perk]));
  let devUnlockOverride = false;
  let devSelectedPerkIds = null;
  let activeRunPerkIds = Object.freeze([]);
  let devForceNextLuckyStar = false;
  let lastLuckyCharmRollResult = "NOT ROLLED";

  function parseStoredArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function normalizeKnownIds(value) {
    if (!Array.isArray(value)) return [];
    const found = new Set(
      value.filter(id => typeof id === "string" && perkById.has(id))
    );
    return PERK_DEFINITIONS.filter(perk => found.has(perk.id)).map(perk => perk.id);
  }

  function normalizeUnlockedIds(value) {
    return normalizeKnownIds(value);
  }

  function enforceFlightActionExclusivity(ids, preferredId = null) {
    if (!EXCLUSIVE_FLIGHT_ACTION_PERK_IDS.every(id => ids.includes(id))) {
      return ids.slice();
    }
    const retainedId = EXCLUSIVE_FLIGHT_ACTION_PERK_IDS.includes(preferredId)
      ? preferredId
      : EXCLUSIVE_FLIGHT_ACTION_PERK_IDS[0];
    return ids.filter(id =>
      !EXCLUSIVE_FLIGHT_ACTION_PERK_IDS.includes(id) || id === retainedId
    );
  }

  function normalizeSelectedIds(value, unlockedIds) {
    const unlocked = new Set(normalizeUnlockedIds(unlockedIds));
    const selectableIds = normalizeKnownIds(value)
      .filter(id => unlocked.has(id) && perkById.get(id).implemented);
    return enforceFlightActionExclusivity(selectableIds)
      .slice(0, MAX_SELECTED_PERKS);
  }

  function persistCanonicalArray(key, ids) {
    const serialized = JSON.stringify(ids);
    try {
      if (localStorage.getItem(key) !== serialized) {
        localStorage.setItem(key, serialized);
      }
      return localStorage.getItem(key) === serialized;
    } catch (_) {
      return false;
    }
  }

  function getStoredUnlockedPerkIds() {
    const ids = normalizeUnlockedIds(parseStoredArray(UNLOCKED_PERKS_STORAGE_KEY));
    persistCanonicalArray(UNLOCKED_PERKS_STORAGE_KEY, ids);
    return ids;
  }

  function getStoredSelectedPerkIds() {
    const ids = normalizeSelectedIds(
      parseStoredArray(SELECTED_PERKS_STORAGE_KEY),
      getStoredUnlockedPerkIds()
    );
    persistCanonicalArray(SELECTED_PERKS_STORAGE_KEY, ids);
    return ids;
  }

  function unlockPerkForPurchase(id) {
    const perk = perkById.get(id);
    if (!perk?.implemented) return false;
    const unlocked = getStoredUnlockedPerkIds();
    if (unlocked.includes(id)) return true;
    const updated = normalizeUnlockedIds([...unlocked, id]);
    if (!persistCanonicalArray(UNLOCKED_PERKS_STORAGE_KEY, updated)) return false;
    return getStoredUnlockedPerkIds().includes(id);
  }

  function rollbackPerkUnlock(id) {
    const updated = getStoredUnlockedPerkIds().filter(unlockedId => unlockedId !== id);
    if (!persistCanonicalArray(UNLOCKED_PERKS_STORAGE_KEY, updated)) return false;
    return !getStoredUnlockedPerkIds().includes(id);
  }

  function getPerkPurchaseEconomy() {
    const devShopTest = window.SlimeDevShopTest;
    return devShopTest?.isActive?.() === true &&
      typeof devShopTest.purchaseUnlock === "function"
      ? devShopTest
      : window.SlimeStarEconomy;
  }

  function purchasePerk(id) {
    const perk = perkById.get(id);
    const economy = getPerkPurchaseEconomy();
    const balance = economy?.getBalance?.() ?? 0;
    if (!perk) return {ok: false, reason: "unknown-perk", balance};
    if (!perk.implemented) return {ok: false, reason: "coming-soon", balance};
    if (getStoredUnlockedPerkIds().includes(id)) {
      return {ok: false, reason: "already-unlocked", balance};
    }
    if (typeof economy?.purchaseUnlock !== "function") {
      return {ok: false, reason: "economy-unavailable", balance};
    }

    return economy.purchaseUnlock({
      purchaseKey: `perk:${id}`,
      price: PERK_BALANCE.PERK_UNLOCK_COST,
      isUnlocked: () => getStoredUnlockedPerkIds().includes(id),
      unlock: () => unlockPerkForPurchase(id),
      rollback: () => rollbackPerkUnlock(id)
    });
  }

  function getUnlockedPerkIds() {
    const storedIds = getStoredUnlockedPerkIds();
    if (!devUnlockOverride) return storedIds;
    const unlocked = new Set(storedIds);
    PERK_DEFINITIONS.forEach(perk => {
      if (perk.implemented) unlocked.add(perk.id);
    });
    return PERK_DEFINITIONS.filter(perk => unlocked.has(perk.id)).map(perk => perk.id);
  }

  function getSelectedPerkIds() {
    return devSelectedPerkIds === null
      ? getStoredSelectedPerkIds()
      : devSelectedPerkIds.slice();
  }

  function toggleSelectedPerk(id) {
    const perk = perkById.get(id);
    if (!perk) return {ok: false, reason: "unknown-perk", selected: getSelectedPerkIds()};
    if (!perk.implemented) {
      return {ok: false, reason: "coming-soon", selected: getSelectedPerkIds()};
    }
    if (!getUnlockedPerkIds().includes(id)) {
      return {ok: false, reason: "locked", selected: getSelectedPerkIds()};
    }

    const selected = getSelectedPerkIds();
    const selectedIndex = selected.indexOf(id);
    if (selectedIndex >= 0) {
      selected.splice(selectedIndex, 1);
    } else {
      const incompatibleId = EXCLUSIVE_FLIGHT_ACTION_PERK_IDS.includes(id)
        ? EXCLUSIVE_FLIGHT_ACTION_PERK_IDS.find(perkId => perkId !== id)
        : null;
      if (incompatibleId) {
        const incompatibleIndex = selected.indexOf(incompatibleId);
        if (incompatibleIndex >= 0) selected.splice(incompatibleIndex, 1);
      }
      if (selected.length >= MAX_SELECTED_PERKS) {
        return {ok: false, reason: "max-selected", selected};
      }
      selected.push(id);
    }

    const normalized = normalizeSelectedIds(selected, getUnlockedPerkIds());
    if (devSelectedPerkIds !== null) {
      devSelectedPerkIds = normalized;
      return {ok: true, reason: "updated", selected: normalized.slice()};
    }
    const saved = persistCanonicalArray(SELECTED_PERKS_STORAGE_KEY, normalized);
    return {ok: saved, reason: saved ? "updated" : "storage-error", selected: normalized};
  }

  function setDevUnlockOverride(enabled) {
    const nextEnabled = enabled === true;
    if (nextEnabled === devUnlockOverride) return devUnlockOverride;
    devUnlockOverride = nextEnabled;
    devSelectedPerkIds = nextEnabled ? getStoredSelectedPerkIds() : null;
    return devUnlockOverride;
  }

  function resetDevPerkPurchaseTestState() {
    if (
      typeof DEV_MODE === "undefined" ||
      !DEV_MODE ||
      window.SlimeDevShopTest?.isActive?.() !== true
    ) return false;

    const selectedReset = persistCanonicalArray(SELECTED_PERKS_STORAGE_KEY, []);
    const unlockedReset = persistCanonicalArray(UNLOCKED_PERKS_STORAGE_KEY, []);
    if (!selectedReset || !unlockedReset) return false;

    devUnlockOverride = false;
    devSelectedPerkIds = null;
    clearRunPerkSnapshot();
    return true;
  }

  function captureRunPerkSnapshot() {
    const selectedForRun = enforceFlightActionExclusivity(getSelectedPerkIds());
    activeRunPerkIds = Object.freeze(selectedForRun.slice(0, MAX_SELECTED_PERKS));
    return activeRunPerkIds.slice();
  }

  function clearRunPerkSnapshot() {
    activeRunPerkIds = Object.freeze([]);
    lastLuckyCharmRollResult = "NOT ROLLED";
  }

  function getActiveRunPerkIds() {
    return activeRunPerkIds.slice();
  }

  function isActiveForRun(id) {
    return activeRunPerkIds.includes(id);
  }

  function requestDevForceNextLuckyStar() {
    devForceNextLuckyStar = true;
    return devForceNextLuckyStar;
  }

  function shouldGenerateLuckyCharmBonusStar(random) {
    const forceThisLevel = devForceNextLuckyStar;
    devForceNextLuckyStar = false;

    if (!isActiveForRun("lucky_charm")) {
      lastLuckyCharmRollResult = "NOT ROLLED";
      return false;
    }

    // Auch beim DEV-Force wird genau ein Wert konsumiert, damit die restliche
    // Seed-Sequenz und damit das generierte Level unverändert reproduzierbar bleibt.
    const roll = typeof random === "function" ? Number(random()) : 1;
    const succeeded = forceThisLevel || (
      Number.isFinite(roll) &&
      roll >= 0 &&
      roll < PERK_BALANCE.LUCKY_CHARM_EXTRA_STAR_CHANCE
    );
    lastLuckyCharmRollResult = succeeded ? "SUCCESS" : "FAIL";
    return succeeded;
  }

  window.SlimePerks = Object.freeze({
    definitions: PERK_DEFINITIONS,
    balance: PERK_BALANCE,
    maxSelected: MAX_SELECTED_PERKS,
    unlockedStorageKey: UNLOCKED_PERKS_STORAGE_KEY,
    selectedStorageKey: SELECTED_PERKS_STORAGE_KEY,
    normalizeUnlockedIds,
    normalizeSelectedIds,
    getStoredUnlockedPerkIds,
    getStoredSelectedPerkIds,
    getUnlockedPerkIds,
    getSelectedPerkIds,
    purchasePerk,
    toggleSelectedPerk,
    setDevUnlockOverride,
    isDevUnlockOverrideActive: () => devUnlockOverride,
    resetDevPerkPurchaseTestState,
    captureRunPerkSnapshot,
    clearRunPerkSnapshot,
    getActiveRunPerkIds,
    isActiveForRun,
    requestDevForceNextLuckyStar,
    isDevForceNextLuckyStarPending: () => devForceNextLuckyStar,
    shouldGenerateLuckyCharmBonusStar,
    getLastLuckyCharmRollResult: () => lastLuckyCharmRollResult
  });
})();

