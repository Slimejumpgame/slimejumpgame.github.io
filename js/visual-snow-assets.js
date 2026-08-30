"use strict";

const SNOW_ASSET_VISUALS = (() => {
  const snowPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("snow");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skyBase: "assets/environments/snow/background/snow_background_sky_base.png",
    cloudsBack: "assets/environments/snow/background/snow_background_clouds_back.png",
    mountains: "assets/environments/snow/background/snow_background_mountains.png",
    cloudsFront: "assets/environments/snow/background/snow_background_clouds_front.png",
    snowflakes: "assets/environments/snow/background/snow_background_snowflakes.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skyBase",
    "mountains"
  ]);
  const BACK_CLOUD_LEFT_SPEED = 6;
  const BACK_CLOUD_WRAP_OVERLAP = 15;
  const FRONT_CLOUD_LEFT_SPEED = 12;
  const FRONT_CLOUD_WRAP_OVERLAP = 277;
  const SNOWFLAKE_FALL_SPEED = 8;
  const SNOWFLAKE_X_SWAY_AMPLITUDE = 3;
  const SNOWFLAKE_X_SWAY_PERIOD_SECONDS = 13;
  const SNOWFLAKE_X_SWAY_PHASE = 0.7;
  const ICE_WATER_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const ICE_WATER_HAZARD_PATHS = Object.freeze({
    base: "assets/environments/snow/hazards/snow_hazard_base.png",
    wave01: "assets/environments/snow/hazards/snow_hazard_wave_01.png"
  });
  const WAVE_01_SPEED = 10;
  const WAVE_01_BOB_SPEED = 1.1;
  const WAVE_01_BOB_AMPLITUDE = 0.5;
  const WAVE_WATER_CLIP_SOURCE_Y = 20;
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const iceWaterHazardAssets = {};
  let waveAlphaUsage = null;

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
    const copyOffsets = isFront
      ? [-wrapDistance, 0, wrapDistance]
      : [0, wrapDistance];
    return Object.freeze({
      offsetX,
      offsetY: 0,
      wrapDistance,
      destinations: Object.freeze(copyOffsets.map(copyOffset => (
        Object.freeze({
          x: (offsetX + copyOffset) * mapping.scaleX,
          y: 0,
          w: mapping.destination.w,
          h: mapping.destination.h
        })
      )))
    });
  }

  function getSnowflakeMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travel = (
      (safeTime * SNOWFLAKE_FALL_SPEED) % BACKGROUND_REFERENCE.h +
      BACKGROUND_REFERENCE.h
    ) % BACKGROUND_REFERENCE.h;
    const offsetX = Math.sin(
      safeTime * Math.PI * 2 / SNOWFLAKE_X_SWAY_PERIOD_SECONDS +
      SNOWFLAKE_X_SWAY_PHASE
    ) * SNOWFLAKE_X_SWAY_AMPLITUDE;
    const offsetY = travel - BACKGROUND_REFERENCE.h;
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

  function drawBackground(context, width, height, visualTime = 0) {
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawBackgroundLayer(context, "skyBase", mapping);
    if (isBackgroundLayerReady("cloudsBack")) {
      const cloudsBack = getCloudMapping(visualTime, mapping, "back");
      for (const destination of cloudsBack.destinations) {
        drawBackgroundLayer(context, "cloudsBack", mapping, destination);
      }
    }
    drawBackgroundLayer(context, "mountains", mapping);
    if (isBackgroundLayerReady("cloudsFront")) {
      const cloudsFront = getCloudMapping(visualTime, mapping, "front");
      for (const destination of cloudsFront.destinations) {
        drawBackgroundLayer(context, "cloudsFront", mapping, destination);
      }
    }
    if (isBackgroundLayerReady("snowflakes")) {
      const snowflakes = getSnowflakeMapping(visualTime, mapping);
      for (const destination of snowflakes.destinations) {
        drawBackgroundLayer(context, "snowflakes", mapping, destination);
      }
    }
    context.restore();
    return true;
  }

  function hasValidIceWaterHazardSize(name) {
    const image = iceWaterHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === ICE_WATER_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === ICE_WATER_HAZARD_CONTRACT.native.h
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
      surface.width = ICE_WATER_HAZARD_CONTRACT.native.w;
      surface.height = ICE_WATER_HAZARD_CONTRACT.native.h;
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

  function isIceWaterWaveReady() {
    return hasValidIceWaterHazardSize("wave01") && Boolean(
      waveAlphaUsage?.hasVisiblePixels && waveAlphaUsage.hasTransparentPixels
    );
  }

  function loadIceWaterHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    iceWaterHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidIceWaterHazardSize(name);
        if (validSize && name === "wave01") {
          waveAlphaUsage = analyzeAlphaUsage(image);
        }
        resolve(validSize && (name === "base" || isIceWaterWaveReady()));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  for (const [name, path] of Object.entries(ICE_WATER_HAZARD_PATHS)) {
    loadIceWaterHazardAsset(name, path);
  }
  const iceWaterHazardReadyPromise = Promise.all(
    Object.values(iceWaterHazardAssets).map(record => record.ready)
  ).then(() => isIceWaterHazardReady());

  function isIceWaterHazardReady() {
    return hasValidIceWaterHazardSize("base");
  }

  function getSignedWrappedOffset(visualTime, speed, width) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const distance = Math.abs(safeTime * speed) % width;
    return Math.sign(speed) * distance;
  }

  function getWrappedWaveDestinations(rect, offsetX, offsetY) {
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

  function getIceWaterHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.w !== ICE_WATER_HAZARD_CONTRACT.runtime.w ||
      rect.h !== ICE_WATER_HAZARD_CONTRACT.runtime.h
    ) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const waveOffsetX = getSignedWrappedOffset(
      safeTime,
      WAVE_01_SPEED,
      rect.w
    );
    const waveOffsetY = Math.sin(safeTime * WAVE_01_BOB_SPEED) *
      WAVE_01_BOB_AMPLITUDE;
    const protectedIceHeight = WAVE_WATER_CLIP_SOURCE_Y *
      ICE_WATER_HAZARD_CONTRACT.nativeToRuntimeScale;
    return Object.freeze({
      source: ICE_WATER_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      protectedIceHeight,
      waveClip: Object.freeze({
        x: rect.x,
        y: rect.y + protectedIceHeight,
        w: rect.w,
        h: rect.h - protectedIceHeight
      }),
      wave01: Object.freeze({
        offsetX: waveOffsetX,
        offsetY: waveOffsetY,
        destinations: getWrappedWaveDestinations(
          rect,
          waveOffsetX,
          waveOffsetY
        )
      })
    });
  }

  function drawIceWaterHazardLayer(context, name, source, destination) {
    context.drawImage(
      iceWaterHazardAssets[name].image,
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
    if (!context || !isIceWaterHazardReady()) return false;
    const mapping = getIceWaterHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawIceWaterHazardLayer(context, "base", mapping.source, mapping.base);
    if (isIceWaterWaveReady()) {
      context.save();
      context.beginPath();
      context.rect(
        mapping.waveClip.x,
        mapping.waveClip.y,
        mapping.waveClip.w,
        mapping.waveClip.h
      );
      context.clip();
      for (const destination of mapping.wave01.destinations) {
        drawIceWaterHazardLayer(context, "wave01", mapping.source, destination);
      }
      context.restore();
    }
    context.restore();
    return true;
  }

  const snowVisuals = Object.freeze({
    ...snowPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getBackgroundMapping,
    getCloudMapping,
    getSnowflakeMapping,
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
      backCloudAnimation: Object.freeze({
        leftSpeed: BACK_CLOUD_LEFT_SPEED,
        ySpeed: 0,
        wrapDistance: BACKGROUND_REFERENCE.w - BACK_CLOUD_WRAP_OVERLAP,
        overlap: BACK_CLOUD_WRAP_OVERLAP,
        drawCopies: 2,
        direction: "right-to-left"
      }),
      frontCloudAnimation: Object.freeze({
        leftSpeed: FRONT_CLOUD_LEFT_SPEED,
        ySpeed: 0,
        wrapDistance: BACKGROUND_REFERENCE.w - FRONT_CLOUD_WRAP_OVERLAP,
        overlap: FRONT_CLOUD_WRAP_OVERLAP,
        drawCopies: 3,
        direction: "right-to-left"
      }),
      snowflakeAnimation: Object.freeze({
        fallSpeed: SNOWFLAKE_FALL_SPEED,
        xSwayAmplitude: SNOWFLAKE_X_SWAY_AMPLITUDE,
        xSwayPeriodSeconds: SNOWFLAKE_X_SWAY_PERIOD_SECONDS,
        xSwayPhase: SNOWFLAKE_X_SWAY_PHASE,
        wrapCopies: 4
      })
    }),
    whenIceWaterHazardReady: () => iceWaterHazardReadyPromise,
    isIceWaterHazardReady,
    isIceWaterWaveReady,
    getIceWaterHazardMapping,
    drawBottomDeathHazard,
    getIceWaterHazardStatus: () => Object.freeze({
      ready: isIceWaterHazardReady(),
      waveReady: isIceWaterWaveReady(),
      paths: ICE_WATER_HAZARD_PATHS,
      contract: ICE_WATER_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(ICE_WATER_HAZARD_PATHS).map(name => [
          name,
          hasValidIceWaterHazardSize(name)
        ])
      )),
      waveAlphaUsage,
      waveAnimation: Object.freeze({
        speed: WAVE_01_SPEED,
        bobSpeed: WAVE_01_BOB_SPEED,
        bobAmplitude: WAVE_01_BOB_AMPLITUDE
      }),
      waterClip: Object.freeze({
        sourceY: WAVE_WATER_CLIP_SOURCE_Y,
        runtimeTopOffset: WAVE_WATER_CLIP_SOURCE_Y *
          ICE_WATER_HAZARD_CONTRACT.nativeToRuntimeScale
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("snow", snowVisuals);
  return snowVisuals;
})();
