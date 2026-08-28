"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-mushroom-cave-assets.js");
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const backgroundPaths = Object.freeze({
  main:
    "assets/environments/mushroomCave/background/mushroomCave_background_main.png",
  front:
    "assets/environments/mushroomCave/background/mushroomCave_background_front.png"
});
const hazardPaths = Object.freeze({
  base:
    "assets/environments/mushroomCave/hazards/mushroomCave_hazard_base.png",
  waveBack:
    "assets/environments/mushroomCave/hazards/mushroomCave_hazard_wave_back.png",
  waveFront:
    "assets/environments/mushroomCave/hazards/mushroomCave_hazard_wave_front.png"
});
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const mushroomBiome = Object.freeze({
  id: "mushroomCave",
  hazard: Object.freeze({
    type: "toxic",
    fill: "#25133f",
    deep: "#080711",
    surface: "#4f867e",
    accent: "#78dec7"
  })
});

function getPngHeader(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  return Object.freeze({
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    interlace: bytes[28]
  });
}

assert.deepEqual(getPngHeader(backgroundPaths.main), {
  width: 1280,
  height: 720,
  bitDepth: 8,
  colorType: 2,
  interlace: 0
});
assert.deepEqual(getPngHeader(backgroundPaths.front), {
  width: 1280,
  height: 720,
  bitDepth: 8,
  colorType: 6,
  interlace: 0
});
for (const relativePath of Object.values(hazardPaths)) {
  assert.deepEqual(getPngHeader(relativePath), {
    width: 1650,
    height: 60,
    bitDepth: 8,
    colorType: 6,
    interlace: 0
  });
}

function createRecordingContext() {
  const calls = [];
  let gradientId = 0;
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    clip() { calls.push(["clip"]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    stroke() { calls.push(["stroke"]); },
    fill() { calls.push(["fill"]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    arc(...args) { calls.push(["arc", ...args]); },
    scale(...args) { calls.push(["scale", ...args]); },
    createRadialGradient(...args) {
      const id = gradientId++;
      calls.push(["createRadialGradient", id, ...args]);
      return {
        addColorStop(...stopArgs) {
          calls.push(["radialColorStop", id, ...stopArgs]);
        }
      };
    },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop(...stopArgs) {
          calls.push(["linearColorStop", ...stopArgs]);
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
      this.complete = true;
      const isHazard = value.includes("/hazards/");
      this.naturalWidth = file === invalidFile
        ? (isHazard ? 1649 : 1279)
        : (isHazard ? 1650 : 1280);
      this.naturalHeight = isHazard ? 60 : 720;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "mushroom-cave-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return false; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "mushroomCave");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "mushroomCave");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Mushroom Cave visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    ctx: recording.context,
    worldTime: 0
  });
  vm.runInContext(`${visualSource}
    ${hazardsSource}
    globalThis.mushroomCaveVisualsForTest = MUSHROOM_CAVE_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "mushroom-cave-background-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    platformVisuals,
    api: context.mushroomCaveVisualsForTest,
    drawDeathZone: context.drawDeathZoneForTest,
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

function captureHazard(fixture, visualTime, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, mushroomBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
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
assert.deepEqual(status.expectedNativeSize, {w: 1280, h: 720});
assert.equal(status.mainGlows.length, 13);
assert.equal(status.frontGlows.length, 6);
assert.equal(status.fireflies.length, 20);
assert.deepEqual(status.renderOrder, [
  "main-background",
  "main-glows",
  "fireflies",
  "front-layer",
  "front-glows",
  "gameplay"
]);
assert.deepEqual(status.fireflyAnimation, {
  count: 20,
  pulseMinimumFactor: 0.52,
  compositeOperation: "screen",
  colorFamily: "electric-blue-cyan",
  drawOrder: "between-main-and-front"
});
assert.deepEqual(status.mainGlows.map(glow => [glow.x, glow.y]), [
  [193, 176], [297, 365], [92, 484], [185, 549], [278, 581],
  [390, 437], [664, 384], [1081, 270], [1027, 353], [1201, 477],
  [1061, 593], [1125, 574], [1241, 582]
]);
assert.deepEqual(status.frontGlows.map(glow => [glow.x, glow.y]), [
  [84, 393], [161, 463], [205, 508],
  [1207, 410], [1154, 484], [1122, 586]
]);
assert.ok(status.mainGlows.length >= status.frontGlows.length * 2);
assert.ok(
  Math.max(...status.frontGlows.map(glow => glow.alphaMax)) <
  Math.min(...status.mainGlows.map(glow => glow.alphaMax))
);
assert.ok(status.mainGlows.every(glow => (
  glow.x >= 0 && glow.x <= 1280 &&
  glow.y >= 0 && glow.y <= 720 &&
  glow.radius >= 38 && glow.radius <= 110 &&
  glow.alphaMin < glow.alphaMax &&
  /^#[0-9a-f]{6}$/i.test(glow.color)
)));
assert.ok(status.frontGlows.every(glow => (
  glow.x >= 0 && glow.x <= 1280 &&
  glow.y >= 0 && glow.y <= 720 &&
  glow.radius >= 40 && glow.radius <= 82 &&
  glow.alphaMax <= 0.42 &&
  glow.alphaMin < glow.alphaMax
)));
assert.equal(new Set(status.mainGlows.map(glow => glow.period)).size, 13);
assert.equal(new Set(status.mainGlows.map(glow => glow.phase)).size, 13);
assert.equal(new Set(status.frontGlows.map(glow => glow.period)).size, 6);
assert.equal(new Set(status.frontGlows.map(glow => glow.phase)).size, 6);
assert.ok(status.fireflies.every(firefly => {
  const color = Number.parseInt(firefly.color.slice(1), 16);
  const red = color >> 16 & 0xff;
  const green = color >> 8 & 0xff;
  const blue = color & 0xff;
  return (
    red <= 70 &&
    green >= 140 && green <= 225 &&
    blue >= 250 &&
    blue - green >= 30 &&
    green - red >= 80
  );
}), "all fireflies must stay in the electric-blue/cyan color family");
assert.ok(status.fireflies.every(firefly => (
  firefly.radius >= 5.2 && firefly.radius <= 7 &&
  firefly.alpha >= 0.84 && firefly.alpha <= 0.96 &&
  firefly.driftAmplitudeX >= 10 && firefly.driftAmplitudeX <= 18 &&
  firefly.driftAmplitudeY >= 6 && firefly.driftAmplitudeY <= 10
)));
assert.equal(new Set(status.fireflies.map(firefly => firefly.pulsePeriod)).size, 20);
assert.equal(new Set(status.fireflies.map(firefly => firefly.pulsePhase)).size, 20);

const firefliesAtZero = JSON.parse(JSON.stringify(fixture.api.getFireflyMapping(0)));
const firefliesAtFive = JSON.parse(JSON.stringify(fixture.api.getFireflyMapping(5)));
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getFireflyMapping(5))),
  firefliesAtFive,
  "firefly mapping must be deterministic for identical visual time"
);
assert.notDeepEqual(firefliesAtZero, firefliesAtFive);
for (let index = 0; index < firefliesAtFive.length; index++) {
  const source = status.fireflies[index];
  const mapped = firefliesAtFive[index];
  assert.ok(Math.abs(mapped.x - source.x) <= source.driftAmplitudeX);
  assert.ok(Math.abs(mapped.y - source.y) <= source.driftAmplitudeY);
  assert.ok(mapped.alpha >= source.alpha * 0.52);
  assert.ok(mapped.alpha <= source.alpha);
}

const atZero = captureBackground(fixture, 0);
const atFive = captureBackground(fixture, 5);
assert.equal(atZero.drawn, true);
const drawIndices = atZero.calls
  .map((call, index) => call[0] === "drawImage" ? index : -1)
  .filter(index => index >= 0);
assert.equal(drawIndices.length, 2);
const [mainDrawIndex, frontDrawIndex] = drawIndices;
assert.equal(atZero.calls[mainDrawIndex][1].src, backgroundPaths.main);
assert.equal(atZero.calls[frontDrawIndex][1].src, backgroundPaths.front);
assert.deepEqual(atZero.calls[mainDrawIndex].slice(2), [
  0, 0, 1280, 720, 0, 0, 1280, 720
]);
assert.deepEqual(atZero.calls[frontDrawIndex].slice(2), [
  0, 0, 1280, 720, 0, 0, 1280, 720
]);
assert.deepEqual(
  atFive.calls.filter(call => call[0] === "drawImage").map(call => call.slice(2)),
  atZero.calls.filter(call => call[0] === "drawImage").map(call => call.slice(2)),
  "main and front layer transforms must stay static"
);

const effectsBeforeFront = atZero.calls.slice(mainDrawIndex + 1, frontDrawIndex)
  .filter(call => call[0] === "createRadialGradient");
const effectsAfterFront = atZero.calls.slice(frontDrawIndex + 1)
  .filter(call => call[0] === "createRadialGradient");
assert.equal(effectsBeforeFront.length, 13 + 20);
assert.equal(effectsAfterFront.length, 6);
assert.ok(effectsBeforeFront.slice(0, 13).every(call => call.at(-1) >= 38));
assert.ok(effectsBeforeFront.slice(13).every(call => call.at(-1) <= 7));
assert.ok(effectsAfterFront.every(call => call.at(-1) >= 40));
const fireflyGradientIds = new Set(
  effectsBeforeFront.slice(13).map(call => call[1])
);
const fireflyCoreStops = atZero.calls.filter(call => (
  call[0] === "radialColorStop" &&
  fireflyGradientIds.has(call[1]) &&
  call[2] === 0
));
assert.equal(fireflyCoreStops.length, 20);
assert.ok(fireflyCoreStops.every(call => (
  call[3].startsWith("rgba(210,244,255,")
)));
assert.equal(
  atZero.calls.filter(call => call[0] === "createRadialGradient").length,
  13 + 20 + 6
);
assert.equal(atZero.calls.filter(call => call[0] === "arc").length, 13 + 20 + 6);
assert.equal(
  atZero.calls.filter(call => call[0] === "radialColorStop").length,
  (13 + 20 + 6) * 4
);
assert.ok(atZero.calls.some(call => (
  call[0] === "set" &&
  call[1] === "globalCompositeOperation" &&
  call[2] === "screen"
)));
assert.notDeepEqual(
  atZero.calls.filter(call => call[0] === "radialColorStop" && call[2] === 0),
  atFive.calls.filter(call => call[0] === "radialColorStop" && call[2] === 0),
  "glow and firefly pulses must evolve over time"
);

const halfSize = captureBackground(fixture, 2, 640, 360);
assert.equal(
  halfSize.calls.filter(call => (
    call[0] === "scale" && call[1] === 0.5 && call[2] === 0.5
  )).length,
  2
);
assert.equal(fixture.api.drawBackground(null, 1280, 720, 0), false);
assert.equal(fixture.api.drawBackground(fixture.recording.context, 0, 720, 0), false);

for (const file of Object.values(backgroundPaths).map(
  filePath => path.posix.basename(filePath)
)) {
  for (const mode of ["failedFile", "invalidFile"]) {
    const fallback = loadFixture({[mode]: file});
    const capture = captureBackground(fallback, 2);
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
assert.deepEqual(hazardStatus.animation.drawOrder, [
  "base",
  "waveBack",
  "waveFront"
]);
assert.deepEqual(hazardStatus.animation.base, {
  xSpeed: 0,
  ySpeed: 0,
  rotation: 0,
  motion: "static"
});
assert.deepEqual(hazardStatus.animation.waveBack, {
  leftSpeed: 9,
  ySpeed: 0,
  rotation: 0,
  direction: "right-to-left",
  nativeWrapOverlap: 0,
  runtimeWrapOverlap: 0,
  wrapDistance: 825,
  drawCopies: 2
});
assert.deepEqual(hazardStatus.animation.waveFront, {
  leftSpeed: 16,
  ySpeed: 0,
  rotation: 0,
  direction: "right-to-left",
  nativeWrapOverlap: 1,
  runtimeWrapOverlap: 0.5,
  wrapDistance: 824.5,
  drawCopies: 2
});
assert.equal(hazardStatus.animation.deterministic, true);

const hazardMappingAtZero = JSON.parse(JSON.stringify(
  fixture.api.getBottomHazardMapping(0, hazardRect)
));
const hazardMappingAtFive = JSON.parse(JSON.stringify(
  fixture.api.getBottomHazardMapping(5, hazardRect)
));
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getBottomHazardMapping(5, hazardRect))),
  hazardMappingAtFive,
  "hazard mapping must be deterministic for identical visual time"
);
assert.deepEqual(hazardMappingAtZero.base, {
  offsetX: 0,
  offsetY: 0,
  destination: {x: 235, y: 690, w: 825, h: 30}
});
assert.deepEqual(hazardMappingAtFive.base, hazardMappingAtZero.base);
assert.equal(hazardMappingAtZero.waveBack.offsetX, 0);
assert.equal(hazardMappingAtZero.waveFront.offsetX, 0);
assert.equal(hazardMappingAtFive.waveBack.offsetX, -45);
assert.equal(hazardMappingAtFive.waveFront.offsetX, -80);
assert.ok(
  Math.abs(hazardMappingAtFive.waveFront.offsetX) >
  Math.abs(hazardMappingAtFive.waveBack.offsetX)
);
assert.ok([
  ...hazardMappingAtFive.waveBack.destinations,
  ...hazardMappingAtFive.waveFront.destinations
].every(destination => (
  destination.y === hazardRect.y &&
  destination.w === hazardRect.w &&
  destination.h === hazardRect.h
)));
assert.equal(
  hazardMappingAtZero.waveBack.destinations[1].x -
    hazardMappingAtZero.waveBack.destinations[0].x,
  825
);
assert.equal(
  hazardMappingAtZero.waveFront.destinations[1].x -
    hazardMappingAtZero.waveFront.destinations[0].x,
  824.5
);
for (const changedRect of [
  {...hazardRect, x: 234},
  {...hazardRect, y: 689},
  {...hazardRect, w: 824},
  {...hazardRect, h: 29}
]) {
  assert.equal(fixture.api.getBottomHazardMapping(0, changedRect), null);
}

const hazardAtZero = captureHazard(fixture, 0);
const hazardAtFive = captureHazard(fixture, 5);
const hazardDrawsAtZero = hazardAtZero.filter(call => call[0] === "drawImage");
const hazardDrawsAtFive = hazardAtFive.filter(call => call[0] === "drawImage");
assert.equal(hazardDrawsAtZero.length, 5);
assert.deepEqual(hazardDrawsAtZero.map(call => call[1].src), [
  hazardPaths.base,
  hazardPaths.waveBack,
  hazardPaths.waveBack,
  hazardPaths.waveFront,
  hazardPaths.waveFront
]);
assert.deepEqual(hazardDrawsAtZero[0].slice(2), [
  0, 0, 1650, 60, 235, 690, 825, 30
]);
assert.deepEqual(
  hazardDrawsAtFive[0].slice(2),
  hazardDrawsAtZero[0].slice(2),
  "hazard base must stay static"
);
assert.ok(hazardDrawsAtFive.every(call => call[7] === hazardRect.y));
assert.equal(hazardDrawsAtZero[1][6] - hazardDrawsAtFive[1][6], 45);
assert.equal(hazardDrawsAtZero[3][6] - hazardDrawsAtFive[3][6], 80);
assert.equal(hazardAtFive.some(call => call[0] === "fillRect"), false);
assert.equal(hazardAtFive.some(call => call[0] === "stroke"), false);
assert.equal(
  fixture.api.drawBottomDeathHazard(null, hazardRect, 0),
  false
);

for (const file of Object.values(hazardPaths).map(
  filePath => path.posix.basename(filePath)
)) {
  for (const mode of ["failedFile", "invalidFile"]) {
    const fallback = loadFixture({[mode]: file});
    const calls = captureHazard(fallback, 2);
    assert.equal(calls.some(call => call[0] === "drawImage"), false);
    assert.ok(calls.some(call => call[0] === "fillRect"));
    assert.ok(calls.some(call => call[0] === "stroke"));
  }
}
assert.ok(captureHazard(fixture, 2, null).some(call => call[0] === "fillRect"));
assert.ok(captureHazard(fixture, 2, {}).some(call => call[0] === "fillRect"));

const rendererDrawSource = rendererSource.slice(rendererSource.indexOf("  function draw()"));
assert.ok(
  rendererDrawSource.indexOf("biomePlatformVisuals.drawBackground") <
  rendererDrawSource.indexOf("drawPlatforms(")
);
const indexSource = read("index.html");
const mushroomScriptIndex = indexSource.indexOf(
  "./js/visual-mushroom-cave-assets.js"
);
assert.ok(mushroomScriptIndex >= 0);
assert.ok(
  mushroomScriptIndex < indexSource.indexOf("./js/renderer.js"),
  "Mushroom Cave visuals must register before the renderer starts"
);
assert.doesNotMatch(visualSource, /Math\.random\(|getImageData|createElement/);
assert.doesNotMatch(visualSource, /\.rotate\(/);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)/
);
assert.match(
  read("js/level-generator.js"),
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  read("js/physics.js"),
  /isBottomDeathHazard === true/
);

console.log(
  "Mushroom Cave background, fireflies, layered horizontal hazard loops and fallback tests passed."
);
