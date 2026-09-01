"use strict";

const ENCHANTED_GARDEN_ASSET_VISUALS = (() => {
  const supportsLazyLoading =
    typeof BIOME_PLATFORM_VISUALS.registerLazy === "function" &&
    typeof BIOME_PLATFORM_VISUALS.createAssetLoader === "function";
  const enchantedGardenPlatformVisuals = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.registerLazy("enchantedGarden")
    : BIOME_PLATFORM_VISUALS.resolve("enchantedGarden");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox:
      "assets/environments/enchantedGarden/background/enchantedGarden_background_skybox.png",
    cloudsBack:
      "assets/environments/enchantedGarden/background/enchantedGarden_background_clouds_back.png",
    sun:
      "assets/environments/enchantedGarden/background/enchantedGarden_background_sun.png",
    cloudsFront:
      "assets/environments/enchantedGarden/background/enchantedGarden_background_clouds_front.png",
    gardenBack:
      "assets/environments/enchantedGarden/background/enchantedGarden_background_garden_back.png"
  });
  const HAZARD_CONTRACT = Object.freeze({
    path:
      "assets/environments/enchantedGarden/hazards/enchantedGarden_hazard_main.png",
    native: Object.freeze({w: 1650, h: 60}),
    source: Object.freeze({x: 0, y: 0, w: 1650, h: 60}),
    destination: Object.freeze({x: 235, y: 690, w: 825, h: 30})
  });
  const BACKGROUND_RENDER_ORDER = Object.freeze([
    "skybox",
    "cloudsBack",
    "sun",
    "cloudsFront",
    "gardenBack",
    "gameplay"
  ]);
  const CLOUD_ANIMATION = Object.freeze({
    back: Object.freeze({
      asset: "cloudsBack",
      leftSpeed: 6,
      wrapDistance: BACKGROUND_REFERENCE.w,
      overlap: 0,
      transparentEdges: Object.freeze({left: 34, right: 26})
    }),
    front: Object.freeze({
      asset: "cloudsFront",
      leftSpeed: 11,
      wrapDistance: BACKGROUND_REFERENCE.w,
      overlap: 0,
      transparentEdges: Object.freeze({left: 22, right: 11})
    })
  });
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const hazardAsset = {image: null, ready: null};

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
        resolve(isBackgroundLayerReady(name));
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  function isBackgroundReady() {
    return Object.keys(BACKGROUND_PATHS).every(isBackgroundLayerReady);
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

  function isHazardReady() {
    return hasValidHazardSize();
  }

  let hazardReadyPromise = null;
  const hazardLoader = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
      loadHazardAsset();
      return hazardAsset.ready.then(() => isHazardReady());
    })
    : null;

  function requestBackgroundAssets() {
    if (backgroundLoader) backgroundReadyPromise = backgroundLoader.request();
    return backgroundReadyPromise;
  }

  function requestHazardAssets() {
    if (hazardLoader) hazardReadyPromise = hazardLoader.request();
    return hazardReadyPromise;
  }

  if (!supportsLazyLoading) {
    for (const [name, path] of Object.entries(BACKGROUND_PATHS)) {
      loadBackgroundAsset(name, path);
    }
    backgroundReadyPromise = Promise.all(
      Object.values(backgroundAssets).map(record => record.ready)
    ).then(() => isBackgroundReady());
    loadHazardAsset();
    hazardReadyPromise = hazardAsset.ready.then(() => isHazardReady());
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
    if (!mapping || !CLOUD_ANIMATION[layer]) return null;
    const config = CLOUD_ANIMATION[layer];
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    const travel = (
      (safeTime * config.leftSpeed) % config.wrapDistance +
      config.wrapDistance
    ) % config.wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    return Object.freeze({
      asset: config.asset,
      leftSpeed: config.leftSpeed,
      offsetX,
      offsetY: 0,
      wrapDistance: config.wrapDistance,
      overlap: config.overlap,
      destinations: Object.freeze([0, config.wrapDistance].map(copyOffset => (
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

  function drawCloudLayer(context, mapping, visualTime, layer) {
    const clouds = getCloudMapping(visualTime, mapping, layer);
    for (const destination of clouds.destinations) {
      drawBackgroundLayer(context, clouds.asset, mapping, destination);
    }
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
    drawCloudLayer(context, mapping, visualTime, "back");
    drawBackgroundLayer(context, "sun", mapping);
    drawCloudLayer(context, mapping, visualTime, "front");
    drawBackgroundLayer(context, "gardenBack", mapping);
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
    requestHazardAssets();
    if (!context || !isHazardReady()) return false;
    const mapping = getBottomHazardMapping(rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
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

  const enchantedGardenVisuals = Object.freeze({
    ...enchantedGardenPlatformVisuals,
    requestBackgroundAssets,
    whenBackgroundReady: requestBackgroundAssets,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getCloudMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      renderOrder: BACKGROUND_RENDER_ORDER,
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
      staticLayers: Object.freeze(["skybox", "sun", "gardenBack"]),
      cloudAnimation: Object.freeze({
        back: Object.freeze({
          leftSpeed: CLOUD_ANIMATION.back.leftSpeed,
          ySpeed: 0,
          wrapDistance: CLOUD_ANIMATION.back.wrapDistance,
          overlap: CLOUD_ANIMATION.back.overlap,
          drawCopies: 2,
          transparentEdges: CLOUD_ANIMATION.back.transparentEdges
        }),
        front: Object.freeze({
          leftSpeed: CLOUD_ANIMATION.front.leftSpeed,
          ySpeed: 0,
          wrapDistance: CLOUD_ANIMATION.front.wrapDistance,
          overlap: CLOUD_ANIMATION.front.overlap,
          drawCopies: 2,
          transparentEdges: CLOUD_ANIMATION.front.transparentEdges
        }),
        direction: "right-to-left",
        wrapMode: "full-width-continuous"
      })
    }),
    requestHazardAssets,
    whenHazardReady: requestHazardAssets,
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
  BIOME_PLATFORM_VISUALS.register("enchantedGarden", enchantedGardenVisuals);
  return enchantedGardenVisuals;
})();
