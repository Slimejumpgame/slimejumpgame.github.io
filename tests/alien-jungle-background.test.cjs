"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-alien-jungle-assets.js");
const rendererSource = read("js/renderer.js");
const biomeSource = read("js/biomes.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const indexSource = read("index.html");
const backgroundPaths = Object.freeze({
  skybox:
    "assets/environments/alienJungle/background/alienJungle_background_skybox.png",
  planets:
    "assets/environments/alienJungle/background/alienJungle_background_planet.png",
  jungleBack:
    "assets/environments/alienJungle/background/alienJungle_background_jungle_back.png",
  jungleFront:
    "assets/environments/alienJungle/background/alienJungle_background_jungle_front.png"
});
const backgroundSize = Object.freeze({w: 1280, h: 720});
const hazardPaths = Object.freeze({
  base:
    "assets/environments/alienJungle/hazards/alienJungle_hazard_base.png",
  waveBack:
    "assets/environments/alienJungle/hazards/alienJungle_hazard_wave_back.png",
  waveFront:
    "assets/environments/alienJungle/hazards/alienJungle_hazard_wave_front.png"
});
const hazardSize = Object.freeze({w: 1650, h: 60});
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const fireflyPalette = Object.freeze([
  "#ff4fd8",
  "#d85cff",
  "#ff8a35",
  "#ffd75a",
  "#37efcf",
  "#42d9ff",
  "#9dff5a"
]);

function decodePngAlpha(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];
  assert.equal(bitDepth, 8);
  assert.ok(colorType === 2 || colorType === 6);
  assert.equal(interlace, 0);
  const channels = colorType === 6 ? 4 : 3;
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") {
      idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  let previous = Buffer.alloc(stride);
  let packedOffset = 0;
  let visiblePixels = 0;
  let transparentPixels = 0;
  const columnMaximum = new Uint8Array(width);
  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
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
      const alpha = colorType === 6 ? current[x * channels + 3] : 255;
      if (alpha > 0) visiblePixels++;
      if (alpha < 255) transparentPixels++;
      columnMaximum[x] = Math.max(columnMaximum[x], alpha);
    }
    previous = current;
  }
  let leftTransparentColumns = 0;
  let rightTransparentColumns = 0;
  while (
    leftTransparentColumns < width &&
    columnMaximum[leftTransparentColumns] === 0
  ) leftTransparentColumns++;
  while (
    rightTransparentColumns < width &&
    columnMaximum[width - 1 - rightTransparentColumns] === 0
  ) rightTransparentColumns++;
  return Object.freeze({
    width,
    height,
    bitDepth,
    colorType,
    interlace,
    visiblePixels,
    transparentPixels,
    leftTransparentColumns,
    rightTransparentColumns
  });
}

const decodedAssets = Object.freeze(Object.fromEntries(
  Object.entries(backgroundPaths).map(([name, relativePath]) => (
    [name, decodePngAlpha(relativePath)]
  ))
));
for (const decoded of Object.values(decodedAssets)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, backgroundSize);
  assert.ok(decoded.visiblePixels > 0);
}
assert.equal(decodedAssets.skybox.colorType, 2);
assert.equal(decodedAssets.skybox.visiblePixels, 1280 * 720);
assert.equal(decodedAssets.skybox.transparentPixels, 0);
for (const name of ["planets", "jungleBack", "jungleFront"]) {
  assert.equal(decodedAssets[name].colorType, 6);
  assert.ok(decodedAssets[name].transparentPixels > 0);
}
const decodedHazards = Object.freeze(Object.fromEntries(
  Object.entries(hazardPaths).map(([name, relativePath]) => (
    [name, decodePngAlpha(relativePath)]
  ))
));
for (const decoded of Object.values(decodedHazards)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, hazardSize);
  assert.equal(decoded.colorType, 6);
  assert.ok(decoded.visiblePixels > 0);
  assert.ok(decoded.transparentPixels > 0);
}
assert.deepEqual(
  [
    decodedHazards.base.leftTransparentColumns,
    decodedHazards.base.rightTransparentColumns
  ],
  [0, 0]
);
assert.deepEqual(
  [
    decodedHazards.waveBack.leftTransparentColumns,
    decodedHazards.waveBack.rightTransparentColumns
  ],
  [3, 0]
);
assert.deepEqual(
  [
    decodedHazards.waveFront.leftTransparentColumns,
    decodedHazards.waveFront.rightTransparentColumns
  ],
  [0, 0]
);

function createRecordingContext() {
  const calls = [];
  let gradientId = 0;
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    scale(...args) { calls.push(["scale", ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    fill() { calls.push(["fill"]); },
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
      const isHazard = Object.values(hazardPaths).includes(value);
      assert.ok(Object.values(backgroundPaths).includes(value) || isHazard);
      const file = path.posix.basename(value);
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      const expectedSize = isHazard ? hazardSize : backgroundSize;
      this.naturalWidth = file === invalidFile
        ? expectedSize.w - 1
        : expectedSize.w;
      this.naturalHeight = expectedSize.h;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "alien-jungle-platform-kit"
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "alienJungle");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "alienJungle");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Alien Jungle visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.alienJungleVisualsForTest = ALIEN_JUNGLE_ASSET_VISUALS;
  `, context, {filename: "alien-jungle-background-fixture.js"});
  return {
    api: context.alienJungleVisualsForTest,
    loadedPaths,
    platformVisuals,
    recording,
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

function captureHazard(fixture, visualTime, rect = hazardRect) {
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
assert.deepEqual(fixture.loadedPaths, [
  ...Object.values(backgroundPaths),
  ...Object.values(hazardPaths)
]);
const status = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, backgroundPaths);
assert.deepEqual(status.expectedNativeSize, backgroundSize);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.deepEqual(status.staticLayers, [
  "skybox", "planets", "jungleBack", "jungleFront"
]);
assert.deepEqual(status.renderOrder, [
  "skybox",
  "planets",
  "jungleBack",
  "backPlantGlows",
  "colorfulFireflies",
  "jungleFront",
  "frontPlantGlows",
  "gameplay"
]);
assert.equal(status.backPlantGlows.length, 12);
assert.equal(status.frontPlantGlows.length, 10);
assert.equal(status.fireflies.length, 24);
assert.deepEqual(status.backPlantGlows.map(glow => [glow.x, glow.y]), [
  [92, 196], [205, 450], [312, 552], [40, 568], [207, 628], [300, 673],
  [415, 397], [279, 520], [987, 550], [1083, 550], [1193, 591],
  [1183, 613]
]);
assert.deepEqual(status.frontPlantGlows.map(glow => [glow.x, glow.y]), [
  [94, 227], [19, 332], [145, 330], [194, 589], [152, 654],
  [355, 526], [1130, 290], [1055, 520], [1229, 586], [683, 679]
]);
for (const glow of [
  ...status.backPlantGlows,
  ...status.frontPlantGlows
]) {
  assert.ok(glow.x >= 0 && glow.x <= 1280);
  assert.ok(glow.y >= 0 && glow.y <= 720);
  assert.ok(glow.radius >= 32 && glow.radius <= 88);
  assert.ok(glow.alphaMin >= 0 && glow.alphaMin < glow.alphaMax);
  assert.ok(glow.alphaMax <= 0.62);
  assert.ok(glow.period >= 6.5);
  assert.match(glow.color, /^#[0-9a-f]{6}$/i);
}
assert.equal(new Set(status.backPlantGlows.map(glow => glow.phase)).size, 12);
assert.equal(new Set(status.frontPlantGlows.map(glow => glow.phase)).size, 10);
assert.deepEqual(status.fireflyAnimation, {
  count: 24,
  palette: fireflyPalette,
  pulseMinimumFactor: 0.48,
  compositeOperation: "screen",
  movement: "individual-bidirectional-sine-drift",
  drawOrder: "after-back-glows-before-jungle-front",
  deterministic: true
});
assert.deepEqual(
  [...new Set(status.fireflies.map(firefly => firefly.color))].sort(),
  [...fireflyPalette].sort()
);
assert.ok(status.fireflies.every(firefly => (
  firefly.radius >= 4.4 && firefly.radius <= 6.1 &&
  firefly.alpha >= 0.83 && firefly.alpha <= 0.95 &&
  firefly.driftAmplitudeX >= 9 && firefly.driftAmplitudeX <= 18 &&
  firefly.driftAmplitudeY >= 5 && firefly.driftAmplitudeY <= 10 &&
  firefly.driftPeriodX >= 18 && firefly.driftPeriodX <= 31 &&
  firefly.driftPeriodY >= 12 && firefly.driftPeriodY <= 21
)));
assert.equal(new Set(status.fireflies.map(firefly => firefly.pulsePeriod)).size, 24);
assert.equal(new Set(status.fireflies.map(firefly => firefly.pulsePhase)).size, 24);

const firefliesAtZero = JSON.parse(JSON.stringify(fixture.api.getFireflyMapping(0)));
const firefliesAtFive = JSON.parse(JSON.stringify(fixture.api.getFireflyMapping(5)));
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getFireflyMapping(5))),
  firefliesAtFive
);
assert.notDeepEqual(firefliesAtZero, firefliesAtFive);
for (let index = 0; index < firefliesAtFive.length; index++) {
  const source = status.fireflies[index];
  const mapped = firefliesAtFive[index];
  assert.ok(Math.abs(mapped.x - source.x) <= source.driftAmplitudeX);
  assert.ok(Math.abs(mapped.y - source.y) <= source.driftAmplitudeY);
  assert.ok(mapped.alpha >= source.alpha * 0.48);
  assert.ok(mapped.alpha <= source.alpha);
}
for (const layer of ["back", "front"]) {
  const source = layer === "back"
    ? status.backPlantGlows
    : status.frontPlantGlows;
  const atZero = JSON.parse(JSON.stringify(
    fixture.api.getPlantGlowMapping(layer, 0)
  ));
  const atFive = JSON.parse(JSON.stringify(
    fixture.api.getPlantGlowMapping(layer, 5)
  ));
  assert.deepEqual(
    JSON.parse(JSON.stringify(fixture.api.getPlantGlowMapping(layer, 5))),
    atFive
  );
  assert.notDeepEqual(atZero, atFive);
  for (let index = 0; index < source.length; index++) {
    assert.equal(atFive[index].x, source[index].x);
    assert.equal(atFive[index].y, source[index].y);
    assert.ok(atFive[index].alpha >= source[index].alphaMin);
    assert.ok(atFive[index].alpha <= source[index].alphaMax);
  }
}
assert.equal(fixture.api.getPlantGlowMapping("invalid", 0), null);

const atZero = captureBackground(fixture, 0);
const atFive = captureBackground(fixture, 5);
assert.equal(atZero.drawn, true);
const drawIndices = atZero.calls
  .map((call, index) => call[0] === "drawImage" ? index : -1)
  .filter(index => index >= 0);
assert.equal(drawIndices.length, 4);
const [skyboxIndex, planetsIndex, backIndex, frontIndex] = drawIndices;
assert.deepEqual(drawIndices.map(index => atZero.calls[index][1].src), [
  backgroundPaths.skybox,
  backgroundPaths.planets,
  backgroundPaths.jungleBack,
  backgroundPaths.jungleFront
]);
for (const index of drawIndices) {
  assert.deepEqual(
    atZero.calls[index].slice(2),
    [0, 0, 1280, 720, 0, 0, 1280, 720]
  );
}
assert.ok(skyboxIndex < planetsIndex && planetsIndex < backIndex);
const effectsBeforeFront = atZero.calls.slice(backIndex + 1, frontIndex)
  .filter(call => call[0] === "createRadialGradient");
const effectsAfterFront = atZero.calls.slice(frontIndex + 1)
  .filter(call => call[0] === "createRadialGradient");
assert.equal(effectsBeforeFront.length, 12 + 24);
assert.equal(effectsAfterFront.length, 10);
assert.ok(effectsBeforeFront.slice(0, 12).every(call => call.at(-1) >= 32));
assert.ok(effectsBeforeFront.slice(12).every(call => call.at(-1) <= 6.1));
assert.ok(effectsAfterFront.every(call => call.at(-1) >= 32));
const fireflyGradientIds = new Set(
  effectsBeforeFront.slice(12).map(call => call[1])
);
const fireflyCoreStops = atZero.calls.filter(call => (
  call[0] === "radialColorStop" &&
  fireflyGradientIds.has(call[1]) &&
  call[2] === 0
));
assert.equal(fireflyCoreStops.length, 24);
assert.ok(fireflyCoreStops.every(call => (
  call[3].startsWith("rgba(255,255,238,")
)));
assert.deepEqual(
  atFive.calls.filter(call => call[0] === "drawImage").map(call => call.slice(2)),
  atZero.calls.filter(call => call[0] === "drawImage").map(call => call.slice(2))
);
assert.notDeepEqual(
  atFive.calls.filter(call => call[0] === "createRadialGradient"),
  atZero.calls.filter(call => call[0] === "createRadialGradient")
);
assert.notDeepEqual(
  atFive.calls.filter(call => call[0] === "radialColorStop" && call[2] === 0),
  atZero.calls.filter(call => call[0] === "radialColorStop" && call[2] === 0)
);
assert.equal(
  atZero.calls.filter(call => call[0] === "createRadialGradient").length,
  12 + 24 + 10
);
assert.equal(atZero.calls.filter(call => call[0] === "arc").length, 12 + 24 + 10);
assert.equal(
  atZero.calls.filter(call => (
    call[0] === "set" &&
    call[1] === "globalCompositeOperation" &&
    call[2] === "screen"
  )).length,
  3
);

const halfSize = captureBackground(fixture, 2, 640, 360);
assert.deepEqual(
  halfSize.calls.filter(call => call[0] === "drawImage").map(call => call.slice(-4)),
  Array.from({length: 4}, () => [0, 0, 640, 360])
);
assert.equal(halfSize.calls.filter(call => (
  call[0] === "scale" && call[1] === 0.5 && call[2] === 0.5
)).length, 3);
assert.equal(fixture.api.drawBackground(null, 1280, 720, 0), false);
assert.equal(fixture.api.drawBackground(fixture.recording.context, 0, 720, 0), false);

for (const relativePath of Object.values(backgroundPaths)) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["failedFile", "invalidFile"]) {
    const unavailable = loadFixture({[mode]: file});
    assert.equal(unavailable.api.isBackgroundReady(), false);
    const capture = captureBackground(unavailable, 2);
    assert.equal(capture.drawn, false);
    assert.equal(capture.calls.some(call => call[0] === "drawImage"), false);
  }
}

const hazardStatus = JSON.parse(JSON.stringify(fixture.api.getHazardStatus()));
assert.equal(hazardStatus.ready, true);
assert.deepEqual(hazardStatus.paths, hazardPaths);
assert.deepEqual(hazardStatus.contract, {
  native: {w: 1650, h: 60},
  runtime: {x: 235, y: 690, w: 825, h: 30},
  nativeToRuntimeScale: 0.5
});
assert.deepEqual(hazardStatus.validNativeSizes, {
  base: true,
  waveBack: true,
  waveFront: true
});
assert.deepEqual(hazardStatus.animation, {
  drawOrder: ["base", "waveBack", "waveFront"],
  base: {xSpeed: 0, ySpeed: 0, motion: "static"},
  waveBack: {
    leftSpeed: 8,
    direction: "right-to-left",
    bobAmplitude: 1.5,
    bobPeriod: 7.2,
    bobPhase: 0,
    nativeWrapOverlap: 3,
    runtimeWrapOverlap: 1.5,
    wrapDistance: 823.5,
    drawCopies: 2
  },
  waveFront: {
    leftSpeed: 14,
    direction: "right-to-left",
    bobAmplitude: 2,
    bobPeriod: 5.8,
    bobPhase: 1.1,
    nativeWrapOverlap: 0,
    runtimeWrapOverlap: 0,
    wrapDistance: 825,
    drawCopies: 2
  },
  deterministic: true
});

const hazardAtOne = JSON.parse(JSON.stringify(
  fixture.api.getBottomHazardMapping(1, hazardRect)
));
const hazardAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getBottomHazardMapping(2, hazardRect)
));
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getBottomHazardMapping(2, hazardRect))),
  hazardAtTwo
);
assert.deepEqual(hazardAtOne.source, hazardSize);
assert.deepEqual(hazardAtOne.base, {
  offsetX: 0,
  offsetY: 0,
  destination: {x: 235, y: 690, w: 825, h: 30}
});
assert.equal(hazardAtOne.waveBack.offsetX, -8);
assert.equal(hazardAtTwo.waveBack.offsetX, -16);
assert.equal(hazardAtOne.waveFront.offsetX, -14);
assert.equal(hazardAtTwo.waveFront.offsetX, -28);
assert.ok(hazardAtTwo.waveBack.offsetX < hazardAtOne.waveBack.offsetX);
assert.ok(hazardAtTwo.waveFront.offsetX < hazardAtOne.waveFront.offsetX);
assert.ok(Math.abs(hazardAtOne.waveBack.offsetY) <= 1.5);
assert.ok(Math.abs(hazardAtTwo.waveBack.offsetY) <= 1.5);
assert.ok(Math.abs(hazardAtOne.waveFront.offsetY) <= 2);
assert.ok(Math.abs(hazardAtTwo.waveFront.offsetY) <= 2);
assert.notEqual(hazardAtTwo.waveBack.offsetY, hazardAtOne.waveBack.offsetY);
assert.notEqual(hazardAtTwo.waveFront.offsetY, hazardAtOne.waveFront.offsetY);
for (const wave of [hazardAtOne.waveBack, hazardAtOne.waveFront]) {
  assert.equal(wave.destinations.length, 2);
  assert.equal(
    wave.destinations[1].x - wave.destinations[0].x,
    wave.wrapDistance
  );
  assert.ok(wave.destinations.every(destination => (
    destination.y === 690 + wave.offsetY &&
    destination.w === 825 &&
    destination.h === 30
  )));
}
assert.equal(
  fixture.api.getBottomHazardMapping(823.5 / 8, hazardRect).waveBack.offsetX,
  0
);
assert.equal(
  fixture.api.getBottomHazardMapping(825 / 14, hazardRect).waveFront.offsetX,
  0
);
assert.equal(
  fixture.api.getBottomHazardMapping(0, {...hazardRect, y: 689}),
  null
);

const hazardDrawAtOne = captureHazard(fixture, 1);
const hazardDrawAtTwo = captureHazard(fixture, 2);
assert.equal(hazardDrawAtOne.drawn, true);
assert.equal(hazardDrawAtTwo.drawn, true);
const hazardDrawsAtOne = hazardDrawAtOne.calls.filter(call => (
  call[0] === "drawImage"
));
const hazardDrawsAtTwo = hazardDrawAtTwo.calls.filter(call => (
  call[0] === "drawImage"
));
assert.deepEqual(hazardDrawsAtOne.map(call => call[1].src), [
  hazardPaths.base,
  hazardPaths.waveBack,
  hazardPaths.waveBack,
  hazardPaths.waveFront,
  hazardPaths.waveFront
]);
assert.deepEqual(
  hazardDrawsAtOne[0].slice(2),
  [0, 0, 1650, 60, 235, 690, 825, 30]
);
assert.deepEqual(hazardDrawsAtTwo[0], hazardDrawsAtOne[0]);
assert.ok(hazardDrawsAtOne.slice(1).every(call => (
  call[2] === 0 && call[3] === 0 &&
  call[4] === 1650 && call[5] === 60 &&
  call[8] === 825 && call[9] === 30
)));
assert.notDeepEqual(
  hazardDrawsAtTwo.slice(1).map(call => call.slice(6)),
  hazardDrawsAtOne.slice(1).map(call => call.slice(6))
);
assert.equal(captureHazard(fixture, 0, {...hazardRect, x: 234}).drawn, false);
assert.equal(fixture.api.drawBottomDeathHazard(null, hazardRect, 0), false);

for (const relativePath of Object.values(hazardPaths)) {
  const file = path.posix.basename(relativePath);
  for (const mode of ["failedFile", "invalidFile"]) {
    const unavailable = loadFixture({[mode]: file});
    assert.equal(unavailable.api.isBackgroundReady(), true);
    assert.equal(captureBackground(unavailable, 2).drawn, true);
    assert.equal(unavailable.api.isHazardReady(), false);
    assert.equal(captureHazard(unavailable, 2).drawn, false);
  }
}

const scriptIndex = indexSource.indexOf("./js/visual-alien-jungle-assets.js");
assert.ok(scriptIndex >= 0);
assert.ok(scriptIndex > indexSource.indexOf("./js/visual-platform-kit.js"));
assert.ok(scriptIndex < indexSource.indexOf("./js/renderer.js"));
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{[\s\S]*?drawBackground\(biome\)/
);
assert.match(biomeSource, /alienJungle: drawAlienJungleBackground/);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.register\("alienJungle"/);
assert.doesNotMatch(visualSource, /Math\.random\(/);
assert.doesNotMatch(visualSource, /fog/i);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)/
);
assert.match(
  hazardsSource,
  /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\)/
);
assert.match(
  levelGeneratorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\)/
);

console.log(
  "Alien Jungle background, plant glows, fireflies and animated three-layer hazard tests passed."
);
