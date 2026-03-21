import { pointToSegmentDist } from "../utils.js";
import { ENEMY_TYPES, Enemy } from "./enemy.js";

function hasAffix(enemy, id) {
  return enemy?.affixes?.includes(id);
}

function updateTemporaryWallTiles(game) {
  if (!Array.isArray(game.wallAffixTiles) || game.wallAffixTiles.length === 0) return;
  if (game._wallAffixLastCleanupTime === game.time) return;
  game._wallAffixLastCleanupTime = game.time;
  const active = game.wallAffixTiles.filter((wall) => (wall?._wallAffixExpiresAt ?? 0) > game.time);
  game.wallAffixTiles = active;
  const tempSet = new Set(active);
  if (Array.isArray(game.world?.tileWallRects)) {
    game.world.tileWallRects = game.world.tileWallRects.filter((wall) => !wall?._wallAffixTemp || tempSet.has(wall));
  }
}

function trySpawnWallAffixTiles(game, enemy, ex, ey, count = 2) {
  const world = game.world;
  if (!world) return;
  if (!Array.isArray(world.tileWallRects)) world.tileWallRects = [];
  if (!Array.isArray(game.wallAffixTiles)) game.wallAffixTiles = [];
  const tileSize = Math.max(8, Number(world.tileSize) || 32);
  const radius = 120;
  const margin = Number(world.wallCollisionThickness ?? world.wallThickness ?? tileSize) || tileSize;
  let spawned = 0;
  for (let attempt = 0; attempt < 20 && spawned < count; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const rawX = ex + Math.cos(angle) * dist - tileSize / 2;
    const rawY = ey + Math.sin(angle) * dist - tileSize / 2;
    const x = Math.floor(rawX / tileSize) * tileSize;
    const y = Math.floor(rawY / tileSize) * tileSize;
    if (x < margin || y < margin || x + tileSize > world.width - margin || y + tileSize > world.height - margin) continue;
    const overlapsWall = world.tileWallRects.some((wall) =>
      x < wall.x + wall.w && x + tileSize > wall.x && y < wall.y + wall.h && y + tileSize > wall.y
    );
    if (overlapsWall) continue;
    const wallTile = {
      x,
      y,
      w: tileSize,
      h: tileSize,
      _wallAffixTemp: true,
      _wallAffixOwnerId: enemy?.id ?? null,
      _wallAffixExpiresAt: game.time + 2.5
    };
    world.tileWallRects.push(wallTile);
    game.wallAffixTiles.push(wallTile);
    spawned += 1;
  }
}

/**
 * Per-frame affix/modifier behavior (volatile/auraBearer/deflecting/orbiting/lasering).
 * Rendering/VFX is intentionally kept in `src/entities/enemy.js`.
 */
export function updateEnemyModifiers(game, enemy, dt) {
  const has = (id) => hasAffix(enemy, id);
  const es = game.enemySystem;
  const px = game.player.position.x + game.player.size / 2;
  const py = game.player.position.y + game.player.size / 2;
  const ex = enemy.position.x + enemy.size / 2;
  const ey = enemy.position.y + enemy.size / 2;
  updateTemporaryWallTiles(game);

  if (has("boulder")) {
    const interval = 6;
    const projectileLifetime = 4;
    // "Very large and very slow" compared to typical enemy projectiles.
    const projectileSpeed = 150;
    const projectileSize = 84;
    enemy._boulderTimer = (enemy._boulderTimer ?? 0) + dt;
    if (enemy._boulderTimer >= interval) {
      enemy._boulderTimer = 0;
      if (!enemy.isDead && game?.spawnEnemyProjectile) {
        const dx = px - ex;
        const dy = py - ey;
        const dist = Math.hypot(dx, dy) || 1;
        const vx = (dx / dist) * projectileSpeed;
        const vy = (dy / dist) * projectileSpeed;
        const dmg = Math.max(1, Math.round((enemy.attack || 10) * 0.6));
        game.spawnEnemyProjectile(ex, ey, vx, vy, dmg, projectileSize, "#4b5563", { lifetime: projectileLifetime }, enemy);
      }
    }
  }

  if (has("invisible")) {
    const interval = 4;
    const invisibleDuration = 1;
    enemy._invisibleCycleTimer = (enemy._invisibleCycleTimer ?? 0) + dt;
    while (enemy._invisibleCycleTimer >= interval) {
      enemy._invisibleCycleTimer -= interval;
      enemy._invisibleUntil = game.time + invisibleDuration;
    }
  } else if (enemy._invisibleUntil != null) {
    enemy._invisibleUntil = null;
    enemy._invisibleCycleTimer = 0;
  }

  if (has("wall")) {
    enemy._wallAffixTimer = (enemy._wallAffixTimer ?? 0) + dt;
    if (enemy._wallAffixTimer >= 3) {
      enemy._wallAffixTimer = 0;
      trySpawnWallAffixTiles(game, enemy, ex, ey, 2);
    }
  }

  if (has("volatile")) {
    enemy._volatileTimer = (enemy._volatileTimer ?? 0) + dt;
    const vfx = enemy.vfxState.volatile;
    const volatileInterval = 3;
    const telegraphStart = volatileInterval - 0.25;
    // Telegraph: pulsing ring 0.25s before burst
    if (enemy._volatileTimer >= telegraphStart && enemy._volatileTimer < volatileInterval) {
      const telegraphProgress = (enemy._volatileTimer - telegraphStart) / 0.25;
      const radius = 10 + telegraphProgress * 30; // 10->40px
      vfx.telegraphTimer = enemy._volatileTimer - telegraphStart;
      vfx.telegraphRadius = radius;
    } else {
      vfx.telegraphTimer = 0;
    }

    if (enemy._volatileTimer >= volatileInterval) {
      enemy._volatileTimer = 0;
      vfx.lastBurstTime = game.time;

      // Burst flash
      game.transientVFX.addRing(ex, ey, enemy.size / 2, 0.08, "#ffffff");
      game.transientVFX.addRing(ex, ey, enemy.size / 2, 0.08, "#f97316");

      // Spawn 12-18 sparks
      const sparkCount = 12 + Math.floor(Math.random() * 7);
      for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 60;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        game.particlePool.spawn(ex, ey, vx, vy, 0.15 + Math.random() * 0.1, 2, "#f97316");
      }

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 120;
        game.spawnEnemyProjectile(ex, ey, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, 8, "#f97316", { lifetime: 4 }, null);
      }
    }
  }

  if (has("auraBearer")) {
    const auraRadius = 800;
    for (const other of es.enemies) {
      if (other === enemy || other.isDead) continue;
      const dx = (other.position.x + other.size / 2) - ex;
      const dy = (other.position.y + other.size / 2) - ey;
      if (dx * dx + dy * dy <= auraRadius * auraRadius) {
        other._auraBuffed = true;
      }
    }
  }

  if (has("agile")) {
    const interval = 2;
    const burstDuration = 0.5;
    const burstSpeedMult = 1.4;
    enemy._agileCycleTimer = (enemy._agileCycleTimer ?? 0) + dt;
    enemy._agileBurstRemaining = Math.max(0, (enemy._agileBurstRemaining ?? 0) - dt);
    if (enemy._agileCycleTimer >= interval) {
      enemy._agileCycleTimer = 0;
      enemy._agileBurstRemaining = burstDuration;
      const angle = Math.random() * Math.PI * 2;
      enemy._agileDirX = Math.cos(angle);
      enemy._agileDirY = Math.sin(angle);
    }
    const isStunned = (enemy.stunUntil || 0) > game.time || !!game.statusManager?.isStunned?.(enemy.id);
    if (enemy._agileBurstRemaining > 0 && !isStunned && !enemy.isDead && !(enemy._undyingRespawnTime && game.time < enemy._undyingRespawnTime)) {
      const margin = game.world.wallCollisionThickness ?? game.world.wallThickness;
      const step = Math.max(0, Number(enemy.speed) || 0) * burstSpeedMult * dt;
      const dirX = Number.isFinite(enemy._agileDirX) ? enemy._agileDirX : 0;
      const dirY = Number.isFinite(enemy._agileDirY) ? enemy._agileDirY : 0;
      enemy.position.x = Math.max(margin, Math.min(enemy.position.x + dirX * step, game.world.width - margin - enemy.size));
      enemy.position.y = Math.max(margin, Math.min(enemy.position.y + dirY * step, game.world.height - margin - enemy.size));
    }
  }

  if (has("deflecting")) {
    enemy._deflectingAngle = (enemy._deflectingAngle ?? 0) + dt * 2.5;
    const baseRadius = enemy.size / 2 + 25;
    const orcSpacing = 40;
    const angle = enemy._deflectingAngle;
    let orbiters = enemy._deflectingOrbiters;
    if (!Array.isArray(orbiters) || orbiters.length < 4) {
      orbiters = [];
      const orcType = ENEMY_TYPES.find((t) => t.id === "m_1a_orc") || ENEMY_TYPES[0];
      const orcHalf = (orcType.size || 86) * 0.2;
      for (let i = 0; i < 4; i++) {
        const r = baseRadius + i * orcSpacing;
        const cx = ex + Math.cos(angle) * r;
        const cy = ey + Math.sin(angle) * r;
        const orbiter = new Enemy(cx - orcHalf, cy - orcHalf, orcType);
        orbiter.worldBounds = enemy.worldBounds;
        orbiter.isDeflectingOrbiter = true;
        orbiter.deflectingParent = enemy;
        orbiter.activated = true;
        orbiter.attackTimer = 9999;
        orbiter.attackCooldown = 9999;
        if (orbiter.attackCtrl) orbiter.attackCtrl.disabled = true;
        orbiters.push(orbiter);
        es.enemies.push(orbiter);
      }
      enemy._deflectingOrbiters = orbiters;
    }

    for (let i = 0; i < orbiters.length; i++) {
      const orbiter = orbiters[i];
      if (orbiter.isDead) continue;
      const r = baseRadius + i * orcSpacing;
      const orbCx = ex + Math.cos(angle) * r;
      const orbCy = ey + Math.sin(angle) * r;
      orbiter.position.x = orbCx - orbiter.size / 2;
      orbiter.position.y = orbCy - orbiter.size / 2;
    }
  }

  if (has("orbiting")) {
    enemy._orbitingAngle = (enemy._orbitingAngle ?? 0) + dt * 3;
    const vfx = enemy.vfxState.orbiting;
    vfx.auraAngle = (vfx.auraAngle || 0) + dt * 0.5;
    // Scale orb radius with enemy size: base radius + size-based offset (1.5x)
    const orbRadius = (enemy.size / 2 + 15) * 1.5;
    const orbCount = 4;

    for (let i = 0; i < orbCount; i++) {
      const a = enemy._orbitingAngle + (i / orbCount) * Math.PI * 2;
      const ox = ex + Math.cos(a) * orbRadius;
      const oy = ey + Math.sin(a) * orbRadius;
      const orbHitRadius = 2; // inner visual core radius

      // Update trail
      if (!vfx.orbTrails[i]) vfx.orbTrails[i] = [];
      vfx.orbTrails[i].push({ x: ox, y: oy, angle: a });
      if (vfx.orbTrails[i].length > 3) vfx.orbTrails[i].shift();

      const pr = game.player.size / 2;
      const dx = px - ox;
      const dy = py - oy;
      if (dx * dx + dy * dy <= (orbHitRadius + pr) * (orbHitRadius + pr)) {
        if (game.time - vfx.lastContactTime > 1) {
          vfx.lastContactTime = game.time;
          game.applyDamage({
            targetType: "player",
            sourceEntity: enemy,
            sourceType: "enemy_orbit_contact",
            amount: 4,
            reason: "enemy_orbiting_hit",
            damageClass: "contact",
            fromEnemy: true,
            bypassMitigation: false,
            canKill: true
          });

          // Spawn sparks at contact
          for (let j = 0; j < 6; j++) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkSpeed = 40 + Math.random() * 30;
            game.particlePool.spawn(px, py, Math.cos(sparkAngle) * sparkSpeed, Math.sin(sparkAngle) * sparkSpeed, 0.12, 1.5, "#06b6d4");
          }
        }
      }
    }
  }

  if (has("lasering")) {
    const vfx = enemy.vfxState.lasering;
    const prevAngle = enemy._laserAngle || 0;
    enemy._laserAngle = (enemy._laserAngle ?? 0) + dt * 1.5;

    // Detect sweep start (angle wrapped around)
    if (prevAngle > enemy._laserAngle) {
      vfx.sweepStartTime = game.time;
      // Sweep start accent
      game.transientVFX.addArc(ex, ey, 25, 0, Math.PI * 2, 0.15, "#06b6d4");
    }

    vfx.emitterPulse = (vfx.emitterPulse || 0) + dt * 8;
    const beamLen = 150;
    const beamW = 20;
    const bx = ex + Math.cos(enemy._laserAngle) * beamLen;
    const by = ey + Math.sin(enemy._laserAngle) * beamLen;
    const proj = { x1: ex, y1: ey, x2: bx, y2: by, w: beamW };
    const dist = pointToSegmentDist(px, py, proj.x1, proj.y1, proj.x2, proj.y2);
    const playerInBeam = dist < beamW;

    // Guide line (0.2s ahead)
    const leadAngle = enemy._laserAngle + 1.5 * 0.2;
    const leadX = ex + Math.cos(leadAngle) * beamLen;
    const leadY = ey + Math.sin(leadAngle) * beamLen;
    game.transientVFX.addLine(ex, ey, leadX, leadY, 0.2, "rgba(6,182,212,0.3)", 1);

    const laserReady = !Number.isFinite(vfx.lastHitTime) || (game.time - vfx.lastHitTime) >= 1;

    // Lasering should tick at most once per second while the player is inside the beam.
    if (playerInBeam && laserReady) {
      game.applyDamage({
        targetType: "player",
        sourceEntity: enemy,
        sourceType: "enemy_laser",
        amount: 30,
        reason: "enemy_laser_sweep_hit",
        damageClass: "beam",
        fromEnemy: true,
        bypassMitigation: false,
        canKill: true
      });
      vfx.lastHitTime = game.time;

      // Zap burst at player
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const speed = 60 + Math.random() * 40;
        game.particlePool.spawn(px, py, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.1, 2, "#06b6d4");
      }
      game.transientVFX.addRing(px, py, 8, 0.08, "#ffffff");
    }
  }
}

/**
 * Damage-reactive affix behavior for player->enemy hits.
 * `ctx.stage` controls which subset to run:
 * - "beforeTakeDamage": hive (matches existing ordering relative to overkill)
 * - "afterTakeDamage": martyr + guarded (needs enemy.health post damage)
 */
export function onEnemyDamagedByPlayer(game, enemy, ctx = {}) {
  const stage = ctx.stage || "beforeTakeDamage";
  const opts = ctx.opts || {};
  const has = (id) => hasAffix(enemy, id);

  const ex = enemy.position.x + enemy.size / 2;
  const ey = enemy.position.y + enemy.size / 2;

  if (stage === "beforeTakeDamage") {
    if (has("hive") && !opts.isDot) {
      // Track minions spawned per enemy, not globally; only spawn small enemies (size <= 86)
      if (!enemy.hiveMinionsSpawned) enemy.hiveMinionsSpawned = 0;
      if (enemy.hiveMinionsSpawned < 5) {
        enemy.hiveMinionsSpawned++;
        const smallTypes = ENEMY_TYPES.filter((t) => t.size != null && t.size <= 86 && t.spawnPool !== "special");
        const pool = smallTypes.length > 0 ? smallTypes : ENEMY_TYPES.filter((t) => t.spawnPool !== "special");
        const base = pool[Math.floor(Math.random() * pool.length)];
        const size = Math.round(base.size * 0.7);
        const offset = 25 + Math.random() * 20;
        const angle = Math.random() * Math.PI * 2;
        const mx = enemy.position.x + enemy.size / 2 + Math.cos(angle) * offset - size / 2;
        const my = enemy.position.y + enemy.size / 2 + Math.sin(angle) * offset - size / 2;
        const typeDef = { ...base, maxHealth: Math.round(base.maxHealth * 0.5), attack: base.attack, speed: Math.round(base.speed * 1.5), size };
        const minion = new Enemy(mx, my, typeDef);
        minion.worldBounds = enemy.worldBounds;
        minion.activated = true;
        minion.alerted = true;
        minion.moveBehavior = "CHARGE";
        minion.forceDirectChase = true;
        minion.isAffixMinion = true;
        game.enemySystem.enemies.push(minion);
      }
    }
  }

  if (stage === "afterTakeDamage") {
    if (has("inking") && !enemy._inkingTriggered && enemy.maxHealth > 0 && enemy.health > 0 && (enemy.health / enemy.maxHealth) <= 0.5) {
      enemy._inkingTriggered = true;
      // Translucent-black screen overlay for the player.
      game.inkingFlashTimer = 2;
    }

    if (has("martyr") && !enemy._martyrTriggered && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.5 && enemy.health > 0) {
      enemy._martyrTriggered = true;
      game.pendingMartyrEffects = game.pendingMartyrEffects || [];
      game.pendingMartyrEffects.push({ x: ex, y: ey, startTime: game.time });
    }
    if (has("guarded") && !enemy._guardedTriggered && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.5 && enemy.health > 0) {
      enemy._guardedTriggered = true;
      game.pendingGuardedEffects = game.pendingGuardedEffects || [];
      game.pendingGuardedEffects.push({ x: ex, y: ey, startTime: game.time });
    }
  }
}

/**
 * Enemy death-reactive affixes for player->enemy hits.
 */
export function onEnemyKilledByPlayer(game, enemy, ctx = {}) {
  const has = (id) => hasAffix(enemy, id);
  if (enemy.isDead && has("undying") && !enemy._undyingUsed && !enemy._undyingQueued) {
    enemy._undyingUsed = true;
    enemy._undyingQueued = true;
    enemy._undyingPendingRevive = true;
    const reviveAt = game.time + 0.8;
    if (!Array.isArray(game.pendingUndyingRevives)) game.pendingUndyingRevives = [];
    game.pendingUndyingRevives.push({ enemy, reviveAt });
  }
}

