// -------- Talent Tree UI --------

import { escapeHtml } from '../utils.js';
import {
  TALENT_TREE, canPurchaseTalent, getPurchasedTalents, getTalentCrystalId, purchaseTalent,
  canRefundTalent, refundTalent, refundBranch
} from '../data/talents.js';
import { getGlobalTalentCrystals } from '../data/crystals.js';
import { refreshMainMenuLP } from './main-menu.js';

const DETAILS_PLACEHOLDER_HTML = '<div class="talent-tree-details-placeholder">Hover over a talent to see details.</div>';

function normalizeTalentIconUrl(raw) {
  if (!raw) return "";
  let s = String(raw);
  // Talent icons are project assets served from repo root.
  // If the data stores paths like "../assets/...", normalize to "assets/...".
  if (s.startsWith("../")) s = s.slice(3);
  return encodeURI(s);
}

function isHubActive() {
  return document.body.classList.contains("home-base-active");
}

export function openTalentTree() {
  renderTalentTree();
  const overlay = document.getElementById("talent-tree-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
  const titleEl = document.querySelector("#talent-tree-overlay .talent-tree-title");
  if (titleEl) titleEl.textContent = "Talent Tree";
}

export function openTalentTreeForCharacter(_charIndex) {
  openTalentTree();
}

export function closeTalentTree() {
  const overlay = document.getElementById("talent-tree-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  const titleEl = document.querySelector("#talent-tree-overlay .talent-tree-title");
  if (titleEl) titleEl.textContent = "Talent Tree";
  if (isHubActive()) {
    if (mainMenu) mainMenu.classList.add("hidden");
    document.querySelector(".game-root")?.classList.remove("hidden");
  } else if (mainMenu) {
    mainMenu.classList.remove("hidden");
  }
  refreshMainMenuLP();
}

export function renderTalentTree() {
  const content = document.getElementById("talent-tree-content");
  const crystalsEl = document.getElementById("talent-tree-crystals");
  if (!content) return;
  const purchased = getPurchasedTalents();
  const crystals = getGlobalTalentCrystals();

  // Flat map of talent id -> { name, desc, cost } for details panel
  const talentMap = {};
  for (const nodes of Object.values(TALENT_TREE)) {
    for (const n of nodes) talentMap[n.id] = { id: n.id, name: n.name, desc: n.desc ?? "", cost: n.cost };
  }

  if (crystalsEl) {
    crystalsEl.classList.remove("hidden");
    for (const crystalId of ["orange", "green", "red", "yellow"]) {
      const span = document.getElementById(`talent-tree-crystal-${crystalId}`);
      if (span) span.textContent = String(Math.max(0, Number(crystals?.[crystalId]) || 0));
    }
  }

  let branchesHtml = '<div class="talent-tree-branches">';
  for (const [branchName, nodes] of Object.entries(TALENT_TREE)) {
    if (branchName === "Brutality") {
      branchesHtml += renderBrutalityIconTree(nodes, purchased);
    } else if (branchName === "Agility") {
      branchesHtml += renderAgilityIconTree(nodes, purchased);
    } else if (branchName === "Vitality") {
      branchesHtml += renderVitalityIconTree(nodes, purchased);
    } else if (branchName === "Luck") {
      branchesHtml += renderLuckIconTree(nodes, purchased);
    } else {
      const genericPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
      branchesHtml += `<div class="talent-tree-branch"><div class="talent-tree-branch-header"><div class="talent-tree-branch-title">${escapeHtml(branchName)}</div><button type="button" class="talent-tree-branch-refund-btn" data-branch="${escapeHtml(branchName)}" ${genericPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button></div><div class="talent-tree-branch-body"><div class="talent-tree-branch-grid-wrap"><div class="talent-tree-nodes">`;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isPurchased = purchased.includes(node.id);
        const prevPurchased = i === 0 || purchased.includes(nodes[i - 1].id);
        const isAvailable = !isPurchased && prevPurchased && canPurchaseTalent(node.id);
        const state = isPurchased ? "purchased" : isAvailable ? "available" : "locked";
        const canRefund = isPurchased && canRefundTalent(node.id, purchased);
        const tooltip = node.desc || "";
        const crystalId = getTalentCrystalId(node.id) || "";
        const affordable = canPurchaseTalent(node.id);
        const title = tooltip + (canRefund ? " Click to refund." : (!affordable && !isPurchased ? " Not enough crystals." : ""));
        branchesHtml += `<div class="talent-tree-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" data-crystal-id="${escapeHtml(crystalId)}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""}>
          <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
          <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
          <div class="talent-tree-node-cost">${isPurchased ? "\u2713 Purchased" : `${node.cost} ${crystalId || "crystal"}`}</div>
        </div>`;
      }
      branchesHtml += `</div></div><div class="talent-tree-details-panel">${DETAILS_PLACEHOLDER_HTML}</div></div></div>`;
    }
  }
  branchesHtml += "</div>";
  content.innerHTML = branchesHtml;

  function setDetails(panelEl, talent) {
    if (!panelEl) return;
    const crystalId = getTalentCrystalId(talent.id) || "crystal";
    panelEl.innerHTML = `<div class="talent-tree-details-content"><div class="talent-tree-details-name">${escapeHtml(talent.name)}</div><div class="talent-tree-details-desc">${escapeHtml(talent.desc)}</div><div class="talent-tree-details-cost">Cost: ${escapeHtml(String(talent.cost))} ${escapeHtml(crystalId)}</div></div>`;
  }
  function setDetailsPlaceholder(panelEl) {
    if (!panelEl) return;
    panelEl.innerHTML = DETAILS_PLACEHOLDER_HTML;
  }

  content.onmouseover = (e) => {
    const node = e.target.closest(".talent-tree-node");
    if (!node || !node.dataset.talentId) return;
    const branchEl = node.closest(".talent-tree-branch");
    const panelEl = branchEl ? branchEl.querySelector(".talent-tree-details-panel") : null;
    const t = talentMap[node.dataset.talentId];
    if (t && panelEl) setDetails(panelEl, t);
  };
  content.onmouseout = (e) => {
    const node = e.target.closest(".talent-tree-node");
    if (!node || !node.dataset.talentId) return;
    const toEl = e.relatedTarget;
    if (toEl && toEl.closest && toEl.closest(".talent-tree-node") === node) return;
    const branchEl = node.closest(".talent-tree-branch");
    const panelEl = branchEl ? branchEl.querySelector(".talent-tree-details-panel") : null;
    setDetailsPlaceholder(panelEl);
  };

  content.querySelectorAll(".talent-tree-node.available").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.talentId;
      const cost = Number(el.dataset.cost);
      const ok = purchaseTalent(id, cost);
      if (ok) renderTalentTree();
    });
  });

  content.querySelectorAll(".talent-tree-node.purchased").forEach((el) => {
    const id = el.dataset.talentId;
    el.addEventListener("click", () => {
      const ok = refundTalent(id);
      if (ok) renderTalentTree();
    });
  });

  content.querySelectorAll(".talent-tree-branch-refund-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const branch = btn.dataset.branch;
      if (!branch) return;
      const nodes = TALENT_TREE[branch];
      const currentPurchased = getPurchasedTalents();
      const count = nodes ? nodes.filter((n) => currentPurchased.includes(n.id)).length : 0;
      if (count === 0) return;
      if (!confirm(`Refund all ${count} talent(s) in ${branch}?`)) return;
      refundBranch(branch);
      renderTalentTree();
    });
  });
}

function renderBranchGrid(branchName, cssClass, position, nodes, purchased) {
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
    const canUnlock = !isPurchased && hasAll && hasAny && canPurchaseTalent(node.id);
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const tooltip = node.desc || "";
    const crystalId = getTalentCrystalId(node.id) || "";
    const title = tooltip + (canRefund ? " Click to refund." : (!canPurchaseTalent(node.id) && !isPurchased ? " Not enough crystals." : ""));
    
    // Add sprite sheet data attributes for branches that use icon grid (agility, vitality)
    let spriteAttrs = "";
    if ((cssClass === "agility" || cssClass === "vitality") && pos.spriteRow !== undefined && pos.spriteCol !== undefined) {
      spriteAttrs = ` data-sprite-row="${pos.spriteRow}" data-sprite-col="${pos.spriteCol}"`;
    }
    
    const iconUrl = normalizeTalentIconUrl(node.icon);
    const iconHtml = iconUrl ? `<img class="talent-tree-node-icon" src="${escapeHtml(iconUrl)}" alt="" loading="lazy" decoding="async" />` : "";
    gridHtml += `<div class="talent-tree-node ${cssClass}-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" data-crystal-id="${escapeHtml(crystalId)}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""}${spriteAttrs} style="grid-row:${pos.row};grid-column:${pos.col};">
      ${iconHtml}
      <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
      <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
      <div class="talent-tree-node-cost">${isPurchased ? "\u2713 Purchased" : `${node.cost} ${crystalId || "crystal"}`}</div>
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
  const connClass = cssClass === "brutality" ? "brutality-connection" : `brutality-connection ${cssClass}-connection`;
  for (const e of edges) {
    connHtml += `<div class="${connClass}" style="grid-row:${e.row};grid-column:${e.colStart} / ${e.colEnd + 1};"></div>`;
  }

  const branchPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  const gridClass = cssClass === "brutality" ? "brutality-tree-grid" : `brutality-tree-grid ${cssClass}-tree-grid`;
  return `<div class="talent-tree-branch ${cssClass}-branch">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">${branchName}</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="${branchName}" ${branchPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="talent-tree-branch-body">
      <div class="talent-tree-branch-grid-wrap">
        <div class="${gridClass}">
          ${connHtml}
          ${gridHtml}
        </div>
      </div>
      <div class="talent-tree-details-panel">${DETAILS_PLACEHOLDER_HTML}</div>
    </div>
  </div>`;
}

function renderBrutalityTalentBranch(nodes, purchased) {
  const position = {
    fierce: { row: 1, col: 2 },
    rapid: { row: 1, col: 4 },
    heavyHit: { row: 1, col: 6 },
    dashingAttack: { row: 1, col: 8 },
    predator: { row: 3, col: 2 },
    bloodthirst: { row: 3, col: 4 },
    bloodRush: { row: 3, col: 6 },
    overkill: { row: 3, col: 8 },
    frenzy: { row: 5, col: 2 },
    battleScarred: { row: 5, col: 4 },
    brutalityRetaliation: { row: 5, col: 6 },
    executioner: { row: 5, col: 8 },
    berserkerRage: { row: 7, col: 2 },
    luckyShot: { row: 7, col: 4 },
    assassinStep: { row: 7, col: 6 },
    relentless: { row: 7, col: 8 }
  };
  return renderBranchGrid("Brutality", "brutality", position, nodes, purchased);
}

function renderAgilityTalentBranch(nodes, purchased) {
  const position = {
    nimble: { row: 1, col: 1, spriteRow: 0, spriteCol: 0 },
    reflexes: { row: 1, col: 2, spriteRow: 0, spriteCol: 1 },
    fleetFooted: { row: 1, col: 3, spriteRow: 0, spriteCol: 2 },
    agilitySwiftExtraction: { row: 1, col: 4, spriteRow: 0, spriteCol: 3 },
    evasion: { row: 3, col: 1, spriteRow: 1, spriteCol: 0 },
    shadowStep: { row: 3, col: 2, spriteRow: 1, spriteCol: 1 },
    momentum: { row: 3, col: 3, spriteRow: 1, spriteCol: 2 },
    slipstream: { row: 3, col: 4, spriteRow: 1, spriteCol: 3 },
    ghostForm: { row: 5, col: 1, spriteRow: 2, spriteCol: 0 },
    untouchable: { row: 5, col: 2, spriteRow: 2, spriteCol: 1 },
    phantomDash: { row: 5, col: 3, spriteRow: 2, spriteCol: 2 },
    quickRecovery: { row: 5, col: 4, spriteRow: 2, spriteCol: 3 },
    windrunner: { row: 7, col: 1, spriteRow: 3, spriteCol: 0 },
    danceOfBlades: { row: 7, col: 2, spriteRow: 3, spriteCol: 1 },
    blinkAssault: { row: 7, col: 3, spriteRow: 3, spriteCol: 2 },
    perfectFlow: { row: 7, col: 4, spriteRow: 3, spriteCol: 3 }
  };
  return renderBranchGrid("Agility", "agility", position, nodes, purchased);
}

function renderAgilityIconTree(nodes, purchased) {
  const position = {
    nimble: { row: 0, col: 0, spriteRow: 0, spriteCol: 0 },
    reflexes: { row: 0, col: 1, spriteRow: 0, spriteCol: 1 },
    fleetFooted: { row: 0, col: 2, spriteRow: 0, spriteCol: 2 },
    agilitySwiftExtraction: { row: 0, col: 3, spriteRow: 0, spriteCol: 3 },
    evasion: { row: 1, col: 0, spriteRow: 1, spriteCol: 0 },
    shadowStep: { row: 1, col: 1, spriteRow: 1, spriteCol: 1 },
    momentum: { row: 1, col: 2, spriteRow: 1, spriteCol: 2 },
    slipstream: { row: 1, col: 3, spriteRow: 1, spriteCol: 3 },
    ghostForm: { row: 2, col: 0, spriteRow: 2, spriteCol: 0 },
    untouchable: { row: 2, col: 1, spriteRow: 2, spriteCol: 1 },
    phantomDash: { row: 2, col: 2, spriteRow: 2, spriteCol: 2 },
    quickRecovery: { row: 2, col: 3, spriteRow: 2, spriteCol: 3 },
    windrunner: { row: 3, col: 0, spriteRow: 3, spriteCol: 0 },
    danceOfBlades: { row: 3, col: 1, spriteRow: 3, spriteCol: 1 },
    blinkAssault: { row: 3, col: 2, spriteRow: 3, spriteCol: 2 },
    perfectFlow: { row: 3, col: 3, spriteRow: 3, spriteCol: 3 }
  };

  return renderIconTreeBranch({
    branchName: "Agility",
    cssBranchClass: "agility",
    nodes,
    purchased,
    position,
    viewBoxSize: 4
  });
}

function renderVitalityTalentBranch(nodes, purchased) {
  const position = {
    fortitude: { row: 1, col: 1, spriteRow: 0, spriteCol: 0 },
    bulwark: { row: 1, col: 2, spriteRow: 0, spriteCol: 1 },
    thickSkin: { row: 1, col: 3, spriteRow: 0, spriteCol: 2 },
    resilient: { row: 1, col: 4, spriteRow: 0, spriteCol: 3 },
    lifebloom: { row: 3, col: 1, spriteRow: 1, spriteCol: 0 },
    vitality: { row: 3, col: 2, spriteRow: 1, spriteCol: 1 },
    secondBreath: { row: 3, col: 3, spriteRow: 1, spriteCol: 2 },
    bloodRitual: { row: 3, col: 4, spriteRow: 1, spriteCol: 3 },
    toughness: { row: 5, col: 1, spriteRow: 2, spriteCol: 0 },
    endurance: { row: 5, col: 2, spriteRow: 2, spriteCol: 1 },
    livingFortress: { row: 5, col: 3, spriteRow: 2, spriteCol: 2 },
    undyingResolve: { row: 5, col: 4, spriteRow: 2, spriteCol: 3 },
    secondWind: { row: 7, col: 1, spriteRow: 3, spriteCol: 0 },
    immortal: { row: 7, col: 2, spriteRow: 3, spriteCol: 1 },
    stoneSkin: { row: 7, col: 3, spriteRow: 3, spriteCol: 2 },
    guardianPulse: { row: 7, col: 4, spriteRow: 3, spriteCol: 3 }
  };
  return renderBranchGrid("Vitality", "vitality", position, nodes, purchased);
}

function renderVitalityIconTree(nodes, purchased) {
  const position = {
    fortitude: { row: 0, col: 0, spriteRow: 0, spriteCol: 0 },
    bulwark: { row: 0, col: 1, spriteRow: 0, spriteCol: 1 },
    thickSkin: { row: 0, col: 2, spriteRow: 0, spriteCol: 2 },
    resilient: { row: 0, col: 3, spriteRow: 0, spriteCol: 3 },
    lifebloom: { row: 1, col: 0, spriteRow: 1, spriteCol: 0 },
    vitality: { row: 1, col: 1, spriteRow: 1, spriteCol: 1 },
    secondBreath: { row: 1, col: 2, spriteRow: 1, spriteCol: 2 },
    bloodRitual: { row: 1, col: 3, spriteRow: 1, spriteCol: 3 },
    toughness: { row: 2, col: 0, spriteRow: 2, spriteCol: 0 },
    endurance: { row: 2, col: 1, spriteRow: 2, spriteCol: 1 },
    livingFortress: { row: 2, col: 2, spriteRow: 2, spriteCol: 2 },
    undyingResolve: { row: 2, col: 3, spriteRow: 2, spriteCol: 3 },
    secondWind: { row: 3, col: 0, spriteRow: 3, spriteCol: 0 },
    immortal: { row: 3, col: 1, spriteRow: 3, spriteCol: 1 },
    stoneSkin: { row: 3, col: 2, spriteRow: 3, spriteCol: 2 },
    guardianPulse: { row: 3, col: 3, spriteRow: 3, spriteCol: 3 }
  };

  return renderIconTreeBranch({
    branchName: "Vitality",
    cssBranchClass: "vitality",
    nodes,
    purchased,
    position,
    viewBoxSize: 4
  });
}

function renderLuckTalentBranch(nodes, purchased) {
  const position = {
    arcaneEye: { row: 1, col: 1, spriteRow: 0, spriteCol: 0 },
    keenEye: { row: 1, col: 2, spriteRow: 0, spriteCol: 1 },
    treasureSense: { row: 1, col: 3, spriteRow: 0, spriteCol: 2 },
    scavengersInstinct: { row: 1, col: 4, spriteRow: 0, spriteCol: 3 },
    lootHoarder: { row: 3, col: 1, spriteRow: 1, spriteCol: 0 },
    itemSense: { row: 3, col: 2, spriteRow: 1, spriteCol: 1 },
    cardSurge: { row: 3, col: 3, spriteRow: 1, spriteCol: 2 },
    ghostLooter: { row: 3, col: 4, spriteRow: 1, spriteCol: 3 },
    cubeMagnet: { row: 5, col: 1, spriteRow: 2, spriteCol: 0 },
    cubeCascade: { row: 5, col: 2, spriteRow: 2, spriteCol: 1 },
    transmutation: { row: 5, col: 3, spriteRow: 2, spriteCol: 2 },
    curator: { row: 5, col: 4, spriteRow: 2, spriteCol: 3 },
    lootTranscendence: { row: 7, col: 1, spriteRow: 3, spriteCol: 0 },
    vaultMaster: { row: 7, col: 2, spriteRow: 3, spriteCol: 1 },
    livingItem: { row: 7, col: 3, spriteRow: 3, spriteCol: 2 },
    philosophersStone: { row: 7, col: 4, spriteRow: 3, spriteCol: 3 }
  };
  return renderBranchGrid("Luck", "luck", position, nodes, purchased);
}

function renderLuckIconTree(nodes, purchased) {
  const position = {
    arcaneEye: { row: 0, col: 0, spriteRow: 0, spriteCol: 0 },
    keenEye: { row: 0, col: 1, spriteRow: 0, spriteCol: 1 },
    treasureSense: { row: 0, col: 2, spriteRow: 0, spriteCol: 2 },
    scavengersInstinct: { row: 0, col: 3, spriteRow: 0, spriteCol: 3 },
    lootHoarder: { row: 1, col: 0, spriteRow: 1, spriteCol: 0 },
    itemSense: { row: 1, col: 1, spriteRow: 1, spriteCol: 1 },
    cardSurge: { row: 1, col: 2, spriteRow: 1, spriteCol: 2 },
    ghostLooter: { row: 1, col: 3, spriteRow: 1, spriteCol: 3 },
    cubeMagnet: { row: 2, col: 0, spriteRow: 2, spriteCol: 0 },
    cubeCascade: { row: 2, col: 1, spriteRow: 2, spriteCol: 1 },
    transmutation: { row: 2, col: 2, spriteRow: 2, spriteCol: 2 },
    curator: { row: 2, col: 3, spriteRow: 2, spriteCol: 3 },
    lootTranscendence: { row: 3, col: 0, spriteRow: 3, spriteCol: 0 },
    vaultMaster: { row: 3, col: 1, spriteRow: 3, spriteCol: 1 },
    livingItem: { row: 3, col: 2, spriteRow: 3, spriteCol: 2 },
    philosophersStone: { row: 3, col: 3, spriteRow: 3, spriteCol: 3 }
  };

  return renderIconTreeBranch({
    branchName: "Luck",
    cssBranchClass: "luck",
    nodes,
    purchased,
    position,
    viewBoxSize: 4
  });
}

function renderBrutalityIconTree(nodes, purchased) {
  // 4x4 grid for Brutality. No prerequisite links (parentsAll/parentsAny empty), so no connection lines.
  const position = {
    fierce: { row: 0, col: 0, spriteRow: 0, spriteCol: 0 },
    rapid: { row: 0, col: 1, spriteRow: 0, spriteCol: 1 },
    heavyHit: { row: 0, col: 2, spriteRow: 0, spriteCol: 2 },
    dashingAttack: { row: 0, col: 3, spriteRow: 0, spriteCol: 3 },
    predator: { row: 1, col: 0, spriteRow: 1, spriteCol: 0 },
    bloodthirst: { row: 1, col: 1, spriteRow: 1, spriteCol: 1 },
    bloodRush: { row: 1, col: 2, spriteRow: 1, spriteCol: 2 },
    overkill: { row: 1, col: 3, spriteRow: 1, spriteCol: 3 },
    frenzy: { row: 2, col: 0, spriteRow: 2, spriteCol: 0 },
    battleScarred: { row: 2, col: 1, spriteRow: 2, spriteCol: 1 },
    brutalityRetaliation: { row: 2, col: 2, spriteRow: 2, spriteCol: 2 },
    executioner: { row: 2, col: 3, spriteRow: 2, spriteCol: 3 },
    berserkerRage: { row: 3, col: 0, spriteRow: 3, spriteCol: 0 },
    luckyShot: { row: 3, col: 1, spriteRow: 3, spriteCol: 1 },
    assassinStep: { row: 3, col: 2, spriteRow: 3, spriteCol: 2 },
    relentless: { row: 3, col: 3, spriteRow: 3, spriteCol: 3 }
  };

  return renderIconTreeBranch({
    branchName: "Brutality",
    cssBranchClass: "brutality",
    nodes,
    purchased,
    position,
    viewBoxSize: 4
  });
}

function renderIconTreeBranch({ branchName, cssBranchClass, nodes, purchased, position, viewBoxSize }) {
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
    const canUnlock = !isPurchased && hasAll && hasAny && canPurchaseTalent(node.id);
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const crystalId = getTalentCrystalId(node.id) || "";
    const costLine = isPurchased ? "\u2713 Purchased" : `${node.cost} ${crystalId || "crystal"}`;
    const refundHint = canRefund ? "Click to refund." : (!canPurchaseTalent(node.id) && !isPurchased ? "Not enough crystals." : "");
    const iconUrl = normalizeTalentIconUrl(node.icon);
    const iconHtml = iconUrl ? `<img class="talent-tree-node-icon" src="${escapeHtml(iconUrl)}" alt="" loading="lazy" decoding="async" />` : "";

    nodesHtml += `<div class="talent-tree-node ${cssBranchClass}-node ${cssBranchClass}-icon-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" data-crystal-id="${escapeHtml(crystalId)}" data-sprite-row="${pos.spriteRow}" data-sprite-col="${pos.spriteCol}"${canRefund ? ' data-refundable="true"' : ""} style="grid-row:${pos.row + 1};grid-column:${pos.col + 1};">
      ${iconHtml}
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
    <div class="talent-tree-branch-body">
      <div class="talent-tree-branch-grid-wrap">
        <div class="${cssBranchClass}-icon-tree-grid talent-icon-tree-grid">
          <svg class="${cssBranchClass}-tree-lines talent-icon-tree-lines" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" preserveAspectRatio="none" aria-hidden="true">
            <path class="talent-icon-tree-lines-path" d="${escapeHtml(pathD)}" fill="none" stroke="currentColor" stroke-width="0.08" stroke-linecap="round"></path>
          </svg>
          ${nodesHtml}
        </div>
      </div>
      <div class="talent-tree-details-panel">${DETAILS_PLACEHOLDER_HTML}</div>
    </div>
  </div>`;
}
