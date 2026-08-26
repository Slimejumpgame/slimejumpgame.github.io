"use strict";

const BIOME_DECOR_ROLES = Object.freeze([
  "groundcover",
  "small_flora",
  "small_props",
  "bushes",
  "stones",
  "tufts",
  "hero"
]);

const BIOME_DECOR_GRID_CONTRACT = Object.freeze({
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

const BIOME_DECOR_ROLE_CONTRACTS = Object.freeze({
  groundcover: Object.freeze({
    widths: Object.freeze({COMPACT: 34, WIDE: 62, LARGE: 78}),
    slotRoles: Object.freeze(["COMPACT", "WIDE", "LARGE", "WIDE", "LARGE", "LARGE"])
  }),
  small_flora: Object.freeze({
    widths: Object.freeze({COMPACT: 34, STANDARD: 52}),
    slotRoles: Object.freeze(Array(6).fill("STANDARD"))
  }),
  small_props: Object.freeze({
    widths: Object.freeze({COMPACT: 30, STANDARD: 40}),
    slotRoles: Object.freeze(Array(6).fill("STANDARD"))
  }),
  bushes: Object.freeze({
    widths: Object.freeze({COMPACT: 34, LARGE: 66}),
    slotRoles: Object.freeze(Array(6).fill("LARGE"))
  }),
  stones: Object.freeze({
    widths: Object.freeze({COMPACT: 32, WIDE: 60}),
    slotRoles: Object.freeze(["COMPACT", "WIDE", "WIDE", "WIDE", "WIDE", "WIDE"])
  }),
  tufts: Object.freeze({
    widths: Object.freeze({COMPACT: 32, STANDARD: 40}),
    slotRoles: Object.freeze(Array(6).fill("STANDARD"))
  }),
  hero: Object.freeze({
    widths: Object.freeze({HERO: 132}),
    slotRoles: Object.freeze(Array(6).fill("HERO"))
  })
});

const BIOME_DECOR_PLACEMENT_CONTRACT = Object.freeze({
  floatingBaseline: 2,
  startGoalBackBaseline: Object.freeze({minimum: 1, maximum: 2}),
  startGoalFrontBaseline: Object.freeze({minimum: 9, maximum: 11}),
  goalSeamBaseline: 11,
  goalSeamEdgeInset: 3,
  goalSeamMinimumGap: 1
});

function hashBiomeVisualNamespace(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function createBiomeDecorVisualKit(config) {
  if (!config || typeof config.biome !== "string" || !config.biome.trim()) {
    throw new TypeError("Biome decor kit requires a biome id");
  }

  const biome = config.biome.trim();
  const contract = BIOME_DECOR_GRID_CONTRACT;
  const configuredRoleResolver = config.resolvePlatformRole;
  const salts = Object.freeze({
    start: config.salts?.start ?? hashBiomeVisualNamespace(`${biome}:decor:start`),
    goal: config.salts?.goal ?? hashBiomeVisualNamespace(`${biome}:decor:goal`),
    goalSeam: config.salts?.goalSeam ?? hashBiomeVisualNamespace(`${biome}:decor:goal-seam`)
  });

  function createSpriteNames(prefix) {
    return Object.freeze(Array.from(
      {length: 6},
      (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`
    ));
  }

  const roles = Object.freeze(Object.fromEntries(BIOME_DECOR_ROLES.map(role => {
    const roleConfig = config.roles?.[role] ?? {};
    const roleContract = BIOME_DECOR_ROLE_CONTRACTS[role];
    const spritePrefix = roleConfig.spritePrefix ?? `${role}_`;
    return [role, Object.freeze({
      role,
      asset: roleConfig.asset ?? `${biome}_decor_${role}`,
      path: roleConfig.path ?? (
        `assets/environments/${biome}/decor/${biome}_decor_${role}_set_01.png`
      ),
      category: roleConfig.category ?? role,
      spritePrefix,
      sprites: createSpriteNames(spritePrefix),
      widths: roleContract.widths,
      slotRoles: roleContract.slotRoles
    })];
  })));

  function getRoleWidth(role, sizeRole) {
    return roles[role].widths[sizeRole];
  }

  function createGridSprite(role, slotIndex) {
    const roleDefinition = roles[role];
    const sizeRole = roleDefinition.slotRoles[slotIndex];
    return Object.freeze({
      asset: roleDefinition.asset,
      role,
      category: roleDefinition.category,
      source: Object.freeze({
        x: slotIndex % contract.columns * contract.slot.w,
        y: Math.floor(slotIndex / contract.columns) * contract.slot.h,
        w: contract.slot.w,
        h: contract.slot.h
      }),
      anchor: contract.anchor,
      alphaProfile: roleDefinition.sprites[slotIndex],
      visibleBounds: Object.freeze({x: 32, y: 32, w: 448, h: 425}),
      visibleBase: Object.freeze({left: 32, right: 479}),
      motifWidth: contract.motifWidth,
      sizeRole,
      nominalWidth: getRoleWidth(role, sizeRole)
    });
  }

  const sprites = Object.freeze(Object.fromEntries(BIOME_DECOR_ROLES.flatMap(role => (
    roles[role].sprites.map((name, index) => [name, createGridSprite(role, index)])
  ))));
  const spriteNames = Object.freeze(Object.keys(sprites));
  const roleRecords = {};
  const alphaProfiles = {};
  const sceneCache = new WeakMap();

  function hasValidNativeSize(role) {
    const image = roleRecords[role]?.image;
    return Boolean(
      image?.complete &&
      image.naturalWidth === contract.sheet.w &&
      image.naturalHeight === contract.sheet.h
    );
  }

  function analyzeRobustComponent(pixels, width, height) {
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

  function analyzeGridAsset(role, image) {
    if (typeof document === "undefined" || !document.createElement) return;
    try {
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d", {willReadFrequently: true});
      if (!context) return;
      context.clearRect(0, 0, surface.width, surface.height);
      context.drawImage(image, 0, 0);
      for (const name of roles[role].sprites) {
        const source = sprites[name].source;
        const profile = analyzeRobustComponent(
          context.getImageData(source.x, source.y, source.w, source.h).data,
          source.w,
          source.h
        );
        if (profile) alphaProfiles[name] = profile;
      }
    } catch {
      // Declarative bounds remain the safe fallback for this optional role.
    }
  }

  for (const role of BIOME_DECOR_ROLES) {
    const image = new Image();
    const record = {image, ready: null};
    roleRecords[role] = record;
    record.ready = new Promise(resolve => {
      image.onload = () => {
        const valid = hasValidNativeSize(role);
        if (valid) analyzeGridAsset(role, image);
        resolve(valid);
      };
      image.onerror = () => resolve(false);
    });
    image.decoding = "async";
    image.src = roles[role].path;
  }

  const readyPromise = Promise.all(BIOME_DECOR_ROLES.map(role => (
    roleRecords[role].ready
  )));

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

  function resolvePlatformRole(platform) {
    if (typeof configuredRoleResolver === "function") {
      return configuredRoleResolver(platform);
    }
    if (typeof BIOME_PLATFORM_VISUALS !== "undefined") {
      const platformVisuals = BIOME_PLATFORM_VISUALS.resolve(biome);
      if (typeof platformVisuals?.resolvePlatformRole === "function") {
        return platformVisuals.resolvePlatformRole(platform);
      }
    }
    if (!platform || platform.lastBubbleSupport) return null;
    if (platform.x === 0 && platform.w === 235 && platform.h === 80) {
      return "START_PLATFORM";
    }
    if (platform.x === 1060 && platform.w === 220 && platform.h >= 80) {
      return "GOAL_TOWER";
    }
    if (platform.h === 26) return "FLOATING";
    return null;
  }

  function freezeItems(items) {
    return Object.freeze(items.map(item => Object.freeze(item)));
  }

  function randomInteger(random, minimum, maximum) {
    return minimum + Math.floor(random() * (maximum - minimum + 1));
  }

  function isSpriteAvailable(name) {
    return Boolean(sprites[name] && hasValidNativeSize(sprites[name].role));
  }

  function availableSpecification(specification) {
    if (specification.sprite) return isSpriteAvailable(specification.sprite);
    return specification.sprites?.some(isSpriteAvailable);
  }

  function takeRandomSpecifications(random, source, count) {
    const available = source.filter(availableSpecification);
    const selected = [];
    while (selected.length < count && available.length > 0) {
      const specification = available.splice(
        randomInteger(random, 0, available.length - 1),
        1
      )[0];
      if (specification.sprites) {
        const {sprites: candidates, ...shared} = specification;
        const availableSprites = candidates.filter(isSpriteAvailable);
        if (availableSprites.length === 0) continue;
        selected.push(Object.freeze({
          ...shared,
          sprite: availableSprites[randomInteger(random, 0, availableSprites.length - 1)]
        }));
      } else {
        selected.push(specification);
      }
    }
    return selected;
  }

  const groundcover = roles.groundcover.sprites;
  const smallFlora = roles.small_flora.sprites;
  const smallProps = roles.small_props.sprites;
  const bushes = roles.bushes.sprites;
  const stones = roles.stones.sprites;
  const tufts = roles.tufts.sprites;
  const heroes = roles.hero.sprites;
  const floatingSequence = Object.freeze([
    Object.freeze({sprites: groundcover, sizeRole: "COMPACT"}),
    Object.freeze({sprites: smallFlora, sizeRole: "COMPACT"}),
    Object.freeze({sprites: smallProps, sizeRole: "COMPACT"}),
    Object.freeze({sprites: tufts, sizeRole: "COMPACT"}),
    Object.freeze({sprites: stones, sizeRole: "COMPACT"}),
    Object.freeze({sprites: bushes, sizeRole: "COMPACT"})
  ]);
  const heroBackDecor = Object.freeze(heroes.map(sprite => (
    Object.freeze({sprite, layer: "back"})
  )));
  const startGoalBackDecor = Object.freeze([
    Object.freeze({sprites: Object.freeze(bushes.slice(0, 3)), layer: "back"}),
    Object.freeze({sprites: Object.freeze(bushes.slice(3)), layer: "back"}),
    Object.freeze({sprites: Object.freeze(groundcover.slice(1, 3)), layer: "back"}),
    Object.freeze({sprites: Object.freeze(groundcover.slice(3)), layer: "back"}),
    Object.freeze({sprites: smallProps, layer: "back"})
  ]);
  const startGoalFrontDecor = Object.freeze([
    Object.freeze({sprite: groundcover[0], layer: "front"}),
    Object.freeze({sprites: Object.freeze(smallFlora.slice(0, 3)), layer: "front"}),
    Object.freeze({sprites: Object.freeze(smallFlora.slice(3)), layer: "front"}),
    Object.freeze({sprites: Object.freeze(smallProps.slice(0, 3)), layer: "front"}),
    Object.freeze({sprites: Object.freeze(smallProps.slice(3)), layer: "front"}),
    Object.freeze({sprites: bushes, layer: "front", sizeRole: "COMPACT"}),
    Object.freeze({sprite: stones[0], layer: "front"}),
    Object.freeze({sprites: Object.freeze(stones.slice(1)), layer: "front"}),
    Object.freeze({sprites: Object.freeze(tufts.slice(0, 3)), layer: "front"}),
    Object.freeze({sprites: Object.freeze(tufts.slice(3)), layer: "front"})
  ]);

  function getVisibleBounds(sprite) {
    return alphaProfiles[sprite.alphaProfile]?.visibleBounds ?? sprite.visibleBounds;
  }

  function getVisibleBase(sprite) {
    const analyzedBase = alphaProfiles[sprite.alphaProfile]?.visibleBase;
    if (analyzedBase) return analyzedBase;
    if (sprite.visibleBase) return sprite.visibleBase;
    const visibleBounds = getVisibleBounds(sprite);
    return Object.freeze({
      left: visibleBounds.x,
      right: visibleBounds.x + visibleBounds.w - 1
    });
  }

  function getGoalSeamProfile(name) {
    const sprite = sprites[name];
    const visibleBounds = getVisibleBounds(sprite);
    const visibleBase = getVisibleBase(sprite);
    const scale = sprite.nominalWidth / sprite.motifWidth;
    const visibleWidth = visibleBounds.w * scale;
    const visibleHeight = visibleBounds.h * scale;
    const sizeScore = Math.max(1, visibleWidth / 38, visibleHeight / 30);
    return Object.freeze({
      name,
      sprite,
      anchor: sprite.anchor,
      visibleBase,
      scale,
      visibleHeight,
      selectionWeight: 1 / Math.pow(sizeScore, 1.6)
    });
  }

  function takeWeightedGoalSeamNames(random, count) {
    const available = spriteNames.filter(isSpriteAvailable);
    const selected = [];
    while (selected.length < count && available.length > 0) {
      const totalWeight = available.reduce((total, name) => (
        total + getGoalSeamProfile(name).selectionWeight
      ), 0);
      let targetWeight = random() * totalWeight;
      let selectedIndex = available.length - 1;
      for (let index = 0; index < available.length; index++) {
        targetWeight -= getGoalSeamProfile(available[index]).selectionWeight;
        if (targetWeight <= 0) {
          selectedIndex = index;
          break;
        }
      }
      selected.push(available.splice(selectedIndex, 1)[0]);
    }
    return selected;
  }

  function getGoalSeamSlotRatios(count) {
    if (count === 2) return [0.32, 0.68];
    if (count === 3) return [0.26, 0.50, 0.74];
    if (count === 4) return [0.22, 0.38, 0.62, 0.78];
    return [0.20, 0.35, 0.50, 0.65, 0.80];
  }

  function createGoalSeamCoverProps(level, goalPlatform, decorNonce) {
    if (!goalPlatform) return Object.freeze([]);
    const availableNames = spriteNames.filter(isSpriteAvailable);
    if (availableNames.length === 0) return Object.freeze([]);
    const random = createDecorRandom(level?.seed ?? 0, salts.goalSeam, decorNonce);
    const count = Math.min(randomInteger(random, 2, 5), availableNames.length);
    const selected = takeWeightedGoalSeamNames(random, count);
    const slotRatios = getGoalSeamSlotRatios(count);
    const rankedSlots = [...slotRatios].sort((left, right) => (
      Math.abs(right - 0.5) - Math.abs(left - 0.5)
    ));
    const rankedProps = selected
      .map(getGoalSeamProfile)
      .sort((left, right) => right.visibleHeight - left.visibleHeight);
    const positioned = rankedProps.map((profile, index) => ({
      profile,
      slotRatio: rankedSlots[index],
      desiredCenter: goalPlatform.x + goalPlatform.w * rankedSlots[index] +
        (random() - 0.5)
    })).sort((left, right) => left.desiredCenter - right.desiredCenter);
    const edgeInset = BIOME_DECOR_PLACEMENT_CONTRACT.goalSeamEdgeInset;
    const minimumGap = BIOME_DECOR_PLACEMENT_CONTRACT.goalSeamMinimumGap;
    const leftEdge = goalPlatform.x + edgeInset;
    const rightEdge = goalPlatform.x + goalPlatform.w - edgeInset;
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
        (item.desiredCenter - previous.desiredCenter - minimumGap) /
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
        leftExtent,
        footprintWidth,
        left: item.desiredCenter - footprintWidth / 2
      };
    });
    return freezeItems(drafts.map(draft => {
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
        baselineY: goalPlatform.y + BIOME_DECOR_PLACEMENT_CONTRACT.goalSeamBaseline,
        baselineOffset: BIOME_DECOR_PLACEMENT_CONTRACT.goalSeamBaseline,
        nominalWidth: profile.sprite.nominalWidth * fitScale,
        sizeRole: profile.sprite.sizeRole,
        anchor: profile.anchor,
        visibleBase: profile.visibleBase
      };
    }));
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
        ? {1: [0.5], 2: [0.18, 0.82], 3: [0.09, 0.50, 0.91]}[count]
        : {1: [0.5], 2: [0.16, 0.84], 3: [0.08, 0.48, 0.92]}[count]
      : {
          1: [0.5],
          2: [0.28, 0.72],
          3: [0.20, 0.50, 0.80],
          4: [0.14, 0.38, 0.63, 0.86],
          5: [0.10, 0.30, 0.50, 0.70, 0.90]
        }[count];
    const retryShift = (((Number(decorNonce) || 0) % 7) - 3) * 0.45;
    return specifications.map((specification, index) => {
      const jitter = (random() - 0.5) * (layer === "back" ? 8 : 6);
      const roleShift = role === "START_PLATFORM" ? retryShift : -retryShift;
      const sprite = sprites[specification.sprite];
      const backAnchor = layer === "back" ? sprite.anchor : null;
      const backBase = backAnchor ? getVisibleBase(sprite) : null;
      const sizeRole = specification.sizeRole ?? sprite.sizeRole;
      const nominalWidth = getRoleWidth(sprite.role, sizeRole);
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
          ? randomInteger(
              random,
              BIOME_DECOR_PLACEMENT_CONTRACT.startGoalBackBaseline.minimum,
              BIOME_DECOR_PLACEMENT_CONTRACT.startGoalBackBaseline.maximum
            )
          : randomInteger(
              random,
              BIOME_DECOR_PLACEMENT_CONTRACT.startGoalFrontBaseline.minimum,
              BIOME_DECOR_PLACEMENT_CONTRACT.startGoalFrontBaseline.maximum
            ),
        ...(backAnchor ? {anchor: backAnchor, visibleBase: backBase} : {})
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
    const salt = role === "START_PLATFORM" ? salts.start : salts.goal;
    const random = createDecorRandom(levelSeed, salt, decorNonce);
    const heroCycle = (
      hashVisualSeed(levelSeed, salt) + ((Number(decorNonce) || 0) >>> 0)
    ) % 3;
    const includeHero = hasValidNativeSize("hero") && heroCycle !== 0;
    const back = takeRandomSpecifications(
      random,
      startGoalBackDecor,
      Math.max(0, backCount - (includeHero ? 1 : 0))
    );
    if (includeHero) {
      const availableHeroes = heroBackDecor.filter(availableSpecification);
      if (availableHeroes.length > 0) {
        const hero = availableHeroes[randomInteger(random, 0, availableHeroes.length - 1)];
        const heroIndex = random() < 0.5 ? 0 : back.length;
        back.splice(heroIndex, 0, hero);
      }
    }
    const front = takeRandomSpecifications(random, startGoalFrontDecor, frontCount);
    return [
      ...positionStartGoalSpecifications(
        role, platform, back, "back", random, decorNonce
      ),
      ...positionStartGoalSpecifications(
        role, platform, front, "front", random, decorNonce
      )
    ];
  }

  function createPreviewItem(platform, role, specification) {
    const sprite = sprites[specification.sprite];
    const baselineOffset = specification.baselineOffset;
    const baselineX = platform.x + (
      Number.isFinite(specification.x)
        ? specification.x
        : platform.w * specification.xRatio
    );
    const sizeRole = specification.sizeRole ?? sprite.sizeRole;
    return {
      sprite: specification.sprite,
      category: sprite.category,
      sizeRole,
      role,
      layer: role === "FLOATING" ? "back" : specification.layer,
      platformX: platform.x,
      platformY: platform.y,
      platformW: platform.w,
      platformH: platform.h,
      baselineX,
      baselineY: platform.y + baselineOffset,
      baselineOffset,
      nominalWidth: getRoleWidth(sprite.role, sizeRole),
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
      (salts.start ^ salts.goal) >>> 0,
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
      for (const specification of createStartGoalDecorSpecifications(
        "START_PLATFORM",
        start,
        levelSeed,
        decorNonce,
        startBackCount,
        startFrontCount
      )) items.push(createPreviewItem(start, "START_PLATFORM", specification));
    }
    if (goal) {
      for (const specification of createStartGoalDecorSpecifications(
        "GOAL_TOWER",
        goal,
        levelSeed,
        decorNonce,
        goalBackCount,
        goalFrontCount
      )) items.push(createPreviewItem(goal, "GOAL_TOWER", specification));
    }

    const availableFloatingSequence = floatingSequence.filter(availableSpecification);
    const floating = platforms.filter(platform => resolvePlatformRole(platform) === "FLOATING");
    if (availableFloatingSequence.length > 0) {
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
          const selection = availableFloatingSequence[
            sequenceIndex % availableFloatingSequence.length
          ];
          const availableSprites = selection.sprites.filter(isSpriteAvailable);
          if (availableSprites.length === 0) continue;
          const sprite = availableSprites[
            hashVisualSeed(
              levelSeed,
              (salts.start ^ salts.goal ^ sequenceIndex) >>> 0
            ) % availableSprites.length
          ];
          items.push(createPreviewItem(platform, "FLOATING", {
            ...selection,
            sprite,
            xRatio: xRatios[slot],
            baselineOffset: BIOME_DECOR_PLACEMENT_CONTRACT.floatingBaseline
          }));
        }
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
      biome,
      decorNonce,
      topBackDecor: topDecorPreview.back,
      topFrontDecor: topDecorPreview.front,
      goalSeamCoverProps: createGoalSeamCoverProps(level, goalPlatform, decorNonce)
    });
  }

  function getAvailabilitySignature() {
    return BIOME_DECOR_ROLES.filter(hasValidNativeSize).join("|");
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
    const cacheKey = `${normalizedNonce}:${getAvailabilitySignature()}`;
    let scene = scenes.get(cacheKey);
    if (!scene) {
      scene = createScene(level, normalizedNonce);
      scenes.set(cacheKey, scene);
    }
    return scene;
  }

  function drawLayer(context, items) {
    let drew = false;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    for (const item of items) {
      const sprite = sprites[item.sprite];
      if (!sprite || !hasValidNativeSize(sprite.role)) continue;
      const anchor = item.anchor ?? sprite.anchor;
      const scale = item.nominalWidth / sprite.motifWidth;
      context.drawImage(
        roleRecords[sprite.role].image,
        sprite.source.x,
        sprite.source.y,
        sprite.source.w,
        sprite.source.h,
        item.baselineX - anchor.x * scale,
        item.baselineY - anchor.y * scale,
        sprite.source.w * scale,
        sprite.source.h * scale
      );
      drew = true;
    }
    context.restore();
    return drew || items.length === 0;
  }

  function getManifest() {
    return Object.freeze({
      contract,
      roleWidths: Object.freeze(Object.fromEntries(BIOME_DECOR_ROLES.map(role => (
        [roles[role].category, roles[role].widths]
      )))),
      sheets: Object.freeze(Object.fromEntries(BIOME_DECOR_ROLES.map(role => (
        [roles[role].category, Object.freeze({
          asset: roles[role].asset,
          sprites: roles[role].sprites,
          slotRoles: roles[role].slotRoles
        })]
      ))))
    });
  }

  function getStatus() {
    return Object.freeze({
      biome,
      paths: Object.freeze(Object.fromEntries(BIOME_DECOR_ROLES.map(role => (
        [role, roles[role].path]
      )))),
      expectedNativeSize: contract.sheet,
      availableRoles: Object.freeze(BIOME_DECOR_ROLES.filter(hasValidNativeSize)),
      validNativeSizes: Object.freeze(Object.fromEntries(BIOME_DECOR_ROLES.map(role => (
        [role, hasValidNativeSize(role)]
      )))),
      alphaProfiles: Object.freeze({...alphaProfiles})
    });
  }

  return Object.freeze({
    biome,
    whenReady: () => readyPromise,
    areAllReady: () => BIOME_DECOR_ROLES.every(hasValidNativeSize),
    isRoleReady: hasValidNativeSize,
    isAssetReady(asset) {
      const role = BIOME_DECOR_ROLES.find(name => roles[name].asset === asset);
      return role ? hasValidNativeSize(role) : false;
    },
    getStatus,
    getManifest,
    getScene,
    resolvePlatformRole,
    drawTopBackDecor: (context, scene) => drawLayer(
      context,
      scene?.topBackDecor ?? []
    ),
    drawStartGoalBackDecor: (context, scene) => drawLayer(
      context,
      (scene?.topBackDecor ?? []).filter(item => item.role !== "FLOATING")
    ),
    drawFloatingBackDecor: (context, scene) => drawLayer(
      context,
      (scene?.topBackDecor ?? []).filter(item => item.role === "FLOATING")
    ),
    drawGoalSeamCoverProps: (context, scene) => drawLayer(
      context,
      scene?.goalSeamCoverProps ?? []
    ),
    drawTopFrontDecor: (context, scene) => drawLayer(
      context,
      scene?.topFrontDecor ?? []
    )
  });
}

const BIOME_DECOR_VISUALS = (() => {
  const visualsByBiome = new Map();
  return Object.freeze({
    register(biomeId, visuals) {
      if (typeof biomeId !== "string" || !biomeId.trim() || !visuals) {
        throw new TypeError("Biome decor visual registration is invalid");
      }
      visualsByBiome.set(biomeId.trim(), visuals);
      return visuals;
    },
    resolve(biomeId) {
      if (typeof biomeId !== "string" || !biomeId.trim()) return null;
      const normalizedBiomeId = biomeId.trim();
      let visuals = visualsByBiome.get(normalizedBiomeId);
      if (!visuals) {
        visuals = createBiomeDecorVisualKit({biome: normalizedBiomeId});
        visualsByBiome.set(normalizedBiomeId, visuals);
      }
      return visuals;
    }
  });
})();
