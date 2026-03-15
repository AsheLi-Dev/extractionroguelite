/**
 * Elemental Shot evolution: composable profile system.
 * First evolution = category focus (damage→fire, rhythm→lightning, control→wind, elemental→all).
 * Second evolution = overrides merged onto first.
 * Runtime reads only the composed profile; no 16-branch if/else.
 */

export const ELEMENTAL_SHOT_CATEGORIES = ["damage", "rhythm", "control", "elemental"];

/**
 * @typedef {object} ElementalShotProfile
 * @property {{ first: string|null, second: string|null, formId: string }} evolutionState
 * @property {string} formId
 * @property {string} attackMode
 * @property {string} defaultElement
 * @property {{ type: string, elements?: string[], durationSec?: number }} surgeBehavior
 * @property {object} projectileMods
 * @property {object} elementalInteractions
 * @property {object} environment
 * @property {object} links
 */

/**
 * Deep merge source into target. Nested plain objects are merged; arrays and primitives overwrite.
 * @param {object} target
 * @param {object} source
 * @returns {object} target (mutated)
 */
function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    if (srcVal != null && typeof srcVal === "object" && !Array.isArray(srcVal) && Object.getPrototypeOf(srcVal) === Object.prototype) {
      if (target[key] == null || typeof target[key] !== "object") target[key] = {};
      deepMerge(target[key], srcVal);
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

function buildFormId(first, second) {
  if (!first) return "base";
  if (!second) return first;
  return `${first}_${second}`;
}

// --- Base profile (default Elemental Shot) ---

export const BASE_PROFILE = {
  evolutionState: { first: null, second: null, formId: "base" },
  formId: "base",
  attackMode: "projectile",
  defaultElement: "fire",
  surgeChargeRequired: 12,
  surgeBehavior: {
    type: "normal",
    elements: ["wind", "lightning"],
    durationSec: 3
  },
  projectileMods: {
    speedMult: 1,
    chainCount: 0,
    pierceInfinite: false,
    bounceCount: 0,
    explosionRadiusMult: 1,
    explosionDamageMult: 1,
    attackSpeedMult: 1,
    damageMult: 1,
    volleyCount: 1,
    arcCount: 0,
    fireExplosionDamageRatio: 0.2,
    fireExplosionRadiusMult: 1,
    lightningChainCountBase: 2,
    lightningSpeedMult: 1,
    windArcWidthMult: 1
  },
  elementalInteractions: {
    burnApply: false,
    burnAmplify: false,
    burnDetonate: false,
    burnConsumedOnDetonate: true,
    burnDamageMult: 1,
    burnStackLimit: 1,
    stunChance: 0,
    bleedChance: 0,
    simultaneousElements: false
  },
  environment: {
    spawnStorm: false,
    spawnSwirl: false,
    stormSlow: false,
    swirlFirestorm: false,
    swirlLightningSplit: false
  },
  links: {
    fireExplosionOnWindHit: false,
    windBuffsAttackSpeed: false,
    windBuffsMoveSpeed: false,
    lightningFeedsCharge: false,
    windKnockbackForce: 0,
    windPullToCenter: false,
    surgeStartFireExplosion: false,
    surgeStartWindPush: false,
    surgeStartLightningStrike: false
  }
};

// --- First evolution (category → element focus) ---
// damage → Inferno Core, rhythm → Storm Engine, control → Tempest Arc, elemental → Prismatic Cycle

const FIRST_EVOLUTION = {
  damage: {
    formId: "inferno_core",
    defaultElement: "fire",
    attackMode: "projectile",
    surgeBehavior: { type: "normal", elements: ["wind", "lightning"], durationSec: 3 },
    projectileMods: {
      fireExplosionDamageRatio: 0.6,
      fireExplosionRadiusMult: 1.33
    },
    elementalInteractions: {
      burnDamageMult: 2,
      burnStackLimit: 3
    },
    environment: {},
    links: {}
  },
  rhythm: {
    formId: "storm_engine",
    defaultElement: "fire",
    attackMode: "projectile",
    surgeBehavior: { type: "normal", elements: ["wind", "lightning"], durationSec: 3 },
    projectileMods: {
      lightningChainCountBase: 4,
      lightningSpeedMult: 2
    },
    elementalInteractions: {},
    environment: {},
    links: { lightningFeedsCharge: true }
  },
  control: {
    formId: "tempest_arc",
    defaultElement: "fire",
    attackMode: "projectile",
    surgeBehavior: { type: "normal", elements: ["wind", "lightning"], durationSec: 3 },
    projectileMods: {
      windArcWidthMult: 1.5
    },
    elementalInteractions: {},
    environment: {},
    links: {
      windKnockbackForce: 150,
      windPullToCenter: true
    }
  },
  elemental: {
    formId: "prismatic_cycle",
    defaultElement: "fire",
    attackMode: "projectile",
    surgeChargeRequired: 8,
    surgeBehavior: { type: "normal", elements: ["wind", "lightning", "fire"], durationSec: 4.5 },
    projectileMods: {},
    elementalInteractions: { burnConsumedOnDetonate: false },
    environment: {},
    links: {
      surgeStartFireExplosion: true,
      surgeStartWindPush: true,
      surgeStartLightningStrike: true
    }
  }
};

// --- Second evolution overrides (16 combinations) ---

const SECOND_EVOLUTION_OVERRIDES = {
  // DAMAGE FIRST (Fire)
  damage_damage: {
    formId: "meteorfall",
    attackMode: "meteor",
    defaultElement: "fire",
    projectileMods: { damageMult: 1, explosionRadiusMult: 1, explosionDamageMult: 1 }
  },
  damage_rhythm: {
    formId: "blazing_barrage",
    defaultElement: "fire",
    projectileMods: { attackSpeedMult: 1 }
  },
  damage_control: {
    formId: "wildfire",
    defaultElement: "fire",
    projectileMods: { explosionRadiusMult: 1 }
  },
  damage_elemental: {
    formId: "primal_inferno",
    defaultElement: "fire",
    links: {}
  },

  // RHYTHM FIRST (Lightning)
  rhythm_damage: {
    formId: "thunder_forge",
    defaultElement: "lightning",
    surgeBehavior: { type: "normal", elements: ["fire", "wind"], durationSec: 3 },
    elementalInteractions: { burnApply: false },
    links: {}
  },
  rhythm_rhythm: {
    formId: "storm_machine",
    defaultElement: "lightning",
    surgeBehavior: { type: "normal", elements: ["fire", "wind"], durationSec: 3 },
    projectileMods: { attackSpeedMult: 1 }
  },
  rhythm_control: {
    formId: "storm_circle",
    defaultElement: "fire",
    environment: { spawnStorm: true, stormSlow: true },
    elementalInteractions: { burnDetonate: true, burnConsumedOnDetonate: true }
  },
  rhythm_elemental: {
    formId: "overcharged_core",
    defaultElement: "lightning",
    surgeBehavior: { type: "modifier", elements: ["wind", "lightning", "fire"], durationSec: 3 },
    links: { windBuffsAttackSpeed: true }
  },

  // CONTROL FIRST
  control_damage: {
    formId: "firestorm",
    defaultElement: "fire",
    surgeBehavior: { type: "normal", elements: ["fire", "lightning"], durationSec: 3 },
    links: {}
  },
  control_rhythm: {
    formId: "thunder_gale",
    defaultElement: "fire",
    surgeBehavior: { type: "normal", elements: ["fire", "wind"], durationSec: 3 },
    elementalInteractions: { stunChance: 1 },
    links: { fireExplosionOnWindHit: true }
  },
  control_control: {
    formId: "razor_tempest",
    attackMode: "volley",
    defaultElement: "fire",
    projectileMods: {
      razorTempestVolley: true,
      razorVolleySpeedMult: 2,
      razorVolleySpreadDeg: 20,
      razorVolleyCountPerWave: 3,
      razorVolleyDelaySec: 0.1
    }
  },
  control_elemental: {
    formId: "elemental_cyclone",
    defaultElement: "wind",
    surgeBehavior: { type: "normal", elements: ["fire", "lightning"], durationSec: 3 },
    environment: { spawnSwirl: true, swirlFirestorm: true, swirlLightningSplit: true }
  },

  // ELEMENTAL FIRST (All)
  elemental_damage: {
    formId: "solar_flare",
    defaultElement: "fire",
    projectileMods: {}
  },
  elemental_rhythm: {
    formId: "storm_prism",
    defaultElement: "lightning",
    surgeBehavior: { type: "normal", elements: ["fire", "wind"], durationSec: 3 },
    projectileMods: {}
  },
  elemental_control: {
    formId: "prismatic_gale",
    defaultElement: "fire",
    surgeBehavior: { type: "normal", elements: ["fire", "lightning"], durationSec: 3 },
    projectileMods: {}
  },
  elemental_elemental: {
    formId: "prismatic_surge",
    surgeBehavior: { type: "multi", elements: ["wind", "lightning", "fire"], durationSec: 3 },
    elementalInteractions: { simultaneousElements: true }
  }
};

/**
 * Get evolution state from game or plain state.
 * @param {object} gameOrState - Game with elementalShotEvolutionFirst/Second, or { first, second }
 * @returns {{ first: string|null, second: string|null, formId: string }}
 */
export function getElementalShotEvolutionState(gameOrState) {
  const first = gameOrState?.elementalShotEvolutionFirst ?? gameOrState?.first ?? null;
  const second = gameOrState?.elementalShotEvolutionSecond ?? gameOrState?.second ?? null;
  const formId = buildFormId(first, second);
  return { first, second, formId };
}

/** Alias for getElementalShotEvolutionState (resolved evolution state for runtime). */
export function getElementalShotResolvedEvolutionState(gameOrState) {
  return getElementalShotEvolutionState(gameOrState);
}

/**
 * Get composed Elemental Shot profile for the given evolution state.
 * Uses deep merge: BASE_PROFILE ← first evolution ← second override.
 * @param {{ first: string|null, second: string|null, formId?: string }} state
 * @returns {import('./elemental-shot-evolution.js').ElementalShotProfile}
 */
export function getElementalShotProfile(state) {
  const formId = state?.formId ?? buildFormId(state?.first, state?.second);
  const evolutionState = {
    first: state?.first ?? null,
    second: state?.second ?? null,
    formId
  };

  const base = JSON.parse(JSON.stringify(BASE_PROFILE));
  base.evolutionState = evolutionState;

  if (!state?.first) {
    return base;
  }

  const firstData = FIRST_EVOLUTION[state.first];
  if (!firstData) return base;

  deepMerge(base, firstData);

  if (state.second) {
    const override = SECOND_EVOLUTION_OVERRIDES[formId];
    if (override) {
      deepMerge(base, override);
    }
  }

  return base;
}

/**
 * Debug: return a readable subset of profile for playtesting/overlay.
 * @param {object} gameOrState - Game or { first, second }
 * @returns {object}
 */
export function getElementalShotEvolutionDebugInfo(gameOrState) {
  const state = getElementalShotEvolutionState(gameOrState);
  const profile = getElementalShotProfile(state);
  const pm = profile.projectileMods || {};
  const ei = profile.elementalInteractions || {};
  return {
    first: state.first,
    second: state.second,
    formId: profile.formId,
    firstEvolutionFormId: state.first ? (profile.formId || state.first) : null,
    attackMode: profile.attackMode,
    defaultElement: profile.defaultElement,
    surgeBehavior: profile.surgeBehavior,
    surgeDurationSec: profile.surgeBehavior?.durationSec ?? 3,
    burnStackLimit: ei.burnStackLimit ?? 1,
    lightningChainCountBase: pm.lightningChainCountBase ?? 2,
    windArcWidthMult: pm.windArcWidthMult ?? 1,
    projectileMods: profile.projectileMods,
    elementalInteractions: profile.elementalInteractions,
    environment: profile.environment,
    links: profile.links
  };
}
