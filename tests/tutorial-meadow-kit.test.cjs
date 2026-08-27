"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8")
  .replace(/\r\n/g, "\n");
const plain = value => JSON.parse(JSON.stringify(value));
const tutorialsSource = read("js/tutorials.js");
const rendererSource = read("js/renderer.js");
const playerSource = read("js/player.js");

const tutorialDefinitionEnd = tutorialsSource.indexOf("  function drawTutorialSketch()");
assert.ok(tutorialDefinitionEnd > 0);

const drawOperations = [];
const context = vm.createContext({
  console,
  Math,
  Object,
  W: 1280,
  H: 720,
  worldTime: 0,
  state: "playing",
  generatedLevel: null,
  aiming: false,
  drag: {x: 3, y: 4},
  player: {x: 110, y: 590, r: 30, vx: 7, vy: 8, lastHorizontalDirection: 1},
  shots: 9,
  MAX_DRAG_DISTANCE: 330,
  MAX_LAUNCH_SPEED: 205 * 5.7,
  MIN_LAUNCH_DRAG: 10,
  AIM_TRAJECTORY_POINT_OUTLINE_WIDTH: 1.25,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ctx: {
    save() { drawOperations.push(["save"]); },
    restore() { drawOperations.push(["restore"]); },
    beginPath() { drawOperations.push(["beginPath"]); },
    moveTo(x, y) { drawOperations.push(["moveTo", x, y]); },
    lineTo(x, y) { drawOperations.push(["lineTo", x, y]); },
    stroke() { drawOperations.push(["stroke"]); },
    arc(x, y, radius) { drawOperations.push(["arc", x, y, radius]); },
    fill() { drawOperations.push(["fill"]); }
  },
  window: {SlimePerks: {isActiveForRun: () => false}},
  setCurrentAimBouncePreviewHit() {},
  getSlingshotLaunch() { throw new Error("real launch state must not be read by fake aim"); },
  findFirstSweptCircleRectContact() { throw new Error("tutorial aim must not test pads"); },
  drawPostBounceTrajectory() { throw new Error("tutorial aim must not draw bounce previews"); }
});
context.currentLevel = () => context.generatedLevel;
context.isTutorialStage = () => true;

vm.runInContext(`${tutorialsSource.slice(0, tutorialDefinitionEnd)}
  globalThis.tutorialDefinitionApi = {
    createTutorialLevel,
    resetTutorialDragHand,
    getTutorialDragHandTimelineState,
    timing: TUTORIAL_DRAG_HAND_TIMING
  };
`, context);

const tutorialOne = plain(context.tutorialDefinitionApi.createTutorialLevel(0));
const tutorialTwo = plain(context.tutorialDefinitionApi.createTutorialLevel(1));
const sharedGoal = {x: 1140, y: 475, w: 62, h: 92};
const sharedStart = {x: 0, y: 640, w: 235, h: 80};
const sharedGoalTower = {x: 1060, y: 570, w: 220, h: 150};
const sharedHazard = {
  x: 235,
  y: 690,
  w: 825,
  h: 30,
  isBottomDeathHazard: true
};

assert.deepEqual(tutorialOne.spawn, {x: 110, y: 590});
assert.deepEqual(tutorialOne.goal, sharedGoal);
assert.equal(tutorialOne.goalLabel, "FINISH");
assert.equal(tutorialOne.showDragHand, true);
assert.deepEqual(tutorialOne.platforms, [
  sharedStart,
  {x: 264, y: 610, w: 130, h: 26},
  {x: 423, y: 600, w: 130, h: 26},
  {x: 582, y: 590, w: 130, h: 26},
  {x: 741, y: 580, w: 130, h: 26},
  {x: 900, y: 570, w: 130, h: 26},
  sharedGoalTower
]);
assert.deepEqual(tutorialOne.spikes, [sharedHazard]);
assert.deepEqual(tutorialOne.stars, []);

assert.deepEqual(tutorialTwo.spawn, {x: 110, y: 590});
assert.deepEqual(tutorialTwo.goal, sharedGoal);
assert.equal(tutorialTwo.tutorialHeadline, "COLLECT STARS");
assert.deepEqual(tutorialTwo.platforms, [
  sharedStart,
  {x: 264, y: 560, w: 130, h: 26},
  {x: 423, y: 520, w: 130, h: 26},
  {x: 582, y: 555, w: 130, h: 26},
  {x: 741, y: 575, w: 130, h: 26},
  {x: 900, y: 570, w: 130, h: 26},
  sharedGoalTower
]);
assert.deepEqual(tutorialTwo.spikes, [sharedHazard]);
assert.deepEqual(tutorialTwo.stars, [
  {x: 285, y: 460},
  {x: 465, y: 420},
  {x: 610, y: 455}
]);
assert.equal(tutorialOne.platforms.filter(platform => platform.h === 26).length, 5);
assert.equal(tutorialTwo.platforms.filter(platform => platform.h === 26).length, 5);

const biomeGuardStart = rendererSource.indexOf("  function getActiveVisualBiome");
const biomeGuardEnd = rendererSource.indexOf("  let decorAttemptLevel", biomeGuardStart);
assert.ok(biomeGuardStart >= 0 && biomeGuardEnd > biomeGuardStart);
const biomeContext = vm.createContext({
  BIOMES: [{id: "meadow"}, {id: "night"}],
  BIOME_PLATFORM_VISUALS: {resolve: id => `platform:${id}`},
  BIOME_DECOR_VISUALS: {resolve: id => `decor:${id}`},
  BIOME_PORTAL_VISUALS: {resolve: id => `portal:${id}`},
  state: "playing",
  tutorial: true
});
biomeContext.isTutorialStage = () => biomeContext.tutorial;
vm.runInContext(`${rendererSource.slice(biomeGuardStart, biomeGuardEnd)}
  globalThis.biomeApi = {
    getActiveVisualBiome,
    getActiveBiomePlatformVisuals,
    getActiveBiomeDecorVisuals,
    getActiveBiomePortalVisuals
  };
`, biomeContext);
assert.equal(biomeContext.biomeApi.getActiveVisualBiome({id: "night"}).id, "meadow");
assert.equal(biomeContext.biomeApi.getActiveBiomePlatformVisuals({id: "night"}), "platform:meadow");
assert.equal(biomeContext.biomeApi.getActiveBiomeDecorVisuals({id: "night"}), "decor:meadow");
assert.equal(biomeContext.biomeApi.getActiveBiomePortalVisuals({id: "night"}), "portal:meadow");
biomeContext.tutorial = false;
assert.equal(biomeContext.biomeApi.getActiveBiomePlatformVisuals({id: "night"}), "platform:night");

const handStateStart = rendererSource.indexOf("  function getTutorialDragHandVisualState");
const handStateEnd = rendererSource.indexOf("  function drawTutorialDragHand()", handStateStart);
assert.ok(handStateStart >= 0 && handStateEnd > handStateStart);
vm.runInContext(`${rendererSource.slice(handStateStart, handStateEnd)}
  globalThis.handStateForTest = getTutorialDragHandVisualState;
`, context);

context.generatedLevel = tutorialOne;
context.worldTime = 0;
context.tutorialDefinitionApi.resetTutorialDragHand();
context.worldTime = 2.599;
const heldState = plain(context.handStateForTest());
assert.equal(heldState.released, false);
assert.equal(heldState.trailAlpha, 1);
assert.equal(heldState.touchAlpha, 1);
context.worldTime = 2.6;
const releaseState = plain(context.handStateForTest());
assert.equal(releaseState.released, true);
assert.equal(releaseState.trailAlpha, 0);
assert.equal(releaseState.touchAlpha, 0);
context.worldTime = 2.6001;
assert.ok(context.handStateForTest().handY < releaseState.handY);

const aimPreviewStart = rendererSource.indexOf("  function drawSlingshotPreview");
const aimPreviewEnd = rendererSource.indexOf("  function roundedCosmeticRectPath", aimPreviewStart);
assert.ok(aimPreviewStart >= 0 && aimPreviewEnd > aimPreviewStart);
vm.runInContext(`${rendererSource.slice(aimPreviewStart, aimPreviewEnd)}
  globalThis.aimPreviewApi = {drawTutorialAimLine, getTutorialSlingshotLaunch};
`, context);

const playerBefore = plain(context.player);
const dragBefore = plain(context.drag);
const shotsBefore = context.shots;
context.worldTime = 1.5;
assert.equal(context.aimPreviewApi.drawTutorialAimLine(), true);
assert.ok(drawOperations.some(operation => operation[0] === "stroke"));
assert.deepEqual(plain(context.player), playerBefore);
assert.deepEqual(plain(context.drag), dragBefore);
assert.equal(context.aiming, false);
assert.equal(context.shots, shotsBefore);

context.worldTime = 2.599;
assert.equal(context.aimPreviewApi.drawTutorialAimLine(), true);
const operationCountAtHold = drawOperations.length;
context.worldTime = 2.6;
assert.equal(context.aimPreviewApi.drawTutorialAimLine(), false);
assert.equal(drawOperations.length, operationCountAtHold);
context.worldTime = 2.3;
context.aiming = true;
assert.equal(context.aimPreviewApi.drawTutorialAimLine(), false);

assert.match(
  rendererSource,
  /drawTrajectory\(\);\s*drawTutorialAimLine\(\);\s*drawPlayer\(\);/
);
assert.match(playerSource, /aiming = true;\s*dismissTutorialDragHand\(\);/);

console.log("Tutorial Meadow geometry, explicit visuals, release timing and fake aim tests passed.");
