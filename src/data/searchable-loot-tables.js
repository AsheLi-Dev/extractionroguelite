// -------- Searchable prop loot tables --------
// Gold always; cubeChance and equipmentChance per table.

import { generateEquipmentItem } from "./loot-data.js";
import { MODIFIER_CUBES, UPGRADE_CUBES } from "./cubes-data.js";

export const SEARCHABLE_LOOT_TABLES = {
  crate_basic: {
    gold: { min: 5, max: 15 },
    cubeChance: 0.1,
    equipmentChance: 0.01,
  },
  locker_basic: {
    gold: { min: 8, max: 20 },
    cubeChance: 0.2,
    equipmentChance: 0.03,
  },
  dead_warrior: {
    gold: { min: 10, max: 25 },
    cubeChance: 0.15,
    equipmentChance: 0.05,
  },
  chest_basic: {
    gold: { min: 12, max: 30 },
    cubeChance: 0.2,
    equipmentChance: 0.06,
  },
};

/**
 * Roll loot for a searchable prop. Spawns via game.lootSystem.
 * @param {string} tableId - key in SEARCHABLE_LOOT_TABLES
 * @param {number} centerX - world X for drops
 * @param {number} centerY - world Y for drops
 * @param {Object} game - game instance (for lootSystem, currentMap, difficulty)
 * @param {number} lootMultiplier - number of independent loot rolls
 */
export function rollSearchableLoot(tableId, centerX, centerY, game, lootMultiplier = 1) {
  const table = SEARCHABLE_LOOT_TABLES[tableId];
  if (!table || !game?.lootSystem) return;

  const fullRolls = Math.max(0, Math.floor(lootMultiplier));
  const partialChance = Math.max(0, Math.min(1, lootMultiplier - fullRolls));
  const rolls = fullRolls + (Math.random() < partialChance ? 1 : 0);
  const rollCount = Math.max(1, rolls);
  for (let i = 0; i < rollCount; i++) {
    const ox = rollCount > 1 ? (Math.random() - 0.5) * 18 : 0;
    const oy = rollCount > 1 ? (Math.random() - 0.5) * 18 : 0;
    const x = centerX + ox;
    const y = centerY + oy;

    const goldMin = table.gold.min;
    const goldMax = table.gold.max;
    const goldAmount = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1));
    if (goldAmount > 0) game.lootSystem.spawnGoldAt(x, y, goldAmount);

    if (Math.random() < table.cubeChance) {
      const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
      const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
      const tier = 1 + Math.floor(Math.random() * 2);
      game.lootSystem.spawnCubeAt(x, y, `${cube.id}T${tier}`);
    }

    if (Math.random() < table.equipmentChance) {
      const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
      const type = types[Math.floor(Math.random() * types.length)];
      const lootQuality = game.currentMap?.lootQuality ?? 0.5;
      const difficulty = game.difficulty != null ? Math.min(5, Math.max(1, game.difficulty)) : 1;
      const luck = Math.max(0, Number(game?.runCharacterAttributes?.luck ?? game?.runConfig?.selectedCharacter?.attributes?.luck) || 0);
      const def = generateEquipmentItem(type, lootQuality, 0, null, { difficulty, luck });
      game.lootSystem.spawnEquipmentAt(x, y, def);
    }
  }
}
