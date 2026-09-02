"use strict";

  const LIFECYCLE_GAIN_RAMP_SECONDS = 0.025;
  let masterGain = null;
  let lifecycleMuted = globalThis.document?.visibilityState === "hidden";

  function getMasterGain(a) {
    if (!a) return null;

    if (!masterGain) {
      masterGain = a.createGain();
      masterGain.gain.value = lifecycleMuted ? 0 : 1;
      masterGain.connect(a.destination);
    }

    return masterGain;
  }

  function getAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx) getMasterGain(audioCtx);
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function setLifecycleMuted(muted) {
    const nextMuted = Boolean(muted);
    if (lifecycleMuted === nextMuted) return;
    lifecycleMuted = nextMuted;

    if (!audioCtx || !masterGain) return;

    const now = audioCtx.currentTime;
    const gain = masterGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(
      lifecycleMuted ? 0 : 1,
      now + LIFECYCLE_GAIN_RAMP_SECONDS
    );
  }

  globalThis.document?.addEventListener?.("visibilitychange", () => {
    setLifecycleMuted(globalThis.document.visibilityState === "hidden");
  });

  const SFX_VOLUME_MULTIPLIER = 1.30;
  const MUSIC_BUS_VOLUME = 0.33; // V1.9: +50 % gegenüber V1.8 (0.22 -> 0.33)
  const EXTERNAL_BIOME_MUSIC_GAIN = 0.10;
  const STORY_MUSIC_GAIN = 0.10;
  const STORY_MUSIC_FADE_IN_SECONDS = 0.30;
  const STORY_MUSIC_FADE_OUT_SECONDS = 0.40;
  const MAIN_MENU_MUSIC_PATH = "assets/music/menu/main_menu.mp3";
  const STORY_MUSIC_PATHS = Object.freeze({
    intro: "assets/music/story/story_intro.mp3",
    middle: "assets/music/story/story_middle.mp3",
    ending: "assets/music/story/story_ending.mp3"
  });

  const menuExternalMusicTrack = {
    path: MAIN_MENU_MUSIC_PATH,
    audio: null,
    source: null,
    failed: false
  };
  const externalBiomeMusicTracks = new Map();
  const storyMusicTracks = new Map(Object.entries(STORY_MUSIC_PATHS).map(
    ([sequenceName, path]) => [sequenceName, {path, audio: null, source: null, failed: false}]
  ));
  let externalBiomeMusicGainNode = null;
  let storyMusicGainNode = null;
  let activeStoryMusicSequence = null;
  let storyMusicPlaybackStarted = false;
  let storyMusicStopping = false;
  let storyMusicStopTimer = null;
  let storyMusicGeneration = 0;

  function tone(freq, duration = 0.08, type = "sine", volume = 0.05, endFreq = null) {
    if (sfxMuted) return;
    const a = getAudio();
    if (!a) return;
    const master = getMasterGain(a);
    if (!master) return;
    const now = a.currentTime;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(Math.min(1, volume * SFX_VOLUME_MULTIPLIER), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration);
  }

  // Leise, komplett lokal erzeugte Hintergrundmusik ohne externe Audiodateien.
  // Die Schlüssel entsprechen direkt den zentralen Biom-IDs aus biomes.js.
  const MUSIC_THEMES = {
    menu: {
      notes: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.00, 698.46, 493.88, 587.33, 739.99, 587.33, 440.00, 554.37, 659.25, 554.37],
      bass: [130.81, 146.83, 123.47, 110.00],
      stepMs: 430, noteDuration: 0.52, noteVolume: 0.050, noteType: "sine",
      bassDuration: 1.35, bassVolume: 0.038, filterFrequency: 1650
    },
    meadow: {
      notes: [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 587.33, 698.46, 880.00, 1174.66, 880.00, 698.46, 493.88, 659.25, 739.99, 987.77],
      bass: [130.81, 146.83, 164.81, 123.47],
      stepMs: 285, noteDuration: 0.34, noteVolume: 0.045, noteType: "triangle",
      bassDuration: 0.82, bassVolume: 0.034, filterFrequency: 2100
    },
    coast: {
      notes: [587.33, 739.99, 880.00, 739.99, 659.25, 783.99, 987.77, 783.99, 587.33, 659.25, 880.00, 987.77, 880.00, 739.99, 659.25, 523.25],
      bass: [146.83, 164.81, 130.81, 146.83],
      stepMs: 345, noteDuration: 0.43, noteVolume: 0.044, noteType: "sine",
      bassDuration: 1.05, bassVolume: 0.033, filterFrequency: 2250
    },
    desert: {
      notes: [587.33, 659.25, 739.99, 880.00, 783.99, 739.99, 659.25, 587.33, 659.25, 783.99, 987.77, 880.00, 739.99, 659.25, 783.99, 587.33],
      bass: [146.83, 123.47, 98.00, 110.00],
      stepMs: 330, noteDuration: 0.31, noteVolume: 0.043, noteType: "triangle",
      bassDuration: 0.76, bassVolume: 0.035, filterFrequency: 1750
    },
    volcano: {
      notes: [392.00, 466.16, 523.25, 466.16, 369.99, 392.00, 554.37, 523.25, 311.13, 392.00, 466.16, 587.33, 523.25, 466.16, 392.00, 369.99],
      bass: [98.00, 116.54, 92.50, 103.83],
      stepMs: 255, noteDuration: 0.32, noteVolume: 0.039, noteType: "sawtooth",
      bassDuration: 0.74, bassVolume: 0.036, filterFrequency: 1300
    },
    snow: {
      notes: [783.99, 987.77, 1174.66, 987.77, 880.00, 1046.50, 1318.51, 1046.50, 739.99, 880.00, 1174.66, 1396.91, 1174.66, 987.77, 880.00, 783.99],
      bass: [146.83, 174.61, 130.81, 164.81],
      stepMs: 390, noteDuration: 0.56, noteVolume: 0.039, noteType: "sine",
      bassDuration: 1.18, bassVolume: 0.030, filterFrequency: 2900
    },
    swamp: {
      notes: [466.16, 554.37, 523.25, 622.25, 554.37, 466.16, 415.30, 523.25, 466.16, 587.33, 554.37, 659.25, 622.25, 523.25, 466.16, 415.30],
      bass: [116.54, 130.81, 103.83, 123.47],
      stepMs: 365, noteDuration: 0.46, noteVolume: 0.043, noteType: "triangle",
      bassDuration: 1.12, bassVolume: 0.036, filterFrequency: 1150
    },
    crystalCave: {
      notes: [659.25, 830.61, 987.77, 1244.51, 987.77, 830.61, 739.99, 987.77, 698.46, 880.00, 1108.73, 1318.51, 1108.73, 880.00, 830.61, 659.25],
      bass: [130.81, 164.81, 138.59, 174.61],
      stepMs: 325, noteDuration: 0.50, noteVolume: 0.040, noteType: "sine",
      bassDuration: 1.00, bassVolume: 0.031, filterFrequency: 3200
    },
    night: {
      notes: [523.25, 659.25, 783.99, 659.25, 493.88, 587.33, 739.99, 587.33, 440.00, 554.37, 698.46, 830.61, 698.46, 587.33, 554.37, 493.88],
      bass: [110.00, 123.47, 98.00, 130.81],
      stepMs: 440, noteDuration: 0.62, noteVolume: 0.041, noteType: "sine",
      bassDuration: 1.32, bassVolume: 0.031, filterFrequency: 1800
    },
    autumn: {
      notes: [659.25, 783.99, 880.00, 783.99, 587.33, 739.99, 830.61, 739.99, 523.25, 659.25, 783.99, 987.77, 880.00, 783.99, 659.25, 587.33],
      bass: [130.81, 146.83, 110.00, 123.47],
      stepMs: 370, noteDuration: 0.48, noteVolume: 0.043, noteType: "triangle",
      bassDuration: 1.08, bassVolume: 0.034, filterFrequency: 1750
    },
    sky: {
      notes: [698.46, 880.00, 1046.50, 1396.91, 1174.66, 1046.50, 880.00, 783.99, 880.00, 1046.50, 1318.51, 1567.98, 1396.91, 1174.66, 1046.50, 880.00],
      bass: [174.61, 196.00, 146.83, 164.81],
      stepMs: 315, noteDuration: 0.47, noteVolume: 0.040, noteType: "triangle",
      bassDuration: 0.96, bassVolume: 0.030, filterFrequency: 2700
    },
    stormNight: {
      notes: [493.88, 587.33, 659.25, 739.99, 659.25, 587.33, 523.25, 493.88, 440.00, 523.25, 659.25, 783.99, 739.99, 659.25, 587.33, 493.88],
      bass: [82.41, 98.00, 110.00, 123.47],
      stepMs: 410, noteDuration: 0.55, noteVolume: 0.038, noteType: "sine",
      bassDuration: 1.28, bassVolume: 0.031, filterFrequency: 1500
    },
    neonCity: {
      notes: [659.25, 880.00, 987.77, 1318.51, 1174.66, 987.77, 830.61, 987.77, 739.99, 932.33, 1108.73, 1396.91, 1108.73, 932.33, 830.61, 739.99],
      bass: [110.00, 138.59, 123.47, 146.83],
      stepMs: 275, noteDuration: 0.24, noteVolume: 0.030, noteType: "square",
      bassDuration: 0.84, bassVolume: 0.030, filterFrequency: 1900
    },
    mushroomCave: {
      notes: [622.25, 783.99, 932.33, 1046.50, 830.61, 698.46, 783.99, 622.25, 698.46, 880.00, 1046.50, 1244.51, 1046.50, 880.00, 698.46, 622.25],
      bass: [103.83, 130.81, 116.54, 138.59],
      stepMs: 385, noteDuration: 0.58, noteVolume: 0.038, noteType: "sine",
      bassDuration: 1.18, bassVolume: 0.030, filterFrequency: 3000
    },
    abandonedMine: {
      notes: [392.00, 466.16, 523.25, 587.33, 523.25, 466.16, 392.00, 349.23, 440.00, 523.25, 587.33, 698.46, 587.33, 523.25, 440.00, 392.00],
      bass: [98.00, 116.54, 130.81, 110.00],
      stepMs: 350, noteDuration: 0.28, noteVolume: 0.039, noteType: "triangle",
      bassDuration: 0.90, bassVolume: 0.034, filterFrequency: 1100
    },
    bambooNight: {
      notes: [587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33, 493.88, 523.25, 659.25, 739.99, 880.00, 739.99, 659.25, 523.25, 493.88],
      bass: [146.83, 123.47, 164.81, 138.59],
      stepMs: 420, noteDuration: 0.56, noteVolume: 0.037, noteType: "sine",
      bassDuration: 1.25, bassVolume: 0.029, filterFrequency: 2300
    },
    pirateHarbor: {
      notes: [392.00, 523.25, 587.33, 659.25, 587.33, 523.25, 440.00, 523.25, 392.00, 493.88, 587.33, 698.46, 659.25, 587.33, 493.88, 392.00],
      bass: [98.00, 130.81, 110.00, 123.47],
      stepMs: 360, noteDuration: 0.40, noteVolume: 0.041, noteType: "triangle",
      bassDuration: 0.98, bassVolume: 0.033, filterFrequency: 1700
    },
    alienJungle: {
      notes: [554.37, 698.46, 830.61, 739.99, 622.25, 783.99, 932.33, 659.25, 587.33, 739.99, 880.00, 698.46, 523.25, 659.25, 783.99, 554.37],
      bass: [92.50, 116.54, 103.83, 138.59],
      stepMs: 310, noteDuration: 0.30, noteVolume: 0.032, noteType: "sawtooth",
      bassDuration: 0.86, bassVolume: 0.031, filterFrequency: 1450
    },
    enchantedGarden: {
      notes: [659.25, 783.99, 987.77, 1174.66, 1046.50, 880.00, 783.99, 698.46, 739.99, 880.00, 1046.50, 1318.51, 1174.66, 987.77, 880.00, 659.25],
      bass: [130.81, 155.56, 174.61, 146.83],
      stepMs: 430, noteDuration: 0.60, noteVolume: 0.038, noteType: "sine",
      bassDuration: 1.30, bassVolume: 0.029, filterFrequency: 2850
    },
    redMoon: {
      notes: [415.30, 493.88, 587.33, 622.25, 554.37, 466.16, 415.30, 369.99, 440.00, 523.25, 622.25, 739.99, 698.46, 622.25, 523.25, 440.00],
      bass: [110.00, 130.81, 103.83, 123.47],
      stepMs: 405, noteDuration: 0.50, noteVolume: 0.037, noteType: "triangle",
      bassDuration: 1.20, bassVolume: 0.031, filterFrequency: 1300
    },
    undergroundTemple: {
      notes: [587.33, 698.46, 783.99, 880.00, 783.99, 698.46, 622.25, 587.33, 523.25, 622.25, 739.99, 830.61, 783.99, 698.46, 622.25, 523.25],
      bass: [98.00, 116.54, 130.81, 103.83],
      stepMs: 375, noteDuration: 0.48, noteVolume: 0.038, noteType: "sine",
      bassDuration: 1.05, bassVolume: 0.032, filterFrequency: 1250
    }
  };

  const activeMusicVoices = new Set();

  function getMusicBus() {
    const a = getAudio();
    if (!a) return null;
    const master = getMasterGain(a);
    if (!master) return null;

    if (!musicBus) {
      musicBus = a.createGain();
      musicBus.gain.value = musicMuted ? 0 : MUSIC_BUS_VOLUME;
      musicBus.connect(master);
    }

    return musicBus;
  }

  function playMusicTone(freq, duration, volume, type = "triangle", filterFrequency = 2100) {
    if (musicMuted || !freq) return;

    const a = getAudio();
    const bus = getMusicBus();
    if (!a || !bus) return;

    const now = a.currentTime;
    const osc = a.createOscillator();
    const filter = a.createBiquadFilter();
    const gain = a.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, now);
    filter.Q.setValueAtTime(0.7, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    activeMusicVoices.add(osc);
    osc.onended = () => activeMusicVoices.delete(osc);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function stopActiveMusicVoices() {
    for (const osc of activeMusicVoices) {
      try { osc.stop(); } catch (error) { /* Stimme ist bereits beendet. */ }
    }
    activeMusicVoices.clear();
  }

  function getExternalBiomeMusicTrack(biomeId) {
    let track = externalBiomeMusicTracks.get(biomeId);
    if (!track) {
      track = {
        path: `assets/music/biomes/${biomeId}.mp3`,
        audio: null,
        source: null,
        failed: false
      };
      externalBiomeMusicTracks.set(biomeId, track);
    }
    return track;
  }

  function getExternalMusicTrack(mode) {
    return mode === "menu"
      ? menuExternalMusicTrack
      : getExternalBiomeMusicTrack(mode);
  }

  function stopExternalMusic(mode) {
    const track = getExternalMusicTrack(mode);
    if (!track?.audio) return;
    track.audio.pause();
    try { track.audio.currentTime = 0; } catch (error) { /* Noch nicht abspielbereit. */ }
  }

  function markExternalMusicFailed(mode) {
    const track = getExternalMusicTrack(mode);
    if (!track || track.failed) return;
    track.failed = true;
    stopExternalMusic(mode);

    if (musicStarted && musicMode === mode && !musicTimer) {
      scheduleMusicStep();
    }
  }

  function getExternalMusic(mode) {
    const track = getExternalMusicTrack(mode);
    if (!track || track.failed) return null;
    if (track.audio) return track.audio;

    try {
      if (typeof window.Audio !== "function") throw new Error("Audio element unavailable");

      track.audio = new window.Audio();
      track.audio.loop = true;
      track.audio.preload = "none";
      track.audio.addEventListener("error", () => markExternalMusicFailed(mode), {once: true});

      const a = getAudio();
      const bus = getMusicBus();
      if (!a || !bus || typeof a.createMediaElementSource !== "function") {
        throw new Error("Media element audio source unavailable");
      }

      if (!externalBiomeMusicGainNode) {
        externalBiomeMusicGainNode = a.createGain();
        externalBiomeMusicGainNode.gain.value = EXTERNAL_BIOME_MUSIC_GAIN;
        externalBiomeMusicGainNode.connect(bus);
      }

      track.source = a.createMediaElementSource(track.audio);
      track.source.connect(externalBiomeMusicGainNode);
      track.audio.src = track.path;
      return track.audio;
    } catch (error) {
      markExternalMusicFailed(mode);
      return null;
    }
  }

  function playExternalMusic(mode) {
    const audio = getExternalMusic(mode);
    if (!audio) return false;

    try {
      const playAttempt = audio.play();
      playAttempt?.catch?.(() => {
        if (musicStarted && musicMode === mode) markExternalMusicFailed(mode);
      });
      return true;
    } catch (error) {
      markExternalMusicFailed(mode);
      return false;
    }
  }

  function stopTrackAudio(track) {
    if (!track?.audio) return;
    track.audio.pause();
    try { track.audio.currentTime = 0; } catch (error) { /* Noch nicht abspielbereit. */ }
  }

  function stopAllNormalExternalMusic() {
    stopTrackAudio(menuExternalMusicTrack);
    for (const track of externalBiomeMusicTracks.values()) stopTrackAudio(track);
  }

  function stopAllStoryTrackAudio() {
    for (const track of storyMusicTracks.values()) stopTrackAudio(track);
    storyMusicPlaybackStarted = false;
  }

  function markStoryMusicFailed(sequenceName) {
    const track = storyMusicTracks.get(sequenceName);
    if (!track || track.failed) return;
    track.failed = true;
    stopTrackAudio(track);
    if (activeStoryMusicSequence === sequenceName) storyMusicPlaybackStarted = false;
  }

  function getStoryMusic(sequenceName) {
    const track = storyMusicTracks.get(sequenceName);
    if (!track || track.failed) return null;
    if (track.audio) return track.audio;

    try {
      if (typeof window.Audio !== "function") throw new Error("Audio element unavailable");

      track.audio = new window.Audio();
      track.audio.loop = false;
      track.audio.preload = "none";
      track.audio.addEventListener("error", () => markStoryMusicFailed(sequenceName), {once: true});
      track.audio.addEventListener("ended", () => {
        if (activeStoryMusicSequence === sequenceName) storyMusicPlaybackStarted = false;
      });

      const a = getAudio();
      const bus = getMusicBus();
      if (!a || !bus || typeof a.createMediaElementSource !== "function") {
        throw new Error("Media element audio source unavailable");
      }

      if (!storyMusicGainNode) {
        storyMusicGainNode = a.createGain();
        storyMusicGainNode.gain.value = 0;
        storyMusicGainNode.connect(bus);
      }

      track.source = a.createMediaElementSource(track.audio);
      track.source.connect(storyMusicGainNode);
      track.audio.src = track.path;
      return track.audio;
    } catch (error) {
      markStoryMusicFailed(sequenceName);
      return null;
    }
  }

  function playStoryMusic(sequenceName) {
    const audio = getStoryMusic(sequenceName);
    if (!audio || !storyMusicGainNode) return false;

    try {
      const now = audioCtx.currentTime;
      const gain = storyMusicGainNode.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0, now);
      gain.linearRampToValueAtTime(
        STORY_MUSIC_GAIN,
        now + STORY_MUSIC_FADE_IN_SECONDS
      );
      try { audio.currentTime = 0; } catch (error) { /* Noch nicht abspielbereit. */ }
      const playAttempt = audio.play();
      storyMusicPlaybackStarted = true;
      playAttempt?.catch?.(() => {
        if (activeStoryMusicSequence !== sequenceName) return;
        stopTrackAudio(storyMusicTracks.get(sequenceName));
        storyMusicPlaybackStarted = false;
      });
      return true;
    } catch (error) {
      stopTrackAudio(storyMusicTracks.get(sequenceName));
      storyMusicPlaybackStarted = false;
      return false;
    }
  }

  function startStoryMusic(sequenceName) {
    if (!storyMusicTracks.has(sequenceName)) return false;

    storyMusicGeneration++;
    if (storyMusicStopTimer !== null) window.clearTimeout(storyMusicStopTimer);
    storyMusicStopTimer = null;
    storyMusicStopping = false;
    stopAllStoryTrackAudio();

    if (musicTimer) window.clearTimeout(musicTimer);
    musicTimer = null;
    stopActiveMusicVoices();
    stopAllNormalExternalMusic();

    activeStoryMusicSequence = sequenceName;
    if (musicMuted) return true;

    const a = getAudio();
    if (!a || !getMusicBus()) return true;
    musicStarted = true;
    return playStoryMusic(sequenceName);
  }

  function finishStoryMusicStop(sequenceName, generation) {
    if (
      generation !== storyMusicGeneration ||
      activeStoryMusicSequence !== sequenceName
    ) return;

    stopTrackAudio(storyMusicTracks.get(sequenceName));
    if (storyMusicGainNode) storyMusicGainNode.gain.value = 0;
    activeStoryMusicSequence = null;
    storyMusicPlaybackStarted = false;
    storyMusicStopping = false;
    storyMusicStopTimer = null;
    if (musicStarted) startCurrentMusicSource();
  }

  function stopStoryMusic(sequenceName = activeStoryMusicSequence) {
    if (!sequenceName || activeStoryMusicSequence !== sequenceName) return false;
    if (storyMusicStopping) return true;

    const generation = storyMusicGeneration;
    const track = storyMusicTracks.get(sequenceName);
    if (!storyMusicPlaybackStarted || !track?.audio || !storyMusicGainNode || !audioCtx) {
      finishStoryMusicStop(sequenceName, generation);
      return true;
    }

    storyMusicStopping = true;
    const now = audioCtx.currentTime;
    const gain = storyMusicGainNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + STORY_MUSIC_FADE_OUT_SECONDS);
    storyMusicStopTimer = window.setTimeout(
      () => finishStoryMusicStop(sequenceName, generation),
      STORY_MUSIC_FADE_OUT_SECONDS * 1000
    );
    return true;
  }

  function startCurrentMusicSource() {
    if (activeStoryMusicSequence) return;
    const track = getExternalMusicTrack(musicMode);
    if (track && !track.failed) {
      if (playExternalMusic(musicMode) || musicTimer) return;
    }
    scheduleMusicStep();
  }

  function scheduleMusicStep() {
    if (!musicStarted || activeStoryMusicSequence) return;
    const externalTrack = getExternalMusicTrack(musicMode);
    if (externalTrack && !externalTrack.failed) return;

    const theme = MUSIC_THEMES[musicMode] || MUSIC_THEMES.menu;
    const noteIndex = musicStep % theme.notes.length;

    playMusicTone(
      theme.notes[noteIndex],
      theme.noteDuration,
      theme.noteVolume,
      theme.noteType,
      theme.filterFrequency
    );

    // Ein sehr leiser Grundton alle vier Schritte gibt der Melodie etwas Tiefe.
    if (musicStep % 4 === 0) {
      const bassIndex = Math.floor(musicStep / 4) % theme.bass.length;
      playMusicTone(
        theme.bass[bassIndex],
        theme.bassDuration,
        theme.bassVolume,
        "sine",
        theme.filterFrequency
      );
    }

    musicStep++;
    musicTimer = window.setTimeout(scheduleMusicStep, theme.stepMs);
  }

  function startBackgroundMusic(mode = musicMode) {
    setMusicMode(mode);
    const a = getAudio();
    if (!a) return;
    getMusicBus();

    if (activeStoryMusicSequence) {
      if (!musicStarted) {
        musicStarted = true;
        musicStep = 0;
      }
      if (!musicMuted && !storyMusicPlaybackStarted && !storyMusicStopping) {
        playStoryMusic(activeStoryMusicSequence);
      }
      return;
    }
    if (musicStarted) return;
    musicStarted = true;
    musicStep = 0;
    startCurrentMusicSource();
  }

  function setMusicMode(mode) {
    if (!MUSIC_THEMES[mode]) return;
    const previousMode = musicMode;
    const changed = musicMode !== mode;
    musicMode = mode;

    if (changed && musicStarted) {
      if (musicTimer) window.clearTimeout(musicTimer);
      musicTimer = null;
      stopActiveMusicVoices();
      stopExternalMusic(previousMode);
      musicStep = 0;
      startCurrentMusicSource();
    }
  }

  function setMusicForLevel(levelNumber) {
    setMusicMode(getBiomeForLevel(levelNumber).id);
  }

  function updateMusicMute() {
    const a = getAudio();
    const bus = getMusicBus();
    if (!a || !bus) return;

    const now = a.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(musicMuted ? 0 : MUSIC_BUS_VOLUME, now, 0.035);
  }

  function updateAudioButtons() {
    ui.musicBtn.classList.toggle("muted", musicMuted);
    ui.musicBtn.classList.toggle("active", !musicMuted);
    ui.musicBtn.textContent = musicMuted ? "♫×" : "♫";
    ui.musicBtn.setAttribute("aria-label", musicMuted ? "Musik einschalten" : "Musik ausschalten");
    ui.musicBtn.title = musicMuted ? "Musik aus" : "Musik an";
    ui.pauseMusicBtn.classList.toggle("muted", musicMuted);
    ui.pauseMusicBtn.classList.toggle("active", !musicMuted);
    ui.pauseMusicBtn.textContent = musicMuted ? "♫×" : "♫";
    ui.pauseMusicBtn.setAttribute("aria-label", musicMuted ? "Musik einschalten" : "Musik ausschalten");
    ui.pauseMusicBtn.setAttribute("aria-pressed", String(!musicMuted));

    ui.sfxBtn.classList.toggle("muted", sfxMuted);
    ui.sfxBtn.classList.toggle("active", !sfxMuted);
    ui.sfxBtn.textContent = sfxMuted ? "FX×" : "FX";
    ui.sfxBtn.setAttribute("aria-label", sfxMuted ? "Soundeffekte einschalten" : "Soundeffekte ausschalten");
    ui.sfxBtn.title = sfxMuted ? "Soundeffekte aus" : "Soundeffekte an";
    ui.pauseSfxBtn.classList.toggle("muted", sfxMuted);
    ui.pauseSfxBtn.classList.toggle("active", !sfxMuted);
    ui.pauseSfxBtn.textContent = sfxMuted ? "FX×" : "FX";
    ui.pauseSfxBtn.setAttribute("aria-label", sfxMuted ? "Soundeffekte einschalten" : "Soundeffekte ausschalten");
    ui.pauseSfxBtn.setAttribute("aria-pressed", String(!sfxMuted));
  }

  window.SlimeStoryAudio = Object.freeze({
    start: startStoryMusic,
    stop: stopStoryMusic,
    isActive: () => activeStoryMusicSequence !== null
  });

  function playLaunch() { tone(240, 0.12, "triangle", 0.0924, 520); }
  function playBounce() { tone(150, 0.07, "sine", 0.035, 105); }
  function playStar() {
    tone(660, 0.08, "sine", 0.05, 920);
    setTimeout(() => tone(990, 0.1, "sine", 0.04, 1220), 70);
  }
  function playHurt() { tone(180, 0.28, "sawtooth", 0.06, 55); }
  function playWin() {
    tone(523, 0.12, "triangle", 0.06, 660);
    setTimeout(() => tone(659, 0.12, "triangle", 0.06, 784), 120);
    setTimeout(() => tone(784, 0.2, "triangle", 0.07, 1046), 240);
  }

