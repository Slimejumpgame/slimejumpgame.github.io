/*
  Slime Soar – separates Online-Modul fuer persoenliche Bestscores und Rang.
  Dieses Modul ist bewusst nicht mit dem bestehenden Top-10-System gekoppelt.
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://sgmnirebveuvgupwguiw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_DDpbowG2-g6ZVios1OTrfA_DkUyh2TC";

  const INSTALLATION_ID_STORAGE_KEY = "slimejumperInstallationId";
  const LOCAL_PERSONAL_BEST_STORAGE_KEY = "slimejumperBest";
  const SUBMIT_PERSONAL_BEST_RPC = "submit_slime_jump_personal_best";
  const GET_PERSONAL_RANK_RPC = "get_slime_jump_personal_rank";
  const MAX_PERSONAL_BEST_SCORE = 1000000000;
  const UUID_V4_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let volatileInstallationId = null;

  function isConfigured() {
    return (
      /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL) &&
      SUPABASE_PUBLISHABLE_KEY &&
      !SUPABASE_PUBLISHABLE_KEY.startsWith("__")
    );
  }

  function isValidInstallationId(value) {
    return UUID_V4_PATTERN.test(String(value ?? "").trim());
  }

  function generateUuidV4() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }

    const bytes = new Uint8Array(16);
    if (typeof cryptoApi?.getRandomValues === "function") {
      cryptoApi.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index++) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  function getOrCreateInstallationId() {
    try {
      const storedId = localStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
      if (isValidInstallationId(storedId)) return storedId;
    } catch (_) {}

    if (isValidInstallationId(volatileInstallationId)) {
      return volatileInstallationId;
    }

    const installationId = generateUuidV4();
    volatileInstallationId = installationId;

    try {
      localStorage.setItem(INSTALLATION_ID_STORAGE_KEY, installationId);
    } catch (_) {}

    return installationId;
  }

  function normalizePositiveScore(value) {
    const normalized = Math.floor(Number(value));
    if (
      !Number.isSafeInteger(normalized) ||
      normalized <= 0 ||
      normalized > MAX_PERSONAL_BEST_SCORE
    ) return null;
    return normalized;
  }

  function normalizePositiveInteger(value) {
    const normalized = Math.floor(Number(value));
    return Number.isSafeInteger(normalized) && normalized > 0
      ? normalized
      : null;
  }

  async function readResponseError(response) {
    try {
      return String(await response.text()).trim().slice(0, 500);
    } catch (_) {
      return "";
    }
  }

  function getRpcRow(value) {
    if (Array.isArray(value)) return value[0] ?? null;
    return value && typeof value === "object" ? value : null;
  }

  async function callRpc(rpcName, payload) {
    if (!isConfigured()) return null;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          cache: "no-store"
        }
      );

      if (!response.ok) {
        const details = await readResponseError(response);
        console.warn(
          `[PlayerBests] RPC ${rpcName} fehlgeschlagen (${response.status})` +
          `${details ? `: ${details}` : "."}`
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn(`[PlayerBests] RPC ${rpcName} nicht erreichbar:`, error);
      return null;
    }
  }

  async function submitPersonalBest(bestScore) {
    const normalizedScore = normalizePositiveScore(bestScore);
    if (normalizedScore === null) return null;

    const result = await callRpc(SUBMIT_PERSONAL_BEST_RPC, {
      p_player_id: getOrCreateInstallationId(),
      p_best_score: normalizedScore
    });
    const row = getRpcRow(result);
    const storedBestScore = normalizePositiveScore(
      row?.best_score ?? row?.bestScore
    );
    if (storedBestScore === null) return null;

    return {
      bestScore: storedBestScore,
      improved: row?.improved === true
    };
  }

  async function getPersonalGlobalRank() {
    const result = await callRpc(GET_PERSONAL_RANK_RPC, {
      p_player_id: getOrCreateInstallationId()
    });
    const row = getRpcRow(result);
    const bestScore = normalizePositiveScore(row?.best_score ?? row?.bestScore);
    const rank = normalizePositiveInteger(row?.rank);

    if (bestScore === null || rank === null) {
      return {bestScore: null, rank: null};
    }
    return {bestScore, rank};
  }

  async function syncLocalPersonalBest() {
    let localBest = null;
    try {
      localBest = localStorage.getItem(LOCAL_PERSONAL_BEST_STORAGE_KEY);
    } catch (_) {
      return null;
    }

    const normalizedScore = normalizePositiveScore(localBest);
    return normalizedScore === null
      ? null
      : submitPersonalBest(normalizedScore);
  }

  window.SlimeJumpPlayerBests = Object.freeze({
    installationIdStorageKey: INSTALLATION_ID_STORAGE_KEY,
    submitPersonalBestRpc: SUBMIT_PERSONAL_BEST_RPC,
    getPersonalRankRpc: GET_PERSONAL_RANK_RPC,
    isConfigured,
    getOrCreateInstallationId,
    submitPersonalBest,
    getPersonalGlobalRank,
    syncLocalPersonalBest
  });
})();
