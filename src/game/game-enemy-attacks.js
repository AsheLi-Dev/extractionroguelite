/**
 * Game mixin for enemy attack system integration.
 * Adds hitbox-owned enemy projectile spawning, enemy minions, delayed impacts,
 * and attack controller updates.
 */

import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { EnemyAttackController } from '../entities/attacks/index.js';
import { drawTile } from '../entities/tile-system.js';

const ENEMY_PROJECTILE_DEF = {
  id: 'enemy_projectile',
  shape: 'circle',
  radius: 5,
  durationMs: 2500,
  moveSpeed: 350,
  moveMode: 'straight',
  damage: 0,
  hitStunMs: 0,
  knockback: 0,
  maxHitsPerTarget: 1,
  maxTotalTargets: 1,
  followOwner: false,
  tags: ['enemy_projectile']
};

function normalizeDir(x, y) {
  const dx = Number(x) || 0;
  const dy = Number(y) || 0;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, speed: len };
}

export function applyGameEnemyAttacksMixin(Game) {
  Object.assign(Game.prototype, {
    createEnemyProjectileAttack(spawn, executeOpts = {}, sourceEntity = null, sourceMeta = {}) {
      const dir = normalizeDir(spawn?.dirX ?? spawn?.vx, spawn?.dirY ?? spawn?.vy);
      const speed = Number(spawn?.speed) || dir.speed || Number(executeOpts?.speed) || 350;
      const size = Math.max(2, Number(spawn?.size ?? executeOpts?.size) || 12);
      const damage = Math.max(1, Math.round(Number(spawn?.damage) || 0));
      const lifetime = Number(executeOpts?.lifetime);
      const homingTurnRate = Number(executeOpts?.homingTurnRate) || 0;
      const movementType = executeOpts?.movementType ?? null;
      const speedRampEnd = Number(executeOpts?.speedRampEnd);
      const speedRampDuration = Math.max(0, Number(executeOpts?.speedRampDuration) || 0);
      const moveMode = executeOpts?.moveMode
        ?? (movementType === 'spiral'
          ? 'spiral'
          : homingTurnRate > 0
            ? 'homing'
            : movementType === 'zigzag'
              ? 'zigzag'
              : (speedRampDuration > 0 && Number.isFinite(speedRampEnd) && speedRampEnd !== speed)
                ? 'speed_ramp'
                : 'straight');
      const hitbox = this.createHitboxAttack(ENEMY_PROJECTILE_DEF, {
        x: Number(spawn?.x) || 0,
        y: Number(spawn?.y) || 0,
        dirX: dir.x,
        dirY: dir.y,
        damage: 0,
        moveSpeed: speed,
        radius: size / 2,
        durationMs: ((Number.isFinite(lifetime) ? lifetime : 2.5) * 1000) || 2500,
        faction: 'enemy',
        ownerId: sourceEntity?.id ?? null,
        createdAt: this.time,
        moveMode,
        maxTotalTargets: 1,
        targetId: moveMode === 'homing' ? 'player' : null,
        homingStrength: homingTurnRate > 0 ? Math.min(8, homingTurnRate * 15) : 2,
        zigzagAmplitude: Number(executeOpts?.zigzagAmplitude) || Math.max(size * 1.4, speed * 0.04),
        zigzagFrequency: Number(executeOpts?.zigzagFrequency) || 8,
        zigzagPhaseOffset: Number(executeOpts?.zigzagPhaseOffset) || 0,
        spiralDirection: Number(executeOpts?.spiralDirection) || 1,
        spiralTurnRate: Number(executeOpts?.spiralTurnRate) || 2.5,
        speedRampEnd,
        speedRampDuration,
        accel: Number(executeOpts?.accel) || 0,
        maxSpeed: Math.max(0, Number(executeOpts?.maxSpeed) || 9999),
        tags: ['enemy_projectile']
      }, {
        visual: {
          kind: 'projectile',
          faction: 'enemy',
          shape: 'circle',
          radius: size / 2,
          color: spawn?.color ?? executeOpts?.color ?? '#a855f7',
          spritePath: executeOpts?.spritePath ?? null,
          animatedSprite: executeOpts?.animatedSprite ?? null,
          magicStyle: executeOpts?.magicStyle ?? null,
          trailEnabled: executeOpts?.trailEnabled ?? !(executeOpts?.spritePath || executeOpts?.animatedSprite),
          trailLife: Number.isFinite(executeOpts?.trailLife) ? executeOpts.trailLife : undefined,
          trailMaxPoints: Number.isFinite(executeOpts?.trailMaxPoints) ? executeOpts.trailMaxPoints : undefined
        },
        onHit: (attackHitbox, target, world) => {
          if (target?.id !== 'player' || !world) return;
          const source = attackHitbox.sourceEntity || sourceEntity || null;
          if (source) world.lastDamagingEnemy = source;
          let dmgResult = null;
          if (attackHitbox.enemyProjectileDamage > 0 && typeof world.applyDamage === 'function') {
            dmgResult = world.applyDamage({
              targetType: 'player',
              sourceEntity: source,
              sourceType: 'enemy_projectile',
              amount: attackHitbox.enemyProjectileDamage,
              reason: 'enemy_projectile_hit',
              damageClass: 'projectile',
              fromEnemy: true,
              bypassMitigation: false,
              canKill: true
            });
          }
          if (source?.enemyTypeId === 'm_5x_vampire_archer' && (dmgResult?.effectiveDamage || 0) > 0 && !source.isDead) {
            source.health = Math.min(source.maxHealth, source.health + 5);
          }
          if (attackHitbox.onHitStun && attackHitbox.stunDuration != null) {
            world.stunTimer = Math.max(world.stunTimer || 0, attackHitbox.stunDuration);
            if (world.playerDebuffVFX?.stun) {
              world.playerDebuffVFX.stun.active = true;
              world.playerDebuffVFX.stun.until = world.time + attackHitbox.stunDuration;
            }
          }
          if (attackHitbox.slowZone && attackHitbox.slowDuration != null) {
            world.playerSlowUntil = world.time + attackHitbox.slowDuration;
            world.playerSlowMult = attackHitbox.slowMult ?? 0.65;
            if (world.playerDebuffVFX?.slow) {
              world.playerDebuffVFX.slow.active = true;
              world.playerDebuffVFX.slow.until = world.time + attackHitbox.slowDuration;
            }
          }
          if (attackHitbox.slowZone && world.hazardSystem) {
            world.hazardSystem.addTemporaryPatch('slowZone', attackHitbox.x, attackHitbox.y, attackHitbox.slowRadius ?? 50, attackHitbox.slowDuration ?? 1.5, 0, false, attackHitbox.slowMult ?? 0.6);
          }
          if (attackHitbox.poisonOnHit && attackHitbox.poisonDuration != null && attackHitbox.poisonDmgPerSec != null) {
            world.playerPoisonUntil = world.time + attackHitbox.poisonDuration;
            world.playerPoisonDmgPerSec = attackHitbox.poisonDmgPerSec;
            if (world.playerDebuffVFX?.poison) {
              world.playerDebuffVFX.poison.active = true;
              world.playerDebuffVFX.poison.until = world.playerPoisonUntil;
            }
          }
        },
        onExpire: (reason, attackHitbox, world) => {
          if (!world || !attackHitbox) return;
          if (attackHitbox.lichOrbBurst && (reason === 'lifetime' || reason === 'obstacle') && typeof world.spawnLichOrbBurst === 'function') {
            world.spawnLichOrbBurst(attackHitbox);
          }
          if (reason === 'obstacle' && attackHitbox.slowZone && world.hazardSystem) {
            world.hazardSystem.addTemporaryPatch('slowZone', attackHitbox.x, attackHitbox.y, attackHitbox.slowRadius ?? 50, attackHitbox.slowDuration ?? 1.5, 0, false, attackHitbox.slowMult ?? 0.6);
          }
        }
      });
      if (!hitbox) return hitbox;
      hitbox.enemyProjectileDamage = damage;
      hitbox.color = spawn?.color ?? executeOpts?.color ?? '#a855f7';
      hitbox.sourceEntity = sourceEntity || null;
      hitbox.sourceEnemy = sourceEntity || null;
      hitbox.slowZone = executeOpts?.slowZone ?? false;
      hitbox.slowRadius = executeOpts?.slowRadius ?? 50;
      hitbox.slowDuration = executeOpts?.slowDuration ?? 1.5;
      hitbox.slowMult = executeOpts?.slowMult ?? null;
      hitbox.onHitStun = executeOpts?.onHitStun ?? false;
      hitbox.stunDuration = executeOpts?.stunDuration ?? null;
      hitbox.poisonOnHit = executeOpts?.poisonOnHit ?? false;
      hitbox.poisonDuration = executeOpts?.poisonDuration ?? null;
      hitbox.poisonDmgPerSec = executeOpts?.poisonDmgPerSec ?? null;
      hitbox.lichOrbBurst = executeOpts?.lichOrbBurst ?? null;
      if (sourceMeta && typeof sourceMeta === 'object') Object.assign(hitbox, sourceMeta);
      return hitbox;
    },

    spawnEnemyProjectile(x, y, vx, vy, damage, size = 12, color = '#a855f7', executeOpts = {}, sourceEnemy = null) {
      const opts = executeOpts?.lifetime == null ? { ...executeOpts, lifetime: 4 } : executeOpts;
      return this.createEnemyProjectileAttack({ x, y, vx, vy, damage, size, color }, opts, sourceEnemy);
    },

    spawnEnemyProjectileHitbox(x, y, dirX, dirY, damage, executeOpts = {}, sourceEnemy = null) {
      const speed = (executeOpts?.speed ?? 350) * (sourceEnemy?.attackScale > 1.2 ? 1.1 : 1);
      const opts = executeOpts?.lifetime == null ? { ...executeOpts, lifetime: 2.5 } : executeOpts;
      return this.createEnemyProjectileAttack(
        {
          x,
          y,
          dirX,
          dirY,
          speed,
          damage,
          size: opts?.size ?? 10,
          color: opts?.color ?? '#a855f7'
        },
        opts,
        sourceEnemy
      );
    },

    spawnEnemyMinion(x, y, spawnTypeId) {
      const typeDef = ENEMY_TYPES.find((t) => t.id === spawnTypeId) || ENEMY_TYPES[0];
      const enemy = new Enemy(x, y, typeDef);
      enemy.worldBounds = this.world ? { width: this.world.width, height: this.world.height } : { width: 3600, height: 900 };
      enemy.enemyTier = 'minion';
      enemy.attackScale = 1;
      enemy.enableHiddenAttacks = false;
      enemy.attackCtrl = new EnemyAttackController(enemy);
      this.enemySystem.enemies.push(enemy);
    },

    addDelayedEnemyImpact(at, x, y, radius, damage, sourceEnemy, slowZone = false, slowDuration = 1.5, attackId = null) {
      this.delayedEnemyImpacts = this.delayedEnemyImpacts || [];
      this.delayedEnemyImpacts.push({ at, x, y, radius, damage, sourceEnemy, slowZone, slowDuration, attackId });
    },

    addDelayedEnemyProjectile(at, x, y, vx, vy, damage, size = 12, color = '#a855f7', executeOpts = {}, sourceEnemy = null, opts = {}) {
      this.delayedEnemyProjectiles = this.delayedEnemyProjectiles || [];
      this.delayedEnemyProjectiles.push({
        at,
        x,
        y,
        vx,
        vy,
        damage,
        size,
        color,
        executeOpts,
        sourceEnemy,
        useHitbox: opts.useHitbox === true
      });
    },

    spawnLichOrbBurst(proj) {
      const burst = proj.lichOrbBurst;
      if (!burst || !burst.count) return;
      const count = burst.count;
      const speed = burst.speed ?? 200;
      const delay = burst.delay ?? 0.1;
      const size = burst.size ?? 8.4;
      const x = proj.position ? (proj.position.x + proj.size / 2) : (Number(proj.x) || 0);
      const y = proj.position ? (proj.position.y + proj.size / 2) : (Number(proj.y) || 0);
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const dx = px - x;
      const dy = py - y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const vx = dirX * speed;
      const vy = dirY * speed;
      const damage = proj.damage ?? proj.enemyProjectileDamage ?? 1;
      const color = proj.color ?? '#7c3aed';
      for (let i = 0; i < count; i++) {
        this.addDelayedEnemyProjectile(
          this.time + i * delay,
          x,
          y,
          vx,
          vy,
          damage,
          size,
          color,
          { animatedSprite: { preset: 'ghostOrb' } },
          proj.sourceEnemy || proj.sourceEntity || null
        );
      }
    },

    updatePendingMartyrEffects() {
      if (!this.pendingMartyrEffects?.length) return;
      const now = this.time;
      const speed = 100;
      const martyrColor = '#78716c';
      this.pendingMartyrEffects = this.pendingMartyrEffects.filter((p) => {
        if (now < p.startTime + 1) return true;
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          this.spawnEnemyProjectile(p.x, p.y, vx, vy, 10, 5, martyrColor, { movementType: 'zigzag' }, null);
        }
        return false;
      });
    },

    drawMartyrChargeCircles(ctx) {
      if (!this.pendingMartyrEffects?.length) return;
      const now = this.time;
      const camera = this.camera;
      for (const p of this.pendingMartyrEffects) {
        if (now >= p.startTime + 1) continue;
        const sx = p.x - camera.position.x;
        const sy = p.y - camera.position.y;
        const elapsed = now - p.startTime;
        const flash = Math.sin(now * 12) * 0.5 + 0.5;
        const radius = 30 + elapsed * 20;
        ctx.strokeStyle = `rgba(120, 113, 108, ${0.3 + flash * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    updatePendingGuardedEffects() {
      if (!this.pendingGuardedEffects?.length) return;
      const now = this.time;
      const es = this.enemySystem;
      const largeTypes = ENEMY_TYPES.filter((t) => (t.size || 0) >= 90);
      const pool = largeTypes.length > 0 ? largeTypes : ENEMY_TYPES;
      this.pendingGuardedEffects = this.pendingGuardedEffects.filter((p) => {
        if (now < p.startTime + 0.5) return true;
        const worldBounds = this.world ? { width: this.world.width, height: this.world.height } : { width: 3600, height: 900 };
        for (let i = 0; i < 2; i++) {
          const typeDef = pool[Math.floor(Math.random() * pool.length)];
          const offsetX = (Math.random() - 0.5) * 40;
          const offsetY = (Math.random() - 0.5) * 40;
          const mx = p.x - (typeDef.size || 86) * 0.2 + offsetX;
          const my = p.y - (typeDef.size || 86) * 0.2 + offsetY;
          const minion = new Enemy(mx, my, typeDef);
          minion.worldBounds = worldBounds;
          minion.activated = true;
          minion.enemyTier = 'minion';
          minion.attackScale = 1;
          minion.attackCtrl = new EnemyAttackController(minion);
          es.enemies.push(minion);
        }
        return false;
      });
    },

    drawGuardedEffects(ctx) {
      if (!this.pendingGuardedEffects?.length) return;
      const now = this.time;
      const camera = this.camera;
      const tileSize = 32;
      for (const p of this.pendingGuardedEffects) {
        if (now >= p.startTime + 0.5) continue;
        const sx = p.x - camera.position.x - tileSize / 2;
        const sy = p.y - camera.position.y - tileSize / 2;
        const elapsed = now - p.startTime;
        const glowAlpha = 0.5 * (1 - elapsed / 0.5);
        drawTile(ctx, 17, 'o', sx, sy, tileSize);
        if (glowAlpha > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = glowAlpha;
          ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.fillRect(sx - 4, sy - 4, tileSize + 8, tileSize + 8);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }
    },

    updateDelayedEnemyImpacts() {
      const now = this.time;
      if (this.delayedEnemyProjectiles?.length) {
        this.delayedEnemyProjectiles = this.delayedEnemyProjectiles.filter((p) => {
          if (now < p.at) return true;
          if (p.useHitbox && typeof this.spawnEnemyProjectileHitbox === 'function') {
            const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
            this.spawnEnemyProjectileHitbox(p.x, p.y, p.vx / sp, p.vy / sp, p.damage, p.executeOpts, p.sourceEnemy);
          } else {
            this.spawnEnemyProjectile(p.x, p.y, p.vx, p.vy, p.damage, p.size, p.color, p.executeOpts, p.sourceEnemy);
          }
          return false;
        });
      }
      if (!this.delayedEnemyImpacts?.length) return;
      const player = this.player;
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const useCircleHitbox = typeof this.spawnEnemyCircleHitbox === 'function';
      this.delayedEnemyImpacts = this.delayedEnemyImpacts.filter((imp) => {
        if (now < imp.at) return true;
        if (useCircleHitbox) {
          this.spawnEnemyCircleHitbox(imp.sourceEnemy, imp.x, imp.y, imp.radius, imp.damage, imp.attackId || 'enemy_circle', {
            slowZone: imp.slowZone,
            slowDuration: imp.slowDuration
          });
        } else {
          if ((px - imp.x) ** 2 + (py - imp.y) ** 2 <= imp.radius * imp.radius) {
            this.lastDamagingEnemy = imp.sourceEnemy;
            this.onPlayerDamaged(imp.damage, true);
          }
          if (imp.slowZone && this.hazardSystem) {
            this.hazardSystem.addTemporaryPatch('slowZone', imp.x, imp.y, imp.radius, imp.slowDuration ?? 1.5, 0, false, 0.6);
          }
        }
        return false;
      });
    }
  });
}
