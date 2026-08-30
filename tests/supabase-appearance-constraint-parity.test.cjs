"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationPath = "supabase/slime-jump-appearance-constraint-hotfix-v2.71.sql";
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const LIVE_COSMETIC_IDS = Object.freeze([
  "none",
  "sunglasses",
  "cap",
  "crown",
  "top_hat",
  "wizard_hat",
  "pirate_hat",
  "headphones",
  "bow",
  "cowboy_hat",
  "devil_horns",
  "halo",
  "ninja_headband",
  "viking_helmet",
  "party_hat",
  "chef_hat",
  "propeller_hat",
  "cat_ears",
  "bunny_ears"
]);

const LIVE_BEARD_IDS = Object.freeze([
  "none",
  "stubble",
  "mustache",
  "goatee",
  "full_beard",
  "cowboy_mustache",
  "viking_beard",
  "wizard_beard",
  "braided_beard",
  "lumberjack_beard",
  "imperial_beard"
]);

const EXPECTED_NEW_COSMETIC_IDS = Object.freeze([
  "graduation_cap",
  "construction_helmet",
  "mushroom_hat",
  "jester_hat",
  "chinese_straw_hat"
]);

const EXPECTED_NEW_BEARD_IDS = Object.freeze([
  "walrus_mustache",
  "horseshoe_mustache",
  "soul_patch",
  "chinstrap_beard",
  "mutton_chops",
  "ducktail_beard",
  "forked_beard",
  "curly_beard",
  "box_beard",
  "pharaoh_beard",
  "fan_beard",
  "pencil_mustache",
  "circle_beard"
]);

function extractFrozenStringArray(source, constantName) {
  const pattern = new RegExp(
    `const\\s+${constantName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`
  );
  const match = source.match(pattern);
  assert.ok(match, `missing client registry: ${constantName}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(result => result[1]);
}

function extractConstraintIds(sql, constraintName) {
  const constraintStart = sql.indexOf(`add constraint ${constraintName}`);
  assert.ok(constraintStart >= 0, `missing SQL constraint: ${constraintName}`);
  const constraintEnd = sql.indexOf(";", constraintStart);
  assert.ok(constraintEnd > constraintStart, `unterminated SQL constraint: ${constraintName}`);
  return [...sql.slice(constraintStart, constraintEnd).matchAll(/'([^']+)'/g)]
    .map(result => result[1]);
}

function difference(values, baseline) {
  const baselineSet = new Set(baseline);
  return values.filter(value => !baselineSet.has(value));
}

const clientCosmetics = extractFrozenStringArray(
  read("js/slime-cosmetics.js"),
  "SLIME_COSMETIC_ORDER"
);
const clientBeards = extractFrozenStringArray(
  read("js/slime-beards.js"),
  "SLIME_BEARD_ORDER"
);
const migration = read(migrationPath);
const executableSql = migration.replace(/^\s*--.*$/gm, "");
const migrationCosmetics = extractConstraintIds(
  migration,
  "slime_jump_highscores_slime_cosmetic_check"
);
const migrationBeards = extractConstraintIds(
  migration,
  "slime_jump_highscores_slime_beard_check"
);

assert.deepEqual(
  difference(clientCosmetics, LIVE_COSMETIC_IDS),
  EXPECTED_NEW_COSMETIC_IDS,
  "v2.71 muss exakt die fuenf bestaetigten neuen Cosmetic-IDs enthalten"
);
assert.deepEqual(
  difference(clientBeards, LIVE_BEARD_IDS),
  EXPECTED_NEW_BEARD_IDS,
  "v2.71 muss exakt die 13 bestaetigten neuen Beard-IDs enthalten"
);

assert.deepEqual(
  migrationCosmetics,
  clientCosmetics,
  "Supabase-Cosmetic-Constraint muss exakt der aktuellen Client-Registry entsprechen"
);
assert.deepEqual(
  migrationBeards,
  clientBeards,
  "Supabase-Beard-Constraint muss exakt der aktuellen Client-Registry entsprechen"
);
assert.equal(new Set(clientCosmetics).size, clientCosmetics.length);
assert.equal(new Set(clientBeards).size, clientBeards.length);

assert.match(executableSql, /^\s*begin\s*;/i);
assert.match(executableSql, /commit\s*;\s*$/i);
assert.match(
  executableSql,
  /drop constraint slime_jump_highscores_slime_cosmetic_check\s*;/i
);
assert.match(
  executableSql,
  /drop constraint slime_jump_highscores_slime_beard_check\s*;/i
);
assert.equal(
  (executableSql.match(/;/g) ?? []).length,
  6,
  "Hotfix muss aus BEGIN, vier ALTER-TABLE-Statements und COMMIT bestehen"
);
assert.equal(
  (executableSql.match(/\(/g) ?? []).length,
  (executableSql.match(/\)/g) ?? []).length,
  "SQL-Klammern muessen ausgeglichen sein"
);
assert.equal(
  (executableSql.match(/alter table public\.slime_jump_highscores/gi) ?? []).length,
  4,
  "Hotfix darf nur die zwei Constraint-Drops und zwei Constraint-Adds enthalten"
);
assert.equal(
  (executableSql.match(/drop constraint/gi) ?? []).length,
  2,
  "Hotfix muss exakt zwei bestehende Constraints entfernen"
);
assert.equal(
  (executableSql.match(/add constraint/gi) ?? []).length,
  2,
  "Hotfix muss exakt zwei korrigierte Constraints anlegen"
);
assert.doesNotMatch(executableSql, /slime_color/i);
assert.doesNotMatch(
  executableSql,
  /\b(insert|update|delete|truncate|grant|revoke|create\s+(?:or\s+replace\s+)?function)\b/i
);
assert.doesNotMatch(executableSql, /\b(add|drop|alter)\s+column\b/i);

console.log(
  `Supabase appearance constraint parity passed: ` +
  `${clientCosmetics.length} cosmetics, ${clientBeards.length} beards, ` +
  `${EXPECTED_NEW_COSMETIC_IDS.length} + ${EXPECTED_NEW_BEARD_IDS.length} v2.71 IDs.`
);
