"use strict";

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
    const g = currentLevel().goal;
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

  function drawTrajectory() {
    if (!aiming) return;
    const launch = getSlingshotLaunch();
    if (launch.dragDistance <= MIN_LAUNCH_DRAG) return;

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
    for (let i = 0; i < 18; i++) {
      const t = 0.055;
      vy += 1570 * t;
      x += vx * t;
      y += vy * t;
      ctx.globalAlpha = 1 - i / 19;
      ctx.fillStyle = "#e9ffef";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, 6 - i * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const palette = getSlimeColorPalette(getActiveSlimeColor());

    for (let i = player.trail.length - 1; i >= 0; i--) {
      const t = player.trail[i];
      const alpha = (1 - i / player.trail.length) * 0.08;
      ctx.fillStyle = `rgba(${palette.trail},${alpha})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, player.r * (0.45 + alpha), 0, Math.PI * 2);
      ctx.fill();
    }

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

    ctx.fillStyle = "#0b2c1a";
    ctx.beginPath();
    ctx.arc(-10, -2, 4.5, 0, Math.PI * 2);
    ctx.arc(10, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0b2c1a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (speed > 720) {
      ctx.arc(0, 10, 7, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 5, 11, 0.15, Math.PI - 0.15);
    }
    ctx.stroke();
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

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(currentLevel().name, 24, 34);
    drawTutorialSketch();

    ctx.restore();
  }

