"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const backgroundDirectory = "assets/environments/coast/background";
const backgroundFiles = Object.freeze([
  "coast_background_sky_base.png",
  "coast_background_clouds_back.png",
  "coast_background_ship.png",
  "coast_background_landscape.png",
  "coast_background_clouds_front.png"
]);
const backgroundPaths = backgroundFiles.map(file => `${backgroundDirectory}/${file}`);
const visualSource = read("js/visual-coast-assets.js");
const rendererSource = read("js/renderer.js");
const shipBounds = Object.freeze({x: 239, y: 47, w: 822, h: 614});

for (const relativePath of backgroundPaths) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.deepEqual(
    [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    [1280, 720],
    `${relativePath} must use the shared 1280x720 reference canvas`
  );
}

function createShipPixels(bounds = shipBounds) {
  const pixels = new Uint8ClampedArray(1280 * 720 * 4);
  if (!bounds) return pixels;
  pixels[(bounds.y * 1280 + bounds.x) * 4 + 3] = 255;
  pixels[
    ((bounds.y + bounds.h - 1) * 1280 + bounds.x + bounds.w - 1) * 4 + 3
  ] = 255;
  return pixels;
}

function loadVisuals({failedFile = null, invalidFile = null, alphaBounds = shipBounds} = {}) {
  const loadedPaths = [];
  const platformVisuals = Object.freeze({
    platformMarker: "generic-coast-platform-kit",
    drawPlatformBase() { return true; },
    drawGoalTopForeground() { return true; }
  });
  let registeredVisuals = null;
  let canvasImage = null;
  const pixels = createShipPixels(alphaBounds);

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
      loadedPaths.push(value);
      const file = path.posix.basename(value);
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      this.naturalWidth = file === invalidFile ? 1279 : 1280;
      this.naturalHeight = 720;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const registry = {
    resolve(id) {
      assert.equal(id, "coast");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "coast");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const document = {
    createElement(type) {
      assert.equal(type, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(typeName, options) {
          assert.equal(typeName, "2d");
          assert.equal(options.willReadFrequently, true);
          return {
            clearRect() {},
            drawImage(image) { canvasImage = image; },
            getImageData() {
              assert.ok(canvasImage.src.endsWith("coast_background_ship.png"));
              return {data: pixels};
            }
          };
        }
      };
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Coast background rendering must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    document
  });
  vm.runInContext(`${visualSource}
    globalThis.coastBackgroundForTest = COAST_ASSET_VISUALS;
  `, context, {filename: "coast-background-layers-fixture.js"});
  return {
    api: context.coastBackgroundForTest,
    loadedPaths,
    platformVisuals,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function captureBackground(api, visualTime, width = 1280, height = 720) {
  const drawCalls = [];
  const transforms = [];
  const propertyWrites = [];
  const context = new Proxy({
    save() {},
    restore() {},
    translate(...args) { transforms.push(["translate", ...args]); },
    scale(...args) { transforms.push(["scale", ...args]); },
    drawImage(...args) { drawCalls.push(args); }
  }, {
    set(target, property, value) {
      propertyWrites.push([property, value]);
      target[property] = value;
      return true;
    }
  });
  return {
    result: api.drawBackground(context, width, height, visualTime),
    drawCalls,
    transforms,
    propertyWrites
  };
}

const fixture = loadVisuals();
const visuals = fixture.api;
assert.deepEqual(fixture.loadedPaths, backgroundPaths);
assert.equal(fixture.getRegisteredVisuals(), visuals);
assert.equal(visuals.platformMarker, fixture.platformVisuals.platformMarker);
assert.equal(visuals.drawPlatformBase, fixture.platformVisuals.drawPlatformBase);
assert.equal(visuals.drawGoalTopForeground, fixture.platformVisuals.drawGoalTopForeground);

const status = JSON.parse(JSON.stringify(visuals.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.equal(status.alphaThreshold, 8);
assert.deepEqual(status.shipContentBounds, shipBounds);

const atZero = captureBackground(visuals, 0);
const later = captureBackground(visuals, 3.75);
assert.equal(atZero.result, true);
assert.deepEqual(
  atZero.drawCalls.map(call => path.basename(call[0].src)),
  [
    "coast_background_sky_base.png",
    "coast_background_clouds_back.png",
    "coast_background_clouds_back.png",
    "coast_background_ship.png",
    "coast_background_landscape.png",
    "coast_background_clouds_front.png",
    "coast_background_clouds_front.png"
  ]
);
assert.deepEqual(atZero.drawCalls[0].slice(5), [0, 0, 1280, 720]);
assert.deepEqual(atZero.drawCalls[4].slice(5), [0, 75, 1280, 720]);
for (const pair of [[1, 2], [5, 6]]) {
  const first = atZero.drawCalls[pair[0]];
  const second = atZero.drawCalls[pair[1]];
  assert.equal(first[6], 0);
  assert.equal(second[6], 0);
  assert.equal(second[5], first[5] + 1280);
  assert.ok(first[5] <= 0);
  assert.ok(second[5] + second[7] >= 1280);
}
assert.notEqual(atZero.drawCalls[1][5], later.drawCalls[1][5]);
assert.notEqual(atZero.drawCalls[5][5], later.drawCalls[5][5]);
assert.notEqual(later.drawCalls[1][5], later.drawCalls[5][5]);
assert.ok(atZero.propertyWrites.some(([name, value]) => (
  name === "imageSmoothingEnabled" && value === true
)));
assert.ok(atZero.propertyWrites.some(([name, value]) => (
  name === "imageSmoothingQuality" && value === "high"
)));

const shipAtZero = atZero.drawCalls[3];
assert.deepEqual(shipAtZero.slice(1, 5), [239, 47, 822, 614]);
assert.equal(shipAtZero[7], 142.5);
assert.ok(Math.abs(shipAtZero[7] / shipAtZero[8] - 822 / 614) < 1e-12);

const outbound = visuals.getShipMapping(0, 1280, 720);
const inbound = visuals.getShipMapping(15, 1280, 720);
assert.equal(outbound.flipX, false);
assert.equal(inbound.flipX, true);
assert.equal(outbound.referenceBottomY, 535 - 24 + 75);
assert.ok(Math.abs(outbound.centerX - inbound.centerX) < 1e-9);
const flipped = captureBackground(visuals, 15);
assert.ok(flipped.transforms.some(call => (
  call[0] === "translate" && Math.abs(call[1] - inbound.centerX) < 1e-9
)));
assert.ok(flipped.transforms.some(call => (
  call[0] === "scale" && call[1] === -1 && call[2] === 1
)));
assert.deepEqual(flipped.drawCalls[3].slice(1, 5), [239, 47, 822, 614]);
assert.equal(flipped.drawCalls[3][5], -inbound.destination.w / 2);

const rightTurn = visuals.getShipMapping(7.5, 1280, 720);
const leftTurn = visuals.getShipMapping(22.5, 1280, 720);
assert.ok(Math.abs(rightTurn.referenceCenterX - 915) < 1e-9);
assert.ok(Math.abs(leftTurn.referenceCenterX - 365) < 1e-9);
assert.ok(Math.abs(rightTurn.destination.w - 190 * 0.75) < 1e-9);
const bobTop = visuals.getShipMapping(1.375, 1280, 720);
const bobBottom = visuals.getShipMapping(4.125, 1280, 720);
assert.ok(Math.abs(bobTop.referenceBottomY - 588.5) < 1e-9);
assert.ok(Math.abs(bobBottom.referenceBottomY - 583.5) < 1e-9);
const scaled = visuals.getShipMapping(7.5, 960, 540);
assert.ok(Math.abs(scaled.centerX / 960 - rightTurn.centerX / 1280) < 1e-12);
assert.ok(Math.abs(scaled.bottomY / 540 - rightTurn.bottomY / 720) < 1e-12);
assert.ok(Math.abs(scaled.destination.w / scaled.destination.h - 822 / 614) < 1e-12);

for (const failedFile of backgroundFiles) {
  const fallback = loadVisuals({failedFile});
  const capture = captureBackground(fallback.api, 4);
  assert.equal(capture.result, false, `${failedFile} must trigger vector fallback`);
  assert.equal(capture.drawCalls.length, 0, "fallback must be atomic");
}
const invalid = loadVisuals({invalidFile: "coast_background_landscape.png"});
assert.equal(captureBackground(invalid.api, 4).result, false);
const transparentShip = loadVisuals({alphaBounds: null});
assert.equal(captureBackground(transparentShip.api, 4).result, false);

assert.match(
  rendererSource,
  /const assetBackgroundDrawn = Boolean\([\s\S]*?biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{\s*drawBackground\(biome\);/
);
assert.doesNotMatch(visualSource, /Math\.random\(/);

for (const relativePath of [
  "js/biomes.js",
  "js/core.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/visual-meadow-assets.js"
]) {
  const current = read(relativePath);
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the Coast background update`
  );
}

console.log("Coast layered background assets, alpha-fit ship motion, ordering and fallback tests passed.");
