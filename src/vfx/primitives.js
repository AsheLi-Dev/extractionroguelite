/**
 * Math and canvas primitive helpers for code-driven VFX.
 */

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Returns a unit vector (dx, dy) with angle uniformly random in [centerAngle - halfAngle, centerAngle + halfAngle].
 */
export function randInCone(centerAngle, halfAngleRad) {
  const a = centerAngle - halfAngleRad + Math.random() * (2 * halfAngleRad);
  return { x: Math.cos(a), y: Math.sin(a) };
}

export function polarToVec(angle, length = 1) {
  return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
}

/**
 * Draw a sector (wedge) from angle a0 to a1 (radians), optionally filled and with rim stroke.
 * Angles are in world space; (x, y) is center, radius in px.
 */
export function drawSector(ctx, x, y, radius, a0, a1, fillStyle, alpha = 1, strokeRim = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, a0, a1);
  ctx.closePath();
  if (fillStyle != null) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeRim) {
    ctx.strokeStyle = fillStyle != null ? fillStyle : "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, a0, a1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    ctx.stroke();
  }
  ctx.restore();
}

/** Pixel-art: grid snap and stepped look. Set to game pixel scale if known (e.g. 2 for 2x). */
export const PIXEL_SIZE = 1;

const TAPERED_STRIP_MAX_SEGMENTS = 32;
const THICKNESS_STEP = PIXEL_SIZE;
const MIN_THICKNESS = 1 * PIXEL_SIZE;
const _taperedOuterX = new Float32Array(TAPERED_STRIP_MAX_SEGMENTS + 1);
const _taperedOuterY = new Float32Array(TAPERED_STRIP_MAX_SEGMENTS + 1);
const _taperedInnerX = new Float32Array(TAPERED_STRIP_MAX_SEGMENTS + 1);
const _taperedInnerY = new Float32Array(TAPERED_STRIP_MAX_SEGMENTS + 1);

/** Snap value to pixel grid. */
export function snap(v) {
  return Math.round(v / PIXEL_SIZE) * PIXEL_SIZE;
}

/**
 * Thickness in px from normalized angle: parabolic falloff, quantized to THICKNESS_STEP, clamp to MIN.
 */
function taperedThicknessPixel(normalized, maxThickness) {
  const t = 1 - normalized * normalized;
  const raw = maxThickness * t;
  const quantized = Math.round(raw / THICKNESS_STEP) * THICKNESS_STEP;
  return Math.max(MIN_THICKNESS, quantized);
}

/**
 * Draw a tapered arc strip (pixel-art style): thick at center, thin at ends; snapped geometry, stepped segments.
 * segments: main arc use 12, trails use 10 (fewer = chunkier).
 * drawDitherRim: if true, draw checker-pattern 1px dots at outerR + PIXEL_SIZE for pixel dither fade.
 */
export function drawTaperedArcStrip(ctx, centerX, centerY, centerlineRadius, a0, a1, facingAngle, halfAngle, maxThickness, fillStyle, alpha = 1, segments = 12, drawDitherRim = false) {
  if (maxThickness <= 0 || halfAngle <= 0) return;
  const N = Math.min(segments, TAPERED_STRIP_MAX_SEGMENTS);

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const angle = a0 + (a1 - a0) * t;
    const normalized = halfAngle !== 0 ? (angle - facingAngle) / halfAngle : 0;
    const thickness = taperedThicknessPixel(normalized, maxThickness);
    const innerR = Math.max(0.5, centerlineRadius - thickness / 2);
    const outerR = centerlineRadius + thickness / 2;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    _taperedOuterX[i] = snap(centerX + cos * outerR);
    _taperedOuterY[i] = snap(centerY + sin * outerR);
    _taperedInnerX[i] = snap(centerX + cos * innerR);
    _taperedInnerY[i] = snap(centerY + sin * innerR);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(_taperedOuterX[0], _taperedOuterY[0]);
  for (let i = 1; i <= N; i++) ctx.lineTo(_taperedOuterX[i], _taperedOuterY[i]);
  for (let i = N; i >= 0; i--) ctx.lineTo(_taperedInnerX[i], _taperedInnerY[i]);
  ctx.closePath();
  ctx.fill();

  if (drawDitherRim) {
    for (let i = 0; i <= N; i++) {
      const ox = _taperedOuterX[i];
      const oy = _taperedOuterY[i];
      const dx = ox - centerX;
      const dy = oy - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const rimX = snap(centerX + (dx / dist) * (dist + PIXEL_SIZE));
      const rimY = snap(centerY + (dy / dist) * (dist + PIXEL_SIZE));
      const gx = Math.floor(rimX / PIXEL_SIZE);
      const gy = Math.floor(rimY / PIXEL_SIZE);
      if ((gx + gy) % 2 === 0) {
        ctx.fillRect(rimX, rimY, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }
  ctx.restore();
}

/**
 * Draw a thick arc (filled segment between inner and outer radius from a0 to a1).
 */
export function drawThickArc(ctx, x, y, innerR, outerR, a0, a1, fillStyle, alpha = 1) {
  if (innerR >= outerR) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(0, 0, outerR, a0, a1);
  ctx.arc(0, 0, innerR, a1, a0, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
