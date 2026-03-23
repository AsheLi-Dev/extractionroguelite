/**
 * Skill-effect draw handlers.
 *
 * Conventions:
 * - Handlers may read `eff` and `game` state to render.
 * - Keep draw logic pure (no gameplay mutation) unless a specific effect already
 *   depends on it and is documented.
 * - Shared rendering logic should go into helpers/modules (avoid copy/paste).
 */

import { drawAnimatedSpriteFrame, getAnimatedSpriteImage } from '../vfx/animated-sprite.js';

let loyalDragonIdleImage = null;

function getLoyalDragonIdleImage() {
  if (loyalDragonIdleImage) return loyalDragonIdleImage;
  const img = new Image();
  img.src = "assets/Enemies/sprDragon.png";
  loyalDragonIdleImage = img;
  return loyalDragonIdleImage;
}

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
  const sprite = getLoyalDragonIdleImage();
  if (!sprite || !sprite.complete || !sprite.naturalWidth || !sprite.naturalHeight) {
    // Keep an obvious fallback while the sprite is still loading.
    const s1x = eff.dragon1.x + ox;
    const s1y = eff.dragon1.y + oy;
    const s2x = eff.dragon2.x + ox;
    const s2y = eff.dragon2.y + oy;
    ctx.fillStyle = "rgba(251, 146, 60, 0.9)";
    ctx.beginPath();
    ctx.arc(s1x, s1y, 14, 0, Math.PI * 2);
    ctx.arc(s2x, s2y, 14, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const frames = 6;
  const fps = 10;
  const frame = Math.floor((game.time * fps) % frames);
  const frameW = sprite.naturalWidth / frames;
  const frameH = sprite.naturalHeight;
  const drawW = 48;
  const drawH = 48;
  for (const dragon of [eff.dragon1, eff.dragon2]) {
    const sx = dragon.x + ox - drawW / 2;
    const sy = dragon.y + oy - drawH / 2;
    ctx.drawImage(
      sprite,
      frame * frameW,
      0,
      frameW,
      frameH,
      sx,
      sy,
      drawW,
      drawH
    );
  }
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

function drawAnimatedSkillProjectile(ctx, eff, ox, oy) {
  const sprite = eff?.animatedSprite;
  if (!sprite?.path) return false;
  const image = getAnimatedSpriteImage(sprite.path);
  const angle = Math.atan2(Number(eff?.vy) || 0, Number(eff?.vx) || 1);
  return drawAnimatedSpriteFrame(ctx, {
    image,
    sprite,
    centerX: (Number(eff?.x) || 0) + ox,
    centerY: (Number(eff?.y) || 0) + oy,
    angle: (sprite.rotateWithVelocity ? angle : 0) + (sprite.baseAngleRad || 0),
    elapsed: eff?.t || 0
  });
}

function drawFireball(game, ctx, eff, ox, oy) {
  if (drawAnimatedSkillProjectile(ctx, eff, ox, oy)) return;
  const sx = eff.x + ox;
  const sy = eff.y + oy;
  const r = 14 + 4 * Math.sin(game.time * 8);
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, '#fff3a0');
  g.addColorStop(0.5, '#f97316');
  g.addColorStop(1, '#dc2626');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawIceShard(_game, ctx, eff, ox, oy) {
  if (drawAnimatedSkillProjectile(ctx, eff, ox, oy)) return;
  const sx = eff.x + ox;
  const sy = eff.y + oy;
  ctx.fillStyle = 'rgba(147, 197, 253, 0.9)';
  ctx.beginPath();
  ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawAnimatedSpriteImpact(_game, ctx, eff, ox, oy) {
  const sprite = eff?.animatedSprite;
  if (!sprite?.path) return;
  const image = getAnimatedSpriteImage(sprite.path);
  const angle = Number(eff?.angleRad) || 0;
  drawAnimatedSpriteFrame(ctx, {
    image,
    sprite,
    centerX: (Number(eff?.x) || 0) + ox,
    centerY: (Number(eff?.y) || 0) + oy,
    angle: (sprite.rotateWithVelocity ? angle : 0) + (sprite.baseAngleRad || 0),
    elapsed: eff?.t || 0
  });
}

function drawElementMageArt(_game, ctx, eff, ox, oy) {
  const angle = Math.atan2(Number(eff?.dirY) || 0, Number(eff?.dirX) || 1);
  const centerX = (Number(eff?.x) || 0) + ox;
  const centerY = (Number(eff?.y) || 0) + oy;
  const elapsed = Math.max(0, Number(eff?.t) || 0);
  if (eff?.variant === 'fire') {
    const total = Math.max(0.01, Number(eff?.duration) || 1);
    const startDuration = Math.min(0.2, total * 0.25);
    const endDuration = Math.min(0.25, total * 0.3);
    const endStart = Math.max(startDuration, total - endDuration);
    if (elapsed < startDuration && eff.fireStartSprite) {
      const frameIndex = Math.min(Math.max(1, eff.fireStartSprite.frameCount) - 1, Math.floor((elapsed / Math.max(0.001, startDuration)) * Math.max(1, eff.fireStartSprite.frameCount)));
      drawAnimatedSpriteFrame(ctx, { image: getAnimatedSpriteImage(eff.fireStartSprite.path), sprite: eff.fireStartSprite, centerX, centerY, angle, frameIndex });
      return;
    }
    if (elapsed >= endStart && eff.fireEndSprite) {
      const frameIndex = Math.min(Math.max(1, eff.fireEndSprite.frameCount) - 1, Math.floor(((elapsed - endStart) / Math.max(0.001, total - endStart)) * Math.max(1, eff.fireEndSprite.frameCount)));
      drawAnimatedSpriteFrame(ctx, { image: getAnimatedSpriteImage(eff.fireEndSprite.path), sprite: eff.fireEndSprite, centerX, centerY, angle, frameIndex });
      return;
    }
    if (eff.fireLoopSprite) {
      drawAnimatedSpriteFrame(ctx, { image: getAnimatedSpriteImage(eff.fireLoopSprite.path), sprite: eff.fireLoopSprite, centerX, centerY, angle, elapsed });
      return;
    }
  }
  if (eff?.animatedSprite?.path) {
    drawAnimatedSpriteFrame(ctx, {
      image: getAnimatedSpriteImage(eff.animatedSprite.path),
      sprite: eff.animatedSprite,
      centerX,
      centerY,
      angle,
      elapsed
    });
  }
}

export const SKILL_EFFECT_DRAW_HANDLERS = {
  fireball: drawFireball,
  iceShard: drawIceShard,
  animatedSpriteImpact: drawAnimatedSpriteImpact,
  elementMageArt: drawElementMageArt,
  assimilativeOrb: drawAssimilativeOrb,
  spiritBanner: drawSpiritBanner,
  loyalDragons: drawLoyalDragons,
  hunterShot: drawHunterShot,
  homingSkull: drawHunterShot
};

