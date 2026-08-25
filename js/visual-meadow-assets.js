"use strict";

  const MEADOW_ASSET_VISUALS = (() => {
    const MEADOW_TOP_OVERLAY_START = 0x53544152;
    const MEADOW_TOP_OVERLAY_GOAL = 0x474f414c;
    const MEADOW_BODY_OVERLAY_GOAL = 0x424f474c;
    const MEADOW_TOP_DECOR_START = 0x44535441;
    const MEADOW_TOP_DECOR_GOAL = 0x44474f41;
    const MEADOW_GOAL_SEAM_COVER = 0x47534356;
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
    const FAMILY_A_SOURCE = Object.freeze({x: 0, y: 0, w: 352, h: 128});
    const TOP_DECOR_GRID_CONTRACT = Object.freeze({
      sheet: Object.freeze({w: 1536, h: 1024}),
      columns: 3,
      rows: 2,
      slot: Object.freeze({w: 512, h: 512}),
      anchor: Object.freeze({x: 256, y: 448}),
      motifWidth: 448,
      alphaThreshold: 8,
      contactBand: Object.freeze({top: 432, bottom: 456}),
      safeArea: Object.freeze({
        robust: Object.freeze({left: 32, top: 32, right: 479, bottom: 448}),
        robustFringeBottom: 456,
        faintAlphaBottom: 460
      })
    });
    const TOP_DECOR_ROLE_WIDTHS = Object.freeze({
      GRASS: Object.freeze({COMPACT: 34, WIDE: 62, LARGE: 78}),
      FLOWERS: Object.freeze({COMPACT: 34, STANDARD: 52}),
      MUSHROOMS: Object.freeze({COMPACT: 30, STANDARD: 40}),
      BUSHES: Object.freeze({COMPACT: 34, LARGE: 66}),
      STONES: Object.freeze({COMPACT: 32, WIDE: 60}),
      TUFTS: Object.freeze({COMPACT: 32, STANDARD: 40}),
      TREES: Object.freeze({WIDE: 60, HERO: 132})
    });

    function createDecorSpriteNames(prefix) {
      return Object.freeze(Array.from(
        {length: 6},
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`
      ));
    }

    const TOP_DECOR_GRID_CATEGORIES = Object.freeze({
      GRASS: Object.freeze({
        asset: "decor_top_grass",
        sprites: createDecorSpriteNames("grass"),
        slotRoles: Object.freeze(["COMPACT", "WIDE", "LARGE", "WIDE", "LARGE", "LARGE"])
      }),
      FLOWERS: Object.freeze({
        asset: "decor_top_flowers",
        sprites: createDecorSpriteNames("flower"),
        slotRoles: Object.freeze(Array(6).fill("STANDARD"))
      }),
      MUSHROOMS: Object.freeze({
        asset: "decor_top_mushrooms",
        sprites: createDecorSpriteNames("mushroom"),
        slotRoles: Object.freeze(Array(6).fill("STANDARD"))
      }),
      BUSHES: Object.freeze({
        asset: "decor_top_bushes",
        sprites: createDecorSpriteNames("bush"),
        slotRoles: Object.freeze(Array(6).fill("LARGE"))
      }),
      STONES: Object.freeze({
        asset: "decor_top_stones",
        sprites: createDecorSpriteNames("stone"),
        slotRoles: Object.freeze(["COMPACT", "WIDE", "WIDE", "WIDE", "WIDE", "WIDE"])
      }),
      TUFTS: Object.freeze({
        asset: "decor_top_tufts",
        sprites: createDecorSpriteNames("tuft"),
        slotRoles: Object.freeze(Array(6).fill("STANDARD"))
      }),
      TREES: Object.freeze({
        asset: "decor_top_trees",
        sprites: createDecorSpriteNames("tree"),
        slotRoles: Object.freeze(["WIDE", "HERO", "HERO", "HERO", "HERO", "HERO"])
      })
    });
    const GRASS_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.GRASS.sprites;
    const FLOWER_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.FLOWERS.sprites;
    const MUSHROOM_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.MUSHROOMS.sprites;
    const BUSH_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.BUSHES.sprites;
    const STONE_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.STONES.sprites;
    const TUFT_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.TUFTS.sprites;
    const TREE_DECOR_SPRITE_NAMES = TOP_DECOR_GRID_CATEGORIES.TREES.sprites;

    function getDecorRoleWidth(category, sizeRole) {
      return TOP_DECOR_ROLE_WIDTHS[category][sizeRole];
    }

    function createDecorGridSprite(category, slotIndex) {
      const contract = TOP_DECOR_GRID_CONTRACT;
      const categoryContract = TOP_DECOR_GRID_CATEGORIES[category];
      const sizeRole = categoryContract.slotRoles[slotIndex];
      return Object.freeze({
        asset: categoryContract.asset,
        category,
        source: Object.freeze({
          x: slotIndex % contract.columns * contract.slot.w,
          y: Math.floor(slotIndex / contract.columns) * contract.slot.h,
          w: contract.slot.w,
          h: contract.slot.h
        }),
        anchor: contract.anchor,
        alphaProfile: categoryContract.sprites[slotIndex],
        visibleBounds: Object.freeze({x: 32, y: 32, w: 448, h: 425}),
        visibleBase: Object.freeze({left: 32, right: 479}),
        motifWidth: contract.motifWidth,
        sizeRole,
        nominalWidth: getDecorRoleWidth(category, sizeRole)
      });
    }

    const ASSET_PATHS = Object.freeze({
      background: "assets/environments/meadow/background/meadow_background.png",
      background_sky_base: "assets/environments/meadow/background/meadow_background_sky_base.png",
      background_clouds_back: "assets/environments/meadow/background/meadow_background_clouds_back.png",
      background_landscape: "assets/environments/meadow/background/meadow_background_landscape.png",
      background_clouds_front: "assets/environments/meadow/background/meadow_background_clouds_front.png",
      floating_left: "assets/environments/meadow/platforms/floating_left.png",
      floating_middle: "assets/environments/meadow/platforms/floating_middle.png",
      floating_right: "assets/environments/meadow/platforms/floating_right.png",
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
      floating_left: Object.freeze({w: 128, h: 128}),
      floating_middle: Object.freeze({w: 256, h: 128}),
      floating_right: Object.freeze({w: 128, h: 128}),
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
    const TOP_DECOR_SPRITES = Object.freeze(Object.fromEntries(
      Object.entries(TOP_DECOR_GRID_CATEGORIES).flatMap(([category, categoryContract]) => (
        categoryContract.sprites.map((name, index) => [
          name,
          createDecorGridSprite(category, index)
        ])
      ))
    ));
    const TOP_DECOR_ASSET_NAMES = Object.freeze(
      [...new Set(Object.values(TOP_DECOR_SPRITES).map(sprite => sprite.asset))]
    );
    const TOP_DECOR_SPRITE_NAMES = Object.freeze(Object.keys(TOP_DECOR_SPRITES));
    const TOP_DECOR_SPRITE_NAMES_BY_ASSET = Object.freeze(Object.fromEntries(
      Object.values(TOP_DECOR_GRID_CATEGORIES).map(categoryContract => (
        [categoryContract.asset, categoryContract.sprites]
      ))
    ));
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
        leftWidth: 26,
        middleTileWidth: 52,
        middleTileAdvance: 51,
        rightWidth: 26,
        middleMode: "repeat-source-crop",
        contentFit: Object.freeze({
          alphaThreshold: 8,
          bodyRowMinimumCoverage: 0.5,
          topOverhang: 2,
          bottomOverhang: 3,
          mode: "shared-robust-alpha-body-band"
        })
      }),
      start: Object.freeze({
        width: 235,
        height: 80,
        topMode: "proportional-width-clip",
        overflow: "clip"
      }),
      goal: Object.freeze({
        width: 220,
        topHeight: 80,
        bodyRowHeight: 80,
        bodyOverlap: 1,
        bodyRowStep: 79,
        lastBodyMode: "proportional-source-crop",
        bodyOverlayMode: "single-bottom-aligned-body-clip"
      })
    });
    // Keep the platform-kit slots declarative so future biome manifests can
    // provide the same logical base/overlay structure with different artwork.
    const PLATFORM_SLOTS = Object.freeze({
      floating_left: Object.freeze({
        asset: "floating_left",
        w: 128,
        h: 128,
        source: Object.freeze({x: 0, y: 0, w: 128, h: 128})
      }),
      floating_middle: Object.freeze({
        asset: "floating_middle",
        w: 256,
        h: 128,
        source: Object.freeze({x: 0, y: 0, w: 256, h: 128})
      }),
      floating_right: Object.freeze({
        asset: "floating_right",
        w: 128,
        h: 128,
        source: Object.freeze({x: 0, y: 0, w: 128, h: 128})
      }),
      meadow_top_base: Object.freeze({asset: "meadow_top_base", w: 352, h: 128}),
      meadow_body_base: Object.freeze({
        asset: "meadow_body_base",
        w: 352,
        h: 128
      }),
      meadow_top_overlays: Object.freeze(
        MEADOW_TOP_OVERLAY_ASSET_NAMES.map(asset => Object.freeze({asset, w: 352, h: 128}))
      ),
      meadow_body_overlays: Object.freeze(
        MEADOW_BODY_OVERLAY_ASSET_NAMES.map(asset => Object.freeze({asset, w: 352, h: 128}))
      )
    });
    const MEADOW_PLATFORM_KIT = Object.freeze({
      familyA: Object.freeze({
        source: FAMILY_A_SOURCE,
        topBase: PLATFORM_SLOTS.meadow_top_base,
        bodyBase: PLATFORM_SLOTS.meadow_body_base,
        topOverlays: PLATFORM_SLOTS.meadow_top_overlays,
        bodyOverlays: PLATFORM_SLOTS.meadow_body_overlays
      }),
      familyB: Object.freeze({
        left: PLATFORM_SLOTS.floating_left,
        middle: PLATFORM_SLOTS.floating_middle,
        right: PLATFORM_SLOTS.floating_right
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
        kit: MEADOW_PLATFORM_KIT,
        topOverlaySelection: Object.freeze({
          startSalt: MEADOW_TOP_OVERLAY_START,
          goalSalt: MEADOW_TOP_OVERLAY_GOAL,
          mode: "independent-salts-shift-goal-on-collision"
        }),
        bodyOverlaySelection: Object.freeze({
          goalSalt: MEADOW_BODY_OVERLAY_GOAL,
          mode: "single-goal-overlay"
        })
      }),
      decor: Object.freeze({
        gridV2: Object.freeze({
          contract: TOP_DECOR_GRID_CONTRACT,
          roleWidths: TOP_DECOR_ROLE_WIDTHS,
          sheets: Object.freeze(Object.fromEntries(
            Object.entries(TOP_DECOR_GRID_CATEGORIES).map(([category, categoryContract]) => [
              category,
              Object.freeze({
                asset: categoryContract.asset,
                sprites: categoryContract.sprites,
                slotRoles: categoryContract.slotRoles
              })
            ])
          ))
        })
      })
    });
    const PORTAL_SOURCE = Object.freeze({x: 9, y: 21, w: 239, h: 248});
    const PORTAL_DESTINATION_WIDTH = 180;
    const PORTAL_DESTINATION_HEIGHT =
      PORTAL_SOURCE.h * PORTAL_DESTINATION_WIDTH / PORTAL_SOURCE.w;
    const PORTAL_LEGACY_REFERENCE_WIDTH = 180;
    const PORTAL_LEGACY_REFERENCE_HEIGHT = 191;
    const PORTAL_CONTENT_Y_OFFSET = 2.703876527;
    const GOAL_SEAM_COVER_EDGE_INSET = 3;
    const GOAL_SEAM_COVER_BASELINE_OFFSET = 11;
    const GOAL_SEAM_COVER_MINIMUM_GAP = 1;
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
    const floatingAlphaProfiles = {};
    const decorAlphaProfiles = {};
    let floatingContentFit = null;

    function analyzeRobustDecorComponent(pixels, width, height) {
      const contract = TOP_DECOR_GRID_CONTRACT;
      const visited = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      let best = null;

      for (let start = 0; start < visited.length; start++) {
        if (visited[start] || pixels[start * 4 + 3] <= contract.alphaThreshold) continue;
        let head = 0;
        let tail = 0;
        let count = 0;
        let left = width;
        let right = -1;
        let top = height;
        let bottom = -1;
        let baseLeft = width;
        let baseRight = -1;
        let basePixelCount = 0;
        let baselinePixelCount = 0;
        visited[start] = 1;
        queue[tail++] = start;

        while (head < tail) {
          const pixelIndex = queue[head++];
          const x = pixelIndex % width;
          const y = Math.floor(pixelIndex / width);
          count += 1;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          if (y >= contract.contactBand.top && y <= contract.contactBand.bottom) {
            baseLeft = Math.min(baseLeft, x);
            baseRight = Math.max(baseRight, x);
            basePixelCount += 1;
          }
          if (y === contract.anchor.y) baselinePixelCount += 1;

          for (let offsetY = -1; offsetY <= 1; offsetY++) {
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
              if (offsetX === 0 && offsetY === 0) continue;
              const neighborX = x + offsetX;
              const neighborY = y + offsetY;
              if (
                neighborX < 0 || neighborX >= width ||
                neighborY < 0 || neighborY >= height
              ) continue;
              const neighborIndex = neighborY * width + neighborX;
              if (
                visited[neighborIndex] ||
                pixels[neighborIndex * 4 + 3] <= contract.alphaThreshold
              ) continue;
              visited[neighborIndex] = 1;
              queue[tail++] = neighborIndex;
            }
          }
        }

        if (!best || count > best.count) {
          best = {
            count,
            left,
            right,
            top,
            bottom,
            baseLeft,
            baseRight,
            basePixelCount,
            baselinePixelCount
          };
        }
      }

      if (!best) return null;
      const hasContact = best.basePixelCount > 0;
      return Object.freeze({
        visibleBounds: Object.freeze({
          x: best.left,
          y: best.top,
          w: best.right - best.left + 1,
          h: best.bottom - best.top + 1
        }),
        visibleBase: Object.freeze({
          left: hasContact ? best.baseLeft : best.left,
          right: hasContact ? best.baseRight : best.right
        }),
        robustPixelCount: best.count,
        contactPixelCount: best.basePixelCount,
        baselinePixelCount: best.baselinePixelCount
      });
    }

    function analyzeDecorGridAsset(image, spriteNames) {
      if (typeof document === "undefined" || !document.createElement) return;
      try {
        const surface = document.createElement("canvas");
        surface.width = image.naturalWidth;
        surface.height = image.naturalHeight;
        const context = surface.getContext("2d", {willReadFrequently: true});
        if (!context) return;
        context.clearRect(0, 0, surface.width, surface.height);
        context.drawImage(image, 0, 0);
        for (const name of spriteNames) {
          const source = TOP_DECOR_SPRITES[name].source;
          const profile = analyzeRobustDecorComponent(
            context.getImageData(source.x, source.y, source.w, source.h).data,
            source.w,
            source.h
          );
          if (profile) decorAlphaProfiles[name] = profile;
        }
      } catch {
        // The declarative safe-area bounds remain a conservative fallback.
      }
    }

    function createFloatingContentFit(sourceZones) {
      const contract = PLATFORM_VISUAL_CONTRACT.floating.contentFit;
      return Object.freeze({
        analyzed: true,
        alphaThreshold: contract.alphaThreshold,
        bodyRowMinimumCoverage: contract.bodyRowMinimumCoverage,
        topOverhang: contract.topOverhang,
        bottomOverhang: contract.bottomOverhang,
        topDecorSource: Object.freeze({...sourceZones.topDecorSource}),
        bodySource: Object.freeze({...sourceZones.bodySource}),
        bottomDecorSource: Object.freeze({...sourceZones.bottomDecorSource})
      });
    }

    function findLongestCoveredRowRun(rowCounts, minimumCount) {
      let bestStart = -1;
      let bestEnd = -1;
      let runStart = -1;
      for (let y = 0; y <= rowCounts.length; y++) {
        const covered = y < rowCounts.length && rowCounts[y] >= minimumCount;
        if (covered && runStart < 0) runStart = y;
        if (!covered && runStart >= 0) {
          if (bestStart < 0 || y - runStart > bestEnd - bestStart) {
            bestStart = runStart;
            bestEnd = y;
          }
          runStart = -1;
        }
      }
      return bestStart >= 0 ? Object.freeze({start: bestStart, end: bestEnd}) : null;
    }

    function analyzeFloatingAlpha(image, slot) {
      if (typeof document === "undefined" || !document.createElement) return null;
      try {
        const surface = document.createElement("canvas");
        surface.width = slot.w;
        surface.height = slot.h;
        const context = surface.getContext("2d", {willReadFrequently: true});
        if (!context) return null;
        context.clearRect(0, 0, slot.w, slot.h);
        context.drawImage(image, 0, 0, slot.w, slot.h);
        const pixels = context.getImageData(0, 0, slot.w, slot.h).data;
        const rowCounts = Array(slot.h).fill(0);
        let robustTop = slot.h;
        let robustBottom = -1;
        const alphaThreshold = PLATFORM_VISUAL_CONTRACT.floating.contentFit.alphaThreshold;
        for (let y = 0; y < slot.h; y++) {
          for (let x = 0; x < slot.w; x++) {
            if (pixels[(y * slot.w + x) * 4 + 3] <= alphaThreshold) continue;
            rowCounts[y] += 1;
            robustTop = Math.min(robustTop, y);
            robustBottom = Math.max(robustBottom, y);
          }
        }
        if (robustBottom < robustTop) return null;
        const minimumCount = Math.ceil(
          slot.w * PLATFORM_VISUAL_CONTRACT.floating.contentFit.bodyRowMinimumCoverage
        );
        const bodyRun = findLongestCoveredRowRun(rowCounts, minimumCount);
        if (!bodyRun) return null;
        return Object.freeze({
          robustTop,
          robustBottom: robustBottom + 1,
          bodyTop: bodyRun.start,
          bodyBottom: bodyRun.end
        });
      } catch {
        return null;
      }
    }

    function updateFloatingContentFit() {
      const profiles = FLOATING_SLOT_NAMES.map(name => floatingAlphaProfiles[name]);
      if (profiles.some(profile => !profile)) return;
      const bodyTop = Math.max(...profiles.map(profile => profile.bodyTop));
      const bodyBottom = Math.min(...profiles.map(profile => profile.bodyBottom));
      if (bodyBottom <= bodyTop) return;
      const robustTop = Math.min(...profiles.map(profile => profile.robustTop));
      const robustBottom = Math.max(...profiles.map(profile => profile.robustBottom));
      floatingContentFit = createFloatingContentFit({
        topDecorSource: {y: robustTop, h: Math.max(0, bodyTop - robustTop)},
        bodySource: {y: bodyTop, h: bodyBottom - bodyTop},
        bottomDecorSource: {
          y: bodyBottom,
          h: Math.max(0, robustBottom - bodyBottom)
        }
      });
    }

    function loadAsset(name, path) {
      const image = new Image();
      const ready = new Promise(resolve => {
        image.onload = () => {
          if (FLOATING_SLOT_NAMES.includes(name)) {
            const profile = analyzeFloatingAlpha(image, PLATFORM_SLOTS[name]);
            if (profile) {
              floatingAlphaProfiles[name] = profile;
              updateFloatingContentFit();
            }
          }
          const decorSpriteNames = TOP_DECOR_SPRITE_NAMES_BY_ASSET[name];
          if (decorSpriteNames) analyzeDecorGridAsset(image, decorSpriteNames);
          resolve(true);
        };
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

    function getTopOverlaySelection(levelSeed) {
      const startIndex = hashVisualSeed(
        levelSeed,
        MEADOW_TOP_OVERLAY_START
      ) % MEADOW_TOP_OVERLAY_ASSET_NAMES.length;
      let goalIndex = hashVisualSeed(
        levelSeed,
        MEADOW_TOP_OVERLAY_GOAL
      ) % MEADOW_TOP_OVERLAY_ASSET_NAMES.length;
      if (goalIndex === startIndex) {
        goalIndex = (goalIndex + 1) % MEADOW_TOP_OVERLAY_ASSET_NAMES.length;
      }
      return Object.freeze({
        startIndex,
        goalIndex,
        startAsset: MEADOW_TOP_OVERLAY_ASSET_NAMES[startIndex],
        goalAsset: MEADOW_TOP_OVERLAY_ASSET_NAMES[goalIndex]
      });
    }

    function getTopOverlaySlot(role, levelSeed) {
      const selection = getTopOverlaySelection(levelSeed);
      const index = role === "START_PLATFORM"
        ? selection.startIndex
        : selection.goalIndex;
      return PLATFORM_SLOTS.meadow_top_overlays[index];
    }

    function getBodyOverlaySelection(levelSeed) {
      const goalIndex = hashVisualSeed(
        levelSeed,
        MEADOW_BODY_OVERLAY_GOAL
      ) % MEADOW_BODY_OVERLAY_ASSET_NAMES.length;
      return Object.freeze({
        goalIndex,
        goalAsset: MEADOW_BODY_OVERLAY_ASSET_NAMES[goalIndex]
      });
    }

    function getBodyOverlaySlot(levelSeed) {
      const selection = getBodyOverlaySelection(levelSeed);
      return PLATFORM_SLOTS.meadow_body_overlays[selection.goalIndex];
    }

    function freezeItems(items) {
      return Object.freeze(items.map(item => Object.freeze(item)));
    }

    const FLOATING_TOP_DECOR_SEQUENCE = Object.freeze([
      Object.freeze({sprites: GRASS_DECOR_SPRITE_NAMES, sizeRole: "COMPACT"}),
      Object.freeze({sprites: FLOWER_DECOR_SPRITE_NAMES, sizeRole: "COMPACT"}),
      Object.freeze({sprites: MUSHROOM_DECOR_SPRITE_NAMES, sizeRole: "COMPACT"}),
      Object.freeze({sprites: TUFT_DECOR_SPRITE_NAMES, sizeRole: "COMPACT"}),
      Object.freeze({sprites: STONE_DECOR_SPRITE_NAMES, sizeRole: "COMPACT"}),
      Object.freeze({sprites: BUSH_DECOR_SPRITE_NAMES, sizeRole: "COMPACT"})
    ]);
    const START_GOAL_TREE_DECOR = Object.freeze(TREE_DECOR_SPRITE_NAMES.map(sprite => (
      Object.freeze({sprite, layer: "back"})
    )));
    const START_GOAL_BACK_DECOR = Object.freeze([
      Object.freeze({sprites: Object.freeze(BUSH_DECOR_SPRITE_NAMES.slice(0, 3)), layer: "back"}),
      Object.freeze({sprites: Object.freeze(BUSH_DECOR_SPRITE_NAMES.slice(3)), layer: "back"}),
      Object.freeze({sprites: Object.freeze(GRASS_DECOR_SPRITE_NAMES.slice(1, 3)), layer: "back"}),
      Object.freeze({sprites: Object.freeze(GRASS_DECOR_SPRITE_NAMES.slice(3)), layer: "back"}),
      Object.freeze({sprites: MUSHROOM_DECOR_SPRITE_NAMES, layer: "back"})
    ]);
    const START_GOAL_FRONT_DECOR = Object.freeze([
      Object.freeze({sprite: GRASS_DECOR_SPRITE_NAMES[0], layer: "front"}),
      Object.freeze({sprites: Object.freeze(FLOWER_DECOR_SPRITE_NAMES.slice(0, 3)), layer: "front"}),
      Object.freeze({sprites: Object.freeze(FLOWER_DECOR_SPRITE_NAMES.slice(3)), layer: "front"}),
      Object.freeze({sprites: Object.freeze(MUSHROOM_DECOR_SPRITE_NAMES.slice(0, 3)), layer: "front"}),
      Object.freeze({sprites: Object.freeze(MUSHROOM_DECOR_SPRITE_NAMES.slice(3)), layer: "front"}),
      Object.freeze({sprites: BUSH_DECOR_SPRITE_NAMES, layer: "front", sizeRole: "COMPACT"}),
      Object.freeze({sprite: STONE_DECOR_SPRITE_NAMES[0], layer: "front"}),
      Object.freeze({sprites: Object.freeze(STONE_DECOR_SPRITE_NAMES.slice(1)), layer: "front"}),
      Object.freeze({sprites: Object.freeze(TUFT_DECOR_SPRITE_NAMES.slice(0, 3)), layer: "front"}),
      Object.freeze({sprites: Object.freeze(TUFT_DECOR_SPRITE_NAMES.slice(3)), layer: "front"})
    ]);

    function randomInteger(random, minimum, maximum) {
      return minimum + Math.floor(random() * (maximum - minimum + 1));
    }

    function takeRandomSpecifications(random, source, count) {
      const available = [...source];
      const selected = [];
      while (selected.length < count && available.length > 0) {
        const specification = available.splice(
          randomInteger(random, 0, available.length - 1),
          1
        )[0];
        if (specification.sprites) {
          const {sprites, ...shared} = specification;
          selected.push(Object.freeze({
            ...shared,
            sprite: sprites[randomInteger(random, 0, sprites.length - 1)]
          }));
        } else {
          selected.push(specification);
        }
      }
      return selected;
    }

    function getDecorVisibleBounds(sprite) {
      return decorAlphaProfiles[sprite.alphaProfile]?.visibleBounds ?? sprite.visibleBounds;
    }

    function getDecorVisibleBase(sprite) {
      const analyzedBase = decorAlphaProfiles[sprite.alphaProfile]?.visibleBase;
      if (analyzedBase) return analyzedBase;
      if (sprite.visibleBase) return sprite.visibleBase;
      const visibleBounds = getDecorVisibleBounds(sprite);
      return Object.freeze({
        left: visibleBounds.x,
        right: visibleBounds.x + visibleBounds.w - 1
      });
    }

    function getGoalSeamDecorProfile(name) {
      const sprite = TOP_DECOR_SPRITES[name];
      const anchor = sprite.anchor;
      const visibleBounds = getDecorVisibleBounds(sprite);
      const visibleBase = getDecorVisibleBase(sprite);
      const scale = sprite.nominalWidth / sprite.motifWidth;
      const visibleWidth = visibleBounds.w * scale;
      const visibleHeight = visibleBounds.h * scale;
      const sizeScore = Math.max(1, visibleWidth / 38, visibleHeight / 30);
      return Object.freeze({
        name,
        sprite,
        anchor,
        visibleBase,
        scale,
        visibleHeight,
        selectionWeight: 1 / Math.pow(sizeScore, 1.6)
      });
    }

    function takeWeightedGoalSeamDecorNames(random, count) {
      const available = [...TOP_DECOR_SPRITE_NAMES];
      const selected = [];
      while (selected.length < count && available.length > 0) {
        const totalWeight = available.reduce((total, name) => (
          total + getGoalSeamDecorProfile(name).selectionWeight
        ), 0);
        let targetWeight = random() * totalWeight;
        let selectedIndex = available.length - 1;
        for (let index = 0; index < available.length; index++) {
          targetWeight -= getGoalSeamDecorProfile(available[index]).selectionWeight;
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
      const selected = takeWeightedGoalSeamDecorNames(random, count);
      const slotRatios = getGoalSeamCoverSlotRatios(count);
      const rankedSlots = [...slotRatios].sort((left, right) => (
        Math.abs(right - 0.5) - Math.abs(left - 0.5)
      ));
      const rankedProps = selected
        .map(getGoalSeamDecorProfile)
        .sort((left, right) => right.visibleHeight - left.visibleHeight);
      const positioned = rankedProps.map((profile, index) => ({
        profile,
        slotRatio: rankedSlots[index],
        desiredCenter: goalPlatform.x +
          goalPlatform.w * rankedSlots[index] + (random() - 0.5)
      })).sort((left, right) => left.desiredCenter - right.desiredCenter);
      const leftEdge = goalPlatform.x + GOAL_SEAM_COVER_EDGE_INSET;
      const rightEdge = goalPlatform.x + goalPlatform.w - GOAL_SEAM_COVER_EDGE_INSET;
      for (const item of positioned) {
        item.baseFootprintWidth =
          (item.profile.visibleBase.right - item.profile.visibleBase.left) *
          item.profile.scale;
      }
      let fitScale = 1;
      for (let index = 0; index < positioned.length; index++) {
        const item = positioned[index];
        if (item.baseFootprintWidth > 0) {
          fitScale = Math.min(
            fitScale,
            2 * (item.desiredCenter - leftEdge) / item.baseFootprintWidth,
            2 * (rightEdge - item.desiredCenter) / item.baseFootprintWidth
          );
        }
        if (index === 0) continue;
        const previous = positioned[index - 1];
        const combinedHalfWidth =
          (previous.baseFootprintWidth + item.baseFootprintWidth) / 2;
        if (combinedHalfWidth <= 0) continue;
        fitScale = Math.min(
          fitScale,
          (item.desiredCenter - previous.desiredCenter - GOAL_SEAM_COVER_MINIMUM_GAP) /
            combinedHalfWidth
        );
      }
      fitScale = Math.max(0, fitScale);
      const drafts = positioned.map(item => {
        const {profile} = item;
        const scale = profile.scale * fitScale;
        const leftExtent = (profile.anchor.x - profile.visibleBase.left) * scale;
        const rightExtent = (profile.visibleBase.right - profile.anchor.x) * scale;
        const footprintWidth = leftExtent + rightExtent;
        return {
          ...item,
          scale,
          leftExtent,
          rightExtent,
          footprintWidth,
          left: item.desiredCenter - footprintWidth / 2
        };
      });
      const items = drafts.map(draft => {
        const {profile} = draft;
        return {
          sprite: profile.name,
          category: profile.sprite.category,
          role: "GOAL_TOWER",
          layer: "goal-seam-cover",
          platformX: goalPlatform.x,
          platformY: goalPlatform.y,
          platformW: goalPlatform.w,
          platformH: goalPlatform.h,
          baselineX: draft.left + draft.leftExtent,
          baselineY: goalPlatform.y + GOAL_SEAM_COVER_BASELINE_OFFSET,
          baselineOffset: GOAL_SEAM_COVER_BASELINE_OFFSET,
          nominalWidth: profile.sprite.nominalWidth * fitScale,
          sizeRole: profile.sprite.sizeRole,
          anchor: profile.anchor,
          visibleBase: profile.visibleBase
        };
      });
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
        const sprite = TOP_DECOR_SPRITES[specification.sprite];
        const backAnchor = layer === "back" ? sprite.anchor : null;
        const backBase = backAnchor ? getDecorVisibleBase(sprite) : null;
        const sizeRole = specification.sizeRole ?? sprite.sizeRole;
        const nominalWidth = getDecorRoleWidth(sprite.category, sizeRole);
        const scale = nominalWidth / sprite.motifWidth;
        const minimumX = backAnchor
          ? 3 + (backAnchor.x - backBase.left) * scale
          : 5;
        const maximumX = backAnchor
          ? platform.w - 3 - (backBase.right - backAnchor.x) * scale
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
          ...(backAnchor
            ? {anchor: backAnchor, visibleBase: backBase}
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
        sizeRole: specification.sizeRole ?? sprite.sizeRole,
        role,
        layer: getTopDecorPreviewLayer(role, specification),
        platformX: platform.x,
        platformY: platform.y,
        platformW: platform.w,
        platformH: platform.h,
        baselineX,
        baselineY: platform.y + baselineOffset,
        baselineOffset,
        nominalWidth: getDecorRoleWidth(
          sprite.category,
          specification.sizeRole ?? sprite.sizeRole
        ),
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
          const sequenceIndex = index * 2 + slot;
          const selection = FLOATING_TOP_DECOR_SEQUENCE[
            sequenceIndex % FLOATING_TOP_DECOR_SEQUENCE.length
          ];
          let resolvedSelection = selection;
          if (selection.sprites) {
            const {sprites, ...shared} = selection;
            resolvedSelection = {
              ...shared,
              sprite: sprites[
                hashVisualSeed(
                  levelSeed,
                  (MEADOW_TOP_DECOR_START ^ MEADOW_TOP_DECOR_GOAL ^ sequenceIndex) >>> 0
                ) % sprites.length
              ]
            };
          }
          items.push(createTopDecorPreviewItem(platform, "FLOATING", {
            ...resolvedSelection,
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

    function drawFamilyALayer(
      context,
      slot,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
      sourceHeight = FAMILY_A_SOURCE.h
    ) {
      context.drawImage(
        assets[slot.asset].image,
        FAMILY_A_SOURCE.x,
        FAMILY_A_SOURCE.y,
        FAMILY_A_SOURCE.w,
        sourceHeight,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight
      );
    }

    function drawGoalPlatform(context, platform, drawX, topOverlaySlot, bodyOverlaySlot) {
      const contract = PLATFORM_VISUAL_CONTRACT.goal;
      const blockBottom = platform.y + platform.h;
      const bodyStartY = platform.y + contract.topHeight - contract.bodyOverlap;
      const topSlot = PLATFORM_SLOTS.meadow_top_base;
      const bodySlot = PLATFORM_SLOTS.meadow_body_base;

      drawFamilyALayer(
        context,
        topSlot,
        drawX,
        platform.y,
        platform.w,
        contract.topHeight
      );
      drawFamilyALayer(
        context,
        topOverlaySlot,
        drawX,
        platform.y,
        platform.w,
        contract.topHeight
      );

      for (let destinationY = bodyStartY; destinationY < blockBottom;) {
        const destinationHeight = Math.min(
          contract.bodyRowHeight,
          blockBottom - destinationY
        );
        const sourceHeight = destinationHeight * FAMILY_A_SOURCE.h /
          contract.bodyRowHeight;
        drawFamilyALayer(
          context,
          bodySlot,
          drawX,
          destinationY,
          platform.w,
          destinationHeight,
          sourceHeight
        );
        if (destinationY + destinationHeight >= blockBottom) break;
        destinationY += contract.bodyRowStep;
      }

      context.save();
      context.beginPath();
      context.rect(
        drawX,
        bodyStartY,
        platform.w,
        Math.max(0, blockBottom - bodyStartY)
      );
      context.clip();
      drawFamilyALayer(
        context,
        bodyOverlaySlot,
        drawX,
        blockBottom - contract.bodyRowHeight,
        platform.w,
        contract.bodyRowHeight
      );
      context.restore();
    }

    function drawStartPlatform(context, platform, drawX, topOverlaySlot) {
      const topHeight = platform.w * (FAMILY_A_SOURCE.h / FAMILY_A_SOURCE.w);
      drawFamilyALayer(
        context,
        PLATFORM_SLOTS.meadow_top_base,
        drawX,
        platform.y,
        platform.w,
        topHeight
      );
      drawFamilyALayer(
        context,
        topOverlaySlot,
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
      return drawTopDecorLayer(context, scene?.goalSeamCoverProps ?? []);
    }

    function drawFloatingContentFitSegment(
      context,
      image,
      sourceX,
      sourceWidth,
      destinationX,
      destinationWidth,
      platformY
    ) {
      const contract = PLATFORM_VISUAL_CONTRACT.floating;
      const zones = [
        {
          source: floatingContentFit.topDecorSource,
          y: platformY - floatingContentFit.topOverhang,
          h: floatingContentFit.topOverhang
        },
        {
          source: floatingContentFit.bodySource,
          y: platformY,
          h: contract.height
        },
        {
          source: floatingContentFit.bottomDecorSource,
          y: platformY + contract.height,
          h: floatingContentFit.bottomOverhang
        }
      ];
      for (const zone of zones) {
        if (zone.source.h <= 0 || zone.h <= 0) continue;
        context.drawImage(
          image,
          sourceX,
          zone.source.y,
          sourceWidth,
          zone.source.h,
          destinationX,
          zone.y,
          destinationWidth,
          zone.h
        );
      }
    }

    function drawFloatingPlatform(context, platform, drawX) {
      const contract = PLATFORM_VISUAL_CONTRACT.floating;
      const capWidth = Math.min(contract.leftWidth, platform.w / 2);
      const leftSlot = PLATFORM_SLOTS.floating_left;
      const middleSlot = PLATFORM_SLOTS.floating_middle;
      const rightSlot = PLATFORM_SLOTS.floating_right;
      const left = assets[leftSlot.asset].image;
      const middle = assets[middleSlot.asset].image;
      const right = assets[rightSlot.asset].image;

      if (platform.w > contract.leftWidth + contract.rightWidth) {
        const middleStartX = drawX + contract.leftWidth - FLOATING_SEAM_OVERLAP;
        const middleEndX = drawX + platform.w - contract.rightWidth +
          FLOATING_SEAM_OVERLAP;
        let destinationX = middleStartX;

        while (destinationX < middleEndX) {
          const remainingWidth = middleEndX - destinationX;
          const destinationWidth = Math.min(contract.middleTileWidth, remainingWidth);
          const sourceWidth = middleSlot.source.w * (
            destinationWidth / contract.middleTileWidth
          );
          drawFloatingContentFitSegment(
            context,
            middle,
            middleSlot.source.x,
            sourceWidth,
            destinationX,
            destinationWidth,
            platform.y
          );
          if (destinationWidth >= remainingWidth) break;
          destinationX += contract.middleTileAdvance;
        }
      }

      drawFloatingContentFitSegment(
        context,
        left,
        leftSlot.source.x,
        leftSlot.source.w,
        drawX,
        capWidth,
        platform.y
      );
      drawFloatingContentFitSegment(
        context,
        right,
        rightSlot.source.x,
        rightSlot.source.w,
        drawX + platform.w - capWidth,
        capWidth,
        platform.y
      );
    }

    function drawPlatformBase(context, platform, drawX = platform.x, levelSeed = 0) {
      const role = resolvePlatformRole(platform);
      if (!role) return false;
      const topOverlaySlot = role === "START_PLATFORM" || role === "GOAL_TOWER"
        ? getTopOverlaySlot(role, levelSeed)
        : null;
      const bodyOverlaySlot = role === "GOAL_TOWER"
        ? getBodyOverlaySlot(levelSeed)
        : null;
      if (role === "FLOATING") {
        if (!FLOATING_SLOT_NAMES.every(slotName =>
          isReady(PLATFORM_SLOTS[slotName].asset)
        )) return false;
        if (!floatingContentFit) return false;
      } else if (role === "START_PLATFORM") {
        if (
          !isReady(PLATFORM_SLOTS.meadow_top_base.asset) ||
          !isReady(topOverlaySlot.asset)
        ) return false;
      } else if (role === "GOAL_TOWER") {
        if (
          !isReady(PLATFORM_SLOTS.meadow_top_base.asset) ||
          !isReady(topOverlaySlot.asset) ||
          !isReady(PLATFORM_SLOTS.meadow_body_base.asset) ||
          !isReady(bodyOverlaySlot.asset)
        ) return false;
      }

      context.save();
      if (role !== "FLOATING") {
        traceRoundedRect(context, drawX, platform.y, platform.w, platform.h, 10);
        context.clip();
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (role === "GOAL_TOWER") {
        drawGoalPlatform(context, platform, drawX, topOverlaySlot, bodyOverlaySlot);
      } else if (role === "FLOATING") {
        drawFloatingPlatform(context, platform, drawX);
      } else {
        drawStartPlatform(context, platform, drawX, topOverlaySlot);
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
      const legacyX = goal.x + goal.w / 2 - PORTAL_LEGACY_REFERENCE_WIDTH / 2;
      const legacyY = goal.y + goal.h + 15 - PORTAL_LEGACY_REFERENCE_HEIGHT +
        PORTAL_VISUAL_Y_OFFSET;
      const x = legacyX;
      const y = legacyY + PORTAL_CONTENT_Y_OFFSET;

      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.shadowColor = "rgba(162,91,255,0.55)";
      context.shadowBlur = 16;
      context.drawImage(
        assets.portal.image,
        PORTAL_SOURCE.x, PORTAL_SOURCE.y, PORTAL_SOURCE.w, PORTAL_SOURCE.h,
        x, y, PORTAL_DESTINATION_WIDTH, PORTAL_DESTINATION_HEIGHT
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
      context.translate(
        legacyX + PORTAL_LEGACY_REFERENCE_WIDTH * 0.48,
        legacyY + PORTAL_LEGACY_REFERENCE_HEIGHT * 0.49
      );
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
      const topSlot = PLATFORM_SLOTS.meadow_top_base;
      const topOverlaySlot = getTopOverlaySlot("GOAL_TOWER", levelSeed);
      if (!isReady(topSlot.asset) || !isReady(topOverlaySlot.asset)) return false;

      context.save();
      traceRoundedRect(context, platform.x, platform.y, platform.w, platform.h, 10);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      // Repeat the same base/overlay pair so the existing portal-foot occlusion
      // keeps the exact Goal-top appearance and deterministic selection.
      drawFamilyALayer(
        context,
        topSlot,
        platform.x,
        platform.y,
        platform.w,
        PLATFORM_VISUAL_CONTRACT.goal.topHeight
      );
      drawFamilyALayer(
        context,
        topOverlaySlot,
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
        ),
        floatingContentFit,
        decorAlphaProfiles: Object.freeze({...decorAlphaProfiles})
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
      getTopOverlaySelection,
      getBodyOverlaySelection,
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
