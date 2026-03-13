/**
 * Combat module: hitbox-based melee, projectiles, cones, and AoEs.
 * Single entry point for the game to import.
 */

export { createHitbox, updateHitboxes, getActiveHitboxes, clearHitboxes, drawHitboxDebug, updateProjectileMotion } from './hitbox-system.js';
export { createHitboxInstance, resetHitboxIds } from './hitbox-factory.js';
export { resolveHit } from './hit-resolution.js';
export { SHAPES, MOVE_MODES } from './hitbox-types.js';
