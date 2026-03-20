/**
 * Skill-effect draw handlers.
 *
 * Conventions:
 * - Handlers may read `eff` and `game` state to render.
 * - Keep draw logic pure (no gameplay mutation) unless a specific effect already
 *   depends on it and is documented.
 * - Shared rendering logic should go into helpers/modules (avoid copy/paste).
 */

function drawAssimilativeOrb(game, ctx, eff, ox, oy) {
  const sx = eff.x + ox;
  const sy = eff.y + oy;
  const r = eff.radius ?? 40;
  const pulse = 0.5 + 0.3 * Math.sin(game.time * 6);
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.5);
  g.addColorStop(0, `rgba(139, 92, 246, ${pulse})`);
  g.addColorStop(0.6, `rgba(99, 102, 241, ${pulse * 0.5})`);
  g.addColorStop(1, "rgba(79, 70, 229, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(167, 139, 250, ${0.8})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpiritBanner(game, ctx, eff, ox, oy) {
  const sx = eff.x + ox;
  const sy = eff.y + oy;
  const r = eff.radius ?? 120;
  ctx.strokeStyle = `rgba(34, 197, 94, ${0.25 + 0.1 * Math.sin(game.time * 4)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLoyalDragons(game, ctx, eff, ox, oy) {
  if (!eff.dragon1 || !eff.dragon2) return;
  const s1x = eff.dragon1.x + ox;
  const s1y = eff.dragon1.y + oy;
  const s2x = eff.dragon2.x + ox;
  const s2y = eff.dragon2.y + oy;
  ctx.fillStyle = "rgba(251, 146, 60, 0.9)";
  ctx.beginPath();
  ctx.arc(s1x, s1y, 14, 0, Math.PI * 2);
  ctx.arc(s2x, s2y, 14, 0, Math.PI * 2);
  ctx.fill();
}

function drawHunterShot(game, ctx, eff, ox, oy) {
  const sx = eff.x + ox;
  const sy = eff.y + oy;
  const r = 7;
  const pulse = 0.55 + 0.25 * Math.sin(game.time * 12);
  const base = eff.type === 'homingSkull'
    ? { core: `rgba(196, 181, 253, ${pulse})`, ring: `rgba(167, 139, 250, ${0.85})` }
    : { core: `rgba(34, 197, 94, ${pulse})`, ring: `rgba(74, 222, 128, ${0.85})` };
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
  g.addColorStop(0, base.core);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = base.ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export const SKILL_EFFECT_DRAW_HANDLERS = {
  assimilativeOrb: drawAssimilativeOrb,
  spiritBanner: drawSpiritBanner,
  loyalDragons: drawLoyalDragons,
  hunterShot: drawHunterShot,
  homingSkull: drawHunterShot
};

