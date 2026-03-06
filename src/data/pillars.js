/**
 * @file Pillar and blessing data definitions.
 */

/**
 * @typedef {1 | 2} BlessingTier
 */

/**
 * @typedef {Object} Blessing
 * @property {string} id
 * @property {string} pillarId
 * @property {string} displayName
 * @property {string} description
 * @property {BlessingTier} tier
 * @property {boolean} unlockedByDefault
 * @property {boolean} available
 * @property {string[]} tags
 * @property {string} [metadata]
 * @property {string} [effectKey]
 */

/**
 * @typedef {Object} Pillar
 * @property {string} id
 * @property {string} displayName
 * @property {string} description
 * @property {string} iconKey
 * @property {Blessing[]} blessingsLevel1
 * @property {Blessing[]} blessingsLevel2
 */

/**
 * @typedef {Object} Proof
 * @property {string} id
 * @property {string} displayName
 * @property {string} description
 * @property {number} trialSuccessAtLeast
 * @property {{ level1: number, level2: number }} grants
 */

export const BLESSING_TIER = {
  LEVEL_1: 1,
  LEVEL_2: 2
};

export const PILLAR_TRIAL_ENTRY_ITEM_ID = 'meta.pillar_trial_entry_item';

/** Base proof progression used by the first pillar-system milestones. */
export const PROOF_SEQUENCE = Object.freeze([
  {
    id: 'proof_courage',
    displayName: 'Proof of Courage',
    description: 'The first pillar trial clear grants the courage to begin shaping blessings.',
    trialSuccessAtLeast: 1,
    grants: { level1: 1, level2: 0 }
  },
  {
    id: 'proof_strength',
    displayName: 'Proof of Strength',
    description: 'A second success unlocks more room for foundational blessings.',
    trialSuccessAtLeast: 2,
    grants: { level1: 1, level2: 0 }
  },
  {
    id: 'proof_resilience',
    displayName: 'Proof of Resilience',
    description: 'A third clear opens the first advanced blessing slot.',
    trialSuccessAtLeast: 3,
    grants: { level1: 0, level2: 1 }
  },
  {
    id: 'proof_dominance',
    displayName: 'Proof of Dominance',
    description: 'A fourth clear grants an additional advanced blessing slot.',
    trialSuccessAtLeast: 4,
    grants: { level1: 0, level2: 1 }
  }
]);

export const PROOF_BY_ID = PROOF_SEQUENCE.reduce((acc, proof) => {
  acc[proof.id] = proof;
  return acc;
}, /** @type {Record<string, Proof>} */ ({}));

/** List of all seeded pillars and their blessing definitions. */
export const PILLARS = Object.freeze([
  {
    id: 'the_deep',
    displayName: 'The Deep',
    description: 'Secrets hidden below the noise and pressure.',
    iconKey: 'pillar.deep',
    blessingsLevel1: [
      {
        id: 'the_deep_forge_resolve',
        pillarId: 'the_deep',
        displayName: 'Quiet Hands',
        description: 'If you have not dealt damage in the last 6 seconds, chest opening speed is increased by 50%.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['core'],
        effectKey: 'pillar.deep.quiet_hands'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_deep_ancient_pressure',
        pillarId: 'the_deep',
        displayName: 'Tentacles of the Deep',
        description: 'Reserved for a future special combat effect. Runtime hook is not implemented yet.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['core'],
        effectKey: 'pillar.deep.tentacles'
      }
    ]
  },
  {
    id: 'the_havoc',
    displayName: 'The Havoc',
    description: 'Rage and momentum rewritten into order.',
    iconKey: 'pillar.havoc',
    blessingsLevel1: [
      {
        id: 'the_havoc_unchecked_stride',
        pillarId: 'the_havoc',
        displayName: 'Ruin Runner',
        description: 'Reserved for a future movement/combat interaction. Runtime hook is not implemented yet.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['aggressive'],
        effectKey: 'pillar.havoc.ruin_runner'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_havoc_fearless_chain',
        pillarId: 'the_havoc',
        displayName: 'Momentum of Ruin',
        description: 'Destroying an object grants a temporary move speed and attack speed boost.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['aggressive'],
        effectKey: 'pillar.havoc.momentum_of_ruin'
      }
    ]
  },
  {
    id: 'weapon_master',
    displayName: 'Weapon Master',
    description: 'Every hit, an older lesson remembered.',
    iconKey: 'pillar.weapon_master',
    blessingsLevel1: [
      {
        id: 'weapon_master_steady_hand',
        pillarId: 'weapon_master',
        displayName: 'Perfect Craft',
        description: 'Weapon items grant 25% increased stats.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['combat'],
        effectKey: 'pillar.weapon_master.perfect_craft'
      }
    ],
    blessingsLevel2: [
      {
        id: 'weapon_master_fatal_recall',
        pillarId: 'weapon_master',
        displayName: 'Perfect Hybridization',
        description: 'Reserved for future melee/ranged reinterpretation logic.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['combat'],
        effectKey: 'pillar.weapon_master.perfect_hybridization'
      }
    ]
  },
  {
    id: 'the_limitless',
    displayName: 'The Limitless',
    description: 'Potential beyond your current frame.',
    iconKey: 'pillar.limitless',
    blessingsLevel1: [
      {
        id: 'the_limitless_wide_scope',
        pillarId: 'the_limitless',
        displayName: 'Endless Possibilities',
        description: 'Gain 3 rerolls whenever level-up choices are shown.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['utility'],
        effectKey: 'pillar.limitless.endless_possibilities'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_limitless_unbound_thought',
        pillarId: 'the_limitless',
        displayName: 'No Limits',
        description: 'Reserved for future cap/stack override behavior.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['utility'],
        effectKey: 'pillar.limitless.no_limits'
      }
    ]
  },
  {
    id: 'the_void',
    displayName: 'The Void',
    description: 'Emptiness as a resource.',
    iconKey: 'pillar.void',
    blessingsLevel1: [
      {
        id: 'the_void_cold_step',
        pillarId: 'the_void',
        displayName: 'Cold Step',
        description: 'Reserved for future void movement behavior.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['defensive'],
        effectKey: 'pillar.void.cold_step'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_void_event_horizon',
        pillarId: 'the_void',
        displayName: 'Event Horizon',
        description: 'Reserved for future void combat behavior.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['defensive'],
        effectKey: 'pillar.void.event_horizon'
      }
    ]
  },
  {
    id: 'the_pacifier',
    displayName: 'The Pacifier',
    description: 'The calm that arrives before the true cost.',
    iconKey: 'pillar.pacifier',
    blessingsLevel1: [
      {
        id: 'the_pacifier_somber_heart',
        pillarId: 'the_pacifier',
        displayName: 'Somber Heart',
        description: 'Reserved for future rules/control interaction.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['control'],
        effectKey: 'pillar.pacifier.somber_heart'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_pacifier_woven_gentle',
        pillarId: 'the_pacifier',
        displayName: 'Woven Gentle',
        description: 'Reserved for future advanced pacifier behavior.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['control'],
        effectKey: 'pillar.pacifier.woven_gentle'
      }
    ]
  },
  {
    id: 'the_collector',
    displayName: 'The Collector',
    description: 'A careful curator of broken things.',
    iconKey: 'pillar.collector',
    blessingsLevel1: [
      {
        id: 'the_collector_precise_memoir',
        pillarId: 'the_collector',
        displayName: 'Merchant Instinct',
        description: 'You can sell equippable inventory items at any time. Equipment Collector quotes are doubled.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'growth'],
        effectKey: 'pillar.collector.merchant_instinct'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_collector_endless_archive',
        pillarId: 'the_collector',
        displayName: 'Grand Bazaar',
        description: 'Reserved for future NPC economy expansion.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'growth'],
        effectKey: 'pillar.collector.grand_bazaar'
      }
    ]
  },
  {
    id: 'the_cascade',
    displayName: 'The Cascade',
    description: 'Momentum, repeated and refined.',
    iconKey: 'pillar.cascade',
    blessingsLevel1: [
      {
        id: 'the_cascade_looping_draw',
        pillarId: 'the_cascade',
        displayName: 'Looping Draw',
        description: 'Reserved for future skill-chain runtime behavior.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['resource'],
        effectKey: 'pillar.cascade.looping_draw'
      }
    ],
    blessingsLevel2: [
      {
        id: 'the_cascade_requiem_drop',
        pillarId: 'the_cascade',
        displayName: 'Requiem Drop',
        description: 'Reserved for future cascade conversion behavior.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['resource'],
        effectKey: 'pillar.cascade.requiem_drop'
      }
    ]
  }
]);

export const PILLAR_BY_ID = Object.freeze(
  PILLARS.reduce((acc, pillar) => {
    acc[pillar.id] = pillar;
    return acc;
  }, /** @type {Record<string, Pillar>} */ ({}))
);

export const ALL_BLESSINGS = Object.freeze(
  PILLARS.flatMap((pillar) => [...pillar.blessingsLevel1, ...pillar.blessingsLevel2])
);

export const BLESSING_BY_ID = Object.freeze(
  ALL_BLESSINGS.reduce((acc, blessing) => {
    acc[blessing.id] = blessing;
    return acc;
  }, /** @type {Record<string, Blessing>} */ ({}))
);

/** @returns {Pillar | undefined} */
export function getPillarById(id) {
  return PILLAR_BY_ID[id];
}

/** @returns {Blessing | undefined} */
export function getBlessingById(id) {
  return BLESSING_BY_ID[id];
}

export function getAllPillars() {
  return PILLARS;
}

export function getAllBlessings() {
  return ALL_BLESSINGS;
}

/**
 * @param {number} completionCount
 * @returns {Proof | null}
 */
export function getProofForCompletion(completionCount) {
  return PROOF_SEQUENCE[completionCount] || null;
}
