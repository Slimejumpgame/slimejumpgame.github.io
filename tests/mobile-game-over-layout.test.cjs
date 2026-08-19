"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "css/style.css"), "utf8");

const mobileStart = css.indexOf(
  "/* Mobile game-over uses the complete game viewport without a scrolling card. */"
);
const mobileEnd = css.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
assert.ok(mobileStart >= 0 && mobileEnd > mobileStart);
const mobileCss = css.slice(mobileStart, mobileEnd);
const itemPickerStart = mobileCss.indexOf(
  "/* Mobile Game Over opens the existing free-unlock grid as a large item picker. */"
);
assert.ok(itemPickerStart >= 0);
const mainGameOverCss = mobileCss.slice(0, itemPickerStart);
const itemPickerCss = mobileCss.slice(itemPickerStart);
const landscapeStart = mobileCss.indexOf(
  "/* Short landscape phones keep one compact vertical Game Over flow. */"
);
assert.ok(landscapeStart >= 0);
const landscapeCss = mobileCss.slice(landscapeStart, itemPickerStart);

assert.match(
  html,
  /<section id="messageOverlay" class="overlay hidden">[\s\S]*?<div class="card uiPanel">/
);
[
  "messageTitle",
  "messageText",
  "gameOverXPPanel",
  "wardrobeUnlockPanel",
  "nicknameEntry",
  "nicknameInput",
  "continueBtn",
  "messageRestartBtn"
].forEach(id => assert.match(html, new RegExp(`id="${id}"`)));

assert.match(mobileCss, /@media \(hover: none\) and \(pointer: coarse\)/);
assert.match(
  mobileCss,
  /#messageOverlay:has\(:is\(#nicknameEntry, #gameOverXPPanel, #wardrobeUnlockPanel\):not\(\.hidden\)\)/
);
assert.match(mobileCss, /width: 100%;[\s\S]*?height: 100%;/);
assert.match(mobileCss, /max-height: none;/);
assert.match(mobileCss, /overflow: hidden;/);
assert.match(mobileCss, /border-radius: 0;/);
assert.match(mobileCss, /env\(safe-area-inset-top\)/);
assert.match(mobileCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(mobileCss, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(mainGameOverCss, /overflow-y:\s*(?:auto|scroll)/);
assert.match(landscapeCss, /display: flex;/);
assert.match(landscapeCss, /flex-direction: column;/);
assert.match(landscapeCss, /align-items: center;/);
assert.doesNotMatch(landscapeCss, /grid-column|grid-row/);
assert.doesNotMatch(landscapeCss, /minmax\(0, 0\.9fr\)|minmax\(0, 1\.1fr\)/);
assert.match(landscapeCss, /--game-over-content-width: min\(94%, 1100px\);/);
assert.match(landscapeCss, /width: 98%;/);
assert.match(landscapeCss, /height: 98%;/);
assert.match(landscapeCss, /justify-content: space-evenly;/);
assert.match(landscapeCss, /border: var\(--ui-border\) solid var\(--ui-line\);/);
assert.match(landscapeCss, /box-shadow: var\(--ui-shadow-panel\);/);
assert.match(
  landscapeCss,
  /grid-template-columns: minmax\(120px, 1fr\) minmax\(110px, 150px\) minmax\(140px, 1fr\);/
);
assert.match(landscapeCss, /min-height: clamp\(34px, 9\.5dvh, 44px\);/);
assert.equal(
  (landscapeCss.match(/width: var\(--game-over-content-width\);/g) || []).length,
  6,
  "all Game Over sections and the action row must share one centered width"
);
assert.doesNotMatch(landscapeCss, /--game-over-panel-width|--game-over-actions-width/);

assert.match(
  itemPickerCss,
  /#messageOverlay:has\(#wardrobeUnlockOptions:not\(\.hidden\)\) \.slimeColorUnlockPanel/
);
assert.match(itemPickerCss, /position: absolute;[\s\S]*?inset: 0;/);
assert.match(itemPickerCss, /grid-template-rows: auto auto minmax\(0, 1fr\) auto;/);
assert.match(itemPickerCss, /grid-template-columns: repeat\(auto-fill, minmax\(118px, 1fr\)\);/);
assert.match(itemPickerCss, /overflow-y: auto;/);
assert.match(itemPickerCss, /overscroll-behavior: contain;/);
assert.match(itemPickerCss, /touch-action: pan-y;/);
assert.match(itemPickerCss, /-webkit-overflow-scrolling: touch;/);
assert.match(itemPickerCss, /min-height: clamp\(70px, 20dvh, 84px\);/);

const uiSource = fs.readFileSync(path.join(projectRoot, "js/ui.js"), "utf8");
assert.match(uiSource, /createSlimeColorOption\(color, true\)/);
assert.match(uiSource, /createSlimeCosmeticOption\(cosmetic, true\)/);
assert.match(uiSource, /createSlimeBeardOption\(beard, true\)/);
assert.match(uiSource, /redeemPendingWardrobeUnlockChoice\("color", color\)/);
assert.match(uiSource, /redeemPendingWardrobeUnlockChoice\("cosmetic", cosmetic\)/);
assert.match(uiSource, /redeemPendingWardrobeUnlockChoice\("beard", beard\)/);

const expectedGameOverOrder = [
  "messageTitle",
  "messageText",
  "gameOverXPPanel",
  "wardrobeUnlockPanel",
  "nicknameEntry",
  "continueBtn",
  "messageRestartBtn"
];
let previousIndex = -1;
expectedGameOverOrder.forEach(id => {
  const index = html.indexOf(`id="${id}"`);
  assert.ok(index > previousIndex, `${id} must remain in vertical DOM order`);
  previousIndex = index;
});

assert.match(
  css.slice(0, mobileStart),
  /\.card \{[\s\S]*?width: min\(620px, 95%\);[\s\S]*?overflow-y: auto;/
);

const showMessageStart = fs
  .readFileSync(path.join(projectRoot, "js/game.js"), "utf8")
  .indexOf("  function showMessage(title, text, buttonText, action)");
assert.ok(showMessageStart >= 0, "existing Game Over flow must remain present");

console.log("Mobile Game Over layout tests passed.");
