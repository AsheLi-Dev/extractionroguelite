// -------- Game Loot Methods Mixin --------
// Loot drops, pickup, cubes
// This module adds methods to Game.prototype when imported

import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { LootItem } from '../entities/loot.js';
import { SearchableProp } from '../entities/searchable-prop.js';
import { BLESSING_DEFS } from '../data/cubes-data.js';
import { HUMAN_SQUAD_DROP, SQUAD_WIPE_BONUS } from '../data/human-squad-data.js';
import { MODIFIER_CUBES, UPGRADE_CUBES, LEGENDARY_CUBES } from '../data/cubes-data.js';
import { getSkillUnlocks, setSkillUnlock } from '../data/constants.js';
import { hasTalent } from '../data/talents.js';
import { generateEquipmentItem, getModifierPoolForType, LOCAL_STAT_SCALE_MOD_IDS, rollLocalStatScaleValueForDifficulty, rollModifierValueForDifficulty } from '../data/loot-data.js';
import { DIFFICULTY_STAT_MULTIPLIER } from '../data/constants.js';
import { LEGENDARY_MODIFIER_IDS, LEGENDARY_MODIFIER_EFFECTS } from '../data/cubes-data.js';
import { addGold, rollGoldDrop } from './economy.js';
import {
  createSpiritItem,
  ensureRunInventoryState,
  ensureItemVessels,
  rollRandomAncestorSpiritLootDefByRarity,
  handleAncestorOnLootPickup
} from './ancestor-system.js';
import { getRingDropRateMult } from './ring-effects.js';

export function applyGameLootMixin(Game) {
  Object.assign(Game.prototype, {
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
      const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
      if (!baseType) return;
      const minXp = baseType.minXp ?? 10;
      const maxXp = baseType.maxXp ?? 20;
      let xp = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));
      const mult = DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1;
      const tierMult = enemy.tierXpMult ?? 1;
      xp = Math.max(1, Math.round(xp * mult * tierMult));
      this.grantXP(xp);
    },

    dropLootFromEnemy(enemy) {
      if (enemy.isAffixMinion) return [];
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;

      if (enemy.squadId) {
        this.squadAliveCount = this.squadAliveCount || {};
        this.squadLastDeath = this.squadLastDeath || {};
        this.squadAliveCount[enemy.squadId] = (this.squadAliveCount[enemy.squadId] ?? 0) - 1;
        this.squadLastDeath[enemy.squadId] = { x: ex, y: ey };
      }

      if (enemy.dropTableId === "humanSquad") {
        this.grantXPFromEnemy(enemy);
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
        const equipOpts = { qualityEye: hasTalent("qualityEye"), socketSense: hasTalent("socketSense"), difficulty: diff };
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

      const goldType = enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian
        ? "elite"
        : (enemy.enemyTier === "elite" || enemy.isElite ? "elite" : "mob");
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
      }
      const martyrMinions = [];
      if (enemy.affixes?.includes("martyr")) {
        const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
        const ex = enemy.position.x + enemy.size / 2;
        const ey = enemy.position.y + enemy.size / 2;
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
          const dist = 20 + Math.random() * 15;
          const mx = ex + Math.cos(angle) * dist - 12;
          const my = ey + Math.sin(angle) * dist - 12;
          const typeDef = { ...base, maxHealth: Math.round(base.maxHealth * 0.35), attack: base.attack, speed: base.speed, size: 24 };
          const minion = new Enemy(mx, my, typeDef);
          minion.worldBounds = enemy.worldBounds;
          minion.activated = true;
          minion.isAffixMinion = true;
          martyrMinions.push(minion);
        }
      }
      if (enemy.isCursedChestGuardian) {
        this.tryDropCubeFromEnemy(enemy);
        this.cursedChestBlocked = false;
        this.grantXP(50);
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
          const def = generateEquipmentItem(type, 1, 0.8, null, { difficulty: diff });
          const item = new LootItem(this.lootSystem.nextId++, ex - 10, ey - 10, def, ex, ey);
          this.lootSystem.items.push(item);
          this.grantXP(80);
        }
        return martyrMinions;
      }
      this.grantXPFromEnemy(enemy);
      this.tryDropCubeFromEnemy(enemy, useMiniBossChest ? emitCube : null);

      const tier = enemy.enemyTier || (enemy.isMiniBoss ? "miniBoss" : enemy.isElite ? "elite" : "minion");
      const types = ["Helmet", "Boots", "Body Armour", "Weapon", "Ring"];
      const lootQual = this.currentMap?.lootQuality ?? 0.5;

      // Tutorial: Guarantee white weapon drop and tier 1 cube from first enemy
      if (this.tutorialMode && !this.tutorialFirstEnemyKilled) {
        this.tutorialFirstEnemyKilled = true;
        const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
        const equipOpts = { qualityEye: false, socketSense: false, difficulty };
        const def = generateEquipmentItem("Weapon", lootQual, 0, "common", equipOpts);
        emitEquipment(def);

        // Guarantee a random tier 1 cube drop
        const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
        const randomCube = allCubes[Math.floor(Math.random() * allCubes.length)];
        emitCube(`${randomCube.id}T1`);
      }

      let dropMult = enemy.affixes?.includes("evasive") ? 2 : 1;
      if (this.hasBlessing("fortune")) dropMult *= 2;
      if (hasTalent("cardHoarder") && (this.lootHoarderUntil || 0) > this.time) dropMult *= 1.2;
      dropMult *= getRingDropRateMult(this);
      const equipDropMult = hasTalent("keenEye") ? 1.15 : 1;
      const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const equipOpts = { qualityEye: hasTalent("qualityEye"), socketSense: hasTalent("socketSense"), difficulty };
      if (tier === "minion") {
        if (Math.random() < 0.05 * dropMult * equipDropMult) {
          const type = types[Math.floor(Math.random() * types.length)];
          const def = generateEquipmentItem(type, lootQual, 0, "common", equipOpts);
          emitEquipment(def);
        }
      } else if (tier === "elite") {
        if (Math.random() < 0.2 * dropMult * equipDropMult) {
          const type = types[Math.floor(Math.random() * types.length)];
          const def = generateEquipmentItem(type, Math.min(1, lootQual + 0.35), 0.3, "magic", equipOpts);
          emitEquipment(def);
        }
      } else if (tier === "miniBoss") {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, 1, 0.8, "rare", equipOpts);
        emitEquipment(def);
        if (Math.random() < 0.1 * dropMult * equipDropMult) {
          const type2 = types[Math.floor(Math.random() * types.length)];
          const def2 = generateEquipmentItem(type2, 1, 0.8, "rare", equipOpts);
          emitEquipment(def2);
        }
        if (hasTalent("philosophersStone") && Math.random() < 0.05) {
          const legType = types[Math.floor(Math.random() * types.length)];
          const legDef = this.generateLegendaryEquipment(legType);
          emitEquipment(legDef);
        }
        if (hasTalent("livingItem")) {
          const living = this.getLivingItem();
          if (living && (living.modifiers?.length ?? 0) < 6) {
            const pool = getModifierPoolForType(living.type).filter((p) => !living.modifiers?.some((m) => m.id === p.id));
            if (pool.length > 0) {
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
      }

      const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
      if (baseType && hasTalent("battleHardened") && Math.random() < 0.1) {
        if (useMiniBossChest) emitEquipment(this.lootSystem.getLootDefinition(0.9));
        else this.lootSystem.spawnGuaranteedWeaponAt(ex, ey);
      }
      if (hasTalent("jackpot") && !this.jackpotUsed) {
        this.jackpotUsed = true;
        if (useMiniBossChest) emitEquipment(this.lootSystem.getLootDefinition(1));
        else this.lootSystem.spawnBurstAt(ex, ey, 1, 1);
      }
      const isBoss = !!(enemy.isBoss || enemy === this.enemySystem?.boss);
      const isElite = !!(enemy.enemyTier === "elite" || enemy.isElite);
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
      if (useMiniBossChest && queuedMiniBossLootDefs.length > 0) {
        this.searchableProps = this.searchableProps || [];
        const chestId = this.searchablePropNextId ?? 1;
        const chest = new SearchableProp(chestId, ex - 16, ey - 16, "chest");
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
        if (hasTalent("cardSurge")) this.cardSurgeUntil = Math.max(this.cardSurgeUntil || 0, this.time + 3);
        if (this.updateMapUI) this.updateMapUI();
        return;
      }
      if (lootItem.type === "Cube" && lootItem.cubeKey) {
        this.addCubeToInventory(lootItem.cubeKey);
        if (hasTalent("cardSurge")) this.cardSurgeUntil = Math.max(this.cardSurgeUntil || 0, this.time + 3);
        if (this.hasUpgradeCard("secureFooting")) this.swiftFeetTimer = 2.0;
        this.updateInventoryUI();
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

      const newItem = {
        id: lootItem.id,
        name: lootItem.name,
        type: lootItem.type,
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
      if (hasTalent("cardSurge")) this.cardSurgeUntil = Math.max(this.cardSurgeUntil || 0, this.time + 3);
      if (hasTalent("itemSense") && newItem.rarity === "magic") {
        this.applyItemSenseSlowPulse(0.5, 220, 0.7);
      }
      if (hasTalent("secureFooting") && (newItem.rarity === "magic" || newItem.rarity === "rare")) {
        this.dashCooldown = 0;
        if (typeof this.updateDashUI === "function") this.updateDashUI();
      }

      if (hasTalent("ghostLooter")) this.ghostLooterUntargetableUntil = this.time + 0.5;
      const isRareOrBetter = lootItem.rarity === "rare" || lootItem.rarity === "legendary" || lootItem.rarity === "magic";
      if (hasTalent("phantomExtractor") && isRareOrBetter && this.time >= (this.phantomExtractorCooldownUntil || 0)) {
        this.phantomExtractorUntil = this.time + 3;
        this.phantomExtractorCooldownUntil = this.time + 20;
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
      if (hasTalent("cubeExpert")) {
        const match = cubeKey.match(/^(.+?)T1$/);
        if (match && MODIFIER_CUBES.some((c) => cubeKey.startsWith(c.id))) {
          cubeKey = match[1] + "T2";
        }
      }
      this.cubeInventory[cubeKey] = (this.cubeInventory[cubeKey] || 0) + 1;
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
      if (hasTalent("tinkerersEye") && Math.random() < 0.15) {
        const tierMatch = cubeKey.match(/T(\d)$/);
        const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
        const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
        const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
        const bonusKey = tierMatch ? `${cube.id}T${tier}` : cube.id;
        this.cubeInventory[bonusKey] = (this.cubeInventory[bonusKey] || 0) + 1;
      }
    },

    tryDropCubeFromEnemy(enemy, onDrop = null) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isFiery || enemy.isCursedChestGuardian);
      const isElite = !!(enemy.enemyTier === "elite" || enemy.isElite);
      let dropMult = this.hasBlessing("fortune") ? 2 : 1;
      if (hasTalent("cubeMagnet")) dropMult *= 1.2;
      if (hasTalent("cardHoarder") && (this.lootHoarderUntil || 0) > this.time) dropMult *= 1.2;
      dropMult *= getRingDropRateMult(this);

      const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
      const upgradeCubes = [...UPGRADE_CUBES];
      const magicRareCubes = UPGRADE_CUBES.filter((c) => c.id === "magicCube" || c.id === "rareCube");
      const pickRandomCube = (tier) => {
        let cube;
        if (hasTalent("transmuter") && magicRareCubes.length > 0 && Math.random() < 0.2) {
          cube = magicRareCubes[Math.floor(Math.random() * magicRareCubes.length)];
        } else {
          cube = allCubes[Math.floor(Math.random() * allCubes.length)];
        }
        const cubeKey = `${cube.id}T${tier}`;
        if (typeof onDrop === "function") onDrop(cubeKey);
        else this.lootSystem.spawnCubeAt(ex, ey, cubeKey);
      };

      if (isMiniBoss) {
        if (hasTalent("rarityRush") && this.difficulty >= 3 && Math.random() < 0.05) {
          const cube = LEGENDARY_CUBES[Math.floor(Math.random() * LEGENDARY_CUBES.length)];
          if (typeof onDrop === "function") onDrop(cube.id);
          else this.lootSystem.spawnCubeAt(ex, ey, cube.id);
        }
        if (Math.random() < 0.05 * dropMult) pickRandomCube(3);
      } else if (isElite) {
        if (Math.random() < 0.1 * dropMult) pickRandomCube(2);
      } else {
        if (Math.random() < 0.5 * dropMult) pickRandomCube(1);
      }
    }
  });
}
