// -------- Game Dev Tools Methods Mixin --------
// Developer tools and UI initialization
// This module adds methods to Game.prototype when imported

import { DEV_MODE_ENABLED } from '../data/constants.js';
import { SKILL_DEFS, MODIFICATION_CARD_DEFS } from '../data/skills.js';
import { AFFIX_DEFS, getXpForLevel } from '../entities/enemy.js';
import { SHRINE_DEFS } from '../data/shrines.js';
import { ATTACK_UPGRADE_DEFS, getAggregatedUpgradeEffect, getAggregatedPenaltyEffect, rollUpgradeValue } from '../data/level-up-data.js';
import { getAttackEvolutionsForWeapon, getAttackEvolutionById } from '../data/attack-evolutions.js';
import { MODIFIER_CUBES, UPGRADE_CUBES, LEGENDARY_CUBES } from '../data/cubes-data.js';
import { generateEquipmentItem } from '../data/loot-data.js';
import { BREAKABLE_DEFS } from '../data/breakables-data.js';
import { SEARCHABLE_PROP_DEFS } from '../data/searchable-props-data.js';
import { NPC_DEFS } from '../data/npc-data.js';
import { Breakable } from '../entities/breakable.js';
import { SearchableProp } from '../entities/searchable-prop.js';
import { getAllRingDefs, getRingDefById, getRingSpriteCell } from '../data/rings-data.js';
import { setRingProcLogging } from './ring-effects.js';

export function applyGameDevMixin(Game) {
  Object.assign(Game.prototype, {
    initDevUI() {
      if (!DEV_MODE_ENABLED) {
        if (this.devToggleEl) this.devToggleEl.style.display = "none";
        if (this.devPanelEl) this.devPanelEl.style.display = "none";
        return;
      }

      if (this.devToggleEl && this.devPanelEl) {
        this.addManagedListener(this.devToggleEl, "click", () => this.toggleDevPanel());
      }
      if (this.devCloseEl && this.devPanelEl) {
        this.addManagedListener(this.devCloseEl, "click", () => this.toggleDevPanel());
      }
      if (this.devGiveAllEl) {
        this.addManagedListener(this.devGiveAllEl, "click", () => this.handleDevGiveAllCards());
      }
      const devGiveAllCubesEl = document.getElementById("dev-give-all-cubes");
      if (devGiveAllCubesEl) {
        this.addManagedListener(devGiveAllCubesEl, "click", () => this.handleDevGiveAllCubes());
      }
      const devRandomItemEl = document.getElementById("dev-random-item");
      if (devRandomItemEl) {
        this.addManagedListener(devRandomItemEl, "click", () => this.handleDevRandomItem());
      }
      const devLevelUpEl = document.getElementById("dev-level-up");
      if (devLevelUpEl) {
        this.addManagedListener(devLevelUpEl, "click", () => {
          this.xp = getXpForLevel(this.level + 1);
          this.checkLevelUp();
        });
      }
      const devTeleportBossEl = document.getElementById("dev-teleport-boss");
      if (devTeleportBossEl) {
        this.addManagedListener(devTeleportBossEl, "click", () => this.handleDevTeleportToBoss());
      }
      if (this.devMaxStatsEl) {
        this.addManagedListener(this.devMaxStatsEl, "click", () => this.handleDevMaxStats());
      }
      this.initDevStatsSliders();

      const devAffixSelect = document.getElementById("dev-affix-select");
      const devSpawnEliteBtn = document.getElementById("dev-spawn-elite");
      if (devAffixSelect) {
        devAffixSelect.innerHTML = '<option value="">-- Select affix --</option>';
        for (const affix of AFFIX_DEFS) {
          const opt = document.createElement("option");
          opt.value = affix.id;
          opt.textContent = affix.name;
          devAffixSelect.appendChild(opt);
        }
      }
      if (devSpawnEliteBtn) {
        this.addManagedListener(devSpawnEliteBtn, "click", () => {
          const affixId = devAffixSelect?.value;
          if (!affixId) return;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          this.enemySystem.spawnOne("elite", [affixId], { x: px, y: py }, this);
        });
      }

      const devSpawnBreakablesBtn = document.getElementById("dev-spawn-breakables");
      if (devSpawnBreakablesBtn) {
        this.addManagedListener(devSpawnBreakablesBtn, "click", () => this.spawnDebugBreakables());
      }
      const devSpawnPropsBtn = document.getElementById("dev-spawn-props");
      if (devSpawnPropsBtn) {
        this.addManagedListener(devSpawnPropsBtn, "click", () => this.spawnTestProps());
      }
      const devDustDebugBtn = document.getElementById("dev-dust-debug");
      if (devDustDebugBtn) {
        this.addManagedListener(devDustDebugBtn, "click", () => {
          if (this.dustEmitter) this.dustEmitter.debugShowSpawnPoints = !this.dustEmitter.debugShowSpawnPoints;
        });
      }
      const devSpawnHumanSquadBtn = document.getElementById("dev-spawn-human-squad");
      if (devSpawnHumanSquadBtn) {
        this.addManagedListener(devSpawnHumanSquadBtn, "click", () => {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          this.enemySystem.spawnHumanSquad(px, py, this);
        });
      }

      const devMinibossSelect = document.getElementById("dev-miniboss-select");
      const devSpawnMinibossBtn = document.getElementById("dev-spawn-miniboss");
      if (devMinibossSelect) {
        devMinibossSelect.innerHTML = '<option value="">-- Select enemy --</option>';
        const attackKitEnemies = ["Orc", "Orc Wizard", "Goblin", "Goblin Archer", "Troll", "Ettin", "Big Slime", "Skeleton Archer", "Lich", "Death Knight", "Banshee", "Giant Spider", "Manticore", "Dryad", "Rock Golem", "Drake / Lesser Dragon"];
        for (const name of attackKitEnemies) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          devMinibossSelect.appendChild(opt);
        }
      }
      if (devSpawnMinibossBtn) {
        this.addManagedListener(devSpawnMinibossBtn, "click", () => {
          const enemyName = devMinibossSelect?.value;
          if (!enemyName) return;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          this.enemySystem.spawnOne("miniBoss", null, { x: px, y: py }, this, enemyName);
        });
      }

      const devCreateDummyBtn = document.getElementById("dev-create-dummy");
      if (devCreateDummyBtn) {
        this.addManagedListener(devCreateDummyBtn, "click", () => {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const enemy = this.enemySystem.spawnOne("minion", null, { x: px, y: py }, this, "m_5h_medium_dummy", false);
          if (enemy) {
            enemy.maxHealth = 999;
            enemy.health = 999;
            enemy._devCreateDummy = true;
          }
        });
      }

      if (this.devCardListEl) {
        this.devCardListEl.innerHTML = "";
      }

      const devModTogglesEl = document.getElementById("dev-skill-mod-toggles");
      if (devModTogglesEl) {
        devModTogglesEl.innerHTML = "";
        for (let slot = 0; slot < 4; slot++) {
          const skillId = this.skills?.[slot];
          const def = skillId ? SKILL_DEFS.find((s) => s.id === skillId) : null;
          const row = document.createElement("div");
          row.className = "dev-mod-slot-row";
          const label = document.createElement("span");
          label.className = "dev-mod-slot-label";
          label.textContent = `Slot ${slot + 1}: ${def ? def.name : "Empty"}`;
          row.appendChild(label);
          const wrap = document.createElement("div");
          wrap.className = "dev-mod-checks";
          for (const cardDef of MODIFICATION_CARD_DEFS) {
            const modId = cardDef.id;
            if (!cardDef) continue;
            const labelEl = document.createElement("label");
            labelEl.className = "dev-mod-check-label";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.dataset.slot = String(slot);
            cb.dataset.modId = modId;
            cb.checked = (this.devModOverrides[slot] || []).includes(modId);
            this.addManagedListener(cb, "change", () => {
              const list = this.devModOverrides[slot] || [];
              if (cb.checked) {
                if (!list.includes(modId)) this.devModOverrides[slot] = [...list, modId];
              } else {
                this.devModOverrides[slot] = list.filter((id) => id !== modId);
              }
            });
            labelEl.appendChild(cb);
            labelEl.appendChild(document.createTextNode(" " + cardDef.name));
            wrap.appendChild(labelEl);
          }
          row.appendChild(wrap);
          devModTogglesEl.appendChild(row);
        }
      }

      const buildLogToggle = document.getElementById("build-log-toggle");
      const buildLogPanel = document.getElementById("build-log-panel");
      const buildLogClose = document.getElementById("build-log-close");
      if (buildLogToggle && buildLogPanel) {
        this.addManagedListener(buildLogToggle, "click", () => {
          buildLogPanel.classList.toggle("hidden");
          if (!buildLogPanel.classList.contains("hidden") && this.buildLogRefresh) this.buildLogRefresh();
        });
      }
      if (buildLogClose && buildLogPanel) {
        this.addManagedListener(buildLogClose, "click", () => buildLogPanel.classList.add("hidden"));
      }
      this.buildLogRefresh = () => {
        const upgradesEl = document.getElementById("build-log-upgrades");
        const evolutionEl = document.getElementById("build-log-evolution");
        if (!upgradesEl || !evolutionEl) return;
        upgradesEl.innerHTML = "";
        evolutionEl.innerHTML = "";

        // Add shrine interactions to upgrades list
        if (this.shrineInteractions && this.shrineInteractions.length > 0) {
          this.shrineInteractions.forEach(interaction => {
            const li = document.createElement("li");
            li.className = "build-log-upgrade";
            li.innerHTML = `<span class="build-log-name"> </span><span class="build-log-effect">${interaction.message}</span>`;
            upgradesEl.appendChild(li);
          });
        }

        const ups = this.runAttackUpgrades || [];
        const aggUp = new Map();
        for (const u of ups) {
          if (!aggUp.has(u.id)) {
            aggUp.set(u.id, { id: u.id, name: u.name, description: u.description, value: 0, percent: u.percent, count: 0 });
          }
          const a = aggUp.get(u.id);
          a.count++;
          if (u.value !== undefined && u.value !== null) a.value += u.value;
        }
        for (const a of aggUp.values()) {
          if (a.value === 0 && a.id !== "extraProjectile") a.value = undefined;
          const li = document.createElement("li");
          li.className = "build-log-upgrade";
          const effect = getAggregatedUpgradeEffect(a);
          li.innerHTML = `<span class="build-log-name"> ${a.name} *${a.count}</span><span class="build-log-effect">${effect}</span>`;
          upgradesEl.appendChild(li);
        }

        const formatCategory = (cat) => (cat ? cat.charAt(0).toUpperCase() + (cat.slice(1) || "") : "—");
        const first = this.attackType === "projectile" ? (this.elementalShotEvolutionFirst || null) : null;
        const second = this.attackType === "projectile" ? (this.elementalShotEvolutionSecond || null) : null;
        const li1 = document.createElement("li");
        li1.className = "build-log-evolution";
        li1.innerHTML = `<span class="build-log-name">First evolution</span><span class="build-log-effect">${formatCategory(first)}</span>`;
        evolutionEl.appendChild(li1);
        const li2 = document.createElement("li");
        li2.className = "build-log-evolution";
        li2.innerHTML = `<span class="build-log-name">Second evolution</span><span class="build-log-effect">${formatCategory(second)}</span>`;
        evolutionEl.appendChild(li2);
      };

      const devForceUpgrade = document.getElementById("dev-force-upgrade");
      const devForcePenalty = document.getElementById("dev-force-penalty");
      const devApplyForce = document.getElementById("dev-apply-force-upgrade");
      if (devForceUpgrade && devForcePenalty && devApplyForce) {
        const defs = ATTACK_UPGRADE_DEFS[this.attackType] || {};
        const allUpgrades = [...(defs.standardUpgrades || []), ...(defs.uniqueUpgrades || [])];
        const allPenalties = [...(defs.standardPenalties || []), ...(defs.uniquePenalties || [])];
        devForceUpgrade.innerHTML = '<option value="">-- Upgrade --</option>';
        for (const u of allUpgrades) {
          const opt = document.createElement("option");
          opt.value = u.id;
          opt.textContent = u.name;
          devForceUpgrade.appendChild(opt);
        }
        devForcePenalty.innerHTML = '<option value="">-- Penalty --</option>';
        for (const p of allPenalties) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name;
          devForcePenalty.appendChild(opt);
        }
        this.addManagedListener(devApplyForce, "click", () => {
          const uId = devForceUpgrade.value;
          const pId = devForcePenalty.value;
          if (!uId && !pId) return;
          
          if (!this.runAttackUpgrades) this.runAttackUpgrades = [];
          if (!this.runAttackPenalties) this.runAttackPenalties = [];
          
          if (uId) {
            const uDef = allUpgrades.find((x) => x.id === uId);
            if (uDef) {
              this.runAttackUpgrades.push({ id: uDef.id, name: uDef.name, description: uDef.description, value: rollUpgradeValue(uDef), percent: !!uDef.valueRange?.percent });
            }
          }
          
          if (pId) {
            const pDef = allPenalties.find((x) => x.id === pId);
            if (pDef) {
              this.runAttackPenalties.push({ id: pDef.id, name: pDef.name, description: pDef.description, value: rollUpgradeValue(pDef), percent: !!pDef.valueRange?.percent });
            }
          }
          
          if (this.buildLogRefresh) this.buildLogRefresh();
        });
      }

      const devTransformSelect = document.getElementById("dev-transform-select");
      const devApplyTransform = document.getElementById("dev-apply-transform");
      if (devTransformSelect && devApplyTransform) {
        const attackToWeaponId = {
          projectile: "ProjectileShot"
        };
        const baseWeaponId = attackToWeaponId[this.attackType] || null;
        devTransformSelect.innerHTML = '<option value="">-- Transform --</option>';
        const clearOpt = document.createElement("option");
        clearOpt.value = "__clear__";
        clearOpt.textContent = "None (Base Attack)";
        devTransformSelect.appendChild(clearOpt);
        if (baseWeaponId) {
          const evoDefs = getAttackEvolutionsForWeapon(baseWeaponId);
          for (const evo of evoDefs) {
            const opt = document.createElement("option");
            opt.value = evo.id;
            opt.textContent = evo.transformName || evo.id;
            devTransformSelect.appendChild(opt);
          }
        }
        this.addManagedListener(devApplyTransform, "click", () => {
          if (!baseWeaponId) return;
          const selected = devTransformSelect.value;
          this.weaponEvolutions = this.weaponEvolutions || {};
          this.evolutionGroupSelections = this.evolutionGroupSelections || {};
          if (!selected) return;

          if (selected === "__clear__") {
            const currentId = this.weaponEvolutions[baseWeaponId];
            if (currentId) {
              const currentDef = getAttackEvolutionById(currentId);
              delete this.weaponEvolutions[baseWeaponId];
              if (currentDef?.groupId) delete this.evolutionGroupSelections[currentDef.groupId];
              console.info(`[Dev] Cleared transform for ${baseWeaponId}`);
            }
          } else {
            const evoDef = getAttackEvolutionById(selected);
            if (!evoDef) return;
            if (typeof this.applyTransformChoice === "function") {
              this.applyTransformChoice({
                baseWeaponId,
                evolutionId: evoDef.id
              });
            } else {
              this.weaponEvolutions[baseWeaponId] = evoDef.id;
              if (evoDef.groupId) this.evolutionGroupSelections[evoDef.groupId] = evoDef.id;
            }
            console.info(`[Dev] Forced transform: ${selected}`);
          }
          this.recalculateStats();
          if (this.buildLogRefresh) this.buildLogRefresh();
        });
      }

      const devRingSelect = document.getElementById("dev-ring-select");
      const devGiveRing = document.getElementById("dev-give-ring");
      const devRingProcLog = document.getElementById("dev-ring-proc-log");
      if (devRingSelect) {
        devRingSelect.innerHTML = '<option value="">-- Ring --</option>';
        for (const ring of getAllRingDefs()) {
          const opt = document.createElement("option");
          opt.value = ring.ringId;
          opt.textContent = `${ring.name} (${ring.rarity})`;
          devRingSelect.appendChild(opt);
        }
      }
      if (devGiveRing && devRingSelect) {
        this.addManagedListener(devGiveRing, "click", () => {
          const ringId = devRingSelect.value;
          if (!ringId) return;
          const ringDef = getRingDefById(ringId);
          if (!ringDef) return;
          const def = generateEquipmentItem("Ring", this.currentMap?.lootQuality ?? 0.6, 0.8, null, {});
          def.ringId = ringDef.ringId;
          def.name = ringDef.name;
          def.rarity = ringDef.rarity === "Normal" ? "common" : ringDef.rarity.toLowerCase();
          def.ringSpriteKey = ringDef.sprite;
          def.spriteCell = getRingSpriteCell(ringDef.sprite);
          def.description = ringDef.description;
          def.consumedOnTrigger = !!ringDef.consumedOnTrigger;
          this.inventory.push({
            id: 90000 + Math.floor(Math.random() * 10000),
            name: def.name,
            type: def.type,
            ringId: def.ringId || null,
            ringSpriteKey: def.ringSpriteKey || null,
            consumedOnTrigger: !!def.consumedOnTrigger,
            rolledModifiers: def.rolledModifiers || null,
            spriteCell: def.spriteCell || null,
            stats: def.stats || {},
            cardKey: null,
            description: def.description || "",
            weight: null,
            rarity: def.rarity || "common",
            modifiers: def.modifiers || [],
            baseStat: {},
            sockets: def.sockets ?? 0,
            vesselsMax: 0,
            vessels: []
          });
          this.updateInventoryUI();
        });
      }
      if (devRingProcLog) {
        this.addManagedListener(devRingProcLog, "change", () => {
          setRingProcLogging(this, devRingProcLog.checked);
        });
      }
      // Shrine spawner
      const devShrineSelect = document.getElementById("dev-shrine-select");
      const devSpawnShrine = document.getElementById("dev-spawn-shrine");
      if (devShrineSelect && devSpawnShrine) {
        devShrineSelect.innerHTML = '<option value="">-- Select shrine --</option>';
        for (const shrine of SHRINE_DEFS) {
          const opt = document.createElement("option");
          opt.value = shrine.id;
          opt.textContent = shrine.name;
          devShrineSelect.appendChild(opt);
        }
        this.addManagedListener(devSpawnShrine, "click", () => {
          const shrineId = devShrineSelect.value;
          if (!shrineId) return;
          const shrineDef = SHRINE_DEFS.find(s => s.id === shrineId);
          if (!shrineDef) return;
          
          // Spawn shrine near player (offset by 100 pixels)
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const offsetX = 100 + Math.random() * 50;
          const offsetY = 100 + Math.random() * 50;
          const sx = Math.max(
            this.world.wallThickness + 32,
            Math.min(px + offsetX, this.world.width - this.world.wallThickness - 96)
          );
          const sy = Math.max(
            this.world.wallThickness + 32,
            Math.min(py + offsetY, this.world.height - this.world.wallThickness - 96)
          );
          
          this.mapInteractables.push({
            type: "shrine",
            shrineId: shrineDef.id,
            shrineName: shrineDef.name,
            shrineDescription: shrineDef.description,
            shrineIcon: shrineDef.icon,
            shrineColor: shrineDef.color,
            shrineAuraColor: shrineDef.auraColor,
            x: sx - 32,
            y: sy - 32,
            w: 64,
            h: 64,
            used: false
          });
        });
      }

      const devNpcSelect = document.getElementById("dev-npc-select");
      const devSpawnNpc = document.getElementById("dev-spawn-npc");
      if (devNpcSelect && devSpawnNpc) {
        devNpcSelect.innerHTML = '<option value="">-- Select NPC --</option>';
        for (const [npcKey, def] of Object.entries(NPC_DEFS)) {
          const opt = document.createElement("option");
          opt.value = npcKey;
          opt.textContent = def.name;
          devNpcSelect.appendChild(opt);
        }
        this.addManagedListener(devSpawnNpc, "click", () => {
          const npcKey = devNpcSelect.value;
          if (!npcKey) return;
          this.spawnDevNpcNearPlayer(npcKey);
        });
      }
    },

    toggleDevPanel() {
      if (!this.devPanelEl) return;
      const hidden = this.devPanelEl.classList.contains("dev-panel-hidden");
      if (hidden) {
        this.devPanelEl.classList.remove("dev-panel-hidden");
        this.initDevStatsSliders();
      } else {
        this.devPanelEl.classList.add("dev-panel-hidden");
      }
    },

    spawnUpgradeCardToInventory(_cardDef) {
      // Upgrade cards removed
    },

    handleDevGiveAllCards() {
      // Upgrade cards removed
    },

    handleDevGiveAllCubes() {
      for (const cube of MODIFIER_CUBES) {
        for (let t = 1; t <= 3; t++) this.addCubeToInventory(`${cube.id}T${t}`);
      }
      for (const cube of UPGRADE_CUBES) {
        for (let t = 1; t <= 3; t++) this.addCubeToInventory(`${cube.id}T${t}`);
      }
      for (const cube of LEGENDARY_CUBES) {
        this.addCubeToInventory(cube.id);
      }
    },

    handleDevRandomItem() {
      const types = ["Helmet", "Body Armour", "Weapon", "Boots", "Ring"];
      const type = types[Math.floor(Math.random() * types.length)];
      const forceRarity = Math.random() < 0.5 ? "magic" : "rare";
      const lootQuality = this.currentMap?.lootQuality ?? 0.5;
      const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
      const def = generateEquipmentItem(type, lootQuality, 0.5, forceRarity, { difficulty: diff });
      this.inventory.push({
        id: 70000 + Math.floor(Math.random() * 10000),
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
    },

    handleDevTeleportToBoss() {
      // Ensure boss exists, spawn if not
      if (!this.enemySystem.boss || this.enemySystem.boss.isDead) {
        this.enemySystem.spawnBoss(this);
      }
      
      const boss = this.enemySystem.boss;
      if (!boss) return;
      
      // Teleport player to near boss (offset by 200 pixels to the left)
      const bossCenterX = boss.position.x + boss.size / 2;
      const bossCenterY = boss.position.y + boss.size / 2;
      const margin = this.world.wallThickness;
      
      // Position player to the left of boss
      const teleportX = Math.max(margin, bossCenterX - 200 - this.player.size / 2);
      const teleportY = Math.max(margin, Math.min(bossCenterY - this.player.size / 2, this.world.height - margin - this.player.size));
      
      this.player.position.set(teleportX, teleportY);
      
      // Update camera to follow player
      if (this.camera) {
        this.camera.position.set(
          this.player.position.x + this.player.size / 2 - this.canvas.width / 2,
          this.player.position.y + this.player.size / 2 - this.canvas.height / 2
        );
      }
    },

    spawnDebugBreakables() {
      if (!this.breakables) this.breakables = [];
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const nextId = this.breakableNextId ?? 1;
      const defIds = ["crate_basic", "urn_magic", "chest_rare", "jar_1", "jar_2", "ore_sack"];
      const margin = this.world.wallThickness + 40;
      const radius = 120;
      let id = nextId;
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 40 + Math.random() * radius;
        const x = px + Math.cos(angle) * dist;
        const y = py + Math.sin(angle) * dist;
        const clampedX = Math.max(margin, Math.min(x, this.world.width - margin - 40));
        const clampedY = Math.max(margin, Math.min(y, this.world.height - margin - 40));
        const defId = defIds[Math.floor(Math.random() * defIds.length)];
        const def = BREAKABLE_DEFS[defId];
        if (!def) continue;
        const bx = clampedX - def.hitbox.w / 2;
        const by = clampedY - def.hitbox.h / 2;
        const b = new Breakable(id++, bx, by, defId);
        this.breakables.push(b);
      }
      this.breakableNextId = id;
    },

    spawnTestProps() {
      if (!this.searchableProps) this.searchableProps = [];
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const nextId = this.searchablePropNextId ?? 1;
      const typeIds = ["locker", "crate", "deadWarrior", "chest"];
      const margin = this.world.wallThickness + 40;
      const radius = 100;
      let id = nextId;
      for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 50 + Math.random() * radius;
        const x = px + Math.cos(angle) * dist;
        const y = py + Math.sin(angle) * dist;
        const typeId = typeIds[Math.floor(Math.random() * typeIds.length)];
        const def = SEARCHABLE_PROP_DEFS[typeId];
        if (!def) continue;
        const w = def.width ?? 32;
        const h = def.height ?? 32;
        const clampedX = Math.max(margin, Math.min(x, this.world.width - margin - w));
        const clampedY = Math.max(margin, Math.min(y, this.world.height - margin - h));
        const prop = new SearchableProp(id++, clampedX - w / 2, clampedY - h / 2, typeId);
        this.searchableProps.push(prop);
      }
      this.searchablePropNextId = id;
    },

    findDevNpcSpawnSpotNearPlayer(size = 56) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const margin = this.world.wallThickness + 24;
      const tries = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.25;
        const dist = 90 + Math.random() * 150;
        const x = px + Math.cos(angle) * dist - size / 2;
        const y = py + Math.sin(angle) * dist - size / 2;
        tries.push({
          x: Math.max(margin, Math.min(x, this.world.width - margin - size)),
          y: Math.max(margin, Math.min(y, this.world.height - margin - size))
        });
      }
      for (const p of tries) {
        const overlapObj = (this.mapInteractables || []).some(obj =>
          p.x < obj.x + obj.w && p.x + size > obj.x &&
          p.y < obj.y + obj.h && p.y + size > obj.y
        );
        if (overlapObj) continue;
        if (this.overlapsTileWall(p.x, p.y, size, size)) continue;
        return p;
      }
      return tries[0] || null;
    },

    spawnDevNpcNearPlayer(npcKey) {
      const def = NPC_DEFS[npcKey];
      if (!def) return;
      const npcWorldW = Math.max(1, Number(def.worldSize?.w) || 56);
      const npcWorldH = Math.max(1, Number(def.worldSize?.h) || 56);
      const size = Math.max(npcWorldW, npcWorldH);
      const spot = this.findDevNpcSpawnSpotNearPlayer(size);
      if (!spot) return;
      this.mapInteractables = this.mapInteractables || [];
      this.mapInteractables.push({
        type: def.type,
        npcName: def.name,
        spriteAtlas: def.sprite.atlas,
        spriteRect: { x: def.sprite.x, y: def.sprite.y, w: def.sprite.w, h: def.sprite.h },
        x: spot.x,
        y: spot.y,
        w: npcWorldW,
        h: npcWorldH,
        npcWorldW,
        npcWorldH,
        used: false,
        consumeOnInteract: false,
        interactionCount: 0,
        vaultSentCount: 0
      });
    },

    handleDevMaxStats() {
      this.devStatsOverride = {
        maxHealth: 999,
        currentHealth: 999,
        defense: 100,
        speed: 600,
        attack: 200
      };
      this.currentHealth = 999;
      this.recalculateStats();
      this.initDevStatsSliders();
    },

    initDevStatsSliders() {
      const container = document.getElementById("dev-stats-sliders");
      if (!container) return;
      const stats = this.devStatsOverride || { ...this.currentStats };
      const ranges = [
        { key: "maxHealth", label: "Max Health", min: 1, max: 999 },
        { key: "currentHealth", label: "Current Health", min: 0, max: 999 },
        { key: "defense", label: "Defense", min: 0, max: 100 },
        { key: "speed", label: "Speed", min: 50, max: 600 },
        { key: "attack", label: "Attack", min: 1, max: 200 }
      ];
      container.innerHTML = "";
      for (const r of ranges) {
        const val = r.key === "currentHealth" ? this.currentHealth : (stats[r.key] ?? 0);
        const row = document.createElement("div");
        row.className = "dev-stat-row";
        const label = document.createElement("label");
        label.textContent = r.label;
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = r.min;
        slider.max = r.max;
        slider.value = Math.round(val);
        slider.className = "dev-stat-slider";
        const valueSpan = document.createElement("span");
        valueSpan.className = "dev-stat-value";
        valueSpan.textContent = Math.round(val);
        this.addManagedListener(slider, "input", () => {
          const v = Number(slider.value);
          valueSpan.textContent = Math.round(v);
          if (!this.devStatsOverride) {
            this.devStatsOverride = { ...this.currentStats };
          }
          if (r.key === "currentHealth") {
            this.currentHealth = v;
          } else {
            this.devStatsOverride[r.key] = v;
          }
          this.recalculateStats();
        });
        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueSpan);
        container.appendChild(row);
      }
      
      // Add attack speed slider (separate from stats)
      const attackSpeedRow = document.createElement("div");
      attackSpeedRow.className = "dev-stat-row";
      const attackSpeedLabel = document.createElement("label");
      attackSpeedLabel.textContent = "Attack Speed";
      const attackSpeedSlider = document.createElement("input");
      attackSpeedSlider.type = "range";
      attackSpeedSlider.min = 0.1;
      attackSpeedSlider.max = 2.0;
      attackSpeedSlider.step = 0.05;
      attackSpeedSlider.value = this.devAttackCooldownOverride ?? this.playerAttackCooldown;
      attackSpeedSlider.className = "dev-stat-slider";
      const attackSpeedValueSpan = document.createElement("span");
      attackSpeedValueSpan.className = "dev-stat-value";
      attackSpeedValueSpan.textContent = (this.devAttackCooldownOverride ?? this.playerAttackCooldown).toFixed(2);
      this.addManagedListener(attackSpeedSlider, "input", () => {
        const v = Number(attackSpeedSlider.value);
        attackSpeedValueSpan.textContent = v.toFixed(2);
        this.devAttackCooldownOverride = v;
        this.playerAttackCooldown = v;
      });
      attackSpeedRow.appendChild(attackSpeedLabel);
      attackSpeedRow.appendChild(attackSpeedSlider);
      attackSpeedRow.appendChild(attackSpeedValueSpan);
      container.appendChild(attackSpeedRow);
    }
  });
}
