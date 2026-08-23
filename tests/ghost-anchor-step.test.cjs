"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function assertPerkIdentityAndPersistence() {
  const localStorage = createStorage({
    slimejumperUnlockedPerks: '["anchor_step","ghost_step"]',
    slimejumperSelectedPerks: '["anchor_step","ghost_step"]'
  });
  const window = {};
  vm.runInNewContext(read("js/slime-perks.js"), {
    window,
    localStorage,
    DEV_MODE: false,
    console
  });

  const anchorStep = window.SlimePerks.definitions.find(perk => perk.id === "anchor_step");
  const ghostStep = window.SlimePerks.definitions.find(perk => perk.id === "ghost_step");
  assert.equal(anchorStep.name, "ANCHOR STEP");
  assert.equal(ghostStep.name, "GHOST STEP");
  assert.equal(window.SlimePerks.balance.ANCHOR_STEP_STABILITY_DURATION, 5);
  assert.deepEqual(
    Array.from(window.SlimePerks.getStoredUnlockedPerkIds()),
    ["anchor_step", "ghost_step"]
  );
  assert.deepEqual(
    Array.from(window.SlimePerks.getStoredSelectedPerkIds()),
    ["anchor_step", "ghost_step"]
  );
}

function assertGhostStepSupportRules() {
  const source = read("js/player.js");
  const start = source.indexOf("  function isGhostStepActive()");
  const end = source.indexOf("  function isPlayerTouchingBouncePad()", start);
  assert.ok(start >= 0 && end > start);

  const context = vm.createContext({
    window: {
      SlimePerks: {
        isActiveForRun(id) {
          return id === "ghost_step" && context.ghostStepActive;
        }
      }
    },
    ghostStepActive: false,
    player: {x: 50, y: 70, r: 30},
    AIM_SUPPORT_TOLERANCE: 4,
    getPlatforms: () => []
  });
  vm.runInContext(source.slice(start, end) + `
    globalThis.ghostStepTestApi = {
      isFadePlatformSolidForPlayer,
      isValidAimSupportPlatform,
      isNormalSafeStaticPlatform
    };
  `, context);

  const hiddenFadePlatform = {
    x: 0,
    y: 100,
    w: 100,
    h: 20,
    fade: true,
    fadeData: {solid: false, opacity: 0.06}
  };
  assert.equal(
    context.ghostStepTestApi.isFadePlatformSolidForPlayer(hiddenFadePlatform),
    false
  );
  assert.equal(context.ghostStepTestApi.isValidAimSupportPlatform(hiddenFadePlatform), false);
  assert.equal(context.ghostStepTestApi.isNormalSafeStaticPlatform(hiddenFadePlatform), false);

  context.ghostStepActive = true;
  assert.equal(
    context.ghostStepTestApi.isFadePlatformSolidForPlayer(hiddenFadePlatform),
    true
  );
  assert.equal(context.ghostStepTestApi.isValidAimSupportPlatform(hiddenFadePlatform), true);
  assert.equal(context.ghostStepTestApi.isNormalSafeStaticPlatform(hiddenFadePlatform), true);
}

function assertGhostStepCollisionAndOneShotFallingActivation() {
  const source = read("js/physics.js");
  const start = source.indexOf("  function circleRectCollision(circle, rect)");
  const end = source.indexOf("  function getSpikeDangerRect(spike)", start);
  assert.ok(start >= 0 && end > start);

  const player = {x: 50, y: 80, r: 30, vx: 0, vy: 100, onGround: false};
  const context = vm.createContext({
    player,
    ghostStepActive: false,
    anchorStepActive: true,
    worldTime: 42,
    isFadePlatformSolidForPlayer(platform) {
      return !platform.fade || platform.fadeData.solid || context.ghostStepActive;
    },
    currentLevel: () => ({pads: []}),
    window: {
      SlimePerks: {
        balance: {
          MUD_SHOES_REBOUND_MULTIPLIER: 0.55,
          MUD_SHOES_HORIZONTAL_DAMPING: 0.75
        },
        isActiveForRun: () => false
      }
    },
    isNormalSafeStaticPlatform: platform => !platform.fallingPlatform,
    usesNormalGroundDamping: platform => !platform.ice && !platform.lastBubbleSupport,
    blockAirHopUntilExplicitLaunch() {},
    isAnchorStepActive: () => context.anchorStepActive,
    getFallingPlatformActivationDelay: () => context.anchorStepActive ? 5 : 1.15,
    tone() {},
    spawnBurst() {},
    playBounce() {}
  });
  vm.runInContext(source.slice(start, end) + `
    globalThis.resolvePlatformForTest = resolvePlatform;
  `, context);

  const hiddenFadePlatform = {
    x: 0,
    y: 100,
    w: 100,
    h: 20,
    fade: true,
    fadeData: {solid: false}
  };
  context.resolvePlatformForTest(hiddenFadePlatform);
  assert.equal(player.y, 80);
  assert.equal(player.vy, 100);
  assert.equal(player.onGround, false);

  context.ghostStepActive = true;
  context.resolvePlatformForTest(hiddenFadePlatform);
  assert.equal(player.y, 70);
  assert.ok(player.vy < 0);
  assert.equal(player.onGround, true);

  const fallingRuntime = {
    delay: 1.15,
    timer: 0,
    triggered: false,
    falling: false
  };
  const fallingPlatform = {
    x: 0,
    y: 100,
    w: 100,
    h: 20,
    fallingPlatform: fallingRuntime
  };
  Object.assign(player, {x: 50, y: 80, vx: 0, vy: 100, onGround: false});
  context.resolvePlatformForTest(fallingPlatform);
  assert.equal(fallingRuntime.triggered, true);
  assert.equal(fallingRuntime.timer, 5);
  assert.equal(fallingRuntime.anchorStepWarningStartedAt, 42);

  fallingRuntime.timer = 3;
  context.worldTime = 44;
  Object.assign(player, {x: 50, y: 80, vx: 0, vy: 100, onGround: false});
  context.resolvePlatformForTest(fallingPlatform);
  assert.equal(fallingRuntime.timer, 3);
  assert.equal(fallingRuntime.anchorStepWarningStartedAt, 42);
}

function assertFadeAnimationRemainsVisual() {
  const source = read("js/platforms.js");
  const start = source.indexOf("  function updateFadePlatforms()");
  const end = source.indexOf("  function updateSpikePlatforms()", start);
  assert.ok(start >= 0 && end > start);

  const platform = {
    x: 0,
    y: 100,
    w: 100,
    h: 20,
    startTime: 0,
    speed: 1,
    phase: Math.PI,
    opacity: 1,
    solid: true
  };
  const context = vm.createContext({
    currentLevel: () => ({fadePlatforms: [platform]}),
    worldTime: 0,
    player: {x: 50, y: 70, r: 30},
    aiming: true,
    drag: {x: 12, y: 8},
    canvas: {classList: {remove() {}}},
    ghostStepActive: false,
    isGhostStepActive: () => context.ghostStepActive
  });
  vm.runInContext(source.slice(start, end) + `
    globalThis.updateFadePlatformsForTest = updateFadePlatforms;
  `, context);

  context.updateFadePlatformsForTest();
  assert.equal(platform.opacity, 0.06);
  assert.equal(platform.solid, false);
  assert.equal(context.aiming, false);

  platform.opacity = 1;
  platform.solid = true;
  context.aiming = true;
  context.drag.x = 12;
  context.drag.y = 8;
  context.ghostStepActive = true;
  context.updateFadePlatformsForTest();
  assert.equal(platform.opacity, 0.06);
  assert.equal(platform.solid, false);
  assert.equal(context.aiming, true);
  assert.equal(context.drag.x, 12);
  assert.equal(context.drag.y, 8);
}

function assertAnchorStepTimer() {
  const source = read("js/platforms.js");
  const start = source.indexOf("  function updateFallingPlatforms(dt)");
  const end = source.indexOf("  function updateFadePlatforms()", start);
  assert.ok(start >= 0 && end > start);

  const platform = {
    x: 0,
    y: 100,
    w: 100,
    h: 20,
    currentY: 100,
    delay: 1.15,
    timer: 0,
    vy: 0,
    triggered: false,
    falling: false,
    removed: false
  };
  const context = vm.createContext({
    window: {
      SlimePerks: {
        balance: {ANCHOR_STEP_STABILITY_DURATION: 5},
        isActiveForRun(id) {
          return id === "anchor_step" && context.anchorStepActive;
        }
      }
    },
    anchorStepActive: false,
    currentLevel: () => ({fallingPlatforms: [platform]}),
    player: {x: 500, y: 500, r: 30},
    stuckAimFallbackActive: false,
    stuckAimFallbackFallingPlatform: null,
    aiming: false,
    stopAiming() {},
    H: 1080
  });
  vm.runInContext(source.slice(start, end) + `
    globalThis.anchorStepTestApi = {
      getFallingPlatformActivationDelay,
      updateFallingPlatforms
    };
  `, context);

  assert.equal(context.anchorStepTestApi.getFallingPlatformActivationDelay(platform), 1.15);
  context.anchorStepActive = true;
  assert.equal(context.anchorStepTestApi.getFallingPlatformActivationDelay(platform), 5);

  platform.triggered = true;
  platform.timer = context.anchorStepTestApi.getFallingPlatformActivationDelay(platform);
  context.anchorStepTestApi.updateFallingPlatforms(2);
  assert.equal(platform.timer, 3);
  assert.equal(platform.falling, false);
  context.anchorStepTestApi.updateFallingPlatforms(2.9);
  assert.ok(Math.abs(platform.timer - 0.1) < 1e-9);
  assert.equal(platform.falling, false);
  context.anchorStepTestApi.updateFallingPlatforms(0.11);
  assert.equal(platform.falling, true);
  assert.equal(platform.vy, 35);
}

function assertAnchorStepWarningTimingAndBorderOnly() {
  const source = read("js/renderer.js");
  const start = source.indexOf("  const ANCHOR_STEP_WARNING_BLINK_COUNT");
  const end = source.indexOf("  function drawPlatforms(", start);
  assert.ok(start >= 0 && end > start);

  const platform = {
    x: 0,
    y: 100,
    currentY: 100,
    w: 120,
    h: 30,
    triggered: true,
    falling: false,
    anchorStepWarningStartedAt: 100
  };
  const drawCalls = [];
  const context = vm.createContext({
    window: {SlimePerks: {balance: {ANCHOR_STEP_STABILITY_DURATION: 5}}},
    worldTime: 100,
    anchorStepActive: true,
    isAnchorStepActive: () => context.anchorStepActive,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    ctx: {
      save() { drawCalls.push("save"); },
      restore() { drawCalls.push("restore"); },
      stroke() { drawCalls.push("stroke"); },
      set strokeStyle(value) { drawCalls.push(["strokeStyle", value]); },
      set lineWidth(value) { drawCalls.push(["lineWidth", value]); },
      set shadowColor(value) { drawCalls.push(["shadowColor", value]); },
      set shadowBlur(value) { drawCalls.push(["shadowBlur", value]); }
    },
    roundedRect(x, y, w, h, radius) {
      drawCalls.push(["roundedRect", x, y, w, h, radius]);
    }
  });
  vm.runInContext(source.slice(start, end) + `
    globalThis.anchorWarningTestApi = {
      getAnchorStepWarningGlow,
      drawAnchorStepWarningBorder
    };
  `, context);

  const assertBlinkAt = elapsed => {
    context.worldTime = platform.anchorStepWarningStartedAt + elapsed;
    assert.ok(
      context.anchorWarningTestApi.getAnchorStepWarningGlow(platform) > 0.99,
      `expected Anchor Step border blink at ${elapsed.toFixed(2)} seconds`
    );
  };
  [0, 1.25, 2.5, 3.75].forEach(assertBlinkAt);
  context.worldTime = 104.99;
  assert.equal(context.anchorWarningTestApi.getAnchorStepWarningGlow(platform), 0);

  platform.falling = true;
  assertBlinkAt(5);
  context.worldTime = 105.19;
  assert.equal(context.anchorWarningTestApi.getAnchorStepWarningGlow(platform), 0);
  context.worldTime = 106.25;
  assert.equal(context.anchorWarningTestApi.getAnchorStepWarningGlow(platform), 0);

  context.worldTime = 102.5;
  drawCalls.length = 0;
  context.anchorWarningTestApi.drawAnchorStepWarningBorder(platform, platform.x);
  assert.equal(drawCalls.filter(call => call === "stroke").length, 1);
  assert.deepEqual(
    drawCalls.find(call => Array.isArray(call) && call[0] === "roundedRect"),
    ["roundedRect", -1, 99, 122, 32, 11]
  );

  context.anchorStepActive = false;
  [0, 1.25, 2.5, 3.75, 5].forEach(elapsed => {
    context.worldTime = platform.anchorStepWarningStartedAt + elapsed;
    assert.equal(context.anchorWarningTestApi.getAnchorStepWarningGlow(platform), 0);
  });

  const borderSource = source.slice(
    source.indexOf("  function drawAnchorStepWarningBorder"),
    source.indexOf("  function drawPlatforms(")
  );
  assert.match(borderSource, /ctx\.stroke\(\);/);
  assert.doesNotMatch(borderSource, /ctx\.fill\(\);|ctx\.fillStyle/);
}

function assertGhostStepOutlineIsVisualOnly() {
  const source = read("js/renderer.js");
  const start = source.indexOf("  function drawGhostStepFadeOutline");
  const end = source.indexOf("  function drawPlatforms(", start);
  assert.ok(start >= 0 && end > start);

  const drawCalls = [];
  const context = vm.createContext({
    ghostStepActive: true,
    isGhostStepActive: () => context.ghostStepActive,
    ctx: {
      save() { drawCalls.push("save"); },
      restore() { drawCalls.push("restore"); },
      stroke() { drawCalls.push("stroke"); },
      set globalAlpha(value) { drawCalls.push(["globalAlpha", value]); },
      set strokeStyle(value) { drawCalls.push(["strokeStyle", value]); },
      set lineWidth(value) { drawCalls.push(["lineWidth", value]); },
      set shadowColor(value) { drawCalls.push(["shadowColor", value]); },
      set shadowBlur(value) { drawCalls.push(["shadowBlur", value]); }
    },
    roundedRect(x, y, w, h, radius) {
      drawCalls.push(["roundedRect", x, y, w, h, radius]);
    }
  });
  vm.runInContext(source.slice(start, end) + `
    globalThis.drawGhostStepFadeOutlineForTest = drawGhostStepFadeOutline;
  `, context);

  const fadedPlatform = {x: 0, y: 100, w: 120, h: 30, fade: true};
  context.drawGhostStepFadeOutlineForTest(fadedPlatform, fadedPlatform.x);
  assert.equal(drawCalls.filter(call => call === "stroke").length, 1);
  assert.deepEqual(
    drawCalls.find(call => Array.isArray(call) && call[0] === "globalAlpha"),
    ["globalAlpha", 1]
  );
  assert.deepEqual(
    drawCalls.find(call => Array.isArray(call) && call[0] === "roundedRect"),
    ["roundedRect", -1, 99, 122, 32, 11]
  );

  drawCalls.length = 0;
  context.ghostStepActive = false;
  context.drawGhostStepFadeOutlineForTest(fadedPlatform, fadedPlatform.x);
  assert.deepEqual(drawCalls, []);

  drawCalls.length = 0;
  context.ghostStepActive = true;
  context.drawGhostStepFadeOutlineForTest(
    {...fadedPlatform, fade: false},
    fadedPlatform.x
  );
  assert.deepEqual(drawCalls, []);

  const outlineSource = source.slice(start, end);
  assert.match(outlineSource, /ctx\.stroke\(\);/);
  assert.doesNotMatch(outlineSource, /ctx\.fill\(\);|ctx\.fillStyle/);
  assert.match(source, /if \(p\.fade\) ctx\.globalAlpha = p\.fadeData\.opacity;/);
}

function assertScopedIntegration() {
  const physics = read("js/physics.js");
  const player = read("js/player.js");
  const platforms = read("js/platforms.js");
  const renderer = read("js/renderer.js");
  const game = read("js/game.js");
  const perks = read("js/slime-perks.js");
  const achievements = read("js/slime-achievements.js");
  const ui = read("js/ui.js");

  assert.match(physics, /if \(!isFadePlatformSolidForPlayer\(rect\)\) return;/);
  assert.match(physics, /if \(rect\.fallingPlatform && !rect\.fallingPlatform\.triggered\)/);
  assert.match(physics, /rect\.fallingPlatform\.timer = getFallingPlatformActivationDelay/);
  assert.doesNotMatch(physics, /applySlowFallDrag|SLOW_FALL_TRIGGER_SPEED|SLOW_FALL_DRAG/);
  assert.doesNotMatch(player, /tryUseSecondChance|secondChanceSafeAnchor|SECOND_CHANCE_RESCUE_REASONS/);
  assert.match(player, /isStarShieldProtectionActive\(\)/);
  assert.match(player, /function tryHandleLastBubbleContact/);
  assert.match(platforms, /platform\.timer -= dt;/);
  assert.match(renderer, /if \(p\.fade\) ctx\.globalAlpha = p\.fadeData\.opacity;/);
  assert.match(renderer, /getFallingPlatformActivationDelay\(/);
  assert.match(game, /platform\.timer = 0;[\s\S]*?platform\.triggered = false;[\s\S]*?platform\.falling = false;/);
  assert.doesNotMatch(perks, /SLOW_FALL_TERMINAL_SPEED|SLOW_FALL_DRAG/);
  assert.match(achievements, /id: "secret_second_chance"/);
  assert.match(ui, /perks\.definitions\.forEach\(perk => \{/);
  assert.match(ui, /const purchase = perks\.purchasePerk\(perk\.id\);/);
}

assertPerkIdentityAndPersistence();
assertGhostStepSupportRules();
assertGhostStepCollisionAndOneShotFallingActivation();
assertFadeAnimationRemainsVisual();
assertAnchorStepTimer();
assertAnchorStepWarningTimingAndBorderOnly();
assertGhostStepOutlineIsVisualOnly();
assertScopedIntegration();
console.log("Ghost Step and Anchor Step tests passed.");
