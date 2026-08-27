"use strict";

const CRYSTAL_CAVE_ASSET_VISUALS = (() => {
  const crystalCavePlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("crystalCave");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATH =
    "assets/environments/crystalCave/background/crystalCave_background_base.png";
  const HAZARD_REFERENCE = Object.freeze({w: 256, h: 320});
  const HAZARD_RUNTIME = Object.freeze({x: 235, y: 690, w: 825, h: 30});
  const SPIKE_SPACING_TARGET = 24;
  const HAZARD_VARIANTS = Object.freeze([
    Object.freeze({
      name: "crystalCave_hazard_01",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_01.png",
      source: Object.freeze({x: 57, y: 8, w: 138, h: 289})
    }),
    Object.freeze({
      name: "crystalCave_hazard_02",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_02.png",
      source: Object.freeze({x: 55, y: 8, w: 138, h: 289})
    }),
    Object.freeze({
      name: "crystalCave_hazard_03",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_03.png",
      source: Object.freeze({x: 55, y: 8, w: 201, h: 289})
    }),
    Object.freeze({
      name: "crystalCave_hazard_04",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_04.png",
      source: Object.freeze({x: 25, y: 8, w: 170, h: 289})
    }),
    Object.freeze({
      name: "crystalCave_hazard_05",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_05.png",
      source: Object.freeze({x: 4, y: 8, w: 190, h: 295})
    }),
    Object.freeze({
      name: "crystalCave_hazard_06",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_06.png",
      source: Object.freeze({x: 55, y: 8, w: 166, h: 295})
    }),
    Object.freeze({
      name: "crystalCave_hazard_07",
      path: "assets/environments/crystalCave/hazards/crystalCave_hazard_07.png",
      source: Object.freeze({x: 52, y: 8, w: 140, h: 294})
    })
  ]);
  const GLOW_PULSE_MINIMUM_FACTOR = 0.24;
  const GLOW_INNER_STOP_POSITION = 0.18;
  const GLOW_INNER_STOP_ALPHA_FACTOR = 0.92;
  const GLOW_MIDDLE_STOP_POSITION = 0.52;
  const GLOW_MIDDLE_STOP_ALPHA_FACTOR = 0.62;
  const GLOW_MAP = Object.freeze([
    Object.freeze({x: 198, y: 107, radius: 48, color: "#4c8dff", strength: 0.160, period: 7.3, phase: 0.2, depth: "back"}),
    Object.freeze({x: 574, y: 108, radius: 58, color: "#65e4ff", strength: 0.145, period: 8.1, phase: 1.4, depth: "back"}),
    Object.freeze({x: 1029, y: 168, radius: 58, color: "#8766ff", strength: 0.160, period: 7.7, phase: 2.6, depth: "back"}),
    Object.freeze({x: 762, y: 324, radius: 42, color: "#a56fff", strength: 0.130, period: 6.9, phase: 4.1, depth: "back"}),
    Object.freeze({x: 840, y: 310, radius: 44, color: "#45dce8", strength: 0.140, period: 8.6, phase: 5.2, depth: "back"}),
    Object.freeze({x: 580, y: 320, radius: 48, color: "#c470ff", strength: 0.170, period: 7.1, phase: 0.8, depth: "back"}),
    Object.freeze({x: 714, y: 414, radius: 56, color: "#41e2df", strength: 0.200, period: 7.9, phase: 3.1, depth: "back"}),
    Object.freeze({x: 729, y: 466, radius: 42, color: "#ef79df", strength: 0.150, period: 6.7, phase: 5.5, depth: "back"}),
    Object.freeze({x: 326, y: 267, radius: 72, color: "#5592ff", strength: 0.310, period: 6.8, phase: 0.9, depth: "middle"}),
    Object.freeze({x: 236, y: 351, radius: 62, color: "#ffd663", strength: 0.270, period: 7.6, phase: 2.2, depth: "middle"}),
    Object.freeze({x: 463, y: 420, radius: 78, color: "#55a9ff", strength: 0.330, period: 8.3, phase: 4.7, depth: "middle"}),
    Object.freeze({x: 267, y: 447, radius: 74, color: "#3d8dff", strength: 0.340, period: 7.2, phase: 5.8, depth: "middle"}),
    Object.freeze({x: 404, y: 486, radius: 70, color: "#ffd56a", strength: 0.300, period: 8.8, phase: 1.7, depth: "middle"}),
    Object.freeze({x: 1112, y: 211, radius: 72, color: "#a26cff", strength: 0.280, period: 7.4, phase: 3.8, depth: "middle"}),
    Object.freeze({x: 1191, y: 277, radius: 74, color: "#438cff", strength: 0.310, period: 8.5, phase: 0.5, depth: "middle"}),
    Object.freeze({x: 804, y: 111, radius: 86, color: "#ffc84f", strength: 0.380, period: 7.0, phase: 4.6, depth: "middle"}),
    Object.freeze({x: 1128, y: 111, radius: 82, color: "#52e8ff", strength: 0.340, period: 8.2, phase: 2.9, depth: "middle"}),
    Object.freeze({x: 102, y: 135, radius: 148, color: "#42f0e6", strength: 0.620, period: 5.8, phase: 0.3, depth: "front"}),
    Object.freeze({x: 343, y: 125, radius: 138, color: "#dd63ff", strength: 0.580, period: 6.3, phase: 2.1, depth: "front"}),
    Object.freeze({x: 1000, y: 327, radius: 154, color: "#b75cff", strength: 0.650, period: 5.5, phase: 4.4, depth: "front"}),
    Object.freeze({x: 1147, y: 445, radius: 132, color: "#70e34d", strength: 0.520, period: 6.1, phase: 1.2, depth: "front"}),
    Object.freeze({x: 122, y: 418, radius: 140, color: "#ff7a36", strength: 0.640, period: 5.7, phase: 3.5, depth: "front"}),
    Object.freeze({x: 277, y: 559, radius: 132, color: "#79e64d", strength: 0.500, period: 6.6, phase: 5.0, depth: "front"}),
    Object.freeze({x: 927, y: 532, radius: 124, color: "#ff7240", strength: 0.560, period: 5.9, phase: 0.7, depth: "front"}),
    Object.freeze({x: 1113, y: 616, radius: 160, color: "#38ddff", strength: 0.680, period: 6.4, phase: 2.8, depth: "front"}),
    Object.freeze({x: 89, y: 617, radius: 124, color: "#8f62ff", strength: 0.480, period: 6.0, phase: 4.9, depth: "front"})
  ]);
  const LIGHT_MOTE_PULSE_MINIMUM_FACTOR = 0.38;
  const LIGHT_MOTES = Object.freeze([
    Object.freeze({x: 170, y: 240, radius: 4.4, color: "#9dff91", alpha: 0.50, driftAmplitudeX: 12, driftPeriodX: 20, driftAmplitudeY: 7, driftPeriodY: 11, driftPhase: 0.3, pulsePeriod: 3.8, pulsePhase: 0.7}),
    Object.freeze({x: 360, y: 210, radius: 5.2, color: "#b2ff84", alpha: 0.57, driftAmplitudeX: 16, driftPeriodX: 23, driftAmplitudeY: 6, driftPeriodY: 13, driftPhase: 1.6, pulsePeriod: 4.6, pulsePhase: 2.1}),
    Object.freeze({x: 520, y: 300, radius: 4.0, color: "#83f59c", alpha: 0.45, driftAmplitudeX: 10, driftPeriodX: 17, driftAmplitudeY: 8, driftPeriodY: 12, driftPhase: 2.8, pulsePeriod: 3.4, pulsePhase: 4.2}),
    Object.freeze({x: 680, y: 225, radius: 5.6, color: "#a6ff8c", alpha: 0.59, driftAmplitudeX: 18, driftPeriodX: 24, driftAmplitudeY: 9, driftPeriodY: 15, driftPhase: 4.1, pulsePeriod: 5.1, pulsePhase: 1.3}),
    Object.freeze({x: 865, y: 245, radius: 4.6, color: "#8df79a", alpha: 0.48, driftAmplitudeX: 13, driftPeriodX: 19, driftAmplitudeY: 5, driftPeriodY: 10, driftPhase: 5.2, pulsePeriod: 3.6, pulsePhase: 5.4}),
    Object.freeze({x: 1065, y: 285, radius: 5.0, color: "#adff88", alpha: 0.54, driftAmplitudeX: 15, driftPeriodX: 22, driftAmplitudeY: 8, driftPeriodY: 14, driftPhase: 0.9, pulsePeriod: 4.3, pulsePhase: 3.0}),
    Object.freeze({x: 210, y: 510, radius: 5.8, color: "#92fa98", alpha: 0.58, driftAmplitudeX: 17, driftPeriodX: 21, driftAmplitudeY: 10, driftPeriodY: 15, driftPhase: 2.2, pulsePeriod: 4.8, pulsePhase: 0.2}),
    Object.freeze({x: 390, y: 570, radius: 4.2, color: "#b5ff8e", alpha: 0.44, driftAmplitudeX: 11, driftPeriodX: 18, driftAmplitudeY: 6, driftPeriodY: 9, driftPhase: 3.5, pulsePeriod: 3.2, pulsePhase: 4.8}),
    Object.freeze({x: 570, y: 505, radius: 5.4, color: "#87f89f", alpha: 0.53, driftAmplitudeX: 14, driftPeriodX: 24, driftAmplitudeY: 9, driftPeriodY: 13, driftPhase: 4.8, pulsePeriod: 4.1, pulsePhase: 1.8}),
    Object.freeze({x: 760, y: 560, radius: 4.8, color: "#a8ff92", alpha: 0.51, driftAmplitudeX: 16, driftPeriodX: 20, driftAmplitudeY: 7, driftPeriodY: 12, driftPhase: 5.9, pulsePeriod: 3.9, pulsePhase: 3.7}),
    Object.freeze({x: 970, y: 475, radius: 6.0, color: "#96fb8f", alpha: 0.61, driftAmplitudeX: 18, driftPeriodX: 23, driftAmplitudeY: 10, driftPeriodY: 14, driftPhase: 1.3, pulsePeriod: 5.0, pulsePhase: 5.6}),
    Object.freeze({x: 1170, y: 535, radius: 4.4, color: "#a1ff86", alpha: 0.47, driftAmplitudeX: 12, driftPeriodX: 16, driftAmplitudeY: 8, driftPeriodY: 11, driftPhase: 3.0, pulsePeriod: 3.5, pulsePhase: 2.9}),
    Object.freeze({x: 95, y: 375, radius: 4.8, color: "#a1ff86", alpha: 0.50, driftAmplitudeX: 13, driftPeriodX: 22, driftAmplitudeY: 6, driftPeriodY: 12, driftPhase: 0.95, pulsePeriod: 4.4, pulsePhase: 2.55}),
    Object.freeze({x: 640, y: 390, radius: 5.4, color: "#8df79a", alpha: 0.56, driftAmplitudeX: 17, driftPeriodX: 23, driftAmplitudeY: 9, driftPeriodY: 14, driftPhase: 3.35, pulsePeriod: 4.9, pulsePhase: 0.95}),
    Object.freeze({x: 1160, y: 385, radius: 4.6, color: "#adff88", alpha: 0.49, driftAmplitudeX: 11, driftPeriodX: 18, driftAmplitudeY: 7, driftPeriodY: 10, driftPhase: 5.65, pulsePeriod: 3.7, pulsePhase: 4.55})
  ]);
  const assets = {};

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

  loadAsset("background", BACKGROUND_PATH);
  for (const variant of HAZARD_VARIANTS) {
    loadAsset(variant.name, variant.path);
  }

  function hasValidSize(name, expectedSize) {
    const image = assets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === expectedSize.w &&
      image.naturalHeight === expectedSize.h
    );
  }

  function isBackgroundReady() {
    return hasValidSize("background", BACKGROUND_REFERENCE);
  }

  function areBottomSpikeHazardsReady() {
    return HAZARD_VARIANTS.every(variant => (
      hasValidSize(variant.name, HAZARD_REFERENCE)
    ));
  }

  const backgroundReadyPromise = assets.background.ready.then(
    () => isBackgroundReady()
  );
  const bottomSpikeHazardReadyPromise = Promise.all(
    HAZARD_VARIANTS.map(variant => assets[variant.name].ready)
  ).then(() => areBottomSpikeHazardsReady());

  function getColorChannels(hexColor) {
    const value = Number.parseInt(hexColor.slice(1), 16);
    return Object.freeze({
      r: value >> 16 & 0xff,
      g: value >> 8 & 0xff,
      b: value & 0xff
    });
  }

  function drawGlow(context, glow, visualTime) {
    const pulse = (
      Math.sin(visualTime * Math.PI * 2 / glow.period + glow.phase) + 1
    ) / 2;
    const alpha = glow.strength * (
      GLOW_PULSE_MINIMUM_FACTOR +
      pulse * (1 - GLOW_PULSE_MINIMUM_FACTOR)
    );
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

  function getLightMoteMapping(visualTime = 0) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return Object.freeze(LIGHT_MOTES.map(mote => {
      const xPhase = safeTime * Math.PI * 2 / mote.driftPeriodX +
        mote.driftPhase;
      const yPhase = safeTime * Math.PI * 2 / mote.driftPeriodY +
        mote.driftPhase + Math.PI / 2;
      const pulse = (
        Math.sin(
          safeTime * Math.PI * 2 / mote.pulsePeriod + mote.pulsePhase
        ) + 1
      ) / 2;
      return Object.freeze({
        x: mote.x + Math.sin(xPhase) * mote.driftAmplitudeX,
        y: mote.y + Math.sin(yPhase) * mote.driftAmplitudeY,
        radius: mote.radius,
        color: mote.color,
        alpha: mote.alpha * (
          LIGHT_MOTE_PULSE_MINIMUM_FACTOR +
          pulse * (1 - LIGHT_MOTE_PULSE_MINIMUM_FACTOR)
        )
      });
    }));
  }

  function drawLightMote(context, mote) {
    const color = getColorChannels(mote.color);
    const gradient = context.createRadialGradient(
      mote.x,
      mote.y,
      0,
      mote.x,
      mote.y,
      mote.radius
    );
    gradient.addColorStop(
      0,
      `rgba(${color.r},${color.g},${color.b},${mote.alpha})`
    );
    gradient.addColorStop(
      0.30,
      `rgba(${color.r},${color.g},${color.b},${mote.alpha * 0.72})`
    );
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
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
      assets.background.image,
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
    for (const glow of GLOW_MAP) drawGlow(context, glow, safeTime);
    for (const mote of getLightMoteMapping(safeTime)) {
      drawLightMote(context, mote);
    }
    context.restore();
    context.restore();
    return true;
  }

  function getBottomSpikeHazardMapping(rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.x !== HAZARD_RUNTIME.x ||
      rect.y !== HAZARD_RUNTIME.y ||
      rect.w !== HAZARD_RUNTIME.w ||
      rect.h !== HAZARD_RUNTIME.h
    ) return null;
    const count = Math.max(2, Math.floor(rect.w / SPIKE_SPACING_TARGET));
    const step = rect.w / count;
    return Object.freeze({
      count,
      step,
      destinations: Object.freeze(Array.from({length: count}, (_, index) => {
        const variantIndex = index % HAZARD_VARIANTS.length;
        return Object.freeze({
          index,
          variantIndex,
          source: HAZARD_VARIANTS[variantIndex].source,
          destination: Object.freeze({
            x: rect.x + index * step,
            y: rect.y,
            w: step,
            h: rect.h
          })
        });
      }))
    });
  }

  function drawBottomDeathHazard(context, rect) {
    if (!context || !areBottomSpikeHazardsReady()) return false;
    const mapping = getBottomSpikeHazardMapping(rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    for (const item of mapping.destinations) {
      const variant = HAZARD_VARIANTS[item.variantIndex];
      const source = item.source;
      const destination = item.destination;
      context.drawImage(
        assets[variant.name].image,
        source.x,
        source.y,
        source.w,
        source.h,
        destination.x,
        destination.y,
        destination.w,
        destination.h
      );
    }
    context.restore();
    return true;
  }

  const crystalCaveVisuals = Object.freeze({
    ...crystalCavePlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getLightMoteMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      path: BACKGROUND_PATH,
      expectedNativeSize: BACKGROUND_REFERENCE,
      glowMap: GLOW_MAP,
      glowAnimation: Object.freeze({
        pulseMinimumFactor: GLOW_PULSE_MINIMUM_FACTOR,
        pulseMaximumFactor: 1,
        innerColorStopPosition: GLOW_INNER_STOP_POSITION,
        innerColorStopAlphaFactor: GLOW_INNER_STOP_ALPHA_FACTOR,
        middleColorStopPosition: GLOW_MIDDLE_STOP_POSITION,
        middleColorStopAlphaFactor: GLOW_MIDDLE_STOP_ALPHA_FACTOR,
        compositeOperation: "screen"
      }),
      lightMotes: LIGHT_MOTES,
      lightMoteAnimation: Object.freeze({
        count: LIGHT_MOTES.length,
        pulseMinimumFactor: LIGHT_MOTE_PULSE_MINIMUM_FACTOR,
        compositeOperation: "screen",
        drawOrder: "after-crystal-glows"
      })
    }),
    whenBottomSpikeHazardsReady: () => bottomSpikeHazardReadyPromise,
    areBottomSpikeHazardsReady,
    getBottomSpikeHazardMapping,
    drawBottomDeathHazard,
    getBottomSpikeHazardStatus: () => Object.freeze({
      ready: areBottomSpikeHazardsReady(),
      paths: Object.freeze(HAZARD_VARIANTS.map(variant => variant.path)),
      expectedNativeSize: HAZARD_REFERENCE,
      sourceBounds: Object.freeze(
        HAZARD_VARIANTS.map(variant => variant.source)
      ),
      runtimeRect: HAZARD_RUNTIME,
      spacingTarget: SPIKE_SPACING_TARGET,
      distribution: "index-modulo-7"
    })
  });
  BIOME_PLATFORM_VISUALS.register("crystalCave", crystalCaveVisuals);
  return crystalCaveVisuals;
})();
