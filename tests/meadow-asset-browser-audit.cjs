"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/";
const debuggingPort = Number(process.argv[3] || 9222);
const outputDirectory = path.resolve(
  process.argv[4] || path.join(process.cwd(), "meadow-asset-audit")
);
const viewports = [
  {width: 1280, height: 720},
  {width: 720, height: 405}
];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function createTarget() {
  const response = await fetch(
    `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent("about:blank")}`,
    {method: "PUT"}
  );
  assert.equal(response.ok, true, `could not create browser target: ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, {once: true});
    socket.addEventListener("error", reject, {once: true});
  });
  let nextId = 1;
  const pending = new Map();
  const waiters = new Map();
  const observers = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    const eventWaiters = waiters.get(message.method) ?? [];
    waiters.delete(message.method);
    eventWaiters.forEach(resolve => resolve(message.params));
    (observers.get(message.method) ?? []).forEach(observer => observer(message.params));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params}));
  });
  const waitForEvent = (method, timeoutMs = 10000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP event timeout: ${method}`)), timeoutMs);
    const wrapped = params => {
      clearTimeout(timer);
      resolve(params);
    };
    const eventWaiters = waiters.get(method) ?? [];
    eventWaiters.push(wrapped);
    waiters.set(method, eventWaiters);
  });
  const on = (method, observer) => {
    const eventObservers = observers.get(method) ?? [];
    eventObservers.push(observer);
    observers.set(method, eventObservers);
  };
  return {socket, send, waitForEvent, on};
}

async function capture(cdp, filename) {
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true
  });
  fs.writeFileSync(path.join(outputDirectory, filename), Buffer.from(screenshot.data, "base64"));
  return filename;
}

async function auditViewport(cdp, viewport) {
  const {send, waitForEvent} = cdp;
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false
  });
  const loaded = waitForEvent("Page.loadEventFired");
  await send("Page.navigate", {
    url: `${baseUrl}?meadow-asset-audit=${viewport.width}-${Date.now()}`
  });
  await loaded;
  await delay(450);
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  if (await evaluate(`sessionStorage.getItem("slimejumperLocalDevMode") !== "off"`)) {
    await evaluate(`sessionStorage.setItem("slimejumperLocalDevMode", "off")`);
    const reloaded = waitForEvent("Page.loadEventFired");
    await send("Page.reload", {ignoreCache: true});
    await reloaded;
    await delay(450);
  }

  const startup = await evaluate(`(async () => {
    const loaded = await MEADOW_ASSET_VISUALS.whenReady();
    return {
      loaded,
      status: MEADOW_ASSET_VISUALS.getStatus(),
      state,
      menuGuard: Boolean(getActiveBiomePlatformVisuals(getBiomeForLevel(1))),
      menuVisible: !ui.menu.classList.contains("hidden")
    };
  })()`);
  assert.equal(startup.loaded, true);
  assert.equal(startup.status.ready, true);
  for (const assetName of ["meadow_top_base", "meadow_body_base"]) {
    assert.equal(startup.status.loaded[assetName], true);
    assert.equal(
      startup.status.paths[assetName],
      `assets/environments/meadow/platforms/${assetName}.png`
    );
  }
  for (let index = 1; index <= 6; index++) {
    const assetName = `meadow_overlay_top_0${index}`;
    assert.equal(startup.status.loaded[assetName], true);
    assert.equal(
      startup.status.paths[assetName],
      `assets/environments/meadow/platforms/${assetName}.png`
    );
  }
  for (let index = 1; index <= 3; index++) {
    const assetName = `meadow_overlay_body_0${index}`;
    assert.equal(startup.status.loaded[assetName], true);
    assert.equal(
      startup.status.paths[assetName],
      `assets/environments/meadow/platforms/${assetName}.png`
    );
  }
  assert.equal(startup.state, "menu");
  assert.equal(startup.menuGuard, false);
  assert.equal(startup.menuVisible, true);

  let menuScreenshot = null;
  if (viewport.width === 1280) {
    menuScreenshot = await capture(cdp, "1280x720-main-menu-control.png");
  }

  const gameplay = await evaluate(`(() => {
    enterRunStage();
    state = "playing";
    levelIndex = 0;
    const levelCandidates = Array.from({length: 512}, () => generateProceduralLevel(1));
    globalThis.meadowV1AuditCandidates = levelCandidates;
    const floatingCandidates = levelCandidates.flatMap((level, levelIndex) =>
      level.platforms
        .filter(platform => platform.h === 26)
        .map((platform, floatingIndex) => ({levelIndex, floatingIndex, width: platform.w}))
    );
    const usedLevelIndexes = new Set();
    globalThis.meadowV1AlignmentCandidates = [
      {label: "minimum", targetWidth: 118},
      {label: "middle", targetWidth: 127},
      {label: "maximum", targetWidth: 135.999}
    ].map(target => {
      const selected = floatingCandidates
        .filter(candidate => !usedLevelIndexes.has(candidate.levelIndex))
        .reduce((nearest, candidate) =>
          Math.abs(candidate.width - target.targetWidth) <
          Math.abs(nearest.width - target.targetWidth) ? candidate : nearest
        );
      usedLevelIndexes.add(selected.levelIndex);
      return {...target, ...selected, level: levelCandidates[selected.levelIndex]};
    });
    generatedLevel = levelCandidates.reduce((highestGoalBlock, candidate) => {
      const blockHeight = candidate.platforms.find(platform => platform.x === 1060)?.h ?? 0;
      const highestBlockHeight = highestGoalBlock.platforms.find(
        platform => platform.x === 1060
      )?.h ?? 0;
      return blockHeight > highestBlockHeight ? candidate : highestGoalBlock;
    });
    ui.menu.classList.add("hidden");
    ui.message.classList.add("hidden");
    resetLevel(true);
    const standingPlatform = generatedLevel.platforms.find(platform => platform.x === 0);
    player.x = generatedLevel.spawn.x;
    player.y = standingPlatform.y - player.r;
    player.vx = 0;
    player.vy = 0;
    aiming = true;
    drag.x = -118;
    drag.y = 72;

    const snapshot = () => JSON.stringify({
      platforms: generatedLevel.platforms,
      goal: generatedLevel.goal,
      stars: generatedLevel.stars,
      hazards: {
        spikes: generatedLevel.spikes,
        spikePlatforms: generatedLevel.spikePlatforms
      },
      enemies: generatedLevel.enemies
    });
    const before = snapshot();
    for (let frameIndex = 0; frameIndex < 12; frameIndex++) draw();
    const after = snapshot();
    state = "gamePaused";
    aiming = true;
    draw();
    const scene = MEADOW_ASSET_VISUALS.getScene(generatedLevel);
    const goalPlatform = generatedLevel.platforms.find(platform => platform.x === 1060);
    const startPlatform = generatedLevel.platforms.find(platform => platform.x === 0);
    const inspectMassiveBlock = platform => {
      const width = Math.round(platform.w);
      const height = Math.round(platform.h);
      const surface = document.createElement("canvas");
      surface.width = width;
      surface.height = height;
      const surfaceContext = surface.getContext("2d", {willReadFrequently: true});
      const drawCalls = [];
      const drawImage = surfaceContext.drawImage.bind(surfaceContext);
      surfaceContext.drawImage = (...args) => {
        if (args.length === 9) {
          drawCalls.push({
            asset: args[0].getAttribute?.("src") ?? args[0].src,
            source: {x: args[1], y: args[2], w: args[3], h: args[4]},
            destination: {x: args[5], y: args[6], w: args[7], h: args[8]}
          });
        } else if (args.length === 5) {
          drawCalls.push({
            asset: args[0].getAttribute?.("src") ?? args[0].src,
            source: null,
            destination: {x: args[1], y: args[2], w: args[3], h: args[4]}
          });
        }
        return drawImage(...args);
      };
      MEADOW_ASSET_VISUALS.drawPlatformBase(
        surfaceContext, {...platform, y: 0}, 0, generatedLevel.seed
      );
      const pixels = surfaceContext.getImageData(0, 0, width, height).data;
      let interiorPixels = 0;
      let coveredInteriorPixels = 0;
      let opaqueInteriorPixels = 0;
      let brownFallbackPixels = 0;
      let blackPixels = 0;
      let topGreenPixels = 0;
      let topPixels = 0;
      const marginX = Math.max(10, Math.ceil(width * 0.08));
      const marginY = Math.max(10, Math.ceil(height * 0.08));
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const alpha = pixels[index + 3];
        const pixelNumber = index / 4;
        const x = pixelNumber % width;
        const y = Math.floor(pixelNumber / width);
        if (
          x >= marginX && x < width - marginX &&
          y >= marginY && y < height - marginY
        ) {
          interiorPixels += 1;
          if (alpha >= 16) coveredInteriorPixels += 1;
          if (alpha >= 240) opaqueInteriorPixels += 1;
          if (red === 101 && green === 67 && blue === 45) brownFallbackPixels += 1;
          if (alpha >= 240 && red < 8 && green < 8 && blue < 8) blackPixels += 1;
        }
        if (y < Math.min(20, height) && x >= 10 && x < width - 10) {
          topPixels += 1;
          if (green > 70 && green > red * 1.08 && green > blue * 1.20) {
            topGreenPixels += 1;
          }
        }
      }
      return {
        width,
        height,
        platformHeight: platform.h,
        coverageRatio: coveredInteriorPixels / interiorPixels,
        opaqueRatio: opaqueInteriorPixels / interiorPixels,
        brownFallbackPixels,
        blackPixels,
        topGreenRatio: topGreenPixels / topPixels,
        drawCalls
      };
    };
    const canvasRect = canvas.getBoundingClientRect();
    return {
      active: Boolean(getActiveBiomePlatformVisuals(getBiomeForLevel(1))),
      assets: MEADOW_ASSET_VISUALS.getStatus(),
      topOverlaySelection: MEADOW_ASSET_VISUALS.getTopOverlaySelection(generatedLevel.seed),
      bodyOverlaySelection: MEADOW_ASSET_VISUALS.getBodyOverlaySelection(
        generatedLevel.seed
      ),
      geometryUnchanged: before === after,
      massiveBlocks: {
        start: inspectMassiveBlock(startPlatform),
        goal: inspectMassiveBlock(goalPlatform)
      },
      standingAlignment: {
        feetY: player.y + player.r,
        platformY: standingPlatform.y,
        delta: player.y + player.r - standingPlatform.y
      },
      canvas: {
        internalWidth: canvas.width,
        internalHeight: canvas.height,
        displayWidth: canvasRect.width,
        displayHeight: canvasRect.height
      },
      overflow: {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        bodyWidth: document.body.scrollWidth
      },
      level: {
        seed: generatedLevel.seed,
        platforms: generatedLevel.platforms.length,
        stars: generatedLevel.stars.length,
        spikes: generatedLevel.spikes.map(item => ({...item})),
        enemies: generatedLevel.enemies.length,
        goal: {...generatedLevel.goal}
      }
    };
  })()`);
  assert.equal(gameplay.active, true);
  assert.equal(gameplay.assets.ready, true);
  assert.equal(gameplay.geometryUnchanged, true);
  assert.deepEqual(gameplay.standingAlignment, {
    feetY: 640,
    platformY: 640,
    delta: 0
  });
  assert.notEqual(
    gameplay.topOverlaySelection.startIndex,
    gameplay.topOverlaySelection.goalIndex
  );
  assert.ok(
    gameplay.massiveBlocks.start.coverageRatio > 0.95,
    `start sprite interior coverage: ${gameplay.massiveBlocks.start.coverageRatio}`
  );
  assert.ok(
    gameplay.massiveBlocks.goal.coverageRatio > 0.95,
    `goal sprite interior coverage: ${gameplay.massiveBlocks.goal.coverageRatio}`
  );
  assert.equal(gameplay.massiveBlocks.start.brownFallbackPixels, 0);
  assert.equal(gameplay.massiveBlocks.goal.brownFallbackPixels, 0);
  assert.equal(gameplay.massiveBlocks.start.blackPixels, 0);
  assert.equal(gameplay.massiveBlocks.goal.blackPixels, 0);
  assert.ok(gameplay.massiveBlocks.goal.height >= 500);
  const startTopHeight = 235 * (128 / 352);
  assert.equal(gameplay.massiveBlocks.start.drawCalls.length, 2);
  assert.deepEqual(
    gameplay.massiveBlocks.start.drawCalls,
    [
      {
        asset: "assets/environments/meadow/platforms/meadow_top_base.png",
        source: {x: 0, y: 0, w: 352, h: 128},
        destination: {x: 0, y: 0, w: 235, h: startTopHeight}
      },
      {
        asset: `assets/environments/meadow/platforms/${gameplay.topOverlaySelection.startAsset}.png`,
        source: {x: 0, y: 0, w: 352, h: 128},
        destination: {x: 0, y: 0, w: 235, h: startTopHeight}
      }
    ]
  );
  const goalDrawCalls = gameplay.massiveBlocks.goal.drawCalls;
  assert.ok(goalDrawCalls.length >= 4);
  assert.deepEqual(goalDrawCalls.slice(0, 2), [
    {
      asset: "assets/environments/meadow/platforms/meadow_top_base.png",
      source: {x: 0, y: 0, w: 352, h: 128},
      destination: {x: 0, y: 0, w: 220, h: 80}
    },
    {
      asset: `assets/environments/meadow/platforms/${gameplay.topOverlaySelection.goalAsset}.png`,
      source: {x: 0, y: 0, w: 352, h: 128},
      destination: {x: 0, y: 0, w: 220, h: 80}
    }
  ]);
  const goalBodyOverlay = goalDrawCalls.at(-1);
  assert.deepEqual(goalBodyOverlay, {
    asset: `assets/environments/meadow/platforms/${gameplay.bodyOverlaySelection.goalAsset}.png`,
    source: {x: 0, y: 0, w: 352, h: 128},
    destination: {
      x: 0,
      y: gameplay.massiveBlocks.goal.platformHeight - 80,
      w: 220,
      h: 80
    }
  });
  const goalBaseCalls = goalDrawCalls.slice(2, -1);
  for (const [rowIndex, call] of goalBaseCalls.entries()) {
    assert.equal(
      call.asset,
      "assets/environments/meadow/platforms/meadow_body_base.png"
    );
    assert.equal(call.source.x, 0);
    assert.equal(call.source.y, 0);
    assert.equal(call.source.w, 352);
    assert.equal(call.destination.x, 0);
    assert.equal(call.destination.w, 220);
    assert.equal(call.destination.y, 79 + rowIndex * 79);
    assert.ok(call.destination.h > 0 && call.destination.h <= 80);
    assert.equal(call.source.h, call.destination.h * 128 / 80);
  }
  assert.equal(
    goalBaseCalls.at(-1).destination.y + goalBaseCalls.at(-1).destination.h,
    gameplay.massiveBlocks.goal.platformHeight
  );
  assert.equal(gameplay.canvas.internalWidth, 1280);
  assert.equal(gameplay.canvas.internalHeight, 720);
  assert.ok(gameplay.overflow.documentWidth <= gameplay.overflow.viewportWidth);
  assert.ok(gameplay.overflow.bodyWidth <= gameplay.overflow.viewportWidth);
  assert.deepEqual(gameplay.level.spikes, [
    {x: 235, y: 690, w: 825, h: 30, isBottomDeathHazard: true}
  ]);

  await delay(100);
  const gameplayScreenshot = await capture(
    cdp,
    `${viewport.width}x${viewport.height}-meadow-goal-top-cap-body-tall.png`
  );

  const alphaAlignment = await evaluate(`(async () => {
    const inspectRendered = (name, platform, seed) => {
      const surface = document.createElement("canvas");
      surface.width = platform.w;
      surface.height = platform.h;
      const surfaceContext = surface.getContext("2d", {willReadFrequently: true});
      const drawCalls = [];
      const drawImage = surfaceContext.drawImage.bind(surfaceContext);
      surfaceContext.drawImage = (...args) => {
        if (args.length === 9) {
          drawCalls.push({
            asset: args[0].getAttribute?.("src") ?? args[0].src,
            source: {x: args[1], y: args[2], w: args[3], h: args[4]},
            destination: {x: args[5], y: args[6], w: args[7], h: args[8]}
          });
        } else if (args.length === 5) {
          drawCalls.push({
            asset: args[0].getAttribute?.("src") ?? args[0].src,
            source: null,
            destination: {x: args[1], y: args[2], w: args[3], h: args[4]}
          });
        }
        return drawImage(...args);
      };
      MEADOW_ASSET_VISUALS.drawPlatformBase(
        surfaceContext,
        platform,
        0,
        seed
      );
      const pixels = surfaceContext.getImageData(
        0,
        0,
        surface.width,
        surface.height
      ).data;
      let minX = surface.width;
      let minY = surface.height;
      let maxX = -1;
      let maxY = -1;
      let topTerrainPixels = 0;
      let topGrassPixels = 0;
      let topPixels = 0;
      const topMargin = Math.min(24, Math.floor(surface.width * 0.18));
      const interiorLeft = Math.min(10, Math.floor(surface.width * 0.10));
      const interiorRight = surface.width - interiorLeft;
      const interiorWidth = interiorRight - interiorLeft;
      const coveredInteriorPixelsByRow = Array(surface.height).fill(0);
      let bodyEdgeRows = 0;
      let opaqueLeftBodyEdgeRows = 0;
      let opaqueRightBodyEdgeRows = 0;
      let minimumLeftBodyEdgeAlpha = 255;
      let minimumRightBodyEdgeAlpha = 255;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const alpha = pixels[index + 3];
        const pixelNumber = index / 4;
        const x = pixelNumber % surface.width;
        const y = Math.floor(pixelNumber / surface.width);
        if (y === 0 && x >= topMargin && x < surface.width - topMargin) {
          topPixels += 1;
          if (alpha >= 64) topTerrainPixels += 1;
          if (alpha >= 64 && green > red * 1.05 && green > blue * 1.25) {
            topGrassPixels += 1;
          }
        }
        if (alpha >= 64 && x >= interiorLeft && x < interiorRight) {
          coveredInteriorPixelsByRow[y] += 1;
        }
        if (name.startsWith("goal-") && y >= 80 && y < surface.height - 10) {
          if (x === 0) {
            bodyEdgeRows += 1;
            if (alpha === 255) opaqueLeftBodyEdgeRows += 1;
            minimumLeftBodyEdgeAlpha = Math.min(minimumLeftBodyEdgeAlpha, alpha);
          } else if (x === surface.width - 1) {
            if (alpha === 255) opaqueRightBodyEdgeRows += 1;
            minimumRightBodyEdgeAlpha = Math.min(minimumRightBodyEdgeAlpha, alpha);
          }
        }
        if (alpha < 64) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return {
        name,
        seed,
        topOverlaySelection: MEADOW_ASSET_VISUALS.getTopOverlaySelection(seed),
        bodyOverlaySelection: MEADOW_ASSET_VISUALS.getBodyOverlaySelection(seed),
        destination: {width: surface.width, height: surface.height},
        drawCalls,
        walkableTop: {
          terrainRatio: topTerrainPixels / topPixels,
          grassRatio: topGrassPixels / topPixels
        },
        minimumInteriorRowCoverage: Math.min(
          ...coveredInteriorPixelsByRow.map(covered => covered / interiorWidth)
        ),
        startMaterialSeamDelta: name === "start" ? (() => {
          const averageRow = y => {
            const totals = [0, 0, 0];
            for (let x = interiorLeft; x < interiorRight; x++) {
              const offset = (y * surface.width + x) * 4;
              totals[0] += pixels[offset];
              totals[1] += pixels[offset + 1];
              totals[2] += pixels[offset + 2];
            }
            return totals.map(total => total / interiorWidth);
          };
          const topEdge = averageRow(19);
          const bodyEdge = averageRow(20);
          return Math.max(...topEdge.map((channel, index) =>
            Math.abs(channel - bodyEdge[index])
          ));
        })() : null,
        bodyEdgeOpacity: bodyEdgeRows === 0 ? null : {
          left: opaqueLeftBodyEdgeRows / bodyEdgeRows,
          right: opaqueRightBodyEdgeRows / bodyEdgeRows,
          minimumLeftAlpha: minimumLeftBodyEdgeAlpha,
          minimumRightAlpha: minimumRightBodyEdgeAlpha
        },
        alpha64Padding: {
          left: minX,
          top: minY,
          right: surface.width - 1 - maxX,
          bottom: surface.height - 1 - maxY
        }
      };
    };
    return [
      ...[100, 138, 176].map(width =>
        inspectRendered("floating-" + width, {x: 0, y: 0, w: width, h: 26}, 31)
      ),
      inspectRendered("start", {x: 0, y: 0, w: 235, h: 80}, 31),
      inspectRendered("goal-short", {x: 1060, y: 0, w: 220, h: 150}, 17),
      inspectRendered("goal-medium", {x: 1060, y: 0, w: 220, h: 250}, 19),
      inspectRendered("goal-tall", {x: 1060, y: 0, w: 220, h: 535}, 23)
    ];
  })()`);
  const bodyOverlayAudit = await evaluate(`(() => {
    const seeds = Array.from({length: 3}, (_, goalIndex) => {
      for (let seed = 0; seed < 4096; seed++) {
        if (MEADOW_ASSET_VISUALS.getBodyOverlaySelection(seed).goalIndex === goalIndex) {
          return seed;
        }
      }
      throw new Error("No seed found for Meadow body overlay " + goalIndex);
    });
    return seeds.map((seed, expectedGoalIndex) => {
      const platform = {x: 1060, y: 0, w: 220, h: 250};
      const context = document.createElement("canvas").getContext("2d");
      const drawCalls = [];
      const drawImage = context.drawImage.bind(context);
      context.drawImage = (...args) => {
        drawCalls.push({
          asset: args[0].getAttribute?.("src") ?? args[0].src,
          source: args.length === 9
            ? {x: args[1], y: args[2], w: args[3], h: args[4]}
            : null,
          destination: args.length === 9
            ? {x: args[5], y: args[6], w: args[7], h: args[8]}
            : {x: args[1], y: args[2], w: args[3], h: args[4]}
        });
        return drawImage(...args);
      };
      MEADOW_ASSET_VISUALS.drawPlatformBase(context, platform, 0, seed);
      const selection = MEADOW_ASSET_VISUALS.getBodyOverlaySelection(seed);
      return {
        expectedGoalIndex,
        seed,
        selection,
        overlay: drawCalls.filter(call => call.asset.includes("meadow_overlay_body_")),
        base: drawCalls.filter(call => call.asset.endsWith("meadow_body_base.png"))
      };
    });
  })()`);
  assert.equal(bodyOverlayAudit.length, 3);
  for (const transition of bodyOverlayAudit) {
    assert.equal(transition.selection.goalIndex, transition.expectedGoalIndex);
    assert.equal(
      transition.selection.goalAsset,
      `meadow_overlay_body_0${transition.expectedGoalIndex + 1}`
    );
    assert.equal(transition.overlay.length, 1);
    assert.deepEqual(transition.overlay[0], {
      asset: `assets/environments/meadow/platforms/${transition.selection.goalAsset}.png`,
      source: {x: 0, y: 0, w: 352, h: 128},
      destination: {x: 0, y: 170, w: 220, h: 80}
    });
    assert.deepEqual(transition.base.map(call => call.destination), [
      {x: 0, y: 79, w: 220, h: 80},
      {x: 0, y: 158, w: 220, h: 80},
      {x: 0, y: 237, w: 220, h: 13}
    ]);
    assert.deepEqual(transition.base.map(call => call.source), [
      {x: 0, y: 0, w: 352, h: 128},
      {x: 0, y: 0, w: 352, h: 128},
      {x: 0, y: 0, w: 352, h: 20.8}
    ]);
  }
  const goalBodyDecodeAudit = await evaluate(`(async () => {
    const image = new Image();
    image.src = "assets/environments/meadow/platforms/meadow_body_base.png?decode-audit=" + Date.now();
    await image.decode();
    const surface = document.createElement("canvas");
    surface.width = 220;
    surface.height = 80;
    const context = surface.getContext("2d", {willReadFrequently: true});
    context.drawImage(image, 0, 0, 352, 128, 0, 0, 220, 80);
    const pixels = context.getImageData(0, 0, 220, 80).data;
    let minimumAlpha = 255;
    for (let index = 3; index < pixels.length; index += 4) {
      minimumAlpha = Math.min(minimumAlpha, pixels[index]);
    }
    return {naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, minimumAlpha};
  })()`);
  assert.deepEqual(goalBodyDecodeAudit, {
    naturalWidth: 352,
    naturalHeight: 128,
    minimumAlpha: 255
  });
  const floatingMiddleAsset = "assets/environments/meadow/platforms/floating_middle.png";
  const floatingLeftAsset = "assets/environments/meadow/platforms/floating_left.png";
  const floatingRightAsset = "assets/environments/meadow/platforms/floating_right.png";
  for (const alignment of alphaAlignment) {
    assert.ok(alignment.alpha64Padding.left <= 1, `${alignment.name} left alpha gap`);
    assert.ok(alignment.alpha64Padding.right <= 1, `${alignment.name} right alpha gap`);
    assert.equal(alignment.alpha64Padding.top, 0, `${alignment.name} walkable top offset`);
    assert.ok(alignment.alpha64Padding.bottom <= 1, `${alignment.name} bottom alpha gap`);
    assert.ok(
      alignment.walkableTop.terrainRatio > 0.90,
      `${alignment.name} walkable top terrain ratio: ${alignment.walkableTop.terrainRatio}`
    );
    assert.ok(
      alignment.walkableTop.grassRatio > 0.75,
      `${alignment.name} walkable top grass ratio: ${alignment.walkableTop.grassRatio}`
    );
    if (alignment.name.startsWith("floating-")) {
      assert.equal(alignment.drawCalls.length % 3, 0);
      const segments = Array.from(
        {length: alignment.drawCalls.length / 3},
        (_, index) => alignment.drawCalls.slice(index * 3, index * 3 + 3)
      );
      const middleSegments = segments.slice(0, -2);
      const leftSegment = segments.at(-2);
      const rightSegment = segments.at(-1);
      assert.ok(middleSegments.every(segment => segment.every(call => (
        call.asset === floatingMiddleAsset
      ))));
      assert.ok(leftSegment.every(call => call.asset === floatingLeftAsset));
      assert.ok(rightSegment.every(call => call.asset === floatingRightAsset));
      for (const segment of segments) {
        assert.deepEqual(segment.map(call => [call.source.y, call.source.h]), [
          [24, 10], [34, 51], [85, 18]
        ]);
        assert.deepEqual(segment.map(call => [call.destination.y, call.destination.h]), [
          [-2, 2], [0, 26], [26, 3]
        ]);
      }
      const middle = middleSegments.map(segment => segment[1].destination);
      const left = leftSegment[1].destination;
      const right = rightSegment[1].destination;
      assert.equal(left.x, 0);
      assert.equal(left.y, 0);
      assert.equal(left.w, 26);
      assert.equal(left.h, 26);
      assert.equal(middle[0].x, 25);
      assert.equal(right.x, alignment.destination.width - 26);
      assert.equal(right.w, 26);
      assert.equal(left.x + left.w - middle[0].x, 1);
      assert.equal(middle.at(-1).x + middle.at(-1).w - right.x, 1);
      assert.equal(right.x + right.w, alignment.destination.width);
    } else if (alignment.name === "start") {
      const startTopHeight = 235 * (128 / 352);
      assert.deepEqual(alignment.drawCalls, [
        {
          asset: "assets/environments/meadow/platforms/meadow_top_base.png",
          source: {x: 0, y: 0, w: 352, h: 128},
          destination: {x: 0, y: 0, w: 235, h: startTopHeight}
        },
        {
          asset: `assets/environments/meadow/platforms/${alignment.topOverlaySelection.startAsset}.png`,
          source: {x: 0, y: 0, w: 352, h: 128},
          destination: {x: 0, y: 0, w: 235, h: startTopHeight}
        }
      ]);
      assert.equal(
        alignment.drawCalls[1].destination.w / 352,
        alignment.drawCalls[1].destination.h / 128
      );
      assert.ok(startTopHeight > alignment.destination.height);
      assert.ok(
        alignment.drawCalls.every(call =>
          call.destination.x === 0 && call.destination.w === alignment.destination.width
        )
      );
      assert.ok(alignment.drawCalls.every(call => !call.asset.includes("body")));
      assert.ok(
        alignment.minimumInteriorRowCoverage > 0.99,
        `start horizontal alpha seam: ${alignment.minimumInteriorRowCoverage}`
      );
    } else if (alignment.name.startsWith("goal-")) {
      const [topBase, topOverlay] = alignment.drawCalls;
      const base = alignment.drawCalls.slice(2, -1);
      const bodyOverlay = alignment.drawCalls.at(-1);
      assert.deepEqual(topBase, {
        asset: "assets/environments/meadow/platforms/meadow_top_base.png",
        source: {x: 0, y: 0, w: 352, h: 128},
        destination: {x: 0, y: 0, w: 220, h: 80}
      });
      assert.deepEqual(topOverlay, {
        asset: `assets/environments/meadow/platforms/${alignment.topOverlaySelection.goalAsset}.png`,
        source: {x: 0, y: 0, w: 352, h: 128},
        destination: {x: 0, y: 0, w: 220, h: 80}
      });
      assert.deepEqual(bodyOverlay, {
        asset: `assets/environments/meadow/platforms/${alignment.bodyOverlaySelection.goalAsset}.png`,
        source: {x: 0, y: 0, w: 352, h: 128},
        destination: {x: 0, y: alignment.destination.height - 80, w: 220, h: 80}
      });
      assert.equal(base.length, {
        "goal-short": 1,
        "goal-medium": 3,
        "goal-tall": 6
      }[alignment.name]);
      assert.equal(
        alignment.bodyEdgeOpacity.left,
        1,
        `${alignment.name} left body edge: ${JSON.stringify({
          bodyEdgeOpacity: alignment.bodyEdgeOpacity,
          goalBodyDecodeAudit
        })}`
      );
      assert.equal(
        alignment.bodyEdgeOpacity.right,
        1,
        `${alignment.name} right body edge: ${JSON.stringify(alignment.bodyEdgeOpacity)}`
      );
      assert.ok(base.every(call =>
        call.asset === "assets/environments/meadow/platforms/meadow_body_base.png" &&
        call.source !== null &&
        call.source.x === 0 &&
        call.source.y === 0 &&
        call.source.w === 352 &&
        call.destination.x === 0 &&
        call.destination.w === 220
      ));
      assert.equal(base[0].destination.y, 79);
      assert.equal(
        base.at(-1).destination.y + base.at(-1).destination.h,
        alignment.destination.height
      );
      assert.ok(
        alignment.minimumInteriorRowCoverage > 0.99,
        `${alignment.name} horizontal alpha seam: ${alignment.minimumInteriorRowCoverage}`
      );
      assert.ok(base.every(call => (
        call.destination.h <= 80 && call.source.h === call.destination.h * 128 / 80
      )));
    }
  }

  let goalHeightScreenshot = null;
  if (viewport.width === 1280) {
    await evaluate(`(() => {
      const surface = document.createElement("canvas");
      surface.id = "meadow-goal-height-audit";
      surface.width = 1280;
      surface.height = 720;
      Object.assign(surface.style, {
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100vh",
        zIndex: "2147483647"
      });
      const context = surface.getContext("2d");
      context.fillStyle = "#cfeafa";
      context.fillRect(0, 0, surface.width, surface.height);
      context.fillStyle = "#91c979";
      context.fillRect(0, 670, surface.width, 50);
      context.strokeStyle = "rgba(34, 76, 45, 0.4)";
      context.beginPath();
      context.moveTo(0, 670.5);
      context.lineTo(surface.width, 670.5);
      context.stroke();
      const towers = [
        {label: "LOW 150 px", drawX: 100, height: 150, seed: 17},
        {label: "MEDIUM 250 px", drawX: 500, height: 250, seed: 19},
        {label: "HIGH 535 px / 6 rows", drawX: 900, height: 535, seed: 23}
      ];
      context.font = "bold 18px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      for (const tower of towers) {
        const y = 670 - tower.height;
        MEADOW_ASSET_VISUALS.drawPlatformBase(
          context,
          {x: 1060, y, w: 220, h: tower.height},
          tower.drawX,
          tower.seed
        );
        context.fillStyle = "#24472d";
        context.fillText(tower.label, tower.drawX + 110, Math.max(24, y - 10));
      }
      document.body.appendChild(surface);
    })()`);
    await delay(100);
    goalHeightScreenshot = await capture(
      cdp,
      "1280x720-meadow-goal-body-low-medium-high.png"
    );
    await evaluate(`document.getElementById("meadow-goal-height-audit")?.remove()`);
  }

  const seedAudits = [];
  for (let seedIndex = 0; seedIndex < 3; seedIndex++) {
    const seedAudit = await evaluate(`(() => {
      const selection = globalThis.meadowV1AlignmentCandidates[${seedIndex}];
      generatedLevel = selection.level;
      resetLevel(true);
      player.x = generatedLevel.spawn.x;
      player.y = generatedLevel.platforms.find(platform => platform.x === 0).y - player.r;
      player.vx = 0;
      player.vy = 0;
      aiming = true;
      drag.x = -118;
      drag.y = 72;
      const before = JSON.stringify({
        platforms: generatedLevel.platforms,
        goal: generatedLevel.goal,
        stars: generatedLevel.stars,
        spikes: generatedLevel.spikes,
        enemies: generatedLevel.enemies
      });
      for (let frameIndex = 0; frameIndex < 4; frameIndex++) draw();
      const after = JSON.stringify({
        platforms: generatedLevel.platforms,
        goal: generatedLevel.goal,
        stars: generatedLevel.stars,
        spikes: generatedLevel.spikes,
        enemies: generatedLevel.enemies
      });
      state = "gamePaused";
      aiming = true;
      draw();
      const start = generatedLevel.platforms.find(platform => platform.x === 0);
      const goal = generatedLevel.platforms.find(platform => platform.x === 1060);
      return {
        seed: generatedLevel.seed,
        targetLabel: selection.label,
        targetWidth: selection.targetWidth,
        observedWidth: selection.width,
        geometryUnchanged: before === after,
        start: {...start},
        goalPlatform: {...goal},
        floating: generatedLevel.platforms
          .filter(platform => platform.h === 26)
          .map(platform => ({x: platform.x, y: platform.y, w: platform.w, h: platform.h}))
      };
    })()`);
    assert.equal(seedAudit.geometryUnchanged, true);
    assert.deepEqual(seedAudit.start, {x: 0, y: 640, w: 235, h: 80});
    assert.equal(seedAudit.goalPlatform.x, 1060);
    assert.equal(seedAudit.goalPlatform.w, 220);
    assert.ok(seedAudit.goalPlatform.h >= 150 && seedAudit.goalPlatform.h <= 535);
    assert.equal(seedAudit.floating.length, 5);
    for (const platform of seedAudit.floating) {
      assert.equal(platform.h, 26);
      assert.ok(platform.w >= 114 && platform.w <= 137);
    }
    if (seedAudit.targetLabel === "minimum") assert.ok(seedAudit.observedWidth < 119);
    if (seedAudit.targetLabel === "middle") assert.ok(
      seedAudit.observedWidth >= 126 && seedAudit.observedWidth <= 128
    );
    if (seedAudit.targetLabel === "maximum") assert.ok(seedAudit.observedWidth > 134.5);
    seedAudit.screenshot = await capture(
      cdp,
      `${viewport.width}x${viewport.height}-meadow-v1-${seedAudit.targetLabel}-width.png`
    );
    seedAudits.push(seedAudit);
  }

  const performance = await evaluate(`(() => {
    aiming = false;
    const iterations = 120;
    const started = performance.now();
    for (let index = 0; index < iterations; index++) draw();
    const elapsed = performance.now() - started;
    return {iterations, elapsed, averageDrawMs: elapsed / iterations};
  })()`);
  assert.ok(Number.isFinite(performance.averageDrawMs));

  let tutorial = null;
  let tutorialScreenshot = null;
  let devAlignment = null;
  let devAlignmentScreenshot = null;
  if (viewport.width === 1280) {
    tutorial = await evaluate(`(() => {
      enterTutorialStage(0);
      state = "playing";
      levelIndex = 0;
      generatedLevel = createTutorialLevel(0);
      resetLevel(true);
      draw();
      state = "gamePaused";
      draw();
      return {
        active: Boolean(getActiveBiomePlatformVisuals(getBiomeForLevel(1))),
        tutorialStage: isTutorialStage(),
        goal: {...generatedLevel.goal},
        stars: generatedLevel.stars.length
      };
    })()`);
    assert.equal(tutorial.active, false);
    assert.equal(tutorial.tutorialStage, true);
    tutorialScreenshot = await capture(cdp, "1280x720-tutorial-control.png");

    await evaluate(`sessionStorage.setItem("slimejumperLocalDevMode", "on")`);
    const devReloaded = waitForEvent("Page.loadEventFired");
    await send("Page.reload", {ignoreCache: true});
    await devReloaded;
    await delay(450);
    devAlignment = await evaluate(`(async () => {
      const loaded = await MEADOW_ASSET_VISUALS.whenReady();
      enterRunStage();
      state = "playing";
      levelIndex = 0;
      const candidates = Array.from({length: 48}, () => generateProceduralLevel(1));
      generatedLevel = candidates.reduce((nearest, candidate) => {
        const height = candidate.platforms.find(platform => platform.x === 1060)?.h ?? 0;
        const nearestHeight = nearest.platforms.find(
          platform => platform.x === 1060
        )?.h ?? 0;
        return Math.abs(height - 250) < Math.abs(nearestHeight - 250)
          ? candidate
          : nearest;
      });
      ui.menu.classList.add("hidden");
      ui.message.classList.add("hidden");
      resetLevel(true);
      player.x = generatedLevel.spawn.x;
      player.y = generatedLevel.platforms.find(platform => platform.x === 0).y - player.r;
      player.vx = 0;
      player.vy = 0;
      aiming = true;
      drag.x = -118;
      drag.y = 72;
      state = "gamePaused";
      draw();
      return {
        loaded,
        devMode: DEV_MODE,
        active: Boolean(getActiveBiomePlatformVisuals(getBiomeForLevel(1))),
        platforms: generatedLevel.platforms.map(platform => ({...platform})),
        standingAlignment: {
          feetY: player.y + player.r,
          platformY: generatedLevel.platforms.find(platform => platform.x === 0).y,
          delta: player.y + player.r -
            generatedLevel.platforms.find(platform => platform.x === 0).y
        },
        goalPlatform: {
          ...generatedLevel.platforms.find(platform => platform.x === 1060)
        }
      };
    })()`);
    assert.equal(devAlignment.loaded, true);
    assert.equal(devAlignment.devMode, true);
    assert.equal(devAlignment.active, true);
    assert.equal(devAlignment.standingAlignment.delta, 0);
    assert.ok(devAlignment.goalPlatform.h >= 200 && devAlignment.goalPlatform.h <= 300);
    devAlignmentScreenshot = await capture(
      cdp,
      "1280x720-meadow-goal-top-cap-body-dev.png"
    );
  }

  return {
    viewport,
    startup,
    gameplay,
    alphaAlignment,
    bodyOverlayAudit,
    seedAudits,
    performance,
    tutorial,
    devAlignment,
    screenshots: {
      menuScreenshot,
      gameplayScreenshot,
      goalHeightScreenshot,
      tutorialScreenshot,
      devAlignmentScreenshot
    }
  };
}

(async () => {
  fs.mkdirSync(outputDirectory, {recursive: true});
  const target = await createTarget();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  const runtimeExceptions = [];
  const consoleErrors = [];
  cdp.on("Runtime.exceptionThrown", details => runtimeExceptions.push(details));
  cdp.on("Log.entryAdded", details => {
    if (details.entry?.level === "error") consoleErrors.push(details.entry);
  });
  const results = [];
  try {
    for (const viewport of viewports) results.push(await auditViewport(cdp, viewport));
    assert.equal(runtimeExceptions.length, 0, "uncaught browser runtime exception detected");
    assert.equal(consoleErrors.length, 0, "browser console error detected");
  } finally {
    await cdp.send("Page.close").catch(() => {});
    cdp.socket.close();
  }
  process.stdout.write(JSON.stringify({outputDirectory, results}, null, 2) + "\n");
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
