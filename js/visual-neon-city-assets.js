"use strict";

const NEON_CITY_ASSET_VISUALS = (() => {
  const supportsLazyLoading =
    typeof BIOME_PLATFORM_VISUALS.registerLazy === "function" &&
    typeof BIOME_PLATFORM_VISUALS.createAssetLoader === "function";
  const neonCityPlatformVisuals = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.registerLazy("neonCity")
    : BIOME_PLATFORM_VISUALS.resolve("neonCity");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox:
      "assets/environments/neonCity/background/neonCity_background_skybox.png",
    cityBack:
      "assets/environments/neonCity/background/neonCity_background_city_back.png",
    clouds:
      "assets/environments/neonCity/background/neonCity_background_clouds.png",
    cityFront:
      "assets/environments/neonCity/background/neonCity_background_city_front.png"
  });
  const BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "cityBack",
    "clouds",
    "cityFront"
  ]);
  const CLOUDS_LEFT_SPEED = 6;
  const CLOUDS_WRAP_OVERLAP = 186;
  const CLOUDS_ALPHA_BOUNDS = Object.freeze({x: 119, y: 29, w: 1082, h: 553});
  const CLOUDS_TRANSPARENT_MARGINS = Object.freeze({
    left: 119,
    right: 79,
    top: 29,
    bottom: 138
  });
  const CLOUDS_MAX_INTERNAL_TRANSPARENT_COLUMN_GAP = 12;
  const NEON_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({x: 235, y: 690, w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const NEON_HAZARD_PATHS = Object.freeze({
    base:
      "assets/environments/neonCity/hazards/neonCity_hazard_laser_base.png",
    spiral:
      "assets/environments/neonCity/hazards/neonCity_hazard_laser_spiral.png"
  });
  const SPIRAL_LEFT_SPEED = 24;
  const SPIRAL_NATIVE_WRAP_OVERLAP = 32;
  const SPIRAL_ALPHA = 0.95;
  const LASER_PULSE_PERIOD_SECONDS = 1.5;
  const LASER_PULSE_MINIMUM_ALPHA = 0.55;
  const LASER_PULSE_PHASE = 0.55;
  const GLOW_COMPOSITE_OPERATION = "screen";
  const GLOW_INNER_STOP = 0.24;
  const GLOW_INNER_ALPHA_FACTOR = 0.88;
  const GLOW_MIDDLE_STOP = 0.68;
  const GLOW_MIDDLE_ALPHA_FACTOR = 0.46;
  const FLICKER_GAP_MIN_SECONDS = 1.8;
  const FLICKER_GAP_MAX_SECONDS = 6.5;
  const FLICKER_DURATION_MIN_SECONDS = 0.045;
  const FLICKER_DURATION_MAX_SECONDS = 0.120;
  const FLICKER_EVENTS_PER_ZONE = 8;
  const backgroundAssets = {};
  const neonHazardAssets = {};

  const BACK_WINDOW_GLOWS = Object.freeze([
    Object.freeze({x: 158, y: 286, radiusX: 39, radiusY: 25, color: "#22e8ff", strength: 0.26, minimumFactor: 0.24, period: 5.9, phase: 0.2}),
    Object.freeze({x: 196, y: 360, radiusX: 29, radiusY: 39, color: "#ff42d0", strength: 0.28, minimumFactor: 0.22, period: 5.4, phase: 1.1}),
    Object.freeze({x: 339, y: 315, radiusX: 33, radiusY: 24, color: "#31dcff", strength: 0.24, minimumFactor: 0.30, period: 6.2, phase: 2.0}),
    Object.freeze({x: 429, y: 373, radiusX: 27, radiusY: 35, color: "#36efff", strength: 0.23, minimumFactor: 0.26, period: 5.7, phase: 3.0}),
    Object.freeze({x: 548, y: 258, radiusX: 46, radiusY: 30, color: "#36dfff", strength: 0.34, minimumFactor: 0.24, period: 6.4, phase: 4.0}),
    Object.freeze({x: 555, y: 211, radiusX: 31, radiusY: 43, color: "#ff38d4", strength: 0.34, minimumFactor: 0.20, period: 5.8, phase: 5.1}),
    Object.freeze({x: 721, y: 249, radiusX: 39, radiusY: 47, color: "#28dfff", strength: 0.30, minimumFactor: 0.28, period: 6.1, phase: 0.7}),
    Object.freeze({x: 723, y: 343, radiusX: 44, radiusY: 34, color: "#ff42d4", strength: 0.32, minimumFactor: 0.22, period: 5.5, phase: 1.8}),
    Object.freeze({x: 990, y: 327, radiusX: 40, radiusY: 27, color: "#25e6ff", strength: 0.28, minimumFactor: 0.30, period: 6.3, phase: 2.9}),
    Object.freeze({x: 1108, y: 455, radiusX: 28, radiusY: 23, color: "#28ddff", strength: 0.23, minimumFactor: 0.28, period: 5.6, phase: 4.2}),
    Object.freeze({x: 1160, y: 476, radiusX: 28, radiusY: 24, color: "#ff48d8", strength: 0.26, minimumFactor: 0.20, period: 5.2, phase: 5.3}),
    Object.freeze({x: 381, y: 493, radiusX: 27, radiusY: 22, color: "#2caeff", strength: 0.22, minimumFactor: 0.32, period: 6.5, phase: 0.9}),
    Object.freeze({x: 650, y: 482, radiusX: 26, radiusY: 22, color: "#37f0d0", strength: 0.22, minimumFactor: 0.30, period: 6.0, phase: 2.4}),
    Object.freeze({x: 862, y: 497, radiusX: 27, radiusY: 23, color: "#b44dff", strength: 0.25, minimumFactor: 0.24, period: 5.3, phase: 3.7})
  ]);

  const FRONT_WINDOW_GLOWS = Object.freeze([
    Object.freeze({x: 165, y: 359, radiusX: 58, radiusY: 41, color: "#ff42db", strength: 0.52, minimumFactor: 0.20, period: 4.8, phase: 0.3}),
    Object.freeze({x: 164, y: 462, radiusX: 38, radiusY: 53, color: "#2cefff", strength: 0.49, minimumFactor: 0.24, period: 5.3, phase: 1.2}),
    Object.freeze({x: 444, y: 289, radiusX: 36, radiusY: 60, color: "#ff3fd5", strength: 0.58, minimumFactor: 0.16, period: 4.6, phase: 2.1}),
    Object.freeze({x: 458, y: 202, radiusX: 41, radiusY: 55, color: "#27e7ff", strength: 0.51, minimumFactor: 0.22, period: 5.1, phase: 3.0}),
    Object.freeze({x: 421, y: 405, radiusX: 53, radiusY: 34, color: "#31f0df", strength: 0.49, minimumFactor: 0.26, period: 5.6, phase: 4.2}),
    Object.freeze({x: 630, y: 347, radiusX: 53, radiusY: 38, color: "#d94cff", strength: 0.47, minimumFactor: 0.18, period: 5.0, phase: 5.1}),
    Object.freeze({x: 671, y: 437, radiusX: 36, radiusY: 48, color: "#c94cff", strength: 0.46, minimumFactor: 0.20, period: 4.7, phase: 0.8}),
    Object.freeze({x: 816, y: 448, radiusX: 48, radiusY: 36, color: "#2cecff", strength: 0.52, minimumFactor: 0.24, period: 5.4, phase: 1.7}),
    Object.freeze({x: 1008, y: 369, radiusX: 45, radiusY: 52, color: "#34cfff", strength: 0.49, minimumFactor: 0.26, period: 5.8, phase: 2.8}),
    Object.freeze({x: 1048, y: 520, radiusX: 48, radiusY: 38, color: "#ff41db", strength: 0.57, minimumFactor: 0.16, period: 4.5, phase: 3.9}),
    Object.freeze({x: 1116, y: 353, radiusX: 56, radiusY: 41, color: "#ef43dc", strength: 0.54, minimumFactor: 0.18, period: 5.2, phase: 4.8}),
    Object.freeze({x: 1128, y: 412, radiusX: 41, radiusY: 51, color: "#2cecff", strength: 0.51, minimumFactor: 0.24, period: 5.5, phase: 5.7}),
    Object.freeze({x: 1218, y: 520, radiusX: 38, radiusY: 53, color: "#27e8ff", strength: 0.47, minimumFactor: 0.22, period: 4.9, phase: 2.5})
  ]);

  const FLICKER_ZONES = Object.freeze([
    Object.freeze({x: 164, y: 463, radiusX: 15, radiusY: 82, rotation: 0, color: "#2cefff", strength: 0.66, salt: 421}),
    Object.freeze({x: 444, y: 289, radiusX: 14, radiusY: 90, rotation: 0, color: "#ff38d4", strength: 0.78, salt: 887}),
    Object.freeze({x: 458, y: 202, radiusX: 13, radiusY: 72, rotation: -0.65, color: "#29e8ff", strength: 0.70, salt: 1291}),
    Object.freeze({x: 436, y: 504, radiusX: 33, radiusY: 49, rotation: 0, color: "#dc49ff", strength: 0.72, salt: 1877}),
    Object.freeze({x: 816, y: 448, radiusX: 38, radiusY: 27, rotation: 0, color: "#2cecff", strength: 0.68, salt: 2389}),
    Object.freeze({x: 1107, y: 509, radiusX: 14, radiusY: 54, rotation: -0.72, color: "#ff42d8", strength: 0.74, salt: 3251}),
    Object.freeze({x: 196, y: 445, radiusX: 13, radiusY: 62, rotation: -0.20, color: "#ff42d0", strength: 0.70, salt: 4051}),
    Object.freeze({x: 630, y: 347, radiusX: 38, radiusY: 25, rotation: 0, color: "#d94cff", strength: 0.72, salt: 4603}),
    Object.freeze({x: 671, y: 437, radiusX: 14, radiusY: 43, rotation: 0, color: "#c94cff", strength: 0.68, salt: 5171}),
    Object.freeze({x: 1008, y: 369, radiusX: 14, radiusY: 56, rotation: 0.28, color: "#34cfff", strength: 0.70, salt: 5801}),
    Object.freeze({x: 1128, y: 412, radiusX: 32, radiusY: 41, rotation: 0, color: "#2cecff", strength: 0.69, salt: 6421}),
    Object.freeze({x: 1218, y: 520, radiusX: 14, radiusY: 48, rotation: 0, color: "#27e8ff", strength: 0.68, salt: 7127})
  ]);

  function hasValidBackgroundSize(name) {
    const image = backgroundAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidBackgroundSize(name));
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  let backgroundReadyPromise = null;
  const backgroundLoader = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
      for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
        loadBackgroundAsset(name, path);
      }
      return Promise.all(
        Object.values(backgroundAssets).map(record => record.ready)
      ).then(() => isBackgroundReady());
    })
    : null;

  function isBackgroundReady() {
    return BACKGROUND_LAYERS.every(hasValidBackgroundSize);
  }

  function hasValidNeonHazardSize(name) {
    const image = neonHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === NEON_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === NEON_HAZARD_CONTRACT.native.h
    );
  }

  function loadNeonHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    neonHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidNeonHazardSize(name));
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  let neonHazardReadyPromise = null;
  const hazardLoader = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
      for (const [name, path] of Object.entries(NEON_HAZARD_PATHS)) {
        loadNeonHazardAsset(name, path);
      }
      return Promise.all(
        Object.values(neonHazardAssets).map(record => record.ready)
      ).then(() => isNeonHazardReady());
    })
    : null;

  function requestBackgroundAssets() {
    if (backgroundLoader) backgroundReadyPromise = backgroundLoader.request();
    return backgroundReadyPromise;
  }

  function requestHazardAssets() {
    if (hazardLoader) neonHazardReadyPromise = hazardLoader.request();
    return neonHazardReadyPromise;
  }

  if (!supportsLazyLoading) {
    for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
      loadBackgroundAsset(name, path);
    }
    backgroundReadyPromise = Promise.all(
      Object.values(backgroundAssets).map(record => record.ready)
    ).then(() => isBackgroundReady());
    for (const [name, path] of Object.entries(NEON_HAZARD_PATHS)) {
      loadNeonHazardAsset(name, path);
    }
    neonHazardReadyPromise = Promise.all(
      Object.values(neonHazardAssets).map(record => record.ready)
    ).then(() => isNeonHazardReady());
  }

  function isNeonHazardReady() {
    return Object.keys(NEON_HAZARD_PATHS).every(hasValidNeonHazardSize);
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

  function getGlowMapping(visualTime, glowMap) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return Object.freeze(glowMap.map(glow => {
      const pulse = (
        Math.sin(safeTime * Math.PI * 2 / glow.period + glow.phase) + 1
      ) * 0.5;
      const pulseFactor = glow.minimumFactor +
        pulse * (1 - glow.minimumFactor);
      return Object.freeze({...glow, alpha: glow.strength * pulseFactor});
    }));
  }

  function getCloudsMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const wrapDistance = BACKGROUND_REFERENCE.w - CLOUDS_WRAP_OVERLAP;
    const travel = (
      (safeTime * CLOUDS_LEFT_SPEED) % wrapDistance + wrapDistance
    ) % wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    return Object.freeze({
      offsetX,
      offsetY: 0,
      wrapDistance,
      destinations: Object.freeze([0, wrapDistance].map(copyOffset => (
        Object.freeze({
          x: (offsetX + copyOffset) * mapping.scaleX,
          y: 0,
          w: mapping.destination.w,
          h: mapping.destination.h
        })
      )))
    });
  }

  function getNeonHazardMapping(visualTime, rect) {
    if (
      !rect ||
      rect.x !== NEON_HAZARD_CONTRACT.runtime.x ||
      rect.y !== NEON_HAZARD_CONTRACT.runtime.y ||
      rect.w !== NEON_HAZARD_CONTRACT.runtime.w ||
      rect.h !== NEON_HAZARD_CONTRACT.runtime.h
    ) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const runtimeOverlap = SPIRAL_NATIVE_WRAP_OVERLAP *
      NEON_HAZARD_CONTRACT.nativeToRuntimeScale;
    const wrapDistance = rect.w - runtimeOverlap;
    const travel = (
      (safeTime * SPIRAL_LEFT_SPEED) % wrapDistance + wrapDistance
    ) % wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    const basePulse = (
      Math.sin(
        safeTime * Math.PI * 2 / LASER_PULSE_PERIOD_SECONDS +
        LASER_PULSE_PHASE
      ) + 1
    ) * 0.5;
    const baseAlpha = LASER_PULSE_MINIMUM_ALPHA +
      basePulse * (1 - LASER_PULSE_MINIMUM_ALPHA);
    return Object.freeze({
      source: NEON_HAZARD_CONTRACT.native,
      axisY: rect.y + rect.h / 2,
      base: Object.freeze({
        alpha: baseAlpha,
        offsetX: 0,
        offsetY: 0,
        destination: Object.freeze({
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h
        })
      }),
      spiral: Object.freeze({
        alpha: SPIRAL_ALPHA,
        offsetX,
        offsetY: 0,
        wrapDistance,
        destinations: Object.freeze([0, wrapDistance].map(copyOffset => (
          Object.freeze({
            x: rect.x + offsetX + copyOffset,
            y: rect.y,
            w: rect.w,
            h: rect.h
          })
        )))
      })
    });
  }

  function deterministicUnit(salt, eventIndex, channel) {
    let value = (
      salt ^ Math.imul(eventIndex + 1, 0x45d9f3b) ^
      Math.imul(channel + 1, 0x27d4eb2d)
    ) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
    value = (value ^ (value >>> 16)) >>> 0;
    return value / 0x100000000;
  }

  function createFlickerSchedule(zone) {
    let cursor = 0;
    const events = [];
    for (let index = 0; index < FLICKER_EVENTS_PER_ZONE; index += 1) {
      const gap = FLICKER_GAP_MIN_SECONDS +
        deterministicUnit(zone.salt, index, 0) *
          (FLICKER_GAP_MAX_SECONDS - FLICKER_GAP_MIN_SECONDS);
      const duration = FLICKER_DURATION_MIN_SECONDS +
        deterministicUnit(zone.salt, index, 1) *
          (FLICKER_DURATION_MAX_SECONDS - FLICKER_DURATION_MIN_SECONDS);
      const dipCount = 1 + Math.floor(
        deterministicUnit(zone.salt, index, 2) * 3
      );
      const dipDepth = 0.72 + deterministicUnit(zone.salt, index, 3) * 0.23;
      const start = cursor + gap;
      events.push(Object.freeze({start, duration, dipCount, dipDepth}));
      cursor = start + duration;
    }
    const trailingGap = FLICKER_GAP_MIN_SECONDS +
      deterministicUnit(zone.salt, FLICKER_EVENTS_PER_ZONE, 0) *
        (FLICKER_GAP_MAX_SECONDS - FLICKER_GAP_MIN_SECONDS);
    return Object.freeze({
      cycleDuration: cursor + trailingGap,
      events: Object.freeze(events)
    });
  }

  const FLICKER_SCHEDULES = Object.freeze(
    FLICKER_ZONES.map(createFlickerSchedule)
  );

  function getFlickerMapping(visualTime) {
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    return Object.freeze(FLICKER_ZONES.map((zone, zoneIndex) => {
      const schedule = FLICKER_SCHEDULES[zoneIndex];
      const cycleTime = safeTime % schedule.cycleDuration;
      let brightnessFactor = 1;
      let active = false;
      for (const event of schedule.events) {
        if (
          cycleTime < event.start ||
          cycleTime >= event.start + event.duration
        ) continue;
        const progress = (cycleTime - event.start) / event.duration;
        const dipWave = Math.sin(progress * Math.PI * event.dipCount) ** 2;
        brightnessFactor = 1 - event.dipDepth * dipWave;
        active = true;
        break;
      }
      return Object.freeze({
        ...zone,
        active,
        brightnessFactor,
        alpha: zone.strength * brightnessFactor
      });
    }));
  }

  function colorWithAlpha(color, alpha) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const safeAlpha = Math.max(0, Math.min(1, alpha));
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }

  function drawLocalGlow(context, glow) {
    context.save();
    context.translate(glow.x, glow.y);
    if (glow.rotation) context.rotate(glow.rotation);
    context.scale(glow.radiusX, glow.radiusY);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, colorWithAlpha(glow.color, glow.alpha));
    gradient.addColorStop(
      GLOW_INNER_STOP,
      colorWithAlpha(glow.color, glow.alpha * GLOW_INNER_ALPHA_FACTOR)
    );
    gradient.addColorStop(
      GLOW_MIDDLE_STOP,
      colorWithAlpha(glow.color, glow.alpha * GLOW_MIDDLE_ALPHA_FACTOR)
    );
    gradient.addColorStop(1, colorWithAlpha(glow.color, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawGlowMapping(context, mapping, glowMapping) {
    context.save();
    context.globalCompositeOperation = GLOW_COMPOSITE_OPERATION;
    context.scale(mapping.scaleX, mapping.scaleY);
    for (const glow of glowMapping) drawLocalGlow(context, glow);
    context.restore();
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

  function drawBackground(context, width, height, visualTime = 0) {
    requestBackgroundAssets();
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    drawBackgroundLayer(context, "skybox", mapping);
    drawBackgroundLayer(context, "cityBack", mapping);
    drawGlowMapping(
      context,
      mapping,
      getGlowMapping(visualTime, BACK_WINDOW_GLOWS)
    );
    const clouds = getCloudsMapping(visualTime, mapping);
    for (const destination of clouds.destinations) {
      drawBackgroundLayer(context, "clouds", mapping, destination);
    }
    drawBackgroundLayer(context, "cityFront", mapping);
    drawGlowMapping(
      context,
      mapping,
      getGlowMapping(visualTime, FRONT_WINDOW_GLOWS)
    );
    drawGlowMapping(context, mapping, getFlickerMapping(visualTime));
    context.restore();
    return true;
  }

  function drawNeonHazardLayer(context, name, source, destination) {
    context.drawImage(
      neonHazardAssets[name].image,
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
    requestHazardAssets();
    if (!context || !isNeonHazardReady()) return false;
    const mapping = getNeonHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = mapping.base.alpha;
    drawNeonHazardLayer(
      context,
      "base",
      mapping.source,
      mapping.base.destination
    );
    context.globalCompositeOperation = "screen";
    context.globalAlpha = mapping.spiral.alpha;
    for (const destination of mapping.spiral.destinations) {
      drawNeonHazardLayer(context, "spiral", mapping.source, destination);
    }
    context.restore();
    return true;
  }

  const neonCityVisuals = Object.freeze({
    ...neonCityPlatformVisuals,
    requestBackgroundAssets,
    whenBackgroundReady: requestBackgroundAssets,
    isBackgroundReady,
    getBackgroundMapping,
    getCloudsMapping,
    getBackWindowGlowMapping: visualTime => (
      getGlowMapping(visualTime, BACK_WINDOW_GLOWS)
    ),
    getFrontWindowGlowMapping: visualTime => (
      getGlowMapping(visualTime, FRONT_WINDOW_GLOWS)
    ),
    getFlickerMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      validNativeSizes: Object.freeze(Object.fromEntries(
        BACKGROUND_LAYERS.map(name => [name, hasValidBackgroundSize(name)])
      )),
      layerOrder: Object.freeze([
        "skybox",
        "cityBack",
        "backWindowGlows",
        "clouds",
        "cityFront",
        "frontWindowGlows",
        "frontNeonFlicker"
      ]),
      cloudsAsset: Object.freeze({
        alphaBounds: CLOUDS_ALPHA_BOUNDS,
        transparentMargins: CLOUDS_TRANSPARENT_MARGINS,
        maxInternalTransparentColumnGap:
          CLOUDS_MAX_INTERNAL_TRANSPARENT_COLUMN_GAP
      }),
      cloudsAnimation: Object.freeze({
        leftSpeed: CLOUDS_LEFT_SPEED,
        ySpeed: 0,
        direction: "right-to-left",
        motion: "linear",
        wrapDistance: BACKGROUND_REFERENCE.w - CLOUDS_WRAP_OVERLAP,
        overlap: CLOUDS_WRAP_OVERLAP,
        drawCopies: 2,
        wrapMode: "horizontal-continuous"
      }),
      backWindowGlows: BACK_WINDOW_GLOWS,
      frontWindowGlows: FRONT_WINDOW_GLOWS,
      glowAnimation: Object.freeze({
        backCount: BACK_WINDOW_GLOWS.length,
        frontCount: FRONT_WINDOW_GLOWS.length,
        totalCount: BACK_WINDOW_GLOWS.length + FRONT_WINDOW_GLOWS.length,
        compositeOperation: GLOW_COMPOSITE_OPERATION,
        innerColorStopPosition: GLOW_INNER_STOP,
        innerColorStopAlphaFactor: GLOW_INNER_ALPHA_FACTOR,
        middleColorStopPosition: GLOW_MIDDLE_STOP,
        middleColorStopAlphaFactor: GLOW_MIDDLE_ALPHA_FACTOR,
        pulseMinimumFactorRange: Object.freeze([0.16, 0.32]),
        periodRangeSeconds: Object.freeze([4.5, 6.5]),
        profiles: Object.freeze({
          back: Object.freeze({
            strengthRange: Object.freeze([0.22, 0.34]),
            periodRangeSeconds: Object.freeze([5.2, 6.5]),
            pulseMinimumFactorRange: Object.freeze([0.20, 0.32])
          }),
          front: Object.freeze({
            strengthRange: Object.freeze([0.46, 0.58]),
            periodRangeSeconds: Object.freeze([4.5, 5.8]),
            pulseMinimumFactorRange: Object.freeze([0.16, 0.26])
          })
        }),
        deterministic: true
      }),
      flickerZones: FLICKER_ZONES,
      flickerAnimation: Object.freeze({
        count: FLICKER_ZONES.length,
        deterministic: true,
        gapRangeSeconds: Object.freeze([
          FLICKER_GAP_MIN_SECONDS,
          FLICKER_GAP_MAX_SECONDS
        ]),
        durationRangeSeconds: Object.freeze([
          FLICKER_DURATION_MIN_SECONDS,
          FLICKER_DURATION_MAX_SECONDS
        ]),
        dipCountRange: Object.freeze([1, 3]),
        peakDipDepthRange: Object.freeze([0.72, 0.95]),
        strengthRange: Object.freeze([0.66, 0.78]),
        eventsPerZone: FLICKER_EVENTS_PER_ZONE,
        schedules: FLICKER_SCHEDULES,
        behavior: "normally-bright-short-local-dips",
        drawOrder: "after-front-window-glows"
      })
    }),
    requestHazardAssets,
    whenNeonHazardReady: requestHazardAssets,
    isNeonHazardReady,
    getNeonHazardMapping,
    drawBottomDeathHazard,
    getNeonHazardStatus: () => Object.freeze({
      ready: isNeonHazardReady(),
      paths: NEON_HAZARD_PATHS,
      contract: NEON_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(NEON_HAZARD_PATHS).map(name => [
          name,
          hasValidNeonHazardSize(name)
        ])
      )),
      animation: Object.freeze({
        drawOrder: Object.freeze(["laserBase", "spiral"]),
        axisOffsetY: NEON_HAZARD_CONTRACT.runtime.h / 2,
        spiral: Object.freeze({
          leftSpeed: SPIRAL_LEFT_SPEED,
          ySpeed: 0,
          alpha: SPIRAL_ALPHA,
          nativeWrapOverlap: SPIRAL_NATIVE_WRAP_OVERLAP,
          runtimeWrapOverlap: SPIRAL_NATIVE_WRAP_OVERLAP *
            NEON_HAZARD_CONTRACT.nativeToRuntimeScale,
          wrapDistance: NEON_HAZARD_CONTRACT.runtime.w -
            SPIRAL_NATIVE_WRAP_OVERLAP *
              NEON_HAZARD_CONTRACT.nativeToRuntimeScale,
          drawCopies: 2,
          direction: "right-to-left",
          wrapMode: "horizontal-continuous-full-png",
          fullAsset: true,
          segmented: false,
          rotation: 0,
          compositeOperation: "screen"
        }),
        laserPulse: Object.freeze({
          periodSeconds: LASER_PULSE_PERIOD_SECONDS,
          minimumAlpha: LASER_PULSE_MINIMUM_ALPHA,
          maximumAlpha: 1,
          phase: LASER_PULSE_PHASE,
          xMovement: 0,
          yMovement: 0,
          rotation: 0,
          compositeOperation: "source-over"
        }),
        deterministic: true
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("neonCity", neonCityVisuals);
  return neonCityVisuals;
})();
