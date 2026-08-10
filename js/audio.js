"use strict";

  function getAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  const SFX_VOLUME_MULTIPLIER = 1.30;
  const MUSIC_BUS_VOLUME = 0.33; // V1.9: +50 % gegenüber V1.8 (0.22 -> 0.33)

  function tone(freq, duration = 0.08, type = "sine", volume = 0.05, endFreq = null) {
    if (sfxMuted) return;
    const a = getAudio();
    if (!a) return;
    const now = a.currentTime;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(Math.min(1, volume * SFX_VOLUME_MULTIPLIER), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(a.destination);
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
    }
  };

  const activeMusicVoices = new Set();

  function getMusicBus() {
    const a = getAudio();
    if (!a) return null;

    if (!musicBus) {
      musicBus = a.createGain();
      musicBus.gain.value = musicMuted ? 0 : MUSIC_BUS_VOLUME;
      musicBus.connect(a.destination);
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

  function scheduleMusicStep() {
    if (!musicStarted) return;

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

    if (musicStarted) return;
    musicStarted = true;
    musicStep = 0;
    scheduleMusicStep();
  }

  function setMusicMode(mode) {
    if (!MUSIC_THEMES[mode]) return;
    const changed = musicMode !== mode;
    musicMode = mode;

    if (changed && musicStarted) {
      if (musicTimer) window.clearTimeout(musicTimer);
      musicTimer = null;
      stopActiveMusicVoices();
      musicStep = 0;
      scheduleMusicStep();
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

  function playLaunch() { tone(240, 0.12, "triangle", 0.084, 520); }
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

