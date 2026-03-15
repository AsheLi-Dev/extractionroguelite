// -------- Game Map Methods Mixin --------
// Map transitions, obstacles
// This module adds methods to Game.prototype when imported

import { MAP_DEFS, createProceduralWorld, PRESET_MEDIUM, getBiomeCellBounds, BIOME_ARCHETYPE, BIOME_GRID_COLS, BIOME_GRID_ROWS } from '../data/maps.js';
import { REST_ROOM_LAYOUT, REST_ROOM_MAP_DEF, REST_ROOM_MAP_ID, REST_ROOM_WORLD_PRESET, isRestRoomMapId } from '../data/rest-room.js';
import { OBSTACLE_TYPES } from '../data/obstacles.js';
import { BREAKABLE_DEFS } from '../data/breakables-data.js';
import { SEARCHABLE_PROP_DEFS } from '../data/searchable-props-data.js';
import { generateEquipmentItem } from '../data/loot-data.js';
import { SHRINE_DEFS } from '../data/shrines.js';
import { NPC_DEFS } from '../data/npc-data.js';
import { Obstacle } from '../entities/obstacle.js';
import { Breakable } from '../entities/breakable.js';
import { SearchableProp } from '../entities/searchable-prop.js';
import { ENEMY_TYPES, UNDEAD_HERO_TYPES, AFFIX_DEFS, Enemy } from '../entities/enemy.js';
import { HazardSystem } from '../entities/hazard.js';
import { LootItem } from '../entities/loot.js';
import { hasTalent } from '../data/talents.js';
import { preloadSound } from '../audio.js';
import { Totem } from '../entities/totem.js';

export function applyGameMapMixin(Game) {
  Object.assign(Game.prototype, {
    getMapDefById(mapId) {
      if (isRestRoomMapId(mapId)) return REST_ROOM_MAP_DEF;
      return MAP_DEFS.find((m) => m.id === mapId) || null;
    },

    shouldVisitRestRoomBeforeMap(targetMapId, spawnSide) {
      const currentId = Number(this.currentMapId);
      const nextId = Number(targetMapId);
      if (this.restRoomEnabled === false) return false;
      if (isRestRoomMapId(this.currentMapId) || isRestRoomMapId(targetMapId)) return false;
      if (!Number.isFinite(currentId) || !Number.isFinite(nextId)) return false;
      if (spawnSide !== "left") return false;
      return nextId > currentId;
    },

    setupRestRoomMapInteractables() {
      this.mapInteractables = [
        ...REST_ROOM_LAYOUT.stations.map((entry) => ({ ...entry })),
        { ...REST_ROOM_LAYOUT.exit }
      ];
      this.breakables = [];
      this.searchableProps = [];
    },

    /** Returns true if rect (x, y, w, h) overlaps any procedural tile wall. */
    overlapsTileWall(x, y, w, h) {
      const walls = this.world?.tileWallRects;
      if (!walls?.length) return false;
      for (const wall of walls) {
        if (x < wall.x + wall.w && x + w > wall.x &&
            y < wall.y + wall.h && y + h > wall.y) return true;
      }
      return false;
    },

    playerInExit(exit) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      return (
        px >= exit.x && px <= exit.x + exit.w &&
        py >= exit.y && py <= exit.y + exit.h
      );
    },

    trySpawnUndeadHeroForCurrentMap() {
      if (!this.enemySystem?.spawnUndeadHero) return null;
      if (!this.undeadHeroRunEnabled || this.undeadHeroSpawned) return null;
      const mapId = Number(this.currentMapId);
      const bossMapId = MAP_DEFS.length - 1;
      if (!Number.isFinite(mapId) || mapId === bossMapId) return null;
      if (!Number.isFinite(this.undeadHeroTargetMapId) || mapId !== this.undeadHeroTargetMapId) return null;
      const spawned = this.enemySystem.spawnUndeadHero(this);
      if (!spawned) return null;
      this.undeadHeroSpawned = true;
      this.undeadHeroSpawnMapId = mapId;
      return spawned;
    },

    saveMapEnemyState(mapId) {
      // Save current enemy state for this map
      const es = this.enemySystem;
      const validAffixIds = new Set(AFFIX_DEFS.map((affix) => affix.id));
      this.mapEnemyStates[mapId] = {
        enemies: es.enemies.map(e => ({
          id: e.id,
          enemyTypeId: e.enemyTypeId || null,
          position: { x: e.position.x, y: e.position.y },
          size: e.size,
          name: e.name,
          color: e.color,
          maxHealth: e.maxHealth,
          health: e.health,
          attack: e.attack,
          speed: e.speed,
          defense: e.defense,
          attackCooldown: e.attackCooldown,
          attackTimer: e.attackTimer,
          activated: e.activated,
          enemyTier: e.enemyTier,
          isElite: e.isElite,
          isSpecial: e.isSpecial,
          isUndeadHero: e.isUndeadHero,
          tierXpMult: e.tierXpMult,
          affixes: e.affixes ? e.affixes.filter((id) => validAffixIds.has(id)) : [],
          burnUntil: e.burnUntil,
          burnDps: e.burnDps,
          burnAccum: e.burnAccum || 0,
          toxicStacks: e.toxicStacks,
          toxicUntil: e.toxicUntil,
          toxicAccum: e.toxicAccum || 0,
          bleedStacks: e.bleedStacks || 0,
          bleedDps: e.bleedDps || 0,
          bleedTimer: e.bleedTimer || 0,
          bleedAccum: e.bleedAccum || 0,
          voidDefenseUntil: e.voidDefenseUntil,
          voidDefenseMult: e.voidDefenseMult,
          regenRate: e.regenRate,
          worldBounds: e.worldBounds
        })),
        boss: es.boss ? {
          id: es.boss.id,
          position: { x: es.boss.position.x, y: es.boss.position.y },
          size: es.boss.size,
          name: es.boss.name,
          color: es.boss.color,
          maxHealth: es.boss.maxHealth,
          health: es.boss.health,
          attack: es.boss.attack,
          speed: es.boss.speed,
          defense: es.boss.defense,
          attackCooldown: es.boss.attackCooldown,
          attackTimer: es.boss.attackTimer,
          phase2: es.boss.phase2,
          chargeCooldown: es.boss.chargeCooldown,
          chargeTimer: es.boss.chargeTimer,
          chargeActive: es.boss.chargeActive,
          chargeDir: es.boss.chargeDir ? { x: es.boss.chargeDir.x, y: es.boss.chargeDir.y } : null,
          projectileCooldown: es.boss.projectileCooldown,
          projectileTimer: es.boss.projectileTimer,
          minionCooldown: es.boss.minionCooldown,
          minionTimer: es.boss.minionTimer,
          burnUntil: es.boss.burnUntil,
          burnDps: es.boss.burnDps,
          burnAccum: es.boss.burnAccum || 0,
          slowUntil: es.boss.slowUntil,
          slowMult: es.boss.slowMult,
          stunUntil: es.boss.stunUntil,
          toxicStacks: es.boss.toxicStacks,
          toxicUntil: es.boss.toxicUntil,
          toxicAccum: es.boss.toxicAccum || 0,
          bleedStacks: es.boss.bleedStacks || 0,
          bleedDps: es.boss.bleedDps || 0,
          bleedTimer: es.boss.bleedTimer || 0,
          bleedAccum: es.boss.bleedAccum || 0,
          voidDefenseUntil: es.boss.voidDefenseUntil,
          voidDefenseMult: es.boss.voidDefenseMult
        } : null,
        projectiles: es.projectiles.map(p => ({
          position: { x: p.position.x, y: p.position.y },
          velocity: { x: p.velocity.x, y: p.velocity.y },
          damage: p.damage,
          size: p.size,
          lifetime: p.lifetime,
          maxLifetime: p.maxLifetime
        })),
        respawnQueue: [...es.respawnQueue]
      };
    },

    restoreMapEnemyState(mapId) {
      const savedState = this.mapEnemyStates[mapId];
      if (!savedState) {
        // No saved state, spawn initial enemies
        this.enemySystem.enemies = [];
        this.enemySystem.boss = null;
        this.enemySystem.projectiles = [];
        this.enemySystem.respawnQueue = [];
        this.enemySystem.spawnInitial(this);
        this.trySpawnUndeadHeroForCurrentMap();
        return;
      }

      const es = this.enemySystem;
      const allEnemyTypes = [...ENEMY_TYPES, ...UNDEAD_HERO_TYPES];
      const validAffixIds = new Set(AFFIX_DEFS.map((affix) => affix.id));
      const applyRestoredStack = (target, stackId, stackKey, value, targetType = "enemy") => {
        const restored = Math.max(0, Number(value) || 0);
        if (typeof this.applyStackDelta === "function") {
          this.applyStackDelta(target, stackId, restored, {
            stackKey,
            targetType,
            source: "map_restore",
            reason: "restore_map_enemy_state",
            mode: "set",
            min: 0,
            max: 999,
            skipPillarModifiers: true,
            skipCapResolution: true
          });
          return;
        }
        target[stackKey] = restored;
      };
      es.enemies = savedState.enemies.map(eData => {
        const base = allEnemyTypes.find((t) => t.id === eData.enemyTypeId) || allEnemyTypes.find((t) => t.name === eData.name);
        if (!base) return null;
        const enemy = new Enemy(eData.position.x, eData.position.y, {
          ...base,
          maxHealth: eData.maxHealth,
          attack: eData.attack,
          speed: eData.speed,
          defense: eData.defense,
          size: eData.size
        });
        enemy.id = eData.id;
        enemy.health = eData.health;
        enemy.attackCooldown = eData.attackCooldown;
        enemy.attackTimer = eData.attackTimer;
        enemy.activated = eData.activated;
        enemy.enemyTier = eData.enemyTier;
        enemy.isElite = eData.isElite;
        enemy.isSpecial = eData.isSpecial || eData.enemyTier === "special";
        enemy.isUndeadHero = !!eData.isUndeadHero;
        enemy.tierXpMult = eData.tierXpMult;
        enemy.affixes = eData.affixes ? eData.affixes.filter((id) => validAffixIds.has(id)) : [];
        enemy.burnUntil = eData.burnUntil;
        enemy.burnDps = eData.burnDps;
        enemy.burnAccum = eData.burnAccum || 0;
        applyRestoredStack(enemy, "enemy.toxic", "toxicStacks", eData.toxicStacks, "enemy");
        enemy.toxicUntil = eData.toxicUntil;
        enemy.toxicAccum = eData.toxicAccum || 0;
        applyRestoredStack(enemy, "enemy.bleed", "bleedStacks", eData.bleedStacks || 0, "enemy");
        enemy.bleedDps = eData.bleedDps || 0;
        enemy.bleedTimer = eData.bleedTimer || 0;
        enemy.bleedAccum = eData.bleedAccum || 0;
        enemy.voidDefenseUntil = eData.voidDefenseUntil;
        enemy.voidDefenseMult = eData.voidDefenseMult;
        enemy.regenRate = eData.regenRate;
        enemy.worldBounds = eData.worldBounds;
        return enemy;
      }).filter(Boolean);

      if (savedState.boss) {
        const bossData = savedState.boss;
        const Boss = this.enemySystem.BossClass;
        if (Boss) {
          const boss = new Boss(bossData.position.x, bossData.position.y);
          boss.id = bossData.id;
          boss.health = bossData.health;
          boss.maxHealth = bossData.maxHealth;
          boss.phase2 = bossData.phase2;
          boss.chargeCooldown = bossData.chargeCooldown;
          boss.chargeTimer = bossData.chargeTimer;
          boss.chargeActive = bossData.chargeActive;
          boss.chargeDir = bossData.chargeDir ? { x: bossData.chargeDir.x, y: bossData.chargeDir.y } : null;
          boss.projectileCooldown = bossData.projectileCooldown;
          boss.projectileTimer = bossData.projectileTimer;
          boss.minionCooldown = bossData.minionCooldown;
          boss.minionTimer = bossData.minionTimer;
          boss.burnUntil = bossData.burnUntil;
          boss.burnDps = bossData.burnDps;
          boss.burnAccum = bossData.burnAccum || 0;
          boss.slowUntil = bossData.slowUntil;
          boss.slowMult = bossData.slowMult;
          boss.stunUntil = bossData.stunUntil;
          applyRestoredStack(boss, "enemy.toxic", "toxicStacks", bossData.toxicStacks, "boss");
          boss.toxicUntil = bossData.toxicUntil;
          boss.toxicAccum = bossData.toxicAccum || 0;
          applyRestoredStack(boss, "enemy.bleed", "bleedStacks", bossData.bleedStacks || 0, "boss");
          boss.bleedDps = bossData.bleedDps || 0;
          boss.bleedTimer = bossData.bleedTimer || 0;
          boss.bleedAccum = bossData.bleedAccum || 0;
          boss.voidDefenseUntil = bossData.voidDefenseUntil;
          boss.voidDefenseMult = bossData.voidDefenseMult;
          es.boss = boss;
        }
      } else {
        es.boss = null;
      }

      // Restore projectiles (simplified - just clear them)
      es.projectiles = [];
      es.respawnQueue = savedState.respawnQueue || [];
    },

    checkExits() {
      if (this.exitTransitionCooldown > 0) return;
      const exits = this.world.proceduralExitZones || this.currentMap.exits;
      if (!exits || exits.length === 0) return;
      if (this.cursedChestBlocked) return;
      for (const exit of exits) {
        if (this.playerInExit(exit)) {
          this.transitionToMap(exit.targetMapId, exit.spawnSide);
          this.exitTransitionCooldown = 0.6;
          break;
        }
      }
    },

    saveMapEnvironmentalState(mapId) {
      // Save obstacles and mapInteractables for this map
      if (!this.mapEnvironmentalStates) {
        this.mapEnvironmentalStates = {};
      }
      this.mapEnvironmentalStates[mapId] = {
        obstacles: (this.obstacles || []).map(obs => ({
          id: obs.id,
          position: { x: obs.position.x, y: obs.position.y },
          type: obs.type,
          size: { w: obs.size.w, h: obs.size.h },
          treeTile: obs.treeTile ? { row: obs.treeTile.row, col: obs.treeTile.col } : null,
          destroyed: obs.destroyed,
          triggered: obs.triggered,
          meltTimer: obs.meltTimer
        })),
        breakables: (this.breakables || []).map(b => ({
          id: b.id,
          defId: b.defId,
          position: { x: b.position.x, y: b.position.y },
          hp: b.hp,
          maxHp: b.maxHp,
          isDead: b.isDead
        })),
        mapInteractables: (this.mapInteractables || [])
          .filter((obj) => obj.type !== "shop")
          .map(obj => ({ ...obj })),
        searchableProps: (this.searchableProps || []).map(p => ({
          id: p.id,
          typeId: p.typeId,
          x: p.position.x,
          y: p.position.y,
          isSearched: p.isSearched,
          isMiniBossLootChest: !!p.isMiniBossLootChest,
          keepVisibleWhenSearched: !!p.keepVisibleWhenSearched,
          phantomSpawnTriggered: !!p.phantomSpawnTriggered,
          pendingLootDefs: Array.isArray(p.pendingLootDefs) ? p.pendingLootDefs.map((d) => ({ ...d })) : null
        })),
        totems: (this.totems || []).map(t => ({
          typeId: t.typeId,
          zoneId: t.zoneId,
          x: t.position.x,
          y: t.position.y,
          health: t.health,
          maxHealth: t.maxHealth,
          isDead: t.isDead,
          deathAnimStartTime: t.deathAnimStartTime
        })),
        ambushZoneState: Object.fromEntries(
          Object.entries(this.ambushZoneState || {}).map(([id, s]) => [
            id,
            { triggered: s.triggered, complete: !!s.complete, rewardSpawned: !!s.rewardSpawned, themeId: s.themeId, themeName: s.themeName }
          ])
        ),
        hazardZoneState: Object.fromEntries(
          Object.entries(this.hazardZoneState || {}).map(([id, s]) => [
            id,
            { active: !!s.active, type: s.type }
          ])
        ),
        bloodAltarZoneState: Object.fromEntries(
          Object.entries(this.bloodAltarZoneState || {}).map(([id, s]) => [
            id,
            { charges: s.charges ?? 0, activated: !!s.activated, type: s.type }
          ])
        )
      };
    },

    restoreMapEnvironmentalState(mapId) {
      // Restore obstacles and mapInteractables for this map
      const savedState = this.mapEnvironmentalStates && this.mapEnvironmentalStates[mapId];
      if (!savedState) {
        console.warn(`No saved environmental state for map ${mapId}, spawning new elements`);
        this.spawnObstacles(mapId);
        this.spawnBreakablesForMap(this.currentMap, () => Math.random());
        this.spawnSearchableProps(this.currentMap, () => Math.random());
        this.saveMapEnvironmentalState(mapId);
        return;
      }

      this.obstacles = savedState.obstacles.map(obsData => {
        if (obsData.type === "barrel") return null;
        const typeDef = OBSTACLE_TYPES[obsData.type];
        if (!typeDef) return null;
        const obstacle = new Obstacle(obsData.position.x, obsData.position.y, typeDef);
        obstacle.id = obsData.id;
        if (obsData.treeTile) {
          const treeCol = (obsData.treeTile.row === 26 && obsData.treeTile.col === "d") ? "c" : obsData.treeTile.col;
          obstacle.treeTile = { row: obsData.treeTile.row, col: treeCol };
        }
        obstacle.destroyed = obsData.destroyed;
        obstacle.triggered = obsData.triggered || false;
        obstacle.meltTimer = obsData.meltTimer;
        return obstacle;
      }).filter(Boolean);

      this.breakables = (savedState.breakables || []).map(bData => {
        const def = BREAKABLE_DEFS[bData.defId];
        if (!def) return null;
        const b = new Breakable(bData.id, bData.position.x, bData.position.y, bData.defId);
        b.hp = bData.hp ?? b.maxHp;
        b.isDead = bData.isDead || false;
        return b;
      }).filter(Boolean);

      this.mapInteractables = savedState.mapInteractables
        ? savedState.mapInteractables.filter((obj) => obj.type !== "shop").map(obj => ({ ...obj }))
        : [];

      this.searchableProps = (savedState.searchableProps || []).map(pData => {
        const def = SEARCHABLE_PROP_DEFS[pData.typeId];
        if (!def) return null;
        const p = new SearchableProp(pData.id, pData.x, pData.y, pData.typeId);
        p.isSearched = pData.isSearched || false;
        p.isMiniBossLootChest = !!pData.isMiniBossLootChest;
        p.keepVisibleWhenSearched = !!(pData.keepVisibleWhenSearched || p.def?.keepVisibleWhenSearched);
        p.phantomSpawnTriggered = !!pData.phantomSpawnTriggered;
        p.pendingLootDefs = Array.isArray(pData.pendingLootDefs) ? pData.pendingLootDefs.map((d) => ({ ...d })) : null;
        return p;
      }).filter(Boolean);

      if (Array.isArray(savedState.totems)) {
        this.totems = savedState.totems.map(tData => {
          const t = new Totem(tData.x, tData.y, tData.typeId, tData.zoneId);
          t.health = tData.health ?? t.maxHealth;
          t.maxHealth = tData.maxHealth ?? t.maxHealth;
          if (tData.isDead || t.health <= 0) {
            t.isDead = true;
            t.deathAnimStartTime = tData.deathAnimStartTime ?? 0;
          }
          return t;
        });
      } else {
        this.totems = [];
      }

      if (savedState.ambushZoneState && typeof savedState.ambushZoneState === 'object') {
        this.ambushZoneState = {};
        for (const [id, s] of Object.entries(savedState.ambushZoneState)) {
          this.ambushZoneState[id] = {
            triggered: !!s.triggered,
            complete: !!s.complete,
            rewardSpawned: !!s.rewardSpawned,
            themeId: s.themeId,
            themeName: s.themeName,
            spawnSchedule: [],
            spawnPoints: [],
            spawnedEnemyIds: new Set(),
          };
        }
      } else {
        this.ambushZoneState = this.ambushZoneState || {};
      }

      if (savedState.hazardZoneState && typeof savedState.hazardZoneState === 'object') {
        this.hazardZoneState = {};
        for (const [id, s] of Object.entries(savedState.hazardZoneState)) {
          this.hazardZoneState[id] = {
            active: !!s.active,
            type: s.type || 'avalanche',
            snowOrbs: [],
            eruptionWarnings: [],
            swampPatches: [],
            fallingFireballs: [],
            windGustUntil: 0,
            windDirection: { x: 0, y: 0 },
            swampStacks: 0,
          };
        }
      } else {
        this.hazardZoneState = this.hazardZoneState || {};
      }

      if (savedState.bloodAltarZoneState && typeof savedState.bloodAltarZoneState === 'object') {
        this.bloodAltarZoneState = {};
        for (const [id, s] of Object.entries(savedState.bloodAltarZoneState)) {
          this.bloodAltarZoneState[id] = {
            charges: s.charges ?? 0,
            activated: !!s.activated,
            type: s.type || 'heal',
          };
        }
      } else {
        this.bloodAltarZoneState = this.bloodAltarZoneState || {};
      }
    },

    spawnBreakablesForMap(map, rng = Math.random) {
      this.breakables = this.breakables || [];
      const world = this.world;
      const tileGrid = world.tileGrid;
      const tileSize = world.tileSize || 32;
      const count = 6 + Math.floor(rng() * 10);
      const nextId = (this.breakableNextId ?? 1);
      const weights = [
        { id: "crate_basic", w: 48 },
        { id: "urn_magic", w: 16 },
        { id: "chest_rare", w: 4 },
        { id: "jar_1", w: 14 },
        { id: "jar_2", w: 12 },
        { id: "ore_sack", w: 6 }
      ];
      const totalW = weights.reduce((s, x) => s + x.w, 0);
      const pickDefId = () => {
        let v = rng() * totalW;
        for (const w of weights) {
          v -= w.w;
          if (v <= 0) return w.id;
        }
        return weights[0].id;
      };

      const margin = (world.wallThickness || 32) + 60;
      const maxX = world.width - margin - 48;
      const maxY = world.height - margin - 48;

      if (tileGrid && tileSize) {
        const W = tileGrid[0].length;
        const H = tileGrid.length;
        const startPixel = world.startPixel || { x: tileSize * 2, y: (H / 2) * tileSize };
        const exitPixel = world.exitPixel || { x: (W - 3) * tileSize, y: (H / 2) * tileSize };
        const startGx = Math.floor(startPixel.x / tileSize);
        const startGy = Math.floor(startPixel.y / tileSize);
        const exitGx = Math.floor(exitPixel.x / tileSize);
        const exitGy = Math.floor(exitPixel.y / tileSize);
        const excludeRadius = 4;
        const WALL = 1;
        const FLOOR = 0;
        const candidates = [];
        for (let gy = 1; gy < H - 1; gy++) {
          for (let gx = 1; gx < W - 1; gx++) {
            if (tileGrid[gy][gx] !== FLOOR) continue;
            const distStart = Math.max(Math.abs(gx - startGx), Math.abs(gy - startGy));
            const distExit = Math.max(Math.abs(gx - exitGx), Math.abs(gy - exitGy));
            if (distStart < excludeRadius || distExit < excludeRadius) continue;
            let wallNeighbors = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ny = gy + dy, nx = gx + dx;
              if (ny >= 0 && ny < H && nx >= 0 && nx < W && tileGrid[ny][nx] === WALL) wallNeighbors++;
            }
            candidates.push({ gx, gy, wallNeighbors });
          }
        }
        candidates.sort((a, b) => b.wallNeighbors - a.wallNeighbors);
        const used = new Set();
        const topCandidateCount = Math.min(candidates.length, Math.max(count * 12, 80));
        const candidatePool = candidates.slice(0, topCandidateCount);
        let placed = 0;
        while (candidatePool.length > 0 && placed < count) {
          const pickIdx = Math.floor(Math.random() * candidatePool.length);
          const c = candidatePool.splice(pickIdx, 1)[0];
          const key = `${c.gx},${c.gy}`;
          if (used.has(key)) continue;
          const defId = pickDefId();
          const def = BREAKABLE_DEFS[defId];
          if (!def) continue;
          const px = c.gx * tileSize + (tileSize - def.hitbox.w) / 2;
          const py = c.gy * tileSize + (tileSize - def.hitbox.h) / 2;
          const overlap = (this.obstacles || []).some(obs =>
            px < obs.position.x + obs.size.w && px + def.hitbox.w > obs.position.x &&
            py < obs.position.y + obs.size.h && py + def.hitbox.h > obs.position.y
          );
          if (overlap) continue;
          if (this.overlapsTileWall(px, py, def.hitbox.w, def.hitbox.h)) continue;
          used.add(key);
          const b = new Breakable(nextId + placed, px, py, defId);
          this.breakables.push(b);
          placed++;
        }
        this.breakableNextId = nextId + placed;
        return;
      }

      // Fallback: no tile grid (e.g. non-procedural map)  place breakables randomly in playable area
      let placed = 0;
      const maxAttempts = count * 40;
      for (let attempt = 0; attempt < maxAttempts && placed < count; attempt++) {
        const x = margin + rng() * Math.max(0, maxX - margin);
        const y = margin + rng() * Math.max(0, maxY - margin);
        const defId = pickDefId();
        const def = BREAKABLE_DEFS[defId];
        if (!def) continue;
        const overlapObs = (this.obstacles || []).some(obs =>
          x < obs.position.x + obs.size.w && x + def.hitbox.w > obs.position.x &&
          y < obs.position.y + obs.size.h && y + def.hitbox.h > obs.position.y
        );
        const overlapBreak = (this.breakables || []).some(b =>
          x < b.position.x + b.hitbox.w && x + def.hitbox.w > b.position.x &&
          y < b.position.y + b.hitbox.h && y + def.hitbox.h > b.position.y
        );
        if (overlapObs || overlapBreak) continue;
        if (this.overlapsTileWall(x, y, def.hitbox.w, def.hitbox.h)) continue;
        const b = new Breakable(nextId + placed, x, y, defId);
        this.breakables.push(b);
        placed++;
      }
      this.breakableNextId = nextId + placed;
    },

    spawnSearchableProps(map, rng = Math.random) {
      this.searchableProps = this.searchableProps || [];
      const world = this.world;
      const tileGrid = world?.tileGrid;
      const tileSize = world?.tileSize || 32;
      const count = 5 + Math.floor(rng() * 8);
      const nextId = (this.searchablePropNextId ?? 1);
      const weights = [
        { typeId: "crate", w: 45 },
        { typeId: "locker", w: 25 },
        { typeId: "deadWarrior", w: 15 },
        { typeId: "chest", w: 15 }
      ];
      const totalW = weights.reduce((s, x) => s + x.w, 0);
      const pickTypeId = () => {
        let v = rng() * totalW;
        for (const w of weights) {
          v -= w.w;
          if (v <= 0) return w.typeId;
        }
        return weights[0].typeId;
      };

      const margin = (world?.wallThickness || 32) + 60;
      const maxX = (world?.width || 800) - margin - 48;
      const maxY = (world?.height || 600) - margin - 48;

      const overlapsAnything = (x, y, w, h, excludeProp) => {
        if ((this.obstacles || []).some(obs =>
          x < obs.position.x + obs.size.w && x + w > obs.position.x &&
          y < obs.position.y + obs.size.h && y + h > obs.position.y
        )) return true;
        if ((this.breakables || []).some(b =>
          x < b.position.x + b.hitbox.w && x + w > b.position.x &&
          y < b.position.y + b.hitbox.h && y + h > b.position.y
        )) return true;
        if ((this.searchableProps || []).some(p => p !== excludeProp &&
          x < p.position.x + p.width && x + w > p.position.x &&
          y < p.position.y + p.height && y + h > p.position.y
        )) return true;
        return false;
      };
      const maybeMarkAsOpenedEmpty = (prop) => {
        if (!prop || rng() >= 0.5) return;
        prop.isSearched = true;
        prop.pendingLootDefs = [];
        prop.keepVisibleWhenSearched = true;
      };

      if (tileGrid && tileSize) {
        const W = tileGrid[0].length;
        const H = tileGrid.length;
        const startPixel = world.startPixel || { x: tileSize * 2, y: (H / 2) * tileSize };
        const exitPixel = world.exitPixel || { x: (W - 3) * tileSize, y: (H / 2) * tileSize };
        const startGx = Math.floor(startPixel.x / tileSize);
        const startGy = Math.floor(startPixel.y / tileSize);
        const exitGx = Math.floor(exitPixel.x / tileSize);
        const exitGy = Math.floor(exitPixel.y / tileSize);
        const excludeRadius = 4;
        const WALL = 1;
        const FLOOR = 0;
        const candidates = [];
        for (let gy = 1; gy < H - 1; gy++) {
          for (let gx = 1; gx < W - 1; gx++) {
            if (tileGrid[gy][gx] !== FLOOR) continue;
            const distStart = Math.max(Math.abs(gx - startGx), Math.abs(gy - startGy));
            const distExit = Math.max(Math.abs(gx - exitGx), Math.abs(gy - exitGy));
            if (distStart < excludeRadius || distExit < excludeRadius) continue;
            let wallNeighbors = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ny = gy + dy, nx = gx + dx;
              if (ny >= 0 && ny < H && nx >= 0 && nx < W && tileGrid[ny][nx] === WALL) wallNeighbors++;
            }
            candidates.push({ gx, gy, wallNeighbors });
          }
        }
        candidates.sort((a, b) => b.wallNeighbors - a.wallNeighbors);
        const used = new Set();
        const topCandidateCount = Math.min(candidates.length, Math.max(count * 12, 80));
        const candidatePool = candidates.slice(0, topCandidateCount);
        let placed = 0;
        while (candidatePool.length > 0 && placed < count) {
          const pickIdx = Math.floor(Math.random() * candidatePool.length);
          const c = candidatePool.splice(pickIdx, 1)[0];
          const key = `${c.gx},${c.gy}`;
          if (used.has(key)) continue;
          const typeId = pickTypeId();
          const def = SEARCHABLE_PROP_DEFS[typeId];
          if (!def) continue;
          const w = def.width ?? 32;
          const h = def.height ?? 32;
          const px = c.gx * tileSize + (tileSize - w) / 2;
          const py = c.gy * tileSize + (tileSize - h) / 2;
          if (overlapsAnything(px, py, w, h, null)) continue;
          if (this.overlapsTileWall(px, py, w, h)) continue;
          used.add(key);
          const prop = new SearchableProp(nextId + placed, px, py, typeId);
          maybeMarkAsOpenedEmpty(prop);
          this.searchableProps.push(prop);
          placed++;
        }
        this.searchablePropNextId = nextId + placed;
        return;
      }

      let placed = 0;
      const maxAttempts = count * 40;
      for (let attempt = 0; attempt < maxAttempts && placed < count; attempt++) {
        const x = margin + rng() * Math.max(0, maxX - margin);
        const y = margin + rng() * Math.max(0, maxY - margin);
        const typeId = pickTypeId();
        const def = SEARCHABLE_PROP_DEFS[typeId];
        if (!def) continue;
        const w = def.width ?? 32;
        const h = def.height ?? 32;
        if (overlapsAnything(x, y, w, h, null)) continue;
        if (this.overlapsTileWall(x, y, w, h)) continue;
        const prop = new SearchableProp(nextId + placed, x, y, typeId);
        maybeMarkAsOpenedEmpty(prop);
        this.searchableProps.push(prop);
        placed++;
      }
      this.searchablePropNextId = nextId + placed;
    },

    spawnBreakablesForBiome() {
      this.breakables = this.breakables || [];
      const data = this.world.archetypeGrid;
      if (!data?.grid) return;
      const tileSize = this.world.tileSize || 32;
      const tileGrid = this.world.tileGrid;
      const WALL = 1;
      const FLOOR = 0;
      const nextId = this.breakableNextId ?? 1;
      const weights = [
        { id: 'crate_basic', w: 48 },
        { id: 'urn_magic', w: 16 },
        { id: 'jar_1', w: 14 },
        { id: 'jar_2', w: 12 },
        { id: 'ore_sack', w: 6 }
      ];
      const totalW = weights.reduce((s, x) => s + x.w, 0);
      const pickDefId = () => {
        let v = Math.random() * totalW;
        for (const w of weights) {
          v -= w.w;
          if (v <= 0) return w.id;
        }
        return weights[0].id;
      };
      let placed = 0;
      for (let row = 0; row < BIOME_GRID_ROWS; row++) {
        for (let col = 0; col < BIOME_GRID_COLS; col++) {
          const archetype = data.grid[row][col];
          if (archetype === BIOME_ARCHETYPE.START || archetype === BIOME_ARCHETYPE.EXIT) continue;
          if (archetype === BIOME_ARCHETYPE.LOST_CAMPS || archetype === BIOME_ARCHETYPE.MINIBOSS) continue;
          let count = 1 + Math.floor(Math.random() * 3);
          const bounds = getBiomeCellBounds(this.world, col, row);
          const margin = this.world.wallThickness + 40;
          const inner = { x: bounds.x + margin, y: bounds.y + margin, w: Math.max(0, bounds.w - 2 * margin), h: Math.max(0, bounds.h - 2 * margin) };
          for (let i = 0; i < count; i++) {
            const defId = pickDefId();
            const def = BREAKABLE_DEFS[defId];
            if (!def) continue;
            let px = inner.x + Math.random() * Math.max(0, inner.w - def.hitbox.w);
            let py = inner.y + Math.random() * Math.max(0, inner.h - def.hitbox.h);
            const gx = Math.floor(px / tileSize);
            const gy = Math.floor(py / tileSize);
            if (tileGrid && (gy < 1 || gy >= tileGrid.length - 1 || gx < 1 || gx >= tileGrid[0].length - 1 || tileGrid[gy][gx] === WALL)) continue;
            const overlap = (this.obstacles || []).some(obs =>
              px < obs.position.x + obs.size.w && px + def.hitbox.w > obs.position.x &&
              py < obs.position.y + obs.size.h && py + def.hitbox.h > obs.position.y
            ) || (this.breakables || []).some(b =>
              px < b.position.x + b.hitbox.w && px + def.hitbox.w > b.position.x &&
              py < b.position.y + b.hitbox.h && py + def.hitbox.h > b.position.y
            );
            if (overlap) continue;
            if (this.overlapsTileWall(px, py, def.hitbox.w, def.hitbox.h)) continue;
            this.breakables.push(new Breakable(nextId + placed, px, py, defId));
            placed++;
          }
        }
      }
      this.breakableNextId = nextId + placed;
    },

    spawnSearchablePropsForBiome() {
      this.searchableProps = this.searchableProps || [];
      const data = this.world.archetypeGrid;
      if (!data?.grid) return;
      const tileSize = this.world.tileSize || 32;
      const tileGrid = this.world.tileGrid;
      const WALL = 1;
      const FLOOR = 0;
      const nextId = this.searchablePropNextId ?? 1;
      const weights = [
        { typeId: 'crate', w: 45 },
        { typeId: 'locker', w: 25 },
        { typeId: 'deadWarrior', w: 15 },
        { typeId: 'chest', w: 15 }
      ];
      const totalW = weights.reduce((s, x) => s + x.w, 0);
      const pickTypeId = () => {
        let v = Math.random() * totalW;
        for (const w of weights) {
          v -= w.w;
          if (v <= 0) return w.typeId;
        }
        return weights[0].typeId;
      };
      let placed = 0;
      const corridorMiddlePoints = this.world.corridorMiddlePoints || {};
      const chestDef = SEARCHABLE_PROP_DEFS.chest;
      const chestW = chestDef?.width ?? 32;
      const chestH = chestDef?.height ?? 32;
      const clusterRadiusTiles = 2;
      const findNearestFloorTile = (startGx, startGy, radius = 3) => {
        if (!tileGrid) return { gx: startGx, gy: startGy };
        const W = tileGrid[0]?.length ?? 0;
        const H = tileGrid.length ?? 0;
        const inBounds = (gx, gy) => gx >= 1 && gx < W - 1 && gy >= 1 && gy < H - 1;
        if (inBounds(startGx, startGy) && tileGrid[startGy][startGx] !== WALL) return { gx: startGx, gy: startGy };
        for (let r = 1; r <= radius; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) + Math.abs(dy) !== r) continue; // ring
              const gx = startGx + dx;
              const gy = startGy + dy;
              if (!inBounds(gx, gy)) continue;
              if (tileGrid[gy][gx] !== WALL) return { gx, gy };
            }
          }
        }
        return { gx: startGx, gy: startGy };
      };
      const getPathMidpointBetweenInteriorPoints = (p1, p2) => {
        // Path between interior points is carved as: vertical to (p1.gx, p2.gy) then horizontal to (p2.gx, p2.gy).
        const vLen = Math.abs(p2.gy - p1.gy);
        const hLen = Math.abs(p2.gx - p1.gx);
        const total = vLen + hLen;
        if (total <= 0) return { gx: p1.gx, gy: p1.gy };
        const half = total / 2;
        if (half <= vLen) {
          const sy = p2.gy >= p1.gy ? 1 : -1;
          return { gx: p1.gx, gy: p1.gy + sy * Math.round(half) };
        }
        const sx = p2.gx >= p1.gx ? 1 : -1;
        return { gx: p1.gx + sx * Math.round(half - vLen), gy: p2.gy };
      };
      const tryPlaceChestCluster = (centerGx, centerGy) => {
        const count = 3 + Math.floor(Math.random() * 3);
        let clusterPlaced = 0;
        for (let tries = 0; tries < count * 8 && clusterPlaced < count; tries++) {
          const offsetGx = (Math.random() * 2 - 1) * clusterRadiusTiles;
          const offsetGy = (Math.random() * 2 - 1) * clusterRadiusTiles;
          const px = (centerGx + offsetGx) * tileSize + (tileSize - chestW) / 2;
          const py = (centerGy + offsetGy) * tileSize + (tileSize - chestH) / 2;
          const gx = Math.floor(px / tileSize);
          const gy = Math.floor(py / tileSize);
          if (tileGrid && (gy < 1 || gy >= tileGrid.length - 1 || gx < 1 || gx >= tileGrid[0].length - 1 || tileGrid[gy][gx] === WALL)) continue;
          const overlap = (this.obstacles || []).some(obs =>
            px < obs.position.x + obs.size.w && px + chestW > obs.position.x &&
            py < obs.position.y + obs.size.h && py + chestH > obs.position.y
          ) || (this.searchableProps || []).some(p =>
            px < p.position.x + p.width && px + chestW > p.position.x &&
            py < p.position.y + p.height && py + chestH > p.position.y
          ) || (this.breakables || []).some(b =>
            px < b.position.x + b.hitbox.w && px + chestW > b.position.x &&
            py < b.position.y + b.hitbox.h && py + chestH > b.position.y
          );
          if (overlap) continue;
          if (this.overlapsTileWall(px, py, chestW, chestH)) continue;
          const prop = new SearchableProp(nextId + placed, px, py, 'chest');
          this.searchableProps.push(prop);
          placed++;
          clusterPlaced++;
        }
      };
      for (let row = 0; row < BIOME_GRID_ROWS; row++) {
        for (let col = 0; col < BIOME_GRID_COLS; col++) {
          const archetype = data.grid[row][col];
          if (archetype === BIOME_ARCHETYPE.START || archetype === BIOME_ARCHETYPE.EXIT) continue;
          if (archetype === BIOME_ARCHETYPE.MINIBOSS) continue;
          const points = corridorMiddlePoints[`${row}_${col}`];
          if (archetype === BIOME_ARCHETYPE.CORRIDORS && points?.length === 2) {
            const mid = getPathMidpointBetweenInteriorPoints(points[0], points[1]);
            const snapped = findNearestFloorTile(mid.gx, mid.gy, 4);
            tryPlaceChestCluster(snapped.gx, snapped.gy);
          }
          if (archetype === BIOME_ARCHETYPE.OPEN_SPACE) {
            const bounds = getBiomeCellBounds(this.world, col, row);
            const centerGx = Math.floor((bounds.x + bounds.w / 2) / tileSize);
            const centerGy = Math.floor((bounds.y + bounds.h / 2) / tileSize);
            const base = findNearestFloorTile(centerGx, centerGy, 6);
            const offsets = [
              { dx: -2, dy: 0 },
              { dx: 0, dy: 0 },
              { dx: 2, dy: 0 }
            ];
            const rareTypes = ["Weapon", "Helmet", "Body Armour", "Boots", "Ring"];
            for (let i = 0; i < offsets.length; i++) {
              const t = offsets[i];
              const snapped = findNearestFloorTile(base.gx + t.dx, base.gy + t.dy, 4);
              const px = snapped.gx * tileSize + (tileSize - chestW) / 2;
              const py = snapped.gy * tileSize + (tileSize - chestH) / 2;
              const overlap = (this.obstacles || []).some(obs =>
                px < obs.position.x + obs.size.w && px + chestW > obs.position.x &&
                py < obs.position.y + obs.size.h && py + chestH > obs.position.y
              ) || (this.searchableProps || []).some(p =>
                px < p.position.x + p.width && px + chestW > p.position.x &&
                py < p.position.y + p.height && py + chestH > p.position.y
              ) || (this.breakables || []).some(b =>
                px < b.position.x + b.hitbox.w && px + chestW > b.position.x &&
                py < b.position.y + b.hitbox.h && py + chestH > b.position.y
              );
              if (overlap) continue;
              if (this.overlapsTileWall(px, py, chestW, chestH)) continue;
              const prop = new SearchableProp(nextId + placed, px, py, 'chest');
              if (i === 2) {
                const roll = Math.random();
                const type = rareTypes[Math.floor(Math.random() * rareTypes.length)];
                const diff = this.difficulty ?? null;
                const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
                const equipOpts = diff != null ? { difficulty: diff, luck } : { luck };
                if (roll < 0.10) {
                  prop.pendingLootDefs = [generateEquipmentItem(type, 1, 0.8, "rare", equipOpts)];
                } else if (roll < 0.60) {
                  prop.pendingLootDefs = [generateEquipmentItem(type, 0.8, 0.3, "magic", equipOpts)];
                } else {
                  prop.spawnEliteOnOpen = true;
                }
              } else {
                prop.spawnEliteOnOpen = true;
              }
              this.searchableProps.push(prop);
              placed++;
            }
          }
          if (archetype === BIOME_ARCHETYPE.WOODS) {
            const bounds = getBiomeCellBounds(this.world, col, row);
            const margin = this.world.wallThickness + 40;
            const inner = { x: bounds.x + margin, y: bounds.y + margin, w: Math.max(0, bounds.w - 2 * margin), h: Math.max(0, bounds.h - 2 * margin) };
            const chestCount = 7 + Math.floor(Math.random() * 3);
            for (let i = 0; i < chestCount; i++) {
              for (let attempt = 0; attempt < 25; attempt++) {
                const px = inner.x + Math.random() * Math.max(0, inner.w - chestW);
                const py = inner.y + Math.random() * Math.max(0, inner.h - chestH);
                const gx = Math.floor(px / tileSize);
                const gy = Math.floor(py / tileSize);
                if (tileGrid && (gy < 1 || gy >= tileGrid.length - 1 || gx < 1 || gx >= tileGrid[0].length - 1 || tileGrid[gy][gx] === WALL)) continue;
                const overlap = (this.obstacles || []).some(obs =>
                  px < obs.position.x + obs.size.w && px + chestW > obs.position.x &&
                  py < obs.position.y + obs.size.h && py + chestH > obs.position.y
                ) || (this.searchableProps || []).some(p =>
                  px < p.position.x + p.width && px + chestW > p.position.x &&
                  py < p.position.y + p.height && py + chestH > p.position.y
                ) || (this.breakables || []).some(b =>
                  px < b.position.x + b.hitbox.w && px + chestW > b.position.x &&
                  py < b.position.y + b.hitbox.h && py + chestH > b.position.y
                );
                if (overlap) continue;
                if (this.overlapsTileWall(px, py, chestW, chestH)) continue;
                const prop = new SearchableProp(nextId + placed, px, py, 'chest');
                this.searchableProps.push(prop);
                placed++;
                break;
              }
            }
          }
          let count = (archetype === BIOME_ARCHETYPE.LOST_CAMPS || archetype === BIOME_ARCHETYPE.VAULT || archetype === BIOME_ARCHETYPE.WOODS) ? 0 : 1 + Math.floor(Math.random() * 2);
          const bounds = getBiomeCellBounds(this.world, col, row);
          const margin = this.world.wallThickness + 40;
          const inner = { x: bounds.x + margin, y: bounds.y + margin, w: Math.max(0, bounds.w - 2 * margin), h: Math.max(0, bounds.h - 2 * margin) };
          for (let i = 0; i < count; i++) {
            const typeId = pickTypeId();
            const def = SEARCHABLE_PROP_DEFS[typeId];
            const w = def?.width ?? 32;
            const h = def?.height ?? 32;
            let px = inner.x + Math.random() * Math.max(0, inner.w - w);
            let py = inner.y + Math.random() * Math.max(0, inner.h - h);
            const gx = Math.floor(px / tileSize);
            const gy = Math.floor(py / tileSize);
            if (tileGrid && (gy < 1 || gy >= tileGrid.length - 1 || gx < 1 || gx >= tileGrid[0].length - 1 || tileGrid[gy][gx] === WALL)) continue;
            const overlap = (this.obstacles || []).some(obs =>
              px < obs.position.x + obs.size.w && px + w > obs.position.x &&
              py < obs.position.y + obs.size.h && py + h > obs.position.y
            ) || (this.searchableProps || []).some(p =>
              px < p.position.x + p.width && px + w > p.position.x &&
              py < p.position.y + p.height && py + h > p.position.y
            ) || (this.breakables || []).some(b =>
              px < b.position.x + b.hitbox.w && px + w > b.position.x &&
              py < b.position.y + b.hitbox.h && py + h > b.position.y
            );
            if (overlap) continue;
            if (this.overlapsTileWall(px, py, w, h)) continue;
            const prop = new SearchableProp(nextId + placed, px, py, typeId);
            this.searchableProps.push(prop);
            placed++;
          }
        }
      }
      const lostCampChests = this.world.lostCampChestPositions || [];
      for (const pos of lostCampChests) {
        const px = pos.x;
        const py = pos.y;
        const prop = new SearchableProp(nextId + placed, px, py, 'chest');
        this.searchableProps.push(prop);
        placed++;
      }

      // START cell: guaranteed low-roll common equipment chest (1 weapon + 2 of helmet/body/boots).
      const startCell = data.startCell;
      if (startCell) {
        const bounds = getBiomeCellBounds(this.world, startCell.col, startCell.row);
        const centerGx = Math.floor((bounds.x + bounds.w / 2) / tileSize);
        const centerGy = Math.floor((bounds.y + bounds.h / 2) / tileSize);
        const snapped = findNearestFloorTile(centerGx, centerGy, 6);
        const chestDef = SEARCHABLE_PROP_DEFS.chest;
        const w = chestDef?.width ?? 32;
        const h = chestDef?.height ?? 32;
        const px = snapped.gx * tileSize + (tileSize - w) / 2;
        const py = snapped.gy * tileSize + (tileSize - h) / 2;
        const overlap =
          (this.obstacles || []).some(obs =>
            px < obs.position.x + obs.size.w && px + w > obs.position.x &&
            py < obs.position.y + obs.size.h && py + h > obs.position.y
          ) || (this.searchableProps || []).some(p =>
            px < p.position.x + p.width && px + w > p.position.x &&
            py < p.position.y + p.height && py + h > p.position.y
          ) || (this.breakables || []).some(b =>
            px < b.position.x + b.hitbox.w && px + w > b.position.x &&
            py < b.position.y + b.hitbox.h && py + h > b.position.y
          );
        if (!overlap && !this.overlapsTileWall(px, py, w, h)) {
          const diff = this.difficulty ?? null;
          const luck = Math.max(0, Number(this.runCharacterAttributes?.luck ?? this.runConfig?.selectedCharacter?.attributes?.luck) || 0);
          const equipOpts = diff != null ? { difficulty: diff, forceMinBaseStats: true, luck } : { forceMinBaseStats: true, luck };
          const weapon = generateEquipmentItem("Weapon", 0, 0, "common", equipOpts);
          const armourChoices = ["Helmet", "Body Armour", "Boots"];
          for (let i = armourChoices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = armourChoices[i];
            armourChoices[i] = armourChoices[j];
            armourChoices[j] = tmp;
          }
          const a1 = generateEquipmentItem(armourChoices[0], 0, 0, "common", equipOpts);
          const a2 = generateEquipmentItem(armourChoices[1], 0, 0, "common", equipOpts);
          const prop = new SearchableProp(nextId + placed, px, py, "chest");
          prop.pendingLootDefs = [weapon, a1, a2];
          this.searchableProps.push(prop);
          placed++;
        }
      }

      this.searchablePropNextId = nextId + placed;
    },

    spawnObstacles(mapId) {
      this.obstacles = [];
      const mapDef = MAP_DEFS.find(m => m.id === mapId);
      if (!mapDef) return;

      // Get available obstacle types for this map
      const availableTypes = Object.values(OBSTACLE_TYPES).filter(obs =>
        obs.maps.includes(mapId) && obs.id !== "barrel"
      );
      if (availableTypes.length === 0) return;

      const obstacleProfiles = {
        0: { min: 18, max: 28 }, // Dungeon: tighter lanes and more blockers
        1: { min: 24, max: 38 }, // Forest: heavy tree density
        2: { min: 10, max: 16 },
        3: { min: 12, max: 18 },
        4: { min: 3, max: 5 } // Boss room: keep arena readable
      };
      const profile = obstacleProfiles[mapId] || { min: 8, max: 15 };
      const count = profile.min + Math.floor(Math.random() * (profile.max - profile.min + 1));

      const weightedSpawnByMap = {
        0: { giantRock: 5, ruinPillar: 5, ancientTree: 3, bonePile: 1 },
        1: { ancientTree: 12, giantRock: 2 }
      };
      const weightedDefs = [];
      const weights = weightedSpawnByMap[mapId] || null;
      if (weights) {
        for (const typeDef of availableTypes) {
          const w = weights[typeDef.id] || 0;
          for (let i = 0; i < w; i++) weightedDefs.push(typeDef);
        }
      }

      const pickType = () => {
        if (weightedDefs.length > 0) {
          return weightedDefs[Math.floor(Math.random() * weightedDefs.length)];
        }
        return availableTypes[Math.floor(Math.random() * availableTypes.length)];
      };

      const margin = this.world.wallThickness + 80;
      const maxAttempts = count * 90; // Denser maps need more sampling attempts
      let attempts = 0;
      let spawned = 0;

      // Get exit zones to avoid blocking paths
      const exitZones = (mapDef.exits || []).map(exit => ({
        x: exit.x - 100,
        y: exit.y - 100,
        w: exit.w + 200,
        h: exit.h + 200
      }));

      // Get player spawn position
      const playerSpawnX = this.player.position.x;
      const playerSpawnY = this.player.position.y;
      const playerSpawnZone = {
        x: playerSpawnX - 100,
        y: playerSpawnY - 100,
        w: 200,
        h: 200
      };

      while (spawned < count && attempts < maxAttempts) {
        attempts++;
        const typeDef = pickType();
        const size = typeDef.size;
        // Use placementSize for ruinPillar so overlap check reserves sprite footprint (sprites load at natural size).
        const placeW = typeDef.placementSize ? typeDef.placementSize.w : size.w;
        const placeH = typeDef.placementSize ? typeDef.placementSize.h : size.h;

        // Random position
        const minSpawnX = Math.max(margin, this.world.width * 0.2);
        const xRange = Math.max(1, this.world.width - margin - placeW - minSpawnX);
        const x = minSpawnX + Math.random() * xRange;
        const y = margin + Math.random() * (this.world.height - 2 * margin - placeH);

        // Check if position is valid
        let valid = true;

        // Check exit zones
        for (const zone of exitZones) {
          if (x < zone.x + zone.w && x + placeW > zone.x &&
              y < zone.y + zone.h && y + placeH > zone.y) {
            valid = false;
            break;
          }
        }

        // Check player spawn zone
        if (x < playerSpawnZone.x + playerSpawnZone.w && x + placeW > playerSpawnZone.x &&
            y < playerSpawnZone.y + playerSpawnZone.h && y + placeH > playerSpawnZone.y) {
          valid = false;
        }

        // Check overlap with existing obstacles
        if (valid) {
          for (const existing of this.obstacles) {
            if (x < existing.position.x + existing.size.w && x + placeW > existing.position.x &&
                y < existing.position.y + existing.size.h && y + placeH > existing.position.y) {
              valid = false;
              break;
            }
          }
        }

        // Check overlap with loot
        if (valid) {
          for (const loot of this.lootSystem.items) {
            const lootPos = loot.displayPosition;
            if (x < lootPos.x + loot.size && x + placeW > lootPos.x &&
                y < lootPos.y + loot.size && y + placeH > lootPos.y) {
              valid = false;
              break;
            }
          }
        }

        // Check overlap with enemies (only if enemySystem is initialized)
        if (valid && this.enemySystem) {
          const allEnemies = [...this.enemySystem.enemies];
          if (this.enemySystem.boss) allEnemies.push(this.enemySystem.boss);
          for (const enemy of allEnemies) {
            if (enemy.isDead) continue;
            if (x < enemy.position.x + enemy.size && x + placeW > enemy.position.x &&
                y < enemy.position.y + enemy.size && y + placeH > enemy.position.y) {
              valid = false;
              break;
            }
          }
        }

        // Check overlap with interactables
        if (valid) {
          for (const obj of this.mapInteractables) {
            if (x < obj.x + obj.w && x + placeW > obj.x &&
                y < obj.y + obj.h && y + placeH > obj.y) {
              valid = false;
              break;
            }
          }
        }

        if (valid && this.overlapsTileWall(x, y, placeW, placeH)) valid = false;

        if (valid) {
          if (typeDef.id === "bonePile") {
            // Convert legacy bone pile obstacle into searchable dead warrior prop.
            this.searchableProps = this.searchableProps || [];
            const nextId = this.searchablePropNextId ?? 1;
            const deadDef = SEARCHABLE_PROP_DEFS.deadWarrior;
            if (deadDef) {
              const px = x + (size.w - deadDef.width) / 2;
              const py = y + (size.h - deadDef.height) / 2;
              const prop = new SearchableProp(nextId, px, py, "deadWarrior");
              this.searchableProps.push(prop);
              this.searchablePropNextId = nextId + 1;
            }
            spawned++;
            continue;
          }
          const obstacle = new Obstacle(x, y, typeDef);
          if (typeDef.id === "ancientTree") {
            const treeVariants = [
              { row: 26, col: "a" }, // sapling
              { row: 26, col: "b" }, // small tree
              { row: 26, col: "c" } // tree
            ];
            obstacle.treeTile = treeVariants[Math.floor(Math.random() * treeVariants.length)];
          }
          this.obstacles.push(obstacle);
          spawned++;
        }
      }
    },

    spawnSubAreas(mapId) {
      // Sub-areas removed; no-op for compatibility with existing call sites.
    },

    rollMapInterval(min, max) {
      return min + Math.floor(Math.random() * (max - min + 1));
    },

    findInteractableSpawnSpot(size = 64) {
      const margin = this.world.wallThickness + 80;
      const exitZones = (this.currentMap?.exits || []).map(exit => ({
        x: exit.x - 90,
        y: exit.y - 90,
        w: exit.w + 180,
        h: exit.h + 180
      }));
      for (let attempts = 0; attempts < 100; attempts++) {
        const x = margin + Math.random() * Math.max(1, this.world.width - 2 * margin - size);
        const y = margin + Math.random() * Math.max(1, this.world.height - 2 * margin - size);
        const overlapObj = (this.mapInteractables || []).some(obj =>
          x < obj.x + obj.w && x + size > obj.x &&
          y < obj.y + obj.h && y + size > obj.y
        );
        if (overlapObj) continue;
        const inExit = exitZones.some(z =>
          x < z.x + z.w && x + size > z.x &&
          y < z.y + z.h && y + size > z.y
        );
        if (inExit) continue;
        if (this.overlapsTileWall(x, y, size, size)) continue;
        return { x, y };
      }
      return null;
    },

    spawnMapNpcsForVisit(_mapId) {
      this.mapInteractables = this.mapInteractables || [];

      // Biome: spawn NPCs in LOST_CAMPS (always) and OPEN_SPACE (10% chance per cell).
      if (this.world?.archetypeGrid?.grid) {
        const data = this.world.archetypeGrid;
        const tileSize = this.world.tileSize || 32;
        const npcDefs = Object.values(NPC_DEFS || {}).filter((d) => d && d.type && d.type !== NPC_DEFS.rogue?.type);
        const pickNpcDef = () => npcDefs[Math.floor(Math.random() * npcDefs.length)];

        const findSpotInBounds = (bounds, size = 64) => {
          const margin = (this.world.wallThickness || 32) + 60;
          const inner = {
            x: bounds.x + margin,
            y: bounds.y + margin,
            w: Math.max(1, bounds.w - margin * 2),
            h: Math.max(1, bounds.h - margin * 2)
          };
          for (let attempts = 0; attempts < 80; attempts++) {
            const x = inner.x + Math.random() * Math.max(1, inner.w - size);
            const y = inner.y + Math.random() * Math.max(1, inner.h - size);
            const overlapObj = (this.mapInteractables || []).some(obj =>
              x < obj.x + obj.w && x + size > obj.x &&
              y < obj.y + obj.h && y + size > obj.y
            );
            if (overlapObj) continue;
            if (this.overlapsTileWall(x, y, size, size)) continue;
            // Extra safety: if tile grid exists, require the NPC center to be on a FLOOR tile.
            const grid = this.world.tileGrid;
            if (grid) {
              const gx = Math.floor((x + size / 2) / tileSize);
              const gy = Math.floor((y + size / 2) / tileSize);
              if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length) continue;
              if (grid[gy][gx] === 1) continue;
            }
            return { x, y };
          }
          return null;
        };

        const trySpawnNpcInCell = (row, col) => {
          const def = pickNpcDef();
          if (!def) return;
          const npcWorldW = Math.max(1, Number(def.worldSize?.w) || 56);
          const npcWorldH = Math.max(1, Number(def.worldSize?.h) || 56);
          const npcSize = Math.max(npcWorldW, npcWorldH);
          const bounds = getBiomeCellBounds(this.world, col, row);
          const spot = findSpotInBounds(bounds, npcSize);
          if (!spot) return;
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
            biomeCell: { col, row }
          });
        };

        for (let row = 0; row < BIOME_GRID_ROWS; row++) {
          for (let col = 0; col < BIOME_GRID_COLS; col++) {
            const archetype = data.grid[row][col];
            if (archetype === BIOME_ARCHETYPE.LOST_CAMPS) {
              trySpawnNpcInCell(row, col);
            } else if (archetype === BIOME_ARCHETYPE.OPEN_SPACE && Math.random() < 0.1) {
              trySpawnNpcInCell(row, col);
            }
          }
        }
        return;
      }

      this.npcSpawnState = this.npcSpawnState || {
        oldWoman: { interval: this.rollMapInterval(NPC_DEFS.mysteriousOldWoman.spawn.min, NPC_DEFS.mysteriousOldWoman.spawn.max), counter: 0 },
        oldMan: { interval: this.rollMapInterval(NPC_DEFS.mysteriousOldMan.spawn.min, NPC_DEFS.mysteriousOldMan.spawn.max), counter: 0 },
        priest: { interval: this.rollMapInterval(NPC_DEFS.priest.spawn.min, NPC_DEFS.priest.spawn.max), counter: 0 },
        schemaMonk: { interval: this.rollMapInterval(NPC_DEFS.schemaMonk.spawn.min, NPC_DEFS.schemaMonk.spawn.max), counter: 0 },
        elderSchemaMonk: { interval: this.rollMapInterval(NPC_DEFS.elderSchemaMonk.spawn.min, NPC_DEFS.elderSchemaMonk.spawn.max), counter: 0 },
        equipmentCollector: { interval: this.rollMapInterval(NPC_DEFS.equipmentCollector.spawn.min, NPC_DEFS.equipmentCollector.spawn.max), counter: 0 },
        blacksmith: { interval: this.rollMapInterval(NPC_DEFS.blacksmith.spawn.min, NPC_DEFS.blacksmith.spawn.max), counter: 0 }
      };
      const npcTypes = new Set([
        NPC_DEFS.mysteriousOldWoman.type,
        NPC_DEFS.mysteriousOldMan.type,
        NPC_DEFS.priest.type,
        NPC_DEFS.schemaMonk.type,
        NPC_DEFS.elderSchemaMonk.type,
        NPC_DEFS.equipmentCollector.type,
        NPC_DEFS.blacksmith.type
      ]);
      const existingNpcCount = this.mapInteractables.filter((obj) => npcTypes.has(obj.type)).length;
      const baseNpcCap = 2;
      const pricingModifiers = typeof this.getPillarPricingModifiers === "function"
        ? this.getPillarPricingModifiers()
        : { npcSpawnCapMultiplier: 1, npcSpawnCapOverride: null };
      const overrideCap = Number(pricingModifiers?.npcSpawnCapOverride);
      const maxNpcsPerMap = Number.isFinite(overrideCap)
        ? Math.max(0, Math.floor(overrideCap))
        : Math.max(0, Math.floor(baseNpcCap * Math.max(1, Number(pricingModifiers?.npcSpawnCapMultiplier) || 1)));
      let remainingSlots = Math.max(0, maxNpcsPerMap - existingNpcCount);
      this.__pillarNpcSpawnDebug = {
        at: this.time,
        mapId: _mapId,
        baseNpcCap,
        maxNpcsPerMap,
        existingNpcCount,
        remainingSlots,
        spawnedThisVisit: 0,
        blockedReasons: [],
        pricingModifiers
      };

      const spawnNpc = (def, extra = {}) => {
        const npcWorldW = Math.max(1, Number(def.worldSize?.w) || 56);
        const npcWorldH = Math.max(1, Number(def.worldSize?.h) || 56);
        const npcSize = Math.max(npcWorldW, npcWorldH);
        const spot = this.findInteractableSpawnSpot(npcSize);
        if (!spot) {
          if (this.__pillarNpcSpawnDebug) {
            this.__pillarNpcSpawnDebug.blockedReasons.push({
              npcType: def.type,
              reason: "no_valid_spawn_spot"
            });
          }
          return false;
        }
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
          consumeOnInteract: extra.consumeOnInteract ?? true,
          interactionCount: 0,
          ...extra
        });
        if (this.__pillarNpcSpawnDebug) {
          this.__pillarNpcSpawnDebug.spawnedThisVisit += 1;
        }
        return true;
      };

      // Special rogue NPC: 50% chance per run, only on map 3 or 4, bypasses per-map NPC cap.
      if (this.rogueNpcRunEnabled && !this.rogueNpcSpawned && (_mapId === 2 || _mapId === 3)) {
        if (spawnNpc(NPC_DEFS.rogue, { consumeOnInteract: false, interactionCount: 0 })) {
          this.rogueNpcSpawned = true;
        }
      }

      if (remainingSlots <= 0) {
        if (this.__pillarNpcSpawnDebug) {
          this.__pillarNpcSpawnDebug.blockedReasons.push({ reason: "npc_cap_reached" });
          this.__pillarNpcSpawnDebug.remainingSlots = 0;
          this.__pillarNpcSpawnDebug.finalNpcCount = this.mapInteractables.filter((obj) => npcTypes.has(obj.type)).length;
        }
        return;
      }

      const keys = [
        ["oldWoman", NPC_DEFS.mysteriousOldWoman],
        ["oldMan", NPC_DEFS.mysteriousOldMan],
        ["priest", NPC_DEFS.priest],
        ["schemaMonk", NPC_DEFS.schemaMonk],
        ["elderSchemaMonk", NPC_DEFS.elderSchemaMonk],
        ["equipmentCollector", NPC_DEFS.equipmentCollector],
        ["blacksmith", NPC_DEFS.blacksmith]
      ];
      for (const [stateKey, def] of keys) {
        if (remainingSlots <= 0) break;
        const st = this.npcSpawnState[stateKey];
        st.counter++;
        if (st.counter < st.interval) continue;
        if (spawnNpc(def, { consumeOnInteract: false, interactionCount: 0 })) {
          st.counter = 0;
          st.interval = this.rollMapInterval(def.spawn.min, def.spawn.max);
          remainingSlots--;
        }
      }
      if (this.__pillarNpcSpawnDebug) {
        this.__pillarNpcSpawnDebug.remainingSlots = remainingSlots;
        this.__pillarNpcSpawnDebug.finalNpcCount = this.mapInteractables.filter((obj) => npcTypes.has(obj.type)).length;
      }
    },

    transitionToMap(targetMapId, spawnSide) {
      if (this.shouldVisitRestRoomBeforeMap(targetMapId, spawnSide)) {
        this.pendingRestRoomExit = { targetMapId, spawnSide };
        targetMapId = REST_ROOM_MAP_ID;
        spawnSide = "left";
      }

      const targetMap = this.getMapDefById(targetMapId);
      if (!targetMap) return;
      const bossMapId = MAP_DEFS[MAP_DEFS.length - 1]?.id;
      const isBossRoom = targetMapId === bossMapId;
      const isRestRoom = isRestRoomMapId(targetMapId);

      // Track exit reached for tutorial
      if (this.tutorialMode && this.tutorialSystem) {
        this.tutorialSystem.onReachExit();
      }

      // Save current map's enemy state and environmental elements before leaving (if we were on a map)
      if (this.currentMapId !== undefined && this.currentMapId !== null) {
        this.saveMapEnemyState(this.currentMapId);
        this.saveMapEnvironmentalState(this.currentMapId);
      }

      this.currentMapId = targetMapId;
      this.currentMap = targetMap;

      if (this.useProceduralMap) {
        const seed = (this.proceduralSeed ?? Date.now()) + Number(targetMapId) * 1000;
        const preset = isRestRoom
          ? { W: REST_ROOM_WORLD_PRESET.W, H: REST_ROOM_WORLD_PRESET.H, config: PRESET_MEDIUM.config }
          : targetMapId === 4
          ? { W: 30, H: 30, config: PRESET_MEDIUM.config }
          : PRESET_MEDIUM;
        const { world } = createProceduralWorld(preset, seed, targetMap);
        this.world = world;
        if (this.enemySystem) this.enemySystem.world = world;
        if (this.lootSystem) this.lootSystem.world = world;
      } else {
        this.world.setTheme(targetMap);
      }

      this.hazardSystem = isRestRoom ? null : new HazardSystem(this.world, this.conditions);

      this.lootSystem.items = [];
      this.playerProjectiles = [];
      this.skillEffects = [];
      this.dashActive = false;
      this.dashTrail = [];
      const lootQual = targetMap.lootQuality;
      this.lootSystem.setMapLootQuality(lootQual);
      this.lootSystem.setDifficulty(this.difficulty);
      this.lootSystem.setPlayerLuck(Math.max(0, Number(this.runConfig?.selectedCharacter?.attributes?.luck) || 0));

      if (this.hasCharacterTalent("immortal")) this.immortalShield = 30;

      this.empowerStacks = [0, 0, 0, 0];
      this.enemySystem.setMap(targetMap);
      
      // Check if we've visited this map before
      const isFirstVisit = isRestRoom ? true : !this.visitedMaps.has(targetMapId);
      
      if (isFirstVisit) {
        this.toughnessHitsThisMap = 0;
        this.secondBreathUsedThisMap = false;
        if (this.hasCharacterTalent("vitality") && this.currentStats?.maxHealth > 0) {
          if (typeof this.logTalentTrigger === "function") this.logTalentTrigger("vitality", "New map: healed 20% max HP");
          this.healPlayer(Math.round(this.currentStats.maxHealth * 0.2));
        }
        // First visit: initialize mapInteractables and spawn obstacles and sub-areas
        this.mapInteractables = [];
        if (isRestRoom) {
          this.setupRestRoomMapInteractables();
          this.enemySystem.enemies = [];
          this.enemySystem.boss = null;
          this.enemySystem.projectiles = [];
          this.enemySystem.respawnQueue = [];
        } else {
          if (!isBossRoom) this.spawnMapNpcsForVisit(targetMapId);
          this.spawnObstacles(targetMapId);
          this.spawnBreakablesForMap(targetMap, () => Math.random());
          this.spawnSearchableProps(targetMap, () => Math.random());
        }
        if (!isRestRoom && this.world.vaultZones && this.world.vaultZones.length) {
          for (const v of this.world.vaultZones) {
            this.mapInteractables.push({
              type: "vault",
              id: v.id,
              cx: v.cx,
              cy: v.cy,
              radius: v.radius,
              x: v.cx - v.radius,
              y: v.cy - v.radius,
              w: 2 * v.radius,
              h: 2 * v.radius,
              opened: false
            });
          }
          preloadSound("portcullisGate");
        }
        if (!isRestRoom) {
          this.spawnSubAreas(targetMapId);
          // Save the environmental state for future visits
          this.saveMapEnvironmentalState(targetMapId);
          
          // Spawn initial enemies (after sub-areas are spawned)
          this.enemySystem.enemies = [];
          this.enemySystem.boss = null;
          this.enemySystem.projectiles = [];
          this.enemySystem.respawnQueue = [];
          this.enemySystem.spawnInitial(this);
          this.trySpawnUndeadHeroForCurrentMap();
          this.visitedMaps.add(targetMapId);
        }
      } else {
        // Returning to a visited map: restore environmental elements and enemy state
        this.restoreMapEnvironmentalState(targetMapId);
        this.restoreMapEnemyState(targetMapId);
        this.trySpawnUndeadHeroForCurrentMap();
      }

      if (this.escortQuest?.active && targetMapId === 0) {
        this.resolveStrangerQuest();
      }

      // Shops removed from game.
      
      // Spawn shrine based on interval
      this.shrineSpawnCounter++;
      if (!isRestRoom && !isBossRoom && this.shrineSpawnCounter >= this.shrineSpawnInterval) {
        const shrineDef = SHRINE_DEFS[Math.floor(Math.random() * SHRINE_DEFS.length)];
        const margin = this.world.wallThickness + 80;
        
        let valid = false;
        let sx, sy;
        let attempts = 0;
        while (!valid && attempts < 50) {
          sx = margin + Math.random() * (this.world.width - 2 * margin - 64);
          sy = margin + Math.random() * (this.world.height - 2 * margin - 64);
          valid = true;
          attempts++;
        }
        
        if (valid) {
          this.mapInteractables.push({
            type: "shrine",
            shrineId: shrineDef.id,
            shrineName: shrineDef.name,
            shrineDescription: shrineDef.description,
            shrineIcon: shrineDef.icon,
            shrineColor: shrineDef.color,
            shrineAuraColor: shrineDef.auraColor,
            x: sx,
            y: sy,
            w: 64,
            h: 64,
            used: false
          });
          this.shrineSpawnCounter = 0;
          this.shrineSpawnInterval = 2 + Math.floor(Math.random() * 3); // New interval 2-4
        } else {
          this.shrineSpawnCounter++;
        }
      } else {
        this.shrineSpawnCounter++;
      }

      if (isBossRoom) {
        const npcTypes = new Set(Object.values(NPC_DEFS).map((def) => def.type));
        this.mapInteractables = (this.mapInteractables || []).filter((obj) =>
          obj.type !== "socketWorkshop" &&
          obj.type !== "shrine" &&
          !npcTypes.has(obj.type)
        );
      }

      const margin = this.world.wallThickness + 60;
      const centerY = this.world.height / 2 - this.player.size / 2;
      const ts = this.world.tileSize || 32;

      if (this.useProceduralMap && this.world.startPixel && this.world.exitPixel) {
        if (spawnSide === "left") {
          const sx = this.world.startPixel.x + ts;
          const sy = this.world.startPixel.y + ts / 2 - this.player.size / 2;
          this.player.position.set(
            Math.max(ts, Math.min(sx, this.world.width - ts - this.player.size)),
            Math.max(ts, Math.min(sy, this.world.height - ts - this.player.size))
          );
        } else if (spawnSide === "right") {
          const ex = this.world.exitPixel.x - ts - this.player.size;
          const ey = this.world.exitPixel.y + ts / 2 - this.player.size / 2;
          this.player.position.set(
            Math.max(ts, Math.min(ex, this.world.width - ts - this.player.size)),
            Math.max(ts, Math.min(ey, this.world.height - ts - this.player.size))
          );
        } else {
          this.player.position.set(this.world.width / 2 - this.player.size / 2, centerY);
        }
      } else {
        if (spawnSide === "left") {
          this.player.position.set(margin, centerY);
        } else if (spawnSide === "right") {
          this.player.position.set(this.world.width - margin - this.player.size, centerY);
        } else {
          this.player.position.set(this.world.width / 2 - this.player.size / 2, centerY);
        }
      }

      // On map transitions, snap camera immediately to the player's new spawn position.
      if (this.camera) {
        this.camera.snapTo(this.player, this.world.width, this.world.height);
      }

      if (this.bossExtractionTimerEnabled && targetMapId === bossMapId) {
        this.bossExtractionActive = !this.victoryPortal;
        this.bossExtractionTimeLeft = this.bossExtractionDuration;
      } else {
        this.bossExtractionActive = false;
        this.bossExtractionTimeLeft = 0;
      }

      this.updateMapUI();
      this.updateVictoryPortalUI();
    }
  });
}
