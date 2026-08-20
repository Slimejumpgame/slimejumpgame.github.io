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
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function loadPerksApi() {
  const unlocked = ["air_hop", "air_brake", "extra_life"];
  const localStorage = createStorage({
    slimejumperUnlockedPerks: JSON.stringify(unlocked),
    slimejumperSelectedPerks: JSON.stringify(unlocked)
  });
  const window = {};
  vm.runInNewContext(
    read("js/slime-perks.js"),
    {window, localStorage, console},
    {filename: "js/slime-perks.js"}
  );
  return {api: window.SlimePerks, localStorage, unlocked};
}

function assertPerkSelectionExclusivity() {
  const {api, localStorage, unlocked} = loadPerksApi();

  assert.equal(api.balance.AIR_BRAKE_HORIZONTAL_MULTIPLIER, 0.25);
  assert.equal(api.definitions.find(perk => perk.id === "air_brake").name, "AIR BRAKE");

  const legacySelection = Array.from(api.getStoredSelectedPerkIds());
  assert.deepEqual(legacySelection, ["air_hop", "extra_life"]);
  assert.deepEqual(
    JSON.parse(localStorage.snapshot().slimejumperUnlockedPerks).sort(),
    unlocked.slice().sort(),
    "legacy conflict handling must not change unlocks"
  );

  const selectAirBrake = api.toggleSelectedPerk("air_brake");
  assert.equal(selectAirBrake.ok, true);
  assert.deepEqual(Array.from(selectAirBrake.selected), ["extra_life", "air_brake"]);
  assert.equal(selectAirBrake.selected.includes("air_hop"), false);

  const airBrakeRunSnapshot = Array.from(api.captureRunPerkSnapshot());
  assert.equal(airBrakeRunSnapshot.includes("air_brake"), true);
  assert.equal(airBrakeRunSnapshot.includes("air_hop"), false);

  const selectAirHop = api.toggleSelectedPerk("air_hop");
  assert.equal(selectAirHop.ok, true);
  assert.equal(selectAirHop.selected.includes("air_hop"), true);
  assert.equal(selectAirHop.selected.includes("air_brake"), false);
}

function assertAirBrakeVelocityBehavior() {
  const playerSource = read("js/player.js");
  const functionStart = playerSource.indexOf("  function blockAirHopUntilExplicitLaunch");
  const functionEnd = playerSource.indexOf("  function getActiveLastBubbleSupportPlatforms", functionStart);
  assert.ok(functionStart >= 0 && functionEnd > functionStart);

  const context = vm.createContext({});
  vm.runInContext(
    `
      let activePerkId = "air_brake";
      let aimReady = false;
      let solidContact = false;
      const player = {x: 0, y: 0, r: 20, vx: 800, vy: -321, onGround: false, squish: 0};
      const window = {SlimePerks: {
        balance: {
          AIR_BRAKE_HORIZONTAL_MULTIPLIER: 0.25,
          AIR_HOP_VERTICAL_SPEED: 650
        },
        isActiveForRun: perkId => perkId === activePerkId
      }};
      let state = "playing";
      let aiming = false;
      let airHopUsedThisFlight = false;
      let airHopFlightActive = true;
      let airHopDetachmentStartedAt = null;
      let airHopBlockedUntilExplicitLaunch = false;
      let lastAirHopTrigger = "NONE";
      let worldTime = 1;
      const AIR_HOP_DETACHMENT_GRACE = 0.05;
      function isTutorialStage() { return false; }
      function hasValidAimSupport() { return false; }
      function hasSolidAirHopBlockingContact() { return solidContact; }
      function canAim() { return aimReady; }
      function tone() {}
      function spawnBurst() {}
    ` + playerSource.slice(functionStart, functionEnd) + `
      globalThis.airBrakeTestApi = {
        useAirBrake,
        useAirHop,
        consumeAirHopCanvasInput,
        blockAirHopUntilExplicitLaunch,
        updateAirHopFlightState,
        beginAirHopFlight,
        player,
        setActivePerk(id) { activePerkId = id; },
        setAimReady(value) { aimReady = value; },
        setSolidContact(value) { solidContact = value; },
        setWorldTime(value) { worldTime = value; },
        startNextFlight() {
          player.onGround = true;
          updateAirHopFlightState(false, true, false);
          player.onGround = false;
          beginAirHopFlight();
        }
      };
    `,
    context,
    {filename: "js/player-air-brake-test-slice.js"}
  );

  assert.equal(context.airBrakeTestApi.useAirBrake(), true);
  assert.equal(context.airBrakeTestApi.player.vx, 200);
  assert.equal(context.airBrakeTestApi.player.vy, -321);
  assert.equal(context.airBrakeTestApi.useAirBrake(), false);
  assert.equal(context.airBrakeTestApi.consumeAirHopCanvasInput("TOUCH"), false);
  assert.equal(context.airBrakeTestApi.player.vx, 200);
  assert.equal(context.airBrakeTestApi.player.vy, -321);

  context.airBrakeTestApi.startNextFlight();
  context.airBrakeTestApi.player.vx = -400;
  context.airBrakeTestApi.player.vy = 275;
  assert.equal(context.airBrakeTestApi.useAirBrake(), true);
  assert.equal(context.airBrakeTestApi.player.vx, -100);
  assert.equal(context.airBrakeTestApi.player.vy, 275);

  context.airBrakeTestApi.startNextFlight();
  context.airBrakeTestApi.player.vx = 600;
  context.airBrakeTestApi.setSolidContact(true);
  assert.equal(context.airBrakeTestApi.useAirBrake(), false);
  assert.equal(context.airBrakeTestApi.player.vx, 600);
  context.airBrakeTestApi.setSolidContact(false);

  context.airBrakeTestApi.setAimReady(true);
  assert.equal(context.airBrakeTestApi.consumeAirHopCanvasInput("MOUSE"), false);
  assert.equal(context.airBrakeTestApi.player.vx, 600);
  context.airBrakeTestApi.setAimReady(false);
  assert.equal(context.airBrakeTestApi.consumeAirHopCanvasInput("MOUSE"), true);
  assert.equal(context.airBrakeTestApi.player.vx, 150);

  context.airBrakeTestApi.startNextFlight();
  context.airBrakeTestApi.setActivePerk("air_hop");
  context.airBrakeTestApi.player.vx = 700;
  context.airBrakeTestApi.player.vy = 123;
  assert.equal(context.airBrakeTestApi.useAirHop("MOUSE"), true);
  assert.equal(context.airBrakeTestApi.player.vx, 700);
  assert.equal(context.airBrakeTestApi.player.vy, -650);

  context.airBrakeTestApi.startNextFlight();
  context.airBrakeTestApi.blockAirHopUntilExplicitLaunch();
  context.airBrakeTestApi.updateAirHopFlightState(false, false, false);
  assert.equal(context.airBrakeTestApi.useAirHop("MOUSE"), false);
  assert.equal(context.airBrakeTestApi.consumeAirHopCanvasInput("MOUSE"), false);

  context.airBrakeTestApi.beginAirHopFlight();
  assert.equal(context.airBrakeTestApi.useAirHop("MOUSE"), true);

  context.airBrakeTestApi.blockAirHopUntilExplicitLaunch();
  context.airBrakeTestApi.player.onGround = true;
  context.airBrakeTestApi.updateAirHopFlightState(false, true, false);
  context.airBrakeTestApi.player.onGround = false;
  context.airBrakeTestApi.setWorldTime(2);
  context.airBrakeTestApi.updateAirHopFlightState(true, false, false);
  context.airBrakeTestApi.setWorldTime(2.06);
  context.airBrakeTestApi.updateAirHopFlightState(false, false, false);
  assert.equal(context.airBrakeTestApi.useAirHop("TOUCH"), false);
  assert.equal(context.airBrakeTestApi.consumeAirHopCanvasInput("TOUCH"), false);

  context.airBrakeTestApi.beginAirHopFlight();
  assert.equal(context.airBrakeTestApi.useAirHop("TOUCH"), true);
  context.airBrakeTestApi.blockAirHopUntilExplicitLaunch();
  context.airBrakeTestApi.updateAirHopFlightState(false, false, true);
  assert.equal(context.airBrakeTestApi.useAirHop("TOUCH"), false);

  context.airBrakeTestApi.player.onGround = true;
  context.airBrakeTestApi.updateAirHopFlightState(false, true, false);
  context.airBrakeTestApi.player.onGround = false;
  context.airBrakeTestApi.updateAirHopFlightState(true, false, true);
  assert.equal(context.airBrakeTestApi.useAirHop("TOUCH"), true);

  context.airBrakeTestApi.startNextFlight();
  context.airBrakeTestApi.setActivePerk("air_brake");
  context.airBrakeTestApi.blockAirHopUntilExplicitLaunch();
  context.airBrakeTestApi.player.vx = 400;
  assert.equal(context.airBrakeTestApi.useAirBrake(), true);
  assert.equal(context.airBrakeTestApi.player.vx, 100);
}

function assertInputAndRecoveryIntegration() {
  const playerSource = read("js/player.js");
  const physicsSource = read("js/physics.js");
  const inputStart = playerSource.indexOf("  function consumeAirHopCanvasInput");
  const inputEnd = playerSource.indexOf("  function getActiveLastBubbleSupportPlatforms", inputStart);
  const inputSource = playerSource.slice(inputStart, inputEnd);

  assert.match(inputSource, /if \(canAim\(\)\) return false;/);
  assert.match(inputSource, /return useAirHop\(trigger\) \|\| useAirBrake\(\);/);
  assert.match(
    physicsSource,
    /if \(!landingOnBouncePad\) blockAirHopUntilExplicitLaunch\(\);/
  );
  assert.match(
    playerSource,
    /function canUseAirHop\(\) \{\s*return !airHopBlockedUntilExplicitLaunch && canUseFlightAction\("air_hop"\);/
  );
  assert.match(
    playerSource,
    /if \(isOnGround\) \{\s*if \(!wasOnGround\) airHopUsedThisFlight = false;/
  );
  assert.doesNotMatch(playerSource, /QUICK_RECOVERY_|quickRecoveryTimer|isQuickRecoveryAimReady/);
  assert.doesNotMatch(
    physicsSource,
    /registerQuickRecoveryHardLanding|updateQuickRecovery|applyQuickRecoveryHorizontalDamping/
  );

  const airHopStart = playerSource.indexOf("  function useAirHop(trigger)");
  const airHopEnd = playerSource.indexOf("  function useAirBrake()", airHopStart);
  const airHopSource = playerSource.slice(airHopStart, airHopEnd);
  assert.match(airHopSource, /player\.vy = -window\.SlimePerks\.balance\.AIR_HOP_VERTICAL_SPEED;/);
  assert.doesNotMatch(airHopSource, /player\.vx\s*=/);
}

assertPerkSelectionExclusivity();
assertAirBrakeVelocityBehavior();
assertInputAndRecoveryIntegration();
console.log("Air Brake perk tests passed.");
