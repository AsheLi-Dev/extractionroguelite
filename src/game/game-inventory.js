// -------- Game Inventory Methods Mixin --------
// Inventory overlay, crafting, item management
// This module adds methods to Game.prototype when imported

import { escapeHtml } from '../utils.js';
import {
  EQUIPMENT_BASE_STAT,
  EQUIPMENT_SECONDARY_BASE,
  MODIFIER_POOL,
  LOCAL_STAT_SCALE_MOD_IDS,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  getModifierPoolForType,
  rollLocalStatScaleValueForDifficulty,
  getEquipmentSpriteCell,
  rollUniqueModifierDefsByRarity,
  resolveModifierStatMods
} from '../data/loot-data.js';
import { getRingDefById, getRingSpriteCell } from '../data/rings-data.js';
import { MODIFIER_CUBES, UPGRADE_CUBES, LEGENDARY_CUBES, LEGENDARY_MODIFIER_IDS, rollModifierForTier, getModifierRollRangeForTier, getCubeDifficultyForTier } from '../data/cubes-data.js';
import {
  MAX_WEAPON_UPGRADE_LEVEL,
  WEAPON_UPGRADE_STAT_KEYS,
  EQUIPMENT_UPGRADE_STAT_KEYS,
  getEffectiveWeaponStat,
  getEffectiveEquipmentStat,
  getUpgradeCostForLevel,
  getTotalCubeValue,
  spendCubesToPay
} from '../data/weapon-upgrade-config.js';
import { buildLegacyVault, loadLegacyCubeStash, saveLegacyCubeStash, updateLegacyVaultEntry } from '../ui/save-system.js';
import { showItemTooltip, hideItemTooltip, buildItemTooltipContent, getItemRarityColor } from '../ui/tooltips.js';
import { hasTalent } from '../data/talents.js';
import { addLegacyVaultItem } from '../ui/save-system.js';
import { canSpendGold, spendGold } from './economy.js';
import { play as playSfx } from '../audio.js';
import { ANCESTOR_SPIRIT_DEFS } from '../data/ancestor-spirits-data.js';
import {
  ensureRunInventoryState,
  ensureItemVessels,
  addVesselSlotToItem,
  getVesselCapForRarity,
  socketSpiritIntoItemVessel,
  removeSpiritFromItemVessel,
  recomputeAncestorState
} from './ancestor-system.js';

const ANCESTOR_CLAN_SPRITES = {
  swift: "assets/images/Swift Clan.png",
  arcana: "assets/images/Arcana Clan.png",
  savage: "assets/images/Savage Clan.png",
  bulwark: "assets/images/Bulwark Clan.png",
  hoarder: "assets/images/Hoarder Clan.png"
};
const ITEM_ATLAS_SRC = "assets/Environments/items.png";
const ITEM_ATLAS_TILE = 32;
const ITEM_ATLAS_WIDTH = 352;
const ITEM_ATLAS_HEIGHT = 832;
const SLOT_FRAME_NORMAL = "assets/UI/ui_slot_frame_normal.png";
const SLOT_FRAME_SELECTED = "assets/UI/ui_slot_frame_selected.png";
const INVENTORY_SLOTS_PER_ROW = 4;
const EQUIPPED_SLOT_DEFS = [
  { key: "Helmet", label: "Helmet" },
  { key: "Body Armour", label: "Body Armour" },
  { key: "Weapon", label: "Weapon" },
  { key: "Boots", label: "Boots" },
  { key: "Ring1", label: "Ring Slot A" },
  { key: "Ring2", label: "Ring Slot B" }
];
const EQUIPPED_SLOT_LABEL_BY_KEY = Object.fromEntries(EQUIPPED_SLOT_DEFS.map((s) => [s.key, s.label]));
const EXTRACTION_EQUIPMENT_TYPES = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
const EXTRACTION_EQUIPMENT_LIMIT = 10;
const EQUIPPED_GRID_SLOTS = [
  null, "Helmet", null,
  "Weapon", "Body Armour", null,
  "Ring1", "Boots", "Ring2"
];

function getAncestorSpriteSrc(clans) {
  if (!Array.isArray(clans)) return null;
  for (const clan of clans) {
    const src = ANCESTOR_CLAN_SPRITES[String(clan || "").toLowerCase()];
    if (src) return src;
  }
  return null;
}

function hasSpriteCell(item) {
  return !!(
    item &&
    item.spriteCell &&
    Number.isFinite(item.spriteCell.row) &&
    Number.isFinite(item.spriteCell.col)
  );
}

function ensureItemSpriteCell(item) {
  if (!item || item.type === "Upgrade Card") return;
  if (hasSpriteCell(item)) return;
  if (item.type === "Ring" && item.ringSpriteKey) {
    item.spriteCell = getRingSpriteCell(item.ringSpriteKey);
    return;
  }
  const mapped = getEquipmentSpriteCell(item.type, item.name, item.weight || null);
  if (mapped) item.spriteCell = mapped;
}

function getCraftModifierPoolForItem(item) {
  if (item?.type === "Ring" && item?.ringId === "ring_forgemaster") {
    return getModifierPoolForType("Weapon");
  }
  return getModifierPoolForType(item?.type);
}

function isItemCraftable(item) {
  if (!item || item.type === "Upgrade Card" || item.livingItem) return false;
  if (item.type === "Ring") {
    const ringDef = getRingDefById(item.ringId);
    return !!ringDef?.forgeLikeWeapon;
  }
  return item.type === "Helmet" || item.type === "Body Armour" || item.type === "Weapon" || item.type === "Boots";
}

function createItemSpriteElement(item, size = 16) {
  ensureItemSpriteCell(item);
  if (!hasSpriteCell(item)) return null;
  const el = document.createElement("span");
  const scale = size / ITEM_ATLAS_TILE;
  const x = -item.spriteCell.col * ITEM_ATLAS_TILE * scale;
  const y = -item.spriteCell.row * ITEM_ATLAS_TILE * scale;
  el.className = "inventory-item-sprite";
  el.style.display = "inline-block";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.marginRight = "0";
  el.style.verticalAlign = "middle";
  el.style.backgroundImage = `url('${ITEM_ATLAS_SRC}')`;
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundPosition = `${x}px ${y}px`;
  el.style.backgroundSize = `${ITEM_ATLAS_WIDTH * scale}px ${ITEM_ATLAS_HEIGHT * scale}px`;
  el.style.imageRendering = "pixelated";
  el.style.flexShrink = "0";
  el.style.border = "1px solid rgba(255,255,255,0.25)";
  el.style.borderRadius = "3px";
  return el;
}

function applyInventoryGridLayout(listEl) {
  if (!listEl) return;
  listEl.style.display = "grid";
  listEl.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  listEl.style.gap = "8px";
  listEl.style.padding = "0";
  listEl.style.listStyle = "none";
}

function applyEquippedGridLayout(listEl) {
  if (!listEl) return;
  const slotCount = Number(listEl.dataset.slotCount) || 0;
  const columns = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(Math.max(1, slotCount)))));
  listEl.style.display = "grid";
  listEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  listEl.style.gap = "8px";
  listEl.style.padding = "0";
  listEl.style.listStyle = "none";
}

function getEffectiveEquippedSlots(game, source = "inventory_ui") {
  if (typeof game?.getEffectiveEquipmentSlots === "function") {
    const slots = game.getEffectiveEquipmentSlots({ source });
    if (Array.isArray(slots) && slots.length > 0) {
      return slots.map((slot) => ({
        key: String(slot?.key || ""),
        label: String(slot?.label || slot?.key || "Slot"),
        enabled: slot?.enabled !== false,
        capacity: Math.max(0, Number(slot?.capacity) || 0),
        allowedItemTypes: Array.isArray(slot?.allowedItemTypes) ? [...slot.allowedItemTypes] : [],
        transformedBy: slot?.transformedBy || null,
        disabledReason: slot?.disabledReason || null
      })).filter((slot) => !!slot.key);
    }
  }
  return EQUIPPED_SLOT_DEFS.map((slot) => ({
    key: slot.key,
    label: slot.label,
    enabled: true,
    capacity: 1,
    allowedItemTypes: slot.key.startsWith("Ring") ? ["Ring"] : [slot.key],
    transformedBy: null,
    disabledReason: null
  }));
}

function getAllowedTypesText(slotDef) {
  const allowed = Array.isArray(slotDef?.allowedItemTypes) ? slotDef.allowedItemTypes.filter(Boolean) : [];
  return allowed.length > 0 ? allowed.join(", ") : "Any";
}

function styleGridHeaderItem(li) {
  li.style.gridColumn = "1 / -1";
}

function styleSquareInventoryItem(li, item) {
  const rarity = String(item?.rarity || "common").toLowerCase();
  const frameImg = rarity === "legendary" ? SLOT_FRAME_SELECTED : SLOT_FRAME_NORMAL;
  li.style.display = "flex";
  li.style.alignItems = "center";
  li.style.justifyContent = "center";
  li.style.width = "64px";
  li.style.height = "64px";
  li.style.padding = "0";
  li.style.margin = "0";
  li.style.border = "2px solid rgba(255,255,255,0.2)";
  li.style.borderRadius = "6px";
  li.style.backgroundImage = `url('${frameImg}')`;
  li.style.backgroundSize = "100% 100%";
  li.style.backgroundRepeat = "no-repeat";
  li.style.backgroundPosition = "center";
  if (rarity === "magic") {
    li.style.borderColor = "#2563eb";
    li.style.boxShadow = "0 0 0 1px rgba(37,99,235,0.6), inset 0 0 8px rgba(37,99,235,0.18)";
  } else if (rarity === "rare") {
    li.style.borderColor = "#facc15";
    li.style.boxShadow = "0 0 0 1px rgba(250,204,21,0.65), inset 0 0 8px rgba(250,204,21,0.18)";
  } else if (rarity === "legendary") {
    li.style.borderColor = "#f59e0b";
    li.style.boxShadow = "0 0 0 1px rgba(245,158,11,0.75), 0 0 10px rgba(245,158,11,0.25), inset 0 0 10px rgba(245,158,11,0.2)";
  } else {
    li.style.borderColor = "rgba(255,255,255,0.2)";
    li.style.boxShadow = "inset 0 0 6px rgba(0,0,0,0.35)";
  }
}

function attachSlotFrameHover(li, item) {
  const rarity = String(item?.rarity || "common").toLowerCase();
  const baseFrame = rarity === "legendary" ? SLOT_FRAME_SELECTED : SLOT_FRAME_NORMAL;
  li.addEventListener("mouseenter", () => {
    li.style.backgroundImage = `url('${SLOT_FRAME_SELECTED}')`;
  });
  li.addEventListener("mouseleave", () => {
    li.style.backgroundImage = `url('${baseFrame}')`;
  });
}

function createEmptySlotElement() {
  const li = document.createElement("li");
  li.className = "inventory-item inventory-empty-slot";
  li.style.display = "flex";
  li.style.alignItems = "center";
  li.style.justifyContent = "center";
  li.style.width = "64px";
  li.style.height = "64px";
  li.style.padding = "0";
  li.style.margin = "0";
  li.style.border = "2px solid rgba(255,255,255,0.15)";
  li.style.borderRadius = "6px";
  li.style.backgroundImage = `url('${SLOT_FRAME_NORMAL}')`;
  li.style.backgroundSize = "100% 100%";
  li.style.backgroundRepeat = "no-repeat";
  li.style.backgroundPosition = "center";
  li.style.opacity = "0.5";
  li.style.cursor = "default";
  li.title = "Empty slot";
  return li;
}

function appendEmptySlotRow(listEl) {
  for (let i = 0; i < INVENTORY_SLOTS_PER_ROW; i++) {
    listEl.appendChild(createEmptySlotElement());
  }
}

function styleEmptyEquippedSlot(li) {
  li.className = "inventory-item inventory-empty-slot";
  li.style.display = "flex";
  li.style.alignItems = "center";
  li.style.justifyContent = "center";
  li.style.width = "64px";
  li.style.height = "64px";
  li.style.padding = "0";
  li.style.margin = "0";
  li.style.border = "2px solid rgba(255,255,255,0.15)";
  li.style.borderRadius = "6px";
  li.style.backgroundImage = `url('${SLOT_FRAME_NORMAL}')`;
  li.style.backgroundSize = "100% 100%";
  li.style.backgroundRepeat = "no-repeat";
  li.style.backgroundPosition = "center";
  li.style.opacity = "0.5";
  li.style.cursor = "default";
}

export function applyGameInventoryMixin(Game) {
  Object.assign(Game.prototype, {
    getVaultMasterSecureSet() {
      if (!this.vaultMasterSecuredItemIds || typeof this.vaultMasterSecuredItemIds.has !== "function") {
        this.vaultMasterSecuredItemIds = new Set();
      }
      return this.vaultMasterSecuredItemIds;
    },

    isVaultMasterSecured(item) {
      if (!item) return false;
      return this.getVaultMasterSecureSet().has(String(item.id));
    },

    toggleVaultMasterSecureItem(item) {
      if (!this.hasRunTalent("vaultMaster")) return false;
      if (!item || !this.isItemEquippable(item)) return false;
      const set = this.getVaultMasterSecureSet();
      const key = String(item.id);
      if (set.has(key)) {
        set.delete(key);
        return true;
      }
      if (set.size >= 3) {
        this.showNotification("Vault Master", "You can secure up to 3 items.");
        return false;
      }
      if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("vaultMaster", "Item secured (kept on death)");
      set.add(key);
      return true;
    },

    clearVaultMasterSecureForItem(item) {
      if (!item) return;
      this.getVaultMasterSecureSet().delete(String(item.id));
    },

    transferVaultMasterSecuredItemsOnDeath() {
      if (!this.hasRunTalent("vaultMaster")) return;
      if (this.vaultMasterSecureTransferred) return;
      const secured = this.getVaultMasterSecureSet();
      if (!secured || secured.size === 0) return;
      const kept = [];
      this.inventory = (this.inventory || []).filter((item) => {
        if (!item || !this.isItemEquippable(item)) return true;
        if (!secured.has(String(item.id))) return true;
        addLegacyVaultItem({ ...item }, "Vault Master");
        kept.push(item.name || item.type || "Item");
        return false;
      });
      secured.clear();
      this.vaultMasterSecureTransferred = true;
    },

    getInventoryRaritySortRank(item) {
      const rarity = item?.rarity || "common";
      if (rarity === "legendary") return 0;
      if (rarity === "rare") return 1;
      if (rarity === "magic") return 2;
      if (rarity === "common") return 3; // "normal"
      return 4;
    },

    getInventorySectionedItems() {
      const sectionOrder = ["Weapon", "Ring", "Helmet", "Body Armour", "Boots", "Precious"];
      const sections = sectionOrder.map((title) => ({ title, items: [] }));
      const other = { title: "Other", items: [] };
      const byType = new Map(sections.map((s) => [s.title, s]));

      for (const item of this.inventory) {
        const key = item?.category || item?.type;
        const bucket = byType.get(key) || other;
        bucket.items.push(item);
      }

      for (const section of sections) {
        section.items.sort((a, b) => {
          const rarityCmp = this.getInventoryRaritySortRank(a) - this.getInventoryRaritySortRank(b);
          if (rarityCmp !== 0) return rarityCmp;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
      }
      other.items.sort((a, b) => {
        const rarityCmp = this.getInventoryRaritySortRank(a) - this.getInventoryRaritySortRank(b);
        if (rarityCmp !== 0) return rarityCmp;
        const typeCmp = String(a.type || "").localeCompare(String(b.type || ""));
        if (typeCmp !== 0) return typeCmp;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      if (other.items.length > 0) sections.push(other);
      return sections;
    },

    getSortedInventoryItems() {
      return [...this.inventory].sort((a, b) => {
        const rarityCmp = this.getInventoryRaritySortRank(a) - this.getInventoryRaritySortRank(b);
        if (rarityCmp !== 0) return rarityCmp;
        const typeCmp = String(a.type || "").localeCompare(String(b.type || ""));
        if (typeCmp !== 0) return typeCmp;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    },

    getAncestorSpiritDef(spiritItem) {
      if (!spiritItem?.defId) return null;
      return ANCESTOR_SPIRIT_DEFS[spiritItem.defId] || null;
    },

    getAncestorSpiritRarityColor(rarity) {
      if (rarity === "legendary") return "#f97316";
      if (rarity === "rare") return "#facc15";
      if (rarity === "magic") return "#60a5fa";
      return "#e2e8f0";
    },

    getSelectedAncestorSpirit() {
      ensureRunInventoryState(this);
      const selectedId = this.selectedAncestorSpiritId;
      if (!selectedId) return null;
      return this.runInventory.ancestorSpirits.find((s) => s?.id === selectedId) || null;
    },

    showInventoryOverlay() {
      if (this.gameOver || this.levelUpChoices || this.currentEvent) return;
      ensureRunInventoryState(this);
      playSfx("inventoryOpen");
      this.inventoryOverlayOpen = true;
      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
      const overlay = document.getElementById("inventory-overlay");
      if (overlay) overlay.classList.remove("hidden");
      this.populateInventoryOverlay();
      this.setInventoryRightPageView(this.inventoryRightPageView || "crafting");
      
      // Track inventory open for tutorial (only once per step)
      if (this.tutorialSystem && !this.tutorialSystem.inventoryOpenedThisStep) {
        this.tutorialSystem.onInventoryOpened();
        this.tutorialSystem.inventoryOpenedThisStep = true;
      }
    },

    closeInventoryOverlay() {
      if (this.inventorySellState?.active && this.currentEvent?.id === "npcEquipmentCollector") {
        this.inventorySellState = null;
        if (typeof this.closeEventOverlay === "function") this.closeEventOverlay();
      }
      if (this.rogueVaultState?.active && this.currentEvent?.id === "npcRogueVault") {
        this.rogueVaultState = null;
        if (typeof this.closeEventOverlay === "function") this.closeEventOverlay();
      }
      this.inventoryOverlayOpen = false;
      this.extractionSelectionMode = false;
      if (this.extractionSelectedIds) this.extractionSelectedIds.clear();
      this.paused = false;
      playSfx("inventoryClose");
      if (this._craftingPreviewFadeTimer) {
        clearInterval(this._craftingPreviewFadeTimer);
        this._craftingPreviewFadeTimer = null;
      }
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Pause";
        this.pauseToggleEl.classList.remove("paused");
      }
      const overlay = document.getElementById("inventory-overlay");
      if (overlay) overlay.classList.add("hidden");
      hideItemTooltip();
    },

    isEquipmentTypeForExtraction(item) {
      return item && EXTRACTION_EQUIPMENT_TYPES.includes(item.type);
    },

    populateInventoryOverlay() {
      const equippedList = document.getElementById("inventory-overlay-equipped-list");
      const invList = document.getElementById("inventory-overlay-inventory-list");
      if (!equippedList || !invList) return;
      ensureRunInventoryState(this);

      const extractionBannerEl = document.getElementById("inventory-overlay-extraction-banner");
      const overlayTitleEl = document.querySelector("#inventory-overlay .inventory-overlay-title");
      const overlayCloseBtn = document.getElementById("inventory-overlay-close");
      if (this.extractionSelectionMode) {
        if (!extractionBannerEl) {
          const banner = document.createElement("div");
          banner.id = "inventory-overlay-extraction-banner";
          banner.className = "inventory-overlay-extraction-banner";
          banner.style.cssText = "padding:10px 14px;background:linear-gradient(135deg,#4c1d95 0%,#5b21b6 100%);color:#e9d5ff;margin:0 0 12px 0;border-radius:8px;font-size:13px;";
          const header = document.querySelector("#inventory-overlay .inventory-overlay-header");
          if (header && header.nextElementSibling) header.parentNode.insertBefore(banner, header.nextElementSibling);
          else document.querySelector("#inventory-overlay .inventory-overlay-box")?.appendChild(banner);
        }
        const banner = document.getElementById("inventory-overlay-extraction-banner");
        if (banner) {
          let equipmentCount = 0;
          for (const item of this.inventory || []) {
            if (this.isEquipmentTypeForExtraction(item)) equipmentCount++;
          }
          const selected = (this.extractionSelectedIds && this.extractionSelectedIds.size) || 0;
          const limit = Math.min(EXTRACTION_EQUIPMENT_LIMIT, equipmentCount);
          banner.innerHTML = "";
          banner.appendChild(document.createTextNode("Choose up to 10 equipment items to extract. Other items have no limit. "));
          const countSpan = document.createElement("span");
          countSpan.style.fontWeight = "700";
          countSpan.textContent = `Selected: ${selected}/${limit}`;
          countSpan.id = "inventory-extraction-count";
          banner.appendChild(countSpan);
          const confirmBtn = document.createElement("button");
          confirmBtn.type = "button";
          confirmBtn.textContent = "Confirm extraction";
          confirmBtn.style.cssText = "margin-left:14px;padding:6px 14px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;";
          confirmBtn.addEventListener("click", () => {
            if (typeof this.applyExtractionSelectionAndVictory === "function") this.applyExtractionSelectionAndVictory();
          });
          banner.appendChild(confirmBtn);
          banner.style.display = "block";
        }
        if (overlayTitleEl) overlayTitleEl.textContent = "Extraction — Choose items";
        if (overlayCloseBtn) overlayCloseBtn.textContent = "Close (I)";
        this._extractionIdGen = this._extractionIdGen || 0;
        for (const item of this.inventory || []) {
          if (item.id == null) item.id = "ext_" + (++this._extractionIdGen);
        }
      } else {
        if (extractionBannerEl) extractionBannerEl.style.display = "none";
        if (overlayTitleEl) overlayTitleEl.textContent = "Inventory";
        if (overlayCloseBtn) overlayCloseBtn.textContent = "Close (I)";
      }

      equippedList.innerHTML = "";
      const slotDefs = getEffectiveEquippedSlots(this, "inventory_overlay");
      equippedList.dataset.slotCount = String(slotDefs.length || 0);
      applyEquippedGridLayout(equippedList);
      for (const slotDef of slotDefs) {
        const li = document.createElement("li");
        const slot = slotDef.key;
        const slotLabelText = slotDef.label || EQUIPPED_SLOT_LABEL_BY_KEY[slot] || slot;
        const allowedText = getAllowedTypesText(slotDef);
        const slotHint = `${slotLabelText} | Allowed: ${allowedText}`;
        const item = this.equipment[slot];
        if (item) {
          ensureItemVessels(item);
          const iconEl = createItemSpriteElement(item, 56);
          if (iconEl) li.appendChild(iconEl);
          styleSquareInventoryItem(li, item);
          attachSlotFrameHover(li, item);
          li.title = `${slotLabelText}: ${item.name} (${allowedText})`;
        } else {
          styleEmptyEquippedSlot(li);
          li.title = `${slotLabelText}: Empty (${allowedText})`;
        }
        if (slotDef.enabled === false || slotDef.capacity <= 0) {
          li.style.opacity = "0.4";
          li.style.filter = "grayscale(0.8)";
          li.title = `${slotHint} [Disabled${slotDef.disabledReason ? `: ${slotDef.disabledReason}` : ""}]`;
        } else if (slotDef.transformedBy) {
          li.title = `${li.title} [Transformed]`;
        }
        if (item) {
          li.dataset.hasItem = "1";
          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
          if (!this.inventorySellState?.active) {
            li.addEventListener("click", () => {
              if (item) {
                this.inventory.push(item);
                this.equipment[slot] = null;
                this.updateInventoryUI();
                this.updateEquippedUI();
                this.populateInventoryOverlay();
                this.recalculateStats();
              }
            });
          }

          if ((item.vesselsMax || 0) > 0) {
            const vesselsWrap = document.createElement("div");
            vesselsWrap.className = "inventory-vessels-wrap";
            vesselsWrap.style.marginTop = "6px";
            vesselsWrap.style.display = "flex";
            vesselsWrap.style.flexWrap = "wrap";
            vesselsWrap.style.gap = "6px";

            const label = document.createElement("span");
            label.textContent = `Vessels ${item.vessels.filter(Boolean).length}/${item.vesselsMax}:`;
            label.style.fontSize = "12px";
            label.style.opacity = "0.9";
            vesselsWrap.appendChild(label);

            for (let i = 0; i < item.vessels.length; i++) {
              const vesselEntry = item.vessels[i];
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "event-choice-btn";
              btn.style.padding = "2px 6px";
              btn.style.fontSize = "11px";
              btn.style.minWidth = "48px";
              if (vesselEntry?.spiritId) {
                const spirit = this.runInventory.ancestorSpiritRegistry[vesselEntry.spiritId];
                const def = this.getAncestorSpiritDef(spirit);
                btn.textContent = def?.name || spirit?.defId || "Spirit";
                btn.title = "Click to remove spirit";
              } else {
                btn.textContent = "Empty";
                btn.title = "Click to socket selected spirit";
              }
              btn.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (vesselEntry?.spiritId) {
                  const result = removeSpiritFromItemVessel(this, item, i);
                  if (!result.ok && typeof this.showNotification === "function") {
                    this.showNotification("Vessels", result.reason);
                  }
                  this.selectedAncestorSpiritId = this.getSelectedAncestorSpirit()?.id || null;
                } else {
                  const selected = this.getSelectedAncestorSpirit();
                  if (!selected) {
                    if (typeof this.showNotification === "function") {
                      this.showNotification("Vessels", "Select an ancestor spirit first.");
                    }
                    return;
                  }
                  const result = socketSpiritIntoItemVessel(this, item, i, selected.id);
                  if (!result.ok && typeof this.showNotification === "function") {
                    this.showNotification("Vessels", result.reason);
                  }
                  if (!this.getSelectedAncestorSpirit()) this.selectedAncestorSpiritId = null;
                }
                this.recalculateStats();
                this.updateInventoryUI();
                this.updateEquippedUI();
                this.populateInventoryOverlay();
              });
              vesselsWrap.appendChild(btn);
            }
            li.appendChild(vesselsWrap);
          }
        } else {
          li.classList.add("inventory-overlay-empty");
        }
        if (slotDef.transformedBy) {
          const badge = document.createElement("div");
          badge.textContent = "Transformed";
          badge.style.position = "absolute";
          badge.style.bottom = "2px";
          badge.style.right = "2px";
          badge.style.fontSize = "9px";
          badge.style.padding = "1px 4px";
          badge.style.borderRadius = "3px";
          badge.style.background = "rgba(15, 23, 42, 0.75)";
          badge.style.color = "#cbd5e1";
          li.style.position = "relative";
          li.appendChild(badge);
        }
        equippedList.appendChild(li);
      }

      invList.innerHTML = "";
      applyInventoryGridLayout(invList);
      const sections = this.getInventorySectionedItems();
      for (const section of sections) {
        const header = document.createElement("li");
        header.className = "inventory-section-title";
        header.textContent = section.title;
        styleGridHeaderItem(header);
        invList.appendChild(header);

        if (section.items.length === 0) {
          appendEmptySlotRow(invList);
          continue;
        }

        for (const item of section.items) {
          const li = document.createElement("li");
          const sellPrice = this.getSellPriceForItem(item);
          if (item.type !== "Upgrade Card") {
            const color = getItemRarityColor(item);
            const baseKey = EQUIPMENT_BASE_STAT[item.type];
            const baseVal = item.stats?.[baseKey] ?? 0;
            if (item.rarity === "legendary") li.classList.add("item-legendary");
            const forgedTag = item.blacksmithUpgraded ? ` <span style="color:#f59e0b;font-weight:700">(Forged)</span>` : "";
            const sellLabel = sellPrice != null ? ` <span class="inventory-item-sell-price" style="color:#facc15">[Sell ${sellPrice}g]</span>` : "";
            const selectedSellLabel = this.inventorySellState?.selectedItemKey === this.getInventorySellKey(item) ? ` <span style="color:#86efac">[Selected]</span>` : "";
            const sendLabel = this.rogueVaultState?.active ? ` <span style="color:#86efac">[Send 150g]</span>` : "";
            const secureLabel = this.hasRunTalent("vaultMaster")
              ? (this.isVaultMasterSecured(item)
                  ? ` <span style="color:#93c5fd">[Secured]</span>`
                  : ` <span style="color:#94a3b8">[Right-click: Secure]</span>`)
              : "";
            const iconEl = createItemSpriteElement(item, 56);
            if (iconEl) li.appendChild(iconEl);
            li.title = item.type === "Ring"
              ? `${item.name} (${item.type})`
              : `${item.name} (${item.type}) +${baseVal}`;
            if (this.inventorySellState?.active && sellPrice != null) li.title += ` [Sell ${sellPrice}g]`;
            if (this.inventorySellState?.selectedItemKey === this.getInventorySellKey(item)) li.title += " [Selected]";
            if (this.rogueVaultState?.active) li.title += " [Send 150g]";
            if (this.hasRunTalent("vaultMaster") && this.isVaultMasterSecured(item)) li.title += " [Secured]";
            void color; void forgedTag; void sellLabel; void selectedSellLabel; void sendLabel; void secureLabel;
          } else {
            li.textContent = this.rogueVaultState?.active ? `${item.name} [Send 150g]` : item.name;
            styleGridHeaderItem(li);
          }
          if (item.type !== "Upgrade Card") {
            styleSquareInventoryItem(li, item);
            attachSlotFrameHover(li, item);
          }
          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
          if (this.extractionSelectionMode && this.isEquipmentTypeForExtraction(item)) {
            const selected = this.extractionSelectedIds && this.extractionSelectedIds.has(item.id);
            if (selected) {
              li.style.outline = "3px solid #86efac";
              li.style.outlineOffset = "2px";
              li.title = (li.title || "") + " [Selected for extraction — click to deselect]";
            } else {
              li.title = (li.title || "") + " [Click to select for extraction]";
            }
            li.addEventListener("click", () => {
              if (!this.extractionSelectedIds) this.extractionSelectedIds = new Set();
              if (this.extractionSelectedIds.has(item.id)) {
                this.extractionSelectedIds.delete(item.id);
              } else if (this.extractionSelectedIds.size < EXTRACTION_EQUIPMENT_LIMIT) {
                this.extractionSelectedIds.add(item.id);
              }
              this.populateInventoryOverlay();
            });
          } else {
            if (this.hasRunTalent("vaultMaster") && !this.inventorySellState?.active && !this.rogueVaultState?.active) {
              li.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                if (this.toggleVaultMasterSecureItem(item) && this.inventoryOverlayOpen) this.populateInventoryOverlay();
              });
            }
            li.addEventListener("click", () => this.handleInventoryItemClick(item));
          }
          invList.appendChild(li);
        }
      }

      const spiritsHeader = document.createElement("li");
      spiritsHeader.className = "inventory-section-title";
      spiritsHeader.textContent = "Ancestor Spirits";
      styleGridHeaderItem(spiritsHeader);
      invList.appendChild(spiritsHeader);
      const spirits = [...this.runInventory.ancestorSpirits];
      spirits.sort((a, b) => {
        const rank = (r) => (r === "legendary" ? 0 : r === "rare" ? 1 : r === "magic" ? 2 : 3);
        const rr = rank(a?.rarity) - rank(b?.rarity);
        if (rr !== 0) return rr;
        const da = this.getAncestorSpiritDef(a);
        const db = this.getAncestorSpiritDef(b);
        return String(da?.name || a?.defId || "").localeCompare(String(db?.name || b?.defId || ""));
      });
      if (spirits.length === 0) {
        appendEmptySlotRow(invList);
      } else {
        for (const spirit of spirits) {
          const def = this.getAncestorSpiritDef(spirit);
          const li = document.createElement("li");
          const isSelected = this.selectedAncestorSpiritId === spirit.id;
          if (isSelected) li.classList.add("selected");
          const color = this.getAncestorSpiritRarityColor(spirit.rarity);
          const clans = Array.isArray(spirit.clans) && spirit.clans.length > 0 ? ` [${spirit.clans.join(", ")}]` : "";
          const spriteSrc = getAncestorSpriteSrc(spirit.clans || def?.clans || []);
          if (spriteSrc) {
            const img = document.createElement("img");
            img.src = spriteSrc;
            img.alt = `${def?.name || spirit.defId} icon`;
            img.width = 16;
            img.height = 16;
            img.style.verticalAlign = "middle";
            img.style.marginRight = "6px";
            li.appendChild(img);
          }
          const nameSpan = document.createElement("span");
          nameSpan.style.color = color;
          nameSpan.textContent = def?.name || spirit.defId;
          li.appendChild(nameSpan);
          li.appendChild(document.createTextNode(clans));
          if (isSelected) {
            const selectedSpan = document.createElement("span");
            selectedSpan.style.color = "#86efac";
            selectedSpan.textContent = " [Selected]";
            li.appendChild(selectedSpan);
          }
          li.title = "Click to select for socketing";
          styleGridHeaderItem(li);
          li.addEventListener("click", () => {
            this.selectedAncestorSpiritId = isSelected ? null : spirit.id;
            this.populateInventoryOverlay();
          });
          invList.appendChild(li);
        }
      }
      this.populateCraftingTab();
      this.populateInventoryStatsPanel();
    },

    setInventoryRightPageView(view) {
      const next = view === "stats" ? "stats" : "crafting";
      this.inventoryRightPageView = next;
      const crafting = document.getElementById("inventory-overlay-crafting");
      const stats = document.getElementById("inventory-overlay-stats");
      const tabCrafting = document.getElementById("inventory-right-tab-crafting");
      const tabStats = document.getElementById("inventory-right-tab-stats");
      if (crafting) crafting.classList.toggle("hidden", next !== "crafting");
      if (stats) stats.classList.toggle("hidden", next !== "stats");
      if (tabCrafting) tabCrafting.classList.toggle("active", next === "crafting");
      if (tabStats) tabStats.classList.toggle("active", next === "stats");
      if (next === "crafting") this.populateCraftingTab();
      else this.populateInventoryStatsPanel();
    },

    populateInventoryStatsPanel() {
      if (typeof this.updateStatsUI === "function") this.updateStatsUI();
    },

    getLivingItem() {
      for (const slot of Object.keys(this.equipment || {})) {
        const item = this.equipment[slot];
        if (item?.livingItem) return item;
      }
      return this.inventory.find((it) => it.livingItem) || null;
    },

    getCraftableEquipmentItems() {
      const items = [];
      for (const slot of Object.keys(this.equipment || {})) {
        const item = this.equipment[slot];
        if (isItemCraftable(item)) {
          ensureItemVessels(item);
          items.push({ item, source: "equipped", slot });
        }
      }
      for (let i = 0; i < this.inventory.length; i++) {
        const item = this.inventory[i];
        if (isItemCraftable(item)) {
          ensureItemVessels(item);
          items.push({ item, source: "inventory", index: i });
        }
      }
      return items;
    },

    /** Equipment from current run + legacy vault for Ironsmith (Weapon, Helmet, Body Armour, Boots). */
    getIronsmithEquipmentEntries() {
      const equipmentTypes = ["Weapon", "Helmet", "Body Armour", "Boots"];
      const run = (this.getCraftableEquipmentItems?.() || []).filter((e) => equipmentTypes.includes(e.item?.type));
      const vault = buildLegacyVault();
      const legacy = [];
      for (let i = 0; i < vault.length; i++) {
        const entry = vault[i];
        const item = entry?.item;
        if (!item || !equipmentTypes.includes(item.type)) continue;
        ensureItemVessels(item);
        legacy.push({ item, source: "legacy", legacyEntry: entry, legacyEntryIndex: i });
      }
      return [...run, ...legacy];
    },

    /** Merged cube inventory (run + legacy stash) for upgrade cost display and spending. */
    getMergedCubeInventoryForUpgrade() {
      const run = this.cubeInventory || {};
      const stash = loadLegacyCubeStash();
      const merged = { ...run };
      for (const [key, count] of Object.entries(stash)) {
        merged[key] = (merged[key] || 0) + (count || 0);
      }
      return merged;
    },

    populateCraftingTab() {
      const grid = document.getElementById("cube-inventory-grid");
      const itemList = document.getElementById("crafting-item-list");
      if (!grid || !itemList) return;
      for (let t = 1; t <= 3; t++) {
        const oldKey = `socketCubeT${t}`;
        const legacyCount = this.cubeInventory[oldKey] || 0;
        if (legacyCount > 0) {
          const newKey = `vesselCubeT${t}`;
          this.cubeInventory[newKey] = (this.cubeInventory[newKey] || 0) + legacyCount;
          delete this.cubeInventory[oldKey];
        }
      }

      grid.innerHTML = "";
      const allCubes = [];
      for (const cube of MODIFIER_CUBES) {
        for (let t = 1; t <= 3; t++) {
          allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
        }
      }
      for (const cube of UPGRADE_CUBES) {
        for (let t = 1; t <= 3; t++) {
          allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
        }
      }
      for (const cube of LEGENDARY_CUBES) {
        allCubes.push({ ...cube, tier: null, key: cube.id });
      }
      const ownedCubes = allCubes.filter((c) => (this.cubeInventory[c.key] || 0) > 0);
      for (const c of ownedCubes) {
        const count = this.cubeInventory[c.key] || 0;
        const div = document.createElement("div");
        div.className = `cube-slot ${c.tier ? `tier-${c.tier}` : "tier-legendary"} ${this.craftingSelectedCube === c.key ? "selected" : ""}`;
        div.dataset.cubeKey = c.key;
        const icon = c.tier ? (c.id.includes("magic") ? "" : c.id.includes("rare") ? "" : c.id.includes("reforge") ? "" : "") : "";
        const tierLabel = c.tier ? ` T${c.tier}` : "";
        div.innerHTML = `
          <span class="cube-icon">${icon}${tierLabel}</span>
          <span class="cube-slot-name">${escapeHtml(c.label)}</span>
          <span class="cube-slot-count">${count}</span>
        `;
        div.addEventListener("click", () => this.selectCraftingCube(c.key));
        grid.appendChild(div);
      }

      itemList.innerHTML = "";
      const craftables = this.getCraftableEquipmentItems();
      if (this.craftingSelectedItem && !craftables.some((entry) => entry.item === this.craftingSelectedItem)) {
        this.craftingSelectedItem = null;
        this.craftingItemSource = null;
      }
      for (const { item, source, slot, index } of craftables) {
        const li = document.createElement("li");
        const color = getItemRarityColor(item);
        const baseKey = EQUIPMENT_BASE_STAT[item.type];
        const baseVal = item.stats?.[baseKey] ?? 0;
        const loc = source === "equipped" ? `${slot}` : "Inventory";
        if (item.rarity === "legendary") li.classList.add("item-legendary");
        const statText = item.type === "Ring" ? "Unique Effect" : `+${baseVal}`;
        const weaponUpgradeSuffix = (item.weaponUpgradeLevel ?? 0) > 0 ? ` (+${item.weaponUpgradeLevel})` : "";
        li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}${escapeHtml(weaponUpgradeSuffix)}</span> (${statText}) [${loc}]`;
        li.classList.toggle("selected", this.craftingSelectedItem === item && this.craftingItemSource?.source === source && (source === "inventory" ? this.craftingItemSource.index === index : this.craftingItemSource.slot === slot));
        li.addEventListener("click", () => this.selectCraftingItem(item, source, slot, index));
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        itemList.appendChild(li);
      }

      this.updateCraftingPreview();
    },

    selectCraftingItem(item, source, slot, index) {
      this.craftingSelectedItem = item;
      this.craftingItemSource = { source, slot, index };
      this.populateCraftingTab();
    },

    selectCraftingCube(cubeKey) {
      const normalizedKey = String(cubeKey || "").replace(/^socketCube/, "vesselCube");
      if ((this.cubeInventory[normalizedKey] || 0) === 0) return;
      this.craftingSelectedCube = normalizedKey;
      this.populateCraftingTab();
    },

    updateCraftingPreview() {
      const itemEl = document.getElementById("crafting-selected-item");
      const cubeEl = document.getElementById("crafting-selected-cube");
      const statsEl = document.getElementById("crafting-item-stats");
      const previewEl = document.getElementById("crafting-preview");
      const confirmBtn = document.getElementById("crafting-confirm");
      if (!itemEl || !cubeEl || !previewEl || !confirmBtn) return;

      if (this.craftingSelectedItem) {
        itemEl.textContent = this.craftingSelectedItem.name;
        itemEl.classList.add("has-item");
        if (statsEl) {
          if (this.craftingSelectedItem.type === "Upgrade Card") {
            statsEl.innerHTML = "";
            statsEl.classList.add("hidden");
          } else {
            statsEl.innerHTML = buildItemTooltipContent(this.craftingSelectedItem, null);
            statsEl.classList.remove("hidden");
          }
        }
      } else {
        itemEl.textContent = "No item selected";
        itemEl.classList.remove("has-item");
        if (statsEl) {
          statsEl.innerHTML = "";
          statsEl.classList.add("hidden");
        }
      }

      if (this.craftingSelectedCube) {
        const normalizedCubeKey = this.craftingSelectedCube.replace(/^socketCube/, "vesselCube");
        const tierMatch = normalizedCubeKey.match(/T(\d)$/);
        const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
        const legCube = LEGENDARY_CUBES.find((c) => c.id === normalizedCubeKey);
        const modCube = !legCube && MODIFIER_CUBES.find((c) => `${c.id}T${tier}` === normalizedCubeKey || normalizedCubeKey.startsWith(c.id));
        const upgCube = !legCube && UPGRADE_CUBES.find((c) => normalizedCubeKey === `${c.id}T${tier}`);
        const cubeLabel = legCube ? legCube.label : (modCube ? `${modCube.label} T${tier}` : (upgCube ? `${upgCube.label} T${tier}` : normalizedCubeKey));
        cubeEl.textContent = cubeLabel;
        cubeEl.classList.add("has-cube");
      } else {
        cubeEl.textContent = "No cube selected";
        cubeEl.classList.remove("has-cube");
      }

      let preview = "";
      let canCraft = false;
      if (this.craftingSelectedItem && this.craftingSelectedCube) {
        const item = this.craftingSelectedItem;
        const normalizedCubeKey = this.craftingSelectedCube.replace(/^socketCube/, "vesselCube");
        const legCube = LEGENDARY_CUBES.find((c) => c.id === normalizedCubeKey);
        const [, tierStr] = normalizedCubeKey.match(/(.+)T(\d)$/)?.slice(1) || [null, "1"];
        const tier = parseInt(tierStr || "1", 10);
        const modCube = !legCube && MODIFIER_CUBES.find((c) => normalizedCubeKey.startsWith(c.id));
        const upgCube = !legCube && UPGRADE_CUBES.find((c) => normalizedCubeKey.startsWith(c.id));
        const isVesselCube = !!upgCube && upgCube.id === "vesselCube";

        if (item.rarity === "legendary" && !isVesselCube) {
          preview = "Legendary items cannot be further crafted with this cube.";
        } else {

          if (legCube) {
            if (item.type === "Upgrade Card") {
              preview = "Legendary cubes can only be used on equipment.";
            } else if (item.rarity !== "rare") {
              preview = "Legendary cubes can only be used on Rare (Yellow) items.";
            } else {
              preview = `Upgrades to Legendary and replaces one modifier with ${legCube.modifierLabel}.`;
              canCraft = true;
            }
          } else if (modCube) {
            const item = this.craftingSelectedItem;
            if (item.type === "Upgrade Card") {
              preview = "Modifier cubes can only be used on equipment.";
            } else if (item.rarity === "common" || !item.rarity) {
              preview = "Modifier cubes can only be used on Magic or Rare items. Use a Magic Cube first.";
            } else {
              const existing = item.modifiers?.find((m) => m.id === modCube.modifierId);
              const maxMods = item.rarity === "common" ? 0 : item.rarity === "magic" ? 1 : 2;
              const currentCount = item.modifiers?.length || 0;
              const r = getModifierRollRangeForTier(tier, modCube.modifierId);
              const range = (r.min * 100).toFixed(0) + "-" + (r.max * 100).toFixed(0) + "%";
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
            const item = this.craftingSelectedItem;
            if (item.type === "Upgrade Card") {
              preview = "Upgrade cubes can only be used on equipment.";
            } else if (upgCube.id === "magicCube" && item.rarity !== "common") {
              preview = "Magic Cube can only be used on White (common) items.";
            } else if (upgCube.id === "rareCube" && item.rarity !== "magic") {
              preview = "Rare Cube can only be used on Blue (magic) items.";
            } else if (upgCube.id === "reforgeCube" && (item.rarity === "common" || !item.rarity)) {
              preview = "Reforge Cube can only be used on Blue or Yellow items.";
            } else if (upgCube.id === "vesselCube") {
              ensureItemVessels(item);
              const vesselCap = getVesselCapForRarity(item.rarity);
              const currentVessels = item.vesselsMax || 0;
              if (item.rarity === "common" || vesselCap <= 0) {
                preview = "Common items cannot be upgraded with Vessel Cube.";
              } else if (currentVessels >= vesselCap) {
                preview = `Item already has maximum vessels (${vesselCap}).`;
              } else {
                const newVessels = currentVessels + 1;
                preview = `Adds +1 vessel slot. Item will have ${newVessels}/${vesselCap} vessels.`;
                canCraft = true;
              }
            } else {
              if (upgCube.id === "magicCube") preview = "Upgrades to Blue and adds 1 random modifier.";
              else if (upgCube.id === "rareCube") preview = "Upgrades to Yellow and adds 1 more modifier.";
              else preview = "Rerolls all modifiers with new random values.";
              canCraft = true;
            }
          }
        }
      }
      previewEl.textContent = preview;
      previewEl.classList.toggle("hidden", !preview);
      confirmBtn.disabled = !canCraft;

      this.updateWeaponUpgradeUI();
    },

    updateWeaponUpgradeUI() {
      const detailsEl = document.getElementById("weapon-upgrade-details");
      const maxMsgEl = document.getElementById("weapon-upgrade-max-msg");
      const levelLine = document.getElementById("weapon-upgrade-level-line");
      const costLine = document.getElementById("weapon-upgrade-cost-line");
      const cubesLine = document.getElementById("weapon-upgrade-cubes-line");
      const previewLine = document.getElementById("weapon-upgrade-preview-line");
      const upgradeBtn = document.getElementById("weapon-upgrade-btn");
      if (!detailsEl || !maxMsgEl || !upgradeBtn) return;

      const item = this.craftingSelectedItem;
      const equipmentTypes = ["Weapon", "Helmet", "Body Armour", "Boots"];
      if (!item || !equipmentTypes.includes(item.type)) {
        detailsEl.classList.add("hidden");
        maxMsgEl.classList.add("hidden");
        return;
      }

      const level = Math.min(MAX_WEAPON_UPGRADE_LEVEL, Math.max(0, item.weaponUpgradeLevel ?? 0));
      const atMax = level >= MAX_WEAPON_UPGRADE_LEVEL;
      const mergedCubes = this.getMergedCubeInventoryForUpgrade?.() || this.cubeInventory || {};
      const totalCubeValue = getTotalCubeValue(mergedCubes);
      const nextCost = getUpgradeCostForLevel(level);
      const canAfford = !atMax && totalCubeValue >= nextCost;

      if (atMax) {
        detailsEl.classList.add("hidden");
        maxMsgEl.classList.remove("hidden");
        maxMsgEl.textContent = `This ${item.type.toLowerCase()} is at max upgrade (+5).`;
        return;
      }

      maxMsgEl.classList.add("hidden");
      detailsEl.classList.remove("hidden");
      if (levelLine) levelLine.textContent = `Upgrade level: +${level} (max +${MAX_WEAPON_UPGRADE_LEVEL})`;
      if (costLine) costLine.textContent = `Next upgrade cost: ${nextCost} cube value`;
      if (cubesLine) cubesLine.textContent = `Cube value (run + vault): ${totalCubeValue}`;
      const keys = EQUIPMENT_UPGRADE_STAT_KEYS[item.type];
      if (previewLine && item.baseStat && keys && keys.length > 0) {
        const parts = keys.map((k) => {
          const cur = getEffectiveEquipmentStat(item.baseStat[k] || 0, level, k !== "attackSpeed");
          const next = getEffectiveEquipmentStat(item.baseStat[k] || 0, level + 1, k !== "attackSpeed");
          return `${k} ${cur} → ${next}`;
        });
        previewLine.textContent = `Next level: ${parts.join(", ")}`;
      }
      upgradeBtn.disabled = !canAfford;
    },

    populateIronsmithWeaponList() {
      const listEl = document.getElementById("ironsmith-weapon-list");
      if (!listEl) return;
      const entries = this.getIronsmithEquipmentEntries?.() || [];
      const sel = this.craftingSelectedItem;
      const src = this.craftingItemSource;
      if (sel && !entries.some((e) => e.item === sel)) {
        this.craftingSelectedItem = null;
        this.craftingItemSource = null;
      }
      listEl.innerHTML = "";
      for (const entry of entries) {
        const { item, source, slot, index, legacyEntry } = entry;
        const li = document.createElement("li");
        const color = getItemRarityColor(item);
        const baseKey = EQUIPMENT_BASE_STAT[item.type];
        const baseVal = item.stats?.[baseKey] ?? 0;
        const loc = source === "equipped" ? `${slot}` : source === "legacy" ? "Vault" : "Inventory";
        if (item.rarity === "legendary") li.classList.add("item-legendary");
        const statText = baseKey ? `+${baseVal}` : "";
        const upgradeSuffix = (item.weaponUpgradeLevel ?? 0) > 0 ? ` (+${item.weaponUpgradeLevel})` : "";
        li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}${escapeHtml(upgradeSuffix)}</span> (${statText}) [${loc}]`;
        const isSelected = sel === item && (source === "legacy" ? src?.legacyEntry === legacyEntry : (source === "inventory" ? src?.index === index : src?.slot === slot));
        li.classList.toggle("selected", isSelected);
        li.addEventListener("click", () => {
          this.craftingSelectedItem = item;
          this.craftingItemSource = source === "legacy" ? { source, legacyEntry: entry.legacyEntry, legacyEntryIndex: entry.legacyEntryIndex } : { source, slot, index };
          this.populateIronsmithWeaponList();
          this.updateWeaponUpgradeUI();
        });
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        listEl.appendChild(li);
      }
      this.updateWeaponUpgradeUI();
    },

    executeWeaponUpgrade() {
      const item = this.craftingSelectedItem;
      const equipmentTypes = ["Weapon", "Helmet", "Body Armour", "Boots"];
      if (!item || !equipmentTypes.includes(item.type)) return;
      const level = Math.max(0, item.weaponUpgradeLevel ?? 0);
      if (level >= MAX_WEAPON_UPGRADE_LEVEL) return;

      const cost = getUpgradeCostForLevel(level);
      const merged = this.getMergedCubeInventoryForUpgrade?.() || {};
      const result = spendCubesToPay(merged, cost);
      if (!result.success || !result.toDeduct) return;

      const runInv = this.cubeInventory || {};
      const stash = loadLegacyCubeStash();
      for (const [key, count] of Object.entries(result.toDeduct)) {
        let remaining = count;
        const runHas = runInv[key] || 0;
        const fromRun = Math.min(remaining, runHas);
        if (fromRun > 0) {
          remaining -= fromRun;
          const current = runInv[key] - fromRun;
          if (current <= 0) delete this.cubeInventory[key];
          else this.cubeInventory[key] = current;
        }
        if (remaining > 0 && stash[key] != null) {
          const fromStash = Math.min(remaining, stash[key] || 0);
          if (fromStash > 0) {
            stash[key] = (stash[key] || 0) - fromStash;
            if (stash[key] <= 0) delete stash[key];
          }
        }
      }
      saveLegacyCubeStash(stash);

      item.weaponUpgradeLevel = level + 1;
      this.rebuildItemStats(item);

      const src = this.craftingItemSource;
      if (src?.source === "legacy" && src.legacyEntry) {
        updateLegacyVaultEntry(src.legacyEntry, item);
      }

      this.recalculateStats?.();
      this.updateEquippedUI?.();
      this.populateInventoryOverlay?.();
      this.populateCraftingTab?.();
      this.updateWeaponUpgradeUI();
      if (document.getElementById("ironsmith-weapon-list")) this.populateIronsmithWeaponList();
      if (typeof playSfx === "function") playSfx("inventoryOpen");
    },

    executeCraft() {
      if (!this.craftingSelectedItem || !this.craftingSelectedCube) return;
      const cubeKey = this.craftingSelectedCube.replace(/^socketCube/, "vesselCube");
      const count = this.cubeInventory[cubeKey] || 0;
      if (count === 0) return;

      const tier = parseInt(cubeKey.match(/T(\d)$/)?.[1] || "1", 10);
      const legCube = LEGENDARY_CUBES.find((c) => c.id === cubeKey);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => cubeKey.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => cubeKey.startsWith(c.id));
      let crafted = false;
      const item = this.craftingSelectedItem;

      if (legCube) {
        if (item.rarity !== "rare") return;
        this.applyLegendaryCube(item, legCube);
        crafted = true;
      } else if (modCube) {
        if (item.rarity === "legendary") return;
        if (item.rarity === "common" || !item.rarity) return;
        if (item.modifiers?.some((m) => m.id === modCube.modifierId)) return;
        this.applyModifierCube(item, modCube, tier);
        crafted = true;
      } else if (upgCube) {
        if (upgCube.id === "vesselCube") {
          crafted = this.applyVesselCube(item);
        } else {
          if (item.rarity === "legendary") return;
          this.applyUpgradeCube(item, upgCube, tier);
          crafted = true;
        }
      }
      if (!crafted) return;

      const cascadeSave = this.hasRunTalent("cubeCascade") && Math.random() < 0.1;
      if (cascadeSave && typeof this.logTalentTrigger === "function") this.logTalentTrigger("cubeCascade", "Cube used: 10% proc, cube not consumed (duplicate)");
      if (!cascadeSave) {
        this.cubeInventory[cubeKey] = count - 1;
        if (this.cubeInventory[cubeKey] === 0) delete this.cubeInventory[cubeKey];
      }
      this.craftingSelectedCube = null;
      this.recalculateStats();
      this.updateEquippedUI();
      this.populateInventoryOverlay();
      this.populateCraftingTab();
      if (this._craftingPreviewFadeTimer) clearInterval(this._craftingPreviewFadeTimer);
      this._craftingPreviewFadeTimer = setInterval(() => {
        this.updateCraftingPreview();
      }, 500);
      setTimeout(() => {
        if (this._craftingPreviewFadeTimer) {
          clearInterval(this._craftingPreviewFadeTimer);
          this._craftingPreviewFadeTimer = null;
        }
      }, 10000);
    },

    applyModifierCube(item, cubeDef, tier) {
      item.modifiers = item.modifiers || [];
      const value = rollModifierForTier(tier, cubeDef.modifierId);
      const poolEntry = MODIFIER_POOL.find((m) => m.id === cubeDef.modifierId);
      const modEntry = {
        id: cubeDef.modifierId,
        label: cubeDef.modifierLabel,
        statKey: poolEntry?.statKey || cubeDef.modifierId.replace("Percent", ""),
        rarity: poolEntry?.rarity || "normal",
        value,
        appliesTo: poolEntry?.appliesTo,
        addedAt: Date.now()
      };

      const existingIdx = item.modifiers.findIndex((m) => m.id === cubeDef.modifierId);
      const maxMods = item.rarity === "magic" ? 1 : item.rarity === "rare" ? 2 : 0;
      if (existingIdx >= 0) {
        item.modifiers[existingIdx] = { ...modEntry };
      } else if (item.modifiers.length < maxMods) {
        item.modifiers.push(modEntry);
      } else {
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
      this.rebuildItemStats(item);
    },

    applyLegendaryCube(item, cubeDef) {
      if (item.rarity !== "rare") return;
      item.rarity = "legendary";
      const mods = item.modifiers || [];
      if (mods.length > 0) {
        const idx = Math.floor(Math.random() * mods.length);
        mods[idx] = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 };
      } else {
        item.modifiers = [{ id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 }];
      }
      this.rebuildItemStats(item);
    },

    applyVesselCube(item) {
      const result = addVesselSlotToItem(item);
      if (!result.ok) {
        if (typeof this.showNotification === "function") {
          this.showNotification("Vessel Cube", result.reason);
        }
        return false;
      }
      recomputeAncestorState(this);
      return true;
    },

    applySocketCube(item) {
      return this.applyVesselCube(item);
    },

    applyUpgradeCube(item, cubeDef, tier) {
      const rollValueForMod = (m, rollTier = tier) => {
        if (item.type === "Ring" && Number.isFinite(m?.min) && Number.isFinite(m?.max)) {
          return m.min + Math.random() * (m.max - m.min);
        }
        if (LOCAL_STAT_SCALE_MOD_IDS.includes(m.id)) {
          return rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(rollTier));
        }
        return rollModifierForTier(rollTier, m.id);
      };
      if (cubeDef.id === "magicCube") {
        item.rarity = "magic";
        item.modifiers = [];
        const pool = getCraftModifierPoolForItem(item);
        const chosen = rollUniqueModifierDefsByRarity(pool, 1, new Set());
        for (const m of chosen) {
          const val = rollValueForMod(m);
          item.modifiers.push({
            id: m.id,
            label: m.label,
            statKey: m.statKey,
            value: val,
            appliesTo: m.appliesTo,
            addedAt: Date.now()
          });
        }
        const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
        const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
        if (!hasPrefix && !hasSuffix) {
          if (Math.random() < 0.5) {
            item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
          } else {
            item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
          }
        }
      } else if (cubeDef.id === "rareCube") {
        item.rarity = "rare";
        item.modifiers = item.modifiers || [];
        const pool = getCraftModifierPoolForItem(item);
        const transmutationProc = this.hasRunTalent("transmutation") && Math.random() < 0.05;
        if (transmutationProc && typeof this.logTalentTrigger === "function") this.logTalentTrigger("transmutation", "Rare item from cube: 5% T1 modifier as base stat");
        const targetModifierCount = 2;
        const existingIds = new Set((item.modifiers || []).map((m) => m?.id).filter(Boolean));
        const needed = Math.max(0, targetModifierCount - existingIds.size);

        const chosen = rollUniqueModifierDefsByRarity(pool, needed, existingIds);
        for (let i = 0; i < chosen.length; i++) {
          const m = chosen[i];
          const rolledTier = transmutationProc && i === 0 ? 1 : tier;
          const val = rollValueForMod(m, rolledTier);
          item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, rarity: m.rarity || "normal", value: val, appliesTo: m.appliesTo, trigger: m.trigger, conditional: m.conditional, passiveStatKey: m.passiveStatKey, statMods: resolveModifierStatMods(m), data: m.data ? { ...m.data } : undefined, addedAt: Date.now() });
        }
        const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
        const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
        if (!hasPrefix) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
        if (!hasSuffix) item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
      } else if (cubeDef.id === "reforgeCube") {
        item.modifiers = [];
        const pool = getCraftModifierPoolForItem(item);
        const count = item.rarity === "magic" ? 1 : item.rarity === "rare" ? 2 : 0;
        const chosen = rollUniqueModifierDefsByRarity(pool, count, new Set());
        for (const m of chosen) {
          const val = rollValueForMod(m);
          item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, rarity: m.rarity || "normal", value: val, appliesTo: m.appliesTo, trigger: m.trigger, conditional: m.conditional, passiveStatKey: m.passiveStatKey, statMods: resolveModifierStatMods(m), data: m.data ? { ...m.data } : undefined, addedAt: Date.now() });
        }
      }
      ensureItemVessels(item);
      this.rebuildItemStats(item);
    },

    rebuildItemStats(item) {
      const baseKey = EQUIPMENT_BASE_STAT[item.type];
      if (!item.baseStat && item.stats) {
        item.baseStat = {};
        if (baseKey) item.baseStat[baseKey] = item.stats[baseKey] ?? 0;
        const sec = EQUIPMENT_SECONDARY_BASE[item.type];
        if (sec) item.baseStat[sec.statKey] = item.stats[sec.statKey] ?? 0;
        if (item.type === "Boots") {
          if (item.stats.maxHealth) item.baseStat.maxHealth = item.stats.maxHealth;
          if (item.stats.defense) item.baseStat.defense = item.stats.defense;
        }
      }
      const stats = { ...(item.baseStat || {}) };
      const upgradeKeys = EQUIPMENT_UPGRADE_STAT_KEYS[item.type];
      if (upgradeKeys && item.baseStat) {
        const level = Math.min(MAX_WEAPON_UPGRADE_LEVEL, Math.max(0, item.weaponUpgradeLevel ?? 0));
        for (const k of upgradeKeys) {
          if (item.baseStat[k] != null) {
            stats[k] = getEffectiveEquipmentStat(item.baseStat[k], level, k !== "attackSpeed");
          }
        }
      }
      for (const m of item.modifiers || []) {
        if (LEGENDARY_MODIFIER_IDS.includes(m.id)) continue;
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
    },

    handleInventoryItemClick(item) {
      const index = this.inventory.indexOf(item);
      if (index === -1) return;
      if (this.extractionSelectionMode && this.isEquipmentTypeForExtraction(item)) return;
      if (this.inventorySellState?.active) {
        this.selectInventoryItemForSale(index, item);
        return;
      }
      if (this.rogueVaultState?.active) {
        this.sendInventoryItemToLegacyVault(index, item);
        return;
      }

      if (this.isUpgradeCard(item)) {
        this.equipUpgradeCardAtIndex(index);
      } else if (this.isItemEquippable(item)) {
        this.clearVaultMasterSecureForItem(item);
        ensureItemVessels(item);
        let slot = null;
        if (typeof this.findBestEquipSlotForItem === "function") {
          slot = this.findBestEquipSlotForItem(item, { source: "inventory_click" });
        }
        if (!slot) {
          slot = item.type;
          if (item.type === "Ring") {
            const ringSlotKeys = getEffectiveEquippedSlots(this, "inventory_click_fallback")
              .filter((entry) => Array.isArray(entry.allowedItemTypes) && entry.allowedItemTypes.includes("Ring"))
              .map((entry) => entry.key);
            slot = ringSlotKeys.find((key) => !this.equipment[key]) || ringSlotKeys[0] || "Ring1";
          }
        }
        if (typeof this.canEquipItemInSlot === "function") {
          const check = this.canEquipItemInSlot(item, slot, { source: "inventory_click" });
          if (!check?.allowed) {
            if (typeof this.showNotification === "function") {
              const reason = check?.reason === "duplicate_ring_id"
                ? "You cannot equip two of the same ring."
                : "That item cannot be equipped in the selected slot.";
              this.showNotification("Equipment", reason);
            }
            return;
          }
        }
        const currentlyEquipped = this.equipment[slot];
        if (currentlyEquipped) this.inventory.push(currentlyEquipped);
        this.equipment[slot] = item;
        this.inventory.splice(index, 1);
        this.updateInventoryUI();
        this.updateEquippedUI();
        this.recalculateStats();
        if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      }
    },

    isItemEquippable(item) {
      if (!item || !item.type) return false;
      if (typeof this.resolvePillarEquipmentLayout === "function") {
        const layout = this.resolvePillarEquipmentLayout({ source: "isItemEquippable" });
        return layout.slots.some(
          (slot) => slot.enabled !== false && slot.capacity > 0 && slot.allowedItemTypes.includes(String(item.type))
        );
      }
      return (
        item.type === "Helmet" ||
        item.type === "Boots" ||
        item.type === "Body Armour" ||
        item.type === "Weapon" ||
        item.type === "Ring"
      );
    },

    isUpgradeCard(_item) {
      return false;
    },

    equipUpgradeCardAtIndex(_index) {
      // Upgrade cards removed
    },

    updateInventoryUI() {
      if (!this.inventoryListEl) return;
      this.inventoryListEl.innerHTML = "";
      applyInventoryGridLayout(this.inventoryListEl);
      const canAnytimeSell = typeof this.canSellInventoryAnytime === "function" && this.canSellInventoryAnytime();

      const sections = this.getInventorySectionedItems();
      for (const section of sections) {
        const header = document.createElement("li");
        header.className = "inventory-section-title";
        header.textContent = section.title;
        styleGridHeaderItem(header);
        this.inventoryListEl.appendChild(header);

        if (section.items.length === 0) {
          appendEmptySlotRow(this.inventoryListEl);
          continue;
        }

        for (const item of section.items) {
          const li = document.createElement("li");
          li.className = "inventory-item";

          const equippable = this.isItemEquippable(item) || this.isUpgradeCard(item);
          if (!equippable) li.classList.add("inventory-item--non-equippable");

          const nameSpan = document.createElement("span");
          nameSpan.className = "inventory-item-name" + (item.rarity === "legendary" ? " inventory-item-legendary" : "");
          nameSpan.style.color = getItemRarityColor(item);
          nameSpan.textContent = item.blacksmithUpgraded ? `${item.name} (Forged)` : item.name;
          if (this.hasRunTalent("vaultMaster") && this.isVaultMasterSecured(item)) {
            nameSpan.textContent += " [Secured]";
          }

          const typeSpan = document.createElement("span");
          typeSpan.className = "inventory-item-type";
          typeSpan.textContent = item.type;

          const iconEl = createItemSpriteElement(item, 56);
          if (iconEl) li.appendChild(iconEl);
          li.title = `${nameSpan.textContent} (${item.type})`;
          styleSquareInventoryItem(li, item);
          attachSlotFrameHover(li, item);

          if (equippable) {
            li.title =
              item.type === "Upgrade Card"
                ? "Click to equip upgrade card"
                : `${nameSpan.textContent} (${item.type}) - click to equip`;
            if (canAnytimeSell && !this.inventorySellState?.active && !this.rogueVaultState?.active) {
              li.title += " | Right click to sell";
            }
          }

          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
          if ((canAnytimeSell || this.hasRunTalent("vaultMaster")) && !this.inventorySellState?.active && !this.rogueVaultState?.active) {
            li.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              if (canAnytimeSell && this.isItemEquippable(item)) {
                const itemIndex = this.inventory.indexOf(item);
                if (itemIndex >= 0) {
                  this.sellInventoryItem(itemIndex, item);
                }
                return;
              }
              if (this.hasRunTalent("vaultMaster") && this.toggleVaultMasterSecureItem(item)) this.updateInventoryUI();
            });
          }
          li.addEventListener("click", () => this.handleInventoryItemClick(item));
          this.inventoryListEl.appendChild(li);
        }
      }
    },

    getSellPriceForItem(item) {
      const inCollector = !!this.inventorySellState?.active;
      const canAnytimeSell = typeof this.canSellInventoryAnytime === "function" && this.canSellInventoryAnytime();
      if (!inCollector && !canAnytimeSell) return null;
      if (!item || !this.isItemEquippable(item)) return null;
      const key = this.getInventorySellKey(item);
      const sellCache = inCollector
        ? this.inventorySellState
        : (this.pillarSellState = this.pillarSellState || { pricesByItemId: {} });
      const existing = sellCache?.pricesByItemId?.[key];
      if (Number.isFinite(existing)) return existing;

      const rarity = item.rarity || "common";
      let min = 10;
      let max = 20;
      if (rarity === "magic") {
        min = 25;
        max = 30;
      } else if (rarity === "rare" || rarity === "legendary") {
        min = 35;
        max = 50;
      }
      let price = min + Math.floor(Math.random() * (max - min + 1));
      if (typeof this.resolvePillarSellPrice === "function") {
        price = this.resolvePillarSellPrice(price, item, {
          channel: inCollector ? "equipmentCollector" : "inventoryAnytime"
        });
      }
      sellCache.pricesByItemId = sellCache.pricesByItemId || {};
      sellCache.pricesByItemId[key] = price;
      return price;
    },

    getInventorySellKey(item) {
      if (!item) return "";
      return String(item.id ?? item.name ?? "");
    },

    getSelectedInventorySaleEntry() {
      if (!this.inventorySellState?.active) return null;
      const key = this.inventorySellState.selectedItemKey;
      if (!key) return null;
      const index = this.inventory.findIndex((invItem) => this.getInventorySellKey(invItem) === key);
      if (index < 0) {
        this.inventorySellState.selectedItemKey = null;
        return null;
      }
      const item = this.inventory[index];
      const price = this.getSellPriceForItem(item);
      return Number.isFinite(price) ? { key, index, item, price } : null;
    },

    selectInventoryItemForSale(index, item) {
      if (!this.inventorySellState?.active) return;
      if (!this.isItemEquippable(item)) return;
      const price = this.getSellPriceForItem(item);
      if (!Number.isFinite(price) || price <= 0) return;
      this.inventorySellState.selectedItemKey = this.getInventorySellKey(item);
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      if (typeof this.updateEquipmentCollectorOfferUI === "function") this.updateEquipmentCollectorOfferUI();
    },

    confirmSelectedInventorySale() {
      const selected = this.getSelectedInventorySaleEntry();
      if (!selected) {
        if (typeof this.showNotification === "function") {
          this.showNotification("Equipment Collector", "Select an inventory item to sell.");
        }
        return;
      }
      this.sellInventoryItem(selected.index, selected.item);
    },

    sellInventoryItem(index, item) {
      const inCollector = !!this.inventorySellState?.active;
      const canAnytimeSell = typeof this.canSellInventoryAnytime === "function" && this.canSellInventoryAnytime();
      if (!inCollector && !canAnytimeSell) return;
      if (!this.isItemEquippable(item)) return;
      const resolvedIndex = Number.isFinite(index) ? index : this.inventory.indexOf(item);
      if (resolvedIndex < 0) return;
      const price = this.getSellPriceForItem(item);
      if (!Number.isFinite(price) || price <= 0) return;
      this.clearVaultMasterSecureForItem(item);
      this.inventory.splice(resolvedIndex, 1);
      this.gold = Math.max(0, (this.gold || 0) + price);
      if (this.inventorySellState?.pricesByItemId) {
        delete this.inventorySellState.pricesByItemId[this.getInventorySellKey(item)];
      }
      if (this.pillarSellState?.pricesByItemId) {
        delete this.pillarSellState.pricesByItemId[this.getInventorySellKey(item)];
      }
      if (this.inventorySellState?.selectedItemKey === this.getInventorySellKey(item)) {
        this.inventorySellState.selectedItemKey = null;
      }
      this.updateInventoryUI();
      this.updateMapUI();
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      if (typeof this.updateEquipmentCollectorOfferUI === "function") this.updateEquipmentCollectorOfferUI();
      if (typeof this.runPillarEvent === "function") {
        this.runPillarEvent("onItemSold", {
          item,
          price,
          channel: inCollector ? "equipmentCollector" : "inventoryAnytime",
          time: this.time
        });
      }
      if (!inCollector && typeof this.showNotification === "function") {
        this.showNotification("Merchant Instinct", `Sold ${item.name} for ${price} gold.`);
      }
    },

    sendInventoryItemToLegacyVault(index, item) {
      if (!this.rogueVaultState?.active) return;
      const sent = this.rogueVaultState.sent || 0;
      const max = this.rogueVaultState.max || 3;
      const cost = this.rogueVaultState.cost || 150;
      if (sent >= max) {
        this.showNotification("Rogue", "You already sent the maximum number of items.");
        return;
      }
      if (!canSpendGold(this, cost)) {
        this.showNotification("Rogue", "Not enough gold.");
        return;
      }
      spendGold(this, cost, "rogue_vault_send", { itemId: item?.id });
      this.clearVaultMasterSecureForItem(item);
      this.inventory.splice(index, 1);
      addLegacyVaultItem({ ...item }, "Rogue");
      this.rogueVaultState.sent = sent + 1;
      if (this.rogueVaultState.objRef) {
        this.rogueVaultState.objRef.vaultSentCount = this.rogueVaultState.sent;
      }
      this.updateInventoryUI();
      this.updateMapUI();
      if (typeof this.updateRogueVaultOverlayText === "function") this.updateRogueVaultOverlayText();
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      if ((this.rogueVaultState.sent || 0) >= max) {
        this.showNotification("Rogue", "Three items sent to Legacy Vault.");
      }
    },

    updateEquippedUI() {
      if (!this.equippedListEl) return;
      this.equippedListEl.innerHTML = "";
      const slotDefs = getEffectiveEquippedSlots(this, "equipped_panel");
      this.equippedListEl.dataset.slotCount = String(slotDefs.length || 0);
      applyEquippedGridLayout(this.equippedListEl);
      for (const slotDef of slotDefs) {
        const li = document.createElement("li");
        const slot = slotDef.key;
        const slotLabelText = slotDef.label || EQUIPPED_SLOT_LABEL_BY_KEY[slot] || slot;
        li.className = "equipped-item";

        const slotLabel = document.createElement("div");
        slotLabel.className = "equipped-slot-label";
        const allowedText = getAllowedTypesText(slotDef);
        slotLabel.textContent = `${slotLabelText} (${allowedText})`;

        const nameDiv = document.createElement("div");
        nameDiv.className = "equipped-item-name";
        const item = this.equipment[slot];
        if (item) {
          const iconEl = createItemSpriteElement(item, 28);
          if (iconEl) nameDiv.appendChild(iconEl);
          nameDiv.title = item.name;
        } else {
          nameDiv.textContent = "None";
        }

        if (item) {
          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
        }

        if (slotDef.enabled === false || slotDef.capacity <= 0) {
          li.style.opacity = "0.45";
          li.style.filter = "grayscale(0.85)";
          li.title = slotDef.disabledReason
            ? `Disabled: ${slotDef.disabledReason}`
            : "Disabled by runtime equipment layout.";
        } else if (slotDef.transformedBy) {
          li.style.borderColor = "rgba(148,163,184,0.85)";
          li.title = "Transformed by active pillar effect.";
        }

        li.appendChild(slotLabel);
        li.appendChild(nameDiv);
        this.equippedListEl.appendChild(li);
      }
    }
  });
}








