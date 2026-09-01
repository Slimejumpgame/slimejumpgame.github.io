"use strict";

const RED_MOON_ASSET_VISUALS = (() => {
  const supportsLazyLoading =
    typeof BIOME_PLATFORM_VISUALS.registerLazy === "function" &&
    typeof BIOME_PLATFORM_VISUALS.createAssetLoader === "function";
  const redMoonPlatformVisuals = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.registerLazy("redMoon")
    : BIOME_PLATFORM_VISUALS.resolve("redMoon");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox:
      "assets/environments/redMoon/background/redMoon_background_skybox.png",
    cloudsBack:
      "assets/environments/redMoon/background/redMoon_background_clouds_back.png",
    moon:
      "assets/environments/redMoon/background/redMoon_background_moon.png",
    cloudsFront:
      "assets/environments/redMoon/background/redMoon_background_clouds_front.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "cloudsBack",
    "moon",
    "cloudsFront"
  ]);
  const BACKGROUND_RENDER_ORDER = Object.freeze([
    "skybox",
    "cloudsBack",
    "moon",
    "cloudsFront",
    "gameplay"
  ]);
  const CLOUD_ANIMATION = Object.freeze({
    back: Object.freeze({
      asset: "cloudsBack",
      leftSpeed: 6,
      wrapDistance: BACKGROUND_REFERENCE.w,
      overlap: 0,
      transparentEdges: Object.freeze({left: 93, right: 11})
    }),
    front: Object.freeze({
      asset: "cloudsFront",
      leftSpeed: 11,
      wrapDistance: BACKGROUND_REFERENCE.w,
      overlap: 0,
      transparentEdges: Object.freeze({left: 91, right: 316})
    })
  });
  const HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({x: 235, y: 690, w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const HAZARD_PATHS = Object.freeze({
    base: "assets/environments/redMoon/hazards/redMoon_hazard_base.png",
    waveBack:
      "assets/environments/redMoon/hazards/redMoon_hazard_wave_back.png",
    waveFront:
      "assets/environments/redMoon/hazards/redMoon_hazard_wave_front.png"
  });
  const WAVE_BACK_LEFT_SPEED = 16;
  const WAVE_FRONT_LEFT_SPEED = 24;
  const WAVE_BACK_NATIVE_WRAP_OVERLAP = 0;
  const WAVE_FRONT_NATIVE_WRAP_OVERLAP = 0;
  const backgroundAssets = {};
  const backgroundAlphaUsage = {};
  const hazardAssets = {};

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
    return ESSENTIAL_BACKGROUND_LAYERS.every(isBackgroundLayerReady);
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

  function isHazardReady() {
    return Object.keys(HAZARD_PATHS).every(hasValidHazardSize);
  }

  let hazardReadyPromise = null;
  const hazardLoader = supportsLazyLoading
    ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
      for (const [name, path] of Object.entries(HAZARD_PATHS)) {
        loadHazardAsset(name, path);
      }
      return Promise.all(
        Object.values(hazardAssets).map(record => record.ready)
      ).then(() => isHazardReady());
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
    for (const [name, path] of Object.entries(HAZARD_PATHS)) {
      loadHazardAsset(name, path);
    }
    hazardReadyPromise = Promise.all(
      Object.values(hazardAssets).map(record => record.ready)
    ).then(() => isHazardReady());
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
    drawBackgroundLayer(context, "moon", mapping);
    drawCloudLayer(context, mapping, visualTime, "front");
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
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    return Object.freeze({
      source: HAZARD_CONTRACT.native,
      base: Object.freeze({
        offsetX: 0,
        offsetY: 0,
        destination: HAZARD_CONTRACT.runtime
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
    requestHazardAssets();
    if (!context || !isHazardReady()) return false;
    const mapping = getBottomHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    drawHazardLayer(context, "base", mapping.source, mapping.base.destination);
    for (const destination of mapping.waveBack.destinations) {
      drawHazardLayer(context, "waveBack", mapping.source, destination);
    }
    for (const destination of mapping.waveFront.destinations) {
      drawHazardLayer(context, "waveFront", mapping.source, destination);
    }
    context.restore();
    return true;
  }

  const redMoonVisuals = Object.freeze({
    ...redMoonPlatformVisuals,
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
      staticLayers: Object.freeze(["skybox", "moon"]),
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
        motion: "linear-horizontal",
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
        bobbing: false,
        deterministic: true,
        wrapMode: "full-width-continuous"
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("redMoon", redMoonVisuals);
  return redMoonVisuals;
})();
