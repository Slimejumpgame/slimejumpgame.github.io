"use strict";

  function drawSpikeHazard(s, hazard) {
    const count = Math.max(2, Math.floor(s.w / 24));
    const step = s.w / count;
    if (
      (
        typeof isFairyTaleGraphicsMode !== "function" ||
        isFairyTaleGraphicsMode()
      ) &&
      typeof MEADOW_ASSET_VISUALS !== "undefined" &&
      MEADOW_ASSET_VISUALS.drawBottomSpikeHazard(ctx, s, count, step)
    ) return;
    ctx.fillStyle = hazard.fill;
    ctx.strokeStyle = hazard.stroke;
    ctx.lineWidth = 3;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * step, s.y + s.h);
      ctx.lineTo(s.x + i * step + step / 2, s.y);
      ctx.lineTo(s.x + (i + 1) * step, s.y + s.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function fillHazardGradient(s, hazard) {
    const gradient = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    gradient.addColorStop(0, hazard.fill);
    gradient.addColorStop(1, hazard.deep);
    ctx.fillStyle = gradient;
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }

  function drawHazardBoundary(s, hazard, lineWidth = 5) {
    ctx.strokeStyle = hazard.surface;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.w, s.y);
    ctx.stroke();
  }

  function drawLiquidWaves(s, hazard, speed, amplitude = 2.5) {
    fillHazardGradient(s, hazard);
    drawHazardBoundary(s, hazard, 5);
    ctx.strokeStyle = hazard.accent;
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 2.5;
    for (let row = 0; row < 2; row++) {
      ctx.beginPath();
      for (let x = s.x; x <= s.x + s.w; x += 12) {
        const y = s.y + 7 + row * 10 + Math.sin(x * 0.045 + worldTime * speed + row * 2.2) * amplitude;
        x === s.x ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWaterHazard(s, hazard) {
    drawLiquidWaves(s, hazard, 2.1, 2.2);
  }

  function drawQuicksandHazard(s, hazard) {
    fillHazardGradient(s, hazard);
    drawHazardBoundary(s, hazard, 5);
    ctx.strokeStyle = hazard.accent;
    ctx.globalAlpha = 0.48;
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = s.x + 42 + i * 91;
      const pulse = 0.82 + Math.sin(worldTime * 1.2 + i) * 0.12;
      ctx.beginPath();
      ctx.ellipse(x, s.y + 13 + (i % 2) * 8, 18 * pulse, 4.5 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLavaHazard(s, hazard) {
    drawLiquidWaves(s, hazard, 3.4, 3.1);
    ctx.fillStyle = hazard.accent;
    for (let i = 0; i < 8; i++) {
      const x = s.x + 35 + i * 104;
      const phase = (worldTime * (0.9 + i % 3 * 0.18) + i * 0.73) % 1;
      const radius = 2 + Math.sin(phase * Math.PI) * 4;
      ctx.globalAlpha = 0.42 + (1 - phase) * 0.35;
      ctx.beginPath();
      ctx.arc(x, s.y + s.h - phase * 20, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawIceWaterHazard(s, hazard) {
    drawLiquidWaves(s, hazard, 1.25, 1.6);
    ctx.fillStyle = hazard.accent;
    ctx.globalAlpha = 0.72;
    for (let x = s.x + 18; x < s.x + s.w - 12; x += 54) {
      ctx.beginPath();
      ctx.moveTo(x - 10, s.y + 3);
      ctx.lineTo(x, s.y + 13);
      ctx.lineTo(x + 13, s.y + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawToxicLiquidHazard(s, hazard) {
    drawLiquidWaves(s, hazard, 1.55, 2.4);
    ctx.strokeStyle = hazard.accent;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const x = s.x + 48 + i * 116;
      const phase = (worldTime * (0.35 + i % 2 * 0.12) + i * 0.61) % 1;
      const y = s.y + s.h - phase * 23;
      ctx.globalAlpha = 0.30 + (1 - phase) * 0.45;
      ctx.beginPath();
      ctx.arc(x, y, 3 + phase * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCrystalPitHazard(s, hazard) {
    fillHazardGradient(s, hazard);
    drawHazardBoundary(s, hazard, 4);
    const count = Math.max(10, Math.floor(s.w / 46));
    const step = s.w / count;
    for (let i = 0; i < count; i++) {
      const height = s.h - 2 + (i % 3) * 5;
      drawCrystalShape(
        s.x + step * (i + 0.5),
        s.y + s.h,
        step * 0.72,
        height,
        i % 2 ? hazard.accent : hazard.surface,
        i % 5 === 0
      );
    }
  }

  function drawAbyssHazard(s, hazard) {
    fillHazardGradient(s, hazard);
    drawHazardBoundary(s, hazard, 5);
    ctx.strokeStyle = hazard.accent;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const x = s.x + 20 + i * 71;
      ctx.beginPath();
      ctx.moveTo(x, s.y + 5);
      ctx.lineTo(x + Math.sin(worldTime * 0.45 + i) * 6, s.y + s.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawThornHazard(s, hazard) {
    fillHazardGradient(s, hazard);
    drawHazardBoundary(s, hazard, 4);
    ctx.fillStyle = hazard.accent;
    const count = Math.max(12, Math.floor(s.w / 34));
    const step = s.w / count;
    for (let i = 0; i < count; i++) {
      const left = s.x + i * step;
      const right = s.x + (i + 1) * step;
      ctx.beginPath();
      ctx.moveTo(left, s.y + s.h);
      ctx.lineTo((left + right) / 2, s.y + (i % 2) * 5);
      ctx.lineTo(right, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCloudAbyssHazard(s, hazard) {
    fillHazardGradient(s, hazard);
    drawHazardBoundary(s, hazard, 5);
    ctx.fillStyle = hazard.surface;
    ctx.globalAlpha = 0.86;
    for (let x = s.x + 20; x < s.x + s.w + 30; x += 58) {
      ctx.beginPath();
      ctx.ellipse(x, s.y + 10, 34, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = hazard.accent;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.w, s.y);
    ctx.stroke();
  }

  const DEATH_ZONE_RENDERERS = {
    spikes: drawSpikeHazard,
    water: drawWaterHazard,
    quicksand: drawQuicksandHazard,
    lava: drawLavaHazard,
    iceWater: drawIceWaterHazard,
    toxic: drawToxicLiquidHazard,
    crystalPit: drawCrystalPitHazard,
    abyss: drawAbyssHazard,
    thorns: drawThornHazard,
    cloudAbyss: drawCloudAbyssHazard
  };

  function drawDeathZone(rect, biome, biomeVisuals = null) {
    const renderer = DEATH_ZONE_RENDERERS[biome.hazard.type] || drawSpikeHazard;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const assetHazardDrawn = Boolean(
      biomeVisuals &&
      typeof biomeVisuals.drawBottomDeathHazard === "function" &&
      biomeVisuals.drawBottomDeathHazard(ctx, rect, worldTime)
    );
    if (!assetHazardDrawn) renderer(rect, biome.hazard);
    ctx.restore();
  }

