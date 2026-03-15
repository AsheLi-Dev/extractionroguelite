/**
 * Procedural magic spell projectile renderer.
 * Renders 4 base archetypes (Energy Bolt, Orb, Crystal Shard, Rune Disc) in code
 * with configurable colors, scale, glow, trail, and motion. Use as a visual layer
 * for projectile entities (EnemyProjectile, PlayerProjectile, etc.).
 */

import { clamp } from '../utils.js';

// --- Helpers ---

const DEFAULT_PRIMARY = "#a855f7";
const DEFAULT_SECONDARY = "#7c3aed";

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 170, g: 85, b: 247 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToRgba(rgb, a) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function parseColor(c) {
  if (typeof c !== "string") return hexToRgb(DEFAULT_PRIMARY);
  return hexToRgb(c);
}

/**
 * Draw a magic projectile. Call from projectile.draw() after converting position to screen.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} opts
 * @param {string} [opts.projectileType] - "energyBolt" | "orb" | "crystalShard" | "runeDisc"
 * @param {number} opts.sx - screen x (center)
 * @param {number} opts.sy - screen y (center)
 * @param {number} opts.angle - direction in radians (e.g. atan2(vy, vx))
 * @param {number} [opts.size] - base radius/size in px
 * @param {string} [opts.primaryColor] - hex
 * @param {string} [opts.secondaryColor] - hex (glow/edge)
 * @param {number} [opts.scale=1]
 * @param {number} [opts.rotationSpeed=0] - rad/s for shard/disc
 * @param {number} [opts.pulseAmount=0] - 0..1 scale pulse for orbs
 * @param {number} [opts.trailLength=6] - number of trail segments to draw
 * @param {number} [opts.glowStrength=0.6] - 0..1
 * @param {Array<{x,y}>} [opts.trailPositions] - world-space trail; will be converted if camera provided
 * @param {Object} [opts.camera] - { position: {x,y} } to convert trail to screen
 * @param {number} [opts.time=0] - game time for animation
 * @param {boolean} [opts.flicker=false] - fire-like flicker for orbs
 */
export function drawMagicProjectile(ctx, opts) {
  const type = (opts.projectileType || "orb").toLowerCase();
  const sx = opts.sx ?? 0;
  const sy = opts.sy ?? 0;
  const angle = opts.angle ?? 0;
  const size = (opts.size ?? 12) * (opts.scale ?? 1);
  const primary = parseColor(opts.primaryColor ?? DEFAULT_PRIMARY);
  const secondary = parseColor(opts.secondaryColor ?? DEFAULT_SECONDARY);
  const rotationSpeed = opts.rotationSpeed ?? 0;
  const pulseAmount = clamp(opts.pulseAmount ?? 0, 0, 1);
  const trailLength = Math.max(0, Math.min(12, opts.trailLength ?? 6));
  const glowStrength = clamp(opts.glowStrength ?? 0.6, 0, 1);
  const time = opts.time ?? 0;
  const flicker = !!opts.flicker;
  const trailPositions = opts.trailPositions ?? [];
  const camera = opts.camera ?? null;

  const trailScreen = trailLength > 0 && trailPositions.length > 0
    ? trailPositions.slice(-trailLength).map((p) => ({
        x: Math.floor(p.x - (camera ? camera.position.x : 0)),
        y: Math.floor(p.y - (camera ? camera.position.y : 0)),
      }))
    : [];

  switch (type) {
    case "energybolt":
    case "energy_bolt":
      drawEnergyBolt(ctx, { sx, sy, angle, size, primary, secondary, glowStrength, trailScreen, time });
      break;
    case "orb":
      drawOrb(ctx, { sx, sy, size, primary, secondary, glowStrength, pulseAmount, trailScreen, time, flicker });
      break;
    case "crystalshard":
    case "crystal_shard":
      drawCrystalShard(ctx, { sx, sy, angle, size, primary, secondary, glowStrength, rotationSpeed, trailScreen, time });
      break;
    case "runedisc":
    case "rune_disc":
      drawRuneDisc(ctx, { sx, sy, angle, size, primary, secondary, glowStrength, rotationSpeed, trailScreen, time });
      break;
    default:
      drawOrb(ctx, { sx, sy, size, primary, secondary, glowStrength, pulseAmount, trailScreen, time, flicker });
  }
}

function drawTrail(ctx, trailScreen, size, primary, glowStrength, sizeMulFn) {
  if (trailScreen.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = trailScreen.length;
  for (let i = 0; i < n; i++) {
    const t = trailScreen[i];
    const progress = (i + 1) / n;
    const alpha = progress * 0.4 * (0.5 + glowStrength * 0.5);
    const r = (size / 2) * (sizeMulFn ? sizeMulFn(progress) : (0.5 + progress * 0.5));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgbToRgba(primary, 0.9);
    ctx.beginPath();
    ctx.arc(t.x + size / 2, t.y + size / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnergyBolt(ctx, { sx, sy, angle, size, primary, secondary, glowStrength, trailScreen, time }) {
  const len = size * 2.5;
  const halfW = size * 0.35;
  const cx = sx + size / 2;
  const cy = sy + size / 2;

  drawTrail(ctx, trailScreen, size, primary, glowStrength, (p) => 0.4 + p * 0.6);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Outer soft glow
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 * glowStrength;
  const g = ctx.createLinearGradient(-len, 0, len, 0);
  g.addColorStop(0, rgbToRgba(secondary, 0));
  g.addColorStop(0.3, rgbToRgba(secondary, 0.4));
  g.addColorStop(0.5, rgbToRgba(primary, 0.5));
  g.addColorStop(0.7, rgbToRgba(secondary, 0.4));
  g.addColorStop(1, rgbToRgba(secondary, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, len, halfW * 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bright core
  ctx.globalAlpha = 0.95;
  const g2 = ctx.createLinearGradient(-len, 0, len, 0);
  g2.addColorStop(0, rgbToRgba(primary, 0));
  g2.addColorStop(0.35, rgbToRgba(primary, 0.6));
  g2.addColorStop(0.5, rgbToRgba({ r: 255, g: 255, b: 255 }, 0.9));
  g2.addColorStop(0.65, rgbToRgba(primary, 0.6));
  g2.addColorStop(1, rgbToRgba(primary, 0));
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.85, halfW, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawOrb(ctx, { sx, sy, size, primary, secondary, glowStrength, pulseAmount, trailScreen, time, flicker }) {
  const cx = sx + size / 2;
  const cy = sy + size / 2;
  const pulse = pulseAmount > 0 ? 1 + pulseAmount * 0.2 * Math.sin(time * 8) : 1;
  const r = (size / 2) * pulse;
  const flick = flicker ? 0.9 + 0.2 * Math.sin(time * 20) : 1;

  drawTrail(ctx, trailScreen, size, primary, glowStrength);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outer glow
  const rad = r * 1.6;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  grad.addColorStop(0, rgbToRgba(primary, 0.7 * glowStrength * flick));
  grad.addColorStop(0.5, rgbToRgba(secondary, 0.35 * glowStrength * flick));
  grad.addColorStop(1, rgbToRgba(secondary, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright center
  ctx.globalAlpha = 0.95 * flick;
  ctx.fillStyle = rgbToRgba({ r: 255, g: 255, b: 255 }, 0.85);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbToRgba(primary, 0.9);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCrystalShard(ctx, { sx, sy, angle, size, primary, secondary, glowStrength, rotationSpeed, trailScreen, time }) {
  const cx = sx + size / 2;
  const cy = sy + size / 2;
  const rot = angle + (rotationSpeed * time);
  const len = size * 1.4;
  const halfW = size * 0.4;

  drawTrail(ctx, trailScreen, size, primary, glowStrength, (p) => 0.35 + p * 0.5);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // Silhouette: pointed shard (triangle-like with slight taper)
  const path = new Path2D();
  path.moveTo(len, 0);
  path.lineTo(-len * 0.7, halfW);
  path.lineTo(-len * 0.5, 0);
  path.lineTo(-len * 0.7, -halfW);
  path.closePath();

  // Soft glow behind
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.4 * glowStrength;
  ctx.fillStyle = rgbToRgba(secondary, 0.8);
  ctx.fill(path);

  // Core fill
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = rgbToRgba(primary, 0.9);
  ctx.fill(path);

  // Edge highlight
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = rgbToRgba({ r: 255, g: 255, b: 255 }, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke(path);

  ctx.restore();
}

function drawRuneDisc(ctx, { sx, sy, angle, size, primary, secondary, glowStrength, rotationSpeed, trailScreen, time }) {
  const cx = sx + size / 2;
  const cy = sy + size / 2;
  const rot = angle + (rotationSpeed * time);
  const r = size / 2;

  drawTrail(ctx, trailScreen, size, primary, glowStrength);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // Outer glow ring
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 * glowStrength;
  ctx.strokeStyle = rgbToRgba(secondary, 0.7);
  ctx.lineWidth = r * 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
  ctx.stroke();

  // Disc fill
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = rgbToRgba(primary, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Simple glyph: 3 lines (sigil style)
  const gLen = r * 0.6;
  ctx.strokeStyle = rgbToRgba({ r: 255, g: 255, b: 255 }, 0.9);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(0, -gLen);
  ctx.lineTo(0, gLen);
  ctx.moveTo(-gLen * 0.7, -gLen * 0.5);
  ctx.lineTo(gLen * 0.7, gLen * 0.5);
  ctx.moveTo(-gLen * 0.7, gLen * 0.5);
  ctx.lineTo(gLen * 0.7, -gLen * 0.5);
  ctx.stroke();

  ctx.restore();
}

/** Preset configs for common spell variants. Use with drawMagicProjectile or assign to projectile.magicStyle. */
export const MAGIC_PROJECTILE_PRESETS = {
  arcaneBolt: {
    projectileType: "energyBolt",
    primaryColor: "#a78bfa",
    secondaryColor: "#7c3aed",
    scale: 1,
    glowStrength: 0.7,
    trailLength: 8,
  },
  shadowBolt: {
    projectileType: "energyBolt",
    primaryColor: "#6b21a8",
    secondaryColor: "#3b0764",
    scale: 1,
    glowStrength: 0.5,
    trailLength: 6,
  },
  holyBolt: {
    projectileType: "energyBolt",
    primaryColor: "#fef08a",
    secondaryColor: "#facc15",
    scale: 1,
    glowStrength: 0.8,
    trailLength: 6,
  },
  lightningBolt: {
    projectileType: "energyBolt",
    primaryColor: "#93c5fd",
    secondaryColor: "#3b82f6",
    scale: 1,
    glowStrength: 0.9,
    trailLength: 8,
  },
  fireOrb: {
    projectileType: "orb",
    primaryColor: "#f97316",
    secondaryColor: "#dc2626",
    scale: 1,
    pulseAmount: 0.3,
    glowStrength: 0.7,
    flicker: true,
    trailLength: 6,
  },
  frostOrb: {
    projectileType: "orb",
    primaryColor: "#67e8f9",
    secondaryColor: "#22d3ee",
    scale: 1,
    pulseAmount: 0.15,
    glowStrength: 0.6,
    trailLength: 6,
  },
  poisonOrb: {
    projectileType: "orb",
    primaryColor: "#84cc16",
    secondaryColor: "#65a30d",
    scale: 1,
    pulseAmount: 0.2,
    glowStrength: 0.5,
    trailLength: 5,
  },
  voidOrb: {
    projectileType: "orb",
    primaryColor: "#a78bfa",
    secondaryColor: "#4c1d95",
    scale: 1,
    pulseAmount: 0.25,
    glowStrength: 0.5,
    trailLength: 6,
  },
  frostShard: {
    projectileType: "crystalShard",
    primaryColor: "#a5f3fc",
    secondaryColor: "#0e7490",
    scale: 1,
    rotationSpeed: 2,
    glowStrength: 0.6,
    trailLength: 6,
  },
  arcaneShard: {
    projectileType: "crystalShard",
    primaryColor: "#c4b5fd",
    secondaryColor: "#5b21b6",
    scale: 1,
    rotationSpeed: 3,
    glowStrength: 0.6,
    trailLength: 6,
  },
  earthShard: {
    projectileType: "crystalShard",
    primaryColor: "#a3e635",
    secondaryColor: "#65a30d",
    scale: 1,
    rotationSpeed: 1.5,
    glowStrength: 0.4,
    trailLength: 5,
  },
  holySigil: {
    projectileType: "runeDisc",
    primaryColor: "#fef08a",
    secondaryColor: "#eab308",
    scale: 1,
    rotationSpeed: 4,
    glowStrength: 0.7,
    trailLength: 5,
  },
  curseSigil: {
    projectileType: "runeDisc",
    primaryColor: "#7c3aed",
    secondaryColor: "#4c1d95",
    scale: 1,
    rotationSpeed: -3,
    glowStrength: 0.5,
    trailLength: 5,
  },
  ancientSigil: {
    projectileType: "runeDisc",
    primaryColor: "#fcd34d",
    secondaryColor: "#b45309",
    scale: 1,
    rotationSpeed: 2,
    glowStrength: 0.6,
    trailLength: 6,
  },
};

/**
 * Build options for drawMagicProjectile from a preset name or partial config.
 * Merges preset with overrides (e.g. scale, primaryColor).
 */
export function getMagicProjectileDrawOptions(presetOrConfig, overrides = {}) {
  const base = typeof presetOrConfig === "string"
    ? { ...(MAGIC_PROJECTILE_PRESETS[presetOrConfig] || MAGIC_PROJECTILE_PRESETS.fireOrb) }
    : { ...presetOrConfig };
  return { ...base, ...overrides };
}
