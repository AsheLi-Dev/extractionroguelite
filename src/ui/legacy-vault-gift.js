// -------- Legacy Vault Gift Selection Mode --------
// Modified legacy vault for selecting a single item to send as a gift

import { escapeHtml } from '../utils.js';
import { buildLegacyVault } from './save-system.js';
import { formatItemStats, formatItemModifierEntries } from './tooltips.js';
import { getGiftPreferenceLevel } from '../systems/friends-system.js';
import { FRIENDS_CATALOG } from '../data/friends-data.js';

let _giftCallback = null;
let _currentFriendId = null;

export function isGiftMode() {
  return _giftCallback !== null;
}

export function openLegacyVaultForGift(friendId, callback) {
  _currentFriendId = friendId;
  _giftCallback = callback;
  renderLegacyVaultForGift();
  const overlay = document.getElementById("legacy-vault-overlay");
  const friendsOverlay = document.getElementById("friends-overlay");
  if (overlay) overlay.classList.remove("hidden");
  if (friendsOverlay) friendsOverlay.classList.add("hidden");
  
  // Update the title and button text
  const title = document.querySelector(".legacy-vault-title");
  const subtitle = document.querySelector(".legacy-vault-subtitle");
  const startBtn = document.getElementById("legacy-start-run");
  const friendDef = FRIENDS_CATALOG[friendId];
  const friendName = friendDef ? friendDef.displayName : friendId;
  
  if (title) title.textContent = `Send Gift to ${friendName}`;
  if (subtitle) {
    subtitle.textContent = "Select an item from your Legacy Vault to send as a gift.";
  }
  if (startBtn) {
    startBtn.textContent = "Send Gift";
    startBtn.disabled = true;
  }
}

export function closeLegacyVaultForGift() {
  _giftCallback = null;
  _currentFriendId = null;
  const overlay = document.getElementById("legacy-vault-overlay");
  const friendsOverlay = document.getElementById("friends-overlay");
  if (overlay) overlay.classList.add("hidden");
  if (friendsOverlay) friendsOverlay.classList.remove("hidden");
  
  // Restore original title and button text
  const title = document.querySelector(".legacy-vault-title");
  const subtitle = document.querySelector(".legacy-vault-subtitle");
  const startBtn = document.getElementById("legacy-start-run");
  const countEl = document.getElementById("legacy-selection-count");
  const maxEl = document.getElementById("legacy-vault-max-count");
  
  if (title) title.textContent = "Legacy Vault";
  if (subtitle) {
    const max = 3; // Default max
    subtitle.textContent = `Items collected by your champions. Pick up to ${max} to start your new run.`;
  }
  if (startBtn) {
    startBtn.textContent = "Start New Run";
    startBtn.onclick = null; // Reset handler
    startBtn.disabled = true;
  }
  if (countEl) countEl.textContent = "0 / 3 selected";
  if (maxEl) maxEl.textContent = "3";
}

function renderLegacyVaultForGift() {
  const grid = document.getElementById("legacy-vault-grid");
  const countEl = document.getElementById("legacy-selection-count");
  const startBtn = document.getElementById("legacy-start-run");
  if (!grid || !_currentFriendId) return;

  const vault = buildLegacyVault();

  grid.innerHTML = "";
  if (vault.length === 0) {
    const p = document.createElement("p");
    p.className = "legacy-vault-empty";
    p.textContent = "No items in the vault yet. Save characters to the Hall of Champions to add items!";
    grid.appendChild(p);
    if (startBtn) startBtn.disabled = true;
    return;
  }

  let selectedIndex = null;

  vault.forEach((entry, idx) => {
    const card = document.createElement("div");
    card.className = "legacy-vault-item";
    card.dataset.index = String(idx);
    
    // Show gift preference indicator
    const preference = getGiftPreferenceLevel(_currentFriendId, entry.item);
    let preferenceBadge = "";
    if (preference === "loves") {
      preferenceBadge = '<div class="gift-preference-badge loves"> Loves</div>';
    } else if (preference === "likes") {
      preferenceBadge = '<div class="gift-preference-badge likes"> Likes</div>';
    }
    
    const statsStr = formatItemStats(entry.item);
    const mods = formatItemModifierEntries(entry.item);
    const modsHtml = mods.length
      ? `<ul class="legacy-item-mods">${mods.map((mod) => `<li style="color:${escapeHtml(mod.color)}">${escapeHtml(mod.text)}</li>`).join("")}</ul>`
      : "";
    card.innerHTML = `
      ${preferenceBadge}
      <div class="legacy-item-name">${escapeHtml(entry.item.name)}</div>
      <div class="legacy-item-type">${escapeHtml(entry.item.type)}</div>
      ${statsStr ? `<div class="legacy-item-stats">${escapeHtml(statsStr)}</div>` : ""}
      ${modsHtml}
      ${entry.item.description ? `<div class="legacy-item-desc">${escapeHtml(entry.item.description)}</div>` : ""}
      <div class="legacy-item-source">From: ${escapeHtml(entry.collectedBy)}</div>
    `;
    card.addEventListener("click", () => {
      // Single selection mode
      if (selectedIndex === idx) {
        selectedIndex = null;
        card.classList.remove("legacy-item-selected");
      } else {
        // Deselect previous
        if (selectedIndex !== null) {
          const prevCard = grid.querySelector(`[data-index="${selectedIndex}"]`);
          if (prevCard) prevCard.classList.remove("legacy-item-selected");
        }
        selectedIndex = idx;
        card.classList.add("legacy-item-selected");
      }
      updateGiftSelectionUI(selectedIndex, startBtn);
    });
    grid.appendChild(card);
  });

  updateGiftSelectionUI(selectedIndex, startBtn);
  
  // Update send button handler
  if (startBtn) {
    // Set up the gift handler - bootstrap.js will check isGiftMode() first
    startBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedIndex !== null && _giftCallback) {
        const vault = buildLegacyVault();
        const entry = vault[selectedIndex];
        if (entry && entry.item) {
          _giftCallback(entry.item, selectedIndex);
          // Refresh the vault display to show updated state (item removed)
          // The panel stays open so player can send more gifts
          setTimeout(() => {
            renderLegacyVaultForGift();
          }, 100);
        }
      }
      return false;
    };
  }
}

function updateGiftSelectionUI(selectedIndex, startBtn) {
  const countEl = document.getElementById("legacy-selection-count");
  if (countEl) {
    countEl.textContent = selectedIndex !== null ? "1 item selected" : "0 items selected";
  }
  if (startBtn) {
    startBtn.disabled = selectedIndex === null;
  }
}
