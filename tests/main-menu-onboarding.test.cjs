"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = relativePath =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const uiSource = read("js/ui.js");
const htmlSource = read("index.html");
const cssSource = read("css/style.css");
const gameSource = read("js/game.js");
const controllerStart = uiSource.indexOf("  const MAIN_MENU_ONBOARDING_VERSION");
const controllerEnd = uiSource.indexOf(
  "  function openUpdateStorePage",
  controllerStart
);
assert.ok(controllerStart >= 0 && controllerEnd > controllerStart);
const controllerSource = uiSource.slice(controllerStart, controllerEnd);

class FakeClassList {
  constructor(values = []) {
    this.values = new Set(values);
  }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(documentObject, {classes = [], rect = null} = {}) {
    this.documentObject = documentObject;
    this.classList = new FakeClassList(classes);
    this.attributes = new Map();
    this.dataset = {};
    this.style = {
      setProperty(name, value) { this[name] = String(value); }
    };
    this.rect = rect;
    this.textContent = "";
    this.disabled = false;
    this.parentVisibility = null;
    this.queryResults = new Map();
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  getBoundingClientRect() {
    const source = this.rect ?? {left: 0, top: 0, width: 350, height: 210};
    const left = Number.parseFloat(this.style.left) || source.left;
    const top = Number.parseFloat(this.style.top) || source.top;
    const width = source.width;
    const height = source.height;
    return {left, top, width, height, right: left + width, bottom: top + height};
  }
  querySelectorAll(selector) {
    const results = this.queryResults.get(selector) ?? [];
    return selector.includes(":not([disabled])")
      ? results.filter(element => !element.disabled)
      : results;
  }
  closest(selector) {
    if (selector !== ".hidden") return null;
    return this.classList.contains("hidden") ||
      this.parentVisibility?.classList.contains("hidden")
      ? this
      : null;
  }
  focus() {
    this.focusCount += 1;
    this.documentObject.activeElement = this;
  }
}

function createStorage(initial = {}, {readError = false, writeError = false} = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key, String(value)])
  );
  const writes = [];
  const removals = [];
  return {
    getItem(key) {
      if (readError) throw new Error("read denied");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (writeError) throw new Error("write denied");
      writes.push([String(key), String(value)]);
      values.set(String(key), String(value));
    },
    removeItem(key) {
      removals.push(String(key));
      values.delete(String(key));
    },
    snapshot: () => Object.fromEntries(values),
    writes,
    removals
  };
}

function createFixture({
  storage = createStorage(),
  state = "menu",
  menuVisible = true,
  updateVisible = false,
  invalidTarget = null,
  version = "main-menu-onboarding-v1"
} = {}) {
  let nextFrameId = 1;
  const frames = new Map();
  const popupPauseCalls = [];
  const documentObject = {
    activeElement: null,
    body: null,
    elements: new Map(),
    getElementById(id) { return this.elements.get(id) ?? null; },
    querySelectorAll(selector) {
      return selector === '[aria-modal="true"]' ? this.modals : [];
    },
    modals: []
  };
  documentObject.body = new FakeElement(documentObject);
  const previousFocus = new FakeElement(documentObject);
  documentObject.activeElement = previousFocus;

  const targetIds = [
    "menuPersonalBest",
    "menuXPProgress",
    "menuStarBalance",
    "personalGlobalRank",
    "recentAchievements",
    "achievementsBtn",
    "wardrobeBtn",
    "perksBtn",
    "highScoresBtn",
    "mainMenuGraphics"
  ];
  targetIds.forEach((id, index) => {
    const target = new FakeElement(documentObject, {
      rect: {
        left: 80 + (index % 4) * 185,
        top: 45 + Math.floor(index / 4) * 170,
        width: id === "mainMenuGraphics" ? 125 : 145,
        height: 54
      }
    });
    if (id === invalidTarget) target.rect.width = 0;
    documentObject.elements.set(id, target);
  });

  const overlay = new FakeElement(documentObject, {classes: ["hidden"]});
  overlay.setAttribute("aria-hidden", "true");
  const updateOverlay = new FakeElement(documentObject, {
    classes: updateVisible ? [] : ["hidden"]
  });
  updateOverlay.setAttribute("aria-hidden", updateVisible ? "false" : "true");
  documentObject.modals = [overlay, updateOverlay];
  const dimElements = ["top", "right", "bottom", "left"].map(position => {
    const element = new FakeElement(documentObject);
    element.dataset.onboardingDim = position;
    return element;
  });
  overlay.queryResults.set("[data-onboarding-dim]", dimElements);

  const mainMenuScreen = new FakeElement(documentObject);
  const message = new FakeElement(documentObject, {classes: ["hidden"]});
  const safeArea = new FakeElement(documentObject, {
    rect: {left: 8, top: 8, width: 1264, height: 704}
  });
  const bubble = new FakeElement(documentObject, {
    rect: {left: 0, top: 0, width: 350, height: 210}
  });
  const navigation = new FakeElement(documentObject);
  const decision = new FakeElement(documentObject, {classes: ["hidden"]});
  const buttonNames = ["Back", "Next", "Skip", "Later", "Never"];
  const buttons = Object.fromEntries(buttonNames.map(name => [
    name,
    new FakeElement(documentObject)
  ]));
  buttons.Back.parentVisibility = navigation;
  buttons.Next.parentVisibility = navigation;
  buttons.Skip.parentVisibility = navigation;
  buttons.Later.parentVisibility = decision;
  buttons.Never.parentVisibility = decision;
  overlay.queryResults.set(
    "button:not([disabled])",
    Object.values(buttons)
  );

  const ui = {
    menu: new FakeElement(documentObject),
    mainMenuScreen,
    message,
    mainMenuOnboardingOverlay: overlay,
    mainMenuOnboardingSafeArea: safeArea,
    mainMenuOnboardingHighlight: new FakeElement(documentObject),
    mainMenuOnboardingBubble: bubble,
    mainMenuOnboardingTitle: new FakeElement(documentObject),
    mainMenuOnboardingCount: new FakeElement(documentObject),
    mainMenuOnboardingText: new FakeElement(documentObject),
    mainMenuOnboardingNavigation: navigation,
    mainMenuOnboardingDecision: decision,
    mainMenuOnboardingBackBtn: buttons.Back,
    mainMenuOnboardingNextBtn: buttons.Next,
    mainMenuOnboardingSkipBtn: buttons.Skip,
    mainMenuOnboardingLaterBtn: buttons.Later,
    mainMenuOnboardingNeverBtn: buttons.Never,
    startBtn: new FakeElement(documentObject)
  };
  const windowObject = {
    innerWidth: 1280,
    innerHeight: 720,
    SlimeAchievements: {
      setPopupsPaused(paused) { popupPauseCalls.push(paused); }
    },
    requestAnimationFrame(callback) {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    visualViewport: {
      offsetLeft: 0,
      offsetTop: 0,
      width: 1280,
      height: 720
    }
  };
  const context = vm.createContext({
    console,
    document: documentObject,
    localStorage: storage,
    ui,
    window: windowObject
  });
  const selectedControllerSource = version === "main-menu-onboarding-v1"
    ? controllerSource
    : controllerSource.replaceAll("main-menu-onboarding-v1", version);
  vm.runInContext(`
    let state = ${JSON.stringify(state)};
    let mainMenuVisible = ${JSON.stringify(menuVisible)};
    function isMainMenuVisible() { return mainMenuVisible; }
    ${selectedControllerSource}
    globalThis.mainMenuOnboardingTestApi = {
      begin: beginMainMenuOnboardingEntry,
      maybeStart: maybeStartMainMenuOnboarding,
      next: showNextMainMenuOnboardingStep,
      back: showPreviousMainMenuOnboardingStep,
      skip: showMainMenuOnboardingDecision,
      later: postponeMainMenuOnboarding,
      never: dismissMainMenuOnboardingPermanently,
      pause: pauseMainMenuOnboardingForModal,
      resume: resumeMainMenuOnboardingAfterModal,
      keydown: handleMainMenuOnboardingKeydown,
      setState(value) { state = value; },
      setMenuVisible(value) { mainMenuVisible = value; },
      steps: MAIN_MENU_ONBOARDING_STEPS.map(step => ({...step})),
      version: MAIN_MENU_ONBOARDING_VERSION,
      storageKey: MAIN_MENU_ONBOARDING_STORAGE_KEY,
      snapshot: () => ({
        active: mainMenuOnboardingActive,
        paused: mainMenuOnboardingPaused,
        decision: mainMenuOnboardingDecisionOpen,
        stepIndex: mainMenuOnboardingStepIndex,
        entryId: mainMenuOnboardingEntryId,
        suppressedEntryId: mainMenuOnboardingSuppressedEntryId
      })
    };
  `, context, {filename: "main-menu-onboarding-controller.js"});

  function flushFrames() {
    while (frames.size > 0) {
      const pending = [...frames.entries()];
      frames.clear();
      pending.forEach(([, callback]) => callback());
    }
  }

  return {
    api: context.mainMenuOnboardingTestApi,
    storage,
    ui,
    buttons,
    previousFocus,
    popupPauseCalls,
    updateOverlay,
    documentObject,
    flushFrames
  };
}

const tests = [];
function test(name, run) { tests.push({name, run}); }

test("versioned eligibility treats missing and old versions as unseen", () => {
  const missing = createFixture();
  assert.equal(missing.api.begin(), true);
  missing.flushFrames();
  assert.equal(missing.api.snapshot().active, true);

  const seen = createFixture({
    storage: createStorage({
      slimejumperMainMenuOnboardingSeenVersion: "main-menu-onboarding-v1"
    })
  });
  assert.equal(seen.api.begin(), false);
  assert.equal(seen.api.snapshot().active, false);

  const old = createFixture({
    storage: createStorage({
      slimejumperMainMenuOnboardingSeenVersion: "main-menu-onboarding-v0"
    })
  });
  assert.equal(old.api.begin(), true);

  const readFailure = createFixture({storage: createStorage({}, {readError: true})});
  assert.equal(readFailure.api.begin(), true);
});

test("start gate requires the real visible menu, menu state, targets, and no modal", () => {
  const playing = createFixture({state: "playing"});
  assert.equal(playing.api.begin(), false);
  playing.api.setState("gamePaused");
  assert.equal(playing.api.maybeStart(), false);
  playing.api.setState("menu");
  assert.equal(playing.api.maybeStart(), true);
  assert.equal(playing.api.maybeStart(), false);

  const hidden = createFixture({menuVisible: false});
  assert.equal(hidden.api.begin(), false);
  hidden.api.setMenuVisible(true);
  assert.equal(hidden.api.maybeStart(), true);

  assert.equal(createFixture({updateVisible: true}).api.begin(), false);
  assert.equal(createFixture({invalidTarget: "perksBtn"}).api.begin(), false);
});

test("the tour has exactly ten stable targets in the required order", () => {
  const fixture = createFixture();
  assert.deepEqual(
    Array.from(fixture.api.steps, step => step.id),
    [
      "best",
      "xp",
      "stars",
      "rank",
      "callingCard",
      "achievements",
      "wardrobe",
      "perks",
      "highscores",
      "graphics"
    ]
  );
  assert.deepEqual(
    Array.from(fixture.api.steps, step => step.targetId),
    [
      "menuPersonalBest",
      "menuXPProgress",
      "menuStarBalance",
      "personalGlobalRank",
      "recentAchievements",
      "achievementsBtn",
      "wardrobeBtn",
      "perksBtn",
      "highScoresBtn",
      "mainMenuGraphics"
    ]
  );
  for (const step of fixture.api.steps) {
    assert.match(step.text, /\S/);
    assert.match(htmlSource, new RegExp(`id=["']${step.targetId}["']`));
  }
});

test("back and next stay in bounds and finish opens the shared decision", () => {
  const fixture = createFixture();
  fixture.api.begin();
  fixture.flushFrames();
  assert.equal(fixture.api.back(), false);
  assert.equal(fixture.api.snapshot().stepIndex, 0);
  for (let index = 1; index < 10; index += 1) {
    assert.equal(fixture.api.next(), true);
    fixture.flushFrames();
    assert.equal(fixture.api.snapshot().stepIndex, index);
  }
  assert.equal(fixture.ui.mainMenuOnboardingNextBtn.textContent, "FERTIG");
  assert.equal(fixture.api.next(), true);
  assert.equal(fixture.api.snapshot().decision, true);
  assert.equal(fixture.api.next(), false);

  const skipped = createFixture();
  skipped.api.begin();
  assert.equal(skipped.api.skip(), true);
  assert.equal(skipped.api.snapshot().decision, true);
});

test("finish and skip do not persist; the final choice owns persistence", () => {
  const later = createFixture();
  later.api.begin();
  later.api.skip();
  assert.deepEqual(later.storage.writes, []);
  assert.equal(later.api.later(), true);
  assert.deepEqual(later.storage.writes, []);
  assert.equal(later.api.maybeStart(), false);
  assert.equal(later.api.begin(), true);
  const reloadedAfterLater = createFixture({storage: later.storage});
  assert.equal(reloadedAfterLater.api.begin(), true);

  const never = createFixture();
  never.api.begin();
  never.api.skip();
  assert.deepEqual(never.storage.writes, []);
  assert.equal(never.api.never(), true);
  assert.deepEqual(never.storage.writes, [[
    "slimejumperMainMenuOnboardingSeenVersion",
    "main-menu-onboarding-v1"
  ]]);
  assert.equal(never.api.begin(), false);
});

test("a bumped onboarding version reactivates without touching other storage", () => {
  const progress = {
    slimejumperMainMenuOnboardingSeenVersion: "main-menu-onboarding-v1",
    slimejumperPlayerLevel: "73",
    slimejumperPlayerLevelXP: "1440",
    slimejumperStarBalance: "888",
    slimejumperPrestigeLevel: "4",
    slimejumperAchievements: "achievements",
    slimejumperAchievementProgress: "achievement-progress",
    slimejumperSelectedAchievementBadges: "badges",
    slimejumperCallingCardBadgesConfigured: "true",
    slimejumperUnlockedSlimeCosmetics: "cosmetics",
    slimejumperSelectedSlimeCosmetic: "hat",
    slimejumperUnlockedPerks: "unlocked-perks",
    slimejumperSelectedPerks: "selected-perks",
    slimejumperHighestCheckpointLevel: "40",
    slimejumperBest: "32100",
    slimejumperGlobalRankBestV1: "32100",
    slimejumperGlobalRankBestPayloadV1: "player-bests",
    slimejumperGraphicsMode: "legacy",
    slimejumperHighscoresV14: "scores"
  };
  const storage = createStorage(progress);
  const fixture = createFixture({
    storage,
    version: "main-menu-onboarding-v2"
  });
  assert.equal(fixture.api.begin(), true);
  fixture.api.skip();
  fixture.api.never();
  const stored = storage.snapshot();
  for (const [key, value] of Object.entries(progress)) {
    if (key === "slimejumperMainMenuOnboardingSeenVersion") continue;
    assert.equal(stored[key], value);
  }
  assert.equal(stored.slimejumperMainMenuOnboardingSeenVersion, "main-menu-onboarding-v2");
  assert.deepEqual(storage.removals, []);
});

test("update modal pause and resume preserves the current step", () => {
  const fixture = createFixture();
  fixture.api.begin();
  fixture.api.next();
  fixture.api.next();
  assert.equal(fixture.api.snapshot().stepIndex, 2);
  assert.equal(fixture.api.pause(), true);
  assert.deepEqual(fixture.popupPauseCalls.slice(-2), [true, false]);
  fixture.updateOverlay.classList.remove("hidden");
  fixture.updateOverlay.setAttribute("aria-hidden", "false");
  assert.equal(fixture.api.resume(), false);
  fixture.updateOverlay.classList.add("hidden");
  fixture.updateOverlay.setAttribute("aria-hidden", "true");
  assert.equal(fixture.api.resume(), true);
  assert.equal(fixture.api.snapshot().stepIndex, 2);
  assert.deepEqual(fixture.popupPauseCalls.slice(-3), [true, false, true]);
  fixture.api.skip();
  fixture.api.later();
  assert.equal(fixture.popupPauseCalls.at(-1), false);
});

test("escape opens the decision, focus is trapped, and exit restores focus", () => {
  const fixture = createFixture();
  fixture.api.begin();
  fixture.flushFrames();
  assert.equal(fixture.ui.mainMenuScreen.hasAttribute("inert"), true);
  let prevented = 0;
  fixture.api.keydown({
    key: "Escape",
    preventDefault() { prevented += 1; }
  });
  fixture.flushFrames();
  assert.equal(prevented, 1);
  assert.equal(fixture.api.snapshot().decision, true);
  assert.equal(fixture.documentObject.activeElement, fixture.buttons.Later);

  fixture.buttons.Never.focus();
  fixture.api.keydown({
    key: "Tab",
    shiftKey: false,
    preventDefault() { prevented += 1; }
  });
  assert.equal(fixture.documentObject.activeElement, fixture.buttons.Later);
  fixture.api.keydown({
    key: "Tab",
    shiftKey: true,
    preventDefault() { prevented += 1; }
  });
  assert.equal(fixture.documentObject.activeElement, fixture.buttons.Never);

  fixture.api.later();
  assert.equal(fixture.ui.mainMenuScreen.hasAttribute("inert"), false);
  assert.equal(fixture.documentObject.activeElement, fixture.previousFocus);
});

test("storage write failures still close the UI cleanly", () => {
  const fixture = createFixture({storage: createStorage({}, {writeError: true})});
  fixture.api.begin();
  fixture.api.skip();
  assert.equal(fixture.api.never(), true);
  assert.equal(fixture.api.snapshot().active, false);
  assert.equal(fixture.ui.mainMenuOnboardingOverlay.classList.contains("hidden"), true);
});

test("layout, focus, inert, escape, and responsive contracts are present", () => {
  assert.match(controllerSource, /getBoundingClientRect\(\)/);
  for (const placement of ["top", "bottom", "left", "right"]) {
    assert.match(controllerSource, new RegExp(`["']${placement}["']`));
  }
  assert.match(controllerSource, /clampMainMenuOnboardingPosition/);
  assert.match(controllerSource, /visualViewport/);
  assert.match(controllerSource, /ResizeObserver/);
  assert.match(uiSource, /orientationchange/);
  assert.doesNotMatch(controllerSource, /setInterval/);
  assert.match(controllerSource, /event\.key === "Escape"/);
  assert.match(controllerSource, /event\.key !== "Tab"/);
  assert.match(controllerSource, /setAttribute\("inert"/);
  assert.match(htmlSource, /id="mainMenuOnboardingOverlay"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="mainMenuOnboardingTitle"[^>]+aria-describedby="mainMenuOnboardingText"/);
  assert.match(cssSource, /env\(safe-area-inset-top\)/);
  assert.match(cssSource, /\.mainMenuOnboardingBubble[\s\S]*?width: min\(calc\(100vw - 16px\), 356px\)/);
  assert.match(cssSource, /max-height: 55dvh/);
});

test("privacy keeps its menu position and separate desktop and touch spacing", () => {
  const mainActionsStart = htmlSource.indexOf('<nav class="mainMenuActions"');
  const mainActionsEnd = htmlSource.indexOf("</nav>", mainActionsStart);
  const mainActionsSource = htmlSource.slice(mainActionsStart, mainActionsEnd);
  const highScoresIndex = mainActionsSource.indexOf('id="highScoresBtn"');
  const privacyIndex = mainActionsSource.indexOf('class="privacyLink"');
  assert.ok(mainActionsStart >= 0 && mainActionsEnd > mainActionsStart);
  assert.ok(highScoresIndex >= 0 && privacyIndex > highScoresIndex);
  assert.match(
    mainActionsSource,
    /class="privacyLink" href="https:\/\/slimejumpgame\.github\.io\/datenschutz\.html" target="_blank" rel="noopener noreferrer external"/
  );
  assert.match(
    cssSource,
    /@media \(hover: hover\) and \(pointer: fine\) \{\s+#mainMenuScreen \.privacyLink \{\s+margin-top: clamp\(8px, calc\(12\.5dvh - 80px\), 56px\);/
  );
  assert.match(
    cssSource,
    /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{\s+#mainMenuScreen \.privacyLink \{\s+margin-top: clamp\(8px, 2\.8dvh, 14px\);/
  );
  assert.doesNotMatch(
    cssSource.match(/\.privacyLink \{[\s\S]*?\}/)?.[0] ?? "",
    /position:\s*(?:absolute|fixed)|\b(?:bottom|right):/
  );
  assert.match(cssSource, /\.mainMenuAudio \{\s+position: absolute;\s+left:/);
  assert.match(cssSource, /\.mainMenuGraphics \{\s+position: absolute;\s+right:/);
});

test("only true menu-entry hooks can launch automatic onboarding", () => {
  assert.match(
    gameSource,
    /ui\.menu\.classList\.remove\("hidden"\);\s+if \(typeof beginMainMenuOnboardingEntry === "function"\) \{\s+beginMainMenuOnboardingEntry\(\);/
  );
  assert.match(
    gameSource,
    /initializeAndroidUpdateCheck\(\)\.finally\(\(\) => \{\s+if \(typeof beginMainMenuOnboardingEntry === "function"\) \{\s+beginMainMenuOnboardingEntry\(\);/
  );
  assert.doesNotMatch(
    uiSource.slice(
      uiSource.indexOf("function showMenuScreen"),
      uiSource.indexOf("function getHowToThumbOffset")
    ),
    /MainMenuOnboarding/
  );
  assert.match(uiSource, /pauseMainMenuOnboardingForModal\(\);[\s\S]*?function closeUpdateScreen\(\)[\s\S]*?resumeMainMenuOnboardingAfterModal\(\)/);
});

test("the controller owns one isolated key and contains no wipe", () => {
  assert.equal(
    (controllerSource.match(/slimejumperMainMenuOnboardingSeenVersion/g) ?? []).length,
    1
  );
  assert.doesNotMatch(controllerSource, /removeItem\s*\(/);
  assert.doesNotMatch(
    controllerSource,
    /slimejumper(?:PlayerLevel|Star|Prestige|Achievement|Cosmetic|Perk|Checkpoint|Highscore|GraphicsMode)/
  );
});

for (const {name, run} of tests) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

console.log(`Main-menu onboarding tests passed (${tests.length} cases).`);
