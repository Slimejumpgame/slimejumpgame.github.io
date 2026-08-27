"use strict";

const AUTUMN_ASSET_VISUALS = (() => {
  const autumnPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("autumn");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox: "assets/environments/autumn/background/autumn_background_skybox.png",
    clouds: "assets/environments/autumn/background/autumn_background_clouds.png",
    forest: "assets/environments/autumn/background/autumn_background_forest.png",
    leaves: "assets/environments/autumn/background/autumn_background_leaves.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze(["skybox", "forest"]);
  const CLOUD_LEFT_SPEED = 6;
  const CLOUD_WRAP_OVERLAP = 27;
  const LEAVES_FALL_SPEED = 14;
  const LEAVES_TOP_INSET = 40;
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

  function getCloudMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const wrapDistance = BACKGROUND_REFERENCE.w - CLOUD_WRAP_OVERLAP;
    const travel = (
      (safeTime * CLOUD_LEFT_SPEED) % wrapDistance + wrapDistance
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

  function getLeavesMapping(visualTime, mapping) {
    if (!mapping) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travel = (
      (safeTime * LEAVES_FALL_SPEED) % BACKGROUND_REFERENCE.h +
      BACKGROUND_REFERENCE.h
    ) % BACKGROUND_REFERENCE.h;
    const firstY = LEAVES_TOP_INSET + travel - BACKGROUND_REFERENCE.h;
    return Object.freeze({
      offsetX: 0,
      offsetY: travel,
      clip: Object.freeze({
        x: 0,
        y: LEAVES_TOP_INSET * mapping.scaleY,
        w: mapping.destination.w,
        h: mapping.destination.h - LEAVES_TOP_INSET * mapping.scaleY
      }),
      destinations: Object.freeze([
        Object.freeze({
          x: 0,
          y: firstY * mapping.scaleY,
          w: mapping.destination.w,
          h: mapping.destination.h
        }),
        Object.freeze({
          x: 0,
          y: (firstY + BACKGROUND_REFERENCE.h) * mapping.scaleY,
          w: mapping.destination.w,
          h: mapping.destination.h
        })
      ])
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
    if (isBackgroundLayerReady("clouds")) {
      const clouds = getCloudMapping(visualTime, mapping);
      for (const destination of clouds.destinations) {
        drawBackgroundLayer(context, "clouds", mapping, destination);
      }
    }
    drawBackgroundLayer(context, "forest", mapping);
    if (isBackgroundLayerReady("leaves")) {
      const leaves = getLeavesMapping(visualTime, mapping);
      context.save();
      context.beginPath();
      context.rect(
        leaves.clip.x,
        leaves.clip.y,
        leaves.clip.w,
        leaves.clip.h
      );
      context.clip();
      for (const destination of leaves.destinations) {
        drawBackgroundLayer(context, "leaves", mapping, destination);
      }
      context.restore();
    }
    context.restore();
    return true;
  }

  const autumnVisuals = Object.freeze({
    ...autumnPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getCloudMapping,
    getLeavesMapping,
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
        leftSpeed: CLOUD_LEFT_SPEED,
        ySpeed: 0,
        wrapDistance: BACKGROUND_REFERENCE.w - CLOUD_WRAP_OVERLAP,
        overlap: CLOUD_WRAP_OVERLAP,
        drawCopies: 2,
        direction: "right-to-left",
        wrapMode: "horizontal-continuous"
      }),
      leavesAnimation: Object.freeze({
        fallSpeed: LEAVES_FALL_SPEED,
        xSpeed: 0,
        topInset: LEAVES_TOP_INSET,
        wrapAxis: "y",
        wrapHeight: BACKGROUND_REFERENCE.h,
        drawCopies: 2
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("autumn", autumnVisuals);
  return autumnVisuals;
})();
