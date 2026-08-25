"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const wholeAssets = Object.freeze({
  meadow: Object.freeze({
    path: "assets/environments/meadow/platforms/meadow_floating_platform.png",
    alpha0: Object.freeze({x: 0, y: 10, w: 512, h: 107}),
    alpha8: Object.freeze({x: 1, y: 12, w: 510, h: 103}),
    supportY: 26,
    supportHeight: 56
  }),
  coast: Object.freeze({
    path: "assets/environments/coast/platforms/coast_floating_platform.png",
    alpha0: Object.freeze({x: 0, y: 0, w: 512, h: 115}),
    alpha8: Object.freeze({x: 2, y: 14, w: 509, h: 99}),
    supportY: 34,
    supportHeight: 47
  })
});

function decodeRgba8Png(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must use RGBA`);
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

function getAlphaAnalysis(decoded, threshold) {
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
      run += 1;
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
  const minimumSupportRun = Math.ceil(bounds.w * 0.9);
  let best = null;
  let runStart = -1;
  for (let y = 0; y <= decoded.height; y++) {
    const covered = y < decoded.height && longestRuns[y] >= minimumSupportRun;
    if (covered && runStart < 0) runStart = y;
    if (!covered && runStart >= 0) {
      if (!best || y - runStart > best.h) best = {y: runStart, h: y - runStart};
      runStart = -1;
    }
  }
  return Object.freeze({bounds, supportBand: Object.freeze(best)});
}

const decodedByPath = Object.fromEntries(Object.values(wholeAssets).map(asset => (
  [asset.path, decodeRgba8Png(asset.path)]
)));
for (const asset of Object.values(wholeAssets)) {
  const decoded = decodedByPath[asset.path];
  assert.deepEqual({w: decoded.width, h: decoded.height}, {w: 512, h: 128});
  assert.deepEqual(getAlphaAnalysis(decoded, 0).bounds, asset.alpha0);
  const alpha8 = getAlphaAnalysis(decoded, 8);
  assert.deepEqual(alpha8.bounds, asset.alpha8);
  assert.deepEqual(alpha8.supportBand, {
    y: asset.supportY,
    h: asset.supportHeight
  });
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
    if (!decoded) {
      this.onerror?.();
      return;
    }
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
const platformKitSource = read("js/visual-platform-kit.js");
const context = vm.createContext({Image: FakeImage, Math, Promise, document});
vm.runInContext(`${platformKitSource}
  ${read("js/visual-decor-kit.js")}
  ${read("js/visual-portal-kit.js")}
  ${read("js/visual-meadow-assets.js")}
  globalThis.wholeFloatingTestApi = Object.freeze({
    meadow: MEADOW_ASSET_VISUALS.getPlatformKit(),
    coast: BIOME_PLATFORM_VISUALS.resolve("coast")
  });
`, context, {filename: "whole-floating-platform-fixture.js"});

function createDrawRecorder() {
  const calls = [];
  let strokes = 0;
  const canvasContext = new Proxy({
    save() {}, restore() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {},
    clip() {}, rect() {}, stroke() { strokes++; },
    drawImage(...args) { calls.push(args); }
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
  return {canvasContext, calls, get strokes() { return strokes; }};
}

for (const [biome, expected] of Object.entries(wholeAssets)) {
  const api = context.wholeFloatingTestApi[biome];
  const status = JSON.parse(JSON.stringify(api.getStatus()));
  assert.equal(status.familyBReady, true);
  assert.equal(status.wholeFamilyBReady, true);
  assert.deepEqual(status.wholeFloatingContentFit, {
    analyzed: true,
    alphaThreshold: 8,
    supportRowMinimumCoverage: 0.9,
    visibleContentBounds: expected.alpha8,
    supportY: expected.supportY,
    supportBand: {y: expected.supportY, h: expected.supportHeight}
  });

  for (const width of [100, 138, 181]) {
    const platform = {x: 420.25, y: 310.5, w: width, h: 26};
    const before = {...platform};
    const draw = createDrawRecorder();
    assert.equal(api.drawPlatformBase(draw.canvasContext, platform), true);
    assert.deepEqual(platform, before, "rendering must not mutate gameplay geometry");
    assert.equal(draw.calls.length, 1, "whole image must be drawn exactly once");
    assert.equal(draw.strokes, 0, "whole artwork must not receive a legacy vector outline");
    const call = draw.calls[0];
    const mapping = JSON.parse(JSON.stringify(api.getWholeFloatingMapping(platform)));
    assert.equal(call[0].src, expected.path);
    assert.deepEqual(call.slice(1, 5), [0, 0, 512, 128]);
    assert.deepEqual(call.slice(5), [
      mapping.drawX,
      mapping.drawY,
      mapping.drawWidth,
      mapping.drawHeight
    ]);
    assert.equal(mapping.scale, width / expected.alpha8.w);
    assert.equal(
      mapping.drawX + expected.alpha8.x * mapping.scale,
      platform.x
    );
    assert.equal(
      mapping.drawX + (expected.alpha8.x + expected.alpha8.w) * mapping.scale,
      platform.x + platform.w
    );
    assert.equal(mapping.drawY + expected.supportY * mapping.scale, platform.y);
    assert.equal(mapping.drawWidth / mapping.drawHeight, 4);
    if (width === 138) {
      assert.notEqual(mapping.drawHeight, 26);
      assert.notEqual(mapping.drawHeight, 44);
    }
    if (width === 181) {
      assert.ok(
        mapping.drawY + (expected.alpha8.y + expected.alpha8.h) * mapping.scale >
          platform.y + platform.h,
        "whole artwork must be free to extend below the 26px collision"
      );
    }
    assert.ok(
      mapping.drawY + expected.alpha8.y * mapping.scale < platform.y,
      "decorative alpha above the carrying surface must remain visible"
    );
  }

  const specialDraw = createDrawRecorder();
  assert.equal(
    api.drawPlatformBase(
      specialDraw.canvasContext,
      {x: 420, y: 310, w: 138, h: 26, ice: true}
    ),
    false,
    "whole artwork must remain excluded from unsupported special platforms"
  );
  assert.deepEqual(specialDraw.calls, []);

  for (const flag of ["moving", "fade", "spikePlatform"]) {
    const specialBase = {
      x: 437.25,
      y: 294.75,
      w: 138,
      h: 26,
      [flag]: true
    };
    const specialBefore = {...specialBase};
    const specialBaseDraw = createDrawRecorder();
    assert.equal(api.drawPlatformBase(specialBaseDraw.canvasContext, specialBase), true);
    assert.deepEqual(specialBase, specialBefore);
    assert.equal(specialBaseDraw.calls.length, 1);
    assert.equal(specialBaseDraw.calls[0][0].src, expected.path);
    const specialMapping = JSON.parse(JSON.stringify(
      api.getWholeFloatingMapping(specialBase)
    ));
    assert.equal(
      specialMapping.drawX + expected.alpha8.x * specialMapping.scale,
      specialBase.x
    );
    assert.equal(
      specialMapping.drawX +
        (expected.alpha8.x + expected.alpha8.w) * specialMapping.scale,
      specialBase.x + specialBase.w
    );
    assert.equal(
      specialMapping.drawY + expected.supportY * specialMapping.scale,
      specialBase.y
    );
  }
}

assert.doesNotMatch(
  platformKitSource,
  /floatingVisualBodyHeight|DEFAULT_FLOATING_VISUAL_BODY_HEIGHT/
);

console.log("Whole Floating PNG bounds, support anchoring and uniform draw contract: ok");
