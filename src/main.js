// -------- Core types & utilities --------

class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
}

class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
  }

  onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
    }
    this.keys.add(key);
  }

  onKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
  }

  getAxis() {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;

    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }

    return new Vec2(x, y);
  }
}

class Camera {
  constructor(viewWidth, viewHeight) {
    this.position = new Vec2();
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  follow(target, worldWidth, worldHeight) {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;

    let camX = target.position.x + target.size / 2 - halfW;
    let camY = target.position.y + target.size / 2 - halfH;

    camX = Math.max(0, Math.min(camX, worldWidth - this.viewWidth));
    camY = Math.max(0, Math.min(camY, worldHeight - this.viewHeight));

    this.position.set(camX, camY);
  }
}

class Player {
  constructor(x, y) {
    this.position = new Vec2(x, y);
    this.size = 48;
    this.speed = 220;
    this.color = "#ffff4d";
  }

  update(dt, input, world) {
    const axis = input.getAxis();
    const dx = axis.x * this.speed * dt;
    const dy = axis.y * this.speed * dt;

    let nx = this.position.x + dx;
    let ny = this.position.y + dy;

    nx = Math.max(world.wallThickness, Math.min(nx, world.width - world.wallThickness - this.size));
    ny = Math.max(world.wallThickness, Math.min(ny, world.height - world.wallThickness - this.size));

    this.position.set(nx, ny);
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);

    ctx.fillStyle = this.color;
    ctx.fillRect(sx, sy, this.size, this.size);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, this.size, this.size);
  }
}

// -------- Map definitions --------

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;
const WALL_THICKNESS = 32;

const MAP_DEFS = [
  {
    id: 0,
    name: "Dungeon",
    number: 1,
    floorColor: "#1e1b2e",
    floorPattern: "bricks",
    wallColor: "#3d3a4a",
    wallAccent: "#5a5668",
    exits: [
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 1, spawnSide: "left" }
    ],
    enemyCount: 3,
    enemyScale: { hp: 1, attack: 1, speed: 1 },
    lootQuality: 0,
  },
  {
    id: 1,
    name: "Forest",
    number: 2,
    floorColor: "#0d2818",
    floorPattern: "grass",
    wallColor: "#2d4a2e",
    wallAccent: "#3d6b3e",
    exits: [
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 0, spawnSide: "right" },
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 2, spawnSide: "left" }
    ],
    enemyCount: 4,
    enemyScale: { hp: 1.2, attack: 1.15, speed: 1.1 },
    lootQuality: 0.2,
  },
  {
    id: 2,
    name: "Cave",
    number: 3,
    floorColor: "#1a1a2e",
    floorPattern: "stone",
    wallColor: "#2a2a3e",
    wallAccent: "#3a3a4e",
    exits: [
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 1, spawnSide: "right" },
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 3, spawnSide: "left" }
    ],
    enemyCount: 5,
    enemyScale: { hp: 1.5, attack: 1.3, speed: 1.2 },
    lootQuality: 0.4,
  },
  {
    id: 3,
    name: "Castle",
    number: 4,
    floorColor: "#2c2c3c",
    floorPattern: "tiles",
    wallColor: "#4a4a5a",
    wallAccent: "#6a6a7a",
    exits: [
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 2, spawnSide: "right" },
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 4, spawnSide: "left" }
    ],
    enemyCount: 6,
    enemyScale: { hp: 2, attack: 1.5, speed: 1.3 },
    lootQuality: 0.6,
  },
  {
    id: 4,
    name: "Wasteland",
    number: 5,
    floorColor: "#2a2520",
    floorPattern: "cracked",
    wallColor: "#4a4035",
    wallAccent: "#6a5a45",
    exits: [
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 3, spawnSide: "right" }
    ],
    enemyCount: 8,
    enemyScale: { hp: 2.5, attack: 1.8, speed: 1.5 },
    lootQuality: 0.85,
  },
];

class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.wallThickness = WALL_THICKNESS;
    this.wallColor = "#2d3748";
    this.floorColor = "#0f172a";
    this.theme = null;
  }

  setTheme(mapDef) {
    this.theme = mapDef;
    if (mapDef) {
      this.floorColor = mapDef.floorColor;
      this.wallColor = mapDef.wallColor;
    }
  }

  draw(ctx, camera) {
    const ox = -camera.position.x;
    const oy = -camera.position.y;
    const t = this.wallThickness;

    // Floor with optional pattern
    ctx.fillStyle = this.floorColor;
    ctx.fillRect(ox, oy, this.width, this.height);

    if (this.theme && this.theme.floorPattern) {
      ctx.fillStyle = this.theme.wallAccent || "#374151";
      ctx.globalAlpha = 0.15;
      const grid = 24;
      for (let gx = 0; gx < this.width + grid; gx += grid) {
        for (let gy = 0; gy < this.height + grid; gy += grid) {
          if ((gx + gy) % (grid * 2) === 0) {
            ctx.fillRect(ox + gx, oy + gy, grid, grid);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // Walls
    ctx.fillStyle = this.wallColor;
    ctx.fillRect(ox, oy, this.width, t);
    ctx.fillRect(ox, oy + this.height - t, this.width, t);
    ctx.fillRect(ox, oy, t, this.height);
    ctx.fillRect(ox + this.width - t, oy, t, this.height);

    // Wall accent (inner edge)
    if (this.theme && this.theme.wallAccent) {
      ctx.fillStyle = this.theme.wallAccent;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(ox + t, oy + t, this.width - t * 2, 2);
      ctx.fillRect(ox + t, oy + this.height - t - 2, this.width - t * 2, 2);
      ctx.fillRect(ox + t, oy + t, 2, this.height - t * 2);
      ctx.fillRect(ox + this.width - t - 2, oy + t, 2, this.height - t * 2);
      ctx.globalAlpha = 1;
    }

    // Exit zones (doorways - cut out or highlight)
    if (this.theme && this.theme.exits) {
      ctx.fillStyle = "rgba(30, 64, 175, 0.25)";
      for (const exit of this.theme.exits) {
        ctx.fillRect(ox + exit.x, oy + exit.y, exit.w, exit.h);
      }
    }
  }
}

// -------- Enemy --------

const ENEMY_TYPES = [
  { name: "Slime",    color: "#4ade80", size: 36, maxHealth: 40,  attack: 6,  speed: 60,  dropChance: 0.25, minDrop: 1, maxDrop: 1, minXp: 10, maxXp: 20 },
  { name: "Bat",      color: "#c084fc", size: 28, maxHealth: 25,  attack: 8,  speed: 100, dropChance: 0.2,  minDrop: 1, maxDrop: 1, minXp: 10, maxXp: 20 },
  { name: "Skeleton", color: "#e2e8f0", size: 38, maxHealth: 60,  attack: 10, speed: 70,  dropChance: 0.45, minDrop: 1, maxDrop: 2, minXp: 30, maxXp: 50 },
  { name: "Demon",    color: "#f87171", size: 44, maxHealth: 100, attack: 15, speed: 50,  dropChance: 0.55, minDrop: 1, maxDrop: 2, minXp: 30, maxXp: 50 },
  { name: "Wisp",     color: "#67e8f9", size: 30, maxHealth: 20,  attack: 5,  speed: 130, dropChance: 0.18, minDrop: 1, maxDrop: 1, minXp: 10, maxXp: 20 },
];

const BOSS_XP = 200;

function getXpForLevel(level) {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  if (level === 3) return 250;
  if (level === 4) return 500;
  return 500 * Math.pow(1.5, level - 4);
}

const LEVEL_UP_BONUSES = [
  { id: "attack", label: "+10% Attack Damage", apply: (g) => { g.levelAttackMult = (g.levelAttackMult || 1) * 1.1; } },
  { id: "health", label: "+15% Max Health", apply: (g) => { g.levelHealthMult = (g.levelHealthMult || 1) * 1.15; } },
  { id: "speed", label: "+10% Movement Speed", apply: (g) => { g.levelSpeedMult = (g.levelSpeedMult || 1) * 1.1; } },
  { id: "attackSpeed", label: "+5% Attack Speed", apply: (g) => { g.levelAttackSpeedMult = (g.levelAttackSpeedMult || 1) * 1.05; } },
  { id: "cardSlot", label: "+1 Upgrade Card Slot", apply: (g) => { g.maxUpgradeCards = (g.maxUpgradeCards || 3) + 1; } },
];

let ENEMY_ID_COUNTER = 0;

class Enemy {
  constructor(x, y, typeDef) {
    this.id = ++ENEMY_ID_COUNTER;
    this.position = new Vec2(x, y);
    this.size = typeDef.size;
    this.name = typeDef.name;
    this.color = typeDef.color;
    this.maxHealth = typeDef.maxHealth;
    this.health = typeDef.maxHealth;
    this.attack = typeDef.attack;
    this.speed = typeDef.speed;

    // How often the enemy can deal damage (seconds)
    this.attackCooldown = 1.0;
    this.attackTimer = 0;

    // Flash red briefly when hit
    this.hitFlashTimer = 0;
  }

  get center() {
    return new Vec2(
      this.position.x + this.size / 2,
      this.position.y + this.size / 2
    );
  }

  distanceTo(other) {
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const ox = other.position.x + other.size / 2;
    const oy = other.position.y + other.size / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  update(dt, player) {
    // Move toward player
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.position.x += (dx / dist) * this.speed * dt;
    this.position.y += (dy / dist) * this.speed * dt;

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
  }

  intersects(other) {
    const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hitFlashTimer = 0.12;
    if (this.health < 0) this.health = 0;
  }

  get isDead() {
    return this.health <= 0;
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);

    // Body
    ctx.fillStyle = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    ctx.fillRect(sx, sy, this.size, this.size);

    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, sy, this.size, this.size);

    // Health bar
    const barW = this.size;
    const barH = 5;
    const barY = sy - 8;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(sx, barY, barW, barH);
    const pct = Math.max(0, this.health / this.maxHealth);
    const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
    ctx.fillStyle = hpColor;
    ctx.fillRect(sx, barY, Math.round(barW * pct), barH);
  }
}

// -------- Projectile (boss attacks) --------

class Projectile {
  constructor(x, y, vx, vy, damage, size = 12, color = "#ef4444") {
    this.position = new Vec2(x, y);
    this.velocity = new Vec2(vx, vy);
    this.damage = damage;
    this.size = size;
    this.color = color;
  }

  update(dt) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }

  intersects(other) {
    const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -------- Boss --------

const BOSS_MAX_HP = 800;
const BOSS_ATTACK = 25;
const BOSS_BASE_SPEED = 55;
const BOSS_SIZE = 72;

class Boss {
  constructor(x, y) {
    this.id = "boss";
    this.isBoss = true;
    this.position = new Vec2(x, y);
    this.size = BOSS_SIZE;
    this.name = "Wasteland Tyrant";
    this.color = "#8b0000";
    this.maxHealth = BOSS_MAX_HP;
    this.health = BOSS_MAX_HP;
    this.attack = BOSS_ATTACK;
    this.speed = BOSS_BASE_SPEED;
    this.attackCooldown = 1.2;
    this.attackTimer = 0;
    this.hitFlashTimer = 0;

    this.phase2 = false;
    this.chargeCooldown = 4;
    this.chargeTimer = 0;
    this.chargeActive = false;
    this.chargeDir = new Vec2(0, 0);
    this.chargeSpeed = 420;

    this.projectileCooldown = 2.5;
    this.projectileTimer = 0;

    this.minionCooldown = 8;
    this.minionTimer = 0;
  }

  get center() {
    return new Vec2(
      this.position.x + this.size / 2,
      this.position.y + this.size / 2
    );
  }

  distanceTo(other) {
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const ox = other.position.x + other.size / 2;
    const oy = other.position.y + other.size / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hitFlashTimer = 0.12;
    if (this.health < 0) this.health = 0;
    if (!this.phase2 && this.health <= this.maxHealth * 0.5) {
      this.phase2 = true;
      this.speed = BOSS_BASE_SPEED * 1.5;
      this.chargeSpeed = 520;
      this.chargeCooldown = 2.8;
      this.projectileCooldown = 1.8;
      this.minionCooldown = 5;
    }
  }

  get isDead() {
    return this.health <= 0;
  }

  intersects(other) {
    const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
    const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);

    ctx.fillStyle = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    ctx.fillRect(sx, sy, this.size, this.size);
    ctx.strokeStyle = this.phase2 ? "#ff4444" : "#4a0000";
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, this.size, this.size);
  }
}

class EnemySystem {
  constructor(world, mapDef) {
    this.world = world;
    this.mapDef = mapDef || MAP_DEFS[0];
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.respawnQueue = [];
  }

  setMap(mapDef) {
    this.mapDef = mapDef;
  }

  randomPosition(size) {
    const margin = this.world.wallThickness + size + 40;
    const x = margin + Math.random() * (this.world.width - margin * 2);
    const y = margin + Math.random() * (this.world.height - margin * 2);
    return new Vec2(x, y);
  }

  spawnOne() {
    const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const s = this.mapDef.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const typeDef = {
      ...base,
      maxHealth: Math.round(base.maxHealth * s.hp),
      attack: Math.round(base.attack * s.attack),
      speed: Math.round(base.speed * s.speed),
    };
    const pos = this.randomPosition(typeDef.size);
    this.enemies.push(new Enemy(pos.x, pos.y, typeDef));
  }

  spawnBoss() {
    const pos = this.randomPosition(BOSS_SIZE);
    this.boss = new Boss(pos.x, pos.y);
  }

  spawnMinion() {
    const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const s = { hp: 0.8, attack: 0.9, speed: 1.1 };
    const typeDef = {
      ...base,
      maxHealth: Math.round(base.maxHealth * s.hp),
      attack: Math.round(base.attack * s.attack),
      speed: Math.round(base.speed * s.speed),
    };
    const pos = this.randomPosition(typeDef.size);
    this.enemies.push(new Enemy(pos.x, pos.y, typeDef));
  }

  spawnInitial() {
    if (this.mapDef.id === 4) {
      this.spawnBoss();
    } else {
      const count = (this.mapDef.enemyCount || 4) + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        this.spawnOne();
      }
    }
  }

  update(dt) {
    if (this.boss) return;
    this.respawnQueue = this.respawnQueue.filter((timer) => {
      timer.delay -= dt;
      if (timer.delay <= 0) {
        this.spawnOne();
        return false;
      }
      return true;
    });
  }

  queueRespawn(delaySeconds = 6) {
    this.respawnQueue.push({ delay: delaySeconds });
  }

  draw(ctx, camera) {
    for (const e of this.enemies) {
      e.draw(ctx, camera);
    }
    if (this.boss) {
      this.boss.draw(ctx, camera);
    }
    for (const p of this.projectiles) {
      p.draw(ctx, camera);
    }
  }
}

// -------- Loot & cards definitions --------

const DEV_MODE_ENABLED = true;

const LOOT_DEFS = [
  {
    type: "Helmet",
    items: [
      { name: "Leather Cap", stats: { defense: 2 } },
      { name: "Iron Helmet", stats: { defense: 5 } },
      { name: "Steel Helmet", stats: { defense: 8 } },
      { name: "Dragon Helm", stats: { defense: 12 } }
    ]
  },
  {
    type: "Boots",
    items: [
      { name: "Leather Boots", stats: { speed: 40 } },
      { name: "Iron Greaves", stats: { speed: 60 } },
      { name: "Steel Greaves", stats: { speed: 90 } },
      { name: "Wind Boots", stats: { speed: 120 } }
    ]
  },
  {
    type: "Body Armour",
    items: [
      { name: "Leather Armour", stats: { maxHealth: 20 } },
      { name: "Chainmail Vest", stats: { maxHealth: 40 } },
      { name: "Plate Armour", stats: { maxHealth: 60 } },
      { name: "Dragon Scale", stats: { maxHealth: 80 } }
    ]
  },
  {
    type: "Weapon",
    items: [
      { name: "Wooden Staff", stats: { attack: 4 } },
      { name: "Iron Sword", stats: { attack: 8 } },
      { name: "Steel Sword", stats: { attack: 12 } },
      { name: "Legendary Blade", stats: { attack: 18 } }
    ]
  },
  {
    type: "Upgrade Card",
    items: [
      {
        name: "Swift Feet",
        cardKey: "swiftFeet",
        description: "Burst of speed for 2s after picking up loot."
      },
      {
        name: "Iron Skin",
        cardKey: "ironSkin",
        description: "Every 10s gain a shield that blocks one hit."
      },
      {
        name: "Vampiric",
        cardKey: "vampiric",
        description: "Heal a bit whenever you pick up loot."
      },
      {
        name: "Double Strike",
        cardKey: "doubleStrike",
        description: "Every 5th attack deals double damage."
      },
      {
        name: "Magnet",
        cardKey: "magnet",
        description: "Nearby loot is pulled toward you."
      },
      {
        name: "Berserker",
        cardKey: "berserker",
        description: "Move/attack faster as your health gets lower."
      },
      {
        name: "Lucky",
        cardKey: "lucky",
        description: "Avoid damage to gradually improve loot quality."
      },
      {
        name: "Thorns",
        cardKey: "thorns",
        description: "Enemies that touch you take reflected damage."
      },
      {
        name: "Scavenger",
        cardKey: "scavenger",
        description: "Defeated enemies can drop bonus loot."
      },
      {
        name: "Ghost Step",
        cardKey: "ghostStep",
        description: "Briefly untouchable after taking damage."
      }
    ]
  }
];

const LOOT_COLORS = {
  Helmet: "#38bdf8",
  Boots: "#f97316",
  "Body Armour": "#a855f7",
  Weapon: "#facc15",
  "Upgrade Card": "#22c55e"
};

let GLOBAL_LUCK = 0;

function getUpgradeCardDefs() {
  const group = LOOT_DEFS.find((g) => g.type === "Upgrade Card");
  return group ? group.items : [];
}

class LootItem {
  constructor(id, x, y, definition, burstFromX = null, burstFromY = null) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.size = 20;
    this.type = definition.type;
    this.name = definition.name;
    this.stats = definition.stats || {};
    this.cardKey = definition.cardKey || null;
    this.description = definition.description || "";
    this.color = LOOT_COLORS[this.type] || "#fbbf24";
    this.burstFrom = burstFromX != null && burstFromY != null ? { x: burstFromX, y: burstFromY } : null;
    this.burstProgress = 0;
  }

  updateBurst(dt) {
    if (!this.burstFrom) return;
    this.burstProgress = Math.min(1, this.burstProgress + dt / 0.18);
    if (this.burstProgress >= 1) this.burstFrom = null;
  }

  get displayPosition() {
    if (!this.burstFrom || this.burstProgress >= 1) return this.position;
    const t = this.burstProgress;
    const easeOut = 1 - (1 - t) * (1 - t);
    return new Vec2(
      this.burstFrom.x + (this.position.x - this.burstFrom.x) * easeOut,
      this.burstFrom.y + (this.position.y - this.burstFrom.y) * easeOut
    );
  }

  draw(ctx, camera, timeSeconds) {
    const pos = this.displayPosition;
    const sx = Math.floor(pos.x - camera.position.x);
    const sy = Math.floor(pos.y - camera.position.y);
    const half = this.size / 2;
    const pulse = 0.75 + 0.25 * Math.sin(timeSeconds * 4 + this.id);

    ctx.save();
    ctx.translate(sx + half, sy + half);
    ctx.scale(pulse, pulse);

    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, half);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  intersectsPlayer(player) {
    if (this.burstFrom && this.burstProgress < 1) return false;
    const pos = this.displayPosition;
    const r1 = {
      x: pos.x,
      y: pos.y,
      w: this.size,
      h: this.size
    };
    const r2 = {
      x: player.position.x,
      y: player.position.y,
      w: player.size,
      h: player.size
    };

    return (
      r1.x < r2.x + r2.w &&
      r1.x + r1.w > r2.x &&
      r1.y < r2.y + r2.h &&
      r1.y + r1.h > r2.y
    );
  }
}

class LootSystem {
  constructor(world) {
    this.world = world;
    this.items = [];
    this.nextId = 1;
    this.mapLootQuality = 0;
  }

  setMapLootQuality(quality) {
    this.mapLootQuality = quality;
  }

  getLootDefinition(qualityBonus = 0) {
    const group = LOOT_DEFS[Math.floor(Math.random() * LOOT_DEFS.length)];
    const itemDef = group.items[Math.floor(Math.random() * group.items.length)];

    const qualityBias = Math.min(1, this.mapLootQuality + GLOBAL_LUCK + qualityBonus);
    let chosen = itemDef;
    if (qualityBias > 0 && group.type !== "Upgrade Card" && group.items.length > 1) {
      const strong = group.items[group.items.length - 1];
      if (Math.random() < qualityBias) {
        chosen = strong;
      }
    }

    return {
      type: group.type,
      name: chosen.name,
      stats: chosen.stats,
      cardKey: chosen.cardKey,
      description: chosen.description
    };
  }

  spawnBurstAt(centerX, centerY, count, qualityBonus = 0) {
    const size = 20;
    const burstRadius = 45;
    const margin = this.world.wallThickness + 15;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = burstRadius + Math.random() * 25;
      const landX = centerX + Math.cos(angle) * dist - size / 2;
      const landY = centerY + Math.sin(angle) * dist - size / 2;

      const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
      const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));

      const def = this.getLootDefinition(qualityBonus);
      const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
      item.size = size;
      this.items.push(item);
    }
  }

  update(dt, player, onLootPicked) {
    for (const item of this.items) {
      item.updateBurst(dt);
    }

    const remaining = [];
    for (const item of this.items) {
      if (item.intersectsPlayer(player)) {
        if (onLootPicked) onLootPicked(item);
      } else {
        remaining.push(item);
      }
    }
    this.items = remaining;
  }

  draw(ctx, camera, timeSeconds) {
    for (const item of this.items) {
      item.draw(ctx, camera, timeSeconds);
    }
  }
}

// -------- Game orchestration --------

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.lastTime = 0;
    this.time = 0;

    this.input = new Input();

    this.inventory = [];
    this.inventoryListEl = document.getElementById("inventory-list");
    this.equippedListEl = document.getElementById("equipped-list");
    this.upgradeCardListEl = document.getElementById("upgrade-card-list");
    this.playerStatsEl = document.getElementById("player-stats");
    this.devToggleEl = document.getElementById("dev-toggle");
    this.devPanelEl = document.getElementById("dev-panel");
    this.devGiveAllEl = document.getElementById("dev-give-all");
    this.devMaxStatsEl = document.getElementById("dev-max-stats");
    this.devCardListEl = document.getElementById("dev-card-list");
    this.devCloseEl = document.getElementById("dev-close");

    this.baseStats = {
      maxHealth: 100,
      defense: 0,
      speed: 220,
      attack: 10
    };
    this.currentStats = { ...this.baseStats };
    this.currentHealth = this.baseStats.maxHealth;
    this.timeSinceLastHit = 0;

    this.equipment = {
      Helmet: null,
      "Body Armour": null,
      Weapon: null,
      Boots: null
    };

    this.maxUpgradeCards = 3;
    this.activeUpgradeCards = [];

    this.level = 1;
    this.xp = 0;
    this.levelUpChoices = null;
    this.levelAttackMult = 1;
    this.levelHealthMult = 1;
    this.levelSpeedMult = 1;
    this.levelAttackSpeedMult = 1;

    this.swiftFeetTimer = 0;
    this.ironSkinTimer = 0;
    this.ironSkinShieldReady = false;
    this.doubleStrikeCounter = 0;
    this.ghostStepTimer = 0;

    this.viewWidth = 800;
    this.viewHeight = 600;
    this.world = new World(MAP_WIDTH, MAP_HEIGHT);

    this.currentMapId = 0;
    this.currentMap = MAP_DEFS[0];
    this.world.setTheme(this.currentMap);

    this.player = new Player(
      this.world.width / 2 - 24,
      this.world.height / 2 - 24
    );

    this.lootSystem = new LootSystem(this.world);
    this.lootSystem.setMapLootQuality(this.currentMap.lootQuality);

    this.enemySystem = new EnemySystem(this.world, this.currentMap);
    this.enemySystem.spawnInitial();

    this.mapNameEl = document.getElementById("map-name");
    this.xpBarFillEl = document.getElementById("xp-bar-fill");
    this.xpLabelEl = document.getElementById("xp-label");
    this.playerLevelEl = document.getElementById("player-level");

    // Player auto-attack state
    this.playerAttackRange = 120;
    this.playerAttackCooldown = 0.6;
    this.playerAttackTimer = 0;
    this.doubleStrikeCounter = 0;

    this.exitTransitionCooldown = 0;

    this.gameOver = false;
    this.paused = false;
    this.gameOverEl = document.getElementById("game-over");
    this.pauseToggleEl = document.getElementById("pause-toggle");
    this.bossHealthBarEl = document.getElementById("boss-health-bar");
    this.bossHealthFillEl = document.getElementById("boss-health-fill");
    this.bossHealthLabelEl = document.getElementById("boss-health-label");

    this.camera = new Camera(this.viewWidth, this.viewHeight);

    this.updateInventoryUI();
    this.updateEquippedUI();
    this.recalculateStats();
    this.updateMapUI();
    this.updateXpUI();
    this.initDevUI();

    const tryAgainBtn = document.getElementById("try-again-btn");
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener("click", () => this.restartGame());
    }

    const victorySaveBtn = document.getElementById("victory-save-btn");
    if (victorySaveBtn) {
      victorySaveBtn.addEventListener("click", () => this.saveCharacterAndReturnToMenu());
    }

    if (this.pauseToggleEl) {
      this.pauseToggleEl.addEventListener("click", () => this.togglePause());
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        this.togglePause();
      }
    });

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    const targetAspect = this.viewWidth / this.viewHeight;
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.9;
    const aspect = maxWidth / maxHeight;

    if (aspect > targetAspect) {
      this.canvas.height = maxHeight;
      this.canvas.width = maxHeight * targetAspect;
    } else {
      this.canvas.width = maxWidth;
      this.canvas.height = maxWidth / targetAspect;
    }

    this.ctx.imageSmoothingEnabled = false;
  }

  loop(timestamp) {
    const dt = (timestamp - this.lastTime) / 1000 || 0;
    this.lastTime = timestamp;

    if (!this.paused) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  initDevUI() {
    if (!DEV_MODE_ENABLED) {
      if (this.devToggleEl) this.devToggleEl.style.display = "none";
      if (this.devPanelEl) this.devPanelEl.style.display = "none";
      return;
    }

    if (this.devToggleEl && this.devPanelEl) {
      this.devToggleEl.addEventListener("click", () => this.toggleDevPanel());
    }
    if (this.devCloseEl && this.devPanelEl) {
      this.devCloseEl.addEventListener("click", () => this.toggleDevPanel());
    }
    if (this.devGiveAllEl) {
      this.devGiveAllEl.addEventListener("click", () => this.handleDevGiveAllCards());
    }
    if (this.devMaxStatsEl) {
      this.devMaxStatsEl.addEventListener("click", () => this.handleDevMaxStats());
    }

    if (this.devCardListEl) {
      this.devCardListEl.innerHTML = "";
      const cards = getUpgradeCardDefs();
      for (const card of cards) {
        const li = document.createElement("li");
        li.className = "dev-card-row";

        const main = document.createElement("div");
        main.className = "dev-card-row-main";

        const nameEl = document.createElement("div");
        nameEl.className = "dev-card-row-name";
        nameEl.textContent = card.name;

        const descEl = document.createElement("div");
        descEl.className = "dev-card-row-desc";
        descEl.textContent = card.description || "";

        main.appendChild(nameEl);
        main.appendChild(descEl);

        const btn = document.createElement("button");
        btn.textContent = "Spawn";
        btn.addEventListener("click", () => this.spawnUpgradeCardToInventory(card));

        li.appendChild(main);
        li.appendChild(btn);

        this.devCardListEl.appendChild(li);
      }
    }
  }

  toggleDevPanel() {
    if (!this.devPanelEl) return;
    const hidden = this.devPanelEl.classList.contains("dev-panel-hidden");
    if (hidden) {
      this.devPanelEl.classList.remove("dev-panel-hidden");
    } else {
      this.devPanelEl.classList.add("dev-panel-hidden");
    }
  }

  restartGame() {
    window.location.reload();
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = this.paused ? "▶ Resume" : "⏸ Pause";
      this.pauseToggleEl.classList.toggle("paused", this.paused);
    }
  }

  showGameOver() {
    this.gameOver = true;
    if (this.gameOverEl) this.gameOverEl.classList.remove("hidden");
  }

  showVictory() {
    this.gameOver = true;
    const el = document.getElementById("victory-overlay");
    if (el) {
      el.classList.remove("hidden");
      this.populateVictorySummary();
    }
  }

  populateVictorySummary() {
    const equippedEl = document.getElementById("victory-equipped");
    const cardsEl = document.getElementById("victory-cards");
    const statsEl = document.getElementById("victory-stats");
    if (equippedEl) {
      equippedEl.innerHTML = "";
      for (const [slot, item] of Object.entries(this.equipment)) {
        const div = document.createElement("div");
        div.textContent = `${slot}: ${item ? item.name : "None"}`;
        equippedEl.appendChild(div);
      }
    }
    if (cardsEl) {
      cardsEl.innerHTML = "";
      for (const card of this.activeUpgradeCards) {
        const div = document.createElement("div");
        div.textContent = card.name;
        cardsEl.appendChild(div);
      }
    }
    if (statsEl) {
      statsEl.innerHTML = "";
      const rows = [
        ["Level", `${this.level}`],
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
  }

  saveCharacterAndReturnToMenu() {
    const nameInput = document.getElementById("victory-char-name");
    const name = (nameInput && nameInput.value.trim()) || "Champion";
    const saveData = {
      name,
      level: this.level,
      equipment: JSON.parse(JSON.stringify(this.equipment)),
      activeUpgradeCards: JSON.parse(JSON.stringify(this.activeUpgradeCards)),
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      stats: { ...this.currentStats },
      savedAt: Date.now()
    };
    const saved = loadSavedCharacters();
    saved.push(saveData);
    localStorage.setItem("spaceShooter_characters", JSON.stringify(saved));

    document.getElementById("victory-overlay").classList.add("hidden");
    document.getElementById("main-menu").classList.remove("hidden");
    document.querySelector(".game-root").classList.add("hidden");
    document.getElementById("pause-toggle").classList.add("hidden");
    document.getElementById("dev-toggle").classList.add("hidden");
    renderHallOfChampions();
  }

  update(dt) {
    if (this.gameOver) return;
    if (this.levelUpChoices) return;

    this.time += dt;
    this.timeSinceLastHit += dt;

    // Lucky: increase global luck as long as you avoid damage
    if (this.hasUpgradeCard("lucky")) {
      const t = Math.min(this.timeSinceLastHit, 30);
      GLOBAL_LUCK = 0.1 + (t / 30) * 0.4;
    } else {
      GLOBAL_LUCK = 0;
    }

    // Speed calculation — gear stats + card modifiers
    let effectiveSpeed = this.currentStats.speed;
    if (this.hasUpgradeCard("swiftFeet") && this.swiftFeetTimer > 0) {
      this.swiftFeetTimer -= dt;
      if (this.swiftFeetTimer < 0) this.swiftFeetTimer = 0;
      effectiveSpeed *= 1.5;
    }
    if (this.hasUpgradeCard("berserker")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      effectiveSpeed *= 1 + (1 - ratio) * 0.5;
    }
    this.player.speed = effectiveSpeed;

    this.player.update(dt, this.input, this.world);

    if (this.hasUpgradeCard("magnet")) this.applyMagnetEffect(dt);

    this.lootSystem.update(dt, this.player, (item) => this.handleLootPickup(item));
    this.updateUpgradeCardEffects(dt);
    this.updateCombat(dt);

    if (this.exitTransitionCooldown > 0) this.exitTransitionCooldown -= dt;
    this.checkExits();

    this.updateBossHealthBar();
    this.camera.follow(this.player, this.world.width, this.world.height);
  }

  updateBossHealthBar() {
    const boss = this.enemySystem.boss;
    if (!this.bossHealthBarEl) return;
    if (!boss) {
      this.bossHealthBarEl.classList.add("hidden");
      return;
    }
    this.bossHealthBarEl.classList.remove("hidden");
    const pct = Math.max(0, boss.health / boss.maxHealth);
    if (this.bossHealthFillEl) {
      this.bossHealthFillEl.style.width = `${Math.round(pct * 100)}%`;
      this.bossHealthFillEl.style.backgroundColor = pct > 0.5 ? "#dc2626" : pct > 0.25 ? "#f59e0b" : "#ef4444";
    }
    if (this.bossHealthLabelEl) {
      this.bossHealthLabelEl.textContent = `${boss.name}: ${Math.round(boss.health)} / ${boss.maxHealth}${boss.phase2 ? " (ENRAGED)" : ""}`;
    }
  }

  playerInExit(exit) {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    return (
      px >= exit.x && px <= exit.x + exit.w &&
      py >= exit.y && py <= exit.y + exit.h
    );
  }

  checkExits() {
    if (this.exitTransitionCooldown > 0 || !this.currentMap.exits) return;
    for (const exit of this.currentMap.exits) {
      if (this.playerInExit(exit)) {
        this.transitionToMap(exit.targetMapId, exit.spawnSide);
        this.exitTransitionCooldown = 0.6;
        break;
      }
    }
  }

  transitionToMap(targetMapId, spawnSide) {
    const targetMap = MAP_DEFS.find((m) => m.id === targetMapId);
    if (!targetMap) return;

    this.currentMapId = targetMapId;
    this.currentMap = targetMap;
    this.world.setTheme(targetMap);

    this.lootSystem.items = [];
    this.lootSystem.setMapLootQuality(targetMap.lootQuality);

    this.enemySystem.enemies = [];
    this.enemySystem.boss = null;
    this.enemySystem.projectiles = [];
    this.enemySystem.respawnQueue = [];
    this.enemySystem.setMap(targetMap);
    this.enemySystem.spawnInitial();

    const margin = this.world.wallThickness + 60;
    const centerY = this.world.height / 2 - this.player.size / 2;

    if (spawnSide === "left") {
      this.player.position.set(margin, centerY);
    } else if (spawnSide === "right") {
      this.player.position.set(this.world.width - margin - this.player.size, centerY);
    } else {
      this.player.position.set(this.world.width / 2 - this.player.size / 2, centerY);
    }

    this.updateMapUI();
  }

  updateMapUI() {
    if (!this.mapNameEl) return;
    this.mapNameEl.textContent = `${this.currentMap.name} (Map ${this.currentMap.number})`;
  }

  updateXpUI() {
    const threshold = getXpForLevel(this.level + 1);
    const prevThreshold = getXpForLevel(this.level);
    const xpInLevel = this.xp - prevThreshold;
    const xpNeeded = threshold - prevThreshold;
    const pct = this.level >= 99 ? 1 : xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 0;

    if (this.xpBarFillEl) this.xpBarFillEl.style.width = `${Math.round(pct * 100)}%`;
    if (this.xpLabelEl) this.xpLabelEl.textContent = this.level >= 99 ? "MAX" : `${Math.floor(xpInLevel)} / ${Math.floor(xpNeeded)} XP`;
    if (this.playerLevelEl) this.playerLevelEl.textContent = `Level ${this.level}`;
  }

  grantXP(amount) {
    this.xp += amount;
    this.updateXpUI();
    this.checkLevelUp();
  }

  checkLevelUp() {
    if (this.levelUpChoices) return;
    const nextThreshold = getXpForLevel(this.level + 1);
    if (this.xp >= nextThreshold) {
      this.level++;
      this.showLevelUpChoices();
    }
  }

  showLevelUpChoices() {
    const shuffled = [...LEVEL_UP_BONUSES].sort(() => Math.random() - 0.5);
    this.levelUpChoices = shuffled.slice(0, 3);

    const overlay = document.getElementById("level-up-overlay");
    const choicesEl = document.getElementById("level-up-choices");
    if (!overlay || !choicesEl) return;

    choicesEl.innerHTML = "";
    for (const bonus of this.levelUpChoices) {
      const btn = document.createElement("button");
      btn.className = "level-up-choice-btn";
      btn.textContent = bonus.label;
      btn.addEventListener("click", () => this.applyLevelUpChoice(bonus));
      choicesEl.appendChild(btn);
    }
    overlay.classList.remove("hidden");
    this.paused = true;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "▶ Resume";
      this.pauseToggleEl.classList.add("paused");
    }
  }

  applyLevelUpChoice(bonus) {
    bonus.apply(this);
    this.levelUpChoices = null;

    const overlay = document.getElementById("level-up-overlay");
    if (overlay) overlay.classList.add("hidden");

    this.paused = false;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "⏸ Pause";
      this.pauseToggleEl.classList.remove("paused");
    }

    this.recalculateStats();
    this.updateXpUI();
    this.updateUpgradeCardsUI();
    this.checkLevelUp();
  }

  updateCombat(dt) {
    const player = this.player;

    // Player attack cooldown
    if (this.playerAttackTimer > 0) this.playerAttackTimer -= dt;

    // Level attack speed + Berserker
    let effectiveCooldown = this.playerAttackCooldown / (this.levelAttackSpeedMult || 1);
    if (this.hasUpgradeCard("berserker")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      effectiveCooldown *= Math.max(0.4, ratio);
    }

    const es = this.enemySystem;

    // -------- Boss logic (includes minions) --------
    if (es.boss) {
      const minionSurviving = [];
      for (const enemy of es.enemies) {
        enemy.update(dt, player);
        if (enemy.intersects(player)) {
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.attackCooldown;
            this.onPlayerDamaged(enemy.attack);
          }
        }
        const dist = enemy.distanceTo(player);
        if (dist <= this.playerAttackRange && this.playerAttackTimer <= 0) {
          this.playerAttackTimer = effectiveCooldown;
          enemy.takeDamage(Math.round(this.computePlayerDamage()));
        }
        if (enemy.intersects(player) && this.hasUpgradeCard("thorns")) {
          const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
          enemy.takeDamage(thornsDmg);
        }
        if (enemy.isDead) {
          this.dropLootFromEnemy(enemy);
        } else {
          minionSurviving.push(enemy);
        }
      }
      es.enemies = minionSurviving;
      this.updateBoss(dt, effectiveCooldown);
      this.updateProjectiles(dt);
      return;
    }

    // -------- Regular enemies --------
    const surviving = [];
    for (const enemy of es.enemies) {
      enemy.update(dt, player);

      if (enemy.intersects(player)) {
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackCooldown;
          this.onPlayerDamaged(enemy.attack);
        }
      }

      const dist = enemy.distanceTo(player);
      if (dist <= this.playerAttackRange && this.playerAttackTimer <= 0) {
        this.playerAttackTimer = effectiveCooldown;
        let dmg = this.computePlayerDamage();
        enemy.takeDamage(Math.round(dmg));
      }

      if (enemy.intersects(player) && this.hasUpgradeCard("thorns")) {
        const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
        enemy.takeDamage(thornsDmg);
      }

      if (enemy.isDead) {
        this.dropLootFromEnemy(enemy);
        es.queueRespawn(6);
      } else {
        surviving.push(enemy);
      }
    }

    es.enemies = surviving;
    es.update(dt);
  }

  computePlayerDamage() {
    let dmg = this.currentStats.attack;
    if (this.hasUpgradeCard("doubleStrike")) {
      this.doubleStrikeCounter++;
      if (this.doubleStrikeCounter >= 5) {
        this.doubleStrikeCounter = 0;
        dmg *= 2;
      }
    }
    if (this.hasUpgradeCard("berserker")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      dmg *= 1 + (1 - ratio) * 0.5;
    }
    return dmg;
  }

  updateBoss(dt, effectiveCooldown) {
    const boss = this.enemySystem.boss;
    const player = this.player;
    const es = this.enemySystem;

    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const bx = boss.position.x + boss.size / 2;
    const by = boss.position.y + boss.size / 2;
    const dx = px - bx;
    const dy = py - by;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (boss.hitFlashTimer > 0) boss.hitFlashTimer -= dt;

    // Charge attack
    if (boss.chargeActive) {
      boss.position.x += boss.chargeDir.x * boss.chargeSpeed * dt;
      boss.position.y += boss.chargeDir.y * boss.chargeSpeed * dt;
      const margin = this.world.wallThickness;
      boss.position.x = Math.max(margin, Math.min(boss.position.x, this.world.width - margin - boss.size));
      boss.position.y = Math.max(margin, Math.min(boss.position.y, this.world.height - margin - boss.size));
      boss.chargeTimer -= dt;
      if (boss.chargeTimer <= 0) boss.chargeActive = false;
      if (boss.intersects(player)) {
        this.onPlayerDamaged(boss.attack * 1.5);
        boss.chargeActive = false;
      }
    } else {
      boss.chargeCooldown -= dt;
      boss.projectileTimer -= dt;
      boss.minionTimer -= dt;
      boss.attackTimer -= dt;

      if (boss.chargeCooldown <= 0) {
        boss.chargeCooldown = boss.phase2 ? 2.8 : 4;
        boss.chargeActive = true;
        boss.chargeTimer = 0.6;
        boss.chargeDir.set(dx / dist, dy / dist);
      } else if (boss.projectileTimer <= 0) {
        boss.projectileTimer = boss.projectileCooldown;
        const projCount = boss.phase2 ? 3 : 2;
        for (let i = 0; i < projCount; i++) {
          const angle = Math.atan2(dy, dx) + (i - (projCount - 1) / 2) * 0.4;
          const speed = 280;
          const proj = new Projectile(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed, 12, 14, "#dc2626");
          es.projectiles.push(proj);
        }
      } else if (boss.minionTimer <= 0) {
        boss.minionTimer = boss.minionCooldown;
        es.spawnMinion();
        if (boss.phase2) es.spawnMinion();
      } else {
        const moveSpeed = boss.speed * dt;
        boss.position.x += (dx / dist) * moveSpeed;
        boss.position.y += (dy / dist) * moveSpeed;
        const margin = this.world.wallThickness;
        boss.position.x = Math.max(margin, Math.min(boss.position.x, this.world.width - margin - boss.size));
        boss.position.y = Math.max(margin, Math.min(boss.position.y, this.world.height - margin - boss.size));

        if (boss.intersects(player) && boss.attackTimer <= 0) {
          boss.attackTimer = boss.attackCooldown;
          this.onPlayerDamaged(boss.attack);
        }
      }
    }

    // Player attacks boss
    if (boss.distanceTo(player) <= this.playerAttackRange && this.playerAttackTimer <= 0) {
      this.playerAttackTimer = effectiveCooldown;
      boss.takeDamage(Math.round(this.computePlayerDamage()));
    }
    if (boss.intersects(player) && this.hasUpgradeCard("thorns")) {
      const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
      boss.takeDamage(thornsDmg);
    }

    if (boss.isDead) {
      this.grantXP(BOSS_XP);
      const bx = boss.position.x + boss.size / 2;
      const by = boss.position.y + boss.size / 2;
      const count = 3 + Math.floor(Math.random() * 2);
      this.lootSystem.spawnBurstAt(bx, by, count, 0.6);
      es.boss = null;
      this.showVictory();
    }
  }

  grantXPFromEnemy(enemy) {
    const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
    if (!baseType) return;
    const minXp = baseType.minXp ?? 10;
    const maxXp = baseType.maxXp ?? 20;
    const xp = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));
    this.grantXP(xp);
  }

  dropLootFromEnemy(enemy) {
    this.grantXPFromEnemy(enemy);
    const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
    if (!baseType) return;
    let chance = baseType.dropChance || 0.3;
    if (this.hasUpgradeCard("scavenger")) chance = Math.min(1, chance * 1.5);
    if (Math.random() >= chance) return;

    const minDrop = baseType.minDrop ?? 1;
    const maxDrop = baseType.maxDrop ?? 1;
    const count = minDrop + Math.floor(Math.random() * (maxDrop - minDrop + 1));
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    this.lootSystem.spawnBurstAt(ex, ey, count, 0);
  }

  updateProjectiles(dt) {
    const es = this.enemySystem;
    const surviving = [];
    for (const p of es.projectiles) {
      p.update(dt);
      if (p.intersects(this.player)) {
        this.onPlayerDamaged(p.damage);
      } else {
        const margin = -20;
        if (p.position.x >= margin && p.position.x <= this.world.width - margin &&
            p.position.y >= margin && p.position.y <= this.world.height - margin) {
          surviving.push(p);
        }
      }
    }
    es.projectiles = surviving;
  }

  onPlayerDamaged(rawAmount) {
    if (this.gameOver) return;

    // Ghost Step: invulnerability window
    if (this.hasUpgradeCard("ghostStep") && this.ghostStepTimer > 0) return;

    // Iron Skin: absorbs one hit
    if (this.hasUpgradeCard("ironSkin") && this.ironSkinShieldReady) {
      this.ironSkinShieldReady = false;
      return;
    }

    const effectiveDamage = Math.max(0, rawAmount - this.currentStats.defense);
    if (effectiveDamage <= 0) return;

    this.currentHealth -= effectiveDamage;
    this.timeSinceLastHit = 0;

    if (this.hasUpgradeCard("ghostStep")) {
      this.ghostStepTimer = 1.5;
    }

    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this.showGameOver();
    }

    this.updateStatsUI();
    this.updateHealthBar();
  }

  applyMagnetEffect(dt) {
    const radius = 160;
    const pullSpeed = 260;

    for (const item of this.lootSystem.items) {
      if (item.burstFrom && item.burstProgress < 1) continue;
      const pos = item.displayPosition;
      const dx = this.player.position.x - pos.x;
      const dy = this.player.position.y - pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        const dist = Math.sqrt(distSq) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        item.position.x += nx * pullSpeed * dt;
        item.position.y += ny * pullSpeed * dt;
      }
    }
  }

  updateUpgradeCardEffects(dt) {
    if (this.hasUpgradeCard("ironSkin")) {
      this.ironSkinTimer += dt;
      if (this.ironSkinTimer >= 10 && !this.ironSkinShieldReady) {
        this.ironSkinShieldReady = true;
        this.ironSkinTimer = 0;
      }
    } else {
      this.ironSkinTimer = 0;
      this.ironSkinShieldReady = false;
    }

    if (this.hasUpgradeCard("ghostStep")) {
      if (this.ghostStepTimer > 0) {
        this.ghostStepTimer -= dt;
        if (this.ghostStepTimer < 0) this.ghostStepTimer = 0;
      }
    } else {
      this.ghostStepTimer = 0;
    }
  }

  render() {
    const { ctx, canvas } = this;
    ctx.save();

    const scaleX = canvas.width / this.viewWidth;
    const scaleY = canvas.height / this.viewHeight;
    const scale = Math.min(scaleX, scaleY);
    ctx.scale(scale, scale);

    this.world.draw(ctx, this.camera);
    this.lootSystem.draw(ctx, this.camera, this.time);
    this.enemySystem.draw(ctx, this.camera);
    this.player.draw(ctx, this.camera);

    // Paused overlay drawn on the canvas
    if (this.paused) {
      ctx.fillStyle = "rgba(5, 6, 10, 0.55)";
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      ctx.fillStyle = "#f5f7ff";
      ctx.font = "bold 36px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", this.viewWidth / 2, this.viewHeight / 2);
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("Press  Esc / P  or click Resume", this.viewWidth / 2, this.viewHeight / 2 + 44);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    // Draw attack range ring when close to an enemy (subtle feedback)
    const nearEnemy = this.enemySystem.enemies.some(
      (e) => e.distanceTo(this.player) <= this.playerAttackRange
    );
    if (nearEnemy) {
      const px = Math.floor(this.player.position.x + this.player.size / 2 - this.camera.position.x);
      const py = Math.floor(this.player.position.y + this.player.size / 2 - this.camera.position.y);
      ctx.strokeStyle = "rgba(250, 204, 21, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, this.playerAttackRange, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  handleLootPickup(lootItem) {
    const newItem = {
      id: lootItem.id,
      name: lootItem.name,
      type: lootItem.type,
      stats: lootItem.stats || {},
      cardKey: lootItem.cardKey || null,
      description: lootItem.description || ""
    };

    this.inventory.push(newItem);

    if (this.hasUpgradeCard("swiftFeet")) {
      this.swiftFeetTimer = 2.0;
    }
    if (this.hasUpgradeCard("vampiric")) {
      this.healPlayer(5);
    }

    this.updateInventoryUI();
  }

  healPlayer(amount) {
    this.currentHealth = Math.min(
      this.currentHealth + amount,
      this.currentStats.maxHealth
    );
    this.updateStatsUI();
    this.updateHealthBar();
  }

  updateHealthBar() {
    const bar = document.getElementById("player-health-fill");
    const label = document.getElementById("player-health-label");
    if (!bar || !label) return;
    const pct = this.currentStats.maxHealth > 0
      ? Math.max(0, this.currentHealth / this.currentStats.maxHealth)
      : 0;
    bar.style.width = `${Math.round(pct * 100)}%`;
    label.textContent = `${Math.round(this.currentHealth)} / ${this.currentStats.maxHealth}`;
    bar.style.backgroundColor =
      pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
  }

  hasUpgradeCard(key) {
    return this.activeUpgradeCards.some((card) => card.cardKey === key);
  }

  // ---- Inventory & equipment UI ----

  updateInventoryUI() {
    if (!this.inventoryListEl) return;
    this.inventoryListEl.innerHTML = "";

    if (this.inventory.length === 0) {
      const li = document.createElement("li");
      li.className = "inventory-empty";
      li.textContent = "No items collected";
      this.inventoryListEl.appendChild(li);
      return;
    }

    for (const item of this.inventory) {
      const li = document.createElement("li");
      li.className = "inventory-item";

      const equippable = this.isItemEquippable(item) || this.isUpgradeCard(item);
      if (!equippable) li.classList.add("inventory-item--non-equippable");

      const nameSpan = document.createElement("span");
      nameSpan.className = "inventory-item-name";
      nameSpan.textContent = item.name;

      const typeSpan = document.createElement("span");
      typeSpan.className = "inventory-item-type";
      typeSpan.textContent = item.type;

      li.appendChild(nameSpan);
      li.appendChild(typeSpan);

      if (equippable) {
        li.title =
          item.type === "Upgrade Card"
            ? "Click to equip upgrade card"
            : "Click to equip";
      }

      li.addEventListener("click", () => this.handleInventoryItemClick(item));
      this.inventoryListEl.appendChild(li);
    }
  }

  isItemEquippable(item) {
    return (
      item.type === "Helmet" ||
      item.type === "Boots" ||
      item.type === "Body Armour" ||
      item.type === "Weapon"
    );
  }

  isUpgradeCard(item) {
    return item.type === "Upgrade Card" && !!item.cardKey;
  }

  handleInventoryItemClick(item) {
    const index = this.inventory.indexOf(item);
    if (index === -1) return;

    if (this.isUpgradeCard(item)) {
      this.equipUpgradeCardAtIndex(index);
    } else if (this.isItemEquippable(item)) {
      const slot = item.type;
      const currentlyEquipped = this.equipment[slot];
      if (currentlyEquipped) this.inventory.push(currentlyEquipped);
      this.equipment[slot] = item;
      this.inventory.splice(index, 1);
      this.updateInventoryUI();
      this.updateEquippedUI();
      this.recalculateStats();
    }
  }

  equipUpgradeCardAtIndex(index) {
    const item = this.inventory[index];
    if (!item || !this.isUpgradeCard(item)) return;

    if (this.activeUpgradeCards.length >= this.maxUpgradeCards) {
      const removed = this.activeUpgradeCards.shift();
      if (removed) this.inventory.push(removed);
    }

    this.activeUpgradeCards.push(item);
    this.inventory.splice(index, 1);

    this.updateInventoryUI();
    this.updateUpgradeCardsUI();
    this.recalculateStats();
  }

  updateEquippedUI() {
    if (!this.equippedListEl) return;
    this.equippedListEl.innerHTML = "";

    const slots = ["Helmet", "Body Armour", "Weapon", "Boots"];
    for (const slot of slots) {
      const li = document.createElement("li");
      li.className = "equipped-item";

      const slotLabel = document.createElement("div");
      slotLabel.className = "equipped-slot-label";
      slotLabel.textContent = slot;

      const nameDiv = document.createElement("div");
      nameDiv.className = "equipped-item-name";
      const item = this.equipment[slot];
      nameDiv.textContent = item ? item.name : "None";

      li.appendChild(slotLabel);
      li.appendChild(nameDiv);
      this.equippedListEl.appendChild(li);
    }
  }

  recalculateStats() {
    const stats = { ...this.baseStats };
    for (const slot of Object.keys(this.equipment)) {
      const item = this.equipment[slot];
      if (!item || !item.stats) continue;
      for (const [k, v] of Object.entries(item.stats)) {
        stats[k] = (stats[k] || 0) + v;
      }
    }
    stats.maxHealth = Math.round(stats.maxHealth * (this.levelHealthMult || 1));
    stats.speed = Math.round(stats.speed * (this.levelSpeedMult || 1));
    stats.attack = Math.round(stats.attack * (this.levelAttackMult || 1));
    this.currentStats = stats;
    this.currentHealth = Math.min(this.currentHealth, stats.maxHealth);
    this.updateStatsUI();
    this.updateHealthBar();
  }

  updateUpgradeCardsUI() {
    if (!this.upgradeCardListEl) return;
    this.upgradeCardListEl.innerHTML = "";

    if (this.activeUpgradeCards.length === 0) {
      const li = document.createElement("li");
      li.className = "inventory-empty";
      li.textContent = "No upgrade cards equipped";
      this.upgradeCardListEl.appendChild(li);
      return;
    }

    for (const card of this.activeUpgradeCards) {
      const li = document.createElement("li");
      li.className = "upgrade-card-item";

      const nameEl = document.createElement("div");
      nameEl.className = "upgrade-card-name";
      nameEl.textContent = card.name;

      const descEl = document.createElement("div");
      descEl.className = "upgrade-card-desc";
      descEl.textContent = card.description || "";

      li.appendChild(nameEl);
      li.appendChild(descEl);
      this.upgradeCardListEl.appendChild(li);
    }
  }

  updateStatsUI() {
    if (!this.playerStatsEl) return;
    const stats = this.currentStats;
    this.playerStatsEl.innerHTML = "";

    const rows = [
      ["Health", `${Math.round(this.currentHealth)}/${stats.maxHealth}`],
      ["Defense", `${stats.defense}`],
      ["Speed", `${Math.round(stats.speed)}`],
      ["Attack", `${stats.attack}`]
    ];

    for (const [label, value] of rows) {
      const labelEl = document.createElement("div");
      labelEl.className = "player-stat-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("div");
      valueEl.className = "player-stat-value";
      valueEl.textContent = value;

      this.playerStatsEl.appendChild(labelEl);
      this.playerStatsEl.appendChild(valueEl);
    }
  }

  // ---- Dev helpers ----

  spawnUpgradeCardToInventory(cardDef) {
    if (!cardDef || !cardDef.cardKey) return;
    const id = this.lootSystem ? this.lootSystem.nextId++ : Date.now();
    const newItem = {
      id,
      name: cardDef.name,
      type: "Upgrade Card",
      stats: {},
      cardKey: cardDef.cardKey,
      description: cardDef.description || ""
    };
    this.inventory.push(newItem);
    this.updateInventoryUI();
  }

  handleDevGiveAllCards() {
    const cards = getUpgradeCardDefs();
    for (const def of cards) {
      this.spawnUpgradeCardToInventory(def);
    }
  }

  handleDevMaxStats() {
    this.baseStats = {
      maxHealth: 999,
      defense: 50,
      speed: 480,
      attack: 120
    };
    this.currentHealth = this.baseStats.maxHealth;
    this.recalculateStats();
  }
}

// -------- Save system & main menu --------

const SAVE_KEY = "spaceShooter_characters";

function loadSavedCharacters() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderHallOfChampions() {
  const container = document.getElementById("hall-of-champions");
  if (!container) return;
  const saved = loadSavedCharacters();
  container.innerHTML = "";
  if (saved.length === 0) {
    const p = document.createElement("p");
    p.className = "hall-empty";
    p.textContent = "No champions yet. Defeat the boss to save your character!";
    container.appendChild(p);
    return;
  }
  for (let i = 0; i < saved.length; i++) {
    const char = saved[i];
    const card = document.createElement("div");
    card.className = "champion-card";
    const stats = char.stats || {};
    const level = char.level || 1;
    card.innerHTML = `
      <div class="champion-card-content">
        <div class="champion-name">${escapeHtml(char.name)} <span class="champion-level">Lv.${level}</span></div>
        <div class="champion-stats">HP: ${stats.maxHealth || "?"} | Def: ${stats.defense || 0} | Spd: ${stats.speed || "?"} | Atk: ${stats.attack || "?"}</div>
        <div class="champion-equipment">
          ${formatEquipment(char.equipment)}
        </div>
        <div class="champion-cards">
          ${formatCards(char.activeUpgradeCards)}
        </div>
      </div>
      <button class="champion-delete-btn" aria-label="Delete character">Delete</button>
    `;
    const deleteBtn = card.querySelector(".champion-delete-btn");
    deleteBtn.addEventListener("click", () => deleteCharacter(i));
    container.appendChild(card);
  }
}

function deleteCharacter(index) {
  if (!confirm("Are you sure you want to delete this character? This cannot be undone.")) return;
  const saved = loadSavedCharacters();
  saved.splice(index, 1);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  renderHallOfChampions();
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatEquipment(equipment) {
  if (!equipment) return "—";
  const parts = [];
  for (const [slot, item] of Object.entries(equipment)) {
    parts.push(`${slot}: ${item ? item.name : "None"}`);
  }
  return parts.join(" · ");
}

function formatCards(cards) {
  if (!cards || cards.length === 0) return "No cards";
  return cards.map((c) => c.name).join(", ");
}

function bootstrap() {
  const mainMenu = document.getElementById("main-menu");
  const gameRoot = document.querySelector(".game-root");

  if (mainMenu && gameRoot) {
    mainMenu.classList.remove("hidden");
    gameRoot.classList.add("hidden");
    const pauseBtn = document.getElementById("pause-toggle");
    const devBtn = document.getElementById("dev-toggle");
    if (pauseBtn) pauseBtn.classList.add("hidden");
    if (devBtn) devBtn.classList.add("hidden");
    const bossBar = document.getElementById("boss-health-bar");
    if (bossBar) bossBar.classList.add("hidden");
    renderHallOfChampions();

    const newGameBtn = document.getElementById("main-menu-new-game");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", () => {
        mainMenu.classList.add("hidden");
        gameRoot.classList.remove("hidden");
        document.getElementById("pause-toggle").classList.remove("hidden");
        if (document.getElementById("dev-toggle")) document.getElementById("dev-toggle").classList.remove("hidden");
        startGame();
      });
    }
  } else {
    startGame();
  }
}

function startGame() {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Game canvas not found");
    return;
  }
  canvas.width = 800;
  canvas.height = 600;
  new Game(canvas);
}

window.addEventListener("DOMContentLoaded", bootstrap);

