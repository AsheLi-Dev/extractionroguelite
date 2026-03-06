// Lightweight particle system for VFX
export class Particle {
  constructor(x, y, vx, vy, life, size, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color || "#ffffff";
    this.drag = 0.95; // Velocity decay
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.life -= dt;
    return this.life > 0;
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.x - camera.position.x);
    const sy = Math.floor(this.y - camera.position.y);
    const alpha = this.life / this.maxLife;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx, sy, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Transient VFX registry for rings/lines with timers
export class TransientVFX {
  constructor() {
    this.effects = [];
  }

  addRing(x, y, radius, duration, color, pulse = false) {
    this.effects.push({
      type: "ring",
      x, y, radius,
      maxRadius: radius,
      duration,
      elapsed: 0,
      color: color || "#ffffff",
      pulse
    });
  }

  addLine(x1, y1, x2, y2, duration, color, width = 1) {
    this.effects.push({
      type: "line",
      x1, y1, x2, y2,
      duration,
      elapsed: 0,
      color: color || "#ffffff",
      width
    });
  }

  addArc(x, y, radius, startAngle, endAngle, duration, color) {
    this.effects.push({
      type: "arc",
      x, y, radius,
      startAngle, endAngle,
      duration,
      elapsed: 0,
      color: color || "#ffffff"
    });
  }

  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const eff = this.effects[i];
      eff.elapsed += dt;
      if (eff.elapsed >= eff.duration) {
        this.effects.splice(i, 1);
      }
    }
  }

  draw(ctx, camera) {
    for (const eff of this.effects) {
      const alpha = 1 - (eff.elapsed / eff.duration);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = eff.color;
      
      if (eff.type === "ring") {
        const sx = Math.floor(eff.x - camera.position.x);
        const sy = Math.floor(eff.y - camera.position.y);
        let radius = eff.radius;
        if (eff.pulse) {
          const pulsePhase = (eff.elapsed / eff.duration) * Math.PI * 2;
          radius = eff.maxRadius + Math.sin(pulsePhase) * 5;
        }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eff.type === "line") {
        const sx1 = Math.floor(eff.x1 - camera.position.x);
        const sy1 = Math.floor(eff.y1 - camera.position.y);
        const sx2 = Math.floor(eff.x2 - camera.position.x);
        const sy2 = Math.floor(eff.y2 - camera.position.y);
        ctx.lineWidth = eff.width;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      } else if (eff.type === "arc") {
        const sx = Math.floor(eff.x - camera.position.x);
        const sy = Math.floor(eff.y - camera.position.y);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, eff.radius, eff.startAngle, eff.endAngle);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }
}

// Particle pool for performance
export class ParticlePool {
  constructor(maxSize = 200) {
    this.particles = [];
    this.maxSize = maxSize;
  }

  spawn(x, y, vx, vy, life, size, color) {
    let p;
    if (this.particles.length < this.maxSize) {
      p = new Particle(x, y, vx, vy, life, size, color);
      this.particles.push(p);
    } else {
      // Reuse oldest particle
      p = this.particles.shift();
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      p.drag = 0.95;
      this.particles.push(p);
    }
    return p;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, camera) {
    for (const p of this.particles) {
      p.draw(ctx, camera);
    }
  }
}
