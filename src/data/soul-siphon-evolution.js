/**
 * Soul Siphon evolution: composable behavior modules.
 * Profile has five modules: beam mode, beam modifiers, spirit pool, spirit trigger, cross-system links.
 * Evolution state (first/second) is resolved once; runtime reads only the composed profile.
 */

export const SOUL_SIPHON_CATEGORIES = ["power", "tempo", "control", "spiritcraft"];

export const SOUL_SIPHON_FIRST_EVOLUTION_NAMES = {
  power: "Reaper Form",
  tempo: "Wind Form",
  control: "Earth Form",
  spiritcraft: "Ancestral Form"
};

export const SOUL_SIPHON_FIRST_EVOLUTION_DESCRIPTIONS = {
  power: "Heavy delayed beam shots with stronger damage and a fireball-focused spirit.",
  tempo: "A thinner, faster beam with speed-focused spirit support.",
  control: "Cursor-area control pulses backed by a ground-slam spirit.",
  spiritcraft: "A spirit-forward form with faster charging and access to all spirit abilities."
};

export const SOUL_SIPHON_SECOND_EVOLUTION_NAMES = {
  power: "Power Path",
  tempo: "Tempo Path",
  control: "Control Path",
  spiritcraft: "Spiritcraft Path"
};

export const SOUL_SIPHON_SECOND_EVOLUTION_DESCRIPTIONS = {
  power: "Push Soul Siphon further into raw beam damage and finishing power.",
  tempo: "Lean into attack cadence, chaining, and faster spirit triggers.",
  control: "Strengthen crowd control, debuffs, and field effects.",
  spiritcraft: "Double down on spirit commands, support, and companion synergy."
};

/** Spirit pool id → list of ability ids for runtime (fireball, ground_slam, speed_buff). */
const SPIRIT_POOL_TO_ABILITIES = {
  fireball_only: ["fireball"],
  speed_only: ["speed_buff"],
  slam_only: ["ground_slam"],
  all_three: ["fireball", "ground_slam", "speed_buff"],
  fireball_and_slam: ["fireball", "ground_slam"]
};

/**
 * Return the list of spirit ability ids for the given spiritPool.
 * @param {string} spiritPool - One of fireball_only, speed_only, slam_only, all_three, fireball_and_slam
 * @returns {string[]}
 */
export function getSpiritAbilityListFromPool(spiritPool) {
  if (!spiritPool || !SPIRIT_POOL_TO_ABILITIES[spiritPool]) {
    return ["fireball", "ground_slam", "speed_buff"];
  }
  return [...SPIRIT_POOL_TO_ABILITIES[spiritPool]];
}

export function getSoulSiphonFirstEvolutionOptions() {
  return SOUL_SIPHON_CATEGORIES.map((category) => ({
    stage: "first",
    category,
    name: SOUL_SIPHON_FIRST_EVOLUTION_NAMES[category] || category,
    description: SOUL_SIPHON_FIRST_EVOLUTION_DESCRIPTIONS[category] || ""
  }));
}

export function getSoulSiphonSecondEvolutionOptions(firstCategory) {
  return SOUL_SIPHON_CATEGORIES
    .filter((category) => category && category !== firstCategory)
    .map((category) => ({
      stage: "second",
      category,
      name: SOUL_SIPHON_SECOND_EVOLUTION_NAMES[category] || category,
      description: SOUL_SIPHON_SECOND_EVOLUTION_DESCRIPTIONS[category] || ""
    }));
}

/**
 * Resolve first and second dominant categories from Soul Siphon upgrade category counts.
 * Only considers power, tempo, control, spiritcraft.
 * Returns [first, second] where second may be null if only one category has picks.
 */
export function resolveSoulSiphonDominantCategories(categoryCounts) {
  const counts = [];
  for (const cat of SOUL_SIPHON_CATEGORIES) {
    const n = Math.max(0, Math.floor(Number(categoryCounts?.[cat]) || 0));
    counts.push({ category: cat, count: n });
  }
  counts.sort((a, b) => b.count - a.count);
  const first = counts[0]?.count > 0 ? counts[0].category : null;
  const second = counts[1]?.count > 0 ? counts[1].category : null;
  return [first, first === second ? null : second];
}

/**
 * Get current Soul Siphon evolution state from game.
 * @param {object} game - Game instance with soulSiphonEvolutionFirst, soulSiphonEvolutionSecond
 * @returns {{ first: string|null, second: string|null, formId: string }}
 */
export function getSoulSiphonEvolutionState(game) {
  const first = game.soulSiphonEvolutionFirst ?? null;
  const second = game.soulSiphonEvolutionSecond ?? null;
  const formId = buildFormId(first, second);
  return { first, second, formId };
}

function buildFormId(first, second) {
  if (!first) return "base";
  if (!second) return first;
  return `${first}_${second}`;
}

// --- First evolution: beam mode + beamMods + spiritPool + spiritTrigger + links ---

const FIRST_EVOLUTION = {
  power: {
    formId: "reaper",
    beamMode: "delayed_shot",
    beamMods: {
      damageMult: 1.8,
      attackSpeedMult: 0.4,
      windupSec: 0.25,
      coverageMult: 1
    },
    spiritPool: "fireball_only",
    spiritTrigger: { mode: "normal_random" },
    links: {}
  },
  tempo: {
    formId: "wind",
    beamMode: "channel",
    beamMods: {
      thinnerBeam: true,
      widthMult: 0.75,
      fasterProcRate: 1.5,
      coverageMult: 1
    },
    spiritPool: "speed_only",
    spiritTrigger: { mode: "normal_random" },
    links: {}
  },
  control: {
    formId: "earth",
    beamMode: "cursor_area",
    beamMods: {
      origin: "cursor",
      tickWhileActive: true,
      coverageMult: 1
    },
    spiritPool: "slam_only",
    spiritTrigger: { mode: "normal_random" },
    links: {}
  },
  spiritcraft: {
    formId: "ancestral",
    beamMode: "channel",
    beamMods: {
      spiritChargeMultiplier: 2,
      coverageMult: 1
    },
    spiritPool: "all_three",
    spiritTrigger: { mode: "normal_random" },
    links: {}
  }
};

// --- Second evolution: overrides only (merged into first) ---

const SECOND_EVOLUTION_OVERRIDES = {
  power_power: {
    formId: "expanding_reaper",
    beamMods: { widerCoverage: true, edgeFalloff: true, windupSec: 0.4, baseDamageMult: 1.2 }
  },
  power_tempo: {
    formId: "triple_reaper",
    beamMods: { tripleBeam: true, pulseDamageMult: 0.4, pulseIntervalSec: 0.08 }
  },
  power_control: {
    formId: "stunning_reaper",
    beamMods: { beamStun: true, stunSec: 0.2, widerCoverage: true, coverageMult: 1.3 }
  },
  power_spiritcraft: {
    formId: "reaper_servitor",
    spiritTrigger: { mode: "auto_fireball_on_attack" },
    links: { autoSpiritSupportOnAttack: true }
  },
  tempo_power: {
    formId: "burning_thread",
    beamMods: { channelDelaySec: 0.15, damageMult: 1.25 }
  },
  tempo_tempo: {
    formId: "accelerating_thread",
    beamMods: { acceleratingProcRate: true, rampStartMult: 0.5, rampMaxMult: 2, rampSec: 3 }
  },
  tempo_control: {
    formId: "freezing_thread",
    beamMods: { freezeBuildUp: true }
  },
  tempo_spiritcraft: {
    formId: "rally_thread",
    spiritTrigger: { mode: "stacking_speed_buff", maxStacks: 3 }
  },
  control_power: {
    formId: "execution_field",
    beamMods: { firstPulseMassive: true, firstTickDamageMult: 5, areaDelaySec: 0.2 }
  },
  control_tempo: {
    formId: "haste_field",
    links: { fieldHaste: true }
  },
  control_control: {
    formId: "oppression_field",
    links: { fieldDebuff: true }
  },
  control_spiritcraft: {
    formId: "resonant_field",
    links: { beamAreaScalesSpiritSlam: true }
  },
  spiritcraft_power: {
    formId: "war_spirit",
    spiritPool: "fireball_and_slam",
    spiritTrigger: { mode: "normal_random" },
    links: { fireballExplodes: true, slamDoubleSingleTarget: true }
  },
  spiritcraft_tempo: {
    formId: "overclocked_spirit",
    spiritTrigger: { mode: "cast_all_three", chargeThreshold: 2 }
  },
  spiritcraft_control: {
    formId: "marked_prey",
    links: { beamMarksForSpiritDouble: true }
  },
  spiritcraft_spiritcraft: {
    formId: "avatar_of_souls",
    beamMode: "avatar_command",
    spiritTrigger: { mode: "avatar_random_command" },
    links: {}
  }
};

const DEFAULT_PROFILE = {
  evolutionState: { first: null, second: null, formId: "base" },
  formId: "base",
  beamMode: "channel",
  beamMods: { coverageMult: 1 },
  spiritPool: "all_three",
  spiritTrigger: { mode: "normal_random" },
  links: {}
};

/**
 * Get composed Soul Siphon profile for the given evolution state.
 * Runtime should read only: beamMode, beamMods, spiritPool, spiritTrigger, links.
 * @param {{ first: string|null, second: string|null, formId: string }} state
 * @returns {{
 *   evolutionState: { first: string|null, second: string|null, formId: string },
 *   formId: string,
 *   beamMode: string,
 *   beamMods: object,
 *   spiritPool: string,
 *   spiritTrigger: { mode: string, [key: string]: any },
 *   links: object
 * }}
 */
export function getSoulSiphonProfile(state) {
  if (!state?.first) {
    return defaultProfileWithState(state);
  }

  const first = FIRST_EVOLUTION[state.first];
  if (!first) return { ...DEFAULT_PROFILE, evolutionState: state };

  const evolutionState = { first: state.first, second: state.second, formId: state.formId };
  const profile = {
    formId: first.formId,
    beamMode: first.beamMode,
    beamMods: { ...first.beamMods },
    spiritPool: first.spiritPool,
    spiritTrigger: { ...first.spiritTrigger },
    links: { ...first.links }
  };

  if (state.second) {
    const override = SECOND_EVOLUTION_OVERRIDES[state.formId];
    if (override) {
      if (override.formId != null) profile.formId = override.formId;
      if (override.beamMode != null) profile.beamMode = override.beamMode;
      if (override.beamMods) Object.assign(profile.beamMods, override.beamMods);
      if (override.spiritPool != null) profile.spiritPool = override.spiritPool;
      if (override.spiritTrigger) Object.assign(profile.spiritTrigger, override.spiritTrigger);
      if (override.links) Object.assign(profile.links, override.links);
    }
  }

  return { evolutionState, ...profile };
}

function defaultProfileWithState(state) {
  const s = state || { first: null, second: null, formId: "base" };
  return {
    ...DEFAULT_PROFILE,
    evolutionState: { first: s.first, second: s.second, formId: s.formId }
  };
}

/**
 * Debug: return profile in a readable shape for playtesting.
 */
export function getSoulSiphonEvolutionDebugInfo(game) {
  const state = getSoulSiphonEvolutionState(game);
  const profile = getSoulSiphonProfile(state);
  return {
    first: state.first,
    second: state.second,
    formId: state.formId,
    beamMode: profile.beamMode,
    beamMods: profile.beamMods,
    spiritPool: profile.spiritPool,
    spiritTrigger: profile.spiritTrigger,
    links: profile.links,
    secondEvolutionId: profile.formId
  };
}
