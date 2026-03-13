"use strict";

/**
 * Elemental Shot helpers for the test harness.
 * These operate on the harness ctx (game-like object), mutate it, and log events.
 */

const { getNearestEnemy } = require("./soul-siphon-phase2-helpers.js");
const { clamp, resolveProfile, getEffectiveMaxCharge } = require("./elemental-shot-harness.js");

function nowTick(ctx, eventLog) {
  return { time: ctx.time ?? 0, tick: eventLog.getTick() };
}

function setCurrentElement(ctx, el, eventLog) {
  ctx.elementalState = String(el || "fire");
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("element_set", { time, tick, value: ctx.elementalState });
}

function setCharge(ctx, n, eventLog) {
  ctx.elementalCharge = Math.max(0, Math.round(Number(n) || 0));
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("elemental_charge_set", { time, tick, value: ctx.elementalCharge });
}

function setNextSurgeElement(ctx, el, eventLog) {
  ctx.nextElementalSurge = String(el || "wind");
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("elemental_next_surge_set", { time, tick, value: ctx.nextElementalSurge });
}

function advanceTime(ctx, dt, eventLog) {
  ctx.time = (ctx.time || 0) + dt;
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("time_advanced", { time, tick, dt });
}

async function syncProfile(ctx, eventLog) {
  const profile = await resolveProfile(ctx);
  ctx._profile = profile;
  ctx._maxChargeEffective = getEffectiveMaxCharge(ctx, profile);
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("profile_resolved", { time, tick, formId: profile?.formId || "base", defaultElement: profile?.defaultElement || "fire" });
  return profile;
}

function logEvolutionSet(ctx, eventLog, stage, category) {
  const { time, tick } = nowTick(ctx, eventLog);
  const type = stage === "first" ? "evolution_first_set" : "evolution_second_set";
  eventLog.log(type, { time, tick, value: category });
}

function setEvolutionFirst(ctx, eventLog, category) {
  ctx.elementalShotEvolutionFirst = category;
  ctx.elementalShotEvolutionSecond = null;
  ctx._elementalShotSurgeSynced = false;
  logEvolutionSet(ctx, eventLog, "first", category);
}

function setEvolutionSecond(ctx, eventLog, category) {
  ctx.elementalShotEvolutionSecond = category;
  ctx._elementalShotSurgeSynced = false;
  logEvolutionSet(ctx, eventLog, "second", category);
}

function endSurgeIfExpired(ctx, eventLog) {
  const profile = ctx._profile;
  const defaultEl = profile?.defaultElement ?? "fire";
  if (ctx.time >= (ctx.elementalSurgeEndTime || 0) && ctx.elementalSurgeEndTime) {
    if (ctx.elementalState !== defaultEl) {
      ctx.elementalState = defaultEl;
      const { time, tick } = nowTick(ctx, eventLog);
      eventLog.log("elemental_surge_ended", { time, tick, defaultElement: defaultEl });
    }
    ctx.elementalSurgeEndTime = 0;
  }
}

function startSurgeIfReady(ctx, eventLog) {
  const profile = ctx._profile;
  const defaultEl = profile?.defaultElement ?? "fire";
  const inSurge = ctx.time < (ctx.elementalSurgeEndTime || 0);
  if (inSurge) return false;
  const maxCharge = ctx._maxChargeEffective ?? 12;
  if (ctx.elementalState === defaultEl && (ctx.elementalCharge || 0) >= maxCharge) {
    const surgeBehavior = profile?.surgeBehavior || { type: "normal", elements: ["wind", "lightning"], durationSec: 3 };
    const surgeElements = Array.isArray(surgeBehavior.elements) && surgeBehavior.elements.length > 0 ? surgeBehavior.elements : ["wind", "lightning"];
    const surgeSec = ctx.hasAttackUpgrade?.("elemental_overdrive") ? 5 : (surgeBehavior.durationSec ?? 3);
    const next = ctx.nextElementalSurge || surgeElements[0];
    ctx.elementalState = next;
    ctx.elementalSurgeEndTime = ctx.time + surgeSec;
    ctx.elementalCharge = 0;
    const idx = surgeElements.indexOf(next);
    ctx.nextElementalSurge = surgeElements[(idx + 1) % surgeElements.length] ?? surgeElements[0];
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("elemental_surge_started", { time, tick, element: next, durationSec: surgeSec });
    // Surge-start links (just log; runtime effects are tested separately via helper calls)
    if (profile?.links?.surgeStartFireExplosion && next === "fire") eventLog.log("surge_start_effect", { time, tick, effect: "fire_explosion" });
    if (profile?.links?.surgeStartWindPush && next === "wind") eventLog.log("surge_start_effect", { time, tick, effect: "wind_push" });
    if (profile?.links?.surgeStartLightningStrike && next === "lightning") eventLog.log("surge_start_effect", { time, tick, effect: "lightning_strike" });
    return true;
  }
  return false;
}

function gainChargeFromHit(ctx, eventLog, element) {
  const profile = ctx._profile;
  const defaultEl = profile?.defaultElement ?? "fire";
  const maxCharge = ctx._maxChargeEffective ?? 12;
  let gained = 0;
  if (element === defaultEl) {
    const extra = typeof ctx.getAttackUpgradeStackCount === "function" ? ctx.getAttackUpgradeStackCount("elemental_charge") : 0;
    gained = 1 + extra;
  }
  if (element === "lightning" && profile?.links?.lightningFeedsCharge) {
    gained += 1;
  }
  if (gained > 0) {
    const before = ctx.elementalCharge || 0;
    ctx.elementalCharge = Math.min(maxCharge, before + gained);
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("elemental_charge_gained", { time, tick, element, gained, before, after: ctx.elementalCharge, maxCharge });
  }
}

function applyBurn(ctx, eventLog, enemy, baseDmg) {
  const profile = ctx._profile;
  const burnMult = 1 + (ctx.getAttackUpgradeValue?.("burning_power") || 0);
  const burnDamageMult = profile?.elementalInteractions?.burnDamageMult ?? 1;
  const burnStackLimit = Math.max(1, profile?.elementalInteractions?.burnStackLimit ?? 1);
  enemy.burnUntil = ctx.time + 2;
  enemy.burnStacks = Math.min(burnStackLimit, (enemy.burnStacks || 0) + 1);
  enemy.burnDps = baseDmg * 0.2 * burnMult * burnDamageMult * (enemy.burnStacks || 1);
  enemy.burnAccum = 0;
  enemy._burnDoubledByWind = false;
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("burn_applied", { time, tick, targetId: enemy.id, stacks: enemy.burnStacks, dps: enemy.burnDps, until: enemy.burnUntil });
}

function applyWindOnHit(ctx, eventLog, enemy, baseDmg) {
  // burn interaction: double once per burn + extend duration
  if (enemy.burnUntil != null && ctx.time < enemy.burnUntil) {
    if (!enemy._burnDoubledByWind) {
      enemy.burnDps = (enemy.burnDps || 0) * 2;
      enemy._burnDoubledByWind = true;
      const { time, tick } = nowTick(ctx, eventLog);
      eventLog.log("burn_amplified", { time, tick, targetId: enemy.id, mult: 2 });
    }
    enemy.burnUntil = enemy.burnUntil + 1;
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("burn_prolonged", { time, tick, targetId: enemy.id, seconds: 1, until: enemy.burnUntil });
  }

  // bleed
  const bleedChance = ctx.getAttackUpgradeValue?.("wind_bleed") || 0;
  if (bleedChance > 0 && ctx.random() < bleedChance) {
    enemy.bleedTimer = 3;
    enemy.bleedDps = Math.max(enemy.bleedDps || 0, baseDmg * 0.05);
    enemy.bleedAccum = 0;
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("enemy_bleeding", { time, tick, targetId: enemy.id, dps: enemy.bleedDps });
  }

  // stun (profile-driven)
  const windStun = ctx._profile?.elementalInteractions?.stunChance;
  if (windStun === 1) {
    enemy.stunUntil = ctx.time + 0.5;
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("enemy_stunned", { time, tick, targetId: enemy.id, until: enemy.stunUntil, source: "wind" });
  }

  // knockback / pull flags (just log; physics is not simulated here)
  const linkKb = ctx._profile?.links?.windKnockbackForce;
  const kb = (typeof linkKb === "number" && linkKb > 0) ? linkKb : (ctx.hasAttackUpgrade?.("wind_force") ? 120 : 0);
  if (kb > 0) {
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("wind_knockback", { time, tick, targetId: enemy.id, force: kb });
  }
  if (ctx._profile?.links?.windPullToCenter) {
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("wind_pull", { time, tick, targetId: enemy.id });
  }

  // fire explosion on wind hit link (log only)
  if (ctx._profile?.links?.fireExplosionOnWindHit) {
    const { time, tick } = nowTick(ctx, eventLog);
    const explosionDmg = Math.round(baseDmg * 0.25);
    eventLog.log("fire_explosion_triggered", { time, tick, source: "wind_link", targetId: enemy.id, damage: explosionDmg });
  }
}

function applyLightningOnHit(ctx, eventLog, enemy, baseDmg) {
  const stunChance = ctx.getAttackUpgradeValue?.("lightning_conduction") || 0;
  if (stunChance > 0 && ctx.random() < stunChance) {
    enemy.stunUntil = ctx.time + 0.5;
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("enemy_stunned", { time, tick, targetId: enemy.id, until: enemy.stunUntil, source: "lightning" });
  }

  // chain lightning to nearby enemies (deterministic: nearest order helper)
  const profile = ctx._profile;
  const chainBase = profile?.projectileMods?.lightningChainCountBase ?? 2;
  const chainExtra = ctx.getAttackUpgradeStackCount?.("chain_lightning") || 0;
  let chainCount = chainBase + chainExtra;
  if (ctx.hasAttackUpgrade?.("superstorm") && ctx.elementalState === "lightning" && ctx.time < (ctx.elementalSurgeEndTime || 0)) {
    chainCount *= 2;
  }
  const exclude = new Set([enemy.id]);
  const chainDmg = Math.round(baseDmg * 0.4);
  for (let i = 0; i < chainCount; i++) {
    const next = getNearestEnemy(ctx, enemy.position.x, enemy.position.y, 150, null, exclude);
    if (!next) break;
    exclude.add(next.id);
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("projectile_chained", { time, tick, fromId: enemy.id, toId: next.id, damage: chainDmg });
  }

  // burn detonate
  const det = profile?.elementalInteractions;
  if (det?.burnDetonate && enemy.burnUntil != null && ctx.time < enemy.burnUntil) {
    const detonateMult = 1 + (ctx.getAttackUpgradeValue?.("detonation_boost") || 0);
    const detDmg = Math.round(baseDmg * detonateMult);
    const { time, tick } = nowTick(ctx, eventLog);
    eventLog.log("burn_detonated", { time, tick, targetId: enemy.id, damage: detDmg, consumed: !!det.burnConsumedOnDetonate });
    if (det.burnConsumedOnDetonate) {
      enemy.burnUntil = null;
      enemy.burnDps = 0;
      enemy.burnAccum = 0;
      enemy.burnStacks = 0;
    }
  }
}

function trySpawnStorm(ctx, eventLog, x, y, baseDmg) {
  const env = ctx._profile?.environment;
  if (!env?.spawnStorm) return;
  if ((ctx.elementalStorms || []).length >= 6) return;
  ctx.elementalStorms.push({
    x,
    y,
    radius: 120,
    endTime: ctx.time + 3,
    tickInterval: 0.4,
    nextTickAt: ctx.time + 0.4,
    baseDamage: baseDmg || 0,
    stormSlow: !!env.stormSlow
  });
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("storm_spawned", { time, tick, x, y });
}

function trySpawnSwirl(ctx, eventLog, x, y) {
  const env = ctx._profile?.environment;
  if (!env?.spawnSwirl) return;
  if ((ctx.elementalSwirls || []).length >= 10) return;
  ctx.elementalSwirls.push({
    x,
    y,
    radius: 40,
    endTime: ctx.time + 4,
    consumed: false
  });
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("swirl_spawned", { time, tick, x, y });
}

function updateStorms(ctx, eventLog) {
  const now = ctx.time;
  const surviving = [];
  for (const storm of ctx.elementalStorms || []) {
    if (now >= storm.endTime) continue;
    if (now >= storm.nextTickAt) {
      storm.nextTickAt += storm.tickInterval;
      const dmg = Math.max(1, Math.round((storm.baseDamage || 0) * 0.2));
      const { time, tick } = nowTick(ctx, eventLog);
      eventLog.log("storm_tick", { time, tick, damage: dmg });
      // minimal slow application
      if (storm.stormSlow) {
        for (const e of ctx.enemies || []) {
          e.slowUntil = Math.max(e.slowUntil || 0, now + 2);
          e.slowMult = Math.min(e.slowMult ?? 1, 0.7);
        }
      }
    }
    surviving.push(storm);
  }
  ctx.elementalStorms = surviving;
}

function updateSwirls(ctx) {
  const now = ctx.time;
  ctx.elementalSwirls = (ctx.elementalSwirls || []).filter((s) => now < s.endTime && !s.consumed);
}

function triggerSwirlInteraction(ctx, eventLog, element, x, y, baseDmg) {
  const env = ctx._profile?.environment;
  if (!env?.swirlFirestorm && !env?.swirlLightningSplit) return false;
  const swirls = ctx.elementalSwirls || [];
  for (const s of swirls) {
    if (s.consumed) continue;
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy > s.radius * s.radius) continue;
    const { time, tick } = nowTick(ctx, eventLog);
    if (element === "fire" && env.swirlFirestorm) {
      eventLog.log("swirl_triggered", { time, tick, swirlType: "firestorm", x: s.x, y: s.y, baseDamage: baseDmg });
      s.consumed = true;
      return true;
    }
    if (element === "lightning" && env.swirlLightningSplit) {
      eventLog.log("swirl_triggered", { time, tick, swirlType: "lightning_split", x: s.x, y: s.y, baseDamage: baseDmg });
      s.consumed = true;
      return true;
    }
  }
  return false;
}

function simulateProjectileHit(ctx, eventLog, enemy, opts = {}) {
  const profile = ctx._profile;
  const element = opts.element ?? ctx.elementalState ?? "fire";
  const baseDmg = opts.baseDamage ?? (ctx.currentStats?.attack ?? 10);
  const { time, tick } = nowTick(ctx, eventLog);
  eventLog.log("projectile_hit", { time, tick, element, targetId: enemy.id, baseDamage: baseDmg });

  // Charge / surge checks: gain charge from this hit
  gainChargeFromHit(ctx, eventLog, element);
  // Surges start only when in default state + full charge.
  startSurgeIfReady(ctx, eventLog);

  // Element interactions
  if (element === "fire") {
    applyBurn(ctx, eventLog, enemy, baseDmg);
    const ratio = profile?.projectileMods?.fireExplosionDamageRatio ?? 0.2;
    const mult = 1 + (ctx.getAttackUpgradeValue?.("fire_explosion") || 0);
    const explosionDmg = Math.round(baseDmg * ratio * mult);
    eventLog.log("fire_explosion_triggered", { time, tick, source: "fire", targetId: enemy.id, damage: explosionDmg });
    // inferno spread: log only (no AoE sim)
    if (ctx.hasAttackUpgrade?.("inferno")) {
      eventLog.log("burn_spread", { time, tick, source: "inferno", fromId: enemy.id });
    }
  } else if (element === "wind") {
    applyWindOnHit(ctx, eventLog, enemy, baseDmg);
    trySpawnSwirl(ctx, eventLog, enemy.position.x + enemy.size / 2, enemy.position.y + enemy.size / 2);
  } else if (element === "lightning") {
    applyLightningOnHit(ctx, eventLog, enemy, baseDmg);
    trySpawnStorm(ctx, eventLog, enemy.position.x + enemy.size / 2, enemy.position.y + enemy.size / 2, baseDmg);
  }
}

function stepEnvironment(ctx, eventLog, dt) {
  advanceTime(ctx, dt, eventLog);
  endSurgeIfExpired(ctx, eventLog);
  updateStorms(ctx, eventLog);
  updateSwirls(ctx);
}

module.exports = {
  setCurrentElement,
  setCharge,
  setNextSurgeElement,
  setEvolutionFirst,
  setEvolutionSecond,
  syncProfile,
  simulateProjectileHit,
  triggerSwirlInteraction,
  stepEnvironment,
  updateStorms,
  updateSwirls,
  startSurgeIfReady,
  endSurgeIfExpired,
  gainChargeFromHit
};

