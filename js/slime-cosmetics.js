"use strict";

  const UNLOCKED_SLIME_COSMETICS_STORAGE_KEY = "slimejumperUnlockedSlimeCosmetics";
  const SELECTED_SLIME_COSMETIC_STORAGE_KEY = "slimejumperSelectedSlimeCosmetic";

  const SLIME_COSMETIC_ORDER = Object.freeze([
    "none",
    "sunglasses",
    "cap",
    "crown",
    "top_hat",
    "wizard_hat",
    "pirate_hat",
    "headphones",
    "bow"
  ]);

  const UNLOCKABLE_SLIME_COSMETICS = Object.freeze(
    SLIME_COSMETIC_ORDER.filter(cosmetic => cosmetic !== "none")
  );

  const COSMETIC_DEFINITIONS = Object.freeze({
    none: Object.freeze({
      name: "Ohne",
      type: "none",
      anchorX: 0,
      anchorY: 0,
      scale: 1,
      palette: Object.freeze({})
    }),
    sunglasses: Object.freeze({
      name: "Sonnenbrille",
      type: "face",
      anchorX: 0,
      anchorY: -0.08,
      scale: 1,
      palette: Object.freeze({frame: "#151821", lens: "#26384b", shine: "#8de8ff"})
    }),
    cap: Object.freeze({
      name: "Baseball-Cap",
      type: "hat",
      anchorX: 0,
      anchorY: -0.92,
      scale: 1,
      palette: Object.freeze({main: "#ff5c66", dark: "#9f2437", light: "#ff9da3"})
    }),
    crown: Object.freeze({
      name: "Krone",
      type: "hat",
      anchorX: 0,
      anchorY: -0.92,
      scale: 1,
      palette: Object.freeze({main: "#ffd84d", dark: "#9b5918", light: "#fff3a0"})
    }),
    top_hat: Object.freeze({
      name: "Zylinder",
      type: "hat",
      anchorX: 0,
      anchorY: -0.92,
      scale: 1,
      palette: Object.freeze({main: "#20243a", dark: "#090b15", band: "#b74cff"})
    }),
    wizard_hat: Object.freeze({
      name: "Zauberhut",
      type: "hat",
      anchorX: 0,
      anchorY: -0.92,
      scale: 1,
      palette: Object.freeze({main: "#6842cc", dark: "#28165f", light: "#b998ff"})
    }),
    pirate_hat: Object.freeze({
      name: "Piratenhut",
      type: "hat",
      anchorX: 0,
      anchorY: -0.91,
      scale: 1,
      palette: Object.freeze({main: "#302333", dark: "#120d18", trim: "#e7b45f"})
    }),
    headphones: Object.freeze({
      name: "Kopfhörer",
      type: "head",
      anchorX: 0,
      anchorY: 0,
      scale: 1,
      palette: Object.freeze({main: "#39c8ff", dark: "#15527a", light: "#a9efff"})
    }),
    bow: Object.freeze({
      name: "Schleife",
      type: "head",
      anchorX: 0.66,
      anchorY: -0.70,
      scale: 0.92,
      palette: Object.freeze({main: "#ff67bd", dark: "#9d286e", light: "#ffb4df"})
    })
  });

  function normalizeSlimeCosmetic(value) {
    const cosmetic = String(value ?? "").toLowerCase();
    return SLIME_COSMETIC_ORDER.includes(cosmetic) ? cosmetic : "none";
  }

  function loadSlimeCosmeticProgress() {
    let unlocked = [];
    let selected = "none";

    try {
      const storedUnlocked = JSON.parse(
        localStorage.getItem(UNLOCKED_SLIME_COSMETICS_STORAGE_KEY) || "[]"
      );

      if (Array.isArray(storedUnlocked)) {
        const validCosmetics = new Set(
          storedUnlocked
            .map(cosmetic => String(cosmetic).toLowerCase())
            .filter(cosmetic => UNLOCKABLE_SLIME_COSMETICS.includes(cosmetic))
        );
        unlocked = UNLOCKABLE_SLIME_COSMETICS.filter(
          cosmetic => validCosmetics.has(cosmetic)
        );
      }

      const storedSelected = normalizeSlimeCosmetic(
        localStorage.getItem(SELECTED_SLIME_COSMETIC_STORAGE_KEY)
      );
      selected = storedSelected === "none" || unlocked.includes(storedSelected)
        ? storedSelected
        : "none";
    } catch (_) {}

    return {unlocked, selected};
  }

  const initialSlimeCosmeticProgress = loadSlimeCosmeticProgress();
  let unlockedSlimeCosmetics = initialSlimeCosmeticProgress.unlocked;
  let selectedSlimeCosmetic = initialSlimeCosmeticProgress.selected;

  function saveSlimeCosmeticProgress() {
    try {
      localStorage.setItem(
        UNLOCKED_SLIME_COSMETICS_STORAGE_KEY,
        JSON.stringify(unlockedSlimeCosmetics)
      );
      localStorage.setItem(
        SELECTED_SLIME_COSMETIC_STORAGE_KEY,
        selectedSlimeCosmetic
      );
    } catch (_) {}
  }

  function isSlimeCosmeticUnlocked(cosmetic) {
    const normalized = normalizeSlimeCosmetic(cosmetic);
    return normalized === "none" || unlockedSlimeCosmetics.includes(normalized);
  }

  function getLockedSlimeCosmetics() {
    return UNLOCKABLE_SLIME_COSMETICS.filter(
      cosmetic => !unlockedSlimeCosmetics.includes(cosmetic)
    );
  }

  function selectSlimeCosmetic(cosmetic) {
    const normalized = normalizeSlimeCosmetic(cosmetic);
    if (!isSlimeCosmeticUnlocked(normalized)) return false;
    selectedSlimeCosmetic = normalized;
    saveSlimeCosmeticProgress();
    return true;
  }

  function unlockSlimeCosmetic(cosmetic) {
    const normalized = normalizeSlimeCosmetic(cosmetic);
    if (normalized === "none" || unlockedSlimeCosmetics.includes(normalized)) {
      return false;
    }

    unlockedSlimeCosmetics = UNLOCKABLE_SLIME_COSMETICS.filter(
      candidate => candidate === normalized || unlockedSlimeCosmetics.includes(candidate)
    );
    selectedSlimeCosmetic = normalized;
    saveSlimeCosmeticProgress();
    return true;
  }

  function getSlimeCosmeticDefinition(cosmetic = selectedSlimeCosmetic) {
    return COSMETIC_DEFINITIONS[normalizeSlimeCosmetic(cosmetic)];
  }

  saveSlimeCosmeticProgress();
