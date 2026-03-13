import {
  getAllRites,
  getRiteById,
  getRiteEntryItemCost,
  RITE_ENTRY_ITEM_DISPLAY_NAME,
  toLegacyProofId
} from '../data/rites.js';

function normalizeSet(values) {
  return new Set(Array.isArray(values) ? values.map((entry) => String(entry || '')).filter(Boolean) : []);
}

function formatEntryItemRequirement(requiredCount) {
  const count = Math.max(1, Number(requiredCount) || 1);
  return `${count}x ${RITE_ENTRY_ITEM_DISPLAY_NAME}`;
}

function ensureRiteProgress(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }
  if (!state.riteProgress || typeof state.riteProgress !== 'object') {
    state.riteProgress = {
      unlockedRiteIds: ['rite_of_fear'],
      completedRiteIds: [],
      grantedProofByRiteId: {},
      activeRite: null,
      lastResult: null,
      debug: {
        unlockAllRites: false
      }
    };
  }
  return state.riteProgress;
}

export function getRiteEntryItemCount(state) {
  return Math.max(
    0,
    Number(state?.riteEntryItemCount ?? state?.trialEntryItemCount) || 0
  );
}

export function setRiteEntryItemCount(state, count) {
  const next = Math.max(0, Number(count) || 0);
  state.riteEntryItemCount = next;
  state.trialEntryItemCount = next;
  return next;
}

export function buildRiteProgressSummary(state) {
  const progress = ensureRiteProgress(state);
  if (!progress) {
    return {
      unlockedRiteIds: [],
      completedRiteIds: [],
      grantedProofByRiteId: {},
      activeRite: null,
      lastResult: null,
      entryItemCount: 0
    };
  }
  return {
    unlockedRiteIds: [...normalizeSet(progress.unlockedRiteIds)],
    completedRiteIds: [...normalizeSet(progress.completedRiteIds)],
    grantedProofByRiteId: { ...(progress.grantedProofByRiteId || {}) },
    activeRite: progress.activeRite ? { ...progress.activeRite } : null,
    lastResult: progress.lastResult ? { ...progress.lastResult } : null,
    entryItemCount: getRiteEntryItemCount(state)
  };
}

export function canEnterRite(state, riteId, options = {}) {
  const rite = getRiteById(riteId);
  if (!rite) {
    return { allowed: false, reason: 'Unknown Rite.' };
  }

  const progress = ensureRiteProgress(state);
  const unlocked = normalizeSet(progress.unlockedRiteIds);
  const completed = normalizeSet(progress.completedRiteIds);
  const grantedProofByRiteId = progress.grantedProofByRiteId || {};
  const allowRepeat = options.allowRepeat === true;
  const entryItemCount = getRiteEntryItemCount(state);
  const requiredEntryItemCount = getRiteEntryItemCost(rite);

  if (progress.activeRite?.riteId) {
    return { allowed: false, reason: 'A Rite is already active.' };
  }

  if (!unlocked.has(rite.id)) {
    return { allowed: false, reason: 'This Rite is locked.' };
  }

  if (entryItemCount < requiredEntryItemCount) {
    return {
      allowed: false,
      reason: `Requires ${formatEntryItemRequirement(requiredEntryItemCount)}.`,
      requiredEntryItemCount,
      ownedEntryItemCount: entryItemCount
    };
  }

  if (!allowRepeat && (completed.has(rite.id) || grantedProofByRiteId[rite.id])) {
    return { allowed: false, reason: 'This Rite has already granted its Proof.' };
  }

  return {
    allowed: true,
    reason: 'Can enter Rite.',
    requiredEntryItemCount,
    ownedEntryItemCount: entryItemCount
  };
}

export function beginRite(state, riteId) {
  const validation = canEnterRite(state, riteId);
  if (!validation.allowed) {
    return { success: false, reason: validation.reason };
  }
  const rite = getRiteById(riteId);
  const progress = ensureRiteProgress(state);
  progress.activeRite = {
    riteId: rite.id,
    startedAt: Date.now(),
    controllerKey: rite.controllerKey || null
  };
  return { success: true, rite };
}

export function failRite(state, riteId, reason = 'failed') {
  const progress = ensureRiteProgress(state);
  const activeRiteId = progress.activeRite?.riteId || null;
  const targetRiteId = String(riteId || activeRiteId || '');
  if (!targetRiteId || activeRiteId !== targetRiteId) {
    return { success: false, reason: 'No matching active Rite.' };
  }
  progress.activeRite = null;
  progress.lastResult = {
    riteId: targetRiteId,
    result: 'failure',
    reason: String(reason || 'failed'),
    at: Date.now()
  };
  return { success: true, riteId: targetRiteId };
}

export function completeRiteSuccess(state, riteId) {
  const progress = ensureRiteProgress(state);
  const activeRiteId = progress.activeRite?.riteId || null;
  const targetRiteId = String(riteId || activeRiteId || '');
  const rite = getRiteById(targetRiteId);
  if (!rite || activeRiteId !== targetRiteId) {
    return { success: false, reason: 'No matching active Rite.' };
  }

  const currentCount = getRiteEntryItemCount(state);
  const entryItemCost = getRiteEntryItemCost(rite);
  if (currentCount < entryItemCost) {
    return {
      success: false,
      reason: `Missing ${formatEntryItemRequirement(entryItemCost)}.`,
      requiredEntryItemCount: entryItemCost,
      ownedEntryItemCount: currentCount
    };
  }

  const completed = normalizeSet(progress.completedRiteIds);
  if (completed.has(targetRiteId) || progress.grantedProofByRiteId?.[targetRiteId]) {
    progress.activeRite = null;
    return { success: false, reason: 'Proof already granted for this Rite.' };
  }

  completed.add(targetRiteId);
  progress.completedRiteIds = [...completed];
  progress.grantedProofByRiteId = {
    ...(progress.grantedProofByRiteId || {}),
    [targetRiteId]: rite.proofRewardId
  };
  setRiteEntryItemCount(state, currentCount - entryItemCost);

  const orderedRites = getAllRites()
    .slice()
    .sort((a, b) => (Number(a.unlockOrder) || 0) - (Number(b.unlockOrder) || 0));
  const nextRite = orderedRites.find((entry) => !completed.has(entry.id));
  const unlocked = normalizeSet(progress.unlockedRiteIds);
  if (nextRite) {
    unlocked.add(nextRite.id);
  }
  progress.unlockedRiteIds = [...unlocked];

  progress.activeRite = null;
  progress.lastResult = {
    riteId: targetRiteId,
    result: 'success',
    proofRewardId: rite.proofRewardId,
    at: Date.now()
  };

  return {
    success: true,
    riteId: targetRiteId,
    proofRewardId: rite.proofRewardId,
    legacyProofRewardId: toLegacyProofId(rite.proofRewardId),
    consumedEntryItemCount: entryItemCost
  };
}

export function completeRiteFailure(state, riteId, reason = 'failed') {
  return failRite(state, riteId, reason);
}

export function unlockAllRites(state) {
  const progress = ensureRiteProgress(state);
  progress.unlockedRiteIds = getAllRites().map((rite) => rite.id);
  progress.debug = {
    ...(progress.debug || {}),
    unlockAllRites: true
  };
  return [...progress.unlockedRiteIds];
}

export function setRiteCompleted(state, riteId, completed = true) {
  const rite = getRiteById(riteId);
  if (!rite) {
    return { success: false, reason: 'Unknown Rite.' };
  }
  const progress = ensureRiteProgress(state);
  const completedSet = normalizeSet(progress.completedRiteIds);
  const granted = { ...(progress.grantedProofByRiteId || {}) };
  if (completed) {
    completedSet.add(rite.id);
    granted[rite.id] = rite.proofRewardId;
  } else {
    completedSet.delete(rite.id);
    delete granted[rite.id];
  }
  progress.completedRiteIds = [...completedSet];
  progress.grantedProofByRiteId = granted;
  return { success: true, riteId: rite.id, completed };
}
