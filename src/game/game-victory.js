// -------- Game Victory Methods Mixin --------
// Game over, victory screens, save character
// This module adds methods to Game.prototype when imported

import { refreshMainMenuLP } from '../ui/main-menu.js';
import { loadSavedCharacters, addConquerorBonusItem, addToLegacyCubeStash, addToLegacyAncestorStash, ETERNAL_ITEMS_ON_DEFEAT_KEY, SAVE_KEY, updateSavedCharacter } from '../ui/save-system.js';
import { getDefaultAttributes, WOUND_MAX_STACKS } from '../data/character-attributes.js';
import { addGlobalTalentCrystal, getHighestAttributeCrystalReward } from '../data/crystals.js';
import { renderHallOfChampions } from '../ui/hall-of-champions.js';
import { hasTalent } from '../data/talents.js';
import {
  getModifierPoolForType,
  LOCAL_STAT_SCALE_MOD_IDS,
  rollLocalStatScaleValueForDifficulty,
  rollModifierValueForDifficulty
} from '../data/loot-data.js';
import { getGold } from './economy.js';
import { handleArchivistOnExtraction, handleHeirloomOnDefeat } from './ring-effects.js';
import { stopBgm } from '../audio.js';

function formatCrystalRewardText(reward) {
  if (!reward?.crystalId || !reward?.attributeId) return "Crystal Reward: None";
  const crystalName = String(reward.crystalId).charAt(0).toUpperCase() + String(reward.crystalId).slice(1);
  const attributeName = String(reward.attributeId).charAt(0).toUpperCase() + String(reward.attributeId).slice(1);
  return `Crystal Reward: +1 ${crystalName} Crystal (${attributeName})`;
}

export function applyGameVictoryMixin(Game) {
  Object.assign(Game.prototype, {
    transferRunCubesToLegacyVaultOnExtraction() {
      if (this._extractionCubesTransferred) return;
      const cubes = this.cubeInventory || {};
      for (const [cubeKey, rawCount] of Object.entries(cubes)) {
        const count = Math.max(0, Number(rawCount) || 0);
        for (let i = 0; i < count; i++) {
          addToLegacyCubeStash(cubeKey);
        }
      }
      this._extractionCubesTransferred = true;
    },

    transferRunAncestorsToLegacyVaultOnExtraction() {
      if (this._extractionAncestorsTransferred) return;
      const runInv = this.runInventory || {};
      const registry = runInv.ancestorSpiritRegistry || {};
      const ownedIds = new Set();

      for (const spirit of runInv.ancestorSpirits || []) {
        if (spirit?.id) ownedIds.add(spirit.id);
      }
      for (const item of Object.values(this.equipment || {})) {
        if (!item || !Array.isArray(item.vessels)) continue;
        for (const vessel of item.vessels) {
          if (vessel?.spiritId) ownedIds.add(vessel.spiritId);
        }
      }

      for (const spiritId of ownedIds) {
        const spirit = registry[spiritId];
        if (!spirit?.defId) continue;
        addToLegacyAncestorStash(spirit);
      }
      this._extractionAncestorsTransferred = true;
    },

    applyLootTranscendenceOnExtraction() {
      if (!this.hasRunTalent("lootTranscendence")) return;
      const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const tryUpgrade = (item) => {
        if (!item || item.type === "Upgrade Card" || item.type === "Cube") return;
        const rarity = item.rarity || "common";
        const upgradeToMagic = (rarity === "common" || rarity === "normal") && Math.random() < 0.2;
        const upgradeToRare = rarity === "magic" && Math.random() < 0.1;
        if (!upgradeToMagic && !upgradeToRare) return;

        if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("lootTranscendence", `Extraction: item rarity upgraded to ${upgradeToRare ? "rare" : "magic"}`);
        item.rarity = upgradeToRare ? "rare" : "magic";
        item.modifiers = item.modifiers || [];
        const pool = getModifierPoolForType(item.type) || [];
        const targetModifierCount = item.rarity === "magic" ? 1 : 2;
        const needed = Math.max(0, targetModifierCount - item.modifiers.length);
        for (let i = 0; i < needed; i++) {
          const available = pool.filter((p) => !item.modifiers.some((m) => m.id === p.id));
          if (available.length === 0) break;
          const mod = available[Math.floor(Math.random() * available.length)];
          const value = LOCAL_STAT_SCALE_MOD_IDS.includes(mod.id)
            ? rollLocalStatScaleValueForDifficulty(diff)
            : rollModifierValueForDifficulty(diff);
          item.modifiers.push({
            id: mod.id,
            label: mod.label,
            statKey: mod.statKey,
            rarity: mod.rarity || "normal",
            value,
            addedAt: Date.now()
          });
        }
        if (typeof this.rebuildItemStats === "function") this.rebuildItemStats(item);
      };

      for (const item of Object.values(this.equipment || {})) tryUpgrade(item);
      for (const item of this.inventory || []) tryUpgrade(item);
    },

    showGameOver() {
      handleHeirloomOnDefeat(this);
      if (typeof this.transferVaultMasterSecuredItemsOnDeath === "function") {
        this.transferVaultMasterSecuredItemsOnDeath();
      }
      this.gameOver = true;
      this.gold = 0;
      const eternalItems = [];
      const hasEternal = (item) => item?.modifiers?.some((m) => m.id === "eternal");
      for (const [slot, item] of Object.entries(this.equipment)) {
        if (item && hasEternal(item)) eternalItems.push({ item: JSON.parse(JSON.stringify(item)), source: "equipped", slot });
      }
      for (const item of this.inventory) {
        if (item && item.type !== "Upgrade Card" && hasEternal(item)) eternalItems.push({ item: JSON.parse(JSON.stringify(item)), source: "inventory" });
      }
      if (eternalItems.length > 0) {
        try {
          const existing = JSON.parse(localStorage.getItem(ETERNAL_ITEMS_ON_DEFEAT_KEY) || "[]");
          existing.push(...eternalItems.map((e) => e.item));
          localStorage.setItem(ETERNAL_ITEMS_ON_DEFEAT_KEY, JSON.stringify(existing));
        } catch (_) {}
      }

      const charIndex = this.runConfig?.selectedCharacterIndex;
      if (charIndex != null && typeof charIndex === "number") {
        const saved = loadSavedCharacters();
        const char = saved[charIndex];
        if (char && !char.dead) {
          const currentWounds = Math.max(0, Number(char.wounds) || 0);
          const newWounds = Math.min(WOUND_MAX_STACKS, currentWounds + 1);
          const isDead = newWounds >= WOUND_MAX_STACKS;
          updateSavedCharacter(charIndex, { wounds: newWounds, dead: isDead });
        }
      }
      
      // Update game over panel stats
      if (this.gameOverMapsEl) {
        this.gameOverMapsEl.textContent = this.visitedMaps.size;
      }
      if (this.gameOverEnemiesEl) {
        this.gameOverEnemiesEl.textContent = this.enemiesKilled;
      }
      if (this.gameOverLevelEl) {
        this.gameOverLevelEl.textContent = this.level;
      }
      
      if (this.gameOverEl) {
        this.gameOverEl.classList.remove("hidden");
        // Force inline styles to ensure proper positioning (CSS wasn't applying correctly)
        this.gameOverEl.style.position = 'fixed';
        this.gameOverEl.style.top = '0';
        this.gameOverEl.style.left = '0';
        this.gameOverEl.style.right = '0';
        this.gameOverEl.style.bottom = '0';
        this.gameOverEl.style.width = '100vw';
        this.gameOverEl.style.height = '100vh';
        this.gameOverEl.style.display = 'flex';
        this.gameOverEl.style.alignItems = 'center';
        this.gameOverEl.style.justifyContent = 'center';
        this.gameOverEl.style.margin = '0';
        this.gameOverEl.style.padding = '0';
        this.gameOverEl.style.zIndex = '60';
      }
    },

    showVictory() {
      this.gameOver = true;
      const el = document.getElementById("victory-overlay");
      if (el) {
        el.classList.remove("hidden");
        this.populateVictorySummary();
      }
    },

    populateVictorySummary() {
      const gold = getGold(this);
      const reward = this._previewTalentCrystalReward
        || getHighestAttributeCrystalReward(this.runCharacterAttributes || this.runConfig?.selectedCharacter?.attributes || null);
      this._previewTalentCrystalReward = reward || null;

      const goldEl = document.getElementById("victory-gold");
      if (goldEl) goldEl.textContent = `Gold: ${gold}`;
      const crystalRewardEl = document.getElementById("victory-crystal-reward");
      if (crystalRewardEl) crystalRewardEl.textContent = formatCrystalRewardText(reward);

      const equippedEl = document.getElementById("victory-equipped");
      const statsEl = document.getElementById("victory-stats");
      if (equippedEl) {
        equippedEl.innerHTML = "";
        for (const [slot, item] of Object.entries(this.equipment)) {
          const div = document.createElement("div");
          div.textContent = `${slot}: ${item ? item.name : "None"}`;
          equippedEl.appendChild(div);
        }
      }
      if (statsEl) {
        statsEl.innerHTML = "";
        const rows = [
          ["Level", `${this.level}`],
          ["Difficulty", `${this.difficulty}`],
          ["Health", `${this.currentStats.maxHealth}`],
          ["Defense", `${this.currentStats.defense}`],
          ["Speed", `${this.currentStats.speed}`],
          ["Attack", `${this.currentStats.attack}`]
        ];
        for (const [label, value] of rows) {
          const div = document.createElement("div");
          div.textContent = `${label}: ${value}`;
          statsEl.appendChild(div);
        }
      }
    },

    applyCuratorCubeUpgradeOnExtraction() {
      if (!this.hasRunTalent("curator")) return;
      if (!this.cubeInventory) return;
      const snapshot = Object.entries(this.cubeInventory);
      const addMap = {};
      const subMap = {};
      for (const [key, rawCount] of snapshot) {
        const count = Number(rawCount) || 0;
        if (count <= 0) continue;
        const m = key.match(/^(.+)T([123])$/);
        if (!m) continue;
        const base = m[1];
        const tier = Number(m[2]);
        if (tier !== 1 && tier !== 2) continue;
        const chance = tier === 1 ? 0.2 : 0.1;
        let upgrades = 0;
        for (let i = 0; i < count; i++) {
          if (Math.random() < chance) upgrades++;
        }
        if (upgrades <= 0) continue;
        if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("curator", `Extraction: ${upgrades} cube(s) upgraded T${tier}→T${tier + 1}`);
        const toKey = `${base}T${tier + 1}`;
        subMap[key] = (subMap[key] || 0) + upgrades;
        addMap[toKey] = (addMap[toKey] || 0) + upgrades;
      }
      for (const [k, v] of Object.entries(subMap)) {
        this.cubeInventory[k] = Math.max(0, (this.cubeInventory[k] || 0) - v);
        if (this.cubeInventory[k] === 0) delete this.cubeInventory[k];
      }
      for (const [k, v] of Object.entries(addMap)) {
        this.cubeInventory[k] = (this.cubeInventory[k] || 0) + v;
      }
    },

    grantTalentCrystalOnExtraction() {
      if (this._extractionTalentCrystalGranted) return null;
      const reward = this._previewTalentCrystalReward
        || getHighestAttributeCrystalReward(this.runCharacterAttributes || this.runConfig?.selectedCharacter?.attributes || null);
      if (!reward?.crystalId) return null;
      addGlobalTalentCrystal(reward.crystalId, 1);
      this._previewTalentCrystalReward = reward;
      this._extractionTalentCrystalGranted = true;
      return reward;
    },

    saveCharacterAndReturnToMenu() {
      handleArchivistOnExtraction(this);
      this.applyCuratorCubeUpgradeOnExtraction();
      this.applyLootTranscendenceOnExtraction();
      this.grantTalentCrystalOnExtraction();
      this.transferRunCubesToLegacyVaultOnExtraction();
      this.transferRunAncestorsToLegacyVaultOnExtraction();
      const nameInput = document.getElementById("victory-char-name");
      const name = (nameInput && nameInput.value.trim()) || "Champion";
      const saveData = {
        name,
        level: this.level,
        difficulty: this.difficulty,
        attributes: getDefaultAttributes(),
        wounds: 0,
        dead: false,
        talents: [],
        equipment: JSON.parse(JSON.stringify(this.equipment)),
        inventory: JSON.parse(JSON.stringify(this.inventory)),
        cubeInventory: JSON.parse(JSON.stringify(this.cubeInventory)),
        stats: { ...this.currentStats },
        savedAt: Date.now()
      };
      const saved = loadSavedCharacters();
      const charIndex = this.runConfig?.selectedCharacterIndex;
      if (charIndex != null && typeof charIndex === "number" && saved[charIndex] && !saved[charIndex].dead) {
        const char = saved[charIndex];
        const newWounds = Math.max(0, (Number(char.wounds) || 0) - 1);
        updateSavedCharacter(charIndex, {
          name,
          level: this.level,
          difficulty: this.difficulty,
          equipment: saveData.equipment,
          inventory: saveData.inventory,
          cubeInventory: saveData.cubeInventory,
          stats: saveData.stats,
          savedAt: saveData.savedAt,
          wounds: newWounds
        });
      } else {
        saved.push(saveData);
        localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
      }
      this.destroy();
      stopBgm();
      document.getElementById("victory-overlay")?.classList.add("hidden");
      const onReturnToHomeBase = this.runConfig?.onReturnToHomeBase;
      if (typeof onReturnToHomeBase === "function") {
        onReturnToHomeBase({ reason: "victory" });
        return;
      }

      document.getElementById("main-menu")?.classList.remove("hidden");
      document.querySelector(".game-root")?.classList.add("hidden");
      refreshMainMenuLP();
      document.getElementById("pause-toggle")?.classList.add("hidden");
      document.getElementById("mod-screen-button")?.classList.add("hidden");
      document.getElementById("dev-toggle")?.classList.add("hidden");
      renderHallOfChampions();
    }
  });
}
