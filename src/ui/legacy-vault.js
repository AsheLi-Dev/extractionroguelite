// -------- Legacy Vault UI --------

import { escapeHtml } from '../utils.js';
import { hasTalent } from '../data/talents.js';
import {
  MODIFIER_CUBES, UPGRADE_CUBES, LEGENDARY_CUBES, rollModifierForTier, getModifierRollRangeForTier, getCubeDifficultyForTier
} from '../data/cubes-data.js';
import {
  EQUIPMENT_BASE_STAT, EQUIPMENT_SECONDARY_BASE, MODIFIER_POOL, LOCAL_STAT_SCALE_MOD_IDS, NAME_PREFIXES, NAME_SUFFIXES, getModifierPoolForType, rollLocalStatScaleValueForDifficulty
} from '../data/loot-data.js';
import {
  SAVE_KEY, CONQUEROR_VAULT_KEY,
  buildLegacyVault, loadSavedCharacters, loadConquerorVault,
  loadLegacyCubeStash, saveLegacyCubeStash, loadLegacyAncestorStash
} from './save-system.js';
import { getAncestorSpiritDef } from '../data/ancestor-spirits-data.js';
import { formatItemStats, formatItemModifiers, buildItemTooltipContent, getItemRarityColor } from './tooltips.js';
import { refreshMainMenuLP } from './main-menu.js';

let legacySelectedIndices = new Set();
let legacyVaultUiBound = false;
let legacyCraftSelectedEntryIndex = null;
let legacyCraftSelectedCube = null;
let legacyCraftPreviewTimer = null;
let legacyVaultActiveTab = "items";

function isLegacyCraftableItem(item) {
  if (!item) return false;
  if (item.type !== "Helmet" && item.type !== "Body Armour" && item.type !== "Weapon" && item.type !== "Boots") return false;
  if (item.rarity === "legendary") return false;
  if (item.livingItem) return false;
  return true;
}

function legacyRarityRank(item) {
  const r = (item?.rarity || "common").toLowerCase();
  if (r === "legendary") return 0;
  if (r === "rare") return 1;
  if (r === "magic") return 2;
  return 3;
}

function ensureLegacyVaultUiBindings() {
  if (legacyVaultUiBound) return;
  legacyVaultUiBound = true;
  const tabItems = document.getElementById("legacy-vault-tab-items");
  const tabAncestors = document.getElementById("legacy-vault-tab-ancestors");
  const tabCrafting = document.getElementById("legacy-vault-tab-crafting");
  const craftBtn = document.getElementById("legacy-crafting-confirm");
  if (tabItems) tabItems.addEventListener("click", () => setLegacyVaultTab("items"));
  if (tabAncestors) tabAncestors.addEventListener("click", () => setLegacyVaultTab("ancestors"));
  if (tabCrafting) tabCrafting.addEventListener("click", () => setLegacyVaultTab("crafting"));
  if (craftBtn) craftBtn.addEventListener("click", executeLegacyCraft);
}

function setLegacyVaultTab(tab) {
  legacyVaultActiveTab = (tab === "crafting" || tab === "ancestors") ? tab : "items";
  const tabItems = document.getElementById("legacy-vault-tab-items");
  const tabAncestors = document.getElementById("legacy-vault-tab-ancestors");
  const tabCrafting = document.getElementById("legacy-vault-tab-crafting");
  const contentItems = document.getElementById("legacy-vault-items-content");
  const contentAncestors = document.getElementById("legacy-vault-ancestors-content");
  const contentCrafting = document.getElementById("legacy-vault-crafting-content");
  if (tabItems) tabItems.classList.toggle("active", legacyVaultActiveTab === "items");
  if (tabAncestors) tabAncestors.classList.toggle("active", legacyVaultActiveTab === "ancestors");
  if (tabCrafting) tabCrafting.classList.toggle("active", legacyVaultActiveTab === "crafting");
  if (contentItems) contentItems.classList.toggle("hidden", legacyVaultActiveTab !== "items");
  if (contentAncestors) contentAncestors.classList.toggle("hidden", legacyVaultActiveTab !== "ancestors");
  if (contentCrafting) contentCrafting.classList.toggle("hidden", legacyVaultActiveTab !== "crafting");
}

export function renderLegacyVault() {
  ensureLegacyVaultUiBindings();
  const grid = document.getElementById("legacy-vault-grid");
  if (!grid) return;

  const vault = buildLegacyVault();
  legacySelectedIndices = new Set();
  if (
    !Number.isFinite(legacyCraftSelectedEntryIndex) ||
    legacyCraftSelectedEntryIndex < 0 ||
    legacyCraftSelectedEntryIndex >= vault.length ||
    !isLegacyCraftableItem(vault[legacyCraftSelectedEntryIndex]?.item)
  ) {
    legacyCraftSelectedEntryIndex = null;
  }

  grid.innerHTML = "";
  if (vault.length === 0) {
    const p = document.createElement("p");
    p.className = "legacy-vault-empty";
    p.textContent = "No items in the vault yet. Save characters to the Hall of Champions to add items!";
    grid.appendChild(p);
  } else {
  const categoryOrder = ["Weapon", "Ring", "Helmet", "Body Armour", "Boots"];
    const categoryBuckets = new Map(categoryOrder.map((c) => [c, []]));

    vault.forEach((entry, idx) => {
      const type = entry?.item?.type;
      if (categoryBuckets.has(type)) {
        categoryBuckets.get(type).push({ entry, idx });
      }
    });

    for (const category of categoryOrder) {
      const items = categoryBuckets.get(category) || [];
      if (items.length === 0) continue;
      items.sort((a, b) => {
        const rr = legacyRarityRank(a.entry.item) - legacyRarityRank(b.entry.item);
        if (rr !== 0) return rr;
        return String(a.entry.item?.name || "").localeCompare(String(b.entry.item?.name || ""));
      });

      const section = document.createElement("section");
      section.className = "legacy-vault-category";
      const title = document.createElement("h2");
      title.className = "legacy-vault-section-title";
      title.textContent = category;
      section.appendChild(title);

      const itemsWrap = document.createElement("div");
      itemsWrap.className = "legacy-vault-category-items";
      section.appendChild(itemsWrap);
      grid.appendChild(section);

      for (const row of items) {
        const { entry, idx } = row;
        const card = document.createElement("div");
        card.className = "legacy-vault-item";
        card.dataset.index = String(idx);
        const statsStr = formatItemStats(entry.item);
        const mods = formatItemModifiers(entry.item);
        const modsHtml = mods.length
          ? `<ul class="legacy-item-mods">${mods.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
          : "";
        card.innerHTML = `
          <div class="legacy-item-name">${escapeHtml(entry.item.name)}</div>
          <div class="legacy-item-type">${escapeHtml(entry.item.type)}</div>
          ${statsStr ? `<div class="legacy-item-stats">${escapeHtml(statsStr)}</div>` : ""}
          ${modsHtml}
          ${entry.item.description ? `<div class="legacy-item-desc">${escapeHtml(entry.item.description)}</div>` : ""}
          <div class="legacy-item-source">From: ${escapeHtml(entry.collectedBy)}</div>
        `;
        card.addEventListener("click", () => toggleLegacySelection(idx, card));
        itemsWrap.appendChild(card);
      }
    }
  }

  updateLegacySelectionUI();
  renderLegacyVaultAncestors();
  renderLegacyVaultCrafting();
  setLegacyVaultTab(legacyVaultActiveTab);
}

function renderLegacyVaultAncestors() {
  const grid = document.getElementById("legacy-vault-ancestor-grid");
  if (!grid) return;
  const ancestors = loadLegacyAncestorStash();
  grid.innerHTML = "";
  if (!ancestors.length) {
    const p = document.createElement("p");
    p.className = "legacy-vault-empty";
    p.textContent = "No ancestor spirits stored yet. Extract with spirits to bank them.";
    grid.appendChild(p);
    return;
  }

  const ordered = [...ancestors].sort((a, b) => {
    const rarityRank = { legendary: 0, rare: 1, magic: 2, normal: 3 };
    const rr = (rarityRank[a?.rarity] ?? 9) - (rarityRank[b?.rarity] ?? 9);
    if (rr !== 0) return rr;
    const defA = getAncestorSpiritDef(a?.defId);
    const defB = getAncestorSpiritDef(b?.defId);
    return String(defA?.name || a?.defId || "").localeCompare(String(defB?.name || b?.defId || ""));
  });

  for (const spirit of ordered) {
    const def = getAncestorSpiritDef(spirit.defId);
    const card = document.createElement("div");
    card.className = "legacy-vault-item";
    const rarity = String(spirit.rarity || def?.rarity || "normal");
    const clans = Array.isArray(spirit.clans) && spirit.clans.length ? spirit.clans : (def?.clans || []);
    card.innerHTML = `
      <div class="legacy-item-name">${escapeHtml(def?.name || spirit.defId || "Unknown Spirit")}</div>
      <div class="legacy-item-type">Ancestor Spirit</div>
      <div class="legacy-item-stats">Rarity: ${escapeHtml(rarity)}</div>
      <div class="legacy-item-desc">${escapeHtml(def?.description || "No description.")}</div>
      <div class="legacy-item-source">Clans: ${escapeHtml(clans.join("  "))}</div>
    `;
    grid.appendChild(card);
  }
}

function toggleLegacySelection(idx, cardEl) {
  const vault = buildLegacyVault();
  if (legacySelectedIndices.has(idx)) {
    legacySelectedIndices.delete(idx);
  } else if (legacySelectedIndices.size < maxLegacySelection()) {
    legacySelectedIndices.add(idx);
  }
  if (cardEl) {
    cardEl.classList.toggle("legacy-item-selected", legacySelectedIndices.has(idx));
  } else {
    const grid = document.getElementById("legacy-vault-grid");
    const card = grid?.querySelector(`[data-index="${idx}"]`);
    if (card) card.classList.toggle("legacy-item-selected", legacySelectedIndices.has(idx));
  }
  updateLegacySelectionUI();
}

function maxLegacySelection() {
  return hasTalent("vaultMaster") ? 8 : 3;
}

function updateLegacySelectionUI() {
  const countEl = document.getElementById("legacy-selection-count");
  const maxEl = document.getElementById("legacy-vault-max-count");
  const startBtn = document.getElementById("legacy-start-run");
  const max = maxLegacySelection();
  if (countEl) countEl.textContent = `${legacySelectedIndices.size} / ${max} selected`;
  if (maxEl) maxEl.textContent = max;
  if (startBtn) startBtn.disabled = legacySelectedIndices.size === 0;
}

export function getSelectedLegacyItems() {
  const vault = buildLegacyVault();
  return Array.from(legacySelectedIndices)
    .sort((a, b) => a - b)
    .map((idx) => ({ ...vault[idx].item }));
}

export function deleteLegacySelectedItems() {
  if (legacySelectedIndices.size === 0) return;
  if (!confirm("Delete selected items from the Legacy Vault? This cannot be undone.")) return;

  const vault = buildLegacyVault();
  const saved = loadSavedCharacters();
  let conquerorVault = loadConquerorVault();

  const conquerorToDelete = new Set();
  const equipToClear = new Map();
  const cardsToDelete = new Map();
  const invToDelete = new Map();

  for (const idx of legacySelectedIndices) {
    const entry = vault[idx];
    if (!entry) continue;
    if (entry.source === "conqueror") {
      if (typeof entry.conquerorIndex === "number") {
        conquerorToDelete.add(entry.conquerorIndex);
      }
    } else if (entry.source === "character-equipment") {
      const key = entry.charIndex;
      if (key == null || !entry.slot) continue;
      let set = equipToClear.get(key);
      if (!set) {
        set = new Set();
        equipToClear.set(key, set);
      }
      set.add(entry.slot);
    } else if (entry.source === "character-card") {
      const key = entry.charIndex;
      if (key == null || typeof entry.cardIndex !== "number") continue;
      let set = cardsToDelete.get(key);
      if (!set) {
        set = new Set();
        cardsToDelete.set(key, set);
      }
      set.add(entry.cardIndex);
    } else if (entry.source === "character-inventory") {
      const key = entry.charIndex;
      if (key == null || typeof entry.invIndex !== "number") continue;
      let set = invToDelete.get(key);
      if (!set) {
        set = new Set();
        invToDelete.set(key, set);
      }
      set.add(entry.invIndex);
    }
  }

  // Apply deletions to saved characters
  for (const [charIndex, slots] of equipToClear.entries()) {
    const ch = saved[charIndex];
    if (!ch || !ch.equipment) continue;
    for (const slot of slots) {
      if (Object.prototype.hasOwnProperty.call(ch.equipment, slot)) {
        ch.equipment[slot] = null;
      }
    }
  }

  for (const [charIndex, indices] of cardsToDelete.entries()) {
    const ch = saved[charIndex];
    if (!ch || !Array.isArray(ch.activeUpgradeCards)) continue;
    ch.activeUpgradeCards = ch.activeUpgradeCards.filter((_, i) => !indices.has(i));
  }

  for (const [charIndex, indices] of invToDelete.entries()) {
    const ch = saved[charIndex];
    if (!ch || !Array.isArray(ch.inventory)) continue;
    ch.inventory = ch.inventory.filter((_, i) => !indices.has(i));
  }

  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));

  // Apply deletions to conqueror vault
  if (conquerorToDelete.size > 0) {
    conquerorVault = conquerorVault.filter((_, i) => !conquerorToDelete.has(i));
    localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(conquerorVault));
  }

  legacySelectedIndices = new Set();
  renderLegacyVault();
}

function getLegacyCraftableEntries() {
  const vault = buildLegacyVault();
  const craftable = [];
  for (let i = 0; i < vault.length; i++) {
    const entry = vault[i];
    if (!entry || !isLegacyCraftableItem(entry.item)) continue;
    craftable.push({ entryIndex: i, entry });
  }
  craftable.sort((a, b) => {
    const rarityCmp = legacyRarityRank(a.entry.item) - legacyRarityRank(b.entry.item);
    if (rarityCmp !== 0) return rarityCmp;
    const typeCmp = String(a.entry.item?.type || "").localeCompare(String(b.entry.item?.type || ""));
    if (typeCmp !== 0) return typeCmp;
    return String(a.entry.item?.name || "").localeCompare(String(b.entry.item?.name || ""));
  });
  return craftable;
}

function renderLegacyVaultCrafting() {
  const grid = document.getElementById("legacy-cube-inventory-grid");
  const itemList = document.getElementById("legacy-crafting-item-list");
  if (!grid || !itemList) return;

  const stash = loadLegacyCubeStash();
  if (legacyCraftSelectedCube && (stash[legacyCraftSelectedCube] || 0) <= 0) {
    legacyCraftSelectedCube = null;
  }
  grid.innerHTML = "";
  itemList.innerHTML = "";

  const allCubes = [];
  for (const cube of MODIFIER_CUBES) {
    for (let t = 1; t <= 3; t++) allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
  }
  for (const cube of UPGRADE_CUBES) {
    for (let t = 1; t <= 3; t++) allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
  }
  for (const cube of LEGENDARY_CUBES) allCubes.push({ ...cube, tier: null, key: cube.id });

  const ownedCubes = allCubes.filter((c) => (stash[c.key] || 0) > 0);
  for (const c of ownedCubes) {
    const count = stash[c.key] || 0;
    const div = document.createElement("div");
    div.className = `cube-slot ${c.tier ? `tier-${c.tier}` : "tier-legendary"} ${legacyCraftSelectedCube === c.key ? "selected" : ""}`;
    const icon = c.tier ? (c.id.includes("magic") ? "M" : c.id.includes("rare") ? "R" : c.id.includes("reforge") ? "RF" : "C") : "L";
    const tierLabel = c.tier ? ` T${c.tier}` : "";
    div.innerHTML = `
      <span class="cube-icon">${icon}${tierLabel}</span>
      <span class="cube-slot-name">${escapeHtml(c.label)}</span>
      <span class="cube-slot-count">${count}</span>
    `;
    div.addEventListener("click", () => {
      legacyCraftSelectedCube = c.key;
      renderLegacyVaultCrafting();
    });
    grid.appendChild(div);
  }

  const craftables = getLegacyCraftableEntries();
  for (const row of craftables) {
    const item = row.entry.item;
    const li = document.createElement("li");
    const color = getItemRarityColor(item);
    const baseKey = EQUIPMENT_BASE_STAT[item.type];
    const baseVal = item.stats?.[baseKey] ?? 0;
    li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name || item.type)}</span> (+${baseVal}) [${escapeHtml(row.entry.collectedBy || "Unknown")}]`;
    li.classList.toggle("selected", legacyCraftSelectedEntryIndex === row.entryIndex);
    li.addEventListener("click", () => {
      legacyCraftSelectedEntryIndex = row.entryIndex;
      renderLegacyVaultCrafting();
    });
    itemList.appendChild(li);
  }

  updateLegacyCraftingPreview();
}

function updateLegacyCraftingPreview() {
  const itemEl = document.getElementById("legacy-crafting-selected-item");
  const cubeEl = document.getElementById("legacy-crafting-selected-cube");
  const statsEl = document.getElementById("legacy-crafting-item-stats");
  const previewEl = document.getElementById("legacy-crafting-preview");
  const confirmBtn = document.getElementById("legacy-crafting-confirm");
  if (!itemEl || !cubeEl || !previewEl || !confirmBtn) return;

  const vault = buildLegacyVault();
  const entry = Number.isFinite(legacyCraftSelectedEntryIndex) ? vault[legacyCraftSelectedEntryIndex] : null;
  const item = entry?.item || null;
  if (item) {
    itemEl.textContent = item.name || item.type || "Item";
    itemEl.classList.add("has-item");
    if (statsEl) {
      statsEl.innerHTML = buildItemTooltipContent(item, null);
      statsEl.classList.remove("hidden");
    }
  } else {
    itemEl.textContent = "No item selected";
    itemEl.classList.remove("has-item");
    if (statsEl) {
      statsEl.innerHTML = "";
      statsEl.classList.add("hidden");
    }
  }

  if (legacyCraftSelectedCube) {
    const tierMatch = legacyCraftSelectedCube.match(/T(\d)$/);
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
    const legCube = LEGENDARY_CUBES.find((c) => c.id === legacyCraftSelectedCube);
    const modCube = !legCube && MODIFIER_CUBES.find((c) => `${c.id}T${tier}` === legacyCraftSelectedCube || legacyCraftSelectedCube.startsWith(c.id));
    const upgCube = !legCube && UPGRADE_CUBES.find((c) => legacyCraftSelectedCube === `${c.id}T${tier}`);
    const cubeLabel = legCube ? legCube.label : (modCube ? `${modCube.label} T${tier}` : (upgCube ? `${upgCube.label} T${tier}` : legacyCraftSelectedCube));
    cubeEl.textContent = cubeLabel;
    cubeEl.classList.add("has-cube");
  } else {
    cubeEl.textContent = "No cube selected";
    cubeEl.classList.remove("has-cube");
  }

  let preview = "";
  let canCraft = false;
  if (item && legacyCraftSelectedCube) {
    if (item.rarity === "legendary") {
      preview = "Legendary items cannot be further crafted.";
    } else {
      const legCube = LEGENDARY_CUBES.find((c) => c.id === legacyCraftSelectedCube);
      const tier = parseInt(legacyCraftSelectedCube.match(/T(\d)$/)?.[1] || "1", 10);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => legacyCraftSelectedCube.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => legacyCraftSelectedCube.startsWith(c.id));

      if (legCube) {
        if (item.rarity !== "rare") {
          preview = "Legendary cubes can only be used on Rare (Yellow) items.";
        } else {
          preview = `Upgrades to Legendary and replaces one modifier with ${legCube.modifierLabel}.`;
          canCraft = true;
        }
      } else if (modCube) {
        if (item.rarity === "common" || !item.rarity) {
          preview = "Modifier cubes can only be used on Magic or Rare items. Use a Magic Cube first.";
        } else {
          const existing = item.modifiers?.find((m) => m.id === modCube.modifierId);
          const maxMods = item.rarity === "common" ? 0 : item.rarity === "magic" ? 2 : 4;
          const currentCount = item.modifiers?.length || 0;
          const r = getModifierRollRangeForTier(tier, modCube.modifierId);
          const range = `${(r.min * 100).toFixed(0)}-${(r.max * 100).toFixed(0)}%`;
          if (existing) {
            preview = `${modCube.modifierLabel} already exists on this item. Choose a different cube.`;
          } else if (currentCount < maxMods) {
            preview = `Adds ${modCube.modifierLabel} (${range}).`;
            canCraft = true;
          } else {
            preview = `Replaces a random modifier with ${modCube.modifierLabel} (${range}).`;
            canCraft = true;
          }
        }
      } else if (upgCube) {
        if (upgCube.id === "magicCube" && item.rarity !== "common") {
          preview = "Magic Cube can only be used on White (common) items.";
        } else if (upgCube.id === "rareCube" && item.rarity !== "magic") {
          preview = "Rare Cube can only be used on Blue (magic) items.";
        } else if (upgCube.id === "reforgeCube" && (item.rarity === "common" || !item.rarity)) {
          preview = "Reforge Cube can only be used on Blue or Yellow items.";
        } else if (upgCube.id === "vesselCube" || upgCube.id === "socketCube") {
          const currentSockets = item.sockets ?? 0;
          if (currentSockets >= 2) {
            preview = "Item already has maximum vessels (2).";
          } else {
            const socketMasteryBonus = hasTalent("socketMastery") ? " (20% chance to add 2 vessels)" : "";
            const maxPossible = currentSockets === 0 && hasTalent("socketMastery") ? 2 : 1;
            const newSockets = Math.min(2, currentSockets + maxPossible);
            preview = `Adds 1 vessel${socketMasteryBonus}. Item will have ${newSockets} vessel${newSockets !== 1 ? "s" : ""}.`;
            canCraft = true;
          }
        } else {
          if (upgCube.id === "magicCube") preview = "Upgrades to Blue and adds 2 random modifiers.";
          else if (upgCube.id === "rareCube") preview = "Upgrades to Yellow and adds 2 more modifiers.";
          else preview = "Rerolls all modifiers with new random values.";
          canCraft = true;
        }
      }
    }
  }

  previewEl.textContent = preview;
  previewEl.classList.toggle("hidden", !preview);
  confirmBtn.disabled = !canCraft;
}

function persistCraftedLegacyItem(entry, craftedItem) {
  if (!entry) return false;
  if (entry.source === "conqueror" && typeof entry.conquerorIndex === "number") {
    const vault = loadConquerorVault();
    if (!vault[entry.conquerorIndex]) return false;
    vault[entry.conquerorIndex].item = { ...craftedItem };
    localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(vault));
    return true;
  }

  const saved = loadSavedCharacters();
  const char = saved[entry.charIndex];
  if (!char) return false;

  if (entry.source === "character-equipment" && entry.slot && char.equipment && Object.prototype.hasOwnProperty.call(char.equipment, entry.slot)) {
    char.equipment[entry.slot] = { ...craftedItem };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    return true;
  }
  if (entry.source === "character-inventory" && typeof entry.invIndex === "number" && Array.isArray(char.inventory) && char.inventory[entry.invIndex]) {
    char.inventory[entry.invIndex] = { ...craftedItem };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    return true;
  }
  return false;
}

function executeLegacyCraft() {
  const stash = loadLegacyCubeStash();
  const count = stash[legacyCraftSelectedCube] || 0;
  if (!legacyCraftSelectedCube || count <= 0) return;

  const vault = buildLegacyVault();
  const entry = Number.isFinite(legacyCraftSelectedEntryIndex) ? vault[legacyCraftSelectedEntryIndex] : null;
  const item = entry?.item;
  if (!entry || !item || !isLegacyCraftableItem(item)) return;

  const tier = parseInt(legacyCraftSelectedCube.match(/T(\d)$/)?.[1] || "1", 10);
  const legCube = LEGENDARY_CUBES.find((c) => c.id === legacyCraftSelectedCube);
  const modCube = !legCube && MODIFIER_CUBES.find((c) => legacyCraftSelectedCube.startsWith(c.id));
  const upgCube = !legCube && UPGRADE_CUBES.find((c) => legacyCraftSelectedCube.startsWith(c.id));
  const crafted = { ...item, modifiers: Array.isArray(item.modifiers) ? item.modifiers.map((m) => ({ ...m })) : [] };

  if (legCube) {
    if (crafted.rarity !== "rare") return;
    applyLegendaryCube(crafted, legCube);
  } else if (modCube) {
    if (crafted.rarity === "common" || !crafted.rarity) return;
    if (crafted.modifiers?.some((m) => m.id === modCube.modifierId)) return;
    applyModifierCube(crafted, modCube, tier);
  } else if (upgCube) {
    if (upgCube.id === "vesselCube" || upgCube.id === "socketCube") applySocketCube(crafted);
    else applyUpgradeCube(crafted, upgCube, tier);
  } else {
    return;
  }

  const cascadeSave = hasTalent("cubeCascade") && Math.random() < 0.1;
  if (!cascadeSave) {
    stash[legacyCraftSelectedCube] = Math.max(0, (stash[legacyCraftSelectedCube] || 0) - 1);
    if (stash[legacyCraftSelectedCube] <= 0) delete stash[legacyCraftSelectedCube];
    saveLegacyCubeStash(stash);
  }

  if (!persistCraftedLegacyItem(entry, crafted)) return;
  legacyCraftSelectedCube = null;

  renderLegacyVault();
  setLegacyVaultTab("crafting");
  if (legacyCraftPreviewTimer) clearInterval(legacyCraftPreviewTimer);
  legacyCraftPreviewTimer = setInterval(updateLegacyCraftingPreview, 500);
  setTimeout(() => {
    if (legacyCraftPreviewTimer) {
      clearInterval(legacyCraftPreviewTimer);
      legacyCraftPreviewTimer = null;
    }
  }, 10000);
}

function applyModifierCube(item, cubeDef, tier) {
  item.modifiers = item.modifiers || [];
  const value = rollModifierForTier(tier, cubeDef.modifierId);
  const poolEntry = MODIFIER_POOL.find((m) => m.id === cubeDef.modifierId);
  const modEntry = {
    id: cubeDef.modifierId,
    label: cubeDef.modifierLabel,
    statKey: poolEntry?.statKey || cubeDef.modifierId.replace("Percent", ""),
    value,
    appliesTo: poolEntry?.appliesTo,
    addedAt: Date.now()
  };
  const existingIdx = item.modifiers.findIndex((m) => m.id === cubeDef.modifierId);
  const maxMods = item.rarity === "magic" ? 2 : item.rarity === "rare" ? 4 : 0;
  if (existingIdx >= 0) {
    item.modifiers[existingIdx] = { ...modEntry };
  } else if (item.modifiers.length < maxMods) {
    item.modifiers.push(modEntry);
  } else if (item.modifiers.length > 0) {
    const replaceIdx = Math.floor(Math.random() * item.modifiers.length);
    const removed = item.modifiers[replaceIdx];
    if (removed) {
      modEntry.removedModifier = {
        id: removed.id,
        label: removed.label,
        value: removed.value
      };
    }
    item.modifiers[replaceIdx] = modEntry;
  }
  rebuildItemStats(item);
}

function applyLegendaryCube(item, cubeDef) {
  if (item.rarity !== "rare") return;
  item.rarity = "legendary";
  const mods = item.modifiers || [];
  if (mods.length > 0) {
    const idx = Math.floor(Math.random() * mods.length);
    mods[idx] = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 };
  } else {
    item.modifiers = [{ id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 }];
  }
  rebuildItemStats(item);
}

function applySocketCube(item) {
  const currentSockets = item.sockets ?? 0;
  if (currentSockets >= 2) return;
  let add = 1;
  if (hasTalent("socketMastery") && Math.random() < 0.2) add = 2;
  item.sockets = Math.min(2, currentSockets + add);
  rebuildItemStats(item);
}

function applyUpgradeCube(item, cubeDef, tier) {
  if (cubeDef.id === "magicCube") {
    item.rarity = "magic";
    item.modifiers = item.modifiers || [];
    const pool = getModifierPoolForType(item.type);
    for (let i = 0; i < 2; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(tier)) : rollModifierForTier(tier, m.id);
      item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, appliesTo: m.appliesTo, addedAt: Date.now() });
    }
    const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(`${p} `));
    const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(` ${s}`));
    if (!hasPrefix && !hasSuffix) {
      if (Math.random() < 0.5) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
      else item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
    }
  } else if (cubeDef.id === "rareCube") {
    item.rarity = "rare";
    item.modifiers = item.modifiers || [];
    const pool = getModifierPoolForType(item.type).filter((p) => !item.modifiers.some((m) => m.id === p.id));
    const extraMods = hasTalent("transmutation") && Math.random() < 0.05 ? 3 : 2;
    for (let i = 0; i < extraMods; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(tier)) : rollModifierForTier(tier, m.id);
      item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, appliesTo: m.appliesTo, addedAt: Date.now() });
    }
    const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(`${p} `));
    const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(` ${s}`));
    if (!hasPrefix) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
    if (!hasSuffix) item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
  } else if (cubeDef.id === "reforgeCube") {
    item.modifiers = [];
    const pool = getModifierPoolForType(item.type);
    const count = item.rarity === "magic" ? 2 : 4;
    for (let i = 0; i < count; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(tier)) : rollModifierForTier(tier, m.id);
      item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, appliesTo: m.appliesTo, addedAt: Date.now() });
    }
  }
  rebuildItemStats(item);
}

function rebuildItemStats(item) {
  const baseKey = EQUIPMENT_BASE_STAT[item.type];
  if (!item.baseStat && item.stats) {
    item.baseStat = { [baseKey]: item.stats[baseKey] ?? 0 };
    const sec = EQUIPMENT_SECONDARY_BASE[item.type];
    if (sec) item.baseStat[sec.statKey] = item.stats[sec.statKey] ?? 0;
  }
  const stats = { ...(item.baseStat || {}) };
  for (const m of item.modifiers || []) {
    if (m.id === "defenseStatScale") {
      stats.defense = Math.round((stats.defense || 0) * (1 + m.value));
    } else if (m.id === "maxHealthStatScale") {
      stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + m.value));
    } else if (m.statKey === "attackSpeed") {
      stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
    } else if (m.statKey === "cooldownRecovery") {
      stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
    } else {
      const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
      stats[key] = (stats[key] || 0) + m.value;
    }
  }
  item.stats = stats;
}

export function openLegacyVault() {
  renderLegacyVault();
  const overlay = document.getElementById("legacy-vault-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

export function closeLegacyVault(returnToMainMenu = true) {
  if (legacyCraftPreviewTimer) {
    clearInterval(legacyCraftPreviewTimer);
    legacyCraftPreviewTimer = null;
  }
  // Check if we're in gift mode by checking if gift callback exists
  import('./legacy-vault-gift.js').then(m => {
    if (m.isGiftMode && m.isGiftMode()) {
      m.closeLegacyVaultForGift();
      return;
    }
    
    const overlay = document.getElementById("legacy-vault-overlay");
    if (overlay) overlay.classList.add("hidden");
    if (returnToMainMenu) {
      const mainMenu = document.getElementById("main-menu");
      if (mainMenu) mainMenu.classList.remove("hidden");
      refreshMainMenuLP();
    }
  }).catch(() => {
    // Fallback if gift module not available
    const overlay = document.getElementById("legacy-vault-overlay");
    if (overlay) overlay.classList.add("hidden");
    if (returnToMainMenu) {
      const mainMenu = document.getElementById("main-menu");
      if (mainMenu) mainMenu.classList.remove("hidden");
      refreshMainMenuLP();
    }
  });
}

