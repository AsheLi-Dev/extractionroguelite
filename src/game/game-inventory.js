// -------- Game Inventory Methods Mixin --------
// Inventory overlay, crafting, item management
// This module adds methods to Game.prototype when imported

import { escapeHtml } from '../utils.js';
import { EQUIPMENT_BASE_STAT, EQUIPMENT_SECONDARY_BASE, MODIFIER_POOL, LOCAL_STAT_SCALE_MOD_IDS, NAME_PREFIXES, NAME_SUFFIXES, getModifierPoolForType, rollLocalStatScaleValue } from '../data/loot-data.js';
import { MODIFIER_CUBE_TIERS, MODIFIER_CUBES, UPGRADE_CUBES, LEGENDARY_CUBES, LEGENDARY_MODIFIER_IDS, rollModifierForTier } from '../data/cubes-data.js';
import { showItemTooltip, hideItemTooltip, buildItemTooltipContent, getItemRarityColor } from '../ui/tooltips.js';
import { hasTalent } from '../data/talents.js';

export function applyGameInventoryMixin(Game) {
  Object.assign(Game.prototype, {
    getInventoryRaritySortRank(item) {
      const rarity = item?.rarity || "common";
      if (rarity === "legendary") return 0;
      if (rarity === "rare") return 1;
      if (rarity === "magic") return 2;
      if (rarity === "common") return 3; // "normal"
      return 4;
    },

    getInventorySectionedItems() {
      const sectionOrder = ["Weapon", "Helmet", "Body Armour", "Boots"];
      const sections = sectionOrder.map((title) => ({ title, items: [] }));
      const other = { title: "Other", items: [] };
      const byType = new Map(sections.map((s) => [s.title, s]));

      for (const item of this.inventory) {
        const bucket = byType.get(item.type) || other;
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

    showInventoryOverlay() {
      if (this.gameOver || this.levelUpChoices || this.currentEvent) return;
      this.inventoryOverlayOpen = true;
      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
      const overlay = document.getElementById("inventory-overlay");
      if (overlay) overlay.classList.remove("hidden");
      this.populateInventoryOverlay();
      
      // Track inventory open for tutorial (only once per step)
      if (this.tutorialSystem && !this.tutorialSystem.inventoryOpenedThisStep) {
        this.tutorialSystem.onInventoryOpened();
        this.tutorialSystem.inventoryOpenedThisStep = true;
      }
    },

    closeInventoryOverlay() {
      this.inventoryOverlayOpen = false;
      this.paused = false;
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

    populateInventoryOverlay() {
      const equippedList = document.getElementById("inventory-overlay-equipped-list");
      const invList = document.getElementById("inventory-overlay-inventory-list");
      if (!equippedList || !invList) return;

      equippedList.innerHTML = "";
      const slots = ["Helmet", "Body Armour", "Weapon", "Boots"];
      for (const slot of slots) {
        const li = document.createElement("li");
        const item = this.equipment[slot];
        if (item) {
          const color = getItemRarityColor(item);
          const baseKey = EQUIPMENT_BASE_STAT[slot];
          const baseVal = item.stats?.[baseKey] ?? 0;
          if (item.rarity === "legendary") li.classList.add("item-legendary");
          li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (+${baseVal})`;
        } else {
          li.textContent = `${slot}: None`;
        }
        if (item) {
          li.dataset.hasItem = "1";
          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
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
        } else {
          li.classList.add("inventory-overlay-empty");
        }
        equippedList.appendChild(li);
      }

      invList.innerHTML = "";
      if (this.inventory.length === 0) {
        const li = document.createElement("li");
        li.className = "inventory-overlay-empty";
        li.textContent = "No items in inventory";
        invList.appendChild(li);
      } else {
        const sections = this.getInventorySectionedItems();
        for (const section of sections) {
          const header = document.createElement("li");
          header.className = "inventory-section-title";
          header.textContent = section.title;
          invList.appendChild(header);

          if (section.items.length === 0) {
            const empty = document.createElement("li");
            empty.className = "inventory-overlay-empty";
            empty.textContent = "No items";
            invList.appendChild(empty);
            continue;
          }

          for (const item of section.items) {
            const li = document.createElement("li");
            if (item.type !== "Upgrade Card") {
              const color = getItemRarityColor(item);
              const baseKey = EQUIPMENT_BASE_STAT[item.type];
              const baseVal = item.stats?.[baseKey] ?? 0;
              if (item.rarity === "legendary") li.classList.add("item-legendary");
              li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (${escapeHtml(item.type)}) +${baseVal}`;
            } else {
              li.textContent = item.name;
            }
            li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
            li.addEventListener("mouseleave", hideItemTooltip);
            li.addEventListener("click", () => this.handleInventoryItemClick(item));
            invList.appendChild(li);
          }
        }
      }
      this.populateCraftingTab();
    },

    getLivingItem() {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item?.livingItem) return item;
      }
      return this.inventory.find((it) => it.livingItem) || null;
    },

    getCraftableEquipmentItems() {
      const items = [];
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item && item.rarity !== "legendary" && !item.livingItem) items.push({ item, source: "equipped", slot });
      }
      for (let i = 0; i < this.inventory.length; i++) {
        const item = this.inventory[i];
        if (item.type !== "Upgrade Card" && item.rarity !== "legendary" && !item.livingItem && (item.type === "Helmet" || item.type === "Body Armour" || item.type === "Weapon" || item.type === "Boots")) {
          items.push({ item, source: "inventory", index: i });
        }
      }
      return items;
    },

    populateCraftingTab() {
      const grid = document.getElementById("cube-inventory-grid");
      const itemList = document.getElementById("crafting-item-list");
      if (!grid || !itemList) return;

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
        const icon = c.tier ? (c.id.includes("magic") ? "💎" : c.id.includes("rare") ? "⭐" : c.id.includes("reforge") ? "🔧" : "✨") : "💎";
        const tierLabel = c.tier ? ` T${c.tier}` : "";
        div.innerHTML = `
          <span class="cube-icon">${icon}${tierLabel}</span>
          <span class="cube-slot-name">${escapeHtml(c.label)}</span>
          <span class="cube-slot-count">×${count}</span>
        `;
        div.addEventListener("click", () => this.selectCraftingCube(c.key));
        grid.appendChild(div);
      }

      itemList.innerHTML = "";
      const craftables = this.getCraftableEquipmentItems();
      for (const { item, source, slot, index } of craftables) {
        const li = document.createElement("li");
        const color = getItemRarityColor(item);
        const baseKey = EQUIPMENT_BASE_STAT[item.type];
        const baseVal = item.stats?.[baseKey] ?? 0;
        const loc = source === "equipped" ? `${slot}` : "Inventory";
        if (item.rarity === "legendary") li.classList.add("item-legendary");
        li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (+${baseVal}) [${loc}]`;
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
      if ((this.cubeInventory[cubeKey] || 0) === 0) return;
      this.craftingSelectedCube = cubeKey;
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
        const tierMatch = this.craftingSelectedCube.match(/T(\d)$/);
        const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
        const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
        const modCube = !legCube && MODIFIER_CUBES.find((c) => `${c.id}T${tier}` === this.craftingSelectedCube || this.craftingSelectedCube.startsWith(c.id));
        const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube === `${c.id}T${tier}`);
        const cubeLabel = legCube ? legCube.label : (modCube ? `${modCube.label} T${tier}` : (upgCube ? `${upgCube.label} T${tier}` : this.craftingSelectedCube));
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
        if (item.rarity === "legendary") {
          preview = "Legendary items cannot be further crafted.";
        } else {
          const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
          const [cubeId, tierStr] = this.craftingSelectedCube.match(/(.+)T(\d)$/)?.slice(1) || [null, "1"];
          const tier = parseInt(tierStr || "1", 10);
          const modCube = !legCube && MODIFIER_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));
          const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));

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
              const maxMods = item.rarity === "common" ? 0 : item.rarity === "magic" ? 2 : 4;
              const currentCount = item.modifiers?.length || 0;
              const r = MODIFIER_CUBE_TIERS[tier - 1] || MODIFIER_CUBE_TIERS[0];
              const range = (r.min * 100).toFixed(0) + "-" + (r.max * 100).toFixed(0) + "%";
              if (existing) {
                preview = `Replaces ${modCube.modifierLabel} with new value (${range}).`;
              } else if (currentCount < maxMods) {
                preview = `Adds ${modCube.modifierLabel} (${range}).`;
              } else {
                preview = `Replaces a random modifier with ${modCube.modifierLabel} (${range}).`;
              }
              canCraft = true;
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
            } else if (upgCube.id === "socketCube") {
              const currentSockets = item.sockets ?? 0;
              if (currentSockets >= 2) {
                preview = "Item already has maximum sockets (2).";
              } else {
                const socketMasteryBonus = hasTalent("socketMastery") ? " (20% chance to add 2 sockets)" : "";
                const maxPossible = currentSockets === 0 && hasTalent("socketMastery") ? 2 : 1;
                const newSockets = Math.min(2, currentSockets + maxPossible);
                preview = `Adds 1 socket${socketMasteryBonus}. Item will have ${newSockets} socket${newSockets !== 1 ? "s" : ""}.`;
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
    },

    executeCraft() {
      if (!this.craftingSelectedItem || !this.craftingSelectedCube) return;
      if (this.craftingSelectedItem.rarity === "legendary") return;
      const cubeKey = this.craftingSelectedCube;
      const count = this.cubeInventory[cubeKey] || 0;
      if (count === 0) return;

      const tier = parseInt(cubeKey.match(/T(\d)$/)?.[1] || "1", 10);
      const legCube = LEGENDARY_CUBES.find((c) => c.id === cubeKey);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => cubeKey.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => cubeKey.startsWith(c.id));

      if (legCube) {
        const item = this.craftingSelectedItem;
        if (item.rarity !== "rare") return;
        this.applyLegendaryCube(item, legCube);
      } else if (modCube) {
        const item = this.craftingSelectedItem;
        if (item.rarity === "common" || !item.rarity) return;
        this.applyModifierCube(item, modCube, tier);
      } else if (upgCube) {
        if (upgCube.id === "socketCube") {
          this.applySocketCube(this.craftingSelectedItem);
        } else {
          this.applyUpgradeCube(this.craftingSelectedItem, upgCube, tier);
        }
      }

      const cascadeSave = hasTalent("cubeCascade") && Math.random() < 0.1;
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
      const value = rollModifierForTier(tier);
      const poolEntry = MODIFIER_POOL.find((m) => m.id === cubeDef.modifierId);
      const modEntry = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: poolEntry?.statKey || cubeDef.modifierId.replace("Percent", ""), value, addedAt: Date.now() };

      const existingIdx = item.modifiers.findIndex((m) => m.id === cubeDef.modifierId);
      const maxMods = item.rarity === "magic" ? 2 : item.rarity === "rare" ? 4 : 0;
      if (existingIdx >= 0) {
        item.modifiers[existingIdx] = { ...modEntry };
      } else if (item.modifiers.length < maxMods) {
        item.modifiers.push(modEntry);
      } else {
        const replaceIdx = Math.floor(Math.random() * item.modifiers.length);
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

    applySocketCube(item) {
      // Socket Cubes add sockets but cannot exceed 2 sockets
      const currentSockets = item.sockets ?? 0;
      if (currentSockets >= 2) return; // Already at max
      
      let add = 1;
      // socketMastery talent: 20% chance to add 2 sockets instead of 1
      if (hasTalent("socketMastery") && Math.random() < 0.2) {
        add = 2;
      }
      
      // Cap at 2 sockets (Socket Cubes cannot exceed 2)
      item.sockets = Math.min(2, currentSockets + add);
      this.rebuildItemStats(item);
    },

    applyUpgradeCube(item, cubeDef, tier) {
      if (cubeDef.id === "magicCube") {
        item.rarity = "magic";
        item.modifiers = item.modifiers || [];
        const pool = getModifierPoolForType(item.type);
        for (let i = 0; i < 2; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          const m = pool.splice(idx, 1)[0];
          const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValue() : rollModifierForTier(tier);
          item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
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
        const pool = getModifierPoolForType(item.type).filter((p) => !item.modifiers.some((m) => m.id === p.id));
        const extraMods = hasTalent("transmutation") && Math.random() < 0.05 ? 3 : 2;
        for (let i = 0; i < extraMods; i++) {
          if (pool.length === 0) break;
          const idx = Math.floor(Math.random() * pool.length);
          const m = pool.splice(idx, 1)[0];
          const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValue() : rollModifierForTier(tier);
          item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
        }
        const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
        const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
        if (!hasPrefix) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
        if (!hasSuffix) item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
      } else if (cubeDef.id === "reforgeCube") {
        item.modifiers = [];
        const pool = getModifierPoolForType(item.type);
        const count = item.rarity === "magic" ? 2 : 4;
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          const m = pool.splice(idx, 1)[0];
          const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValue() : rollModifierForTier(tier);
          item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
        }
      }
      this.rebuildItemStats(item);
    },

    rebuildItemStats(item) {
      const baseKey = EQUIPMENT_BASE_STAT[item.type];
      if (!item.baseStat && item.stats) {
        item.baseStat = { [baseKey]: item.stats[baseKey] ?? 0 };
        const sec = EQUIPMENT_SECONDARY_BASE[item.type];
        if (sec) item.baseStat[sec.statKey] = item.stats[sec.statKey] ?? 0;
      }
      const stats = { ...(item.baseStat || {}) };
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

      if (this.isUpgradeCard(item)) {
        this.equipUpgradeCardAtIndex(index);
      } else if (this.isItemEquippable(item)) {
        const slot = item.type;
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
      return (
        item.type === "Helmet" ||
        item.type === "Boots" ||
        item.type === "Body Armour" ||
        item.type === "Weapon"
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

      if (this.inventory.length === 0) {
        const li = document.createElement("li");
        li.className = "inventory-empty";
        li.textContent = "No items collected";
        this.inventoryListEl.appendChild(li);
        return;
      }

      const sections = this.getInventorySectionedItems();
      for (const section of sections) {
        const header = document.createElement("li");
        header.className = "inventory-section-title";
        header.textContent = section.title;
        this.inventoryListEl.appendChild(header);

        if (section.items.length === 0) {
          const empty = document.createElement("li");
          empty.className = "inventory-empty";
          empty.textContent = "No items";
          this.inventoryListEl.appendChild(empty);
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
          nameSpan.textContent = item.name;

          const typeSpan = document.createElement("span");
          typeSpan.className = "inventory-item-type";
          typeSpan.textContent = item.type;

          li.appendChild(nameSpan);
          li.appendChild(typeSpan);

          if (equippable) {
            li.title =
              item.type === "Upgrade Card"
                ? "Click to equip upgrade card"
                : "Click to equip";
          }

          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
          li.addEventListener("click", () => this.handleInventoryItemClick(item));
          this.inventoryListEl.appendChild(li);
        }
      }
    },

    updateEquippedUI() {
      if (!this.equippedListEl) return;
      this.equippedListEl.innerHTML = "";

      const slots = ["Helmet", "Body Armour", "Weapon", "Boots"];
      for (const slot of slots) {
        const li = document.createElement("li");
        li.className = "equipped-item";

        const slotLabel = document.createElement("div");
        slotLabel.className = "equipped-slot-label";
        slotLabel.textContent = slot;

        const nameDiv = document.createElement("div");
        nameDiv.className = "equipped-item-name";
        const item = this.equipment[slot];
        if (item) {
          nameDiv.style.color = getItemRarityColor(item);
          nameDiv.textContent = item.name;
        } else {
          nameDiv.textContent = "None";
        }

        if (item) {
          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
        }

        li.appendChild(slotLabel);
        li.appendChild(nameDiv);
        this.equippedListEl.appendChild(li);
      }
    }
  });
}
