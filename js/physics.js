"use strict";

  const BOUNCE_MIN_HORIZONTAL_SPEED = 90;

  function rememberPlayerHorizontalDirection() {
    // Kleine Physik-Restwerte sollen keine zuvor klare Richtung überschreiben.
    if (Math.abs(player.vx) >= BOUNCE_MIN_HORIZONTAL_SPEED * 0.1) {
      player.lastHorizontalDirection = Math.sign(player.vx);
    }
  }

  function applyBouncePadMinimumHorizontalSpeed() {
    if (Math.abs(player.vx) >= BOUNCE_MIN_HORIZONTAL_SPEED) return;

    const direction =
      player.vx > 0 ? 1 :
      player.vx < 0 ? -1 :
      player.lastHorizontalDirection || 1;

    player.vx = direction * BOUNCE_MIN_HORIZONTAL_SPEED;
    player.lastHorizontalDirection = direction;
  }

  function circleRectCollision(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    let dx = circle.x - closestX;
    let dy = circle.y - closestY;
    let distSq = dx * dx + dy * dy;

    if (distSq >= circle.r * circle.r) return null;

    if (distSq === 0) {
      const left = Math.abs(circle.x - rect.x);
      const right = Math.abs(rect.x + rect.w - circle.x);
      const top = Math.abs(circle.y - rect.y);
      const bottom = Math.abs(rect.y + rect.h - circle.y);
      const min = Math.min(left, right, top, bottom);
      if (min === left) { dx = -1; dy = 0; }
      else if (min === right) { dx = 1; dy = 0; }
      else if (min === top) { dx = 0; dy = -1; }
      else { dx = 0; dy = 1; }
      return {nx: dx, ny: dy, penetration: circle.r};
    }

    const dist = Math.sqrt(distSq);
    return {
      nx: dx / dist,
      ny: dy / dist,
      penetration: circle.r - dist
    };
  }

  function resolvePlatform(rect) {
    if (rect.fade && !rect.fadeData.solid) return;
    const hit = circleRectCollision(player, rect);
    if (!hit) return;
    player.x += hit.nx * hit.penetration;
    player.y += hit.ny * hit.penetration;

    const normalVelocity = player.vx * hit.nx + player.vy * hit.ny;
    if (normalVelocity < 0) {
      const restitution = Math.abs(normalVelocity) > 360 ? 0.34 : 0.06;
      player.vx -= (1 + restitution) * normalVelocity * hit.nx;
      player.vy -= (1 + restitution) * normalVelocity * hit.ny;

      if (hit.ny < -0.6) {
        player.onGround = true;
        if (rect.ice) {
          player.onIce = true;
          player.vx *= 0.9996;
        } else {
          player.vx *= 0.988;
        }

        if (rect.conveyor) {
          player.conveyorSpeed = rect.conveyorSpeed;
        }

        if (rect.fallingPlatform && !rect.fallingPlatform.triggered) {
          rect.fallingPlatform.triggered = true;
          rect.fallingPlatform.timer = rect.fallingPlatform.delay;
          tone(115, 0.15, "square", 0.04, 70);
          spawnBurst(
            rect.x + rect.w / 2,
            rect.y + 4,
            8,
            "#ffb069"
          );
        }

        if (Math.abs(normalVelocity) > 220) {
          player.squish = Math.min(1, Math.abs(normalVelocity) / 750);
          playBounce();
        }

        // Ein deutlich zurückprallender Slime löst sich bereits wieder von
        // der Plattform und darf deshalb nicht als geerdet gelten.
        if (restitution > 0.06) player.onGround = false;
      }
    }
  }

  function intersectsRect(x, y, r, rect) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
  }

  function update(dt) {
    if (state !== "playing") return;
    worldTime += dt;
    rememberPlayerHorizontalDirection();
    carryAimingPlayerWithMovingPlatform(dt);
    const aimingCarriedByConveyor = carryAimingPlayerWithConveyor(dt);
    updateFallingPlatforms(dt);
    updateFadePlatforms();
    updateSpikePlatforms();

    // Bleibt nur so lange eingefroren, wie die Plattform ihn wirklich trägt.
    // Moving Platforms und Conveyors wurden direkt davor bereits mitgeführt.
    if (aiming && !stuckAimFallbackActive && !hasValidAimSupport()) stopAiming();

    if (aiming) {
      player.vx *= Math.pow(0.04, dt);
      player.vy *= Math.pow(0.04, dt);
    } else {
      player.vy += 1570 * dt;
      player.vx *= Math.pow(player.onIce ? 0.9998 : 0.998, dt * 60);
      player.vy *= Math.pow(0.999, dt * 60);
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }

    const bouncePadImpactSpeed = Math.max(0, player.vy);
    player.onGround = false;
    player.onIce = false;
    player.conveyorSpeed = 0;
    const platforms = getPlatforms();
    for (let pass = 0; pass < 3; pass++) {
      for (const p of platforms) resolvePlatform(p);
    }

    // Förderbänder tragen den Slime sichtbar nach links oder rechts. Beim Zielen
    // wandert der virtuelle Zeigepunkt mit, damit die eingestellte Schussrichtung
    // nicht ohne Fingerbewegung verfälscht wird.
    if (player.onGround && player.conveyorSpeed !== 0 && !aimingCarriedByConveyor) {
      const beltShift = player.conveyorSpeed * dt;
      player.x += beltShift;
      if (aiming) pointer.x += beltShift;

      for (let pass = 0; pass < 2; pass++) {
        for (const p of platforms) resolvePlatform(p);
      }
    }

    const level = currentLevel();

    for (const pad of level.pads) {
      if (intersectsRect(player.x, player.y, player.r, pad) && bouncePadImpactSpeed > 0) {
        const impactSpeed = bouncePadImpactSpeed;
        const minimumBounce = 300;
        const maximumBounce = 1050;
        const impactRatio = clamp(impactSpeed / 900, 0, 1);
        const smoothedImpact = impactRatio * impactRatio * (3 - 2 * impactRatio);
        const bounceStrength = minimumBounce + (maximumBounce - minimumBounce) * smoothedImpact;
        player.vy = -Math.min(maximumBounce, bounceStrength);
        applyBouncePadMinimumHorizontalSpeed();
        player.onGround = false;
        player.squish = 1;
        tone(230, 0.13, "square", 0.045, 520);
        spawnBurst(player.x, player.y + player.r, 12, "#68ddff");
      }
    }

    for (const spike of level.spikes) {
      const danger = {x: spike.x + 5, y: spike.y + 5, w: spike.w - 10, h: spike.h + 22};
      if (intersectsRect(player.x, player.y, player.r * 0.72, danger)) {
        loseLife();
        return;
      }
    }

    for (const platform of level.spikePlatforms) {
      if (!platform.dangerous) continue;
      const spikeHeight = 25 * platform.extension;
      const danger = {
        x: platform.x + 5,
        y: platform.y - spikeHeight + 1,
        w: Math.max(0, platform.w - 10),
        h: spikeHeight + 7
      };
      if (intersectsRect(player.x, player.y, player.r * 0.70, danger)) {
        spawnBurst(player.x, player.y, 12, "#ff7d63");
        loseLife();
        return;
      }
    }

    for (const enemy of getEnemies()) {
      if (
        Math.hypot(player.x - enemy.x, player.y - enemy.y) <
        player.r * 0.74 + enemy.r * 0.82
      ) {
        spawnBurst(
          enemy.x,
          enemy.y,
          15,
          enemy.type === "fast" ? "#ff7045" : "#c790ff"
        );
        loseLife();
        return;
      }
    }

    level.stars.forEach((s, i) => {
      if (!collected[i] && Math.hypot(player.x - s.x, player.y - s.y) < player.r + 25) {
        collected[i] = true;
        score += 250;
        playStar();
        spawnBurst(s.x, s.y, 18, "#ffe877");
        updateHUD();
      }
    });

    if (intersectsRect(player.x, player.y, player.r * 0.75, level.goal)) finishLevel();

    if (player.y > H + 140 || player.x < -180 || player.x > W + 180) loseLife();

    updateStuckAimTimer(dt);
    player.squish = Math.max(0, player.squish - dt * 3.7);
    player.trail.unshift({x: player.x, y: player.y});
    if (player.trail.length > 12) player.trail.pop();

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    shake *= Math.pow(0.04, dt);
  }

