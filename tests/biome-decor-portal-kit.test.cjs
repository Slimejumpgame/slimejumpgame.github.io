"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const decorSource = read("js/visual-decor-kit.js");
const portalSource = read("js/visual-portal-kit.js");

function createDecorContext(sizes) {
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
      const size = sizes[value];
      this.complete = Boolean(size);
      this.naturalWidth = size?.[0] ?? 0;
      this.naturalHeight = size?.[1] ?? 0;
      (size ? this.onload : this.onerror)?.();
    }

    get src() {
      return this._src;
    }
  }

  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("generic decor must not consume Math.random()");
  };
  const context = vm.createContext({Image: FakeImage, Math: visualMath, Promise});
  vm.runInContext(`${decorSource}
    globalThis.decorRegistryForTest = BIOME_DECOR_VISUALS;
  `, context, {filename: "generic-decor-kit-fixture.js"});
  return context;
}

const coastDecorDirectory = "assets/environments/coast/decor";
const coastRolePath = role => (
  `${coastDecorDirectory}/coast_decor_${role}_set_01.png`
);
const snowDecorDirectory = "assets/environments/snow/decor";
const snowRolePath = role => (
  `${snowDecorDirectory}/snow_decor_${role}_set_01.png`
);
const levelFixture = seed => ({
  seed,
  platforms: [
    {x: 0, y: 640, w: 235, h: 80},
    {x: 420, y: 360, w: 170, h: 26},
    {x: 1060, y: 370, w: 220, h: 350}
  ]
});

const snowDecorContext = createDecorContext({
  [snowRolePath("stones")]: [1536, 1024],
  [snowRolePath("hero")]: [1536, 1023]
});
const snowDecor = snowDecorContext.decorRegistryForTest.resolve("snow");
const snowDecorStatus = JSON.parse(JSON.stringify(snowDecor.getStatus()));
assert.equal(snowDecorStatus.paths.stones, snowRolePath("stones"));
assert.ok(Object.values(snowDecorStatus.paths).every(value => (
  value.includes("/snow/") && !value.includes("/meadow/") && !value.includes("/coast/")
)));
assert.deepEqual(snowDecorStatus.expectedNativeSize, {w: 1536, h: 1024});
assert.deepEqual(snowDecorStatus.availableRoles, ["stones"]);
assert.equal(snowDecorStatus.validNativeSizes.stones, true);
assert.equal(snowDecorStatus.validNativeSizes.hero, false);

let snowDecorScene = null;
for (let seed = 1; seed <= 100; seed++) {
  const scene = snowDecor.getScene(levelFixture(seed));
  const items = [
    ...scene.topBackDecor,
    ...scene.topFrontDecor,
    ...scene.goalSeamCoverProps
  ];
  if (items.length > 0) {
    snowDecorScene = scene;
    break;
  }
}
assert.ok(snowDecorScene, "a valid standard Snow decor role must be selectable");
assert.equal(snowDecorScene.biome, "snow");
assert.ok([
  ...snowDecorScene.topBackDecor,
  ...snowDecorScene.topFrontDecor,
  ...snowDecorScene.goalSeamCoverProps
].every(item => item.category === "stones"));
const snowDecorDrawCalls = [];
const snowDecorCanvas = {
  save() {},
  restore() {},
  drawImage(...args) { snowDecorDrawCalls.push(args); }
};
snowDecor.drawTopBackDecor(snowDecorCanvas, snowDecorScene);
snowDecor.drawGoalSeamCoverProps(snowDecorCanvas, snowDecorScene);
snowDecor.drawTopFrontDecor(snowDecorCanvas, snowDecorScene);
assert.ok(snowDecorDrawCalls.length > 0);
assert.ok(snowDecorDrawCalls.every(call => call[0].src === snowRolePath("stones")));

const snowContextCoast = snowDecorContext.decorRegistryForTest.resolve("coast");
assert.notEqual(snowContextCoast, snowDecor);
assert.deepEqual(
  JSON.parse(JSON.stringify(snowContextCoast.getStatus().availableRoles)),
  []
);
assert.equal(snowContextCoast.isRoleReady("stones"), false);

const heroOnlyContext = createDecorContext({
  [coastRolePath("hero")]: [1536, 1024],
  [coastRolePath("stones")]: [1535, 1024]
});
const heroOnly = heroOnlyContext.decorRegistryForTest.resolve("coast");
const heroOnlyStatus = JSON.parse(JSON.stringify(heroOnly.getStatus()));
assert.deepEqual(heroOnlyStatus.paths, Object.fromEntries([
  "groundcover", "small_flora", "small_props", "bushes", "stones", "tufts", "hero"
].map(role => [role, coastRolePath(role)])));
assert.deepEqual(heroOnlyStatus.expectedNativeSize, {w: 1536, h: 1024});
assert.deepEqual(heroOnlyStatus.availableRoles, ["hero"]);
assert.equal(heroOnlyStatus.validNativeSizes.stones, false);
assert.equal(heroOnly.areAllReady(), false);

let heroScene = null;
for (let seed = 1; seed <= 100; seed++) {
  const scene = heroOnly.getScene(levelFixture(seed));
  if (scene.topBackDecor.some(item => item.category === "hero")) {
    heroScene = scene;
    break;
  }
}
assert.ok(heroScene, "an available hero-only sheet must participate in Start/Goal decor");
assert.equal(heroScene.biome, "coast");
assert.equal(heroScene.topFrontDecor.length, 0);
assert.ok(heroScene.topBackDecor.every(item => (
  item.category === "hero" && item.role !== "FLOATING" && item.layer === "back"
)));
assert.ok(heroScene.goalSeamCoverProps.length >= 2);
assert.ok(heroScene.goalSeamCoverProps.every(item => item.category === "hero"));

const heroDrawCalls = [];
const decorCanvas = {
  save() {},
  restore() {},
  drawImage(...args) { heroDrawCalls.push(args); }
};
assert.equal(heroOnly.drawStartGoalBackDecor(decorCanvas, heroScene), true);
assert.equal(heroOnly.drawGoalSeamCoverProps(decorCanvas, heroScene), true);
assert.ok(heroDrawCalls.length > 0);
assert.ok(heroDrawCalls.every(call => call[0].src === coastRolePath("hero")));
assert.ok(heroDrawCalls.every(call => !call[0].src.includes("/meadow/")));

const stonesOnlyContext = createDecorContext({
  [coastRolePath("stones")]: [1536, 1024]
});
const stonesOnly = stonesOnlyContext.decorRegistryForTest.resolve("coast");
const stonesScene = stonesOnly.getScene(levelFixture(73));
assert.deepEqual(
  JSON.parse(JSON.stringify(stonesOnly.getStatus().availableRoles)),
  ["stones"]
);
assert.ok(stonesScene.topBackDecor.some(item => item.role === "FLOATING"));
assert.ok(stonesScene.topBackDecor.every(item => item.category === "stones"));
assert.ok(stonesScene.topFrontDecor.every(item => item.category === "stones"));
assert.ok(stonesScene.goalSeamCoverProps.every(item => item.category === "stones"));
const stonesDrawCalls = [];
stonesOnly.drawTopBackDecor({
  save() {}, restore() {}, drawImage(...args) { stonesDrawCalls.push(args); }
}, stonesScene);
assert.ok(stonesDrawCalls.length > 0);
assert.ok(stonesDrawCalls.every(call => call[0].src === coastRolePath("stones")));

const smallPropsOnlyContext = createDecorContext({
  [coastRolePath("small_props")]: [1536, 1024]
});
const smallPropsOnly = smallPropsOnlyContext.decorRegistryForTest.resolve("coast");
const smallPropsScene = smallPropsOnly.getScene(levelFixture(47));
assert.ok([
  ...smallPropsScene.topBackDecor,
  ...smallPropsScene.topFrontDecor,
  ...smallPropsScene.goalSeamCoverProps
].every(item => item.category === "small_props"));
assert.ok(smallPropsScene.topBackDecor.some(item => item.role === "FLOATING"));

const combinedContext = createDecorContext({
  [coastRolePath("hero")]: [1536, 1024],
  [coastRolePath("stones")]: [1536, 1024]
});
const combinedCoast = combinedContext.decorRegistryForTest.resolve("coast");
assert.deepEqual(
  JSON.parse(JSON.stringify(combinedCoast.getStatus().availableRoles)),
  ["stones", "hero"]
);
const stableLevel = levelFixture(91);
assert.equal(combinedCoast.getScene(stableLevel), combinedCoast.getScene(stableLevel));
assert.deepEqual(
  JSON.parse(JSON.stringify(combinedCoast.getScene(levelFixture(91)))),
  JSON.parse(JSON.stringify(combinedCoast.getScene(levelFixture(91))))
);
const syntheticMeadow = combinedContext.decorRegistryForTest.resolve("meadow");
assert.notEqual(syntheticMeadow, combinedCoast);
assert.equal(combinedCoast.getScene(stableLevel).biome, "coast");
assert.equal(syntheticMeadow.getScene(stableLevel).biome, "meadow");
assert.equal(combinedCoast.getScene(stableLevel).biome, "coast");
assert.ok(Object.values(combinedCoast.getStatus().paths).every(value => (
  value.includes("/coast/") && !value.includes("/meadow/")
)));

const meadowSource = read("js/visual-meadow-assets.js");
for (const [role, legacySuffix] of Object.entries({
  groundcover: "grass",
  small_flora: "flowers",
  small_props: "mushrooms",
  bushes: "bushes",
  stones: "stones",
  tufts: "tufts",
  hero: "trees"
})) {
  const assetKey = `decor_top_${legacySuffix}`;
  assert.match(meadowSource, new RegExp(
    `${role}:[\\s\\S]*?path: ASSET_PATHS\\.${assetKey}`
  ));
  assert.match(meadowSource, new RegExp(
    `${assetKey}: "assets/environments/meadow/decor/top/meadow_decor_top_${legacySuffix}_set_01\\.png"`
  ));
}
assert.match(meadowSource, /BIOME_DECOR_VISUALS\.register\("meadow", meadowDecorKit\)/);
assert.doesNotMatch(decorSource, /assets\/environments\/meadow\/decor\/top/);
assert.doesNotMatch(decorSource, /Math\.random\(/);
assert.doesNotMatch(decorSource, /TREE|MUSHROOM/);

function decodeRgba8Png(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const stride = width * 4;
  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left, up, upperLeft) => {
    const candidate = left + up - upperLeft;
    const leftDistance = Math.abs(candidate - left);
    const upDistance = Math.abs(candidate - up);
    const upperLeftDistance = Math.abs(candidate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0, sourceOffset = 0; y < height; y++) {
    const filter = inflated[sourceOffset++];
    for (let x = 0; x < stride; x++, sourceOffset++) {
      const raw = inflated[sourceOffset];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + up
            : filter === 3 ? raw + Math.floor((left + up) / 2)
              : raw + paeth(left, up, upperLeft);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return {width, height, pixels};
}

const meadowPortalPath = "assets/environments/meadow/portal/meadow_goal_portal.png";
const coastPortalPath = "assets/environments/coast/portal/coast_goal_portal.png";
const snowPortalPath = "assets/environments/snow/portal/snow_goal_portal.png";
const snowPortalContentBounds = Object.freeze({x: 24, y: 32, w: 180, h: 208});

function createSyntheticPortalPixels(width, height, bounds) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 224;
      pixels[offset + 1] = 240;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

const decodedPortals = Object.freeze({
  [meadowPortalPath]: decodeRgba8Png(meadowPortalPath),
  [coastPortalPath]: decodeRgba8Png(coastPortalPath),
  [snowPortalPath]: Object.freeze({
    width: 256,
    height: 272,
    pixels: createSyntheticPortalPixels(256, 272, snowPortalContentBounds)
  })
});

class PortalImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
    const decoded = decodedPortals[value];
    const invalid = value.includes("/desert/");
    this.complete = Boolean(decoded) || invalid;
    this.naturalWidth = decoded?.width ?? (invalid ? 128 : 0);
    this.naturalHeight = decoded?.height ?? (invalid ? 128 : 0);
    this.pixelData = decoded?.pixels;
    (this.complete ? this.onload : this.onerror)?.();
  }

  get src() {
    return this._src;
  }
}

const portalDocument = {
  createElement(type) {
    assert.equal(type, "canvas");
    let drawnImage = null;
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          clearRect() {},
          drawImage(image) { drawnImage = image; },
          getImageData() { return {data: drawnImage.pixelData}; }
        };
      }
    };
  }
};
const portalContext = vm.createContext({
  Image: PortalImage,
  Math,
  Promise,
  document: portalDocument
});
vm.runInContext(`${portalSource}
  globalThis.portalRegistryForTest = BIOME_PORTAL_VISUALS;
`, portalContext, {filename: "generic-portal-kit-fixture.js"});
const meadowPortal = portalContext.portalRegistryForTest.resolve("meadow");
const coastPortal = portalContext.portalRegistryForTest.resolve("coast");
const snowPortal = portalContext.portalRegistryForTest.resolve("snow");
assert.deepEqual(
  JSON.parse(JSON.stringify(meadowPortal.getStatus().contentBounds)),
  {x: 9, y: 21, w: 239, h: 248}
);
assert.deepEqual(
  JSON.parse(JSON.stringify(coastPortal.getStatus().contentBounds)),
  {x: 16, y: 14, w: 230, h: 256}
);
assert.deepEqual(
  JSON.parse(JSON.stringify(snowPortal.getStatus().contentBounds)),
  snowPortalContentBounds
);
assert.equal(meadowPortal.getStatus().path, meadowPortalPath);
assert.equal(coastPortal.getStatus().path, coastPortalPath);
assert.equal(snowPortal.getStatus().path, snowPortalPath);
assert.equal(snowPortal.getStatus().validNativeSize, true);

function capturePortal(api, visualTime = 0.55) {
  const drawCalls = [];
  const gradients = [];
  const context = new Proxy({
    save() {},
    restore() {},
    drawImage(...args) { drawCalls.push(args); },
    createRadialGradient() {
      const stops = [];
      gradients.push(stops);
      return {addColorStop: (...stop) => stops.push(stop)};
    }
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
  const goal = {x: 1140, y: 275, w: 62, h: 92};
  return {result: api.drawPortal(context, goal, visualTime), drawCalls, gradients};
}

const meadowPortalDraw = capturePortal(meadowPortal);
const coastPortalDraw = capturePortal(coastPortal);
const snowPortalDraw = capturePortal(snowPortal);
assert.equal(meadowPortalDraw.result, true);
assert.equal(coastPortalDraw.result, true);
assert.equal(snowPortalDraw.result, true);
assert.equal(meadowPortalDraw.drawCalls[0][0].src, meadowPortalPath);
assert.equal(coastPortalDraw.drawCalls[0][0].src, coastPortalPath);
assert.equal(snowPortalDraw.drawCalls[0][0].src, snowPortalPath);
assert.deepEqual(meadowPortalDraw.drawCalls[0].slice(1, 5), [9, 21, 239, 248]);
assert.deepEqual(coastPortalDraw.drawCalls[0].slice(1, 5), [16, 14, 230, 256]);
assert.deepEqual(snowPortalDraw.drawCalls[0].slice(1, 5), [24, 32, 180, 208]);
assert.deepEqual(meadowPortalDraw.drawCalls[0].slice(5), [
  1081,
  203.703876527,
  180,
  248 * 180 / 239
]);
assert.equal(coastPortalDraw.drawCalls[0][5], 1081);
assert.equal(coastPortalDraw.drawCalls[0][7], 180);
assert.ok(Math.abs(
  coastPortalDraw.drawCalls[0][8] - 256 * 180 / 230
) < 1e-12);
const meadowBottom = meadowPortalDraw.drawCalls[0][6] + meadowPortalDraw.drawCalls[0][8];
const coastBottom = coastPortalDraw.drawCalls[0][6] + coastPortalDraw.drawCalls[0][8];
assert.ok(Math.abs(meadowBottom - coastBottom) < 1e-12);
assert.deepEqual(meadowPortalDraw.gradients[0].map(stop => stop[0]), [0, 0.42, 1]);
assert.deepEqual(coastPortalDraw.gradients[0].map(stop => stop[0]), [0, 0.42, 1]);
assert.deepEqual(snowPortalDraw.gradients[0].map(stop => stop[0]), [0, 0.42, 1]);
assert.ok(snowPortalDraw.drawCalls.every(call => ![
  meadowPortalPath,
  coastPortalPath
].includes(call[0]?.src)));

const missingPortal = portalContext.portalRegistryForTest.resolve("tundra");
const invalidPortal = portalContext.portalRegistryForTest.resolve("desert");
assert.equal(missingPortal.isReady(), false);
assert.equal(invalidPortal.isReady(), false);
const missingPortalDraw = capturePortal(missingPortal);
const invalidPortalDraw = capturePortal(invalidPortal);
assert.equal(missingPortalDraw.result, false);
assert.equal(invalidPortalDraw.result, false);
assert.equal(missingPortalDraw.drawCalls.length, 0);
assert.equal(invalidPortalDraw.drawCalls.length, 0);
assert.ok(Object.values(coastPortal.getStatus()).every(value => (
  typeof value !== "string" || !value.includes("/meadow/")
)));
assert.equal(missingPortal.getStatus().path,
  "assets/environments/tundra/portal/tundra_goal_portal.png");
assert.equal(invalidPortal.getStatus().path,
  "assets/environments/desert/portal/desert_goal_portal.png");

const rendererSource = read("js/renderer.js");
assert.match(rendererSource, /BIOME_DECOR_VISUALS\.resolve\(biome\.id\)/);
assert.match(rendererSource, /BIOME_PORTAL_VISUALS\.resolve\(biome\.id\)/);
assert.match(rendererSource, /function drawGoal\(\s*platformVisuals = null,\s*portalVisuals = null,\s*biome = null\s*\)/);
assert.match(rendererSource, /drawGoal\(biomePlatformVisuals, biomePortalVisuals, biome\)/);
assert.match(rendererSource, /const goalBiome = biome \?\? getBiomeForLevel\(levelIndex \+ 1\)/);
assert.match(rendererSource, /portalVisuals\.drawPortal\(ctx, g, worldTime\)/);
assert.match(rendererSource, /if \(!biomeAssetPortal\) \{/);
assert.doesNotMatch(rendererSource, /getMeadowDecorAttemptNonce|meadowDecorAttempt/);
assert.doesNotMatch(portalSource, /assets\/environments\/meadow|assets\/environments\/coast/);

console.log("Generic biome-isolated Decor and Portal kit tests passed.");
