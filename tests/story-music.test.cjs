"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const audioSource = fs.readFileSync(path.join(root, "js/audio.js"), "utf8");

function createFixture({musicMuted = false, rejectStoryPlay = false} = {}) {
  const audioElements = [];
  const mediaSources = [];
  const gainNodes = [];
  const voiceStarts = [];
  const timers = [];
  const documentListeners = new Map();

  function createAudioParam(initialValue = 0) {
    return {
      value: initialValue,
      automation: [],
      cancelScheduledValues(time) {
        this.automation.push(["cancelScheduledValues", time]);
      },
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
      this.paused = true;
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
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    play() {
      this.playCalls++;
      this.paused = false;
      if (rejectStoryPlay && this.src.includes("assets/music/story/")) {
        return Promise.reject(new Error("play rejected"));
      }
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls++;
      this.paused = true;
    }

    emit(type) {
      for (const listener of this.listeners.get(type) || []) {
        listener({type, target: this});
      }
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
      const node = {
        kind: "gain",
        gain: createAudioParam(),
        connections: [],
        connect(target) { this.connections.push(target); }
      };
      gainNodes.push(node);
      return node;
    }

    createOscillator() {
      const oscillator = {
        type: "sine",
        frequency: createAudioParam(),
        connect() {},
        start() { voiceStarts.push(oscillator); },
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
        connect(target) { this.connections.push(target); }
      };
      mediaSources.push(source);
      return source;
    }
  }

  const document = {
    visibilityState: "visible",
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    }
  };

  const window = {
    Audio: FakeAudioElement,
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    setTimeout(callback, delay) {
      const timer = {id: timers.length + 1, callback, delay, cancelled: false};
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(timerId) {
      const timer = timers.find(candidate => candidate.id === timerId);
      if (timer) timer.cancelled = true;
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
    let musicMuted = ${JSON.stringify(musicMuted)};
    let sfxMuted = false;
    const ui = {};
    const getBiomeForLevel = () => ({id: "meadow"});
    ${audioSource}
    globalThis.storyMusicTestApi = {
      story: window.SlimeStoryAudio,
      startBackgroundMusic,
      setMusicMode,
      updateMusicMute,
      setLifecycleMuted,
      setMuted(value) { musicMuted = value; },
      getState: () => ({
        activeStoryMusicSequence,
        externalBiomeMusicGainNode,
        lifecycleMuted,
        masterGain,
        menuExternalMusicTrack,
        musicBus,
        musicMode,
        musicStarted,
        musicTimer,
        storyMusicGainNode,
        storyMusicPlaybackStarted,
        storyMusicStopping,
        storyMusicTracks
      }),
      constants: {
        externalGain: EXTERNAL_BIOME_MUSIC_GAIN,
        fadeIn: STORY_MUSIC_FADE_IN_SECONDS,
        fadeOut: STORY_MUSIC_FADE_OUT_SECONDS,
        musicBus: MUSIC_BUS_VOLUME,
        storyGain: STORY_MUSIC_GAIN
      }
    };
  `, context, {filename: "story-music-fixture.js"});

  return {
    api: context.storyMusicTestApi,
    audioElements,
    gainNodes,
    mediaSources,
    timers,
    voiceStarts,
    runLatestTimer() {
      const timer = [...timers].reverse().find(candidate => !candidate.cancelled);
      assert.ok(timer, "expected an active timer");
      timer.cancelled = true;
      timer.callback();
      return timer;
    }
  };
}

function getAudioByPath(fixture, audioPath) {
  return fixture.audioElements.find(audio => audio.sourceAssignments.includes(audioPath));
}

function assertLazyRoutingFadesAndReuse() {
  const fixture = createFixture();
  const {api} = fixture;

  assert.equal(fixture.audioElements.length, 0, "Story MP3s must not be requested at boot");
  assert.equal(api.getState().storyMusicGainNode, null);

  api.startBackgroundMusic("menu");
  const menu = getAudioByPath(fixture, "assets/music/menu/main_menu.mp3");
  assert.ok(menu);
  assert.equal(menu.playCalls, 1);

  assert.equal(api.story.start("intro"), true);
  const intro = getAudioByPath(fixture, "assets/music/story/story_intro.mp3");
  assert.ok(intro);
  assert.equal(menu.paused, true, "Menu music must stop when Intro opens");
  assert.equal(menu.currentTime, 0);
  assert.equal(intro.loop, false);
  assert.equal(intro.preload, "none");
  assert.equal(intro.playCalls, 1);
  assert.equal(getAudioByPath(fixture, "assets/music/story/story_middle.mp3"), undefined);
  assert.equal(getAudioByPath(fixture, "assets/music/story/story_ending.mp3"), undefined);
  assert.equal(fixture.voiceStarts.length, 0, "procedural music must stay suppressed");

  let state = api.getState();
  assert.equal(api.constants.storyGain, 0.10);
  assert.equal(api.constants.externalGain, 0.10);
  assert.equal(api.constants.musicBus, 0.33);
  assert.equal(api.constants.fadeIn, 0.30);
  assert.equal(api.constants.fadeOut, 0.40);
  assert.equal(state.storyMusicGainNode.connections[0], state.musicBus);
  assert.equal(state.musicBus.connections[0], state.masterGain);
  assert.equal(state.musicBus.gain.value, 0.33);
  const introSource = fixture.mediaSources.find(source => source.element === intro);
  assert.equal(introSource.connections[0], state.storyMusicGainNode);
  assert.deepEqual(state.storyMusicGainNode.gain.automation.slice(-3), [
    ["cancelScheduledValues", 8],
    ["setValueAtTime", 0, 8],
    ["linearRampToValueAtTime", 0.10, 8.3]
  ]);

  api.story.stop("intro");
  state = api.getState();
  assert.equal(state.activeStoryMusicSequence, "intro", "Story retains ownership during fade-out");
  assert.equal(state.storyMusicStopping, true);
  const stopTimer = fixture.timers.at(-1);
  assert.equal(stopTimer.delay, 400);
  assert.deepEqual(state.storyMusicGainNode.gain.automation.slice(-3), [
    ["cancelScheduledValues", 8],
    ["setValueAtTime", 0.10, 8],
    ["linearRampToValueAtTime", 0, 8.4]
  ]);

  api.setMusicMode("meadow");
  assert.equal(getAudioByPath(fixture, "assets/music/biomes/meadow.mp3"), undefined,
    "next normal source must wait until Story fade-out ends");
  fixture.runLatestTimer();
  const meadow = getAudioByPath(fixture, "assets/music/biomes/meadow.mp3");
  assert.ok(meadow);
  assert.equal(intro.paused, true);
  assert.equal(intro.currentTime, 0);
  assert.equal(meadow.playCalls, 1);
  assert.equal(api.getState().activeStoryMusicSequence, null);

  api.story.start("middle");
  const middle = getAudioByPath(fixture, "assets/music/story/story_middle.mp3");
  assert.ok(middle);
  assert.equal(meadow.paused, true, "biome music must stop for Middle");
  assert.equal(middle.loop, false);
  assert.equal(getAudioByPath(fixture, "assets/music/story/story_ending.mp3"), undefined);
  api.story.stop("middle");
  fixture.runLatestTimer();

  api.story.start("ending");
  const ending = getAudioByPath(fixture, "assets/music/story/story_ending.mp3");
  assert.ok(ending);
  assert.equal(ending.loop, false);
  api.story.stop("ending");
  fixture.runLatestTimer();

  const elementCount = fixture.audioElements.length;
  const sourceCount = fixture.mediaSources.length;
  intro.currentTime = 19;
  api.story.start("intro");
  assert.equal(fixture.audioElements.length, elementCount, "DEV replay must reuse the audio element");
  assert.equal(fixture.mediaSources.length, sourceCount, "DEV replay must reuse its media source");
  assert.equal(intro.sourceAssignments.length, 1);
  assert.equal(intro.currentTime, 0);
  assert.equal(intro.playCalls, 2);
  assert.equal(middle.paused, true);
  assert.equal(ending.paused, true);
  assert.equal(meadow.paused, true, "only the active Story track may be playing");
}

async function assertFailureMuteAndLifecycleSafety() {
  const rejected = createFixture({rejectStoryPlay: true});
  rejected.api.startBackgroundMusic("menu");
  assert.equal(rejected.api.story.start("ending"), true);
  await Promise.resolve();
  await Promise.resolve();
  const rejectedEnding = getAudioByPath(rejected, "assets/music/story/story_ending.mp3");
  assert.equal(rejectedEnding.paused, true);
  assert.equal(rejected.api.getState().activeStoryMusicSequence, "ending");
  assert.equal(rejected.voiceStarts.length, 0, "play rejection must not start a random fallback");
  assert.equal(rejected.api.story.stop("ending"), true);
  assert.equal(rejected.api.getState().activeStoryMusicSequence, null,
    "silent failed Story must close without waiting or trapping continuation");

  const missing = createFixture();
  missing.api.startBackgroundMusic("menu");
  missing.api.story.start("middle");
  const missingMiddle = getAudioByPath(missing, "assets/music/story/story_middle.mp3");
  missingMiddle.emit("error");
  assert.equal(missing.api.getState().storyMusicTracks.get("middle").failed, true);
  assert.equal(missing.api.getState().activeStoryMusicSequence, "middle");
  assert.equal(missing.voiceStarts.length, 0, "load failure must remain silent during Story");
  assert.equal(missing.api.story.stop("middle"), true);

  const muted = createFixture({musicMuted: true});
  assert.equal(muted.api.story.start("intro"), true);
  assert.equal(muted.audioElements.length, 0, "muted Story must not needlessly request its MP3");
  muted.api.setMuted(false);
  muted.api.updateMusicMute();
  muted.api.startBackgroundMusic();
  const lateIntro = getAudioByPath(muted, "assets/music/story/story_intro.mp3");
  assert.ok(lateIntro, "unmuting during Story must start that Story track");
  assert.equal(lateIntro.playCalls, 1);
  muted.api.setLifecycleMuted(true);
  assert.equal(muted.api.getState().masterGain.gain.value, 0);
  muted.api.setLifecycleMuted(false);
  assert.equal(muted.api.getState().masterGain.gain.value, 1);
  assert.equal(muted.api.getState().musicBus.gain.value, 0.33);
}

assertLazyRoutingFadesAndReuse();
assertFailureMuteAndLifecycleSafety().then(() => {
  for (const filename of ["story_intro.mp3", "story_middle.mp3", "story_ending.mp3"]) {
    assert.ok(fs.statSync(path.join(root, "assets/music/story", filename)).size > 0);
  }
  console.log("Story music lazy routing, fades, reuse, failure, mute and lifecycle tests passed.");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
