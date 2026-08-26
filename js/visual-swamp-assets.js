"use strict";

const SWAMP_ASSET_VISUALS = (() => {
  const swampPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("swamp");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox: "assets/environments/swamp/background/swamp_background_skybox.png",
    treesBack: "assets/environments/swamp/background/swamp_background_trees_back.png",
    fogBack: "assets/environments/swamp/background/swamp_background_fog_back.png",
    treesMiddle: "assets/environments/swamp/background/swamp_background_trees_middle.png",
    fogFront: "assets/environments/swamp/background/swamp_background_fog_front.png",
    treesFront: "assets/environments/swamp/background/swamp_background_trees_front.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "treesBack",
    "treesMiddle",
    "treesFront"
  ]);
  const FOG_BACK_X_AMPLITUDE = 4;
  const FOG_BACK_X_PERIOD_SECONDS = 32;
  const FOG_BACK_X_PHASE = 0;
  const FOG_FRONT_X_AMPLITUDE = 7;
  const FOG_FRONT_X_PERIOD_SECONDS = 20;
  const FOG_FRONT_X_PHASE = 1.2;
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};

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

  function getFogMapping(visualTime, mapping, layer) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const isFront = layer === "front";
    const amplitude = isFront
      ? FOG_FRONT_X_AMPLITUDE
      : FOG_BACK_X_AMPLITUDE;
    const periodSeconds = isFront
      ? FOG_FRONT_X_PERIOD_SECONDS
      : FOG_BACK_X_PERIOD_SECONDS;
    const phase = isFront ? FOG_FRONT_X_PHASE : FOG_BACK_X_PHASE;
    const offsetX = Math.sin(
      safeTime * Math.PI * 2 / periodSeconds + phase
    ) * amplitude;
    return Object.freeze({
      offsetX,
      offsetY: 0,
      destination: Object.freeze({
        x: offsetX * mapping.scaleX,
        y: 0,
        w: mapping.destination.w,
        h: mapping.destination.h
      })
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
    context.globalCompositeOperation = "source-over";
    drawBackgroundLayer(context, "skybox", mapping);
    drawBackgroundLayer(context, "treesBack", mapping);
    if (isBackgroundLayerReady("fogBack")) {
      const fogBack = getFogMapping(visualTime, mapping, "back");
      drawBackgroundLayer(context, "fogBack", mapping, fogBack.destination);
    }
    drawBackgroundLayer(context, "treesMiddle", mapping);
    if (isBackgroundLayerReady("fogFront")) {
      const fogFront = getFogMapping(visualTime, mapping, "front");
      drawBackgroundLayer(context, "fogFront", mapping, fogFront.destination);
    }
    drawBackgroundLayer(context, "treesFront", mapping);
    context.restore();
    return true;
  }

  const swampVisuals = Object.freeze({
    ...swampPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
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
          xAmplitude: FOG_BACK_X_AMPLITUDE,
          xPeriodSeconds: FOG_BACK_X_PERIOD_SECONDS,
          xPhase: FOG_BACK_X_PHASE,
          yAmplitude: 0,
          drawCopies: 1
        }),
        front: Object.freeze({
          xAmplitude: FOG_FRONT_X_AMPLITUDE,
          xPeriodSeconds: FOG_FRONT_X_PERIOD_SECONDS,
          xPhase: FOG_FRONT_X_PHASE,
          yAmplitude: 0,
          drawCopies: 1
        }),
        wrapMode: "single-sine-no-wrap",
        blendMode: "source-over"
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("swamp", swampVisuals);
  return swampVisuals;
})();
