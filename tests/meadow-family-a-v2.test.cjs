"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const platformDirectory = "assets/environments/meadow/platforms";
const topOverlayNames = Array.from(
  {length: 6},
  (_, index) => `meadow_overlay_top_0${index + 1}`
);
const bodyOverlayNames = Array.from(
  {length: 3},
  (_, index) => `meadow_overlay_body_0${index + 1}`
);
const familyAAssetNames = [
  "meadow_top_base",
  "meadow_body_base",
  ...topOverlayNames,
  ...bodyOverlayNames
];
const legacyAssetNames = [
  ...Array.from({length: 6}, (_, index) => `meadow_top_0${index + 1}`),
  ...Array.from({length: 4}, (_, index) => `meadow_body_top_0${index + 1}`),
  "meadow_top"
];

function decodePng(relativePath) {
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
    assert.ok(filter >= 0 && filter <= 4);
    for (let x = 0; x < stride; x++) {
      const raw = packed[packedOffset++];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= channels
        ? pixels[(y - 1) * stride + x - channels]
        : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : paeth(left, up, upperLeft);
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
  }
  const alpha = {minimum: 255, maximum: 255, transparent: 0, partial: 0};
  if (colorType === 6) {
    alpha.maximum = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      const value = pixels[index];
      alpha.minimum = Math.min(alpha.minimum, value);
      alpha.maximum = Math.max(alpha.maximum, value);
      if (value === 0) alpha.transparent += 1;
      else if (value < 255) alpha.partial += 1;
    }
  }
  return {width, height, colorType, pixels, alpha};
}

const decodedFamilyA = {};
for (const assetName of familyAAssetNames) {
  const relativePath = `${platformDirectory}/${assetName}.png`;
  assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} missing`);
  const decoded = decodePng(relativePath);
  assert.deepEqual([decoded.width, decoded.height], [352, 128]);
  decodedFamilyA[relativePath] = decoded;
}
const expectedBaseAlpha = {
  meadow_top_base: {minimum: 0, maximum: 255, transparent: 4579, partial: 2281},
  meadow_body_base: {minimum: 0, maximum: 255, transparent: 768, partial: 1024}
};
for (const baseName of ["meadow_top_base", "meadow_body_base"]) {
  const decoded = decodedFamilyA[`${platformDirectory}/${baseName}.png`];
  assert.equal(decoded.colorType, 6, `${baseName} must be RGBA`);
  assert.deepEqual(
    decoded.alpha,
    expectedBaseAlpha[baseName],
    `${baseName} must retain the final transparent-edge alpha contract`
  );
}
for (const overlayName of [...topOverlayNames, ...bodyOverlayNames]) {
  const decoded = decodedFamilyA[`${platformDirectory}/${overlayName}.png`];
  assert.equal(decoded.colorType, 6, `${overlayName} must be RGBA`);
  assert.ok(decoded.alpha.transparent > 0, `${overlayName} needs transparent pixels`);
  assert.ok(decoded.alpha.maximum > 0, `${overlayName} needs visible pixels`);
}
for (const legacyName of legacyAssetNames) {
  assert.equal(
    fs.existsSync(path.join(root, platformDirectory, `${legacyName}.png`)),
    false,
    `${legacyName}.png must be removed after migration`
  );
}

const wholeFloatingPath = `${platformDirectory}/meadow_floating_platform.png`;
const wholeFloatingFixture = decodePng(wholeFloatingPath);
assert.deepEqual([wholeFloatingFixture.width, wholeFloatingFixture.height], [512, 128]);
const floatingFixtures = {[wholeFloatingPath]: wholeFloatingFixture};

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
  }

  set src(value) {
    this._src = value;
    const familyA = decodedFamilyA[value];
    const floating = floatingFixtures[value];
    this.complete = true;
    this.naturalWidth = familyA?.width ?? floating?.width ?? 1;
    this.naturalHeight = familyA?.height ?? floating?.height ?? 1;
    this.pixelData = floating?.pixels;
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

const fakeDocument = {
  createElement(type) {
    assert.equal(type, "canvas");
    let drawnImage = null;
    return {
      getContext() {
        return {
          clearRect() {},
          drawImage(image) {
            drawnImage = image;
          },
          getImageData() {
            return {data: drawnImage.pixelData};
          }
        };
      }
    };
  }
};

let visualRandomCalls = 0;
const visualMath = Object.create(Math);
visualMath.random = () => {
  visualRandomCalls += 1;
  return 0.5;
};
const fixture = vm.createContext({
  Image: FakeImage,
  Math: visualMath,
  Promise,
  document: fakeDocument
});
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-decor-kit.js")}
${read("js/visual-portal-kit.js")}
${read("js/visual-meadow-assets.js")}
  globalThis.familyATestApi = MEADOW_ASSET_VISUALS;
`, fixture, {filename: "meadow-family-a-v2-fixture.js"});
const api = fixture.familyATestApi;
api.whenReady();
const manifest = JSON.parse(JSON.stringify(api.getManifest()));
const delegatedPlatformManifest = JSON.parse(JSON.stringify(
  api.getPlatformKit().getManifest()
));
const paths = JSON.parse(JSON.stringify(api.getStatus().paths));

assert.equal(api.areAllReady(), true);
assert.deepEqual(delegatedPlatformManifest, manifest.platforms);
assert.deepEqual(manifest.platforms.contract.start, {
  width: 235,
  height: 80,
  topMode: "proportional-width-clip",
  overflow: "clip"
});
assert.deepEqual(manifest.platforms.contract.goal, {
  width: 220,
  topHeight: 80,
  bodyRowHeight: 80,
  bodyOverlap: 1,
  bodyRowStep: 79,
  lastBodyMode: "proportional-source-crop",
  bodyOverlayMode: "single-bottom-aligned-body-clip"
});
assert.deepEqual(manifest.platforms.kit.familyA, {
  source: {x: 0, y: 0, w: 352, h: 128},
  topBase: {asset: "meadow_top_base", w: 352, h: 128},
  bodyBase: {asset: "meadow_body_base", w: 352, h: 128},
  topOverlays: topOverlayNames.map(asset => ({asset, w: 352, h: 128})),
  bodyOverlays: bodyOverlayNames.map(asset => ({asset, w: 352, h: 128}))
});
assert.deepEqual(manifest.platforms.topOverlaySelection, {
  startSalt: 0x53544152,
  goalSalt: 0x474f414c,
  mode: "independent-salts-shift-goal-on-collision"
});
assert.deepEqual(manifest.platforms.bodyOverlaySelection, {
  goalSalt: 0x424f474c,
  mode: "single-goal-overlay"
});
assert.equal(paths.meadow_top_base, `${platformDirectory}/meadow_top_base.png`);
assert.equal(paths.meadow_body_base, `${platformDirectory}/meadow_body_base.png`);
for (const assetName of [...topOverlayNames, ...bodyOverlayNames]) {
  assert.equal(paths[assetName], `${platformDirectory}/${assetName}.png`);
}
for (const legacyName of legacyAssetNames) assert.equal(paths[legacyName], undefined);

const drawCalls = [];
const operations = [];
const canvasContext = new Proxy({}, {
  get(target, property) {
    if (property === "drawImage") return (...args) => drawCalls.push(args);
    if ([
      "save", "restore", "beginPath", "moveTo", "arcTo", "closePath",
      "clip", "rect", "stroke"
    ].includes(property)) {
      return (...args) => operations.push([property, ...args]);
    }
    return target[property] ?? (() => {});
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});
const describeCall = call => ({
  asset: call[0].src,
  source: call.slice(1, 5),
  destination: call.slice(5, 9)
});
const resetDrawing = () => {
  drawCalls.length = 0;
  operations.length = 0;
};

const startPlatform = {x: 0, y: 640, w: 235, h: 80};
const startSnapshot = JSON.stringify(startPlatform);
const startSelection = api.getTopOverlaySelection(31);
const startTopHeight = 235 * 128 / 352;
resetDrawing();
assert.equal(api.drawPlatformBase(canvasContext, startPlatform, 0, 31), true);
assert.equal(JSON.stringify(startPlatform), startSnapshot);
assert.equal(drawCalls.length, 2, "START must draw only top base and one top overlay");
assert.deepEqual(drawCalls.map(describeCall), [
  {
    asset: `${platformDirectory}/meadow_top_base.png`,
    source: [0, 0, 352, 128],
    destination: [0, 640, 235, startTopHeight]
  },
  {
    asset: `${platformDirectory}/${startSelection.startAsset}.png`,
    source: [0, 0, 352, 128],
    destination: [0, 640, 235, startTopHeight]
  }
]);
assert.ok(startTopHeight > startPlatform.h);
assert.ok(operations.some(operation => operation[0] === "clip"));
assert.equal(operations.some(operation => operation[0] === "rect"), false);
assert.ok(drawCalls.every(call => !call[0].src.includes("body")));

function expectedBodyRows(platform) {
  const rows = [];
  const bottom = platform.y + platform.h;
  for (let y = platform.y + 79; y < bottom;) {
    const height = Math.min(80, bottom - y);
    rows.push({y, height, sourceHeight: height * 128 / 80});
    if (y + height >= bottom) break;
    y += 79;
  }
  return rows;
}

function assertGoal(platform, seed) {
  const snapshot = JSON.stringify(platform);
  const topSelection = api.getTopOverlaySelection(seed);
  const bodySelection = api.getBodyOverlaySelection(seed);
  resetDrawing();
  assert.equal(api.drawPlatformBase(canvasContext, platform, platform.x, seed), true);
  assert.equal(JSON.stringify(platform), snapshot);
  const rows = expectedBodyRows(platform);
  assert.equal(drawCalls.length, rows.length + 3);
  assert.deepEqual(drawCalls.slice(0, 2).map(describeCall), [
    {
      asset: `${platformDirectory}/meadow_top_base.png`,
      source: [0, 0, 352, 128],
      destination: [platform.x, platform.y, 220, 80]
    },
    {
      asset: `${platformDirectory}/${topSelection.goalAsset}.png`,
      source: [0, 0, 352, 128],
      destination: [platform.x, platform.y, 220, 80]
    }
  ]);
  const baseCalls = drawCalls.slice(2, -1);
  assert.equal(baseCalls.length, rows.length);
  for (const [index, call] of baseCalls.entries()) {
    const row = rows[index];
    assert.deepEqual(describeCall(call), {
      asset: `${platformDirectory}/meadow_body_base.png`,
      source: [0, 0, 352, row.sourceHeight],
      destination: [platform.x, row.y, 220, row.height]
    });
    assert.equal(call[7] / call[3], call[8] / call[4]);
    if (index > 0) {
      const previous = baseCalls[index - 1];
      assert.equal(previous[6] + previous[8] - call[6], 1);
    }
  }
  const bodyOverlayCall = drawCalls.at(-1);
  assert.deepEqual(describeCall(bodyOverlayCall), {
    asset: `${platformDirectory}/${bodySelection.goalAsset}.png`,
    source: [0, 0, 352, 128],
    destination: [platform.x, platform.y + platform.h - 80, 220, 80]
  });
  assert.equal(drawCalls.filter(call => bodyOverlayNames.some(name => (
    call[0].src.endsWith(`${name}.png`)
  ))).length, 1);
  assert.ok(operations.some(operation => (
    operation[0] === "rect" &&
    operation[1] === platform.x &&
    operation[2] === platform.y + 79 &&
    operation[3] === 220 &&
    operation[4] === platform.h - 79
  )));
}

for (const [height, seed] of [
  [80, 3], [81, 5], [150, 7], [159, 9], [238, 10], [250, 11], [535, 13]
]) {
  assertGoal({x: 1060, y: 720 - height, w: 220, h: height}, seed);
}

const startIndexes = new Set();
const goalIndexes = new Set();
const bodyIndexes = new Set();
const topPairs = new Set();
for (let seed = 0; seed < 1000; seed++) {
  const top = JSON.parse(JSON.stringify(api.getTopOverlaySelection(seed)));
  const body = JSON.parse(JSON.stringify(api.getBodyOverlaySelection(seed)));
  assert.deepEqual(JSON.parse(JSON.stringify(api.getTopOverlaySelection(seed))), top);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getBodyOverlaySelection(seed))), body);
  assert.notEqual(top.startIndex, top.goalIndex);
  assert.equal(top.startAsset, topOverlayNames[top.startIndex]);
  assert.equal(top.goalAsset, topOverlayNames[top.goalIndex]);
  assert.equal(body.goalAsset, bodyOverlayNames[body.goalIndex]);
  startIndexes.add(top.startIndex);
  goalIndexes.add(top.goalIndex);
  bodyIndexes.add(body.goalIndex);
  topPairs.add(`${top.startIndex}:${top.goalIndex}`);
}
assert.deepEqual([...startIndexes].sort(), [0, 1, 2, 3, 4, 5]);
assert.deepEqual([...goalIndexes].sort(), [0, 1, 2, 3, 4, 5]);
assert.deepEqual([...bodyIndexes].sort(), [0, 1, 2]);
assert.ok(topPairs.size > 6, "different levels must allow different overlay combinations");
assert.equal(visualRandomCalls, 0, "Family-A selection must not consume Math.random");

const portalGoal = {x: 1060, y: 185, w: 220, h: 535};
const portalSeed = 91;
const portalSelection = api.getTopOverlaySelection(portalSeed);
resetDrawing();
assert.equal(api.drawGoalTopForeground(canvasContext, portalGoal, portalSeed), true);
assert.deepEqual(drawCalls.map(describeCall), [
  {
    asset: `${platformDirectory}/meadow_top_base.png`,
    source: [0, 0, 352, 128],
    destination: [1060, 185, 220, 80]
  },
  {
    asset: `${platformDirectory}/${portalSelection.goalAsset}.png`,
    source: [0, 0, 352, 128],
    destination: [1060, 185, 220, 80]
  }
]);
assert.ok(operations.some(operation => operation[0] === "clip"));

const visualSource = read("js/visual-meadow-assets.js");
assert.doesNotMatch(visualSource, /meadow_top_0[1-6]/);
assert.doesNotMatch(visualSource, /meadow_body_top_0[1-4]/);
assert.doesNotMatch(visualSource, /MEADOW_TOP_VARIANT|MEADOW_BODY_TOP/);
assert.doesNotMatch(visualSource, /getTopVariant|getBodyTopVariant/);
assert.doesNotMatch(visualSource, /bodyHeight:\s*48|bodyRowStep:\s*47/);

console.log("Meadow Family-A V2 base/overlay kit contract: ok");
