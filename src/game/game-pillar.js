import {
  applyTrialSuccessProgression,
  canAllocateBlessing,
  canDeallocateBlessing,
  canStartTrial,
  getAllocationRules,
  isPillarAvailable,
  getAllPillarProofs,
  getAllocatedCounts,
  getNextProofForNextSuccess,
  grantAllProofs,
  loadPillarProgressState,
  normalizePillarProgressState,
  savePillarProgressState,
  getPillarProofById
} from '../systems/pillar-progress.js';
import { PILLAR_TRIAL_ENTRY_ITEM_ID, getAllPillars, getBlessingById } from '../data/pillars.js';
import { installPillarRuntime } from '../systems/pillar-runtime.js';

const PILLAR_SYSTEM_UI_EVENT = 'pillar-system-updated';
const PILLAR_SYSTEM_ALLOCATION_EVENT = 'pillars:allocation-changed';
const PILLAR_SYSTEM_TRIAL_EVENT = 'pillars:trial-complete';

function emitSystemEvent(game, type, detail = {}) {
  const event = new CustomEvent(type, { detail });
  window.dispatchEvent(event);
}

function getActiveBlessingIdsFromState(state) {
  return Array.isArray(state?.allocatedBlessingIds) ? [...state.allocatedBlessingIds] : [];
}

function getActiveEffectKeysFromState(state) {
  return getActiveBlessingIdsFromState(state)
    .map((blessingId) => {
      const blessing = getBlessingById(blessingId);
      return blessing?.effectKey;
    })
    .filter(Boolean);
}

function installRulesSnapshot(game) {
  const ruleModifiers = Array.isArray(game?.pillarAllocationRuleModifiers)
    ? game.pillarAllocationRuleModifiers
    : [];
  return getAllocationRules(game.pillarSystemState, ruleModifiers);
}

function createStatePayload(game) {
  const state = game.pillarSystemState || {};
  const allocationRules = installRulesSnapshot(game);
  return {
    ...state,
    allocationRules
  };
}

function dispatchStateChange(game) {
  savePillarProgressState(game.pillarSystemState);
  game.pillarActiveBlessingIds = getActiveBlessingIdsFromState(game.pillarSystemState);
  game.pillarActiveEffectKeys = getActiveEffectKeysFromState(game.pillarSystemState);
  emitSystemEvent(game, PILLAR_SYSTEM_UI_EVENT, createStatePayload(game));
}

function refreshAllocationHooks(game) {
  if (typeof game.syncPillarBlessings === 'function') {
    game.syncPillarBlessings('allocation_sync');
  }
}

export function installPillarSystem(game) {
  if (game.__pillarSystemInstalled) {
    return;
  }

  const allPillars = getAllPillars();
  game.pillarSystemState = normalizePillarProgressState(
    loadPillarProgressState(),
    allPillars.map((pillar) => pillar.id)
  );

  game.__pillarSystemInstalled = true;
  game.pillarAllocationRuleModifiers = [];

  game.getPillarSystemState = function getPillarSystemState() {
    return game.pillarSystemState;
  };

  game.getAvailablePillars = function getAvailablePillars() {
    return game.pillarSystemState.availablePillarIds || [];
  };

  game.getPillarTrialEntryItemId = function getPillarTrialEntryItemId() {
    return PILLAR_TRIAL_ENTRY_ITEM_ID;
  };

  game.getPillarProofs = function getPillarProofs() {
    return [...(game.pillarSystemState.earnedProofIds || [])];
  };

  game.getPillarAllocatedBlessings = function getPillarAllocatedBlessings() {
    return [...(game.pillarSystemState.allocatedBlessingIds || [])];
  };

  game.getPillarTrialItemCount = function getPillarTrialItemCount() {
    return Math.max(0, Number(game.pillarSystemState.trialEntryItemCount) || 0);
  };

  game.hasPillarTrialEntryItem = function hasPillarTrialEntryItem() {
    return game.getPillarTrialItemCount() > 0;
  };

  game.grantPillarTrialEntryItem = function grantPillarTrialEntryItem(count = 1) {
    game.pillarSystemState.trialEntryItemCount += Math.max(0, Number(count) || 0);
    dispatchStateChange(game);
    return { success: true, count: game.getPillarTrialItemCount() };
  };

  game.consumePillarTrialEntryItem = function consumePillarTrialEntryItem() {
    if (!game.hasPillarTrialEntryItem()) {
      return { success: false, reason: 'no_entry_item' };
    }
    game.pillarSystemState.trialEntryItemCount = Math.max(
      0,
      game.getPillarTrialItemCount() - 1
    );
    return { success: true };
  };

  game.getPillarAllocationSnapshot = function getPillarAllocationSnapshot() {
    const allocated = getAllocatedCounts(game.pillarSystemState);
    const rules = installRulesSnapshot(game);
    return {
      maxLevel1: rules.maxLevel1,
      maxLevel2: rules.maxLevel2,
      usedLevel1: allocated.level1,
      usedLevel2: allocated.level2,
      remainingLevel1: Math.max(0, rules.maxLevel1 - allocated.level1),
      remainingLevel2: Math.max(0, rules.maxLevel2 - allocated.level2),
      maxBlessingsPerPillar: rules.maxBlessingsPerPillar
    };
  };

  game.setPillarAllocationRuleModifiers = function setPillarAllocationRuleModifiers(overrides) {
    game.pillarAllocationRuleModifiers = Array.isArray(overrides) ? overrides : [];
    dispatchStateChange(game);
    refreshAllocationHooks(game);
    return game.pillarAllocationRuleModifiers;
  };

  game.getPillarAllocationRules = function getPillarAllocationRules() {
    return installRulesSnapshot(game);
  };

  game.canAllocatePillarBlessing = function canAllocatePillarBlessing(blessingId) {
    return canAllocateBlessing(game.pillarSystemState, blessingId, game.pillarAllocationRuleModifiers);
  };

  game.allocatePillarBlessing = function allocatePillarBlessing(blessingId) {
    const validation = canAllocateBlessing(game.pillarSystemState, blessingId, game.pillarAllocationRuleModifiers);
    if (!validation.allowed) {
      return { success: false, reason: validation.reason };
    }
    game.pillarSystemState.allocatedBlessingIds.push(blessingId);
    dispatchStateChange(game);
    emitSystemEvent(game, PILLAR_SYSTEM_ALLOCATION_EVENT, {
      allocated: game.getPillarAllocatedBlessings(),
      effectKeys: game.getActivePillarEffectKeys()
    });
    refreshAllocationHooks(game);
    return { success: true, blessingId };
  };

  game.canDeallocatePillarBlessing = function canDeallocatePillarBlessing(blessingId) {
    return canDeallocateBlessing(game.pillarSystemState, blessingId);
  };

  game.deallocatePillarBlessing = function deallocatePillarBlessing(blessingId) {
    const validation = canDeallocateBlessing(game.pillarSystemState, blessingId);
    if (!validation.allowed) {
      return { success: false, reason: validation.reason };
    }
    game.pillarSystemState.allocatedBlessingIds = game.pillarSystemState.allocatedBlessingIds.filter(
      (existingId) => existingId !== blessingId
    );
    dispatchStateChange(game);
    emitSystemEvent(game, PILLAR_SYSTEM_ALLOCATION_EVENT, {
      allocated: game.getPillarAllocatedBlessings(),
      effectKeys: game.getActivePillarEffectKeys()
    });
    refreshAllocationHooks(game);
    return { success: true, blessingId };
  };

  game.clearPillarAllocations = function clearPillarAllocations() {
    game.pillarSystemState.allocatedBlessingIds = [];
    dispatchStateChange(game);
    emitSystemEvent(game, PILLAR_SYSTEM_ALLOCATION_EVENT, {
      allocated: game.getPillarAllocatedBlessings(),
      effectKeys: game.getActivePillarEffectKeys()
    });
    refreshAllocationHooks(game);
    return { success: true };
  };

  game.getActivePillarBlessings = function getActivePillarBlessings() {
    const blessingIds = game.pillarSystemState.allocatedBlessingIds || [];
    return blessingIds.map((blessingId) => getBlessingById(blessingId)).filter(Boolean);
  };

  game.getActivePillarEffectKeys = function getActivePillarEffectKeys() {
    return [...new Set(game.pillarActiveEffectKeys || [])];
  };

  game.hasPillarBlessing = function hasPillarBlessing(blessingId) {
    return (game.pillarSystemState.allocatedBlessingIds || []).includes(blessingId);
  };

  game.getPillarTrialProgress = function getPillarTrialProgress() {
    const nextProof = getNextProofForNextSuccess(game.pillarSystemState);
    return {
      trialClearCount: game.pillarSystemState.trialClearCount,
      earnedProofs: [...game.pillarSystemState.earnedProofIds],
      nextProof
    };
  };

  game.canEnterPillarTrial = function canEnterPillarTrial(pillarId) {
    return canStartTrial(game.pillarSystemState, pillarId);
  };

  game.beginPillarTrial = function beginPillarTrial(pillarId) {
    const canEnter = canStartTrial(game.pillarSystemState, pillarId);
    if (!canEnter.allowed) {
      return { success: false, reason: canEnter.reason };
    }
    game.pillarSystemState.activeTrial = {
      pillarId,
      startedAt: Date.now()
    };
    dispatchStateChange(game);
    emitSystemEvent(game, 'pillars:trial-started', {
      pillarId
    });
    return { success: true, pillarId };
  };

  game.completePillarTrial = function completePillarTrial(pillarId) {
    if (!game.pillarSystemState.activeTrial || game.pillarSystemState.activeTrial.pillarId !== pillarId) {
      return { success: false, reason: 'No matching active pillar trial found.' };
    }
    const consumeResult = game.consumePillarTrialEntryItem();
    if (!consumeResult.success) {
      return {
        success: false,
        reason: 'Missing entry item for trial completion.',
        consumed: false
      };
    }
    const progression = applyTrialSuccessProgression(game.pillarSystemState);
    game.pillarSystemState.trialClearCount = progression.trialClearCount;
    game.pillarSystemState.earnedProofIds = progression.earnedProofIds;
    game.pillarSystemState.activeTrial = null;
    dispatchStateChange(game);
    emitSystemEvent(game, PILLAR_SYSTEM_TRIAL_EVENT, {
      pillarId,
      proof: progression.nextProofGranted,
      totalSuccesses: game.pillarSystemState.trialClearCount
    });
    refreshAllocationHooks(game);
    return {
      success: true,
      pillarId,
      proofGranted: progression.nextProofGranted,
      trialClearCount: game.pillarSystemState.trialClearCount
    };
  };

  game.failPillarTrial = function failPillarTrial(pillarId) {
    if (!game.pillarSystemState.activeTrial || game.pillarSystemState.activeTrial.pillarId !== pillarId) {
      return { success: false, reason: 'No matching active pillar trial found.' };
    }
    game.pillarSystemState.activeTrial = null;
    dispatchStateChange(game);
    emitSystemEvent(game, 'pillars:trial-failed', {
      pillarId
    });
    return { success: true, pillarId };
  };

  game.simulatePillarTrialSuccess = function simulatePillarTrialSuccess(pillarId) {
    const targetPillarId = pillarId || allPillars[0].id;
    if (!game.hasPillarTrialEntryItem()) {
      game.grantPillarTrialEntryItem(1);
    }
    const startResult = game.beginPillarTrial(targetPillarId);
    if (!startResult.success) {
      return startResult;
    }
    return game.completePillarTrial(targetPillarId);
  };

  game.simulatePillarTrialFailure = function simulatePillarTrialFailure(pillarId) {
    const targetPillarId = pillarId || allPillars[0].id;
    const startResult = game.canEnterPillarTrial(targetPillarId).allowed
      ? game.beginPillarTrial(targetPillarId)
      : { success: false, reason: 'No entry item for simulated failure.' };
    if (!startResult.success) {
      return startResult;
    }
    return game.failPillarTrial(targetPillarId);
  };

  game.grantAllPillarProofs = function grantAllPillarProofs() {
    const granted = grantAllProofs(game.pillarSystemState);
    game.pillarSystemState.earnedProofIds = granted.earnedProofIds;
    game.pillarSystemState.trialClearCount = granted.trialClearCount;
    dispatchStateChange(game);
    refreshAllocationHooks(game);
    return { success: true };
  };

  game.grantPillarProof = function grantPillarProof(proofId) {
    const proof = getPillarProofById(proofId);
    if (!proof) {
      return { success: false, reason: 'Unknown proof.' };
    }
    const earned = new Set(game.pillarSystemState.earnedProofIds || []);
    earned.add(proof.id);
    game.pillarSystemState.earnedProofIds = [...earned];
    game.pillarSystemState.trialClearCount = Math.max(
      game.pillarSystemState.trialClearCount || 0,
      proof.trialSuccessAtLeast || 0
    );
    dispatchStateChange(game);
    refreshAllocationHooks(game);
    return { success: true, proofId: proof.id };
  };

  game.clearPillarProofs = function clearPillarProofs() {
    game.pillarSystemState.earnedProofIds = [];
    game.pillarSystemState.trialClearCount = 0;
    game.pillarSystemState.allocatedBlessingIds = [];
    dispatchStateChange(game);
    emitSystemEvent(game, PILLAR_SYSTEM_ALLOCATION_EVENT, {
      allocated: game.getPillarAllocatedBlessings(),
      effectKeys: game.getActivePillarEffectKeys()
    });
    refreshAllocationHooks(game);
    return { success: true };
  };

  game.allocateFirstAvailablePillarBlessing = function allocateFirstAvailablePillarBlessing() {
    const blessings = getAllPillars().flatMap((pillar) => [...pillar.blessingsLevel1, ...pillar.blessingsLevel2]);
    for (const blessing of blessings) {
      if (game.hasPillarBlessing(blessing.id)) {
        continue;
      }
      const canAllocate = game.canAllocatePillarBlessing(blessing.id);
      if (canAllocate.allowed) {
        return game.allocatePillarBlessing(blessing.id);
      }
    }
    return { success: false, reason: 'No currently allocatable blessing found.' };
  };

  game.getPillarOverviewRows = function getPillarOverviewRows() {
    return getAllPillars().map((pillar) => {
      const allocatedCount = (game.pillarSystemState.allocatedBlessingIds || []).reduce((count, blessingId) => {
        const blessing = getBlessingById(blessingId);
        return blessing?.pillarId === pillar.id ? count + 1 : count;
      }, 0);
      return {
        ...pillar,
        allocatedCount,
        isLocked: !isPillarAvailable(game.pillarSystemState, pillar.id),
        blessings: [...pillar.blessingsLevel1, ...pillar.blessingsLevel2].map((blessing) => ({
          ...blessing,
          allocated: game.hasPillarBlessing(blessing.id)
        }))
      };
    });
  };

  game.getAllPillarProofEntries = function getAllPillarProofEntries() {
    return getAllPillarProofs();
  };

  game.setPillarUnlocked = function setPillarUnlocked(pillarId, unlocked = true) {
    const current = new Set(game.pillarSystemState.availablePillarIds || []);
    if (unlocked) {
      current.add(pillarId);
    } else {
      current.delete(pillarId);
    }
    game.pillarSystemState.availablePillarIds = [...current];
    dispatchStateChange(game);
    return { success: true, available: [...current] };
  };

  installPillarRuntime(game);
  game.getPillarRuntimeDebugSummary = game.getPillarRuntimeDebugSummary || (() => ({}));

  // Persisted state bootstrap.
  dispatchStateChange(game);
  refreshAllocationHooks(game);
}
