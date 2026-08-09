"use strict";

  // Slime Jump 2.10 – neues How-to-Menü mit eingebauten Artwork-Screens, getrennten Musik-/FX-Mute-Buttons und Online-Top-10-Highscores via Supabase.

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const DEV_MODE =
  location.hostname !== "slimejumpgame.github.io" &&
  (
    location.protocol === "file:" ||
    (
      location.protocol === "http:" &&
      (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
      )
    )
  );

  const ui = {
    level: document.getElementById("levelLabel"),
    lives: document.getElementById("livesLabel"),
    stars: document.getElementById("starsLabel"),
    shots: document.getElementById("shotsLabel"),
    score: document.getElementById("scoreLabel"),
    gameToast: document.getElementById("gameToast"),
    menu: document.getElementById("menuOverlay"),
    mainMenuScreen: document.getElementById("mainMenuScreen"),
    wardrobeScreen: document.getElementById("wardrobeScreen"),
    howToScreen: document.getElementById("howToScreen"),
    highscoreScreen: document.getElementById("highscoreScreen"),
    highscoreRows: document.getElementById("highscoreRows"),
    message: document.getElementById("messageOverlay"),
    messageTitle: document.getElementById("messageTitle"),
    messageText: document.getElementById("messageText"),
    nicknameEntry: document.getElementById("nicknameEntry"),
    nicknameInput: document.getElementById("nicknameInput"),
    nicknameHint: document.getElementById("nicknameHint"),
    continueBtn: document.getElementById("continueBtn"),
    startBtn: document.getElementById("startBtn"),
    wardrobeBtn: document.getElementById("wardrobeBtn"),
    howToBtn: document.getElementById("howToBtn"),
    highScoresBtn: document.getElementById("highScoresBtn"),
    wardrobeBackBtn: document.getElementById("wardrobeBackBtn"),
    wardrobeHome: document.getElementById("wardrobeHome"),
    wardrobeColorView: document.getElementById("wardrobeColorView"),
    wardrobeCosmeticsView: document.getElementById("wardrobeCosmeticsView"),
    wardrobeBeardsView: document.getElementById("wardrobeBeardsView"),
    wardrobeColorMenuBtn: document.getElementById("wardrobeColorMenuBtn"),
    wardrobeCosmeticsMenuBtn: document.getElementById("wardrobeCosmeticsMenuBtn"),
    wardrobeBeardsMenuBtn: document.getElementById("wardrobeBeardsMenuBtn"),
    wardrobeColorBackBtn: document.getElementById("wardrobeColorBackBtn"),
    wardrobeCosmeticsBackBtn: document.getElementById("wardrobeCosmeticsBackBtn"),
    wardrobeBeardsBackBtn: document.getElementById("wardrobeBeardsBackBtn"),
    howToTopPanel: document.getElementById("howToTopPanel"),
    howToBackBtn: document.getElementById("howToBackBtn"),
    howToMechanicsPanel: document.getElementById("howToMechanicsPanel"),
    highScoresBackBtn: document.getElementById("highScoresBackBtn"),
    menuMascot: document.getElementById("menuMascot"),
    slimeColorOptions: document.getElementById("slimeColorOptions"),
    slimeColorRequirement: document.getElementById("slimeColorRequirement"),
    slimeCosmeticOptions: document.getElementById("slimeCosmeticOptions"),
    slimeBeardOptions: document.getElementById("slimeBeardOptions"),
    wardrobeUnlockPanel: document.getElementById("wardrobeUnlockPanel"),
    wardrobeUnlockText: document.getElementById("wardrobeUnlockText"),
    wardrobeUnlockCategories: document.getElementById("wardrobeUnlockCategories"),
    wardrobeUnlockOptions: document.getElementById("wardrobeUnlockOptions"),
    wardrobeUnlockBackBtn: document.getElementById("wardrobeUnlockBackBtn"),
    restartBtn: document.getElementById("restartBtn"),
    messageRestartBtn: document.getElementById("messageRestartBtn"),
    musicBtn: document.getElementById("musicBtn"),
    sfxBtn: document.getElementById("sfxBtn"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    devPanel: document.getElementById("devPanel"),
    devPreviousLevelBtn: document.getElementById("devPreviousLevelBtn"),
    devLevelInput: document.getElementById("devLevelInput"),
    devStartLevelBtn: document.getElementById("devStartLevelBtn"),
    devNextLevelBtn: document.getElementById("devNextLevelBtn")
  };

  let generatedLevel = null;
  let pendingGameOverScore = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function random() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function randomRange(random, min, max) {
    return min + (max - min) * random();
  }

  function randomInt(random, min, max) {
    return Math.floor(randomRange(random, min, max + 1));
  }

  function chooseRandom(random, values) {
    return values[Math.floor(random() * values.length)];
  }

  function rectanglesOverlap(a, b, padding = 0) {
    return (
      a.x < b.x + b.w + padding &&
      a.x + a.w + padding > b.x &&
      a.y < b.y + b.h + padding &&
      a.y + a.h + padding > b.y
    );
  }

  let state = "menu";
  let levelIndex = 0;
  let lives = 3;
  let perfectLevelStreak = 0;
  let levelHadDeath = false;
  let score = 0;
  let shots = 0;
  let collected = [];
  let runStarsCollected = 0;
  let wardrobeUnlockEarnedThisRun = false;
  let pendingWardrobeUnlock = false;
  let wardrobeUnlockCategory = null;
  let aiming = false;
  let pointer = {x: 0, y: 0};
  let drag = {x: 0, y: 0};
  let lastTime = performance.now();
  let worldTime = 0;
  let sfxMuted = false;
  let musicMuted = false;
  let audioCtx = null;
  let musicBus = null;
  let musicTimer = null;
  let musicMode = "menu";
  let musicStep = 0;
  let musicStarted = false;
  let nextAction = "next";
  let shake = 0;
  let particles = [];
  function currentLevel() { return generatedLevel; }

