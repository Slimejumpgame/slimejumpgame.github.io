"use strict";

  const BOUNCE_MIN_HORIZONTAL_SPEED = 90;
  const BOUNCE_MIN_VERTICAL_SPEED = 300;
  const BOUNCE_MAX_VERTICAL_SPEED = 1050;
  const BOUNCE_FULL_IMPACT_SPEED = 900;

  function rememberPlayerHorizontalDirection() {
    // Kleine Physik-Restwerte sollen keine zuvor klare Richtung überschreiben.
    if (Math.abs(player.vx) >= BOUNCE_MIN_HORIZONTAL_SPEED * 0.1) {
      player.lastHorizontalDirection = Math.sign(player.vx);
    }
  }

  function applyBouncePadMinimumHorizontalSpeed() {
    if (Math.abs(player.vx) >= BOUNCE_MIN_HORIZONTAL_SPEED) return;

    player.vx = getBouncePadHorizontalSpeed(player.vx, player.lastHorizontalDirection);
    player.lastHorizontalDirection = Math.sign(player.vx);
  }

  function getBouncePadHorizontalSpeed(horizontalSpeed, lastDirection = 1) {
    if (Math.abs(horizontalSpeed) >= BOUNCE_MIN_HORIZONTAL_SPEED) {
      return horizontalSpeed;
    }

    const direction =
      horizontalSpeed > 0 ? 1 :
      horizontalSpeed < 0 ? -1 :
      lastDirection || 1;
    return direction * BOUNCE_MIN_HORIZONTAL_SPEED;
  }

  function getBouncePadVerticalSpeed(impactSpeed) {
    const impactRatio = clamp(
      Math.max(0, impactSpeed) / BOUNCE_FULL_IMPACT_SPEED,
      0,
      1
    );
    const smoothedImpact = impactRatio * impactRatio * (3 - 2 * impactRatio);
    const bounceStrength =
      BOUNCE_MIN_VERTICAL_SPEED +
      (BOUNCE_MAX_VERTICAL_SPEED - BOUNCE_MIN_VERTICAL_SPEED) * smoothedImpact;
    return Math.min(BOUNCE_MAX_VERTICAL_SPEED, bounceStrength);
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
      const isTopLanding = hit.ny < -0.6;
      const landingOnBouncePad = isTopLanding && currentLevel().pads.some(pad =>
        intersectsRect(player.x, player.y, player.r, pad)
      );
      const mudShoesActive =
        isTopLanding &&
        !landingOnBouncePad &&
        window.SlimePerks?.isActiveForRun?.("mud_shoes") === true;
      const hardLanding = isTopLanding && Math.abs(normalVelocity) > 360;
      let restitution = Math.abs(normalVelocity) > 360 ? 0.34 : 0.06;
      if (mudShoesActive) {
        restitution *= window.SlimePerks.balance.MUD_SHOES_REBOUND_MULTIPLIER;
      }
      player.vx -= (1 + restitution) * normalVelocity * hit.nx;
      player.vy -= (1 + restitution) * normalVelocity * hit.ny;

      if (isTopLanding) {
        player.onGround = true;
        if (rect.ice) {
          player.onIce = true;
          player.vx *= 0.9996;
        } else {
          player.vx *= 0.988;
        }

        // Moving Platforms und Conveyors behalten ihre etablierten Carry-Pfade.
        if (mudShoesActive && !rect.moving && !rect.conveyor) {
          player.vx *= window.SlimePerks.balance.MUD_SHOES_HORIZONTAL_DAMPING;
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

        if (hardLanding && !landingOnBouncePad) {
          registerQuickRecoveryHardLanding(rect);
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

  function getSpikeDangerRect(spike) {
    return {x: spike.x + 5, y: spike.y + 5, w: spike.w - 10, h: spike.h + 22};
  }

  function getBottomDeathHazard(level = currentLevel()) {
    return level?.spikes?.find(spike => spike.isBottomDeathHazard === true) || null;
  }

  function isPlayerTouchingBottomDeathHazard() {
    const hazard = getBottomDeathHazard();
    if (!hazard) return false;
    const danger = getSpikeDangerRect(hazard);
    const touchesDeathCollision = intersectsRect(
      player.x,
      player.y,
      player.r * 0.72,
      danger
    );
    const restsOnProtectedSurface =
      isLastBubbleProtectionActive() &&
      player.x + player.r > danger.x &&
      player.x - player.r < danger.x + danger.w &&
      Math.abs(player.y + player.r - danger.y) <= AIM_SUPPORT_TOLERANCE;
    return touchesDeathCollision || restsOnProtectedSurface;
  }

  function getSegmentRectEntryFraction(startX, startY, endX, endY, rect) {
    const dx = endX - startX;
    const dy = endY - startY;
    let entry = 0;
    let exit = 1;

    for (const [start, delta, min, max] of [
      [startX, dx, rect.x, rect.x + rect.w],
      [startY, dy, rect.y, rect.y + rect.h]
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (start < min || start > max) return null;
        continue;
      }
      const first = (min - start) / delta;
      const second = (max - start) / delta;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (entry > exit) return null;
    }

    return entry >= 0 && entry <= 1 ? entry : null;
  }

  function getSegmentCircleEntryFraction(startX, startY, endX, endY, circle) {
    const dx = endX - startX;
    const dy = endY - startY;
    const offsetX = startX - circle.x;
    const offsetY = startY - circle.y;
    const a = dx * dx + dy * dy;
    const c = offsetX * offsetX + offsetY * offsetY - circle.r * circle.r;
    if (c <= 0) return 0;
    if (a <= 1e-12) return null;

    const b = 2 * (offsetX * dx + offsetY * dy);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const entry = (-b - Math.sqrt(discriminant)) / (2 * a);
    return entry >= 0 && entry <= 1 ? entry : null;
  }

  // Exakter Sweep eines Kreises entlang eines Trajectory-Segments gegen die
  // Rechteckfläche. Die beiden Kantenbereiche plus vier Eckkreise bilden die
  // abgerundete Minkowski-Summe von Pad und Slime-Radius.
  function findFirstSweptCircleRectContact(
    startX,
    startY,
    endX,
    endY,
    radius,
    rect
  ) {
    if (intersectsRect(startX, startY, radius, rect)) {
      return {fraction: 0, x: startX, y: startY};
    }

    const candidates = [
      getSegmentRectEntryFraction(startX, startY, endX, endY, {
        x: rect.x,
        y: rect.y - radius,
        w: rect.w,
        h: rect.h + radius * 2
      }),
      getSegmentRectEntryFraction(startX, startY, endX, endY, {
        x: rect.x - radius,
        y: rect.y,
        w: rect.w + radius * 2,
        h: rect.h
      }),
      ...[
        [rect.x, rect.y],
        [rect.x + rect.w, rect.y],
        [rect.x, rect.y + rect.h],
        [rect.x + rect.w, rect.y + rect.h]
      ].map(([x, y]) => getSegmentCircleEntryFraction(
        startX,
        startY,
        endX,
        endY,
        {x, y, r: radius}
      ))
    ].filter(fraction => fraction !== null);

    if (candidates.length === 0) return null;
    const fraction = Math.min(...candidates);
    return {
      fraction,
      x: startX + (endX - startX) * fraction,
      y: startY + (endY - startY) * fraction
    };
  }

  function pullStarTowardPlayer(star, dt, pullRadius, pullSpeed) {
    if (
      !star ||
      !Number.isFinite(star.x) ||
      !Number.isFinite(star.y)
    ) return false;

    const dx = player.x - star.x;
    const dy = player.y - star.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0 || distance > pullRadius) {
      return false;
    }

    const maximumStep = Math.max(0, pullSpeed) * Math.max(0, dt);
    const step = Math.min(distance, maximumStep);
    if (step <= 0) return false;
    star.x += dx / distance * step;
    star.y += dy / distance * step;
    return true;
  }

  function applySlowFallDrag(verticalSpeed, dt) {
    const triggerSpeed = window.SlimePerks.balance.SLOW_FALL_TRIGGER_SPEED;
    if (verticalSpeed <= triggerSpeed) return verticalSpeed;

    const drag = window.SlimePerks.balance.SLOW_FALL_DRAG;
    const dragFactor = Math.exp(-Math.max(0, drag) * Math.max(0, dt));
    return triggerSpeed + (verticalSpeed - triggerSpeed) * dragFactor;
  }

  function update(dt) {
    if (state !== "playing") return;
    const wasOnGround = player.onGround;
    updateLastBubbleProtection(dt);
    updateQuickRecovery(dt);
    applyQuickRecoveryHorizontalDamping(dt);
    worldTime += dt;
    rememberPlayerHorizontalDirection();
    let aimingCarriedByMovingPlatform = false;
    let aimingCarriedByConveyor = false;
    if (!hasActiveStuckAimPositionLock()) {
      aimingCarriedByMovingPlatform = carryAimingPlayerWithMovingPlatform(dt);
      aimingCarriedByConveyor = carryAimingPlayerWithConveyor(dt);
    }
    updateFallingPlatforms(dt);
    updateFadePlatforms();
    updateSpikePlatforms();

    // Bleibt nur so lange eingefroren, wie die Plattform ihn wirklich trägt.
    // Moving Platforms und Conveyors wurden direkt davor bereits mitgeführt.
    if (
      aiming &&
      (
        (!stuckAimFallbackActive && !hasValidAimSupport()) ||
        (
          hasActiveVerticalMoverStuckAimFallback() &&
          !aimingCarriedByMovingPlatform
        )
      )
    ) {
      stopAiming();
    }

    if (aiming) {
      player.vx *= Math.pow(0.04, dt);
      player.vy *= Math.pow(0.04, dt);
    } else {
      player.vy += 1570 * dt;
      player.vx *= Math.pow(player.onIce ? 0.9998 : 0.998, dt * 60);
      player.vy *= Math.pow(0.999, dt * 60);
      if (
        window.SlimePerks?.isActiveForRun?.("slow_fall") === true &&
        player.vy > window.SlimePerks.balance.SLOW_FALL_TRIGGER_SPEED
      ) {
        player.vy = applySlowFallDrag(player.vy, dt);
      }
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

    if (carryGroundedPlayerWithHorizontalMovingPlatform(dt)) {
      for (let pass = 0; pass < 2; pass++) {
        for (const p of platforms) resolvePlatform(p);
      }
    }

    // Förderbänder tragen den Slime sichtbar nach links oder rechts. Beim Zielen
    // wandert der virtuelle Zeigepunkt mit, damit die eingestellte Schussrichtung
    // nicht ohne Fingerbewegung verfälscht wird.
    if (
      player.onGround &&
      player.conveyorSpeed !== 0 &&
      !aimingCarriedByConveyor &&
      !hasActiveStuckAimPositionLock()
    ) {
      const beltShift = player.conveyorSpeed * dt;
      player.x += beltShift;
      if (aiming) pointer.x += beltShift;

      for (let pass = 0; pass < 2; pass++) {
        for (const p of platforms) resolvePlatform(p);
      }
    }

    restoreStuckAimPosition();

    const level = currentLevel();
    const tracksRunProgress = !isTutorialStage();
    let bouncedOnPad = false;

    for (const pad of level.pads) {
      if (intersectsRect(player.x, player.y, player.r, pad) && bouncePadImpactSpeed > 0) {
        const impactSpeed = bouncePadImpactSpeed;
        player.vy = -getBouncePadVerticalSpeed(impactSpeed);
        applyBouncePadMinimumHorizontalSpeed();
        player.onGround = false;
        player.squish = 1;
        bouncedOnPad = true;
        tone(230, 0.13, "square", 0.045, 520);
        spawnBurst(player.x, player.y + player.r, 12, "#68ddff");
        if (tracksRunProgress) window.SlimeAchievements?.onBounce?.();
      }
    }

    applyStickySlimeGroundDamping(dt);
    updateSecondChanceSafeAnchor();

    updateAirHopFlightState(wasOnGround, player.onGround, bouncedOnPad);

    if (tracksRunProgress) {
      window.SlimeAchievements?.onFrame?.(dt, {grounded: player.onGround});
    }
    if (tracksRunProgress && !wasOnGround && player.onGround) {
      window.SlimeAchievements?.onLanding?.();
    }

    for (const spike of level.spikes) {
      const danger = getSpikeDangerRect(spike);
      if (intersectsRect(player.x, player.y, player.r * 0.72, danger)) {
        if (
          spike.isBottomDeathHazard === true &&
          tryHandleLastBubbleContact("bottom_death_hazard", spike)
        ) return;
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
        if (tryUseSecondChance("spike_platform")) return;
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
        if (tracksRunProgress) window.SlimeAchievements?.onGhostHit?.();
        const secondChanceReason = enemy.type === "fast" ? "fast_ghost" : "ghost";
        if (tryUseSecondChance(secondChanceReason)) return;
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

    const starMagnetActive = window.SlimePerks?.isActiveForRun?.("star_magnet") === true;
    const starCollectionRadius = player.r + 25;
    level.stars.forEach((s, i) => {
      if (collected[i] || !s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return;
      if (starMagnetActive) {
        pullStarTowardPlayer(
          s,
          dt,
          window.SlimePerks.balance.STAR_MAGNET_PULL_RADIUS,
          window.SlimePerks.balance.STAR_MAGNET_PULL_SPEED
        );
      }
      if (
        Math.hypot(player.x - s.x, player.y - s.y) < starCollectionRadius
      ) {
        collected[i] = true;
        if (tracksRunProgress) {
          registerRunStarCollected();
          awardRunScore(250);
        }
        playStar();
        spawnBurst(s.x, s.y, 18, "#ffe877");
        updateHUD();
      }
    });

    if (intersectsRect(player.x, player.y, player.r * 0.75, level.goal)) finishLevel();

    if (player.y > BOTTOM_DEATH_THRESHOLD) {
      if (tryHandleLastBubbleContact("bottom_out")) return;
      loseLife();
      return;
    }
    if (player.x < -180 || player.x > W + 180) {
      if (tryUseSecondChance("side_out")) return;
      loseLife();
      return;
    }

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

