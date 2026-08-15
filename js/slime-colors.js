"use strict";

  const UNLOCKED_SLIME_COLORS_STORAGE_KEY = "slimejumperUnlockedSlimeColors";
  const SELECTED_SLIME_COLOR_STORAGE_KEY = "slimejumperSelectedSlimeColor";

  const SLIME_COLOR_ORDER = Object.freeze([
    "purple",
    "blue",
    "cyan",
    "green",
    "yellow",
    "orange",
    "red",
    "pink",
    "crimson",
    "burgundy",
    "apricot",
    "gold",
    "lime",
    "forest",
    "mint",
    "teal",
    "ice_blue",
    "navy",
    "indigo",
    "magenta",
    "hot_pink",
    "vanilla",
    "silver",
    "charcoal"
  ]);

  const SLIME_COLOR_NAMES = Object.freeze({
    purple: "Lila",
    blue: "Blau",
    cyan: "Türkis",
    green: "Grün",
    yellow: "Gelb",
    orange: "Orange",
    red: "Rot",
    pink: "Pink",
    crimson: "Scharlachrot",
    burgundy: "Burgunder",
    apricot: "Aprikose",
    gold: "Amber",
    lime: "Limette",
    forest: "Waldgrün",
    mint: "Mint",
    teal: "Petrol",
    ice_blue: "Eisblau",
    navy: "Marineblau",
    indigo: "Indigo",
    magenta: "Magenta",
    hot_pink: "Neonpink",
    vanilla: "Vanille",
    silver: "Silber",
    charcoal: "Anthrazit"
  });

  const SLIME_COLOR_PALETTES = Object.freeze({
    purple: Object.freeze({
      light: "#ead7ff",
      main: "#b77aff",
      dark: "#7136c7",
      outline: "#3a176d",
      glow: "#bd7cff",
      trail: "183,122,255"
    }),
    blue: Object.freeze({
      light: "#d8efff",
      main: "#67a7ff",
      dark: "#2462c7",
      outline: "#123873",
      glow: "#4c98ff",
      trail: "103,167,255"
    }),
    cyan: Object.freeze({
      light: "#d7ffff",
      main: "#60e6e7",
      dark: "#159ba8",
      outline: "#0a5663",
      glow: "#48ffff",
      trail: "96,230,231"
    }),
    green: Object.freeze({
      light: "#c5ffcb",
      main: "#70f68a",
      dark: "#28a854",
      outline: "#154d2d",
      glow: "#51ff7a",
      trail: "107,255,132"
    }),
    yellow: Object.freeze({
      light: "#fffbd0",
      main: "#f4e95b",
      dark: "#c0a916",
      outline: "#66570a",
      glow: "#fff15a",
      trail: "244,233,91"
    }),
    orange: Object.freeze({
      light: "#ffe3c2",
      main: "#ff9b48",
      dark: "#cf5b1e",
      outline: "#6e2c12",
      glow: "#ff9d42",
      trail: "255,155,72"
    }),
    red: Object.freeze({
      light: "#ffd4d4",
      main: "#ff6464",
      dark: "#c52b3c",
      outline: "#6a1623",
      glow: "#ff555f",
      trail: "255,100,100"
    }),
    pink: Object.freeze({
      light: "#ffe0f4",
      main: "#ff82c8",
      dark: "#ca3d8d",
      outline: "#6c1d50",
      glow: "#ff72c4",
      trail: "255,130,200"
    }),
    crimson: Object.freeze({
      light: "#ffd0d7",
      main: "#e62946",
      dark: "#9f1634",
      outline: "#500c20",
      glow: "#ff3153",
      trail: "230,41,70"
    }),
    burgundy: Object.freeze({
      light: "#f0bfd1",
      main: "#8f294d",
      dark: "#5d1536",
      outline: "#2d0b1f",
      glow: "#d64879",
      trail: "143,41,77"
    }),
    apricot: Object.freeze({
      light: "#fff0d8",
      main: "#ffc078",
      dark: "#d77a3d",
      outline: "#70401f",
      glow: "#ffc06a",
      trail: "255,192,120"
    }),
    gold: Object.freeze({
      light: "#ffe8ad",
      main: "#f0a13a",
      dark: "#b85c22",
      outline: "#5d2b14",
      glow: "#ffbd55",
      trail: "240,161,58"
    }),
    lime: Object.freeze({
      light: "#edffc2",
      main: "#a8e635",
      dark: "#63a51c",
      outline: "#31550d",
      glow: "#b9ff3d",
      trail: "168,230,53"
    }),
    forest: Object.freeze({
      light: "#a8e8bf",
      main: "#228c55",
      dark: "#12613b",
      outline: "#08351f",
      glow: "#38c878",
      trail: "34,140,85"
    }),
    mint: Object.freeze({
      light: "#d8fff2",
      main: "#67ddb4",
      dark: "#249b7d",
      outline: "#125445",
      glow: "#70f9c8",
      trail: "103,221,180"
    }),
    teal: Object.freeze({
      light: "#c7fff5",
      main: "#1cafaa",
      dark: "#0b7779",
      outline: "#064147",
      glow: "#2de2d8",
      trail: "28,175,170"
    }),
    ice_blue: Object.freeze({
      light: "#f1fbff",
      main: "#a7ddf7",
      dark: "#5798c2",
      outline: "#294f70",
      glow: "#b8ecff",
      trail: "167,221,247"
    }),
    navy: Object.freeze({
      light: "#bbc9ff",
      main: "#334a9a",
      dark: "#1d2c69",
      outline: "#0d173b",
      glow: "#536dcb",
      trail: "51,74,154"
    }),
    indigo: Object.freeze({
      light: "#d6cbff",
      main: "#5a3fb8",
      dark: "#36257f",
      outline: "#1c1248",
      glow: "#795ced",
      trail: "90,63,184"
    }),
    magenta: Object.freeze({
      light: "#ffd2f4",
      main: "#d83db5",
      dark: "#8f227d",
      outline: "#4d1043",
      glow: "#f34bd0",
      trail: "216,61,181"
    }),
    hot_pink: Object.freeze({
      light: "#ffd0e6",
      main: "#ff3b96",
      dark: "#b91867",
      outline: "#620b39",
      glow: "#ff4ba9",
      trail: "255,59,150"
    }),
    vanilla: Object.freeze({
      light: "#fffdf2",
      main: "#f1dfb2",
      dark: "#b99a63",
      outline: "#655039",
      glow: "#fff0bd",
      trail: "241,223,178"
    }),
    silver: Object.freeze({
      light: "#f4f7fa",
      main: "#aeb9c6",
      dark: "#697887",
      outline: "#35404b",
      glow: "#d3e2f0",
      trail: "174,185,198"
    }),
    charcoal: Object.freeze({
      light: "#aeb5c1",
      main: "#3f4652",
      dark: "#202630",
      outline: "#0b0f16",
      glow: "#657080",
      trail: "63,70,82",
      face: "#f4fbff"
    })
  });

  function normalizeSlimeColor(value) {
    const color = String(value ?? "").toLowerCase();
    return SLIME_COLOR_ORDER.includes(color) ? color : "green";
  }

  function loadSlimeColorProgress() {
    let unlocked = ["green"];
    let selected = "green";

    try {
      const storedUnlocked = JSON.parse(
        localStorage.getItem(UNLOCKED_SLIME_COLORS_STORAGE_KEY) || "[]"
      );

      if (Array.isArray(storedUnlocked)) {
        const validColors = new Set(
          storedUnlocked
            .map(color => String(color).toLowerCase())
            .filter(color => SLIME_COLOR_ORDER.includes(color))
        );
        validColors.add("green");
        unlocked = SLIME_COLOR_ORDER.filter(color => validColors.has(color));
      }

      const storedSelected = normalizeSlimeColor(
        localStorage.getItem(SELECTED_SLIME_COLOR_STORAGE_KEY)
      );
      selected = unlocked.includes(storedSelected) ? storedSelected : "green";
    } catch (_) {}

    return {unlocked, selected};
  }

  const initialSlimeColorProgress = loadSlimeColorProgress();
  let unlockedSlimeColors = initialSlimeColorProgress.unlocked;
  let selectedSlimeColor = initialSlimeColorProgress.selected;

  function saveSlimeColorProgress() {
    try {
      localStorage.setItem(
        UNLOCKED_SLIME_COLORS_STORAGE_KEY,
        JSON.stringify(unlockedSlimeColors)
      );
      localStorage.setItem(SELECTED_SLIME_COLOR_STORAGE_KEY, selectedSlimeColor);
    } catch (_) {}
  }

  function isSlimeColorUnlocked(color) {
    return unlockedSlimeColors.includes(normalizeSlimeColor(color));
  }

  function getLockedSlimeColors() {
    return SLIME_COLOR_ORDER.filter(color => !unlockedSlimeColors.includes(color));
  }

  function selectSlimeColor(color) {
    const normalized = normalizeSlimeColor(color);
    if (!unlockedSlimeColors.includes(normalized)) return false;
    selectedSlimeColor = normalized;
    saveSlimeColorProgress();
    return true;
  }

  function unlockSlimeColor(color) {
    const normalized = normalizeSlimeColor(color);
    if (unlockedSlimeColors.includes(normalized)) return false;
    if (!ensureSlimeColorUnlocked(normalized)) return false;
    selectedSlimeColor = normalized;
    saveSlimeColorProgress();
    return true;
  }

  function ensureSlimeColorUnlocked(color) {
    const normalized = normalizeSlimeColor(color);
    if (unlockedSlimeColors.includes(normalized)) return true;
    unlockedSlimeColors = SLIME_COLOR_ORDER.filter(
      candidate => candidate === normalized || unlockedSlimeColors.includes(candidate)
    );
    saveSlimeColorProgress();
    return unlockedSlimeColors.includes(normalized);
  }

  function getSlimeColorPalette(color = selectedSlimeColor) {
    return SLIME_COLOR_PALETTES[normalizeSlimeColor(color)];
  }

  // Initialisiert fehlende oder beschädigte Alt-Speicherdaten sauber mit Grün.
  saveSlimeColorProgress();
