(() => {
  "use strict";

  const GOLD_PROGRESS_STORAGE_KEY = "slimejumperGoldProgressV1";
  const GOLD_SLIME_STAR_PRICE = 5000;
  const GOLD_SHOP_ITEM_STAR_PRICE = 1000;
  const GOLD_MASTERY_LEVEL_REQUIREMENT = 500;
  const GOLD_MASTERY_DISTINCT_REQUIREMENT = 5;

  const GOLD_SLIME_PALETTE = Object.freeze({
    specular: "#fff1b0",
    light: "#f5d76e",
    main: "#dfaf24",
    dark: "#a96f00",
    outline: "#6a4300",
    glow: "#ffe28a",
    trail: "223,175,36",
    face: "#3b2600"
  });

  const GOLD_MATERIAL_PALETTE = Object.freeze({
    frame: "#a96f00",
    lens: "#dfaf24",
    shine: "#fff1b0",
    main: "#dfaf24",
    dark: "#6a4300",
    light: "#f5d76e",
    band: "#a96f00",
    trim: "#fff1b0",
    horn: "#f5d76e",
    accent: "#fff1b0",
    inner: "#a96f00",
    tassel: "#f5d76e",
    spots: "#fff1b0",
    gills: "#a96f00",
    bell: "#fff1b0",
    weave: "#a96f00",
    underside: "#8a5900"
  });

  function getColorIds() {
    return typeof SLIME_COLOR_ORDER === "undefined"
      ? []
      : SLIME_COLOR_ORDER.slice();
  }

  function getHatIds() {
    return typeof UNLOCKABLE_SLIME_COSMETICS === "undefined"
      ? []
      : UNLOCKABLE_SLIME_COSMETICS.slice();
  }

  function getBeardIds() {
    return typeof UNLOCKABLE_SLIME_BEARDS === "undefined"
      ? []
      : UNLOCKABLE_SLIME_BEARDS.slice();
  }

  function createDefaultGoldState() {
    return {
      slime: {
        completedLevels: 0,
        distinctColorIds: [],
        masteryUnlocked: false,
        purchased: false
      },
      hats: {
        completedLevels: 0,
        distinctHatIds: [],
        masteryUnlocked: false,
        purchasedGoldHatIds: []
      },
      beards: {
        completedLevels: 0,
        distinctBeardIds: [],
        masteryUnlocked: false,
        purchasedGoldBeardIds: []
      },
      equipped: {
        slime: false,
        hatId: null,
        beardId: null
      }
    };
  }

  function normalizeProgressCount(value) {
    const count = Math.floor(Number(value));
    return Number.isSafeInteger(count) && count > 0
      ? Math.min(GOLD_MASTERY_LEVEL_REQUIREMENT, count)
      : 0;
  }

  function normalizeIds(value, allowedIds) {
    if (!Array.isArray(value)) return [];
    const requested = new Set(
      value.map(id => String(id ?? "").toLowerCase())
    );
    return allowedIds.filter(id => requested.has(id));
  }

  function meetsMasteryRequirement(completedLevels, distinctIds) {
    return completedLevels >= GOLD_MASTERY_LEVEL_REQUIREMENT &&
      distinctIds.length >= GOLD_MASTERY_DISTINCT_REQUIREMENT;
  }

  function ownsGoldSlimeFromState(state) {
    return state.slime.masteryUnlocked || state.slime.purchased;
  }

  function ownsGoldHatFromState(state, hatId) {
    return state.hats.masteryUnlocked ||
      state.hats.purchasedGoldHatIds.includes(hatId);
  }

  function ownsGoldBeardFromState(state, beardId) {
    return state.beards.masteryUnlocked ||
      state.beards.purchasedGoldBeardIds.includes(beardId);
  }

  function normalizeGoldState(value) {
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const state = createDefaultGoldState();

    state.slime.completedLevels = normalizeProgressCount(source.slime?.completedLevels);
    state.slime.distinctColorIds = normalizeIds(
      source.slime?.distinctColorIds,
      getColorIds()
    );
    state.slime.masteryUnlocked = source.slime?.masteryUnlocked === true ||
      meetsMasteryRequirement(
        state.slime.completedLevels,
        state.slime.distinctColorIds
      );
    state.slime.purchased = source.slime?.purchased === true;

    state.hats.completedLevels = normalizeProgressCount(source.hats?.completedLevels);
    state.hats.distinctHatIds = normalizeIds(
      source.hats?.distinctHatIds,
      getHatIds()
    );
    state.hats.masteryUnlocked = source.hats?.masteryUnlocked === true ||
      meetsMasteryRequirement(
        state.hats.completedLevels,
        state.hats.distinctHatIds
      );
    state.hats.purchasedGoldHatIds = normalizeIds(
      source.hats?.purchasedGoldHatIds,
      getHatIds()
    );

    state.beards.completedLevels = normalizeProgressCount(source.beards?.completedLevels);
    state.beards.distinctBeardIds = normalizeIds(
      source.beards?.distinctBeardIds,
      getBeardIds()
    );
    state.beards.masteryUnlocked = source.beards?.masteryUnlocked === true ||
      meetsMasteryRequirement(
        state.beards.completedLevels,
        state.beards.distinctBeardIds
      );
    state.beards.purchasedGoldBeardIds = normalizeIds(
      source.beards?.purchasedGoldBeardIds,
      getBeardIds()
    );

    const equippedHatId = String(source.equipped?.hatId ?? "").toLowerCase();
    const equippedBeardId = String(source.equipped?.beardId ?? "").toLowerCase();
    state.equipped.slime = source.equipped?.slime === true &&
      ownsGoldSlimeFromState(state);
    state.equipped.hatId = getHatIds().includes(equippedHatId) &&
      ownsGoldHatFromState(state, equippedHatId)
      ? equippedHatId
      : null;
    state.equipped.beardId = getBeardIds().includes(equippedBeardId) &&
      ownsGoldBeardFromState(state, equippedBeardId)
      ? equippedBeardId
      : null;

    return state;
  }

  function cloneGoldState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function loadGoldState() {
    try {
      return normalizeGoldState(JSON.parse(
        localStorage.getItem(GOLD_PROGRESS_STORAGE_KEY) || "null"
      ));
    } catch (_) {
      return createDefaultGoldState();
    }
  }

  let goldState = loadGoldState();

  function notifyGoldChange() {
    try {
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new window.CustomEvent("slimegoldchange"));
      }
    } catch (_) {}
  }

  function persistGoldState(nextState, {notify = true} = {}) {
    const normalized = normalizeGoldState(nextState);
    const serialized = JSON.stringify(normalized);
    try {
      localStorage.setItem(GOLD_PROGRESS_STORAGE_KEY, serialized);
      if (localStorage.getItem(GOLD_PROGRESS_STORAGE_KEY) !== serialized) {
        return false;
      }
    } catch (_) {
      return false;
    }
    goldState = normalized;
    if (notify) notifyGoldChange();
    return true;
  }

  persistGoldState(goldState, {notify: false});

  function isDevModeEnabled() {
    return typeof DEV_MODE !== "undefined" && DEV_MODE;
  }

  const devState = {
    visualSlime: false,
    visualHats: false,
    visualBeards: false,
    shopUnlocked: false,
    balance: GOLD_SLIME_STAR_PRICE,
    purchasedSlime: false,
    purchasedHatIds: new Set(),
    purchasedBeardIds: new Set(),
    equipped: {slime: false, hatId: null, beardId: null},
    normalOverride: {slime: false, hat: false, beard: false},
    purchaseInProgress: false
  };

  function resetDevRuntimeState() {
    devState.visualSlime = false;
    devState.visualHats = false;
    devState.visualBeards = false;
    devState.shopUnlocked = false;
    devState.balance = GOLD_SLIME_STAR_PRICE;
    devState.purchasedSlime = false;
    devState.purchasedHatIds.clear();
    devState.purchasedBeardIds.clear();
    devState.equipped = {slime: false, hatId: null, beardId: null};
    devState.normalOverride = {slime: false, hat: false, beard: false};
    devState.purchaseInProgress = false;
    notifyGoldChange();
  }

  function isGoldSlimeMasteryUnlocked() {
    return goldState.slime.masteryUnlocked;
  }

  function isGoldHatMasteryUnlocked() {
    return goldState.hats.masteryUnlocked;
  }

  function isGoldBeardMasteryUnlocked() {
    return goldState.beards.masteryUnlocked;
  }

  function isGoldShopUnlocked() {
    return ownsGoldSlime();
  }

  function ownsGoldSlime() {
    return ownsGoldSlimeFromState(goldState) ||
      (isDevModeEnabled() && devState.purchasedSlime);
  }

  function ownsGoldHat(hatId) {
    const normalized = String(hatId ?? "").toLowerCase();
    return getHatIds().includes(normalized) &&
      ownsGoldHatFromState(goldState, normalized);
  }

  function ownsGoldBeard(beardId) {
    const normalized = String(beardId ?? "").toLowerCase();
    return getBeardIds().includes(normalized) &&
      ownsGoldBeardFromState(goldState, normalized);
  }

  function canUseGoldSlime() {
    return ownsGoldSlime() || (
      isDevModeEnabled() && (devState.visualSlime || devState.purchasedSlime)
    );
  }

  function canUseGoldHat(hatId) {
    const normalized = String(hatId ?? "").toLowerCase();
    return ownsGoldHat(normalized) || (
      isDevModeEnabled() && getHatIds().includes(normalized) &&
      (devState.visualHats || devState.purchasedHatIds.has(normalized))
    );
  }

  function canUseGoldBeard(beardId) {
    const normalized = String(beardId ?? "").toLowerCase();
    return ownsGoldBeard(normalized) || (
      isDevModeEnabled() && getBeardIds().includes(normalized) &&
      (devState.visualBeards || devState.purchasedBeardIds.has(normalized))
    );
  }

  function getEquippedAppearance() {
    const devEnabled = isDevModeEnabled();
    const slime = devEnabled && devState.normalOverride.slime
      ? false
      : devEnabled && devState.equipped.slime && canUseGoldSlime()
        ? true
        : goldState.equipped.slime && ownsGoldSlime();
    const devHatId = devState.equipped.hatId;
    const hatId = devEnabled && devState.normalOverride.hat
      ? null
      : devEnabled && devHatId && canUseGoldHat(devHatId)
        ? devHatId
        : goldState.equipped.hatId && ownsGoldHat(goldState.equipped.hatId)
          ? goldState.equipped.hatId
          : null;
    const devBeardId = devState.equipped.beardId;
    const beardId = devEnabled && devState.normalOverride.beard
      ? null
      : devEnabled && devBeardId && canUseGoldBeard(devBeardId)
        ? devBeardId
        : goldState.equipped.beardId && ownsGoldBeard(goldState.equipped.beardId)
          ? goldState.equipped.beardId
          : null;
    return {slime, hatId, beardId};
  }

  function equipGoldSlime() {
    if (!canUseGoldSlime()) return false;
    if (isDevModeEnabled()) {
      devState.normalOverride.slime = false;
      devState.equipped.slime = true;
      notifyGoldChange();
      return true;
    }
    const nextState = cloneGoldState(goldState);
    nextState.equipped.slime = true;
    return persistGoldState(nextState);
  }

  function equipGoldHat(hatId) {
    const normalized = String(hatId ?? "").toLowerCase();
    if (!canUseGoldHat(normalized)) return false;
    if (isDevModeEnabled()) {
      devState.normalOverride.hat = false;
      devState.equipped.hatId = normalized;
      notifyGoldChange();
      return true;
    }
    const nextState = cloneGoldState(goldState);
    nextState.equipped.hatId = normalized;
    return persistGoldState(nextState);
  }

  function equipGoldBeard(beardId) {
    const normalized = String(beardId ?? "").toLowerCase();
    if (!canUseGoldBeard(normalized)) return false;
    if (isDevModeEnabled()) {
      devState.normalOverride.beard = false;
      devState.equipped.beardId = normalized;
      notifyGoldChange();
      return true;
    }
    const nextState = cloneGoldState(goldState);
    nextState.equipped.beardId = normalized;
    return persistGoldState(nextState);
  }

  function useNormalAppearance(category) {
    const normalized = String(category ?? "").toLowerCase();
    if (!["slime", "hat", "beard"].includes(normalized)) return false;
    if (isDevModeEnabled()) {
      devState.normalOverride[normalized] = true;
      if (normalized === "slime") devState.equipped.slime = false;
      if (normalized === "hat") devState.equipped.hatId = null;
      if (normalized === "beard") devState.equipped.beardId = null;
      notifyGoldChange();
      return true;
    }
    const nextState = cloneGoldState(goldState);
    if (normalized === "slime") nextState.equipped.slime = false;
    if (normalized === "hat") nextState.equipped.hatId = null;
    if (normalized === "beard") nextState.equipped.beardId = null;
    return persistGoldState(nextState);
  }

  function addDistinctId(ids, id, allowedIds) {
    const normalized = String(id ?? "").toLowerCase();
    if (!allowedIds.includes(normalized) || ids.includes(normalized)) return false;
    ids.push(normalized);
    return true;
  }

  function recordCompletedLevel({
    colorId = null,
    cosmeticId = null,
    beardId = null,
    usesGoldSlime = false,
    usesGoldHat = false,
    usesGoldBeard = false
  } = {}) {
    const nextState = cloneGoldState(goldState);
    const shopWasUnlocked = isGoldShopUnlocked();
    const masteryBefore = {
      slime: nextState.slime.masteryUnlocked,
      hats: nextState.hats.masteryUnlocked,
      beards: nextState.beards.masteryUnlocked
    };

    nextState.slime.completedLevels = Math.min(
      GOLD_MASTERY_LEVEL_REQUIREMENT,
      nextState.slime.completedLevels + 1
    );
    if (!usesGoldSlime) {
      addDistinctId(nextState.slime.distinctColorIds, colorId, getColorIds());
    }

    const normalizedHatId = String(cosmeticId ?? "").toLowerCase();
    if (!usesGoldHat && getHatIds().includes(normalizedHatId)) {
      nextState.hats.completedLevels = Math.min(
        GOLD_MASTERY_LEVEL_REQUIREMENT,
        nextState.hats.completedLevels + 1
      );
      addDistinctId(nextState.hats.distinctHatIds, normalizedHatId, getHatIds());
    }

    const normalizedBeardId = String(beardId ?? "").toLowerCase();
    if (!usesGoldBeard && getBeardIds().includes(normalizedBeardId)) {
      nextState.beards.completedLevels = Math.min(
        GOLD_MASTERY_LEVEL_REQUIREMENT,
        nextState.beards.completedLevels + 1
      );
      addDistinctId(nextState.beards.distinctBeardIds, normalizedBeardId, getBeardIds());
    }

    nextState.slime.masteryUnlocked = nextState.slime.masteryUnlocked ||
      meetsMasteryRequirement(
        nextState.slime.completedLevels,
        nextState.slime.distinctColorIds
      );
    nextState.hats.masteryUnlocked = nextState.hats.masteryUnlocked ||
      meetsMasteryRequirement(
        nextState.hats.completedLevels,
        nextState.hats.distinctHatIds
      );
    nextState.beards.masteryUnlocked = nextState.beards.masteryUnlocked ||
      meetsMasteryRequirement(
        nextState.beards.completedLevels,
        nextState.beards.distinctBeardIds
      );

    if (!persistGoldState(nextState)) {
      return {ok: false, newlyUnlocked: [], shopUnlocked: shopWasUnlocked};
    }

    const newlyUnlocked = [];
    if (!masteryBefore.slime && goldState.slime.masteryUnlocked) newlyUnlocked.push("slime");
    if (!masteryBefore.hats && goldState.hats.masteryUnlocked) newlyUnlocked.push("hats");
    if (!masteryBefore.beards && goldState.beards.masteryUnlocked) newlyUnlocked.push("beards");
    return {
      ok: true,
      newlyUnlocked,
      shopUnlocked: isGoldShopUnlocked(),
      shopJustUnlocked: !shopWasUnlocked && isGoldShopUnlocked()
    };
  }

  function normalizePurchaseTarget(category, itemId = null) {
    const normalizedCategory = String(category ?? "").toLowerCase();
    if (normalizedCategory === "slime") {
      return {category: "slime", id: "gold_slime"};
    }
    const normalizedId = String(itemId ?? "").toLowerCase();
    if (normalizedCategory === "hat" && getHatIds().includes(normalizedId)) {
      return {category: "hat", id: normalizedId};
    }
    if (normalizedCategory === "beard" && getBeardIds().includes(normalizedId)) {
      return {category: "beard", id: normalizedId};
    }
    return null;
  }

  function getPurchaseTargetPrice(target) {
    return target?.category === "slime"
      ? GOLD_SLIME_STAR_PRICE
      : GOLD_SHOP_ITEM_STAR_PRICE;
  }

  function ownsPurchaseTarget(target) {
    if (!target) return false;
    if (target.category === "slime") return ownsGoldSlime();
    if (target.category === "hat") return ownsGoldHat(target.id);
    return ownsGoldBeard(target.id);
  }

  function addPurchasedTarget(target) {
    if (!target || ownsPurchaseTarget(target)) return false;
    const nextState = cloneGoldState(goldState);
    if (target.category === "slime") nextState.slime.purchased = true;
    if (target.category === "hat") {
      nextState.hats.purchasedGoldHatIds.push(target.id);
    }
    if (target.category === "beard") {
      nextState.beards.purchasedGoldBeardIds.push(target.id);
    }
    return persistGoldState(nextState);
  }

  function removePurchasedTarget(target) {
    if (!target) return false;
    const nextState = cloneGoldState(goldState);
    if (target.category === "slime") nextState.slime.purchased = false;
    if (target.category === "hat") {
      nextState.hats.purchasedGoldHatIds =
        nextState.hats.purchasedGoldHatIds.filter(id => id !== target.id);
    }
    if (target.category === "beard") {
      nextState.beards.purchasedGoldBeardIds =
        nextState.beards.purchasedGoldBeardIds.filter(id => id !== target.id);
    }
    return persistGoldState(nextState);
  }

  function createEconomyPurchaseRequest(target) {
    return {
      purchaseKey: `gold:${target.category}:${target.id}`,
      price: getPurchaseTargetPrice(target),
      isUnlocked: () => ownsPurchaseTarget(target),
      unlock: () => addPurchasedTarget(target),
      rollback: () => removePurchasedTarget(target)
    };
  }

  function isGoldShopAccessible() {
    return isGoldShopUnlocked() || (isDevModeEnabled() && devState.shopUnlocked);
  }

  function isDevTargetOwned(target) {
    if (!target) return false;
    if (ownsPurchaseTarget(target)) return true;
    if (target.category === "slime") {
      return devState.visualSlime || devState.purchasedSlime;
    }
    if (target.category === "hat") {
      return devState.visualHats || devState.purchasedHatIds.has(target.id);
    }
    return devState.visualBeards || devState.purchasedBeardIds.has(target.id);
  }

  function canPurchaseDevTarget(target) {
    const price = getPurchaseTargetPrice(target);
    return isDevModeEnabled() &&
      devState.shopUnlocked &&
      !isDevTargetOwned(target) &&
      !devState.purchaseInProgress &&
      devState.balance >= price;
  }

  function purchaseDevTarget(target) {
    if (!isDevModeEnabled() || !devState.shopUnlocked) {
      return {ok: false, reason: "shop-locked", balance: devState.balance};
    }
    if (!target) {
      return {ok: false, reason: "invalid-item", balance: devState.balance};
    }
    if (isDevTargetOwned(target)) {
      return {ok: false, reason: "already-unlocked", balance: devState.balance};
    }
    const price = getPurchaseTargetPrice(target);
    if (devState.balance < price) {
      return {ok: false, reason: "insufficient-stars", balance: devState.balance};
    }
    if (devState.purchaseInProgress) {
      return {ok: false, reason: "purchase-in-progress", balance: devState.balance};
    }

    devState.purchaseInProgress = true;
    try {
      devState.balance -= price;
      if (target.category === "slime") devState.purchasedSlime = true;
      if (target.category === "hat") devState.purchasedHatIds.add(target.id);
      if (target.category === "beard") devState.purchasedBeardIds.add(target.id);
      notifyGoldChange();
      return {
        ok: true,
        test: true,
        category: target.category,
        id: target.id,
        price,
        balance: devState.balance
      };
    } finally {
      devState.purchaseInProgress = false;
    }
  }

  function canPurchaseGoldItem(category, itemId = null) {
    const target = normalizePurchaseTarget(category, itemId);
    if (!target) return false;
    if (isDevModeEnabled() && devState.shopUnlocked) {
      return canPurchaseDevTarget(target);
    }
    if (isDevModeEnabled()) return false;
    if (target.category === "slime") {
      return window.SlimeStarEconomy?.canPurchaseUnlock?.(
        createEconomyPurchaseRequest(target)
      ) === true;
    }
    if (!isGoldShopAccessible()) return false;
    if (!isGoldShopUnlocked()) return false;
    return window.SlimeStarEconomy?.canPurchaseUnlock?.(
      createEconomyPurchaseRequest(target)
    ) === true;
  }

  function purchaseGoldItem(category, itemId = null) {
    const target = normalizePurchaseTarget(category, itemId);
    const balance = window.SlimeStarEconomy?.getBalance?.() ?? 0;
    if (!target) return {ok: false, reason: "invalid-item", balance};
    if (isDevModeEnabled() && devState.shopUnlocked) return purchaseDevTarget(target);
    if (isDevModeEnabled()) return {ok: false, reason: "dev-mode", balance};
    if (target.category !== "slime" && !isGoldShopAccessible()) {
      return {ok: false, reason: "shop-locked", balance};
    }
    if (target.category !== "slime" && !isGoldShopUnlocked()) {
      return {ok: false, reason: "shop-locked", balance};
    }
    const result = window.SlimeStarEconomy?.purchaseUnlock?.(
      createEconomyPurchaseRequest(target)
    );
    return result?.ok
      ? {...result, category: target.category, id: target.id}
      : result ?? {ok: false, reason: "economy-unavailable", balance};
  }

  function setDevVisualCategory(category, enabled) {
    if (!isDevModeEnabled()) return false;
    const normalized = String(category ?? "").toLowerCase();
    const value = Boolean(enabled);
    if (normalized === "slime") devState.visualSlime = value;
    else if (normalized === "hats") devState.visualHats = value;
    else if (normalized === "beards") devState.visualBeards = value;
    else return false;
    if (!value) {
      if (normalized === "slime") devState.equipped.slime = false;
      if (normalized === "hats") devState.equipped.hatId = null;
      if (normalized === "beards") devState.equipped.beardId = null;
    }
    notifyGoldChange();
    return true;
  }

  function setDevVisualAll(enabled) {
    if (!isDevModeEnabled()) return false;
    const value = Boolean(enabled);
    devState.visualSlime = value;
    devState.visualHats = value;
    devState.visualBeards = value;
    if (!value) {
      devState.equipped = {slime: false, hatId: null, beardId: null};
    }
    notifyGoldChange();
    return true;
  }

  function setDevShopUnlocked(enabled) {
    if (!isDevModeEnabled()) return false;
    devState.shopUnlocked = Boolean(enabled);
    devState.balance = GOLD_SLIME_STAR_PRICE;
    devState.purchasedSlime = false;
    devState.purchasedHatIds.clear();
    devState.purchasedBeardIds.clear();
    notifyGoldChange();
    return true;
  }

  function setDevShopBalance(value) {
    if (!isDevModeEnabled() || !devState.shopUnlocked) return false;
    const balance = Math.floor(Number(value));
    if (!Number.isSafeInteger(balance) || balance < 0) return false;
    devState.balance = balance;
    notifyGoldChange();
    return true;
  }

  function prepareDevMasteryBoundary(category) {
    if (!isDevModeEnabled()) return false;
    const normalized = String(category ?? "").toLowerCase();
    const nextState = createDefaultGoldState();
    if (normalized === "slime") {
      nextState.slime.completedLevels = GOLD_MASTERY_LEVEL_REQUIREMENT - 1;
      nextState.slime.distinctColorIds = getColorIds().slice(
        0,
        GOLD_MASTERY_DISTINCT_REQUIREMENT
      );
    } else if (normalized === "hats") {
      nextState.hats.completedLevels = GOLD_MASTERY_LEVEL_REQUIREMENT - 1;
      nextState.hats.distinctHatIds = getHatIds().slice(
        0,
        GOLD_MASTERY_DISTINCT_REQUIREMENT
      );
    } else if (normalized === "beards") {
      nextState.beards.completedLevels = GOLD_MASTERY_LEVEL_REQUIREMENT - 1;
      nextState.beards.distinctBeardIds = getBeardIds().slice(
        0,
        GOLD_MASTERY_DISTINCT_REQUIREMENT
      );
    } else {
      return false;
    }
    const preservePurchasedSlime = normalized === "slime" &&
      devState.shopUnlocked &&
      devState.purchasedSlime;
    const preservedBalance = devState.balance;
    resetDevRuntimeState();
    if (preservePurchasedSlime) {
      devState.shopUnlocked = true;
      devState.purchasedSlime = true;
      devState.balance = preservedBalance;
    }
    return persistGoldState(nextState);
  }

  function resetGoldProgressForDev() {
    if (!isDevModeEnabled()) return false;
    resetDevRuntimeState();
    return persistGoldState(createDefaultGoldState());
  }

  function getProgress() {
    return cloneGoldState(goldState);
  }

  function getDevState() {
    return {
      visualSlime: devState.visualSlime,
      visualHats: devState.visualHats,
      visualBeards: devState.visualBeards,
      shopUnlocked: devState.shopUnlocked,
      balance: devState.balance,
      purchasedSlime: devState.purchasedSlime,
      purchasedHatIds: [...devState.purchasedHatIds],
      purchasedBeardIds: [...devState.purchasedBeardIds]
    };
  }

  window.SlimeGold = Object.freeze({
    storageKey: GOLD_PROGRESS_STORAGE_KEY,
    slimePrice: GOLD_SLIME_STAR_PRICE,
    itemPrice: GOLD_SHOP_ITEM_STAR_PRICE,
    masteryLevelRequirement: GOLD_MASTERY_LEVEL_REQUIREMENT,
    masteryDistinctRequirement: GOLD_MASTERY_DISTINCT_REQUIREMENT,
    getSlimePalette: () => GOLD_SLIME_PALETTE,
    getMaterialPalette: () => GOLD_MATERIAL_PALETTE,
    getProgress,
    recordCompletedLevel,
    isGoldShopUnlocked,
    isGoldShopAccessible,
    isGoldSlimeMasteryUnlocked,
    isGoldHatMasteryUnlocked,
    isGoldBeardMasteryUnlocked,
    ownsGoldSlime,
    ownsGoldHat,
    ownsGoldBeard,
    canUseGoldSlime,
    canUseGoldHat,
    canUseGoldBeard,
    getEquippedAppearance,
    equipGoldSlime,
    equipGoldHat,
    equipGoldBeard,
    useNormalAppearance,
    canPurchaseGoldItem,
    purchaseGoldItem,
    canPurchaseGoldSlime: () => canPurchaseGoldItem("slime"),
    purchaseGoldSlime: () => purchaseGoldItem("slime"),
    getGoldHatIds: getHatIds,
    getGoldBeardIds: getBeardIds,
    setDevVisualCategory,
    setDevVisualAll,
    setDevShopUnlocked,
    setDevShopBalance,
    prepareDevMasteryBoundary,
    resetGoldProgressForDev,
    getDevState
  });
})();
