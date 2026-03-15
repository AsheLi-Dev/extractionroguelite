/**
 * Hit resolution: when a hitbox overlaps a target, this module applies damage,
 * stun, knockback, and records the hit. It is decoupled from VFX/animation;
 * the game can hook into applyDamage etc. for feedback later.
 *
 * World adapter: the game passes a world object with optional methods. If
 * methods are missing, we no-op so the system can run in isolation. Expected:
 * - getTargetsByFaction(faction) -> [{ id, x, y, radius }, ...]
 * - getEntityById(id) -> entity (for passing to dealDamageToEnemy etc.)
 * - damageEntity(targetId, amount, source) -> applied
 * - applyStun(targetId, ms)
 * - applyKnockback(targetId, fromX, fromY, force, opts?) — opts.mode 'directional' uses opts.dirX/dirY; else radial from (fromX, fromY)
 * The project uses dealDamageToEnemy(enemy, amount, opts) and enemy.stunUntil /
 * position updates for knockback, so the game will wrap those in the adapter.
 */

/**
 * Resolve a single hit: enforce maxHitsPerTarget, apply damage/stun/knockback,
 * and record the target in the hitbox's hitTargets.
 *
 * @param {import('./hitbox-types.js').HitboxInstance} hitbox
 * @param {{ id: string, x: number, y: number, radius: number }} target
 * @param {{ getEntityById?: (id: string) => unknown, damageEntity?: (targetId: string, amount: number, source: unknown) => void, applyStun?: (targetId: string, ms: number) => void, applyKnockback?: (targetId: string, fromX: number, fromY: number, force: number) => void }} world
 */
export function resolveHit(hitbox, target, world) {
  if (hitbox.destroyed) return;
  if (hitbox.hitTargets.has(target.id)) return;
  if (hitbox.maxTotalTargets != null && hitbox.hitTargets.size >= hitbox.maxTotalTargets) return;

  const damage = Math.max(0, hitbox.damage);
  const hitStunMs = Math.max(0, hitbox.hitStunMs);
  const knockback = Math.max(0, hitbox.knockback);

  if (damage > 0 && typeof world.damageEntity === 'function') {
    const source = hitbox.sourceEntity || (typeof world.getEntityById === 'function' ? world.getEntityById(hitbox.ownerId) : null);
    world.damageEntity(target.id, damage, source, { hitbox });
  }
  if (typeof world.applyStun === 'function' && hitStunMs > 0) {
    world.applyStun(target.id, hitStunMs);
  }
  if (typeof world.applyKnockback === 'function' && knockback > 0) {
    world.applyKnockback(target.id, hitbox.x, hitbox.y, knockback, {
      mode: hitbox.knockbackMode || 'radial',
      dirX: hitbox.dirX,
      dirY: hitbox.dirY
    });
  }

  hitbox.hitTargets.add(target.id);
  if (hitbox.maxTotalTargets != null && hitbox.hitTargets.size >= hitbox.maxTotalTargets) {
    hitbox.destroyed = true;
  }

  if (typeof hitbox.onHit === 'function') {
    hitbox.onHit(hitbox, target, world);
  }
}
