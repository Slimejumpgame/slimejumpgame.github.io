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
  const STUCK_AIM_POSITION_EPSILON = 4;
  const STUCK_AIM_CONTACT_NORMAL_DOT_LIMIT = 0.95;
  const STUCK_AIM_DELAY = 0.5;
  const MAX_DRAG_DISTANCE = 330;
  const MAX_LAUNCH_SPEED = 205 * 5.7;
  const MIN_LAUNCH_DRAG = 10;
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

  function hasValidAimSupport() {
    return getPlatforms().some(platform =>
      (!platform.fade || platform.fadeData.solid) &&
      player.x + player.r > platform.x + 2 &&
      player.x - player.r < platform.x + platform.w - 2 &&
      Math.abs(player.y + player.r - platform.y) <= AIM_SUPPORT_TOLERANCE
    );
  }

  function canUseNormalAim() {
    return player.onGround &&
      hasValidAimSupport() &&
      Math.abs(player.vx) <= AIM_MAX_ROLL_SPEED;
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
    const launchSpeed = MAX_LAUNCH_SPEED * forceRatio;
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

