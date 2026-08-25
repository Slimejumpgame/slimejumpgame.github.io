"use strict";

  const PLATFORM_VISUAL_KIT_FAMILY_A_SOURCE = Object.freeze({
    x: 0,
    y: 0,
    w: 352,
    h: 128
  });
  const PLATFORM_VISUAL_KIT_CONTRACT = Object.freeze({
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
  const PLATFORM_VISUAL_KIT_NATIVE_SIZES = Object.freeze({
    familyA: Object.freeze({w: 352, h: 128}),
    floatingLeft: Object.freeze({w: 128, h: 128}),
    floatingMiddle: Object.freeze({w: 256, h: 128}),
    floatingRight: Object.freeze({w: 128, h: 128})
  });
  const PLATFORM_VISUAL_KIT_SEAM_OVERLAP = 1;

  function createPlatformVisualKit(config) {
    if (!config || typeof config.biome !== "string") {
      throw new TypeError("Platform visual kit requires a biome id");
    }
    if (config.familyA?.topOverlays?.length !== 6) {
      throw new RangeError("Platform visual kit requires exactly 6 top overlays");
    }
    if (config.familyA?.bodyOverlays?.length !== 3) {
      throw new RangeError("Platform visual kit requires exactly 3 body overlays");
    }

    const familyASource = PLATFORM_VISUAL_KIT_FAMILY_A_SOURCE;
    const slotNames = Object.freeze({
      topBase: config.slotNames?.topBase ?? "top_base",
      bodyBase: config.slotNames?.bodyBase ?? "body_base",
      topOverlays: config.slotNames?.topOverlays ?? "top_overlays",
      bodyOverlays: config.slotNames?.bodyOverlays ?? "body_overlays",
      floatingLeft: config.slotNames?.floatingLeft ?? "floating_left",
      floatingMiddle: config.slotNames?.floatingMiddle ?? "floating_middle",
      floatingRight: config.slotNames?.floatingRight ?? "floating_right"
    });
    const createSlot = (definition, size, includeSource = false) => Object.freeze({
      asset: definition.asset,
      w: size.w,
      h: size.h,
      ...(includeSource
        ? {source: Object.freeze({x: 0, y: 0, w: size.w, h: size.h})}
        : {})
    });
    const topBaseSlot = createSlot(
      config.familyA.topBase,
      PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA
    );
    const bodyBaseSlot = createSlot(
      config.familyA.bodyBase,
      PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA
    );
    const topOverlaySlots = Object.freeze(config.familyA.topOverlays.map(definition => (
      createSlot(definition, PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA)
    )));
    const bodyOverlaySlots = Object.freeze(config.familyA.bodyOverlays.map(definition => (
      createSlot(definition, PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA)
    )));
    const floatingLeftSlot = createSlot(
      config.familyB.left,
      PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingLeft,
      true
    );
    const floatingMiddleSlot = createSlot(
      config.familyB.middle,
      PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingMiddle,
      true
    );
    const floatingRightSlot = createSlot(
      config.familyB.right,
      PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingRight,
      true
    );
    const slots = Object.freeze({
      [slotNames.floatingLeft]: floatingLeftSlot,
      [slotNames.floatingMiddle]: floatingMiddleSlot,
      [slotNames.floatingRight]: floatingRightSlot,
      [slotNames.topBase]: topBaseSlot,
      [slotNames.bodyBase]: bodyBaseSlot,
      [slotNames.topOverlays]: topOverlaySlots,
      [slotNames.bodyOverlays]: bodyOverlaySlots
    });
    const kit = Object.freeze({
      familyA: Object.freeze({
        source: familyASource,
        topBase: topBaseSlot,
        bodyBase: bodyBaseSlot,
        topOverlays: topOverlaySlots,
        bodyOverlays: bodyOverlaySlots
      }),
      familyB: Object.freeze({
        left: floatingLeftSlot,
        middle: floatingMiddleSlot,
        right: floatingRightSlot
      })
    });
    const topOverlaySelection = Object.freeze({
      startSalt: config.salts.topStart,
      goalSalt: config.salts.topGoal,
      mode: "independent-salts-shift-goal-on-collision"
    });
    const bodyOverlaySelection = Object.freeze({
      goalSalt: config.salts.bodyGoal,
      mode: "single-goal-overlay"
    });
    const manifest = Object.freeze({
      contract: PLATFORM_VISUAL_KIT_CONTRACT,
      slots,
      kit,
      topOverlaySelection,
      bodyOverlaySelection
    });
    const assetDefinitions = Object.freeze([
      [config.familyA.topBase, PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA, "familyA"],
      [config.familyA.bodyBase, PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA, "familyA"],
      ...config.familyA.topOverlays.map(definition => (
        [definition, PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA, "familyA"]
      )),
      ...config.familyA.bodyOverlays.map(definition => (
        [definition, PLATFORM_VISUAL_KIT_NATIVE_SIZES.familyA, "familyA"]
      )),
      [config.familyB.left, PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingLeft, "familyB"],
      [config.familyB.middle, PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingMiddle, "familyB"],
      [config.familyB.right, PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingRight, "familyB"]
    ].map(([definition, size, family]) => Object.freeze({
      asset: definition.asset,
      path: definition.path,
      size,
      family
    })));
    const definitionByAsset = Object.freeze(Object.fromEntries(
      assetDefinitions.map(definition => [definition.asset, definition])
    ));
    const familyAAssetDefinitions = Object.freeze(
      assetDefinitions.filter(definition => definition.family === "familyA")
    );
    const familyBAssetDefinitions = Object.freeze(
      assetDefinitions.filter(definition => definition.family === "familyB")
    );
    const paths = Object.freeze(Object.fromEntries(
      assetDefinitions.map(definition => [definition.asset, definition.path])
    ));
    const images = {};
    const floatingAlphaProfiles = {};
    let floatingContentFit = null;

    function hasValidNativeSize(asset) {
      const definition = definitionByAsset[asset];
      const image = images[asset]?.image;
      return Boolean(
        definition &&
        image?.complete &&
        image.naturalWidth === definition.size.w &&
        image.naturalHeight === definition.size.h
      );
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
        const contentFitContract = PLATFORM_VISUAL_KIT_CONTRACT.floating.contentFit;
        for (let y = 0; y < slot.h; y++) {
          for (let x = 0; x < slot.w; x++) {
            if (pixels[(y * slot.w + x) * 4 + 3] <= contentFitContract.alphaThreshold) {
              continue;
            }
            rowCounts[y] += 1;
            robustTop = Math.min(robustTop, y);
            robustBottom = Math.max(robustBottom, y);
          }
        }
        if (robustBottom < robustTop) return null;
        const minimumCount = Math.ceil(
          slot.w * contentFitContract.bodyRowMinimumCoverage
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
      const profiles = ["left", "middle", "right"].map(name => (
        floatingAlphaProfiles[name]
      ));
      if (profiles.some(profile => !profile)) return;
      const bodyTop = Math.max(...profiles.map(profile => profile.bodyTop));
      const bodyBottom = Math.min(...profiles.map(profile => profile.bodyBottom));
      if (bodyBottom <= bodyTop) return;
      const robustTop = Math.min(...profiles.map(profile => profile.robustTop));
      const robustBottom = Math.max(...profiles.map(profile => profile.robustBottom));
      const contentFitContract = PLATFORM_VISUAL_KIT_CONTRACT.floating.contentFit;
      floatingContentFit = Object.freeze({
        analyzed: true,
        alphaThreshold: contentFitContract.alphaThreshold,
        bodyRowMinimumCoverage: contentFitContract.bodyRowMinimumCoverage,
        topOverhang: contentFitContract.topOverhang,
        bottomOverhang: contentFitContract.bottomOverhang,
        topDecorSource: Object.freeze({
          y: robustTop,
          h: Math.max(0, bodyTop - robustTop)
        }),
        bodySource: Object.freeze({y: bodyTop, h: bodyBottom - bodyTop}),
        bottomDecorSource: Object.freeze({
          y: bodyBottom,
          h: Math.max(0, robustBottom - bodyBottom)
        })
      });
    }

    function loadAsset(definition) {
      const image = new Image();
      const record = {image, ready: null};
      images[definition.asset] = record;
      record.ready = new Promise(resolve => {
        image.onload = () => {
          const valid = hasValidNativeSize(definition.asset);
          if (valid && definition.family === "familyB") {
            const familyBEntries = [
              [config.familyB.left.asset, "left", floatingLeftSlot],
              [config.familyB.middle.asset, "middle", floatingMiddleSlot],
              [config.familyB.right.asset, "right", floatingRightSlot]
            ];
            const entry = familyBEntries.find(([asset]) => asset === definition.asset);
            const profile = entry ? analyzeFloatingAlpha(image, entry[2]) : null;
            if (profile) {
              floatingAlphaProfiles[entry[1]] = profile;
              updateFloatingContentFit();
            }
          }
          resolve(valid);
        };
        image.onerror = () => resolve(false);
      });
      image.decoding = "async";
      image.src = definition.path;
    }

    for (const definition of assetDefinitions) loadAsset(definition);
    const readyPromise = Promise.all(
      assetDefinitions.map(definition => images[definition.asset].ready)
    ).then(results => results.every(Boolean));

    function hashVisualSeed(seed, salt) {
      let value = (((Number(seed) || 0) >>> 0) ^ salt) >>> 0;
      value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
      value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
      return (value ^ (value >>> 16)) >>> 0;
    }

    function getTopOverlaySelection(levelSeed) {
      const startIndex = hashVisualSeed(
        levelSeed,
        topOverlaySelection.startSalt
      ) % topOverlaySlots.length;
      let goalIndex = hashVisualSeed(
        levelSeed,
        topOverlaySelection.goalSalt
      ) % topOverlaySlots.length;
      if (goalIndex === startIndex) goalIndex = (goalIndex + 1) % topOverlaySlots.length;
      return Object.freeze({
        startIndex,
        goalIndex,
        startAsset: topOverlaySlots[startIndex].asset,
        goalAsset: topOverlaySlots[goalIndex].asset
      });
    }

    function getTopOverlaySlot(role, levelSeed) {
      const selection = getTopOverlaySelection(levelSeed);
      return topOverlaySlots[
        role === "START_PLATFORM" ? selection.startIndex : selection.goalIndex
      ];
    }

    function getBodyOverlaySelection(levelSeed) {
      const goalIndex = hashVisualSeed(
        levelSeed,
        bodyOverlaySelection.goalSalt
      ) % bodyOverlaySlots.length;
      return Object.freeze({
        goalIndex,
        goalAsset: bodyOverlaySlots[goalIndex].asset
      });
    }

    function resolvePlatformRole(platform) {
      if (!platform || platform.lastBubbleSupport) return null;
      if (
        platform.x === 0 &&
        platform.w === PLATFORM_VISUAL_KIT_CONTRACT.start.width &&
        platform.h === PLATFORM_VISUAL_KIT_CONTRACT.start.height
      ) return "START_PLATFORM";
      if (
        platform.x === 1060 &&
        platform.w === PLATFORM_VISUAL_KIT_CONTRACT.goal.width &&
        platform.h >= PLATFORM_VISUAL_KIT_CONTRACT.goal.topHeight
      ) return "GOAL_TOWER";
      if (platform.h === PLATFORM_VISUAL_KIT_CONTRACT.floating.height) return "FLOATING";
      return null;
    }

    function traceRoundedRect(context, x, y, width, height, radius) {
      const safeRadius = Math.min(radius, width / 2, height / 2);
      context.beginPath();
      context.moveTo(x + safeRadius, y);
      context.arcTo(x + width, y, x + width, y + height, safeRadius);
      context.arcTo(x + width, y + height, x, y + height, safeRadius);
      context.arcTo(x, y + height, x, y, safeRadius);
      context.arcTo(x, y, x + width, y, safeRadius);
      context.closePath();
    }

    function drawFamilyALayer(
      context,
      slot,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
      sourceHeight = familyASource.h
    ) {
      context.drawImage(
        images[slot.asset].image,
        familyASource.x,
        familyASource.y,
        familyASource.w,
        sourceHeight,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight
      );
    }

    function drawGoalPlatform(context, platform, drawX, topOverlaySlot, bodyOverlaySlot) {
      const contract = PLATFORM_VISUAL_KIT_CONTRACT.goal;
      const blockBottom = platform.y + platform.h;
      const bodyStartY = platform.y + contract.topHeight - contract.bodyOverlap;
      drawFamilyALayer(
        context,
        topBaseSlot,
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
        const sourceHeight = destinationHeight * familyASource.h /
          contract.bodyRowHeight;
        drawFamilyALayer(
          context,
          bodyBaseSlot,
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
      const topHeight = platform.w * (familyASource.h / familyASource.w);
      drawFamilyALayer(
        context,
        topBaseSlot,
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

    function drawFloatingContentFitSegment(
      context,
      image,
      sourceX,
      sourceWidth,
      destinationX,
      destinationWidth,
      platformY
    ) {
      const contract = PLATFORM_VISUAL_KIT_CONTRACT.floating;
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
      const contract = PLATFORM_VISUAL_KIT_CONTRACT.floating;
      const capWidth = Math.min(contract.leftWidth, platform.w / 2);
      if (platform.w > contract.leftWidth + contract.rightWidth) {
        const middleStartX = drawX + contract.leftWidth - PLATFORM_VISUAL_KIT_SEAM_OVERLAP;
        const middleEndX = drawX + platform.w - contract.rightWidth +
          PLATFORM_VISUAL_KIT_SEAM_OVERLAP;
        let destinationX = middleStartX;
        while (destinationX < middleEndX) {
          const remainingWidth = middleEndX - destinationX;
          const destinationWidth = Math.min(contract.middleTileWidth, remainingWidth);
          const sourceWidth = floatingMiddleSlot.source.w * (
            destinationWidth / contract.middleTileWidth
          );
          drawFloatingContentFitSegment(
            context,
            images[floatingMiddleSlot.asset].image,
            floatingMiddleSlot.source.x,
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
        images[floatingLeftSlot.asset].image,
        floatingLeftSlot.source.x,
        floatingLeftSlot.source.w,
        drawX,
        capWidth,
        platform.y
      );
      drawFloatingContentFitSegment(
        context,
        images[floatingRightSlot.asset].image,
        floatingRightSlot.source.x,
        floatingRightSlot.source.w,
        drawX + platform.w - capWidth,
        capWidth,
        platform.y
      );
    }

    function isFamilyAReady() {
      return familyAAssetDefinitions.every(definition => (
        hasValidNativeSize(definition.asset)
      ));
    }

    function isFamilyBReady() {
      return familyBAssetDefinitions.every(definition => (
        hasValidNativeSize(definition.asset)
      )) &&
        Boolean(floatingContentFit);
    }

    function drawPlatformBase(context, platform, drawX = platform.x, levelSeed = 0) {
      const role = resolvePlatformRole(platform);
      if (!role) return false;
      const topOverlaySlot = role === "START_PLATFORM" || role === "GOAL_TOWER"
        ? getTopOverlaySlot(role, levelSeed)
        : null;
      const bodyOverlaySlot = role === "GOAL_TOWER"
        ? bodyOverlaySlots[getBodyOverlaySelection(levelSeed).goalIndex]
        : null;
      if (role === "FLOATING") {
        if (!isFamilyBReady()) return false;
      } else if (role === "START_PLATFORM") {
        if (!hasValidNativeSize(topBaseSlot.asset) ||
            !hasValidNativeSize(topOverlaySlot.asset)) return false;
      } else if (
        !hasValidNativeSize(topBaseSlot.asset) ||
        !hasValidNativeSize(topOverlaySlot.asset) ||
        !hasValidNativeSize(bodyBaseSlot.asset) ||
        !hasValidNativeSize(bodyOverlaySlot.asset)
      ) return false;

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
      context.strokeStyle = config.outlineStyle ?? "rgba(46,72,28,0.62)";
      context.lineWidth = 1.5;
      traceRoundedRect(
        context,
        drawX + 0.75,
        platform.y + 0.75,
        platform.w - 1.5,
        platform.h - 1.5,
        9
      );
      context.stroke();
      context.restore();
      return true;
    }

    function drawGoalTopForeground(context, platform, levelSeed = 0) {
      if (resolvePlatformRole(platform) !== "GOAL_TOWER") return false;
      const topOverlaySlot = getTopOverlaySlot("GOAL_TOWER", levelSeed);
      if (!hasValidNativeSize(topBaseSlot.asset) ||
          !hasValidNativeSize(topOverlaySlot.asset)) return false;
      context.save();
      traceRoundedRect(context, platform.x, platform.y, platform.w, platform.h, 10);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      drawFamilyALayer(
        context,
        topBaseSlot,
        platform.x,
        platform.y,
        platform.w,
        PLATFORM_VISUAL_KIT_CONTRACT.goal.topHeight
      );
      drawFamilyALayer(
        context,
        topOverlaySlot,
        platform.x,
        platform.y,
        platform.w,
        PLATFORM_VISUAL_KIT_CONTRACT.goal.topHeight
      );
      context.restore();
      return true;
    }

    function getStatus() {
      const validNativeSizes = Object.freeze(Object.fromEntries(
        assetDefinitions.map(definition => [
          definition.asset,
          hasValidNativeSize(definition.asset)
        ])
      ));
      return Object.freeze({
        ready: assetDefinitions.every(definition => validNativeSizes[definition.asset]),
        familyAReady: isFamilyAReady(),
        familyBReady: isFamilyBReady(),
        paths,
        expectedNativeSizes: Object.freeze(Object.fromEntries(
          assetDefinitions.map(definition => [definition.asset, definition.size])
        )),
        validNativeSizes,
        floatingContentFit
      });
    }

    return Object.freeze({
      whenReady: () => readyPromise,
      areAllReady: () => assetDefinitions.every(definition => (
        hasValidNativeSize(definition.asset)
      )),
      isAssetReady: hasValidNativeSize,
      isFamilyAReady,
      isFamilyBReady,
      getStatus,
      getManifest: () => manifest,
      getTopOverlaySelection,
      getBodyOverlaySelection,
      resolvePlatformRole,
      drawPlatformBase,
      drawGoalTopForeground
    });
  }

  const BIOME_PLATFORM_VISUALS = (() => {
    const visualsByBiome = new Map();
    return Object.freeze({
      register(biomeId, visuals) {
        if (typeof biomeId !== "string" || !visuals) {
          throw new TypeError("Biome platform visual registration is invalid");
        }
        visualsByBiome.set(biomeId, visuals);
        return visuals;
      },
      resolve(biomeId) {
        return visualsByBiome.get(biomeId) ?? null;
      }
    });
  })();
