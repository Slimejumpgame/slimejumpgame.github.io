"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const visualSource = read("js/visual-crystal-cave-assets.js");
const hazardsSource = read("js/hazards.js");
const rendererSource = read("js/renderer.js");
const backgroundPath =
  "assets/environments/crystalCave/background/crystalCave_background_base.png";
const hazardPaths = Object.freeze(Array.from({length: 7}, (_, index) => (
  `assets/environments/crystalCave/hazards/crystalCave_hazard_${String(index + 1).padStart(2, "0")}.png`
)));
const expectedSourceBounds = Object.freeze([
  {x: 57, y: 8, w: 138, h: 289},
  {x: 55, y: 8, w: 138, h: 289},
  {x: 55, y: 8, w: 201, h: 289},
  {x: 25, y: 8, w: 170, h: 289},
  {x: 4, y: 8, w: 190, h: 295},
  {x: 55, y: 8, w: 166, h: 295},
  {x: 52, y: 8, w: 140, h: 294}
]);
const hazardRect = Object.freeze({x: 235, y: 690, w: 825, h: 30});
const crystalBiome = Object.freeze({
  id: "crystalCave",
  hazard: Object.freeze({
    type: "crystalPit",
    fill: "#090b1b",
    deep: "#03040b",
    surface: "#674d9c",
    accent: "#65e4ff"
  })
});

function decodeRgbaPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must be RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);
  const idatChunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0, sourceOffset = 0; y < height; y++) {
    const filter = inflated[sourceOffset++];
    for (let x = 0; x < stride; x++, sourceOffset++) {
      const raw = inflated[sourceOffset];
      const left = x >= bytesPerPixel
        ? pixels[y * stride + x - bytesPerPixel]
        : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[(y - 1) * stride + x - bytesPerPixel]
        : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + up
            : filter === 3 ? raw + Math.floor((left + up) / 2)
              : raw + paeth(left, up, upperLeft);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return {width, height, pixels, stride};
}

function getVisibleBounds(decoded) {
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.pixels[y * decoded.stride + x * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1};
}

const background = decodeRgbaPng(backgroundPath);
assert.deepEqual({w: background.width, h: background.height}, {w: 1280, h: 720});
for (let index = 0; index < hazardPaths.length; index++) {
  const decoded = decodeRgbaPng(hazardPaths[index]);
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 256, h: 320});
  assert.deepEqual(
    getVisibleBounds(decoded),
    expectedSourceBounds[index],
    `${hazardPaths[index]} source bounds must stay mapped to its visible spike`
  );
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
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop(...stopArgs) { calls.push(["linearColorStop", ...stopArgs]); }
      };
    },
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
      const isBackground = value.includes("/background/");
      this.complete = true;
      this.naturalWidth = file === invalidFile
        ? (isBackground ? 1279 : 255)
        : (isBackground ? 1280 : 256);
      this.naturalHeight = isBackground ? 720 : 320;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const platformVisuals = Object.freeze({
    platformMarker: "crystal-cave-platform-kit",
    resolvePlatformRole() { return null; },
    drawPlatformBase() { return false; }
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "crystalCave");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "crystalCave");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Crystal Cave visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    Math: visualMath,
    Promise,
    ctx: recording.context,
    worldTime: 0,
    drawCrystalShape(...args) {
      recording.calls.push(["drawCrystalShape", ...args]);
    }
  });
  vm.runInContext(`${visualSource}
    ${hazardsSource}
    globalThis.crystalCaveVisualsForTest = CRYSTAL_CAVE_ASSET_VISUALS;
    globalThis.drawDeathZoneForTest = drawDeathZone;
  `, context, {filename: "crystal-cave-visuals-fixture.js"});
  return {
    context,
    recording,
    loadedPaths,
    platformVisuals,
    api: context.crystalCaveVisualsForTest,
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

function captureHazard(fixture, visualTime = 0, visuals = fixture.api) {
  fixture.context.worldTime = visualTime;
  fixture.recording.calls.length = 0;
  fixture.drawDeathZone(hazardRect, crystalBiome, visuals);
  return fixture.recording.calls.map(call => [...call]);
}

const fixture = loadFixture();
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.deepEqual(fixture.loadedPaths, [backgroundPath, ...hazardPaths]);

const backgroundStatus = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(backgroundStatus.ready, true);
assert.equal(backgroundStatus.path, backgroundPath);
assert.deepEqual(backgroundStatus.expectedNativeSize, {w: 1280, h: 720});
assert.equal(backgroundStatus.glowMap.length, 26);
assert.deepEqual(backgroundStatus.glowAnimation, {
  pulseMinimumFactor: 0.24,
  pulseMaximumFactor: 1,
  innerColorStopPosition: 0.18,
  innerColorStopAlphaFactor: 0.92,
  middleColorStopPosition: 0.52,
  middleColorStopAlphaFactor: 0.62,
  compositeOperation: "screen"
});
assert.equal(backgroundStatus.lightMotes.length, 15);
assert.deepEqual(backgroundStatus.lightMoteAnimation, {
  count: 15,
  pulseMinimumFactor: 0.38,
  compositeOperation: "screen",
  drawOrder: "after-crystal-glows"
});
assert.ok(backgroundStatus.lightMotes.every(mote => {
  const colorValue = Number.parseInt(mote.color.slice(1), 16);
  const red = colorValue >> 16 & 0xff;
  const green = colorValue >> 8 & 0xff;
  const blue = colorValue & 0xff;
  return green > red && green > blue;
}), "all light motes must remain visibly green-tinted");
assert.ok(backgroundStatus.lightMotes.every(mote => (
  mote.radius >= 4 && mote.radius <= 6 &&
  mote.alpha >= 0.44 && mote.alpha <= 0.61 &&
  mote.driftAmplitudeX >= 10 && mote.driftAmplitudeX <= 18 &&
  mote.driftAmplitudeY >= 5 && mote.driftAmplitudeY <= 10
)));
assert.ok(new Set(backgroundStatus.lightMotes.map(mote => mote.pulsePeriod)).size >= 10);
assert.ok(new Set(backgroundStatus.lightMotes.map(mote => mote.pulsePhase)).size >= 10);
const glowsByDepth = {};
for (const glow of backgroundStatus.glowMap) {
  (glowsByDepth[glow.depth] ??= []).push(glow);
}
assert.deepEqual(Object.keys(glowsByDepth).sort(), ["back", "front", "middle"]);
assert.ok(Math.max(...glowsByDepth.back.map(glow => glow.radius)) <
  Math.min(...glowsByDepth.front.map(glow => glow.radius)));
assert.ok(Math.max(...glowsByDepth.back.map(glow => glow.strength)) <
  Math.min(...glowsByDepth.front.map(glow => glow.strength)));
assert.ok(Math.min(...glowsByDepth.back.map(glow => glow.radius)) >= 40);
assert.ok(Math.min(...glowsByDepth.middle.map(glow => glow.radius)) >= 60);
assert.ok(Math.min(...glowsByDepth.front.map(glow => glow.radius)) >= 110);
assert.ok(Math.min(...glowsByDepth.back.map(glow => glow.strength)) >= 0.120);
assert.ok(Math.min(...glowsByDepth.middle.map(glow => glow.strength)) >= 0.250);
assert.ok(Math.min(...glowsByDepth.front.map(glow => glow.strength)) >= 0.450);
assert.ok(new Set(backgroundStatus.glowMap.map(glow => glow.period)).size > 20);
assert.ok(new Set(backgroundStatus.glowMap.map(glow => glow.phase)).size > 20);
assert.ok(backgroundStatus.glowMap.every(glow => (
  glow.x >= 0 && glow.x <= 1280 &&
  glow.y >= 0 && glow.y <= 720 &&
  /^#[0-9a-f]{6}$/i.test(glow.color)
)));

const backgroundAtZero = captureBackground(fixture, 0);
const backgroundAtFive = captureBackground(fixture, 5);
const motesAtZero = JSON.parse(JSON.stringify(fixture.api.getLightMoteMapping(0)));
const motesAtFive = JSON.parse(JSON.stringify(fixture.api.getLightMoteMapping(5)));
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getLightMoteMapping(5))),
  motesAtFive,
  "light mote mapping must be deterministic for the same visual time"
);
assert.notDeepEqual(motesAtFive, motesAtZero);
for (let index = 0; index < motesAtFive.length; index++) {
  const sourceMote = backgroundStatus.lightMotes[index];
  const mappedMote = motesAtFive[index];
  assert.ok(Math.abs(mappedMote.x - sourceMote.x) <= sourceMote.driftAmplitudeX);
  assert.ok(Math.abs(mappedMote.y - sourceMote.y) <= sourceMote.driftAmplitudeY);
  assert.ok(mappedMote.alpha >= sourceMote.alpha * 0.38);
  assert.ok(mappedMote.alpha <= sourceMote.alpha);
}
assert.equal(backgroundAtZero.drawn, true);
const backgroundDrawAtZero = backgroundAtZero.calls.find(call => call[0] === "drawImage");
const backgroundDrawAtFive = backgroundAtFive.calls.find(call => call[0] === "drawImage");
assert.deepEqual(backgroundDrawAtZero.slice(2), [0, 0, 1280, 720, 0, 0, 1280, 720]);
assert.deepEqual(backgroundDrawAtFive, backgroundDrawAtZero, "background base must stay static");
const radialGradientsAtZero = backgroundAtZero.calls.filter(
  call => call[0] === "createRadialGradient"
);
assert.equal(radialGradientsAtZero.length, 26 + 15);
assert.equal(backgroundAtZero.calls.filter(call => call[0] === "arc").length, 26 + 15);
assert.equal(
  backgroundAtZero.calls.filter(call => call[0] === "radialColorStop").length,
  26 * 4 + 15 * 3
);
assert.ok(radialGradientsAtZero.slice(0, 26).every(call => call.at(-1) >= 40));
assert.ok(radialGradientsAtZero.slice(26).every(call => call.at(-1) <= 6));
assert.ok(backgroundAtZero.calls.some(call => (
  call[0] === "set" && call[1] === "globalCompositeOperation" && call[2] === "screen"
)));
assert.notDeepEqual(
  backgroundAtZero.calls.filter(call => call[0] === "radialColorStop" && call[2] === 0),
  backgroundAtFive.calls.filter(call => call[0] === "radialColorStop" && call[2] === 0),
  "independent glow pulses must change over time"
);
const halfSize = captureBackground(fixture, 2, 640, 360);
assert.ok(halfSize.calls.some(call => (
  call[0] === "scale" && call[1] === 0.5 && call[2] === 0.5
)));

const hazardStatus = JSON.parse(JSON.stringify(
  fixture.api.getBottomSpikeHazardStatus()
));
assert.equal(hazardStatus.ready, true);
assert.deepEqual(hazardStatus.paths, hazardPaths);
assert.deepEqual(hazardStatus.expectedNativeSize, {w: 256, h: 320});
assert.deepEqual(hazardStatus.sourceBounds, expectedSourceBounds);
assert.deepEqual(hazardStatus.runtimeRect, hazardRect);
assert.equal(hazardStatus.spacingTarget, 24);
assert.equal(hazardStatus.distribution, "index-modulo-7");

const mapping = fixture.api.getBottomSpikeHazardMapping(hazardRect);
assert.equal(mapping.count, 34);
assert.equal(mapping.step, 24.264705882352942);
assert.equal(mapping.destinations.length, 34);
for (let index = 0; index < mapping.destinations.length; index++) {
  const item = mapping.destinations[index];
  assert.equal(item.variantIndex, index % 7);
  assert.equal(item.destination.x, hazardRect.x + index * mapping.step);
  assert.equal(item.destination.y, hazardRect.y);
  assert.equal(item.destination.w, mapping.step);
  assert.equal(item.destination.h, hazardRect.h);
}
assert.ok(Math.abs(
  mapping.destinations.at(-1).destination.x + mapping.step -
  (hazardRect.x + hazardRect.w)
) < 1e-9);
assert.equal(fixture.api.getBottomSpikeHazardMapping({...hazardRect, h: 29}), null);

const hazardAtZero = captureHazard(fixture, 0);
const hazardAtTen = captureHazard(fixture, 10);
const spikeDrawsAtZero = hazardAtZero.filter(call => call[0] === "drawImage");
const spikeDrawsAtTen = hazardAtTen.filter(call => call[0] === "drawImage");
assert.equal(spikeDrawsAtZero.length, 34);
assert.deepEqual(spikeDrawsAtTen, spikeDrawsAtZero, "spike variants must be time-independent");
for (let index = 0; index < spikeDrawsAtZero.length; index++) {
  const call = spikeDrawsAtZero[index];
  const expectedVariant = index % 7;
  assert.equal(call[1].src, hazardPaths[expectedVariant]);
  assert.deepEqual(call.slice(2, 6), Object.values(expectedSourceBounds[expectedVariant]));
  assert.equal(call[6], hazardRect.x + index * mapping.step);
  assert.equal(call[7], hazardRect.y);
  assert.equal(call[8], mapping.step);
  assert.equal(call[9], hazardRect.h);
  assert.equal(call[7] + call[9], 720);
}
assert.ok(hazardAtZero.some(call => (
  call[0] === "rect" && JSON.stringify(call.slice(1)) === JSON.stringify([235, 690, 825, 30])
)));
assert.ok(hazardAtZero.some(call => call[0] === "clip"));
assert.equal(hazardAtZero.some(call => call[0] === "fillRect"), false);
assert.equal(hazardAtZero.some(call => call[0] === "drawCrystalShape"), false);

for (const assetPath of hazardPaths) {
  const file = path.posix.basename(assetPath);
  for (const mode of ["failedFile", "invalidFile"]) {
    const fallback = loadFixture({[mode]: file});
    const calls = captureHazard(fallback);
    assert.equal(calls.some(call => call[0] === "drawImage"), false);
    assert.ok(calls.some(call => call[0] === "fillRect"));
    assert.ok(calls.some(call => call[0] === "stroke"));
    assert.ok(calls.some(call => call[0] === "drawCrystalShape"));
  }
}
for (const mode of ["failedFile", "invalidFile"]) {
  const missingBackground = loadFixture({
    [mode]: path.posix.basename(backgroundPath)
  });
  const capture = captureBackground(missingBackground, 2);
  assert.equal(capture.drawn, false);
  assert.equal(capture.calls.some(call => call[0] === "drawImage"), false);
}
assert.ok(captureHazard(fixture, 2, null).some(call => call[0] === "fillRect"));
assert.ok(captureHazard(fixture, 2, {}).some(call => call[0] === "fillRect"));

assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)/
);
assert.match(
  rendererSource,
  /for \(const s of level\.spikes\) drawDeathZone\(s, biome, platformVisuals\);/
);
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)/
);
const rendererDrawSource = rendererSource.slice(rendererSource.indexOf("  function draw()"));
assert.ok(
  rendererDrawSource.indexOf("biomePlatformVisuals.drawBackground") <
  rendererDrawSource.indexOf("drawPlatforms(")
);
assert.match(
  read("index.html"),
  /js\/visual-swamp-assets\.js[\s\S]*js\/visual-crystal-cave-assets\.js[\s\S]*js\/renderer\.js/
);
assert.doesNotMatch(visualSource, /Math\.random\(|getImageData|createElement/);
assert.match(visualSource, /const variantIndex = index % HAZARD_VARIANTS\.length;/);
assert.match(hazardsSource, /const count = Math\.max\(2, Math\.floor\(s\.w \/ 24\)\);/);
assert.match(
  read("js/level-generator.js"),
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
);
assert.match(
  read("js/physics.js"),
  /return \{x: spike\.x \+ 5, y: spike\.y \+ 5, w: spike\.w - 10, h: spike\.h \+ 22\};/
);
assert.match(read("js/physics.js"), /player\.r \* 0\.72/);
assert.match(read("js/core.js"), /const BOTTOM_DEATH_THRESHOLD = H \+ 140;/);

for (const relativePath of [
  "js/biomes.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js"
]) {
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(read(relativePath)),
    normalize(baseline),
    `${relativePath} must remain unchanged by Crystal Cave visual integration`
  );
}

console.log("Crystal Cave hazard mapping, deterministic variants, glow map, light motes and fallback tests passed.");
