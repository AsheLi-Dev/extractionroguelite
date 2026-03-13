/**
 * Hitbox types and constants for the combat system.
 *
 * Architecture: We keep a minimal, data-driven model. Hitbox *definitions* describe
 * shape and stats; runtime *instances* are created by the factory and updated by
 * the system. This keeps melee, projectiles, cones, beams, and AoEs as one unified
 * hitbox abstraction without duplicating collision or resolution logic.
 */

/** @typedef {'circle'|'rect'|'cone'} HitboxShape */

/** @typedef {'straight'|'accelerating'|'zigzag'|'homing'} MoveMode */

/**
 * Hitbox definition (data only). Used by the factory to create instances.
 * All numeric fields are optional; the factory applies safe defaults.
 * @typedef {Object} HitboxDef
 * @property {string} [id] - Definition id (for debugging / lookup).
 * @property {HitboxShape} [shape] - 'circle' | 'rect' | 'cone'
 * @property {number} [radius] - For circle (outer radius); cone length if used as range.
 * @property {number} [innerRadius] - For circle: inner radius of ring (0 = full circle).
 * @property {number} [width] - For rect.
 * @property {number} [height] - For rect.
 * @property {number} [coneAngleRad] - Cone half-angle in radians.
 * @property {number} [durationMs] - How long the hitbox lives (0 = one frame).
 * @property {number} [moveSpeed] - Pixels per second in dir; 0 = stationary.
 * @property {MoveMode} [moveMode] - 'straight' | 'accelerating' | 'zigzag' | 'homing'; only used when moveSpeed > 0.
 * @property {number} [maxSpeed] - For accelerating: cap speed (pixels/sec).
 * @property {number} [accel] - For accelerating: speed gain per second (pixels/sec²).
 * @property {string} [targetId] - For homing: entity id to steer toward (e.g. 'player').
 * @property {number} [homingStrength] - For homing: blend factor per second (e.g. 2 = steer noticeably each second).
 * @property {number} [zigzagAmplitude] - For zigzag: perpendicular offset in pixels.
 * @property {number} [zigzagFrequency] - For zigzag: oscillation rad/sec (e.g. 6 ≈ 1 cycle per second).
 * @property {number} [damage]
 * @property {number} [hitStunMs]
 * @property {number} [knockback]
 * @property {'radial'|'directional'} [knockbackMode] - 'radial' = push away from hitbox center; 'directional' = push along hitbox dir (default 'radial').
 * @property {number} [maxHitsPerTarget] - Max times this hitbox can hit the same target (default 1).
 * @property {number} [maxTotalTargets] - Max number of different targets that can be hit; omit = unlimited.
 * @property {boolean} [followOwner] - If true, position is synced to owner each frame.
 * @property {string[]} [tags]
 */

/**
 * Runtime hitbox instance. Mutable; updated by hitbox-system each frame.
 * Targets are treated as circles (center + radius) for overlap tests.
 * @typedef {Object} HitboxInstance
 * @property {string} id
 * @property {string} defId
 * @property {string|null} ownerId
 * @property {string} faction - e.g. 'player' | 'enemy'; used to pick valid targets.
 * @property {number} x - World position (center for circle/cone; corner/origin for rect).
 * @property {number} y
 * @property {number} dirX - Unit direction (for movement and cone/rect facing).
 * @property {number} dirY
 * @property {number} angleRad - Facing angle in radians (used for cone).
 * @property {number} createdAt - Timestamp (game time) when created.
 * @property {number} expiresAt - Timestamp when the hitbox should be removed.
 * @property {HitboxShape} shape
 * @property {number} radius - Outer radius for circle; inner radius 0 = full circle.
 * @property {number} innerRadius - For circle: inner radius (0 = full circle, >0 = ring).
 * @property {number} width
 * @property {number} height
 * @property {number} coneAngleRad
 * @property {number} moveSpeed
 * @property {number} damage
 * @property {number} hitStunMs
 * @property {number} knockback
 * @property {'radial'|'directional'} knockbackMode
 * @property {number} maxHitsPerTarget
 * @property {number|undefined} maxTotalTargets - Cap on how many different targets; undefined = no cap.
 * @property {Set<string>} hitTargets - Entity ids already hit (per-target and total caps).
 * @property {boolean} followOwner
 * @property {boolean} destroyed
 * @property {string[]} tags
 * --- Optional projectile motion (only used when moveSpeed > 0 and moveMode is set) ---
 * @property {MoveMode} [moveMode] - Default 'straight'.
 * @property {number} [_currentSpeed] - For accelerating: current speed (pixels/sec).
 * @property {number} [maxSpeed]
 * @property {number} [accel]
 * @property {string|null} [targetId] - For homing.
 * @property {number} [homingStrength]
 * @property {number} [zigzagAmplitude]
 * @property {number} [zigzagFrequency]
 * @property {number} [forwardX] - For zigzag: fixed forward direction (unit).
 * @property {number} [forwardY]
 * @property {number} [_zigzagStartX] - For zigzag: spawn position X.
 * @property {number} [_zigzagStartY] - For zigzag: spawn position Y.
 */

export const SHAPES = /** @type {const} */ (['circle', 'rect', 'cone']);
export const MOVE_MODES = /** @type {const} */ (['straight', 'accelerating', 'zigzag', 'homing']);
