import {
  BLESSING_TIER,
  PROOF_BY_ID,
  PROOF_SEQUENCE,
  getBlessingById
} from '../data/pillars.js';
import { getAllRites, getRiteById, toLegacyProofId } from '../data/rites.js';

const PILLAR_PROGRESS_STORAGE_KEY = 'pillarSystemState';
export const PILLAR_PROGRESS_SAVE_VERSION = 3;

const LEGACY_BLESSING_ID_REMAP = Object.freeze({
  the_deep_forge_resolve: 'pillar.pacifier.quiet_hands',
  the_deep_quiet_hands: 'pillar.pacifier.quiet_hands',
  the_void_cold_step: 'pillar.void.skill_singularity',
  the_void_event_horizon: 'pillar.void.void_walker',
  the_limitless_unbound_thought: 'pillar.limitless.exponential_growth',
  the_pacifier_woven_gentle: 'pillar.pacifier.false_peace',
  the_pacifier_somber_heart: 'pillar.pacifier.gentle_presence',
  the_collector_endless_archive: 'pillar.collector.hoarders_arsenal',
  the_deep_two_heads: 'pillar.deep.two_heads',
  the_deep_ancient_pressure: 'pillar.deep.polluting_presence',
  the_deep_tentacles: 'pillar.deep.tentacles',
  the_deep_twisted_belief: 'pillar.deep.twisted_belief',
  the_havoc_unchecked_stride: 'pillar.havoc.chain_detonation',
  the_havoc_fearless_chain: 'pillar.havoc.momentum_of_ruin',
  the_havoc_fury_of_havoc: 'pillar.havoc.fury_of_havoc',
  the_havoc_unmake_the_world: 'pillar.havoc.unmake_the_world',
  weapon_master_steady_hand: 'pillar.weapon_master.perfect_craft',
  weapon_master_dual_technique: 'pillar.weapon_master.dual_technique',
  weapon_master_fatal_recall: 'pillar.weapon_master.perfect_hybridization',
  weapon_master_living_arsenal: 'pillar.weapon_master.living_arsenal',
  the_limitless_wide_scope: 'pillar.limitless.endless_possibilities',
  the_limitless_exponential_growth: 'pillar.limitless.exponential_growth',
  the_limitless_ascended_growth: 'pillar.limitless.ascended_growth',
  the_limitless_no_limits: 'pillar.limitless.no_limits',
  the_void_skill_singularity: 'pillar.void.skill_singularity',
  the_void_untouchable_dash: 'pillar.void.untouchable_dash',
  the_void_void_walker: 'pillar.void.void_walker',
  the_void_void_discrimination: 'pillar.void.void_discrimination',
  the_pacifier_gentle_presence: 'pillar.pacifier.gentle_presence',
  the_pacifier_quiet_hands: 'pillar.pacifier.quiet_hands',
  the_pacifier_false_peace: 'pillar.pacifier.false_peace',
  the_pacifier_harmony_of_stillness: 'pillar.pacifier.harmony_of_stillness',
  the_collector_precise_memoir: 'pillar.collector.merchant_instinct',
  the_collector_hoarders_arsenal: 'pillar.collector.hoarders_arsenal',
  the_collector_grand_bazaar: 'pillar.collector.grand_bazaar',
  the_collector_ring_vault: 'pillar.collector.ring_vault',
  the_cascade_looping_draw: 'pillar.cascade.amplified_triggers',
  the_cascade_requiem_drop: 'pillar.cascade.chain_reaction',
  the_cascade_wild_cascade: 'pillar.cascade.wild_cascade',
  the_cascade_grand_finale: 'pillar.cascade.grand_finale'
});

/** @typedef {{maxLevel1: number, maxLevel2: number, maxBlessingsPerPillar: number, allowSamePillarDuplicates: boolean, enforceSiblingExclusion: boolean, blockLevel2Allocation: boolean}} AllocationRules */

/** @typedef {Object} PlayerPillarProgress
 * @property {number} trialClearCount
 * @property {string[]} earnedProofIds
 * @property {string[]} allocatedBlessingIds
 * @property {string[]} availablePillarIds
 * @property {number} trialEntryItemCount
 * @property {number} riteEntryItemCount
 * @property {{ pillarId: string, startedAt: number } | null} activeTrial
 * @property {{ unlockedRiteIds: string[], completedRiteIds: string[], grantedProofByRiteId: Record<string, string>, activeRite: { riteId: string, startedAt: number, controllerKey: string | null } | null, lastResult: object | null, debug: { unlockAllRites: boolean } }} riteProgress
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

function createMigrationReport(versionFrom) {
  return {
    versionFrom: Number.isFinite(Number(versionFrom)) ? Number(versionFrom) : 0,
    versionTo: PILLAR_PROGRESS_SAVE_VERSION,
    actions: []
  };
}

function appendMigrationAction(report, action, detail) {
  if (!report || !Array.isArray(report.actions)) {
    return;
  }
  report.actions.push({
    action: String(action || 'unknown'),
    detail: detail == null ? '' : String(detail)
  });
}

function getDefaultUnlockedRiteIds() {
  const rites = getAllRites()
    .slice()
    .sort((a, b) => (Number(a.unlockOrder) || 0) - (Number(b.unlockOrder) || 0));
  if (rites.length <= 0) {
    return [];
  }
  return [rites[0].id];
}

function sanitizeRiteIds(rawRiteIds, report = null) {
  if (!Array.isArray(rawRiteIds)) {
    return [];
  }
  const deduped = new Set();
  for (const rawRiteId of rawRiteIds) {
    const riteId = String(rawRiteId || '');
    const rite = getRiteById(riteId);
    if (!rite) {
      appendMigrationAction(report, 'drop_unknown_rite', riteId);
      continue;
    }
    if (deduped.has(rite.id)) {
      appendMigrationAction(report, 'drop_duplicate_rite', rite.id);
      continue;
    }
    deduped.add(rite.id);
  }
  return [...deduped];
}

function sanitizeGrantedProofByRiteId(rawMapping, report = null) {
  if (!isObject(rawMapping)) {
    return {};
  }
  const sanitized = {};
  for (const [rawRiteId, rawProofId] of Object.entries(rawMapping)) {
    const rite = getRiteById(rawRiteId);
    if (!rite) {
      appendMigrationAction(report, 'drop_unknown_rite_proof_mapping', rawRiteId);
      continue;
    }
    const mappedProofId = toLegacyProofId(rawProofId);
    if (!PROOF_BY_ID[mappedProofId]) {
      appendMigrationAction(report, 'drop_unknown_rite_proof', `${rawRiteId}:${rawProofId}`);
      continue;
    }
    sanitized[rite.id] = mappedProofId;
  }
  return sanitized;
}

function deriveRiteProgressFromLegacyTrialState(rawState, report = null) {
  const rites = getAllRites()
    .slice()
    .sort((a, b) => (Number(a.unlockOrder) || 0) - (Number(b.unlockOrder) || 0));
  const unlocked = new Set(getDefaultUnlockedRiteIds());
  const completed = new Set();
  const grantedProofByRiteId = {};
  const earnedProofIds = Array.isArray(rawState?.earnedProofIds) ? rawState.earnedProofIds : [];

  for (const rite of rites) {
    const legacyProofId = toLegacyProofId(rite.proofRewardId);
    if (earnedProofIds.includes(legacyProofId)) {
      completed.add(rite.id);
      grantedProofByRiteId[rite.id] = legacyProofId;
    }
  }

  const trialClearCount = Math.max(0, Number(rawState?.trialClearCount) || 0);
  if (completed.size <= 0 && trialClearCount > 0) {
    for (let i = 0; i < Math.min(trialClearCount, rites.length); i += 1) {
      const rite = rites[i];
      completed.add(rite.id);
      grantedProofByRiteId[rite.id] = toLegacyProofId(rite.proofRewardId);
    }
    appendMigrationAction(report, 'derive_rites_from_trial_clear_count', trialClearCount);
  }

  for (const rite of rites) {
    if (completed.has(rite.id) || (Number(rite.unlockOrder) || 1) <= completed.size + 1) {
      unlocked.add(rite.id);
    }
  }

  return {
    unlockedRiteIds: [...unlocked],
    completedRiteIds: [...completed],
    grantedProofByRiteId
  };
}

function sanitizeRiteProgress(rawRiteProgress, rawState, report = null) {
  const derived = deriveRiteProgressFromLegacyTrialState(rawState, report);
  if (!isObject(rawRiteProgress)) {
    appendMigrationAction(report, 'default_rite_progress_applied', 'missing_rite_progress');
    return {
      ...derived,
      activeRite: null,
      lastResult: null,
      debug: { unlockAllRites: false }
    };
  }

  const unlockedRiteIds = sanitizeRiteIds(rawRiteProgress.unlockedRiteIds, report);
  const completedRiteIds = sanitizeRiteIds(rawRiteProgress.completedRiteIds, report);
  const grantedProofByRiteId = sanitizeGrantedProofByRiteId(rawRiteProgress.grantedProofByRiteId, report);
  const unlocked = new Set(unlockedRiteIds.length > 0 ? unlockedRiteIds : derived.unlockedRiteIds);
  const completed = new Set(completedRiteIds.length > 0 ? completedRiteIds : derived.completedRiteIds);

  for (const riteId of completed) {
    unlocked.add(riteId);
  }
  for (const [riteId, proofId] of Object.entries(derived.grantedProofByRiteId)) {
    if (!grantedProofByRiteId[riteId]) {
      grantedProofByRiteId[riteId] = proofId;
    }
  }

  let activeRite = null;
  if (isObject(rawRiteProgress.activeRite) && getRiteById(rawRiteProgress.activeRite.riteId)) {
    activeRite = {
      riteId: String(rawRiteProgress.activeRite.riteId),
      startedAt: Number(rawRiteProgress.activeRite.startedAt) || Date.now(),
      controllerKey: rawRiteProgress.activeRite.controllerKey
        ? String(rawRiteProgress.activeRite.controllerKey)
        : null
    };
  } else if (isObject(rawState?.activeTrial)) {
    const firstOpenRite = getAllRites().find((rite) => !completed.has(rite.id));
    if (firstOpenRite) {
      activeRite = {
        riteId: firstOpenRite.id,
        startedAt: Number(rawState.activeTrial.startedAt) || Date.now(),
        controllerKey: firstOpenRite.controllerKey || null
      };
      appendMigrationAction(report, 'migrate_active_trial_to_rite', firstOpenRite.id);
    }
  }

  const lastResult = isObject(rawRiteProgress.lastResult)
    ? {
      riteId: getRiteById(rawRiteProgress.lastResult.riteId)?.id || null,
      result: String(rawRiteProgress.lastResult.result || ''),
      reason: rawRiteProgress.lastResult.reason ? String(rawRiteProgress.lastResult.reason) : null,
      proofRewardId: rawRiteProgress.lastResult.proofRewardId
        ? toLegacyProofId(rawRiteProgress.lastResult.proofRewardId)
        : null,
      at: Number(rawRiteProgress.lastResult.at) || 0
    }
    : null;

  return {
    unlockedRiteIds: [...unlocked],
    completedRiteIds: [...completed],
    grantedProofByRiteId,
    activeRite,
    lastResult,
    debug: {
      unlockAllRites: rawRiteProgress?.debug?.unlockAllRites === true
    }
  };
}

function sanitizeProofIds(rawProofIds, report = null) {
  if (!Array.isArray(rawProofIds)) {
    return [];
  }
  const deduped = new Set();
  for (const id of rawProofIds) {
    if (!PROOF_BY_ID[id]) {
      appendMigrationAction(report, 'drop_unknown_proof', id);
      continue;
    }
    if (deduped.has(id)) {
      appendMigrationAction(report, 'drop_duplicate_proof', id);
      continue;
    }
    deduped.add(id);
  }
  return [...deduped];
}

function remapLegacyBlessingId(blessingId, report = null) {
  if (!blessingId) {
    return blessingId;
  }
  const remapped = LEGACY_BLESSING_ID_REMAP[blessingId];
  if (!remapped || remapped === blessingId) {
    return blessingId;
  }
  appendMigrationAction(report, 'remap_blessing_id', `${blessingId} -> ${remapped}`);
  return remapped;
}

function sanitizeBlessingIds(rawBlessingIds, report = null) {
  if (!Array.isArray(rawBlessingIds)) {
    return [];
  }
  const sanitized = [];
  const seen = new Set();
  for (const rawId of rawBlessingIds) {
    const blessingId = remapLegacyBlessingId(rawId, report);
    const blessing = getBlessingById(blessingId);
    if (!blessing) {
      appendMigrationAction(report, 'drop_unknown_blessing', rawId);
      continue;
    }
    if (seen.has(blessingId)) {
      appendMigrationAction(report, 'drop_duplicate_blessing', blessingId);
      continue;
    }
    seen.add(blessingId);
    sanitized.push(blessingId);
  }
  return sanitized;
}

function sanitizePillarIds(rawPillarIds, allPillarIds, report = null) {
  if (!Array.isArray(rawPillarIds)) {
    return allPillarIds;
  }
  const filtered = rawPillarIds.filter((id) => {
    const valid = allPillarIds.includes(id);
    if (!valid) {
      appendMigrationAction(report, 'drop_unknown_pillar', id);
    }
    return valid;
  });
  return filtered.length ? filtered : allPillarIds;
}

function getIntrinsicTopologyModifierForBlessing(blessing) {
  const effectKey = blessing?.effectKey || '';
  if (effectKey === 'pillar.deep.twisted_belief') {
    return {
      id: 'twisted_belief_intrinsic',
      effectKey,
      maxLevel1Delta: 3,
      maxLevel2Override: 1,
      maxBlessingsPerPillarOverride: 2,
      allowSamePillarDuplicates: true,
      enforceSiblingExclusion: false,
      blockLevel2Allocation: true
    };
  }
  return null;
}

function collectIntrinsicRuleModifiersFromBlessingIds(blessingIds = []) {
  const modifiers = [];
  for (const blessingId of blessingIds) {
    const blessing = getBlessingById(blessingId);
    if (!blessing) continue;
    const modifier = getIntrinsicTopologyModifierForBlessing(blessing);
    if (modifier) modifiers.push(modifier);
  }
  return modifiers;
}

export function createDefaultPillarProgressState(allPillarIds = []) {
  const unlockedRiteIds = getDefaultUnlockedRiteIds();
  return {
    version: PILLAR_PROGRESS_SAVE_VERSION,
    trialClearCount: 0,
    earnedProofIds: [],
    allocatedBlessingIds: [],
    availablePillarIds: [...allPillarIds],
    trialEntryItemCount: 0,
    riteEntryItemCount: 0,
    activeTrial: null,
    riteProgress: {
      unlockedRiteIds,
      completedRiteIds: [],
      grantedProofByRiteId: {},
      activeRite: null,
      lastResult: null,
      debug: {
        unlockAllRites: false
      }
    }
  };
}

function sanitizeAllocatedBlessingsAgainstRules(state, allocatedBlessingIds, report = null) {
  const accepted = [];

  for (const blessingId of allocatedBlessingIds) {
    const blessing = getBlessingById(blessingId);
    if (!blessing || blessing.available === false) {
      appendMigrationAction(report, 'drop_invalid_allocated_blessing', blessingId);
      continue;
    }
    const currentState = {
      trialClearCount: state.trialClearCount,
      earnedProofIds: state.earnedProofIds,
      allocatedBlessingIds: [...accepted]
    };
    const intrinsicModifiers = collectIntrinsicRuleModifiersFromBlessingIds(accepted);
    const diagnostics = getBlessingAllocationDiagnostics(
      currentState,
      blessingId,
      intrinsicModifiers,
      { includeIntrinsicCandidateModifier: true }
    );
    if (!diagnostics.allowed) {
      appendMigrationAction(report, 'drop_invalid_allocated_blessing', `${blessingId}:${diagnostics.details || diagnostics.reason || 'blocked'}`);
      continue;
    }
    accepted.push(blessingId);
  }

  return accepted;
}

export function sanitizeAndMigratePillarProgressState(rawState, allPillarIds = [], options = {}) {
  const base = createDefaultPillarProgressState(allPillarIds);
  const report = createMigrationReport(rawState?.version);

  if (!isObject(rawState)) {
    appendMigrationAction(report, 'default_state_applied', 'missing_or_invalid_payload');
    return { state: base, report };
  }

  const trialClearCount = Math.max(0, Number(rawState.trialClearCount) || 0);
  const earnedProofIds = sanitizeProofIds(rawState.earnedProofIds, report);
  const availablePillarIds = sanitizePillarIds(rawState.availablePillarIds, allPillarIds, report);
  const trialEntryItemCount = Math.max(0, Number(rawState.trialEntryItemCount) || 0);
  const riteEntryItemCount = Math.max(0, Number(rawState.riteEntryItemCount ?? rawState.trialEntryItemCount) || 0);

  let activeTrial = null;
  if (rawState.activeTrial && rawState.activeTrial.pillarId) {
    const trialPillarId = String(rawState.activeTrial.pillarId);
    if (allPillarIds.includes(trialPillarId)) {
      activeTrial = {
        pillarId: trialPillarId,
        startedAt: Number(rawState.activeTrial.startedAt) || Date.now()
      };
    } else {
      appendMigrationAction(report, 'drop_invalid_active_trial', trialPillarId);
    }
  }

  const preliminaryState = {
    version: PILLAR_PROGRESS_SAVE_VERSION,
    trialClearCount,
    earnedProofIds,
    allocatedBlessingIds: [],
    availablePillarIds,
    trialEntryItemCount,
    riteEntryItemCount,
    activeTrial,
    riteProgress: sanitizeRiteProgress(rawState.riteProgress, rawState, report)
  };
  const migratedBlessings = sanitizeBlessingIds(rawState.allocatedBlessingIds, report);
  const allocatedBlessingIds = sanitizeAllocatedBlessingsAgainstRules(preliminaryState, migratedBlessings, report);

  const state = {
    ...preliminaryState,
    allocatedBlessingIds,
    trialEntryItemCount: riteEntryItemCount,
    riteEntryItemCount
  };
  const debug = options?.debug === true;
  if (debug && report.actions.length > 0) {
    console.warn('[PillarProgress] Save sanitization actions:', report.actions);
  }
  return { state, report };
}

export function normalizePillarProgressState(rawState, allPillarIds = []) {
  return sanitizeAndMigratePillarProgressState(rawState, allPillarIds).state;
}

export function loadPillarProgressState(allPillarIds = [], options = {}) {
  const withReport = options?.withReport === true;
  const debug = options?.debug === true;
  try {
    const raw = localStorage.getItem(PILLAR_PROGRESS_STORAGE_KEY);
    if (!raw) {
      const state = createDefaultPillarProgressState(allPillarIds);
      const report = createMigrationReport(PILLAR_PROGRESS_SAVE_VERSION);
      appendMigrationAction(report, 'default_state_applied', 'missing_save_slot');
      return withReport ? { state, report } : state;
    }
    const parsed = JSON.parse(raw);
    const result = sanitizeAndMigratePillarProgressState(parsed, allPillarIds, { debug });
    return withReport ? result : result.state;
  } catch (error) {
    console.warn('[PillarProgress] Failed to load pillar save state:', error);
    const state = createDefaultPillarProgressState(allPillarIds);
    const report = createMigrationReport(0);
    appendMigrationAction(report, 'default_state_applied', 'json_parse_error');
    return withReport ? { state, report } : state;
  }
}

export function savePillarProgressState(state) {
  const riteProgress = sanitizeRiteProgress(state?.riteProgress, state, null);
  const entryItemCount = Math.max(0, Number(state?.riteEntryItemCount ?? state?.trialEntryItemCount) || 0);
  const payload = {
    version: PILLAR_PROGRESS_SAVE_VERSION,
    trialClearCount: Math.max(0, Number(state?.trialClearCount) || 0),
    earnedProofIds: Array.from(new Set(Array.isArray(state?.earnedProofIds) ? state.earnedProofIds : [])),
    allocatedBlessingIds: Array.from(new Set(Array.isArray(state?.allocatedBlessingIds) ? state.allocatedBlessingIds : [])),
    availablePillarIds: Array.isArray(state?.availablePillarIds) ? state.availablePillarIds : [],
    trialEntryItemCount: entryItemCount,
    riteEntryItemCount: entryItemCount,
    activeTrial: state?.activeTrial || null,
    riteProgress
  };
  localStorage.setItem(PILLAR_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function getRiteProgressFromState(state) {
  return sanitizeRiteProgress(state?.riteProgress, state, null);
}

export function getRiteEntryItemCountFromState(state) {
  return Math.max(
    0,
    Number(state?.riteEntryItemCount ?? state?.trialEntryItemCount) || 0
  );
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

function clampInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(0, Math.floor(fallback));
  }
  return Math.max(0, Math.floor(numeric));
}

function applyObjectRuleModifier(rules, modifier) {
  const next = { ...rules };
  if (!isObject(modifier)) {
    return next;
  }
  if (Number.isFinite(modifier.maxLevel1Delta)) {
    next.maxLevel1 += modifier.maxLevel1Delta;
  }
  if (Number.isFinite(modifier.maxLevel2Delta)) {
    next.maxLevel2 += modifier.maxLevel2Delta;
  }
  if (Number.isFinite(modifier.maxBlessingsPerPillarDelta)) {
    next.maxBlessingsPerPillar += modifier.maxBlessingsPerPillarDelta;
  }
  if (Number.isFinite(modifier.maxLevel1Override)) {
    next.maxLevel1 = modifier.maxLevel1Override;
  }
  if (Number.isFinite(modifier.maxLevel2Override)) {
    next.maxLevel2 = modifier.maxLevel2Override;
  }
  if (Number.isFinite(modifier.maxBlessingsPerPillarOverride)) {
    next.maxBlessingsPerPillar = modifier.maxBlessingsPerPillarOverride;
  }
  if (modifier.allowMultipleSamePillar === true) {
    next.maxBlessingsPerPillar = Math.max(next.maxBlessingsPerPillar, 2);
    next.allowSamePillarDuplicates = true;
  }
  if (typeof modifier.allowSamePillarDuplicates === 'boolean') {
    next.allowSamePillarDuplicates = modifier.allowSamePillarDuplicates;
  }
  if (typeof modifier.enforceSiblingExclusion === 'boolean') {
    next.enforceSiblingExclusion = modifier.enforceSiblingExclusion;
  }
  if (modifier.preventLevel2Allocation === true) {
    next.maxLevel2 = 0;
    next.blockLevel2Allocation = true;
  }
  if (typeof modifier.blockLevel2Allocation === 'boolean') {
    next.blockLevel2Allocation = modifier.blockLevel2Allocation;
  }
  if (Number.isFinite(modifier.maxBlessingsPerPillarMin)) {
    next.maxBlessingsPerPillar = Math.max(next.maxBlessingsPerPillar, modifier.maxBlessingsPerPillarMin);
  }
  if (Number.isFinite(modifier.maxBlessingsPerPillarMax)) {
    next.maxBlessingsPerPillar = Math.min(next.maxBlessingsPerPillar, modifier.maxBlessingsPerPillarMax);
  }
  next.maxLevel1 = clampInteger(next.maxLevel1, rules.maxLevel1);
  next.maxLevel2 = clampInteger(next.maxLevel2, rules.maxLevel2);
  next.maxBlessingsPerPillar = clampInteger(next.maxBlessingsPerPillar, rules.maxBlessingsPerPillar);
  next.allowSamePillarDuplicates = !!next.allowSamePillarDuplicates;
  next.enforceSiblingExclusion = next.enforceSiblingExclusion !== false;
  next.blockLevel2Allocation = !!next.blockLevel2Allocation;
  return next;
}

export function resolveAllocationRules(state, ruleModifiers = []) {
  const base = getProofCapacityFromState(state);
  const baseRules = Object.freeze({
    maxLevel1: base.level1,
    maxLevel2: base.level2,
    maxBlessingsPerPillar: 1,
    allowSamePillarDuplicates: false,
    enforceSiblingExclusion: true,
    blockLevel2Allocation: false
  });

  const appliedModifiers = [];
  let resolved = { ...baseRules };
  const modifiers = Array.isArray(ruleModifiers) ? ruleModifiers : [];
  for (const modifier of modifiers) {
    if (!modifier) {
      continue;
    }
    let nextRules = resolved;
    if (typeof modifier !== 'function') {
      nextRules = applyObjectRuleModifier(resolved, modifier);
      if (nextRules !== resolved) {
        appliedModifiers.push(modifier.id || modifier.effectKey || 'object_modifier');
      }
      resolved = nextRules;
      continue;
    }
    const fnResult = modifier({ ...resolved }, state);
    if (isObject(fnResult)) {
      if (
        Number.isFinite(fnResult.maxLevel1) ||
        Number.isFinite(fnResult.maxLevel2) ||
        Number.isFinite(fnResult.maxBlessingsPerPillar) ||
        typeof fnResult.allowSamePillarDuplicates === 'boolean' ||
        typeof fnResult.enforceSiblingExclusion === 'boolean' ||
        typeof fnResult.blockLevel2Allocation === 'boolean'
      ) {
        resolved = {
          maxLevel1: clampInteger(fnResult.maxLevel1, resolved.maxLevel1),
          maxLevel2: clampInteger(fnResult.maxLevel2, resolved.maxLevel2),
          maxBlessingsPerPillar: clampInteger(fnResult.maxBlessingsPerPillar, resolved.maxBlessingsPerPillar),
          allowSamePillarDuplicates: typeof fnResult.allowSamePillarDuplicates === 'boolean'
            ? fnResult.allowSamePillarDuplicates
            : !!resolved.allowSamePillarDuplicates,
          enforceSiblingExclusion: typeof fnResult.enforceSiblingExclusion === 'boolean'
            ? fnResult.enforceSiblingExclusion
            : resolved.enforceSiblingExclusion !== false,
          blockLevel2Allocation: typeof fnResult.blockLevel2Allocation === 'boolean'
            ? fnResult.blockLevel2Allocation
            : !!resolved.blockLevel2Allocation
        };
      } else {
        resolved = applyObjectRuleModifier(resolved, fnResult);
      }
      appliedModifiers.push(modifier.id || modifier.effectKey || 'function_modifier');
    }
  }

  return {
    baseRules: { ...baseRules },
    rules: {
      maxLevel1: clampInteger(resolved.maxLevel1, baseRules.maxLevel1),
      maxLevel2: clampInteger(resolved.maxLevel2, baseRules.maxLevel2),
      maxBlessingsPerPillar: clampInteger(resolved.maxBlessingsPerPillar, baseRules.maxBlessingsPerPillar),
      allowSamePillarDuplicates: !!resolved.allowSamePillarDuplicates,
      enforceSiblingExclusion: resolved.enforceSiblingExclusion !== false,
      blockLevel2Allocation: !!resolved.blockLevel2Allocation
    },
    appliedModifiers
  };
}

export function getAllocationRules(state, ruleModifiers = []) {
  return resolveAllocationRules(state, ruleModifiers).rules;
}

export function getAllocationTopologySummary(state, ruleModifiers = []) {
  const resolved = resolveAllocationRules(state, ruleModifiers);
  return {
    baseRules: resolved.baseRules,
    rules: resolved.rules,
    appliedModifiers: [...resolved.appliedModifiers]
  };
}

export function getTierCapacitySnapshot(state, ruleModifiers = []) {
  const resolved = resolveAllocationRules(state, ruleModifiers);
  const rules = resolved.rules;
  const allocated = getAllocatedCounts(state);
  return {
    maxLevel1: rules.maxLevel1,
    maxLevel2: rules.maxLevel2,
    maxBlessingsPerPillar: rules.maxBlessingsPerPillar,
    allowSamePillarDuplicates: !!rules.allowSamePillarDuplicates,
    enforceSiblingExclusion: rules.enforceSiblingExclusion !== false,
    blockLevel2Allocation: !!rules.blockLevel2Allocation,
    remainingLevel1: Math.max(0, rules.maxLevel1 - allocated.level1),
    remainingLevel2: Math.max(0, rules.maxLevel2 - allocated.level2),
    allocatedLevel1: allocated.level1,
    allocatedLevel2: allocated.level2,
    baseRules: resolved.baseRules,
    appliedRuleModifiers: resolved.appliedModifiers
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

export function getBlessingAllocationDiagnostics(state, blessingId, ruleModifiers = [], options = {}) {
  const blessing = getBlessingById(blessingId);
  if (!blessing) {
    return {
      allowed: false,
      reason: 'Unknown blessing.',
      reasons: ['Unknown blessing.'],
      details: 'not_found',
      snapshot: getTierCapacitySnapshot(state, ruleModifiers)
    };
  }

  if (!blessing.available) {
    return {
      allowed: false,
      reason: 'This blessing is currently locked.',
      reasons: ['This blessing is currently locked.'],
      details: 'locked_blessing',
      snapshot: getTierCapacitySnapshot(state, ruleModifiers)
    };
  }

  // Twisted Belief modifies topology once allocated, but allocation itself must still
  // respect the normal Level 2 proof gate (Proof of Resilience), same as other L2 blessings.
  if (blessing.effectKey === 'pillar.deep.twisted_belief') {
    const earnedProofIds = Array.isArray(state?.earnedProofIds) ? state.earnedProofIds : [];
    if (!earnedProofIds.includes('proof_resilience')) {
      const requiredProof = getProofRequirementForBlessingTier(BLESSING_TIER.LEVEL_2);
      return {
        allowed: false,
        reason: 'Proofs are required before a level 2 blessing can be allocated.',
        reasons: ['Proofs are required before a level 2 blessing can be allocated.'],
        details: 'tier2_blocked',
        requiredProofId: requiredProof?.id || null,
        requiredProofDisplayName: requiredProof?.displayName || null,
        snapshot: getTierCapacitySnapshot(state, ruleModifiers)
      };
    }
  }

  const currentAllocation = Array.isArray(state?.allocatedBlessingIds) ? state.allocatedBlessingIds : [];
  if (currentAllocation.includes(blessingId)) {
    return {
      allowed: false,
      reason: 'This blessing is already allocated.',
      reasons: ['This blessing is already allocated.'],
      details: 'duplicate',
      snapshot: getTierCapacitySnapshot(state, ruleModifiers)
    };
  }

  const includeIntrinsicCandidateModifier = options?.includeIntrinsicCandidateModifier !== false;
  const candidateModifier = includeIntrinsicCandidateModifier ? getIntrinsicTopologyModifierForBlessing(blessing) : null;
  const resolved = resolveAllocationRules(
    state,
    candidateModifier ? [...(Array.isArray(ruleModifiers) ? ruleModifiers : []), candidateModifier] : ruleModifiers
  );
  const rules = resolved.rules;
  const allocatedCounts = getAllocatedCounts(state);
  const allocatedPillarCounts = new Map();
  const allocatedBlessingsByPillar = new Map();
  for (const allocatedBlessingId of currentAllocation) {
    const allocatedBlessing = getBlessingById(allocatedBlessingId);
    if (!allocatedBlessing) {
      continue;
    }
    allocatedPillarCounts.set(
      allocatedBlessing.pillarId,
      (allocatedPillarCounts.get(allocatedBlessing.pillarId) || 0) + 1
    );
    const list = allocatedBlessingsByPillar.get(allocatedBlessing.pillarId) || [];
    list.push(allocatedBlessing.id);
    allocatedBlessingsByPillar.set(allocatedBlessing.pillarId, list);
  }
  const reasons = [];

  if (
    rules.allowSamePillarDuplicates !== true
    && rules.maxBlessingsPerPillar > 0
    && (allocatedPillarCounts.get(blessing.pillarId) || 0) >= rules.maxBlessingsPerPillar
  ) {
    reasons.push('Already selected another blessing from this Pillar.');
  }

  if (rules.enforceSiblingExclusion !== false) {
    const siblingIds = allocatedBlessingsByPillar.get(blessing.pillarId) || [];
    if (siblingIds.length > 0) {
      reasons.push('Sibling mutual exclusion is active for this Pillar.');
    }
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_1 && rules.maxLevel1 <= 0) {
    const requiredProof = getProofRequirementForBlessingTier(BLESSING_TIER.LEVEL_1);
    reasons.push('Proofs are required before a level 1 blessing can be allocated.');
    return {
      allowed: false,
      reason: reasons[0],
      reasons,
      details: 'tier1_blocked',
      requiredProofId: requiredProof?.id || null,
      requiredProofDisplayName: requiredProof?.displayName || null,
      rules,
      allocatedCounts,
      snapshot: getTierCapacitySnapshot(state, ruleModifiers),
      appliedRuleModifiers: resolved.appliedModifiers
    };
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_2 && rules.maxLevel2 <= 0) {
    const requiredProof = getProofRequirementForBlessingTier(BLESSING_TIER.LEVEL_2);
    reasons.push('Proofs are required before a level 2 blessing can be allocated.');
    return {
      allowed: false,
      reason: reasons[0],
      reasons,
      details: 'tier2_blocked',
      requiredProofId: requiredProof?.id || null,
      requiredProofDisplayName: requiredProof?.displayName || null,
      rules,
      allocatedCounts,
      snapshot: getTierCapacitySnapshot(state, ruleModifiers),
      appliedRuleModifiers: resolved.appliedModifiers
    };
  }

  if (
    blessing.tier === BLESSING_TIER.LEVEL_2
    && rules.blockLevel2Allocation === true
    && candidateModifier?.effectKey !== blessing.effectKey
  ) {
    reasons.push('Level 2 allocation is currently blocked by active topology rules.');
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_1 && allocatedCounts.level1 >= rules.maxLevel1) {
    reasons.push('Level 1 blessing capacity reached.');
  }

  if (blessing.tier === BLESSING_TIER.LEVEL_2 && allocatedCounts.level2 >= rules.maxLevel2) {
    reasons.push('Level 2 blessing capacity reached.');
  }

  if (reasons.length > 0) {
    let details = 'unknown_block';
    if (reasons.some((entry) => entry.includes('Pillar'))) details = 'pillar_full';
    else if (reasons.some((entry) => entry.includes('Sibling mutual exclusion'))) details = 'sibling_exclusion';
    else if (reasons.some((entry) => entry.includes('blocked by active topology'))) details = 'tier2_topology_block';
    else if (reasons.some((entry) => entry.includes('Level 1'))) details = 'tier1_full';
    else if (reasons.some((entry) => entry.includes('Level 2'))) details = 'tier2_full';
    return {
      allowed: false,
      reason: reasons[0],
      reasons,
      details,
      rules,
      allocatedCounts,
      snapshot: getTierCapacitySnapshot(state, ruleModifiers),
      appliedRuleModifiers: resolved.appliedModifiers
    };
  }

  return {
    allowed: true,
    reason: 'Can allocate blessing.',
    reasons: ['Can allocate blessing.'],
    details: 'ok',
    rules,
    allocatedCounts,
    snapshot: getTierCapacitySnapshot(state, ruleModifiers),
    appliedRuleModifiers: resolved.appliedModifiers
  };
}

export function canAllocateBlessing(state, blessingId, ruleModifiers = []) {
  return getBlessingAllocationDiagnostics(state, blessingId, ruleModifiers);
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
