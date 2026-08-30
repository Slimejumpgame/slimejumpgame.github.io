"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {execFileSync} = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const coreSource = read("js/core.js");
const rendererSource = read("js/renderer.js");
const hazardSource = read("js/hazards.js");
const enemySource = read("js/enemies.js");
const physicsSource = read("js/physics.js");
const htmlSource = read("index.html");
const cssSource = read("css/style.css");

function createButton() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    click() {
      listeners.get("click")?.();
    }
  };
}

const graphicsStart = coreSource.indexOf("  const GRAPHICS_MODE_STORAGE_KEY");
const graphicsEnd = coreSource.indexOf("  let generatedLevel = null;", graphicsStart);
assert.ok(graphicsStart >= 0 && graphicsEnd > graphicsStart);
const graphicsSource = coreSource.slice(graphicsStart, graphicsEnd);

function createGraphicsFixture({storedMode = null, readError = false, writeError = false} = {}) {
  const buttons = Object.fromEntries([
    "fairyTaleGraphicsBtn",
    "legacyGraphicsBtn",
    "pauseFairyTaleGraphicsBtn",
    "pauseLegacyGraphicsBtn"
  ].map(id => [id, createButton()]));
  const writes = [];
  let refreshes = 0;
  let mascotRefreshes = 0;
  const refreshOrder = [];
  const context = vm.createContext({
    console,
    document: {
      getElementById(id) {
        return buttons[id] ?? null;
      }
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, "slimejumperGraphicsMode");
        if (readError) throw new Error("read denied");
        return storedMode;
      },
      setItem(key, value) {
        if (writeError) throw new Error("write denied");
        writes.push([key, value]);
      }
    },
    refreshMenuBiomeBackgroundForGraphicsMode() {
      refreshes++;
      refreshOrder.push("background");
    },
    renderMenuMascot() {
      mascotRefreshes++;
      refreshOrder.push("mascot");
    },
    getGraphicsModeRefreshCount() {
      return refreshes;
    },
    getMascotRefreshCount() {
      return mascotRefreshes;
    },
    getGraphicsModeRefreshOrder() {
      return refreshOrder;
    }
  });
  vm.runInContext(`${graphicsSource}
    globalThis.graphicsModeTestApi = {
      getMode: () => graphicsMode,
      setGraphicsMode,
      isFairyTaleGraphicsMode,
      buttons: ui,
      getRefreshes: getGraphicsModeRefreshCount,
      getMascotRefreshes: getMascotRefreshCount,
      getRefreshOrder: getGraphicsModeRefreshOrder
    };
  `, context, {filename: "graphics-mode-core-fixture.js"});
  return {api: context.graphicsModeTestApi, buttons, writes};
}

function assertButtonPair(fairyButton, legacyButton, expectedMode) {
  const fairyActive = expectedMode === "fairyTale";
  assert.equal(fairyButton.getAttribute("aria-pressed"), String(fairyActive));
  assert.equal(legacyButton.getAttribute("aria-pressed"), String(!fairyActive));
  assert.equal(fairyButton.classList.contains("uiButton--primary"), fairyActive);
  assert.equal(legacyButton.classList.contains("uiButton--primary"), !fairyActive);
  assert.equal(fairyButton.classList.contains("uiButton--secondary"), !fairyActive);
  assert.equal(legacyButton.classList.contains("uiButton--secondary"), fairyActive);
}

for (const setup of [
  {},
  {storedMode: "fairyTale"},
  {storedMode: "invalid"},
  {readError: true}
]) {
  const {api, buttons} = createGraphicsFixture(setup);
  assert.equal(api.getMode(), "fairyTale");
  assertButtonPair(buttons.fairyTaleGraphicsBtn, buttons.legacyGraphicsBtn, "fairyTale");
  assertButtonPair(
    buttons.pauseFairyTaleGraphicsBtn,
    buttons.pauseLegacyGraphicsBtn,
    "fairyTale"
  );
}

{
  const {api, buttons, writes} = createGraphicsFixture();
  buttons.legacyGraphicsBtn.click();
  assert.equal(api.getMode(), "legacy");
  assert.deepEqual(writes, [["slimejumperGraphicsMode", "legacy"]]);
  assert.equal(api.getRefreshes(), 1);
  assert.equal(api.getMascotRefreshes(), 1);
  assert.deepEqual(Array.from(api.getRefreshOrder()), ["background", "mascot"]);
  assertButtonPair(buttons.fairyTaleGraphicsBtn, buttons.legacyGraphicsBtn, "legacy");
  assertButtonPair(
    buttons.pauseFairyTaleGraphicsBtn,
    buttons.pauseLegacyGraphicsBtn,
    "legacy"
  );
}

{
  const {api, buttons, writes} = createGraphicsFixture({storedMode: "legacy"});
  assert.equal(api.getMode(), "legacy");
  assertButtonPair(buttons.fairyTaleGraphicsBtn, buttons.legacyGraphicsBtn, "legacy");
  assert.equal(api.setGraphicsMode("invalid"), false);
  assert.equal(api.getMode(), "legacy");
  assert.equal(writes.length, 0);
  buttons.pauseFairyTaleGraphicsBtn.click();
  assert.equal(api.getMode(), "fairyTale");
  assert.deepEqual(writes, [["slimejumperGraphicsMode", "fairyTale"]]);
  assert.equal(api.getRefreshes(), 1);
  assert.equal(api.getMascotRefreshes(), 1);
  assert.deepEqual(Array.from(api.getRefreshOrder()), ["background", "mascot"]);
  assertButtonPair(buttons.fairyTaleGraphicsBtn, buttons.legacyGraphicsBtn, "fairyTale");
  assertButtonPair(
    buttons.pauseFairyTaleGraphicsBtn,
    buttons.pauseLegacyGraphicsBtn,
    "fairyTale"
  );
}

{
  const {api, buttons} = createGraphicsFixture({writeError: true});
  assert.equal(api.setGraphicsMode("legacy"), true);
  assert.equal(api.getMode(), "legacy");
  assert.equal(api.getMascotRefreshes(), 1);
  assertButtonPair(buttons.fairyTaleGraphicsBtn, buttons.legacyGraphicsBtn, "legacy");
}

{
  const {api} = createGraphicsFixture();
  assert.equal(api.setGraphicsMode("fairyTale"), true);
  assert.equal(api.getRefreshes(), 0);
  assert.equal(api.getMascotRefreshes(), 0);
}

const setterStart = graphicsSource.indexOf("  function setGraphicsMode(");
const setterEnd = graphicsSource.indexOf("  ui.fairyTaleGraphicsBtn", setterStart);
const setterSource = graphicsSource.slice(setterStart, setterEnd);
assert.doesNotMatch(
  setterSource,
  /resetLevel|generateProceduralLevel|currentLevel|generatedLevel|worldTime|player|lives|score|seed|checkpoint|achievement/i
);
assert.doesNotMatch(setterSource, /setTimeout|setInterval|requestAnimationFrame/);
assert.doesNotMatch(coreSource, /slimejumperGraphicsMode[\s\S]{0,120}removeItem/);

const resolverStart = rendererSource.indexOf("  function getActiveBiomePlatformVisuals");
const resolverEnd = rendererSource.indexOf("  let decorAttemptLevel", resolverStart);
const resolverSource = rendererSource.slice(resolverStart, resolverEnd);
assert.equal((resolverSource.match(/!isFairyTaleGraphicsMode\(\)/g) ?? []).length, 3);
{
  const mode = {value: "fairyTale"};
  const resolveCalls = [];
  const context = vm.createContext({
    state: "playing",
    mode,
    getActiveVisualBiome: biome => biome,
    isTutorialStage: () => false,
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
    BIOME_PLATFORM_VISUALS: {
      resolve(id) {
        resolveCalls.push(["platform", id]);
        return {kind: "platform"};
      }
    },
    BIOME_DECOR_VISUALS: {
      resolve(id) {
        resolveCalls.push(["decor", id]);
        return {kind: "decor"};
      }
    },
    BIOME_PORTAL_VISUALS: {
      resolve(id) {
        resolveCalls.push(["portal", id]);
        return {kind: "portal"};
      }
    }
  });
  vm.runInContext(`${resolverSource}
    globalThis.resolverTestApi = {
      getActiveBiomePlatformVisuals,
      getActiveBiomeDecorVisuals,
      getActiveBiomePortalVisuals
    };
  `, context, {filename: "graphics-mode-resolver-fixture.js"});
  const biome = {id: "redMoon"};
  assert.equal(context.resolverTestApi.getActiveBiomePlatformVisuals(biome).kind, "platform");
  assert.equal(context.resolverTestApi.getActiveBiomeDecorVisuals(biome).kind, "decor");
  assert.equal(context.resolverTestApi.getActiveBiomePortalVisuals(biome).kind, "portal");
  assert.deepEqual(resolveCalls, [
    ["platform", "redMoon"],
    ["decor", "redMoon"],
    ["portal", "redMoon"]
  ]);
  mode.value = "legacy";
  assert.equal(context.resolverTestApi.getActiveBiomePlatformVisuals(biome), null);
  assert.equal(context.resolverTestApi.getActiveBiomeDecorVisuals(biome), null);
  assert.equal(context.resolverTestApi.getActiveBiomePortalVisuals(biome), null);
  assert.equal(resolveCalls.length, 3);
}
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?drawBackground\(biome\)/
);
for (const functionName of [
  "drawFallingPlatformAsset",
  "drawIcePlatformAsset",
  "drawConveyorPlatformAsset",
  "drawSpikePlatformAsset"
]) {
  const start = rendererSource.indexOf(`  function ${functionName}(`);
  const end = rendererSource.indexOf("\n  function ", start + 12);
  const source = rendererSource.slice(start, end);
  assert.match(source, /!isFairyTaleGraphicsMode\(\)[\s\S]*?return false/);
}
for (const source of [rendererSource, hazardSource, enemySource]) {
  assert.match(source, /typeof isFairyTaleGraphicsMode/);
}
assert.match(rendererSource, /function drawSlimeBody[\s\S]*?isFairyTaleGraphicsMode\(\)[\s\S]*?drawVectorSlimeBody/);
assert.match(rendererSource, /function drawSlimeFace[\s\S]*?isFairyTaleGraphicsMode\(\)[\s\S]*?drawCanvasSlimeFace/);
assert.match(rendererSource, /function drawBouncePads[\s\S]*?isFairyTaleGraphicsMode\(\)[\s\S]*?drawCanvasBouncePadFallback/);
assert.match(rendererSource, /function drawStars[\s\S]*?isFairyTaleGraphicsMode\(\)[\s\S]*?drawCanvasCollectibleStarFallback/);
assert.match(hazardSource, /isFairyTaleGraphicsMode\(\)[\s\S]*?MEADOW_ASSET_VISUALS\.drawBottomSpikeHazard/);
assert.match(enemySource, /isFairyTaleGraphicsMode\(\)[\s\S]*?drawCanvasGhostFallback/);
{
  const mode = {value: "fairyTale"};
  const bodyCalls = [];
  const bodyStart = rendererSource.indexOf("  function drawSlimeBody(");
  const bodyEnd = rendererSource.indexOf("\n  function isSlimeFaceImageReady", bodyStart);
  const context = vm.createContext({
    mode,
    Number,
    SLIME_BODY_DRAW_SIZE: 80,
    SLIME_BODY_REFERENCE_RADIUS: 30,
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
    getTintedSlimeBody: () => ({kind: "body-image"}),
    drawVectorSlimeBody: () => bodyCalls.push("vector")
  });
  vm.runInContext(`${rendererSource.slice(bodyStart, bodyEnd)}
    globalThis.drawSlimeBodyForTest = drawSlimeBody;
  `, context, {filename: "graphics-mode-slime-body-fixture.js"});
  const drawContext = {
    save() {},
    restore() {},
    drawImage() {
      bodyCalls.push("image");
    }
  };
  assert.equal(
    context.drawSlimeBodyForTest(drawContext, {glow: "#fff"}, 30),
    true
  );
  mode.value = "legacy";
  assert.equal(
    context.drawSlimeBodyForTest(drawContext, {glow: "#fff"}, 30),
    false
  );
  assert.deepEqual(bodyCalls, ["image", "vector"]);
}
{
  const mode = {value: "fairyTale"};
  const faceCalls = [];
  const faceStart = rendererSource.indexOf("  function drawSlimeFace(");
  const faceEnd = rendererSource.indexOf("\n  function normalizeSlimePreviewFaceState", faceStart);
  const context = vm.createContext({
    mode,
    SLIME_FACE_DRAW_SIZE: 80,
    slimeFaceImages: {normal: {kind: "face-image"}},
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
    isSlimeFaceImageReady: () => true,
    drawCanvasSlimeFace: () => faceCalls.push("canvas")
  });
  vm.runInContext(`${rendererSource.slice(faceStart, faceEnd)}
    globalThis.drawSlimeFaceForTest = drawSlimeFace;
  `, context, {filename: "graphics-mode-slime-face-fixture.js"});
  const drawContext = {
    save() {},
    restore() {},
    drawImage() {
      faceCalls.push("image");
    }
  };
  assert.equal(
    context.drawSlimeFaceForTest(drawContext, {}, "normal"),
    true
  );
  mode.value = "legacy";
  assert.equal(
    context.drawSlimeFaceForTest(drawContext, {}, "normal"),
    false
  );
  assert.deepEqual(faceCalls, ["image", "canvas"]);
}
{
  const mode = {value: "fairyTale"};
  const calls = [];
  const bounceStart = rendererSource.indexOf("  function drawBouncePads(");
  const bounceEnd = rendererSource.indexOf("\n  function areLegacyConveyorPlatformAssetsReady", bounceStart);
  const context = vm.createContext({
    mode,
    BOUNCE_PAD_SOURCE_BOUNDS: {x: 0, y: 15, w: 256, h: 104},
    bouncePadImage: {complete: true, naturalWidth: 256, naturalHeight: 119},
    currentLevel: () => ({pads: [{x: 10, y: 20, w: 60, h: 24}]}),
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
    drawCanvasBouncePadFallback: () => calls.push("canvas"),
    ctx: {
      save() {},
      restore() {},
      drawImage() {
        calls.push("image");
      }
    }
  });
  vm.runInContext(`${rendererSource.slice(bounceStart, bounceEnd)}
    globalThis.drawBouncePadsForTest = drawBouncePads;
  `, context, {filename: "graphics-mode-bounce-pad-fixture.js"});
  context.drawBouncePadsForTest();
  mode.value = "legacy";
  context.drawBouncePadsForTest();
  assert.deepEqual(calls, ["image", "canvas"]);
}
{
  const mode = {value: "fairyTale"};
  const calls = [];
  const starStart = rendererSource.indexOf("  function drawStars(");
  const starEnd = rendererSource.indexOf("\n  let currentAimBouncePreviewHit", starStart);
  const context = vm.createContext({
    mode,
    Math,
    worldTime: 0,
    collected: [false],
    COLLECTIBLE_STAR_DRAW_SIZE: 60,
    collectibleStarImage: {complete: true, naturalWidth: 256, naturalHeight: 256},
    currentLevel: () => ({stars: [{x: 10, y: 20}]}),
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
    drawCanvasCollectibleStarFallback: () => calls.push("canvas"),
    ctx: {
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      drawImage() {
        calls.push("image");
      }
    }
  });
  vm.runInContext(`${rendererSource.slice(starStart, starEnd)}
    globalThis.drawStarsForTest = drawStars;
  `, context, {filename: "graphics-mode-star-fixture.js"});
  context.drawStarsForTest();
  mode.value = "legacy";
  context.drawStarsForTest();
  assert.deepEqual(calls, ["image", "canvas"]);
}
{
  const mode = {value: "fairyTale"};
  const calls = [];
  class ReadyImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 256;
      this.naturalHeight = 256;
    }
    set src(value) {
      this.path = value;
    }
  }
  const drawContext = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage() {
      calls.push("image");
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {
      calls.push("canvas");
    },
    closePath() {},
    fill() {},
    stroke() {},
    arc() {}
  };
  const context = vm.createContext({
    Image: ReadyImage,
    Math,
    Object,
    mode,
    ctx: drawContext,
    worldTime: 0,
    player: {x: 0, y: 0},
    currentLevel: () => ({
      enemies: [{
        type: "normal",
        x: 100,
        y: 200,
        r: 24,
        axis: "x",
        range: 0,
        speed: 1,
        phase: 0
      }]
    }),
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale"
  });
  vm.runInContext(`${enemySource}
    globalThis.drawEnemiesForGraphicsModeTest = drawEnemies;
  `, context, {filename: "graphics-mode-ghost-fixture.js"});
  context.drawEnemiesForGraphicsModeTest();
  assert.deepEqual(calls, ["image"]);
  calls.length = 0;
  mode.value = "legacy";
  context.drawEnemiesForGraphicsModeTest();
  assert.equal(calls.includes("image"), false);
  assert.ok(calls.includes("canvas"));
}
{
  const spikeStart = hazardSource.indexOf("  function drawSpikeHazard(");
  const spikeEnd = hazardSource.indexOf("\n  function fillHazardGradient", spikeStart);
  const mode = {value: "fairyTale"};
  let assetDraws = 0;
  let canvasTriangles = 0;
  const context = vm.createContext({
    mode,
    isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
    MEADOW_ASSET_VISUALS: {
      drawBottomSpikeHazard() {
        assetDraws++;
        return true;
      }
    },
    ctx: {
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {
        canvasTriangles++;
      },
      stroke() {}
    }
  });
  vm.runInContext(`${hazardSource.slice(spikeStart, spikeEnd)}
    globalThis.drawSpikeHazardForTest = drawSpikeHazard;
  `, context, {filename: "graphics-mode-meadow-hazard-fixture.js"});
  const rect = {x: 0, y: 0, w: 96, h: 30};
  const colors = {fill: "#111", stroke: "#222"};
  context.drawSpikeHazardForTest(rect, colors);
  assert.equal(assetDraws, 1);
  assert.equal(canvasTriangles, 0);
  mode.value = "legacy";
  context.drawSpikeHazardForTest(rect, colors);
  assert.equal(assetDraws, 1);
  assert.equal(canvasTriangles, 4);
}

const tutorialHandStart = rendererSource.indexOf("  function drawTutorialDragHand(");
const tutorialHandEnd = rendererSource.indexOf("\n  function ", tutorialHandStart + 12);
assert.doesNotMatch(
  rendererSource.slice(tutorialHandStart, tutorialHandEnd),
  /isFairyTaleGraphicsMode/
);

const mainActionsStart = htmlSource.indexOf('<nav class="mainMenuActions"');
const mainActionsEnd = htmlSource.indexOf("</nav>", mainActionsStart);
const mainActionsSource = htmlSource.slice(mainActionsStart, mainActionsEnd);
assert.ok(mainActionsSource.indexOf('id="highScoresBtn"') >= 0);
assert.ok(
  mainActionsSource.indexOf('class="privacyLink"') >
    mainActionsSource.indexOf('id="highScoresBtn"')
);
for (const id of [
  "fairyTaleGraphicsBtn",
  "legacyGraphicsBtn",
  "pauseFairyTaleGraphicsBtn",
  "pauseLegacyGraphicsBtn"
]) {
  assert.equal((htmlSource.match(new RegExp(`id="${id}"`, "g")) ?? []).length, 1);
}
assert.match(htmlSource, /class="mainMenuGraphics"[\s\S]*?FAIRY<br>TALE[\s\S]*?LEGACY/);
assert.match(htmlSource, /class="pauseSettingsRow pauseAudioRow"[\s\S]*?pauseMusicBtn[\s\S]*?pauseSfxBtn/);
assert.match(htmlSource, /class="pauseSettingsRow pauseGraphicsRow"[\s\S]*?pauseFairyTaleGraphicsBtn[\s\S]*?pauseLegacyGraphicsBtn[\s\S]*?id="endRunBtn"/);
assert.match(cssSource, /\.mainMenuGraphics\s*\{[\s\S]*?right:[\s\S]*?env\(safe-area-inset-right\)/);
assert.match(cssSource, /\.pauseSettingsRow\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(cssSource, /@media \(orientation: portrait\)[\s\S]*?\.mainMenuAudio,[\s\S]*?\.mainMenuGraphics[\s\S]*?flex-direction: column/);
assert.match(
  cssSource,
  /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{\s*#mainMenuScreen \.privacyLink\s*\{\s*margin-top: clamp\(8px, 2\.8dvh, 14px\);/
);

assert.match(physicsSource, /function update\(dt\) \{\s*if \(state !== "playing"\) return;/);
for (const relativePath of [
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js"
]) {
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(read(relativePath).replace(/\r\n/g, "\n"), baseline.replace(/\r\n/g, "\n"));
}

console.log("Graphics mode state, UI, render dispatch and gameplay isolation tests passed.");
