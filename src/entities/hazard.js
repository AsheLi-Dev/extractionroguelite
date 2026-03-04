import { Vec2 } from '../utils.js';

const HAZARD_RADIUS = 95;

export class HazardSystem {
  constructor(world, conditions) {
    this.world = world;
    this.conditions = conditions;
    this.patches = [];
    this.movingBoulders = [];
    this.buildPatches();
  }

  addTemporaryPatch(type, x, y, radius, duration, damagePerTick = 0, affectsEnemies = false, slowMult = 0.7) {
    const patch = {
      type,
      x,
      y,
      radius,
      id: this.patches.length,
      temp: true,
      duration,
      elapsed: 0,
      damagePerTick,
      affectsEnemies,
      lastDamageTick: 0
    };
    if (type === "slowZone" || type === "webZone" || type === "rootZone") {
      patch.slowMult = slowMult;
    }
    this.patches.push(patch);
  }

  update(dt, game) {
    const surviving = [];
    for (const p of this.patches) {
      if (p.temp) {
        p.elapsed += dt;
        if (p.elapsed >= p.duration) continue;
        if (p.affectsEnemies && p.damagePerTick > 0 && game) {
          p.lastDamageTick = (p.lastDamageTick || 0) + dt;
          if (p.lastDamageTick >= 1) {
            p.lastDamageTick = 0;
            const hit = game.enemiesInRadius(p.x, p.y, p.radius);
            for (const e of hit) game.dealDamageToEnemy(e, p.damagePerTick, { isDot: true });
          }
        }
      }
      surviving.push(p);
    }
    this.patches = surviving;

    if (this.movingBoulders.length > 0 && game?.player) {
      const px = game.player.position.x + game.player.size / 2;
      const py = game.player.position.y + game.player.size / 2;
      const pr = game.player.size * 0.35;
      const margin = this.world.wallThickness + 24;

      for (const b of this.movingBoulders) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.hitCooldown = Math.max(0, (b.hitCooldown || 0) - dt);

        if (Math.abs(b.vx) > Math.abs(b.vy)) {
          if ((b.vx < 0 && b.x + b.r < -margin) || (b.vx > 0 && b.x - b.r > this.world.width + margin)) {
            // Horizontal boulders always re-enter from the right side.
            b.x = this.world.width + b.r + margin;
            b.y = margin + Math.random() * Math.max(1, this.world.height - margin * 2);
            b.vx = -Math.abs(b.vx);
          }
        } else {
          if (b.vy > 0 && b.y - b.r > this.world.height + margin) {
            b.y = -b.r - margin;
            b.x = margin + Math.random() * Math.max(1, this.world.width - margin * 2);
          } else if (b.vy < 0 && b.y + b.r < -margin) {
            b.y = this.world.height + b.r + margin;
            b.x = margin + Math.random() * Math.max(1, this.world.width - margin * 2);
          }
        }

        const dx = px - b.x;
        const dy = py - b.y;
        const rr = pr + b.r;
        if (dx * dx + dy * dy <= rr * rr && b.hitCooldown <= 0) {
          b.hitCooldown = 0.85;
          game.onPlayerDamaged?.(40, false);
        }
      }
    }
  }

  buildPatches() {
    const keepTemp = this.patches.filter((p) => p.temp);
    this.patches = keepTemp;
    this.movingBoulders = [];
    const types = ["frozenGround", "toxicGround", "burningGround", "shockingGround", "weakeningGround"];
    const margin = this.world.wallThickness + HAZARD_RADIUS + 20;
    const w = this.world.width - margin * 2;
    const h = this.world.height - margin * 2;

    types.forEach((type, ti) => {
      if (!this.conditions.some((c) => c.id === type)) return;
      const count = 21;
      for (let i = 0; i < count; i++) {
        const x = margin + (i / (count - 1)) * w + (Math.random() - 0.5) * 80;
        const y = margin + Math.random() * h;
        const clampedX = Math.max(margin, Math.min(x, this.world.width - margin - 1));
        const clampedY = Math.max(margin, Math.min(y, this.world.height - margin - 1));
        this.patches.push({ type, x: clampedX, y: clampedY, radius: HAZARD_RADIUS, id: this.patches.length });
      }
    });

    // Cave-specific moving boulders that cross the map and pressure movement.
    if (this.world?.theme?.id === 2) {
      const count = 9;
      const margin = this.world.wallThickness + 24;
      for (let i = 0; i < count; i++) {
        const horizontal = Math.random() < 0.7;
        const speed = 220 + Math.random() * 140;
        const radius = 16 + Math.random() * 10;
        if (horizontal) {
          this.movingBoulders.push({
            x: this.world.width + radius + margin,
            y: margin + Math.random() * Math.max(1, this.world.height - margin * 2),
            vx: -speed,
            vy: (Math.random() - 0.5) * 24,
            r: radius,
            hitCooldown: 0
          });
        } else {
          const topToBottom = Math.random() < 0.5;
          this.movingBoulders.push({
            x: margin + Math.random() * Math.max(1, this.world.width - margin * 2),
            y: topToBottom ? -radius - margin : this.world.height + radius + margin,
            vx: (Math.random() - 0.5) * 24,
            vy: topToBottom ? speed : -speed,
            r: radius,
            hitCooldown: 0
          });
        }
      }
    }
  }

  playerInPatch(player) {
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    for (const p of this.patches) {
      const dx = px - p.x;
      const dy = py - p.y;
      if (dx * dx + dy * dy <= p.radius * p.radius) return p;
    }
    return null;
  }

  draw(ctx, camera, time) {
    const ox = -camera.position.x;
    const oy = -camera.position.y;

    for (const p of this.patches) {
      const sx = p.x + ox;
      const sy = p.y + oy;

      const vw = camera.viewWidth || 800;
      const vh = camera.viewHeight || 600;
      if (sx + p.radius < 0 || sx - p.radius > vw || sy + p.radius < 0 || sy - p.radius > vh) continue;

      ctx.save();

      if (p.type === "frozenGround") {
        this.drawFrozen(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "toxicGround") {
        this.drawToxic(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "burningGround") {
        this.drawBurning(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "shockingGround") {
        this.drawShocking(ctx, sx, sy, p.radius, time, p.id);
      } else       if (p.type === "weakeningGround") {
        this.drawWeakening(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "slowZone" || p.type === "webZone" || p.type === "rootZone") {
        this.drawSlowZone(ctx, sx, sy, p.radius, time, p.id);
      }

      ctx.restore();
    }

    for (const b of this.movingBoulders) {
      const sx = b.x + ox;
      const sy = b.y + oy;
      const vw = camera.viewWidth || 800;
      const vh = camera.viewHeight || 600;
      if (sx + b.r < 0 || sx - b.r > vw || sy + b.r < 0 || sy - b.r > vh) continue;
      this.drawBoulder(ctx, sx, sy, b.r, time);
    }
  }

  drawBoulder(ctx, sx, sy, r, t) {
    const pulse = 0.92 + 0.08 * Math.sin(t * 9 + sx * 0.01 + sy * 0.01);
    const grad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.35, 1, sx, sy, r);
    grad.addColorStop(0, `rgba(196, 181, 160, ${0.55 * pulse})`);
    grad.addColorStop(0.45, `rgba(120, 113, 108, ${0.95 * pulse})`);
    grad.addColorStop(1, "rgba(68, 64, 60, 1)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(20, 20, 20, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawFrozen(ctx, sx, sy, r, t, id) {
    const pulse = 0.5 + 0.15 * Math.sin(t * 2 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(147, 197, 253, ${0.25 * pulse})`);
    grad.addColorStop(0.5, `rgba(96, 165, 250, ${0.35 * pulse})`);
    grad.addColorStop(1, `rgba(59, 130, 246, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(191, 219, 254, ${0.5 + 0.2 * Math.sin(t * 3 + id)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + t * 0.5 + id * 0.3;
      const dist = r * (0.4 + 0.4 * Math.sin(t * 4 + i));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(224, 242, 254, ${0.6 + 0.3 * Math.sin(t * 5 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawToxic(ctx, sx, sy, r, t, id) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 4 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(34, 197, 94, ${0.4 * pulse})`);
    grad.addColorStop(0.6, `rgba(22, 163, 74, ${0.5 * pulse})`);
    grad.addColorStop(1, `rgba(22, 101, 52, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(74, 222, 128, ${0.4 + 0.3 * Math.sin(t * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2 + t * 2 + id * 0.2;
      const dist = r * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + i)));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist;
      const size = 5 + 3 * Math.sin(t * 5 + i);
      ctx.fillStyle = `rgba(134, 239, 172, ${0.5 + 0.4 * Math.sin(t * 4 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBurning(ctx, sx, sy, r, t, id) {
    const flicker = 0.7 + 0.3 * Math.sin(t * 12 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(251, 146, 60, ${0.5 * flicker})`);
    grad.addColorStop(0.4, `rgba(239, 68, 68, ${0.45 * flicker})`);
    grad.addColorStop(0.8, `rgba(185, 28, 28, ${0.3})`);
    grad.addColorStop(1, `rgba(127, 29, 29, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + t * 8 + id * 0.5;
      const dist = r * (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 7 + i * 1.3)));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist - 8 * Math.sin(t * 6 + i);
      const h = 8 + 6 * Math.sin(t * 10 + i);
      ctx.fillStyle = `rgba(253, 186, 116, ${0.8 * flicker})`;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x - 4, y - h / 2);
      ctx.lineTo(x, y - h / 2 + 2);
      ctx.lineTo(x + 4, y - h / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawShocking(ctx, sx, sy, r, t, id) {
    const flash = 0.5 + 0.5 * Math.sin(t * 15 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(253, 224, 71, ${0.35 * flash})`);
    grad.addColorStop(0.5, `rgba(250, 204, 21, ${0.25 * flash})`);
    grad.addColorStop(1, `rgba(234, 179, 8, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(254, 249, 195, ${0.6 * flash})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 4;
      const x1 = sx + Math.cos(angle) * r * 0.3;
      const y1 = sy + Math.sin(angle) * r * 0.3;
      const x2 = sx + Math.cos(angle) * r * (0.7 + 0.2 * Math.sin(t * 8 + i));
      const y2 = sy + Math.sin(angle) * r * (0.7 + 0.2 * Math.sin(t * 8 + i));
      ctx.strokeStyle = `rgba(254, 240, 138, ${0.8 * flash})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  drawSlowZone(ctx, sx, sy, r, t, id) {
    const pulse = 0.5 + 0.2 * Math.sin(t * 3 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(34, 197, 94, ${0.2 * pulse})`);
    grad.addColorStop(0.6, `rgba(22, 163, 74, ${0.25 * pulse})`);
    grad.addColorStop(1, "rgba(22, 101, 52, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.3 + 0.2 * Math.sin(t * 4)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawWeakening(ctx, sx, sy, r, t, id) {
    const swirl = (t * 0.3 + id * 0.2) % (Math.PI * 2);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(147, 51, 234, ${0.35 + 0.1 * Math.sin(t * 2)})`);
    grad.addColorStop(0.5, `rgba(126, 34, 206, ${0.4})`);
    grad.addColorStop(1, `rgba(88, 28, 135, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(167, 139, 250, ${0.4 + 0.2 * Math.sin(t * 3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + swirl;
      const dist = r * (0.4 + 0.4 * Math.sin(t + i));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(192, 132, 252, ${0.5 + 0.2 * Math.sin(t * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
