/*
  Slime Jump â€“ gemeinsames Online-Highscore-Modul
  GitHub Pages + Supabase
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://sgmnirebveuvgupwguiw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_DDpbowG2-g6ZVios1OTrfA_DkUyh2TC";

  const TABLE = "slime_jump_highscores";
  const GAME_VERSION = "2.55";
  // Nach der unten dokumentierten Supabase-Migration auf true setzen.
  const SLIME_COLOR_COLUMN_ENABLED = true;
  // Erst nach 
  // dem Anlegen der Spalte slime_cosmetic in Supabase aktivieren.
  const SLIME_COSMETIC_COLUMN_ENABLED = true;
  // Erst nach der kontrollierten slime_beard-Migration in Supabase aktivieren.
  const SLIME_BEARD_COLUMN_ENABLED = true;
  // Erst nach der kontrollierten slime_achievements-Migration aktivieren.
  const SLIME_ACHIEVEMENTS_COLUMN_ENABLED = true;

  function isConfigured() {
    return (
      /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL) &&
      SUPABASE_PUBLISHABLE_KEY &&
      !SUPABASE_PUBLISHABLE_KEY.startsWith("__")
    );
  }

  function normalizeNickname(value) {
    const cleaned = String(value ?? "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);

    if (cleaned.length !== 3) {
      throw new Error(
        "Der Highscore-Name muss genau 3 Buchstaben (A-Z) haben."
      );
    }

    return cleaned;
  }

  function normalizeScore(value) {
    const number = Math.floor(Number(value));

    if (!Number.isFinite(number) || number < 0) {
      throw new Error("Ungueltiger Highscore.");
    }

    return Math.min(number, 1000000000);
  }

  function normalizeLevel(value) {
    const number = Math.floor(Number(value));

    if (!Number.isFinite(number) || number < 1) {
      throw new Error("Ungueltiges Level.");
    }

    return Math.min(number, 1000000);
  }

  function normalizeSlimeAchievementIds(value) {
    if (!Array.isArray(value)) return [];

    const registry = window.SlimeAchievements?.registry;
    const knownIds = Array.isArray(registry)
      ? new Set(registry.map(achievement => achievement?.id).filter(Boolean))
      : null;
    const normalized = [];

    value.forEach(id => {
      if (typeof id !== "string") return;
      const cleanId = id.trim();
      if (!cleanId || normalized.includes(cleanId)) return;
      if (knownIds && !knownIds.has(cleanId)) return;
      normalized.push(cleanId);
    });

    return normalized;
  }

  function headers(extra = {}) {
    return {
      apikey: SUPABASE_PUBLISHABLE_KEY,
     
      ...extra
    };
  }

  async function getTopScores(limit = 10) {
    if (!isConfigured()) return [];

    const safeLimit = Math.max(
      1,
      Math.min(100, Math.floor(Number(limit) || 10))
    );

    const selectedColumns = ["name", "score", "level", "game_version", "created_at"];
    if (SLIME_COLOR_COLUMN_ENABLED) selectedColumns.push("slime_color");
    if (SLIME_COSMETIC_COLUMN_ENABLED) selectedColumns.push("slime_cosmetic");
    if (SLIME_BEARD_COLUMN_ENABLED) selectedColumns.push("slime_beard");
    if (SLIME_ACHIEVEMENTS_COLUMN_ENABLED) selectedColumns.push("slime_achievements");

    const query = new URLSearchParams({
      select: selectedColumns.join(","),
      order: "score.desc,level.desc,created_at.asc",
      limit: String(safeLimit)
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?${query}`,
      {
        method: "GET",
        headers: headers({
          Accept: "application/json"
        }),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Highscores konnten nicht geladen werden (${response.status}).`
      );
    }

    const rows = await response.json();

    return Array.isArray(rows)
      ? rows.map((row) => ({
          name: normalizeNickname(row.name),
          score: normalizeScore(row.score),
          level: normalizeLevel(row.level),
          slimeColor: SLIME_COLOR_COLUMN_ENABLED
            ? normalizeSlimeColor(row.slime_color)
            : "green",
          slimeCosmetic: SLIME_COSMETIC_COLUMN_ENABLED
            ? normalizeSlimeCosmetic(row.slime_cosmetic)
            : "none",
          slimeBeard: SLIME_BEARD_COLUMN_ENABLED
            ? normalizeSlimeBeard(row.slime_beard)
            : "none",
          slimeAchievements: SLIME_ACHIEVEMENTS_COLUMN_ENABLED
            ? normalizeSlimeAchievementIds(row.slime_achievements)
            : [],
          gameVersion: String(row.game_version || ""),
          createdAt: row.created_at || null
        }))
      : [];
  }

  async function submitScore({
    name,
    score,
    level,
    slimeColor = "green",
    slimeCosmetic = "none",
    slimeBeard = "none",
    slimeAchievements = []
  }) {
    if (!isConfigured()) {
      throw new Error("Online-Highscores sind noch nicht konfiguriert.");
    }

    const payload = {
      name: normalizeNickname(name),
      score: normalizeScore(score),
      level: normalizeLevel(level),
      game_version: GAME_VERSION
    };

    if (SLIME_COLOR_COLUMN_ENABLED) {
      payload.slime_color = normalizeSlimeColor(slimeColor);
    }
    if (SLIME_COSMETIC_COLUMN_ENABLED) {
      payload.slime_cosmetic = normalizeSlimeCosmetic(slimeCosmetic);
    }
    if (SLIME_BEARD_COLUMN_ENABLED) {
      payload.slime_beard = normalizeSlimeBeard(slimeBeard);
    }
    if (SLIME_ACHIEVEMENTS_COLUMN_ENABLED) {
      payload.slime_achievements = normalizeSlimeAchievementIds(slimeAchievements);
    }

    console.info("[Highscore] INSERT START");

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}`,
      {
        method: "POST",
        headers: headers({
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      let errorDetails = "";
      try {
        errorDetails = String(await response.text()).trim().slice(0, 500);
      } catch (_) {}
      throw new Error(
        `Highscore konnte nicht gespeichert werden (${response.status})` +
        `${errorDetails ? `: ${errorDetails}` : "."}`
      );
    }

    console.info("[Highscore] INSERT SUCCESS");
    return true;
  }

  window.SlimeJumpHighscores = Object.freeze({
    isConfigured,
    slimeColorColumnEnabled: SLIME_COLOR_COLUMN_ENABLED,
    slimeCosmeticColumnEnabled: SLIME_COSMETIC_COLUMN_ENABLED,
    slimeBeardColumnEnabled: SLIME_BEARD_COLUMN_ENABLED,
    slimeAchievementsColumnEnabled: SLIME_ACHIEVEMENTS_COLUMN_ENABLED,
    getTopScores,
    submitScore
  });
})();




