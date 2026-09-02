"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const audioSource = fs.readFileSync(path.join(root, "js/audio.js"), "utf8");

function createFixture() {
  const audioElements = [];
  const mediaSources = [];
  const voiceStarts = [];
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

  class FakeAudioElement {
    constructor() {
      this.currentTime = 0;
      this.loop = false;
      this.preload = "auto";
      this.playCalls = 0;
      this.pauseCalls = 0;
      this.sourceAssignments = [];
      this.listeners = new Map();
      audioElements.push(this);
    }

    set src(value) {
      this.sourceAssignments.push(value);
      this.source = value;
    }

    get src() {
      return this.source || "";
    }

    addEventListener(type, listener) {
      const typeListeners = this.listeners.get(type) || [];
      typeListeners.push(listener);
      this.listeners.set(type, typeListeners);
    }

    play() {
      this.playCalls++;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls++;
    }

    emit(type) {
      for (const listener of this.listeners.get(type) || []) listener({type, target: this});
    }
  }

  class FakeAudioContext {
    constructor() {
      this.currentTime = 8;
      this.state = "running";
      this.destination = {kind: "destination"};
    }

    resume() {}

    createGain() {
      return {
        kind: "gain",
        gain: createAudioParam(),
        connections: [],
        connect(target) {
          this.connections.push(target);
        }
      };
    }

    createOscillator() {
      const oscillator = {
        type: "sine",
        frequency: createAudioParam(),
        connect() {},
        start() {
          voiceStarts.push({frequency: oscillator.frequency.value, type: oscillator.type});
        },
        stop() {},
        onended: null
      };
      return oscillator;
    }

    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: createAudioParam(),
        Q: createAudioParam(),
        connect() {}
      };
    }

    createMediaElementSource(element) {
      const source = {
        element,
        connections: [],
        connect(target) {
          this.connections.push(target);
        }
      };
      mediaSources.push(source);
      return source;
    }
  }

  const document = {
    visibilityState: "visible",
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) || [];
      typeListeners.push(listener);
      listeners.set(type, typeListeners);
    }
  };

  const window = {
    Audio: FakeAudioElement,
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

  const context = vm.createContext({console, document, window});
  vm.runInContext(`
    let audioCtx = null;
    let musicBus = null;
    let musicTimer = null;
    let musicMode = "menu";
    let musicStep = 0;
    let musicStarted = false;
    let musicMuted = false;
    let sfxMuted = false;
    const ui = {};
    ${audioSource}
    globalThis.meadowMusicTestApi = {
      startBackgroundMusic,
      setMusicMode,
      updateMusicMute,
      setLifecycleMuted,
      setMuted(value) { musicMuted = value; },
      getState: () => ({
        externalBiomeMusicTracks,
        externalBiomeMusicGainNode,
        lifecycleMuted,
        masterGain,
        menuExternalMusicTrack,
        musicBus,
        musicMode,
        musicStarted,
        musicStep,
        musicTimer
      }),
      constants: {externalBiomeMusicGain: EXTERNAL_BIOME_MUSIC_GAIN}
    };
  `, context, {filename: "meadow-external-music-fixture.js"});

  return {
    api: context.meadowMusicTestApi,
    audioElements,
    clearedTimers,
    mediaSources,
    timers,
    voiceStarts
  };
}

function assertLazyResolutionSwitchingAndReuse() {
  const fixture = createFixture();

  assert.equal(fixture.audioElements.length, 0, "external music must not be requested at startup");
  assert.equal(fixture.api.getState().externalBiomeMusicTracks.size, 0);
  fixture.api.setMusicMode("menu");
  assert.equal(fixture.audioElements.length, 0, "selecting menu mode alone must remain lazy");

  fixture.api.startBackgroundMusic("menu");
  assert.equal(fixture.audioElements.length, 1);
  const menu = fixture.audioElements[0];
  assert.deepEqual(menu.sourceAssignments, ["assets/music/menu/main_menu.mp3"]);
  assert.equal(menu.preload, "none");
  assert.equal(menu.loop, true);
  assert.equal(menu.playCalls, 1);
  assert.equal(fixture.voiceStarts.length, 0, "procedural menu tones must be suppressed");
  assert.equal(fixture.api.getState().musicTimer, null);
  assert.equal(fixture.api.getState().externalBiomeMusicTracks.size, 0);

  menu.currentTime = 23;
  fixture.api.setMusicMode("meadow");
  assert.equal(menu.pauseCalls, 1, "menu MP3 must stop when gameplay starts");
  assert.equal(menu.currentTime, 0);
  assert.equal(fixture.audioElements.length, 2);
  const meadow = fixture.audioElements[1];
  assert.deepEqual(meadow.sourceAssignments, ["assets/music/biomes/meadow.mp3"]);
  assert.equal(meadow.preload, "none");
  assert.equal(meadow.loop, true);
  assert.equal(meadow.playCalls, 1);
  assert.equal(fixture.mediaSources.length, 2);
  assert.equal(fixture.mediaSources[0].element, menu);
  assert.equal(fixture.mediaSources[1].element, meadow);
  const state = fixture.api.getState();
  assert.equal(fixture.api.constants.externalBiomeMusicGain, 0.10);
  assert.equal(state.externalBiomeMusicGainNode.gain.value, 0.10);
  assert.equal(fixture.mediaSources[0].connections[0], state.externalBiomeMusicGainNode);
  assert.equal(fixture.mediaSources[1].connections[0], state.externalBiomeMusicGainNode);
  assert.equal(state.externalBiomeMusicGainNode.connections[0], state.musicBus);
  assert.equal(state.musicBus.gain.value, 0.33, "procedural music bus volume must not change");
  assert.equal(fixture.voiceStarts.length, 0, "procedural Meadow tones must be suppressed");
  assert.equal(fixture.api.getState().musicTimer, null);
  assert.equal(state.externalBiomeMusicTracks.get("meadow").audio, meadow);

  meadow.currentTime = 17;
  fixture.api.setMusicMode("coast");
  assert.equal(meadow.pauseCalls, 1);
  assert.equal(meadow.currentTime, 0);
  assert.equal(fixture.audioElements.length, 3);
  const coast = fixture.audioElements[2];
  assert.deepEqual(coast.sourceAssignments, ["assets/music/biomes/coast.mp3"]);
  assert.equal(coast.loop, true);
  assert.equal(coast.playCalls, 1);
  assert.equal(fixture.voiceStarts.length, 0, "available Coast MP3 must suppress procedural music");

  coast.currentTime = 19;
  fixture.api.setMusicMode("crystalCave");
  assert.equal(coast.pauseCalls, 1);
  assert.equal(coast.currentTime, 0);
  assert.equal(fixture.audioElements.length, 4);
  const arbitraryBiome = fixture.audioElements[3];
  assert.deepEqual(
    arbitraryBiome.sourceAssignments,
    ["assets/music/biomes/crystalCave.mp3"],
    "an arbitrary canonical biome ID must produce its drop-in path"
  );
  assert.equal(fixture.api.getState().externalBiomeMusicTracks.size, 3);
  assert.doesNotMatch(audioSource, /mode === "(?:meadow|coast|crystalCave)"/);

  fixture.api.setMusicMode("menu");
  assert.equal(arbitraryBiome.pauseCalls, 1);
  assert.equal(fixture.audioElements.length, 4, "menu return must reuse its audio element");
  assert.equal(fixture.mediaSources.length, 4, "menu return must reuse its media source");
  assert.equal(menu.sourceAssignments.length, 1, "menu return must not request the asset again");
  assert.equal(menu.playCalls, 2);
  assert.equal(fixture.voiceStarts.length, 0);

  fixture.api.setMusicMode("meadow");
  assert.equal(menu.pauseCalls, 2, "menu and Meadow must not overlap");
  assert.equal(fixture.audioElements.length, 4, "Meadow re-entry must reuse the audio element");
  assert.equal(fixture.mediaSources.length, 4, "Meadow re-entry must reuse the media source");
  assert.equal(meadow.sourceAssignments.length, 1, "re-entry must not request the asset again");
  assert.equal(meadow.playCalls, 2);
  assert.equal(fixture.voiceStarts.length, 0);

  for (const source of fixture.mediaSources) {
    assert.equal(source.connections[0], state.externalBiomeMusicGainNode);
  }

  fixture.api.setMuted(true);
  fixture.api.updateMusicMute();
  assert.equal(fixture.api.getState().musicBus.gain.value, 0);
  fixture.api.setMuted(false);
  fixture.api.updateMusicMute();
  assert.equal(fixture.api.getState().musicBus.gain.value, 0.33);

  fixture.api.setLifecycleMuted(true);
  assert.equal(fixture.api.getState().masterGain.gain.value, 0);
  fixture.api.setLifecycleMuted(false);
  assert.equal(fixture.api.getState().masterGain.gain.value, 1);
}

function assertMissingBiomeFallsBackOnce() {
  const fixture = createFixture();
  fixture.api.startBackgroundMusic("desert");

  assert.equal(fixture.audioElements.length, 1);
  assert.equal(fixture.voiceStarts.length, 0);
  const missingDesert = fixture.audioElements[0];
  assert.deepEqual(missingDesert.sourceAssignments, ["assets/music/biomes/desert.mp3"]);
  missingDesert.emit("error");

  const state = fixture.api.getState();
  assert.equal(state.externalBiomeMusicTracks.get("desert").failed, true);
  assert.equal(state.musicMode, "desert");
  assert.equal(state.musicStep, 1);
  assert.ok(state.musicTimer);
  assert.equal(fixture.voiceStarts.length, 2, "missing MP3 must start that biome's procedural theme");

  fixture.timers.at(-1).callback();
  fixture.api.startBackgroundMusic("desert");
  assert.equal(fixture.audioElements.length, 1, "failed biome must not create another audio element");
  assert.equal(fixture.mediaSources.length, 1, "failed biome must not create another media source");
  assert.equal(missingDesert.sourceAssignments.length, 1, "failed biome must not be requested repeatedly");
  assert.equal(missingDesert.playCalls, 1);

  fixture.api.setMusicMode("coast");
  const coast = fixture.audioElements[1];
  fixture.api.setMusicMode("desert");
  assert.equal(coast.pauseCalls, 1);
  assert.equal(fixture.audioElements.length, 2);
  assert.equal(missingDesert.sourceAssignments.length, 1);
  assert.equal(missingDesert.playCalls, 1);
  assert.equal(fixture.voiceStarts.length, 5, "failed biome must keep procedural music on re-entry");
}

function assertFailureFallsBackToProceduralMenu() {
  const fixture = createFixture();
  fixture.api.startBackgroundMusic("menu");

  assert.equal(fixture.audioElements.length, 1);
  assert.equal(fixture.voiceStarts.length, 0);
  fixture.audioElements[0].emit("error");

  const state = fixture.api.getState();
  assert.equal(state.menuExternalMusicTrack.failed, true);
  assert.equal(state.musicMode, "menu");
  assert.equal(state.musicStep, 1);
  assert.ok(state.musicTimer);
  assert.equal(fixture.voiceStarts.length, 2, "failed menu MP3 must start procedural menu music");

  fixture.api.setMusicMode("coast");
  fixture.api.setMusicMode("menu");
  assert.equal(fixture.audioElements.length, 2);
  assert.equal(fixture.audioElements[0].playCalls, 1);
  assert.equal(fixture.voiceStarts.length, 4, "failed menu MP3 must keep procedural fallback on return");
}

assertLazyResolutionSwitchingAndReuse();
assertMissingBiomeFallsBackOnce();
assertFailureFallsBackToProceduralMenu();
console.log("Generic external biome and menu music tests passed.");
