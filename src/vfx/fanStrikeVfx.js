/**
 * Programmed VFX for Fan Strike: 120 cone sweep (telegraph, sweep arc, trails, wind particles, hit feedback).
 * Purely code-driven; no sprite sheets. Uses particle pool and primitives.
 */

import { lerp, clamp, randRange, randInCone, polarToVec, drawSector, drawTaperedArcStrip, PIXEL_SIZE, snap } from "./primitives.js";
import { createParticlePool } from "./particlePool.js";

// ----- config (tune here) -----
const deg = (x) => (x * Math.PI) / 180;
const CONE_HALF_ANGLE = deg(60);
const TELEGRAPH_DURATION = 0.09;
const SWEEP_DURATION = 0.14;
const TRAIL_LINGER = 0.22;
const ARC_THICKNESS_MAIN = 12;
const ARC_THICKNESS_TRAIL_1 = 7;
const ARC_THICKNESS_TRAIL_2 = 5;
const TRAIL_LAG = [0.08, 0.16];
const WIND_PARTICLE_RATE = 120;
const WIND_PARTICLE_LIFE_MIN = 0.12;
const WIND_PARTICLE_LIFE_MAX = 0.18;
const WIND_PARTICLE_SPEED_MIN = 250;
const WIND_PARTICLE_SPEED_MAX = 420;
const HIT_SPARK_COUNT = 8;
const HIT_SPARK_LIFE = 0.12;
const HIT_RING_LIFE = 0.1;
const HIT_RING_MAX_RADIUS = 12;
export const HIT_STOP_MS = 50;
export const CAMERA_SHAKE_INTENSITY = 0.1;
export const CAMERA_SHAKE_DURATION = 0.07;

// ----- woosh blade particles (tiny squares along sweep) -----
const WOOSH_RATE = 240;
const WOOSH_LIFE_MIN = 0.08;
const WOOSH_LIFE_MAX = 0.16;
const WOOSH_SPEED_MIN = 220;
const WOOSH_SPEED_MAX = 420;
const WOOSH_SIZE_OPTIONS = [1, 2];
const WOOSH_SPREAD_OUTWARD = 0.35;
const WOOSH_JITTER_POS = 2;
const WOOSH_ALPHA_START = 0.9;
const WOOSH_ALPHA_END = 0;
const WOOSH_DITHER_THRESHOLD = 0.35;
const WOOSH_TRAIL_RATE_MULT = [0.35, 0.2];
const WOOSH_POOL_SIZE = 768;

const ARC_COLOR = "rgba(251, 191, 36, ";
const TELEGRAPH_FILL = "rgba(251, 191, 36, ";
const WIND_COLOR = "rgba(200, 220, 255, ";
const HIT_SPARK_COLOR = "rgba(255, 220, 150, ";
const HIT_RING_COLOR = "rgba(255, 200, 100, ";

const particlePool = createParticlePool(512);
const activeInstances = [];
const hitRings = [];

// Woosh particle pool (squares, pixel-art)
const _wooshPool = [];
const _wooshActive = [];
for (let i = 0; i < WOOSH_POOL_SIZE; i++) {
  _wooshPool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, lifeMax: 0, size: 1 });
}

function wooshThicknessAt(normalized, maxTh) {
  const t = 1 - normalized * normalized;
  const raw = maxTh * t;
  const q = Math.round(raw / 2) * 2;
  return Math.max(1, q);
}

function spawnWoosh(x, y, vx, vy, life, size) {
  const p = _wooshPool.pop();
  if (!p) return;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.lifeMax = life;
  p.size = size;
  _wooshActive.push(p);
}

function emitWooshParticles(inst, dt) {
  const teEnd = inst.telegraph ? TELEGRAPH_DURATION : 0;
  const sweepStart = teEnd;
  const sweepEnd = sweepStart + SWEEP_DURATION;
  if (inst.elapsed < sweepStart || inst.elapsed > sweepEnd) return;

  inst.wooshEmitAcc = inst.wooshEmitAcc ?? 0;
  const sweepT = (inst.elapsed - sweepStart) / SWEEP_DURATION;
  const halfAngle = inst.halfAngle ?? CONE_HALF_ANGLE;
  const centerX = inst.x;
  const centerY = inst.y;

  const emitAt = (t, rateMult) => {
    if (t < 0 || t > 1) return;
    const a = lerp(inst.startAngle, inst.endAngle, t);
    const normalized = halfAngle !== 0 ? (a - inst.facingAngle) / halfAngle : 0;
    const thickness = wooshThicknessAt(normalized, ARC_THICKNESS_MAIN);
    const baseR = inst.radius - ARC_THICKNESS_MAIN / 2 + thickness / 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const tx = -sinA;
    const ty = cosA;
    const rx = cosA;
    const ry = sinA;
    const mixT = 1 - WOOSH_SPREAD_OUTWARD;
    const mixR = WOOSH_SPREAD_OUTWARD;
    let dx = tx * mixT + rx * mixR;
    let dy = ty * mixT + ry * mixR;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;
    const speed = randRange(WOOSH_SPEED_MIN, WOOSH_SPEED_MAX);
    const jx = randRange(-WOOSH_JITTER_POS, WOOSH_JITTER_POS);
    const jy = randRange(-WOOSH_JITTER_POS, WOOSH_JITTER_POS);
    const spawnX = snap(centerX + cosA * baseR + jx);
    const spawnY = snap(centerY + sinA * baseR + jy);
    const life = randRange(WOOSH_LIFE_MIN, WOOSH_LIFE_MAX);
    const size = WOOSH_SIZE_OPTIONS[Math.floor(Math.random() * WOOSH_SIZE_OPTIONS.length)];
    spawnWoosh(spawnX, spawnY, dx * speed, dy * speed, life, size);
  };

  inst.wooshEmitAcc += dt * WOOSH_RATE;
  const n = Math.min(24, Math.floor(inst.wooshEmitAcc));
  inst.wooshEmitAcc -= n;
  for (let i = 0; i < n; i++) emitAt(sweepT, 1);

  for (let ti = 0; ti < TRAIL_LAG.length; ti++) {
    const trailT = sweepT - TRAIL_LAG[ti] / SWEEP_DURATION;
    const mult = WOOSH_TRAIL_RATE_MULT[ti];
    const trailN = Math.min(8, Math.floor(dt * WOOSH_RATE * mult));
    for (let i = 0; i < trailN; i++) emitAt(trailT, mult);
  }
}

function updateWoosh(dt) {
  for (let i = _wooshActive.length - 1; i >= 0; i--) {
    const p = _wooshActive[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      _wooshActive.splice(i, 1);
      _wooshPool.push(p);
    }
  }
}

function drawWoosh(ctx, camera) {
  ctx.save();
  const ox = -camera.position.x;
  const oy = -camera.position.y;
  const ps = PIXEL_SIZE;
  ctx.fillStyle = ARC_COLOR + "1)";
  for (const p of _wooshActive) {
    const t = 1 - p.life / p.lifeMax;
    const alpha = lerp(WOOSH_ALPHA_START, WOOSH_ALPHA_END, t);
    if (alpha <= 0) continue;
    const sx = snap(p.x + ox);
    const sy = snap(p.y + oy);
    const size = p.size * ps;
    const px = sx - size / 2;
    const py = sy - size / 2;
    if (alpha < WOOSH_DITHER_THRESHOLD) {
      const gx = Math.floor(px / ps);
      const gy = Math.floor(py / ps);
      if ((gx + gy) % 2 !== 0) continue;
    }
    ctx.globalAlpha = alpha;
    ctx.fillRect(px, py, size, size);
  }
  ctx.restore();
}

function createInstance(opts) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const facingAngle = opts.facingAngle ?? 0;
  const range = opts.range ?? 200;
  const halfAngle = opts.halfAngleDeg != null ? deg(opts.halfAngleDeg) : CONE_HALF_ANGLE;
  const radius = range * 0.95;
  const startAngle = facingAngle - halfAngle;
  const endAngle = facingAngle + halfAngle;
  return {
    x, y, facingAngle, range, radius, startAngle, endAngle, halfAngle,
    elapsed: 0,
    telegraph: opts.telegraph !== false
  };
}

/**
 * Spawn the main Fan Strike VFX. Registers an instance that update/render will process.
 */
export function spawnFanStrikeVfx(opts) {
  const inst = createInstance(opts);
  activeInstances.push(inst);
}

/**
 * Per-enemy hit: sparks burst + expanding ring. Call once per hit enemy.
 */
export function onFanStrikeHitEnemy(opts) {
  const ex = opts.enemyX ?? 0;
  const ey = opts.enemyY ?? 0;
  const sweepAngle = opts.sweepAngle ?? 0;
  const tangentX = -Math.sin(sweepAngle);
  const tangentY = Math.cos(sweepAngle);

  for (let i = 0; i < HIT_SPARK_COUNT; i++) {
    const spread = randRange(0.6, 1.4);
    const vx = tangentX * randRange(80, 220) * (Math.random() > 0.5 ? 1 : -1);
    const vy = tangentY * randRange(80, 220) * (Math.random() > 0.5 ? 1 : -1);
    particlePool.spawn(ex, ey, vx, vy, HIT_SPARK_LIFE, {
      size: randRange(2, 4),
      color: HIT_SPARK_COLOR.slice(0, -2) + "1)",
      alpha: 0.95,
      scale: 0.5
    });
  }

  hitRings.push({
    x: ex, y: ey, radius: 0, maxRadius: HIT_RING_MAX_RADIUS, life: HIT_RING_LIFE, maxLife: HIT_RING_LIFE
  });
}

function emitWindParticles(inst, dt) {
  const rate = WIND_PARTICLE_RATE * dt;
  const n = Math.min(20, Math.floor(rate + Math.random()));
  const halfAngle = inst.halfAngle ?? CONE_HALF_ANGLE;
  for (let i = 0; i < n; i++) {
    const life = randRange(WIND_PARTICLE_LIFE_MIN, WIND_PARTICLE_LIFE_MAX);
    const speed = randRange(WIND_PARTICLE_SPEED_MIN, WIND_PARTICLE_SPEED_MAX);
    const coneCenter = inst.facingAngle;
    const dir = randInCone(coneCenter, halfAngle);
    const dist = randRange(0, inst.radius * 0.4);
    const px = inst.x + Math.cos(coneCenter) * dist + (Math.random() - 0.5) * 20;
    const py = inst.y + Math.sin(coneCenter) * dist + (Math.random() - 0.5) * 20;
    const vx = dir.x * speed;
    const vy = dir.y * speed;
    particlePool.spawn(px, py, vx, vy, life, {
      size: randRange(1.5, 3),
      color: WIND_COLOR.slice(0, -2) + "0.9)",
      alpha: 0.85,
      scale: 0.8
    });
  }
}

function updateHitRings(dt) {
  for (let i = hitRings.length - 1; i >= 0; i--) {
    const r = hitRings[i];
    r.life -= dt;
    if (r.life <= 0) {
      hitRings.splice(i, 1);
      continue;
    }
    const t = 1 - r.life / r.maxLife;
    r.radius = r.maxRadius * t;
  }
}

/**
 * Update all active Fan Strike VFX and particles. Call every frame with dt.
 */
export function updateFanStrikeVfx(dt) {
  for (let i = activeInstances.length - 1; i >= 0; i--) {
    const inst = activeInstances[i];
    inst.elapsed += dt;
    const teEnd = inst.telegraph ? TELEGRAPH_DURATION : 0;
    const sweepStart = teEnd;
    const sweepEnd = sweepStart + SWEEP_DURATION;
    const fullEnd = sweepEnd + TRAIL_LINGER;

    if (inst.elapsed >= fullEnd) {
      activeInstances.splice(i, 1);
      continue;
    }

    if (inst.elapsed >= sweepStart && inst.elapsed <= sweepEnd) {
      const sweepT = (inst.elapsed - sweepStart) / SWEEP_DURATION;
      emitWindParticles(inst, dt);
      emitWooshParticles(inst, dt);
    }
  }

  particlePool.update(dt);
  updateWoosh(dt);
  updateHitRings(dt);
}

function drawTelegraph(ctx, inst, ox, oy) {
  if (!inst.telegraph || inst.elapsed >= TELEGRAPH_DURATION) return;
  const t = inst.elapsed / TELEGRAPH_DURATION;
  const alpha = t < 0.5 ? lerp(0, 0.18, t * 2) : lerp(0.18, 0, (t - 0.5) * 2);
  const sx = inst.x + ox;
  const sy = inst.y + oy;
  // #region agent log (telegraph layer debugging)
  if (!inst._debugFanTelegraphLogged && inst.elapsed < TELEGRAPH_DURATION * 0.2) {
    inst._debugFanTelegraphLogged = true;
    const tf = typeof ctx?.getTransform === "function" ? ctx.getTransform() : null;
    fetch("http://127.0.0.1:7453/ingest/67f144d2-906e-4be5-b37e-c8486a8d0d9d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8eb378" },
      body: JSON.stringify({
        sessionId: "8eb378",
        runId: "debug_fanstrike_telegraph_layer_1",
        hypothesisId: "H5_fanStrikeTelegraphOffset",
        location: "src/vfx/fanStrikeVfx.js:drawTelegraph",
        message: "FanStrike telegraph draw position vs camera/offset transform.",
        data: {
          canvasWidth: ctx?.canvas?.width,
          canvasHeight: ctx?.canvas?.height,
          instX: inst.x,
          instY: inst.y,
          radius: inst.radius,
          camOx: ox,
          camOy: oy,
          sx,
          sy,
          alpha,
          elapsed: inst.elapsed,
          ctxTransform: tf ? { a: tf.a, d: tf.d, e: tf.e, f: tf.f } : null
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
  }
  // #endregion
  drawSector(ctx, sx, sy, inst.radius, inst.startAngle, inst.endAngle, TELEGRAPH_FILL.slice(0, -2) + alpha + ")", alpha, true);
}

function drawSweepArc(ctx, inst, ox, oy) {
  const teEnd = inst.telegraph ? TELEGRAPH_DURATION : 0;
  const sweepStart = teEnd;
  const sweepEnd = sweepStart + SWEEP_DURATION;
  if (inst.elapsed < sweepStart || inst.elapsed > sweepEnd + TRAIL_LINGER) return;

  const sweepT = clamp((inst.elapsed - sweepStart) / SWEEP_DURATION, 0, 1);
  const currentAngle = lerp(inst.startAngle, inst.endAngle, sweepT);
  const sx = inst.x + ox;
  const sy = inst.y + oy;
  const halfAngle = inst.halfAngle ?? CONE_HALF_ANGLE;

  const mainAlpha = 0.9 * (1 - sweepT * 0.4);
  const mainCenterline = inst.radius - ARC_THICKNESS_MAIN / 2;
  drawTaperedArcStrip(ctx, sx, sy, mainCenterline, inst.startAngle, currentAngle, inst.facingAngle, halfAngle, ARC_THICKNESS_MAIN, ARC_COLOR + mainAlpha + ")", mainAlpha, 12, true);

  const trailThicknesses = [ARC_THICKNESS_TRAIL_1, ARC_THICKNESS_TRAIL_2];
  for (let ti = 0; ti < TRAIL_LAG.length; ti++) {
    const lag = TRAIL_LAG[ti];
    const trailT = sweepT - lag / SWEEP_DURATION;
    if (trailT <= 0) continue;
    const trailAngle = lerp(inst.startAngle, inst.endAngle, trailT);
    const trailAlpha = mainAlpha * 0.5 * (1 - trailT);
    const trailRadiusOffset = (1 - trailT) * 30;
    const trailCenterline = Math.max(0, inst.radius - trailThicknesses[ti] / 2 - trailRadiusOffset);
    const trailMaxThickness = trailThicknesses[ti];
    drawTaperedArcStrip(ctx, sx, sy, trailCenterline, inst.startAngle, trailAngle, inst.facingAngle, halfAngle, trailMaxThickness, ARC_COLOR + trailAlpha + ")", trailAlpha, 10, true);
  }
}

/**
 * Render all active Fan Strike VFX. Call after world draw, with same camera as rest of game.
 */
export function renderFanStrikeVfx(ctx, camera) {
  const ox = -camera.position.x;
  const oy = -camera.position.y;

  for (const inst of activeInstances) {
    drawTelegraph(ctx, inst, ox, oy);
  }
  drawWoosh(ctx, camera);
  for (const inst of activeInstances) {
    drawSweepArc(ctx, inst, ox, oy);
  }

  particlePool.draw(ctx, camera, "circle");

  for (const r of hitRings) {
    const sx = r.x + ox;
    const sy = r.y + oy;
    const alpha = 1 - r.life / r.maxLife;
    ctx.save();
    ctx.strokeStyle = HIT_RING_COLOR + alpha + ")";
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
