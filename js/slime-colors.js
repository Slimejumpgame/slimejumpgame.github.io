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
    "pink"
  ]);

  const SLIME_COLOR_NAMES = Object.freeze({
    purple: "Lila",
    blue: "Blau",
    cyan: "Türkis",
    green: "Grün",
    yellow: "Gelb",
    orange: "Orange",
    red: "Rot",
    pink: "Pink"
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
    unlockedSlimeColors = SLIME_COLOR_ORDER.filter(
      candidate => candidate === normalized || unlockedSlimeColors.includes(candidate)
    );
    selectedSlimeColor = normalized;
    saveSlimeColorProgress();
    return true;
  }

  function getSlimeColorPalette(color = selectedSlimeColor) {
    return SLIME_COLOR_PALETTES[normalizeSlimeColor(color)];
  }

  // Initialisiert fehlende oder beschädigte Alt-Speicherdaten sauber mit Grün.
  saveSlimeColorProgress();
