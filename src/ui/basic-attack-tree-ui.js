import { escapeHtml } from "../utils.js";
import { ATTACK_TYPES } from "../data/conditions.js";
import {
  canPurchaseBasicAttackNode,
  getBasicAttackNode,
  getBasicAttackNodeMinSpentPoints,
  getBasicAttackProgress,
  getBasicAttackTree,
  getBasicAttackTreeSummary,
  getWeaponArtOwnerHeroId,
  getWeaponArtShareLevelRequirement,
  getWeaponArtTokenInventory,
  hasPendingWeaponArtChoices,
  isWeaponArtSharedUnlocked
} from "../data/basic-attack-progression.js";
import { getPlayableCharacterOrDefault } from "../data/playable-characters.js";
import { openWeaponArtDraftOverlay } from "./weapon-art-draft-ui.js";

let selectedAttackType = ATTACK_TYPES?.[0]?.id || "projectile";

function isHubActive() {
  return document.body.classList.contains("home-base-active");
}

function getNodeState(attackType, node, progress) {
  const rank = Number(progress?.purchasedRanks?.[node.id] || 0);
  if (rank >= node.rankMax) return "purchased";
  return canPurchaseBasicAttackNode(attackType, node.id, progress) ? "available" : "locked";
}

function renderNode(attackType, node, progress) {
  const state = getNodeState(attackType, node, progress);
  const rank = Number(progress?.purchasedRanks?.[node.id] || 0);
  const minSpentPoints = getBasicAttackNodeMinSpentPoints(attackType, node.id);
  const requirementParts = [];
  if (node.levelRequirement > 1) requirementParts.push(`Req Lv.${node.levelRequirement}`);
  if (minSpentPoints > 0) requirementParts.push(`Spend ${minSpentPoints}+`);
  const requirement = requirementParts.length > 0 ? requirementParts.join(" | ") : "Unlocked";
  const rankText = node.rankMax > 1 ? `Rank ${rank}/${node.rankMax}` : (rank > 0 ? "Purchased" : "Draftable");
  const rarityClass = `rarity-${String(node.rarity || "common").toLowerCase()}`;
  return `<article class="basic-attack-tree-node ${state}">
    <span class="basic-attack-tree-node-name ${escapeHtml(rarityClass)}">${escapeHtml(node.name)}</span>
    <span class="basic-attack-tree-node-desc">${escapeHtml(node.description || "")}</span>
    <span class="basic-attack-tree-node-meta">${escapeHtml(rankText)} | ${escapeHtml(requirement)}</span>
  </article>`;
}

function renderEvolutionGroups(attackType, tree, progress) {
  const firstNodes = tree.nodes.filter((node) => node.type === "evolution_first");
  const secondNodes = tree.nodes.filter((node) => node.type === "evolution_second");
  const firstHtml = firstNodes.map((node) => renderNode(attackType, node, progress)).join("");
  let secondHtml = "";

  if (attackType === "bladeBlast") {
    const groups = {};
    for (const node of secondNodes) {
      const key = node.firstEvolutionId || "Final Evolution";
      if (!groups[key]) groups[key] = [];
      groups[key].push(node);
    }
    secondHtml = Object.entries(groups).map(([groupName, nodes]) => {
      const firstNode = getBasicAttackNode(attackType, `${attackType}:evolution:first:${groupName}`) || null;
      return `<section class="basic-attack-tree-evo-group">
        <h4 class="basic-attack-tree-evo-heading">${escapeHtml(firstNode?.name || groupName)}</h4>
        <div class="basic-attack-tree-evo-grid">${nodes.map((node) => renderNode(attackType, node, progress)).join("")}</div>
      </section>`;
    }).join("");
  } else {
    const groups = {};
    for (const node of secondNodes) {
      const key = node.firstCategory || "Final Evolution";
      if (!groups[key]) groups[key] = [];
      groups[key].push(node);
    }
    secondHtml = Object.entries(groups).map(([groupName, nodes]) => {
      return `<section class="basic-attack-tree-evo-group">
        <h4 class="basic-attack-tree-evo-heading">${escapeHtml(groupName)}</h4>
        <div class="basic-attack-tree-evo-grid">${nodes.map((node) => renderNode(attackType, node, progress)).join("")}</div>
      </section>`;
    }).join("");
  }

  return `<section class="basic-attack-tree-section">
    <div class="basic-attack-tree-section-header">
      <h3 class="basic-attack-tree-section-title">Evolutions</h3>
    </div>
    <div class="basic-attack-tree-evo-block">
      <div class="basic-attack-tree-evo-group">
        <h4 class="basic-attack-tree-evo-heading">First Evolution</h4>
        <div class="basic-attack-tree-evo-grid">${firstHtml}</div>
      </div>
      ${secondHtml ? `<div class="basic-attack-tree-evo-second">${secondHtml}</div>` : ""}
    </div>
  </section>`;
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

  const tree = getBasicAttackTree(selectedAttackType);
  const summary = getBasicAttackTreeSummary(selectedAttackType);
  const progress = getBasicAttackProgress(selectedAttackType);
  const tokens = getWeaponArtTokenInventory();
  const ownerHeroId = getWeaponArtOwnerHeroId(selectedAttackType);
  const ownerHero = ownerHeroId ? getPlayableCharacterOrDefault(ownerHeroId) : null;
  const sharedUnlocked = isWeaponArtSharedUnlocked(selectedAttackType, summary);
  const xpPct = summary.maxLevel <= summary.level || summary.xpToNext <= 0
    ? 100
    : Math.max(0, Math.min(100, Math.round((summary.xpInLevel / summary.xpToNext) * 100)));

  selectorEl.innerHTML = ATTACK_TYPES.map((entry) => `
    <button type="button" class="basic-attack-tree-attack-btn${entry.id === selectedAttackType ? " selected" : ""}" data-attack-type="${escapeHtml(entry.id)}">
      ${escapeHtml(entry.name)}
    </button>
  `).join("");

  summaryEl.innerHTML = `
    <div class="basic-attack-tree-summary-row">
      <span class="basic-attack-tree-summary-name">${escapeHtml(tree?.name || selectedAttackType)}</span>
      <span class="basic-attack-tree-summary-stat">Level ${summary.level}${summary.maxLevel > 0 ? ` / ${summary.maxLevel}` : ""}</span>
      <span class="basic-attack-tree-summary-stat">Pending Picks ${summary.pendingPickCount || 0}</span>
      <span class="basic-attack-tree-summary-stat">Spent Value ${summary.spentValue || 0}</span>
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
  `;

  resolveBtn.disabled = !hasPendingWeaponArtChoices();

  const laneHtml = (tree?.lanes || []).map((lane) => {
    const nodes = tree.nodes.filter((node) => node.type === "upgrade" && node.lane === lane);
    return `<section class="basic-attack-tree-lane">
      <h3 class="basic-attack-tree-lane-title">${escapeHtml(lane)}</h3>
      <div class="basic-attack-tree-lane-nodes">
        ${nodes.map((node) => renderNode(selectedAttackType, node, progress)).join("")}
      </div>
    </section>`;
  }).join("");

  contentEl.innerHTML = `
    <section class="basic-attack-tree-section">
      <div class="basic-attack-tree-lanes">${laneHtml}</div>
    </section>
    ${tree ? renderEvolutionGroups(selectedAttackType, tree, progress) : ""}
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
