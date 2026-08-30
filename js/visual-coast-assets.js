"use strict";

const COAST_ASSET_VISUALS = (() => {
  const coastPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("coast");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_ALPHA_THRESHOLD = 8;
  const BACKGROUND_PATHS = Object.freeze({
    skyBase: "assets/environments/coast/background/coast_background_sky_base.png",
    cloudsBack: "assets/environments/coast/background/coast_background_clouds_back.png",
    ship: "assets/environments/coast/background/coast_background_ship.png",
    landscape: "assets/environments/coast/background/coast_background_landscape.png",
    cloudsFront: "assets/environments/coast/background/coast_background_clouds_front.png"
  });
  const WATER_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const WATER_HAZARD_PATHS = Object.freeze({
    waterBase: "assets/environments/coast/hazards/coast_hazard_water_base.png",
    wave01: "assets/environments/coast/hazards/coast_hazard_wave_01.png",
    wave02: "assets/environments/coast/hazards/coast_hazard_wave_02.png"
  });
  const BACK_CLOUD_LEFT_SPEED = 6;
  const BACK_CLOUD_WRAP_OVERLAP = 59;
  const FRONT_CLOUD_LEFT_SPEED = 12;
  const FRONT_CLOUD_WRAP_OVERLAP = 35;
  const SHIP_CONTENT_WIDTH = 190;
  const SHIP_VISIBLE_SCALE = 0.75;
  const SHIP_TRAVEL_EDGE_INSET = 270;
  const SHIP_TRAVEL_PERIOD_SECONDS = 30;
  const SHIP_BASELINE_Y = 535;
  const SHIP_Y_OFFSET = -24;
  const HORIZON_LAYER_Y_OFFSET = 75;
  const SHIP_BOB_AMPLITUDE = 2.5;
  const SHIP_BOB_PERIOD_SECONDS = 5.5;
  const WAVE_01_SPEED = 18;
  const WAVE_01_BOB_SPEED = 1.6;
  const WAVE_01_BOB_AMPLITUDE = 1.2;
  const WAVE_02_SPEED = -11;
  const WAVE_02_BOB_SPEED = 1.15;
  const WAVE_02_BOB_PHASE = 1.7;
  const WAVE_02_BOB_AMPLITUDE = 0.7;
  const backgroundAssets = {};
  const waterHazardAssets = {};
  const waterHazardAlphaUsage = {};
  let shipContentBounds = null;

  function hasValidBackgroundSize(name) {
    const image = backgroundAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function analyzeVisibleAlphaBounds(image) {
    if (
      typeof document === "undefined" ||
      !document.createElement ||
      !image
    ) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = BACKGROUND_REFERENCE.w;
      surface.height = BACKGROUND_REFERENCE.h;
      const context = surface.getContext("2d", {willReadFrequently: true});
      if (!context) return null;
      context.clearRect(0, 0, surface.width, surface.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      let left = surface.width;
      let top = surface.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < surface.height; y++) {
        for (let x = 0; x < surface.width; x++) {
          if (
            pixels[(y * surface.width + x) * 4 + 3] <=
              BACKGROUND_ALPHA_THRESHOLD
          ) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) return null;
      return Object.freeze({
        x: left,
        y: top,
        w: right - left + 1,
        h: bottom - top + 1
      });
    } catch {
      return null;
    }
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const valid = hasValidBackgroundSize(name);
        if (valid && name === "ship") {
          shipContentBounds = analyzeVisibleAlphaBounds(image);
        }
        resolve(valid && (name !== "ship" || Boolean(shipContentBounds)));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  function analyzeAlphaUsage(image, width, height) {
    if (
      typeof document === "undefined" ||
      !document.createElement ||
      !image
    ) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = width;
      surface.height = height;
      const context = surface.getContext("2d", {willReadFrequently: true});
      if (!context) return null;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      let hasVisiblePixels = false;
      let hasTransparentPixels = false;
      for (let index = 3; index < pixels.length; index += 4) {
        const alpha = pixels[index];
        if (alpha > 0) hasVisiblePixels = true;
        if (alpha < 255) hasTransparentPixels = true;
        if (hasVisiblePixels && hasTransparentPixels) break;
      }
      return Object.freeze({hasVisiblePixels, hasTransparentPixels});
    } catch {
      return null;
    }
  }

  function hasValidWaterHazardSize(name) {
    const image = waterHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === WATER_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === WATER_HAZARD_CONTRACT.native.h
    );
  }

  function hasValidWaveAlpha(name) {
    const usage = waterHazardAlphaUsage[name];
    return Boolean(usage?.hasVisiblePixels && usage.hasTransparentPixels);
  }

  function loadWaterHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    waterHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidWaterHazardSize(name);
        if (validSize && name !== "waterBase") {
          waterHazardAlphaUsage[name] = analyzeAlphaUsage(
            image,
            WATER_HAZARD_CONTRACT.native.w,
            WATER_HAZARD_CONTRACT.native.h
          );
        }
        resolve(
          validSize &&
          (name === "waterBase" || hasValidWaveAlpha(name))
        );
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
    loadBackgroundAsset(name, path);
  }
  const backgroundReadyPromise = Promise.all(
    Object.values(backgroundAssets).map(record => record.ready)
  ).then(results => results.every(Boolean));
  for (const [name, path] of Object.entries(WATER_HAZARD_PATHS)) {
    loadWaterHazardAsset(name, path);
  }
  const waterHazardReadyPromise = Promise.all(
    Object.values(waterHazardAssets).map(record => record.ready)
  ).then(results => results.every(Boolean));

  function isBackgroundReady() {
    return Object.keys(BACKGROUND_PATHS).every(hasValidBackgroundSize) &&
      Boolean(shipContentBounds);
  }

  function getBackgroundMapping(width, height) {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) return null;
    return Object.freeze({
      reference: BACKGROUND_REFERENCE,
      scaleX: width / BACKGROUND_REFERENCE.w,
      scaleY: height / BACKGROUND_REFERENCE.h,
      destination: Object.freeze({x: 0, y: 0, w: width, h: height})
    });
  }

  function getWrappedCloudOffset(visualTime, leftSpeed, wrapDistance) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travel = (
      (safeTime * leftSpeed) % wrapDistance + wrapDistance
    ) % wrapDistance;
    return travel === 0 ? 0 : -travel;
  }

  function drawFullBackgroundLayer(
    context,
    name,
    mapping,
    offsetX = 0,
    offsetY = 0
  ) {
    const source = BACKGROUND_REFERENCE;
    context.drawImage(
      backgroundAssets[name].image,
      0,
      0,
      source.w,
      source.h,
      offsetX * mapping.scaleX,
      offsetY * mapping.scaleY,
      mapping.destination.w,
      mapping.destination.h
    );
  }

  function drawWrappedCloudLayer(
    context,
    name,
    mapping,
    visualTime,
    leftSpeed,
    overlap
  ) {
    const wrapDistance = BACKGROUND_REFERENCE.w - overlap;
    const offsetX = getWrappedCloudOffset(
      visualTime,
      leftSpeed,
      wrapDistance
    );
    drawFullBackgroundLayer(context, name, mapping, offsetX);
    drawFullBackgroundLayer(
      context,
      name,
      mapping,
      offsetX + wrapDistance
    );
  }

  function getShipMapping(visualTime, width, height) {
    const backgroundMapping = getBackgroundMapping(width, height);
    if (!backgroundMapping || !shipContentBounds) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travelPhase = safeTime * Math.PI * 2 / SHIP_TRAVEL_PERIOD_SECONDS;
    const minimumCenterX = SHIP_TRAVEL_EDGE_INSET + SHIP_CONTENT_WIDTH / 2;
    const maximumCenterX =
      BACKGROUND_REFERENCE.w - SHIP_TRAVEL_EDGE_INSET - SHIP_CONTENT_WIDTH / 2;
    const referenceCenterX = (minimumCenterX + maximumCenterX) / 2 +
      Math.sin(travelPhase) * (maximumCenterX - minimumCenterX) / 2;
    const referenceBottomY =
      SHIP_BASELINE_Y + SHIP_Y_OFFSET + HORIZON_LAYER_Y_OFFSET + Math.sin(
        safeTime * Math.PI * 2 / SHIP_BOB_PERIOD_SECONDS
      ) * SHIP_BOB_AMPLITUDE;
    const uniformDisplayScale = Math.min(
      backgroundMapping.scaleX,
      backgroundMapping.scaleY
    );
    const contentScale =
      SHIP_CONTENT_WIDTH * SHIP_VISIBLE_SCALE / shipContentBounds.w;
    const destinationWidth = shipContentBounds.w * contentScale * uniformDisplayScale;
    const destinationHeight = shipContentBounds.h * contentScale * uniformDisplayScale;
    const destinationCenterX = referenceCenterX * backgroundMapping.scaleX;
    const destinationBottomY = referenceBottomY * backgroundMapping.scaleY;
    return Object.freeze({
      source: shipContentBounds,
      destination: Object.freeze({
        x: destinationCenterX - destinationWidth / 2,
        y: destinationBottomY - destinationHeight,
        w: destinationWidth,
        h: destinationHeight
      }),
      centerX: destinationCenterX,
      bottomY: destinationBottomY,
      flipX: Math.cos(travelPhase) < 0,
      referenceCenterX,
      referenceBottomY
    });
  }

  function isWaterHazardReady() {
    return Object.keys(WATER_HAZARD_PATHS).every(hasValidWaterHazardSize) &&
      hasValidWaveAlpha("wave01") &&
      hasValidWaveAlpha("wave02");
  }

  function getSignedWrappedOffset(visualTime, speed, width) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const distance = Math.abs(safeTime * speed) % width;
    return Math.sign(speed) * distance;
  }

  function getWrappedWaterDestinations(rect, offsetX, offsetY) {
    const firstX = offsetX >= 0
      ? rect.x + offsetX - rect.w
      : rect.x + offsetX;
    return Object.freeze([
      Object.freeze({x: firstX, y: rect.y + offsetY, w: rect.w, h: rect.h}),
      Object.freeze({
        x: firstX + rect.w,
        y: rect.y + offsetY,
        w: rect.w,
        h: rect.h
      })
    ]);
  }

  function getWaterHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.w !== WATER_HAZARD_CONTRACT.runtime.w ||
      rect.h !== WATER_HAZARD_CONTRACT.runtime.h
    ) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const wave01OffsetX = getSignedWrappedOffset(
      safeTime,
      WAVE_01_SPEED,
      rect.w
    );
    const wave02OffsetX = getSignedWrappedOffset(
      safeTime,
      WAVE_02_SPEED,
      rect.w
    );
    const wave01OffsetY = Math.sin(safeTime * WAVE_01_BOB_SPEED) *
      WAVE_01_BOB_AMPLITUDE;
    const wave02OffsetY = Math.sin(
      safeTime * WAVE_02_BOB_SPEED + WAVE_02_BOB_PHASE
    ) * WAVE_02_BOB_AMPLITUDE;
    return Object.freeze({
      source: WATER_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      wave01: Object.freeze({
        offsetX: wave01OffsetX,
        offsetY: wave01OffsetY,
        destinations: getWrappedWaterDestinations(
          rect,
          wave01OffsetX,
          wave01OffsetY
        )
      }),
      wave02: Object.freeze({
        offsetX: wave02OffsetX,
        offsetY: wave02OffsetY,
        destinations: getWrappedWaterDestinations(
          rect,
          wave02OffsetX,
          wave02OffsetY
        )
      })
    });
  }

  function drawWaterHazardLayer(context, name, source, destination) {
    context.drawImage(
      waterHazardAssets[name].image,
      0,
      0,
      source.w,
      source.h,
      destination.x,
      destination.y,
      destination.w,
      destination.h
    );
  }

  function drawBottomDeathHazard(context, rect, visualTime = 0) {
    if (!context || !isWaterHazardReady()) return false;
    const mapping = getWaterHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawWaterHazardLayer(context, "waterBase", mapping.source, mapping.base);
    for (const destination of mapping.wave01.destinations) {
      drawWaterHazardLayer(context, "wave01", mapping.source, destination);
    }
    for (const destination of mapping.wave02.destinations) {
      drawWaterHazardLayer(context, "wave02", mapping.source, destination);
    }
    context.restore();
    return true;
  }

  function drawShip(context, mapping) {
    const source = mapping.source;
    const destination = mapping.destination;
    context.save();
    let destinationX = destination.x;
    if (mapping.flipX) {
      context.translate(mapping.centerX, 0);
      context.scale(-1, 1);
      destinationX = -destination.w / 2;
    }
    context.drawImage(
      backgroundAssets.ship.image,
      source.x,
      source.y,
      source.w,
      source.h,
      destinationX,
      destination.y,
      destination.w,
      destination.h
    );
    context.restore();
  }

  function drawBackground(context, width, height, visualTime = 0) {
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    const shipMapping = getShipMapping(visualTime, width, height);
    if (!mapping || !shipMapping) return false;

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawFullBackgroundLayer(context, "skyBase", mapping);
    drawWrappedCloudLayer(
      context,
      "cloudsBack",
      mapping,
      visualTime,
      BACK_CLOUD_LEFT_SPEED,
      BACK_CLOUD_WRAP_OVERLAP
    );
    drawShip(context, shipMapping);
    drawFullBackgroundLayer(
      context,
      "landscape",
      mapping,
      0,
      HORIZON_LAYER_Y_OFFSET
    );
    drawWrappedCloudLayer(
      context,
      "cloudsFront",
      mapping,
      visualTime,
      FRONT_CLOUD_LEFT_SPEED,
      FRONT_CLOUD_WRAP_OVERLAP
    );
    context.restore();
    return true;
  }

  const coastVisuals = Object.freeze({
    ...coastPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getBackgroundMapping,
    getShipMapping,
    drawBackground,
    whenWaterHazardReady: () => waterHazardReadyPromise,
    isWaterHazardReady,
    getWaterHazardMapping,
    drawBottomDeathHazard,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(BACKGROUND_PATHS).map(name => [name, hasValidBackgroundSize(name)])
      )),
      alphaThreshold: BACKGROUND_ALPHA_THRESHOLD,
      shipContentBounds,
      cloudAnimation: Object.freeze({
        back: Object.freeze({
          leftSpeed: BACK_CLOUD_LEFT_SPEED,
          ySpeed: 0,
          wrapDistance: BACKGROUND_REFERENCE.w - BACK_CLOUD_WRAP_OVERLAP,
          overlap: BACK_CLOUD_WRAP_OVERLAP,
          drawCopies: 2
        }),
        front: Object.freeze({
          leftSpeed: FRONT_CLOUD_LEFT_SPEED,
          ySpeed: 0,
          wrapDistance: BACKGROUND_REFERENCE.w - FRONT_CLOUD_WRAP_OVERLAP,
          overlap: FRONT_CLOUD_WRAP_OVERLAP,
          drawCopies: 2
        }),
        direction: "right-to-left",
        wrapMode: "horizontal-continuous"
      })
    }),
    getWaterHazardStatus: () => Object.freeze({
      ready: isWaterHazardReady(),
      paths: WATER_HAZARD_PATHS,
      contract: WATER_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(WATER_HAZARD_PATHS).map(name => [
          name,
          hasValidWaterHazardSize(name)
        ])
      )),
      waveAlphaUsage: Object.freeze({...waterHazardAlphaUsage})
    })
  });
  BIOME_PLATFORM_VISUALS.register("coast", coastVisuals);
  return coastVisuals;
})();
