(() => {
  "use strict";

  const MIGRATION_MARKER_STORAGE_KEY = "slimejumperPerkMigrationVersion";
  const MIGRATION_TRANSACTION_STORAGE_KEY = "slimejumperPerkMigrationTransaction";
  const MIGRATION_VERSION = "perk-migration-2.65";
  const STAR_BONUS = 1500;
  const UNLOCKED_PERKS_STORAGE_KEY = "slimejumperUnlockedPerks";
  const SELECTED_PERKS_STORAGE_KEY = "slimejumperSelectedPerks";
  const PURCHASE_INFO_STORAGE_KEYS = Object.freeze([
    "slimejumperAirHopConflictPurchaseInfoSeen",
    "slimejumperAirBrakeConflictPurchaseInfoSeen"
  ]);

  function normalizeBalance(value) {
    const balance = Math.floor(Number(value));
    return Number.isSafeInteger(balance) &&
      balance >= 0 &&
      balance <= Number.MAX_SAFE_INTEGER - STAR_BONUS
      ? balance
      : 0;
  }

  function normalizeTransaction(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const originalBalance = Number(value.originalBalance);
    const targetBalance = Number(value.targetBalance);
    if (
      value.version !== MIGRATION_VERSION ||
      !Number.isSafeInteger(originalBalance) ||
      originalBalance < 0 ||
      !Number.isSafeInteger(targetBalance) ||
      targetBalance !== originalBalance + STAR_BONUS
    ) return null;
    return {version: MIGRATION_VERSION, originalBalance, targetBalance};
  }

  function readStoredTransaction() {
    try {
      const rawValue = localStorage.getItem(MIGRATION_TRANSACTION_STORAGE_KEY);
      return rawValue === null ? null : normalizeTransaction(JSON.parse(rawValue));
    } catch (_) {
      return null;
    }
  }

  function writeVerified(key, value) {
    const serialized = String(value);
    localStorage.setItem(key, serialized);
    return localStorage.getItem(key) === serialized;
  }

  function applyMigration() {
    try {
      if (localStorage.getItem(MIGRATION_MARKER_STORAGE_KEY) === MIGRATION_VERSION) {
        return true;
      }

      const perks = window.SlimePerks;
      const starEconomy = window.SlimeStarEconomy;
      if (
        typeof perks?.resetTemporaryStateForMigration !== "function" ||
        typeof starEconomy?.getBalance !== "function" ||
        typeof starEconomy?.applyPerkMigrationBalance !== "function"
      ) return false;

      let transaction = readStoredTransaction();
      if (!transaction) {
        const originalBalance = normalizeBalance(starEconomy.getBalance());
        transaction = {
          version: MIGRATION_VERSION,
          originalBalance,
          targetBalance: originalBalance + STAR_BONUS
        };
        const serializedTransaction = JSON.stringify(transaction);
        if (!writeVerified(MIGRATION_TRANSACTION_STORAGE_KEY, serializedTransaction)) {
          return false;
        }
      }

      if (!writeVerified(UNLOCKED_PERKS_STORAGE_KEY, "[]")) return false;
      if (!writeVerified(SELECTED_PERKS_STORAGE_KEY, "[]")) return false;
      for (const key of PURCHASE_INFO_STORAGE_KEYS) {
        localStorage.removeItem(key);
        if (localStorage.getItem(key) !== null) return false;
      }
      if (perks.resetTemporaryStateForMigration() !== true) return false;
      if (starEconomy.applyPerkMigrationBalance(transaction.targetBalance) !== true) {
        return false;
      }

      const perkStorageWasReset =
        localStorage.getItem(UNLOCKED_PERKS_STORAGE_KEY) === "[]" &&
        localStorage.getItem(SELECTED_PERKS_STORAGE_KEY) === "[]" &&
        PURCHASE_INFO_STORAGE_KEYS.every(key => localStorage.getItem(key) === null) &&
        perks.getActiveRunPerkIds?.().length === 0;
      const targetBalanceWasStored =
        localStorage.getItem("slimejumperStarBalance") ===
        String(transaction.targetBalance);
      if (!perkStorageWasReset || !targetBalanceWasStored) return false;

      if (!writeVerified(MIGRATION_MARKER_STORAGE_KEY, MIGRATION_VERSION)) return false;
      try { localStorage.removeItem(MIGRATION_TRANSACTION_STORAGE_KEY); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  applyMigration();
})();
