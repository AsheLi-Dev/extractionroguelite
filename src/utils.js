// -------- Core types & utilities --------

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
}

export function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/** Returns true if segment (a1x,a1y)-(a2x,a2y) and (b1x,b1y)-(b2x,b2y) intersect (excluding endpoints only touching). */
export function segmentsIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) {
  const dax = a2x - a1x, day = a2y - a1y;
  const dbx = b2x - b1x, dby = b2y - b1y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-10) return false;
  const t = ((b1x - a1x) * dby - (b1y - a1y) * dbx) / denom;
  const u = ((b1x - a1x) * day - (b1y - a1y) * dax) / denom;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Returns collision rect for a wall (e.g. tile wall or obstacle). Optional inset so collision sits inside visible wall. */
export function getWallCollisionRect(wall, inset = 4) {
  const w = wall.w ?? wall.h ?? 16;
  const h = wall.h ?? wall.w ?? 16;
  const maxInset = Math.floor(Math.min(w, h) / 2) - 1;
  const useInset = Math.min(inset, Math.max(0, maxInset));
  return {
    x: wall.x + useInset,
    y: wall.y + useInset,
    w: Math.max(1, w - 2 * useInset),
    h: Math.max(1, h - 2 * useInset)
  };
}

/** Returns a centered tiny obstacle collision rect (16x16 px). */
export function getObstacleCollisionRect(obstacle) {
  const w = obstacle?.size?.w ?? obstacle?.w ?? 16;
  const h = obstacle?.size?.h ?? obstacle?.h ?? 16;
  const x = obstacle?.position?.x ?? obstacle?.x ?? 0;
  const y = obstacle?.position?.y ?? obstacle?.y ?? 0;
  const type = obstacle?.type ?? obstacle?.typeDef?.id ?? "";
  const renderScale = 2;
  const rw = w * renderScale;
  const rh = h * renderScale;
  const rx = x - (rw - w) / 2;
  const ry = y - (rh - h) / 2;

  if (type === "giantRock") {
    const cw = 64;
    const ch = 32;
    return {
      x: rx + (rw - cw) / 2,
      y: ry + rh - ch - 32,
      w: cw,
      h: ch
    };
  }

  if (type === "ancientTree") {
    const cw = 32;
    const ch = 64;
    return {
      x: rx + rw - cw,
      y: ry + (rh - ch) / 2,
      w: cw,
      h: ch
    };
  }

  if (type === "ruinedPillar") {
    const cw = 64;
    const ch = 160;
    return {
      x: rx + (rw - cw) / 2,
      y: ry + 16,
      w: cw,
      h: ch
    };
  }

  const cw = 16;
  const ch = 16;
  return {
    x: rx + (rw - cw) / 2,
    y: ry + (rh - ch) / 2,
    w: cw,
    h: ch
  };
}

/** Overlap test between obstacle collision rect and an axis-aligned rect. */
export function obstacleIntersectsRect(obstacle, rect) {
  const o = getObstacleCollisionRect(obstacle);
  return (
    rect.x < o.x + o.w &&
    rect.x + rect.w > o.x &&
    rect.y < o.y + o.h &&
    rect.y + rect.h > o.y
  );
}
