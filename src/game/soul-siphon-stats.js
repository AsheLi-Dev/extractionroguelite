/**
 * Soul Siphon stat formulas (beam geometry, damage mult, attack speed, CDR).
 * Single source of truth for derived values; used by game runtime and attack test harness.
 *
 * Context shape:
 * - getStack(id: string): number
 * - runSoulsTotal: number
 * - soulSiphonChannelTime: number
 * Optional for attack speed: getAttackUpgradeValue(id), getAttackPenaltyValue(id), equipmentAttackSpeedMult, etc.
 */

const BASE_LENGTH = 200;
const BASE_WIDTH = 80;

/**
 * Compute beam length, width, and damage multiplier from upgrade stacks and channel time.
 * @param {object} ctx - { getStack(id), runSoulsTotal, soulSiphonChannelTime }
 * @param {number} baseDamageMult - e.g. 0.8 for base beam
 * @returns {{ length: number, width: number, damageMult: number }}
 */
export function computeSoulSiphonBeamStats(ctx, baseDamageMult) {
  const getStack = (id) => (typeof ctx.getAttackUpgradeStackCount === "function" ? ctx.getAttackUpgradeStackCount(id) : (ctx.getStack ? ctx.getStack(id) : 0));

  const longReachStacks = getStack("long_reach");
  const wideSiphonStacks = getStack("wide_siphon");
  const condensedStacks = getStack("condensed_beam");
  const chargingStacks = getStack("charging_beam");
  const soulPressureStacks = getStack("soul_pressure");
  const devouringStacks = getStack("devouring_beam");
  const focusedStacks = getStack("focused_channel");
  const t = ctx.soulSiphonChannelTime ?? 0;
  const souls = ctx.runSoulsTotal ?? 0;

  let length = BASE_LENGTH * (1 + 0.15 * longReachStacks);
  let width = BASE_WIDTH * (1 + 0.15 * wideSiphonStacks) + 16 * condensedStacks;

  if (chargingStacks > 0 && t > 0) {
    const growthPerSec = 0.025 * chargingStacks;
    const maxGrowth = 0.25 * chargingStacks;
    const growth = Math.min(maxGrowth, growthPerSec * t);
    length *= 1 + growth;
    width *= 1 + growth;
  }

  let damageMult = baseDamageMult;
  if (soulPressureStacks > 0) damageMult *= 1 + 0.12 * soulPressureStacks;
  if (condensedStacks > 0) damageMult *= 1 + 0.08 * condensedStacks;
  if (devouringStacks > 0) {
    const bonus = 0.005 * souls * devouringStacks;
    damageMult *= 1 + bonus;
  }
  if (focusedStacks > 0 && t > 0) {
    const rampPerSec = 0.15 * focusedStacks;
    const maxRamp = 0.45 * focusedStacks;
    const ramp = Math.min(maxRamp, rampPerSec * t);
    damageMult *= 1 + ramp;
  }

  return { length, width, damageMult };
}

/**
 * Soul Siphon attack speed multiplier (procs per second). Uses only upgrade stacks for harness.
 * @param {object} ctx - getStack(id), optional getAttackUpgradeValue, getAttackPenaltyValue
 */
export function computeSoulSiphonAttackSpeedMult(ctx) {
  const getStack = (id) => (typeof ctx.getAttackUpgradeStackCount === "function" ? ctx.getAttackUpgradeStackCount(id) : (ctx.getStack ? ctx.getStack(id) : 0));
  let atkSpdMult = ctx.equipmentAttackSpeedMult ?? 1;
  const rhythmicStacks = getStack("rhythmic_siphon");
  if (rhythmicStacks > 0) atkSpdMult *= 1 + 0.08 * rhythmicStacks;
  const attackSpeedVal = (typeof ctx.getAttackUpgradeValue === "function" ? ctx.getAttackUpgradeValue("attackSpeed") : 0) || 0;
  const speedPenaltyVal = (typeof ctx.getAttackPenaltyValue === "function" ? ctx.getAttackPenaltyValue("speedPenalty") : 0) || 0;
  atkSpdMult *= 1 + attackSpeedVal - speedPenaltyVal;
  return Math.max(0.1, atkSpdMult);
}

/**
 * Soul Mastery: CDR fraction from souls (0..0.75). 1% per 8 souls per stack.
 * @param {object} ctx - getStack(id), runSoulsTotal
 */
export function computeSoulMasteryCdrPct(ctx) {
  const getStack = (id) => (typeof ctx.getAttackUpgradeStackCount === "function" ? ctx.getAttackUpgradeStackCount(id) : (ctx.getStack ? ctx.getStack(id) : 0));
  const stacks = getStack("soul_mastery");
  if (stacks <= 0) return 0;
  const souls = ctx.runSoulsTotal ?? 0;
  return Math.min(0.75, Math.floor(souls / 8) * 0.01 * stacks);
}

/**
 * Twin Siphon: each split beam width multiplier (0.65 = 35% reduced).
 */
export const TWIN_SIPHON_WIDTH_MULT = 0.65;

/**
 * Base beam dimensions for tests.
 */
export { BASE_LENGTH, BASE_WIDTH };
