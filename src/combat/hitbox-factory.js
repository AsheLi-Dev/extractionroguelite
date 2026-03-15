/**
 * Hitbox factory: creates runtime hitbox instances from a definition and spawn data.
 * Keeps creation logic and default handling in one place so the main system
 * only deals with update/collision/resolution.
 */

import { SHAPES, MOVE_MODES } from './hitbox-types.js';

let _nextId = 0;

function nextId() {
  return `hb_${_nextId++}_${Date.now()}`;
}

/**
 * Spawn data when creating a hitbox. Overrides or supplies def defaults.
 * @typedef {Object} HitboxSpawnData
 * @property {number} x
 * @property {number} y
 * @property {number} [dirX]
 * @property {number} [dirY]
 * @property {number} [angleRad]
 * @property {string|null} [ownerId]
 * @property {string} [faction]
 * @property {number} [createdAt] - Game time; defaults to 0 if not provided by caller.
 * @property {number} [damage]
 * @property {number} [hitStunMs]
 * @property {number} [knockback]
 * @property {number} [durationMs]
 * @property {number} [moveSpeed]
 * @property {number} [maxHitsPerTarget]
 * @property {boolean} [followOwner]
 * @property {string[]} [tags]
 * @property {string} [moveMode] - 'straight' | 'accelerating' | 'speed_ramp' | 'zigzag' | 'segment_zigzag' | 'homing' | 'spiral'
 * @property {number} [maxSpeed]
 * @property {number} [accel]
 * @property {number} [speedRampEnd]
 * @property {number} [speedRampDuration]
 * @property {string} [targetId]
 * @property {number} [homingStrength]
 * @property {number} [zigzagAmplitude]
 * @property {number} [zigzagFrequency]
 * @property {number} [zigzagPhaseOffset]
 * @property {number} [spiralDirection]
 * @property {number} [spiralTurnRate]
 * @property {(hitbox: import('./hitbox-types.js').HitboxInstance, world: unknown) => void} [onHit]
 * @property {(reason: string, hitbox: import('./hitbox-types.js').HitboxInstance, world: unknown) => void} [onExpire]
 */

/**
 * Normalize direction to unit vector; if zero, use angle or default to (1,0).
 * @param {number} dirX
 * @param {number} dirY
 * @param {number} [angleRad]
 * @returns {{ dirX: number, dirY: number }}
 */
function normalizeDir(dirX, dirY, angleRad) {
  const dx = Number(dirX) || 0;
  const dy = Number(dirY) || 0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1e-6) {
    return { dirX: dx / len, dirY: dy / len };
  }
  if (typeof angleRad === 'number') {
    return { dirX: Math.cos(angleRad), dirY: Math.sin(angleRad) };
  }
  return { dirX: 1, dirY: 0 };
}

/**
 * Create a single hitbox instance from a definition and spawn data.
 * Defaults are applied so missing def fields don't break the system.
 *
 * @param {import('./hitbox-types.js').HitboxDef} def
 * @param {HitboxSpawnData} spawn
 * @returns {import('./hitbox-types.js').HitboxInstance}
 */
export function createHitboxInstance(def, spawn) {
  const defId = def?.id ?? 'unknown';
  const shape = SHAPES.includes(def?.shape) ? def.shape : 'circle';
  const radius = Math.max(0, Number(spawn?.radius ?? def?.radius) ?? 0);
  const innerRadius = Math.max(0, Number(spawn?.innerRadius ?? def?.innerRadius) ?? 0);
  const width = Math.max(0, Number(spawn?.width ?? def?.width) ?? 0);
  const height = Math.max(0, Number(spawn?.height ?? def?.height) ?? 0);
  const coneAngleRad = Math.max(0, Number(def?.coneAngleRad) ?? Math.PI / 4);
  const durationMs = Math.max(0, Number(spawn?.durationMs ?? def?.durationMs) ?? 100);
  const createdAt = Number(spawn?.createdAt) ?? 0;
  const expiresAt = createdAt + durationMs / 1000;

  const dir = normalizeDir(
    spawn?.dirX ?? def?.dirX ?? 1,
    spawn?.dirY ?? def?.dirY ?? 0,
    spawn?.angleRad ?? def?.angleRad
  );

  const damage = Math.max(0, Number(spawn?.damage ?? def?.damage) ?? 0);
  const hitStunMs = Math.max(0, Number(spawn?.hitStunMs ?? def?.hitStunMs) ?? 0);
  const knockback = Math.max(0, Number(spawn?.knockback ?? def?.knockback) ?? 0);
  const knockbackMode = (spawn?.knockbackMode ?? def?.knockbackMode) === 'directional' ? 'directional' : 'radial';
  const maxHitsPerTarget = Math.max(1, Math.floor(Number(spawn?.maxHitsPerTarget ?? def?.maxHitsPerTarget) ?? 1));
  const maxTotalTargets = spawn?.maxTotalTargets ?? def?.maxTotalTargets;
  const followOwner = Boolean(spawn?.followOwner ?? def?.followOwner ?? false);
  const moveSpeed = Math.max(0, Number(spawn?.moveSpeed ?? def?.moveSpeed) ?? 0);

  const rawMoveMode = spawn?.moveMode ?? def?.moveMode ?? 'straight';
  const moveMode = MOVE_MODES.includes(rawMoveMode) ? rawMoveMode : 'straight';

  const maxSpeed = Math.max(0, Number(spawn?.maxSpeed ?? def?.maxSpeed) ?? 0);
  const accel = Number(spawn?.accel ?? def?.accel) ?? 0;
  const speedRampEnd = Number(spawn?.speedRampEnd ?? def?.speedRampEnd);
  const speedRampDuration = Math.max(0, Number(spawn?.speedRampDuration ?? def?.speedRampDuration) ?? 0);
  const targetId = spawn?.targetId ?? def?.targetId ?? null;
  const homingStrength = Math.max(0, Number(spawn?.homingStrength ?? def?.homingStrength) ?? 2);
  const zigzagAmplitude = Math.max(0, Number(spawn?.zigzagAmplitude ?? def?.zigzagAmplitude) ?? 20);
  const zigzagFrequency = Math.max(0, Number(spawn?.zigzagFrequency ?? def?.zigzagFrequency) ?? 6);
  const zigzagPhaseOffset = Number(spawn?.zigzagPhaseOffset ?? def?.zigzagPhaseOffset) || 0;
  const spiralDirection = Number(spawn?.spiralDirection ?? def?.spiralDirection) || 1;
  const spiralTurnRate = Number(spawn?.spiralTurnRate ?? def?.spiralTurnRate) || 2.5;
  const zigzagSegmentSec = Math.max(0.01, Number(spawn?.zigzagSegmentSec ?? def?.zigzagSegmentSec) || 0.08);
  const zigzagSegmentSecMin = Math.max(0.001, Number(spawn?.zigzagSegmentSecMin ?? def?.zigzagSegmentSecMin) || zigzagSegmentSec);
  const zigzagSegmentSecMax = Math.max(zigzagSegmentSecMin, Number(spawn?.zigzagSegmentSecMax ?? def?.zigzagSegmentSecMax) || zigzagSegmentSecMin);
  const zigzagLateralWeight = Math.max(0, Number(spawn?.zigzagLateralWeight ?? def?.zigzagLateralWeight) || 0.55);
  const zigzagLateralWeightMin = Math.max(0, Number(spawn?.zigzagLateralWeightMin ?? def?.zigzagLateralWeightMin) || zigzagLateralWeight);
  const zigzagLateralWeightMax = Math.max(zigzagLateralWeightMin, Number(spawn?.zigzagLateralWeightMax ?? def?.zigzagLateralWeightMax) || zigzagLateralWeightMin);
  const zigzagMaxSegments = spawn?.zigzagMaxSegments ?? def?.zigzagMaxSegments ?? null;

  const x0 = Number(spawn?.x) ?? 0;
  const y0 = Number(spawn?.y) ?? 0;
  const forwardX = dir.dirX;
  const forwardY = dir.dirY;
  const _currentSpeed = moveSpeed;

  const tags = Array.isArray(def?.tags) ? [...def.tags] : [];
  if (Array.isArray(spawn?.tags)) spawn.tags.forEach(t => tags.push(t));

  const sniperPierceFalloff = spawn?.sniperPierceFalloff ?? def?.sniperPierceFalloff ?? null;

  const lifetimeSec = durationMs / 1000;
  const instance = {
    id: nextId(),
    defId,
    ownerId: spawn?.ownerId ?? def?.ownerId ?? null,
    faction: String(spawn?.faction ?? def?.faction ?? 'player'),
    x: Number(spawn?.x) ?? 0,
    y: Number(spawn?.y) ?? 0,
    dirX: dir.dirX,
    dirY: dir.dirY,
    angleRad: typeof spawn?.angleRad === 'number' ? spawn.angleRad : Math.atan2(dir.dirY, dir.dirX),
    createdAt,
    expiresAt,
    _lifetimeSec: lifetimeSec,
    _age: 0,
    shape,
    radius,
    innerRadius: shape === 'circle' ? Math.min(innerRadius, radius) : 0,
    width,
    height,
    coneAngleRad,
    moveSpeed,
    damage,
    hitStunMs,
    knockback,
    knockbackMode,
    maxHitsPerTarget,
    maxTotalTargets: maxTotalTargets === undefined ? undefined : Math.max(0, Math.floor(Number(maxTotalTargets))),
    hitTargets: new Set(),
    breakHitTargets: new Set(),
    followOwner,
    destroyed: false,
    tags
  };

  if (moveSpeed > 0) {
    instance.moveMode = moveMode;
    instance.forwardX = forwardX;
    instance.forwardY = forwardY;
    if (moveMode === 'accelerating') {
      instance._currentSpeed = _currentSpeed;
      instance.maxSpeed = maxSpeed > 0 ? maxSpeed : 9999;
      instance.accel = accel;
    }
    if (moveMode === 'speed_ramp') {
      instance.speedRampStart = moveSpeed;
      instance.speedRampEnd = Number.isFinite(speedRampEnd) ? speedRampEnd : moveSpeed;
      instance.speedRampDuration = speedRampDuration;
      instance._currentSpeed = moveSpeed;
    }
    if (moveMode === 'homing' && targetId) {
      instance.targetId = String(targetId);
      instance.homingStrength = homingStrength;
    }
    if (moveMode === 'zigzag') {
      instance._zigzagStartX = x0;
      instance._zigzagStartY = y0;
      instance.zigzagAmplitude = zigzagAmplitude;
      instance.zigzagFrequency = zigzagFrequency;
      instance.zigzagPhaseOffset = zigzagPhaseOffset;
    }
    if (moveMode === 'segment_zigzag') {
      instance.zigzagSegmentSec = zigzagSegmentSec;
      instance.zigzagSegmentSecMin = zigzagSegmentSecMin;
      instance.zigzagSegmentSecMax = zigzagSegmentSecMax;
      instance.zigzagLateralWeight = zigzagLateralWeight;
      instance.zigzagLateralWeightMin = zigzagLateralWeightMin;
      instance.zigzagLateralWeightMax = zigzagLateralWeightMax;
      instance.zigzagMaxSegments = zigzagMaxSegments == null ? null : Math.max(0, Math.floor(Number(zigzagMaxSegments)));
      instance._zigzagSegmentTimer = 0;
      instance._zigzagSegmentIndex = 0;
      instance._zigzagSegmentSign = 1;
      instance._zigzagSegmentLateralWeight = zigzagLateralWeightMin;
    }
    if (moveMode === 'spiral') {
      instance.spiralDirection = spiralDirection;
      instance.spiralTurnRate = spiralTurnRate;
      instance._spiralBaseAngle = Math.atan2(dir.dirY, dir.dirX);
    }
  }
  if (sniperPierceFalloff && typeof sniperPierceFalloff === 'object') {
    instance.sniperPierceFalloff = sniperPierceFalloff;
  }

  if (typeof (spawn?.onHit ?? def?.onHit) === 'function') {
    instance.onHit = spawn?.onHit ?? def.onHit;
  }

  if (typeof (spawn?.onExpire ?? def?.onExpire) === 'function') {
    instance.onExpire = spawn?.onExpire ?? def.onExpire;
  }

  if (spawn?.ghost != null) {
    instance.ghost = !!spawn.ghost;
  }

  if (spawn?.elementalState != null) {
    instance.elementalState = String(spawn.elementalState);
  }

  return instance;
}

/**
 * Reset internal id counter (optional, for tests or deterministic ids).
 */
export function resetHitboxIds() {
  _nextId = 0;
}
