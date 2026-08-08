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

  // Leise, komplett lokal erzeugte Hintergrundmusik. Dadurch bleibt das Spiel
  // eine einzelne HTML-Datei ohne externe MP3-/OGG-Abhängigkeiten.
  const menuMusicNotes = [
    523.25, 659.25, 783.99, 659.25,
    587.33, 698.46, 880.00, 698.46,
    493.88, 587.33, 739.99, 587.33,
    440.00, 554.37, 659.25, 554.37
  ];

  const menuBassNotes = [130.81, 146.83, 123.47, 110.00];

  const gameMusicNotes = [
    523.25, 659.25, 783.99, 1046.50,
    783.99, 659.25, 587.33, 698.46,
    880.00, 1174.66, 880.00, 698.46,
    493.88, 659.25, 739.99, 987.77
  ];

  const gameBassNotes = [130.81, 146.83, 164.81, 123.47];

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

  function playMusicTone(freq, duration, volume, type = "triangle") {
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
    filter.frequency.setValueAtTime(musicMode === "menu" ? 1650 : 2100, now);
    filter.Q.setValueAtTime(0.7, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function scheduleMusicStep() {
    if (!musicStarted) return;

    const isMenu = musicMode === "menu";
    const notes = isMenu ? menuMusicNotes : gameMusicNotes;
    const bassNotes = isMenu ? menuBassNotes : gameBassNotes;
    const stepMs = isMenu ? 430 : 285;
    const noteIndex = musicStep % notes.length;

    playMusicTone(
      notes[noteIndex],
      isMenu ? 0.52 : 0.34,
      isMenu ? 0.050 : 0.045,
      isMenu ? "sine" : "triangle"
    );

    // Ein sehr leiser Grundton alle vier Schritte gibt der Melodie etwas Tiefe.
    if (musicStep % 4 === 0) {
      const bassIndex = Math.floor(musicStep / 4) % bassNotes.length;
      playMusicTone(
        bassNotes[bassIndex],
        isMenu ? 1.35 : 0.82,
        isMenu ? 0.038 : 0.034,
        "sine"
      );
    }

    musicStep++;
    musicTimer = window.setTimeout(scheduleMusicStep, stepMs);
  }

  function startBackgroundMusic(mode = musicMode) {
    musicMode = mode;
    const a = getAudio();
    if (!a) return;
    getMusicBus();

    if (musicStarted) return;
    musicStarted = true;
    musicStep = 0;
    scheduleMusicStep();
  }

  function setMusicMode(mode) {
    if (mode !== "menu" && mode !== "game") return;
    const changed = musicMode !== mode;
    musicMode = mode;

    if (changed && musicStarted) {
      if (musicTimer) window.clearTimeout(musicTimer);
      musicTimer = null;
      musicStep = 0;
      scheduleMusicStep();
    }
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

    ui.sfxBtn.classList.toggle("muted", sfxMuted);
    ui.sfxBtn.classList.toggle("active", !sfxMuted);
    ui.sfxBtn.textContent = sfxMuted ? "FX×" : "FX";
    ui.sfxBtn.setAttribute("aria-label", sfxMuted ? "Soundeffekte einschalten" : "Soundeffekte ausschalten");
    ui.sfxBtn.title = sfxMuted ? "Soundeffekte aus" : "Soundeffekte an";
  }

  function playLaunch() { tone(240, 0.12, "triangle", 0.07, 520); }
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

