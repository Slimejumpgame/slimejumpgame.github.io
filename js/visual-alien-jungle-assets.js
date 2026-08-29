"use strict";

const ALIEN_JUNGLE_ASSET_VISUALS = (() => {
  const alienJunglePlatformVisuals =
    BIOME_PLATFORM_VISUALS.resolve("alienJungle");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox:
      "assets/environments/alienJungle/background/alienJungle_background_skybox.png",
    planets:
      "assets/environments/alienJungle/background/alienJungle_background_planet.png",
    jungleBack:
      "assets/environments/alienJungle/background/alienJungle_background_jungle_back.png",
    jungleFront:
      "assets/environments/alienJungle/background/alienJungle_background_jungle_front.png"
  });
  const HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({x: 235, y: 690, w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const HAZARD_PATHS = Object.freeze({
    base:
      "assets/environments/alienJungle/hazards/alienJungle_hazard_base.png",
    waveBack:
      "assets/environments/alienJungle/hazards/alienJungle_hazard_wave_back.png",
    waveFront:
      "assets/environments/alienJungle/hazards/alienJungle_hazard_wave_front.png"
  });
  const WAVE_BACK_LEFT_SPEED = 8;
  const WAVE_FRONT_LEFT_SPEED = 14;
  const WAVE_BACK_BOB_AMPLITUDE = 1.5;
  const WAVE_FRONT_BOB_AMPLITUDE = 2;
  const WAVE_BACK_BOB_PERIOD = 7.2;
  const WAVE_FRONT_BOB_PERIOD = 5.8;
  const WAVE_BACK_BOB_PHASE = 0;
  const WAVE_FRONT_BOB_PHASE = 1.1;
  const WAVE_BACK_NATIVE_WRAP_OVERLAP = 3;
  const WAVE_FRONT_NATIVE_WRAP_OVERLAP = 0;
  const BACKGROUND_RENDER_ORDER = Object.freeze([
    "skybox",
    "planets",
    "jungleBack",
    "backPlantGlows",
    "colorfulFireflies",
    "jungleFront",
    "frontPlantGlows",
    "gameplay"
  ]);
  const GLOW_INNER_STOP_POSITION = 0.22;
  const GLOW_INNER_STOP_ALPHA_FACTOR = 0.82;
  const GLOW_MIDDLE_STOP_POSITION = 0.56;
  const GLOW_MIDDLE_STOP_ALPHA_FACTOR = 0.40;
  const BACK_PLANT_GLOWS = Object.freeze([
    Object.freeze({x: 92, y: 196, radius: 72, color: "#e948ff", alphaMin: 0.10, alphaMax: 0.40, period: 7.8, phase: 0.3}),
    Object.freeze({x: 205, y: 450, radius: 48, color: "#f04de8", alphaMin: 0.09, alphaMax: 0.36, period: 8.9, phase: 1.7}),
    Object.freeze({x: 312, y: 552, radius: 44, color: "#da4cff", alphaMin: 0.12, alphaMax: 0.46, period: 6.8, phase: 3.4}),
    Object.freeze({x: 40, y: 568, radius: 55, color: "#35e8e0", alphaMin: 0.08, alphaMax: 0.34, period: 9.6, phase: 5.2}),
    Object.freeze({x: 207, y: 628, radius: 54, color: "#31e4cf", alphaMin: 0.09, alphaMax: 0.38, period: 7.3, phase: 2.6}),
    Object.freeze({x: 300, y: 673, radius: 46, color: "#d955ff", alphaMin: 0.08, alphaMax: 0.32, period: 10.2, phase: 4.5}),
    Object.freeze({x: 415, y: 397, radius: 42, color: "#e857ff", alphaMin: 0.08, alphaMax: 0.35, period: 8.1, phase: 1.0}),
    Object.freeze({x: 279, y: 520, radius: 44, color: "#91ee55", alphaMin: 0.07, alphaMax: 0.30, period: 9.2, phase: 5.8}),
    Object.freeze({x: 987, y: 550, radius: 43, color: "#dc46ff", alphaMin: 0.11, alphaMax: 0.44, period: 7.0, phase: 2.1}),
    Object.freeze({x: 1083, y: 550, radius: 44, color: "#ff6a3d", alphaMin: 0.10, alphaMax: 0.42, period: 8.6, phase: 4.0}),
    Object.freeze({x: 1193, y: 591, radius: 62, color: "#3de6e4", alphaMin: 0.09, alphaMax: 0.37, period: 9.9, phase: 0.7}),
    Object.freeze({x: 1183, y: 613, radius: 50, color: "#d63fff", alphaMin: 0.12, alphaMax: 0.48, period: 7.6, phase: 3.0})
  ]);
  const FRONT_PLANT_GLOWS = Object.freeze([
    Object.freeze({x: 94, y: 227, radius: 88, color: "#ff4fd8", alphaMin: 0.14, alphaMax: 0.52, period: 7.4, phase: 0.8}),
    Object.freeze({x: 19, y: 332, radius: 34, color: "#91ff5a", alphaMin: 0.16, alphaMax: 0.60, period: 6.5, phase: 2.5}),
    Object.freeze({x: 145, y: 330, radius: 32, color: "#43f4d1", alphaMin: 0.15, alphaMax: 0.58, period: 8.3, phase: 4.4}),
    Object.freeze({x: 194, y: 589, radius: 55, color: "#ff7a32", alphaMin: 0.15, alphaMax: 0.56, period: 7.8, phase: 1.3}),
    Object.freeze({x: 152, y: 654, radius: 60, color: "#ffc83d", alphaMin: 0.14, alphaMax: 0.54, period: 9.1, phase: 5.6}),
    Object.freeze({x: 355, y: 526, radius: 44, color: "#ed45da", alphaMin: 0.13, alphaMax: 0.50, period: 6.9, phase: 3.7}),
    Object.freeze({x: 1130, y: 290, radius: 48, color: "#49f2cd", alphaMin: 0.16, alphaMax: 0.62, period: 8.7, phase: 0.2}),
    Object.freeze({x: 1055, y: 520, radius: 52, color: "#ff7138", alphaMin: 0.15, alphaMax: 0.58, period: 7.1, phase: 2.9}),
    Object.freeze({x: 1229, y: 586, radius: 62, color: "#ffd447", alphaMin: 0.14, alphaMax: 0.55, period: 9.5, phase: 4.8}),
    Object.freeze({x: 683, y: 679, radius: 36, color: "#ff4fc6", alphaMin: 0.12, alphaMax: 0.46, period: 8.0, phase: 1.9})
  ]);
  const FIREFLY_PALETTE = Object.freeze([
    "#ff4fd8",
    "#d85cff",
    "#ff8a35",
    "#ffd75a",
    "#37efcf",
    "#42d9ff",
    "#9dff5a"
  ]);
  const FIREFLY_PULSE_MINIMUM_FACTOR = 0.48;
  const FIREFLIES = Object.freeze([
    Object.freeze({x: 105, y: 145, radius: 4.6, color: FIREFLY_PALETTE[0], alpha: 0.86, driftAmplitudeX: 12, driftPeriodX: 21, driftAmplitudeY: 6, driftPeriodY: 14, driftPhase: 0.2, pulsePeriod: 4.1, pulsePhase: 0.6}),
    Object.freeze({x: 225, y: 205, radius: 5.3, color: FIREFLY_PALETTE[4], alpha: 0.91, driftAmplitudeX: 16, driftPeriodX: 27, driftAmplitudeY: 8, driftPeriodY: 17, driftPhase: 1.5, pulsePeriod: 5.3, pulsePhase: 2.2}),
    Object.freeze({x: 350, y: 130, radius: 4.4, color: FIREFLY_PALETTE[3], alpha: 0.83, driftAmplitudeX: 10, driftPeriodX: 19, driftAmplitudeY: 5, driftPeriodY: 13, driftPhase: 2.8, pulsePeriod: 3.8, pulsePhase: 4.4}),
    Object.freeze({x: 480, y: 245, radius: 5.8, color: FIREFLY_PALETTE[1], alpha: 0.93, driftAmplitudeX: 18, driftPeriodX: 30, driftAmplitudeY: 9, driftPeriodY: 20, driftPhase: 4.1, pulsePeriod: 6.0, pulsePhase: 1.3}),
    Object.freeze({x: 610, y: 165, radius: 4.9, color: FIREFLY_PALETTE[5], alpha: 0.88, driftAmplitudeX: 13, driftPeriodX: 23, driftAmplitudeY: 6, driftPeriodY: 15, driftPhase: 5.3, pulsePeriod: 4.6, pulsePhase: 5.5}),
    Object.freeze({x: 745, y: 225, radius: 5.5, color: FIREFLY_PALETTE[2], alpha: 0.92, driftAmplitudeX: 17, driftPeriodX: 28, driftAmplitudeY: 8, driftPeriodY: 18, driftPhase: 0.8, pulsePeriod: 5.6, pulsePhase: 3.1}),
    Object.freeze({x: 880, y: 145, radius: 4.5, color: FIREFLY_PALETTE[6], alpha: 0.84, driftAmplitudeX: 11, driftPeriodX: 20, driftAmplitudeY: 5, driftPeriodY: 12, driftPhase: 2.0, pulsePeriod: 4.0, pulsePhase: 0.1}),
    Object.freeze({x: 1010, y: 215, radius: 5.6, color: FIREFLY_PALETTE[0], alpha: 0.94, driftAmplitudeX: 15, driftPeriodX: 26, driftAmplitudeY: 9, driftPeriodY: 16, driftPhase: 3.3, pulsePeriod: 5.1, pulsePhase: 4.8}),
    Object.freeze({x: 1165, y: 160, radius: 4.8, color: FIREFLY_PALETTE[4], alpha: 0.87, driftAmplitudeX: 12, driftPeriodX: 22, driftAmplitudeY: 7, driftPeriodY: 14, driftPhase: 4.7, pulsePeriod: 4.4, pulsePhase: 1.8}),
    Object.freeze({x: 140, y: 330, radius: 5.9, color: FIREFLY_PALETTE[2], alpha: 0.93, driftAmplitudeX: 18, driftPeriodX: 31, driftAmplitudeY: 10, driftPeriodY: 21, driftPhase: 5.7, pulsePeriod: 6.2, pulsePhase: 3.6}),
    Object.freeze({x: 285, y: 365, radius: 4.7, color: FIREFLY_PALETTE[5], alpha: 0.85, driftAmplitudeX: 9, driftPeriodX: 18, driftAmplitudeY: 6, driftPeriodY: 13, driftPhase: 0.5, pulsePeriod: 3.9, pulsePhase: 5.9}),
    Object.freeze({x: 430, y: 315, radius: 5.4, color: FIREFLY_PALETTE[3], alpha: 0.90, driftAmplitudeX: 14, driftPeriodX: 25, driftAmplitudeY: 8, driftPeriodY: 17, driftPhase: 1.8, pulsePeriod: 5.0, pulsePhase: 2.6}),
    Object.freeze({x: 565, y: 390, radius: 6.0, color: FIREFLY_PALETTE[0], alpha: 0.95, driftAmplitudeX: 17, driftPeriodX: 29, driftAmplitudeY: 9, driftPeriodY: 19, driftPhase: 2.9, pulsePeriod: 5.8, pulsePhase: 0.9}),
    Object.freeze({x: 715, y: 320, radius: 4.6, color: FIREFLY_PALETTE[6], alpha: 0.84, driftAmplitudeX: 11, driftPeriodX: 21, driftAmplitudeY: 5, driftPeriodY: 14, driftPhase: 4.0, pulsePeriod: 4.2, pulsePhase: 4.1}),
    Object.freeze({x: 850, y: 380, radius: 5.7, color: FIREFLY_PALETTE[1], alpha: 0.92, driftAmplitudeX: 16, driftPeriodX: 27, driftAmplitudeY: 8, driftPeriodY: 18, driftPhase: 5.1, pulsePeriod: 5.4, pulsePhase: 1.6}),
    Object.freeze({x: 1000, y: 325, radius: 5.0, color: FIREFLY_PALETTE[4], alpha: 0.89, driftAmplitudeX: 13, driftPeriodX: 24, driftAmplitudeY: 7, driftPeriodY: 15, driftPhase: 0.1, pulsePeriod: 4.7, pulsePhase: 5.2}),
    Object.freeze({x: 1140, y: 390, radius: 5.5, color: FIREFLY_PALETTE[3], alpha: 0.91, driftAmplitudeX: 15, driftPeriodX: 26, driftAmplitudeY: 9, driftPeriodY: 17, driftPhase: 1.2, pulsePeriod: 5.2, pulsePhase: 3.3}),
    Object.freeze({x: 200, y: 515, radius: 5.8, color: FIREFLY_PALETTE[1], alpha: 0.94, driftAmplitudeX: 17, driftPeriodX: 30, driftAmplitudeY: 10, driftPeriodY: 20, driftPhase: 2.4, pulsePeriod: 6.1, pulsePhase: 0.4}),
    Object.freeze({x: 365, y: 485, radius: 4.5, color: FIREFLY_PALETTE[6], alpha: 0.83, driftAmplitudeX: 10, driftPeriodX: 19, driftAmplitudeY: 5, driftPeriodY: 12, driftPhase: 3.6, pulsePeriod: 3.7, pulsePhase: 4.6}),
    Object.freeze({x: 525, y: 545, radius: 5.3, color: FIREFLY_PALETTE[2], alpha: 0.90, driftAmplitudeX: 14, driftPeriodX: 25, driftAmplitudeY: 8, driftPeriodY: 16, driftPhase: 4.8, pulsePeriod: 4.9, pulsePhase: 2.0}),
    Object.freeze({x: 690, y: 470, radius: 6.1, color: FIREFLY_PALETTE[5], alpha: 0.95, driftAmplitudeX: 18, driftPeriodX: 31, driftAmplitudeY: 9, driftPeriodY: 21, driftPhase: 5.9, pulsePeriod: 6.3, pulsePhase: 5.7}),
    Object.freeze({x: 840, y: 535, radius: 4.9, color: FIREFLY_PALETTE[0], alpha: 0.87, driftAmplitudeX: 12, driftPeriodX: 22, driftAmplitudeY: 6, driftPeriodY: 14, driftPhase: 0.7, pulsePeriod: 4.3, pulsePhase: 1.1}),
    Object.freeze({x: 1025, y: 500, radius: 5.6, color: FIREFLY_PALETTE[4], alpha: 0.92, driftAmplitudeX: 16, driftPeriodX: 28, driftAmplitudeY: 8, driftPeriodY: 18, driftPhase: 1.9, pulsePeriod: 5.5, pulsePhase: 3.9}),
    Object.freeze({x: 1180, y: 535, radius: 4.7, color: FIREFLY_PALETTE[2], alpha: 0.86, driftAmplitudeX: 11, driftPeriodX: 20, driftAmplitudeY: 7, driftPeriodY: 13, driftPhase: 3.1, pulsePeriod: 4.5, pulsePhase: 2.8})
  ]);
  const assets = {};
  const hazardAssets = {};
  const colorChannelCache = new Map();

  function loadAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    assets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidSize(name));
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
    return Object.keys(BACKGROUND_PATHS).every(hasValidSize);
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

  function getPlantGlowMapping(layer, visualTime = 0) {
    const glows = layer === "back"
      ? BACK_PLANT_GLOWS
      : layer === "front" ? FRONT_PLANT_GLOWS : null;
    if (!glows) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return Object.freeze(glows.map(glow => Object.freeze({
      x: glow.x,
      y: glow.y,
      radius: glow.radius,
      color: glow.color,
      alpha: getGlowAlpha(glow, safeTime)
    })));
  }

  function drawGlow(context, glow) {
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
      `rgba(${color.r},${color.g},${color.b},${glow.alpha})`
    );
    gradient.addColorStop(
      GLOW_INNER_STOP_POSITION,
      `rgba(${color.r},${color.g},${color.b},${glow.alpha * GLOW_INNER_STOP_ALPHA_FACTOR})`
    );
    gradient.addColorStop(
      GLOW_MIDDLE_STOP_POSITION,
      `rgba(${color.r},${color.g},${color.b},${glow.alpha * GLOW_MIDDLE_STOP_ALPHA_FACTOR})`
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
    gradient.addColorStop(
      0,
      `rgba(255,255,238,${Math.min(1, firefly.alpha * 1.18)})`
    );
    gradient.addColorStop(
      0.22,
      `rgba(${color.r},${color.g},${color.b},${firefly.alpha})`
    );
    gradient.addColorStop(
      0.56,
      `rgba(${color.r},${color.g},${color.b},${firefly.alpha * 0.48})`
    );
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(firefly.x, firefly.y, firefly.radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawBackgroundLayer(context, name, width, height) {
    context.drawImage(
      assets[name].image,
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

  function drawEffectLayer(context, width, height, effects, drawEffect) {
    context.save();
    context.scale(
      width / BACKGROUND_REFERENCE.w,
      height / BACKGROUND_REFERENCE.h
    );
    context.globalCompositeOperation = "screen";
    for (const effect of effects) drawEffect(context, effect);
    context.restore();
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
    drawBackgroundLayer(context, "skybox", width, height);
    drawBackgroundLayer(context, "planets", width, height);
    drawBackgroundLayer(context, "jungleBack", width, height);
    drawEffectLayer(
      context,
      width,
      height,
      getPlantGlowMapping("back", safeTime),
      drawGlow
    );
    drawEffectLayer(
      context,
      width,
      height,
      getFireflyMapping(safeTime),
      drawFirefly
    );
    drawBackgroundLayer(context, "jungleFront", width, height);
    drawEffectLayer(
      context,
      width,
      height,
      getPlantGlowMapping("front", safeTime),
      drawGlow
    );
    context.restore();
    return true;
  }

  function getHorizontalWaveMapping(
    visualTime,
    rect,
    leftSpeed,
    bobAmplitude,
    bobPeriod,
    bobPhase,
    nativeWrapOverlap
  ) {
    const runtimeOverlap = nativeWrapOverlap *
      HAZARD_CONTRACT.nativeToRuntimeScale;
    const wrapDistance = rect.w - runtimeOverlap;
    const travel = (
      (visualTime * leftSpeed) % wrapDistance + wrapDistance
    ) % wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    const offsetY = Math.sin(
      visualTime * Math.PI * 2 / bobPeriod + bobPhase
    ) * bobAmplitude;
    return Object.freeze({
      offsetX,
      offsetY,
      leftSpeed,
      bobAmplitude,
      bobPeriod,
      bobPhase,
      runtimeOverlap,
      wrapDistance,
      destinations: Object.freeze([0, wrapDistance].map(copyOffset => (
        Object.freeze({
          x: rect.x + offsetX + copyOffset,
          y: rect.y + offsetY,
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
        WAVE_BACK_BOB_AMPLITUDE,
        WAVE_BACK_BOB_PERIOD,
        WAVE_BACK_BOB_PHASE,
        WAVE_BACK_NATIVE_WRAP_OVERLAP
      ),
      waveFront: getHorizontalWaveMapping(
        safeTime,
        rect,
        WAVE_FRONT_LEFT_SPEED,
        WAVE_FRONT_BOB_AMPLITUDE,
        WAVE_FRONT_BOB_PERIOD,
        WAVE_FRONT_BOB_PHASE,
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

  const alienJungleVisuals = Object.freeze({
    ...alienJunglePlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getPlantGlowMapping,
    getFireflyMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(BACKGROUND_PATHS).map(name => [name, hasValidSize(name)])
      )),
      staticLayers: Object.freeze([
        "skybox",
        "planets",
        "jungleBack",
        "jungleFront"
      ]),
      backPlantGlows: BACK_PLANT_GLOWS,
      frontPlantGlows: FRONT_PLANT_GLOWS,
      fireflies: FIREFLIES,
      glowAnimation: Object.freeze({
        compositeOperation: "screen",
        intensityMode: "individual-minimum-and-maximum",
        deterministic: true
      }),
      fireflyAnimation: Object.freeze({
        count: FIREFLIES.length,
        palette: FIREFLY_PALETTE,
        pulseMinimumFactor: FIREFLY_PULSE_MINIMUM_FACTOR,
        compositeOperation: "screen",
        movement: "individual-bidirectional-sine-drift",
        drawOrder: "after-back-glows-before-jungle-front",
        deterministic: true
      }),
      renderOrder: BACKGROUND_RENDER_ORDER
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
          motion: "static"
        }),
        waveBack: Object.freeze({
          leftSpeed: WAVE_BACK_LEFT_SPEED,
          direction: "right-to-left",
          bobAmplitude: WAVE_BACK_BOB_AMPLITUDE,
          bobPeriod: WAVE_BACK_BOB_PERIOD,
          bobPhase: WAVE_BACK_BOB_PHASE,
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
          direction: "right-to-left",
          bobAmplitude: WAVE_FRONT_BOB_AMPLITUDE,
          bobPeriod: WAVE_FRONT_BOB_PERIOD,
          bobPhase: WAVE_FRONT_BOB_PHASE,
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
  BIOME_PLATFORM_VISUALS.register("alienJungle", alienJungleVisuals);
  return alienJungleVisuals;
})();
