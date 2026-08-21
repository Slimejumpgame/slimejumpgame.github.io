"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const html = read("index.html");
const css = read("css/style.css");
const audio = read("js/audio.js");
const player = read("js/player.js");

assert.match(
  html,
  /<div id="menuXPProgress" class="menuXPProgress"[\s\S]*?<div id="menuXPProgressBar"/,
  "the existing XP/level panel structure must remain available"
);
assert.match(
  html,
  /<span id="personalGlobalRank" class="menuStatusBadge menuStatusBadge--rank"[\s\S]*?<strong id="personalGlobalRankValue">/,
  "the personal global-rank element and value binding must remain available"
);

const landscapeStart = css.indexOf(
  "@media (orientation: landscape) and (hover: none) and (pointer: coarse) {"
);
assert.ok(landscapeStart >= 0, "the phone-landscape menu rules must remain available");
const landscapeCss = css.slice(landscapeStart);
assert.match(
  landscapeCss,
  /#mainMenuScreen \.menuStatusBadge--rank\s*\{[\s\S]*?min-height: 0;[\s\S]*?padding: clamp\(4px, 1dvh, 6px\) clamp\(8px, 1\.2vw, 12px\);[\s\S]*?border-radius: clamp\(9px, 2\.5dvh, 13px\);[\s\S]*?background: rgba\(16, 28, 45, 0\.82\);[\s\S]*?font-size: clamp\(11px, 3\.3dvh, 16px\);/,
  "the rank panel must use the XP panel's responsive outer dimensions and panel style"
);
assert.match(
  landscapeCss,
  /#mainMenuScreen \.menuStatusBadge--rank::before\s*\{[\s\S]*?content: "\\00a0";[\s\S]*?padding-bottom: calc\([\s\S]*?clamp\(3px, 0\.8dvh, 5px\)[\s\S]*?clamp\(8px, 2\.5dvh, 12px\)/,
  "the rank panel must mirror the XP label gap and bar height in its natural outer height"
);
assert.match(
  landscapeCss,
  /#mainMenuScreen \.menuStatusBadge--rank,[\s\S]*?#mainMenuScreen \.menuStatusBadge--stars\s*\{[\s\S]*?width: 100%;/,
  "rank and XP columns must retain their existing full-width symmetry"
);

const launchMatch = audio.match(
  /function playLaunch\(\) \{ tone\(240, 0\.12, "triangle", ([0-9.]+), 520\); \}/
);
assert.ok(launchMatch, "the existing launch tone must remain identifiable");
assert.ok(
  Math.abs(Number(launchMatch[1]) / 0.084 - 1.10) < 1e-12,
  "launch gain must increase by exactly 10%"
);
assert.match(
  player,
  /if \(canLaunch && launch\.dragDistance > MIN_LAUNCH_DRAG\)[\s\S]*?playLaunch\(\);/,
  "the launch sound must remain attached to the successful slingshot release"
);

assert.match(audio, /function playBounce\(\) \{ tone\(150, 0\.07, "sine", 0\.035, 105\); \}/);
assert.match(audio, /tone\(660, 0\.08, "sine", 0\.05, 920\);/);
assert.match(audio, /tone\(990, 0\.1, "sine", 0\.04, 1220\)/);
assert.match(audio, /function playHurt\(\) \{ tone\(180, 0\.28, "sawtooth", 0\.06, 55\); \}/);
assert.match(audio, /const SFX_VOLUME_MULTIPLIER = 1\.30;/);
assert.match(audio, /const MUSIC_BUS_VOLUME = 0\.33;/);

console.log("Rank-window and launch-sound polish tests passed.");
