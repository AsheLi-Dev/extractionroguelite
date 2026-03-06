// -------- Breakable loot tables and roll --------
// Gold always; optional cube/equipment from weighted rolls.

import { generateEquipmentItem } from "./loot-data.js";
import { MODIFIER_CUBES, UPGRADE_CUBES } from "./cubes-data.js";

/** Loot table id -> { gold: {min, max}, rolls: [{ type, weight, tierMax?, rarityMax? }] } */
export const BREAKABLE_LOOT_TABLES = {
  crateBasic: {
    gold: { min: 5, max: 15 },
    rolls: [
      { type: "cube", weight: 10, tierMax: 1 },
      { type: "equipment", weight: 1, rarityMax: "magic" },
      { type: "nothing", weight: 89 },
    ],
  },
  urnMagic: {
    gold: { min: 8, max: 20 },
    rolls: [
      { type: "cube", weight: 20, tierMax: 2 },
      { type: "equipment", weight: 2, rarityMax: "rare" },
      { type: "nothing", weight: 78 },
    ],
  },
  chestRare: {
    gold: { min: 20, max: 60 },
    rolls: [
      { type: "cube", weight: 50, tierMax: 3 },
      { type: "equipment", weight: 10, rarityMax: "rare" },
      { type: "nothing", weight: 40 },
    ],
  },
};

/**
 * Weighted roll from rolls array. rng() returns 0..1.
 * @param {Array<{type: string, weight: number, tierMax?: number, rarityMax?: string}>} rolls
 * @param {() => number} rng
 * @returns {{ type: string, tierMax?: number, rarityMax?: string } | null}
 */
function rollFromTable(rolls, rng) {
  const total = rolls.reduce((s, r) => s + r.weight, 0);
  let v = rng() * total;
  for (const r of rolls) {
    v -= r.weight;
    if (v <= 0) return { type: r.type, tierMax: r.tierMax, rarityMax: r.rarityMax };
  }
  return { type: "nothing" };
}

/**
 * Roll breakable loot. Returns { goldAmount, cubeKey?, equipmentDef? }.
 * @param {string} tableId - key in BREAKABLE_LOOT_TABLES
 * @param {() => number} rng - seeded or Math.random
 * @param {Object} context - { lootQuality, difficulty } for equipment
 */
export function rollBreakableLoot(tableId, rng, context = {}) {
  const table = BREAKABLE_LOOT_TABLES[tableId];
  if (!table) {
    return { goldAmount: 5, cubeKey: null, equipmentDef: null };
  }

  const goldAmount =
    table.gold.min + Math.floor(rng() * (table.gold.max - table.gold.min + 1));
  let cubeKey = null;
  let equipmentDef = null;

  const result = rollFromTable(table.rolls, rng);
  if (result.type === "cube" && result.tierMax != null) {
    const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
    const cube = allCubes[Math.floor(rng() * allCubes.length)];
    const tier = 1 + Math.floor(rng() * Math.min(3, result.tierMax));
    cubeKey = `${cube.id}T${tier}`;
  } else if (result.type === "equipment" && result.rarityMax) {
    const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
    const type = types[Math.floor(rng() * types.length)];
    const lootQuality = context.lootQuality ?? 0.5;
    const difficulty = context.difficulty != null ? Math.min(5, Math.max(1, context.difficulty)) : 1;
    const opts = { difficulty };
    equipmentDef = generateEquipmentItem(type, lootQuality, 0, result.rarityMax, opts);
  }

  return { goldAmount, cubeKey, equipmentDef };
}
