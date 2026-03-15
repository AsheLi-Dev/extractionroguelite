/**
 * HazardSubArea: data-driven hazard type definitions and parameters.
 * One hazard type per zone (avalanche, earthquake, swamp, volcano, hurricane).
 * All values are configurable for tuning.
 */

export const HAZARD_TYPES = ['avalanche', 'earthquake', 'swamp', 'volcano', 'hurricane'];

/** Parameters per hazard type. */
export const HAZARD_CONFIG = {
  avalanche: {
    spawnIntervalMin: 2,
    spawnIntervalMax: 4,
    orbSpeed: 180,
    orbRadius: 14,
    stunDuration: 0.2,
    slowDuration: 1,
    slowMult: 0.8,
  },
  earthquake: {
    warningDuration: 0.7,
    eruptionRadius: 48,
    damage: 5,
    slowDuration: 1,
    slowMult: 0.85,
    spawnIntervalMin: 2.5,
    spawnIntervalMax: 4.5,
  },
  swamp: {
    maxStacks: 6,
    slowPerStack: 0.05,
    poisonPerStackPerSecond: 0.5,
    stackGainPerSecond: 2,
    stackDecayPerSecond: 3,
    patchCount: 5,
    patchRadius: 64,
  },
  volcano: {
    spawnIntervalMin: 2,
    spawnIntervalMax: 4,
    fallDuration: 0.9,
    impactRadius: 40,
    damage: 5,
    burnDamagePerSecond: 1,
    burnDuration: 5,
  },
  hurricane: {
    gustIntervalMin: 2,
    gustIntervalMax: 4,
    gustDurationMin: 0.2,
    gustDurationMax: 0.4,
    pushSpeed: 320,
  },
};

export function getHazardConfig(type) {
  return HAZARD_CONFIG[type] || {};
}

/**
 * Pick one hazard type from the pool at random.
 * @param {function(): number} rng
 */
export function pickHazardType(rng = Math.random) {
  const i = Math.floor(rng() * HAZARD_TYPES.length);
  return HAZARD_TYPES[i] || HAZARD_TYPES[0];
}
