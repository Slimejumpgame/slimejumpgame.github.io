"use strict";

const COAST_ASSET_VISUALS = (() => {
  const PLATFORM_DIRECTORY = "assets/environments/coast/platforms";
  const COAST_TOP_OVERLAY_START = 0x43535441;
  const COAST_TOP_OVERLAY_GOAL = 0x43474f41;
  const COAST_BODY_OVERLAY_GOAL = 0x43424f44;
  const topOverlayAssets = Object.freeze(Array.from({ length: 6 }, (_, index) => (
    `coast_overlay_top_0${index + 1}`
  )));
  const bodyOverlayAssets = Object.freeze(Array.from({ length: 3 }, (_, index) => (
    `coast_overlay_body_0${index + 1}`
  )));
  const defineAsset = asset => Object.freeze({
    asset,
    path: `${PLATFORM_DIRECTORY}/${asset}.png`
  });
  const platformKit = createPlatformVisualKit({
    biome: "coast",
    familyA: Object.freeze({
      topBase: defineAsset("coast_top_base"),
      bodyBase: defineAsset("coast_body_base"),
      topOverlays: Object.freeze(topOverlayAssets.map(defineAsset)),
      bodyOverlays: Object.freeze(bodyOverlayAssets.map(defineAsset))
    }),
    familyB: Object.freeze({
      left: defineAsset("coast_floating_left"),
      middle: defineAsset("coast_floating_middle"),
      right: defineAsset("coast_floating_right")
    }),
    slotNames: Object.freeze({
      topBase: "coast_top_base",
      bodyBase: "coast_body_base",
      topOverlays: "coast_top_overlays",
      bodyOverlays: "coast_body_overlays",
      floatingLeft: "coast_floating_left",
      floatingMiddle: "coast_floating_middle",
      floatingRight: "coast_floating_right"
    }),
    salts: Object.freeze({
      topStart: COAST_TOP_OVERLAY_START,
      topGoal: COAST_TOP_OVERLAY_GOAL,
      bodyGoal: COAST_BODY_OVERLAY_GOAL
    })
  });

  function drawPlatformBase(context, platform, drawX = platform.x, levelSeed = 0) {
    const role = platformKit.resolvePlatformRole(platform);
    if (
      (role === "START_PLATFORM" || role === "GOAL_TOWER") &&
      !platformKit.isFamilyAReady()
    ) return false;
    return platformKit.drawPlatformBase(context, platform, drawX, levelSeed);
  }

  return Object.freeze({
    whenReady: platformKit.whenReady,
    areAllReady: platformKit.areAllReady,
    isPlatformKitReady: platformKit.areAllReady,
    getStatus: platformKit.getStatus,
    getManifest: platformKit.getManifest,
    getTopOverlaySelection: platformKit.getTopOverlaySelection,
    getBodyOverlaySelection: platformKit.getBodyOverlaySelection,
    resolvePlatformRole: platformKit.resolvePlatformRole,
    drawPlatformBase,
    drawGoalTopForeground: platformKit.drawGoalTopForeground
  });
})();

BIOME_PLATFORM_VISUALS.register("coast", COAST_ASSET_VISUALS);
