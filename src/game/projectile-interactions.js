import { PlayerProjectile } from '../entities/projectile.js';

function resolveProjectileBasePosition(projectile) {
  if (!projectile || typeof projectile !== 'object') return null;
  const pos = projectile.position;
  const x = Number.isFinite(pos?.x) ? pos.x : (Number.isFinite(projectile.x) ? projectile.x : null);
  const y = Number.isFinite(pos?.y) ? pos.y : (Number.isFinite(projectile.y) ? projectile.y : null);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Try to interact a projectile-like object with active orb-like skill effects.
 *
 * Notes:
 * - This helper does not remove the projectile from its container/array; the caller
 *   should do that if `consumed` is true.
 * - Safe gating: projectiles opt out via `absorbableByOrb === false`.
 */
export function tryInteractProjectileWithOrbs(game, projectileLike, options = {}) {
  if (!game || !projectileLike) return { consumed: false, orbEff: null, reason: 'no_projectile' };
  if (projectileLike._fromAssimilativeOrb) return { consumed: false, orbEff: null, reason: 'from_assimilative_orb' };
  if (projectileLike.absorbableByOrb === false) return { consumed: false, orbEff: null, reason: 'not_absorbable' };

  const base = resolveProjectileBasePosition(projectileLike);
  if (!base) return { consumed: false, orbEff: null, reason: 'no_position' };

  const size = Number.isFinite(options.size)
    ? Number(options.size)
    : Math.max(0, Number(projectileLike.size) || 0);
  const radius = Number.isFinite(options.radius)
    ? Number(options.radius)
    : (size > 0 ? size / 2 : 0);

  const positionIsCenter = options.positionIsCenter === true;
  const cx = positionIsCenter ? base.x : base.x + (size > 0 ? size / 2 : 0);
  const cy = positionIsCenter ? base.y : base.y + (size > 0 ? size / 2 : 0);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return { consumed: false, orbEff: null, reason: 'bad_center' };

  const effects = Array.isArray(game.skillEffects) ? game.skillEffects : [];
  for (const orb of effects) {
    if (!orb || orb.type !== 'assimilativeOrb') continue;
    if (orb.t >= (orb.duration ?? 5)) continue;
    const orbRadius = orb.radius ?? 40;
    const dx = cx - orb.x;
    const dy = cy - orb.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > (orbRadius + radius) * (orbRadius + radius)) continue;

    orb.absorbedCount = (orb.absorbedCount || 0) + 1;
    const target = game.getNearestEnemy(orb.x, orb.y, 400);
    const tx = target ? target.position.x + target.size / 2 : orb.x + 100;
    const ty = target ? target.position.y + target.size / 2 : orb.y;
    const dmg = game.computeSkillDamage(target, 0.4, orb.slot, {
      sacrificeMult: orb.sacrificeMult,
      skillId: orb.skillId,
      skillMults: orb.skillMults
    });
    const bolt = new PlayerProjectile(orb.x, orb.y, tx, ty, dmg, { forceHoming: true });
    bolt._fromAssimilativeOrb = true;
    game.playerProjectiles.push(bolt);
    return { consumed: true, orbEff: orb, reason: 'assimilative_orb' };
  }

  return { consumed: false, orbEff: null, reason: 'no_orb_hit' };
}

