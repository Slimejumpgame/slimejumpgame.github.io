"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const audioSource = fs.readFileSync(path.join(root, "js/audio.js"), "utf8");

function createFixture({visibilityState = "visible", musicMuted = false, sfxMuted = false} = {}) {
  const audioContexts = [];
  const gainNodes = [];
  const oscillators = [];
  const timers = [];
  const clearedTimers = [];
  const listeners = new Map();

  function createAudioParam(initialValue = 0) {
    return {
      value: initialValue,
      automation: [],
      setValueAtTime(value, time) {
        this.value = value;
        this.automation.push(["setValueAtTime", value, time]);
      },
      linearRampToValueAtTime(value, time) {
        this.value = value;
        this.automation.push(["linearRampToValueAtTime", value, time]);
      },
      exponentialRampToValueAtTime(value, time) {
        this.value = value;
        this.automation.push(["exponentialRampToValueAtTime", value, time]);
      },
      cancelScheduledValues(time) {
        this.automation.push(["cancelScheduledValues", time]);
      },
      setTargetAtTime(value, time, constant) {
        this.value = value;
        this.automation.push(["setTargetAtTime", value, time, constant]);
      }
    };
  }

  class FakeAudioContext {
    constructor() {
      this.currentTime = 12.5;
      this.state = "running";
      this.destination = {kind: "destination"};
      audioContexts.push(this);
    }

    resume() {}

    createGain() {
      const node = {
        kind: "gain",
        gain: createAudioParam(),
        connections: [],
        connect(target) {
          this.connections.push(target);
        }
      };
      gainNodes.push(node);
      return node;
    }

    createOscillator() {
      const oscillator = {
        kind: "oscillator",
        type: "sine",
        frequency: createAudioParam(),
        connections: [],
        connect(target) {
          this.connections.push(target);
        },
        start() {},
        stop() {},
        onended: null
      };
      oscillators.push(oscillator);
      return oscillator;
    }

    createBiquadFilter() {
      return {
        kind: "filter",
        type: "lowpass",
        frequency: createAudioParam(),
        Q: createAudioParam(),
        connections: [],
        connect(target) {
          this.connections.push(target);
        }
      };
    }
  }

  const document = {
    visibilityState,
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) || [];
      typeListeners.push(listener);
      listeners.set(type, typeListeners);
    }
  };

  const window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    setTimeout(callback, delay) {
      const id = timers.length + 1;
      timers.push({id, callback, delay});
      return id;
    },
    clearTimeout(id) {
      clearedTimers.push(id);
    }
  };

  const context = vm.createContext({
    console,
    document,
    window,
    setTimeout: window.setTimeout
  });

  vm.runInContext(`
    let audioCtx = null;
    let musicBus = null;
    let musicTimer = null;
    let musicMode = "menu";
    let musicStep = 0;
    let musicStarted = false;
    let musicMuted = ${JSON.stringify(musicMuted)};
    let sfxMuted = ${JSON.stringify(sfxMuted)};
    const ui = {};
    ${audioSource}
    globalThis.audioLifecycleTestApi = {
      getAudio,
      getMusicBus,
      setLifecycleMuted,
      startBackgroundMusic,
      tone,
      playLaunch,
      getState: () => ({
        audioCtx,
        lifecycleMuted,
        masterGain,
        musicBus,
        musicMuted,
        sfxMuted,
        musicStarted,
        musicTimer,
        musicStep,
        musicMode
      }),
      constants: {
        lifecycleRamp: LIFECYCLE_GAIN_RAMP_SECONDS,
        musicBusVolume: MUSIC_BUS_VOLUME,
        sfxMultiplier: SFX_VOLUME_MULTIPLIER
      }
    };
  `, context, {filename: "audio-lifecycle-mute-fixture.js"});

  return {
    api: context.audioLifecycleTestApi,
    audioContexts,
    gainNodes,
    oscillators,
    timers,
    clearedTimers,
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
    getListener(type) {
      return (listeners.get(type) || [])[0];
    },
    setVisibility(nextVisibilityState) {
      document.visibilityState = nextVisibilityState;
      for (const listener of listeners.get("visibilitychange") || []) listener();
    }
  };
}

function assertNoEagerAudioInitialization() {
  const hidden = createFixture({visibilityState: "hidden"});
  assert.equal(hidden.api.getState().lifecycleMuted, true);
  assert.equal(hidden.audioContexts.length, 0);
  assert.equal(hidden.gainNodes.length, 0);
  assert.equal(hidden.listenerCount("visibilitychange"), 1);
  hidden.setVisibility("hidden");
  assert.equal(hidden.audioContexts.length, 0);
  assert.equal(hidden.gainNodes.length, 0);

  const visible = createFixture({visibilityState: "visible"});
  assert.equal(visible.api.getState().lifecycleMuted, false);
  visible.setVisibility("visible");
  assert.equal(visible.audioContexts.length, 0);
  assert.equal(visible.gainNodes.length, 0);
}

function assertMasterGainInitialStateAndRamping() {
  const visible = createFixture({visibilityState: "visible"});
  visible.api.getAudio();
  assert.equal(visible.audioContexts.length, 1);
  assert.equal(visible.gainNodes.length, 1);
  assert.equal(visible.api.getState().masterGain.gain.value, 1);

  const hidden = createFixture({visibilityState: "hidden"});
  hidden.api.getAudio();
  assert.equal(hidden.audioContexts.length, 1);
  assert.equal(hidden.gainNodes.length, 1);
  assert.equal(hidden.api.getState().masterGain.gain.value, 0);

  const master = visible.api.getState().masterGain;
  visible.setVisibility("hidden");
  assert.deepEqual(master.gain.automation.slice(-3), [
    ["cancelScheduledValues", 12.5],
    ["setValueAtTime", 1, 12.5],
    ["linearRampToValueAtTime", 0, 12.525]
  ]);
  visible.setVisibility("visible");
  assert.deepEqual(master.gain.automation.slice(-3), [
    ["cancelScheduledValues", 12.5],
    ["setValueAtTime", 0, 12.5],
    ["linearRampToValueAtTime", 1, 12.525]
  ]);
  assert.equal(visible.api.constants.lifecycleRamp, 0.025);
}

function assertLifecycleChangesAreIdempotentAndStateSafe() {
  const fixture = createFixture({visibilityState: "visible", musicMuted: true, sfxMuted: true});
  fixture.api.startBackgroundMusic();
  const before = fixture.api.getState();
  const gainCount = fixture.gainNodes.length;
  const timerCount = fixture.timers.length;
  const listener = fixture.getListener("visibilitychange");

  assert.doesNotMatch(
    String(listener),
    /startBackgroundMusic|setMusicMode|setMusicForLevel/
  );

  fixture.setVisibility("hidden");
  const automationCountAfterHidden = before.masterGain.gain.automation.length;
  fixture.setVisibility("hidden");
  assert.equal(before.masterGain.gain.automation.length, automationCountAfterHidden);

  fixture.setVisibility("visible");
  const automationCountAfterVisible = before.masterGain.gain.automation.length;
  fixture.setVisibility("visible");
  assert.equal(before.masterGain.gain.automation.length, automationCountAfterVisible);

  const after = fixture.api.getState();
  assert.equal(fixture.gainNodes.length, gainCount);
  assert.equal(fixture.timers.length, timerCount);
  assert.equal(fixture.listenerCount("visibilitychange"), 1);
  assert.equal(after.musicMuted, true);
  assert.equal(after.sfxMuted, true);
  assert.equal(after.musicStarted, before.musicStarted);
  assert.equal(after.musicTimer, before.musicTimer);
  assert.equal(after.musicStep, before.musicStep);
  assert.equal(after.musicMode, before.musicMode);
}

function assertAllAudioRoutesThroughMasterWithoutVolumeChanges() {
  const music = createFixture({visibilityState: "visible"});
  const musicBus = music.api.getMusicBus();
  const master = music.api.getState().masterGain;
  assert.equal(master.connections[0], music.audioContexts[0].destination);
  assert.equal(musicBus.connections[0], master);
  assert.equal(musicBus.gain.value, 0.33);

  const sfx = createFixture({visibilityState: "visible"});
  sfx.api.tone(440, 0.08, "sine", 0.05);
  const sfxGain = sfx.gainNodes.at(-1);
  assert.equal(sfxGain.connections[0], sfx.api.getState().masterGain);

  const launch = createFixture({visibilityState: "visible"});
  launch.api.playLaunch();
  const launchGain = launch.gainNodes.at(-1);
  assert.equal(launch.api.constants.musicBusVolume, 0.33);
  assert.equal(launch.api.constants.sfxMultiplier, 1.30);
  assert.ok(Math.abs(launchGain.gain.automation[0][1] - 0.0924 * 1.30) < 1e-12);
  assert.match(audioSource, /function playLaunch\(\) \{ tone\(240, 0\.12, "triangle", 0\.0924, 520\); \}/);
}

assertNoEagerAudioInitialization();
assertMasterGainInitialStateAndRamping();
assertLifecycleChangesAreIdempotentAndStateSafe();
assertAllAudioRoutesThroughMasterWithoutVolumeChanges();
console.log("Audio lifecycle mute tests passed.");
