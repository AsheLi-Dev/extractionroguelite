// -------- Breakable props: static destructibles with HP and loot --------

import { Vec2 } from "../utils.js";
import { BREAKABLE_DEFS } from "../data/breakables-data.js";
import { rollBreakableLoot } from "../data/breakable-loot.js";
import { drawTile, isTileAtlasLoaded } from "./tile-system.js";

const HIT_COOLDOWN_MS = 60;

export class Breakable {
  constructor(id, x, y, defId) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.defId = defId;
    const def = BREAKABLE_DEFS[defId];
    if (!def) throw new Error(`Unknown breakable def: ${defId}`);
    this.def = def;
    this.maxHp = def.maxHealth;
    this.hp = this.maxHp;
    this.isDead = false;
    this.invulnUntil = 0;
    this.hitbox = { w: def.hitbox.w, h: def.hitbox.h };
    // For projectile.intersects compatibility (expects .size as number for both w and h)
    this.size = Math.max(def.hitbox.w, def.hitbox.h);
    this.lastHitAt = 0;
    this.shakeUntil = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  get centerX() {
    return this.position.x + this.hitbox.w / 2;
  }
  get centerY() {
    return this.position.y + this.hitbox.h / 2;
  }

  takeDamage(amount, now, source = null, game = null) {
    if (this.isDead) return 0;
    if (now < this.invulnUntil) return 0;
    const dmg = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnUntil = now + HIT_COOLDOWN_MS / 1000;
    this.lastHitAt = now;
    this.shakeUntil = now + 0.08;
    this.shakeOffsetX = (Math.random() - 0.5) * 4;
    this.shakeOffsetY = (Math.random() - 0.5) * 4;
    if (this.hp <= 0) this.die(now, game);
    return dmg;
  }

  getCrackStage() {
    if (this.isDead) return 2;
    const pct = this.hp / this.maxHp;
    if (pct <= 0.33) return 2;
    if (pct <= 0.66) return 1;
    return 0;
  }

  die(now, game = null) {
    if (this.isDead) return;
    this.isDead = true;
    this.hp = 0;

    const tableId = this.def.lootTable;
    const rng = typeof game?.world?.tileGrid !== "undefined" ? () => Math.random() : Math.random;
    const context = {
      lootQuality: game?.currentMap?.lootQuality ?? 0.5,
      difficulty: game?.difficulty ?? 1,
    };
    const isBossRoom = (game?.currentMapId ?? game?.currentMap?.id) === 4;
    const lootRolls = isBossRoom ? 2 : 1;

    if (game && game.lootSystem) {
      const cx = this.centerX;
      const cy = this.centerY;
      for (let i = 0; i < lootRolls; i++) {
        const loot = rollBreakableLoot(tableId, rng, context);
        const ox = lootRolls > 1 ? (Math.random() - 0.5) * 18 : 0;
        const oy = lootRolls > 1 ? (Math.random() - 0.5) * 18 : 0;
        const x = cx + ox;
        const y = cy + oy;
        if (loot.goldAmount > 0) game.lootSystem.spawnGoldAt(x, y, loot.goldAmount);
        if (loot.cubeKey) game.lootSystem.spawnCubeAt(x, y, loot.cubeKey);
        if (loot.equipmentDef) game.lootSystem.spawnEquipmentAt(x, y, loot.equipmentDef);
      }
    }

    this._lootSpawned = true;
  }

  /** Rect overlap for hit detection. Uses position + hitbox. */
  intersects(other) {
    const a = {
      x: this.position.x,
      y: this.position.y,
      w: this.hitbox.w,
      h: this.hitbox.h,
    };
    const bw = other.size?.w ?? other.size ?? 16;
    const bh = other.size?.h ?? other.size ?? 16;
    const b = {
      x: other.position?.x ?? other.x ?? 0,
      y: other.position?.y ?? other.y ?? 0,
      w: bw,
      h: bh,
    };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /** Current draw position (with optional shake). */
  get drawX() {
    if (this.shakeUntil > 0 && typeof this._lastTime === "number" && this._lastTime < this.shakeUntil) {
      return this.position.x + (this.shakeOffsetX || 0);
    }
    return this.position.x;
  }
  get drawY() {
    if (this.shakeUntil > 0 && typeof this._lastTime === "number" && this._lastTime < this.shakeUntil) {
      return this.position.y + (this.shakeOffsetY || 0);
    }
    return this.position.y;
  }

  update(dt, game) {
    const now = (game?.time ?? 0) + dt;
    this._lastTime = game?.time ?? 0;
    if (this.shakeUntil > 0 && now >= this.shakeUntil) {
      this.shakeUntil = 0;
    }
  }

  draw(ctx, camera, timeSeconds = 0) {
    if (this.isDead) return;
    const shake = timeSeconds < this.shakeUntil ? { x: this.shakeOffsetX || 0, y: this.shakeOffsetY || 0 } : { x: 0, y: 0 };
    const sx = Math.floor(this.position.x + shake.x - camera.position.x);
    const sy = Math.floor(this.position.y + shake.y - camera.position.y);
    const w = this.hitbox.w;
    const h = this.hitbox.h;
    const stage = this.getCrackStage();
    const colors = {
      crate_basic: { fill: "#8b6914", stroke: "#5c4610", crack: "rgba(0,0,0,0.5)" },
      urn_magic: { fill: "#4a5568", stroke: "#2d3748", crack: "rgba(147,197,253,0.6)" },
      chest_rare: { fill: "#b45309", stroke: "#92400e", crack: "rgba(251,191,36,0.4)" },
      jar_1: { fill: "#8b7355", stroke: "#5b4630", crack: "rgba(0,0,0,0.45)" },
      jar_2: { fill: "#7a6a4a", stroke: "#4b3a27", crack: "rgba(0,0,0,0.45)" },
      ore_sack: { fill: "#6b7280", stroke: "#374151", crack: "rgba(248,250,252,0.3)" },
    };
    const c = colors[this.defId] || colors.crate_basic;
    const tileRef = this.def?.tile;
    if (tileRef && isTileAtlasLoaded()) {
      drawTile(ctx, tileRef.row, tileRef.col, sx, sy, Math.max(w, h));
    } else {
      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(sx, sy, w, h);
      ctx.strokeRect(sx, sy, w, h);
    }
    if (stage >= 1) {
      ctx.strokeStyle = c.crack;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + w * 0.3, sy + h * 0.2);
      ctx.lineTo(sx + w * 0.6, sy + h * 0.7);
      if (stage >= 2) {
        ctx.moveTo(sx + w * 0.7, sy + h * 0.3);
        ctx.lineTo(sx + w * 0.2, sy + h * 0.8);
        ctx.moveTo(sx + w * 0.5, sy);
        ctx.lineTo(sx + w * 0.5, sy + h);
      }
      ctx.stroke();
    }
  }
}
