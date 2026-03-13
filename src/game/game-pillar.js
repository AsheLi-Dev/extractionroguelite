import {
  applyTrialSuccessProgression,
  canAllocateBlessing,
  canDeallocateBlessing,
  canStartTrial,
  getAllocationRules,
  getAllocationTopologySummary,
  getBlessingAllocationDiagnostics,
  isPillarAvailable,
  getAllPillarProofs,
  getAllocatedCounts,
  getNextProofForNextSuccess,
  grantAllProofs,
  loadPillarProgressState,
  normalizePillarProgressState,
  savePillarProgressState,
  getPillarProofById,
  getRiteProgressFromState
} from '../systems/pillar-progress.js';
import { PILLAR_TRIAL_ENTRY_ITEM_ID, getAllPillars, getBlessingById } from '../data/pillars.js';
import { installPillarRuntime } from '../systems/pillar-runtime.js';
import {
  getAllRites,
  getRiteById,
  getRiteEntryItemCost,
  RITE_ENTRY_ITEM_CATEGORY,
  RITE_ENTRY_ITEM_DISPLAY_NAME,
  RITE_ENTRY_ITEM_PRECIOUS_ID,
  toLegacyProofId
} from '../data/rites.js';
import {
  beginRite,
  buildRiteProgressSummary,
  canEnterRite,
  completeRiteFailure,
  completeRiteSuccess,
  getRiteEntryItemCount,
  setRiteCompleted,
  setRiteEntryItemCount,
  unlockAllRites
} from '../systems/rite-system.js';
import { RiteRuntimeController } from '../systems/rite-runtime.js';

const PILLAR_SYSTEM_UI_EVENT = 'pillar-system-updated';
const PILLAR_SYSTEM_ALLOCATION_EVENT = 'pillars:allocation-changed';
const PILLAR_SYSTEM_TRIAL_EVENT = 'pillars:trial-complete';
const PILLAR_SYSTEM_RITE_EVENT = 'pillars:rite-updated';

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

function getCombinedAllocationRuleModifiers(game) {
  const localModifiers = Array.isArray(game?.pillarAllocationRuleModifiers)
    ? game.pillarAllocationRuleModifiers
    : [];
  const runtimeModifiers =
    typeof game?.getPillarRuntimeAllocationRuleModifiers === 'function'
      ? game.getPillarRuntimeAllocationRuleModifiers()
      : [];
  return [...localModifiers, ...runtimeModifiers];
}

function installRulesSnapshot(game) {
  const ruleModifiers = getCombinedAllocationRuleModifiers(game);
  return getAllocationRules(game.pillarSystemState, ruleModifiers);
}

function createStatePayload(game) {
  const state = game.pillarSystemState || {};
  const allocationRules = installRulesSnapshot(game);
  return {
    ...state,
    allocationRules,
    riteRuntime: game.riteRuntimeController?.getActiveRiteSummary?.() || null
  };
}

function dispatchStateChange(game) {
  const riteItemCount = getRiteEntryItemCount(game.pillarSystemState);
  game.pillarSystemState.riteEntryItemCount = riteItemCount;
  game.pillarSystemState.trialEntryItemCount = riteItemCount;
  game.pillarSystemState.riteProgress = getRiteProgressFromState(game.pillarSystemState);
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

function dispatchRiteStateChange(game, reason = 'rite_state_changed') {
  const progress = buildRiteProgressSummary(game.pillarSystemState);
  emitSystemEvent(game, PILLAR_SYSTEM_RITE_EVENT, {
    reason,
    progress,
    runtime: game.riteRuntimeController?.getActiveRiteSummary?.() || null
  });
}

function getDefaultRiteForTrialBridge(game) {
  const progress = buildRiteProgressSummary(game.pillarSystemState);
  const completed = new Set(progress.completedRiteIds || []);
  return getAllRites()
    .slice()
    .sort((a, b) => (Number(a.unlockOrder) || 0) - (Number(b.unlockOrder) || 0))
    .find((rite) => !completed.has(rite.id)) || getAllRites()[0] || null;
}

export function installPillarSystem(game) {
  if (game.__pillarSystemInstalled) {
    return;
  }

  const allPillars = getAllPillars();
  const allPillarIds = allPillars.map((pillar) => pillar.id);
  const loadResult = loadPillarProgressState(allPillarIds, { withReport: true });
  game.pillarSystemState = normalizePillarProgressState(loadResult.state, allPillarIds);
  game.pillarSaveMigrationReport = loadResult.report || null;

  game.__pillarSystemInstalled = true;
  game.pillarAllocationRuleModifiers = [];
  game.riteHandlers = game.riteHandlers || {};
  game.riteRuntimeController = new RiteRuntimeController({ handlers: game.riteHandlers });
  game.pillarSystemState.riteProgress = getRiteProgressFromState(game.pillarSystemState);
  setRiteEntryItemCount(game.pillarSystemState, getRiteEntryItemCount(game.pillarSystemState));

  game.registerRiteRuntimeHandler = function registerRiteRuntimeHandler(controllerKey, handler) {
    if (!controllerKey || !handler || typeof handler !== 'object') {
      return { success: false, reason: 'invalid_handler' };
    }
    game.riteHandlers[String(controllerKey)] = handler;
    return { success: true, controllerKey: String(controllerKey) };
  };

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
    return getRiteEntryItemCount(game.pillarSystemState);
  };

  game.getRiteEntryItemCount = function getRiteEntryItemCountView() {
    return getRiteEntryItemCount(game.pillarSystemState);
  };

  game.hasPillarTrialEntryItem = function hasPillarTrialEntryItem() {
    return game.getPillarTrialItemCount() > 0;
  };

  game.grantPillarTrialEntryItem = function grantPillarTrialEntryItem(count = 1) {
    const nextCount = game.getPillarTrialItemCount() + Math.max(0, Number(count) || 0);
    setRiteEntryItemCount(game.pillarSystemState, nextCount);
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'entry_item_granted');
    return { success: true, count: game.getPillarTrialItemCount() };
  };

  game.consumePillarTrialEntryItem = function consumePillarTrialEntryItem() {
    if (!game.hasPillarTrialEntryItem()) {
      return { success: false, reason: 'no_entry_item' };
    }
    setRiteEntryItemCount(game.pillarSystemState, game.getPillarTrialItemCount() - 1);
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
      maxBlessingsPerPillar: rules.maxBlessingsPerPillar,
      allowSamePillarDuplicates: !!rules.allowSamePillarDuplicates,
      enforceSiblingExclusion: rules.enforceSiblingExclusion !== false,
      blockLevel2Allocation: !!rules.blockLevel2Allocation
    };
  };

  game.getPillarAllocationTopologySummary = function getPillarAllocationTopologySummary() {
    return getAllocationTopologySummary(game.pillarSystemState, getCombinedAllocationRuleModifiers(game));
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

  game.getPillarBlessingAllocability = function getPillarBlessingAllocability(blessingId) {
    return getBlessingAllocationDiagnostics(
      game.pillarSystemState,
      blessingId,
      getCombinedAllocationRuleModifiers(game)
    );
  };

  game.canAllocatePillarBlessing = function canAllocatePillarBlessing(blessingId) {
    return canAllocateBlessing(
      game.pillarSystemState,
      blessingId,
      getCombinedAllocationRuleModifiers(game)
    );
  };

  game.allocatePillarBlessing = function allocatePillarBlessing(blessingId) {
    const validation = canAllocateBlessing(
      game.pillarSystemState,
      blessingId,
      getCombinedAllocationRuleModifiers(game)
    );
    if (!validation.allowed) {
      return { success: false, reason: validation.reason, reasons: validation.reasons || [] };
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

  game.getRiteRegistryEntries = function getRiteRegistryEntries() {
    return getAllRites();
  };

  game.getRiteProgress = function getRiteProgress() {
    return buildRiteProgressSummary(game.pillarSystemState);
  };

  game.getRiteById = function getRiteByIdView(riteId) {
    return getRiteById(riteId);
  };

  game.getRiteEntryItemCost = function getRiteEntryItemCostView(riteId) {
    return getRiteEntryItemCost(riteId);
  };

  game.getRiteEntryItemDisplayName = function getRiteEntryItemDisplayNameView() {
    return RITE_ENTRY_ITEM_DISPLAY_NAME;
  };

  game.getRiteEntryItemCategory = function getRiteEntryItemCategoryView() {
    return RITE_ENTRY_ITEM_CATEGORY;
  };

  game.canEnterRite = function canEnterRiteView(riteId) {
    return canEnterRite(game.pillarSystemState, riteId);
  };

  game.beginRite = function beginRiteFlow(riteId) {
    const result = beginRite(game.pillarSystemState, riteId);
    if (!result.success) {
      return result;
    }
    const rite = result.rite;
    game.riteRuntimeController.startRite(rite.id, {
      objectiveText: `Complete ${rite.displayName}.`,
      stageIndex: 0,
      metadata: { modeType: rite.modeType, controllerKey: rite.controllerKey }
    });
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'rite_started');
    emitSystemEvent(game, 'pillars:rite-started', {
      riteId: rite.id,
      riteDisplayName: rite.displayName
    });
    return {
      success: true,
      riteId: rite.id,
      controllerKey: rite.controllerKey
    };
  };

  game.failRite = function failRiteFlow(riteId, reason = 'failed') {
    const result = completeRiteFailure(game.pillarSystemState, riteId, reason);
    if (!result.success) {
      return result;
    }
    game.riteRuntimeController.endRiteFailure({ reason });
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'rite_failed');
    emitSystemEvent(game, 'pillars:rite-failed', {
      riteId: result.riteId,
      reason
    });
    return result;
  };

  game.completeRiteSuccess = function completeRiteSuccessFlow(riteId) {
    const result = completeRiteSuccess(game.pillarSystemState, riteId);
    if (!result.success) {
      return result;
    }
    const proofId = result.legacyProofRewardId || toLegacyProofId(result.proofRewardId);
    const proofSet = new Set(game.pillarSystemState.earnedProofIds || []);
    proofSet.add(proofId);
    game.pillarSystemState.earnedProofIds = [...proofSet];
    const completedRiteCount = buildRiteProgressSummary(game.pillarSystemState).completedRiteIds.length;
    game.pillarSystemState.trialClearCount = Math.max(
      Number(game.pillarSystemState.trialClearCount) || 0,
      completedRiteCount
    );
    const consumedEntryItemCount = Math.max(0, Number(result.consumedEntryItemCount) || 0);
    if (consumedEntryItemCount > 0 && Array.isArray(game.inventory) && game.inventory.length > 0) {
      let remainingToConsume = consumedEntryItemCount;
      game.inventory = game.inventory.filter((item) => {
        if (remainingToConsume <= 0) return true;
        const isBloodOfTheLamb =
          item?.preciousId === RITE_ENTRY_ITEM_PRECIOUS_ID
          || (item?.category === RITE_ENTRY_ITEM_CATEGORY && item?.name === RITE_ENTRY_ITEM_DISPLAY_NAME);
        if (!isBloodOfTheLamb) return true;
        remainingToConsume -= 1;
        return false;
      });
      if (remainingToConsume < consumedEntryItemCount && typeof game.updateInventoryUI === 'function') {
        game.updateInventoryUI();
      }
    }
    game.riteRuntimeController.endRiteSuccess({ proofRewardId: result.proofRewardId });
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'rite_success');
    emitSystemEvent(game, 'pillars:rite-success', {
      riteId: result.riteId,
      proofRewardId: result.proofRewardId,
      legacyProofRewardId: proofId
    });
    refreshAllocationHooks(game);
    return {
      success: true,
      riteId: result.riteId,
      proofRewardId: result.proofRewardId,
      legacyProofRewardId: proofId,
      consumedEntryItemCount: consumedEntryItemCount
    };
  };

  game.completeRiteFailure = function completeRiteFailureFlow(riteId, reason = 'failed') {
    return game.failRite(riteId, reason);
  };

  game.consumeRiteEntryItemOnSuccess = function consumeRiteEntryItemOnSuccessFlow() {
    return game.consumePillarTrialEntryItem();
  };

  game.updateRiteRuntime = function updateRiteRuntime(dt = 0) {
    return game.riteRuntimeController.updateRite(Math.max(0, Number(dt) || 0), { game });
  };

  game.setRiteObjective = function setRiteObjective(text) {
    return game.riteRuntimeController.setRiteObjective(text);
  };

  game.advanceRiteStage = function advanceRiteStage(step = 1) {
    return game.riteRuntimeController.advanceRiteStage(step);
  };

  game.setRiteStage = function setRiteStage(index, stageState = 'stage_active') {
    return game.riteRuntimeController.setRiteStage(index, stageState);
  };

  game.setRiteStageState = function setRiteStageState(stageState) {
    return game.riteRuntimeController.setStageState(stageState);
  };

  game.setRiteFloor = function setRiteFloor(index, floorDirection = null, floorTheme = null) {
    return game.riteRuntimeController.setRiteFloor(index, floorDirection, floorTheme);
  };

  game.setRiteFloorObjective = function setRiteFloorObjective(text) {
    return game.riteRuntimeController.setFloorObjective(text);
  };

  game.beginRiteDescent = function beginRiteDescent(startFloor = null) {
    return game.riteRuntimeController.beginDescent(startFloor);
  };

  game.beginRiteAscent = function beginRiteAscent(startFloor = null) {
    return game.riteRuntimeController.beginAscent(startFloor);
  };

  game.getActiveRiteSummary = function getActiveRiteSummary() {
    return game.riteRuntimeController.getActiveRiteSummary();
  };

  game.canEnterPillarTrial = function canEnterPillarTrial(pillarId) {
    return canStartTrial(game.pillarSystemState, pillarId);
  };

  game.beginPillarTrial = function beginPillarTrial(pillarId) {
    const canEnter = canStartTrial(game.pillarSystemState, pillarId);
    if (!canEnter.allowed) {
      return { success: false, reason: canEnter.reason };
    }
    const bridgedRite = getDefaultRiteForTrialBridge(game);
    if (bridgedRite) {
      const riteResult = game.beginRite(bridgedRite.id);
      if (!riteResult.success) {
        return riteResult;
      }
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
    const activeRiteId = game.getActiveRiteSummary()?.activeRiteId || null;
    let consumedByRiteFlow = false;
    if (activeRiteId) {
      const riteResult = game.completeRiteSuccess(activeRiteId);
      if (!riteResult.success) {
        return riteResult;
      }
      consumedByRiteFlow = true;
    }
    if (!consumedByRiteFlow) {
      const consumeResult = game.consumePillarTrialEntryItem();
      if (!consumeResult.success) {
        return {
          success: false,
          reason: 'Missing entry item for trial completion.',
          consumed: false
        };
      }
    }
    const progression = consumedByRiteFlow
      ? {
        trialClearCount: game.pillarSystemState.trialClearCount,
        nextProofGranted: null,
        earnedProofIds: [...(game.pillarSystemState.earnedProofIds || [])]
      }
      : applyTrialSuccessProgression(game.pillarSystemState);
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
    const activeRiteId = game.getActiveRiteSummary()?.activeRiteId || null;
    if (activeRiteId) {
      game.completeRiteFailure(activeRiteId, 'trial_failure_bridge');
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

  game.grantRiteEntryItem = function grantRiteEntryItem(count = 1) {
    return game.grantPillarTrialEntryItem(count);
  };

  game.removeRiteEntryItem = function removeRiteEntryItem(count = 1) {
    const nextCount = Math.max(0, game.getRiteEntryItemCount() - Math.max(0, Number(count) || 0));
    setRiteEntryItemCount(game.pillarSystemState, nextCount);
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'entry_item_removed');
    return { success: true, count: nextCount };
  };

  game.unlockAllRites = function unlockAllRitesFlow() {
    const unlockedRiteIds = unlockAllRites(game.pillarSystemState);
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'rites_unlocked');
    return { success: true, unlockedRiteIds };
  };

  game.markRiteCompleted = function markRiteCompleted(riteId) {
    const result = setRiteCompleted(game.pillarSystemState, riteId, true);
    if (!result.success) return result;
    const rite = getRiteById(riteId);
    const proofId = toLegacyProofId(rite?.proofRewardId);
    if (proofId) {
      const earned = new Set(game.pillarSystemState.earnedProofIds || []);
      earned.add(proofId);
      game.pillarSystemState.earnedProofIds = [...earned];
    }
    game.pillarSystemState.trialClearCount = Math.max(
      Number(game.pillarSystemState.trialClearCount) || 0,
      buildRiteProgressSummary(game.pillarSystemState).completedRiteIds.length
    );
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'rite_marked_completed');
    refreshAllocationHooks(game);
    return { success: true, riteId };
  };

  game.clearRiteCompletion = function clearRiteCompletion(riteId) {
    const result = setRiteCompleted(game.pillarSystemState, riteId, false);
    if (!result.success) return result;
    const rite = getRiteById(riteId);
    const proofId = toLegacyProofId(rite?.proofRewardId);
    if (proofId) {
      game.pillarSystemState.earnedProofIds = (game.pillarSystemState.earnedProofIds || [])
        .filter((id) => id !== proofId);
    }
    game.pillarSystemState.trialClearCount = buildRiteProgressSummary(game.pillarSystemState).completedRiteIds.length;
    dispatchStateChange(game);
    dispatchRiteStateChange(game, 'rite_cleared');
    refreshAllocationHooks(game);
    return { success: true, riteId };
  };

  game.jumpToRite = function jumpToRite(riteId) {
    const rite = getRiteById(riteId);
    if (!rite) return { success: false, reason: 'Unknown Rite.' };
    unlockAllRites(game.pillarSystemState);
    const requiredCost = getRiteEntryItemCost(rite);
    const missing = Math.max(0, requiredCost - game.getPillarTrialItemCount());
    if (missing > 0) {
      game.grantPillarTrialEntryItem(missing);
    }
    return game.beginRite(rite.id);
  };

  game.forceRiteSuccess = function forceRiteSuccess(riteId = null) {
    const activeRiteId = riteId || game.getActiveRiteSummary()?.activeRiteId || null;
    if (!activeRiteId) {
      return { success: false, reason: 'No active Rite to complete.' };
    }
    return game.completeRiteSuccess(activeRiteId);
  };

  game.forceRiteFailure = function forceRiteFailure(riteId = null) {
    const activeRiteId = riteId || game.getActiveRiteSummary()?.activeRiteId || null;
    if (!activeRiteId) {
      return { success: false, reason: 'No active Rite to fail.' };
    }
    return game.completeRiteFailure(activeRiteId, 'forced_failure');
  };

  game.getRiteDebugSummary = function getRiteDebugSummary() {
    const progress = game.getRiteProgress();
    return {
      registry: game.getRiteRegistryEntries().map((rite) => ({
        id: rite.id,
        level: rite.level,
        modeType: rite.modeType,
        entryItemCost: getRiteEntryItemCost(rite),
        proofRewardId: rite.proofRewardId,
        legacyProofRewardId: toLegacyProofId(rite.proofRewardId),
        controllerKey: rite.controllerKey
      })),
      progression: progress,
      entryItemCount: game.getRiteEntryItemCount(),
      activeRuntime: game.getActiveRiteSummary(),
      fearRite: typeof game.getFearRiteDebugSummary === 'function'
        ? game.getFearRiteDebugSummary()
        : null,
      monstrosityRite: typeof game.getMonstrosityDebugSummary === 'function'
        ? game.getMonstrosityDebugSummary()
        : null,
      tormentRite: typeof game.getTormentDebugSummary === 'function'
        ? game.getTormentDebugSummary()
        : null,
      sovereignRite: typeof game.getSovereignDebugSummary === 'function'
        ? game.getSovereignDebugSummary()
        : null,
      blockedByRite: game.getRiteRegistryEntries().reduce((acc, rite) => {
        const validation = game.canEnterRite(rite.id);
        if (!validation.allowed) {
          acc[rite.id] = validation.reason;
        }
        return acc;
      }, {})
    };
  };

  game.logRiteRuntimeSummary = function logRiteRuntimeSummary() {
    const summary = game.getRiteDebugSummary();
    console.log('[RiteRuntime] Summary:', summary);
    return summary;
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

  game.debugGetPillarSaveMigrationReport = function debugGetPillarSaveMigrationReport() {
    return game.pillarSaveMigrationReport || null;
  };

  game.debugRunPillarValidationSuite = function debugRunPillarValidationSuite() {
    const results = [];
    const assert = (id, passed, detail = '') => {
      results.push({ id, passed: !!passed, detail });
    };

    const stateBackup = JSON.parse(JSON.stringify(game.pillarSystemState || {}));
    const timeBackup = Number(game.time) || 0;
    const healthBackup = Number(game.currentHealth) || 0;
    const inventoryBackup = Array.isArray(game.inventory) ? [...game.inventory] : [];
    const equipmentBackup = game.equipment ? JSON.parse(JSON.stringify(game.equipment)) : null;
    const cooldownBackup = Array.isArray(game.skillCooldowns) ? [...game.skillCooldowns] : [];
    const maxChargeBackup = Array.isArray(game.skillMaxCharges) ? [...game.skillMaxCharges] : [];
    const currentChargeBackup = Array.isArray(game.skillCurrentCharges) ? [...game.skillCurrentCharges] : [];
    const skillsBackup = Array.isArray(game.skills) ? [...game.skills] : [];
    const grantXPBackup = game.grantXP;
    const runPillarEventBackup = game.runPillarEvent;
    const resolvePillarStackGainBackup = game.resolvePillarStackGain;

    const restore = () => {
      game.pillarSystemState = normalizePillarProgressState(stateBackup, allPillarIds);
      game.time = timeBackup;
      game.currentHealth = healthBackup;
      game.inventory = inventoryBackup;
      if (equipmentBackup && typeof equipmentBackup === 'object') {
        game.equipment = equipmentBackup;
      }
      if (cooldownBackup.length > 0) game.skillCooldowns = cooldownBackup;
      if (maxChargeBackup.length > 0) game.skillMaxCharges = maxChargeBackup;
      if (currentChargeBackup.length > 0) game.skillCurrentCharges = currentChargeBackup;
      if (skillsBackup.length > 0) game.skills = skillsBackup;
      game.grantXP = grantXPBackup;
      game.runPillarEvent = runPillarEventBackup;
      game.resolvePillarStackGain = resolvePillarStackGainBackup;
      dispatchStateChange(game);
      refreshAllocationHooks(game);
    };

    try {
      const migrated = normalizePillarProgressState(
        {
          trialClearCount: 2,
          earnedProofIds: ['proof_courage', 'proof_strength', 'proof_strength'],
          allocatedBlessingIds: ['the_void_cold_step', 'the_void_cold_step', 'invalid_blessing']
        },
        allPillarIds
      );
      assert(
        'save_sanitization',
        migrated.allocatedBlessingIds.includes('pillar.void.skill_singularity') &&
          migrated.allocatedBlessingIds.length === 1,
        `allocated=${JSON.stringify(migrated.allocatedBlessingIds)}`
      );

      const registryPillars = getAllPillars();
      const registryBlessings = registryPillars.flatMap((pillar) => [
        ...(Array.isArray(pillar?.blessingsLevel1) ? pillar.blessingsLevel1 : []),
        ...(Array.isArray(pillar?.blessingsLevel2) ? pillar.blessingsLevel2 : [])
      ]);
      const blessingIds = registryBlessings.map((blessing) => blessing?.id).filter(Boolean);
      const uniqueBlessingIds = new Set(blessingIds);
      const orphanBlessings = registryBlessings.filter((blessing) => {
        const owner = registryPillars.find((pillar) => pillar.id === blessing?.pillarId);
        return !owner;
      });
      const pillarCountValid = registryPillars.length === 8;
      const perPillarValid = registryPillars.every((pillar) => {
        const level1 = Array.isArray(pillar?.blessingsLevel1) ? pillar.blessingsLevel1.length : 0;
        const level2 = Array.isArray(pillar?.blessingsLevel2) ? pillar.blessingsLevel2.length : 0;
        const total = level1 + level2;
        return level1 === 2 && level2 === 2 && total === 4;
      });
      const effectRegistrationKnown = registryBlessings.every((blessing) => {
        const effectKey = blessing?.effectKey;
        if (!effectKey || typeof game.getPillarEffectImplementationStatus !== 'function') {
          return false;
        }
        return game.getPillarEffectImplementationStatus(effectKey)?.unknown !== true;
      });

      assert('pillar_registry_count', pillarCountValid, `count=${registryPillars.length}`);
      assert('pillar_registry_tier_split', perPillarValid, JSON.stringify(registryPillars.map((pillar) => ({
        id: pillar.id,
        level1: Array.isArray(pillar?.blessingsLevel1) ? pillar.blessingsLevel1.length : 0,
        level2: Array.isArray(pillar?.blessingsLevel2) ? pillar.blessingsLevel2.length : 0
      }))));
      assert('pillar_registry_total_blessings', registryBlessings.length === 32, `count=${registryBlessings.length}`);
      assert('pillar_registry_unique_ids', uniqueBlessingIds.size === blessingIds.length, `unique=${uniqueBlessingIds.size}, total=${blessingIds.length}`);
      assert('pillar_registry_no_orphans', orphanBlessings.length === 0, JSON.stringify(orphanBlessings.map((entry) => entry?.id)));
      assert('pillar_registry_effect_keys_registered', effectRegistrationKnown, JSON.stringify(registryBlessings.map((entry) => entry?.effectKey)));

      game.pillarSystemState.earnedProofIds = ['proof_courage', 'proof_strength', 'proof_resilience', 'proof_dominance'];
      game.pillarSystemState.trialClearCount = 4;

      const beforeRefresh = Number(game.getPillarRuntimeState?.().builtAt) || 0;
      game.pillarSystemState.allocatedBlessingIds = ['pillar.void.skill_singularity'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const afterRefresh = Number(game.getPillarRuntimeState?.().builtAt) || 0;
      assert('runtime_refresh_after_alloc_change', afterRefresh >= beforeRefresh, `${beforeRefresh} -> ${afterRefresh}`);

      const basicAllowed = game.isPillarBasicAttackAllowed?.({ source: 'debug_test' });
      assert('basic_attack_disabled', basicAllowed === false, `allowed=${basicAllowed}`);

      game.pillarSystemState.allocatedBlessingIds = ['pillar.void.void_walker'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const infiniteDash = game.isPillarInfiniteDashCharges?.() === true;
      const healthBeforeDash = Math.max(10, Number(game.currentHealth) || 50);
      game.currentHealth = healthBeforeDash;
      game.runPillarEvent?.('onDashStarted', { source: 'debug_test' });
      const hpLoss = healthBeforeDash - (Number(game.currentHealth) || 0);
      assert('dash_infinite_and_hp_loss', infiniteDash && hpLoss >= 5, `infinite=${infiniteDash}, hpLoss=${hpLoss}`);

      game.pillarSystemState.allocatedBlessingIds = ['pillar.limitless.exponential_growth'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const stackResult = game.resolvePillarStackGain?.({ stackId: 'debug', baseGain: 1, gain: 1 }) || { gain: 0 };
      assert('stack_doubling', Number(stackResult.gain) === 2, `gain=${stackResult.gain}`);

      game.pillarSystemState.allocatedBlessingIds = ['pillar.pacifier.false_peace'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      game.time = 100;
      game.__pillarFalsePeaceState = {
        state: 'waiting',
        lastDamageAt: 90,
        readyAt: 0,
        empoweredHitPending: false
      };
      game.runPillarEvent?.('onTick', { dt: 0.1, time: game.time, source: 'debug_test' });
      const readyState = game.__pillarFalsePeaceState?.state === 'ready' && game.__pillarFalsePeaceState?.empoweredHitPending === true;
      const buffed = game.runPillarEvent?.('beforeDealDamage', {
        source: 'player',
        amount: 10,
        isDot: false,
        time: game.time
      });
      assert(
        'false_peace_cycle',
        readyState && Number(buffed?.amount) >= 110 && game.__pillarFalsePeaceState?.empoweredHitPending === false,
        `ready=${readyState}, amount=${buffed?.amount}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.collector.hoarders_arsenal'];
      game.inventory = [
        { id: 'dbg_helm', type: 'Helmet' },
        { id: 'dbg_boots', type: 'Boots' },
        { id: 'dbg_weapon', type: 'Weapon' },
        { id: 'dbg_body', type: 'Body Armour' }
      ];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const movePayload = game.runPillarEvent?.('getMoveSpeedMultiplier', { multiplier: 1 }) || { multiplier: 1 };
      const breakablePayload = game.runPillarEvent?.('beforeDealObjectDamage', { amount: 100 }) || { amount: 100 };
      assert(
        'inventory_modifiers_recompute',
        Number(movePayload.multiplier) > 1 && Number(breakablePayload.amount) > 100,
        `move=${movePayload.multiplier}, breakable=${breakablePayload.amount}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.limitless.exponential_growth'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const stackTarget = { testStacks: 0 };
      const stackApply = game.applyStackDelta?.(stackTarget, 'debug.stack', 1, {
        stackKey: 'testStacks',
        targetType: 'debug',
        source: 'debug_suite',
        mode: 'add',
        min: 0,
        max: 99
      });
      assert(
        'central_stack_api',
        Number(stackTarget.testStacks) === 2 && !!stackApply?.applied,
        `stacks=${stackTarget.testStacks}`
      );

      const stackEventOrder = [];
      const originalRunPillarEvent = game.runPillarEvent;
      game.runPillarEvent = function wrappedRunPillarEvent(hookName, payload) {
        if (hookName === 'beforeStackApplied' || hookName === 'afterStackApplied') {
          stackEventOrder.push(hookName);
        }
        return originalRunPillarEvent.call(game, hookName, payload);
      };
      const eventTarget = { stackCount: 0 };
      game.applyStackDelta?.(eventTarget, 'debug.event_order', 1, {
        stackKey: 'stackCount',
        targetType: 'player',
        source: 'debug_event_order',
        mode: 'add',
        min: 0,
        max: 5
      });
      game.runPillarEvent = originalRunPillarEvent;
      assert(
        'stack_event_ordering',
        stackEventOrder[0] === 'beforeStackApplied' && stackEventOrder.includes('afterStackApplied'),
        JSON.stringify(stackEventOrder)
      );

      const recursiveTarget = { stacks: 0 };
      let resolveCalls = 0;
      const originalResolve = game.resolvePillarStackGain;
      game.resolvePillarStackGain = (payload = {}) => {
        resolveCalls += 1;
        if (resolveCalls === 1) {
          game.applyStackDelta?.(recursiveTarget, 'debug.recursive_inner', 1, {
            stackKey: 'stacks',
            targetType: 'debug',
            source: 'debug_recursive_inner',
            mode: 'add',
            min: 0,
            max: 10
          });
        }
        return {
          ...(payload || {}),
          gain: Number(payload?.gain ?? payload?.baseGain ?? 0)
        };
      };
      game.applyStackDelta?.(recursiveTarget, 'debug.recursive_outer', 1, {
        stackKey: 'stacks',
        targetType: 'debug',
        source: 'debug_recursive_outer',
        mode: 'add',
        min: 0,
        max: 10
      });
      game.resolvePillarStackGain = originalResolve;
      assert('stack_recursion_guard', resolveCalls === 1, `resolveCalls=${resolveCalls}`);

      game.pillarSystemState.allocatedBlessingIds = ['pillar.limitless.no_limits'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const noLimitsTarget = { stackCount: 995 };
      game.applyStackDelta?.(noLimitsTarget, 'player.debug_nolimits', 100, {
        stackKey: 'stackCount',
        targetType: 'player',
        source: 'debug_no_limits',
        mode: 'add',
        min: 0,
        max: 10
      });
      assert('no_limits_cap_override', Number(noLimitsTarget.stackCount) === 999, `stacks=${noLimitsTarget.stackCount}`);

      game.pillarSystemState.allocatedBlessingIds = ['pillar.limitless.exponential_growth', 'pillar.limitless.no_limits'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const interactionTarget = { stackCount: 998 };
      game.applyStackDelta?.(interactionTarget, 'player.debug_combo', 1, {
        stackKey: 'stackCount',
        targetType: 'player',
        source: 'debug_no_limits_exp_growth',
        mode: 'add',
        min: 0,
        max: 10
      });
      assert(
        'no_limits_plus_exponential_growth',
        Number(interactionTarget.stackCount) === 999,
        `stacks=${interactionTarget.stackCount}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.void.void_walker'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const selfEventsBefore = game.getPillarSelfDamageEventLog?.().length || 0;
      game.runPillarEvent?.('onDashStarted', { source: 'debug_test_pass4' });
      const selfEventsAfter = game.getPillarSelfDamageEventLog?.().length || 0;
      assert('void_walker_uses_self_damage_api', selfEventsAfter > selfEventsBefore, `${selfEventsBefore} -> ${selfEventsAfter}`);

      const healthBeforeNoKill = Math.max(5, Number(game.currentHealth) || 10);
      game.currentHealth = healthBeforeNoKill;
      game.applySelfDamage?.(healthBeforeNoKill + 100, {
        sourceType: 'debug_suite',
        reason: 'non_lethal_self_damage_check',
        bypassMitigation: true,
        canKill: false,
        showFloatingText: false
      });
      assert('self_damage_canKill_flag', Number(game.currentHealth) >= 1, `health=${game.currentHealth}`);

      const selfDamageEventOrder = [];
      const originalRunSelfEvents = game.runPillarEvent;
      game.runPillarEvent = function wrappedSelfEvents(hookName, payload) {
        if (hookName === 'beforeSelfDamage' || hookName === 'afterSelfDamage') {
          selfDamageEventOrder.push(hookName);
        }
        return originalRunSelfEvents.call(game, hookName, payload);
      };
      game.applySelfDamage?.(1, {
        sourceType: 'debug_suite',
        reason: 'event_ordering_check',
        bypassMitigation: true,
        canKill: false,
        showFloatingText: false
      });
      game.runPillarEvent = originalRunSelfEvents;
      assert(
        'self_damage_event_ordering',
        selfDamageEventOrder[0] === 'beforeSelfDamage' && selfDamageEventOrder.includes('afterSelfDamage'),
        JSON.stringify(selfDamageEventOrder)
      );

      const damageLogBefore = game.getPillarDamageEventLog?.().length || 0;
      game.applyDamage?.({
        targetType: 'player',
        amount: 2,
        sourceType: 'debug_suite',
        reason: 'apply_damage_self_path',
        selfInflicted: true,
        bypassMitigation: true,
        canKill: false,
        showFloatingText: false
      });
      const damageLogAfter = game.getPillarDamageEventLog?.().length || 0;
      assert('apply_damage_self_wrapper', damageLogAfter > damageLogBefore, `${damageLogBefore} -> ${damageLogAfter}`);
      const latestSelfDamageRecord = (game.getPillarDamageEventLog?.() || []).slice(-1)[0] || null;
      assert(
        'self_damage_record_metadata',
        !!latestSelfDamageRecord
          && latestSelfDamageRecord.wasSelfDamage === true
          && latestSelfDamageRecord.sourceType === 'debug_suite'
          && latestSelfDamageRecord.targetType === 'player',
        JSON.stringify(latestSelfDamageRecord || {})
      );

      const canonicalApply = game.applyDamage?.({
        targetType: 'player',
        amount: 1,
        sourceType: 'debug_suite',
        reason: 'canonical_record_shape_check',
        damageClass: 'debug',
        fromEnemy: false,
        bypassMitigation: true,
        canKill: false,
        showFloatingText: false
      });
      const canonicalRecord = canonicalApply?.record || null;
      assert(
        'apply_damage_record_shape',
        !!canonicalRecord
          && Number.isFinite(Number(canonicalRecord.recordId))
          && canonicalRecord.sourceType === 'debug_suite'
          && canonicalRecord.targetType === 'player'
          && Number.isFinite(Number(canonicalRecord.baseAmount))
          && Number.isFinite(Number(canonicalRecord.finalAmount)),
        JSON.stringify(canonicalRecord || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.void.void_discrimination'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const incomingNonMinion = game.runPillarEvent?.('beforeTakeDamage', {
        rawAmount: 100,
        fromEnemy: true,
        sourceType: 'enemy_contact',
        sourceEntity: { enemyTier: 'elite', isElite: true }
      });
      const incomingMinion = game.runPillarEvent?.('beforeTakeDamage', {
        rawAmount: 100,
        fromEnemy: true,
        sourceType: 'enemy_contact',
        sourceEntity: { enemyTier: 'minion', isMinion: true }
      });
      assert(
        'void_discrimination_incoming',
        Number(incomingNonMinion?.rawAmount) === 50 && Number(incomingMinion?.rawAmount) === 100,
        `nonMinion=${incomingNonMinion?.rawAmount}, minion=${incomingMinion?.rawAmount}`
      );
      const outgoingMinion = game.runPillarEvent?.('beforeDealDamage', {
        amount: 100,
        enemy: { enemyTier: 'minion', isMinion: true },
        source: 'player'
      });
      const outgoingNonMinion = game.runPillarEvent?.('beforeDealDamage', {
        amount: 100,
        enemy: { enemyTier: 'elite', isElite: true },
        source: 'player'
      });
      assert(
        'void_discrimination_outgoing',
        Number(outgoingMinion?.amount) === 20 && Number(outgoingNonMinion?.amount) === 100,
        `minion=${outgoingMinion?.amount}, nonMinion=${outgoingNonMinion?.amount}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.deep.polluting_presence'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      game.time = 200;
      const polluteBefore = game.getPillarSelfDamageEventLog?.().length || 0;
      game.runPillarEvent?.('onTick', { dt: 1, time: game.time, source: 'debug_test_pass4' });
      const polluteAfter = game.getPillarSelfDamageEventLog?.().length || 0;
      assert('polluting_presence_tick', polluteAfter > polluteBefore, `${polluteBefore} -> ${polluteAfter}`);
      const polluteDamageRecord = (game.getPillarDamageEventLog?.() || []).slice(-1)[0] || null;
      assert(
        'polluting_presence_damage_record',
        !!polluteDamageRecord && typeof polluteDamageRecord.sourceType === 'string' && typeof polluteDamageRecord.targetType === 'string',
        JSON.stringify(polluteDamageRecord || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.havoc.chain_detonation'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const chainBefore = Number(game.__pillarChainDetonationState?.explosionCount) || 0;
      game.runPillarEvent?.('afterDestroyObject', {
        object: { x: 100, y: 100, w: 20, h: 20, maxHealth: 100 },
        finalDamage: 20,
        time: game.time
      });
      const chainAfter = Number(game.__pillarChainDetonationState?.explosionCount) || 0;
      assert('chain_detonation_trigger', chainAfter > chainBefore, `${chainBefore} -> ${chainAfter}`);
      assert(
        'chain_detonation_recursion_guard',
        Number(game.__pillarChainDetonationDepth || 0) === 0 && chainAfter <= chainBefore + 1,
        `depth=${game.__pillarChainDetonationDepth || 0}, count=${chainBefore} -> ${chainAfter}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.void.untouchable_dash'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      game.dashActive = true;
      const untouchableDamage = game.runPillarEvent?.('beforeTakeDamage', {
        rawAmount: 100,
        fromEnemy: true,
        sourceType: 'enemy_contact',
        sourceEntity: { enemyTier: 'elite', isElite: true }
      });
      const untouchableNonBossTarget = game.canEnemyTargetPlayer?.(
        { enemyTier: 'elite', isElite: true },
        { source: 'debug_suite' }
      );
      const untouchableBossTarget = game.canEnemyTargetPlayer?.(
        { enemyTier: 'boss', isBoss: true },
        { source: 'debug_suite' }
      );
      game.dashActive = false;
      assert(
        'untouchable_dash_damage_and_boss_exclusion',
        untouchableDamage?.cancel === true
          && untouchableNonBossTarget === false
          && untouchableBossTarget === true,
        `cancel=${untouchableDamage?.cancel}, nonBoss=${untouchableNonBossTarget}, boss=${untouchableBossTarget}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.void.untouchable_dash', 'pillar.void.void_walker'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const comboHealthBeforeDash = Math.max(10, Number(game.currentHealth) || 50);
      game.currentHealth = comboHealthBeforeDash;
      game.dashActive = true;
      const comboBlockedDamage = game.runPillarEvent?.('beforeTakeDamage', {
        rawAmount: 50,
        fromEnemy: true,
        sourceType: 'enemy_contact',
        sourceEntity: { enemyTier: 'elite', isElite: true }
      });
      game.runPillarEvent?.('onDashStarted', { source: 'debug_suite_combo' });
      game.dashActive = false;
      const comboSelfLoss = comboHealthBeforeDash - (Number(game.currentHealth) || 0);
      assert(
        'void_walker_plus_untouchable_composition',
        comboBlockedDamage?.cancel === true && comboSelfLoss >= 5,
        `blocked=${comboBlockedDamage?.cancel}, selfLoss=${comboSelfLoss}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.pacifier.gentle_presence'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const eliteEnemy = { id: 'elite_dbg', enemyTier: 'elite', isElite: true };
      const minionEnemy = { id: 'minion_dbg', enemyTier: 'minion', isMinion: true };
      const bossEnemy = { id: 'boss_dbg', enemyTier: 'boss', isBoss: true };
      const gentleEliteBefore = game.canEnemyTargetPlayer?.(eliteEnemy, { source: 'debug_suite' });
      const gentleMinionBefore = game.canEnemyTargetPlayer?.(minionEnemy, { source: 'debug_suite' });
      const gentleBossBefore = game.canEnemyTargetPlayer?.(bossEnemy, { source: 'debug_suite' });
      game.runPillarEvent?.('afterDealDamage', {
        source: 'player',
        enemy: eliteEnemy,
        finalDamage: 10,
        isSkill: true,
        isDot: false
      });
      const gentleEliteAfter = game.canEnemyTargetPlayer?.(eliteEnemy, { source: 'debug_suite' });
      const gentleMinionAfter = game.canEnemyTargetPlayer?.(minionEnemy, { source: 'debug_suite' });
      assert(
        'gentle_presence_aggro_flow',
        gentleEliteBefore === false
          && gentleMinionBefore === false
          && gentleBossBefore === true
          && gentleEliteAfter === true
          && gentleMinionAfter === false,
        `eliteBefore=${gentleEliteBefore}, minionBefore=${gentleMinionBefore}, bossBefore=${gentleBossBefore}, eliteAfter=${gentleEliteAfter}, minionAfter=${gentleMinionAfter}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.pacifier.harmony_of_stillness'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const baseAttackBackup = Number(game.baseStats?.attack) || 10;
      const currentAttackBackup = Number(game.currentStats?.attack) || baseAttackBackup;
      game.baseStats.attack = 100;
      game.currentStats.attack = 160;
      game.time = 300;
      game.__pillarHarmonyOfStillnessState = {
        lastDamageAt: 293,
        activeStacks: 0,
        activeBonus: 0
      };
      const grantXpBackup = game.grantXP;
      let grantedHarmonyXp = 0;
      game.grantXP = (amount) => {
        grantedHarmonyXp += Math.max(0, Number(amount) || 0);
      };
      game.runPillarEvent?.('onTick', { dt: 0.2, time: game.time, source: 'debug_suite' });
      const harmonyState = game.__pillarHarmonyOfStillnessState || {};
      const harmonyMovePayload = game.runPillarEvent?.('getMoveSpeedMultiplier', { multiplier: 1 }) || { multiplier: 1 };
      game.runPillarEvent?.('onChestOpened', { source: 'debug_suite' });
      game.grantXP = grantXpBackup;
      game.baseStats.attack = baseAttackBackup;
      game.currentStats.attack = currentAttackBackup;
      assert(
        'harmony_of_stillness_scaling_and_chest_xp',
        Number(harmonyState.activeStacks) >= 20
          && Number(harmonyMovePayload.multiplier) >= 1.2
          && grantedHarmonyXp >= 10,
        `stacks=${harmonyState.activeStacks}, move=${harmonyMovePayload.multiplier}, grantedXp=${grantedHarmonyXp}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.pacifier.false_peace', 'pillar.pacifier.harmony_of_stillness'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      game.time = 400;
      game.__pillarFalsePeaceState = {
        state: 'waiting',
        lastDamageAt: 393,
        readyAt: 0,
        empoweredHitPending: false
      };
      game.__pillarHarmonyOfStillnessState = {
        lastDamageAt: 393,
        activeStacks: 0,
        activeBonus: 0
      };
      game.runPillarEvent?.('onTick', { dt: 0.2, time: game.time, source: 'debug_suite' });
      const falsePeaceReady = game.__pillarFalsePeaceState?.state === 'ready';
      const harmonyActiveWithFalsePeace = Number(game.__pillarHarmonyOfStillnessState?.activeBonus || 0) > 0;
      const composedBeforeDeal = game.runPillarEvent?.('beforeDealDamage', {
        source: 'player',
        amount: 10,
        isDot: false,
        time: game.time
      });
      assert(
        'false_peace_and_harmony_composition',
        falsePeaceReady
          && harmonyActiveWithFalsePeace
          && Number(composedBeforeDeal?.amount) >= 110,
        `ready=${falsePeaceReady}, harmony=${harmonyActiveWithFalsePeace}, amount=${composedBeforeDeal?.amount}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.cascade.amplified_triggers'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const amplifiedChance = game.resolvePillarTriggerChance?.(0.2, {
        triggerType: 'debug_test',
        source: 'debug_suite'
      });
      assert(
        'amplified_triggers_multiplier',
        Math.abs(Number(amplifiedChance) - 0.3) < 0.0001,
        `chance=${amplifiedChance}`
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.cascade.chain_reaction'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const randomBackup = Math.random;
      const executeSkillBackup = game.executeSkill;
      const chainCalls = [];
      Math.random = () => 0;
      game.executeSkill = (skillId, slot, options = {}) => {
        chainCalls.push({ skillId, slot, options });
        return null;
      };
      game.skills = ['skill_a', 'skill_b', 'skill_c', 'skill_d'];
      game.runPillarEvent?.('onSkillCast', {
        slot: 0,
        triggeredCast: true,
        source: 'debug_suite'
      });
      game.runPillarEvent?.('onSkillCast', {
        slot: 1,
        triggeredCast: true,
        source: 'debug_suite'
      });
      game.runPillarEvent?.('onSkillCast', {
        slot: 2,
        triggeredCast: true,
        source: 'debug_suite'
      });
      game.executeSkill = executeSkillBackup;
      Math.random = randomBackup;
      assert(
        'chain_reaction_triggers',
        chainCalls.length >= 3
          && chainCalls.some((row) => row.slot === 1)
          && chainCalls.some((row) => row.slot === 2)
          && chainCalls.some((row) => row.slot === 3),
        JSON.stringify(chainCalls)
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.cascade.grand_finale'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const executeFinaleBackup = game.executeSkill;
      const finaleCalls = [];
      game.executeSkill = (skillId, slot, options = {}) => {
        finaleCalls.push({ skillId, slot, options });
        return null;
      };
      game.skills = ['skill_a', 'skill_b', 'skill_c', 'skill_d'];
      game.time = 500;
      game.runPillarEvent?.('onSkillCast', { slot: 0, triggeredCast: true, source: 'debug_suite' });
      game.runPillarEvent?.('onSkillCast', { slot: 1, triggeredCast: true, source: 'debug_suite' });
      game.runPillarEvent?.('onSkillCast', { slot: 2, triggeredCast: true, source: 'debug_suite' });
      game.runPillarEvent?.('onSkillCast', { slot: 3, triggeredCast: true, source: 'debug_suite' });
      game.executeSkill = executeFinaleBackup;
      assert(
        'grand_finale_guarded_burst',
        finaleCalls.length === 4
          && Number(game.__pillarGrandFinaleState?.burstDepth || 0) === 0
          && Number(game.__pillarGrandFinaleState?.burstCount || 0) >= 1,
        `calls=${finaleCalls.length}, depth=${game.__pillarGrandFinaleState?.burstDepth}, burstCount=${game.__pillarGrandFinaleState?.burstCount}`
      );

      const equipmentLayout = typeof game.resolvePillarEquipmentLayout === 'function'
        ? game.resolvePillarEquipmentLayout({ source: 'debug_suite' })
        : null;
      assert(
        'equipment_layout_resolution',
        !!equipmentLayout
          && Array.isArray(equipmentLayout.slots)
          && equipmentLayout.slots.some((slot) => slot.key === 'Weapon')
          && typeof game.findBestEquipSlotForItem?.({ type: 'Ring' }, { source: 'debug_suite' }) === 'string',
        JSON.stringify(equipmentLayout || {})
      );

      const baseHit = game.resolveHitClassification?.({
        sourceType: 'player',
        skillId: 'shieldBash',
        isMeleeHit: false,
        isRangedHit: false
      });
      assert(
        'hit_classification_base',
        !!baseHit
          && baseHit.countsAsMelee === true
          && baseHit.classification === 'melee',
        JSON.stringify(baseHit || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.weapon_master.perfect_hybridization'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const hybridHit = game.resolveHitClassification?.({
        sourceType: 'player',
        skillId: 'shieldBash',
        isMeleeHit: true,
        isRangedHit: false
      });
      assert(
        'perfect_hybridization_hit_reclass',
        !!hybridHit && hybridHit.countsAsMelee === true && hybridHit.countsAsRanged === true,
        JSON.stringify(hybridHit || {})
      );

      const destructible = game.resolveWorldObjectDestructibility?.({
        defId: 'crate',
        hp: 10,
        maxHp: 10
      }, { typeHint: 'breakable', source: 'debug_suite' });
      const protectedObj = game.resolveWorldObjectDestructibility?.({
        type: 'portal',
        isPortal: true,
        hp: 999
      }, { source: 'debug_suite' });
      assert(
        'destructibility_resolution',
        !!destructible && destructible.destructible === true
          && !!protectedObj && protectedObj.destructible === false && !!protectedObj.protectedReason,
        `destructible=${JSON.stringify(destructible || {})}, protected=${JSON.stringify(protectedObj || {})}`
      );

      const portabilitySummary = game.getEnemyModifierPortabilitySummary?.() || {};
      const portabilityApply = game.applyPortableEnemyModifierPackage?.({}, ['swift', 'volatile'], { targetType: 'player' }) || {};
      assert(
        'enemy_modifier_portability',
        Array.isArray(portabilitySummary?.grouped?.portable)
          && portabilitySummary.grouped.portable.includes('swift')
          && Array.isArray(portabilityApply.applied)
          && portabilityApply.applied.some((row) => row.id === 'swift')
          && portabilityApply.rejected.some((row) => row.id === 'volatile'),
        JSON.stringify({ portabilitySummary, portabilityApply })
      );

      const randomPool = game.resolveRandomTriggerSkillPool?.({
        requireUnlocked: true,
        allowAura: false,
        sourceSkillId: 'fireball',
        avoidSourceSkill: true
      }) || {};
      assert(
        'random_skill_pool_filtering',
        Number(randomPool.eligibleCount || 0) >= 1
          && Array.isArray(randomPool.excluded)
          && randomPool.excluded.some((row) => row.id === 'fireball')
          && randomPool.excluded.some((row) => row.category === 'aura'),
        JSON.stringify(randomPool || {})
      );

      game.clearPillarProofs?.();
      game.grantAllPillarProofs?.();
      const topologyBase = game.getPillarAllocationTopologySummary?.() || {};
      game.setPillarAllocationRuleModifiers?.([
        {
          id: 'debug_topology',
          allowSamePillarDuplicates: true,
          enforceSiblingExclusion: false,
          blockLevel2Allocation: true,
          maxBlessingsPerPillarOverride: 2
        }
      ]);
      const topologyModified = game.getPillarAllocationTopologySummary?.() || {};
      assert(
        'allocation_topology_resolution',
        topologyBase?.rules?.allowSamePillarDuplicates === false
          && topologyModified?.rules?.allowSamePillarDuplicates === true
          && topologyModified?.rules?.enforceSiblingExclusion === false
          && topologyModified?.rules?.blockLevel2Allocation === true,
        JSON.stringify({ topologyBase, topologyModified })
      );
      game.setPillarAllocationRuleModifiers?.([]);

      const deepPillar = getAllPillars().find((pillar) => pillar.id === 'the_deep');
      const pacifierPillar = getAllPillars().find((pillar) => pillar.id === 'the_pacifier');
      const deepLevel1Effects = (deepPillar?.blessingsLevel1 || []).map((entry) => entry.effectKey);
      const pacifierLevel1Effects = (pacifierPillar?.blessingsLevel1 || []).map((entry) => entry.effectKey);
      assert(
        'quiet_hands_registry_ownership',
        deepLevel1Effects.includes('pillar.deep.two_heads')
          && deepLevel1Effects.includes('pillar.deep.polluting_presence')
          && !deepLevel1Effects.includes('pillar.pacifier.quiet_hands')
          && pacifierLevel1Effects.includes('pillar.pacifier.gentle_presence')
          && pacifierLevel1Effects.includes('pillar.pacifier.quiet_hands'),
        JSON.stringify({ deepLevel1Effects, pacifierLevel1Effects })
      );

      const quietHandsMigratedState = normalizePillarProgressState({
        version: 1,
        trialClearCount: 1,
        earnedProofIds: ['proof_courage'],
        allocatedBlessingIds: ['the_deep_forge_resolve'],
        availablePillarIds: allPillarIds,
        trialEntryItemCount: 0,
        activeTrial: null
      }, allPillarIds);
      assert(
        'quiet_hands_save_id_remap',
        Array.isArray(quietHandsMigratedState?.allocatedBlessingIds)
          && quietHandsMigratedState.allocatedBlessingIds.includes('pillar.pacifier.quiet_hands'),
        JSON.stringify(quietHandsMigratedState || {})
      );

      game.clearPillarProofs?.();
      game.grantAllPillarProofs?.();
      game.pillarSystemState.allocatedBlessingIds = ['pillar.deep.twisted_belief'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const twistedSnapshot = game.getPillarAllocationSnapshot?.() || {};
      assert(
        'twisted_belief_topology',
        Number(twistedSnapshot.maxLevel1 || 0) === 5
          && Number(twistedSnapshot.maxLevel2 || 0) === 1
          && twistedSnapshot.allowSamePillarDuplicates === true
          && twistedSnapshot.blockLevel2Allocation === true,
        JSON.stringify(twistedSnapshot)
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.deep.twisted_belief', 'pillar.void.skill_singularity'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const samePillarAllowed = game.canAllocatePillarBlessing?.('pillar.void.untouchable_dash');
      assert(
        'twisted_belief_same_pillar_duplicate',
        samePillarAllowed?.allowed === true,
        JSON.stringify(samePillarAllowed || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.deep.twisted_belief', 'pillar.void.void_walker'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const secondL2Blocked = game.canAllocatePillarBlessing?.('pillar.limitless.no_limits');
      assert(
        'twisted_belief_blocks_additional_l2',
        secondL2Blocked?.allowed === false
          && (secondL2Blocked?.details === 'tier2_topology_block' || secondL2Blocked?.reason?.includes('Level 2')),
        JSON.stringify(secondL2Blocked || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.collector.ring_vault'];
      game.inventory = [
        { id: 'dbg_inv_ring_1', type: 'Ring' },
        { id: 'dbg_inv_ring_2', type: 'Ring' },
        { id: 'dbg_inv_ring_3', type: 'Ring' },
        { id: 'dbg_inv_ring_4', type: 'Ring' },
        { id: 'dbg_inv_ring_5', type: 'Ring' },
        { id: 'dbg_inv_ring_6', type: 'Ring' }
      ];
      game.equipment.Ring1 = { id: 'dbg_eq_ring_a', type: 'Ring', ringId: 'ring_focus', name: 'Ring A' };
      game.equipment.Ring2 = { id: 'dbg_eq_ring_b', type: 'Ring', ringId: 'ring_guardian', name: 'Ring B' };
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const ringLayout = game.resolvePillarEquipmentLayout?.({ source: 'debug_suite_ring_vault' }) || { slots: [] };
      const ringSlotCount = (ringLayout.slots || []).filter((slot) => slot?.allowedItemTypes?.includes('Ring')).length;
      const ringScaling = game.resolvePillarRingEffectMultiplier?.({ source: 'debug_suite' }) || {};
      assert(
        'ring_vault_slot_count_and_math',
        ringSlotCount >= 10
          && Math.abs(Number(ringScaling.additivePercent) - (-30)) < 0.001
          && Math.abs(Number(ringScaling.multiplier) - 0.7) < 0.001,
        JSON.stringify({ ringSlotCount, ringScaling })
      );
      assert(
        'ring_vault_inventory_vs_equipped_counting',
        Number(ringScaling?.details?.inventoryRingCount || 0) === 6
          && Number(ringScaling?.details?.equippedRingCount || 0) >= 2,
        JSON.stringify(ringScaling || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.weapon_master.living_arsenal'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const arsenalLayout = game.resolvePillarEquipmentLayout?.({ source: 'debug_suite_living_arsenal' }) || { slots: [], categoryCaps: {} };
      const arsenalSlots = Array.isArray(arsenalLayout.slots) ? arsenalLayout.slots : [];
      const allWeaponCompatible = arsenalSlots.length > 0 && arsenalSlots.every((slot) => slot?.allowedItemTypes?.includes('Weapon'));
      const weaponSlots = arsenalSlots.slice(0, 4).map((slot) => slot.key);
      for (let i = 0; i < weaponSlots.length; i += 1) {
        const key = weaponSlots[i];
        game.equipment[key] = {
          id: `dbg_weapon_${i}`,
          name: `Dbg Weapon ${i}`,
          type: 'Weapon',
          stats: { attack: 1 }
        };
      }
      const repeatPlan = game.resolvePillarAttackRepeat?.({
        sourceType: 'player',
        isDot: false,
        repeatAttack: false,
        amount: 100
      }) || {};
      assert(
        'living_arsenal_layout_reinterpretation',
        allWeaponCompatible && Number(arsenalLayout?.categoryCaps?.Weapon || 0) >= arsenalSlots.length,
        JSON.stringify(arsenalLayout || {})
      );
      assert(
        'living_arsenal_repeat_plan',
        repeatPlan?.shouldRepeat === true
          && Number(repeatPlan?.repeatCount || 0) === 4
          && Math.abs(Number(repeatPlan?.damageMultiplier || 0) - 0.25) < 0.001,
        JSON.stringify(repeatPlan || {})
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.deep.two_heads'];
      game.equipment.Helmet = { id: 'dbg_helmet_primary', name: 'Primary Helm', type: 'Helmet', stats: { maxHealth: 10 } };
      game.equipment.Helmet2 = { id: 'dbg_helmet_secondary', name: 'Secondary Helm', type: 'Helmet', stats: { defense: 5 } };
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const twoHeadsLayout = game.resolvePillarEquipmentLayout?.({ source: 'debug_suite_two_heads' }) || { slots: [] };
      const twoHeadsHelmetSlots = (twoHeadsLayout.slots || []).filter((slot) => (slot?.allowedItemTypes || []).includes('Helmet'));
      const twoHeadsActiveSanitize = game.sanitizeEquipmentAgainstLayout?.({ source: 'debug_suite_two_heads_active' }) || { movedCount: 0 };
      const twoHeadsSerialized = JSON.parse(JSON.stringify(game.equipment || {}));

      game.pillarSystemState.allocatedBlessingIds = [];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const twoHeadsCollapsedSanitize = game.sanitizeEquipmentAgainstLayout?.({ source: 'debug_suite_two_heads_removed' }) || { movedCount: 0, moved: [] };
      const movedHelmetToInventory = (game.inventory || []).some((item) => item?.id === 'dbg_helmet_secondary');
      assert(
        'two_heads_layout_and_collapse_sanitization',
        twoHeadsHelmetSlots.length >= 2
          && Number(twoHeadsLayout?.categoryCaps?.Helmet || 0) >= 2
          && Number(twoHeadsActiveSanitize?.movedCount || 0) === 0
          && !!twoHeadsSerialized?.Helmet2
          && Number(twoHeadsCollapsedSanitize?.movedCount || 0) >= 1
          && movedHelmetToInventory,
        JSON.stringify({
          twoHeadsLayout,
          twoHeadsActiveSanitize,
          twoHeadsSerialized,
          twoHeadsCollapsedSanitize,
          movedHelmetToInventory
        })
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.havoc.fury_of_havoc', 'pillar.havoc.chain_detonation'];
      game.currentStats.maxHealth = 200;
      game.currentHealth = 200;
      game.time += 1;
      const furyBreakable = {
        id: 'dbg_fury_breakable',
        defId: 'crate',
        hp: 12,
        maxHp: 12,
        isDead: false,
        takeDamage(amount) {
          this.hp = Math.max(0, (this.hp || 0) - (Number(amount) || 0));
          if (this.hp <= 0) this.isDead = true;
        }
      };
      const furyProtected = {
        id: 'dbg_fury_portal',
        type: 'portal',
        isPortal: true,
        x: 120,
        y: 120,
        w: 40,
        h: 40
      };
      game.breakables = [furyBreakable];
      game.mapInteractables = [furyProtected];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const furySelfBefore = game.getPillarSelfDamageEventLog?.().length || 0;
      for (let i = 0; i < 10; i += 1) {
        game.runPillarEvent?.('afterDestroyObject', {
          object: { id: `dbg_fury_destroy_${i}` },
          reason: 'debug_fury_increment',
          tags: [],
          sourceType: 'debug_suite'
        });
      }
      game.runPillarEvent?.('onTick', { dt: 1, time: game.time, source: 'debug_suite' });
      game.runPillarEvent?.('onTick', { dt: 1, time: game.time + 1, source: 'debug_suite' });
      const furyState = game.__pillarFuryOfHavocState || {};
      const furySelfAfter = game.getPillarSelfDamageEventLog?.().length || 0;
      const furyBeforeMassTagged = Number(furyState.fury) || 0;
      game.runPillarEvent?.('afterDestroyObject', {
        object: { id: 'dbg_fury_mass_tagged' },
        reason: 'fury_of_havoc_mass_destroy',
        tags: ['fury_of_havoc_mass_destroy']
      });
      const furyAfterMassTagged = Number(game.__pillarFuryOfHavocState?.fury) || 0;
      assert(
        'fury_of_havoc_cycle_and_guard',
        furySelfAfter >= furySelfBefore + 10
          && (Number(furyState.triggerCount || 0) >= 1)
          && furyBreakable.isDead === true
          && !furyProtected.__pillarDestroyed
          && furyAfterMassTagged === furyBeforeMassTagged,
        JSON.stringify({
          furySelfBefore,
          furySelfAfter,
          furyState,
          furyBreakable,
          furyProtected,
          furyBeforeMassTagged,
          furyAfterMassTagged
        })
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.weapon_master.dual_technique'];
      game.attackType = 'projectile';
      game.secondaryAttackType = 'fanStrike';
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const dualConfig = game.getPillarDualBasicAttackConfig?.({
        primaryAttackType: game.attackType,
        secondaryAttackType: game.secondaryAttackType
      }) || {};
      const executeBasicAttackByTypeBackup = game.executeBasicAttackByType;
      const dualCalls = [];
      game.executeBasicAttackByType = (attackType, _targetX, _targetY, context = {}) => {
        dualCalls.push({
          attackType,
          damageMultiplier: Number(context?.damageMultiplier) || 0
        });
        return true;
      };
      game.playerAttackTimer = 0;
      game.dashActive = false;
      game.bladeDashActive = false;
      game.dashStrikeState = null;
      game.backfireDashState = null;
      game.tryBasicAttack?.(game.player.position.x + 80, game.player.position.y + 20);
      game.executeBasicAttackByType = executeBasicAttackByTypeBackup;
      assert(
        'dual_technique_double_attack_dispatch',
        dualConfig?.enabled === true
          && Math.abs(Number(dualConfig?.damageMultiplier || 0) - 0.4) < 0.001
          && dualCalls.length === 2
          && dualCalls.some((row) => row.attackType === 'projectile')
          && dualCalls.some((row) => row.attackType === 'fanStrike')
          && dualCalls.every((row) => Math.abs(row.damageMultiplier - 0.4) < 0.001),
        JSON.stringify({ dualConfig, dualCalls })
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.limitless.ascended_growth'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const ascendedConfig = game.getPillarLevelUpPickConfig?.({ source: 'debug_suite' }) || {};
      game.levelUpPickState = {
        pickCount: 3,
        picksRemaining: 3,
        resolvedPicks: 0,
        effectiveness: [0.8, 0.5, 0.3],
        chosen: []
      };
      game.levelUpChoices = [{
        upgrades: [{ id: 'damageBoost', name: 'Damage Boost', description: '', value: 10, percent: false }],
        penalty: null
      }];
      const showLevelUpChoicesBackup = game.showLevelUpChoices;
      game.showLevelUpChoices = () => {};
      game.applyLevelUpChoice?.(game.levelUpChoices[0], null);
      game.showLevelUpChoices = showLevelUpChoicesBackup;
      const lastScaledUpgrade = (game.runAttackUpgrades || [])[game.runAttackUpgrades.length - 1] || {};
      assert(
        'ascended_growth_pick_config_and_scaling',
        Number(ascendedConfig?.pickCount || 0) === 3
          && Math.abs(Number(ascendedConfig?.effectiveness?.[0] || 0) - 0.8) < 0.001
          && Math.abs(Number(lastScaledUpgrade?.value || 0) - 8) < 0.001
          && Number(game.levelUpPickState?.picksRemaining || 0) === 2,
        JSON.stringify({ ascendedConfig, lastScaledUpgrade, pickState: game.levelUpPickState })
      );
      game.levelUpPickState = null;
      game.__pillarAscendedGrowthState = null;

      game.pillarSystemState.allocatedBlessingIds = ['pillar.collector.grand_bazaar'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const bazaarPricing = game.getPillarPricingModifiers?.() || {};
      const bazaarResolvedCost = game.resolvePillarNpcPrice?.(100, { npcType: 'npcPriest', service: 'heal' }) || 0;
      const spawnSpotBackup = game.findInteractableSpawnSpot;
      game.findInteractableSpawnSpot = () => ({ x: 64, y: 64 });
      game.mapInteractables = [];
      game.npcSpawnState = {
        oldWoman: { interval: 1, counter: 0 },
        oldMan: { interval: 1, counter: 0 },
        priest: { interval: 1, counter: 0 },
        schemaMonk: { interval: 1, counter: 0 },
        elderSchemaMonk: { interval: 1, counter: 0 },
        equipmentCollector: { interval: 1, counter: 0 },
        blacksmith: { interval: 1, counter: 0 }
      };
      game.spawnMapNpcsForVisit?.(0);
      const bazaarSpawnDebug = game.__pillarNpcSpawnDebug || {};
      game.findInteractableSpawnSpot = spawnSpotBackup;
      assert(
        'grand_bazaar_spawn_cap_and_pricing',
        Number(bazaarResolvedCost) === 200
          && Number(bazaarPricing?.npcPriceMultiplier || 0) >= 2
          && Number(bazaarSpawnDebug?.maxNpcsPerMap || 0) >= 15,
        JSON.stringify({ bazaarPricing, bazaarResolvedCost, bazaarSpawnDebug })
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.deep.tentacles'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      game.time = 620;
      game.runPillarEvent?.('onTick', { dt: 0.1, time: game.time, source: 'debug_suite' });
      const tentaclesLayout = game.resolvePillarEquipmentLayout?.({ source: 'debug_suite_tentacles' }) || { slots: [] };
      const tentaclesStateA = game.__pillarTentaclesState || {};
      const ringSlotsDisabled = (tentaclesLayout.slots || [])
        .filter((slot) => (slot?.allowedItemTypes || []).includes('Ring'))
        .every((slot) => slot?.enabled === false);
      const portabilityCatalog = game.getEnemyModifierPortabilityCatalog?.() || {};
      const tentacleModsPortable = Array.isArray(tentaclesStateA.activeModifierIds)
        && tentaclesStateA.activeModifierIds.length > 0
        && tentaclesStateA.activeModifierIds.every((id) => {
          const portability = portabilityCatalog?.[id]?.portability;
          return portability === 'portable' || portability === 'adaptable';
        });
      const firstTentacleRoll = JSON.stringify(tentaclesStateA.activeModifierIds || []);
      game.time += 20.1;
      game.runPillarEvent?.('onTick', { dt: 20.1, time: game.time, source: 'debug_suite' });
      const tentaclesStateB = game.__pillarTentaclesState || {};
      const secondTentacleRoll = JSON.stringify(tentaclesStateB.activeModifierIds || []);
      assert(
        'tentacles_ring_disable_and_safe_pool',
        ringSlotsDisabled
          && tentacleModsPortable
          && Number(tentaclesStateB.rollCount || 0) >= 2,
        JSON.stringify({
          ringSlotsDisabled,
          tentacleModsPortable,
          rollCount: tentaclesStateB.rollCount,
          firstTentacleRoll,
          secondTentacleRoll
        })
      );

      const randomPoolBackup2 = game.resolveRandomTriggerSkillPool;
      const executeSkillBackup2 = game.executeSkill;
      game.pillarSystemState.allocatedBlessingIds = [
        'pillar.cascade.wild_cascade',
        'pillar.cascade.chain_reaction',
        'pillar.cascade.grand_finale'
      ];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      game.resolveRandomTriggerSkillPool = () => ({
        eligibleCount: 1,
        excludedCount: 0,
        eligible: [{ id: 'fireball', category: 'damage' }],
        excluded: []
      });
      const wildCalls = [];
      game.executeSkill = (skillId, slot, options = {}) => {
        wildCalls.push({ skillId, slot, options });
        return null;
      };
      game.runPillarEvent?.('onSkillCast', {
        slot: 0,
        skillId: 'iceShard',
        triggeredCast: true,
        options: {},
        source: 'debug_suite'
      });
      game.runPillarEvent?.('onSkillCast', {
        slot: 1,
        skillId: 'fireball',
        triggeredCast: true,
        options: { wildCascadeTriggered: true },
        source: 'debug_suite'
      });
      game.executeSkill = executeSkillBackup2;
      game.resolveRandomTriggerSkillPool = randomPoolBackup2;
      const wildState = game.__pillarWildCascadeState || {};
      const procStateAfterWild = game.getPillarProcGuardSummary?.() || {};
      assert(
        'wild_cascade_pool_and_proc_guards',
        wildCalls.length >= 1
          && wildCalls.every((row) => row?.options?.wildCascadeTriggered === true)
          && Number(wildState.blockedCount || 0) >= 1
          && Number(procStateAfterWild.depth || 0) === 0,
        JSON.stringify({ wildCalls, wildState, procStateAfterWild })
      );

      game.pillarSystemState.allocatedBlessingIds = ['pillar.havoc.unmake_the_world', 'pillar.havoc.chain_detonation'];
      dispatchStateChange(game);
      refreshAllocationHooks(game);
      const debugObstacle = {
        id: 'dbg_unmake_obstacle',
        type: 'iceBlock',
        typeDef: { id: 'iceBlock' },
        position: { x: 100, y: 100 },
        size: { w: 32, h: 32 },
        destroyed: false
      };
      const debugProp = {
        id: 'dbg_unmake_prop',
        typeId: 'chest',
        position: { x: 140, y: 100 },
        width: 32,
        height: 32,
        isSearched: false,
        finishSearch(gameRef) {
          this.isSearched = true;
          this.__finishedBy = gameRef ? 'game' : 'none';
        }
      };
      const destructibleObstacle = game.resolveWorldObjectDestructibility?.(debugObstacle, {
        typeHint: 'obstacle',
        source: 'debug_suite'
      });
      const protectedPortal = game.resolveWorldObjectDestructibility?.({
        type: 'portal',
        isPortal: true,
        x: 0,
        y: 0,
        w: 64,
        h: 64
      }, { source: 'debug_suite' });
      const chainBeforeUnmake = Number(game.__pillarChainDetonationState?.explosionCount) || 0;
      game.dealDamageToBreakable?.(debugObstacle, 9999, { reason: 'debug_unmake_obstacle_destroy' });
      game.dealDamageToBreakable?.(debugProp, 9999, { reason: 'debug_unmake_prop_destroy' });
      const chainAfterUnmake = Number(game.__pillarChainDetonationState?.explosionCount) || 0;
      assert(
        'unmake_world_supported_vs_protected',
        destructibleObstacle?.destructible === true
          && destructibleObstacle?.grantedByPillar === true
          && protectedPortal?.destructible === false
          && !!protectedPortal?.protectedReason
          && debugObstacle.destroyed === true
          && debugProp.isSearched === true
          && chainAfterUnmake > chainBeforeUnmake,
        JSON.stringify({
          destructibleObstacle,
          protectedPortal,
          debugObstacle,
          debugProp,
          chainBeforeUnmake,
          chainAfterUnmake
        })
      );
    } catch (error) {
      assert('validation_suite_exception', false, String(error?.message || error));
    } finally {
      restore();
    }

    return {
      passed: results.every((entry) => entry.passed),
      results
    };
  };

  installPillarRuntime(game);
  game.getPillarRuntimeDebugSummary = game.getPillarRuntimeDebugSummary || (() => ({}));
  if (game.pillarSaveMigrationReport && typeof game.recordPillarSanitizationReport === 'function') {
    game.recordPillarSanitizationReport(game.pillarSaveMigrationReport);
  }

  // Persisted state bootstrap.
  dispatchStateChange(game);
  refreshAllocationHooks(game);
}
