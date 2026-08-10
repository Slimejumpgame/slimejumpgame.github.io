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
  const STUCK_AIM_DELAY = 0.5;
  const MAX_DRAG_DISTANCE = 330;
  const MAX_LAUNCH_SPEED = 205 * 5.7;
  const MIN_LAUNCH_DRAG = 10;
  let stuckAimStillTime = 0;
  let stuckAimReferenceX = player.x;
  let stuckAimReferenceY = player.y;
  let stuckAimReferenceMover = null;
  let stuckAimReferenceMoverY = 0;
  let stuckAimFallbackActive = false;

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

  function getStuckAimDistanceFromReference(
    touchingVerticalMover = getTouchingVerticalMover()
  ) {
    const worldDistance = Math.hypot(
      player.x - stuckAimReferenceX,
      player.y - stuckAimReferenceY
    );

    if (!stuckAimReferenceMover || touchingVerticalMover !== stuckAimReferenceMover) {
      return worldDistance;
    }

    const currentMoverY = getVerticalMoverY(stuckAimReferenceMover);
    const relativeDistance = Math.hypot(
      player.x - stuckAimReferenceX,
      (player.y - currentMoverY) -
        (stuckAimReferenceY - stuckAimReferenceMoverY)
    );

    return Math.min(worldDistance, relativeDistance);
  }

  function hasPlausibleStuckAimContact() {
    const contactRadius = player.r + STUCK_AIM_POSITION_EPSILON;
    const contactRadiusSquared = contactRadius * contactRadius;

    return getPlatforms().some(platform => {
      if (platform.fade && !platform.fadeData.solid) return false;

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
  }

  function canUseStuckAimFallback() {
    const touchingVerticalMover = getTouchingVerticalMover();
    return stuckAimStillTime >= STUCK_AIM_DELAY &&
      (!touchingVerticalMover || touchingVerticalMover === stuckAimReferenceMover) &&
      getStuckAimDistanceFromReference(touchingVerticalMover) <= STUCK_AIM_POSITION_EPSILON &&
      hasPlausibleStuckAimContact();
  }

  function resetStuckAimTimer(
    touchingVerticalMover = getTouchingVerticalMover()
  ) {
    stuckAimStillTime = 0;
    stuckAimReferenceX = player.x;
    stuckAimReferenceY = player.y;
    stuckAimReferenceMover = touchingVerticalMover;
    stuckAimReferenceMoverY = touchingVerticalMover
      ? getVerticalMoverY(touchingVerticalMover)
      : 0;
  }

  function updateStuckAimTimer(dt) {
    const hasNormalSupport = player.onGround && hasValidAimSupport();
    const hasCollisionContact = hasPlausibleStuckAimContact();
    const touchingVerticalMover = getTouchingVerticalMover();

    if (
      state !== "playing" ||
      aiming ||
      hasNormalSupport ||
      !hasCollisionContact
    ) {
      resetStuckAimTimer(touchingVerticalMover);
      return;
    }

    if (!touchingVerticalMover && stuckAimReferenceMover) {
      stuckAimReferenceMover = null;
      stuckAimReferenceMoverY = 0;
    } else if (touchingVerticalMover && touchingVerticalMover !== stuckAimReferenceMover) {
      resetStuckAimTimer(touchingVerticalMover);
      return;
    }

    if (getStuckAimDistanceFromReference(touchingVerticalMover) > STUCK_AIM_POSITION_EPSILON) {
      resetStuckAimTimer(touchingVerticalMover);
      return;
    }

    stuckAimStillTime = Math.min(STUCK_AIM_DELAY, stuckAimStillTime + dt);
  }

  function canAim() {
    return state === "playing" &&
      (canUseNormalAim() || canUseStuckAimFallback());
  }

  function stopAiming() {
    aiming = false;
    drag.x = 0;
    drag.y = 0;
    aimInputMode = "direct";
    stuckAimFallbackActive = false;
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
    const useStuckFallback = !canUseNormalAim() && canUseStuckAimFallback();
    if (!canAim()) return false;

    const p = screenToWorld(clientX, clientY);
    const touchRadius = player.r + 105;
    const touchingSlime =
      Math.hypot(p.x - player.x, p.y - player.y) <= touchRadius;
    const touchingSidePad = isInSideTouchPad(clientX, clientY);

    if (!touchingSlime && !touchingSidePad) {
      return false;
    }

    aiming = true;
    stuckAimFallbackActive = useStuckFallback;
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
      window.SlimeAchievements?.onShot?.({
        levelShots: shots,
        usedRescue: usedStuckRescue
      });
      player.squish = 1;
      score = Math.max(0, score - 5);
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

