// -------- Game Events Methods Mixin --------
// Event system, shrines, interactions
// This module adds methods to Game.prototype when imported

import { EVENT_DEFS, SHRINE_DEFS } from '../data/shrines.js';
import { ATTACK_UPGRADE_DEFS, getAttackUpgradeDefById, getBuildUpgradePoolForAttackType } from '../data/level-up-data.js';
import { rollUpgradeValue } from '../data/level-up-data.js';
import { generateEquipmentItem } from '../data/loot-data.js';
import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { DIFFICULTY_STAT_MULTIPLIER } from '../data/constants.js';
import { Vec2 } from '../utils.js';
import { LEGENDARY_MODIFIER_IDS } from '../data/cubes-data.js';
import { hasTalent } from '../data/talents.js';
import { addGold, canSpendGold, spendGold } from './economy.js';
import { SCHEMA_SACRIFICE_PCTS } from '../data/npc-data.js';
import { showItemTooltip, hideItemTooltip } from '../ui/tooltips.js';
import { onRingNpcInteracted } from './ring-effects.js';
import { REST_ROOM_REFORGE_COST, REST_ROOM_VENDOR_COSTS, REST_ROOM_VENDOR_OFFER_COUNT, isRestRoomMapId } from '../data/rest-room.js';
import { getSnackById } from '../data/snack.js';
import { META_ATTRIBUTES } from '../data/character-attributes.js';

export function applyGameEventsMixin(Game) {
  Object.assign(Game.prototype, {
    tryTriggerEvent() {
      // Require at least 3 maps visited before events can trigger
      if (this.visitedMaps.size < 3) return;
      if (this.eventsOccurredThisRun.size >= EVENT_DEFS.length) return;
      if (Math.random() >= 0.25) return;
      const available = EVENT_DEFS.filter((e) => !this.eventsOccurredThisRun.has(e.id));
      if (available.length === 0) return;
      const event = available[Math.floor(Math.random() * available.length)];
      this.eventsOccurredThisRun.add(event.id);
      this.showEventCard(event);
    },

    showEventCard(eventDef) {
      this.paused = true;
      this.currentEvent = eventDef;
      const overlay = document.getElementById("event-overlay");
      const titleEl = document.getElementById("event-title");
      const descEl = document.getElementById("event-desc");
      const choicesEl = document.getElementById("event-choices");
      const merchantPick = document.getElementById("event-merchant-pick");
      if (!overlay || !titleEl || !descEl || !choicesEl) return;
      titleEl.textContent = eventDef.name;
      descEl.textContent = eventDef.desc;
      choicesEl.innerHTML = "";
      merchantPick.classList.add("hidden");
      if (eventDef.id === "fiery") {
        const btn = document.createElement("button");
        btn.className = "event-choice-btn";
        btn.textContent = "Face the Fiery";
        btn.onclick = () => this.resolveEventChoice(eventDef.id, "face");
        choicesEl.appendChild(btn);
      } else {
        for (const choice of eventDef.choices) {
          const btn = document.createElement("button");
          btn.className = "event-choice-btn";
          btn.textContent = choice.label;
          btn.onclick = () => this.resolveEventChoice(eventDef.id, choice.id);
          choicesEl.appendChild(btn);
        }
      }
      overlay.classList.remove("hidden");
    },

    openNpcChoiceCard(title, desc, choices, cancelLabel = "Leave") {
      this.paused = true;
      this.currentEvent = { id: "npcChoice" };
      const overlay = document.getElementById("event-overlay");
      const titleEl = document.getElementById("event-title");
      const descEl = document.getElementById("event-desc");
      const choicesEl = document.getElementById("event-choices");
      const merchantPick = document.getElementById("event-merchant-pick");
      if (!overlay || !titleEl || !descEl || !choicesEl || !merchantPick) return;
      merchantPick.classList.add("hidden");
      choicesEl.classList.remove("hidden");
      titleEl.textContent = title;
      descEl.textContent = desc;
      choicesEl.innerHTML = "";
      for (const c of choices) {
        const btn = document.createElement("button");
        btn.className = "event-choice-btn";
        btn.textContent = c.label;
        btn.onclick = () => {
          const keepOpen = !!c.keepOpen;
          if (!keepOpen) this.closeEventOverlay();
          c.onPick?.();
        };
        choicesEl.appendChild(btn);
      }
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "event-choice-btn";
      cancelBtn.textContent = cancelLabel;
      cancelBtn.onclick = () => this.closeEventOverlay();
      choicesEl.appendChild(cancelBtn);
      overlay.classList.remove("hidden");
    },

    getRestRoomVendorOffers(obj) {
      if (Array.isArray(obj?.vendorOffers)) return obj.vendorOffers;
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      const pool = [...(defs?.standardUpgrades || [])].filter((entry) => entry.buildSelectable !== false);
      const offers = [];
      const used = new Set();
      while (pool.length > 0 && offers.length < REST_ROOM_VENDOR_OFFER_COUNT) {
        const index = Math.floor(Math.random() * pool.length);
        const def = pool.splice(index, 1)[0];
        if (!def || used.has(def.id)) continue;
        const currentStacks = typeof this.getAttackUpgradeStackCount === "function"
          ? this.getAttackUpgradeStackCount(def.id)
          : (this.runAttackUpgrades || []).filter((upgrade) => upgrade.id === def.id).length;
        const maxLevel = Math.max(1, Number(def.maxLevel) || 1);
        if (currentStacks >= maxLevel) continue;
        used.add(def.id);
        offers.push({
          id: def.id,
          name: def.name,
          description: def.description,
          category: def.category,
          rarity: def.rarity || "common",
          maxLevel,
          valueRange: def.valueRange || null,
          cost: REST_ROOM_VENDOR_COSTS[def.rarity] || REST_ROOM_VENDOR_COSTS.common,
          percent: !!def.valueRange?.percent
        });
      }
      if (obj) obj.vendorOffers = offers;
      return offers;
    },

    buyRestRoomVendorOffer(obj, offer) {
      if (!obj || !offer) return false;
      const currentStacks = typeof this.getAttackUpgradeStackCount === "function"
        ? this.getAttackUpgradeStackCount(offer.id)
        : (this.runAttackUpgrades || []).filter((upgrade) => upgrade.id === offer.id).length;
      if (currentStacks >= Math.max(1, Number(offer.maxLevel) || 1)) {
        obj.vendorOffers = (obj.vendorOffers || []).filter((entry) => entry.id !== offer.id);
        return false;
      }
      const cost = Math.max(0, Number(offer.cost) || 0);
      if (!canSpendGold(this, cost)) {
        if (typeof this.addFloatingText === "function") {
          const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
          const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
          this.addFloatingText(px, py, "Need More Gold", "damage");
        }
        return false;
      }
      spendGold(this, cost, "rest_room_vendor", { upgradeId: offer.id });
      const appliedUpgrade = {
        id: offer.id,
        name: offer.name,
        description: offer.description,
        value: offer.valueRange ? rollUpgradeValue(offer) : undefined,
        percent: !!offer.percent,
        category: offer.category,
        level: 1,
        maxLevel: offer.maxLevel
      };
      this.runAttackUpgrades = this.runAttackUpgrades || [];
      this.runAttackUpgrades.push(appliedUpgrade);
      if (this.categoryCounts && offer.category != null) {
        this.categoryCounts[offer.category] = (this.categoryCounts[offer.category] || 0) + 1;
      }
      obj.vendorOffers = (obj.vendorOffers || []).filter((entry) => entry.id !== offer.id);
      this.recalculateStats?.();
      this.updateMapUI?.();
      if (this.buildLogRefresh) this.buildLogRefresh();
      if (typeof this.addFloatingText === "function") {
        const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
        const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
        this.addFloatingText(px, py, offer.name, "skill");
      }
      return true;
    },

    openRestRoomUpgradeVendor(obj) {
      const offers = this.getRestRoomVendorOffers(obj);
      if (!offers.length) return;
      this.openNpcChoiceCard(
        "Upgrade Vendor",
        "Buy one upgrade for this run.",
        offers.map((offer) => ({
          label: `${offer.name} (${offer.rarity}) - ${offer.cost}g`,
          onPick: () => {
            this.buyRestRoomVendorOffer(obj, offer);
          }
        })),
        "Leave"
      );
    },

    getRestRoomReforgeChoices() {
      const seen = new Set();
      return (this.runAttackUpgrades || []).filter((upgrade) => {
        if (!upgrade?.id || seen.has(upgrade.id)) return false;
        const def = getAttackUpgradeDefById(this.attackType, upgrade.id);
        if (!def || def.buildSelectable === false) return false;
        seen.add(upgrade.id);
        return true;
      });
    },

    reforgeRunUpgrade(upgradeId) {
      if (!upgradeId) return false;
      const cost = Math.max(0, Number(REST_ROOM_REFORGE_COST) || 0);
      if (!canSpendGold(this, cost)) {
        if (typeof this.addFloatingText === "function") {
          const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
          const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
          this.addFloatingText(px, py, "Need More Gold", "damage");
        }
        return false;
      }
      const removed = this.removeUpgradeById(upgradeId);
      if (!removed) return false;
      if (this.categoryCounts && removed.category != null) {
        this.categoryCounts[removed.category] = Math.max(0, (this.categoryCounts[removed.category] || 0) - 1);
      }

      const currentCounts = new Map();
      for (const upgrade of this.runAttackUpgrades || []) {
        currentCounts.set(upgrade.id, (currentCounts.get(upgrade.id) || 0) + 1);
      }
      const pool = getBuildUpgradePoolForAttackType(this.attackType).filter((def) => {
        const current = currentCounts.get(def.id) || 0;
        const maxLevel = Math.max(1, Number(def.maxLevel) || 1);
        return current < maxLevel;
      });
      if (!pool.length) {
        if (removed) {
          this.runAttackUpgrades.push(removed);
          if (this.categoryCounts && removed.category != null) {
            this.categoryCounts[removed.category] = (this.categoryCounts[removed.category] || 0) + 1;
          }
        }
        return false;
      }
      const replacementDef = pool[Math.floor(Math.random() * pool.length)];
      spendGold(this, cost, "rest_room_reforge", { removedUpgradeId: upgradeId, replacementUpgradeId: replacementDef.id });
      const replacement = {
        id: replacementDef.id,
        name: replacementDef.name,
        description: replacementDef.description,
        value: replacementDef.valueRange ? rollUpgradeValue(replacementDef) : undefined,
        percent: !!replacementDef.valueRange?.percent,
        category: replacementDef.category,
        level: 1,
        maxLevel: replacementDef.maxLevel
      };
      this.runAttackUpgrades.push(replacement);
      if (this.categoryCounts && replacement.category != null) {
        this.categoryCounts[replacement.category] = (this.categoryCounts[replacement.category] || 0) + 1;
      }
      this.recalculateStats?.();
      this.updateMapUI?.();
      if (this.buildLogRefresh) this.buildLogRefresh();
      if (typeof this.addFloatingText === "function") {
        const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
        const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
        this.addFloatingText(px, py, `Reforged: ${replacement.name}`, "skill");
      }
      return true;
    },

    openRestRoomUpgradeReforge(_obj) {
      const choices = this.getRestRoomReforgeChoices();
      if (!choices.length) return;
      this.openNpcChoiceCard(
        "Upgrade Reforge",
        `Replace one owned upgrade for ${REST_ROOM_REFORGE_COST} gold.`,
        choices.map((upgrade) => ({
          label: `${upgrade.name} - ${REST_ROOM_REFORGE_COST}g`,
          onPick: () => {
            this.reforgeRunUpgrade(upgrade.id);
          }
        })),
        "Leave"
      );
    },

    grantRestRoomAttribute(obj, attributeId) {
      if (!obj || !attributeId) return false;
      const availablePoints = Math.max(0, Number(this.runAttributePoints) || 0);
      if (availablePoints <= 0) return false;
      this.runCharacterAttributes = this.runCharacterAttributes || {};
      const current = Math.max(0, Number(this.runCharacterAttributes[attributeId]) || 0);
      this.runCharacterAttributes[attributeId] = current + 1;
      this.runAttributePoints = availablePoints - 1;
      if (attributeId === "brutality") {
        this.baseStats.attack = Math.max(1, Number(this.baseStats.attack) || 0) + 1;
      } else if (attributeId === "agility") {
        this.baseStats.speed = Math.max(1, Number(this.baseStats.speed) || 0) + 10;
      } else if (attributeId === "vitality") {
        this.baseStats.maxHealth = Math.max(1, Number(this.baseStats.maxHealth) || 0) + 5;
        this.currentHealth = Math.min(
          (Number(this.currentHealth) || 0) + 5,
          Math.max(1, Number(this.baseStats.maxHealth) || 1)
        );
      } else if (attributeId === "luck") {
        this.lootSystem?.setPlayerLuck?.(Math.max(0, Number(this.runCharacterAttributes.luck) || 0));
      }
      this.recalculateStats?.();
      this.updateMapUI?.();
      if (typeof this.addFloatingText === "function") {
        const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
        const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
        const meta = META_ATTRIBUTES.find((entry) => entry.id === attributeId);
        this.addFloatingText(px, py, `+1 ${meta?.name || "Attribute"}`, "skill");
      }
      return true;
    },

    openRestRoomAttributes(obj) {
      if (!obj) return;
      this.openNpcChoiceCard(
        "Attributes",
        "Attributes are now global. Allocate/refund them from Talents in the hub/menu.",
        [],
        "Close"
      );
    },

    addEquipmentDefToInventory(def) {
      if (!def) return;
      this.inventory.push({
        id: Date.now() + Math.random(),
        name: def.name,
        type: def.type,
        ringId: def.ringId || null,
        ringSpriteKey: def.ringSpriteKey || null,
        consumedOnTrigger: !!def.consumedOnTrigger,
        rolledModifiers: def.rolledModifiers || null,
        spriteCell: def.spriteCell || null,
        stats: def.stats || {},
        cardKey: null,
        description: "",
        weight: def.weight || null,
        rarity: def.rarity || null,
        modifiers: def.modifiers || [],
        baseStat: def.baseStat || null,
        sockets: def.sockets ?? 0,
        vesselsMax: def.vesselsMax ?? 0,
        vessels: Array.isArray(def.vessels) ? def.vessels : []
      });
      this.updateInventoryUI();
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      this.showNotification("Item Received", `${def.name} added to inventory.`);
    },

    offerMysteriousOldWomanItems(obj) {
      const types = ["Weapon", "Ring", "Helmet", "Body Armour", "Boots"];
      const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
      const options = [];
      for (let i = 0; i < 3; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const rarity = Math.random() < 0.5 ? "magic" : "rare";
        options.push(generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.4, 0.45, rarity, { difficulty: diff, luck }));
      }
      this.openNpcChoiceCard(
        "Mysterious Old Woman",
        "Choose one item from her hidden satchel.",
        options.map((def) => ({
          label: `${def.name} (${def.rarity})`,
          onPick: () => {
            this.addEquipmentDefToInventory(def);
            if (obj) this.mapInteractables = (this.mapInteractables || []).filter((x) => x !== obj);
          }
        }))
      );
    },

    offerMysteriousOldManUpgrades(obj) {
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      if (!defs) {
        this.showNotification("Mysterious Old Man", "No upgrades available.");
        return;
      }
      const taken = new Set((this.runAttackUpgrades || []).map((u) => u.id));
      const pool = [...(defs.standardUpgrades || [])].filter((u) => !taken.has(u.id));
      if (pool.length === 0) {
        this.showNotification("Mysterious Old Man", "You already know all standard upgrades.");
        return;
      }
      const offers = [];
      const localPool = [...pool];
      for (let i = 0; i < 3 && localPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * localPool.length);
        const def = localPool.splice(idx, 1)[0];
        offers.push({
          id: def.id,
          name: def.name,
          description: def.description,
          value: rollUpgradeValue(def),
          percent: !!def.valueRange?.percent
        });
      }
      this.openNpcChoiceCard(
        "Mysterious Old Man",
        "Choose one standard upgrade.",
        offers.map((upg) => ({
          label: upg.name,
          onPick: () => {
            this.runAttackUpgrades.push(upg);
            this.recalculateStats();
            if (this.buildLogRefresh) this.buildLogRefresh();
            this.showNotification("Upgrade Acquired", upg.name);
            if (obj) this.mapInteractables = (this.mapInteractables || []).filter((x) => x !== obj);
          }
        }))
      );
    },

    resolveNpcServiceCost(baseCost, context = {}) {
      const normalized = Math.max(0, Math.round(Number(baseCost) || 0));
      if (typeof this.resolvePillarNpcPrice === "function") {
        return this.resolvePillarNpcPrice(normalized, context);
      }
      return normalized;
    },

    openPriestServices() {
      const options = [
        { pct: 0.3, baseCost: 80 },
        { pct: 0.5, baseCost: 100 },
        { pct: 1.0, baseCost: 180 }
      ].map((entry) => {
        const cost = this.resolveNpcServiceCost(entry.baseCost, {
          npcType: "npcPriest",
          service: "heal",
          pct: entry.pct
        });
        return {
          ...entry,
          cost,
          label: `Restore ${Math.round(entry.pct * 100)}% HP (${cost} gold)`
        };
      });
      this.openNpcChoiceCard(
        "Priest",
        "A blessing can restore your vitality for a fee.",
        options.map((opt) => ({
          label: opt.label,
          onPick: () => {
            if (!canSpendGold(this, opt.cost)) {
              this.showNotification("Priest", "Not enough gold.");
              return;
            }
            spendGold(this, opt.cost, "priest_heal", { pct: opt.pct });
            const missing = Math.max(0, this.currentStats.maxHealth - this.currentHealth);
            const healAmount = Math.min(missing, this.currentStats.maxHealth * opt.pct);
            this.healPlayer(healAmount);
            this.updateMapUI();
          }
        }))
      );
    },

    openSchemaMonkSacrifice(obj) {
      const step = Math.max(0, Math.min(2, obj.interactionCount || 0));
      const hpPct = SCHEMA_SACRIFICE_PCTS[step];
      const hpCost = Math.max(1, Math.round(this.currentStats.maxHealth * hpPct));
      this.openNpcChoiceCard(
        "Schema Monk",
        `Sacrifice ${Math.round(hpPct * 100)}% max health for random gold (10-200).`,
        [{
          label: `Sacrifice ${Math.round(hpPct * 100)}% HP`,
          onPick: () => {
            if (this.currentHealth <= hpCost) {
              this.showNotification("Schema Monk", "You are too weak for this sacrifice.");
              return;
            }
            this.currentHealth = Math.max(1, this.currentHealth - hpCost);
            this.updateHealthBar();
            const gold = 10 + Math.floor(Math.random() * 191);
            addGold(this, gold, "schema_monk_sacrifice", { hpCost });
            obj.interactionCount = (obj.interactionCount || 0) + 1;
            this.updateMapUI();
            this.showNotification("Schema Monk", `You gained ${gold} gold.`);
            if (obj.interactionCount >= 3) this.mapInteractables = (this.mapInteractables || []).filter((x) => x !== obj);
          }
        }]
      );
    },

    openElderSchemaMonkSacrifice(obj) {
      const step = Math.max(0, Math.min(2, obj.interactionCount || 0));
      const hpPct = SCHEMA_SACRIFICE_PCTS[step];
      const hpCost = Math.max(1, Math.round(this.currentStats.maxHealth * hpPct));
      this.openNpcChoiceCard(
        "Elder Schema Monk",
        `Sacrifice ${Math.round(hpPct * 100)}% max health for a random item.`,
        [{
          label: `Sacrifice ${Math.round(hpPct * 100)}% HP`,
          onPick: () => {
            if (this.currentHealth <= hpCost) {
              this.showNotification("Elder Schema Monk", "You are too weak for this sacrifice.");
              return;
            }
            this.currentHealth = Math.max(1, this.currentHealth - hpCost);
            this.updateHealthBar();
            const roll = Math.random();
            const rarity = roll < 0.7 ? "common" : roll < 0.9 ? "magic" : "rare";
      const types = ["Weapon", "Ring", "Helmet", "Body Armour", "Boots"];
            const type = types[Math.floor(Math.random() * types.length)];
            const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
            const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
            const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.4, 0.25, rarity, { difficulty: diff, luck });
            obj.interactionCount = (obj.interactionCount || 0) + 1;
            this.addEquipmentDefToInventory(def);
            this.updateMapUI();
            if (obj.interactionCount >= 3) this.mapInteractables = (this.mapInteractables || []).filter((x) => x !== obj);
          }
        }]
      );
    },

    openEquipmentCollectorUI(_obj) {
      this.inventorySellState = { active: true, pricesByItemId: {}, selectedItemKey: null };
      this.showInventoryOverlay();
      this.currentEvent = { id: "npcEquipmentCollector" };

      const overlay = document.getElementById("event-overlay");
      const titleEl = document.getElementById("event-title");
      const descEl = document.getElementById("event-desc");
      const choicesEl = document.getElementById("event-choices");
      const merchantPick = document.getElementById("event-merchant-pick");
      const inventoryOverlay = document.getElementById("inventory-overlay");
      if (!overlay || !titleEl || !descEl || !choicesEl || !merchantPick) return;

      this.paused = true;
      overlay.classList.add("rogue-split");
      if (inventoryOverlay) inventoryOverlay.classList.add("rogue-split");
      merchantPick.classList.add("hidden");
      choicesEl.classList.remove("hidden");
      titleEl.textContent = "Equipment Collector";
      const collectorBonus = typeof this.hasPillarEffect === "function" && this.hasPillarEffect("pillar.collector.merchant_instinct");
      descEl.textContent = collectorBonus
        ? "Click an inventory item on the left to get a price quote, then confirm the sale. Merchant Instinct is doubling quotes."
        : "Click an inventory item on the left to get a price quote, then confirm the sale.";
      choicesEl.innerHTML = "";

      const offerEl = document.createElement("div");
      offerEl.id = "event-collector-offer";
      offerEl.className = "event-pick-label";
      offerEl.style.marginBottom = "8px";
      choicesEl.appendChild(offerEl);

      const confirmBtn = document.createElement("button");
      confirmBtn.id = "event-collector-confirm";
      confirmBtn.className = "event-choice-btn";
      confirmBtn.textContent = "Confirm Sale";
      confirmBtn.disabled = true;
      confirmBtn.onclick = () => this.confirmSelectedInventorySale();
      choicesEl.appendChild(confirmBtn);

      const doneBtn = document.createElement("button");
      doneBtn.className = "event-choice-btn event-btn-secondary";
      doneBtn.textContent = "Done";
      doneBtn.onclick = () => {
        this.inventorySellState = null;
        if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
        this.closeEventOverlay();
      };
      choicesEl.appendChild(doneBtn);
      overlay.classList.remove("hidden");

      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      this.updateEquipmentCollectorOfferUI();
    },

    updateEquipmentCollectorOfferUI() {
      if (!this.inventorySellState?.active || this.currentEvent?.id !== "npcEquipmentCollector") return;
      const offerEl = document.getElementById("event-collector-offer");
      const confirmBtn = document.getElementById("event-collector-confirm");
      if (!offerEl || !confirmBtn) return;
      const selected = typeof this.getSelectedInventorySaleEntry === "function" ? this.getSelectedInventorySaleEntry() : null;
      if (!selected) {
        offerEl.textContent = "No item selected. Click an inventory item to preview sell price.";
        confirmBtn.disabled = true;
        return;
      }
      offerEl.innerHTML = "";
      const strong = document.createElement("strong");
      strong.style.fontWeight = "700";
      strong.appendChild(document.createTextNode(`Offer: ${selected.item.name} (${selected.item.type}) -> `));
      const goldSpan = document.createElement("span");
      goldSpan.style.color = "#facc15";
      goldSpan.textContent = `${selected.price} gold`;
      strong.appendChild(goldSpan);
      offerEl.appendChild(strong);
      confirmBtn.disabled = false;
    },

    openBlacksmithServices() {
      const overlay = document.getElementById("event-overlay");
      const titleEl = document.getElementById("event-title");
      const descEl = document.getElementById("event-desc");
      const choicesEl = document.getElementById("event-choices");
      const merchantPick = document.getElementById("event-merchant-pick");
      const list = document.getElementById("event-invest-list");
      const cancel = document.getElementById("event-invest-cancel");
      if (!overlay || !titleEl || !descEl || !choicesEl || !merchantPick || !list || !cancel) return;

      const candidates = this.inventory.filter((item) =>
        this.isItemEquippable(item) &&
        (item.rarity === "magic" || item.rarity === "rare") &&
        !item.blacksmithUpgraded &&
        Array.isArray(item.modifiers) &&
        item.modifiers.some((m) => Number.isFinite(m?.value))
      );

      this.paused = true;
      this.currentEvent = { id: "npcBlacksmith" };
      titleEl.textContent = "Blacksmith";
      const blacksmithCost = this.resolveNpcServiceCost(100, {
        npcType: "npcBlacksmith",
        service: "upgrade"
      });
      descEl.textContent = `Upgrade one magic/rare inventory item for ${blacksmithCost} gold (+5% to +10% to one random modifier).`;
      choicesEl.classList.add("hidden");
      merchantPick.classList.remove("hidden");
      list.innerHTML = "";

      if (candidates.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No eligible magic/rare inventory items to upgrade.";
        li.style.opacity = "0.85";
        list.appendChild(li);
      } else {
        for (const item of candidates) {
          const li = document.createElement("li");
          li.textContent = `${item.name} (${item.type}) - ${blacksmithCost} gold`;
          li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
          li.addEventListener("mouseleave", hideItemTooltip);
          li.onclick = () => {
            if (!canSpendGold(this, blacksmithCost)) {
              this.showNotification("Blacksmith", "Not enough gold.");
              return;
            }
            const modCandidates = (item.modifiers || []).filter((m) => Number.isFinite(m?.value));
            if (modCandidates.length === 0) {
              this.showNotification("Blacksmith", "This item has no upgradable modifier.");
              return;
            }
            const bonus = 0.05 + Math.random() * 0.05;
            const mod = modCandidates[Math.floor(Math.random() * modCandidates.length)];
            mod.value = Math.round((mod.value + bonus) * 10000) / 10000;
            item.blacksmithUpgraded = true;
            spendGold(this, blacksmithCost, "blacksmith_upgrade", {
              itemId: item.id,
              modifierId: mod.id,
              bonus,
              baseCost: 100
            });
            this.rebuildItemStats(item);
            this.recalculateStats();
            this.updateInventoryUI();
            this.updateEquippedUI();
            this.updateMapUI();
            if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
            this.closeEventOverlay();
            this.showNotification("Blacksmith", `${item.name} upgraded.`);
          };
          list.appendChild(li);
        }
      }

      cancel.onclick = () => {
        this.closeEventOverlay();
      };

      overlay.classList.remove("hidden");
    },

    openRogueVaultTransferUI(obj) {
      const alreadySent = Math.max(0, Math.min(3, obj?.vaultSentCount || 0));
      const rogueVaultCost = this.resolveNpcServiceCost(150, {
        npcType: "npcRogue",
        service: "vault_transfer"
      });
      this.rogueVaultState = { active: true, sent: alreadySent, max: 3, cost: rogueVaultCost, objRef: obj || null };
      this.showInventoryOverlay();
      this.currentEvent = { id: "npcRogueVault" };

      const overlay = document.getElementById("event-overlay");
      const titleEl = document.getElementById("event-title");
      const descEl = document.getElementById("event-desc");
      const choicesEl = document.getElementById("event-choices");
      const merchantPick = document.getElementById("event-merchant-pick");
      if (!overlay || !titleEl || !descEl || !choicesEl || !merchantPick) return;
      const inventoryOverlay = document.getElementById("inventory-overlay");

      this.paused = true;
      overlay.classList.add("rogue-split");
      if (inventoryOverlay) inventoryOverlay.classList.add("rogue-split");
      merchantPick.classList.add("hidden");
      choicesEl.classList.remove("hidden");
      titleEl.textContent = "Rogue";
      descEl.textContent = `Send up to 3 inventory items to Legacy Vault for ${rogueVaultCost} gold each. Sent: ${alreadySent}/3`;
      choicesEl.innerHTML = "";

      const doneBtn = document.createElement("button");
      doneBtn.className = "event-choice-btn";
      doneBtn.textContent = "Done";
      doneBtn.onclick = () => {
        this.rogueVaultState = null;
        if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
        this.closeEventOverlay();
      };
      choicesEl.appendChild(doneBtn);
      overlay.classList.remove("hidden");

      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
    },

    updateRogueVaultOverlayText() {
      if (!this.rogueVaultState?.active) return;
      const descEl = document.getElementById("event-desc");
      if (!descEl) return;
      const sent = this.rogueVaultState.sent || 0;
      const max = this.rogueVaultState.max || 3;
      const cost = this.rogueVaultState.cost || 150;
      descEl.textContent = `Send up to ${max} inventory items to Legacy Vault for ${cost} gold each. Sent: ${sent}/${max}`;
    },

    resolveEventChoice(eventId, choiceId) {
      const overlay = document.getElementById("event-overlay");
      const merchantPick = document.getElementById("event-merchant-pick");
      const choicesEl = document.getElementById("event-choices");
      if (eventId === "merchant" && choiceId === "invest") {
        const equippable = this.inventory.filter((i) => this.isItemEquippable(i) && i.type !== "Upgrade Card");
        if (equippable.length === 0) {
          this.closeEventOverlay();
          return;
        }
        choicesEl.classList.add("hidden");
        merchantPick.classList.remove("hidden");
        const list = document.getElementById("event-invest-list");
        list.innerHTML = "";
        for (const item of equippable) {
          const li = document.createElement("li");
          li.textContent = `${item.name} (${item.type})`;
          li.onclick = () => {
            this.pendingMerchantInvestment = item;
            const idx = this.inventory.indexOf(item);
            this.inventory.splice(idx, 1);
            this.updateInventoryUI();
            this.updateEquippedUI();
            this.recalculateStats();
            merchantPick.classList.add("hidden");
            choicesEl.classList.remove("hidden");
            this.closeEventOverlay();
          };
          list.appendChild(li);
        }
        document.getElementById("event-invest-cancel").onclick = () => {
          merchantPick.classList.add("hidden");
          choicesEl.classList.remove("hidden");
          this.closeEventOverlay();
        };
        return;
      }
      if (eventId === "merchant" && choiceId === "decline") {
        this.closeEventOverlay();
        return;
      }
      if (eventId === "stranger") {
        if (choiceId === "help") {
          this.escortQuest = { active: true, targetMapId: 0 };
          this.updateEscortQuestUI();
        }
        this.closeEventOverlay();
        return;
      }
      if (eventId === "shrine") {
        if (choiceId === "offerXp") {
          const sacrifice = Math.floor(this.xp * 0.3);
          this.xp -= sacrifice;
          this.updateXpUI();
        } else if (choiceId === "destroy") {
          this.inventory = [];
        this.equipment = { Helmet: null, "Body Armour": null, Weapon: null, Boots: null, Ring1: null, Ring2: null };
          this.updateInventoryUI();
          this.updateEquippedUI();
          this.recalculateStats();
          this.lpMultiplier = 2;
        }
        this.closeEventOverlay();
        return;
      }
      if (eventId === "cursedChest") {
        if (choiceId === "open") {
          this.grantEventRareEquipment();
          this.spawnCursedChestEnemy();
          this.cursedChestBlocked = true;
        }
        this.closeEventOverlay();
        return;
      }
      if (eventId === "fiery" && choiceId === "face") {
        this.spawnFiery();
        this.fieryTimer = 30;
        this.closeEventOverlay();
        return;
      }
      this.closeEventOverlay();
    },

    closeEventOverlay() {
      this.paused = false;
      this.currentEvent = null;
      const overlay = document.getElementById("event-overlay");
      const inventoryOverlay = document.getElementById("inventory-overlay");
      const merchantPick = document.getElementById("event-merchant-pick");
      const choicesEl = document.getElementById("event-choices");
      if (overlay) overlay.classList.add("hidden");
      if (overlay) overlay.classList.remove("rogue-split");
      if (inventoryOverlay) inventoryOverlay.classList.remove("rogue-split");
      if (merchantPick) merchantPick.classList.add("hidden");
      if (choicesEl) choicesEl.classList.remove("hidden");
      hideItemTooltip();
    },

    grantEventRareEquipment() {
      const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
      const type = types[Math.floor(Math.random() * types.length)];
      const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
      const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.5, 0.65, null, { difficulty: diff, luck });
      this.inventory.push({
        id: 50000 + Math.floor(Math.random() * 10000),
        name: def.name,
        type: def.type,
        stats: def.stats || {},
        cardKey: null,
        description: "",
        weight: def.weight,
        rarity: def.rarity,
        modifiers: def.modifiers || [],
        baseStat: def.baseStat || null,
        sockets: def.sockets ?? 0,
        vesselsMax: def.vesselsMax ?? 0,
        vessels: Array.isArray(def.vessels) ? def.vessels : []
      });
      this.updateInventoryUI();
    },

    spawnCursedChestEnemy() {
      const margin = this.world.wallThickness + 80;
      const cx = this.world.width / 2 - 30;
      const cy = this.world.height / 2 - 30;
      const typeDef = {
        name: "Cursed Guardian",
        color: "#7c3aed",
        size: 52,
        maxHealth: 200,
        attack: 25,
        speed: 90
      };
      const s = this.currentMap.enemyScale || { hp: 1, attack: 1, speed: 1 };
      typeDef.maxHealth = Math.round(typeDef.maxHealth * (s.hp || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
      typeDef.attack = Math.round(typeDef.attack * (s.attack || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
      typeDef.speed = Math.round(typeDef.speed * (s.speed || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
      const enemy = new Enemy(cx, cy, typeDef);
      enemy.isCursedChestGuardian = true;
      this.enemySystem.enemies.push(enemy);
    },

    spawnFiery() {
      const margin = this.world.wallThickness + 60;
      const x = margin + Math.random() * (this.world.width - margin * 2 - 40);
      const y = margin + Math.random() * (this.world.height - margin * 2 - 40);
      const typeDef = {
        name: "Golden Fiery",
        color: "#fbbf24",
        size: 36,
        maxHealth: 80,
        attack: 12,
        speed: 140
      };
      const s = this.currentMap.enemyScale || { hp: 1, attack: 1, speed: 1 };
      typeDef.maxHealth = Math.round(typeDef.maxHealth * (s.hp || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
      typeDef.attack = Math.round(typeDef.attack * (s.attack || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
      typeDef.speed = Math.round(typeDef.speed * (s.speed || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
      const enemy = new Enemy(x, y, typeDef);
      enemy.isFiery = true;
      enemy.wanderDirection = new Vec2(Math.random() - 0.5, Math.random() - 0.5);
      enemy.wanderTimer = 0;
      enemy.worldBounds = { width: this.world.width, height: this.world.height };
      this.enemySystem.enemies.push(enemy);
      this.fierySpawned = true;
    },

    resolveStrangerQuest() {
      this.escortQuest = null;
      this.updateEscortQuestUI();
      const cx = this.world.width / 2 - 20;
      const cy = this.world.height / 2 - 20;
      const rewardType = Math.random() < 0.5 ? "high" : "low";
      if (rewardType === "high") {
        this.lootSystem.spawnBurstAt(cx, cy, 4, 0.9);
        this.grantXP(80);
        this.showNotification("Quest Complete!", "You successfully escorted the stranger home! They reward you with valuable treasures and 80 XP.");
      } else {
        this.lootSystem.spawnBurstAt(cx, cy, 3, 0.5);
        this.grantXP(40);
        this.showNotification("Quest Complete!", "You successfully escorted the stranger home! They reward you with treasures and 40 XP.");
      }
    },

    interactWithMapObject(obj) {
      if (obj.type === "nodeExitPortal") {
        this.nodeX = obj.targetNodeX;
        this.nodeY = obj.targetNodeY;
        this.enterNode?.();
        return;
      }
      if (obj?.type && String(obj.type).startsWith("npc")) {
        onRingNpcInteracted(this, obj);
      }
      if (obj.type === "npcOldWoman") {
        this.offerMysteriousOldWomanItems(obj);
      } else if (obj.type === "npcOldMan") {
        this.offerMysteriousOldManUpgrades(obj);
      } else if (obj.type === "npcPriest") {
        this.openPriestServices();
      } else if (obj.type === "npcSchemaMonk") {
        this.openSchemaMonkSacrifice(obj);
      } else if (obj.type === "npcElderSchemaMonk") {
        this.openElderSchemaMonkSacrifice(obj);
      } else if (obj.type === "npcEquipmentCollector") {
        this.openEquipmentCollectorUI(obj);
      } else if (obj.type === "npcBlacksmith") {
        this.openBlacksmithServices();
      } else if (obj.type === "npcRogue") {
        this.openRogueVaultTransferUI(obj);
      } else if (obj.type === "socketWorkshop") {
        for (const slot of Object.keys(this.equipment || {})) {
          const item = this.equipment[slot];
          if (item && (item.sockets ?? 0) < 2) {
            const add = 1;
            item.sockets = Math.min(3, (item.sockets ?? 0) + add);
            this.rebuildItemStats(item);
            this.recalculateStats();
            this.updateEquippedUI();
            break;
          }
        }
      } else if (obj.type === "foresightShrine") {
        for (const slot of Object.keys(this.equipment || {})) {
          const item = this.equipment[slot];
          if (item) {
            item.modifiers = item.modifiers || [];
            if (!item.modifiers.some((m) => m.id === "foresight")) {
              item.modifiers.push({ id: "foresight", label: "Foresight", statKey: null, value: 0, addedAt: Date.now() });
              this.rebuildItemStats(item);
              this.recalculateStats();
              this.updateEquippedUI();
              break;
            }
          }
        }
      } else if (obj.type === "perfectionWorkshop") {
        for (const slot of Object.keys(this.equipment || {})) {
          const item = this.equipment[slot];
          if (item && item.modifiers?.length > 0) {
            const idx = Math.floor(Math.random() * item.modifiers.length);
            if (!LEGENDARY_MODIFIER_IDS.includes(item.modifiers[idx].id)) {
              item.modifiers[idx].value = 0.45 + Math.random() * 0.05;
              this.rebuildItemStats(item);
              this.recalculateStats();
              this.updateEquippedUI();
            }
            break;
          }
        }
      } else if (obj.type === "shrine" && !obj.used) {
        this.openShrineInteraction(obj);
      } else if (obj.type === "restSnackStand") {
        if (obj.used) return;
        if (!this.runSnackId) return;
        const snackDef = getSnackById(this.runSnackId);
        const maxUses = Math.max(0, Number(snackDef?.maxUses) || 0);
        const currentUses = Math.max(0, Number(this.snackUsesRemaining) || 0);
        if (maxUses <= 0 || currentUses >= maxUses) return;
        this.snackUsesRemaining = maxUses;
        obj.used = true;
        this.updateMapUI?.();
        if (typeof this.addFloatingText === "function") {
          const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
          const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
          this.addFloatingText(px, py, "Snack Refilled!", "heal");
        }
      } else if (obj.type === "restUpgradeVendor") {
        this.openRestRoomUpgradeVendor(obj);
      } else if (obj.type === "restUpgradeReforge") {
        this.openRestRoomUpgradeReforge(obj);
      } else if (obj.type === "restAttributes") {
        this.openRestRoomAttributes(obj);
      } else if (obj.type === "restRoomExit") {
        const next = this.pendingRestRoomExit;
        if (next && isRestRoomMapId(this.currentMapId)) {
          this.pendingRestRoomExit = null;
          this.transitionToMap(next.targetMapId, next.spawnSide || "left");
        }
      }
    },

    removeUpgradeById(upgradeId) {
      if (!this.runAttackUpgrades) return null;
      // Find the last occurrence (most recent)
      let lastIndex = -1;
      for (let i = this.runAttackUpgrades.length - 1; i >= 0; i--) {
        if (this.runAttackUpgrades[i].id === upgradeId) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex === -1) return null;
      const removed = this.runAttackUpgrades[lastIndex];
      this.runAttackUpgrades.splice(lastIndex, 1);
      if (this.buildLogRefresh) this.buildLogRefresh();
      return removed;
    },

    removePenaltyById(penaltyId) {
      if (!this.runAttackPenalties) return null;
      // Find the last occurrence (most recent)
      let lastIndex = -1;
      for (let i = this.runAttackPenalties.length - 1; i >= 0; i--) {
        if (this.runAttackPenalties[i].id === penaltyId) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex === -1) return null;
      const removed = this.runAttackPenalties[lastIndex];
      this.runAttackPenalties.splice(lastIndex, 1);
      if (this.buildLogRefresh) this.buildLogRefresh();
      return removed;
    },

    getStandardUpgrades() {
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      if (!defs) return [];
      return (this.runAttackUpgrades || []).filter(u => {
        const def = (defs.standardUpgrades || []).find(su => su.id === u.id);
        return def !== undefined;
      });
    },

    getStandardPenalties() {
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      if (!defs) return [];
      return (this.runAttackPenalties || []).filter(p => {
        const def = (defs.standardPenalties || []).find(sp => sp.id === p.id);
        return def !== undefined;
      });
    },

    addShrineInteraction(shrineName, message) {
      if (!this.shrineInteractions) this.shrineInteractions = [];
      this.shrineInteractions.push({ shrineName, message, time: this.time });
      if (this.buildLogRefresh) this.buildLogRefresh();
    },

    openShrineInteraction(shrineObj) {
      this.currentShrine = shrineObj;
      const overlay = document.getElementById("shrine-overlay");
      const titleEl = document.getElementById("shrine-title");
      const descEl = document.getElementById("shrine-desc");
      const upgradeSelect = document.getElementById("shrine-upgrade-select");
      const penaltySelect = document.getElementById("shrine-penalty-select");
      const upgradeList = document.getElementById("shrine-upgrade-list");
      const penaltyList = document.getElementById("shrine-penalty-list");
      const confirmBtn = document.getElementById("shrine-confirm");
      const cancelBtn = document.getElementById("shrine-cancel");

      if (!overlay || !titleEl || !descEl) return;

      const shrineDef = SHRINE_DEFS.find((entry) => entry?.id === shrineObj?.shrineId) || null;
      if (shrineDef?.disabled) {
        titleEl.textContent = shrineObj.shrineName || shrineDef.name;
        descEl.textContent = shrineDef.description || "This shrine is disabled.";
        overlay.classList.remove("hidden");
        upgradeSelect.classList.add("hidden");
        penaltySelect.classList.add("hidden");
        upgradeList.innerHTML = "";
        penaltyList.innerHTML = "";
        confirmBtn.disabled = true;
        const handleClose = () => {
          overlay.classList.add("hidden");
          this.currentShrine = null;
          this.selectedUpgradeId = null;
          this.selectedPenaltyId = null;
          cancelBtn.removeEventListener("click", handleClose);
        };
        cancelBtn.addEventListener("click", handleClose);
        return;
      }

      titleEl.textContent = shrineObj.shrineName;
      descEl.textContent = shrineObj.shrineDescription;
      overlay.classList.remove("hidden");
      upgradeSelect.classList.add("hidden");
      penaltySelect.classList.add("hidden");
      upgradeList.innerHTML = "";
      penaltyList.innerHTML = "";
      this.selectedUpgradeId = null;
      this.selectedPenaltyId = null;

      // Setup confirm/cancel buttons
      const handleConfirm = () => {
        // Check if selection is required and made
        if (shrineObj.shrineId === "purification" && !this.selectedPenaltyId) return;
        if (["frenzy", "restoration", "trial"].includes(shrineObj.shrineId) && !this.selectedUpgradeId) return;
        
        if (this.currentShrine && !this.currentShrine.used) {
          this.executeShrineEffect(this.currentShrine);
          this.currentShrine.used = true;
        }
        overlay.classList.add("hidden");
        this.currentShrine = null;
        this.selectedUpgradeId = null;
        this.selectedPenaltyId = null;
        confirmBtn.removeEventListener("click", handleConfirm);
        cancelBtn.removeEventListener("click", handleCancel);
      };

      const handleCancel = () => {
        overlay.classList.add("hidden");
        this.currentShrine = null;
        this.selectedUpgradeId = null;
        this.selectedPenaltyId = null;
        confirmBtn.removeEventListener("click", handleConfirm);
        cancelBtn.removeEventListener("click", handleCancel);
      };

      confirmBtn.disabled = true;
      if (!["purification", "frenzy", "restoration", "trial"].includes(shrineObj.shrineId)) {
        confirmBtn.disabled = false; // No selection needed for chaos/ascension
      }
      
      confirmBtn.addEventListener("click", handleConfirm);
      cancelBtn.addEventListener("click", handleCancel);

      // Show selection UI based on shrine type
      if (shrineObj.shrineId === "purification") {
        // Show penalty selection
        const standardPenalties = this.getStandardPenalties();
        if (standardPenalties.length === 0) {
          handleCancel();
          return;
        }
        penaltySelect.classList.remove("hidden");
        const uniquePenalties = new Set();
        standardPenalties.forEach(p => {
          if (!uniquePenalties.has(p.id)) {
            uniquePenalties.add(p.id);
            const li = document.createElement("li");
            li.textContent = `spr_ui_sword ${p.name}`;
            li.dataset.penaltyId = p.id;
            li.addEventListener("click", () => {
              penaltyList.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
              li.classList.add("selected");
              this.selectedPenaltyId = p.id;
              confirmBtn.disabled = false;
            });
            penaltyList.appendChild(li);
          }
        });
      } else if (["frenzy", "restoration", "trial"].includes(shrineObj.shrineId)) {
        // Show upgrade selection
        const upgrades = this.runAttackUpgrades || [];
        if (upgrades.length === 0) {
          handleCancel();
          return;
        }
        upgradeSelect.classList.remove("hidden");
        const uniqueUpgrades = new Set();
        upgrades.forEach(u => {
          if (!uniqueUpgrades.has(u.id)) {
            uniqueUpgrades.add(u.id);
            const li = document.createElement("li");
            const defs = ATTACK_UPGRADE_DEFS[this.attackType];
            const def = defs ? [...(defs.standardUpgrades || []), ...(defs.uniqueUpgrades || [])].find(d => d.id === u.id) : null;
            li.textContent = `spr_ui_sword ${u.name}`;
            li.dataset.upgradeId = u.id;
            li.addEventListener("click", () => {
              upgradeList.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
              li.classList.add("selected");
              this.selectedUpgradeId = u.id;
              confirmBtn.disabled = false;
            });
            upgradeList.appendChild(li);
          }
        });
      }
    },

    executeShrineEffect(shrineObj) {
      const shrineId = shrineObj.shrineId;
      
      if (shrineId === "purification") {
        // Remove chosen standard penalty and random standard upgrade
        if (!this.selectedPenaltyId) return;
        const removedPenalty = this.removePenaltyById(this.selectedPenaltyId);
        const standardUpgrades = this.getStandardUpgrades();
        if (standardUpgrades.length > 0) {
          const randomUpgrade = standardUpgrades[Math.floor(Math.random() * standardUpgrades.length)];
          const removedUpgrade = this.removeUpgradeById(randomUpgrade.id);
          const penaltyName = removedPenalty ? removedPenalty.name : "Unknown";
          const upgradeName = removedUpgrade ? removedUpgrade.name : "Unknown";
          this.addShrineInteraction(shrineObj.shrineName, `Removed penalty: ${penaltyName}. Removed upgrade: ${upgradeName}.`);
        } else {
          const penaltyName = removedPenalty ? removedPenalty.name : "Unknown";
          this.addShrineInteraction(shrineObj.shrineName, `Removed penalty: ${penaltyName}. No standard upgrades to remove.`);
        }
      } else if (shrineId === "chaos") {
        // Add two random standard upgrades, remove one random upgrade
        const defs = ATTACK_UPGRADE_DEFS[this.attackType];
        if (!defs) return;
        const standardPool = (defs.standardUpgrades || []).filter(u => {
          const taken = (this.runAttackUpgrades || []).map(up => up.id);
          return !taken.includes(u.id);
        });
        const added = [];
        for (let i = 0; i < 2 && standardPool.length > 0; i++) {
          const def = standardPool[Math.floor(Math.random() * standardPool.length)];
          const value = rollUpgradeValue(def);
          this.runAttackUpgrades.push({
            id: def.id,
            name: def.name,
            description: def.description,
            value: value,
            percent: !!def.valueRange?.percent
          });
          added.push(def.name);
          standardPool.splice(standardPool.indexOf(def), 1);
        }
        const allUpgrades = this.runAttackUpgrades || [];
        if (allUpgrades.length > 0) {
          const randomUpgrade = allUpgrades[Math.floor(Math.random() * allUpgrades.length)];
          const removed = this.removeUpgradeById(randomUpgrade.id);
          const removedName = removed ? removed.name : "Unknown";
          this.addShrineInteraction(shrineObj.shrineName, `Added upgrades: ${added.join(", ")}. Removed upgrade: ${removedName}.`);
        } else {
          this.addShrineInteraction(shrineObj.shrineName, `Added upgrades: ${added.join(", ")}.`);
        }
        if (this.buildLogRefresh) this.buildLogRefresh();
      } else if (shrineId === "frenzy") {
        // Remove chosen upgrade, gain buffs for 30s
        if (!this.selectedUpgradeId) return;
        const removed = this.removeUpgradeById(this.selectedUpgradeId);
        if (removed) {
          this.frenzyBuffUntil = this.time + 30;
          this.addShrineInteraction(shrineObj.shrineName, `Removed upgrade: ${removed.name}. Gained 40% movement speed, 30% attack speed, and 20% XP for 30 seconds.`);
        }
      } else if (shrineId === "ascension") {
        // Transform random standard upgrade to unique upgrade
        const standardUpgrades = this.getStandardUpgrades();
        if (standardUpgrades.length === 0) {
          this.addShrineInteraction(shrineObj.shrineName, "No standard upgrades to transform.");
          return;
        }
        const randomUpgrade = standardUpgrades[Math.floor(Math.random() * standardUpgrades.length)];
        const defs = ATTACK_UPGRADE_DEFS[this.attackType];
        if (!defs) return;
        const takenUnique = new Set((this.runAttackUpgrades || []).map(u => u.id));
        const uniquePool = (defs.uniqueUpgrades || []).filter(u => !takenUnique.has(u.id));
        if (uniquePool.length === 0) {
          this.addShrineInteraction(shrineObj.shrineName, `No unique upgrades available.`);
          return;
        }
        const newUnique = uniquePool[Math.floor(Math.random() * uniquePool.length)];
        this.removeUpgradeById(randomUpgrade.id);
        this.runAttackUpgrades.push({
          id: newUnique.id,
          name: newUnique.name,
          description: newUnique.description,
          value: undefined,
          percent: false
        });
        this.addShrineInteraction(shrineObj.shrineName, `Transformed ${randomUpgrade.name} into ${newUnique.name}.`);
        if (this.buildLogRefresh) this.buildLogRefresh();
      } else if (shrineId === "restoration") {
        // Remove chosen upgrade, restore full health
        if (!this.selectedUpgradeId) return;
        const removed = this.removeUpgradeById(this.selectedUpgradeId);
        if (removed) {
          this.currentHealth = this.currentStats.maxHealth;
          this.addShrineInteraction(shrineObj.shrineName, `Removed upgrade: ${removed.name}. Health restored to full.`);
        }
      } else if (shrineId === "trial") {
        // Remove chosen upgrade, spawn two mini-bosses
        if (!this.selectedUpgradeId) return;
        const removed = this.removeUpgradeById(this.selectedUpgradeId);
        if (removed) {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          this.trialBosses = [];
          this.trialTimer = 30;
          this.trialCompleted = false;
          for (let i = 0; i < 2; i++) {
            const enemy = this.enemySystem.spawnOne("miniBoss", null, { x: px, y: py });
            if (enemy) {
              this.trialBosses.push(enemy.id);
              this.enemySystem.enemies.push(enemy);
            }
          }
          this.addShrineInteraction(shrineObj.shrineName, `Removed upgrade: ${removed.name}. Two mini-bosses summoned. Defeat both within 30 seconds to earn 1 Legacy Point.`);
        }
      }
    }
  });
}
