"use strict";

const DESERT_ASSET_VISUALS = (() => {
  const desertPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("desert");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    base: "assets/environments/desert/background/desert_background_base.png",
    sunGlow: "assets/environments/desert/background/desert_background_sun_glow.png"
  });
  const SUN_GLOW_ANCHOR = Object.freeze({x: 1057.5, y: 122.5});
  const SUN_GLOW_PERIOD_SECONDS = 6.5;
  const SUN_GLOW_MIN_ALPHA = 0.82;
  const SUN_GLOW_MAX_ALPHA = 0.98;
  const SUN_GLOW_SCALE_AMPLITUDE = 0.012;
  const SUN_GLOW_MIN_BRIGHTNESS = 0.9;
  const SUN_GLOW_MAX_BRIGHTNESS = 1.12;
  const QUICKSAND_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const QUICKSAND_HAZARD_PATHS = Object.freeze({
    base: "assets/environments/desert/hazards/desert_hazard_base.png",
    wave01: "assets/environments/desert/hazards/desert_hazard_wave_01.png",
    wave02: "assets/environments/desert/hazards/desert_hazard_wave_02.png"
  });
  const WAVE_01_SPEED = 10;
  const WAVE_01_BOB_SPEED = 1.1;
  const WAVE_01_BOB_AMPLITUDE = 0.75;
  const WAVE_02_SPEED = -16;
  const WAVE_02_BOB_SPEED = 0.8;
  const WAVE_02_BOB_PHASE = 1.7;
  const WAVE_02_BOB_AMPLITUDE = 0.4;
  const backgroundAssets = {};
  let sunGlowAlphaUsage = null;
  const quicksandHazardAssets = {};
  const quicksandHazardAlphaUsage = {};

  function hasValidBackgroundSize(name) {
    const image = backgroundAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function analyzeSunGlowAlpha(image) {
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
      const pixels = context.getImageData(
        0,
        0,
        surface.width,
        surface.height
      ).data;
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

  function isSunGlowReady() {
    return hasValidBackgroundSize("sunGlow") &&
      Boolean(
        sunGlowAlphaUsage?.hasVisiblePixels &&
        sunGlowAlphaUsage.hasTransparentPixels
      );
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidBackgroundSize(name);
        if (validSize && name === "sunGlow") {
          sunGlowAlphaUsage = analyzeSunGlowAlpha(image);
        }
        resolve(validSize && (name !== "sunGlow" || isSunGlowReady()));
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
  ).then(() => isBackgroundReady());

  function isBackgroundReady() {
    return hasValidBackgroundSize("base");
  }

  function getBackgroundMapping(width, height) {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) return null;
    return Object.freeze({
      source: BACKGROUND_REFERENCE,
      scaleX: width / BACKGROUND_REFERENCE.w,
      scaleY: height / BACKGROUND_REFERENCE.h,
      destination: Object.freeze({x: 0, y: 0, w: width, h: height})
    });
  }

  function drawBackgroundLayer(
    context,
    name,
    mapping,
    destination = mapping.destination
  ) {
    context.drawImage(
      backgroundAssets[name].image,
      0,
      0,
      mapping.source.w,
      mapping.source.h,
      destination.x,
      destination.y,
      destination.w,
      destination.h
    );
  }

  function getSunGlowMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const pulse = Math.sin(
      safeTime * Math.PI * 2 / SUN_GLOW_PERIOD_SECONDS
    );
    const normalizedPulse = (pulse + 1) / 2;
    const alpha = SUN_GLOW_MIN_ALPHA +
      normalizedPulse * (SUN_GLOW_MAX_ALPHA - SUN_GLOW_MIN_ALPHA);
    const scale = 1 - SUN_GLOW_SCALE_AMPLITUDE +
      normalizedPulse * SUN_GLOW_SCALE_AMPLITUDE * 2;
    const brightness = SUN_GLOW_MIN_BRIGHTNESS + normalizedPulse * (
      SUN_GLOW_MAX_BRIGHTNESS - SUN_GLOW_MIN_BRIGHTNESS
    );
    const anchorX = SUN_GLOW_ANCHOR.x * mapping.scaleX;
    const anchorY = SUN_GLOW_ANCHOR.y * mapping.scaleY;
    const destinationWidth = mapping.destination.w * scale;
    const destinationHeight = mapping.destination.h * scale;
    return Object.freeze({
      alpha,
      scale,
      brightness,
      normalizedPulse,
      anchor: Object.freeze({x: anchorX, y: anchorY}),
      destination: Object.freeze({
        x: anchorX - SUN_GLOW_ANCHOR.x / mapping.source.w * destinationWidth,
        y: anchorY - SUN_GLOW_ANCHOR.y / mapping.source.h * destinationHeight,
        w: destinationWidth,
        h: destinationHeight
      })
    });
  }

  function drawSunGlow(context, mapping, visualTime) {
    const glowMapping = getSunGlowMapping(visualTime, mapping);
    if (!glowMapping) return false;
    context.save();
    context.globalAlpha = glowMapping.alpha;
    context.filter = `brightness(${glowMapping.brightness})`;
    drawBackgroundLayer(
      context,
      "sunGlow",
      mapping,
      glowMapping.destination
    );
    context.restore();
    return true;
  }

  function drawBackground(context, width, height, visualTime = 0) {
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawBackgroundLayer(context, "base", mapping);
    if (isSunGlowReady()) {
      drawSunGlow(context, mapping, visualTime);
    }
    context.restore();
    return true;
  }

  function hasValidQuicksandHazardSize(name) {
    const image = quicksandHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === QUICKSAND_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === QUICKSAND_HAZARD_CONTRACT.native.h
    );
  }

  function analyzeAlphaUsage(image) {
    if (
      typeof document === "undefined" ||
      !document.createElement ||
      !image
    ) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = QUICKSAND_HAZARD_CONTRACT.native.w;
      surface.height = QUICKSAND_HAZARD_CONTRACT.native.h;
      const context = surface.getContext("2d", {willReadFrequently: true});
      if (!context) return null;
      context.clearRect(0, 0, surface.width, surface.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        surface.width,
        surface.height
      ).data;
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

  function hasValidWaveAlpha(name) {
    const usage = quicksandHazardAlphaUsage[name];
    return Boolean(usage?.hasVisiblePixels && usage.hasTransparentPixels);
  }

  function loadQuicksandHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    quicksandHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidQuicksandHazardSize(name);
        if (validSize && name !== "base") {
          quicksandHazardAlphaUsage[name] = analyzeAlphaUsage(image);
        }
        resolve(validSize && (name === "base" || hasValidWaveAlpha(name)));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(QUICKSAND_HAZARD_PATHS)) {
    loadQuicksandHazardAsset(name, path);
  }
  const quicksandHazardReadyPromise = Promise.all(
    Object.values(quicksandHazardAssets).map(record => record.ready)
  ).then(results => results.every(Boolean));

  function isQuicksandHazardReady() {
    return Object.keys(QUICKSAND_HAZARD_PATHS).every(
      hasValidQuicksandHazardSize
    ) && hasValidWaveAlpha("wave01") && hasValidWaveAlpha("wave02");
  }

  function getSignedWrappedOffset(visualTime, speed, width) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const distance = Math.abs(safeTime * speed) % width;
    return Math.sign(speed) * distance;
  }

  function getWrappedQuicksandDestinations(rect, offsetX, offsetY) {
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

  function getQuicksandHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.w !== QUICKSAND_HAZARD_CONTRACT.runtime.w ||
      rect.h !== QUICKSAND_HAZARD_CONTRACT.runtime.h
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
      source: QUICKSAND_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      wave01: Object.freeze({
        offsetX: wave01OffsetX,
        offsetY: wave01OffsetY,
        destinations: getWrappedQuicksandDestinations(
          rect,
          wave01OffsetX,
          wave01OffsetY
        )
      }),
      wave02: Object.freeze({
        offsetX: wave02OffsetX,
        offsetY: wave02OffsetY,
        destinations: getWrappedQuicksandDestinations(
          rect,
          wave02OffsetX,
          wave02OffsetY
        )
      })
    });
  }

  function drawQuicksandHazardLayer(context, name, source, destination) {
    context.drawImage(
      quicksandHazardAssets[name].image,
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
    if (!context || !isQuicksandHazardReady()) return false;
    const mapping = getQuicksandHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawQuicksandHazardLayer(context, "base", mapping.source, mapping.base);
    for (const destination of mapping.wave01.destinations) {
      drawQuicksandHazardLayer(context, "wave01", mapping.source, destination);
    }
    for (const destination of mapping.wave02.destinations) {
      drawQuicksandHazardLayer(context, "wave02", mapping.source, destination);
    }
    context.restore();
    return true;
  }

  const desertVisuals = Object.freeze({
    ...desertPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isSunGlowReady,
    getBackgroundMapping,
    getSunGlowMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(BACKGROUND_PATHS).map(name => [
          name,
          hasValidBackgroundSize(name)
        ])
      )),
      sunGlowAlphaUsage,
      sunGlowAnimation: Object.freeze({
        anchor: SUN_GLOW_ANCHOR,
        periodSeconds: SUN_GLOW_PERIOD_SECONDS,
        minAlpha: SUN_GLOW_MIN_ALPHA,
        maxAlpha: SUN_GLOW_MAX_ALPHA,
        minScale: 1 - SUN_GLOW_SCALE_AMPLITUDE,
        maxScale: 1 + SUN_GLOW_SCALE_AMPLITUDE,
        minBrightness: SUN_GLOW_MIN_BRIGHTNESS,
        maxBrightness: SUN_GLOW_MAX_BRIGHTNESS
      })
    }),
    whenQuicksandHazardReady: () => quicksandHazardReadyPromise,
    isQuicksandHazardReady,
    getQuicksandHazardMapping,
    drawBottomDeathHazard,
    getQuicksandHazardStatus: () => Object.freeze({
      ready: isQuicksandHazardReady(),
      paths: QUICKSAND_HAZARD_PATHS,
      contract: QUICKSAND_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(QUICKSAND_HAZARD_PATHS).map(name => [
          name,
          hasValidQuicksandHazardSize(name)
        ])
      )),
      waveAlphaUsage: Object.freeze({...quicksandHazardAlphaUsage})
    })
  });
  BIOME_PLATFORM_VISUALS.register("desert", desertVisuals);
  return desertVisuals;
})();
