import { Vec2 } from '../utils.js';
import { DIFFICULTY_STAT_MULTIPLIER } from '../data/constants.js';
import { MAP_DEFS } from '../data/maps.js';
import { ENEMY_TYPES, AFFIX_DEFS, Enemy } from './enemy.js';
import { Boss, BOSS_MAX_HP, BOSS_SIZE } from './boss.js';
import { Projectile } from './projectile.js';
import { EnemyAttackController } from './attacks/index.js';
import { getHumanSquadTypeDef, HUMAN_SQUAD_FORMATION } from '../data/human-squad-data.js';

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
  }

  hasCond(id) {
    return this.conditions.some((c) => c.id === id);
  }

  setMap(mapDef) {
    this.mapDef = mapDef;
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

  randomPosition(size, game = null) {
    const margin = this.world.wallThickness + size + 40;
    const minX = margin;
    const maxAttempts = this.world.tileWallRects ? 80 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = minX + Math.random() * (this.world.width - margin - minX);
      const y = margin + Math.random() * (this.world.height - margin * 2);
      if (this.isOnWall(x, y, size)) continue;
      if (this.isInsideEntrySafeZone(x, y, size, game)) continue;
      return new Vec2(x, y);
    }
    return new Vec2(minX + (this.world.width - margin - minX) * 0.5, this.world.height / 2 - size / 2);
  }

  spawnOne(forceTier = null, forceAffixIds = null, nearPosition = null, game = null, forceType = null) {
    let base = forceType
      ? (ENEMY_TYPES.find((e) => e.name === forceType || e.id === forceType) || ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)])
      : ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    if (!forceType && this.hasCond("eliteSpawn")) {
      const idx = ENEMY_TYPES.findIndex((e) => e.name === base.name);
      base = ENEMY_TYPES[Math.min(idx + 1, ENEMY_TYPES.length - 1)] || base;
    }
    const tier = forceTier || (Math.random() < 0.79 ? "minion" : "elite");
    const s = this.mapDef.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const tierMult = { minion: { hp: 0.5, atk: 1, xp: 0.7, size: 1.4 }, elite: { hp: 1, atk: 1.2, xp: 1.4, size: 1 }, miniBoss: { hp: 5, atk: 2, xp: 5, size: 1.2 } };
    const tm = tierMult[tier];
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp * tm.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack * tm.atk);
    let spd = Math.round(base.speed * s.speed);
    const size = Math.max(16, Math.round(base.size * tm.size));
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
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

      if (!insideRoom) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (this.isOnWall(pos.x, pos.y, size)) {
      pos = this.pushOutOfWalls(pos.x, pos.y, size);
    }
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
    enemy.affixes = [];
    if (forceAffixIds && forceAffixIds.length > 0) {
      enemy.affixes = [...forceAffixIds];
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
    }
    if (enemy.affixes?.includes("regenerating")) enemy.regenRate = (enemy.regenRate || 0) + 3;
    if (enemy.affixes?.includes("rooted")) {
      // +50% max health for rooted enemies
      const healthRatio = enemy.health / enemy.maxHealth;
      enemy.maxHealth = Math.round(enemy.maxHealth * 1.5);
      enemy.health = Math.round(enemy.maxHealth * healthRatio);
    }
    this.enemies.push(enemy);
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
      const spd = Math.round(base.speed * (s.speed || 1));
      const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd };
      let px = centerX + slot.offsetX - base.size / 2;
      let py = centerY + slot.offsetY - base.size / 2;
      px = Math.max(margin, Math.min(px, this.world.width - margin - base.size));
      py = Math.max(margin, Math.min(py, this.world.height - margin - base.size));
      if (this.isOnWall(px, py, base.size)) {
        const pushed = this.pushOutOfWalls(px, py, base.size);
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

      if (!insideRoom) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (this.isOnWall(pos.x, pos.y, BOSS_SIZE)) {
      pos = this.pushOutOfWalls(pos.x, pos.y, BOSS_SIZE);
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
    const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const s = { hp: 0.8, attack: 0.9, speed: 1.1 };
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack);
    let spd = Math.round(base.speed * s.speed);
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
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
      if (!insideRoom) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (this.isOnWall(pos.x, pos.y, typeDef.size)) {
      pos = this.pushOutOfWalls(pos.x, pos.y, typeDef.size);
    }
    const enemy = new Enemy(pos.x, pos.y, typeDef);
    enemy.attackScale = 1;
    enemy.enableHiddenAttacks = false;
    enemy.attackCtrl = new EnemyAttackController(enemy);
    if (this.hasCond("enemyRegen")) enemy.regenRate = 2;
    this.enemies.push(enemy);
  }

  spawnGroup(tier, game = null) {
    // Choose a random base enemy type for this group
    let base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    if (this.hasCond("eliteSpawn")) {
      const idx = ENEMY_TYPES.findIndex((e) => e.name === base.name);
      base = ENEMY_TYPES[Math.min(idx + 1, ENEMY_TYPES.length - 1)] || base;
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
    const tierMult = { minion: { hp: 0.5, atk: 1, xp: 0.7, size: 1.4 }, elite: { hp: 1, atk: 1.2, xp: 1.4, size: 1 }, miniBoss: { hp: 5, atk: 2, xp: 5, size: 1.2 } };
    const tm = tierMult[tier];
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp * tm.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack * tm.atk);
    let spd = Math.round(base.speed * s.speed);
    const size = Math.max(16, Math.round(base.size * tm.size));
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
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

        if (!insideRoom) break;
        attempts++;
      } while (attempts < maxAttempts);
      if (this.isOnWall(pos.x, pos.y, size)) {
        pos = this.pushOutOfWalls(pos.x, pos.y, size);
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
      
      if (enemy.affixes?.includes("regenerating")) enemy.regenRate = (enemy.regenRate || 0) + 3;
      if (enemy.affixes?.includes("rooted")) {
        // +50% max health for rooted enemies
        const healthRatio = enemy.health / enemy.maxHealth;
        enemy.maxHealth = Math.round(enemy.maxHealth * 1.5);
        enemy.health = Math.round(enemy.maxHealth * healthRatio);
      }
      
      this.enemies.push(enemy);
    }
  }

  spawnInitial(game = null) {
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
      
      // Spawn groups of minions and elites
      // Target around 20-30 total enemies, so spawn 4-6 groups
      const groupCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < groupCount; i++) {
        // 79% chance for minion group, 21% chance for elite group
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
