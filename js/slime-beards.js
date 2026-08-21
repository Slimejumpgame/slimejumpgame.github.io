"use strict";

  const UNLOCKED_SLIME_BEARDS_STORAGE_KEY = "slimejumperUnlockedSlimeBeards";
  const SELECTED_SLIME_BEARD_STORAGE_KEY = "slimejumperSelectedSlimeBeard";

  const SLIME_BEARD_ORDER = Object.freeze([
    "none",
    "stubble",
    "mustache",
    "goatee",
    "full_beard",
    "cowboy_mustache",
    "viking_beard",
    "wizard_beard",
    "braided_beard",
    "lumberjack_beard",
    "imperial_beard",
    "walrus_mustache",
    "horseshoe_mustache",
    "soul_patch",
    "chinstrap_beard",
    "mutton_chops",
    "ducktail_beard",
    "forked_beard",
    "curly_beard",
    "box_beard",
    "pharaoh_beard",
    "fan_beard",
    "pencil_mustache",
    "circle_beard"
  ]);

  const UNLOCKABLE_SLIME_BEARDS = Object.freeze(
    SLIME_BEARD_ORDER.filter(beard => beard !== "none")
  );

  const BEARD_DEFINITIONS = Object.freeze({
    none: Object.freeze({
      name: "Kein Bart",
      anchorX: 0,
      anchorY: 0,
      scale: 1,
      palette: Object.freeze({})
    }),
    stubble: Object.freeze({
      name: "Dreitagebart",
      anchorX: 0,
      anchorY: 0.18,
      scale: 1,
      palette: Object.freeze({main: "#51454d", light: "#7d6d75"})
    }),
    mustache: Object.freeze({
      name: "Schnurrbart",
      anchorX: 0,
      anchorY: 0.18,
      scale: 0.92,
      palette: Object.freeze({main: "#6b3d25", dark: "#321b16", light: "#a56a3e"})
    }),
    goatee: Object.freeze({
      name: "Ziegenbart",
      anchorX: 0,
      anchorY: 0.20,
      scale: 0.92,
      palette: Object.freeze({main: "#4c3026", dark: "#251712", light: "#805541"})
    }),
    full_beard: Object.freeze({
      name: "Vollbart",
      anchorX: 0,
      anchorY: 0.16,
      scale: 0.92,
      palette: Object.freeze({main: "#75452b", dark: "#392218", light: "#b47745"})
    }),
    cowboy_mustache: Object.freeze({
      name: "Cowboy-Schnurrbart",
      anchorX: 0,
      anchorY: 0.17,
      scale: 0.94,
      palette: Object.freeze({main: "#9a5a27", dark: "#4d2916", light: "#d58a3d"})
    }),
    viking_beard: Object.freeze({
      name: "Wikingerbart",
      anchorX: 0,
      anchorY: 0.15,
      scale: 0.88,
      palette: Object.freeze({main: "#c45a2c", dark: "#6c2b1c", light: "#ef9550", band: "#d9b548"})
    }),
    wizard_beard: Object.freeze({
      name: "Magierbart",
      anchorX: 0,
      anchorY: 0.14,
      scale: 0.86,
      palette: Object.freeze({main: "#c6cbd8", dark: "#687184", light: "#f4f6ff"})
    }),
    braided_beard: Object.freeze({
      name: "Geflochtener Bart",
      anchorX: 0,
      anchorY: 0.15,
      scale: 0.88,
      palette: Object.freeze({main: "#70412a", dark: "#352018", light: "#a96c43", band: "#52b7d9"})
    }),
    lumberjack_beard: Object.freeze({
      name: "Holzfällerbart",
      anchorX: 0,
      anchorY: 0.14,
      scale: 0.88,
      palette: Object.freeze({main: "#864520", dark: "#3b1f13", light: "#c87538"})
    }),
    imperial_beard: Object.freeze({
      name: "Kaiserbart",
      anchorX: 0,
      anchorY: 0.18,
      scale: 0.94,
      palette: Object.freeze({main: "#56352d", dark: "#241516", light: "#9d6551"})
    }),
    walrus_mustache: Object.freeze({
      name: "Walrossbart",
      anchorX: 0,
      anchorY: 0.17,
      scale: 0.86,
      palette: Object.freeze({main: "#7a5137", dark: "#38241c", light: "#b17d55"})
    }),
    horseshoe_mustache: Object.freeze({
      name: "Hufeisenbart",
      anchorX: 0,
      anchorY: 0.15,
      scale: 0.84,
      palette: Object.freeze({main: "#3f302b", dark: "#1c1514", light: "#786057"})
    }),
    soul_patch: Object.freeze({
      name: "Soul Patch",
      anchorX: 0,
      anchorY: 0.20,
      scale: 0.95,
      palette: Object.freeze({main: "#5c3b2e", dark: "#281916", light: "#9b6850"})
    }),
    chinstrap_beard: Object.freeze({
      name: "Kinnriemenbart",
      anchorX: 0,
      anchorY: 0.08,
      scale: 0.78,
      palette: Object.freeze({main: "#47312a", dark: "#211713", light: "#765348"})
    }),
    mutton_chops: Object.freeze({
      name: "Koteletten",
      anchorX: 0,
      anchorY: 0.10,
      scale: 0.86,
      palette: Object.freeze({main: "#8b4d2d", dark: "#422417", light: "#c77a4a"})
    }),
    ducktail_beard: Object.freeze({
      name: "Entenschwanzbart",
      anchorX: 0,
      anchorY: 0.10,
      scale: 0.74,
      palette: Object.freeze({main: "#66412f", dark: "#2d1c18", light: "#a36f50"})
    }),
    forked_beard: Object.freeze({
      name: "Gabelbart",
      anchorX: 0,
      anchorY: 0.10,
      scale: 0.74,
      palette: Object.freeze({main: "#b45f2f", dark: "#572a1c", light: "#e49555"})
    }),
    curly_beard: Object.freeze({
      name: "Lockenbart",
      anchorX: 0,
      anchorY: 0.11,
      scale: 0.76,
      palette: Object.freeze({main: "#d4c5ac", dark: "#766c61", light: "#fff4df"})
    }),
    box_beard: Object.freeze({
      name: "Kastenbart",
      anchorX: 0,
      anchorY: 0.13,
      scale: 0.80,
      palette: Object.freeze({main: "#5d3825", dark: "#2b1913", light: "#936044"})
    }),
    pharaoh_beard: Object.freeze({
      name: "Pharaonenbart",
      anchorX: 0,
      anchorY: 0.11,
      scale: 0.75,
      palette: Object.freeze({main: "#315c78", dark: "#182d3d", light: "#5f91ad", band: "#e0b84f"})
    }),
    fan_beard: Object.freeze({
      name: "Fächerbart",
      anchorX: 0,
      anchorY: 0.13,
      scale: 0.82,
      palette: Object.freeze({main: "#7c4a2e", dark: "#392117", light: "#bc7950"})
    }),
    pencil_mustache: Object.freeze({
      name: "Bleistiftbart",
      anchorX: 0,
      anchorY: 0.17,
      scale: 0.96,
      palette: Object.freeze({main: "#342522", dark: "#160f0f", light: "#725149"})
    }),
    circle_beard: Object.freeze({
      name: "Rundbart",
      anchorX: 0,
      anchorY: 0.18,
      scale: 0.78,
      palette: Object.freeze({main: "#75503b", dark: "#33231c", light: "#ad795a"})
    })
  });

  function normalizeSlimeBeard(value) {
    const beard = String(value ?? "").toLowerCase();
    return SLIME_BEARD_ORDER.includes(beard) ? beard : "none";
  }

  function loadSlimeBeardProgress() {
    let unlocked = [];
    let selected = "none";

    try {
      const storedUnlocked = JSON.parse(
        localStorage.getItem(UNLOCKED_SLIME_BEARDS_STORAGE_KEY) || "[]"
      );

      if (Array.isArray(storedUnlocked)) {
        const validBeards = new Set(
          storedUnlocked
            .map(beard => String(beard).toLowerCase())
            .filter(beard => UNLOCKABLE_SLIME_BEARDS.includes(beard))
        );
        unlocked = UNLOCKABLE_SLIME_BEARDS.filter(beard => validBeards.has(beard));
      }

      const storedSelected = normalizeSlimeBeard(
        localStorage.getItem(SELECTED_SLIME_BEARD_STORAGE_KEY)
      );
      selected = storedSelected === "none" || unlocked.includes(storedSelected)
        ? storedSelected
        : "none";
    } catch (_) {}

    return {unlocked, selected};
  }

  const initialSlimeBeardProgress = loadSlimeBeardProgress();
  let unlockedSlimeBeards = initialSlimeBeardProgress.unlocked;
  let selectedSlimeBeard = initialSlimeBeardProgress.selected;

  function saveSlimeBeardProgress() {
    try {
      localStorage.setItem(
        UNLOCKED_SLIME_BEARDS_STORAGE_KEY,
        JSON.stringify(unlockedSlimeBeards)
      );
      localStorage.setItem(SELECTED_SLIME_BEARD_STORAGE_KEY, selectedSlimeBeard);
    } catch (_) {}
  }

  function isSlimeBeardUnlocked(beard) {
    const normalized = normalizeSlimeBeard(beard);
    return normalized === "none" || unlockedSlimeBeards.includes(normalized);
  }

  function getLockedSlimeBeards() {
    return UNLOCKABLE_SLIME_BEARDS.filter(
      beard => !unlockedSlimeBeards.includes(beard)
    );
  }

  function selectSlimeBeard(beard) {
    const normalized = normalizeSlimeBeard(beard);
    if (!isSlimeBeardUnlocked(normalized)) return false;
    if (typeof window !== "undefined") {
      window.SlimeGold?.useNormalAppearance?.("beard");
    }
    selectedSlimeBeard = normalized;
    saveSlimeBeardProgress();
    return true;
  }

  function unlockSlimeBeard(beard) {
    const normalized = normalizeSlimeBeard(beard);
    if (normalized === "none" || unlockedSlimeBeards.includes(normalized)) {
      return false;
    }
    if (!ensureSlimeBeardUnlocked(normalized)) return false;
    if (typeof window !== "undefined") {
      window.SlimeGold?.useNormalAppearance?.("beard");
    }
    selectedSlimeBeard = normalized;
    saveSlimeBeardProgress();
    return true;
  }

  function ensureSlimeBeardUnlocked(beard) {
    const normalized = normalizeSlimeBeard(beard);
    if (normalized === "none") return false;
    if (unlockedSlimeBeards.includes(normalized)) return true;

    unlockedSlimeBeards = UNLOCKABLE_SLIME_BEARDS.filter(
      candidate => candidate === normalized || unlockedSlimeBeards.includes(candidate)
    );
    saveSlimeBeardProgress();
    return unlockedSlimeBeards.includes(normalized);
  }

  function getSlimeBeardDefinition(beard = selectedSlimeBeard) {
    return BEARD_DEFINITIONS[normalizeSlimeBeard(beard)];
  }

  saveSlimeBeardProgress();
