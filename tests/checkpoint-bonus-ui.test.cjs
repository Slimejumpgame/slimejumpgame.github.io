"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const extract = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing block: ${start}`);
  return source.slice(startIndex, endIndex);
};

const index = read("index.html");
const css = read("css/style.css");
const controller = read("js/slime-checkpoint-bonus.js");
const game = read("js/game.js");
const audio = read("js/audio.js");

const overlay = extract(
  index,
  '<section id="checkpointBonusOverlay"',
  '<section id="tutorialCompleteOverlay"'
);
assert.equal((overlay.match(/checkpointBonusReelFrame/g) ?? []).length, 1);
assert.equal((overlay.match(/checkpointBonusPrevious/g) ?? []).length, 1);
assert.equal((overlay.match(/checkpointBonusCurrent/g) ?? []).length, 1);
assert.equal((overlay.match(/checkpointBonusNext/g) ?? []).length, 1);
assert.match(overlay, /id="checkpointBonusLever"/);
assert.match(overlay, /id="checkpointBonusAction"[^>]*>SPIN STARTEN</);
assert.match(overlay, /role="dialog" aria-modal="true"/);
assert.doesNotMatch(overlay, /(?:close|schlie|skip|überspring|aria-label="x"|>x<)/i);

const controllerScriptIndex = index.indexOf('<script src="./js/slime-checkpoint-bonus.js">');
assert.ok(controllerScriptIndex > index.indexOf('<script src="./js/audio.js">'));
assert.ok(controllerScriptIndex > index.indexOf('<script src="./js/ui.js">'));
assert.ok(controllerScriptIndex < index.indexOf('<script src="./js/game.js">'));

assert.match(controller, /const AUTO_STOP_MS = 5000;/);
assert.match(controller, /const DECELERATION_MS = 2350;/);
assert.match(controller, /const DECELERATION_MIN_STEPS = 14;/);
assert.match(controller, /window\.requestAnimationFrame\(decelerate\)/);
assert.match(controller, /1 - Math\.pow\(1 - progress, 3\)/);
assert.match(controller, /if \(runtimeMode !== "spinning"/);
assert.match(controller, /runtimeMode = "decelerating";/);
assert.match(controller, /document\.addEventListener\("keydown", preventEscape, true\)/);
assert.match(controller, /event\.target === dom\.checkpointBonusOverlay/);
assert.match(controller, /window\.cancelAnimationFrame\(animationFrameId\)/);

assert.match(css, /\.checkpointBonusOverlay\s*\{[\s\S]*?position: fixed;[\s\S]*?z-index: 2600;/);
assert.match(css, /\.checkpointBonusMachine\s*\{/);
assert.match(css, /\.checkpointBonusLever\s*\{/);
assert.match(css, /\.checkpointBonusWinLine\s*\{/);
assert.match(css, /\.checkpointBonusPanel--jackpot\s*\{/);
assert.match(css, /@media \(max-height: 520px\)[\s\S]*?\.checkpointBonusMachine/);
assert.match(css, /max-height: calc\(100dvh - 16px/);
assert.doesNotMatch(css, /\.checkpointBonusOverlay[\s\S]{0,180}overflow-x:\s*(?:scroll|auto)/);

const requiredDevControls = [
  "devCheckpointBonusOpenBtn",
  "devCheckpointBonusSimulateBtn",
  "stars_100",
  "life_refill",
  "stars_500",
  "color_voucher",
  "hat_voucher",
  "beard_voucher",
  "gold_slime",
  "devCheckpointBonusResetBtn",
  "devCheckpointBonusPendingPreparedBtn",
  "devCheckpointBonusPendingLandedBtn",
  "devCheckpointBonusPendingPaidBtn",
  "devCheckpointBonusReplayClaimedBtn",
  "devCheckpointBonusRollbackBtn",
  "devCheckpointBonusInspectorBtn"
];
for (const control of requiredDevControls) assert.match(index, new RegExp(control));
assert.match(index, /current pool|current pool/i.test(index) ? /current pool/i : /BONUS INSPECTOR/);
assert.match(controller, /effectiveWeights/);
assert.match(controller, /highestClaimedCheckpoint/);

const finishLevel = extract(game, "  function finishLevel() {", "  function loseLife() {");
const checkpointWriteIndex = finishLevel.indexOf("recordReachedCheckpoint(completedLevel)");
const pendingPrepareIndex = finishLevel.indexOf("prepareCheckpoint?.(checkpointResult.checkpointLevel)");
const achievementIndex = finishLevel.indexOf("SlimeAchievements?.onLevelCompleted");
const normalDialogIndex = finishLevel.indexOf("const continueLevelEndFlow");
const slotOpenIndex = finishLevel.indexOf("SlimeCheckpointBonus?.openPending");
assert.ok(checkpointWriteIndex >= 0 && pendingPrepareIndex > checkpointWriteIndex);
assert.ok(achievementIndex > pendingPrepareIndex);
assert.ok(normalDialogIndex > achievementIndex && slotOpenIndex > normalDialogIndex);
assert.match(finishLevel, /if \(checkpointBonusPending\)[\s\S]*?return;[\s\S]*?continueLevelEndFlow\(\);/);

assert.match(controller, /typeof tone === "function"/);
assert.match(controller, /typeof playWin === "function"/);
assert.match(controller, /typeof playStar === "function"/);
assert.match(audio, /gain\.connect\(master\);/);
assert.match(audio, /globalThis\.document\?\.addEventListener\?\.\("visibilitychange"/);

console.log("Checkpoint bonus single-reel UI, timing, non-skip, DEV and lifecycle-audio tests passed.");
