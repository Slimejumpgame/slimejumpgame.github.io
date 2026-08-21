"use strict";

const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

const EXISTING_THEME_IDS = Object.freeze([
  "menu",
  "meadow",
  "coast",
  "desert",
  "volcano",
  "snow",
  "swamp",
  "crystalCave",
  "night",
  "autumn",
  "sky"
]);

const NEW_THEME_IDS = Object.freeze([
  "stormNight",
  "neonCity",
  "mushroomCave",
  "abandonedMine",
  "bambooNight",
  "pirateHarbor",
  "alienJungle",
  "enchantedGarden",
  "redMoon",
  "undergroundTemple"
]);

const LEVEL_THEME_EXPECTATIONS = Object.freeze([
  Object.freeze([101, "stormNight"]),
  Object.freeze([111, "neonCity"]),
  Object.freeze([121, "mushroomCave"]),
  Object.freeze([131, "abandonedMine"]),
  Object.freeze([141, "bambooNight"]),
  Object.freeze([151, "pirateHarbor"]),
  Object.freeze([161, "alienJungle"]),
  Object.freeze([171, "enchantedGarden"]),
  Object.freeze([181, "redMoon"]),
  Object.freeze([191, "undergroundTemple"]),
  Object.freeze([201, "meadow"])
]);

function loadThemeDefinitions(source) {
  const context = vm.createContext({window: {}});
  vm.runInContext(`
    ${source}
    globalThis.musicThemeTestApi = {themes: MUSIC_THEMES, busVolume: MUSIC_BUS_VOLUME};
  `, context, {filename: "music-theme-definition-fixture.js"});
  return context.musicThemeTestApi;
}

function readHead(relativePath) {
  return execFileSync("git", ["show", `HEAD:${relativePath.replace(/\\/g, "/")}`], {
    cwd: root,
    encoding: "utf8"
  });
}

function createPlaybackFixture() {
  const voiceStarts = [];
  const voiceStopCalls = [];
  const gainNodes = [];
  const timers = [];
  const clearedTimers = [];
  let nextVoiceId = 1;

  function createAudioParam(automation) {
    return {
      value: 0,
      setValueAtTime(value, time) {
        automation.push(["setValueAtTime", value, time]);
      },
      exponentialRampToValueAtTime(value, time) {
        automation.push(["exponentialRampToValueAtTime", value, time]);
      },
      cancelScheduledValues(time) {
        automation.push(["cancelScheduledValues", time]);
      },
      setTargetAtTime(value, time, constant) {
        automation.push(["setTargetAtTime", value, time, constant]);
      }
    };
  }

  class FakeAudioContext {
    constructor() {
      this.currentTime = 12.5;
      this.state = "running";
      this.destination = {kind: "destination"};
    }

    resume() {}

    createOscillator() {
      const id = nextVoiceId++;
      const oscillator = {
        type: "sine",
        frequency: {
          value: 0,
          setValueAtTime(value) {
            this.value = value;
          },
          exponentialRampToValueAtTime(value) {
            this.value = value;
          }
        },
        connect() {},
        start: () => voiceStarts.push({id, frequency: oscillator.frequency.value, type: oscillator.type}),
        stop: when => voiceStopCalls.push({id, when}),
        onended: null
      };
      return oscillator;
    }

    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: createAudioParam([]),
        Q: createAudioParam([]),
        connect() {}
      };
    }

    createGain() {
      const automation = [];
      const gain = createAudioParam(automation);
      const node = {gain, automation, connect() {}};
      gainNodes.push(node);
      return node;
    }
  }

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
  const context = vm.createContext({window, console});
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
    ${read("js/biomes.js")}
    ${read("js/audio.js")}
    globalThis.musicPlaybackTestApi = {
      themes: MUSIC_THEMES,
      startBackgroundMusic,
      setMusicMode,
      setMusicForLevel,
      scheduleMusicStep,
      getState: () => ({musicMode, musicStep, musicStarted, musicTimer}),
      getActiveVoiceCount: () => activeMusicVoices.size
    };
  `, context, {filename: "music-playback-fixture.js"});
  return {
    api: context.musicPlaybackTestApi,
    voiceStarts,
    voiceStopCalls,
    gainNodes,
    timers,
    clearedTimers
  };
}

function assertCatalogAndExistingThemes() {
  const audioSource = read("js/audio.js");
  const current = loadThemeDefinitions(audioSource);
  const baseline = loadThemeDefinitions(readHead("js/audio.js"));

  assert.doesNotMatch(audioSource, /BIOME_MUSIC_ALIASES/);
  assert.deepEqual(
    Object.keys(plain(current.themes)),
    [...EXISTING_THEME_IDS, ...NEW_THEME_IDS]
  );

  for (const id of EXISTING_THEME_IDS) {
    assert.deepEqual(
      plain(current.themes[id]),
      plain(baseline.themes[id]),
      `existing theme changed: ${id}`
    );
  }

  const existingSignatures = new Set(
    EXISTING_THEME_IDS.map(id => JSON.stringify(plain(current.themes[id])))
  );
  const newSignatures = NEW_THEME_IDS.map(id => JSON.stringify(plain(current.themes[id])));
  assert.equal(new Set(newSignatures).size, NEW_THEME_IDS.length);
  assert.equal(newSignatures.some(signature => existingSignatures.has(signature)), false);

  for (let left = 0; left < NEW_THEME_IDS.length; left++) {
    for (let right = left + 1; right < NEW_THEME_IDS.length; right++) {
      const leftNotes = current.themes[NEW_THEME_IDS[left]].notes;
      const rightNotes = current.themes[NEW_THEME_IDS[right]].notes;
      const equalPositions = leftNotes.filter((note, index) => note === rightNotes[index]).length;
      assert.ok(
        equalPositions <= 8,
        `${NEW_THEME_IDS[left]} and ${NEW_THEME_IDS[right]} are too melodically similar`
      );
    }
  }
}

function assertTechnicalTrackQuality() {
  const {themes, busVolume} = loadThemeDefinitions(read("js/audio.js"));
  const conservativePeaks = [];

  for (const id of NEW_THEME_IDS) {
    const theme = themes[id];
    assert.ok(theme && typeof theme === "object");
    assert.equal(theme.notes.length, 16);
    assert.equal(theme.bass.length, 4);
    assert.equal(theme.notes.every(note => Number.isFinite(note) && note >= 80 && note <= 1600), true);
    assert.equal(theme.bass.every(note => Number.isFinite(note) && note >= 80 && note <= 260), true);
    assert.ok(["sine", "triangle", "square", "sawtooth"].includes(theme.noteType));
    assert.ok(theme.stepMs >= 255 && theme.stepMs <= 440);
    assert.ok(theme.noteDuration > 0 && theme.noteDuration <= theme.stepMs / 1000 * 2);
    assert.ok(theme.bassDuration > 0 && theme.bassDuration <= theme.stepMs / 1000 * 4);
    assert.ok(theme.noteVolume >= 0.028 && theme.noteVolume <= 0.045);
    assert.ok(theme.bassVolume >= 0.028 && theme.bassVolume <= 0.036);
    assert.ok(theme.filterFrequency >= 1000 && theme.filterFrequency <= 3200);

    const loopDuration = theme.notes.length * theme.stepMs / 1000;
    assert.ok(loopDuration >= 4.0 && loopDuration <= 7.1);

    const overlappingNotes = Math.ceil(theme.noteDuration / (theme.stepMs / 1000));
    const overlappingBass = Math.ceil(theme.bassDuration / (theme.stepMs / 1000 * 4));
    const conservativePeak = (
      overlappingNotes * theme.noteVolume + overlappingBass * theme.bassVolume
    ) * busVolume;
    conservativePeaks.push(conservativePeak);
    assert.ok(conservativePeak < 0.05, `${id} has an unsafe conservative peak estimate`);
  }

  assert.ok(Math.max(...conservativePeaks) / Math.min(...conservativePeaks) < 2.1);
}

function assertLoopPlaybackAndEnvelopes() {
  for (const id of NEW_THEME_IDS) {
    const fixture = createPlaybackFixture();
    const theme = fixture.api.themes[id];
    const melodyFrequencies = [];

    for (let step = 0; step <= 16; step++) {
      const voiceCountBeforeStep = fixture.voiceStarts.length;
      if (step === 0) fixture.api.startBackgroundMusic(id);
      else fixture.api.scheduleMusicStep();
      assert.ok(fixture.voiceStarts.length > voiceCountBeforeStep);
      melodyFrequencies.push(fixture.voiceStarts[voiceCountBeforeStep].frequency);
    }

    assert.deepEqual(melodyFrequencies.slice(0, 16), plain(theme.notes));
    assert.equal(melodyFrequencies[16], theme.notes[0]);
    assert.equal(fixture.timers.every(timer => timer.delay === theme.stepMs), true);
    assert.equal(fixture.api.getState().musicStep, 17);
    assert.equal(fixture.api.getState().musicMode, id);

    const melodyGainAutomation = fixture.gainNodes[1].automation;
    assert.deepEqual(melodyGainAutomation[0], ["setValueAtTime", 0.0001, 12.5]);
    assert.deepEqual(melodyGainAutomation[1], ["exponentialRampToValueAtTime", theme.noteVolume, 12.535]);
    assert.deepEqual(melodyGainAutomation[2], ["exponentialRampToValueAtTime", 0.0001, 12.5 + theme.noteDuration]);
  }
}

function assertLevelThemeMapping() {
  const fixture = createPlaybackFixture();
  const existingBiomeThemeIds = EXISTING_THEME_IDS.slice(1);

  for (let level = 1; level <= 100; level++) {
    const expectedThemeId = existingBiomeThemeIds[Math.floor((level - 1) / 10)];
    fixture.api.setMusicForLevel(level);
    assert.equal(fixture.api.getState().musicMode, expectedThemeId, `wrong music for level ${level}`);
  }

  for (let level = 101; level <= 200; level++) {
    const expectedThemeId = NEW_THEME_IDS[Math.floor((level - 101) / 10)];
    fixture.api.setMusicForLevel(level);
    assert.equal(fixture.api.getState().musicMode, expectedThemeId, `wrong music for level ${level}`);
  }

  fixture.api.setMusicForLevel(201);
  assert.equal(fixture.api.getState().musicMode, "meadow");
}

function assertBiomeSwitching() {
  const fixture = createPlaybackFixture();
  fixture.api.setMusicForLevel(101);
  assert.equal(fixture.api.getState().musicMode, "stormNight");
  fixture.api.startBackgroundMusic();
  assert.equal(fixture.voiceStarts[0].frequency, fixture.api.themes.stormNight.notes[0]);
  assert.equal(fixture.api.getActiveVoiceCount(), 2);

  for (const [level, expectedThemeId] of LEVEL_THEME_EXPECTATIONS.slice(1)) {
    const voicesBeforeSwitch = fixture.voiceStarts.length;
    const immediateStopsBeforeSwitch = fixture.voiceStopCalls.filter(call => call.when === undefined).length;
    fixture.api.setMusicForLevel(level);
    const state = fixture.api.getState();
    assert.equal(state.musicMode, expectedThemeId);
    assert.equal(state.musicStep, 1);
    assert.equal(fixture.voiceStarts[voicesBeforeSwitch].frequency, fixture.api.themes[expectedThemeId].notes[0]);
    assert.equal(fixture.voiceStarts.length, voicesBeforeSwitch + 2);
    assert.ok(
      fixture.voiceStopCalls.filter(call => call.when === undefined).length > immediateStopsBeforeSwitch,
      `previous voices were not stopped before ${expectedThemeId}`
    );
    assert.equal(fixture.api.getActiveVoiceCount(), 2);
  }

  assert.equal(fixture.clearedTimers.length, LEVEL_THEME_EXPECTATIONS.length - 1);
}

function assertEngineAndScopeRemainStable() {
  const audioSource = read("js/audio.js");
  assert.match(audioSource, /window\.AudioContext \|\| window\.webkitAudioContext/);
  assert.match(audioSource, /const noteIndex = musicStep % theme\.notes\.length/);
  assert.match(audioSource, /if \(musicStep % 4 === 0\)/);
  assert.match(audioSource, /stopActiveMusicVoices\(\);[\s\S]*?musicStep = 0;[\s\S]*?scheduleMusicStep\(\);/);
  assert.match(audioSource, /gain\.gain\.exponentialRampToValueAtTime\(0\.0001, now \+ duration\)/);
  assert.doesNotMatch(audioSource, /\.(mp3|ogg|wav|m4a|aac|flac|opus)["']/i);

  for (const relativePath of [
    "js/level-generator.js",
    "js/physics.js",
    "js/game.js",
    "js/slime-achievements.js",
    "android-update.json"
  ]) {
    assert.equal(read(relativePath).replace(/\r\n/g, "\n"), readHead(relativePath).replace(/\r\n/g, "\n"));
  }
}

assertCatalogAndExistingThemes();
assertTechnicalTrackQuality();
assertLoopPlaybackAndEnvelopes();
assertLevelThemeMapping();
assertBiomeSwitching();
assertEngineAndScopeRemainStable();
console.log("Biome music expansion tests passed.");
