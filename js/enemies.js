"use strict";

  function getEnemies() {
    return currentLevel().enemies.map(enemy => {
      const offset = Math.sin(worldTime * enemy.speed + enemy.phase) * enemy.range;
      return {
        ...enemy,
        x: enemy.x + (enemy.axis === "x" ? offset : 0),
        y: enemy.y + (enemy.axis === "y" ? offset : 0)
      };
    });
  }

  function drawEnemies() {
    for (const enemy of getEnemies()) {
      const isFast = enemy.type === "fast";
      const bobSpeed = isFast ? 6.2 : 4.2;
      const bob = Math.sin(worldTime * bobSpeed + enemy.phase) * 3;
      const r = enemy.r;

      const colors = isFast
        ? {
            glow: "#ff552f",
            body: "#ff9a5c",
            stroke: "#9c321f",
            horns: "#c94725",
            face: "#3a1711",
            eyes: "#ffe06a"
          }
        : {
            glow: "#b46cff",
            body: "#d9bcff",
            stroke: "#6d359e",
            horns: "#8a45bd",
            face: "#281238",
            eyes: "#ff5f79"
          };

      ctx.save();
      ctx.translate(enemy.x, enemy.y + bob);
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 20;

      // Beide Varianten verwenden exakt dieselbe Geisterform.
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

      // Kleine Hörner.
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

      // Böse, schräg stehende Augen.
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
      ctx.restore();
    }
  }

