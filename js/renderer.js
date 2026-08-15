"use strict";

  const tutorialDragHandImage = new Image();
  tutorialDragHandImage.src = "assets/tutorial/tutorial-drag-hand.png";

  const TUTORIAL_DRAG_HAND_RENDER_SIZE = 108;
  const TUTORIAL_DRAG_HAND_FINGERTIP_X_RATIO = 496 / 1254;
  const TUTORIAL_DRAG_HAND_FINGERTIP_Y_RATIO = 24 / 1254;
  const PRESTIGE_TRAIL_STYLES = Object.freeze({
    "prestige-trail-p5": Object.freeze({colors: ["255,220,82", "255,150,66"], alpha: 0.20, size: 0.42, reach: 2.22, segmentLength: 1.72, segmentWidth: 0.62, shape: "star"}),
    "prestige-trail-slime-p5": Object.freeze({colors: ["112,246,138", "54,190,91"], alpha: 0.19, size: 0.48, reach: 2.18, segmentLength: 1.62, segmentWidth: 0.56, shape: "slime"}),
    "prestige-trail-bubble-p5": Object.freeze({colors: ["125,224,255", "216,250,255"], alpha: 0.25, size: 0.52, reach: 2.12, segmentLength: 1.26, segmentWidth: 0.74, shape: "bubble"}),
    "prestige-trail-spark-p5": Object.freeze({colors: ["255,241,122", "255,255,255"], alpha: 0.23, size: 0.38, reach: 2.28, segmentLength: 1.86, segmentWidth: 0.68, shape: "spark"}),
    "prestige-trail-mist-p5": Object.freeze({colors: ["205,213,235", "151,181,219"], alpha: 0.12, size: 0.55, reach: 2.22, segmentLength: 1.82, segmentWidth: 0.65, shape: "mist"}),
    "prestige-trail-p9": Object.freeze({colors: ["181,103,255", "83,224,255"], alpha: 0.22, size: 0.48, reach: 2.30, segmentLength: 1.82, segmentWidth: 0.56, shape: "cosmic"}),
    "prestige-trail-flame-p9": Object.freeze({colors: ["255,91,50", "255,220,75"], alpha: 0.23, size: 0.46, reach: 2.34, segmentLength: 2.05, segmentWidth: 0.80, shape: "flame"}),
    "prestige-trail-royal-p9": Object.freeze({colors: ["208,111,255", "255,220,82"], alpha: 0.22, size: 0.45, reach: 2.26, segmentLength: 1.72, segmentWidth: 0.60, shape: "royal"}),
    "prestige-trail-neon-p9": Object.freeze({colors: ["35,255,222", "255,54,207"], alpha: 0.28, size: 0.44, reach: 2.34, segmentLength: 1.92, segmentWidth: 0.62, shape: "neon"}),
    "prestige-trail-prism-p9": Object.freeze({colors: ["255,91,91", "255,222,76", "88,238,159", "85,188,255", "205,112,255"], alpha: 0.25, size: 0.47, reach: 2.32, segmentLength: 1.92, segmentWidth: 0.56, shape: "prism"})
  });
  const PRESTIGE_AURA_STYLES = Object.freeze({
    "prestige-aura-p3": Object.freeze({inner: "rgba(174,230,255,0.08)", outer: "rgba(119,210,255,0.64)", accent: "#e8fbff", radius: 1.62, shape: "moon"}),
    "prestige-aura-bubble-p3": Object.freeze({inner: "rgba(174,246,255,0.05)", outer: "rgba(103,221,255,0.54)", accent: "#c9f8ff", radius: 1.68, shape: "bubble"}),
    "prestige-aura-mist-p3": Object.freeze({inner: "rgba(220,225,242,0.05)", outer: "rgba(163,181,218,0.48)", accent: "#dfe7ff", radius: 1.76, shape: "mist"}),
    "prestige-aura-star-p3": Object.freeze({inner: "rgba(255,240,142,0.06)", outer: "rgba(255,211,77,0.57)", accent: "#fff5a8", radius: 1.67, shape: "star"}),
    "prestige-aura-p8": Object.freeze({inner: "rgba(248,185,255,0.09)", outer: "rgba(178,92,255,0.70)", accent: "#9eeaff", radius: 1.75, shape: "cosmic"}),
    "prestige-aura-royal-p8": Object.freeze({inner: "rgba(224,159,255,0.07)", outer: "rgba(159,70,220,0.68)", accent: "#ffe05c", radius: 1.72, shape: "royal"}),
    "prestige-aura-flame-p8": Object.freeze({inner: "rgba(255,211,80,0.08)", outer: "rgba(255,91,55,0.68)", accent: "#ffe454", radius: 1.72, shape: "flame"}),
    "prestige-aura-prism-p8": Object.freeze({inner: "rgba(255,255,255,0.08)", outer: "rgba(108,216,255,0.66)", accent: "#ff8be8", radius: 1.80, shape: "prism"})
  });

  function drawFourPointStar(context, radius) {
    context.beginPath();
    context.moveTo(0, -radius);
    context.lineTo(radius * 0.24, -radius * 0.24);
    context.lineTo(radius, 0);
    context.lineTo(radius * 0.24, radius * 0.24);
    context.lineTo(0, radius);
    context.lineTo(-radius * 0.24, radius * 0.24);
    context.lineTo(-radius, 0);
    context.lineTo(-radius * 0.24, -radius * 0.24);
    context.closePath();
  }

  function drawPrestigeTrailSegment(point, style, index, alpha, radius, angle) {
    const color = style.colors[index % style.colors.length];
    const alternateColor = style.colors[(index + 1) % style.colors.length];
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.scale(style.segmentLength, style.segmentWidth);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${color})`;
    ctx.strokeStyle = `rgb(${alternateColor})`;
    ctx.lineWidth = Math.max(2, radius * 0.12);

    if (style.shape === "bubble" || style.shape === "neon") {
      ctx.globalAlpha = Math.min(0.72, alpha * 1.85);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (style.shape === "neon") {
        ctx.globalAlpha = alpha * 0.42;
        ctx.fill();
      }
    } else if (style.shape === "spark" || style.shape === "star" || style.shape === "prism") {
      ctx.rotate((index % 4) * Math.PI / 8);
      drawFourPointStar(ctx, radius);
      ctx.fill();
      if (style.shape === "prism") ctx.stroke();
    } else if (style.shape === "mist") {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.25, radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style.shape === "flame") {
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.quadraticCurveTo(-radius * 0.15, -radius * 0.7, -radius, 0);
      ctx.quadraticCurveTo(-radius * 0.15, radius * 0.7, radius, 0);
      ctx.closePath();
      ctx.fill();
    } else if (style.shape === "royal") {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-radius * 0.62, -radius * 0.62, radius * 1.24, radius * 1.24);
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeRect(-radius * 0.72, -radius * 0.72, radius * 1.44, radius * 1.44);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      if (style.shape === "cosmic") {
        ctx.globalAlpha = Math.min(0.8, alpha * 1.7);
        ctx.fillStyle = `rgb(${alternateColor})`;
        ctx.beginPath();
        ctx.arc(-radius * 0.28, -radius * 0.32, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPrestigeAura(context, style, radius) {
    if (!style) return;
    const auraRadius = radius * style.radius;
    context.save();
    const aura = context.createRadialGradient(0, 0, radius * 0.72, 0, 0, auraRadius);
    aura.addColorStop(0, style.inner);
    aura.addColorStop(0.72, style.outer);
    aura.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = aura;
    context.beginPath();
    context.arc(0, 0, auraRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = style.accent;
    context.lineWidth = Math.max(1.5, radius * 0.07);
    context.globalAlpha = 0.58;

    if (["moon", "cosmic", "royal", "prism"].includes(style.shape)) {
      context.beginPath();
      context.ellipse(0, 0, auraRadius * 0.92, auraRadius * 0.66, -0.32, 0, Math.PI * 2);
      context.stroke();
    }
    if (style.shape === "bubble") {
      for (const [x, y, size] of [[-1.02, -0.68, 0.18], [1.12, -0.22, 0.14], [0.78, 0.92, 0.11], [-1.18, 0.55, 0.12]]) {
        context.beginPath();
        context.arc(x * radius, y * radius, size * radius, 0, Math.PI * 2);
        context.stroke();
      }
    } else if (style.shape === "mist") {
      context.globalAlpha = 0.28;
      context.beginPath();
      context.ellipse(0, radius * 0.12, auraRadius * 1.02, auraRadius * 0.54, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (style.shape === "star" || style.shape === "prism") {
      for (const [x, y] of [[-1.25, -0.55], [1.18, -0.72], [1.28, 0.62], [-1.08, 0.78]]) {
        context.save();
        context.translate(x * radius, y * radius);
        drawFourPointStar(context, radius * 0.16);
        context.fillStyle = style.accent;
        context.fill();
        context.restore();
      }
    } else if (style.shape === "royal") {
      context.setLineDash([radius * 0.26, radius * 0.16]);
      context.beginPath();
      context.arc(0, 0, auraRadius * 0.9, 0, Math.PI * 2);
      context.stroke();
    } else if (style.shape === "flame") {
      context.beginPath();
      context.moveTo(-radius * 1.12, radius * 0.68);
      context.quadraticCurveTo(-radius * 1.42, -radius * 0.45, -radius * 0.72, -radius * 1.22);
      context.moveTo(radius * 1.12, radius * 0.68);
      context.quadraticCurveTo(radius * 1.42, -radius * 0.45, radius * 0.72, -radius * 1.22);
      context.stroke();
    }
    context.restore();
  }

  function spawnBurst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 260;
      particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 80,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 3 + Math.random() * 6,
        color
      });
    }
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function isStandardPlatform(platform) {
    return !(
      platform.fragile ||
      platform.moving ||
      platform.conveyor ||
      platform.fade ||
      platform.ice ||
      platform.spikePlatform
    );
  }

  function drawEarthPlatformDetail(x, y, w, h, style) {
    ctx.fillStyle = style.detailColor;
    ctx.globalAlpha = 0.42;
    for (let px = x + 28; px < x + w - 12; px += 54) {
      ctx.beginPath();
      ctx.ellipse(px, y + Math.min(h - 7, 25), 6, 3.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (w < 210 && h < 70) return;

    ctx.globalAlpha = 0.50;
    const rowCount = Math.min(3, Math.floor((h - 24) / 20));
    for (let row = 0; row < rowCount; row++) {
      let column = 0;
      for (let px = x + 20 + (row % 2) * 18; px < x + w - 12; px += 42) {
        const radius = 3 + (column % 3) * 0.7;
        ctx.beginPath();
        ctx.arc(px, y + 38 + row * 20, radius, 0, Math.PI * 2);
        ctx.fill();
        column++;
      }
    }
  }

  function drawSandPlatformDetail(x, y, w, h, style) {
    ctx.strokeStyle = style.detailColor;
    ctx.globalAlpha = 0.40;
    ctx.lineWidth = 2;
    for (let px = x + 20; px < x + w - 18; px += 48) {
      ctx.beginPath();
      ctx.arc(px, y + Math.min(h - 6, 24), 8, 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }

  function drawCrackedPlatformDetail(x, y, w, h, style) {
    ctx.strokeStyle = style.detailColor;
    ctx.globalAlpha = 0.62;
    ctx.lineWidth = 2;
    for (let px = x + 34; px < x + w - 20; px += 62) {
      const py = y + Math.min(h - 5, 17);
      ctx.beginPath();
      ctx.moveTo(px, py - 4);
      ctx.lineTo(px - 5, py + 3);
      ctx.lineTo(px + 2, py + 8);
      ctx.lineTo(px - 2, py + 14);
      ctx.stroke();
    }
  }

  function drawSnowPlatformDetail(x, y, w, h, style) {
    ctx.fillStyle = style.detailColor;
    ctx.globalAlpha = 0.58;
    for (let px = x + 25; px < x + w - 15; px += 52) {
      ctx.beginPath();
      ctx.moveTo(px - 7, y + 12);
      ctx.lineTo(px, y + 20 + (px % 3));
      ctx.lineTo(px + 7, y + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMossPlatformDetail(x, y, w, h, style) {
    ctx.strokeStyle = style.detailColor;
    ctx.globalAlpha = 0.62;
    ctx.lineWidth = 3;
    for (let px = x + 20; px < x + w - 12; px += 43) {
      ctx.beginPath();
      ctx.moveTo(px, y + 9);
      ctx.quadraticCurveTo(px + 3, y + 19, px - 2, y + Math.min(h - 4, 28));
      ctx.stroke();
    }
  }

  function drawCrystalPlatformDetail(x, y, w, h, style) {
    ctx.fillStyle = style.detailColor;
    ctx.globalAlpha = 0.70;
    for (let px = x + 27; px < x + w - 14; px += 58) {
      const baseY = y + Math.min(h - 5, 27);
      ctx.beginPath();
      ctx.moveTo(px - 5, baseY);
      ctx.lineTo(px, baseY - 12);
      ctx.lineTo(px + 6, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawNightPlatformDetail(x, y, w, h, style) {
    ctx.fillStyle = style.detailColor;
    ctx.globalAlpha = 0.48;
    for (let px = x + 26; px < x + w - 12; px += 51) {
      ctx.beginPath();
      ctx.arc(px, y + Math.min(h - 6, 23), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAutumnPlatformDetail(x, y, w, h, style) {
    ctx.strokeStyle = style.detailColor;
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = 2.5;
    for (let px = x + 24; px < x + w - 18; px += 55) {
      const py = y + Math.min(h - 5, 20);
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.quadraticCurveTo(px - 10, py + 2, px - 5, py + 11);
      ctx.moveTo(px, py - 2);
      ctx.quadraticCurveTo(px + 10, py + 4, px + 7, py + 13);
      ctx.stroke();
    }
  }

  function drawSkyPlatformDetail(x, y, w, h, style) {
    ctx.strokeStyle = style.detailColor;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2;
    for (let px = x + 25; px < x + w - 14; px += 56) {
      const py = y + Math.min(h - 6, 24);
      ctx.beginPath();
      ctx.moveTo(px - 9, py);
      ctx.lineTo(px, py - 7);
      ctx.lineTo(px + 9, py);
      ctx.stroke();
    }
  }

  const PLATFORM_DETAIL_RENDERERS = {
    earth: drawEarthPlatformDetail,
    sand: drawSandPlatformDetail,
    sandstone: drawCrackedPlatformDetail,
    basalt: drawCrackedPlatformDetail,
    snowRock: drawSnowPlatformDetail,
    moss: drawMossPlatformDetail,
    crystal: drawCrystalPlatformDetail,
    nightStone: drawNightPlatformDetail,
    autumnEarth: drawAutumnPlatformDetail,
    skyStone: drawSkyPlatformDetail
  };

  function drawStandardPlatformDetails(x, y, w, h, style) {
    const renderer = PLATFORM_DETAIL_RENDERERS[style.detail];
    if (!renderer) return;
    ctx.save();
    roundedRect(x, y, w, h, 10);
    ctx.clip();
    renderer(x, y, w, h, style);
    ctx.restore();
  }

  function drawPlatforms(biome) {
    const level = currentLevel();
    const platforms = getPlatforms();

    for (const p of platforms) {
      let drawX = p.x;
      const standardPlatform = isStandardPlatform(p);
      if (
        p.fragile &&
        p.fallingPlatform.triggered &&
        !p.fallingPlatform.falling
      ) {
        const urgency = 1 - p.fallingPlatform.timer / p.fallingPlatform.delay;
        drawX += Math.sin(worldTime * 42) * (1.2 + urgency * 3.4);
      }

      ctx.save();
      if (p.fade) ctx.globalAlpha = p.fadeData.opacity;

      ctx.fillStyle = p.fragile
        ? "#815142"
        : p.moving
          ? "#5e7592"
          : p.conveyor
            ? "#4a4f5b"
            : p.fade
              ? "#584f87"
              : p.ice
                ? "#75bad1"
                : p.spikePlatform
                  ? "#5b4e58"
                  : standardPlatform
                    ? biome.platform.body
                    : "#3c5872";
      roundedRect(drawX, p.y, p.w, p.h, 10);
      ctx.fill();

      ctx.fillStyle = p.fragile
        ? "#ff9d61"
        : p.moving
          ? "#a7d2ff"
          : p.conveyor
            ? "#ffad45"
            : p.fade
              ? "#d5b9ff"
              : p.ice
                ? "#e8fbff"
                : p.spikePlatform
                  ? (p.spikeData.dangerous
                      ? "#ff705d"
                      : p.spikeData.warning
                        ? "#ffc15c"
                        : "#d98a69")
                  : standardPlatform
                    ? biome.platform.top
                    : "#77c68a";
      roundedRect(drawX, p.y, p.w, Math.min(12, p.h), 8);
      ctx.fill();

      if (p.fade) {
        ctx.strokeStyle = "rgba(230,215,255,0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        roundedRect(drawX + 4, p.y + 4, p.w - 8, p.h - 8, 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (p.ice) {
        ctx.strokeStyle = "rgba(255,255,255,0.82)";
        ctx.lineWidth = 2;
        for (let x = drawX + 18; x < drawX + p.w - 10; x += 34) {
          ctx.beginPath();
          ctx.moveTo(x - 9, p.y + p.h - 5);
          ctx.lineTo(x + 8, p.y + 5);
          ctx.stroke();
        }
      }

      if (p.spikePlatform) {
        const spikeData = p.spikeData;

        // Dunkle Schlitze zeigen auch im sicheren Zustand klar, dass hier etwas
        // aus der Plattform herausfahren kann.
        ctx.fillStyle = "rgba(43,27,32,0.82)";
        const slotSpacing = 24;
        for (let x = drawX + 15; x < drawX + p.w - 8; x += slotSpacing) {
          roundedRect(x - 6, p.y + 4, 12, 5, 2.5);
          ctx.fill();
        }

        if (spikeData.warning && !spikeData.dangerous) {
          const pulse = 0.38 + (Math.sin(worldTime * 15) + 1) * 0.22;
          ctx.fillStyle = `rgba(255,196,86,${pulse})`;
          roundedRect(drawX + 3, p.y + 1, p.w - 6, 9, 6);
          ctx.fill();
        }

        if (spikeData.extension > 0.02) {
          const spikeHeight = 25 * spikeData.extension;
          const count = Math.max(3, Math.floor(p.w / 25));
          const step = p.w / count;
          ctx.fillStyle = "#dce8ed";
          ctx.strokeStyle = spikeData.dangerous ? "#ff6d57" : "#d58a67";
          ctx.lineWidth = 2.5;
          for (let i = 0; i < count; i++) {
            const left = drawX + i * step + 2;
            const right = drawX + (i + 1) * step - 2;
            const center = (left + right) / 2;
            ctx.beginPath();
            ctx.moveTo(left, p.y + 6);
            ctx.lineTo(center, p.y + 5 - spikeHeight);
            ctx.lineTo(right, p.y + 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      if (p.conveyor) {
        const direction = Math.sign(p.conveyorSpeed) || 1;
        const spacing = 31;
        const beltOffset = (
          worldTime * Math.abs(p.conveyorSpeed) * 0.72 +
          p.conveyorData.phase
        ) % spacing;

        ctx.save();
        roundedRect(drawX + 2, p.y + 1, p.w - 4, Math.min(11, p.h - 2), 7);
        ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.88)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        for (
          let x = drawX - spacing * 2 + beltOffset * direction;
          x < drawX + p.w + spacing * 2;
          x += spacing
        ) {
          ctx.beginPath();
          if (direction > 0) {
            ctx.moveTo(x - 7, p.y + 3);
            ctx.lineTo(x, p.y + 6);
            ctx.lineTo(x - 7, p.y + 9);
          } else {
            ctx.moveTo(x + 7, p.y + 3);
            ctx.lineTo(x, p.y + 6);
            ctx.lineTo(x + 7, p.y + 9);
          }
          ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = "rgba(15,18,24,0.7)";
        for (let x = drawX + 15; x < drawX + p.w - 8; x += 30) {
          ctx.beginPath();
          ctx.arc(x, p.y + Math.min(20, p.h * 0.67), 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (!p.fade && !p.ice && !p.spikePlatform) {
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        for (let x = drawX + 18; x < drawX + p.w - 8; x += 38) {
          ctx.beginPath();
          ctx.arc(x, p.y + Math.min(30, p.h / 2), 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (standardPlatform) {
        drawStandardPlatformDetails(drawX, p.y, p.w, p.h, biome.platform);
      }

      if (p.fragile) {
        ctx.strokeStyle = "rgba(65,26,20,0.78)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(drawX + p.w * 0.28, p.y + 3);
        ctx.lineTo(drawX + p.w * 0.38, p.y + 13);
        ctx.lineTo(drawX + p.w * 0.33, p.y + 23);
        ctx.moveTo(drawX + p.w * 0.67, p.y + 2);
        ctx.lineTo(drawX + p.w * 0.58, p.y + 12);
        ctx.lineTo(drawX + p.w * 0.64, p.y + 23);
        ctx.stroke();
      }

      ctx.restore();
    }

    for (const pad of level.pads) {
      ctx.save();
      ctx.shadowColor = "#4ddcff";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#47cde9";
      roundedRect(pad.x, pad.y, pad.w, pad.h, 9);
      ctx.fill();
      ctx.fillStyle = "#d1fbff";
      const triangleStartX = pad.x + pad.w / 2 - 16;
      for (let triangleIndex = 0; triangleIndex < 2; triangleIndex++) {
        const x = triangleStartX + triangleIndex * 18;
        ctx.beginPath();
        ctx.moveTo(x, pad.y + 20);
        ctx.lineTo(x + 7, pad.y + 8);
        ctx.lineTo(x + 14, pad.y + 20);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    for (const s of level.spikes) drawDeathZone(s, biome);
  }

  function drawGoal() {
    const level = currentLevel();
    const g = level.goal;
    const pulse = 1 + Math.sin(worldTime * 4) * 0.06;
    ctx.save();
    ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#b76cff";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "rgba(157,83,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 0, g.w / 2, g.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dfc0ff";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.fillStyle = "rgba(20,7,43,0.72)";
    ctx.beginPath();
    ctx.ellipse(0, 0, g.w * 0.29, g.h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const goalLabel = typeof level.goalLabel === "string"
      ? level.goalLabel.trim()
      : "";
    if (!goalLabel) return;

    const labelX = g.x + g.w / 2;
    const labelY = g.y - 27;
    ctx.save();
    ctx.font = '900 24px "Fredoka", system-ui';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelWidth = Math.ceil(ctx.measureText(goalLabel).width) + 28;
    const labelHeight = 34;

    ctx.shadowColor = "rgba(38, 10, 65, 0.72)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(24, 8, 48, 0.92)";
    ctx.strokeStyle = "#d7a7ff";
    ctx.lineWidth = 3;
    roundedRect(
      labelX - labelWidth / 2,
      labelY - labelHeight / 2,
      labelWidth,
      labelHeight,
      12
    );
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 5;
    ctx.fillStyle = "#fff4c7";
    ctx.fillText(goalLabel, labelX, labelY + 1);
    ctx.restore();
  }

  function drawTutorialHeadline() {
    const headline = typeof currentLevel().tutorialHeadline === "string"
      ? currentLevel().tutorialHeadline.trim()
      : "";
    if (!headline) return;

    const headlineX = Number.isFinite(currentLevel().tutorialHeadlineX)
      ? currentLevel().tutorialHeadlineX
      : W / 2;
    const headlineY = Number.isFinite(currentLevel().tutorialHeadlineY)
      ? currentLevel().tutorialHeadlineY
      : 58;
    ctx.save();
    ctx.font = '900 42px "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(109, 255, 32, 0.58)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;
    ctx.strokeStyle = "#1f6312";
    ctx.lineWidth = 8;
    ctx.strokeText(headline, headlineX, headlineY);
    ctx.fillStyle = "#84f51f";
    ctx.fillText(headline, headlineX, headlineY);
    ctx.restore();
  }

  function drawTutorialDragHandImage(tipX, tipY, scale, alpha) {
    if (
      alpha <= 0 ||
      !tutorialDragHandImage.complete ||
      tutorialDragHandImage.naturalWidth <= 0 ||
      tutorialDragHandImage.naturalHeight <= 0
    ) {
      return;
    }

    const drawWidth = TUTORIAL_DRAG_HAND_RENDER_SIZE;
    const drawHeight = drawWidth * (
      tutorialDragHandImage.naturalHeight / tutorialDragHandImage.naturalWidth
    );
    const fingertipOffsetX = drawWidth * TUTORIAL_DRAG_HAND_FINGERTIP_X_RATIO;
    const fingertipOffsetY = drawHeight * TUTORIAL_DRAG_HAND_FINGERTIP_Y_RATIO;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(tipX, tipY);
    ctx.rotate(-0.12);
    ctx.scale(scale, scale);
    ctx.drawImage(
      tutorialDragHandImage,
      -fingertipOffsetX,
      -fingertipOffsetY,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  }

  function drawTutorialDragTrail(startX, startY, endX, endY, alpha) {
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(121, 255, 141, 0.72)";
    ctx.shadowBlur = 14;

    ctx.strokeStyle = "rgba(18, 44, 32, 0.88)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.strokeStyle = "#8dff79";
    ctx.lineWidth = 6;
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawTutorialDragHand() {
    if (!shouldShowTutorialDragHand()) return;

    const cycleDuration = 4.6;
    const elapsed = getTutorialDragHandElapsed() % cycleDuration;
    const startX = W * 0.58;
    const startY = H * 0.20;
    const endX = startX - 125;
    const endY = startY + 92;
    const touchY = startY + 10;
    const smooth = value => {
      const t = clamp(value, 0, 1);
      return t * t * (3 - 2 * t);
    };

    let handX = startX;
    let handY = startY - 10;
    let handScale = 1;
    let handAlpha = 0;
    let trailAlpha = 0;
    let touchAlpha = 0;

    if (elapsed < 0.45) {
      const progress = smooth(elapsed / 0.45);
      handY = startY - 10 * (1 - progress);
      handAlpha = progress;
    } else if (elapsed < 0.9) {
      const progress = smooth((elapsed - 0.45) / 0.45);
      handY = startY + 10 * progress;
      handScale = 1 - progress * 0.08;
      handAlpha = 1;
      touchAlpha = progress;
    } else if (elapsed < 2.15) {
      const progress = smooth((elapsed - 0.9) / 1.25);
      handX = startX + (endX - startX) * progress;
      handY = touchY + (endY - touchY) * progress;
      handScale = 0.92 + progress * 0.08;
      handAlpha = 1;
      trailAlpha = progress;
      touchAlpha = 1;
    } else if (elapsed < 2.6) {
      handX = endX;
      handY = endY;
      handAlpha = 1;
      trailAlpha = 1;
      touchAlpha = 1;
    } else if (elapsed < 3.15) {
      const progress = smooth((elapsed - 2.6) / 0.55);
      handX = endX;
      handY = endY - 15 * progress;
      handScale = 1 + progress * 0.06;
      handAlpha = 1 - progress;
      trailAlpha = 1 - progress;
      touchAlpha = 1 - progress;
    } else {
      return;
    }

    const contactX = startX;
    const contactY = touchY;
    if (touchAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = touchAlpha;
      ctx.strokeStyle = "#f4e8ff";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#b76cff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(contactX, contactY, 17 + Math.sin(worldTime * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawTutorialDragTrail(contactX, contactY, handX, handY, trailAlpha);
    drawTutorialDragHandImage(handX, handY, handScale, handAlpha);
  }

  function drawStars() {
    currentLevel().stars.forEach((s, i) => {
      if (collected[i]) return;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(worldTime * 1.5 + i);
      ctx.shadowColor = "#ffe95c";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffe66a";
      ctx.strokeStyle = "#fff6b0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let n = 0; n < 10; n++) {
        const radius = n % 2 === 0 ? 23 : 10;
        const a = -Math.PI / 2 + n * Math.PI / 5;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        n === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  let currentAimBouncePreviewHit = false;

  function setCurrentAimBouncePreviewHit(hit) {
    const nextHit = hit === true;
    if (nextHit === currentAimBouncePreviewHit) return;
    currentAimBouncePreviewHit = nextHit;
    if (typeof renderDevPerkInspector === "function") {
      renderDevPerkInspector();
    }
  }

  function hasCurrentAimBouncePreviewHit() {
    return aiming && currentAimBouncePreviewHit;
  }

  function drawPostBounceTrajectory(hit) {
    const stepDuration = 0.055;
    const pointCount = 14;
    let x = hit.x;
    let y = hit.y;
    const vx = getBouncePadHorizontalSpeed(
      hit.vx,
      player.lastHorizontalDirection
    );
    let vy = -getBouncePadVerticalSpeed(hit.impactSpeed);

    ctx.fillStyle = "#9deeff";
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < pointCount; i++) {
      vy += 1570 * stepDuration;
      x += vx * stepDuration;
      y += vy * stepDuration;
      ctx.globalAlpha = 0.72 * (1 - i / pointCount);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.2, 5.2 - i * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrajectory() {
    if (!aiming) {
      setCurrentAimBouncePreviewHit(false);
      return;
    }
    const launch = getSlingshotLaunch();
    if (launch.dragDistance <= MIN_LAUNCH_DRAG) {
      setCurrentAimBouncePreviewHit(false);
      return;
    }

    ctx.save();
    ctx.lineCap = "round";

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x - drag.x, player.y - drag.y);
    ctx.stroke();

    const ratio = launch.forceRatio;
    ctx.strokeStyle = ratio > 0.82 ? "#ff7b78" : ratio > 0.55 ? "#ffe66a" : "#7cff90";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
      player.x + launch.vx * (0.58 / 5.7),
      player.y + launch.vy * (0.58 / 5.7)
    );
    ctx.stroke();

    let x = player.x, y = player.y;
    let vx = launch.vx, vy = launch.vy;
    let bounceHit = null;
    const bouncePreviewActive =
      window.SlimePerks?.isActiveForRun?.("bounce_master") === true;
    for (let i = 0; i < 18; i++) {
      const t = 0.055;
      const startX = x;
      const startY = y;
      vy += 1570 * t;
      x += vx * t;
      y += vy * t;

      if (bouncePreviewActive && !bounceHit && vy > 0) {
        for (const pad of currentLevel().pads) {
          const contact = findFirstSweptCircleRectContact(
            startX,
            startY,
            x,
            y,
            player.r,
            pad
          );
          if (
            contact &&
            (!bounceHit || contact.fraction < bounceHit.fraction)
          ) {
            bounceHit = {
              ...contact,
              vx,
              impactSpeed: vy
            };
          }
        }
      }

      if (bounceHit) {
        x = bounceHit.x;
        y = bounceHit.y;
      }
      ctx.globalAlpha = 1 - i / 19;
      ctx.fillStyle = "#e9ffef";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, 6 - i * 0.18), 0, Math.PI * 2);
      ctx.fill();
      if (bounceHit) break;
    }

    setCurrentAimBouncePreviewHit(Boolean(bounceHit));
    if (bounceHit) drawPostBounceTrajectory(bounceHit);
    ctx.restore();
  }

  function roundedCosmeticRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function drawSlimeCosmetic(context, cosmetic, radius = 30) {
    const definition = getSlimeCosmeticDefinition(cosmetic);
    if (!definition || definition.type === "none") return;

    const palette = definition.palette;
    context.save();
    context.translate(
      definition.anchorX * radius,
      definition.anchorY * radius
    );
    context.scale(
      definition.scale * radius / 30,
      definition.scale * radius / 30
    );
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;

    if (cosmetic === "sunglasses") {
      context.strokeStyle = palette.frame;
      context.fillStyle = palette.lens;
      roundedCosmeticRectPath(context, -21, -7, 17, 12, 4);
      context.fill();
      context.stroke();
      roundedCosmeticRectPath(context, 4, -7, 17, 12, 4);
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(-4, -2);
      context.quadraticCurveTo(0, -5, 4, -2);
      context.moveTo(-21, -3);
      context.lineTo(-27, -6);
      context.moveTo(21, -3);
      context.lineTo(27, -6);
      context.stroke();

      context.strokeStyle = palette.shine;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-17, -4);
      context.lineTo(-12, -1);
      context.moveTo(8, -4);
      context.lineTo(13, -1);
      context.stroke();
    } else if (cosmetic === "cap") {
      const capGradient = context.createLinearGradient(0, -25, 0, 3);
      capGradient.addColorStop(0, palette.light);
      capGradient.addColorStop(0.35, palette.main);
      capGradient.addColorStop(1, palette.dark);
      context.fillStyle = capGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-20, 0);
      context.quadraticCurveTo(-20, -22, -3, -25);
      context.quadraticCurveTo(14, -23, 16, -2);
      context.quadraticCurveTo(0, 2, -20, 0);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = palette.main;
      context.beginPath();
      context.moveTo(5, -3);
      context.quadraticCurveTo(24, -4, 29, 4);
      context.quadraticCurveTo(17, 7, 2, 2);
      context.closePath();
      context.fill();
      context.stroke();
      context.strokeStyle = palette.light;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-2, -22);
      context.lineTo(-1, -2);
      context.stroke();
    } else if (cosmetic === "crown") {
      const crownGradient = context.createLinearGradient(0, -31, 0, 4);
      crownGradient.addColorStop(0, palette.light);
      crownGradient.addColorStop(0.45, palette.main);
      crownGradient.addColorStop(1, palette.dark);
      context.fillStyle = crownGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-22, 1);
      context.lineTo(-21, -22);
      context.lineTo(-11, -12);
      context.lineTo(-3, -29);
      context.lineTo(5, -12);
      context.lineTo(17, -25);
      context.lineTo(22, 1);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = palette.main;
      roundedCosmeticRectPath(context, -23, -4, 46, 9, 3);
      context.fill();
      context.stroke();
      context.fillStyle = "#e94a64";
      context.beginPath();
      context.arc(-11, 0, 2.5, 0, Math.PI * 2);
      context.arc(11, 0, 2.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#4a9dff";
      context.beginPath();
      context.arc(0, 0, 2.7, 0, Math.PI * 2);
      context.fill();
    } else if (cosmetic === "top_hat") {
      const hatGradient = context.createLinearGradient(-18, -34, 18, 2);
      hatGradient.addColorStop(0, "#4b526f");
      hatGradient.addColorStop(0.35, palette.main);
      hatGradient.addColorStop(1, palette.dark);
      context.fillStyle = hatGradient;
      context.strokeStyle = palette.dark;
      roundedCosmeticRectPath(context, -17, -35, 34, 35, 4);
      context.fill();
      context.stroke();
      context.fillStyle = palette.band;
      context.fillRect(-17, -10, 34, 8);
      context.strokeRect(-17, -10, 34, 8);
      context.fillStyle = palette.main;
      roundedCosmeticRectPath(context, -27, -3, 54, 10, 5);
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,0.34)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-12, -30);
      context.lineTo(-10, -14);
      context.stroke();
    } else if (cosmetic === "wizard_hat") {
      const wizardGradient = context.createLinearGradient(-20, -46, 20, 3);
      wizardGradient.addColorStop(0, palette.light);
      wizardGradient.addColorStop(0.34, palette.main);
      wizardGradient.addColorStop(1, palette.dark);
      context.fillStyle = wizardGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-21, 1);
      context.quadraticCurveTo(-10, -25, -6, -47);
      context.quadraticCurveTo(-2, -61, 9, -54);
      context.quadraticCurveTo(17, -48, 9, -40);
      context.quadraticCurveTo(17, -22, 21, 1);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.main;
      roundedCosmeticRectPath(context, -27, -3, 54, 10, 5);
      context.fill();
      context.stroke();
      context.fillStyle = "#ffe877";
      context.beginPath();
      context.arc(-5, -28, 3, 0, Math.PI * 2);
      context.arc(9, -18, 2.3, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ffe877";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(4, -39);
      context.lineTo(4, -31);
      context.moveTo(0, -35);
      context.lineTo(8, -35);
      context.stroke();
    } else if (cosmetic === "pirate_hat") {
      const pirateGradient = context.createLinearGradient(0, -35, 0, 5);
      pirateGradient.addColorStop(0, "#57405a");
      pirateGradient.addColorStop(1, palette.main);
      context.fillStyle = pirateGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-28, 1);
      context.quadraticCurveTo(-16, -5, -13, -30);
      context.quadraticCurveTo(0, -21, 13, -30);
      context.quadraticCurveTo(17, -5, 28, 1);
      context.quadraticCurveTo(0, 10, -28, 1);
      context.closePath();
      context.fill();
      context.stroke();
      context.strokeStyle = palette.trim;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-24, 1);
      context.quadraticCurveTo(0, 7, 24, 1);
      context.stroke();

      context.fillStyle = "#f1eadb";
      context.beginPath();
      context.arc(0, -11, 5, 0, Math.PI * 2);
      context.fill();
      context.fillRect(-3, -7, 6, 4);
      context.fillStyle = palette.dark;
      context.beginPath();
      context.arc(-2, -12, 1.2, 0, Math.PI * 2);
      context.arc(2, -12, 1.2, 0, Math.PI * 2);
      context.fill();
    } else if (cosmetic === "headphones") {
      context.strokeStyle = palette.dark;
      context.lineWidth = 8;
      context.beginPath();
      context.arc(0, 0, 28, Math.PI, Math.PI * 2);
      context.stroke();
      context.strokeStyle = palette.main;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, 28, Math.PI, Math.PI * 2);
      context.stroke();

      for (const side of [-1, 1]) {
        const x = side * 25;
        context.fillStyle = palette.dark;
        roundedCosmeticRectPath(context, x - 7, -7, 14, 21, 5);
        context.fill();
        context.strokeStyle = "#0b2435";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = palette.main;
        roundedCosmeticRectPath(context, x - 4, -4, 8, 15, 3);
        context.fill();
        context.fillStyle = palette.light;
        context.fillRect(x - 2, -1, 3, 7);
      }
    } else if (cosmetic === "bow") {
      const bowGradient = context.createRadialGradient(-3, -4, 2, 0, 0, 23);
      bowGradient.addColorStop(0, palette.light);
      bowGradient.addColorStop(0.45, palette.main);
      bowGradient.addColorStop(1, palette.dark);
      context.fillStyle = bowGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-3, 0);
      context.bezierCurveTo(-14, -15, -26, -11, -19, 4);
      context.bezierCurveTo(-14, 13, -7, 8, -3, 3);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(3, 0);
      context.bezierCurveTo(14, -15, 26, -11, 19, 4);
      context.bezierCurveTo(14, 13, 7, 8, 3, 3);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.main;
      context.beginPath();
      context.arc(0, 2, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = "rgba(255,255,255,0.48)";
      context.beginPath();
      context.ellipse(-12, -4, 4, 2, -0.4, 0, Math.PI * 2);
      context.fill();
    } else if (cosmetic === "cowboy_hat") {
      const cowboyGradient = context.createLinearGradient(0, -34, 0, 6);
      cowboyGradient.addColorStop(0, palette.light);
      cowboyGradient.addColorStop(0.42, palette.main);
      cowboyGradient.addColorStop(1, palette.dark);
      context.fillStyle = cowboyGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-18, -3);
      context.lineTo(-15, -27);
      context.quadraticCurveTo(0, -36, 15, -27);
      context.lineTo(18, -3);
      context.quadraticCurveTo(0, 2, -18, -3);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = palette.band;
      roundedCosmeticRectPath(context, -17, -11, 34, 8, 3);
      context.fill();
      context.stroke();

      context.fillStyle = palette.main;
      context.beginPath();
      context.moveTo(-31, 0);
      context.quadraticCurveTo(-21, -6, -11, -2);
      context.quadraticCurveTo(0, 3, 11, -2);
      context.quadraticCurveTo(21, -6, 31, 0);
      context.quadraticCurveTo(22, 9, 0, 5);
      context.quadraticCurveTo(-22, 9, -31, 0);
      context.closePath();
      context.fill();
      context.stroke();

      context.strokeStyle = "rgba(255,255,255,0.38)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-10, -27);
      context.quadraticCurveTo(-2, -32, 7, -28);
      context.stroke();
    } else if (cosmetic === "devil_horns") {
      const hornGradient = context.createLinearGradient(0, -34, 0, 7);
      hornGradient.addColorStop(0, palette.light);
      hornGradient.addColorStop(0.42, palette.main);
      hornGradient.addColorStop(1, palette.dark);
      context.fillStyle = hornGradient;
      context.strokeStyle = palette.dark;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(side * 7, 3);
        context.bezierCurveTo(side * 12, -4, side * 15, -22, side * 27, -31);
        context.bezierCurveTo(side * 25, -14, side * 21, 1, side * 10, 7);
        context.closePath();
        context.fill();
        context.stroke();

        context.strokeStyle = "rgba(255,255,255,0.42)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(side * 13, -4);
        context.quadraticCurveTo(side * 17, -14, side * 22, -22);
        context.stroke();
        context.strokeStyle = palette.dark;
        context.lineWidth = 3;
      }
    } else if (cosmetic === "halo") {
      context.save();
      context.shadowColor = palette.light;
      context.shadowBlur = 13;
      context.beginPath();
      context.ellipse(0, -17, 27, 7, 0, 0, Math.PI * 2);
      context.strokeStyle = palette.dark;
      context.lineWidth = 9;
      context.stroke();
      context.strokeStyle = palette.main;
      context.lineWidth = 6;
      context.stroke();
      context.strokeStyle = palette.light;
      context.lineWidth = 2;
      context.stroke();
      context.restore();
    } else if (cosmetic === "ninja_headband") {
      context.fillStyle = palette.main;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(20, -3);
      context.quadraticCurveTo(30, -11, 37, -7);
      context.lineTo(28, 2);
      context.lineTo(38, 10);
      context.quadraticCurveTo(29, 13, 20, 5);
      context.closePath();
      context.fill();
      context.stroke();

      const bandGradient = context.createLinearGradient(-25, -7, 25, 7);
      bandGradient.addColorStop(0, palette.dark);
      bandGradient.addColorStop(0.28, palette.main);
      bandGradient.addColorStop(0.7, palette.main);
      bandGradient.addColorStop(1, palette.light);
      context.fillStyle = bandGradient;
      roundedCosmeticRectPath(context, -25, -7, 49, 14, 5);
      context.fill();
      context.stroke();
      context.fillStyle = palette.light;
      context.beginPath();
      context.arc(22, 0, 5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,0.46)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-17, -3);
      context.lineTo(8, -3);
      context.stroke();
    } else if (cosmetic === "viking_helmet") {
      context.fillStyle = palette.horn;
      context.strokeStyle = palette.dark;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(side * 17, -14);
        context.bezierCurveTo(side * 27, -20, side * 31, -32, side * 38, -31);
        context.bezierCurveTo(side * 35, -17, side * 29, -7, side * 19, -5);
        context.closePath();
        context.fill();
        context.stroke();
      }

      const helmetGradient = context.createLinearGradient(-22, -30, 22, 4);
      helmetGradient.addColorStop(0, palette.light);
      helmetGradient.addColorStop(0.48, palette.main);
      helmetGradient.addColorStop(1, palette.dark);
      context.fillStyle = helmetGradient;
      context.beginPath();
      context.moveTo(-23, 2);
      context.quadraticCurveTo(-22, -27, 0, -31);
      context.quadraticCurveTo(22, -27, 23, 2);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.dark;
      roundedCosmeticRectPath(context, -25, -4, 50, 9, 3);
      context.fill();
      context.stroke();
      context.fillStyle = palette.light;
      roundedCosmeticRectPath(context, -3, -29, 6, 27, 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(-17, 0, 2, 0, Math.PI * 2);
      context.arc(17, 0, 2, 0, Math.PI * 2);
      context.fill();
    } else if (cosmetic === "party_hat") {
      context.fillStyle = palette.accent;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.arc(0, -41, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      const partyGradient = context.createLinearGradient(-22, -39, 22, 3);
      partyGradient.addColorStop(0, palette.light);
      partyGradient.addColorStop(0.5, palette.main);
      partyGradient.addColorStop(1, palette.dark);
      context.fillStyle = partyGradient;
      context.beginPath();
      context.moveTo(-23, 1);
      context.lineTo(0, -39);
      context.lineTo(23, 1);
      context.quadraticCurveTo(0, 7, -23, 1);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.accent;
      for (const [x, y, radius] of [[-8, -12, 3], [8, -8, 2.5], [1, -25, 2.7]]) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = palette.light;
      roundedCosmeticRectPath(context, -24, -3, 48, 8, 4);
      context.fill();
      context.stroke();
    } else if (cosmetic === "chef_hat") {
      const chefGradient = context.createLinearGradient(-20, -42, 20, 5);
      chefGradient.addColorStop(0, palette.light);
      chefGradient.addColorStop(0.65, palette.main);
      chefGradient.addColorStop(1, palette.dark);
      context.fillStyle = chefGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-21, -4);
      context.lineTo(-20, -20);
      context.bezierCurveTo(-29, -27, -22, -39, -11, -37);
      context.bezierCurveTo(-7, -47, 7, -47, 11, -37);
      context.bezierCurveTo(22, -40, 29, -28, 20, -20);
      context.lineTo(21, -4);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.main;
      roundedCosmeticRectPath(context, -23, -7, 46, 12, 4);
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(120,135,150,0.55)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-8, -31);
      context.quadraticCurveTo(-11, -20, -8, -10);
      context.moveTo(8, -31);
      context.quadraticCurveTo(11, -20, 8, -10);
      context.stroke();
    } else if (cosmetic === "propeller_hat") {
      context.strokeStyle = palette.dark;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(0, -19);
      context.lineTo(0, -30);
      context.stroke();
      context.fillStyle = palette.accent;
      context.beginPath();
      context.ellipse(-10, -31, 12, 4, -0.18, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = "#ffe45c";
      context.beginPath();
      context.ellipse(10, -31, 12, 4, 0.18, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = palette.light;
      context.beginPath();
      context.arc(0, -31, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      const propellerGradient = context.createLinearGradient(-21, -22, 21, 4);
      propellerGradient.addColorStop(0, palette.light);
      propellerGradient.addColorStop(0.52, palette.main);
      propellerGradient.addColorStop(1, palette.dark);
      context.fillStyle = propellerGradient;
      context.beginPath();
      context.moveTo(-22, 1);
      context.quadraticCurveTo(-19, -19, 0, -21);
      context.quadraticCurveTo(19, -19, 22, 1);
      context.quadraticCurveTo(0, 5, -22, 1);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.accent;
      context.beginPath();
      context.moveTo(0, -21);
      context.quadraticCurveTo(10, -18, 11, 1);
      context.quadraticCurveTo(5, 3, 0, 3);
      context.closePath();
      context.fill();
      context.fillStyle = palette.main;
      context.beginPath();
      context.moveTo(8, -1);
      context.quadraticCurveTo(25, -2, 29, 5);
      context.quadraticCurveTo(19, 8, 5, 4);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (cosmetic === "cat_ears") {
      const earGradient = context.createLinearGradient(0, -35, 0, 5);
      earGradient.addColorStop(0, palette.light);
      earGradient.addColorStop(0.48, palette.main);
      earGradient.addColorStop(1, palette.dark);
      context.fillStyle = earGradient;
      context.strokeStyle = palette.dark;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(side * 5, 3);
        context.lineTo(side * 16, -29);
        context.quadraticCurveTo(side * 22, -36, side * 29, -27);
        context.lineTo(side * 27, 3);
        context.quadraticCurveTo(side * 16, -2, side * 5, 3);
        context.closePath();
        context.fill();
        context.stroke();

        context.fillStyle = palette.inner;
        context.beginPath();
        context.moveTo(side * 12, -2);
        context.lineTo(side * 18, -25);
        context.quadraticCurveTo(side * 22, -29, side * 25, -23);
        context.lineTo(side * 23, -3);
        context.closePath();
        context.fill();
        context.fillStyle = earGradient;
      }

      context.strokeStyle = palette.dark;
      context.lineWidth = 7;
      context.beginPath();
      context.arc(0, 4, 25, Math.PI, Math.PI * 2);
      context.stroke();
      context.strokeStyle = palette.main;
      context.lineWidth = 4;
      context.stroke();
    } else if (cosmetic === "bunny_ears") {
      const bunnyGradient = context.createLinearGradient(0, -56, 0, 7);
      bunnyGradient.addColorStop(0, palette.light);
      bunnyGradient.addColorStop(0.48, palette.main);
      bunnyGradient.addColorStop(1, palette.dark);
      context.strokeStyle = palette.dark;
      context.lineWidth = 3;
      for (const side of [-1, 1]) {
        context.fillStyle = bunnyGradient;
        context.beginPath();
        context.moveTo(side * 5, 5);
        context.bezierCurveTo(
          side * 8, -15,
          side * 9, -47,
          side * 19, -53
        );
        context.bezierCurveTo(
          side * 31, -52,
          side * 27, -18,
          side * 25, 2
        );
        context.quadraticCurveTo(side * 15, -2, side * 5, 5);
        context.closePath();
        context.fill();
        context.stroke();

        context.fillStyle = palette.inner;
        context.beginPath();
        context.moveTo(side * 12, -2);
        context.bezierCurveTo(
          side * 13, -20,
          side * 14, -42,
          side * 19, -46
        );
        context.bezierCurveTo(
          side * 24, -43,
          side * 22, -19,
          side * 21, -4
        );
        context.quadraticCurveTo(side * 17, -5, side * 12, -2);
        context.closePath();
        context.fill();
      }

      context.strokeStyle = palette.dark;
      context.lineWidth = 7;
      context.beginPath();
      context.arc(0, 4, 25, Math.PI, Math.PI * 2);
      context.stroke();
      context.strokeStyle = palette.main;
      context.lineWidth = 4;
      context.stroke();
    }

    context.restore();
  }

  function drawSlimeBeard(context, beard, radius = 30) {
    const definition = getSlimeBeardDefinition(beard);
    if (!definition || beard === "none") return;

    const palette = definition.palette;
    context.save();
    context.translate(
      definition.anchorX * radius,
      definition.anchorY * radius
    );
    context.scale(
      definition.scale * radius / 30,
      definition.scale * radius / 30
    );
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.5;

    if (beard === "stubble") {
      context.strokeStyle = palette.main;
      context.lineWidth = 2;
      const stubbleMarks = [
        [-17, 2, -1], [-10, 6, 1], [-3, 9, -1], [4, 9, 1],
        [11, 6, -1], [18, 2, 1], [-14, 13, 1], [-6, 16, -1],
        [2, 17, 1], [10, 15, -1], [16, 11, 1]
      ];
      for (const [x, y, lean] of stubbleMarks) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + lean, y + 2.5);
        context.stroke();
      }
      context.fillStyle = palette.light;
      context.beginPath();
      context.arc(-20, 8, 1.2, 0, Math.PI * 2);
      context.arc(20, 8, 1.2, 0, Math.PI * 2);
      context.fill();
    } else if (beard === "mustache") {
      const mustacheGradient = context.createRadialGradient(0, -2, 2, 0, 4, 26);
      mustacheGradient.addColorStop(0, palette.light);
      mustacheGradient.addColorStop(0.48, palette.main);
      mustacheGradient.addColorStop(1, palette.dark);
      context.fillStyle = mustacheGradient;
      context.strokeStyle = palette.dark;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(0, 1);
        context.bezierCurveTo(side * 7, -6, side * 18, -7, side * 25, 0);
        context.bezierCurveTo(side * 18, 10, side * 7, 8, 0, 3);
        context.closePath();
        context.fill();
        context.stroke();
      }
    } else if (beard === "goatee") {
      const goateeGradient = context.createLinearGradient(0, 0, 0, 27);
      goateeGradient.addColorStop(0, palette.light);
      goateeGradient.addColorStop(0.45, palette.main);
      goateeGradient.addColorStop(1, palette.dark);
      context.fillStyle = goateeGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-8, 5);
      context.quadraticCurveTo(-7, 17, 0, 26);
      context.quadraticCurveTo(7, 17, 8, 5);
      context.quadraticCurveTo(0, 10, -8, 5);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.light;
      context.beginPath();
      context.ellipse(0, 5, 9, 3.5, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (beard === "full_beard") {
      const beardGradient = context.createRadialGradient(-6, 4, 3, 0, 13, 29);
      beardGradient.addColorStop(0, palette.light);
      beardGradient.addColorStop(0.46, palette.main);
      beardGradient.addColorStop(1, palette.dark);
      context.fillStyle = beardGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-23, -1);
      context.quadraticCurveTo(-25, 14, -14, 24);
      context.quadraticCurveTo(0, 33, 14, 24);
      context.quadraticCurveTo(25, 14, 23, -1);
      context.quadraticCurveTo(12, 4, 0, 1);
      context.quadraticCurveTo(-12, 4, -23, -1);
      context.closePath();
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,0.28)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-13, 8);
      context.quadraticCurveTo(-9, 18, -3, 24);
      context.moveTo(13, 8);
      context.quadraticCurveTo(9, 18, 3, 24);
      context.stroke();
    } else if (beard === "cowboy_mustache") {
      const cowboyGradient = context.createLinearGradient(0, -8, 0, 14);
      cowboyGradient.addColorStop(0, palette.light);
      cowboyGradient.addColorStop(0.5, palette.main);
      cowboyGradient.addColorStop(1, palette.dark);
      context.fillStyle = cowboyGradient;
      context.strokeStyle = palette.dark;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(0, 1);
        context.bezierCurveTo(side * 10, -8, side * 23, -8, side * 31, -3);
        context.bezierCurveTo(side * 27, 3, side * 30, 7, side * 35, 2);
        context.bezierCurveTo(side * 31, 14, side * 14, 12, 0, 4);
        context.closePath();
        context.fill();
        context.stroke();
      }
    } else if (beard === "viking_beard") {
      const vikingGradient = context.createLinearGradient(0, -2, 0, 34);
      vikingGradient.addColorStop(0, palette.light);
      vikingGradient.addColorStop(0.42, palette.main);
      vikingGradient.addColorStop(1, palette.dark);
      context.fillStyle = vikingGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-23, -1);
      context.quadraticCurveTo(-24, 14, -13, 26);
      context.lineTo(-5, 20);
      context.lineTo(0, 33);
      context.lineTo(5, 20);
      context.lineTo(13, 26);
      context.quadraticCurveTo(24, 14, 23, -1);
      context.quadraticCurveTo(11, 4, 0, 1);
      context.quadraticCurveTo(-11, 4, -23, -1);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.band;
      roundedCosmeticRectPath(context, -5, 21, 10, 7, 2);
      context.fill();
      context.stroke();
    } else if (beard === "wizard_beard") {
      const wizardGradient = context.createLinearGradient(-18, -3, 10, 34);
      wizardGradient.addColorStop(0, palette.light);
      wizardGradient.addColorStop(0.5, palette.main);
      wizardGradient.addColorStop(1, palette.dark);
      context.fillStyle = wizardGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-22, 0);
      context.quadraticCurveTo(-22, 13, -10, 19);
      context.quadraticCurveTo(-4, 26, 0, 32);
      context.quadraticCurveTo(5, 25, 12, 19);
      context.quadraticCurveTo(22, 12, 22, 0);
      context.quadraticCurveTo(10, 5, 0, 1);
      context.quadraticCurveTo(-10, 5, -22, 0);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = palette.light;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(0, 0);
        context.bezierCurveTo(side * 7, -5, side * 16, -5, side * 23, 1);
        context.bezierCurveTo(side * 14, 8, side * 6, 7, 0, 3);
        context.closePath();
        context.fill();
        context.stroke();
      }
    } else if (beard === "braided_beard") {
      const braidGradient = context.createLinearGradient(0, -2, 0, 31);
      braidGradient.addColorStop(0, palette.light);
      braidGradient.addColorStop(0.44, palette.main);
      braidGradient.addColorStop(1, palette.dark);
      context.fillStyle = braidGradient;
      context.strokeStyle = palette.dark;
      context.beginPath();
      context.moveTo(-21, -1);
      context.quadraticCurveTo(-21, 12, -9, 16);
      context.quadraticCurveTo(0, 20, 9, 16);
      context.quadraticCurveTo(21, 12, 21, -1);
      context.quadraticCurveTo(10, 4, 0, 1);
      context.quadraticCurveTo(-10, 4, -21, -1);
      context.closePath();
      context.fill();
      context.stroke();
      for (const [x, y, rotation] of [[-2, 14, -0.25], [2, 20, 0.25], [-1, 26, -0.2]]) {
        context.fillStyle = y === 20 ? palette.light : palette.main;
        context.beginPath();
        context.ellipse(x, y, 7, 5, rotation, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.fillStyle = palette.band;
      roundedCosmeticRectPath(context, -6, 28, 12, 6, 2);
      context.fill();
      context.stroke();
    } else if (beard === "lumberjack_beard") {
      const lumberjackGradient = context.createLinearGradient(0, -4, 0, 36);
      lumberjackGradient.addColorStop(0, palette.light);
      lumberjackGradient.addColorStop(0.42, palette.main);
      lumberjackGradient.addColorStop(1, palette.dark);
      context.fillStyle = lumberjackGradient;
      context.strokeStyle = palette.dark;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-28, -2);
      context.quadraticCurveTo(-32, 10, -27, 20);
      context.quadraticCurveTo(-24, 28, -15, 25);
      context.quadraticCurveTo(-12, 34, -3, 30);
      context.quadraticCurveTo(0, 39, 4, 30);
      context.quadraticCurveTo(14, 34, 16, 25);
      context.quadraticCurveTo(25, 29, 28, 20);
      context.quadraticCurveTo(33, 9, 28, -2);
      context.quadraticCurveTo(15, 4, 0, 1);
      context.quadraticCurveTo(-15, 4, -28, -2);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = palette.light;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(0, 1);
        context.bezierCurveTo(side * 8, -5, side * 19, -5, side * 25, 0);
        context.bezierCurveTo(side * 18, 9, side * 7, 8, 0, 4);
        context.closePath();
        context.fill();
        context.stroke();
      }
    } else if (beard === "imperial_beard") {
      const imperialGradient = context.createLinearGradient(0, -10, 0, 23);
      imperialGradient.addColorStop(0, palette.light);
      imperialGradient.addColorStop(0.48, palette.main);
      imperialGradient.addColorStop(1, palette.dark);
      context.fillStyle = imperialGradient;
      context.strokeStyle = palette.dark;
      context.lineWidth = 3;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(0, 1);
        context.bezierCurveTo(side * 9, -7, side * 20, -8, side * 27, -3);
        context.bezierCurveTo(side * 35, -11, side * 39, -3, side * 31, 3);
        context.bezierCurveTo(side * 24, 10, side * 11, 9, 0, 4);
        context.closePath();
        context.fill();
        context.stroke();
      }

      context.beginPath();
      context.moveTo(-7, 6);
      context.quadraticCurveTo(-6, 16, 0, 23);
      context.quadraticCurveTo(7, 16, 7, 6);
      context.quadraticCurveTo(0, 9, -7, 6);
      context.closePath();
      context.fill();
      context.stroke();
    }

    context.restore();
  }

  function drawSlimeCharacterPreview(
    canvasElement,
    cosmetic = "none",
    beard = "none",
    color = "green",
    options = {}
  ) {
    const previewContext = canvasElement.getContext("2d");
    const palette = getSlimeColorPalette(color);
    const centerY = Number.isFinite(options.centerY) ? options.centerY : 48;
    const scale = Number.isFinite(options.scale) ? options.scale : 0.66;
    previewContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
    previewContext.save();
    previewContext.translate(canvasElement.width / 2, centerY);
    previewContext.scale(scale, scale);

    const bodyGradient = previewContext.createRadialGradient(-9, -10, 2, 0, 0, 30);
    bodyGradient.addColorStop(0, palette.light);
    bodyGradient.addColorStop(0.34, palette.main);
    bodyGradient.addColorStop(1, palette.dark);
    previewContext.fillStyle = bodyGradient;
    previewContext.strokeStyle = palette.outline;
    previewContext.lineWidth = 4;
    previewContext.beginPath();
    previewContext.arc(0, 0, 30, 0, Math.PI * 2);
    previewContext.fill();
    previewContext.stroke();

    previewContext.fillStyle = palette.face ?? "#0b2c1a";
    previewContext.beginPath();
    previewContext.arc(-10, -2, 4, 0, Math.PI * 2);
    previewContext.arc(10, -2, 4, 0, Math.PI * 2);
    previewContext.fill();
    drawSlimeBeard(previewContext, normalizeSlimeBeard(beard), 30);
    drawSlimeCosmetic(previewContext, cosmetic, 30);
    previewContext.restore();
  }

  function drawSlimeCosmeticPreview(canvasElement, cosmetic, color = "green", options = {}) {
    drawSlimeCharacterPreview(canvasElement, cosmetic, "none", color, options);
  }

  function drawPlayer() {
    const palette = getSlimeColorPalette(getActiveSlimeColor());
    const selectedTrail = window.SlimePrestige?.getSelectedReward?.("trail") ?? "none";
    const prestigeTrail = PRESTIGE_TRAIL_STYLES[selectedTrail] ?? null;

    for (let i = player.trail.length - 1; i >= 0; i--) {
      const t = player.trail[i];
      const trailStrength = 1 - i / player.trail.length;
      if (prestigeTrail) {
        const directionPoint = i > 0
          ? player.trail[i - 1]
          : player.trail[Math.min(1, player.trail.length - 1)];
        const directionX = i > 0
          ? directionPoint.x - t.x
          : t.x - directionPoint.x;
        const directionY = i > 0
          ? directionPoint.y - t.y
          : t.y - directionPoint.y;
        const trailAngle = Math.atan2(directionY, directionX);
        const visualPoint = {
          x: player.x + (t.x - player.x) * prestigeTrail.reach,
          y: player.y + (t.y - player.y) * prestigeTrail.reach
        };
        drawPrestigeTrailSegment(
          visualPoint,
          prestigeTrail,
          i,
          trailStrength * prestigeTrail.alpha,
          player.r * (prestigeTrail.size + trailStrength * 0.08),
          trailAngle
        );
      } else {
        const alpha = trailStrength * 0.08;
        ctx.fillStyle = `rgba(${palette.trail},${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, player.r * (0.45 + alpha), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const selectedAura = window.SlimePrestige?.getSelectedReward?.("aura") ?? "none";
    const prestigeAura = PRESTIGE_AURA_STYLES[selectedAura];

    const speed = Math.hypot(player.vx, player.vy);
    const stretch = Math.min(0.22, speed / 2600);
    const squish = player.squish * 0.22;

    let sx = 1 + stretch - squish;
    let sy = 1 - stretch + squish;
    if (player.onGround && speed < 30) {
      sx += Math.sin(worldTime * 2.6) * 0.018;
      sy -= Math.sin(worldTime * 2.6) * 0.018;
    }

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(speed > 40 ? Math.atan2(player.vy, player.vx) * 0.06 : 0);
    ctx.scale(sx, sy);

    drawPrestigeAura(ctx, prestigeAura, player.r);

    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 22;
    const g = ctx.createRadialGradient(-10, -12, 3, 0, 0, player.r);
    g.addColorStop(0, palette.light);
    g.addColorStop(0.32, palette.main);
    g.addColorStop(1, palette.dark);
    ctx.fillStyle = g;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(-10, -12, 8, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.face ?? "#0b2c1a";
    ctx.beginPath();
    ctx.arc(-10, -2, 4.5, 0, Math.PI * 2);
    ctx.arc(10, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.face ?? "#0b2c1a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (speed > 720) {
      ctx.arc(0, 10, 7, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 5, 11, 0.15, Math.PI - 0.15);
    }
    ctx.stroke();
    drawSlimeBeard(ctx, getActiveSlimeBeard(), player.r);
    drawSlimeCosmetic(ctx, getActiveSlimeCosmetic(), player.r);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(sx, sy);

    const biome = getBiomeForLevel(levelIndex + 1);
    drawBackground(biome);
    drawPlatforms(biome);
    drawGoal();
    drawStars();
    drawEnemies();
    drawTrajectory();
    drawPlayer();
    drawParticles();
    drawTutorialDragHand();
    drawTutorialHeadline();

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(currentLevel().name, 24, 34);
    drawTutorialSketch();

    ctx.restore();
  }

