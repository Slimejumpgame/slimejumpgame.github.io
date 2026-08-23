"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const generatorSource = fs.readFileSync(
  path.join(root, "js", "level-generator.js"),
  "utf8"
);
const effectiveAssignment =
  "const effectiveDifficultyLevel = getEffectiveDifficultyLevel(levelNumber);";
const legacyAssignment = "const effectiveDifficultyLevel = levelNumber;";
const selectedAuditLevels = Object.freeze([
  1, 10, 19, 20, 25, 34, 40, 50,
  60, 75, 90, 99, 100, 101, 125, 150
]);
const specialPlatformCollections = Object.freeze([
  "movers",
  "fallingPlatforms",
  "conveyors",
  "fadePlatforms",
  "icePlatforms",
  "spikePlatforms"
]);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function closeTo(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `${message}: expected ${expected}, received ${actual}`
  );
}

function createGeneratorHarness({legacyDifficulty = false} = {}) {
  let seededDateNow = 0;
  const testMath = Object.create(Math);
  Object.defineProperty(testMath, "random", {value: () => 0});

  let source = generatorSource;
  if (legacyDifficulty) {
    assert.equal(source.split(effectiveAssignment).length, 2);
    source = source.replace(effectiveAssignment, legacyAssignment);
  }

  const context = vm.createContext({
    console,
    Date: {now: () => seededDateNow},
    Math: testMath,
    window: {
      SlimePerks: {
        shouldGenerateLuckyCharmBonusStar: () => false
      }
    }
  });

  vm.runInContext(`
    const H = 720;
    let worldTime = 0;

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

    ${source}

    globalThis.generatorTestApi = {
      generateProceduralLevel,
      getEffectiveDifficultyLevel
    };
  `, context, {
    filename: legacyDifficulty
      ? "js/level-generator-legacy-test-harness.js"
      : "js/level-generator-difficulty-test-harness.js"
  });

  return {
    effectiveDifficultyLevel(levelNumber) {
      return Number(context.generatorTestApi.getEffectiveDifficultyLevel(levelNumber));
    },
    generate(levelNumber, seed) {
      seededDateNow = (
        (seed >>> 0) ^ Math.imul(levelNumber, 2654435761)
      ) >>> 0;
      return plain(context.generatorTestApi.generateProceduralLevel(levelNumber));
    }
  };
}

function getDifficultyFactors(effectiveDifficultyLevel) {
  return {
    intensityFactor: Math.max(
      0,
      Math.min(1, (effectiveDifficultyLevel - 1) / 49)
    ),
    mixFactor: Math.max(
      0,
      Math.min(1, (effectiveDifficultyLevel - 20) / 30)
    )
  };
}

function seedFor(levelNumber, index) {
  return (
    Math.imul(levelNumber + 17, 0x9e3779b1) ^
    Math.imul(index + 1, 0x85ebca6b) ^
    0xc2b2ae35
  ) >>> 0;
}

function comparisonSeed(index) {
  return (
    Math.imul(index + 1, 0x9e3779b1) ^
    0xa5a5a5a5
  ) >>> 0;
}

function getRoutePlatforms(level) {
  const staticRoutePlatforms = level.platforms.slice(1, -1);
  const specialRoutePlatforms = specialPlatformCollections.flatMap(
    collection => level[collection]
  );
  return [...staticRoutePlatforms, ...specialRoutePlatforms]
    .sort((a, b) => a.x - b.x);
}

function assertFiniteNumbers(value, label) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${label} is not finite`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteNumbers(entry, `${label}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    assertFiniteNumbers(entry, `${label}.${key}`);
  }
}

function validateGeneratedLevel(level, realLevel, effectiveDifficultyLevel) {
  assertFiniteNumbers(level, `level-${realLevel}`);
  assert.deepEqual(level.spawn, {x: 100, y: 590});
  assert.ok(level.platforms.some(platform =>
    platform.x === 0 && platform.y === 640 && platform.w === 235
  ));
  assert.ok(level.platforms.some(platform =>
    platform.x === 1060 && platform.w === 220
  ));
  assert.ok(level.goal && level.goal.x === 1140);
  assert.equal(
    level.stars.filter(star => star.isLuckyCharmBonus !== true).length,
    3
  );

  const routePlatforms = getRoutePlatforms(level);
  const routeCount = routePlatforms.length;
  if (effectiveDifficultyLevel <= 10) {
    assert.equal(routeCount, 5);
  } else if (effectiveDifficultyLevel < 25) {
    assert.ok(routeCount === 4 || routeCount === 5);
  } else {
    assert.ok(routeCount >= 3 && routeCount <= 5);
  }

  const intensityFactor = getDifficultyFactors(effectiveDifficultyLevel).intensityFactor;
  const routeGap = routeCount >= 5 ? 18 : routeCount === 4 ? 24 : 30;
  const routeSlotWidth = (1020 - 248 - routeGap * (routeCount - 1)) / routeCount;
  const expectedMinWidth = Math.min(118 - intensityFactor * 18, routeSlotWidth - 10);
  const expectedMaxWidth = Math.max(
    expectedMinWidth,
    Math.min(190 - intensityFactor * 28, routeSlotWidth - 4)
  );

  routePlatforms.forEach((platform, index) => {
    assert.ok(platform.x >= 248 - 1e-9);
    assert.ok(platform.x + platform.w <= 1020 + 1e-9);
    assert.ok(platform.y >= 215 && platform.y <= 575);
    assert.ok(platform.w >= expectedMinWidth - 1e-9);
    assert.ok(platform.w <= expectedMaxWidth + 1e-9);
    if (index > 0) {
      const previous = routePlatforms[index - 1];
      assert.ok(
        platform.x >= previous.x + previous.w,
        `level ${realLevel} route is not monotone`
      );
    }
  });

  const specialPlatforms = specialPlatformCollections.flatMap(
    collection => level[collection]
  );
  const specialIndices = specialPlatforms.map(platform => platform.routeIndex);
  assert.equal(new Set(specialIndices).size, specialIndices.length);
  for (const platform of specialPlatforms) {
    assert.ok(Number.isInteger(platform.routeIndex));
    assert.ok(platform.routeIndex >= 0 && platform.routeIndex < routeCount);
    const base = routePlatforms[platform.routeIndex];
    closeTo(platform.x, base.x, `level ${realLevel} special x`);
    closeTo(platform.y, base.y, `level ${realLevel} special y`);
    closeTo(platform.w, base.w, `level ${realLevel} special width`);
  }

  for (const mover of level.movers) {
    assert.ok(mover.axis === "x" || mover.axis === "y");
    assert.ok(mover.range >= 0);
    assert.ok(mover.range <= 76 + 1e-9);
    if (mover.axis !== "x") continue;
    const index = mover.routeIndex;
    const leftNeighbour = routePlatforms[index - 1] || level.platforms[0];
    const rightNeighbour = routePlatforms[index + 1] || level.platforms.at(-1);
    const maximumHorizontalRange = Math.max(
      0,
      Math.min(
        mover.x - (leftNeighbour.x + leftNeighbour.w),
        rightNeighbour.x - (mover.x + mover.w)
      ) - 8
    );
    assert.ok(mover.range <= maximumHorizontalRange + 1e-9);
  }

  return {
    routeCount,
    minWidth: Math.min(...routePlatforms.map(platform => platform.w)),
    maxWidth: Math.max(...routePlatforms.map(platform => platform.w)),
    minY: Math.min(...routePlatforms.map(platform => platform.y)),
    maxY: Math.max(...routePlatforms.map(platform => platform.y)),
    maxMoverRange: Math.max(0, ...level.movers.map(mover => mover.range)),
    enemyCount: level.enemies.length,
    specialCount: specialPlatforms.length
  };
}

function getMechanicCounts(level) {
  return {
    pad: level.pads.length,
    falling: level.fallingPlatforms.length,
    normalEnemy: level.enemies.filter(enemy => enemy.type === "normal").length,
    moving: level.movers.length,
    conveyor: level.conveyors.length,
    fastEnemy: level.enemies.filter(enemy => enemy.type === "fast").length,
    fade: level.fadePlatforms.length,
    ice: level.icePlatforms.length,
    spike: level.spikePlatforms.length
  };
}

function expectedIntroCounts(levelNumber) {
  const counts = {
    pad: 0,
    falling: 0,
    normalEnemy: 0,
    moving: 0,
    conveyor: 0,
    fastEnemy: 0,
    fade: 0,
    ice: 0,
    spike: 0
  };
  if (levelNumber === 1) return counts;
  const count = levelNumber % 2 === 0 ? 1 : 2;
  const mechanic = levelNumber <= 3 ? "pad"
    : levelNumber <= 5 ? "falling"
      : levelNumber <= 7 ? "normalEnemy"
        : levelNumber <= 9 ? "moving"
          : levelNumber <= 11 ? "conveyor"
            : levelNumber <= 13 ? "fastEnemy"
              : levelNumber <= 15 ? "fade"
                : levelNumber <= 17 ? "ice"
                  : "spike";
  counts[mechanic] = count;
  return counts;
}

const current = createGeneratorHarness();
const legacy = createGeneratorHarness({legacyDifficulty: true});

const mappingExpectations = new Map([
  [1, 1],
  [10, 10],
  [19, 19],
  [20, 20],
  [21, 20.375],
  [33, 24.875],
  [34, 25.25],
  [50, 31.25],
  [75, 40.625],
  [99, 49.625],
  [100, 50],
  [101, 50],
  [125, 50],
  [150, 50]
]);

for (const [realLevel, expectedEffectiveLevel] of mappingExpectations) {
  closeTo(
    current.effectiveDifficultyLevel(realLevel),
    expectedEffectiveLevel,
    `effective difficulty for real level ${realLevel}`
  );
}

const level20Factors = getDifficultyFactors(current.effectiveDifficultyLevel(20));
const level100Factors = getDifficultyFactors(current.effectiveDifficultyLevel(100));
closeTo(level20Factors.mixFactor, 0, "real level 20 mix factor");
closeTo(level100Factors.intensityFactor, 1, "real level 100 intensity factor");
closeTo(level100Factors.mixFactor, 1, "real level 100 mix factor");
for (const levelNumber of [101, 125, 150, 500]) {
  const factors = getDifficultyFactors(current.effectiveDifficultyLevel(levelNumber));
  closeTo(factors.intensityFactor, 1, `real level ${levelNumber} intensity cap`);
  closeTo(factors.mixFactor, 1, `real level ${levelNumber} mix cap`);
}

let firstRealLevelAtLegacyRouteTier = null;
for (let levelNumber = 1; levelNumber <= 100; levelNumber++) {
  if (current.effectiveDifficultyLevel(levelNumber) >= 25) {
    firstRealLevelAtLegacyRouteTier = levelNumber;
    break;
  }
}
assert.equal(firstRealLevelAtLegacyRouteTier, 34);

for (let levelNumber = 1; levelNumber <= 20; levelNumber++) {
  closeTo(
    current.effectiveDifficultyLevel(levelNumber),
    levelNumber,
    `intro effective difficulty for level ${levelNumber}`
  );
  for (let index = 0; index < 64; index++) {
    const seed = seedFor(levelNumber, index);
    const generated = current.generate(levelNumber, seed);
    assert.deepEqual(generated, legacy.generate(levelNumber, seed));
    if (levelNumber <= 19) {
      assert.deepEqual(getMechanicCounts(generated), expectedIntroCounts(levelNumber));
    }
  }
}

for (let index = 0; index < 1000; index++) {
  const seed = comparisonSeed(index);
  assert.deepEqual(
    current.generate(100, seed),
    legacy.generate(50, seed),
    `new level 100 differs from legacy level 50 for seed ${seed}`
  );
  const cappedLevel = current.generate(100, seed);
  for (const realLevel of [101, 125, 150]) {
    assert.deepEqual(
      current.generate(realLevel, seed),
      cappedLevel,
      `real level ${realLevel} exceeds the level-100 envelope for seed ${seed}`
    );
  }
}

const auditSummaries = [];
for (const realLevel of selectedAuditLevels) {
  const effectiveDifficultyLevel = current.effectiveDifficultyLevel(realLevel);
  const summary = {
    level: realLevel,
    effective: effectiveDifficultyLevel,
    routes: new Set(),
    minWidth: Infinity,
    maxWidth: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    maxMoverRange: 0,
    maxEnemies: 0,
    maxSpecials: 0
  };

  for (let index = 0; index < 1000; index++) {
    const generated = current.generate(realLevel, seedFor(realLevel, index));
    const sample = validateGeneratedLevel(
      generated,
      realLevel,
      effectiveDifficultyLevel
    );
    summary.routes.add(sample.routeCount);
    summary.minWidth = Math.min(summary.minWidth, sample.minWidth);
    summary.maxWidth = Math.max(summary.maxWidth, sample.maxWidth);
    summary.minY = Math.min(summary.minY, sample.minY);
    summary.maxY = Math.max(summary.maxY, sample.maxY);
    summary.maxMoverRange = Math.max(summary.maxMoverRange, sample.maxMoverRange);
    summary.maxEnemies = Math.max(summary.maxEnemies, sample.enemyCount);
    summary.maxSpecials = Math.max(summary.maxSpecials, sample.specialCount);
  }

  auditSummaries.push({
    ...summary,
    routes: [...summary.routes].sort((a, b) => a - b),
    minWidth: Number(summary.minWidth.toFixed(3)),
    maxWidth: Number(summary.maxWidth.toFixed(3)),
    minY: Number(summary.minY.toFixed(3)),
    maxY: Number(summary.maxY.toFixed(3)),
    maxMoverRange: Number(summary.maxMoverRange.toFixed(3))
  });
}

assert.match(generatorSource, /if \(levelNumber >= 2 && levelNumber <= 19\)/);
assert.match(generatorSource, /else if \(levelNumber >= 20\)/);
assert.match(generatorSource, /Math\.imul\(levelNumber, 2654435761\)/);

console.log("Difficulty mapping and deterministic parity tests passed.");
console.log("First real level at the legacy level-25 route tier: 34.");
console.table(auditSummaries);
console.log("Statistical generator audit passed: 1,000 seeds per selected level.");
