// -------- Breakable props: static destructibles with HP and loot --------

import { Vec2, assetUrl } from "../utils.js";
import { BREAKABLE_DEFS } from "../data/breakables-data.js";
import { rollBreakableLoot } from "../data/breakable-loot.js";
import { drawTile, isTileAtlasLoaded } from "./tile-system.js";

const HIT_COOLDOWN_MS = 60;
const HIT_FLASH_SECONDS = 1 / 60;

const breakableSpriteCache = new Map();

function getSpriteImage(src) {
  const key = String(src || "").trim();
  if (!key) return null;
  if (breakableSpriteCache.has(key)) return breakableSpriteCache.get(key);
  const img = new Image();
  img.src = assetUrl(key);
  breakableSpriteCache.set(key, img);
  return img;
}

function normalizeDamageStages(stages) {
  if (!Array.isArray(stages)) return [];
  const out = stages
    .map((s) => ({
      minHits: s?.minHits != null ? Number(s.minHits) : null,
      minHpPct: Number(s?.minHpPct),
      staticSrc: typeof s?.staticSrc === "string" ? s.staticSrc : null,
      hitSrc: typeof s?.hitSrc === "string" ? s.hitSrc : null,
    }))
    .filter((s) => {
      const hasHits = Number.isFinite(s.minHits) && s.minHits >= 0;
      const hasHp = Number.isFinite(s.minHpPct) && s.minHpPct >= 0 && s.minHpPct <= 1;
      return (hasHits || hasHp) && (s.staticSrc || s.hitSrc);
    });
  const usesHits = out.some((s) => Number.isFinite(s.minHits));
  out.sort((a, b) => {
    if (usesHits) return (Number(b.minHits) || 0) - (Number(a.minHits) || 0);
    return (Number(b.minHpPct) || 0) - (Number(a.minHpPct) || 0);
  });
  return out;
}

export class Breakable {
  constructor(id, x, y, defId) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.defId = defId;
    const def = BREAKABLE_DEFS[defId];
    if (!def) throw new Error(`Unknown breakable def: ${defId}`);
    this.def = def;
    this.value = (def && typeof def.value === "string" ? def.value : "low");
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

    // Optional sprite-driven visuals (barrels, etc.)
    this._spriteScale = Math.max(0.1, Number(def.spriteScale) || 1);
    this._spriteState = "alive"; // alive | dying | destroyed
    this._hitFlashUntil = 0;
    this._destroyAnimStartedAt = null;
    this._hitsTaken = 0;

    const rawSprites = def.sprites;
    /** Per-instance sprite config (supports variants). */
    this._sprites = rawSprites;
    if (rawSprites && typeof rawSprites === "object" && Array.isArray(rawSprites.variants) && rawSprites.variants.length) {
      const pool = rawSprites.variants.filter(Boolean);
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      this._sprites = {
        ...rawSprites,
        ...(chosen && typeof chosen === "object" ? chosen : {}),
      };
    }

    const sprites = this._sprites;
    if (sprites && typeof sprites === "object") {
      this._damageStages = normalizeDamageStages(sprites.damageStages);
      this._staticImg = getSpriteImage(sprites.staticSrc);
      this._hitImg = getSpriteImage(sprites.hitSrc);
      this._destroyedImg = getSpriteImage(sprites.destroyedSrc);
      this._destroySheetImg = getSpriteImage(sprites.destroySheetSrc);
      this._destroyFrameImgs = Array.isArray(sprites.destroyFramesSrc)
        ? sprites.destroyFramesSrc.map((s) => getSpriteImage(s)).filter(Boolean)
        : [];

      if (this._damageStages.length) {
        this._damageStageStaticImgs = this._damageStages.map((s) => getSpriteImage(s.staticSrc)).filter(Boolean);
        this._damageStageHitImgs = this._damageStages.map((s) => getSpriteImage(s.hitSrc)).filter(Boolean);
      } else {
        this._damageStageStaticImgs = [];
        this._damageStageHitImgs = [];
      }

      // If requested, size hitbox to sprite once it loads.
      if (def.autoSizeFromSprite && this._staticImg) {
        const onLoaded = () => {
          const nw = this._staticImg.naturalWidth || 0;
          const nh = this._staticImg.naturalHeight || 0;
          if (nw <= 0 || nh <= 0) return;
          const w = Math.max(1, Math.round(nw * this._spriteScale));
          const h = Math.max(1, Math.round(nh * this._spriteScale));
          this.hitbox.w = w;
          this.hitbox.h = h;
          this.size = Math.max(w, h);
        };
        if (this._staticImg.complete && this._staticImg.naturalWidth) onLoaded();
        else this._staticImg.addEventListener("load", onLoaded, { once: true });
      }
    }
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
    this._hitsTaken = (Number(this._hitsTaken) || 0) + 1;
    this._hitFlashUntil = now + HIT_FLASH_SECONDS;
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

    if (this._sprites?.destroySheetSrc || this._sprites?.destroyedSrc || (Array.isArray(this._sprites?.destroyFramesSrc) && this._sprites.destroyFramesSrc.length)) {
      this._spriteState = "dying";
      this._destroyAnimStartedAt = now;
    }

    if (typeof game?.grantXP === "function") {
      const xp = 1 + Math.floor(Math.random() * 3);
      game.grantXP(xp);
    }

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
    const now = Number(game?.time) || 0;
    this._lastTime = now;
    if (this.shakeUntil > 0 && now >= this.shakeUntil) {
      this.shakeUntil = 0;
    }

    if (this._spriteState === "dying") {
      const frameCount = Math.max(1, Number(this._sprites?.destroyFrameCount) || 4);
      const frameDur = Math.max(0.01, Number(this._sprites?.destroyFrameDuration) || 0.06);
      const startedAt = Number(this._destroyAnimStartedAt) || now;
      const elapsed = Math.max(0, now - startedAt);
      if (elapsed >= frameCount * frameDur) {
        this._spriteState = "destroyed";
      }
    }
  }

  draw(ctx, camera, timeSeconds = 0) {
    // Some breakables keep a persistent destroyed visual.
    if (this.isDead && this._spriteState !== "dying" && this._spriteState !== "destroyed") return;
    const shake = timeSeconds < this.shakeUntil ? { x: this.shakeOffsetX || 0, y: this.shakeOffsetY || 0 } : { x: 0, y: 0 };
    const sx = Math.floor(this.position.x + shake.x - camera.position.x);
    const sy = Math.floor(this.position.y + shake.y - camera.position.y);
    const w = this.hitbox.w;
    const h = this.hitbox.h;

    // Sprite-based draw path (barrel, etc.)
    if (this._sprites) {
      const sprites = this._sprites;
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;

      const frameCount = Math.max(
        1,
        Number(sprites.destroyFrameCount) ||
          (Array.isArray(sprites.destroyFramesSrc) ? sprites.destroyFramesSrc.length : 0) ||
          4
      );
      const frameDur = Math.max(0.01, Number(sprites.destroyFrameDuration) || 0.06);

      if (this._spriteState === "dying" && this._destroySheetImg?.complete && this._destroySheetImg.naturalWidth) {
        const img = this._destroySheetImg;
        const startedAt = Number(this._destroyAnimStartedAt) || timeSeconds;
        const elapsed = Math.max(0, timeSeconds - startedAt);
        const frameIdx = Math.min(frameCount - 1, Math.floor(elapsed / frameDur));
        const fw = Math.max(1, Math.floor(img.naturalWidth / frameCount));
        const fh = Math.max(1, img.naturalHeight || 1);
        ctx.drawImage(img, frameIdx * fw, 0, fw, fh, sx, sy, w, h);
        ctx.imageSmoothingEnabled = prevSmoothing;
        return;
      }

      if (this._spriteState === "dying" && this._destroyFrameImgs?.length) {
        const startedAt = Number(this._destroyAnimStartedAt) || timeSeconds;
        const elapsed = Math.max(0, timeSeconds - startedAt);
        const idx = Math.min(frameCount - 1, Math.floor(elapsed / frameDur));
        const img = this._destroyFrameImgs[Math.min(this._destroyFrameImgs.length - 1, idx)];
        if (img?.complete && img.naturalWidth) {
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, sx, sy, w, h);
          ctx.imageSmoothingEnabled = prevSmoothing;
          return;
        }
      }

      if (this._spriteState === "destroyed") {
        const img = this._destroyedImg;
        if (img?.complete && img.naturalWidth) {
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, sx, sy, w, h);
          ctx.imageSmoothingEnabled = prevSmoothing;
          return;
        }
        ctx.imageSmoothingEnabled = prevSmoothing;
        return;
      }

      const showHit = timeSeconds < (this._hitFlashUntil || 0);

      let staticImg = this._staticImg;
      let hitImg = this._hitImg || this._staticImg;
      if (this._damageStages?.length && this.maxHp > 0) {
        const usesHits = this._damageStages.some((s) => Number.isFinite(s.minHits));
        const pct = (this.hp ?? 0) / this.maxHp;
        const hits = Number(this._hitsTaken) || 0;
        let chosen = null;
        for (let i = 0; i < this._damageStages.length; i++) {
          const stage = this._damageStages[i];
          if (usesHits) {
            if (hits >= (Number(stage.minHits) || 0)) { chosen = stage; break; }
          } else {
            if (pct >= (Number(stage.minHpPct) || 0)) { chosen = stage; break; }
          }
        }
        const stage = chosen || this._damageStages[this._damageStages.length - 1] || null;
        const sImg = stage?.staticSrc ? getSpriteImage(stage.staticSrc) : null;
        const hImg = stage?.hitSrc ? getSpriteImage(stage.hitSrc) : null;
        if (sImg) staticImg = sImg;
        if (hImg) hitImg = hImg;
      }

      const img = showHit ? (hitImg || staticImg) : staticImg;
      if (img?.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, sx, sy, w, h);
        ctx.imageSmoothingEnabled = prevSmoothing;
        return;
      }
      ctx.imageSmoothingEnabled = prevSmoothing;
      // Fall through to tile/shape fallback if sprites not ready yet.
    }

    if (this.isDead) return;
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

  isBlockingMovement() {
    if (!this.def?.blocksMovement) return false;
    // Keep blocking during destroy animation, but stop once it becomes rubble.
    if (this._spriteState === "destroyed") return false;
    return !this.isDead || this._spriteState === "dying";
  }
}
