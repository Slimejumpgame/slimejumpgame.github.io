"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    snapshot() { return Object.fromEntries(values); }
  };
}

class FakeClassList {
  constructor() { this.values = new Set(["hidden"]); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor() {
    this.textContent = "";
    this.attributes = {};
    this.classList = new FakeClassList();
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  focus() { this.focusCount += 1; }
}

function loadPurchaseInfoApi(localStorage) {
  const ui = {
    perkConflictPurchaseInfoOverlay: new FakeElement(),
    perkConflictPurchaseInfoTitle: new FakeElement(),
    perkConflictPurchaseInfoText: new FakeElement(),
    perkConflictPurchaseInfoConfirmBtn: new FakeElement()
  };
  const previousFocus = new FakeElement();
  const source = read("js/ui.js");
  const sliceStart = source.indexOf("  const PERK_CONFLICT_PURCHASE_INFO");
  const sliceEnd = source.indexOf("  function showUpdateScreen", sliceStart);
  assert.ok(sliceStart >= 0 && sliceEnd > sliceStart);

  const context = vm.createContext({
    ui,
    localStorage,
    document: {activeElement: previousFocus},
    window: {requestAnimationFrame: callback => callback()},
    console
  });
  vm.runInContext(
    source.slice(sliceStart, sliceEnd) + `
      globalThis.purchaseInfoTestApi = {
        showPerkConflictPurchaseInfo,
        closePerkConflictPurchaseInfo
      };
    `,
    context,
    {filename: "js/ui-perk-purchase-info-test-slice.js"}
  );
  return {api: context.purchaseInfoTestApi, ui, previousFocus};
}

function assertOneTimePersistence() {
  const localStorage = createStorage();
  const firstPage = loadPurchaseInfoApi(localStorage);

  assert.equal(firstPage.api.showPerkConflictPurchaseInfo("air_brake"), true);
  assert.equal(firstPage.ui.perkConflictPurchaseInfoTitle.textContent, "AIR BRAKE");
  assert.equal(
    firstPage.ui.perkConflictPurchaseInfoText.textContent,
    "Air Brake kann nicht gleichzeitig mit Air Hop in einem Run verwendet werden. Wähle immer nur eine der beiden Fähigkeiten aus."
  );
  assert.equal(firstPage.ui.perkConflictPurchaseInfoOverlay.classList.contains("hidden"), false);
  assert.equal(firstPage.ui.perkConflictPurchaseInfoConfirmBtn.focusCount, 1);
  assert.equal(
    localStorage.snapshot().slimejumperAirBrakeConflictPurchaseInfoSeen,
    "true"
  );

  firstPage.api.closePerkConflictPurchaseInfo();
  assert.equal(firstPage.ui.perkConflictPurchaseInfoOverlay.classList.contains("hidden"), true);
  assert.equal(firstPage.previousFocus.focusCount, 1);
  assert.equal(firstPage.api.showPerkConflictPurchaseInfo("air_brake"), false);

  assert.equal(firstPage.api.showPerkConflictPurchaseInfo("air_hop"), true);
  assert.equal(firstPage.ui.perkConflictPurchaseInfoTitle.textContent, "AIR HOP");
  assert.equal(
    localStorage.snapshot().slimejumperAirHopConflictPurchaseInfoSeen,
    "true"
  );

  const reloadedPage = loadPurchaseInfoApi(localStorage);
  assert.equal(reloadedPage.api.showPerkConflictPurchaseInfo("air_brake"), false);
  assert.equal(reloadedPage.api.showPerkConflictPurchaseInfo("air_hop"), false);
}

function assertPurchaseOnlyIntegration() {
  const source = read("js/ui.js");
  const purchaseStart = source.indexOf("        if (!isUnlocked) {");
  const selectionStart = source.indexOf("        const result = perks.toggleSelectedPerk", purchaseStart);
  const purchaseSource = source.slice(purchaseStart, selectionStart);
  assert.ok(purchaseStart >= 0 && selectionStart > purchaseStart);
  assert.match(
    purchaseSource,
    /if \(!purchase\.ok\) \{[\s\S]*?return;[\s\S]*?showPerkConflictPurchaseInfo\(perk\.id\);[\s\S]*?return;/
  );
  assert.equal(
    (source.match(/showPerkConflictPurchaseInfo\(perk\.id\)/g) ?? []).length,
    1,
    "purchase info must only be triggered by the successful purchase branch"
  );

  const html = read("index.html");
  assert.match(
    html,
    /id="perkConflictPurchaseInfoOverlay" class="overlay checkpointOverlay hidden"[\s\S]*?class="card checkpointDialog uiPanel"[\s\S]*?id="perkConflictPurchaseInfoConfirmBtn"/
  );
  const coreSource = read("js/core.js");
  assert.match(coreSource, /perkConflictPurchaseInfoOverlay: document\.getElementById/);
  assert.match(coreSource, /perkConflictPurchaseInfoConfirmBtn: document\.getElementById/);

  const resetSource = read("js/slime-progress-reset.js");
  assert.doesNotMatch(resetSource, /slimejumperAirHopConflictPurchaseInfoSeen/);
  assert.doesNotMatch(resetSource, /slimejumperAirBrakeConflictPurchaseInfoSeen/);
}

assertOneTimePersistence();
assertPurchaseOnlyIntegration();
console.log("Perk purchase info tests passed.");
