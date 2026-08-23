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
            source: {x: args[1], y: args[2], w: args[3], h: args[4]},
            destination: {x: args[5], y: args[6], w: args[7], h: args[8]}
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
      geometryUnchanged: before === after,
      decorCounts: {
        back: scene.backDecor.length,
        foreground: scene.foregroundDecor.length
      },
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
  assert.deepEqual(gameplay.decorCounts, {back: 5, foreground: 3});
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
  assert.equal(gameplay.massiveBlocks.start.drawCalls.length, 1);
  assert.deepEqual(
    gameplay.massiveBlocks.start.drawCalls[0].source,
    {x: 680, y: 220, w: 471, h: 119}
  );
  const goalDrawCalls = gameplay.massiveBlocks.goal.drawCalls;
  assert.ok(goalDrawCalls.length >= 3);
  assert.deepEqual(
    goalDrawCalls.at(-1),
    {
      source: {x: 1170, y: 672, w: 214, h: 203},
      destination: {x: 0, y: 0, w: 220, h: 80}
    }
  );
  const goalBodySources = new Set([
    "320,370,239", "599,370,238", "876,370,240",
    "317,627,242", "600,627,239", "877,626,240"
  ]);
  const goalBodyCalls = goalDrawCalls.slice(0, -1);
  for (const [rowIndex, call] of goalBodyCalls.entries()) {
    assert.ok(
      goalBodySources.has([call.source.x, call.source.y, call.source.w].join(",")),
      `unexpected body source ${JSON.stringify(call.source)}`
    );
    assert.equal(call.destination.x, 0);
    assert.equal(call.destination.w, 220);
    assert.equal(call.destination.y, 79 + rowIndex * 47);
    assert.ok(call.destination.h <= 48);
    if (rowIndex < goalBodyCalls.length - 1) assert.equal(call.destination.h, 48);
  }
  assert.equal(
    goalBodyCalls.at(-1).destination.h,
    gameplay.massiveBlocks.goal.height - goalBodyCalls.at(-1).destination.y
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
    const image = new Image();
    image.src = "assets/environments/meadow/platforms/meadow_tileset.png";
    if (!image.complete) {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
    }
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
            source: {x: args[1], y: args[2], w: args[3], h: args[4]},
            destination: {x: args[5], y: args[6], w: args[7], h: args[8]}
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
        if (alpha < 64) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return {
        name,
        destination: {width: surface.width, height: surface.height},
        drawCalls,
        walkableTop: {
          terrainRatio: topTerrainPixels / topPixels,
          grassRatio: topGrassPixels / topPixels
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
      inspectRendered("goal-tall", {x: 1060, y: 0, w: 220, h: 535}, 23)
    ];
  })()`);
  const floatingSources = [
    {x: 142, y: 49, w: 112, h: 127},
    {x: 520, y: 49, w: 300, h: 127},
    {x: 1071, y: 49, w: 108, h: 127}
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
        alignment.drawCalls.map(call => call.source),
        floatingSources
      );
      const [left, middle, right] = alignment.drawCalls.map(call => call.destination);
      assert.equal(left.x, 0);
      assert.equal(left.y, 0);
      assert.equal(left.w, 23);
      assert.equal(left.h, 26);
      assert.equal(middle.x, 23);
      assert.equal(middle.w, alignment.destination.width - 45);
      assert.equal(right.x, alignment.destination.width - 22);
      assert.equal(right.w, 22);
      assert.equal(middle.x + middle.w, right.x);
      assert.equal(right.x + right.w, alignment.destination.width);
    }
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
    seedAudits,
    performance,
    tutorial,
    devAlignment,
    screenshots: {
      menuScreenshot,
      gameplayScreenshot,
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
