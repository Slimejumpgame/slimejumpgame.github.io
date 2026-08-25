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
const familyBAssets = ["coast_floating_platform"];
const expectedPaths = Object.fromEntries(
  [...familyAAssets, ...familyBAssets].map(asset => [
    asset,
    `${coastDirectory}/${asset}.png`
  ])
);
const expectedSizes = Object.fromEntries([
  ...familyAAssets.map(asset => [asset, {w: 352, h: 128}]),
  ["coast_floating_platform", {w: 512, h: 128}]
]);
const oldInvalidSizes = Object.freeze({
  [expectedPaths.coast_floating_platform]: [511, 128]
});
const newSizes = Object.freeze(Object.fromEntries(
  Object.entries(expectedSizes).map(([asset, size]) => (
    [expectedPaths[asset], [size.w, size.h]]
  ))
));

function createWholeFloatingPixels() {
  const width = 512;
  const pixels = Buffer.alloc(width * 128 * 4);
  pixels[(20 * width + 4) * 4 + 3] = 255;
  pixels[(109 * width + 507) * 4 + 3] = 255;
  for (let y = 34; y < 91; y++) {
    for (let x = 4; x <= 507; x++) pixels[(y * width + x) * 4 + 3] = 255;
  }
  return pixels;
}

function createContext(sizes, includeContentFit) {
  const pixelsByPath = includeContentFit
    ? {
        [expectedPaths.coast_floating_platform]: createWholeFloatingPixels()
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
    whole: {
      asset: "coast_floating_platform", w: 512, h: 128,
      source: {x: 0, y: 0, w: 512, h: 128}
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
const goalPlatform = {x: 1060, y: 370, w: 220, h: 350};
const floatingPlatform = {x: 420, y: 310, w: 138, h: 26};
assert.equal(oldInvalidApi.drawPlatformBase(drawContext, startPlatform, 0, 17), false);
assert.equal(drawCalls.length, 0, "missing Coast Family A must keep the vector fallback");
assert.equal(oldInvalidApi.drawPlatformBase(drawContext, floatingPlatform), false);
assert.equal(
  drawCalls.length,
  0,
  "an invalid Coast Whole asset must be rejected so the renderer uses its vector fallback"
);

const coastBasesOnlyContext = createContext({
  [expectedPaths.coast_top_base]: [352, 128],
  [expectedPaths.coast_body_base]: [352, 128]
}, false);
const coastBasesOnlyApi = coastBasesOnlyContext.coastKitTestApi;
const coastBasesOnlyStatus = JSON.parse(JSON.stringify(
  coastBasesOnlyApi.getStatus()
));
assert.equal(coastBasesOnlyStatus.familyAReady, false);
assert.equal(coastBasesOnlyStatus.topBaseReady, true);
assert.equal(coastBasesOnlyStatus.bodyBaseReady, true);
assert.deepEqual(coastBasesOnlyStatus.availableTopOverlays, []);
assert.deepEqual(coastBasesOnlyStatus.availableBodyOverlays, []);
drawCalls.length = 0;
assert.equal(
  coastBasesOnlyApi.drawPlatformBase(drawContext, startPlatform, 0, 17),
  true
);
assert.deepEqual(drawCalls.map(call => call[0].src), [expectedPaths.coast_top_base]);
drawCalls.length = 0;
assert.equal(
  coastBasesOnlyApi.drawPlatformBase(
    drawContext,
    goalPlatform,
    goalPlatform.x,
    17
  ),
  true
);
assert.equal(drawCalls[0][0].src, expectedPaths.coast_top_base);
assert.ok(drawCalls.slice(1).every(call => (
  call[0].src === expectedPaths.coast_body_base
)));

const newContext = createContext(newSizes, true);
const newApi = newContext.coastKitTestApi;
const newStatus = JSON.parse(JSON.stringify(newApi.getStatus()));
assert.equal(newStatus.ready, true);
assert.equal(newStatus.familyAReady, true);
assert.equal(newStatus.familyBReady, true);
assert.equal(newStatus.wholeFamilyBReady, true);
assert.deepEqual(newStatus.wholeFloatingContentFit, {
  analyzed: true,
  alphaThreshold: 8,
  supportRowMinimumCoverage: 0.9,
  visibleContentBounds: {x: 4, y: 20, w: 504, h: 90},
  supportY: 34,
  supportBand: {y: 34, h: 57}
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
assert.equal(drawCalls.length, 1, "whole Floating must be one unsliced draw");
assert.equal(drawCalls[0][0].src, expectedPaths.coast_floating_platform);
const mapping = JSON.parse(JSON.stringify(
  newApi.getWholeFloatingMapping(floatingPlatform)
));
assert.equal(mapping.scale, floatingPlatform.w / 504);
assert.equal(mapping.drawX + 4 * mapping.scale, floatingPlatform.x);
assert.equal(mapping.drawX + 508 * mapping.scale, floatingPlatform.x + floatingPlatform.w);
assert.equal(mapping.drawY + 34 * mapping.scale, floatingPlatform.y);
assert.equal(drawCalls[0][5], mapping.drawX);
assert.equal(drawCalls[0][6], mapping.drawY);
assert.equal(drawCalls[0][7], mapping.drawWidth);
assert.equal(drawCalls[0][8], mapping.drawHeight);

const source = read("js/visual-platform-kit.js");
assert.doesNotMatch(source, /Math\.random\(/);
assert.match(read("js/visual-meadow-assets.js"), /createPlatformVisualKit/);
const coastSource = read("js/visual-coast-assets.js");
assert.match(coastSource, /BIOME_PLATFORM_VISUALS\.resolve\("coast"\)/);
assert.doesNotMatch(coastSource, /LEGACY_COAST|SOURCE_SCALE|y:\s*22/);

console.log("Generic Meadow/Coast platform-kit configuration, sizing and fallback tests passed.");
