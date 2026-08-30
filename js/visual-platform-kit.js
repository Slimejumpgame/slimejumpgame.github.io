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
      wholeMode: "uniform-whole-image",
      wholeContentFit: Object.freeze({
        alphaThreshold: 8,
        supportRowMinimumCoverage: 0.9,
        mode: "robust-alpha-bounds-and-longest-contiguous-support-band"
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
    floatingWhole: Object.freeze({w: 512, h: 128})
  });

  function findLongestWholePlatformRowRun(rowCounts, minimumCount) {
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

  function analyzeWholePlatformImage(image, sourceSize) {
    if (
      typeof document === "undefined" ||
      !document.createElement ||
      !image ||
      !sourceSize?.w ||
      !sourceSize?.h
    ) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = sourceSize.w;
      surface.height = sourceSize.h;
      const context = surface.getContext("2d", {willReadFrequently: true});
      if (!context) return null;
      context.clearRect(0, 0, sourceSize.w, sourceSize.h);
      context.drawImage(image, 0, 0, sourceSize.w, sourceSize.h);
      const pixels = context.getImageData(0, 0, sourceSize.w, sourceSize.h).data;
      if (!pixels || pixels.length < sourceSize.w * sourceSize.h * 4) return null;
      const rowLongestRuns = Array(sourceSize.h).fill(0);
      let robustLeft = sourceSize.w;
      let robustTop = sourceSize.h;
      let robustRight = -1;
      let robustBottom = -1;
      const contentFitContract =
        PLATFORM_VISUAL_KIT_CONTRACT.floating.wholeContentFit;
      for (let y = 0; y < sourceSize.h; y++) {
        let currentRun = 0;
        for (let x = 0; x < sourceSize.w; x++) {
          if (
            pixels[(y * sourceSize.w + x) * 4 + 3] <=
              contentFitContract.alphaThreshold
          ) {
            currentRun = 0;
            continue;
          }
          currentRun += 1;
          rowLongestRuns[y] = Math.max(rowLongestRuns[y], currentRun);
          robustLeft = Math.min(robustLeft, x);
          robustTop = Math.min(robustTop, y);
          robustRight = Math.max(robustRight, x);
          robustBottom = Math.max(robustBottom, y);
        }
      }
      if (robustRight < robustLeft || robustBottom < robustTop) return null;
      const visibleContentBounds = Object.freeze({
        x: robustLeft,
        y: robustTop,
        w: robustRight - robustLeft + 1,
        h: robustBottom - robustTop + 1
      });
      const minimumSupportRun = Math.ceil(
        visibleContentBounds.w * contentFitContract.supportRowMinimumCoverage
      );
      const supportBand = findLongestWholePlatformRowRun(
        rowLongestRuns,
        minimumSupportRun
      );
      if (!supportBand) return null;
      return Object.freeze({
        analyzed: true,
        alphaThreshold: contentFitContract.alphaThreshold,
        supportRowMinimumCoverage: contentFitContract.supportRowMinimumCoverage,
        visibleContentBounds,
        supportY: supportBand.start,
        supportBand: Object.freeze({
          y: supportBand.start,
          h: supportBand.end - supportBand.start
        })
      });
    } catch {
      return null;
    }
  }

  function getWholePlatformImageMapping(
    contentFit,
    sourceSize,
    platform,
    drawX = platform?.x,
    flipX = false
  ) {
    if (
      !contentFit ||
      !sourceSize?.w ||
      !sourceSize?.h ||
      !platform ||
      !Number.isFinite(drawX) ||
      !Number.isFinite(platform.y) ||
      !Number.isFinite(platform.w) ||
      platform.w <= 0
    ) return null;
    const bounds = contentFit.visibleContentBounds;
    const scale = platform.w / bounds.w;
    const visibleSourceX = flipX
      ? sourceSize.w - bounds.x - bounds.w
      : bounds.x;
    return Object.freeze({
      scale,
      drawX: drawX - visibleSourceX * scale,
      drawY: platform.y - contentFit.supportY * scale,
      drawWidth: sourceSize.w * scale,
      drawHeight: sourceSize.h * scale,
      visibleLeft: drawX,
      visibleRight: drawX + platform.w,
      supportY: platform.y,
      flipX: Boolean(flipX)
    });
  }

  function drawWholePlatformImage(
    context,
    image,
    contentFit,
    sourceSize,
    platform,
    drawX = platform?.x,
    flipX = false
  ) {
    const mapping = getWholePlatformImageMapping(
      contentFit,
      sourceSize,
      platform,
      drawX,
      flipX
    );
    if (!mapping) return false;
    if (mapping.flipX) {
      context.save();
      context.translate(mapping.drawX * 2 + mapping.drawWidth, 0);
      context.scale(-1, 1);
    }
    context.drawImage(
      image,
      0,
      0,
      sourceSize.w,
      sourceSize.h,
      mapping.drawX,
      mapping.drawY,
      mapping.drawWidth,
      mapping.drawHeight
    );
    if (mapping.flipX) context.restore();
    return true;
  }

  function hashPlatformVisualNamespace(value) {
    let hash = 0x811c9dc5;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function createStandardPlatformVisualConfig(biomeId) {
    if (typeof biomeId !== "string" || !biomeId.trim()) {
      throw new TypeError("Standard platform visual config requires a biome id");
    }
    const biome = biomeId.trim();
    const directory = `assets/environments/${biome}/platforms`;
    const defineAsset = asset => Object.freeze({
      asset,
      path: `${directory}/${asset}.png`
    });
    const topOverlays = Object.freeze(Array.from({length: 6}, (_, index) => (
      defineAsset(`${biome}_overlay_top_${String(index + 1).padStart(2, "0")}`)
    )));
    const bodyOverlays = Object.freeze(Array.from({length: 3}, (_, index) => (
      defineAsset(`${biome}_overlay_body_${String(index + 1).padStart(2, "0")}`)
    )));
    return Object.freeze({
      biome,
      familyA: Object.freeze({
        topBase: defineAsset(`${biome}_top_base`),
        bodyBase: defineAsset(`${biome}_body_base`),
        topOverlays,
        bodyOverlays
      }),
      familyB: Object.freeze({
        whole: defineAsset(`${biome}_floating_platform`)
      }),
      salts: Object.freeze({
        topStart: hashPlatformVisualNamespace(`${biome}:platform:top:start`),
        topGoal: hashPlatformVisualNamespace(`${biome}:platform:top:goal`),
        bodyGoal: hashPlatformVisualNamespace(`${biome}:platform:body:goal`)
      })
    });
  }

  function createPlatformVisualKit(config) {
    if (!config || typeof config.biome !== "string" || !config.biome.trim()) {
      throw new TypeError("Platform visual kit requires a biome id");
    }
    if (config.familyA?.topOverlays?.length !== 6) {
      throw new RangeError("Platform visual kit requires exactly 6 top overlays");
    }
    if (config.familyA?.bodyOverlays?.length !== 3) {
      throw new RangeError("Platform visual kit requires exactly 3 body overlays");
    }

    const biome = config.biome.trim();
    const familyASource = PLATFORM_VISUAL_KIT_FAMILY_A_SOURCE;
    const wholeFloatingDefinition = config.familyB.whole ?? Object.freeze({
      asset: `${biome}_floating_platform`,
      path: `assets/environments/${biome}/platforms/${biome}_floating_platform.png`
    });
    const slotNames = Object.freeze({
      topBase: config.slotNames?.topBase ?? "top_base",
      bodyBase: config.slotNames?.bodyBase ?? "body_base",
      topOverlays: config.slotNames?.topOverlays ?? "top_overlays",
      bodyOverlays: config.slotNames?.bodyOverlays ?? "body_overlays",
      floatingWhole: config.slotNames?.floatingWhole ?? "floating_platform"
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
    const floatingWholeSlot = createSlot(
      wholeFloatingDefinition,
      PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingWhole,
      true
    );
    const slots = Object.freeze({
      [slotNames.floatingWhole]: floatingWholeSlot,
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
        whole: floatingWholeSlot
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
      [wholeFloatingDefinition, PLATFORM_VISUAL_KIT_NATIVE_SIZES.floatingWhole,
        "familyBWhole"]
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
    const paths = Object.freeze(Object.fromEntries(
      assetDefinitions.map(definition => [definition.asset, definition.path])
    ));
    const images = {};
    let wholeFloatingContentFit = null;

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

    function loadAsset(definition) {
      const image = new Image();
      const record = {image, ready: null};
      images[definition.asset] = record;
      record.ready = new Promise(resolve => {
        image.onload = () => {
          const valid = hasValidNativeSize(definition.asset);
          if (valid && definition.family === "familyBWhole") {
            wholeFloatingContentFit = analyzeWholePlatformImage(
              image,
              floatingWholeSlot
            );
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

    function getAvailableOverlayEntries(overlaySlots) {
      return overlaySlots.map((slot, index) => Object.freeze({slot, index})).filter(
        entry => hasValidNativeSize(entry.slot.asset)
      );
    }

    function getTopOverlaySelection(levelSeed) {
      const available = getAvailableOverlayEntries(topOverlaySlots);
      if (available.length === 0) {
        return Object.freeze({
          startIndex: null,
          goalIndex: null,
          startAsset: null,
          goalAsset: null
        });
      }
      const startAvailableIndex = hashVisualSeed(
        levelSeed,
        topOverlaySelection.startSalt
      ) % available.length;
      let goalAvailableIndex = hashVisualSeed(
        levelSeed,
        topOverlaySelection.goalSalt
      ) % available.length;
      if (available.length > 1 && goalAvailableIndex === startAvailableIndex) {
        goalAvailableIndex = (goalAvailableIndex + 1) % available.length;
      }
      const start = available[startAvailableIndex];
      const goal = available[goalAvailableIndex];
      return Object.freeze({
        startIndex: start.index,
        goalIndex: goal.index,
        startAsset: start.slot.asset,
        goalAsset: goal.slot.asset
      });
    }

    function getTopOverlaySlot(role, levelSeed) {
      const selection = getTopOverlaySelection(levelSeed);
      const index = role === "START_PLATFORM"
        ? selection.startIndex
        : selection.goalIndex;
      return index === null ? null : topOverlaySlots[index];
    }

    function getBodyOverlaySelection(levelSeed) {
      const available = getAvailableOverlayEntries(bodyOverlaySlots);
      if (available.length === 0) {
        return Object.freeze({goalIndex: null, goalAsset: null});
      }
      const availableIndex = hashVisualSeed(
        levelSeed,
        bodyOverlaySelection.goalSalt
      ) % available.length;
      const goal = available[availableIndex];
      return Object.freeze({
        goalIndex: goal.index,
        goalAsset: goal.slot.asset
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

    function acceptsWholeFloatingBase(platform) {
      return !platform?.fragile && !platform?.conveyor && !platform?.ice;
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

    function drawReadyFamilyALayer(
      context,
      slot,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
      sourceHeight = familyASource.h
    ) {
      if (!slot || !hasValidNativeSize(slot.asset)) return false;
      drawFamilyALayer(
        context,
        slot,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight,
        sourceHeight
      );
      return true;
    }

    function drawGoalPlatform(
      context,
      platform,
      drawX,
      topOverlaySlot,
      bodyOverlaySlot,
      drawVectorFallbackRegion
    ) {
      const contract = PLATFORM_VISUAL_KIT_CONTRACT.goal;
      const blockBottom = platform.y + platform.h;
      const bodyStartY = platform.y + contract.topHeight - contract.bodyOverlap;
      if (!drawReadyFamilyALayer(
        context,
        topBaseSlot,
        drawX,
        platform.y,
        platform.w,
        contract.topHeight
      )) {
        drawVectorFallbackRegion(Object.freeze({
          x: drawX,
          y: platform.y,
          w: platform.w,
          h: contract.topHeight
        }));
      }
      drawReadyFamilyALayer(
        context,
        topOverlaySlot,
        drawX,
        platform.y,
        platform.w,
        contract.topHeight
      );

      if (hasValidNativeSize(bodyBaseSlot.asset)) {
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
      } else {
        drawVectorFallbackRegion(Object.freeze({
          x: drawX,
          y: bodyStartY,
          w: platform.w,
          h: Math.max(0, blockBottom - bodyStartY)
        }));
      }

      if (bodyOverlaySlot) {
        context.save();
        context.beginPath();
        context.rect(
          drawX,
          bodyStartY,
          platform.w,
          Math.max(0, blockBottom - bodyStartY)
        );
        context.clip();
        drawReadyFamilyALayer(
          context,
          bodyOverlaySlot,
          drawX,
          blockBottom - contract.bodyRowHeight,
          platform.w,
          contract.bodyRowHeight
        );
        context.restore();
      }
    }

    function drawStartPlatform(
      context,
      platform,
      drawX,
      topOverlaySlot,
      drawVectorFallbackRegion
    ) {
      const topHeight = platform.w * (familyASource.h / familyASource.w);
      if (!drawReadyFamilyALayer(
        context,
        topBaseSlot,
        drawX,
        platform.y,
        platform.w,
        topHeight
      )) {
        drawVectorFallbackRegion(Object.freeze({
          x: drawX,
          y: platform.y,
          w: platform.w,
          h: topHeight
        }));
      }
      drawReadyFamilyALayer(
        context,
        topOverlaySlot,
        drawX,
        platform.y,
        platform.w,
        topHeight
      );
    }

    function getWholeFloatingMapping(platform, drawX = platform?.x) {
      return getWholePlatformImageMapping(
        wholeFloatingContentFit,
        floatingWholeSlot,
        platform,
        drawX
      );
    }

    function drawWholeFloatingPlatform(context, platform, drawX) {
      return drawWholePlatformImage(
        context,
        images[floatingWholeSlot.asset].image,
        wholeFloatingContentFit,
        floatingWholeSlot,
        platform,
        drawX
      );
    }

    function isFamilyAReady() {
      return familyAAssetDefinitions.every(definition => (
        hasValidNativeSize(definition.asset)
      ));
    }

    function isWholeFamilyBReady() {
      return hasValidNativeSize(floatingWholeSlot.asset) &&
        Boolean(wholeFloatingContentFit);
    }

    function isFamilyBReady() {
      return isWholeFamilyBReady();
    }

    function drawPlatformBase(
      context,
      platform,
      drawX = platform.x,
      levelSeed = 0,
      drawVectorFallbackRegion = null
    ) {
      const role = resolvePlatformRole(platform);
      if (!role) return false;
      const topOverlaySlot = role === "START_PLATFORM" || role === "GOAL_TOWER"
        ? getTopOverlaySlot(role, levelSeed)
        : null;
      const bodyOverlayIndex = role === "GOAL_TOWER"
        ? getBodyOverlaySelection(levelSeed).goalIndex
        : null;
      const bodyOverlaySlot = bodyOverlayIndex === null
        ? null
        : bodyOverlaySlots[bodyOverlayIndex];
      if (role === "FLOATING") {
        if (!acceptsWholeFloatingBase(platform) || !isWholeFamilyBReady()) {
          return false;
        }
      } else {
        const topBaseReady = hasValidNativeSize(topBaseSlot.asset);
        const bodyBaseReady = hasValidNativeSize(bodyBaseSlot.asset);
        const hasAnyPngLayer = Boolean(
          topBaseReady ||
          topOverlaySlot ||
          (role === "GOAL_TOWER" && (bodyBaseReady || bodyOverlaySlot))
        );
        if (!hasAnyPngLayer) return false;
        const requiresVectorFallback = !topBaseReady || (
          role === "GOAL_TOWER" && !bodyBaseReady
        );
        if (requiresVectorFallback && typeof drawVectorFallbackRegion !== "function") {
          return false;
        }
      }

      context.save();
      if (role !== "FLOATING") {
        traceRoundedRect(context, drawX, platform.y, platform.w, platform.h, 10);
        context.clip();
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (role === "GOAL_TOWER") {
        drawGoalPlatform(
          context,
          platform,
          drawX,
          topOverlaySlot,
          bodyOverlaySlot,
          drawVectorFallbackRegion
        );
      } else if (role === "FLOATING") {
        drawWholeFloatingPlatform(context, platform, drawX);
      } else {
        drawStartPlatform(
          context,
          platform,
          drawX,
          topOverlaySlot,
          drawVectorFallbackRegion
        );
      }
      context.restore();

      if (
        role === "FLOATING" ||
        role === "GOAL_TOWER" ||
        role === "START_PLATFORM"
      ) return true;
      const outlineHeight = platform.h;
      context.save();
      context.strokeStyle = config.outlineStyle ?? "rgba(46,72,28,0.62)";
      context.lineWidth = 1.5;
      traceRoundedRect(
        context,
        drawX + 0.75,
        platform.y + 0.75,
        platform.w - 1.5,
        outlineHeight - 1.5,
        9
      );
      context.stroke();
      context.restore();
      return true;
    }

    function drawGoalTopForeground(
      context,
      platform,
      levelSeed = 0,
      drawVectorFallbackRegion = null
    ) {
      if (resolvePlatformRole(platform) !== "GOAL_TOWER") return false;
      const topOverlaySlot = getTopOverlaySlot("GOAL_TOWER", levelSeed);
      const topBaseReady = hasValidNativeSize(topBaseSlot.asset);
      if (!topBaseReady && !topOverlaySlot) return false;
      if (!topBaseReady && typeof drawVectorFallbackRegion !== "function") return false;
      context.save();
      traceRoundedRect(context, platform.x, platform.y, platform.w, platform.h, 10);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (!drawReadyFamilyALayer(
        context,
        topBaseSlot,
        platform.x,
        platform.y,
        platform.w,
        PLATFORM_VISUAL_KIT_CONTRACT.goal.topHeight
      )) {
        drawVectorFallbackRegion(Object.freeze({
          x: platform.x,
          y: platform.y,
          w: platform.w,
          h: PLATFORM_VISUAL_KIT_CONTRACT.goal.topHeight
        }));
      }
      drawReadyFamilyALayer(
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
      const availableTopOverlays = Object.freeze(
        getAvailableOverlayEntries(topOverlaySlots).map(entry => entry.slot.asset)
      );
      const availableBodyOverlays = Object.freeze(
        getAvailableOverlayEntries(bodyOverlaySlots).map(entry => entry.slot.asset)
      );
      return Object.freeze({
        biome,
        ready: assetDefinitions.every(definition => validNativeSizes[definition.asset]),
        familyAReady: isFamilyAReady(),
        familyBReady: isFamilyBReady(),
        wholeFamilyBReady: isWholeFamilyBReady(),
        topBaseReady: hasValidNativeSize(topBaseSlot.asset),
        bodyBaseReady: hasValidNativeSize(bodyBaseSlot.asset),
        availableTopOverlays,
        availableBodyOverlays,
        paths,
        expectedNativeSizes: Object.freeze(Object.fromEntries(
          assetDefinitions.map(definition => [definition.asset, definition.size])
        )),
        validNativeSizes,
        wholeFloatingContentFit
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
      isWholeFamilyBReady,
      getStatus,
      getManifest: () => manifest,
      getTopOverlaySelection,
      getBodyOverlaySelection,
      getWholeFloatingMapping,
      resolvePlatformRole,
      drawPlatformBase,
      drawGoalTopForeground
    });
  }

  const BIOME_PLATFORM_VISUALS = (() => {
    const visualsByBiome = new Map();
    return Object.freeze({
      register(biomeId, visuals) {
        if (typeof biomeId !== "string" || !biomeId.trim() || !visuals) {
          throw new TypeError("Biome platform visual registration is invalid");
        }
        visualsByBiome.set(biomeId.trim(), visuals);
        return visuals;
      },
      resolve(biomeId) {
        if (typeof biomeId !== "string" || !biomeId.trim()) return null;
        const normalizedBiomeId = biomeId.trim();
        let visuals = visualsByBiome.get(normalizedBiomeId);
        if (!visuals) {
          visuals = createPlatformVisualKit(
            createStandardPlatformVisualConfig(normalizedBiomeId)
          );
          visualsByBiome.set(normalizedBiomeId, visuals);
        }
        return visuals;
      }
    });
  })();
