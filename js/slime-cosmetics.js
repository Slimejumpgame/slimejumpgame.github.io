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
    "bow",
    "cowboy_hat",
    "devil_horns",
    "halo",
    "ninja_headband",
    "viking_helmet",
    "party_hat",
    "chef_hat",
    "propeller_hat",
    "cat_ears",
    "bunny_ears"
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
    }),
    cowboy_hat: Object.freeze({
      name: "Cowboyhut",
      type: "hat",
      anchorX: 0,
      anchorY: -0.90,
      scale: 0.98,
      palette: Object.freeze({main: "#c57a35", dark: "#673515", light: "#efb969", band: "#3c2318"})
    }),
    devil_horns: Object.freeze({
      name: "Teufelshörner",
      type: "hat",
      anchorX: 0,
      anchorY: -0.82,
      scale: 1,
      palette: Object.freeze({main: "#ef334f", dark: "#7c1029", light: "#ff8895"})
    }),
    halo: Object.freeze({
      name: "Heiligenschein",
      type: "hat",
      anchorX: 0,
      anchorY: -1.02,
      scale: 1,
      palette: Object.freeze({main: "#ffd94f", dark: "#b66a16", light: "#fff7a8"})
    }),
    ninja_headband: Object.freeze({
      name: "Ninja-Stirnband",
      type: "hat",
      anchorX: 0,
      anchorY: -0.62,
      scale: 1,
      palette: Object.freeze({main: "#e43f55", dark: "#74182b", light: "#ff8995"})
    }),
    viking_helmet: Object.freeze({
      name: "Wikingerhelm",
      type: "hat",
      anchorX: 0,
      anchorY: -0.90,
      scale: 0.92,
      palette: Object.freeze({main: "#9aa8b8", dark: "#485565", light: "#e8f0f7", horn: "#f3ddae"})
    }),
    party_hat: Object.freeze({
      name: "Partyhut",
      type: "hat",
      anchorX: 0,
      anchorY: -0.90,
      scale: 0.90,
      palette: Object.freeze({main: "#a54cff", dark: "#52208f", light: "#ec9cff", accent: "#ffe45c"})
    }),
    chef_hat: Object.freeze({
      name: "Kochmütze",
      type: "hat",
      anchorX: 0,
      anchorY: -0.86,
      scale: 0.92,
      palette: Object.freeze({main: "#f5f5ef", dark: "#8d9aaa", light: "#ffffff"})
    }),
    propeller_hat: Object.freeze({
      name: "Propeller-Mütze",
      type: "hat",
      anchorX: 0,
      anchorY: -0.88,
      scale: 0.96,
      palette: Object.freeze({main: "#48a8ff", dark: "#22528c", light: "#9fe0ff", accent: "#ff5b64"})
    }),
    cat_ears: Object.freeze({
      name: "Katzenohren",
      type: "hat",
      anchorX: 0,
      anchorY: -0.78,
      scale: 1,
      palette: Object.freeze({main: "#9a62d4", dark: "#4b2b72", light: "#d8a7ff", inner: "#ff99c8"})
    }),
    bunny_ears: Object.freeze({
      name: "Hasenohren",
      type: "hat",
      anchorX: 0,
      anchorY: -0.78,
      scale: 0.94,
      palette: Object.freeze({main: "#f2e9ff", dark: "#7d659b", light: "#ffffff", inner: "#ff9fcf"})
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
    if (!ensureSlimeCosmeticUnlocked(normalized)) return false;
    selectedSlimeCosmetic = normalized;
    saveSlimeCosmeticProgress();
    return true;
  }

  function ensureSlimeCosmeticUnlocked(cosmetic) {
    const normalized = normalizeSlimeCosmetic(cosmetic);
    if (normalized === "none") return false;
    if (unlockedSlimeCosmetics.includes(normalized)) return true;

    unlockedSlimeCosmetics = UNLOCKABLE_SLIME_COSMETICS.filter(
      candidate => candidate === normalized || unlockedSlimeCosmetics.includes(candidate)
    );
    saveSlimeCosmeticProgress();
    return unlockedSlimeCosmetics.includes(normalized);
  }

  function getSlimeCosmeticDefinition(cosmetic = selectedSlimeCosmetic) {
    return COSMETIC_DEFINITIONS[normalizeSlimeCosmetic(cosmetic)];
  }

  saveSlimeCosmeticProgress();
