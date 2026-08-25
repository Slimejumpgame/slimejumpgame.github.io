"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const currentOldAssets = Object.freeze({
  "assets/environments/coast/platforms/coast_floating_left.png": [112, 127],
  "assets/environments/coast/platforms/coast_floating_middle.png": [300, 127],
  "assets/environments/coast/platforms/coast_floating_right.png": [108, 127]
});
const requiredNativeSizes = Object.freeze({
  coast_floating_left: {w: 128, h: 128},
  coast_floating_middle: {w: 256, h: 128},
  coast_floating_right: {w: 128, h: 128}
});

for (const [relativePath, oldSize] of Object.entries(currentOldAssets)) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual(
    [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    oldSize,
    `${relativePath} fixture changed; replace this rejection fixture when new assets arrive`
  );
}

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
    const size = currentOldAssets[value];
    this.complete = Boolean(size);
    this.naturalWidth = size?.[0] ?? 0;
    this.naturalHeight = size?.[1] ?? 0;
    (size ? this.onload : this.onerror)?.();
  }

  get src() {
    return this._src;
  }
}

const coastContext = vm.createContext({Image: FakeImage, Promise});
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-coast-assets.js")}
  globalThis.coastTestApi = COAST_ASSET_VISUALS;
`, coastContext, {filename: "coast-invalid-floating-assets-test.js"});
const coastApi = coastContext.coastTestApi;
const status = JSON.parse(JSON.stringify(coastApi.getStatus()));
assert.equal(status.ready, false);
assert.equal(status.familyAReady, false);
assert.equal(status.familyBReady, false);
assert.equal(coastApi.areAllReady(), false);
for (const [asset, requiredSize] of Object.entries(requiredNativeSizes)) {
  assert.deepEqual(status.expectedNativeSizes[asset], requiredSize);
  assert.equal(status.validNativeSizes[asset], false);
}

const drawCalls = [];
const canvasContext = new Proxy({
  drawImage(...args) { drawCalls.push(args); }
}, {
  get(target, property) {
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});
for (const platform of [
  {x: 420, y: 310, w: 138, h: 26},
  {x: 0, y: 640, w: 235, h: 80},
  {x: 500, y: 80, w: 220, h: 318, isGoalTower: true}
]) {
  assert.equal(coastApi.drawPlatformBase(canvasContext, platform, platform.x, 73), false);
}
assert.equal(drawCalls.length, 0, "invalid/missing Coast assets must never be drawn");

const rendererSource = read("js/renderer.js");
const drawStart = rendererSource.indexOf("  function drawPlatforms(");
const drawEnd = rendererSource.indexOf("  function drawGoal(", drawStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart);
let kitCalls = 0;
let fallbackFills = 0;
let detailCalls = 0;
const rendererPlatforms = [{x: 100, y: 200, w: 126, h: 26}];
const rendererCanvas = new Proxy({
  save() {},
  restore() {},
  fill() { fallbackFills++; }
}, {
  get(target, property) {
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});
const rendererContext = vm.createContext({
  SPIKE_PLATFORM_FULL_DRAW_WIDTH: 20,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx: rendererCanvas,
  currentLevel: () => ({seed: 73, spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawConveyorPlatformAsset: () => false,
  drawConveyorPlatformBeltOverlay: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: () => false,
  drawGhostStepFadeOutline: () => {},
  drawIcePlatformAsset: () => false,
  drawSpikePlatformAsset: () => false,
  drawStandardPlatformDetails: () => { detailCalls++; },
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => rendererPlatforms,
  isStandardPlatform: () => true,
  roundedRect: () => {},
  worldTime: 1.25
});
vm.runInContext(`${rendererSource.slice(drawStart, drawEnd)}
  globalThis.drawPlatformsForCoastTest = drawPlatforms;
`, rendererContext, {filename: "coast-vector-fallback-test.js"});
rendererContext.drawPlatformsForCoastTest(
  {id: "coast", platform: {body: "#123", top: "#456"}},
  {
    drawPlatformBase() {
      kitCalls++;
      return false;
    }
  }
);
assert.equal(kitCalls, 1);
assert.ok(fallbackFills >= 2, "renderer must draw its vector body and top fallback");
assert.equal(detailCalls, 1);

const coastSource = read("js/visual-coast-assets.js");
assert.match(coastSource, /createPlatformVisualKit/);
assert.doesNotMatch(
  coastSource,
  /LEGACY_COAST|SOURCE_SCALE|ASSET_CONTRACT|y:\s*22|drawLegacy|portal/i
);
assert.doesNotMatch(coastSource, /Math\.random\(/);
assert.match(
  read("index.html"),
  /visual-platform-kit\.js[\s\S]*visual-coast-assets\.js[\s\S]*renderer\.js/
);

for (const relativePath of [
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js"
]) {
  const headSource = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(normalize(read(relativePath)), normalize(headSource));
}

console.log("Coast legacy rejection, vector fallback and platform-kit scope tests passed.");
