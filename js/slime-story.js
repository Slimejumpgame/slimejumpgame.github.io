(() => {
  "use strict";

  const STORY_STORAGE_KEY = "slimejumperStoryV1";
  const STORY_STATE_VERSION = 1;
  const INSTALLATION_ID_STORAGE_KEY = "slimejumperInstallationId";
  const DEV_STORY_TEST_SESSION_KEY = "slimejumperStoryTestMode";
  const SLIDE_TRANSITION_MS = 300;
  const TYPEWRITER_CHARACTER_MS = 28;

  const FRAGMENT_MILESTONES = Object.freeze(new Map([
    [25, 1],
    [50, 2],
    [75, 3],
    [100, 4],
    [125, 5],
    [150, 6],
    [175, 7],
    [200, 8]
  ]));

  const STORY_SEQUENCES = Object.freeze({
    intro: Object.freeze([
      Object.freeze({
        image: "assets/story/story_intro_01.png",
        text: "In einer friedlichen Welt lebten die Slimes glücklich zusammen.\nHier war das Zuhause unseres kleinen grünen Slimes."
      }),
      Object.freeze({
        image: "assets/story/story_intro_02.png",
        text: "Doch eines Tages erschien mitten im Dorf ein geheimnisvolles Portal.\nNiemand wusste, woher es gekommen war."
      }),
      Object.freeze({
        image: "assets/story/story_intro_03.png",
        text: "Aus dem Portal schwebte ein magisches Buch.\nSeine Seiten führten zu fremden und wundersamen Welten."
      }),
      Object.freeze({
        image: "assets/story/story_intro_04.png",
        text: "Plötzlich begann die Heimatseite zu leuchten.\nSie zerbrach in acht magische Fragmente."
      }),
      Object.freeze({
        image: "assets/story/story_intro_05.png",
        text: "Die Fragmente wurden in die fremden Welten gerissen.\nMit ihnen begann auch die Slime-Heimat auseinanderzubrechen."
      }),
      Object.freeze({
        image: "assets/story/story_intro_06.png",
        text: "Es gab nur einen Weg, seine Heimat zu retten.\nDer grüne Slime sprang hinterher.\nSeine Reise begann."
      })
    ]),
    middle: Object.freeze([
      Object.freeze({
        image: "assets/story/story_middle_01.png",
        text: "Die Hälfte ist geschafft.\nVier der acht Fragmente sind zurückgekehrt.\nDie Heimat beginnt zu heilen – doch sie ist noch nicht gerettet."
      }),
      Object.freeze({
        image: "assets/story/story_middle_02.png",
        text: "Am Horizont zieht bereits ein Gewitter auf.\nNoch fehlen vier Fragmente.\nDie zweite Hälfte der Reise beginnt."
      })
    ]),
    ending: Object.freeze([
      Object.freeze({
        image: "assets/story/story_ending_01.png",
        text: "Das letzte Fragment kehrt zurück.\nDie Heimatseite ist wieder vollständig.\nDas Portal nach Hause öffnet sich."
      }),
      Object.freeze({
        image: "assets/story/story_ending_02.png",
        text: "Die Slime-Welt ist gerettet.\nNach seiner langen Reise kehrt der kleine Slime endlich nach Hause zurück."
      }),
      Object.freeze({
        image: "assets/story/story_ending_03.png",
        text: "Am nächsten Morgen wacht er in seinem Bett auf.\nWar das alles vielleicht nur ein Traum?"
      }),
      Object.freeze({
        image: "assets/story/story_ending_04.png",
        text: "Doch dann entdeckt er ein leuchtendes Andenken aus einer fremden Welt.\nDie Reise war wirklich passiert."
      }),
      Object.freeze({
        image: "assets/story/story_ending_05.png",
        text: "Das Portal beginnt erneut zu leuchten.\nDiesmal gibt es keine Gefahr – nur ein neues Abenteuer.\nDer Slime springt freiwillig hinein.",
        note: "Beim nächsten Prestige beginnt die Geschichte wieder von vorn."
      })
    ])
  });

  let storyState = null;
  let devStoryTestEnabled = readDevStoryTestEnabled();
  let devModeAvailable = false;
  let bridge = Object.freeze({setPresentationActive() {}});
  let dom = null;
  let presenting = false;
  let activeStep = null;
  let typewriterRuntime = null;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createCycle(prestigeLevel) {
    const normalizedPrestige = Math.max(0, Math.min(10, Math.floor(Number(prestigeLevel) || 0)));
    return {
      prestige: normalizedPrestige,
      introHidden: false,
      fragments: [],
      sequences: {middle: "eligible", ending: "eligible"},
      pending: null
    };
  }

  function createInitialState({fresh = false, prestigeLevel = 0} = {}) {
    return {
      version: STORY_STATE_VERSION,
      status: fresh ? "active" : "deferred",
      cycle: fresh ? createCycle(prestigeLevel) : null
    };
  }

  function normalizePending(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const sequence = value.sequence === "middle" || value.sequence === "ending"
      ? value.sequence
      : null;
    if (!sequence) return null;
    const expectedFragment = sequence === "middle" ? 4 : 8;
    return {
      sequence,
      fragment: Number(value.fragment) === expectedFragment ? expectedFragment : null
    };
  }

  function normalizeCycle(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prestige = Math.max(0, Math.min(10, Math.floor(Number(value.prestige) || 0)));
    const fragments = Array.isArray(value.fragments)
      ? [...new Set(value.fragments
          .map(fragment => Math.floor(Number(fragment)))
          .filter(fragment => fragment >= 1 && fragment <= 8))]
          .sort((left, right) => left - right)
      : [];
    const pending = normalizePending(value.pending);
    const normalizeSequenceState = (candidate, sequence) => {
      if (candidate === "handled") return "handled";
      if (candidate === "showing" && pending?.sequence === sequence) return "showing";
      return "eligible";
    };
    return {
      prestige,
      introHidden: value.introHidden === true,
      fragments,
      sequences: {
        middle: normalizeSequenceState(value.sequences?.middle, "middle"),
        ending: normalizeSequenceState(value.sequences?.ending, "ending")
      },
      pending
    };
  }

  function normalizeState(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (Number(value.version) !== STORY_STATE_VERSION) return null;
    if (value.status === "deferred") {
      return {version: STORY_STATE_VERSION, status: "deferred", cycle: null};
    }
    const cycle = value.status === "active" ? normalizeCycle(value.cycle) : null;
    return cycle
      ? {version: STORY_STATE_VERSION, status: "active", cycle}
      : null;
  }

  function wasInstallationAlreadyKnown() {
    try {
      return localStorage.getItem(INSTALLATION_ID_STORAGE_KEY) !== null;
    } catch (_) {
      return true;
    }
  }

  function persistState(nextState) {
    const normalized = normalizeState(nextState);
    if (!normalized) return false;
    try {
      const serialized = JSON.stringify(normalized);
      localStorage.setItem(STORY_STORAGE_KEY, serialized);
      if (localStorage.getItem(STORY_STORAGE_KEY) !== serialized) return false;
      storyState = normalized;
      return true;
    } catch (error) {
      console.error("[Story] Story-Fortschritt konnte nicht gespeichert werden:", error);
      return false;
    }
  }

  function loadState() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORY_STORAGE_KEY);
    } catch (_) {}
    if (stored !== null) {
      try {
        const normalized = normalizeState(JSON.parse(stored));
        if (normalized) return normalized;
      } catch (_) {}
    }

    const initial = createInitialState({fresh: !wasInstallationAlreadyKnown()});
    persistState(initial);
    return storyState || initial;
  }

  function readDevStoryTestEnabled() {
    try {
      return sessionStorage.getItem(DEV_STORY_TEST_SESSION_KEY) === "on";
    } catch (_) {
      return false;
    }
  }

  function setDevStoryTestEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    try {
      sessionStorage.setItem(DEV_STORY_TEST_SESSION_KEY, nextEnabled ? "on" : "off");
    } catch (error) {
      console.warn("[Story] Story-Testmodus konnte nicht gespeichert werden:", error);
      return false;
    }
    devStoryTestEnabled = nextEnabled;
    return true;
  }

  function isActiveCycle() {
    return storyState?.status === "active" && Boolean(storyState.cycle);
  }

  function isDevStoryTestActive() {
    return devModeAvailable && devStoryTestEnabled;
  }

  function beginPrestigeCycle(prestigeLevel) {
    return persistState({
      version: STORY_STATE_VERSION,
      status: "active",
      cycle: createCycle(prestigeLevel)
    });
  }

  function shouldShowIntro() {
    return isDevStoryTestActive() || (isActiveCycle() && storyState.cycle.introHidden !== true);
  }

  function hideIntroForCycle() {
    if (isDevStoryTestActive()) return true;
    if (!isActiveCycle()) return false;
    const nextState = clone(storyState);
    nextState.cycle.introHidden = true;
    return persistState(nextState);
  }

  function cacheDom() {
    if (dom) return true;
    const overlay = document.getElementById("storyOverlay");
    if (!overlay) return false;
    dom = {
      overlay,
      sequencePanel: document.getElementById("storySequencePanel"),
      progress: document.getElementById("storyProgress"),
      image: document.getElementById("storyImage"),
      imageFallback: document.getElementById("storyImageFallback"),
      text: document.getElementById("storyText"),
      note: document.getElementById("storyEndingNote"),
      nextButton: document.getElementById("storyNextBtn"),
      skipButton: document.getElementById("storySkipBtn"),
      hideIntroButton: document.getElementById("storyHideIntroBtn"),
      fragmentPanel: document.getElementById("storyFragmentPanel"),
      fragmentCanvas: document.getElementById("storyFragmentCanvas"),
      fragmentText: document.getElementById("storyFragmentText"),
      fragmentContinueButton: document.getElementById("storyFragmentContinueBtn")
    };
    return Object.values(dom).every(Boolean);
  }

  function getTypewriterDelay(character) {
    if (/[.!?]/.test(character)) return 150;
    if (/[,;:]/.test(character)) return 80;
    if (character === "\n") return 110;
    return TYPEWRITER_CHARACTER_MS;
  }

  function cancelTypewriter() {
    if (!typewriterRuntime) return false;
    if (typewriterRuntime.timerId !== null) {
      window.clearTimeout(typewriterRuntime.timerId);
    }
    typewriterRuntime = null;
    return true;
  }

  function startTypewriter(text, onComplete) {
    cancelTypewriter();
    const fullText = String(text ?? "");
    if (!fullText) {
      dom.text.textContent = "";
      onComplete?.();
      return;
    }

    const runtime = {fullText, index: 0, timerId: null};
    typewriterRuntime = runtime;
    const typeNextCharacter = () => {
      if (typewriterRuntime !== runtime) return;
      runtime.index++;
      dom.text.textContent = runtime.fullText.slice(0, runtime.index);
      if (runtime.index >= runtime.fullText.length) {
        typewriterRuntime = null;
        onComplete?.();
        return;
      }
      runtime.timerId = window.setTimeout(
        typeNextCharacter,
        getTypewriterDelay(runtime.fullText[runtime.index - 1])
      );
    };
    runtime.timerId = window.setTimeout(typeNextCharacter, TYPEWRITER_CHARACTER_MS);
  }

  function createSequenceLoader(slides) {
    const entries = new Map();

    function load(index) {
      if (index < 0 || index >= slides.length) return Promise.resolve(null);
      if (entries.has(index)) return entries.get(index).promise;

      const entry = {index, image: null, status: "loading", promise: null};
      entry.promise = new Promise(resolve => {
        if (typeof window.Image !== "function") {
          entry.status = "failed";
          resolve(entry);
          return;
        }
        const image = new window.Image();
        entry.image = image;
        image.onload = () => {
          entry.status = "loaded";
          resolve(entry);
        };
        image.onerror = () => {
          entry.status = "failed";
          resolve(entry);
        };
        image.src = slides[index].image;
      });
      entries.set(index, entry);
      return entry.promise;
    }

    function retain(indices) {
      const retained = new Set(indices.filter(index => index >= 0 && index < slides.length));
      for (const [index, entry] of entries) {
        if (retained.has(index)) continue;
        if (entry.image) {
          entry.image.onload = null;
          entry.image.onerror = null;
        }
        entries.delete(index);
      }
    }

    function clear() {
      retain([]);
    }

    return Object.freeze({load, retain, clear, getLiveCount: () => entries.size});
  }

  function drawFragment(fragmentNumber) {
    const canvas = dom?.fragmentCanvas;
    const context = canvas?.getContext?.("2d");
    if (!context) return;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(width / 2, height / 2, 12, width / 2, height / 2, 108);
    glow.addColorStop(0, "rgba(125, 255, 225, 0.55)");
    glow.addColorStop(0.58, "rgba(255, 214, 93, 0.28)");
    glow.addColorStop(1, "rgba(255, 214, 93, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((fragmentNumber - 4.5) * 0.025);
    context.beginPath();
    context.moveTo(-70, -48);
    context.lineTo(-18, -62);
    context.lineTo(22, -46);
    context.lineTo(67, -55);
    context.lineTo(58, -10);
    context.lineTo(74, 34);
    context.lineTo(20, 57);
    context.lineTo(-24, 48);
    context.lineTo(-66, 61);
    context.lineTo(-58, 9);
    context.closePath();
    context.shadowColor = "rgba(113, 255, 220, 0.9)";
    context.shadowBlur = 22;
    context.fillStyle = "#e8c979";
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 5;
    context.strokeStyle = "#8b6335";
    context.stroke();

    context.strokeStyle = "rgba(79, 111, 83, 0.72)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-43, 15);
    context.quadraticCurveTo(-10, -28, 43, -8);
    context.stroke();
    context.beginPath();
    context.moveTo(-18, 35);
    context.quadraticCurveTo(6, 8, 36, 30);
    context.stroke();

    context.fillStyle = "#4e3525";
    context.font = "900 34px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`${fragmentNumber} / 8`, 0, 2);
    context.restore();

    context.fillStyle = "#fff6b0";
    for (const [x, y, radius] of [[35, 25, 4], [205, 44, 3], [224, 137, 5], [28, 145, 3]]) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function setSequenceSlide(slide, index, total, entry) {
    dom.progress.textContent = `${index + 1} / ${total}`;
    dom.note.textContent = slide.note || "";
    dom.note.classList.add("hidden");
    if (entry?.status === "loaded" && entry.image) {
      dom.image.src = entry.image.src;
      dom.image.alt = `Story-Illustration ${index + 1} von ${total}`;
      dom.image.classList.remove("hidden");
      dom.imageFallback.classList.add("hidden");
    } else {
      dom.image.removeAttribute("src");
      dom.image.alt = "";
      dom.image.classList.add("hidden");
      dom.imageFallback.textContent = "Illustration nicht verfügbar";
      dom.imageFallback.classList.remove("hidden");
    }
  }

  function presentSequence(sequenceName, {allowCycleHide = false} = {}) {
    const slides = STORY_SEQUENCES[sequenceName];
    if (!slides || !cacheDom()) return Promise.resolve("continue");
    const loader = createSequenceLoader(slides);

    try {
      window.SlimeStoryAudio?.start?.(sequenceName);
    } catch (error) {
      console.warn("[Story] Story-Musik konnte nicht gestartet werden:", error);
    }

    dom.fragmentPanel.classList.add("hidden");
    dom.sequencePanel.classList.remove("hidden");
    dom.hideIntroButton.classList.toggle("hidden", !allowCycleHide);

    return new Promise(resolve => {
      let slideIndex = 0;
      let advancing = false;
      let finished = false;
      let textComplete = false;
      let slideReady = false;
      let currentSlide = slides[0];
      let transitionTimerId = null;
      let transitionResolve = null;

      const waitForTransition = () => new Promise(waitResolve => {
        transitionResolve = waitResolve;
        transitionTimerId = window.setTimeout(() => {
          transitionTimerId = null;
          transitionResolve = null;
          waitResolve();
        }, SLIDE_TRANSITION_MS);
      });

      const cancelTransition = () => {
        if (transitionTimerId === null) return;
        window.clearTimeout(transitionTimerId);
        transitionTimerId = null;
        const waitResolve = transitionResolve;
        transitionResolve = null;
        waitResolve?.();
      };

      const revealCurrentText = () => {
        if (textComplete || !currentSlide) return false;
        cancelTypewriter();
        dom.text.textContent = currentSlide.text;
        dom.note.classList.toggle("hidden", !currentSlide.note);
        textComplete = true;
        return true;
      };

      const finish = action => {
        if (finished) return;
        finished = true;
        cancelTypewriter();
        cancelTransition();
        loader.clear();
        dom.image.removeAttribute("src");
        activeStep = null;
        resolve(action);
      };

      const render = async () => {
        currentSlide = slides[slideIndex];
        textComplete = false;
        slideReady = false;
        cancelTypewriter();
        dom.text.textContent = "";
        dom.note.textContent = currentSlide.note || "";
        dom.note.classList.add("hidden");
        dom.progress.textContent = `${slideIndex + 1} / ${slides.length}`;
        dom.image.classList.add("hidden");
        dom.imageFallback.textContent = "Illustration wird geladen …";
        dom.imageFallback.classList.remove("hidden");
        const entry = await loader.load(slideIndex);
        if (finished) return;
        setSequenceSlide(currentSlide, slideIndex, slides.length, entry);
        loader.retain([slideIndex, slideIndex + 1]);
        void loader.load(slideIndex + 1);
        dom.nextButton.textContent = "WEITER";
        window.requestAnimationFrame(() => dom.sequencePanel.classList.add("storySlideVisible"));
        await waitForTransition();
        if (finished) return;
        slideReady = true;
        if (textComplete) return;
        startTypewriter(currentSlide.text, () => {
          if (finished) return;
          textComplete = true;
          dom.note.classList.toggle("hidden", !currentSlide.note);
        });
      };

      const next = async () => {
        if (advancing || finished) return;
        if (!textComplete) {
          revealCurrentText();
          return;
        }
        if (!slideReady) return;
        if (slideIndex >= slides.length - 1) {
          finish("continue");
          return;
        }
        advancing = true;
        slideReady = false;
        cancelTypewriter();
        dom.sequencePanel.classList.remove("storySlideVisible");
        await waitForTransition();
        if (finished) return;
        slideIndex++;
        await render();
        advancing = false;
      };

      activeStep = {
        kind: "sequence",
        next,
        skip: () => finish("skip"),
        hide: allowCycleHide ? () => finish("hide-cycle") : null,
        getLiveImageCount: loader.getLiveCount,
        isTextComplete: () => textComplete
      };
      void render();
    });
  }

  function presentFragment(fragmentNumber) {
    if (!cacheDom()) return Promise.resolve("continue");
    dom.sequencePanel.classList.add("hidden");
    dom.fragmentPanel.classList.remove("hidden");
    dom.fragmentText.textContent = fragmentNumber === 8
      ? "8 / 8 – Die Heimatseite ist wieder vollständig!"
      : `${fragmentNumber} / 8 Fragmente der Heimatseite wiederhergestellt.`;
    drawFragment(fragmentNumber);

    return new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        activeStep = null;
        resolve("continue");
      };
      activeStep = {kind: "fragment", next: finish, skip: finish, hide: null};
    });
  }

  function beginPresentation() {
    if (presenting || !cacheDom()) return false;
    presenting = true;
    bridge.setPresentationActive?.(true);
    window.SlimeAchievements?.setPopupsPaused?.(true);
    dom.overlay.classList.remove("hidden");
    dom.overlay.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => dom.overlay.classList.add("storyOverlayVisible"));
    return true;
  }

  function endPresentation() {
    try {
      window.SlimeStoryAudio?.stop?.();
    } catch (error) {
      console.warn("[Story] Story-Musik konnte beim Schließen nicht gestoppt werden:", error);
    }
    cancelTypewriter();
    activeStep = null;
    if (dom) {
      dom.overlay.classList.remove("storyOverlayVisible");
      dom.overlay.classList.add("hidden");
      dom.overlay.setAttribute("aria-hidden", "true");
      dom.sequencePanel.classList.remove("storySlideVisible");
      dom.sequencePanel.classList.add("hidden");
      dom.fragmentPanel.classList.add("hidden");
      dom.image.removeAttribute("src");
    }
    presenting = false;
    window.SlimeAchievements?.setPopupsPaused?.(false);
    bridge.setPresentationActive?.(false);
  }

  function runPresentation(task, onComplete) {
    if (!beginPresentation()) return false;
    let continuationCalled = false;
    const continueOnce = () => {
      if (continuationCalled) return;
      continuationCalled = true;
      if (typeof onComplete === "function") onComplete();
    };
    void Promise.resolve()
      .then(task)
      .catch(error => console.error("[Story] Story-Präsentation ist fehlgeschlagen:", error))
      .finally(() => {
        endPresentation();
        continueOnce();
      });
    return true;
  }

  function showIntro({onComplete = null} = {}) {
    if (!shouldShowIntro()) return false;
    return runPresentation(async () => {
      const action = await presentSequence("intro", {allowCycleHide: true});
      if (action === "hide-cycle") hideIntroForCycle();
    }, onComplete);
  }

  function createLevelPlan(levelNumber) {
    const level = Math.floor(Number(levelNumber));
    const fragment = FRAGMENT_MILESTONES.get(level) || null;
    const sequence = level === 100 ? "middle" : level === 200 ? "ending" : null;
    if (isDevStoryTestActive()) {
      return fragment || sequence ? {fragment, sequence, dev: true} : null;
    }
    if (!isActiveCycle()) return null;
    const cycle = storyState.cycle;
    const needsFragment = fragment && !cycle.fragments.includes(fragment);
    const needsSequence = sequence && cycle.sequences[sequence] !== "handled";
    return needsFragment || needsSequence
      ? {fragment: needsFragment ? fragment : null, sequence: needsSequence ? sequence : null, dev: false}
      : null;
  }

  function preparePersistentLevelPlan(plan, levelNumber) {
    if (plan.dev) return true;
    let recoveryProtected = false;
    if (plan.sequence) {
      recoveryProtected = window.SlimeRunRecovery?.protectStoryPresentation?.({
        levelNumber,
        sequence: plan.sequence
      }) === true;
      if (!recoveryProtected) {
        console.error("[Story] Run-Recovery konnte vor der Story nicht gesichert werden.");
        return false;
      }
    }

    const nextState = clone(storyState);
    if (plan.fragment && !nextState.cycle.fragments.includes(plan.fragment)) {
      nextState.cycle.fragments.push(plan.fragment);
      nextState.cycle.fragments.sort((left, right) => left - right);
    }
    if (plan.sequence) {
      nextState.cycle.sequences[plan.sequence] = "showing";
      nextState.cycle.pending = {sequence: plan.sequence, fragment: plan.fragment};
    }
    if (persistState(nextState)) return true;
    if (recoveryProtected) window.SlimeRunRecovery?.resumeAfterStoryPresentation?.();
    return false;
  }

  function clearPendingFragment() {
    if (!isActiveCycle() || !storyState.cycle.pending?.fragment) return true;
    const nextState = clone(storyState);
    nextState.cycle.pending.fragment = null;
    return persistState(nextState);
  }

  function finishPersistentSequence(sequence) {
    if (!isActiveCycle()) return false;
    const nextState = clone(storyState);
    nextState.cycle.sequences[sequence] = "handled";
    nextState.cycle.pending = null;
    return persistState(nextState);
  }

  function handleLevelCompleted({levelNumber, onComplete = null} = {}) {
    const normalizedLevel = Math.floor(Number(levelNumber));
    const plan = createLevelPlan(normalizedLevel);
    if (!plan || !preparePersistentLevelPlan(plan, normalizedLevel)) return false;

    return runPresentation(async () => {
      if (plan.fragment) {
        await presentFragment(plan.fragment);
        if (plan.sequence && !plan.dev) clearPendingFragment();
      }
      if (plan.sequence) {
        await presentSequence(plan.sequence);
        if (!plan.dev) finishPersistentSequence(plan.sequence);
      }
    }, () => {
      if (plan.sequence && !plan.dev) {
        window.SlimeRunRecovery?.resumeAfterStoryPresentation?.();
      }
      if (typeof onComplete === "function") onComplete();
    });
  }

  function hasPendingCompletionStory() {
    return isActiveCycle() && Boolean(storyState.cycle.pending?.sequence);
  }

  function resumePendingCompletion({onComplete = null} = {}) {
    if (!hasPendingCompletionStory()) return false;
    const pending = clone(storyState.cycle.pending);
    return runPresentation(async () => {
      if (pending.fragment) {
        await presentFragment(pending.fragment);
        clearPendingFragment();
      }
      await presentSequence(pending.sequence);
      finishPersistentSequence(pending.sequence);
    }, () => {
      window.SlimeRunRecovery?.resumeAfterStoryPresentation?.();
      if (typeof onComplete === "function") onComplete();
    });
  }

  function configure(configuration = {}) {
    devModeAvailable = configuration.devModeEnabled === true;
    bridge = Object.freeze({
      setPresentationActive: typeof configuration.setPresentationActive === "function"
        ? configuration.setPresentationActive
        : () => {}
    });
    cacheDom();
    return true;
  }

  function handleKeydown(event) {
    if (!presenting) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!activeStep) return;
    if (event.key === "Escape") activeStep.skip?.();
    else if (["Enter", " ", "ArrowRight"].includes(event.key)) activeStep.next?.();
  }

  function bindDomEvents() {
    if (!cacheDom() || dom.overlay.dataset.storyBound === "1") return;
    dom.overlay.dataset.storyBound = "1";
    dom.nextButton.addEventListener("click", () => activeStep?.next?.());
    dom.skipButton.addEventListener("click", () => activeStep?.skip?.());
    dom.hideIntroButton.addEventListener("click", () => activeStep?.hide?.());
    dom.fragmentContinueButton.addEventListener("click", () => activeStep?.next?.());
    dom.overlay.addEventListener("pointerdown", event => event.stopPropagation());
    dom.overlay.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("keydown", handleKeydown, true);
  }

  storyState = loadState();
  bindDomEvents();

  window.SlimeStory = Object.freeze({
    storageKey: STORY_STORAGE_KEY,
    stateVersion: STORY_STATE_VERSION,
    installationIdStorageKey: INSTALLATION_ID_STORAGE_KEY,
    devSessionKey: DEV_STORY_TEST_SESSION_KEY,
    fragmentMilestones: FRAGMENT_MILESTONES,
    sequences: STORY_SEQUENCES,
    createInitialState,
    normalizeState,
    getState: () => clone(storyState),
    isActiveCycle,
    beginPrestigeCycle,
    shouldShowIntro,
    hideIntroForCycle,
    showIntro,
    handleLevelCompleted,
    hasPendingCompletionStory,
    resumePendingCompletion,
    isPresenting: () => presenting,
    isDevTestEnabled: isDevStoryTestActive,
    setDevTestEnabled: setDevStoryTestEnabled,
    getActiveLiveImageCount: () => activeStep?.getLiveImageCount?.() ?? 0,
    isCurrentTextComplete: () => activeStep?.isTextComplete?.() ?? true,
    typewriterCharacterMs: TYPEWRITER_CHARACTER_MS,
    configure
  });
})();
