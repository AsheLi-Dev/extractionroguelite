// -------- Weapon / equipment upgrade system: costs, cube values, stat scaling --------
// Upgrade level 0..5; cost is cube VALUE (T1=1, T2=2, T3=5). Applies to Weapon, Helmet, Body Armour, Boots.

/** Cube value per tier. Keys match cube key suffix e.g. "T1", "T2", "T3". */
export const CUBE_TIER_VALUES = {
  1: 1,
  2: 2,
  3: 5
};

/** Cost in cube value to upgrade from level (index) to level (index+1). Same for all equipment. */
export const WEAPON_UPGRADE_COSTS = [3, 5, 10, 15, 25];

/** Maximum upgrade level (0 = no upgrade, 5 = max) for any equipment. */
export const MAX_WEAPON_UPGRADE_LEVEL = 5;

/** Stat scaling per upgrade level: effectiveStat = originalBaseStat * (1 + STAT_SCALING_PER_LEVEL * level). */
export const STAT_SCALING_PER_LEVEL = 0.1;

/** Weapon base stat keys that scale with upgrade level. */
export const WEAPON_UPGRADE_STAT_KEYS = ["attack", "attackSpeed"];

/** Per-equipment-type stat keys that scale with upgrade level (baseStat keys). */
export const EQUIPMENT_UPGRADE_STAT_KEYS = {
  Weapon: ["attack", "attackSpeed"],
  Helmet: ["maxHealth", "defense"],
  "Body Armour": ["defense", "maxHealth"],
  Boots: ["speed"]
};

/**
 * Cost in cube value to upgrade from `fromLevel` to `fromLevel + 1`.
 * @param {number} fromLevel - Current upgrade level (0..4).
 * @returns {number} Cost, or 0 if already at max.
 */
export function getUpgradeCostForLevel(fromLevel) {
  if (fromLevel < 0 || fromLevel >= MAX_WEAPON_UPGRADE_LEVEL) return 0;
  return WEAPON_UPGRADE_COSTS[fromLevel] ?? 0;
}

/**
 * Get cube value for a single cube key (e.g. "attackCubeT1" -> 1, "magicCubeT3" -> 5).
 * @param {string} cubeKey - Key like "idT1", "idT2", "idT3". Legendary cubes (no tier) are not used for weapon upgrade.
 * @returns {number} Value 1, 2, or 5 for T1/T2/T3; 0 for unknown/legendary.
 */
export function getCubeValueFromKey(cubeKey) {
  if (typeof cubeKey !== "string") return 0;
  const normalized = cubeKey.replace(/^socketCube/, "vesselCube");
  const match = normalized.match(/T(\d)$/);
  if (!match) return 0;
  const tier = parseInt(match[1], 10);
  return CUBE_TIER_VALUES[tier] ?? 0;
}

/**
 * Total cube value available from inventory (object of cubeKey -> count).
 * Only T1/T2/T3 cubes count; legendary cubes do not contribute.
 * @param {Record<string, number>} cubeInventory
 * @returns {number}
 */
export function getTotalCubeValue(cubeInventory) {
  if (!cubeInventory || typeof cubeInventory !== "object") return 0;
  let total = 0;
  for (const [key, count] of Object.entries(cubeInventory)) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n > 0) total += getCubeValueFromKey(key) * n;
  }
  return total;
}

/**
 * Build list of { key, value, count } for all cubes that have upgrade value, for spending.
 * @param {Record<string, number>} cubeInventory
 * @returns {{ key: string, value: number, count: number }[]}
 */
function getSpendableCubes(cubeInventory) {
  if (!cubeInventory || typeof cubeInventory !== "object") return [];
  const list = [];
  for (const [key, count] of Object.entries(cubeInventory)) {
    const value = getCubeValueFromKey(key);
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (value > 0 && n > 0) list.push({ key, value, count: n });
  }
  return list;
}

/**
 * Find a deterministic way to pay exactly `cost` or the smallest overpay.
 * Uses DP: possible[value] = true if we can form that value; then backtrack to get one solution.
 * Consumes higher-tier cubes first when multiple solutions exist (deterministic).
 * @param {Record<string, number>} cubeInventory
 * @param {number} cost - Required cube value.
 * @returns {{ success: boolean, toDeduct: Record<string, number>, totalPaid: number }}
 */
export function spendCubesToPay(cubeInventory, cost) {
  const toDeduct = {};
  if (cost <= 0) return { success: true, toDeduct, totalPaid: 0 };

  const list = getSpendableCubes(cubeInventory);
  const totalAvail = list.reduce((s, c) => s + c.value * c.count, 0);
  if (totalAvail < cost) return { success: false, toDeduct, totalPaid: 0 };

  // Sort by value descending (T3, T2, T1) for deterministic order
  list.sort((a, b) => b.value - a.value);

  // DP: max value we need is cost (exact) or a bit more for minimal overpay (up to totalAvail)
  const maxVal = Math.min(cost + 50, totalAvail + 1);
  const possible = new Array(maxVal + 1).fill(false);
  const used = new Array(maxVal + 1).fill(null);
  possible[0] = true;
  used[0] = [];

  for (const { key, value, count } of list) {
    for (let n = maxVal; n >= 0; n--) {
      if (!possible[n]) continue;
      for (let c = 1; c <= count; c++) {
        const next = n + value * c;
        if (next <= maxVal && !possible[next]) {
          possible[next] = true;
          used[next] = [...(used[n] || []), { key, count: c }];
        }
      }
    }
  }

  let payAmount = cost;
  if (!possible[cost]) {
    for (let v = cost + 1; v <= maxVal; v++) {
      if (possible[v]) {
        payAmount = v;
        break;
      }
    }
  }

  if (!possible[payAmount]) return { success: false, toDeduct, totalPaid: 0 };

  const combo = used[payAmount] || [];
  for (const { key, count } of combo) {
    toDeduct[key] = (toDeduct[key] || 0) + count;
  }
  return { success: true, toDeduct, totalPaid: payAmount };
}

/**
 * Compute effective stat from original base stat and upgrade level (weapons and all equipment).
 * effectiveStat = originalBaseStat * (1 + STAT_SCALING_PER_LEVEL * upgradeLevel)
 * @param {number} originalBaseStat
 * @param {number} upgradeLevel
 * @param {boolean} [round=true] - If true, round result (e.g. for attack, armour).
 * @returns {number}
 */
export function getEffectiveWeaponStat(originalBaseStat, upgradeLevel, round = true) {
  const level = Math.max(0, Math.min(MAX_WEAPON_UPGRADE_LEVEL, Number(upgradeLevel) || 0));
  const mult = 1 + STAT_SCALING_PER_LEVEL * level;
  const value = (Number(originalBaseStat) || 0) * mult;
  return round ? Math.round(value) : value;
}

/** Alias for use with any equipment type. */
export const getEffectiveEquipmentStat = getEffectiveWeaponStat;
