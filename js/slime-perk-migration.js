(() => {
  "use strict";

  const MIGRATION_MARKER_STORAGE_KEY = "slimejumperPerkMigrationVersion";
  const MIGRATION_TRANSACTION_STORAGE_KEY = "slimejumperPerkMigrationTransaction";
  const MIGRATION_VERSION = "perk-migration-2.65";
  const UNLOCKED_PERKS_STORAGE_KEY = "slimejumperUnlockedPerks";
  const SELECTED_PERKS_STORAGE_KEY = "slimejumperSelectedPerks";
  const PURCHASE_INFO_STORAGE_KEYS = Object.freeze([
    "slimejumperAirHopConflictPurchaseInfoSeen",
    "slimejumperAirBrakeConflictPurchaseInfoSeen"
  ]);

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
      if (typeof perks?.resetTemporaryStateForMigration !== "function") return false;

      if (!writeVerified(UNLOCKED_PERKS_STORAGE_KEY, "[]")) return false;
      if (!writeVerified(SELECTED_PERKS_STORAGE_KEY, "[]")) return false;
      for (const key of PURCHASE_INFO_STORAGE_KEYS) {
        localStorage.removeItem(key);
        if (localStorage.getItem(key) !== null) return false;
      }
      if (perks.resetTemporaryStateForMigration() !== true) return false;

      const perkStorageWasReset =
        localStorage.getItem(UNLOCKED_PERKS_STORAGE_KEY) === "[]" &&
        localStorage.getItem(SELECTED_PERKS_STORAGE_KEY) === "[]" &&
        PURCHASE_INFO_STORAGE_KEYS.every(key => localStorage.getItem(key) === null) &&
        perks.getActiveRunPerkIds?.().length === 0;
      if (!perkStorageWasReset) return false;

      if (!writeVerified(MIGRATION_MARKER_STORAGE_KEY, MIGRATION_VERSION)) return false;
      try { localStorage.removeItem(MIGRATION_TRANSACTION_STORAGE_KEY); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  applyMigration();
})();
