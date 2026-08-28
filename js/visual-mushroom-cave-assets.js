"use strict";

const MUSHROOM_CAVE_ASSET_VISUALS = (() => {
  const mushroomCavePlatformVisuals =
    BIOME_PLATFORM_VISUALS.resolve("mushroomCave");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    main:
      "assets/environments/mushroomCave/background/mushroomCave_background_main.png",
    front:
      "assets/environments/mushroomCave/background/mushroomCave_background_front.png"
  });
  const HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({x: 235, y: 690, w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const HAZARD_PATHS = Object.freeze({
    base:
      "assets/environments/mushroomCave/hazards/mushroomCave_hazard_base.png",
    waveBack:
      "assets/environments/mushroomCave/hazards/mushroomCave_hazard_wave_back.png",
    waveFront:
      "assets/environments/mushroomCave/hazards/mushroomCave_hazard_wave_front.png"
  });
  const WAVE_BACK_LEFT_SPEED = 9;
  const WAVE_FRONT_LEFT_SPEED = 16;
  // Back uses every edge column; Front ends in one transparent native column.
  const WAVE_BACK_NATIVE_WRAP_OVERLAP = 0;
  const WAVE_FRONT_NATIVE_WRAP_OVERLAP = 1;
  const GLOW_INNER_STOP_POSITION = 0.20;
  const GLOW_INNER_STOP_ALPHA_FACTOR = 0.88;
  const GLOW_MIDDLE_STOP_POSITION = 0.54;
  const GLOW_MIDDLE_STOP_ALPHA_FACTOR = 0.48;
  const MAIN_GLOWS = Object.freeze([
    Object.freeze({x: 193, y: 176, radius: 92, color: "#ff5cc8", alphaMin: 0.22, alphaMax: 0.74, period: 6.4, phase: 0.2}),
    Object.freeze({x: 297, y: 365, radius: 56, color: "#36cfff", alphaMin: 0.17, alphaMax: 0.62, period: 7.7, phase: 1.6}),
    Object.freeze({x: 92, y: 484, radius: 96, color: "#ff58bd", alphaMin: 0.23, alphaMax: 0.76, period: 6.9, phase: 4.7}),
    Object.freeze({x: 185, y: 549, radius: 62, color: "#ff9638", alphaMin: 0.18, alphaMax: 0.64, period: 8.2, phase: 2.4}),
    Object.freeze({x: 278, y: 581, radius: 54, color: "#ff5dbb", alphaMin: 0.16, alphaMax: 0.58, period: 7.1, phase: 5.6}),
    Object.freeze({x: 390, y: 437, radius: 40, color: "#ff61c7", alphaMin: 0.14, alphaMax: 0.50, period: 5.6, phase: 0.9}),
    Object.freeze({x: 664, y: 384, radius: 38, color: "#35d3ff", alphaMin: 0.14, alphaMax: 0.50, period: 8.6, phase: 3.8}),
    Object.freeze({x: 1081, y: 270, radius: 104, color: "#ff536f", alphaMin: 0.23, alphaMax: 0.76, period: 7.9, phase: 5.1}),
    Object.freeze({x: 1027, y: 353, radius: 54, color: "#ff5972", alphaMin: 0.16, alphaMax: 0.58, period: 6.7, phase: 1.1}),
    Object.freeze({x: 1201, y: 477, radius: 106, color: "#3bc8ff", alphaMin: 0.23, alphaMax: 0.76, period: 7.4, phase: 3.9}),
    Object.freeze({x: 1061, y: 593, radius: 40, color: "#ff9938", alphaMin: 0.14, alphaMax: 0.50, period: 5.8, phase: 0.5}),
    Object.freeze({x: 1125, y: 574, radius: 54, color: "#a95fff", alphaMin: 0.16, alphaMax: 0.58, period: 8.4, phase: 4.3}),
    Object.freeze({x: 1241, y: 582, radius: 42, color: "#39c7ff", alphaMin: 0.14, alphaMax: 0.52, period: 6.6, phase: 2.0})
  ]);
  const FRONT_GLOWS = Object.freeze([
    Object.freeze({x: 84, y: 393, radius: 82, color: "#ff58bd", alphaMin: 0.10, alphaMax: 0.42, period: 8.7, phase: 1.0}),
    Object.freeze({x: 161, y: 463, radius: 52, color: "#ff9638", alphaMin: 0.08, alphaMax: 0.34, period: 7.6, phase: 4.2}),
    Object.freeze({x: 205, y: 508, radius: 40, color: "#a95fff", alphaMin: 0.07, alphaMax: 0.29, period: 8.1, phase: 2.7}),
    Object.freeze({x: 1207, y: 410, radius: 82, color: "#3bc8ff", alphaMin: 0.10, alphaMax: 0.42, period: 9.0, phase: 5.4}),
    Object.freeze({x: 1154, y: 484, radius: 50, color: "#ff5dbb", alphaMin: 0.08, alphaMax: 0.34, period: 7.9, phase: 0.4}),
    Object.freeze({x: 1122, y: 586, radius: 44, color: "#ff9938", alphaMin: 0.07, alphaMax: 0.30, period: 8.5, phase: 3.6})
  ]);
  const FIREFLY_PULSE_MINIMUM_FACTOR = 0.52;
  const FIREFLIES = Object.freeze([
    Object.freeze({x: 154, y: 220, radius: 5.6, color: "#28c8ff", alpha: 0.88, driftAmplitudeX: 13, driftPeriodX: 21, driftAmplitudeY: 7, driftPeriodY: 13, driftPhase: 0.3, pulsePeriod: 4.1, pulsePhase: 0.8}),
    Object.freeze({x: 304, y: 252, radius: 6.4, color: "#32b8ff", alpha: 0.93, driftAmplitudeX: 17, driftPeriodX: 25, driftAmplitudeY: 8, driftPeriodY: 15, driftPhase: 1.7, pulsePeriod: 5.2, pulsePhase: 2.3}),
    Object.freeze({x: 470, y: 188, radius: 5.2, color: "#27e0ff", alpha: 0.84, driftAmplitudeX: 11, driftPeriodX: 19, driftAmplitudeY: 6, driftPeriodY: 12, driftPhase: 2.9, pulsePeriod: 3.8, pulsePhase: 4.5}),
    Object.freeze({x: 630, y: 270, radius: 7.0, color: "#3b9cff", alpha: 0.96, driftAmplitudeX: 18, driftPeriodX: 27, driftAmplitudeY: 9, driftPeriodY: 17, driftPhase: 4.2, pulsePeriod: 5.7, pulsePhase: 1.4}),
    Object.freeze({x: 798, y: 205, radius: 5.8, color: "#43d4ff", alpha: 0.89, driftAmplitudeX: 14, driftPeriodX: 22, driftAmplitudeY: 6, driftPeriodY: 11, driftPhase: 5.4, pulsePeriod: 4.4, pulsePhase: 5.6}),
    Object.freeze({x: 972, y: 250, radius: 6.2, color: "#238cff", alpha: 0.92, driftAmplitudeX: 16, driftPeriodX: 24, driftAmplitudeY: 8, driftPeriodY: 14, driftPhase: 0.9, pulsePeriod: 4.9, pulsePhase: 3.2}),
    Object.freeze({x: 1126, y: 214, radius: 5.4, color: "#2fcdff", alpha: 0.86, driftAmplitudeX: 12, driftPeriodX: 20, driftAmplitudeY: 7, driftPeriodY: 13, driftPhase: 2.1, pulsePeriod: 3.9, pulsePhase: 0.2}),
    Object.freeze({x: 228, y: 414, radius: 6.6, color: "#35b5ff", alpha: 0.94, driftAmplitudeX: 17, driftPeriodX: 26, driftAmplitudeY: 10, driftPeriodY: 16, driftPhase: 3.4, pulsePeriod: 5.5, pulsePhase: 4.9}),
    Object.freeze({x: 420, y: 386, radius: 5.7, color: "#22d8ff", alpha: 0.87, driftAmplitudeX: 12, driftPeriodX: 23, driftAmplitudeY: 7, driftPeriodY: 12, driftPhase: 4.8, pulsePeriod: 4.3, pulsePhase: 1.9}),
    Object.freeze({x: 610, y: 452, radius: 6.8, color: "#2b98ff", alpha: 0.95, driftAmplitudeX: 18, driftPeriodX: 28, driftAmplitudeY: 9, driftPeriodY: 18, driftPhase: 5.8, pulsePeriod: 5.9, pulsePhase: 3.8}),
    Object.freeze({x: 818, y: 392, radius: 6.0, color: "#3ecfff", alpha: 0.91, driftAmplitudeX: 15, driftPeriodX: 24, driftAmplitudeY: 8, driftPeriodY: 15, driftPhase: 1.2, pulsePeriod: 4.7, pulsePhase: 5.3}),
    Object.freeze({x: 1048, y: 444, radius: 6.3, color: "#269eff", alpha: 0.93, driftAmplitudeX: 16, driftPeriodX: 25, driftAmplitudeY: 9, driftPeriodY: 14, driftPhase: 3.0, pulsePeriod: 5.0, pulsePhase: 2.7}),
    Object.freeze({x: 96, y: 334, radius: 5.3, color: "#34c5ff", alpha: 0.85, driftAmplitudeX: 11, driftPeriodX: 22, driftAmplitudeY: 6, driftPeriodY: 12, driftPhase: 0.6, pulsePeriod: 4.0, pulsePhase: 0.5}),
    Object.freeze({x: 378, y: 150, radius: 5.9, color: "#2994ff", alpha: 0.90, driftAmplitudeX: 15, driftPeriodX: 26, driftAmplitudeY: 7, driftPeriodY: 14, driftPhase: 1.4, pulsePeriod: 4.5, pulsePhase: 1.1}),
    Object.freeze({x: 548, y: 330, radius: 6.5, color: "#31d7ff", alpha: 0.94, driftAmplitudeX: 16, driftPeriodX: 24, driftAmplitudeY: 9, driftPeriodY: 16, driftPhase: 2.5, pulsePeriod: 4.6, pulsePhase: 1.7}),
    Object.freeze({x: 704, y: 154, radius: 5.5, color: "#3bb8ff", alpha: 0.86, driftAmplitudeX: 12, driftPeriodX: 21, driftAmplitudeY: 6, driftPeriodY: 13, driftPhase: 3.7, pulsePeriod: 4.8, pulsePhase: 2.1}),
    Object.freeze({x: 886, y: 304, radius: 6.1, color: "#25cfff", alpha: 0.92, driftAmplitudeX: 17, driftPeriodX: 27, driftAmplitudeY: 8, driftPeriodY: 15, driftPhase: 4.5, pulsePeriod: 5.1, pulsePhase: 3.5}),
    Object.freeze({x: 1180, y: 334, radius: 5.6, color: "#348fff", alpha: 0.88, driftAmplitudeX: 13, driftPeriodX: 23, driftAmplitudeY: 7, driftPeriodY: 12, driftPhase: 5.1, pulsePeriod: 5.3, pulsePhase: 4.2}),
    Object.freeze({x: 334, y: 520, radius: 6.7, color: "#2abaff", alpha: 0.95, driftAmplitudeX: 18, driftPeriodX: 29, driftAmplitudeY: 10, driftPeriodY: 17, driftPhase: 5.7, pulsePeriod: 5.4, pulsePhase: 5.9}),
    Object.freeze({x: 922, y: 520, radius: 6.4, color: "#36d2ff", alpha: 0.93, driftAmplitudeX: 16, driftPeriodX: 25, driftAmplitudeY: 9, driftPeriodY: 18, driftPhase: 0.1, pulsePeriod: 5.6, pulsePhase: 6.1})
  ]);
  const assets = {};
  const hazardAssets = {};
  const colorChannelCache = new Map();

  function loadAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    assets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
    loadAsset(name, path);
  }

  function hasValidSize(name) {
    const image = assets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function isBackgroundReady() {
    return hasValidSize("main") && hasValidSize("front");
  }

  const backgroundReadyPromise = Promise.all(
    Object.values(assets).map(asset => asset.ready)
  ).then(() => isBackgroundReady());

  function hasValidHazardSize(name) {
    const image = hazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === HAZARD_CONTRACT.native.w &&
      image.naturalHeight === HAZARD_CONTRACT.native.h
    );
  }

  function loadHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    hazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidHazardSize(name));
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(HAZARD_PATHS)) {
    loadHazardAsset(name, path);
  }

  function isHazardReady() {
    return Object.keys(HAZARD_PATHS).every(hasValidHazardSize);
  }

  const hazardReadyPromise = Promise.all(
    Object.values(hazardAssets).map(asset => asset.ready)
  ).then(() => isHazardReady());

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

  function drawFirefly(context, firefly, visualTime) {
    const xPhase = visualTime * Math.PI * 2 / firefly.driftPeriodX +
      firefly.driftPhase;
    const yPhase = visualTime * Math.PI * 2 / firefly.driftPeriodY +
      firefly.driftPhase + Math.PI / 2;
    const pulse = (
      Math.sin(
        visualTime * Math.PI * 2 / firefly.pulsePeriod + firefly.pulsePhase
      ) + 1
    ) / 2;
    const x = firefly.x + Math.sin(xPhase) * firefly.driftAmplitudeX;
    const y = firefly.y + Math.sin(yPhase) * firefly.driftAmplitudeY;
    const alpha = firefly.alpha * (
      FIREFLY_PULSE_MINIMUM_FACTOR +
      pulse * (1 - FIREFLY_PULSE_MINIMUM_FACTOR)
    );
    const color = getColorChannels(firefly.color);
    const gradient = context.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      firefly.radius
    );
    gradient.addColorStop(0, `rgba(210,244,255,${Math.min(1, alpha * 1.22)})`);
    gradient.addColorStop(
      0.22,
      `rgba(${color.r},${color.g},${color.b},${alpha})`
    );
    gradient.addColorStop(
      0.52,
      `rgba(${color.r},${color.g},${color.b},${alpha * 0.56})`
    );
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, firefly.radius, 0, Math.PI * 2);
    context.fill();
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
    context.drawImage(
      assets.main.image,
      0,
      0,
      BACKGROUND_REFERENCE.w,
      BACKGROUND_REFERENCE.h,
      0,
      0,
      width,
      height
    );

    context.save();
    context.scale(
      width / BACKGROUND_REFERENCE.w,
      height / BACKGROUND_REFERENCE.h
    );
    context.globalCompositeOperation = "screen";
    for (const glow of MAIN_GLOWS) drawGlow(context, glow, safeTime);
    for (const firefly of FIREFLIES) {
      drawFirefly(context, firefly, safeTime);
    }
    context.restore();

    context.drawImage(
      assets.front.image,
      0,
      0,
      BACKGROUND_REFERENCE.w,
      BACKGROUND_REFERENCE.h,
      0,
      0,
      width,
      height
    );

    context.save();
    context.scale(
      width / BACKGROUND_REFERENCE.w,
      height / BACKGROUND_REFERENCE.h
    );
    context.globalCompositeOperation = "screen";
    for (const glow of FRONT_GLOWS) drawGlow(context, glow, safeTime);
    context.restore();
    context.restore();
    return true;
  }

  function getHorizontalWaveMapping(
    visualTime,
    rect,
    leftSpeed,
    nativeWrapOverlap
  ) {
    const runtimeOverlap = nativeWrapOverlap *
      HAZARD_CONTRACT.nativeToRuntimeScale;
    const wrapDistance = rect.w - runtimeOverlap;
    const travel = (
      (visualTime * leftSpeed) % wrapDistance + wrapDistance
    ) % wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    return Object.freeze({
      offsetX,
      offsetY: 0,
      leftSpeed,
      runtimeOverlap,
      wrapDistance,
      destinations: Object.freeze([0, wrapDistance].map(copyOffset => (
        Object.freeze({
          x: rect.x + offsetX + copyOffset,
          y: rect.y,
          w: rect.w,
          h: rect.h
        })
      )))
    });
  }

  function getBottomHazardMapping(visualTime, rect) {
    if (
      !rect ||
      rect.x !== HAZARD_CONTRACT.runtime.x ||
      rect.y !== HAZARD_CONTRACT.runtime.y ||
      rect.w !== HAZARD_CONTRACT.runtime.w ||
      rect.h !== HAZARD_CONTRACT.runtime.h
    ) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return Object.freeze({
      source: HAZARD_CONTRACT.native,
      base: Object.freeze({
        offsetX: 0,
        offsetY: 0,
        destination: Object.freeze({
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h
        })
      }),
      waveBack: getHorizontalWaveMapping(
        safeTime,
        rect,
        WAVE_BACK_LEFT_SPEED,
        WAVE_BACK_NATIVE_WRAP_OVERLAP
      ),
      waveFront: getHorizontalWaveMapping(
        safeTime,
        rect,
        WAVE_FRONT_LEFT_SPEED,
        WAVE_FRONT_NATIVE_WRAP_OVERLAP
      )
    });
  }

  function drawHazardLayer(context, name, source, destination) {
    context.drawImage(
      hazardAssets[name].image,
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
    if (!context || !isHazardReady()) return false;
    const mapping = getBottomHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    drawHazardLayer(
      context,
      "base",
      mapping.source,
      mapping.base.destination
    );
    for (const destination of mapping.waveBack.destinations) {
      drawHazardLayer(context, "waveBack", mapping.source, destination);
    }
    for (const destination of mapping.waveFront.destinations) {
      drawHazardLayer(context, "waveFront", mapping.source, destination);
    }
    context.restore();
    return true;
  }

  const mushroomCaveVisuals = Object.freeze({
    ...mushroomCavePlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getFireflyMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      mainGlows: MAIN_GLOWS,
      frontGlows: FRONT_GLOWS,
      fireflies: FIREFLIES,
      glowAnimation: Object.freeze({
        innerColorStopPosition: GLOW_INNER_STOP_POSITION,
        innerColorStopAlphaFactor: GLOW_INNER_STOP_ALPHA_FACTOR,
        middleColorStopPosition: GLOW_MIDDLE_STOP_POSITION,
        middleColorStopAlphaFactor: GLOW_MIDDLE_STOP_ALPHA_FACTOR,
        compositeOperation: "screen",
        intensityMode: "individual-minimum-and-maximum"
      }),
      fireflyAnimation: Object.freeze({
        count: FIREFLIES.length,
        pulseMinimumFactor: FIREFLY_PULSE_MINIMUM_FACTOR,
        compositeOperation: "screen",
        colorFamily: "electric-blue-cyan",
        drawOrder: "between-main-and-front"
      }),
      renderOrder: Object.freeze([
        "main-background",
        "main-glows",
        "fireflies",
        "front-layer",
        "front-glows",
        "gameplay"
      ])
    }),
    whenHazardReady: () => hazardReadyPromise,
    isHazardReady,
    getBottomHazardMapping,
    drawBottomDeathHazard,
    getHazardStatus: () => Object.freeze({
      ready: isHazardReady(),
      paths: HAZARD_PATHS,
      contract: HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(HAZARD_PATHS).map(name => [
          name,
          hasValidHazardSize(name)
        ])
      )),
      animation: Object.freeze({
        drawOrder: Object.freeze(["base", "waveBack", "waveFront"]),
        base: Object.freeze({
          xSpeed: 0,
          ySpeed: 0,
          rotation: 0,
          motion: "static"
        }),
        waveBack: Object.freeze({
          leftSpeed: WAVE_BACK_LEFT_SPEED,
          ySpeed: 0,
          rotation: 0,
          direction: "right-to-left",
          nativeWrapOverlap: WAVE_BACK_NATIVE_WRAP_OVERLAP,
          runtimeWrapOverlap: WAVE_BACK_NATIVE_WRAP_OVERLAP *
            HAZARD_CONTRACT.nativeToRuntimeScale,
          wrapDistance: HAZARD_CONTRACT.runtime.w -
            WAVE_BACK_NATIVE_WRAP_OVERLAP *
              HAZARD_CONTRACT.nativeToRuntimeScale,
          drawCopies: 2
        }),
        waveFront: Object.freeze({
          leftSpeed: WAVE_FRONT_LEFT_SPEED,
          ySpeed: 0,
          rotation: 0,
          direction: "right-to-left",
          nativeWrapOverlap: WAVE_FRONT_NATIVE_WRAP_OVERLAP,
          runtimeWrapOverlap: WAVE_FRONT_NATIVE_WRAP_OVERLAP *
            HAZARD_CONTRACT.nativeToRuntimeScale,
          wrapDistance: HAZARD_CONTRACT.runtime.w -
            WAVE_FRONT_NATIVE_WRAP_OVERLAP *
              HAZARD_CONTRACT.nativeToRuntimeScale,
          drawCopies: 2
        }),
        deterministic: true
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("mushroomCave", mushroomCaveVisuals);
  return mushroomCaveVisuals;
})();
