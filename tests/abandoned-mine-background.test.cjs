"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-abandoned-mine-assets.js");
const rendererSource = read("js/renderer.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/abandonedMine/background";
const hazardPath =
  "assets/environments/abandonedMine/hazards/abandonedMine_hazard_main.png";
const assetPaths = Object.freeze({
  main: `${backgroundDirectory}/abandonedMine_background_main.png`,
  front: `${backgroundDirectory}/abandonedMine_background_front.png`,
  minecartEmpty: `${backgroundDirectory}/abandonedMine_minecart_empty.png`,
  minecartFull: `${backgroundDirectory}/abandonedMine_minecart_full.png`,
  minecartWheel: `${backgroundDirectory}/abandonedMine_minecart_wheel.png`
});
const expectedSizes = Object.freeze({
  main: Object.freeze({w: 1280, h: 720}),
  front: Object.freeze({w: 1280, h: 720}),
  minecartEmpty: Object.freeze({w: 192, h: 96}),
  minecartFull: Object.freeze({w: 192, h: 96}),
  minecartWheel: Object.freeze({w: 40, h: 40})
});
const hazardSize = Object.freeze({w: 1650, h: 60});
const allAssetPaths = Object.freeze({...assetPaths, hazardMain: hazardPath});
const allExpectedSizes = Object.freeze({...expectedSizes, hazardMain: hazardSize});

function decodePng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8, `${relativePath} must use 8-bit channels`);
  assert.ok(colorType === 2 || colorType === 6, `${relativePath} must be RGB/RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);

  const channels = colorType === 6 ? 4 : 3;
  const idatChunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idatChunks));
  const sourceStride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(sourceStride);
  let packedOffset = 0;
  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };

  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    const current = Buffer.alloc(sourceStride);
    for (let x = 0; x < sourceStride; x++) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      current[x] = (packed[packedOffset++] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const sourceOffset = x * channels;
      const targetOffset = (y * width + x) * 4;
      pixels[targetOffset] = current[sourceOffset];
      pixels[targetOffset + 1] = current[sourceOffset + 1];
      pixels[targetOffset + 2] = current[sourceOffset + 2];
      pixels[targetOffset + 3] = channels === 4
        ? current[sourceOffset + 3]
        : 255;
      if (pixels[targetOffset + 3] === 0) transparentPixels++;
      else visiblePixels++;
    }
    previous = current;
  }
  return Object.freeze({
    width,
    height,
    colorType,
    pixels,
    transparentPixels,
    visiblePixels
  });
}

function hasWarmPixelNear(decoded, point, radius = 22) {
  const minX = Math.max(0, Math.floor(point.x - radius));
  const maxX = Math.min(decoded.width - 1, Math.ceil(point.x + radius));
  const minY = Math.max(0, Math.floor(point.y - radius));
  const maxY = Math.min(decoded.height - 1, Math.ceil(point.y + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const offset = (y * decoded.width + x) * 4;
      const red = decoded.pixels[offset];
      const green = decoded.pixels[offset + 1];
      const blue = decoded.pixels[offset + 2];
      const alpha = decoded.pixels[offset + 3];
      if (
        alpha > 64 && red >= 170 && green >= 55 &&
        red > green * 1.08 && blue <= 110
      ) return true;
    }
  }
  return false;
}

const decodedAssets = Object.freeze(Object.fromEntries(
  Object.entries(assetPaths).map(([name, relativePath]) => (
    [name, decodePng(relativePath)]
  ))
));
for (const [name, expected] of Object.entries(expectedSizes)) {
  assert.equal(decodedAssets[name].width, expected.w);
  assert.equal(decodedAssets[name].height, expected.h);
}
assert.ok(
  decodedAssets.main.colorType === 2 || decodedAssets.main.colorType === 6,
  "the opaque main layer may be stored as RGB or RGBA"
);
assert.equal(decodedAssets.main.transparentPixels, 0);
assert.equal(decodedAssets.front.colorType, 6);
assert.ok(decodedAssets.front.transparentPixels > 700000);
assert.ok(decodedAssets.front.visiblePixels > 100000);
assert.equal(decodedAssets.minecartEmpty.colorType, 6);
assert.equal(decodedAssets.minecartFull.colorType, 6);
assert.equal(decodedAssets.minecartWheel.colorType, 6);
const decodedHazard = decodePng(hazardPath);
assert.equal(decodedHazard.width, hazardSize.w);
assert.equal(decodedHazard.height, hazardSize.h);
assert.equal(decodedHazard.colorType, 6);

function createRecordingContext() {
  const calls = [];
  let gradientId = 0;
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    fill() { calls.push(["fill"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    scale(...args) { calls.push(["scale", ...args]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    createRadialGradient(...args) {
      const id = gradientId++;
      calls.push(["createRadialGradient", id, ...args]);
      return {
        addColorStop(...stopArgs) {
          calls.push(["radialColorStop", id, ...stopArgs]);
        }
      };
    }
  };
  const context = new Proxy(target, {
    set(object, property, value) {
      calls.push(["set", property, value]);
      object[property] = value;
      return true;
    }
  });
  return {context, calls};
}

function loadFixture({failedFile = null, invalidFile = null} = {}) {
  const recording = createRecordingContext();
  const loadedPaths = [];
  let registeredVisuals = null;

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
      const entry = Object.entries(allAssetPaths).find(([, assetPath]) => (
        assetPath === value
      ));
      assert.ok(entry, `unexpected asset path ${value}`);
      const expected = allExpectedSizes[entry[0]];
      this.complete = true;
      this.naturalWidth = file === invalidFile ? expected.w - 1 : expected.w;
      this.naturalHeight = expected.h;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "abandoned-mine-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return false; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "abandonedMine");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "abandonedMine");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Abandoned Mine visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.abandonedMineVisualsForTest = ABANDONED_MINE_ASSET_VISUALS;
  `, context, {filename: "abandoned-mine-background-fixture.js"});
  return {
    recording,
    loadedPaths,
    platformVisuals,
    api: context.abandonedMineVisualsForTest,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function captureBackground(fixture, visualTime, width = 1280, height = 720) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBackground(
    fixture.recording.context,
    width,
    height,
    visualTime
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

function captureHazard(fixture, visualTime, rect) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBottomDeathHazard(
    fixture.recording.context,
    rect,
    visualTime
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

const fixture = loadFixture();
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.deepEqual(fixture.loadedPaths, Object.values(allAssetPaths));

const status = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, assetPaths);
assert.deepEqual(status.expectedNativeSizes, expectedSizes);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.deepEqual(status.renderOrder, [
  "main-background",
  "main-lantern-effects",
  "minecart-bodies",
  "distance-coupled-wheels",
  "front-layer",
  "front-lantern-effects",
  "gameplay"
]);
assert.deepEqual(status.minecartContract.body, {w: 192, h: 96});
assert.deepEqual(status.minecartContract.wheel, {w: 40, h: 40});
assert.deepEqual(status.minecartContract.wheelCenter, {x: 20, y: 20});
assert.deepEqual(status.minecartContract.wheelCenters, [
  {x: 60, y: 85},
  {x: 129, y: 85}
]);
assert.equal(status.minecartContract.scale, 0.68);
assert.deepEqual(status.minecartContract.renderedBody, {w: 130.56, h: 65.28});
assert.equal(status.minecartContract.effectiveWheelRadius, 13.600000000000001);
assert.equal(status.minecartContract.equalVariantScale, true);
assert.equal(status.minecartContract.positiveCanvasRotation, "clockwise");
assert.equal(status.minecartAnimation.count, 3);
assert.equal(status.minecartAnimation.horizontalOnly, true);
assert.equal(status.minecartAnimation.deterministic, true);
assert.equal(status.minecartAnimation.wrapRule, "fully-offscreen-then-opposite-side");
assert.deepEqual(status.minecarts.map(cart => [
  cart.rail,
  cart.railY,
  cart.variant,
  cart.direction,
  cart.speed,
  cart.respawnGap
]), [
  ["upper", 224, "empty", 1, 38, 360],
  ["middle", 451, "full", -1, 48, 460],
  ["lower", 678, "empty", 1, 58, 520]
]);
assert.equal(status.lanternAnimation.count, 6);
assert.equal(status.lanternAnimation.deterministic, true);
assert.equal(status.lanternAnimation.synchronized, false);
assert.equal(status.lanternAnimation.localDimmingDuringDips, true);
assert.deepEqual(status.lanterns.main.map(({x, y}) => [x, y]), [
  [248, 100], [905, 100], [235, 339], [851, 563]
]);
assert.deepEqual(status.lanterns.front.map(({x, y}) => [x, y]), [
  [147, 136], [1139, 164]
]);
assert.ok(status.lanterns.main.every(point => (
  hasWarmPixelNear(decodedAssets.main, point)
)));
assert.ok(status.lanterns.front.every(point => (
  hasWarmPixelNear(decodedAssets.front, point)
)));

const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const hazardStatus = JSON.parse(JSON.stringify(fixture.api.getHazardStatus()));
assert.deepEqual(hazardStatus, {
  ready: true,
  path: hazardPath,
  expectedNativeSize: hazardSize,
  validNativeSize: true,
  source: {x: 0, y: 0, w: 1650, h: 60},
  destination: {x: 235, y: 690, w: 825, h: 30},
  layerCount: 1,
  animated: false
});
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getBottomHazardMapping(hazardRect))),
  {
    source: {x: 0, y: 0, w: 1650, h: 60},
    destination: {x: 235, y: 690, w: 825, h: 30}
  }
);
const hazardAtZero = captureHazard(fixture, 0, hazardRect);
const hazardAtLaterTime = captureHazard(fixture, 123.45, hazardRect);
assert.equal(hazardAtZero.drawn, true);
assert.deepEqual(
  hazardAtLaterTime.calls,
  hazardAtZero.calls,
  "the Abandoned Mine hazard must not depend on visual time"
);
const hazardDrawCalls = hazardAtZero.calls.filter(call => call[0] === "drawImage");
assert.equal(hazardDrawCalls.length, 1);
assert.equal(hazardDrawCalls[0][1].src, hazardPath);
assert.deepEqual(hazardDrawCalls[0].slice(2), [
  0, 0, 1650, 60, 235, 690, 825, 30
]);
assert.equal(captureHazard(
  fixture,
  0,
  {...hazardRect, y: 689}
).drawn, false);
assert.equal(
  Boolean(fixture.api.drawBottomDeathHazard(
    fixture.recording.context,
    hazardRect,
    0
  )) ? 0 : 1,
  0,
  "a successful asset draw must suppress the generic fallback"
);

for (const mode of ["failedFile", "invalidFile"]) {
  const unavailableHazard = loadFixture({
    [mode]: path.posix.basename(hazardPath)
  });
  assert.equal(unavailableHazard.api.isBackgroundReady(), true);
  assert.equal(unavailableHazard.api.isHazardReady(), false);
  assert.equal(captureHazard(unavailableHazard, 0, hazardRect).drawn, false);
}

const cartsAtOne = JSON.parse(JSON.stringify(fixture.api.getMinecartMapping(1)));
const cartsAtOneAgain = JSON.parse(JSON.stringify(fixture.api.getMinecartMapping(1)));
const cartsAtLater = JSON.parse(JSON.stringify(fixture.api.getMinecartMapping(1.25)));
assert.deepEqual(cartsAtOneAgain, cartsAtOne);
assert.equal(cartsAtOne.length, 3);
for (let index = 0; index < cartsAtOne.length; index++) {
  const first = cartsAtOne[index];
  const later = cartsAtLater[index];
  const descriptor = status.minecarts[index];
  const expectedDelta = descriptor.direction * descriptor.speed * 0.25;
  assert.equal(later.y, first.y, "minecart Y must remain static");
  assert.ok(Math.abs(later.x - first.x - expectedDelta) < 1e-9);
  assert.ok(Math.abs(
    later.wheelRotation - first.wheelRotation -
    expectedDelta / status.minecartContract.effectiveWheelRadius
  ) < 1e-9);
  assert.equal(first.w, status.minecartContract.renderedBody.w);
  assert.equal(first.h, status.minecartContract.renderedBody.h);
  assert.equal(first.wheels.length, 2);
  assert.ok(Math.abs(first.wheels[0].centerX - (first.x + 60 * 0.68)) < 1e-9);
  assert.ok(Math.abs(first.wheels[1].centerX - (first.x + 129 * 0.68)) < 1e-9);
  assert.ok(Math.abs(first.wheels[0].centerY - (first.y + 85 * 0.68)) < 1e-9);
  assert.ok(Math.abs(
    first.wheels[0].centerY + first.wheels[0].radius - descriptor.railY
  ) < 1e-9, "wheel bottom must sit on its mapped rail");
  assert.equal(Math.sign(later.wheelRotation - first.wheelRotation), descriptor.direction);

  const beforeWrapTime = (
    first.cycleDistance - 0.01 - descriptor.phaseDistance
  ) / descriptor.speed;
  const resetTime = (
    first.cycleDistance - descriptor.phaseDistance
  ) / descriptor.speed;
  const beforeWrap = JSON.parse(JSON.stringify(
    fixture.api.getMinecartMapping(beforeWrapTime)[index]
  ));
  const atReset = JSON.parse(JSON.stringify(
    fixture.api.getMinecartMapping(resetTime)[index]
  ));
  const beforeFullyOutside = descriptor.direction > 0
    ? beforeWrap.x >= 1280
    : beforeWrap.x + beforeWrap.w <= 0;
  const resetFullyOutside = descriptor.direction > 0
    ? atReset.x + atReset.w <= 1e-9
    : atReset.x >= 1280 - 1e-9;
  assert.equal(beforeFullyOutside, true);
  assert.equal(resetFullyOutside, true);
}

const lanternsAtZero = JSON.parse(JSON.stringify(fixture.api.getLanternMapping(0)));
const lanternsAtFive = JSON.parse(JSON.stringify(fixture.api.getLanternMapping(5)));
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getLanternMapping(5))),
  lanternsAtFive
);
assert.notDeepEqual(lanternsAtZero, lanternsAtFive);
const allLanternsAtFive = [...lanternsAtFive.main, ...lanternsAtFive.front];
assert.ok(new Set(allLanternsAtFive.map(lantern => lantern.glowAlpha.toFixed(8))).size > 1);
let mappedDip = null;
for (let time = 0; time <= 35 && !mappedDip; time += 0.01) {
  const mapping = fixture.api.getLanternMapping(time);
  const all = [...mapping.main, ...mapping.front];
  const active = all.filter(lantern => lantern.dipFactor < 0.99);
  if (active.length > 0 && active.length < all.length) mappedDip = {time, active};
}
assert.ok(mappedDip, "at least one unsynchronized local lantern dip must occur");
assert.ok(mappedDip.active.every(lantern => lantern.dimAlpha > 0));

const atZero = captureBackground(fixture, 0);
const atFive = captureBackground(fixture, 5);
assert.equal(atZero.drawn, true);
const drawCalls = atZero.calls.filter(call => call[0] === "drawImage");
assert.equal(drawCalls.length, 11);
assert.equal(drawCalls[0][1].src, assetPaths.main);
assert.equal(drawCalls.at(-1)[1].src, assetPaths.front);
assert.deepEqual(drawCalls[0].slice(2), [
  0, 0, 1280, 720, 0, 0, 1280, 720
]);
assert.deepEqual(drawCalls.at(-1).slice(2), [
  0, 0, 1280, 720, 0, 0, 1280, 720
]);
assert.equal(atZero.calls.filter(call => call[0] === "rotate").length, 6);
assert.equal(atZero.calls.filter(call => call[0] === "translate").length, 6);
assert.deepEqual(
  atFive.calls.filter(call => (
    call[0] === "drawImage" &&
    [assetPaths.main, assetPaths.front].includes(call[1].src)
  )).map(call => call.slice(2)),
  atZero.calls.filter(call => (
    call[0] === "drawImage" &&
    [assetPaths.main, assetPaths.front].includes(call[1].src)
  )).map(call => call.slice(2)),
  "main and front transforms must stay static"
);
const frontDrawIndex = atZero.calls.findIndex(call => (
  call[0] === "drawImage" && call[1].src === assetPaths.front
));
const cartDrawIndices = atZero.calls.map((call, index) => (
  call[0] === "drawImage" && [
    assetPaths.minecartEmpty,
    assetPaths.minecartFull,
    assetPaths.minecartWheel
  ].includes(call[1].src) ? index : -1
)).filter(index => index >= 0);
assert.ok(cartDrawIndices.every(index => index < frontDrawIndex));
assert.equal(
  atZero.calls.slice(0, cartDrawIndices[0]).filter(call => (
    call[0] === "createRadialGradient"
  )).length,
  4,
  "all main lantern glows must draw before the minecarts"
);
assert.equal(
  atZero.calls.slice(frontDrawIndex + 1).filter(call => (
    call[0] === "createRadialGradient"
  )).length,
  2,
  "front lantern glows must draw after the transparent front layer"
);
const halfSize = captureBackground(fixture, 2, 640, 360);
assert.ok(halfSize.calls.some(call => (
  call[0] === "scale" && call[1] === 0.5 && call[2] === 0.5
)));
assert.equal(fixture.api.drawBackground(null, 1280, 720, 0), false);
assert.equal(fixture.api.drawBackground(fixture.recording.context, 0, 720, 0), false);

for (const relativePath of Object.values(assetPaths)) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["failedFile", "invalidFile"]) {
    const fallback = loadFixture({[mode]: file});
    const capture = captureBackground(fallback, 2);
    assert.equal(capture.drawn, false);
    assert.equal(capture.calls.some(call => call[0] === "drawImage"), false);
  }
}

const mineScriptIndex = indexSource.indexOf("./js/visual-abandoned-mine-assets.js");
assert.ok(mineScriptIndex >= 0);
assert.ok(mineScriptIndex < indexSource.indexOf("./js/renderer.js"));
const rendererDrawSource = rendererSource.slice(rendererSource.indexOf("  function draw()"));
assert.match(
  rendererDrawSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{[\s\S]*?drawBackground\(biome\)/
);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)[\s\S]*?if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
);
assert.match(
  levelGeneratorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.doesNotMatch(visualSource, /Math\.random\(|getImageData|createElement|particle|dust/i);
assert.match(visualSource, /wheelRotation = signedDistance \/ effectiveWheelRadius/);
assert.match(visualSource, /context\.rotate\(wheel\.rotation\)/);

console.log(
  "Abandoned Mine background, carts, lanterns and static hazard tests passed."
);
