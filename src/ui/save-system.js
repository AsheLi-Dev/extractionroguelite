// -------- Save system (localStorage helpers) --------
import { GLOBAL_PLAYER_PROFILE_KEY } from "../data/constants.js";
import { getGlobalTalentCrystals } from "../data/crystals.js";

export const SAVE_KEY = "spaceShooter_characters";
export const CONQUEROR_VAULT_KEY = "spaceShooter_conquerorVault";
export const ETERNAL_ITEMS_ON_DEFEAT_KEY = "spaceShooter_eternalDefeatItems";
export const LEGACY_CUBE_STASH_KEY = "spaceShooter_legacyCubeStash";
export const LEGACY_ANCESTOR_STASH_KEY = "spaceShooter_legacyAncestorStash";
function getDefaultAttributes() {
  return { brutality: 0, agility: 0, vitality: 0, luck: 0 };
}

function sanitizeAttributes(attributes) {
  const source = attributes && typeof attributes === "object" ? attributes : {};
  return {
    brutality: Math.max(0, Math.floor(Number(source.brutality) || 0)),
    agility: Math.max(0, Math.floor(Number(source.agility) || 0)),
    vitality: Math.max(0, Math.floor(Number(source.vitality) || 0)),
    luck: Math.max(0, Math.floor(Number(source.luck) || 0))
  };
}

export function getDefaultGlobalPlayerProfile() {
  return {
    level: 1,
    xp: 0,
    unspentAttributePoints: 0,
    unspentTalentPoints: 0,
    attributes: getDefaultAttributes()
  };
}

export function loadGlobalPlayerProfile() {
  try {
    const raw = localStorage.getItem(GLOBAL_PLAYER_PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const fallback = getDefaultGlobalPlayerProfile();
    const legacyCrystalTotal = Object.values(getGlobalTalentCrystals()).reduce(
      (sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)),
      0
    );
    return {
      level: Math.max(1, Math.floor(Number(parsed?.level) || fallback.level)),
      xp: Math.max(0, Math.floor(Number(parsed?.xp) || fallback.xp)),
      unspentAttributePoints: Math.max(0, Math.floor(Number(parsed?.unspentAttributePoints) || fallback.unspentAttributePoints)),
      unspentTalentPoints: Math.max(
        0,
        Math.floor(
          Number(
            parsed?.unspentTalentPoints != null
              ? parsed.unspentTalentPoints
              : legacyCrystalTotal
          ) || fallback.unspentTalentPoints
        )
      ),
      attributes: sanitizeAttributes(parsed?.attributes)
    };
  } catch {
    return getDefaultGlobalPlayerProfile();
  }
}

export function saveGlobalPlayerProfile(profile) {
  const fallback = getDefaultGlobalPlayerProfile();
  const next = {
    level: Math.max(1, Math.floor(Number(profile?.level) || fallback.level)),
    xp: Math.max(0, Math.floor(Number(profile?.xp) || fallback.xp)),
    unspentAttributePoints: Math.max(0, Math.floor(Number(profile?.unspentAttributePoints) || fallback.unspentAttributePoints)),
    unspentTalentPoints: Math.max(0, Math.floor(Number(profile?.unspentTalentPoints) || fallback.unspentTalentPoints)),
    attributes: sanitizeAttributes(profile?.attributes)
  };
  localStorage.setItem(GLOBAL_PLAYER_PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function updateGlobalPlayerProfile(updates) {
  const current = loadGlobalPlayerProfile();
  return saveGlobalPlayerProfile({
    ...current,
    ...(updates && typeof updates === "object" ? updates : {}),
    attributes: updates?.attributes ? { ...current.attributes, ...updates.attributes } : current.attributes
  });
}

export function resetGlobalPlayerProfile() {
  return saveGlobalPlayerProfile(getDefaultGlobalPlayerProfile());
}

export function loadConquerorVault() {
  try {
    const raw = localStorage.getItem(CONQUEROR_VAULT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addConquerorBonusItem(item) {
  addLegacyVaultItem(item, "Conqueror");
}

export function addLegacyVaultItem(item, collectedBy = "Unknown") {
  const vault = loadConquerorVault();
  vault.push({ item, collectedBy });
  localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(vault));
}

export function loadLegacyCubeStash() {
  try {
    const raw = localStorage.getItem(LEGACY_CUBE_STASH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function addToLegacyCubeStash(cubeKey) {
  const stash = loadLegacyCubeStash();
  stash[cubeKey] = (stash[cubeKey] || 0) + 1;
  localStorage.setItem(LEGACY_CUBE_STASH_KEY, JSON.stringify(stash));
}

export function saveLegacyCubeStash(stash) {
  try {
    localStorage.setItem(LEGACY_CUBE_STASH_KEY, JSON.stringify(stash || {}));
  } catch {}
}

export function loadLegacyAncestorStash() {
  try {
    const raw = localStorage.getItem(LEGACY_ANCESTOR_STASH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLegacyAncestorStash(stash) {
  try {
    localStorage.setItem(LEGACY_ANCESTOR_STASH_KEY, JSON.stringify(Array.isArray(stash) ? stash : []));
  } catch {}
}

export function addToLegacyAncestorStash(spiritItem) {
  if (!spiritItem) return;
  const stash = loadLegacyAncestorStash();
  stash.push({
    id: spiritItem.id || `legacy_as_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    defId: spiritItem.defId,
    rarity: spiritItem.rarity || "normal",
    clans: Array.isArray(spiritItem.clans) ? [...spiritItem.clans] : [],
    savedAt: Date.now()
  });
  saveLegacyAncestorStash(stash);
}

export function consumeLegacyCubeStash() {
  const stash = loadLegacyCubeStash();
  localStorage.removeItem(LEGACY_CUBE_STASH_KEY);
  return stash;
}

export function restoreEternalItemsFromDefeat() {
  try {
    const raw = localStorage.getItem(ETERNAL_ITEMS_ON_DEFEAT_KEY);
    if (!raw) return;
    const items = JSON.parse(raw);
    localStorage.removeItem(ETERNAL_ITEMS_ON_DEFEAT_KEY);
    const vault = loadConquerorVault();
    for (const item of items) {
      vault.push({ item, collectedBy: "Eternal" });
    }
    localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(vault));
  } catch (_) {}
}

export function loadSavedCharacters() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Update a saved character by index (e.g. attribute allocation). Persists to localStorage.
 * @param {number} index - Index in the saved characters array.
 * @param {object} updates - Partial character object to merge (e.g. { attributes: { brutality: 1 } }).
 * @returns {boolean} True if updated and saved.
 */
export function updateSavedCharacter(index, updates) {
  const saved = loadSavedCharacters();
  if (index < 0 || index >= saved.length || !updates || typeof updates !== "object") return false;
  saved[index] = { ...saved[index], ...updates };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

export function buildLegacyVault() {
  const saved = loadSavedCharacters();
  const conquerorItems = loadConquerorVault();
  const vault = [];

  // Conqueror / Eternal items
  for (let i = 0; i < conquerorItems.length; i++) {
    const entry = conquerorItems[i];
    vault.push({
      item: { ...entry.item },
      collectedBy: entry.collectedBy || "Unknown",
      source: "conqueror",
      conquerorIndex: i
    });
  }

  // Items from saved characters
  for (let charIndex = 0; charIndex < saved.length; charIndex++) {
    const char = saved[charIndex];
    const name = char.name || "Unknown";

    if (char.equipment) {
      for (const [slot, item] of Object.entries(char.equipment)) {
        if (!item) continue;
        vault.push({
          item: { ...item, type: item.type || slot },
          collectedBy: name,
          source: "character-equipment",
          charIndex,
          slot
        });
      }
    }

    if (Array.isArray(char.inventory)) {
      char.inventory.forEach((inv, invIndex) => {
        if (!inv) return;
        vault.push({
          item: { ...inv },
          collectedBy: name,
          source: "character-inventory",
          charIndex,
          invIndex
        });
      });
    }
  }

  return vault;
}

/**
 * Persist an updated item back into the legacy vault (conqueror or saved character).
 * @param {object} entry - Vault entry from buildLegacyVault() with source, conquerorIndex or charIndex/slot or charIndex/invIndex.
 * @param {object} updatedItem - The modified item to save.
 * @returns {boolean} True if saved.
 */
export function updateLegacyVaultEntry(entry, updatedItem) {
  if (!entry) return false;
  const item = { ...updatedItem };
  if (entry.source === "conqueror" && typeof entry.conquerorIndex === "number") {
    const vault = loadConquerorVault();
    if (!vault[entry.conquerorIndex]) return false;
    vault[entry.conquerorIndex].item = item;
    localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(vault));
    return true;
  }
  const saved = loadSavedCharacters();
  const char = saved[entry.charIndex];
  if (!char) return false;
  if (entry.source === "character-equipment" && entry.slot && char.equipment && Object.prototype.hasOwnProperty.call(char.equipment, entry.slot)) {
    char.equipment[entry.slot] = item;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    return true;
  }
  if (entry.source === "character-inventory" && typeof entry.invIndex === "number" && Array.isArray(char.inventory) && char.inventory[entry.invIndex]) {
    char.inventory[entry.invIndex] = item;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    return true;
  }
  return false;
}
