/**
 * Totem entity for TotemSubArea encounters.
 * Buff totems: shared sheet 4×8, row 0 idle, row 3 death.
 * Skill totems (fire/ice/lightning): each has own sheet 5×6, row 2 idle, row 4 death.
 */

import { Vec2 } from '../utils.js';
import {
  TOTEM_BUFF_RADIUS_TILES,
  TOTEM_BASE_HP,
  TOTEM_SIZE,
  getTotemDef,
  TOTEM_CATEGORY,
  pickRandomTotemType,
} from '../data/totems.js';
import { EnemyProjectile } from './projectile.js';
import { obstacleIntersectsRect } from '../utils.js';

const BUFF_TOTEM_SHEET_SRC = 'assets/Enemies/Buff Totem Sprite Sheet v1.1.png';
const BUFF_TOTEM_SHEET_ROWS = 4;
const BUFF_TOTEM_SHEET_COLS = 8;
const BUFF_TOTEM_IDLE_ROW = 0;
const BUFF_TOTEM_DEATH_ROW = 3;
const BUFF_TOTEM_IDLE_FPS = 8;
const BUFF_TOTEM_DEATH_DURATION = 0.8;

const SKILL_TOTEM_SHEET_ROWS = 5;
const SKILL_TOTEM_SHEET_COLS = 6;
const SKILL_TOTEM_IDLE_ROW = 2;
const SKILL_TOTEM_DEATH_ROW = 4;
const SKILL_TOTEM_IDLE_FPS = 6;
const SKILL_TOTEM_DEATH_DURATION = 0.6;

let totemIdCounter = 1;
let buffTotemSheet = null;
const skillTotemSheets = new Map();

function getBuffTotemSheet() {
  if (!buffTotemSheet) {
    buffTotemSheet = new Image();
    buffTotemSheet.src = BUFF_TOTEM_SHEET_SRC;
  }
  return buffTotemSheet;
}

function getSkillTotemSheet(src) {
  if (!src) return null;
  if (!skillTotemSheets.has(src)) {
    const img = new Image();
    img.src = src;
    skillTotemSheets.set(src, img);
  }
  return skillTotemSheets.get(src);
}

export class Totem {
  constructor(x, y, typeId, zoneId, rng = Math.random) {
    this.id = `totem_${totemIdCounter++}`;
    this.position = new Vec2(x, y);
    this.size = TOTEM_SIZE;
    this.typeId = typeId;
    this.zoneId = zoneId;
    this.def = getTotemDef(typeId) || {};
    this.maxHealth = TOTEM_BASE_HP;
    this.health = this.maxHealth;
    this.isDead = false;
    this.skillTimer = this.def.cooldown != null ? rng() * this.def.cooldown : 0;
    this.telegraphUntil = 0;
  }

  /** Buff radius in world units (uses game.world.tileSize). */
  getBuffRadiusPx(world) {
    const tileSize = world?.tileSize ?? 32;
    return TOTEM_BUFF_RADIUS_TILES * tileSize;
  }

  takeDamage(amount, game = null) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - Math.round(amount));
    if (this.health <= 0) {
      this.isDead = true;
      this.deathAnimStartTime = game?.time ?? 0;
    }
  }

  update(dt, game) {
    if (this.isDead) return;
    const def = this.def;
    if (def.category !== TOTEM_CATEGORY.SKILL || def.cooldown == null) return;

    const now = game.time || 0;
    if (this.telegraphUntil > 0 && now >= this.telegraphUntil) {
      this.telegraphUntil = 0;
      this.fireSkill(game);
      this.skillTimer = def.cooldown;
    } else if (this.telegraphUntil > 0) {
      return;
    }

    this.skillTimer -= dt;
    if (this.skillTimer <= 0) {
      this.telegraphUntil = now + (def.telegraphDuration ?? 0.5);
      this.skillTimer = 0;
    }
  }

  fireSkill(game) {
    const def = this.def;
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const player = game.player;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const baseAngle = Math.atan2(dy, dx);

    const count = def.projectileCount ?? 1;
    const spreadDeg = (def.spreadDeg ?? 0) * (Math.PI / 180);
    const speed = def.projectileSpeed ?? 300;
    const halfSpread = spreadDeg / 2;

    for (let i = 0; i < count; i++) {
      const angleOffset = count > 1 ? -halfSpread + (spreadDeg * i) / Math.max(1, count - 1) : 0;
      const angle = baseAngle + angleOffset;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const options = {
        magicStyle: def.magicStyle ?? null,
        movementType: def.movementType ?? null,
        slowZone: !!def.onHitSlow,
        slowRadius: 50,
        slowDuration: def.slowDuration ?? 1.5,
        lifetime: 2,
      };
      if (def.onHitStun) {
        options.onHitStun = true;
        options.stunDuration = def.stunDuration ?? 0.35;
      }

      const proj = new EnemyProjectile(
        cx,
        cy,
        vx,
        vy,
        def.projectileDamage ?? 8,
        def.projectileSize ?? 12,
        def.color ?? "#999",
        options
      );
      proj.sourceTotemId = this.id;
      proj.sourceTotemTypeId = this.typeId;
      if (def.onHitSlow) {
        proj.slowZone = true;
        proj.slowDuration = def.slowDuration ?? 1.5;
        proj.slowMult = def.slowMult ?? 0.65;
      }
      if (def.onHitStun) {
        proj.onHitStun = true;
        proj.stunDuration = def.stunDuration ?? 0.35;
      }
      game.enemySystem.projectiles.push(proj);
    }

    if (game.devMode && typeof console !== 'undefined' && console.debug) {
      console.debug(`[Totem] ${def.name} fired skill (${count} projectiles)`);
    }
  }

  draw(ctx, camera, gameTime = 0, game = null) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const def = this.def;
    const radiusPx = this.size / 2;
    const auraRadius = radiusPx * 1.8;

    // Buff totems: always show buff range with yellow outline (when alive)
    if (!this.isDead && def.category === TOTEM_CATEGORY.BUFF) {
      const buffRadiusPx = this.getBuffRadiusPx(game?.world);
      const cx = sx + radiusPx;
      const cy = sy + radiusPx;
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, buffRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Health bar above totem (when alive)
    if (!this.isDead && this.maxHealth > 0) {
      const barW = 40;
      const barH = 5;
      const barX = sx + radiusPx - barW / 2;
      const barY = sy - 10;
      const pct = Math.max(0, Math.min(1, this.health / this.maxHealth));
      const fillW = Math.round(barW * pct);
      let fillColor = '#4ade80';
      if (pct <= 0.25) fillColor = '#ef4444';
      else if (pct <= 0.5) fillColor = '#facc15';
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(barX, barY, barW, barH);
      if (fillW > 0) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(barX, barY, fillW, barH);
      }
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);
      ctx.restore();
    }

    const isBuffTotem = def.category === TOTEM_CATEGORY.BUFF;
    const isSkillTotem = def.category === TOTEM_CATEGORY.SKILL && def.spriteSheetSrc;
    const buffSheet = isBuffTotem ? getBuffTotemSheet() : null;
    const skillSheet = isSkillTotem ? getSkillTotemSheet(def.spriteSheetSrc) : null;
    const canDrawBuff = buffSheet && buffSheet.complete && buffSheet.naturalWidth > 0;
    const canDrawSkill = skillSheet && skillSheet.complete && skillSheet.naturalWidth > 0;

    if (this.isDead) {
      if (canDrawBuff && isBuffTotem) {
        const elapsed = gameTime - (this.deathAnimStartTime ?? gameTime);
        const frameIndex = Math.min(
          BUFF_TOTEM_SHEET_COLS - 1,
          Math.floor((elapsed / BUFF_TOTEM_DEATH_DURATION) * BUFF_TOTEM_SHEET_COLS)
        );
        const frameW = buffSheet.naturalWidth / BUFF_TOTEM_SHEET_COLS;
        const frameH = buffSheet.naturalHeight / BUFF_TOTEM_SHEET_ROWS;
        ctx.save();
        ctx.drawImage(
          buffSheet,
          frameIndex * frameW, BUFF_TOTEM_DEATH_ROW * frameH, frameW, frameH,
          sx, sy, this.size, this.size
        );
        ctx.restore();
      } else if (canDrawSkill && isSkillTotem) {
        const elapsed = gameTime - (this.deathAnimStartTime ?? gameTime);
        const frameIndex = Math.min(
          SKILL_TOTEM_SHEET_COLS - 1,
          Math.floor((elapsed / SKILL_TOTEM_DEATH_DURATION) * SKILL_TOTEM_SHEET_COLS)
        );
        const frameW = skillSheet.naturalWidth / SKILL_TOTEM_SHEET_COLS;
        const frameH = skillSheet.naturalHeight / SKILL_TOTEM_SHEET_ROWS;
        ctx.save();
        ctx.drawImage(
          skillSheet,
          frameIndex * frameW, SKILL_TOTEM_DEATH_ROW * frameH, frameW, frameH,
          sx, sy, this.size, this.size
        );
        ctx.restore();
      }
      return;
    }

    if (canDrawBuff && isBuffTotem) {
      ctx.save();
      // Buff totem glow (red war, blue protection, yellow speed); only when alive
      const glowRadius = radiusPx * 1.4;
      const cx = sx + radiusPx;
      const cy = sy + radiusPx;
      const buffGlow = (() => {
        switch (def.buffId) {
          case 'war': return { inner: 'rgba(255, 70, 70, 0.7)', outer: 'rgba(255, 70, 70, 0)' };
          case 'protection': return { inner: 'rgba(70, 130, 255, 0.7)', outer: 'rgba(70, 130, 255, 0)' };
          case 'speed': return { inner: 'rgba(255, 220, 60, 0.7)', outer: 'rgba(255, 220, 60, 0)' };
          default: return null;
        }
      })();
      if (buffGlow) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        g.addColorStop(0, buffGlow.inner);
        g.addColorStop(0.5, buffGlow.inner);
        g.addColorStop(1, buffGlow.outer);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = def.auraColor ?? "rgba(100, 100, 100, 0.3)";
      ctx.beginPath();
      ctx.arc(cx, cy, auraRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.auraBorderColor ?? "rgba(150, 150, 150, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const frameIndex = Math.floor((gameTime * BUFF_TOTEM_IDLE_FPS) % BUFF_TOTEM_SHEET_COLS);
      const frameW = buffSheet.naturalWidth / BUFF_TOTEM_SHEET_COLS;
      const frameH = buffSheet.naturalHeight / BUFF_TOTEM_SHEET_ROWS;
      ctx.drawImage(
        buffSheet,
        frameIndex * frameW, BUFF_TOTEM_IDLE_ROW * frameH, frameW, frameH,
        sx, sy, this.size, this.size
      );
      ctx.restore();
    } else if (canDrawSkill && isSkillTotem) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = def.auraColor ?? "rgba(100, 100, 100, 0.3)";
      ctx.beginPath();
      ctx.arc(sx + radiusPx, sy + radiusPx, auraRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.auraBorderColor ?? "rgba(150, 150, 150, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const frameIndex = Math.floor((gameTime * SKILL_TOTEM_IDLE_FPS) % SKILL_TOTEM_SHEET_COLS);
      const frameW = skillSheet.naturalWidth / SKILL_TOTEM_SHEET_COLS;
      const frameH = skillSheet.naturalHeight / SKILL_TOTEM_SHEET_ROWS;
      ctx.drawImage(
        skillSheet,
        frameIndex * frameW, SKILL_TOTEM_IDLE_ROW * frameH, frameW, frameH,
        sx, sy, this.size, this.size
      );
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = def.auraColor ?? "rgba(100, 100, 100, 0.3)";
      ctx.beginPath();
      ctx.arc(sx + radiusPx, sy + radiusPx, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.auraBorderColor ?? "rgba(150, 150, 150, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = def.color ?? "#888";
      ctx.beginPath();
      ctx.arc(sx + radiusPx, sy + radiusPx, radiusPx * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.auraBorderColor ?? "rgba(200, 200, 200, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    if (!this.isDead && this.telegraphUntil > 0 && (this.def.telegraphDuration != null) && gameTime > 0) {
      const now = gameTime;
      const elapsed = now - (this.telegraphUntil - this.def.telegraphDuration);
      const t = Math.min(1, elapsed / this.def.telegraphDuration);
      ctx.save();
      ctx.globalAlpha = 0.3 + t * 0.5;
      ctx.strokeStyle = def.auraBorderColor ?? "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx + radiusPx, sy + radiusPx, auraRadius + t * 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Find a valid spawn position inside a zone: not on wall, not on obstacle, not too close to player spawn.
 * @param {Object} zone - { bounds: { x, y, w, h } }
 * @param {Object} game
 * @param {number} totemSize
 * @returns {{ x, y } | null}
 */
function findTotemSpawnInZone(zone, game, totemSize) {
  const b = zone.bounds;
  const margin = 8;
  const minX = b.x + margin;
  const minY = b.y + margin;
  const rangeX = Math.max(0, b.w - totemSize - margin * 2);
  const rangeY = Math.max(0, b.h - totemSize - margin * 2);
  const tileSize = game.world?.tileSize ?? 32;
  const playerSafeDist = tileSize * 8;
  const playerX = game.player?.position?.x ?? 0;
  const playerY = game.player?.position?.y ?? 0;

  for (let attempt = 0; attempt < 40; attempt++) {
    const x = minX + Math.random() * rangeX;
    const y = minY + Math.random() * rangeY;
    const cx = x + totemSize / 2;
    const cy = y + totemSize / 2;

    if (Math.hypot(cx - playerX - (game.player?.size ?? 0) / 2, cy - playerY - (game.player?.size ?? 0) / 2) < playerSafeDist) continue;

    const gx = Math.floor(cx / tileSize);
    const gy = Math.floor(cy / tileSize);
    const grid = game.world?.tileGrid;
    if (grid && grid.length && grid[0].length) {
      if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length) continue;
      if (grid[gy][gx] === 1) continue;
    }

    const walls = game.world?.tileWallRects;
    if (walls?.length) {
      const r = { x, y, w: totemSize, h: totemSize };
      let onWall = false;
      for (const wall of walls) {
        if (r.x < wall.x + wall.w && r.x + r.w > wall.x && r.y < wall.y + wall.h && r.y + r.h > wall.y) {
          onWall = true;
          break;
        }
      }
      if (onWall) continue;
    }

    if (game.obstacles?.length) {
      const r = { x, y, w: totemSize, h: totemSize };
      for (const ob of game.obstacles) {
        if (ob.destroyed || !ob.blocksMovement) continue;
        if (obstacleIntersectsRect(ob, r)) continue;
      }
    }

    return { x, y };
  }
  return null;
}

/**
 * Spawn one totem per zone in world.totemZones. Called when biome map is initialized.
 * @param {Object} game - Game instance (world, player, obstacles, enemySystem)
 * @param {function(): number} rng
 */
export function spawnTotemsInZones(game, rng = Math.random) {
  const zones = game.world?.totemZones;
  if (!zones?.length) return;
  game.totems = game.totems || [];

  for (const zone of zones) {
    const spot = findTotemSpawnInZone(zone, game, TOTEM_SIZE);
    if (!spot) continue;

    const typeId = pickRandomTotemType(rng);
    const totem = new Totem(spot.x, spot.y, typeId, zone.id, rng);
    game.totems.push(totem);

    if (game.devMode && typeof console !== 'undefined' && console.debug) {
      console.debug(`[Totem] Spawned ${totem.def.name} at (${spot.x.toFixed(0)}, ${spot.y.toFixed(0)}) zone ${zone.id}`);
    }
  }
}
