"use strict";

  const MEADOW_ASSET_VISUALS = (() => {
    const MEADOW_TOP_OVERLAY_START = 0x53544152;
    const MEADOW_TOP_OVERLAY_GOAL = 0x474f414c;
    const MEADOW_BODY_OVERLAY_GOAL = 0x424f474c;
    const MEADOW_TOP_OVERLAY_ASSET_NAMES = Object.freeze([
      "meadow_overlay_top_01",
      "meadow_overlay_top_02",
      "meadow_overlay_top_03",
      "meadow_overlay_top_04",
      "meadow_overlay_top_05",
      "meadow_overlay_top_06"
    ]);
    const MEADOW_BODY_OVERLAY_ASSET_NAMES = Object.freeze([
      "meadow_overlay_body_01",
      "meadow_overlay_body_02",
      "meadow_overlay_body_03"
    ]);
    const ASSET_PATHS = Object.freeze({
      background: "assets/environments/meadow/background/meadow_background.png",
      background_sky_base: "assets/environments/meadow/background/meadow_background_sky_base.png",
      background_clouds_back: "assets/environments/meadow/background/meadow_background_clouds_back.png",
      background_landscape: "assets/environments/meadow/background/meadow_background_landscape.png",
      background_clouds_front: "assets/environments/meadow/background/meadow_background_clouds_front.png",
      meadow_floating_platform: "assets/environments/meadow/platforms/meadow_floating_platform.png",
      meadow_top_base: "assets/environments/meadow/platforms/meadow_top_base.png",
      meadow_body_base: "assets/environments/meadow/platforms/meadow_body_base.png",
      meadow_overlay_top_01: "assets/environments/meadow/platforms/meadow_overlay_top_01.png",
      meadow_overlay_top_02: "assets/environments/meadow/platforms/meadow_overlay_top_02.png",
      meadow_overlay_top_03: "assets/environments/meadow/platforms/meadow_overlay_top_03.png",
      meadow_overlay_top_04: "assets/environments/meadow/platforms/meadow_overlay_top_04.png",
      meadow_overlay_top_05: "assets/environments/meadow/platforms/meadow_overlay_top_05.png",
      meadow_overlay_top_06: "assets/environments/meadow/platforms/meadow_overlay_top_06.png",
      meadow_overlay_body_01: "assets/environments/meadow/platforms/meadow_overlay_body_01.png",
      meadow_overlay_body_02: "assets/environments/meadow/platforms/meadow_overlay_body_02.png",
      meadow_overlay_body_03: "assets/environments/meadow/platforms/meadow_overlay_body_03.png",
      decor_top_grass: "assets/environments/meadow/decor/top/meadow_decor_top_grass_set_01.png",
      decor_top_flowers: "assets/environments/meadow/decor/top/meadow_decor_top_flowers_set_01.png",
      decor_top_mushrooms: "assets/environments/meadow/decor/top/meadow_decor_top_mushrooms_set_01.png",
      decor_top_bushes: "assets/environments/meadow/decor/top/meadow_decor_top_bushes_set_01.png",
      decor_top_stones: "assets/environments/meadow/decor/top/meadow_decor_top_stones_set_01.png",
      decor_top_tufts: "assets/environments/meadow/decor/top/meadow_decor_top_tufts_set_01.png",
      decor_top_trees: "assets/environments/meadow/decor/top/meadow_decor_top_trees_set_01.png",
      portal: "assets/environments/meadow/portal/meadow_goal_portal.png",
      bottom_spike_tile: "assets/environments/meadow/hazards/meadow_bottom_spike_tile.png"
    });
    const SOURCE_SIZES = Object.freeze({
      background: Object.freeze({w: 1672, h: 941}),
      background_sky_base: Object.freeze({w: 1280, h: 720}),
      background_clouds_back: Object.freeze({w: 1280, h: 720}),
      background_landscape: Object.freeze({w: 1280, h: 720}),
      background_clouds_front: Object.freeze({w: 1280, h: 720}),
      meadow_floating_platform: Object.freeze({w: 512, h: 128}),
      meadow_top_base: Object.freeze({w: 352, h: 128}),
      meadow_body_base: Object.freeze({w: 352, h: 128}),
      meadow_overlay_top_01: Object.freeze({w: 352, h: 128}),
      meadow_overlay_top_02: Object.freeze({w: 352, h: 128}),
      meadow_overlay_top_03: Object.freeze({w: 352, h: 128}),
      meadow_overlay_top_04: Object.freeze({w: 352, h: 128}),
      meadow_overlay_top_05: Object.freeze({w: 352, h: 128}),
      meadow_overlay_top_06: Object.freeze({w: 352, h: 128}),
      meadow_overlay_body_01: Object.freeze({w: 352, h: 128}),
      meadow_overlay_body_02: Object.freeze({w: 352, h: 128}),
      meadow_overlay_body_03: Object.freeze({w: 352, h: 128}),
      decor_top_grass: Object.freeze({w: 1536, h: 1024}),
      decor_top_flowers: Object.freeze({w: 1536, h: 1024}),
      decor_top_mushrooms: Object.freeze({w: 1536, h: 1024}),
      decor_top_bushes: Object.freeze({w: 1536, h: 1024}),
      decor_top_stones: Object.freeze({w: 1536, h: 1024}),
      decor_top_tufts: Object.freeze({w: 1536, h: 1024}),
      decor_top_trees: Object.freeze({w: 1536, h: 1024}),
      portal: Object.freeze({w: 256, h: 272}),
      bottom_spike_tile: Object.freeze({w: 256, h: 320})
    });
    const DECOR_ASSET_NAMES = Object.freeze([
      "decor_top_grass",
      "decor_top_flowers",
      "decor_top_mushrooms",
      "decor_top_bushes",
      "decor_top_stones",
      "decor_top_tufts",
      "decor_top_trees"
    ]);
    const EXTERNAL_ASSET_NAMES = Object.freeze([
      ...DECOR_ASSET_NAMES,
      "portal"
    ]);
    const PLATFORM_ASSET_NAMES = Object.freeze([
      "meadow_floating_platform",
      "meadow_top_base",
      "meadow_body_base",
      ...MEADOW_TOP_OVERLAY_ASSET_NAMES,
      ...MEADOW_BODY_OVERLAY_ASSET_NAMES
    ]);
    const supportsLazyLoading =
      typeof BIOME_PLATFORM_VISUALS.registerLazy === "function" &&
      typeof BIOME_PLATFORM_VISUALS.createAssetLoader === "function";
    const createMeadowPlatformKit = () => createPlatformVisualKit({
      biome: "meadow",
      familyA: Object.freeze({
        topBase: Object.freeze({
          asset: "meadow_top_base",
          path: ASSET_PATHS.meadow_top_base
        }),
        bodyBase: Object.freeze({
          asset: "meadow_body_base",
          path: ASSET_PATHS.meadow_body_base
        }),
        topOverlays: Object.freeze(MEADOW_TOP_OVERLAY_ASSET_NAMES.map(asset => (
          Object.freeze({asset, path: ASSET_PATHS[asset]})
        ))),
        bodyOverlays: Object.freeze(MEADOW_BODY_OVERLAY_ASSET_NAMES.map(asset => (
          Object.freeze({asset, path: ASSET_PATHS[asset]})
        )))
      }),
      familyB: Object.freeze({
        whole: Object.freeze({
          asset: "meadow_floating_platform",
          path: ASSET_PATHS.meadow_floating_platform
        })
      }),
      slotNames: Object.freeze({
        topBase: "meadow_top_base",
        bodyBase: "meadow_body_base",
        topOverlays: "meadow_top_overlays",
        bodyOverlays: "meadow_body_overlays",
        floatingWhole: "meadow_floating_platform"
      }),
      salts: Object.freeze({
        topStart: MEADOW_TOP_OVERLAY_START,
        topGoal: MEADOW_TOP_OVERLAY_GOAL,
        bodyGoal: MEADOW_BODY_OVERLAY_GOAL
      }),
      outlineStyle: "rgba(46,72,28,0.62)"
    });
    const meadowPlatformKit = supportsLazyLoading
      ? BIOME_PLATFORM_VISUALS.registerLazy("meadow", createMeadowPlatformKit)
      : createMeadowPlatformKit();
    const createMeadowDecorKit = () => createBiomeDecorVisualKit({
      biome: "meadow",
      resolvePlatformRole: meadowPlatformKit.resolvePlatformRole,
      salts: Object.freeze({
        start: 0x44535441,
        goal: 0x44474f41,
        goalSeam: 0x47534356
      }),
      roles: Object.freeze({
        groundcover: Object.freeze({
          asset: "decor_top_grass",
          path: ASSET_PATHS.decor_top_grass,
          category: "GRASS",
          spritePrefix: "grass"
        }),
        small_flora: Object.freeze({
          asset: "decor_top_flowers",
          path: ASSET_PATHS.decor_top_flowers,
          category: "FLOWERS",
          spritePrefix: "flower"
        }),
        small_props: Object.freeze({
          asset: "decor_top_mushrooms",
          path: ASSET_PATHS.decor_top_mushrooms,
          category: "MUSHROOMS",
          spritePrefix: "mushroom"
        }),
        bushes: Object.freeze({
          asset: "decor_top_bushes",
          path: ASSET_PATHS.decor_top_bushes,
          category: "BUSHES",
          spritePrefix: "bush"
        }),
        stones: Object.freeze({
          asset: "decor_top_stones",
          path: ASSET_PATHS.decor_top_stones,
          category: "STONES",
          spritePrefix: "stone"
        }),
        tufts: Object.freeze({
          asset: "decor_top_tufts",
          path: ASSET_PATHS.decor_top_tufts,
          category: "TUFTS",
          spritePrefix: "tuft"
        }),
        hero: Object.freeze({
          asset: "decor_top_trees",
          path: ASSET_PATHS.decor_top_trees,
          category: "TREES",
          spritePrefix: "tree"
        })
      })
    });
    const meadowDecorKit =
      supportsLazyLoading && typeof BIOME_DECOR_VISUALS.registerLazy === "function"
        ? BIOME_DECOR_VISUALS.registerLazy("meadow", createMeadowDecorKit)
        : createMeadowDecorKit();
    BIOME_DECOR_VISUALS.register("meadow", meadowDecorKit);
    const meadowPortalVisuals =
      supportsLazyLoading && typeof BIOME_PORTAL_VISUALS.registerLazy === "function"
        ? BIOME_PORTAL_VISUALS.registerLazy("meadow")
        : BIOME_PORTAL_VISUALS.resolve("meadow");
    let meadowAssetManifest = null;
    const BOTTOM_SPIKE_SOURCE = Object.freeze({x: 10, y: 13, w: 235, h: 297});
    const OPTIONAL_ASSET_NAMES = Object.freeze([
      "background_clouds_back",
      "background_clouds_front",
      "bottom_spike_tile"
    ]);
    const BACKGROUND_ASSET_NAMES = Object.freeze([
      "background",
      "background_sky_base",
      "background_clouds_back",
      "background_landscape",
      "background_clouds_front"
    ]);
    const HAZARD_ASSET_NAMES = Object.freeze(["bottom_spike_tile"]);
    const CLOUD_BACK_LEFT_SPEED = 6;
    const CLOUD_BACK_WRAP_OVERLAP = 8;
    const CLOUD_FRONT_LEFT_SPEED = 12;
    const CLOUD_FRONT_WRAP_OVERLAP = 29;
    const assets = {};


    function loadAsset(name, path) {
      const image = new Image();
      const ready = new Promise(resolve => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.decoding = "async";
      image.src = path;
      assets[name] = {image, ready};
    }

    let backgroundReadyPromise = null;
    let hazardReadyPromise = null;
    let readyPromise = null;
    const backgroundLoader = supportsLazyLoading
      ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
        for (const name of BACKGROUND_ASSET_NAMES) {
          loadAsset(name, ASSET_PATHS[name]);
        }
        return Promise.all(BACKGROUND_ASSET_NAMES.map(name => (
          assets[name].ready.then(loaded => OPTIONAL_ASSET_NAMES.includes(name) || loaded)
        ))).then(results => results.every(Boolean));
      })
      : null;
    const hazardLoader = supportsLazyLoading
      ? BIOME_PLATFORM_VISUALS.createAssetLoader(() => {
        for (const name of HAZARD_ASSET_NAMES) loadAsset(name, ASSET_PATHS[name]);
        return Promise.all(HAZARD_ASSET_NAMES.map(name => (
          assets[name].ready.then(loaded => OPTIONAL_ASSET_NAMES.includes(name) || loaded)
        ))).then(results => results.every(Boolean));
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
      for (const [name, path] of Object.entries(ASSET_PATHS)) {
        if (
          !PLATFORM_ASSET_NAMES.includes(name) &&
          !EXTERNAL_ASSET_NAMES.includes(name)
        ) loadAsset(name, path);
      }
      backgroundReadyPromise = Promise.all(BACKGROUND_ASSET_NAMES.map(name => (
        assets[name].ready.then(loaded => OPTIONAL_ASSET_NAMES.includes(name) || loaded)
      ))).then(results => results.every(Boolean));
      hazardReadyPromise = Promise.all(HAZARD_ASSET_NAMES.map(name => (
        assets[name].ready.then(loaded => OPTIONAL_ASSET_NAMES.includes(name) || loaded)
      ))).then(results => results.every(Boolean));
    }

    function isReady(name) {
      if (PLATFORM_ASSET_NAMES.includes(name)) {
        return meadowPlatformKit.isAssetReady(name);
      }
      if (DECOR_ASSET_NAMES.includes(name)) {
        return meadowDecorKit.isAssetReady(name);
      }
      if (name === "portal") return meadowPortalVisuals.isReady();
      const image = assets[name]?.image;
      return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    }

    function areAllReady() {
      return Object.keys(ASSET_PATHS).every(name => (
        OPTIONAL_ASSET_NAMES.includes(name) ||
        EXTERNAL_ASSET_NAMES.includes(name) ||
        isReady(name)
      ));
    }

    function whenReady() {
      if (!readyPromise) {
        readyPromise = Promise.all([
          meadowPlatformKit.whenReady(),
          meadowDecorKit.whenReady().then(() => true),
          meadowPortalVisuals.whenReady().then(() => true),
          requestBackgroundAssets(),
          requestHazardAssets()
        ]).then(results => results.every(Boolean));
      }
      return readyPromise;
    }

    function getTopOverlaySelection(levelSeed) {
      return meadowPlatformKit.getTopOverlaySelection(levelSeed);
    }

    function getBodyOverlaySelection(levelSeed) {
      return meadowPlatformKit.getBodyOverlaySelection(levelSeed);
    }

    function getScene(level, decorNonce = 0) {
      return meadowDecorKit.getScene(level, decorNonce);
    }

    function drawBackgroundLayer(context, name, width, height, offsetX = 0) {
      if (!isReady(name)) return false;
      const source = SOURCE_SIZES[name];
      context.drawImage(
        assets[name].image,
        0, 0, source.w, source.h,
        offsetX, 0, width, height
      );
      return true;
    }

    function getCloudWrapDestinations(time, width, leftSpeed, overlap) {
      const safeTime = Number.isFinite(time) ? time : 0;
      const cloudWidth = SOURCE_SIZES.background_clouds_back.w;
      const wrapDistance = cloudWidth - overlap;
      const travel = (
        (safeTime * leftSpeed) % wrapDistance + wrapDistance
      ) % wrapDistance;
      const offsetX = travel === 0 ? 0 : -travel;
      const scaleX = width / cloudWidth;
      return Object.freeze([0, wrapDistance].map(copyOffset => (
        (offsetX + copyOffset) * scaleX
      )));
    }

    function drawWrappedCloudLayer(
      context,
      name,
      width,
      height,
      visualTime,
      leftSpeed,
      overlap
    ) {
      if (!isReady(name)) return false;
      for (const offsetX of getCloudWrapDestinations(
        visualTime,
        width,
        leftSpeed,
        overlap
      )) {
        drawBackgroundLayer(context, name, width, height, offsetX);
      }
      return true;
    }

    function drawBackground(context, width, height, visualTime = 0) {
      requestBackgroundAssets();
      const source = SOURCE_SIZES.background;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      if (isReady("background_sky_base") && isReady("background_landscape")) {
        drawBackgroundLayer(context, "background_sky_base", width, height);
        drawWrappedCloudLayer(
          context,
          "background_clouds_back",
          width,
          height,
          visualTime,
          CLOUD_BACK_LEFT_SPEED,
          CLOUD_BACK_WRAP_OVERLAP
        );
        drawBackgroundLayer(context, "background_landscape", width, height);
        drawWrappedCloudLayer(
          context,
          "background_clouds_front",
          width,
          height,
          visualTime,
          CLOUD_FRONT_LEFT_SPEED,
          CLOUD_FRONT_WRAP_OVERLAP
        );
      } else if (isReady("background")) {
        context.drawImage(
          assets.background.image,
          0, 0, source.w, source.h,
          0, 0, width, height
        );
      } else {
        context.restore();
        return false;
      }

      context.restore();
      return true;
    }

    function resolvePlatformRole(platform) {
      return meadowPlatformKit.resolvePlatformRole(platform);
    }

    function drawTopBackDecor(context, scene) {
      return meadowDecorKit.drawTopBackDecor(context, scene);
    }

    function drawStartGoalBackDecor(context, scene) {
      return meadowDecorKit.drawStartGoalBackDecor(context, scene);
    }

    function drawFloatingBackDecor(context, scene) {
      return meadowDecorKit.drawFloatingBackDecor(context, scene);
    }

    function drawTopFrontDecor(context, scene) {
      return meadowDecorKit.drawTopFrontDecor(context, scene);
    }

    function drawGoalSeamCoverProps(context, scene) {
      return meadowDecorKit.drawGoalSeamCoverProps(context, scene);
    }

    function drawPlatformBase(context, platform, drawX = platform.x, levelSeed = 0) {
      return meadowPlatformKit.drawPlatformBase(
        context,
        platform,
        drawX,
        levelSeed
      );
    }

    function drawBottomSpikeHazard(context, rect, count, step) {
      requestHazardAssets();
      if (!isReady("bottom_spike_tile")) return false;

      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      for (let i = 0; i < count; i++) {
        context.drawImage(
          assets.bottom_spike_tile.image,
          BOTTOM_SPIKE_SOURCE.x,
          BOTTOM_SPIKE_SOURCE.y,
          BOTTOM_SPIKE_SOURCE.w,
          BOTTOM_SPIKE_SOURCE.h,
          rect.x + i * step,
          rect.y,
          step,
          rect.h
        );
      }
      context.restore();
      return true;
    }

    function drawPortal(context, goal, visualTime = 0) {
      return meadowPortalVisuals.drawPortal(context, goal, visualTime);
    }

    function drawGoalTopForeground(context, platform, levelSeed = 0) {
      return meadowPlatformKit.drawGoalTopForeground(context, platform, levelSeed);
    }

    function getStatus() {
      return Object.freeze({
        ready: areAllReady(),
        paths: ASSET_PATHS,
        loaded: Object.freeze(
          Object.fromEntries(Object.keys(ASSET_PATHS).map(name => [name, isReady(name)]))
        ),
        platformKit: meadowPlatformKit.getStatus(),
        decorAlphaProfiles: meadowDecorKit.getStatus().alphaProfiles,
        decorKit: meadowDecorKit.getStatus(),
        portal: meadowPortalVisuals.getStatus()
      });
    }

    function getManifest() {
      if (!meadowAssetManifest) {
        meadowAssetManifest = Object.freeze({
          biome: "meadow",
          paths: ASSET_PATHS,
          sourceSizes: SOURCE_SIZES,
          platforms: meadowPlatformKit.getManifest(),
          decor: Object.freeze({gridV2: meadowDecorKit.getManifest()})
        });
      }
      return meadowAssetManifest;
    }

    return Object.freeze({
      whenReady,
      requestBackgroundAssets,
      requestHazardAssets,
      areAllReady,
      getStatus,
      getManifest,
      getTopOverlaySelection,
      getBodyOverlaySelection,
      getPlatformKit: () => meadowPlatformKit,
      getDecorKit: () => meadowDecorKit,
      getPortalVisuals: () => meadowPortalVisuals,
      getScene,
      resolvePlatformRole,
      drawBackground,
      drawTopBackDecor,
      drawStartGoalBackDecor,
      drawFloatingBackDecor,
      drawPlatformBase,
      drawBottomSpikeHazard,
      drawGoalSeamCoverProps,
      drawPortal,
      drawGoalTopForeground,
      drawTopFrontDecor
    });
  })();

  BIOME_PLATFORM_VISUALS.register("meadow", MEADOW_ASSET_VISUALS);
