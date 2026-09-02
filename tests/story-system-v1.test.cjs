const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const storySource = read("js/slime-story.js");
const recoverySource = read("js/slime-run-recovery.js");
const gameSource = read("js/game.js");
const prestigeSource = read("js/slime-prestige.js");
const checkpointSource = read("js/slime-checkpoint-bonus.js");
const indexSource = read("index.html");
const cssSource = read("css/style.css");
const plain = value => JSON.parse(JSON.stringify(value));

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(...names) {
    names.forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === true) this.values.add(name);
    else if (force === false) this.values.delete(name);
    else if (this.values.has(name)) this.values.delete(name);
    else this.values.add(name);
    return this.values.has(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createCanvasContext() {
  const gradient = {addColorStop() {}};
  return {
    clearRect() {}, createRadialGradient: () => gradient, fillRect() {}, save() {},
    translate() {}, rotate() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    fill() {}, stroke() {}, quadraticCurveTo() {}, restore() {}, fillText() {}, arc() {}
  };
}

function createElement(id) {
  const listeners = new Map();
  return {
    id,
    dataset: {},
    classList: new FakeClassList(["hidden"]),
    textContent: "",
    src: "",
    alt: "",
    width: id === "storyFragmentCanvas" ? 260 : 0,
    height: id === "storyFragmentCanvas" ? 190 : 0,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    click() {
      this.dispatch("click", {target: this, stopPropagation() {}});
    },
    setAttribute(name, value) {
      this[name] = String(value);
    },
    removeAttribute(name) {
      this[name] = "";
    },
    getContext: id === "storyFragmentCanvas" ? () => createCanvasContext() : undefined
  };
}

const storyDomIds = [
  "storyOverlay", "storySequencePanel", "storyProgress", "storyImage",
  "storyImageFallback", "storyText", "storyEndingNote", "storyNextBtn",
  "storySkipBtn", "storyHideIntroBtn", "storyFragmentPanel",
  "storyFragmentCanvas", "storyFragmentText", "storyFragmentContinueBtn"
];

function createStoryFixture({
  existing = false,
  failImages = false,
  initial = {},
  manualTimers = false,
  storyAudioThrows = false
} = {}) {
  const installationId = "12345678-1234-4123-8123-123456789abc";
  const localStorage = new MemoryStorage({
    untouched: "keep-me",
    ...(existing ? {slimejumperInstallationId: installationId} : {}),
    ...initial
  });
  const sessionStorage = new MemoryStorage();
  const elements = Object.fromEntries(storyDomIds.map(id => [id, createElement(id)]));
  const imageRequests = [];
  const documentListeners = new Map();
  const document = {
    getElementById: id => elements[id] || null,
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    }
  };

  class FakeImage {
    set src(value) {
      this._src = value;
      imageRequests.push(value);
      if (failImages) this.onerror?.(new Error("missing"));
      else this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const recoveryCalls = {protect: [], resume: 0};
  const bridgeCalls = [];
  const storyAudioCalls = {starts: [], stops: []};
  const warnings = [];
  let activeStoryAudio = null;
  const pendingTimers = new Map();
  let nextTimerId = 1;
  const setFakeTimeout = (callback, delay = 0) => {
    const timerId = nextTimerId++;
    if (manualTimers) pendingTimers.set(timerId, {callback, delay});
    else callback();
    return timerId;
  };
  const window = {
    Image: FakeImage,
    setTimeout: setFakeTimeout,
    clearTimeout(timerId) { pendingTimers.delete(timerId); },
    requestAnimationFrame(callback) { callback(0); return 1; },
    SlimeAchievements: {setPopupsPaused() {}},
    SlimeStoryAudio: {
      start(sequenceName) {
        storyAudioCalls.starts.push(sequenceName);
        activeStoryAudio = sequenceName;
        if (storyAudioThrows) throw new Error("Story audio start failed");
        return true;
      },
      stop(sequenceName) {
        const target = sequenceName ?? activeStoryAudio;
        if (!target || target !== activeStoryAudio) return false;
        storyAudioCalls.stops.push(target);
        activeStoryAudio = null;
        if (storyAudioThrows) throw new Error("Story audio stop failed");
        return true;
      },
      isActive: () => activeStoryAudio !== null
    },
    SlimeRunRecovery: {
      protectStoryPresentation(value) {
        recoveryCalls.protect.push(value);
        return true;
      },
      resumeAfterStoryPresentation() {
        recoveryCalls.resume++;
        return true;
      }
    }
  };
  const fixtureConsole = Object.create(console);
  fixtureConsole.warn = (...args) => warnings.push(args);
  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    console: fixtureConsole
  });
  vm.runInContext(storySource, context, {filename: "slime-story.js"});
  window.SlimeStory.configure({
    devModeEnabled: true,
    setPresentationActive(active) { bridgeCalls.push(active); }
  });
  return {
    api: window.SlimeStory,
    localStorage,
    sessionStorage,
    elements,
    imageRequests,
    recoveryCalls,
    bridgeCalls,
    storyAudioCalls,
    warnings,
    timers: {
      count: () => pendingTimers.size,
      nextDelay: () => pendingTimers.values().next().value?.delay ?? null,
      runNext() {
        const next = pendingTimers.entries().next();
        if (next.done) return false;
        const [timerId, timer] = next.value;
        pendingTimers.delete(timerId);
        timer.callback();
        return true;
      }
    }
  };
}

async function settle() {
  for (let index = 0; index < 10; index++) await Promise.resolve();
}

async function finishFragmentSequence(fixture, levelNumber) {
  let completed = 0;
  assert.equal(fixture.api.handleLevelCompleted({
    levelNumber,
    onComplete() { completed++; }
  }), true);
  await settle();
  fixture.elements.storyFragmentContinueBtn.click();
  await settle();
  fixture.elements.storySkipBtn.click();
  await settle();
  assert.equal(completed, 1);
}

function readPngDimensions(relativePath) {
  const data = fs.readFileSync(path.join(root, relativePath));
  assert.equal(data.toString("ascii", 1, 4), "PNG");
  return {width: data.readUInt32BE(16), height: data.readUInt32BE(20)};
}

(async () => {
  const fresh = createStoryFixture();
  assert.equal(fresh.api.getState().status, "active", "fresh install must arm Story cycle");
  assert.equal(fresh.api.getState().cycle.prestige, 0);
  assert.equal(fresh.imageRequests.length, 0, "Story images must not load at startup");
  assert.deepEqual(fresh.storyAudioCalls.starts, [], "Story music must not start at boot");
  assert.equal(fresh.api.typewriterCharacterMs, 28);
  assert.equal(fresh.localStorage.getItem("untouched"), "keep-me");

  const existing = createStoryFixture({existing: true});
  assert.equal(existing.api.getState().status, "deferred", "existing install must defer Story");
  assert.equal(existing.api.handleLevelCompleted({levelNumber: 1}), false);
  assert.equal(existing.api.handleLevelCompleted({levelNumber: 100}), false);
  assert.equal(existing.api.getState().status, "deferred", "manual levels must not arm Story");
  assert.equal(existing.api.beginPrestigeCycle(10), true, "P9 to P10 must arm final cycle");
  assert.equal(existing.api.getState().cycle.prestige, 10);
  assert.deepEqual(plain(existing.api.getState().cycle.fragments), []);
  assert.equal(existing.api.getState().cycle.sequences.middle, "eligible");
  assert.equal(existing.api.getState().cycle.sequences.ending, "eligible");

  let introCompleted = 0;
  assert.equal(fresh.api.showIntro({onComplete() { introCompleted++; }}), true);
  await settle();
  assert.deepEqual(fresh.storyAudioCalls.starts, ["intro"]);
  assert.deepEqual(fresh.imageRequests, [
    "assets/story/story_intro_01.png",
    "assets/story/story_intro_02.png"
  ], "Intro must load only current and exactly next initially");
  assert.equal(fresh.api.getActiveLiveImageCount(), 2);
  assert.equal(fresh.imageRequests.some(request => /middle|ending/.test(request)), false);
  fresh.elements.storySkipBtn.click();
  await settle();
  assert.equal(introCompleted, 1, "Intro skip must continue once");
  assert.deepEqual(fresh.storyAudioCalls.stops, ["intro"], "Intro close must stop Story music once");
  assert.equal(fresh.api.getActiveLiveImageCount(), 0, "sequence references must be released");

  const typingFixture = createStoryFixture({manualTimers: true});
  assert.equal(typingFixture.api.showIntro(), true);
  await settle();
  assert.equal(typingFixture.elements.storyText.textContent, "",
    "text must wait until the image fade completes");
  assert.equal(typingFixture.timers.nextDelay(), 300);
  typingFixture.timers.runNext();
  await settle();
  assert.equal(typingFixture.timers.nextDelay(), 28);
  typingFixture.timers.runNext();
  assert.equal(typingFixture.elements.storyText.textContent, "I",
    "typewriter must update one textContent substring at a time");
  assert.equal(typingFixture.api.isCurrentTextComplete(), false);
  typingFixture.elements.storyNextBtn.click();
  assert.equal(
    typingFixture.elements.storyText.textContent,
    typingFixture.api.sequences.intro[0].text,
    "first WEITER while typing must reveal the current text"
  );
  assert.equal(typingFixture.elements.storyProgress.textContent, "1 / 6",
    "revealing text must not advance the slide");
  assert.equal(typingFixture.api.isCurrentTextComplete(), true);
  typingFixture.elements.storyNextBtn.click();
  assert.equal(typingFixture.elements.storyProgress.textContent, "1 / 6");
  assert.equal(typingFixture.timers.nextDelay(), 300);
  typingFixture.timers.runNext();
  await settle();
  assert.equal(typingFixture.elements.storyProgress.textContent, "2 / 6",
    "second WEITER after complete text must advance");
  assert.equal(typingFixture.elements.storyText.textContent, "");
  typingFixture.timers.runNext();
  await settle();
  typingFixture.timers.runNext();
  assert.equal(typingFixture.elements.storyText.textContent, "D");
  typingFixture.elements.storySkipBtn.click();
  await settle();
  assert.equal(typingFixture.timers.count(), 0, "skip must cancel the active typing timer");

  const advancingLoader = createStoryFixture();
  assert.equal(advancingLoader.api.showIntro(), true);
  await settle();
  advancingLoader.elements.storyNextBtn.click();
  await settle();
  assert.deepEqual(advancingLoader.imageRequests, [
    "assets/story/story_intro_01.png",
    "assets/story/story_intro_02.png",
    "assets/story/story_intro_03.png"
  ]);
  assert.deepEqual(advancingLoader.storyAudioCalls.starts, ["intro"],
    "slide changes must not restart Intro music");
  assert.equal(advancingLoader.api.getActiveLiveImageCount(), 2,
    "advancing must release previous before preloading next+1");
  advancingLoader.elements.storySkipBtn.click();
  await settle();

  assert.equal(fresh.api.showIntro(), true);
  await settle();
  fresh.elements.storyHideIntroBtn.click();
  await settle();
  assert.equal(fresh.api.shouldShowIntro(), false, "hide applies to current cycle");
  fresh.api.beginPrestigeCycle(1);
  assert.equal(fresh.api.shouldShowIntro(), true, "real Prestige resets Intro visibility");

  const milestoneFixture = createStoryFixture();
  const expectedMilestones = [[25, 1], [50, 2], [75, 3], [100, 4], [125, 5], [150, 6], [175, 7], [200, 8]];
  assert.deepEqual(plain(Array.from(milestoneFixture.api.fragmentMilestones)), expectedMilestones);
  for (const [level, fragment] of expectedMilestones.filter(([level]) => ![100, 200].includes(level))) {
    let continued = 0;
    assert.equal(milestoneFixture.api.handleLevelCompleted({
      levelNumber: level,
      onComplete() { continued++; }
    }), true);
    await settle();
    assert.match(milestoneFixture.elements.storyFragmentText.textContent, new RegExp(`^${fragment} / 8`));
    milestoneFixture.elements.storyFragmentContinueBtn.click();
    await settle();
    assert.equal(continued, 1);
    assert.equal(milestoneFixture.api.handleLevelCompleted({levelNumber: level}), false,
      `fragment ${fragment} must not repeat in one production cycle`);
  }

  await finishFragmentSequence(milestoneFixture, 100);
  assert.equal(milestoneFixture.storyAudioCalls.starts.filter(name => name === "middle").length, 1);
  assert.equal(milestoneFixture.storyAudioCalls.stops.length, 1);
  assert.deepEqual(plain(milestoneFixture.recoveryCalls.protect.at(-1)), {levelNumber: 100, sequence: "middle"});
  assert.equal(milestoneFixture.api.getState().cycle.sequences.middle, "handled");
  assert.equal(milestoneFixture.api.handleLevelCompleted({levelNumber: 100}), false);
  assert.equal(milestoneFixture.imageRequests.some(request => request.includes("story_middle_01.png")), true);
  assert.equal(milestoneFixture.imageRequests.some(request => request.includes("story_ending_01.png")), false);

  await finishFragmentSequence(milestoneFixture, 200);
  assert.equal(milestoneFixture.storyAudioCalls.starts.filter(name => name === "ending").length, 1);
  assert.equal(milestoneFixture.storyAudioCalls.stops.length, 2);
  assert.deepEqual(plain(milestoneFixture.recoveryCalls.protect.at(-1)), {levelNumber: 200, sequence: "ending"});
  assert.equal(milestoneFixture.api.getState().cycle.sequences.ending, "handled");
  assert.equal(milestoneFixture.api.handleLevelCompleted({levelNumber: 200}), false);
  assert.equal(milestoneFixture.recoveryCalls.resume, 2);
  assert.equal(milestoneFixture.imageRequests.some(request => request.includes("story_ending_01.png")), true);

  const devFixture = createStoryFixture({existing: true});
  const canonicalBeforeDev = devFixture.localStorage.getItem(devFixture.api.storageKey);
  assert.equal(devFixture.api.setDevTestEnabled(true), true);
  assert.equal(devFixture.api.shouldShowIntro(), true);
  for (let replay = 0; replay < 2; replay++) {
    assert.equal(devFixture.api.showIntro(), true);
    await settle();
    devFixture.elements.storySkipBtn.click();
    await settle();
  }
  await finishFragmentSequence(devFixture, 100);
  await finishFragmentSequence(devFixture, 100);
  await finishFragmentSequence(devFixture, 200);
  await finishFragmentSequence(devFixture, 200);
  assert.equal(devFixture.localStorage.getItem(devFixture.api.storageKey), canonicalBeforeDev,
    "DEV Story Test must not mutate canonical Story state");

  const failureFixture = createStoryFixture({failImages: true, storyAudioThrows: true});
  let failureContinued = 0;
  assert.equal(failureFixture.api.showIntro({onComplete() { failureContinued++; }}), true);
  await settle();
  assert.equal(failureFixture.elements.storyImageFallback.classList.contains("hidden"), false);
  assert.match(failureFixture.elements.storyText.textContent, /friedlichen Welt/);
  failureFixture.elements.storySkipBtn.click();
  await settle();
  assert.equal(failureContinued, 1, "broken image must not trap continuation");
  assert.equal(failureFixture.warnings.length, 2,
    "Story audio start/stop failures must be contained and reported");

  const recoveryStorage = new MemoryStorage();
  const recoveryWindow = {};
  vm.runInContext(recoverySource, vm.createContext({
    window: recoveryWindow,
    localStorage: recoveryStorage,
    console
  }), {filename: "slime-run-recovery.js"});
  const recovery = recoveryWindow.SlimeRunRecovery;
  assert.equal(recovery.beginActiveRun({achievementSnapshot: {earned: 1}, wardrobeSnapshot: {earned: 2}}), true);
  assert.equal(recovery.protectStoryPresentation({levelNumber: 100, sequence: "middle"}), true);
  assert.equal(JSON.parse(recoveryStorage.getItem(recovery.storageKey)).status, "story_presentation");
  let restoreCount = 0;
  const recovered = recovery.recoverInterruptedRun({
    isAchievementSnapshotValid: () => true,
    isWardrobeSnapshotValid: () => true,
    restoreAchievementSnapshot() { restoreCount++; return true; },
    restoreWardrobeSnapshot() { restoreCount++; return true; }
  });
  assert.equal(recovered.storyPending, true);
  assert.equal(restoreCount, 0, "interrupted milestone Story must not roll back earned completion");
  assert.equal(recoveryStorage.getItem(recovery.storageKey), null);

  assert.equal(recovery.beginActiveRun({achievementSnapshot: {}, wardrobeSnapshot: {}}), true);
  assert.equal(recovery.protectStoryPresentation({levelNumber: 200, sequence: "ending"}), true);
  assert.equal(recovery.resumeAfterStoryPresentation(), true);
  assert.equal(JSON.parse(recoveryStorage.getItem(recovery.storageKey)).status, "active");

  const allSlides = [
    ...fresh.api.sequences.intro,
    ...fresh.api.sequences.middle,
    ...fresh.api.sequences.ending
  ];
  assert.equal(allSlides.length, 13);
  assert.deepEqual(plain(allSlides.map(slide => slide.text)), [
    "In einer friedlichen Welt lebten die Slimes glücklich zusammen.\nHier war das Zuhause unseres kleinen grünen Slimes.",
    "Doch eines Tages erschien mitten im Dorf ein geheimnisvolles Portal.\nNiemand wusste, woher es gekommen war.",
    "Aus dem Portal schwebte ein magisches Buch.\nSeine Seiten führten zu fremden und wundersamen Welten.",
    "Plötzlich begann die Heimatseite zu leuchten.\nSie zerbrach in acht magische Fragmente.",
    "Die Fragmente wurden in die fremden Welten gerissen.\nMit ihnen begann auch die Slime-Heimat auseinanderzubrechen.",
    "Es gab nur einen Weg, seine Heimat zu retten.\nDer grüne Slime sprang hinterher.\nSeine Reise begann.",
    "Die Hälfte ist geschafft.\nVier der acht Fragmente sind zurückgekehrt.\nDie Heimat beginnt zu heilen – doch sie ist noch nicht gerettet.",
    "Am Horizont zieht bereits ein Gewitter auf.\nNoch fehlen vier Fragmente.\nDie zweite Hälfte der Reise beginnt.",
    "Das letzte Fragment kehrt zurück.\nDie Heimatseite ist wieder vollständig.\nDas Portal nach Hause öffnet sich.",
    "Die Slime-Welt ist gerettet.\nNach seiner langen Reise kehrt der kleine Slime endlich nach Hause zurück.",
    "Am nächsten Morgen wacht er in seinem Bett auf.\nWar das alles vielleicht nur ein Traum?",
    "Doch dann entdeckt er ein leuchtendes Andenken aus einer fremden Welt.\nDie Reise war wirklich passiert.",
    "Das Portal beginnt erneut zu leuchten.\nDiesmal gibt es keine Gefahr – nur ein neues Abenteuer.\nDer Slime springt freiwillig hinein."
  ]);
  assert.equal(fresh.api.sequences.ending.at(-1).note,
    "Beim nächsten Prestige beginnt die Geschichte wieder von vorn.");
  for (const slide of allSlides) {
    assert.deepEqual(readPngDimensions(slide.image), {width: 1280, height: 720});
  }

  assert.ok(indexSource.indexOf('<script src="./js/slime-story.js"></script>') <
    indexSource.indexOf('<script src="./js/slime-progress-reset.js"></script>'),
  "Story must classify fresh installs before other boot code creates canonical identity");
  assert.match(indexSource, /id="storyOverlay"[\s\S]*id="storyFragmentCanvas"/);
  assert.match(indexSource, /id="devStoryTestBtn"[^>]*>STORY TEST: AUS</);
  assert.match(cssSource, /\.storyOverlay\s*\{[\s\S]*z-index:\s*10000/);
  assert.match(cssSource, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(cssSource, /transition:\s*opacity 300ms ease/);

  const playFlow = gameSource.slice(
    gameSource.indexOf("  function startFromPlay()"),
    gameSource.indexOf("  function updateDevTutorialToggle()")
  );
  assert.ok(playFlow.indexOf("startTutorialSequence") < playFlow.indexOf("startLevelOneWithStoryIntro"));
  assert.match(playFlow, /showIntro\([\s\S]*onComplete:[\s\S]*startGame\(1\)/);
  const tutorialCompletion = gameSource.slice(
    gameSource.indexOf("  function resolveTutorialCompletePrompt"),
    gameSource.indexOf("  function finishLevel()")
  );
  assert.match(tutorialCompletion, /hideTutorialCompletePrompt\(\);[\s\S]*startLevelOneWithStoryIntro\(\)/);

  const finishLevel = gameSource.slice(
    gameSource.indexOf("  function finishLevel()"),
    gameSource.indexOf("  function captureHighScoreGoldAppearanceSnapshot()")
  );
  for (const bookkeeping of ["recordReachedCheckpoint", "onLevelCompleted", "recordCompletedLevel", "playWin"]) {
    assert.ok(finishLevel.indexOf(bookkeeping) < finishLevel.indexOf("handleLevelCompleted"),
      `${bookkeeping} must happen before Story`);
  }
  assert.ok(finishLevel.indexOf("handleLevelCompleted") < finishLevel.indexOf("continueAfterStory();"),
    "Story must gate the one existing Slot/completion continuation");
  assert.match(prestigeSource, /resetPrestigeCycleStorage\(\)[\s\S]*beginPrestigeCycle\(normalizedTransaction\.targetPrestige\)/);
  assert.match(checkpointSource, /storyBlocksPending[\s\S]*!storyBlocksPending[\s\S]*openPending/);
  assert.match(gameSource, /PageUp[\s\S]*SlimeStory\?\.isPresenting/);
  assert.match(storySource, /SlimeStoryAudio\?\.start\?\.\(sequenceName\)/);
  assert.doesNotMatch(storySource, /assets\/music\/story\//,
    "Story media paths and Web Audio routing must remain centralized in audio.js");

  console.log("Story V1 state, viewer, lazy loading, milestones, DEV, recovery and integration tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
