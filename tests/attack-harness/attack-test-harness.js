"use strict";

/**
 * Lightweight headless attack test harness.
 * - Seeded RNG, minimal player/enemy, harness context
 * - Beam geometry helpers (rect from direction, point-in-rect)
 * - Soul Siphon step simulator (uses provided computeBeamStats)
 * No DOM, no canvas, no full game loop.
 */

const { createEventLog } = require("./attack-event-log.js");
const { getNearestEnemy } = require("./soul-siphon-phase2-helpers.js");

// --- Seeded RNG (mulberry32) ---
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0; // 32-bit
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Minimal entities ---
function createMinimalPlayer(opts = {}) {
  return {
    position: { x: opts.x ?? 320, y: opts.y ?? 180 },
    size: opts.size ?? 24,
    ...opts
  };
}

function createMinimalEnemy(opts = {}) {
  const maxHealth = opts.maxHealth ?? 100;
  return {
    id: opts.id ?? `enemy_${Math.random().toString(36).slice(2, 9)}`,
    position: { x: opts.x ?? 400, y: opts.y ?? 180 },
    size: opts.size ?? 24,
    maxHealth,
    health: opts.health ?? maxHealth,
    sizeTier: opts.sizeTier ?? null,
    enemyTier: opts.enemyTier ?? "mob",
    isMiniBoss: opts.isMiniBoss ?? false,
    isDead: false,
    _lastHitSourceTag: opts._lastHitSourceTag ?? null,
    ...opts
  };
}

/**
 * Create a harness context for Soul Siphon tests.
 * runAttackUpgrades: array of { id, level? } (level defaults 1 for stack count).
 */
function createHarnessContext(opts = {}) {
  const runAttackUpgrades = opts.runAttackUpgrades ?? [];
  const getStack = (id) => {
    const entry = runAttackUpgrades.find((u) => u.id === id);
    if (!entry) return 0;
    const level = Number(entry.level);
    return Number.isFinite(level) && level > 0 ? level : 1;
  };
  const hasUpgrade = (id) => runAttackUpgrades.some((u) => u.id === id);

  const ctx = {
    attackType: opts.attackType ?? "soulSiphon",
    runSoulsTotal: opts.runSoulsTotal ?? 0,
    soulSiphonChannelTime: opts.soulSiphonChannelTime ?? 0,
    time: opts.time ?? 0,
    runAttackUpgrades,
    getStack,
    getAttackUpgradeStackCount: getStack,
    hasAttackUpgrade: hasUpgrade,
    getAttackUpgradeValue: () => 0,
    getAttackPenaltyValue: () => 0,
    equipmentAttackSpeedMult: 1,
    equipmentCooldownRecovery: 1,
    currentStats: opts.currentStats ?? { attack: 10, maxHealth: 100 },
    player: opts.player ?? createMinimalPlayer(opts.player),
    enemies: opts.enemies ?? [],
    cuteSpiritCompanion: opts.cuteSpiritCompanion ?? null,
    random: opts.random ?? Math.random,
    ...opts
  };
  return ctx;
}

/**
 * Beam rect from direction (same math as thrustRectFromDirection).
 * Returns { x, y, width, height } in world space.
 */
function beamRectFromDirection(px, py, dirX, dirY, length, width) {
  const startX = px;
  const startY = py;
  const endX = startX + dirX * length;
  const endY = startY + dirY * length;
  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const w = length;
  const h = width;
  return { x: centerX - w / 2, y: centerY - h / 2, width: w, height: h };
}

/**
 * Check if point (cx, cy) is inside axis-aligned rect.
 */
function pointInRect(cx, cy, rect) {
  return (
    cx >= rect.x &&
    cx <= rect.x + rect.width &&
    cy >= rect.y &&
    cy <= rect.y + rect.height
  );
}

/**
 * Souls granted per kill by enemy (mirrors getSoulsForEnemy).
 */
function getSoulsForEnemy(enemy) {
  if (!enemy) return 0;
  const tier = enemy.sizeTier;
  if (tier === "small") return 1;
  if (tier === "medium") return 2;
  if (tier === "large") return 4;
  const hp = enemy.maxHealth ?? 0;
  if (hp < 50) return 1;
  if (hp < 95) return 2;
  return 4;
}

/**
 * Run one Soul Siphon beam step: compute beam, resolve hits, apply damage, log events.
 * computeBeamStats(ctx, baseDamageMult) -> { length, width, damageMult }.
 * Mutates ctx.enemies (health, isDead), ctx.runSoulsTotal, ctx.cuteSpiritCompanion.charge.
 */
function stepSoulSiphonBeam(ctx, eventLog, opts = {}) {
  const computeBeamStats = opts.computeBeamStats;
  if (typeof computeBeamStats !== "function") throw new Error("opts.computeBeamStats required");

  const baseDamageMult = opts.baseDamageMult ?? 0.8;
  const playerAttack = ctx.currentStats?.attack ?? 10;
  const { length, width, damageMult } = computeBeamStats(ctx, baseDamageMult);
  const px = ctx.player.position.x + ctx.player.size / 2;
  const py = ctx.player.position.y + ctx.player.size / 2;
  const dirX = opts.dirX ?? 1;
  const dirY = opts.dirY ?? 0;
  const beamWidthMult = ctx.hasAttackUpgrade("twin_siphon") ? 0.65 : 1;

  const rect = beamRectFromDirection(px, py, dirX, dirY, length, width * beamWidthMult);
  const baseDamage = Math.max(1, Math.round(playerAttack * damageMult));

  const tick = eventLog.getTick();

  // Spirit overlap: beam charges spirit
  if (ctx.cuteSpiritCompanion) {
    const sx = ctx.cuteSpiritCompanion.position.x + (ctx.cuteSpiritCompanion.size ?? 16) / 2;
    const sy = ctx.cuteSpiritCompanion.position.y + (ctx.cuteSpiritCompanion.size ?? 16) / 2;
    const dx = sx - px;
    const dy = sy - py;
    const along = dx * dirX + dy * dirY;
    if (along >= 0 && along <= length) {
      const perpX = dx - along * dirX;
      const perpY = dy - along * dirY;
      const halfW = (width * beamWidthMult) / 2;
      if (perpX * perpX + perpY * perpY <= halfW * halfW) {
        ctx.cuteSpiritCompanion.charge = Math.min((ctx.cuteSpiritCompanion.charge ?? 0) + 1, 10);
        eventLog.log("spirit_charged", { source: "beam", tick, charge: ctx.cuteSpiritCompanion.charge });
        const conduitStacks = ctx.getStack("spiritual_conduit");
        if (conduitStacks > 0 && ctx.random() < 0.08 * conduitStacks) {
          ctx.cuteSpiritCompanion.charge = Math.min(ctx.cuteSpiritCompanion.charge + 1, 10);
          eventLog.log("spirit_charged", { source: "conduit", tick });
        }
      }
    }
  }

  // Enemy hits
  for (const enemy of ctx.enemies) {
    if (enemy.isDead) continue;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    if (!pointInRect(ex, ey, rect)) continue;

    let dmg = baseDamage;
    if (ctx.getStack("execution_drain") > 0 && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth < 0.35) {
      dmg += Math.round(baseDamage * 0.2 * ctx.getStack("execution_drain"));
    }
    if (ctx.getStack("soul_rend") > 0 && enemy.maxHealth > 0) {
      dmg += Math.round(enemy.maxHealth * 0.008 * ctx.getStack("soul_rend"));
    }

    eventLog.log("beam_hit", { targetId: enemy.id, damage: dmg, tick });
    enemy.health = Math.max(0, enemy.health - dmg);

    const now = ctx.time ?? tick;
    if (ctx.hasAttackUpgrade("spirit_overload") && ctx.cuteSpiritCompanion && (ctx._spiritOverloadIcdUntil || 0) <= now && ctx.random() < 0.2) {
      eventLog.log("spirit_overload_fireball", { tick });
      ctx._spiritOverloadIcdUntil = now + 0.6;
    }

    if (enemy.health <= 0) {
      enemy.isDead = true;
      let souls = getSoulsForEnemy(enemy);
      if (ctx.getStack("mini_boss_harvest") > 0 && (enemy.isMiniBoss || enemy.enemyTier === "miniBoss")) {
        souls += 5 * ctx.getStack("mini_boss_harvest");
      }
      if (ctx.getStack("soul_magnet") > 0 && ctx.random() < 0.08 * ctx.getStack("soul_magnet")) {
        souls += 1;
        eventLog.log("soul_magnet_extra", { tick });
      }
      ctx.runSoulsTotal = (ctx.runSoulsTotal || 0) + souls;
      eventLog.log("enemy_killed", { targetId: enemy.id, souls, tick });
      eventLog.log("souls_gained", { amount: souls, source: "kill", targetId: enemy.id, tick });
      if (ctx.getStack("restless_souls") > 0 && ctx.random() < 0.08 * ctx.getStack("restless_souls")) {
        eventLog.log("healed", { amount: 4, source: "restless_souls", tick });
      }
      if (ctx.cuteSpiritCompanion && ctx.getStack("soul_catalyst") > 0 && ctx.random() < 0.15 * ctx.getStack("soul_catalyst")) {
        ctx.cuteSpiritCompanion.charge = Math.min((ctx.cuteSpiritCompanion.charge ?? 0) + 1, 10);
        eventLog.log("spirit_charged", { source: "soul_catalyst", tick });
      }
      if (ctx.getStack("soul_burst") > 0) {
        eventLog.log("explosion_triggered", { source: "soul_burst", targetId: enemy.id, tick });
      }
      if (ctx.getStack("lingering_souls") > 0) {
        const ex = enemy.position.x + enemy.size / 2;
        const ey = enemy.position.y + enemy.size / 2;
        const nearest = getNearestEnemy(ctx, ex, ey, 600, enemy.id);
        if (nearest) {
          eventLog.log("projectile_spawned", { source: "lingering_souls", fromKill: enemy.id, targetId: nearest.id, tick });
        }
      }
    }
  }

  return { length, width, damageMult, baseDamage };
}

module.exports = {
  createSeededRandom,
  createMinimalPlayer,
  createMinimalEnemy,
  createHarnessContext,
  beamRectFromDirection,
  pointInRect,
  getSoulsForEnemy,
  stepSoulSiphonBeam,
  createEventLog
};
