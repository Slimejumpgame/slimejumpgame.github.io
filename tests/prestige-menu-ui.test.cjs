"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStorage(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key, String(value)])
  );
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function loadPrestige(level, {ready = false} = {}) {
  const localStorage = createStorage({slimejumperPrestigeLevel: String(level)});
  const window = {
    location: {reload() {}},
    SlimePlayerProgress: {
      isPrestigeReady: () => ready,
      getPlayerProgress: () => ({level: ready ? 100 : 1})
    },
    SlimeAchievements: {getSelectedBadgeIds: () => []}
  };
  const context = vm.createContext({window, localStorage, console, DEV_MODE: false});
  vm.runInContext(read("js/slime-prestige.js"), context, {
    filename: "js/slime-prestige.js"
  });
  return {api: window.SlimePrestige, localStorage};
}

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor(tagName = "div", initialClasses = []) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.classList = new FakeClassList(initialClasses);
    this.dataset = {};
    this.disabled = false;
    this.eventListeners = new Map();
    this.innerHTML = "";
    this.textContent = "";
  }
  set className(value) {
    this.classList = new FakeClassList(String(value).split(/\s+/).filter(Boolean));
  }
  get className() { return [...this.classList.values].join(" "); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, callback) { this.eventListeners.set(type, callback); }
  click() {
    if (!this.disabled) this.eventListeners.get("click")?.({currentTarget: this});
  }
}

function loadPrestigeMenuRenderer(prestige) {
  const categoryButtons = ["frame", "title", "aura", "trail"].map(type => {
    const button = new FakeElement("button");
    button.dataset.prestigeCategory = type;
    return button;
  });
  const categoryContainer = new FakeElement();
  categoryContainer.querySelectorAll = () => categoryButtons;
  const ui = {
    wardrobePrestigeActivateBtn: new FakeElement("button"),
    wardrobePrestigeCategories: categoryContainer,
    wardrobePrestigeEmblem: new FakeElement(),
    wardrobePrestigeLevel: new FakeElement(),
    wardrobePrestigeOptions: new FakeElement()
  };
  const selectedCalls = [];
  const document = {createElement: tagName => new FakeElement(tagName)};
  const source = read("js/ui.js");
  const sliceStart = source.indexOf("  function createPrestigeRewardPreview(");
  const sliceEnd = source.indexOf("  function renderPrestigeCustomization(", sliceStart);
  assert.ok(sliceStart >= 0 && sliceEnd > sliceStart);
  const context = vm.createContext({
    document,
    ui,
    window: {SlimePrestige: prestige},
    selectPrestigeReward(type, id) {
      selectedCalls.push({type, id});
      return prestige.selectReward(type, id);
    },
    console
  });
  vm.runInContext(
    `let prestigeWardrobeCategory = "frame";\n` +
      source.slice(sliceStart, sliceEnd) + `
        globalThis.prestigeMenuTestApi = {
          renderWardrobePrestigePicker,
          setCategory(type) { prestigeWardrobeCategory = type; }
        };
      `,
    context,
    {filename: "js/ui-prestige-menu-test-slice.js"}
  );
  return {api: context.prestigeMenuTestApi, selectedCalls, ui};
}

function getCatalog(api) {
  return plain(api.definitions).flatMap(definition =>
    definition.rewards.map(reward => ({
      ...reward,
      requiredPrestige: definition.level
    }))
  );
}

function findChildByClass(element, className) {
  return element.children.find(child => child.classList.contains(className));
}

function assertRewardCatalog() {
  const {api} = loadPrestige(0);
  const catalog = getCatalog(api);
  assert.equal(catalog.length, 32);
  assert.equal(new Set(catalog.map(reward => reward.id)).size, 32);
  assert.deepEqual(
    plain(Object.fromEntries(api.definitions.map(definition => [
      `P${definition.level}`,
      definition.rewards.map(reward => reward.id)
    ]))),
    {
      P1: ["prestige-frame-p1", "prestige-title-p1"],
      P2: ["prestige-title-p2"],
      P3: ["prestige-aura-p3", "prestige-aura-bubble-p3", "prestige-aura-mist-p3", "prestige-aura-star-p3", "prestige-title-p3"],
      P4: ["prestige-frame-p4", "prestige-title-p4"],
      P5: ["prestige-trail-p5", "prestige-trail-slime-p5", "prestige-trail-bubble-p5", "prestige-trail-spark-p5", "prestige-trail-mist-p5", "prestige-title-p5"],
      P6: ["prestige-title-p6"],
      P7: ["prestige-frame-p7", "prestige-title-p7"],
      P8: ["prestige-aura-p8", "prestige-aura-royal-p8", "prestige-aura-flame-p8", "prestige-aura-prism-p8", "prestige-title-p8"],
      P9: ["prestige-trail-p9", "prestige-trail-flame-p9", "prestige-trail-royal-p9", "prestige-trail-neon-p9", "prestige-trail-prism-p9", "prestige-title-p9"],
      P10: ["prestige-frame-p10", "prestige-title-p10"]
    }
  );
}

function assertRenderedState(prestigeLevel) {
  const fixture = loadPrestige(prestigeLevel);
  const catalog = getCatalog(fixture.api);
  const renderer = loadPrestigeMenuRenderer(fixture.api);
  const storageBefore = fixture.localStorage.snapshot();
  const renderedIds = [];

  for (const type of ["frame", "title", "aura", "trail"]) {
    renderer.api.setCategory(type);
    renderer.api.renderWardrobePrestigePicker();
    const expected = catalog.filter(reward => reward.type === type);
    assert.equal(renderer.ui.wardrobePrestigeOptions.children.length, expected.length + 1);
    const [standardOption, ...rewardOptions] = renderer.ui.wardrobePrestigeOptions.children;
    assert.equal(standardOption.dataset.rewardId, "none");
    assert.equal(standardOption.disabled, false);
    assert.equal(standardOption.classList.contains("locked"), false);
    assert.equal(Boolean(findChildByClass(standardOption, "prestigeRewardName")), false);

    rewardOptions.forEach((option, index) => {
      const reward = expected[index];
      const unlocked = reward.requiredPrestige <= prestigeLevel;
      renderedIds.push(option.dataset.rewardId);
      assert.equal(option.dataset.rewardId, reward.id);
      assert.equal(Number(option.dataset.requiredPrestige), reward.requiredPrestige);
      assert.equal(option.dataset.unlocked, String(unlocked));
      assert.equal(option.disabled, !unlocked);
      assert.equal(option.classList.contains("locked"), !unlocked);
      assert.equal(
        findChildByClass(option, "prestigeRewardRequirement").textContent,
        unlocked
          ? `FREIGESCHALTET · P${reward.requiredPrestige}`
          : `PRESTIGE ${reward.requiredPrestige} ERFORDERLICH`
      );
      assert.equal(Boolean(findChildByClass(option, "prestigeRewardLock")), !unlocked);
      assert.equal(
        Boolean(findChildByClass(option, "prestigeRewardName")),
        type !== "title"
      );
    });
  }

  assert.deepEqual(
    renderedIds,
    ["frame", "title", "aura", "trail"].flatMap(type =>
      catalog.filter(reward => reward.type === type).map(reward => reward.id)
    )
  );
  assert.equal(
    renderer.ui.wardrobePrestigeLevel.textContent,
    prestigeLevel > 0 ? `PRESTIGE-STUFE ${prestigeLevel}` : "NOCH KEIN PRESTIGE"
  );
  assert.equal(
    renderer.ui.wardrobePrestigeEmblem.innerHTML === "",
    prestigeLevel === 0
  );
  assert.deepEqual(fixture.localStorage.snapshot(), storageBefore);
  return {catalog, fixture, renderer};
}

function assertPrestigeEligibilityGuards() {
  const notReady = loadPrestige(0);
  const notReadyBefore = notReady.localStorage.snapshot();
  assert.equal(notReady.api.performPrestigeReset({validateSafeState: () => true}), false);
  assert.deepEqual(notReady.localStorage.snapshot(), notReadyBefore);

  const unsafe = loadPrestige(0, {ready: true});
  const unsafeBefore = unsafe.localStorage.snapshot();
  assert.equal(unsafe.api.performPrestigeReset({validateSafeState: () => false}), false);
  assert.deepEqual(unsafe.localStorage.snapshot(), unsafeBefore);

  const mastered = loadPrestige(10, {ready: true});
  const masteredBefore = mastered.localStorage.snapshot();
  assert.equal(mastered.api.performPrestigeReset({validateSafeState: () => true}), false);
  assert.deepEqual(mastered.localStorage.snapshot(), masteredBefore);
}

function assertP0LockedAndSelectionSafe() {
  const {catalog, fixture, renderer} = assertRenderedState(0);
  assert.equal(catalog.every(reward => reward.requiredPrestige > 0), true);
  assert.equal(renderer.ui.wardrobePrestigeActivateBtn.disabled, true);
  assert.equal(renderer.ui.wardrobePrestigeActivateBtn.textContent, "PRESTIGE NICHT BEREIT");
  assert.equal(fixture.api.selectReward("frame", "prestige-frame-p1"), false);

  renderer.api.setCategory("frame");
  renderer.api.renderWardrobePrestigePicker();
  const lockedFrame = renderer.ui.wardrobePrestigeOptions.children.find(
    option => option.dataset.rewardId === "prestige-frame-p1"
  );
  lockedFrame.click();
  assert.deepEqual(renderer.selectedCalls, []);
  assert.equal(fixture.api.getSelectedReward("frame"), "none");
}

function assertMiddleAndMaxStates() {
  assertRenderedState(1);
  const middle = assertRenderedState(5);
  const unlockedAtP5 = middle.catalog.filter(reward => reward.requiredPrestige <= 5);
  const lockedAfterP5 = middle.catalog.filter(reward => reward.requiredPrestige > 5);
  assert.ok(unlockedAtP5.length > 0);
  assert.ok(lockedAfterP5.length > 0);
  assert.equal(middle.fixture.api.selectReward("frame", "prestige-frame-p4"), true);
  assert.equal(middle.fixture.api.selectReward("frame", "prestige-frame-p7"), false);

  const readyMiddle = loadPrestige(5, {ready: true});
  const readyRenderer = loadPrestigeMenuRenderer(readyMiddle.api);
  readyRenderer.api.renderWardrobePrestigePicker();
  assert.equal(readyRenderer.ui.wardrobePrestigeActivateBtn.disabled, false);
  assert.equal(readyRenderer.ui.wardrobePrestigeActivateBtn.textContent, "PRESTIGE AKTIVIEREN");

  const maximum = assertRenderedState(10);
  assert.equal(maximum.catalog.every(reward => reward.requiredPrestige <= 10), true);
  const mastered = loadPrestige(10, {ready: true});
  const masteredRenderer = loadPrestigeMenuRenderer(mastered.api);
  masteredRenderer.api.renderWardrobePrestigePicker();
  assert.equal(masteredRenderer.ui.wardrobePrestigeActivateBtn.disabled, true);
  assert.equal(masteredRenderer.ui.wardrobePrestigeActivateBtn.textContent, "PRESTIGE ABGESCHLOSSEN");
}

function assertP0EntryAndScope() {
  const uiSource = read("js/ui.js");
  const gameSource = read("js/game.js");
  const openMenuStart = gameSource.indexOf("  function openPrestigeMenu(");
  const openMenuEnd = gameSource.indexOf("  function requestPrestigeActivationFromWardrobe(", openMenuStart);
  const openMenuSource = gameSource.slice(openMenuStart, openMenuEnd);
  assert.ok(openMenuStart >= 0 && openMenuEnd > openMenuStart);
  assert.match(openMenuSource, /return showPrestigeCustomization\(\);/);
  assert.doesNotMatch(openMenuSource, /getLevel\(\) > 0|showPrestigeConfirmation/);
  assert.match(
    uiSource,
    /function showPrestigeCustomization\(\)[\s\S]*?showMenuScreen\("wardrobe"\);[\s\S]*?showWardrobeView\("prestige"\);/
  );
  assert.match(uiSource, /ui\.menuPrestigeBtn\.classList\.toggle\("prestigeInvisible", !hasEmblem\)/);
  assert.match(uiSource, /ui\.menuPrestigeBtn\.classList\.remove\("prestigeZeroReady"\)/);
  assert.match(uiSource, /ui\.menuPrestigeBtn\.disabled = transactionPending \|\| !hasEmblem/);
  assert.match(uiSource, /ui\.menuPrestigeLabel\.textContent = ""/);
  assert.match(uiSource, /prestigeLevel > 0\s*\? `PRESTIGE-STUFE \$\{prestigeLevel\}`\s*:\s*"NOCH KEIN PRESTIGE"/);
  assert.match(
    gameSource,
    /function requestPrestigeActivationFromWardrobe\(\)[\s\S]*?showMenuScreen\("main"\);[\s\S]*?showPrestigeConfirmation\(\)/
  );

  const html = read("index.html");
  assert.match(html, /id="wardrobePrestigeActivateBtn"[\s\S]*?PRESTIGE NICHT BEREIT/);
  assert.match(html, /id="wardrobePrestigeLevel">NOCH KEIN PRESTIGE</);
  assert.match(html, /id="prestigeCustomizationLevel">NOCH KEIN PRESTIGE</);
  assert.match(html, /id="wardrobePrestigeMenuBtn"[\s\S]*?PRESTIGE-GARDEROBE/);
  assert.match(
    gameSource,
    /wardrobePrestigeMenuBtn\.addEventListener\("click",[\s\S]*?showWardrobeView\("prestige"\)/
  );
  const coreSource = read("js/core.js");
  assert.match(coreSource, /wardrobePrestigeActivateBtn: document\.getElementById/);

  assert.doesNotMatch(uiSource, /slimejumperSelectedPrestigeMenu|PrestigeMenuStorage/);
  assert.equal((read("js/slime-prestige.js").match(/const PRESTIGE_REWARD_PACKAGES/g) ?? []).length, 1);
}

assertRewardCatalog();
assertP0LockedAndSelectionSafe();
assertMiddleAndMaxStates();
assertPrestigeEligibilityGuards();
assertP0EntryAndScope();
console.log("Prestige menu UI tests passed.");
