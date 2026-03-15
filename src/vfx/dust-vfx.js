// -------- Walking dust VFX --------
// Dust puffs spawn behind the player while moving; pooled, single-play animation.

// --- Config (tuning knobs) ---
const SPEED_THRESHOLD = 5;
const BASE_RATE_WALK = 8;
const BASE_RATE_DASH = 15;
const FPS = 24;
const BEHIND_DIST = 12;
const OFFSET_PERP_MIN = 3;
const OFFSET_PERP_MAX = 8;
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.2;
const DRIFT_Y = -8;
const FADE_START = 0.6;
const POOL_SIZE = 128;
const DUST_IMAGE_PATH = "assets/images/Dust_02.png";

export const DUST_VFX_CONFIG = {
  SPEED_THRESHOLD,
  BASE_RATE_WALK,
  BASE_RATE_DASH,
  FPS,
  BEHIND_DIST,
  OFFSET_PERP_MIN,
  OFFSET_PERP_MAX,
  SCALE_MIN,
  SCALE_MAX,
  DRIFT_Y,
  FADE_START,
  POOL_SIZE,
  DUST_IMAGE_PATH,
};

function randIn(min, max) {
  return min + Math.random() * (max - min);
}

export class DustPuff {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.age = 0;
    this.lifetime = 0;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.alpha = 1;
    this.scale = 1;
    this.rotation = 0;
    this.active = false;
    this.frameW = 0;
    this.frameH = 0;
    this.frameCount = 0;
    this.image = null;
    this.flipX = false;
  }

  spawn(x, y, frameW, frameH, frameCount, image, fps, flipX = false) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = DRIFT_Y * 0.3;
    this.age = 0;
    this.lifetime = frameCount / fps;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.alpha = 1;
    this.scale = randIn(SCALE_MIN, SCALE_MAX);
    this.rotation = randIn(-0.15, 0.15);
    this.active = true;
    this.frameW = frameW;
    this.frameH = frameH;
    this.frameCount = frameCount;
    this.image = image;
    this._fps = fps;
    this.flipX = flipX;
  }

  update(dt) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.lifetime) {
      this.active = false;
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.frameTimer += dt;
    const frameDur = 1 / this._fps;
    while (this.frameTimer >= frameDur && this.frameIndex < this.frameCount - 1) {
      this.frameTimer -= frameDur;
      this.frameIndex++;
    }
    const lifeRatio = this.age / this.lifetime;
    if (lifeRatio >= FADE_START) {
      this.alpha = 1 - (lifeRatio - FADE_START) / (1 - FADE_START);
    }
  }

  render(ctx, camera) {
    if (!this.active || !this.image || this.frameCount === 0) return;
    const sx = this.x - camera.position.x;
    const sy = this.y - camera.position.y;
    const w = this.frameW * this.scale;
    const h = this.frameH * this.scale;
    const cx = sx + w / 2;
    const cy = sy + h / 2;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    if (this.flipX) ctx.scale(-1, 1);
    ctx.drawImage(
      this.image,
      this.frameIndex * this.frameW,
      0,
      this.frameW,
      this.frameH,
      -w / 2,
      -h / 2,
      w,
      h
    );
    ctx.restore();
  }
}

export class DustEmitter {
  constructor() {
    this.pool = [];
    this.active = [];
    this.emitTimer = 0;
    this.image = new Image();
    this.image.src = DUST_IMAGE_PATH;
    this.frameW = 0;
    this.frameH = 0;
    this.frameCount = 0;
    this._ready = false;
    this.image.onload = () => this._onImageLoad();
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(new DustPuff());
    }
    this.debugShowSpawnPoints = false;
  }

  _onImageLoad() {
    const w = this.image.naturalWidth;
    const h = this.image.naturalHeight;
    if (h <= 0) return;
    if (w % h === 0) {
      this.frameW = h;
      this.frameH = h;
      this.frameCount = w / h;
    } else {
      this.frameW = h;
      this.frameH = h;
      this.frameCount = Math.max(1, Math.floor(w / h));
    }
    this._ready = true;
  }

  _getMovementInfo(game) {
    const axis = game.input.getAxis();
    const ax = axis.x ?? 0;
    const ay = axis.y ?? 0;
    const len = Math.sqrt(ax * ax + ay * ay);
    const speed = game.player.speed || 220;
    const moveMult = typeof game.player.getAttackMoveMult === "function" ? game.player.getAttackMoveMult() : 1;
    const effectiveSpeed = speed * moveMult;
    const moveSpeed = len * effectiveSpeed;
    const isDashing = !!game.dashActive;
    const isDead = game.currentHealth != null && game.currentHealth <= 0;
    const isStunned = game.stunTimer != null && game.stunTimer > 0;
    return { ax, ay, len, moveSpeed, isDashing, isDead, isStunned, effectiveSpeed };
  }

  update(dt, game) {
    if (!this._ready || this.frameCount <= 0) return;
    const info = this._getMovementInfo(game);
    if (info.isDead || info.isStunned || info.moveSpeed < SPEED_THRESHOLD) {
      this.emitTimer = Math.max(0, this.emitTimer - dt * 2);
      for (let i = this.active.length - 1; i >= 0; i--) {
        const p = this.active[i];
        p.update(dt);
        if (!p.active) {
          this.pool.push(p);
          this.active.splice(i, 1);
        }
      }
      return;
    }

    const baseRate = info.isDashing ? BASE_RATE_DASH : BASE_RATE_WALK;
    const speedRatio = Math.min(1.8, Math.max(0.7, info.moveSpeed / (info.effectiveSpeed * 0.6)));
    const rate = baseRate * speedRatio;
    const interval = 1 / rate;
    this.emitTimer += dt;
    while (this.emitTimer >= interval && this.pool.length > 0) {
      this.emitTimer -= interval;
      const playerLeft = game.player.position.x;
      const playerRight = game.player.position.x + game.player.size;
      const playerCenterY = game.player.position.y + game.player.size / 2;
      const perpOffset = randIn(OFFSET_PERP_MIN, OFFSET_PERP_MAX) * (Math.random() < 0.5 ? 1 : -1);
      const movingRight = info.ax > 0.01;
      const movingLeft = info.ax < -0.01;
      let spawnX;
      if (movingRight) {
        spawnX = playerLeft - this.frameW / 2;
      } else if (movingLeft) {
        spawnX = playerRight - this.frameW / 2;
      } else {
        const playerCenterX = game.player.position.x + game.player.size / 2;
        const inv = info.len < 0.001 ? 1 : 1 / info.len;
        const moveX = info.ax * inv;
        const moveY = info.ay * inv;
        spawnX = playerCenterX - moveX * BEHIND_DIST;
      }
      spawnX += randIn(-2, 2);
      const spawnY = playerCenterY + perpOffset + randIn(-2, 2);
      const flipX = info.ax > 0.01;
      const puff = this.pool.pop();
      puff.spawn(spawnX, spawnY, this.frameW, this.frameH, this.frameCount, this.image, FPS, flipX);
      this.active.push(puff);
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.update(dt);
      if (!p.active) {
        this.pool.push(p);
        this.active.splice(i, 1);
      }
    }
  }

  render(ctx, camera) {
    if (!this._ready) return;
    for (const p of this.active) {
      p.render(ctx, camera);
    }
    if (this.debugShowSpawnPoints) {
      ctx.fillStyle = "rgba(255, 200, 0, 0.6)";
      for (const p of this.active) {
        const sx = p.x - camera.position.x;
        const sy = p.y - camera.position.y;
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }
  }
}
