// -------- Game Collision Methods Mixin --------
// Collision detection, overlap resolution
// This module adds methods to Game.prototype when imported

import { getWallCollisionRect, getObstacleCollisionRect, obstacleIntersectsRect } from '../utils.js';
import { PLAYER_WALL_COLLISION_INSET } from '../data/constants.js';

export function applyGameCollisionMixin(Game) {
  Object.assign(Game.prototype, {
    resolveSquareOverlap(a, b) {
      const ax1 = a.position.x, ay1 = a.position.y, asz = a.size;
      const bx1 = b.position.x, by1 = b.position.y, bsz = b.size;
      const ax2 = ax1 + asz, ay2 = ay1 + asz;
      const bx2 = bx1 + bsz, by2 = by1 + bsz;
      const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
      const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
      if (overlapX <= 0 || overlapY <= 0) return;
      const pushA = 0.5;
      const pushB = 0.5;
      const pushX = overlapX * 0.5;
      const pushY = overlapY * 0.5;
      const acx = ax1 + asz / 2, acy = ay1 + asz / 2;
      const bcx = bx1 + bsz / 2, bcy = by1 + bsz / 2;
      
      // Store original positions
      const aOrigX = a.position.x;
      const aOrigY = a.position.y;
      const bOrigX = b.position.x;
      const bOrigY = b.position.y;
      
      // Helper function to check if position would collide with obstacles/walls
      const wouldCollide = (x, y, size) => {
        const testRect = { x, y, w: size, h: size };
        
        // Check obstacles
        for (const obstacle of this.obstacles || []) {
          if (obstacle.destroyed || !obstacle.blocksMovement) continue;
          if (obstacleIntersectsRect(obstacle, testRect)) {
            return true;
          }
        }
        
        // Check procedural tile walls
        const walls = this.world.tileWallRects || [];
        for (const wall of walls) {
          const wallRect = getWallCollisionRect(wall);
          if (testRect.x < wallRect.x + wallRect.w && testRect.x + testRect.w > wallRect.x &&
              testRect.y < wallRect.y + wallRect.h && testRect.y + testRect.h > wallRect.y) {
            return true;
          }
        }

        return false;
      };

      if (overlapX < overlapY) {
        if (acx < bcx) {
          // Push A left, B right
          if (pushA > 0) {
            const newAX = aOrigX - pushX * (pushA * 2);
            if (!wouldCollide(newAX, aOrigY, asz)) {
              a.position.x = newAX;
            }
          }
          if (pushB > 0) {
            const newBX = bOrigX + pushX * (pushB * 2);
            if (!wouldCollide(newBX, bOrigY, bsz)) {
              b.position.x = newBX;
            }
          }
        } else {
          // Push A right, B left
          if (pushA > 0) {
            const newAX = aOrigX + pushX * (pushA * 2);
            if (!wouldCollide(newAX, aOrigY, asz)) {
              a.position.x = newAX;
            }
          }
          if (pushB > 0) {
            const newBX = bOrigX - pushX * (pushB * 2);
            if (!wouldCollide(newBX, bOrigY, bsz)) {
              b.position.x = newBX;
            }
          }
        }
      } else {
        if (acy < bcy) {
          // Push A up, B down
          if (pushA > 0) {
            const newAY = aOrigY - pushY * (pushA * 2);
            if (!wouldCollide(aOrigX, newAY, asz)) {
              a.position.y = newAY;
            }
          }
          if (pushB > 0) {
            const newBY = bOrigY + pushY * (pushB * 2);
            if (!wouldCollide(bOrigX, newBY, bsz)) {
              b.position.y = newBY;
            }
          }
        } else {
          // Push A down, B up
          if (pushA > 0) {
            const newAY = aOrigY + pushY * (pushA * 2);
            if (!wouldCollide(aOrigX, newAY, asz)) {
              a.position.y = newAY;
            }
          }
          if (pushB > 0) {
            const newBY = bOrigY - pushY * (pushB * 2);
            if (!wouldCollide(bOrigX, newBY, bsz)) {
              b.position.y = newBY;
            }
          }
        }
      }
    },

    resolveCircleOverlap(a, b) {
      // Circular collision resolution
      // Use 70% of size for collision radius to better match sprite visuals
      const collisionRadiusMultiplier = 0.7;
      const aCenterX = a.position.x + a.size / 2;
      const aCenterY = a.position.y + a.size / 2;
      const aRadius = (a.size / 2) * collisionRadiusMultiplier;
      
      const bCenterX = b.position.x + b.size / 2;
      const bCenterY = b.position.y + b.size / 2;
      const bRadius = (b.size / 2) * collisionRadiusMultiplier;
      
      const dx = aCenterX - bCenterX;
      const dy = aCenterY - bCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = aRadius + bRadius;
      
      if (distance >= minDistance || distance === 0) return;
      
      // Calculate overlap
      const overlap = minDistance - distance;
      
      // Normalize direction vector
      const dirX = distance > 0 ? dx / distance : 1;
      const dirY = distance > 0 ? dy / distance : 0;
      
      const pushA = 0.5;
      const pushB = 0.5;
      
      // Store original positions
      const aOrigX = a.position.x;
      const aOrigY = a.position.y;
      const bOrigX = b.position.x;
      const bOrigY = b.position.y;
      
      // Helper function to check if position would collide with obstacles/walls
      const wouldCollide = (x, y, size) => {
        const radius = size / 2;
        const centerX = x + radius;
        const centerY = y + radius;
        
        // Check obstacles
        for (const obstacle of this.obstacles || []) {
          if (obstacle.destroyed || !obstacle.blocksMovement) continue;
          const rect = { x: x, y: y, w: size, h: size };
          if (obstacleIntersectsRect(obstacle, rect)) {
            return true;
          }
        }
        
        // Check procedural tile walls
        const walls = this.world.tileWallRects || [];
        for (const wall of walls) {
          const wallRect = getWallCollisionRect(wall);
          const wallCenterX = wallRect.x + wallRect.w / 2;
          const wallCenterY = wallRect.y + wallRect.h / 2;
          const wallRadius = Math.max(wallRect.w, wallRect.h) / 2;
          
          const wallDx = centerX - wallCenterX;
          const wallDy = centerY - wallCenterY;
          const wallDist = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
          
          if (wallDist < radius + wallRadius) {
            return true;
          }
        }
        
        return false;
      };
      
      // Push entities apart
      const pushAmount = overlap * 0.5;
      
      if (pushA > 0) {
        const newAX = aOrigX + dirX * pushAmount * (pushA * 2);
        const newAY = aOrigY + dirY * pushAmount * (pushA * 2);
        if (!wouldCollide(newAX, newAY, a.size)) {
          a.position.x = newAX;
          a.position.y = newAY;
        }
      }
      
      if (pushB > 0) {
        const newBX = bOrigX - dirX * pushAmount * (pushB * 2);
        const newBY = bOrigY - dirY * pushAmount * (pushB * 2);
        if (!wouldCollide(newBX, newBY, b.size)) {
          b.position.x = newBX;
          b.position.y = newBY;
        }
      }
    },

    resolveCollisions() {
      const player = this.player;
      const es = this.enemySystem;
      const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
      const maxX = this.world.width - margin - player.size;
      const maxY = this.world.height - margin - player.size;

      const allEnemies = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
      const skipPlayerCollision = this.bladeDashActive || this.dashActive;
      for (let iter = 0; iter < 2; iter++) {
        if (!skipPlayerCollision) {
          for (const enemy of allEnemies) {
            if (enemy.isDeflectingOrbiter) continue;
            if (enemy.intersects(player)) this.resolveCircleOverlap(player, enemy);
          }
        }
        for (let i = 0; i < allEnemies.length; i++) {
          for (let j = i + 1; j < allEnemies.length; j++) {
            if (allEnemies[i].isDeflectingOrbiter || allEnemies[j].isDeflectingOrbiter) continue;
            if (allEnemies[i].affixes?.includes("flying") || allEnemies[j].affixes?.includes("flying")) continue;
            if (allEnemies[i].intersects(allEnemies[j])) this.resolveCircleOverlap(allEnemies[i], allEnemies[j]);
          }
        }
      }
      player.position.x = Math.max(margin, Math.min(player.position.x, maxX));
      player.position.y = Math.max(margin, Math.min(player.position.y, maxY));
      for (const e of allEnemies) {
        const emaxX = this.world.width - margin - e.size;
        const emaxY = this.world.height - margin - e.size;
        e.position.x = Math.max(margin, Math.min(e.position.x, emaxX));
        e.position.y = Math.max(margin, Math.min(e.position.y, emaxY));
        if (this.world.tileWallRects?.length && this.enemySystem.isOnWall(e.position.x, e.position.y, e.size)) {
          const out = this.enemySystem.pushOutOfWalls(e.position.x, e.position.y, e.size);
          e.position.x = out.x;
          e.position.y = out.y;
        }
      }
    },

    ensurePlayerNotStuck() {
      const player = this.player;
      if (!player || !this.world) return;
      const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
      const maxX = this.world.width - margin - player.size;
      const maxY = this.world.height - margin - player.size;
      const pi = PLAYER_WALL_COLLISION_INSET;
      const pBase = Math.max(1, player.size - 2 * pi);
      const pw = Math.max(1, pBase * 0.25);
      const ph = Math.max(1, pBase * 0.5);
      const pxo = pi + (pBase - pw) / 2;
      const pyo = pi + (pBase - ph) / 2;
      const pSide = Math.max(1, Math.min(pw, ph));

      const isDashingNow = !!(this.dashActive || this.bladeDashActive || this.dashStrikeState || this.backfireDashState);
      const overlapsRect = (a, b) => (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );

      // Push player out of blocking map objects if embedded.
      for (let iter = 0; iter < 12; iter++) {
        const pRect = { x: player.position.x + pxo, y: player.position.y + pyo, w: pw, h: ph };
        let pushed = false;
        const blockingRects = [];
        for (const obstacle of this.obstacles || []) {
          if (obstacle.destroyed || !obstacle.blocksMovement) continue;
          if (isDashingNow && obstacle.type === "ancientTree") continue;
          blockingRects.push(getObstacleCollisionRect(obstacle));
        }

        for (const oRect of blockingRects) {
          if (!overlapsRect(pRect, oRect)) continue;

          const overlapL = (pRect.x + pRect.w) - oRect.x;
          const overlapR = (oRect.x + oRect.w) - pRect.x;
          const overlapT = (pRect.y + pRect.h) - oRect.y;
          const overlapB = (oRect.y + oRect.h) - pRect.y;
          const minX = Math.min(overlapL, overlapR);
          const minY = Math.min(overlapT, overlapB);
          const pCx = pRect.x + pRect.w * 0.5;
          const pCy = pRect.y + pRect.h * 0.5;
          const oCx = oRect.x + oRect.w * 0.5;
          const oCy = oRect.y + oRect.h * 0.5;

          if (minX <= minY) {
            player.position.x += (pCx < oCx ? -(minX + 0.5) : (minX + 0.5));
          } else {
            player.position.y += (pCy < oCy ? -(minY + 0.5) : (minY + 0.5));
          }
          player.position.x = Math.max(margin, Math.min(player.position.x, maxX));
          player.position.y = Math.max(margin, Math.min(player.position.y, maxY));
          pushed = true;
          break;
        }
        if (!pushed) break;
      }

      // Push player out of procedural tile walls if embedded.
      const wallX = player.position.x + pxo;
      const wallY = player.position.y + pyo;
      if (this.enemySystem?.isOnWall?.(wallX, wallY, pSide)) {
        const out = this.enemySystem.pushOutOfWalls(wallX, wallY, pSide);
        player.position.x = Math.max(margin, Math.min(out.x - pxo, maxX));
        player.position.y = Math.max(margin, Math.min(out.y - pyo, maxY));
      }
    },

    enemiesInRadius(cx, cy, r) {
      const out = [];
      const es = this.enemySystem;
      for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
        if (e.isDead) continue;
        const ex = e.position.x + e.size / 2; const ey = e.position.y + e.size / 2;
        if ((ex - cx) ** 2 + (ey - cy) ** 2 <= r * r) out.push(e);
      }
      return out;
    },

    enemiesInCone(cx, cy, dirX, dirY, length, angle) {
      const out = [];
      const es = this.enemySystem;
      for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
        if (e.isDead) continue;
        const ex = e.position.x + e.size / 2 - cx; const ey = e.position.y + e.size / 2 - cy;
        const dist = Math.sqrt(ex * ex + ey * ey) || 1;
        if (dist > length) continue;
        const dot = (ex * dirX + ey * dirY) / dist;
        if (dot > Math.cos(angle * Math.PI / 180)) out.push(e);
      }
      return out;
    },

    getFirstEnemyInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
      const all = this.getEnemiesInLine(px, py, dirX, dirY, maxDist, halfWidth);
      return all.length > 0 ? all[0] : null;
    },

    getEnemiesInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
      const es = this.enemySystem;
      const candidates = [];
      for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
        if (e.isDead) continue;
        const ex = e.position.x + e.size / 2 - px;
        const ey = e.position.y + e.size / 2 - py;
        const t = ex * dirX + ey * dirY;
        if (t <= 0 || t > maxDist) continue;
        const perp = Math.abs(ex * dirY - ey * dirX);
        if (perp > halfWidth + e.size / 2) continue;
        candidates.push({ e, t });
      }
      candidates.sort((a, b) => a.t - b.t);
      return candidates.map((c) => c.e);
    },

    breakablesInRadius(cx, cy, r) {
      const out = [];
      const seen = new Set();
      const pushIfUnique = (target) => {
        if (!target || seen.has(target)) return;
        seen.add(target);
        out.push(target);
      };
      for (const b of this.breakables || []) {
        if (b.isDead) continue;
        const bx = b.centerX;
        const by = b.centerY;
        if ((bx - cx) ** 2 + (by - cy) ** 2 <= r * r) pushIfUnique(b);
      }
      if (typeof this.hasPillarEffect === "function" && this.hasPillarEffect("pillar.havoc.unmake_the_world")) {
        for (const obstacle of this.obstacles || []) {
          if (!obstacle || obstacle.destroyed) continue;
          const ox = obstacle.position.x + (obstacle.size?.w || 0) / 2;
          const oy = obstacle.position.y + (obstacle.size?.h || 0) / 2;
          if ((ox - cx) ** 2 + (oy - cy) ** 2 > r * r) continue;
          const destructibility = this.resolveWorldObjectDestructibility?.(obstacle, {
            typeHint: "obstacle",
            source: "breakablesInRadius"
          });
          if (destructibility?.destructible) pushIfUnique(obstacle);
        }
        for (const prop of this.searchableProps || []) {
          if (!prop || prop.isSearched) continue;
          const px = prop.centerX;
          const py = prop.centerY;
          if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) continue;
          const destructibility = this.resolveWorldObjectDestructibility?.(prop, {
            typeHint: "searchable_prop",
            source: "breakablesInRadius"
          });
          if (destructibility?.destructible) pushIfUnique(prop);
        }
      }
      return out;
    },

    breakablesInCone(cx, cy, dirX, dirY, length, angle) {
      const out = [];
      const seen = new Set();
      const pushIfUnique = (target) => {
        if (!target || seen.has(target)) return;
        seen.add(target);
        out.push(target);
      };
      for (const b of this.breakables || []) {
        if (b.isDead) continue;
        const ex = b.centerX - cx;
        const ey = b.centerY - cy;
        const dist = Math.sqrt(ex * ex + ey * ey) || 1;
        if (dist > length) continue;
        const dot = (ex * dirX + ey * dirY) / dist;
        if (dot > Math.cos(angle * Math.PI / 180)) pushIfUnique(b);
      }
      if (typeof this.hasPillarEffect === "function" && this.hasPillarEffect("pillar.havoc.unmake_the_world")) {
        for (const obstacle of this.obstacles || []) {
          if (!obstacle || obstacle.destroyed) continue;
          const ex = obstacle.position.x + (obstacle.size?.w || 0) / 2 - cx;
          const ey = obstacle.position.y + (obstacle.size?.h || 0) / 2 - cy;
          const dist = Math.sqrt(ex * ex + ey * ey) || 1;
          if (dist > length) continue;
          const dot = (ex * dirX + ey * dirY) / dist;
          if (dot <= Math.cos(angle * Math.PI / 180)) continue;
          const destructibility = this.resolveWorldObjectDestructibility?.(obstacle, {
            typeHint: "obstacle",
            source: "breakablesInCone"
          });
          if (destructibility?.destructible) pushIfUnique(obstacle);
        }
        for (const prop of this.searchableProps || []) {
          if (!prop || prop.isSearched) continue;
          const ex = prop.centerX - cx;
          const ey = prop.centerY - cy;
          const dist = Math.sqrt(ex * ex + ey * ey) || 1;
          if (dist > length) continue;
          const dot = (ex * dirX + ey * dirY) / dist;
          if (dot <= Math.cos(angle * Math.PI / 180)) continue;
          const destructibility = this.resolveWorldObjectDestructibility?.(prop, {
            typeHint: "searchable_prop",
            source: "breakablesInCone"
          });
          if (destructibility?.destructible) pushIfUnique(prop);
        }
      }
      return out;
    },

    getBreakablesInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
      const candidates = [];
      const pushCandidate = (target, t) => {
        if (!target) return;
        candidates.push({ b: target, t });
      };
      for (const b of this.breakables || []) {
        if (b.isDead) continue;
        const ex = b.centerX - px;
        const ey = b.centerY - py;
        const t = ex * dirX + ey * dirY;
        if (t <= 0 || t > maxDist) continue;
        const perp = Math.abs(ex * dirY - ey * dirX);
        const half = Math.max(b.hitbox.w, b.hitbox.h) / 2;
        if (perp > halfWidth + half) continue;
        pushCandidate(b, t);
      }
      if (typeof this.hasPillarEffect === "function" && this.hasPillarEffect("pillar.havoc.unmake_the_world")) {
        for (const obstacle of this.obstacles || []) {
          if (!obstacle || obstacle.destroyed) continue;
          const ex = obstacle.position.x + (obstacle.size?.w || 0) / 2 - px;
          const ey = obstacle.position.y + (obstacle.size?.h || 0) / 2 - py;
          const t = ex * dirX + ey * dirY;
          if (t <= 0 || t > maxDist) continue;
          const perp = Math.abs(ex * dirY - ey * dirX);
          const half = Math.max(obstacle.size?.w || 0, obstacle.size?.h || 0) / 2;
          if (perp > halfWidth + half) continue;
          const destructibility = this.resolveWorldObjectDestructibility?.(obstacle, {
            typeHint: "obstacle",
            source: "getBreakablesInLine"
          });
          if (destructibility?.destructible) pushCandidate(obstacle, t);
        }
        for (const prop of this.searchableProps || []) {
          if (!prop || prop.isSearched) continue;
          const ex = prop.centerX - px;
          const ey = prop.centerY - py;
          const t = ex * dirX + ey * dirY;
          if (t <= 0 || t > maxDist) continue;
          const perp = Math.abs(ex * dirY - ey * dirX);
          const half = Math.max(prop.width || 0, prop.height || 0) / 2;
          if (perp > halfWidth + half) continue;
          const destructibility = this.resolveWorldObjectDestructibility?.(prop, {
            typeHint: "searchable_prop",
            source: "getBreakablesInLine"
          });
          if (destructibility?.destructible) pushCandidate(prop, t);
        }
      }
      candidates.sort((a, b) => a.t - b.t);
      return candidates.map((c) => c.b);
    }
  });
}
