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
const assetPath = "assets/platforms/spike_platform_spike.png";

function decodeRgbaPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, "Spike PNG must use 8-bit channels");
  assert.equal(bytes[25], 6, "Spike PNG must be RGBA");
  assert.equal(bytes[28], 0, "Spike PNG must be non-interlaced");

  const idatChunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idatChunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
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
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
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

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let transparentPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[y * stride + x * bytesPerPixel + 3];
      if (alpha === 0) {
        transparentPixels++;
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    width,
    height,
    transparentPixels,
    bounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1}
  };
}

const decoded = decodeRgbaPng(assetPath);
assert.deepEqual([decoded.width, decoded.height], [256, 320]);
assert.deepEqual(decoded.bounds, {x: 14, y: 12, w: 228, h: 299});
assert.ok(decoded.transparentPixels > 0);

const rendererSource = read("js/renderer.js");
const assetStart = rendererSource.indexOf("  const SPIKE_PLATFORM_ASSET_CONTRACT");
const assetEnd = rendererSource.indexOf("  const TUTORIAL_DRAG_HAND_RENDER_SIZE", assetStart);
const drawStart = rendererSource.indexOf("  function isSpikePlatformAssetReady");
const drawEnd = rendererSource.indexOf("  function drawBouncePads", drawStart);
const platformsStart = rendererSource.indexOf("  function drawVectorPlatformSurface(");
const platformsEnd = rendererSource.indexOf("  function drawGoal(", platformsStart);
assert.ok(assetStart >= 0 && assetEnd > assetStart);
assert.ok(drawStart >= 0 && drawEnd > drawStart);
assert.ok(platformsStart >= 0 && platformsEnd > platformsStart);
const fixtureSource = [
  rendererSource.slice(assetStart, assetEnd),
  rendererSource.slice(drawStart, drawEnd),
  rendererSource.slice(platformsStart, platformsEnd)
].join("\n");
assert.doesNotMatch(fixtureSource, /Math\.random\(/);

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._src = "";
  }

  set src(value) {
    this._src = value;
    if (value === assetPath) {
      this.complete = true;
      this.naturalWidth = 256;
      this.naturalHeight = 320;
    }
  }

  get src() {
    return this._src;
  }
}

const events = [];
const stateStack = [];
const state = {
  fillStyle: "",
  strokeStyle: "",
  shadowColor: "",
  shadowBlur: 0,
  lineWidth: 1,
  globalAlpha: 1,
  lineDash: []
};
const ctx = {
  save() {
    stateStack.push({...state, lineDash: [...state.lineDash]});
    events.push({type: "save"});
  },
  restore() {
    Object.assign(state, stateStack.pop());
    events.push({type: "restore"});
  },
  drawImage(...args) {
    events.push({
      type: "drawImage",
      args,
      shadowColor: state.shadowColor,
      shadowBlur: state.shadowBlur
    });
  },
  fill() {
    events.push({
      type: "fill",
      style: state.fillStyle,
      shadowColor: state.shadowColor,
      shadowBlur: state.shadowBlur
    });
  },
  stroke() {
    events.push({type: "stroke", style: state.strokeStyle});
  },
  setLineDash(value) {
    state.lineDash = [...value];
  },
  beginPath() {
    events.push({type: "beginPath"});
  },
  moveTo(...args) {
    events.push({type: "moveTo", args});
  },
  lineTo(...args) {
    events.push({type: "lineTo", args});
  },
  closePath() {
    events.push({type: "closePath"});
  },
  arc() {},
  clip() {}
};
for (const property of [
  "fillStyle", "strokeStyle", "shadowColor", "shadowBlur", "lineWidth", "globalAlpha"
]) {
  Object.defineProperty(ctx, property, {
    get: () => state[property],
    set: value => {
      state[property] = value;
      events.push({type: "set", property, value});
    }
  });
}

let platforms = [];
let meadowAssetsReady = true;
const rendererContext = vm.createContext({
  Image: FakeImage,
  MEADOW_ASSET_VISUALS: {
    resolvePlatformRole: platform => platform.h === 26 ? "FLOATING" : null,
    drawPlatformBase: (context, platform, drawX, seed) => {
      events.push({type: "meadowBase", platform, drawX, seed});
      return meadowAssetsReady;
    }
  },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx,
  currentLevel: () => ({seed: 91, pads: [], spikes: []}),
  drawAnchorStepWarningBorder: () => {},
  drawDeathZone: () => {},
  drawFallingPlatformAsset: () => false,
  drawGhostStepFadeOutline: () => {},
  drawIcePlatformAsset: () => false,
  drawStandardPlatformDetails: (x, y, w, h, biomePlatform) => {
    events.push({type: "biomeDetails", x, y, w, h, biomePlatform});
  },
  getFallingPlatformActivationDelay: () => 1,
  getPlatforms: () => platforms,
  isStandardPlatform: platform => !(
    platform.fragile || platform.moving || platform.conveyor || platform.fade ||
    platform.ice || platform.spikePlatform
  ),
  roundedRect: (...args) => events.push({type: "roundedRect", args}),
  worldTime: 1.25
});
vm.runInContext(`${fixtureSource}
  globalThis.spikePlatformTestApi = {
    contract: SPIKE_PLATFORM_ASSET_CONTRACT,
    fullDrawHeight: SPIKE_PLATFORM_FULL_DRAW_HEIGHT,
    fullDrawWidth: SPIKE_PLATFORM_FULL_DRAW_WIDTH,
    baselineOffset: SPIKE_PLATFORM_BASELINE_OFFSET,
    image: spikePlatformImage,
    ready: isSpikePlatformAssetReady,
    drawAsset: drawSpikePlatformAsset,
    drawPlatforms
  };
`, rendererContext, {filename: "spike-platform-renderer-fixture.js"});
const api = rendererContext.spikePlatformTestApi;
assert.equal(api.ready(), true);
assert.deepEqual(JSON.parse(JSON.stringify(api.contract)), {
  path: assetPath,
  canvas: {w: 256, h: 320},
  source: {x: 14, y: 12, w: 228, h: 299}
});
assert.equal(api.fullDrawHeight, 26);
assert.equal(api.fullDrawWidth, 26 * 228 / 299);
assert.equal(api.baselineOffset, 6);

function resetEvents() {
  events.length = 0;
  stateStack.length = 0;
  Object.assign(state, {
    fillStyle: "",
    strokeStyle: "",
    shadowColor: "",
    shadowBlur: 0,
    lineWidth: 1,
    globalAlpha: 1,
    lineDash: []
  });
}

for (const width of [100, 126, 154, 176]) {
  for (const extension of [0.5, 1]) {
    const platform = {
      x: 300.25,
      y: 410.5,
      w: width,
      h: 26,
      spikePlatform: true,
      spikeData: {extension, warning: false, dangerous: extension >= 0.52}
    };
    const snapshot = JSON.stringify(platform);
    const count = Math.max(3, Math.floor(width / 25));
    const step = width / count;
    resetEvents();
    assert.equal(api.drawAsset(ctx, platform, platform.x, count, step), true);
    const draws = events.filter(event => event.type === "drawImage");
    assert.equal(draws.length, count);
    for (const [index, event] of draws.entries()) {
      const args = event.args;
      const centerX = platform.x + (index + 0.5) * step;
      assert.equal(args[0].src, assetPath);
      assert.deepEqual(args.slice(1, 5), [14, 12, 228, 299 * extension]);
      assert.equal(args[5], centerX - api.fullDrawWidth / 2);
      assert.equal(args[6], platform.y + 6 - 26 * extension);
      assert.equal(args[7], api.fullDrawWidth);
      assert.equal(args[8], 26 * extension);
      assert.equal(args[5] + args[7] / 2, centerX);
      assert.equal(args[6] + args[8], platform.y + 6);
      assert.ok(args[7] < step, "proportional Spike must retain side space in its cell");
      assert.ok(Math.abs(args[7] / 228 - args[8] / (299 * extension)) < 1e-12,
        "source and destination must use one uniform scale");
    }
    assert.equal(JSON.stringify(platform), snapshot);
  }
}

const thresholdFixture = {
  x: 0,
  y: 100,
  w: 100,
  h: 26,
  spikePlatform: true,
  spikeData: {extension: 0.02, warning: false, dangerous: false}
};
resetEvents();
assert.equal(api.drawAsset(ctx, thresholdFixture, 0, 4, 25), true);
assert.equal(events.filter(event => event.type === "drawImage").length, 0);
thresholdFixture.spikeData.extension = 0.020001;
resetEvents();
assert.equal(api.drawAsset(ctx, thresholdFixture, 0, 4, 25), true);
assert.equal(events.filter(event => event.type === "drawImage").length, 4);

const biome = {
  platform: {
    body: "#b86f3f",
    top: "#f1c46d",
    detail: "sandstone",
    detailColor: "#7f472f"
  }
};
const spikeFixture = {
  x: 310,
  y: 417,
  w: 126,
  h: 26,
  spikePlatform: true,
  spikeData: {extension: 1, warning: false, dangerous: true}
};
platforms = [spikeFixture];

resetEvents();
api.drawPlatforms(biome, rendererContext.MEADOW_ASSET_VISUALS);
assert.equal(events.filter(event => event.type === "meadowBase").length, 1,
  "Meadow Spike Platform must request the biome Whole/fallback base");
assert.equal(events.filter(event => event.type === "biomeDetails").length, 0);
const wholeBaseIndex = events.findIndex(event => event.type === "meadowBase");
const wholeSlotIndex = events.findIndex(event => (
  event.type === "roundedRect" && event.args[1] === spikeFixture.y + 4
));
const wholeSpikeIndex = events.findIndex(event => event.type === "drawImage");
assert.ok(wholeBaseIndex < wholeSlotIndex && wholeSlotIndex < wholeSpikeIndex,
  "Whole base must stay below the unchanged slots and Spike PNG overlay");

meadowAssetsReady = false;
resetEvents();
api.drawPlatforms(biome, rendererContext.MEADOW_ASSET_VISUALS);
assert.equal(events.filter(event => event.type === "meadowBase").length, 1);
assert.ok(events.some(event => (
  event.type === "fill" && event.style === biome.platform.body
)), "an invalid Whole/Family-B base must restore the prior vector body");
assert.equal(events.filter(event => (
  event.type === "roundedRect" && event.args[1] === spikeFixture.y + 4
)).length, Math.max(3, Math.floor(spikeFixture.w / 25)));
assert.equal(
  events.filter(event => event.type === "drawImage").length,
  Math.max(3, Math.floor(spikeFixture.w / 25)),
  "base fallback must not affect the Spike PNG overlay"
);
meadowAssetsReady = true;

resetEvents();
api.drawPlatforms(biome, false);
const bodyFillIndex = events.findIndex(event => event.type === "fill" && event.style === biome.platform.body);
const topFillIndex = events.findIndex(event => event.type === "fill" && event.style === biome.platform.top);
const detailsIndex = events.findIndex(event => event.type === "biomeDetails");
const slotFillIndex = events.findIndex(event => event.type === "fill" && event.style === "rgba(43,27,32,0.82)");
const spikeDrawIndex = events.findIndex(event => event.type === "drawImage");
assert.ok(bodyFillIndex >= 0 && bodyFillIndex < topFillIndex);
assert.ok(topFillIndex < detailsIndex && detailsIndex < slotFillIndex && slotFillIndex < spikeDrawIndex,
  "non-Meadow order must be biome base/details, slots, then Spike PNGs");

for (const width of [100, 176]) {
  spikeFixture.w = width;
  resetEvents();
  api.drawPlatforms(biome, false);
  const count = Math.max(3, Math.floor(width / 25));
  const step = width / count;
  const expectedSlotWidth = Math.min(step - 4, api.fullDrawWidth + 2);
  const slots = events.filter(event => (
    event.type === "roundedRect" &&
    event.args[1] === spikeFixture.y + 4 &&
    event.args[3] === 5 &&
    event.args[4] === 2.5
  ));
  const spikes = events.filter(event => event.type === "drawImage");
  assert.equal(slots.length, count, "every Spike cell must have exactly one slot");
  assert.equal(spikes.length, count, "every Spike cell must have exactly one PNG");
  for (let i = 0; i < count; i++) {
    const expectedCenterX = spikeFixture.x + (i + 0.5) * step;
    assert.equal(slots[i].args[0] + slots[i].args[2] / 2, expectedCenterX);
    assert.equal(spikes[i].args[5] + spikes[i].args[7] / 2, expectedCenterX);
    assert.equal(slots[i].args[2], expectedSlotWidth);
  }
}
spikeFixture.w = 126;

spikeFixture.spikeData = {extension: 1, warning: true, dangerous: false};
resetEvents();
api.drawPlatforms(biome, false);
const warningFill = events.find(event => (
  event.type === "fill" && event.style.startsWith("rgba(255,196,86,")
));
assert.equal(warningFill.shadowColor, "rgba(255,196,86,0.90)");
assert.equal(warningFill.shadowBlur, 12);
const glowingSpikeDraws = events.filter(event => event.type === "drawImage");
assert.ok(glowingSpikeDraws.length > 0);
assert.ok(glowingSpikeDraws.every(event => event.shadowColor === "" && event.shadowBlur === 0),
  "Warning shadow must be restored before Spike PNGs draw");

for (const spikeData of [
  {extension: 1, warning: false, dangerous: false},
  {extension: 1, warning: true, dangerous: true}
]) {
  spikeFixture.spikeData = spikeData;
  resetEvents();
  api.drawPlatforms(biome, false);
  assert.equal(events.some(event => (
    event.type === "set" && event.property === "shadowBlur" && event.value === 12
  )), false, "Warning glow must exist only for warning && !dangerous");
}

api.image.naturalWidth = 0;
spikeFixture.spikeData = {extension: 1, warning: false, dangerous: true};
resetEvents();
api.drawPlatforms(biome, false);
assert.equal(events.filter(event => event.type === "drawImage").length, 0);
assert.equal(events.filter(event => event.type === "moveTo").length, Math.floor(spikeFixture.w / 25),
  "invalid PNG dimensions must restore every Canvas triangle");
api.image.naturalWidth = 256;

const otherPlatforms = [
  {x: 0, y: 100, w: 126, h: 26},
  {x: 0, y: 140, w: 126, h: 26, moving: true, movingData: {}},
  {x: 0, y: 180, w: 126, h: 26, fade: true, fadeData: {opacity: 0.7}},
  {x: 0, y: 220, w: 126, h: 26, ice: true, iceData: {}}
];
platforms = otherPlatforms;
resetEvents();
api.drawPlatforms(biome, false);
assert.equal(events.filter(event => event.type === "drawImage").length, 0,
  "non-Spike platform types must never use the Spike PNG");

const platformsSource = read("js/platforms.js");
assert.match(platformsSource, /const warningDuration = 0\.62;/);
assert.match(platformsSource, /const extendDuration = 0\.28;/);
assert.match(platformsSource, /const dangerDuration = 1\.08;/);
assert.match(platformsSource, /const retractDuration = 0\.30;/);
assert.match(platformsSource, /platform\.dangerous = platform\.extension >= 0\.52;/);
assert.match(rendererSource, /spikeData\.extension > 0\.02/);
assert.match(rendererSource, /Math\.max\(3, Math\.floor\(p\.w \/ 25\)\)/);
assert.match(rendererSource,
  /0\.38 \+ \(Math\.sin\(worldTime \* 15\) \+ 1\) \* 0\.22/);

const physicsSource = read("js/physics.js");
assert.match(physicsSource, /const spikeHeight = 25 \* platform\.extension;/);
assert.match(physicsSource,
  /x: platform\.x \+ 5,[\s\S]*?y: platform\.y - spikeHeight \+ 1,[\s\S]*?w: Math\.max\(0, platform\.w - 10\),[\s\S]*?h: spikeHeight \+ 7/);
assert.match(physicsSource, /player\.r \* 0\.70/);
assert.match(physicsSource, /tryHandleProtectedDeadlyContact\("spike_platform"\)/);
assert.match(physicsSource, /spawnBurst\(player\.x, player\.y, 12, "#ff7d63"\);/);

const meadowVisualSource = read("js/visual-meadow-assets.js");
assert.match(meadowVisualSource,
  /bottom_spike_tile: "assets\/environments\/meadow\/hazards\/meadow_bottom_spike_tile\.png"/);
assert.doesNotMatch(meadowVisualSource, /spike_platform_spike\.png/);
assert.match(read("js/hazards.js"), /MEADOW_ASSET_VISUALS\.drawBottomSpikeHazard/);

for (const relativePath of [
  "js/game.js",
  "js/hazards.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js"
]) {
  const headSource = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(normalize(read(relativePath)), normalize(headSource));
}

console.log("Spike Platform PNG, biome base, reveal, glow, fallback and frozen-scope tests passed.");
