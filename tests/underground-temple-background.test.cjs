"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-underground-temple-assets.js");
const rendererSource = read("js/renderer.js");
const biomeSource = read("js/biomes.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const physicsSource = read("js/physics.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/undergroundTemple/background";
const backgroundPaths = Object.freeze({
  back: `${backgroundDirectory}/undergroundTemple_background_back.png`,
  godRay: `${backgroundDirectory}/undergroundTemple_background_godray.png`,
  pedestal: `${backgroundDirectory}/undergroundTemple_background_pedestal.png`,
  depth: `${backgroundDirectory}/undergroundTemple_background_depth.png`,
  front: `${backgroundDirectory}/undergroundTemple_background_front.png`
});
const backgroundSize = Object.freeze({w: 1280, h: 720});
const hazardDirectory = "assets/environments/undergroundTemple/hazards";
const hazardPath = `${hazardDirectory}/undergroundTemple_hazard_back.png`;
const hazardSize = Object.freeze({w: 1650, h: 60});
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
const allAssetPaths = Object.freeze([
  ...Object.values(backgroundPaths),
  hazardPath
]);

function decodePng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8);
  assert.ok(colorType === 2 || colorType === 6);
  const channels = colorType === 6 ? 4 : 3;
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0, packedOffset = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= channels
        ? pixels[(y - 1) * stride + x - channels]
        : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (packed[packedOffset++] + predictor) & 0xff;
    }
  }
  return Object.freeze({width, height, colorType, channels, pixels});
}

function getAlphaUsage(decoded) {
  if (decoded.channels === 3) {
    return Object.freeze({
      hasVisiblePixels: true,
      hasTransparentPixels: false
    });
  }
  let hasVisiblePixels = false;
  let hasTransparentPixels = false;
  for (let index = 3; index < decoded.pixels.length; index += 4) {
    const alpha = decoded.pixels[index];
    if (alpha > 0) hasVisiblePixels = true;
    if (alpha < 255) hasTransparentPixels = true;
    if (hasVisiblePixels && hasTransparentPixels) break;
  }
  return Object.freeze({hasVisiblePixels, hasTransparentPixels});
}

function countCyanPixels(decoded, center, radius) {
  let count = 0;
  const left = Math.max(0, Math.floor(center.x - radius));
  const right = Math.min(decoded.width - 1, Math.ceil(center.x + radius));
  const top = Math.max(0, Math.floor(center.y - radius));
  const bottom = Math.min(decoded.height - 1, Math.ceil(center.y + radius));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const offset = (y * decoded.width + x) * decoded.channels;
      const red = decoded.pixels[offset];
      const green = decoded.pixels[offset + 1];
      const blue = decoded.pixels[offset + 2];
      const alpha = decoded.channels === 4 ? decoded.pixels[offset + 3] : 255;
      if (
        alpha >= 48 &&
        green >= 115 &&
        blue >= 105 &&
        green - red >= 35 &&
        blue - red >= 20
      ) count++;
    }
  }
  return count;
}

function createRecordingContext() {
  const calls = [];
  const stateStack = [];
  const target = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    save() {
      stateStack.push({
        globalAlpha: this.globalAlpha,
        globalCompositeOperation: this.globalCompositeOperation
      });
      calls.push({type: "save"});
    },
    restore() {
      const state = stateStack.pop();
      if (state) Object.assign(this, state);
      calls.push({type: "restore"});
    },
    scale(x, y) {
      calls.push({type: "scale", x, y});
    },
    drawImage(image, ...args) {
      calls.push({
        type: "drawImage",
        path: image._src,
        args,
        alpha: this.globalAlpha,
        composite: this.globalCompositeOperation
      });
    },
    createRadialGradient(...args) {
      const gradient = {
        args,
        stops: [],
        addColorStop(offset, color) {
          this.stops.push({offset, color});
        }
      };
      calls.push({type: "gradient", gradient});
      return gradient;
    },
    beginPath() {
      calls.push({type: "beginPath"});
    },
    arc(x, y, radius) {
      calls.push({type: "arc", x, y, radius});
    },
    fill() {
      calls.push({type: "fill", composite: this.globalCompositeOperation});
    }
  };
  return {context: target, calls};
}

function loadFixture({
  failedFile = null,
  invalidFile = null,
  opaqueLayer = null,
  transparentLayer = null
} = {}) {
  const recording = createRecordingContext();
  const loadedPaths = [];
  let registeredVisuals = null;
  let analyzedImage = null;

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
      assert.ok(allAssetPaths.includes(value));
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      this.complete = true;
      const expectedSize = value === hazardPath ? hazardSize : backgroundSize;
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

  const analysisContext = {
    clearRect() {},
    drawImage(image) {
      analyzedImage = image;
    },
    getImageData() {
      const file = path.posix.basename(analyzedImage._src);
      const alphas = file === opaqueLayer
        ? [255, 255]
        : file === transparentLayer ? [0, 0] : [0, 255];
      return {data: Uint8ClampedArray.from(
        alphas.flatMap(alpha => [0, 0, 0, alpha])
      )};
    }
  };
  const math = Object.create(Math);
  math.random = () => assert.fail("Underground Temple visuals must be deterministic");
  const sandbox = {
    console,
    document: {
      createElement(name) {
        assert.equal(name, "canvas");
        return {
          width: 0,
          height: 0,
          getContext(type) {
            assert.equal(type, "2d");
            return analysisContext;
          }
        };
      }
    },
    Image: FakeImage,
    Math: math,
    BIOME_PLATFORM_VISUALS: {
      resolve(biomeId) {
        assert.equal(biomeId, "undergroundTemple");
        return Object.freeze({platformVisualsPreserved: true});
      },
      register(biomeId, visuals) {
        assert.equal(biomeId, "undergroundTemple");
        registeredVisuals = visuals;
        return visuals;
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${visualSource}\nthis.__templeVisuals = UNDERGROUND_TEMPLE_ASSET_VISUALS;`,
    sandbox
  );
  assert.equal(sandbox.__templeVisuals, registeredVisuals);
  return Object.freeze({
    visuals: registeredVisuals,
    recording,
    loadedPaths
  });
}

test("Underground Temple assets keep their native layer contracts", () => {
  assert.deepEqual(
    fs.readdirSync(path.join(root, backgroundDirectory)).sort(),
    Object.values(backgroundPaths).map(file => path.posix.basename(file)).sort()
  );
  for (const [name, relativePath] of Object.entries(backgroundPaths)) {
    const decoded = decodePng(relativePath);
    assert.deepEqual({w: decoded.width, h: decoded.height}, backgroundSize);
    if (name === "back") {
      assert.equal(decoded.colorType, 2);
      assert.deepEqual(getAlphaUsage(decoded), {
        hasVisiblePixels: true,
        hasTransparentPixels: false
      });
    } else {
      assert.equal(decoded.colorType, 6);
      assert.deepEqual(getAlphaUsage(decoded), {
        hasVisiblePixels: true,
        hasTransparentPixels: true
      });
    }
  }
  assert.deepEqual(
    fs.readdirSync(path.join(root, hazardDirectory)).sort(),
    [path.posix.basename(hazardPath)]
  );
  const hazard = decodePng(hazardPath);
  assert.deepEqual({w: hazard.width, h: hazard.height}, hazardSize);
  assert.equal(hazard.colorType, 6);
  assert.deepEqual(getAlphaUsage(hazard), {
    hasVisiblePixels: true,
    hasTransparentPixels: true
  });
});

test("runtime draws the full background and effects in the required order", async () => {
  const fixture = loadFixture();
  const {visuals, recording} = fixture;
  assert.equal(await visuals.whenBackgroundReady(), true);
  assert.equal(visuals.isBackgroundReady(), true);
  assert.equal(visuals.platformVisualsPreserved, true);
  assert.equal(visuals.drawBackground(recording.context, 1280, 720, 2.4), true);

  const imageCalls = recording.calls.filter(call => call.type === "drawImage");
  assert.deepEqual(
    imageCalls.map(call => call.path),
    [
      backgroundPaths.back,
      backgroundPaths.godRay,
      backgroundPaths.pedestal,
      backgroundPaths.depth,
      backgroundPaths.front
    ]
  );
  for (const call of imageCalls) {
    assert.deepEqual(call.args, [0, 0, 1280, 720, 0, 0, 1280, 720]);
    assert.equal(call.composite, "source-over");
  }

  const indices = Object.fromEntries(imageCalls.map(call => [
    path.posix.basename(call.path),
    recording.calls.indexOf(call)
  ]));
  const fillsBetween = (start, end) => recording.calls
    .slice(start + 1, end)
    .filter(call => call.type === "fill").length;
  assert.equal(
    fillsBetween(
      indices["undergroundTemple_background_back.png"],
      indices["undergroundTemple_background_godray.png"]
    ),
    9
  );
  assert.equal(
    fillsBetween(
      indices["undergroundTemple_background_pedestal.png"],
      indices["undergroundTemple_background_depth.png"]
    ),
    15
  );
  const pedestalEffectArcs = recording.calls
    .slice(
      indices["undergroundTemple_background_pedestal.png"] + 1,
      indices["undergroundTemple_background_depth.png"]
    )
    .filter(call => call.type === "arc");
  assert.equal(pedestalEffectArcs.length, 15);
  assert.ok(pedestalEffectArcs.slice(0, 5).every(call => call.radius >= 24));
  assert.ok(pedestalEffectArcs.slice(5).every(call => call.radius <= 5));
  assert.ok(recording.calls
    .filter(call => call.type === "fill")
    .every(call => call.composite === "screen"));
});

test("God Ray only breathes in alpha while all PNG destinations stay static", () => {
  const fixture = loadFixture();
  const status = fixture.visuals.getBackgroundStatus();
  assert.deepEqual(
    JSON.parse(JSON.stringify(status.baseLayerOrder)),
    ["back", "god-ray", "pedestal-and-golden-statue", "depth", "front", "gameplay"]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(status.renderOrder)),
    [
      "back",
      "back-rune-glows",
      "god-ray",
      "pedestal-and-golden-statue",
      "pedestal-rune-glows",
      "golden-statue-fireflies",
      "depth",
      "front",
      "gameplay"
    ]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(status.staticPositionLayers)),
    ["back", "godRay", "pedestal", "depth", "front"]
  );
  assert.deepEqual(status.godRayAnimation.alphaMin, 0.76);
  assert.deepEqual(status.godRayAnimation.alphaMax, 0.84);
  assert.deepEqual(status.godRayAnimation.periodSeconds, 6.2);
  assert.equal(status.godRayAnimation.positionMotion, "static");
  assert.equal(fixture.visuals.getGodRayAlpha(6.2 * 0.25), 0.84);
  assert.equal(fixture.visuals.getGodRayAlpha(6.2 * 0.75), 0.76);
  assert.ok(
    status.godRayAnimation.alphaMax / status.godRayAnimation.alphaMin <= 1.11
  );

  const first = loadFixture();
  const second = loadFixture();
  first.visuals.drawBackground(first.recording.context, 1024, 576, 0);
  second.visuals.drawBackground(second.recording.context, 1024, 576, 1.55);
  const firstImages = first.recording.calls.filter(call => call.type === "drawImage");
  const secondImages = second.recording.calls.filter(call => call.type === "drawImage");
  assert.deepEqual(
    firstImages.map(call => [call.path, call.args]),
    secondImages.map(call => [call.path, call.args])
  );
  const firstRay = firstImages.find(call => call.path === backgroundPaths.godRay);
  const secondRay = secondImages.find(call => call.path === backgroundPaths.godRay);
  assert.notEqual(firstRay.alpha, secondRay.alpha);
  assert.ok(firstImages.filter(call => call !== firstRay).every(call => call.alpha === 1));
  assert.ok(secondImages.filter(call => call !== secondRay).every(call => call.alpha === 1));
});

test("runes and ten golden fireflies are local, subtle, and deterministic", () => {
  const {visuals} = loadFixture();
  const status = visuals.getBackgroundStatus();
  assert.equal(status.backRuneGlows.length, 9);
  assert.equal(status.pedestalRuneGlows.length, 5);
  assert.equal(status.fireflies.length, 10);
  assert.equal(status.fireflyAnimation.count, 10);
  assert.equal(status.fireflyAnimation.colorFamily, "warm-gold");
  assert.equal(status.fireflyAnimation.placement, "local-to-golden-statue");
  assert.equal(status.fireflyAnimation.deterministic, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(status.backRuneGlows.map(glow => [glow.x, glow.y]))),
    [[195, 270], [430, 270], [853, 270], [1107, 270], [201, 480],
      [459, 480], [651, 480], [846, 480], [1123, 480]]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      status.pedestalRuneGlows.map(glow => [glow.x, glow.y])
    )),
    [[641, 357], [610, 400], [672, 400], [641, 499], [641, 579]]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(status.backRuneGlows.map(glow => glow.radius))),
    [44, 44, 44, 44, 45, 44, 45, 45, 46]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      status.pedestalRuneGlows.map(glow => glow.radius)
    )),
    [47, 29, 29, 38, 47]
  );
  assert.ok(status.backRuneGlows.every(glow => (
    glow.color.startsWith("#") &&
    glow.alphaMin >= 0.2 &&
    glow.alphaMax >= 0.46 &&
    glow.alphaMax <= 0.49 &&
    glow.alphaMax > glow.alphaMin
  )));
  assert.ok(status.pedestalRuneGlows.every(glow => (
    glow.color.startsWith("#") &&
    glow.alphaMin >= 0.23 &&
    glow.alphaMax >= 0.53 &&
    glow.alphaMax <= 0.56 &&
    glow.alphaMax > glow.alphaMin
  )));
  assert.deepEqual(
    JSON.parse(JSON.stringify(status.glowAnimation)),
    {
      innerColorStopPosition: 0.2,
      innerColorStopAlphaFactor: 0.94,
      middleColorStopPosition: 0.62,
      middleColorStopAlphaFactor: 0.70,
      compositeOperation: "screen",
      intensityMode: "individual-minimum-and-maximum"
    }
  );
  const backImage = decodePng(backgroundPaths.back);
  const pedestalImage = decodePng(backgroundPaths.pedestal);
  for (const glow of status.backRuneGlows) {
    assert.ok(
      countCyanPixels(backImage, glow, glow.radius) >= 20,
      `back glow at ${glow.x},${glow.y} must match real cyan rune pixels`
    );
  }
  for (const glow of status.pedestalRuneGlows) {
    const cyanPixels = countCyanPixels(pedestalImage, glow, glow.radius);
    assert.ok(
      cyanPixels >= 20,
      `pedestal glow at ${glow.x},${glow.y} matched ${cyanPixels} cyan pixels; ` +
        `center=${Array.from(pedestalImage.pixels.subarray(
          (glow.y * pedestalImage.width + glow.x) * pedestalImage.channels,
          (glow.y * pedestalImage.width + glow.x) * pedestalImage.channels + 4
        )).join(",")}`
    );
  }

  const mapping = visuals.getFireflyMapping(12.75);
  assert.deepEqual(
    JSON.parse(JSON.stringify(mapping)),
    JSON.parse(JSON.stringify(visuals.getFireflyMapping(12.75)))
  );
  assert.ok(mapping.every(firefly => (
    firefly.x >= 530 && firefly.x <= 752 &&
    firefly.y >= 280 && firefly.y <= 485 &&
    firefly.radius >= 3.7 && firefly.radius <= 5 &&
    firefly.alpha > 0 && firefly.alpha <= 0.84 &&
    /^#[0-9a-f]{6}$/i.test(firefly.color)
  )));
  assert.notDeepEqual(
    JSON.parse(JSON.stringify(mapping)),
    JSON.parse(JSON.stringify(visuals.getFireflyMapping(13.75)))
  );
  for (let visualTime = 0; visualTime <= 120; visualTime += 0.5) {
    assert.ok(visuals.getFireflyMapping(visualTime).every(firefly => (
      firefly.x >= 530 && firefly.x <= 752 &&
      firefly.y >= 280 && firefly.y <= 485
    )));
  }
});

test("the Underground Temple hazard is one static handled layer", async () => {
  const first = loadFixture();
  assert.deepEqual(first.loadedPaths, allAssetPaths);
  assert.equal(await first.visuals.whenHazardReady(), true);
  assert.equal(first.visuals.isHazardReady(), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(first.visuals.getHazardStatus())),
    {
      ready: true,
      path: hazardPath,
      expectedNativeSize: hazardSize,
      validNativeSize: true,
      source: {x: 0, y: 0, w: 1650, h: 60},
      destination: {x: 235, y: 690, w: 825, h: 30},
      layerCount: 1,
      animated: false
    }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(first.visuals.getBottomHazardMapping(hazardRect))),
    {
      source: {x: 0, y: 0, w: 1650, h: 60},
      destination: {x: 235, y: 690, w: 825, h: 30}
    }
  );
  assert.equal(
    first.visuals.drawBottomDeathHazard(first.recording.context, hazardRect, 0),
    true
  );
  const firstImageCalls = first.recording.calls.filter(
    call => call.type === "drawImage"
  );
  assert.deepEqual(firstImageCalls, [{
    type: "drawImage",
    path: hazardPath,
    args: [0, 0, 1650, 60, 235, 690, 825, 30],
    alpha: 1,
    composite: "source-over"
  }]);
  assert.equal(first.recording.calls.some(call => call.type === "scale"), false);

  const later = loadFixture();
  assert.equal(
    later.visuals.drawBottomDeathHazard(later.recording.context, hazardRect, 999),
    true
  );
  assert.deepEqual(later.recording.calls, first.recording.calls);
  assert.equal(first.visuals.getBottomHazardMapping({...hazardRect, x: 234}), null);
  assert.equal(first.visuals.getBottomHazardMapping({...hazardRect, y: 689}), null);
  assert.equal(first.visuals.getBottomHazardMapping({...hazardRect, w: 824}), null);
  assert.equal(first.visuals.getBottomHazardMapping({...hazardRect, h: 29}), null);
});

test("hazard readiness is isolated and only failure permits the generic fallback", async () => {
  const hazardFile = path.posix.basename(hazardPath);
  const ready = loadFixture();
  let genericFallbackDraws = 0;
  if (!ready.visuals.drawBottomDeathHazard(
    ready.recording.context,
    hazardRect,
    2
  )) genericFallbackDraws++;
  assert.equal(genericFallbackDraws, 0);

  for (const mode of ["failedFile", "invalidFile"]) {
    const unavailable = loadFixture({[mode]: hazardFile});
    assert.equal(await unavailable.visuals.whenHazardReady(), false);
    assert.equal(unavailable.visuals.isHazardReady(), false);
    assert.equal(unavailable.visuals.isBackgroundReady(), true);
    assert.equal(
      unavailable.visuals.drawBackground(
        unavailable.recording.context,
        1280,
        720,
        0
      ),
      true
    );
    if (!unavailable.visuals.drawBottomDeathHazard(
      unavailable.recording.context,
      hazardRect,
      2
    )) genericFallbackDraws++;
  }
  assert.equal(genericFallbackDraws, 2);
});

test("missing, malformed, or non-transparent backgrounds keep their fallback active", async () => {
  for (const relativePath of Object.values(backgroundPaths)) {
    const file = path.posix.basename(relativePath);
    const failed = loadFixture({failedFile: file});
    assert.equal(await failed.visuals.whenBackgroundReady(), false);
    assert.equal(failed.visuals.drawBackground(failed.recording.context, 1280, 720, 0), false);

    const invalid = loadFixture({invalidFile: file});
    assert.equal(await invalid.visuals.whenBackgroundReady(), false);
    assert.equal(invalid.visuals.drawBackground(invalid.recording.context, 1280, 720, 0), false);
  }
  for (const name of ["godRay", "pedestal", "depth", "front"]) {
    const file = path.posix.basename(backgroundPaths[name]);
    const opaque = loadFixture({opaqueLayer: file});
    assert.equal(await opaque.visuals.whenBackgroundReady(), false);
    const transparent = loadFixture({transparentLayer: file});
    assert.equal(await transparent.visuals.whenBackgroundReady(), false);
  }
});

test("registration precedes renderer and the legacy pass is fallback-only", () => {
  const kitIndex = indexSource.indexOf("./js/visual-platform-kit.js");
  const templeIndex = indexSource.indexOf("./js/visual-underground-temple-assets.js");
  const rendererIndex = indexSource.indexOf("./js/renderer.js");
  assert.ok(kitIndex >= 0 && kitIndex < templeIndex);
  assert.ok(templeIndex < rendererIndex);
  assert.match(
    rendererSource,
    /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)/
  );
  assert.match(
    rendererSource,
    /if \(!assetBackgroundDrawn\) \{\s*drawBackground\(biome\);\s*\}/
  );
  assert.match(
    biomeSource,
    /undergroundTemple:\s*drawUndergroundTempleBackground/
  );
  assert.match(
    hazardsSource,
    /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)[\s\S]*?if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\);/
  );
  assert.match(
    levelGeneratorSource,
    /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\);/
  );
  assert.match(physicsSource, /isBottomDeathHazard === true/);
});
