"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const readRelease = relativePath => execFileSync(
  "git",
  ["show", `1912d04:${relativePath.replace(/\\/g, "/")}`],
  {cwd: root, encoding: "utf8"}
);
const readHead = relativePath => execFileSync(
  "git",
  ["show", `HEAD:${relativePath.replace(/\\/g, "/")}`],
  {cwd: root, encoding: "utf8"}
);
const normalize = source => source.replace(/\r\n/g, "\n");

const protectedFiles = [
  "js/biomes.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js"
];
for (const relativePath of protectedFiles) {
  assert.equal(
    normalize(read(relativePath)),
    normalize(readHead(relativePath)),
    `${relativePath} must remain byte-equivalent to visual-upgrade HEAD apart from line endings`
  );
}

const assetExpectations = Object.freeze({
  "assets/environments/meadow/background/meadow_background.png": [1672, 941],
  "assets/environments/meadow/background/meadow_background_sky_base.png": [1280, 720],
  "assets/environments/meadow/background/meadow_background_clouds_back.png": [1280, 720],
  "assets/environments/meadow/background/meadow_background_landscape.png": [1280, 720],
  "assets/environments/meadow/background/meadow_background_clouds_front.png": [1280, 720],
  "assets/environments/meadow/platforms/meadow_floating_platform.png": [512, 128],
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
  "assets/environments/meadow/decor/top/meadow_decor_top_grass_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_flowers_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_mushrooms_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_bushes_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_stones_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_tufts_set_01.png": [1536, 1024],
  "assets/environments/meadow/decor/top/meadow_decor_top_trees_set_01.png": [1536, 1024],
  "assets/environments/meadow/portal/meadow_goal_portal.png": [256, 272],
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

function decodeRgba8Png(bytes) {
  assert.equal(bytes.readUInt8(24), 8, "PNG must use eight-bit channels");
  assert.equal(bytes.readUInt8(25), 6, "PNG must be RGBA");
  assert.equal(bytes.readUInt8(28), 0, "PNG must be non-interlaced");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  let sourceOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[sourceOffset++];
    for (let x = 0; x < stride; x++) {
      let value = raw[sourceOffset++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const predictor = left + up - upperLeft;
        const leftDistance = Math.abs(predictor - left);
        const upDistance = Math.abs(predictor - up);
        const upperLeftDistance = Math.abs(predictor - upperLeft);
        value = (value + (
          leftDistance <= upDistance && leftDistance <= upperLeftDistance
            ? left
            : upDistance <= upperLeftDistance ? up : upperLeft
        )) & 255;
      } else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = value;
    }
  }
  return {width, height, pixels};
}

function getAlphaBounds(image, threshold) {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.pixels[(y * image.width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {x: left, y: top, w: right - left + 1, h: bottom - top + 1};
}

const portalAssetBytes = fs.readFileSync(path.join(
  root,
  "assets/environments/meadow/portal/meadow_goal_portal.png"
));
const decodedPortalAsset = decodeRgba8Png(portalAssetBytes);
assert.deepEqual(
  [decodedPortalAsset.width, decodedPortalAsset.height],
  [256, 272]
);
assert.deepEqual(getAlphaBounds(decodedPortalAsset, 8), {x: 9, y: 21, w: 239, h: 248});

const decorGridDefinitions = Object.freeze([
  {category: "GRASS", prefix: "grass", asset: "decor_top_grass", roles: ["COMPACT", "WIDE", "LARGE", "WIDE", "LARGE", "LARGE"]},
  {category: "FLOWERS", prefix: "flower", asset: "decor_top_flowers", roles: Array(6).fill("STANDARD")},
  {category: "MUSHROOMS", prefix: "mushroom", asset: "decor_top_mushrooms", roles: Array(6).fill("STANDARD")},
  {category: "BUSHES", prefix: "bush", asset: "decor_top_bushes", roles: Array(6).fill("LARGE")},
  {category: "STONES", prefix: "stone", asset: "decor_top_stones", roles: ["COMPACT", "WIDE", "WIDE", "WIDE", "WIDE", "WIDE"]},
  {category: "TUFTS", prefix: "tuft", asset: "decor_top_tufts", roles: Array(6).fill("STANDARD")},
  {category: "TREES", prefix: "tree", asset: "decor_top_trees", roles: Array(6).fill("HERO")}
].map(definition => Object.freeze({
  ...definition,
  path: `assets/environments/meadow/decor/top/meadow_decor_top_${
    definition.asset.slice("decor_top_".length)
  }_set_01.png`,
  sprites: Object.freeze(Array.from(
    {length: 6},
    (_, index) => `${definition.prefix}${String(index + 1).padStart(2, "0")}`
  )),
  roles: Object.freeze(definition.roles)
})));
const decodedDecorGridAssets = Object.freeze(Object.fromEntries(
  decorGridDefinitions.map(definition => {
    const decoded = decodeRgba8Png(fs.readFileSync(path.join(root, definition.path)));
    assert.deepEqual([decoded.width, decoded.height], [1536, 1024]);
    let transparentPixels = 0;
    let visiblePixels = 0;
    for (let offset = 3; offset < decoded.pixels.length; offset += 4) {
      if (decoded.pixels[offset] === 0) transparentPixels += 1;
      else visiblePixels += 1;
    }
    assert.ok(transparentPixels > 0, `${definition.path} must contain true transparency`);
    assert.ok(visiblePixels > 0, `${definition.path} must contain visible RGBA content`);
    return [definition.asset, decoded];
  })
));

function getSlotAlphaBounds(image, slotIndex, threshold) {
  const sourceX = slotIndex % 3 * 512;
  const sourceY = Math.floor(slotIndex / 3) * 512;
  let left = 512;
  let top = 512;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const alpha = image.pixels[
        ((sourceY + y) * image.width + sourceX + x) * 4 + 3
      ];
      if (alpha <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {x: left, y: top, w: right - left + 1, h: bottom - top + 1};
}

function getSlotRobustProfile(image, slotIndex) {
  const sourceX = slotIndex % 3 * 512;
  const sourceY = Math.floor(slotIndex / 3) * 512;
  const visited = new Uint8Array(512 * 512);
  const queue = new Int32Array(512 * 512);
  let best = null;
  for (let start = 0; start < visited.length; start++) {
    const startX = start % 512;
    const startY = Math.floor(start / 512);
    const startAlpha = image.pixels[
      ((sourceY + startY) * image.width + sourceX + startX) * 4 + 3
    ];
    if (visited[start] || startAlpha <= 8) continue;
    let head = 0;
    let tail = 0;
    let count = 0;
    let left = 512;
    let right = -1;
    let top = 512;
    let bottom = -1;
    let baseLeft = 512;
    let baseRight = -1;
    let contactPixelCount = 0;
    let baselinePixelCount = 0;
    visited[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % 512;
      const y = Math.floor(pixelIndex / 512);
      count += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (y >= 432 && y <= 456) {
        baseLeft = Math.min(baseLeft, x);
        baseRight = Math.max(baseRight, x);
        contactPixelCount += 1;
      }
      if (y === 448) baselinePixelCount += 1;
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          if (
            neighborX < 0 || neighborX >= 512 ||
            neighborY < 0 || neighborY >= 512
          ) continue;
          const neighborIndex = neighborY * 512 + neighborX;
          const neighborAlpha = image.pixels[
            ((sourceY + neighborY) * image.width + sourceX + neighborX) * 4 + 3
          ];
          if (visited[neighborIndex] || neighborAlpha <= 8) continue;
          visited[neighborIndex] = 1;
          queue[tail++] = neighborIndex;
        }
      }
    }
    if (!best || count > best.robustPixelCount) {
      const hasContact = contactPixelCount > 0;
      best = {
        visibleBounds: {x: left, y: top, w: right - left + 1, h: bottom - top + 1},
        visibleBase: {
          left: hasContact ? baseLeft : left,
          right: hasContact ? baseRight : right
        },
        robustPixelCount: count,
        contactPixelCount,
        baselinePixelCount
      };
    }
  }
  return best;
}

const decorGridProfiles = Object.freeze(Object.fromEntries(
  decorGridDefinitions.flatMap(definition => definition.sprites.map((name, slotIndex) => {
    const image = decodedDecorGridAssets[definition.asset];
    const alpha0 = getSlotAlphaBounds(image, slotIndex, 0);
    const alpha8 = getSlotAlphaBounds(image, slotIndex, 8);
    assert.ok(alpha0.w > 0 && alpha0.h > 0, `${name} must contain one visible motif`);
    assert.ok(alpha8.w > 0 && alpha8.h > 0, `${name} must contain robust alpha`);
    const profile = getSlotRobustProfile(image, slotIndex);
    assert.ok(profile.contactPixelCount > 0, `${name} must contact the fixed Y432..456 band`);
    assert.ok(profile.baselinePixelCount > 0, `${name} must cross the fixed Y448 baseline`);
    return [name, Object.freeze(profile)];
  }))
));

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
const wholeFloatingAssetPath =
  "assets/environments/meadow/platforms/meadow_floating_platform.png";
const decodedWholeFloatingAsset = decodeRgba8Png(
  fs.readFileSync(path.join(root, wholeFloatingAssetPath))
);

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
    const decorDefinition = decorGridDefinitions.find(definition => definition.path === value);
    this.pixelData = decorDefinition
      ? decodedDecorGridAssets[decorDefinition.asset].pixels
      : value === "assets/environments/meadow/portal/meadow_goal_portal.png"
        ? decodedPortalAsset.pixels
        : value === wholeFloatingAssetPath
          ? decodedWholeFloatingAsset.pixels
          : undefined;
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
    const surface = {
      width: 0,
      height: 0,
      getContext() {
        return {
          clearRect() {},
          drawImage(image) {
            drawnImage = image;
          },
          getImageData(x = 0, y = 0, width = surface.width, height = surface.height) {
            if (
              x === 0 && y === 0 &&
              width === drawnImage.naturalWidth && height === drawnImage.naturalHeight
            ) return {data: drawnImage.pixelData};
            const cropped = Buffer.alloc(width * height * 4);
            for (let row = 0; row < height; row++) {
              const sourceStart = ((y + row) * drawnImage.naturalWidth + x) * 4;
              drawnImage.pixelData.copy(
                cropped,
                row * width * 4,
                sourceStart,
                sourceStart + width * 4
              );
            }
            return {data: cropped};
          }
        };
      }
    };
    return surface;
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
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-decor-kit.js")}
${read("js/visual-portal-kit.js")}
${read("js/visual-meadow-assets.js")}
  globalThis.meadowAssetVisualsForTest = MEADOW_ASSET_VISUALS;
`, visualContext, {filename: "js/visual-meadow-assets.js"});
const visualApi = visualContext.meadowAssetVisualsForTest;
assert.equal(
  imageConstructionCount,
  26,
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
    meadow_floating_platform: "assets/environments/meadow/platforms/meadow_floating_platform.png",
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
    portal: "assets/environments/meadow/portal/meadow_goal_portal.png",
    bottom_spike_tile: "assets/environments/meadow/hazards/meadow_bottom_spike_tile.png"
  }
);
const meadowManifest = JSON.parse(JSON.stringify(visualApi.getManifest()));
assert.equal(meadowManifest.biome, "meadow");
assert.deepEqual(meadowManifest.sourceSizes.portal, {w: 256, h: 272});
for (const definition of decorGridDefinitions) {
  assert.deepEqual(meadowManifest.sourceSizes[definition.asset], {w: 1536, h: 1024});
}
const decorSpriteNamesByCategory = Object.freeze(Object.fromEntries(
  decorGridDefinitions.map(definition => [definition.category, definition.sprites])
));
const allDecorGridSpriteNames = Object.freeze(decorGridDefinitions.flatMap(
  definition => definition.sprites
));
const mushroomGridSpriteNames = decorSpriteNamesByCategory.MUSHROOMS;
assert.deepEqual(meadowManifest.decor.gridV2, {
  contract: {
    sheet: {w: 1536, h: 1024},
    columns: 3,
    rows: 2,
    slot: {w: 512, h: 512},
    anchor: {x: 256, y: 448},
    motifWidth: 448,
    alphaThreshold: 8,
    contactBand: {top: 432, bottom: 456},
    safeArea: {
      robust: {left: 32, top: 32, right: 479, bottom: 448},
      robustFringeBottom: 456,
      faintAlphaBottom: 460
    }
  },
  roleWidths: {
    GRASS: {COMPACT: 34, WIDE: 62, LARGE: 78},
    FLOWERS: {COMPACT: 34, STANDARD: 52},
    MUSHROOMS: {COMPACT: 30, STANDARD: 40},
    BUSHES: {COMPACT: 34, LARGE: 66},
    STONES: {COMPACT: 32, WIDE: 60},
    TUFTS: {COMPACT: 32, STANDARD: 40},
    TREES: {HERO: 132}
  },
  sheets: Object.fromEntries(decorGridDefinitions.map(definition => [
    definition.category,
    {
      asset: definition.asset,
      sprites: definition.sprites,
      slotRoles: definition.roles
    }
  ]))
});
for (const definition of decorGridDefinitions) {
  const sheet = meadowManifest.decor.gridV2.sheets[definition.category];
  assert.equal(sheet.sprites.length, 6);
  assert.deepEqual(sheet.sprites, definition.sprites);
  assert.deepEqual(sheet.slotRoles, definition.roles);
}
assert.equal(allDecorGridSpriteNames.length, 42);
assert.equal(new Set(allDecorGridSpriteNames).size, 42);
assert.deepEqual(
  JSON.parse(JSON.stringify(visualApi.getStatus().decorAlphaProfiles)),
  decorGridProfiles
);
assert.ok(Object.values(decorGridProfiles).every(profile => (
  profile.contactPixelCount > 0 && profile.baselinePixelCount > 0
)));
for (const name of decorSpriteNamesByCategory.TREES) {
  const profile = decorGridProfiles[name];
  const trunkFootprintWidth = profile.visibleBase.right - profile.visibleBase.left + 1;
  assert.ok(
    trunkFootprintWidth < profile.visibleBounds.w * 0.65,
    `${name} edge-clamping must use its trunk/base, not its full crown`
  );
}
assert.deepEqual(
  Object.keys(visualApi.getStatus().decorAlphaProfiles).sort(),
  [...allDecorGridSpriteNames].sort()
);
assert.deepEqual(meadowManifest.platforms.contract, {
  floating: {
    height: 26,
    wholeMode: "uniform-whole-image",
    wholeContentFit: {
      alphaThreshold: 8,
      supportRowMinimumCoverage: 0.9,
      mode: "robust-alpha-bounds-and-longest-contiguous-support-band"
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
  "meadow_floating_platform",
  "meadow_top_base",
  "meadow_body_base",
  "meadow_top_overlays",
  "meadow_body_overlays"
]);
assert.deepEqual(meadowManifest.platforms.slots.meadow_floating_platform, {
  asset: "meadow_floating_platform",
  w: 512,
  h: 128,
  source: {x: 0, y: 0, w: 512, h: 128}
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
const floatingMushroomCoverage = new Set();
const startGoalMushroomCoverage = new Set();
const goalSeamCoverCoverage = new Set();
const goalSeamCoverCounts = new Set();
const goalSeamDecorMappings = Object.freeze(Object.fromEntries(
  decorGridDefinitions.flatMap(definition => definition.sprites.map((name, index) => {
    const profile = decorGridProfiles[name];
    const sizeRole = definition.roles[index];
    return [name, {
      anchor: [256, 448],
      base: [profile.visibleBase.left, profile.visibleBase.right],
      motifWidth: 448,
      nominalWidth: meadowManifest.decor.gridV2.roleWidths[definition.category][sizeRole],
      sizeRole,
      visibleWidth: profile.visibleBounds.w,
      visibleHeight: profile.visibleBounds.h
    }];
  }))
));
const normalGoalSeamDecorNames = Object.freeze(Object.keys(goalSeamDecorMappings));
let smallGoalSeamSelections = 0;
let largeGoalSeamSelections = 0;
const startGoalBackPlacement = Object.freeze(Object.fromEntries(
  normalGoalSeamDecorNames.map(name => [name, {
    anchor: goalSeamDecorMappings[name].anchor,
    base: goalSeamDecorMappings[name].base,
    motifWidth: 448
  }])
));
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
    for (const item of platformDecor.filter(item => item.category === "MUSHROOMS")) {
      floatingMushroomCoverage.add(item.sprite);
      assert.equal(item.nominalWidth, 30);
      assert.equal(item.baselineY, item.platformY + 2);
    }
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
      const mapping = goalSeamDecorMappings[item.sprite];
      assert.ok(mapping, `goal seam decor must use the normal Meadow pool: ${item.sprite}`);
      goalSeamCoverCoverage.add(item.sprite);
      assert.equal(item.role, "GOAL_TOWER");
      assert.equal(item.layer, "goal-seam-cover");
      assert.equal(item.platformX, goalPlatform.x);
      assert.equal(item.platformY, goalPlatform.y);
      assert.equal(item.platformW, goalPlatform.w);
      assert.equal(item.baselineOffset, 11);
      assert.equal(item.baselineY, goalPlatform.y + 11);
      assert.equal(item.sizeRole, mapping.sizeRole);
      assert.ok(item.nominalWidth > 0 && item.nominalWidth <= mapping.nominalWidth + 1e-12);
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
      const visibleBaseCenterRatio = (
        (visibleBaseLeft + visibleBaseRight) / 2 - goalPlatform.x
      ) / goalPlatform.w;
      assert.ok(
        visibleBaseCenterRatio >= 0.12 && visibleBaseCenterRatio <= 0.88,
        `${item.sprite} seam center ratio ${visibleBaseCenterRatio}`
      );
      const normalScale = mapping.nominalWidth / mapping.motifWidth;
      const sizeScore = Math.max(
        1,
        mapping.visibleWidth * normalScale / 38,
        mapping.visibleHeight * normalScale / 30
      );
      if (sizeScore <= 1.05) smallGoalSeamSelections++;
      if (sizeScore >= 1.75) largeGoalSeamSelections++;
    }
    propBaseIntervals.sort((left, right) => left[0] - right[0]);
    for (let index = 1; index < propBaseIntervals.length; index++) {
      assert.ok(
        propBaseIntervals[index][0] - propBaseIntervals[index - 1][1] >= 1 - 1e-9,
        "goal portal prop stand areas must not overlap"
      );
    }
    const startGoalItems = [...retryScene.topBackDecor, ...retryScene.topFrontDecor]
      .filter(item => item.role !== "FLOATING");
    for (const item of startGoalItems.filter(item => item.category === "MUSHROOMS")) {
      startGoalMushroomCoverage.add(item.sprite);
      assert.equal(item.nominalWidth, 40);
    }
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
      item.baselineOffset >= 6 &&
      item.baselineOffset <= 8 &&
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
      item.nominalWidth === 132
    )));
    for (const tree of startGoalTrees.filter(item => (
      item.sprite !== decorSpriteNamesByCategory.TREES[0]
    ))) {
      const visibleHeight = decorGridProfiles[tree.sprite].visibleBounds.h *
        (tree.nominalWidth / 448);
      assert.ok(visibleHeight >= 120, `${tree.sprite} must retain a hero-tree silhouette`);
    }
    assert.ok(startGoalItems.filter(item => (
      item.category === "BUSHES" && item.layer === "back"
    )).every(item => item.nominalWidth === 66));
    assert.ok(startGoalItems.filter(item => (
      item.category === "BUSHES" && item.layer === "front"
    )).every(item => item.nominalWidth === 34));
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
      assert.ok(
        item.sizeRole in meadowManifest.decor.gridV2.roleWidths[item.category],
        `${item.sprite} must use a generic category size role`
      );
      assert.equal(
        item.nominalWidth,
        meadowManifest.decor.gridV2.roleWidths[item.category][item.sizeRole],
        `${item.sprite} runtime width must come from its size role`
      );
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
  [...decorSpriteNamesByCategory.TREES].sort(),
  "all six fixed-grid tree variants should participate in retry layouts"
);
assert.deepEqual(
  [...floatingMushroomCoverage].sort(),
  mushroomGridSpriteNames,
  "all six fixed-grid Mushroom variants should participate in deterministic floating layouts"
);
assert.deepEqual(
  [...startGoalMushroomCoverage].sort(),
  mushroomGridSpriteNames,
  "all six fixed-grid Mushroom variants should participate in Start/Goal layouts"
);
for (let seed = 0; seed < 2000 && goalSeamCoverCoverage.size < 42; seed++) {
  const sweepScene = visualApi.getScene({
    seed: 10000 + seed,
    platforms: [{x: 1060, y: 370, w: 220, h: 350}]
  }, seed % 11);
  sweepScene.goalSeamCoverProps.forEach(item => goalSeamCoverCoverage.add(item.sprite));
}
assert.deepEqual(
  [...goalSeamCoverCoverage].sort(),
  [...normalGoalSeamDecorNames].sort(),
  "all 42 Meadow grid sprites must be eligible at the goal seam"
);
assert.ok(decorSpriteNamesByCategory.TREES.every(name => goalSeamCoverCoverage.has(name)));
const goalSeamSizeScore = mapping => {
  const scale = mapping.nominalWidth / mapping.motifWidth;
  return Math.max(
    1,
    mapping.visibleWidth * scale / 38,
    mapping.visibleHeight * scale / 30
  );
};
const smallGoalSeamCandidateCount = normalGoalSeamDecorNames.filter(name => (
  goalSeamSizeScore(goalSeamDecorMappings[name]) <= 1.05
)).length;
const largeGoalSeamCandidateCount = normalGoalSeamDecorNames.filter(name => (
  goalSeamSizeScore(goalSeamDecorMappings[name]) >= 1.75
)).length;
assert.ok(smallGoalSeamCandidateCount > 0 && largeGoalSeamCandidateCount > 0);
assert.ok(
  smallGoalSeamSelections / smallGoalSeamCandidateCount >
    largeGoalSeamSelections / largeGoalSeamCandidateCount,
  "size weighting must prefer small decor while retaining large decor"
);
assert.deepEqual(
  [...goalSeamCoverCounts].sort(),
  [2, 3, 4, 5],
  "goal seam-cover density must exercise the full 2-5 range"
);
assert.equal(imageConstructionCount, 26, "draw calls must not construct additional images");
assert.ok(drawCalls.length > 0);
assert.ok(
  drawCalls.every(call => call.length === 5 || call.length === 9),
  "asset draws must use standalone-image or source-slice overloads"
);

const topDecorMappings = Object.fromEntries(decorGridDefinitions.flatMap(
  definition => definition.sprites.map((name, index) => [
    name,
    [
      definition.asset.slice("decor_top_".length),
      [index % 3 * 512, Math.floor(index / 3) * 512, 512, 512],
      [256, 448],
      448
    ]
  ])
));
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
for (const [name, mapping] of Object.entries(topDecorMappings)) {
  const nominalWidth = goalSeamDecorMappings[name].nominalWidth;
  const item = {
    sprite: name,
    baselineX: 300,
    baselineY: 200,
    nominalWidth
  };
  drawCalls.length = 0;
  assert.equal(visualApi.drawTopBackDecor(fakeCanvasContext, {topBackDecor: [item]}), true);
  assert.equal(drawCalls.length, 1);
  const call = drawCalls[0];
  const scale = nominalWidth / 448;
  assert.deepEqual(call.slice(1, 5), mapping[1]);
  assert.deepEqual(mapping[1].slice(2), [512, 512]);
  assert.deepEqual(mapping[2], [256, 448]);
  assert.equal(mapping[3], 448);
  assert.equal(call[7], 512 * scale);
  assert.equal(call[8], 512 * scale);
  assert.ok(Math.abs(call[5] + 256 * scale - item.baselineX) < 1e-9);
  assert.ok(Math.abs(call[6] + 448 * scale - item.baselineY) < 1e-9);
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

assertTopDecorLayer(
  previewScene.goalSeamCoverProps,
  visualApi.drawGoalSeamCoverProps
);

const portalGoalPlatformY = 370;
const portalGoalFixture = {
  x: 1140,
  y: portalGoalPlatformY - 95,
  w: 62,
  h: 92
};
const portalLegacyDestination = [1081, portalGoalPlatformY - 169, 180, 191];
const portalDestinationHeight = 248 * 180 / 239;
const portalDestination = [
  1081,
  portalGoalPlatformY - 169 + 2.703876527,
  180,
  portalDestinationHeight
];
function capturePortalGlow(visualTime) {
  drawCalls.length = 0;
  radialGradientCalls.length = 0;
  radialGradientStops.length = 0;
  canvasOperationCalls.length = 0;
  canvasPropertyWrites.length = 0;
  assert.equal(visualApi.drawPortal(fakeCanvasContext, portalGoalFixture, visualTime), true);
  assert.equal(drawCalls.length, 1);
  assert.deepEqual(drawCalls[0].slice(1, 5), [9, 21, 239, 248]);
  assert.deepEqual(drawCalls[0].slice(5, 9), portalDestination);
  assert.ok(Math.abs(drawCalls[0][7] / 239 - drawCalls[0][8] / 248) < 1e-12);
  assert.deepEqual(radialGradientCalls, [[0, 0, 0, 0, 0, 60]]);
  assert.equal(radialGradientStops.length, 1);
  assert.deepEqual(radialGradientStops[0].map(stop => stop[0]), [0, 0.42, 1]);
  assert.ok(canvasOperationCalls.some(call => (
    call[0] === "translate" &&
    Math.abs(call[1] - (portalLegacyDestination[0] + 180 * 0.48)) < 1e-12 &&
    Math.abs(call[2] - (portalLegacyDestination[1] + 191 * 0.49)) < 1e-12
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
assert.ok(portalLegacyDestination[0] + 180 * 0.48 - 44 >= portalLegacyDestination[0]);
assert.ok(portalLegacyDestination[0] + 180 * 0.48 + 44 <= portalLegacyDestination[0] + 180);
assert.ok(portalLegacyDestination[1] + 191 * 0.49 - 60 >= portalLegacyDestination[1]);
assert.ok(portalLegacyDestination[1] + 191 * 0.49 + 60 <= portalLegacyDestination[1] + 191);
assert.equal(
  portalLegacyDestination[1] -
    (portalGoalFixture.y + portalGoalFixture.h + 15 - portalLegacyDestination[3]),
  10,
  "the visual-only portal lowering must be exactly ten pixels"
);
assert.ok(Math.abs(
  portalDestination[1] - portalLegacyDestination[1] - 2.703876527
) < 1e-12);
const portalVisibleAlphaBottom = portalDestination[1] + portalDestination[3];
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

for (const width of [40, 100, 138, 176]) {
  const floatingPlatform = {x: 420, y: 310, w: width, h: 26};
  const platformSnapshot = JSON.stringify(floatingPlatform);
  drawCalls.length = 0;
  assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, floatingPlatform), true);
  assert.equal(JSON.stringify(floatingPlatform), platformSnapshot);
  assert.equal(drawCalls.length, 1, "Whole Floating must use exactly one base draw");
  const mapping = JSON.parse(JSON.stringify(
    visualApi.getPlatformKit().getWholeFloatingMapping(floatingPlatform)
  ));
  assert.equal(drawCalls[0][0].src, wholeFloatingAssetPath);
  assert.deepEqual(drawCalls[0].slice(1, 5), [0, 0, 512, 128]);
  assert.deepEqual(drawCalls[0].slice(5), [
    mapping.drawX,
    mapping.drawY,
    mapping.drawWidth,
    mapping.drawHeight
  ]);
  assert.equal(mapping.visibleLeft, floatingPlatform.x);
  assert.equal(mapping.visibleRight, floatingPlatform.x + floatingPlatform.w);
  assert.equal(mapping.supportY, floatingPlatform.y);
  assert.equal(mapping.drawWidth / mapping.drawHeight, 4);
}

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
  {x: 360, y: 300, w: 123, h: 26, fade: true, fadeData: {x: 360, y: 300, w: 123, h: 26}},
  {x: 400, y: 300, w: 125, h: 26, spikePlatform: true, spikeData: {x: 400, y: 300, w: 125, h: 26}}
]) {
  assert.equal(visualApi.resolvePlatformRole(specialPlatform), "FLOATING");
  drawCalls.length = 0;
  assert.equal(visualApi.drawPlatformBase(fakeCanvasContext, specialPlatform, specialPlatform.x, 41), true);
  assert.equal(drawCalls.length, 1, "Moving, Fading and Spike base must use one Whole draw");
  assert.equal(drawCalls[0][0].src, wholeFloatingAssetPath);
}
for (const globalSpecialPlatform of [
  {x: 320, y: 300, w: 121, h: 26, fragile: true, fallingPlatform: {}},
  {x: 340, y: 300, w: 122, h: 26, conveyor: true, conveyorData: {}},
  {x: 380, y: 300, w: 124, h: 26, ice: true, iceData: {}}
]) {
  assert.equal(visualApi.resolvePlatformRole(globalSpecialPlatform), "FLOATING");
  drawCalls.length = 0;
  assert.equal(
    visualApi.drawPlatformBase(
      fakeCanvasContext,
      globalSpecialPlatform,
      globalSpecialPlatform.x,
      41
    ),
    false
  );
  assert.deepEqual(drawCalls, [], "global specials must remain on their dedicated renderers");
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
const platformKitSource = read("js/visual-platform-kit.js");
const decorKitSource = read("js/visual-decor-kit.js");
const portalKitSource = read("js/visual-portal-kit.js");
assert.doesNotMatch(
  visualSource,
  /drawMassivePlatform|BLOCK_BODY_TILES|BLOCK_TOP_STRIP|NineSlice|CoverageProbe/
);
assert.match(platformKitSource, /const PLATFORM_VISUAL_KIT_CONTRACT = Object\.freeze/);
assert.match(platformKitSource, /function drawWholeFloatingPlatform/);
assert.doesNotMatch(platformKitSource, /function drawLegacyFloatingPlatform/);
assert.match(platformKitSource, /function drawGoalPlatform/);
assert.match(visualSource, /const meadowPlatformKit = createPlatformVisualKit/);
assert.doesNotMatch(visualSource, /function drawFloatingPlatform|function drawGoalPlatform/);
assert.doesNotMatch(visualSource, /FLOAT_LEFT|FLOAT_MIDDLE|FLOAT_RIGHT/);
assert.doesNotMatch(visualSource, /START_PLATFORM: Object\.freeze\(\{x:/);
assert.doesNotMatch(visualSource, /GOAL_TOP: Object\.freeze\(\{x:/);
assert.doesNotMatch(visualSource, /GOAL_BODY_[A-F]|getGoalBodySprite/);
const standardPlatformSource = platformKitSource;
assert.doesNotMatch(standardPlatformSource, /fillRect|#65432d/);
assert.doesNotMatch(standardPlatformSource, /\.rotate\(/);
assert.match(standardPlatformSource, /context\.scale\(-1, 1\)/,
  "the shared Whole helper may mirror only explicitly direction-flipped assets");
assert.doesNotMatch(visualSource, /\.rotate\(|\.scale\(/);
assert.doesNotMatch(visualSource, /FLOATING_[123]/);
const topDecorPreviewSource = decorKitSource;
assert.doesNotMatch(topDecorPreviewSource, /Math\.random\(/);
assert.doesNotMatch(topDecorPreviewSource, /mushroomRedSingle|mushroomsRedPair/);
assert.doesNotMatch(
  topDecorPreviewSource,
  /standingAnchor|grassCompactFan|grassTallFan|grassWildArching|flowersWhiteDaisy|flowersLowMeadowMix|bushLayeredCluster|bushTallLeafy|stoneMossySingle|stoneMossyFlat|tuftSimpleFan|tuftBroadLeafFan|treeSaplingLeafy|treeRoundFlowering/
);
assert.match(decorKitSource, /function createGridSprite\(role, slotIndex\)/);
assert.match(decorKitSource, /x: slotIndex % contract\.columns \* contract\.slot\.w/);
assert.match(decorKitSource, /y: Math\.floor\(slotIndex \/ contract\.columns\) \* contract\.slot\.h/);
assert.match(decorKitSource, /anchor: contract\.anchor/);
assert.match(decorKitSource, /const backAnchor = layer === "back" \? sprite\.anchor : null/);
assert.match(decorKitSource, /const anchor = item\.anchor \?\? sprite\.anchor/);
assert.doesNotMatch(decorKitSource, /TREE|MUSHROOM/);

const rendererSource = read("js/renderer.js");
const rendererSpikeVisualStart = rendererSource.indexOf(
  "  function getSpikePlatformSlotVisual("
);
const rendererSpikeVisualEnd = rendererSource.indexOf(
  "  function drawSpikePlatformAsset(",
  rendererSpikeVisualStart
);
const rendererPlatformStart = rendererSource.indexOf("  function drawVectorPlatformSurface(");
const rendererPlatformEnd = rendererSource.indexOf("  function drawGoal(", rendererPlatformStart);
assert.ok(
  rendererSpikeVisualStart >= 0 && rendererSpikeVisualEnd > rendererSpikeVisualStart
);
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
  SPIKE_PLATFORM_SLOT_TRANSITION_DURATION: 0.12,
  SPIKE_PLATFORM_WARNING_DURATION: 0.62,
  SPIKE_PLATFORM_EXTEND_DURATION: 0.28,
  SPIKE_PLATFORM_DANGER_DURATION: 1.08,
  SPIKE_PLATFORM_RETRACT_DURATION: 0.30,
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
vm.runInContext(`${rendererSource.slice(rendererSpikeVisualStart, rendererSpikeVisualEnd)}
${rendererSource.slice(rendererPlatformStart, rendererPlatformEnd)}
  globalThis.drawPlatformsForTest = drawPlatforms;
`, rendererPlatformContext);
rendererPlatformContext.drawPlatformsForTest(
  {platform: {body: "#000", top: "#fff"}},
  rendererPlatformContext.MEADOW_ASSET_VISUALS
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
  rendererPlatformContext.MEADOW_ASSET_VISUALS,
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
  rendererPlatformContext.MEADOW_ASSET_VISUALS,
  "floating-only"
);
assert.deepEqual(
  rendererBaseCalls.map(call => call.platform.x),
  [420, 300, 360, 400],
  "the second Meadow pass must exclude the global Falling, Ice and Conveyor assets"
);

const guardStart = rendererSource.indexOf("  function getActiveVisualBiome");
const guardEnd = rendererSource.indexOf("  function drawEarthPlatformDetail", guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart);
const guardContext = vm.createContext({
  BIOMES: [{id: "meadow"}, {id: "coast"}],
  BIOME_PLATFORM_VISUALS: {
    resolve: biomeId => ({meadow: "meadow-kit", coast: "coast-kit"})[biomeId] ?? null
  },
  isTutorialStage: () => guardContext.tutorial,
  state: "playing",
  tutorial: false
});
vm.runInContext(`${rendererSource.slice(guardStart, guardEnd)}
  globalThis.guardForTest = getActiveBiomePlatformVisuals;
`, guardContext);
assert.equal(guardContext.guardForTest({id: "meadow"}), "meadow-kit");
guardContext.state = "menu";
assert.equal(guardContext.guardForTest({id: "meadow"}), null);
guardContext.state = "playing";
guardContext.tutorial = true;
assert.equal(guardContext.guardForTest({id: "coast"}), "meadow-kit");
guardContext.tutorial = false;
assert.equal(guardContext.guardForTest({id: "coast"}), "coast-kit");
assert.equal(guardContext.guardForTest({id: "desert"}), null);

const decorAttemptStart = rendererSource.indexOf("  let decorAttemptLevel");
const decorAttemptEnd = rendererSource.indexOf(
  "  function drawEarthPlatformDetail",
  decorAttemptStart
);
assert.ok(decorAttemptStart >= 0 && decorAttemptEnd > decorAttemptStart);
const decorAttemptContext = vm.createContext({lives: 3, shots: 0});
vm.runInContext(`${rendererSource.slice(decorAttemptStart, decorAttemptEnd)}
  globalThis.getDecorAttemptNonceForTest = getDecorAttemptNonce;
`, decorAttemptContext);
const attemptLevelA = {};
const attemptLevelB = {};
assert.equal(decorAttemptContext.getDecorAttemptNonceForTest(attemptLevelA), 0);
assert.equal(decorAttemptContext.getDecorAttemptNonceForTest(attemptLevelA), 0);
decorAttemptContext.shots = 2;
assert.equal(decorAttemptContext.getDecorAttemptNonceForTest(attemptLevelA), 0);
decorAttemptContext.shots = 0;
assert.equal(decorAttemptContext.getDecorAttemptNonceForTest(attemptLevelA), 1);
decorAttemptContext.lives = 2;
assert.equal(decorAttemptContext.getDecorAttemptNonceForTest(attemptLevelA), 2);
assert.equal(decorAttemptContext.getDecorAttemptNonceForTest(attemptLevelB), 0);

assert.match(
  rendererSource,
  /function drawPlatforms\([\s\S]*?platformRoleVisuals = platformVisuals[\s\S]*?\) \{/
);
assert.match(
  rendererSource,
  /!p\.lastBubbleSupport &&\s*platformVisuals\.drawPlatformBase/
);
assert.doesNotMatch(
  rendererSource,
  /standardPlatform &&\s*!p\.lastBubbleSupport/
);
for (const mechanicFlag of [
  "p.fragile",
  "p.conveyor",
  "p.fade",
  "p.ice",
  "p.spikePlatform"
]) {
  assert.ok(rendererSource.includes(mechanicFlag), `${mechanicFlag} overlay must remain`);
}
assert.doesNotMatch(rendererSource, /p\.moving && biomeAssetPlatform/);
assert.match(rendererSource, /platform\.moving[\s\S]*?\? "#5e7592"/);
assert.match(
  rendererSource,
  /for \(const s of level\.spikes\) drawDeathZone\(s, biome, platformVisuals\);/
);
assert.match(
  rendererSource,
  /drawTrajectory\(\);\s*drawTutorialAimLine\(\);\s*drawPlayer\(\);/
);
assert.match(
  rendererSource,
  /drawPlatforms\([\s\S]*?"without-floating"[\s\S]*?drawStartGoalBackDecor\?\.\(ctx, biomeDecorScene\);[\s\S]*?drawPlatforms\([\s\S]*?"floating-only"[\s\S]*?drawFloatingBackDecor\?\.\(ctx, biomeDecorScene\);[\s\S]*?drawGoal\(biomePlatformVisuals, biomePortalVisuals, biome\);[\s\S]*?drawGoalSeamCoverProps\?\.\(ctx, biomeDecorScene\);[\s\S]*?drawPlayer\(\);[\s\S]*?drawTopFrontDecor\?\.\(ctx, biomeDecorScene\);/
);
assert.match(
  rendererSource,
  /biomeDecorVisuals\.getScene\(\s*biomeDecorLevel,\s*getDecorAttemptNonce\(biomeDecorLevel\)\s*\)/
);
assert.match(
  rendererSource,
  /portalVisuals\.drawPortal\(ctx, g, worldTime\)/
);
assert.match(
  rendererSource,
  /portalVisuals\.drawPortal\(ctx, g, worldTime\)[\s\S]*?drawGoalTopForeground\([\s\S]*?level\.seed/
);
const html = read("index.html");
assert.match(
  html,
  /js\/tutorials\.js[\s\S]*?js\/visual-platform-kit\.js[\s\S]*?js\/visual-decor-kit\.js[\s\S]*?js\/visual-portal-kit\.js[\s\S]*?js\/visual-meadow-assets\.js[\s\S]*?js\/renderer\.js/
);

for (const [relativePath, expectedHash] of assetHashesBefore) {
  const actualHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
  assert.equal(actualHash, expectedHash, `${relativePath} was modified during the test`);
}

console.log("Meadow asset visual mutation, scope and level 1-10 geometry tests passed.");
