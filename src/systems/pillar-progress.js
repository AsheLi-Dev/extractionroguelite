import {
  BLESSING_TIER,
  PROOF_BY_ID,
  PROOF_SEQUENCE,
  getBlessingById
} from '../data/pillars.js';

const PILLAR_PROGRESS_STORAGE_KEY = 'pillarSystemState';

/** @typedef {{maxLevel1: number, maxLevel2: number, maxBlessingsPerPillar: number}} AllocationRules */

/** @typedef {Object} PlayerPillarProgress
 * @property {number} trialClearCount
 * @property {string[]} earnedProofIds
 * @property {string[]} allocatedBlessingIds
 * @property {string[]} availablePillarIds
 * @property {number} trialEntryItemCount
 * @property {{ pillarId: string, startedAt: number } | null} activeTrial
 */

/** @typedef {Object} ProofProgress
 * @property {number} trialClearCount
 * @property {string[]} earnedProofIds
 */

/** @typedef {Object} TrialProgress
 * @property {number} trialClearCount
 * @property {string[]} earnedProofIds
 * @property {object|null} nextProof
 */

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeProofIds(rawProofIds) {
  if (!Array.isArray(rawProofIds)) {
    return [];
  }
  return [...new Set(rawProofIds.filter((id) => PROOF_BY_ID[id]))];
}

function sanitizeBlessingIds(rawBlessingIds) {
  if (!Array.isArray(rawBlessingIds)) {
    return [];
  }
  return rawBlessingIds.filter((id) => !!getBlessingById(id));
}

function sanitizePillarIds(rawPillarIds, allPillarIds) {
  if (!Array.isArray(rawPillarIds)) {
    return allPillarIds;
  }
  const filtered = rawPillarIds.filter((id) => allPillarIds.includes(id));
  return filtered.length ? filtered : allPillarIds;
}

export function createDefaultPillarProgressState(allPillarIds = []) {
  return {
    trialClearCount: 0,
    earnedProofIds: [],
    allocatedBlessingIds: [],
    availablePillarIds: [...allPillarIds],
    trialEntryItemCount: 0,
    activeTrial: null
  };
}

export function normalizePillarProgressState(rawState, allPillarIds = []) {
  const base = createDefaultPillarProgressState(allPillarIds);
  if (!isObject(rawState)) {
    return base;
  }

  return {
    trialClearCount: Math.max(0, Number(rawState.trialClearCount) || 0),
    earnedProofIds: sanitizeProofIds(rawState.earnedProofIds),
    allocatedBlessingIds: sanitizeBlessingIds(rawState.allocatedBlessingIds),
    availablePillarIds: sanitizePillarIds(rawState.availablePillarIds, allPillarIds),
    trialEntryItemCount: Math.max(0, Number(rawState.trialEntryItemCount) || 0),
    activeTrial:
      rawState.activeTrial && rawState.activeTrial.pillarId
        ? { pillarId: rawState.activeTrial.pillarId, startedAt: Date.now() }
        : null
  };
}

export function loadPillarProgressState(allPillarIds = []) {
  try {
    const raw = localStorage.getItem(PILLAR_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return createDefaultPillarProgressState(allPillarIds);
    }
    return normalizePillarProgressState(JSON.parse(raw), allPillarIds);
  } catch (error) {
    console.warn('[PillarProgress] Failed to load pillar save state:', error);
    return createDefaultPillarProgressState(allPillarIds);
  }
}

export function savePillarProgressState(state) {
  const payload = {
    trialClearCount: Math.max(0, Number(state?.trialClearCount) || 0),
    earnedProofIds: Array.from(new Set(Array.isArray(state?.earnedProofIds) ? state.earnedProofIds : [])),
    allocatedBlessingIds: Array.from(new Set(Array.isArray(state?.allocatedBlessingIds) ? state.allocatedBlessingIds : [])),
    availablePillarIds: Array.isArray(state?.availablePillarIds) ? state.availablePillarIds : [],
    trialEntryItemCount: Math.max(0, Number(state?.trialEntryItemCount) || 0),
    activeTrial: state?.activeTrial || null
  };
  localStorage.setItem(PILLAR_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function getAllPillarProofs() {
  return PROOF_SEQUENCE;
}

export function getPillarProofById(proofId) {
  return PROOF_BY_ID[proofId] || null;
}

export function getProofRequirementForBlessingTier(tier) {
  const key = tier === BLESSING_TIER.LEVEL_2 ? 'level2' : 'level1';
  return PROOF_SEQUENCE.find((proof) => Number(proof?.grants?.[key]) > 0) || null;
}

export function getNextProofForNextSuccess(state) {
  const clearCount = Math.max(0, Number(state?.trialClearCount) || 0);
  return PROOF_SEQUENCE[clearCount] || null;
}

export function applyTrialSuccessProgression(state) {
  const nextProof = getNextProofForNextSuccess(state);
  const nextTrialClearCount = Math.max(0, Number(state?.trialClearCount) || 0) + 1;
  const nextProofs = new Set(Array.isArray(state?.earnedProofIds) ? state.earnedProofIds : []);
  if (nextProof) {
    nextProofs.add(nextProof.id);
  }
  return {
    trialClearCount: nextTrialClearCount,
    nextProofGranted: nextProof ? nextProof.id : null,
    earnedProofIds: [...nextProofs]
  };
};

export function getProofCapacityFromState(state) {
  const earnedProofIds = Array.isArray(state?.earnedProofIds) ? state.earnedProofIds : [];
  let level1 = 0;
  let level2 = 0;
  for (const proofId of earnedProofIds) {
    const proof = PROOF_BY_ID[proofId];
    if (!proof) {
      continue;
    }
    level1 += proof.grants.level1;
    level2 += proof.grants.level2;
  }
  return { level1, level2 };
}

export function getAllocatedCounts(state) {
  let level1 = 0;
  let level2 = 0;
  if (!Array.isArray(state?.allocatedBlessingIds)) {
    return { level1, level2 };
  }
  for (const blessingId of state.allocatedBlessingIds) {
    const blessing = getBlessingById(blessingId);
    if (!blessing) {
      continue;
    }
    if (blessing.tier === BLESSING_TIER.LEVEL_1) {
      level1 += 1;
    } else {
      level2 += 1;
    }
  }
  return { level1, level2 };
}

export function getAllocatedPillars(state) {
  const pillars = new Set();
  if (!Array.isArray(state?.allocatedBlessingIds)) {
    return pillars;
  }
  for (const blessingId of state.allocatedBlessingIds) {
    const blessing = getBlessingById(blessingId);
    if (!blessing) {
      continue;
    }
    pillars.add(blessing.pillarId);
  }
  return pillars;
}

export function getAllocationRules(state, ruleModifiers = []) {
  const base = getProofCapacityFromState(state);
  const baseRules = {
    maxLevel1: base.level1,
    maxLevel2: base.level2,
    maxBlessingsPerPillar: 1
  };

  return ruleModifiers.reduce((rules, modifier) => {
    if (typeof modifier !== 'function') {
      return rules;
    }
    return modifier(rules, state) || rules;
  }, baseRules);
}

export function getTierCapacitySnapshot(state, ruleModifiers = []) {
  const rules = getAllocationRules(state, ruleModifiers);
  const allocated = getAllocatedCounts(state);
  return {
    maxLevel1: rules.maxLevel1,
    maxLevel2: rules.maxLevel2,
    maxBlessingsPerPillar: rules.maxBlessingsPerPillar,
    remainingLevel1: Math.max(0, rules.maxLevel1 - allocated.level1),
    remainingLevel2: Math.max(0, rules.maxLevel2 - allocated.level2),
    allocatedLevel1: allocated.level1,
    allocatedLevel2: allocated.level2
  };
}

export function isPillarAvailable(state, pillarId) {
  return Array.isArray(state?.availablePillarIds) && state.availablePillarIds.includes(pillarId);
}

export function canStartTrial(state, pillarId) {
  const hasItem = Number(state?.trialEntryItemCount) > 0;
  if (!hasItem) {
    return { allowed: false, reason: 'You do not own the pillar trial entry item.' };
  }

  const available = isPillarAvailable(state, pillarId);
  if (!available) {
    return { allowed: false, reason: 'This pillar is locked.' };
  }

  if (state?.activeTrial?.pillarId) {
    return { allowed: false, reason: 'A pillar trial is already active.' };
  }

  return { allowed: true, reason: 'Can enter trial.' };
}

export function canAllocateBlessing(state, blessingId, ruleModifiers = []) {
  const blessing = getBlessingById(blessingId);
  if (!blessing) {
    return { allowed: false, reason: 'Unknown blessing.', details: 'not_found' };
  }

  if (!blessing.available) {
    return { allowed: false, reason: 'This blessing is currently locked.', details: 'locked_blessing' };
  }

  const currentAllocation = Array.isArray(state?.allocatedBlessingIds) ? state.allocatedBlessingIds : [];
  if (currentAllocation.includes(blessingId)) {
    return { allowed: false, reason: 'This blessing is already allocated.', details: 'duplicate' };
  }

  const rules = getAllocationRules(state, ruleModifiers);
  const allocatedCounts = getAllocatedCounts(state);
  const allocatedPillars = getAllocatedPillars(state);

  if (rules.maxBlessingsPerPillar > 0 && allocatedPillars.has(blessing.pillarId)) {
    return { allowed: false, reason: 'Only one blessing can be allocated per pillar.', details: 'pillar_full' };
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_1 && rules.maxLevel1 <= 0) {
    const requiredProof = getProofRequirementForBlessingTier(BLESSING_TIER.LEVEL_1);
    return {
      allowed: false,
      reason: 'Proofs are required before a level 1 blessing can be allocated.',
      details: 'tier1_blocked',
      requiredProofId: requiredProof?.id || null
    };
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_2 && rules.maxLevel2 <= 0) {
    const requiredProof = getProofRequirementForBlessingTier(BLESSING_TIER.LEVEL_2);
    return {
      allowed: false,
      reason: 'Proofs are required before a level 2 blessing can be allocated.',
      details: 'tier2_blocked',
      requiredProofId: requiredProof?.id || null
    };
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_1 && allocatedCounts.level1 >= rules.maxLevel1) {
    return {
      allowed: false,
      reason: 'Level 1 blessing capacity reached.',
      details: 'tier1_full'
    };
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_2 && allocatedCounts.level2 >= rules.maxLevel2) {
    return {
      allowed: false,
      reason: 'Level 2 blessing capacity reached.',
      details: 'tier2_full'
    };
  }

  return { allowed: true, reason: 'Can allocate blessing.' };
}

export function canDeallocateBlessing(state, blessingId) {
  const allocated = Array.isArray(state?.allocatedBlessingIds) ? state.allocatedBlessingIds : [];
  if (!allocated.includes(blessingId)) {
    return { allowed: false, reason: 'Blessing is not allocated.' };
  }
  return { allowed: true, reason: 'Can deallocate blessing.' };
}

export function grantAllProofs(state) {
  const granted = new Set(Array.isArray(state?.earnedProofIds) ? state.earnedProofIds : []);
  for (const proof of PROOF_SEQUENCE) {
    granted.add(proof.id);
  }
  return {
    earnedProofIds: [...granted],
    trialClearCount: Math.max(4, Number(state?.trialClearCount) || 0)
  };
}
