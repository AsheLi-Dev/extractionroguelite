import { Vec2, obstacleIntersectsRect } from '../utils.js';
import { drawTile, drawTileByName, isTileAtlasLoaded } from './tile-system.js';

/** @type {HTMLCanvasElement | null} */
let treeRadialScratch = null;

function getTreeRadialScratch(w, h) {
  if (!treeRadialScratch) treeRadialScratch = document.createElement('canvas');
  if (treeRadialScratch.width !== w || treeRadialScratch.height !== h) {
    treeRadialScratch.width = w;
    treeRadialScratch.height = h;
  }
  return treeRadialScratch;
}

/** Min distance from point (px,py) to axis-aligned rect. */
function distPointToRect(px, py, rx, ry, rw, rh) {
  if (rw <= 0 || rh <= 0) return Infinity;
  const cx = Math.max(rx, Math.min(px, rx + rw));
  const cy = Math.max(ry, Math.min(py, ry + rh));
  return Math.hypot(px - cx, py - cy);
}

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
        const ws =
          (this.type === "giantRock" || this.type === "ancientTree") &&
          Number.isFinite(typeDef.worldScale) &&
          typeDef.worldScale > 0
            ? typeDef.worldScale
            : 1;
        this.size = {
          w: Math.max(1, Math.round(nw * ws)),
          h: Math.max(1, Math.round(nh * ws)),
        };
      };
      this._spriteImage.src = src;
      this._spriteFlipH = Math.random() < 0.5;
      if (this.type === "giantRock") this._giantRockSpriteSrc = src;
      if (this.type === "ancientTree") this._ancientTreeSpriteSrc = src;
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

    if (this.type === "knightStoneWall") {
      if (Number.isFinite(this.expiresAt) && game.time >= this.expiresAt) {
        this.destroyed = true;
        return;
      }
      const auraRadius = Math.max(0, Number(this.auraRadius) || 96);
      const slowMagnitude = Math.max(0.05, Math.min(1, Number(this.slowMagnitude) || 0.2));
      const slowDuration = Math.max(0.05, Number(this.slowDuration) || 0.2);
      const affectEntity = (entityOrId) => {
        const entity = entityOrId === 'player' ? game.player : entityOrId;
        if (!entity || entity.isDead) return;
        const ex = entity.position.x + ((entity.size?.w ?? entity.size) || 0) / 2;
        const ey = entity.position.y + ((entity.size?.h ?? entity.size) || 0) / 2;
        if (distPointToRect(ex, ey, this.position.x, this.position.y, this.size.w, this.size.h) > auraRadius) return;
        game.applyStatusToEntity(entityOrId === 'player' ? 'player' : entity.id, 'slow', {
          duration: slowDuration,
          magnitude: slowMagnitude,
          sourceId: this.id,
          sourceType: 'player_skill'
        });
      };
      affectEntity('player');
      for (const enemy of game.enemySystem?.enemies || []) affectEntity(enemy);
      if (game.enemySystem?.boss && !game.enemySystem.boss.isDead) affectEntity(game.enemySystem.boss);
    }
  }

  /**
   * Ancient tree only: when the player is behind the tree (Y-sort: tree draws on top), multiply
   * sprite alpha by a radial mask centered on the player (near player → min alpha, at radius → max).
   * Otherwise draws the tree normally. Bakes horizontal flip into scratch.
   */
  _drawAncientTreePlayerCircleFade(ctx, img, screenX, screenY, dw, dh, camera, game, spriteFlipH) {
    const p = game?.player;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!p || !nw || !nh) {
      this._drawSpriteSimple(ctx, img, screenX, screenY, dw, dh, nw, nh, spriteFlipH);
      return;
    }

    const ps = Math.max(1, p.size || 0);
    const pSort = p.position.y + ps;
    const th = this.size.h || 0;
    const tr = Number(this.typeDef?.ySortHeightRatio);
    const yFrac = Number.isFinite(tr) && tr >= 0 ? tr : 1.2;
    const treeSort = this.position.y + th * yFrac;
    if (pSort >= treeSort) {
      this._drawSpriteSimple(ctx, img, screenX, screenY, dw, dh, nw, nh, spriteFlipH);
      return;
    }

    const pcxW = p.position.x + ps / 2;
    const pcyW = p.position.y + ps / 2;
    const R = Math.max(
      8,
      Number.isFinite(Number(this.typeDef.canopyFadeRadius)) ? Number(this.typeDef.canopyFadeRadius) : 130
    );
    const aMin = Math.min(
      1,
      Math.max(0, Number.isFinite(Number(this.typeDef.canopyFadeMinAlpha)) ? Number(this.typeDef.canopyFadeMinAlpha) : 0.4)
    );
    const aMax = Math.min(
      1,
      Math.max(0, Number.isFinite(Number(this.typeDef.canopyFadeMaxAlpha)) ? Number(this.typeDef.canopyFadeMaxAlpha) : 1)
    );

    const minWorldDist = distPointToRect(pcxW, pcyW, this.position.x, this.position.y, this.size.w, this.size.h);
    if (minWorldDist > R) {
      this._drawSpriteSimple(ctx, img, screenX, screenY, dw, dh, nw, nh, spriteFlipH);
      return;
    }

    const pcx = pcxW - camera.position.x;
    const pcy = pcyW - camera.position.y;
    const lx = pcx - screenX;
    const ly = pcy - screenY;

    const scratch = getTreeRadialScratch(dw, dh);
    const tctx = scratch.getContext('2d');
    if (!tctx) {
      this._drawSpriteSimple(ctx, img, screenX, screenY, dw, dh, nw, nh, spriteFlipH);
      return;
    }

    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, dw, dh);
    tctx.imageSmoothingEnabled = false;
    if (spriteFlipH) {
      tctx.translate(dw, 0);
      tctx.scale(-1, 1);
    }
    tctx.drawImage(img, 0, 0, nw, nh, 0, 0, dw, dh);
    tctx.setTransform(1, 0, 0, 1, 0, 0);

    const lo = Math.min(aMin, aMax);
    const hi = Math.max(aMin, aMax);
    const g = tctx.createRadialGradient(lx, ly, 0, lx, ly, R);
    g.addColorStop(0, `rgba(255,255,255,${lo})`);
    g.addColorStop(1, `rgba(255,255,255,${hi})`);

    tctx.globalCompositeOperation = 'destination-in';
    tctx.fillStyle = g;
    tctx.fillRect(0, 0, dw, dh);
    tctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(scratch, screenX, screenY);
  }

  _drawSpriteSimple(ctx, img, screenX, screenY, dw, dh, nw, nh, spriteFlipH) {
    if (spriteFlipH) {
      ctx.save();
      const cx = screenX + dw / 2;
      const cy = screenY + dh / 2;
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-cx, -cy);
      ctx.drawImage(img, 0, 0, nw, nh, screenX, screenY, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, nw, nh, screenX, screenY, dw, dh);
    }
  }

  /**
   * @param {object | null} [game] - Passed for ancient-tree radial alpha vs player (trees only).
   */
  draw(ctx, camera, game = null) {
    if (this.destroyed) return;
    
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const scale =
      this.type === "ruinPillar" || this.type === "giantRock" || this.type === "ancientTree" ? 1 : 2;
    const drawW = this.size.w * scale;
    const drawH = this.size.h * scale;
    const drawX = sx - (drawW - this.size.w) / 2;
    const drawY = sy - (drawH - this.size.h) / 2;
    const floorDrawX =
      this.type === "ruinPillar" || this.type === "giantRock" || this.type === "ancientTree"
        ? Math.floor(drawX)
        : drawX;
    const floorDrawY =
      this.type === "ruinPillar" || this.type === "giantRock" || this.type === "ancientTree"
        ? Math.floor(drawY)
        : drawY;

    ctx.fillStyle = this.typeDef.shadowColor || "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(floorDrawX + 4, floorDrawY + drawH - 8, drawW, 12);

    if (
      (this.type === "ruinPillar" ||
        this.type === "giantRock" ||
        this.type === "ancientTree") &&
      this._spriteImage
    ) {
      if (this._spriteImage.complete && this._spriteImage.naturalWidth) {
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        const img = this._spriteImage;
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (this.type === "ancientTree" && game?.player) {
          this._drawAncientTreePlayerCircleFade(
            ctx,
            img,
            floorDrawX,
            floorDrawY,
            drawW,
            drawH,
            camera,
            game,
            this._spriteFlipH
          );
        } else {
          this._drawSpriteSimple(ctx, img, floorDrawX, floorDrawY, drawW, drawH, nw, nh, this._spriteFlipH);
        }
        ctx.imageSmoothingEnabled = prevSmoothing;
      } else {
        ctx.fillStyle =
          this.typeDef.color ||
          (this.type === "giantRock" ? "#4a5568" : this.type === "ancientTree" ? "#2d5016" : "#5a5a6a");
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
      }
    }

    // Draw obstacle based on type (fallback if tiles not available)
    if (this.type === "lavaRock") {
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
    } else if (this.type === "knightStoneWall") {
      const glow = 0.18 + Math.sin(Date.now() / 240) * 0.06;
      ctx.fillStyle = this.typeDef.color;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      ctx.globalAlpha = Math.max(0.08, glow);
      ctx.fillStyle = this.typeDef.glowColor;
      ctx.fillRect(drawX + 4, drawY + 4, Math.max(1, drawW - 8), Math.max(1, drawH - 8));
      ctx.globalAlpha = 1;
      for (let i = 1; i < 3; i++) {
        const crackX = drawX + (drawW * i) / 3;
        ctx.beginPath();
        ctx.moveTo(crackX, drawY + 3);
        ctx.lineTo(crackX - 5, drawY + drawH * 0.35);
        ctx.lineTo(crackX + 4, drawY + drawH * 0.7);
        ctx.lineTo(crackX - 2, drawY + drawH - 3);
        ctx.stroke();
      }
    }
  }
}
