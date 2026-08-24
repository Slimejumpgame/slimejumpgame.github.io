"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const assetPath = path.join(root, "assets/collectibles/star_collectible.png");
const assetBytes = fs.readFileSync(assetPath);
assert.equal(assetBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.equal(assetBytes.readUInt32BE(16), 256);
assert.equal(assetBytes.readUInt32BE(20), 256);
assert.equal(assetBytes[24], 8, "collectible star PNG must use 8-bit channels");
assert.equal(assetBytes[25], 6, "collectible star PNG must be RGBA");

const rendererPath = path.join(root, "js/renderer.js");
const rendererSource = fs.readFileSync(rendererPath, "utf8");
const assetBlockStart = rendererSource.indexOf("  const COLLECTIBLE_STAR_ASSET_PATH");
const assetBlockEnd = rendererSource.indexOf("  const TUTORIAL_DRAG_HAND_RENDER_SIZE", assetBlockStart);
const drawBlockStart = rendererSource.indexOf("  function drawCanvasCollectibleStarFallback");
const drawBlockEnd = rendererSource.indexOf("  let currentAimBouncePreviewHit", drawBlockStart);
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
  translate: (...args) => calls.push(["translate", ...args]),
  rotate: (...args) => calls.push(["rotate", ...args]),
  drawImage: (...args) => calls.push(["drawImage", ...args]),
  beginPath: () => calls.push(["beginPath"]),
  moveTo: (...args) => calls.push(["moveTo", ...args]),
  lineTo: (...args) => calls.push(["lineTo", ...args]),
  closePath: () => calls.push(["closePath"]),
  fill: () => calls.push(["fill"]),
  stroke: () => calls.push(["stroke"])
};
const ctx = new Proxy(canvasTarget, {
  set(target, property, value) {
    propertyWrites.push([property, value]);
    target[property] = value;
    return true;
  }
});
const level = {stars: [{x: 120, y: 240}]};
const context = vm.createContext({ctx, Image: FakeImage, level, Math});
vm.runInContext(`
${rendererSource.slice(assetBlockStart, assetBlockEnd)}
let collected = [false];
let worldTime = 2;
function currentLevel() { return level; }
${rendererSource.slice(drawBlockStart, drawBlockEnd)}
globalThis.starTestApi = {
  image: collectibleStarImage,
  drawStars,
  setCollected(value) { collected = value; },
  setWorldTime(value) { worldTime = value; }
};
`, context, {filename: "collectible-star-renderer-fixture.js"});

const api = context.starTestApi;
assert.equal(api.image.src, "assets/collectibles/star_collectible.png");

api.drawStars();
assert.equal(calls.some(call => call[0] === "drawImage"), false);
assert.equal(calls.filter(call => call[0] === "moveTo").length, 1);
assert.equal(calls.filter(call => call[0] === "lineTo").length, 9);
assert.equal(calls.filter(call => call[0] === "fill").length, 1);
assert.equal(calls.filter(call => call[0] === "stroke").length, 1);
assert.deepEqual(calls.find(call => call[0] === "translate").slice(1), [120, 240]);
assert.deepEqual(calls.find(call => call[0] === "rotate").slice(1), [3]);
assert.ok(propertyWrites.some(write => write[0] === "shadowColor" && write[1] === "#ffe95c"));
assert.ok(propertyWrites.some(write => write[0] === "shadowBlur" && write[1] === 18));

calls.length = 0;
propertyWrites.length = 0;
api.image.complete = true;
api.image.naturalWidth = 256;
api.image.naturalHeight = 256;
api.drawStars();
const imageCall = calls.find(call => call[0] === "drawImage");
assert.ok(imageCall);
assert.equal(imageCall[1], api.image);
assert.deepEqual(imageCall.slice(2), [-30, -30, 60, 60]);
assert.equal(calls.some(call => call[0] === "beginPath"), false);
assert.deepEqual(calls.find(call => call[0] === "translate").slice(1), [120, 240]);
assert.deepEqual(calls.find(call => call[0] === "rotate").slice(1), [3]);
assert.ok(propertyWrites.some(write => write[0] === "shadowColor" && write[1] === "#ffe95c"));
assert.ok(propertyWrites.some(write => write[0] === "shadowBlur" && write[1] === 18));

calls.length = 0;
api.image.naturalWidth = 0;
api.drawStars();
assert.equal(calls.some(call => call[0] === "drawImage"), false);
assert.equal(calls.some(call => call[0] === "beginPath"), true);

const normalize = source => source.replace(/\r\n/g, "\n");
for (const relativePath of [
  "js/game.js",
  "js/level-generator.js",
  "js/physics.js",
  "js/player.js"
]) {
  const current = fs.readFileSync(path.join(root, relativePath), "utf8");
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(current),
    normalize(baseline),
    `${relativePath} must remain unchanged by the collectible-star visual upgrade`
  );
}

console.log("Collectible star PNG loader, renderer, fallback and gameplay-scope tests passed.");
