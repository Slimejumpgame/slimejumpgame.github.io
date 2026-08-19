"use strict";

  const player = {
    x: 0, y: 0, r: 30,
    vx: 0, vy: 0,
    lastHorizontalDirection: 0,
    onGround: false,
    onIce: false,
    conveyorSpeed: 0,
    squish: 0,
    trail: []
  };

  function getCanvasDisplayMetrics() {
    const rect = canvas.getBoundingClientRect();
    const canvasAspect = W / H;

    // V2.02: Auf Touch-Geräten im Querformat wird #game per CSS 6 %
    // horizontal gestreckt. getBoundingClientRect() enthält diese Transformation,
    // clientWidth/clientHeight dagegen die ursprüngliche Layoutgröße. Deshalb
    // berechnen wir zuerst die object-fit-Fläche vor dem Stretch und übertragen
    // anschließend nur die X-Werte mit dem tatsächlichen Transform-Faktor.
    const layoutWidth = canvas.clientWidth || rect.width;
    const layoutHeight = canvas.clientHeight || rect.height;
    const stretchX = layoutWidth > 0 ? rect.width / layoutWidth : 1;
    const elementAspect = layoutWidth / layoutHeight;

    let shownWidthBase;
    let shownHeight;
    let offsetXBase;
    let offsetY;

    if (elementAspect > canvasAspect) {
      // Schwarze Ränder links und rechts – vor dem horizontalen Stretch.
      shownHeight = layoutHeight;
      shownWidthBase = shownHeight * canvasAspect;
      offsetXBase = (layoutWidth - shownWidthBase) / 2;
      offsetY = 0;
    } else {
      // Schwarze Ränder oben und unten – vor dem horizontalen Stretch.
      shownWidthBase = layoutWidth;
      shownHeight = shownWidthBase / canvasAspect;
      offsetXBase = 0;
      offsetY = (layoutHeight - shownHeight) / 2;
    }

    const shownWidth = shownWidthBase * stretchX;
    const offsetX = offsetXBase * stretchX;

    return {
      rect,
      shownWidth,
      shownHeight,
      offsetX,
      offsetY,
      scaleX: W / shownWidth,
      scaleY: H / shownHeight
    };
  }

  function screenToWorld(clientX, clientY) {
    const m = getCanvasDisplayMetrics();

    return {
      x: (clientX - m.rect.left - m.offsetX) * m.scaleX,
      y: (clientY - m.rect.top - m.offsetY) * m.scaleY
    };
  }

  function isInSideTouchPad(clientX, clientY) {
    const m = getCanvasDisplayMetrics();
    const gameLeft = m.rect.left + m.offsetX;
    const gameRight = gameLeft + m.shownWidth;
    const gameTop = m.rect.top + m.offsetY;
    const gameBottom = gameTop + m.shownHeight;

    const verticallyBesideGame =
      clientY >= gameTop &&
      clientY <= gameBottom;

    const inLeftBlackBar =
      m.offsetX > 2 &&
      clientX >= m.rect.left &&
      clientX < gameLeft;

    const inRightBlackBar =
      m.offsetX > 2 &&
      clientX > gameRight &&
      clientX <= m.rect.right;

    return verticallyBesideGame && (inLeftBlackBar || inRightBlackBar);
  }

  let aimInputMode = "direct";
  let aimStartClientX = 0;
  let aimStartClientY = 0;
  const AIM_MAX_ROLL_SPEED = 240;
  const AIM_SUPPORT_TOLERANCE = 4;
  const AIR_HOP_DETACHMENT_GRACE = 0.05;
  const NORMAL_SAFE_GROUND_DAMPING = 0.90;
  const NORMAL_SAFE_GROUND_DAMPING_REFERENCE_FPS = 60;
  const SECOND_CHANCE_RESCUE_REASONS = Object.freeze([
    "spike_platform",
    "ghost",
    "fast_ghost",
    "side_out"
  ]);
  const STAR_SHIELD_PROTECTION_REASONS = Object.freeze([
    "spike_platform",
    "ghost",
    "fast_ghost"
  ]);
  const STUCK_AIM_POSITION_EPSILON = 4;
  const STUCK_AIM_CONTACT_NORMAL_DOT_LIMIT = 0.95;
  const STUCK_AIM_DELAY = 0.5;
  const MAX_DRAG_DISTANCE = 330;
  const MAX_LAUNCH_SPEED = 205 * 5.7;
  const MIN_LAUNCH_DRAG = 10;
  let airHopUsedThisFlight = false;
  let airHopFlightActive = false;
  let airHopDetachmentStartedAt = null;
  let lastAirHopTrigger = "NONE";
  let lastBubbleUsedThisLevel = false;
  let lastBubbleProtectionTimer = 0;
  const lastBubbleBottomOutSupportSource = Object.freeze({type: "last_bubble_bottom_out"});
  let secondChanceUsedThisRun = false;
  let secondChanceSafeAnchor = null;
  let lastSecondChanceRescueReason = "none";
  let starShieldConsumedThisLife = false;
  let starShieldProtectionUntil = 0;
  let stuckAimStillTime = 0;
  let stuckAimReferenceX = player.x;
  let stuckAimReferenceY = player.y;
  let stuckAimReferenceMover = null;
  let stuckAimReferenceMoverY = 0;
  let stuckAimReferenceConveyor = null;
  let stuckAimReferenceConveyorTime = 0;
  let stuckAimReferenceFallingPlatform = null;
  let stuckAimFallbackActive = false;
  let stuckAimFallbackFallingPlatform = null;
  let stuckAimFallbackVerticalMover = null;
  let stuckAimLockedX = player.x;
  let stuckAimLockedY = player.y;

  function getPlatformSource(platform) {
    return platform.lastBubbleSupportSource ||
      platform.movingData ||
      platform.fallingPlatform ||
      platform.conveyorData ||
      platform.fadeData ||
      platform.iceData ||
      platform.spikeData ||
      platform;
  }

  function isValidAimSupportPlatform(platform) {
    return Boolean(platform) &&
      (!platform.fade || platform.fadeData.solid) &&
      player.x + player.r > platform.x + 2 &&
      player.x - player.r < platform.x + platform.w - 2 &&
      Math.abs(player.y + player.r - platform.y) <= AIM_SUPPORT_TOLERANCE;
  }

  function getValidAimSupportPlatform() {
    return getPlatforms().find(isValidAimSupportPlatform) || null;
  }

  function hasValidAimSupport() {
    return Boolean(getValidAimSupportPlatform());
  }

  function isNormalSafeStaticPlatform(platform) {
    return Boolean(platform) &&
      !platform.moving &&
      !platform.conveyor &&
      !platform.fallingPlatform &&
      !platform.fade &&
      !platform.ice &&
      !platform.spikePlatform &&
      !platform.lastBubbleSupport;
  }

  function isPlayerTouchingBouncePad() {
    return currentLevel().pads.some(pad =>
      intersectsRect(player.x, player.y, player.r, pad)
    );
  }

  function getValidNormalSafeSupportPlatform() {
    if (!player.onGround || isPlayerTouchingBouncePad()) return null;
    return getPlatforms().find(platform =>
      isNormalSafeStaticPlatform(platform) &&
      isValidAimSupportPlatform(platform)
    ) || null;
  }

  function getValidHorizontalMovingTopSupportPlatform() {
    if (!player.onGround || isPlayerTouchingBouncePad()) return null;
    const topSupports = getPlatforms().filter(isValidAimSupportPlatform);
    if (topSupports.length !== 1) return null;
    const support = topSupports[0];
    return support.moving && support.movingData?.axis === "x"
      ? support
      : null;
  }

  function getValidVerticalMovingTopSupportPlatform() {
    if (!player.onGround || isPlayerTouchingBouncePad()) return null;
    const topSupports = getPlatforms().filter(isValidAimSupportPlatform);
    if (topSupports.length !== 1) return null;
    const support = topSupports[0];
    return support.moving && support.movingData?.axis === "y"
      ? support
      : null;
  }

  function isNormalSafeGroundDampingActive() {
    const horizontalSpeed = Math.abs(player.vx);
    return state === "playing" &&
      !aiming &&
      !isLastBubbleProtectionActive() &&
      horizontalSpeed > 0.5 &&
      Boolean(getValidNormalSafeSupportPlatform());
  }

  function applyNormalSafeGroundDamping(dt) {
    if (!isNormalSafeGroundDampingActive()) return false;
    player.vx *= Math.pow(
      NORMAL_SAFE_GROUND_DAMPING,
      Math.max(0, dt) * NORMAL_SAFE_GROUND_DAMPING_REFERENCE_FPS
    );
    return true;
  }

  function applyHorizontalMovingGroundDamping(dt) {
    if (
      state !== "playing" ||
      aiming ||
      isLastBubbleProtectionActive() ||
      Math.abs(player.vx) <= 0.5 ||
      !getValidHorizontalMovingTopSupportPlatform()
    ) return false;
    player.vx *= Math.pow(
      NORMAL_SAFE_GROUND_DAMPING,
      Math.max(0, dt) * NORMAL_SAFE_GROUND_DAMPING_REFERENCE_FPS
    );
    return true;
  }

  function applyVerticalMovingGroundDamping(dt) {
    if (
      state !== "playing" ||
      aiming ||
      isLastBubbleProtectionActive() ||
      Math.abs(player.vx) <= 0.5 ||
      !getValidVerticalMovingTopSupportPlatform()
    ) return false;
    player.vx *= Math.pow(
      NORMAL_SAFE_GROUND_DAMPING,
      Math.max(0, dt) * NORMAL_SAFE_GROUND_DAMPING_REFERENCE_FPS
    );
    return true;
  }

  function updateSecondChanceSafeAnchor() {
    const support = getValidNormalSafeSupportPlatform();
    if (!support) return false;
    const edgeMargin = player.r + 12;
    const safeLeft = support.x + edgeMargin;
    const safeRight = support.x + support.w - edgeMargin;
    const anchorX = safeLeft <= safeRight
      ? clamp(player.x, safeLeft, safeRight)
      : support.x + support.w / 2;
    secondChanceSafeAnchor = {
      x: anchorX,
      y: support.y - player.r,
      platformSource: getPlatformSource(support)
    };
    return true;
  }

  function resetSecondChanceAnchorForNewLevel() {
    secondChanceSafeAnchor = null;
  }

  function getValidatedSecondChanceAnchor() {
    if (!secondChanceSafeAnchor) return null;
    const support = getPlatforms().find(platform =>
      isNormalSafeStaticPlatform(platform) &&
      getPlatformSource(platform) === secondChanceSafeAnchor.platformSource
    );
    if (!support) return null;
    const edgeMargin = player.r + 12;
    const safeLeft = support.x + edgeMargin;
    const safeRight = support.x + support.w - edgeMargin;
    return {
      x: safeLeft <= safeRight
        ? clamp(secondChanceSafeAnchor.x, safeLeft, safeRight)
        : support.x + support.w / 2,
      y: support.y - player.r
    };
  }

  function canUseNormalAim() {
    return player.onGround &&
      hasValidAimSupport() &&
      Math.abs(player.vx) <= AIM_MAX_ROLL_SPEED;
  }

  function resetRunPerkConsumables() {
    airHopUsedThisFlight = false;
    airHopFlightActive = false;
    airHopDetachmentStartedAt = null;
    lastAirHopTrigger = "NONE";
    resetLastBubbleForNewLevel();
    secondChanceUsedThisRun = false;
    secondChanceSafeAnchor = null;
    lastSecondChanceRescueReason = "none";
    resetStarShieldForNewLife();
  }

  function resetStarShieldForNewLife() {
    starShieldConsumedThisLife = false;
    starShieldProtectionUntil = 0;
  }

  function tryActivateStarShieldFromStarPickup() {
    if (
      isTutorialStage() ||
      starShieldConsumedThisLife ||
      window.SlimePerks?.isActiveForRun?.("sticky_slime") !== true
    ) return false;

    starShieldConsumedThisLife = true;
    starShieldProtectionUntil = performance.now() +
      window.SlimePerks.balance.STAR_SHIELD_DURATION * 1000;
    return true;
  }

  function clearStarShieldProtection() {
    starShieldProtectionUntil = 0;
  }

  function isStarShieldProtectionActive() {
    return getStarShieldProtectionTimeRemaining() > 0 &&
      window.SlimePerks?.isActiveForRun?.("sticky_slime") === true;
  }

  function isStarShieldReadyThisLife() {
    return !starShieldConsumedThisLife;
  }

  function isStarShieldConsumedThisLife() {
    return starShieldConsumedThisLife;
  }

  function getStarShieldProtectionTimeRemaining() {
    return Math.max(0, (starShieldProtectionUntil - performance.now()) / 1000);
  }

  function resetFlightPerkState() {
    airHopUsedThisFlight = false;
    airHopFlightActive = false;
    airHopDetachmentStartedAt = null;
    lastBubbleProtectionTimer = 0;
  }

  function resetLastBubbleForNewLevel() {
    lastBubbleUsedThisLevel = false;
    lastBubbleProtectionTimer = 0;
  }

  function updateAirHopFlightState(wasOnGround, isOnGround, bouncedOnPad) {
    if (bouncedOnPad) {
      airHopFlightActive = true;
      airHopDetachmentStartedAt = null;
      return;
    }

    if (isOnGround) {
      if (!wasOnGround) airHopUsedThisFlight = false;
      airHopFlightActive = false;
      airHopDetachmentStartedAt = null;
      return;
    }

    // Slingshot und Bounce Pad starten ihre Flugphase ausdrücklich. Nur ein
    // impliziter Ground-Verlust braucht die kurze Entkopplungs-Grace.
    if (airHopFlightActive) {
      airHopDetachmentStartedAt = null;
      return;
    }

    if (wasOnGround) {
      airHopDetachmentStartedAt = worldTime;
      return;
    }

    if (
      airHopDetachmentStartedAt !== null &&
      !hasSolidAirHopBlockingContact() &&
      worldTime - airHopDetachmentStartedAt >= AIR_HOP_DETACHMENT_GRACE
    ) {
      airHopFlightActive = true;
      airHopDetachmentStartedAt = null;
    }
  }

  function beginAirHopFlight() {
    airHopFlightActive = true;
    airHopDetachmentStartedAt = null;
  }

  function canUseFlightAction(perkId) {
    return state === "playing" &&
      !isTutorialStage() &&
      !aiming &&
      window.SlimePerks?.isActiveForRun?.(perkId) === true &&
      airHopFlightActive &&
      !player.onGround &&
      !hasValidAimSupport() &&
      !hasSolidAirHopBlockingContact() &&
      !airHopUsedThisFlight;
  }

  function canUseAirHop() {
    return canUseFlightAction("air_hop");
  }

  function useAirHop(trigger) {
    if (!canUseAirHop()) return false;

    airHopUsedThisFlight = true;
    lastAirHopTrigger = trigger;
    player.vy = -window.SlimePerks.balance.AIR_HOP_VERTICAL_SPEED;
    player.squish = 0.8;
    tone(390, 0.1, "sine", 0.04, 680);
    spawnBurst(player.x, player.y + player.r * 0.4, 10, "#9deeff");
    return true;
  }

  function useAirBrake() {
    if (!canUseFlightAction("quick_recovery")) return false;

    airHopUsedThisFlight = true;
    player.vx *= window.SlimePerks.balance.AIR_BRAKE_HORIZONTAL_MULTIPLIER;
    return true;
  }

  function consumeAirHopCanvasInput(trigger) {
    // Ground- und bestehender Rescue-Aim haben für denselben Down-Input Vorrang.
    if (canAim()) return false;
    return useAirHop(trigger) || useAirBrake();
  }

  function getActiveLastBubbleSupportPlatforms() {
    if (!isLastBubbleProtectionActive()) return [];
    const bottomDeathHazard = getBottomDeathHazard();
    const supports = [];
    if (bottomDeathHazard) {
      const danger = getSpikeDangerRect(bottomDeathHazard);
      supports.push({
        ...danger,
        lastBubbleSupport: true,
        lastBubbleSupportSource: bottomDeathHazard,
        bottomDeathHazard
      });
    }
    supports.push({
      x: 0,
      y: BOTTOM_DEATH_THRESHOLD,
      w: W,
      h: 80,
      lastBubbleSupport: true,
      lastBubbleBottomOutSupport: true,
      lastBubbleSupportSource: lastBubbleBottomOutSupportSource
    });
    return supports;
  }

  function getLastBubbleSupportForReason(reason, hazard) {
    const supports = getActiveLastBubbleSupportPlatforms();
    return reason === "bottom_death_hazard"
      ? supports.find(support => support.bottomDeathHazard === hazard) || null
      : supports.find(support => support.lastBubbleBottomOutSupport === true) || null;
  }

  function landPlayerOnLastBubbleSupport(reason, hazard) {
    const support = getLastBubbleSupportForReason(reason, hazard);
    if (!support) return false;
    player.x = clamp(
      player.x,
      support.x + player.r,
      support.x + support.w - player.r
    );
    player.y = support.y - player.r;
    player.vy = 0;
    player.onGround = true;
    player.onIce = false;
    player.conveyorSpeed = 0;
    player.squish = Math.max(player.squish, 0.72);
    updateAirHopFlightState(false, true, false);
    return true;
  }

  function tryHandleLastBubbleContact(reason, hazard = null) {
    const eligibleDeathReason =
      reason === "bottom_out" ||
      (reason === "bottom_death_hazard" && hazard?.isBottomDeathHazard === true);
    if (!eligibleDeathReason || isTutorialStage()) return false;
    if (isLastBubbleProtectionActive()) {
      return landPlayerOnLastBubbleSupport(reason, hazard);
    }
    if (
      lastBubbleUsedThisLevel ||
      window.SlimePerks?.isActiveForRun?.("last_bubble") !== true
    ) return false;

    lastBubbleUsedThisLevel = true;
    lastBubbleProtectionTimer = window.SlimePerks.balance.LAST_BUBBLE_DURATION;
    stopAiming();
    activeTouchId = null;
    tone(560, 0.13, "sine", 0.045, 760);
    spawnBurst(player.x, player.y, 18, "#b9f4ff");
    return landPlayerOnLastBubbleSupport(reason, hazard);
  }

  function updateLastBubbleProtection(dt) {
    if (lastBubbleProtectionTimer <= 0) return;
    const previousTimer = lastBubbleProtectionTimer;
    lastBubbleProtectionTimer = Math.max(
      0,
      lastBubbleProtectionTimer - Math.max(0, dt)
    );
    if (previousTimer > 0 && lastBubbleProtectionTimer === 0) {
      spawnBurst(player.x, player.y, 12, "#d9f8ff");
      tone(390, 0.08, "sine", 0.025, 260);
    }
  }

  function isAirHopAvailableThisFlight() {
    return airHopFlightActive && !airHopUsedThisFlight;
  }

  function isAirHopFlightActive() {
    return airHopFlightActive;
  }

  function isAirHopUsedThisFlight() {
    return airHopUsedThisFlight;
  }

  function getLastAirHopTrigger() {
    return lastAirHopTrigger;
  }

  function isLastBubbleAvailableThisLevel() {
    return !lastBubbleUsedThisLevel;
  }

  function isLastBubbleUsedThisLevel() {
    return lastBubbleUsedThisLevel;
  }

  function isLastBubbleProtectionActive() {
    return lastBubbleProtectionTimer > 0;
  }

  function getLastBubbleProtectionTimeRemaining() {
    return lastBubbleProtectionTimer;
  }

  function tryUseSecondChance(reason) {
    if (
      !SECOND_CHANCE_RESCUE_REASONS.includes(reason) ||
      isTutorialStage() ||
      secondChanceUsedThisRun ||
      window.SlimePerks?.isActiveForRun?.("safe_return") !== true
    ) return false;

    const level = currentLevel();
    const anchor = getValidatedSecondChanceAnchor() || {
      x: level.spawn.x,
      y: level.spawn.y
    };
    secondChanceUsedThisRun = true;
    lastSecondChanceRescueReason = reason;
    stopAiming();
    activeTouchId = null;
    stuckAimFallbackActive = false;
    resetStuckAimTimer();
    resetFlightPerkState();
    drag.x = 0;
    drag.y = 0;
    player.x = anchor.x;
    player.y = anchor.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.onIce = false;
    player.conveyorSpeed = 0;
    player.squish = 0.86;
    player.trail = [];
    tone(690, 0.12, "sine", 0.045, 980);
    spawnBurst(player.x, player.y, 20, "#fff0a8");
    return true;
  }

  function tryHandleProtectedDeadlyContact(reason) {
    if (
      STAR_SHIELD_PROTECTION_REASONS.includes(reason) &&
      isStarShieldProtectionActive()
    ) return "star_shield";
    return tryUseSecondChance(reason) ? "second_chance" : "";
  }

  function isSecondChanceAvailableThisRun() {
    return !secondChanceUsedThisRun;
  }

  function isSecondChanceUsedThisRun() {
    return secondChanceUsedThisRun;
  }

  function getSecondChanceSafeAnchor() {
    const anchor = getValidatedSecondChanceAnchor();
    return anchor ? {x: anchor.x, y: anchor.y} : null;
  }

  function getLastSecondChanceRescueReason() {
    return lastSecondChanceRescueReason;
  }

  function getVerticalMoverY(mover) {
    const offset = Math.sin(worldTime * mover.speed + mover.phase) * mover.range;
    return mover.y + offset;
  }

  function getTouchingVerticalMover() {
    const level = currentLevel();
    if (!level?.movers) return null;

    const contactRadius = player.r + STUCK_AIM_POSITION_EPSILON;
    const contactRadiusSquared = contactRadius * contactRadius;

    for (const mover of level.movers) {
      if (mover.axis !== "y") continue;

      const moverY = getVerticalMoverY(mover);
      const closestX = Math.max(mover.x, Math.min(player.x, mover.x + mover.w));
      const closestY = Math.max(moverY, Math.min(player.y, moverY + mover.h));
      const dx = player.x - closestX;
      const dy = player.y - closestY;

      if (dx * dx + dy * dy <= contactRadiusSquared) return mover;
    }

    return null;
  }

  function getTrappingConveyor() {
    const level = currentLevel();
    if (!level?.conveyors) return null;

    const contactRadius = player.r + STUCK_AIM_POSITION_EPSILON;
    const contactRadiusSquared = contactRadius * contactRadius;

    for (const conveyor of level.conveyors) {
      const conveyorClosestX = Math.max(
        conveyor.x,
        Math.min(player.x, conveyor.x + conveyor.w)
      );
      const conveyorClosestY = Math.max(
        conveyor.y,
        Math.min(player.y, conveyor.y + conveyor.h)
      );
      const conveyorDx = player.x - conveyorClosestX;
      const conveyorDy = player.y - conveyorClosestY;
      const touchesConveyor =
        conveyorDx * conveyorDx + conveyorDy * conveyorDy <= contactRadiusSquared;

      if (!touchesConveyor) continue;

      const pushDirection = Math.sign(conveyor.direction);
      const touchesDownstreamFixedGeometry = getPlatforms().some(platform => {
        if (
          platform.conveyor ||
          platform.moving ||
          platform.fallingPlatform ||
          (platform.fade && !platform.fadeData.solid)
        ) {
          return false;
        }

        const closestX = Math.max(
          platform.x,
          Math.min(player.x, platform.x + platform.w)
        );
        const closestY = Math.max(
          platform.y,
          Math.min(player.y, platform.y + platform.h)
        );
        const dx = player.x - closestX;
        const dy = player.y - closestY;
        const isDownstream = (closestX - player.x) * pushDirection > 0;

        return isDownstream && dx * dx + dy * dy <= contactRadiusSquared;
      });

      if (touchesDownstreamFixedGeometry) return conveyor;
    }

    return null;
  }

  function getTrappingWarningFallingPlatform() {
    const level = currentLevel();
    if (!level?.fallingPlatforms) return null;

    const contactRadius = player.r + STUCK_AIM_POSITION_EPSILON;
    const contactRadiusSquared = contactRadius * contactRadius;

    for (const fallingPlatform of level.fallingPlatforms) {
      if (
        !fallingPlatform.triggered ||
        fallingPlatform.falling ||
        fallingPlatform.removed
      ) {
        continue;
      }

      const fallingClosestX = Math.max(
        fallingPlatform.x,
        Math.min(player.x, fallingPlatform.x + fallingPlatform.w)
      );
      const fallingClosestY = Math.max(
        fallingPlatform.currentY,
        Math.min(player.y, fallingPlatform.currentY + fallingPlatform.h)
      );
      const fallingDx = player.x - fallingClosestX;
      const fallingDy = player.y - fallingClosestY;
      const touchesWarningFallingPlatform =
        fallingDx * fallingDx + fallingDy * fallingDy <= contactRadiusSquared;

      if (!touchesWarningFallingPlatform) continue;

      const touchesAdditionalFixedGeometry = getPlatforms().some(platform => {
        if (
          platform.moving ||
          platform.conveyor ||
          platform.fallingPlatform ||
          (platform.fade && !platform.fadeData.solid)
        ) {
          return false;
        }

        const closestX = Math.max(
          platform.x,
          Math.min(player.x, platform.x + platform.w)
        );
        const closestY = Math.max(
          platform.y,
          Math.min(player.y, platform.y + platform.h)
        );
        const dx = player.x - closestX;
        const dy = player.y - closestY;

        return dx * dx + dy * dy <= contactRadiusSquared;
      });

      if (touchesAdditionalFixedGeometry) return fallingPlatform;
    }

    return null;
  }

  function getStuckAimDistanceFromReference(
    touchingVerticalMover = getTouchingVerticalMover(),
    trappingConveyor = getTrappingConveyor()
  ) {
    const worldDistance = Math.hypot(
      player.x - stuckAimReferenceX,
      player.y - stuckAimReferenceY
    );
    let minimumDistance = worldDistance;

    if (stuckAimReferenceMover && touchingVerticalMover === stuckAimReferenceMover) {
      const currentMoverY = getVerticalMoverY(stuckAimReferenceMover);
      const relativeDistance = Math.hypot(
        player.x - stuckAimReferenceX,
        (player.y - currentMoverY) -
          (stuckAimReferenceY - stuckAimReferenceMoverY)
      );
      minimumDistance = Math.min(minimumDistance, relativeDistance);
    }

    if (stuckAimReferenceConveyor && trappingConveyor === stuckAimReferenceConveyor) {
      const beltTravel =
        stuckAimReferenceConveyor.direction *
        stuckAimReferenceConveyor.beltSpeed *
        (worldTime - stuckAimReferenceConveyorTime);
      const relativeDistance = Math.hypot(
        player.x - stuckAimReferenceX - beltTravel,
        player.y - stuckAimReferenceY
      );
      minimumDistance = Math.min(minimumDistance, relativeDistance);
    }

    return minimumDistance;
  }

  function getStuckAimContactNormal(platform) {
    if (
      (platform.fade && !platform.fadeData.solid) ||
      platform.fallingPlatform?.falling
    ) {
      return null;
    }

    const contactRadius = player.r + STUCK_AIM_POSITION_EPSILON;
    const contactRadiusSquared = contactRadius * contactRadius;
    const closestX = Math.max(
      platform.x,
      Math.min(player.x, platform.x + platform.w)
    );
    const closestY = Math.max(
      platform.y,
      Math.min(player.y, platform.y + platform.h)
    );
    let dx = player.x - closestX;
    let dy = player.y - closestY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared > contactRadiusSquared) return null;
    if (distanceSquared > 0) {
      const distance = Math.sqrt(distanceSquared);
      return {x: dx / distance, y: dy / distance};
    }

    const nearestFace = [
      {distance: Math.abs(player.x - platform.x), x: -1, y: 0},
      {distance: Math.abs(platform.x + platform.w - player.x), x: 1, y: 0},
      {distance: Math.abs(player.y - platform.y), x: 0, y: -1},
      {distance: Math.abs(platform.y + platform.h - player.y), x: 0, y: 1}
    ].reduce((nearest, face) =>
      face.distance < nearest.distance ? face : nearest
    );
    return {x: nearestFace.x, y: nearestFace.y};
  }

  function hasSolidAirHopBlockingContact() {
    return getPlatforms().some(platform =>
      getStuckAimContactNormal(platform) !== null
    );
  }

  function hasPlausibleStuckAimContact() {
    const contactNormals = getPlatforms()
      .map(getStuckAimContactNormal)
      .filter(Boolean);

    for (let i = 0; i < contactNormals.length; i++) {
      for (let j = i + 1; j < contactNormals.length; j++) {
        const normalDot =
          contactNormals[i].x * contactNormals[j].x +
          contactNormals[i].y * contactNormals[j].y;
        if (normalDot <= STUCK_AIM_CONTACT_NORMAL_DOT_LIMIT) return true;
      }
    }

    return false;
  }

  function canUseStuckAimFallback() {
    const touchingVerticalMover = getTouchingVerticalMover();
    const trappingConveyor = getTrappingConveyor();
    const trappingWarningFallingPlatform = getTrappingWarningFallingPlatform();
    return stuckAimStillTime >= STUCK_AIM_DELAY &&
      (!touchingVerticalMover || touchingVerticalMover === stuckAimReferenceMover) &&
      trappingConveyor === stuckAimReferenceConveyor &&
      trappingWarningFallingPlatform === stuckAimReferenceFallingPlatform &&
      getStuckAimDistanceFromReference(
        touchingVerticalMover,
        trappingConveyor
      ) <= STUCK_AIM_POSITION_EPSILON &&
      hasPlausibleStuckAimContact();
  }

  function resetStuckAimTimer(
    touchingVerticalMover = getTouchingVerticalMover(),
    trappingConveyor = getTrappingConveyor(),
    trappingWarningFallingPlatform = getTrappingWarningFallingPlatform()
  ) {
    stuckAimStillTime = 0;
    stuckAimReferenceX = player.x;
    stuckAimReferenceY = player.y;
    stuckAimReferenceMover = touchingVerticalMover;
    stuckAimReferenceMoverY = touchingVerticalMover
      ? getVerticalMoverY(touchingVerticalMover)
      : 0;
    stuckAimReferenceConveyor = trappingConveyor;
    stuckAimReferenceConveyorTime = worldTime;
    stuckAimReferenceFallingPlatform = trappingWarningFallingPlatform;
  }

  function updateStuckAimTimer(dt) {
    const hasStuckContact = hasPlausibleStuckAimContact();
    const touchingVerticalMover = getTouchingVerticalMover();
    const trappingConveyor = getTrappingConveyor();
    const trappingWarningFallingPlatform = getTrappingWarningFallingPlatform();

    if (
      state !== "playing" ||
      aiming ||
      !hasStuckContact
    ) {
      resetStuckAimTimer(
        touchingVerticalMover,
        trappingConveyor,
        trappingWarningFallingPlatform
      );
      return;
    }

    if (!touchingVerticalMover && stuckAimReferenceMover) {
      stuckAimReferenceMover = null;
      stuckAimReferenceMoverY = 0;
    } else if (touchingVerticalMover && touchingVerticalMover !== stuckAimReferenceMover) {
      resetStuckAimTimer(
        touchingVerticalMover,
        trappingConveyor,
        trappingWarningFallingPlatform
      );
      return;
    }

    if (trappingConveyor !== stuckAimReferenceConveyor) {
      resetStuckAimTimer(
        touchingVerticalMover,
        trappingConveyor,
        trappingWarningFallingPlatform
      );
      return;
    }

    if (trappingWarningFallingPlatform !== stuckAimReferenceFallingPlatform) {
      resetStuckAimTimer(
        touchingVerticalMover,
        trappingConveyor,
        trappingWarningFallingPlatform
      );
      return;
    }

    if (
      getStuckAimDistanceFromReference(
        touchingVerticalMover,
        trappingConveyor
      ) > STUCK_AIM_POSITION_EPSILON
    ) {
      resetStuckAimTimer(
        touchingVerticalMover,
        trappingConveyor,
        trappingWarningFallingPlatform
      );
      return;
    }

    stuckAimStillTime = Math.min(STUCK_AIM_DELAY, stuckAimStillTime + dt);
  }

  function canAim() {
    return state === "playing" &&
      (canUseNormalAim() || canUseStuckAimFallback());
  }

  function hasActiveStuckAimPositionLock() {
    return aiming &&
      stuckAimFallbackActive &&
      !stuckAimFallbackVerticalMover;
  }

  function hasActiveVerticalMoverStuckAimFallback() {
    return aiming &&
      stuckAimFallbackActive &&
      Boolean(stuckAimFallbackVerticalMover);
  }

  function restoreStuckAimPosition() {
    if (!hasActiveStuckAimPositionLock()) return;

    player.x = stuckAimLockedX;
    player.y = stuckAimLockedY;
    player.vx = 0;
    player.vy = 0;
  }

  function stopAiming() {
    aiming = false;
    drag.x = 0;
    drag.y = 0;
    aimInputMode = "direct";
    stuckAimFallbackActive = false;
    stuckAimFallbackFallingPlatform = null;
    stuckAimFallbackVerticalMover = null;
    resetStuckAimTimer();
    canvas.classList.remove("aiming");
  }

  function getSlingshotLaunch() {
    const dragDistance = Math.hypot(drag.x, drag.y);
    const dragRatio = clamp(dragDistance / MAX_DRAG_DISTANCE, 0, 1);
    const forceRatio = dragRatio * dragRatio * (3 - 2 * dragRatio);
    const powerShotMultiplier = window.SlimePerks?.isActiveForRun?.("power_shot")
      ? window.SlimePerks.balance.POWER_SHOT_MULTIPLIER
      : 1;
    const launchSpeed = MAX_LAUNCH_SPEED * powerShotMultiplier * forceRatio;
    const directionScale = dragDistance > 0 ? launchSpeed / dragDistance : 0;

    return {
      dragDistance,
      forceRatio,
      vx: drag.x * directionScale,
      vy: drag.y * directionScale
    };
  }

  function beginAimAt(clientX, clientY) {
    getAudio();
    const useStuckFallback = canUseStuckAimFallback();
    if (!canAim()) return false;

    const touchingSidePad = isInSideTouchPad(clientX, clientY);

    aiming = true;
    dismissTutorialDragHand();
    stuckAimFallbackActive = useStuckFallback;
    stuckAimFallbackFallingPlatform = useStuckFallback
      ? stuckAimReferenceFallingPlatform
      : null;
    stuckAimFallbackVerticalMover = useStuckFallback &&
      !stuckAimReferenceConveyor &&
      !stuckAimReferenceFallingPlatform
      ? stuckAimReferenceMover
      : null;
    stuckAimLockedX = player.x;
    stuckAimLockedY = player.y;
    resetStuckAimTimer();
    aimInputMode = touchingSidePad ? "sidepad" : "direct";
    aimStartClientX = clientX;
    aimStartClientY = clientY;

    // Der erste Berührungspunkt gilt als Nullpunkt. Dadurch zählt bei direkter
    // Eingabe und am seitlichen Touchpad nur die anschließende Ziehbewegung.
    pointer = {x: player.x, y: player.y};

    drag.x = 0;
    drag.y = 0;
    player.squish = Math.max(player.squish, 0.22);

    // Beim Zielen bleibt der Slime zuverlässig an seiner aktuellen Position.
    player.vx = 0;
    player.vy = 0;
    player.trail = [];
    canvas.classList.add("aiming");
    return true;
  }

  function moveAimTo(clientX, clientY) {
    if (!aiming) return;

    const m = getCanvasDisplayMetrics();
    const deltaX = (clientX - aimStartClientX) * m.scaleX;
    const deltaY = (clientY - aimStartClientY) * m.scaleY;

    // Direkte Eingabe und seitliches Touchpad verwenden dieselbe skalierte
    // Bewegung ab dem jeweiligen Kontaktpunkt.
    pointer = {
      x: player.x + deltaX,
      y: player.y + deltaY
    };

    drag.x = player.x - pointer.x;
    drag.y = player.y - pointer.y;

    const len = Math.hypot(drag.x, drag.y);

    if (len > MAX_DRAG_DISTANCE) {
      drag.x *= MAX_DRAG_DISTANCE / len;
      drag.y *= MAX_DRAG_DISTANCE / len;
    }
  }

  function releaseAim() {
    if (!aiming) return;

    const launch = getSlingshotLaunch();
    const usedStuckRescue = stuckAimFallbackActive;
    const canLaunch = hasValidAimSupport() || stuckAimFallbackActive;
    stopAiming();

    if (canLaunch && launch.dragDistance > MIN_LAUNCH_DRAG) {
      player.vx = launch.vx;
      player.vy = launch.vy;
      beginAirHopFlight();
      shots++;
      if (!isTutorialStage()) {
        window.SlimeAchievements?.onShot?.({
          levelShots: shots,
          usedRescue: usedStuckRescue
        });
        score = Math.max(0, score - 5);
      }
      player.squish = 1;
      playLaunch();
      spawnBurst(player.x, player.y, 10, "#7cff90");
      updateHUD();
    }
  }

  // Maus und moderne Pointer-Eingabe.
  function pointerDown(e) {
    if (e.pointerType === "touch") return;
    if (consumeAirHopCanvasInput("MOUSE")) {
      e.preventDefault();
      return;
    }
    e.preventDefault();

    if (beginAimAt(e.clientX, e.clientY)) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function pointerMove(e) {
    if (e.pointerType === "touch" || !aiming) return;
    e.preventDefault();
    moveAimTo(e.clientX, e.clientY);
  }

  function pointerUp(e) {
    if (e.pointerType === "touch" || !aiming) return;
    e.preventDefault();
    releaseAim();
  }

  // Eigene Touch-Steuerung für Android und eingebettete Handy-Browser.
  let activeTouchId = null;

  function getActiveTouch(touchList) {
    for (const touch of touchList) {
      if (touch.identifier === activeTouchId) return touch;
    }
    return null;
  }

  function touchStart(e) {
    if (activeTouchId !== null || !e.changedTouches.length) return;

    if (consumeAirHopCanvasInput("TOUCH")) {
      e.preventDefault();
      return;
    }

    const touch = e.changedTouches[0];

    if (beginAimAt(touch.clientX, touch.clientY)) {
      activeTouchId = touch.identifier;
      e.preventDefault();
    }
  }

  function touchMove(e) {
    if (!aiming || activeTouchId === null) return;

    const touch =
      getActiveTouch(e.touches) ||
      getActiveTouch(e.changedTouches);

    if (!touch) return;

    e.preventDefault();
    moveAimTo(touch.clientX, touch.clientY);
  }

  function touchEnd(e) {
    if (activeTouchId === null) return;

    const endedTouch = getActiveTouch(e.changedTouches);
    if (!endedTouch) return;

    e.preventDefault();
    activeTouchId = null;
    releaseAim();
  }

  canvas.addEventListener("pointerdown", pointerDown, {passive: false});
  canvas.addEventListener("pointermove", pointerMove, {passive: false});
  canvas.addEventListener("pointerup", pointerUp, {passive: false});
  canvas.addEventListener("pointercancel", pointerUp, {passive: false});

  canvas.addEventListener("touchstart", touchStart, {passive: false});
  canvas.addEventListener("touchmove", touchMove, {passive: false});
  canvas.addEventListener("touchend", touchEnd, {passive: false});
  canvas.addEventListener("touchcancel", touchEnd, {passive: false});

  canvas.addEventListener("contextmenu", e => e.preventDefault());
