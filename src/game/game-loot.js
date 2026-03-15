// -------- Game Loot Methods Mixin --------
// Loot drops, pickup, cubes
// This module adds methods to Game.prototype when imported

import { ENEMY_TYPES, UNDEAD_HERO_TYPES, Enemy } from '../entities/enemy.js';
import { LootItem } from '../entities/loot.js';
import { SearchableProp } from '../entities/searchable-prop.js';
import { BLESSING_DEFS } from '../data/cubes-data.js';
import { HUMAN_SQUAD_DROP, SQUAD_WIPE_BONUS } from '../data/human-squad-data.js';
import { MODIFIER_CUBES, UPGRADE_CUBES, LEGENDARY_CUBES } from '../data/cubes-data.js';
import { getMiniBossSecondaryDropChance, rollEquipmentDropOutcome } from '../data/equipment-drop-tables.js';
import { getSkillUnlocks, setSkillUnlock } from '../data/constants.js';
import { hasTalent } from '../data/talents.js';
import { generateEquipmentItem, getModifierPoolForType, LOCAL_STAT_SCALE_MOD_IDS, rollLocalStatScaleValueForDifficulty, rollModifierValueForDifficulty } from '../data/loot-data.js';
import { DIFFICULTY_STAT_MULTIPLIER } from '../data/constants.js';
import { LEGENDARY_MODIFIER_IDS, LEGENDARY_MODIFIER_EFFECTS } from '../data/cubes-data.js';
import { addGold, rollGoldDrop } from './economy.js';
import { play as playSfx } from '../audio.js';
import {
  createSpiritItem,
  ensureRunInventoryState,
  ensureItemVessels,
  rollRandomAncestorSpiritLootDefByRarity,
  handleAncestorOnLootPickup
} from './ancestor-system.js';
import { getRingDropRateMult } from './ring-effects.js';
import {
  RITE_ENTRY_ITEM_CATEGORY,
  RITE_ENTRY_ITEM_DISPLAY_NAME,
  RITE_ENTRY_ITEM_PRECIOUS_ID
} from '../data/rites.js';

const ALL_KNOWN_ENEMY_TYPES = [...ENEMY_TYPES, ...UNDEAD_HERO_TYPES];
const BLOOD_OF_THE_LAMB_LOOT_DEF = Object.freeze({
  type: 'Precious',
  category: RITE_ENTRY_ITEM_CATEGORY,
  preciousId: RITE_ENTRY_ITEM_PRECIOUS_ID,
  name: RITE_ENTRY_ITEM_DISPLAY_NAME,
  description: 'A sanctified rite key consumed only when a Rite is completed.',
  rarity: 'rare'
});

export function applyGameLootMixin(Game) {
  Object.assign(Game.prototype, {
    spawnHealingOrbAt(centerX, centerY, healFraction = 0.1) {
      if (!this.lootSystem) return null;
      const size = 20;
      const margin = this.world.wallThickness + 15;
      const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
      const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
      const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
      const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
      const def = {
        type: "HealingOrb",
        name: "Healing Orb",
        healFraction: Math.max(0, Number(healFraction) || 0.1)
      };
      const item = new LootItem(this.lootSystem.nextId++, clampedX, clampedY, def, centerX, centerY);
      item.size = size;
      this.lootSystem.items.push(item);
      return item;
    },

    applyItemSenseSlowPulse(duration = 0.5, radius = 220, slowMult = 0.7) {
      if (!this.enemySystem) return;
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const all = [...(this.enemySystem.enemies || []), ...(this.enemySystem.boss ? [this.enemySystem.boss] : [])];
      for (const enemy of all) {
        if (!enemy || enemy.isDead) continue;
        const ex = enemy.position.x + enemy.size / 2;
        const ey = enemy.position.y + enemy.size / 2;
        const dx = ex - px;
        const dy = ey - py;
        if (dx * dx + dy * dy > radius * radius) continue;
        enemy.slowUntil = Math.max(enemy.slowUntil || 0, this.time + duration);
        enemy.slowMult = Math.min(enemy.slowMult ?? 1, slowMult);
      }
    },

    grantXPFromEnemy(enemy) {
      const baseType = ALL_KNOWN_ENEMY_TYPES.find((t) => t.id === enemy.enemyTypeId) || ALL_KNOWN_ENEMY_TYPES.find((t) => t.name === enemy.name);
      if (!baseType) return;
      const minXp = baseType.minXp ?? 10;
      const maxXp = baseType.maxXp ?? 20;
      let xp = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));
      const mult = DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1;
      const tierMult = enemy.tierXpMult ?? 1;
      xp = Math.max(1, Math.round(xp * mult * tierMult));
      return xp;
    },

    dropLootFromEnemy(enemy) {
      if (enemy.isAffixMinion) return [];
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      if (typeof this.onEnemyDiedInBloodAltar === "function") this.onEnemyDiedInBloodAltar(ex, ey);

      if (enemy.squadId) {
        this.squadAliveCount = this.squadAliveCount || {};
        this.squadLastDeath = this.squadLastDeath || {};
        this.squadAliveCount[enemy.squadId] = (this.squadAliveCount[enemy.squadId] ?? 0) - 1;
        this.squadLastDeath[enemy.squadId] = { x: ex, y: ey };
      }

      if (enemy.dropTableId === "humanSquad") {
        const xpFromEnemy = this.grantXPFromEnemy(enemy);
        if (xpFromEnemy > 0) {
          this.lootSystem.spawnXpOrbAt(ex, ey, "small", xpFromEnemy);
        }
        const goldAmount = HUMAN_SQUAD_DROP.gold.min + Math.floor(Math.random() * (HUMAN_SQUAD_DROP.gold.max - HUMAN_SQUAD_DROP.gold.min + 1));
        this.lootSystem.spawnGoldAt(ex, ey, goldAmount);
        if (Math.random() < HUMAN_SQUAD_DROP.cubeChance) {
          const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
          const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
          const tier = Math.random() < 0.5 ? 1 : 2;
          const cubeKey = `${cube.id}T${tier}`;
        if (typeof onDrop === "function") onDrop(cubeKey);
        else this.lootSystem.spawnCubeAt(ex, ey, cubeKey);
        }
        const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
        const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
        const equipOpts = { qualityEye: false, socketSense: false, difficulty: diff, luck };
        const lootQual = this.currentMap?.lootQuality ?? 0.5;
        const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
        if (Math.random() < HUMAN_SQUAD_DROP.equipmentMagicChance) {
          const type = types[Math.floor(Math.random() * types.length)];
          const def = generateEquipmentItem(type, Math.min(1, lootQual + 0.3), 0.3, "magic", equipOpts);
          this.lootSystem.spawnEquipmentAt(ex, ey, def);
        } else if (Math.random() < HUMAN_SQUAD_DROP.equipmentRareChance) {
          const type = types[Math.floor(Math.random() * types.length)];
          const def = generateEquipmentItem(type, 1, 0.5, "rare", equipOpts);
          this.lootSystem.spawnEquipmentAt(ex, ey, def);
        }
        if (enemy.squadId && this.squadAliveCount[enemy.squadId] === 0) {
          const pos = this.squadLastDeath[enemy.squadId];
          if (pos) {
            if (Math.random() < SQUAD_WIPE_BONUS.cubeT2Chance) {
              const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
              const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
              this.lootSystem.spawnCubeAt(pos.x, pos.y, `${cube.id}T2`);
            } else {
              const type = types[Math.floor(Math.random() * types.length)];
              const def = generateEquipmentItem(type, 0.7, 0.4, "magic", equipOpts);
              this.lootSystem.spawnEquipmentAt(pos.x, pos.y, def);
            }
          }
        }
        return [];
      }

      const isSpecialTier = enemy.enemyTier === "special" || enemy.isSpecial;
      const goldType = enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian
        ? "elite"
        : (enemy.enemyTier === "elite" || enemy.isElite || isSpecialTier ? "elite" : "mob");
      const goldAmount = rollGoldDrop(goldType);
      const useMiniBossChest = !!(enemy.enemyTier === "miniBoss" || enemy.isMiniBoss);
      const queuedMiniBossLootDefs = [];
      const emitGold = (amount) => {
        const value = Math.max(0, Number(amount) || 0);
        if (value <= 0) return;
        if (useMiniBossChest) queuedMiniBossLootDefs.push({ type: "Gold", name: `${value} Gold`, goldAmount: value });
        else this.lootSystem.spawnGoldAt(ex, ey, value);
      };
      const emitCube = (cubeKey) => {
        if (!cubeKey) return;
        if (useMiniBossChest) queuedMiniBossLootDefs.push({ type: "Cube", name: cubeKey, cubeKey });
        else this.lootSystem.spawnCubeAt(ex, ey, cubeKey);
      };
      const emitEquipment = (def) => {
        if (!def) return;
        if (useMiniBossChest) queuedMiniBossLootDefs.push(def);
        else this.lootSystem.spawnEquipmentAt(ex, ey, def);
      };
      const emitSpirit = (def) => {
        if (!def) return;
        if (useMiniBossChest) queuedMiniBossLootDefs.push(def);
        else this.lootSystem.spawnAncestorSpiritAt(ex, ey, def);
      };
      emitGold(goldAmount);
      const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian);
      if (isMiniBoss) {
        this.activeBlessings = [];
        const hasBlessed = (item) => item?.modifiers?.some((m) => m.id === "blessed");
        const activeIds = new Set();
        for (const [slot, item] of Object.entries(this.equipment)) {
          if (item && hasBlessed(item)) {
            let def = BLESSING_DEFS[Math.floor(Math.random() * BLESSING_DEFS.length)];
            let attempts = 0;
            while (activeIds.has(def.id) && attempts < 20) {
              def = BLESSING_DEFS[Math.floor(Math.random() * BLESSING_DEFS.length)];
              attempts++;
            }
            activeIds.add(def.id);
            this.activeBlessings.push({ ...def, until: this.time + 20 });
          }
        }
        if (!this.victoryPortal && !enemy._bloodAltarMiniboss && typeof this.spawnExtractionPortalNearPlayer === "function") {
          this.spawnExtractionPortalNearPlayer();
        }
      }
      const martyrMinions = [];
      // Martyr triggers at 50% HP (flashing circle 1s, then projectiles), not on death
      if (enemy.isCursedChestGuardian) {
        this.tryDropCubeFromEnemy(enemy);
        this.cursedChestBlocked = false;
        this.lootSystem.spawnXpOrbAt(ex, ey, "small", 50);
        this.lootSystem.spawnBurstAt(enemy.position.x + enemy.size / 2, enemy.position.y + enemy.size / 2, 2, 0.6);
        return martyrMinions;
      }
      if (enemy.isFiery && !this.fieryKilled) {
        this.tryDropCubeFromEnemy(enemy);
        this.fieryKilled = true;
        const ex = enemy.position.x + enemy.size / 2;
        const ey = enemy.position.y + enemy.size / 2;
        if (this.fieryTimer > 0) {
          const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
          const type = types[Math.floor(Math.random() * types.length)];
          const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
          const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
          const def = generateEquipmentItem(type, 1, 0.8, null, { difficulty: diff, luck });
          const item = new LootItem(this.lootSystem.nextId++, ex - 10, ey - 10, def, ex, ey);
          this.lootSystem.items.push(item);
          this.lootSystem.spawnXpOrbAt(ex, ey, "small", 80);
        }
        return martyrMinions;
      }
      const xpFromEnemy = this.grantXPFromEnemy(enemy);
      if (xpFromEnemy > 0) {
        this.lootSystem.spawnXpOrbAt(ex, ey, "small", xpFromEnemy);
      }
      this.tryDropCubeFromEnemy(enemy, useMiniBossChest ? emitCube : null);

      const tier = enemy.enemyTier || (enemy.isMiniBoss ? "miniBoss" : (enemy.isElite || enemy.isSpecial) ? "elite" : "minion");
      const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
      const lootQual = this.currentMap?.lootQuality ?? 0.5;
      const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
      const equipOpts = { qualityEye: false, socketSense: false, difficulty, luck };

      // Mimics drop any loot they stole when defeated
      if (typeof this.isMimicLooter === "function" && this.isMimicLooter(enemy)) {
        const stolen = Array.isArray(enemy.mimicState?.stolenLoot) ? enemy.mimicState.stolenLoot : [];
        for (const def of stolen) {
          if (!def) continue;
          const item = new LootItem(
            this.lootSystem.nextId++,
            ex - 10 + (Math.random() - 0.5) * 16,
            ey - 10 + (Math.random() - 0.5) * 16,
            def,
            ex,
            ey
          );
          item.size = 20;
          this.lootSystem.items.push(item);
        }
        const roll = Math.random();
        let rarity = "common";
        if (roll < 0.05) rarity = "rare";
        else if (roll < 0.40) rarity = "magic";
        const type = types[Math.floor(Math.random() * types.length)];
        const quality = rarity === "rare" ? Math.min(1, lootQual + 0.45) : (rarity === "magic" ? Math.min(1, lootQual + 0.35) : lootQual);
        const def = generateEquipmentItem(type, quality, rarity === "rare" ? 0.6 : (rarity === "magic" ? 0.3 : 0), rarity, equipOpts);
        emitEquipment(def);
        return martyrMinions;
      }

      // Tutorial: Guarantee white weapon drop and tier 1 cube from first enemy
      if (this.tutorialMode && !this.tutorialFirstEnemyKilled) {
        this.tutorialFirstEnemyKilled = true;
        const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
        const tutorialLuck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
        const equipOpts = { qualityEye: false, socketSense: false, difficulty, luck: tutorialLuck };
        const def = generateEquipmentItem("Weapon", lootQual, 0, "common", equipOpts);
        emitEquipment(def);

        // Guarantee a random tier 1 cube drop
        const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
        const randomCube = allCubes[Math.floor(Math.random() * allCubes.length)];
        emitCube(`${randomCube.id}T1`);
      }

      const dropMult = (enemy.affixes?.includes("evasive") ? 2 : 1)
        * (this.hasBlessing("fortune") ? 2 : 1)
        * (this.hasRunTalent("lootHoarder") && (this.lootHoarderUntil || 0) > this.time ? 1.2 : 1)
        * getRingDropRateMult(this);
      const equipDropMult = (this.hasRunTalent("keenEye") ? 1.15 : 1)
        * (tier === "elite" && this.hasRunTalent("scavengersInstinct") ? 1.1 : 1);
      const bandMult = enemy.dropChanceMult ?? 1;
      const dropChanceInputs = { dropMult, equipDropMult, bandMult };

      if (tier === "miniBoss") {
        emitEquipment(
          generateEquipmentItem(types[Math.floor(Math.random() * types.length)], lootQual, 0, "rare", equipOpts)
        );
        if (this.hasRunTalent("keenEye") && typeof this.logTalentTrigger === "function") {
          this.logTalentTrigger("keenEye", "Mini-boss guaranteed rare drop applied.");
        }

        const miniChance = getMiniBossSecondaryDropChance("miniBoss", dropChanceInputs.dropMult, dropChanceInputs.equipDropMult, dropChanceInputs.bandMult);
        const secRoll = Math.random();
        if (secRoll < (miniChance.secondary?.rare || 0)) {
          emitEquipment(generateEquipmentItem(types[Math.floor(Math.random() * types.length)], lootQual, 0, "rare", equipOpts));
          if (this.hasRunTalent("keenEye") && typeof this.logTalentTrigger === "function") {
            this.logTalentTrigger("keenEye", "Mini-boss: extra rare roll succeeded.");
          }
        } else if (secRoll < ((miniChance.secondary?.rare || 0) + (miniChance.secondary?.magic || 0))) {
          emitEquipment(generateEquipmentItem(types[Math.floor(Math.random() * types.length)], lootQual, 0, "magic", equipOpts));
          if (this.hasRunTalent("keenEye") && typeof this.logTalentTrigger === "function") {
            this.logTalentTrigger("keenEye", "Mini-boss: bonus magic roll succeeded.");
          }
        }

        if (this.hasRunTalent("philosophersStone") && Math.random() < 0.05) {
          const legType = types[Math.floor(Math.random() * types.length)];
          const legDef = this.generateLegendaryEquipment(legType);
          emitEquipment(legDef);
        }

        if (this.hasRunTalent("livingItem")) {
          const living = this.getLivingItem();
          if (living && (living.modifiers?.length ?? 0) < 6) {
            const pool = getModifierPoolForType(living.type).filter((p) => !living.modifiers?.some((m) => m.id === p.id));
            if (pool.length > 0) {
              if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("livingItem", "Mini-boss kill: +1 modifier on Living Item");
              const m = pool[Math.floor(Math.random() * pool.length)];
              const d = Math.min(5, Math.max(1, this.difficulty ?? 1));
              const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(d) : rollModifierValueForDifficulty(d);
              living.modifiers = living.modifiers || [];
              living.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, appliesTo: m.appliesTo, addedAt: Date.now() });
              this.rebuildItemStats(living);
              this.recalculateStats();
              this.updateEquippedUI();
            }
          }
        }
      } else {
        const outcome = rollEquipmentDropOutcome(tier, 0, dropChanceInputs.dropMult, dropChanceInputs.equipDropMult, dropChanceInputs.bandMult);
        if (outcome && outcome.rarity) {
          const type = types[Math.floor(Math.random() * types.length)];
          emitEquipment(generateEquipmentItem(type, lootQual, 0, outcome.rarity, equipOpts));
          if (this.hasRunTalent("keenEye") && typeof this.logTalentTrigger === "function") {
            this.logTalentTrigger("keenEye", "Equipment dropped: chance multipliers applied");
          }
        }
      }

      const isBoss = !!(enemy.isBoss || enemy === this.enemySystem?.boss);
      const isElite = !!(enemy.enemyTier === "elite" || enemy.enemyTier === "special" || enemy.isElite || enemy.isSpecial);
      const isMiniBossForSpirit = !!(enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian);
      let spiritRarity = "normal";
      let spiritDropChance = 0.05;
      if (isBoss) {
        spiritRarity = "legendary";
        spiritDropChance = 0.05;
      } else if (isMiniBossForSpirit) {
        spiritRarity = "rare";
        spiritDropChance = 0.05;
      } else if (isElite) {
        spiritRarity = "magic";
        spiritDropChance = 0.03;
      }
      if (Math.random() < spiritDropChance) {
        const spiritDef = rollRandomAncestorSpiritLootDefByRarity(spiritRarity);
        if (spiritDef) emitSpirit(spiritDef);
      }
      const bloodDropChance = isBoss ? 0.05 : (useMiniBossChest ? 0.01 : 0);
      if (bloodDropChance > 0 && Math.random() < bloodDropChance) {
        const bloodDef = { ...BLOOD_OF_THE_LAMB_LOOT_DEF };
        if (useMiniBossChest) queuedMiniBossLootDefs.push(bloodDef);
        else this.lootSystem.spawnEquipmentAt(ex, ey, bloodDef);
      }
      if (useMiniBossChest && queuedMiniBossLootDefs.length > 0) {
        this.searchableProps = this.searchableProps || [];
        const chestId = this.searchablePropNextId ?? 1;
        const chest = new SearchableProp(chestId, ex - 16, ey - 16, "chest");
        chest.isMiniBossLootChest = true;
        const baseSearchTime = Number(chest?.def?.searchTime) || 0;
        if (baseSearchTime > 0) {
          chest.searchTimeOverride = baseSearchTime / 3;
        }
        chest.pendingLootDefs = queuedMiniBossLootDefs.map((d) => ({ ...d }));
        this.searchableProps.push(chest);
        this.searchablePropNextId = chestId + 1;
      }
      return martyrMinions;
    },

    handleLootPickup(lootItem) {
      handleAncestorOnLootPickup(this, lootItem);
      if (lootItem.type === "Gold" && lootItem.goldAmount > 0) {
        addGold(this, lootItem.goldAmount, "loot_pickup", {});
        if (typeof playSfx === "function") playSfx("collectGold");
        if (this.hasRunTalent("cardSurge")) {
          if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("cardSurge", "Loot pickup: +20% move/attack speed 3s");
          this.cardSurgeUntil = Math.max(this.cardSurgeUntil || 0, this.time + 3);
        }
        if (this.updateMapUI) this.updateMapUI();
        return;
      }
      if (lootItem.type === "XpOrb" && lootItem.xpAmount > 0) {
        if (typeof playSfx === "function") playSfx("xpPickup");
        this.grantXP(lootItem.xpAmount);
        return;
      }
      if (lootItem.type === "Cube" && lootItem.cubeKey) {
        this.addCubeToInventory(lootItem.cubeKey);
        if (this.hasRunTalent("cardSurge")) {
          if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("cardSurge", "Loot pickup: +20% move/attack speed 3s");
          this.cardSurgeUntil = Math.max(this.cardSurgeUntil || 0, this.time + 3);
        }
        if (this.hasUpgradeCard("secureFooting")) this.swiftFeetTimer = 2.0;
        this.updateInventoryUI();
        return;
      }
      if (lootItem.type === "LifeOrb" || lootItem.type === "LifeFlask") {
        const maxHp = Math.max(1, Number(this.currentStats?.maxHealth) || 1);
        const healAmount = Math.max(1, Math.round(maxHp * (Number(lootItem.healFraction) || 0.1)));
        this.healPlayer(healAmount);
        if (lootItem.type === "LifeOrb" && typeof this.showNotification === "function") {
          this.showNotification("Life Orb", `Recovered ${healAmount} HP.`);
        }
        return;
      }
      if (lootItem.type === "Ancestor Spirit" && lootItem.spiritDefId) {
        ensureRunInventoryState(this);
        const spirit = createSpiritItem(lootItem.spiritDefId);
        if (spirit) {
          this.runInventory.ancestorSpiritRegistry[spirit.id] = spirit;
          this.runInventory.ancestorSpirits.push(spirit);
          if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
        }
        this.updateInventoryUI();
        if (this.tutorialSystem) this.tutorialSystem.onLootCollected();
        return;
      }
      if (lootItem.type === "HealingOrb") {
        const maxHp = Math.max(1, Number(this.currentStats?.maxHealth) || 1);
        const healAmount = Math.max(
          1,
          Math.round(maxHp * (Number(lootItem.healFraction) || 0.1) + (Number(lootItem.healFlat) || 0))
        );
        this.healPlayer(healAmount);
        if (typeof this.showNotification === "function") {
          this.showNotification("Healing Orb", `Recovered ${healAmount} HP.`);
        }
        return;
      }
      const isBloodOfTheLamb = lootItem.type === "Precious" && lootItem.preciousId === RITE_ENTRY_ITEM_PRECIOUS_ID;
      if (isBloodOfTheLamb) {
        if (typeof this.grantRiteEntryItem === "function") {
          this.grantRiteEntryItem(1);
        } else if (typeof this.grantPillarTrialEntryItem === "function") {
          this.grantPillarTrialEntryItem(1);
        }
        if (typeof this.showNotification === "function") {
          this.showNotification(RITE_ENTRY_ITEM_DISPLAY_NAME, "Rite access item added.");
        }
      }

      const newItem = {
        id: lootItem.id,
        name: lootItem.name,
        type: lootItem.type,
        category: lootItem.category || null,
        preciousId: lootItem.preciousId || null,
        ringId: lootItem.ringId || null,
        ringSpriteKey: lootItem.ringSpriteKey || null,
        consumedOnTrigger: !!lootItem.consumedOnTrigger,
        rolledModifiers: lootItem.rolledModifiers || null,
        spriteCell: lootItem.spriteCell || null,
        stats: lootItem.stats || {},
        cardKey: lootItem.cardKey || null,
        description: lootItem.description || "",
        weight: lootItem.weight || null,
        rarity: lootItem.rarity || null,
        modifiers: lootItem.modifiers || [],
        baseStat: lootItem.baseStat || null,
        sockets: lootItem.sockets ?? 0,
        vesselsMax: lootItem.vesselsMax ?? 0,
        vessels: Array.isArray(lootItem.vessels) ? lootItem.vessels : []
      };
      ensureItemVessels(newItem);

      this.inventory.push(newItem);
      if (this.hasRunTalent("cardSurge")) {
        if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("cardSurge", "Loot pickup: +20% move/attack speed 3s");
        this.cardSurgeUntil = Math.max(this.cardSurgeUntil || 0, this.time + 3);
      }
      if (this.hasRunTalent("itemSense") && newItem.rarity === "magic") {
        if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("itemSense", "Magic item pickup: slowed nearby enemies 20% for 2s");
        this.applyItemSenseSlowPulse(0.5, 220, 0.7);
      }
      if (this.hasRunTalent("ghostLooter")) {
        if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("ghostLooter", "Loot pickup: untargetable 0.5s");
        this.ghostLooterUntargetableUntil = this.time + 0.5;
      }
      if (this.hasUpgradeCard("secureFooting")) {
        this.swiftFeetTimer = 2.0;
      }
      if (this.hasUpgradeCard("vampiric") && !this.hasCondition("noHealthDrops")) {
        this.healPlayer(5);
        const u = getSkillUnlocks();
        const count = (u.vampiricTriggers || 0) + 1;
        setSkillUnlock("vampiricTriggers", count);
      }

      this.updateInventoryUI();
      
      // Track loot collection for tutorial
      if (this.tutorialSystem) {
        this.tutorialSystem.onLootCollected();
      }
    },

    generateLegendaryEquipment(type) {
      const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const def = generateEquipmentItem(type, 1, 0.8, "legendary", { difficulty });
      if (type !== "Ring") {
        const legMod = LEGENDARY_MODIFIER_IDS[Math.floor(Math.random() * LEGENDARY_MODIFIER_IDS.length)];
        def.modifiers = def.modifiers || [];
        def.modifiers.push({ id: legMod, label: LEGENDARY_MODIFIER_EFFECTS[legMod]?.label || legMod, statKey: null, value: 0 });
      }
      return def;
    },

    addCubeToInventory(cubeKey) {
      if (typeof cubeKey === "string") {
        cubeKey = cubeKey.replace(/^socketCube/, "vesselCube");
      }
      this.cubeInventory[cubeKey] = (this.cubeInventory[cubeKey] || 0) + 1;
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
    },

    tryDropCubeFromEnemy(enemy, onDrop = null) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isFiery || enemy.isCursedChestGuardian);
      const isElite = !!(enemy.enemyTier === "elite" || enemy.enemyTier === "special" || enemy.isElite || enemy.isSpecial);
      let dropMult = this.hasBlessing("fortune") ? 2 : 1;
      if (this.hasRunTalent("cubeMagnet")) {
        if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("cubeMagnet", "Cube drop roll: +20% chance");
        dropMult *= 1.2;
      }
      if (this.hasRunTalent("lootHoarder") && (this.lootHoarderUntil || 0) > this.time) dropMult *= 1.2;
      dropMult *= getRingDropRateMult(this);
      const bandMult = enemy.dropChanceMult ?? 1;

      const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
      const upgradeCubes = [...UPGRADE_CUBES];
      const magicRareCubes = UPGRADE_CUBES.filter((c) => c.id === "magicCube" || c.id === "rareCube");
      const pickRandomCube = (tier) => {
        const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
        const cubeKey = `${cube.id}T${tier}`;
        if (typeof onDrop === "function") onDrop(cubeKey);
        else this.lootSystem.spawnCubeAt(ex, ey, cubeKey);
      };

      if (isMiniBoss) {
        if (Math.random() < 0.05 * dropMult * bandMult) pickRandomCube(3);
      } else if (isElite) {
        if (Math.random() < 0.1 * dropMult * bandMult) pickRandomCube(2);
      } else {
        if (Math.random() < 0.5 * dropMult * bandMult) pickRandomCube(1);
      }
    }
  });
}
