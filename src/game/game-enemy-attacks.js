/**
 * Game mixin for enemy attack system integration.
 * Adds spawnEnemyProjectile, spawnEnemyMinion, delayed impacts, attack controller updates.
 */

import { EnemyProjectile } from '../entities/projectile.js';
import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { EnemyAttackController } from '../entities/attacks/index.js';

export function applyGameEnemyAttacksMixin(Game) {
  Object.assign(Game.prototype, {
    spawnEnemyProjectile(x, y, vx, vy, damage, size = 12, color = "#a855f7", executeOpts = {}, sourceEnemy = null) {
      const proj = new EnemyProjectile(x, y, vx, vy, damage, size, color, {
        slowZone: executeOpts.slowZone ?? false,
        slowRadius: executeOpts.slowRadius ?? 50,
        slowDuration: executeOpts.slowDuration ?? 1.5
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

    updateDelayedEnemyImpacts() {
      if (!this.delayedEnemyImpacts?.length) return;
      const player = this.player;
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const now = this.time;
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
