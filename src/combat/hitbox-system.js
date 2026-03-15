/**
 * Hitbox system: maintains active hitbox instances, updates them each frame,
 * and runs overlap tests against world targets. Collision is intentionally
 * minimal (circle, rect, cone vs circle) so melee, projectiles, and AoEs
 * share one code path without extra dependencies.
 * Moving projectiles can use moveMode: straight, accelerating, zigzag, homing.
 */

import { createHitboxInstance } from './hitbox-factory.js';
import { resolveHit } from './hit-resolution.js';

// --- Projectile motion -------------------------------------------------------

/**
 * Get target position for homing. World may provide getEntityById(id) returning
 * entity with .position and optional .size (or .position.x/.y as point).
 * @param {string} targetId
 * @param {{ getEntityById?: (id: string) => unknown }} world
 * @returns {{ x: number, y: number } | null}
 */
function getTargetPosition(targetId, world) {
  if (!targetId || typeof world?.getEntityById !== 'function') return null;
  const entity = world.getEntityById(targetId);
  if (!entity || !entity.position) return null;
  const sx = entity.position.x;
  const sy = entity.position.y;
  const size = entity.size ?? 0;
  return { x: sx + size / 2, y: sy + size / 2 };
}

/**
 * Update position and direction for a moving projectile hitbox based on moveMode.
 * Does not run collision; caller runs hitboxDestroyIfObstacle and resolve after.
 *
 * @param {import('./hitbox-types.js').HitboxInstance} h
 * @param {number} dt - Delta time in seconds.
 * @param {{ time?: number, getEntityById?: (id: string) => unknown }} world
 */
export function updateProjectileMotion(h, dt, world) {
  if (h.moveSpeed <= 0) return;
  const currentTime = Number(world?.time) ?? 0;
  const mode = h.moveMode ?? 'straight';

  if (mode === 'straight') {
    h.x += h.dirX * h.moveSpeed * dt;
    h.y += h.dirY * h.moveSpeed * dt;
    return;
  }

  if (mode === 'accelerating') {
    const cur = (h._currentSpeed ?? h.moveSpeed) + (h.accel ?? 0) * dt;
    const cap = h.maxSpeed ?? 9999;
    h._currentSpeed = Math.min(cur, cap);
    const speed = h._currentSpeed;
    h.x += h.dirX * speed * dt;
    h.y += h.dirY * speed * dt;
    return;
  }

  if (mode === 'zigzag') {
    const startX = h._zigzagStartX ?? h.x;
    const startY = h._zigzagStartY ?? h.y;
    const travelTime = (h._age ?? 0) >= 0 ? (h._age ?? 0) : currentTime - h.createdAt;
    const dist = h.moveSpeed * travelTime;
    const perpX = -((h.forwardY ?? h.dirY));
    const perpY = (h.forwardX ?? h.dirX);
    const amp = h.zigzagAmplitude ?? 20;
    const freq = h.zigzagFrequency ?? 6;
    const offset = amp * Math.sin(freq * travelTime);
    h.x = startX + (h.forwardX ?? h.dirX) * dist + perpX * offset;
    h.y = startY + (h.forwardY ?? h.dirY) * dist + perpY * offset;
    const tangentX = (h.forwardX ?? h.dirX) * h.moveSpeed + perpX * (amp * freq * Math.cos(freq * travelTime));
    const tangentY = (h.forwardY ?? h.dirY) * h.moveSpeed + perpY * (amp * freq * Math.cos(freq * travelTime));
    const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
    h.dirX = tangentX / len;
    h.dirY = tangentY / len;
    return;
  }

  if (mode === 'homing') {
    const target = getTargetPosition(h.targetId, world);
    if (target) {
      const dx = target.x - h.x;
      const dy = target.y - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const wantX = dx / dist;
      const wantY = dy / dist;
      const strength = (h.homingStrength ?? 2) * dt;
      const blend = Math.min(1, strength);
      let nx = h.dirX + (wantX - h.dirX) * blend;
      let ny = h.dirY + (wantY - h.dirY) * blend;
      const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
      h.dirX = nx / nlen;
      h.dirY = ny / nlen;
    }
    h.x += h.dirX * h.moveSpeed * dt;
    h.y += h.dirY * h.moveSpeed * dt;
    return;
  }

  h.x += h.dirX * h.moveSpeed * dt;
  h.y += h.dirY * h.moveSpeed * dt;
}

// --- Collision: all targets are circles (cx, cy, radius) --------------------

function circleVsCircle(hx, hy, hr, cx, cy, cr) {
  const dx = cx - hx;
  const dy = cy - hy;
  const distSq = dx * dx + dy * dy;
  const sum = hr + cr;
  return distSq <= sum * sum;
}

/** Ring (donut): innerRadius <= distance <= radius. Target circle (cx, cy, cr) overlaps when it intersects the band. */
function ringVsCircle(hx, hy, inner, outer, cx, cy, cr) {
  const dx = cx - hx;
  const dy = cy - hy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return (d > inner - cr) && (d < outer + cr);
}

function rectVsCircle(rx, ry, rw, rh, cx, cy, cr) {
  const clampX = Math.max(rx, Math.min(rx + rw, cx));
  const clampY = Math.max(ry, Math.min(ry + rh, cy));
  const dx = cx - clampX;
  const dy = cy - clampY;
  return dx * dx + dy * dy <= cr * cr;
}

/** Rotated rect (center cx,cy; half-width hw, half-height hh; angle rad) vs circle. */
function rotatedRectVsCircle(rcx, rcy, hw, hh, angleRad, cx, cy, cr) {
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const lx = (cx - rcx) * cos - (cy - rcy) * sin;
  const ly = (cx - rcx) * sin + (cy - rcy) * cos;
  const clampX = Math.max(-hw, Math.min(hw, lx));
  const clampY = Math.max(-hh, Math.min(hh, ly));
  const dx = lx - clampX;
  const dy = ly - clampY;
  return dx * dx + dy * dy <= cr * cr;
}

function coneVsCircle(apexX, apexY, dirX, dirY, coneAngleRad, range, cx, cy, cr) {
  const dx = cx - apexX;
  const dy = cy - apexY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= 0) return range >= cr;
  if (dist - cr > range) return false;
  const ndx = dx / dist;
  const ndy = dy / dist;
  const dot = ndx * dirX + ndy * dirY;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  return angle <= coneAngleRad;
}

/**
 * @param {import('./hitbox-types.js').HitboxInstance} hitbox
 * @param {{ id: string, x: number, y: number, radius: number }} target
 * @returns {boolean}
 */
function hitboxOverlapsTarget(hitbox, target) {
  const cx = target.x;
  const cy = target.y;
  const cr = target.radius;

  switch (hitbox.shape) {
    case 'circle': {
      const hx = hitbox.x;
      const hy = hitbox.y;
      const inner = hitbox.innerRadius ?? 0;
      if (inner > 0) {
        return ringVsCircle(hx, hy, inner, hitbox.radius, cx, cy, cr);
      }
      return circleVsCircle(hx, hy, hitbox.radius, cx, cy, cr);
    }
    case 'rect': {
      const rw = hitbox.width;
      const rh = hitbox.height;
      const angleRad = typeof hitbox.angleRad === 'number' ? hitbox.angleRad : Math.atan2(hitbox.dirY || 0, hitbox.dirX || 1);
      const rcx = hitbox.x + rw / 2;
      const rcy = hitbox.y + rh / 2;
      return rotatedRectVsCircle(rcx, rcy, rw / 2, rh / 2, angleRad, cx, cy, cr);
    }
    case 'cone': {
      return coneVsCircle(
        hitbox.x, hitbox.y,
        hitbox.dirX, hitbox.dirY,
        hitbox.coneAngleRad,
        hitbox.radius,
        cx, cy, cr
      );
    }
    default:
      return false;
  }
}

// --- System state -----------------------------------------------------------

/** @type {import('./hitbox-types.js').HitboxInstance[]} */
const activeHitboxes = [];

/**
 * Create a hitbox from a definition and spawn data; add it to the active list.
 *
 * @param {import('./hitbox-types.js').HitboxDef} def
 * @param {{ x: number, y: number, dirX?: number, dirY?: number, angleRad?: number, ownerId?: string|null, faction?: string, createdAt?: number, [key: string]: unknown }} spawnData
 * @returns {import('./hitbox-types.js').HitboxInstance}
 */
export function createHitbox(def, spawnData) {
  const instance = createHitboxInstance(def, spawnData);
  activeHitboxes.push(instance);
  return instance;
}

/**
 * Update all active hitboxes: remove expired/destroyed, move, follow owner,
 * resolve targets. Call once per frame with dt and a world adapter.
 * World should provide time (seconds) for expiration; pass createdAt when spawning.
 *
 * @param {number} dt - Delta time in seconds.
 * @param {{ time?: number, getTargetsByFaction?: (faction: string) => Array<{ id: string, x: number, y: number, radius: number }>, getEntityById?: (id: string) => unknown, damageEntity?: (targetId: string, amount: number, source: unknown) => void, applyStun?: (targetId: string, ms: number) => void, applyKnockback?: (targetId: string, fromX: number, fromY: number, force: number) => void, getOwnerPosition?: (ownerId: string) => { x: number, y: number } | null }} world
 */
export function updateHitboxes(dt, world) {
  const currentTime = Number(world?.time) ?? 0;
  for (let i = activeHitboxes.length - 1; i >= 0; i--) {
    const h = activeHitboxes[i];
    if (h.destroyed) {
      activeHitboxes.splice(i, 1);
      continue;
    }
    h._age = (h._age ?? 0) + dt;
    const lifetimeSec = h._lifetimeSec ?? 0;
    const expiredByAge = lifetimeSec > 0 && h._age >= lifetimeSec;
    const expiredByTime = h.expiresAt > 0 && currentTime >= h.expiresAt;
    if (expiredByAge || expiredByTime) {
      activeHitboxes.splice(i, 1);
      continue;
    }

    if (h.followOwner && h.ownerId && typeof world?.getOwnerPosition === 'function') {
      const pos = world.getOwnerPosition(h.ownerId);
      if (pos) {
        h.x = pos.x;
        h.y = pos.y;
      }
    }

    if (h.moveSpeed > 0) {
      updateProjectileMotion(h, dt, world);
      if (typeof world?.hitboxDestroyIfObstacle === 'function' && world.hitboxDestroyIfObstacle(h)) {
        activeHitboxes.splice(i, 1);
        continue;
      }
    }

    // IMPORTANT: call as a method to preserve `this` binding (Game.getTargetsByFaction uses `this.enemySystem`).
    if (typeof world?.getTargetsByFaction === 'function') {
      const targets = world.getTargetsByFaction(h.faction);
      for (const target of targets) {
        if (!target || target.radius == null) continue;
        if (hitboxOverlapsTarget(h, target)) {
          resolveHit(h, target, world);
        }
      }
    }
  }
}

/**
 * @returns {import('./hitbox-types.js').HitboxInstance[]}
 */
export function getActiveHitboxes() {
  return activeHitboxes;
}

/**
 * Remove all active hitboxes (e.g. on scene change or reset).
 */
export function clearHitboxes() {
  activeHitboxes.length = 0;
}

// --- Optional debug rendering (matches project pattern: camera offset, simple shapes) ---

/**
 * Draw active hitboxes for debugging. Call from Game.render() when a debug flag is on.
 * Logic and presentation stay separate; this is a dev aid only.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ position: { x: number, y: number } }} camera
 * @param {import('./hitbox-types.js').HitboxInstance[]} [hitboxes]
 */
export function drawHitboxDebug(ctx, camera, hitboxes = activeHitboxes) {
  const camX = camera?.position?.x ?? 0;
  const camY = camera?.position?.y ?? 0;
  for (const h of hitboxes) {
    if (h.destroyed) continue;
    const sx = h.x - camX;
    const sy = h.y - camY;
    const isPlayer = h.faction === 'player';
    const stroke = isPlayer ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)';
    const fill = isPlayer ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 1;
    if (h.shape === 'circle') {
      ctx.beginPath();
      const inner = h.innerRadius ?? 0;
      if (inner > 0) {
        ctx.arc(sx, sy, h.radius, 0, Math.PI * 2, false);
        ctx.arc(sx, sy, inner, 0, Math.PI * 2, true);
      } else {
        ctx.arc(sx, sy, h.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    } else if (h.shape === 'rect') {
      const rcx = sx + h.width / 2;
      const rcy = sy + h.height / 2;
      const angleRad = typeof h.angleRad === 'number' ? h.angleRad : Math.atan2(h.dirY || 0, h.dirX || 1);
      ctx.save();
      ctx.translate(rcx, rcy);
      ctx.rotate(angleRad);
      ctx.fillRect(-h.width / 2, -h.height / 2, h.width, h.height);
      ctx.strokeRect(-h.width / 2, -h.height / 2, h.width, h.height);
      ctx.restore();
    } else if (h.shape === 'cone') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const endX = sx + h.dirX * h.radius;
      const endY = sy + h.dirY * h.radius;
      const spread = Math.tan(h.coneAngleRad) * h.radius;
      const perpX = -h.dirY;
      const perpY = h.dirX;
      ctx.lineTo(endX + perpX * spread, endY + perpY * spread);
      ctx.lineTo(endX - perpX * spread, endY - perpY * spread);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}
