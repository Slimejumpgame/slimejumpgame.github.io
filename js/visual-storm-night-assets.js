"use strict";

const STORM_NIGHT_ASSET_VISUALS = (() => {
  const stormNightPlatformVisuals = BIOME_PLATFORM_VISUALS.resolve("stormNight");
  const BACKGROUND_REFERENCE = Object.freeze({w: 1280, h: 720});
  const BACKGROUND_PATHS = Object.freeze({
    skybox: "assets/environments/stormNight/background/stormNight_background_skybox.png",
    cloudsBack: "assets/environments/stormNight/background/stormNight_background_clouds_back.png",
    moon: "assets/environments/stormNight/background/stormNight_background_moon.png",
    lightning01: "assets/environments/stormNight/background/stormNight_lightning_01.png",
    lightning02: "assets/environments/stormNight/background/stormNight_lightning_02.png",
    lightning03: "assets/environments/stormNight/background/stormNight_lightning_03.png",
    cloudsFront: "assets/environments/stormNight/background/stormNight_background_clouds_front.png"
  });
  const STORM_NIGHT_HAZARD_CONTRACT = Object.freeze({
    native: Object.freeze({w: 1650, h: 60}),
    runtime: Object.freeze({w: 825, h: 30}),
    nativeToRuntimeScale: 0.5
  });
  const STORM_NIGHT_HAZARD_PATHS = Object.freeze({
    base: "assets/environments/stormNight/hazards/stormNight_hazard_base.png",
    clouds: "assets/environments/stormNight/hazards/stormNight_hazard_clouds.png"
  });
  const ESSENTIAL_BACKGROUND_LAYERS = Object.freeze([
    "skybox",
    "cloudsBack",
    "moon",
    "cloudsFront"
  ]);
  const LIGHTNING_ASSET_NAMES = Object.freeze([
    "lightning01",
    "lightning02",
    "lightning03"
  ]);
  const CLOUDS_BACK_LEFT_SPEED = 6;
  const CLOUDS_BACK_WRAP_OVERLAP = 20;
  const CLOUDS_FRONT_LEFT_SPEED = 12;
  const CLOUDS_FRONT_WRAP_OVERLAP = 183;
  const LIGHTNING_EVENT_COUNT = 12;
  const LIGHTNING_GAP_MIN_SECONDS = 2.5;
  const LIGHTNING_GAP_MAX_SECONDS = 7.5;
  const LIGHTNING_PRIMARY_MIN_SECONDS = 0.07;
  const LIGHTNING_PRIMARY_MAX_SECONDS = 0.13;
  const LIGHTNING_SECONDARY_CHANCE = 0.42;
  const LIGHTNING_SECONDARY_DELAY_MIN_SECONDS = 0.06;
  const LIGHTNING_SECONDARY_DELAY_MAX_SECONDS = 0.15;
  const LIGHTNING_SECONDARY_MIN_SECONDS = 0.045;
  const LIGHTNING_SECONDARY_MAX_SECONDS = 0.075;
  const LIGHTNING_ATTACK_SECONDS = 0.018;
  const LIGHTNING_Y_OFFSET = 48;
  const LIGHTNING_SALT = 0x53544f52;
  const HAZARD_CLOUD_LEFT_SPEED = 12;
  const backgroundAssets = {};
  const stormNightHazardAssets = {};

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
      image.onload = () => resolve(hasValidBackgroundSize(name));
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = path;
  }

  function hasValidStormNightHazardSize(name) {
    const image = stormNightHazardAssets[name]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === STORM_NIGHT_HAZARD_CONTRACT.native.w &&
      image.naturalHeight === STORM_NIGHT_HAZARD_CONTRACT.native.h
    );
  }

  function loadStormNightHazardAsset(name, path) {
    const image = new Image();
    const record = {image, ready: null};
    stormNightHazardAssets[name] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => resolve(hasValidStormNightHazardSize(name));
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
  for (const [name, path] of Object.entries(STORM_NIGHT_HAZARD_PATHS)) {
    loadStormNightHazardAsset(name, path);
  }
  const stormNightHazardReadyPromise = Promise.all(
    Object.values(stormNightHazardAssets).map(record => record.ready)
  ).then(() => isStormNightHazardReady());

  function isBackgroundReady() {
    return ESSENTIAL_BACKGROUND_LAYERS.every(isBackgroundLayerReady);
  }

  function isStormNightHazardReady() {
    return Object.keys(STORM_NIGHT_HAZARD_PATHS).every(
      hasValidStormNightHazardSize
    );
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

  function getHorizontalWrapMapping(visualTime, mapping, leftSpeed, overlap) {
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

  function getCloudsFrontMapping(visualTime, mapping) {
    return getHorizontalWrapMapping(
      visualTime,
      mapping,
      CLOUDS_FRONT_LEFT_SPEED,
      CLOUDS_FRONT_WRAP_OVERLAP
    );
  }

  function getLightningUnit(eventIndex, channel) {
    let value = (
      LIGHTNING_SALT ^
      Math.imul(eventIndex + 1, 0x9e3779b1) ^
      Math.imul(channel + 1, 0x85ebca6b)
    ) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) / 0x100000000;
  }

  function interpolate(minimum, maximum, factor) {
    return minimum + (maximum - minimum) * factor;
  }

  function createLightningSchedule() {
    const events = [];
    let previousEnd = 0;
    for (let index = 0; index < LIGHTNING_EVENT_COUNT; index++) {
      const gap = interpolate(
        LIGHTNING_GAP_MIN_SECONDS,
        LIGHTNING_GAP_MAX_SECONDS,
        getLightningUnit(index, 0)
      );
      const start = previousEnd + gap;
      const primaryDuration = interpolate(
        LIGHTNING_PRIMARY_MIN_SECONDS,
        LIGHTNING_PRIMARY_MAX_SECONDS,
        getLightningUnit(index, 1)
      );
      const hasSecondary = getLightningUnit(index, 2) < LIGHTNING_SECONDARY_CHANCE;
      const secondaryDelay = hasSecondary ? interpolate(
        LIGHTNING_SECONDARY_DELAY_MIN_SECONDS,
        LIGHTNING_SECONDARY_DELAY_MAX_SECONDS,
        getLightningUnit(index, 3)
      ) : null;
      const secondaryDuration = hasSecondary ? interpolate(
        LIGHTNING_SECONDARY_MIN_SECONDS,
        LIGHTNING_SECONDARY_MAX_SECONDS,
        getLightningUnit(index, 4)
      ) : null;
      const groupIndex = Math.floor(index / LIGHTNING_ASSET_NAMES.length);
      const groupOffset = Math.floor(
        getLightningUnit(groupIndex, 5) * LIGHTNING_ASSET_NAMES.length
      );
      const groupDirection = getLightningUnit(groupIndex, 6) < 0.5 ? 1 : 2;
      const spriteIndex = (
        groupOffset + (index % LIGHTNING_ASSET_NAMES.length) * groupDirection
      ) % LIGHTNING_ASSET_NAMES.length;
      const primaryPeak = interpolate(0.86, 1, getLightningUnit(index, 7));
      const secondaryPeak = hasSecondary
        ? primaryPeak * interpolate(0.28, 0.42, getLightningUnit(index, 8))
        : 0;
      const secondaryStart = hasSecondary
        ? start + primaryDuration + secondaryDelay
        : null;
      const end = hasSecondary
        ? secondaryStart + secondaryDuration
        : start + primaryDuration;
      events.push(Object.freeze({
        index,
        gap,
        start,
        primaryDuration,
        primaryPeak,
        hasSecondary,
        secondaryDelay,
        secondaryStart,
        secondaryDuration,
        secondaryPeak,
        spriteIndex,
        end
      }));
      previousEnd = end;
    }
    return Object.freeze({
      cycleDuration: previousEnd,
      events: Object.freeze(events)
    });
  }

  const LIGHTNING_SCHEDULE = createLightningSchedule();

  function getFlashAlpha(elapsed, duration, peak) {
    const attack = Math.min(LIGHTNING_ATTACK_SECONDS, duration * 0.25);
    if (elapsed < attack) {
      const progress = Math.max(0, elapsed / attack);
      return peak * progress * progress * (3 - 2 * progress);
    }
    const progress = Math.min(1, (elapsed - attack) / (duration - attack));
    return peak * (1 - progress) ** 2;
  }

  function getLightningState(visualTime) {
    const safeTime = Number.isFinite(visualTime) ? Math.max(0, visualTime) : 0;
    const cycleTime = safeTime % LIGHTNING_SCHEDULE.cycleDuration;
    for (const event of LIGHTNING_SCHEDULE.events) {
      const primaryElapsed = cycleTime - event.start;
      if (primaryElapsed >= 0 && primaryElapsed < event.primaryDuration) {
        const alpha = getFlashAlpha(
          primaryElapsed,
          event.primaryDuration,
          event.primaryPeak
        );
        return Object.freeze({
          visible: alpha > 0,
          phase: "primary",
          alpha,
          spriteIndex: event.spriteIndex,
          asset: LIGHTNING_ASSET_NAMES[event.spriteIndex],
          eventIndex: event.index,
          cycleTime
        });
      }
      if (event.hasSecondary) {
        const secondaryElapsed = cycleTime - event.secondaryStart;
        if (
          secondaryElapsed >= 0 &&
          secondaryElapsed < event.secondaryDuration
        ) {
          const alpha = getFlashAlpha(
            secondaryElapsed,
            event.secondaryDuration,
            event.secondaryPeak
          );
          return Object.freeze({
            visible: alpha > 0,
            phase: "secondary",
            alpha,
            spriteIndex: event.spriteIndex,
            asset: LIGHTNING_ASSET_NAMES[event.spriteIndex],
            eventIndex: event.index,
            cycleTime
          });
        }
      }
    }
    return Object.freeze({
      visible: false,
      phase: "idle",
      alpha: 0,
      spriteIndex: null,
      asset: null,
      eventIndex: null,
      cycleTime
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
    const cloudsBack = getCloudsBackMapping(visualTime, mapping);
    for (const destination of cloudsBack.destinations) {
      drawBackgroundLayer(context, "cloudsBack", mapping, destination);
    }
    drawBackgroundLayer(context, "moon", mapping);
    const lightning = getLightningState(visualTime);
    if (lightning.visible && isBackgroundLayerReady(lightning.asset)) {
      context.save();
      context.globalAlpha = lightning.alpha;
      drawBackgroundLayer(context, lightning.asset, mapping, {
        x: 0,
        y: LIGHTNING_Y_OFFSET * mapping.scaleY,
        w: mapping.destination.w,
        h: mapping.destination.h
      });
      context.restore();
    }
    const cloudsFront = getCloudsFrontMapping(visualTime, mapping);
    for (const destination of cloudsFront.destinations) {
      drawBackgroundLayer(context, "cloudsFront", mapping, destination);
    }
    context.restore();
    return true;
  }

  function getStormNightHazardMapping(visualTime, rect) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.w) ||
      !Number.isFinite(rect.h) ||
      rect.w <= 0 ||
      rect.h <= 0
    ) return null;
    const safeTime = Number.isFinite(visualTime) ? visualTime : 0;
    const wrapDistance = rect.w;
    const travel = (
      (safeTime * HAZARD_CLOUD_LEFT_SPEED) % wrapDistance + wrapDistance
    ) % wrapDistance;
    const offsetX = travel === 0 ? 0 : -travel;
    return Object.freeze({
      source: STORM_NIGHT_HAZARD_CONTRACT.native,
      base: Object.freeze({x: rect.x, y: rect.y, w: rect.w, h: rect.h}),
      clouds: Object.freeze({
        offsetX,
        offsetY: 0,
        wrapDistance,
        destinations: Object.freeze([0, wrapDistance].map(copyOffset => (
          Object.freeze({
            x: rect.x + offsetX + copyOffset,
            y: rect.y,
            w: rect.w,
            h: rect.h
          })
        )))
      })
    });
  }

  function drawStormNightHazardLayer(context, name, source, destination) {
    context.drawImage(
      stormNightHazardAssets[name].image,
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
    if (!context || !isStormNightHazardReady()) return false;
    const mapping = getStormNightHazardMapping(visualTime, rect);
    if (!mapping) return false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawStormNightHazardLayer(context, "base", mapping.source, mapping.base);
    for (const destination of mapping.clouds.destinations) {
      drawStormNightHazardLayer(
        context,
        "clouds",
        mapping.source,
        destination
      );
    }
    context.restore();
    return true;
  }

  const stormNightVisuals = Object.freeze({
    ...stormNightPlatformVisuals,
    whenBackgroundReady: () => backgroundReadyPromise,
    isBackgroundReady,
    isBackgroundLayerReady,
    getBackgroundMapping,
    getCloudsBackMapping,
    getCloudsFrontMapping,
    getLightningState,
    drawBackground,
    whenStormNightHazardReady: () => stormNightHazardReadyPromise,
    isStormNightHazardReady,
    getStormNightHazardMapping,
    drawBottomDeathHazard,
    getStormNightHazardStatus: () => Object.freeze({
      ready: isStormNightHazardReady(),
      paths: STORM_NIGHT_HAZARD_PATHS,
      contract: STORM_NIGHT_HAZARD_CONTRACT,
      validNativeSizes: Object.freeze(Object.fromEntries(
        Object.keys(STORM_NIGHT_HAZARD_PATHS).map(name => [
          name,
          hasValidStormNightHazardSize(name)
        ])
      )),
      cloudAnimation: Object.freeze({
        leftSpeed: HAZARD_CLOUD_LEFT_SPEED,
        ySpeed: 0,
        direction: "right-to-left",
        wrapDistance: STORM_NIGHT_HAZARD_CONTRACT.runtime.w,
        overlap: 0,
        drawCopies: 2,
        wrapMode: "horizontal-continuous-seamless-tile"
      })
    }),
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
      cloudAnimation: Object.freeze({
        back: Object.freeze({
          leftSpeed: CLOUDS_BACK_LEFT_SPEED,
          ySpeed: 0,
          wrapDistance: BACKGROUND_REFERENCE.w - CLOUDS_BACK_WRAP_OVERLAP,
          overlap: CLOUDS_BACK_WRAP_OVERLAP,
          drawCopies: 2
        }),
        front: Object.freeze({
          leftSpeed: CLOUDS_FRONT_LEFT_SPEED,
          ySpeed: 0,
          wrapDistance: BACKGROUND_REFERENCE.w - CLOUDS_FRONT_WRAP_OVERLAP,
          overlap: CLOUDS_FRONT_WRAP_OVERLAP,
          drawCopies: 2
        }),
        direction: "right-to-left",
        wrapMode: "horizontal-continuous"
      }),
      lightningAnimation: Object.freeze({
        deterministic: true,
        eventCount: LIGHTNING_EVENT_COUNT,
        spriteCount: LIGHTNING_ASSET_NAMES.length,
        attackSeconds: LIGHTNING_ATTACK_SECONDS,
        gapRangeSeconds: Object.freeze([
          LIGHTNING_GAP_MIN_SECONDS,
          LIGHTNING_GAP_MAX_SECONDS
        ]),
        primaryDurationRangeSeconds: Object.freeze([
          LIGHTNING_PRIMARY_MIN_SECONDS,
          LIGHTNING_PRIMARY_MAX_SECONDS
        ]),
        secondaryChance: LIGHTNING_SECONDARY_CHANCE,
        secondaryDelayRangeSeconds: Object.freeze([
          LIGHTNING_SECONDARY_DELAY_MIN_SECONDS,
          LIGHTNING_SECONDARY_DELAY_MAX_SECONDS
        ]),
        secondaryDurationRangeSeconds: Object.freeze([
          LIGHTNING_SECONDARY_MIN_SECONDS,
          LIGHTNING_SECONDARY_MAX_SECONDS
        ]),
        cycleDuration: LIGHTNING_SCHEDULE.cycleDuration,
        events: LIGHTNING_SCHEDULE.events,
        placement: Object.freeze({
          xOffset: 0,
          yOffset: LIGHTNING_Y_OFFSET,
          unit: "reference-pixels"
        }),
        drawOrder: "after-moon-before-clouds-front",
        globalFlash: false
      })
    })
  });
  BIOME_PLATFORM_VISUALS.register("stormNight", stormNightVisuals);
  return stormNightVisuals;
})();
