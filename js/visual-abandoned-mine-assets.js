"use strict";

const ABANDONED_MINE_ASSET_VISUALS = (() => {
  const abandonedMinePlatformVisuals =
    BIOME_PLATFORM_VISUALS.resolve("abandonedMine");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const ASSET_CONTRACTS = Object.freeze({
    main: Object.freeze({
      path:
        "assets/environments/abandonedMine/background/abandonedMine_background_main.png",
      size: BACKGROUND_REFERENCE
    }),
    front: Object.freeze({
      path:
        "assets/environments/abandonedMine/background/abandonedMine_background_front.png",
      size: BACKGROUND_REFERENCE
    }),
    minecartEmpty: Object.freeze({
      path:
        "assets/environments/abandonedMine/background/abandonedMine_minecart_empty.png",
      size: Object.freeze({w: 192, h: 96})
    }),
    minecartFull: Object.freeze({
      path:
        "assets/environments/abandonedMine/background/abandonedMine_minecart_full.png",
      size: Object.freeze({w: 192, h: 96})
    }),
    minecartWheel: Object.freeze({
      path:
        "assets/environments/abandonedMine/background/abandonedMine_minecart_wheel.png",
      size: Object.freeze({w: 40, h: 40})
    })
  });
  const ASSET_NAMES = Object.freeze(Object.keys(ASSET_CONTRACTS));
  const HAZARD_ASSET_NAME = "hazardMain";
  const HAZARD_CONTRACT = Object.freeze({
    path:
      "assets/environments/abandonedMine/hazards/abandonedMine_hazard_main.png",
    size: Object.freeze({w: 1650, h: 60}),
    source: Object.freeze({x: 0, y: 0, w: 1650, h: 60}),
    destination: Object.freeze({x: 235, y: 690, w: 825, h: 30})
  });
  const ALL_ASSET_CONTRACTS = Object.freeze({
    ...ASSET_CONTRACTS,
    [HAZARD_ASSET_NAME]: HAZARD_CONTRACT
  });
  const MINECART_SCALE = 0.68;
  const WHEEL_CENTERS = Object.freeze([
    Object.freeze({x: 60, y: 85}),
    Object.freeze({x: 129, y: 85})
  ]);
  const WHEEL_CENTER = Object.freeze({x: 20, y: 20});
  const WHEEL_RADIUS = 20;
  const CART_BOTTOM_AT_WHEEL = WHEEL_CENTERS[0].y + WHEEL_RADIUS;
  const MINECARTS = Object.freeze([
    Object.freeze({
      rail: "upper",
      railY: 224,
      variant: "empty",
      asset: "minecartEmpty",
      direction: 1,
      speed: 38,
      phaseDistance: 350,
      respawnGap: 360
    }),
    Object.freeze({
      rail: "middle",
      railY: 451,
      variant: "full",
      asset: "minecartFull",
      direction: -1,
      speed: 48,
      phaseDistance: 490,
      respawnGap: 460
    }),
    Object.freeze({
      rail: "lower",
      railY: 678,
      variant: "empty",
      asset: "minecartEmpty",
      direction: 1,
      speed: 58,
      phaseDistance: 1000,
      respawnGap: 520
    })
  ]);
  const MAIN_LANTERNS = Object.freeze([
    Object.freeze({x: 248, y: 100, radius: 70, alphaMin: 0.10, alphaMax: 0.26, period: 4.8, phase: 0.25, dipPeriod: 8.1, dipOffset: 0.7, dipDuration: 0.22, dipDepth: 0.50}),
    Object.freeze({x: 905, y: 100, radius: 72, alphaMin: 0.11, alphaMax: 0.28, period: 5.3, phase: 1.75, dipPeriod: 9.7, dipOffset: 3.1, dipDuration: 0.18, dipDepth: 0.58}),
    Object.freeze({x: 235, y: 339, radius: 64, alphaMin: 0.09, alphaMax: 0.24, period: 4.5, phase: 3.20, dipPeriod: 8.8, dipOffset: 5.4, dipDuration: 0.25, dipDepth: 0.46}),
    Object.freeze({x: 851, y: 563, radius: 68, alphaMin: 0.10, alphaMax: 0.27, period: 5.7, phase: 4.65, dipPeriod: 11.2, dipOffset: 2.0, dipDuration: 0.20, dipDepth: 0.54})
  ]);
  const FRONT_LANTERNS = Object.freeze([
    Object.freeze({x: 147, y: 136, radius: 60, alphaMin: 0.12, alphaMax: 0.30, period: 4.9, phase: 1.05, dipPeriod: 10.4, dipOffset: 6.2, dipDuration: 0.19, dipDepth: 0.52}),
    Object.freeze({x: 1139, y: 164, radius: 64, alphaMin: 0.12, alphaMax: 0.31, period: 5.5, phase: 2.85, dipPeriod: 9.2, dipOffset: 4.4, dipDuration: 0.23, dipDepth: 0.57})
  ]);
  const LANTERN_COLOR = Object.freeze({r: 255, g: 166, b: 58});
  const LANTERN_DIM_ALPHA_MAX = 0.16;
  const assets = {};

  function hasValidSize(name) {
    const image = assets[name]?.image;
    const expected = ALL_ASSET_CONTRACTS[name]?.size;
    return Boolean(
      image?.complete &&
      expected &&
      image.naturalWidth === expected.w &&
      image.naturalHeight === expected.h
    );
  }

  function loadAsset(name, contract) {
    const image = new Image();
    const record = {image, ready: null};
    assets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidSize(name));
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = contract.path;
  }

  for (const [name, contract] of Object.entries(ALL_ASSET_CONTRACTS)) {
    loadAsset(name, contract);
  }

  function isBackgroundReady() {
    return ASSET_NAMES.every(hasValidSize);
  }

  const backgroundReadyPromise = Promise.all(
    ASSET_NAMES.map(name => assets[name].ready)
  ).then(() => isBackgroundReady());

  function isHazardReady() {
    return hasValidSize(HAZARD_ASSET_NAME);
  }

  const hazardReadyPromise = assets[HAZARD_ASSET_NAME].ready.then(
    () => isHazardReady()
  );

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
      assets[HAZARD_ASSET_NAME].image,
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

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
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

  function getMinecartMapping(visualTime = 0, sceneWidth = BACKGROUND_REFERENCE.w) {
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    const safeWidth = Number.isFinite(sceneWidth) && sceneWidth > 0
      ? sceneWidth
      : BACKGROUND_REFERENCE.w;
    const bodyWidth = ASSET_CONTRACTS.minecartEmpty.size.w * MINECART_SCALE;
    const bodyHeight = ASSET_CONTRACTS.minecartEmpty.size.h * MINECART_SCALE;
    const wheelSize = ASSET_CONTRACTS.minecartWheel.size.w * MINECART_SCALE;
    const effectiveWheelRadius = WHEEL_RADIUS * MINECART_SCALE;

    return Object.freeze(MINECARTS.map(cart => {
      const unsignedDistance = cart.phaseDistance + safeTime * cart.speed;
      const cycleDistance = safeWidth + bodyWidth + cart.respawnGap;
      const cycleOffset = positiveModulo(unsignedDistance, cycleDistance);
      const x = cart.direction > 0
        ? -bodyWidth + cycleOffset
        : safeWidth - cycleOffset;
      const y = cart.railY - CART_BOTTOM_AT_WHEEL * MINECART_SCALE;
      const signedDistance = cart.direction * unsignedDistance;
      const wheelRotation = signedDistance / effectiveWheelRadius;
      return Object.freeze({
        ...cart,
        x,
        y,
        w: bodyWidth,
        h: bodyHeight,
        cycleDistance,
        cycleOffset,
        wheelRotation,
        wheels: Object.freeze(WHEEL_CENTERS.map(center => Object.freeze({
          centerX: x + center.x * MINECART_SCALE,
          centerY: y + center.y * MINECART_SCALE,
          size: wheelSize,
          radius: effectiveWheelRadius,
          rotation: wheelRotation
        })))
      });
    }));
  }

  function getLanternLayerMapping(lanterns, visualTime) {
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    return Object.freeze(lanterns.map(lantern => {
      const primaryPulse = (
        Math.sin(safeTime * Math.PI * 2 / lantern.period + lantern.phase) + 1
      ) * 0.5;
      const secondaryPulse = (
        Math.sin(
          safeTime * Math.PI * 2 / (lantern.period * 0.43) +
          lantern.phase * 1.73
        ) + 1
      ) * 0.5;
      const flicker = 0.68 * primaryPulse + 0.32 * secondaryPulse;
      const dipTime = positiveModulo(
        safeTime + lantern.dipOffset,
        lantern.dipPeriod
      );
      const dipWave = dipTime < lantern.dipDuration
        ? Math.sin(dipTime / lantern.dipDuration * Math.PI) ** 2
        : 0;
      const dipFactor = 1 - lantern.dipDepth * dipWave;
      const glowAlpha = (
        lantern.alphaMin +
        (lantern.alphaMax - lantern.alphaMin) * (0.35 + flicker * 0.65)
      ) * dipFactor;
      return Object.freeze({
        ...lantern,
        glowAlpha,
        dipFactor,
        dimAlpha: (1 - dipFactor) * LANTERN_DIM_ALPHA_MAX
      });
    }));
  }

  function getLanternMapping(visualTime = 0) {
    return Object.freeze({
      main: getLanternLayerMapping(MAIN_LANTERNS, visualTime),
      front: getLanternLayerMapping(FRONT_LANTERNS, visualTime)
    });
  }

  function drawBackgroundLayer(context, name, mapping) {
    context.drawImage(
      assets[name].image,
      0,
      0,
      mapping.source.w,
      mapping.source.h,
      mapping.destination.x,
      mapping.destination.y,
      mapping.destination.w,
      mapping.destination.h
    );
  }

  function drawLanternEffect(context, lantern) {
    if (lantern.dimAlpha > 0) {
      const dimRadius = lantern.radius * 0.52;
      const dim = context.createRadialGradient(
        lantern.x,
        lantern.y,
        0,
        lantern.x,
        lantern.y,
        dimRadius
      );
      dim.addColorStop(0, `rgba(7,3,1,${lantern.dimAlpha})`);
      dim.addColorStop(0.45, `rgba(7,3,1,${lantern.dimAlpha * 0.58})`);
      dim.addColorStop(1, "rgba(7,3,1,0)");
      context.globalCompositeOperation = "source-over";
      context.fillStyle = dim;
      context.beginPath();
      context.arc(lantern.x, lantern.y, dimRadius, 0, Math.PI * 2);
      context.fill();
    }

    const glow = context.createRadialGradient(
      lantern.x,
      lantern.y,
      0,
      lantern.x,
      lantern.y,
      lantern.radius
    );
    glow.addColorStop(
      0,
      `rgba(${LANTERN_COLOR.r},${LANTERN_COLOR.g},${LANTERN_COLOR.b},${lantern.glowAlpha})`
    );
    glow.addColorStop(
      0.24,
      `rgba(${LANTERN_COLOR.r},${LANTERN_COLOR.g},${LANTERN_COLOR.b},${lantern.glowAlpha * 0.78})`
    );
    glow.addColorStop(
      0.62,
      `rgba(${LANTERN_COLOR.r},${LANTERN_COLOR.g},${LANTERN_COLOR.b},${lantern.glowAlpha * 0.34})`
    );
    glow.addColorStop(1, `rgba(${LANTERN_COLOR.r},${LANTERN_COLOR.g},${LANTERN_COLOR.b},0)`);
    context.globalCompositeOperation = "screen";
    context.fillStyle = glow;
    context.beginPath();
    context.arc(lantern.x, lantern.y, lantern.radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawLanternLayer(context, lanterns) {
    context.save();
    for (const lantern of lanterns) drawLanternEffect(context, lantern);
    context.restore();
  }

  function drawMinecart(context, cart) {
    const bodyContract = ASSET_CONTRACTS[cart.asset];
    const wheelContract = ASSET_CONTRACTS.minecartWheel;
    context.drawImage(
      assets[cart.asset].image,
      0,
      0,
      bodyContract.size.w,
      bodyContract.size.h,
      cart.x,
      cart.y,
      cart.w,
      cart.h
    );
    for (const wheel of cart.wheels) {
      context.save();
      context.translate(wheel.centerX, wheel.centerY);
      context.rotate(wheel.rotation);
      context.drawImage(
        assets.minecartWheel.image,
        0,
        0,
        wheelContract.size.w,
        wheelContract.size.h,
        -wheel.size / 2,
        -wheel.size / 2,
        wheel.size,
        wheel.size
      );
      context.restore();
    }
  }

  function drawBackground(context, width, height, visualTime = 0) {
    if (!context || !isBackgroundReady()) return false;
    const mapping = getBackgroundMapping(width, height);
    if (!mapping) return false;
    const lanterns = getLanternMapping(visualTime);
    const minecarts = getMinecartMapping(visualTime);

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalCompositeOperation = "source-over";
    drawBackgroundLayer(context, "main", mapping);

    context.save();
    context.scale(mapping.scaleX, mapping.scaleY);
    drawLanternLayer(context, lanterns.main);
    context.globalCompositeOperation = "source-over";
    for (const cart of minecarts) drawMinecart(context, cart);
    context.restore();

    context.globalCompositeOperation = "source-over";
    drawBackgroundLayer(context, "front", mapping);

    context.save();
    context.scale(mapping.scaleX, mapping.scaleY);
    drawLanternLayer(context, lanterns.front);
    context.restore();
    context.restore();
    return true;
  }

  const abandonedMineVisuals = Object.freeze({
    ...abandonedMinePlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    getBackgroundMapping,
    getMinecartMapping,
    getLanternMapping,
    drawBackground,
    whenHazardReady: () => hazardReadyPromise,
    isHazardReady,
    getBottomHazardMapping,
    drawBottomDeathHazard,
    getHazardStatus: () => Object.freeze({
      ready: isHazardReady(),
      path: HAZARD_CONTRACT.path,
      expectedNativeSize: HAZARD_CONTRACT.size,
      validNativeSize: hasValidSize(HAZARD_ASSET_NAME),
      source: HAZARD_CONTRACT.source,
      destination: HAZARD_CONTRACT.destination,
      layerCount: 1,
      animated: false
    }),
    getBackgroundStatus: () => Object.freeze({
      ready: isBackgroundReady(),
      paths: Object.freeze(Object.fromEntries(
        Object.entries(ASSET_CONTRACTS).map(([name, contract]) => (
          [name, contract.path]
        ))
      )),
      expectedNativeSizes: Object.freeze(Object.fromEntries(
        Object.entries(ASSET_CONTRACTS).map(([name, contract]) => (
          [name, contract.size]
        ))
      )),
      validNativeSizes: Object.freeze(Object.fromEntries(
        ASSET_NAMES.map(name => [name, hasValidSize(name)])
      )),
      minecartContract: Object.freeze({
        scale: MINECART_SCALE,
        body: ASSET_CONTRACTS.minecartEmpty.size,
        renderedBody: Object.freeze({
          w: ASSET_CONTRACTS.minecartEmpty.size.w * MINECART_SCALE,
          h: ASSET_CONTRACTS.minecartEmpty.size.h * MINECART_SCALE
        }),
        wheel: ASSET_CONTRACTS.minecartWheel.size,
        wheelCenter: WHEEL_CENTER,
        wheelCenters: WHEEL_CENTERS,
        effectiveWheelRadius: WHEEL_RADIUS * MINECART_SCALE,
        rotationFormula: "signed-distance / effective-wheel-radius",
        positiveCanvasRotation: "clockwise",
        equalVariantScale: true
      }),
      minecarts: MINECARTS,
      minecartAnimation: Object.freeze({
        count: MINECARTS.length,
        deterministic: true,
        horizontalOnly: true,
        wrapRule: "fully-offscreen-then-opposite-side",
        respawnMode: "offscreen-distance-gap",
        wheelRotationCoupling: "actual-horizontal-distance"
      }),
      lanterns: Object.freeze({
        main: MAIN_LANTERNS,
        front: FRONT_LANTERNS
      }),
      lanternAnimation: Object.freeze({
        count: MAIN_LANTERNS.length + FRONT_LANTERNS.length,
        deterministic: true,
        synchronized: false,
        color: "warm-amber-orange",
        localDimmingDuringDips: true
      }),
      renderOrder: Object.freeze([
        "main-background",
        "main-lantern-effects",
        "minecart-bodies",
        "distance-coupled-wheels",
        "front-layer",
        "front-lantern-effects",
        "gameplay"
      ])
    })
  });
  BIOME_PLATFORM_VISUALS.register("abandonedMine", abandonedMineVisuals);
  return abandonedMineVisuals;
})();
