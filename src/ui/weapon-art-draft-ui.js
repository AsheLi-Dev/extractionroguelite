import { escapeHtml } from "../utils.js";
import {
  getBasicAttackNode,
  getBasicAttackProgress,
  getBasicAttackSpentValue,
  getBasicAttackTree,
  getLegalWeaponArtNodes,
  getPendingWeaponArtTypes,
  getWeaponArtCategories,
  getWeaponArtCategoryLabel,
  getWeaponArtTokenInventory,
  resolveWeaponArtDraftChoice,
  rollWeaponArtOffers,
  useWeaponArtToken
} from "../data/basic-attack-progression.js";

let activeSession = null;

function getOverlayEl() {
  return document.getElementById("weapon-art-draft-overlay");
}

function getBodyEl() {
  return document.getElementById("weapon-art-draft-body");
}

function getCurrentAttackType() {
  return activeSession?.queue?.[activeSession.queueIndex] || null;
}

function buildQueue(preferredAttackType = null) {
  const pending = getPendingWeaponArtTypes();
  if (!preferredAttackType || !pending.includes(preferredAttackType)) return pending;
  return [preferredAttackType, ...pending.filter((attackType) => attackType !== preferredAttackType)];
}

function getArtSessionState(attackType) {
  if (!activeSession) return null;
  activeSession.artState[attackType] = activeSession.artState[attackType] || {
    recentSkippedNodeIds: [],
    lastDraftedCategory: null
  };
  return activeSession.artState[attackType];
}

function createBaseChoiceState(attackType, offerIds, offerCount) {
  const artState = getArtSessionState(attackType);
  return {
    attackType,
    offers: offerIds,
    tokenUsed: false,
    tokenTypeUsed: null,
    directSelect: false,
    offerCount,
    biasCategory: null,
    recentSkippedNodeIds: [...(artState?.recentSkippedNodeIds || [])],
    rerolledAwayNodeIds: [],
    lastDraftedCategory: artState?.lastDraftedCategory || null
  };
}

function ensureChoiceState() {
  if (!activeSession) return false;
  const attackType = getCurrentAttackType();
  if (!attackType) return false;
  const progress = getBasicAttackProgress(attackType);
  if ((progress.pendingPickCount || 0) <= 0) return false;
  const artState = getArtSessionState(attackType);
  const offers = rollWeaponArtOffers(attackType, {
    recentSkippedNodeIds: artState.recentSkippedNodeIds,
    lastDraftedCategory: artState.lastDraftedCategory
  }, { count: 3, progress });
  activeSession.currentOffers = offers;
  activeSession.currentChoiceState = createBaseChoiceState(attackType, offers.map((offer) => offer.id), 3);
  activeSession.insightPickerOpen = false;
  return true;
}

function advanceQueueIfNeeded() {
  if (!activeSession) return false;
  while (activeSession.queueIndex < activeSession.queue.length) {
    const attackType = activeSession.queue[activeSession.queueIndex];
    const progress = getBasicAttackProgress(attackType);
    if ((progress.pendingPickCount || 0) > 0) {
      return true;
    }
    activeSession.queueIndex += 1;
  }
  return false;
}

function finishSession() {
  const overlay = getOverlayEl();
  if (overlay) overlay.classList.add("hidden");
  const callback = activeSession?.onComplete;
  activeSession = null;
  if (typeof callback === "function") callback();
}

function updateCurrentChoice() {
  if (!activeSession) return;
  if (!advanceQueueIfNeeded()) {
    finishSession();
    return;
  }
  ensureChoiceState();
  renderWeaponArtDraftOverlay();
}

function renderTokenButton(tokenType, label, inventory, disabled = false) {
  return `<button type="button" class="weapon-art-draft-token-btn" data-token-type="${escapeHtml(tokenType)}" ${disabled ? "disabled" : ""}>
    <span class="weapon-art-draft-token-name">${escapeHtml(label)}</span>
    <span class="weapon-art-draft-token-count">${inventory[tokenType] || 0}</span>
  </button>`;
}

function renderCurrentOfferCard(offer, chosenCount) {
  const rarity = String(offer?.rarity || "common").toLowerCase();
  const requirementParts = [];
  if ((offer?.levelRequirement || 1) > 1) {
    requirementParts.push(`Lv ${offer.levelRequirement}+`);
  }
  if ((offer?.minSpentPoints || 0) > 0) {
    requirementParts.push(`Spend ${offer.minSpentPoints}+`);
  }
  const requirementText = requirementParts.length > 0 ? requirementParts.join(" | ") : "Ready";
  const nextRank = Math.min((offer?.rankMax || 1), (offer?.currentRank || 0) + 1);
  return `<button type="button" class="weapon-art-draft-offer rarity-${escapeHtml(rarity)}" data-choice-node-id="${escapeHtml(offer.id)}">
    <span class="weapon-art-draft-offer-top">
      <span class="weapon-art-draft-offer-name rarity-${escapeHtml(rarity)}">${escapeHtml(offer.name || offer.id)}</span>
      <span class="weapon-art-draft-offer-rank">Rank ${nextRank}/${offer.rankMax || 1}</span>
    </span>
    <span class="weapon-art-draft-offer-desc">${escapeHtml(offer.description || "")}</span>
    <span class="weapon-art-draft-offer-meta">${escapeHtml(getWeaponArtCategoryLabel(offer.draftCategory || offer.lane || "damage"))} | ${escapeHtml(requirementText)}</span>
    <span class="weapon-art-draft-offer-meta">Pending picks after choice: ${Math.max(0, chosenCount - 1)}</span>
  </button>`;
}

function renderPathSummary(attackType) {
  const progress = getBasicAttackProgress(attackType);
  const tree = getBasicAttackTree(attackType);
  const laneRows = (tree?.lanes || []).map((lane) => {
    const count = (tree?.nodes || []).reduce((sum, node) => {
      if (node.type !== "upgrade" || node.lane !== lane) return sum;
      return sum + Number(progress.purchasedRanks?.[node.id] || 0);
    }, 0);
    return `<div class="weapon-art-draft-summary-line">
      <span>${escapeHtml(getWeaponArtCategoryLabel(lane))}</span>
      <strong>${count}</strong>
    </div>`;
  }).join("");
  const ownedEvolutions = (progress.selectedEvolutionIds || [])
    .map((nodeId) => getBasicAttackNode(attackType, nodeId))
    .filter(Boolean)
    .map((node) => node.name)
    .join(", ");
  return `
    <div class="weapon-art-draft-side-card">
      <h3 class="weapon-art-draft-side-title">Path Summary</h3>
      <div class="weapon-art-draft-summary-line"><span>Spent Value</span><strong>${getBasicAttackSpentValue(attackType, progress)}</strong></div>
      <div class="weapon-art-draft-summary-line"><span>Owned Ranks</span><strong>${Object.values(progress.purchasedRanks || {}).reduce((sum, rank) => sum + (Number(rank) || 0), 0)}</strong></div>
      ${laneRows}
      <div class="weapon-art-draft-summary-evo">${ownedEvolutions ? escapeHtml(ownedEvolutions) : "No evolution chosen yet."}</div>
    </div>
  `;
}

function attachHandlers() {
  const body = getBodyEl();
  if (!body || !activeSession) return;

  body.querySelectorAll("[data-choice-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const attackType = getCurrentAttackType();
      const nodeId = button.getAttribute("data-choice-node-id");
      if (!attackType || !nodeId) return;
      const result = resolveWeaponArtDraftChoice(attackType, nodeId, activeSession.currentChoiceState);
      if (!result) return;
      const artState = getArtSessionState(attackType);
      const chosenOffer = (activeSession.currentOffers || []).find((offer) => offer.id === nodeId);
      const skipped = (activeSession.currentOffers || [])
        .map((offer) => offer.id)
        .filter((offerId) => offerId !== nodeId);
      artState.recentSkippedNodeIds = Array.from(new Set([...(artState.recentSkippedNodeIds || []), ...skipped]));
      artState.lastDraftedCategory = chosenOffer?.draftCategory || getBasicAttackNode(attackType, nodeId)?.lane || artState.lastDraftedCategory;
      activeSession.currentChoiceState = null;
      activeSession.currentOffers = [];
      updateCurrentChoice();
    });
  });

  body.querySelectorAll("[data-token-type]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!activeSession?.currentChoiceState) return;
      const tokenType = button.getAttribute("data-token-type");
      if (tokenType === "insight") {
        activeSession.insightPickerOpen = true;
        renderWeaponArtDraftOverlay();
        return;
      }
      const result = useWeaponArtToken(tokenType, activeSession.currentChoiceState);
      if (!result?.ok) return;
      activeSession.currentChoiceState = result.choiceState;
      activeSession.currentOffers = result.offers;
      activeSession.insightPickerOpen = false;
      renderWeaponArtDraftOverlay();
    });
  });

  body.querySelectorAll("[data-insight-category]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!activeSession?.currentChoiceState) return;
      const category = button.getAttribute("data-insight-category");
      const result = useWeaponArtToken("insight", activeSession.currentChoiceState, { category });
      if (!result?.ok) return;
      activeSession.currentChoiceState = result.choiceState;
      activeSession.currentOffers = result.offers;
      activeSession.insightPickerOpen = false;
      renderWeaponArtDraftOverlay();
    });
  });
}

export function renderWeaponArtDraftOverlay() {
  const overlay = getOverlayEl();
  const body = getBodyEl();
  if (!overlay || !body || !activeSession) return;
  const attackType = getCurrentAttackType();
  if (!attackType) {
    finishSession();
    return;
  }
  const progress = getBasicAttackProgress(attackType);
  const tree = getBasicAttackTree(attackType);
  const inventory = getWeaponArtTokenInventory();
  const totalPending = activeSession.queue.reduce((sum, queuedAttackType) => {
    return sum + (getBasicAttackProgress(queuedAttackType).pendingPickCount || 0);
  }, 0);
  const currentChoiceState = activeSession.currentChoiceState || createBaseChoiceState(attackType, [], 3);
  const precisionAvailable = getLegalWeaponArtNodes(attackType, progress, {
    allowedRarities: ["common", "uncommon"]
  }).length > 0;

  const insightPicker = activeSession.insightPickerOpen
    ? `<div class="weapon-art-draft-category-picker">
        ${getWeaponArtCategories(attackType).map((category) => `
          <button type="button" class="weapon-art-draft-category-btn" data-insight-category="${escapeHtml(category)}">${escapeHtml(getWeaponArtCategoryLabel(category))}</button>
        `).join("")}
      </div>`
    : "";

  body.innerHTML = `
    <div class="weapon-art-draft-header">
      <div>
        <h1 class="weapon-art-draft-title">${escapeHtml(tree?.name || attackType)} Weapon Art</h1>
        <p class="weapon-art-draft-subtitle">Resolve your post-run draft picks before the next run.</p>
      </div>
      <div class="weapon-art-draft-pending">
        <span>Current Art Picks: <strong>${progress.pendingPickCount || 0}</strong></span>
        <span>Total Pending: <strong>${totalPending}</strong></span>
      </div>
    </div>
    <div class="weapon-art-draft-layout">
      <section class="weapon-art-draft-main">
        <div class="weapon-art-draft-token-row">
          ${renderTokenButton("refresh", "Refresh", inventory, currentChoiceState.tokenUsed || !(inventory.refresh > 0))}
          ${renderTokenButton("insight", "Insight", inventory, currentChoiceState.tokenUsed || !(inventory.insight > 0))}
          ${renderTokenButton("expansion", "Expansion", inventory, currentChoiceState.tokenUsed || !(inventory.expansion > 0))}
          ${renderTokenButton("precision", "Precision", inventory, currentChoiceState.tokenUsed || !(inventory.precision > 0) || !precisionAvailable)}
        </div>
        ${insightPicker}
        <div class="weapon-art-draft-offers">
          ${(activeSession.currentOffers || []).map((offer) => renderCurrentOfferCard(offer, progress.pendingPickCount || 0)).join("")}
        </div>
      </section>
      <aside class="weapon-art-draft-side">
        ${renderPathSummary(attackType)}
      </aside>
    </div>
  `;
  overlay.classList.remove("hidden");
  attachHandlers();
}

export function openWeaponArtDraftOverlay(options = {}) {
  const queue = buildQueue(options?.preferredAttackType || null);
  if (queue.length <= 0) return false;
  activeSession = {
    queue,
    queueIndex: 0,
    artState: {},
    currentChoiceState: null,
    currentOffers: [],
    insightPickerOpen: false,
    onComplete: typeof options?.onComplete === "function" ? options.onComplete : null
  };
  updateCurrentChoice();
  return true;
}

export function closeWeaponArtDraftOverlay() {
  if (activeSession) return;
  const overlay = getOverlayEl();
  if (overlay) overlay.classList.add("hidden");
}

export function isWeaponArtDraftOverlayOpen() {
  return !!activeSession;
}
