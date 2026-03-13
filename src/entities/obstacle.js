import { Vec2, obstacleIntersectsRect } from '../utils.js';
import { drawTile, drawTileByName, isTileAtlasLoaded } from './tile-system.js';

export class Obstacle {
  constructor(x, y, typeDef) {
    this.id = `obstacle_${Date.now()}_${Math.random()}`;
    this.position = new Vec2(x, y);
    this.typeDef = typeDef;
    this.type = typeDef.id;
    this.size = typeDef.size;
    this.blocksMovement = typeDef.blocksMovement;
    this.blocksProjectiles = typeDef.blocksProjectiles;
    this.meltTimer = typeDef.meltTime || null;
    this.destroyed = false;
    this.lastBurnTick = 0;
    this.triggered = false; // For bone pile
    if (typeDef.spriteSources && typeDef.spriteSources.length) {
      const src = typeDef.spriteSources[Math.floor(Math.random() * typeDef.spriteSources.length)];
      this._spriteImage = new Image();
      this._spriteImage.onload = () => {
        const nw = this._spriteImage.naturalWidth;
        const nh = this._spriteImage.naturalHeight;
        this.size = { w: nw, h: nh };
      };
      this._spriteImage.src = src;
      this._spriteFlipH = Math.random() < 0.5;
    }
  }

  get center() {
    return new Vec2(
      this.position.x + this.size.w / 2,
      this.position.y + this.size.h / 2
    );
  }

  intersects(other) {
    const bW = other?.size?.w ?? other?.size ?? other?.width ?? other?.w ?? 48;
    const bH = other?.size?.h ?? other?.size ?? other?.height ?? other?.h ?? 48;
    const bX = other?.position?.x ?? other?.x ?? 0;
    const bY = other?.position?.y ?? other?.y ?? 0;
    return obstacleIntersectsRect(this, { x: bX, y: bY, w: bW, h: bH });
  }

  update(dt, game) {
    if (this.destroyed) return;
    
    // Ice block melting
    if (this.type === "iceBlock" && this.meltTimer !== null) {
      this.meltTimer -= dt;
      if (this.meltTimer <= 0) {
        this.destroyed = true;
      }
    }

    // Lava rock burn damage
    if (this.type === "lavaRock") {
      const burnInterval = this.typeDef.burnInterval || 0.5;
      this.lastBurnTick += dt;
      if (this.lastBurnTick >= burnInterval) {
        // Check for player contact
        if (this.intersects(game.player)) {
          game.onPlayerDamaged(this.typeDef.burnDamage, false);
        }
        // Check for enemy contact
        for (const enemy of game.enemySystem.enemies) {
          if (!enemy.isDead && this.intersects(enemy)) {
            game.dealDamageToEnemy(enemy, this.typeDef.burnDamage);
          }
        }
        if (game.enemySystem.boss && !game.enemySystem.boss.isDead && this.intersects(game.enemySystem.boss)) {
          game.dealDamageToEnemy(game.enemySystem.boss, this.typeDef.burnDamage);
        }
        this.lastBurnTick = 0;
      }
    }

    // Bone pile spawn check
    if (this.type === "bonePile" && !this.triggered) {
      if (this.intersects(game.player)) {
        this.triggered = true;
        if (Math.random() < this.typeDef.spawnChance) {
          const enemy = game.enemySystem.spawnOne("minion", null, {
            x: this.position.x + this.size.w / 2,
            y: this.position.y + this.size.h / 2
          });
          if (enemy) {
            game.enemySystem.enemies.push(enemy);
          }
        }
      }
    }
  }

  draw(ctx, camera) {
    if (this.destroyed) return;
    
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const scale = this.type === "ruinPillar" ? 1 : 2;
    const drawW = this.size.w * scale;
    const drawH = this.size.h * scale;
    const drawX = sx - (drawW - this.size.w) / 2;
    const drawY = sy - (drawH - this.size.h) / 2;
    const floorDrawX = this.type === "ruinPillar" ? Math.floor(drawX) : drawX;
    const floorDrawY = this.type === "ruinPillar" ? Math.floor(drawY) : drawY;

    // Draw shadow (scaled)
    ctx.fillStyle = this.typeDef.shadowColor || "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(floorDrawX + 4, floorDrawY + drawH - 8, drawW, 12);

    if (this.type === "ruinPillar" && this._spriteImage) {
      if (this._spriteImage.complete && this._spriteImage.naturalWidth) {
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        if (this._spriteFlipH) {
          ctx.save();
          ctx.translate(floorDrawX + drawW, floorDrawY);
          ctx.scale(-1, 1);
          ctx.drawImage(this._spriteImage, -drawW, 0, drawW, drawH);
          ctx.restore();
        } else {
          ctx.drawImage(this._spriteImage, floorDrawX, floorDrawY, drawW, drawH);
        }
        ctx.imageSmoothingEnabled = prevSmoothing;
      } else {
        ctx.fillStyle = this.typeDef.color || "#5a5a6a";
        ctx.fillRect(floorDrawX, floorDrawY, drawW, drawH);
      }
      return;
    }

    // Try to use tiles if available
    if (isTileAtlasLoaded()) {
      if (this.type === "barrel") {
        drawTileByName(ctx, "barrel", drawX, drawY, drawW);
        return;
      } else if (this.type === "bonePile") {
        drawTileByName(ctx, "corpse", drawX, drawY, drawW);
        return;
      } else if (this.type === "giantRock") {
        drawTileByName(ctx, "large rock", drawX, drawY, drawW);
        return;
      } else if (this.type === "ancientTree") {
        if (this.treeTile && this.treeTile.row && this.treeTile.col) {
          drawTile(ctx, this.treeTile.row, this.treeTile.col, drawX, drawY, drawH);
        } else {
          drawTileByName(ctx, "tree", drawX, drawY, drawH);
        }
        return;
      }
    }

    // Draw obstacle based on type (fallback if tiles not available)
    if (this.type === "giantRock") {
      ctx.fillStyle = this.typeDef.color;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.strokeStyle = "#2d3748";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      ctx.fillStyle = "#374151";
      ctx.fillRect(drawX + 16, drawY + 16, 24, 24);
      ctx.fillRect(drawX + 88, drawY + 40, 20, 20);
    } else if (this.type === "ancientTree") {
      ctx.fillStyle = "#4a5a2a";
      ctx.fillRect(drawX + drawW / 2 - 16, drawY + drawH - 48, 32, 48);
      ctx.fillStyle = this.typeDef.canopyColor || "#1a3d0a";
      ctx.beginPath();
      ctx.arc(drawX + drawW / 2, drawY + 40, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2d5016";
      ctx.beginPath();
      ctx.arc(drawX + drawW / 2 - 16, drawY + 30, 40, 0, Math.PI * 2);
      ctx.arc(drawX + drawW / 2 + 16, drawY + 30, 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === "lavaRock") {
      ctx.fillStyle = this.typeDef.color;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      const glow = 0.3 + Math.sin(Date.now() / 500) * 0.2;
      ctx.fillStyle = this.typeDef.glowColor;
      ctx.globalAlpha = glow;
      ctx.fillRect(drawX + 8, drawY + 8, drawW - 16, drawH - 16);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#6b3410";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
    } else if (this.type === "iceBlock") {
      ctx.fillStyle = this.typeDef.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#87ceeb";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(drawX + 24, drawY + 16, 8, 8);
      ctx.fillRect(drawX + 64, drawY + 48, 6, 6);
    } else if (this.type === "barrel") {
      ctx.fillStyle = this.typeDef.color;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.strokeStyle = "#654321";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      ctx.strokeStyle = "#5a3a1a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(drawX, drawY + 24);
      ctx.lineTo(drawX + drawW, drawY + 24);
      ctx.moveTo(drawX, drawY + 56);
      ctx.lineTo(drawX + drawW, drawY + 56);
      ctx.stroke();
    } else if (this.type === "bonePile") {
      ctx.fillStyle = this.typeDef.color;
      ctx.fillRect(drawX + 8, drawY + 16, 16, 24);
      ctx.fillRect(drawX + 40, drawY + 8, 16, 32);
      ctx.beginPath();
      ctx.arc(drawX + 16, drawY + 12, 8, 0, Math.PI * 2);
      ctx.arc(drawX + 48, drawY + 16, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
