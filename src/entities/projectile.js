import { Vec2, clamp, lerp, obstacleIntersectsRect } from '../utils.js';
import { drawMagicProjectile, getMagicProjectileDrawOptions } from '../vfx/magic-projectile-renderer.js';

export const PLAYER_PROJECTILE_SPEED = 520;
export const PLAYER_PROJECTILE_SIZE = 8;
export const PLAYER_PROJECTILE_MAX_DIST = 1400;
export const PLAYER_PROJECTILE_TRAIL_LEN = 8;
export const WIND_PROJECTILE_TRAIL_LEN = 16;
export const WIND_PROJECTILE_TRAIL_LIFE = 0.35;

const enemyProjectileSpriteCache = new Map();

function getEnemyProjectileSprite(path) {
  const key = String(path || "").trim();
  if (!key) return null;
  if (enemyProjectileSpriteCache.has(key)) return enemyProjectileSpriteCache.get(key);
  const img = new Image();
  img.src = key;
  enemyProjectileSpriteCache.set(key, img);
  return img;
}

export class PlayerProjectile {
  constructor(x, y, targetX, targetY, damage, options = {}) {
    this.position = new Vec2(x, y);
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speedMult = options.speedMult != null ? options.speedMult : 1;
    const speed = PLAYER_PROJECTILE_SPEED * speedMult;
    this.velocity = new Vec2((dx / dist) * speed, (dy / dist) * speed);
    this.damage = damage;
    const sizeMult = options.sizeMult != null ? options.sizeMult : 1;
    this.size = (options.overdrive ? PLAYER_PROJECTILE_SIZE * 2 : PLAYER_PROJECTILE_SIZE) * sizeMult;
    if (options.overdrive) this.damage = this.damage * 3;
    this.elementalState = options.elementalState ?? "fire";
    this.trailPositions = [];
    this.sparks = []; // Sparks particles array
    this.distanceTraveled = 0;
    this.hitEnemyIds = new Set();
    this.maxLifetime = null;
    this.age = 0;
    this.flightTime = 0;
    this.piercesRemaining = options.piercesRemaining != null ? options.piercesRemaining : 2;
    this.piercing = this.piercesRemaining > 0;
    this.fragileShot = !!options.fragileShot;
    this.ghost = !!options.ghost;
    this.splitting = !!options.splitting;
    this.splitCount = options.splitCount || 0;
    this.maxDist = options.maxDistAbs != null
      ? options.maxDistAbs
      : PLAYER_PROJECTILE_MAX_DIST * (options.maxDistMult != null ? options.maxDistMult : 1);
    this.canSteer = options.canSteer !== false;
    this.forceHoming = !!options.forceHoming;
    this.sniperPierceFalloff = options.sniperPierceFalloff || null;
    this.currentDamageMult = 1;
    this._spawn = null;
    this.magicStyle = options.magicStyle ?? null;
    this.bounceOffWalls = !!options.bounceOffWalls;
    if (options.rectWidth != null && options.rectHeight != null) {
      this.rectWidth = options.rectWidth;
      this.rectHeight = options.rectHeight;
      this.size = Math.max(this.rectWidth, this.rectHeight);
    } else {
      this.rectWidth = null;
      this.rectHeight = null;
    }
  }

  update(dt, game = null) {
    if (this.elementalState === "wind") {
      this.trailPositions.push({
        x: this.position.x,
        y: this.position.y,
        age: 0,
        life: WIND_PROJECTILE_TRAIL_LIFE,
        width: Math.max(2.5, this.size * 0.8)
      });
      if (this.trailPositions.length > WIND_PROJECTILE_TRAIL_LEN) this.trailPositions.shift();
      for (let i = 0; i < this.trailPositions.length; i++) {
        const trailPoint = this.trailPositions[i];
        trailPoint.age = (trailPoint.age || 0) + dt;
      }
      while (this.trailPositions.length > 0 && (this.trailPositions[0].age || 0) >= (this.trailPositions[0].life || WIND_PROJECTILE_TRAIL_LIFE)) {
        this.trailPositions.shift();
      }
    } else {
      this.trailPositions.push({ x: this.position.x, y: this.position.y, age: 0, life: 1 });
      if (this.trailPositions.length > PLAYER_PROJECTILE_TRAIL_LEN) {
        this.trailPositions.shift();
      }
    }
    
    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.lifetime -= dt;
      if (spark.lifetime <= 0) {
        this.sparks.splice(i, 1);
      } else {
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
      }
    }
    
    // Spawn 1-2 tiny sparks per frame while alive
    const sparkCount = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < sparkCount; i++) {
      const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
      const angle = Math.atan2(this.velocity.y, this.velocity.x);
      // Perpendicular offset
      const perpAngle = angle + (Math.PI / 2) * (Math.random() < 0.5 ? 1 : -1);
      const offsetDist = (Math.random() - 0.5) * this.size * 0.3;
      const sparkVx = this.velocity.x * 0.3 + Math.cos(perpAngle) * offsetDist * 50;
      const sparkVy = this.velocity.y * 0.3 + Math.sin(perpAngle) * offsetDist * 50;
      
      this.sparks.push({
        x: this.position.x + this.size / 2,
        y: this.position.y + this.size / 2,
        vx: sparkVx,
        vy: sparkVy,
        lifetime: 0.08 + Math.random() * 0.07, // 0.08-0.15s
        maxLifetime: 0.08 + Math.random() * 0.07
      });
    }

    if (this.maxLifetime != null) this.age += dt;
    this.flightTime += dt;

    const homing = game && game.hasUpgradeCard && game.hasUpgradeCard("homing");
    const seeking = game && game.hasAttackUpgrade && game.hasAttackUpgrade("seeking");
    const useHoming = this.forceHoming || homing || (seeking && this.flightTime >= 0.5);
    if (this.canSteer && useHoming) {
      const px = this.position.x + this.size / 2;
      const py = this.position.y + this.size / 2;
      // Ensure hitEnemyIds is a Set for proper exclusion
      const excludeSet = this.hitEnemyIds instanceof Set ? this.hitEnemyIds : new Set();
      const target = game.getNearestEnemy(px, py, 200, excludeSet);
      if (target && !excludeSet.has(target.id)) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - px;
        const dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const curSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || PLAYER_PROJECTILE_SPEED;
        this.velocity.x = (dx / dist) * curSpeed * 0.15 + this.velocity.x * 0.85;
        this.velocity.y = (dy / dist) * curSpeed * 0.15 + this.velocity.y * 0.85;
        const vlen = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || 1;
        this.velocity.x = (this.velocity.x / vlen) * curSpeed;
        this.velocity.y = (this.velocity.y / vlen) * curSpeed;
      }
    }

    if (game && game.hasAttackUpgrade && game.hasAttackUpgrade("splitting") && this.splitting && this.splitCount < 4 && this.flightTime >= 1 && this.hitEnemyIds.size === 0) {
      const curSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || PLAYER_PROJECTILE_SPEED;
      const angle = Math.atan2(this.velocity.y, this.velocity.x);
      const spreadRad = (15 * Math.PI / 180) / 2;
      const opt = {
        speedMult: curSpeed / PLAYER_PROJECTILE_SPEED,
        maxDistAbs: this.maxDist,
        piercesRemaining: this.piercesRemaining,
        fragileShot: this.fragileShot,
        splitting: true,
        splitCount: this.splitCount + 1,
        ghost: this.ghost,
        sizeMult: this.size / PLAYER_PROJECTILE_SIZE,
        canSteer: this.canSteer,
        sniperPierceFalloff: this.sniperPierceFalloff
      };
      const p1 = new PlayerProjectile(this.position.x, this.position.y, this.position.x + Math.cos(angle - spreadRad) * 100, this.position.y + Math.sin(angle - spreadRad) * 100, this.damage, opt);
      p1.velocity.x = Math.cos(angle - spreadRad) * curSpeed;
      p1.velocity.y = Math.sin(angle - spreadRad) * curSpeed;
      p1.hitEnemyIds = new Set(this.hitEnemyIds);
      p1.maxLifetime = this.maxLifetime;
      p1.currentDamageMult = this.currentDamageMult;
      const p2 = new PlayerProjectile(this.position.x, this.position.y, this.position.x + Math.cos(angle + spreadRad) * 100, this.position.y + Math.sin(angle + spreadRad) * 100, this.damage, opt);
      p2.velocity.x = Math.cos(angle + spreadRad) * curSpeed;
      p2.velocity.y = Math.sin(angle + spreadRad) * curSpeed;
      p2.hitEnemyIds = new Set(this.hitEnemyIds);
      p2.maxLifetime = this.maxLifetime;
      p2.currentDamageMult = this.currentDamageMult;
      this._spawn = [p1, p2];
    }

    const moveX = this.velocity.x * dt;
    const moveY = this.velocity.y * dt;
    this.position.x += moveX;
    this.position.y += moveY;
    this.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
  }

  isExpired() {
    if (this.maxLifetime != null && this.age >= this.maxLifetime) return true;
    if (this.ghost) return this.distanceTraveled >= this.maxDist * 3;
    return this.distanceTraveled >= this.maxDist;
  }

  intersects(other) {
    const w = this.rectWidth ?? this.size;
    const h = this.rectHeight ?? this.size;
    const a = { x: this.position.x, y: this.position.y, w, h };
    const isObstacle = other && typeof other?.size?.w === "number" && (other.typeDef || other.type || other.blocksMovement || other.blocksProjectiles);
    if (isObstacle) return obstacleIntersectsRect(other, a);
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  draw(ctx, camera) {
    const w = this.rectWidth ?? this.size;
    const h = this.rectHeight ?? this.size;
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    const cx = sx + w / 2;
    const cy = sy + h / 2;

    if (this.magicStyle) {
      const opts = getMagicProjectileDrawOptions(this.magicStyle, {
        sx,
        sy,
        angle,
        size: this.size,
        trailPositions: this.trailPositions,
        camera,
        time: this.flightTime,
      });
      drawMagicProjectile(ctx, opts);
      return;
    }

    const el = this.elementalState || "fire";
    const colors = el === "wind"
      ? { trail: "100, 239, 172", glow: "134, 239, 172", core: "255, 255, 255", spark: "134, 239, 172" }
      : el === "lightning"
        ? { trail: "254, 240, 138", glow: "250, 204, 21", core: "254, 249, 195", spark: "250, 204, 21" }
        : { trail: "255, 180, 100", glow: "251, 146, 60", core: "255, 220, 180", spark: "255, 150, 50" };

    // Calculate speed and stretch factor
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const stretch = clamp(speed * 0.015, 0.0, 1.2);
    const scaleX = 1.0 + stretch;
    const scaleY = 1.0;
    const isRect = this.rectWidth != null && this.rectHeight != null;
    
    if (el === "wind") {
      const trail = this.trailPositions;
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const cur = trail[i];
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const segLen = Math.hypot(dx, dy);
        if (segLen < 1) continue;
        const age = Number(cur.age) || 0;
        const life = Number(cur.life) || WIND_PROJECTILE_TRAIL_LIFE;
        const alpha = Math.max(0, 1 - age / life);
        const tailWidth = isRect ? ((prev.width || this.size) * 0.7) : ((prev.width || this.size) * 0.5);
        const x1 = Math.floor(prev.x - camera.position.x);
        const y1 = Math.floor(prev.y - camera.position.y);
        const x2 = Math.floor(cur.x - camera.position.x);
        const y2 = Math.floor(cur.y - camera.position.y);
        const width = Math.max(2.2, tailWidth * (0.45 + (i / trail.length)));

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(182, 244, 255, ${Math.max(0.02, alpha * 0.26)})`;
        ctx.shadowColor = `rgba(200, 248, 255, ${Math.max(0.02, alpha * 0.42)})`;
        ctx.shadowBlur = 10;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(210, 250, 255, ${Math.max(0.02, alpha * 0.16)})`;
        ctx.beginPath();
        ctx.ellipse(x2, y2, width * 0.9, width * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw trail afterimages (oldest to newest)
    if (el !== "wind") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.imageSmoothingEnabled = false;
      const trailN = this.trailPositions.length;
      for (let i = 0; i < trailN; i++) {
        const t = this.trailPositions[i];
        const trailSx = Math.floor(t.x - camera.position.x);
        const trailSy = Math.floor(t.y - camera.position.y);
        const progress = (i + 1) / trailN;
        const alpha = progress * 0.35;
        const sizeMul = lerp(0.6, 1.0, progress);
        const trailW = (isRect ? this.rectWidth : this.size) * sizeMul;
        const trailH = (isRect ? this.rectHeight : this.size) * sizeMul;
        const trailCx = trailSx + (isRect ? this.rectWidth : this.size) / 2;
        const trailCy = trailSy + (isRect ? this.rectHeight : this.size) / 2;
        ctx.save();
        ctx.translate(trailCx, trailCy);
        ctx.rotate(angle);
        if (isRect) {
          ctx.scale(scaleX * sizeMul, scaleY * sizeMul);
          ctx.fillStyle = `rgba(${colors.trail}, ${alpha})`;
          ctx.fillRect(-trailW / 2, -trailH / 2, trailW, trailH);
        } else {
          const trailSize = this.size * sizeMul;
          ctx.scale(scaleX * sizeMul, scaleY * sizeMul);
          ctx.fillStyle = `rgba(${colors.trail}, ${alpha})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, trailSize / 2, trailSize / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // Draw main projectile core with glow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    if (isRect) {
      ctx.fillStyle = `rgba(${colors.glow}, 0.6)`;
      ctx.fillRect(-w / 2 * 1.2, -h / 2 * 1.2, w * 1.2, h * 1.2);
      ctx.fillStyle = `rgba(${colors.core}, 0.9)`;
      ctx.fillRect(-w / 2 * 0.7, -h / 2 * 0.7, w * 0.7, h * 0.7);
    } else {
      const windFill = el === "wind";
      ctx.fillStyle = `rgba(${colors.glow}, ${windFill ? 0.2 : 0.6})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size / 2 * 1.2, this.size / 2 * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${colors.core}, ${windFill ? 0.7 : 0.9})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size / 2 * 0.7, this.size / 2 * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      if (el === "fire" && Math.random() < 0.3) {
        ctx.fillStyle = `rgba(255, 150, 50, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size / 2 * 0.4, this.size / 2 * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.restore();
    
    // Draw sparks
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const spark of this.sparks) {
      const sparkSx = Math.floor(spark.x - camera.position.x);
      const sparkSy = Math.floor(spark.y - camera.position.y);
      const sparkAlpha = spark.lifetime / spark.maxLifetime;
      const sparkSize = 1.5 * sparkAlpha;
      
      ctx.fillStyle = `rgba(${colors.spark}, ${sparkAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(sparkSx, sparkSy, sparkSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    
    ctx.imageSmoothingEnabled = true;
  }
}

// -------- Projectile (boss attacks) --------

// EnemyProjectile - same as Projectile but owner="enemy" for collision vs player
export class EnemyProjectile {
  constructor(x, y, vx, vy, damage, size = 12, color = "#ef4444", options = {}) {
    this.position = new Vec2(x, y);
    this.prevPosition = new Vec2(x, y);
    this.velocity = new Vec2(vx, vy);
    this.damage = damage;
    this.size = size;
    this.color = color;
    this.owner = "enemy";
    this.trailPositions = [];
    this.slowZone = options.slowZone ?? false;
    this.slowRadius = options.slowRadius ?? 50;
    this.slowDuration = options.slowDuration ?? 1.5;
    this.slowMult = options.slowMult ?? 0.65;
    this.lifetime = options.lifetime ?? 4;
    this.age = 0;
    this.spritePath = options.spritePath || null;
    this.spriteImage = this.spritePath ? getEnemyProjectileSprite(this.spritePath) : null;
    this.magicStyle = options.magicStyle ?? null;
    this.movementType = options.movementType ?? null;
    this.spiralDirection = options.spiralDirection ?? 1;
    this.homingTurnRate = options.homingTurnRate ?? 0;
    this.speedRampDuration = options.speedRampDuration ?? 0;
    this.speedRampEnd = options.speedRampEnd ?? null;
    this.poisonOnHit = options.poisonOnHit ?? false;
    this.poisonDuration = options.poisonDuration ?? null;
    this.poisonDmgPerSec = options.poisonDmgPerSec ?? null;
    this.lichOrbBurst = options.lichOrbBurst ?? null;
    if (this.speedRampDuration > 0 && this.speedRampEnd != null) {
      const speed = Math.sqrt(vx * vx + vy * vy) || 1;
      this._speedRampDir = { x: vx / speed, y: vy / speed };
      this._speedRampStart = speed;
    }
    if (this.movementType === "zigzag") {
      const speed = Math.sqrt(vx * vx + vy * vy) || 1;
      this._zigzagSpeed = speed;
      this._zigzagBaseDir = { x: vx / speed, y: vy / speed };
      this._zigzagSeed = Math.random() * 1000;
      this._zigzagAmplitude = options.zigzagAmplitude ?? 0.6;
    }
    if (this.movementType === "spiral") {
      const speed = Math.sqrt(vx * vx + vy * vy) || 1;
      this._spiralSpeed = speed;
      this._spiralBaseAngle = Math.atan2(vy, vx);
      this._spiralDirection = Number(this.spiralDirection) || 1;
    }
  }

  update(dt, game = null) {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;
    this.trailPositions.push({ x: this.position.x, y: this.position.y });
    if (this.trailPositions.length > 6) this.trailPositions.shift();
    if (this.movementType === "zigzag") {
      const base = this._zigzagBaseDir;
      const perp = { x: -base.y, y: base.x };
      const freq = 8;
      const amp = this._zigzagAmplitude ?? 0.6;
      const phase = this.age * freq + this._zigzagSeed;
      const oscillation = Math.sin(phase) * amp;
      let dx = base.x + perp.x * oscillation;
      let dy = base.y + perp.y * oscillation;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len;
      dy /= len;
      this.velocity.x = dx * this._zigzagSpeed;
      this.velocity.y = dy * this._zigzagSpeed;
    } else if (this.movementType === "spiral") {
      const turnRate = 2.5 * this._spiralDirection;
      const angle = this._spiralBaseAngle + this.age * turnRate;
      this.velocity.x = Math.cos(angle) * this._spiralSpeed;
      this.velocity.y = Math.sin(angle) * this._spiralSpeed;
    } else if (this.homingTurnRate > 0 && game?.player) {
      const px = this.position.x + this.size / 2;
      const py = this.position.y + this.size / 2;
      const tx = game.player.position.x + game.player.size / 2;
      const ty = game.player.position.y + game.player.size / 2;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      const curAngle = Math.atan2(this.velocity.y, this.velocity.x);
      let diff = wantAngle - curAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = clamp(diff, -this.homingTurnRate * dt, this.homingTurnRate * dt);
      const newAngle = curAngle + turn;
      const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y) || 1;
      this.velocity.x = Math.cos(newAngle) * speed;
      this.velocity.y = Math.sin(newAngle) * speed;
    } else if (this._speedRampDir && this.speedRampDuration > 0 && this.speedRampEnd != null) {
      const t = Math.min(this.age, this.speedRampDuration);
      const speed = lerp(this._speedRampStart, this.speedRampEnd, t / this.speedRampDuration);
      this.velocity.x = this._speedRampDir.x * speed;
      this.velocity.y = this._speedRampDir.y * speed;
    }
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.age += dt;
  }

  isExpired() {
    return this.age >= this.lifetime;
  }

  intersects(other) {
    const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
    const isObstacle = other && typeof other?.size?.w === "number" && (other.typeDef || other.type || other.blocksMovement || other.blocksProjectiles);
    if (isObstacle) return obstacleIntersectsRect(other, a);
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    const outlineWidth = 5;

    if (this.spriteImage && this.spriteImage.complete && this.spriteImage.naturalWidth > 0 && this.spriteImage.naturalHeight > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(sx + this.size / 2, sy + this.size / 2);
      ctx.rotate(angle);
      ctx.drawImage(this.spriteImage, -this.size / 2, -this.size / 2, this.size, this.size);
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = outlineWidth;
      ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.restore();
      return;
    }

    if (this.magicStyle) {
      const base = this.magicStyle.preset != null
        ? this.magicStyle.preset
        : this.magicStyle;
      const opts = getMagicProjectileDrawOptions(base, {
        sx,
        sy,
        angle,
        size: this.size,
        primaryColor: this.magicStyle.primaryColor ?? this.color,
        secondaryColor: this.magicStyle.secondaryColor,
        trailPositions: this.trailPositions,
        camera,
        time: this.age,
        ...this.magicStyle,
      });
      drawMagicProjectile(ctx, opts);
      ctx.save();
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const trailN = this.trailPositions.length;
    for (let i = 0; i < trailN; i++) {
      const t = this.trailPositions[i];
      const tsx = Math.floor(t.x - camera.position.x);
      const tsy = Math.floor(t.y - camera.position.y);
      const progress = (i + 1) / trailN;
      ctx.globalAlpha = progress * 0.4;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(tsx + this.size / 2, tsy + this.size / 2, this.size / 2 * (0.5 + progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = outlineWidth;
    ctx.beginPath();
    ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export class Projectile {
  constructor(x, y, vx, vy, damage, size = 12, color = "#ef4444") {
    this.position = new Vec2(x, y);
    this.prevPosition = new Vec2(x, y);
    this.velocity = new Vec2(vx, vy);
    this.damage = damage;
    this.size = size;
    this.color = color;
    this.trailPositions = []; // For VFX trails (N=6)
  }

  update(dt) {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;
    // Update trail
    this.trailPositions.push({ x: this.position.x, y: this.position.y });
    if (this.trailPositions.length > 6) {
      this.trailPositions.shift();
    }
    
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }

  intersects(other) {
    const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
    const isObstacle = other && typeof other?.size?.w === "number" && (other.typeDef || other.type || other.blocksMovement || other.blocksProjectiles);
    if (isObstacle) return obstacleIntersectsRect(other, a);
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    
    // Draw trail with additive blend
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const trailN = this.trailPositions.length;
    for (let i = 0; i < trailN; i++) {
      const t = this.trailPositions[i];
      const trailSx = Math.floor(t.x - camera.position.x);
      const trailSy = Math.floor(t.y - camera.position.y);
      const progress = (i + 1) / trailN;
      const alpha = progress * 0.4;
      const sizeMul = 0.5 + progress * 0.5;
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(trailSx + this.size / 2, trailSy + this.size / 2, this.size / 2 * sizeMul, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    
    // Draw main projectile
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}


