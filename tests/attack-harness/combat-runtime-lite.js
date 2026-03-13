"use strict";

/**
 * Combat-runtime-lite: headless projectile stepping for attack tests.
 * - Reuses production PlayerProjectile (update, intersects, isExpired).
 * - Minimal combat state: time, projectiles, enemies, storms, swirls.
 * - Step loop: advance time, update projectiles, detect hits, call existing
 *   Elemental Shot post-hit helpers (simulateProjectileHit), update storms/swirls.
 * - No DOM, no canvas, no full Game. Deterministic when ctx.random is seeded.
 */

const { getNearestEnemy } = require("./soul-siphon-phase2-helpers.js");
const {
  simulateProjectileHit,
  endSurgeIfExpired,
  updateStorms,
  updateSwirls,
  triggerSwirlInteraction
} = require("./elemental-shot-helpers.js");

let _PlayerProjectile = null;

async function loadPlayerProjectile() {
  if (_PlayerProjectile) return _PlayerProjectile;
  const mod = await import("../../src/entities/projectile.js");
  _PlayerProjectile = mod.PlayerProjectile;
  return _PlayerProjectile;
}

/**
 * Ensure ctx has combat-runtime fields and game-like interface for PlayerProjectile.
 * - projectiles: []
 * - getNearestEnemy(px, py, radius, exclude) for homing
 * - hasUpgradeCard(id) for homing card (default false)
 * - hasAttackUpgrade(id) from harness upgrades
 */
function ensureCombatRuntime(ctx, opts = {}) {
  if (!ctx.projectiles) ctx.projectiles = [];
  if (ctx.pendingMeteors == null) ctx.pendingMeteors = [];

  if (typeof ctx.getNearestEnemy !== "function") {
    ctx.getNearestEnemy = function getNearestEnemyStub(cx, cy, maxDist, exclude = null) {
      const excludeSet = exclude instanceof Set ? exclude : null;
      const excludeSingle = exclude && !excludeSet ? exclude : null;
      const excludeId = excludeSingle ? excludeSingle.id : null;
      return getNearestEnemy(ctx, cx, cy, maxDist, excludeId, excludeSet);
    };
  }

  if (typeof ctx.hasUpgradeCard !== "function") {
    ctx.hasUpgradeCard = opts.hasUpgradeCard || (() => false);
  }

  return ctx;
}

/**
 * Spawn a PlayerProjectile and push to ctx.projectiles. Logs projectile_spawned.
 * Options: elementalState, piercesRemaining, forceHoming, bounceOffWalls, maxDistMult, etc.
 */
async function spawnProjectile(ctx, eventLog, x, y, targetX, targetY, damage, options = {}) {
  const P = await loadPlayerProjectile();
  const proj = new P(x, y, targetX, targetY, damage, {
    elementalState: options.elementalState ?? ctx.elementalState ?? "fire",
    piercesRemaining: options.piercesRemaining ?? 2,
    forceHoming: options.forceHoming ?? false,
    bounceOffWalls: options.bounceOffWalls ?? false,
    maxDistMult: options.maxDistMult,
    maxDistAbs: options.maxDistAbs,
    ...options
  });
  ctx.projectiles.push(proj);
  const tick = eventLog.getTick ? eventLog.getTick() : 0;
  eventLog.log("projectile_spawned", {
    time: ctx.time ?? 0,
    tick,
    x,
    y,
    targetX,
    targetY,
    element: proj.elementalState,
    damage: proj.damage
  });
  return proj;
}

/**
 * Apply direct damage to enemy and optionally mark dead. No elemental effects here.
 */
function applyProjectileDamageToEnemy(enemy, damage) {
  const h = (enemy.health ?? enemy.maxHealth ?? 100) - damage;
  enemy.health = Math.max(0, h);
  if (enemy.health <= 0) enemy.isDead = true;
}

/**
 * Check if projectile center is inside any non-consumed swirl; trigger and optionally spawn splits.
 */
async function checkProjectileSwirls(ctx, eventLog, proj) {
  const env = ctx._profile?.environment;
  if (!env?.swirlFirestorm && !env?.swirlLightningSplit) return false;
  const swirls = ctx.elementalSwirls || [];
  const px = proj.position.x + (proj.size || 8) / 2;
  const py = proj.position.y + (proj.size || 8) / 2;
  for (const s of swirls) {
    if (s.consumed) continue;
    const dx = px - s.x;
    const dy = py - s.y;
    if (dx * dx + dy * dy > s.radius * s.radius) continue;
    const baseDmg = proj.damage ?? 0;
    const triggered = triggerSwirlInteraction(ctx, eventLog, proj.elementalState, px, py, baseDmg);
    if (triggered && proj.elementalState === "lightning" && env.swirlLightningSplit) {
      const spread = Math.PI / 4;
      for (const angle of [Math.PI / 2 - spread, Math.PI / 2 + spread]) {
        const tx = s.x + Math.cos(angle) * 200;
        const ty = s.y + Math.sin(angle) * 200;
        await spawnProjectile(ctx, eventLog, s.x, s.y, tx, ty, Math.max(1, Math.round(baseDmg * 0.6)), {
          elementalState: "lightning",
          piercesRemaining: proj.piercesRemaining,
          forceHoming: false
        });
      }
      eventLog.log("projectile_split", { time: ctx.time, tick: eventLog.getTick(), x: s.x, y: s.y, count: 2 });
    }
    return true;
  }
  return false;
}

/**
 * Step combat runtime: advance time, update projectiles, hits, storms, swirls. Deterministic if ctx.random is seeded.
 */
async function stepCombatRuntimeLite(ctx, dt, eventLog) {
  const origRandom = Math.random;
  if (typeof ctx.random === "function") {
    Math.random = ctx.random;
  }

  try {
    ctx.time = (ctx.time ?? 0) + dt;
    ctx.dt = dt;

    ensureCombatRuntime(ctx);

    const toAdd = [];
    const surviving = [];

    for (const proj of ctx.projectiles) {
      proj._spawn = null;
      proj.update(dt, ctx);

      if (proj._spawn) toAdd.push(...proj._spawn);
      if (proj.isExpired()) {
        eventLog.log("projectile_expired", {
          time: ctx.time,
          tick: eventLog.getTick(),
          x: proj.position.x,
          y: proj.position.y,
          reason: "range_or_lifetime"
        });
        continue;
      }
      if (proj._spawn) continue;

      const px = proj.position.x + (proj.size || 8) / 2;
      const py = proj.position.y + (proj.size || 8) / 2;
      eventLog.log("projectile_moved", { time: ctx.time, tick: eventLog.getTick(), x: proj.position.x, y: proj.position.y });

      let swirlConsumed = false;
      if (proj.elementalState === "fire" || proj.elementalState === "lightning") {
        swirlConsumed = await checkProjectileSwirls(ctx, eventLog, proj);
      }
      if (swirlConsumed) {
        surviving.push(proj);
        continue;
      }

      let hit = false;
      for (const enemy of ctx.enemies || []) {
        if (enemy.isDead || proj.hitEnemyIds.has(enemy.id)) continue;
        if (!proj.intersects(enemy)) continue;

        hit = true;
        proj.hitEnemyIds.add(enemy.id);
        const damageMult = proj.currentDamageMult != null ? proj.currentDamageMult : 1;
        const useDmg = Math.round((proj.damage ?? 0) * damageMult);
        applyProjectileDamageToEnemy(enemy, useDmg);
        simulateProjectileHit(ctx, eventLog, enemy, {
          element: proj.elementalState,
          baseDamage: proj.damage ?? useDmg
        });

        if (proj.piercesRemaining != null) {
          proj.piercesRemaining--;
          if (proj.piercesRemaining <= 0) {
            eventLog.log("projectile_expired", {
              time: ctx.time,
              tick: eventLog.getTick(),
              x: proj.position.x,
              y: proj.position.y,
              reason: "pierce_exhausted"
            });
            break;
          }
        }
        break;
      }

      if (!hit) surviving.push(proj);
    }

    ctx.projectiles = surviving.concat(toAdd);

    endSurgeIfExpired(ctx, eventLog);
    updateStorms(ctx, eventLog);
    updateSwirls(ctx);
  } finally {
    Math.random = origRandom;
  }
}


module.exports = {
  ensureCombatRuntime,
  spawnProjectile,
  stepCombatRuntimeLite,
  loadPlayerProjectile
};
