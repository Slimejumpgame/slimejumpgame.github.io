"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const coastDirectory = "assets/environments/coast/platforms";
const topAssets = Array.from({length: 6}, (_, index) => (
  `coast_overlay_top_0${index + 1}`
));
const bodyAssets = Array.from({length: 3}, (_, index) => (
  `coast_overlay_body_0${index + 1}`
));
const familyAAssets = ["coast_top_base", "coast_body_base", ...topAssets, ...bodyAssets];
const familyBAssets = [
  "coast_floating_left",
  "coast_floating_middle",
  "coast_floating_right"
];
const expectedPaths = Object.fromEntries(
  [...familyAAssets, ...familyBAssets].map(asset => [
    asset,
    `${coastDirectory}/${asset}.png`
  ])
);
const expectedSizes = Object.fromEntries([
  ...familyAAssets.map(asset => [asset, {w: 352, h: 128}]),
  ["coast_floating_left", {w: 128, h: 128}],
  ["coast_floating_middle", {w: 256, h: 128}],
  ["coast_floating_right", {w: 128, h: 128}]
]);
const oldInvalidSizes = Object.freeze({
  [expectedPaths.coast_floating_left]: [112, 127],
  [expectedPaths.coast_floating_middle]: [300, 127],
  [expectedPaths.coast_floating_right]: [108, 127]
});
const newSizes = Object.freeze(Object.fromEntries(
  Object.entries(expectedSizes).map(([asset, size]) => (
    [expectedPaths[asset], [size.w, size.h]]
  ))
));

function createFloatingPixels(width) {
  const pixels = Buffer.alloc(width * 128 * 4);
  for (let y = 24; y <= 102; y++) pixels[y * width * 4 + 3] = 255;
  for (let y = 34; y <= 84; y++) {
    for (let x = 0; x < width; x++) pixels[(y * width + x) * 4 + 3] = 255;
  }
  return pixels;
}

function createContext(sizes, includeContentFit) {
  const pixelsByPath = includeContentFit
    ? {
        [expectedPaths.coast_floating_left]: createFloatingPixels(128),
        [expectedPaths.coast_floating_middle]: createFloatingPixels(256),
        [expectedPaths.coast_floating_right]: createFloatingPixels(128)
      }
    : {};
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
      this.pixelData = pixelsByPath[value];
      (size ? this.onload : this.onerror)?.();
    }

    get src() {
      return this._src;
    }
  }
  const document = includeContentFit
    ? {
        createElement(type) {
          assert.equal(type, "canvas");
          let image = null;
          return {
            getContext() {
              return {
                clearRect() {},
                drawImage(nextImage) { image = nextImage; },
                getImageData() { return {data: image.pixelData}; }
              };
            }
          };
        }
      }
    : undefined;
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Platform-kit selection must not consume Math.random()");
  };
  const context = vm.createContext({
    Image: FakeImage,
    Math: visualMath,
    Promise,
    ...(document ? {document} : {})
  });
  vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-coast-assets.js")}
    globalThis.coastKitTestApi = COAST_ASSET_VISUALS;
    globalThis.registeredCoastKit = BIOME_PLATFORM_VISUALS.resolve("coast");
  `, context, {filename: "coast-platform-kit-fixture.js"});
  return context;
}

const oldInvalidContext = createContext(oldInvalidSizes, false);
const oldInvalidApi = oldInvalidContext.coastKitTestApi;
const oldInvalidStatus = JSON.parse(JSON.stringify(oldInvalidApi.getStatus()));
const coastManifest = JSON.parse(JSON.stringify(oldInvalidApi.getManifest()));
assert.equal(oldInvalidContext.registeredCoastKit, oldInvalidApi);
assert.deepEqual(oldInvalidStatus.paths, expectedPaths);
assert.deepEqual(oldInvalidStatus.expectedNativeSizes, expectedSizes);
assert.equal(oldInvalidStatus.ready, false);
assert.equal(oldInvalidStatus.familyAReady, false);
assert.equal(oldInvalidStatus.familyBReady, false);
assert.equal(oldInvalidApi.areAllReady(), false);
assert.deepEqual(coastManifest.kit.familyA.source, {x: 0, y: 0, w: 352, h: 128});
assert.equal(coastManifest.kit.familyA.topOverlays.length, 6);
assert.equal(coastManifest.kit.familyA.bodyOverlays.length, 3);
assert.deepEqual(
  coastManifest.kit.familyB,
  {
    left: {
      asset: "coast_floating_left", w: 128, h: 128,
      source: {x: 0, y: 0, w: 128, h: 128}
    },
    middle: {
      asset: "coast_floating_middle", w: 256, h: 128,
      source: {x: 0, y: 0, w: 256, h: 128}
    },
    right: {
      asset: "coast_floating_right", w: 128, h: 128,
      source: {x: 0, y: 0, w: 128, h: 128}
    }
  }
);

const drawCalls = [];
const drawContext = new Proxy({
  save() {}, restore() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {},
  clip() {}, rect() {}, stroke() {},
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
const startPlatform = {x: 0, y: 640, w: 235, h: 80};
const floatingPlatform = {x: 420, y: 310, w: 138, h: 26};
assert.equal(oldInvalidApi.drawPlatformBase(drawContext, startPlatform, 0, 17), false);
assert.equal(drawCalls.length, 0, "missing Coast Family A must keep the vector fallback");
assert.equal(oldInvalidApi.drawPlatformBase(drawContext, floatingPlatform), false);
assert.equal(
  drawCalls.length,
  0,
  "old Coast floating sizes must be rejected so the renderer uses its vector fallback"
);

const newContext = createContext(newSizes, true);
const newApi = newContext.coastKitTestApi;
const newStatus = JSON.parse(JSON.stringify(newApi.getStatus()));
assert.equal(newStatus.ready, true);
assert.equal(newStatus.familyAReady, true);
assert.equal(newStatus.familyBReady, true);
assert.deepEqual(newStatus.floatingContentFit, {
  analyzed: true,
  alphaThreshold: 8,
  bodyRowMinimumCoverage: 0.5,
  topOverhang: 2,
  bottomOverhang: 3,
  topDecorSource: {y: 24, h: 10},
  bodySource: {y: 34, h: 51},
  bottomDecorSource: {y: 85, h: 18}
});

for (let seed = 0; seed < 100; seed++) {
  const top = JSON.parse(JSON.stringify(newApi.getTopOverlaySelection(seed)));
  const body = JSON.parse(JSON.stringify(newApi.getBodyOverlaySelection(seed)));
  assert.notEqual(top.startIndex, top.goalIndex);
  assert.equal(top.startAsset, topAssets[top.startIndex]);
  assert.equal(top.goalAsset, topAssets[top.goalIndex]);
  assert.equal(body.goalAsset, bodyAssets[body.goalIndex]);
}

drawCalls.length = 0;
assert.equal(newApi.drawPlatformBase(drawContext, startPlatform, 0, 17), true);
assert.deepEqual(
  drawCalls.map(call => call[0].src),
  [expectedPaths.coast_top_base, expectedPaths[newApi.getTopOverlaySelection(17).startAsset]]
);
drawCalls.length = 0;
assert.equal(newApi.drawPlatformBase(drawContext, floatingPlatform), true);
assert.ok(drawCalls.length > 3);
assert.ok(drawCalls.some(call => call[2] === 34 && call[4] === 51));
assert.ok(drawCalls.every(call => call[2] !== 22));

const source = read("js/visual-platform-kit.js");
assert.doesNotMatch(source, /Math\.random\(/);
assert.match(read("js/visual-meadow-assets.js"), /createPlatformVisualKit/);
const coastSource = read("js/visual-coast-assets.js");
assert.match(coastSource, /createPlatformVisualKit/);
assert.doesNotMatch(coastSource, /LEGACY_COAST|SOURCE_SCALE|y:\s*22/);

console.log("Generic Meadow/Coast platform-kit configuration, sizing and fallback tests passed.");
