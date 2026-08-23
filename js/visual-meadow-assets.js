"use strict";

  const MEADOW_ASSET_VISUALS = (() => {
    const VISUAL_SEED_SALT = 0x4d454144;
    const ASSET_PATHS = Object.freeze({
      background: "assets/environments/meadow/background/meadow_background.png",
      decor: "assets/environments/meadow/decor/meadow_decor.png",
      platforms: "assets/environments/meadow/platforms/meadow_tileset.png",
      portal: "assets/environments/meadow/portal/meadow_portal_props.png"
    });
    const SOURCE_SIZES = Object.freeze({
      background: Object.freeze({w: 1672, h: 941}),
      decor: Object.freeze({w: 1448, h: 1086}),
      platforms: Object.freeze({w: 1448, h: 1086}),
      portal: Object.freeze({w: 1448, h: 1086})
    });
    const DECOR_SPRITES = Object.freeze({
      yellowBush: Object.freeze({x: 10, y: 10, w: 315, h: 170}),
      whiteBush: Object.freeze({x: 360, y: 10, w: 275, h: 170}),
      rockBush: Object.freeze({x: 670, y: 5, w: 275, h: 180}),
      roundBush: Object.freeze({x: 990, y: 45, w: 155, h: 145}),
      broadGrass: Object.freeze({x: 1165, y: 50, w: 155, h: 135}),
      smallGrass: Object.freeze({x: 1335, y: 75, w: 100, h: 115}),
      tree: Object.freeze({x: 515, y: 590, w: 265, h: 295}),
      distantGrove: Object.freeze({x: 1190, y: 885, w: 250, h: 195}),
      rockGrass: Object.freeze({x: 755, y: 470, w: 150, h: 125}),
      mossRock: Object.freeze({x: 1060, y: 465, w: 185, h: 135})
    });
    const PLATFORM_VISUAL_CONTRACT = Object.freeze({
      floating: Object.freeze({
        height: 26,
        leftWidth: 23,
        rightWidth: 22,
        middleMode: "horizontal-scale-or-crop"
      }),
      start: Object.freeze({width: 235, height: 80}),
      goal: Object.freeze({
        width: 220,
        topHeight: 80,
        bodyHeight: 48,
        bodyOverlap: 1,
        lastBodyMode: "crop"
      })
    });
    // Source mappings stay isolated from the renderer. Future biome manifests
    // can provide the same logical slots with different artwork.
    const PLATFORM_SLOTS = Object.freeze({
      // Runtime crops begin at the measured walkable grass line. Decorative
      // alpha above that line must not offset terrain from its collision top.
      FLOAT_LEFT: Object.freeze({x: 142, y: 49, w: 112, h: 127}),
      FLOAT_MIDDLE: Object.freeze({x: 520, y: 49, w: 300, h: 127}),
      FLOAT_RIGHT: Object.freeze({x: 1071, y: 49, w: 108, h: 127}),
      START_PLATFORM: Object.freeze({x: 680, y: 220, w: 471, h: 119}),
      GOAL_TOP: Object.freeze({x: 1170, y: 672, w: 214, h: 203}),
      // Inner crops exclude weak alpha fringes and rounded outer tile edges.
      GOAL_BODY_A: Object.freeze({x: 320, y: 370, w: 239, h: 230}),
      GOAL_BODY_B: Object.freeze({x: 599, y: 370, w: 238, h: 230}),
      GOAL_BODY_C: Object.freeze({x: 876, y: 370, w: 240, h: 230}),
      GOAL_BODY_D: Object.freeze({x: 317, y: 627, w: 242, h: 229}),
      GOAL_BODY_E: Object.freeze({x: 600, y: 627, w: 239, h: 229}),
      GOAL_BODY_F: Object.freeze({x: 877, y: 626, w: 240, h: 231})
    });
    const GOAL_BODY_SLOT_NAMES = Object.freeze([
      "GOAL_BODY_A",
      "GOAL_BODY_B",
      "GOAL_BODY_C",
      "GOAL_BODY_D",
      "GOAL_BODY_E",
      "GOAL_BODY_F"
    ]);
    const MEADOW_ASSET_MANIFEST = Object.freeze({
      biome: "meadow",
      paths: ASSET_PATHS,
      sourceSizes: SOURCE_SIZES,
      platforms: Object.freeze({
        contract: PLATFORM_VISUAL_CONTRACT,
        slots: PLATFORM_SLOTS
      })
    });
    const PORTAL_SPRITE = Object.freeze({x: 24, y: 50, w: 712, h: 755});
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
      Object.values(assets).map(asset => asset.ready)
    ).then(results => results.every(Boolean));

    function isReady(name) {
      const image = assets[name]?.image;
      return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    }

    function areAllReady() {
      return Object.keys(ASSET_PATHS).every(isReady);
    }

    function whenReady() {
      return readyPromise;
    }

    function createVisualRandom(seed) {
      let state = seed >>> 0;
      return function random() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function freezeItems(items) {
      return Object.freeze(items.map(item => Object.freeze(item)));
    }

    function createScene(level) {
      const random = createVisualRandom(((Number(level?.seed) || 0) ^ VISUAL_SEED_SALT) >>> 0);
      const jitter = amount => (random() - 0.5) * amount;
      return Object.freeze({
        backDecor: freezeItems([
          {sprite: "distantGrove", x: -18 + jitter(18), y: 535 + jitter(12), w: 178, h: 139, alpha: 0.30},
          {sprite: "tree", x: 270 + jitter(28), y: 485 + jitter(16), w: 138, h: 154, alpha: 0.38, flip: random() > 0.5},
          {sprite: "whiteBush", x: 505 + jitter(30), y: 585 + jitter(12), w: 112, h: 69, alpha: 0.42},
          {sprite: "tree", x: 815 + jitter(32), y: 495 + jitter(14), w: 128, h: 143, alpha: 0.34, flip: random() > 0.5},
          {sprite: "distantGrove", x: 1080 + jitter(22), y: 542 + jitter(10), w: 172, h: 134, alpha: 0.28, flip: true}
        ]),
        foregroundDecor: freezeItems([
          {sprite: "smallGrass", x: 3, y: 672, w: 47, h: 43, alpha: 0.88},
          {sprite: "rockGrass", x: 186, y: 681, w: 43, h: 35, alpha: 0.86},
          {sprite: "mossRock", x: 1218, y: 674, w: 58, h: 42, alpha: 0.88}
        ])
      });
    }

    function getScene(level) {
      if (!level || (typeof level !== "object" && typeof level !== "function")) {
        return createScene(null);
      }
      let scene = sceneCache.get(level);
      if (!scene) {
        scene = createScene(level);
        sceneCache.set(level, scene);
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

    function drawSprite(context, image, source, item) {
      context.save();
      context.globalAlpha = item.alpha ?? 1;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (item.flip) {
        context.translate(item.x + item.w, item.y);
        context.scale(-1, 1);
        context.drawImage(
          image,
          source.x, source.y, source.w, source.h,
          0, 0, item.w, item.h
        );
      } else {
        context.drawImage(
          image,
          source.x, source.y, source.w, source.h,
          item.x, item.y, item.w, item.h
        );
      }
      context.restore();
    }

    function drawBackground(context, width, height) {
      if (!isReady("background")) return false;
      const source = SOURCE_SIZES.background;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        assets.background.image,
        0, 0, source.w, source.h,
        0, 0, width, height
      );
      context.restore();
      return true;
    }

    function mixVisualSeed(value) {
      let mixed = value >>> 0;
      mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
      mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
      return (mixed ^ (mixed >>> 16)) >>> 0;
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

    function getGoalBodySprite(platform, levelSeed, rowIndex, previousIndex) {
      const geometrySalt = (
        Math.imul(Math.round(platform.y * 1000), 0x1f123bb5) ^
        Math.imul(Math.round(platform.h * 1000), 0x5f356495)
      ) >>> 0;
      const mixed = mixVisualSeed(
        ((Number(levelSeed) || 0) >>> 0) ^
        VISUAL_SEED_SALT ^
        geometrySalt ^
        Math.imul(rowIndex + 1, 0x6d2b79f5)
      );
      let index = mixed % GOAL_BODY_SLOT_NAMES.length;
      if (index === previousIndex) {
        index = (index + 1 + ((mixed >>> 8) % (GOAL_BODY_SLOT_NAMES.length - 1))) %
          GOAL_BODY_SLOT_NAMES.length;
      }
      const slotName = GOAL_BODY_SLOT_NAMES[index];
      return {index, slotName, sprite: PLATFORM_SLOTS[slotName]};
    }

    function drawGoalPlatform(context, image, platform, drawX, levelSeed) {
      const contract = PLATFORM_VISUAL_CONTRACT.goal;
      const topCapHeight = Math.min(contract.topHeight, platform.h);
      const blockBottom = platform.y + platform.h;

      if (platform.h > topCapHeight) {
        let destinationY = platform.y + topCapHeight - contract.bodyOverlap;
        let rowIndex = 0;
        let previousIndex = -1;
        while (destinationY < blockBottom) {
          const selection = getGoalBodySprite(
            platform,
            levelSeed,
            rowIndex,
            previousIndex
          );
          const destinationHeight = Math.min(
            contract.bodyHeight,
            blockBottom - destinationY
          );
          const sourceHeight = selection.sprite.h *
            (destinationHeight / contract.bodyHeight);
          context.drawImage(
            image,
            selection.sprite.x,
            selection.sprite.y,
            selection.sprite.w,
            sourceHeight,
            drawX,
            destinationY,
            platform.w,
            destinationHeight
          );
          previousIndex = selection.index;
          rowIndex += 1;
          destinationY += contract.bodyHeight - contract.bodyOverlap;
        }
      }

      // Draw last so its lower edge covers the one-pixel body overlap at the seam.
      const topSlot = PLATFORM_SLOTS.GOAL_TOP;
      context.drawImage(
        image,
        topSlot.x,
        topSlot.y,
        topSlot.w,
        topSlot.h,
        drawX,
        platform.y,
        platform.w,
        topCapHeight
      );
    }

    function drawBackDecor(context, scene) {
      if (!isReady("decor")) return false;
      const image = assets.decor.image;
      for (const item of scene.backDecor) {
        drawSprite(context, image, DECOR_SPRITES[item.sprite], item);
      }
      return true;
    }

    function drawFloatingPlatform(context, image, platform, drawX) {
      const contract = PLATFORM_VISUAL_CONTRACT.floating;
      const leftWidth = Math.min(contract.leftWidth, platform.w / 2);
      const rightWidth = Math.min(
        contract.rightWidth,
        platform.w - leftWidth
      );
      const middleWidth = platform.w - leftWidth - rightWidth;
      const left = PLATFORM_SLOTS.FLOAT_LEFT;
      const middle = PLATFORM_SLOTS.FLOAT_MIDDLE;
      const right = PLATFORM_SLOTS.FLOAT_RIGHT;

      context.drawImage(
        image,
        left.x, left.y, left.w, left.h,
        drawX, platform.y, leftWidth, contract.height
      );
      context.drawImage(
        image,
        middle.x, middle.y, middle.w, middle.h,
        drawX + leftWidth, platform.y, middleWidth, contract.height
      );
      context.drawImage(
        image,
        right.x, right.y, right.w, right.h,
        drawX + platform.w - rightWidth,
        platform.y,
        rightWidth,
        contract.height
      );
    }

    function drawPlatformBase(context, platform, drawX = platform.x, levelSeed = 0) {
      if (!isReady("platforms")) return false;
      const role = resolvePlatformRole(platform);
      if (!role) return false;
      const image = assets.platforms.image;

      context.save();
      traceRoundedRect(context, drawX, platform.y, platform.w, platform.h, 10);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (role === "GOAL_TOWER") {
        drawGoalPlatform(context, image, platform, drawX, levelSeed);
      } else if (role === "FLOATING") {
        drawFloatingPlatform(context, image, platform, drawX);
      } else {
        const sprite = PLATFORM_SLOTS.START_PLATFORM;
        context.drawImage(
          image,
          sprite.x, sprite.y, sprite.w, sprite.h,
          drawX, platform.y, platform.w, platform.h
        );
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

    function drawPortal(context, goal) {
      if (!isReady("portal")) return false;
      const width = 180;
      const height = 191;
      const x = goal.x + goal.w / 2 - width / 2;
      const y = goal.y + goal.h + 15 - height;

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
      return true;
    }

    function drawForegroundDecor(context, scene) {
      if (!isReady("decor")) return false;
      const image = assets.decor.image;
      for (const item of scene.foregroundDecor) {
        drawSprite(context, image, DECOR_SPRITES[item.sprite], item);
      }
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
      getScene,
      resolvePlatformRole,
      drawBackground,
      drawBackDecor,
      drawPlatformBase,
      drawPortal,
      drawForegroundDecor
    });
  })();
