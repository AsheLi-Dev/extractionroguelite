/**
 * Estimate average loot from N searchables (table-roll path only).
 * Use: node src/data/searchable-loot-estimate.js [N]
 * Default N = 1_000_000.
 *
 * Does not include: pendingLootDefs (START/OPEN_SPACE/miniboss chests), 50% empty on non-biome, Arcane Eye, boss room 2x.
 */

import { SEARCHABLE_LOOT_TABLES } from "./searchable-loot-tables.js";

// Spawn type weights from game-map.js (non-biome): crate 45, locker 25, deadWarrior 15, chest 15
const SEARCHABLE_TYPE_WEIGHTS = [
  { typeId: "crate", lootTable: "crate_basic", w: 45 },
  { typeId: "locker", lootTable: "locker_basic", w: 25 },
  { typeId: "deadWarrior", lootTable: "dead_warrior", w: 15 },
  { typeId: "chest", lootTable: "chest_basic", w: 15 },
];
const TOTAL_WEIGHT = SEARCHABLE_TYPE_WEIGHTS.reduce((s, x) => s + x.w, 0);

// Base loot multiplier (BASE_SEARCHABLE_LOOT_MULT in searchable-prop.js)
const BASE_LOOT_MULT = 1.5;

/**
 * Expected gold per roll for a table: uniform [min, max] -> (min+max)/2
 */
function expectedGoldForTable(table) {
  const { min, max } = table.gold;
  return (min + max) / 2;
}

/**
 * Expected loot per single roll for a given table.
 * Returns { gold, cubeDrops, equipmentDrops } (cube/equipment are probabilities = expected count).
 */
function expectedLootPerRoll(table) {
  return {
    gold: expectedGoldForTable(table),
    cubeDrops: table.cubeChance,
    equipmentDrops: table.equipmentChance,
  };
}

/**
 * Weighted average expected loot per roll over spawn type distribution.
 */
function expectedLootPerRollBySpawnMix() {
  let gold = 0;
  let cubeDrops = 0;
  let equipmentDrops = 0;
  for (const { lootTable, w } of SEARCHABLE_TYPE_WEIGHTS) {
    const table = SEARCHABLE_LOOT_TABLES[lootTable];
    if (!table) continue;
    const p = w / TOTAL_WEIGHT;
    const e = expectedLootPerRoll(table);
    gold += p * e.gold;
    cubeDrops += p * e.cubeDrops;
    equipmentDrops += p * e.equipmentDrops;
  }
  return { gold, cubeDrops, equipmentDrops };
}

/**
 * Expected number of rolls per searchable: floor(mult) + (mult - floor(mult)).
 * So for mult=1.5: 1 + 0.5 = 1.5 rolls.
 */
function expectedRollsPerSearchable(lootMultiplier = BASE_LOOT_MULT) {
  const full = Math.floor(lootMultiplier);
  const partial = Math.max(0, Math.min(1, lootMultiplier - full));
  return full + partial;
}

/**
 * Expected loot per searchable (table-roll only, base multiplier).
 */
export function expectedLootPerSearchable(lootMultiplier = BASE_LOOT_MULT) {
  const perRoll = expectedLootPerRollBySpawnMix();
  const rolls = expectedRollsPerSearchable(lootMultiplier);
  return {
    gold: perRoll.gold * rolls,
    cubeDrops: perRoll.cubeDrops * rolls,
    equipmentDrops: perRoll.equipmentDrops * rolls,
    rolls,
  };
}

/**
 * Scale to N searchables.
 */
export function estimateLootForN(N, lootMultiplier = BASE_LOOT_MULT) {
  const per = expectedLootPerSearchable(lootMultiplier);
  return {
    gold: per.gold * N,
    cubeDrops: per.cubeDrops * N,
    equipmentDrops: per.equipmentDrops * N,
    perSearchable: per,
    N,
  };
}

/**
 * Monte Carlo: simulate one searchable (table roll path). No game/lootSystem; returns counts.
 */
function simulateOneSearchable(rng, lootMultiplier = BASE_LOOT_MULT) {
  const fullRolls = Math.max(0, Math.floor(lootMultiplier));
  const partialChance = Math.max(0, Math.min(1, lootMultiplier - fullRolls));
  const rollCount = fullRolls + (rng() < partialChance ? 1 : 0);
  const numRolls = Math.max(1, rollCount);

  // Pick type by spawn weight
  let v = rng() * TOTAL_WEIGHT;
  let tableId = SEARCHABLE_TYPE_WEIGHTS[0].lootTable;
  for (const row of SEARCHABLE_TYPE_WEIGHTS) {
    v -= row.w;
    if (v <= 0) {
      tableId = row.lootTable;
      break;
    }
  }
  const table = SEARCHABLE_LOOT_TABLES[tableId];
  if (!table) return { gold: 0, cubes: 0, equipment: 0 };

  let gold = 0;
  let cubes = 0;
  let equipment = 0;
  const { min, max } = table.gold;
  for (let i = 0; i < numRolls; i++) {
    gold += min + Math.floor(rng() * (max - min + 1));
    if (rng() < table.cubeChance) cubes += 1;
    if (rng() < table.equipmentChance) equipment += 1;
  }
  return { gold, cubes, equipment };
}

/**
 * Run S simulations and return sample means (and optional std dev).
 */
export function monteCarloEstimate(N, S = 100_000, lootMultiplier = BASE_LOOT_MULT, rng = Math.random) {
  let sumGold = 0;
  let sumCubes = 0;
  let sumEquip = 0;
  let sumSqGold = 0;
  for (let i = 0; i < S; i++) {
    const s = simulateOneSearchable(rng, lootMultiplier);
    sumGold += s.gold;
    sumCubes += s.cubes;
    sumEquip += s.equipment;
    sumSqGold += s.gold * s.gold;
  }
  const meanGold = sumGold / S;
  const meanCubes = sumCubes / S;
  const meanEquip = sumEquip / S;
  const varianceGold = sumSqGold / S - meanGold * meanGold;
  const stdGold = Math.sqrt(Math.max(0, varianceGold));
  return {
    perSearchable: { gold: meanGold, cubeDrops: meanCubes, equipmentDrops: meanEquip },
    forN: {
      gold: meanGold * N,
      cubeDrops: meanCubes * N,
      equipmentDrops: meanEquip * N,
    },
    sampleSize: S,
    N,
    stdGoldPerSearchable: stdGold,
  };
}

// CLI: node src/data/searchable-loot-estimate.js [N] [--sim S]
if (typeof process !== "undefined" && process.argv) {
  const args = process.argv.slice(2);
  const N = parseInt(args[0], 10) || 1_000_000;
  const simIdx = args.indexOf("--sim");
  const S = simIdx >= 0 ? parseInt(args[simIdx + 1], 10) || 100_000 : 0;

  const closed = estimateLootForN(N);
  console.log("--- Closed-form expected loot (table-roll only, lootMult=1.5) ---");
  console.log("Per searchable:", closed.perSearchable);
  console.log(`For N = ${N.toLocaleString()}:`);
  console.log("  Gold:      ", Math.round(closed.gold).toLocaleString());
  console.log("  Cube drops:", closed.cubeDrops.toFixed(2));
  console.log("  Equipment: ", closed.equipmentDrops.toFixed(2));

  if (S > 0) {
    console.log("\n--- Monte Carlo (sample size " + S.toLocaleString() + ") ---");
    const mc = monteCarloEstimate(N, S);
    console.log("Per searchable (sample mean):", mc.perSearchable);
    console.log("For N = " + N.toLocaleString() + ":", mc.forN);
    console.log("Gold std per searchable:", mc.stdGoldPerSearchable.toFixed(2));
  }
}
