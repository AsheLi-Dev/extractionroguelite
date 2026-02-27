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
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
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

// -------- Difficulty & Run Conditions --------

const DIFFICULTY_CONDITION_COUNTS = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 8, 6: 10 };
const LP_PER_DIFFICULTY = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 10 };
const DIFFICULTY_STAT_MULTIPLIER = { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.4, 5: 1.6, 6: 1.8 };

const LEGACY_POINTS_KEY = "spaceShooter_legacyPoints";
const TALENTS_KEY = "spaceShooter_talents";
const SKILL_UNLOCKS_KEY = "spaceShooter_skillUnlocks";

const SKILL_SLOT_UNLOCK = { 1: 0, 2: 1, 3: 3, 4: 5 };

const SPRING_CARD_IDS = ["homing", "glassCannon", "legacyBonus", "healthRegen"];

const EVENT_DEFS = [
  {
    id: "stranger",
    name: "The Stranger",
    desc: "A hooded figure emerges from the shadows. \"Please... I need to return home. Will you escort me to the Dungeon?\"",
    choices: [
      { id: "help", label: "Help them" },
      { id: "refuse", label: "Refuse" }
    ]
  },
  {
    id: "spring",
    name: "The Spring",
    desc: "A crystalline spring glows with otherworldly light. The waters seem to pulse with latent power.",
    choices: [
      { id: "drink", label: "Drink from the spring" },
      { id: "ignore", label: "Ignore it" }
    ]
  },
  {
    id: "merchant",
    name: "The Merchant",
    desc: "A well-dressed merchant approaches. \"Invest an item with me. I shall repay you handsomely... after you defeat the Tyrant.\"",
    choices: [
      { id: "invest", label: "Invest an item" },
      { id: "decline", label: "Decline" }
    ]
  },
  {
    id: "shrine",
    name: "The Shrine",
    desc: "An ancient shrine hums with forgotten magic. It offers a trade—or destruction.",
    choices: [
      { id: "offerXp", label: "Offer 30% XP for an upgrade card" },
      { id: "destroy", label: "Destroy all equipment, double LP reward" }
    ]
  },
  {
    id: "cursedChest",
    name: "The Cursed Chest",
    desc: "A chest radiates dark energy. Opening it may grant great power—or awaken something terrible.",
    choices: [
      { id: "open", label: "Open it" },
      { id: "leave", label: "Leave it" }
    ]
  },
  {
    id: "fiery",
    name: "The Fiery",
    desc: "A golden fiery materializes and darts across the room! Defeat it within 30 seconds to claim its treasures.",
    choices: []
  }
];

const SKILL_DEFS = [
  { id: "fireball", name: "Fireball", icon: "🔥", baseCd: 3, desc: "Slow projectile, explodes for area damage + burning ground 3s", unlock: "always" },
  { id: "iceShard", name: "Ice Shard", icon: "❄️", baseCd: 2, desc: "Fast piercing projectile, slows 30% for 2s", unlock: "always" },
  { id: "lightningBolt", name: "Lightning Bolt", icon: "⚡", baseCd: 2.5, desc: "Instant strike, chains to 1 enemy for 50%", unlock: "always" },
  { id: "rapidFire", name: "Rapid Fire", icon: "🔫", baseCd: 8, desc: "3 projectiles/sec at nearest enemy for 3s", unlock: "always" },
  { id: "shieldBash", name: "Shield Bash", icon: "🛡️", baseCd: 4, desc: "Cone knockback + stun 0.5s", unlock: "always" },
  { id: "healPulse", name: "Heal Pulse", icon: "💚", baseCd: 10, desc: "Restore 15% max health", unlock: "always" },
  { id: "iceRain", name: "Ice Rain", icon: "🌨️", baseCd: 12, desc: "Ice storm 4s, continuous damage, slow 50%", unlock: "scavengerFull" },
  { id: "lightningSpear", name: "Lightning Spear", icon: "🔱", baseCd: 8, desc: "Charge 0.5s, piercing spear, stun 1s", unlock: "diff3" },
  { id: "meteor", name: "Meteor", icon: "☄️", baseCd: 15, desc: "1s delay, massive area damage, burning 5s", unlock: "diff4" },
  { id: "voidRift", name: "Void Rift", icon: "🌀", baseCd: 14, desc: "Pull enemies 3s then explode", unlock: "diff5" },
  { id: "timeWarp", name: "Time Warp", icon: "⏱️", baseCd: 20, desc: "Slow enemies 50% for 4s", unlock: "mastermind" },
  { id: "phoenixStrike", name: "Phoenix Strike", icon: "🦅", baseCd: 25, desc: "Explosion + 3s invincibility", unlock: "secondWindUsed" },
  { id: "chainFrost", name: "Chain Frost", icon: "🧊", baseCd: 18, desc: "Freeze all enemies 2s", unlock: "iceShard5" },
  { id: "stormCall", name: "Storm Call", icon: "⛈️", baseCd: 20, desc: "Lightning storm 6s", unlock: "lightningOnlyRun" }
];

function getLegacyPoints() {
  try {
    const raw = localStorage.getItem(LEGACY_POINTS_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function addLegacyPoints(amount) {
  const current = getLegacyPoints();
  const next = current + amount;
  localStorage.setItem(LEGACY_POINTS_KEY, String(next));
  return next;
}

function getPurchasedTalents() {
  try {
    const raw = localStorage.getItem(TALENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function purchaseTalent(id, cost) {
  const purchased = getPurchasedTalents();
  if (purchased.includes(id)) return false;
  const lp = getLegacyPoints();
  if (lp < cost) return false;
  addLegacyPoints(-cost);
  purchased.push(id);
  localStorage.setItem(TALENTS_KEY, JSON.stringify(purchased));
  return true;
}

function hasTalent(id) {
  return getPurchasedTalents().includes(id);
}

function getSkillUnlocks() {
  try {
    const raw = localStorage.getItem(SKILL_UNLOCKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSkillUnlock(key, value = true) {
  const u = getSkillUnlocks();
  u[key] = value;
  localStorage.setItem(SKILL_UNLOCKS_KEY, JSON.stringify(u));
}

function getHighestCompletedDifficulty() {
  const u = getSkillUnlocks();
  let max = 0;
  for (let d = 1; d <= 6; d++) {
    if (u[`diff${d}`]) max = Math.max(max, d);
  }
  return max;
}

function markDifficultyCompleted(diff) {
  for (let d = 1; d <= diff; d++) {
    setSkillUnlock(`diff${d}`, true);
  }
}

function getAvailableSkillSlots() {
  const max = getHighestCompletedDifficulty();
  if (max >= 5) return 4;
  if (max >= 3) return 3;
  if (max >= 1) return 2;
  return 1;
}

function isSkillUnlocked(skillDef) {
  const u = getSkillUnlocks();
  if (skillDef.unlock === "always") return true;
  if (skillDef.unlock === "scavengerFull") {
    return ["luckyFind", "treasureHunter", "hoarder", "jackpot"].every((t) => hasTalent(t));
  }
  if (skillDef.unlock === "diff3") return !!u.diff3;
  if (skillDef.unlock === "diff4") return !!u.diff4;
  if (skillDef.unlock === "diff5") return !!u.diff5;
  if (skillDef.unlock === "mastermind") return hasTalent("mastermind");
  if (skillDef.unlock === "secondWindUsed") return !!u.secondWindUsed;
  if (skillDef.unlock === "iceShard5") return !!u.iceShard5;
  if (skillDef.unlock === "lightningOnlyRun") return !!u.lightningOnlyRun;
  return false;
}

function getUnlockedSkills() {
  return SKILL_DEFS.filter((s) => isSkillUnlocked(s));
}

const TALENT_TREE = {
  Warrior: [
    { id: "ironFist", cost: 1, name: "Iron Fist", desc: "+10% attack damage to all characters" },
    { id: "battleHardened", cost: 2, name: "Battle Hardened", desc: "10% chance for enemies to drop weapons" },
    { id: "executioner", cost: 3, name: "Executioner", desc: "+25% damage to enemies below 30% health" },
    { id: "warlord", cost: 4, name: "Warlord", desc: "Guaranteed high quality weapon from boss" }
  ],
  Survivalist: [
    { id: "thickSkin", cost: 1, name: "Thick Skin", desc: "+15 max health to all characters" },
    { id: "secondWind", cost: 2, name: "Second Wind", desc: "Survive one killing blow per run" },
    { id: "fortified", cost: 3, name: "Fortified", desc: "+20% equipment defense" },
    { id: "immortal", cost: 4, name: "Immortal", desc: "Regenerating shield at start of each map" }
  ],
  Scavenger: [
    { id: "luckyFind", cost: 1, name: "Lucky Find", desc: "Increases loot quality globally" },
    { id: "treasureHunter", cost: 2, name: "Treasure Hunter", desc: "Bonus loot chest every third map" },
    { id: "hoarder", cost: 3, name: "Hoarder", desc: "Legacy Vault: 3 → 5 starting items" },
    { id: "jackpot", cost: 4, name: "Jackpot", desc: "One extremely rare unique item per run" }
  ],
  Tinkerer: [
    { id: "cardCollector", cost: 1, name: "Card Collector", desc: "Free random upgrade card at start" },
    { id: "synergist", cost: 2, name: "Synergist", desc: "+10% all stats when 2+ cards equipped" },
    { id: "wildCard", cost: 3, name: "Wild Card", desc: "Free card reroll once per run" },
    { id: "mastermind", cost: 4, name: "Mastermind", desc: "Unlocks 4th upgrade card slot" }
  ],
  Pioneer: [
    { id: "veteran", cost: 2, name: "Veteran", desc: "+1 bonus LP for completing Difficulty 2+" },
    { id: "daredevil", cost: 2, name: "Daredevil", desc: "Conditions reroll twice per run" },
    { id: "conqueror", cost: 3, name: "Conqueror", desc: "Bonus rare item to Legacy Vault on Diff 4+ completion" },
    { id: "legend", cost: 5, name: "Legend", desc: "Unlocks Difficulty 6: 10 conditions, 10 LP reward" }
  ]
};

const RUN_CONDITIONS = [
  { id: "enemyHp", category: "enemy", icon: "❤️", name: "Hardened Foes", desc: "All enemies have 15% more health" },
  { id: "enemyDmg", category: "enemy", icon: "⚔️", name: "Brutal Strikes", desc: "All enemies deal 15% more damage" },
  { id: "enemySpeed", category: "enemy", icon: "💨", name: "Swift Enemies", desc: "All enemies move 20% faster" },
  { id: "enemyRegen", category: "enemy", icon: "🩹", name: "Regenerating Foes", desc: "Enemies regenerate health over time" },
  { id: "enemyResist", category: "enemy", icon: "🛡️", name: "Hit Resistance", desc: "Enemies take 20% less damage" },
  { id: "eliteSpawn", category: "enemy", icon: "👑", name: "Elite Invasion", desc: "Elite enemies spawn everywhere" },
  { id: "enemyExplode", category: "enemy", icon: "💥", name: "Death Explosions", desc: "Enemies explode on death" },
  { id: "bossHp", category: "enemy", icon: "🐉", name: "Titan Boss", desc: "Boss has 30% more health" },
  { id: "frozenGround", category: "env", icon: "❄️", name: "Frozen Floor", desc: "Ground slows player movement" },
  { id: "toxicGround", category: "env", icon: "☠️", name: "Toxic Ground", desc: "Ground deals damage over time" },
  { id: "burningGround", category: "env", icon: "🔥", name: "Burning Ground", desc: "Ground deals burst damage" },
  { id: "shockingGround", category: "env", icon: "⚡", name: "Shocking Ground", desc: "Ground can stun the player" },
  { id: "weakeningGround", category: "env", icon: "📉", name: "Weakening Ground", desc: "Ground reduces attack damage" },
  { id: "darkness", category: "env", icon: "🌑", name: "Darkness", desc: "Reduced vision radius" },
  { id: "startHealth", category: "player", icon: "💔", name: "Frail Start", desc: "Start with -30 max health" },
  { id: "startAttack", category: "player", icon: "📉", name: "Weakened Blows", desc: "Start with -20% attack damage" },
  { id: "startSpeed", category: "player", icon: "🐢", name: "Sluggish", desc: "Start with -20% movement speed" },
  { id: "vaultLocked", category: "player", icon: "🔒", name: "Vault Locked", desc: "Legacy vault unavailable this run" },
  { id: "fewerCards", category: "player", icon: "🃏", name: "Fewer Slots", desc: "One fewer upgrade card slot" },
  { id: "noHealthDrops", category: "player", icon: "🚫", name: "No Healing", desc: "No health drops from enemies" },
];

function pickRandomConditions(count) {
  const shuffled = [...RUN_CONDITIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, RUN_CONDITIONS.length));
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

// -------- Hazard patches (ground conditions) --------

const HAZARD_RADIUS = 95;
const HAZARD_POSITIONS = [
  [180, 200], [420, 180], [680, 220], [920, 350], [1100, 500],
  [250, 450], [500, 520], [750, 600], [950, 720], [400, 750],
  [600, 350], [300, 650], [850, 400], [150, 550], [1050, 200],
];

class HazardSystem {
  constructor(world, conditions) {
    this.world = world;
    this.conditions = conditions;
    this.patches = [];
    this.buildPatches();
  }

  addTemporaryPatch(type, x, y, radius, duration, damagePerTick = 0, affectsEnemies = false) {
    this.patches.push({
      type,
      x,
      y,
      radius,
      id: this.patches.length,
      temp: true,
      duration,
      elapsed: 0,
      damagePerTick,
      affectsEnemies,
      lastDamageTick: 0
    });
  }

  update(dt, game) {
    const surviving = [];
    for (const p of this.patches) {
      if (p.temp) {
        p.elapsed += dt;
        if (p.elapsed >= p.duration) continue;
        if (p.affectsEnemies && p.damagePerTick > 0 && game) {
          p.lastDamageTick = (p.lastDamageTick || 0) + dt;
          if (p.lastDamageTick >= 1) {
            p.lastDamageTick = 0;
            const hit = game.enemiesInRadius(p.x, p.y, p.radius);
            for (const e of hit) game.dealDamageToEnemy(e, p.damagePerTick);
          }
        }
      }
      surviving.push(p);
    }
    this.patches = surviving;
  }

  buildPatches() {
    const keepTemp = this.patches.filter((p) => p.temp);
    this.patches = keepTemp;
    const types = ["frozenGround", "toxicGround", "burningGround", "shockingGround", "weakeningGround"];
    const margin = this.world.wallThickness + HAZARD_RADIUS + 20;
    const w = this.world.width - margin * 2;
    const h = this.world.height - margin * 2;

    types.forEach((type, ti) => {
      if (!this.conditions.some((c) => c.id === type)) return;
      const count = 7;
      for (let i = 0; i < count; i++) {
        const idx = (ti * 17 + i * 11) % HAZARD_POSITIONS.length;
        const [px, py] = HAZARD_POSITIONS[idx];
        const x = Math.max(margin, Math.min(px, this.world.width - margin - 1));
        const y = Math.max(margin, Math.min(py, this.world.height - margin - 1));
        this.patches.push({ type, x, y, radius: HAZARD_RADIUS, id: this.patches.length });
      }
    });
  }

  playerInPatch(player) {
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    for (const p of this.patches) {
      const dx = px - p.x;
      const dy = py - p.y;
      if (dx * dx + dy * dy <= p.radius * p.radius) return p;
    }
    return null;
  }

  draw(ctx, camera, time) {
    const ox = -camera.position.x;
    const oy = -camera.position.y;

    for (const p of this.patches) {
      const sx = p.x + ox;
      const sy = p.y + oy;

      if (sx + p.radius < 0 || sx - p.radius > 800 || sy + p.radius < 0 || sy - p.radius > 600) continue;

      ctx.save();

      if (p.type === "frozenGround") {
        this.drawFrozen(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "toxicGround") {
        this.drawToxic(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "burningGround") {
        this.drawBurning(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "shockingGround") {
        this.drawShocking(ctx, sx, sy, p.radius, time, p.id);
      } else if (p.type === "weakeningGround") {
        this.drawWeakening(ctx, sx, sy, p.radius, time, p.id);
      }

      ctx.restore();
    }
  }

  drawFrozen(ctx, sx, sy, r, t, id) {
    const pulse = 0.5 + 0.15 * Math.sin(t * 2 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(147, 197, 253, ${0.25 * pulse})`);
    grad.addColorStop(0.5, `rgba(96, 165, 250, ${0.35 * pulse})`);
    grad.addColorStop(1, `rgba(59, 130, 246, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(191, 219, 254, ${0.5 + 0.2 * Math.sin(t * 3 + id)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + t * 0.5 + id * 0.3;
      const dist = r * (0.4 + 0.4 * Math.sin(t * 4 + i));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(224, 242, 254, ${0.6 + 0.3 * Math.sin(t * 5 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawToxic(ctx, sx, sy, r, t, id) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 4 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(34, 197, 94, ${0.4 * pulse})`);
    grad.addColorStop(0.6, `rgba(22, 163, 74, ${0.5 * pulse})`);
    grad.addColorStop(1, `rgba(22, 101, 52, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(74, 222, 128, ${0.4 + 0.3 * Math.sin(t * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2 + t * 2 + id * 0.2;
      const dist = r * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + i)));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist;
      const size = 5 + 3 * Math.sin(t * 5 + i);
      ctx.fillStyle = `rgba(134, 239, 172, ${0.5 + 0.4 * Math.sin(t * 4 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBurning(ctx, sx, sy, r, t, id) {
    const flicker = 0.7 + 0.3 * Math.sin(t * 12 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(251, 146, 60, ${0.5 * flicker})`);
    grad.addColorStop(0.4, `rgba(239, 68, 68, ${0.45 * flicker})`);
    grad.addColorStop(0.8, `rgba(185, 28, 28, ${0.3})`);
    grad.addColorStop(1, `rgba(127, 29, 29, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + t * 8 + id * 0.5;
      const dist = r * (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 7 + i * 1.3)));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist - 8 * Math.sin(t * 6 + i);
      const h = 8 + 6 * Math.sin(t * 10 + i);
      ctx.fillStyle = `rgba(253, 186, 116, ${0.8 * flicker})`;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x - 4, y - h / 2);
      ctx.lineTo(x, y - h / 2 + 2);
      ctx.lineTo(x + 4, y - h / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawShocking(ctx, sx, sy, r, t, id) {
    const flash = 0.5 + 0.5 * Math.sin(t * 15 + id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(253, 224, 71, ${0.35 * flash})`);
    grad.addColorStop(0.5, `rgba(250, 204, 21, ${0.25 * flash})`);
    grad.addColorStop(1, `rgba(234, 179, 8, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(254, 249, 195, ${0.6 * flash})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 4;
      const x1 = sx + Math.cos(angle) * r * 0.3;
      const y1 = sy + Math.sin(angle) * r * 0.3;
      const x2 = sx + Math.cos(angle) * r * (0.7 + 0.2 * Math.sin(t * 8 + i));
      const y2 = sy + Math.sin(angle) * r * (0.7 + 0.2 * Math.sin(t * 8 + i));
      ctx.strokeStyle = `rgba(254, 240, 138, ${0.8 * flash})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  drawWeakening(ctx, sx, sy, r, t, id) {
    const swirl = (t * 0.3 + id * 0.2) % (Math.PI * 2);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, `rgba(147, 51, 234, ${0.35 + 0.1 * Math.sin(t * 2)})`);
    grad.addColorStop(0.5, `rgba(126, 34, 206, ${0.4})`);
    grad.addColorStop(1, `rgba(88, 28, 135, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(167, 139, 250, ${0.4 + 0.2 * Math.sin(t * 3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + swirl;
      const dist = r * (0.4 + 0.4 * Math.sin(t + i));
      const x = sx + Math.cos(angle) * dist;
      const y = sy + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(192, 132, 252, ${0.5 + 0.2 * Math.sin(t * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
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

  update(dt, player, gameTime = 0, globalSlowMult = 1) {
    if (this.stunUntil != null && gameTime < this.stunUntil) {
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }
    let speedMult = globalSlowMult;
    if (this.slowUntil != null && gameTime < this.slowUntil) speedMult *= (this.slowMult ?? 0.7);
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const margin = 60;
    if (this.isFiery) {
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderDirection = this.wanderDirection || new Vec2(0, 0);
        this.wanderDirection.set(Math.random() - 0.5, Math.random() - 0.5);
        const len = Math.sqrt(this.wanderDirection.x ** 2 + this.wanderDirection.y ** 2) || 1;
        this.wanderDirection.x /= len;
        this.wanderDirection.y /= len;
        this.wanderTimer = 0.5 + Math.random() * 1;
      }
      let dx = this.wanderDirection.x;
      let dy = this.wanderDirection.y;
      this.position.x += dx * this.speed * speedMult * dt;
      this.position.y += dy * this.speed * speedMult * dt;
      this.position.x = Math.max(margin, Math.min(this.position.x, 1200 - margin - this.size));
      this.position.y = Math.max(margin, Math.min(this.position.y, 900 - margin - this.size));
    } else {
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.position.x += (dx / dist) * this.speed * speedMult * dt;
      this.position.y += (dy / dist) * this.speed * speedMult * dt;
    }

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

// -------- Player Projectile --------

const PLAYER_PROJECTILE_SPEED = 520;
const PLAYER_PROJECTILE_SIZE = 8;
const PLAYER_PROJECTILE_MAX_DIST = 1400;
const PLAYER_PROJECTILE_TRAIL_LEN = 6;

class PlayerProjectile {
  constructor(x, y, targetX, targetY, damage) {
    this.position = new Vec2(x, y);
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = PLAYER_PROJECTILE_SPEED;
    this.velocity = new Vec2((dx / dist) * speed, (dy / dist) * speed);
    this.damage = damage;
    this.size = PLAYER_PROJECTILE_SIZE;
    this.trail = [];
    this.distanceTraveled = 0;
  }

  update(dt, game = null) {
    this.trail.push({ x: this.position.x, y: this.position.y });
    if (this.trail.length > PLAYER_PROJECTILE_TRAIL_LEN) this.trail.shift();

    if (game && game.hasUpgradeCard && game.hasUpgradeCard("homing")) {
      const px = this.position.x + this.size / 2;
      const py = this.position.y + this.size / 2;
      const target = game.getNearestEnemy(px, py, 400);
      if (target) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - px;
        const dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = PLAYER_PROJECTILE_SPEED;
        this.velocity.x = (dx / dist) * speed * 0.15 + this.velocity.x * 0.85;
        this.velocity.y = (dy / dist) * speed * 0.15 + this.velocity.y * 0.85;
        const vlen = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || 1;
        this.velocity.x = (this.velocity.x / vlen) * speed;
        this.velocity.y = (this.velocity.y / vlen) * speed;
      }
    }

    const moveX = this.velocity.x * dt;
    const moveY = this.velocity.y * dt;
    this.position.x += moveX;
    this.position.y += moveY;
    this.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
  }

  isExpired() {
    return this.distanceTraveled >= PLAYER_PROJECTILE_MAX_DIST;
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
    const drawTrail = (x, y, alpha) => {
      const sx = Math.floor(x - camera.position.x);
      const sy = Math.floor(y - camera.position.y);
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = 0.15 + (i / this.trail.length) * 0.35;
      drawTrail(t.x, t.y, alpha);
    }
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    ctx.fillStyle = "#60c5ff";
    ctx.beginPath();
    ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a0e0ff";
    ctx.lineWidth = 1;
    ctx.stroke();
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

  randomPosition(size) {
    const margin = this.world.wallThickness + size + 40;
    const x = margin + Math.random() * (this.world.width - margin * 2);
    const y = margin + Math.random() * (this.world.height - margin * 2);
    return new Vec2(x, y);
  }

  spawnOne() {
    let base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    if (this.hasCond("eliteSpawn")) {
      const idx = ENEMY_TYPES.findIndex((e) => e.name === base.name);
      base = ENEMY_TYPES[Math.min(idx + 1, ENEMY_TYPES.length - 1)] || base;
    }
    const s = this.mapDef.enemyScale || { hp: 1, attack: 1, speed: 1 };
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack);
    let spd = Math.round(base.speed * s.speed);
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
    const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd };
    const pos = this.randomPosition(typeDef.size);
    const enemy = new Enemy(pos.x, pos.y, typeDef);
    if (this.hasCond("enemyRegen")) enemy.regenRate = 2;
    this.enemies.push(enemy);
  }

  spawnBoss() {
    const pos = this.randomPosition(BOSS_SIZE);
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

  spawnMinion() {
    const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const s = { hp: 0.8, attack: 0.9, speed: 1.1 };
    let hp = Math.round(base.maxHealth * this.diffMult * s.hp);
    let atk = Math.round(base.attack * this.diffMult * s.attack);
    let spd = Math.round(base.speed * s.speed);
    if (this.hasCond("enemyHp")) hp = Math.round(hp * 1.15);
    if (this.hasCond("enemyDmg")) atk = Math.round(atk * 1.15);
    if (this.hasCond("enemySpeed")) spd = Math.round(spd * 1.2);
    const typeDef = { ...base, maxHealth: hp, attack: atk, speed: spd };
    const pos = this.randomPosition(typeDef.size);
    const enemy = new Enemy(pos.x, pos.y, typeDef);
    if (this.hasCond("enemyRegen")) enemy.regenRate = 2;
    this.enemies.push(enemy);
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
      },
      { name: "Homing", cardKey: "homing", description: "Projectiles seek nearby enemies." },
      { name: "Glass Cannon", cardKey: "glassCannon", description: "+50% damage dealt, +30% damage taken." },
      { name: "Legacy Fortune", cardKey: "legacyBonus", description: "+2 LP after defeating the boss." },
      { name: "Vital Spring", cardKey: "healthRegen", description: "Regenerate 3% max health per second." }
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

  spawnGuaranteedWeaponAt(centerX, centerY) {
    const weaponGroup = LOOT_DEFS.find((g) => g.type === "Weapon");
    if (!weaponGroup) return;
    const best = weaponGroup.items[weaponGroup.items.length - 1];
    const def = { type: "Weapon", name: best.name, stats: best.stats };
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 30;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 30;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
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
  constructor(canvas, legacyItems = [], runConfig = {}) {
    this.runConfig = runConfig;
    this.difficulty = runConfig.difficulty ?? 1;
    this.conditions = runConfig.conditions ?? [];
    this.skills = runConfig.skills || [null, null, null, null];
    this.skillCooldowns = [0, 0, 0, 0];
    this.skillEffects = [];
    this.iceShardHitsThisRun = 0;
    this.damageSkillsUsedThisRun = new Set();
    this.phoenixInvulnUntil = 0;
    this.timeWarpUntil = 0;
    this.hasCondition = (id) => this.conditions.some((c) => c.id === id);

    this.eventsOccurredThisRun = new Set();
    this.escortQuest = null;
    this.pendingMerchantInvestment = null;
    this.lpMultiplier = 1;
    this.cursedChestBlocked = false;
    this.fierySpawned = false;
    this.fieryKilled = false;
    this.fieryTimer = 0;

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.lastTime = 0;
    this.time = 0;

    this.input = new Input();

    this.inventory = legacyItems.map((item, i) => ({
      id: 10000 + i,
      name: item.name,
      type: item.type,
      stats: item.stats || {},
      cardKey: item.cardKey || null,
      description: item.description || ""
    }));
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
    if (hasTalent("thickSkin")) this.baseStats.maxHealth += 15;
    if (this.hasCondition("startHealth")) this.baseStats.maxHealth = Math.max(10, this.baseStats.maxHealth - 30);
    if (this.hasCondition("startAttack")) this.baseStats.attack = Math.round(this.baseStats.attack * 0.8);
    if (this.hasCondition("startSpeed")) this.baseStats.speed = Math.round(this.baseStats.speed * 0.8);
    this.currentStats = { ...this.baseStats };
    this.currentHealth = this.baseStats.maxHealth;
    this.timeSinceLastHit = 0;

    this.equipment = {
      Helmet: null,
      "Body Armour": null,
      Weapon: null,
      Boots: null
    };

    this.maxUpgradeCards = this.hasCondition("fewerCards") ? 2 : (hasTalent("mastermind") ? 4 : 3);
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
    this.secondWindUsed = false;
    this.immortalShield = 0;
    this.jackpotUsed = false;
    this.wildCardRerollUsed = false;

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
    let lootQual = this.currentMap.lootQuality;
    if (hasTalent("luckyFind")) lootQual += 0.15;
    this.lootSystem.setMapLootQuality(lootQual);

    this.enemySystem = new EnemySystem(this.world, this.currentMap, this.conditions, this.difficulty);
    this.enemySystem.spawnInitial();

    this.hazardSystem = new HazardSystem(this.world, this.conditions);

    this.toxicGroundTimer = 0;
    this.burningGroundTimer = 0;
    this.stunTimer = 0;

    this.mapNameEl = document.getElementById("map-name");
    this.xpBarFillEl = document.getElementById("xp-bar-fill");
    this.xpLabelEl = document.getElementById("xp-label");
    this.playerLevelEl = document.getElementById("player-level");

    // Player projectile state
    this.playerProjectiles = [];
    this.playerAttackCooldown = 0.6;
    this.playerAttackTimer = 0;
    this.doubleStrikeCounter = 0;

    this.exitTransitionCooldown = 0;

    this.dashDuration = 0.3;
    this.dashInvincibleStart = 0.1;
    this.dashInvincibleDuration = 0.1;
    this.dashCooldownTime = 0.8;
    this.dashSpeedMult = 3;
    this.dashActive = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection = new Vec2(0, 0);
    this.dashTrail = [];
    this.lastMouseWorld = { x: 0, y: 0 };
    this.spaceConsumed = false;
    this.mouseHeld = false;

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
    if (hasTalent("cardCollector")) {
      const cards = getUpgradeCardDefs();
      if (cards.length > 0 && this.activeUpgradeCards.length < this.maxUpgradeCards) {
        const card = cards[Math.floor(Math.random() * cards.length)];
        this.activeUpgradeCards.push({ ...card });
      }
    }
    if (hasTalent("immortal")) this.immortalShield = 30;
    this.updateUpgradeCardsUI();
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

    this.canvas.addEventListener("mousedown", (e) => this.onCanvasMouseDown(e));
    this.canvas.addEventListener("mouseup", (e) => { if (e.button === 0) this.mouseHeld = false; });
    this.canvas.addEventListener("mouseleave", () => this.mouseHeld = false);
    window.addEventListener("mouseup", (e) => { if (e.button === 0) this.mouseHeld = false; });
    this.canvas.addEventListener("mousemove", (e) => {
      this.lastMouseWorld = this.getWorldPositionFromScreen(e.clientX, e.clientY);
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        this.tryDash();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === " ") this.spaceConsumed = false;
    });
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "1" && !e.repeat) this.tryCastSkill(0);
      if (k === "2" && !e.repeat) this.tryCastSkill(1);
      if (k === "3" && !e.repeat) this.tryCastSkill(2);
      if (k === "4" && !e.repeat) this.tryCastSkill(3);
    });

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
    const lpEl = document.getElementById("victory-lp-earned");
    if (lpEl) lpEl.textContent = `+${this.lpEarnedThisRun ?? 0} Legacy Points earned this run`;

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
  }

  saveCharacterAndReturnToMenu() {
    const nameInput = document.getElementById("victory-char-name");
    const name = (nameInput && nameInput.value.trim()) || "Champion";
    const saveData = {
      name,
      level: this.level,
      difficulty: this.difficulty,
      equipment: JSON.parse(JSON.stringify(this.equipment)),
      activeUpgradeCards: JSON.parse(JSON.stringify(this.activeUpgradeCards)),
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      stats: { ...this.currentStats },
      savedAt: Date.now()
    };
    const saved = loadSavedCharacters();
    saved.push(saveData);
    localStorage.setItem("spaceShooter_characters", JSON.stringify(saved));
    if (hasTalent("conqueror") && this.difficulty >= 4) {
      const def = this.lootSystem.getLootDefinition(0.9);
      addConquerorBonusItem({ name: def.name, type: def.type, stats: def.stats || {} });
    }

    document.getElementById("victory-overlay").classList.add("hidden");
    document.getElementById("main-menu").classList.remove("hidden");
    document.querySelector(".game-root").classList.add("hidden");
    refreshMainMenuLP();
    document.getElementById("pause-toggle").classList.add("hidden");
    document.getElementById("dev-toggle").classList.add("hidden");
    renderHallOfChampions();
  }

  update(dt) {
    if (this.gameOver) return;
    if (this.levelUpChoices) return;
    if (this.currentEvent) return;

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
    const inHazard = this.hazardSystem?.playerInPatch(this.player);
    this.playerInWeakeningPatch = inHazard?.type === "weakeningGround";
    if (inHazard) {
      if (inHazard.type === "frozenGround") effectiveSpeed *= 0.7;
      if (inHazard.type === "shockingGround" && Math.random() < dt * 0.2) {
        this.stunTimer = 0.5;
      }
      if (inHazard.type === "toxicGround") {
        this.toxicGroundTimer += dt;
        if (this.toxicGroundTimer >= 1) {
          this.toxicGroundTimer = 0;
          this.onPlayerDamaged(2, false);
        }
      }
      if (inHazard.type === "burningGround") {
        this.burningGroundTimer += dt;
        if (this.burningGroundTimer >= 2) {
          this.burningGroundTimer = 0;
          this.onPlayerDamaged(6, false);
        }
      }
    } else {
      this.toxicGroundTimer = 0;
      this.burningGroundTimer = 0;
      this.playerInWeakeningPatch = false;
    }
    this.player.speed = effectiveSpeed;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      if (this.stunTimer < 0) this.stunTimer = 0;
    }

    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
      if (this.dashCooldown < 0) this.dashCooldown = 0;
    }

    if (this.dashActive) {
      this.dashTimer -= dt;
      const dashSpeed = this.player.speed * this.dashSpeedMult;
      const moveDist = dashSpeed * dt;
      const margin = this.world.wallThickness;
      let nx = this.player.position.x + this.dashDirection.x * moveDist;
      let ny = this.player.position.y + this.dashDirection.y * moveDist;
      nx = Math.max(margin, Math.min(nx, this.world.width - margin - this.player.size));
      ny = Math.max(margin, Math.min(ny, this.world.height - margin - this.player.size));
      this.player.position.set(nx, ny);

      this.dashTrail.push({
        x: this.player.position.x,
        y: this.player.position.y,
        alpha: 1 - (1 - this.dashTimer / this.dashDuration) * 0.8
      });
      if (this.dashTrail.length > 12) this.dashTrail.shift();

      if (this.dashTimer <= 0) {
        this.dashActive = false;
        this.dashCooldown = this.dashCooldownTime;
        this.dashTrail = [];
      }
    } else if (this.stunTimer <= 0) {
      this.player.update(dt, this.input, this.world);
    }

    if (this.hasUpgradeCard("magnet")) this.applyMagnetEffect(dt);

    if (this.hasUpgradeCard("healthRegen")) {
      const heal = this.currentStats.maxHealth * 0.03 * dt;
      this.currentHealth = Math.min(this.currentStats.maxHealth, this.currentHealth + heal);
      this.updateHealthBar();
    }

    if (this.fierySpawned && !this.fieryKilled && this.fieryTimer > 0) {
      this.fieryTimer -= dt;
    }

    this.lootSystem.update(dt, this.player, (item) => this.handleLootPickup(item));
    this.updateUpgradeCardEffects(dt);
    if (this.hazardSystem) this.hazardSystem.update(dt, this);
    this.updateCombat(dt);

    if (this.exitTransitionCooldown > 0) this.exitTransitionCooldown -= dt;
    this.checkExits();

    this.updateBossHealthBar();
    this.updateDashUI();
    this.updateSkillEffects(dt);
    this.updateSkillUI();
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
    if (this.cursedChestBlocked) return;
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

    this.hazardSystem = new HazardSystem(this.world, this.conditions);

    this.lootSystem.items = [];
    this.playerProjectiles = [];
    this.dashActive = false;
    this.dashTrail = [];
    let lootQual = targetMap.lootQuality;
    if (hasTalent("luckyFind")) lootQual += 0.15;
    this.lootSystem.setMapLootQuality(lootQual);

    if (hasTalent("immortal")) this.immortalShield = 30;

    if (hasTalent("treasureHunter") && targetMapId % 3 === 2) {
      const cx = this.world.width / 2 - 10;
      const cy = this.world.height / 2 - 10;
      this.lootSystem.spawnBurstAt(cx, cy, 2, 0.8);
    }

    this.enemySystem.enemies = [];
    this.enemySystem.boss = null;
    this.enemySystem.projectiles = [];
    this.enemySystem.respawnQueue = [];
    this.enemySystem.setMap(targetMap);
    this.enemySystem.spawnInitial();

    if (this.escortQuest?.active && targetMapId === 0) {
      this.resolveStrangerQuest();
    }

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
    this.tryTriggerEvent();
  }

  tryTriggerEvent() {
    if (this.eventsOccurredThisRun.size >= EVENT_DEFS.length) return;
    if (Math.random() >= 0.25) return;
    const available = EVENT_DEFS.filter((e) => !this.eventsOccurredThisRun.has(e.id));
    if (available.length === 0) return;
    const event = available[Math.floor(Math.random() * available.length)];
    this.eventsOccurredThisRun.add(event.id);
    this.showEventCard(event);
  }

  showEventCard(eventDef) {
    this.paused = true;
    this.currentEvent = eventDef;
    const overlay = document.getElementById("event-overlay");
    const titleEl = document.getElementById("event-title");
    const descEl = document.getElementById("event-desc");
    const choicesEl = document.getElementById("event-choices");
    const merchantPick = document.getElementById("event-merchant-pick");
    if (!overlay || !titleEl || !descEl || !choicesEl) return;
    titleEl.textContent = eventDef.name;
    descEl.textContent = eventDef.desc;
    choicesEl.innerHTML = "";
    merchantPick.classList.add("hidden");
    if (eventDef.id === "fiery") {
      const btn = document.createElement("button");
      btn.className = "event-choice-btn";
      btn.textContent = "Face the Fiery";
      btn.onclick = () => this.resolveEventChoice(eventDef.id, "face");
      choicesEl.appendChild(btn);
    } else {
      for (const choice of eventDef.choices) {
        const btn = document.createElement("button");
        btn.className = "event-choice-btn";
        btn.textContent = choice.label;
        btn.onclick = () => this.resolveEventChoice(eventDef.id, choice.id);
        choicesEl.appendChild(btn);
      }
    }
    overlay.classList.remove("hidden");
  }

  resolveEventChoice(eventId, choiceId) {
    const overlay = document.getElementById("event-overlay");
    const merchantPick = document.getElementById("event-merchant-pick");
    const choicesEl = document.getElementById("event-choices");
    if (eventId === "merchant" && choiceId === "invest") {
      const equippable = this.inventory.filter((i) => this.isItemEquippable(i) && i.type !== "Upgrade Card");
      if (equippable.length === 0) {
        this.closeEventOverlay();
        return;
      }
      choicesEl.classList.add("hidden");
      merchantPick.classList.remove("hidden");
      const list = document.getElementById("event-invest-list");
      list.innerHTML = "";
      for (const item of equippable) {
        const li = document.createElement("li");
        li.textContent = `${item.name} (${item.type})`;
        li.onclick = () => {
          this.pendingMerchantInvestment = item;
          const idx = this.inventory.indexOf(item);
          this.inventory.splice(idx, 1);
          this.updateInventoryUI();
          this.updateEquippedUI();
          this.recalculateStats();
          merchantPick.classList.add("hidden");
          choicesEl.classList.remove("hidden");
          this.closeEventOverlay();
        };
        list.appendChild(li);
      }
      document.getElementById("event-invest-cancel").onclick = () => {
        merchantPick.classList.add("hidden");
        choicesEl.classList.remove("hidden");
        this.closeEventOverlay();
      };
      return;
    }
    if (eventId === "merchant" && choiceId === "decline") {
      this.closeEventOverlay();
      return;
    }
    if (eventId === "stranger") {
      if (choiceId === "help") {
        this.escortQuest = { active: true, targetMapId: 0 };
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "spring") {
      if (choiceId === "drink") {
        const cardId = SPRING_CARD_IDS[Math.floor(Math.random() * SPRING_CARD_IDS.length)];
        const cards = getUpgradeCardDefs();
        const card = cards.find((c) => c.cardKey === cardId) || { name: cardId, cardKey: cardId, description: "" };
        this.inventory.push({
          id: 55000 + Math.floor(Math.random() * 1000),
          name: card.name,
          type: "Upgrade Card",
          stats: {},
          cardKey: card.cardKey,
          description: card.description || ""
        });
        this.updateInventoryUI();
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "shrine") {
      if (choiceId === "offerXp") {
        const sacrifice = Math.floor(this.xp * 0.3);
        this.xp -= sacrifice;
        this.updateXpUI();
        const cards = getUpgradeCardDefs();
        const card = cards[Math.floor(Math.random() * cards.length)];
        if (this.activeUpgradeCards.length >= this.maxUpgradeCards) {
          const removed = this.activeUpgradeCards.shift();
          if (removed) this.inventory.push(removed);
        }
        this.activeUpgradeCards.push({ ...card });
        this.updateUpgradeCardsUI();
        this.recalculateStats();
      } else if (choiceId === "destroy") {
        this.inventory = this.inventory.filter((i) => i.type === "Upgrade Card");
        this.equipment = { Helmet: null, "Body Armour": null, Weapon: null, Boots: null };
        this.updateInventoryUI();
        this.updateEquippedUI();
        this.recalculateStats();
        this.lpMultiplier = 2;
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "cursedChest") {
      if (choiceId === "open") {
        this.grantEventRareEquipment();
        this.spawnCursedChestEnemy();
        this.cursedChestBlocked = true;
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "fiery" && choiceId === "face") {
      this.spawnFiery();
      this.fieryTimer = 30;
      this.closeEventOverlay();
      return;
    }
    this.closeEventOverlay();
  }

  closeEventOverlay() {
    this.paused = false;
    this.currentEvent = null;
    const overlay = document.getElementById("event-overlay");
    const merchantPick = document.getElementById("event-merchant-pick");
    const choicesEl = document.getElementById("event-choices");
    if (overlay) overlay.classList.add("hidden");
    if (merchantPick) merchantPick.classList.add("hidden");
    if (choicesEl) choicesEl.classList.remove("hidden");
  }

  grantEventRareEquipment() {
    const groups = LOOT_DEFS.filter((g) => g.type !== "Upgrade Card");
    const group = groups[Math.floor(Math.random() * groups.length)];
    const best = group.items[group.items.length - 1];
    const def = { type: group.type, name: best.name, stats: best.stats };
    this.inventory.push({
      id: 50000 + Math.floor(Math.random() * 10000),
      name: def.name,
      type: def.type,
      stats: def.stats || {},
      cardKey: null,
      description: ""
    });
    this.updateInventoryUI();
  }

  spawnCursedChestEnemy() {
    const margin = this.world.wallThickness + 80;
    const cx = this.world.width / 2 - 30;
    const cy = this.world.height / 2 - 30;
    const typeDef = {
      name: "Cursed Guardian",
      color: "#7c3aed",
      size: 52,
      maxHealth: 200,
      attack: 25,
      speed: 90
    };
    const s = this.currentMap.enemyScale || { hp: 1, attack: 1, speed: 1 };
    typeDef.maxHealth = Math.round(typeDef.maxHealth * (s.hp || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.attack = Math.round(typeDef.attack * (s.attack || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.speed = Math.round(typeDef.speed * (s.speed || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    const enemy = new Enemy(cx, cy, typeDef);
    enemy.isCursedChestGuardian = true;
    this.enemySystem.enemies.push(enemy);
  }

  spawnFiery() {
    const margin = this.world.wallThickness + 60;
    const x = margin + Math.random() * (this.world.width - margin * 2 - 40);
    const y = margin + Math.random() * (this.world.height - margin * 2 - 40);
    const typeDef = {
      name: "Golden Fiery",
      color: "#fbbf24",
      size: 36,
      maxHealth: 80,
      attack: 12,
      speed: 140
    };
    const s = this.currentMap.enemyScale || { hp: 1, attack: 1, speed: 1 };
    typeDef.maxHealth = Math.round(typeDef.maxHealth * (s.hp || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.attack = Math.round(typeDef.attack * (s.attack || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.speed = Math.round(typeDef.speed * (s.speed || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    const enemy = new Enemy(x, y, typeDef);
    enemy.isFiery = true;
    enemy.wanderDirection = new Vec2(Math.random() - 0.5, Math.random() - 0.5);
    enemy.wanderTimer = 0;
    this.enemySystem.enemies.push(enemy);
    this.fierySpawned = true;
  }

  resolveStrangerQuest() {
    this.escortQuest = null;
    const cx = this.world.width / 2 - 20;
    const cy = this.world.height / 2 - 20;
    if (Math.random() < 0.5) {
      this.lootSystem.spawnBurstAt(cx, cy, 4, 0.9);
      this.grantXP(80);
    } else {
      for (let i = 0; i < 8; i++) {
        this.enemySystem.spawnOne();
      }
    }
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
    const rerollBtn = document.getElementById("level-up-reroll");
    if (!overlay || !choicesEl) return;

    choicesEl.innerHTML = "";
    for (const bonus of this.levelUpChoices) {
      const btn = document.createElement("button");
      btn.className = "level-up-choice-btn";
      btn.textContent = bonus.label;
      btn.addEventListener("click", () => this.applyLevelUpChoice(bonus));
      choicesEl.appendChild(btn);
    }
    if (rerollBtn) {
      const canReroll = hasTalent("wildCard") && !this.wildCardRerollUsed;
      rerollBtn.classList.toggle("hidden", !canReroll);
      rerollBtn.onclick = canReroll ? () => {
        this.wildCardRerollUsed = true;
        rerollBtn.classList.add("hidden");
        this.showLevelUpChoices();
      } : null;
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

  getWorldPositionFromScreen(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / this.viewWidth;
    const scaleY = this.canvas.height / this.viewHeight;
    const scale = Math.min(scaleX, scaleY);
    const drawnW = this.viewWidth * scale;
    const drawnH = this.viewHeight * scale;
    const offsetX = (this.canvas.width - drawnW) / 2;
    const offsetY = (this.canvas.height - drawnH) / 2;
    const canvasX = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * this.canvas.height;
    const viewX = (canvasX - offsetX) / scale;
    const viewY = (canvasY - offsetY) / scale;
    return {
      x: this.camera.position.x + viewX,
      y: this.camera.position.y + viewY
    };
  }

  getWorldPositionFromClick(e) {
    return this.getWorldPositionFromScreen(e.clientX, e.clientY);
  }

  onCanvasMouseDown(e) {
    if (e.button !== 0 || this.gameOver || this.paused || this.levelUpChoices) return;
    this.mouseHeld = true;
    this.lastMouseWorld = this.getWorldPositionFromClick(e);
    this.firePlayerProjectile(this.lastMouseWorld.x, this.lastMouseWorld.y);
  }

  tryDash() {
    if (this.gameOver || this.paused || this.levelUpChoices || this.spaceConsumed) return;
    if (this.dashActive || this.dashCooldown > 0) return;
    if (this.stunTimer > 0) return;

    const axis = this.input.getAxis();
    let dx = axis.x;
    let dy = axis.y;

    if (dx === 0 && dy === 0) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const mx = this.lastMouseWorld.x;
      const my = this.lastMouseWorld.y;
      const toMouseX = mx - px;
      const toMouseY = my - py;
      const dist = Math.sqrt(toMouseX * toMouseX + toMouseY * toMouseY) || 1;
      dx = toMouseX / dist;
      dy = toMouseY / dist;
    } else {
      const inv = 1 / Math.sqrt(dx * dx + dy * dy);
      dx *= inv;
      dy *= inv;
    }

    this.dashActive = true;
    this.dashTimer = this.dashDuration;
    this.dashDirection.set(dx, dy);
    this.dashTrail = [];
    this.spaceConsumed = true;
  }

  firePlayerProjectile(targetX, targetY) {
    let effectiveCooldown = this.playerAttackCooldown / (this.levelAttackSpeedMult || 1);
    if (this.hasUpgradeCard("berserker")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      effectiveCooldown *= Math.max(0.4, ratio);
    }
    if (this.playerAttackTimer > 0) return;
    this.playerAttackTimer = effectiveCooldown;

    const px = this.player.position.x + this.player.size / 2 - PLAYER_PROJECTILE_SIZE / 2;
    const py = this.player.position.y + this.player.size / 2 - PLAYER_PROJECTILE_SIZE / 2;
    const damage = this.computePlayerDamage(null);
    const proj = new PlayerProjectile(px, py, targetX, targetY, damage);
    this.playerProjectiles.push(proj);
  }

  updatePlayerProjectiles(dt) {
    const surviving = [];
    const es = this.enemySystem;
    for (const proj of this.playerProjectiles) {
      proj.update(dt, this);
      if (proj.isExpired()) continue;

      let hit = false;
      for (const enemy of es.enemies) {
        if (enemy.isDead) continue;
        if (proj.intersects(enemy)) {
          hit = true;
          let dmg = proj.damage;
          if (hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
            dmg = Math.round(dmg * 1.25);
          }
          this.dealDamageToEnemy(enemy, dmg);
          break;
        }
      }
      if (!hit && es.boss && proj.intersects(es.boss)) {
        hit = true;
        let dmg = proj.damage;
        if (hasTalent("executioner") && es.boss.health < es.boss.maxHealth * 0.3) {
          dmg = Math.round(dmg * 1.25);
        }
        this.dealDamageToEnemy(es.boss, dmg);
      }
      if (!hit && !proj.isExpired()) surviving.push(proj);
    }
    this.playerProjectiles = surviving;
  }

  updateCombat(dt) {
    const player = this.player;

    // Player attack cooldown
    if (this.playerAttackTimer > 0) this.playerAttackTimer -= dt;

    for (let i = 0; i < 4; i++) {
      if (this.skillCooldowns[i] > 0) this.skillCooldowns[i] -= dt;
    }

    if (this.mouseHeld && !this.gameOver && !this.paused && !this.levelUpChoices) {
      this.firePlayerProjectile(this.lastMouseWorld.x, this.lastMouseWorld.y);
    }

    this.updatePlayerProjectiles(dt);

    const es = this.enemySystem;

    // -------- Boss logic (includes minions) --------
    if (es.boss) {
      const minionSurviving = [];
      const globalSlow = this.timeWarpUntil > this.time ? 0.5 : 1;
      for (const enemy of es.enemies) {
        enemy.update(dt, player, this.time, globalSlow);
        if (enemy.intersects(player)) {
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.attackCooldown;
            this.onPlayerDamaged(enemy.attack, true);
          }
        }
        if (enemy.intersects(player) && this.hasUpgradeCard("thorns")) {
          const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
          this.dealDamageToEnemy(enemy, thornsDmg);
        }
        if (enemy.regenRate && !enemy.isDead) {
          enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.regenRate * dt);
        }
        if (enemy.isDead) {
          if (this.hasCondition("enemyExplode")) {
            this.onPlayerDamaged(8, true);
          }
          this.dropLootFromEnemy(enemy);
        } else {
          minionSurviving.push(enemy);
        }
      }
      es.enemies = minionSurviving;
      this.updateBoss(dt);
      this.updateProjectiles(dt);
      return;
    }

    // -------- Regular enemies --------
    const surviving = [];
    const globalSlow = this.timeWarpUntil > this.time ? 0.5 : 1;
    for (const enemy of es.enemies) {
      enemy.update(dt, player, this.time, globalSlow);

      if (enemy.intersects(player)) {
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackCooldown;
          this.onPlayerDamaged(enemy.attack, true);
        }
      }

      if (enemy.intersects(player) && this.hasUpgradeCard("thorns")) {
        const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
        this.dealDamageToEnemy(enemy, thornsDmg);
      }

      if (enemy.regenRate && !enemy.isDead) {
        enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.regenRate * dt);
      }

      if (enemy.isDead) {
        if (this.hasCondition("enemyExplode")) {
          this.onPlayerDamaged(8, true);
        }
        this.dropLootFromEnemy(enemy);
        es.queueRespawn(6);
      } else {
        surviving.push(enemy);
      }
    }

    es.enemies = surviving;
    es.update(dt);
  }

  dealDamageToEnemy(enemy, amount) {
    let dmg = Math.round(amount);
    if (this.playerInWeakeningPatch) dmg = Math.max(1, Math.round(dmg * 0.7));
    if (this.hasCondition("enemyResist")) dmg = Math.max(1, Math.round(dmg * 0.8));
    enemy.takeDamage(dmg);
  }

  computeSkillDamage(enemy, multiplier = 1) {
    let dmg = Math.round(this.currentStats.attack * multiplier);
    if (this.hasUpgradeCard("glassCannon")) dmg = Math.round(dmg * 1.5);
    if (this.hasUpgradeCard("doubleStrike")) {
      this.doubleStrikeCounter++;
      if (this.doubleStrikeCounter >= 5) {
        this.doubleStrikeCounter = 0;
        dmg *= 2;
      }
    }
    if (this.hasUpgradeCard("berserker")) {
      const ratio = this.currentStats.maxHealth > 0 ? this.currentHealth / this.currentStats.maxHealth : 1;
      dmg *= 1 + (1 - ratio) * 0.5;
    }
    if (enemy && hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
      dmg = Math.round(dmg * 1.25);
    }
    return dmg;
  }

  getSkillCooldownMult() {
    let mult = 1 / (this.levelAttackSpeedMult || 1);
    if (this.hasUpgradeCard("berserker")) {
      const ratio = this.currentStats.maxHealth > 0 ? this.currentHealth / this.currentStats.maxHealth : 1;
      mult *= Math.max(0.4, ratio);
    }
    return Math.min(1, mult * 1.2);
  }

  tryCastSkill(slot) {
    if (this.gameOver || this.paused || this.levelUpChoices) return;
    const skillId = this.skills[slot];
    if (!skillId || this.skillCooldowns[slot] > 0) return;
    this.executeSkill(skillId, slot);
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (def) {
      const cdMult = this.getSkillCooldownMult();
      this.skillCooldowns[slot] = def.baseCd * cdMult;
    }
  }

  executeSkill(skillId, slot) {
    const atk = this.currentStats.attack;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const tx = this.lastMouseWorld.x;
    const ty = this.lastMouseWorld.y;

    if (skillId === "fireball") {
      this.damageSkillsUsedThisRun.add("fireball");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "fireball",
        x: px, y: py, vx: (dx / dist) * 180, vy: (dy / dist) * 180,
        mult: 1.5, radius: 60, t: 0
      });
    } else if (skillId === "iceShard") {
      this.damageSkillsUsedThisRun.add("iceShard");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "iceShard",
        x: px, y: py, vx: (dx / dist) * 400, vy: (dy / dist) * 400,
        mult: 0.8, pierces: 5, t: 0
      });
    } else if (skillId === "lightningBolt") {
      this.damageSkillsUsedThisRun.add("lightningBolt");
      const target = this.getNearestEnemy(px, py, 400);
      if (target) {
        const tx1 = target.position.x + target.size / 2;
        const ty1 = target.position.y + target.size / 2;
        let dmg = this.computeSkillDamage(target, 1);
        this.dealDamageToEnemy(target, dmg);
        const chain = this.getNearestEnemy(tx1, ty1, 120, target);
        let chainPos = null;
        if (chain) {
          chainPos = { x: chain.position.x + chain.size / 2, y: chain.position.y + chain.size / 2 };
          this.dealDamageToEnemy(chain, Math.round(dmg * 0.5));
        }
        this.skillEffects.push({
          type: "lightningBolt",
          fromX: px, fromY: py, toX: tx1, toY: ty1, chain: chainPos,
          t: 0, duration: 0.2
        });
      }
    } else if (skillId === "healPulse") {
      const heal = Math.max(15, Math.round(this.currentStats.maxHealth * 0.15));
      this.currentHealth = Math.min(this.currentStats.maxHealth, this.currentHealth + heal);
      this.updateHealthBar();
    } else if (skillId === "shieldBash") {
      this.damageSkillsUsedThisRun.add("shieldBash");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "shieldBash",
        x: px, y: py, dirX: dx / dist, dirY: dy / dist, t: 0, duration: 0.15,
        mult: 0.5, stun: 0.5, knockback: 120
      });
    } else if (skillId === "rapidFire") {
      this.damageSkillsUsedThisRun.add("rapidFire");
      this.skillEffects.push({ type: "rapidFire", t: 0, duration: 3 });
    } else if (skillId === "iceRain") {
      this.damageSkillsUsedThisRun.add("iceRain");
      this.skillEffects.push({ type: "iceRain", x: px, y: py, t: 0, duration: 4, radius: 180 });
    } else if (skillId === "lightningSpear") {
      this.damageSkillsUsedThisRun.add("lightningSpear");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "lightningSpear",
        x: px, y: py, vx: (dx / dist) * 600, vy: (dy / dist) * 600,
        mult: 1.2, t: 0, chargeTime: 0.5, stun: 1
      });
    } else if (skillId === "meteor") {
      this.damageSkillsUsedThisRun.add("meteor");
      this.skillEffects.push({
        type: "meteor",
        targetX: tx, targetY: ty, t: 0, delay: 1, mult: 2.5, radius: 100, burnDuration: 5
      });
    } else if (skillId === "voidRift") {
      this.damageSkillsUsedThisRun.add("voidRift");
      this.skillEffects.push({
        type: "voidRift",
        x: px, y: py, t: 0, duration: 3, radius: 150, mult: 1.5
      });
    } else if (skillId === "phoenixStrike") {
      this.damageSkillsUsedThisRun.add("phoenixStrike");
      this.skillEffects.push({
        type: "phoenixStrike",
        x: px, y: py, t: 0, duration: 0.1, radius: 120, mult: 2, invulnDuration: 3
      });
    } else if (skillId === "chainFrost") {
      this.damageSkillsUsedThisRun.add("chainFrost");
      this.skillEffects.push({ type: "chainFrost", t: 0, freezeDuration: 2 });
    } else if (skillId === "stormCall") {
      this.damageSkillsUsedThisRun.add("stormCall");
      this.skillEffects.push({ type: "stormCall", t: 0, duration: 6, mult: 0.6, strikeInterval: 0.5 });
    } else if (skillId === "timeWarp") {
      this.timeWarpUntil = this.time + 4;
      this.skillEffects.push({ type: "timeWarp", t: 0, duration: 4 });
    }
  }

  getNearestEnemy(cx, cy, maxDist, exclude = null) {
    let best = null; let bestD = maxDist * maxDist;
    const es = this.enemySystem;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead || e === exclude) continue;
      const dx = e.position.x + e.size / 2 - cx; const dy = e.position.y + e.size / 2 - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  updateSkillEffects(dt) {
    this.timeWarpUntil = this.timeWarpUntil || 0;
    const surviving = [];
    for (const eff of this.skillEffects) {
      eff.t += dt;
      if (eff.type === "fireball") {
        eff.x += eff.vx * dt; eff.y += eff.vy * dt;
        const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
        if (hit.length > 0 || eff.t > 2) {
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.2);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "iceShard") {
        eff.x += eff.vx * dt; eff.y += eff.vy * dt;
        eff.hitIds = eff.hitIds || new Set();
        const hit = this.enemiesInRadius(eff.x, eff.y, 20);
        for (const e of hit) {
          if (!eff.hitIds.has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
            e.slowUntil = this.time + 2; e.slowMult = 0.7;
            this.iceShardHitsThisRun++;
            if (this.iceShardHitsThisRun >= 5) setSkillUnlock("iceShard5", true);
          }
        }
        if (eff.t > 1.5) continue;
        surviving.push(eff);
      } else if (eff.type === "shieldBash") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInCone(eff.x, eff.y, eff.dirX, eff.dirY, 120, 80);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
            e.stunUntil = this.time + eff.stun;
            const dx = e.position.x + e.size / 2 - eff.x; const dy = e.position.y + e.size / 2 - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            e.position.x += (dx / dist) * eff.knockback;
            e.position.y += (dy / dist) * eff.knockback;
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "lightningBolt") {
        if (eff.t >= eff.duration) continue;
        surviving.push(eff);
      } else if (eff.type === "rapidFire") {
        if (eff.t >= eff.duration) continue;
        if (Math.floor(eff.t * 3) > Math.floor((eff.t - dt) * 3)) {
          const target = this.getNearestEnemy(this.player.position.x + this.player.size / 2, this.player.position.y + this.player.size / 2, 500);
          if (target) {
            const dmg = this.computeSkillDamage(target, 1);
            this.dealDamageToEnemy(target, dmg);
            eff.lastTargetX = target.position.x + target.size / 2;
            eff.lastTargetY = target.position.y + target.size / 2;
            eff.lastShotTime = eff.t;
          }
        }
        surviving.push(eff);
      } else if (eff.type === "timeWarp") {
        if (eff.t >= eff.duration) continue;
        this.timeWarpUntil = this.time + 0.1;
        surviving.push(eff);
      } else if (eff.type === "iceRain") {
        if (eff.t >= eff.duration) continue;
        if (Math.floor(eff.t * 4) > Math.floor((eff.t - dt) * 4)) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, 0.4));
            e.slowUntil = this.time + 0.5; e.slowMult = 0.5;
          }
        }
        surviving.push(eff);
      } else if (eff.type === "lightningSpear") {
        if (eff.t < eff.chargeTime) { surviving.push(eff); continue; }
        eff.x += eff.vx * dt; eff.y += eff.vy * dt;
        const hit = this.enemiesInRadius(eff.x, eff.y, 25);
        for (const e of hit) {
          if (!(eff.hitIds || (eff.hitIds = new Set())).has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
            e.stunUntil = this.time + eff.stun;
          }
        }
        if (eff.t > 1.5) continue;
        surviving.push(eff);
      } else if (eff.type === "meteor") {
        if (eff.t < eff.delay) { surviving.push(eff); continue; }
        if (eff.t - dt < eff.delay) {
          const hit = this.enemiesInRadius(eff.targetX, eff.targetY, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.25);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.targetX, eff.targetY, 90, eff.burnDuration, burnDmg, true);
          }
        }
        if (eff.t >= eff.delay + 0.5) continue;
        surviving.push(eff);
      } else if (eff.type === "voidRift") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
          continue;
        }
        const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius * 1.5);
        for (const e of hit) {
          const ex = e.position.x + e.size / 2; const ey = e.position.y + e.size / 2;
          const dx = eff.x - ex; const dy = eff.y - ey;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const pull = 80 * dt;
          e.position.x += (dx / dist) * pull;
          e.position.y += (dy / dist) * pull;
        }
        surviving.push(eff);
      } else if (eff.type === "phoenixStrike") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
          this.phoenixInvulnUntil = this.time + eff.invulnDuration;
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "chainFrost") {
        if (eff.t >= 0.1) {
          const es = this.enemySystem;
          for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
            if (!e.isDead) e.stunUntil = this.time + eff.freezeDuration;
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "stormCall") {
        if (eff.t >= eff.duration) continue;
        eff.lastStrike = eff.lastStrike || 0;
        if (eff.t - eff.lastStrike >= eff.strikeInterval) {
          eff.lastStrike = eff.t;
          const es = this.enemySystem;
          const all = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
          if (all.length > 0) {
            const target = all[Math.floor(Math.random() * all.length)];
            this.dealDamageToEnemy(target, this.computeSkillDamage(target, eff.mult));
          }
        }
        surviving.push(eff);
      }
    }
    this.skillEffects = surviving;
  }

  enemiesInRadius(cx, cy, r) {
    const out = [];
    const es = this.enemySystem;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      const ex = e.position.x + e.size / 2; const ey = e.position.y + e.size / 2;
      if ((ex - cx) ** 2 + (ey - cy) ** 2 <= r * r) out.push(e);
    }
    return out;
  }

  enemiesInCone(cx, cy, dirX, dirY, length, angle) {
    const out = [];
    const es = this.enemySystem;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      const ex = e.position.x + e.size / 2 - cx; const ey = e.position.y + e.size / 2 - cy;
      const dist = Math.sqrt(ex * ex + ey * ey) || 1;
      if (dist > length) continue;
      const dot = (ex * dirX + ey * dirY) / dist;
      if (dot > Math.cos(angle * Math.PI / 180)) out.push(e);
    }
    return out;
  }

  drawSkillEffects(ctx) {
    const ox = -this.camera.position.x;
    const oy = -this.camera.position.y;
    for (const eff of this.skillEffects) {
      if (eff.type === "fireball") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const r = 14 + 4 * Math.sin(this.time * 8);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, "#fff3a0"); g.addColorStop(0.5, "#f97316"); g.addColorStop(1, "#dc2626");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "iceShard") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.fillStyle = "rgba(147, 197, 253, 0.9)";
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "lightningBolt") {
        const drawBolt = (x0, y0, x1, y1) => {
          const sx0 = x0 + ox; const sy0 = y0 + oy;
          const sx1 = x1 + ox; const sy1 = y1 + oy;
          const dx = sx1 - sx0; const dy = sy1 - sy0;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          for (let i = 1; i < 10; i++) {
            const t = i / 10;
            const jitter = 6 * Math.sin(this.time * 50 + i * 3);
            ctx.lineTo(sx0 + dx * t + Math.cos(this.time * 60 + i) * jitter, sy0 + dy * t + Math.sin(this.time * 60 + i) * jitter);
          }
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
        };
        ctx.strokeStyle = "rgba(253, 224, 71, 0.95)";
        ctx.lineWidth = 3;
        drawBolt(eff.fromX, eff.fromY, eff.toX, eff.toY);
        if (eff.chain) {
          ctx.strokeStyle = "rgba(253, 224, 71, 0.6)";
          ctx.lineWidth = 2;
          drawBolt(eff.toX, eff.toY, eff.chain.x, eff.chain.y);
        }
      } else if (eff.type === "rapidFire") {
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        const pulse = 0.3 + 0.2 * Math.sin(this.time * 12);
        ctx.strokeStyle = `rgba(253, 224, 71, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(this.player.position.x + ox - 4, this.player.position.y + oy - 4, this.player.size + 8, this.player.size + 8);
        if (eff.lastTargetX != null && eff.t - eff.lastShotTime < 0.15) {
          const sx0 = px + ox; const sy0 = py + oy;
          const sx1 = eff.lastTargetX + ox; const sy1 = eff.lastTargetY + oy;
          const fade = 1 - (eff.t - eff.lastShotTime) / 0.15;
          ctx.strokeStyle = `rgba(253, 224, 71, ${0.8 * fade})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
        }
      } else if (eff.type === "shieldBash" && eff.t < eff.duration) {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.6 - eff.t / eff.duration * 0.4})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const angle = Math.atan2(eff.dirY, eff.dirX);
        ctx.arc(sx, sy, 60, angle - 0.5, angle + 0.5);
        ctx.stroke();
      } else if (eff.type === "lightningSpear") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.strokeStyle = "rgba(253, 224, 71, 0.9)";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(sx - 12, sy); ctx.lineTo(sx + 12, sy);
        ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy + 12);
        ctx.stroke();
      } else if (eff.type === "meteor") {
        const sx = eff.targetX + ox; const sy = eff.targetY + oy;
        if (eff.t < eff.delay) {
          const pulse = 0.5 + 0.5 * (eff.t / eff.delay);
          ctx.fillStyle = `rgba(251, 146, 60, ${pulse * 0.5})`;
          ctx.beginPath(); ctx.arc(sx, sy, 40 + eff.t * 20, 0, Math.PI * 2); ctx.fill();
        } else {
          const flash = Math.max(0, 1 - (eff.t - eff.delay) / 0.5);
          ctx.fillStyle = `rgba(251, 146, 60, ${flash * 0.6})`;
          ctx.beginPath(); ctx.arc(sx, sy, eff.radius || 100, 0, Math.PI * 2); ctx.fill();
        }
      } else if (eff.type === "voidRift") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const pulse = 0.4 + 0.3 * Math.sin(this.time * 6);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, eff.radius);
        g.addColorStop(0, `rgba(139, 92, 246, ${pulse})`); g.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, eff.radius, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "phoenixStrike") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.fillStyle = "rgba(251, 146, 60, 0.6)";
        ctx.beginPath(); ctx.arc(sx, sy, eff.radius, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "iceRain") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.fillStyle = `rgba(147, 197, 253, ${0.2 + 0.15 * Math.sin(this.time * 4)})`;
        ctx.beginPath(); ctx.arc(sx, sy, eff.radius, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "stormCall") {
        ctx.fillStyle = `rgba(253, 224, 71, ${0.1 * Math.sin(this.time * 10)})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "chainFrost" && eff.t < 0.1) {
        ctx.fillStyle = "rgba(147, 197, 253, 0.3)";
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "timeWarp") {
        ctx.fillStyle = `rgba(139, 92, 246, ${0.15 + 0.05 * Math.sin(this.time * 3)})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
    }
  }

  updateSkillUI() {
    const keys = ["1", "2", "3", "4"];
    for (let i = 0; i < 4; i++) {
      const iconEl = document.getElementById(`skill-icon-${i}`);
      const nameEl = document.getElementById(`skill-name-${i}`);
      const cdEl = document.getElementById(`skill-cd-${i}`);
      const slotEl = document.querySelector(`.skill-slot[data-slot="${i}"]`);
      if (!slotEl) continue;
      const skillId = this.skills[i];
      const def = skillId ? SKILL_DEFS.find((s) => s.id === skillId) : null;
      const availableSlots = getAvailableSkillSlots();
      if (i >= availableSlots) {
        slotEl.classList.add("locked");
        if (iconEl) iconEl.textContent = "🔒";
        if (nameEl) nameEl.textContent = `Beat Diff ${SKILL_SLOT_UNLOCK[i + 1]}`;
      } else {
        slotEl.classList.remove("locked");
        if (iconEl) iconEl.textContent = def ? def.icon : "—";
        if (nameEl) nameEl.textContent = def ? def.name : "Empty";
      }
      const cd = this.skillCooldowns[i] || 0;
      const baseCd = def ? def.baseCd : 1;
      const pct = baseCd > 0 ? Math.min(1, cd / (baseCd * this.getSkillCooldownMult())) : 0;
      if (cdEl) {
        cdEl.style.background = pct > 0 ? `conic-gradient(#374151 0deg, #374151 ${pct * 360}deg, transparent ${pct * 360}deg)` : "none";
      }
    }
  }

  computePlayerDamage(enemy) {
    let dmg = this.currentStats.attack;
    if (this.hasUpgradeCard("glassCannon")) dmg = Math.round(dmg * 1.5);
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
    if (enemy && hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
      dmg = Math.round(dmg * 1.25);
    }
    return dmg;
  }

  updateBoss(dt) {
    const boss = this.enemySystem.boss;
    const player = this.player;
    const es = this.enemySystem;
    const globalSlow = this.timeWarpUntil > this.time ? 0.5 : 1;

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
      boss.position.x += boss.chargeDir.x * boss.chargeSpeed * dt * globalSlow;
      boss.position.y += boss.chargeDir.y * boss.chargeSpeed * dt * globalSlow;
      const margin = this.world.wallThickness;
      boss.position.x = Math.max(margin, Math.min(boss.position.x, this.world.width - margin - boss.size));
      boss.position.y = Math.max(margin, Math.min(boss.position.y, this.world.height - margin - boss.size));
      boss.chargeTimer -= dt;
      if (boss.chargeTimer <= 0) boss.chargeActive = false;
      if (boss.intersects(player)) {
        this.onPlayerDamaged(boss.attack * 1.5, true);
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
        const moveSpeed = boss.speed * dt * globalSlow;
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

    // Player damages boss via projectiles (handled in updatePlayerProjectiles)
    if (boss.intersects(player) && this.hasUpgradeCard("thorns")) {
      const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
      this.dealDamageToEnemy(boss, thornsDmg);
    }

    if (boss.isDead) {
      const xpMult = DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1;
      this.grantXP(Math.round(BOSS_XP * xpMult));
      let lpEarned = LP_PER_DIFFICULTY[this.difficulty] ?? this.difficulty;
      if (this.difficulty >= 2 && hasTalent("veteran")) lpEarned += 1;
      lpEarned *= (this.lpMultiplier || 1);
      if (this.hasUpgradeCard("legacyBonus")) lpEarned += 2;
      addLegacyPoints(lpEarned);
      this.lpEarnedThisRun = lpEarned;
      if (this.pendingMerchantInvestment) {
        if (Math.random() < 0.2) {
        } else {
          if (Math.random() < 0.5) {
            const groups = LOOT_DEFS.filter((g) => g.type !== "Upgrade Card");
            const group = groups[Math.floor(Math.random() * groups.length)];
            const idx = Math.min(group.items.length - 1, Math.floor(Math.random() * (group.items.length - 1)) + 1);
            const item = group.items[idx];
            this.inventory.push({
              id: 60000 + Math.floor(Math.random() * 10000),
              name: item.name,
              type: group.type,
              stats: item.stats || {},
              cardKey: null,
              description: ""
            });
          } else {
            const rarityBonus = this.pendingMerchantInvestment.name.includes("Dragon") || this.pendingMerchantInvestment.name.includes("Legendary") ? 3 : 2;
            addLegacyPoints(rarityBonus);
            this.lpEarnedThisRun += rarityBonus;
          }
        }
        this.pendingMerchantInvestment = null;
      }

      const bx = boss.position.x + boss.size / 2;
      const by = boss.position.y + boss.size / 2;
      const count = 3 + Math.floor(Math.random() * 2);
      this.lootSystem.spawnBurstAt(bx, by, count, 0.6);
      if (hasTalent("warlord")) this.lootSystem.spawnGuaranteedWeaponAt(bx, by);
      markDifficultyCompleted(this.difficulty);
      if (this.damageSkillsUsedThisRun.size === 1 && this.damageSkillsUsedThisRun.has("lightningBolt")) {
        setSkillUnlock("lightningOnlyRun", true);
      }
      es.boss = null;
      this.showVictory();
    }
  }

  grantXPFromEnemy(enemy) {
    const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
    if (!baseType) return;
    const minXp = baseType.minXp ?? 10;
    const maxXp = baseType.maxXp ?? 20;
    let xp = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));
    const mult = DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1;
    xp = Math.max(1, Math.round(xp * mult));
    this.grantXP(xp);
  }

  dropLootFromEnemy(enemy) {
    if (enemy.isCursedChestGuardian) {
      this.cursedChestBlocked = false;
      this.grantXP(50);
      this.lootSystem.spawnBurstAt(enemy.position.x + enemy.size / 2, enemy.position.y + enemy.size / 2, 2, 0.6);
      return;
    }
    if (enemy.isFiery && !this.fieryKilled) {
      this.fieryKilled = true;
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      if (this.fieryTimer > 0) {
        const groups = LOOT_DEFS.filter((g) => g.type !== "Upgrade Card");
        const group = groups[Math.floor(Math.random() * groups.length)];
        const best = group.items[group.items.length - 1];
        const def = { type: group.type, name: best.name, stats: best.stats };
        const item = new LootItem(this.lootSystem.nextId++, ex - 10, ey - 10, def, ex, ey);
        this.lootSystem.items.push(item);
        const cards = getUpgradeCardDefs();
        for (let i = 0; i < 2; i++) {
          const card = cards[Math.floor(Math.random() * cards.length)];
          const cardDef = { type: "Upgrade Card", name: card.name, cardKey: card.cardKey, description: card.description };
          const cardItem = new LootItem(this.lootSystem.nextId++, ex + i * 25 - 10, ey - 10, cardDef, ex, ey);
          this.lootSystem.items.push(cardItem);
        }
        this.grantXP(80);
      }
      return;
    }
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
    if (hasTalent("battleHardened") && Math.random() < 0.1) {
      this.lootSystem.spawnGuaranteedWeaponAt(ex, ey);
    }
    if (hasTalent("jackpot") && !this.jackpotUsed) {
      this.jackpotUsed = true;
      this.lootSystem.spawnBurstAt(ex, ey, 1, 1);
    }
  }

  updateProjectiles(dt) {
    const es = this.enemySystem;
    const surviving = [];
    for (const p of es.projectiles) {
      p.update(dt);
      if (p.intersects(this.player)) {
        this.onPlayerDamaged(p.damage, true);
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

  onPlayerDamaged(rawAmount, fromEnemy = false) {
    if (this.gameOver) return;
    if (fromEnemy && this.hasCondition("enemyDmg")) rawAmount = Math.round(rawAmount * 1.15);
    if (this.hasUpgradeCard("glassCannon")) rawAmount = Math.round(rawAmount * 1.3);

    // Ghost Step: invulnerability window
    if (this.hasUpgradeCard("ghostStep") && this.ghostStepTimer > 0) return;

    // Phoenix Strike: invulnerability
    if (this.phoenixInvulnUntil && this.time < this.phoenixInvulnUntil) return;

    // Dash: invulnerability at midpoint
    if (this.dashActive && this.dashTimer < 0.2 && this.dashTimer >= 0.1) return;

    // Iron Skin: absorbs one hit
    if (this.hasUpgradeCard("ironSkin") && this.ironSkinShieldReady) {
      this.ironSkinShieldReady = false;
      return;
    }

    // Immortal: regenerating shield absorbs damage first
    if (hasTalent("immortal") && this.immortalShield > 0) {
      const absorb = Math.min(this.immortalShield, rawAmount);
      this.immortalShield -= absorb;
      rawAmount -= absorb;
      if (rawAmount <= 0) return;
    }

    const effectiveDamage = Math.max(0, rawAmount - this.currentStats.defense);
    if (effectiveDamage <= 0) return;

    this.currentHealth -= effectiveDamage;
    this.timeSinceLastHit = 0;

    if (this.hasUpgradeCard("ghostStep")) {
      this.ghostStepTimer = 1.5;
    }

    if (this.currentHealth <= 0) {
      if (hasTalent("secondWind") && !this.secondWindUsed) {
        this.secondWindUsed = true;
        setSkillUnlock("secondWindUsed", true);
        this.currentHealth = 1;
      } else {
        this.currentHealth = 0;
        this.showGameOver();
      }
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
    if (this.hazardSystem) this.hazardSystem.draw(ctx, this.camera, this.time);
    this.lootSystem.draw(ctx, this.camera, this.time);
    this.enemySystem.draw(ctx, this.camera);

    if (this.dashTrail.length > 0) {
      for (let i = 0; i < this.dashTrail.length; i++) {
        const t = this.dashTrail[i];
        const alpha = (i / this.dashTrail.length) * 0.4;
        const sx = Math.floor(t.x - this.camera.position.x);
        const sy = Math.floor(t.y - this.camera.position.y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffff4d";
        ctx.fillRect(sx, sy, this.player.size, this.player.size);
      }
      ctx.globalAlpha = 1;
    }

    this.player.draw(ctx, this.camera);

    const dashInvincible = this.dashActive && this.dashTimer < 0.2 && this.dashTimer >= 0.1;
    if (dashInvincible) {
      const sx = Math.floor(this.player.position.x - this.camera.position.x);
      const sy = Math.floor(this.player.position.y - this.camera.position.y);
      const pulse = 0.6 + Math.sin(this.time * 40) * 0.2;
      ctx.strokeStyle = `rgba(96, 165, 250, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(sx - 2, sy - 2, this.player.size + 4, this.player.size + 4);
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(96, 165, 250, 0.2)";
      ctx.fillRect(sx, sy, this.player.size, this.player.size);
      ctx.shadowBlur = 0;
    }

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

    // Darkness condition — reduced vision radius
    if (this.hasCondition("darkness")) {
      const px = this.player.position.x + this.player.size / 2 - this.camera.position.x;
      const py = this.player.position.y + this.player.size / 2 - this.camera.position.y;
      const radius = 280;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.6, "rgba(0,0,0,0.4)");
      gradient.addColorStop(1, "rgba(0,0,0,0.95)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    this.drawSkillEffects(ctx);

    for (const proj of this.playerProjectiles) {
      proj.draw(ctx, this.camera);
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
    if (this.hasUpgradeCard("vampiric") && !this.hasCondition("noHealthDrops")) {
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

  updateDashUI() {
    const fill = document.getElementById("dash-cooldown-fill");
    const label = document.getElementById("dash-label");
    if (!fill || !label) return;
    const pct = this.dashCooldown > 0
      ? 1 - this.dashCooldown / this.dashCooldownTime
      : 1;
    fill.style.width = `${Math.round(pct * 100)}%`;
    label.textContent = this.dashCooldown > 0
      ? `${Math.round(this.dashCooldown * 10) / 10}s`
      : "Ready";
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
    if (hasTalent("fortified")) {
      stats.defense = Math.round((stats.defense || 0) * 1.2);
    }
    stats.maxHealth = Math.round(stats.maxHealth * (this.levelHealthMult || 1));
    stats.speed = Math.round(stats.speed * (this.levelSpeedMult || 1));
    stats.attack = Math.round(stats.attack * (this.levelAttackMult || 1));
    if (hasTalent("ironFist")) stats.attack = Math.round(stats.attack * 1.1);
    if (hasTalent("synergist") && this.activeUpgradeCards.length >= 2) {
      stats.maxHealth = Math.round(stats.maxHealth * 1.1);
      stats.defense = Math.round((stats.defense || 0) * 1.1);
      stats.speed = Math.round(stats.speed * 1.1);
      stats.attack = Math.round(stats.attack * 1.1);
    }
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
const CONQUEROR_VAULT_KEY = "spaceShooter_conquerorVault";

function loadConquerorVault() {
  try {
    const raw = localStorage.getItem(CONQUEROR_VAULT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addConquerorBonusItem(item) {
  const vault = loadConquerorVault();
  vault.push({ item, collectedBy: "Conqueror" });
  localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(vault));
}

function loadSavedCharacters() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function buildLegacyVault() {
  const saved = loadSavedCharacters();
  const conquerorItems = loadConquerorVault();
  const vault = [...conquerorItems];
  for (const char of saved) {
    const name = char.name || "Unknown";
    if (char.equipment) {
      for (const [slot, item] of Object.entries(char.equipment)) {
        if (item) {
          vault.push({
            item: { ...item, type: item.type || slot },
            collectedBy: name
          });
        }
      }
    }
    if (char.activeUpgradeCards) {
      for (const card of char.activeUpgradeCards) {
        if (card) {
          vault.push({
            item: { ...card, type: "Upgrade Card" },
            collectedBy: name
          });
        }
      }
    }
    if (char.inventory) {
      for (const inv of char.inventory) {
        if (inv) {
          vault.push({
            item: { ...inv },
            collectedBy: name
          });
        }
      }
    }
  }
  return vault;
}

function formatItemStats(item) {
  if (!item.stats || Object.keys(item.stats).length === 0) return "";
  return Object.entries(item.stats)
    .map(([k, v]) => `${k}: +${v}`)
    .join(", ");
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
    const diff = char.difficulty || 1;
    card.innerHTML = `
      <div class="champion-card-content">
        <div class="champion-name">${escapeHtml(char.name)} <span class="champion-level">Lv.${level}</span> <span class="champion-difficulty">Diff.${diff}</span></div>
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

let legacySelectedIndices = new Set();

function renderLegacyVault() {
  const grid = document.getElementById("legacy-vault-grid");
  const countEl = document.getElementById("legacy-selection-count");
  const startBtn = document.getElementById("legacy-start-run");
  if (!grid) return;

  const vault = buildLegacyVault();
  legacySelectedIndices = new Set();

  grid.innerHTML = "";
  if (vault.length === 0) {
    const p = document.createElement("p");
    p.className = "legacy-vault-empty";
    p.textContent = "No items in the vault yet. Save characters to the Hall of Champions to add items!";
    grid.appendChild(p);
  } else {
    vault.forEach((entry, idx) => {
      const card = document.createElement("div");
      card.className = "legacy-vault-item";
      card.dataset.index = String(idx);
      const statsStr = formatItemStats(entry.item);
      card.innerHTML = `
        <div class="legacy-item-name">${escapeHtml(entry.item.name)}</div>
        <div class="legacy-item-type">${escapeHtml(entry.item.type)}</div>
        ${statsStr ? `<div class="legacy-item-stats">${escapeHtml(statsStr)}</div>` : ""}
        ${entry.item.description ? `<div class="legacy-item-desc">${escapeHtml(entry.item.description)}</div>` : ""}
        <div class="legacy-item-source">From: ${escapeHtml(entry.collectedBy)}</div>
      `;
      card.addEventListener("click", () => toggleLegacySelection(idx, card));
      grid.appendChild(card);
    });
  }

  updateLegacySelectionUI();
}

function toggleLegacySelection(idx, cardEl) {
  const vault = buildLegacyVault();
  if (legacySelectedIndices.has(idx)) {
    legacySelectedIndices.delete(idx);
  } else if (legacySelectedIndices.size < maxLegacySelection()) {
    legacySelectedIndices.add(idx);
  }
  if (cardEl) {
    cardEl.classList.toggle("legacy-item-selected", legacySelectedIndices.has(idx));
  } else {
    const grid = document.getElementById("legacy-vault-grid");
    const card = grid?.querySelector(`[data-index="${idx}"]`);
    if (card) card.classList.toggle("legacy-item-selected", legacySelectedIndices.has(idx));
  }
  updateLegacySelectionUI();
}

function maxLegacySelection() {
  return hasTalent("hoarder") ? 5 : 3;
}

function updateLegacySelectionUI() {
  const countEl = document.getElementById("legacy-selection-count");
  const maxEl = document.getElementById("legacy-vault-max-count");
  const startBtn = document.getElementById("legacy-start-run");
  const max = maxLegacySelection();
  if (countEl) countEl.textContent = `${legacySelectedIndices.size} / ${max} selected`;
  if (maxEl) maxEl.textContent = max;
  if (startBtn) startBtn.disabled = legacySelectedIndices.size === 0;
}

function getSelectedLegacyItems() {
  const vault = buildLegacyVault();
  return Array.from(legacySelectedIndices)
    .sort((a, b) => a - b)
    .map((idx) => ({ ...vault[idx].item }));
}

function openLegacyVault() {
  renderLegacyVault();
  const overlay = document.getElementById("legacy-vault-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

function closeLegacyVault(returnToMainMenu = true) {
  const overlay = document.getElementById("legacy-vault-overlay");
  if (overlay) overlay.classList.add("hidden");
  if (returnToMainMenu) {
    const mainMenu = document.getElementById("main-menu");
    if (mainMenu) mainMenu.classList.remove("hidden");
    refreshMainMenuLP();
  }
}

function refreshMainMenuLP() {
  const el = document.getElementById("main-menu-lp-value");
  if (el) el.textContent = getLegacyPoints();
}

function openTalentTree() {
  renderTalentTree();
  const overlay = document.getElementById("talent-tree-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

function closeTalentTree() {
  const overlay = document.getElementById("talent-tree-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.classList.remove("hidden");
  refreshMainMenuLP();
}

function renderTalentTree() {
  const content = document.getElementById("talent-tree-content");
  const lpEl = document.getElementById("talent-tree-lp-value");
  if (lpEl) lpEl.textContent = getLegacyPoints();
  if (!content) return;

  const purchased = getPurchasedTalents();
  const lp = getLegacyPoints();

  let html = '<div class="talent-tree-branches">';
  for (const [branchName, nodes] of Object.entries(TALENT_TREE)) {
    html += `<div class="talent-tree-branch"><div class="talent-tree-branch-title">${escapeHtml(branchName)}</div><div class="talent-tree-nodes">`;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isPurchased = purchased.includes(node.id);
      const prevPurchased = i === 0 || purchased.includes(nodes[i - 1].id);
      const isAvailable = !isPurchased && prevPurchased && lp >= node.cost;
      const isLocked = !isPurchased && !prevPurchased;
      const state = isPurchased ? "purchased" : isAvailable ? "available" : "locked";
      html += `<div class="talent-tree-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}">
        <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
        <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
        <div class="talent-tree-node-cost">${isPurchased ? "✓ Purchased" : `${node.cost} LP`}</div>
      </div>`;
    }
    html += "</div></div>";
  }
  html += "</div>";
  content.innerHTML = html;

  content.querySelectorAll(".talent-tree-node.available").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.talentId;
      const cost = Number(el.dataset.cost);
      if (getLegacyPoints() >= cost && purchaseTalent(id, cost)) {
        renderTalentTree();
      }
    });
  });
}

let preRunDifficulty = 1;
let preRunConditions = [];
let preRunRerollUsed = 0;
let preRunRerollMax = 1;
let pendingLegacyItems = [];

function showPreRunScreen(legacyItems = []) {
  pendingLegacyItems = legacyItems;
  preRunDifficulty = 1;
  preRunRerollUsed = 0;
  preRunRerollMax = hasTalent("daredevil") ? 2 : 1;
  rollPreRunConditions();

  const overlay = document.getElementById("pre-run-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");

  renderPreRunScreen();
}

function rollPreRunConditions() {
  const count = DIFFICULTY_CONDITION_COUNTS[preRunDifficulty] ?? 0;
  preRunConditions = pickRandomConditions(count);
}

function renderPreRunScreen() {
  const count = DIFFICULTY_CONDITION_COUNTS[preRunDifficulty] ?? 0;
  const diffLabel = document.getElementById("pre-run-diff-label");
  if (diffLabel) {
    diffLabel.textContent = count === 0
      ? "Difficulty 1 — No conditions"
      : `Difficulty ${preRunDifficulty} — ${count} conditions`;
  }

  const diffMultEl = document.getElementById("pre-run-diff-mult");
  if (diffMultEl) {
    const mult = (DIFFICULTY_STAT_MULTIPLIER[preRunDifficulty] ?? 1) * 100;
    diffMultEl.textContent = `Enemy stats & XP: ${Math.round(mult)}%`;
  }

  const list = document.getElementById("pre-run-conditions-list");
  if (list) {
    list.innerHTML = "";
    if (preRunConditions.length === 0) {
      const p = document.createElement("p");
      p.className = "pre-run-no-conditions";
      p.textContent = "No conditions this run.";
      list.appendChild(p);
    } else {
      for (const c of preRunConditions) {
        const div = document.createElement("div");
        div.className = "pre-run-condition-item";
        div.innerHTML = `<span class="pre-run-condition-icon">${c.icon}</span><div><strong>${escapeHtml(c.name)}</strong><br><span class="pre-run-condition-desc">${escapeHtml(c.desc)}</span></div>`;
        list.appendChild(div);
      }
    }
  }

  const rerollBtn = document.getElementById("pre-run-reroll");
  if (rerollBtn) {
    rerollBtn.disabled = preRunRerollUsed >= preRunRerollMax || count === 0;
    rerollBtn.textContent = preRunRerollUsed >= preRunRerollMax
      ? `Reroll used (${preRunRerollUsed}/${preRunRerollMax})`
      : `Reroll Conditions (${preRunRerollMax - preRunRerollUsed} left)`;
  }

  const diff6Btn = document.querySelector(".pre-run-diff-6");
  if (diff6Btn) {
    diff6Btn.classList.toggle("visible", hasTalent("legend"));
  }

  document.querySelectorAll(".pre-run-diff-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.diff) === preRunDifficulty);
  });
}

let pendingSkillsForRun = [null, null, null, null];
let selectedSkillSlot = -1;

function showSkillSelectScreen() {
  const overlay = document.getElementById("skill-select-overlay");
  const preRun = document.getElementById("pre-run-overlay");
  if (overlay) overlay.classList.remove("hidden");
  if (preRun) preRun.classList.add("hidden");
  pendingSkillsForRun = [null, null, null, null];
  selectedSkillSlot = -1;
  renderSkillSelectScreen();
}

function renderSkillSelectScreen() {
  const slotsEl = document.getElementById("skill-select-slots");
  const poolEl = document.getElementById("skill-select-pool");
  if (!slotsEl || !poolEl) return;

  const availableSlots = getAvailableSkillSlots();
  const unlocked = getUnlockedSkills();

  slotsEl.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const div = document.createElement("div");
    div.className = "skill-select-slot" + (pendingSkillsForRun[i] ? " filled" : "") + (i >= availableSlots ? " locked" : "") + (selectedSkillSlot === i ? " selected" : "");
    div.dataset.slot = String(i);
    const skill = pendingSkillsForRun[i];
    const skillDef = skill ? SKILL_DEFS.find((s) => s.id === skill) : null;
    div.innerHTML = i >= availableSlots
      ? `<span style="font-size:20px">🔒</span><span style="font-size:10px">Beat Diff ${SKILL_SLOT_UNLOCK[i + 1]} to unlock</span>`
      : skillDef ? `<span style="font-size:24px">${skillDef.icon}</span><span style="font-size:11px">${escapeHtml(skillDef.name)}</span>` : `<span style="font-size:12px;color:#64748b">Click skill to assign</span>`;
    if (i < availableSlots) {
      div.addEventListener("click", () => {
        selectedSkillSlot = i;
        renderSkillSelectScreen();
      });
    }
    slotsEl.appendChild(div);
  }

  poolEl.innerHTML = "";
  for (const s of unlocked) {
    const btn = document.createElement("button");
    btn.className = "skill-pool-item";
    btn.innerHTML = `<span>${s.icon}</span><span>${escapeHtml(s.name)}</span>`;
    btn.addEventListener("click", () => {
      const slot = selectedSkillSlot >= 0 && selectedSkillSlot < availableSlots ? selectedSkillSlot : pendingSkillsForRun.findIndex((x) => !x);
      if (slot >= 0 && slot < availableSlots) {
        pendingSkillsForRun[slot] = s.id;
        selectedSkillSlot = -1;
        renderSkillSelectScreen();
      }
    });
    poolEl.appendChild(btn);
  }
}

function confirmSkillSelectAndStart() {
  const vaultLocked = preRunConditions.some((c) => c.id === "vaultLocked");
  const legacyItems = vaultLocked ? [] : pendingLegacyItems;

  const overlay = document.getElementById("skill-select-overlay");
  const mainMenu = document.getElementById("main-menu");
  const gameRoot = document.querySelector(".game-root");
  if (overlay) overlay.classList.add("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
  if (gameRoot) gameRoot.classList.remove("hidden");
  document.getElementById("pause-toggle")?.classList.remove("hidden");
  document.getElementById("dev-toggle")?.classList.remove("hidden");

  const skills = [...pendingSkillsForRun];
  startGame(legacyItems, {
    difficulty: preRunDifficulty,
    conditions: preRunConditions,
    skills
  });
}

function acceptPreRunAndStart() {
  showSkillSelectScreen();
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
      newGameBtn.addEventListener("click", () => showPreRunScreen([]));
    }

    const legacyVaultBtn = document.getElementById("main-menu-legacy-vault");
    if (legacyVaultBtn) {
      legacyVaultBtn.addEventListener("click", openLegacyVault);
    }

    const talentTreeBtn = document.getElementById("main-menu-talent-tree");
    if (talentTreeBtn) {
      talentTreeBtn.addEventListener("click", openTalentTree);
    }

    const talentTreeCloseBtn = document.getElementById("talent-tree-close");
    if (talentTreeCloseBtn) {
      talentTreeCloseBtn.addEventListener("click", closeTalentTree);
    }

    refreshMainMenuLP();

    const legacyCloseBtn = document.getElementById("legacy-vault-close");
    if (legacyCloseBtn) {
      legacyCloseBtn.addEventListener("click", closeLegacyVault);
    }

    const legacyStartBtn = document.getElementById("legacy-start-run");
    if (legacyStartBtn) {
      legacyStartBtn.addEventListener("click", () => {
        const items = getSelectedLegacyItems();
        closeLegacyVault(false);
        showPreRunScreen(items);
      });
    }

    document.querySelectorAll(".pre-run-diff-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        preRunDifficulty = Number(btn.dataset.diff);
        rollPreRunConditions();
        renderPreRunScreen();
      });
    });

    const preRunReroll = document.getElementById("pre-run-reroll");
    if (preRunReroll) {
      preRunReroll.addEventListener("click", () => {
        preRunRerollUsed++;
        rollPreRunConditions();
        renderPreRunScreen();
      });
    }

    const preRunAccept = document.getElementById("pre-run-accept");
    if (preRunAccept) {
      preRunAccept.addEventListener("click", acceptPreRunAndStart);
    }

    const skillSelectConfirm = document.getElementById("skill-select-confirm");
    if (skillSelectConfirm) {
      skillSelectConfirm.addEventListener("click", confirmSkillSelectAndStart);
    }
    const skillSelectBack = document.getElementById("skill-select-back");
    if (skillSelectBack) {
      skillSelectBack.addEventListener("click", () => {
        document.getElementById("skill-select-overlay").classList.add("hidden");
        document.getElementById("pre-run-overlay").classList.remove("hidden");
      });
    }

    const preRunBack = document.getElementById("pre-run-back");
    if (preRunBack) {
      preRunBack.addEventListener("click", () => {
        document.getElementById("pre-run-overlay").classList.add("hidden");
        document.getElementById("main-menu").classList.remove("hidden");
      });
    }
  } else {
    startGame([], { difficulty: 1, conditions: [] });
  }
}

function startGame(legacyItems = [], runConfig = {}) {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Game canvas not found");
    return;
  }
  canvas.width = 800;
  canvas.height = 600;
  new Game(canvas, legacyItems, runConfig);
}

window.addEventListener("DOMContentLoaded", bootstrap);

