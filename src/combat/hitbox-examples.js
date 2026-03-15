/**
 * Example hitbox definitions and usage for the combat system.
 * Copy or adapt these when spawning melee slashes, thrusts, projectiles, and AoEs.
 * Logic and presentation are separate; VFX can be hooked elsewhere.
 */

import { createHitbox } from './hitbox-system.js';

// --- Example definitions (data only) -----------------------------------------

/** Basic slash: cone in front of the player (melee arc). */
export const SLASH_CONE_DEF = {
  id: 'slash_cone',
  shape: 'cone',
  radius: 80,
  coneAngleRad: Math.PI / 6,
  durationMs: 150,
  moveSpeed: 0,
  damage: 20,
  hitStunMs: 100,
  knockback: 30,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['melee', 'slash']
};

/** Thrust: narrow rect (e.g. spear/rapier). */
export const THRUST_RECT_DEF = {
  id: 'thrust_rect',
  shape: 'rect',
  width: 24,
  height: 80,
  durationMs: 120,
  moveSpeed: 0,
  damage: 25,
  hitStunMs: 80,
  knockback: 40,
  maxHitsPerTarget: 1,
  followOwner: true,
  tags: ['melee', 'thrust']
};

/** Fireball: moving circle projectile (straight). */
export const FIREBALL_CIRCLE_DEF = {
  id: 'fireball',
  shape: 'circle',
  radius: 24,
  durationMs: 2000,
  moveSpeed: 320,
  moveMode: 'straight',
  damage: 35,
  hitStunMs: 0,
  knockback: 20,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['projectile', 'fire']
};

/** Accelerating projectile: speed increases over time, capped at maxSpeed. */
export const ACCELERATING_PROJECTILE_DEF = {
  id: 'accelerating_projectile',
  shape: 'circle',
  radius: 12,
  durationMs: 3000,
  moveSpeed: 150,
  moveMode: 'accelerating',
  maxSpeed: 400,
  accel: 120,
  damage: 25,
  hitStunMs: 0,
  knockback: 15,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['projectile', 'accelerating']
};

/** Zigzag projectile: moves forward with sinusoidal perpendicular oscillation. */
export const ZIGZAG_PROJECTILE_DEF = {
  id: 'zigzag_projectile',
  shape: 'circle',
  radius: 8,
  durationMs: 2500,
  moveSpeed: 280,
  moveMode: 'zigzag',
  zigzagAmplitude: 24,
  zigzagFrequency: 6,
  damage: 20,
  hitStunMs: 0,
  knockback: 10,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['projectile', 'zigzag']
};

/** Slight homing projectile: steers gradually toward targetId (e.g. 'player'). */
export const HOMING_PROJECTILE_DEF = {
  id: 'homing_projectile',
  shape: 'circle',
  radius: 10,
  durationMs: 2500,
  moveSpeed: 200,
  moveMode: 'homing',
  homingStrength: 2.5,
  damage: 22,
  hitStunMs: 0,
  knockback: 12,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['projectile', 'homing']
};

/** Player projectile shot: moving circle, straight line, one hit then despawn. Speed/radius/duration overridden at spawn. */
export const PLAYER_PROJECTILE_CIRCLE_DEF = {
  id: 'player_projectile',
  shape: 'circle',
  radius: 4,
  durationMs: 2700,
  moveSpeed: 520,
  damage: 0,
  hitStunMs: 0,
  knockback: 0,
  maxHitsPerTarget: 1,
  maxTotalTargets: 1,
  followOwner: false,
  tags: ['projectile', 'player_shot']
};

/** Elemental Shot wind surge: long thin rect moving forward, long side perpendicular to movement (arc slash). */
export const PLAYER_ELEMENTAL_WIND_RECT_DEF = {
  id: 'player_projectile',
  shape: 'rect',
  width: 12,
  height: 72,
  durationMs: 2700,
  moveSpeed: 520,
  damage: 0,
  hitStunMs: 0,
  knockback: 0,
  maxHitsPerTarget: 1,
  maxTotalTargets: 999999,
  followOwner: false,
  tags: ['projectile', 'player_shot', 'elemental_wind']
};

/** Explosion: stationary circle (instant or short duration AoE). */
export const EXPLOSION_CIRCLE_DEF = {
  id: 'explosion',
  shape: 'circle',
  radius: 60,
  durationMs: 100,
  moveSpeed: 0,
  damage: 50,
  hitStunMs: 200,
  knockback: 80,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['aoe', 'explosion']
};

// --- Integrated attack definitions (tuned for in-game use) -------------------

/** Player fan strike: frontal cone slash. Hits all enemies in cone, each at most once (no maxTotalTargets). */
export const PLAYER_FAN_CONE_DEF = {
  id: 'player_fan',
  shape: 'cone',
  radius: 210,
  coneAngleRad: (60 * Math.PI) / 180,
  durationMs: 120,
  moveSpeed: 0,
  damage: 0,
  hitStunMs: 100,
  knockback: 25,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['melee', 'fanStrike']
};

/** Death Knight cleave: cone strike. Range/arc match enemy-attack-kits (360 range, 100 arc). */
export const DEATH_KNIGHT_CONE_DEF = {
  id: 'death_knight_cleave',
  shape: 'cone',
  radius: 360,
  coneAngleRad: (50 * Math.PI) / 180,
  durationMs: 80,
  moveSpeed: 0,
  damage: 0,
  hitStunMs: 150,
  knockback: 60,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['enemy', 'heavy']
};

/** Player thrust: narrow rect stab. Directional knockback so targets are pushed in attack direction. */
export const PLAYER_THRUST_RECT_DEF = {
  id: 'player_thrust',
  shape: 'rect',
  width: 240,
  height: 30,
  durationMs: 100,
  moveSpeed: 0,
  damage: 0,
  hitStunMs: 80,
  knockback: 45,
  knockbackMode: 'directional',
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['melee', 'thrustStrike']
};

/** Player pulse: stationary circle AoE at target location. Radial knockback; telegraph is visual-only, damage is this hitbox. */
export const PLAYER_PULSE_CIRCLE_DEF = {
  id: 'player_pulse',
  shape: 'circle',
  radius: 55,
  durationMs: 80,
  moveSpeed: 0,
  damage: 0,
  hitStunMs: 100,
  knockback: 18,
  knockbackMode: 'radial',
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['aoe', 'pulseShot']
};

/** Skeleton Archer arrow: moving circle projectile (enemy → player). Damage/radius/speed overridden at spawn. Radius = executeOpts.size/2 (size is diameter). */
export const SKELETON_ARCHER_ARROW_DEF = {
  id: 'skeleton_archer_arrow',
  shape: 'circle',
  radius: 5,
  durationMs: 2500,
  moveSpeed: 350,
  moveMode: 'straight',
  damage: 0,
  hitStunMs: 0,
  knockback: 0,
  maxHitsPerTarget: 1,
  maxTotalTargets: 1,
  followOwner: false,
  tags: ['enemy_projectile', 'skeleton_archer']
};

/** Human Lancer thrust: rect line attack. Directional knockback along thrust direction. */
export const HUMAN_LANCER_THRUST_RECT_DEF = {
  id: 'human_lancer_thrust',
  shape: 'rect',
  width: 280,
  height: 72,
  durationMs: 80,
  moveSpeed: 0,
  damage: 0,
  hitStunMs: 120,
  knockback: 50,
  knockbackMode: 'directional',
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['enemy', 'heavy']
};

/** Soul Siphon channel beam: fixed rect (200 length, 80 width). Damage overridden at spawn. */
export const SOUL_SIPHON_BEAM_RECT_DEF = {
  id: 'soul_siphon_beam',
  shape: 'rect',
  width: 200,
  height: 80,
  durationMs: 80,
  moveSpeed: 0,
  damage: 0,
  hitStunMs: 0,
  knockback: 0,
  maxHitsPerTarget: 1,
  followOwner: false,
  tags: ['melee', 'soulSiphon']
};

/**
 * Place a thrust rect to match the thrust visual: line from (px,py) to (px+dirX*length, py+dirY*length).
 * Rect center = midpoint of that line; length along dir, thickness perpendicular; rotation = atan2(dirY, dirX).
 * @param {number} px - Start point (e.g. player center) X
 * @param {number} py - Start point Y
 * @param {number} dirX - Unit direction X (e.g. toward cursor)
 * @param {number} dirY - Unit direction Y
 * @param {number} length - Thrust length along dir (same as visual line)
 * @param {number} thickness - Thrust thickness perpendicular to dir
 * @param {number} offset - Extra distance from (px,py) to the near edge; 0 = rect spans start to end like the visual
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function thrustRectFromDirection(px, py, dirX, dirY, length, thickness, offset = 0) {
  // Same geometry as attackThrustLunge: line from start to end; rect center = midpoint.
  const startX = px + dirX * offset;
  const startY = py + dirY * offset;
  const endX = startX + dirX * length;
  const endY = startY + dirY * length;
  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const width = length;
  const height = thickness;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  return { x, y, width, height };
}

// --- Usage examples (call from game when starting an attack / spawning) -------

/**
 * Spawn a cone slash at (x, y) facing (dirX, dirY). Call from basic attack or skill.
 *
 * @param {number} x - World X (e.g. player center).
 * @param {number} y - World Y
 * @param {number} dirX - Facing X (normalized)
 * @param {number} dirY - Facing Y
 * @param {number} gameTime - this.time
 * @param {string} [faction] - 'player' | 'enemy'
 * @param {string|null} [ownerId]
 */
export function spawnSlashCone(x, y, dirX, dirY, gameTime, faction = 'player', ownerId = null) {
  return createHitbox(SLASH_CONE_DEF, {
    x, y, dirX, dirY,
    createdAt: gameTime,
    faction,
    ownerId
  });
}

/**
 * Spawn a thrust rect. Use followOwner: true so the rect stays on the owner;
 * set x,y to the front of the owner when spawning, then the system will sync each frame if def has followOwner.
 *
 * @param {number} x - World X (front of attacker).
 * @param {number} y - World Y
 * @param {number} dirX - Facing X
 * @param {number} dirY - Facing Y
 * @param {number} gameTime
 * @param {string} [faction]
 * @param {string|null} [ownerId]
 */
export function spawnThrustRect(x, y, dirX, dirY, gameTime, faction = 'player', ownerId = null) {
  return createHitbox(THRUST_RECT_DEF, {
    x, y, dirX, dirY,
    createdAt: gameTime,
    faction,
    ownerId,
    followOwner: true
  });
}

/**
 * Spawn a fireball that moves in (dirX, dirY) at moveSpeed.
 *
 * @param {number} x - Start X
 * @param {number} y - Start Y
 * @param {number} dirX - Direction X
 * @param {number} dirY - Direction Y
 * @param {number} gameTime
 * @param {string} [faction]
 * @param {string|null} [ownerId]
 */
export function spawnFireball(x, y, dirX, dirY, gameTime, faction = 'player', ownerId = null) {
  return createHitbox(FIREBALL_CIRCLE_DEF, {
    x, y, dirX, dirY,
    createdAt: gameTime,
    faction,
    ownerId
  });
}

/**
 * Spawn a stationary explosion at (x, y).
 *
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} gameTime
 * @param {string} [faction]
 * @param {string|null} [ownerId]
 */
export function spawnExplosion(x, y, gameTime, faction = 'player', ownerId = null) {
  return createHitbox(EXPLOSION_CIRCLE_DEF, {
    x, y,
    createdAt: gameTime,
    faction,
    ownerId
  });
}

/**
 * Spawn an accelerating projectile (speed increases over time, capped at maxSpeed).
 */
export function spawnAcceleratingProjectile(x, y, dirX, dirY, gameTime, faction = 'player', ownerId = null) {
  return createHitbox(ACCELERATING_PROJECTILE_DEF, {
    x, y, dirX, dirY,
    createdAt: gameTime,
    faction,
    ownerId
  });
}

/**
 * Spawn a zigzag projectile (forward motion + sinusoidal perpendicular oscillation).
 */
export function spawnZigzagProjectile(x, y, dirX, dirY, gameTime, faction = 'player', ownerId = null) {
  return createHitbox(ZIGZAG_PROJECTILE_DEF, {
    x, y, dirX, dirY,
    createdAt: gameTime,
    faction,
    ownerId
  });
}

/**
 * Spawn a slight-homing projectile that steers toward targetId (e.g. 'player').
 */
export function spawnHomingProjectile(x, y, dirX, dirY, gameTime, targetId, faction = 'player', ownerId = null) {
  return createHitbox(HOMING_PROJECTILE_DEF, {
    x, y, dirX, dirY,
    createdAt: gameTime,
    targetId,
    faction,
    ownerId
  });
}
