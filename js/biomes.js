"use strict";

  const BIOMES = [
    {
      id: "meadow",
      name: "Wiese",
      background: {
        gradient: [[0, "#68b8de"], [0.62, "#a9d8e8"], [1, "#cadcae"]],
        renderer: "meadow",
        layers: ["clouds", "farHills", "nearHills"]
      },
      platform: {body: "#72523d", top: "#579f50", detail: "earth", detailColor: "#4f3a2d"},
      hazard: {type: "spikes", fill: "#d9e8ef", stroke: "#8297a6"},
      decor: {cloud: "rgba(255,255,255,0.72)", far: "#477d50", near: "#315f3c"}
    },
    {
      id: "coast",
      name: "Küste / Ozean",
      background: {
        gradient: [[0, "#68caff"], [0.55, "#c9f0ff"], [1, "#5cb7d5"]],
        renderer: "coast",
        layers: ["clouds", "islands", "ocean"]
      },
      platform: {body: "#99734e", top: "#f0cf78", detail: "sand", detailColor: "#6e513a"},
      hazard: {type: "water", fill: "#1475aa", deep: "#073f70", surface: "#78e5ff", accent: "#d8fbff"},
      decor: {cloud: "rgba(255,255,255,0.76)", ocean: "#278fbe", island: "#4d8a59"}
    },
    {
      id: "desert",
      name: "Wüste",
      background: {
        gradient: [[0, "#ca856b"], [0.55, "#e5c09a"], [1, "#bd9376"]],
        renderer: "desert",
        layers: ["sun", "farDunes", "nearDunes", "rocks"]
      },
      platform: {body: "#b86f3f", top: "#f1c46d", detail: "sandstone", detailColor: "#7f472f"},
      hazard: {type: "quicksand", fill: "#bd7138", deep: "#754126", surface: "#f0b657", accent: "#ffd98b"},
      decor: {sun: "#ffe29a", far: "#bd9470", near: "#936b55", rock: "#6f574b"}
    },
    {
      id: "volcano",
      name: "Vulkan",
      background: {
        gradient: [[0, "#3b1724"], [0.6, "#69262a"], [1, "#17151d"]],
        renderer: "volcano",
        layers: ["darkMountains", "volcano", "smoke", "embers"]
      },
      platform: {body: "#292a31", top: "#a94736", detail: "basalt", detailColor: "#e05a38"},
      hazard: {type: "lava", fill: "#d9341f", deep: "#681515", surface: "#ffb22e", accent: "#fff08a"},
      decor: {mountain: "#241b24", volcano: "#342027", smoke: "#7b6268", ember: "#ff7b39"}
    },
    {
      id: "snow",
      name: "Schneewelt",
      background: {
        gradient: [[0, "#8fccef"], [0.58, "#dff4ff"], [1, "#b8cfdd"]],
        renderer: "snow",
        layers: ["haze", "snowMountains", "snowflakes"]
      },
      platform: {body: "#647887", top: "#f7fdff", detail: "snowRock", detailColor: "#c5e7f2"},
      hazard: {type: "iceWater", fill: "#286b91", deep: "#12374f", surface: "#d9fbff", accent: "#8eeaff"},
      decor: {mountain: "#7995a9", snow: "#edfaff", haze: "rgba(235,250,255,0.24)"}
    },
    {
      id: "swamp",
      name: "Sumpf",
      background: {
        gradient: [[0, "#40594b"], [0.58, "#65745b"], [1, "#25342b"]],
        renderer: "swamp",
        layers: ["fog", "crookedTrees", "moor"]
      },
      platform: {body: "#45372e", top: "#66864a", detail: "moss", detailColor: "#283f2a"},
      hazard: {type: "toxic", fill: "#548c2f", deep: "#203d24", surface: "#a8e94e", accent: "#d7ff74"},
      decor: {fog: "rgba(205,225,191,0.13)", tree: "#253329", moor: "#314433"}
    },
    {
      id: "crystalCave",
      name: "Kristallhöhle",
      background: {
        gradient: [[0, "#15152e"], [0.58, "#25204a"], [1, "#090b1d"]],
        renderer: "crystalCave",
        layers: ["caveWalls", "crystalClusters", "glow"]
      },
      platform: {body: "#343458", top: "#7467aa", detail: "crystal", detailColor: "#69d8ff"},
      hazard: {type: "crystalPit", fill: "#090b1b", deep: "#03040b", surface: "#674d9c", accent: "#65e4ff"},
      decor: {wall: "#17162d", crystalA: "#6ce8ff", crystalB: "#aa70ff"}
    },
    {
      id: "night",
      name: "Nachtwelt",
      background: {
        gradient: [[0, "#06132f"], [0.6, "#172957"], [1, "#080d21"]],
        renderer: "night",
        layers: ["stars", "moon", "nightHills"]
      },
      platform: {body: "#29294c", top: "#686da0", detail: "nightStone", detailColor: "#9fa9d9"},
      hazard: {type: "abyss", fill: "#050713", deep: "#000106", surface: "#5c68a0", accent: "#aebeff"},
      decor: {moon: "#f4f1cf", star: "#d9e6ff", far: "#111a37", near: "#090f25"}
    },
    {
      id: "autumn",
      name: "Herbstwald",
      background: {
        gradient: [[0, "#ed8248"], [0.58, "#cf563b"], [1, "#542b31"]],
        renderer: "autumn",
        layers: ["forest", "foliage", "fallingLeaves"]
      },
      platform: {body: "#684333", top: "#d8892f", detail: "autumnEarth", detailColor: "#4a2b26"},
      hazard: {type: "thorns", fill: "#2b251f", deep: "#171411", surface: "#70452e", accent: "#b35d32"},
      decor: {trunk: "#432d2a", leafA: "#d95632", leafB: "#f0a338", ground: "#492c2d"}
    },
    {
      id: "sky",
      name: "Himmelswelt",
      background: {
        gradient: [[0, "#74cdf8"], [0.62, "#dff8ff"], [1, "#bce8f5"]],
        renderer: "sky",
        layers: ["largeClouds", "floatingIslands", "atmosphere"]
      },
      platform: {body: "#bbc5cc", top: "#f8ffff", detail: "skyStone", detailColor: "#8fa7b5"},
      hazard: {type: "cloudAbyss", fill: "#dff8ff", deep: "#82bfdc", surface: "#ffffff", accent: "#a9e8ff"},
      decor: {cloud: "rgba(255,255,255,0.88)", island: "#718c91", grass: "#d8fff1"}
    }
  ];

  function getBiomeForLevel(levelNumber) {
    const normalizedLevel = Math.max(1, Math.floor(Number(levelNumber) || 1));
    const biomeIndex = Math.floor((normalizedLevel - 1) / 10) % BIOMES.length;
    return BIOMES[biomeIndex];
  }

  function drawCloud(x, y, scale, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 54 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 30 * scale, y + 4 * scale, 31 * scale, 17 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 34 * scale, y + 5 * scale, 38 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 7 * scale, y - 15 * scale, 29 * scale, 25 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRollingLayer(baseY, amplitude, segmentWidth, color, offset = 0) {
    const wrappedOffset = ((offset % segmentWidth) + segmentWidth) % segmentWidth;
    const startX = -segmentWidth - wrappedOffset;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(startX, H);
    ctx.lineTo(startX, baseY);
    for (let x = startX; x < W + segmentWidth; x += segmentWidth) {
      ctx.quadraticCurveTo(
        x + segmentWidth * 0.5,
        baseY - amplitude,
        x + segmentWidth,
        baseY
      );
    }
    ctx.lineTo(W + segmentWidth, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawMountain(x, baseY, width, height, color, snowColor = null) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, baseY);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width / 2, baseY);
    ctx.closePath();
    ctx.fill();

    if (snowColor) {
      ctx.fillStyle = snowColor;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.13, baseY - height * 0.74);
      ctx.lineTo(x, baseY - height);
      ctx.lineTo(x + width * 0.15, baseY - height * 0.70);
      ctx.lineTo(x + width * 0.06, baseY - height * 0.72);
      ctx.lineTo(x, baseY - height * 0.64);
      ctx.lineTo(x - width * 0.055, baseY - height * 0.73);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCrystalShape(x, baseY, width, height, color, glow = false) {
    ctx.save();
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, baseY);
    ctx.lineTo(x - width * 0.28, baseY - height * 0.72);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width * 0.30, baseY - height * 0.68);
    ctx.lineTo(x + width / 2, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHangingCrystalShape(x, ceilingY, width, height, color, glow = false) {
    ctx.save();
    ctx.translate(x, ceilingY);
    ctx.scale(1, -1);
    drawCrystalShape(0, 0, width, height, color, glow);
    ctx.restore();
  }

  function drawMeadowBackground(biome) {
    for (let i = 0; i < 4; i++) {
      const x = ((120 + i * 355 + levelIndex * 19) % (W + 260)) - 130;
      drawCloud(x, 105 + (i % 2) * 75, 0.72 + (i % 3) * 0.13, biome.decor.cloud);
    }
    drawRollingLayer(585, 105, 360, biome.decor.far, levelIndex * 17);
    drawRollingLayer(665, 145, 430, biome.decor.near, 110 + levelIndex * 11);
  }

  function drawCoastBackground(biome) {
    drawCloud(175, 125, 0.72, biome.decor.cloud);
    drawCloud(1015, 92, 0.88, biome.decor.cloud);

    const sea = ctx.createLinearGradient(0, 375, 0, H);
    sea.addColorStop(0, "#54c7e7");
    sea.addColorStop(1, biome.decor.ocean);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 375, W, H - 375);
    ctx.fillStyle = "rgba(228,251,255,0.75)";
    ctx.fillRect(0, 375, W, 5);

    for (let i = 0; i < 3; i++) {
      const x = 240 + i * 405;
      ctx.fillStyle = "#806c50";
      ctx.beginPath();
      ctx.ellipse(x, 430 + (i % 2) * 28, 102, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = biome.decor.island;
      ctx.beginPath();
      ctx.ellipse(x, 417 + (i % 2) * 28, 78, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(220,250,255,0.32)";
    ctx.lineWidth = 3;
    for (let row = 0; row < 5; row++) {
      const y = 475 + row * 43;
      ctx.beginPath();
      for (let x = -30; x <= W + 30; x += 35) {
        const waveY = y + Math.sin(x * 0.025 + worldTime * 0.65 + row) * 3;
        x === -30 ? ctx.moveTo(x, waveY) : ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }
  }

  function drawDesertBackground(biome) {
    ctx.fillStyle = biome.decor.sun;
    ctx.shadowColor = "rgba(255,220,135,0.65)";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(1040, 135, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawRollingLayer(530, 82, 430, biome.decor.far, 90 + levelIndex * 13);
    drawRollingLayer(645, 118, 520, biome.decor.near, levelIndex * 9);

    ctx.fillStyle = biome.decor.rock;
    for (let i = 0; i < 5; i++) {
      const x = 95 + i * 278;
      const y = 570 + (i % 2) * 38;
      ctx.beginPath();
      ctx.moveTo(x - 30, y + 28);
      ctx.lineTo(x - 15, y - 9);
      ctx.lineTo(x + 17, y - 24);
      ctx.lineTo(x + 38, y + 28);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawVolcanoBackground(biome) {
    for (let i = 0; i < 6; i++) {
      drawMountain(i * 260 - 40, 650, 360, 180 + (i % 2) * 70, biome.decor.mountain);
    }

    ctx.fillStyle = biome.decor.volcano;
    ctx.beginPath();
    ctx.moveTo(350, 650);
    ctx.lineTo(545, 330);
    ctx.lineTo(620, 300);
    ctx.lineTo(700, 330);
    ctx.lineTo(930, 650);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,101,55,0.68)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(557, 329);
    ctx.quadraticCurveTo(620, 360, 690, 329);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const rise = (worldTime * (10 + i) + i * 43) % 210;
      const x = 620 + Math.sin(worldTime * 0.35 + i * 1.7) * (18 + i * 5);
      const y = 300 - rise;
      ctx.globalAlpha = 0.24 - i * 0.018;
      ctx.fillStyle = biome.decor.smoke;
      ctx.beginPath();
      ctx.arc(x, y, 22 + i * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = biome.decor.ember;
    for (let i = 0; i < 10; i++) {
      const x = (i * 139 + levelIndex * 31) % W;
      const y = 650 - ((worldTime * (18 + i % 3 * 5) + i * 67) % 520);
      ctx.globalAlpha = 0.35 + (i % 3) * 0.18;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSnowBackground(biome) {
    ctx.fillStyle = biome.decor.haze;
    ctx.fillRect(0, 260, W, 300);
    for (let i = 0; i < 7; i++) {
      drawMountain(
        i * 220 - 25,
        650,
        340,
        210 + (i % 3) * 55,
        biome.decor.mountain,
        biome.decor.snow
      );
    }
    ctx.fillStyle = biome.decor.snow;
    for (let i = 0; i < 14; i++) {
      const x = (i * 101 + levelIndex * 37) % W;
      const y = (i * 79 + worldTime * (7 + i % 3 * 2)) % 590;
      ctx.globalAlpha = 0.36 + (i % 4) * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCrookedTree(x, baseY, scale, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 14 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x - 18 * scale, baseY - 90 * scale, x + 8 * scale, baseY - 175 * scale);
    ctx.quadraticCurveTo(x + 24 * scale, baseY - 215 * scale, x + 5 * scale, baseY - 250 * scale);
    ctx.moveTo(x, baseY - 130 * scale);
    ctx.quadraticCurveTo(x - 58 * scale, baseY - 168 * scale, x - 76 * scale, baseY - 205 * scale);
    ctx.moveTo(x + 5 * scale, baseY - 176 * scale);
    ctx.quadraticCurveTo(x + 54 * scale, baseY - 190 * scale, x + 73 * scale, baseY - 226 * scale);
    ctx.stroke();
  }

  function drawSwampBackground(biome) {
    drawRollingLayer(645, 68, 330, biome.decor.moor, levelIndex * 8);
    for (let i = 0; i < 7; i++) {
      drawCrookedTree(55 + i * 205, 640, 0.68 + (i % 3) * 0.12, biome.decor.tree);
    }
    ctx.fillStyle = biome.decor.fog;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 310 + worldTime * (4 + i)) % (W + 440)) - 220;
      const y = 250 + i * 72;
      ctx.beginPath();
      ctx.ellipse(x, y, 260, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrystalCaveBackground(biome) {
    ctx.fillStyle = biome.decor.wall;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 74);
    for (let x = W; x >= 0; x -= 105) {
      ctx.lineTo(x, 56 + ((x / 105) % 3) * 32);
    }
    ctx.lineTo(0, 0);
    ctx.fill();

    ctx.fillStyle = "rgba(7,7,20,0.44)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(115, 0);
    ctx.lineTo(76, 190);
    ctx.lineTo(128, 360);
    ctx.lineTo(58, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W - 105, 0);
    ctx.lineTo(W - 72, 220);
    ctx.lineTo(W - 126, 390);
    ctx.lineTo(W - 54, H);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const x = 58 + i * 106;
      const ceilingY = 56 + (i % 3) * 14;
      const height = 48 + (i % 4) * 16;
      const color = i % 2 ? biome.decor.crystalA : biome.decor.crystalB;
      drawHangingCrystalShape(
        x,
        ceilingY,
        20 + (i % 3) * 5,
        height,
        color,
        i % 3 === 0
      );
    }
  }

  function drawNightBackground(biome) {
    ctx.fillStyle = biome.decor.star;
    for (let i = 0; i < 42; i++) {
      const x = (i * 173 + levelIndex * 47) % W;
      const y = 32 + (i * 91) % 410;
      ctx.globalAlpha = 0.34 + ((i * 7) % 5) * 0.13;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = biome.decor.moon;
    ctx.shadowColor = "rgba(224,235,255,0.38)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(1040, 145, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(120,135,160,0.18)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(1010 + i * 21, 128 + (i % 2) * 27, 7 + (i % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawRollingLayer(585, 110, 390, biome.decor.far, 80);
    drawRollingLayer(665, 150, 470, biome.decor.near, 220);
  }

  function drawAutumnBackground(biome) {
    drawRollingLayer(650, 80, 330, biome.decor.ground, levelIndex * 12);
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 205;
      const baseY = 640;
      const height = 180 + (i % 3) * 28;
      ctx.strokeStyle = biome.decor.trunk;
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + (i % 2 ? 14 : -12), baseY - height);
      ctx.stroke();
      ctx.fillStyle = i % 2 ? biome.decor.leafA : biome.decor.leafB;
      for (let n = 0; n < 4; n++) {
        ctx.beginPath();
        ctx.arc(x - 48 + n * 32, baseY - height + (n % 2) * 20, 38, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < 11; i++) {
      const x = (i * 127 + levelIndex * 23 + worldTime * (7 + i % 3)) % (W + 40) - 20;
      const y = (i * 83 + worldTime * (18 + i % 4 * 3)) % 610;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(worldTime * 0.7 + i);
      ctx.fillStyle = i % 2 ? biome.decor.leafA : biome.decor.leafB;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSkyBackground(biome) {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, 250, W, 220);
    for (let i = 0; i < 8; i++) {
      const x = ((i * 210 + levelIndex * 15) % (W + 300)) - 150;
      const y = 90 + (i % 4) * 130;
      drawCloud(x, y, 0.85 + (i % 3) * 0.23, biome.decor.cloud);
    }

    for (let i = 0; i < 4; i++) {
      const x = 165 + i * 325;
      const y = 390 + (i % 2) * 120;
      ctx.fillStyle = biome.decor.island;
      ctx.beginPath();
      ctx.moveTo(x - 72, y);
      ctx.quadraticCurveTo(x, y + 28, x + 72, y);
      ctx.lineTo(x + 30, y + 82);
      ctx.lineTo(x, y + 108);
      ctx.lineTo(x - 34, y + 76);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = biome.decor.grass;
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 76, 19, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const BACKGROUND_RENDERERS = {
    meadow: drawMeadowBackground,
    coast: drawCoastBackground,
    desert: drawDesertBackground,
    volcano: drawVolcanoBackground,
    snow: drawSnowBackground,
    swamp: drawSwampBackground,
    crystalCave: drawCrystalCaveBackground,
    night: drawNightBackground,
    autumn: drawAutumnBackground,
    sky: drawSkyBackground
  };

  function drawBackground(biome) {
    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    for (const [offset, color] of biome.background.gradient) {
      gradient.addColorStop(offset, color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const renderer = BACKGROUND_RENDERERS[biome.background.renderer];
    if (renderer) renderer(biome);
    ctx.restore();
  }

