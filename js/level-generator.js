"use strict";

  function generateProceduralLevel(levelNumber) {
    const seed = (
      Date.now() ^
      Math.floor(Math.random() * 0xffffffff) ^
      Math.imul(levelNumber, 2654435761)
    ) >>> 0;

    const random = createSeededRandom(seed);
    const intensityFactor = clamp((levelNumber - 1) / 49, 0, 1);

    const adjectives = [
      "Schleimige", "Wackelige", "Tückische", "Sprunghafte",
      "Giftige", "Fliegende", "Klebrige", "Chaotische"
    ];
    const nouns = [
      "Klippen", "Höhlen", "Inseln", "Abgründe",
      "Türme", "Sümpfe", "Ruinen", "Passagen"
    ];

    const platforms = [];
    const routePlatforms = [];
    const movers = [];
    const fallingPlatforms = [];
    const conveyors = [];
    const fadePlatforms = [];
    const icePlatforms = [];
    const spikePlatforms = [];
    const enemies = [];
    const pads = [];
    const spikes = [];
    const stars = [];

    // Sicherer Startbereich.
    const startPlatform = {x: 0, y: 640, w: 235, h: 80};
    platforms.push(startPlatform);

    // Weniger und schmalere Plattformen bedeuten später größere Sprünge.
    let routeCount;
    if (levelNumber <= 10) {
      routeCount = 5;
    } else if (levelNumber <= 24) {
      routeCount = randomInt(random, 4, 5);
    } else {
      routeCount = randomInt(random, 3, 5);
    }

    let previousY = 600;

    // Jede Routenplattform erhält einen eigenen horizontalen Bereich.
    // Dadurch können Plattformen nicht mehr übereinander oder ineinander liegen.
    const routeLeft = 248;
    const routeRight = 1020;
    const routeGap = routeCount >= 5 ? 18 : routeCount === 4 ? 24 : 30;
    const routeSlotWidth =
      (routeRight - routeLeft - routeGap * (routeCount - 1)) / routeCount;

    for (let i = 0; i < routeCount; i++) {
      const baseMinWidth = 118 - intensityFactor * 18;
      const baseMaxWidth = 190 - intensityFactor * 28;
      const minWidth = Math.min(baseMinWidth, routeSlotWidth - 10);
      const maxWidth = Math.max(
        minWidth,
        Math.min(baseMaxWidth, routeSlotWidth - 4)
      );
      const width = randomRange(random, minWidth, maxWidth);

      let verticalChange = randomRange(
        random,
        -105 - intensityFactor * 28,
        78 + intensityFactor * 28
      );

      // Der erste Sprung soll zuverlässig nach oben führen.
      if (i === 0) {
        verticalChange = randomRange(random, -105, -35);
      }

      let platformY = clamp(previousY + verticalChange, 215, 575);

      // Verhindert mehrere fast identische Höhen hintereinander.
      if (Math.abs(platformY - previousY) < 28) {
        platformY = clamp(
          platformY + (random() < 0.5 ? -1 : 1) * randomRange(random, 32, 68),
          215,
          575
        );
      }

      const slotX = routeLeft + i * (routeSlotWidth + routeGap);
      const freeSpace = Math.max(0, routeSlotWidth - width);
      const platform = {
        x: slotX + randomRange(random, 0, freeSpace),
        y: platformY,
        w: width,
        h: 26
      };

      platforms.push(platform);
      routePlatforms.push(platform);
      previousY = platformY;
    }

    // Sicheres Zielplateau am rechten Rand.
    const goalPlatformY = clamp(
      previousY + randomRange(random, -88, 78),
      185,
      570
    );

    const goalPlatform = {
      x: 1060,
      y: goalPlatformY,
      w: 220,
      h: H - goalPlatformY
    };
    platforms.push(goalPlatform);

    // Ein Stachelbett bestraft Abstürze, blockiert aber nie den Hauptweg.
    spikes.push({x: 235, y: 690, w: 825, h: 30});

    const mechanicPool = [
      "pad", "falling", "normalEnemy", "moving", "conveyor",
      "fastEnemy", "fade", "ice", "spike"
    ];
    const platformMechanicNames = [
      "falling", "moving", "conveyor", "fade", "ice", "spike"
    ];

    let desiredPads = 0;
    let desiredFalling = 0;
    let desiredEnemies = 0;
    let desiredMovers = 0;
    let desiredConveyors = 0;
    let desiredFastEnemies = 0;
    let desiredFade = 0;
    let desiredIce = 0;
    let desiredSpikePlatforms = 0;
    let focusMechanic = null;

    // Level 1 bis 19 stellen jede Mechanik in einem isolierten Zweierblock vor.
    // Das zweite Level des Blocks enthält zwei Exemplare, sofern die Mechanik
    // und die vorhandene Routengeometrie das zulassen.
    if (levelNumber >= 2 && levelNumber <= 19) {
      const focusCount = levelNumber % 2 === 0 ? 1 : 2;

      if (levelNumber <= 3) {
        focusMechanic = "pad";
        desiredPads = focusCount;
      } else if (levelNumber <= 5) {
        focusMechanic = "falling";
        desiredFalling = focusCount;
      } else if (levelNumber <= 7) {
        focusMechanic = "normalEnemy";
        desiredEnemies = focusCount;
      } else if (levelNumber <= 9) {
        focusMechanic = "moving";
        desiredMovers = focusCount;
      } else if (levelNumber <= 11) {
        focusMechanic = "conveyor";
        desiredConveyors = focusCount;
      } else if (levelNumber <= 13) {
        focusMechanic = "fastEnemy";
        desiredFastEnemies = focusCount;
      } else if (levelNumber <= 15) {
        focusMechanic = "fade";
        desiredFade = focusCount;
      } else if (levelNumber <= 17) {
        focusMechanic = "ice";
        desiredIce = focusCount;
      } else {
        focusMechanic = "spike";
        desiredSpikePlatforms = focusCount;
      }
    } else if (levelNumber >= 20) {
      const mixFactor = clamp((levelNumber - 20) / 30, 0, 1);
      focusMechanic = chooseRandom(random, mechanicPool);
      const selectedMechanics = new Set([focusMechanic]);

      // Ein linear wachsendes Zusatzbudget bestimmt die Mischstärke. Auch bei
      // 100 % bleibt die konkrete Zusammenstellung zufällig: Der vollständige
      // Pool ist verfügbar, aber nicht in jedem Level vollständig erzwungen.
      const additionalMechanicCandidates = mechanicPool.filter(
        mechanic => mechanic !== focusMechanic
      );
      for (let i = additionalMechanicCandidates.length - 1; i > 0; i--) {
        const j = randomInt(random, 0, i);
        [additionalMechanicCandidates[i], additionalMechanicCandidates[j]] =
          [additionalMechanicCandidates[j], additionalMechanicCandidates[i]];
      }
      const targetAdditionalMechanics =
        mixFactor * (additionalMechanicCandidates.length - 0.5);
      const additionalMechanicCount =
        Math.floor(targetAdditionalMechanics) +
        (random() < targetAdditionalMechanics % 1 ? 1 : 0);
      for (const mechanic of additionalMechanicCandidates.slice(0, additionalMechanicCount)) {
        selectedMechanics.add(mechanic);
      }

      desiredPads = selectedMechanics.has("pad") ? 1 : 0;
      desiredFalling = selectedMechanics.has("falling") ? 1 : 0;
      desiredMovers = selectedMechanics.has("moving") ? 1 : 0;
      desiredConveyors = selectedMechanics.has("conveyor") ? 1 : 0;
      desiredFade = selectedMechanics.has("fade") ? 1 : 0;
      desiredIce = selectedMechanics.has("ice") ? 1 : 0;
      desiredSpikePlatforms = selectedMechanics.has("spike") ? 1 : 0;
      desiredEnemies = selectedMechanics.has("normalEnemy") ? 1 : 0;
      desiredFastEnemies = selectedMechanics.has("fastEnemy") ? 1 : 0;

      // Gegner besitzen ein eigenes, von den Plattformen unabhängiges Budget.
      // Zusätzliche Exemplare füllen dieses Budget im Erwartungswert linear.
      const activeEnemyTypes = [];
      if (desiredEnemies > 0) activeEnemyTypes.push("normal");
      if (desiredFastEnemies > 0) activeEnemyTypes.push("fast");
      const enemyCapacity = Math.max(0, routePlatforms.length - 1);
      const remainingEnemyCapacity = Math.max(
        0,
        enemyCapacity - desiredEnemies - desiredFastEnemies
      );
      const scaledExtraEnemies = mixFactor * remainingEnemyCapacity;
      const extraEnemyCount = Math.min(
        remainingEnemyCapacity,
        Math.floor(scaledExtraEnemies) +
          (random() < scaledExtraEnemies % 1 ? 1 : 0)
      );

      for (let i = 0; i < extraEnemyCount && activeEnemyTypes.length > 0; i++) {
        if (chooseRandom(random, activeEnemyTypes) === "fast") {
          desiredFastEnemies++;
        } else {
          desiredEnemies++;
        }
      }
    }

    // Solange Bounce-Pads aktiv sind, bleibt mindestens eine geeignete
    // Routenplattform statisch. Dadurch verschwindet die bereits gelernte
    // Mechanik nicht zufällig hinter zu vielen Spezialplattformen.
    const padReservationCandidates = routePlatforms
      .map((platform, index) => ({platform, index}))
      .filter(({platform, index}) =>
        index !== routePlatforms.length - 1 && platform.w >= 96
      );
    const reservedPadRouteIndex =
      desiredPads > 0 && padReservationCandidates.length > 0
        ? chooseRandom(random, padReservationCandidates).index
        : null;
    const maximumSpecialPlatforms =
      routePlatforms.length - (reservedPadRouteIndex === null ? 0 : 1);

    // Spezialplattformen erhalten ein eigenes Budget. Ein Plattform-Fokus wird
    // zuerst reserviert; alle übrigen gewünschten Typen konkurrieren fair über
    // eine gemischte Liste um die noch freien Routenpositionen.
    const desiredPlatformCounts = {
      falling: desiredFalling,
      moving: desiredMovers,
      conveyor: desiredConveyors,
      fade: desiredFade,
      ice: desiredIce,
      spike: desiredSpikePlatforms
    };
    const allocatedPlatformCounts = {
      falling: 0,
      moving: 0,
      conveyor: 0,
      fade: 0,
      ice: 0,
      spike: 0
    };
    let remainingSpecialCapacity = maximumSpecialPlatforms;

    if (
      remainingSpecialCapacity > 0 &&
      platformMechanicNames.includes(focusMechanic) &&
      desiredPlatformCounts[focusMechanic] > 0
    ) {
      allocatedPlatformCounts[focusMechanic]++;
      desiredPlatformCounts[focusMechanic]--;
      remainingSpecialCapacity--;
    }

    const remainingPlatformRequests = [];
    for (const type of platformMechanicNames) {
      for (let i = 0; i < desiredPlatformCounts[type]; i++) {
        remainingPlatformRequests.push(type);
      }
    }
    for (let i = remainingPlatformRequests.length - 1; i > 0; i--) {
      const j = randomInt(random, 0, i);
      [remainingPlatformRequests[i], remainingPlatformRequests[j]] =
        [remainingPlatformRequests[j], remainingPlatformRequests[i]];
    }
    for (const type of remainingPlatformRequests.slice(0, remainingSpecialCapacity)) {
      allocatedPlatformCounts[type]++;
    }

    const moverCount = allocatedPlatformCounts.moving;
    const fallingDesired = allocatedPlatformCounts.falling;
    const conveyorDesired = allocatedPlatformCounts.conveyor;
    const fadeDesired = allocatedPlatformCounts.fade;
    const iceDesired = allocatedPlatformCounts.ice;
    const spikePlatformDesired = allocatedPlatformCounts.spike;

    const dynamicCandidates = routePlatforms
      .map((_, index) => index)
      .filter(index => index !== reservedPadRouteIndex);

    // Kandidaten mit dem Level-Seed mischen. Eine Routenplattform kann immer
    // nur genau einen Spezialtyp erhalten.
    for (let i = dynamicCandidates.length - 1; i > 0; i--) {
      const j = randomInt(random, 0, i);
      [dynamicCandidates[i], dynamicCandidates[j]] =
        [dynamicCandidates[j], dynamicCandidates[i]];
    }

    const movingRouteIndices = new Set(
      dynamicCandidates.splice(0, Math.min(moverCount, dynamicCandidates.length))
    );
    const fallingRouteIndices = new Set(
      dynamicCandidates.splice(0, Math.min(fallingDesired, dynamicCandidates.length))
    );
    const conveyorRouteIndices = new Set(
      dynamicCandidates.splice(0, Math.min(conveyorDesired, dynamicCandidates.length))
    );
    const fadeRouteIndices = new Set(
      dynamicCandidates.splice(0, Math.min(fadeDesired, dynamicCandidates.length))
    );
    const iceRouteIndices = new Set(
      dynamicCandidates.splice(0, Math.min(iceDesired, dynamicCandidates.length))
    );
    const spikeRouteIndices = new Set(
      dynamicCandidates.splice(0, Math.min(spikePlatformDesired, dynamicCandidates.length))
    );

    function removeStaticPlatform(platform) {
      const staticIndex = platforms.indexOf(platform);
      if (staticIndex !== -1) platforms.splice(staticIndex, 1);
    }

    movingRouteIndices.forEach(index => {
      const platform = routePlatforms[index];
      platform.replacedByMover = true;
      removeStaticPlatform(platform);

      const leftNeighbour = routePlatforms[index - 1] || startPlatform;
      const rightNeighbour = routePlatforms[index + 1] || goalPlatform;
      const leftSpace = platform.x - (leftNeighbour.x + leftNeighbour.w);
      const rightSpace = rightNeighbour.x - (platform.x + platform.w);
      const neighbourIsMover =
        movingRouteIndices.has(index - 1) ||
        movingRouteIndices.has(index + 1);
      const maximumHorizontalRange = Math.max(
        0,
        Math.min(leftSpace, rightSpace) - 8
      );

      // Horizontal nur dann bewegen, wenn die Plattform auch an ihren
      // äußersten Punkten keine Nachbarplattform berühren kann.
      let axis = random() < 0.58 ? "x" : "y";
      if (neighbourIsMover || maximumHorizontalRange < 22) {
        axis = "y";
      }

      const desiredRange = randomRange(random, 28, 48 + intensityFactor * 28);
      const safeRange = axis === "x"
        ? Math.min(desiredRange, maximumHorizontalRange)
        : desiredRange;

      movers.push({
        x: platform.x,
        y: platform.y,
        w: platform.w,
        h: platform.h,
        axis,
        // Kontrollierte Bewegung, weil die Plattform zum Hauptweg gehört.
        range: safeRange,
        speed: randomRange(random, 0.82, 1.18 + intensityFactor * 0.34),
        phase: randomRange(random, 0, Math.PI * 2),
        routeIndex: index
      });
    });

    fallingRouteIndices.forEach(index => {
      const platform = routePlatforms[index];
      platform.replacedByFalling = true;
      removeStaticPlatform(platform);

      fallingPlatforms.push({
        x: platform.x,
        y: platform.y,
        currentY: platform.y,
        w: platform.w,
        h: platform.h,
        delay: Math.max(0.68, 1.15 - intensityFactor * 0.47),
        timer: 0,
        vy: 0,
        triggered: false,
        falling: false,
        removed: false,
        routeIndex: index
      });
    });

    conveyorRouteIndices.forEach(index => {
      const platform = routePlatforms[index];
      platform.replacedByConveyor = true;
      removeStaticPlatform(platform);

      conveyors.push({
        x: platform.x,
        y: platform.y,
        w: platform.w,
        h: platform.h,
        direction: random() < 0.5 ? -1 : 1,
        beltSpeed: randomRange(random, 92, 126 + intensityFactor * 48) * 0.40,
        phase: randomRange(random, 0, 40),
        routeIndex: index
      });
    });

    const fadeIndices = [...fadeRouteIndices];
    fadeIndices.forEach((index, order) => {
      const platform = routePlatforms[index];
      platform.replacedByFade = true;
      removeStaticPlatform(platform);

      // Eine einzelne Fade-Plattform beginnt vollständig sichtbar. Erst wenn
      // mehrere im selben Level vorkommen, erhalten sie bewusst versetzte Phasen.
      const phase = fadeIndices.length > 1
        ? (order / fadeIndices.length) * Math.PI * 2
        : 0;
      fadePlatforms.push({
        x: platform.x,
        y: platform.y,
        w: platform.w,
        h: platform.h,
        speed: randomRange(random, 1.02, 1.22 + intensityFactor * 0.18),
        phase,
        startTime: worldTime,
        opacity: 1,
        solid: true,
        routeIndex: index
      });
    });

    iceRouteIndices.forEach(index => {
      const platform = routePlatforms[index];
      platform.replacedByIce = true;
      removeStaticPlatform(platform);

      icePlatforms.push({
        x: platform.x,
        y: platform.y,
        w: platform.w,
        h: platform.h,
        routeIndex: index
      });
    });

    const spikeIndices = [...spikeRouteIndices];
    spikeIndices.forEach((index, order) => {
      const platform = routePlatforms[index];
      platform.replacedBySpike = true;
      removeStaticPlatform(platform);

      // Die erste Stachelplattform startet sicher. Falls später mehrere in einem
      // Level vorkommen, werden ihre Zyklen versetzt, damit sie nicht synchron laufen.
      const phaseOffset = spikeIndices.length > 1
        ? (order / spikeIndices.length) * 4.6
        : 0;
      spikePlatforms.push({
        x: platform.x,
        y: platform.y,
        w: platform.w,
        h: platform.h,
        cycle: randomRange(random, 4.35, 4.85),
        phaseOffset,
        startTime: worldTime,
        warning: false,
        extension: 0,
        dangerous: false,
        routeIndex: index
      });
    });

    // Bounce-Pads werden ab Level 2 garantiert eingeführt. Sie liegen nur auf
    // statischen Plattformen, damit sie nicht in der Luft zurückbleiben.
    const padCandidates = routePlatforms
      .map((platform, index) => ({platform, index}))
      .filter(({platform, index}) =>
        !platform.replacedByMover &&
        !platform.replacedByFalling &&
        !platform.replacedByConveyor &&
        !platform.replacedByFade &&
        !platform.replacedByIce &&
        !platform.replacedBySpike &&
        index !== routePlatforms.length - 1 &&
        platform.w >= 96
      );

    for (let i = padCandidates.length - 1; i > 0; i--) {
      const j = randomInt(random, 0, i);
      [padCandidates[i], padCandidates[j]] =
        [padCandidates[j], padCandidates[i]];
    }

    for (const {platform} of padCandidates.slice(0, desiredPads)) {
      const padWidth = Math.min(66, Math.max(48, platform.w * 0.43));
      pads.push({
        x: platform.x + platform.w / 2 - padWidth / 2,
        y: platform.y - 28,
        w: padWidth,
        h: 28
      });
    }

    // Spätere Level erhalten schmale Deckenpfeiler als Flugbahnhindernisse.
    // Keine zusätzlichen, unerklärten Deckenhindernisse: Die Lernkurve
    // konzentriert sich auf die neun angekündigten Mechaniken.
    const ceilingObstacleCount = 0;

    for (let i = 0; i < ceilingObstacleCount; i++) {
      // Mehrere Positionen probieren. Der Pfeiler wird nur gesetzt, wenn er
      // keine Routen-, Start- oder Zielplattform berührt.
      for (let attempt = 0; attempt < 14; attempt++) {
        const obstacle = {
          x: randomRange(random, 390, 950),
          y: 0,
          w: randomRange(random, 30, 50),
          h: randomRange(random, 95, 175 + intensityFactor * 85)
        };

        const protectedPlatforms = [
          startPlatform,
          goalPlatform,
          ...routePlatforms
        ];

        if (!protectedPlatforms.some(platform =>
          rectanglesOverlap(obstacle, platform, 12)
        )) {
          platforms.push(obstacle);
          break;
        }
      }
    }

    // Beide Geistarten nutzen dieselben einfachen horizontalen oder vertikalen
    // Bahnen. Der orange-rote Geist ist die deutlich schnellere Variante.
    const enemyCandidates = [];
    for (let i = 0; i < routePlatforms.length - 1; i++) {
      const a = routePlatforms[i];
      const b = routePlatforms[i + 1];
      enemyCandidates.push({
        x: (a.x + a.w / 2 + b.x + b.w / 2) / 2,
        y: clamp(
          Math.min(a.y, b.y) - randomRange(random, 58, 100),
          110,
          535
        )
      });
    }

    for (let i = enemyCandidates.length - 1; i > 0; i--) {
      const j = randomInt(random, 0, i);
      [enemyCandidates[i], enemyCandidates[j]] =
        [enemyCandidates[j], enemyCandidates[i]];
    }

    const enemyCapacity = enemyCandidates.length;
    const enemyTypes = [];

    // Sobald beide Varianten freigeschaltet sind, erscheint nach Möglichkeit
    // mindestens eine von jeder Sorte. Zusätzliche Plätze werden danach zufällig
    // mit den noch gewünschten Geistern aufgefüllt.
    let remainingNormal = desiredEnemies;
    let remainingFast = desiredFastEnemies;
    if (remainingNormal > 0 && enemyTypes.length < enemyCapacity) {
      enemyTypes.push("normal");
      remainingNormal--;
    }
    if (remainingFast > 0 && enemyTypes.length < enemyCapacity) {
      enemyTypes.push("fast");
      remainingFast--;
    }

    const additionalEnemyTypes = [
      ...Array(remainingNormal).fill("normal"),
      ...Array(remainingFast).fill("fast")
    ];
    for (let i = additionalEnemyTypes.length - 1; i > 0; i--) {
      const j = randomInt(random, 0, i);
      [additionalEnemyTypes[i], additionalEnemyTypes[j]] =
        [additionalEnemyTypes[j], additionalEnemyTypes[i]];
    }
    enemyTypes.push(
      ...additionalEnemyTypes.slice(0, Math.max(0, enemyCapacity - enemyTypes.length))
    );

    // Die garantierten Typen werden ebenfalls gemischt, damit ihre Position auf
    // der Route nicht vorhersehbar ist.
    for (let i = enemyTypes.length - 1; i > 0; i--) {
      const j = randomInt(random, 0, i);
      [enemyTypes[i], enemyTypes[j]] = [enemyTypes[j], enemyTypes[i]];
    }

    for (let i = 0; i < enemyTypes.length; i++) {
      const base = enemyCandidates[i];
      const type = enemyTypes[i];
      const isFast = type === "fast";

      enemies.push({
        type,
        x: base.x,
        y: base.y,
        r: randomRange(random, 24, 29),
        axis: random() < 0.52 ? "x" : "y",
        range: randomRange(random, 34, 58 + intensityFactor * 28),
        speed: isFast
          ? randomRange(random, 1.72, 2.15 + intensityFactor * 0.55)
          : randomRange(random, 0.9, 1.28 + intensityFactor * 0.42),
        phase: randomRange(random, 0, Math.PI * 2)
      });
    }

    // Drei Sterne liegen auf unterschiedlichen Abschnitten des sicheren Wegs.
    const starIndices = [
      0,
      Math.floor((routePlatforms.length - 1) / 2),
      routePlatforms.length - 1
    ];

    for (const index of [...new Set(starIndices)]) {
      const platform = routePlatforms[index];
      stars.push({
        x: platform.x + platform.w / 2,
        y: platform.y - 48
      });
    }

    // Falls wegen einer sehr kurzen Route weniger als drei Positionen entstanden.
    while (stars.length < 3) {
      const platform = routePlatforms[randomInt(random, 0, routePlatforms.length - 1)];
      stars.push({
        x: platform.x + randomRange(random, platform.w * 0.25, platform.w * 0.75),
        y: platform.y - randomRange(random, 44, 72)
      });
    }

    return {
      seed,
      name: `${chooseRandom(random, adjectives)} ${chooseRandom(random, nouns)}`,
      spawn: {x: 100, y: 590},
      goal: {
        x: 1140,
        y: goalPlatformY - 95,
        w: 62,
        h: 92
      },
      platforms,
      spikes,
      pads,
      stars,
      movers,
      fallingPlatforms,
      conveyors,
      fadePlatforms,
      icePlatforms,
      spikePlatforms,
      enemies
    };
  }

