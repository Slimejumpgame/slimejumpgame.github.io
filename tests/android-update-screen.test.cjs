"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const uiSource = fs.readFileSync(path.join(projectRoot, "js/ui.js"), "utf8");
const updateFunctionsStart = uiSource.indexOf("  function showUpdateScreen");
const updateFunctionsEnd = uiSource.indexOf(
  "  function isDevShopTestActive",
  updateFunctionsStart
);
assert.ok(updateFunctionsStart >= 0 && updateFunctionsEnd > updateFunctionsStart);
const updateFunctions = uiSource.slice(updateFunctionsStart, updateFunctionsEnd);

assert.match(
  uiSource,
  /const ANDROID_UPDATE_RETRY_DELAYS_MS = Object\.freeze\(\[5000, 15000\]\);/
);
assert.match(
  uiSource,
  /remoteUpdate\.versionCode <= installedVersion\.versionCode/
);
assert.match(
  uiSource,
  /cache: "no-store",\s+credentials: "omit"/
);

const RESULT = Object.freeze({
  SUCCESS_NO_UPDATE: "SUCCESS_NO_UPDATE",
  UPDATE_AVAILABLE: "UPDATE_AVAILABLE",
  TECHNICAL_FAILURE: "TECHNICAL_FAILURE"
});

const flushMicrotasks = async (rounds = 12) => {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
};

class FakeClock {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.timers = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, {
      callback,
      dueAt: this.now + Math.max(0, Number(delay) || 0)
    });
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  pendingDelays() {
    return [...this.timers.values()]
      .map(timer => timer.dueAt - this.now)
      .sort((left, right) => left - right);
  }

  async advance(milliseconds) {
    const target = this.now + milliseconds;
    while (true) {
      const nextTimer = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!nextTimer) break;
      const [id, timer] = nextTimer;
      this.timers.delete(id);
      this.now = timer.dueAt;
      timer.callback();
      await flushMicrotasks();
    }
    this.now = target;
    await flushMicrotasks();
  }
}

function createElement({hidden = false, onOpen = null} = {}) {
  const classes = new Set(hidden ? ["hidden"] : []);
  return {
    textContent: "",
    children: [],
    attributes: {},
    classList: {
      add(value) {
        classes.add(value);
      },
      remove(value) {
        const wasHidden = value === "hidden" && classes.has(value);
        classes.delete(value);
        if (wasHidden) onOpen?.();
      },
      contains(value) {
        return classes.has(value);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    replaceChildren() {
      this.children = [];
    },
    appendChild(child) {
      this.children.push(child);
    },
    focus() {
      this.focused = true;
    }
  };
}

function remotePayload(versionCode, versionName = "2.71") {
  return {
    android: {
      versionCode,
      versionName,
      notes: ["Update note"]
    }
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function createFixture({
  native = true,
  platform = "android",
  installedCode = 15,
  installedName = "2.70"
} = {}) {
  const clock = new FakeClock();
  const windowListeners = new Map();
  const appListeners = new Map();
  let overlayOpenCount = 0;
  let fetchCalls = 0;
  let appListenerRegistrations = 0;
  let fetchImplementation = async () => response(remotePayload(16));

  const ui = {
    updateOverlay: createElement({
      hidden: true,
      onOpen: () => {
        overlayOpenCount += 1;
      }
    }),
    updateInstalledVersion: createElement(),
    updateNewVersion: createElement(),
    updateNotesList: createElement(),
    updateOpenStoreBtn: createElement(),
    updateLaterBtn: createElement()
  };
  const appPlugin = {
    async getInfo() {
      return {version: installedName, build: String(installedCode)};
    },
    addListener(name, listener) {
      appListenerRegistrations += 1;
      appListeners.set(name, listener);
      return Promise.resolve({remove() {}});
    }
  };
  const windowObject = {
    Capacitor: {
      getPlatform: () => platform,
      Plugins: {App: appPlugin}
    },
    addEventListener(name, listener) {
      const listeners = windowListeners.get(name) ?? [];
      listeners.push(listener);
      windowListeners.set(name, listeners);
    },
    setTimeout: (callback, delay) => clock.setTimeout(callback, delay),
    clearTimeout: id => clock.clearTimeout(id),
    requestAnimationFrame: callback => callback(),
    open() {}
  };
  const context = vm.createContext({
    ui,
    window: windowObject,
    document: {
      activeElement: null,
      createElement: () => createElement()
    },
    location: {
      protocol: "http:",
      port: "8129",
      hostname: "localhost",
      search: ""
    },
    URLSearchParams,
    AbortController,
    encodeURIComponent,
    Date: {now: () => clock.now},
    UPDATE_STORE_URL: "https://play.google.com/store/apps/details?id=com.slimejumpgame.app",
    ANDROID_UPDATE_ENDPOINT: "https://slimejumpgame.github.io/android-update.json",
    ANDROID_UPDATE_TIMEOUT_MS: 2500,
    ANDROID_UPDATE_RETRY_DELAYS_MS: [5000, 15000],
    ANDROID_UPDATE_CHECK_RESULT: RESULT,
    MAX_ANDROID_VERSION_NAME_LENGTH: 64,
    MAX_ANDROID_UPDATE_NOTES: 12,
    MAX_ANDROID_UPDATE_NOTE_LENGTH: 240,
    isNativeCapacitorRuntime: () => native,
    fetch: (url, options) => {
      fetchCalls += 1;
      return fetchImplementation(url, options);
    }
  });
  vm.runInContext(`
    let updateScreenPreviousFocus = null;
    let androidUpdateCheckInFlight = null;
    let androidUpdateRetryTimeoutId = null;
    let androidUpdateRetryIndex = 0;
    let androidUpdateHadTechnicalFailure = false;
    let androidUpdateScreenShown = false;
    let androidUpdateOnlineListenerRegistered = false;
    let androidUpdateAppStateListenerRegistrationStarted = false;
    ${updateFunctions}
    this.androidUpdateTestApi = {
      initializeAndroidUpdateCheck,
      requestAndroidUpdateCheck
    };
  `, context);

  return {
    api: context.androidUpdateTestApi,
    clock,
    ui,
    appPlugin,
    setFetch(implementation) {
      fetchImplementation = implementation;
    },
    dispatchWindow(name) {
      for (const listener of windowListeners.get(name) ?? []) listener();
    },
    dispatchAppState(isActive) {
      appListeners.get("appStateChange")?.({isActive});
    },
    get fetchCalls() {
      return fetchCalls;
    },
    get overlayOpenCount() {
      return overlayOpenCount;
    },
    get appListenerRegistrations() {
      return appListenerRegistrations;
    },
    get onlineListenerCount() {
      return (windowListeners.get("online") ?? []).length;
    }
  };
}

const tests = [];
function test(name, run) {
  tests.push({name, run});
}

test("installed 15 / remote 16 shows the update", async () => {
  const fixture = createFixture({installedCode: 15});
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.UPDATE_AVAILABLE);
  assert.equal(fixture.fetchCalls, 1);
  assert.equal(fixture.overlayOpenCount, 1);
});

test("installed 16 / remote 16 is a successful no-update", async () => {
  const fixture = createFixture({installedCode: 16, installedName: "2.71"});
  fixture.setFetch(async () => response(remotePayload(16)));
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.SUCCESS_NO_UPDATE);
  assert.equal(fixture.overlayOpenCount, 0);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
});

test("installed 16 / remote 15 is a successful no-update", async () => {
  const fixture = createFixture({installedCode: 16, installedName: "2.71"});
  fixture.setFetch(async () => response(remotePayload(15, "2.70")));
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.SUCCESS_NO_UPDATE);
  assert.equal(fixture.overlayOpenCount, 0);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
});

test("web runtime does not register listeners or fetch", async () => {
  const fixture = createFixture({native: false});
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.SUCCESS_NO_UPDATE);
  assert.equal(fixture.fetchCalls, 0);
  assert.equal(fixture.onlineListenerCount, 0);
  assert.equal(fixture.appListenerRegistrations, 0);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
});

test("a failed first fetch performs the five-second retry", async () => {
  const fixture = createFixture({installedCode: 16});
  let attempt = 0;
  fixture.setFetch(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error("network failure");
    return response(remotePayload(16));
  });
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.TECHNICAL_FAILURE);
  assert.deepEqual(fixture.clock.pendingDelays(), [5000]);
  await fixture.clock.advance(4999);
  assert.equal(fixture.fetchCalls, 1);
  await fixture.clock.advance(1);
  assert.equal(fixture.fetchCalls, 2);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
});

test("a fetch timeout performs a retry", async () => {
  const fixture = createFixture({installedCode: 16});
  let attempt = 0;
  fixture.setFetch((_url, options) => {
    attempt += 1;
    if (attempt > 1) return Promise.resolve(response(remotePayload(16)));
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true
      });
    });
  });
  const initialCheck = fixture.api.initializeAndroidUpdateCheck();
  await flushMicrotasks();
  await fixture.clock.advance(2500);
  assert.equal(await initialCheck, RESULT.TECHNICAL_FAILURE);
  assert.deepEqual(fixture.clock.pendingDelays(), [5000]);
  await fixture.clock.advance(5000);
  assert.equal(fixture.fetchCalls, 2);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
});

test("a failed first fetch can recover to an available update", async () => {
  const fixture = createFixture({installedCode: 15});
  let attempt = 0;
  fixture.setFetch(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error("offline");
    return response(remotePayload(16));
  });
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.TECHNICAL_FAILURE);
  await fixture.clock.advance(5000);
  assert.equal(fixture.fetchCalls, 2);
  assert.equal(fixture.overlayOpenCount, 1);
});

test("online recovers a previous technical failure", async () => {
  const fixture = createFixture({installedCode: 15});
  fixture.setFetch(async () => {
    throw new Error("offline");
  });
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.TECHNICAL_FAILURE);
  fixture.setFetch(async () => response(remotePayload(16)));
  fixture.dispatchWindow("online");
  await flushMicrotasks();
  assert.equal(fixture.fetchCalls, 2);
  assert.equal(fixture.overlayOpenCount, 1);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
});

test("native active app-state recovers a previous failure", async () => {
  const fixture = createFixture({installedCode: 15});
  fixture.setFetch(async () => {
    throw new Error("offline");
  });
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.TECHNICAL_FAILURE);
  fixture.setFetch(async () => response(remotePayload(16)));
  fixture.dispatchAppState(false);
  await flushMicrotasks();
  assert.equal(fixture.fetchCalls, 1);
  fixture.dispatchAppState(true);
  await flushMicrotasks();
  assert.equal(fixture.fetchCalls, 2);
  assert.equal(fixture.overlayOpenCount, 1);
  assert.equal(fixture.appListenerRegistrations, 1);
});

test("simultaneous checks share one in-flight fetch", async () => {
  const fixture = createFixture({installedCode: 16});
  let resolveFetch;
  fixture.setFetch(() => new Promise(resolve => {
    resolveFetch = resolve;
  }));
  const first = fixture.api.initializeAndroidUpdateCheck();
  const second = fixture.api.requestAndroidUpdateCheck();
  assert.equal(first, second);
  await flushMicrotasks();
  assert.equal(fixture.fetchCalls, 1);
  resolveFetch(response(remotePayload(16)));
  assert.deepEqual(await Promise.all([first, second]), [
    RESULT.SUCCESS_NO_UPDATE,
    RESULT.SUCCESS_NO_UPDATE
  ]);
});

test("an update already shown cannot open the overlay twice", async () => {
  const fixture = createFixture({installedCode: 15});
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.UPDATE_AVAILABLE);
  fixture.dispatchAppState(true);
  fixture.dispatchWindow("online");
  assert.equal(await fixture.api.requestAndroidUpdateCheck(), RESULT.UPDATE_AVAILABLE);
  await flushMicrotasks();
  assert.equal(fixture.fetchCalls, 1);
  assert.equal(fixture.overlayOpenCount, 1);
  assert.equal(fixture.onlineListenerCount, 1);
  assert.equal(fixture.appListenerRegistrations, 1);
});

test("SUCCESS_NO_UPDATE creates no technical retry loop", async () => {
  const fixture = createFixture({installedCode: 16});
  fixture.setFetch(async () => response(remotePayload(16)));
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.SUCCESS_NO_UPDATE);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
  await fixture.clock.advance(60000);
  assert.equal(fixture.fetchCalls, 1);
});

test("a successful recovery cancels the pending retry timer", async () => {
  const fixture = createFixture({installedCode: 16});
  fixture.setFetch(async () => {
    throw new Error("offline");
  });
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.TECHNICAL_FAILURE);
  assert.deepEqual(fixture.clock.pendingDelays(), [5000]);
  fixture.setFetch(async () => response(remotePayload(16)));
  fixture.dispatchWindow("online");
  await flushMicrotasks();
  assert.deepEqual(fixture.clock.pendingDelays(), []);
  await fixture.clock.advance(30000);
  assert.equal(fixture.fetchCalls, 2);
});

test("automatic retries stop after five and fifteen seconds", async () => {
  const fixture = createFixture({installedCode: 16});
  fixture.setFetch(async () => {
    throw new Error("network failure");
  });
  assert.equal(await fixture.api.initializeAndroidUpdateCheck(), RESULT.TECHNICAL_FAILURE);
  assert.deepEqual(fixture.clock.pendingDelays(), [5000]);
  await fixture.clock.advance(5000);
  assert.equal(fixture.fetchCalls, 2);
  assert.deepEqual(fixture.clock.pendingDelays(), [15000]);
  await fixture.clock.advance(15000);
  assert.equal(fixture.fetchCalls, 3);
  assert.deepEqual(fixture.clock.pendingDelays(), []);
  await fixture.clock.advance(60000);
  assert.equal(fixture.fetchCalls, 3);
});

(async () => {
  for (const {name, run} of tests) {
    await run();
    console.log(`ok - ${name}`);
  }
  console.log(`Android update screen tests passed (${tests.length} cases).`);
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
