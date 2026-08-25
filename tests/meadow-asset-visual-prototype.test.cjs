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
  "assets/environments/meadow/background/meadow_background_sky_base.png": [1280, 720],
  "assets/environments/meadow/background/meadow_background_clouds_back.png": [1280, 720],
  "assets/environments/meadow/background/meadow_background_landscape.png": [1280, 720],
  "assets/environments/meadow/background/meadow_background_clouds_front.png": [1280, 720],
  "assets/environments/meadow/platforms/floating_left.png": [128, 128],
  "assets/environments/meadow/platforms/floating_middle.png": [256, 128],
  "assets/environments/meadow/platforms/floating_right.png": [128, 128],
  "assets/environments/meadow/platforms/meadow_top_base.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_body_base.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_top_01.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_top_02.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_top_03.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_top_04.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_top_05.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_top_06.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_body_01.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_body_02.png": [352, 128],
  "assets/environments/meadow/platforms/meadow_overlay_body_03.png": [352, 128],
  "assets/environments/meadow/decor/top/meadow_decor_top_grass_set_01.png": [1448, 1086],
  "assets/environments/meadow/decor/top/meadow_decor_top_flowers_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_mushrooms_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_bushes_set_01.png": [1448, 1086],
  "assets/environments/meadow/decor/top/meadow_decor_top_stones_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_tufts_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_trees_set_01.png": [1448, 1086],
  "assets/environments/meadow/portal/meadow_portal_props.png": [1448, 1086],
  "assets/environments/meadow/hazards/meadow_bottom_spike_tile.png": [256, 320]
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
function createFamilyBAlphaFixture(width) {
  const height = 128;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 24; y <= 102; y++) pixels[(y * width) * 4 + 3] = 255;
  for (let y = 34; y <= 84; y++) {
    for (let x = 0; x < width; x++) pixels[(y * width + x) * 4 + 3] = 255;
  }
  return pixels;
}
const familyBAlphaFixtures = Object.freeze({
  "assets/environments/meadow/platforms/floating_left.png": createFamilyBAlphaFixture(128),
  "assets/environments/meadow/platforms/floating_middle.png": createFamilyBAlphaFixture(256),
  "assets/environments/meadow/platforms/floating_right.png": createFamilyBAlphaFixture(128)
});

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
    const dimensions = assetExpectations[value] || [1, 1];
    this.complete = true;
    this.naturalWidth = dimensions[0];
    this.naturalHeight = dimensions[1];
    this.pixelData = familyBAlphaFixtures[value];
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

const fakeDocument = {
  createElement(type) {
    assert.equal(type, "canvas");
    let drawnImage = null;
    return {
      getContext() {
        return {
          clearRect() {},
          drawImage(image) {
            drawnImage = image;
          },
          getImageData() {
            return {data: drawnImage.pixelData};
          }
        };
      }
    };
  }
};

let visualMathRandomCalls = 0;
const visualMath = Object.create(Math);
visualMath.random = () => {
  visualMathRandomCalls += 1;
  return 0.5;
};
const visualContext = vm.createContext({
  Image: FakeImage,
  Math: visualMath,
  Promise,
  document: fakeDocument
});
vm.runInContext(`${read("js/visual-meadow-assets.js")}
  globalThis.meadowAssetVisualsForTest = MEADOW_ASSET_VISUALS;
`, visualContext, {filename: "js/visual-meadow-assets.js"});
const visualApi = visualContext.meadowAssetVisualsForTest;
assert.equal(
  imageConstructionCount,
  28,
  "the loader must construct all base assets, platform variants and top-decor sheets once"
);
assert.equal(visualApi.areAllReady(), true);
assert.deepEqual(
  JSON.parse(JSON.stringify(visualApi.getStatus().paths)),
  {
    background: "assets/environments/meadow/background/meadow_background.png",
    background_sky_base: "assets/environments/meadow/background/meadow_background_sky_base.png",
    background_clouds_back: "assets/environments/meadow/background/meadow_background_clouds_back.png",
    background_landscape: "assets/environments/meadow/background/meadow_background_landscape.png",
    background_clouds_front: "assets/environments/meadow/background/meadow_background_clouds_front.png",
    floating_left: "assets/environments/meadow/platforms/floating_left.png",
    floating_middle: "assets/environments/meadow/platforms/floating_middle.png",
    floating_right: "assets/environments/meadow/platforms/floating_right.png",
    meadow_top_base: "assets/environments/meadow/platforms/meadow_top_base.png",
    meadow_body_base: "assets/environments/meadow/platforms/meadow_body_base.png",
    meadow_overlay_top_01: "assets/environments/meadow/platforms/meadow_overlay_top_01.png",
    meadow_overlay_top_02: "assets/environments/meadow/platforms/meadow_overlay_top_02.png",
    meadow_overlay_top_03: "assets/environments/meadow/platforms/meadow_overlay_top_03.png",
    meadow_overlay_top_04: "assets/environments/meadow/platforms/meadow_overlay_top_04.png",
    meadow_overlay_top_05: "assets/environments/meadow/platforms/meadow_overlay_top_05.png",
    meadow_overlay_top_06: "assets/environments/meadow/platforms/meadow_overlay_top_06.png",
    meadow_overlay_body_01: "assets/environments/meadow/platforms/meadow_overlay_body_01.png",
    meadow_overlay_body_02: "assets/environments/meadow/platforms/meadow_overlay_body_02.png",
    meadow_overlay_body_03: "assets/environments/meadow/platforms/meadow_overlay_body_03.png",
    decor_top_grass: "assets/environments/meadow/decor/top/meadow_decor_top_grass_set_01.png",
    decor_top_flowers: "assets/environments/meadow/decor/top/meadow_decor_top_flowers_set_01.png",
    decor_top_mushrooms: "assets/environments/meadow/decor/top/meadow_decor_top_mushrooms_set_01.png",
    decor_top_bushes: "assets/environments/meadow/decor/top/meadow_decor_top_bushes_set_01.png",
    decor_top_stones: "assets/environments/meadow/decor/top/meadow_decor_top_stones_set_01.png",
    decor_top_tufts: "assets/environments/meadow/decor/top/meadow_decor_top_tufts_set_01.png",
    decor_top_trees: "assets/environments/meadow/decor/top/meadow_decor_top_trees_set_01.png",
    portal: "assets/environments/meadow/portal/meadow_portal_props.png",
    bottom_spike_tile: "assets/environments/meadow/hazards/meadow_bottom_spike_tile.png"
  }
);
const meadowManifest = JSON.parse(JSON.stringify(visualApi.getManifest()));
assert.equal(meadowManifest.biome, "meadow");
assert.deepEqual(meadowManifest.platforms.contract, {
  floating: {
    height: 26,
    leftWidth: 26,
    middleTileWidth: 52,
    middleTileAdvance: 51,
    rightWidth: 26,
    middleMode: "repeat-source-crop",
    contentFit: {
      alphaThreshold: 8,
      bodyRowMinimumCoverage: 0.5,
      topOverhang: 2,
      bottomOverhang: 3,
      mode: "shared-robust-alpha-body-band"
    }
  },
  start: {
    width: 235,
    height: 80,
    topMode: "proportional-width-clip",
    overflow: "clip"
  },
  goal: {
    width: 220,
    topHeight: 80,
    bodyRowHeight: 80,
    bodyOverlap: 1,
    bodyRowStep: 79,
    lastBodyMode: "proportional-source-crop",
    bodyOverlayMode: "single-bottom-aligned-body-clip"
  }
});
assert.deepEqual(Object.keys(meadowManifest.platforms.slots), [
  "floating_left",
  "floating_middle",
  "floating_right",
  "meadow_top_base",
  "meadow_body_base",
  "meadow_top_overlays",
  "meadow_body_overlays"
]);
assert.deepEqual(meadowManifest.platforms.slots.floating_left, {
  asset: "floating_left",
  w: 128,
  h: 128,
  source: {x: 0, y: 0, w: 128, h: 128}
});
assert.deepEqual(meadowManifest.platforms.slots.floating_middle, {
  asset: "floating_middle",
  w: 256,
  h: 128,
  source: {x: 0, y: 0, w: 256, h: 128}
});
assert.deepEqual(meadowManifest.platforms.slots.floating_right, {
  asset: "floating_right",
  w: 128,
  h: 128,
  source: {x: 0, y: 0, w: 128, h: 128}
});
assert.deepEqual(
  meadowManifest.platforms.slots.meadow_top_overlays,
  Array.from({length: 6}, (_, index) => ({
    asset: `meadow_overlay_top_0${index + 1}`,
    w: 352,
    h: 128
  }))
);
assert.deepEqual(meadowManifest.platforms.slots.meadow_top_base, {
  asset: "meadow_top_base",
  w: 352,
  h: 128
});
assert.deepEqual(meadowManifest.platforms.slots.meadow_body_base, {
  asset: "meadow_body_base",
  w: 352,
  h: 128
});
assert.deepEqual(meadowManifest.platforms.topOverlaySelection, {
  startSalt: 0x53544152,
  goalSalt: 0x474f414c,
  mode: "independent-salts-shift-goal-on-collision"
});
assert.deepEqual(
  meadowManifest.platforms.slots.meadow_body_overlays,
  Array.from({length: 3}, (_, index) => ({
    asset: `meadow_overlay_body_0${index + 1}`,
    w: 352,
    h: 128
  }))
);
assert.deepEqual(meadowManifest.platforms.bodyOverlaySelection, {
  goalSalt: 0x424f474c,
  mode: "single-goal-overlay"
});
assert.deepEqual(meadowManifest.platforms.kit.familyA.source, {x: 0, y: 0, w: 352, h: 128});

const drawCalls = [];
const radialGradientCalls = [];
const radialGradientStops = [];
const canvasOperationCalls = [];
const canvasPropertyWrites = [];
const fakeCanvasContext = new Proxy({}, {
  get(target, property) {
    if (property === "drawImage") {
      return (...args) => drawCalls.push(args);
    }
    if (property === "createRadialGradient") {
      return (...args) => {
        radialGradientCalls.push(args);
        const stops = [];
        radialGradientStops.push(stops);
        return {addColorStop: (...stop) => stops.push(stop)};
      };
    }
    if ([
      "save", "restore", "translate", "scale", "arc", "rect", "beginPath",
      "moveTo", "arcTo", "closePath", "clip"
    ].includes(property)) {
      return (...args) => canvasOperationCalls.push([property, ...args]);
    }
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    canvasPropertyWrites.push([property, value]);
    target[property] = value;
    return true;
  }
});

const startGoalCategoryCoverage = new Set();
const startDecorCounts = new Set();
const goalDecorCounts = new Set();
const renderedTreeVariants = new Set();
const goalSeamCoverCoverage = new Set();
const goalSeamCoverCounts = new Set();
const allowedGoalSeamCoverProps = Object.freeze([
  "portalLantern",
  "portalFlowerClump",
  "portalShortWoodPost",
  "portalMossStoneMushrooms",
  "portalStoneGrassClump",
  "portalFallenLog",
  "portalTreeStump"
]);
const goalSeamCoverMappings = Object.freeze({
  portalLantern: {source: [752, 512, 232, 312], anchor: [119, 289], base: [28, 210], motifWidth: 195, motifHeight: 269, nominalWidth: 32},
  portalFlowerClump: {source: [992, 624, 256, 200], anchor: [115.5, 173], base: [15, 216], motifWidth: 219, motifHeight: 146, nominalWidth: 26},
  portalShortWoodPost: {source: [1248, 552, 200, 272], anchor: [97, 248], base: [16, 178], motifWidth: 168, motifHeight: 224, nominalWidth: 23},
  portalMossStoneMushrooms: {source: [16, 832, 336, 224], anchor: [172, 196], base: [44, 300], motifWidth: 289, motifHeight: 171, nominalWidth: 30},
  portalStoneGrassClump: {source: [352, 848, 320, 208], anchor: [176.5, 176], base: [89, 264], motifWidth: 267, motifHeight: 153, nominalWidth: 30},
  portalFallenLog: {source: [672, 832, 400, 224], anchor: [197.5, 199], base: [35, 360], motifWidth: 357, motifHeight: 176, nominalWidth: 38},
  portalTreeStump: {source: [1072, 832, 376, 224], anchor: [173.5, 196], base: [26, 321], motifWidth: 314, motifHeight: 171, nominalWidth: 32}
});
const startGoalBackPlacement = Object.freeze({
  treeRoundFlowering: {anchor: [204.5, 419], base: [132, 279], motifWidth: 329},
  treeSaplingLeafy: {anchor: [157, 285], base: [109, 201], motifWidth: 207},
  bushLayeredCluster: {anchor: [250.5, 356], base: [64, 437], motifWidth: 447},
  bushTallLeafy: {anchor: [259.5, 430], base: [63, 452], motifWidth: 502},
  grassTallFan: {anchor: [244, 279], base: [69, 413], motifWidth: 447},
  grassWildArching: {anchor: [331.5, 341], base: [95, 568], motifWidth: 588},
  mushroomsRedPair: {anchor: [188.5, 317], base: [48, 329], motifWidth: 349}
});
const startGoalLayoutSignature = (scene, role) => JSON.stringify(
  [...scene.topBackDecor, ...scene.topFrontDecor]
    .filter(item => item.role === role)
    .map(item => ({
      sprite: item.sprite,
      layer: item.layer,
      x: Number(((item.baselineX - item.platformX) / item.platformW).toFixed(5)),
      y: item.baselineOffset,
      width: item.nominalWidth
    }))
);
const floatingLayoutSnapshot = scene => JSON.parse(JSON.stringify(
  scene.topBackDecor.filter(item => item.role === "FLOATING")
));
const goalSeamCoverSignature = scene => JSON.stringify(
  scene.goalSeamCoverProps.map(item => ({
    sprite: item.sprite,
    x: Number(((item.baselineX - item.platformX) / item.platformW).toFixed(5))
  }))
);

for (const level of generatedLevels) {
  const before = JSON.stringify(geometrySnapshot(level));
  const scene = visualApi.getScene(level);
  assert.equal(scene, visualApi.getScene(level), "visual scene should be cached by level");
  assert.notEqual(scene, visualApi.getScene(level, 1));
  assert.equal(
    visualApi.getScene(level, 1),
    visualApi.getScene(level, 1),
    "visual scenes should be cached by level and retry nonce"
  );
  const floatingPlatforms = level.platforms.filter(platform => (
    visualApi.resolvePlatformRole(platform) === "FLOATING"
  ));
  const expectedFloatingDecorCount = floatingPlatforms.reduce((count, platform, index) => {
    const platformCount = platform.w < 108
      ? index % 2 === 0 ? 1 : 2
      : platform.w < 132
        ? 2
        : platform.w < 165
          ? 3
          : 4;
    return count + platformCount;
  }, 0);
  const retryScenes = [0, 1, 2].map(nonce => visualApi.getScene(level, nonce));
  assert.equal(new Set(retryScenes.map(retryScene => (
    startGoalLayoutSignature(retryScene, "START_PLATFORM")
  ))).size, 3, "each retry must vary the start decoration");
  assert.equal(new Set(retryScenes.map(retryScene => (
    startGoalLayoutSignature(retryScene, "GOAL_TOWER")
  ))).size, 3, "each retry must vary the goal decoration");
  assert.ok(
    new Set(retryScenes.map(goalSeamCoverSignature)).size >= 2,
    "retry nonces must vary the goal seam-cover props"
  );
  assert.deepEqual(
    retryScenes.map(floatingLayoutSnapshot),
    retryScenes.map(() => floatingLayoutSnapshot(scene)),
    "retry variation must leave floating decoration byte-equivalent"
  );
  assert.ok(scene.topBackDecor.every(item => item.layer === "back"));
  assert.ok(scene.topFrontDecor.every(item => item.layer === "front"));
  assert.ok(
    scene.topBackDecor
      .filter(item => item.role === "FLOATING")
      .every(item => item.baselineOffset === 2)
  );
  assert.equal(
    scene.topFrontDecor.some(item => item.role === "FLOATING"),
    false,
    "floating platforms must remain back-decor only in the preview"
  );
  for (const [index, platform] of floatingPlatforms.entries()) {
    const platformDecor = scene.topBackDecor.filter(item => (
      item.role === "FLOATING" &&
      item.platformX === platform.x &&
      item.platformY === platform.y &&
      item.platformW === platform.w
    ));
    const expectedCount = platform.w < 108
      ? index % 2 === 0 ? 1 : 2
      : platform.w < 132
        ? 2
        : platform.w < 165
          ? 3
          : 4;
    assert.equal(platformDecor.length, expectedCount);
    assert.ok(platformDecor.length >= 1 && platformDecor.length <= 4);
    if (platform.w >= 108) assert.ok(platformDecor.length >= 2);
    assert.ok(platformDecor.every(item => item.category !== "TREES"));
    const ordered = [...platformDecor].sort((left, right) => left.baselineX - right.baselineX);
    if (ordered.length > 1) {
      const firstRatio = (ordered[0].baselineX - platform.x) / platform.w;
      const lastRatio = (ordered.at(-1).baselineX - platform.x) / platform.w;
      assert.ok(firstRatio <= 0.280000001);
      assert.ok(lastRatio >= 0.719999999);
      for (let itemIndex = 1; itemIndex < ordered.length; itemIndex++) {
        const previous = ordered[itemIndex - 1];
        const current = ordered[itemIndex];
        const visibleGap = current.baselineX - previous.baselineX -
          (previous.nominalWidth + current.nominalWidth) / 2;
        assert.ok(visibleGap >= 4, `floating decor overlap: ${visibleGap}`);
      }
    }
  }
  for (const [nonce, retryScene] of retryScenes.entries()) {
    assert.equal(retryScene.decorNonce, nonce);
    assert.ok(retryScene.topBackDecor.every(item => item.layer === "back"));
    assert.ok(retryScene.topFrontDecor.every(item => item.layer === "front"));
    assert.equal(
      retryScene.topBackDecor.filter(item => item.role === "FLOATING").length,
      expectedFloatingDecorCount
    );
    assert.equal(retryScene.topFrontDecor.some(item => item.role === "FLOATING"), false);
    const goalSeamCoverProps = retryScene.goalSeamCoverProps;
    assert.ok(goalSeamCoverProps.length >= 2 && goalSeamCoverProps.length <= 5);
    goalSeamCoverCounts.add(goalSeamCoverProps.length);
    const goalPlatform = level.platforms.find(platform => (
      visualApi.resolvePlatformRole(platform) === "GOAL_TOWER"
    ));
    assert.ok(goalPlatform);
    const propBaseIntervals = [];
    for (const item of goalSeamCoverProps) {
      const mapping = goalSeamCoverMappings[item.sprite];
      assert.ok(mapping, `forbidden goal portal prop: ${item.sprite}`);
      goalSeamCoverCoverage.add(item.sprite);
      assert.equal(item.role, "GOAL_TOWER");
      assert.equal(item.layer, "goal-seam-cover");
      assert.equal(item.platformX, goalPlatform.x);
      assert.equal(item.platformY, goalPlatform.y);
      assert.equal(item.platformW, goalPlatform.w);
      assert.equal(item.baselineOffset, 11);
      assert.equal(item.baselineY, goalPlatform.y + 11);
      assert.equal(item.nominalWidth, mapping.nominalWidth);
      assert.deepEqual([item.anchor.x, item.anchor.y], mapping.anchor);
      assert.deepEqual(
        [item.visibleBase.left, item.visibleBase.right],
        mapping.base
      );
      const scale = item.nominalWidth / mapping.motifWidth;
      const visibleBaseLeft = item.baselineX +
        (item.visibleBase.left - item.anchor.x) * scale;
      const visibleBaseRight = item.baselineX +
        (item.visibleBase.right - item.anchor.x) * scale;
      assert.ok(visibleBaseLeft >= goalPlatform.x + 3 - 1e-9);
      assert.ok(visibleBaseRight <= goalPlatform.x + goalPlatform.w - 3 + 1e-9);
      propBaseIntervals.push([visibleBaseLeft, visibleBaseRight]);
      const baselineRatio = (item.baselineX - goalPlatform.x) / goalPlatform.w;
      assert.ok(baselineRatio >= 0.18 && baselineRatio <= 0.82);
      const renderedVisibleHeight = mapping.motifHeight * scale;
      assert.ok(
        baselineRatio < 0.43 || baselineRatio > 0.57 || renderedVisibleHeight <= 22,
        "only low seam-cover props may occupy the portal-base center"
      );
    }
    propBaseIntervals.sort((left, right) => left[0] - right[0]);
    for (let index = 1; index < propBaseIntervals.length; index++) {
      assert.ok(
        propBaseIntervals[index][0] - propBaseIntervals[index - 1][1] >= 0,
        "goal portal prop stand areas must not overlap"
      );
    }
    const startGoalItems = [...retryScene.topBackDecor, ...retryScene.topFrontDecor]
      .filter(item => item.role !== "FLOATING");
    startGoalItems.forEach(item => startGoalCategoryCoverage.add(item.category));
    assert.ok(
      retryScene.topBackDecor
        .filter(item => item.role !== "FLOATING")
        .every(item => (
          item.baselineOffset >= 1 && item.baselineOffset <= 2 &&
          ["BUSHES", "GRASS", "MUSHROOMS", "TREES"].includes(item.category)
        ))
    );
    assert.ok(retryScene.topFrontDecor.every(item => (
      item.baselineOffset >= 9 &&
      item.baselineOffset <= 11 &&
      item.category !== "TREES" &&
      !("anchor" in item) &&
      !("visibleBase" in item)
    )));
    assert.ok(
      retryScene.topBackDecor
        .filter(item => item.role === "FLOATING")
        .every(item => !("anchor" in item) && !("visibleBase" in item))
    );
    for (const item of retryScene.topBackDecor.filter(item => item.role !== "FLOATING")) {
      const placement = startGoalBackPlacement[item.sprite];
      assert.ok(placement, `missing visible-base contract for ${item.sprite}`);
      assert.deepEqual([item.anchor.x, item.anchor.y], placement.anchor);
      assert.deepEqual(
        [item.visibleBase.left, item.visibleBase.right],
        placement.base
      );
      const scale = item.nominalWidth / placement.motifWidth;
      const visibleBaseLeft = item.baselineX +
        (item.visibleBase.left - item.anchor.x) * scale;
      const visibleBaseRight = item.baselineX +
        (item.visibleBase.right - item.anchor.x) * scale;
      assert.ok(visibleBaseLeft >= item.platformX + 3 - 1e-9);
      assert.ok(visibleBaseRight <= item.platformX + item.platformW - 3 + 1e-9);
      assert.equal(item.baselineY, item.platformY + item.baselineOffset);
    }
    const startGoalTrees = startGoalItems.filter(item => item.category === "TREES");
    startGoalTrees.forEach(item => renderedTreeVariants.add(item.sprite));
    assert.ok(startGoalTrees.every(item => (
      item.layer === "back" &&
      item.baselineOffset >= 1 &&
      item.baselineOffset <= 2 &&
      (
        (item.sprite === "treeRoundFlowering" && item.nominalWidth === 132) ||
        (item.sprite === "treeSaplingLeafy" && item.nominalWidth === 60)
      )
    )));
    for (const tree of startGoalTrees.filter(item => item.sprite === "treeRoundFlowering")) {
      const visibleHeight = 392 * (tree.nominalWidth / 329);
      const previousVisibleHeight = 392 * (88 / 329);
      assert.ok(Math.abs(visibleHeight - previousVisibleHeight * 1.5) < 1e-12);
    }
    for (const role of ["START_PLATFORM", "GOAL_TOWER"]) {
      const roleItems = startGoalItems.filter(item => item.role === role);
      const backCount = roleItems.filter(item => item.layer === "back").length;
      const frontCount = roleItems.filter(item => item.layer === "front").length;
      assert.ok(backCount >= 2 && backCount <= 3);
      assert.ok(frontCount >= 4 && frontCount <= 5);
      assert.ok(roleItems.length >= 6 && roleItems.length <= 8);
    }
    const startCount = startGoalItems.filter(item => item.role === "START_PLATFORM").length;
    const goalCount = startGoalItems.filter(item => item.role === "GOAL_TOWER").length;
    startDecorCounts.add(startCount);
    goalDecorCounts.add(goalCount);
    assert.ok(goalCount >= startCount, "goal decor should be at least as lush as start decor");
    assert.notEqual(
      startGoalLayoutSignature(retryScene, "START_PLATFORM"),
      startGoalLayoutSignature(retryScene, "GOAL_TOWER"),
      "separate visual namespaces must keep start and goal distinct"
    );
    for (const item of [...retryScene.topBackDecor, ...retryScene.topFrontDecor]) {
      assert.ok(item.baselineX >= item.platformX);
      assert.ok(item.baselineX <= item.platformX + item.platformW);
      assert.equal(item.baselineY, item.platformY + item.baselineOffset);
    }
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(scene)),
    JSON.parse(JSON.stringify(visualApi.getScene(JSON.parse(JSON.stringify(level))))),
    "equal seeds and geometry should produce equal visual decoration"
  );
  for (let frame = 0; frame < 12; frame++) {
    assert.equal(visualApi.drawBackground(fakeCanvasContext, 1280, 720), true);
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
    assert.equal(visualApi.drawTopBackDecor(fakeCanvasContext, scene), true);
    assert.equal(visualApi.drawPortal(fakeCanvasContext, level.goal), true);
    const goalPlatform = level.platforms.find(platform => (
      visualApi.resolvePlatformRole(platform) === "GOAL_TOWER"
    ));
    assert.equal(
      visualApi.drawGoalTopForeground(fakeCanvasContext, goalPlatform, level.seed),
      true
    );
    assert.equal(visualApi.drawGoalSeamCoverProps(fakeCanvasContext, scene), true);
    assert.equal(visualApi.drawTopFrontDecor(fakeCanvasContext, scene), true);
  }
  assert.equal(
    JSON.stringify(geometrySnapshot(level)),
    before,
    "asset rendering must not mutate level geometry or gameplay data"
  );
}
assert.deepEqual(
  [...startGoalCategoryCoverage].sort(),
  ["BUSHES", "FLOWERS", "GRASS", "MUSHROOMS", "STONES", "TREES", "TUFTS"],
  "the retry layouts should exercise every available start/goal category"
);
assert.ok(startDecorCounts.size > 1, "start density should vary across levels and retries");
assert.ok(goalDecorCounts.size > 1, "goal density should vary across levels and retries");
assert.deepEqual(
  [...renderedTreeVariants].sort(),
  ["treeRoundFlowering", "treeSaplingLeafy"],
  "both mapped tree variants should participate in retry layouts"
);
assert.deepEqual(
  [...goalSeamCoverCoverage].sort(),
  [...allowedGoalSeamCoverProps].sort(),
  "all and only the seven approved goal seam-cover props must participate"
);
assert.deepEqual(
  [...goalSeamCoverCounts].sort(),
  [2, 3, 4, 5],
  "goal seam-cover density must exercise the full 2-5 range"
);
assert.equal(imageConstructionCount, 28, "draw calls must not construct additional images");
assert.ok(drawCalls.length > 0);
assert.ok(
  drawCalls.every(call => call.length === 5 || call.length === 9),
  "asset draws must use standalone-image or source-slice overloads"
);

const topDecorMappings = {
  grassCompactFan: ["grass", [208, 104, 320, 224], [162, 202], 256],
  grassTallFan: ["grass", [816, 16, 496, 320], [247.5, 291], 447],
  grassWildArching: ["grass", [736, 320, 656, 384], [327, 354], 588],
  flowersWhiteDaisy: ["flowers", [48, 64, 416, 384], [204, 343], 342],
  flowersLowMeadowMix: ["flowers", [448, 528, 608, 432], [301, 379], 532],
  mushroomRedSingle: ["mushrooms", [112, 176, 336, 288], [164.5, 251], 261],
  mushroomsRedPair: ["mushrooms", [544, 112, 416, 352], [207.5, 317], 349],
  bushLayeredCluster: ["bushes", [544, 320, 496, 400], [248.5, 364], 447],
  bushTallLeafy: ["bushes", [0, 336, 560, 464], [280, 440], 502],
  stoneMossySingle: ["stones", [176, 64, 368, 288], [182, 235], 286],
  stoneMossyFlat: ["stones", [80, 368, 672, 288], [335.5, 246], 591],
  tuftSimpleFan: ["tufts", [32, 208, 416, 288], [205.5, 250], 357],
  tuftBroadLeafFan: ["tufts", [480, 176, 576, 336], [287.5, 287], 511],
  treeSaplingLeafy: ["trees", [64, 144, 288, 320], [146.5, 298], 207],
  treeRoundFlowering: ["trees", [960, 16, 416, 464], [204.5, 428], 329]
};
const previewFixture = {
  seed: 91,
  platforms: [
    {x: 0, y: 640, w: 235, h: 80},
    {x: 420, y: 360, w: 170, h: 26},
    {x: 1060, y: 370, w: 220, h: 350}
  ]
};
const previewScene = visualApi.getScene(previewFixture);
const noGoalPreviewScene = visualApi.getScene({
  seed: 91,
  platforms: [
    {x: 0, y: 640, w: 235, h: 80},
    {x: 420, y: 360, w: 170, h: 26}
  ]
}, 4);
assert.equal(
  noGoalPreviewScene.goalSeamCoverProps.length,
  0,
  "start and floating platforms must never receive goal seam-cover props"
);
function assertTopDecorLayer(items, drawLayer) {
  drawCalls.length = 0;
  assert.equal(drawLayer(fakeCanvasContext, previewScene), true);
  assert.equal(drawCalls.length, items.length);
  for (const [index, item] of items.entries()) {
    const call = drawCalls[index];
    const [assetSuffix, source, catalogAnchor, motifWidth] = topDecorMappings[item.sprite];
    const anchor = item.anchor
      ? [item.anchor.x, item.anchor.y]
      : catalogAnchor;
    const scale = item.nominalWidth / motifWidth;
    assert.equal(call.length, 9);
    assert.equal(
      call[0].src,
      `assets/environments/meadow/decor/top/meadow_decor_top_${assetSuffix}_set_01.png`
    );
    assert.deepEqual(call.slice(1, 5), source);
    assert.ok(
      Math.abs(call[7] / source[2] - call[8] / source[3]) < 1e-12,
      "top decor must scale uniformly"
    );
    assert.equal(call[7], source[2] * scale);
    assert.equal(call[8], source[3] * scale);
    assert.ok(Math.abs(call[5] + anchor[0] * scale - item.baselineX) < 1e-9);
    assert.ok(Math.abs(call[6] + anchor[1] * scale - item.baselineY) < 1e-9);
    assert.ok(
      source[2] > motifWidth,
      `${item.sprite} must retain deliberate transparent horizontal padding`
    );
  }
}
assertTopDecorLayer(
  previewScene.topBackDecor,
  visualApi.drawTopBackDecor
);
assertTopDecorLayer(
  previewScene.topBackDecor.filter(item => item.role !== "FLOATING"),
  visualApi.drawStartGoalBackDecor
);
assertTopDecorLayer(
  previewScene.topBackDecor.filter(item => item.role === "FLOATING"),
  visualApi.drawFloatingBackDecor
);
assertTopDecorLayer(
  previewScene.topFrontDecor,
  visualApi.drawTopFrontDecor
);

drawCalls.length = 0;
assert.equal(visualApi.drawGoalSeamCoverProps(fakeCanvasContext, previewScene), true);
assert.equal(drawCalls.length, previewScene.goalSeamCoverProps.length);
for (const [index, item] of previewScene.goalSeamCoverProps.entries()) {
  const call = drawCalls[index];
  const mapping = goalSeamCoverMappings[item.sprite];
  const scale = item.nominalWidth / mapping.motifWidth;
  assert.equal(call.length, 9);
  assert.equal(
    call[0].src,
    "assets/environments/meadow/portal/meadow_portal_props.png"
  );
  assert.deepEqual(call.slice(1, 5), mapping.source);
  assert.equal(call[7], mapping.source[2] * scale);
  assert.equal(call[8], mapping.source[3] * scale);
  assert.ok(Math.abs(call[7] / mapping.source[2] - call[8] / mapping.source[3]) < 1e-12);
  assert.ok(Math.abs(call[5] + mapping.anchor[0] * scale - item.baselineX) < 1e-9);
  assert.ok(Math.abs(call[6] + mapping.anchor[1] * scale - item.baselineY) < 1e-9);
}

const portalGoalPlatformY = 370;
const portalGoalFixture = {
  x: 1140,
  y: portalGoalPlatformY - 95,
  w: 62,
  h: 92
};
const portalDestination = [1081, portalGoalPlatformY - 169, 180, 191];
function capturePortalGlow(visualTime) {
  drawCalls.length = 0;
  radialGradientCalls.length = 0;
  radialGradientStops.length = 0;
  canvasOperationCalls.length = 0;
  canvasPropertyWrites.length = 0;
  assert.equal(visualApi.drawPortal(fakeCanvasContext, portalGoalFixture, visualTime), true);
  assert.equal(drawCalls.length, 1);
  assert.deepEqual(drawCalls[0].slice(1, 5), [24, 50, 712, 755]);
  assert.deepEqual(drawCalls[0].slice(5, 9), portalDestination);
  assert.deepEqual(radialGradientCalls, [[0, 0, 0, 0, 0, 60]]);
  assert.equal(radialGradientStops.length, 1);
  assert.deepEqual(radialGradientStops[0].map(stop => stop[0]), [0, 0.42, 1]);
  assert.ok(canvasOperationCalls.some(call => (
    call[0] === "translate" &&
    Math.abs(call[1] - (portalDestination[0] + 180 * 0.48)) < 1e-12 &&
    Math.abs(call[2] - (portalDestination[1] + 191 * 0.49)) < 1e-12
  )));
  assert.ok(canvasOperationCalls.some(call => (
    call[0] === "scale" && Math.abs(call[1] - 44 / 60) < 1e-12 && call[2] === 1
  )));
  assert.ok(canvasOperationCalls.some(call => (
    call[0] === "arc" && call[1] === 0 && call[2] === 0 && call[3] === 60
  )));
  assert.ok(canvasPropertyWrites.some(write => (
    write[0] === "globalCompositeOperation" && write[1] === "screen"
  )));
  const alphaMatch = radialGradientStops[0][0][1].match(/,([0-9.]+)\)$/);
  assert.ok(alphaMatch);
  return Number(alphaMatch[1]);
}
const portalGlowMinimum = capturePortalGlow(1.65);
const portalGlowMaximum = capturePortalGlow(0.55);
assert.ok(Math.abs(portalGlowMinimum - 0.12) < 1e-12);
assert.ok(Math.abs(portalGlowMaximum - 0.68) < 1e-12);
assert.ok(portalGlowMaximum - portalGlowMinimum >= 0.56 - 1e-12);
assert.ok(Math.abs(capturePortalGlow(0.55) - portalGlowMaximum) < 1e-12);
assert.ok(portalDestination[0] + 180 * 0.48 - 44 >= portalDestination[0]);
assert.ok(portalDestination[0] + 180 * 0.48 + 44 <= portalDestination[0] + 180);
assert.ok(portalDestination[1] + 191 * 0.49 - 60 >= portalDestination[1]);
assert.ok(portalDestination[1] + 191 * 0.49 + 60 <= portalDestination[1] + 191);
assert.equal(
  portalDestination[1] -
    (portalGoalFixture.y + portalGoalFixture.h + 15 - portalDestination[3]),
  10,
  "the visual-only portal lowering must be exactly ten pixels"
);
const portalVisibleAlphaBottom = portalDestination[1] + 749 * 191 / 755;
assert.ok(Math.abs(portalVisibleAlphaBottom - (portalGoalPlatformY + 20.4821192053)) < 1e-9);
assert.deepEqual(portalGoalFixture, {
  x: 1140,
  y: portalGoalPlatformY - 95,
  w: 62,
  h: 92
});
assert.ok(portalGoalFixture.x >= portalDestination[0]);
assert.ok(portalGoalFixture.x + portalGoalFixture.w <= portalDestination[0] + portalDestination[2]);
assert.ok(portalGoalFixture.y >= portalDestination[1]);
assert.ok(portalGoalFixture.y + portalGoalFixture.h <= portalVisibleAlphaBottom);

const portalGoalPlatformFixture = {
  x: 1060,
  y: portalGoalPlatformY,
  w: 220,
  h: 720 - portalGoalPlatformY
};
const foregroundGoalSelection = visualApi.getTopOverlaySelection(91);
drawCalls.length = 0;
canvasOperationCalls.length = 0;
assert.equal(
  visualApi.drawGoalTopForeground(fakeCanvasContext, portalGoalPlatformFixture, 91),
  true
);
assert.equal(drawCalls.length, 2);
assert.ok(drawCalls.every(call => call.length === 9));
assert.deepEqual(drawCalls.map(call => call.slice(1)), [
  [0, 0, 352, 128, 1060, portalGoalPlatformY, 220, 80],
  [0, 0, 352, 128, 1060, portalGoalPlatformY, 220, 80]
]);
assert.deepEqual(drawCalls.map(call => call[0].src), [
  "assets/environments/meadow/platforms/meadow_top_base.png",
  `assets/environments/meadow/platforms/${foregroundGoalSelection.goalAsset}.png`
]);
assert.equal(canvasOperationCalls.some(call => call[0] === "rect"), false);
const goalTopClipOperations = [
  ["save"],
  ["beginPath"],
  ["moveTo", 1070, portalGoalPlatformY],
  ["arcTo", 1280, portalGoalPlatformY, 1280, 720, 10],
  ["arcTo", 1280, 720, 1060, 720, 10],
  ["arcTo", 1060, 720, 1060, portalGoalPlatformY, 10],
  ["arcTo", 1060, portalGoalPlatformY, 1280, portalGoalPlatformY, 10],
  ["closePath"],
  ["clip"],
  ["restore"]
];
assert.deepEqual(canvasOperationCalls, goalTopClipOperations);
const foregroundGoalOverlayPaths = Array.from(
  {length: 6},
  (_, index) => `assets/environments/meadow/platforms/meadow_overlay_top_0${index + 1}.png`
);
const foregroundGoalOverlays = new Set();
for (let goalIndex = 0; goalIndex < foregroundGoalOverlayPaths.length; goalIndex++) {
  let variantSeed = null;
  for (let seed = 0; seed < 4096; seed++) {
    if (visualApi.getTopOverlaySelection(seed).goalIndex === goalIndex) {
      variantSeed = seed;
      break;
    }
  }
  assert.notEqual(variantSeed, null, `missing Goal top foreground seed for variant ${goalIndex}`);
  drawCalls.length = 0;
  canvasOperationCalls.length = 0;
  assert.equal(
    visualApi.drawGoalTopForeground(
      fakeCanvasContext,
      portalGoalPlatformFixture,
      variantSeed
    ),
    true
  );
  assert.equal(drawCalls[0][0].src, "assets/environments/meadow/platforms/meadow_top_base.png");
  assert.equal(drawCalls[1][0].src, foregroundGoalOverlayPaths[goalIndex]);
  assert.deepEqual(drawCalls[1].slice(1), [0, 0, 352, 128, 1060, portalGoalPlatformY, 220, 80]);
  assert.deepEqual(canvasOperationCalls, goalTopClipOperations);
  foregroundGoalOverlays.add(drawCalls[1][0].src);
}
assert.deepEqual([...foregroundGoalOverlays].sort(), foregroundGoalOverlayPaths);
drawCalls.length = 0;
assert.equal(
  visualApi.drawPlatformBase(
    fakeCanvasContext,
    portalGoalPlatformFixture,
    portalGoalPlatformFixture.x,
    91
  ),
  true
);
assert.deepEqual(drawCalls.slice(0, 2).map(call => call[0].src), [
  "assets/environments/meadow/platforms/meadow_top_base.png",
  `assets/environments/meadow/platforms/${foregroundGoalSelection.goalAsset}.png`
]);
assert.equal(
  visualApi.drawGoalTopForeground(
    fakeCanvasContext,
    {x: 400, y: 300, w: 140, h: 26},
    91
  ),
  false
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
  "assets/environments/meadow/platforms/floating_left.png",
  "assets/environments/meadow/platforms/floating_right.png"
];
for (const [width, expectedMiddleCount] of [[100, 1], [138, 2], [176, 3]]) {
  const floatingPlatform = {x: 420, y: 310, w: width, h: 26};
  const platformSnapshot = JSON.stringify(floatingPlatform);
  drawCalls.length = 0;
  assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, floatingPlatform), true);
  assert.equal(JSON.stringify(floatingPlatform), platformSnapshot);
  assert.ok(drawCalls.every(call => call.length === 9));

  const segments = Array.from({length: drawCalls.length / 3}, (_, index) => (
    drawCalls.slice(index * 3, index * 3 + 3)
  ));
  const middleSegments = segments.slice(0, -2);
  const leftSegment = segments.at(-2);
  const rightSegment = segments.at(-1);
  assert.equal(middleSegments.length, expectedMiddleCount);
  assert.deepEqual([leftSegment[0][0].src, rightSegment[0][0].src], floatingAssetPaths);
  assert.ok(middleSegments.every(calls => calls.every(call => (
    call[0].src === "assets/environments/meadow/platforms/floating_middle.png"
  ))));
  assert.deepEqual(leftSegment.map(call => call.slice(1)), [
    [0, 24, 128, 10, 420, 308, 26, 2],
    [0, 34, 128, 51, 420, 310, 26, 26],
    [0, 85, 128, 18, 420, 336, 26, 3]
  ]);
  assert.deepEqual(rightSegment.map(call => call.slice(1)), [
    [0, 24, 128, 10, 420 + width - 26, 308, 26, 2],
    [0, 34, 128, 51, 420 + width - 26, 310, 26, 26],
    [0, 85, 128, 18, 420 + width - 26, 336, 26, 3]
  ]);
  assert.ok(segments.every(calls => (
    calls.every(call => call[5] >= floatingPlatform.x && (
      call[5] + call[7] <= floatingPlatform.x + floatingPlatform.w
    ))
  )));

  const middleStartX = 420 + 26 - 1;
  const middleEndX = 420 + width - 26 + 1;
  assert.equal(middleSegments[0][0][5], middleStartX);
  assert.equal(
    middleSegments.at(-1)[0][5] + middleSegments.at(-1)[0][7],
    middleEndX
  );
  for (const [index, calls] of middleSegments.entries()) {
    const call = calls[0];
    const destinationWidth = call[7];
    assert.deepEqual(calls.map(item => item[2]), [24, 34, 85]);
    assert.deepEqual(calls.map(item => item[4]), [10, 51, 18]);
    assert.deepEqual(calls.map(item => item[6]), [308, 310, 336]);
    assert.deepEqual(calls.map(item => item[8]), [2, 26, 3]);
    assert.ok(calls.every(item => item[3] === 256 * destinationWidth / 52));
    assert.ok(destinationWidth <= 52);
    if (index < middleSegments.length - 1) {
      assert.equal(destinationWidth, 52);
      assert.equal(middleSegments[index + 1][0][5] - call[5], 51);
      assert.equal(call[5] + destinationWidth - middleSegments[index + 1][0][5], 1);
    }
  }
  assert.equal(leftSegment[0][5] + leftSegment[0][7] - middleSegments[0][0][5], 1);
  assert.equal(
    middleSegments.at(-1)[0][5] + middleSegments.at(-1)[0][7] - rightSegment[0][5],
    1
  );
}
assert.equal(26 / 128, 52 / 256);

const narrowFloatingPlatform = {x: 420, y: 310, w: 40, h: 26};
drawCalls.length = 0;
assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, narrowFloatingPlatform), true);
assert.equal(drawCalls.length, 6, "narrow floating platforms must use two three-zone caps");
assert.deepEqual(drawCalls.slice(0, 3).map(call => call.slice(1)), [
  [0, 24, 128, 10, 420, 308, 20, 2],
  [0, 34, 128, 51, 420, 310, 20, 26],
  [0, 85, 128, 18, 420, 336, 20, 3]
]);
assert.deepEqual(drawCalls.slice(3).map(call => call.slice(1)), [
  [0, 24, 128, 10, 440, 308, 20, 2],
  [0, 34, 128, 51, 440, 310, 20, 26],
  [0, 85, 128, 18, 440, 336, 20, 3]
]);

const startPlatform = {x: 0, y: 640, w: 235, h: 80};
const startTopHeight = startPlatform.w * (128 / 352);
const topOverlayAssetPaths = Array.from(
  {length: 6},
  (_, index) => `assets/environments/meadow/platforms/meadow_overlay_top_0${index + 1}.png`
);
const bodyOverlayAssetPaths = Array.from(
  {length: 3},
  (_, index) => `assets/environments/meadow/platforms/meadow_overlay_body_0${index + 1}.png`
);
drawCalls.length = 0;
assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, startPlatform, startPlatform.x, 0), true);
assert.equal(drawCalls.length, 2, "the start platform must use only top base and one overlay");
assert.deepEqual(drawCalls.map(call => call.slice(1)), [
  [0, 0, 352, 128, 0, 640, 235, startTopHeight],
  [0, 0, 352, 128, 0, 640, 235, startTopHeight]
]);
assert.deepEqual(drawCalls.map(call => call[0].src), [
  "assets/environments/meadow/platforms/meadow_top_base.png",
  topOverlayAssetPaths[visualApi.getTopOverlaySelection(0).startIndex]
]);
assert.ok(drawCalls.every(call => !call[0].src.includes("body")));
assert.equal(drawCalls[0][7] / drawCalls[0][3], drawCalls[0][8] / drawCalls[0][4]);
assert.ok(drawCalls[0][6] + drawCalls[0][8] > startPlatform.y + startPlatform.h);

const goalBodyAsset = "assets/environments/meadow/platforms/meadow_body_base.png";
function getExpectedBodyRows(platform) {
  const rows = [];
  const blockBottom = platform.y + platform.h;
  for (let destinationY = platform.y + 79; destinationY < blockBottom;) {
    const destinationHeight = Math.min(80, blockBottom - destinationY);
    rows.push({destinationY, destinationHeight});
    if (destinationY + destinationHeight >= blockBottom) break;
    destinationY += 79;
  }
  return rows;
}

function assertGoalComposition(platform, seed) {
  const topSelection = visualApi.getTopOverlaySelection(seed);
  const bodySelection = visualApi.getBodyOverlaySelection(seed);
  const expectedRows = getExpectedBodyRows(platform);
  drawCalls.length = 0;
  canvasOperationCalls.length = 0;
  assert.equal(
    visualApi.drawPlatformBase(fakeCanvasContext, platform, platform.x, seed),
    true
  );
  assert.equal(drawCalls.length, expectedRows.length + 3);
  assert.deepEqual(drawCalls.slice(0, 2).map(call => call[0].src), [
    "assets/environments/meadow/platforms/meadow_top_base.png",
    topOverlayAssetPaths[topSelection.goalIndex]
  ]);
  assert.ok(drawCalls.slice(0, 2).every(call => (
    JSON.stringify(call.slice(1)) === JSON.stringify([
      0, 0, 352, 128, platform.x, platform.y, 220, 80
    ])
  )));

  const baseCalls = drawCalls.slice(2, -1);
  assert.equal(baseCalls.length, expectedRows.length);
  for (const [rowIndex, call] of baseCalls.entries()) {
    const row = expectedRows[rowIndex];
    const [, sourceX, sourceY, sourceWidth, sourceHeight,
      destinationX, destinationY, destinationWidth, destinationHeight] = call;
    assert.equal(call[0].src, goalBodyAsset);
    assert.deepEqual([sourceX, sourceY, sourceWidth], [0, 0, 352]);
    assert.equal(sourceHeight, row.destinationHeight * 128 / 80);
    assert.equal(destinationX, platform.x);
    assert.equal(destinationWidth, 220);
    assert.equal(destinationY, row.destinationY);
    assert.equal(destinationHeight, row.destinationHeight);
    assert.equal(destinationWidth / sourceWidth, destinationHeight / sourceHeight);
    if (rowIndex > 0) {
      const previous = baseCalls[rowIndex - 1];
      assert.equal(previous[6] + previous[8] - destinationY, 1);
    }
  }

  const overlayCall = drawCalls.at(-1);
  assert.equal(overlayCall[0].src, bodyOverlayAssetPaths[bodySelection.goalIndex]);
  assert.deepEqual(overlayCall.slice(1), [
    0, 0, 352, 128,
    platform.x, platform.y + platform.h - 80, 220, 80
  ]);
  assert.equal(drawCalls.filter(call => call[0].src.includes("meadow_overlay_body_")).length, 1);
  assert.ok(canvasOperationCalls.some(call => (
    call[0] === "rect" &&
    call[1] === platform.x &&
    call[2] === platform.y + 79 &&
    call[3] === 220 &&
    call[4] === platform.h - 79
  )));
}

assertGoalComposition({x: 1060, y: 570, w: 220, h: 150}, 7);
assertGoalComposition({x: 1060, y: 470, w: 220, h: 250}, 9);
assertGoalComposition({x: 1060, y: 370, w: 220, h: 350}, 11);
assertGoalComposition({x: 1060, y: 270, w: 220, h: 450}, 12);
assertGoalComposition({x: 1060, y: 185, w: 220, h: 535}, 13);

let sweptGoalHeightCount = 0;
for (const seed of [17, 19, 23]) {
  for (let height = 150; height <= 535; height++) {
    const platform = {x: 1060, y: 720 - height, w: 220, h: height};
    drawCalls.length = 0;
    assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, platform, platform.x, seed), true);
    const baseCalls = drawCalls.slice(2, -1);
    for (const [rowIndex, call] of baseCalls.entries()) {
      assert.deepEqual(call.slice(1, 4), [0, 0, 352]);
      assert.equal(call[5], platform.x);
      assert.equal(call[6], platform.y + 79 + rowIndex * 79);
      assert.equal(call[7], 220);
      assert.ok(call[8] > 0 && call[8] <= 80);
      assert.equal(call[4], call[8] * 128 / 80);
      if (rowIndex > 0) {
        const previous = baseCalls[rowIndex - 1];
        assert.equal(previous[6] + previous[8] - call[6], 1);
      }
    }
    const finalCall = baseCalls.at(-1);
    assert.equal(finalCall[6] + finalCall[8], platform.y + platform.h);
    sweptGoalHeightCount += 1;
  }
}
assert.equal(sweptGoalHeightCount, 3 * (535 - 150 + 1));

const reachableStartOverlays = new Set();
const reachableGoalOverlays = new Set();
const reachablePairs = new Set();
const reachableBodyOverlays = new Set();
for (let seed = 0; seed < 1000; seed++) {
  const selection = JSON.parse(JSON.stringify(visualApi.getTopOverlaySelection(seed)));
  const repeat = JSON.parse(JSON.stringify(visualApi.getTopOverlaySelection(seed)));
  const bodySelection = JSON.parse(JSON.stringify(visualApi.getBodyOverlaySelection(seed)));
  const bodyRepeat = JSON.parse(JSON.stringify(visualApi.getBodyOverlaySelection(seed)));
  assert.deepEqual(repeat, selection, `top selection must be deterministic for seed ${seed}`);
  assert.deepEqual(bodyRepeat, bodySelection, `body selection must be deterministic for seed ${seed}`);
  assert.notEqual(selection.startIndex, selection.goalIndex, `start/goal collision for seed ${seed}`);
  assert.equal(selection.startAsset, `meadow_overlay_top_0${selection.startIndex + 1}`);
  assert.equal(selection.goalAsset, `meadow_overlay_top_0${selection.goalIndex + 1}`);
  assert.equal(bodySelection.goalAsset, `meadow_overlay_body_0${bodySelection.goalIndex + 1}`);

  drawCalls.length = 0;
  assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, startPlatform, 0, seed), true);
  const renderedStartTop = drawCalls.at(-1)[0].src;
  drawCalls.length = 0;
  assert.equal(
    visualApi.drawPlatformBase(
      fakeCanvasContext,
      {x: 1060, y: 570, w: 220, h: 150},
      1060,
      seed
    ),
    true
  );
  const renderedGoalTop = drawCalls[1][0].src;
  const renderedBodyOverlays = drawCalls.filter(call => call[0].src.includes("meadow_overlay_body_"));
  assert.equal(renderedStartTop, topOverlayAssetPaths[selection.startIndex]);
  assert.equal(renderedGoalTop, topOverlayAssetPaths[selection.goalIndex]);
  assert.notEqual(renderedStartTop, renderedGoalTop);
  assert.equal(renderedBodyOverlays.length, 1);
  assert.equal(renderedBodyOverlays[0][0].src, bodyOverlayAssetPaths[bodySelection.goalIndex]);

  reachableStartOverlays.add(selection.startIndex);
  reachableGoalOverlays.add(selection.goalIndex);
  reachablePairs.add(`${selection.startIndex}:${selection.goalIndex}`);
  reachableBodyOverlays.add(bodySelection.goalIndex);
}
assert.deepEqual([...reachableStartOverlays].sort(), [0, 1, 2, 3, 4, 5]);
assert.deepEqual([...reachableGoalOverlays].sort(), [0, 1, 2, 3, 4, 5]);
assert.ok(reachablePairs.size > 6);
assert.deepEqual([...reachableBodyOverlays].sort(), [0, 1, 2]);
assert.equal(visualMathRandomCalls, 0, "Meadow visual selection and preview must not consume Math.random");

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
  assert.equal(drawCalls.length, 12, "each special must reuse four three-zone segments");
  assert.ok(drawCalls.every(call => call.length === 9));
  assert.deepEqual(drawCalls.slice(-6).filter((_, index) => index % 3 === 0).map(call => call[0].src), floatingAssetPaths);
  assert.deepEqual(drawCalls.map(call => call[8]), [2, 26, 3, 2, 26, 3, 2, 26, 3, 2, 26, 3]);
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
assert.doesNotMatch(visualSource, /GOAL_TOP: Object\.freeze\(\{x:/);
assert.doesNotMatch(visualSource, /GOAL_BODY_[A-F]|getGoalBodySprite/);
const standardPlatformSource = visualSource.slice(
  visualSource.indexOf("    function drawFloatingPlatform"),
  visualSource.indexOf("    function drawPortal")
);
assert.doesNotMatch(standardPlatformSource, /fillRect|#65432d/);
assert.doesNotMatch(standardPlatformSource, /\.rotate\(|\.scale\(/);
assert.doesNotMatch(visualSource, /FLOATING_[123]/);
const topDecorPreviewSource = visualSource.slice(
  visualSource.indexOf("    const TOP_DECOR_SPRITES"),
  visualSource.indexOf("    function traceRoundedRect")
);
assert.doesNotMatch(topDecorPreviewSource, /Math\.random\(/);

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
  SPIKE_PLATFORM_FULL_DRAW_WIDTH: 18,
  MEADOW_ASSET_VISUALS: {
    drawPlatformBase: (context, platform, drawX, levelSeed) => {
      rendererBaseCalls.push({platform, drawX, levelSeed});
      return true;
    },
    resolvePlatformRole: platform => (
      platform.h === 26 ? "FLOATING" :
        platform.x === 0 ? "START_PLATFORM" :
          platform.x === 1060 ? "GOAL_TOWER" : null
    )
  },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx: rendererCanvasContext,
  currentLevel: () => ({seed: 73, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawConveyorPlatformAsset: (context, platform) => platform.conveyor === true,
  drawConveyorPlatformBeltOverlay: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: (context, platform) => platform.fragile === true,
  drawFadingPlatformAsset: (context, platform) => platform.fade === true,
  drawIcePlatformAsset: (context, platform) => platform.ice === true,
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
assert.equal(rendererBaseCalls.length, 6);
assert.deepEqual(
  rendererBaseCalls.map(call => Boolean(
    call.platform.moving || call.platform.fragile || call.platform.conveyor ||
    call.platform.fade || call.platform.ice || call.platform.spikePlatform
  )),
  [false, false, false, true, true, true]
);
assert.equal(
  rendererBaseCalls.some(call => call.platform.lastBubbleSupport),
  false,
  "Last Bubble support must not enter the Meadow terrain contract"
);
assert.equal(JSON.stringify(rendererPlatformFixture), rendererPlatformSnapshot);
rendererBaseCalls.length = 0;
rendererPlatformContext.drawPlatformsForTest(
  {platform: {body: "#000", top: "#fff"}},
  true,
  "without-floating"
);
assert.deepEqual(
  rendererBaseCalls.map(call => call.platform.x),
  [0, 1060],
  "the first Meadow pass must exclude every floating platform body"
);
rendererBaseCalls.length = 0;
rendererPlatformContext.drawPlatformsForTest(
  {platform: {body: "#000", top: "#fff"}},
  true,
  "floating-only"
);
assert.deepEqual(
  rendererBaseCalls.map(call => call.platform.x),
  [420, 300, 360, 400],
  "the second Meadow pass must exclude the global Falling, Ice and Conveyor assets"
);

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

const decorAttemptStart = rendererSource.indexOf("  let meadowDecorAttemptLevel");
const decorAttemptEnd = rendererSource.indexOf(
  "  function drawEarthPlatformDetail",
  decorAttemptStart
);
assert.ok(decorAttemptStart >= 0 && decorAttemptEnd > decorAttemptStart);
const decorAttemptContext = vm.createContext({lives: 3, shots: 0});
vm.runInContext(`${rendererSource.slice(decorAttemptStart, decorAttemptEnd)}
  globalThis.getMeadowDecorAttemptNonceForTest = getMeadowDecorAttemptNonce;
`, decorAttemptContext);
const attemptLevelA = {};
const attemptLevelB = {};
assert.equal(decorAttemptContext.getMeadowDecorAttemptNonceForTest(attemptLevelA), 0);
assert.equal(decorAttemptContext.getMeadowDecorAttemptNonceForTest(attemptLevelA), 0);
decorAttemptContext.shots = 2;
assert.equal(decorAttemptContext.getMeadowDecorAttemptNonceForTest(attemptLevelA), 0);
decorAttemptContext.shots = 0;
assert.equal(decorAttemptContext.getMeadowDecorAttemptNonceForTest(attemptLevelA), 1);
decorAttemptContext.lives = 2;
assert.equal(decorAttemptContext.getMeadowDecorAttemptNonceForTest(attemptLevelA), 2);
assert.equal(decorAttemptContext.getMeadowDecorAttemptNonceForTest(attemptLevelB), 0);

assert.match(
  rendererSource,
  /function drawPlatforms\(biome, useMeadowAssets = false, meadowPass = "all"\)/
);
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
assert.match(
  rendererSource,
  /drawPlatforms\(biome, true, "without-floating"\);[\s\S]*?drawStartGoalBackDecor\(ctx, meadowScene\);[\s\S]*?drawPlatforms\(biome, true, "floating-only"\);[\s\S]*?drawFloatingBackDecor\(ctx, meadowScene\);[\s\S]*?drawGoal\(meadowAssetsActive\);[\s\S]*?drawGoalSeamCoverProps\(ctx, meadowScene\);[\s\S]*?drawPlayer\(\);[\s\S]*?drawTopFrontDecor\(ctx, meadowScene\);/
);
assert.match(
  rendererSource,
  /MEADOW_ASSET_VISUALS\.getScene\(\s*meadowLevel,\s*getMeadowDecorAttemptNonce\(meadowLevel\)\s*\)/
);
assert.match(
  rendererSource,
  /MEADOW_ASSET_VISUALS\.drawPortal\(ctx, g, worldTime\)/
);
assert.match(
  rendererSource,
  /drawPortal\(ctx, g, worldTime\)[\s\S]*?drawGoalTopForeground\([\s\S]*?level\.seed/
);
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
