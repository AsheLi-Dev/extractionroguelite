// -------- Friends System --------
// State management, XP/leveling, timed gift accumulation, mailbox, stash

import { FRIEND_IDS, FRIENDS_CATALOG, getGiftParamsForLevel, COMPANION_BUFFS, FRIEND_GIFT_POOLS, FRIEND_GIFT_PREFERENCES } from '../data/friends-data.js';
import { generateEquipmentItem } from '../data/loot-data.js';
import { MODIFIER_CUBES, UPGRADE_CUBES } from '../data/cubes-data.js';

// XP thresholds: [0, 100, 250, 450, 700] for levels 1-5
const XP_THRESHOLDS = [0, 100, 250, 450, 700];

const FRIENDS_SAVE_KEY = "spaceShooter_friends";

// Global state instance
let _friendsState = null;

// Initialize and load state
export function initFriendsState(saveData = null) {
  if (saveData === null) {
    // Load from localStorage
    try {
      const raw = localStorage.getItem(FRIENDS_SAVE_KEY);
      saveData = raw ? JSON.parse(raw) : null;
    } catch {
      saveData = null;
    }
  }

  const state = {
    friends: {},
    selectedCompanionId: null,
    mailbox: [],
    stash: []
  };

  // Migrate snow_owl → axolotl (one-time rename)
  const friendsFromSave = saveData?.friends ?? {};
  if (friendsFromSave.snow_owl && FRIEND_IDS.includes("axolotl")) {
    friendsFromSave.axolotl = friendsFromSave.axolotl ?? friendsFromSave.snow_owl;
  }

  // Initialize all 6 friends
  for (const friendId of FRIEND_IDS) {
    const saved = friendsFromSave[friendId];
    state.friends[friendId] = {
      level: saved?.level ?? 1,
      xp: saved?.xp ?? 0,
      giftBank: saved?.giftBank ?? 0,
      giftLastUpdateAt: saved?.giftLastUpdateAt ?? Date.now()
    };
  }

  if (saveData) {
    let selectedCompanionId = saveData.selectedCompanionId ?? null;
    if (selectedCompanionId === "snow_owl") selectedCompanionId = "axolotl";
    state.selectedCompanionId = selectedCompanionId;
    state.mailbox = Array.isArray(saveData.mailbox) ? saveData.mailbox : [];
    state.stash = Array.isArray(saveData.stash) ? saveData.stash : [];
  }

  // Update gift banks on load (offline accumulation)
  updateAllFriendGiftBanks(state);

  _friendsState = state;
  return state;
}

export function getFriendsState() {
  if (!_friendsState) {
    _friendsState = initFriendsState();
  }
  return _friendsState;
}

export function saveFriendsState(state = null) {
  const toSave = state || _friendsState;
  if (!toSave) return;
  try {
    localStorage.setItem(FRIENDS_SAVE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error("Failed to save friends state:", err);
  }
}

export function getFriend(state, id) {
  return state.friends[id] || null;
}

export function addFriendXP(state, id, amount) {
  const friend = getFriend(state, id);
  if (!friend) return false;

  const oldLevel = friend.level;
  friend.xp += amount;

  // Check for level ups
  while (friend.level < 5 && friend.xp >= XP_THRESHOLDS[friend.level]) {
    friend.level++;
  }

  // If level changed, ensure giftLastUpdateAt is initialized
  if (friend.level !== oldLevel && !friend.giftLastUpdateAt) {
    friend.giftLastUpdateAt = Date.now();
  }

  return friend.level !== oldLevel;
}

export function canSelectCompanion(state, id) {
  const friend = getFriend(state, id);
  return friend && friend.level >= 2;
}

export function setSelectedCompanion(state, id) {
  if (id === null || canSelectCompanion(state, id)) {
    state.selectedCompanionId = id;
    return true;
  }
  return false;
}

export function getCompanionBuffForRun(state) {
  if (!state.selectedCompanionId) return null;
  const friend = getFriend(state, state.selectedCompanionId);
  if (!friend || friend.level < 2) return null;

  const buffs = COMPANION_BUFFS[state.selectedCompanionId];
  if (!buffs || !buffs[friend.level]) return null;

  return {
    friendId: state.selectedCompanionId,
    modifiers: { ...buffs[friend.level] }
  };
}

// Update gift bank for a single friend
export function updateFriendGiftBank(friendState, nowMs = Date.now()) {
  const params = getGiftParamsForLevel(friendState.level);
  
  // Level < 3: no gifts, but ensure timestamp is initialized
  if (!params) {
    if (!friendState.giftLastUpdateAt) {
      friendState.giftLastUpdateAt = nowMs;
    }
    return;
  }

  // Initialize timestamp if missing
  if (!friendState.giftLastUpdateAt) {
    friendState.giftLastUpdateAt = nowMs;
    return;
  }

  // Calculate elapsed intervals
  const elapsedMs = nowMs - friendState.giftLastUpdateAt;
  if (elapsedMs < 0) {
    // Clock went backwards, reset timestamp
    friendState.giftLastUpdateAt = nowMs;
    return;
  }

  const elapsedIntervals = Math.floor(elapsedMs / params.intervalMs);
  
  if (elapsedIntervals <= 0) {
    // No new gifts yet
    return;
  }

  // Generate gifts
  const giftsGenerated = elapsedIntervals * params.giftsPerInterval;
  
  // Apply cap
  friendState.giftBank = Math.min(params.cap, friendState.giftBank + giftsGenerated);
  
  // Advance timestamp by whole intervals (preserve remainder)
  friendState.giftLastUpdateAt += elapsedIntervals * params.intervalMs;
}

// Update all friend gift banks
export function updateAllFriendGiftBanks(state, nowMs = Date.now()) {
  for (const friendId of FRIEND_IDS) {
    const friend = state.friends[friendId];
    if (friend) {
      updateFriendGiftBank(friend, nowMs);
    }
  }
}

// Get time until next gift (in milliseconds)
export function getTimeToNextGiftMs(friendState, nowMs = Date.now()) {
  const params = getGiftParamsForLevel(friendState.level);
  if (!params) return null;

  if (friendState.giftBank >= params.cap) {
    return 0; // Bank is full
  }

  if (!friendState.giftLastUpdateAt) {
    return params.intervalMs;
  }

  const elapsedMs = nowMs - friendState.giftLastUpdateAt;
  if (elapsedMs < 0) {
    return params.intervalMs;
  }

  const timeUntilNext = params.intervalMs - (elapsedMs % params.intervalMs);
  return Math.max(0, Math.min(params.intervalMs, timeUntilNext));
}

// Roll a timed gift for a friend
export function rollFriendTimedGift(friendId, level, rng = Math.random) {
  const pools = FRIEND_GIFT_POOLS[friendId];
  if (!pools) return null;

  // Determine rarity: level 5 has improved rare chance
  const rareChance = level === 5 ? 0.15 : 0.10;
  const uncommonChance = 0.30;

  let pool;
  const roll = rng();
  if (roll < rareChance) {
    pool = pools.rare;
  } else if (roll < rareChance + uncommonChance) {
    pool = pools.uncommon;
  } else {
    pool = pools.common;
  }

  if (!pool || pool.length === 0) return null;

  const itemDef = pool[Math.floor(rng() * pool.length)];
  
  // Generate actual item if it's equipment
  if (itemDef.type !== "Cube") {
    return generateEquipmentItem(
      itemDef.type,
      0.5, // lootQuality
      0, // qualityBonus
      itemDef.rarity || null,
      { difficulty: null }
    );
  } else {
    // Return cube reference
    return {
      type: "Cube",
      cubeKey: itemDef.cubeKey,
      name: getCubeName(itemDef.cubeKey)
    };
  }
}

function getCubeName(cubeKey) {
  const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
  const cube = allCubes.find(c => c.id === cubeKey);
  return cube ? cube.label : cubeKey;
}

// Claim gifts from a friend to mailbox
export function claimFriendGiftsToMailbox(state, friendId, countOrAll) {
  const friend = getFriend(state, friendId);
  if (!friend) return false;

  // Update gift bank first
  updateFriendGiftBank(friend, Date.now());

  // Determine claim count
  let claimCount;
  if (countOrAll === "all") {
    claimCount = friend.giftBank;
  } else {
    claimCount = Math.min(countOrAll || 1, friend.giftBank);
  }

  if (claimCount <= 0) return false;

  // Decrease gift bank
  friend.giftBank -= claimCount;

  // Generate items
  const items = [];
  for (let i = 0; i < claimCount; i++) {
    const item = rollFriendTimedGift(friendId, friend.level);
    if (item) {
      items.push(item);
    }
  }

  // Create mailbox entry
  const friendDef = FRIENDS_CATALOG[friendId];
  const entry = {
    friendId,
    createdAt: Date.now(),
    items,
    label: `Gifts from ${friendDef ? friendDef.displayName : friendId}`
  };

  state.mailbox.unshift(entry); // Add to front (newest first)
  return true;
}

// Claim mailbox entry to inventory
export function claimMailboxEntry(state, mailboxIndex, inventoryApi) {
  const entry = state.mailbox[mailboxIndex];
  if (!entry) return false;

  const items = entry.items || [];
  const overflow = [];

  for (const item of items) {
    if (inventoryApi.canAdd(item)) {
      inventoryApi.add(item);
    } else {
      overflow.push(item);
    }
  }

  // Put overflow in stash
  if (overflow.length > 0) {
    state.stash.push(...overflow);
  }

  // Remove mailbox entry
  state.mailbox.splice(mailboxIndex, 1);
  return true;
}

// Check if an item matches a friend's gift preference
export function getGiftPreferenceLevel(friendId, item) {
  const prefs = FRIEND_GIFT_PREFERENCES[friendId];
  if (!prefs || !item) return "neutral";

  // Check if item is a cube
  if (item.type === "Cube") {
    // Sea Otter loves all cubes
    if (friendId === "sea_otter" && prefs.loves.some(p => p.type === "Cube")) {
      return "loves";
    }
    // Capybara (Calm) likes cubes
    if (friendId === "capybara_calm" && prefs.likes.some(p => p.type === "Cube")) {
      return "likes";
    }
  }

  // Check equipment items
  const itemType = item.type;
  const itemWeight = item.weight;

  // Check loves
  for (const love of prefs.loves) {
    if (love.type === itemType) {
      if (love.weight === undefined || love.weight === itemWeight) {
        return "loves";
      }
    }
  }

  // Check likes
  for (const like of prefs.likes) {
    if (like.type === itemType) {
      if (like.weight === undefined || like.weight === itemWeight) {
        return "likes";
      }
    }
  }

  return "neutral";
}

// Send a gift to a friend and award XP
export function sendGiftToFriend(state, friendId, item) {
  const friend = getFriend(state, friendId);
  if (!friend || !item) return null;

  const preference = getGiftPreferenceLevel(friendId, item);
  let xpGained = 0;

  if (preference === "loves") {
    xpGained = 30 + Math.floor(Math.random() * 21); // 30-50
  } else if (preference === "likes") {
    xpGained = 20 + Math.floor(Math.random() * 21); // 20-40
  } else {
    xpGained = 10 + Math.floor(Math.random() * 6); // 10-15
  }

  const leveledUp = addFriendXP(state, friendId, xpGained);

  return {
    xpGained,
    preference,
    leveledUp,
    newLevel: friend.level
  };
}
