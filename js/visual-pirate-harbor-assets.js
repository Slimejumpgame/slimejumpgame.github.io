"use strict";

const PIRATE_HARBOR_ASSET_VISUALS = (() => {
  const pirateHarborPlatformVisuals =
    BIOME_PLATFORM_VISUALS.resolve("pirateHarbor");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_skybox.png",
    cloudsBack:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_clouds_back.png",
    shipDistant:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_ship_distant.png",
    ocean:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_ocean.png",
    sun:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_sun.png",
    cloudsFront:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_clouds_front.png",
    shipMain:
      "assets/environments/pirateHarbor/background/pirateHarbor_background_ship_main.png"
  });
  const BACKGROUND_ASSET_NAMES = Object.freeze(Object.keys(BACKGROUND_PATHS));
  const REQUIRED_BACKGROUND_ASSET_NAMES = Object.freeze([
    "skybox",
    "cloudsBack",
    "shipDistant",
    "ocean",
    "sun",
    "cloudsFront",
    "shipMain"
  ]);
  const BACKGROUND_RENDER_ORDER = Object.freeze([
    "skybox",
    "cloudsBack",
    "shipDistant",
    "ocean",
    "sun",
    "cloudsFront",
    "shipMain",
    "gameplay"
  ]);
  const CLOUD_ANIMATION = Object.freeze({
    back: Object.freeze({
      asset: "cloudsBack",
      leftSpeed: 6,
      wrapDistance: BACKGROUND_REFERENCE.w,
      overlap: 0,
      transparentEdges: Object.freeze({left: 38, right: 25})
    }),
    front: Object.freeze({
      asset: "cloudsFront",
      leftSpeed: 11,
      wrapDistance: BACKGROUND_REFERENCE.w,
      overlap: 0,
      transparentEdges: Object.freeze({left: 25, right: 9})
    })
  });
  const SHIP_ANIMATION = Object.freeze({
    distant: Object.freeze({
      asset: "shipDistant",
      alphaBounds: Object.freeze({x: 799, y: 529, w: 136, h: 133}),
      pivot: Object.freeze({x: 867, y: 650}),
      horizontalSpeed: 0,
      bobAmplitude: 1.5,
      bobPeriod: 7.2,
      bobPhase: 0.4,
      rockAmplitudeDegrees: 0.15,
      rockPeriod: 8.6,
      rockPhase: 1.1
    }),
    main: Object.freeze({
      asset: "shipMain",
      alphaBounds: Object.freeze({x: 635, y: 491, w: 259, h: 177}),
      pivot: Object.freeze({x: 765, y: 655}),
      horizontalSpeed: 0,
      bobAmplitude: 2.4,
      bobPeriod: 5.8,
      bobPhase: 1.3,
      rockAmplitudeDegrees: 0.25,
      rockPeriod: 7.4,
      rockPhase: 2.1
    })
  });
  const HAZARD_CONTRACT = Object.freeze({
    path:
      "assets/environments/pirateHarbor/hazards/pirateHarbor_hazard_main.png",
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
    return REQUIRED_BACKGROUND_ASSET_NAMES.every(isBackgroundLayerReady);
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

  function getShipMapping(visualTime, mapping, layer) {
    if (!mapping || !SHIP_ANIMATION[layer]) return null;
    const config = SHIP_ANIMATION[layer];
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    const bobY = Math.sin(
      safeTime * Math.PI * 2 / config.bobPeriod + config.bobPhase
    ) * config.bobAmplitude;
    const rotation = Math.sin(
      safeTime * Math.PI * 2 / config.rockPeriod + config.rockPhase
    ) * config.rockAmplitudeDegrees * Math.PI / 180;
    return Object.freeze({
      asset: config.asset,
      alphaBounds: config.alphaBounds,
      localPivot: config.pivot,
      offsetX: 0,
      offsetY: bobY,
      rotation,
      horizontalSpeed: config.horizontalSpeed,
      destination: Object.freeze({
        x: 0,
        y: 0,
        w: BACKGROUND_REFERENCE.w,
        h: BACKGROUND_REFERENCE.h
      }),
      visibleBounds: config.alphaBounds
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

  function drawShipLayer(context, mapping, visualTime, layer) {
    const ship = getShipMapping(visualTime, mapping, layer);
    const pivotX = ship.localPivot.x * mapping.scaleX;
    const pivotY = ship.localPivot.y * mapping.scaleY;
    context.save();
    context.translate(
      pivotX,
      pivotY + ship.offsetY * mapping.scaleY
    );
    context.rotate(ship.rotation);
    context.drawImage(
      backgroundAssets[ship.asset].image,
      0,
      0,
      mapping.source.w,
      mapping.source.h,
      (ship.destination.x - ship.localPivot.x) * mapping.scaleX,
      (ship.destination.y - ship.localPivot.y) * mapping.scaleY,
      ship.destination.w * mapping.scaleX,
      ship.destination.h * mapping.scaleY
    );
    context.restore();
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
    drawCloudLayer(context, mapping, visualTime, "back");
    drawShipLayer(context, mapping, visualTime, "distant");
    drawBackgroundLayer(context, "ocean", mapping);
    drawBackgroundLayer(context, "sun", mapping);
    drawCloudLayer(context, mapping, visualTime, "front");
    drawShipLayer(context, mapping, visualTime, "main");
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

  const pirateHarborVisuals = Object.freeze({
    ...pirateHarborPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getCloudMapping,
    getShipMapping,
    drawBackground,
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: BACKGROUND_PATHS,
      expectedNativeSize: BACKGROUND_REFERENCE,
      renderOrder: BACKGROUND_RENDER_ORDER,
      validNativeSizes: Object.freeze(Object.fromEntries(
        BACKGROUND_ASSET_NAMES.map(name => [
          name,
          hasValidBackgroundSize(name)
        ])
      )),
      layerReady: Object.freeze(Object.fromEntries(
        BACKGROUND_ASSET_NAMES.map(name => [
          name,
          isBackgroundLayerReady(name)
        ])
      )),
      alphaUsage: Object.freeze({...backgroundAlphaUsage}),
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
      }),
      shipAnimation: Object.freeze({
        distant: SHIP_ANIMATION.distant,
        main: SHIP_ANIMATION.main,
        deterministic: true,
        horizontalTravel: false
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
  BIOME_PLATFORM_VISUALS.register("pirateHarbor", pirateHarborVisuals);
  return pirateHarborVisuals;
})();
