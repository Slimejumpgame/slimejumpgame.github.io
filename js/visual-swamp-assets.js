"use strict";

const SWAMP_ASSET_VISUALS = (() => {
  const supportsLazyLoading =
    typeof BIOME_PLATFORM_VISUALS.registerLazy === "function" &&
    typeof BIOME_PLATFORM_VISUALS.createAssetLoader === "function";
  const swampPlatformVisuals = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.registerLazy("swamp")
    : BIOME_PLATFORM_VISUALS.resolve("swamp");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox: "assets/environments/swamp/background/swamp_background_skybox.png",
    treesBack: "assets/environments/swamp/background/swamp_background_trees_back.png",
    fogBack: "assets/environments/swamp/background/swamp_background_fog_back.png",
    treesMiddle: "assets/environments/swamp/background/swamp_background_trees_middle.png",
    fogFront: "assets/environments/swamp/background/swamp_background_fog_front.png",
    treesFront: "assets/environments/swamp/background/swamp_background_trees_front.png"
  });
  const TOXIC_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const TOXIC_HAZARD_PATHS = Object.freeze({
    base: "assets/environments/swamp/hazards/swamp_hazard_base.png",
    wave01: "assets/environments/swamp/hazards/swamp_hazard_wave_01.png",
    wave02: "assets/environments/swamp/hazards/swamp_hazard_wave_02.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "treesBack",
    "treesMiddle",
    "treesFront"
  ]);
  const FOG_BACK_LEFT_SPEED = 6;
  const FOG_BACK_WRAP_OVERLAP = 61;
  const FOG_FRONT_LEFT_SPEED = 10;
  const FOG_FRONT_WRAP_OVERLAP = 43;
  const WAVE_01_X_SPEED = 10;
  const WAVE_02_RISE_SPEED = 6;
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const toxicHazardAssets = {};
  const toxicHazardAlphaUsage = {};

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

  function getFogMapping(visualTime, mapping, layer) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const isFront = layer === "front";
    const leftSpeed = isFront
      ? FOG_FRONT_LEFT_SPEED
      : FOG_BACK_LEFT_SPEED;
    const overlap = isFront
      ? FOG_FRONT_WRAP_OVERLAP
      : FOG_BACK_WRAP_OVERLAP;
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
    drawBackgroundLayer(context, "treesBack", mapping);
    if (isBackgroundLayerReady("fogBack")) {
      const fogBack = getFogMapping(visualTime, mapping, "back");
      for (const destination of fogBack.destinations) {
        drawBackgroundLayer(context, "fogBack", mapping, destination);
      }
    }
    drawBackgroundLayer(context, "treesMiddle", mapping);
    if (isBackgroundLayerReady("fogFront")) {
      const fogFront = getFogMapping(visualTime, mapping, "front");
      for (const destination of fogFront.destinations) {
        drawBackgroundLayer(context, "fogFront", mapping, destination);
      }
    }
    drawBackgroundLayer(context, "treesFront", mapping);
    context.restore();
    return true;
  }

  function hasValidToxicHazardSize(name) {
    const image = toxicHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === TOXIC_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === TOXIC_HAZARD_CONTRACT.native.h
    );
  }

  function analyzeToxicHazardAlphaUsage(image) {
    if (
      typeof document === "undefined" ||
      !document.createElement ||
      !image
    ) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = TOXIC_HAZARD_CONTRACT.native.w;
      surface.height = TOXIC_HAZARD_CONTRACT.native.h;
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

  function isToxicHazardLayerReady(name) {
    if (!hasValidToxicHazardSize(name)) return false;
    if (name === "base") return true;
    const usage = toxicHazardAlphaUsage[name];
    return Boolean(usage?.hasVisiblePixels && usage.hasTransparentPixels);
  }

  function loadToxicHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    toxicHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidToxicHazardSize(name);
        if (validSize && name !== "base") {
          toxicHazardAlphaUsage[name] = analyzeToxicHazardAlphaUsage(image);
        }
        resolve(isToxicHazardLayerReady(name));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  let toxicHazardReadyPromise = null;
  const hazardLoader = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
      for (const [name, path] of Object.entries(TOXIC_HAZARD_PATHS)) {
        loadToxicHazardAsset(name, path);
      }
      return Promise.all(
        Object.values(toxicHazardAssets).map(record => record.ready)
      ).then(() => isToxicHazardReady());
    })
    : null;

  function requestBackgroundAssets() {
    if (backgroundLoader) backgroundReadyPromise = backgroundLoader.request();
    return backgroundReadyPromise;
  }

  function requestHazardAssets() {
    if (hazardLoader) toxicHazardReadyPromise = hazardLoader.request();
    return toxicHazardReadyPromise;
  }

  if (!supportsLazyLoading) {
    for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
      loadBackgroundAsset(name, path);
    }
    backgroundReadyPromise = Promise.all(
      Object.values(backgroundAssets).map(record => record.ready)
    ).then(() => isBackgroundReady());
    for (const [name, path] of Object.entries(TOXIC_HAZARD_PATHS)) {
      loadToxicHazardAsset(name, path);
    }
    toxicHazardReadyPromise = Promise.all(
      Object.values(toxicHazardAssets).map(record => record.ready)
    ).then(() => isToxicHazardReady());
  }

  function isToxicHazardReady() {
    return isToxicHazardLayerReady("base");
  }

  function getWrappedHorizontalDestinations(rect, offsetX) {
    const firstX = rect.x + offsetX - rect.w;
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

  function getWrappedVerticalDestinations(rect, offsetY) {
    const firstY = rect.y + offsetY;
    return Object.freeze([
      Object.freeze({x: rect.x, y: firstY, w: rect.w, h: rect.h}),
      Object.freeze({
        x: rect.x,
        y: firstY + rect.h,
        w: rect.w,
        h: rect.h
      })
    ]);
  }

  function getToxicHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      rect.w !== TOXIC_HAZARD_CONTRACT.runtime.w ||
      rect.h !== TOXIC_HAZARD_CONTRACT.runtime.h
    ) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const wave01OffsetX = Math.abs(safeTime * WAVE_01_X_SPEED) % rect.w;
    const wave02OffsetY = -(
      Math.abs(safeTime * WAVE_02_RISE_SPEED) % rect.h
    );
    return Object.freeze({
      source: TOXIC_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      wave01: Object.freeze({
        offsetX: wave01OffsetX,
        offsetY: 0,
        destinations: getWrappedHorizontalDestinations(rect, wave01OffsetX)
      }),
      wave02: Object.freeze({
        offsetX: 0,
        offsetY: wave02OffsetY,
        destinations: getWrappedVerticalDestinations(rect, wave02OffsetY)
      })
    });
  }

  function drawToxicHazardLayer(context, name, source, destination) {
    context.drawImage(
      toxicHazardAssets[name].image,
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
    if (!context || !isToxicHazardReady()) return false;
    const mapping = getToxicHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawToxicHazardLayer(context, "base", mapping.source, mapping.base);
    if (isToxicHazardLayerReady("wave01")) {
      for (const destination of mapping.wave01.destinations) {
        drawToxicHazardLayer(context, "wave01", mapping.source, destination);
      }
    }
    if (isToxicHazardLayerReady("wave02")) {
      for (const destination of mapping.wave02.destinations) {
        drawToxicHazardLayer(context, "wave02", mapping.source, destination);
      }
    }
    context.restore();
    return true;
  }

  const swampVisuals = Object.freeze({
    ...swampPlatformVisuals,
    requestBackgroundAssets,
    whenBackgroundReady: requestBackgroundAssets,
    isBackgroundReady,
    getBackgroundMapping,
    getFogMapping,
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
      fogAnimation: Object.freeze({
        back: Object.freeze({
          leftSpeed: FOG_BACK_LEFT_SPEED,
          ySpeed: 0,
          wrapDistance: BACKGROUND_REFERENCE.w - FOG_BACK_WRAP_OVERLAP,
          overlap: FOG_BACK_WRAP_OVERLAP,
          drawCopies: 2
        }),
        front: Object.freeze({
          leftSpeed: FOG_FRONT_LEFT_SPEED,
          ySpeed: 0,
          wrapDistance: BACKGROUND_REFERENCE.w - FOG_FRONT_WRAP_OVERLAP,
          overlap: FOG_FRONT_WRAP_OVERLAP,
          drawCopies: 2
        }),
        direction: "right-to-left",
        wrapMode: "horizontal-continuous",
        blendMode: "source-over"
      })
    }),
    requestHazardAssets,
    whenToxicHazardReady: requestHazardAssets,
    isToxicHazardReady,
    isToxicHazardLayerReady,
    getToxicHazardMapping,
    drawBottomDeathHazard,
    getToxicHazardStatus: () => Object.freeze({
      ready: isToxicHazardReady(),
      paths: TOXIC_HAZARD_PATHS,
      contract: TOXIC_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(TOXIC_HAZARD_PATHS).map(name => [
          name,
          hasValidToxicHazardSize(name)
        ])
      )),
      layerReady: Object.freeze(Object.fromEntries(
        Object.keys(TOXIC_HAZARD_PATHS).map(name => [
          name,
          isToxicHazardLayerReady(name)
        ])
      )),
      waveAlphaUsage: Object.freeze({...toxicHazardAlphaUsage}),
      animation: Object.freeze({
        wave01: Object.freeze({
          xSpeed: WAVE_01_X_SPEED,
          ySpeed: 0,
          wrapAxis: "x",
          drawCopies: 2
        }),
        wave02: Object.freeze({
          xSpeed: 0,
          riseSpeed: WAVE_02_RISE_SPEED,
          wrapAxis: "y",
          drawCopies: 2
        })
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("swamp", swampVisuals);
  return swampVisuals;
})();
