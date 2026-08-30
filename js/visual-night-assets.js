"use strict";

const NIGHT_ASSET_VISUALS = (() => {
  const nightPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("night");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox: "assets/environments/night/background/night_background_skybox.png",
    stars: "assets/environments/night/background/night_background_stars.png",
    cloudsBack: "assets/environments/night/background/night_background_clouds_back.png",
    moon: "assets/environments/night/background/night_background_moon.png",
    landscape: "assets/environments/night/background/night_background_landscape.png",
    cloudsFront: "assets/environments/night/background/night_background_clouds_front.png"
  });
  const NIGHT_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const NIGHT_HAZARD_PATHS = Object.freeze({
    base: "assets/environments/night/hazards/night_hazard_base.png",
    wave01: "assets/environments/night/hazards/night_hazard_wave_01.png",
    wave02: "assets/environments/night/hazards/night_hazard_wave_02.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "moon",
    "landscape"
  ]);
  const BACK_CLOUD_LEFT_SPEED = 6;
  const BACK_CLOUD_WRAP_OVERLAP = 65;
  const FRONT_CLOUD_LEFT_SPEED = 12;
  const FRONT_CLOUD_WRAP_OVERLAP = 45;
  const HAZARD_WAVE_01_X_SPEED = 10;
  const HAZARD_WAVE_02_X_SPEED = -16;
  const STAR_PULSE_MINIMUM_FACTOR = 0.20;
  const STAR_PULSES = Object.freeze([
    Object.freeze({x: 61, y: 41, radius: 10, color: "#d8f5ff", strength: 0.78, period: 3.2, phase: 0.15}),
    Object.freeze({x: 114, y: 44, radius: 12, color: "#bfeeff", strength: 0.81, period: 4.7, phase: 2.40}),
    Object.freeze({x: 286, y: 56, radius: 26, color: "#a9e8ff", strength: 1.00, period: 5.3, phase: 4.80}),
    Object.freeze({x: 518, y: 22, radius: 10, color: "#c8f3ff", strength: 0.80, period: 3.8, phase: 1.20}),
    Object.freeze({x: 597, y: 75, radius: 20, color: "#d8f5ff", strength: 0.92, period: 4.4, phase: 3.70}),
    Object.freeze({x: 735, y: 95, radius: 24, color: "#bfeeff", strength: 0.97, period: 5.7, phase: 5.50}),
    Object.freeze({x: 1006, y: 36, radius: 12, color: "#a9e8ff", strength: 0.83, period: 3.5, phase: 0.85}),
    Object.freeze({x: 1177, y: 17, radius: 12, color: "#c8f3ff", strength: 0.83, period: 4.9, phase: 2.85}),
    Object.freeze({x: 1227, y: 49, radius: 22, color: "#d8f5ff", strength: 0.95, period: 5.1, phase: 4.35}),
    Object.freeze({x: 130, y: 117, radius: 22, color: "#bfeeff", strength: 0.93, period: 3.9, phase: 1.65}),
    Object.freeze({x: 436, y: 85, radius: 14, color: "#a9e8ff", strength: 0.85, period: 4.2, phase: 3.15}),
    Object.freeze({x: 473, y: 107, radius: 14, color: "#c8f3ff", strength: 0.86, period: 5.5, phase: 5.95}),
    Object.freeze({x: 334, y: 173, radius: 20, color: "#d8f5ff", strength: 0.92, period: 3.3, phase: 0.45}),
    Object.freeze({x: 784, y: 184, radius: 15, color: "#bfeeff", strength: 0.87, period: 4.6, phase: 2.05}),
    Object.freeze({x: 1133, y: 86, radius: 17, color: "#a9e8ff", strength: 0.89, period: 5.9, phase: 4.65}),
    Object.freeze({x: 1149, y: 211, radius: 24, color: "#c8f3ff", strength: 0.97, period: 3.6, phase: 1.05}),
    Object.freeze({x: 61, y: 216, radius: 15, color: "#d8f5ff", strength: 0.85, period: 4.1, phase: 3.45}),
    Object.freeze({x: 199, y: 257, radius: 18, color: "#bfeeff", strength: 0.91, period: 5.0, phase: 5.15}),
    Object.freeze({x: 495, y: 244, radius: 14, color: "#a9e8ff", strength: 0.88, period: 3.7, phase: 0.65}),
    Object.freeze({x: 398, y: 316, radius: 24, color: "#c8f3ff", strength: 0.98, period: 5.4, phase: 2.65}),
    Object.freeze({x: 684, y: 345, radius: 20, color: "#d8f5ff", strength: 0.93, period: 4.5, phase: 4.05}),
    Object.freeze({x: 1009, y: 274, radius: 14, color: "#bfeeff", strength: 0.86, period: 3.4, phase: 5.75}),
    Object.freeze({x: 1044, y: 321, radius: 14, color: "#a9e8ff", strength: 0.88, period: 5.2, phase: 1.85}),
    Object.freeze({x: 993, y: 405, radius: 24, color: "#c8f3ff", strength: 0.98, period: 4.0, phase: 3.85}),
    Object.freeze({x: 1188, y: 372, radius: 18, color: "#d8f5ff", strength: 0.92, period: 5.6, phase: 5.35}),
    Object.freeze({x: 147, y: 383, radius: 20, color: "#bfeeff", strength: 0.93, period: 4.8, phase: 1.45})
  ]);
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const nightHazardAssets = {};
  const nightHazardAlphaUsage = {};

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
      name === "skybox" || hasValidBackgroundAlpha(name)
    );
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidBackgroundSize(name);
        if (validSize && name !== "skybox") {
          backgroundAlphaUsage[name] = analyzeBackgroundAlphaUsage(image);
        }
        resolve(validSize && (
          name === "skybox" || hasValidBackgroundAlpha(name)
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

  function getCloudMapping(visualTime, mapping, layer) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const isFront = layer === "front";
    const leftSpeed = isFront
      ? FRONT_CLOUD_LEFT_SPEED
      : BACK_CLOUD_LEFT_SPEED;
    const overlap = isFront
      ? FRONT_CLOUD_WRAP_OVERLAP
      : BACK_CLOUD_WRAP_OVERLAP;
    const wrapDistance = BACKGROUND_REFERENCE.w - overlap;
    const travel = (
      (safeTime * leftSpeed) % wrapDistance + wrapDistance
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

  function getColorChannels(hexColor) {
    const value = Number.parseInt(hexColor.slice(1), 16);
    return Object.freeze({
      r: value >> 16 & 0xff,
      g: value >> 8 & 0xff,
      b: value & 0xff
    });
  }

  function getStarPulseMapping(visualTime = 0) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    return Object.freeze(STAR_PULSES.map(star => {
      const pulse = (
        Math.sin(safeTime * Math.PI * 2 / star.period + star.phase) + 1
      ) / 2;
      return Object.freeze({
        x: star.x,
        y: star.y,
        radius: star.radius,
        color: star.color,
        alpha: star.strength * (
          STAR_PULSE_MINIMUM_FACTOR +
          pulse * (1 - STAR_PULSE_MINIMUM_FACTOR)
        )
      });
    }));
  }

  function drawStarPulse(context, star) {
    const color = getColorChannels(star.color);
    const gradient = context.createRadialGradient(
      star.x,
      star.y,
      0,
      star.x,
      star.y,
      star.radius
    );
    gradient.addColorStop(
      0,
      `rgba(${color.r},${color.g},${color.b},${star.alpha})`
    );
    gradient.addColorStop(
      0.22,
      `rgba(${color.r},${color.g},${color.b},${star.alpha * 0.90})`
    );
    gradient.addColorStop(
      0.52,
      `rgba(${color.r},${color.g},${color.b},${star.alpha * 0.60})`
    );
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
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
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    if (!mapping) return false;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    drawBackgroundLayer(context, "skybox", mapping);
    if (isBackgroundLayerReady("stars")) {
      drawBackgroundLayer(context, "stars", mapping);
      context.save();
      context.globalCompositeOperation = "screen";
      for (const star of getStarPulseMapping(safeTime)) {
        drawStarPulse(context, star);
      }
      context.restore();
    }
    if (isBackgroundLayerReady("cloudsBack")) {
      const cloudsBack = getCloudMapping(safeTime, mapping, "back");
      for (const destination of cloudsBack.destinations) {
        drawBackgroundLayer(context, "cloudsBack", mapping, destination);
      }
    }
    drawBackgroundLayer(context, "moon", mapping);
    drawBackgroundLayer(context, "landscape", mapping);
    if (isBackgroundLayerReady("cloudsFront")) {
      const cloudsFront = getCloudMapping(safeTime, mapping, "front");
      for (const destination of cloudsFront.destinations) {
        drawBackgroundLayer(context, "cloudsFront", mapping, destination);
      }
    }
    context.restore();
    return true;
  }

  function hasValidNightHazardSize(name) {
    const image = nightHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === NIGHT_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === NIGHT_HAZARD_CONTRACT.native.h
    );
  }

  function analyzeNightHazardAlphaUsage(image) {
    if (
      typeof document === "undefined" ||
      !document.createElement ||
      !image
    ) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = NIGHT_HAZARD_CONTRACT.native.w;
      surface.height = NIGHT_HAZARD_CONTRACT.native.h;
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

  function isNightHazardLayerReady(name) {
    if (!hasValidNightHazardSize(name)) return false;
    if (name === "base") return true;
    const usage = nightHazardAlphaUsage[name];
    return Boolean(usage?.hasVisiblePixels && usage.hasTransparentPixels);
  }

  function loadNightHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    nightHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidNightHazardSize(name);
        if (validSize && name !== "base") {
          nightHazardAlphaUsage[name] = analyzeNightHazardAlphaUsage(image);
        }
        resolve(isNightHazardLayerReady(name));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(NIGHT_HAZARD_PATHS)) {
    loadNightHazardAsset(name, path);
  }
  const nightHazardReadyPromise = Promise.all(
    Object.values(nightHazardAssets).map(record => record.ready)
  ).then(() => isNightHazardReady());

  function isNightHazardReady() {
    return isNightHazardLayerReady("base");
  }

  function getSignedWrappedOffset(visualTime, speed, width) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const distance = Math.abs(safeTime * speed) % width;
    return Math.sign(speed) * distance;
  }

  function getWrappedNightHazardDestinations(rect, offsetX) {
    const firstX = offsetX >= 0
      ? rect.x + offsetX - rect.w
      : rect.x + offsetX;
    return Object.freeze([
      Object.freeze({x: firstX, y: rect.y, w: rect.w, h: rect.h}),
      Object.freeze({
        x: firstX + rect.w,
        y: rect.y,
        w: rect.w,
        h: rect.h
      })
    ]);
  }

  function getNightHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.w !== NIGHT_HAZARD_CONTRACT.runtime.w ||
      rect.h !== NIGHT_HAZARD_CONTRACT.runtime.h
    ) return null;
    const wave01OffsetX = getSignedWrappedOffset(
      visualTime,
      HAZARD_WAVE_01_X_SPEED,
      rect.w
    );
    const wave02OffsetX = getSignedWrappedOffset(
      visualTime,
      HAZARD_WAVE_02_X_SPEED,
      rect.w
    );
    return Object.freeze({
      source: NIGHT_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      wave01: Object.freeze({
        offsetX: wave01OffsetX,
        offsetY: 0,
        destinations: getWrappedNightHazardDestinations(rect, wave01OffsetX)
      }),
      wave02: Object.freeze({
        offsetX: wave02OffsetX,
        offsetY: 0,
        destinations: getWrappedNightHazardDestinations(rect, wave02OffsetX)
      })
    });
  }

  function drawNightHazardLayer(context, name, source, destination) {
    context.drawImage(
      nightHazardAssets[name].image,
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
    if (!context || !isNightHazardReady()) return false;
    const mapping = getNightHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawNightHazardLayer(context, "base", mapping.source, mapping.base);
    if (isNightHazardLayerReady("wave02")) {
      for (const destination of mapping.wave02.destinations) {
        drawNightHazardLayer(context, "wave02", mapping.source, destination);
      }
    }
    if (isNightHazardLayerReady("wave01")) {
      for (const destination of mapping.wave01.destinations) {
        drawNightHazardLayer(context, "wave01", mapping.source, destination);
      }
    }
    context.restore();
    return true;
  }

  const nightVisuals = Object.freeze({
    ...nightPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getCloudMapping,
    getStarPulseMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      essentialLayers: ESSENTIAL_BACKGROUND_LAYERS,
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
      }),
      starPulses: STAR_PULSES,
      starPulseAnimation: Object.freeze({
        count: STAR_PULSES.length,
        pulseMinimumFactor: STAR_PULSE_MINIMUM_FACTOR,
        compositeOperation: "screen",
        drawOrder: "after-stars-before-clouds-back"
      })
    }),
    whenNightHazardReady: () => nightHazardReadyPromise,
    isNightHazardReady,
    isNightHazardLayerReady,
    getNightHazardMapping,
    drawBottomDeathHazard,
    getNightHazardStatus: () => Object.freeze({
      ready: isNightHazardReady(),
      paths: NIGHT_HAZARD_PATHS,
      contract: NIGHT_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(NIGHT_HAZARD_PATHS).map(name => [
          name,
          hasValidNightHazardSize(name)
        ])
      )),
      layerReady: Object.freeze(Object.fromEntries(
        Object.keys(NIGHT_HAZARD_PATHS).map(name => [
          name,
          isNightHazardLayerReady(name)
        ])
      )),
      waveAlphaUsage: Object.freeze({...nightHazardAlphaUsage}),
      animation: Object.freeze({
        wave01: Object.freeze({
          xSpeed: HAZARD_WAVE_01_X_SPEED,
          ySpeed: 0,
          wrapAxis: "x",
          drawCopies: 2
        }),
        wave02: Object.freeze({
          xSpeed: HAZARD_WAVE_02_X_SPEED,
          ySpeed: 0,
          wrapAxis: "x",
          drawCopies: 2
        })
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("night", nightVisuals);
  return nightVisuals;
})();
