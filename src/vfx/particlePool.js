/**
 * Generic pooled particle system for VFX. No per-frame allocations.
 */

const DEFAULT_PARTICLE = {
  x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
  size: 2, color: "#ffffff", alpha: 1, scale: 1
};

function createParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
    size: 2, color: "#ffffff", alpha: 1, scale: 1
  };
}

/**
 * @param {number} capacity - Max active + pooled particles (e.g. 512)
 */
export function createParticlePool(capacity = 512) {
  const pool = [];
  const active = [];
  for (let i = 0; i < capacity; i++) pool.push(createParticle());

  function spawn(x, y, vx, vy, life, options = {}) {
    let p = pool.pop();
    if (!p) p = createParticle();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = options.size ?? 2;
    p.color = options.color ?? "#ffffff";
    p.alpha = options.alpha ?? 1;
    p.scale = options.scale ?? 1;
    active.push(p);
    return p;
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        active.splice(i, 1);
        pool.push(p);
      }
    }
  }

  function draw(ctx, camera, drawShape = "circle") {
    const ox = -camera.position.x;
    const oy = -camera.position.y;
    for (const p of active) {
      const sx = p.x + ox;
      const sy = p.y + oy;
      const t = 1 - p.life / p.maxLife;
      const alpha = p.alpha * (1 - t);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const size = p.size * (1 + p.scale * t);
      if (drawShape === "circle") {
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (drawShape === "diamond") {
        ctx.beginPath();
        ctx.moveTo(sx, sy - size);
        ctx.lineTo(sx + size, sy);
        ctx.lineTo(sx, sy + size);
        ctx.lineTo(sx - size, sy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  return { spawn, update, draw, get activeCount() { return active.length; } };
}
