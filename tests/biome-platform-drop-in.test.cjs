"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const platformKitSource = fs.readFileSync(
  path.join(root, "js/visual-platform-kit.js"),
  "utf8"
);
const rendererSource = fs.readFileSync(
  path.join(root, "js/renderer.js"),
  "utf8"
);

function getStandardContract(biome) {
  const directory = `assets/environments/${biome}/platforms`;
  const topOverlays = Array.from({length: 6}, (_, index) => (
    `${biome}_overlay_top_${String(index + 1).padStart(2, "0")}`
  ));
  const bodyOverlays = Array.from({length: 3}, (_, index) => (
    `${biome}_overlay_body_${String(index + 1).padStart(2, "0")}`
  ));
  const assets = [
    `${biome}_top_base`,
    `${biome}_body_base`,
    ...topOverlays,
    ...bodyOverlays,
    `${biome}_floating_platform`
  ];
  const paths = Object.fromEntries(assets.map(asset => [
    asset,
    `${directory}/${asset}.png`
  ]));
  const sizes = Object.fromEntries(assets.map(asset => {
    const width = asset.endsWith("_floating_platform") ? 512 : 352;
    return [asset, {w: width, h: 128}];
  }));
  return {assets, topOverlays, bodyOverlays, paths, sizes};
}

function createWholeFloatingPixels(width = 512, height = 128) {
  const pixels = Buffer.alloc(width * height * 4);
  pixels[(20 * width + 4) * 4 + 3] = 255;
  pixels[(109 * width + 507) * 4 + 3] = 255;
  for (let y = 34; y < 91; y++) {
    for (let x = 4; x <= 507; x++) {
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  return pixels;
}

function createRuntime(sizesByPath = {}, options = {}) {
  const requestedPaths = [];

  class FakeImage {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.onload = null;
      this.onerror = null;
      this.pixelData = null;
    }

    set src(value) {
      this._src = value;
      requestedPaths.push(value);
      const size = sizesByPath[value];
      if (!size) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      this.naturalWidth = size[0];
      this.naturalHeight = size[1];
      if (/_floating_platform\.png$/.test(value)) {
        this.pixelData = options.emptyWhole
          ? Buffer.alloc(size[0] * size[1] * 4)
          : createWholeFloatingPixels(size[0], size[1]);
      }
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const document = {
    createElement(type) {
      assert.equal(type, "canvas");
      let image = null;
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            clearRect() {},
            drawImage(nextImage) {
              image = nextImage;
            },
            getImageData() {
              assert.ok(image?.pixelData, "floating analysis needs synthetic alpha data");
              return {data: image.pixelData};
            }
          };
        }
      };
    }
  };
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => {
    throw new Error("Platform visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    Image: FakeImage,
    Math: deterministicMath,
    Promise,
    document
  });
  vm.runInContext(`${platformKitSource}
    globalThis.platformDropInApi = Object.freeze({
      resolve: biomeId => BIOME_PLATFORM_VISUALS.resolve(biomeId)
    });
  `, context, {filename: "visual-platform-kit-drop-in-fixture.js"});
  return {
    resolve: context.platformDropInApi.resolve,
    requestedPaths
  };
}

function sizesFor(contract, validAssets, overrides = {}) {
  return Object.fromEntries(validAssets.map(asset => {
    const expected = contract.sizes[asset];
    const size = overrides[asset] ?? [expected.w, expected.h];
    return [contract.paths[asset], size];
  }));
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDrawRecorder() {
  const calls = [];
  const context = new Proxy({
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    clip() {},
    rect() {},
    stroke() {},
    drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight,
      destinationX, destinationY, destinationWidth, destinationHeight) {
      calls.push({
        path: image.src,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight
      });
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
  return {context, calls};
}

const snow = getStandardContract("snow");

// Unknown standard biomes are created lazily, cached per biome, and never share assets.
const allSnowSizes = sizesFor(snow, snow.assets);
const lazyRuntime = createRuntime(allSnowSizes);
assert.deepEqual(lazyRuntime.requestedPaths, []);
const snowKit = lazyRuntime.resolve("snow");
assert.deepEqual(
  lazyRuntime.requestedPaths,
  snow.assets.map(asset => snow.paths[asset])
);
const snowStatus = snapshot(snowKit.getStatus());
assert.deepEqual(snowStatus.paths, snow.paths);
assert.deepEqual(snowStatus.expectedNativeSizes, snow.sizes);
assert.equal(snowStatus.ready, true);
assert.equal(snowStatus.wholeFamilyBReady, true);
assert.equal(lazyRuntime.resolve("snow"), snowKit);
assert.equal(lazyRuntime.resolve(" snow "), snowKit);
assert.equal(lazyRuntime.requestedPaths.length, snow.assets.length);

const volcano = getStandardContract("volcano");
const volcanoKit = lazyRuntime.resolve("volcano");
assert.notEqual(volcanoKit, snowKit);
assert.deepEqual(
  lazyRuntime.requestedPaths.slice(snow.assets.length),
  volcano.assets.map(asset => volcano.paths[asset])
);
const volcanoStatus = snapshot(volcanoKit.getStatus());
assert.deepEqual(volcanoStatus.paths, volcano.paths);
assert.equal(volcanoStatus.ready, false);
assert.equal(volcanoStatus.familyAReady, false);
assert.equal(volcanoStatus.familyBReady, false);
assert.equal(snapshot(snowKit.getStatus()).ready, true);
assert.ok(Object.values(volcanoStatus.validNativeSizes).every(value => value === false));

// Family A uses valid Top and Body bases independently through renderer-style regions.
const goalPlatform = {x: 1060, y: 100, w: 220, h: 260};
const topOnlyRuntime = createRuntime(sizesFor(snow, ["snow_top_base"]));
const topOnlyKit = topOnlyRuntime.resolve("snow");
const topOnlyDraw = createDrawRecorder();
const topOnlyFallbackRegions = [];
assert.equal(topOnlyKit.drawPlatformBase(
  topOnlyDraw.context,
  goalPlatform,
  goalPlatform.x,
  73,
  region => topOnlyFallbackRegions.push(snapshot(region))
), true);
assert.deepEqual(topOnlyDraw.calls.map(call => call.path), [snow.paths.snow_top_base]);
assert.deepEqual(topOnlyFallbackRegions, [{x: 1060, y: 179, w: 220, h: 181}]);
assert.equal(topOnlyKit.getStatus().topBaseReady, true);
assert.equal(topOnlyKit.getStatus().bodyBaseReady, false);

const bodyOnlyRuntime = createRuntime(sizesFor(snow, ["snow_body_base"]));
const bodyOnlyKit = bodyOnlyRuntime.resolve("snow");
const bodyOnlyDraw = createDrawRecorder();
const bodyOnlyFallbackRegions = [];
assert.equal(bodyOnlyKit.drawPlatformBase(
  bodyOnlyDraw.context,
  goalPlatform,
  goalPlatform.x,
  73,
  region => bodyOnlyFallbackRegions.push(snapshot(region))
), true);
assert.ok(bodyOnlyDraw.calls.length > 0);
assert.ok(bodyOnlyDraw.calls.every(call => call.path === snow.paths.snow_body_base));
assert.deepEqual(bodyOnlyFallbackRegions, [{x: 1060, y: 100, w: 220, h: 80}]);
assert.equal(bodyOnlyKit.getStatus().topBaseReady, false);
assert.equal(bodyOnlyKit.getStatus().bodyBaseReady, true);

// Zero, one, or two sparse overlays are selected only from valid native-size slots.
const zeroOverlaySizes = sizesFor(
  snow,
  ["snow_overlay_top_03", "snow_overlay_body_02"],
  {
    snow_overlay_top_03: [351, 128],
    snow_overlay_body_02: [352, 127]
  }
);
const zeroOverlayKit = createRuntime(zeroOverlaySizes).resolve("snow");
assert.deepEqual(snapshot(zeroOverlayKit.getStatus().availableTopOverlays), []);
assert.deepEqual(snapshot(zeroOverlayKit.getStatus().availableBodyOverlays), []);
assert.deepEqual(snapshot(zeroOverlayKit.getTopOverlaySelection(5)), {
  startIndex: null,
  goalIndex: null,
  startAsset: null,
  goalAsset: null
});
assert.deepEqual(snapshot(zeroOverlayKit.getBodyOverlaySelection(5)), {
  goalIndex: null,
  goalAsset: null
});

const oneOverlaySizes = sizesFor(
  snow,
  [
    "snow_overlay_top_02",
    "snow_overlay_top_05",
    "snow_overlay_body_01",
    "snow_overlay_body_03"
  ],
  {
    snow_overlay_top_02: [351, 128],
    snow_overlay_body_01: [352, 129]
  }
);
const oneOverlayKit = createRuntime(oneOverlaySizes).resolve("snow");
assert.deepEqual(snapshot(oneOverlayKit.getStatus().availableTopOverlays), [
  "snow_overlay_top_05"
]);
assert.deepEqual(snapshot(oneOverlayKit.getStatus().availableBodyOverlays), [
  "snow_overlay_body_03"
]);
for (let seed = 0; seed < 32; seed++) {
  const topSelection = oneOverlayKit.getTopOverlaySelection(seed);
  const bodySelection = oneOverlayKit.getBodyOverlaySelection(seed);
  assert.equal(topSelection.startIndex, 4);
  assert.equal(topSelection.goalIndex, 4);
  assert.equal(bodySelection.goalIndex, 2);
}
const overlayOnlyDraw = createDrawRecorder();
const overlayOnlyFallbackRegions = [];
assert.equal(oneOverlayKit.drawPlatformBase(
  overlayOnlyDraw.context,
  goalPlatform,
  goalPlatform.x,
  5,
  region => overlayOnlyFallbackRegions.push(snapshot(region))
), true);
assert.deepEqual(overlayOnlyDraw.calls.map(call => call.path), [
  snow.paths.snow_overlay_top_05,
  snow.paths.snow_overlay_body_03
]);
assert.deepEqual(overlayOnlyFallbackRegions, [
  {x: 1060, y: 100, w: 220, h: 80},
  {x: 1060, y: 179, w: 220, h: 181}
]);

const twoOverlaySizes = sizesFor(
  snow,
  [
    "snow_overlay_top_02",
    "snow_overlay_top_04",
    "snow_overlay_top_06",
    "snow_overlay_body_01",
    "snow_overlay_body_02",
    "snow_overlay_body_03"
  ],
  {
    snow_overlay_top_04: [353, 128],
    snow_overlay_body_02: [352, 126]
  }
);
const twoOverlayKit = createRuntime(twoOverlaySizes).resolve("snow");
assert.deepEqual(snapshot(twoOverlayKit.getStatus().availableTopOverlays), [
  "snow_overlay_top_02",
  "snow_overlay_top_06"
]);
assert.deepEqual(snapshot(twoOverlayKit.getStatus().availableBodyOverlays), [
  "snow_overlay_body_01",
  "snow_overlay_body_03"
]);
const seenTopIndices = new Set();
const seenBodyIndices = new Set();
for (let seed = 0; seed < 256; seed++) {
  const topSelection = twoOverlayKit.getTopOverlaySelection(seed);
  const repeatedTopSelection = twoOverlayKit.getTopOverlaySelection(seed);
  const bodySelection = twoOverlayKit.getBodyOverlaySelection(seed);
  assert.equal(topSelection.startIndex, repeatedTopSelection.startIndex);
  assert.equal(topSelection.goalIndex, repeatedTopSelection.goalIndex);
  assert.ok([1, 5].includes(topSelection.startIndex));
  assert.ok([1, 5].includes(topSelection.goalIndex));
  assert.notEqual(topSelection.startIndex, topSelection.goalIndex);
  assert.ok([0, 2].includes(bodySelection.goalIndex));
  seenTopIndices.add(topSelection.startIndex);
  seenTopIndices.add(topSelection.goalIndex);
  seenBodyIndices.add(bodySelection.goalIndex);
}
assert.deepEqual([...seenTopIndices].sort(), [1, 5]);
assert.deepEqual([...seenBodyIndices].sort(), [0, 2]);

const normalFloatingPlatform = {x: 413, y: 280, w: 181, h: 26};
// Floating is Whole-only: one valid 512x128 image is sufficient.
const wholeAsset = "snow_floating_platform";
const wholeOnlyKit = createRuntime(sizesFor(snow, [wholeAsset])).resolve("snow");
assert.equal(wholeOnlyKit.isFamilyBReady(), true);
assert.equal(wholeOnlyKit.isWholeFamilyBReady(), true);
assert.equal(wholeOnlyKit.getManifest().contract.floating.height, 26);
const wholeDraw = createDrawRecorder();
assert.equal(
  wholeOnlyKit.drawPlatformBase(wholeDraw.context, normalFloatingPlatform),
  true
);
assert.equal(wholeDraw.calls.length, 1);
assert.equal(wholeDraw.calls[0].path, snow.paths[wholeAsset]);
const wholeMapping = snapshot(wholeOnlyKit.getWholeFloatingMapping(normalFloatingPlatform));
assert.equal(wholeMapping.scale, normalFloatingPlatform.w / 504);
assert.equal(wholeMapping.drawX + 4 * wholeMapping.scale, normalFloatingPlatform.x);
assert.equal(
  wholeMapping.drawX + 508 * wholeMapping.scale,
  normalFloatingPlatform.x + normalFloatingPlatform.w
);
assert.equal(wholeMapping.drawY + 34 * wholeMapping.scale, normalFloatingPlatform.y);

for (const flag of ["moving", "fade", "spikePlatform"]) {
  const specialPlatform = {...normalFloatingPlatform, [flag]: true};
  const before = {...specialPlatform};
  const draw = createDrawRecorder();
  assert.equal(wholeOnlyKit.drawPlatformBase(draw.context, specialPlatform), true);
  assert.deepEqual(specialPlatform, before);
  assert.deepEqual(draw.calls.map(call => call.path), [snow.paths[wholeAsset]]);
}
for (const flag of ["fragile", "conveyor", "ice"]) {
  const unsupportedDraw = createDrawRecorder();
  assert.equal(
    wholeOnlyKit.drawPlatformBase(
      unsupportedDraw.context,
      {...normalFloatingPlatform, [flag]: true}
    ),
    false
  );
  assert.deepEqual(unsupportedDraw.calls, []);
}

for (const [fixtureName, runtime] of [
  [
    "invalid native size",
    createRuntime(sizesFor(
      snow,
      [wholeAsset],
      {[wholeAsset]: [511, 128]}
    ))
  ],
  [
    "failed support analysis",
    createRuntime(
      sizesFor(snow, [wholeAsset]),
      {emptyWhole: true}
    )
  ]
]) {
  const fallbackKit = runtime.resolve("snow");
  assert.equal(fallbackKit.isWholeFamilyBReady(), false, fixtureName);
  const fallbackDraw = createDrawRecorder();
  assert.equal(
    fallbackKit.drawPlatformBase(fallbackDraw.context, normalFloatingPlatform),
    false,
    fixtureName
  );
  assert.deepEqual(fallbackDraw.calls, [], fixtureName);
  const spikeFallbackDraw = createDrawRecorder();
  assert.equal(
    fallbackKit.drawPlatformBase(
      spikeFallbackDraw.context,
      {...normalFloatingPlatform, spikePlatform: true}
    ),
    false,
    fixtureName
  );
  assert.deepEqual(spikeFallbackDraw.calls, [], fixtureName);
}

assert.doesNotMatch(platformKitSource, /Math\.random\s*\(/);
assert.match(
  rendererSource,
  /platformVisuals\.drawPlatformBase\([\s\S]*?region => drawVectorPlatformFallbackRegion\(/
);
assert.match(
  rendererSource,
  /drawGoalTopForeground\([\s\S]*?region => drawVectorPlatformFallbackRegion\(/
);

console.log(
  "Generic platform drop-in paths, partial Family A, sparse overlays, Whole-only Floating and vector fallback tests passed."
);
