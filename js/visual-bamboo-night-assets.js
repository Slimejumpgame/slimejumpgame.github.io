"use strict";

const BAMBOO_NIGHT_ASSET_VISUALS = (() => {
  const bambooNightPlatformVisuals =
    BIOME_PLATFORM_VISUALS.resolve("bambooNight");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox:
      "assets/environments/bambooNight/background/bambooNight_background_skybox.png",
    moon:
      "assets/environments/bambooNight/background/bambooNight_background_moon.png",
    fogBack:
      "assets/environments/bambooNight/background/bambooNight_background_fog_back.png",
    bambooBack:
      "assets/environments/bambooNight/background/bambooNight_background_bamboo_back.png",
    fogFront:
      "assets/environments/bambooNight/background/bambooNight_background_fog_front.png",
    bambooFront:
      "assets/environments/bambooNight/background/bambooNight_background_bamboo_front.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "moon",
    "bambooBack",
    "bambooFront"
  ]);
  const BACKGROUND_RENDER_ORDER = Object.freeze([
    "skybox",
    "moon",
    "fogBack",
    "bambooBack",
    "fogFront",
    "bambooFront",
    "gameplay"
  ]);
  const FOG_ANIMATION = Object.freeze({
    back: Object.freeze({
      asset: "fogBack",
      leftSpeed: 7,
      overlap: 49
    }),
    front: Object.freeze({
      asset: "fogFront",
      leftSpeed: 12,
      overlap: 43
    })
  });
  const HAZARD_CONTRACT = Object.freeze({
    path:
      "assets/environments/bambooNight/hazards/bamboo_hazard_main.png",
    native: Object.freeze({w: 1650, h: 60}),
    source: Object.freeze({x: 0, y: 0, w: 1650, h: 60}),
    destination: Object.freeze({x: 235, y: 690, w: 825, h: 30})
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
    if (!mapping || !FOG_ANIMATION[layer]) return null;
    const config = FOG_ANIMATION[layer];
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    const wrapDistance = BACKGROUND_REFERENCE.w - config.overlap;
    const travel = (
      (safeTime * config.leftSpeed) % wrapDistance + wrapDistance
    ) % wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    return Object.freeze({
      asset: config.asset,
      leftSpeed: config.leftSpeed,
      offsetX,
      offsetY: 0,
      overlap: config.overlap,
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

  function drawFogLayer(context, mapping, visualTime, layer) {
    const config = FOG_ANIMATION[layer];
    if (!isBackgroundLayerReady(config.asset)) return;
    const fog = getFogMapping(visualTime, mapping, layer);
    for (const destination of fog.destinations) {
      drawBackgroundLayer(context, config.asset, mapping, destination);
    }
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
    drawBackgroundLayer(context, "moon", mapping);
    drawFogLayer(context, mapping, visualTime, "back");
    drawBackgroundLayer(context, "bambooBack", mapping);
    drawFogLayer(context, mapping, visualTime, "front");
    drawBackgroundLayer(context, "bambooFront", mapping);
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

  const bambooNightVisuals = Object.freeze({
    ...bambooNightPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getFogMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      essentialLayers: ESSENTIAL_BACKGROUND_LAYERS,
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
      fogAnimation: Object.freeze({
        back: Object.freeze({
          leftSpeed: FOG_ANIMATION.back.leftSpeed,
          ySpeed: 0,
          wrapDistance:
            BACKGROUND_REFERENCE.w - FOG_ANIMATION.back.overlap,
          overlap: FOG_ANIMATION.back.overlap,
          drawCopies: 2
        }),
        front: Object.freeze({
          leftSpeed: FOG_ANIMATION.front.leftSpeed,
          ySpeed: 0,
          wrapDistance:
            BACKGROUND_REFERENCE.w - FOG_ANIMATION.front.overlap,
          overlap: FOG_ANIMATION.front.overlap,
          drawCopies: 2
        }),
        direction: "right-to-left",
        wrapMode: "horizontal-continuous",
        densityAnimation: false
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
  BIOME_PLATFORM_VISUALS.register("bambooNight", bambooNightVisuals);
  return bambooNightVisuals;
})();
