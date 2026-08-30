"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = source => source.replace(/\r\n/g, "\n");
const assetContracts = Object.freeze({
  normal: Object.freeze({
    path: "assets/enemies/ghost_normal.png",
    bounds: Object.freeze({x: 9, y: 8, w: 235, h: 248})
  }),
  fast: Object.freeze({
    path: "assets/enemies/ghost_fast.png",
    bounds: Object.freeze({x: 6, y: 0, w: 244, h: 239})
  })
});

function decodeRgbaPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(width, 256);
  assert.equal(height, 256);
  assert.equal(bytes[24], 8, `${relativePath} must use 8-bit channels`);
  assert.equal(bytes[25], 6, `${relativePath} must be RGBA`);
  assert.equal(bytes[28], 0, `${relativePath} must be non-interlaced`);

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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * stride + x * bytesPerPixel + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    bytes,
    bounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1}
  };
}

const assetHashes = new Map();
for (const contract of Object.values(assetContracts)) {
  const decoded = decodeRgbaPng(contract.path);
  assert.deepEqual(decoded.bounds, contract.bounds);
  assetHashes.set(
    contract.path,
    crypto.createHash("sha256").update(decoded.bytes).digest("hex")
  );
}

function createEnemyFixture(imagesReady = true) {
  const images = [];
  class FakeImage {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.onload = null;
      this.onerror = null;
      images.push(this);
    }

    set src(value) {
      this._src = value;
      this.complete = imagesReady;
      this.naturalWidth = imagesReady ? 256 : 0;
      this.naturalHeight = imagesReady ? 256 : 0;
    }

    get src() {
      return this._src;
    }
  }

  const calls = [];
  const writes = [];
  const target = {
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    translate: (...args) => calls.push(["translate", ...args]),
    scale: (...args) => calls.push(["scale", ...args]),
    rotate: (...args) => calls.push(["rotate", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    quadraticCurveTo: (...args) => calls.push(["quadraticCurveTo", ...args]),
    closePath: () => calls.push(["closePath"]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"]),
    arc: (...args) => calls.push(["arc", ...args])
  };
  const ctx = new Proxy(target, {
    set(object, property, value) {
      writes.push([property, value]);
      object[property] = value;
      return true;
    }
  });
  const sandbox = {
    Image: FakeImage,
    Math,
    Object,
    ctx,
    enemies: [],
    player: {x: 0, y: 0, r: 30},
    worldTime: 0
  };
  sandbox.currentLevel = () => ({enemies: sandbox.enemies});
  const context = vm.createContext(sandbox);
  vm.runInContext(`${read("js/enemies.js")}
globalThis.ghostTestApi = {
  getEnemies,
  drawEnemies,
  getGhostFacingScaleX,
  getGhostImageDrawContract,
  visuals: GHOST_VISUALS,
  images: ghostImages
};
`, context, {filename: "ghost-enemy-render-fixture.js"});
  return {
    context,
    api: context.ghostTestApi,
    calls,
    writes,
    images,
    clear() {
      calls.length = 0;
      writes.length = 0;
    }
  };
}

const fixture = createEnemyFixture(true);
assert.equal(fixture.images.length, 2, "each ghost image must be constructed exactly once");
assert.deepEqual(
  fixture.images.map(image => image.src),
  [assetContracts.normal.path, assetContracts.fast.path]
);

function renderOne(enemy, {time = 0, playerX = 0} = {}) {
  fixture.clear();
  fixture.context.enemies = [enemy];
  fixture.context.worldTime = time;
  fixture.context.player.x = playerX;
  fixture.api.drawEnemies();
  return {
    translate: fixture.calls.find(call => call[0] === "translate"),
    scale: fixture.calls.find(call => call[0] === "scale"),
    drawImage: fixture.calls.find(call => call[0] === "drawImage")
  };
}

const normal = {type: "normal", x: 100, y: 200, r: 24, axis: "x", range: 40, speed: 1, phase: 0};
let rendered = renderOne(normal);
assert.deepEqual(rendered.translate, ["translate", 100, 200]);
assert.deepEqual(rendered.scale, ["scale", -1, 1], "right-moving ghost must mirror");
assert.equal(rendered.drawImage[1].src, assetContracts.normal.path);
const oldNormalDrawSize = (normal.r * 2 + 4) * 256 / 248;
const normalDrawSize = oldNormalDrawSize * 1.08;
assert.equal(normalDrawSize / oldNormalDrawSize, 1.08);
assert.equal(rendered.drawImage[4], normalDrawSize);
assert.equal(rendered.drawImage[5], normalDrawSize);
const normalScale = normalDrawSize / 256;
assert.equal(rendered.drawImage[2], -normalDrawSize / 2 + 1.5 * normalScale);
assert.equal(rendered.drawImage[3], -normalDrawSize / 2 - 4 * normalScale);

rendered = renderOne(normal, {time: Math.PI});
assert.deepEqual(rendered.scale, ["scale", 1, 1], "left-moving ghost must use original image");
assert.equal(
  rendered.translate[2],
  normal.y + Math.sin(Math.PI * 4.2 + normal.phase) * 3,
  "normal bobbing must remain ±3 px at 4.2 rad/s"
);

rendered = renderOne(normal, {time: Math.PI / 2 - 1e-6});
assert.deepEqual(rendered.scale, ["scale", -1, 1]);
rendered = renderOne(normal, {time: Math.PI / 2 + 1e-6});
assert.deepEqual(rendered.scale, ["scale", 1, 1], "facing must switch with cosine at the turn");

const verticalNormal = {...normal, axis: "y"};
assert.deepEqual(renderOne(verticalNormal, {playerX: 90}).scale, ["scale", 1, 1]);
assert.deepEqual(renderOne(verticalNormal, {playerX: 110}).scale, ["scale", -1, 1]);
assert.deepEqual(renderOne(verticalNormal, {playerX: 100}).scale, ["scale", 1, 1]);

const fast = {type: "fast", x: 300, y: 180, r: 29, axis: "y", range: 55, speed: 2, phase: 0.4};
rendered = renderOne(fast, {time: 0.7, playerX: 350});
assert.equal(rendered.drawImage[1].src, assetContracts.fast.path);
assert.deepEqual(rendered.scale, ["scale", -1, 1]);
assert.equal(
  rendered.translate[2],
  fast.y + Math.sin(0.7 * fast.speed + fast.phase) * fast.range +
    Math.sin(0.7 * 6.2 + fast.phase) * 3,
  "fast gameplay movement and 6.2 rad/s bobbing must remain separate"
);
const oldFastDrawSize = (fast.r * 2 + 4) * 256 / 244;
const fastDrawSize = oldFastDrawSize * 1.08;
assert.equal(fastDrawSize / oldFastDrawSize, 1.08);
assert.equal(rendered.drawImage[4], fastDrawSize);
assert.equal(rendered.drawImage[5], fastDrawSize);
const fastScale = fastDrawSize / 256;
assert.equal(rendered.drawImage[2], -fastDrawSize / 2);
assert.equal(rendered.drawImage[3], -fastDrawSize / 2 + 8.5 * fastScale);

assert.equal(fixture.calls.some(call => call[0] === "rotate"), false);
assert.ok(fixture.calls.filter(call => call[0] === "scale").every(call => call[2] === 1));
assert.ok(fixture.writes.some(write => write[0] === "shadowColor" && write[1] === "#ff552f"));
assert.ok(fixture.writes.some(write => write[0] === "shadowBlur" && write[1] === 20));
renderOne(normal);
assert.ok(fixture.writes.some(write => write[0] === "shadowColor" && write[1] === "#b46cff"));

const fallback = createEnemyFixture(false);
fallback.context.enemies = [normal, fast];
fallback.api.drawEnemies();
assert.equal(fallback.calls.some(call => call[0] === "drawImage"), false);
assert.equal(fallback.calls.filter(call => call[0] === "quadraticCurveTo").length, 4);
assert.ok(fallback.calls.filter(call => call[0] === "fill").length >= 6);
assert.ok(fallback.calls.filter(call => call[0] === "stroke").length >= 6);

const enemySource = read("js/enemies.js");
assert.doesNotMatch(enemySource, /Math\.random\s*\(/);
assert.doesNotMatch(enemySource, /\.rotate\s*\(/);
assert.match(enemySource, /Math\.sin\(getEnemyMotionTheta\(enemy\)\) \* enemy\.range/);
assert.match(enemySource, /const bobSpeed = isFast \? 6\.2 : 4\.2/);
assert.match(enemySource, /const bob = Math\.sin\(worldTime \* bobSpeed \+ enemy\.phase\) \* 3/);

for (const relativePath of [
  "js/level-generator.js",
  "js/player.js",
  "js/tutorials.js"
]) {
  const baseline = execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(
    normalize(read(relativePath)),
    normalize(baseline),
    `${relativePath} must remain unchanged by the ghost PNG integration`
  );
}
const physicsSource = read("js/physics.js");
const baselinePhysicsSource = execFileSync("git", ["show", "HEAD:js/physics.js"], {
  cwd: root,
  encoding: "utf8"
});
assert.equal(
  normalize(physicsSource),
  normalize(baselinePhysicsSource),
  "physics.js must match the final HEAD collision contract"
);
assert.match(physicsSource, /player\.r \* 0\.74 \+ enemy\.r \* 0\.8856/);
assert.equal((physicsSource.match(/enemy\.r \* 0\.8856/g) || []).length, 1);
assert.doesNotMatch(physicsSource, /enemy\.r \* 0\.82\b/);
assert.match(physicsSource, /enemy\.type === "fast" \? "fast_ghost" : "ghost"/);
assert.ok(Math.abs(0.82 * 1.08 - 0.8856) < Number.EPSILON);

for (const [relativePath, expectedHash] of assetHashes) {
  const actualHash = crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
  assert.equal(actualHash, expectedHash, `${relativePath} must remain unchanged`);
}

console.log("Ghost PNG assets, scaling, facing, bobbing, fallback and scope tests passed.");
