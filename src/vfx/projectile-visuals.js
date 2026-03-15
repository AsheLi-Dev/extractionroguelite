import { drawMagicProjectile, getMagicProjectileDrawOptions } from './magic-projectile-renderer.js';

const WIND_PROJECTILE_TRAIL_LIFE = 0.7;
const WIND_PROJECTILE_TRAIL_MAX_POINTS = 30;
const WIND_PROJECTILE_TRAIL_MIN_STEP = 4;
const LIGHTNING_PROJECTILE_TRAIL_LIFE = 0.22;
const LIGHTNING_PROJECTILE_TRAIL_MAX_POINTS = 18;
const LIGHTNING_PROJECTILE_TRAIL_MIN_STEP = 3;
const ENEMY_PROJECTILE_TRAIL_LIFE = 0.18;
const ENEMY_PROJECTILE_TRAIL_MAX_POINTS = 8;
const ENEMY_PROJECTILE_TRAIL_MIN_STEP = 2;

const projectileSpriteCache = new Map();

function getProjectileSprite(path) {
  if (!path) return null;
  if (!projectileSpriteCache.has(path)) {
    const img = new Image();
    img.src = path;
    projectileSpriteCache.set(path, img);
  }
  return projectileSpriteCache.get(path);
}

function getTrailDefaults(element) {
  if (element === 'lightning') {
    return {
      life: LIGHTNING_PROJECTILE_TRAIL_LIFE,
      maxPoints: LIGHTNING_PROJECTILE_TRAIL_MAX_POINTS,
      step: LIGHTNING_PROJECTILE_TRAIL_MIN_STEP
    };
  }
  if (element === 'enemy') {
    return {
      life: ENEMY_PROJECTILE_TRAIL_LIFE,
      maxPoints: ENEMY_PROJECTILE_TRAIL_MAX_POINTS,
      step: ENEMY_PROJECTILE_TRAIL_MIN_STEP
    };
  }
  return {
    life: WIND_PROJECTILE_TRAIL_LIFE,
    maxPoints: WIND_PROJECTILE_TRAIL_MAX_POINTS,
    step: WIND_PROJECTILE_TRAIL_MIN_STEP
  };
}

function hasDetachedTrailLayer(visual) {
  return visual?.elementalState === 'wind' || visual?.elementalState === 'lightning';
}

function usesTrailSamples(visual) {
  if (!visual) return false;
  if (hasDetachedTrailLayer(visual)) return true;
  if (visual.magicStyle) return true;
  return !!visual.trailEnabled;
}

export function getHitboxProjectileTrailStyle(hitbox) {
  const element = hitbox?.elementalState || (hitbox?.faction === 'enemy' ? 'enemy' : 'fire');
  const w = Math.max(0, Number(hitbox?.width) || 0);
  const radius = Math.max(0, Number(hitbox?.radius) || 0);
  const defaults = getTrailDefaults(element);
  const baseThickness = w > 0 ? w : Math.max(2, radius * 0.6);
  return {
    thickness: Math.max(3, baseThickness * 0.7),
    angle: Math.atan2(Number(hitbox?.dirY) || 0, Number(hitbox?.dirX) || 1),
    life: defaults.life,
    step: defaults.step,
    maxPoints: defaults.maxPoints
  };
}

export function createHitboxProjectileVisual(state, hitbox, options = {}) {
  if (!state?.enableProjectileVisuals || !state?.projectileVisuals) return null;
  const id = hitbox?.id;
  if (!id) return null;
  const faction = options.faction || hitbox.faction || 'player';
  const element = options.elementalState || hitbox.elementalState || (faction === 'enemy' ? 'enemy' : 'fire');
  const shape = options.shape || hitbox.shape || 'circle';
  const width = Number.isFinite(options.width) ? options.width : Number(hitbox.width) || 0;
  const height = Number.isFinite(options.height) ? options.height : Number(hitbox.height) || 0;
  const radius = Number.isFinite(options.radius) ? options.radius : Number(hitbox.radius) || 0;
  const defaults = getTrailDefaults(element);
  const trailEnabled = options.trailEnabled ?? (faction === 'enemy' ? !options.spritePath : false);
  const visual = {
    kind: 'projectile',
    sourceAttackId: id,
    defId: hitbox.defId || options.defId || 'player_projectile',
    faction,
    elementalState: element,
    shape,
    width,
    height,
    radius,
    color: options.color || hitbox.color || '#a855f7',
    spritePath: options.spritePath || null,
    spriteImage: options.spritePath ? getProjectileSprite(options.spritePath) : null,
    magicStyle: options.magicStyle || null,
    angle: Number.isFinite(hitbox.angleRad) ? hitbox.angleRad : Math.atan2(hitbox.dirY || 0, hitbox.dirX || 1),
    alpha: Number.isFinite(options.alpha) ? options.alpha : (element === 'wind' ? 0.35 : 0.95),
    coreAlpha: Number.isFinite(options.coreAlpha) ? options.coreAlpha : (element === 'wind' ? 0.8 : 1),
    trailEnabled,
    trailStyle: {
      thickness: Math.max(2, (width || radius * 0.6) * 0.7),
      life: Number.isFinite(options.trailLife) ? options.trailLife : defaults.life,
      step: Number.isFinite(options.trailStep) ? options.trailStep : defaults.step,
      maxPoints: Number.isFinite(options.trailMaxPoints) ? options.trailMaxPoints : defaults.maxPoints
    },
    trail: []
  };
  state.projectileVisuals.set(id, visual);
  return visual;
}

export function destroyHitboxProjectileVisual(state, attackId) {
  const id = typeof attackId === 'string' ? attackId : attackId?.id;
  if (!id || !state?.projectileVisuals) return;
  state.projectileVisuals.delete(id);
}

export function syncHitboxProjectileVisualToAttack(state, hitbox) {
  if (!state?.projectileVisuals || !hitbox?.id) return null;
  const visual = state.projectileVisuals.get(hitbox.id);
  if (!visual) return null;
  const point = state.getHitboxCollisionPoint?.(hitbox);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return visual;
  const baseStyle = getHitboxProjectileTrailStyle(hitbox);
  const style = {
    thickness: Number.isFinite(visual?.trailStyle?.thickness) ? visual.trailStyle.thickness : baseStyle.thickness,
    angle: baseStyle.angle,
    life: Number.isFinite(visual?.trailStyle?.life) ? visual.trailStyle.life : baseStyle.life,
    step: Number.isFinite(visual?.trailStyle?.step) ? visual.trailStyle.step : baseStyle.step,
    maxPoints: Number.isFinite(visual?.trailStyle?.maxPoints) ? visual.trailStyle.maxPoints : baseStyle.maxPoints
  };
  const trail = visual.trail;
  const last = trail[trail.length - 1];
  const dx = last ? point.x - last.x : style.step + 1;
  const dy = last ? point.y - last.y : style.step + 1;
  const moved = dx * dx + dy * dy;
  visual.angle = style.angle;
  if (!last || moved >= style.step * style.step) {
    trail.push({
      x: point.x,
      y: point.y,
      age: 0,
      life: style.life,
      width: style.thickness
    });
    if (trail.length > style.maxPoints) {
      trail.shift();
    }
  } else {
    last.x = point.x;
    last.y = point.y;
    last.width = style.thickness;
    last.angle = style.angle;
  }
  visual.width = Math.max(0, Number(hitbox.width) || 0);
  visual.height = Math.max(0, Number(hitbox.height) || 0);
  visual.radius = Math.max(0, Number(hitbox.radius) || 0);
  return visual;
}

export function updateHitboxProjectileVisualTrails(state, hitboxes, dt) {
  if (!state?.projectileVisuals?.size) return;
  const activeIds = new Set();
  for (const h of hitboxes || []) {
    if (h.destroyed || !h?.id) continue;
    const visual = state.projectileVisuals.get(h.id);
    if (!visual) continue;
    activeIds.add(h.id);
    if (usesTrailSamples(visual)) syncHitboxProjectileVisualToAttack(state, h);
  }

  for (const [id, visual] of state.projectileVisuals.entries()) {
    const trail = visual?.trail || [];
    if (usesTrailSamples(visual)) {
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += dt;
      }
      while (trail.length > 0 && trail[0].age >= trail[0].life) {
        trail.shift();
      }
    }
    if (!activeIds.has(id) && (!trail.length || !hasDetachedTrailLayer(visual))) {
      state.projectileVisuals.delete(id);
    } else {
      visual.trail = trail;
    }
  }
}

export function drawHitboxProjectileTrails(state, ctx) {
  if (!ctx || !state?.projectileVisuals?.size) return;
  const camX = state.camera?.position?.x ?? 0;
  const camY = state.camera?.position?.y ?? 0;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const visual of state.projectileVisuals.values()) {
    if (!hasDetachedTrailLayer(visual)) continue;
    const trail = visual.trail || [];
    if (trail.length < 2) continue;
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const cur = trail[i];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen < 1) continue;
      const fade = Math.max(0, 1 - cur.age / Math.max(0.001, cur.life));
      const alpha = fade * fade;
      const progress = i / trail.length;
      const width = Math.max(4, cur.width * (0.45 + progress * 0.7));
      const sx = prev.x - camX;
      const sy = prev.y - camY;
      const ex = cur.x - camX;
      const ey = cur.y - camY;
      const isLightning = visual.elementalState === 'lightning';
      ctx.shadowColor = isLightning
        ? `rgba(253, 224, 71, ${Math.max(0.4, alpha * 0.8)})`
        : `rgba(186, 247, 255, ${alpha * 0.42})`;
      ctx.shadowBlur = isLightning ? 14 : 20;
      ctx.strokeStyle = isLightning
        ? `rgba(250, 204, 21, ${Math.max(0.75, alpha)})`
        : `rgba(186, 247, 255, ${Math.max(0.06, alpha * 0.28)})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = isLightning
        ? `rgba(254, 249, 195, ${Math.max(0.65, alpha * 0.95)})`
        : `rgba(220, 252, 255, ${Math.max(0.03, alpha * 0.14)})`;
      ctx.lineWidth = Math.max(isLightning ? 1.5 : 2, width * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const glow = Math.max(isLightning ? 0.6 : 0.03, alpha * (isLightning ? 0.95 : 0.1));
      const tipX = cur.x - camX;
      const tipY = cur.y - camY;
      ctx.fillStyle = isLightning
        ? `rgba(254, 249, 195, ${glow})`
        : `rgba(210, 252, 255, ${glow})`;
      ctx.beginPath();
      ctx.ellipse(tipX, tipY, width * (isLightning ? 0.7 : 0.95), width * (isLightning ? 0.4 : 0.55), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawOrbTrail(ctx, camera, visual, radius) {
  const trail = visual?.trail || [];
  if (!trail.length) return;
  const camX = camera?.position?.x ?? 0;
  const camY = camera?.position?.y ?? 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = trail.length;
  for (let i = 0; i < n; i++) {
    const t = trail[i];
    const progress = (i + 1) / n;
    const alpha = progress * 0.4;
    const r = radius * (0.5 + progress * 0.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = visual.color || '#a855f7';
    ctx.beginPath();
    ctx.arc(t.x - camX, t.y - camY, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHitboxProjectileVisuals(state, ctx, hitboxes) {
  if (!ctx || !state?.projectileVisuals?.size) return;
  const activeAttackLookup = new Map();
  for (const h of hitboxes || []) {
    if (!h?.id) continue;
    activeAttackLookup.set(h.id, h);
  }
  const camX = state.camera?.position?.x ?? 0;
  const camY = state.camera?.position?.y ?? 0;

  for (const [attackId, visual] of state.projectileVisuals.entries()) {
    const hitbox = activeAttackLookup.get(attackId);
    if (!hitbox || hitbox.destroyed) continue;
    const sx = hitbox.x - camX;
    const sy = hitbox.y - camY;
    const el = visual.elementalState || 'fire';
    const alpha = Number.isFinite(visual.alpha) ? visual.alpha : (el === 'wind' ? 0.35 : 1);

    if (visual.faction === 'enemy') {
      const radius = Math.max(1, visual.radius || Number(hitbox.radius) || 4);
      const diameter = radius * 2;
      const angle = Number.isFinite(visual.angle) ? visual.angle : Math.atan2(hitbox.dirY || 0, hitbox.dirX || 1);
      if (visual.spriteImage && visual.spriteImage.complete && visual.spriteImage.naturalWidth > 0 && visual.spriteImage.naturalHeight > 0) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.drawImage(visual.spriteImage, -radius, -radius, diameter, diameter);
        ctx.restore();
        continue;
      }
      if (visual.magicStyle) {
        const base = visual.magicStyle.preset != null ? visual.magicStyle.preset : visual.magicStyle;
        const trailPositions = (visual.trail || []).map((p) => ({
          x: p.x - diameter / 2,
          y: p.y - diameter / 2
        }));
        const opts = getMagicProjectileDrawOptions(base, {
          sx: sx - radius,
          sy: sy - radius,
          angle,
          size: diameter,
          primaryColor: visual.magicStyle.primaryColor ?? visual.color,
          secondaryColor: visual.magicStyle.secondaryColor,
          trailPositions,
          camera: state.camera,
          time: hitbox._age ?? 0,
          ...visual.magicStyle
        });
        drawMagicProjectile(ctx, opts);
        continue;
      }
      if (visual.trailEnabled) drawOrbTrail(ctx, state.camera, visual, radius);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1, alpha)})`);
      g.addColorStop(0.35, visual.color || '#a855f7');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if ((visual.shape || hitbox.shape) === 'rect') {
      const rectW = Math.max(1, visual.width || Number(hitbox.width) || 12);
      const rectH = Math.max(1, visual.height || Number(hitbox.height) || 72);
      const rcx = sx + rectW / 2;
      const rcy = sy + rectH / 2;
      const angleRad = Number.isFinite(visual.angle) ? visual.angle : (Number.isFinite(hitbox.angleRad) ? hitbox.angleRad : Math.atan2(hitbox.dirY || 0, hitbox.dirX || 1));
      const g = ctx.createLinearGradient(-rectW / 2, 0, rectW / 2, 0);
      if (el === 'wind') {
        g.addColorStop(0, `rgba(22, 163, 74, ${0.3 * alpha})`);
        g.addColorStop(0.5, `rgba(34, 197, 94, ${0.75 * alpha})`);
        g.addColorStop(1, `rgba(22, 163, 74, ${0.3 * alpha})`);
      } else if (el === 'lightning') {
        g.addColorStop(0, `rgba(234, 179, 8, ${0.35 * alpha})`);
        g.addColorStop(0.5, `rgba(250, 204, 21, ${0.8 * alpha})`);
        g.addColorStop(1, `rgba(234, 179, 8, ${0.35 * alpha})`);
      } else {
        g.addColorStop(0, `rgba(234, 88, 12, ${0.35 * alpha})`);
        g.addColorStop(0.5, `rgba(251, 146, 60, ${0.8 * alpha})`);
        g.addColorStop(1, `rgba(234, 88, 12, ${0.35 * alpha})`);
      }
      ctx.save();
      ctx.translate(rcx, rcy);
      ctx.rotate(angleRad);
      ctx.fillStyle = g;
      ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.strokeStyle = el === 'wind'
        ? `rgba(134, 239, 172, ${0.45 * alpha})`
        : el === 'lightning'
          ? `rgba(254, 249, 195, ${0.45 * alpha})`
          : `rgba(254, 215, 170, ${0.45 * alpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.restore();
    } else {
      const r = Math.max(1, visual.radius || Number(hitbox.radius) || 4);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      if (el === 'wind') {
        g.addColorStop(0, `rgba(134, 239, 172, ${0.8 * alpha})`);
        g.addColorStop(0.6, `rgba(34, 197, 94, ${0.55 * alpha})`);
        g.addColorStop(1, `rgba(22, 163, 74, ${0.28 * alpha})`);
      } else if (el === 'lightning') {
        g.addColorStop(0, `rgba(254, 249, 195, ${0.95 * alpha})`);
        g.addColorStop(0.6, `rgba(250, 204, 21, ${0.7 * alpha})`);
        g.addColorStop(1, `rgba(234, 179, 8, ${0.4 * alpha})`);
      } else {
        g.addColorStop(0, `rgba(254, 215, 170, ${0.95 * alpha})`);
        g.addColorStop(0.6, `rgba(251, 146, 60, ${0.7 * alpha})`);
        g.addColorStop(1, `rgba(234, 88, 12, ${0.4 * alpha})`);
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
