/*
  Slime Soar – Installations-ID, Post-Reset-Retry und persoenlicher Rang.
  Sichtbare Top 10 und persoenlicher Rang verwenden dieselbe Highscore-Tabelle.
*/

(() => {
  "use strict";

  const SUPABASE_URL = "https://sgmnirebveuvgupwguiw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_DDpbowG2-g6ZVios1OTrfA_DkUyh2TC";

  const INSTALLATION_ID_STORAGE_KEY = "slimejumperInstallationId";
  const GLOBAL_RANK_BEST_STORAGE_KEY = "slimejumperGlobalRankBestV1";
  const GLOBAL_RANK_PAYLOAD_STORAGE_KEY = "slimejumperGlobalRankBestPayloadV1";
  const GET_PERSONAL_RANK_RPC = "get_slime_jump_personal_rank";
  const GLOBAL_BEST_SUBMIT_SETTLED_EVENT = "slimeglobalbestsubmitsettled";
  const RPC_TIMEOUT_MS = 5000;
  const MAX_PERSONAL_BEST_SCORE = 1000000000;
  const UUID_V4_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let volatileInstallationId = null;
  let pendingGlobalBestSubmit = Promise.resolve(null);

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

  function createAbortTimeout() {
    const AbortControllerConstructor = globalThis.AbortController;
    if (
      typeof AbortControllerConstructor !== "function" ||
      typeof globalThis.setTimeout !== "function"
    ) return null;

    const controller = new AbortControllerConstructor();
    const timeoutId = globalThis.setTimeout(
      () => controller.abort(),
      RPC_TIMEOUT_MS
    );
    return {
      signal: controller.signal,
      clear() {
        if (typeof globalThis.clearTimeout === "function") {
          globalThis.clearTimeout(timeoutId);
        }
      }
    };
  }

  function createTimeoutError(label) {
    const error = new Error(`${label} hat das Zeitlimit ueberschritten.`);
    error.name = "AbortError";
    return error;
  }

  function settleWithinTimeout(promise, label, timeout = createAbortTimeout()) {
    if (!timeout) return Promise.resolve(promise);

    const timeoutResult = new Promise((_, reject) => {
      timeout.signal.addEventListener(
        "abort",
        () => reject(createTimeoutError(label)),
        {once: true}
      );
    });
    return Promise.race([Promise.resolve(promise), timeoutResult])
      .finally(() => timeout.clear());
  }

  function notifyGlobalBestSubmitSettled() {
    const CustomEventConstructor = globalThis.CustomEvent;
    if (
      typeof window.dispatchEvent !== "function" ||
      typeof CustomEventConstructor !== "function"
    ) return;

    try {
      window.dispatchEvent(new CustomEventConstructor(
        GLOBAL_BEST_SUBMIT_SETTLED_EVENT
      ));
    } catch (_) {}
  }

  async function callRpc(rpcName, payload) {
    if (!isConfigured()) return null;

    const timeout = createAbortTimeout();

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
          cache: "no-store",
          ...(timeout ? {signal: timeout.signal} : {})
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
      const reason = error?.name === "AbortError"
        ? "Zeitlimit ueberschritten"
        : "nicht erreichbar";
      console.warn(`[PlayerBests] RPC ${rpcName} ${reason}:`, error);
      return null;
    } finally {
      timeout?.clear();
    }
  }

  function normalizeGlobalBestPayload(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const score = normalizePositiveScore(value.score);
    if (score === null) return null;
    return {...value, score};
  }

  function readLocalGlobalBestScore() {
    try {
      return normalizePositiveScore(
        localStorage.getItem(GLOBAL_RANK_BEST_STORAGE_KEY)
      );
    } catch (_) {
      return null;
    }
  }

  function readLocalGlobalBestPayload() {
    try {
      return normalizeGlobalBestPayload(JSON.parse(
        localStorage.getItem(GLOBAL_RANK_PAYLOAD_STORAGE_KEY) || "null"
      ));
    } catch (_) {
      return null;
    }
  }

  function storeLocalGlobalBest(payload) {
    try {
      localStorage.setItem(
        GLOBAL_RANK_PAYLOAD_STORAGE_KEY,
        JSON.stringify(payload)
      );
      localStorage.setItem(GLOBAL_RANK_BEST_STORAGE_KEY, String(payload.score));
      return true;
    } catch (_) {
      return false;
    }
  }

  function submitGlobalBestPayload(payload) {
    const online = window.SlimeJumpHighscores;
    if (
      typeof online?.submitScore !== "function" ||
      online.isConfigured?.() === false
    ) return Promise.resolve(null);

    pendingGlobalBestSubmit = pendingGlobalBestSubmit
      .catch(() => null)
      .then(() => {
        const timeout = createAbortTimeout();
        const submitAttempt = Promise.resolve().then(() => online.submitScore(
          {
            ...payload,
            playerId: getOrCreateInstallationId()
          },
          timeout ? {signal: timeout.signal} : undefined
        ));
        void submitAttempt.then(
          notifyGlobalBestSubmitSettled,
          notifyGlobalBestSubmitSettled
        );
        return settleWithinTimeout(submitAttempt, "Global-Best-Submit", timeout);
      })
      .catch(error => {
        console.warn("[PlayerBests] Globaler Bestscore konnte nicht synchronisiert werden:", error);
        return null;
      });

    return pendingGlobalBestSubmit;
  }

  function recordGlobalBestCandidate(value) {
    const candidate = normalizeGlobalBestPayload(value);
    if (!candidate) return Promise.resolve(null);

    const storedScore = readLocalGlobalBestScore();
    const storedPayload = readLocalGlobalBestPayload();
    const shouldReplaceStoredBest =
      storedScore === null ||
      candidate.score > storedScore ||
      (candidate.score === storedScore && storedPayload?.score !== storedScore);

    if (shouldReplaceStoredBest) {
      storeLocalGlobalBest(candidate);
      return submitGlobalBestPayload(candidate);
    }

    if (!storedPayload || storedPayload.score !== storedScore) {
      return Promise.resolve(null);
    }

    return submitGlobalBestPayload(storedPayload);
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

  function syncLocalGlobalBest() {
    const storedScore = readLocalGlobalBestScore();
    const storedPayload = readLocalGlobalBestPayload();
    if (
      storedScore === null ||
      !storedPayload ||
      storedPayload.score !== storedScore
    ) return Promise.resolve(null);

    return submitGlobalBestPayload(storedPayload);
  }

  window.SlimeJumpPlayerBests = Object.freeze({
    installationIdStorageKey: INSTALLATION_ID_STORAGE_KEY,
    globalRankBestStorageKey: GLOBAL_RANK_BEST_STORAGE_KEY,
    globalRankPayloadStorageKey: GLOBAL_RANK_PAYLOAD_STORAGE_KEY,
    getPersonalRankRpc: GET_PERSONAL_RANK_RPC,
    globalBestSubmitSettledEvent: GLOBAL_BEST_SUBMIT_SETTLED_EVENT,
    rpcTimeoutMs: RPC_TIMEOUT_MS,
    isConfigured,
    getOrCreateInstallationId,
    getPersonalGlobalRank,
    recordGlobalBestCandidate,
    syncLocalGlobalBest
  });
})();
