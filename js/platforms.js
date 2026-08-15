"use strict";

  function getPlatforms() {
    const level = currentLevel();
    const moving = level.movers.map(m => {
      const offset = Math.sin(worldTime * m.speed + m.phase) * m.range;
      return {
        x: m.x + (m.axis === "x" ? offset : 0),
        y: m.y + (m.axis === "y" ? offset : 0),
        w: m.w, h: m.h, moving: true, movingData: m
      };
    });

    const falling = level.fallingPlatforms
      .filter(platform => !platform.removed)
      .map(platform => ({
        x: platform.x,
        y: platform.currentY,
        w: platform.w,
        h: platform.h,
        fragile: true,
        fallingPlatform: platform
      }));

    const conveyorPlatforms = level.conveyors.map(conveyor => ({
      x: conveyor.x,
      y: conveyor.y,
      w: conveyor.w,
      h: conveyor.h,
      conveyor: true,
      conveyorSpeed: conveyor.direction * conveyor.beltSpeed,
      conveyorData: conveyor
    }));

    const fading = level.fadePlatforms.map(platform => ({
      x: platform.x,
      y: platform.y,
      w: platform.w,
      h: platform.h,
      fade: true,
      fadeData: platform
    }));

    const ice = level.icePlatforms.map(platform => ({
      x: platform.x,
      y: platform.y,
      w: platform.w,
      h: platform.h,
      ice: true,
      iceData: platform
    }));

    const spikeRoutePlatforms = level.spikePlatforms.map(platform => ({
      x: platform.x,
      y: platform.y,
      w: platform.w,
      h: platform.h,
      spikePlatform: true,
      spikeData: platform
    }));

    const lastBubbleSupports = getActiveLastBubbleSupportPlatforms();

    return level.platforms.concat(
      moving,
      falling,
      conveyorPlatforms,
      fading,
      ice,
      spikeRoutePlatforms,
      lastBubbleSupports
    );
  }

  function updateFallingPlatforms(dt) {
    for (const platform of currentLevel().fallingPlatforms) {
      if (!platform.triggered || platform.removed) continue;

      if (!platform.falling) {
        platform.timer -= dt;
        if (platform.timer <= 0) {
          platform.falling = true;
          platform.vy = 35;

          // Wer zu lange zielt, verliert den Halt und fällt mit der Plattform.
          const standingOnPlatform =
            player.x + player.r > platform.x &&
            player.x - player.r < platform.x + platform.w &&
            Math.abs(player.y + player.r - platform.currentY) < 24;

          const usingFallingPlatformRescue =
            stuckAimFallbackActive &&
            stuckAimFallbackFallingPlatform === platform;

          if (aiming && (standingOnPlatform || usingFallingPlatformRescue)) {
            stopAiming();
          }
        }
      } else {
        platform.vy += 1055.7 * dt;
        platform.currentY += platform.vy * dt;
        if (platform.currentY > H + 180) platform.removed = true;
      }
    }
  }

  function updateFadePlatforms() {
    for (const platform of currentLevel().fadePlatforms) {
      const elapsed = Math.max(0, worldTime - platform.startTime);
      const wave = (Math.cos(elapsed * platform.speed + platform.phase) + 1) * 0.5;
      platform.opacity = 0.06 + wave * 0.94;

      const wasSolid = platform.solid;
      if (platform.solid && platform.opacity <= 0.30) {
        platform.solid = false;
      } else if (!platform.solid && platform.opacity >= 0.40) {
        platform.solid = true;
      }

      // Verschwindet die Plattform unter einem zielenden Slime, wird das Zielen
      // gelöst, damit die Schwerkraft ihn sofort wieder übernimmt.
      if (wasSolid && !platform.solid) {
        const standingOnPlatform =
          player.x + player.r > platform.x &&
          player.x - player.r < platform.x + platform.w &&
          Math.abs(player.y + player.r - platform.y) < 24;
        if (aiming && standingOnPlatform) {
          aiming = false;
          drag.x = 0;
          drag.y = 0;
          canvas.classList.remove("aiming");
        }
      }
    }
  }

  function updateSpikePlatforms() {
    for (const platform of currentLevel().spikePlatforms) {
      const elapsed = Math.max(0, worldTime - platform.startTime) + platform.phaseOffset;
      const t = elapsed % platform.cycle;
      const warningDuration = 0.62;
      const extendDuration = 0.28;
      const dangerDuration = 1.08;
      const retractDuration = 0.30;
      const safeDuration = Math.max(
        1.5,
        platform.cycle - warningDuration - extendDuration - dangerDuration - retractDuration
      );

      const warningEnd = safeDuration + warningDuration;
      const extendEnd = warningEnd + extendDuration;
      const dangerEnd = extendEnd + dangerDuration;
      const retractEnd = dangerEnd + retractDuration;

      platform.warning = t >= safeDuration && t < extendEnd;

      if (t < warningEnd || t >= retractEnd) {
        platform.extension = 0;
      } else if (t < extendEnd) {
        platform.extension = (t - warningEnd) / extendDuration;
      } else if (t < dangerEnd) {
        platform.extension = 1;
      } else {
        platform.extension = 1 - (t - dangerEnd) / retractDuration;
      }

      platform.extension = clamp(platform.extension, 0, 1);
      platform.dangerous = platform.extension >= 0.52;
    }
  }

  function carryAimingPlayerWithMovingPlatform(dt) {
    if (!aiming || dt <= 0) return false;

    const level = currentLevel();
    const previousTime = worldTime - dt;

    for (const mover of level.movers) {
      const previousOffset = Math.sin(previousTime * mover.speed + mover.phase) * mover.range;
      const currentOffset = Math.sin(worldTime * mover.speed + mover.phase) * mover.range;

      const previousX = mover.x + (mover.axis === "x" ? previousOffset : 0);
      const previousY = mover.y + (mover.axis === "y" ? previousOffset : 0);
      const currentX = mover.x + (mover.axis === "x" ? currentOffset : 0);
      const currentY = mover.y + (mover.axis === "y" ? currentOffset : 0);

      // Beim Zielen wird die normale Physik bewusst angehalten. Deshalb muss
      // eine bewegliche Plattform den Slime währenddessen aktiv mitnehmen,
      // sonst würde eine nach unten/seitlich fahrende Plattform unter ihm
      // wegfahren und der Slime scheinbar in der Luft stehen bleiben.
      const standingOnMover =
        player.x + player.r > previousX + 2 &&
        player.x - player.r < previousX + mover.w - 2 &&
        Math.abs(player.y + player.r - previousY) < 28;

      if (!standingOnMover) continue;

      const shiftX = currentX - previousX;
      const shiftY = currentY - previousY;

      player.x += shiftX;
      player.y += shiftY;

      // Der Zielvektor soll relativ zum Slime unverändert bleiben, solange
      // nur die Plattform selbst den Slime bewegt.
      pointer.x += shiftX;
      pointer.y += shiftY;
      return true;
    }

    return false;
  }

  function carryGroundedPlayerWithHorizontalMovingPlatform(dt) {
    if (aiming || dt <= 0 || !player.onGround) return false;

    const level = currentLevel();
    const previousTime = worldTime - dt;

    for (const mover of level.movers) {
      if (mover.axis !== "x") continue;

      const previousOffset = Math.sin(previousTime * mover.speed + mover.phase) * mover.range;
      const currentOffset = Math.sin(worldTime * mover.speed + mover.phase) * mover.range;
      const previousX = mover.x + previousOffset;
      const currentX = mover.x + currentOffset;

      const standingOnMover =
        player.x + player.r > currentX + 2 &&
        player.x - player.r < currentX + mover.w - 2 &&
        Math.abs(player.y + player.r - mover.y) <= 4;

      if (!standingOnMover) continue;

      const shiftX = currentX - previousX;
      player.x += shiftX;
      return shiftX !== 0;
    }

    return false;
  }

  function carryAimingPlayerWithConveyor(dt) {
    if (!aiming || dt <= 0) return false;

    const level = currentLevel();

    for (const conveyor of level.conveyors) {
      // Während des Zielens ist die normale Physik nahezu eingefroren. Deshalb
      // darf das Förderband nicht davon abhängen, dass in genau diesem Frame
      // erneut eine Kollisionspenetration erkannt wird. Solange der Slime
      // sichtbar auf dem Band steht, wird er direkt mit der Bandoberfläche
      // mitgenommen – genauso wie beim Fix für bewegliche Plattformen.
      const standingOnConveyor =
        player.x + player.r > conveyor.x + 2 &&
        player.x - player.r < conveyor.x + conveyor.w - 2 &&
        Math.abs(player.y + player.r - conveyor.y) < 28;

      if (!standingOnConveyor) continue;

      const beltShift = conveyor.direction * conveyor.beltSpeed * dt;
      player.x += beltShift;

      // Zielrichtung und eingestellte Stärke bleiben relativ zum Slime gleich,
      // obwohl das Förderband ihn unter dem Finger/Mauszeiger verschiebt.
      pointer.x += beltShift;

      // Schiebt das Förderband den Slime komplett über seine Kante hinaus,
      // darf das Zielen ihn nicht in der Luft festhalten. In diesem Moment
      // wird nur der Zielmodus beendet; anschließend übernimmt noch im selben
      // Frame wieder die normale Schwerkraft.
      const stillOnConveyor =
        player.x + player.r > conveyor.x + 2 &&
        player.x - player.r < conveyor.x + conveyor.w - 2 &&
        Math.abs(player.y + player.r - conveyor.y) < 28;

      if (!stillOnConveyor) {
        aiming = false;
        drag.x = 0;
        drag.y = 0;
        aimInputMode = "direct";
        canvas.classList.remove("aiming");
        return false;
      }

      return true;
    }

    return false;
  }

