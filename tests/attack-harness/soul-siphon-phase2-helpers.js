"use strict";

/**
 * Phase 2 helpers for Soul Siphon tests: Spirit assist, chest open, evolution hook, XP.
 * Uses same constants as game; no rendering.
 */

const SPIRIT_FIREBALL_CHANCE_MIN = 0.45;
const SPIRIT_FIREBALL_CHANCE_MAX = 0.8;
const SPIRIT_REFLEX_REDUCTION_PER_STACK = 0.35;
const SPIRIT_OVERLOAD_CHANCE = 0.2;
const SPIRIT_OVERLOAD_ICD = 0.6;
const CHEST_SPIRITS_CHANCE_PER_STACK = 0.12;
const SPIRITUAL_RESONANCE_SOULS_PER_STACK = 8;
const ANCIENT_SPIRIT_XP_MULT = 0.4;
const SOULS_TO_SUMMON_SPIRIT = 10;

/**
 * Find nearest live enemy from (cx, cy) within range.
 * excludeId: single id to exclude; excludeSet: Set of ids to exclude (6th param for chain lightning).
 */
function getNearestEnemy(ctx, cx, cy, range, excludeId = null, excludeSet = null) {
  let best = null;
  let bestD = range * range;
  for (const e of ctx.enemies || []) {
    if (e.isDead || e.id === excludeId) continue;
    if (excludeSet && excludeSet.has(e.id)) continue;
    const ex = e.position.x + (e.size || 24) / 2;
    const ey = e.position.y + (e.size || 24) / 2;
    const d = (ex - cx) ** 2 + (ey - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * Simulate one Spirit assist action. Game: ground 45%, fireball 35%, speed 20%.
 * Logs spirit_ability_triggered, projectile_spawned (for fireballs), cooldown_reduced (Spirit Reflex).
 * Returns { projectilesSpawned, cooldownReduced, abilityType }.
 */
function simulateSpiritAssist(ctx, eventLog) {
  const r = ctx.random();
  const tick = eventLog.getTick ? eventLog.getTick() : 0;
  let projectilesSpawned = 0;
  let cooldownReduced = 0;

  const abilityType = r < 0.45 ? "ground" : r < 0.8 ? "fireball" : "speed";
  eventLog.log("spirit_ability_triggered", { abilityType, tick });

  if (abilityType === "fireball") {
    const twinStacks = ctx.getStack ? ctx.getStack("twin_fireball") : 0;
    const extraFireballs = Math.min(1, twinStacks);
    const count = 1 + extraFireballs;
    projectilesSpawned = count;
    for (let i = 0; i < count; i++) {
      eventLog.log("projectile_spawned", { source: "spirit_fireball", tick, index: i });
    }
  }

  if (ctx.getStack && ctx.getStack("spirit_reflex") > 0 && Array.isArray(ctx.skillCooldowns)) {
    const stacks = ctx.getStack("spirit_reflex");
    const candidates = [];
    for (let i = 0; i < ctx.skillCooldowns.length; i++) {
      if ((ctx.skillCooldowns[i] || 0) > 0) candidates.push(i);
    }
    if (candidates.length > 0) {
      const slot = candidates[Math.floor(ctx.random() * candidates.length)];
      const before = ctx.skillCooldowns[slot] || 0;
      const reduction = SPIRIT_REFLEX_REDUCTION_PER_STACK * stacks;
      ctx.skillCooldowns[slot] = Math.max(0, before - reduction);
      cooldownReduced = Math.min(reduction, before);
      eventLog.log("cooldown_reduced", { slot, amount: cooldownReduced, tick });
    }
  }

  return { projectilesSpawned, cooldownReduced, abilityType };
}

/**
 * Simulate Ancestral Awakening: run two assist actions.
 */
function simulateSpiritAssistAncestral(ctx, eventLog) {
  const first = simulateSpiritAssist(ctx, eventLog);
  const second = simulateSpiritAssist(ctx, eventLog);
  return {
    projectilesSpawned: first.projectilesSpawned + second.projectilesSpawned,
    cooldownReduced: first.cooldownReduced + second.cooldownReduced,
    assistCount: 2
  };
}

/**
 * Simulate chest open: 12% per stack chance to grant 1 soul. Log souls_gained with source: "chest".
 */
function simulateChestOpen(ctx, eventLog) {
  const stacks = ctx.getStack ? ctx.getStack("chest_spirits") : 0;
  if (stacks <= 0) return { soulsGranted: 0 };
  const chance = Math.min(1, CHEST_SPIRITS_CHANCE_PER_STACK * stacks);
  const tick = eventLog.getTick ? eventLog.getTick() : 0;
  if (ctx.random() < chance) {
    ctx.runSoulsTotal = (ctx.runSoulsTotal || 0) + 1;
    eventLog.log("souls_gained", { amount: 1, source: "chest", tick });
    eventLog.log("chest_opened", { grantedSoul: true, tick });
    return { soulsGranted: 1 };
  }
  eventLog.log("chest_opened", { grantedSoul: false, tick });
  return { soulsGranted: 0 };
}

/**
 * Fire Soul Siphon evolution hook: grant 8 * spiritual_resonance stacks souls. Log evolution_triggered.
 */
function fireEvolutionHookSoulSiphon(ctx, eventLog) {
  const stacks = ctx.getStack ? ctx.getStack("spiritual_resonance") : 0;
  const tick = eventLog.getTick ? eventLog.getTick() : 0;
  const bonusSouls = stacks > 0 ? SPIRITUAL_RESONANCE_SOULS_PER_STACK * stacks : 0;
  if (bonusSouls > 0) {
    ctx.runSoulsTotal = (ctx.runSoulsTotal || 0) + bonusSouls;
    eventLog.log("evolution_triggered", { source: "soulSiphon", bonusSouls, tick });
    eventLog.log("souls_gained", { amount: bonusSouls, source: "evolution", tick });
  }
  return { bonusSouls };
}

/**
 * Grant XP with Ancient Spirit: if sourceTag === "spirit_source" and upgrade present, multiply by (1 + 0.4 * stacks).
 * Log xp_gained. ctx.runXpTotal is incremented (optional tracking).
 */
function grantXp(ctx, amount, sourceTag = null) {
  let finalAmount = Math.max(0, Math.round(amount));
  if (sourceTag === "spirit_source" && ctx.getStack && ctx.getStack("ancient_spirit") > 0) {
    const stacks = ctx.getStack("ancient_spirit");
    finalAmount = Math.round(finalAmount * (1 + ANCIENT_SPIRIT_XP_MULT * stacks));
  }
  if (typeof ctx.runXpTotal === "number") ctx.runXpTotal += finalAmount;
  const tick = ctx._xpTick != null ? ctx._xpTick : 0;
  if (ctx._eventLog) {
    ctx._eventLog.log("xp_gained", { amount: finalAmount, sourceTag: sourceTag || "default", tick });
  }
  return finalAmount;
}

/**
 * Check if Spirit would be summoned at current soul count (>= 10).
 */
function wouldSummonSpirit(ctx) {
  return (ctx.runSoulsTotal || 0) >= SOULS_TO_SUMMON_SPIRIT;
}

module.exports = {
  getNearestEnemy,
  simulateSpiritAssist,
  simulateSpiritAssistAncestral,
  simulateChestOpen,
  fireEvolutionHookSoulSiphon,
  grantXp,
  wouldSummonSpirit,
  SPIRIT_OVERLOAD_CHANCE,
  SPIRIT_OVERLOAD_ICD,
  SPIRIT_REFLEX_REDUCTION_PER_STACK,
  CHEST_SPIRITS_CHANCE_PER_STACK,
  SPIRITUAL_RESONANCE_SOULS_PER_STACK,
  ANCIENT_SPIRIT_XP_MULT,
  SOULS_TO_SUMMON_SPIRIT
};
