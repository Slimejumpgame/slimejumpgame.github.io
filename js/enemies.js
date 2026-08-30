"use strict";

  const GHOST_IMAGE_SOURCE_SIZE = 256;
  const GHOST_VISUAL_SCALE = 1.08;
  const GHOST_VISUALS = Object.freeze({
    normal: Object.freeze({
      assetPath: "assets/enemies/ghost_normal.png",
      alphaBounds: Object.freeze({x: 9, y: 8, w: 235, h: 248}),
      glow: "#b46cff",
      colors: Object.freeze({
        body: "#d9bcff",
        stroke: "#6d359e",
        horns: "#8a45bd",
        face: "#281238",
        eyes: "#ff5f79"
      })
    }),
    fast: Object.freeze({
      assetPath: "assets/enemies/ghost_fast.png",
      alphaBounds: Object.freeze({x: 6, y: 0, w: 244, h: 239}),
      glow: "#ff552f",
      colors: Object.freeze({
        body: "#ff9a5c",
        stroke: "#9c321f",
        horns: "#c94725",
        face: "#3a1711",
        eyes: "#ffe06a"
      })
    })
  });
  const ghostImages = {};
  for (const [type, visual] of Object.entries(GHOST_VISUALS)) {
    const image = new Image();
    image.decoding = "async";
    image.src = visual.assetPath;
    ghostImages[type] = image;
  }

  function getEnemyMotionTheta(enemy) {
    return worldTime * enemy.speed + enemy.phase;
  }

  function getEnemies() {
    return currentLevel().enemies.map(enemy => {
      const offset = Math.sin(getEnemyMotionTheta(enemy)) * enemy.range;
      return {
        ...enemy,
        x: enemy.x + (enemy.axis === "x" ? offset : 0),
        y: enemy.y + (enemy.axis === "y" ? offset : 0)
      };
    });
  }

  function getGhostFacingScaleX(enemy) {
    if (enemy.axis === "x") {
      // Both source images face left. Positive cosine means the existing sine
      // path is currently moving right, so only the visual is mirrored.
      return Math.cos(getEnemyMotionTheta(enemy)) > 0 ? -1 : 1;
    }
    // A vertical ghost faces the player; exact X equality has a stable left default.
    return player.x > enemy.x ? -1 : 1;
  }

  function getGhostImageDrawContract(enemy, visual) {
    const bounds = visual.alphaBounds;
    const maximumVisibleExtent = Math.max(bounds.w, bounds.h);
    const drawSize =
      (enemy.r * 2 + 4) * GHOST_IMAGE_SOURCE_SIZE / maximumVisibleExtent *
      GHOST_VISUAL_SCALE;
    const scale = drawSize / GHOST_IMAGE_SOURCE_SIZE;
    return {
      drawSize,
      offsetX: -(bounds.x + bounds.w / 2 - GHOST_IMAGE_SOURCE_SIZE / 2) * scale,
      offsetY: -(bounds.y + bounds.h / 2 - GHOST_IMAGE_SOURCE_SIZE / 2) * scale
    };
  }

  function drawCanvasGhostFallback(r, colors) {
    // Both variants use exactly the same ghost shape.
    ctx.fillStyle = colors.body;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.72);
    ctx.lineTo(-r, -r * 0.05);
    ctx.quadraticCurveTo(-r, -r, 0, -r);
    ctx.quadraticCurveTo(r, -r, r, -r * 0.05);
    ctx.lineTo(r, r * 0.72);
    ctx.lineTo(r * 0.55, r * 0.42);
    ctx.lineTo(r * 0.2, r * 0.76);
    ctx.lineTo(-r * 0.15, r * 0.42);
    ctx.lineTo(-r * 0.52, r * 0.76);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Small horns.
    ctx.fillStyle = colors.horns;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.72);
    ctx.lineTo(-r * 0.82, -r * 1.15);
    ctx.lineTo(-r * 0.22, -r * 0.9);
    ctx.moveTo(r * 0.55, -r * 0.72);
    ctx.lineTo(r * 0.82, -r * 1.15);
    ctx.lineTo(r * 0.22, -r * 0.9);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = colors.face;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // Angry, slanted eyes.
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.25);
    ctx.lineTo(-r * 0.16, -r * 0.08);
    ctx.moveTo(r * 0.55, -r * 0.25);
    ctx.lineTo(r * 0.16, -r * 0.08);
    ctx.stroke();

    ctx.fillStyle = colors.eyes;
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.02, 3.8, 0, Math.PI * 2);
    ctx.arc(r * 0.28, -r * 0.02, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.face;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, r * 0.29, r * 0.3, Math.PI + 0.22, Math.PI * 2 - 0.22);
    ctx.stroke();
  }

  function drawEnemies() {
    for (const enemy of getEnemies()) {
      const isFast = enemy.type === "fast";
      const bobSpeed = isFast ? 6.2 : 4.2;
      const bob = Math.sin(worldTime * bobSpeed + enemy.phase) * 3;
      const r = enemy.r;
      const type = isFast ? "fast" : "normal";
      const visual = GHOST_VISUALS[type];
      const image = ghostImages[type];

      ctx.save();
      ctx.translate(enemy.x, enemy.y + bob);
      ctx.scale(getGhostFacingScaleX(enemy), 1);
      ctx.shadowColor = visual.glow;
      ctx.shadowBlur = 20;
      if (
        (
          typeof isFairyTaleGraphicsMode !== "function" ||
          isFairyTaleGraphicsMode()
        ) &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
      ) {
        const draw = getGhostImageDrawContract(enemy, visual);
        ctx.drawImage(
          image,
          -draw.drawSize / 2 + draw.offsetX,
          -draw.drawSize / 2 + draw.offsetY,
          draw.drawSize,
          draw.drawSize
        );
      } else {
        drawCanvasGhostFallback(r, visual.colors);
      }
      ctx.restore();
    }
  }
