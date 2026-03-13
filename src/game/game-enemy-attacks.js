/**
 * Game mixin for enemy attack system integration.
 * Adds spawnEnemyProjectile, spawnEnemyMinion, delayed impacts, attack controller updates.
 * Enemy projectile hitbox: spawnEnemyProjectileHitbox for hitbox-system–based arrows (e.g. Skeleton Archer).
 */

import { EnemyProjectile } from '../entities/projectile.js';
import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { EnemyAttackController } from '../entities/attacks/index.js';
import { drawTile } from '../entities/tile-system.js';
import { createHitbox } from '../combat/index.js';
import { SKELETON_ARCHER_ARROW_DEF } from '../combat/hitbox-examples.js';

export function applyGameEnemyAttacksMixin(Game) {
  Object.assign(Game.prototype, {
    spawnEnemyProjectile(x, y, vx, vy, damage, size = 12, color = "#a855f7", executeOpts = {}, sourceEnemy = null) {
      const proj = new EnemyProjectile(x, y, vx, vy, damage, size, color, {
        slowZone: executeOpts.slowZone ?? false,
        slowRadius: executeOpts.slowRadius ?? 50,
        slowDuration: executeOpts.slowDuration ?? 1.5,
        slowMult: executeOpts.slowMult ?? null,
        spritePath: executeOpts.spritePath ?? null,
        magicStyle: executeOpts.magicStyle ?? null,
        movementType: executeOpts.movementType ?? null,
        zigzagAmplitude: executeOpts.zigzagAmplitude ?? null,
        spiralDirection: executeOpts.spiralDirection ?? null,
        homingTurnRate: executeOpts.homingTurnRate ?? null,
        lifetime: executeOpts.lifetime,
        speedRampEnd: executeOpts.speedRampEnd ?? null,
        speedRampDuration: executeOpts.speedRampDuration ?? null,
        poisonOnHit: executeOpts.poisonOnHit ?? false,
        poisonDuration: executeOpts.poisonDuration ?? null,
        poisonDmgPerSec: executeOpts.poisonDmgPerSec ?? null,
        lichOrbBurst: executeOpts.lichOrbBurst ?? null
      });
      proj.sourceEnemy = sourceEnemy;
      this.enemySystem.projectiles.push(proj);
    },

    /**
     * Spawn an enemy projectile as a hitbox (circle, moving). Used by Skeleton Archer and other
     * attacks that set useHitbox. Collision and damage are handled by the hitbox system; obstacle
     * destruction uses game.hitboxDestroyIfObstacle.
     */
    spawnEnemyProjectileHitbox(x, y, dirX, dirY, damage, executeOpts = {}, sourceEnemy = null) {
      const speed = (executeOpts?.speed ?? 350) * (sourceEnemy?.attackScale > 1.2 ? 1.1 : 1);
      // executeOpts.size is diameter (same as old EnemyProjectile); hitbox uses radius
      const radius = ((executeOpts?.size ?? 10) / 2);
      const durationMs = ((executeOpts?.lifetime ?? 2.5) * 1000) || 2500;
      const movementType = executeOpts?.movementType;
      const homingTurnRate = Number(executeOpts?.homingTurnRate) || 0;
      const moveMode = executeOpts?.moveMode ?? (homingTurnRate > 0 ? 'homing' : (movementType === 'zigzag' ? 'zigzag' : 'straight'));
      const spawnData = {
        x,
        y,
        dirX,
        dirY,
        damage: Math.max(1, Math.round(damage)),
        moveSpeed: speed,
        radius,
        durationMs,
        faction: 'enemy',
        ownerId: sourceEnemy?.id ?? null,
        createdAt: this.time,
        moveMode
      };
      if (moveMode === 'homing') {
        spawnData.targetId = 'player';
        spawnData.homingStrength = homingTurnRate > 0 ? Math.min(8, homingTurnRate * 15) : 2;
      }
      if (moveMode === 'zigzag') {
        spawnData.zigzagAmplitude = Number(executeOpts?.zigzagAmplitude) || 20;
        spawnData.zigzagFrequency = Number(executeOpts?.zigzagFrequency) || 6;
      }
      if (moveMode === 'accelerating') {
        spawnData.accel = Number(executeOpts?.accel) || 0;
        spawnData.maxSpeed = Math.max(0, Number(executeOpts?.maxSpeed) || 9999);
      }
      createHitbox(SKELETON_ARCHER_ARROW_DEF, spawnData);
    },

    spawnEnemyMinion(x, y, spawnTypeId) {
      const typeDef = ENEMY_TYPES.find((t) => t.id === spawnTypeId) || ENEMY_TYPES[0];
      const enemy = new Enemy(x, y, typeDef);
      enemy.worldBounds = this.world ? { width: this.world.width, height: this.world.height } : { width: 3600, height: 900 };
      enemy.enemyTier = "minion";
      enemy.attackScale = 1;
      enemy.enableHiddenAttacks = false;
      enemy.attackCtrl = new EnemyAttackController(enemy);
      this.enemySystem.enemies.push(enemy);
    },

    addDelayedEnemyImpact(at, x, y, radius, damage, sourceEnemy, slowZone = false, slowDuration = 1.5, attackId = null) {
      this.delayedEnemyImpacts = this.delayedEnemyImpacts || [];
      this.delayedEnemyImpacts.push({ at, x, y, radius, damage, sourceEnemy, slowZone, slowDuration, attackId });
    },

    addDelayedEnemyProjectile(at, x, y, vx, vy, damage, size = 12, color = "#a855f7", executeOpts = {}, sourceEnemy = null, opts = {}) {
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
      const x = proj.position.x + proj.size / 2;
      const y = proj.position.y + proj.size / 2;
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const dx = px - x;
      const dy = py - y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const vx = dirX * speed;
      const vy = dirY * speed;
      const damage = proj.damage ?? 1;
      const color = proj.color ?? "#7c3aed";
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
          {},
          proj.sourceEnemy || null
        );
      }
    },

    updatePendingMartyrEffects() {
      if (!this.pendingMartyrEffects?.length) return;
      const now = this.time;
      const speed = 100;
      const martyrColor = "#78716c";
      this.pendingMartyrEffects = this.pendingMartyrEffects.filter((p) => {
        if (now < p.startTime + 1) return true;
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          this.spawnEnemyProjectile(p.x, p.y, vx, vy, 10, 5, martyrColor, { movementType: "zigzag" }, null);
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
          minion.enemyTier = "minion";
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
        drawTile(ctx, 17, "o", sx, sy, tileSize);
        if (glowAlpha > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = glowAlpha;
          ctx.fillStyle = "rgba(168, 85, 247, 0.6)";
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
            this.hazardSystem.addTemporaryPatch("slowZone", imp.x, imp.y, imp.radius, imp.slowDuration ?? 1.5, 0, false, 0.6);
          }
        }
        return false;
      });
    }
  });
}
