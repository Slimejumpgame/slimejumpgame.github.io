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
      menuGuard: isMeadowAssetVisualsActive(getBiomeForLevel(1)),
      menuVisible: !ui.menu.classList.contains("hidden")
    };
  })()`);
  assert.equal(startup.loaded, true);
  assert.equal(startup.status.ready, true);
  for (let index = 1; index <= 6; index++) {
    const assetName = `meadow_top_0${index}`;
    assert.equal(startup.status.loaded[assetName], true);
    assert.equal(
      startup.status.paths[assetName],
      `assets/environments/meadow/platforms/${assetName}.png`
    );
  }
  for (let index = 1; index <= 4; index++) {
    const assetName = `meadow_body_top_0${index}`;
    assert.equal(startup.status.loaded[assetName], true);
    assert.equal(
      startup.status.paths[assetName],
      `assets/environments/meadow/platforms/${assetName}.png`
    );
  }
  assert.equal(startup.status.loaded.meadow_body_base, true);
  assert.equal(
    startup.status.paths.meadow_body_base,
    "assets/environments/meadow/platforms/meadow_body_base.png"
  );
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
      active: isMeadowAssetVisualsActive(getBiomeForLevel(1)),
      assets: MEADOW_ASSET_VISUALS.getStatus(),
      topVariantSelection: MEADOW_ASSET_VISUALS.getTopVariantSelection(generatedLevel.seed),
      bodyTopVariantSelection: MEADOW_ASSET_VISUALS.getBodyTopVariantSelection(
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
    gameplay.topVariantSelection.startIndex,
    gameplay.topVariantSelection.goalIndex
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
  const startTopHeight = 235 * (745 / 2048);
  assert.equal(gameplay.massiveBlocks.start.drawCalls.length, 2);
  assert.deepEqual(
    gameplay.massiveBlocks.start.drawCalls,
    [
      {
        asset: "assets/environments/meadow/platforms/meadow_body_base.png",
        source: {x: 1, y: 1, w: 2079, h: 756},
        destination: {x: 0, y: startTopHeight - 1, w: 235, h: 48}
      },
      {
        asset: `assets/environments/meadow/platforms/${gameplay.topVariantSelection.startAsset}.png`,
        source: null,
        destination: {x: 0, y: 0, w: 235, h: startTopHeight}
      }
    ]
  );
  const goalDrawCalls = gameplay.massiveBlocks.goal.drawCalls;
  assert.ok(goalDrawCalls.length >= 2);
  assert.deepEqual(
    goalDrawCalls.at(-1),
    {
      asset: `assets/environments/meadow/platforms/${gameplay.topVariantSelection.goalAsset}.png`,
      source: null,
      destination: {x: 0, y: 0, w: 220, h: 80}
    }
  );
  const bodyTopSources = [
    {x: 3, y: 0, w: 2045, h: 742},
    {x: 0, y: 1, w: 2048, h: 740},
    {x: 0, y: 1, w: 2048, h: 742},
    {x: 0, y: 0, w: 2045, h: 742}
  ];
  const gameplayBodyTopSource = bodyTopSources[
    gameplay.bodyTopVariantSelection.goalIndex
  ];
  const goalBodyTopHeight = 220 * (gameplayBodyTopSource.h / gameplayBodyTopSource.w);
  const goalBaseStartY = 79 + goalBodyTopHeight - 1;
  assert.deepEqual(goalDrawCalls.at(-2), {
    asset: `assets/environments/meadow/platforms/${gameplay.bodyTopVariantSelection.goalAsset}.png`,
    source: gameplayBodyTopSource,
    destination: {x: 0, y: 79, w: 220, h: goalBodyTopHeight}
  });
  const goalBaseCalls = goalDrawCalls.slice(0, -2);
  for (const [rowIndex, call] of goalBaseCalls.entries()) {
    assert.equal(
      call.asset,
      "assets/environments/meadow/platforms/meadow_body_base.png"
    );
    assert.equal(call.source.x, 1);
    assert.equal(call.source.y, 1);
    assert.equal(call.source.w, 2079);
    assert.equal(call.destination.x, 0);
    assert.equal(call.destination.w, 220);
    assert.equal(call.destination.y, goalBaseStartY + rowIndex * 47);
    assert.equal(call.source.h, 756);
    assert.equal(call.destination.h, 48);
  }
  assert.ok(
    goalBaseCalls.at(-1).destination.y + 48 >=
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
        topVariantSelection: MEADOW_ASSET_VISUALS.getTopVariantSelection(seed),
        bodyTopVariantSelection: MEADOW_ASSET_VISUALS.getBodyTopVariantSelection(seed),
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
  const bodyTopTransitionAudit = await evaluate(`(() => {
    const sources = [
      {x: 3, y: 0, w: 2045, h: 742},
      {x: 0, y: 1, w: 2048, h: 740},
      {x: 0, y: 1, w: 2048, h: 742},
      {x: 0, y: 0, w: 2045, h: 742}
    ];
    const seeds = sources.map((_, goalIndex) => {
      for (let seed = 0; seed < 4096; seed++) {
        if (MEADOW_ASSET_VISUALS.getBodyTopVariantSelection(seed).goalIndex === goalIndex) {
          return seed;
        }
      }
      throw new Error("No seed found for Meadow body-top variant " + goalIndex);
    });
    return seeds.map((seed, expectedGoalIndex) => {
      const platform = {x: 1060, y: 0, w: 220, h: 250};
      const surface = document.createElement("canvas");
      surface.width = platform.w;
      surface.height = platform.h;
      const context = surface.getContext("2d", {willReadFrequently: true});
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
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      const selection = MEADOW_ASSET_VISUALS.getBodyTopVariantSelection(seed);
      const bodyTop = drawCalls.at(-2);
      const base = drawCalls.slice(0, -2);
      const bodyTopBottom = bodyTop.destination.y + bodyTop.destination.h;
      const firstRow = Math.max(0, Math.floor(bodyTopBottom) - 2);
      const lastRow = Math.min(surface.height - 1, Math.ceil(bodyTopBottom) + 2);
      const rowStats = [];
      let minimumAlpha = 255;
      let suspiciousLightPixels = 0;
      for (let y = firstRow; y <= lastRow; y++) {
        const totals = [0, 0, 0];
        let count = 0;
        for (let x = 10; x < surface.width - 10; x++) {
          const offset = (y * surface.width + x) * 4;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const alpha = pixels[offset + 3];
          totals[0] += red;
          totals[1] += green;
          totals[2] += blue;
          count += 1;
          minimumAlpha = Math.min(minimumAlpha, alpha);
          if (red >= 190 && green >= 135 && blue >= 110) suspiciousLightPixels += 1;
        }
        rowStats.push({
          y,
          average: totals.map(total => total / count)
        });
      }
      let maximumAdjacentChannelDelta = 0;
      for (let index = 1; index < rowStats.length; index++) {
        for (let channel = 0; channel < 3; channel++) {
          maximumAdjacentChannelDelta = Math.max(
            maximumAdjacentChannelDelta,
            Math.abs(rowStats[index].average[channel] - rowStats[index - 1].average[channel])
          );
        }
      }
      return {
        expectedGoalIndex,
        seed,
        selection,
        bodyTop,
        firstBase: base[0],
        bodyTopBottom,
        rowStats,
        minimumAlpha,
        suspiciousLightPixels,
        maximumAdjacentChannelDelta
      };
    });
  })()`);
  assert.equal(bodyTopTransitionAudit.length, 4);
  for (const transition of bodyTopTransitionAudit) {
    const source = bodyTopSources[transition.expectedGoalIndex];
    assert.equal(transition.selection.goalIndex, transition.expectedGoalIndex);
    assert.equal(
      transition.selection.goalAsset,
      `meadow_body_top_0${transition.expectedGoalIndex + 1}`
    );
    assert.deepEqual(transition.bodyTop.source, source);
    assert.equal(transition.bodyTop.destination.y, 79);
    assert.equal(transition.bodyTop.destination.w, 220);
    assert.equal(transition.bodyTop.destination.h, 220 * (source.h / source.w));
    assert.deepEqual(transition.firstBase.source, {x: 1, y: 1, w: 2079, h: 756});
    assert.equal(transition.firstBase.destination.y, transition.bodyTopBottom - 1);
    assert.equal(transition.minimumAlpha, 255);
    assert.equal(
      transition.suspiciousLightPixels,
      0,
      `body-top 0${transition.expectedGoalIndex + 1} has a light export seam: ${JSON.stringify(transition.rowStats)}`
    );
    assert.ok(
      transition.maximumAdjacentChannelDelta < 24,
      `body-top 0${transition.expectedGoalIndex + 1} transition delta: ${JSON.stringify(transition.rowStats)}`
    );
  }
  const goalBodyDecodeAudit = await evaluate(`(async () => {
    const image = new Image();
    image.src = "assets/environments/meadow/platforms/meadow_body_base.png?decode-audit=" + Date.now();
    await image.decode();
    const surface = document.createElement("canvas");
    surface.width = 220;
    surface.height = 48;
    const context = surface.getContext("2d", {willReadFrequently: true});
    context.drawImage(image, 1, 1, 2079, 756, 0, 0, 220, 48);
    const pixels = context.getImageData(0, 0, 220, 48).data;
    let minimumAlpha = 255;
    for (let index = 3; index < pixels.length; index += 4) {
      minimumAlpha = Math.min(minimumAlpha, pixels[index]);
    }
    return {naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, minimumAlpha};
  })()`);
  assert.deepEqual(goalBodyDecodeAudit, {
    naturalWidth: 2081,
    naturalHeight: 758,
    minimumAlpha: 255
  });
  const floatingAssets = [
    "assets/environments/meadow/platforms/floating_middle.png",
    "assets/environments/meadow/platforms/floating_left.png",
    "assets/environments/meadow/platforms/floating_right.png"
  ];
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
      assert.equal(alignment.drawCalls.length, 3);
      assert.deepEqual(
        alignment.drawCalls.map(call => call.asset),
        floatingAssets
      );
      assert.ok(alignment.drawCalls.every(call => call.source === null));
      const [middle, left, right] = alignment.drawCalls.map(call => call.destination);
      assert.equal(left.x, 0);
      assert.equal(left.y, 0);
      assert.equal(left.w, 23);
      assert.equal(left.h, 26);
      assert.equal(middle.x, 22);
      assert.equal(middle.w, alignment.destination.width - 43);
      assert.equal(right.x, alignment.destination.width - 22);
      assert.equal(right.w, 22);
      assert.equal(left.x + left.w - middle.x, 1);
      assert.equal(middle.x + middle.w - right.x, 1);
      assert.equal(right.x + right.w, alignment.destination.width);
    } else if (alignment.name === "start") {
      const startTopHeight = 235 * (745 / 2048);
      assert.deepEqual(alignment.drawCalls, [
        {
          asset: "assets/environments/meadow/platforms/meadow_body_base.png",
          source: {x: 1, y: 1, w: 2079, h: 756},
          destination: {x: 0, y: startTopHeight - 1, w: 235, h: 48}
        },
        {
          asset: `assets/environments/meadow/platforms/${alignment.topVariantSelection.startAsset}.png`,
          source: null,
          destination: {x: 0, y: 0, w: 235, h: startTopHeight}
        }
      ]);
      assert.equal(
        alignment.drawCalls[1].destination.w / 2048,
        alignment.drawCalls[1].destination.h / 745
      );
      assert.ok(alignment.drawCalls[0].destination.y >= alignment.destination.height);
      assert.ok(
        alignment.drawCalls.every(call =>
          call.destination.x === 0 && call.destination.w === alignment.destination.width
        )
      );
      assert.ok(alignment.drawCalls.every(call => !call.asset.includes("meadow_body_top_")));
      assert.ok(
        alignment.minimumInteriorRowCoverage > 0.99,
        `start horizontal alpha seam: ${alignment.minimumInteriorRowCoverage}`
      );
      assert.ok(
        alignment.startMaterialSeamDelta < 24,
        `start top/body material seam delta: ${alignment.startMaterialSeamDelta}`
      );
    } else if (alignment.name.startsWith("goal-")) {
      const top = alignment.drawCalls.at(-1);
      const bodyTop = alignment.drawCalls.at(-2);
      const base = alignment.drawCalls.slice(0, -2);
      const bodyTopSource = bodyTopSources[
        alignment.bodyTopVariantSelection.goalIndex
      ];
      const bodyTopHeight = 220 * (bodyTopSource.h / bodyTopSource.w);
      const baseStartY = 79 + bodyTopHeight - 1;
      assert.deepEqual(top, {
        asset: `assets/environments/meadow/platforms/${alignment.topVariantSelection.goalAsset}.png`,
        source: null,
        destination: {x: 0, y: 0, w: 220, h: 80}
      });
      assert.deepEqual(bodyTop, {
        asset: `assets/environments/meadow/platforms/${alignment.bodyTopVariantSelection.goalAsset}.png`,
        source: bodyTopSource,
        destination: {x: 0, y: 79, w: 220, h: bodyTopHeight}
      });
      assert.equal(base.length, {
        "goal-short": 0,
        "goal-medium": 2,
        "goal-tall": 9
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
        call.source.x === 1 &&
        call.source.y === 1 &&
        call.source.w === 2079 &&
        call.destination.x === 0 &&
        call.destination.w === 220
      ));
      if (base.length > 0) {
        assert.equal(base[0].destination.y, baseStartY);
        assert.ok(
          base.at(-1).destination.y + base.at(-1).destination.h >=
            alignment.destination.height
        );
      } else {
        assert.ok(bodyTop.destination.y + bodyTop.destination.h > alignment.destination.height);
      }
      assert.ok(
        alignment.minimumInteriorRowCoverage > 0.99,
        `${alignment.name} horizontal alpha seam: ${alignment.minimumInteriorRowCoverage}`
      );
      assert.ok(base.every(call => call.source.h === 756 && call.destination.h === 48));
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
        {label: "HIGH 535 px / 10 rows", drawX: 900, height: 535, seed: 23}
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
        active: isMeadowAssetVisualsActive(getBiomeForLevel(1)),
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
        active: isMeadowAssetVisualsActive(getBiomeForLevel(1)),
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
    bodyTopTransitionAudit,
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
