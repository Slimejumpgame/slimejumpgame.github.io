"use strict";

  const COAST_ASSET_VISUALS = (() => {
    const ASSET_CONTRACT = Object.freeze({
      left: Object.freeze({
        path: "assets/environments/coast/platforms/coast_floating_left.png",
        canvas: Object.freeze({w: 112, h: 127}),
        source: Object.freeze({x: 0, y: 22, w: 112, h: 86})
      }),
      middle: Object.freeze({
        path: "assets/environments/coast/platforms/coast_floating_middle.png",
        canvas: Object.freeze({w: 300, h: 127}),
        source: Object.freeze({x: 0, y: 22, w: 300, h: 86})
      }),
      right: Object.freeze({
        path: "assets/environments/coast/platforms/coast_floating_right.png",
        canvas: Object.freeze({w: 108, h: 127}),
        source: Object.freeze({x: 0, y: 22, w: 108, h: 86})
      })
    });
    const DRAW_HEIGHT = 26;
    const SEAM_OVERLAP = 1;
    const SOURCE_SCALE = DRAW_HEIGHT / ASSET_CONTRACT.middle.source.h;
    const LEFT_WIDTH = ASSET_CONTRACT.left.source.w * SOURCE_SCALE;
    const MIDDLE_WIDTH = ASSET_CONTRACT.middle.source.w * SOURCE_SCALE;
    const RIGHT_WIDTH = ASSET_CONTRACT.right.source.w * SOURCE_SCALE;
    const images = Object.fromEntries(
      Object.entries(ASSET_CONTRACT).map(([name, contract]) => {
        const image = new Image();
        image.src = contract.path;
        return [name, image];
      })
    );

    function areAllReady() {
      return Object.entries(ASSET_CONTRACT).every(([name, contract]) => {
        const image = images[name];
        return (
          image.complete &&
          image.naturalWidth === contract.canvas.w &&
          image.naturalHeight === contract.canvas.h
        );
      });
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

    function drawPlatformBase(context, platform, drawX = platform.x) {
      if (
        platform?.h !== DRAW_HEIGHT ||
        platform.w < LEFT_WIDTH + RIGHT_WIDTH ||
        !areAllReady()
      ) return false;

      const middleStartX = drawX + LEFT_WIDTH;
      const middleEndX = drawX + platform.w - RIGHT_WIDTH;

      context.save();
      traceRoundedRect(context, drawX, platform.y, platform.w, platform.h, 10);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      let destinationX = middleStartX;
      while (destinationX < middleEndX) {
        const destinationWidth = Math.min(MIDDLE_WIDTH, middleEndX - destinationX);
        const sourceWidth = ASSET_CONTRACT.middle.source.w * (
          destinationWidth / MIDDLE_WIDTH
        );
        context.drawImage(
          images.middle,
          ASSET_CONTRACT.middle.source.x,
          ASSET_CONTRACT.middle.source.y,
          sourceWidth,
          ASSET_CONTRACT.middle.source.h,
          destinationX,
          platform.y,
          destinationWidth + SEAM_OVERLAP,
          DRAW_HEIGHT
        );
        destinationX += destinationWidth;
      }

      context.drawImage(
        images.left,
        ASSET_CONTRACT.left.source.x,
        ASSET_CONTRACT.left.source.y,
        ASSET_CONTRACT.left.source.w,
        ASSET_CONTRACT.left.source.h,
        drawX,
        platform.y,
        LEFT_WIDTH + SEAM_OVERLAP,
        DRAW_HEIGHT
      );
      context.drawImage(
        images.right,
        ASSET_CONTRACT.right.source.x,
        ASSET_CONTRACT.right.source.y,
        ASSET_CONTRACT.right.source.w,
        ASSET_CONTRACT.right.source.h,
        drawX + platform.w - RIGHT_WIDTH,
        platform.y,
        RIGHT_WIDTH,
        DRAW_HEIGHT
      );
      context.restore();
      return true;
    }

    function getStatus() {
      return Object.freeze({
        ready: areAllReady(),
        contract: ASSET_CONTRACT,
        drawHeight: DRAW_HEIGHT,
        seamOverlap: SEAM_OVERLAP,
        segmentWidths: Object.freeze({
          left: LEFT_WIDTH,
          middle: MIDDLE_WIDTH,
          right: RIGHT_WIDTH
        })
      });
    }

    return Object.freeze({
      areAllReady,
      drawPlatformBase,
      getStatus
    });
  })();
