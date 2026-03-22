// -------- Core types & utilities --------

function encodeRelativeAssetPath(input) {
  if (typeof input !== "string") return input;
  const raw = input.trim();
  if (!raw) return raw;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) || raw.startsWith("//")) return raw;

  const hashIndex = raw.indexOf("#");
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  const encodedPath = path
    .split("/")
    .map((segment) => {
      if (!segment || segment === "." || segment === "..") return segment;
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch (_) {
        return encodeURIComponent(segment);
      }
    })
    .join("/");

  return `${encodedPath}${query}${hash}`;
}

function normalizeRelativeAssetUrl(input) {
  const normalized = encodeRelativeAssetPath(input);
  if (typeof normalized !== "string") return normalized;
  if (!normalized) return normalized;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized) || normalized.startsWith("//")) return normalized;
  if (typeof document !== "undefined" && document?.baseURI) {
    try {
      return new URL(normalized, document.baseURI).href;
    } catch (_) {
      return normalized;
    }
  }
  return normalized;
}

export function assetUrl(input) {
  return normalizeRelativeAssetUrl(input);
}

function installAssetUrlPatch() {
  if (typeof window === "undefined") return;
  if (window.__assetUrlPatchInstalled) return;
  window.__assetUrlPatchInstalled = true;
  window.__normalizeAssetUrl = normalizeRelativeAssetUrl;

  if (typeof window.fetch === "function") {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (typeof input === "string") {
        return nativeFetch(normalizeRelativeAssetUrl(input), init);
      }
      if (input instanceof URL) {
        return nativeFetch(new URL(normalizeRelativeAssetUrl(String(input)), document.baseURI), init);
      }
      return nativeFetch(input, init);
    };
  }

  const patchSrcSetter = (proto) => {
    if (!proto) return;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "src");
    if (!descriptor?.set || !descriptor?.get) return;
    Object.defineProperty(proto, "src", {
      configurable: true,
      enumerable: descriptor.enumerable ?? true,
      get: descriptor.get,
      set(value) {
        descriptor.set.call(this, normalizeRelativeAssetUrl(value));
      }
    });
  };

  patchSrcSetter(window.HTMLImageElement?.prototype);
  patchSrcSetter(window.HTMLMediaElement?.prototype);

  if (typeof window.Audio === "function") {
    const NativeAudio = window.Audio;
    function PatchedAudio(src) {
      return new NativeAudio(
        typeof src === "string" ? normalizeRelativeAssetUrl(src) : src
      );
    }
    PatchedAudio.prototype = NativeAudio.prototype;
    window.Audio = PatchedAudio;
  }
}

installAssetUrlPatch();

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

  if (type === "giantRock") {
    const td = obstacle.typeDef || {};
    const vw = obstacle.size?.w ?? td.size?.w ?? w;
    const vh = obstacle.size?.h ?? td.size?.h ?? h;
    const ratio = Number(td.collisionScale);
    const scale = Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : 0.7;
    const cw = Math.max(1, Math.round(vw * scale));
    const ch = Math.max(1, Math.round(vh * scale));
    return {
      x: x + (vw - cw) / 2,
      y: y + vh - ch,
      w: cw,
      h: ch,
    };
  }

  if (type === "ancientTree") {
    const td = obstacle.typeDef || {};
    const vw = obstacle.size?.w ?? td.size?.w ?? w;
    const vh = obstacle.size?.h ?? td.size?.h ?? h;
    const rwRatio = Number(td.collisionWidthRatio);
    const rhRatio = Number(td.collisionHeightRatio);
    const wr = Number.isFinite(rwRatio) && rwRatio > 0 && rwRatio <= 1 ? rwRatio : 0.3;
    const hr = Number.isFinite(rhRatio) && rhRatio > 0 && rhRatio <= 1 ? rhRatio : 0.1;
    const cw = Math.max(1, Math.round(vw * wr));
    const ch = Math.max(1, Math.round(vh * hr));
    const liftRaw = Number(td.collisionLiftPx);
    const lift = Number.isFinite(liftRaw) && liftRaw > 0 ? liftRaw : 0;
    const boxY = y + vh - ch - lift;
    return {
      x: x + (vw - cw) / 2,
      y: Math.max(y, boxY),
      w: cw,
      h: ch,
    };
  }

  const renderScale = 2;
  const rw = w * renderScale;
  const rh = h * renderScale;
  const rx = x - (rw - w) / 2;
  const ry = y - (rh - h) / 2;

  if (type === "vaultEntrance") {
    return { x, y, w, h };
  }

  if (type === "ruinPillar") {
    const rw = w;
    const rh = h;
    const rx = x;
    const ry = y;
    const out = { x: rx, y: ry + rh / 2, w: rw, h: rh / 2 };
    return out;
  }

  const cw = 16;
  const ch = 16;
  const defaultOut = { x: rx + (rw - cw) / 2, y: ry + (rh - ch) / 2, w: cw, h: ch };
  return defaultOut;
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
