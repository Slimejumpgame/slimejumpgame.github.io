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
const assetRelativePath = "assets/environments/meadow/hazards/meadow_bottom_spike_tile.png";
const assetBytes = fs.readFileSync(path.join(root, assetRelativePath));

assert.equal(assetBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.equal(assetBytes.readUInt32BE(16), 256);
assert.equal(assetBytes.readUInt32BE(20), 320);
assert.equal(assetBytes[24], 8, "spike PNG must use 8-bit channels");
assert.equal(assetBytes[25], 6, "spike PNG must be RGBA");
assert.equal(assetBytes[28], 0, "spike PNG must be non-interlaced");

const idatChunks = [];
for (let offset = 8; offset < assetBytes.length;) {
  const length = assetBytes.readUInt32BE(offset);
  const type = assetBytes.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") idatChunks.push(assetBytes.subarray(offset + 8, offset + 8 + length));
  offset += 12 + length;
}
const width = 256;
const height = 320;
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
  {x: 10, y: 13, w: 235, h: 297},
  "renderer source rect must match the actual visible alpha bounds"
);

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
    this.complete = true;
    this.naturalWidth = 1;
    this.naturalHeight = 1;
    this.onload?.();
  }

  get src() {
    return this._src;
  }
}

const visualContext = vm.createContext({Image: FakeImage, Math, Promise});
vm.runInContext(`${read("js/visual-platform-kit.js")}
${read("js/visual-decor-kit.js")}
${read("js/visual-portal-kit.js")}
${read("js/visual-meadow-assets.js")}
globalThis.spikeVisualApi = MEADOW_ASSET_VISUALS;
`, visualContext, {filename: "meadow-spike-visual-fixture.js"});
const visualApi = visualContext.spikeVisualApi;
assert.equal(
  visualApi.getStatus().paths.bottom_spike_tile,
  assetRelativePath,
  "Meadow loader must own the spike tile path"
);

const drawCalls = [];
const contextCalls = [];
const canvasContext = {
  save: () => contextCalls.push("save"),
  restore: () => contextCalls.push("restore"),
  drawImage: (...args) => drawCalls.push(args)
};
const rect = {x: 235, y: 690, w: 825, h: 30};
const count = Math.max(2, Math.floor(rect.w / 24));
const step = rect.w / count;
assert.equal(count, 34);
assert.equal(step, 24.264705882352942);
assert.equal(visualApi.drawBottomSpikeHazard(canvasContext, rect, count, step), true);
assert.equal(drawCalls.length, 34);
for (let i = 0; i < drawCalls.length; i++) {
  const call = drawCalls[i];
  assert.deepEqual(call.slice(1, 5), [10, 13, 235, 297]);
  assert.equal(call[5], rect.x + i * step, `tile ${i} destination x must not be rounded`);
  assert.equal(call[6], rect.y);
  assert.equal(call[7], step);
  assert.equal(call[8], rect.h);
  assert.equal(call[6] + call[8], rect.y + rect.h, "visible baseline must remain at y=720");
}
assert.ok(Math.abs(drawCalls.at(-1)[5] + drawCalls.at(-1)[7] - (rect.x + rect.w)) < 1e-9);
assert.deepEqual(contextCalls, ["save", "restore"]);

const hazardsSource = read("js/hazards.js");
const spikeFunctionStart = hazardsSource.indexOf("  function drawSpikeHazard");
const spikeFunctionEnd = hazardsSource.indexOf("  function fillHazardGradient", spikeFunctionStart);
assert.ok(spikeFunctionStart >= 0 && spikeFunctionEnd > spikeFunctionStart);
const spikeFunctionSource = hazardsSource.slice(spikeFunctionStart, spikeFunctionEnd);

function runSpikeRenderer(pngResult) {
  const canvasCalls = [];
  let pngArguments = null;
  const ctx = {
    beginPath: () => canvasCalls.push(["beginPath"]),
    moveTo: (...args) => canvasCalls.push(["moveTo", ...args]),
    lineTo: (...args) => canvasCalls.push(["lineTo", ...args]),
    closePath: () => canvasCalls.push(["closePath"]),
    fill: () => canvasCalls.push(["fill"]),
    stroke: () => canvasCalls.push(["stroke"])
  };
  const fixture = vm.createContext({
    ctx,
    MEADOW_ASSET_VISUALS: {
      drawBottomSpikeHazard(...args) {
        pngArguments = args;
        return pngResult;
      }
    }
  });
  vm.runInContext(`${spikeFunctionSource}
globalThis.run = drawSpikeHazard;
`, fixture);
  fixture.run(rect, {fill: "#fff", stroke: "#000"});
  return {canvasCalls, pngArguments};
}

const pngResult = runSpikeRenderer(true);
assert.equal(pngResult.pngArguments[2], 34);
assert.equal(pngResult.pngArguments[3], step);
assert.equal(pngResult.canvasCalls.length, 0, "valid PNG must replace Canvas triangles");

const fallbackResult = runSpikeRenderer(false);
assert.equal(fallbackResult.canvasCalls.filter(call => call[0] === "beginPath").length, 34);
assert.equal(fallbackResult.canvasCalls.filter(call => call[0] === "fill").length, 34);
assert.equal(fallbackResult.canvasCalls.filter(call => call[0] === "stroke").length, 34);
assert.deepEqual(fallbackResult.canvasCalls.find(call => call[0] === "moveTo"), ["moveTo", 235, 720]);

assert.equal((hazardsSource.match(/drawBottomSpikeHazard/g) || []).length, 1);
assert.match(hazardsSource, /spikes:\s*drawSpikeHazard/);
for (const mapping of ["water", "quicksand", "lava", "iceWater", "toxic", "crystalPit", "abyss", "thorns", "cloudAbyss"]) {
  assert.match(hazardsSource, new RegExp(`${mapping}:\\s*draw`));
}
const biomesSource = read("js/biomes.js");
assert.equal((biomesSource.match(/type:\s*"spikes"/g) || []).length, 1);

for (const relativePath of [
  "js/biomes.js",
  "js/core.js",
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/platforms.js",
  "js/player.js",
  "js/renderer.js"
]) {
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(read(relativePath)),
    normalize(baseline),
    `${relativePath} must remain unchanged by the spike visual upgrade`
  );
}

console.log("Meadow spike PNG alpha bounds, tiling, baseline, fallback and scope tests passed.");
