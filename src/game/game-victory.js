// -------- Game Victory Methods Mixin --------
// Game over, victory screens, save character
// This module adds methods to Game.prototype when imported

import { refreshMainMenuLP } from '../ui/main-menu.js';
import { addConquerorBonusItem, addToLegacyCubeStash, addToLegacyAncestorStash, ETERNAL_ITEMS_ON_DEFEAT_KEY } from '../ui/save-system.js';
import { addBasicAttackXp, grantWeaponArtRunRewards, hasPendingWeaponArtChoices } from '../data/basic-attack-progression.js';
import { renderHallOfChampions } from '../ui/hall-of-champions.js';
import { hasTalent } from '../data/talents.js';
import { openWeaponArtDraftOverlay } from '../ui/weapon-art-draft-ui.js';
import {
  getModifierPoolForType,
  LOCAL_STAT_SCALE_MOD_IDS,
  rollLocalStatScaleValueForDifficulty,
  rollModifierValueForDifficulty
} from '../data/loot-data.js';
import { getGold } from './economy.js';
import { handleArchivistOnExtraction, handleHeirloomOnDefeat } from './ring-effects.js';
import { stopBgm } from '../audio.js';

export function applyGameVictoryMixin(Game) {
  Object.assign(Game.prototype, {
    persistBasicAttackXpOnRunEnd(summary = {}) {
      if (this._basicAttackXpPersisted) return null;
      const attackType = this.attackType || null;
      const xp = Math.max(0, Number(this.runAttackXpEarned) || 0);
      this._basicAttackXpPersisted = true;
      const next = attackType && xp > 0 ? addBasicAttackXp(attackType, xp) : null;
      const tokenRewards = grantWeaponArtRunRewards({
        difficulty: this.difficulty,
        mapsCleared: this.visitedMaps?.size || 0,
        enemiesKilled: this.enemiesKilled || 0,
        victory: !!summary?.victory,
        bossKill: !!summary?.bossKill
      });
      this.attackProgressLevel = next?.level ?? this.attackProgressLevel;
      this.attackProgressXp = next?.xp ?? this.attackProgressXp;
      this.attackProgressPendingPicks = next?.pendingPickCount ?? this.attackProgressPendingPicks;
      this.lastWeaponArtTokenRewards = tokenRewards?.rewards || {};
      this.lastWeaponArtTokenInventory = tokenRewards?.inventory || null;
      if (next) {
        next.tokenRewards = tokenRewards?.rewards || {};
      }
      return next;
    },

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
      this.persistBasicAttackXpOnRunEnd({ victory: false, bossKill: false });
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
      if (hasPendingWeaponArtChoices()) {
        openWeaponArtDraftOverlay({ preferredAttackType: this.attackType });
      }
    },

    showVictory() {
      this.persistBasicAttackXpOnRunEnd({ victory: true, bossKill: true });
      this.gameOver = true;
      const el = document.getElementById("victory-overlay");
      if (el) {
        el.classList.remove("hidden");
        this.populateVictorySummary();
      }
      if (hasPendingWeaponArtChoices()) {
        openWeaponArtDraftOverlay({ preferredAttackType: this.attackType });
      }
    },

    populateVictorySummary() {
      const gold = getGold(this);

      const goldEl = document.getElementById("victory-gold");
      if (goldEl) goldEl.textContent = `Gold: ${gold}`;
      const crystalRewardEl = document.getElementById("victory-crystal-reward");
      if (crystalRewardEl) crystalRewardEl.textContent = "Each level now grants 1 attribute point and 1 talent point.";

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

    saveCharacterAndReturnToMenu() {
      this.persistBasicAttackXpOnRunEnd({ victory: true, bossKill: true });
      handleArchivistOnExtraction(this);
      this.applyCuratorCubeUpgradeOnExtraction();
      this.applyLootTranscendenceOnExtraction();
      this.transferRunCubesToLegacyVaultOnExtraction();
      this.transferRunAncestorsToLegacyVaultOnExtraction();
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
      document.getElementById("dev-toggle")?.classList.add("hidden");
      renderHallOfChampions();
    }
  });
}
