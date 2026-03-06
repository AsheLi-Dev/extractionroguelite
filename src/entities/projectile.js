import { Vec2, clamp, lerp, obstacleIntersectsRect } from '../utils.js';

export const PLAYER_PROJECTILE_SPEED = 520;
export const PLAYER_PROJECTILE_SIZE = 8;
export const PLAYER_PROJECTILE_MAX_DIST = 1400;
export const PLAYER_PROJECTILE_TRAIL_LEN = 8; // Increased for better trail effect

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
    this.trail = [];
    this.trailPositions = []; // New trail array for afterimages (N=8)
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
  }

  update(dt, game = null) {
    // Update trail positions (for afterimages)
    this.trailPositions.push({ x: this.position.x, y: this.position.y });
    if (this.trailPositions.length > PLAYER_PROJECTILE_TRAIL_LEN) {
      this.trailPositions.shift();
    }
    
    // Keep old trail for backward compatibility
    this.trail.push({ x: this.position.x, y: this.position.y });
    if (this.trail.length > PLAYER_PROJECTILE_TRAIL_LEN) this.trail.shift();
    
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
    
    // Calculate speed and stretch factor
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const stretch = clamp(speed * 0.015, 0.0, 1.2);
    const scaleX = 1.0 + stretch;
    const scaleY = 1.0;
    
    // Calculate angle from velocity
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    
    // Draw trail afterimages (oldest to newest)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = false;
    
    const trailN = this.trailPositions.length;
    for (let i = 0; i < trailN; i++) {
      const t = this.trailPositions[i];
      const trailSx = Math.floor(t.x - camera.position.x);
      const trailSy = Math.floor(t.y - camera.position.y);
      
      // Decreasing alpha and size from oldest to newest
      const progress = (i + 1) / trailN;
      const alpha = progress * 0.35;
      const sizeMul = lerp(0.6, 1.0, progress);
      const trailSize = this.size * sizeMul;
      const trailScaleX = scaleX * sizeMul;
      const trailScaleY = scaleY * sizeMul;
      
      ctx.save();
      ctx.translate(trailSx + this.size / 2, trailSy + this.size / 2);
      ctx.rotate(angle);
      ctx.scale(trailScaleX, trailScaleY);
      
      // Draw trail segment as stretched ellipse
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, trailSize / 2, trailSize / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
    
    // Draw main projectile core with glow
    ctx.save();
    ctx.translate(sx + this.size / 2, sy + this.size / 2);
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    
    // Outer glow (cyan)
    ctx.fillStyle = `rgba(100, 220, 255, 0.6)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size / 2 * 1.2, this.size / 2 * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner bright core (white)
    ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size / 2 * 0.7, this.size / 2 * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Optional subtle orange embers
    if (Math.random() < 0.3) {
      ctx.fillStyle = `rgba(255, 150, 50, 0.4)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size / 2 * 0.4, this.size / 2 * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
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
      
      ctx.fillStyle = `rgba(150, 220, 255, ${sparkAlpha * 0.8})`;
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
    this.lifetime = options.lifetime ?? 4;
    this.age = 0;
  }

  update(dt) {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;
    this.trailPositions.push({ x: this.position.x, y: this.position.y });
    if (this.trailPositions.length > 6) this.trailPositions.shift();
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









