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
  const SUBMIT_GLOBAL_BEST_RPC = "submit_slime_jump_global_best";
  const GAME_VERSION = "2.71";
  // Nach der unten dokumentierten Supabase-Migration auf true setzen.
  const SLIME_COLOR_COLUMN_ENABLED = true;
  // Erst nach 
  // dem Anlegen der Spalte slime_cosmetic in Supabase aktivieren.
  const SLIME_COSMETIC_COLUMN_ENABLED = true;
  // Erst nach der kontrollierten slime_beard-Migration in Supabase aktivieren.
  const SLIME_BEARD_COLUMN_ENABLED = true;
  // Erst nach der kontrollierten slime_achievements-Migration aktivieren.
  const SLIME_ACHIEVEMENTS_COLUMN_ENABLED = true;
  const CALLING_CARD_SNAPSHOT_COLUMN = "calling_card_snapshot";
  const CALLING_CARD_SNAPSHOT_FORMAT_VERSION = 1;
  const UUID_V4_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let callingCardSnapshotColumnAvailable = null;

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

  function normalizePlayerId(value) {
    const playerId = String(value ?? "").trim();
    if (!UUID_V4_PATTERN.test(playerId)) {
      throw new Error("Ungueltige Spieler-ID.");
    }
    return playerId;
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
      if (!cleanId || normalized.includes(cleanId) || normalized.length >= 5) return;
      if (knownIds && !knownIds.has(cleanId)) return;
      normalized.push(cleanId);
    });

    return normalized;
  }

  function normalizeGoldAppearance(value) {
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
    const normalizedHatId = typeof source.hatId === "string"
      ? normalizeSlimeCosmetic(source.hatId)
      : "none";
    const normalizedBeardId = typeof source.beardId === "string"
      ? normalizeSlimeBeard(source.beardId)
      : "none";
    return {
      slime: source.slime === true,
      hatId: normalizedHatId === "none" ? null : normalizedHatId,
      beardId: normalizedBeardId === "none" ? null : normalizedBeardId
    };
  }

  function normalizeCallingCardSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const nestedSnapshot = value.callingCardSnapshot ?? value.calling_card_snapshot;
    const source = nestedSnapshot && typeof nestedSnapshot === "object"
      ? nestedSnapshot
      : value;
    const hasSnapshotValue = (camelKey, snakeKey) =>
      Object.prototype.hasOwnProperty.call(source, camelKey) ||
      Object.prototype.hasOwnProperty.call(source, snakeKey);
    if (
      !hasSnapshotValue("playerLevel", "player_level") ||
      !hasSnapshotValue("prestigeLevel", "prestige_level") ||
      !hasSnapshotValue("prestigeFrame", "prestige_frame") ||
      !hasSnapshotValue("prestigeTitle", "prestige_title") ||
      !hasSnapshotValue("prestigeAura", "prestige_aura") ||
      !hasSnapshotValue("prestigeTrail", "prestige_trail") ||
      !Array.isArray(source.slimeAchievements ?? source.slime_achievements)
    ) return null;
    const normalized = window.SlimePrestige?.normalizeIdentitySnapshot?.({
      playerLevel: source.playerLevel ?? source.player_level,
      prestigeLevel: source.prestigeLevel ?? source.prestige_level,
      prestigeFrame: source.prestigeFrame ?? source.prestige_frame,
      prestigeTitle: source.prestigeTitle ?? source.prestige_title,
      prestigeAura: source.prestigeAura ?? source.prestige_aura,
      prestigeTrail: source.prestigeTrail ?? source.prestige_trail,
      slimeAchievements:
        source.slimeAchievements ??
        source.slime_achievements ??
        value.slimeAchievements ??
        value.slime_achievements
    });
    if (!normalized) return null;
    return {
      formatVersion: CALLING_CARD_SNAPSHOT_FORMAT_VERSION,
      playerLevel: normalized.playerLevel,
      prestigeLevel: normalized.prestigeLevel,
      prestigeEmblemId: normalized.prestigeEmblemId,
      prestigeFrame: normalized.prestigeFrame,
      prestigeTitle: normalized.prestigeTitle,
      prestigeAura: normalized.prestigeAura,
      prestigeTrail: normalized.prestigeTrail,
      slimeAchievements: normalizeSlimeAchievementIds(normalized.slimeAchievements),
      goldAppearance: normalizeGoldAppearance(
        source.goldAppearance ??
        source.gold_appearance ??
        value.goldAppearance ??
        value.gold_appearance
      )
    };
  }

  function isMissingCallingCardSnapshotColumn(status, errorDetails) {
    return status === 400 &&
      /calling_card_snapshot/i.test(errorDetails) &&
      /(column|schema cache|does not exist|could not find)/i.test(errorDetails);
  }

  function getRpcRow(value) {
    if (Array.isArray(value)) return value[0] ?? null;
    return value && typeof value === "object" ? value : null;
  }

  async function readResponseError(response) {
    try {
      return String(await response.text()).trim().slice(0, 500);
    } catch (_) {
      return "";
    }
  }

  function headers(extra = {}) {
    return {
      apikey: SUPABASE_PUBLISHABLE_KEY,
     
      ...extra
    };
  }

  async function requestTopScoreRows(safeLimit, includeCallingCardSnapshot) {
    const selectedColumns = ["name", "score", "level", "game_version", "created_at"];
    if (SLIME_COLOR_COLUMN_ENABLED) selectedColumns.push("slime_color");
    if (SLIME_COSMETIC_COLUMN_ENABLED) selectedColumns.push("slime_cosmetic");
    if (SLIME_BEARD_COLUMN_ENABLED) selectedColumns.push("slime_beard");
    if (SLIME_ACHIEVEMENTS_COLUMN_ENABLED) selectedColumns.push("slime_achievements");
    if (includeCallingCardSnapshot) selectedColumns.push(CALLING_CARD_SNAPSHOT_COLUMN);

    const query = new URLSearchParams({
      select: selectedColumns.join(","),
      order: "score.desc,level.desc,created_at.asc",
      limit: String(safeLimit)
    });

    return fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?${query}`,
      {
        method: "GET",
        headers: headers({
          Accept: "application/json"
        }),
        cache: "no-store"
      }
    );
  }

  async function getTopScores(limit = 10) {
    if (!isConfigured()) return [];

    const safeLimit = Math.max(
      1,
      Math.min(100, Math.floor(Number(limit) || 10))
    );
    let includesCallingCardSnapshot = callingCardSnapshotColumnAvailable !== false;
    let response = await requestTopScoreRows(safeLimit, includesCallingCardSnapshot);

    if (!response.ok && includesCallingCardSnapshot) {
      const errorDetails = await readResponseError(response);
      if (isMissingCallingCardSnapshotColumn(response.status, errorDetails)) {
        callingCardSnapshotColumnAvailable = false;
        includesCallingCardSnapshot = false;
        response = await requestTopScoreRows(safeLimit, false);
      } else {
        throw new Error(
          `Highscores konnten nicht geladen werden (${response.status})` +
          `${errorDetails ? `: ${errorDetails}` : "."}`
        );
      }
    }

    if (!response.ok) {
      const errorDetails = await readResponseError(response);
      throw new Error(
        `Highscores konnten nicht geladen werden (${response.status})` +
        `${errorDetails ? `: ${errorDetails}` : "."}`
      );
    }
    if (includesCallingCardSnapshot) callingCardSnapshotColumnAvailable = true;

    const rows = await response.json();

    return Array.isArray(rows)
      ? rows.map((row) => {
          const callingCardSnapshot = includesCallingCardSnapshot
            ? normalizeCallingCardSnapshot(row.calling_card_snapshot)
            : null;
          return {
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
            slimeAchievements: callingCardSnapshot?.slimeAchievements ?? (
              SLIME_ACHIEVEMENTS_COLUMN_ENABLED
                ? normalizeSlimeAchievementIds(row.slime_achievements)
                : []
            ),
            playerLevel: callingCardSnapshot?.playerLevel,
            prestigeLevel: callingCardSnapshot?.prestigeLevel,
            prestigeEmblemId: callingCardSnapshot?.prestigeEmblemId,
            prestigeFrame: callingCardSnapshot?.prestigeFrame,
            prestigeTitle: callingCardSnapshot?.prestigeTitle,
            prestigeAura: callingCardSnapshot?.prestigeAura,
            prestigeTrail: callingCardSnapshot?.prestigeTrail,
            goldAppearance: callingCardSnapshot?.goldAppearance ??
              normalizeGoldAppearance(null),
            callingCardSnapshot,
            hasPlayerLevelSnapshot: Boolean(callingCardSnapshot),
            hasPrestigeLevelSnapshot: Boolean(callingCardSnapshot),
            hasIdentitySnapshot: Boolean(callingCardSnapshot),
            gameVersion: String(row.game_version || ""),
            createdAt: row.created_at || null
          };
        })
      : [];
  }

  async function submitScore({
    playerId,
    name,
    score,
    level,
    slimeColor = "green",
    slimeCosmetic = "none",
    slimeBeard = "none",
    slimeAchievements = [],
    callingCardSnapshot = null,
    goldAppearance = null,
    playerLevel,
    prestigeLevel,
    prestigeFrame,
    prestigeTitle,
    prestigeAura,
    prestigeTrail
  }, {signal = null} = {}) {
    if (!isConfigured()) {
      throw new Error("Online-Highscores sind noch nicht konfiguriert.");
    }

    const normalizedScore = normalizeScore(score);
    if (normalizedScore <= 0) throw new Error("Ungueltiger Highscore.");
    const normalizedCallingCardSnapshot = normalizeCallingCardSnapshot(
      callingCardSnapshot ?? {
        playerLevel,
        prestigeLevel,
        prestigeFrame,
        prestigeTitle,
        prestigeAura,
        prestigeTrail,
        slimeAchievements,
        goldAppearance
      }
    );

    const payload = {
      p_player_id: normalizePlayerId(playerId),
      p_name: normalizeNickname(name),
      p_score: normalizedScore,
      p_level: normalizeLevel(level),
      p_game_version: GAME_VERSION,
      p_slime_color: SLIME_COLOR_COLUMN_ENABLED
        ? normalizeSlimeColor(slimeColor)
        : null,
      p_slime_cosmetic: SLIME_COSMETIC_COLUMN_ENABLED
        ? normalizeSlimeCosmetic(slimeCosmetic)
        : null,
      p_slime_beard: SLIME_BEARD_COLUMN_ENABLED
        ? normalizeSlimeBeard(slimeBeard)
        : null,
      p_slime_achievements: SLIME_ACHIEVEMENTS_COLUMN_ENABLED
        ? normalizeSlimeAchievementIds(slimeAchievements)
        : [],
      p_calling_card_snapshot: normalizedCallingCardSnapshot
    };

    console.info("[Highscore] GLOBAL BEST UPSERT START");

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/${SUBMIT_GLOBAL_BEST_RPC}`,
      {
        method: "POST",
        headers: headers({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
        cache: "no-store",
        ...(signal ? {signal} : {})
      }
    );

    if (!response.ok) {
      const errorDetails = await readResponseError(response);
      throw new Error(
        `Highscore konnte nicht gespeichert werden (${response.status})` +
        `${errorDetails ? `: ${errorDetails}` : "."}`
      );
    }

    const row = getRpcRow(await response.json());
    const storedBestScore = normalizeScore(row?.best_score ?? row?.bestScore);
    if (storedBestScore <= 0) {
      throw new Error("Highscore-RPC lieferte keinen gueltigen Bestscore.");
    }

    if (normalizedCallingCardSnapshot) callingCardSnapshotColumnAvailable = true;
    console.info("[Highscore] GLOBAL BEST UPSERT SUCCESS");
    return {
      bestScore: storedBestScore,
      improved: row?.improved === true
    };
  }

  window.SlimeJumpHighscores = Object.freeze({
    isConfigured,
    slimeColorColumnEnabled: SLIME_COLOR_COLUMN_ENABLED,
    slimeCosmeticColumnEnabled: SLIME_COSMETIC_COLUMN_ENABLED,
    slimeBeardColumnEnabled: SLIME_BEARD_COLUMN_ENABLED,
    slimeAchievementsColumnEnabled: SLIME_ACHIEVEMENTS_COLUMN_ENABLED,
    callingCardSnapshotColumn: CALLING_CARD_SNAPSHOT_COLUMN,
    submitGlobalBestRpc: SUBMIT_GLOBAL_BEST_RPC,
    getTopScores,
    submitScore
  });
})();







