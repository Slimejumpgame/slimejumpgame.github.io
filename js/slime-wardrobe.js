"use strict";

  const WARDROBE_UNLOCK_REQUIREMENTS = Object.freeze([
    25,
    30,
    35,
    40,
    50,
    60,
    70,
    80,
    90,
    100,
    110,
    120,
    130,
    140,
    150
  ]);

  const WARDROBE_PROGRESS_VERSION_STORAGE_KEY = "slimejumperWardrobeProgressVersion";
  const WARDROBE_PROGRESS_VERSION = "unified-wardrobe-v1";

  function getUnlockedWardrobeItemCount() {
    const unlockedAdditionalColors = unlockedSlimeColors.filter(
      color => color !== "green"
    ).length;
    return unlockedAdditionalColors + unlockedSlimeCosmetics.length;
  }

  function getNextWardrobeUnlockRequirement() {
    return WARDROBE_UNLOCK_REQUIREMENTS[getUnlockedWardrobeItemCount()] ?? null;
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
