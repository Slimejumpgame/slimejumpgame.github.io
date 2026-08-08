/*
  Slime Jump – gemeinsames Online-Highscore-Modul
  GitHub Pages + Supabase
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://sgmnirebveuvgupwguiw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_DDpbowG2-g6ZVios1OTrfA_DkUyh2TC";

  const TABLE = "slime_jump_highscores";
  const GAME_VERSION = "2.31";
  // Nach der unten dokumentierten Supabase-Migration auf true setzen.
  const SLIME_COLOR_COLUMN_ENABLED = true;

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

    const query = new URLSearchParams({
      select: SLIME_COLOR_COLUMN_ENABLED
        ? "name,score,level,game_version,created_at,slime_color"
        : "name,score,level,game_version,created_at",
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
          gameVersion: String(row.game_version || ""),
          createdAt: row.created_at || null
        }))
      : [];
  }

  async function submitScore({ name, score, level, slimeColor = "green" }) {
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
      throw new Error(
        `Highscore konnte nicht gespeichert werden (${response.status}).`
      );
    }

    return true;
  }

  window.SlimeJumpHighscores = Object.freeze({
    isConfigured,
    slimeColorColumnEnabled: SLIME_COLOR_COLUMN_ENABLED,
    getTopScores,
    submitScore
  });
})();
