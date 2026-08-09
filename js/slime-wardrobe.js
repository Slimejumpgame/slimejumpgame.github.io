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
    150,
    160,
    170,
    180,
    190,
    200,
    210,
    220,
    230,
    240,
    250,
    260,
    270,
    280,
    290,
    300,
    310,
    320,
    330,
    340,
    350,
    360,
    370,
    380,
    390,
    400,
    410,
    420,
    430,
    440,
    450,
    460,
    470,
    480,
    490,
    500,
    510
  ]);

  const WARDROBE_FIXED_UNLOCK_TARGETS = Object.freeze({
    240: Object.freeze({category: "cosmetic", id: "cat_ears"}),
    250: Object.freeze({category: "beard", id: "stubble"}),
    260: Object.freeze({category: "beard", id: "mustache"}),
    270: Object.freeze({category: "beard", id: "goatee"}),
    280: Object.freeze({category: "beard", id: "full_beard"}),
    290: Object.freeze({category: "beard", id: "cowboy_mustache"}),
    300: Object.freeze({category: "beard", id: "viking_beard"}),
    310: Object.freeze({category: "beard", id: "wizard_beard"}),
    320: Object.freeze({category: "beard", id: "braided_beard"}),
    330: Object.freeze({category: "color", id: "crimson"}),
    340: Object.freeze({category: "color", id: "burgundy"}),
    350: Object.freeze({category: "color", id: "apricot"}),
    360: Object.freeze({category: "color", id: "gold"}),
    370: Object.freeze({category: "color", id: "lime"}),
    380: Object.freeze({category: "color", id: "forest"}),
    390: Object.freeze({category: "color", id: "mint"}),
    400: Object.freeze({category: "color", id: "teal"}),
    410: Object.freeze({category: "color", id: "ice_blue"}),
    420: Object.freeze({category: "color", id: "navy"}),
    430: Object.freeze({category: "color", id: "indigo"}),
    440: Object.freeze({category: "color", id: "magenta"}),
    450: Object.freeze({category: "color", id: "hot_pink"}),
    460: Object.freeze({category: "color", id: "vanilla"}),
    470: Object.freeze({category: "color", id: "silver"}),
    480: Object.freeze({category: "color", id: "charcoal"}),
    490: Object.freeze({category: "cosmetic", id: "bunny_ears"}),
    500: Object.freeze({category: "beard", id: "lumberjack_beard"}),
    510: Object.freeze({category: "beard", id: "imperial_beard"})
  });

  const WARDROBE_PROGRESS_VERSION_STORAGE_KEY = "slimejumperWardrobeProgressVersion";
  const WARDROBE_PROGRESS_VERSION = "unified-wardrobe-v1";

  function getUnlockedWardrobeItemCount() {
    const unlockedAdditionalColors = unlockedSlimeColors.filter(
      color => color !== "green"
    ).length;
    return unlockedAdditionalColors + unlockedSlimeCosmetics.length + unlockedSlimeBeards.length;
  }

  function getNextWardrobeUnlockRequirement() {
    return WARDROBE_UNLOCK_REQUIREMENTS[getUnlockedWardrobeItemCount()] ?? null;
  }

  function getNextWardrobeUnlockTarget() {
    const requirement = getNextWardrobeUnlockRequirement();
    return requirement === null ? null : WARDROBE_FIXED_UNLOCK_TARGETS[requirement] ?? null;
  }

  function getWardrobeUnlockRequirementForTarget(category, id) {
    for (const [requirement, target] of Object.entries(WARDROBE_FIXED_UNLOCK_TARGETS)) {
      if (target.category === category && target.id === id) return Number(requirement);
    }
    return null;
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
