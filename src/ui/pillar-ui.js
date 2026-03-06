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
        <button class="pillar-tab" data-tab="trials" type="button">Trial Progress</button>
        <button class="pillar-tab" data-tab="blessings" type="button">Blessing Allocation</button>
      </div>
      <section id="pillar-tab-overview" class="pillar-tabpanel active"></section>
      <section id="pillar-tab-trials" class="pillar-tabpanel"></section>
      <section id="pillar-tab-blessings" class="pillar-tabpanel"></section>
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
  if (validation.details === 'pillar_locked') {
    return 'This pillar is locked';
  }
  return validation.reason || 'Unavailable';
}

function getBlessingStatus(game, blessing, pillar) {
  const isAllocated = !!game.hasPillarBlessing(blessing.id);
  const validation = isAllocated
    ? { allowed: true, reason: 'Allocated' }
    : (pillar.isLocked
      ? { allowed: false, reason: 'This pillar is locked.', details: 'pillar_locked' }
      : game.canAllocatePillarBlessing(blessing.id));
  const requirementProof = getProofRequirementForBlessingTier(blessing.tier);
  const siblings = [...(pillar.blessingsLevel1 || []), ...(pillar.blessingsLevel2 || [])];
  const allocatedSibling = siblings.find((entry) => entry.id !== blessing.id && game.hasPillarBlessing(entry.id));
  const snapshot = game.getPillarAllocationSnapshot();

  const lines = [
    requirementProof ? `Proof requirement: ${requirementProof.displayName}` : 'Proof requirement: None',
    isAllocated ? 'Status: Allocated' : `Status: ${formatValidationReason(validation, requirementProof)}`,
    allocatedSibling ? `Mutually exclusive with ${allocatedSibling.displayName}` : 'Mutual exclusivity: none active',
    `Limits: L1 ${snapshot.usedLevel1}/${snapshot.maxLevel1}, L2 ${snapshot.usedLevel2}/${snapshot.maxLevel2}`
  ];

  return {
    isAllocated,
    validation,
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
  detailsArea.innerHTML = `
    <p><strong>${sanitize(blessing.displayName)}</strong> (${tierLabel(blessing.tier)})</p>
    <p><strong>Pillar:</strong> ${sanitize(pillar.displayName)}</p>
    <p>${sanitize(blessing.description)}</p>
    <p><strong>Effect Key:</strong> ${sanitize(blessing.effectKey || 'TBD')}</p>
    <p><strong>Allocatable:</strong> ${status.validation.allowed || status.isAllocated ? 'Yes' : 'No'}</p>
    <p><strong>Status:</strong> ${sanitize(formatValidationReason(status.validation, status.requirementProof))}</p>
    <p><strong>Mutual exclusion:</strong> ${status.allocatedSibling ? sanitize(status.allocatedSibling.displayName) : 'None'}</p>
    <p><strong>Allocation summary:</strong> ${sanitize(status.lines[3])}</p>
  `;
}

function renderOverview(panel, game) {
  const snapshot = game.getPillarAllocationSnapshot();
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
      </div>
    </div>
    <div class="pillar-proof-progress">
      <h3>Trial clear count: ${progress.trialClearCount}</h3>
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

function renderTrials(panel, game) {
  const progress = game.getPillarTrialProgress();
  const proofs = game.getAllPillarProofEntries();
  const proofMarkup = proofs
    .map((proof) => {
      const earned = progress.earnedProofs.includes(proof.id) ? '<span class="earned">[Y]</span>' : '';
      return `<li>${sanitize(proof.displayName)} ${earned}<br><small>${sanitize(proof.description)}</small></li>`;
    })
    .join('');

  panel.innerHTML = `
    <h3>Trial Progress</h3>
    <p>Trial clears completed: <strong>${progress.trialClearCount}</strong></p>
    <p>Entry item owned: <strong>${game.getPillarTrialItemCount()}</strong></p>
    <p>Next proof on next success: ${progress.nextProof ? sanitize(progress.nextProof.displayName) : 'None'}</p>
    <ul class="pillar-proof-list">${proofMarkup}</ul>
  `;
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

function withPanel(panelId, game) {
  const panel = document.querySelector(`#${panelId}`);
  if (!panel) {
    return;
  }
  if (panelId === 'pillar-tab-overview') {
    renderOverview(panel, game);
  } else if (panelId === 'pillar-tab-trials') {
    renderTrials(panel, game);
  } else if (panelId === 'pillar-tab-blessings') {
    renderBlessingList(panel, game);
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
  output.textContent = JSON.stringify(summary, null, 2);
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
      <button id="pillar-debug-grant-item" type="button">Grant Trial Item</button>
      <button id="pillar-debug-alloc-one" type="button">Allocate One Blessing</button>
      <button id="pillar-debug-clear-blessings" type="button">Reset Blessings</button>
      <button id="pillar-debug-sim-success" type="button">Simulate Trial Success</button>
      <button id="pillar-debug-sim-failure" type="button">Simulate Trial Failure</button>
      <button id="pillar-debug-sim-chest" type="button">Simulate Chest Open</button>
      <button id="pillar-debug-sim-destroy" type="button">Simulate Destroy</button>
      <button id="pillar-debug-refresh-runtime" type="button">Refresh Runtime</button>
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
  section.querySelector('#pillar-debug-refresh-runtime').addEventListener('click', () => {
    game.refreshPillarRuntimeState?.('debug_manual_refresh');
    updateDebugOutput(game);
  });
  section.querySelector('#pillar-debug-log-runtime').addEventListener('click', () => {
    game.debugPrintPillarRuntimeSummary?.();
    updateDebugOutput(game);
  });

  updateDebugOutput(game);
}
