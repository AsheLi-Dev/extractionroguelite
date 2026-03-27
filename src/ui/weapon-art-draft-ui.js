import { escapeHtml } from "../utils.js";
import {
  getPendingWeaponArtTypes,
  getUnlockableBoardCells,
  getWeaponArtBoardDefinition,
  getWeaponArtBoardState,
  unlockWeaponArtBoardCell
} from "../data/basic-attack-progression.js";

let activeSession = null;

function getOverlayEl() {
  return document.getElementById("weapon-art-draft-overlay");
}

function getBodyEl() {
  return document.getElementById("weapon-art-draft-body");
}

function buildQueue(preferredAttackType = null) {
  const pending = getPendingWeaponArtTypes();
  if (!preferredAttackType || !pending.includes(preferredAttackType)) return pending;
  return [preferredAttackType, ...pending.filter((attackType) => attackType !== preferredAttackType)];
}

function getCurrentAttackType() {
  return activeSession?.queue?.[activeSession.queueIndex] || null;
}

function finishSession() {
  const overlay = getOverlayEl();
  if (overlay) overlay.classList.add("hidden");
  const callback = activeSession?.onComplete;
  activeSession = null;
  if (typeof callback === "function") callback();
}

function advanceQueueIfNeeded() {
  while (activeSession && activeSession.queueIndex < activeSession.queue.length) {
    const attackType = activeSession.queue[activeSession.queueIndex];
    const state = getWeaponArtBoardState(attackType);
    if ((state.pendingUnlockCount || 0) > 0) return true;
    activeSession.queueIndex += 1;
  }
  return false;
}

function getBoardBounds(def) {
  const xs = def.mask.map(([x]) => x);
  const ys = def.mask.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function renderBoard(attackType) {
  const def = getWeaponArtBoardDefinition(attackType);
  const state = getWeaponArtBoardState(attackType);
  const bounds = getBoardBounds(def);
  const unlocked = new Set(state.unlockedCells || []);
  const unlockable = new Set(getUnlockableBoardCells(attackType, state).map((cell) => cell.key));
  const occupied = new Map();
  for (const placement of state.placedUpgrades || []) {
    for (const key of placement.cells || []) occupied.set(key, placement);
  }
  const mask = new Set(def.maskKeys);

  let html = `<div class="weapon-art-board-grid draft-grid" style="--board-cols:${bounds.maxX - bounds.minX + 1};--board-rows:${bounds.maxY - bounds.minY + 1};">`;
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const key = `${x},${y}`;
      if (!mask.has(key)) {
        html += `<button type="button" class="weapon-art-board-cell void" disabled></button>`;
        continue;
      }
      const placement = occupied.get(key);
      const classes = ["weapon-art-board-cell"];
      if (placement) classes.push("occupied");
      else if (unlocked.has(key)) classes.push("unlocked");
      else classes.push("locked");
      if (unlockable.has(key)) classes.push("unlockable");
      const color = placement ? def.upgradePieces?.[placement.upgradeId]?.color : "";
      const text = placement ? escapeHtml((placement.upgradeId || "").slice(0, 2).toUpperCase()) : (unlockable.has(key) ? "+" : "");
      html += `<button type="button" class="${classes.join(" ")}" data-unlock-cell="${escapeHtml(key)}"${color ? ` style="--cell-accent:${escapeHtml(color)}"` : ""}>${text}</button>`;
    }
  }
  html += "</div>";
  return html;
}

function bindHandlers() {
  const body = getBodyEl();
  if (!body || !activeSession) return;

  body.querySelectorAll("[data-unlock-cell]").forEach((button) => {
    button.addEventListener("click", () => {
      const attackType = getCurrentAttackType();
      const cellKey = button.getAttribute("data-unlock-cell");
      if (!attackType || !cellKey) return;
      const next = unlockWeaponArtBoardCell(attackType, cellKey);
      if (!next) return;
      renderWeaponArtDraftOverlay();
    });
  });

  body.querySelectorAll("[data-draft-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-draft-action");
      if (action === "skip") {
        activeSession.queueIndex += 1;
        renderWeaponArtDraftOverlay();
      } else if (action === "close") {
        finishSession();
      }
    });
  });
}

export function renderWeaponArtDraftOverlay() {
  const overlay = getOverlayEl();
  const body = getBodyEl();
  if (!overlay || !body || !activeSession) return;

  if (!advanceQueueIfNeeded()) {
    finishSession();
    return;
  }

  const attackType = getCurrentAttackType();
  const def = getWeaponArtBoardDefinition(attackType);
  const state = getWeaponArtBoardState(attackType);
  const unlockable = getUnlockableBoardCells(attackType, state);
  const totalPending = activeSession.queue.reduce((sum, queuedAttackType) => {
    return sum + (getWeaponArtBoardState(queuedAttackType).pendingUnlockCount || 0);
  }, 0);

  body.innerHTML = `
    <div class="weapon-art-draft-header">
      <div>
        <h1 class="weapon-art-draft-title">${escapeHtml(def?.name || attackType)} Unlock Board</h1>
        <p class="weapon-art-draft-subtitle">Spend pending unlock picks on cells adjacent to already opened cells.</p>
      </div>
      <div class="weapon-art-draft-pending">
        <span>Current Art Unlocks: <strong>${state.pendingUnlockCount || 0}</strong></span>
        <span>Total Pending: <strong>${totalPending}</strong></span>
      </div>
    </div>
    <div class="weapon-art-draft-layout">
      <div class="weapon-art-draft-main">
        <div class="weapon-art-draft-board-card${def?.boardArt ? " art-backed" : ""}"${def?.boardArt ? ` style="--weapon-art-board-image:url('${escapeHtml(def.boardArt)}')"` : ""}>
          ${renderBoard(attackType)}
        </div>
      </div>
      <div class="weapon-art-draft-sidebar">
        <div class="weapon-art-draft-side-card">
          <h3 class="weapon-art-draft-side-title">Unlock Rules</h3>
          <div class="weapon-art-draft-summary-line"><span>Unlocked Cells</span><strong>${state.unlockedCells.length}</strong></div>
          <div class="weapon-art-draft-summary-line"><span>Frontier Cells</span><strong>${unlockable.length}</strong></div>
          <div class="weapon-art-draft-summary-line"><span>Placed Pieces</span><strong>${state.placedUpgrades.length}</strong></div>
          <div class="weapon-art-draft-summary-evo">Click any highlighted <strong>+</strong> cell to unlock it. Piece placement happens from the main Weapon Art screen.</div>
        </div>
        <div class="weapon-art-draft-side-card">
          <h3 class="weapon-art-draft-side-title">Actions</h3>
          <button type="button" class="weapon-art-draft-token-btn" data-draft-action="skip">Next Pending Art</button>
          <button type="button" class="weapon-art-draft-token-btn" data-draft-action="close">Close</button>
        </div>
      </div>
    </div>
  `;

  overlay.classList.remove("hidden");
  bindHandlers();
}

export function openWeaponArtDraftOverlay(options = {}) {
  const queue = buildQueue(options.preferredAttackType || null);
  if (queue.length === 0) {
    if (typeof options.onComplete === "function") options.onComplete();
    return;
  }
  activeSession = {
    queue,
    queueIndex: 0,
    onComplete: options.onComplete
  };
  renderWeaponArtDraftOverlay();
}
