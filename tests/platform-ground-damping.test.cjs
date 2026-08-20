"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadGroundDampingApi() {
  const source = read("js/player.js");
  const start = source.indexOf("  function isGhostStepActive()");
  const end = source.indexOf("  function canUseNormalAim()", start);
  assert.ok(start >= 0 && end > start);

  const context = vm.createContext({});
  vm.runInContext(`
    const NORMAL_SAFE_GROUND_DAMPING = 0.90;
    const NORMAL_SAFE_GROUND_DAMPING_REFERENCE_FPS = 60;
    const AIM_SUPPORT_TOLERANCE = 4;
    const player = {x: 60, y: 70, r: 30, vx: 100, onGround: true};
    let state = "playing";
    let aiming = false;
    let platforms = [];
    let pads = [];
    let activePerkId = null;
    const window = {SlimePerks: {
      isActiveForRun: id => id === activePerkId
    }};
    function currentLevel() { return {pads}; }
    function getPlatforms() { return platforms; }
    function intersectsRect() { return pads.length > 0; }
    function isLastBubbleProtectionActive() { return false; }
  ` + source.slice(start, end) + `
    globalThis.groundDampingTestApi = {
      player,
      usesNormalGroundDamping,
      applyNormalSafeGroundDamping,
      setPlatforms(value) { platforms = value; },
      setPads(value) { pads = value; },
      setActivePerk(id) { activePerkId = id; }
    };
  `, context, {filename: "js/player-platform-ground-damping-test-slice.js"});
  return context.groundDampingTestApi;
}

function support(overrides = {}) {
  return {x: 0, y: 100, w: 120, h: 30, ...overrides};
}

function assertNormalDamping(api, platform, message, activePerkId = null) {
  api.player.vx = 100;
  api.player.onGround = true;
  api.setPads([]);
  api.setActivePerk(activePerkId);
  api.setPlatforms([platform]);
  assert.equal(api.applyNormalSafeGroundDamping(1 / 60), true, message);
  assert.ok(Math.abs(api.player.vx - 90) < 1e-9, message);
}

const api = loadGroundDampingApi();

assertNormalDamping(api, support(), "normal platform uses confirmed damping");
assertNormalDamping(
  api,
  support({moving: true, movingData: {axis: "x"}}),
  "horizontal moving platform keeps confirmed damping"
);
assertNormalDamping(
  api,
  support({moving: true, movingData: {axis: "y"}}),
  "vertical moving platform keeps confirmed damping"
);
assertNormalDamping(
  api,
  support({conveyor: true, conveyorData: {}}),
  "conveyor platform uses confirmed damping"
);
assertNormalDamping(
  api,
  support({fallingPlatform: {triggered: false}}),
  "falling platform uses confirmed damping"
);
assertNormalDamping(
  api,
  support({fade: true, fadeData: {solid: true}}),
  "solid fade platform uses confirmed damping"
);
assertNormalDamping(
  api,
  support({fade: true, fadeData: {solid: false}}),
  "Ghost Step-supported fade platform uses confirmed damping",
  "ghost_step"
);
assertNormalDamping(
  api,
  support({spikePlatform: true, spikeData: {extension: 0}}),
  "spike platform uses confirmed damping"
);
assertNormalDamping(
  api,
  support({fallingPlatform: {triggered: false}}),
  "unrelated perks cannot disable normal ground damping",
  "mud_shoes"
);

api.setActivePerk(null);
api.setPads([]);
api.setPlatforms([support({fade: true, fadeData: {solid: false}})]);
api.player.vx = 100;
assert.equal(api.applyNormalSafeGroundDamping(1 / 60), false);
assert.equal(api.player.vx, 100, "non-solid fade platform stays non-supporting");

for (const [name, platform] of [
  ["ice platform", support({ice: true, iceData: {}})],
  ["Last Bubble support", support({lastBubbleSupport: true})]
]) {
  api.setPlatforms([platform]);
  api.player.vx = 100;
  assert.equal(api.applyNormalSafeGroundDamping(1 / 60), false, `${name} stays separate`);
  assert.equal(api.player.vx, 100, `${name} is not normalized by common damping`);
}

api.setPlatforms([support()]);
api.setPads([{}]);
api.player.vx = 100;
assert.equal(api.applyNormalSafeGroundDamping(1 / 60), false);
assert.equal(api.player.vx, 100, "bounce-pad contact stays separate");

const physicsSource = read("js/physics.js");
const platformsSource = read("js/platforms.js");
const playerSource = read("js/player.js");

assert.match(
  physicsSource,
  /else if \(landingOnBouncePad \|\| !usesNormalGroundDamping\(rect\)\) \{\s*player\.vx \*= 0\.988;/,
  "normal platform types do not receive the separate collision damping"
);
assert.doesNotMatch(physicsSource, /!isNormalSafeStaticPlatform\(rect\)/);
assert.match(
  physicsSource,
  /player\.vy = -getBouncePadVerticalSpeed\(impactSpeed\);\s*applyBouncePadMinimumHorizontalSpeed\(\);\s*player\.onGround = false;/,
  "bounce-pad launch remains separate"
);
assert.match(physicsSource, /if \(rect\.fallingPlatform && !rect\.fallingPlatform\.triggered\)/);
assert.match(physicsSource, /tryHandleProtectedDeadlyContact\("spike_platform"\)/);
assert.match(physicsSource, /MUD_SHOES_HORIZONTAL_DAMPING/);
assert.match(
  playerSource,
  /STAR_SHIELD_PROTECTION_REASONS = Object\.freeze\(\[\s*"spike_platform",\s*"ghost",\s*"fast_ghost"/,
  "Star Shield keeps spike and ghost protection"
);
assert.match(platformsSource, /ANCHOR_STEP_STABILITY_DURATION/);
assert.match(platformsSource, /platform\.opacity = 0\.06 \+ wave \* 0\.94;/);
assert.match(platformsSource, /function updateSpikePlatforms\(\)/);

console.log("Platform ground damping tests passed.");
