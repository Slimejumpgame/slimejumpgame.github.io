"use strict";

const VOLCANO_ASSET_VISUALS = (() => {
  const volcanoPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("volcano");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skyBase: "assets/environments/volcano/background/volcano_background_sky_base.png",
    smoke: "assets/environments/volcano/background/volcano_background_smoke.png",
    landscape: "assets/environments/volcano/background/volcano_background_landscape.png",
    lavaGlow: "assets/environments/volcano/background/volcano_background_lava_glow.png",
    embers: "assets/environments/volcano/background/volcano_background_embers.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skyBase",
    "landscape"
  ]);
  const SMOKE_X_AMPLITUDE = 5;
  const SMOKE_X_PERIOD_SECONDS = 22;
  const SMOKE_Y_AMPLITUDE = 2;
  const SMOKE_Y_PERIOD_SECONDS = 14;
  const SMOKE_Y_PHASE = 0.65;
  const SMOKE_GLOW_ZONES = Object.freeze([
    Object.freeze({
      x: 250,
      y: 310,
      radius: 72,
      periodSeconds: 5.7,
      phase: 0.2,
      minAlpha: 0.13,
      maxAlpha: 0.30
    }),
    Object.freeze({
      x: 475,
      y: 160,
      radius: 66,
      periodSeconds: 7.1,
      phase: 1.4,
      minAlpha: 0.11,
      maxAlpha: 0.26
    }),
    Object.freeze({
      x: 685,
      y: 225,
      radius: 82,
      periodSeconds: 6.3,
      phase: 2.6,
      minAlpha: 0.15,
      maxAlpha: 0.34
    }),
    Object.freeze({
      x: 965,
      y: 350,
      radius: 64,
      periodSeconds: 8.4,
      phase: 4.1,
      minAlpha: 0.11,
      maxAlpha: 0.28
    }),
    Object.freeze({
      x: 1040,
      y: 265,
      radius: 70,
      periodSeconds: 6.9,
      phase: 5.2,
      minAlpha: 0.13,
      maxAlpha: 0.32
    })
  ]);
  const LAVA_GLOW_PERIOD_SECONDS = 6.8;
  const LAVA_GLOW_MIN_ALPHA = 0.74;
  const LAVA_GLOW_MAX_ALPHA = 1.00;
  const LAVA_GLOW_MIN_BRIGHTNESS = 1.00;
  const LAVA_GLOW_MAX_BRIGHTNESS = 1.58;
  const EMBERS_RISE_SPEED = 6;
  const EMBERS_X_AMPLITUDE = 3;
  const EMBERS_X_PERIOD_SECONDS = 13;
  const LAVA_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const LAVA_HAZARD_PATHS = Object.freeze({
    base: "assets/environments/volcano/hazards/volcano_hazard_lava_base.png",
    wave01: "assets/environments/volcano/hazards/volcano_hazard_lava_wave_01.png",
    wave02: "assets/environments/volcano/hazards/volcano_hazard_lava_wave_02.png"
  });
  const WAVE_01_SPEED = 10;
  const WAVE_01_BOB_SPEED = 1.1;
  const WAVE_01_BOB_AMPLITUDE = 0.75;
  const WAVE_02_SPEED = -16;
  const WAVE_02_BOB_SPEED = 0.8;
  const WAVE_02_BOB_PHASE = 1.7;
  const WAVE_02_BOB_AMPLITUDE = 0.4;
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const lavaHazardAssets = {};
  const lavaHazardAlphaUsage = {};

  function hasValidBackgroundSize(name) {
    const image = backgroundAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function analyzeBackgroundAlphaUsage(image) {
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

  function hasValidBackgroundAlpha(name) {
    const usage = backgroundAlphaUsage[name];
    return Boolean(usage?.hasVisiblePixels && usage.hasTransparentPixels);
  }

  function isBackgroundLayerReady(name) {
    return hasValidBackgroundSize(name) && (
      name === "skyBase" || hasValidBackgroundAlpha(name)
    );
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidBackgroundSize(name);
        if (validSize && name !== "skyBase") {
          backgroundAlphaUsage[name] = analyzeBackgroundAlphaUsage(image);
        }
        resolve(validSize && (
          name === "skyBase" || hasValidBackgroundAlpha(name)
        ));
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
    return ESSENTIAL_BACKGROUND_LAYERS.every(isBackgroundLayerReady);
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

  function getNormalizedPulse(visualTime, periodSeconds, phase = 0) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return (
      Math.sin(safeTime * Math.PI * 2 / periodSeconds + phase) + 1
    ) / 2;
  }

  function getWrappedHorizontalDestinations(mapping, offsetX, offsetY) {
    const firstX = offsetX >= 0
      ? offsetX - BACKGROUND_REFERENCE.w
      : offsetX;
    return Object.freeze([
      Object.freeze({
        x: firstX * mapping.scaleX,
        y: offsetY * mapping.scaleY,
        w: mapping.destination.w,
        h: mapping.destination.h
      }),
      Object.freeze({
        x: (firstX + BACKGROUND_REFERENCE.w) * mapping.scaleX,
        y: offsetY * mapping.scaleY,
        w: mapping.destination.w,
        h: mapping.destination.h
      })
    ]);
  }

  function getSmokeMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const offsetX = Math.sin(
      safeTime * Math.PI * 2 / SMOKE_X_PERIOD_SECONDS
    ) * SMOKE_X_AMPLITUDE;
    const offsetY = Math.sin(
      safeTime * Math.PI * 2 / SMOKE_Y_PERIOD_SECONDS + SMOKE_Y_PHASE
    ) * SMOKE_Y_AMPLITUDE;
    const uniformScale = Math.min(mapping.scaleX, mapping.scaleY);
    return Object.freeze({
      offsetX,
      offsetY,
      destinations: getWrappedHorizontalDestinations(
        mapping,
        offsetX,
        offsetY
      ),
      glowZones: Object.freeze(SMOKE_GLOW_ZONES.map(zone => {
        const normalizedPulse = getNormalizedPulse(
          safeTime,
          zone.periodSeconds,
          zone.phase
        );
        return Object.freeze({
          x: (zone.x + offsetX) * mapping.scaleX,
          y: (zone.y + offsetY) * mapping.scaleY,
          radius: zone.radius * uniformScale,
          alpha: zone.minAlpha + normalizedPulse * (
            zone.maxAlpha - zone.minAlpha
          ),
          normalizedPulse
        });
      }))
    });
  }

  function getLavaGlowMapping(visualTime) {
    const normalizedPulse = getNormalizedPulse(
      visualTime,
      LAVA_GLOW_PERIOD_SECONDS
    );
    return Object.freeze({
      normalizedPulse,
      alpha: LAVA_GLOW_MIN_ALPHA + normalizedPulse * (
        LAVA_GLOW_MAX_ALPHA - LAVA_GLOW_MIN_ALPHA
      ),
      brightness: LAVA_GLOW_MIN_BRIGHTNESS + normalizedPulse * (
        LAVA_GLOW_MAX_BRIGHTNESS - LAVA_GLOW_MIN_BRIGHTNESS
      )
    });
  }

  function getEmbersMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travel = (
      (safeTime * EMBERS_RISE_SPEED) % BACKGROUND_REFERENCE.h +
      BACKGROUND_REFERENCE.h
    ) % BACKGROUND_REFERENCE.h;
    const offsetX = Math.sin(
      safeTime * Math.PI * 2 / EMBERS_X_PERIOD_SECONDS
    ) * EMBERS_X_AMPLITUDE;
    const offsetY = -travel;
    const firstX = offsetX >= 0
      ? offsetX - BACKGROUND_REFERENCE.w
      : offsetX;
    const rows = [offsetY, offsetY + BACKGROUND_REFERENCE.h];
    const columns = [firstX, firstX + BACKGROUND_REFERENCE.w];
    return Object.freeze({
      offsetX,
      offsetY,
      destinations: Object.freeze(rows.flatMap(y => columns.map(x => (
        Object.freeze({
          x: x * mapping.scaleX,
          y: y * mapping.scaleY,
          w: mapping.destination.w,
          h: mapping.destination.h
        })
      ))))
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

  function drawSmokeGlowZones(context, glowZones) {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const zone of glowZones) {
      const gradient = context.createRadialGradient(
        zone.x,
        zone.y,
        0,
        zone.x,
        zone.y,
        zone.radius
      );
      gradient.addColorStop(0, "rgba(255, 132, 52, 0.95)");
      gradient.addColorStop(0.48, "rgba(255, 72, 24, 0.42)");
      gradient.addColorStop(1, "rgba(255, 40, 12, 0)");
      context.globalAlpha = zone.alpha;
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawBackground(context, width, height, visualTime = 0) {
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawBackgroundLayer(context, "skyBase", mapping);
    if (isBackgroundLayerReady("smoke")) {
      const smoke = getSmokeMapping(visualTime, mapping);
      for (const destination of smoke.destinations) {
        drawBackgroundLayer(context, "smoke", mapping, destination);
      }
      drawSmokeGlowZones(context, smoke.glowZones);
    }
    drawBackgroundLayer(context, "landscape", mapping);
    if (isBackgroundLayerReady("lavaGlow")) {
      const lavaGlow = getLavaGlowMapping(visualTime);
      context.save();
      context.globalAlpha = lavaGlow.alpha;
      context.filter = `brightness(${lavaGlow.brightness})`;
      drawBackgroundLayer(context, "lavaGlow", mapping);
      context.restore();
    }
    if (isBackgroundLayerReady("embers")) {
      const embers = getEmbersMapping(visualTime, mapping);
      for (const destination of embers.destinations) {
        drawBackgroundLayer(context, "embers", mapping, destination);
      }
    }
    context.restore();
    return true;
  }

  function hasValidLavaHazardSize(name) {
    const image = lavaHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === LAVA_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === LAVA_HAZARD_CONTRACT.native.h
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
      surface.width = LAVA_HAZARD_CONTRACT.native.w;
      surface.height = LAVA_HAZARD_CONTRACT.native.h;
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
    const usage = lavaHazardAlphaUsage[name];
    return Boolean(usage?.hasVisiblePixels && usage.hasTransparentPixels);
  }

  function loadLavaHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    lavaHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidLavaHazardSize(name);
        if (validSize && name !== "base") {
          lavaHazardAlphaUsage[name] = analyzeAlphaUsage(image);
        }
        resolve(validSize && (name === "base" || hasValidWaveAlpha(name)));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(LAVA_HAZARD_PATHS)) {
    loadLavaHazardAsset(name, path);
  }
  const lavaHazardReadyPromise = Promise.all(
    Object.values(lavaHazardAssets).map(record => record.ready)
  ).then(results => results.every(Boolean));

  function isLavaHazardReady() {
    return Object.keys(LAVA_HAZARD_PATHS).every(
      hasValidLavaHazardSize
    ) && hasValidWaveAlpha("wave01") && hasValidWaveAlpha("wave02");
  }

  function getSignedWrappedOffset(visualTime, speed, width) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const distance = Math.abs(safeTime * speed) % width;
    return Math.sign(speed) * distance;
  }

  function getWrappedLavaDestinations(rect, offsetX, offsetY) {
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

  function getLavaHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.w !== LAVA_HAZARD_CONTRACT.runtime.w ||
      rect.h !== LAVA_HAZARD_CONTRACT.runtime.h
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
      source: LAVA_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      wave01: Object.freeze({
        offsetX: wave01OffsetX,
        offsetY: wave01OffsetY,
        destinations: getWrappedLavaDestinations(
          rect,
          wave01OffsetX,
          wave01OffsetY
        )
      }),
      wave02: Object.freeze({
        offsetX: wave02OffsetX,
        offsetY: wave02OffsetY,
        destinations: getWrappedLavaDestinations(
          rect,
          wave02OffsetX,
          wave02OffsetY
        )
      })
    });
  }

  function drawLavaHazardLayer(context, name, source, destination) {
    context.drawImage(
      lavaHazardAssets[name].image,
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
    if (!context || !isLavaHazardReady()) return false;
    const mapping = getLavaHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawLavaHazardLayer(context, "base", mapping.source, mapping.base);
    for (const destination of mapping.wave01.destinations) {
      drawLavaHazardLayer(context, "wave01", mapping.source, destination);
    }
    for (const destination of mapping.wave02.destinations) {
      drawLavaHazardLayer(context, "wave02", mapping.source, destination);
    }
    context.restore();
    return true;
  }

  const volcanoVisuals = Object.freeze({
    ...volcanoPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getBackgroundMapping,
    getSmokeMapping,
    getLavaGlowMapping,
    getEmbersMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      essentialLayers: ESSENTIAL_BACKGROUND_LAYERS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(BACKGROUND_PATHS).map(name => [
          name,
          hasValidBackgroundSize(name)
        ])
      )),
      layerReady: Object.freeze(Object.fromEntries(
        Object.keys(BACKGROUND_PATHS).map(name => [
          name,
          isBackgroundLayerReady(name)
        ])
      )),
      alphaUsage: Object.freeze({...backgroundAlphaUsage}),
      smokeAnimation: Object.freeze({
        xAmplitude: SMOKE_X_AMPLITUDE,
        xPeriodSeconds: SMOKE_X_PERIOD_SECONDS,
        yAmplitude: SMOKE_Y_AMPLITUDE,
        yPeriodSeconds: SMOKE_Y_PERIOD_SECONDS,
        yPhase: SMOKE_Y_PHASE,
        glowZones: SMOKE_GLOW_ZONES
      }),
      lavaGlowAnimation: Object.freeze({
        periodSeconds: LAVA_GLOW_PERIOD_SECONDS,
        minAlpha: LAVA_GLOW_MIN_ALPHA,
        maxAlpha: LAVA_GLOW_MAX_ALPHA,
        minBrightness: LAVA_GLOW_MIN_BRIGHTNESS,
        maxBrightness: LAVA_GLOW_MAX_BRIGHTNESS
      }),
      embersAnimation: Object.freeze({
        riseSpeed: EMBERS_RISE_SPEED,
        xAmplitude: EMBERS_X_AMPLITUDE,
        xPeriodSeconds: EMBERS_X_PERIOD_SECONDS,
        wrapCopies: 4
      })
    }),
    whenLavaHazardReady: () => lavaHazardReadyPromise,
    isLavaHazardReady,
    getLavaHazardMapping,
    drawBottomDeathHazard,
    getLavaHazardStatus: () => Object.freeze({
      ready: isLavaHazardReady(),
      paths: LAVA_HAZARD_PATHS,
      contract: LAVA_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(LAVA_HAZARD_PATHS).map(name => [
          name,
          hasValidLavaHazardSize(name)
        ])
      )),
      waveAlphaUsage: Object.freeze({...lavaHazardAlphaUsage})
    })
  });
  BIOME_PLATFORM_VISUALS.register("volcano", volcanoVisuals);
  return volcanoVisuals;
})();
