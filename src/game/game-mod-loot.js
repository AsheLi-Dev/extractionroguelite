// -------- Skill mod drops and run mod state --------
// Mod card drops from enemies, Mod Pack inventory, equip/unequip, salvage.

import { LootItem } from '../entities/loot.js';
import {
  getRandomMod,
  getSkillModById,
  getModsCompatibleWithSkill,
  getEquippedSkillIds
} from '../data/skill-mods.js';
import { getSkillById } from '../data/skills.js';
import { getModSlotsForSkillLevel, getSkillLevel } from '../data/constants.js';

const MOD_PACK_MAX = 8;
const MOD_DROPS_CAP_PER_ROOM = 2;
const MOD_DROPS_CAP_PER_MINUTE = 3;
const MOD_PITY_ELITES_WITHOUT_DROP = 3;
const MOD_REROLL_SHARD_COST = 2;

// Minion: 0.5–1% base chance; rarity 80% common, 18% rare, 2% epic
const MINION_MOD_DROP_CHANCE = 0.008;
const MINION_RARITY_WEIGHTS = { common: 80, rare: 18, epic: 2 };
// Elite: 25–40% base; 50% common, 35% rare, 12% epic, 3% legendary
const ELITE_MOD_DROP_CHANCE = 0.32;
const ELITE_RARITY_WEIGHTS = { common: 50, rare: 35, epic: 12, legendary: 3 };
// Miniboss: guaranteed 1 drop, 30% second; 30% rare, 50% epic, 20% legendary
const MINIBOSS_SECOND_MOD_CHANCE = 0.3;
const MINIBOSS_RARITY_WEIGHTS = { rare: 30, epic: 50, legendary: 20 };
// Boss: 2–3 rolls epic+; simplified: 2 guaranteed epic+
const BOSS_MOD_ROLLS = 2;
const BOSS_RARITY_WEIGHTS = { rare: 20, epic: 50, legendary: 30 };

function rollRarity(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of entries) {
    r -= w;
    if (r <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

function getEnemyTier(enemy) {
  if (enemy.enemyTier === 'boss' || enemy.isBoss) return 'boss';
  if (enemy.enemyTier === 'miniBoss' || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian) return 'miniboss';
  if (enemy.enemyTier === 'elite' || enemy.enemyTier === 'special' || enemy.isElite || enemy.isSpecial) return 'elite';
  return 'minion';
}

export function applyGameModLootMixin(Game) {
  Object.assign(Game.prototype, {
    tryRollModDropForEnemy(enemy) {
      if (!this.lootSystem || enemy.isAffixMinion) return;
      const tier = getEnemyTier(enemy);
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;

      // Room cap
      const roomCap = MOD_DROPS_CAP_PER_ROOM;
      if ((this.runModDropsThisRoom || 0) >= roomCap && tier !== 'miniboss' && tier !== 'boss') return;

      // Per-minute cap (skip for miniboss/boss)
      if (tier !== 'miniboss' && tier !== 'boss') {
        if (this.runModDropsThisMinute >= MOD_DROPS_CAP_PER_MINUTE) return;
      }

      let rollCount = 1;
      let chance = 0;
      let rarityWeights = MINION_RARITY_WEIGHTS;

      if (tier === 'minion') {
        chance = MINION_MOD_DROP_CHANCE;
        // Slight first-rooms boost: if cleared maps very low, bump chance
        const cleared = (this.clearedMaps && this.clearedMaps.length) || 0;
        if (cleared < 2) chance *= 1.5;
      } else if (tier === 'elite') {
        chance = ELITE_MOD_DROP_CHANCE;
        rarityWeights = ELITE_RARITY_WEIGHTS;
        // Pity: force drop if too many elites without a mod
        this.runModElitesSinceDrop = (this.runModElitesSinceDrop || 0) + 1;
        if (this.runModElitesSinceDrop >= MOD_PITY_ELITES_WITHOUT_DROP) {
          chance = 1;
          this.runModElitesSinceDrop = 0;
        }
      } else if (tier === 'miniboss') {
        rollCount = 1;
        rarityWeights = MINIBOSS_RARITY_WEIGHTS;
        this.runModDropsThisRoom = (this.runModDropsThisRoom || 0) + 1;
        this.spawnModDrop(ex, ey, rollRarity(rarityWeights));
        if (Math.random() < MINIBOSS_SECOND_MOD_CHANCE) {
          this.spawnModDrop(ex + 12, ey - 8, rollRarity(rarityWeights));
        }
        return;
      } else if (tier === 'boss') {
        for (let i = 0; i < BOSS_MOD_ROLLS; i++) {
          this.spawnModDrop(ex + (i * 14) - 7, ey + (i % 2) * 10 - 5, rollRarity(BOSS_RARITY_WEIGHTS));
        }
        return;
      }

      for (let i = 0; i < rollCount; i++) {
        if (Math.random() >= chance) continue;
        const rarity = rollRarity(rarityWeights);
        this.spawnModDrop(ex, ey, rarity);
        if (tier === 'elite') this.runModElitesSinceDrop = 0;
      }
    },

    spawnModDrop(x, y, rarityOrModId) {
      if (!this.lootSystem) return;
      const isModId = typeof rarityOrModId === 'string' && getSkillModById(rarityOrModId);
      const modId = isModId ? rarityOrModId : getRandomMod({
        game: this,
        rarity: rarityOrModId,
        preferEquipped: true,
        preferUnderServed: true
      });
      if (!modId) return;
      const mod = getSkillModById(modId);
      const name = mod ? mod.name : modId;
      const def = {
        type: 'ModCard',
        name: name,
        modId,
        rarity: mod ? mod.rarity : 'common',
        description: mod ? mod.description : ''
      };
      const item = new LootItem(this.lootSystem.nextId++, x, y, def, x, y);
      item.size = 22;
      this.lootSystem.items.push(item);
      if (!isModId) {
        this.runModDropsThisRoom = (this.runModDropsThisRoom || 0) + 1;
        this.runModDropsThisMinute = (this.runModDropsThisMinute || 0) + 1;
      }
    },

    addModToInventory(modId) {
      const pack = this.runModInventory || [];
      if (pack.length >= MOD_PACK_MAX) {
        if (typeof this.showModPackFullToast === 'function') {
          this.showModPackFullToast(modId);
        }
        return false;
      }
      pack.push(modId);
      return true;
    },

    removeModFromInventory(modId) {
      const pack = this.runModInventory || [];
      const idx = pack.indexOf(modId);
      if (idx === -1) return false;
      pack.splice(idx, 1);
      return true;
    },

    getMaxModSocketsForSkill(skillId) {
      const level = getSkillLevel(skillId);
      const fromLevel = getModSlotsForSkillLevel(level);
      return Math.max(2, fromLevel);
    },

    equipModToSkill(modId, skillId, socketIndex) {
      if (!this.runSkillMods[skillId]) this.runSkillMods[skillId] = [];
      const max = this.getMaxModSocketsForSkill(skillId);
      const slots = this.runSkillMods[skillId];
      while (slots.length < max) slots.push(null);
      if (socketIndex < 0 || socketIndex >= slots.length) return false;
      const prev = slots[socketIndex];
      slots[socketIndex] = modId;
      if (prev && this.runModInventory) {
        const idx = this.runModInventory.indexOf(prev);
        if (idx === -1) this.runModInventory.push(prev);
      }
      if (this.runModInventory) {
        const i = this.runModInventory.indexOf(modId);
        if (i !== -1) this.runModInventory.splice(i, 1);
      }
      return true;
    },

    unequipModFromSkill(skillId, socketIndex) {
      const slots = this.runSkillMods[skillId];
      if (!Array.isArray(slots) || socketIndex < 0 || socketIndex >= slots.length) return null;
      const modId = slots[socketIndex];
      slots[socketIndex] = null;
      if (modId && this.runModInventory && this.runModInventory.length < MOD_PACK_MAX) {
        this.runModInventory.push(modId);
      }
      return modId;
    },

    salvageMod(modId) {
      const mod = getSkillModById(modId);
      const rarity = (mod && mod.rarity) || 'common';
      const shards = { common: 1, rare: 3, epic: 8, legendary: 20 }[rarity] || 1;
      this.runModShardCurrency = (this.runModShardCurrency || 0) + shards;
      this.removeModFromInventory(modId);
      for (const skillId of Object.keys(this.runSkillMods || {})) {
        const arr = this.runSkillMods[skillId];
        if (!Array.isArray(arr)) continue;
        const i = arr.indexOf(modId);
        if (i !== -1) arr[i] = null;
      }
      return shards;
    },

    getActiveModsForSkill(skillId) {
      const slots = (this.runSkillMods && this.runSkillMods[skillId]) || [];
      const modIds = slots.filter(Boolean);
      return modIds.map((id) => getSkillModById(id)).filter(Boolean);
    },

    getModsCompatibleWithSkill(skillId) {
      const skillDef = getSkillById(skillId);
      return getModsCompatibleWithSkill(skillDef);
    },

    showModPickupToast(modId, rarity) {
      const mod = getSkillModById(modId);
      const name = mod ? mod.name : modId;
      if (typeof this.showNotification === 'function') {
        this.showNotification('Mod Card', `${name} (${rarity}) added to Mod Pack.`);
      }
    },

    showModPackFullToast() {
      if (typeof this.showNotification === 'function') {
        this.showNotification('Mod Pack Full', 'Salvage or equip a mod to make room.');
      }
    },

    rerollModInPack(modId) {
      const shards = this.runModShardCurrency || 0;
      if (shards < MOD_REROLL_SHARD_COST) {
        if (typeof this.showNotification === 'function') {
          this.showNotification('Mod Shards', `Need ${MOD_REROLL_SHARD_COST} shards to reroll.`);
        }
        return false;
      }
      const pack = this.runModInventory || [];
      const idx = pack.indexOf(modId);
      if (idx === -1) return false;
      const mod = getSkillModById(modId);
      const rarity = (mod && mod.rarity) || 'common';
      this.runModShardCurrency = shards - MOD_REROLL_SHARD_COST;
      pack.splice(idx, 1);
      const newModId = getRandomMod({
        game: this,
        rarity,
        preferEquipped: true,
        preferUnderServed: true
      });
      if (newModId) pack.push(newModId);
      return true;
    }
  });
}
