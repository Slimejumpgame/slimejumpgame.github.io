"use strict";

const BIOME_PORTAL_CONTRACT = Object.freeze({
  nativeSize: Object.freeze({w: 256, h: 272}),
  alphaThreshold: 8,
  destinationWidth: 180,
  referenceHeight: 191,
  goalBottomOffset: 15,
  visualYOffset: 10,
  contentBottomInset: 1.5178807951757278,
  glow: Object.freeze({
    periodSeconds: 2.2,
    alphaMinimum: 0.12,
    alphaMaximum: 0.68,
    radius: 60,
    width: 44,
    centerXRatio: 0.48,
    centerYRatio: 0.49
  })
});

function createBiomePortalVisual(config) {
  if (!config || typeof config.biome !== "string" || !config.biome.trim()) {
    throw new TypeError("Biome portal visual requires a biome id");
  }
  const biome = config.biome.trim();
  const path = config.path ?? (
    `assets/environments/${biome}/portal/${biome}_goal_portal.png`
  );
  const contract = BIOME_PORTAL_CONTRACT;
  const image = new Image();
  let contentBounds = null;

  function hasValidNativeSize() {
    return Boolean(
      image.complete &&
      image.naturalWidth === contract.nativeSize.w &&
      image.naturalHeight === contract.nativeSize.h
    );
  }

  function analyzeContentBounds() {
    if (typeof document === "undefined" || !document.createElement) return null;
    try {
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d", {willReadFrequently: true});
      if (!context) return null;
      context.clearRect(0, 0, surface.width, surface.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      let left = surface.width;
      let right = -1;
      let top = surface.height;
      let bottom = -1;
      for (let y = 0; y < surface.height; y++) {
        for (let x = 0; x < surface.width; x++) {
          if (pixels[(y * surface.width + x) * 4 + 3] <= contract.alphaThreshold) {
            continue;
          }
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) return null;
      return Object.freeze({
        x: left,
        y: top,
        w: right - left + 1,
        h: bottom - top + 1
      });
    } catch {
      return null;
    }
  }

  const readyPromise = new Promise(resolve => {
    image.onload = () => {
      if (!hasValidNativeSize()) {
        resolve(false);
        return;
      }
      contentBounds = analyzeContentBounds();
      resolve(Boolean(contentBounds));
    };
    image.onerror = () => resolve(false);
  });
  image.decoding = "async";
  image.src = path;

  function isReady() {
    return hasValidNativeSize() && Boolean(contentBounds);
  }

  function getMapping(goal) {
    if (!goal || !isReady()) return null;
    const scale = contract.destinationWidth / contentBounds.w;
    const destinationHeight = contentBounds.h * scale;
    const referenceX = goal.x + goal.w / 2 - contract.destinationWidth / 2;
    const referenceY = goal.y + goal.h + contract.goalBottomOffset -
      contract.referenceHeight + contract.visualYOffset;
    const contentTopOffset = contract.referenceHeight -
      contract.contentBottomInset - destinationHeight;
    return Object.freeze({
      source: contentBounds,
      destination: Object.freeze({
        x: referenceX,
        y: referenceY + contentTopOffset,
        w: contract.destinationWidth,
        h: destinationHeight
      }),
      reference: Object.freeze({
        x: referenceX,
        y: referenceY,
        w: contract.destinationWidth,
        h: contract.referenceHeight
      })
    });
  }

  function drawPortal(context, goal, visualTime = 0) {
    const mapping = getMapping(goal);
    if (!mapping) return false;
    const source = mapping.source;
    const destination = mapping.destination;

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.shadowColor = "rgba(162,91,255,0.55)";
    context.shadowBlur = 16;
    context.drawImage(
      image,
      source.x,
      source.y,
      source.w,
      source.h,
      destination.x,
      destination.y,
      destination.w,
      destination.h
    );
    context.restore();

    const glowContract = contract.glow;
    const pulse = (
      Math.sin((Number(visualTime) || 0) * Math.PI * 2 / glowContract.periodSeconds) + 1
    ) / 2;
    const glowAlpha = glowContract.alphaMinimum +
      (glowContract.alphaMaximum - glowContract.alphaMinimum) * pulse;
    const glow = context.createRadialGradient(
      0, 0, 0, 0, 0, glowContract.radius
    );
    glow.addColorStop(0, `rgba(235,215,255,${glowAlpha})`);
    glow.addColorStop(0.42, `rgba(190,128,255,${glowAlpha * 0.70})`);
    glow.addColorStop(1, "rgba(137,70,230,0)");

    context.save();
    context.translate(
      mapping.reference.x + mapping.reference.w * glowContract.centerXRatio,
      mapping.reference.y + mapping.reference.h * glowContract.centerYRatio
    );
    context.scale(glowContract.width / glowContract.radius, 1);
    context.globalCompositeOperation = "screen";
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, glowContract.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return true;
  }

  return Object.freeze({
    biome,
    whenReady: () => readyPromise,
    isReady,
    getMapping,
    drawPortal,
    getStatus: () => Object.freeze({
      biome,
      path,
      ready: isReady(),
      validNativeSize: hasValidNativeSize(),
      expectedNativeSize: contract.nativeSize,
      contentBounds
    })
  });
}

const BIOME_PORTAL_VISUALS = (() => {
  const visualsByBiome = new Map();
  return Object.freeze({
    register(biomeId, visuals) {
      if (typeof biomeId !== "string" || !biomeId.trim() || !visuals) {
        throw new TypeError("Biome portal visual registration is invalid");
      }
      visualsByBiome.set(biomeId.trim(), visuals);
      return visuals;
    },
    resolve(biomeId) {
      if (typeof biomeId !== "string" || !biomeId.trim()) return null;
      const normalizedBiomeId = biomeId.trim();
      let visuals = visualsByBiome.get(normalizedBiomeId);
      if (!visuals) {
        visuals = createBiomePortalVisual({biome: normalizedBiomeId});
        visualsByBiome.set(normalizedBiomeId, visuals);
      }
      return visuals;
    }
  });
})();
