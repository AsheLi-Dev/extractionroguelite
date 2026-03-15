import { Vec2, getObstacleCollisionRect, obstacleIntersectsRect } from '../utils.js';
import { DIFFICULTY_STAT_MULTIPLIER } from '../data/constants.js';
import { MAP_DEFS, getBiomeCellBounds, BIOME_ARCHETYPE, BIOME_GRID_COLS, BIOME_GRID_ROWS } from '../data/maps.js';
import { ENEMY_TYPES, UNDEAD_HERO_TYPES, AFFIX_DEFS, Enemy } from './enemy.js';
import { Boss, BOSS_MAX_HP, BOSS_SIZE } from './boss.js';
import { Projectile } from './projectile.js';
import { EnemyAttackController } from './attacks/index.js';
import { getHumanSquadTypeDef, HUMAN_SQUAD_FORMATION } from '../data/human-squad-data.js';

const SPECIAL_ENEMY_TIER = "special";
const TIER_MULTIPLIERS = {
  minion: { hp: 0.5, atk: 1, xp: 0.7, size: 1.4 },
  elite: { hp: 1, atk: 1.2, xp: 1.4, size: 1 },
  miniBoss: { hp: 5, atk: 2, xp: 5, size: 1.2 },
  [SPECIAL_ENEMY_TIER]: { hp: 2.2, atk: 1.5, xp: 2.5, size: 1.08 }
};

/** Movement speed multiplier by size category: large -40%, medium -25%, small -15%. */
function getSizeCategorySpeedMult(baseSize) {
  if (baseSize == null || baseSize <= 80) return 0.85; // small
  if (baseSize > 100) return 0.6;  // large
  return 0.75; // medium
}

export class EnemySystem {
  constructor(world, mapDef, conditions = [], difficulty = 1) {
    this.world = world;
    this.mapDef = mapDef || MAP_DEFS[0];
    this.conditions = conditions;
    this.difficulty = difficulty;
    this.diffMult = DIFFICULTY_STAT_MULTIPLIER[difficulty] ?? 1;
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.respawnQueue = [];
    this.normalEnemyTypes = ENEMY_TYPES.filter((enemyType) => enemyType?.spawnPool !== "special");
  }

  hasCond(id) {
    return this.conditions.some((c) => c.id === id);
  }

  setMap(mapDef) {
    this.mapDef = mapDef;
  }

  getNormalEnemyTypePool() {
    if (this.normalEnemyTypes?.length > 0) return this.normalEnemyTypes;
    if (ENEMY_TYPES.length > 0) return ENEMY_TYPES;
    return [];
  }

  getValidAffixIds(affixIds = []) {
    const validIds = new Set(AFFIX_DEFS.map((affix) => affix.id));
    return affixIds.filter((id) => validIds.has(id));
  }

  getSpawnPool(includeSpecial = false) {
    const normalPool = this.getNormalEnemyTypePool();
    if (!includeSpecial) return normalPool;
    return [...normalPool, ...UNDEAD_HERO_TYPES];
  }

  pickRandomEnemyType(includeSpecial = false) {
    const pool = this.getSpawnPool(includeSpecial);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  pickRandomUndeadHeroType() {
    if (!UNDEAD_HERO_TYPES.length) return null;
    return UNDEAD_HERO_TYPES[Math.floor(Math.random() * UNDEAD_HERO_TYPES.length)] || null;
  }

  getEntrySafeZone(game = null, size = 64) {
    if (!game?.player) return null;
    const entryPadding = Math.max(190, size * 2.8);
    const playerX = game.player.position.x;
    const playerY = game.player.position.y;
    const playerSize = game.player.size || 48;
    return {
      x: playerX - entryPadding,
      y: playerY - entryPadding,
      w: playerSize + entryPadding * 2,
      h: playerSize + entryPadding * 2
    };
  }

  isInsideEntrySafeZone(x, y, size, game = null) {
    const zone = this.getEntrySafeZone(game, size);
    if (!zone) {
      // Fallback behavior for contexts with no game/player reference.
      return x < this.world.width / 10;
    }
    return (
      x < zone.x + zone.w &&
      x + size > zone.x &&
      y < zone.y + zone.h &&
      y + size > zone.y
    );
  }

  /** Returns true if rect (x, y, size, size) overlaps any procedural tile wall */
  isOnWall(x, y, size) {
    if (!this.world.tileWallRects || this.world.tileWallRects.length === 0) return false;
    const r = { x, y, w: size, h: size };
    for (const wall of this.world.tileWallRects) {
      if (r.x < wall.x + wall.w && r.x + r.w > wall.x &&
          r.y < wall.y + wall.h && r.y + r.h > wall.y) return true;
    }
    return false;
  }

  getSpawnCollisionRect(x, y, size) {
    const hitSize = Math.max(4, size * 0.5);
    return {
      x: x + (size - hitSize) / 2,
      y: y + (size - hitSize) / 2,
      w: hitSize,
      h: hitSize
    };
  }

  isOnBlockingObstacle(x, y, size, game = null) {
    if (!game?.obstacles?.length) return false;
    const rect = this.getSpawnCollisionRect(x, y, size);
    for (const obstacle of game.obstacles) {
      if (obstacle?.destroyed || !obstacle?.blocksMovement) continue;
      if (obstacleIntersectsRect(obstacle, rect)) return true;
    }
    return false;
  }

  /**
   * Nudge (x, y) so that rect (x, y, size, size) no longer overlaps any tile wall.
   * Repeatedly resolves overlap with the first wall found until clear or max iterations.
   */
  pushOutOfWalls(x, y, size) {
    if (!this.world.tileWallRects || this.world.tileWallRects.length === 0) return new Vec2(x, y);
    let px = x, py = y;
    const margin = this.world.wallThickness ?? 32;
    const maxX = this.world.width - margin - size;
    const maxY = this.world.height - margin - size;
    for (let iter = 0; iter < 20; iter++) {
      let found = false;
      const r = { x: px, y: py, w: size, h: size };
      for (const wall of this.world.tileWallRects) {
        if (r.x >= wall.x + wall.w || r.x + r.w <= wall.x ||
            r.y >= wall.y + wall.h || r.y + r.h <= wall.y) continue;
        const overlapL = (r.x + r.w) - wall.x;
        const overlapR = (wall.x + wall.w) - r.x;
        const overlapT = (r.y + r.h) - wall.y;
        const overlapB = (wall.y + wall.h) - r.y;
        const minX = Math.min(overlapL, overlapR);
        const minY = Math.min(overlapT, overlapB);
        if (minX < minY) {
          px += overlapL < overlapR ? -overlapL : overlapR;
        } else {
          py += overlapT < overlapB ? -overlapT : overlapB;
        }
        px = Math.max(margin, Math.min(px, maxX));
        py = Math.max(margin, Math.min(py, maxY));
        found = true;
        break;
      }
      if (!found) break;
    }
    return new Vec2(px, py);
  }

  pushOutOfBlockers(x, y, size, game = null) {
    let px = x;
    let py = y;
    const margin = this.world.wallThickness ?? 32;
    const maxX = this.world.width - margin - size;
    const maxY = this.world.height - margin - size;

    for (let iter = 0; iter < 20; iter++) {
      let moved = false;

      if (this.isOnWall(px, py, size)) {
        const out = this.pushOutOfWalls(px, py, size);
        if (out.x !== px || out.y !== py) {
          px = out.x;
          py = out.y;
          moved = true;
        }
      }

      if (game?.obstacles?.length) {
        const rect = this.getSpawnCollisionRect(px, py, size);
        for (const obstacle of game.obstacles) {
          if (obstacle?.destroyed || !obstacle?.blocksMovement) continue;
          if (!obstacleIntersectsRect(obstacle, rect)) continue;

          const obstacleRect = getObstacleCollisionRect(obstacle);
          const overlapL = (rect.x + rect.w) - obstacleRect.x;
          const overlapR = (obstacleRect.x + obstacleRect.w) - rect.x;
          const overlapT = (rect.y + rect.h) - obstacleRect.y;
          const overlapB = (obstacleRect.y + obstacleRect.h) - rect.y;
          const minX = Math.min(overlapL, overlapR);
          const minY = Math.min(overlapT, overlapB);
          const rectCenterX = rect.x + rect.w * 0.5;
          const rectCenterY = rect.y + rect.h * 0.5;
          const obstacleCenterX = obstacleRect.x + obstacleRect.w * 0.5;
          const obstacleCenterY = obstacleRect.y + obstacleRect.h * 0.5;

          if (minX <= minY) {
            px += rectCenterX < obstacleCenterX ? -(minX + 0.5) : (minX + 0.5);
          } else {
            py += rectCenterY < obstacleCenterY ? -(minY + 0.5) : (minY + 0.5);
          }

          px = Math.max(margin, Math.min(px, maxX));
          py = Math.max(margin, Math.min(py, maxY));
          moved = true;
          break;
        }
      }

      if (!moved) break;
    }

    return new Vec2(px, py);
  }

  randomPosition(size, game = null) {
    const margin = this.world.wallThickness + size + 40;
    let minX = margin;
    let rangeX = this.world.width - margin - minX;
    let minY = margin;
    let rangeY = this.world.height - margin * 2;
    if (game?._biomeCellBounds) {
      const b = game._biomeCellBounds;
      const pad = margin;
      minX = b.x + pad;
      rangeX = Math.max(0, b.w - pad * 2);
      minY = b.y + pad;
      rangeY = Math.max(0, b.h - pad * 2);
    }
    const maxAttempts = this.world.tileWallRects ? 80 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = minX + Math.random() * rangeX;
      const y = minY + Math.random() * rangeY;
      if (game?._biomeCellArchetype === BIOME_ARCHETYPE.CORRIDORS && this.world.tileGrid) {
        const ts = this.world.tileSize || 32;
        const gx = Math.floor((x + size / 2) / ts);
        const gy = Math.floor((y + size / 2) / ts);
        const grid = this.world.tileGrid;
        if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length) continue;
        // Corridor cells are mostly walls; require the spawn center tile to be on carved FLOOR.
        if (grid[gy][gx] === 1) continue;
      }
      if (this.isOnWall(x, y, size)) continue;
      if (this.isOnBlockingObstacle(x, y, size, game)) continue;
      if (this.isInsideEntrySafeZone(x, y, size, game)) continue;
      return new Vec2(x, y);
    }
    return new Vec2(minX + rangeX * 0.5 - size / 2, minY + rangeY * 0.5 - size / 2);
  }

  spawnOne(forceTier = null, forceAffixIds = null, nearPosition = null, game = null, forceType = null, spawnEscorts = true, options = {}) {
    const allowSpecialSpawn = options?.allowSpecialSpawn === true || forceTier === SPECIAL_ENEMY_TIER;
    const pool = this.getSpawnPool(allowSpecialSpawn);
    if (!pool.length) return null;

    let base = null;
    if (forceType) {
      base = pool.find((e) => e.name === forceType || e.id === forceType);
      if (!base) base = ENEMY_TYPES.find((e) => e.name === forceType || e.id === forceType);
    }
    if (!base) base = pool[Math.floor(Math.random() * pool.length)];
    if (!forceType && this.hasCond("eliteSpawn")) {
      const idx = pool.findIndex((e) => e.name === base.name);
      base = pool[Math.min(idx + 1, pool.length - 1)] || base;
    }
    const tier = forceTier || (Math.random() < 0.79 ? "minion" : "elite");
    const s = this.mapDef.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const tm = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS.minion;
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp * tm.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack * tm.atk);
    let spd = Math.round(base.speed * s.speed);
    let size = Math.max(16, Math.round(base.size * tm.size));
    if (base.name === "GoblinKing") hp = 2000;
    else if (base.name === "GoblinElite") hp = 100;
    else if (base.name === "GoblinNormal") hp = 50;
    if (game?._biomeCellArchetype === BIOME_ARCHETYPE.CORRIDORS) {
      size = Math.max(8, Math.round(size / 3));
    }
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
    spd = Math.round(spd * getSizeCategorySpeedMult(base.size));
    const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd, size };
    let pos;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      if (nearPosition) {
        const dist = 80 + Math.random() * 70;
        const angle = Math.random() * Math.PI * 2;
        pos = new Vec2(
          nearPosition.x + Math.cos(angle) * dist - size / 2,
          nearPosition.y + Math.sin(angle) * dist - size / 2
        );
        const margin = this.world.wallThickness + size;
        pos.x = Math.max(margin, Math.min(pos.x, this.world.width - margin - size));
        pos.y = Math.max(margin, Math.min(pos.y, this.world.height - margin - size));
      } else {
        pos = this.randomPosition(size, game);
      }
      
      let insideRoom = false;
      if (this.isInsideEntrySafeZone(pos.x, pos.y, size, game)) insideRoom = true;
      // No spawns on procedural tile walls
      if (this.isOnWall(pos.x, pos.y, size)) insideRoom = true;
      if (this.isOnBlockingObstacle(pos.x, pos.y, size, game)) insideRoom = true;

      if (!insideRoom) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (this.isOnWall(pos.x, pos.y, size) || this.isOnBlockingObstacle(pos.x, pos.y, size, game)) {
      pos = this.pushOutOfBlockers(pos.x, pos.y, size, game);
    }
    const enemy = new Enemy(pos.x, pos.y, typeDef);
    enemy.worldBounds = { width: this.world.width, height: this.world.height };
    enemy.enemyTier = tier;
    enemy.tierXpMult = tm.xp;
    enemy.attackScale = tier === "minion" ? 1 : tier === "elite" ? 1.25 : tier === SPECIAL_ENEMY_TIER ? 1.45 : 1.6;
    enemy.enableHiddenAttacks = tier === "miniBoss";
    if (tier === "elite") enemy.isElite = true;
    if (tier === "miniBoss") enemy.isMiniBoss = true;
    if (tier === SPECIAL_ENEMY_TIER) enemy.isSpecial = true;
    enemy.attackCtrl = new EnemyAttackController(enemy);
    if (this.hasCond("enemyRegen")) enemy.regenRate = 2;
    if (this.hasCond("eliteSpawn") && tier !== "miniBoss" && tier !== SPECIAL_ENEMY_TIER) enemy.isElite = true;
    enemy.affixes = [];
    if (forceAffixIds && forceAffixIds.length > 0) {
      enemy.affixes = this.getValidAffixIds(forceAffixIds);
    } else if (tier === "elite") {
      const pool = [...AFFIX_DEFS];
      for (let i = 0; i < 2 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        enemy.affixes.push(pool.splice(idx, 1)[0].id);
      }
    } else if (tier === "miniBoss") {
      const pool = [...AFFIX_DEFS];
      for (let i = 0; i < 4 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        enemy.affixes.push(pool.splice(idx, 1)[0].id);
      }
    } else if (tier === SPECIAL_ENEMY_TIER) {
      const pool = [...AFFIX_DEFS];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        enemy.affixes.push(pool.splice(idx, 1)[0].id);
      }
    }
    if (enemy.affixes.includes("evasive")) {
      enemy.speed = Math.round(enemy.speed * 1.3);
    }
    this.enemies.push(enemy);

    if (spawnEscorts && (enemy.enemyTypeId === "m_5q_strong_mimic" || enemy.enemyTypeId === "m_5r_large_mimic")) {
      const anchor = {
        x: enemy.position.x + enemy.size / 2,
        y: enemy.position.y + enemy.size / 2
      };
      this.spawnOne("minion", null, anchor, game, "m_5o_small_mimic", false);
      this.spawnOne("minion", null, anchor, game, "m_5o_small_mimic", false);
    }

    if (spawnEscorts && enemy.enemyTier === "miniBoss" && enemy.name === "GoblinKing") {
      const anchor = { x: enemy.position.x + enemy.size / 2, y: enemy.position.y + enemy.size / 2 };
      const minions = [];
      for (let i = 0; i < 2; i++) {
        const e = this.spawnOne("elite", null, anchor, game, "GoblinElite", false);
        if (e) minions.push(e);
      }
      for (let i = 0; i < 4; i++) {
        const e = this.spawnOne("minion", null, anchor, game, "GoblinNormal", false);
        if (e) minions.push(e);
      }
      enemy.goblinKingMinions = minions;
    }
    if (spawnEscorts && enemy.enemyTier === "miniBoss" && enemy.enemyTypeId === "m_5n_large_dwarfette_ball") {
      const anchor = {
        x: enemy.position.x + enemy.size / 2,
        y: enemy.position.y + enemy.size / 2
      };
      this.spawnOne("elite", null, anchor, game, "m_5l_medium_dwarfette", false);
      this.spawnOne("elite", null, anchor, game, "m_5l_medium_dwarfette", false);
    }

    if (spawnEscorts && enemy.enemyTier === "miniBoss" && enemy.enemyTypeId === "m_5j_large_dummy") {
      const anchor = {
        x: enemy.position.x + enemy.size / 2,
        y: enemy.position.y + enemy.size / 2
      };
      this.spawnOne("elite", null, anchor, game, "m_5h_medium_dummy", false);
      this.spawnOne("elite", null, anchor, game, "m_5h_medium_dummy", false);
    }

    return enemy;
  }

  /**
   * Spawn a single enemy at a specific position (e.g. for ambush zones). Skips entry-safe-zone check.
   * @param {number} x - World x (left edge of enemy)
   * @param {number} y - World y (top edge of enemy)
   * @param {string} typeId - ENEMY_TYPES id (e.g. m_5s_small_frog)
   * @param {Object} [game=null] - Game instance for obstacles
   * @param {{ ambushZoneId?: number }} [options] - Optional ambushZoneId to track encounter completion
   * @returns {Enemy|null}
   */
  spawnAtPosition(x, y, typeId, game = null, options = {}) {
    const pool = this.getSpawnPool(false);
    const base = pool.find((e) => e.id === typeId || e.name === typeId);
    if (!base) return null;
    const tier = "minion";
    const s = this.mapDef?.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const tm = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS.minion;
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp * tm.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack * tm.atk);
    let spd = Math.round(base.speed * s.speed);
    const size = Math.max(16, Math.round(base.size * tm.size));
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
    spd = Math.round(spd * getSizeCategorySpeedMult(base.size));
    const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd, size };
    const margin = this.world.wallThickness ?? 32;
    let px = Math.max(margin, Math.min(x, this.world.width - margin - size));
    let py = Math.max(margin, Math.min(y, this.world.height - margin - size));
    if (this.isOnWall(px, py, size) || this.isOnBlockingObstacle(px, py, size, game)) {
      const pushed = this.pushOutOfBlockers(px, py, size, game);
      px = pushed.x;
      py = pushed.y;
    }
    const enemy = new Enemy(px, py, typeDef);
    enemy.worldBounds = { width: this.world.width, height: this.world.height };
    enemy.enemyTier = tier;
    enemy.tierXpMult = tm.xp;
    enemy.attackScale = tier === "minion" ? 1 : 1.25;
    enemy.attackCtrl = new EnemyAttackController(enemy);
    enemy.affixes = [];
    if (options.ambushZoneId != null) enemy.ambushZoneId = options.ambushZoneId;
    this.enemies.push(enemy);
    return enemy;
  }

  spawnUndeadHero(game = null, options = {}) {
    const requestedTypeId = options?.forceTypeId || options?.forceType || null;
    const heroType = requestedTypeId
      ? (UNDEAD_HERO_TYPES.find((typeDef) => typeDef.id === requestedTypeId || typeDef.name === requestedTypeId) || null)
      : this.pickRandomUndeadHeroType();
    if (!heroType) return null;
    const spawned = this.spawnOne(
      SPECIAL_ENEMY_TIER,
      null,
      options?.nearPosition || null,
      game,
      heroType.id,
      false,
      { allowSpecialSpawn: true }
    );
    if (!spawned) return null;
    spawned.isSpecial = true;
    spawned.isUndeadHero = true;
    spawned.enemyTier = SPECIAL_ENEMY_TIER;
    return spawned;
  }

  getCastleExitAnchor(game = null) {
    const exits = (game?.world?.proceduralExitZones && game.world.proceduralExitZones.length > 0)
      ? game.world.proceduralExitZones
      : (this.mapDef?.exits || []);
    if (exits.length > 0) {
      const rightMost = exits.reduce((best, e) => (!best || e.x > best.x ? e : best), null);
      return {
        x: rightMost.x + (rightMost.w || 0) * 0.5 - 180,
        y: rightMost.y + (rightMost.h || 0) * 0.5
      };
    }
    return { x: this.world.width * 0.82, y: this.world.height * 0.5 };
  }

  spawnHumanSquad(centerX, centerY, game, options = {}) {
    const asElite = options.asElite === true;
    if (game) {
      const squadId = "humanSquad_" + ((game._squadIdCounter = (game._squadIdCounter || 0) + 1));
      game.squadAliveCount = game.squadAliveCount || {};
      game.squadLastDeath = game.squadLastDeath || {};
      game.squadAliveCount[squadId] = 4;
      game.squadLastDeath[squadId] = null;
      options.squadId = squadId;
    } else {
      this._localSquadCounter = (this._localSquadCounter || 0) + 1;
      options.squadId = "humanSquad_" + this._localSquadCounter;
    }
    const squadId = options.squadId;

    const roleToId = { warrior: "human_warrior", lancer: "human_lancer", archer: "human_archer", monk: "human_monk" };
    const s = this.mapDef?.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const margin = this.world.wallThickness + 50;

    for (const slot of HUMAN_SQUAD_FORMATION) {
      const typeId = roleToId[slot.role];
      const base = getHumanSquadTypeDef(typeId);
      if (!base) continue;
      const eliteHpMult = asElite ? 1.2 : 1;
      const eliteAtkMult = asElite ? 1.25 : 1;
      const hp = Math.round(base.maxHealth * this.diffMult * s.hp * eliteHpMult);
      const atk = Math.round(base.attack * this.diffMult * (s.attack || 1) * eliteAtkMult);
      let spd = Math.round(base.speed * (s.speed || 1));
      spd = Math.round(spd * getSizeCategorySpeedMult(base.size));
      const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd };
      let px = centerX + slot.offsetX - base.size / 2;
      let py = centerY + slot.offsetY - base.size / 2;
      px = Math.max(margin, Math.min(px, this.world.width - margin - base.size));
      py = Math.max(margin, Math.min(py, this.world.height - margin - base.size));
      if (this.isOnWall(px, py, base.size) || this.isOnBlockingObstacle(px, py, base.size, game)) {
        const pushed = this.pushOutOfBlockers(px, py, base.size, game);
        px = pushed.x;
        py = pushed.y;
      }
      const enemy = new Enemy(px, py, typeDef);
      enemy.worldBounds = { width: this.world.width, height: this.world.height };
      enemy.enemyTier = asElite ? "elite" : "minion";
      enemy.tierXpMult = asElite ? 1.4 : 1;
      enemy.attackScale = asElite ? 1.25 : 1;
      enemy.attackCtrl = new EnemyAttackController(enemy);
      enemy.squadId = squadId;
      enemy.affixes = [];
      if (asElite) {
        enemy.isElite = true;
        const pool = [...AFFIX_DEFS];
        for (let i = 0; i < 2 && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          enemy.affixes.push(pool.splice(idx, 1)[0].id);
        }
      }
      if (enemy.affixes.includes("evasive")) {
        enemy.speed = Math.round(enemy.speed * 1.3);
      }
      this.enemies.push(enemy);
    }
  }

  spawnBoss(game = null) {
    const margin = this.world.wallThickness + BOSS_SIZE + 40;
    const rightThirdStart = this.world.width * 0.6;
    const rightThirdEnd = this.world.width - margin;
    
    // Try to find a valid position (not inside rooms)
    let pos;
    let attempts = 0;
    const maxAttempts = 50;
    do {
      const x = rightThirdStart + Math.random() * (rightThirdEnd - rightThirdStart);
      const y = margin + Math.random() * (this.world.height - margin * 2);
      pos = new Vec2(x, y);
      
      let insideRoom = false;
      if (this.isInsideEntrySafeZone(pos.x, pos.y, BOSS_SIZE, game)) insideRoom = true;
      if (this.isOnWall(pos.x, pos.y, BOSS_SIZE)) insideRoom = true;
      if (this.isOnBlockingObstacle(pos.x, pos.y, BOSS_SIZE, game)) insideRoom = true;

      if (!insideRoom) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (this.isOnWall(pos.x, pos.y, BOSS_SIZE) || this.isOnBlockingObstacle(pos.x, pos.y, BOSS_SIZE, game)) {
      pos = this.pushOutOfBlockers(pos.x, pos.y, BOSS_SIZE, game);
    }
    const boss = new Boss(pos.x, pos.y);
    boss.maxHealth = Math.round(boss.maxHealth * this.diffMult);
    boss.health = boss.maxHealth;
    boss.attack = Math.round(boss.attack * this.diffMult);
    if (this.hasCond("bossHp")) {
      boss.maxHealth = Math.round(boss.maxHealth * 1.3);
      boss.health = boss.maxHealth;
    }
    this.boss = boss;
  }

  spawnMinion(game = null) {
    const base = this.pickRandomEnemyType(false);
    if (!base) return;
    const s = { hp: 0.8, attack: 0.9, speed: 1.1 };
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack);
    let spd = Math.round(base.speed * s.speed);
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
    spd = Math.round(spd * getSizeCategorySpeedMult(base.size));
    const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd };

    // Try to find a valid position (not inside rooms)
    let pos;
    let attempts = 0;
    const maxAttempts = 50;
    do {
      pos = this.randomPosition(typeDef.size, game);
      
      let insideRoom = false;
      if (this.isInsideEntrySafeZone(pos.x, pos.y, typeDef.size, game)) insideRoom = true;
      if (this.isOnWall(pos.x, pos.y, typeDef.size)) insideRoom = true;
      if (this.isOnBlockingObstacle(pos.x, pos.y, typeDef.size, game)) insideRoom = true;
      if (!insideRoom) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (this.isOnWall(pos.x, pos.y, typeDef.size) || this.isOnBlockingObstacle(pos.x, pos.y, typeDef.size, game)) {
      pos = this.pushOutOfBlockers(pos.x, pos.y, typeDef.size, game);
    }
    const enemy = new Enemy(pos.x, pos.y, typeDef);
    enemy.attackScale = 1;
    enemy.enableHiddenAttacks = false;
    enemy.attackCtrl = new EnemyAttackController(enemy);
    if (this.hasCond("enemyRegen")) enemy.regenRate = 2;
    this.enemies.push(enemy);
  }

  spawnGroup(tier, game = null, options = null) {
    // Choose a random base enemy type for this group
    let pool = this.getSpawnPool(false);
    if (!pool.length) return;
    const wantSizeCategory = options?.onlySizeCategory || null;
    let filteredPool = wantSizeCategory
      ? pool.filter((e) => {
          const s = e?.size || e?.base?.size || 72;
          const cat = s <= 80 ? "small" : (s > 100 ? "large" : "medium");
          return cat === wantSizeCategory;
        })
      : pool;
    // Mini-boss: only medium or large enemies (never small)
    if (tier === "miniBoss" && filteredPool === pool) {
      filteredPool = pool.filter((e) => {
        const s = e?.size || e?.base?.size || 72;
        return s > 80;
      });
    }
    const pickPool = filteredPool.length ? filteredPool : pool;
    let base = pickPool[Math.floor(Math.random() * pickPool.length)];
    if (this.hasCond("eliteSpawn")) {
      // Promote within the chosen pool so we don't accidentally break the size filter.
      const idx = pickPool.findIndex((e) => e.name === base.name);
      base = pickPool[Math.min(idx + 1, pickPool.length - 1)] || base;
    }
    
    // Determine size category based on base enemy size
    const baseSize = base.size || base.base?.size || 72;
    let sizeCategory = "medium";
    if (baseSize <= 80) {
      sizeCategory = "small";
    } else if (baseSize > 100) {
      sizeCategory = "large";
    }
    
    // Determine group size based on tier and size category
    let groupSize = 1; // Default
    if (tier === "minion") {
      if (sizeCategory === "small") {
        groupSize = 4 + Math.floor(Math.random() * 3); // 4-6
      } else if (sizeCategory === "medium") {
        groupSize = 2 + Math.floor(Math.random() * 2); // 2-3
      } else {
        // large
        groupSize = 1;
      }
    } else if (tier === "elite") {
      if (sizeCategory === "small") {
        groupSize = 2 + Math.floor(Math.random() * 3); // 2-4
      } else if (sizeCategory === "medium") {
        groupSize = 1 + Math.floor(Math.random() * 2); // 1-2
      } else {
        // large
        groupSize = 1;
      }
    } else {
      // miniBoss always 1
      groupSize = 1;
    }
    
    // For elites, generate affixes once for the whole group
    let groupAffixes = [];
    if (tier === "elite") {
      const pool = [...AFFIX_DEFS];
      for (let i = 0; i < 2 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        groupAffixes.push(pool.splice(idx, 1)[0].id);
      }
    } else if (tier === "miniBoss") {
      const pool = [...AFFIX_DEFS];
      for (let i = 0; i < 4 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        groupAffixes.push(pool.splice(idx, 1)[0].id);
      }
    }
    
    // Calculate stats once for the group
    const s = this.mapDef.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const tm = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS.minion;
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp * tm.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack * tm.atk);
    let spd = Math.round(base.speed * s.speed);
    const size = Math.max(16, Math.round(base.size * tm.size));
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
    spd = Math.round(spd * getSizeCategorySpeedMult(base.size));
    const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd, size };

    // Spawn the group - first enemy gets a random position, others spawn near it
    let firstEnemyPos = null;
    for (let i = 0; i < groupSize; i++) {
      let pos;
      let attempts = 0;
      const maxAttempts = 50;
      
      do {
        if (i === 0 || !firstEnemyPos) {
          // First enemy: random position
          pos = this.randomPosition(size, game);
        } else {
          // Subsequent enemies: spawn near the first enemy
          const dist = 40 + Math.random() * 40;
          const angle = Math.random() * Math.PI * 2;
          pos = new Vec2(
            firstEnemyPos.x + Math.cos(angle) * dist - size / 2,
            firstEnemyPos.y + Math.sin(angle) * dist - size / 2
          );
          const margin = this.world.wallThickness + size;
          pos.x = Math.max(margin, Math.min(pos.x, this.world.width - margin - size));
          pos.y = Math.max(margin, Math.min(pos.y, this.world.height - margin - size));
        }
        
        let insideRoom = false;
        if (this.isInsideEntrySafeZone(pos.x, pos.y, size, game)) insideRoom = true;
        if (this.isOnWall(pos.x, pos.y, size)) insideRoom = true;
        if (this.isOnBlockingObstacle(pos.x, pos.y, size, game)) insideRoom = true;

        if (!insideRoom) break;
        attempts++;
      } while (attempts < maxAttempts);
      if (this.isOnWall(pos.x, pos.y, size) || this.isOnBlockingObstacle(pos.x, pos.y, size, game)) {
        pos = this.pushOutOfBlockers(pos.x, pos.y, size, game);
      }
      if (i === 0) firstEnemyPos = pos;
      
      const enemy = new Enemy(pos.x, pos.y, typeDef);
      enemy.worldBounds = { width: this.world.width, height: this.world.height };
      enemy.enemyTier = tier;
      enemy.tierXpMult = tm.xp;
      enemy.attackScale = tier === "minion" ? 1 : tier === "elite" ? 1.25 : 1.6;
      enemy.enableHiddenAttacks = tier === "miniBoss";
      if (tier === "elite") enemy.isElite = true;
      if (tier === "miniBoss") enemy.isMiniBoss = true;
      enemy.attackCtrl = new EnemyAttackController(enemy);
      if (this.hasCond("enemyRegen")) enemy.regenRate = 2;
      if (this.hasCond("eliteSpawn") && tier !== "miniBoss") enemy.isElite = true;
      enemy.affixes = [...groupAffixes]; // Same affixes for all in group
      if (enemy.affixes.includes("evasive")) {
        enemy.speed = Math.round(enemy.speed * 1.3);
      }
      this.enemies.push(enemy);
    }
  }

  spawnGoblinKingEncounter(game) {
    if (!game) return;
    const kingSize = 96;
    const kingPos = this.randomPosition(kingSize, game);
    if (!kingPos) return;
    const king = this.spawnOne("miniBoss", null, kingPos, game, "GoblinKing", true);
    if (king) king.goblinKingMinions = king.goblinKingMinions || [];
  }

  spawnInitialBiome(game = null) {
    const data = this.world.archetypeGrid;
    if (!data?.grid) return;
    if (game) game._goblinKingSpawnRolled = false;
    for (let row = 0; row < BIOME_GRID_ROWS; row++) {
      for (let col = 0; col < BIOME_GRID_COLS; col++) {
        const archetype = data.grid[row][col];
        if (archetype === BIOME_ARCHETYPE.START || archetype === BIOME_ARCHETYPE.EXIT) continue;
        const bounds = getBiomeCellBounds(this.world, col, row);
        game._biomeCellBounds = bounds;
        game._biomeCellArchetype = archetype;
        try {
          if (archetype === BIOME_ARCHETYPE.OPEN_SPACE) {
            if (game && !game._goblinKingSpawnRolled) {
              game._goblinKingSpawnRolled = true;
              if (Math.random() < 0.05) this.spawnGoblinKingEncounter(game);
            }
            for (let i = 0; i < 4; i++) this.spawnGroup('minion', game);
            if (Math.random() < 0.7) this.spawnGroup('elite', game);
            if (Math.random() < 0.5) this.spawnGroup('elite', game);
          } else if (archetype === BIOME_ARCHETYPE.CORRIDORS) {
            const n = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) {
              this.spawnGroup(Math.random() < 0.7 ? 'minion' : 'elite', game, { onlySizeCategory: 'small' });
            }
          } else if (archetype === BIOME_ARCHETYPE.LOST_CAMPS) {
            for (let i = 0; i < 3; i++) this.spawnGroup('elite', game);
            if (Math.random() < 0.5) this.spawnGroup('elite', game);
          } else if (archetype === BIOME_ARCHETYPE.MINIBOSS) {
            this.spawnGroup('miniBoss', game);
          } else if (archetype === BIOME_ARCHETYPE.VAULT) {
            const n = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) this.spawnGroup(Math.random() < 0.5 ? 'minion' : 'elite', game);
          } else if (archetype === BIOME_ARCHETYPE.RUINS) {
            for (let i = 0; i < 3; i++) this.spawnGroup(Math.random() < 0.6 ? 'minion' : 'elite', game);
          } else if (archetype === BIOME_ARCHETYPE.WOODS) {
            for (let i = 0; i < 2; i++) this.spawnGroup('elite', game);
          }
        } finally {
          game._biomeCellBounds = null;
          game._biomeCellArchetype = null;
        }
      }
    }
  }

  spawnInitial(game = null) {
    if (this.world.archetypeGrid) {
      this.spawnInitialBiome(game);
      return;
    }
    const mapId = this.mapDef?.id;
    if (mapId === 4) {
      this.spawnBoss(game);
    } else if (mapId === 3) {
      // Castle pressure: double mini-boss anchor plus elite-heavy groups.
      const squadAnchor = this.getCastleExitAnchor(game);
      this.spawnHumanSquad(squadAnchor.x, squadAnchor.y, game, { asElite: true });
      this.spawnGroup("miniBoss", game);
      this.spawnGroup("miniBoss", game);
      const groupCount = 7 + Math.floor(Math.random() * 3); // 7-9 groups
      const guaranteedEliteGroups = 4;
      for (let i = 0; i < groupCount; i++) {
        const tier = i < guaranteedEliteGroups
          ? "elite"
          : (Math.random() < 0.45 ? "elite" : "minion");
        this.spawnGroup(tier, game);
      }
    } else {
      // Spawn one miniBoss
      this.spawnGroup("miniBoss", game);
      // 5% chance per map for GoblinKing encounter (open space / full map)
      if (Math.random() < 0.05) this.spawnGoblinKingEncounter(game);
      // Spawn groups of minions and elites
      const groupCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < groupCount; i++) {
        const tier = Math.random() < 0.79 ? "minion" : "elite";
        this.spawnGroup(tier, game);
      }
    }
  }

  update(dt) {
  }

  draw(ctx, camera, gameTime = null) {
    for (const e of this.enemies) {
      e.draw(ctx, camera, gameTime);
    }
    if (this.boss) {
      this.boss.draw(ctx, camera, gameTime);
    }
    for (const p of this.projectiles) {
      p.draw(ctx, camera);
    }
  }
}
