"use strict";

  const WARDROBE_UNLOCK_START = 15;
  const WARDROBE_UNLOCK_STEP = 5;
  const WARDROBE_UNLOCK_ITEM_COUNT =
    (SLIME_COLOR_ORDER.length - 1) +
    UNLOCKABLE_SLIME_COSMETICS.length +
    UNLOCKABLE_SLIME_BEARDS.length;
  const WARDROBE_UNLOCK_REQUIREMENTS = Object.freeze(
    Array.from(
      {length: WARDROBE_UNLOCK_ITEM_COUNT},
      (_, index) => WARDROBE_UNLOCK_START + index * WARDROBE_UNLOCK_STEP
    )
  );

  const WARDROBE_PROGRESS_VERSION_STORAGE_KEY = "slimejumperWardrobeProgressVersion";
  const WARDROBE_PROGRESS_VERSION = "unified-wardrobe-v1";
  const PENDING_WARDROBE_UNLOCK_CHOICES_STORAGE_KEY =
    "slimejumperPendingWardrobeUnlockChoices";

  function getUnlockedWardrobeItemCount() {
    const unlockedAdditionalColors = unlockedSlimeColors.filter(
      color => color !== "green"
    ).length;
    return unlockedAdditionalColors + unlockedSlimeCosmetics.length + unlockedSlimeBeards.length;
  }

  function loadPendingWardrobeUnlockChoices() {
    try {
      const storedValue = Math.floor(Number(
        localStorage.getItem(PENDING_WARDROBE_UNLOCK_CHOICES_STORAGE_KEY)
      ));
      return Number.isFinite(storedValue)
        ? Math.max(0, Math.min(WARDROBE_UNLOCK_REQUIREMENTS.length, storedValue))
        : 0;
    } catch (_) {
      return 0;
    }
  }

  let pendingWardrobeUnlockChoices = loadPendingWardrobeUnlockChoices();
  let wardrobeUnlockAwardedThisRun = false;
  let wardrobeRunProgressSnapshot = null;

  function savePendingWardrobeUnlockChoices() {
    try {
      localStorage.setItem(
        PENDING_WARDROBE_UNLOCK_CHOICES_STORAGE_KEY,
        String(pendingWardrobeUnlockChoices)
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeWardrobeRunProgressSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (
      !Number.isInteger(value.pendingWardrobeUnlockChoices) ||
      value.pendingWardrobeUnlockChoices < 0 ||
      value.pendingWardrobeUnlockChoices > WARDROBE_UNLOCK_REQUIREMENTS.length ||
      typeof value.wardrobeUnlockAwardedThisRun !== "boolean"
    ) {
      return null;
    }
    return {
      pendingWardrobeUnlockChoices: value.pendingWardrobeUnlockChoices,
      wardrobeUnlockAwardedThisRun: value.wardrobeUnlockAwardedThisRun
    };
  }

  function isWardrobeRunProgressSnapshotValid(value) {
    return normalizeWardrobeRunProgressSnapshot(value) !== null;
  }

  function captureWardrobeRunProgressSnapshot() {
    wardrobeRunProgressSnapshot = {
      pendingWardrobeUnlockChoices,
      wardrobeUnlockAwardedThisRun
    };
    return {...wardrobeRunProgressSnapshot};
  }

  function restoreWardrobeRunProgressSnapshot(snapshot = wardrobeRunProgressSnapshot) {
    const normalizedSnapshot = normalizeWardrobeRunProgressSnapshot(snapshot);
    if (!normalizedSnapshot) return false;
    pendingWardrobeUnlockChoices =
      normalizedSnapshot.pendingWardrobeUnlockChoices;
    wardrobeUnlockAwardedThisRun =
      normalizedSnapshot.wardrobeUnlockAwardedThisRun;
    return savePendingWardrobeUnlockChoices();
  }

  function discardWardrobeRunProgressSnapshot() {
    wardrobeRunProgressSnapshot = null;
  }

  function getPendingWardrobeUnlockChoiceCount() {
    return pendingWardrobeUnlockChoices;
  }

  function getNextWardrobeUnlockRequirement() {
    const progressIndex = Math.min(
      WARDROBE_UNLOCK_REQUIREMENTS.length,
      getUnlockedWardrobeItemCount() + pendingWardrobeUnlockChoices
    );
    return WARDROBE_UNLOCK_REQUIREMENTS[progressIndex] ?? null;
  }

  function resetWardrobeUnlockAwardForRun() {
    wardrobeUnlockAwardedThisRun = false;
  }

  function awardWardrobeUnlockChoicesForRun(runStars) {
    if (typeof DEV_MODE !== "undefined" && DEV_MODE) return 0;
    if (wardrobeUnlockAwardedThisRun) return 0;
    const collectedRunStars = Math.max(0, Math.floor(Number(runStars) || 0));
    const requirement = getNextWardrobeUnlockRequirement();
    if (requirement === null || collectedRunStars < requirement) return 0;

    pendingWardrobeUnlockChoices++;
    wardrobeUnlockAwardedThisRun = true;
    savePendingWardrobeUnlockChoices();
    return 1;
  }

  function redeemPendingWardrobeUnlockChoice(category, id) {
    if (
      (typeof DEV_MODE !== "undefined" && DEV_MODE) ||
      pendingWardrobeUnlockChoices <= 0
    ) {
      return false;
    }

    const normalizedCategory = String(category ?? "").toLowerCase();
    const unlocked = normalizedCategory === "color"
      ? unlockSlimeColor(id)
      : normalizedCategory === "cosmetic"
        ? unlockSlimeCosmetic(id)
        : normalizedCategory === "beard"
          ? unlockSlimeBeard(id)
          : false;
    if (!unlocked) return false;

    pendingWardrobeUnlockChoices--;
    savePendingWardrobeUnlockChoices();
    return true;
  }

  function migrateUnifiedWardrobeProgress() {
    try {
      if (
        localStorage.getItem(WARDROBE_PROGRESS_VERSION_STORAGE_KEY) ===
        WARDROBE_PROGRESS_VERSION
      ) {
        return false;
      }

      unlockedSlimeColors = ["green"];
      selectedSlimeColor = "green";
      unlockedSlimeCosmetics = [];
      selectedSlimeCosmetic = "none";
      saveSlimeColorProgress();
      saveSlimeCosmeticProgress();
      localStorage.setItem(
        WARDROBE_PROGRESS_VERSION_STORAGE_KEY,
        WARDROBE_PROGRESS_VERSION
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  migrateUnifiedWardrobeProgress();

  window.SlimePrestige?.configureWardrobeRegistry?.({
    color: {
      items: SLIME_COLOR_ORDER.map(id => ({
        id,
        displayName: SLIME_COLOR_NAMES[id] ?? id
      }))
    },
    cosmetic: {
      items: SLIME_COSMETIC_ORDER.map(id => ({
        id,
        displayName: getSlimeCosmeticDefinition(id)?.name ?? id
      }))
    },
    beard: {
      items: SLIME_BEARD_ORDER.map(id => ({
        id,
        displayName: getSlimeBeardDefinition(id)?.name ?? id
      }))
    },
    applyUnlock(category, id) {
      if (category === "color") return ensureSlimeColorUnlocked(id);
      if (category === "cosmetic") return ensureSlimeCosmeticUnlocked(id);
      if (category === "beard") return ensureSlimeBeardUnlocked(id);
      return false;
    }
  });
