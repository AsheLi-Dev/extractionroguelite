import { escapeHtml } from "../utils.js";
import { ATTACK_TYPES } from "../data/conditions.js";
import {
  canPlaceUpgradePiece,
  canMoveWeaponArtUpgradePiece,
  clearWeaponArtBoardPlacements,
  getBasicAttackTreeSummary,
  getHeroSelectableWeaponArts,
  getWeaponArtBoardDefinition,
  getWeaponArtBoardState,
  getWeaponArtCategories,
  getWeaponArtCategoryLabel,
  getWeaponArtOwnerHeroId,
  getWeaponArtShareLevelRequirement,
  getWeaponArtTokenInventory,
  hasPendingWeaponArtChoices,
  isWeaponArtSharedUnlocked,
  moveWeaponArtUpgradePiece,
  placeWeaponArtUpgradePiece,
  removeWeaponArtUpgradePiece
} from "../data/basic-attack-progression.js";
import { getPlayableCharacterOrDefault } from "../data/playable-characters.js";
import { openWeaponArtDraftOverlay } from "./weapon-art-draft-ui.js";

let selectedAttackType = ATTACK_TYPES?.[0]?.id || "projectile";
const selectedUpgradeByAttack = new Map();
const pickedPlacementByAttack = new Map();
const removeModeByAttack = new Map();

function isHubActive() {
  return document.body.classList.contains("home-base-active");
}

function getSelectedUpgradeId(attackType) {
  return selectedUpgradeByAttack.get(attackType) || null;
}

function setSelectedUpgradeId(attackType, upgradeId) {
  if (!upgradeId) selectedUpgradeByAttack.delete(attackType);
  else selectedUpgradeByAttack.set(attackType, upgradeId);
}

function getPickedPlacementId(attackType) {
  return pickedPlacementByAttack.get(attackType) || null;
}

function setPickedPlacementId(attackType, instanceId) {
  if (!instanceId) pickedPlacementByAttack.delete(attackType);
  else pickedPlacementByAttack.set(attackType, instanceId);
}

function isRemoveModeEnabled(attackType) {
  return removeModeByAttack.get(attackType) === true;
}

function setRemoveModeEnabled(attackType, enabled) {
  if (!enabled) removeModeByAttack.delete(attackType);
  else removeModeByAttack.set(attackType, true);
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

function createPiecePreview(piece) {
  if (!piece?.offsets?.length) return "";
  const xs = piece.offsets.map(([x]) => x);
  const ys = piece.offsets.map(([, y]) => y);
  const width = Math.max(...xs) + 1;
  const height = Math.max(...ys) + 1;
  const cells = new Set(piece.offsets.map(([x, y]) => `${x},${y}`));
  let html = `<span class="weapon-art-piece-preview" style="--piece-cols:${width};--piece-rows:${height};">`;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const filled = cells.has(`${x},${y}`);
      html += `<span class="weapon-art-piece-preview-cell${filled ? " filled" : ""}"${filled ? ` style="--piece-color:${escapeHtml(piece.color || "#94a3b8")}"` : ""}></span>`;
    }
  }
  html += "</span>";
  return html;
}

function renderBoard(attackType) {
  const def = getWeaponArtBoardDefinition(attackType);
  const state = getWeaponArtBoardState(attackType);
  const bounds = getBoardBounds(def);
  const unlocked = new Set(state.unlockedCells || []);
  const occupied = new Map();
  for (const placement of state.placedUpgrades || []) {
    for (const key of placement.cells || []) occupied.set(key, placement);
  }
  const selectedUpgradeId = getSelectedUpgradeId(attackType);
  const pickedPlacementId = getPickedPlacementId(attackType);
  const removeMode = isRemoveModeEnabled(attackType);
  const mask = new Set(def.maskKeys);
  let html = `<div class="weapon-art-board-grid" style="--board-cols:${bounds.maxX - bounds.minX + 1};--board-rows:${bounds.maxY - bounds.minY + 1};">`;
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const key = `${x},${y}`;
      if (!mask.has(key)) {
        html += `<button type="button" class="weapon-art-board-cell void" disabled></button>`;
        continue;
      }
      const placement = occupied.get(key);
      const unlockedClass = unlocked.has(key) ? "unlocked" : "locked";
      const canAnchorPlace = pickedPlacementId
        ? canMoveWeaponArtUpgradePiece(attackType, pickedPlacementId, key, state).ok
        : (selectedUpgradeId
          ? canPlaceUpgradePiece(attackType, selectedUpgradeId, key, state).ok
          : false);
      const classes = ["weapon-art-board-cell", unlockedClass];
      if (placement) classes.push("occupied");
      if (canAnchorPlace) classes.push("placeable");
      if (placement?.instanceId === pickedPlacementId) classes.push("picked");
      if (removeMode && placement) classes.push("remove-target");
      const color = placement
        ? def.upgradePieces?.[placement.upgradeId]?.color
        : "";
      const text = placement ? escapeHtml((placement.upgradeId || "").slice(0, 2).toUpperCase()) : "";
      html += `<button type="button" class="${classes.join(" ")}" data-board-cell="${escapeHtml(key)}"${placement ? ` data-placement-instance-id="${escapeHtml(placement.instanceId)}"` : ""}${color ? ` style="--cell-accent:${escapeHtml(color)}"` : ""}>${text}</button>`;
    }
  }
  html += "</div>";
  return html;
}

function renderAvailableUpgrades(attackType) {
  const def = getWeaponArtBoardDefinition(attackType);
  const state = getWeaponArtBoardState(attackType);
  const selectedUpgradeId = getSelectedUpgradeId(attackType);
  const pickedPlacementId = getPickedPlacementId(attackType);
  const counts = {};
  for (const placement of state.placedUpgrades || []) {
    counts[placement.upgradeId] = (counts[placement.upgradeId] || 0) + 1;
  }
  const upgrades = def.nodes
    .map((node) => {
      const currentRank = counts[node.upgradeId] || 0;
      const remaining = Math.max(0, (node.rankMax || 1) - currentRank);
      const piece = def.upgradePieces?.[node.upgradeId];
      const hasPlacement = remaining > 0 && def.maskKeys.some((cellKey) => canPlaceUpgradePiece(attackType, node.upgradeId, cellKey, state).ok);
      return { node, currentRank, remaining, piece, hasPlacement };
    })
    .filter((entry) => entry.remaining > 0 || entry.currentRank > 0);

  return `<div class="weapon-art-upgrade-list">
    ${upgrades.map(({ node, currentRank, remaining, piece, hasPlacement }) => `
      <button type="button" class="weapon-art-upgrade-card${selectedUpgradeId === node.upgradeId ? " selected" : ""}" data-upgrade-id="${escapeHtml(node.upgradeId)}" ${hasPlacement ? "" : "disabled"}>
        <span class="weapon-art-upgrade-card-top">
          <span class="weapon-art-upgrade-name">${escapeHtml(node.name)}</span>
          <span class="weapon-art-upgrade-rank">${currentRank}/${node.rankMax}</span>
        </span>
        <span class="weapon-art-upgrade-desc">${escapeHtml(node.description || "")}</span>
        <span class="weapon-art-upgrade-meta">${escapeHtml(getWeaponArtCategoryLabel(node.lane))} | ${escapeHtml(node.rarity)}</span>
        <span class="weapon-art-upgrade-preview-row">
          ${createPiecePreview(piece)}
          <span class="weapon-art-upgrade-remaining">${remaining > 0 ? `${remaining} slot${remaining === 1 ? "" : "s"} left` : "Maxed"}</span>
        </span>
      </button>
    `).join("")}
  </div>`;
}

function bindInteractions() {
  const contentEl = document.getElementById("basic-attack-tree-content");
  if (!contentEl) return;

  contentEl.querySelectorAll("[data-upgrade-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const upgradeId = button.getAttribute("data-upgrade-id");
      setRemoveModeEnabled(selectedAttackType, false);
      setPickedPlacementId(selectedAttackType, null);
      setSelectedUpgradeId(selectedAttackType, getSelectedUpgradeId(selectedAttackType) === upgradeId ? null : upgradeId);
      renderBasicAttackTree();
    });
  });

  contentEl.querySelectorAll("[data-board-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-board-action");
      if (action === "clear") {
        clearWeaponArtBoardPlacements(selectedAttackType);
        setSelectedUpgradeId(selectedAttackType, null);
        setPickedPlacementId(selectedAttackType, null);
        setRemoveModeEnabled(selectedAttackType, false);
        renderBasicAttackTree();
        return;
      }
      if (action === "remove-mode") {
        const nextEnabled = !isRemoveModeEnabled(selectedAttackType);
        setRemoveModeEnabled(selectedAttackType, nextEnabled);
        if (nextEnabled) {
          setSelectedUpgradeId(selectedAttackType, null);
          setPickedPlacementId(selectedAttackType, null);
        }
        renderBasicAttackTree();
      }
    });
  });

  contentEl.querySelectorAll("[data-board-cell]").forEach((button) => {
    button.addEventListener("click", () => {
      const removeMode = isRemoveModeEnabled(selectedAttackType);
      const pickedPlacementId = getPickedPlacementId(selectedAttackType);
      const upgradeId = getSelectedUpgradeId(selectedAttackType);
      const cellKey = button.getAttribute("data-board-cell");
      const clickedPlacementId = button.getAttribute("data-placement-instance-id");
      if (!cellKey) return;

      if (removeMode) {
        if (!clickedPlacementId) return;
        const removed = removeWeaponArtUpgradePiece(selectedAttackType, clickedPlacementId);
        if (!removed) return;
        renderBasicAttackTree();
        return;
      }

      if (pickedPlacementId) {
        const moved = moveWeaponArtUpgradePiece(selectedAttackType, pickedPlacementId, cellKey);
        if (!moved) {
          if (clickedPlacementId && clickedPlacementId === pickedPlacementId) {
            setPickedPlacementId(selectedAttackType, null);
            renderBasicAttackTree();
          }
          return;
        }
        setPickedPlacementId(selectedAttackType, null);
        renderBasicAttackTree();
        return;
      }

      if (clickedPlacementId) {
        setSelectedUpgradeId(selectedAttackType, null);
        setPickedPlacementId(
          selectedAttackType,
          getPickedPlacementId(selectedAttackType) === clickedPlacementId ? null : clickedPlacementId
        );
        renderBasicAttackTree();
        return;
      }

      if (!upgradeId) return;
      const placed = placeWeaponArtUpgradePiece(selectedAttackType, upgradeId, cellKey);
      if (!placed) return;
      renderBasicAttackTree();
    });
  });
}

export function renderBasicAttackTree() {
  const overlay = document.getElementById("basic-attack-tree-overlay");
  const selectorEl = document.getElementById("basic-attack-tree-selector");
  const summaryEl = document.getElementById("basic-attack-tree-summary");
  const contentEl = document.getElementById("basic-attack-tree-content");
  const resolveBtn = document.getElementById("basic-attack-tree-resolve");
  if (!overlay || !selectorEl || !summaryEl || !contentEl || !resolveBtn) return;

  if (!ATTACK_TYPES.some((entry) => entry.id === selectedAttackType)) {
    selectedAttackType = ATTACK_TYPES?.[0]?.id || "projectile";
  }

  const def = getWeaponArtBoardDefinition(selectedAttackType);
  const summary = getBasicAttackTreeSummary(selectedAttackType);
  const ownerHeroId = getWeaponArtOwnerHeroId(selectedAttackType);
  const ownerHero = ownerHeroId ? getPlayableCharacterOrDefault(ownerHeroId) : null;
  const sharedUnlocked = isWeaponArtSharedUnlocked(selectedAttackType, summary);
  const xpPct = summary.maxLevel <= summary.level || summary.xpToNext <= 0
    ? 100
    : Math.max(0, Math.min(100, Math.round((summary.xpInLevel / summary.xpToNext) * 100)));
  const tokens = getWeaponArtTokenInventory();

  selectorEl.innerHTML = ATTACK_TYPES.map((entry) => `
    <button type="button" class="basic-attack-tree-attack-btn${entry.id === selectedAttackType ? " selected" : ""}" data-attack-type="${escapeHtml(entry.id)}">
      ${escapeHtml(entry.name)}
    </button>
  `).join("");

  summaryEl.innerHTML = `
    <div class="basic-attack-tree-summary-row">
      <span class="basic-attack-tree-summary-name">${escapeHtml(def?.name || selectedAttackType)}</span>
      <span class="basic-attack-tree-summary-stat">Level ${summary.level}${summary.maxLevel > 0 ? ` / ${summary.maxLevel}` : ""}</span>
      <span class="basic-attack-tree-summary-stat">Pending Unlocks ${summary.pendingUnlockCount || 0}</span>
      <span class="basic-attack-tree-summary-stat">Placed ${summary.placedUpgradeCount || 0}</span>
    </div>
    <div class="basic-attack-tree-xp-track">
      <div class="basic-attack-tree-xp-fill" style="width:${xpPct}%"></div>
    </div>
    <div class="basic-attack-tree-summary-row">
      <span class="basic-attack-tree-summary-stat">${summary.maxLevel <= summary.level ? "Max level" : `${summary.xpInLevel} / ${summary.xpToNext} Weapon Art XP`}</span>
      <span class="basic-attack-tree-summary-stat">${ownerHero ? `Owner: ${escapeHtml(ownerHero.name)}` : "Owner: Shared"}</span>
      <span class="basic-attack-tree-summary-stat">${sharedUnlocked ? "Shared unlock: Ready" : `Shared unlock at Lv ${getWeaponArtShareLevelRequirement()}`}</span>
      <span class="basic-attack-tree-summary-stat">Tokens: R ${tokens.refresh || 0} | I ${tokens.insight || 0} | E ${tokens.expansion || 0} | P ${tokens.precision || 0}</span>
    </div>
    <div class="basic-attack-tree-summary-row">
      <span class="basic-attack-tree-summary-stat">Unlocked Cells ${summary.unlockedCellCount || 0} / ${summary.totalCellCount || 0}</span>
      <span class="basic-attack-tree-summary-stat">Categories: ${escapeHtml(getWeaponArtCategories(selectedAttackType).map((category) => getWeaponArtCategoryLabel(category)).join(", "))}</span>
    </div>
  `;

  resolveBtn.disabled = !hasPendingWeaponArtChoices();
  resolveBtn.textContent = hasPendingWeaponArtChoices() ? "Resolve Pending Unlocks" : "No Pending Unlocks";

  const selectedUpgradeId = getSelectedUpgradeId(selectedAttackType);
  const pickedPlacementId = getPickedPlacementId(selectedAttackType);
  const removeMode = isRemoveModeEnabled(selectedAttackType);
  const selectedUpgradeMeta = selectedUpgradeId
    ? def.nodes.find((node) => node.upgradeId === selectedUpgradeId)
    : null;
  const pickedPlacementMeta = pickedPlacementId
    ? (getWeaponArtBoardState(selectedAttackType).placedUpgrades || []).find((placement) => placement.instanceId === pickedPlacementId)
    : null;
  const pickedNodeMeta = pickedPlacementMeta
    ? def.nodes.find((node) => node.upgradeId === pickedPlacementMeta.upgradeId)
    : null;

  contentEl.innerHTML = `
    <div class="weapon-art-board-actions">
      <button type="button" class="weapon-art-board-action-btn${removeMode ? " active" : ""}" data-board-action="remove-mode">
        ${removeMode ? "Exit Remove Mode" : "Remove Blocks"}
      </button>
      <button type="button" class="weapon-art-board-action-btn danger" data-board-action="clear" ${summary.placedUpgradeCount > 0 ? "" : "disabled"}>
        Empty Board
      </button>
    </div>
    <section class="weapon-art-board-shell">
      <div class="weapon-art-board-panel${def?.boardArt ? " art-backed" : ""}"${def?.boardArt ? ` style="--weapon-art-board-image:url('${escapeHtml(def.boardArt)}')"` : ""}>
        <div class="weapon-art-board-panel-header">
          <h3 class="basic-attack-tree-section-title">Upgrade Board</h3>
          <span class="weapon-art-board-hint">${
            removeMode
              ? "Remove mode is on. Click any placed block to remove that piece from the board."
              :
            pickedNodeMeta
              ? `Picked up: ${escapeHtml(pickedNodeMeta.name)}. Click a highlighted cell to move it.`
              : (selectedUpgradeMeta
                ? `Selected piece: ${escapeHtml(selectedUpgradeMeta.name)}`
                : "Select a piece to place it, or click a placed block to pick it up and move it.")
          }</span>
        </div>
        ${renderBoard(selectedAttackType)}
      </div>
      <div class="weapon-art-board-side">
        <div class="weapon-art-board-side-card">
          <h3 class="basic-attack-tree-section-title">Available Pieces</h3>
          <p class="weapon-art-board-copy">Damage uses T pieces, Rhythm uses Z, Control uses L, and the fourth category uses unique silhouettes.</p>
          ${renderAvailableUpgrades(selectedAttackType)}
        </div>
      </div>
    </section>
  `;

  selectorEl.querySelectorAll("[data-attack-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedAttackType = btn.dataset.attackType || selectedAttackType;
      renderBasicAttackTree();
    });
  });

  resolveBtn.onclick = () => {
    openWeaponArtDraftOverlay({
      preferredAttackType: selectedAttackType,
      onComplete: () => renderBasicAttackTree()
    });
  };

  bindInteractions();
}

export function openBasicAttackTree() {
  renderBasicAttackTree();
  const overlay = document.getElementById("basic-attack-tree-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

export function closeBasicAttackTree() {
  const overlay = document.getElementById("basic-attack-tree-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (isHubActive()) {
    if (mainMenu) mainMenu.classList.add("hidden");
    document.querySelector(".game-root")?.classList.remove("hidden");
  } else if (mainMenu) {
    mainMenu.classList.remove("hidden");
  }
}
