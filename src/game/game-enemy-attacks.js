/**
 * Game mixin for enemy attack system integration.
 * Adds spawnEnemyProjectile, spawnEnemyMinion, delayed impacts, attack controller updates.
 */

import { EnemyProjectile } from '../entities/projectile.js';
import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { EnemyAttackController } from '../entities/attacks/index.js';
import { drawTile } from '../entities/tile-system.js';

export function applyGameEnemyAttacksMixin(Game) {
  Object.assign(Game.prototype, {
    spawnEnemyProjectile(x, y, vx, vy, damage, size = 12, color = "#a855f7", executeOpts = {}, sourceEnemy = null) {
      const proj = new EnemyProjectile(x, y, vx, vy, damage, size, color, {
        slowZone: executeOpts.slowZone ?? false,
        slowRadius: executeOpts.slowRadius ?? 50,
        slowDuration: executeOpts.slowDuration ?? 1.5,
        spritePath: executeOpts.spritePath ?? null,
        magicStyle: executeOpts.magicStyle ?? null,
        movementType: executeOpts.movementType ?? null,
        lifetime: executeOpts.lifetime
      });
      proj.sourceEnemy = sourceEnemy;
      this.enemySystem.projectiles.push(proj);
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

    addDelayedEnemyImpact(at, x, y, radius, damage, sourceEnemy, slowZone = false, slowDuration = 1.5) {
      this.delayedEnemyImpacts = this.delayedEnemyImpacts || [];
      this.delayedEnemyImpacts.push({ at, x, y, radius, damage, sourceEnemy, slowZone, slowDuration });
    },

    addDelayedEnemyProjectile(at, x, y, vx, vy, damage, size = 12, color = "#a855f7", executeOpts = {}, sourceEnemy = null) {
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
        sourceEnemy
      });
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
          this.spawnEnemyProjectile(p.x, p.y, p.vx, p.vy, p.damage, p.size, p.color, p.executeOpts, p.sourceEnemy);
          return false;
        });
      }
      if (!this.delayedEnemyImpacts?.length) return;
      const player = this.player;
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      this.delayedEnemyImpacts = this.delayedEnemyImpacts.filter((imp) => {
        if (now < imp.at) return true;
        if ((px - imp.x) ** 2 + (py - imp.y) ** 2 <= imp.radius * imp.radius) {
          this.lastDamagingEnemy = imp.sourceEnemy;
          this.onPlayerDamaged(imp.damage, true);
        }
        if (imp.slowZone && this.hazardSystem) {
          this.hazardSystem.addTemporaryPatch("slowZone", imp.x, imp.y, imp.radius, imp.slowDuration ?? 1.5, 0, false, 0.6);
        }
        return false;
      });
    }
  });
}
