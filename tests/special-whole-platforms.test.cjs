"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const assets = Object.freeze({
  ice: Object.freeze({
    path: "assets/platforms/ice_platform.png",
    alpha0: Object.freeze({x: 0, y: 10, w: 512, h: 105}),
    alpha8: Object.freeze({x: 2, y: 12, w: 508, h: 101}),
    support: Object.freeze({y: 12, h: 62})
  }),
  falling: Object.freeze({
    path: "assets/platforms/falling_platform.png",
    alpha0: Object.freeze({x: 4, y: 10, w: 505, h: 106}),
    alpha8: Object.freeze({x: 6, y: 13, w: 500, h: 101}),
    support: Object.freeze({y: 16, h: 53})
  }),
  conveyor: Object.freeze({
    path: "assets/platforms/conveyor_platform.png",
    alpha0: Object.freeze({x: 0, y: 23, w: 512, h: 84}),
    alpha8: Object.freeze({x: 1, y: 25, w: 510, h: 80}),
    support: Object.freeze({y: 29, h: 63})
  })
});

function decodeRgba8Png(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must use RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left, up, upperLeft) => {
    const value = left + up - upperLeft;
    const leftDistance = Math.abs(value - left);
    const upDistance = Math.abs(value - up);
    const upperLeftDistance = Math.abs(value - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0, packedOffset = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (packed[packedOffset++] + predictor) & 0xff;
    }
  }
  return Object.freeze({width, height, pixels});
}

function analyzeAlpha(decoded, threshold) {
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  const longestRuns = Array(decoded.height).fill(0);
  for (let y = 0; y < decoded.height; y++) {
    let run = 0;
    for (let x = 0; x < decoded.width; x++) {
      if (decoded.pixels[(y * decoded.width + x) * 4 + 3] <= threshold) {
        run = 0;
        continue;
      }
      run++;
      longestRuns[y] = Math.max(longestRuns[y], run);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const bounds = Object.freeze({
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  });
  const minimumRun = Math.ceil(bounds.w * 0.9);
  let support = null;
  let start = -1;
  for (let y = 0; y <= decoded.height; y++) {
    const covered = y < decoded.height && longestRuns[y] >= minimumRun;
    if (covered && start < 0) start = y;
    if (!covered && start >= 0) {
      if (!support || y - start > support.h) support = {y: start, h: y - start};
      start = -1;
    }
  }
  return Object.freeze({bounds, support: Object.freeze(support)});
}

const decodedByPath = Object.fromEntries(Object.values(assets).map(asset => (
  [asset.path, decodeRgba8Png(asset.path)]
)));
for (const asset of Object.values(assets)) {
  const decoded = decodedByPath[asset.path];
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 512, h: 128});
  assert.deepEqual(analyzeAlpha(decoded, 0).bounds, asset.alpha0);
  const robust = analyzeAlpha(decoded, 8);
  assert.deepEqual(robust.bounds, asset.alpha8);
  assert.deepEqual(robust.support, asset.support);
}

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
    const decoded = decodedByPath[value];
    if (!decoded) return;
    this.complete = true;
    this.naturalWidth = decoded.width;
    this.naturalHeight = decoded.height;
    this.pixelData = decoded.pixels;
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
      getContext() {
        return {
          clearRect() {},
          drawImage(nextImage) { image = nextImage; },
          getImageData() { return {data: image.pixelData}; }
        };
      }
    };
  }
};

const context = vm.createContext({Image: FakeImage, document, worldTime: 1.25});
vm.runInContext(`${read("js/visual-platform-kit.js")}
  ${read("js/renderer.js")}
  globalThis.specialWholePlatformTestApi = Object.freeze({
    contracts: Object.freeze({
      ice: ICE_PLATFORM_WHOLE_ASSET_CONTRACT,
      falling: FALLING_PLATFORM_WHOLE_ASSET_CONTRACT,
      conveyor: CONVEYOR_PLATFORM_WHOLE_ASSET_CONTRACT
    }),
    records: Object.freeze({
      ice: icePlatformWholeAsset,
      falling: fallingPlatformWholeAsset,
      conveyor: conveyorPlatformWholeAsset
    }),
    legacyImages: Object.freeze({
      ice: icePlatformImages,
      falling: fallingPlatformImages,
      conveyor: conveyorPlatformImages
    }),
    legacyContracts: Object.freeze({
      ice: ICE_PLATFORM_ASSET_CONTRACT,
      falling: FALLING_PLATFORM_ASSET_CONTRACT,
      conveyor: CONVEYOR_PLATFORM_ASSET_CONTRACT
    }),
    draw: Object.freeze({
      ice: drawIcePlatformAsset,
      falling: drawFallingPlatformAsset,
      conveyor: drawConveyorPlatformAsset
    }),
    drawConveyorOverlay: drawConveyorPlatformBeltOverlay,
    mapping: getWholePlatformImageMapping
  });
`, context, {filename: "special-whole-platform-renderer-fixture.js"});
const api = context.specialWholePlatformTestApi;

function createRecorder() {
  const events = [];
  const canvasContext = new Proxy({
    save() { events.push({type: "save"}); },
    restore() { events.push({type: "restore"}); },
    drawImage(...args) { events.push({type: "drawImage", args}); },
    translate(...args) { events.push({type: "translate", args}); },
    scale(...args) { events.push({type: "scale", args}); },
    beginPath() {},
    rect(...args) { events.push({type: "rect", args}); },
    clip() { events.push({type: "clip"}); },
    moveTo(...args) { events.push({type: "moveTo", args}); },
    lineTo(...args) { events.push({type: "lineTo", args}); },
    closePath() {},
    fill() { events.push({type: "fill"}); }
  }, {
    get(target, property) {
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
    set(target, property, value) {
      events.push({type: "set", property, value});
      target[property] = value;
      return true;
    }
  });
  return {canvasContext, events};
}

const platforms = Object.freeze({
  ice: Object.freeze({x: 310.25, y: 417.5, w: 138, h: 26, ice: true, iceData: {}}),
  falling: Object.freeze({
    x: 310.25,
    y: 448.75,
    w: 138,
    h: 26,
    fragile: true,
    fallingPlatform: {currentY: 448.75, falling: true, triggered: true}
  }),
  conveyor: Object.freeze({
    x: 310.25,
    y: 417.5,
    w: 138,
    h: 26,
    conveyor: true,
    conveyorSpeed: 42,
    conveyorData: {phase: 7}
  })
});

for (const [name, asset] of Object.entries(assets)) {
  const record = api.records[name];
  const fit = JSON.parse(JSON.stringify(record.contentFit));
  assert.deepEqual(fit.visibleContentBounds, asset.alpha8);
  assert.equal(fit.supportY, asset.support.y);
  assert.deepEqual(fit.supportBand, asset.support);
  const drawX = name === "falling" ? platforms[name].x + 3.375 : platforms[name].x;
  const mapping = api.mapping(
    record.contentFit,
    api.contracts[name].canvas,
    platforms[name],
    drawX
  );
  const before = JSON.stringify(platforms[name]);
  const recorder = createRecorder();
  assert.equal(api.draw[name](recorder.canvasContext, platforms[name], drawX), true);
  const imageCalls = recorder.events.filter(event => event.type === "drawImage");
  assert.equal(imageCalls.length, 1, `${name} must draw its Whole PNG once`);
  assert.equal(imageCalls[0].args[0]._src, asset.path);
  assert.deepEqual(imageCalls[0].args.slice(1, 5), [0, 0, 512, 128]);
  assert.deepEqual(imageCalls[0].args.slice(5), [
    mapping.drawX,
    mapping.drawY,
    mapping.drawWidth,
    mapping.drawHeight
  ]);
  assert.equal(mapping.scale, platforms[name].w / asset.alpha8.w);
  assert.equal(mapping.drawX + asset.alpha8.x * mapping.scale, drawX);
  assert.equal(
    mapping.drawX + (asset.alpha8.x + asset.alpha8.w) * mapping.scale,
    drawX + platforms[name].w
  );
  assert.equal(mapping.drawY + asset.support.y * mapping.scale, platforms[name].y);
  assert.equal(mapping.drawWidth / mapping.drawHeight, 4, "scale must be uniform");
  assert.equal(JSON.stringify(platforms[name]), before,
    "rendering must not mutate gameplay geometry");
}

const rightRecorder = createRecorder();
assert.equal(api.draw.conveyor(rightRecorder.canvasContext, platforms.conveyor), true);
assert.equal(rightRecorder.events.filter(event => event.type === "scale").length, 0,
  "right Conveyor uses the PNG's standard orientation");
const leftPlatform = Object.freeze({...platforms.conveyor, conveyorSpeed: -42});
const leftRecorder = createRecorder();
assert.equal(api.draw.conveyor(leftRecorder.canvasContext, leftPlatform), true);
assert.deepEqual(
  leftRecorder.events.filter(event => event.type === "scale").map(event => event.args),
  [[-1, 1]],
  "left Conveyor mirrors the complete Whole PNG"
);
assert.equal(leftRecorder.events.filter(event => event.type === "drawImage").length, 1);

const conveyorChannel = api.contracts.conveyor.beltChannelSource;
assert.deepEqual(JSON.parse(JSON.stringify(conveyorChannel)), {
  x: 50,
  y: 43,
  w: 412,
  h: 39,
  stripeLean: 37
});
const wideRightPlatform = Object.freeze({...platforms.conveyor, w: 181});
const wideLeftPlatform = Object.freeze({...wideRightPlatform, conveyorSpeed: -42});
for (const conveyor of [
  platforms.conveyor,
  leftPlatform,
  wideRightPlatform,
  wideLeftPlatform
]) {
  const recorder = createRecorder();
  assert.equal(api.drawConveyorOverlay(recorder.canvasContext, conveyor), true);
  const clipRects = recorder.events.filter(event => event.type === "rect");
  assert.equal(clipRects.length, 1,
    "the existing animated belt overlay stays clipped to the Whole body channel");
  assert.ok(recorder.events.some(event => event.type === "fill"),
    "the direction-aware animated belt stripes remain visible");
  const direction = Math.sign(conveyor.conveyorSpeed) || 1;
  const mapping = api.mapping(
    api.records.conveyor.contentFit,
    api.contracts.conveyor.canvas,
    conveyor,
    conveyor.x,
    direction < 0
  );
  const channelX = direction < 0
    ? api.contracts.conveyor.canvas.w - conveyorChannel.x - conveyorChannel.w
    : conveyorChannel.x;
  assert.deepEqual(clipRects[0].args, [
    mapping.drawX + channelX * mapping.scale,
    mapping.drawY + conveyorChannel.y * mapping.scale,
    conveyorChannel.w * mapping.scale,
    conveyorChannel.h * mapping.scale
  ]);
  const firstMove = recorder.events.find(event => event.type === "moveTo");
  const firstStripeLines = recorder.events
    .filter(event => event.type === "lineTo")
    .slice(0, 3);
  assert.ok(firstMove && firstStripeLines.length === 3);
  const projectedLean = firstStripeLines[2].args[0] - firstMove.args[0];
  assert.ok(Math.abs(
    projectedLean - direction * conveyorChannel.stripeLean * mapping.scale
  ) < 1e-12, "Whole stripe lean must be projected from source space");
  assert.ok(Math.abs(
    Math.abs(projectedLean) / clipRects[0].args[3] -
      conveyorChannel.stripeLean / conveyorChannel.h
  ) < 1e-12, "Whole stripe angle must remain stable across platform widths");
}

function getFirstWholeStripeX(conveyor, visualTime) {
  context.worldTime = visualTime;
  const recorder = createRecorder();
  assert.equal(api.drawConveyorOverlay(recorder.canvasContext, conveyor), true);
  return recorder.events.find(event => event.type === "moveTo").args[0];
}
for (const conveyor of [platforms.conveyor, leftPlatform]) {
  const firstX = getFirstWholeStripeX(conveyor, 1.25);
  const secondX = getFirstWholeStripeX(conveyor, 1.3);
  assert.ok(
    Math.sign(conveyor.conveyorSpeed) * (secondX - firstX) > 0,
    "Whole stripe animation direction must remain tied to Conveyor direction"
  );
}
context.worldTime = 1.25;

for (const name of Object.keys(assets)) {
  api.records[name].contentFit = null;
  for (const [part, contract] of Object.entries(api.legacyContracts[name])) {
    api.legacyImages[name][part].complete = true;
    api.legacyImages[name][part].naturalWidth = contract.canvas.w;
    api.legacyImages[name][part].naturalHeight = contract.canvas.h;
  }
  const recorder = createRecorder();
  assert.equal(api.draw[name](recorder.canvasContext, platforms[name]), true,
    `${name} must retain its complete legacy fallback`);
  assert.ok(recorder.events.filter(event => event.type === "drawImage").length > 1,
    `${name} fallback must use the previous segmented renderer`);
}

const rendererSource = read("js/renderer.js");
assert.match(rendererSource,
  /worldTime \* Math\.abs\(platform\.conveyorSpeed\) \* 0\.72 \+[\s\S]*?platform\.conveyorData\.phase/);
assert.match(rendererSource, /drawX \+= Math\.sin\(worldTime \* 42\)/);
assert.match(rendererSource, /p\.fragile && drawFallingPlatformAsset\(ctx, p, drawX\)/);

console.log("Ice, Falling and Conveyor Whole mapping, direction, overlay and fallback: ok");
