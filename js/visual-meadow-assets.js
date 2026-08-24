"use strict";

  const MEADOW_ASSET_VISUALS = (() => {
    const MEADOW_TOP_VARIANT_START = 0x53544152;
    const MEADOW_TOP_VARIANT_GOAL = 0x474f414c;
    const MEADOW_BODY_TOP_GOAL = 0x4254474c;
    const MEADOW_TOP_DECOR_START = 0x44535441;
    const MEADOW_TOP_DECOR_GOAL = 0x44474f41;
    const MEADOW_GOAL_SEAM_COVER = 0x47534356;
    const MEADOW_TOP_VARIANT_ASSET_NAMES = Object.freeze([
      "meadow_top_01",
      "meadow_top_02",
      "meadow_top_03",
      "meadow_top_04",
      "meadow_top_05",
      "meadow_top_06"
    ]);
    const MEADOW_BODY_TOP_VARIANT_ASSET_NAMES = Object.freeze([
      "meadow_body_top_01",
      "meadow_body_top_02",
      "meadow_body_top_03",
      "meadow_body_top_04"
    ]);
    const MEADOW_BODY_TOP_SOURCE_INSETS = Object.freeze([
      Object.freeze({top: 0, right: 0, bottom: 3, left: 3}),
      Object.freeze({top: 1, right: 0, bottom: 4, left: 0}),
      Object.freeze({top: 1, right: 0, bottom: 2, left: 0}),
      Object.freeze({top: 0, right: 3, bottom: 3, left: 0})
    ]);
    const ASSET_PATHS = Object.freeze({
      background: "assets/environments/meadow/background/meadow_background.png",
      background_sky_base: "assets/environments/meadow/background/meadow_background_sky_base.png",
      background_clouds_back: "assets/environments/meadow/background/meadow_background_clouds_back.png",
      background_landscape: "assets/environments/meadow/background/meadow_background_landscape.png",
      background_clouds_front: "assets/environments/meadow/background/meadow_background_clouds_front.png",
      floating_left: "assets/environments/meadow/platforms/floating_left.png",
      floating_middle: "assets/environments/meadow/platforms/floating_middle.png",
      floating_right: "assets/environments/meadow/platforms/floating_right.png",
      meadow_top_01: "assets/environments/meadow/platforms/meadow_top_01.png",
      meadow_top_02: "assets/environments/meadow/platforms/meadow_top_02.png",
      meadow_top_03: "assets/environments/meadow/platforms/meadow_top_03.png",
      meadow_top_04: "assets/environments/meadow/platforms/meadow_top_04.png",
      meadow_top_05: "assets/environments/meadow/platforms/meadow_top_05.png",
      meadow_top_06: "assets/environments/meadow/platforms/meadow_top_06.png",
      meadow_body_top_01: "assets/environments/meadow/platforms/meadow_body_top_01.png",
      meadow_body_top_02: "assets/environments/meadow/platforms/meadow_body_top_02.png",
      meadow_body_top_03: "assets/environments/meadow/platforms/meadow_body_top_03.png",
      meadow_body_top_04: "assets/environments/meadow/platforms/meadow_body_top_04.png",
      meadow_body_base: "assets/environments/meadow/platforms/meadow_body_base.png",
      decor_top_grass: "assets/environments/meadow/decor/top/meadow_decor_top_grass_set_01.png",
      decor_top_flowers: "assets/environments/meadow/decor/top/meadow_decor_top_flowers_set_01.png",
      decor_top_mushrooms: "assets/environments/meadow/decor/top/meadow_decor_top_mushrooms_set_01.png",
      decor_top_bushes: "assets/environments/meadow/decor/top/meadow_decor_top_bushes_set_01.png",
      decor_top_stones: "assets/environments/meadow/decor/top/meadow_decor_top_stones_set_01.png",
      decor_top_tufts: "assets/environments/meadow/decor/top/meadow_decor_top_tufts_set_01.png",
      decor_top_trees: "assets/environments/meadow/decor/top/meadow_decor_top_trees_set_01.png",
      portal: "assets/environments/meadow/portal/meadow_portal_props.png",
      bottom_spike_tile: "assets/environments/meadow/hazards/meadow_bottom_spike_tile.png"
    });
    const SOURCE_SIZES = Object.freeze({
      background: Object.freeze({w: 1672, h: 941}),
      background_sky_base: Object.freeze({w: 1280, h: 720}),
      background_clouds_back: Object.freeze({w: 1280, h: 720}),
      background_landscape: Object.freeze({w: 1280, h: 720}),
      background_clouds_front: Object.freeze({w: 1280, h: 720}),
      floating_left: Object.freeze({w: 112, h: 127}),
      floating_middle: Object.freeze({w: 300, h: 127}),
      floating_right: Object.freeze({w: 108, h: 127}),
      meadow_top_01: Object.freeze({w: 2048, h: 745}),
      meadow_top_02: Object.freeze({w: 2048, h: 745}),
      meadow_top_03: Object.freeze({w: 2048, h: 745}),
      meadow_top_04: Object.freeze({w: 2048, h: 745}),
      meadow_top_05: Object.freeze({w: 2048, h: 745}),
      meadow_top_06: Object.freeze({w: 2048, h: 745}),
      meadow_body_top_01: Object.freeze({w: 2048, h: 745}),
      meadow_body_top_02: Object.freeze({w: 2048, h: 745}),
      meadow_body_top_03: Object.freeze({w: 2048, h: 745}),
      meadow_body_top_04: Object.freeze({w: 2048, h: 745}),
      meadow_body_base: Object.freeze({w: 2081, h: 758}),
      decor_top_grass: Object.freeze({w: 1448, h: 1086}),
      decor_top_flowers: Object.freeze({w: 1536, h: 1024}),
      decor_top_mushrooms: Object.freeze({w: 1536, h: 1024}),
      decor_top_bushes: Object.freeze({w: 1448, h: 1086}),
      decor_top_stones: Object.freeze({w: 1536, h: 1024}),
      decor_top_tufts: Object.freeze({w: 1536, h: 1024}),
      decor_top_trees: Object.freeze({w: 1448, h: 1086}),
      portal: Object.freeze({w: 1448, h: 1086}),
      bottom_spike_tile: Object.freeze({w: 256, h: 320})
    });
    const TOP_DECOR_SPRITES = Object.freeze({
      grassCompactFan: Object.freeze({
        asset: "decor_top_grass",
        category: "GRASS",
        source: Object.freeze({x: 208, y: 104, w: 320, h: 224}),
        anchor: Object.freeze({x: 162, y: 202}),
        motifWidth: 256,
        nominalWidth: 34
      }),
      grassTallFan: Object.freeze({
        asset: "decor_top_grass",
        category: "GRASS",
        source: Object.freeze({x: 816, y: 16, w: 496, h: 320}),
        anchor: Object.freeze({x: 247.5, y: 291}),
        motifWidth: 447,
        nominalWidth: 62
      }),
      grassWildArching: Object.freeze({
        asset: "decor_top_grass",
        category: "GRASS",
        source: Object.freeze({x: 736, y: 320, w: 656, h: 384}),
        anchor: Object.freeze({x: 327, y: 354}),
        motifWidth: 588,
        nominalWidth: 78
      }),
      flowersWhiteDaisy: Object.freeze({
        asset: "decor_top_flowers",
        category: "FLOWERS",
        source: Object.freeze({x: 48, y: 64, w: 416, h: 384}),
        anchor: Object.freeze({x: 204, y: 343}),
        motifWidth: 342,
        nominalWidth: 46
      }),
      flowersLowMeadowMix: Object.freeze({
        asset: "decor_top_flowers",
        category: "FLOWERS",
        source: Object.freeze({x: 448, y: 528, w: 608, h: 432}),
        anchor: Object.freeze({x: 301, y: 379}),
        motifWidth: 532,
        nominalWidth: 60
      }),
      mushroomRedSingle: Object.freeze({
        asset: "decor_top_mushrooms",
        category: "MUSHROOMS",
        source: Object.freeze({x: 112, y: 176, w: 336, h: 288}),
        anchor: Object.freeze({x: 164.5, y: 251}),
        motifWidth: 261,
        nominalWidth: 34
      }),
      mushroomsRedPair: Object.freeze({
        asset: "decor_top_mushrooms",
        category: "MUSHROOMS",
        source: Object.freeze({x: 544, y: 112, w: 416, h: 352}),
        anchor: Object.freeze({x: 207.5, y: 317}),
        motifWidth: 349,
        nominalWidth: 48
      }),
      bushLayeredCluster: Object.freeze({
        asset: "decor_top_bushes",
        category: "BUSHES",
        source: Object.freeze({x: 544, y: 320, w: 496, h: 400}),
        anchor: Object.freeze({x: 248.5, y: 364}),
        motifWidth: 447,
        nominalWidth: 66
      }),
      bushTallLeafy: Object.freeze({
        asset: "decor_top_bushes",
        category: "BUSHES",
        source: Object.freeze({x: 0, y: 336, w: 560, h: 464}),
        anchor: Object.freeze({x: 280, y: 440}),
        motifWidth: 502,
        nominalWidth: 68
      }),
      stoneMossySingle: Object.freeze({
        asset: "decor_top_stones",
        category: "STONES",
        source: Object.freeze({x: 176, y: 64, w: 368, h: 288}),
        anchor: Object.freeze({x: 182, y: 235}),
        motifWidth: 286,
        nominalWidth: 32
      }),
      stoneMossyFlat: Object.freeze({
        asset: "decor_top_stones",
        category: "STONES",
        source: Object.freeze({x: 80, y: 368, w: 672, h: 288}),
        anchor: Object.freeze({x: 335.5, y: 246}),
        motifWidth: 591,
        nominalWidth: 60
      }),
      tuftSimpleFan: Object.freeze({
        asset: "decor_top_tufts",
        category: "TUFTS",
        source: Object.freeze({x: 32, y: 208, w: 416, h: 288}),
        anchor: Object.freeze({x: 205.5, y: 250}),
        motifWidth: 357,
        nominalWidth: 32
      }),
      tuftBroadLeafFan: Object.freeze({
        asset: "decor_top_tufts",
        category: "TUFTS",
        source: Object.freeze({x: 480, y: 176, w: 576, h: 336}),
        anchor: Object.freeze({x: 287.5, y: 287}),
        motifWidth: 511,
        nominalWidth: 48
      }),
      treeSaplingLeafy: Object.freeze({
        asset: "decor_top_trees",
        category: "TREES",
        source: Object.freeze({x: 64, y: 144, w: 288, h: 320}),
        anchor: Object.freeze({x: 146.5, y: 298}),
        motifWidth: 207,
        nominalWidth: 32
      }),
      treeRoundFlowering: Object.freeze({
        asset: "decor_top_trees",
        category: "TREES",
        source: Object.freeze({x: 960, y: 16, w: 416, h: 464}),
        anchor: Object.freeze({x: 204.5, y: 428}),
        motifWidth: 329,
        nominalWidth: 59
      })
    });
    const TOP_DECOR_ASSET_NAMES = Object.freeze(
      [...new Set(Object.values(TOP_DECOR_SPRITES).map(sprite => sprite.asset))]
    );
    const TOP_DECOR_PREVIEW_CONTRACT = Object.freeze({
      floatingBaseline: 2,
      startGoalBackMinimum: 1,
      startGoalBackMaximum: 2,
      startGoalFrontMinimum: 9,
      startGoalFrontMaximum: 11
    });
    const PLATFORM_VISUAL_CONTRACT = Object.freeze({
      floating: Object.freeze({
        height: 26,
        leftWidth: 23,
        rightWidth: 22,
        middleMode: "horizontal-scale-or-crop"
      }),
      start: Object.freeze({
        width: 235,
        height: 80,
        topMode: "proportional-width-clip",
        bodyHeight: 48,
        bodyOverlap: 1,
        bodyOverflow: "clip"
      }),
      goal: Object.freeze({
        width: 220,
        topHeight: 80,
        bodyHeight: 48,
        bodyOverlap: 1,
        lastBodyMode: "full-row-clip"
      })
    });
    // Standalone slots and the remaining legacy atlas mappings stay isolated
    // from the renderer. Future biome manifests can provide the same logical
    // slots with different artwork.
    const PLATFORM_SLOTS = Object.freeze({
      floating_left: Object.freeze({asset: "floating_left", w: 112, h: 127}),
      floating_middle: Object.freeze({asset: "floating_middle", w: 300, h: 127}),
      floating_right: Object.freeze({asset: "floating_right", w: 108, h: 127}),
      meadow_top_variants: Object.freeze(
        MEADOW_TOP_VARIANT_ASSET_NAMES.map(asset => Object.freeze({asset, w: 2048, h: 745}))
      ),
      meadow_body_top_variants: Object.freeze(
        MEADOW_BODY_TOP_VARIANT_ASSET_NAMES.map((asset, index) => {
          const insets = MEADOW_BODY_TOP_SOURCE_INSETS[index];
          return Object.freeze({
            asset,
            w: 2048,
            h: 745,
            trimTop: insets.top,
            trimRight: insets.right,
            trimBottom: insets.bottom,
            trimLeft: insets.left,
            source: Object.freeze({
              x: insets.left,
              y: insets.top,
              w: 2048 - insets.left - insets.right,
              h: 745 - insets.top - insets.bottom
            })
          });
        })
      ),
      // The normalized body texture is fully opaque through every outer edge.
      meadow_body_base: Object.freeze({
        asset: "meadow_body_base",
        w: 2081,
        h: 758,
        source: Object.freeze({x: 1, y: 1, w: 2079, h: 756})
      })
    });
    const FLOATING_SLOT_NAMES = Object.freeze([
      "floating_left",
      "floating_middle",
      "floating_right"
    ]);
    const FLOATING_SEAM_OVERLAP = 1;
    const MEADOW_ASSET_MANIFEST = Object.freeze({
      biome: "meadow",
      paths: ASSET_PATHS,
      sourceSizes: SOURCE_SIZES,
      platforms: Object.freeze({
        contract: PLATFORM_VISUAL_CONTRACT,
        slots: PLATFORM_SLOTS,
        topVariantSelection: Object.freeze({
          startSalt: MEADOW_TOP_VARIANT_START,
          goalSalt: MEADOW_TOP_VARIANT_GOAL,
          mode: "start-index-plus-goal-from-remaining-five"
        }),
        bodyTopVariantSelection: Object.freeze({
          goalSalt: MEADOW_BODY_TOP_GOAL,
          mode: "goal-index"
        })
      })
    });
    const PORTAL_SPRITE = Object.freeze({x: 24, y: 50, w: 712, h: 755});
    const GOAL_SEAM_COVER_SPRITES = Object.freeze({
      portalLantern: Object.freeze({
        source: Object.freeze({x: 752, y: 512, w: 232, h: 312}),
        anchor: Object.freeze({x: 119, y: 289}),
        visibleBase: Object.freeze({left: 28, right: 210}),
        motifWidth: 195,
        motifHeight: 269,
        nominalWidth: 32,
        selectionWeight: 1
      }),
      portalFlowerClump: Object.freeze({
        source: Object.freeze({x: 992, y: 624, w: 256, h: 200}),
        anchor: Object.freeze({x: 115.5, y: 173}),
        visibleBase: Object.freeze({left: 15, right: 216}),
        motifWidth: 219,
        motifHeight: 146,
        nominalWidth: 26,
        selectionWeight: 1
      }),
      portalShortWoodPost: Object.freeze({
        source: Object.freeze({x: 1248, y: 552, w: 200, h: 272}),
        anchor: Object.freeze({x: 97, y: 248}),
        visibleBase: Object.freeze({left: 16, right: 178}),
        motifWidth: 168,
        motifHeight: 224,
        nominalWidth: 23,
        selectionWeight: 1
      }),
      portalMossStoneMushrooms: Object.freeze({
        source: Object.freeze({x: 16, y: 832, w: 336, h: 224}),
        anchor: Object.freeze({x: 172, y: 196}),
        visibleBase: Object.freeze({left: 44, right: 300}),
        motifWidth: 289,
        motifHeight: 171,
        nominalWidth: 30,
        selectionWeight: 1
      }),
      portalStoneGrassClump: Object.freeze({
        source: Object.freeze({x: 352, y: 848, w: 320, h: 208}),
        anchor: Object.freeze({x: 176.5, y: 176}),
        visibleBase: Object.freeze({left: 89, right: 264}),
        motifWidth: 267,
        motifHeight: 153,
        nominalWidth: 30,
        selectionWeight: 1
      }),
      portalFallenLog: Object.freeze({
        source: Object.freeze({x: 672, y: 832, w: 400, h: 224}),
        anchor: Object.freeze({x: 197.5, y: 199}),
        visibleBase: Object.freeze({left: 35, right: 360}),
        motifWidth: 357,
        motifHeight: 176,
        nominalWidth: 38,
        selectionWeight: 0.25
      }),
      portalTreeStump: Object.freeze({
        source: Object.freeze({x: 1072, y: 832, w: 376, h: 224}),
        anchor: Object.freeze({x: 173.5, y: 196}),
        visibleBase: Object.freeze({left: 26, right: 321}),
        motifWidth: 314,
        motifHeight: 171,
        nominalWidth: 32,
        selectionWeight: 1
      })
    });
    const GOAL_SEAM_COVER_NAMES = Object.freeze(
      Object.keys(GOAL_SEAM_COVER_SPRITES)
    );
    const GOAL_SEAM_COVER_EDGE_INSET = 3;
    const GOAL_SEAM_COVER_BASELINE_OFFSET = 11;
    const PORTAL_GLOW_PERIOD_SECONDS = 2.2;
    const PORTAL_GLOW_ALPHA_MINIMUM = 0.12;
    const PORTAL_GLOW_ALPHA_MAXIMUM = 0.68;
    const PORTAL_VISUAL_Y_OFFSET = 10;
    const BOTTOM_SPIKE_SOURCE = Object.freeze({x: 10, y: 13, w: 235, h: 297});
    const OPTIONAL_ASSET_NAMES = Object.freeze([
      "background_clouds_back",
      "background_clouds_front",
      "bottom_spike_tile"
    ]);
    const CLOUD_BACK_DRIFT_AMPLITUDE = 15;
    const CLOUD_BACK_DRIFT_PERIOD_SECONDS = 22;
    const CLOUD_FRONT_DRIFT_AMPLITUDE = 22;
    const CLOUD_FRONT_DRIFT_PERIOD_SECONDS = 15;
    const CLOUD_FRONT_DRIFT_PHASE = Math.PI / 3;
    const assets = {};
    const sceneCache = new WeakMap();

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

    for (const [name, path] of Object.entries(ASSET_PATHS)) {
      loadAsset(name, path);
    }

    const readyPromise = Promise.all(
      Object.entries(assets).map(([name, asset]) => (
        asset.ready.then(loaded => OPTIONAL_ASSET_NAMES.includes(name) || loaded)
      ))
    ).then(results => results.every(Boolean));

    function isReady(name) {
      const image = assets[name]?.image;
      return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    }

    function areAllReady() {
      return Object.keys(ASSET_PATHS).every(name => (
        OPTIONAL_ASSET_NAMES.includes(name) || isReady(name)
      ));
    }

    function whenReady() {
      return readyPromise;
    }

    function hashVisualSeed(seed, salt) {
      let value = (((Number(seed) || 0) >>> 0) ^ salt) >>> 0;
      value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
      value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
      return (value ^ (value >>> 16)) >>> 0;
    }

    function createDecorRandom(levelSeed, salt, decorNonce) {
      const nonceSalt = Math.imul((Number(decorNonce) || 0) >>> 0, 0x9e3779b1) >>> 0;
      let state = hashVisualSeed(levelSeed, (salt ^ nonceSalt) >>> 0);
      return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function getTopVariantSelection(levelSeed) {
      const startIndex = hashVisualSeed(
        levelSeed,
        MEADOW_TOP_VARIANT_START
      ) % MEADOW_TOP_VARIANT_ASSET_NAMES.length;
      const goalPoolIndex = hashVisualSeed(
        levelSeed,
        MEADOW_TOP_VARIANT_GOAL
      ) % (MEADOW_TOP_VARIANT_ASSET_NAMES.length - 1);
      const goalIndex = goalPoolIndex >= startIndex
        ? goalPoolIndex + 1
        : goalPoolIndex;
      return Object.freeze({
        startIndex,
        goalIndex,
        startAsset: MEADOW_TOP_VARIANT_ASSET_NAMES[startIndex],
        goalAsset: MEADOW_TOP_VARIANT_ASSET_NAMES[goalIndex]
      });
    }

    function getTopVariantSlot(role, levelSeed) {
      const selection = getTopVariantSelection(levelSeed);
      const index = role === "START_PLATFORM"
        ? selection.startIndex
        : selection.goalIndex;
      return PLATFORM_SLOTS.meadow_top_variants[index];
    }

    function getBodyTopVariantSelection(levelSeed) {
      const goalIndex = hashVisualSeed(
        levelSeed,
        MEADOW_BODY_TOP_GOAL
      ) % MEADOW_BODY_TOP_VARIANT_ASSET_NAMES.length;
      return Object.freeze({
        goalIndex,
        goalAsset: MEADOW_BODY_TOP_VARIANT_ASSET_NAMES[goalIndex]
      });
    }

    function getBodyTopVariantSlot(levelSeed) {
      const selection = getBodyTopVariantSelection(levelSeed);
      return PLATFORM_SLOTS.meadow_body_top_variants[selection.goalIndex];
    }

    function freezeItems(items) {
      return Object.freeze(items.map(item => Object.freeze(item)));
    }

    const FLOATING_TOP_DECOR_SEQUENCE = Object.freeze([
      Object.freeze({sprite: "grassCompactFan", nominalWidth: 30}),
      Object.freeze({sprite: "flowersWhiteDaisy", nominalWidth: 34}),
      Object.freeze({sprite: "mushroomRedSingle", nominalWidth: 30}),
      Object.freeze({sprite: "tuftSimpleFan", nominalWidth: 28}),
      Object.freeze({sprite: "stoneMossySingle", nominalWidth: 28}),
      Object.freeze({sprite: "bushLayeredCluster", nominalWidth: 32})
    ]);
    const START_GOAL_TREE_DECOR = Object.freeze([
      Object.freeze({sprite: "treeRoundFlowering", layer: "back", nominalWidth: 132}),
      Object.freeze({sprite: "treeSaplingLeafy", layer: "back", nominalWidth: 60})
    ]);
    const START_GOAL_BACK_DECOR = Object.freeze([
      Object.freeze({sprite: "bushLayeredCluster", layer: "back"}),
      Object.freeze({sprite: "bushTallLeafy", layer: "back"}),
      Object.freeze({sprite: "grassTallFan", layer: "back"}),
      Object.freeze({sprite: "grassWildArching", layer: "back"}),
      Object.freeze({sprite: "mushroomsRedPair", layer: "back"})
    ]);
    const START_GOAL_BACK_PLACEMENT = Object.freeze({
      treeRoundFlowering: Object.freeze({
        anchor: Object.freeze({x: 204.5, y: 419}),
        base: Object.freeze({left: 132, right: 279})
      }),
      treeSaplingLeafy: Object.freeze({
        anchor: Object.freeze({x: 157, y: 285}),
        base: Object.freeze({left: 109, right: 201})
      }),
      bushLayeredCluster: Object.freeze({
        anchor: Object.freeze({x: 250.5, y: 356}),
        base: Object.freeze({left: 64, right: 437})
      }),
      bushTallLeafy: Object.freeze({
        anchor: Object.freeze({x: 259.5, y: 430}),
        base: Object.freeze({left: 63, right: 452})
      }),
      grassTallFan: Object.freeze({
        anchor: Object.freeze({x: 244, y: 279}),
        base: Object.freeze({left: 69, right: 413})
      }),
      grassWildArching: Object.freeze({
        anchor: Object.freeze({x: 331.5, y: 341}),
        base: Object.freeze({left: 95, right: 568})
      }),
      mushroomsRedPair: Object.freeze({
        anchor: Object.freeze({x: 188.5, y: 317}),
        base: Object.freeze({left: 48, right: 329})
      })
    });
    const START_GOAL_FRONT_DECOR = Object.freeze([
      Object.freeze({sprite: "grassCompactFan", layer: "front"}),
      Object.freeze({sprite: "flowersWhiteDaisy", layer: "front"}),
      Object.freeze({sprite: "flowersLowMeadowMix", layer: "front"}),
      Object.freeze({sprite: "mushroomRedSingle", layer: "front"}),
      Object.freeze({sprite: "mushroomsRedPair", layer: "front", nominalWidth: 38}),
      Object.freeze({sprite: "bushLayeredCluster", layer: "front", nominalWidth: 36}),
      Object.freeze({sprite: "stoneMossySingle", layer: "front"}),
      Object.freeze({sprite: "stoneMossyFlat", layer: "front"}),
      Object.freeze({sprite: "tuftSimpleFan", layer: "front"}),
      Object.freeze({sprite: "tuftBroadLeafFan", layer: "front"})
    ]);

    function randomInteger(random, minimum, maximum) {
      return minimum + Math.floor(random() * (maximum - minimum + 1));
    }

    function takeRandomSpecifications(random, source, count) {
      const available = [...source];
      const selected = [];
      while (selected.length < count && available.length > 0) {
        selected.push(available.splice(randomInteger(random, 0, available.length - 1), 1)[0]);
      }
      return selected;
    }

    function takeWeightedGoalSeamCoverNames(random, count) {
      const available = [...GOAL_SEAM_COVER_NAMES];
      const selected = [];
      while (selected.length < count && available.length > 0) {
        const totalWeight = available.reduce((total, name) => (
          total + GOAL_SEAM_COVER_SPRITES[name].selectionWeight
        ), 0);
        let targetWeight = random() * totalWeight;
        let selectedIndex = available.length - 1;
        for (let index = 0; index < available.length; index++) {
          targetWeight -= GOAL_SEAM_COVER_SPRITES[available[index]].selectionWeight;
          if (targetWeight <= 0) {
            selectedIndex = index;
            break;
          }
        }
        selected.push(available.splice(selectedIndex, 1)[0]);
      }
      return selected;
    }

    function getGoalSeamCoverSlotRatios(count) {
      if (count === 2) return [0.32, 0.68];
      if (count === 3) return [0.26, 0.50, 0.74];
      if (count === 4) return [0.22, 0.38, 0.62, 0.78];
      return [0.20, 0.35, 0.50, 0.65, 0.80];
    }

    function createGoalSeamCoverProps(level, goalPlatform, decorNonce) {
      if (!goalPlatform) return Object.freeze([]);
      const random = createDecorRandom(
        level?.seed ?? 0,
        MEADOW_GOAL_SEAM_COVER,
        decorNonce
      );
      const count = randomInteger(random, 2, 5);
      const selected = takeWeightedGoalSeamCoverNames(random, count);
      const slotRatios = getGoalSeamCoverSlotRatios(count);
      const rankedSlots = [...slotRatios].sort((left, right) => (
        Math.abs(right - 0.5) - Math.abs(left - 0.5)
      ));
      const rankedProps = [...selected].sort((left, right) => (
        GOAL_SEAM_COVER_SPRITES[right].motifHeight *
          GOAL_SEAM_COVER_SPRITES[right].nominalWidth /
          GOAL_SEAM_COVER_SPRITES[right].motifWidth -
        GOAL_SEAM_COVER_SPRITES[left].motifHeight *
          GOAL_SEAM_COVER_SPRITES[left].nominalWidth /
          GOAL_SEAM_COVER_SPRITES[left].motifWidth
      ));
      const items = rankedProps.map((spriteName, index) => {
        const sprite = GOAL_SEAM_COVER_SPRITES[spriteName];
        const scale = sprite.nominalWidth / sprite.motifWidth;
        const minimumX = GOAL_SEAM_COVER_EDGE_INSET +
          (sprite.anchor.x - sprite.visibleBase.left) * scale;
        const maximumX = goalPlatform.w - GOAL_SEAM_COVER_EDGE_INSET -
          (sprite.visibleBase.right - sprite.anchor.x) * scale;
        const desiredX = goalPlatform.w * rankedSlots[index] + (random() - 0.5);
        const x = Math.max(minimumX, Math.min(maximumX, desiredX));
        return {
          sprite: spriteName,
          role: "GOAL_TOWER",
          layer: "goal-seam-cover",
          platformX: goalPlatform.x,
          platformY: goalPlatform.y,
          platformW: goalPlatform.w,
          platformH: goalPlatform.h,
          baselineX: goalPlatform.x + x,
          baselineY: goalPlatform.y + GOAL_SEAM_COVER_BASELINE_OFFSET,
          baselineOffset: GOAL_SEAM_COVER_BASELINE_OFFSET,
          nominalWidth: sprite.nominalWidth,
          anchor: sprite.anchor,
          visibleBase: sprite.visibleBase
        };
      });
      items.sort((left, right) => left.baselineX - right.baselineX);
      return freezeItems(items);
    }

    function positionStartGoalSpecifications(
      role,
      platform,
      specifications,
      layer,
      random,
      decorNonce
    ) {
      const count = specifications.length;
      const ratios = layer === "back"
        ? role === "START_PLATFORM"
          ? {2: [0.18, 0.82], 3: [0.09, 0.50, 0.91]}[count]
          : {2: [0.16, 0.84], 3: [0.08, 0.48, 0.92]}[count]
        : {4: [0.14, 0.38, 0.63, 0.86], 5: [0.10, 0.30, 0.50, 0.70, 0.90]}[count];
      const retryShift = (((Number(decorNonce) || 0) % 7) - 3) * 0.45;
      return specifications.map((specification, index) => {
        const jitter = (random() - 0.5) * (layer === "back" ? 8 : 6);
        const roleShift = role === "START_PLATFORM" ? retryShift : -retryShift;
        const backPlacement = layer === "back"
          ? START_GOAL_BACK_PLACEMENT[specification.sprite]
          : null;
        const sprite = TOP_DECOR_SPRITES[specification.sprite];
        const nominalWidth = specification.nominalWidth ?? sprite.nominalWidth;
        const scale = nominalWidth / sprite.motifWidth;
        const minimumX = backPlacement
          ? 3 + (backPlacement.anchor.x - backPlacement.base.left) * scale
          : 5;
        const maximumX = backPlacement
          ? platform.w - 3 - (backPlacement.base.right - backPlacement.anchor.x) * scale
          : platform.w - 5;
        const x = Math.max(
          minimumX,
          Math.min(maximumX, platform.w * ratios[index] + jitter + roleShift)
        );
        return {
          ...specification,
          x,
          baselineOffset: layer === "back"
            ? randomInteger(random, 1, 2)
            : randomInteger(random, 9, 11),
          ...(backPlacement
            ? {anchor: backPlacement.anchor, visibleBase: backPlacement.base}
            : {})
        };
      });
    }

    function createStartGoalDecorSpecifications(
      role,
      platform,
      levelSeed,
      decorNonce,
      backCount,
      frontCount
    ) {
      const salt = role === "START_PLATFORM"
        ? MEADOW_TOP_DECOR_START
        : MEADOW_TOP_DECOR_GOAL;
      const random = createDecorRandom(levelSeed, salt, decorNonce);
      const treeCycle = (
        hashVisualSeed(levelSeed, salt) + ((Number(decorNonce) || 0) >>> 0)
      ) % 3;
      const includeTree = treeCycle !== 0;
      const back = takeRandomSpecifications(
        random,
        START_GOAL_BACK_DECOR,
        backCount - (includeTree ? 1 : 0)
      );
      if (includeTree) {
        const tree = START_GOAL_TREE_DECOR[
          randomInteger(random, 0, START_GOAL_TREE_DECOR.length - 1)
        ];
        const treeIndex = random() < 0.5 ? 0 : back.length;
        back.splice(treeIndex, 0, tree);
      }
      const front = takeRandomSpecifications(
        random,
        START_GOAL_FRONT_DECOR,
        frontCount
      );
      return [
        ...positionStartGoalSpecifications(
          role, platform, back, "back", random, decorNonce
        ),
        ...positionStartGoalSpecifications(
          role, platform, front, "front", random, decorNonce
        )
      ];
    }

    function getTopDecorPreviewLayer(role, specification) {
      if (role === "FLOATING") return "back";
      return specification.layer;
    }

    function createTopDecorPreviewItem(platform, role, specification) {
      const sprite = TOP_DECOR_SPRITES[specification.sprite];
      const baselineOffset = specification.baselineOffset;
      const baselineX = platform.x + (
        Number.isFinite(specification.x)
          ? specification.x
          : platform.w * specification.xRatio
      );
      return {
        sprite: specification.sprite,
        category: sprite.category,
        role,
        layer: getTopDecorPreviewLayer(role, specification),
        platformX: platform.x,
        platformY: platform.y,
        platformW: platform.w,
        platformH: platform.h,
        baselineX,
        baselineY: platform.y + baselineOffset,
        baselineOffset,
        nominalWidth: specification.nominalWidth ?? sprite.nominalWidth,
        ...(specification.anchor
          ? {anchor: specification.anchor, visibleBase: specification.visibleBase}
          : {})
      };
    }

    function createTopDecorPreview(level, decorNonce = 0) {
      const items = [];
      const platforms = Array.isArray(level?.platforms) ? level.platforms : [];
      const start = platforms.find(platform => resolvePlatformRole(platform) === "START_PLATFORM");
      const goal = platforms.find(platform => resolvePlatformRole(platform) === "GOAL_TOWER");
      const levelSeed = level?.seed ?? 0;
      const densityRandom = createDecorRandom(
        levelSeed,
        (MEADOW_TOP_DECOR_START ^ MEADOW_TOP_DECOR_GOAL) >>> 0,
        decorNonce
      );
      const startBackCount = randomInteger(densityRandom, 2, 3);
      const startFrontCount = 4;
      const startTotal = startBackCount + startFrontCount;
      const goalTotal = startTotal + randomInteger(densityRandom, 0, 1);
      const goalBackCount = goalTotal === 6
        ? 2
        : goalTotal >= 8
          ? 3
          : randomInteger(densityRandom, 2, 3);
      const goalFrontCount = goalTotal - goalBackCount;
      if (start) {
        const specifications = createStartGoalDecorSpecifications(
          "START_PLATFORM",
          start,
          levelSeed,
          decorNonce,
          startBackCount,
          startFrontCount
        );
        for (const specification of specifications) {
          items.push(createTopDecorPreviewItem(start, "START_PLATFORM", specification));
        }
      }
      if (goal) {
        const specifications = createStartGoalDecorSpecifications(
          "GOAL_TOWER",
          goal,
          levelSeed,
          decorNonce,
          goalBackCount,
          goalFrontCount
        );
        for (const specification of specifications) {
          items.push(createTopDecorPreviewItem(goal, "GOAL_TOWER", specification));
        }
      }

      const floating = platforms.filter(platform => resolvePlatformRole(platform) === "FLOATING");
      for (const [index, platform] of floating.entries()) {
        const count = platform.w < 108
          ? index % 2 === 0 ? 1 : 2
          : platform.w < 132
            ? 2
            : platform.w < 165
              ? 3
              : 4;
        const xRatios = {
          1: [0.5],
          2: [0.28, 0.72],
          3: [0.20, 0.50, 0.80],
          4: [0.14, 0.38, 0.62, 0.86]
        }[count];
        for (let slot = 0; slot < count; slot++) {
          const selection = FLOATING_TOP_DECOR_SEQUENCE[
            (index * 2 + slot) % FLOATING_TOP_DECOR_SEQUENCE.length
          ];
          items.push(createTopDecorPreviewItem(platform, "FLOATING", {
            ...selection,
            xRatio: xRatios[slot],
            baselineOffset: TOP_DECOR_PREVIEW_CONTRACT.floatingBaseline
          }));
        }
      }

      items.sort((left, right) => (
        left.baselineY - right.baselineY || left.baselineX - right.baselineX
      ));
      return Object.freeze({
        back: freezeItems(items.filter(item => item.layer === "back")),
        front: freezeItems(items.filter(item => item.layer === "front"))
      });
    }

    function createScene(level, decorNonce = 0) {
      const topDecorPreview = createTopDecorPreview(level, decorNonce);
      const platforms = Array.isArray(level?.platforms) ? level.platforms : [];
      const goalPlatform = platforms.find(platform => (
        resolvePlatformRole(platform) === "GOAL_TOWER"
      ));
      return Object.freeze({
        decorNonce,
        topBackDecor: topDecorPreview.back,
        topFrontDecor: topDecorPreview.front,
        goalSeamCoverProps: createGoalSeamCoverProps(level, goalPlatform, decorNonce)
      });
    }

    function getScene(level, decorNonce = 0) {
      const normalizedNonce = (Number(decorNonce) || 0) >>> 0;
      if (!level || (typeof level !== "object" && typeof level !== "function")) {
        return createScene(null, normalizedNonce);
      }
      let scenes = sceneCache.get(level);
      if (!scenes) {
        scenes = new Map();
        sceneCache.set(level, scenes);
      }
      let scene = scenes.get(normalizedNonce);
      if (!scene) {
        scene = createScene(level, normalizedNonce);
        scenes.set(normalizedNonce, scene);
      }
      return scene;
    }

    function traceRoundedRect(context, x, y, w, h, radius) {
      const r = Math.min(radius, w / 2, h / 2);
      context.beginPath();
      context.moveTo(x + r, y);
      context.arcTo(x + w, y, x + w, y + h, r);
      context.arcTo(x + w, y + h, x, y + h, r);
      context.arcTo(x, y + h, x, y, r);
      context.arcTo(x, y, x + w, y, r);
      context.closePath();
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

    function getCloudDriftOffset(time, amplitude, periodSeconds, phase = 0) {
      const safeTime = Number.isFinite(time) ? time : 0;
      return Math.sin(safeTime * Math.PI * 2 / periodSeconds + phase) * amplitude;
    }

    function drawBackground(context, width, height, visualTime = 0) {
      const source = SOURCE_SIZES.background;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      if (isReady("background_sky_base") && isReady("background_landscape")) {
        drawBackgroundLayer(context, "background_sky_base", width, height);
        drawBackgroundLayer(
          context,
          "background_clouds_back",
          width,
          height,
          getCloudDriftOffset(
            visualTime,
            CLOUD_BACK_DRIFT_AMPLITUDE,
            CLOUD_BACK_DRIFT_PERIOD_SECONDS
          )
        );
        drawBackgroundLayer(context, "background_landscape", width, height);
        drawBackgroundLayer(
          context,
          "background_clouds_front",
          width,
          height,
          getCloudDriftOffset(
            visualTime,
            CLOUD_FRONT_DRIFT_AMPLITUDE,
            CLOUD_FRONT_DRIFT_PERIOD_SECONDS,
            CLOUD_FRONT_DRIFT_PHASE
          )
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
      if (!platform || platform.lastBubbleSupport) return null;
      if (
        platform.x === 0 &&
        platform.w === PLATFORM_VISUAL_CONTRACT.start.width &&
        platform.h === PLATFORM_VISUAL_CONTRACT.start.height
      ) return "START_PLATFORM";
      if (
        platform.x === 1060 &&
        platform.w === PLATFORM_VISUAL_CONTRACT.goal.width &&
        platform.h >= PLATFORM_VISUAL_CONTRACT.goal.topHeight
      ) return "GOAL_TOWER";
      if (platform.h === PLATFORM_VISUAL_CONTRACT.floating.height) {
        return "FLOATING";
      }
      return null;
    }

    function drawGoalPlatform(context, platform, drawX, topSlot, bodyTopSlot) {
      const contract = PLATFORM_VISUAL_CONTRACT.goal;
      const topCapHeight = Math.min(contract.topHeight, platform.h);
      const blockBottom = platform.y + platform.h;
      const bodyTopSource = bodyTopSlot.source;
      const bodyTopHeight = platform.w * (bodyTopSource.h / bodyTopSource.w);
      const bodyTopY = platform.y + topCapHeight - contract.bodyOverlap;
      const bodySlot = PLATFORM_SLOTS.meadow_body_base;
      const bodySource = bodySlot.source;
      const bodyImage = assets[bodySlot.asset].image;

      if (platform.h > topCapHeight) {
        let destinationY = bodyTopY + bodyTopHeight - contract.bodyOverlap;
        while (destinationY < blockBottom) {
          context.drawImage(
            bodyImage,
            bodySource.x,
            bodySource.y,
            bodySource.w,
            bodySource.h,
            drawX,
            destinationY,
            platform.w,
            contract.bodyHeight
          );
          // Keep sampling identical for every row. The existing rounded
          // platform clip removes the final row's overflow at blockBottom.
          if (destinationY + contract.bodyHeight >= blockBottom) break;
          destinationY += contract.bodyHeight - contract.bodyOverlap;
        }

        context.drawImage(
          assets[bodyTopSlot.asset].image,
          bodyTopSource.x,
          bodyTopSource.y,
          bodyTopSource.w,
          bodyTopSource.h,
          drawX,
          bodyTopY,
          platform.w,
          bodyTopHeight
        );
      }

      // Draw last so its lower edge covers the one-pixel body overlap at the seam.
      context.drawImage(
        assets[topSlot.asset].image,
        drawX,
        platform.y,
        platform.w,
        topCapHeight
      );
    }

    function drawStartPlatform(context, platform, drawX, topSlot) {
      const contract = PLATFORM_VISUAL_CONTRACT.start;
      const topHeight = platform.w * (topSlot.h / topSlot.w);
      const bodySlot = PLATFORM_SLOTS.meadow_body_base;
      const bodySource = bodySlot.source;
      const bodyY = platform.y + topHeight - contract.bodyOverlap;

      // Keep the goal-style body row at its normal height. The platform clip
      // intentionally removes the part below the 235x80 start render target.
      context.drawImage(
        assets[bodySlot.asset].image,
        bodySource.x,
        bodySource.y,
        bodySource.w,
        bodySource.h,
        drawX,
        bodyY,
        platform.w,
        contract.bodyHeight
      );

      // Draw the complete, proportionally scaled top last, matching the goal
      // layer order while allowing its lower edge to overflow into the clip.
      context.drawImage(
        assets[topSlot.asset].image,
        drawX,
        platform.y,
        platform.w,
        topHeight
      );
    }

    function drawTopDecorLayer(context, items) {
      if (!TOP_DECOR_ASSET_NAMES.every(isReady)) return false;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      for (const item of items) {
        const sprite = TOP_DECOR_SPRITES[item.sprite];
        const anchor = item.anchor ?? sprite.anchor;
        const scale = item.nominalWidth / sprite.motifWidth;
        const destinationWidth = sprite.source.w * scale;
        const destinationHeight = sprite.source.h * scale;
        const destinationX = item.baselineX - anchor.x * scale;
        const destinationY = item.baselineY - anchor.y * scale;
        context.drawImage(
          assets[sprite.asset].image,
          sprite.source.x,
          sprite.source.y,
          sprite.source.w,
          sprite.source.h,
          destinationX,
          destinationY,
          destinationWidth,
          destinationHeight
        );
      }
      context.restore();
      return true;
    }

    function drawTopBackDecor(context, scene) {
      return drawTopDecorLayer(context, scene?.topBackDecor ?? []);
    }

    function drawStartGoalBackDecor(context, scene) {
      return drawTopDecorLayer(
        context,
        (scene?.topBackDecor ?? []).filter(item => item.role !== "FLOATING")
      );
    }

    function drawFloatingBackDecor(context, scene) {
      return drawTopDecorLayer(
        context,
        (scene?.topBackDecor ?? []).filter(item => item.role === "FLOATING")
      );
    }

    function drawTopFrontDecor(context, scene) {
      return drawTopDecorLayer(context, scene?.topFrontDecor ?? []);
    }

    function drawGoalSeamCoverProps(context, scene) {
      if (!isReady("portal")) return false;
      const items = scene?.goalSeamCoverProps ?? [];
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      for (const item of items) {
        const sprite = GOAL_SEAM_COVER_SPRITES[item.sprite];
        const scale = item.nominalWidth / sprite.motifWidth;
        context.drawImage(
          assets.portal.image,
          sprite.source.x,
          sprite.source.y,
          sprite.source.w,
          sprite.source.h,
          item.baselineX - sprite.anchor.x * scale,
          item.baselineY - sprite.anchor.y * scale,
          sprite.source.w * scale,
          sprite.source.h * scale
        );
      }
      context.restore();
      return true;
    }

    function drawFloatingPlatform(context, platform, drawX) {
      const contract = PLATFORM_VISUAL_CONTRACT.floating;
      const leftWidth = Math.min(contract.leftWidth, platform.w / 2);
      const rightWidth = Math.min(
        contract.rightWidth,
        platform.w - leftWidth
      );
      const middleWidth = platform.w - leftWidth - rightWidth;
      const seamOverlap = Math.min(
        FLOATING_SEAM_OVERLAP,
        Math.max(0, middleWidth / 2)
      );
      const left = assets[PLATFORM_SLOTS.floating_left.asset].image;
      const middle = assets[PLATFORM_SLOTS.floating_middle.asset].image;
      const right = assets[PLATFORM_SLOTS.floating_right.asset].image;

      context.drawImage(
        middle,
        drawX + leftWidth - seamOverlap,
        platform.y,
        middleWidth + seamOverlap * 2,
        contract.height
      );
      context.drawImage(
        left,
        drawX, platform.y, leftWidth, contract.height
      );
      context.drawImage(
        right,
        drawX + platform.w - rightWidth,
        platform.y,
        rightWidth,
        contract.height
      );
    }

    function drawPlatformBase(context, platform, drawX = platform.x, levelSeed = 0) {
      const role = resolvePlatformRole(platform);
      if (!role) return false;
      const topSlot = role === "START_PLATFORM" || role === "GOAL_TOWER"
        ? getTopVariantSlot(role, levelSeed)
        : null;
      const bodyTopSlot = role === "GOAL_TOWER"
        ? getBodyTopVariantSlot(levelSeed)
        : null;
      if (role === "FLOATING") {
        if (!FLOATING_SLOT_NAMES.every(slotName =>
          isReady(PLATFORM_SLOTS[slotName].asset)
        )) return false;
      } else if (role === "START_PLATFORM") {
        if (
          !isReady(topSlot.asset) ||
          !isReady(PLATFORM_SLOTS.meadow_body_base.asset)
        ) return false;
      } else if (role === "GOAL_TOWER") {
        if (
          !isReady(topSlot.asset) ||
          !isReady(bodyTopSlot.asset) ||
          !isReady(PLATFORM_SLOTS.meadow_body_base.asset)
        ) return false;
      }

      context.save();
      traceRoundedRect(context, drawX, platform.y, platform.w, platform.h, 10);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (role === "GOAL_TOWER") {
        drawGoalPlatform(context, platform, drawX, topSlot, bodyTopSlot);
      } else if (role === "FLOATING") {
        drawFloatingPlatform(context, platform, drawX);
      } else {
        drawStartPlatform(context, platform, drawX, topSlot);
      }
      context.restore();

      context.save();
      context.strokeStyle = "rgba(46,72,28,0.62)";
      context.lineWidth = 1.5;
      traceRoundedRect(context, drawX + 0.75, platform.y + 0.75, platform.w - 1.5, platform.h - 1.5, 9);
      context.stroke();
      context.restore();
      return true;
    }

    function drawBottomSpikeHazard(context, rect, count, step) {
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
      if (!isReady("portal")) return false;
      const width = 180;
      const height = 191;
      const x = goal.x + goal.w / 2 - width / 2;
      const y = goal.y + goal.h + 15 - height + PORTAL_VISUAL_Y_OFFSET;

      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.shadowColor = "rgba(162,91,255,0.55)";
      context.shadowBlur = 16;
      context.drawImage(
        assets.portal.image,
        PORTAL_SPRITE.x, PORTAL_SPRITE.y, PORTAL_SPRITE.w, PORTAL_SPRITE.h,
        x, y, width, height
      );
      context.restore();

      const pulse = (
        Math.sin((Number(visualTime) || 0) * Math.PI * 2 / PORTAL_GLOW_PERIOD_SECONDS) + 1
      ) / 2;
      const glowAlpha = PORTAL_GLOW_ALPHA_MINIMUM +
        (PORTAL_GLOW_ALPHA_MAXIMUM - PORTAL_GLOW_ALPHA_MINIMUM) * pulse;
      const glowRadius = 60;
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
      glow.addColorStop(0, `rgba(235,215,255,${glowAlpha})`);
      glow.addColorStop(0.42, `rgba(190,128,255,${glowAlpha * 0.70})`);
      glow.addColorStop(1, "rgba(137,70,230,0)");

      context.save();
      context.translate(x + width * 0.48, y + height * 0.49);
      context.scale(44 / glowRadius, 1);
      context.globalCompositeOperation = "screen";
      context.fillStyle = glow;
      context.beginPath();
      context.arc(0, 0, glowRadius, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return true;
    }

    function drawGoalTopForeground(context, platform, levelSeed = 0) {
      if (resolvePlatformRole(platform) !== "GOAL_TOWER") return false;
      const topSlot = getTopVariantSlot("GOAL_TOWER", levelSeed);
      if (!isReady(topSlot.asset)) return false;

      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      // Repeat the already selected Goal top with the exact original destination.
      // Its full artwork, rather than a synthetic lip, now occludes the portal base.
      context.drawImage(
        assets[topSlot.asset].image,
        platform.x,
        platform.y,
        platform.w,
        PLATFORM_VISUAL_CONTRACT.goal.topHeight
      );
      context.restore();
      return true;
    }

    function getStatus() {
      return Object.freeze({
        ready: areAllReady(),
        paths: ASSET_PATHS,
        loaded: Object.freeze(
          Object.fromEntries(Object.keys(ASSET_PATHS).map(name => [name, isReady(name)]))
        )
      });
    }

    function getManifest() {
      return MEADOW_ASSET_MANIFEST;
    }

    return Object.freeze({
      whenReady,
      areAllReady,
      getStatus,
      getManifest,
      getTopVariantSelection,
      getBodyTopVariantSelection,
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
