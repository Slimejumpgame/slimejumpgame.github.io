"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualSource = read("js/visual-pirate-harbor-assets.js");
const rendererSource = read("js/renderer.js");
const biomeSource = read("js/biomes.js");
const hazardsSource = read("js/hazards.js");
const levelGeneratorSource = read("js/level-generator.js");
const indexSource = read("index.html");
const backgroundDirectory = "assets/environments/pirateHarbor/background";
const assetPaths = Object.freeze({
  skybox: `${backgroundDirectory}/pirateHarbor_background_skybox.png`,
  cloudsBack: `${backgroundDirectory}/pirateHarbor_background_clouds_back.png`,
  shipDistant: `${backgroundDirectory}/pirateHarbor_background_ship_distant.png`,
  ocean: `${backgroundDirectory}/pirateHarbor_background_ocean.png`,
  sun: `${backgroundDirectory}/pirateHarbor_background_sun.png`,
  cloudsFront: `${backgroundDirectory}/pirateHarbor_background_clouds_front.png`,
  shipMain: `${backgroundDirectory}/pirateHarbor_background_ship_main.png`
});
const backgroundSize = Object.freeze({w: 1280, h: 720});
const hazardPath =
  "assets/environments/pirateHarbor/hazards/pirateHarbor_hazard_main.png";
const hazardSize = Object.freeze({w: 1650, h: 60});
assert.deepEqual(
  fs.readdirSync(path.join(root, backgroundDirectory)).sort(),
  Object.values(assetPaths).map(file => path.posix.basename(file)).sort()
);

function decodePng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8);
  assert.ok(
    colorType === 2 || colorType === 6,
    `${relativePath} must remain RGB or RGBA`
  );
  assert.equal(bytes[28], 0);
  const channels = colorType === 6 ? 4 : 3;
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") {
      idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const alpha = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
  let packedOffset = 0;
  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= upDistance && leftDistance <= upperLeftDistance
      ? left
      : upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++];
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail(`unsupported PNG filter ${filter}`);
      current[x] = (packed[packedOffset++] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      alpha[y * width + x] = colorType === 6
        ? current[x * channels + 3]
        : 255;
    }
    previous = current;
  }
  return Object.freeze({width, height, colorType, alpha});
}

function getAlphaContract(decoded, threshold = 0) {
  let visiblePixels = 0;
  let transparentPixels = 0;
  const columnMaximum = new Uint8Array(decoded.width);
  const rowMaximum = new Uint8Array(decoded.height);
  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      const alpha = decoded.alpha[y * decoded.width + x];
      if (alpha > 0) visiblePixels++;
      if (alpha < 255) transparentPixels++;
      columnMaximum[x] = Math.max(columnMaximum[x], alpha);
      rowMaximum[y] = Math.max(rowMaximum[y], alpha);
    }
  }
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  while (left < decoded.width && columnMaximum[left] <= threshold) left++;
  while (
    right < decoded.width &&
    columnMaximum[decoded.width - 1 - right] <= threshold
  ) right++;
  while (top < decoded.height && rowMaximum[top] <= threshold) top++;
  while (
    bottom < decoded.height &&
    rowMaximum[decoded.height - 1 - bottom] <= threshold
  ) bottom++;
  return Object.freeze({
    visiblePixels,
    transparentPixels,
    edges: Object.freeze({left, right, top, bottom})
  });
}

const decodedAssets = Object.freeze(Object.fromEntries(
  Object.entries(assetPaths).map(([name, relativePath]) => (
    [name, decodePng(relativePath)]
  ))
));
const alphaContracts = Object.freeze(Object.fromEntries(
  Object.entries(decodedAssets).map(([name, decoded]) => (
    [name, getAlphaContract(decoded)]
  ))
));
const decodedHazard = decodePng(hazardPath);
const hazardAlphaContract = getAlphaContract(decodedHazard);
assert.deepEqual(
  {w: decodedHazard.width, h: decodedHazard.height},
  hazardSize
);
assert.equal(decodedHazard.colorType, 6);
assert.ok(hazardAlphaContract.visiblePixels > 0);
assert.ok(hazardAlphaContract.transparentPixels > 0);
for (const [name, decoded] of Object.entries(decodedAssets)) {
  assert.deepEqual({w: decoded.width, h: decoded.height}, backgroundSize);
  assert.ok(alphaContracts[name].visiblePixels > 0);
  if (decoded.colorType === 6) {
    assert.ok(alphaContracts[name].transparentPixels > 0);
  }
}
assert.equal(decodedAssets.skybox.colorType, 2);
assert.ok(alphaContracts.cloudsBack.edges.left >= 38);
assert.ok(alphaContracts.cloudsBack.edges.right >= 25);
assert.ok(alphaContracts.cloudsFront.edges.left >= 25);
assert.ok(alphaContracts.cloudsFront.edges.right >= 9);
const distantBounds = getAlphaContract(decodedAssets.shipDistant, 8).edges;
const mainBounds = getAlphaContract(decodedAssets.shipMain, 8).edges;
assert.equal(decodedAssets.shipDistant.colorType, 6);
assert.equal(decodedAssets.shipMain.colorType, 6);
assert.deepEqual(
  distantBounds,
  {left: 799, right: 345, top: 529, bottom: 58}
);
assert.deepEqual(
  mainBounds,
  {left: 635, right: 386, top: 491, bottom: 52}
);
assert.ok(decodedAssets.shipDistant.alpha[650 * 1280 + 867] > 8);
assert.ok(decodedAssets.shipMain.alpha[655 * 1280 + 765] > 8);

function createRecordingContext() {
  const calls = [];
  const target = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); }
  };
  const context = new Proxy(target, {
    set(object, property, value) {
      calls.push(["set", property, value]);
      object[property] = value;
      return true;
    }
  });
  return {context, calls};
}

function loadFixture({failedFile = null, invalidFile = null, opaqueFile = null} = {}) {
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
      if (file === failedFile) {
        this.onerror?.();
        return;
      }
      assert.ok(
        Object.values(assetPaths).includes(value) || value === hazardPath
      );
      const expectedSize = value === hazardPath ? hazardSize : backgroundSize;
      this.complete = true;
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

  const document = {
    createElement(name) {
      assert.equal(name, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(type) {
          assert.equal(type, "2d");
          return {
            clearRect() {},
            drawImage(image) { analyzedImage = image; },
            getImageData() {
              const opaque = path.posix.basename(analyzedImage.src) === opaqueFile;
              return {
                data: new Uint8ClampedArray(opaque
                  ? [0, 0, 0, 255, 0, 0, 0, 255]
                  : [0, 0, 0, 180, 0, 0, 0, 0])
              };
            }
          };
        }
      };
    }
  };
  const platformVisuals = Object.freeze({
    platformMarker: "pirate-harbor-platform-kit"
  });
  const registry = {
    resolve(id) {
      assert.equal(id, "pirateHarbor");
      return registeredVisuals || platformVisuals;
    },
    register(id, visuals) {
      assert.equal(id, "pirateHarbor");
      registeredVisuals = visuals;
      return visuals;
    }
  };
  const visualMath = Object.create(Math);
  visualMath.random = () => {
    throw new Error("Pirate Harbor visuals must not consume Math.random()");
  };
  const context = vm.createContext({
    BIOME_PLATFORM_VISUALS: registry,
    Image: FakeImage,
    document,
    Math: visualMath,
    Promise
  });
  vm.runInContext(`${visualSource}
    globalThis.pirateHarborVisualsForTest = PIRATE_HARBOR_ASSET_VISUALS;
  `, context, {filename: "pirate-harbor-background-fixture.js"});
  return {
    api: context.pirateHarborVisualsForTest,
    loadedPaths,
    platformVisuals,
    recording,
    getRegisteredVisuals: () => registeredVisuals
  };
}

function captureBackground(fixture, time, width = 1280, height = 720) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBackground(
    fixture.recording.context,
    width,
    height,
    time
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

function captureHazard(fixture, rect) {
  fixture.recording.calls.length = 0;
  const drawn = fixture.api.drawBottomDeathHazard(
    fixture.recording.context,
    rect
  );
  return {drawn, calls: fixture.recording.calls.map(call => [...call])};
}

const fixture = loadFixture();
assert.equal(fixture.getRegisteredVisuals(), fixture.api);
assert.equal(fixture.api.platformMarker, fixture.platformVisuals.platformMarker);
assert.deepEqual(fixture.loadedPaths, [...Object.values(assetPaths), hazardPath]);
const status = JSON.parse(JSON.stringify(fixture.api.getBackgroundStatus()));
assert.equal(status.ready, true);
assert.deepEqual(status.paths, assetPaths);
assert.deepEqual(status.expectedNativeSize, backgroundSize);
assert.deepEqual(status.renderOrder, [
  "skybox", "cloudsBack", "shipDistant", "ocean", "sun",
  "cloudsFront", "shipMain", "gameplay"
]);
assert.ok(Object.values(status.validNativeSizes).every(Boolean));
assert.ok(Object.values(status.layerReady).every(Boolean));
assert.deepEqual(status.cloudAnimation, {
  back: {
    leftSpeed: 6,
    ySpeed: 0,
    wrapDistance: 1280,
    overlap: 0,
    drawCopies: 2,
    transparentEdges: {left: 38, right: 25}
  },
  front: {
    leftSpeed: 11,
    ySpeed: 0,
    wrapDistance: 1280,
    overlap: 0,
    drawCopies: 2,
    transparentEdges: {left: 25, right: 9}
  },
  direction: "right-to-left",
  wrapMode: "full-width-continuous"
});
assert.equal(status.shipAnimation.deterministic, true);
assert.equal(status.shipAnimation.horizontalTravel, false);
assert.equal(status.shipAnimation.distant.horizontalSpeed, 0);
assert.equal(status.shipAnimation.main.horizontalSpeed, 0);
assert.deepEqual(status.shipAnimation.distant.pivot, {x: 867, y: 650});
assert.deepEqual(status.shipAnimation.main.pivot, {x: 765, y: 655});
assert.deepEqual(
  status.shipAnimation.distant.alphaBounds,
  {x: 799, y: 529, w: 136, h: 133}
);
assert.deepEqual(
  status.shipAnimation.main.alphaBounds,
  {x: 635, y: 491, w: 259, h: 177}
);
assert.equal("scale" in status.shipAnimation.distant, false);
assert.equal("scale" in status.shipAnimation.main, false);
assert.equal("targetCenterX" in status.shipAnimation.distant, false);
assert.equal("targetCenterX" in status.shipAnimation.main, false);
assert.equal("waterlineY" in status.shipAnimation.distant, false);
assert.equal("waterlineY" in status.shipAnimation.main, false);
assert.equal(status.shipAnimation.distant.bobAmplitude, 1.5);
assert.equal(status.shipAnimation.distant.bobPeriod, 7.2);
assert.equal(status.shipAnimation.distant.rockAmplitudeDegrees, 0.15);
assert.equal(status.shipAnimation.main.bobAmplitude, 2.4);
assert.equal(status.shipAnimation.main.bobPeriod, 5.8);
assert.equal(status.shipAnimation.main.rockAmplitudeDegrees, 0.25);

const mapping = fixture.api.getBackgroundMapping(1280, 720);
const backAtOne = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(1, mapping, "back")
));
const backAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(2, mapping, "back")
));
const frontAtOne = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(1, mapping, "front")
));
const frontAtTwo = JSON.parse(JSON.stringify(
  fixture.api.getCloudMapping(2, mapping, "front")
));
assert.equal(backAtTwo.offsetX - backAtOne.offsetX, -6);
assert.equal(frontAtTwo.offsetX - frontAtOne.offsetX, -11);
assert.ok(frontAtOne.leftSpeed > backAtOne.leftSpeed);
for (const clouds of [backAtOne, backAtTwo, frontAtOne, frontAtTwo]) {
  assert.equal(clouds.offsetY, 0);
  assert.equal(clouds.destinations.length, 2);
  assert.equal(clouds.destinations[1].x - clouds.destinations[0].x, 1280);
  assert.ok(clouds.destinations.every(destination => (
    destination.y === 0 && destination.w === 1280 && destination.h === 720
  )));
}
assert.equal(fixture.api.getCloudMapping(1280 / 6, mapping, "back").offsetX, 0);
assert.equal(fixture.api.getCloudMapping(1280 / 11, mapping, "front").offsetX, 0);

for (const layer of ["distant", "main"]) {
  const atOne = JSON.parse(JSON.stringify(
    fixture.api.getShipMapping(1, mapping, layer)
  ));
  const atOneAgain = JSON.parse(JSON.stringify(
    fixture.api.getShipMapping(1, mapping, layer)
  ));
  const atTwo = JSON.parse(JSON.stringify(
    fixture.api.getShipMapping(2, mapping, layer)
  ));
  assert.deepEqual(atOneAgain, atOne);
  assert.equal(atOne.offsetX, 0);
  assert.equal(atTwo.offsetX, 0);
  assert.equal(atOne.horizontalSpeed, 0);
  assert.notEqual(atTwo.offsetY, atOne.offsetY);
  assert.notEqual(atTwo.rotation, atOne.rotation);
  const contract = status.shipAnimation[layer];
  assert.ok(Math.abs(atOne.offsetY) <= contract.bobAmplitude);
  assert.ok(
    Math.abs(atOne.rotation) <= contract.rockAmplitudeDegrees * Math.PI / 180
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(atOne.destination)),
    {x: 0, y: 0, w: 1280, h: 720}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(atOne.visibleBounds)),
    contract.alphaBounds
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(atOne.localPivot)),
    contract.pivot
  );
  assert.equal("scale" in atOne, false);
  assert.equal("basePosition" in atOne, false);
  assert.equal("basePivot" in atOne, false);
}
const distantShip = fixture.api.getShipMapping(0, mapping, "distant");
const mainShip = fixture.api.getShipMapping(0, mapping, "main");
assert.equal(distantShip.visibleBounds.w, 136);
assert.equal(distantShip.visibleBounds.h, 133);
assert.equal(mainShip.visibleBounds.w, 259);
assert.equal(mainShip.visibleBounds.h, 177);
assert.ok(distantShip.visibleBounds.w < mainShip.visibleBounds.w);
assert.deepEqual(
  JSON.parse(JSON.stringify(distantShip.localPivot)),
  {x: 867, y: 650}
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mainShip.localPivot)),
  {x: 765, y: 655}
);

const atOne = captureBackground(fixture, 1);
const atTwo = captureBackground(fixture, 2);
assert.equal(atOne.drawn, true);
const getDraws = capture => capture.calls.filter(call => call[0] === "drawImage");
const drawsAtOne = getDraws(atOne);
assert.deepEqual(drawsAtOne.map(call => call[1].src), [
  assetPaths.skybox,
  assetPaths.cloudsBack,
  assetPaths.cloudsBack,
  assetPaths.shipDistant,
  assetPaths.ocean,
  assetPaths.sun,
  assetPaths.cloudsFront,
  assetPaths.cloudsFront,
  assetPaths.shipMain
]);
const staticPaths = new Set([
  assetPaths.skybox,
  assetPaths.ocean,
  assetPaths.sun
]);
assert.deepEqual(
  getDraws(atTwo).filter(call => staticPaths.has(call[1].src)).map(call => call.slice(2)),
  drawsAtOne.filter(call => staticPaths.has(call[1].src)).map(call => call.slice(2))
);
const translationsAtOne = atOne.calls.filter(call => call[0] === "translate");
const translationsAtTwo = atTwo.calls.filter(call => call[0] === "translate");
assert.equal(translationsAtOne[0][1], 867);
assert.equal(translationsAtOne[1][1], 765);
assert.equal(translationsAtTwo[0][1], 867);
assert.equal(translationsAtTwo[1][1], 765);
assert.equal(atOne.calls.filter(call => call[0] === "rotate").length, 2);
const distantDraw = drawsAtOne.find(call => (
  call[1].src === assetPaths.shipDistant
));
const mainDraw = drawsAtOne.find(call => call[1].src === assetPaths.shipMain);
assert.deepEqual(distantDraw.slice(2), [0, 0, 1280, 720, -867, -650, 1280, 720]);
assert.deepEqual(mainDraw.slice(2), [0, 0, 1280, 720, -765, -655, 1280, 720]);

const hazardStatus = JSON.parse(JSON.stringify(fixture.api.getHazardStatus()));
assert.deepEqual(hazardStatus, {
  ready: true,
  path: hazardPath,
  expectedNativeSize: hazardSize,
  validNativeSize: true,
  source: {x: 0, y: 0, w: 1650, h: 60},
  destination: {x: 235, y: 690, w: 825, h: 30},
  layerCount: 1,
  animated: false
});
const hazardRect = Object.freeze({
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
});
assert.deepEqual(
  JSON.parse(JSON.stringify(fixture.api.getBottomHazardMapping(hazardRect))),
  {
    source: {x: 0, y: 0, w: 1650, h: 60},
    destination: {x: 235, y: 690, w: 825, h: 30}
  }
);
const hazardAtOne = captureHazard(fixture, hazardRect);
const hazardAtTwo = captureHazard(fixture, hazardRect);
assert.equal(hazardAtOne.drawn, true);
assert.deepEqual(hazardAtTwo, hazardAtOne);
assert.deepEqual(
  hazardAtOne.calls.filter(call => call[0] === "drawImage").map(call => (
    [call[1].src, ...call.slice(2)]
  )),
  [[hazardPath, 0, 0, 1650, 60, 235, 690, 825, 30]]
);
assert.equal(captureHazard(fixture, {...hazardRect, y: 689}).drawn, false);

for (const relativePath of Object.values(assetPaths)) {
  const unavailable = loadFixture({
    failedFile: path.posix.basename(relativePath)
  });
  assert.equal(unavailable.api.isBackgroundReady(), false);
  assert.equal(captureBackground(unavailable, 1).drawn, false);
}
const opaqueOcean = loadFixture({
  opaqueFile: path.posix.basename(assetPaths.ocean)
});
assert.equal(opaqueOcean.api.isBackgroundReady(), false);
const invalidSun = loadFixture({
  invalidFile: path.posix.basename(assetPaths.sun)
});
assert.equal(invalidSun.api.isBackgroundReady(), false);
const unavailableHazard = loadFixture({
  failedFile: path.posix.basename(hazardPath)
});
assert.equal(unavailableHazard.api.isBackgroundReady(), true);
assert.equal(unavailableHazard.api.isHazardReady(), false);
assert.equal(captureBackground(unavailableHazard, 1).drawn, true);
assert.equal(captureHazard(unavailableHazard, hazardRect).drawn, false);
const invalidHazard = loadFixture({
  invalidFile: path.posix.basename(hazardPath)
});
assert.equal(invalidHazard.api.isBackgroundReady(), true);
assert.equal(invalidHazard.api.isHazardReady(), false);
assert.equal(captureHazard(invalidHazard, hazardRect).drawn, false);

const scriptIndex = indexSource.indexOf("./js/visual-pirate-harbor-assets.js");
assert.ok(scriptIndex >= 0);
assert.ok(scriptIndex < indexSource.indexOf("./js/renderer.js"));
assert.match(
  rendererSource,
  /biomePlatformVisuals\.drawBackground\(ctx, W, H, worldTime\)[\s\S]*?if \(!assetBackgroundDrawn\) \{[\s\S]*?drawBackground\(biome\)/
);
assert.match(biomeSource, /pirateHarbor: drawPirateHarborBackground/);
assert.match(visualSource, /BIOME_PLATFORM_VISUALS\.register\("pirateHarbor"/);
assert.doesNotMatch(visualSource, /pirateHarbor_background_front\.png/);
assert.doesNotMatch(visualSource, /Math\.random\(/);
assert.doesNotMatch(visualSource, /0\.185/);
assert.doesNotMatch(visualSource, /294\.385|395\.7675|370\.3|365\.5/);
assert.match(
  hazardsSource,
  /biomeVisuals\.drawBottomDeathHazard\(ctx, rect, worldTime\)/
);
assert.match(hazardsSource, /if \(!assetHazardDrawn\) renderer\(rect, biome\.hazard\)/);
assert.match(
  levelGeneratorSource,
  /spikes\.push\(\{x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true\}\)/
);

console.log(
  "Pirate Harbor background, anchored ships and static saber hazard tests passed."
);
