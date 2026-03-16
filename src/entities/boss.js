import { Vec2 } from '../utils.js';

export const BOSS_MAX_HP = 800;
export const BOSS_ATTACK = 25;
export const BOSS_BASE_SPEED = 55;
export const BOSS_SIZE = 360;

export class Boss {
  constructor(x, y) {
    this.id = "boss";
    this.isBoss = true;
    this.position = new Vec2(x, y);
    this.size = BOSS_SIZE;
    this.name = "Wasteland Tyrant";
    this.color = "#8b0000";
    this.maxHealth = BOSS_MAX_HP;
    this.health = BOSS_MAX_HP;
    this.attack = BOSS_ATTACK;
    this.speed = BOSS_BASE_SPEED;
    this.attackCooldown = 1.2;
    this.attackTimer = 0;
    this.hitFlashTimer = 0;
    this.healthBarShakeTimer = 0;

    this.phase2 = false;
    this.transitionActive = false;
    this.transitionStartTime = null;
    this.transitionDuration = 3.0; // 3 seconds transition
    this.bloodParticles = []; // Blood red particles during transition
    this.chargeCooldown = 4;
    this.chargeTimer = 0;
    this.chargeActive = false;
    this.chargeDir = new Vec2(0, 0);
    this.chargeSpeed = 420;

    this.projectileCooldown = 2.5;
    this.projectileTimer = 0;

    this.minionCooldown = 8;
    this.minionTimer = 0;

    this.defense = 5;
    // Migrated statuses are mirrored here for legacy readers; the status manager owns runtime state.
    this.burnUntil = null;
    this.burnDps = 0;
    this.burnAccum = 0;
    this.slowUntil = null;
    this.slowMult = 1;
    this.stunUntil = null;
    this.toxicStacks = 0;
    this.toxicUntil = null;
    this.toxicAccum = 0;
    this.voidDefenseUntil = null;
    this.voidDefenseMult = 1;

    // Green glowing particle trail
    this.particleTrail = []; // Array of {x, y, life, maxLife}
    this.trailSpawnTimer = 0;
    this.trailSpawnInterval = 0.05; // Spawn particle every 0.05 seconds

    // Phase 1 sprite sheet configuration (GameMaster Idle: 48x1)
    this.spriteSheet = {
      columns: 48,
      rows: 1,
      frameTime: 1 / 16
    };

    // Load phase 1 sprite sheet
    this.sprite = new Image();
    this.spriteLoaded = false;
    this.sprite.onload = () => {
      this.spriteLoaded = true;
      // Calculate frame dimensions from loaded image
      this.spriteSheet.frameWidth = this.sprite.width / this.spriteSheet.columns;
      this.spriteSheet.frameHeight = this.sprite.height / this.spriteSheet.rows;
    };
    this.sprite.onerror = () => {
      console.warn('Failed to load GameMaster phase 1 sprite sheet');
      this.spriteLoaded = false;
    };
    this.sprite.src = 'assets/Enemies/GameMaster/Idle_48x1.png';

    // Transition sprite sheet configuration (GameMaster Upgrade: 40x1)
    this.transitionSpriteSheet = {
      columns: 40,
      rows: 1,
      frameTime: this.transitionDuration / 40
    };

    // Load transition sprite sheet
    this.transitionSprite = new Image();
    this.transitionSpriteLoaded = false;
    this.transitionSprite.onload = () => {
      this.transitionSpriteLoaded = true;
      this.transitionSpriteSheet.frameWidth = this.transitionSprite.width / this.transitionSpriteSheet.columns;
      this.transitionSpriteSheet.frameHeight = this.transitionSprite.height / this.transitionSpriteSheet.rows;
    };
    this.transitionSprite.onerror = () => {
      console.warn('Failed to load GameMaster transition sprite sheet');
      this.transitionSpriteLoaded = false;
    };
    this.transitionSprite.src = 'assets/Enemies/GameMaster/Upgrade_40x1.png';

    // Phase 2 sprite sheet configuration (GameMaster ATK: 48x1)
    this.phase2SpriteSheet = {
      columns: 48,
      rows: 1,
      frameTime: 1 / 18
    };

    // Load phase 2 sprite sheet
    this.phase2Sprite = new Image();
    this.phase2SpriteLoaded = false;
    this.phase2Sprite.onload = () => {
      this.phase2SpriteLoaded = true;
      this.phase2SpriteSheet.frameWidth = this.phase2Sprite.width / this.phase2SpriteSheet.columns;
      this.phase2SpriteSheet.frameHeight = this.phase2Sprite.height / this.phase2SpriteSheet.rows;
    };
    this.phase2Sprite.onerror = () => {
      console.warn('Failed to load GameMaster phase 2 sprite sheet');
      this.phase2SpriteLoaded = false;
    };
    this.phase2Sprite.src = 'assets/Enemies/GameMaster/ATK_48x1.png';
  }

  get center() {
    return new Vec2(
      this.position.x + this.size / 2,
      this.position.y + this.size / 2
    );
  }

  distanceTo(other) {
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const ox = other.position.x + other.size / 2;
    const oy = other.position.y + other.size / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hitFlashTimer = 0.12;
    this.healthBarShakeTimer = 0.3; // Shake health bar for 0.3 seconds when damaged
    if (this.health < 0) this.health = 0;
    if (!this.phase2 && !this.transitionActive && this.health <= this.maxHealth * 0.5) {
      // Start transition to phase 2
      this.phase2 = true; // Set immediately for game logic
      this.transitionActive = true;
      this.transitionStartTime = null; // Will be set when gameTime is available
      this.bloodParticles = [];
      // Update stats immediately (transition will handle visual change)
      this.speed = BOSS_BASE_SPEED * 1.5;
      this.chargeSpeed = 520;
      this.chargeCooldown = 2.8;
      this.projectileCooldown = 1.8;
      this.minionCooldown = 5;
    }
  }

  get isDead() {
    return this.health <= 0;
  }

  intersects(other) {
    const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  update(dt, gameTime = null) {
    // Update health bar shake timer
    if (this.healthBarShakeTimer > 0) {
      this.healthBarShakeTimer -= dt;
      if (this.healthBarShakeTimer < 0) this.healthBarShakeTimer = 0;
    }

    // Handle transition to phase 2
    if (this.transitionActive && gameTime != null) {
      if (this.transitionStartTime === null) {
        this.transitionStartTime = gameTime;
      }
      
      const transitionElapsed = gameTime - this.transitionStartTime;
      
      // Spawn blood red particles during transition
      if (transitionElapsed < this.transitionDuration) {
        const centerX = this.position.x + this.size / 2;
        const centerY = this.position.y + this.size / 2;
        
        // Spawn multiple blood particles per frame
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 50 + Math.random() * 100;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const offsetX = (Math.random() - 0.5) * this.size * 0.3;
          const offsetY = (Math.random() - 0.5) * this.size * 0.3;
          
          this.bloodParticles.push({
            x: centerX + offsetX,
            y: centerY + offsetY,
            vx: vx,
            vy: vy,
            life: 0.5 + Math.random() * 0.5,
            maxLife: 0.5 + Math.random() * 0.5,
            size: 3 + Math.random() * 5
          });
        }
      }
      
      // End transition (phase2 already set, just stop transition)
      if (transitionElapsed >= this.transitionDuration) {
        this.transitionActive = false;
        this.bloodParticles = [];
      }
    }

    // Update blood particles
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
      const particle = this.bloodParticles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.95; // Friction
      particle.vy *= 0.95;
      particle.life -= dt;
      if (particle.life <= 0) {
        this.bloodParticles.splice(i, 1);
      }
    }

    // Update particle trail (only if not in transition)
    if (!this.transitionActive) {
      this.trailSpawnTimer += dt;
      if (this.trailSpawnTimer >= this.trailSpawnInterval) {
        this.trailSpawnTimer = 0;
        // Add new particle at boss center
        const centerX = this.position.x + this.size / 2;
        const centerY = this.position.y + this.size / 2;
        this.particleTrail.push({
          x: centerX,
          y: centerY,
          life: 1.5, // Particle lifetime in seconds
          maxLife: 1.5
        });
        // Limit trail length
        if (this.particleTrail.length > 30) {
          this.particleTrail.shift();
        }
      }

      // Update existing particles
      for (let i = this.particleTrail.length - 1; i >= 0; i--) {
        const particle = this.particleTrail[i];
        particle.life -= dt;
        if (particle.life <= 0) {
          this.particleTrail.splice(i, 1);
        }
      }
    }
  }

  draw(ctx, camera, gameTime = null) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const cx = sx + this.size / 2;
    const cy = sy + this.size / 2;

    // Draw green glowing particle trail (behind the boss)
    if (this.particleTrail.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter"; // Additive blending for glow effect
      
      for (let i = 0; i < this.particleTrail.length; i++) {
        const particle = this.particleTrail[i];
        const particleSx = Math.floor(particle.x - camera.position.x);
        const particleSy = Math.floor(particle.y - camera.position.y);
        
        // Calculate alpha based on remaining life (fade out)
        const alpha = particle.life / particle.maxLife;
        const normalizedAlpha = Math.pow(alpha, 0.7); // Slight curve for smoother fade
        
        // Calculate size (smaller as it fades)
        const baseSize = this.size * 0.15;
        const particleSize = baseSize * (0.5 + alpha * 0.5);
        
        // Draw outer glow (larger, more transparent)
        ctx.fillStyle = `rgba(34, 197, 94, ${normalizedAlpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(particleSx, particleSy, particleSize * 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw middle glow
        ctx.fillStyle = `rgba(74, 222, 128, ${normalizedAlpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(particleSx, particleSy, particleSize * 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw core (brightest)
        ctx.fillStyle = `rgba(134, 239, 172, ${normalizedAlpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(particleSx, particleSy, particleSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    // Draw blood red particles during transition
    if (this.transitionActive && this.bloodParticles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      
      for (const particle of this.bloodParticles) {
        const particleSx = Math.floor(particle.x - camera.position.x);
        const particleSy = Math.floor(particle.y - camera.position.y);
        const alpha = particle.life / particle.maxLife;
        
        // Draw blood red particle
        ctx.fillStyle = `rgba(139, 0, 0, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(particleSx, particleSy, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add darker red core
        ctx.fillStyle = `rgba(69, 0, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(particleSx, particleSy, particle.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    // Draw sprite from sprite sheet if available, otherwise fallback to colored rectangle
    let spriteToUse = null;
    let spriteSheetToUse = null;
    let animationFrame = 0;
    
    if (this.transitionActive && this.transitionSpriteLoaded && this.transitionSprite.complete) {
      // Use transition sprite
      spriteToUse = this.transitionSprite;
      spriteSheetToUse = this.transitionSpriteSheet;
      
      if (gameTime != null && this.transitionStartTime != null) {
        const transitionElapsed = gameTime - this.transitionStartTime;
        const frameIndex = Math.floor(transitionElapsed / this.transitionSpriteSheet.frameTime);
        animationFrame = Math.max(0, Math.min(this.transitionSpriteSheet.columns - 1, frameIndex));
      } else {
        // Transition just started, use first frame
        animationFrame = 0;
      }
    } else if (this.phase2 && !this.transitionActive && this.phase2SpriteLoaded && this.phase2Sprite.complete && this.phase2SpriteSheet.frameWidth && this.phase2SpriteSheet.frameHeight) {
      // Use phase 2 sprite
      spriteToUse = this.phase2Sprite;
      spriteSheetToUse = this.phase2SpriteSheet;
      
      if (gameTime != null) {
        const totalFrames = this.phase2SpriteSheet.columns * this.phase2SpriteSheet.rows;
        const frameIndex = Math.floor(gameTime / this.phase2SpriteSheet.frameTime) % totalFrames;
        animationFrame = frameIndex;
      }
    } else if (this.spriteLoaded && this.sprite.complete && this.spriteSheet.frameWidth && this.spriteSheet.frameHeight) {
      // Use phase 1 sprite
      spriteToUse = this.sprite;
      spriteSheetToUse = this.spriteSheet;
      
      if (gameTime != null) {
        const totalFrames = this.spriteSheet.columns * this.spriteSheet.rows;
        const frameIndex = Math.floor(gameTime / this.spriteSheet.frameTime) % totalFrames;
        animationFrame = frameIndex;
      }
    }
    
    if (spriteToUse && spriteSheetToUse && spriteSheetToUse.frameWidth && spriteSheetToUse.frameHeight) {
      ctx.save();
      ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering
      
      // Calculate source coordinates for current frame
      const frameX = animationFrame % spriteSheetToUse.columns;
      const frameY = Math.floor(animationFrame / spriteSheetToUse.columns);
      const sourceX = frameX * spriteSheetToUse.frameWidth;
      const sourceY = frameY * spriteSheetToUse.frameHeight;
      
      // Draw the sprite frame
      ctx.drawImage(
        spriteToUse,
        sourceX, sourceY,
        spriteSheetToUse.frameWidth,
        spriteSheetToUse.frameHeight,
        sx, sy,
        this.size, this.size
      );
      
      // Apply hit flash effect (soft white bloom when hit)
      if (this.hitFlashTimer > 0) {
        const cx = sx + this.size / 2;
        const cy = sy + this.size / 2;
        const r = this.size / 2;
        const alpha = (this.hitFlashTimer / 0.12) * 0.5;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.4})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      
      // Draw phase 2 outline if applicable
      if (this.phase2 && !this.transitionActive) {
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, sy, this.size, this.size);
      }
      
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    } else {
      // Fallback to colored rectangle while sprite loads
      ctx.fillStyle = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
      ctx.fillRect(sx, sy, this.size, this.size);
      ctx.strokeStyle = this.phase2 ? "#ff4444" : "#4a0000";
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, sy, this.size, this.size);
    }
    if (gameTime != null) {
      if (this.burnUntil != null && gameTime < this.burnUntil) {
        ctx.fillStyle = `rgba(251, 146, 60, 0.4)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.burnUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
      if (this.slowUntil != null && gameTime < this.slowUntil) {
        ctx.fillStyle = `rgba(147, 197, 253, 0.45)`;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(sx, sy, this.size, this.size);
        ctx.globalAlpha = 1;
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.slowUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
      if (this.stunUntil != null && gameTime < this.stunUntil) {
        ctx.fillStyle = `rgba(250, 204, 21, 0.6)`;
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 6, 6, 0, Math.PI * 2);
        ctx.arc(cx - 6, cy + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.stunUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
      if (this.toxicStacks > 0 && this.toxicUntil != null && gameTime < this.toxicUntil) {
        ctx.fillStyle = `rgba(34, 197, 94, 0.5)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.toxicUntil - gameTime).toFixed(1) + "s x" + this.toxicStacks, cx, sy - 6);
      }
      if (this.voidDefenseUntil != null && gameTime < this.voidDefenseUntil) {
        ctx.strokeStyle = `rgba(88, 28, 135, 0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#e9d5ff";
        ctx.textAlign = "center";
        ctx.fillText((this.voidDefenseUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
    }
  }
}
