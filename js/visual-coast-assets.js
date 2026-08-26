"use strict";

const COAST_ASSET_VISUALS = (() => {
  const coastPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("coast");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_ALPHA_THRESHOLD = 8;
  const BACKGROUND_PATHS = Object.freeze({
    skyBase: "assets/environments/coast/background/coast_background_sky_base.png",
    cloudsBack: "assets/environments/coast/background/coast_background_clouds_back.png",
    ship: "assets/environments/coast/background/coast_background_ship.png",
    landscape: "assets/environments/coast/background/coast_background_landscape.png",
    cloudsFront: "assets/environments/coast/background/coast_background_clouds_front.png"
  });
  const BACK_CLOUD_SPEED = 4;
  const FRONT_CLOUD_SPEED = -7;
  const SHIP_CONTENT_WIDTH = 190;
  const SHIP_VISIBLE_SCALE = 0.75;
  const SHIP_TRAVEL_EDGE_INSET = 270;
  const SHIP_TRAVEL_PERIOD_SECONDS = 30;
  const SHIP_BASELINE_Y = 535;
  const SHIP_Y_OFFSET = -24;
  const HORIZON_LAYER_Y_OFFSET = 75;
  const SHIP_BOB_AMPLITUDE = 2.5;
  const SHIP_BOB_PERIOD_SECONDS = 5.5;
  const backgroundAssets = {};
  let shipContentBounds = null;

  function hasValidBackgroundSize(name) {
    const image = backgroundAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === BACKGROUND_REFERENCE.w &&
      image.naturalHeight === BACKGROUND_REFERENCE.h
    );
  }

  function analyzeVisibleAlphaBounds(image) {
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
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      let left = surface.width;
      let top = surface.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < surface.height; y++) {
        for (let x = 0; x < surface.width; x++) {
          if (
            pixels[(y * surface.width + x) * 4 + 3] <=
              BACKGROUND_ALPHA_THRESHOLD
          ) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) return null;
      return Object.freeze({
        x: left,
        y: top,
        w: right - left + 1,
        h: bottom - top + 1
      });
    } catch {
      return null;
    }
  }

  function loadBackgroundAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    backgroundAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const valid = hasValidBackgroundSize(name);
        if (valid && name === "ship") {
          shipContentBounds = analyzeVisibleAlphaBounds(image);
        }
        resolve(valid && (name !== "ship" || Boolean(shipContentBounds)));
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
  ).then(results => results.every(Boolean));

  function isBackgroundReady() {
    return Object.keys(BACKGROUND_PATHS).every(hasValidBackgroundSize) &&
      Boolean(shipContentBounds);
  }

  function getBackgroundMapping(width, height) {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) return null;
    return Object.freeze({
      reference: BACKGROUND_REFERENCE,
      scaleX: width / BACKGROUND_REFERENCE.w,
      scaleY: height / BACKGROUND_REFERENCE.h,
      destination: Object.freeze({x: 0, y: 0, w: width, h: height})
    });
  }

  function getWrappedCloudOffset(visualTime, speed) {
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travel = (
      (safeTime * speed) % BACKGROUND_REFERENCE.w + BACKGROUND_REFERENCE.w
    ) % BACKGROUND_REFERENCE.w;
    return -travel;
  }

  function drawFullBackgroundLayer(
    context,
    name,
    mapping,
    offsetX = 0,
    offsetY = 0
  ) {
    const source = BACKGROUND_REFERENCE;
    context.drawImage(
      backgroundAssets[name].image,
      0,
      0,
      source.w,
      source.h,
      offsetX * mapping.scaleX,
      offsetY * mapping.scaleY,
      mapping.destination.w,
      mapping.destination.h
    );
  }

  function drawWrappedCloudLayer(context, name, mapping, visualTime, speed) {
    const offsetX = getWrappedCloudOffset(visualTime, speed);
    drawFullBackgroundLayer(context, name, mapping, offsetX);
    drawFullBackgroundLayer(
      context,
      name,
      mapping,
      offsetX + BACKGROUND_REFERENCE.w
    );
  }

  function getShipMapping(visualTime, width, height) {
    const backgroundMapping = getBackgroundMapping(width, height);
    if (!backgroundMapping || !shipContentBounds) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const travelPhase = safeTime * Math.PI * 2 / SHIP_TRAVEL_PERIOD_SECONDS;
    const minimumCenterX = SHIP_TRAVEL_EDGE_INSET + SHIP_CONTENT_WIDTH / 2;
    const maximumCenterX =
      BACKGROUND_REFERENCE.w - SHIP_TRAVEL_EDGE_INSET - SHIP_CONTENT_WIDTH / 2;
    const referenceCenterX = (minimumCenterX + maximumCenterX) / 2 +
      Math.sin(travelPhase) * (maximumCenterX - minimumCenterX) / 2;
    const referenceBottomY =
      SHIP_BASELINE_Y + SHIP_Y_OFFSET + HORIZON_LAYER_Y_OFFSET + Math.sin(
        safeTime * Math.PI * 2 / SHIP_BOB_PERIOD_SECONDS
      ) * SHIP_BOB_AMPLITUDE;
    const uniformDisplayScale = Math.min(
      backgroundMapping.scaleX,
      backgroundMapping.scaleY
    );
    const contentScale =
      SHIP_CONTENT_WIDTH * SHIP_VISIBLE_SCALE / shipContentBounds.w;
    const destinationWidth = shipContentBounds.w * contentScale * uniformDisplayScale;
    const destinationHeight = shipContentBounds.h * contentScale * uniformDisplayScale;
    const destinationCenterX = referenceCenterX * backgroundMapping.scaleX;
    const destinationBottomY = referenceBottomY * backgroundMapping.scaleY;
    return Object.freeze({
      source: shipContentBounds,
      destination: Object.freeze({
        x: destinationCenterX - destinationWidth / 2,
        y: destinationBottomY - destinationHeight,
        w: destinationWidth,
        h: destinationHeight
      }),
      centerX: destinationCenterX,
      bottomY: destinationBottomY,
      flipX: Math.cos(travelPhase) < 0,
      referenceCenterX,
      referenceBottomY
    });
  }

  function drawShip(context, mapping) {
    const source = mapping.source;
    const destination = mapping.destination;
    context.save();
    let destinationX = destination.x;
    if (mapping.flipX) {
      context.translate(mapping.centerX, 0);
      context.scale(-1, 1);
      destinationX = -destination.w / 2;
    }
    context.drawImage(
      backgroundAssets.ship.image,
      source.x,
      source.y,
      source.w,
      source.h,
      destinationX,
      destination.y,
      destination.w,
      destination.h
    );
    context.restore();
  }

  function drawBackground(context, width, height, visualTime = 0) {
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    const shipMapping = getShipMapping(visualTime, width, height);
    if (!mapping || !shipMapping) return false;

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawFullBackgroundLayer(context, "skyBase", mapping);
    drawWrappedCloudLayer(
      context,
      "cloudsBack",
      mapping,
      visualTime,
      BACK_CLOUD_SPEED
    );
    drawShip(context, shipMapping);
    drawFullBackgroundLayer(
      context,
      "landscape",
      mapping,
      0,
      HORIZON_LAYER_Y_OFFSET
    );
    drawWrappedCloudLayer(
      context,
      "cloudsFront",
      mapping,
      visualTime,
      FRONT_CLOUD_SPEED
    );
    context.restore();
    return true;
  }

  const coastVisuals = Object.freeze({
    ...coastPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getBackgroundMapping,
    getShipMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(BACKGROUND_PATHS).map(name => [name, hasValidBackgroundSize(name)])
      )),
      alphaThreshold: BACKGROUND_ALPHA_THRESHOLD,
      shipContentBounds
    })
  });
  BIOME_PLATFORM_VISUALS.register("coast", coastVisuals);
  return coastVisuals;
})();
