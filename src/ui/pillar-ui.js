import { BLESSING_TIER, getBlessingById, getPillarById } from '../data/pillars.js';
import { getProofRequirementForBlessingTier } from '../systems/pillar-progress.js';

const OVERLAY_ID = 'pillar-overlay';
const OPEN_BUTTON_ID = 'open-pillar-system-btn';
const CLOSE_BUTTON_ID = 'close-pillar-system-btn';
const DEBUG_OUTPUT_ID = 'pillar-debug-output';

let gameRef = null;
let stateUpdateBound = false;
let runtimeUpdateBound = false;
let selectedBlessingId = null;

function sanitize(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tierLabel(tier) {
  return tier === BLESSING_TIER.LEVEL_2 ? 'Level 2' : 'Level 1';
}

function createMarkup() {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'pillar-overlay hidden';
  overlay.innerHTML = `
    <div class="pillar-overlay__surface">
      <header class="pillar-overlay__header">
        <h2>Pillar System</h2>
        <button id="${CLOSE_BUTTON_ID}" class="pillar-overlay__close" type="button">x</button>
      </header>
      <div class="pillar-tabs" role="tablist">
        <button class="pillar-tab active" data-tab="overview" type="button">Pillar Overview</button>
        <button class="pillar-tab" data-tab="rites" type="button">Rite Gate</button>
        <button class="pillar-tab" data-tab="blessings" type="button">Blessing Allocation</button>
        <button class="pillar-tab" data-tab="runtime" type="button">Runtime Inspector</button>
      </div>
      <section id="pillar-tab-overview" class="pillar-tabpanel active"></section>
      <section id="pillar-tab-rites" class="pillar-tabpanel"></section>
      <section id="pillar-tab-blessings" class="pillar-tabpanel"></section>
      <section id="pillar-tab-runtime" class="pillar-tabpanel"></section>
      <div id="pillar-validate-feedback" class="pillar-feedback"></div>
      <section class="pillar-details">
        <h3>Selected Blessing</h3>
        <div id="pillar-details-content">Select a blessing to inspect details.</div>
      </section>
    </div>
  `;
  return overlay;
}

function ensureOpenButton(shouldShowButton) {
  const existing = document.getElementById(OPEN_BUTTON_ID);
  if (!shouldShowButton) {
    if (existing) existing.remove();
    return null;
  }
  if (existing) {
    return existing;
  }
  const button = document.createElement('button');
  button.id = OPEN_BUTTON_ID;
  button.className = 'pillars-menu-open-button';
  button.type = 'button';
  button.textContent = 'Pillars';
  document.body.appendChild(button);
  return button;
}

function getBlessingDiagnostics(game, blessingId) {
  if (!game || !blessingId) {
    return null;
  }
  if (typeof game.getPillarBlessingAllocability === 'function') {
    return game.getPillarBlessingAllocability(blessingId);
  }
  if (typeof game.canAllocatePillarBlessing === 'function') {
    return game.canAllocatePillarBlessing(blessingId);
  }
  return null;
}

function formatValidationReason(validation, requirementProof) {
  if (!validation || validation.allowed) {
    return 'Allocatable';
  }
  if (validation.details === 'tier1_blocked' || validation.details === 'tier2_blocked') {
    return requirementProof ? `Requires ${requirementProof.displayName}` : validation.reason;
  }
  if (validation.details === 'pillar_full') {
    return 'Already selected another blessing from this Pillar';
  }
  if (validation.details === 'tier1_full') {
    return 'Level 1 capacity full';
  }
  if (validation.details === 'tier2_full') {
    return 'Cannot allocate more Level 2 blessings';
  }
  if (validation.details === 'sibling_exclusion') {
    return 'Sibling mutual exclusion is active';
  }
  if (validation.details === 'tier2_topology_block') {
    return 'Level 2 allocation is blocked by topology';
  }
  if (validation.details === 'pillar_locked') {
    return 'This pillar is locked';
  }
  return validation.reason || 'Unavailable';
}

function getBlessingStatus(game, blessing, pillar) {
  const isAllocated = !!game.hasPillarBlessing(blessing.id);
  const validation = isAllocated
    ? { allowed: true, reason: 'Allocated', details: 'allocated', reasons: ['Allocated'] }
    : (pillar.isLocked
      ? { allowed: false, reason: 'This pillar is locked.', details: 'pillar_locked', reasons: ['This pillar is locked.'] }
      : getBlessingDiagnostics(game, blessing.id));
  const requirementProof = getProofRequirementForBlessingTier(blessing.tier);
  const siblings = [...(pillar.blessingsLevel1 || []), ...(pillar.blessingsLevel2 || [])];
  const allocatedSibling = siblings.find((entry) => entry.id !== blessing.id && game.hasPillarBlessing(entry.id));
  const snapshot = game.getPillarAllocationSnapshot();

  const lines = [
    requirementProof ? `Proof requirement: ${requirementProof.displayName}` : 'Proof requirement: None',
    isAllocated ? 'Status: Allocated' : `Status: ${formatValidationReason(validation, requirementProof)}`,
    allocatedSibling ? `Mutually exclusive with ${allocatedSibling.displayName}` : 'Mutual exclusivity: none active',
    `Limits: L1 ${snapshot.usedLevel1}/${snapshot.maxLevel1}, L2 ${snapshot.usedLevel2}/${snapshot.maxLevel2}`,
    `Topology: duplicates ${snapshot.allowSamePillarDuplicates ? 'allowed' : 'blocked'}, sibling exclusion ${snapshot.enforceSiblingExclusion === false ? 'disabled' : 'enabled'}, L2 block ${snapshot.blockLevel2Allocation ? 'active' : 'inactive'}`
  ];

  return {
    isAllocated,
    validation: validation || { allowed: false, reason: 'Unavailable', reasons: ['Unavailable'] },
    requirementProof,
    allocatedSibling,
    lines
  };
}

function renderBlessingDetails(game) {
  const detailsArea = document.getElementById('pillar-details-content');
  if (!detailsArea) return;

  if (!selectedBlessingId) {
    detailsArea.innerHTML = 'Select a blessing to inspect details.';
    return;
  }

  const blessing = getBlessingById(selectedBlessingId);
  if (!blessing) {
    detailsArea.innerHTML = 'Blessing data unavailable.';
    return;
  }

  const pillar = getPillarById(blessing.pillarId);
  if (!pillar) {
    detailsArea.innerHTML = 'Pillar data unavailable.';
    return;
  }

  const status = getBlessingStatus(game, blessing, pillar);
  const reasons = Array.isArray(status.validation?.reasons)
    ? status.validation.reasons
    : [status.validation?.reason || ''];
  const reasonsMarkup = reasons.filter(Boolean).map((reason) => `<li>${sanitize(reason)}</li>`).join('');

  detailsArea.innerHTML = `
    <p><strong>${sanitize(blessing.displayName)}</strong> (${tierLabel(blessing.tier)})</p>
    <p><strong>Pillar:</strong> ${sanitize(pillar.displayName)}</p>
    <p>${sanitize(blessing.description)}</p>
    <p><strong>Effect Key:</strong> ${sanitize(blessing.effectKey || 'TBD')}</p>
    <p><strong>Proof Requirement:</strong> ${sanitize(status.requirementProof?.displayName || 'None')}</p>
    <p><strong>Allocatable:</strong> ${status.validation.allowed || status.isAllocated ? 'Yes' : 'No'}</p>
    <p><strong>Status:</strong> ${sanitize(formatValidationReason(status.validation, status.requirementProof))}</p>
    <p><strong>Mutual exclusion:</strong> ${status.allocatedSibling ? sanitize(status.allocatedSibling.displayName) : 'None'}</p>
    <p><strong>Allocation summary:</strong> ${sanitize(status.lines[3])}</p>
    <p><strong>Topology summary:</strong> ${sanitize(status.lines[4])}</p>
    <p><strong>Rule reasons:</strong></p>
    <ul>${reasonsMarkup || '<li>None</li>'}</ul>
  `;
}

function renderOverview(panel, game) {
  const snapshot = game.getPillarAllocationSnapshot();
  const topology = typeof game.getPillarAllocationTopologySummary === 'function'
    ? game.getPillarAllocationTopologySummary()
    : null;
  const proofs = game.getAllPillarProofEntries();
  const rows = game.getPillarOverviewRows();
  const earned = new Set(game.getPillarProofs());
  const progress = game.getPillarTrialProgress();

  panel.innerHTML = `
    <div class="pillar-overview-grid">
      <div class="pillar-overview-summary">
        <h3>Proofs</h3>
        <p>${proofs
          .map((proof) => {
            const earnedMark = earned.has(proof.id) ? ' [Y]' : '';
            return `<div>${sanitize(proof.displayName)} (${proof.trialSuccessAtLeast}+)${earnedMark}</div>`;
          })
          .join('')}
        </p>
        <p><strong>Next Proof:</strong> ${progress.nextProof ? sanitize(progress.nextProof.displayName) : 'No further proofs.'}</p>
      </div>
      <div class="pillar-overview-summary">
        <h3>Allocation Capacity</h3>
        <p>Level 1: ${snapshot.usedLevel1}/${snapshot.maxLevel1} (remaining ${snapshot.remainingLevel1})</p>
        <p>Level 2: ${snapshot.usedLevel2}/${snapshot.maxLevel2} (remaining ${snapshot.remainingLevel2})</p>
        <p>Per-pillar cap: ${snapshot.maxBlessingsPerPillar}</p>
        <p>Same-pillar duplicates: ${snapshot.allowSamePillarDuplicates ? 'Allowed' : 'Blocked'}</p>
        <p>Sibling exclusion: ${snapshot.enforceSiblingExclusion === false ? 'Disabled' : 'Enabled'}</p>
        <p>Further Level 2 allocation: ${snapshot.blockLevel2Allocation ? 'Blocked by topology' : 'Allowed'}</p>
        <p>Topology modifiers: ${(topology?.appliedModifiers || []).length > 0 ? sanitize((topology.appliedModifiers || []).join(', ')) : 'None'}</p>
      </div>
    </div>
    <div class="pillar-proof-progress">
      <h3>Rite clears: ${progress.trialClearCount}</h3>
    </div>
    <div class="pillar-list">
      ${rows
        .map((pillar) => {
          return `
            <article class="pillar-card ${pillar.isLocked ? 'pillar-card--locked' : ''}">
              <h3>${sanitize(pillar.displayName)}</h3>
              <p>${sanitize(pillar.description)}</p>
              <p class="pillar-card__lock">${pillar.isLocked ? 'Locked' : 'Unlocked'}</p>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderRites(panel, game) {
  const progress = typeof game.getRiteProgress === 'function'
    ? game.getRiteProgress()
    : { unlockedRiteIds: [], completedRiteIds: [], grantedProofByRiteId: {}, lastResult: null };
  const rites = typeof game.getRiteRegistryEntries === 'function' ? game.getRiteRegistryEntries() : [];
  const unlocked = new Set(progress.unlockedRiteIds || []);
  const completed = new Set(progress.completedRiteIds || []);
  const activeSummary = typeof game.getActiveRiteSummary === 'function'
    ? game.getActiveRiteSummary()
    : null;
  const entryItemName = typeof game.getRiteEntryItemDisplayName === 'function'
    ? game.getRiteEntryItemDisplayName()
    : 'The Blood of The Lamb';

  panel.innerHTML = `
    <h3>Rite Gate</h3>
    <p>${sanitize(entryItemName)} owned: <strong>${sanitize(String(typeof game.getRiteEntryItemCount === 'function' ? game.getRiteEntryItemCount() : game.getPillarTrialItemCount()))}</strong></p>
    <p>Active Rite: <strong>${sanitize(activeSummary?.activeRiteId || 'None')}</strong></p>
    <div class="pillar-proof-progress">
      ${rites.map((rite) => {
        const validation = typeof game.canEnterRite === 'function' ? game.canEnterRite(rite.id) : { allowed: true };
        const entryCost = Math.max(1, Number(rite.entryItemCost) || 1);
        const isCompleted = completed.has(rite.id);
        const isUnlocked = unlocked.has(rite.id);
        const active = activeSummary?.activeRiteId === rite.id;
        const blockedReason = validation.allowed ? '' : (validation.reason || 'Blocked');
        return `
          <article class="pillar-card ${!isUnlocked ? 'pillar-card--locked' : ''}">
            <h4>${sanitize(rite.displayName)} (Level ${sanitize(String(rite.level || 0))})</h4>
            <p>${sanitize(rite.description || '')}</p>
            <p><strong>Proof Reward:</strong> ${sanitize(rite.proofRewardId || 'Unknown')}</p>
            <p><strong>Mode:</strong> ${sanitize(rite.modeType || 'unknown')}</p>
            <p><strong>Entry Cost:</strong> ${sanitize(String(entryCost))}x ${sanitize(entryItemName)}</p>
            <p><strong>Status:</strong> ${isCompleted ? 'Completed' : (active ? 'Active' : (isUnlocked ? 'Available' : 'Locked'))}</p>
            ${blockedReason ? `<p><strong>Blocked:</strong> ${sanitize(blockedReason)}</p>` : ''}
            <div class="blessing-actions">
              <button type="button" data-rite-action="start" data-rite-id="${sanitize(rite.id)}" ${validation.allowed ? '' : 'disabled'}>Begin Rite</button>
              <button type="button" data-rite-action="force-success" data-rite-id="${sanitize(rite.id)}" ${active ? '' : 'disabled'}>Force Success</button>
              <button type="button" data-rite-action="force-failure" data-rite-id="${sanitize(rite.id)}" ${active ? '' : 'disabled'}>Force Failure</button>
            </div>
          </article>
        `;
      }).join('')}
    </div>
    <div class="pillar-overview-summary">
      <h4>Rite Runtime</h4>
      <p>Objective: ${sanitize(activeSummary?.objectiveText || 'None')}</p>
      <p>Stage/Floor: ${sanitize(String(activeSummary?.stageIndex ?? 0))}</p>
      <p>Controller: ${sanitize(activeSummary?.controllerKey || 'n/a')}</p>
      <p>State: ${sanitize(activeSummary?.activeRiteState || 'idle')}</p>
      ${progress?.lastResult?.riteId ? `<p>Last Result: ${sanitize(progress.lastResult.riteId)} - ${sanitize(progress.lastResult.result || 'unknown')}</p>` : '<p>Last Result: None</p>'}
      ${progress?.lastResult?.proofRewardId ? `<p>Proof Granted: ${sanitize(progress.lastResult.proofRewardId)}</p>` : ''}
    </div>
  `;

  panel.querySelectorAll('button[data-rite-action]').forEach((button) => {
    const action = button.getAttribute('data-rite-action');
    const riteId = button.getAttribute('data-rite-id');
    button.addEventListener('click', () => {
      if (!action || !riteId) return;
      if (action === 'start') {
        const result = game.beginRite?.(riteId);
        if (result?.success && typeof game.requestStartRiteRun === 'function') {
          game.requestStartRiteRun(riteId);
        }
      } else if (action === 'force-success') {
        game.forceRiteSuccess?.(riteId);
      } else if (action === 'force-failure') {
        game.forceRiteFailure?.(riteId);
      }
      renderRites(panel, game);
    });
  });
}

function renderBlessingList(panel, game) {
  const validationArea = document.getElementById('pillar-validate-feedback');

  const renderAll = () => {
    const rows = game.getPillarOverviewRows();
    panel.innerHTML = rows
      .map((pillar) => {
        const blessings = [...pillar.blessingsLevel1, ...pillar.blessingsLevel2];
        const blessingRows = blessings
          .map((blessing) => {
            const status = getBlessingStatus(game, blessing, pillar);
            const disabled = pillar.isLocked || (!status.isAllocated && !status.validation.allowed);
            return `
              <li data-blessing="${blessing.id}" class="blessing-row ${status.isAllocated ? 'blessing-row--allocated' : ''}">
                <div class="blessing-title">
                  <span>${sanitize(blessing.displayName)} (${tierLabel(blessing.tier)})</span>
                  ${status.isAllocated ? '<strong>[Allocated]</strong>' : ''}
                </div>
                <p>${sanitize(blessing.description)}</p>
                <div class="blessing-status">${sanitize(formatValidationReason(status.validation, status.requirementProof))}</div>
                <div class="blessing-actions">
                  <button
                    data-action="${status.isAllocated ? 'remove' : 'add'}"
                    data-blessing="${blessing.id}"
                    ${disabled ? 'disabled' : ''}
                    title="${sanitize(disabled ? status.validation.reason || 'Unavailable' : '')}"
                    type="button"
                  >
                    ${status.isAllocated ? 'Remove' : 'Allocate'}
                  </button>
                  <span>Effect: ${sanitize(blessing.effectKey || 'TBD')}</span>
                </div>
              </li>
            `;
          })
          .join('');
        return `
          <div class="pillar-allocation-group">
            <h4>${sanitize(pillar.displayName)}</h4>
            <ul>${blessingRows}</ul>
          </div>
        `;
      })
      .join('');

    panel.querySelectorAll('button[data-action]').forEach((button) => {
      const blessingId = button.getAttribute('data-blessing');
      const action = button.getAttribute('data-action');
      button.addEventListener('click', () => {
        selectedBlessingId = blessingId;
        const result = action === 'add'
          ? game.allocatePillarBlessing(blessingId)
          : game.deallocatePillarBlessing(blessingId);
        if (!result.success) {
          if (validationArea) validationArea.textContent = result.reason;
          renderBlessingDetails(game);
          return;
        }
        if (validationArea) validationArea.textContent = '';
        renderAll();
        renderBlessingDetails(game);
      });
    });

    panel.querySelectorAll('li[data-blessing]').forEach((row) => {
      const blessingId = row.getAttribute('data-blessing');
      row.addEventListener('mouseenter', () => {
        selectedBlessingId = blessingId;
        renderBlessingDetails(game);
      });
      row.addEventListener('click', () => {
        selectedBlessingId = blessingId;
        renderBlessingDetails(game);
      });
    });
  };

  renderAll();
  renderBlessingDetails(game);
}

function renderRuntime(panel, game) {
  const runtimeSummary = typeof game.getPillarRuntimeDebugSummary === 'function'
    ? game.getPillarRuntimeDebugSummary()
    : {};
  const snapshot = typeof game.getPillarAllocationSnapshot === 'function'
    ? game.getPillarAllocationSnapshot()
    : {};
  const allocability = selectedBlessingId && typeof game.getPillarBlessingAllocability === 'function'
    ? game.getPillarBlessingAllocability(selectedBlessingId)
    : null;
  const riteSummary = typeof game.getRiteDebugSummary === 'function'
    ? game.getRiteDebugSummary()
    : null;

  const events = (runtimeSummary?.traces?.events || [])
    .slice(-8)
    .map((row) => `<li>${sanitize(row?.hookName || 'unknown')} (${sanitize(String(row?.handlerCount ?? 0))} handlers)</li>`)
    .join('');
  const stackEvents = (runtimeSummary?.stackEvents || [])
    .slice(-8)
    .map((row) => `<li>${sanitize(row?.stackId || row?.stackKey || 'stack')} ${sanitize(String(row?.before ?? 0))} -> ${sanitize(String(row?.after ?? 0))} (${sanitize(row?.source || 'unknown')})</li>`)
    .join('');
  const selfDamageEvents = (runtimeSummary?.selfDamageEvents || [])
    .slice(-8)
    .map((row) => `<li>${sanitize(row?.effectKey || row?.sourceType || 'self')} dmg=${sanitize(String(Math.round((Number(row?.rawAmount) || 0) * 100) / 100))} killed=${sanitize(String(!!row?.killed))}</li>`)
    .join('');
  const damageEvents = (runtimeSummary?.damageEvents || [])
    .slice(-8)
    .map((row) => `<li>#${sanitize(String(row?.recordId ?? '?'))} ${sanitize(row?.sourceType || 'unknown')} -> ${sanitize(row?.targetType || 'unknown')} base=${sanitize(String(Math.round((Number(row?.baseAmount) || 0) * 100) / 100))} final=${sanitize(String(Math.round((Number(row?.finalAmount) || 0) * 100) / 100))} reason=${sanitize(row?.reason || 'n/a')} effect=${sanitize(row?.effectKey || 'n/a')}</li>`)
    .join('');
  const ringEffectEvents = (runtimeSummary?.ringEffectLog || [])
    .slice(-8)
    .map((row) => `<li>mult=${sanitize(String(Math.round((Number(row?.multiplier) || 0) * 1000) / 1000))} (${sanitize(String(Math.round((Number(row?.additivePercent) || 0) * 100) / 100))}%) reason=${sanitize(row?.reason || 'n/a')}</li>`)
    .join('');
  const repeatEvents = (runtimeSummary?.attackRepeatEvents || [])
    .slice(-8)
    .map((row) => `<li>repeat=${sanitize(String(row?.repeatCount || 0))} x ${sanitize(String(Math.round((Number(row?.damageMultiplier) || 0) * 1000) / 1000))} reason=${sanitize(row?.reason || 'n/a')} effect=${sanitize(row?.effectKey || 'n/a')}</li>`)
    .join('');
  const sanitizeEvents = (runtimeSummary?.equipmentSanitization || [])
    .slice(-6)
    .map((row) => `<li>moved=${sanitize(String(row?.movedCount || 0))} source=${sanitize(row?.source || 'unknown')}</li>`)
    .join('');
  const stackSources = (runtimeSummary?.stackSources || [])
    .slice(0, 8)
    .map((row) => `<li>${sanitize(row?.source || 'unknown')}: ${sanitize(String(row?.count || 0))}</li>`)
    .join('');
  const legacyTodos = (runtimeSummary?.legacyStackSelfDamageTodos || [])
    .map((row) => `<li>${sanitize(String(row))}</li>`)
    .join('');
  const legacyDamageTodos = (runtimeSummary?.legacyDamageTodos || [])
    .map((row) => `<li>${sanitize(String(row))}</li>`)
    .join('');

  const buffs = (runtimeSummary?.temporaryBuffs || [])
    .map((buff) => `<li>${sanitize(buff?.label || buff?.id || 'unknown')}: ${sanitize(JSON.stringify(buff))}</li>`)
    .join('');
  const hitRows = (runtimeSummary?.hitClassifications || [])
    .slice(-8)
    .map((row) => `<li>${sanitize(row?.classification || 'unknown')} melee=${sanitize(String(!!row?.countsAsMelee))} ranged=${sanitize(String(!!row?.countsAsRanged))} source=${sanitize(row?.sourceType || 'unknown')}</li>`)
    .join('');
  const equipmentRows = (runtimeSummary?.equipmentLayout?.slots || [])
    .map((slot) => `<li>${sanitize(slot?.key || 'slot')}: enabled=${sanitize(String(!!slot?.enabled))} types=${sanitize((slot?.allowedItemTypes || []).join(', ') || 'none')} transformedBy=${sanitize(slot?.transformedBy || 'none')}</li>`)
    .join('');
  const topologySummary = runtimeSummary?.allocationTopology || null;
  const portability = runtimeSummary?.enemyModifierPortability || null;
  const portabilityRows = (portability?.entries || [])
    .slice(0, 14)
    .map((row) => `<li>${sanitize(row?.id || 'unknown')}: ${sanitize(row?.portability || 'unknown')} (${sanitize(row?.reason || 'n/a')})</li>`)
    .join('');
  const randomPool = runtimeSummary?.randomSkillPool || null;
  const randomEligibleRows = (randomPool?.eligible || [])
    .slice(0, 12)
    .map((row) => `<li>${sanitize(row?.id || 'unknown')} [${sanitize(row?.category || 'n/a')}]</li>`)
    .join('');
  const procGuard = runtimeSummary?.procGuard || null;
  const procRecentRows = (procGuard?.recent || [])
    .slice(-8)
    .map((row) => `<li>${sanitize(row?.source || 'unknown')} depth=${sanitize(String(row?.depthAfter ?? row?.depthBefore ?? 0))} frameUsed=${sanitize(String(row?.usedThisFrameAfter ?? row?.usedThisFrameBefore ?? 0))}</li>`)
    .join('');
  const procBlockedRows = (procGuard?.recentBlocked || [])
    .slice(-8)
    .map((row) => `<li>${sanitize(row?.source || 'unknown')} blocked=${sanitize(row?.blockedReason || 'unknown')}</li>`)
    .join('');
  const tentacleRollRows = (runtimeSummary?.tentacleRollEvents || [])
    .slice(-6)
    .map((row) => `<li>mods=${sanitize((row?.activeModifierIds || []).join(', ') || 'none')} pool=${sanitize(String(row?.poolSize || 0))} rejected=${sanitize(String((row?.rejected || []).length || 0))}</li>`)
    .join('');
  const worldDestroyRows = (runtimeSummary?.worldDestructionEvents || [])
    .slice(-10)
    .map((row) => `<li>${sanitize(row?.action || 'unknown')} ${sanitize(row?.objectType || 'unknown')} dmg=${sanitize(String(row?.finalDamage || 0))} reason=${sanitize(row?.reason || row?.protectedReason || row?.unsupportedReason || 'n/a')}</li>`)
    .join('');
  const destructibilityPreview = runtimeSummary?.destructibilityPreview || null;

  panel.innerHTML = `
    <div class="pillar-overview-grid">
    <div class="pillar-overview-summary">
      <h3>Proof / Capacity</h3>
      <p>L1 ${snapshot.usedLevel1 || 0}/${snapshot.maxLevel1 || 0}</p>
      <p>L2 ${snapshot.usedLevel2 || 0}/${snapshot.maxLevel2 || 0}</p>
      <p>Per-pillar cap: ${snapshot.maxBlessingsPerPillar || 0}</p>
      <p>Same-pillar duplicates: ${snapshot.allowSamePillarDuplicates ? 'Yes' : 'No'}</p>
      <p>Sibling exclusion: ${snapshot.enforceSiblingExclusion === false ? 'Disabled' : 'Enabled'}</p>
      <p>Level 2 topology block: ${snapshot.blockLevel2Allocation ? 'Yes' : 'No'}</p>
    </div>
      <div class="pillar-overview-summary">
        <h3>Runtime Trace</h3>
        <p>Trace enabled: <strong>${runtimeSummary.traceEnabled ? 'Yes' : 'No'}</strong></p>
        <p>Active effects: ${(runtimeSummary.activeEffectKeys || []).length}</p>
        <p>Unresolved effects: ${(runtimeSummary.unresolvedEffectKeys || []).length}</p>
        <p>Stubbed active effects: ${(runtimeSummary.stubbedActiveEffects || []).length}</p>
      </div>
    </div>
    <div class="pillar-overview-summary">
      <h3>Temporary Buffs</h3>
      <ul>${buffs || '<li>None</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Pillar Events</h3>
      <ul>${events || '<li>No events recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Stack Events</h3>
      <ul>${stackEvents || '<li>No stack events recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Self-Damage Events</h3>
      <ul>${selfDamageEvents || '<li>No self-damage events recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Damage Events</h3>
      <ul>${damageEvents || '<li>No damage events recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Ring Effect Resolutions</h3>
      <ul>${ringEffectEvents || '<li>No ring-effect resolutions recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Attack Repeat Plans</h3>
      <ul>${repeatEvents || '<li>No attack-repeat plans recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Equipment Layout Sanitization</h3>
      <ul>${sanitizeEvents || '<li>No equipment sanitization events.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Central Stack Sources</h3>
      <ul>${stackSources || '<li>No central stack usage recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Recent Hit Classifications</h3>
      <ul>${hitRows || '<li>No hit classification events recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Effective Equipment Layout</h3>
      <ul>${equipmentRows || '<li>No equipment layout data.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Allocation Topology</h3>
      <pre class="pillar-debug-output">${sanitize(JSON.stringify(topologySummary || {}, null, 2))}</pre>
    </div>
    <div class="pillar-overview-summary">
      <h3>Destructibility Preview</h3>
      <pre class="pillar-debug-output">${sanitize(JSON.stringify(destructibilityPreview || {}, null, 2))}</pre>
    </div>
    <div class="pillar-overview-summary">
      <h3>Modifier Portability</h3>
      <ul>${portabilityRows || '<li>No portability metadata.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Random Skill Pool</h3>
      <p>Eligible: ${sanitize(String(randomPool?.eligibleCount || 0))} | Excluded: ${sanitize(String(randomPool?.excludedCount || 0))}</p>
      <ul>${randomEligibleRows || '<li>No eligible random skills.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Proc / Recursion Guard</h3>
      <p>Depth: ${sanitize(String(procGuard?.depth || 0))} | Used this frame: ${sanitize(String(procGuard?.usedThisFrame || 0))}</p>
      <ul>${procRecentRows || '<li>No proc activations recorded.</li>'}</ul>
      <h4>Recent Blocks</h4>
      <ul>${procBlockedRows || '<li>No proc blocks recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Tentacles Rolls</h3>
      <ul>${tentacleRollRows || '<li>No tentacle rolls recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>World Destruction Events</h3>
      <ul>${worldDestroyRows || '<li>No world-destruction events recorded.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Legacy TODOs</h3>
      <ul>${legacyTodos || '<li>None tracked.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Legacy Damage TODOs</h3>
      <ul>${legacyDamageTodos || '<li>None tracked.</li>'}</ul>
    </div>
    <div class="pillar-overview-summary">
      <h3>Rite Framework</h3>
      <pre class="pillar-debug-output">${sanitize(JSON.stringify(riteSummary || {}, null, 2))}</pre>
    </div>
    <div class="pillar-overview-summary">
      <h3>Selected Blessing Allocability</h3>
      <p>${allocability ? sanitize((allocability.reasons || [allocability.reason || ''])[0] || 'No reason') : 'Select a blessing first.'}</p>
      <pre class="pillar-debug-output">${sanitize(JSON.stringify(allocability || {}, null, 2))}</pre>
    </div>
  `;
}

function withPanel(panelId, game) {
  const panel = document.querySelector(`#${panelId}`);
  if (!panel) {
    return;
  }
  if (panelId === 'pillar-tab-overview') {
    renderOverview(panel, game);
  } else if (panelId === 'pillar-tab-rites') {
    renderRites(panel, game);
  } else if (panelId === 'pillar-tab-blessings') {
    renderBlessingList(panel, game);
  } else if (panelId === 'pillar-tab-runtime') {
    renderRuntime(panel, game);
  }
}

function renderAllocationState(game) {
  const active = document.querySelector('.pillar-tab.active')?.getAttribute('data-tab') || 'overview';
  withPanel(`pillar-tab-${active}`, game);
  renderBlessingDetails(game);
}

function initTabs() {
  const tabs = document.querySelectorAll('.pillar-tab');
  tabs.forEach((button) => {
    if (button.dataset.pillarTabBound) {
      return;
    }
    button.dataset.pillarTabBound = '1';
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-tab');
      document.querySelectorAll('.pillar-tab').forEach((tab) => tab.classList.remove('active'));
      document.querySelectorAll('.pillar-tabpanel').forEach((panel) => panel.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`pillar-tab-${next}`)?.classList.add('active');
      renderAllocationState(gameRef);
    });
  });
}

export function openPillarSystemOverlay() {
  document.getElementById(OVERLAY_ID)?.classList.remove('hidden');
  if (gameRef) {
    renderAllocationState(gameRef);
  }
}

export function closePillarSystemOverlay() {
  document.getElementById(OVERLAY_ID)?.classList.add('hidden');
}

function renderCurrent(game) {
  const activeTab = document.querySelector('.pillar-tab.active')?.getAttribute('data-tab') || 'overview';
  withPanel(`pillar-tab-${activeTab}`, game);
  renderBlessingDetails(game);
}

export function initializePillarUI(game, options = {}) {
  if (!game) {
    return;
  }
  gameRef = game;

  const overlay = document.getElementById(OVERLAY_ID) || createMarkup();
  if (!overlay.parentElement) {
    document.body.appendChild(overlay);
  }

  const showFloatingButton = options.showFloatingButton === true;
  const openButton = ensureOpenButton(showFloatingButton);

  if (!overlay.dataset.pillarUiInitialized) {
    initTabs();
    if (openButton) {
      openButton.addEventListener('click', openPillarSystemOverlay);
    }
    overlay.addEventListener('click', (event) => {
      if (event.target && event.target.id === CLOSE_BUTTON_ID) {
        closePillarSystemOverlay();
      }
    });
    overlay.dataset.pillarUiInitialized = '1';
  }
  if (!stateUpdateBound) {
    stateUpdateBound = true;
    window.addEventListener('pillar-system-updated', () => {
      if (document.getElementById(OVERLAY_ID)?.classList.contains('hidden')) {
        return;
      }
      if (!gameRef) return;
      renderCurrent(gameRef);
    });
  }
  if (!runtimeUpdateBound) {
    runtimeUpdateBound = true;
    window.addEventListener('pillars:runtime-refreshed', () => {
      if (document.getElementById(OVERLAY_ID)?.classList.contains('hidden')) {
        return;
      }
      if (!gameRef) return;
      renderCurrent(gameRef);
      updateDebugOutput(gameRef);
    });
  }

  renderCurrent(game);
}

function updateDebugOutput(game) {
  const output = document.getElementById(DEBUG_OUTPUT_ID);
  if (!output || !game || typeof game.getPillarRuntimeDebugSummary !== 'function') {
    return;
  }
  const summary = game.getPillarRuntimeDebugSummary();
  const payload = {
    migration: typeof game.debugGetPillarSaveMigrationReport === 'function'
      ? game.debugGetPillarSaveMigrationReport()
      : null,
    allocationSnapshot: typeof game.getPillarAllocationSnapshot === 'function'
      ? game.getPillarAllocationSnapshot()
      : null,
    rites: typeof game.getRiteDebugSummary === 'function'
      ? game.getRiteDebugSummary()
      : null,
    runtime: summary
  };
  output.textContent = JSON.stringify(payload, null, 2);
}

export function initializePillarDebugTools(game) {
  if (!game) {
    return;
  }
  const host =
    document.getElementById('dev-tools') ||
    document.getElementById('dev-controls') ||
    document.querySelector('.dev-panel') ||
    document.querySelector('.dev-menu');
  if (!host) {
    return;
  }

  if (document.getElementById('pillar-debug-section')) {
    updateDebugOutput(game);
    return;
  }

  const section = document.createElement('section');
  section.id = 'pillar-debug-section';
  section.className = 'pillar-debug-section';
  section.innerHTML = `
    <h4>Pillar Debug</h4>
    <div class="pillar-debug-buttons">
      <button id="pillar-debug-grant-proofs" type="button">Grant All Proofs</button>
      <button id="pillar-debug-grant-next-proof" type="button">Grant Next Proof</button>
      <button id="pillar-debug-clear-proofs" type="button">Clear Proofs</button>
      <button id="pillar-debug-grant-item" type="button">Grant Rite Item</button>
      <button id="pillar-debug-remove-rite-item" type="button">Remove Rite Item</button>
      <button id="pillar-debug-unlock-rites" type="button">Unlock All Rites</button>
      <button id="pillar-debug-jump-rite" type="button">Jump to Rite</button>
      <button id="pillar-debug-force-rite-success" type="button">Force Rite Success</button>
      <button id="pillar-debug-force-rite-failure" type="button">Force Rite Failure</button>
      <button id="pillar-debug-reveal-fear-key-room" type="button">Reveal Fear Key Room</button>
      <button id="pillar-debug-teleport-fear-exit" type="button">Teleport to Fear Exit</button>
      <button id="pillar-debug-fear-success" type="button">Force Fear Success</button>
      <button id="pillar-debug-fear-failure" type="button">Force Fear Failure</button>
      <button id="pillar-debug-run-fear-validation" type="button">Run Fear Validation</button>
      <button id="pillar-debug-jump-monstrosity-stage" type="button">Jump Monstrosity Stage</button>
      <button id="pillar-debug-monstrosity-stage-success" type="button">Force Monstrosity Stage Success</button>
      <button id="pillar-debug-monstrosity-stage-failure" type="button">Force Monstrosity Stage Failure</button>
      <button id="pillar-debug-run-monstrosity-validation" type="button">Run Monstrosity Validation</button>
      <button id="pillar-debug-jump-torment-floor" type="button">Jump Torment Floor</button>
      <button id="pillar-debug-force-torment-descent" type="button">Force Torment Descent</button>
      <button id="pillar-debug-force-torment-ascent" type="button">Force Torment Ascent</button>
      <button id="pillar-debug-spawn-healing-orb" type="button">Spawn Healing Orb</button>
      <button id="pillar-debug-log-hazard-damage" type="button">Log Hazard Damage</button>
      <button id="pillar-debug-run-torment-validation" type="button">Run Torment Validation</button>
      <button id="pillar-debug-jump-sovereign-style" type="button">Jump Sovereign Style</button>
      <button id="pillar-debug-force-sovereign-style" type="button">Force Sovereign Style Switch</button>
      <button id="pillar-debug-log-sovereign-style" type="button">Log Sovereign Style</button>
      <button id="pillar-debug-set-sovereign-hp" type="button">Set Sovereign HP</button>
      <button id="pillar-debug-run-sovereign-validation" type="button">Run Sovereign Validation</button>
      <button id="pillar-debug-alloc-one" type="button">Allocate One Blessing</button>
      <button id="pillar-debug-clear-blessings" type="button">Reset Blessings</button>
      <button id="pillar-debug-sim-success" type="button">Simulate Legacy Trial Success</button>
      <button id="pillar-debug-sim-failure" type="button">Simulate Legacy Trial Failure</button>
      <button id="pillar-debug-sim-chest" type="button">Simulate Chest Open</button>
      <button id="pillar-debug-sim-destroy" type="button">Simulate Destroy</button>
      <button id="pillar-debug-sim-tick" type="button">Simulate Tick</button>
      <button id="pillar-debug-refresh-runtime" type="button">Refresh Runtime</button>
      <button id="pillar-debug-trace-toggle" type="button">Toggle Trace</button>
      <button id="pillar-debug-run-validation" type="button">Run Validation Suite</button>
      <button id="pillar-debug-log-runtime" type="button">Log Runtime</button>
    </div>
    <pre id="${DEBUG_OUTPUT_ID}" class="pillar-debug-output"></pre>
  `;
  host.appendChild(section);

  section.querySelector('#pillar-debug-grant-proofs').addEventListener('click', () => {
    game.grantAllPillarProofs();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-grant-next-proof').addEventListener('click', () => {
    const nextProof = game.getPillarTrialProgress?.().nextProof;
    if (nextProof?.id) {
      game.grantPillarProof?.(nextProof.id);
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-clear-proofs').addEventListener('click', () => {
    game.clearPillarProofs?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-grant-item').addEventListener('click', () => {
    game.grantPillarTrialEntryItem(1);
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-remove-rite-item').addEventListener('click', () => {
    game.removeRiteEntryItem?.(1);
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-unlock-rites').addEventListener('click', () => {
    game.unlockAllRites?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-jump-rite').addEventListener('click', () => {
    const first = game.getRiteRegistryEntries?.()?.[0];
    if (first?.id) {
      game.jumpToRite?.(first.id);
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-force-rite-success').addEventListener('click', () => {
    game.forceRiteSuccess?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-force-rite-failure').addEventListener('click', () => {
    game.forceRiteFailure?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-reveal-fear-key-room').addEventListener('click', () => {
    game.revealFearRiteKeyRoom?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-teleport-fear-exit').addEventListener('click', () => {
    game.teleportToFearRiteExit?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-fear-success').addEventListener('click', () => {
    game.forceFearRiteSuccess?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-fear-failure').addEventListener('click', () => {
    game.forceFearRiteFailure?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-run-fear-validation').addEventListener('click', () => {
    const result = game.debugRunFearRiteValidationSuite?.();
    if (typeof game.showNotification === 'function') {
      game.showNotification('Fear Validation', result?.passed ? 'All fear checks passed.' : 'Fear checks failed.');
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-jump-monstrosity-stage').addEventListener('click', () => {
    const raw = window.prompt(
      'Monstrosity stage id (nemean_beast, golden_hind, ironfeather_swarm, cerberus_capture):',
      'nemean_beast'
    );
    if (raw) {
      game.jumpToMonstrosityStage?.(raw.trim());
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-monstrosity-stage-success').addEventListener('click', () => {
    game.forceMonstrosityStageSuccess?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-monstrosity-stage-failure').addEventListener('click', () => {
    game.forceMonstrosityStageFailure?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-run-monstrosity-validation').addEventListener('click', () => {
    const result = game.debugRunMonstrosityValidationSuite?.();
    if (typeof game.showNotification === 'function') {
      game.showNotification(
        'Monstrosity Validation',
        result?.passed ? 'All monstrosity checks passed.' : 'Monstrosity checks failed.'
      );
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-jump-torment-floor').addEventListener('click', () => {
    const raw = window.prompt('Torment floor index (1-3):', '1');
    if (raw != null) {
      game.jumpToTormentFloor?.(Number(raw));
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-force-torment-descent').addEventListener('click', () => {
    game.forceDescent?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-force-torment-ascent').addEventListener('click', () => {
    game.forceAscent?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-spawn-healing-orb').addEventListener('click', () => {
    game.spawnHealingOrb?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-log-hazard-damage').addEventListener('click', () => {
    game.logHazardDamage?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-run-torment-validation').addEventListener('click', () => {
    const result = game.debugRunTormentValidationSuite?.();
    if (typeof game.showNotification === 'function') {
      game.showNotification(
        'Torment Validation',
        result?.passed ? 'All torment checks passed.' : 'Torment checks failed.'
      );
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-jump-sovereign-style').addEventListener('click', () => {
    const raw = window.prompt(
      'Sovereign style id (the_deep, havoc, weapon_master, limitless, void, pacifier, collector, cascade):',
      'the_deep'
    );
    if (raw) {
      game.jumpToSovereignStyle?.(raw.trim());
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-force-sovereign-style').addEventListener('click', () => {
    game.forceStyleSwitch?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-log-sovereign-style').addEventListener('click', () => {
    game.logBossStyle?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-set-sovereign-hp').addEventListener('click', () => {
    const raw = window.prompt('Set Sovereign HP:', '1000');
    if (raw != null) {
      game.setBossHP?.(Number(raw));
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-run-sovereign-validation').addEventListener('click', () => {
    const result = game.debugRunSovereignValidationSuite?.();
    if (typeof game.showNotification === 'function') {
      game.showNotification(
        'Sovereign Validation',
        result?.passed ? 'All sovereign checks passed.' : 'Sovereign checks failed.'
      );
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-alloc-one').addEventListener('click', () => {
    game.allocateFirstAvailablePillarBlessing?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-clear-blessings').addEventListener('click', () => {
    game.clearPillarAllocations();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-sim-success').addEventListener('click', () => {
    game.simulatePillarTrialSuccess();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-sim-failure').addEventListener('click', () => {
    game.simulatePillarTrialFailure();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-sim-chest').addEventListener('click', () => {
    game.simulatePillarChestOpen?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-sim-destroy').addEventListener('click', () => {
    game.simulatePillarDestroyEvent?.();
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-sim-tick').addEventListener('click', () => {
    game.debugSimulatePillarTick?.(1);
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-refresh-runtime').addEventListener('click', () => {
    game.refreshPillarRuntimeState?.('debug_manual_refresh');
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-trace-toggle').addEventListener('click', () => {
    const enabled = game.setPillarTraceEnabled?.(!game.isPillarTraceEnabled?.());
    if (typeof game.showNotification === 'function') {
      game.showNotification('Pillar Debug', `Trace ${enabled ? 'enabled' : 'disabled'}.`);
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-run-validation').addEventListener('click', () => {
    const result = game.debugRunPillarValidationSuite?.();
    if (typeof game.showNotification === 'function') {
      game.showNotification('Pillar Validation', result?.passed ? 'All checks passed.' : 'One or more checks failed.');
    }
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-log-runtime').addEventListener('click', () => {
    game.debugPrintPillarRuntimeSummary?.();
    updateDebugOutput(game);
  });

  updateDebugOutput(game);
}
