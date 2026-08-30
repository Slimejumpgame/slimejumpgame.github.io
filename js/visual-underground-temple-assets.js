"use strict";

const UNDERGROUND_TEMPLE_ASSET_VISUALS = (() => {
  const undergroundTemplePlatformVisuals =
    BIOME_PLATFORM_VISUALS.resolve("undergroundTemple");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    back:
      "assets/environments/undergroundTemple/background/undergroundTemple_background_back.png",
    godRay:
      "assets/environments/undergroundTemple/background/undergroundTemple_background_godray.png",
    pedestal:
      "assets/environments/undergroundTemple/background/undergroundTemple_background_pedestal.png",
    depth:
      "assets/environments/undergroundTemple/background/undergroundTemple_background_depth.png",
    front:
      "assets/environments/undergroundTemple/background/undergroundTemple_background_front.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "back",
    "godRay",
    "pedestal",
    "depth",
    "front"
  ]);
  const HAZARD_CONTRACT = Object.freeze({
    path:
      "assets/environments/undergroundTemple/hazards/undergroundTemple_hazard_back.png",
    native: Object.freeze({w: 1650, h: 60}),
    source: Object.freeze({x: 0, y: 0, w: 1650, h: 60}),
    destination: Object.freeze({x: 235, y: 690, w: 825, h: 30})
  });
  const BASE_LAYER_ORDER = Object.freeze([
    "back",
    "god-ray",
    "pedestal-and-golden-statue",
    "depth",
    "front",
    "gameplay"
  ]);
  const RENDER_ORDER = Object.freeze([
    "back",
    "back-rune-glows",
    "god-ray",
    "pedestal-and-golden-statue",
    "pedestal-rune-glows",
    "golden-statue-fireflies",
    "depth",
    "front",
    "gameplay"
  ]);
  const GOD_RAY_ANIMATION = Object.freeze({
    alphaMin: 0.76,
    alphaMax: 0.84,
    periodSeconds: 6.2,
    phase: 0
  });
  const GLOW_INNER_STOP_POSITION = 0.2;
  const GLOW_INNER_STOP_ALPHA_FACTOR = 0.94;
  const GLOW_MIDDLE_STOP_POSITION = 0.62;
  const GLOW_MIDDLE_STOP_ALPHA_FACTOR = 0.70;
  const BACK_RUNE_GLOWS = Object.freeze([
    Object.freeze({x: 195, y: 270, radius: 44, color: "#35f1e2", alphaMin: 0.20, alphaMax: 0.46, period: 5.4, phase: 0.2}),
    Object.freeze({x: 430, y: 270, radius: 44, color: "#48e9e2", alphaMin: 0.21, alphaMax: 0.49, period: 6.1, phase: 1.1}),
    Object.freeze({x: 853, y: 270, radius: 44, color: "#2ef3e5", alphaMin: 0.20, alphaMax: 0.48, period: 5.8, phase: 2.4}),
    Object.freeze({x: 1107, y: 270, radius: 44, color: "#47f0dd", alphaMin: 0.21, alphaMax: 0.46, period: 6.5, phase: 3.5}),
    Object.freeze({x: 201, y: 480, radius: 45, color: "#39eed9", alphaMin: 0.20, alphaMax: 0.48, period: 6.3, phase: 4.2}),
    Object.freeze({x: 459, y: 480, radius: 44, color: "#34f3e7", alphaMin: 0.21, alphaMax: 0.49, period: 5.7, phase: 5.1}),
    Object.freeze({x: 651, y: 480, radius: 45, color: "#42eae7", alphaMin: 0.20, alphaMax: 0.46, period: 6.7, phase: 0.8}),
    Object.freeze({x: 846, y: 480, radius: 45, color: "#32efe3", alphaMin: 0.21, alphaMax: 0.48, period: 5.9, phase: 2.0}),
    Object.freeze({x: 1123, y: 480, radius: 46, color: "#43f0de", alphaMin: 0.20, alphaMax: 0.49, period: 6.4, phase: 3.2})
  ]);
  const PEDESTAL_RUNE_GLOWS = Object.freeze([
    Object.freeze({x: 641, y: 357, radius: 47, color: "#38eee7", alphaMin: 0.23, alphaMax: 0.53, period: 5.2, phase: 0.5}),
    Object.freeze({x: 610, y: 400, radius: 29, color: "#2cefe8", alphaMin: 0.24, alphaMax: 0.54, period: 5.8, phase: 1.8}),
    Object.freeze({x: 672, y: 400, radius: 29, color: "#37e9e5", alphaMin: 0.24, alphaMax: 0.54, period: 6.2, phase: 3.0}),
    Object.freeze({x: 641, y: 499, radius: 38, color: "#2df4e8", alphaMin: 0.23, alphaMax: 0.55, period: 5.5, phase: 4.3}),
    Object.freeze({x: 641, y: 579, radius: 47, color: "#32f0e5", alphaMin: 0.23, alphaMax: 0.56, period: 6.0, phase: 5.4})
  ]);
  const FIREFLY_PULSE_MINIMUM_FACTOR = 0.42;
  const FIREFLIES = Object.freeze([
    Object.freeze({x: 544, y: 350, radius: 4.2, color: "#ffd45d", alpha: 0.76, driftAmplitudeX: 10, driftPeriodX: 17, driftAmplitudeY: 7, driftPeriodY: 12, driftPhase: 0.2, pulsePeriod: 4.1, pulsePhase: 0.6}),
    Object.freeze({x: 570, y: 310, radius: 3.8, color: "#ffe27a", alpha: 0.72, driftAmplitudeX: 12, driftPeriodX: 20, driftAmplitudeY: 8, driftPeriodY: 14, driftPhase: 1.0, pulsePeriod: 4.8, pulsePhase: 1.7}),
    Object.freeze({x: 610, y: 292, radius: 4.5, color: "#ffc94f", alpha: 0.80, driftAmplitudeX: 9, driftPeriodX: 18, driftAmplitudeY: 6, driftPeriodY: 11, driftPhase: 2.1, pulsePeriod: 3.9, pulsePhase: 3.0}),
    Object.freeze({x: 670, y: 295, radius: 4.0, color: "#ffdc66", alpha: 0.75, driftAmplitudeX: 11, driftPeriodX: 21, driftAmplitudeY: 7, driftPeriodY: 13, driftPhase: 3.0, pulsePeriod: 5.2, pulsePhase: 4.2}),
    Object.freeze({x: 711, y: 330, radius: 4.8, color: "#ffc247", alpha: 0.82, driftAmplitudeX: 13, driftPeriodX: 19, driftAmplitudeY: 8, driftPeriodY: 15, driftPhase: 4.0, pulsePeriod: 4.4, pulsePhase: 5.1}),
    Object.freeze({x: 738, y: 380, radius: 3.7, color: "#ffe17a", alpha: 0.70, driftAmplitudeX: 9, driftPeriodX: 16, driftAmplitudeY: 6, driftPeriodY: 10, driftPhase: 5.0, pulsePeriod: 3.7, pulsePhase: 0.9}),
    Object.freeze({x: 729, y: 445, radius: 4.4, color: "#ffce52", alpha: 0.78, driftAmplitudeX: 12, driftPeriodX: 22, driftAmplitudeY: 9, driftPeriodY: 14, driftPhase: 5.7, pulsePeriod: 5.0, pulsePhase: 2.2}),
    Object.freeze({x: 696, y: 475, radius: 5.0, color: "#ffbd3f", alpha: 0.84, driftAmplitudeX: 14, driftPeriodX: 23, driftAmplitudeY: 8, driftPeriodY: 16, driftPhase: 0.7, pulsePeriod: 4.6, pulsePhase: 3.7}),
    Object.freeze({x: 586, y: 475, radius: 4.6, color: "#ffd967", alpha: 0.79, driftAmplitudeX: 13, driftPeriodX: 20, driftAmplitudeY: 7, driftPeriodY: 13, driftPhase: 1.8, pulsePeriod: 5.4, pulsePhase: 4.8}),
    Object.freeze({x: 548, y: 430, radius: 3.9, color: "#ffc84c", alpha: 0.73, driftAmplitudeX: 10, driftPeriodX: 18, driftAmplitudeY: 9, driftPeriodY: 15, driftPhase: 3.4, pulsePeriod: 4.2, pulsePhase: 5.6})
  ]);
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const hazardAsset = {image: null, ready: null};
  const colorChannelCache = new Map();

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
      name === "back" || hasValidBackgroundAlpha(name)
    );
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidBackgroundSize(name);
        if (validSize && name !== "back") {
          backgroundAlphaUsage[name] = analyzeBackgroundAlphaUsage(image);
        }
        resolve(isBackgroundLayerReady(name));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
    loadBackgroundAsset(name, path);
  }

  function isBackgroundReady() {
    return ESSENTIAL_BACKGROUND_LAYERS.every(isBackgroundLayerReady);
  }

  const backgroundReadyPromise = Promise.all(
    Object.values(backgroundAssets).map(record => record.ready)
  ).then(() => isBackgroundReady());

  function hasValidHazardSize() {
    const image = hazardAsset.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === HAZARD_CONTRACT.native.w &&
      image.naturalHeight === HAZARD_CONTRACT.native.h
    );
  }

  function loadHazardAsset() {
    const image = new Image();
    hazardAsset.image = image;
    hazardAsset.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidHazardSize());
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = HAZARD_CONTRACT.path;
  }

  loadHazardAsset();

  function isHazardReady() {
    return hasValidHazardSize();
  }

  const hazardReadyPromise = hazardAsset.ready.then(() => isHazardReady());

  function getColorChannels(hexColor) {
    const cached = colorChannelCache.get(hexColor);
    if (cached) return cached;
    const value = Number.parseInt(hexColor.slice(1), 16);
    const channels = Object.freeze({
      r: value >> 16 & 0xff,
      g: value >> 8 & 0xff,
      b: value & 0xff
    });
    colorChannelCache.set(hexColor, channels);
    return channels;
  }

  function getGodRayAlpha(visualTime = 0) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const pulse = (
      Math.sin(
        safeTime * Math.PI * 2 / GOD_RAY_ANIMATION.periodSeconds +
          GOD_RAY_ANIMATION.phase
      ) + 1
    ) / 2;
    return GOD_RAY_ANIMATION.alphaMin +
      (GOD_RAY_ANIMATION.alphaMax - GOD_RAY_ANIMATION.alphaMin) * pulse;
  }

  function getGlowAlpha(glow, visualTime) {
    const pulse = (
      Math.sin(visualTime * Math.PI * 2 / glow.period + glow.phase) + 1
    ) / 2;
    return glow.alphaMin + (glow.alphaMax - glow.alphaMin) * pulse;
  }

  function drawGlow(context, glow, visualTime) {
    const alpha = getGlowAlpha(glow, visualTime);
    const color = getColorChannels(glow.color);
    const gradient = context.createRadialGradient(
      glow.x,
      glow.y,
      0,
      glow.x,
      glow.y,
      glow.radius
    );
    gradient.addColorStop(
      0,
      `rgba(${color.r},${color.g},${color.b},${alpha})`
    );
    gradient.addColorStop(
      GLOW_INNER_STOP_POSITION,
      `rgba(${color.r},${color.g},${color.b},${alpha * GLOW_INNER_STOP_ALPHA_FACTOR})`
    );
    gradient.addColorStop(
      GLOW_MIDDLE_STOP_POSITION,
      `rgba(${color.r},${color.g},${color.b},${alpha * GLOW_MIDDLE_STOP_ALPHA_FACTOR})`
    );
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(glow.x, glow.y, glow.radius, 0, Math.PI * 2);
    context.fill();
  }

  function getFireflyMapping(visualTime = 0) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return Object.freeze(FIREFLIES.map(firefly => {
      const xPhase = safeTime * Math.PI * 2 / firefly.driftPeriodX +
        firefly.driftPhase;
      const yPhase = safeTime * Math.PI * 2 / firefly.driftPeriodY +
        firefly.driftPhase + Math.PI / 2;
      const pulse = (
        Math.sin(
          safeTime * Math.PI * 2 / firefly.pulsePeriod + firefly.pulsePhase
        ) + 1
      ) / 2;
      return Object.freeze({
        x: firefly.x + Math.sin(xPhase) * firefly.driftAmplitudeX,
        y: firefly.y + Math.sin(yPhase) * firefly.driftAmplitudeY,
        radius: firefly.radius,
        color: firefly.color,
        alpha: firefly.alpha * (
          FIREFLY_PULSE_MINIMUM_FACTOR +
          pulse * (1 - FIREFLY_PULSE_MINIMUM_FACTOR)
        )
      });
    }));
  }

  function drawFirefly(context, firefly) {
    const color = getColorChannels(firefly.color);
    const gradient = context.createRadialGradient(
      firefly.x,
      firefly.y,
      0,
      firefly.x,
      firefly.y,
      firefly.radius
    );
    gradient.addColorStop(0, `rgba(255,250,196,${Math.min(1, firefly.alpha * 1.2)})`);
    gradient.addColorStop(
      0.24,
      `rgba(${color.r},${color.g},${color.b},${firefly.alpha})`
    );
    gradient.addColorStop(
      0.56,
      `rgba(${color.r},${color.g},${color.b},${firefly.alpha * 0.5})`
    );
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(
      firefly.x,
      firefly.y,
      firefly.radius,
      0,
      Math.PI * 2
    );
    context.fill();
  }

  function drawBackgroundLayer(context, name, width, height) {
    context.drawImage(
      backgroundAssets[name].image,
      0,
      0,
      BACKGROUND_REFERENCE.w,
      BACKGROUND_REFERENCE.h,
      0,
      0,
      width,
      height
    );
  }

  function drawGlowLayer(context, glows, visualTime) {
    context.globalCompositeOperation = "screen";
    for (const glow of glows) drawGlow(context, glow, visualTime);
  }

  function drawBackground(context, width, height, visualTime = 0) {
    if (
      !context ||
      !isBackgroundReady() ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) return false;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    drawBackgroundLayer(context, "back", width, height);

    context.save();
    context.scale(
      width / BACKGROUND_REFERENCE.w,
      height / BACKGROUND_REFERENCE.h
    );
    drawGlowLayer(context, BACK_RUNE_GLOWS, safeTime);
    context.restore();

    context.save();
    context.globalAlpha = getGodRayAlpha(safeTime);
    drawBackgroundLayer(context, "godRay", width, height);
    context.restore();

    drawBackgroundLayer(context, "pedestal", width, height);

    context.save();
    context.scale(
      width / BACKGROUND_REFERENCE.w,
      height / BACKGROUND_REFERENCE.h
    );
    drawGlowLayer(context, PEDESTAL_RUNE_GLOWS, safeTime);
    for (const firefly of getFireflyMapping(safeTime)) {
      drawFirefly(context, firefly);
    }
    context.restore();

    drawBackgroundLayer(context, "depth", width, height);
    drawBackgroundLayer(context, "front", width, height);
    context.restore();
    return true;
  }

  function getBottomHazardMapping(rect) {
    const destination = HAZARD_CONTRACT.destination;
    if (
      !rect ||
      rect.x !== destination.x ||
      rect.y !== destination.y ||
      rect.w !== destination.w ||
      rect.h !== destination.h
    ) return null;
    return Object.freeze({
      source: HAZARD_CONTRACT.source,
      destination
    });
  }

  function drawBottomDeathHazard(context, rect) {
    if (!context || !isHazardReady()) return false;
    const mapping = getBottomHazardMapping(rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      hazardAsset.image,
      mapping.source.x,
      mapping.source.y,
      mapping.source.w,
      mapping.source.h,
      mapping.destination.x,
      mapping.destination.y,
      mapping.destination.w,
      mapping.destination.h
    );
    context.restore();
    return true;
  }

  const undergroundTempleVisuals = Object.freeze({
    ...undergroundTemplePlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getGodRayAlpha,
    getFireflyMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      essentialLayers: ESSENTIAL_BACKGROUND_LAYERS,
      baseLayerOrder: BASE_LAYER_ORDER,
      renderOrder: RENDER_ORDER,
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
      staticPositionLayers: ESSENTIAL_BACKGROUND_LAYERS,
      fullyStaticLayers: Object.freeze(["back", "pedestal", "depth", "front"]),
      backRuneGlows: BACK_RUNE_GLOWS,
      pedestalRuneGlows: PEDESTAL_RUNE_GLOWS,
      glowAnimation: Object.freeze({
        innerColorStopPosition: GLOW_INNER_STOP_POSITION,
        innerColorStopAlphaFactor: GLOW_INNER_STOP_ALPHA_FACTOR,
        middleColorStopPosition: GLOW_MIDDLE_STOP_POSITION,
        middleColorStopAlphaFactor: GLOW_MIDDLE_STOP_ALPHA_FACTOR,
        compositeOperation: "screen",
        intensityMode: "individual-minimum-and-maximum"
      }),
      godRayAnimation: Object.freeze({
        ...GOD_RAY_ANIMATION,
        opacityMotion: "sine-breathing",
        positionMotion: "static"
      }),
      fireflies: FIREFLIES,
      fireflyAnimation: Object.freeze({
        count: FIREFLIES.length,
        pulseMinimumFactor: FIREFLY_PULSE_MINIMUM_FACTOR,
        compositeOperation: "screen",
        colorFamily: "warm-gold",
        placement: "local-to-golden-statue",
        deterministic: true
      })
    }),
    whenHazardReady: () => hazardReadyPromise,
    isHazardReady,
    getBottomHazardMapping,
    drawBottomDeathHazard,
    getHazardStatus: () => Object.freeze({
      ready: isHazardReady(),
      path: HAZARD_CONTRACT.path,
      expectedNativeSize: HAZARD_CONTRACT.native,
      validNativeSize: hasValidHazardSize(),
      source: HAZARD_CONTRACT.source,
      destination: HAZARD_CONTRACT.destination,
      layerCount: 1,
      animated: false
    })
  });
  BIOME_PLATFORM_VISUALS.register(
    "undergroundTemple",
    undergroundTempleVisuals
  );
  return undergroundTempleVisuals;
})();
