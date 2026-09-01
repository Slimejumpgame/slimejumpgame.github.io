"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {execFileSync} = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8")
  .replace(/\r\n/g, "\n");
const tutorialsSource = read("js/tutorials.js");
const headTutorialsSource = execFileSync(
  "git",
  ["show", "HEAD:js/tutorials.js"],
  {cwd: root, encoding: "utf8"}
).replace(/\r\n/g, "\n");

function extractBalancedFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] !== "}") continue;
    depth--;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated ${signature}`);
}

assert.equal(
  extractBalancedFunction(tutorialsSource, "  function createTutorialLevel(stageIndex)"),
  extractBalancedFunction(headTutorialsSource, "  function createTutorialLevel(stageIndex)"),
  "fixed onboarding tutorial definitions must remain byte-for-byte unchanged"
);

const currentLevelOneStart = tutorialsSource.indexOf("    // Level 1:");
const currentLevelOneEnd = tutorialsSource.indexOf("    const tutorials =", currentLevelOneStart);
const headLevelOneStart = headTutorialsSource.indexOf("    // Level 1:");
const headLevelOneEnd = headTutorialsSource.indexOf("    const tutorials =", headLevelOneStart);
assert.equal(
  tutorialsSource.slice(currentLevelOneStart, currentLevelOneEnd),
  headTutorialsSource.slice(headLevelOneStart, headLevelOneEnd),
  "the unreachable Level-1 sketch branch must remain unchanged"
);

const previewStart = tutorialsSource.indexOf("  function isTutorialPreviewImageReady(");
const previewEnd = tutorialsSource.indexOf("\n  function roundedRectOn(", previewStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart);
const previewSource = tutorialsSource.slice(previewStart, previewEnd);

const currentLegacyStart = tutorialsSource.indexOf(
  '    if (tutorial.type === "pad")',
  tutorialsSource.indexOf("  function drawTutorialSketch()")
);
const currentLegacyEnd = tutorialsSource.indexOf("\n\n    ctx.restore();\n  }", currentLegacyStart);
const currentLegacySource = tutorialsSource.slice(currentLegacyStart, currentLegacyEnd);
for (const legacyStyleToken of [
  "#47cde9",
  "#815142",
  "#d9bcff",
  "#5e7592",
  "#4a4f5b",
  "#584f87",
  "#75bad1",
  "#5b4e58",
  "#ff9a5c"
]) {
  assert.ok(
    currentLegacySource.includes(legacyStyleToken),
    `Legacy preview style token ${legacyStyleToken} must remain in use`
  );
}
assert.doesNotMatch(
  currentLegacySource,
  /drawFairyTaleTutorialPreview|drawAtomicFairyTaleTutorialPreview/,
  "Legacy preview branches must remain procedurally independent"
);

assert.match(previewSource, /isFairyTaleGraphicsMode\(\)/);
assert.match(previewSource, /getBiomeForLevel\(levelNumber\)/);
assert.doesNotMatch(previewSource, /levelNumber\s*===\s*(?:2|4|6|8|10|12|14|16|18)/);
assert.match(
  previewSource,
  /const x = 24;\s*const y = 58;\s*const w = 390;\s*const h = 126;/,
  "the approved popup position and 390x126 geometry must remain unchanged"
);
assert.doesNotMatch(
  previewSource,
  /\.clip\s*\(/,
  "popup previews must fit by layout rather than clipping"
);
assert.match(
  tutorialsSource,
  /line1: "Die Animation zeigt dir die Richtung an\."/,
  "Conveyor must use the animation-based direction sentence"
);
assert.doesNotMatch(
  tutorialsSource,
  /Die Pfeile zeigen, wohin|das Band den Slime schiebt/,
  "the old arrow-based Conveyor explanation must be removed"
);

const mode = {value: "fairyTale"};
const readiness = {
  normalPlatform: true,
  falling: true,
  conveyor: true,
  ice: true,
  spike: true
};
let spikeDrawSuccess = true;
let bufferCreates = 0;
const calls = [];
const roundedRects = [];
const canvasEvents = [];
const contextState = {
  globalAlpha: 1,
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  lineCap: "butt",
  shadowColor: "",
  shadowBlur: 0,
  font: "",
  textAlign: "left",
  imageSmoothingEnabled: false,
  imageSmoothingQuality: "low"
};
const contextStack = [];
const transformState = {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0};
let activePath = [];

function mockTextMetrics(text, font = contextState.font) {
  const fontSize = Number(/([\d.]+)px/.exec(font)?.[1] ?? 15);
  return {
    width: Array.from(text).length * fontSize * 0.47,
    actualBoundingBoxAscent: fontSize * 0.75,
    actualBoundingBoxDescent: fontSize * 0.2
  };
}

function recordPath(type) {
  canvasEvents.push({
    type,
    points: activePath.map(point => ({...point})),
    fillStyle: contextState.fillStyle,
    strokeStyle: contextState.strokeStyle,
    lineWidth: contextState.lineWidth,
    shadowBlur: contextState.shadowBlur
  });
}

const ctx = {
  save() {
    contextStack.push({
      styles: {...contextState},
      transform: {...transformState}
    });
    canvasEvents.push({type: "save"});
  },
  restore() {
    const saved = contextStack.pop();
    if (saved) {
      Object.assign(contextState, saved.styles);
      Object.assign(transformState, saved.transform);
    }
    canvasEvents.push({type: "restore"});
  },
  beginPath() { activePath = []; },
  closePath() {},
  moveTo(x, y) { activePath.push({x, y}); },
  lineTo(x, y) { activePath.push({x, y}); },
  quadraticCurveTo(controlX, controlY, x, y) {
    activePath.push({x: controlX, y: controlY}, {x, y});
  },
  arc(x, y, radius) {
    activePath.push(
      {x: x - radius, y},
      {x: x + radius, y},
      {x, y: y - radius},
      {x, y: y + radius}
    );
  },
  stroke() { recordPath("strokePath"); },
  fill() { recordPath("fillPath"); },
  setLineDash(value) { canvasEvents.push({type: "lineDash", value: [...value]}); },
  translate(x, y) {
    transformState.translateX += x * transformState.scaleX;
    transformState.translateY += y * transformState.scaleY;
    canvasEvents.push({type: "translate", x, y});
  },
  scale(x, y) {
    transformState.scaleX *= x;
    transformState.scaleY *= y;
    canvasEvents.push({type: "scale", x, y});
  },
  clearRect(x, y, w, h) { canvasEvents.push({type: "clearRect", x, y, w, h}); },
  drawImage(image, ...args) {
    const destinationArgs = args.length === 4
      ? args
      : args.length === 8
        ? args.slice(4)
        : null;
    const destination = destinationArgs ? {
      x: transformState.translateX + destinationArgs[0] * transformState.scaleX,
      y: transformState.translateY + destinationArgs[1] * transformState.scaleY,
      w: Math.abs(destinationArgs[2] * transformState.scaleX),
      h: Math.abs(destinationArgs[3] * transformState.scaleY)
    } : null;
    canvasEvents.push({
      type: "drawImage",
      image: image.assetPath,
      args,
      destination,
      shadowBlur: contextState.shadowBlur
    });
  },
  fillText(text, x, y) {
    canvasEvents.push({
      type: "fillText",
      text,
      x,
      y,
      font: contextState.font,
      textAlign: contextState.textAlign
    });
  },
  measureText(text) { return mockTextMetrics(text); }
};
for (const property of Object.keys(contextState)) {
  Object.defineProperty(ctx, property, {
    get: () => contextState[property],
    set: value => { contextState[property] = value; },
    enumerable: true
  });
}

function readyImage(assetPath, width, height) {
  return {assetPath, complete: true, naturalWidth: width, naturalHeight: height};
}

const bouncePadImage = readyImage("assets/gameplay/bounce_pad.png", 256, 128);
const ghostImages = {
  normal: readyImage("assets/enemies/ghost_normal.png", 256, 256),
  fast: readyImage("assets/enemies/ghost_fast.png", 256, 256)
};
const GHOST_VISUALS = {
  normal: {glow: "#b46cff"},
  fast: {glow: "#ff552f"}
};

function createBiomeVisuals(biomeId) {
  const platformKit = {
    isWholeFamilyBReady: () => readiness.normalPlatform
  };
  return {
    getPlatformKit: () => platformKit,
    drawPlatformBase(canvasContext, platform, drawX, levelSeed) {
      calls.push({kind: "normalPlatform", biomeId, platform: {...platform}, drawX, levelSeed});
      return readiness.normalPlatform;
    }
  };
}

const biomeVisuals = {
  meadow: createBiomeVisuals("meadow"),
  coast: createBiomeVisuals("coast")
};

const fixture = vm.createContext({
  console,
  Math,
  Number,
  Object,
  ctx,
  state: "playing",
  shots: 0,
  levelIndex: 1,
  isTutorialStage: () => false,
  currentLevel: () => ({seed: 700}),
  roundedRect: (...args) => {
    const record = [...args];
    record.shadowBlur = contextState.shadowBlur;
    record.lineWidth = contextState.lineWidth;
    roundedRects.push(record);
  },
  document: {
    createElement(name) {
      assert.equal(name, "canvas");
      bufferCreates++;
      return {
        assetPath: "tutorial-preview-buffer",
        width: 0,
        height: 0,
        getContext(type) {
          assert.equal(type, "2d");
          return ctx;
        }
      };
    }
  },
  isFairyTaleGraphicsMode: () => mode.value === "fairyTale",
  getBiomeForLevel(levelNumber) {
    const biomeId = levelNumber <= 10 ? "meadow" : "coast";
    calls.push({kind: "biome", levelNumber, biomeId});
    return {id: biomeId};
  },
  BIOME_PLATFORM_VISUALS: {
    resolve(biomeId) {
      calls.push({kind: "resolve", biomeId});
      return biomeVisuals[biomeId];
    }
  },
  bouncePadImage,
  BOUNCE_PAD_SOURCE_BOUNDS: {x: 0, y: 15, w: 256, h: 104},
  GHOST_IMAGE_SOURCE_SIZE: 256,
  GHOST_VISUALS,
  ghostImages,
  getGhostImageDrawContract: () => ({drawSize: 62, offsetX: 0, offsetY: 0}),
  areFallingPlatformAssetsReady: () => readiness.falling,
  drawFallingPlatformAsset(canvasContext, platform) {
    calls.push({kind: "falling", platform: {...platform}});
    return true;
  },
  areConveyorPlatformAssetsReady: () => readiness.conveyor,
  drawConveyorPlatformAsset(canvasContext, platform) {
    calls.push({kind: "conveyor", platform: {...platform}});
    return true;
  },
  drawConveyorPlatformBeltOverlay(canvasContext, platform) {
    calls.push({kind: "conveyorOverlay", platform: {...platform}});
    return true;
  },
  areIcePlatformAssetsReady: () => readiness.ice,
  drawIcePlatformAsset(canvasContext, platform) {
    calls.push({kind: "ice", platform: {...platform}});
    return true;
  },
  isSpikePlatformAssetReady: () => readiness.spike,
  drawSpikePlatformAsset(canvasContext, platform, drawX, count, step) {
    calls.push({kind: "spike", platform: {...platform}, drawX, count, step});
    return spikeDrawSuccess;
  }
});

vm.runInContext(`${previewSource}
  globalThis.mechanicPreviewTestApi = {
    drawTutorialSketch,
    drawWrappedTutorialText,
    getTutorialPopupLayout,
    wrapTutorialText
  };
`, fixture, {filename: "tutorial-mechanic-preview-fixture.js"});

function resetRecords() {
  calls.length = 0;
  roundedRects.length = 0;
  canvasEvents.length = 0;
  contextStack.length = 0;
  activePath = [];
  Object.assign(transformState, {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0
  });
  Object.assign(contextState, {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    shadowColor: "",
    shadowBlur: 0,
    font: "",
    textAlign: "left",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low"
  });
}

function drawLevel(levelNumber) {
  resetRecords();
  fixture.levelIndex = levelNumber - 1;
  fixture.mechanicPreviewTestApi.drawTutorialSketch();
}

function callsOf(kind) {
  return calls.filter(call => call.kind === kind);
}

function drawnImages() {
  return canvasEvents
    .filter(event => event.type === "drawImage" && event.image.startsWith("assets/"))
    .map(event => event.image);
}

function bufferCompositeCount() {
  return canvasEvents.filter(event => (
    event.type === "drawImage" && event.image === "tutorial-preview-buffer"
  )).length;
}

function descriptionEvents() {
  return canvasEvents.filter(event => (
    event.type === "fillText" && event.x === 156 && event.y >= 128
  ));
}

function assertRectInside(rect, bounds, label, margin = 0) {
  assert.ok(rect.x - margin >= bounds.left, `${label} must stay inside the left bound`);
  assert.ok(rect.y - margin >= bounds.top, `${label} must stay inside the top bound`);
  assert.ok(
    rect.x + rect.w + margin <= bounds.right,
    `${label} must stay inside the right bound`
  );
  assert.ok(
    rect.y + rect.h + margin <= bounds.bottom,
    `${label} must stay inside the bottom bound`
  );
}

function textEventRect(event) {
  const metrics = mockTextMetrics(event.text, event.font);
  const left = event.textAlign === "center"
    ? event.x - metrics.width / 2
    : event.textAlign === "right"
      ? event.x - metrics.width
      : event.x;
  return {
    x: left,
    y: event.y - metrics.actualBoundingBoxAscent,
    w: metrics.width,
    h: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  };
}

function assertPathInside(event, bounds, label) {
  const margin = event.shadowBlur + (event.type === "strokePath" ? event.lineWidth / 2 : 0);
  for (const point of event.points) {
    assertRectInside({x: point.x, y: point.y, w: 0, h: 0}, bounds, label, margin);
  }
}

const popupLayout = fixture.mechanicPreviewTestApi.getTutorialPopupLayout(24, 58, 390, 126);
const contentBounds = popupLayout.contentBounds;
const illustrationBounds = popupLayout.illustrationBounds;

assert.deepEqual(
  [contentBounds.left, contentBounds.top, contentBounds.right, contentBounds.bottom],
  [31, 65, 407, 177],
  "the shared content rect must stay seven pixels inside the popup geometry"
);
assert.deepEqual(
  [illustrationBounds.left, illustrationBounds.top, illustrationBounds.right,
    illustrationBounds.bottom],
  [31, 92, 151, 177],
  "the illustration rect must reserve the title and description zones"
);

function assertMechanicPreviewInside(levelNumber, graphicsMode) {
  mode.value = graphicsMode;
  drawLevel(levelNumber);
  const prefix = `${graphicsMode} Level ${levelNumber}`;

  for (const event of canvasEvents.filter(event => event.type === "fillText")) {
    const bounds = event.x === popupLayout.iconX ? illustrationBounds : contentBounds;
    assertRectInside(textEventRect(event), bounds, `${prefix} text ${event.text}`);
  }

  for (const event of canvasEvents.filter(event => (
    (event.type === "strokePath" || event.type === "fillPath") &&
    event.points.length > 0
  ))) {
    assertPathInside(event, illustrationBounds, `${prefix} path`);
  }

  for (const rect of roundedRects.filter(rect => rect[2] <= 120)) {
    assertRectInside(
      {x: rect[0], y: rect[1], w: rect[2], h: rect[3]},
      illustrationBounds,
      `${prefix} Legacy platform shape`,
      rect.shadowBlur
    );
  }

  for (const event of canvasEvents.filter(event => (
    event.type === "drawImage" &&
    event.image?.startsWith("assets/") &&
    event.destination
  ))) {
    assertRectInside(
      event.destination,
      illustrationBounds,
      `${prefix} ${event.image}`,
      event.shadowBlur
    );
  }

  for (const call of calls.filter(call => call.platform)) {
    assertRectInside(
      call.platform,
      illustrationBounds,
      `${prefix} ${call.kind} platform contract`
    );
  }
}

for (const graphicsMode of ["legacy", "fairyTale"]) {
  for (const levelNumber of [2, 4, 6, 8, 10, 12, 14, 16, 18]) {
    assertMechanicPreviewInside(levelNumber, graphicsMode);
  }
}

for (const graphicsMode of ["legacy", "fairyTale"]) {
  for (const [levelNumber, color, cueName] of [
    [2, "#79ff8d", "Pad upward cue"],
    [4, "#ffad70", "Falling downward cue"],
    [8, "#a7d2ff", "Moving direction cues"],
    [16, "#9feeff", "Ice sliding cue"]
  ]) {
    mode.value = graphicsMode;
    drawLevel(levelNumber);
    const cuePaths = canvasEvents.filter(event => (
      (event.type === "strokePath" && event.strokeStyle === color) ||
      (event.type === "fillPath" && event.fillStyle === color)
    ));
    assert.ok(cuePaths.length >= 2, `${graphicsMode} ${cueName} must remain visible`);
    for (const event of cuePaths) {
      assertPathInside(event, illustrationBounds, `${graphicsMode} ${cueName}`);
    }
  }

  mode.value = graphicsMode;
  drawLevel(12);
  const speedLine = canvasEvents.find(event => (
    event.type === "strokePath" && event.strokeStyle === "#ffad45"
  ));
  assert.ok(speedLine, `${graphicsMode} Fast Ghost speed lines must remain visible`);
  assertPathInside(speedLine, illustrationBounds, `${graphicsMode} Fast Ghost speed lines`);

  for (const [levelNumber, label] of [
    [14, "100% → 30% → 0%"],
    [18, "WARNUNG → STACHELN"]
  ]) {
    mode.value = graphicsMode;
    drawLevel(levelNumber);
    const labelEvent = canvasEvents.find(event => (
      event.type === "fillText" && event.text === label
    ));
    assert.ok(labelEvent, `${graphicsMode} ${label} cue must remain visible`);
    assertRectInside(
      textEventRect(labelEvent),
      illustrationBounds,
      `${graphicsMode} ${label} cue`
    );
  }
}

for (const graphicsMode of ["legacy", "fairyTale"]) {
  mode.value = graphicsMode;
  drawLevel(8);
  const movingArrows = canvasEvents.filter(event => (
    event.type === "fillPath" &&
    event.fillStyle === "#a7d2ff" &&
    event.points.length === 7
  ));
  assert.equal(
    movingArrows.length,
    4,
    `${graphicsMode} Moving must draw four filled shaft-and-head arrows`
  );
  assert.equal(
    canvasEvents.filter(event => (
      event.type === "strokePath" && event.strokeStyle === "#a7d2ff"
    )).length,
    0,
    `${graphicsMode} Moving arrows must not regress to thin stroked lines`
  );

  const platform = graphicsMode === "fairyTale"
    ? callsOf("normalPlatform")[0].platform
    : (() => {
        const rect = roundedRects.find(rect => rect[0] === 51 && rect[2] === 80 && rect[3] === 26);
        assert.ok(rect, "Legacy Moving must retain its centered procedural platform");
        return {x: rect[0], y: rect[1], w: rect[2], h: rect[3]};
      })();
  const directions = new Set();
  for (const arrow of movingArrows) {
    const tail = {
      x: (arrow.points[0].x + arrow.points[6].x) / 2,
      y: (arrow.points[0].y + arrow.points[6].y) / 2
    };
    const tip = arrow.points[3];
    const headWidth = Math.hypot(
      arrow.points[2].x - arrow.points[4].x,
      arrow.points[2].y - arrow.points[4].y
    );
    const shaftWidth = Math.hypot(
      arrow.points[0].x - arrow.points[6].x,
      arrow.points[0].y - arrow.points[6].y
    );
    assert.ok(
      headWidth >= shaftWidth * 2,
      `${graphicsMode} Moving arrow must have a clearly wider triangular head`
    );

    if (tail.x !== tip.x) {
      const direction = tip.x < tail.x ? "left" : "right";
      directions.add(direction);
      assert.equal(tail.y, tip.y, `${graphicsMode} ${direction} arrow must be horizontal`);
      assert.ok(
        direction === "left"
          ? Math.max(...arrow.points.map(point => point.x)) < platform.x
          : Math.min(...arrow.points.map(point => point.x)) > platform.x + platform.w,
        `${graphicsMode} ${direction} arrow must not cross the platform`
      );
    } else {
      const direction = tip.y < tail.y ? "up" : "down";
      directions.add(direction);
      assert.equal(tail.x, tip.x, `${graphicsMode} ${direction} arrow must be vertical`);
      assert.ok(
        direction === "up"
          ? Math.max(...arrow.points.map(point => point.y)) < platform.y
          : Math.min(...arrow.points.map(point => point.y)) > platform.y + platform.h,
        `${graphicsMode} ${direction} arrow must not cross the platform`
      );
    }
  }
  assert.deepEqual(
    [...directions].sort(),
    ["down", "left", "right", "up"],
    `${graphicsMode} Moving must show one distinct arrow in every direction`
  );
}

mode.value = "fairyTale";
drawLevel(18);
const fairyTaleSpike = callsOf("spike")[0];
const fairyTaleSpikeWidth = 26 * 228 / 299;
const fairyTaleSpikeBaseline = fairyTaleSpike.platform.y + 6;
const fairyTaleSpikeTop = fairyTaleSpikeBaseline - 26;
const fairyTaleSpikeLeft = fairyTaleSpike.drawX + fairyTaleSpike.step / 2 -
  fairyTaleSpikeWidth / 2;
const fairyTaleSpikeRight = fairyTaleSpike.drawX +
  (fairyTaleSpike.count - 0.5) * fairyTaleSpike.step + fairyTaleSpikeWidth / 2;
assertRectInside(
  {
    x: fairyTaleSpikeLeft,
    y: fairyTaleSpikeTop,
    w: fairyTaleSpikeRight - fairyTaleSpikeLeft,
    h: 26
  },
  illustrationBounds,
  "Fairy Tale Spike PNG composition"
);
assert.ok(
  fairyTaleSpikeTop < fairyTaleSpike.platform.y,
  "Fairy Tale Spike PNG tips must still project above the Coast platform"
);

mode.value = "legacy";
drawLevel(18);
const legacySpikePlatform = roundedRects.find(rect => rect[0] === 42 && rect[2] === 98);
const legacySpikeTips = canvasEvents
  .filter(event => event.type === "fillPath" && event.fillStyle === "#dce8ed")
  .flatMap(event => event.points.map(point => point.y));
assert.ok(legacySpikePlatform, "Legacy Spike platform must remain visible");
assert.ok(
  Math.min(...legacySpikeTips) < legacySpikePlatform[1],
  "Legacy spike tips must still project above their platform"
);

const popupRight = 24 + 390;
const descriptionRightPadding = 16;
const descriptionMaxRight = popupRight - descriptionRightPadding;
const descriptionMaxBottom = 58 + 126 - 12;
const mechanicDescriptions = new Map([
  [2, "Das blaue Feld schleudert dich kräftig nach oben."],
  [4, "Sie wackelt nach der Landung und fällt dann endgültig weg."],
  [6, "Berühre ihn nicht: Kontakt kostet ein Leben."],
  [8, "Sie fährt links, rechts, nach oben oder nach unten."],
  [10, "Die Animation zeigt dir die Richtung an."],
  [12, "Orange-rot und deutlich schneller als der pinke Geist."],
  [14, "Sie verschwindet langsam. Unter 30 % trägt sie dich nicht."],
  [16, "Hier ist kaum Reibung: Du rutschst deutlich weiter."],
  [18, "Orange Warnlicht = gleich gefährlich. Ausgefahrene Stacheln kosten Leben."]
]);

for (const graphicsMode of ["legacy", "fairyTale"]) {
  mode.value = graphicsMode;
  for (const [levelNumber, description] of mechanicDescriptions) {
    drawLevel(levelNumber);
    const events = descriptionEvents();
    assert.equal(
      events.map(event => event.text).join(" "),
      description,
      `Level ${levelNumber} description must remain complete in ${graphicsMode} mode`
    );
    if (levelNumber === 10) {
      assert.ok(
        events.length > 1,
        "the Conveyor description must wrap at the finite width"
      );
    }
    for (const event of events) {
      assert.ok(
        event.x + ctx.measureText(event.text).width <= descriptionMaxRight,
        "description text must preserve the popup's right padding"
      );
      assert.ok(
        event.y + ctx.measureText(event.text).actualBoundingBoxDescent <= descriptionMaxBottom,
        "description text must preserve the popup's bottom padding"
      );
    }
  }
}

const wrappedLongToken = fixture.mechanicPreviewTestApi.wrapTutorialText(
  ctx,
  "Richtungsanimationsgeschwindigkeitsanzeige",
  60
);
assert.ok(wrappedLongToken.length > 1, "an unexpectedly long token must be split safely");
assert.ok(
  wrappedLongToken.every(line => ctx.measureText(line).width <= 60),
  "long-token pieces must stay within the finite maximum width"
);

resetRecords();
const guardedLayout = fixture.mechanicPreviewTestApi.drawWrappedTutorialText(
  ctx,
  "Viele kurze Wörter prüfen die untere Begrenzung des Textbereichs zuverlässig.",
  {
    x: 156,
    firstBaseline: 128,
    maxWidth: 60,
    lineHeight: 20,
    maxBottom: descriptionMaxBottom
  }
);
assert.equal(guardedLayout.truncated, true, "overflowing lines must hit the bottom safeguard");
assert.ok(
  descriptionEvents().every(event => (
    event.y + ctx.measureText(event.text).actualBoundingBoxDescent <= descriptionMaxBottom
  )),
  "the bottom safeguard must never draw a line below the padded boundary"
);

mode.value = "legacy";
drawLevel(8);
assert.equal(calls.length, 0, "Legacy must not resolve or draw Fairy Tale previews");
assert.ok(
  roundedRects.some(args => args[0] === 51 && args[2] === 80),
  "Legacy Moving procedural platform must remain available"
);

mode.value = "fairyTale";
drawLevel(2);
assert.deepEqual(callsOf("biome").map(call => call.biomeId), ["meadow"]);
assert.equal(callsOf("normalPlatform")[0].biomeId, "meadow");
assert.ok(drawnImages().includes("assets/gameplay/bounce_pad.png"));

drawLevel(4);
assert.equal(callsOf("falling").length, 1);

drawLevel(6);
assert.deepEqual(drawnImages(), ["assets/enemies/ghost_normal.png"]);

drawLevel(8);
assert.deepEqual(callsOf("biome").map(call => call.biomeId), ["meadow"]);
assert.equal(callsOf("normalPlatform")[0].biomeId, "meadow");
assert.equal(callsOf("normalPlatform")[0].platform.moving, undefined);
assert.equal(callsOf("normalPlatform")[0].platform.fade, undefined);

drawLevel(10);
assert.equal(callsOf("conveyor").length, 1);
assert.equal(callsOf("conveyorOverlay").length, 1);

drawLevel(12);
assert.deepEqual(drawnImages(), ["assets/enemies/ghost_fast.png"]);

drawLevel(14);
assert.deepEqual(callsOf("biome").map(call => call.biomeId), ["coast"]);
assert.equal(callsOf("normalPlatform")[0].biomeId, "coast");
assert.equal(callsOf("normalPlatform")[0].platform.moving, undefined);
assert.equal(callsOf("normalPlatform")[0].platform.fade, undefined);

drawLevel(16);
assert.equal(callsOf("ice").length, 1);

drawLevel(18);
assert.deepEqual(callsOf("biome").map(call => call.biomeId), ["coast"]);
assert.equal(callsOf("normalPlatform")[0].biomeId, "coast");
assert.equal(callsOf("normalPlatform")[0].platform.spikePlatform, undefined);
assert.equal(callsOf("spike").length, 1);
assert.equal(callsOf("spike")[0].platform.spikeData.extension, 1);
assert.equal(callsOf("spike")[0].count, 5);
assert.equal(bufferCompositeCount(), 1);
assert.equal(canvasEvents.some(event => event.type === "clip"), false);

spikeDrawSuccess = false;
drawLevel(18);
assert.equal(callsOf("normalPlatform").length, 1);
assert.equal(callsOf("spike").length, 1);
assert.equal(bufferCompositeCount(), 0);
assert.ok(
  roundedRects.some(args => args[0] === 42 && args[2] === 98),
  "a downstream Spike helper failure must discard every Fairy Tale layer"
);
spikeDrawSuccess = true;

readiness.falling = false;
drawLevel(4);
assert.equal(callsOf("falling").length, 0);
assert.ok(
  roundedRects.some(args => args[0] === 45 && args[2] === 92),
  "unavailable Falling art must atomically fall back to the procedural preview"
);
readiness.falling = true;

bouncePadImage.complete = false;
drawLevel(2);
assert.equal(callsOf("normalPlatform").length, 0);
assert.equal(drawnImages().length, 0);
assert.ok(
  roundedRects.some(args => args[0] === 49 && args[2] === 84),
  "unavailable Pad art must fall back before drawing any Fairy Tale layer"
);
bouncePadImage.complete = true;

mode.value = "legacy";
drawLevel(14);
assert.equal(calls.length, 0, "graphics mode must be read again on every draw");
assert.ok(
  roundedRects.some(args => args[0] === 43 && args[2] === 96),
  "switching back to Legacy must immediately restore its procedural preview"
);
assert.equal(bufferCreates, 1, "the atomic preview buffer must be cached across frames");

console.log("Tutorial mechanic preview graphics-mode tests passed.");
