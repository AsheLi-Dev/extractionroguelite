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
        id: 'pillar.deep.two_heads',
        pillarId: 'the_deep',
        displayName: 'Two Heads',
        description: 'Gain an additional helmet slot. Both equipped helmets are active and grant their normal effects.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['core'],
        effectKey: 'pillar.deep.two_heads'
      },
      {
        id: 'pillar.deep.polluting_presence',
        pillarId: 'the_deep',
        displayName: 'Polluting Presence',
        description: 'Lose 5% max HP per second and deal the same amount as damage per second to nearby enemies.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['core'],
        effectKey: 'pillar.deep.polluting_presence'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.deep.tentacles',
        pillarId: 'the_deep',
        displayName: 'Tentacles',
        description: 'Ring slots are disabled. Every 20 seconds, gain 2 random portable enemy modifiers for 20 seconds.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['core', 'chaos'],
        effectKey: 'pillar.deep.tentacles'
      },
      {
        id: 'pillar.deep.twisted_belief',
        pillarId: 'the_deep',
        displayName: 'Twisted Belief',
        description: 'Gain Proof of Eldritch: +3 Level 1 capacity, same-pillar duplicates allowed, and further Level 2 allocation is blocked.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['core', 'topology'],
        effectKey: 'pillar.deep.twisted_belief'
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
        id: 'pillar.havoc.chain_detonation',
        pillarId: 'the_havoc',
        displayName: 'Chain Detonation',
        description: 'Destroyed enemies and breakables explode, dealing 20% of the destroyed target max HP as damage.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['aggressive'],
        effectKey: 'pillar.havoc.chain_detonation'
      },
      {
        id: 'pillar.havoc.momentum_of_ruin',
        pillarId: 'the_havoc',
        displayName: 'Momentum of Ruin',
        description: 'Destroying an object grants a temporary move speed and attack speed boost.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['aggressive'],
        effectKey: 'pillar.havoc.momentum_of_ruin'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.havoc.unmake_the_world',
        pillarId: 'the_havoc',
        displayName: 'Unmake the World',
        description: 'Supported world objects become destructible with hidden HP, except protected critical objects.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['aggressive', 'world'],
        effectKey: 'pillar.havoc.unmake_the_world'
      },
      {
        id: 'pillar.havoc.fury_of_havoc',
        pillarId: 'the_havoc',
        displayName: 'Fury of Havoc',
        description: 'Destroying an object costs 5% max HP and grants 1 Fury. At 10 Fury, destroy all safely destructible objects currently on screen, then reset Fury.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['aggressive', 'chaos'],
        effectKey: 'pillar.havoc.fury_of_havoc'
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
        id: 'pillar.weapon_master.perfect_craft',
        pillarId: 'weapon_master',
        displayName: 'Perfect Craft',
        description: 'Weapon items grant 25% increased stats.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['combat'],
        effectKey: 'pillar.weapon_master.perfect_craft'
      },
      {
        id: 'pillar.weapon_master.dual_technique',
        pillarId: 'weapon_master',
        displayName: 'Dual Technique',
        description: 'Equip two basic attacks and execute both from one input. Basic-attack damage is scaled to 40%.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['combat'],
        effectKey: 'pillar.weapon_master.dual_technique'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.weapon_master.living_arsenal',
        pillarId: 'weapon_master',
        displayName: 'Living Arsenal',
        description: 'All equipment slots become weapon-compatible. With 4+ equipped weapons, attacks repeat 4 times at 25% damage each.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['combat', 'equipment'],
        effectKey: 'pillar.weapon_master.living_arsenal'
      },
      {
        id: 'pillar.weapon_master.perfect_hybridization',
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
        id: 'pillar.limitless.endless_possibilities',
        pillarId: 'the_limitless',
        displayName: 'Endless Possibilities',
        description: 'Gain 3 rerolls whenever level-up choices are shown.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['utility'],
        effectKey: 'pillar.limitless.endless_possibilities'
      },
      {
        id: 'pillar.limitless.exponential_growth',
        pillarId: 'the_limitless',
        displayName: 'Exponential Growth',
        description: 'Whenever you gain stacks of a buff/debuff, gain 2x stacks instead.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['utility'],
        effectKey: 'pillar.limitless.exponential_growth'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.limitless.no_limits',
        pillarId: 'the_limitless',
        displayName: 'No Limits',
        description: 'Player buffs and debuffs ignore normal stack caps (effective cap: 999).',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'stacking'],
        effectKey: 'pillar.limitless.no_limits'
      },
      {
        id: 'pillar.limitless.ascended_growth',
        pillarId: 'the_limitless',
        displayName: 'Ascended Growth',
        description: 'On level up, choose 3 upgrade picks. Pick effectiveness scales by order: 80%, 50%, then 30%.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'growth'],
        effectKey: 'pillar.limitless.ascended_growth'
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
        id: 'pillar.void.void_discrimination',
        pillarId: 'the_void',
        displayName: 'Void Discrimination',
        description: 'Receive only 50% damage from non-minion enemies. Deal 20% damage to minions.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['defensive', 'control'],
        effectKey: 'pillar.void.void_discrimination'
      },
      {
        id: 'pillar.void.untouchable_dash',
        pillarId: 'the_void',
        displayName: 'Untouchable Dash',
        description: 'While dashing, avoid all damage and non-boss enemies stop chasing you.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['defensive', 'mobility'],
        effectKey: 'pillar.void.untouchable_dash'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.void.skill_singularity',
        pillarId: 'the_void',
        displayName: 'Skill Singularity',
        description: 'Basic attacks are disabled. All skills gain +2 charges.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['defensive'],
        effectKey: 'pillar.void.skill_singularity'
      },
      {
        id: 'pillar.void.void_walker',
        pillarId: 'the_void',
        displayName: 'Void Walker',
        description: 'Dash has infinite charges. Max HP is reduced by 50%. Lose 5 HP when you dash.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['defensive'],
        effectKey: 'pillar.void.void_walker'
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
        id: 'pillar.pacifier.gentle_presence',
        pillarId: 'the_pacifier',
        displayName: 'Gentle Presence',
        description: 'Minions and elites ignore you until you damage them (bosses excluded).',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['control'],
        effectKey: 'pillar.pacifier.gentle_presence'
      },
      {
        id: 'pillar.pacifier.quiet_hands',
        pillarId: 'the_pacifier',
        displayName: 'Quiet Hands',
        description: 'If you have not dealt damage in the last 6 seconds, chest opening speed is increased by 50%.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['control'],
        effectKey: 'pillar.pacifier.quiet_hands'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.pacifier.false_peace',
        pillarId: 'the_pacifier',
        displayName: 'False Peace',
        description: 'If you have not dealt damage for 6 seconds, refresh all skill cooldowns. Your next damage dealt gains +1000%.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['control'],
        effectKey: 'pillar.pacifier.false_peace'
      },
      {
        id: 'pillar.pacifier.harmony_of_stillness',
        pillarId: 'the_pacifier',
        displayName: 'Harmony of Stillness',
        description: 'After 6s without dealing damage, gain move speed/defense/max HP scaling and gain 10 XP when opening chests.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['control', 'growth'],
        effectKey: 'pillar.pacifier.harmony_of_stillness'
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
        id: 'pillar.collector.merchant_instinct',
        pillarId: 'the_collector',
        displayName: 'Merchant Instinct',
        description: 'You can sell equippable inventory items at any time. Equipment Collector quotes are doubled.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'growth'],
        effectKey: 'pillar.collector.merchant_instinct'
      },
      {
        id: 'pillar.collector.hoarders_arsenal',
        pillarId: 'the_collector',
        displayName: 'Hoarder\u2019s Arsenal',
        description: 'Inventory item categories grant chest speed, movement speed, breakable damage, and passive gold income bonuses.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'growth'],
        effectKey: 'pillar.collector.hoarders_arsenal'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.collector.ring_vault',
        pillarId: 'the_collector',
        displayName: 'Ring Vault',
        description: 'Gain up to 10 ring slots. Ring effects are -90% plus +10% per ring in inventory (equipped rings excluded), up to +100%.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'equipment'],
        effectKey: 'pillar.collector.ring_vault'
      },
      {
        id: 'pillar.collector.grand_bazaar',
        pillarId: 'the_collector',
        displayName: 'Grand Bazaar',
        description: 'NPC map spawn cap increases up to 15 and NPC service costs are doubled.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['utility', 'economy'],
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
        id: 'pillar.cascade.amplified_triggers',
        pillarId: 'the_cascade',
        displayName: 'Amplified Triggers',
        description: 'Trigger chance is increased by 50%.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['resource'],
        effectKey: 'pillar.cascade.amplified_triggers'
      },
      {
        id: 'pillar.cascade.chain_reaction',
        pillarId: 'the_cascade',
        displayName: 'Chain Reaction',
        description: 'Triggered casts can chain into the next skill with diminishing chance.',
        tier: BLESSING_TIER.LEVEL_1,
        unlockedByDefault: true,
        available: true,
        tags: ['resource'],
        effectKey: 'pillar.cascade.chain_reaction'
      }
    ],
    blessingsLevel2: [
      {
        id: 'pillar.cascade.grand_finale',
        pillarId: 'the_cascade',
        displayName: 'Grand Finale',
        description: 'After all four skills trigger once, all four trigger again (guarded against infinite loops).',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['resource'],
        effectKey: 'pillar.cascade.grand_finale'
      },
      {
        id: 'pillar.cascade.wild_cascade',
        pillarId: 'the_cascade',
        displayName: 'Wild Cascade',
        description: 'When a skill is triggered, trigger one eligible random skill with strict proc safety limits.',
        tier: BLESSING_TIER.LEVEL_2,
        unlockedByDefault: true,
        available: true,
        tags: ['resource', 'chaos'],
        effectKey: 'pillar.cascade.wild_cascade'
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
