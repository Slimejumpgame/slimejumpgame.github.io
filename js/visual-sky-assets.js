"use strict";

const SKY_ASSET_VISUALS = (() => {
  const skyPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("sky");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox: "assets/environments/sky/background/sky_background_skybox.png",
    cloudsBack: "assets/environments/sky/background/sky_background_clouds_back.png",
    islands: "assets/environments/sky/background/sky_background_islands.png",
    cloudsFront: "assets/environments/sky/background/sky_background_clouds_front.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze(["skybox", "islands"]);
  const CLOUDS_BACK_LEFT_SPEED = 6;
  const CLOUDS_BACK_WRAP_OVERLAP = 54;
  const ISLANDS_Y_AMPLITUDE = 4;
  const ISLANDS_Y_PERIOD_SECONDS = 8.5;
  const ISLANDS_Y_PHASE = 0.7;
  const CLOUDS_FRONT_LEFT_SPEED = 12;
  const CLOUDS_FRONT_WRAP_OVERLAP = 123;
  const backgroundAssets = {};

  function hasValidBackgroundSize(name) {
    const image = backgroundAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function isBackgroundLayerReady(name) {
    return hasValidBackgroundSize(name);
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const validSize = hasValidBackgroundSize(name);
        resolve(validSize);
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

  function getHorizontalWrapMapping(
    visualTime,
    mapping,
    leftSpeed,
    overlap
  ) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
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

  function getCloudsBackMapping(visualTime, mapping) {
    return getHorizontalWrapMapping(
      visualTime,
      mapping,
      CLOUDS_BACK_LEFT_SPEED,
      CLOUDS_BACK_WRAP_OVERLAP
    );
  }

  function getIslandsMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const offsetY = Math.sin(
      safeTime * Math.PI * 2 / ISLANDS_Y_PERIOD_SECONDS + ISLANDS_Y_PHASE
    ) * ISLANDS_Y_AMPLITUDE;
    return Object.freeze({
      offsetX: 0,
      offsetY,
      destination: Object.freeze({
        x: 0,
        y: offsetY * mapping.scaleY,
        w: mapping.destination.w,
        h: mapping.destination.h
      })
    });
  }

  function getCloudsFrontMapping(visualTime, mapping) {
    return getHorizontalWrapMapping(
      visualTime,
      mapping,
      CLOUDS_FRONT_LEFT_SPEED,
      CLOUDS_FRONT_WRAP_OVERLAP
    );
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
    if (isBackgroundLayerReady("cloudsBack")) {
      const cloudsBack = getCloudsBackMapping(visualTime, mapping);
      for (const destination of cloudsBack.destinations) {
        drawBackgroundLayer(context, "cloudsBack", mapping, destination);
      }
    }
    const islands = getIslandsMapping(visualTime, mapping);
    drawBackgroundLayer(context, "islands", mapping, islands.destination);
    if (isBackgroundLayerReady("cloudsFront")) {
      const cloudsFront = getCloudsFrontMapping(visualTime, mapping);
      for (const destination of cloudsFront.destinations) {
        drawBackgroundLayer(context, "cloudsFront", mapping, destination);
      }
    }
    context.restore();
    return true;
  }

  function drawBottomDeathHazard() {
    return true;
  }

  const skyVisuals = Object.freeze({
    ...skyPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getCloudsBackMapping,
    getIslandsMapping,
    getCloudsFrontMapping,
    drawBackground,
    drawBottomDeathHazard,
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
      cloudsBackAnimation: Object.freeze({
        leftSpeed: CLOUDS_BACK_LEFT_SPEED,
        ySpeed: 0,
        direction: "right-to-left",
        wrapDistance: BACKGROUND_REFERENCE.w - CLOUDS_BACK_WRAP_OVERLAP,
        overlap: CLOUDS_BACK_WRAP_OVERLAP,
        drawCopies: 2,
        wrapMode: "horizontal-continuous"
      }),
      islandsAnimation: Object.freeze({
        xAmplitude: 0,
        yAmplitude: ISLANDS_Y_AMPLITUDE,
        yPeriodSeconds: ISLANDS_Y_PERIOD_SECONDS,
        yPhase: ISLANDS_Y_PHASE,
        drawCopies: 1,
        wrapMode: "single-sine-no-wrap"
      }),
      cloudsFrontAnimation: Object.freeze({
        leftSpeed: CLOUDS_FRONT_LEFT_SPEED,
        ySpeed: 0,
        direction: "right-to-left",
        wrapDistance: BACKGROUND_REFERENCE.w - CLOUDS_FRONT_WRAP_OVERLAP,
        overlap: CLOUDS_FRONT_WRAP_OVERLAP,
        drawCopies: 2,
        wrapMode: "horizontal-continuous"
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("sky", skyVisuals);
  return skyVisuals;
})();
