"use strict";

/**
 * Elemental Shot – headless deterministic harness.
 * Mirrors the "Soul Siphon" harness style: minimal ctx + seeded RNG + structured event log.
 *
 * Goals:
 * - simulate hits that drive charge/surge
 * - apply elemental on-hit interactions (burn, wind, lightning)
 * - simulate storms/swirls (spawn + tick + trigger)
 * - keep it deterministic and fast
 *
 * NOTE: This is not a full projectile/hitbox engine. Tests call "simulateProjectileHit".
 */

const { createEventLog } = require("./attack-event-log.js");
const { createSeededRandom, createMinimalPlayer, createMinimalEnemy } = require("./attack-test-harness.js");

// Lazy ESM imports (Node test runner friendly)
let _evo;
let _levelUp;
async function getEvolutionModule() {
  if (!_evo) _evo = await import("../../src/data/elemental-shot-evolution.js");
  return _evo;
}
async function getLevelUpModule() {
  if (!_levelUp) _levelUp = await import("../../src/data/level-up-data.js");
  return _levelUp;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function createUpgradeAccessors(runAttackUpgrades = []) {
  const getStack = (id) => {
    const entry = runAttackUpgrades.find((u) => u.id === id);
    if (!entry) return 0;
    const level = Number(entry.level);
    return Number.isFinite(level) && level > 0 ? level : 1;
  };

  const hasUpgrade = (id) => runAttackUpgrades.some((u) => u.id === id);

  // Percent values in data are authored as "10" meaning +10% => 0.10.
  // Integer values are authored as "2" meaning +2.
  const getValue = (id) => {
    const entry = runAttackUpgrades.find((u) => u.id === id);
    if (!entry) return 0;
    if (Number.isFinite(entry.value)) return Number(entry.value);
    // fallback: derive from defs
    const level = getStack(id);
    const def = entry.def || null;
    if (def?.valueRange?.percent) return (Number(def.valueRange.min) / 100) * level;
    if (def?.valueRange?.integer) return Number(def.valueRange.min) * level;
    if (def?.valueRange && !def.valueRange.percent && !def.valueRange.integer) {
      return Number(def.valueRange.min) * level;
    }
    return 0;
  };

  return {
    getAttackUpgradeStackCount: getStack,
    getStack,
    hasAttackUpgrade: hasUpgrade,
    hasUpgrade,
    getAttackUpgradeValue: getValue,
    getValue
  };
}

async function attachUpgradeDefs(ctx) {
  const levelUp = await getLevelUpModule();
  const defs = levelUp.ATTACK_UPGRADE_DEFS?.elementalShot?.standardUpgrades || [];
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const u of ctx.runAttackUpgrades || []) {
    if (!u.def) u.def = byId.get(u.id) || null;
  }
  return ctx;
}

async function resolveProfile(ctx) {
  const evo = await getEvolutionModule();
  const state = evo.getElementalShotEvolutionState(ctx);
  return evo.getElementalShotProfile(state);
}

function getEffectiveMaxCharge(ctx, profile) {
  const base = profile?.surgeChargeRequired != null ? profile.surgeChargeRequired : (ctx.maxElementalCharge ?? 12);
  const reduce = (ctx.getAttackUpgradeStackCount?.("faster_charge") || 0) * 2;
  return Math.max(2, base - reduce);
}

/**
 * Create a deterministic Elemental Shot test context.
 * runAttackUpgrades: [{ id, level?, value? }]
 * evolution: { first, second }
 */
async function createElementalShotTestContext(opts = {}) {
  const seed = opts.seed ?? 12345;
  const random = opts.random ?? createSeededRandom(seed);
  const runAttackUpgrades = opts.runAttackUpgrades ?? [];

  const upgrades = createUpgradeAccessors(runAttackUpgrades);
  const ctx = {
    // minimal "game-like" state
    attackType: "projectile",
    time: opts.time ?? 0,
    player: opts.player ?? createMinimalPlayer(opts.player),
    currentStats: opts.currentStats ?? { attack: 10, maxHealth: 100 },
    runAttackUpgrades,
    random,

    // Elemental Shot runtime state
    elementalShotEvolutionFirst: opts.first ?? opts.evolution?.first ?? null,
    elementalShotEvolutionSecond: opts.second ?? opts.evolution?.second ?? null,
    elementalState: opts.elementalState ?? "fire",
    elementalCharge: opts.elementalCharge ?? 0,
    maxElementalCharge: opts.maxElementalCharge ?? 12,
    elementalSurgeEndTime: opts.elementalSurgeEndTime ?? 0,
    nextElementalSurge: opts.nextElementalSurge ?? "wind",

    // Environment
    elementalStorms: [],
    elementalSwirls: [],

    // enemy set for helper functions
    enemies: opts.enemies ?? [],

    ...upgrades
  };

  await attachUpgradeDefs(ctx);

  // Sync to profile defaults unless caller explicitly pinned a non-default element.
  const profile = await resolveProfile(ctx);
  if (opts.elementalState == null) {
    ctx.elementalState = profile?.defaultElement ?? "fire";
  }
  if (opts.nextElementalSurge == null) {
    const sb = profile?.surgeBehavior?.elements;
    if (Array.isArray(sb) && sb[0]) ctx.nextElementalSurge = sb[0];
  }
  ctx._profile = profile;
  ctx._maxChargeEffective = getEffectiveMaxCharge(ctx, profile);
  return ctx;
}

function createTestDummy(id, opts = {}) {
  return createMinimalEnemy({
    id,
    x: opts.x ?? 400,
    y: opts.y ?? 180,
    size: opts.size ?? 24,
    maxHealth: opts.maxHealth ?? 999,
    health: opts.health ?? (opts.maxHealth ?? 999),
    // debuffs used by elemental shot
    burnUntil: opts.burnUntil ?? null,
    burnDps: opts.burnDps ?? 0,
    burnStacks: opts.burnStacks ?? 0,
    burnAccum: 0,
    slowUntil: 0,
    slowMult: 1,
    stunUntil: 0,
    bleedTimer: 0,
    bleedDps: 0,
    bleedAccum: 0,
    knockbackVelocity: { x: 0, y: 0 },
    _burnDoubledByWind: opts._burnDoubledByWind ?? false
  });
}

module.exports = {
  createElementalShotTestContext,
  createTestDummy,
  createEventLog,
  resolveProfile,
  getEffectiveMaxCharge,
  clamp
};

