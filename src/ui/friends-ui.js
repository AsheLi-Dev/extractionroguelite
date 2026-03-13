// -------- Friends UI --------
// Friends Hub, Friend Detail, Mailbox panels

import { escapeHtml } from '../utils.js';
import { FRIENDS_CATALOG, FRIEND_IDS, getGiftParamsForLevel, COMPANION_BUFFS } from '../data/friends-data.js';
import {
  getFriendsState, saveFriendsState, updateAllFriendGiftBanks, getFriend, getTimeToNextGiftMs,
  claimFriendGiftsToMailbox, claimMailboxEntry, canSelectCompanion, setSelectedCompanion,
  sendGiftToFriend, getGiftPreferenceLevel
} from '../systems/friends-system.js';
import { buildLegacyVault } from './save-system.js';
import { openLegacyVaultForGift } from './legacy-vault-gift.js';

let _inventoryApi = null;

export function setInventoryApi(api) {
  _inventoryApi = api;
}

// Simple inventory API for between-runs mailbox claiming
// Items go to friends state stash, which gets merged into legacyItems on next run start
function getDefaultInventoryApi() {
  return {
    canAdd: () => true, // Always can add (no capacity limit)
    add: (item) => {
      const state = getFriendsState();
      state.stash.push(item);
      saveFriendsState(state);
    }
  };
}

export function openFriends() {
  const state = getFriendsState();
  updateAllFriendGiftBanks(state);
  saveFriendsState(state);
  renderFriendsHub();
  const overlay = document.getElementById("friends-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

export function closeFriends() {
  const overlay = document.getElementById("friends-overlay");
  if (overlay) overlay.classList.add("hidden");
  // If we're in the hub (home base), stay there; otherwise return to main menu
  if (document.body.classList.contains("home-base-active")) return;
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.classList.remove("hidden");
}

export function getFriendSpriteHtml(friendDef, pixelSize = 64, spriteClass = "friend-sprite") {
  if (!friendDef?.spritePath) return friendDef?.iconKey ? `<span class="friend-icon">${friendDef.iconKey}</span>` : '';
  const rect = friendDef.spriteRect;
  const sheet = friendDef.spriteSheetSize;
  if (rect && sheet) {
    const scale = pixelSize / rect.w;
    const w = Math.round(sheet.w * scale);
    const h = Math.round(sheet.h * scale);
    const ml = -rect.x * scale;
    const mt = -rect.y * scale;
    return `<div class="friend-sprite-wrap" style="width:${pixelSize}px;height:${pixelSize}px;overflow:hidden;flex-shrink:0;">
      <img src="${escapeHtml(friendDef.spritePath)}" alt="${escapeHtml(friendDef.displayName)}" class="${escapeHtml(spriteClass)}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;margin-left:${ml}px;margin-top:${mt}px;" />
    </div>`;
  }
  return `<img src="${escapeHtml(friendDef.spritePath)}" alt="${escapeHtml(friendDef.displayName)}" class="${escapeHtml(spriteClass)}" width="${pixelSize}" height="${pixelSize}" style="width: ${pixelSize}px; height: ${pixelSize}px; max-width: ${pixelSize}px; max-height: ${pixelSize}px;" />`;
}

function formatTimeMs(ms) {
  if (ms === null || ms === undefined) return "";
  if (ms === 0) return "Ready";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function renderFriendsHub() {
  const hubContent = document.getElementById("friends-hub-content");
  const detailContent = document.getElementById("friends-detail-content");
  const mailboxContent = document.getElementById("friends-mailbox-content");
  
  if (hubContent) hubContent.classList.remove("hidden");
  if (detailContent) detailContent.classList.add("hidden");
  if (mailboxContent) mailboxContent.classList.add("hidden");
  
  if (!hubContent) return;

  const state = getFriendsState();
  updateAllFriendGiftBanks(state);

  let html = '<div class="friends-hub-grid">';
  
  for (const friendId of FRIEND_IDS) {
    const friendDef = FRIENDS_CATALOG[friendId];
    const friend = getFriend(state, friendId);
    if (!friend || !friendDef) continue;

    const params = getGiftParamsForLevel(friend.level);
    const timeToNext = getTimeToNextGiftMs(friend);
    const canCompanion = canSelectCompanion(state, friendId);
    const isSelected = state.selectedCompanionId === friendId;

    html += `<div class="friend-card" data-friend-id="${escapeHtml(friendId)}">
      <div class="friend-card-header">
        ${getFriendSpriteHtml(friendDef, 64)}
        <div class="friend-name">${escapeHtml(friendDef.displayName)}</div>
      </div>
      <div class="friend-level">Level ${friend.level}</div>
      <div class="friend-xp">XP: ${friend.xp} / ${getXPThreshold(friend.level)}</div>
      ${canCompanion ? `<div class="friend-companion-badge ${isSelected ? 'selected' : ''}">${isSelected ? ' Companion' : 'Companion Available'}</div>` : ''}
      ${params ? `
        <div class="friend-gifts">
          <span class="friend-gift-icon"></span>
          <span class="friend-gift-count">${friend.giftBank} / ${params.cap}</span>
        </div>
        ${friend.giftBank < params.cap ? `<div class="friend-gift-timer">Next in ${formatTimeMs(timeToNext)}</div>` : ''}
      ` : ''}
      <button class="friend-detail-btn" data-friend-id="${escapeHtml(friendId)}">View Details</button>
    </div>`;
  }

  html += '</div>';
  html += '<div class="friends-hub-actions">';
  html += '<button id="friends-mailbox-btn" class="friends-action-btn"> Mailbox</button>';
  html += '<button id="friends-close-btn" class="friends-action-btn">Back</button>';
  html += '</div>';

  hubContent.innerHTML = html;

  // Event listeners
  hubContent.querySelectorAll(".friend-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const friendId = btn.dataset.friendId;
      if (friendId) renderFriendDetail(friendId);
    });
  });

  const mailboxBtn = document.getElementById("friends-mailbox-btn");
  if (mailboxBtn) {
    mailboxBtn.addEventListener("click", () => renderMailbox());
  }

  const closeBtn = document.getElementById("friends-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeFriends);
  }
}

function getXPThreshold(level) {
  const thresholds = [0, 100, 250, 450, 700];
  return level >= 5 ? "MAX" : thresholds[level] || 0;
}

function renderFriendDetail(friendId) {
  const hubContent = document.getElementById("friends-hub-content");
  const detailContent = document.getElementById("friends-detail-content");
  const mailboxContent = document.getElementById("friends-mailbox-content");
  
  if (hubContent) hubContent.classList.add("hidden");
  if (detailContent) detailContent.classList.remove("hidden");
  if (mailboxContent) mailboxContent.classList.add("hidden");
  
  if (!detailContent) return;

  const state = getFriendsState();
  const friendDef = FRIENDS_CATALOG[friendId];
  const friend = getFriend(state, friendId);
  if (!friend || !friendDef) return;

  updateAllFriendGiftBanks(state);
  const params = getGiftParamsForLevel(friend.level);
  const timeToNext = getTimeToNextGiftMs(friend);
  const canCompanion = canSelectCompanion(state, friendId);
  const isSelected = state.selectedCompanionId === friendId;
  const buffs = COMPANION_BUFFS[friendId];

  let html = `<div class="friend-detail-header">
    ${getFriendSpriteHtml(friendDef, 128, "friend-sprite-large")}
    <div>
      <div class="friend-name-large">${escapeHtml(friendDef.displayName)}</div>
      <div class="friend-theme">${escapeHtml(friendDef.theme)}</div>
    </div>
  </div>`;

  html += `<div class="friend-detail-section">
    <h3>Level & XP</h3>
    <div>Level ${friend.level}</div>
    <div>XP: ${friend.xp} / ${getXPThreshold(friend.level)}</div>
  </div>`;

  if (buffs) {
    html += `<div class="friend-detail-section">
      <h3>Companion Buffs</h3>`;
    
    if (canCompanion) {
      html += `<div class="companion-status ${isSelected ? 'selected' : ''}">
        ${isSelected ? ' Currently Selected' : 'Available as Companion'}
      </div>`;
    } else {
      html += `<div class="companion-status">
        Unlock at Level 2
      </div>`;
    }
    
    for (let level = 2; level <= 5; level++) {
      const levelBuffs = buffs[level];
      if (!levelBuffs) continue;
      html += `<div class="companion-buff-level">
        <strong>Level ${level}:</strong> `;
      const buffEntries = Object.entries(levelBuffs);
      html += buffEntries.map(([key, value]) => {
        const label = formatBuffLabel(key, value);
        return label;
      }).join(", ");
      html += `</div>`;
    }
    html += `</div>`;

    if (canCompanion) {
      html += `<div class="friend-detail-actions">
        ${isSelected ? 
          `<button class="companion-select-btn" data-friend-id="${escapeHtml(friendId)}" data-action="deselect">Deselect Companion</button>` :
          `<button class="companion-select-btn" data-friend-id="${escapeHtml(friendId)}" data-action="select">Select as Companion</button>`
        }
      </div>`;
    }
  }

  if (params) {
    html += `<div class="friend-detail-section">
      <h3>Timed Gifts</h3>
      <div> ${friend.giftBank} / ${params.cap} available</div>
      ${friend.giftBank < params.cap ? `<div>Next gift in: ${formatTimeMs(timeToNext)}</div>` : '<div>Bank is full!</div>'}
      <div class="friend-gift-actions">
        ${friend.giftBank >= 1 ? `<button class="friend-claim-btn" data-friend-id="${escapeHtml(friendId)}" data-count="1">Claim 1</button>` : ''}
        ${friend.giftBank > 0 ? `<button class="friend-claim-btn" data-friend-id="${escapeHtml(friendId)}" data-count="all">Claim All</button>` : ''}
      </div>
    </div>`;
  } else {
    html += `<div class="friend-detail-section">
      <h3>Timed Gifts</h3>
      <div>Unlock at Level 3</div>
    </div>`;
  }

  html += `<div class="friend-detail-actions">
    <button class="friend-send-gift-btn" data-friend-id="${escapeHtml(friendId)}">Send Gift</button>
    <button class="friend-back-btn">Back to Hub</button>
  </div>`;

  detailContent.innerHTML = html;

  // Event listeners
  detailContent.querySelectorAll(".companion-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const fid = btn.dataset.friendId;
      if (action === "select") {
        setSelectedCompanion(state, fid);
      } else if (action === "deselect") {
        setSelectedCompanion(state, null);
      }
      saveFriendsState(state);
      renderFriendDetail(friendId);
    });
  });

  detailContent.querySelectorAll(".friend-claim-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const fid = btn.dataset.friendId;
      const count = btn.dataset.count === "all" ? "all" : parseInt(btn.dataset.count) || 1;
      if (claimFriendGiftsToMailbox(state, fid, count)) {
        saveFriendsState(state);
        renderFriendDetail(friendId);
      }
    });
  });

  const sendGiftBtn = detailContent.querySelector(".friend-send-gift-btn");
  if (sendGiftBtn) {
    sendGiftBtn.addEventListener("click", () => {
      const fid = sendGiftBtn.dataset.friendId;
      if (fid) {
        openLegacyVaultForGift(fid, (item, vaultIndex) => {
          handleGiftSent(fid, item, vaultIndex);
        });
      }
    });
  }

  const backBtn = detailContent.querySelector(".friend-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => renderFriendsHub());
  }
}

function handleGiftSent(friendId, item, vaultIndex) {
  const state = getFriendsState();
  const result = sendGiftToFriend(state, friendId, item);
  
  if (result) {
    // Remove item from legacy vault
    if (vaultIndex !== undefined && vaultIndex !== null) {
      removeItemFromLegacyVaultByIndex(vaultIndex);
    }
    
    // Save state
    saveFriendsState(state);
    
    // Show feedback
    const friendDef = FRIENDS_CATALOG[friendId];
    const friendName = friendDef ? friendDef.displayName : friendId;
    const preferenceText = result.preference === "loves" ? "loved" : 
                          result.preference === "likes" ? "liked" : "accepted";
    const levelText = result.leveledUp ? ` Level up! Now level ${result.newLevel}!` : "";
    
    alert(`${friendName} ${preferenceText} your gift!\n+${result.xpGained} XP${levelText}`);
    
    // Don't close the panel - it will refresh automatically via renderLegacyVaultForGift
    // The panel stays open so player can send more gifts
  }
}

function removeItemFromLegacyVaultByIndex(index) {
  import('./save-system.js').then(m => {
    const vault = buildLegacyVault();
    const entry = vault[index];
    if (!entry) return;
    
    const saved = m.loadSavedCharacters();
    let conquerorVault = m.loadConquerorVault();
    
    if (entry.source === "conqueror") {
      if (typeof entry.conquerorIndex === "number") {
        conquerorVault = conquerorVault.filter((_, i) => i !== entry.conquerorIndex);
        localStorage.setItem(m.CONQUEROR_VAULT_KEY, JSON.stringify(conquerorVault));
      }
    } else if (entry.source === "character-equipment") {
      const ch = saved[entry.charIndex];
      if (ch && ch.equipment && entry.slot) {
        ch.equipment[entry.slot] = null;
        localStorage.setItem(m.SAVE_KEY, JSON.stringify(saved));
      }
    } else if (entry.source === "character-inventory") {
      const ch = saved[entry.charIndex];
      if (ch && Array.isArray(ch.inventory) && typeof entry.invIndex === "number") {
        ch.inventory = ch.inventory.filter((_, i) => i !== entry.invIndex);
        localStorage.setItem(m.SAVE_KEY, JSON.stringify(saved));
      }
    }
  });
}

function formatBuffLabel(key, value) {
  const labels = {
    critChance: `+${(value * 100).toFixed(0)}% Crit Chance`,
    moveSpeed: `+${(value * 100).toFixed(0)}% Move Speed`,
    cubeDropRate: `+${(value * 100).toFixed(0)}% Cube Drop Rate`,
    pickupRadius: `+${(value * 100).toFixed(0)}% Pickup Radius`,
    damageReduction: `${(value * 100).toFixed(0)}% Damage Reduction`,
    hpRegen: `+${(value * 100).toFixed(0)}% HP Regen`,
    skillDamage: `+${(value * 100).toFixed(0)}% Skill Damage`,
    skillCooldownReduction: `+${(value * 100).toFixed(0)}% Skill Cooldown Reduction`,
    meleeDamage: `+${(value * 100).toFixed(0)}% Melee Damage`,
    lifesteal: `${(value * 100).toFixed(0)}% Lifesteal`,
    dropDuplicateChance: `+${(value * 100).toFixed(0)}% Drop Duplicate Chance`,
    shopDiscount: `${(value * 100).toFixed(0)}% Shop Discount`
  };
  return labels[key] || `${key}: ${(value * 100).toFixed(0)}%`;
}

function renderMailbox() {
  const hubContent = document.getElementById("friends-hub-content");
  const detailContent = document.getElementById("friends-detail-content");
  const mailboxContent = document.getElementById("friends-mailbox-content");
  
  if (hubContent) hubContent.classList.add("hidden");
  if (detailContent) detailContent.classList.add("hidden");
  if (mailboxContent) mailboxContent.classList.remove("hidden");
  
  if (!mailboxContent) return;

  const state = getFriendsState();

  let html = '<div class="mailbox-header"><h2>Mailbox</h2></div>';
  html += '<div class="mailbox-entries">';

  if (state.mailbox.length === 0) {
    html += '<div class="mailbox-empty">No mail</div>';
  } else {
    for (let i = 0; i < state.mailbox.length; i++) {
      const entry = state.mailbox[i];
      const friendDef = FRIENDS_CATALOG[entry.friendId];
      const friendName = friendDef ? friendDef.displayName : entry.friendId;
      const date = new Date(entry.createdAt);
      const timeStr = date.toLocaleString();

      html += `<div class="mailbox-entry">
        <div class="mailbox-entry-header">
          <div class="mailbox-entry-from">${escapeHtml(entry.label || friendName)}</div>
          <div class="mailbox-entry-time">${escapeHtml(timeStr)}</div>
        </div>
        <div class="mailbox-entry-items">`;
      
      for (const item of entry.items || []) {
        if (item.type === "Cube") {
          html += `<div class="mailbox-item">${escapeHtml(item.name || item.cubeKey)}</div>`;
        } else {
          html += `<div class="mailbox-item">${escapeHtml(item.name || item.type)} (${escapeHtml(item.rarity || 'common')})</div>`;
        }
      }

      html += `</div>
        <button class="mailbox-claim-btn" data-index="${i}">Claim</button>
      </div>`;
    }
  }

  html += '</div>';
  html += '<div class="mailbox-actions">';
  html += '<button class="mailbox-back-btn">Back to Hub</button>';
  html += '</div>';

  mailboxContent.innerHTML = html;

  // Event listeners
  mailboxContent.querySelectorAll(".mailbox-claim-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index);
      if (!isNaN(index)) {
        const api = _inventoryApi || getDefaultInventoryApi();
        if (claimMailboxEntry(state, index, api)) {
          saveFriendsState(state);
          renderMailbox();
        }
      }
    });
  });

  const backBtn = mailboxContent.querySelector(".mailbox-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => renderFriendsHub());
  }
}
