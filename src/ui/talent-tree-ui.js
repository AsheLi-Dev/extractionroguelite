// -------- Talent Tree UI --------

import { escapeHtml } from '../utils.js';
import { getLegacyPoints } from '../data/constants.js';
import {
  TALENT_TREE, getPurchasedTalents, purchaseTalent,
  canRefundTalent, refundTalent, refundBranch
} from '../data/talents.js';
import { refreshMainMenuLP } from './main-menu.js';

export function openTalentTree() {
  renderTalentTree();
  const overlay = document.getElementById("talent-tree-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

export function closeTalentTree() {
  const overlay = document.getElementById("talent-tree-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.classList.remove("hidden");
  refreshMainMenuLP();
}

export function renderTalentTree() {
  const content = document.getElementById("talent-tree-content");
  const lpEl = document.getElementById("talent-tree-lp-value");
  if (lpEl) lpEl.textContent = getLegacyPoints();
  if (!content) return;

  const purchased = getPurchasedTalents();
  const lp = getLegacyPoints();

  let html = '<div class="talent-tree-branches">';
  for (const [branchName, nodes] of Object.entries(TALENT_TREE)) {
    if (branchName === "Warrior") {
      html += renderWarriorIconTree(nodes, purchased, lp);
    } else if (branchName === "Survivalist") {
      html += renderSurvivalistIconTree(nodes, purchased, lp);
    } else if (branchName === "Scavenger") {
      html += renderScavengerTalentBranch(nodes, purchased, lp);
    } else if (branchName === "Tinkerer") {
      html += renderTinkererTalentBranch(nodes, purchased, lp);
    } else {
      const genericPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
      html += `<div class="talent-tree-branch"><div class="talent-tree-branch-header"><div class="talent-tree-branch-title">${escapeHtml(branchName)}</div><button type="button" class="talent-tree-branch-refund-btn" data-branch="${escapeHtml(branchName)}" ${genericPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button></div><div class="talent-tree-nodes">`;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isPurchased = purchased.includes(node.id);
        const prevPurchased = i === 0 || purchased.includes(nodes[i - 1].id);
        const isAvailable = !isPurchased && prevPurchased && lp >= node.cost;
        const state = isPurchased ? "purchased" : isAvailable ? "available" : "locked";
        const canRefund = isPurchased && canRefundTalent(node.id, purchased);
        const tooltip = node.desc || "";
        const title = tooltip + (canRefund ? " Click to refund." : "");
        html += `<div class="talent-tree-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""}>
          <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
          <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
          <div class="talent-tree-node-cost">${isPurchased ? "\u2713 Purchased" : `${node.cost} LP`}</div>
        </div>`;
      }
      html += "</div></div>";
    }
  }
  html += "</div>";
  content.innerHTML = html;

  content.querySelectorAll(".talent-tree-node.available").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.talentId;
      const cost = Number(el.dataset.cost);
      if (getLegacyPoints() >= cost && purchaseTalent(id, cost)) {
        renderTalentTree();
      }
    });
  });

  content.querySelectorAll(".talent-tree-node.purchased").forEach((el) => {
    const id = el.dataset.talentId;
    el.addEventListener("click", () => {
      if (refundTalent(id)) renderTalentTree();
    });
  });

  content.querySelectorAll(".talent-tree-branch-refund-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const branch = btn.dataset.branch;
      if (!branch) return;
      const nodes = TALENT_TREE[branch];
      const purchased = getPurchasedTalents();
      const count = nodes ? nodes.filter((n) => purchased.includes(n.id)).length : 0;
      if (count === 0) return;
      if (!confirm(`Refund all ${count} talent(s) in ${branch}? You will recover their LP.`)) return;
      refundBranch(branch);
      renderTalentTree();
    });
  });
}

function renderBranchGrid(branchName, cssClass, position, nodes, purchased, lp) {
  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;

  let gridHtml = "";
  for (const node of nodes) {
    const pos = position[node.id];
    if (!pos) continue;
    const isPurchased = purchased.includes(node.id);
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const hasAll = parentsAll.length === 0 || parentsAll.every((p) => purchased.includes(p));
    const hasAny = parentsAny.length === 0 || parentsAny.some((p) => purchased.includes(p));
    const canUnlock = !isPurchased && hasAll && hasAny && lp >= node.cost;
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const tooltip = node.desc || "";
    const title = tooltip + (canRefund ? " Click to refund." : "");
    
    // Add sprite sheet data attributes for survivalist branch
    let spriteAttrs = "";
    if (cssClass === "survivalist" && pos.spriteRow !== undefined && pos.spriteCol !== undefined) {
      spriteAttrs = ` data-sprite-row="${pos.spriteRow}" data-sprite-col="${pos.spriteCol}"`;
    }
    
    gridHtml += `<div class="talent-tree-node ${cssClass}-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""}${spriteAttrs} style="grid-row:${pos.row};grid-column:${pos.col};">
      <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
      <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
      <div class="talent-tree-node-cost">${isPurchased ? "\u2713 Purchased" : `${node.cost} LP`}</div>
    </div>`;
  }

  const edges = [];
  for (const node of nodes) {
    const id = node.id;
    const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
    for (const parentId of parents) {
      const parentPos = position[parentId];
      const childPos = position[id];
      if (!parentPos || !childPos) continue;
      const row = (parentPos.row + childPos.row) / 2;
      const colStart = Math.min(parentPos.col, childPos.col);
      const colEnd = Math.max(parentPos.col, childPos.col);
      edges.push({ row, colStart, colEnd });
    }
  }

  let connHtml = "";
  const connClass = cssClass === "warrior" ? "warrior-connection" : `warrior-connection ${cssClass}-connection`;
  for (const e of edges) {
    connHtml += `<div class="${connClass}" style="grid-row:${e.row};grid-column:${e.colStart} / ${e.colEnd + 1};"></div>`;
  }

  const branchPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  const gridClass = cssClass === "warrior" ? "warrior-tree-grid" : `warrior-tree-grid ${cssClass}-tree-grid`;
  return `<div class="talent-tree-branch ${cssClass}-branch">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">${branchName}</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="${branchName}" ${branchPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="${gridClass}">
      ${connHtml}
      ${gridHtml}
    </div>
  </div>`;
}

function renderWarriorTalentBranch(nodes, purchased, lp) {
  const position = {
    fierce: { row: 1, col: 2 },
    rapid: { row: 1, col: 4 },
    resilient: { row: 1, col: 6 },
    bloodthirst: { row: 3, col: 2 },
    predator: { row: 3, col: 3 },
    reflexes: { row: 3, col: 5 },
    ironWill: { row: 3, col: 6 },
    frenzy: { row: 5, col: 2 },
    executioner: { row: 5, col: 3 },
    battleScarred: { row: 5, col: 4 },
    endurance: { row: 5, col: 5 },
    fortress: { row: 5, col: 6 },
    berserkerRage: { row: 7, col: 2 },
    warlord: { row: 7, col: 3 },
    secondWind: { row: 7, col: 4 },
    immortal: { row: 7, col: 5 }
  };
  return renderBranchGrid("Warrior", "warrior", position, nodes, purchased, lp);
}

function renderSurvivalistTalentBranch(nodes, purchased, lp) {
  // 4x4 grid matching sprite sheet layout
  // Row 0: Fortitude (0,0), Bulwark (0,1), Nimble (0,2), Vitality (0,3)
  // Row 1: Thick Skin (1,0), Toughness (1,1), Fleet Footed (1,2), Lifebloom (1,3)
  // Row 2: Second Breath (2,0), Retaliation (2,1), Evasion (2,2), Shadow Step (2,3)
  // Row 3: Undying Resolve (3,0), Living Fortress (3,1), Ghost Form (3,2), Untouchable (3,3)
  const position = {
    fortitude: { row: 1, col: 1, spriteRow: 0, spriteCol: 0 },
    bulwark: { row: 1, col: 2, spriteRow: 0, spriteCol: 1 },
    nimble: { row: 1, col: 3, spriteRow: 0, spriteCol: 2 },
    vitality: { row: 1, col: 4, spriteRow: 0, spriteCol: 3 },
    thickSkin: { row: 3, col: 1, spriteRow: 1, spriteCol: 0 },
    toughness: { row: 3, col: 2, spriteRow: 1, spriteCol: 1 },
    fleetFooted: { row: 3, col: 3, spriteRow: 1, spriteCol: 2 },
    lifebloom: { row: 3, col: 4, spriteRow: 1, spriteCol: 3 },
    secondBreath: { row: 5, col: 1, spriteRow: 2, spriteCol: 0 },
    retaliation: { row: 5, col: 2, spriteRow: 2, spriteCol: 1 },
    evasion: { row: 5, col: 3, spriteRow: 2, spriteCol: 2 },
    shadowStep: { row: 5, col: 4, spriteRow: 2, spriteCol: 3 },
    undyingResolve: { row: 7, col: 1, spriteRow: 3, spriteCol: 0 },
    livingFortress: { row: 7, col: 2, spriteRow: 3, spriteCol: 1 },
    ghostForm: { row: 7, col: 3, spriteRow: 3, spriteCol: 2 },
    untouchable: { row: 7, col: 4, spriteRow: 3, spriteCol: 3 }
  };
  return renderBranchGrid("Survivalist", "survivalist", position, nodes, purchased, lp);
}

function renderSurvivalistIconTree(nodes, purchased, lp) {
  // 0-based 4x4 grid layout (rows 0-3, cols 0-3)
  const position = {
    fortitude: { row: 0, col: 0, spriteRow: 0, spriteCol: 0 },
    bulwark: { row: 0, col: 1, spriteRow: 0, spriteCol: 1 },
    nimble: { row: 0, col: 2, spriteRow: 0, spriteCol: 2 },
    vitality: { row: 0, col: 3, spriteRow: 0, spriteCol: 3 },
    thickSkin: { row: 1, col: 0, spriteRow: 1, spriteCol: 0 },
    toughness: { row: 1, col: 1, spriteRow: 1, spriteCol: 1 },
    fleetFooted: { row: 1, col: 2, spriteRow: 1, spriteCol: 2 },
    lifebloom: { row: 1, col: 3, spriteRow: 1, spriteCol: 3 },
    secondBreath: { row: 2, col: 0, spriteRow: 2, spriteCol: 0 },
    retaliation: { row: 2, col: 1, spriteRow: 2, spriteCol: 1 },
    evasion: { row: 2, col: 2, spriteRow: 2, spriteCol: 2 },
    shadowStep: { row: 2, col: 3, spriteRow: 2, spriteCol: 3 },
    undyingResolve: { row: 3, col: 0, spriteRow: 3, spriteCol: 0 },
    livingFortress: { row: 3, col: 1, spriteRow: 3, spriteCol: 1 },
    ghostForm: { row: 3, col: 2, spriteRow: 3, spriteCol: 2 },
    untouchable: { row: 3, col: 3, spriteRow: 3, spriteCol: 3 }
  };

  return renderIconTreeBranch({
    branchName: "Survivalist",
    cssBranchClass: "survivalist",
    nodes,
    purchased,
    lp,
    position,
    viewBoxSize: 4
  });
}

function renderWarriorIconTree(nodes, purchased, lp) {
  // 0-based 4x4 grid layout based on the warrior atlas artwork.
  // If you want a different placement, we can remap these 16 coordinates.
  const position = {
    fierce: { row: 0, col: 0, spriteRow: 0, spriteCol: 0 },
    rapid: { row: 0, col: 1, spriteRow: 0, spriteCol: 1 },
    resilient: { row: 0, col: 2, spriteRow: 0, spriteCol: 2 },
    bloodthirst: { row: 0, col: 3, spriteRow: 0, spriteCol: 3 },
    predator: { row: 1, col: 0, spriteRow: 1, spriteCol: 0 },
    reflexes: { row: 1, col: 1, spriteRow: 1, spriteCol: 1 },
    ironWill: { row: 1, col: 2, spriteRow: 1, spriteCol: 2 },
    endurance: { row: 1, col: 3, spriteRow: 1, spriteCol: 3 },
    executioner: { row: 2, col: 0, spriteRow: 2, spriteCol: 0 },
    battleScarred: { row: 2, col: 1, spriteRow: 2, spriteCol: 1 },
    frenzy: { row: 2, col: 2, spriteRow: 2, spriteCol: 2 },
    fortress: { row: 2, col: 3, spriteRow: 2, spriteCol: 3 },
    berserkerRage: { row: 3, col: 0, spriteRow: 3, spriteCol: 0 },
    warlord: { row: 3, col: 1, spriteRow: 3, spriteCol: 1 },
    secondWind: { row: 3, col: 2, spriteRow: 3, spriteCol: 2 },
    immortal: { row: 3, col: 3, spriteRow: 3, spriteCol: 3 }
  };

  return renderIconTreeBranch({
    branchName: "Warrior",
    cssBranchClass: "warrior",
    nodes,
    purchased,
    lp,
    position,
    viewBoxSize: 4
  });
}

function renderIconTreeBranch({ branchName, cssBranchClass, nodes, purchased, lp, position, viewBoxSize }) {
  const edges = [];
  for (const node of nodes) {
    const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
    for (const parentId of parents) {
      if (position[parentId] && position[node.id]) edges.push({ from: parentId, to: node.id });
    }
  }

  let pathD = "";
  for (const e of edges) {
    const a = position[e.from];
    const b = position[e.to];
    const x1 = a.col + 0.5;
    const y1 = a.row + 0.5;
    const x2 = b.col + 0.5;
    const y2 = b.row + 0.5;
    pathD += `M${x1},${y1} L${x2},${y2} `;
  }
  pathD = pathD.trim();

  let nodesHtml = "";
  for (const node of nodes) {
    const pos = position[node.id];
    if (!pos) continue;

    const isPurchased = purchased.includes(node.id);
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const hasAll = parentsAll.length === 0 || parentsAll.every((p) => purchased.includes(p));
    const hasAny = parentsAny.length === 0 || parentsAny.some((p) => purchased.includes(p));
    const canUnlock = !isPurchased && hasAll && hasAny && lp >= node.cost;
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);

    const costLine = isPurchased ? "\u2713 Purchased" : `${node.cost} LP`;
    const refundHint = canRefund ? "Click to refund." : "";

    nodesHtml += `<div class="talent-tree-node ${cssBranchClass}-node ${cssBranchClass}-icon-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" data-sprite-row="${pos.spriteRow}" data-sprite-col="${pos.spriteCol}"${canRefund ? ' data-refundable="true"' : ""} style="grid-row:${pos.row + 1};grid-column:${pos.col + 1};">
      <div class="${cssBranchClass}-icon-tooltip talent-icon-tooltip" role="tooltip">
        <div class="talent-icon-tooltip-name">${escapeHtml(node.name)}</div>
        <div class="talent-icon-tooltip-desc">${escapeHtml(node.desc)}</div>
        <div class="talent-icon-tooltip-cost">${escapeHtml(costLine)}</div>
        ${refundHint ? `<div class="talent-icon-tooltip-refund">${escapeHtml(refundHint)}</div>` : ""}
      </div>
    </div>`;
  }

  const branchPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  return `<div class="talent-tree-branch ${cssBranchClass}-branch ${cssBranchClass}-icon-tree talent-icon-tree">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">${escapeHtml(branchName)}</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="${escapeHtml(branchName)}" ${branchPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="${cssBranchClass}-icon-tree-grid talent-icon-tree-grid">
      <svg class="${cssBranchClass}-tree-lines talent-icon-tree-lines" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" preserveAspectRatio="none" aria-hidden="true">
        <path class="talent-icon-tree-lines-path" d="${escapeHtml(pathD)}" fill="none" stroke="currentColor" stroke-width="0.08" stroke-linecap="round"></path>
      </svg>
      ${nodesHtml}
    </div>
  </div>`;
}

function renderScavengerTalentBranch(nodes, purchased, lp) {
  const position = {
    arcaneEye: { row: 1, col: 2 },
    swiftExtraction: { row: 1, col: 5 },
    keenEye: { row: 1, col: 8 },
    cardHoarder: { row: 3, col: 1 },
    socketMastery: { row: 3, col: 3 },
    secureFooting: { row: 3, col: 5 },
    itemSense: { row: 3, col: 7 },
    synergyMaster: { row: 5, col: 1 },
    cardSurge: { row: 5, col: 2 },
    ghostLooter: { row: 5, col: 3 },
    treasureSense: { row: 5, col: 4 },
    appraiser: { row: 5, col: 5 },
    cardTranscendence: { row: 7, col: 1 },
    phantomExtractor: { row: 7, col: 2 },
    vaultMaster: { row: 7, col: 3 },
    curator: { row: 7, col: 4 }
  };
  return renderBranchGrid("Scavenger", "scavenger", position, nodes, purchased, lp);
}

function renderTinkererTalentBranch(nodes, purchased, lp) {
  const position = {
    cubeMagnet: { row: 1, col: 2 },
    socketSense: { row: 1, col: 4 },
    transmuter: { row: 1, col: 6 },
    cubeExpert: { row: 3, col: 1 },
    tinkerersEye: { row: 3, col: 3 },
    socketFinder: { row: 3, col: 5 },
    qualityEye: { row: 3, col: 7 },
    forgeMastery: { row: 5, col: 1 },
    cubeCascade: { row: 5, col: 2 },
    tinkererSocketMastery: { row: 5, col: 4 },
    rarityRush: { row: 5, col: 5 },
    transmutation: { row: 5, col: 7 },
    perfectCraft: { row: 7, col: 1 },
    grandSocketeer: { row: 7, col: 2 },
    livingItem: { row: 7, col: 4 },
    philosophersStone: { row: 7, col: 6 }
  };
  return renderBranchGrid("Tinkerer", "tinkerer", position, nodes, purchased, lp);
}
