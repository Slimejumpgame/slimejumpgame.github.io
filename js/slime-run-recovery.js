(() => {
  "use strict";

  const ACTIVE_RUN_RECOVERY_STORAGE_KEY = "slimejumperActiveRunRecovery";
  const ACTIVE_RUN_RECOVERY_FORMAT_VERSION = "active-run-recovery-v1";
  const ACTIVE_RUN_STATUS = "active";
  const COMPLETED_RUN_STATUS = "completed";
  const STORY_PRESENTATION_RUN_STATUS = "story_presentation";

  let recoveryBlocked = false;

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function removeRecoveryRecord() {
    try {
      localStorage.removeItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error("[RunRecovery] Recovery-Datensatz konnte nicht entfernt werden:", error);
      return false;
    }
  }

  function discardInvalidRecoveryRecord(reason) {
    console.warn(`[RunRecovery] Ungueltiger Recovery-Datensatz verworfen: ${reason}`);
    const removed = removeRecoveryRecord();
    recoveryBlocked = !removed;
    return removed;
  }

  function readRecoveryRecord() {
    let rawValue;
    try {
      rawValue = localStorage.getItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY);
    } catch (error) {
      console.error("[RunRecovery] Recovery-Datensatz konnte nicht gelesen werden:", error);
      recoveryBlocked = true;
      return {kind: "error"};
    }

    if (rawValue === null) return {kind: "none"};

    let record;
    try {
      record = JSON.parse(rawValue);
    } catch (_) {
      discardInvalidRecoveryRecord("ungueltiges JSON");
      return {kind: recoveryBlocked ? "error" : "invalid"};
    }

    if (!isObject(record)) {
      discardInvalidRecoveryRecord("Datensatz ist kein Objekt");
      return {kind: recoveryBlocked ? "error" : "invalid"};
    }
    if (record.formatVersion !== ACTIVE_RUN_RECOVERY_FORMAT_VERSION) {
      discardInvalidRecoveryRecord("unbekannte Formatversion");
      return {kind: recoveryBlocked ? "error" : "invalid"};
    }
    if (record.status === COMPLETED_RUN_STATUS) {
      return {kind: "completed", record};
    }
    if (
      record.status === STORY_PRESENTATION_RUN_STATUS &&
      isObject(record.achievementSnapshot) &&
      isObject(record.wardrobeSnapshot) &&
      ((record.storyLevel === 100 && record.storySequence === "middle") ||
        (record.storyLevel === 200 && record.storySequence === "ending"))
    ) {
      return {kind: "story", record};
    }
    if (
      record.status !== ACTIVE_RUN_STATUS ||
      !isObject(record.achievementSnapshot) ||
      !isObject(record.wardrobeSnapshot)
    ) {
      discardInvalidRecoveryRecord("Pflichtfelder fehlen");
      return {kind: recoveryBlocked ? "error" : "invalid"};
    }

    return {kind: "active", record};
  }

  function writeRecoveryRecord(record, errorMessage) {
    try {
      const serializedRecord = JSON.stringify(record);
      localStorage.setItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY, serializedRecord);
      if (localStorage.getItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY) !== serializedRecord) {
        throw new Error("geschriebener Datensatz konnte nicht verifiziert werden");
      }
      return true;
    } catch (error) {
      console.error(errorMessage, error);
      return false;
    }
  }

  function beginActiveRun({achievementSnapshot, wardrobeSnapshot} = {}) {
    if (recoveryBlocked) {
      console.error("[RunRecovery] Runstart blockiert, weil eine Recovery nicht sicher abgeschlossen wurde.");
      return false;
    }
    if (!isObject(achievementSnapshot) || !isObject(wardrobeSnapshot)) {
      console.error("[RunRecovery] Runstart ohne gueltige Pre-Run-Snapshots abgebrochen.");
      return false;
    }

    const record = {
      formatVersion: ACTIVE_RUN_RECOVERY_FORMAT_VERSION,
      status: ACTIVE_RUN_STATUS,
      achievementSnapshot,
      wardrobeSnapshot
    };

    return writeRecoveryRecord(
      record,
      "[RunRecovery] Pre-Run-Snapshot konnte nicht persistent gespeichert werden:"
    );
  }

  function protectStoryPresentation({levelNumber, sequence} = {}) {
    const storyLevel = Math.floor(Number(levelNumber));
    if (!((storyLevel === 100 && sequence === "middle") ||
      (storyLevel === 200 && sequence === "ending"))) {
      return false;
    }

    const storedRecovery = readRecoveryRecord();
    if (storedRecovery.kind !== "active") return false;
    return writeRecoveryRecord({
      ...storedRecovery.record,
      status: STORY_PRESENTATION_RUN_STATUS,
      storyLevel,
      storySequence: sequence
    }, "[RunRecovery] Story-Schutz konnte nicht persistent gespeichert werden:");
  }

  function resumeAfterStoryPresentation() {
    const storedRecovery = readRecoveryRecord();
    if (storedRecovery.kind === "none" || storedRecovery.kind === "active") return true;
    if (storedRecovery.kind !== "story") return false;
    const {storyLevel: _storyLevel, storySequence: _storySequence, ...record} = storedRecovery.record;
    return writeRecoveryRecord({
      ...record,
      status: ACTIVE_RUN_STATUS
    }, "[RunRecovery] Run konnte nach der Story nicht fortgesetzt werden:");
  }

  function markRunCompleted() {
    const completedRecord = JSON.stringify({
      formatVersion: ACTIVE_RUN_RECOVERY_FORMAT_VERSION,
      status: COMPLETED_RUN_STATUS
    });
    let completionPersisted = false;

    try {
      localStorage.setItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY, completedRecord);
      completionPersisted =
        localStorage.getItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY) === completedRecord;
    } catch (error) {
      console.error("[RunRecovery] Legitimer Run-Abschluss konnte nicht markiert werden:", error);
    }

    try {
      localStorage.removeItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY);
      recoveryBlocked = false;
      return true;
    } catch (error) {
      if (completionPersisted) {
        console.warn("[RunRecovery] Completed-Marker bleibt bis zum naechsten Start gespeichert:", error);
        recoveryBlocked = false;
        return true;
      }
      console.error("[RunRecovery] Aktiver Recovery-Datensatz konnte bei Game Over nicht neutralisiert werden:", error);
      recoveryBlocked = true;
      return false;
    }
  }

  function clearAfterRollback() {
    const cleared = removeRecoveryRecord();
    recoveryBlocked = !cleared;
    return cleared;
  }

  function hasStoredRecoveryRecord() {
    try {
      return localStorage.getItem(ACTIVE_RUN_RECOVERY_STORAGE_KEY) !== null;
    } catch (_) {
      return true;
    }
  }

  function neutralizeForMenu() {
    if (!hasStoredRecoveryRecord()) return true;
    return markRunCompleted();
  }

  function recoverInterruptedRun({
    isAchievementSnapshotValid,
    isWardrobeSnapshotValid,
    restoreAchievementSnapshot,
    restoreWardrobeSnapshot
  } = {}) {
    const storedRecovery = readRecoveryRecord();
    if (storedRecovery.kind === "none" || storedRecovery.kind === "invalid") {
      return {found: false, recovered: false, blocked: recoveryBlocked};
    }
    if (storedRecovery.kind === "error") {
      return {found: true, recovered: false, blocked: true};
    }
    if (storedRecovery.kind === "completed") {
      const cleared = removeRecoveryRecord();
      recoveryBlocked = !cleared;
      return {found: true, recovered: false, blocked: !cleared};
    }
    if (storedRecovery.kind === "story") {
      const cleared = removeRecoveryRecord();
      recoveryBlocked = !cleared;
      if (cleared) {
        console.info("[RunRecovery] Abgeschlossene Meilenstein-Belohnungen bleiben nach unterbrochener Story erhalten.");
      }
      return {
        found: true,
        recovered: false,
        storyPending: true,
        blocked: !cleared
      };
    }

    const {achievementSnapshot, wardrobeSnapshot} = storedRecovery.record;
    let snapshotsAreValid = false;
    try {
      snapshotsAreValid =
        typeof isAchievementSnapshotValid === "function" &&
        isAchievementSnapshotValid(achievementSnapshot) &&
        typeof isWardrobeSnapshotValid === "function" &&
        isWardrobeSnapshotValid(wardrobeSnapshot);
    } catch (error) {
      console.error("[RunRecovery] Snapshot-Validierung ist fehlgeschlagen:", error);
    }

    if (!snapshotsAreValid) {
      const discarded = discardInvalidRecoveryRecord("Progressions-Snapshot unbrauchbar");
      return {found: true, recovered: false, invalid: true, blocked: !discarded};
    }

    let achievementRestored = false;
    let wardrobeRestored = false;
    try {
      achievementRestored = restoreAchievementSnapshot(achievementSnapshot) === true;
      wardrobeRestored = restoreWardrobeSnapshot(wardrobeSnapshot) === true;
    } catch (error) {
      console.error("[RunRecovery] Startup-Restore ist fehlgeschlagen:", error);
    }

    if (!achievementRestored || !wardrobeRestored) {
      console.error("[RunRecovery] Startup-Restore wurde nicht vollstaendig persistiert.");
      recoveryBlocked = true;
      return {found: true, recovered: false, blocked: true};
    }

    const neutralized = neutralizeForMenu();
    if (!neutralized) return {found: true, recovered: true, blocked: true};

    console.info("[RunRecovery] Unvollstaendiger Run wurde auf den Pre-Run-Zustand zurueckgesetzt.");
    return {found: true, recovered: true, blocked: false};
  }

  window.SlimeRunRecovery = Object.freeze({
    storageKey: ACTIVE_RUN_RECOVERY_STORAGE_KEY,
    formatVersion: ACTIVE_RUN_RECOVERY_FORMAT_VERSION,
    beginActiveRun,
    protectStoryPresentation,
    resumeAfterStoryPresentation,
    markRunCompleted,
    clearAfterRollback,
    neutralizeForMenu,
    recoverInterruptedRun,
    hasStoredRecord: hasStoredRecoveryRecord,
    isBlocked: () => recoveryBlocked
  });
})();
