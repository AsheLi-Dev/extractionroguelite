import { PILLAR_TRIAL_ENTRY_ITEM_ID } from './pillars.js';

export const RITE_ENTRY_ITEM_ID = PILLAR_TRIAL_ENTRY_ITEM_ID;
export const RITE_ENTRY_ITEM_DISPLAY_NAME = 'The Blood of The Lamb';
export const RITE_ENTRY_ITEM_CATEGORY = 'Precious';
export const RITE_ENTRY_ITEM_PRECIOUS_ID = 'blood_of_the_lamb';

const RITE_SEED = Object.freeze([
  {
    id: 'rite_of_fear',
    displayName: 'Rite of Fear',
    level: 1,
    proofRewardId: 'proof_of_courage',
    legacyProofRewardId: 'proof_courage',
    description: 'Face unknown corridors and return with your courage intact.',
    entryItemId: RITE_ENTRY_ITEM_ID,
    entryItemCost: 1,
    modeType: 'exploration',
    successConditionType: 'objective_complete',
    failureConditionType: 'player_defeat',
    controllerKey: 'fear_hallway',
    unlockOrder: 1
  },
  {
    id: 'rite_of_monstrosity',
    displayName: 'Rite of Monstrosity',
    level: 2,
    proofRewardId: 'proof_of_strength',
    legacyProofRewardId: 'proof_strength',
    description: 'Survive escalating staged encounters forged for brute strength.',
    entryItemId: RITE_ENTRY_ITEM_ID,
    entryItemCost: 1,
    modeType: 'sequence',
    successConditionType: 'stages_cleared',
    failureConditionType: 'player_defeat',
    controllerKey: 'monstrosity_sequence',
    unlockOrder: 2
  },
  {
    id: 'rite_of_torment',
    displayName: 'Rite of Torment',
    level: 3,
    proofRewardId: 'proof_of_resilience',
    legacyProofRewardId: 'proof_resilience',
    description: 'Descend through punishing floors and endure the return climb.',
    entryItemId: RITE_ENTRY_ITEM_ID,
    entryItemCost: 2,
    modeType: 'dungeon',
    successConditionType: 'depth_cycle_complete',
    failureConditionType: 'player_defeat',
    controllerKey: 'torment_dungeon',
    unlockOrder: 3
  },
  {
    id: 'rite_of_sovereign',
    displayName: 'Rite of Sovereign',
    level: 4,
    proofRewardId: 'proof_of_dominance',
    legacyProofRewardId: 'proof_dominance',
    description: 'Challenge a sovereign foe and claim absolute dominance.',
    entryItemId: RITE_ENTRY_ITEM_ID,
    entryItemCost: 3,
    modeType: 'boss',
    successConditionType: 'boss_defeated',
    failureConditionType: 'player_defeat',
    controllerKey: 'sovereign_boss',
    unlockOrder: 4
  }
]);

export const RITES = Object.freeze([...RITE_SEED]);

export const RITE_BY_ID = Object.freeze(
  RITES.reduce((acc, rite) => {
    acc[rite.id] = rite;
    return acc;
  }, /** @type {Record<string, any>} */ ({}))
);

export const RITE_PROOF_ID_REMAP = Object.freeze({
  proof_of_courage: 'proof_courage',
  proof_of_strength: 'proof_strength',
  proof_of_resilience: 'proof_resilience',
  proof_of_dominance: 'proof_dominance'
});

const LEGACY_TO_CANONICAL_PROOF_ID_REMAP = Object.freeze(
  Object.entries(RITE_PROOF_ID_REMAP).reduce((acc, [canonical, legacy]) => {
    acc[legacy] = canonical;
    return acc;
  }, /** @type {Record<string, string>} */ ({}))
);

export function getAllRites() {
  return RITES;
}

export function getRiteById(riteId) {
  return RITE_BY_ID[String(riteId || '')] || null;
}

export function getRiteEntryItemCost(riteOrId) {
  const rite =
    typeof riteOrId === 'string'
      ? getRiteById(riteOrId)
      : riteOrId;
  return Math.max(1, Number(rite?.entryItemCost) || 1);
}

export function isKnownRiteId(riteId) {
  return !!getRiteById(riteId);
}

export function toLegacyProofId(proofId) {
  const id = String(proofId || '');
  return RITE_PROOF_ID_REMAP[id] || id;
}

export function toCanonicalProofId(proofId) {
  const id = String(proofId || '');
  return LEGACY_TO_CANONICAL_PROOF_ID_REMAP[id] || id;
}
