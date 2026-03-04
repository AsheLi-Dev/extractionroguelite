// -------- Game Map Methods Mixin --------
// Map transitions, obstacles
// This module adds methods to Game.prototype when imported

import { MAP_DEFS, createProceduralWorld, PRESET_MEDIUM } from '../data/maps.js';
import { OBSTACLE_TYPES } from '../data/obstacles.js';
import { BREAKABLE_DEFS } from '../data/breakables-data.js';
import { SEARCHABLE_PROP_DEFS } from '../data/searchable-props-data.js';
import { SHRINE_DEFS } from '../data/shrines.js';
import { Obstacle } from '../entities/obstacle.js';
import { Breakable } from '../entities/breakable.js';
import { SearchableProp } from '../entities/searchable-prop.js';
import { ENEMY_TYPES, Enemy } from '../entities/enemy.js';
import { HazardSystem } from '../entities/hazard.js';
import { LootItem } from '../entities/loot.js';
import { hasTalent } from '../data/talents.js';

export function applyGameMapMixin(Game) {
  Object.assign(Game.prototype, {
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

    saveMapEnemyState(mapId) {
      // Save current enemy state for this map
      const es = this.enemySystem;
      this.mapEnemyStates[mapId] = {
        enemies: es.enemies.map(e => ({
          id: e.id,
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
          tierXpMult: e.tierXpMult,
          affixes: e.affixes ? [...e.affixes] : [],
          burnUntil: e.burnUntil,
          burnDps: e.burnDps,
          burnAccum: e.burnAccum || 0,
          toxicStacks: e.toxicStacks,
          toxicUntil: e.toxicUntil,
          toxicAccum: e.toxicAccum || 0,
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
        return;
      }

      const es = this.enemySystem;
      es.enemies = savedState.enemies.map(eData => {
        const base = ENEMY_TYPES.find(t => t.name === eData.name);
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
        enemy.tierXpMult = eData.tierXpMult;
        enemy.affixes = eData.affixes ? [...eData.affixes] : [];
        enemy.burnUntil = eData.burnUntil;
        enemy.burnDps = eData.burnDps;
        enemy.burnAccum = eData.burnAccum || 0;
        enemy.toxicStacks = eData.toxicStacks;
        enemy.toxicUntil = eData.toxicUntil;
        enemy.toxicAccum = eData.toxicAccum || 0;
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
          boss.toxicStacks = bossData.toxicStacks;
          boss.toxicUntil = bossData.toxicUntil;
          boss.toxicAccum = bossData.toxicAccum || 0;
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
        mapInteractables: (this.mapInteractables || []).map(obj => ({
          type: obj.type,
          shopId: obj.shopId || null,
          x: obj.x,
          y: obj.y,
          w: obj.w,
          h: obj.h,
          used: obj.used || false
        })),
        searchableProps: (this.searchableProps || []).map(p => ({
          id: p.id,
          typeId: p.typeId,
          x: p.position.x,
          y: p.position.y,
          isSearched: p.isSearched
        }))
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
        const typeDef = OBSTACLE_TYPES[obsData.type];
        if (!typeDef) return null;
        const obstacle = new Obstacle(obsData.position.x, obsData.position.y, typeDef);
        obstacle.id = obsData.id;
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

      this.mapInteractables = savedState.mapInteractables ? savedState.mapInteractables.map(obj => ({
        type: obj.type,
        shopId: obj.shopId || null,
        x: obj.x,
        y: obj.y,
        w: obj.w,
        h: obj.h,
        used: obj.used || false
      })) : [];

      this.searchableProps = (savedState.searchableProps || []).map(pData => {
        const def = SEARCHABLE_PROP_DEFS[pData.typeId];
        if (!def) return null;
        const p = new SearchableProp(pData.id, pData.x, pData.y, pData.typeId);
        p.isSearched = pData.isSearched || false;
        return p;
      }).filter(Boolean);
    },

    spawnBreakablesForMap(map, rng = Math.random) {
      this.breakables = this.breakables || [];
      const world = this.world;
      const tileGrid = world.tileGrid;
      const tileSize = world.tileSize || 32;
      const count = 6 + Math.floor(rng() * 10);
      const nextId = (this.breakableNextId ?? 1);
      const weights = [
        { id: "crate_basic", w: 70 },
        { id: "urn_magic", w: 25 },
        { id: "chest_rare", w: 5 }
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
        let placed = 0;
        for (let i = 0; i < candidates.length && placed < count; i++) {
          const c = candidates[i];
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
          used.add(key);
          const b = new Breakable(nextId + placed, px, py, defId);
          this.breakables.push(b);
          placed++;
        }
        this.breakableNextId = nextId + placed;
        return;
      }

      // Fallback: no tile grid (e.g. non-procedural map) — place breakables randomly in playable area
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
        { typeId: "crate", w: 60 },
        { typeId: "locker", w: 25 },
        { typeId: "deadWarrior", w: 15 }
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
        let placed = 0;
        for (let i = 0; i < candidates.length && placed < count; i++) {
          const c = candidates[i];
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
          used.add(key);
          const prop = new SearchableProp(nextId + placed, px, py, typeId);
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
        this.searchableProps.push(prop);
        placed++;
      }
      this.searchablePropNextId = nextId + placed;
    },

    spawnObstacles(mapId) {
      this.obstacles = [];
      const mapDef = MAP_DEFS.find(m => m.id === mapId);
      if (!mapDef) return;

      // Get available obstacle types for this map
      const availableTypes = Object.values(OBSTACLE_TYPES).filter(obs => 
        obs.maps.includes(mapId)
      );
      if (availableTypes.length === 0) return;

      const obstacleProfiles = {
        0: { min: 18, max: 28 }, // Dungeon: tighter lanes and more blockers
        1: { min: 24, max: 38 }, // Forest: heavy tree density
        2: { min: 10, max: 16 },
        3: { min: 12, max: 18 },
        4: { min: 12, max: 18 }
      };
      const profile = obstacleProfiles[mapId] || { min: 8, max: 15 };
      const count = profile.min + Math.floor(Math.random() * (profile.max - profile.min + 1));

      const weightedSpawnByMap = {
        0: { giantRock: 5, ruinedPillar: 5, ancientTree: 3, barrel: 1, bonePile: 1 },
        1: { ancientTree: 12, giantRock: 2, barrel: 1 }
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
        
        // Random position
        const x = margin + Math.random() * (this.world.width - 2 * margin - size.w);
        const y = margin + Math.random() * (this.world.height - 2 * margin - size.h);

        // Check if position is valid
        let valid = true;

        // Check exit zones
        for (const zone of exitZones) {
          if (x < zone.x + zone.w && x + size.w > zone.x &&
              y < zone.y + zone.h && y + size.h > zone.y) {
            valid = false;
            break;
          }
        }

        // Check player spawn zone
        if (x < playerSpawnZone.x + playerSpawnZone.w && x + size.w > playerSpawnZone.x &&
            y < playerSpawnZone.y + playerSpawnZone.h && y + size.h > playerSpawnZone.y) {
          valid = false;
        }

        // Check overlap with existing obstacles
        if (valid) {
          for (const existing of this.obstacles) {
            if (x < existing.position.x + existing.size.w && x + size.w > existing.position.x &&
                y < existing.position.y + existing.size.h && y + size.h > existing.position.y) {
              valid = false;
              break;
            }
          }
        }

        // Check overlap with loot
        if (valid) {
          for (const loot of this.lootSystem.items) {
            const lootPos = loot.displayPosition;
            if (x < lootPos.x + loot.size && x + size.w > lootPos.x &&
                y < lootPos.y + loot.size && y + size.h > lootPos.y) {
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
            if (x < enemy.position.x + enemy.size && x + size.w > enemy.position.x &&
                y < enemy.position.y + enemy.size && y + size.h > enemy.position.y) {
              valid = false;
              break;
            }
          }
        }

        // Check overlap with interactables
        if (valid) {
          for (const obj of this.mapInteractables) {
            if (x < obj.x + obj.w && x + size.w > obj.x &&
                y < obj.y + obj.h && y + size.h > obj.y) {
              valid = false;
              break;
            }
          }
        }

        if (valid && this.overlapsTileWall(x, y, size.w, size.h)) valid = false;

        if (valid) {
          const obstacle = new Obstacle(x, y, typeDef);
          this.obstacles.push(obstacle);
          spawned++;
        }
      }
    },

    spawnSubAreas(mapId) {
      // Sub-areas removed; no-op for compatibility with existing call sites.
    },

    transitionToMap(targetMapId, spawnSide) {
      const targetMap = MAP_DEFS.find((m) => m.id === targetMapId);
      if (!targetMap) return;

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
        const seed = (this.proceduralSeed ?? Date.now()) + targetMapId * 1000;
        const { world } = createProceduralWorld(PRESET_MEDIUM, seed, targetMap);
        this.world = world;
        if (this.enemySystem) this.enemySystem.world = world;
        if (this.lootSystem) this.lootSystem.world = world;
      } else {
        this.world.setTheme(targetMap);
      }

      this.hazardSystem = new HazardSystem(this.world, this.conditions);

      this.lootSystem.items = [];
      this.playerProjectiles = [];
      this.skillEffects = [];
      this.dashActive = false;
      this.dashTrail = [];
      const lootQual = targetMap.lootQuality;
      this.lootSystem.setMapLootQuality(lootQual);
      this.lootSystem.setDifficulty(this.difficulty);

      if (hasTalent("immortal")) this.immortalShield = 30;

      if (hasTalent("treasureHunter") && targetMapId % 3 === 2) {
        const cx = this.world.width / 2 - 10;
        const cy = this.world.height / 2 - 10;
        this.lootSystem.spawnBurstAt(cx, cy, 2, 0.8);
      }

      this.empowerStacks = [0, 0, 0, 0];
      this.enemySystem.setMap(targetMap);
      
      // Check if we've visited this map before
      const isFirstVisit = !this.visitedMaps.has(targetMapId);
      
      if (isFirstVisit) {
        // First visit: initialize mapInteractables and spawn obstacles and sub-areas
        this.mapInteractables = [];
        if (hasTalent("socketFinder") && Math.random() < 0.2) {
          const margin = this.world.wallThickness + 80;
          const ix = margin + Math.random() * (this.world.width - 2 * margin - 64);
          const iy = margin + Math.random() * (this.world.height - 2 * margin - 64);
          this.mapInteractables.push({ type: "socketWorkshop", x: ix, y: iy, w: 64, h: 64 });
        }
        
        this.spawnObstacles(targetMapId);
        this.spawnBreakablesForMap(targetMap, () => Math.random());
        this.spawnSearchableProps(targetMap, () => Math.random());
        this.spawnSubAreas(targetMapId);
        // Save the environmental state for future visits
        this.saveMapEnvironmentalState(targetMapId);
        
        // Spawn initial enemies (after sub-areas are spawned)
        this.enemySystem.enemies = [];
        this.enemySystem.boss = null;
        this.enemySystem.projectiles = [];
        this.enemySystem.respawnQueue = [];
        this.enemySystem.spawnInitial(this);
        this.visitedMaps.add(targetMapId);
      } else {
        // Returning to a visited map: restore environmental elements and enemy state
        this.restoreMapEnvironmentalState(targetMapId);
        this.restoreMapEnemyState(targetMapId);
      }

      if (this.escortQuest?.active && targetMapId === 0) {
        this.resolveStrangerQuest();
      }

      // Spawn shop every 3–5 newly visited maps
      if (isFirstVisit) {
        this.shopSpawnCounter = (this.shopSpawnCounter ?? 0) + 1;
        const interval = this.shopSpawnInterval ?? 3;
        if (this.shopSpawnCounter >= interval) {
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
            this.mapInteractables.push({ type: "shop", shopId: `shop_map_${targetMapId}`, x: sx, y: sy, w: 64, h: 64 });
            this.shopSpawnCounter = 0;
            this.shopSpawnInterval = 3 + Math.floor(Math.random() * 3); // New interval 3-5
          }
        }
      }
      
      // Spawn shrine based on interval
      this.shrineSpawnCounter++;
      if (this.shrineSpawnCounter >= this.shrineSpawnInterval) {
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

      this.updateMapUI();
    }
  });
}
