"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const assetPath = path.join(root, "assets/slime/slime_body.png");
const assetBytes = fs.readFileSync(assetPath);
assert.equal(assetBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.equal(assetBytes.readUInt32BE(16), 256);
assert.equal(assetBytes.readUInt32BE(20), 256);
assert.equal(assetBytes[24], 8, "slime body PNG must use 8-bit channels");
assert.equal(assetBytes[25], 6, "slime body PNG must be RGBA");

const rendererSource = fs.readFileSync(path.join(root, "js/renderer.js"), "utf8");
const slimeColorSource = fs.readFileSync(path.join(root, "js/slime-colors.js"), "utf8");
const assetStart = rendererSource.indexOf("  const SLIME_BODY_ASSET_PATH");
const assetEnd = rendererSource.indexOf("  const COLLECTIBLE_STAR_ASSET_PATH", assetStart);
const helperStart = rendererSource.indexOf("  function prepareSlimeBodySourcePixels(");
const previewStart = rendererSource.indexOf("  function drawSlimeCharacterPreview(");
const previewEnd = rendererSource.indexOf("  function drawSlimeCosmeticPreview(", previewStart);
const playerStart = rendererSource.indexOf("  function drawPlayer(");
const playerEnd = rendererSource.indexOf("  function drawParticles(", playerStart);
assert.ok(assetStart >= 0 && assetEnd > assetStart);
assert.ok(helperStart >= 0 && previewStart > helperStart);
assert.ok(previewEnd > previewStart);
assert.ok(playerStart >= 0 && playerEnd > playerStart);

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.decoding = "";
    this.src = "";
  }
}

const sourceData = new Uint8ClampedArray(256 * 256 * 4);
sourceData.set([40, 40, 40, 255], 0);
sourceData.set([224, 224, 224, 180], 4);
const createdCanvases = [];
const document = {
  createElement(tagName) {
    assert.equal(tagName, "canvas");
    const canvas = {
      width: 0,
      height: 0,
      imageData: null,
      getContext() {
        return {
          drawImage() {},
          getImageData() {
            return {data: sourceData, width: 256, height: 256};
          },
          createImageData(width, height) {
            return {data: new Uint8ClampedArray(width * height * 4), width, height};
          },
          putImageData(imageData) {
            canvas.imageData = imageData;
          }
        };
      }
    };
    createdCanvases.push(canvas);
    return canvas;
  }
};

const context = vm.createContext({
  console,
  document,
  Image: FakeImage,
  Map,
  Math,
  Number,
  String,
  Uint8ClampedArray
});
vm.runInContext(`
${rendererSource.slice(assetStart, assetEnd)}
${rendererSource.slice(helperStart, previewStart)}
globalThis.slimeBodyTestApi = {
  image: slimeBodyImage,
  cache: slimeBodyTintCache,
  draw: drawSlimeBody
};
`, context, {filename: "slime-body-renderer-fixture.js"});

function createRecordingContext() {
  const calls = [];
  const writes = [];
  const target = {
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    createRadialGradient: (...args) => {
      const stops = [];
      calls.push(["createRadialGradient", ...args, stops]);
      return {addColorStop: (...stop) => stops.push(stop)};
    },
    beginPath: () => calls.push(["beginPath"]),
    arc: (...args) => calls.push(["arc", ...args]),
    ellipse: (...args) => calls.push(["ellipse", ...args]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"])
  };
  return {
    calls,
    writes,
    context: new Proxy(target, {
      set(object, property, value) {
        writes.push([property, value]);
        object[property] = value;
        return true;
      }
    })
  };
}

const greenPalette = {
  light: "#c5ffcb",
  main: "#70f68a",
  dark: "#28a854",
  outline: "#154d2d",
  glow: "#51ff7a"
};
const goldPalette = {
  specular: "#fff1b0",
  light: "#f5d76e",
  main: "#dfaf24",
  dark: "#a96f00",
  outline: "#6a4300",
  glow: "#ffe28a"
};

const api = context.slimeBodyTestApi;
assert.equal(api.image.src, "assets/slime/slime_body.png");
assert.equal(api.image.decoding, "async");

const fallback = createRecordingContext();
assert.equal(api.draw(fallback.context, greenPalette, 30, {glowBlur: 22}), false);
assert.equal(fallback.calls.some(call => call[0] === "drawImage"), false);
assert.ok(fallback.calls.some(call => call[0] === "arc" && call[3] === 30));
assert.ok(fallback.calls.some(call => call[0] === "stroke"));
assert.ok(fallback.calls.some(call => call[0] === "ellipse"), "player fallback keeps its highlight");

api.image.complete = true;
api.image.naturalWidth = 256;
api.image.naturalHeight = 256;
api.image.onload();
assert.equal(createdCanvases.length, 1, "source pixels are prepared once on image load");

const firstPngDraw = createRecordingContext();
assert.equal(api.draw(firstPngDraw.context, greenPalette, 30, {glowBlur: 22}), true);
const firstImageCall = firstPngDraw.calls.find(call => call[0] === "drawImage");
assert.ok(firstImageCall);
assert.deepEqual(firstImageCall.slice(2), [-40, -40, 80, 80]);
assert.equal(firstPngDraw.calls.some(call => call[0] === "arc"), false);
assert.equal(firstPngDraw.calls.some(call => call[0] === "ellipse"), false);
assert.equal(api.cache.size, 1);

const secondPngDraw = createRecordingContext();
assert.equal(api.draw(secondPngDraw.context, greenPalette, 30), true);
const secondImageCall = secondPngDraw.calls.find(call => call[0] === "drawImage");
assert.equal(secondImageCall[1], firstImageCall[1], "same palette reuses the cached canvas");
assert.equal(api.cache.size, 1);

const goldPngDraw = createRecordingContext();
assert.equal(api.draw(goldPngDraw.context, goldPalette, 30, {gold: true}), true);
const goldImageCall = goldPngDraw.calls.find(call => call[0] === "drawImage");
assert.notEqual(goldImageCall[1], firstImageCall[1]);
assert.equal(api.cache.size, 2, "gold receives its own palette-tinted cache entry");

const greenPixels = firstImageCall[1].imageData.data;
const goldPixels = goldImageCall[1].imageData.data;
assert.notDeepEqual(Array.from(greenPixels.slice(0, 3)), Array.from(greenPixels.slice(4, 7)));
assert.notDeepEqual(Array.from(greenPixels.slice(0, 3)), Array.from(goldPixels.slice(0, 3)));
assert.equal(greenPixels[3], 255);
assert.equal(greenPixels[7], 180, "source alpha is preserved by tinting");

const colorCatalogStart = slimeColorSource.indexOf("  const SLIME_COLOR_ORDER");
const colorCatalogEnd = slimeColorSource.indexOf("  function normalizeSlimeColor(");
assert.ok(colorCatalogStart >= 0 && colorCatalogEnd > colorCatalogStart);
const colorCatalogContext = vm.createContext({Object});
vm.runInContext(`
${slimeColorSource.slice(colorCatalogStart, colorCatalogEnd)}
globalThis.slimeBodyColorCatalog = {
  order: SLIME_COLOR_ORDER,
  palettes: SLIME_COLOR_PALETTES
};
`, colorCatalogContext, {filename: "slime-body-color-catalog-fixture.js"});
const colorCatalog = JSON.parse(JSON.stringify(colorCatalogContext.slimeBodyColorCatalog));
assert.equal(colorCatalog.order.length, 24);
for (const colorId of colorCatalog.order) {
  const paletteDraw = createRecordingContext();
  assert.equal(api.draw(paletteDraw.context, colorCatalog.palettes[colorId], 30), true);
  assert.ok(paletteDraw.calls.some(call => call[0] === "drawImage"), `${colorId} must draw tinted PNG`);
}
assert.equal(api.cache.size, 25, "24 normal palettes plus metallic gold are cached independently");

const previewSource = rendererSource.slice(previewStart, previewEnd);
const playerSource = rendererSource.slice(playerStart, playerEnd);
assert.match(previewSource, /drawSlimeBody\(previewContext, palette, 30,/);
assert.match(playerSource, /drawSlimeBody\(ctx, palette, player\.r,/);
assert.doesNotMatch(previewSource, /createRadialGradient/);
assert.doesNotMatch(playerSource, /createRadialGradient/);
assert.ok(playerSource.indexOf("ctx.scale(sx, sy)") < playerSource.indexOf("drawSlimeBody(ctx"));
assert.ok(playerSource.indexOf("drawSlimeBody(ctx") < playerSource.indexOf("drawSlimeFace(ctx"));
assert.equal((rendererSource.match(/drawSlimeBody\(/g) ?? []).length, 3);

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
  const expected = relativePath === "js/game.js"
    ? normalize(baseline).replace(
        "    updateLiveDevPerkTelemetry(now);\n    draw();",
        "    updateLiveDevPerkTelemetry(now);\n" +
          "    updateMainMenuMascotFaceAnimation(now);\n    draw();"
      )
    : normalize(baseline);
  assert.equal(
    normalize(current),
    expected,
    `${relativePath} must remain unchanged outside the authorized menu face hook`
  );
}

console.log("Slime body PNG loader, tint cache, shared renderer and fallback tests passed.");
