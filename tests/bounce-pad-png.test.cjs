"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const assetPath = path.join(root, "assets/gameplay/bounce_pad.png");
const assetBytes = fs.readFileSync(assetPath);
assert.equal(assetBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.equal(assetBytes.readUInt32BE(16), 256);
assert.equal(assetBytes.readUInt32BE(20), 128);
assert.equal(assetBytes[24], 8, "bounce pad PNG must use 8-bit channels");
assert.equal(assetBytes[25], 6, "bounce pad PNG must be RGBA");
assert.equal(assetBytes[28], 0, "bounce pad PNG must be non-interlaced");

const idatChunks = [];
for (let offset = 8; offset < assetBytes.length;) {
  const length = assetBytes.readUInt32BE(offset);
  const type = assetBytes.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") idatChunks.push(assetBytes.subarray(offset + 8, offset + 8 + length));
  offset += 12 + length;
}
const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
const width = 256;
const height = 128;
const bytesPerPixel = 4;
const stride = width * bytesPerPixel;
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
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (pixels[y * stride + x * bytesPerPixel + 3] === 0) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}
assert.deepEqual(
  {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1},
  {x: 0, y: 22, w: 256, h: 104},
  "bounce pad asset must retain its final visible alpha bounds"
);

const rendererPath = path.join(root, "js/renderer.js");
const rendererSource = fs.readFileSync(rendererPath, "utf8");
const assetBlockStart = rendererSource.indexOf("  const BOUNCE_PAD_ASSET_PATH");
const assetBlockEnd = rendererSource.indexOf("  const TUTORIAL_DRAG_HAND_RENDER_SIZE", assetBlockStart);
const drawBlockStart = rendererSource.indexOf("  function drawCanvasBouncePadFallback");
const drawBlockEnd = rendererSource.indexOf("  function drawPlatforms", drawBlockStart);
assert.ok(assetBlockStart >= 0 && assetBlockEnd > assetBlockStart);
assert.ok(drawBlockStart >= 0 && drawBlockEnd > drawBlockStart);

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.src = "";
  }
}

const calls = [];
const propertyWrites = [];
const canvasTarget = {
  save: () => calls.push(["save"]),
  restore: () => calls.push(["restore"]),
  drawImage: (...args) => calls.push(["drawImage", ...args]),
  fill: () => calls.push(["fill"]),
  beginPath: () => calls.push(["beginPath"]),
  moveTo: (...args) => calls.push(["moveTo", ...args]),
  lineTo: (...args) => calls.push(["lineTo", ...args]),
  closePath: () => calls.push(["closePath"])
};
const ctx = new Proxy(canvasTarget, {
  set(target, property, value) {
    propertyWrites.push([property, value]);
    target[property] = value;
    return true;
  }
});
const pad = {x: 100, y: 200, w: 60, h: 28};
const level = {pads: [pad]};
const context = vm.createContext({ctx, Image: FakeImage, Object, level});
vm.runInContext(`
${rendererSource.slice(assetBlockStart, assetBlockEnd)}
function currentLevel() { return level; }
function roundedRect(...args) { ctx.roundedRectArgs = args; }
${rendererSource.slice(drawBlockStart, drawBlockEnd)}
globalThis.bouncePadTestApi = {image: bouncePadImage, drawBouncePads};
`, context, {filename: "bounce-pad-renderer-fixture.js"});

const api = context.bouncePadTestApi;
assert.equal(api.image.src, "assets/gameplay/bounce_pad.png");

api.drawBouncePads();
assert.equal(calls.some(call => call[0] === "drawImage"), false);
assert.deepEqual(Array.from(ctx.roundedRectArgs), [pad.x, pad.y, pad.w, pad.h, 9]);
assert.equal(calls.filter(call => call[0] === "fill").length, 3);
assert.ok(propertyWrites.some(write => write[0] === "shadowColor" && write[1] === "#4ddcff"));
assert.ok(propertyWrites.some(write => write[0] === "shadowBlur" && write[1] === 18));

calls.length = 0;
propertyWrites.length = 0;
api.image.complete = true;
api.image.naturalWidth = 256;
api.image.naturalHeight = 128;
api.drawBouncePads();
const imageCall = calls.find(call => call[0] === "drawImage");
assert.ok(imageCall);
assert.equal(imageCall[1], api.image);
assert.deepEqual(imageCall.slice(2), [0, 15, 256, 104, 100, 200, 60, 28]);
assert.equal(calls.some(call => call[0] === "beginPath"), false);
assert.ok(propertyWrites.some(write => write[0] === "shadowColor" && write[1] === "#4ddcff"));
assert.ok(propertyWrites.some(write => write[0] === "shadowBlur" && write[1] === 18));
assert.deepEqual(pad, {x: 100, y: 200, w: 60, h: 28});

assert.match(
  rendererSource,
  /drawPlatforms\(\s*biome,\s*biomePlatformVisuals,\s*"floating-only",\s*platformRoleVisuals\s*\);[\s\S]*?drawFloatingBackDecor\?\.\(ctx, biomeDecorScene\);[\s\S]*?drawBouncePads\(\);[\s\S]*?drawGoal\(biomePlatformVisuals, biomePortalVisuals, biome\);/
);

const normalize = source => source.replace(/\r\n/g, "\n");
for (const relativePath of [
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/player.js",
  "js/platforms.js"
]) {
  const current = fs.readFileSync(path.join(root, relativePath), "utf8");
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the bounce-pad visual upgrade`
  );
}

console.log("Bounce pad PNG, alpha bounds, fallback, alignment, layering and scope tests passed.");
