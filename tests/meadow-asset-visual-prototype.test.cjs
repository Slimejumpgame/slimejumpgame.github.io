"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const readRelease = relativePath => execFileSync(
  "git",
  ["show", `1912d04:${relativePath.replace(/\\/g, "/")}`],
  {cwd: root, encoding: "utf8"}
);
const normalize = source => source.replace(/\r\n/g, "\n");

const protectedFiles = [
  "css/style.css",
  "js/biomes.js",
  "js/core.js",
  "js/game.js",
  "js/hazards.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/ui.js"
];
for (const relativePath of protectedFiles) {
  assert.equal(
    normalize(read(relativePath)),
    normalize(readRelease(relativePath)),
    `${relativePath} must remain byte-equivalent to v2.72 apart from line endings`
  );
}

const assetExpectations = Object.freeze({
  "assets/environments/meadow/background/meadow_background.png": [1672, 941],
  "assets/environments/meadow/decor/meadow_decor.png": [1448, 1086],
  "assets/environments/meadow/platforms/meadow_tileset.png": [1448, 1086],
  "assets/environments/meadow/platforms/floating_left.png": [112, 127],
  "assets/environments/meadow/platforms/floating_middle.png": [300, 127],
  "assets/environments/meadow/platforms/floating_right.png": [108, 127],
  "assets/environments/meadow/platforms/start_platform.png": [471, 119],
  "assets/environments/meadow/portal/meadow_portal_props.png": [1448, 1086]
});
const assetHashesBefore = new Map();
for (const [relativePath, dimensions] of Object.entries(assetExpectations)) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], dimensions);
  assetHashesBefore.set(
    relativePath,
    crypto.createHash("sha256").update(bytes).digest("hex")
  );
}

function createMathFixture(randomValue) {
  const math = Object.create(Math);
  math.random = () => randomValue;
  return math;
}

function loadGenerator(source, levelNumber, seedIndex) {
  const context = vm.createContext({
    Date: {now: () => 1712345678901 + levelNumber * 97 + seedIndex * 7919},
    H: 720,
    Math: createMathFixture(0.1732050807 + levelNumber * 0.001 + seedIndex * 0.113),
    Set,
    W: 1280,
    window: {SlimePerks: {shouldGenerateLuckyCharmBonusStar: () => false}}
  });
  vm.runInContext(`
    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function createSeededRandom(seed) {
      let state = seed >>> 0;
      return function random() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }
    function randomRange(random, min, max) {
      return min + (max - min) * random();
    }
    function randomInt(random, min, max) {
      return Math.floor(randomRange(random, min, max + 1));
    }
    function chooseRandom(random, values) {
      return values[Math.floor(random() * values.length)];
    }
    function rectanglesOverlap(a, b, padding = 0) {
      return (
        a.x < b.x + b.w + padding &&
        a.x + a.w + padding > b.x &&
        a.y < b.y + b.h + padding &&
        a.y + a.h + padding > b.y
      );
    }
    ${source}
    globalThis.generatedForTest = generateProceduralLevel(${levelNumber});
  `, context, {filename: "meadow-geometry-generator-fixture.js"});
  return JSON.parse(JSON.stringify(context.generatedForTest));
}

function geometrySnapshot(level) {
  return {
    platforms: level.platforms,
    goal: level.goal,
    stars: level.stars,
    spikes: level.spikes,
    pads: level.pads,
    movers: level.movers,
    fallingPlatforms: level.fallingPlatforms,
    conveyors: level.conveyors,
    fadePlatforms: level.fadePlatforms,
    icePlatforms: level.icePlatforms,
    spikePlatforms: level.spikePlatforms,
    enemies: level.enemies
  };
}

const currentGeneratorSource = read("js/level-generator.js");
const baselineGeneratorSource = readRelease("js/level-generator.js");
const generatedLevels = [];
for (let levelNumber = 1; levelNumber <= 10; levelNumber++) {
  for (let seedIndex = 0; seedIndex < 6; seedIndex++) {
    const current = loadGenerator(currentGeneratorSource, levelNumber, seedIndex);
    const baseline = loadGenerator(baselineGeneratorSource, levelNumber, seedIndex);
    assert.deepEqual(
      geometrySnapshot(current),
      geometrySnapshot(baseline),
      `level ${levelNumber}, seed ${seedIndex} geometry differs from v2.72`
    );
    generatedLevels.push(current);
  }
}

let imageConstructionCount = 0;
class FakeImage {
  constructor() {
    imageConstructionCount += 1;
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
    this.complete = true;
    this.naturalWidth = 1;
    this.naturalHeight = 1;
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

const visualContext = vm.createContext({Image: FakeImage, Promise});
vm.runInContext(`${read("js/visual-meadow-assets.js")}
  globalThis.meadowAssetVisualsForTest = MEADOW_ASSET_VISUALS;
`, visualContext, {filename: "js/visual-meadow-assets.js"});
const visualApi = visualContext.meadowAssetVisualsForTest;
assert.equal(imageConstructionCount, 8, "assets must be constructed once at module load");
assert.equal(visualApi.areAllReady(), true);
assert.deepEqual(
  JSON.parse(JSON.stringify(visualApi.getStatus().paths)),
  {
    background: "assets/environments/meadow/background/meadow_background.png",
    decor: "assets/environments/meadow/decor/meadow_decor.png",
    platforms: "assets/environments/meadow/platforms/meadow_tileset.png",
    floating_left: "assets/environments/meadow/platforms/floating_left.png",
    floating_middle: "assets/environments/meadow/platforms/floating_middle.png",
    floating_right: "assets/environments/meadow/platforms/floating_right.png",
    start_platform: "assets/environments/meadow/platforms/start_platform.png",
    portal: "assets/environments/meadow/portal/meadow_portal_props.png"
  }
);
const meadowManifest = JSON.parse(JSON.stringify(visualApi.getManifest()));
assert.equal(meadowManifest.biome, "meadow");
assert.deepEqual(meadowManifest.platforms.contract, {
  floating: {
    height: 26,
    leftWidth: 23,
    rightWidth: 22,
    middleMode: "horizontal-scale-or-crop"
  },
  start: {width: 235, height: 80},
  goal: {
    width: 220,
    topHeight: 80,
    bodyHeight: 48,
    bodyOverlap: 1,
    lastBodyMode: "crop"
  }
});
assert.deepEqual(Object.keys(meadowManifest.platforms.slots), [
  "floating_left",
  "floating_middle",
  "floating_right",
  "start_platform",
  "GOAL_TOP",
  "GOAL_BODY_A",
  "GOAL_BODY_B",
  "GOAL_BODY_C",
  "GOAL_BODY_D",
  "GOAL_BODY_E",
  "GOAL_BODY_F"
]);

const drawCalls = [];
const fakeCanvasContext = new Proxy({}, {
  get(target, property) {
    if (property === "drawImage") {
      return (...args) => drawCalls.push(args);
    }
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});

for (const level of generatedLevels) {
  const before = JSON.stringify(geometrySnapshot(level));
  const scene = visualApi.getScene(level);
  assert.equal(scene, visualApi.getScene(level), "visual scene should be cached by level");
  assert.equal(scene.backDecor.length, 5);
  assert.equal(scene.foregroundDecor.length, 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(scene)),
    JSON.parse(JSON.stringify(visualApi.getScene(JSON.parse(JSON.stringify(level))))),
    "equal seeds and geometry should produce equal visual decoration"
  );
  for (let frame = 0; frame < 12; frame++) {
    assert.equal(visualApi.drawBackground(fakeCanvasContext, 1280, 720), true);
    assert.equal(visualApi.drawBackDecor(fakeCanvasContext, scene), true);
    for (const platform of level.platforms) {
      assert.equal(
        visualApi.drawPlatformBase(
          fakeCanvasContext,
          platform,
          platform.x,
          level.seed
        ),
        true
      );
    }
    assert.equal(visualApi.drawPortal(fakeCanvasContext, level.goal), true);
    assert.equal(visualApi.drawForegroundDecor(fakeCanvasContext, scene), true);
  }
  assert.equal(
    JSON.stringify(geometrySnapshot(level)),
    before,
    "asset rendering must not mutate level geometry or gameplay data"
  );
}
assert.equal(imageConstructionCount, 8, "draw calls must not construct additional images");
assert.ok(drawCalls.length > 0);
assert.ok(
  drawCalls.every(call => call.length === 5 || call.length === 9),
  "asset draws must use standalone-image or source-slice overloads"
);

function assertDrawBounds(platform, calls) {
  const epsilon = 0.001;
  assert.ok(calls.length > 0);
  for (const call of calls) {
    const [destinationX, destinationY, destinationWidth, destinationHeight] =
      call.length === 5 ? call.slice(1, 5) : call.slice(5, 9);
    assert.ok(destinationX >= platform.x - epsilon);
    assert.ok(destinationY >= platform.y - epsilon);
    assert.ok(destinationX + destinationWidth <= platform.x + platform.w + epsilon);
    assert.ok(destinationY + destinationHeight <= platform.y + platform.h + epsilon);
  }
}

const floatingAssetPaths = [
  "assets/environments/meadow/platforms/floating_middle.png",
  "assets/environments/meadow/platforms/floating_left.png",
  "assets/environments/meadow/platforms/floating_right.png"
];
for (const width of [100, 138, 176]) {
  const floatingPlatform = {x: 420, y: 310, w: width, h: 26};
  drawCalls.length = 0;
  assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, floatingPlatform), true);
  assert.equal(drawCalls.length, 3, "floating platforms must use left/middle/right draws");
  assertDrawBounds(floatingPlatform, drawCalls);
  assert.ok(drawCalls.every(call => call.length === 5));
  assert.deepEqual(drawCalls.map(call => call[0].src), floatingAssetPaths);
  const destinations = drawCalls.map(call => call.slice(1, 5));
  assert.deepEqual(destinations[0], [442, 310, width - 43, 26]);
  assert.deepEqual(destinations[1], [420, 310, 23, 26]);
  assert.deepEqual(destinations[2], [420 + width - 22, 310, 22, 26]);
  assert.equal(destinations[1][0] + destinations[1][2] - destinations[0][0], 1);
  assert.equal(destinations[0][0] + destinations[0][2] - destinations[2][0], 1);
  assert.equal(destinations[2][0] + destinations[2][2], floatingPlatform.x + width);
}
assert.ok(Math.abs(23 / 112 - 26 / 127) < 0.002);
assert.ok(Math.abs(22 / 108 - 26 / 127) < 0.002);

const startPlatform = {x: 0, y: 640, w: 235, h: 80};
drawCalls.length = 0;
assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, startPlatform), true);
assert.equal(drawCalls.length, 1, "the start platform must remain one full-sprite draw");
assertDrawBounds(startPlatform, drawCalls);
assert.equal(drawCalls[0].length, 5);
assert.equal(
  drawCalls[0][0].src,
  "assets/environments/meadow/platforms/start_platform.png"
);
assert.deepEqual(drawCalls[0].slice(1, 5), [0, 640, 235, 80]);

const goalTopCapSource = [1170, 672, 214, 203];
const goalBodySources = [
  [320, 370, 239, 230],
  [599, 370, 238, 230],
  [876, 370, 240, 230],
  [317, 627, 242, 229],
  [600, 627, 239, 229],
  [877, 626, 240, 231]
];

function assertGoalComposition(platform, seed, expectedBodyDraws) {
  drawCalls.length = 0;
  assert.equal(
    visualApi.drawPlatformBase(fakeCanvasContext, platform, platform.x, seed),
    true
  );
  assert.equal(drawCalls.length, expectedBodyDraws + 1);
  assertDrawBounds(platform, drawCalls);

  const topCapCall = drawCalls.at(-1);
  assert.deepEqual(topCapCall.slice(1, 5), goalTopCapSource);
  assert.deepEqual(
    topCapCall.slice(5, 9),
    [platform.x, platform.y, 220, 80]
  );

  let previousBodySource = null;
  const bodyCalls = drawCalls.slice(0, -1);
  const lastBodyY = platform.y + 79 + (bodyCalls.length - 1) * 47;
  assert.equal(
    bodyCalls.at(-1)[8],
    platform.y + platform.h - lastBodyY,
    "the final body row must be cropped to the exact remaining height"
  );
  for (const [rowIndex, call] of bodyCalls.entries()) {
    const [, sourceX, sourceY, sourceWidth, sourceHeight,
      destinationX, destinationY, destinationWidth, destinationHeight] = call;
    const fullSource = goalBodySources.find(source =>
      source[0] === sourceX && source[1] === sourceY && source[2] === sourceWidth
    );
    assert.ok(fullSource, `unexpected goal body source: ${call.slice(1, 5)}`);
    assert.ok(sourceHeight > 0 && sourceHeight <= fullSource[3]);
    assert.ok(Math.abs(sourceHeight / fullSource[3] - destinationHeight / 48) < 1e-9);
    assert.equal(destinationX, platform.x);
    assert.equal(destinationWidth, 220);
    assert.equal(destinationY, platform.y + 79 + rowIndex * 47);
    assert.ok(destinationHeight > 0 && destinationHeight <= 48);
    if (rowIndex < bodyCalls.length - 1) assert.equal(destinationHeight, 48);
    const sourceKey = [sourceX, sourceY, sourceWidth].join(",");
    assert.notEqual(sourceKey, previousBodySource, "adjacent body variants must differ");
    previousBodySource = sourceKey;
  }
}

assertGoalComposition({x: 1060, y: 570, w: 220, h: 150}, 7, 2);
assertGoalComposition({x: 1060, y: 470, w: 220, h: 250}, 9, 4);
assertGoalComposition({x: 1060, y: 370, w: 220, h: 350}, 11, 6);
assertGoalComposition({x: 1060, y: 270, w: 220, h: 450}, 12, 8);
assertGoalComposition({x: 1060, y: 185, w: 220, h: 535}, 13, 10);

const observedGoalBodySources = new Set();
for (let seed = 0; seed < 256; seed++) {
  drawCalls.length = 0;
  visualApi.drawPlatformBase(
    fakeCanvasContext,
    {x: 1060, y: 185, w: 220, h: 535},
    1060,
    seed
  );
  for (const call of drawCalls.slice(0, -1)) {
    observedGoalBodySources.add(call.slice(1, 4).join(","));
  }
}
assert.equal(observedGoalBodySources.size, 6, "all six goal body variants must be reachable");

assert.equal(visualApi.resolvePlatformRole(startPlatform), "START_PLATFORM");
assert.equal(
  visualApi.resolvePlatformRole({x: 1060, y: 185, w: 220, h: 535}),
  "GOAL_TOWER"
);
for (const specialPlatform of [
  {x: 300, y: 300, w: 120, h: 26, moving: true, movingData: {x: 300, y: 300, w: 120, h: 26}},
  {x: 320, y: 300, w: 121, h: 26, fragile: true, fallingPlatform: {x: 320, y: 300, w: 121, h: 26}},
  {x: 340, y: 300, w: 122, h: 26, conveyor: true, conveyorData: {x: 340, y: 300, w: 122, h: 26}},
  {x: 360, y: 300, w: 123, h: 26, fade: true, fadeData: {x: 360, y: 300, w: 123, h: 26}},
  {x: 380, y: 300, w: 124, h: 26, ice: true, iceData: {x: 380, y: 300, w: 124, h: 26}},
  {x: 400, y: 300, w: 125, h: 26, spikePlatform: true, spikeData: {x: 400, y: 300, w: 125, h: 26}}
]) {
  assert.equal(visualApi.resolvePlatformRole(specialPlatform), "FLOATING");
  drawCalls.length = 0;
  assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, specialPlatform, specialPlatform.x, 41), true);
  assert.equal(drawCalls.length, 3, "each special must reuse the full floating composition");
  assert.ok(drawCalls.every(call => call.length === 5));
  assert.deepEqual(drawCalls.map(call => call[0].src), floatingAssetPaths);
  assert.deepEqual(drawCalls.map(call => call[4]), [26, 26, 26]);
  assert.equal(drawCalls[0][3], specialPlatform.w - 43);
  assert.equal(drawCalls[1][3], 23);
  assert.equal(drawCalls[2][3], 22);
  assert.equal(drawCalls[1][1] + drawCalls[1][3] - drawCalls[0][1], 1);
  assert.equal(drawCalls[0][1] + drawCalls[0][3] - drawCalls[2][1], 1);
}

drawCalls.length = 0;
assert.equal(
  visualApi.drawPlatformBase(
    fakeCanvasContext,
    {x: 240, y: 695, w: 815, h: 52, lastBubbleSupport: true},
    240,
    1
  ),
  false
);
assert.equal(drawCalls.length, 0, "Last Bubble support keeps its existing fallback");

const visualSource = read("js/visual-meadow-assets.js");
assert.doesNotMatch(
  visualSource,
  /drawMassivePlatform|BLOCK_BODY_TILES|BLOCK_TOP_STRIP|NineSlice|CoverageProbe/
);
assert.match(visualSource, /const PLATFORM_VISUAL_CONTRACT = Object\.freeze/);
assert.match(visualSource, /const PLATFORM_SLOTS = Object\.freeze/);
assert.match(visualSource, /function drawFloatingPlatform/);
assert.match(visualSource, /function drawGoalPlatform/);
assert.match(visualSource, /const FLOATING_SEAM_OVERLAP = 1;/);
assert.doesNotMatch(visualSource, /FLOAT_LEFT|FLOAT_MIDDLE|FLOAT_RIGHT/);
assert.doesNotMatch(visualSource, /START_PLATFORM: Object\.freeze\(\{x:/);
const standardPlatformSource = visualSource.slice(
  visualSource.indexOf("    function drawFloatingPlatform"),
  visualSource.indexOf("    function drawPortal")
);
assert.doesNotMatch(standardPlatformSource, /fillRect|#65432d/);
assert.doesNotMatch(standardPlatformSource, /\.rotate\(|\.scale\(/);
assert.doesNotMatch(visualSource, /FLOATING_[123]/);

const rendererSource = read("js/renderer.js");
const rendererPlatformStart = rendererSource.indexOf("  function drawPlatforms(");
const rendererPlatformEnd = rendererSource.indexOf("  function drawGoal(", rendererPlatformStart);
assert.ok(rendererPlatformStart >= 0 && rendererPlatformEnd > rendererPlatformStart);
const rendererPlatformFixture = [
  {x: 420, y: 300, w: 130, h: 26},
  {x: 0, y: 640, w: 235, h: 80},
  {x: 1060, y: 370, w: 220, h: 350},
  {x: 300, y: 260, w: 120, h: 26, moving: true},
  {x: 320, y: 280, w: 121, h: 26, fragile: true,
    fallingPlatform: {triggered: false, falling: false, timer: 1, currentY: 280}},
  {x: 340, y: 300, w: 122, h: 26, conveyor: true, conveyorSpeed: 42,
    conveyorData: {phase: 0}},
  {x: 360, y: 320, w: 123, h: 26, fade: true, fadeData: {opacity: 0.72}},
  {x: 380, y: 340, w: 124, h: 26, ice: true, iceData: {}},
  {x: 400, y: 360, w: 125, h: 26, spikePlatform: true,
    spikeData: {dangerous: false, warning: true, extension: 0}},
  {x: 240, y: 695, w: 815, h: 52, lastBubbleSupport: true}
];
const rendererPlatformSnapshot = JSON.stringify(rendererPlatformFixture);
const rendererBaseCalls = [];
const rendererCanvasContext = new Proxy({}, {
  get(target, property) {
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});
const rendererPlatformContext = vm.createContext({
  MEADOW_ASSET_VISUALS: {
    drawPlatformBase: (context, platform, drawX, levelSeed) => {
      rendererBaseCalls.push({platform, drawX, levelSeed});
      return true;
    }
  },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx: rendererCanvasContext,
  currentLevel: () => ({seed: 73, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawDeathZone: () => {},
  drawGhostStepFadeOutline: () => {},
  drawStandardPlatformDetails: () => {},
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => rendererPlatformFixture,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  roundedRect: () => {},
  worldTime: 1.25
});
vm.runInContext(`${rendererSource.slice(rendererPlatformStart, rendererPlatformEnd)}
  globalThis.drawPlatformsForTest = drawPlatforms;
`, rendererPlatformContext);
rendererPlatformContext.drawPlatformsForTest(
  {platform: {body: "#000", top: "#fff"}},
  true
);
assert.equal(rendererBaseCalls.length, 9);
assert.deepEqual(
  rendererBaseCalls.map(call => Boolean(
    call.platform.moving || call.platform.fragile || call.platform.conveyor ||
    call.platform.fade || call.platform.ice || call.platform.spikePlatform
  )),
  [false, false, false, true, true, true, true, true, true]
);
assert.equal(
  rendererBaseCalls.some(call => call.platform.lastBubbleSupport),
  false,
  "Last Bubble support must not enter the Meadow terrain contract"
);
assert.equal(JSON.stringify(rendererPlatformFixture), rendererPlatformSnapshot);

const guardStart = rendererSource.indexOf("  function isMeadowAssetVisualsActive");
const guardEnd = rendererSource.indexOf("  function drawEarthPlatformDetail", guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart);
const guardContext = vm.createContext({
  MEADOW_ASSET_VISUALS: {},
  isTutorialStage: () => guardContext.tutorial,
  state: "playing",
  tutorial: false
});
vm.runInContext(`${rendererSource.slice(guardStart, guardEnd)}
  globalThis.guardForTest = isMeadowAssetVisualsActive;
`, guardContext);
assert.equal(guardContext.guardForTest({id: "meadow"}), true);
guardContext.state = "menu";
assert.equal(guardContext.guardForTest({id: "meadow"}), false);
guardContext.state = "playing";
guardContext.tutorial = true;
assert.equal(guardContext.guardForTest({id: "meadow"}), false);
guardContext.tutorial = false;
assert.equal(guardContext.guardForTest({id: "coast"}), false);

assert.match(rendererSource, /function drawPlatforms\(biome, useMeadowAssets = false\)/);
assert.match(
  rendererSource,
  /!p\.lastBubbleSupport &&\s*MEADOW_ASSET_VISUALS\.drawPlatformBase/
);
assert.doesNotMatch(
  rendererSource,
  /standardPlatform &&\s*!p\.lastBubbleSupport/
);
for (const mechanicFlag of [
  "p.moving",
  "p.fragile",
  "p.conveyor",
  "p.fade",
  "p.ice",
  "p.spikePlatform"
]) {
  assert.ok(rendererSource.includes(mechanicFlag), `${mechanicFlag} overlay must remain`);
}
assert.match(rendererSource, /for \(const s of level\.spikes\) drawDeathZone\(s, biome\);/);
assert.match(rendererSource, /drawTrajectory\(\);\s*drawPlayer\(\);/);
const html = read("index.html");
assert.match(
  html,
  /js\/tutorials\.js[\s\S]*?js\/visual-meadow-assets\.js[\s\S]*?js\/renderer\.js/
);

for (const [relativePath, expectedHash] of assetHashesBefore) {
  const actualHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
  assert.equal(actualHash, expectedHash, `${relativePath} was modified during the test`);
}

console.log("Meadow asset visual mutation, scope and level 1-10 geometry tests passed.");
