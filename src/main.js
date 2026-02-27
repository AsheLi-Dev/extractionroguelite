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

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
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

const SKILL_CATEGORIES = { projectile: "Projectile", melee: "Melee", aura: "Aura" };

const SKILL_DEFS = [
  { id: "fireball", name: "Fireball", icon: "🔥", baseCd: 3, desc: "Slow projectile, explodes for area damage + burning ground 3s", unlock: "always", category: "projectile" },
  { id: "iceShard", name: "Ice Shard", icon: "❄️", baseCd: 2, desc: "Fast piercing projectile, slows 30% for 2s", unlock: "always", category: "projectile" },
  { id: "lightningBolt", name: "Lightning Bolt", icon: "⚡", baseCd: 2.5, desc: "Instant strike, chains to 1 enemy for 50%", unlock: "always", category: "projectile" },
  { id: "rapidFire", name: "Rapid Fire", icon: "🔫", baseCd: 8, desc: "3 projectiles/sec at nearest enemy for 3s", unlock: "always", category: "projectile" },
  { id: "shieldBash", name: "Shield Bash", icon: "🛡️", baseCd: 4, desc: "Cone knockback + stun 0.5s", unlock: "always", category: "projectile" },
  { id: "healPulse", name: "Heal Pulse", icon: "💚", baseCd: 10, desc: "Restore 15% max health", unlock: "always", category: "projectile" },
  { id: "iceRain", name: "Ice Rain", icon: "🌨️", baseCd: 12, desc: "Ice storm 4s, continuous damage, slow 50%", unlock: "scavengerFull", category: "projectile" },
  { id: "lightningSpear", name: "Lightning Spear", icon: "🔱", baseCd: 8, desc: "Charge 0.5s, piercing spear, stun 1s", unlock: "diff3", category: "projectile" },
  { id: "meteor", name: "Meteor", icon: "☄️", baseCd: 15, desc: "1s delay, massive area damage, burning 5s", unlock: "diff4", category: "projectile" },
  { id: "voidRift", name: "Void Rift", icon: "🌀", baseCd: 14, desc: "Pull enemies 3s then explode", unlock: "diff5", category: "projectile" },
  { id: "timeWarp", name: "Time Warp", icon: "⏱️", baseCd: 20, desc: "Slow enemies 50% for 4s", unlock: "mastermind", category: "projectile" },
  { id: "phoenixStrike", name: "Phoenix Strike", icon: "🦅", baseCd: 25, desc: "Explosion + 3s invincibility", unlock: "secondWindUsed", category: "projectile" },
  { id: "chainFrost", name: "Chain Frost", icon: "🧊", baseCd: 18, desc: "Freeze all enemies 2s", unlock: "iceShard5", category: "projectile" },
  { id: "stormCall", name: "Storm Call", icon: "⛈️", baseCd: 20, desc: "Lightning storm 6s", unlock: "lightningOnlyRun", category: "projectile" },
  { id: "bladeDash", name: "Blade Dash", icon: "⚔️", baseCd: 5, desc: "Dash forward damaging all enemies in path", unlock: "always", category: "melee" },
  { id: "whirlwind", name: "Whirlwind", icon: "🔄", baseCd: 10, desc: "Spin 2s hitting nearby enemies, move at half speed", unlock: "always", category: "melee" },
  { id: "groundSlam", name: "Ground Slam", icon: "💥", baseCd: 6, desc: "Shockwave damaging and knocking back nearby enemies", unlock: "always", category: "melee" },
  { id: "bladeStorm", name: "Blade Storm", icon: "🗡️", baseCd: 12, desc: "8 spinning blades bounce off walls, pierce enemies 3s", unlock: "diff2", category: "melee" },
  { id: "earthquake", name: "Earthquake", icon: "🌋", baseCd: 18, desc: "Map shake 3s, damage and slow all on screen", unlock: "diff4", category: "melee" },
  { id: "frostAura", name: "Frost Aura", icon: "❄️", baseCd: 0, desc: "Toggle: slow nearby 25%, 0.5% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.005 },
  { id: "flameAura", name: "Flame Aura", icon: "🔥", baseCd: 0, desc: "Toggle: burn nearby enemies, 0.5% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.005 },
  { id: "thunderAura", name: "Thunder Aura", icon: "⚡", baseCd: 0, desc: "Toggle: lightning to nearest every 1.5s, 1% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.01 },
  { id: "barrierAura", name: "Barrier Aura", icon: "🛡️", baseCd: 0, desc: "Toggle: -15% damage taken, 1.5% HP/s", unlock: "fortified", category: "aura", auraUpkeep: 0.015 },
  { id: "voidAura", name: "Void Aura", icon: "🌀", baseCd: 0, desc: "Toggle: pull enemies toward you, 1% HP/s", unlock: "diff3", category: "aura", auraUpkeep: 0.01 },
  { id: "soulAura", name: "Soul Aura", icon: "💜", baseCd: 0, desc: "Toggle: 50% damage to healing, 2% HP/s", unlock: "vampiric50", category: "aura", auraUpkeep: 0.02 }
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
  if (skillDef.unlock === "diff2") return !!u.diff2;
  if (skillDef.unlock === "diff3") return !!u.diff3;
  if (skillDef.unlock === "diff4") return !!u.diff4;
  if (skillDef.unlock === "diff5") return !!u.diff5;
  if (skillDef.unlock === "fortified") return hasTalent("fortified");
  if (skillDef.unlock === "vampiric50") return (u.vampiricTriggers || 0) >= 50;
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

const MAP_WIDTH = 3600;
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
    enemyCount: 6,
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
    enemyCount: 8,
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
    enemyCount: 10,
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
    enemyCount: 12,
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
    enemyCount: 16,
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
      const count = 21;
      for (let i = 0; i < count; i++) {
        const x = margin + (i / (count - 1)) * w + (Math.random() - 0.5) * 80;
        const y = margin + Math.random() * h;
        const clampedX = Math.max(margin, Math.min(x, this.world.width - margin - 1));
        const clampedY = Math.max(margin, Math.min(y, this.world.height - margin - 1));
        this.patches.push({ type, x: clampedX, y: clampedY, radius: HAZARD_RADIUS, id: this.patches.length });
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

      const vw = camera.viewWidth || 800;
      const vh = camera.viewHeight || 600;
      if (sx + p.radius < 0 || sx - p.radius > vw || sy + p.radius < 0 || sy - p.radius > vh) continue;

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

const AFFIX_DEFS = [
  { id: "swift", name: "Swift", icon: "⚡", color: "#fbbf24" },
  { id: "volatile", name: "Volatile", icon: "💥", color: "#f97316" },
  { id: "regenerating", name: "Regenerating", icon: "💚", color: "#22c55e" },
  { id: "evasive", name: "Evasive", icon: "👟", color: "#a78bfa" },
  { id: "auraBearer", name: "Aura Bearer", icon: "⭕", color: "#ec4899" },
  { id: "martyr", name: "Martyr", icon: "💀", color: "#78716c" },
  { id: "undying", name: "Undying", icon: "🔄", color: "#7c3aed" },
  { id: "weakening", name: "Weakening", icon: "📉", color: "#ef4444" },
  { id: "orbiting", name: "Orbiting", icon: "🔥", color: "#f59e0b" },
  { id: "lasering", name: "Lasering", icon: "📡", color: "#06b6d4" },
  { id: "phantom", name: "Phantom", icon: "👻", color: "#94a3b8" },
  { id: "cursing", name: "Cursing", icon: "☠", color: "#8b5cf6" },
  { id: "erratic", name: "Erratic", icon: "〰", color: "#e879f9" },
  { id: "rooted", name: "Rooted", icon: "⛓", color: "#64748b" }
];

function getAffixDef(id) {
  return AFFIX_DEFS.find((a) => a.id === id) || { id, name: id, icon: "?", color: "#94a3b8" };
}

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

    // Only chase after player enters detection range; once activated, chase forever
    this.activated = false;
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

  update(dt, player, gameTime = 0, globalSlowMult = 1, detectionRange = 200, game = null) {
    if (this._undyingRespawnTime != null && gameTime < this._undyingRespawnTime) {
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }
    if (this._undyingRespawnTime != null && gameTime >= this._undyingRespawnTime) {
      this._undyingRespawnTime = null;
    }
    if (this.stunUntil != null && gameTime < this.stunUntil) {
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }
    const hasAffix = (id) => this.affixes && this.affixes.includes(id);
    let speedMult = globalSlowMult;
    if (this.slowUntil != null && gameTime < this.slowUntil) speedMult *= (this.slowMult ?? 0.7);
    if (hasAffix("swift")) {
      speedMult *= 1.2;
      this._swiftTrail = this._swiftTrail || [];
      this._swiftTrail.push({ x: this.position.x, y: this.position.y });
      if (this._swiftTrail.length > 8) this._swiftTrail.shift();
    } else this._swiftTrail = null;
    if (this._auraBuffed) speedMult *= 1.2;
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const margin = 60;

    if (hasAffix("erratic")) {
      this._erraticTimer = (this._erraticTimer ?? 0) + dt;
      if (this._erraticTimer >= 4) {
        this._erraticTimer = 0;
        this._erraticTrail = this._erraticTrail || [];
        for (let i = 0; i < 4; i++) this._erraticTrail.push({ x: this.position.x, y: this.position.y });
        if (this._erraticTrail.length > 12) this._erraticTrail = this._erraticTrail.slice(-12);
        const angle = Math.random() * Math.PI * 2;
        const dashDist = 80;
        this.position.x += Math.cos(angle) * dashDist;
        this.position.y += Math.sin(angle) * dashDist;
      }
    }

    if (hasAffix("rooted")) {
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }

    if (hasAffix("evasive") && this.activated) {
      this._evasiveTrail = this._evasiveTrail || [];
      this._evasiveTrail.push({ x: this.position.x, y: this.position.y });
      if (this._evasiveTrail.length > 6) this._evasiveTrail.shift();
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeSpeed = Math.min(this.speed * 1.5, player.speed || 100);
      this.position.x += (dx / dist) * fleeSpeed * speedMult * dt;
      this.position.y += (dy / dist) * fleeSpeed * speedMult * dt;
      const w = this.worldBounds?.width ?? 3600;
      const h = this.worldBounds?.height ?? 900;
      this.position.x = Math.max(margin, Math.min(this.position.x, w - margin - this.size));
      this.position.y = Math.max(margin, Math.min(this.position.y, h - margin - this.size));
    } else this._evasiveTrail = null;
    if (hasAffix("evasive") && !this.activated) this._evasiveTrail = null;
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
      const w = this.worldBounds?.width ?? 3600;
      const h = this.worldBounds?.height ?? 900;
      this.position.x = Math.max(margin, Math.min(this.position.x, w - margin - this.size));
      this.position.y = Math.max(margin, Math.min(this.position.y, h - margin - this.size));
    } else {
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (!this.activated && dist <= detectionRange) this.activated = true;
      if (this.activated) {
        this.position.x += (dx / dist) * this.speed * speedMult * dt;
        this.position.y += (dy / dist) * this.speed * speedMult * dt;
      }
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
    this.activated = true;
  }

  get isDead() {
    return this.health <= 0;
  }

  draw(ctx, camera) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const half = this.size / 2;
    const hasAffix = (id) => this.affixes?.includes(id);

    const isMiniBoss = this.enemyTier === "miniBoss" || this.isMiniBoss;
    const isElite = this.enemyTier === "elite" || this.isElite;

    if (hasAffix("phantom")) ctx.globalAlpha = 0.2;
    if (this._undyingRespawnTime != null) {
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 20;
    }
    if (hasAffix("weakening") && this.hitFlashTimer > 0) {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
    }

    let fillColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    if (isMiniBoss) {
      fillColor = this.hitFlashTimer > 0 ? "#ffffff" : "#a855f7";
    }

    if (isElite) {
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = fillColor;
    ctx.fillRect(sx, sy, this.size, this.size);
    if (isElite) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, this.size, this.size);
    } else if (isMiniBoss) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, this.size, this.size);
    } else {
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, this.size, this.size);
    }
    if (this._undyingRespawnTime != null || (hasAffix("weakening") && this.hitFlashTimer > 0)) ctx.shadowBlur = 0;

    if (hasAffix("martyr")) {
      ctx.strokeStyle = "rgba(80,60,40,0.8)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ax = sx + 4 + (i % 2) * (this.size - 8);
        const ay = sy + 4 + Math.floor(i / 2) * (this.size - 8);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + 6, ay + 6);
        ctx.lineTo(ax + 2, ay + 10);
        ctx.stroke();
      }
    }
    if (hasAffix("rooted")) {
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      const cx = sx + this.size / 2;
      const cy = sy + this.size;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx - 12, cy + 15);
      ctx.moveTo(cx + 8, cy);
      ctx.lineTo(cx + 12, cy + 15);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + 18);
      ctx.stroke();
    }
    if (hasAffix("regenerating")) {
      this._regenParticles = this._regenParticles || [];
      if (Math.random() < 0.3) this._regenParticles.push({ x: sx + this.size / 2 + (Math.random() - 0.5) * this.size, y: sy + this.size, life: 0.5 });
      this._regenParticles = this._regenParticles.filter((p) => {
        p.life -= 0.016;
        if (p.life <= 0) return false;
        ctx.fillStyle = `rgba(34,197,94,${p.life * 2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.life * 20, 3, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
    }
    if (hasAffix("swift") && this._swiftTrail) {
      for (let i = 0; i < this._swiftTrail.length; i++) {
        const t = this._swiftTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        ctx.fillStyle = `rgba(251,191,36,${0.15 * (i / this._swiftTrail.length)})`;
        ctx.fillRect(tsx, tsy, this.size, this.size);
      }
    }
    if (hasAffix("erratic") && this._erraticTrail) {
      for (let i = 0; i < this._erraticTrail.length; i++) {
        const t = this._erraticTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        ctx.fillStyle = `rgba(232,121,249,${0.2 * (1 - i / this._erraticTrail.length)})`;
        ctx.fillRect(tsx, tsy, this.size, this.size);
      }
    }
    if (hasAffix("evasive") && this._evasiveTrail) {
      for (let i = 0; i < this._evasiveTrail.length; i++) {
        const t = this._evasiveTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        ctx.fillStyle = `rgba(167,139,250,${0.2 * (i / this._evasiveTrail.length)})`;
        ctx.fillRect(tsx + 2, tsy + this.size - 4, 4, 4);
      }
    }
    if (hasAffix("auraBearer")) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      ctx.strokeStyle = "rgba(236,72,153,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 400, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (hasAffix("orbiting") && this._orbitingAngle != null) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      const orbRadius = 35;
      for (let i = 0; i < 4; i++) {
        const a = this._orbitingAngle + (i / 4) * Math.PI * 2;
        const ox = cx + Math.cos(a) * orbRadius;
        const oy = cy + Math.sin(a) * orbRadius;
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(ox, oy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (hasAffix("lasering")) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      const a = this._laserAngle ?? 0;
      const beamLen = 150;
      const bx = cx + Math.cos(a) * beamLen;
      const by = cy + Math.sin(a) * beamLen;
      ctx.strokeStyle = "rgba(6,182,212,0.7)";
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    if (hasAffix("volatile") && (this._volatileTimer ?? 0) > 1.2) {
      ctx.fillStyle = `rgba(249,115,22,${0.4 * Math.sin(this._volatileTimer * 20)})`;
      ctx.beginPath();
      ctx.arc(sx + this.size / 2, sy + this.size / 2, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hasAffix("phantom")) ctx.globalAlpha = 1;

    const barW = this.size;
    const barH = isMiniBoss ? 7 : 5;
    const barY = sy - (isMiniBoss ? 12 : 8);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(sx, barY, barW, barH);
    const pct = Math.max(0, this.health / this.maxHealth);
    const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
    ctx.fillStyle = hpColor;
    ctx.fillRect(sx, barY, Math.round(barW * pct), barH);
    if (isMiniBoss) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, barY, barW, barH);
    }

    if (this.affixes && this.affixes.length > 0) {
      const iconSize = 14;
      const iconY = barY - iconSize - 2;
      const totalW = this.affixes.length * (iconSize + 2);
      let iconX = sx + (barW - totalW) / 2 + iconSize / 2 + 1;
      this._affixRects = [];
      for (const affixId of this.affixes) {
        const def = getAffixDef(affixId);
        const rx = iconX - iconSize / 2 - 1;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(iconX, iconY + iconSize / 2, iconSize / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `${iconSize - 2}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def.icon, iconX, iconY + iconSize / 2);
        this._affixRects.push({ x: rx, y: iconY, w: iconSize + 2, h: iconSize + 2, name: def.name });
        iconX += iconSize + 2;
      }
    }
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
    const safeZoneEnd = this.world.width / 5;
    const minX = Math.max(margin, safeZoneEnd);
    const x = minX + Math.random() * (this.world.width - margin - minX);
    const y = margin + Math.random() * (this.world.height - margin * 2);
    return new Vec2(x, y);
  }

  spawnOne(forceTier = null, forceAffixIds = null, nearPosition = null) {
    let base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    if (this.hasCond("eliteSpawn")) {
      const idx = ENEMY_TYPES.findIndex((e) => e.name === base.name);
      base = ENEMY_TYPES[Math.min(idx + 1, ENEMY_TYPES.length - 1)] || base;
    }
    const tier = forceTier || (Math.random() < 0.79 ? "minion" : "elite");
    const s = this.mapDef.enemyScale || { hp: 1, attack: 1, speed: 1 };
    const tierMult = { minion: { hp: 0.5, atk: 1, xp: 0.7, size: 0.7 }, elite: { hp: 1, atk: 1.2, xp: 1.4, size: 1 }, miniBoss: { hp: 5, atk: 2, xp: 5, size: 1.4 } };
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
      pos = this.randomPosition(size);
    }
    const enemy = new Enemy(pos.x, pos.y, typeDef);
    enemy.worldBounds = { width: this.world.width, height: this.world.height };
    enemy.enemyTier = tier;
    enemy.tierXpMult = tm.xp;
    if (tier === "elite") enemy.isElite = true;
    if (tier === "miniBoss") enemy.isMiniBoss = true;
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
    this.enemies.push(enemy);
  }

  spawnBoss() {
    const margin = this.world.wallThickness + BOSS_SIZE + 40;
    const rightThirdStart = this.world.width * 0.6;
    const rightThirdEnd = this.world.width - margin;
    const x = rightThirdStart + Math.random() * (rightThirdEnd - rightThirdStart);
    const y = margin + Math.random() * (this.world.height - margin * 2);
    const pos = new Vec2(x, y);
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
      const count = 20 + Math.floor(Math.random() * 11);
      this.spawnOne("miniBoss");
      for (let i = 0; i < count - 1; i++) {
        this.spawnOne();
      }
    }
  }

  update(dt) {
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

// Rarity system: base stat by type, modifiers, names
const EQUIPMENT_BASE_STAT = {
  Helmet: "maxHealth",
  Weapon: "attack",
  Boots: "speed",
  "Body Armour": "defense"
};

const EQUIPMENT_BASE_NAMES = {
  Helmet: ["Leather Cap", "Cloth Hood", "Hide Cap", "Iron Helmet", "Steel Helmet", "Battle Helm", "Knight's Helm", "Dragon Helm"],
  Boots: ["Leather Boots", "Iron Greaves", "Steel Greaves", "Wind Boots", "Swift Boots", "Shadow Striders"],
  "Body Armour": ["Leather Armour", "Hide Armour", "Chainmail Vest", "Scale Armour", "Plate Armour", "Battle Plate", "Fortress Armour"],
  Weapon: ["Wooden Staff", "Iron Sword", "Steel Sword", "Battle Axe", "War Hammer", "Legendary Blade"]
};

const EQUIPMENT_BASE_RANGES = {
  Helmet: { min: 3, max: 25 },
  Weapon: { min: 4, max: 22 },
  Boots: { min: 35, max: 130 },
  "Body Armour": { min: 2, max: 12 }
};

const WEIGHT_OPTIONS = { Helmet: ["light", "medium", "heavy"], "Body Armour": ["light", "medium", "heavy"] };

const MODIFIER_POOL = [
  { id: "attackPercent", label: "Attack Damage", statKey: "attack" },
  { id: "attackSpeedPercent", label: "Attack Speed", statKey: "attackSpeed" },
  { id: "maxHealthPercent", label: "Max Health", statKey: "maxHealth" },
  { id: "defensePercent", label: "Defense", statKey: "defense" },
  { id: "speedPercent", label: "Movement Speed", statKey: "speed" },
  { id: "xpGainedPercent", label: "XP Gained", statKey: "xpGained" },
  { id: "skillDamagePercent", label: "Skill Damage", statKey: "skillDamage" },
  { id: "cooldownReductionPercent", label: "Cooldown Reduction", statKey: "cooldownRecovery" }
];

const NAME_PREFIXES = ["Twisted", "Cursed", "Blessed", "Ancient", "Rotten", "Void", "Storm", "Frost", "Flame", "Shadow"];
const NAME_SUFFIXES = ["of the Fox", "of the Bear", "of Power", "of Swiftness", "of the Titan", "of the Wolf", "of the Owl", "of the Serpent"];

const RARITY_COLORS = { common: "#e2e8f0", magic: "#60a5fa", rare: "#facc15", legendary: "#f97316" };

const LEGENDARY_CUBES = [
  { id: "eternalCube", label: "Eternal Cube", modifierId: "eternal", modifierLabel: "Eternal" },
  { id: "generativeCube", label: "Generative Cube", modifierId: "generative", modifierLabel: "Generative" },
  { id: "blessedCube", label: "Blessed Cube", modifierId: "blessed", modifierLabel: "Blessed" }
];

const LEGENDARY_MODIFIER_IDS = ["eternal", "generative", "blessed"];
const LEGENDARY_MODIFIER_EFFECTS = {
  eternal: "Returns to Legacy Vault on defeat.",
  generative: "Adds a T3 cube to Legacy Stash on boss kill.",
  blessed: "Grants random blessings on mini-boss kill."
};

const BLESSING_DEFS = [
  { id: "berserking", name: "Berserking", icon: "⚔️", color: "#ef4444", desc: "+50% damage" },
  { id: "vitality", name: "Vitality", icon: "❤️", color: "#22c55e", desc: "30 HP/s regen" },
  { id: "swiftness", name: "Swiftness", icon: "💨", color: "#3b82f6", desc: "+50% speed" },
  { id: "fortune", name: "Fortune", icon: "🍀", color: "#eab308", desc: "2× drop rates" },
  { id: "chaos", name: "Chaos", icon: "🌀", color: "#a855f7", desc: "Random projectiles" },
  { id: "aftershock", name: "Aftershock", icon: "💥", color: "#f97316", desc: "Enemies explode" }
];

// -------- Crafting Cubes --------

const MODIFIER_CUBE_TIERS = [
  { min: 0.1, max: 0.25 },
  { min: 0.2, max: 0.35 },
  { min: 0.3, max: 0.45 }
];

const MODIFIER_CUBES = [
  { id: "attackCube", label: "Attack Cube", modifierId: "attackPercent", modifierLabel: "Attack Damage" },
  { id: "speedCube", label: "Speed Cube", modifierId: "speedPercent", modifierLabel: "Movement Speed" },
  { id: "healthCube", label: "Health Cube", modifierId: "maxHealthPercent", modifierLabel: "Max Health" },
  { id: "defenseCube", label: "Defense Cube", modifierId: "defensePercent", modifierLabel: "Defense" },
  { id: "swiftnessCube", label: "Swiftness Cube", modifierId: "attackSpeedPercent", modifierLabel: "Attack Speed" },
  { id: "wisdomCube", label: "Wisdom Cube", modifierId: "xpGainedPercent", modifierLabel: "XP Gained" },
  { id: "powerCube", label: "Power Cube", modifierId: "skillDamagePercent", modifierLabel: "Skill Damage" },
  { id: "focusCube", label: "Focus Cube", modifierId: "cooldownReductionPercent", modifierLabel: "Cooldown Reduction" }
];

const UPGRADE_CUBES = [
  { id: "magicCube", label: "Magic Cube", targetRarity: "common", newRarity: "magic", addsModifiers: 2 },
  { id: "rareCube", label: "Rare Cube", targetRarity: "magic", newRarity: "rare", addsModifiers: 2 },
  { id: "reforgeCube", label: "Reforge Cube", targetRarity: null, rerolls: true }
];

function rollModifierForTier(tier) {
  const r = MODIFIER_CUBE_TIERS[tier - 1] || MODIFIER_CUBE_TIERS[0];
  return r.min + Math.random() * (r.max - r.min);
}

function getModifierPoolEntry(modifierId) {
  return MODIFIER_POOL.find((m) => m.id === modifierId) || MODIFIER_POOL.find((m) => `${m.statKey}Percent` === modifierId);
}

function getRarityRoll(lootQuality, qualityBonus) {
  const roll = Math.random();
  const bias = Math.min(1, lootQuality + GLOBAL_LUCK + qualityBonus);
  if (roll < 0.02 + bias * 0.08) return "rare";
  if (roll < 0.15 + bias * 0.25) return "magic";
  return "common";
}

function rollModifierValue() {
  return 0.1 + Math.random() * 0.4;
}

function generateEquipmentItem(type, lootQuality, qualityBonus = 0, forceRarity = null) {
  const rarity = forceRarity || getRarityRoll(lootQuality, qualityBonus);
  const baseKey = EQUIPMENT_BASE_STAT[type];
  const range = EQUIPMENT_BASE_RANGES[type];
  const scale = 0.4 + 0.6 * (0.5 + lootQuality / 2);
  const baseValue = Math.round(range.min + (range.max - range.min) * scale);
  const baseStat = { [baseKey]: baseValue };

  let weight = null;
  if (WEIGHT_OPTIONS[type]) {
    const opts = WEIGHT_OPTIONS[type];
    weight = opts[Math.floor(Math.random() * opts.length)];
  }

  const modifiers = [];
  if (rarity === "magic") {
    const pool = [...MODIFIER_POOL];
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: rollModifierValue() });
    }
  } else if (rarity === "rare") {
    const pool = [...MODIFIER_POOL];
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: rollModifierValue() });
    }
  }

  const baseNames = EQUIPMENT_BASE_NAMES[type];
  const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];

  let name;
  if (rarity === "common") {
    name = baseName;
  } else if (rarity === "magic") {
    if (Math.random() < 0.5) {
      name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${baseName}`;
    } else {
      name = `${baseName} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
    }
  } else {
    name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${baseName} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
  }

  const stats = { ...baseStat };
  for (const m of modifiers) {
    if (m.statKey === "attackSpeed") {
      stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
    } else if (m.statKey === "cooldownRecovery") {
      stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
    } else {
      const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
      stats[key] = (stats[key] || 0) + m.value;
    }
  }

  return {
    type,
    name,
    rarity,
    baseStat,
    weight,
    modifiers,
    stats
  };
}

const LOOT_DEFS = [
  {
    type: "Helmet",
    items: [] // Generated dynamically
  },
  {
    type: "Boots",
    items: []
  },
  {
    type: "Body Armour",
    items: []
  },
  {
    type: "Weapon",
    items: []
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

const LOOT_ICONS = {
  Helmet: "🪖",
  Boots: "👢",
  "Body Armour": "🛡️",
  Weapon: "⚔️",
  "Upgrade Card": "🃏"
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
    this.weight = definition.weight || null;
    this.rarity = definition.rarity || null;
    this.modifiers = definition.modifiers || [];
    this.baseStat = definition.baseStat || null;
    this.color = this.rarity ? RARITY_COLORS[this.rarity] : (LOOT_COLORS[this.type] || "#fbbf24");
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
    const icon = LOOT_ICONS[this.type] || "✨";

    ctx.save();
    ctx.translate(sx + half, sy + half);
    ctx.scale(pulse, pulse);

    if (this.rarity === "legendary") {
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18 + 4 * Math.sin(timeSeconds * 6);
    } else if (this.rarity === "magic") {
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 14;
    } else if (this.rarity === "rare") {
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 16;
    }

    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, half);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fill();

    if (this.rarity === "magic" || this.rarity === "rare") {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(this.size * 1.1)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, 0, 0);

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

    if (group.type === "Upgrade Card") {
      const card = group.items[Math.floor(Math.random() * group.items.length)];
      return {
        type: "Upgrade Card",
        name: card.name,
        stats: {},
        cardKey: card.cardKey,
        description: card.description,
        weight: null
      };
    }

    return generateEquipmentItem(group.type, this.mapLootQuality, qualityBonus);
  }

  spawnGuaranteedWeaponAt(centerX, centerY) {
    const def = generateEquipmentItem("Weapon", Math.min(1, this.mapLootQuality + 0.5), 0.5);
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

  spawnEquipmentAt(centerX, centerY, def) {
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
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
    this.activeAuras = new Set();
    this.whirlwindActive = false;
    this.bladeDashActive = false;
    this.bladeDashTimer = 0;
    this.bladeDashDirection = new Vec2(0, 0);
    this.bladeDashSpeed = 600;
    this.bladeDashMult = 0.8;
    this.bladeDashHitIds = new Set();
    this.earthquakeShakeUntil = 0;
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
      description: item.description || "",
      weight: item.weight || null,
      rarity: item.rarity || null,
      modifiers: item.modifiers || [],
      baseStat: item.baseStat || null
    }));
    this.cubeInventory = {};
    const stash = consumeLegacyCubeStash();
    for (const [key, count] of Object.entries(stash)) {
      this.cubeInventory[key] = (this.cubeInventory[key] || 0) + count;
    }
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

    this.devMode = !!runConfig.devMode;
    this.devStatsOverride = null;
    this.baseStats = {
      maxHealth: 100,
      defense: 0,
      speed: 220,
      attack: 10
    };
    if (!this.devMode) {
      if (hasTalent("thickSkin")) this.baseStats.maxHealth += 15;
      if (this.hasCondition("startHealth")) this.baseStats.maxHealth = Math.max(10, this.baseStats.maxHealth - 30);
      if (this.hasCondition("startAttack")) this.baseStats.attack = Math.round(this.baseStats.attack * 0.8);
      if (this.hasCondition("startSpeed")) this.baseStats.speed = Math.round(this.baseStats.speed * 0.8);
    }
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
    this.equipmentAttackSpeedMult = 1;
    this.equipmentCooldownRecovery = 1;
    this.equipmentXpGainedMult = 1;
    this.equipmentSkillDamageMult = 1;
    this.equipmentSpeedMult = 1;
    this.equipmentDashCooldownMult = 1;

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

    const margin = this.world.wallThickness + 60;
    const centerY = this.world.height / 2 - 24;
    this.player = new Player(margin, centerY);

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
    this.playerSlowUntil = 0;
    this.playerSlowMult = 1;
    this.playerBurnUntil = 0;
    this.playerBurnDamage = 0;
    this.playerWeakenUntil = 0;
    this.playerSlowUntil = 0;
    this.playerBurnUntil = 0;
    this.playerBurnDmg = 0;
    this.playerCursedWeakenUntil = 0;
    this.lastDamagingEnemy = null;

    this.mapNameEl = document.getElementById("map-name");
    this.enemyCountEl = document.getElementById("enemy-count");
    this.xpBarFillEl = document.getElementById("xp-bar-fill");
    this.xpLabelEl = document.getElementById("xp-label");
    this.playerLevelEl = document.getElementById("player-level");

    // Player projectile state
    this.playerProjectiles = [];
    this.playerAttackCooldown = 0.6;
    this.playerAttackTimer = 0;
    this.doubleStrikeCounter = 0;

    this.exitTransitionCooldown = 0;
    this.victoryPortal = null;
    this.victoryPortalTimer = 0;
    this.activeBlessings = [];

    this.dashDuration = 0.3;
    this.dashInvincibleStart = 0.1;
    this.dashInvincibleDuration = 0.1;
    this.baseDashCooldownTime = 0.8;
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
    this.inventoryOverlayOpen = false;
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

    const inventoryBtn = document.getElementById("inventory-button");
    if (inventoryBtn) {
      inventoryBtn.addEventListener("click", () => {
        if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
        else this.showInventoryOverlay();
      });
    }

    const inventoryCloseBtn = document.getElementById("inventory-overlay-close");
    if (inventoryCloseBtn) {
      inventoryCloseBtn.addEventListener("click", () => this.closeInventoryOverlay());
    }

    this.craftingSelectedItem = null;
    this.craftingSelectedCube = null;
    this.craftingItemSource = null;
    this._craftingPreviewFadeTimer = null;

    const tabItems = document.getElementById("inventory-tab-items");
    const tabCrafting = document.getElementById("inventory-tab-crafting");
    const contentItems = document.getElementById("inventory-overlay-items");
    const contentCrafting = document.getElementById("inventory-overlay-crafting");
    if (tabItems && tabCrafting) {
      tabItems.addEventListener("click", () => {
        tabItems.classList.add("active");
        tabCrafting.classList.remove("active");
        if (contentItems) contentItems.classList.remove("hidden");
        if (contentCrafting) contentCrafting.classList.add("hidden");
      });
      tabCrafting.addEventListener("click", () => {
        tabCrafting.classList.add("active");
        tabItems.classList.remove("active");
        if (contentCrafting) contentCrafting.classList.remove("hidden");
        if (contentItems) contentItems.classList.add("hidden");
        this.populateCraftingTab();
      });
    }

    const craftConfirm = document.getElementById("crafting-confirm");
    if (craftConfirm) {
      craftConfirm.addEventListener("click", () => this.executeCraft());
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "i" || e.key === "I") {
        if (!e.repeat && !this.gameOver && !this.levelUpChoices && !this.currentEvent) {
          if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
          else this.showInventoryOverlay();
        }
        return;
      }
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
      this.updateAffixTooltip(e.clientX, e.clientY);
    });
    this.canvas.addEventListener("mouseleave", () => this.hideAffixTooltip());
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
    const devGiveAllCubesEl = document.getElementById("dev-give-all-cubes");
    if (devGiveAllCubesEl) {
      devGiveAllCubesEl.addEventListener("click", () => this.handleDevGiveAllCubes());
    }
    const devRandomItemEl = document.getElementById("dev-random-item");
    if (devRandomItemEl) {
      devRandomItemEl.addEventListener("click", () => this.handleDevRandomItem());
    }
    if (this.devMaxStatsEl) {
      this.devMaxStatsEl.addEventListener("click", () => this.handleDevMaxStats());
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
      devSpawnEliteBtn.addEventListener("click", () => {
        const affixId = devAffixSelect?.value;
        if (!affixId) return;
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        this.enemySystem.spawnOne("elite", [affixId], { x: px, y: py });
      });
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
      this.initDevStatsSliders();
    } else {
      this.devPanelEl.classList.add("dev-panel-hidden");
    }
  }

  restartGame() {
    window.location.reload();
  }

  togglePause() {
    if (this.gameOver) return;
    if (this.inventoryOverlayOpen) {
      this.closeInventoryOverlay();
      return;
    }
    this.paused = !this.paused;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = this.paused ? "▶ Resume" : "⏸ Pause";
      this.pauseToggleEl.classList.toggle("paused", this.paused);
    }
  }

  showInventoryOverlay() {
    if (this.gameOver || this.levelUpChoices || this.currentEvent) return;
    this.inventoryOverlayOpen = true;
    this.paused = true;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "▶ Resume";
      this.pauseToggleEl.classList.add("paused");
    }
    const overlay = document.getElementById("inventory-overlay");
    if (overlay) overlay.classList.remove("hidden");
    this.populateInventoryOverlay();
  }

  closeInventoryOverlay() {
    this.inventoryOverlayOpen = false;
    this.paused = false;
    if (this._craftingPreviewFadeTimer) {
      clearInterval(this._craftingPreviewFadeTimer);
      this._craftingPreviewFadeTimer = null;
    }
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "⏸ Pause";
      this.pauseToggleEl.classList.remove("paused");
    }
    const overlay = document.getElementById("inventory-overlay");
    if (overlay) overlay.classList.add("hidden");
    hideItemTooltip();
  }

  populateInventoryOverlay() {
    const equippedList = document.getElementById("inventory-overlay-equipped-list");
    const cardsList = document.getElementById("inventory-overlay-cards-list");
    const invList = document.getElementById("inventory-overlay-inventory-list");
    if (!equippedList || !cardsList || !invList) return;

    equippedList.innerHTML = "";
    const slots = ["Helmet", "Body Armour", "Weapon", "Boots"];
    for (const slot of slots) {
      const li = document.createElement("li");
      const item = this.equipment[slot];
      if (item) {
        const color = getItemRarityColor(item);
        const baseKey = EQUIPMENT_BASE_STAT[slot];
        const baseVal = item.stats?.[baseKey] ?? 0;
        if (item.rarity === "legendary") li.classList.add("item-legendary");
        li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (+${baseVal})`;
      } else {
        li.textContent = `${slot}: None`;
      }
      if (item) {
        li.dataset.hasItem = "1";
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        li.addEventListener("click", () => {
          if (item) {
            this.inventory.push(item);
            this.equipment[slot] = null;
            this.updateInventoryUI();
            this.updateEquippedUI();
            this.populateInventoryOverlay();
            this.recalculateStats();
          }
        });
      } else {
        li.classList.add("inventory-overlay-empty");
      }
      equippedList.appendChild(li);
    }

    const cardsTitle = document.getElementById("inventory-overlay-cards-title");
    if (cardsTitle) cardsTitle.textContent = `Upgrade Cards (${this.activeUpgradeCards.length}/${this.maxUpgradeCards})`;

    cardsList.innerHTML = "";
    if (this.activeUpgradeCards.length === 0) {
      const li = document.createElement("li");
      li.className = "inventory-overlay-empty";
      li.textContent = "No upgrade cards equipped";
      cardsList.appendChild(li);
    } else {
      for (const card of this.activeUpgradeCards) {
        const li = document.createElement("li");
        li.textContent = card.name;
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, card, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        li.addEventListener("click", () => {
          const idx = this.activeUpgradeCards.indexOf(card);
          if (idx >= 0) {
            this.inventory.push(card);
            this.activeUpgradeCards.splice(idx, 1);
            this.updateInventoryUI();
            this.updateUpgradeCardsUI();
            this.populateInventoryOverlay();
            this.recalculateStats();
          }
        });
        cardsList.appendChild(li);
      }
    }

    invList.innerHTML = "";
    if (this.inventory.length === 0) {
      const li = document.createElement("li");
      li.className = "inventory-overlay-empty";
      li.textContent = "No items in inventory";
      invList.appendChild(li);
    } else {
      for (const item of this.inventory) {
        const li = document.createElement("li");
        if (item.type !== "Upgrade Card") {
          const color = getItemRarityColor(item);
          const baseKey = EQUIPMENT_BASE_STAT[item.type];
          const baseVal = item.stats?.[baseKey] ?? 0;
          if (item.rarity === "legendary") li.classList.add("item-legendary");
          li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (${escapeHtml(item.type)}) +${baseVal}`;
        } else {
          li.textContent = item.name;
        }
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        li.addEventListener("click", () => this.handleInventoryItemClick(item));
        invList.appendChild(li);
      }
    }
    this.populateCraftingTab();
  }

  getCraftableEquipmentItems() {
    const items = [];
    for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
      const item = this.equipment[slot];
      if (item && item.rarity !== "legendary") items.push({ item, source: "equipped", slot });
    }
    for (let i = 0; i < this.inventory.length; i++) {
      const item = this.inventory[i];
      if (item.type !== "Upgrade Card" && item.rarity !== "legendary" && (item.type === "Helmet" || item.type === "Body Armour" || item.type === "Weapon" || item.type === "Boots")) {
        items.push({ item, source: "inventory", index: i });
      }
    }
    return items;
  }

  populateCraftingTab() {
    const grid = document.getElementById("cube-inventory-grid");
    const itemList = document.getElementById("crafting-item-list");
    if (!grid || !itemList) return;

    grid.innerHTML = "";
    const allCubes = [];
    for (const cube of MODIFIER_CUBES) {
      for (let t = 1; t <= 3; t++) {
        allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
      }
    }
    for (const cube of UPGRADE_CUBES) {
      for (let t = 1; t <= 3; t++) {
        allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
      }
    }
    for (const cube of LEGENDARY_CUBES) {
      allCubes.push({ ...cube, tier: null, key: cube.id });
    }
    const ownedCubes = allCubes.filter((c) => (this.cubeInventory[c.key] || 0) > 0);
    for (const c of ownedCubes) {
      const count = this.cubeInventory[c.key] || 0;
      const div = document.createElement("div");
      div.className = `cube-slot ${c.tier ? `tier-${c.tier}` : "tier-legendary"} ${this.craftingSelectedCube === c.key ? "selected" : ""}`;
      div.dataset.cubeKey = c.key;
      const icon = c.tier ? (c.id.includes("magic") ? "◆" : c.id.includes("rare") ? "✦" : c.id.includes("reforge") ? "◇" : "▪") : "◆";
      const tierLabel = c.tier ? ` T${c.tier}` : "";
      div.innerHTML = `
        <span class="cube-icon">${icon}${tierLabel}</span>
        <span class="cube-slot-name">${escapeHtml(c.label)}</span>
        <span class="cube-slot-count">×${count}</span>
      `;
      div.addEventListener("click", () => this.selectCraftingCube(c.key));
      grid.appendChild(div);
    }

    itemList.innerHTML = "";
    const craftables = this.getCraftableEquipmentItems();
    for (const { item, source, slot, index } of craftables) {
      const li = document.createElement("li");
      const color = getItemRarityColor(item);
      const baseKey = EQUIPMENT_BASE_STAT[item.type];
      const baseVal = item.stats?.[baseKey] ?? 0;
      const loc = source === "equipped" ? `${slot}` : "Inventory";
      if (item.rarity === "legendary") li.classList.add("item-legendary");
      li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (+${baseVal}) [${loc}]`;
      li.classList.toggle("selected", this.craftingSelectedItem === item && this.craftingItemSource?.source === source && (source === "inventory" ? this.craftingItemSource.index === index : this.craftingItemSource.slot === slot));
      li.addEventListener("click", () => this.selectCraftingItem(item, source, slot, index));
      li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
      li.addEventListener("mouseleave", hideItemTooltip);
      itemList.appendChild(li);
    }

    this.updateCraftingPreview();
  }

  selectCraftingItem(item, source, slot, index) {
    this.craftingSelectedItem = item;
    this.craftingItemSource = { source, slot, index };
    this.populateCraftingTab();
  }

  selectCraftingCube(cubeKey) {
    if ((this.cubeInventory[cubeKey] || 0) === 0) return;
    this.craftingSelectedCube = cubeKey;
    this.populateCraftingTab();
  }

  updateCraftingPreview() {
    const itemEl = document.getElementById("crafting-selected-item");
    const cubeEl = document.getElementById("crafting-selected-cube");
    const statsEl = document.getElementById("crafting-item-stats");
    const previewEl = document.getElementById("crafting-preview");
    const confirmBtn = document.getElementById("crafting-confirm");
    if (!itemEl || !cubeEl || !previewEl || !confirmBtn) return;

    if (this.craftingSelectedItem) {
      itemEl.textContent = this.craftingSelectedItem.name;
      itemEl.classList.add("has-item");
      if (statsEl) {
        if (this.craftingSelectedItem.type === "Upgrade Card") {
          statsEl.innerHTML = "";
          statsEl.classList.add("hidden");
        } else {
          statsEl.innerHTML = buildItemTooltipContent(this.craftingSelectedItem, null);
          statsEl.classList.remove("hidden");
        }
      }
    } else {
      itemEl.textContent = "No item selected";
      itemEl.classList.remove("has-item");
      if (statsEl) {
        statsEl.innerHTML = "";
        statsEl.classList.add("hidden");
      }
    }

    if (this.craftingSelectedCube) {
      const tierMatch = this.craftingSelectedCube.match(/T(\d)$/);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
      const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => `${c.id}T${tier}` === this.craftingSelectedCube || this.craftingSelectedCube.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube === `${c.id}T${tier}`);
      const cubeLabel = legCube ? legCube.label : (modCube ? `${modCube.label} T${tier}` : (upgCube ? `${upgCube.label} T${tier}` : this.craftingSelectedCube));
      cubeEl.textContent = cubeLabel;
      cubeEl.classList.add("has-cube");
    } else {
      cubeEl.textContent = "No cube selected";
      cubeEl.classList.remove("has-cube");
    }

    let preview = "";
    let canCraft = false;
    if (this.craftingSelectedItem && this.craftingSelectedCube) {
      const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
      const [cubeId, tierStr] = this.craftingSelectedCube.match(/(.+)T(\d)$/)?.slice(1) || [null, "1"];
      const tier = parseInt(tierStr || "1", 10);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));

      if (legCube) {
        const item = this.craftingSelectedItem;
        if (item.type === "Upgrade Card") {
          preview = "Legendary cubes can only be used on equipment.";
        } else if (item.rarity !== "rare") {
          preview = "Legendary cubes can only be used on Rare (Yellow) items.";
        } else {
          preview = `Upgrades to Legendary and replaces one modifier with ${legCube.modifierLabel}.`;
          canCraft = true;
        }
      } else if (modCube) {
        const item = this.craftingSelectedItem;
        if (item.type === "Upgrade Card") {
          preview = "Modifier cubes can only be used on equipment.";
        } else if (item.rarity === "common" || !item.rarity) {
          preview = "Modifier cubes can only be used on Magic or Rare items. Use a Magic Cube first.";
        } else {
          const existing = item.modifiers?.find((m) => m.id === modCube.modifierId);
          const maxMods = item.rarity === "common" ? 0 : item.rarity === "magic" ? 2 : 4;
          const currentCount = item.modifiers?.length || 0;
          const r = MODIFIER_CUBE_TIERS[tier - 1] || MODIFIER_CUBE_TIERS[0];
          const range = (r.min * 100).toFixed(0) + "-" + (r.max * 100).toFixed(0) + "%";
          if (existing) {
            preview = `Replaces ${modCube.modifierLabel} with new value (${range}).`;
          } else if (currentCount < maxMods) {
            preview = `Adds ${modCube.modifierLabel} (${range}).`;
          } else {
            preview = `Replaces a random modifier with ${modCube.modifierLabel} (${range}).`;
          }
          canCraft = true;
        }
      } else if (upgCube) {
        const item = this.craftingSelectedItem;
        if (item.type === "Upgrade Card") {
          preview = "Upgrade cubes can only be used on equipment.";
        } else if (upgCube.id === "magicCube" && item.rarity !== "common") {
          preview = "Magic Cube can only be used on White (common) items.";
        } else if (upgCube.id === "rareCube" && item.rarity !== "magic") {
          preview = "Rare Cube can only be used on Blue (magic) items.";
        } else if (upgCube.id === "reforgeCube" && (item.rarity === "common" || !item.rarity)) {
          preview = "Reforge Cube can only be used on Blue or Yellow items.";
        } else {
          if (upgCube.id === "magicCube") preview = "Upgrades to Blue and adds 2 random modifiers.";
          else if (upgCube.id === "rareCube") preview = "Upgrades to Yellow and adds 2 more modifiers.";
          else preview = "Rerolls all modifiers with new random values.";
          canCraft = true;
        }
      }
    }
    previewEl.textContent = preview;
    previewEl.classList.toggle("hidden", !preview);
    confirmBtn.disabled = !canCraft;
  }

  executeCraft() {
    if (!this.craftingSelectedItem || !this.craftingSelectedCube) return;
    const cubeKey = this.craftingSelectedCube;
    const count = this.cubeInventory[cubeKey] || 0;
    if (count === 0) return;

    const tier = parseInt(cubeKey.match(/T(\d)$/)?.[1] || "1", 10);
    const legCube = LEGENDARY_CUBES.find((c) => c.id === cubeKey);
    const modCube = !legCube && MODIFIER_CUBES.find((c) => cubeKey.startsWith(c.id));
    const upgCube = !legCube && UPGRADE_CUBES.find((c) => cubeKey.startsWith(c.id));

    if (legCube) {
      const item = this.craftingSelectedItem;
      if (item.rarity !== "rare") return;
      this.applyLegendaryCube(item, legCube);
    } else if (modCube) {
      const item = this.craftingSelectedItem;
      if (item.rarity === "common" || !item.rarity) return;
      this.applyModifierCube(item, modCube, tier);
    } else if (upgCube) {
      this.applyUpgradeCube(this.craftingSelectedItem, upgCube, tier);
    }

    this.cubeInventory[cubeKey] = count - 1;
    if (this.cubeInventory[cubeKey] === 0) delete this.cubeInventory[cubeKey];
    this.craftingSelectedCube = null;
    this.recalculateStats();
    this.updateEquippedUI();
    this.populateInventoryOverlay();
    this.populateCraftingTab();
    if (this._craftingPreviewFadeTimer) clearInterval(this._craftingPreviewFadeTimer);
    this._craftingPreviewFadeTimer = setInterval(() => {
      this.updateCraftingPreview();
    }, 500);
    setTimeout(() => {
      if (this._craftingPreviewFadeTimer) {
        clearInterval(this._craftingPreviewFadeTimer);
        this._craftingPreviewFadeTimer = null;
      }
    }, 10000);
  }

  applyModifierCube(item, cubeDef, tier) {
    item.modifiers = item.modifiers || [];
    const value = rollModifierForTier(tier);
    const poolEntry = MODIFIER_POOL.find((m) => m.id === cubeDef.modifierId);
    const modEntry = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: poolEntry?.statKey || cubeDef.modifierId.replace("Percent", ""), value, addedAt: Date.now() };

    const existingIdx = item.modifiers.findIndex((m) => m.id === cubeDef.modifierId);
    const maxMods = item.rarity === "magic" ? 2 : item.rarity === "rare" ? 4 : 0;
    if (existingIdx >= 0) {
      item.modifiers[existingIdx] = { ...modEntry };
    } else if (item.modifiers.length < maxMods) {
      item.modifiers.push(modEntry);
    } else {
      const replaceIdx = Math.floor(Math.random() * item.modifiers.length);
      item.modifiers[replaceIdx] = modEntry;
    }
    this.rebuildItemStats(item);
  }

  applyLegendaryCube(item, cubeDef) {
    if (item.rarity !== "rare") return;
    item.rarity = "legendary";
    const mods = item.modifiers || [];
    if (mods.length > 0) {
      const idx = Math.floor(Math.random() * mods.length);
      mods[idx] = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 };
    } else {
      item.modifiers = [{ id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 }];
    }
    this.rebuildItemStats(item);
  }

  applyUpgradeCube(item, cubeDef, tier) {
    if (cubeDef.id === "magicCube") {
      item.rarity = "magic";
      item.modifiers = item.modifiers || [];
      const pool = [...MODIFIER_POOL];
      for (let i = 0; i < 2; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = rollModifierForTier(tier);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
      const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
      const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
      if (!hasPrefix && !hasSuffix) {
        if (Math.random() < 0.5) {
          item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
        } else {
          item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
        }
      }
    } else if (cubeDef.id === "rareCube") {
      item.rarity = "rare";
      item.modifiers = item.modifiers || [];
      const pool = [...MODIFIER_POOL].filter((p) => !item.modifiers.some((m) => m.id === p.id));
      for (let i = 0; i < 2; i++) {
        if (pool.length === 0) break;
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = rollModifierForTier(tier);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
      const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
      const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
      if (!hasPrefix) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
      if (!hasSuffix) item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
    } else if (cubeDef.id === "reforgeCube") {
      item.modifiers = [];
      const pool = [...MODIFIER_POOL];
      const count = item.rarity === "magic" ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = rollModifierForTier(tier);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
    }
    this.rebuildItemStats(item);
  }

  rebuildItemStats(item) {
    const baseKey = EQUIPMENT_BASE_STAT[item.type];
    if (!item.baseStat && item.stats) {
      item.baseStat = { [baseKey]: item.stats[baseKey] ?? 0 };
    }
    const baseVal = item.baseStat?.[baseKey] ?? item.stats?.[baseKey] ?? 0;
    const stats = { [baseKey]: baseVal };
    for (const m of item.modifiers || []) {
      if (LEGENDARY_MODIFIER_IDS.includes(m.id)) continue;
      if (m.statKey === "attackSpeed") {
        stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
      } else if (m.statKey === "cooldownRecovery") {
        stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
      } else {
        const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
        stats[key] = (stats[key] || 0) + m.value;
      }
    }
    item.stats = stats;
  }

  showGameOver() {
    this.gameOver = true;
    const eternalItems = [];
    const hasEternal = (item) => item?.modifiers?.some((m) => m.id === "eternal");
    for (const [slot, item] of Object.entries(this.equipment)) {
      if (item && hasEternal(item)) eternalItems.push({ item: JSON.parse(JSON.stringify(item)), source: "equipped", slot });
    }
    for (const item of this.inventory) {
      if (item && item.type !== "Upgrade Card" && hasEternal(item)) eternalItems.push({ item: JSON.parse(JSON.stringify(item)), source: "inventory" });
    }
    if (eternalItems.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem(ETERNAL_ITEMS_ON_DEFEAT_KEY) || "[]");
        existing.push(...eternalItems.map((e) => e.item));
        localStorage.setItem(ETERNAL_ITEMS_ON_DEFEAT_KEY, JSON.stringify(existing));
      } catch (_) {}
    }
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
      cubeInventory: JSON.parse(JSON.stringify(this.cubeInventory)),
      stats: { ...this.currentStats },
      savedAt: Date.now()
    };
    const saved = loadSavedCharacters();
    saved.push(saveData);
    localStorage.setItem("spaceShooter_characters", JSON.stringify(saved));
    if (hasTalent("conqueror") && this.difficulty >= 4) {
      const def = this.lootSystem.getLootDefinition(0.9);
      addConquerorBonusItem({ name: def.name, type: def.type, stats: def.stats || {}, weight: def.weight || null });
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
    if (this.whirlwindActive) effectiveSpeed *= 0.5;
    effectiveSpeed *= this.equipmentSpeedMult || 1;
    if (this.hasBlessing("swiftness")) effectiveSpeed *= 1.5;
    if (this.playerSlowUntil > this.time) effectiveSpeed *= (this.playerSlowMult ?? 0.7);
    this.player.speed = effectiveSpeed;

    if (this.playerBurnUntil > this.time) {
      this.playerBurnAccum = (this.playerBurnAccum ?? 0) + dt;
      if (this.playerBurnAccum >= 0.5) {
        this.playerBurnAccum = 0;
        this.onPlayerDamaged(this.playerBurnDmg || 4, false);
      }
    } else this.playerBurnAccum = 0;

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
    } else if (this.bladeDashActive) {
      this.bladeDashTimer -= dt;
      const margin = this.world.wallThickness;
      const moveDist = this.bladeDashSpeed * dt;
      let nx = this.player.position.x + this.bladeDashDirection.x * moveDist;
      let ny = this.player.position.y + this.bladeDashDirection.y * moveDist;
      nx = Math.max(margin, Math.min(nx, this.world.width - margin - this.player.size));
      ny = Math.max(margin, Math.min(ny, this.world.height - margin - this.player.size));
      this.player.position.set(nx, ny);
      const cx = this.player.position.x + this.player.size / 2;
      const cy = this.player.position.y + this.player.size / 2;
      const hit = this.enemiesInRadius(cx, cy, 40);
      for (const e of hit) {
        if (!this.bladeDashHitIds.has(e.id)) {
          this.bladeDashHitIds.add(e.id);
          this.dealDamageToEnemy(e, this.computeSkillDamage(e, this.bladeDashMult));
        }
      }
      if (this.bladeDashTimer <= 0) {
        this.bladeDashActive = false;
        this.bladeDashHitIds.clear();
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
    this.resolveCollisions();
    this.updateAuras(dt);

    if (this.exitTransitionCooldown > 0) this.exitTransitionCooldown -= dt;
    if (!this.victoryPortal) this.checkExits();
    this.checkVictoryPortal(dt);
    this.updateBlessings(dt);

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
    this.skillEffects = [];
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
    const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
    const type = types[Math.floor(Math.random() * types.length)];
    const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.5, 0.65);
    this.inventory.push({
      id: 50000 + Math.floor(Math.random() * 10000),
      name: def.name,
      type: def.type,
      stats: def.stats || {},
      cardKey: null,
      description: "",
      weight: def.weight,
      rarity: def.rarity,
      modifiers: def.modifiers || [],
      baseStat: def.baseStat || null
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
    enemy.worldBounds = { width: this.world.width, height: this.world.height };
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
      this.lootSystem.spawnBurstAt(cx, cy, 3, 0.5);
      this.grantXP(40);
    }
  }

  updateMapUI() {
    if (!this.mapNameEl) return;
    this.mapNameEl.textContent = `${this.currentMap.name} (Map ${this.currentMap.number})`;
    this.updateEnemyCountUI();
  }

  updateEnemyCountUI() {
    if (!this.enemyCountEl) return;
    const es = this.enemySystem;
    const count = es.enemies.length + (es.boss ? 1 : 0);
    this.enemyCountEl.textContent = `Enemies: ${count}`;
    this.enemyCountEl.classList.toggle("hidden", this.currentMap?.id === 4 && !es.boss);
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
    const mult = this.equipmentXpGainedMult ?? 1;
    this.xp += Math.round(amount * mult);
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

  updateAffixTooltip(clientX, clientY) {
    const tt = document.getElementById("affix-tooltip");
    if (!tt || !this.lastMouseWorld || !this.enemySystem) return;
    const viewX = this.lastMouseWorld.x - this.camera.position.x;
    const viewY = this.lastMouseWorld.y - this.camera.position.y;
    let hitEnemy = null;
    for (const enemy of this.enemySystem.enemies) {
      if (enemy.isDead) continue;
      const sx = enemy.position.x - this.camera.position.x;
      const sy = enemy.position.y - this.camera.position.y;
      const pad = 30;
      if (viewX >= sx - 5 && viewX <= sx + enemy.size + 5 &&
          viewY >= sy - pad && viewY <= sy + enemy.size + 5) {
        hitEnemy = enemy;
        break;
      }
    }
    if (hitEnemy && hitEnemy.affixes?.length > 0) {
      const names = hitEnemy.affixes.map((id) => (getAffixDef(id).name)).join(", ");
      tt.textContent = names;
      tt.classList.remove("hidden");
      tt.style.left = (clientX + 12) + "px";
      tt.style.top = (clientY + 12) + "px";
    } else {
      tt.classList.add("hidden");
    }
  }

  hideAffixTooltip() {
    const tt = document.getElementById("affix-tooltip");
    if (tt) tt.classList.add("hidden");
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
    let atkSpdMult = (this.levelAttackSpeedMult || 1) * (this.equipmentAttackSpeedMult || 1);
    if (this.playerWeakenUntil > this.time) atkSpdMult *= 0.9;
    let effectiveCooldown = this.playerAttackCooldown / atkSpdMult;
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
        if (enemy._undyingRespawnTime && this.time < enemy._undyingRespawnTime) continue;
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

  updateEnemyAffixes(dt, enemy) {
    const has = (id) => enemy.affixes?.includes(id);
    const es = this.enemySystem;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;

    if (has("volatile")) {
      enemy._volatileTimer = (enemy._volatileTimer ?? 0) + dt;
      if (enemy._volatileTimer >= 1.5) {
        enemy._volatileTimer = 0;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
          const speed = 120;
          const proj = new Projectile(ex, ey, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, 8, "#f97316");
          es.projectiles.push(proj);
        }
      }
    }

    if (has("regenerating") && !enemy.isDead) {
      const regen = enemy.maxHealth * 0.02 * dt;
      enemy.health = Math.min(enemy.maxHealth, enemy.health + regen);
    }

    if (has("auraBearer")) {
      const auraRadius = 800;
      for (const other of es.enemies) {
        if (other === enemy || other.isDead) continue;
        const dx = (other.position.x + other.size / 2) - ex;
        const dy = (other.position.y + other.size / 2) - ey;
        if (dx * dx + dy * dy <= auraRadius * auraRadius) {
          other._auraBuffed = true;
        }
      }
    }

    if (has("orbiting")) {
      enemy._orbitingAngle = (enemy._orbitingAngle ?? 0) + dt * 3;
      const orbRadius = 35;
      const orbCount = 4;
      for (let i = 0; i < orbCount; i++) {
        const a = enemy._orbitingAngle + (i / orbCount) * Math.PI * 2;
        const ox = ex + Math.cos(a) * orbRadius;
        const oy = ey + Math.sin(a) * orbRadius;
        const orbSize = 10;
        if (Math.abs(px - ox) < orbSize + this.player.size / 2 && Math.abs(py - oy) < orbSize + this.player.size / 2) {
          this.onPlayerDamaged(4, true);
        }
      }
    }

    if (has("lasering")) {
      enemy._laserAngle = (enemy._laserAngle ?? 0) + dt * 1.5;
      const beamLen = 150;
      const beamW = 20;
      const bx = ex + Math.cos(enemy._laserAngle) * beamLen;
      const by = ey + Math.sin(enemy._laserAngle) * beamLen;
      const proj = { x1: ex, y1: ey, x2: bx, y2: by, w: beamW };
      const dist = pointToSegmentDist(px, py, proj.x1, proj.y1, proj.x2, proj.y2);
      if (dist < beamW) {
        this.onPlayerDamaged(3 * dt * 10, true);
      }
    }

    if (has("regenerating") && !enemy.isDead) {
      enemy.health = Math.min(enemy.maxHealth, enemy.health + 3 * dt);
    }
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
      for (const e of es.enemies) e._auraBuffed = false;
      for (const enemy of es.enemies) {
        enemy.update(dt, player, this.time, globalSlow, this.viewWidth / 4, this);
        this.updateEnemyAffixes(dt, enemy);
        if (enemy.intersects(player)) {
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.attackCooldown;
            this.lastDamagingEnemy = enemy;
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
        const martyrMinions = this.dropLootFromEnemy(enemy);
        minionSurviving.push(...(martyrMinions || []));
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
    for (const e of es.enemies) e._auraBuffed = false;
    for (const enemy of es.enemies) {
      enemy.update(dt, player, this.time, globalSlow, this.viewWidth / 4, this);
      this.updateEnemyAffixes(dt, enemy);

      if (enemy.intersects(player)) {
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackCooldown;
          this.lastDamagingEnemy = enemy;
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
        const martyrMinions = this.dropLootFromEnemy(enemy);
        surviving.push(...(martyrMinions || []));
      } else {
        surviving.push(enemy);
      }
    }

    es.enemies = surviving;
    es.update(dt);
    this.updateEnemyCountUI();
  }

  updateAuras(dt) {
    if (this.activeAuras.size === 0) return;
    const maxHp = this.currentStats.maxHealth;
    if (maxHp <= 0) return;

    let totalUpkeep = 0;
    for (const auraId of this.activeAuras) {
      const def = SKILL_DEFS.find((s) => s.id === auraId);
      if (def && def.auraUpkeep) totalUpkeep += def.auraUpkeep * maxHp * dt;
    }

    if (totalUpkeep > 0) {
      this.currentHealth -= totalUpkeep;
      if (this.currentHealth <= 0) {
        this.currentHealth = 0;
        this.activeAuras.clear();
        this.updateHealthBar();
        this.updateSkillUI();
        this.showGameOver();
        return;
      }
      this.updateHealthBar();
    }

    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const auraRadius = 100;

    if (this.activeAuras.has("frostAura")) {
      const hit = this.enemiesInRadius(px, py, auraRadius);
      for (const e of hit) {
        e.slowUntil = this.time + 0.5;
        e.slowMult = 0.75;
      }
    }
    if (this.activeAuras.has("flameAura")) {
      this.flameAuraAccum = (this.flameAuraAccum || 0) + dt;
      if (this.flameAuraAccum >= 0.2) {
        this.flameAuraAccum = 0;
        const hit = this.enemiesInRadius(px, py, auraRadius);
        const dmg = Math.max(1, Math.round(this.currentStats.attack * 0.2));
        for (const e of hit) this.dealDamageToEnemy(e, dmg);
      }
    }
    if (this.activeAuras.has("thunderAura")) {
      this.thunderAuraAccum = (this.thunderAuraAccum || 0) + dt;
      if (this.thunderAuraAccum >= 1.5) {
        this.thunderAuraAccum = 0;
        const target = this.getNearestEnemy(px, py, 200);
        if (target) {
          const dmg = this.computeSkillDamage(target, 0.6);
          this.dealDamageToEnemy(target, dmg);
        }
      }
    }
    if (this.activeAuras.has("voidAura")) {
      const hit = this.enemiesInRadius(px, py, auraRadius * 1.5);
      for (const e of hit) {
        const ex = e.position.x + e.size / 2;
        const ey = e.position.y + e.size / 2;
        const dx = px - ex;
        const dy = py - ey;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = 60 * dt;
        e.position.x += (dx / dist) * pull;
        e.position.y += (dy / dist) * pull;
      }
    }
  }

  dealDamageToEnemy(enemy, amount) {
    let dmg = Math.round(amount);
    if (this.playerInWeakeningPatch) dmg = Math.max(1, Math.round(dmg * 0.7));
    if (this.hasCondition("enemyResist")) dmg = Math.max(1, Math.round(dmg * 0.8));
    const has = (id) => enemy.affixes?.includes(id);

    if (has("weakening")) {
      this.playerWeakenUntil = this.time + 2;
    }

    if (has("rooted")) {
      const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
      const size = Math.round(base.size * 0.7);
      const offset = 25 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      const mx = enemy.position.x + enemy.size / 2 + Math.cos(angle) * offset - size / 2;
      const my = enemy.position.y + enemy.size / 2 + Math.sin(angle) * offset - size / 2;
      const typeDef = { ...base, maxHealth: Math.round(base.maxHealth * 0.4), attack: base.attack, speed: base.speed, size };
      const minion = new Enemy(mx, my, typeDef);
      minion.worldBounds = enemy.worldBounds;
      minion.activated = true;
      minion.isAffixMinion = true;
      this.enemySystem.enemies.push(minion);
    }

    enemy.takeDamage(dmg);

    if (enemy.isDead && has("undying") && !enemy._undyingUsed) {
      enemy._undyingUsed = true;
      enemy.health = Math.ceil(enemy.maxHealth * 0.5);
      enemy._undyingRespawnTime = this.time + 0.8;
    }

    if (enemy.isDead && this.hasBlessing("aftershock")) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const radius = Math.min(this.viewWidth, this.viewHeight) * 0.25;
      const aftershockDmg = Math.max(1, Math.round(enemy.maxHealth * 0.1));
      const hit = this.enemiesInRadius(ex, ey, radius);
      for (const e of hit) {
        if (e !== enemy && !e.isDead) this.dealDamageToEnemy(e, aftershockDmg);
      }
    }

    if (this.activeAuras.has("soulAura") && dmg > 0) {
      const heal = Math.round(dmg * 0.5);
      this.healPlayer(heal);
    }
  }

  computeSkillDamage(enemy, multiplier = 1) {
    const skillMult = this.equipmentSkillDamageMult ?? 1;
    let dmg = Math.round(this.currentStats.attack * multiplier * skillMult);
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
    let mult = (1 / (this.levelAttackSpeedMult || 1)) * (this.equipmentCooldownRecovery ?? 1);
    if (this.hasUpgradeCard("berserker")) {
      const ratio = this.currentStats.maxHealth > 0 ? this.currentHealth / this.currentStats.maxHealth : 1;
      mult *= Math.max(0.4, ratio);
    }
    return Math.min(1, mult * 1.2);
  }

  tryCastSkill(slot) {
    if (this.gameOver || this.paused || this.levelUpChoices) return;
    const skillId = this.skills[slot];
    if (!skillId) return;
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (def && def.category === "aura") {
      if (this.activeAuras.has(skillId)) {
        this.activeAuras.delete(skillId);
      } else {
        this.activeAuras.add(skillId);
      }
      this.updateSkillUI();
      return;
    }
    if (this.skillCooldowns[slot] > 0) return;
    this.executeSkill(skillId, slot);
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
    } else if (skillId === "bladeDash") {
      this.damageSkillsUsedThisRun.add("bladeDash");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.bladeDashActive = true;
      this.bladeDashTimer = 0.25;
      this.bladeDashHitIds.clear();
      this.bladeDashDirection.set(dx / dist, dy / dist);
      this.bladeDashSpeed = 600;
      this.bladeDashMult = 0.8;
      this.skillEffects.push({
        type: "bladeDash",
        x: px, y: py, dirX: dx / dist, dirY: dy / dist, t: 0, duration: 0.25,
        mult: 0.8, speed: 600
      });
    } else if (skillId === "whirlwind") {
      this.damageSkillsUsedThisRun.add("whirlwind");
      this.whirlwindActive = true;
      this.skillEffects.push({ type: "whirlwind", t: 0, duration: 2, mult: 0.4, radius: 80, hitInterval: 0.15 });
    } else if (skillId === "groundSlam") {
      this.damageSkillsUsedThisRun.add("groundSlam");
      this.skillEffects.push({
        type: "groundSlam",
        x: px, y: py, t: 0, duration: 0.2, mult: 1, radius: 120, knockback: 150
      });
    } else if (skillId === "bladeStorm") {
      this.damageSkillsUsedThisRun.add("bladeStorm");
      this.skillEffects.push({ type: "bladeStorm", x: px, y: py, t: 0, duration: 3, mult: 0.5, bladeCount: 8 });
    } else if (skillId === "earthquake") {
      this.damageSkillsUsedThisRun.add("earthquake");
      this.skillEffects.push({ type: "earthquake", t: 0, duration: 3, mult: 0.3, slowMult: 0.6, slowDuration: 3 });
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
      } else if (eff.type === "bladeDash") {
        if (eff.t >= eff.duration) continue;
        surviving.push(eff);
      } else if (eff.type === "whirlwind") {
        if (eff.t >= eff.duration) {
          this.whirlwindActive = false;
          continue;
        }
        eff.lastHit = eff.lastHit || 0;
        if (eff.t - eff.lastHit >= eff.hitInterval) {
          eff.lastHit = eff.t;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const hit = this.enemiesInRadius(px, py, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
        }
        surviving.push(eff);
      } else if (eff.type === "groundSlam") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
            const dx = e.position.x + e.size / 2 - eff.x;
            const dy = e.position.y + e.size / 2 - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            e.position.x += (dx / dist) * eff.knockback;
            e.position.y += (dy / dist) * eff.knockback;
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "bladeStorm") {
        if (eff.t >= eff.duration) continue;
        if (!eff.blades) {
          eff.blades = [];
          for (let i = 0; i < eff.bladeCount; i++) {
            const angle = (i / eff.bladeCount) * Math.PI * 2;
            eff.blades.push({ x: eff.x, y: eff.y, vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200, hitIds: new Set() });
          }
        }
        const margin = this.world.wallThickness;
        const w = this.world.width - margin * 2;
        const h = this.world.height - margin * 2;
        for (const b of eff.blades) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < margin || b.x > this.world.width - margin) b.vx *= -1;
          if (b.y < margin || b.y > this.world.height - margin) b.vy *= -1;
          b.x = Math.max(margin, Math.min(b.x, this.world.width - margin));
          b.y = Math.max(margin, Math.min(b.y, this.world.height - margin));
          const hit = this.enemiesInRadius(b.x, b.y, 25);
          for (const e of hit) {
            if (!b.hitIds.has(e.id)) {
              b.hitIds.add(e.id);
              this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
            }
          }
        }
        surviving.push(eff);
      } else if (eff.type === "legendaryBeam") {
        if (eff.t >= eff.duration) continue;
        surviving.push(eff);
      } else if (eff.type === "earthquake") {
        if (eff.t >= eff.duration) continue;
        this.earthquakeShakeUntil = this.time + 0.1;
        if (Math.floor(eff.t * 4) > Math.floor((eff.t - dt) * 4)) {
          const es = this.enemySystem;
          const all = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
          for (const e of all) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult));
            e.slowUntil = this.time + eff.slowDuration;
            e.slowMult = eff.slowMult;
          }
        }
        surviving.push(eff);
      }
    }
    this.skillEffects = surviving;
  }

  resolveSquareOverlap(a, b) {
    const ax1 = a.position.x, ay1 = a.position.y, asz = a.size;
    const bx1 = b.position.x, by1 = b.position.y, bsz = b.size;
    const ax2 = ax1 + asz, ay2 = ay1 + asz;
    const bx2 = bx1 + bsz, by2 = by1 + bsz;
    const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
    const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
    if (overlapX <= 0 || overlapY <= 0) return;
    const pushX = overlapX * 0.5;
    const pushY = overlapY * 0.5;
    const acx = ax1 + asz / 2, acy = ay1 + asz / 2;
    const bcx = bx1 + bsz / 2, bcy = by1 + bsz / 2;
    if (overlapX < overlapY) {
      if (acx < bcx) {
        a.position.x -= pushX;
        b.position.x += pushX;
      } else {
        a.position.x += pushX;
        b.position.x -= pushX;
      }
    } else {
      if (acy < bcy) {
        a.position.y -= pushY;
        b.position.y += pushY;
      } else {
        a.position.y += pushY;
        b.position.y -= pushY;
      }
    }
  }

  resolveCollisions() {
    const player = this.player;
    const es = this.enemySystem;
    const margin = this.world.wallThickness;
    const maxX = this.world.width - margin - player.size;
    const maxY = this.world.height - margin - player.size;

    const allEnemies = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
    const skipPlayerCollision = this.bladeDashActive;
    for (let iter = 0; iter < 2; iter++) {
      if (!skipPlayerCollision) {
        for (const enemy of allEnemies) {
          if (enemy.intersects(player)) this.resolveSquareOverlap(player, enemy);
        }
      }
      for (let i = 0; i < allEnemies.length; i++) {
        for (let j = i + 1; j < allEnemies.length; j++) {
          if (allEnemies[i].intersects(allEnemies[j])) this.resolveSquareOverlap(allEnemies[i], allEnemies[j]);
        }
      }
    }
    player.position.x = Math.max(margin, Math.min(player.position.x, maxX));
    player.position.y = Math.max(margin, Math.min(player.position.y, maxY));
    for (const e of allEnemies) {
      const emaxX = this.world.width - margin - e.size;
      const emaxY = this.world.height - margin - e.size;
      e.position.x = Math.max(margin, Math.min(e.position.x, emaxX));
      e.position.y = Math.max(margin, Math.min(e.position.y, emaxY));
    }
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

  drawAuraEffects(ctx) {
    if (this.activeAuras.size === 0) return;
    const px = this.player.position.x + this.player.size / 2 - this.camera.position.x;
    const py = this.player.position.y + this.player.size / 2 - this.camera.position.y;
    const AURA_COLORS = {
      frostAura: "rgba(147, 197, 253, 0.4)",
      flameAura: "rgba(251, 146, 60, 0.5)",
      thunderAura: "rgba(253, 224, 71, 0.4)",
      barrierAura: "rgba(96, 165, 250, 0.35)",
      voidAura: "rgba(139, 92, 246, 0.45)",
      soulAura: "rgba(192, 132, 252, 0.5)"
    };
    const radius = 90 + Math.sin(this.time * 3) * 5;
    for (const auraId of this.activeAuras) {
      const color = AURA_COLORS[auraId] || "rgba(255,255,255,0.3)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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
      } else if (eff.type === "bladeDash" && this.bladeDashActive) {
        const sx = this.player.position.x + this.player.size / 2 + ox;
        const sy = this.player.position.y + this.player.size / 2 + oy;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.8 - eff.t / eff.duration * 0.5})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 20, sy - 20, 40, 40);
      } else if (eff.type === "whirlwind") {
        const sx = this.player.position.x + this.player.size / 2 + ox;
        const sy = this.player.position.y + this.player.size / 2 + oy;
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.5 + 0.2 * Math.sin(this.time * 15)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, eff.radius || 80, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eff.type === "groundSlam") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const expand = Math.min(1, eff.t / eff.duration) * (eff.radius || 120);
        ctx.strokeStyle = `rgba(120, 53, 15, ${0.7 - eff.t / eff.duration * 0.5})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, expand, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eff.type === "bladeStorm" && eff.blades) {
        for (const b of eff.blades) {
          const sx = b.x + ox; const sy = b.y + oy;
          ctx.fillStyle = `rgba(251, 191, 36, ${0.8})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (eff.type === "earthquake") {
        ctx.fillStyle = `rgba(120, 53, 15, ${0.1 * Math.sin(this.time * 20)})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "legendaryBeam") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const beamHeight = 200 + 50 * Math.sin(this.time * 8);
        const fade = 1 - eff.t / eff.duration;
        const grad = ctx.createLinearGradient(sx, sy, sx, sy - beamHeight);
        grad.addColorStop(0, `rgba(249, 115, 22, ${0.9 * fade})`);
        grad.addColorStop(0.3, `rgba(249, 115, 22, ${0.5 * fade})`);
        grad.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(sx - 15, sy - beamHeight, 30, beamHeight);
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
        let nameText = def ? def.name : "Empty";
        if (def && def.category === "aura" && this.activeAuras.has(skillId)) {
          nameText += ` (ON)`;
          if (def.auraUpkeep) nameText += ` -${(def.auraUpkeep * 100).toFixed(1)}% HP/s`;
        }
        if (nameEl) nameEl.textContent = nameText;
      }
      const cd = this.skillCooldowns[i] || 0;
      const baseCd = def ? def.baseCd : 1;
      const isAura = def && def.category === "aura";
      const pct = !isAura && baseCd > 0 ? Math.min(1, cd / (baseCd * this.getSkillCooldownMult())) : 0;
      if (cdEl) {
        cdEl.style.background = pct > 0 ? `conic-gradient(#374151 0deg, #374151 ${pct * 360}deg, transparent ${pct * 360}deg)` : "none";
      }
      slotEl.classList.toggle("aura-active", isAura && this.activeAuras.has(skillId));
    }
  }

  computePlayerDamage(enemy) {
    let dmg = this.currentStats.attack;
    if (this.playerCursedWeakenUntil > this.time) dmg = Math.round(dmg * 0.8);
    if (this.hasBlessing("berserking")) dmg = Math.round(dmg * 1.5);
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
            const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
            const type = types[Math.floor(Math.random() * types.length)];
            const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.5, 0.5);
            this.inventory.push({
              id: 60000 + Math.floor(Math.random() * 10000),
              name: def.name,
              type: def.type,
              stats: def.stats || {},
              cardKey: null,
              description: "",
              weight: def.weight,
              rarity: def.rarity,
              modifiers: def.modifiers || [],
              baseStat: def.baseStat || null
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
      const legDropChance = this.difficulty >= 4 ? 0.25 : 0.15;
      if (Math.random() < legDropChance) {
        const cube = LEGENDARY_CUBES[Math.floor(Math.random() * LEGENDARY_CUBES.length)];
        this.addCubeToInventory(cube.id);
        this.skillEffects.push({ type: "legendaryBeam", x: bx, y: by, t: 0, duration: 3 });
      }
      const hasGenerative = (item) => item?.modifiers?.some((m) => m.id === "generative");
      const allT3Cubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES].map((c) => `${c.id}T3`);
      for (const [slot, item] of Object.entries(this.equipment)) {
        if (item && hasGenerative(item)) {
          const cubeKey = allT3Cubes[Math.floor(Math.random() * allT3Cubes.length)];
          addToLegacyCubeStash(cubeKey);
        }
      }
      markDifficultyCompleted(this.difficulty);
      if (this.damageSkillsUsedThisRun.size === 1 && this.damageSkillsUsedThisRun.has("lightningBolt")) {
        setSkillUnlock("lightningOnlyRun", true);
      }
      es.boss = null;
      this.updateEnemyCountUI();
      const portalSize = 96;
      this.victoryPortal = { x: bx - portalSize / 2, y: by - portalSize / 2, w: portalSize, h: portalSize };
      this.victoryPortalTimer = 3;
    }
  }

  playerInVictoryPortal() {
    if (!this.victoryPortal) return false;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const p = this.victoryPortal;
    return px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h;
  }

  checkVictoryPortal(dt) {
    if (!this.victoryPortal) {
      const el = document.getElementById("victory-portal-countdown");
      if (el) el.classList.add("hidden");
      return;
    }
    if (this.playerInVictoryPortal()) {
      this.victoryPortalTimer -= dt;
      this.updateVictoryPortalUI();
      if (this.victoryPortalTimer <= 0) {
        this.showVictory();
        this.victoryPortal = null;
        const el = document.getElementById("victory-portal-countdown");
        if (el) el.classList.add("hidden");
      }
    } else {
      this.victoryPortalTimer = 3;
      this.updateVictoryPortalUI();
    }
  }

  updateVictoryPortalUI() {
    const el = document.getElementById("victory-portal-countdown");
    if (!el) return;
    if (!this.victoryPortal) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    const secs = Math.ceil(this.victoryPortalTimer);
    el.textContent = this.playerInVictoryPortal() ? `Enter portal: ${secs}` : "Stand in the portal to escape";
  }

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
  }

  dropLootFromEnemy(enemy) {
    if (enemy.isAffixMinion) return [];
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
        const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, 1, 0.8);
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
      return martyrMinions;
    }
    this.grantXPFromEnemy(enemy);
    this.tryDropCubeFromEnemy(enemy);

    const tier = enemy.enemyTier || (enemy.isMiniBoss ? "miniBoss" : enemy.isElite ? "elite" : "minion");
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
    const lootQual = this.currentMap?.lootQuality ?? 0.5;

    let dropMult = enemy.affixes?.includes("evasive") ? 2 : 1;
    if (this.hasBlessing("fortune")) dropMult *= 2;
    if (tier === "minion") {
      if (Math.random() < 0.05 * dropMult) {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, lootQual, 0, "common");
        this.lootSystem.spawnEquipmentAt(ex, ey, def);
      }
    } else if (tier === "elite") {
      if (Math.random() < 0.2 * dropMult) {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, Math.min(1, lootQual + 0.35), 0.3, "magic");
        this.lootSystem.spawnEquipmentAt(ex, ey, def);
      }
    } else if (tier === "miniBoss") {
      const type = types[Math.floor(Math.random() * types.length)];
      const def = generateEquipmentItem(type, 1, 0.8, "rare");
      this.lootSystem.spawnEquipmentAt(ex, ey, def);
      if (Math.random() < 0.1 * dropMult) {
        const type2 = types[Math.floor(Math.random() * types.length)];
        const def2 = generateEquipmentItem(type2, 1, 0.8, "rare");
        this.lootSystem.spawnEquipmentAt(ex + 25, ey, def2);
      }
    }

    const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
    if (baseType && hasTalent("battleHardened") && Math.random() < 0.1) {
      this.lootSystem.spawnGuaranteedWeaponAt(ex, ey);
    }
    if (hasTalent("jackpot") && !this.jackpotUsed) {
      this.jackpotUsed = true;
      this.lootSystem.spawnBurstAt(ex, ey, 1, 1);
    }
    return martyrMinions;
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
    if (fromEnemy && this.lastDamagingEnemy?._auraBuffed) rawAmount = Math.round(rawAmount * 1.2);
    if (fromEnemy && this.lastDamagingEnemy?.affixes?.includes("cursing")) {
      const roll = Math.random();
      if (roll < 0.25) { this.playerSlowUntil = this.time + 2; this.playerSlowMult = 0.7; }
      else if (roll < 0.5) { this.playerBurnUntil = this.time + 3; this.playerBurnDmg = 4; }
      else if (roll < 0.75) { this.playerCursedWeakenUntil = this.time + 2; }
      else { this.stunTimer = Math.max(this.stunTimer || 0, 0.5); }
    }
    if (this.hasUpgradeCard("glassCannon")) rawAmount = Math.round(rawAmount * 1.3);
    if (this.activeAuras.has("barrierAura")) rawAmount = Math.round(rawAmount * 0.85);

    // Ghost Step: invulnerability window
    if (this.hasUpgradeCard("ghostStep") && this.ghostStepTimer > 0) return;

    // Phoenix Strike: invulnerability
    if (this.phoenixInvulnUntil && this.time < this.phoenixInvulnUntil) return;

    // Dash: invulnerability at midpoint
    if (this.dashActive && this.dashTimer < 0.2 && this.dashTimer >= 0.1) return;

    // Blade Dash: full invulnerability
    if (this.bladeDashActive) return;

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

    if (this.earthquakeShakeUntil > this.time) {
      const shake = 4;
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    const scaleX = canvas.width / this.viewWidth;
    const scaleY = canvas.height / this.viewHeight;
    const scale = Math.min(scaleX, scaleY);
    ctx.scale(scale, scale);

    this.world.draw(ctx, this.camera);
    if (this.hazardSystem) this.hazardSystem.draw(ctx, this.camera, this.time);
    this.lootSystem.draw(ctx, this.camera, this.time);
    this.enemySystem.draw(ctx, this.camera);

    if (this.victoryPortal) {
      const p = this.victoryPortal;
      const sx = p.x - this.camera.position.x;
      const sy = p.y - this.camera.position.y;
      const pulse = 0.6 + Math.sin(this.time * 8) * 0.2;
      ctx.fillStyle = `rgba(139, 92, 246, ${0.3 + pulse * 0.2})`;
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.8 + pulse * 0.2})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(sx, sy, p.w, p.h);
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e9d5ff";
      ctx.fillText("PORTAL", sx + p.w / 2, sy + p.h / 2);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

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
    const bladeDashInvincible = this.bladeDashActive;
    if (dashInvincible || bladeDashInvincible) {
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

    this.drawAuraEffects(ctx);
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
      description: lootItem.description || "",
      weight: lootItem.weight || null,
      rarity: lootItem.rarity || null,
      modifiers: lootItem.modifiers || [],
      baseStat: lootItem.baseStat || null
    };

    this.inventory.push(newItem);

    if (this.hasUpgradeCard("swiftFeet")) {
      this.swiftFeetTimer = 2.0;
    }
    if (this.hasUpgradeCard("vampiric") && !this.hasCondition("noHealthDrops")) {
      this.healPlayer(5);
      const u = getSkillUnlocks();
      const count = (u.vampiricTriggers || 0) + 1;
      setSkillUnlock("vampiricTriggers", count);
    }

    this.updateInventoryUI();
  }

  addCubeToInventory(cubeKey) {
    this.cubeInventory[cubeKey] = (this.cubeInventory[cubeKey] || 0) + 1;
    if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
  }

  tryDropCubeFromEnemy(enemy) {
    const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isFiery || enemy.isCursedChestGuardian);
    const isElite = !!(enemy.enemyTier === "elite" || enemy.isElite);
    const dropMult = this.hasBlessing("fortune") ? 2 : 1;

    const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
    const pickRandomCube = (tier) => {
      const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
      this.addCubeToInventory(`${cube.id}T${tier}`);
    };

    if (isMiniBoss) {
      if (Math.random() < 0.05 * dropMult) pickRandomCube(3);
    } else if (isElite) {
      if (Math.random() < 0.1 * dropMult) pickRandomCube(2);
    } else {
      if (Math.random() < 0.5 * dropMult) pickRandomCube(1);
    }
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

  hasBlessing(id) {
    return this.activeBlessings.some((b) => b.id === id && b.until > this.time);
  }

  updateBlessings(dt) {
    this.activeBlessings = this.activeBlessings.filter((b) => b.until > this.time);
    this.updateBlessingsUI();
    if (this.hasBlessing("vitality")) {
      this.healPlayer(30 * dt);
    }
    if (this.hasBlessing("chaos") && Math.floor(this.time * 4) > Math.floor((this.time - dt) * 4)) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const angle = Math.random() * Math.PI * 2;
      const dist = 400;
      const tx = px + Math.cos(angle) * dist;
      const ty = py + Math.sin(angle) * dist;
      const damage = this.computePlayerDamage(null);
      const proj = new PlayerProjectile(px - PLAYER_PROJECTILE_SIZE / 2, py - PLAYER_PROJECTILE_SIZE / 2, tx, ty, damage);
      this.playerProjectiles.push(proj);
    }
  }

  updateBlessingsUI() {
    const el = document.getElementById("blessings-bar");
    if (!el) return;
    const active = this.activeBlessings.filter((b) => b.until > this.time);
    if (active.length === 0) {
      el.innerHTML = "";
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = active.map((b) => {
      const secs = Math.ceil(b.until - this.time);
      return `<span class="blessing-buff" title="${b.name}: ${b.desc}" style="background:${b.color}20;border-color:${b.color}">${b.icon} ${secs}s</span>`;
    }).join("");
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
      nameSpan.className = "inventory-item-name" + (item.rarity === "legendary" ? " inventory-item-legendary" : "");
      nameSpan.style.color = getItemRarityColor(item);
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

      li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
      li.addEventListener("mouseleave", hideItemTooltip);
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
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
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
    if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
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
      if (item) {
        nameDiv.style.color = getItemRarityColor(item);
        nameDiv.textContent = item.name;
      } else {
        nameDiv.textContent = "None";
      }

      if (item) {
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
      }

      li.appendChild(slotLabel);
      li.appendChild(nameDiv);
      this.equippedListEl.appendChild(li);
    }
  }

  recalculateStats() {
    if (this.devStatsOverride) {
      this.currentStats = { ...this.devStatsOverride };
      this.currentHealth = Math.min(this.currentHealth, this.currentStats.maxHealth);
      this.updateStatsUI();
      this.updateHealthBar();
      return;
    }
    const stats = { ...this.baseStats };
    const percentMods = { attack: 0, maxHealth: 0, defense: 0, speed: 0, xpGained: 0, skillDamage: 0 };
    let equipmentAttackSpeedMult = 1;
    let equipmentCooldownRecovery = 1;
    let equipmentSpeedPenalty = 0;
    let hasHeavyArmour = false;
    const WEIGHT_PENALTIES = { light: 0, medium: 0.1, heavy: 0.15 };
    for (const slot of Object.keys(this.equipment)) {
      const item = this.equipment[slot];
      if (!item || !item.stats) continue;
      if ((slot === "Helmet" || slot === "Body Armour") && item.weight) {
        equipmentSpeedPenalty = Math.max(equipmentSpeedPenalty, WEIGHT_PENALTIES[item.weight] || 0);
        if (item.weight === "heavy") hasHeavyArmour = true;
      }
      for (const [k, v] of Object.entries(item.stats)) {
        if (k === "attackSpeed") {
          equipmentAttackSpeedMult *= v;
        } else if (k === "cooldownRecovery") {
          equipmentCooldownRecovery *= v;
        } else if (k === "attackPercent" || k === "maxHealthPercent" || k === "defensePercent" || k === "speedPercent") {
          const baseKey = k.replace("Percent", "");
          percentMods[baseKey] = (percentMods[baseKey] || 0) + v;
        } else if (k === "xpGainedPercent") {
          percentMods.xpGained += v;
        } else if (k === "skillDamagePercent") {
          percentMods.skillDamage += v;
        } else {
          stats[k] = (stats[k] || 0) + v;
        }
      }
    }
    this.equipmentAttackSpeedMult = equipmentAttackSpeedMult;
    this.equipmentCooldownRecovery = equipmentCooldownRecovery;
    this.equipmentXpGainedMult = 1 + (percentMods.xpGained || 0);
    this.equipmentSkillDamageMult = 1 + (percentMods.skillDamage || 0);
    this.equipmentSpeedMult = 1 - equipmentSpeedPenalty;
    this.equipmentDashCooldownMult = hasHeavyArmour ? 1.2 : 1;
    this.dashCooldownTime = this.baseDashCooldownTime * this.equipmentDashCooldownMult;
    for (const key of ["attack", "maxHealth", "defense", "speed"]) {
      const pct = percentMods[key] || 0;
      if (pct !== 0) stats[key] = Math.round((stats[key] || 0) * (1 + pct));
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

      li.addEventListener("mouseenter", (e) => showItemTooltip(e, card, this));
      li.addEventListener("mouseleave", hideItemTooltip);
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
    const atkSpd = this.equipmentAttackSpeedMult || 1;
    const cdRec = this.equipmentCooldownRecovery ?? 1;
    const spdMult = this.equipmentSpeedMult ?? 1;
    const dashCd = this.equipmentDashCooldownMult ?? 1;
    if (atkSpd !== 1) rows.push(["Atk Spd", `+${Math.round((atkSpd - 1) * 100)}%`]);
    if (cdRec !== 1) rows.push(["CD Rec", `${Math.round((1 - cdRec) * 100)}% less`]);
    if (spdMult < 1) rows.push(["Armour", `-${Math.round((1 - spdMult) * 100)}% speed`]);
    if (dashCd > 1) rows.push(["Dash CD", `+${Math.round((dashCd - 1) * 100)}%`]);

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
  }

  handleDevRandomItem() {
    const types = ["Helmet", "Body Armour", "Weapon", "Boots"];
    const type = types[Math.floor(Math.random() * types.length)];
    const forceRarity = Math.random() < 0.5 ? "magic" : "rare";
    const lootQuality = this.currentMap?.lootQuality ?? 0.5;
    const def = generateEquipmentItem(type, lootQuality, 0.5, forceRarity);
    this.inventory.push({
      id: 70000 + Math.floor(Math.random() * 10000),
      name: def.name,
      type: def.type,
      stats: def.stats || {},
      cardKey: null,
      description: "",
      weight: def.weight || null,
      rarity: def.rarity || null,
      modifiers: def.modifiers || [],
      baseStat: def.baseStat || null
    });
    this.updateInventoryUI();
  }

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
  }

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
      slider.addEventListener("input", () => {
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
  }
}

// -------- Save system & main menu --------

const SAVE_KEY = "spaceShooter_characters";
const CONQUEROR_VAULT_KEY = "spaceShooter_conquerorVault";
const ETERNAL_ITEMS_ON_DEFEAT_KEY = "spaceShooter_eternalDefeatItems";
const LEGACY_CUBE_STASH_KEY = "spaceShooter_legacyCubeStash";

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

function loadLegacyCubeStash() {
  try {
    const raw = localStorage.getItem(LEGACY_CUBE_STASH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function addToLegacyCubeStash(cubeKey) {
  const stash = loadLegacyCubeStash();
  stash[cubeKey] = (stash[cubeKey] || 0) + 1;
  localStorage.setItem(LEGACY_CUBE_STASH_KEY, JSON.stringify(stash));
}

function consumeLegacyCubeStash() {
  const stash = loadLegacyCubeStash();
  localStorage.removeItem(LEGACY_CUBE_STASH_KEY);
  return stash;
}

function restoreEternalItemsFromDefeat() {
  try {
    const raw = localStorage.getItem(ETERNAL_ITEMS_ON_DEFEAT_KEY);
    if (!raw) return;
    const items = JSON.parse(raw);
    localStorage.removeItem(ETERNAL_ITEMS_ON_DEFEAT_KEY);
    const vault = loadConquerorVault();
    for (const item of items) {
      vault.push({ item, collectedBy: "Eternal" });
    }
    localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(vault));
  } catch (_) {}
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

const PERCENT_STAT_LABELS = { xpGained: "XP Gained", skillDamage: "Skill Damage" };

function formatItemStats(item) {
  const parts = [];
  if (item.stats && Object.keys(item.stats).length > 0) {
    const fmt = (k, v) => {
      if (k === "attackSpeed") return `+${Math.round((v - 1) * 100)}% atk spd`;
      if (k === "cooldownRecovery") return `${Math.round((1 - v) * 100)}% less CD`;
      if (k.endsWith("Percent")) return `+${Math.round(v * 100)}% ${k.replace("Percent", "")}`;
      if (k === "xpGained" || k === "skillDamage") return `+${Math.round(v * 100)}% ${PERCENT_STAT_LABELS[k] || k}`;
      return `${k}: +${v}`;
    };
    parts.push(Object.entries(item.stats).map(([k, v]) => fmt(k, v)).join(", "));
  }
  if (item.weight && (item.type === "Helmet" || item.type === "Body Armour")) {
    const w = item.weight;
    if (w === "medium") parts.push("Medium (-10% speed)");
    else if (w === "heavy") parts.push("Heavy (-15% speed, +20% dash CD)");
    else if (w === "light") parts.push("Light (no penalty)");
  }
  return parts.join(" | ");
}

function formatItemModifiers(item) {
  if (!item.modifiers || item.modifiers.length === 0) return [];
  return item.modifiers.map((m) => {
    const isLegendary = LEGENDARY_MODIFIER_IDS.includes(m.id);
    if (isLegendary) {
      const effect = LEGENDARY_MODIFIER_EFFECTS[m.id] || "";
      return effect ? `${m.label} (${effect})` : m.label;
    }
    return `+${Math.round(m.value * 100)}% ${m.label}`;
  });
}

function getItemRarityColor(item) {
  if (!item) return "#e2e8f0";
  if (item.rarity === "legendary") return RARITY_COLORS.legendary;
  if (item.rarity === "magic") return RARITY_COLORS.magic;
  if (item.rarity === "rare") return RARITY_COLORS.rare;
  return RARITY_COLORS.common;
}

function buildItemTooltipContent(item, game = null) {
  const rarityColor = getItemRarityColor(item);
  const name = escapeHtml(item.name);
  const type = escapeHtml(item.type || "Item");
  const desc = item.description ? escapeHtml(item.description) : "";

  let html = `<div class="tooltip-name" style="color:${rarityColor}">${name}</div><div class="tooltip-type">${type}</div>`;

  if (item.type === "Upgrade Card") {
    if (desc) html += `<div class="tooltip-desc">${desc}</div>`;
    return html;
  }

  const baseKey = EQUIPMENT_BASE_STAT[item.type];
  const baseVal = item.stats && item.stats[baseKey] ? item.stats[baseKey] : 0;
  const baseLabel = baseKey === "maxHealth" ? "Max Health" : baseKey === "attack" ? "Attack" : baseKey === "speed" ? "Speed" : "Defense";
  const equipped = game && item.type ? game.equipment[item.type] : null;
  const eqBaseVal = equipped?.stats?.[baseKey] ?? 0;
  let baseCls = "tooltip-stats";
  if (equipped && equipped !== item) {
    if (baseVal > eqBaseVal) baseCls += " tooltip-better";
    else if (baseVal < eqBaseVal) baseCls += " tooltip-worse";
  }
  html += `<div class="${baseCls}">${baseLabel}: +${baseVal}</div>`;

  if (item.modifiers && item.modifiers.length > 0) {
    const eqModifiers = equipped?.modifiers || [];
    for (const m of item.modifiers) {
      const isLegendaryMod = LEGENDARY_MODIFIER_IDS.includes(m.id);
      const classes = ["tooltip-mod"];
      if (isLegendaryMod) classes.push("tooltip-legendary-mod");
      if (!isLegendaryMod && equipped && equipped !== item) {
        const eqMod = eqModifiers.find((x) => x.id === m.id);
        const eqVal = eqMod ? eqMod.value : 0;
        if (m.value > eqVal) classes.push("tooltip-better");
        else if (m.value < eqVal) classes.push("tooltip-worse");
      }
      const elapsed = m.addedAt ? Date.now() - m.addedAt : 99999;
      if (elapsed < 10000) classes.push("mod-crafted");
      const style = elapsed < 10000 ? ` style="animation-delay: -${elapsed / 1000}s"` : "";
      const text = isLegendaryMod
        ? `${m.label} (${LEGENDARY_MODIFIER_EFFECTS[m.id] || ""})`
        : `+${Math.round(m.value * 100)}% ${m.label}`;
      html += `<div class="${classes.join(" ")}"${style}>${text}</div>`;
    }
  }

  if (item.weight && (item.type === "Helmet" || item.type === "Body Armour")) {
    const w = item.weight;
    const wText = w === "medium" ? "Medium (-10% speed)" : w === "heavy" ? "Heavy (-15% speed, +20% dash CD)" : "Light (no penalty)";
    html += `<div class="tooltip-stats">${escapeHtml(wText)}</div>`;
  }
  if (desc) html += `<div class="tooltip-desc">${desc}</div>`;
  return html;
}

function showItemTooltip(e, item, game = null) {
  const el = document.getElementById("item-tooltip");
  if (!el || !item) return;
  el.innerHTML = buildItemTooltipContent(item, game);
  el.style.left = "-9999px";
  el.style.top = "0";
  el.classList.remove("hidden");
  el.offsetHeight; // force reflow
  const rect = (e.currentTarget || e.target).getBoundingClientRect();
  const tr = el.getBoundingClientRect();
  let left = rect.left + (rect.width / 2) - (tr.width / 2);
  let top = rect.bottom + 6;
  if (left < 8) left = 8;
  if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
  if (top + tr.height > window.innerHeight - 8) top = rect.top - tr.height - 6;
  if (top < 8) top = 8;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function hideItemTooltip() {
  const el = document.getElementById("item-tooltip");
  if (el) {
    el.classList.add("hidden");
    el.innerHTML = "";
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
      const mods = formatItemModifiers(entry.item);
      const modsHtml = mods.length
        ? `<ul class="legacy-item-mods">${mods.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : "";
      card.innerHTML = `
        <div class="legacy-item-name">${escapeHtml(entry.item.name)}</div>
        <div class="legacy-item-type">${escapeHtml(entry.item.type)}</div>
        ${statsStr ? `<div class="legacy-item-stats">${escapeHtml(statsStr)}</div>` : ""}
        ${modsHtml}
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
  restoreEternalItemsFromDefeat();
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
  const byCategory = {};
  for (const s of unlocked) {
    const cat = s.category || "projectile";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }
  const order = ["projectile", "melee", "aura"];
  for (const cat of order) {
    const skills = byCategory[cat];
    if (!skills || skills.length === 0) continue;
    const label = document.createElement("div");
    label.className = "skill-category-label";
    label.textContent = SKILL_CATEGORIES[cat] || cat;
    poolEl.appendChild(label);
    for (const s of skills) {
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
  document.getElementById("inventory-button")?.classList.remove("hidden");

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
    const invBtn = document.getElementById("inventory-button");
    if (pauseBtn) pauseBtn.classList.add("hidden");
    if (devBtn) devBtn.classList.add("hidden");
    if (invBtn) invBtn.classList.add("hidden");
    const bossBar = document.getElementById("boss-health-bar");
    if (bossBar) bossBar.classList.add("hidden");
    renderHallOfChampions();

    const newGameBtn = document.getElementById("main-menu-new-game");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", () => showPreRunScreen([]));
    }

    const devModeBtn = document.getElementById("main-menu-dev-mode");
    if (devModeBtn) {
      devModeBtn.addEventListener("click", () => {
        document.getElementById("main-menu").classList.add("hidden");
        const gameRoot = document.querySelector(".game-root");
        if (gameRoot) gameRoot.classList.remove("hidden");
        document.getElementById("pause-toggle")?.classList.remove("hidden");
        document.getElementById("dev-toggle")?.classList.remove("hidden");
        document.getElementById("inventory-button")?.classList.remove("hidden");
        startGame([], { difficulty: 1, conditions: [], devMode: true });
      });
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

