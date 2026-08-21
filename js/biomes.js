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
    },
    {
      id: "stormNight",
      name: "Gewitternacht",
      background: {
        gradient: [[0, "#07101e"], [0.58, "#182636"], [1, "#05080e"]],
        renderer: "stormNight",
        layers: ["stormClouds", "distantCliffs", "rain", "distantLightning"],
        motionElements: 11
      },
      platform: {body: "#202936", top: "#526b7e", detail: "nightStone", detailColor: "#8aa1b4"},
      hazard: {type: "abyss", fill: "#07101a", deep: "#010306", surface: "#304b61", accent: "#6d93ad"},
      decor: {cloud: "#101927", cliff: "#090f17", rain: "rgba(151,184,207,0.34)", lightning: "#7896b8"}
    },
    {
      id: "neonCity",
      name: "Neon City",
      background: {
        gradient: [[0, "#050817"], [0.60, "#14102f"], [1, "#03050d"]],
        renderer: "neonCity",
        layers: ["farSkyline", "nearSkyline", "neonSigns", "scanLines"],
        motionElements: 8
      },
      platform: {body: "#161b2c", top: "#26788a", detail: "nightStone", detailColor: "#e14fc2"},
      hazard: {type: "abyss", fill: "#07091a", deep: "#010208", surface: "#24485e", accent: "#e14fc2"},
      decor: {far: "#0b1022", mid: "#10152a", near: "#090d1b", cyan: "#39d5e6", magenta: "#e14fc2", window: "#5d7894"}
    },
    {
      id: "mushroomCave",
      name: "Pilzh\u00f6hle",
      background: {
        gradient: [[0, "#0d0920"], [0.58, "#211438"], [1, "#070711"]],
        renderer: "mushroomCave",
        layers: ["organicCave", "giantMushrooms", "glowingCaps", "spores"],
        motionElements: 12
      },
      platform: {body: "#30243e", top: "#67507d", detail: "moss", detailColor: "#55b9a9"},
      hazard: {type: "toxic", fill: "#25133f", deep: "#080711", surface: "#4f867e", accent: "#78dec7"},
      decor: {cave: "#0b0817", mushroom: "#2f2148", stalk: "#504361", glowA: "#60d9c4", glowB: "#a56fe0", spore: "#8de9d5"}
    },
    {
      id: "abandonedMine",
      name: "Verlassene Mine",
      background: {
        gradient: [[0, "#100d0b"], [0.58, "#29201a"], [1, "#070605"]],
        renderer: "abandonedMine",
        layers: ["rockWalls", "timberSupports", "rails", "lanterns", "dust"],
        motionElements: 10
      },
      platform: {body: "#3a3028", top: "#745a3d", detail: "earth", detailColor: "#211b17"},
      hazard: {type: "quicksand", fill: "#211b17", deep: "#060504", surface: "#514030", accent: "#85684a"},
      decor: {wall: "#171310", rock: "#24201c", wood: "#4b3627", rail: "#343033", lantern: "#d79b52", dust: "#a48c72"}
    },
    {
      id: "bambooNight",
      name: "Bambusnacht",
      background: {
        gradient: [[0, "#06131a"], [0.58, "#102a29"], [1, "#04090a"]],
        renderer: "bambooNight",
        layers: ["moonHaze", "bambooLayers", "bambooLeaves", "lowFog"],
        motionElements: 9
      },
      platform: {body: "#25372f", top: "#58775a", detail: "moss", detailColor: "#17271f"},
      hazard: {type: "cloudAbyss", fill: "#101b1c", deep: "#030607", surface: "#3f5d59", accent: "#6d8f83"},
      decor: {far: "#122c2a", mid: "#0d211f", near: "#071311", leaf: "#66866a", moon: "#8ca9a1", fog: "rgba(118,151,143,0.09)"}
    },
    {
      id: "pirateHarbor",
      name: "Piratenhafen bei Nacht",
      background: {
        gradient: [[0, "#06101d"], [0.56, "#13293a"], [1, "#03070b"]],
        renderer: "pirateHarbor",
        layers: ["nightSea", "harbor", "pirateShip", "lanterns", "waterReflections"],
        motionElements: 8
      },
      platform: {body: "#3a2b24", top: "#765443", detail: "earth", detailColor: "#201714"},
      hazard: {type: "water", fill: "#0a2c3d", deep: "#02070c", surface: "#315f72", accent: "#b77b4a"},
      decor: {sea: "#071e2a", ship: "#16171b", wood: "#493329", sail: "#252630", lantern: "#d79a55", reflection: "#7b694f"}
    },
    {
      id: "alienJungle",
      name: "Alien-Dschungel",
      background: {
        gradient: [[0, "#080d19"], [0.58, "#162236"], [1, "#04070b"]],
        renderer: "alienJungle",
        layers: ["alienCanopy", "strangePlants", "glowingNodes", "alienSpores"],
        motionElements: 12
      },
      platform: {body: "#253039", top: "#426b61", detail: "moss", detailColor: "#7b4e9d"},
      hazard: {type: "toxic", fill: "#162337", deep: "#03060a", surface: "#396f67", accent: "#9b65c4"},
      decor: {canopy: "#0a1119", plant: "#152b2b", cyan: "#58cfc0", violet: "#9a62c1", green: "#77b563", spore: "#85d8c9"}
    },
    {
      id: "enchantedGarden",
      name: "Verzauberter Nachtgarten",
      background: {
        gradient: [[0, "#0a0d24"], [0.58, "#201737"], [1, "#05060e"]],
        renderer: "enchantedGarden",
        layers: ["gardenSilhouettes", "moonlitFlowers", "fireflies", "magicGlow"],
        motionElements: 13
      },
      platform: {body: "#29253d", top: "#5e567a", detail: "autumnEarth", detailColor: "#8d72a7"},
      hazard: {type: "cloudAbyss", fill: "#141126", deep: "#03040a", surface: "#4c416c", accent: "#8b78b4"},
      decor: {plant: "#10172a", leaf: "#1e2f38", flower: "#a985d0", gold: "#d3bf72", firefly: "#d9dd84"}
    },
    {
      id: "redMoon",
      name: "Rote Mondnacht",
      background: {
        gradient: [[0, "#08080d"], [0.60, "#201318"], [1, "#030305"]],
        renderer: "redMoon",
        layers: ["redMoon", "driftingClouds", "barrenSilhouettes"],
        motionElements: 5
      },
      platform: {body: "#292329", top: "#684047", detail: "nightStone", detailColor: "#9c5960"},
      hazard: {type: "abyss", fill: "#13080b", deep: "#020102", surface: "#54272d", accent: "#913d43"},
      decor: {moon: "#9e3438", cloud: "rgba(18,14,18,0.84)", far: "#130e12", near: "#080608", branch: "#0b080a"}
    },
    {
      id: "undergroundTemple",
      name: "Unterirdische Tempelruinen",
      background: {
        gradient: [[0, "#0b0e0f"], [0.58, "#202625"], [1, "#050606"]],
        renderer: "undergroundTemple",
        layers: ["stoneVault", "brokenArches", "columns", "runes", "dust"],
        motionElements: 11
      },
      platform: {body: "#353a35", top: "#626b5d", detail: "sandstone", detailColor: "#20241f"},
      hazard: {type: "abyss", fill: "#0c1010", deep: "#020303", surface: "#39433e", accent: "#718477"},
      decor: {stone: "#181d1b", darkStone: "#0d1110", moss: "#344238", rune: "#718e80", dust: "#92988f"}
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

  function wrapBiomeMotion(value, range) {
    return ((value % range) + range) % range;
  }

  function drawStormNightBackground(biome) {
    drawCloud(175, 105, 1.35, biome.decor.cloud);
    drawCloud(590, 72, 1.58, biome.decor.cloud);
    drawCloud(1035, 125, 1.42, biome.decor.cloud);

    ctx.fillStyle = biome.decor.cliff;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, 310);
    ctx.lineTo(105, 335);
    ctx.lineTo(168, 425);
    ctx.lineTo(245, 470);
    ctx.lineTo(302, H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, H);
    ctx.lineTo(W, 285);
    ctx.lineTo(W - 112, 328);
    ctx.lineTo(W - 186, 438);
    ctx.lineTo(W - 278, 478);
    ctx.lineTo(W - 330, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = biome.decor.rain;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const x = wrapBiomeMotion(i * 151 + levelIndex * 29 - worldTime * (33 + i % 3 * 4), W + 100) - 50;
      const y = wrapBiomeMotion(i * 83 + worldTime * (92 + i % 2 * 11), 650) - 25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 10, y + 22);
      ctx.stroke();
    }

    const lightningPhase = wrapBiomeMotion(worldTime + levelIndex * 0.37, 12);
    if (lightningPhase < 0.18) {
      const pulse = Math.sin(lightningPhase / 0.18 * Math.PI);
      ctx.globalAlpha = 0.08 + pulse * 0.12;
      ctx.fillStyle = biome.decor.lightning;
      ctx.beginPath();
      ctx.ellipse(1005, 165, 180, 86, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.16 + pulse * 0.20;
      ctx.strokeStyle = biome.decor.lightning;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(1018, 150);
      ctx.lineTo(993, 205);
      ctx.lineTo(1012, 201);
      ctx.lineTo(982, 265);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawNeonCityBackground(biome) {
    const skylineLayers = [
      {baseY: 535, width: 92, color: biome.decor.far, count: 15, height: 145},
      {baseY: 620, width: 116, color: biome.decor.mid, count: 12, height: 215},
      {baseY: 700, width: 154, color: biome.decor.near, count: 10, height: 275}
    ];
    for (let layer = 0; layer < skylineLayers.length; layer++) {
      const config = skylineLayers[layer];
      ctx.fillStyle = config.color;
      for (let i = 0; i < config.count; i++) {
        const x = i * config.width - (layer * 47) % config.width;
        const height = config.height + ((i * 53 + layer * 31) % 125);
        ctx.fillRect(x, config.baseY - height, config.width - 12, height);
        if (layer < 2 && i % 2 === 0) {
          ctx.fillStyle = biome.decor.window;
          ctx.globalAlpha = 0.24;
          ctx.fillRect(x + 17, config.baseY - height + 28, 8, 5);
          ctx.fillRect(x + 43, config.baseY - height + 55, 8, 5);
          ctx.globalAlpha = 1;
          ctx.fillStyle = config.color;
        }
      }
    }

    ctx.strokeStyle = "rgba(57,213,230,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 176);
    ctx.bezierCurveTo(330, 230, 820, 116, W, 202);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const x = 105 + i * 205;
      const y = 250 + (i % 3) * 74;
      const pulse = 0.40 + Math.sin(worldTime * 0.75 + i * 1.4) * 0.10;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = i % 2 ? biome.decor.cyan : biome.decor.magenta;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 47 + (i % 2) * 14, 20);
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < 2; i++) {
      const y = wrapBiomeMotion(worldTime * (13 + i * 3) + i * 335, H + 80) - 40;
      ctx.fillStyle = i ? "rgba(225,79,194,0.045)" : "rgba(57,213,230,0.045)";
      ctx.fillRect(0, y, W, 2);
    }
  }

  function drawMushroomShape(x, baseY, scale, stalkColor, capColor, glowAlpha = 0) {
    ctx.save();
    if (glowAlpha > 0) {
      ctx.shadowColor = capColor;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = glowAlpha;
    }
    ctx.fillStyle = stalkColor;
    ctx.beginPath();
    ctx.moveTo(x - 12 * scale, baseY);
    ctx.quadraticCurveTo(x - 5 * scale, baseY - 58 * scale, x - 9 * scale, baseY - 91 * scale);
    ctx.lineTo(x + 9 * scale, baseY - 91 * scale);
    ctx.quadraticCurveTo(x + 4 * scale, baseY - 55 * scale, x + 13 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.moveTo(x - 48 * scale, baseY - 83 * scale);
    ctx.quadraticCurveTo(x, baseY - 139 * scale, x + 48 * scale, baseY - 83 * scale);
    ctx.quadraticCurveTo(x, baseY - 69 * scale, x - 48 * scale, baseY - 83 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMushroomCaveBackground(biome) {
    ctx.fillStyle = biome.decor.cave;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 110) {
      ctx.lineTo(x, 48 + ((x / 110) % 4) * 18);
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(118, 0);
    ctx.quadraticCurveTo(72, 190, 122, 335);
    ctx.quadraticCurveTo(55, 520, 92, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W - 115, 0);
    ctx.quadraticCurveTo(W - 68, 185, W - 124, 350);
    ctx.quadraticCurveTo(W - 52, 520, W - 88, H);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    drawRollingLayer(675, 68, 325, biome.decor.mushroom, levelIndex * 7);
    drawMushroomShape(150, 640, 1.35, biome.decor.stalk, biome.decor.mushroom);
    drawMushroomShape(1125, 620, 1.55, biome.decor.stalk, biome.decor.mushroom);
    drawMushroomShape(310, 585, 0.70, biome.decor.stalk, biome.decor.glowA, 0.28 + Math.sin(worldTime * 0.62) * 0.05);
    drawMushroomShape(965, 555, 0.62, biome.decor.stalk, biome.decor.glowB, 0.27 + Math.sin(worldTime * 0.58 + 2) * 0.05);
    drawMushroomShape(705, 635, 0.48, biome.decor.stalk, biome.decor.glowA, 0.25 + Math.sin(worldTime * 0.54 + 4) * 0.04);

    ctx.fillStyle = biome.decor.spore;
    for (let i = 0; i < 9; i++) {
      const x = wrapBiomeMotion(i * 163 + levelIndex * 31 + Math.sin(worldTime * 0.42 + i) * 17, W);
      const y = 610 - wrapBiomeMotion(i * 71 + worldTime * (6 + i % 3), 560);
      ctx.globalAlpha = 0.20 + (i % 3) * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawAbandonedMineBackground(biome) {
    ctx.fillStyle = biome.decor.wall;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 94) {
      ctx.lineTo(x, 64 + ((x / 94) % 3) * 25);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = biome.decor.rock;
    for (let i = 0; i < 9; i++) {
      const x = 38 + i * 153;
      const y = 105 + (i % 3) * 76;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.ellipse(x, y, 48 + (i % 2) * 17, 23, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = biome.decor.wood;
    ctx.lineWidth = 19;
    ctx.lineCap = "butt";
    for (let i = 0; i < 5; i++) {
      const x = 105 + i * 274;
      ctx.beginPath();
      ctx.moveTo(x, 620);
      ctx.lineTo(x, 145 + (i % 2) * 34);
      ctx.moveTo(x - 34, 180 + (i % 2) * 34);
      ctx.lineTo(x + 222, 180 + (i % 2) * 34);
      ctx.stroke();
    }

    ctx.strokeStyle = biome.decor.rail;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 616);
    ctx.lineTo(W, 616);
    ctx.moveTo(0, 651);
    ctx.lineTo(W, 651);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (let x = 15; x < W; x += 62) {
      ctx.beginPath();
      ctx.moveTo(x, 605);
      ctx.lineTo(x + 17, 661);
      ctx.stroke();
    }

    ctx.fillStyle = "#171517";
    ctx.fillRect(842, 540, 120, 66);
    ctx.beginPath();
    ctx.moveTo(830, 540);
    ctx.lineTo(974, 540);
    ctx.lineTo(952, 502);
    ctx.lineTo(850, 502);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 2; i++) {
      const x = 330 + i * 620;
      const flicker = 0.42 + Math.sin(worldTime * 2.1 + i * 2.7) * 0.04;
      ctx.fillStyle = biome.decor.lantern;
      ctx.globalAlpha = flicker;
      ctx.shadowColor = biome.decor.lantern;
      ctx.shadowBlur = 10;
      ctx.fillRect(x - 8, 225, 16, 23);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = biome.decor.dust;
    for (let i = 0; i < 8; i++) {
      const x = wrapBiomeMotion(i * 179 + levelIndex * 17 + worldTime * (3 + i % 2), W);
      const y = 120 + wrapBiomeMotion(i * 67 + worldTime * (4 + i % 3), 430);
      ctx.globalAlpha = 0.12 + (i % 3) * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBambooNightBackground(biome) {
    ctx.fillStyle = biome.decor.moon;
    ctx.globalAlpha = 0.20;
    ctx.beginPath();
    ctx.arc(1050, 135, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const bambooLayers = [
      {count: 12, spacing: 118, width: 10, color: biome.decor.far, height: 410},
      {count: 10, spacing: 142, width: 16, color: biome.decor.mid, height: 520},
      {count: 8, spacing: 190, width: 22, color: biome.decor.near, height: 610}
    ];
    for (let layer = 0; layer < bambooLayers.length; layer++) {
      const config = bambooLayers[layer];
      ctx.strokeStyle = config.color;
      ctx.lineWidth = config.width;
      for (let i = 0; i < config.count; i++) {
        const x = i * config.spacing + layer * 37 - 35;
        const top = H - config.height + (i % 3) * 42;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + (i % 2 ? 22 : -18), top);
        ctx.stroke();
        for (let y = H - 105; y > top + 30; y -= 92) {
          ctx.beginPath();
          ctx.moveTo(x - 14, y);
          ctx.lineTo(x + 15, y - 3);
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < 8; i++) {
      const x = wrapBiomeMotion(i * 171 + levelIndex * 19 + Math.sin(worldTime * 0.5 + i) * 28, W + 40) - 20;
      const y = wrapBiomeMotion(i * 89 + worldTime * (12 + i % 3 * 2), 620);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.65 + Math.sin(worldTime * 0.45 + i) * 0.3);
      ctx.fillStyle = biome.decor.leaf;
      ctx.globalAlpha = 0.30 + (i % 3) * 0.09;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const fogX = wrapBiomeMotion(worldTime * 5 + levelIndex * 23, W + 600) - 300;
    ctx.fillStyle = biome.decor.fog;
    ctx.beginPath();
    ctx.ellipse(fogX, 560, 360, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPirateHarborBackground(biome) {
    const seaGradient = ctx.createLinearGradient(0, 410, 0, H);
    seaGradient.addColorStop(0, "#102f3e");
    seaGradient.addColorStop(1, biome.decor.sea);
    ctx.fillStyle = seaGradient;
    ctx.fillRect(0, 410, W, H - 410);

    ctx.strokeStyle = "rgba(91,131,145,0.20)";
    ctx.lineWidth = 2.5;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 32) {
        const y = 455 + row * 68 + Math.sin(x * 0.026 + worldTime * 0.48 + row) * 2.5;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = biome.decor.wood;
    ctx.fillRect(0, 385, 390, 28);
    for (let x = 42; x < 390; x += 92) ctx.fillRect(x, 385, 15, 235);

    ctx.fillStyle = biome.decor.ship;
    ctx.beginPath();
    ctx.moveTo(675, 458);
    ctx.quadraticCurveTo(842, 530, 1048, 455);
    ctx.lineTo(1002, 530);
    ctx.quadraticCurveTo(835, 580, 700, 514);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = biome.decor.ship;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(838, 455);
    ctx.lineTo(838, 150);
    ctx.moveTo(703, 454);
    ctx.lineTo(703, 248);
    ctx.stroke();

    ctx.fillStyle = biome.decor.sail;
    ctx.beginPath();
    ctx.moveTo(828, 177);
    ctx.lineTo(828, 348);
    ctx.lineTo(706, 317);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(849, 194);
    ctx.lineTo(849, 365);
    ctx.lineTo(992, 331);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 2; i++) {
      const x = i ? 895 : 255;
      const y = i ? 405 : 354;
      const flicker = 0.44 + Math.sin(worldTime * 1.45 + i * 2.2) * 0.05;
      ctx.fillStyle = biome.decor.lantern;
      ctx.globalAlpha = flicker;
      ctx.shadowColor = biome.decor.lantern;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = biome.decor.reflection;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const baseX = 155 + i * 188;
      const shift = Math.sin(worldTime * 0.72 + i) * 12;
      const y = 485 + (i % 3) * 62;
      ctx.globalAlpha = 0.17 + (i % 2) * 0.07;
      ctx.beginPath();
      ctx.moveTo(baseX + shift - 18, y);
      ctx.lineTo(baseX + shift + 22, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawAlienPlant(x, baseY, scale, color, direction = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 11 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.bezierCurveTo(
      x + 55 * scale * direction,
      baseY - 70 * scale,
      x - 35 * scale * direction,
      baseY - 145 * scale,
      x + 18 * scale * direction,
      baseY - 215 * scale
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 4 * scale * direction, baseY - 88 * scale);
    ctx.quadraticCurveTo(
      x + 65 * scale * direction,
      baseY - 112 * scale,
      x + 83 * scale * direction,
      baseY - 157 * scale
    );
    ctx.stroke();
  }

  function drawAlienJungleBackground(biome) {
    ctx.fillStyle = biome.decor.canopy;
    for (let i = 0; i < 9; i++) {
      const x = 35 + i * 158;
      ctx.beginPath();
      ctx.ellipse(x, 28 + (i % 3) * 34, 112, 66, 0.15 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
      ctx.fill();
    }
    drawRollingLayer(680, 88, 310, biome.decor.plant, levelIndex * 9);
    for (let i = 0; i < 7; i++) {
      const direction = i % 2 ? 1 : -1;
      drawAlienPlant(48 + i * 205, 675, 0.68 + (i % 3) * 0.13, biome.decor.plant, direction);
    }

    const nodePositions = [[92, 395], [394, 330], [895, 365], [1170, 300]];
    for (let i = 0; i < nodePositions.length; i++) {
      const [x, y] = nodePositions[i];
      const pulse = 0.32 + Math.sin(worldTime * 0.65 + i * 1.6) * 0.06;
      ctx.fillStyle = i % 2 ? biome.decor.cyan : biome.decor.violet;
      ctx.globalAlpha = pulse;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 7, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = biome.decor.spore;
    for (let i = 0; i < 8; i++) {
      const x = wrapBiomeMotion(i * 177 + levelIndex * 41 + Math.sin(worldTime * 0.36 + i) * 22, W);
      const y = 610 - wrapBiomeMotion(i * 73 + worldTime * (5 + i % 3), 555);
      ctx.globalAlpha = 0.18 + (i % 3) * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEnchantedGardenBackground(biome) {
    drawRollingLayer(675, 90, 345, biome.decor.plant, levelIndex * 8);
    ctx.strokeStyle = biome.decor.leaf;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const x = 25 + i * 182;
      const height = 130 + (i % 3) * 47;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, 680);
      ctx.quadraticCurveTo(x + (i % 2 ? 38 : -38), 650 - height * 0.45, x + (i % 2 ? -8 : 8), 680 - height);
      ctx.stroke();
      ctx.fillStyle = biome.decor.leaf;
      for (let leaf = 0; leaf < 3; leaf++) {
        ctx.beginPath();
        ctx.ellipse(
          x + (leaf % 2 ? 24 : -19),
          635 - leaf * 35 - (i % 3) * 8,
          18,
          7,
          leaf % 2 ? 0.45 : -0.45,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    const flowers = [[205, 536], [650, 570], [1085, 515]];
    for (let i = 0; i < flowers.length; i++) {
      const [x, y] = flowers[i];
      const pulse = 0.34 + Math.sin(worldTime * 0.55 + i * 2) * 0.05;
      ctx.fillStyle = i === 1 ? biome.decor.gold : biome.decor.flower;
      ctx.globalAlpha = pulse;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 9;
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 0.4;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(angle) * 9, y + Math.sin(angle) * 9, 7, 4, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = biome.decor.firefly;
    for (let i = 0; i < 10; i++) {
      const x = wrapBiomeMotion(i * 139 + levelIndex * 27 + Math.sin(worldTime * 0.48 + i) * 26, W);
      const y = 90 + wrapBiomeMotion(i * 67 + Math.sin(worldTime * 0.41 + i * 0.9) * 23, 470);
      ctx.globalAlpha = 0.25 + Math.sin(worldTime * 0.9 + i) * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRedMoonBackground(biome) {
    const moonPulse = 0.72 + Math.sin(worldTime * 0.22) * 0.035;
    ctx.fillStyle = biome.decor.moon;
    ctx.globalAlpha = moonPulse;
    ctx.shadowColor = "rgba(158,52,56,0.38)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(1000, 150, 112, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(50,18,22,0.28)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(952 + i * 25, 122 + (i % 2) * 43, 10 + (i % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 4; i++) {
      const x = wrapBiomeMotion(i * 380 + worldTime * (3 + i), W + 420) - 210;
      drawCloud(x, 105 + (i % 3) * 82, 1.10 + (i % 2) * 0.22, biome.decor.cloud);
    }

    drawRollingLayer(610, 108, 390, biome.decor.far, 115);
    drawRollingLayer(690, 145, 480, biome.decor.near, 255);
    drawCrookedTree(95, 665, 0.95, biome.decor.branch);
    drawCrookedTree(1210, 675, 1.08, biome.decor.branch);
    drawCrookedTree(355, 680, 0.63, biome.decor.branch);
  }

  function drawUndergroundTempleBackground(biome) {
    ctx.fillStyle = biome.decor.darkStone;
    ctx.fillRect(0, 0, W, 76);
    for (let x = 0; x < W; x += 92) {
      ctx.fillRect(x, 70 + (x / 92 % 2) * 16, 70, 28);
    }

    ctx.strokeStyle = biome.decor.stone;
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.arc(258, 620, 215, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1025, 640, 240, Math.PI, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 5; i++) {
      const x = 70 + i * 285;
      const top = 205 + (i % 2) * 42;
      ctx.fillStyle = biome.decor.stone;
      ctx.fillRect(x, top, 58, H - top);
      ctx.fillRect(x - 18, top, 94, 24);
      ctx.fillRect(x - 12, 590, 82, 28);
      ctx.fillStyle = biome.decor.moss;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + 7, top + 28, 9, 95 + (i % 3) * 20);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = biome.decor.darkStone;
    for (let i = 0; i < 6; i++) {
      const width = 340 - i * 42;
      ctx.fillRect(W / 2 - width / 2, 615 - i * 23, width, 23);
    }

    const runes = [[210, 305], [640, 240], [1060, 340]];
    for (let i = 0; i < runes.length; i++) {
      const [x, y] = runes[i];
      ctx.strokeStyle = biome.decor.rune;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.22 + Math.sin(worldTime * 0.48 + i * 1.9) * 0.04;
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x - 11, y + 15);
      ctx.lineTo(x + 13, y + 5);
      ctx.lineTo(x - 8, y - 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = biome.decor.dust;
    for (let i = 0; i < 8; i++) {
      const x = wrapBiomeMotion(i * 167 + levelIndex * 29 + worldTime * (2 + i % 3), W);
      const y = 105 + wrapBiomeMotion(i * 71 + worldTime * (3 + i % 2), 470);
      ctx.globalAlpha = 0.10 + (i % 3) * 0.045;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    sky: drawSkyBackground,
    stormNight: drawStormNightBackground,
    neonCity: drawNeonCityBackground,
    mushroomCave: drawMushroomCaveBackground,
    abandonedMine: drawAbandonedMineBackground,
    bambooNight: drawBambooNightBackground,
    pirateHarbor: drawPirateHarborBackground,
    alienJungle: drawAlienJungleBackground,
    enchantedGarden: drawEnchantedGardenBackground,
    redMoon: drawRedMoonBackground,
    undergroundTemple: drawUndergroundTempleBackground
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

