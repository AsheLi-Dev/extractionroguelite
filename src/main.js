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
const SKILL_LEVELS_KEY = "spaceShooter_skillLevels";
const FLUX_KEY = "spaceShooter_flux";
const SKILL_MOD_SOCKETS_KEY = "spaceShooter_skillModSockets";
const MOD_CARDS_INVENTORY_KEY = "spaceShooter_modCardsInventory";

const SKILL_XP_CURVE = [0, 0, 500, 1500, 3500, 7000, 12000, 20000, 32000, 50000, 75000];
const SKILL_MAX_LEVEL = 10;

function getXpForSkillLevel(level) {
  if (level <= 1) return 0;
  return SKILL_XP_CURVE[Math.min(level, SKILL_XP_CURVE.length - 1)] ?? 75000;
}

function getSkillLevels() {
  try {
    const raw = localStorage.getItem(SKILL_LEVELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSkillLevels(data) {
  localStorage.setItem(SKILL_LEVELS_KEY, JSON.stringify(data));
}

function getSkillLevel(skillId) {
  const data = getSkillLevels();
  const entry = data[skillId];
  return entry ? Math.min(SKILL_MAX_LEVEL, entry.level ?? 1) : 1;
}

function getSkillXp(skillId) {
  const data = getSkillLevels();
  const entry = data[skillId];
  return entry ? (entry.xp ?? 0) : 0;
}

function markSkillEncountered(skillId) {
  const data = getSkillLevels();
  if (!data[skillId]) data[skillId] = { xp: 0, level: 1, encountered: true };
  else data[skillId].encountered = true;
  setSkillLevels(data);
}

function addSkillXp(skillId, amount) {
  if (!skillId || amount <= 0) return null;
  const data = getSkillLevels();
  if (!data[skillId]) data[skillId] = { xp: 0, level: 1, encountered: true };
  else data[skillId].encountered = true;
  const prevLevel = data[skillId].level || 1;
  data[skillId].xp = (data[skillId].xp || 0) + amount;
  let level = prevLevel;
  while (level < SKILL_MAX_LEVEL && data[skillId].xp >= getXpForSkillLevel(level + 1)) {
    level++;
  }
  data[skillId].level = level;
  setSkillLevels(data);
  return { level, leveledUp: level > prevLevel };
}

function getModSlotsForSkillLevel(level) {
  if (level <= 2) return 0;
  if (level <= 4) return 1;
  if (level <= 7) return 2;
  if (level <= 9) return 3;
  return 4;
}

function getFlux() {
  try {
    const raw = localStorage.getItem(FLUX_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function addFlux(amount) {
  const next = Math.max(0, getFlux() + amount);
  localStorage.setItem(FLUX_KEY, String(next));
  return next;
}

function getSkillModSockets() {
  try {
    const raw = localStorage.getItem(SKILL_MOD_SOCKETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSkillModSockets(data) {
  localStorage.setItem(SKILL_MOD_SOCKETS_KEY, JSON.stringify(data));
}

function getModCardInventory() {
  try {
    const raw = localStorage.getItem(MOD_CARDS_INVENTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addModCardToInventory(cardId) {
  const inv = getModCardInventory();
  inv.push(cardId);
  localStorage.setItem(MOD_CARDS_INVENTORY_KEY, JSON.stringify(inv));
}

function removeModCardFromInventoryAtIndex(index) {
  const inv = getModCardInventory();
  if (index < 0 || index >= inv.length) return null;
  const cardId = inv.splice(index, 1)[0];
  localStorage.setItem(MOD_CARDS_INVENTORY_KEY, JSON.stringify(inv));
  return cardId;
}

const SKILL_SLOT_UNLOCK = { 1: 0, 2: 1, 3: 3, 4: 5 };

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
      { id: "offerXp", label: "Offer 30% XP" },
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

const MODIFICATION_CARD_CATEGORIES = { delivery: "Delivery", trigger: "Trigger", element: "Element", self: "Self" };

const MODIFICATION_CARD_DEFS = [
  { id: "homing", name: "Homing", category: "delivery", desc: "Projectiles seek nearest enemy." },
  { id: "bouncing", name: "Bouncing", category: "delivery", desc: "Projectiles bounce off walls up to 3 times." },
  { id: "piercing", name: "Piercing", category: "delivery", desc: "Projectiles pass through all enemies." },
  { id: "orbiting", name: "Orbiting", category: "delivery", desc: "Projectile orbits the player 3s before seeking." },
  { id: "volley", name: "Volley", category: "delivery", desc: "Fires 3 projectiles in a spread." },
  { id: "boomerang", name: "Boomerang", category: "delivery", desc: "Projectile returns to player, hitting enemies twice." },
  { id: "onKill", name: "On Kill", category: "trigger", desc: "Skill fires when you kill an enemy (no cooldown cost)." },
  { id: "chainCast", name: "Chain Cast", category: "trigger", desc: "Fires twice in rapid succession on one activation." },
  { id: "echo", name: "Echo", category: "trigger", desc: "30% chance to cast again for free immediately." },
  { id: "charged", name: "Charged", category: "trigger", desc: "Hold key up to 2s to charge; release up to 200% damage." },
  { id: "rebound", name: "Rebound", category: "trigger", desc: "Skill bounces off walls once, firing again from impact." },
  { id: "ignite", name: "Ignite", category: "element", desc: "Burn 15% skill damage/s for 3s." },
  { id: "chill", name: "Chill", category: "element", desc: "Slow 20% for 2s." },
  { id: "shock", name: "Shock", category: "element", desc: "25% chance to stun 0.5s." },
  { id: "toxic", name: "Toxic", category: "element", desc: "Poison 5% max health/s for 3s, stacks 3." },
  { id: "void", name: "Void", category: "element", desc: "Reduce enemy defense 20% for 4s." },
  { id: "amplify", name: "Amplify", category: "element", desc: "+25% damage, +0.5s cooldown." },
  { id: "lifesteal", name: "Lifesteal", category: "self", desc: "15% of skill damage as health." },
  { id: "adrenaline", name: "Adrenaline", category: "self", desc: "+20% movement speed for 2s on cast." },
  { id: "recoil", name: "Recoil", category: "self", desc: "+30% damage but knocks you back on cast." },
  { id: "sacrifice", name: "Sacrifice", category: "self", desc: "+50% damage but costs 3% max health on cast." },
  { id: "empower", name: "Empower", category: "self", desc: "+5% skill damage per cast, stacks up to 10 until map end." },
  { id: "cooldownCascade", name: "Cooldown Cascade", category: "self", desc: "Reset cooldown if this skill kills an enemy." }
];

const DELIVERY_TRIGGER_MOD_IDS = MODIFICATION_CARD_DEFS.filter(
  (c) => c.category === "delivery" || c.category === "trigger"
).map((c) => c.id);

function getModsForSkillSlot(game, slot) {
  const skillId = game.skills?.[slot];
  if (!skillId) return [];
  const sockets = getSkillModSockets();
  const list = (sockets[skillId] || []).filter(Boolean);
  const overrides = game.devModOverrides?.[slot];
  if (Array.isArray(overrides) && overrides.length > 0) {
    const set = new Set(list);
    for (const id of overrides) set.add(id);
    return [...set];
  }
  return list;
}

function getModEffectMult(game) {
  return hasTalent("grandSocketeer") ? 1.5 : 1;
}

function applyElementDebuffsFromMods(game, enemy, mods, skillDamage, gameTime) {
  if (!mods || mods.length === 0) return;
  const mult = getModEffectMult(game);
  if (mods.includes("ignite")) {
    const dps = (0.15 * skillDamage) * mult;
    enemy.burnUntil = gameTime + 3;
    enemy.burnDps = Math.max(enemy.burnDps || 0, dps);
    enemy.burnAccum = 0;
  }
  if (mods.includes("chill")) {
    const slowMult = 1 - 0.2 * mult;
    enemy.slowUntil = Math.max(enemy.slowUntil || 0, gameTime + 2);
    enemy.slowMult = Math.min(enemy.slowMult ?? 1, slowMult);
  }
  if (mods.includes("shock") && Math.random() < 0.25 * mult) {
    enemy.stunUntil = Math.max(enemy.stunUntil || 0, gameTime + 0.5);
  }
  if (mods.includes("toxic")) {
    enemy.toxicStacks = Math.min(3, (enemy.toxicStacks || 0) + 1);
    enemy.toxicUntil = gameTime + 3;
    enemy.toxicAccum = 0;
  }
  if (mods.includes("void")) {
    enemy.voidDefenseUntil = gameTime + 4;
    enemy.voidDefenseMult = 1 - 0.2 * mult;
  }
}

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

function canRefundTalent(talentId, purchased) {
  if (!purchased.includes(talentId)) return false;
  for (const [branchName, nodes] of Object.entries(TALENT_TREE)) {
    const idx = nodes.findIndex((n) => n.id === talentId);
    if (idx === -1) continue;
    const isBranching = nodes.length > 0 && (nodes[0].parentsAll !== undefined || nodes[0].parentsAny !== undefined);
    if (isBranching) {
      for (const node of nodes) {
        if (node.id === talentId) continue;
        if (!purchased.includes(node.id)) continue;
        const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
        if (parents.includes(talentId)) return false;
      }
      return true;
    }
    for (let j = idx + 1; j < nodes.length; j++) {
      if (purchased.includes(nodes[j].id)) return false;
    }
    return true;
  }
  return false;
}

function refundTalent(talentId) {
  const purchased = getPurchasedTalents();
  if (!purchased.includes(talentId)) return false;
  let cost = 0;
  for (const nodes of Object.values(TALENT_TREE)) {
    const node = nodes.find((n) => n.id === talentId);
    if (node) {
      cost = node.cost;
      break;
    }
  }
  if (cost === 0) return false;
  if (!canRefundTalent(talentId, purchased)) return false;
  addLegacyPoints(cost);
  const next = purchased.filter((id) => id !== talentId);
  localStorage.setItem(TALENTS_KEY, JSON.stringify(next));
  return true;
}

function refundBranch(branchName) {
  const nodes = TALENT_TREE[branchName];
  if (!nodes || !Array.isArray(nodes)) return 0;
  const branchIds = new Set(nodes.map((n) => n.id));
  let count = 0;
  let purchased = getPurchasedTalents();
  let inBranch = purchased.filter((id) => branchIds.has(id));
  while (inBranch.length > 0) {
    let refundedOne = false;
    for (const id of inBranch) {
      if (canRefundTalent(id, purchased)) {
        refundTalent(id);
        purchased = getPurchasedTalents();
        inBranch = purchased.filter((pid) => branchIds.has(pid));
        count++;
        refundedOne = true;
        break;
      }
    }
    if (!refundedOne) break;
  }
  return count;
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
    return ["cardTranscendence", "phantomExtractor", "vaultMaster", "curator"].some((t) => hasTalent(t));
  }
  if (skillDef.unlock === "diff2") return !!u.diff2;
  if (skillDef.unlock === "diff3") return !!u.diff3;
  if (skillDef.unlock === "diff4") return !!u.diff4;
  if (skillDef.unlock === "diff5") return !!u.diff5;
  if (skillDef.unlock === "fortified") return hasTalent("fortified");
  if (skillDef.unlock === "vampiric50") return (u.vampiricTriggers || 0) >= 50;
  if (skillDef.unlock === "mastermind") return hasTalent("curator");
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
    // Tier 1 roots
    { id: "fierce", cost: 1, name: "Fierce", tier: 1, desc: "+10% attack damage.", parentsAll: [], parentsAny: [] },
    { id: "rapid", cost: 1, name: "Rapid", tier: 1, desc: "+10% attack speed.", parentsAll: [], parentsAny: [] },
    { id: "resilient", cost: 1, name: "Resilient", tier: 1, desc: "+10% max health.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "bloodthirst", cost: 2, name: "Bloodthirst", tier: 2, desc: "Kills restore 3% of your max health.", parentsAll: ["fierce"], parentsAny: [] },
    { id: "predator", cost: 2, name: "Predator", tier: 2, desc: "Enemies below 25% health take greatly increased damage.", parentsAll: [], parentsAny: ["fierce", "rapid"] },
    { id: "reflexes", cost: 2, name: "Reflexes", tier: 2, desc: "Reduces dash cooldown by 0.1 seconds.", parentsAll: [], parentsAny: ["rapid", "resilient"] },
    { id: "ironWill", cost: 2, name: "Iron Will", tier: 2, desc: "Permanent 20 HP shield that regenerates 5s after breaking.", parentsAll: ["resilient"], parentsAny: [] },
    // Tier 3
    { id: "frenzy", cost: 3, name: "Frenzy", tier: 3, desc: "Every 4th consecutive attack grants 3s of 30% increased attack speed.", parentsAll: ["bloodthirst"], parentsAny: [] },
    { id: "executioner", cost: 3, name: "Executioner", tier: 3, desc: "Skills deal 25% increased damage and you deal more damage to low-health enemies.", parentsAll: [], parentsAny: ["bloodthirst", "predator"] },
    { id: "battleScarred", cost: 3, name: "Battle Scarred", tier: 3, desc: "Taking damage grants +10% attack damage for 5s, stacking up to 3 times.", parentsAll: [], parentsAny: ["predator", "reflexes"] },
    { id: "endurance", cost: 3, name: "Endurance", tier: 3, desc: "After dashing gain 15% damage reduction for 3 seconds.", parentsAll: [], parentsAny: ["reflexes", "ironWill"] },
    { id: "fortress", cost: 3, name: "Fortress", tier: 3, desc: "Each equipped armour piece grants +5% damage.", parentsAll: ["ironWill"], parentsAny: [] },
    // Tier 4 keystones
    { id: "berserkerRage", cost: 4, name: "Berserker's Rage", tier: 4, desc: "Below 40% health gain +40% attack damage, +20% attack speed and +15% movement speed.", parentsAll: [], parentsAny: ["frenzy", "executioner"] },
    { id: "warlord", cost: 4, name: "Warlord", tier: 4, desc: "Mini-bosses always drop one extra rare item and bosses grant a high-quality weapon.", parentsAll: [], parentsAny: ["executioner", "battleScarred"] },
    { id: "secondWind", cost: 4, name: "Second Wind", tier: 4, desc: "Once per run survive a killing blow and periodically refresh skill cooldowns.", parentsAll: [], parentsAny: ["battleScarred", "endurance"] },
    { id: "immortal", cost: 5, name: "Immortal", tier: 4, desc: "Once per run, survive a lethal hit at 1 HP and gain brief total damage reduction.", parentsAll: [], parentsAny: ["endurance", "fortress"] }
  ],
  Survivalist: [
    // Tier 1 roots
    { id: "fortitude", cost: 1, name: "Fortitude", tier: 1, desc: "+10% max health.", parentsAll: [], parentsAny: [] },
    { id: "bulwark", cost: 1, name: "Bulwark", tier: 1, desc: "+10% defense.", parentsAll: [], parentsAny: [] },
    { id: "nimble", cost: 1, name: "Nimble", tier: 1, desc: "+5% movement speed.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "vitality", cost: 2, name: "Vitality", tier: 2, desc: "Regenerate 20% max health after entering a new map.", parentsAll: ["fortitude"], parentsAny: [] },
    { id: "thickSkin", cost: 2, name: "Thick Skin", tier: 2, desc: "+15% max health and +10% defense.", parentsAll: [], parentsAny: ["fortitude", "bulwark"] },
    { id: "toughness", cost: 2, name: "Toughness", tier: 2, desc: "First three hits on each new map deal 40% reduced damage.", parentsAll: [], parentsAny: ["bulwark", "nimble"] },
    { id: "fleetFooted", cost: 2, name: "Fleet Footed", tier: 2, desc: "When health is below 50%, movement speed increased by an additional 10%.", parentsAll: ["nimble"], parentsAny: [] },
    // Tier 3
    { id: "lifebloom", cost: 3, name: "Lifebloom", tier: 3, desc: "Heal 5% of a killed enemy's max health on kill.", parentsAll: ["vitality"], parentsAny: [] },
    { id: "secondBreath", cost: 3, name: "Second Breath", tier: 3, desc: "Once per map when health drops below 15%, instantly regenerate 25% max health.", parentsAll: [], parentsAny: ["vitality", "thickSkin"] },
    { id: "retaliation", cost: 3, name: "Retaliation", tier: 3, desc: "Taking damage grants +8% attack damage for 4s, stacking up to 4 times.", parentsAll: [], parentsAny: ["thickSkin", "toughness"] },
    { id: "evasion", cost: 3, name: "Evasion", tier: 3, desc: "Each dash has 15% chance to leave a decoy that distracts nearby enemies for 2s.", parentsAll: [], parentsAny: ["toughness", "fleetFooted"] },
    { id: "shadowStep", cost: 3, name: "Shadow Step", tier: 3, desc: "Leave a toxic area along the dash path dealing 10% of your max health as damage per second for 2s.", parentsAll: ["fleetFooted"], parentsAny: [] },
    // Tier 4 keystones
    { id: "undyingResolve", cost: 4, name: "Undying Resolve", tier: 4, desc: "Permanently +10% max health each time a mini-boss is defeated during the run.", parentsAll: [], parentsAny: ["lifebloom", "secondBreath"] },
    { id: "livingFortress", cost: 4, name: "Living Fortress", tier: 4, desc: "Every 8s gain a shield equal to 15% max health; when broken releases a shockwave dealing 120% attack to nearby enemies.", parentsAll: [], parentsAny: ["secondBreath", "retaliation"] },
    { id: "ghostForm", cost: 4, name: "Ghost Form", tier: 4, desc: "After taking damage become untargetable for 0.8s, once every 6s max.", parentsAll: [], parentsAny: ["retaliation", "evasion"] },
    { id: "untouchable", cost: 5, name: "Untouchable", tier: 4, desc: "Each dash that avoids damage during i-frames permanently reduces incoming damage by 1% (stacking up to 20%, max 20% reduction).", parentsAll: [], parentsAny: ["evasion", "shadowStep"] }
  ],
  Scavenger: [
    // Tier 1
    { id: "arcaneEye", cost: 1, name: "Arcane Eye", tier: 1, desc: "+20% increased drop rate of modification cards.", parentsAll: [], parentsAny: [] },
    { id: "swiftExtraction", cost: 1, name: "Swift Extraction", tier: 1, desc: "Reduces dash cooldown by 0.1 seconds.", parentsAll: [], parentsAny: [] },
    { id: "keenEye", cost: 1, name: "Keen Eye", tier: 1, desc: "+15% increased drop rate of equipment items.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "cardHoarder", cost: 2, name: "Card Hoarder", tier: 2, desc: "All equipment items have a 20% increased chance to drop with an additional socket slot.", parentsAll: ["arcaneEye"], parentsAny: [] },
    { id: "fluxFinder", cost: 2, name: "Flux Finder", tier: 2, desc: "Elite enemies have a 15% increased chance to drop Flux.", parentsAll: ["arcaneEye"], parentsAny: [] },
    { id: "luckyDraw", cost: 2, name: "Lucky Draw", tier: 2, desc: "25% chance to find a second random modification card when picking up any modification card.", parentsAll: [], parentsAny: ["arcaneEye", "swiftExtraction"] },
    { id: "socketMastery", cost: 2, name: "Socket Mastery", tier: 2, desc: "Socket Cubes found during a run have a 20% chance to add 2 sockets instead of 1.", parentsAll: ["swiftExtraction"], parentsAny: [] },
    { id: "secureFooting", cost: 2, name: "Secure Footing", tier: 2, desc: "Picking up any loot item grants a 1 second burst of 30% increased movement speed.", parentsAll: [], parentsAny: ["swiftExtraction", "keenEye"] },
    { id: "itemSense", cost: 2, name: "Item Sense", tier: 2, desc: "Rare and higher quality items emit a visible glow on the minimap.", parentsAll: ["keenEye"], parentsAny: [] },
    { id: "modSpecialist", cost: 2, name: "Mod Specialist", tier: 2, desc: "Modification cards dropped during a run have a 30% chance to be one tier higher quality.", parentsAll: ["keenEye"], parentsAny: [] },
    // Tier 3
    { id: "synergyMaster", cost: 3, name: "Synergy Master", tier: 3, desc: "6% increased damage for each skill with at least one modification card socketed; 10% per skill when all active skill slots have at least one modification card socketed.", parentsAll: ["cardHoarder"], parentsAny: [] },
    { id: "cardSurge", cost: 3, name: "Card Surge", tier: 3, desc: "Picking up any modification card grants 15% increased attack speed and movement speed for 8 seconds.", parentsAll: [], parentsAny: ["cardHoarder", "luckyDraw"] },
    { id: "ghostLooter", cost: 3, name: "Ghost Looter", tier: 3, desc: "Player is untargetable for 0.5 seconds when picking up any loot item.", parentsAll: [], parentsAny: ["luckyDraw", "secureFooting"] },
    { id: "treasureSense", cost: 3, name: "Treasure Sense", tier: 3, desc: "Reveals all loot drop locations and mini-boss positions on the minimap for 5 seconds at the start of each map.", parentsAll: [], parentsAny: ["secureFooting", "itemSense"] },
    { id: "appraiser", cost: 3, name: "Appraiser", tier: 3, desc: "Blue and yellow items dropped by enemies always have at least one modifier rolled at 35% or higher.", parentsAll: ["itemSense"], parentsAny: [] },
    // Tier 4
    { id: "cardTranscendence", cost: 4, name: "Card Transcendence", tier: 4, desc: "When the player levels up during a run there is a 10% chance to automatically receive a random modification card added to inventory.", parentsAll: [], parentsAny: ["synergyMaster", "cardSurge"] },
    { id: "phantomExtractor", cost: 4, name: "Phantom Extractor", tier: 4, desc: "Player is fully invisible and invincible for 3 seconds after picking up a rare or higher quality item (once every 20 seconds maximum).", parentsAll: [], parentsAny: ["cardSurge", "ghostLooter"] },
    { id: "vaultMaster", cost: 4, name: "Vault Master", tier: 4, desc: "Legacy Vault capacity increases from 5 to 8 items; Legacy Vault items cannot be degraded by any enemy affix or condition.", parentsAll: [], parentsAny: ["ghostLooter", "treasureSense"] },
    { id: "curator", cost: 5, name: "Curator", tier: 4, desc: "Once per run after defeating the boss, permanently add one equipped item to the Legacy Vault (even if character is not saved). All Legacy Vault equipment gains one free random modifier reroll after each completed run.", parentsAll: [], parentsAny: ["treasureSense", "appraiser"] }
  ],
  Tinkerer: [
    // Tier 1 roots
    { id: "cubeMagnet", cost: 1, name: "Cube Magnet", tier: 1, desc: "+20% increased drop rate of all modifier and upgrade cubes.", parentsAll: [], parentsAny: [] },
    { id: "socketSense", cost: 1, name: "Socket Sense", tier: 1, desc: "+20% increased chance for dropped equipment to have at least one socket.", parentsAll: [], parentsAny: [] },
    { id: "transmuter", cost: 1, name: "Transmuter", tier: 1, desc: "+20% increased drop rate of Magic and Rare upgrade cubes.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "cubeExpert", cost: 2, name: "Cube Expert", tier: 2, desc: "Automatically upgrades all Tier 1 modifier cubes found during a run to Tier 2.", parentsAll: ["cubeMagnet"], parentsAny: [] },
    { id: "tinkerersEye", cost: 2, name: "Tinkerer's Eye", tier: 2, desc: "15% chance to find one additional random cube of the same tier when picking up any cube or socket cube.", parentsAll: [], parentsAny: ["cubeMagnet", "socketSense"] },
    { id: "socketFinder", cost: 2, name: "Socket Finder", tier: 2, desc: "Chance for a Socket Workshop to appear somewhere on the map; interact to add one socket to any item.", parentsAll: [], parentsAny: ["socketSense", "transmuter"] },
    { id: "qualityEye", cost: 2, name: "Quality Eye", tier: 2, desc: "Blue items dropped by enemies always have at least one modifier rolled at 30% or higher.", parentsAll: ["transmuter"], parentsAny: [] },
    // Tier 3
    { id: "forgeMastery", cost: 3, name: "Forge Mastery", tier: 3, desc: "When the boss is defeated on Difficulty 5 there is a 10% chance for a Foresight Shrine to appear. Interacting adds a Foresight modifier to one item to preview the next craft before confirming.", parentsAll: ["cubeExpert"], parentsAny: [] },
    { id: "cubeCascade", cost: 3, name: "Cube Cascade", tier: 3, desc: "Every crafting cube has a 10% chance to not be consumed when used.", parentsAll: [], parentsAny: ["cubeExpert", "tinkerersEye"] },
    { id: "tinkererSocketMastery", cost: 3, name: "Socket Mastery", tier: 3, desc: "When applying a Socket Cube to a rare item that already has exactly 1 socket there is a 5% chance to add 2 additional sockets instead of 1 (total 3 sockets).", parentsAll: [], parentsAny: ["tinkerersEye", "socketFinder"] },
    { id: "rarityRush", cost: 3, name: "Rarity Rush", tier: 3, desc: "When the player defeats a mini-boss on Difficulty 3 or higher there is a 5% chance for a random legendary cube to drop.", parentsAll: [], parentsAny: ["socketFinder", "qualityEye"] },
    { id: "transmutation", cost: 3, name: "Transmutation", tier: 3, desc: "When upgrading a magic item to rare using a Rare Cube there is a 5% chance to add 3 additional modifiers instead of 2 (max 5 modifiers on that item).", parentsAll: ["qualityEye"], parentsAny: [] },
    // Tier 4 keystones
    { id: "perfectCraft", cost: 4, name: "Perfect Craft", tier: 4, desc: "When the boss is defeated on Difficulty 5 there is a 5% chance for a Perfection Workshop to appear. Interact to choose one item and reroll one random modifier to 45–50%.", parentsAll: [], parentsAny: ["forgeMastery", "cubeCascade"] },
    { id: "grandSocketeer", cost: 4, name: "Grand Socketeer", tier: 4, desc: "All modification cards socketed into skill slots have 50% increased effects.", parentsAll: [], parentsAny: ["cubeCascade", "tinkererSocketMastery"] },
    { id: "livingItem", cost: 4, name: "Living Item", tier: 4, desc: "Before starting a run select one white item from the Legacy Vault as Living Item. It gains one random modifier per mini-boss and two per boss (max 6). Cannot be modified by cubes.", parentsAll: [], parentsAny: ["tinkererSocketMastery", "rarityRush"] },
    { id: "philosophersStone", cost: 5, name: "Philosopher's Stone", tier: 4, desc: "Mini-bosses have a 5% chance to drop a legendary orange item with two legendary affixes and two random modifiers.", parentsAll: [], parentsAny: ["rarityRush", "transmutation"] }
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
  { id: "noHealthDrops", category: "player", icon: "🚫", name: "No Healing", desc: "No health drops from enemies" },
];

const ATTACK_TYPES = [
  { id: "projectile", name: "Projectile Shot", desc: "Fire a fast projectile toward the cursor. Reliable ranged damage." },
  { id: "fanStrike", name: "Fan Strike", desc: "Melee arc sweep in cursor direction. Hits all enemies in a 120° arc at short range." },
  { id: "pulseShot", name: "Pulse Shot", desc: "Call down an area strike at the cursor location. Damages all enemies in a small circle after a brief delay." },
  { id: "thrustStrike", name: "Thrust Strike", desc: "Fast precise thrust in cursor direction. Hits only the first enemy in line for 60% increased damage." },
  { id: "dashStrike", name: "Dash Strike", desc: "Surge forward through enemies, then perform a quick 90° fan strike at your destination." },
  { id: "backfireShot", name: "Backfire Shot", desc: "Fire a projectile forward while propelling yourself backward. Reposition and damage at once." }
];

/** Per–attack-type upgrade/penalty pools for level-up cards. Only projectile is populated; other types use empty arrays until implemented. */
const ATTACK_UPGRADE_DEFS = {
  projectile: {
    standardUpgrades: [
      { id: "extraProjectile", name: "Extra Projectile", description: "Adds 1 to simultaneous projectiles fired.", valueRange: null },
      { id: "flatDamage", name: "Flat Damage", description: "Adds 1 to 2 flat damage to base attack.", valueRange: { min: 1, max: 2, integer: true } },
      { id: "damageBoost", name: "Damage Boost", description: "Increases attack damage by 5% to 10%.", valueRange: { min: 5, max: 10, percent: true } },
      { id: "attackSpeed", name: "Attack Speed", description: "Increases attack speed by 5% to 10%.", valueRange: { min: 5, max: 10, percent: true } },
      { id: "projectileSpeed", name: "Projectile Speed", description: "Increases projectile speed by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "rangeBoost", name: "Range Boost", description: "Increases projectile max range by 15% to 20%.", valueRange: { min: 15, max: 20, percent: true } },
      { id: "spreadReduction", name: "Spread Reduction", description: "Tightens projectile spread for more accuracy.", valueRange: { min: 15, max: 25, percent: true } },
      { id: "critChance", name: "Crit Chance", description: "5% chance for projectiles to deal 150% damage.", valueRange: { min: 5, max: 5, percent: true } }
    ],
    standardPenalties: [
      { id: "slowShot", name: "Slow Shot", description: "Reduces projectile speed by 10%.", valueRange: { min: 10, max: 10, percent: true } },
      { id: "damageReduction", name: "Damage Reduction", description: "Reduces attack damage by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "speedPenalty", name: "Speed Penalty", description: "Reduces attack speed by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "fewerProjectiles", name: "Fewer Projectiles", description: "Reduces simultaneous projectiles by 1 (minimum 1).", valueRange: { min: 1, max: 1 } },
      { id: "reducedRange", name: "Reduced Range", description: "Reduces projectile max range by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "widerSpread", name: "Wider Spread", description: "Increases projectile spread, making shots less accurate.", valueRange: { min: 15, max: 25, percent: true } },
      { id: "fragileShot", name: "Fragile Shot", description: "Projectiles disappear after hitting 1 enemy even if piercing is active.", valueRange: null },
      { id: "cooldown", name: "Cooldown", description: "Adds 0.1 seconds to attack cooldown.", valueRange: { min: 0.1, max: 0.1 } }
    ],
    uniqueUpgrades: [
      { id: "piercing", name: "Piercing", description: "Projectiles pierce up to 3 enemies (default is 2)." },
      { id: "splitting", name: "Splitting", description: "Projectiles that travel 1s without hitting split into 2, up to 4 times (max 16)." },
      { id: "momentum", name: "Momentum", description: "Projectile damage +10% per second in flight, up to +100%." },
      { id: "seeking", name: "Seeking", description: "Projectiles curve toward the nearest enemy after 0.5s in flight." },
      { id: "chainLightning", name: "Chain Lightning", description: "On hit, up to 3 nearby enemies take 33% of the attack damage." },
      { id: "explosive", name: "Explosive", description: "Projectiles explode on impact, dealing 60% damage in a small area." },
      { id: "ghostProjectile", name: "Ghost Projectile", description: "Projectiles pass through all obstacles and walls." },
      { id: "overdrive", name: "Overdrive", description: "Every 5th projectile deals 300% damage at 2x size." }
    ],
    uniquePenalties: [
      { id: "randomDirection", name: "Random Direction", description: "Fires projectiles in a completely random direction." },
      { id: "oppositeFire", name: "Opposite Fire", description: "Fires projectiles in the exact opposite direction of the cursor." },
      { id: "misfire", name: "Misfire", description: "10% chance to fire nothing, consuming the attack but dealing no damage." },
      { id: "shrinking", name: "Shrinking", description: "Projectile hitbox shrinks by 5% every 0.5s in flight." },
      { id: "redirect", name: "Redirect", description: "Projectile direction randomly changes after 0.8s in flight." },
      { id: "selfKnockback", name: "Self Knockback", description: "Propels the player slightly backward on each shot." },
      { id: "delayedFire", name: "Delayed Fire", description: "0.3s delay between clicking and the projectile firing." },
      { id: "reducedProjectiles", name: "Reduced Projectiles", description: "Reduces max simultaneous projectiles by 1 (minimum 1)." }
    ]
  },
  fanStrike: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  pulseShot: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  thrustStrike: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  dashStrike: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  backfireShot: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] }
};

/** When offering unique card, avoid pairing these upgrade+penalty (e.g. Piercing + Fragile Shot). */
const CONTRADICTORY_UPGRADE_PENALTY = {
  piercing: ["fragileShot"],
  fragileShot: ["piercing"]
};

/** Display description for level-up card showing the rolled value (e.g. "7% increased attack damage"). */
function getUpgradeDisplayDescription(u) {
  if (u.value === undefined) return u.description || "";
  const v = u.value;
  const ids = {
    extraProjectile: () => "Adds 1 to simultaneous projectiles fired.",
    flatDamage: () => `Adds ${v} flat damage to base attack.`,
    damageBoost: () => `${v}% increased attack damage.`,
    attackSpeed: () => `${v}% increased attack speed.`,
    projectileSpeed: () => `${v}% increased projectile speed.`,
    rangeBoost: () => `${v}% increased projectile max range.`,
    spreadReduction: () => `${v}% tighter projectile spread.`,
    critChance: () => `${v}% chance for projectiles to deal 150% damage.`
  };
  return ids[u.id] ? ids[u.id]() : (u.description || "");
}

function getPenaltyDisplayDescription(p) {
  if (p.value === undefined) return p.description || "";
  const v = p.value;
  const ids = {
    slowShot: () => `${v}% reduced projectile speed.`,
    damageReduction: () => `${v}% reduced attack damage.`,
    speedPenalty: () => `${v}% reduced attack speed.`,
    fewerProjectiles: () => "1 fewer simultaneous projectile (minimum 1).",
    reducedRange: () => `${v}% reduced projectile max range.`,
    widerSpread: () => `${v}% wider projectile spread.`,
    fragileShot: () => "Projectiles disappear after hitting 1 enemy.",
    cooldown: () => `${v}s added to attack cooldown.`
  };
  return ids[p.id] ? ids[p.id]() : (p.description || "");
}

function rollUpgradeValue(def) {
  if (!def.valueRange) return undefined;
  const r = def.valueRange;
  if (r.percent || r.integer) {
    return Math.floor(r.min + Math.random() * (r.max - r.min + 1));
  }
  return r.min + Math.random() * (r.max - r.min);
}

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
            for (const e of hit) game.dealDamageToEnemy(e, p.damagePerTick, { isDot: true });
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
  { name: "Slime",    color: "#4ade80", size: 36, maxHealth: 40,  attack: 6,  speed: 60,  defense: 0, dropChance: 0.25, minDrop: 1, maxDrop: 1, minXp: 10, maxXp: 20 },
  { name: "Bat",      color: "#c084fc", size: 28, maxHealth: 25,  attack: 8,  speed: 100, defense: 0, dropChance: 0.2,  minDrop: 1, maxDrop: 1, minXp: 10, maxXp: 20 },
  { name: "Skeleton", color: "#e2e8f0", size: 38, maxHealth: 60,  attack: 10, speed: 70,  defense: 2, dropChance: 0.45, minDrop: 1, maxDrop: 2, minXp: 30, maxXp: 50 },
  { name: "Demon",    color: "#f87171", size: 44, maxHealth: 100, attack: 15, speed: 50,  defense: 3, dropChance: 0.55, minDrop: 1, maxDrop: 2, minXp: 30, maxXp: 50 },
  { name: "Wisp",     color: "#67e8f9", size: 30, maxHealth: 20,  attack: 5,  speed: 130, defense: 0, dropChance: 0.18, minDrop: 1, maxDrop: 1, minXp: 10, maxXp: 20 },
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

/* Level-up stat bonuses replaced by attack upgrade/penalty cards (see ATTACK_UPGRADE_DEFS and showLevelUpChoices). */

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

    // Debuffs from modification cards (element mods)
    this.defense = typeDef.defense ?? 0;
    this.burnUntil = null;
    this.burnDps = 0;
    this.burnAccum = 0;
    this.toxicStacks = 0;
    this.toxicUntil = null;
    this.toxicAccum = 0;
    this.voidDefenseUntil = null;
    this.voidDefenseMult = 1;
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

  draw(ctx, camera, gameTime = null) {
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
    const cx = sx + this.size / 2;
    const cy = sy + this.size / 2;
    if (gameTime != null) {
      if (this.burnUntil != null && gameTime < this.burnUntil) {
        ctx.fillStyle = `rgba(251, 146, 60, 0.4)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.burnUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
      if (this.slowUntil != null && gameTime < this.slowUntil) {
        ctx.fillStyle = `rgba(147, 197, 253, 0.45)`;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(sx, sy, this.size, this.size);
        ctx.globalAlpha = 1;
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.slowUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
      if (this.stunUntil != null && gameTime < this.stunUntil) {
        ctx.fillStyle = `rgba(250, 204, 21, 0.6)`;
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 4, 4, 0, Math.PI * 2);
        ctx.arc(cx - 4, cy + 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.stunUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
      if (this.toxicStacks > 0 && this.toxicUntil != null && gameTime < this.toxicUntil) {
        ctx.fillStyle = `rgba(34, 197, 94, 0.5)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.toxicUntil - gameTime).toFixed(1) + "s x" + this.toxicStacks, cx, sy - 4);
      }
      if (this.voidDefenseUntil != null && gameTime < this.voidDefenseUntil) {
        ctx.strokeStyle = `rgba(88, 28, 135, 0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#e9d5ff";
        ctx.textAlign = "center";
        ctx.fillText((this.voidDefenseUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
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
  constructor(x, y, targetX, targetY, damage, options = {}) {
    this.position = new Vec2(x, y);
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speedMult = options.speedMult != null ? options.speedMult : 1;
    const speed = PLAYER_PROJECTILE_SPEED * speedMult;
    this.velocity = new Vec2((dx / dist) * speed, (dy / dist) * speed);
    this.damage = damage;
    this.size = options.overdrive ? PLAYER_PROJECTILE_SIZE * 2 : PLAYER_PROJECTILE_SIZE;
    if (options.overdrive) this.damage = this.damage * 3;
    this.trail = [];
    this.distanceTraveled = 0;
    this.hitEnemyIds = new Set();
    this.maxLifetime = null;
    this.age = 0;
    this.flightTime = 0;
    this.piercesRemaining = options.piercesRemaining != null ? options.piercesRemaining : 2;
    this.piercing = this.piercesRemaining > 0;
    this.fragileShot = !!options.fragileShot;
    this.ghost = !!options.ghost;
    this.splitting = !!options.splitting;
    this.splitCount = options.splitCount || 0;
    this.maxDist = PLAYER_PROJECTILE_MAX_DIST * (options.maxDistMult != null ? options.maxDistMult : 1);
    this._spawn = null;
  }

  update(dt, game = null) {
    this.trail.push({ x: this.position.x, y: this.position.y });
    if (this.trail.length > PLAYER_PROJECTILE_TRAIL_LEN) this.trail.shift();

    if (this.maxLifetime != null) this.age += dt;
    this.flightTime += dt;

    const homing = game && game.hasUpgradeCard && game.hasUpgradeCard("homing");
    const seeking = game && game.hasAttackUpgrade && game.hasAttackUpgrade("seeking");
    const useHoming = homing || (seeking && this.flightTime >= 0.5);
    if (useHoming) {
      const px = this.position.x + this.size / 2;
      const py = this.position.y + this.size / 2;
      const target = game.getNearestEnemy(px, py, 400, this.hitEnemyIds);
      if (target) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - px;
        const dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const curSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || PLAYER_PROJECTILE_SPEED;
        this.velocity.x = (dx / dist) * curSpeed * 0.15 + this.velocity.x * 0.85;
        this.velocity.y = (dy / dist) * curSpeed * 0.15 + this.velocity.y * 0.85;
        const vlen = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || 1;
        this.velocity.x = (this.velocity.x / vlen) * curSpeed;
        this.velocity.y = (this.velocity.y / vlen) * curSpeed;
      }
    }

    if (game && game.hasAttackUpgrade && game.hasAttackUpgrade("splitting") && this.splitting && this.splitCount < 4 && this.flightTime >= 1 && this.hitEnemyIds.size === 0) {
      const curSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || PLAYER_PROJECTILE_SPEED;
      const angle = Math.atan2(this.velocity.y, this.velocity.x);
      const spreadRad = (15 * Math.PI / 180) / 2;
      const opt = {
        speedMult: curSpeed / PLAYER_PROJECTILE_SPEED,
        maxDistMult: this.maxDist / PLAYER_PROJECTILE_MAX_DIST,
        piercesRemaining: this.piercesRemaining,
        fragileShot: this.fragileShot,
        splitting: true,
        splitCount: this.splitCount + 1,
        ghost: this.ghost
      };
      const tx = this.position.x + this.velocity.x;
      const ty = this.position.y + this.velocity.y;
      const p1 = new PlayerProjectile(this.position.x, this.position.y, this.position.x + Math.cos(angle - spreadRad) * 100, this.position.y + Math.sin(angle - spreadRad) * 100, this.damage, opt);
      p1.velocity.x = Math.cos(angle - spreadRad) * curSpeed;
      p1.velocity.y = Math.sin(angle - spreadRad) * curSpeed;
      p1.hitEnemyIds = new Set(this.hitEnemyIds);
      p1.maxLifetime = this.maxLifetime;
      const p2 = new PlayerProjectile(this.position.x, this.position.y, this.position.x + Math.cos(angle + spreadRad) * 100, this.position.y + Math.sin(angle + spreadRad) * 100, this.damage, opt);
      p2.velocity.x = Math.cos(angle + spreadRad) * curSpeed;
      p2.velocity.y = Math.sin(angle + spreadRad) * curSpeed;
      p2.hitEnemyIds = new Set(this.hitEnemyIds);
      p2.maxLifetime = this.maxLifetime;
      this._spawn = [p1, p2];
    }

    const moveX = this.velocity.x * dt;
    const moveY = this.velocity.y * dt;
    this.position.x += moveX;
    this.position.y += moveY;
    this.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
  }

  isExpired() {
    if (this.maxLifetime != null && this.age >= this.maxLifetime) return true;
    if (this.ghost) return this.distanceTraveled >= this.maxDist * 3;
    return this.distanceTraveled >= this.maxDist;
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

    this.defense = 5;
    this.burnUntil = null;
    this.burnDps = 0;
    this.burnAccum = 0;
    this.slowUntil = null;
    this.slowMult = 1;
    this.stunUntil = null;
    this.toxicStacks = 0;
    this.toxicUntil = null;
    this.toxicAccum = 0;
    this.voidDefenseUntil = null;
    this.voidDefenseMult = 1;
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

  draw(ctx, camera, gameTime = null) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);

    ctx.fillStyle = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    ctx.fillRect(sx, sy, this.size, this.size);
    ctx.strokeStyle = this.phase2 ? "#ff4444" : "#4a0000";
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, this.size, this.size);
    const cx = sx + this.size / 2;
    const cy = sy + this.size / 2;
    if (gameTime != null) {
      if (this.burnUntil != null && gameTime < this.burnUntil) {
        ctx.fillStyle = `rgba(251, 146, 60, 0.4)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.burnUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
      if (this.slowUntil != null && gameTime < this.slowUntil) {
        ctx.fillStyle = `rgba(147, 197, 253, 0.45)`;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(sx, sy, this.size, this.size);
        ctx.globalAlpha = 1;
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.slowUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
      if (this.stunUntil != null && gameTime < this.stunUntil) {
        ctx.fillStyle = `rgba(250, 204, 21, 0.6)`;
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 6, 6, 0, Math.PI * 2);
        ctx.arc(cx - 6, cy + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.stunUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
      if (this.toxicStacks > 0 && this.toxicUntil != null && gameTime < this.toxicUntil) {
        ctx.fillStyle = `rgba(34, 197, 94, 0.5)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.toxicUntil - gameTime).toFixed(1) + "s x" + this.toxicStacks, cx, sy - 6);
      }
      if (this.voidDefenseUntil != null && gameTime < this.voidDefenseUntil) {
        ctx.strokeStyle = `rgba(88, 28, 135, 0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#e9d5ff";
        ctx.textAlign = "center";
        ctx.fillText((this.voidDefenseUntil - gameTime).toFixed(1) + "s", cx, sy - 6);
      }
    }
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

/** Secondary base stat: Helmet gets defense (lower than body), Body Armour gets maxHealth (lower than helmet). */
const EQUIPMENT_SECONDARY_BASE = {
  Helmet: { statKey: "defense", range: { min: 1, max: 8 } },
  "Body Armour": { statKey: "maxHealth", range: { min: 1, max: 15 } }
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
  { id: "cooldownReductionPercent", label: "Cooldown Reduction", statKey: "cooldownRecovery" },
  { id: "defenseStatScale", label: "Defense +20-100%", statKey: "defense", localStatScale: true },
  { id: "maxHealthStatScale", label: "Max Health +20-100%", statKey: "maxHealth", localStatScale: true }
];

const ARMOUR_SLOT_TYPES = ["Helmet", "Body Armour"];
const LOCAL_STAT_SCALE_MOD_IDS = ["defenseStatScale", "maxHealthStatScale"];

function getModifierPoolForType(type) {
  const pool = [...MODIFIER_POOL];
  if (!ARMOUR_SLOT_TYPES.includes(type)) {
    return pool.filter((m) => !LOCAL_STAT_SCALE_MOD_IDS.includes(m.id));
  }
  return pool;
}

function rollLocalStatScaleValue() {
  return 0.2 + Math.random() * 0.8;
}

/** Modifier value ranges by difficulty for dropped items (normal modifiers: 5-15% to 25-50%; local stat scale: ×2). */
const MODIFIER_ROLL_BY_DIFFICULTY = {
  1: { min: 0.05, max: 0.15 },
  2: { min: 0.10, max: 0.25 },
  3: { min: 0.15, max: 0.35 },
  4: { min: 0.20, max: 0.40 },
  5: { min: 0.25, max: 0.50 }
};

const LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY = {
  1: { min: 0.10, max: 0.30 },
  2: { min: 0.20, max: 0.50 },
  3: { min: 0.30, max: 0.70 },
  4: { min: 0.40, max: 0.80 },
  5: { min: 0.50, max: 1.0 }
};

function rollModifierValueForDifficulty(difficulty) {
  const r = MODIFIER_ROLL_BY_DIFFICULTY[difficulty];
  if (!r) return rollModifierValue();
  return r.min + Math.random() * (r.max - r.min);
}

function rollLocalStatScaleValueForDifficulty(difficulty) {
  const r = LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY[difficulty];
  if (!r) return rollLocalStatScaleValue();
  return r.min + Math.random() * (r.max - r.min);
}

const NAME_PREFIXES = ["Twisted", "Cursed", "Blessed", "Ancient", "Rotten", "Void", "Storm", "Frost", "Flame", "Shadow"];
const NAME_SUFFIXES = ["of the Fox", "of the Bear", "of Power", "of Swiftness", "of the Titan", "of the Wolf", "of the Owl", "of the Serpent"];

const RARITY_COLORS = { common: "#e2e8f0", magic: "#60a5fa", rare: "#facc15", legendary: "#f97316" };

const LEGENDARY_CUBES = [
  { id: "eternalCube", label: "Eternal Cube", modifierId: "eternal", modifierLabel: "Eternal" },
  { id: "generativeCube", label: "Generative Cube", modifierId: "generative", modifierLabel: "Generative" },
  { id: "blessedCube", label: "Blessed Cube", modifierId: "blessed", modifierLabel: "Blessed" }
];

const LEGENDARY_MODIFIER_IDS = ["eternal", "generative", "blessed", "foresight"];
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

function getCubeLabel(cubeKey) {
  const leg = LEGENDARY_CUBES.find((c) => c.id === cubeKey);
  if (leg) return leg.label;
  const match = cubeKey.match(/^(.+?)T(\d)$/);
  if (match) {
    const [, id, tier] = match;
    const mod = MODIFIER_CUBES.find((c) => c.id === id);
    const upg = UPGRADE_CUBES.find((c) => c.id === id);
    const base = mod || upg;
    if (base) return `${base.label} T${tier}`;
  }
  return cubeKey;
}

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

function generateEquipmentItem(type, lootQuality, qualityBonus = 0, forceRarity = null, options = {}) {
  const rarity = forceRarity || getRarityRoll(lootQuality, qualityBonus);
  const baseKey = EQUIPMENT_BASE_STAT[type];
  const range = EQUIPMENT_BASE_RANGES[type];
  const scale = 0.4 + 0.6 * (0.5 + lootQuality / 2);
  const baseValue = Math.round(range.min + (range.max - range.min) * scale);
  const baseStat = { [baseKey]: baseValue };
  const sec = EQUIPMENT_SECONDARY_BASE[type];
  if (sec) {
    const secValue = Math.round(sec.range.min + (sec.range.max - sec.range.min) * scale);
    baseStat[sec.statKey] = secValue;
  }

  let weight = null;
  if (WEIGHT_OPTIONS[type]) {
    const opts = WEIGHT_OPTIONS[type];
    weight = opts[Math.floor(Math.random() * opts.length)];
  }

  const difficulty = options.difficulty != null ? options.difficulty : null;
  const rollNormal = difficulty != null ? () => rollModifierValueForDifficulty(difficulty) : rollModifierValue;
  const rollLocal = difficulty != null ? () => rollLocalStatScaleValueForDifficulty(difficulty) : rollLocalStatScaleValue;

  const modifiers = [];
  if (rarity === "magic") {
    const pool = getModifierPoolForType(type);
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocal() : rollNormal();
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
    }
    if (options.qualityEye && modifiers.length > 0) {
      const idx = Math.floor(Math.random() * modifiers.length);
      const mod = modifiers[idx];
      if (mod.value < 0.3 && !LOCAL_STAT_SCALE_MOD_IDS.includes(mod.id)) {
        mod.value = 0.3 + Math.random() * 0.1;
        if (difficulty != null) {
          const r = MODIFIER_ROLL_BY_DIFFICULTY[difficulty];
          if (r) mod.value = Math.min(mod.value, r.max);
        }
      }
    }
  } else if (rarity === "rare") {
    const pool = getModifierPoolForType(type);
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocal() : rollNormal();
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
    }
  }

  const socketChance = (options.socketSense ? 0.18 : 0.15);
  const socketRoll = Math.random();
  const sockets = socketRoll < 0.03 ? 2 : socketRoll < socketChance ? 1 : 0;

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
    if (m.id === "defenseStatScale") {
      stats.defense = Math.round((stats.defense || 0) * (1 + m.value));
    } else if (m.id === "maxHealthStatScale") {
      stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + m.value));
    } else if (m.statKey === "attackSpeed") {
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
    stats,
    sockets: sockets
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
];

const LOOT_COLORS = {
  Helmet: "#38bdf8",
  Boots: "#f97316",
  "Body Armour": "#a855f7",
  Weapon: "#facc15",
  Cube: "#a78bfa"
};

const LOOT_ICONS = {
  Helmet: "🪖",
  Boots: "👢",
  "Body Armour": "🛡️",
  Weapon: "⚔️",
  Cube: "◆"
};

let GLOBAL_LUCK = 0;

class LootItem {
  constructor(id, x, y, definition, burstFromX = null, burstFromY = null) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.size = 20;
    this.type = definition.type;
    this.name = definition.name;
    this.cubeKey = definition.cubeKey ?? null;
    this.stats = definition.stats || {};
    this.cardKey = definition.cardKey || null;
    this.description = definition.description || "";
    this.weight = definition.weight || null;
    this.rarity = definition.rarity || null;
    this.modifiers = definition.modifiers || [];
    this.baseStat = definition.baseStat || null;
    this.sockets = definition.sockets ?? 0;
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
    this.difficulty = 1;
  }

  setMapLootQuality(quality) {
    this.mapLootQuality = quality;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty != null ? Math.min(5, Math.max(1, difficulty)) : 1;
  }

  getLootDefinition(qualityBonus = 0) {
    const group = LOOT_DEFS[Math.floor(Math.random() * LOOT_DEFS.length)];
    const opts = this.difficulty != null ? { difficulty: this.difficulty } : {};
    return generateEquipmentItem(group.type, this.mapLootQuality, qualityBonus, null, opts);
  }

  spawnGuaranteedWeaponAt(centerX, centerY) {
    const opts = this.difficulty != null ? { difficulty: this.difficulty } : {};
    const def = generateEquipmentItem("Weapon", Math.min(1, this.mapLootQuality + 0.5), 0.5, null, opts);
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

  spawnCubeAt(centerX, centerY, cubeKey) {
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 24;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 24;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const def = { type: "Cube", name: getCubeLabel(cubeKey), cubeKey };
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
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
    this.attackType = runConfig.attackType || "projectile";
    (this.skills || []).forEach((id) => { if (id) markSkillEncountered(id); });
    this.skillCooldowns = [0, 0, 0, 0];
    this.skillEffects = [];
    this.skillChargeSlot = null;
    this.skillChargeStartTime = null;
    this.chainCastQueue = [];
    this.empowerStacks = [0, 0, 0, 0];
    this.playerHasteUntil = 0;
    this.playerHasteMult = 1;
    this.skillCascadeFlashUntil = {};
    this.devModOverrides = { 0: [], 1: [], 2: [], 3: [] };
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
    this.rootedMinionsSpawned = 0;

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
      baseStat: item.baseStat || null,
      sockets: item.sockets ?? 0
    }));
    if (hasTalent("livingItem")) {
      const firstCommon = this.inventory.find((it) => it.type !== "Upgrade Card" && (it.rarity === "common" || !it.rarity));
      if (firstCommon) firstCommon.livingItem = true;
    }
    this.cubeInventory = {};
    const stash = consumeLegacyCubeStash();
    for (const [key, count] of Object.entries(stash)) {
      this.cubeInventory[key] = (this.cubeInventory[key] || 0) + count;
    }
    this.inventoryListEl = document.getElementById("inventory-list");
    this.equippedListEl = document.getElementById("equipped-list");
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
      if (hasTalent("resilient")) this.baseStats.maxHealth = Math.round(this.baseStats.maxHealth * 1.1);
      if (hasTalent("fortitude")) this.baseStats.maxHealth = Math.round(this.baseStats.maxHealth * 1.1);
      if (hasTalent("thickSkin")) this.baseStats.maxHealth = Math.round(this.baseStats.maxHealth * 1.15);
      if (hasTalent("fierce")) this.baseStats.attack = Math.round(this.baseStats.attack * 1.1);
      if (hasTalent("nimble")) this.baseStats.speed = Math.round(this.baseStats.speed * 1.05);
      if (this.hasCondition("startHealth")) this.baseStats.maxHealth = Math.max(10, this.baseStats.maxHealth - 30);
      if (this.hasCondition("startAttack")) this.baseStats.attack = Math.round(this.baseStats.attack * 0.8);
      if (this.hasCondition("startSpeed")) this.baseStats.speed = Math.round(this.baseStats.speed * 0.8);
    }
    this.talentAttackSpeedMult = hasTalent("rapid") ? 1.1 : 1;
    this.currentStats = { ...this.baseStats };
    this.currentHealth = this.baseStats.maxHealth;
    this.timeSinceLastHit = 0;

    this.equipment = {
      Helmet: null,
      "Body Armour": null,
      Weapon: null,
      Boots: null
    };

    this.level = 1;
    this.xp = 0;
    this.levelUpChoices = null;
    this.runAttackUpgrades = [];
    this.runAttackPenalties = [];
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
    const lootQual = this.currentMap.lootQuality;
    this.lootSystem.setMapLootQuality(lootQual);
    this.lootSystem.setDifficulty(this.difficulty);

    this.enemySystem = new EnemySystem(this.world, this.currentMap, this.conditions, this.difficulty);
    this.enemySystem.spawnInitial();

    if (hasTalent("socketFinder") && Math.random() < 0.2) {
      const m = this.world.wallThickness + 80;
      this.mapInteractables.push({
        type: "socketWorkshop",
        x: m + Math.random() * (this.world.width - 2 * m - 64),
        y: m + Math.random() * (this.world.height - 2 * m - 64),
        w: 64,
        h: 64
      });
    }

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
    this.pulseOrbs = [];
    this.dashStrikeState = null;
    this.backfireDashState = null;
    this.doubleStrikeCounter = 0;

    this.exitTransitionCooldown = 0;
    this.victoryPortal = null;
    this.victoryPortalTimer = 0;
    this.mapInteractables = [];
    this.nearInteractable = null;
    this.activeBlessings = [];

    this.dashDuration = 0.3;
    this.dashInvincibleStart = 0.1;
    this.dashInvincibleDuration = 0.1;
    let baseDash = hasTalent("swiftExtraction") ? 0.7 : 0.8;
    if (hasTalent("reflexes")) baseDash = Math.max(0.1, baseDash - 0.1);
    this.baseDashCooldownTime = baseDash;
    this.dashCooldownTime = this.baseDashCooldownTime;
    this.dashSpeedMult = 3;
    this.dashActive = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection = new Vec2(0, 0);
    this.dashTrail = [];
    this.floatingCombatText = [];
    this.lastMouseWorld = { x: 0, y: 0 };
    this.spaceConsumed = false;
    this.mouseHeld = false;

    this.secureFootingUntil = 0;
    this.cardSurgeUntil = 0;
    this.ghostLooterUntargetableUntil = 0;
    this.phantomExtractorUntil = 0;
    this.phantomExtractorCooldownUntil = 0;
    this.curatorUsedThisRun = false;

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
    if (hasTalent("immortal")) this.immortalShield = 30;
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
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "1") this.tryReleaseChargedSkill(0);
      if (k === "2") this.tryReleaseChargedSkill(1);
      if (k === "3") this.tryReleaseChargedSkill(2);
      if (k === "4") this.tryReleaseChargedSkill(3);
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
          cb.addEventListener("change", () => {
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
      buildLogToggle.addEventListener("click", () => {
        buildLogPanel.classList.toggle("hidden");
        if (!buildLogPanel.classList.contains("hidden") && this.buildLogRefresh) this.buildLogRefresh();
      });
    }
    if (buildLogClose && buildLogPanel) {
      buildLogClose.addEventListener("click", () => buildLogPanel.classList.add("hidden"));
    }
    this.buildLogRefresh = () => {
      const listEl = document.getElementById("build-log-list");
      if (!listEl) return;
      listEl.innerHTML = "";
      const ups = this.runAttackUpgrades || [];
      const pens = this.runAttackPenalties || [];
      for (let i = 0; i < Math.max(ups.length, pens.length); i++) {
        if (ups[i]) {
          const li = document.createElement("li");
          li.className = "build-log-upgrade";
          li.textContent = `↑ ${ups[i].name}`;
          listEl.appendChild(li);
        }
        if (pens[i]) {
          const li = document.createElement("li");
          li.className = "build-log-penalty";
          li.textContent = `↓ ${pens[i].name}`;
          listEl.appendChild(li);
        }
      }
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
      devApplyForce.addEventListener("click", () => {
        const uId = devForceUpgrade.value;
        const pId = devForcePenalty.value;
        if (!uId || !pId) return;
        const uDef = allUpgrades.find((x) => x.id === uId);
        const pDef = allPenalties.find((x) => x.id === pId);
        if (!uDef || !pDef) return;
        this.runAttackUpgrades.push({ id: uDef.id, name: uDef.name, description: uDef.description, value: rollUpgradeValue(uDef), percent: !!uDef.valueRange?.percent });
        this.runAttackPenalties.push({ id: pDef.id, name: pDef.name, description: pDef.description, value: rollUpgradeValue(pDef), percent: !!pDef.valueRange?.percent });
        if (this.buildLogRefresh) this.buildLogRefresh();
      });
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
    const invList = document.getElementById("inventory-overlay-inventory-list");
    if (!equippedList || !invList) return;

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

  getLivingItem() {
    for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
      const item = this.equipment[slot];
      if (item?.livingItem) return item;
    }
    return this.inventory.find((it) => it.livingItem) || null;
  }

  getCraftableEquipmentItems() {
    const items = [];
    for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
      const item = this.equipment[slot];
      if (item && item.rarity !== "legendary" && !item.livingItem) items.push({ item, source: "equipped", slot });
    }
    for (let i = 0; i < this.inventory.length; i++) {
      const item = this.inventory[i];
      if (item.type !== "Upgrade Card" && item.rarity !== "legendary" && !item.livingItem && (item.type === "Helmet" || item.type === "Body Armour" || item.type === "Weapon" || item.type === "Boots")) {
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
      const item = this.craftingSelectedItem;
      if (item.rarity === "legendary") {
        preview = "Legendary items cannot be further crafted.";
      } else {
      const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
      const [cubeId, tierStr] = this.craftingSelectedCube.match(/(.+)T(\d)$/)?.slice(1) || [null, "1"];
      const tier = parseInt(tierStr || "1", 10);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));

      if (legCube) {
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
    }
    previewEl.textContent = preview;
    previewEl.classList.toggle("hidden", !preview);
    confirmBtn.disabled = !canCraft;
  }

  executeCraft() {
    if (!this.craftingSelectedItem || !this.craftingSelectedCube) return;
    if (this.craftingSelectedItem.rarity === "legendary") return;
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

    const cascadeSave = hasTalent("cubeCascade") && Math.random() < 0.1;
    if (!cascadeSave) {
      this.cubeInventory[cubeKey] = count - 1;
      if (this.cubeInventory[cubeKey] === 0) delete this.cubeInventory[cubeKey];
    }
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
      const pool = getModifierPoolForType(item.type);
      for (let i = 0; i < 2; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValue() : rollModifierForTier(tier);
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
      const pool = getModifierPoolForType(item.type).filter((p) => !item.modifiers.some((m) => m.id === p.id));
      const extraMods = hasTalent("transmutation") && Math.random() < 0.05 ? 3 : 2;
      for (let i = 0; i < extraMods; i++) {
        if (pool.length === 0) break;
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValue() : rollModifierForTier(tier);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
      const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
      const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
      if (!hasPrefix) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
      if (!hasSuffix) item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
    } else if (cubeDef.id === "reforgeCube") {
      item.modifiers = [];
      const pool = getModifierPoolForType(item.type);
      const count = item.rarity === "magic" ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValue() : rollModifierForTier(tier);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
    }
    this.rebuildItemStats(item);
  }

  rebuildItemStats(item) {
    const baseKey = EQUIPMENT_BASE_STAT[item.type];
    if (!item.baseStat && item.stats) {
      item.baseStat = { [baseKey]: item.stats[baseKey] ?? 0 };
      const sec = EQUIPMENT_SECONDARY_BASE[item.type];
      if (sec) item.baseStat[sec.statKey] = item.stats[sec.statKey] ?? 0;
    }
    const stats = { ...(item.baseStat || {}) };
    for (const m of item.modifiers || []) {
      if (LEGENDARY_MODIFIER_IDS.includes(m.id)) continue;
      if (m.id === "defenseStatScale") {
        stats.defense = Math.round((stats.defense || 0) * (1 + m.value));
      } else if (m.id === "maxHealthStatScale") {
        stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + m.value));
      } else if (m.statKey === "attackSpeed") {
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
    const statsEl = document.getElementById("victory-stats");
    if (equippedEl) {
      equippedEl.innerHTML = "";
      for (const [slot, item] of Object.entries(this.equipment)) {
        const div = document.createElement("div");
        div.textContent = `${slot}: ${item ? item.name : "None"}`;
        equippedEl.appendChild(div);
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
    if (this.hasUpgradeCard("secureFooting") && this.swiftFeetTimer > 0) {
      this.swiftFeetTimer -= dt;
      if (this.swiftFeetTimer < 0) this.swiftFeetTimer = 0;
      effectiveSpeed *= 1.5;
    }
    if (this.hasUpgradeCard("berserkerRage")) {
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
    if (hasTalent("secureFooting") && this.secureFootingUntil > this.time) effectiveSpeed *= 1.3;
    if (hasTalent("cardSurge") && this.cardSurgeUntil > this.time) effectiveSpeed *= 1.15;
    if (this.playerSlowUntil > this.time) effectiveSpeed *= (this.playerSlowMult ?? 0.7);
    if (this.playerHasteUntil > this.time) effectiveSpeed *= (this.playerHasteMult ?? 1);
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
          const slot = this.bladeDashSlot;
          const mods = slot != null ? getModsForSkillSlot(this, slot) : [];
          this.dealDamageToEnemy(e, this.computeSkillDamage(e, this.bladeDashMult, slot, { sacrificeMult: this.bladeDashSacrificeMult }), { isSkill: true, skillSlot: slot, modList: mods });
        }
      }
      if (this.bladeDashTimer <= 0) {
        this.bladeDashActive = false;
        this.bladeDashHitIds.clear();
      }
    } else if (this.dashStrikeState) {
      // Player position is driven by updateDashStrike
    } else if (this.backfireDashState) {
      // Player position is driven by updateBackfireDash
    } else if (this.stunTimer <= 0) {
      this.player.update(dt, this.input, this.world);
    }
    if (this.playerHasteUntil > this.time) {
      this.adrenalineTrail = this.adrenalineTrail || [];
      this.adrenalineTrail.push({ x: this.player.position.x, y: this.player.position.y });
      if (this.adrenalineTrail.length > 12) this.adrenalineTrail.shift();
    } else {
      this.adrenalineTrail = [];
    }

    if (this.hasUpgradeCard("cubeMagnet")) this.applyMagnetEffect(dt);

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
    this.nearInteractable = null;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    for (const obj of this.mapInteractables) {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      if (Math.abs(px - cx) < 80 && Math.abs(py - cy) < 80) {
        this.nearInteractable = obj;
        break;
      }
    }
    if (this.nearInteractable && this.input.keys.has("e")) {
      this.interactWithMapObject(this.nearInteractable);
      this.mapInteractables = this.mapInteractables.filter((o) => o !== this.nearInteractable);
      this.nearInteractable = null;
    }
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
    this.enemySystem.enemies = [];
    this.enemySystem.boss = null;
    this.enemySystem.projectiles = [];
    this.enemySystem.respawnQueue = [];
    this.enemySystem.setMap(targetMap);
    this.enemySystem.spawnInitial();

    if (this.escortQuest?.active && targetMapId === 0) {
      this.resolveStrangerQuest();
    }

    this.mapInteractables = [];
    if (hasTalent("socketFinder") && Math.random() < 0.2) {
      const margin = this.world.wallThickness + 80;
      const ix = margin + Math.random() * (this.world.width - 2 * margin - 64);
      const iy = margin + Math.random() * (this.world.height - 2 * margin - 64);
      this.mapInteractables.push({ type: "socketWorkshop", x: ix, y: iy, w: 64, h: 64 });
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
        // No reward (upgrade cards removed)
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "shrine") {
      if (choiceId === "offerXp") {
        const sacrifice = Math.floor(this.xp * 0.3);
        this.xp -= sacrifice;
        this.updateXpUI();
      } else if (choiceId === "destroy") {
        this.inventory = [];
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
    const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
    const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.5, 0.65, null, { difficulty: diff });
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
    const rounded = Math.round(amount * mult);
    this.xp += rounded;
    this.updateXpUI();
    this.checkLevelUp();
    for (let i = 0; i < (this.skills?.length || 0); i++) {
      const skillId = this.skills[i];
      if (!skillId) continue;
      markSkillEncountered(skillId);
      const result = addSkillXp(skillId, rounded);
      if (result && result.leveledUp) {
        this.skillLevelUpThisFrame = this.skillLevelUpThisFrame || [];
        this.skillLevelUpThisFrame.push({ skillId, level: result.level });
      }
    }
  }

  checkLevelUp() {
    if (this.levelUpChoices) return;
    const nextThreshold = getXpForLevel(this.level + 1);
    if (this.xp >= nextThreshold) {
      this.level++;
      if (hasTalent("cardTranscendence") && Math.random() < 0.1) {
        const card = MODIFICATION_CARD_DEFS[Math.floor(Math.random() * MODIFICATION_CARD_DEFS.length)];
        addModCardToInventory(card.id);
      }
      this.showLevelUpChoices();
    }
  }

  buildLevelUpCards() {
    const defs = ATTACK_UPGRADE_DEFS[this.attackType];
    if (!defs) return [];
    const takenUpgrades = new Set((this.runAttackUpgrades || []).map((u) => u.id));
    const takenPenalties = new Set((this.runAttackPenalties || []).map((p) => p.id));

    const pickStandardUpgrade = () => {
      const pool = (defs.standardUpgrades || []).filter((u) => !takenUpgrades.has(u.id));
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      const value = rollUpgradeValue(def);
      return { id: def.id, name: def.name, description: def.description, value };
    };
    const pickStandardPenalty = () => {
      const pool = (defs.standardPenalties || []).filter((p) => !takenPenalties.has(p.id));
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      const value = rollUpgradeValue(def);
      return { id: def.id, name: def.name, description: def.description, value };
    };
    const pickUniqueUpgrade = () => {
      const pool = (defs.uniqueUpgrades || []).filter((u) => !takenUpgrades.has(u.id));
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      return { id: def.id, name: def.name, description: def.description, value: undefined };
    };
    const pickUniquePenalty = (excludeIds = []) => {
      const pool = (defs.uniquePenalties || []).filter(
        (p) => !takenPenalties.has(p.id) && !excludeIds.includes(p.id)
      );
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      return { id: def.id, name: def.name, description: def.description, value: undefined };
    };

    const cards = [];
    const usedInOfferUp = new Set();
    const usedInOfferPen = new Set();
    for (let i = 0; i < 2; i++) {
      const upgrades = [];
      for (let j = 0; j < 2; j++) {
        const poolUp = (defs.standardUpgrades || []).filter((u) => !takenUpgrades.has(u.id) && !usedInOfferUp.has(u.id));
        if (poolUp.length === 0) break;
        const defUp = poolUp[Math.floor(Math.random() * poolUp.length)];
        const upgrade = { id: defUp.id, name: defUp.name, description: defUp.description, value: rollUpgradeValue(defUp), percent: !!defUp.valueRange?.percent };
        upgrades.push(upgrade);
        usedInOfferUp.add(upgrade.id);
      }
      const poolPen = (defs.standardPenalties || []).filter((p) => !takenPenalties.has(p.id) && !usedInOfferPen.has(p.id));
      if (upgrades.length < 2 || poolPen.length === 0) break;
      const defPen = poolPen[Math.floor(Math.random() * poolPen.length)];
      const penalty = { id: defPen.id, name: defPen.name, description: defPen.description, value: rollUpgradeValue(defPen), percent: !!defPen.valueRange?.percent };
      cards.push({ upgrades, penalty, isUnique: false });
      usedInOfferPen.add(penalty.id);
    }
    const uUpgrades = [];
    const showUniqueCard = this.level === 5 || this.level === 10;
    if (showUniqueCard) {
      const usedUniqueUp = new Set();
      for (let j = 0; j < 1; j++) {
        const poolU = (defs.uniqueUpgrades || []).filter((u) => !takenUpgrades.has(u.id) && !usedUniqueUp.has(u.id));
        if (poolU.length === 0) break;
        const defU = poolU[Math.floor(Math.random() * poolU.length)];
        uUpgrades.push({ id: defU.id, name: defU.name, description: defU.description, value: undefined });
        usedUniqueUp.add(defU.id);
      }
      let blockedPenalties = [];
      for (const u of uUpgrades) {
        blockedPenalties = blockedPenalties.concat(CONTRADICTORY_UPGRADE_PENALTY[u.id] || []);
      }
      const uPen = pickUniquePenalty(blockedPenalties);
      if (uUpgrades.length === 1 && uPen) {
        cards.push({ upgrades: uUpgrades, penalty: uPen, isUnique: true });
      }
    }

    return cards;
  }

  showLevelUpChoices() {
    this.levelUpChoices = this.buildLevelUpCards();
    if (!this.levelUpChoices || this.levelUpChoices.length === 0) {
      this.levelUpChoices = null;
      return;
    }
    const overlay = document.getElementById("level-up-overlay");
    const choicesEl = document.getElementById("level-up-choices");
    const rerollBtn = document.getElementById("level-up-reroll");
    if (!overlay || !choicesEl) return;

    choicesEl.innerHTML = "";
    for (const card of this.levelUpChoices) {
      const btn = document.createElement("button");
      btn.className = "level-up-card" + (card.isUnique ? " level-up-card-unique" : "");
      const star = card.isUnique ? '<span class="level-up-card-star">★</span>' : "";
      const upgradeBlocks = (card.upgrades || []).map(
        (u, idx) => `<div class="level-up-card-upgrade">${idx === 0 ? star : ""}<strong>${u.name}</strong><br><span class="level-up-card-desc">${getUpgradeDisplayDescription(u)}</span></div>`
      ).join("");
      const penaltyBlock = `<div class="level-up-card-penalty"><strong>${card.penalty.name}</strong><br><span class="level-up-card-desc">${getPenaltyDisplayDescription(card.penalty)}</span></div>`;
      btn.innerHTML = `<div class="level-up-card-inner">${upgradeBlocks}<div class="level-up-card-divider"></div>${penaltyBlock}</div>`;
      btn.addEventListener("click", () => this.applyLevelUpChoice(card, btn));
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

  applyLevelUpChoice(card, cardEl) {
    for (const u of (card.upgrades || [])) this.runAttackUpgrades.push(u);
    this.runAttackPenalties.push(card.penalty);
    this.levelUpChoices = null;

    if (cardEl) {
      cardEl.classList.add("level-up-card-selected");
      setTimeout(() => {
        const overlay = document.getElementById("level-up-overlay");
        if (overlay) overlay.classList.add("hidden");
        this.paused = false;
        if (this.pauseToggleEl) {
          this.pauseToggleEl.textContent = "⏸ Pause";
          this.pauseToggleEl.classList.remove("paused");
        }
        this.recalculateStats();
        this.updateXpUI();
        this.checkLevelUp();
        if (this.buildLogRefresh) this.buildLogRefresh();
      }, 320);
    } else {
      const overlay = document.getElementById("level-up-overlay");
      if (overlay) overlay.classList.add("hidden");
      this.paused = false;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "⏸ Pause";
        this.pauseToggleEl.classList.remove("paused");
      }
      this.recalculateStats();
      this.updateXpUI();
      this.checkLevelUp();
      if (this.buildLogRefresh) this.buildLogRefresh();
    }
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
    this.tryBasicAttack(this.lastMouseWorld.x, this.lastMouseWorld.y);
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

  tryBasicAttack(targetX, targetY) {
    let atkSpdMult = (this.equipmentAttackSpeedMult || 1) * (this.talentAttackSpeedMult || 1);
    atkSpdMult *= 1 + this.getAttackUpgradeValue("attackSpeed");
    atkSpdMult *= 1 - this.getAttackPenaltyValue("speedPenalty");
    if (this.playerWeakenUntil > this.time) atkSpdMult *= 0.9;
    let effectiveCooldown = this.playerAttackCooldown / atkSpdMult;
    effectiveCooldown += this.getAttackPenaltyValue("cooldown");
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      effectiveCooldown *= Math.max(0.4, ratio);
    }
    if (this.playerAttackTimer > 0) return;
    if (this.dashStrikeState) return;
    if (this.backfireDashState) return;

    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const dx = targetX - px;
    const dy = targetY - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    this.playerAttackTimer = effectiveCooldown;

    if (this.attackType === "projectile") {
      if (this.hasAttackPenalty("misfire") && Math.random() < 0.1) return;
      if (this.hasAttackPenalty("delayedFire")) {
        this.delayedFireQueue = this.delayedFireQueue || [];
        this.delayedFireQueue.push({ targetX, targetY, at: this.time + 0.3 });
        return;
      }
      this.firePlayerProjectile(targetX, targetY);
      return;
    }

    const baseDamage = this.computePlayerDamage(null);

    if (this.attackType === "fanStrike") {
      const FAN_RANGE = 210;
      const hit = this.enemiesInCone(px, py, dirX, dirY, FAN_RANGE, 60);
      for (const e of hit) this.dealDamageToEnemy(e, baseDamage);
      this.skillEffects.push({ type: "attackFanArc", x: px, y: py, dirX, dirY, range: FAN_RANGE, t: 0, duration: 0.2 });
      return;
    }

    if (this.attackType === "pulseShot") {
      const PULSE_RADIUS = 55;
      const PULSE_DELAY = 0.35;
      this.skillEffects.push({ type: "pulseStrike", x: targetX, y: targetY, damage: baseDamage, radius: PULSE_RADIUS, delay: PULSE_DELAY, t: 0, duration: PULSE_DELAY + 0.25 });
      return;
    }

    if (this.attackType === "thrustStrike") {
      const THRUST_RANGE = 240;
      const hit = this.getEnemiesInLine(px, py, dirX, dirY, THRUST_RANGE, 8);
      const dmg = Math.round(baseDamage * 1.6);
      for (const e of hit) this.dealDamageToEnemy(e, dmg);
      const endX = px + dirX * THRUST_RANGE;
      const endY = py + dirY * THRUST_RANGE;
      this.skillEffects.push({ type: "attackThrustLunge", x: px, y: py, dirX, dirY, hitX: endX, hitY: endY, t: 0, duration: 0.15 });
      return;
    }

    if (this.attackType === "dashStrike") {
      const surgeDist = this.player.size * 0.5;
      this.dashStrikeState = { phase: "surge", startX: this.player.position.x, startY: this.player.position.y, dirX, dirY, dist: surgeDist, traveled: 0 };
      this.skillEffects.push({ type: "dashStrikeSurge", x: px, y: py, dirX, dirY, t: 0, duration: 0.25 });
      return;
    }

    if (this.attackType === "backfireShot") {
      const backDist = this.player.size * 1.5;
      const projX = px - PLAYER_PROJECTILE_SIZE / 2;
      const projY = py - PLAYER_PROJECTILE_SIZE / 2;
      const speedMult = 1 + this.getAttackUpgradeValue("projectileSpeed") - this.getAttackPenaltyValue("slowShot");
      const maxDistMult = 1 + this.getAttackUpgradeValue("rangeBoost") - this.getAttackPenaltyValue("reducedRange");
      const piercesRemaining = (this.hasUpgradeCard("piercing") || this.hasAttackUpgrade("piercing")) ? 3 : 2;
      const fragileShot = this.hasAttackPenalty("fragileShot");
      this.overdriveCounter = (this.overdriveCounter || 0) + 1;
      const isOverdrive = this.hasAttackUpgrade("overdrive") && (this.overdriveCounter % 5 === 0);
      const proj = new PlayerProjectile(projX, projY, targetX, targetY, baseDamage, {
        speedMult, maxDistMult, piercesRemaining, fragileShot,
        ghost: this.hasAttackUpgrade("ghostProjectile"),
        splitting: this.hasAttackUpgrade("splitting"),
        overdrive: isOverdrive
      });
      if (this.hasUpgradeCard("homing")) proj.maxLifetime = 3;
      this.playerProjectiles.push(proj);
      this.backfireDashState = { dirX, dirY, traveled: 0, dist: backDist };
      this.skillEffects.push({ type: "backfireTrail", x: px, y: py, dirX, dirY, t: 0, duration: 0.25 });
      return;
    }
  }

  getProjectileCount() {
    let n = 1;
    const ups = this.runAttackUpgrades || [];
    const pens = this.runAttackPenalties || [];
    n += ups.filter((u) => u.id === "extraProjectile").length;
    if (this.hasUpgradeCard("volley")) n += 3;
    n -= pens.filter((p) => p.id === "fewerProjectiles").length;
    n -= pens.filter((p) => p.id === "reducedProjectiles").length;
    return Math.max(1, n);
  }

  firePlayerProjectile(targetX, targetY) {
    const px = this.player.position.x + this.player.size / 2 - PLAYER_PROJECTILE_SIZE / 2;
    const py = this.player.position.y + this.player.size / 2 - PLAYER_PROJECTILE_SIZE / 2;
    let baseDamage = this.computePlayerDamage(null);
    const critChance = this.getAttackUpgradeValue("critChance");
    const isCrit = critChance > 0 && Math.random() < critChance;
    if (isCrit) baseDamage = Math.round(baseDamage * 1.5);

    let dirX = targetX - (this.player.position.x + this.player.size / 2);
    let dirY = targetY - (this.player.position.y + this.player.size / 2);
    const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= dist;
    dirY /= dist;
    if (this.hasAttackPenalty("randomDirection") && !this.hasUpgradeCard("homing")) {
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    } else if (this.hasAttackPenalty("oppositeFire")) {
      dirX = -dirX;
      dirY = -dirY;
    }

    const count = this.getProjectileCount();
    let spreadRad = (12 * Math.PI) / 180;
    spreadRad += this.getAttackPenaltyValue("widerSpread");
    spreadRad -= this.getAttackUpgradeValue("spreadReduction");
    spreadRad = Math.max(0.02, spreadRad);

    const speedMult = 1 + this.getAttackUpgradeValue("projectileSpeed") - this.getAttackPenaltyValue("slowShot");
    const maxDistMult = 1 + this.getAttackUpgradeValue("rangeBoost") - this.getAttackPenaltyValue("reducedRange");
    const piercesRemaining = (this.hasUpgradeCard("piercing") || this.hasAttackUpgrade("piercing")) ? 3 : 2;
    const fragileShot = this.hasAttackPenalty("fragileShot");
    const ghost = this.hasAttackUpgrade("ghostProjectile");
    const splitting = this.hasAttackUpgrade("splitting");
    this.overdriveCounter = (this.overdriveCounter || 0);

    for (let i = 0; i < count; i++) {
      this.overdriveCounter++;
      const isOverdrive = this.hasAttackUpgrade("overdrive") && (this.overdriveCounter % 5 === 0);
      let tx = targetX;
      let ty = targetY;
      if (count > 1) {
        const offset = (i - (count - 1) / 2) * spreadRad;
        const cos = Math.cos(offset);
        const sin = Math.sin(offset);
        const ndx = dirX * cos - dirY * sin;
        const ndy = dirX * sin + dirY * cos;
        const far = 800;
        tx = this.player.position.x + this.player.size / 2 + ndx * far;
        ty = this.player.position.y + this.player.size / 2 + ndy * far;
      }
      const damage = baseDamage;
      const proj = new PlayerProjectile(px, py, tx, ty, damage, { speedMult, maxDistMult, piercesRemaining, fragileShot, ghost, splitting, overdrive: isOverdrive });
      proj.maxLifetime = 2;
      this.playerProjectiles.push(proj);
    }

    if (this.hasAttackPenalty("selfKnockback")) {
      const kick = 8;
      this.player.position.x -= dirX * kick;
      this.player.position.y -= dirY * kick;
      const margin = this.world.wallThickness;
      this.player.position.x = Math.max(margin, Math.min(this.player.position.x, this.world.width - margin - this.player.size));
      this.player.position.y = Math.max(margin, Math.min(this.player.position.y, this.world.height - margin - this.player.size));
    }
  }

  updatePlayerProjectiles(dt) {
    const surviving = [];
    const toAdd = [];
    const es = this.enemySystem;
    for (const proj of this.playerProjectiles) {
      proj._spawn = null;
      proj.update(dt, this);
      if (proj._spawn) toAdd.push(...proj._spawn);
      if (proj.isExpired()) continue;
      if (proj._spawn) continue;

      let hit = false;
      const applyHit = (enemy, dmg) => {
        proj.hitEnemyIds.add(enemy.id);
        let useDmg = dmg;
        if (this.hasAttackUpgrade("momentum")) {
          useDmg = Math.round(useDmg * (1 + Math.min(1, proj.flightTime) * 0.1));
        }
        if (hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
          useDmg = Math.round(useDmg * 1.25);
        }
        this.dealDamageToEnemy(enemy, useDmg);
        if (this.hasAttackUpgrade("chainLightning")) {
          const cx = enemy.position.x + enemy.size / 2;
          const cy = enemy.position.y + enemy.size / 2;
          const exclude = new Set(proj.hitEnemyIds);
          const chainDmg = Math.round(useDmg * 0.33);
          for (let i = 0; i < 3; i++) {
            const next = this.getNearestEnemy(cx, cy, 150, exclude);
            if (!next) break;
            this.dealDamageToEnemy(next, chainDmg);
            exclude.add(next.id);
          }
        }
        if (this.hasAttackUpgrade("explosive")) {
          const ex = enemy.position.x + enemy.size / 2;
          const ey = enemy.position.y + enemy.size / 2;
          const hitArea = this.enemiesInRadius(ex, ey, 45);
          for (const e of hitArea) {
            if (e !== enemy) this.dealDamageToEnemy(e, Math.round(proj.damage * 0.6));
          }
        }
      };

      const allEnemies = es.boss ? [...es.enemies, es.boss] : es.enemies;
      for (const enemy of allEnemies) {
        if (enemy.isDead) continue;
        if (enemy._undyingRespawnTime && this.time < enemy._undyingRespawnTime) continue;
        if (proj.hitEnemyIds.has(enemy.id)) continue;
        if (proj.intersects(enemy)) {
          hit = true;
          applyHit(enemy, proj.damage);
          if (proj.fragileShot) break;
          if (proj.piercing) {
            proj.piercesRemaining--;
            if (proj.piercesRemaining <= 0) break;
          } else {
            break;
          }
        }
      }
      const keep = !proj.isExpired() && (!hit || (!proj.fragileShot && (!proj.piercing || proj.piercesRemaining > 0)));
      if (keep) surviving.push(proj);
    }
    this.playerProjectiles = surviving.concat(toAdd);
  }

  updateDashStrike(dt) {
    if (!this.dashStrikeState) return;
    const s = this.dashStrikeState;
    const margin = this.world.wallThickness;
    if (s.phase === "surge") {
      const speed = 600;
      const move = Math.min(speed * dt, s.dist - s.traveled);
      this.player.position.x += s.dirX * move;
      this.player.position.y += s.dirY * move;
      this.player.position.x = Math.max(margin, Math.min(this.player.position.x, this.world.width - margin - this.player.size));
      this.player.position.y = Math.max(margin, Math.min(this.player.position.y, this.world.height - margin - this.player.size));
      s.traveled += move;
      if (s.traveled >= s.dist) {
        s.phase = "fan";
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        const DASH_STRIKE_FAN_RANGE = 150;
        const hit = this.enemiesInCone(px, py, s.dirX, s.dirY, DASH_STRIKE_FAN_RANGE, 45);
        const dmg = this.computePlayerDamage(null);
        for (const e of hit) this.dealDamageToEnemy(e, dmg);
        this.skillEffects.push({ type: "dashStrikeFan", x: px, y: py, dirX: s.dirX, dirY: s.dirY, range: DASH_STRIKE_FAN_RANGE, t: 0, duration: 0.12 });
        this.dashStrikeState = null;
      }
    }
  }

  updateBackfireDash(dt) {
    if (!this.backfireDashState) return;
    const s = this.backfireDashState;
    const speed = 500;
    const move = Math.min(speed * dt, s.dist - s.traveled);
    this.player.position.x -= s.dirX * move;
    this.player.position.y -= s.dirY * move;
    const margin = this.world.wallThickness;
    this.player.position.x = Math.max(margin, Math.min(this.player.position.x, this.world.width - margin - this.player.size));
    this.player.position.y = Math.max(margin, Math.min(this.player.position.y, this.world.height - margin - this.player.size));
    s.traveled += move;
    if (s.traveled >= s.dist) this.backfireDashState = null;
  }

  updatePulseOrbs(dt) {
    const margin = this.world.wallThickness;
    const surviving = [];
    for (const orb of this.pulseOrbs) {
      const moveX = orb.vx * dt;
      const moveY = orb.vy * dt;
      orb.x += moveX;
      orb.y += moveY;
      orb.traveled += Math.sqrt(moveX * moveX + moveY * moveY);
      const hitWall = orb.x < margin || orb.x > this.world.width - margin || orb.y < margin || orb.y > this.world.height - margin;
      if (orb.traveled >= orb.maxDist || hitWall) {
        const hit = this.enemiesInRadius(orb.x, orb.y, orb.detRadius);
        for (const e of hit) this.dealDamageToEnemy(e, orb.damage);
        this.skillEffects.push({ type: "pulseDetonation", x: orb.x, y: orb.y, radius: orb.detRadius, t: 0, duration: 0.25 });
      } else {
        surviving.push(orb);
      }
    }
    this.pulseOrbs = surviving;
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
    while (this.chainCastQueue.length > 0 && this.chainCastQueue[0].t <= this.time) {
      const { skillId, slot } = this.chainCastQueue.shift();
      this.executeSkill(skillId, slot, { chainCast: true });
    }

    if (this.mouseHeld && !this.gameOver && !this.paused && !this.levelUpChoices) {
      this.tryBasicAttack(this.lastMouseWorld.x, this.lastMouseWorld.y);
    }
    if (this.delayedFireQueue && this.delayedFireQueue.length > 0) {
      const stillPending = [];
      for (const item of this.delayedFireQueue) {
        if (this.time >= item.at) this.firePlayerProjectile(item.targetX, item.targetY);
        else stillPending.push(item);
      }
      this.delayedFireQueue = stillPending;
    }

    this.updateDashStrike(dt);
    this.updateBackfireDash(dt);
    this.updatePulseOrbs(dt);
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
        this.processEnemyDebuffs(dt, enemy);
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
      this.processEnemyDebuffs(dt, enemy);

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
    this.updateProjectiles(dt);
    es.update(dt);
    this.updateEnemyCountUI();

    this.floatingCombatText = this.floatingCombatText.filter((e) => this.time - e.t <= 0.8);
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
        for (const e of hit) {
          this.dealDamageToEnemy(e, dmg, { isSkill: true });
          e.burnUntil = this.time + 3;
          e.burnDps = Math.max(e.burnDps || 0, dmg * 0.15);
          e.burnAccum = 0;
        }
      }
    }
    if (this.activeAuras.has("thunderAura")) {
      this.thunderAuraAccum = (this.thunderAuraAccum || 0) + dt;
      if (this.thunderAuraAccum >= 1.5) {
        this.thunderAuraAccum = 0;
        const target = this.getNearestEnemy(px, py, 200);
        if (target) {
          const dmg = this.computeSkillDamage(target, 0.6);
          this.dealDamageToEnemy(target, dmg, { isSkill: true });
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

  dealDamageToEnemy(enemy, amount, opts = {}) {
    let dmg = Math.round(amount);
    if (this.playerInWeakeningPatch) dmg = Math.max(1, Math.round(dmg * 0.7));
    if (this.hasCondition("enemyResist")) dmg = Math.max(1, Math.round(dmg * 0.8));
    const effectiveDefense = (enemy.defense || 0) * (enemy.voidDefenseMult ?? 1);
    dmg = Math.max(1, Math.round(dmg - effectiveDefense));
    if (hasTalent("predator") && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.25) {
      dmg = Math.max(1, Math.round(dmg * 1.5));
    }
    const skillSlot = opts.skillSlot;
    const mods = opts.modList != null ? opts.modList : (skillSlot != null ? getModsForSkillSlot(this, skillSlot) : []);
    const mult = getModEffectMult(this);
    if (mods.includes("lifesteal") && dmg > 0) {
      const lifestealPct = 0.15 * mult + (this.hasUpgradeCard("vampiric") ? 0.05 : 0);
      const heal = Math.max(1, Math.round(dmg * lifestealPct));
      this.healPlayer(heal);
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      this.addFloatingText(px, py, `+${heal}`, "heal");
    }
    const has = (id) => enemy.affixes?.includes(id);

    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const isKillingBlow = enemy.health <= dmg;
    const hitType = opts.isDot ? "dot" : opts.isSkill ? "skill" : opts.isCrit ? "crit" : "normal";
    this.addFloatingText(ex, ey, dmg, hitType, isKillingBlow);

    if (!opts.isDot && mods.length > 0) {
      applyElementDebuffsFromMods(this, enemy, mods, amount, this.time);
    }

    if (has("weakening")) {
      this.playerWeakenUntil = this.time + 2;
    }

    if (has("rooted") && !opts.isDot && this.rootedMinionsSpawned < 5) {
      this.rootedMinionsSpawned++;
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
        if (e !== enemy && !e.isDead) this.dealDamageToEnemy(e, aftershockDmg, { isSkill: true });
      }
    }

    if (this.activeAuras.has("soulAura") && dmg > 0) {
      const heal = Math.round(dmg * 0.5);
      this.healPlayer(heal);
    }
    if (enemy.isDead) {
      if (skillSlot != null && getModsForSkillSlot(this, skillSlot).includes("cooldownCascade")) {
        this.skillCooldowns[skillSlot] = 0;
        this.skillCascadeFlashUntil = this.skillCascadeFlashUntil || {};
        this.skillCascadeFlashUntil[skillSlot] = this.time + 0.3;
      }
      this.triggerOnKillMods();
    }
  }

  processEnemyDebuffs(dt, enemy) {
    if (enemy.isDead) return;
    const t = this.time;
    if (enemy.burnUntil != null && t < enemy.burnUntil) {
      enemy.burnAccum = (enemy.burnAccum || 0) + dt;
      if (enemy.burnAccum >= 0.5) {
        enemy.burnAccum = 0;
        const burnDmg = Math.max(1, Math.round((enemy.burnDps || 0) * 0.5));
        this.dealDamageToEnemy(enemy, burnDmg, { isDot: true });
      }
    } else {
      enemy.burnUntil = null;
      enemy.burnDps = 0;
    }
    if (enemy.toxicStacks > 0 && enemy.toxicUntil != null && t < enemy.toxicUntil) {
      enemy.toxicAccum = (enemy.toxicAccum || 0) + dt;
      const dpsPerStack = enemy.maxHealth * 0.05;
      if (enemy.toxicAccum >= 0.5) {
        enemy.toxicAccum = 0;
        const toxicDmg = Math.max(1, Math.round(dpsPerStack * enemy.toxicStacks * 0.5));
        this.dealDamageToEnemy(enemy, toxicDmg, { isDot: true });
      }
    } else if (enemy.toxicUntil != null && t >= enemy.toxicUntil) {
      enemy.toxicStacks = 0;
      enemy.toxicUntil = null;
    }
  }

  triggerOnKillMods() {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    for (let slot = 0; slot < 4; slot++) {
      const mods = getModsForSkillSlot(this, slot);
      if (!mods.includes("onKill")) continue;
      const skillId = this.skills[slot];
      if (!skillId) continue;
      const def = SKILL_DEFS.find((s) => s.id === skillId);
      if (def && def.category === "aura") continue;
      this.executeSkill(skillId, slot, { noCooldown: true, onKill: true });
    }
  }

  computeSkillDamage(enemy, multiplier = 1, slot = null, opts = {}) {
    const skillMult = this.equipmentSkillDamageMult ?? 1;
    let dmg = Math.round(this.currentStats.attack * multiplier * skillMult);
    const mods = slot != null ? getModsForSkillSlot(this, slot) : [];
    const mult = getModEffectMult(this);
    if (mods.includes("amplify")) dmg = Math.round(dmg * (1 + 0.25 * mult));
    if (mods.includes("recoil")) dmg = Math.round(dmg * (1 + 0.3 * mult));
    if (opts.sacrificeMult) dmg = Math.round(dmg * opts.sacrificeMult);
    if (slot != null && this.empowerStacks && this.empowerStacks[slot] > 0) {
      dmg = Math.round(dmg * (1 + 0.05 * mult * Math.min(10, this.empowerStacks[slot])));
    }
    if (this.hasUpgradeCard("glassCannon")) dmg = Math.round(dmg * 1.5);
    if (this.hasUpgradeCard("doubleStrike")) {
      this.doubleStrikeCounter++;
      if (this.doubleStrikeCounter >= 5) {
        this.doubleStrikeCounter = 0;
        dmg *= 2;
      }
    }
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio = this.currentStats.maxHealth > 0 ? this.currentHealth / this.currentStats.maxHealth : 1;
      dmg *= 1 + (1 - ratio) * 0.5;
    }
    if (enemy && hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
      dmg = Math.round(dmg * 1.25);
    }
    return dmg;
  }

  getSkillCooldownMult() {
    const atkSpdFromRun = 1 + this.getAttackUpgradeValue("attackSpeed") - this.getAttackPenaltyValue("speedPenalty");
    let mult = (1 / atkSpdFromRun) * (this.equipmentCooldownRecovery ?? 1);
    if (this.hasUpgradeCard("berserkerRage")) {
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
    const mods = getModsForSkillSlot(this, slot);
    if (mods.includes("charged")) {
      this.skillChargeSlot = slot;
      this.skillChargeStartTime = this.time;
      return;
    }
    this.executeSkill(skillId, slot, {});
  }

  tryReleaseChargedSkill(slot) {
    if (this.skillChargeSlot !== slot) return;
    const skillId = this.skills[slot];
    if (!skillId) {
      this.skillChargeSlot = null;
      return;
    }
    const chargeDuration = this.time - this.skillChargeStartTime;
    const chargeMult = 1 + Math.min(1, chargeDuration / 2);
    this.skillChargeSlot = null;
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (this.skillCooldowns[slot] > 0) return;
    this.executeSkill(skillId, slot, { chargeMult });
    if (def) {
      const cdMult = this.getSkillCooldownMult();
      const mods = getModsForSkillSlot(this, slot);
      const baseCd = def.baseCd + (mods.includes("amplify") ? 0.5 : 0);
      this.skillCooldowns[slot] = baseCd * cdMult;
    }
  }

  executeSkill(skillId, slot, options = {}) {
    const atk = this.currentStats.attack;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    let tx = this.lastMouseWorld.x;
    let ty = this.lastMouseWorld.y;
    const mods = getModsForSkillSlot(this, slot);
    const chargeMult = options.chargeMult ?? 1;

    let sacrificeMult = 1;
    if (mods.includes("sacrifice")) {
      const cost = Math.max(1, Math.round(this.currentStats.maxHealth * 0.03 * getModEffectMult(this)));
      if (this.currentHealth > cost) {
        this.currentHealth -= cost;
        this.updateHealthBar();
        sacrificeMult = 1 + 0.5 * getModEffectMult(this);
      }
    }
    if (mods.includes("adrenaline")) {
      this.playerHasteUntil = this.time + 2;
      this.playerHasteMult = 1 + 0.2 * getModEffectMult(this);
    }
    if (mods.includes("empower")) {
      this.empowerStacks[slot] = Math.min(10, (this.empowerStacks[slot] || 0) + 1);
    }

    if (options.onKill) {
      const nearest = this.getNearestEnemy(px, py, 800);
      if (nearest) {
        tx = nearest.position.x + nearest.size / 2;
        ty = nearest.position.y + nearest.size / 2;
      }
    }

    const pushFireball = (dirX, dirY, mult, modList) => {
      const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const speed = 180;
      const eff = {
        type: "fireball",
        x: px, y: py, vx: (dirX / dist) * speed, vy: (dirY / dist) * speed,
        mult: mult * chargeMult, radius: 60, t: 0, mods: modList || mods,
        maxRange: 360, distanceTraveled: 0,
        slot, modList: modList || mods, sacrificeMult
      };
      if (modList && modList.includes("orbiting")) {
        eff.phase = "orbit";
        eff.orbitT = 0;
        eff.orbitDuration = 3;
        eff.px0 = px;
        eff.py0 = py;
      }
      eff.bouncesLeft = (modList && modList.includes("bouncing")) ? 3 : 0;
      this.skillEffects.push(eff);
    };

    const pushIceShard = (dirX, dirY, mult, modList) => {
      const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const speed = 400;
      const eff = {
        type: "iceShard",
        x: px, y: py, vx: (dirX / dist) * speed, vy: (dirY / dist) * speed,
        mult: mult * chargeMult, pierces: 5, t: 0, mods: modList || mods,
        maxRange: 600, distanceTraveled: 0,
        slot, modList: modList || mods, sacrificeMult
      };
      if (modList && modList.includes("orbiting")) {
        eff.phase = "orbit";
        eff.orbitT = 0;
        eff.orbitDuration = 3;
        eff.px0 = px;
        eff.py0 = py;
      }
      eff.bouncesLeft = (modList && modList.includes("bouncing")) ? 3 : 0;
      this.skillEffects.push(eff);
    };

    if (skillId === "fireball") {
      this.damageSkillsUsedThisRun.add("fireball");
      const dx = tx - px;
      const dy = ty - py;
      const baseMult = 1.5;
      if (mods.includes("volley")) {
        const spread = (30 * Math.PI) / 180;
        for (let i = -1; i <= 1; i++) {
          const angle = Math.atan2(dy, dx) + i * (spread / 2);
          pushFireball(Math.cos(angle), Math.sin(angle), baseMult * 0.7, mods);
        }
      } else {
        pushFireball(dx, dy, baseMult, mods);
      }
    } else if (skillId === "iceShard") {
      this.damageSkillsUsedThisRun.add("iceShard");
      const dx = tx - px;
      const dy = ty - py;
      const baseMult = 0.8;
      if (mods.includes("volley")) {
        const spread = (30 * Math.PI) / 180;
        for (let i = -1; i <= 1; i++) {
          const angle = Math.atan2(dy, dx) + i * (spread / 2);
          pushIceShard(Math.cos(angle), Math.sin(angle), baseMult * 0.7, mods);
        }
      } else {
        pushIceShard(dx, dy, baseMult, mods);
      }
    } else if (skillId === "lightningBolt") {
      this.damageSkillsUsedThisRun.add("lightningBolt");
      const target = this.getNearestEnemy(px, py, 400);
      if (target) {
        const tx1 = target.position.x + target.size / 2;
        const ty1 = target.position.y + target.size / 2;
        let dmg = this.computeSkillDamage(target, 1, slot, { sacrificeMult });
        this.dealDamageToEnemy(target, dmg, { isSkill: true, skillSlot: slot, modList: mods });
        const chain = this.getNearestEnemy(tx1, ty1, 120, target);
        let chainPos = null;
        if (chain) {
          chainPos = { x: chain.position.x + chain.size / 2, y: chain.position.y + chain.size / 2 };
          this.dealDamageToEnemy(chain, Math.round(dmg * 0.5), { isSkill: true, skillSlot: slot, modList: mods });
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
      const hpx = this.player.position.x + this.player.size / 2;
      const hpy = this.player.position.y + this.player.size / 2;
      this.addFloatingText(hpx, hpy, `+${heal}`, "heal");
      this.updateHealthBar();
    } else if (skillId === "shieldBash") {
      this.damageSkillsUsedThisRun.add("shieldBash");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "shieldBash",
        x: px, y: py, dirX: dx / dist, dirY: dy / dist, t: 0, duration: 0.15,
        mult: 0.5, stun: 0.5, knockback: 120,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "rapidFire") {
      this.damageSkillsUsedThisRun.add("rapidFire");
      this.skillEffects.push({ type: "rapidFire", t: 0, duration: 3, slot, modList: mods, sacrificeMult });
    } else if (skillId === "iceRain") {
      this.damageSkillsUsedThisRun.add("iceRain");
      this.skillEffects.push({ type: "iceRain", x: px, y: py, t: 0, duration: 4, radius: 180, slot, modList: mods, sacrificeMult });
    } else if (skillId === "lightningSpear") {
      this.damageSkillsUsedThisRun.add("lightningSpear");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "lightningSpear",
        x: px, y: py, vx: (dx / dist) * 600, vy: (dy / dist) * 600,
        mult: 1.2, t: 0, chargeTime: 0.5, stun: 1,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "meteor") {
      this.damageSkillsUsedThisRun.add("meteor");
      this.skillEffects.push({
        type: "meteor",
        targetX: tx, targetY: ty, t: 0, delay: 1, mult: 2.5, radius: 100, burnDuration: 5,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "voidRift") {
      this.damageSkillsUsedThisRun.add("voidRift");
      this.skillEffects.push({
        type: "voidRift",
        x: px, y: py, t: 0, duration: 3, radius: 150, mult: 1.5,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "phoenixStrike") {
      this.damageSkillsUsedThisRun.add("phoenixStrike");
      this.skillEffects.push({
        type: "phoenixStrike",
        x: px, y: py, t: 0, duration: 0.1, radius: 120, mult: 2, invulnDuration: 3,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "chainFrost") {
      this.damageSkillsUsedThisRun.add("chainFrost");
      this.skillEffects.push({ type: "chainFrost", t: 0, freezeDuration: 2 });
    } else if (skillId === "stormCall") {
      this.damageSkillsUsedThisRun.add("stormCall");
      this.skillEffects.push({ type: "stormCall", t: 0, duration: 6, mult: 0.6, strikeInterval: 0.5, slot, modList: mods, sacrificeMult });
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
      this.bladeDashSlot = slot;
      this.bladeDashSacrificeMult = sacrificeMult;
      this.skillEffects.push({
        type: "bladeDash",
        x: px, y: py, dirX: dx / dist, dirY: dy / dist, t: 0, duration: 0.25,
        mult: 0.8, speed: 600,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "whirlwind") {
      this.damageSkillsUsedThisRun.add("whirlwind");
      this.whirlwindActive = true;
      this.skillEffects.push({ type: "whirlwind", t: 0, duration: 2, mult: 0.4, radius: 80, hitInterval: 0.15, slot, modList: mods, sacrificeMult });
    } else if (skillId === "groundSlam") {
      this.damageSkillsUsedThisRun.add("groundSlam");
      this.skillEffects.push({
        type: "groundSlam",
        x: px, y: py, t: 0, duration: 0.2, mult: 1, radius: 120, knockback: 150,
        slot, modList: mods, sacrificeMult
      });
    } else if (skillId === "bladeStorm") {
      this.damageSkillsUsedThisRun.add("bladeStorm");
      this.skillEffects.push({ type: "bladeStorm", x: px, y: py, t: 0, duration: 3, mult: 0.5, bladeCount: 8, slot, modList: mods, sacrificeMult });
    } else if (skillId === "earthquake") {
      this.damageSkillsUsedThisRun.add("earthquake");
      this.skillEffects.push({ type: "earthquake", t: 0, duration: 3, mult: 0.3, slowMult: 0.6, slowDuration: 3, slot, modList: mods, sacrificeMult });
    }

    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (!options.noCooldown && !options.chainCast && def) {
      const cdMult = this.getSkillCooldownMult();
      const baseCd = def.baseCd + (mods.includes("amplify") ? 0.5 : 0);
      this.skillCooldowns[slot] = baseCd * cdMult;
    }
    if (mods.includes("recoil")) {
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const push = 80;
      this.player.position.x -= (dx / dist) * push;
      this.player.position.y -= (dy / dist) * push;
    }
    if (mods.includes("chainCast") && !options.chainCast) {
      this.chainCastQueue.push({ t: this.time + 0.2, skillId, slot });
    }
    if (mods.includes("echo") && Math.random() < 0.3) {
      this.executeSkill(skillId, slot, { noCooldown: true });
    }
  }

  getNearestEnemy(cx, cy, maxDist, exclude = null) {
    let best = null; let bestD = maxDist * maxDist;
    const es = this.enemySystem;
    const excludeSet = exclude && exclude instanceof Set ? exclude : null;
    const excludeSingle = exclude && !excludeSet ? exclude : null;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      if (excludeSet && excludeSet.has(e.id)) continue;
      if (excludeSingle && e === excludeSingle) continue;
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
        eff.mods = eff.mods || [];
        eff.maxRange = eff.maxRange ?? 360;
        eff.distanceTraveled = eff.distanceTraveled ?? 0;
        const margin = this.world.wallThickness;
        const w = this.world.width;
        const h = this.world.height;

        if (eff.phase === "orbit") {
          eff.orbitT = (eff.orbitT ?? 0) + dt;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const orbitRadius = 70;
          const angle = (eff.orbitT * 1.2) % (Math.PI * 2);
          eff.x = px + Math.cos(angle) * orbitRadius;
          eff.y = py + Math.sin(angle) * orbitRadius;
          if (eff.orbitT >= (eff.orbitDuration ?? 3)) {
            eff.phase = "seek";
            const target = this.getNearestEnemy(eff.x, eff.y, 600);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 180;
              eff.vx = (dx / dist) * speed;
              eff.vy = (dy / dist) * speed;
            }
          }
        } else {
          if (eff.returning) {
            const px = this.player.position.x + this.player.size / 2;
            const py = this.player.position.y + this.player.size / 2;
            const dx = px - eff.x;
            const dy = py - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 180;
            eff.vx = (dx / dist) * speed;
            eff.vy = (dy / dist) * speed;
          }
          eff.x += eff.vx * dt;
          eff.y += eff.vy * dt;
          const moveLen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) * dt;
          eff.distanceTraveled += moveLen;

          if (eff.mods.includes("homing") && eff.distanceTraveled >= 0.2 * eff.maxRange) {
            const excludeHit = (eff.hitIds && eff.hitIds.size > 0) ? eff.hitIds : null;
            const target = this.getNearestEnemy(eff.x, eff.y, 500, excludeHit);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 180;
              eff.vx = (dx / dist) * speed * 0.15 + eff.vx * 0.85;
              eff.vy = (dy / dist) * speed * 0.15 + eff.vy * 0.85;
              const vlen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
              eff.vx = (eff.vx / vlen) * speed;
              eff.vy = (eff.vy / vlen) * speed;
            }
          }

          if (eff.mods.includes("boomerang") && !eff.returning && eff.distanceTraveled >= eff.maxRange) {
            eff.returning = true;
            eff.hitIds = eff.hitIds || new Set();
            eff.hitIds.clear();
            eff.vx = -eff.vx;
            eff.vy = -eff.vy;
          }

          if (eff.bouncesLeft != null && eff.bouncesLeft > 0) {
            if (eff.x < margin) {
              eff.x = margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.x > w - margin) {
              eff.x = w - margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.y < margin) {
              eff.y = margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.y > h - margin) {
              eff.y = h - margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.bouncesLeft <= 0 && eff.mods.includes("bouncing")) {
              continue;
            }
          }

          if (eff.mods.includes("rebound") && !eff.rebounded) {
            const hitWall = eff.x <= margin || eff.x >= w - margin || eff.y <= margin || eff.y >= h - margin;
            if (hitWall) {
              eff.rebounded = true;
              const target = this.getNearestEnemy(eff.x, eff.y, 500);
              if (target) {
                const tx = target.position.x + target.size / 2;
                const ty = target.position.y + target.size / 2;
                const dx = tx - eff.x;
                const dy = ty - eff.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 180;
                eff.vx = (dx / dist) * speed;
                eff.vy = (dy / dist) * speed;
              }
            }
          }
        }

        eff.hitIds = eff.hitIds || new Set();
        const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
        for (const e of hit) {
          if (!eff.hitIds.has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
          }
        }
        if (hit.length > 0 && !eff.mods.includes("piercing")) {
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.2);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
          }
          continue;
        }
        if (eff.t > 2 && !eff.mods.includes("boomerang")) {
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.2);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
          }
          continue;
        }
        if (eff.returning) {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const d = (eff.x - px) * (eff.x - px) + (eff.y - py) * (eff.y - py);
          if (d < 900) {
            if (this.hazardSystem) {
              const burnDmg = Math.round(this.currentStats.attack * 0.2);
              this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
            }
            continue;
          }
        }
        surviving.push(eff);
      } else if (eff.type === "iceShard") {
        eff.mods = eff.mods || [];
        eff.maxRange = eff.maxRange ?? 600;
        eff.distanceTraveled = eff.distanceTraveled ?? 0;
        const margin = this.world.wallThickness;
        const w = this.world.width;
        const h = this.world.height;

        if (eff.phase === "orbit") {
          eff.orbitT = (eff.orbitT ?? 0) + dt;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const orbitRadius = 70;
          const angle = (eff.orbitT * 1.2) % (Math.PI * 2);
          eff.x = px + Math.cos(angle) * orbitRadius;
          eff.y = py + Math.sin(angle) * orbitRadius;
          if (eff.orbitT >= (eff.orbitDuration ?? 3)) {
            eff.phase = "seek";
            const target = this.getNearestEnemy(eff.x, eff.y, 600);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 400;
              eff.vx = (dx / dist) * speed;
              eff.vy = (dy / dist) * speed;
            }
          }
        } else {
          if (eff.returning) {
            const px = this.player.position.x + this.player.size / 2;
            const py = this.player.position.y + this.player.size / 2;
            const dx = px - eff.x;
            const dy = py - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 400;
            eff.vx = (dx / dist) * speed;
            eff.vy = (dy / dist) * speed;
          }
          eff.x += eff.vx * dt;
          eff.y += eff.vy * dt;
          eff.distanceTraveled += Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) * dt;

          if (eff.mods.includes("homing") && eff.distanceTraveled >= 0.2 * eff.maxRange) {
            const excludeHit = (eff.hitIds && eff.hitIds.size > 0) ? eff.hitIds : null;
            const target = this.getNearestEnemy(eff.x, eff.y, 500, excludeHit);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 400;
              eff.vx = (dx / dist) * speed * 0.15 + eff.vx * 0.85;
              eff.vy = (dy / dist) * speed * 0.15 + eff.vy * 0.85;
              const vlen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
              eff.vx = (eff.vx / vlen) * speed;
              eff.vy = (eff.vy / vlen) * speed;
            }
          }

          if (eff.mods.includes("boomerang") && !eff.returning && eff.distanceTraveled >= eff.maxRange) {
            eff.returning = true;
            eff.hitIds = eff.hitIds || new Set();
            eff.hitIds.clear();
            eff.vx = -eff.vx;
            eff.vy = -eff.vy;
          }

          if (eff.bouncesLeft != null && eff.bouncesLeft > 0) {
            if (eff.x < margin) {
              eff.x = margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.x > w - margin) {
              eff.x = w - margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.y < margin) {
              eff.y = margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.y > h - margin) {
              eff.y = h - margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.bouncesLeft <= 0 && eff.mods.includes("bouncing")) {
              continue;
            }
          }

          if (eff.mods.includes("rebound") && !eff.rebounded) {
            const hitWall = eff.x <= margin || eff.x >= w - margin || eff.y <= margin || eff.y >= h - margin;
            if (hitWall) {
              eff.rebounded = true;
              const target = this.getNearestEnemy(eff.x, eff.y, 500);
              if (target) {
                const tx = target.position.x + target.size / 2;
                const ty = target.position.y + target.size / 2;
                const dx = tx - eff.x;
                const dy = ty - eff.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 400;
                eff.vx = (dx / dist) * speed;
                eff.vy = (dy / dist) * speed;
              }
            }
          }
        }

        eff.hitIds = eff.hitIds || new Set();
        const hit = this.enemiesInRadius(eff.x, eff.y, 20);
        for (const e of hit) {
          if (!eff.hitIds.has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
            e.slowUntil = this.time + 2;
            e.slowMult = 0.7;
            this.iceShardHitsThisRun++;
            if (this.iceShardHitsThisRun >= 5) setSkillUnlock("iceShard5", true);
          }
        }
        if (eff.t > 1.5 && !eff.mods.includes("boomerang") && !eff.returning) continue;
        if (eff.returning) {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const d = (eff.x - px) * (eff.x - px) + (eff.y - py) * (eff.y - py);
          if (d < 900) continue;
        }
        surviving.push(eff);
      } else if (eff.type === "shieldBash") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInCone(eff.x, eff.y, eff.dirX, eff.dirY, 120, 80);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
            const dmg = this.computeSkillDamage(target, 1, eff.slot, { sacrificeMult: eff.sacrificeMult });
            this.dealDamageToEnemy(target, dmg, { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, 0.4, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
            e.stunUntil = this.time + eff.stun;
          }
        }
        if (eff.t > 1.5) continue;
        surviving.push(eff);
      } else if (eff.type === "meteor") {
        if (eff.t < eff.delay) { surviving.push(eff); continue; }
        if (eff.t - dt < eff.delay) {
          const hit = this.enemiesInRadius(eff.targetX, eff.targetY, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
            this.dealDamageToEnemy(target, this.computeSkillDamage(target, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
        }
        surviving.push(eff);
      } else if (eff.type === "groundSlam") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
              this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
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
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
            e.slowUntil = this.time + eff.slowDuration;
            e.slowMult = eff.slowMult;
          }
        }
        surviving.push(eff);
      } else if (eff.type === "pulseStrike") {
        if (eff.t >= eff.delay && !eff.done) {
          eff.done = true;
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, eff.damage);
          this.skillEffects.push({ type: "pulseDetonation", x: eff.x, y: eff.y, radius: eff.radius, t: 0, duration: 0.25 });
        }
        if (eff.t >= (eff.duration || 0.6)) continue;
        surviving.push(eff);
      } else if (["attackFanArc", "attackThrustLunge", "dashStrikeSurge", "dashStrikeFan", "backfireTrail", "pulseDetonation"].includes(eff.type)) {
        if (eff.t >= (eff.duration || 0.25)) continue;
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
    const aRooted = a.affixes && a.affixes.includes("rooted");
    const bRooted = b.affixes && b.affixes.includes("rooted");
    const pushA = bRooted ? 1 : (aRooted ? 0 : 0.5);
    const pushB = aRooted ? 1 : (bRooted ? 0 : 0.5);
    const pushX = overlapX * 0.5;
    const pushY = overlapY * 0.5;
    const acx = ax1 + asz / 2, acy = ay1 + asz / 2;
    const bcx = bx1 + bsz / 2, bcy = by1 + bsz / 2;
    if (overlapX < overlapY) {
      if (acx < bcx) {
        if (pushA > 0) a.position.x -= pushX * (pushA * 2);
        if (pushB > 0) b.position.x += pushX * (pushB * 2);
      } else {
        if (pushA > 0) a.position.x += pushX * (pushA * 2);
        if (pushB > 0) b.position.x -= pushX * (pushB * 2);
      }
    } else {
      if (acy < bcy) {
        if (pushA > 0) a.position.y -= pushY * (pushA * 2);
        if (pushB > 0) b.position.y += pushY * (pushB * 2);
      } else {
        if (pushA > 0) a.position.y += pushY * (pushA * 2);
        if (pushB > 0) b.position.y -= pushY * (pushB * 2);
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

  getFirstEnemyInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
    const all = this.getEnemiesInLine(px, py, dirX, dirY, maxDist, halfWidth);
    return all.length > 0 ? all[0] : null;
  }

  getEnemiesInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
    const es = this.enemySystem;
    const candidates = [];
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      const ex = e.position.x + e.size / 2 - px;
      const ey = e.position.y + e.size / 2 - py;
      const t = ex * dirX + ey * dirY;
      if (t <= 0 || t > maxDist) continue;
      const perp = Math.abs(ex * dirY - ey * dirX);
      if (perp > halfWidth + e.size / 2) continue;
      candidates.push({ e, t });
    }
    candidates.sort((a, b) => a.t - b.t);
    return candidates.map((c) => c.e);
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
      } else if (eff.type === "attackFanArc") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.2);
        const range = eff.range || 65;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.9 * alpha})`;
        ctx.lineWidth = 5;
        const angle = Math.atan2(eff.dirY, eff.dirX);
        ctx.beginPath();
        ctx.arc(sx, sy, range, angle - (120 * Math.PI / 360), angle + (120 * Math.PI / 360));
        ctx.stroke();
      } else if (eff.type === "attackThrustLunge") {
        const sx0 = eff.x + ox; const sy0 = eff.y + oy;
        const sx1 = eff.hitX + ox; const sy1 = eff.hitY + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.15);
        ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx1, sy1);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(sx1, sy1, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === "dashStrikeSurge") {
        const alpha = 1 - eff.t / (eff.duration || 0.25);
        ctx.fillStyle = `rgba(200, 200, 255, ${0.3 * alpha})`;
        const px = this.player.position.x + ox; const py = this.player.position.y + oy;
        ctx.fillRect(px - this.player.size, py - this.player.size, this.player.size * 2, this.player.size * 2);
      } else if (eff.type === "dashStrikeFan") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.12);
        const range = eff.range || 48;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.85 * alpha})`;
        ctx.lineWidth = 4;
        const angle = Math.atan2(eff.dirY, eff.dirX);
        ctx.beginPath();
        ctx.arc(sx, sy, range, angle - Math.PI / 4, angle + Math.PI / 4);
        ctx.stroke();
      } else if (eff.type === "backfireTrail") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.2);
        ctx.strokeStyle = `rgba(248, 250, 252, ${0.6 * alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - eff.dirX * 40, sy - eff.dirY * 40);
        ctx.stroke();
      } else if (eff.type === "pulseStrike") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const progress = eff.delay ? Math.min(1, eff.t / eff.delay) : 1;
        const r = (eff.radius || 55) * (0.3 + 0.7 * progress);
        const alpha = 0.4 + 0.3 * Math.sin(this.time * 12);
        ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (eff.type === "pulseDetonation") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const r = (eff.radius || 55) * Math.min(1, eff.t / (eff.duration || 0.25));
        const alpha = 1 - eff.t / (eff.duration || 0.25);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, `rgba(147, 197, 253, ${0.7 * alpha})`);
        g.addColorStop(0.6, `rgba(96, 165, 250, ${0.4 * alpha})`);
        g.addColorStop(1, "rgba(96, 165, 250, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
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
        const empowerStacks = this.empowerStacks?.[i] || 0;
        const cascadeFlash = this.skillCascadeFlashUntil?.[i] != null && this.time < this.skillCascadeFlashUntil[i];
        slotEl.classList.toggle("skill-cascade-flash", !!cascadeFlash);
        const stackEl = slotEl.querySelector(".skill-empower-stacks");
        if (stackEl) {
          stackEl.textContent = empowerStacks > 0 ? String(empowerStacks) : "";
          stackEl.style.display = empowerStacks > 0 ? "block" : "none";
        }
      }
      const isCharging = this.skillChargeSlot === i;
      slotEl.classList.toggle("skill-slot-charging", isCharging);
      const cd = this.skillCooldowns[i] || 0;
      const baseCd = def ? def.baseCd : 1;
      const isAura = def && def.category === "aura";
      let pct = 0;
      if (isCharging && this.skillChargeStartTime != null) {
        const chargeDur = Math.min(2, this.time - this.skillChargeStartTime);
        pct = chargeDur / 2;
        if (cdEl) {
          cdEl.style.background = `conic-gradient(#eab308 0deg, #f59e0b ${pct * 360}deg, transparent ${pct * 360}deg)`;
        }
      } else {
        const mods = getModsForSkillSlot(this, i);
        const effectiveBaseCd = baseCd + (mods.includes("amplify") ? 0.5 : 0);
        pct = !isAura && effectiveBaseCd > 0 ? Math.min(1, cd / (effectiveBaseCd * this.getSkillCooldownMult())) : 0;
        if (cdEl) {
          cdEl.style.background = pct > 0 ? `conic-gradient(#374151 0deg, #374151 ${pct * 360}deg, transparent ${pct * 360}deg)` : "none";
        }
      }
      slotEl.classList.toggle("aura-active", isAura && this.activeAuras.has(skillId));
    }
  }

  computePlayerDamage(enemy) {
    let dmg = this.currentStats.attack;
    dmg += this.getAttackUpgradeValue("flatDamage");
    dmg *= 1 + this.getAttackUpgradeValue("damageBoost");
    dmg *= 1 - this.getAttackPenaltyValue("damageReduction");
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
    if (this.hasUpgradeCard("berserkerRage")) {
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
    this.processEnemyDebuffs(dt, boss);
    if (boss.stunUntil != null && this.time < boss.stunUntil) return;

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
      if (Math.random() < 0.4) {
        const card = MODIFICATION_CARD_DEFS[Math.floor(Math.random() * MODIFICATION_CARD_DEFS.length)];
        addModCardToInventory(card.id);
        if (hasTalent("luckyDraw") && Math.random() < 0.25) {
          const card2 = MODIFICATION_CARD_DEFS[Math.floor(Math.random() * MODIFICATION_CARD_DEFS.length)];
          addModCardToInventory(card2.id);
        }
        if (hasTalent("cardSurge")) this.cardSurgeUntil = this.time + 8;
      }
      const legDropChance = this.difficulty >= 4 ? 0.25 : 0.15;
      if (Math.random() < legDropChance) {
        const cube = LEGENDARY_CUBES[Math.floor(Math.random() * LEGENDARY_CUBES.length)];
        this.lootSystem.spawnCubeAt(bx, by, cube.id);
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
      if (hasTalent("livingItem")) {
        const living = this.getLivingItem();
        if (living && (living.modifiers?.length ?? 0) < 6) {
          const pool = getModifierPoolForType(living.type);
          const d = Math.min(5, Math.max(1, this.difficulty ?? 1));
          for (let add = 0; add < 2 && (living.modifiers?.length ?? 0) < 6; add++) {
            const available = pool.filter((p) => !living.modifiers?.some((m) => m.id === p.id));
            if (available.length === 0) break;
            const m = available[Math.floor(Math.random() * available.length)];
            const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(d) : rollModifierValueForDifficulty(d);
            living.modifiers = living.modifiers || [];
            living.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
          }
          this.rebuildItemStats(living);
          this.recalculateStats();
          this.updateEquippedUI();
        }
      }
      if (this.difficulty === 5) {
        if (hasTalent("forgeMastery") && Math.random() < 0.1) {
          this.mapInteractables.push({ type: "foresightShrine", x: bx + 100, y: by - 60, w: 64, h: 64 });
        }
        if (hasTalent("perfectCraft") && Math.random() < 0.05) {
          this.mapInteractables.push({ type: "perfectionWorkshop", x: bx - 100, y: by - 60, w: 64, h: 64 });
        }
      }
    }
  }

  interactWithMapObject(obj) {
    if (obj.type === "socketWorkshop") {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item && (item.sockets ?? 0) < 2) {
          let add = 1;
          if (item.rarity === "rare" && (item.sockets ?? 0) === 1 && hasTalent("tinkererSocketMastery") && Math.random() < 0.05) add = 2;
          item.sockets = Math.min(3, (item.sockets ?? 0) + add);
          this.rebuildItemStats(item);
          this.recalculateStats();
          this.updateEquippedUI();
          break;
        }
      }
    } else if (obj.type === "foresightShrine") {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item) {
          item.modifiers = item.modifiers || [];
          if (!item.modifiers.some((m) => m.id === "foresight")) {
            item.modifiers.push({ id: "foresight", label: "Foresight", statKey: null, value: 0, addedAt: Date.now() });
            this.rebuildItemStats(item);
            this.recalculateStats();
            this.updateEquippedUI();
            break;
          }
        }
      }
    } else if (obj.type === "perfectionWorkshop") {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item && item.modifiers?.length > 0) {
          const idx = Math.floor(Math.random() * item.modifiers.length);
          if (!LEGENDARY_MODIFIER_IDS.includes(item.modifiers[idx].id)) {
            item.modifiers[idx].value = 0.45 + Math.random() * 0.05;
            this.rebuildItemStats(item);
            this.recalculateStats();
            this.updateEquippedUI();
          }
          break;
        }
      }
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
        const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
        const def = generateEquipmentItem(type, 1, 0.8, null, { difficulty: diff });
        const item = new LootItem(this.lootSystem.nextId++, ex - 10, ey - 10, def, ex, ey);
        this.lootSystem.items.push(item);
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
    const equipDropMult = hasTalent("keenEye") ? 1.15 : 1;
    const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
    const equipOpts = { qualityEye: hasTalent("qualityEye"), socketSense: hasTalent("socketSense"), difficulty };
    if (tier === "minion") {
      if (Math.random() < 0.05 * dropMult * equipDropMult) {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, lootQual, 0, "common", equipOpts);
        this.lootSystem.spawnEquipmentAt(ex, ey, def);
      }
    } else if (tier === "elite") {
      if (Math.random() < 0.2 * dropMult * equipDropMult) {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, Math.min(1, lootQual + 0.35), 0.3, "magic", equipOpts);
        this.lootSystem.spawnEquipmentAt(ex, ey, def);
      }
    } else if (tier === "miniBoss") {
      const type = types[Math.floor(Math.random() * types.length)];
      const def = generateEquipmentItem(type, 1, 0.8, "rare", equipOpts);
      this.lootSystem.spawnEquipmentAt(ex, ey, def);
      if (Math.random() < 0.1 * dropMult * equipDropMult) {
        const type2 = types[Math.floor(Math.random() * types.length)];
        const def2 = generateEquipmentItem(type2, 1, 0.8, "rare", equipOpts);
        this.lootSystem.spawnEquipmentAt(ex + 25, ey, def2);
      }
      if (hasTalent("philosophersStone") && Math.random() < 0.05) {
        const legType = types[Math.floor(Math.random() * types.length)];
        const legDef = this.generateLegendaryEquipment(legType);
        this.lootSystem.spawnEquipmentAt(ex + 15, ey - 20, legDef);
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
            living.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
            this.rebuildItemStats(living);
            this.recalculateStats();
            this.updateEquippedUI();
          }
        }
      }
    }

    let modCardChance = tier === "minion" ? 0.02 : tier === "elite" ? 0.05 : tier === "miniBoss" ? 0.15 : 0;
    if (hasTalent("arcaneEye")) modCardChance *= 1.2;
    if (modCardChance > 0 && Math.random() < modCardChance * dropMult) {
      const card = MODIFICATION_CARD_DEFS[Math.floor(Math.random() * MODIFICATION_CARD_DEFS.length)];
      addModCardToInventory(card.id);
      if (hasTalent("luckyDraw") && Math.random() < 0.25) {
        const card2 = MODIFICATION_CARD_DEFS[Math.floor(Math.random() * MODIFICATION_CARD_DEFS.length)];
        addModCardToInventory(card2.id);
      }
      if (hasTalent("cardSurge")) this.cardSurgeUntil = this.time + 8;
    }
    if (tier === "elite" && hasTalent("fluxFinder") && Math.random() < 0.15) {
      addFlux(1);
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
    if (fromEnemy && (this.ghostLooterUntargetableUntil > this.time || this.phantomExtractorUntil > this.time)) return;
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
    if (this.hasUpgradeCard("ghostForm") && this.ghostStepTimer > 0) return;

    // Phoenix Strike: invulnerability
    if (this.phoenixInvulnUntil && this.time < this.phoenixInvulnUntil) return;

    // Dash: invulnerability at midpoint
    if (this.dashActive && this.dashTimer < 0.2 && this.dashTimer >= 0.1) return;

    // Blade Dash: full invulnerability
    if (this.bladeDashActive) return;

    // Iron Skin: absorbs one hit
    if (this.hasUpgradeCard("ironWill") && this.ironSkinShieldReady) {
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

    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    this.addFloatingText(px, py, effectiveDamage, "playerDamage");

    this.currentHealth -= effectiveDamage;
    this.timeSinceLastHit = 0;

    if (this.hasUpgradeCard("ghostForm")) {
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
    if (this.hasUpgradeCard("ironWill")) {
      this.ironSkinTimer += dt;
      if (this.ironSkinTimer >= 10 && !this.ironSkinShieldReady) {
        this.ironSkinShieldReady = true;
        this.ironSkinTimer = 0;
      }
    } else {
      this.ironSkinTimer = 0;
      this.ironSkinShieldReady = false;
    }

    if (this.hasUpgradeCard("ghostForm")) {
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
    this.enemySystem.draw(ctx, this.camera, this.time);

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

    for (const obj of this.mapInteractables) {
      const sx = obj.x - this.camera.position.x;
      const sy = obj.y - this.camera.position.y;
      const pulse = 0.7 + Math.sin(this.time * 4 + obj.x) * 0.15;
      let fill = "#60a5fa";
      let label = "?";
      if (obj.type === "socketWorkshop") {
        fill = "#38bdf8";
        label = "⚙ Socket";
      } else if (obj.type === "foresightShrine") {
        fill = "#a78bfa";
        label = "👁 Foresight";
      } else if (obj.type === "perfectionWorkshop") {
        fill = "#fbbf24";
        label = "✨ Perfect";
      }
      ctx.fillStyle = fill;
      ctx.globalAlpha = 0.4 + pulse * 0.3;
      ctx.fillRect(sx, sy, obj.w, obj.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, sy, obj.w, obj.h);
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(label, sx + obj.w / 2, sy + obj.h / 2);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    if (this.nearInteractable) {
      const sx = this.viewWidth / 2 - 80;
      const sy = this.viewHeight - 50;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sx, sy, 160, 28);
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(sx, sy, 160, 28);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Press E to interact", this.viewWidth / 2, sy + 16);
      ctx.textAlign = "start";
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
    if (this.adrenalineTrail && this.adrenalineTrail.length > 0) {
      for (let i = 0; i < this.adrenalineTrail.length; i++) {
        const t = this.adrenalineTrail[i];
        const alpha = 0.15 + (i / this.adrenalineTrail.length) * 0.25;
        const sx = Math.floor(t.x - this.camera.position.x);
        const sy = Math.floor(t.y - this.camera.position.y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(sx + 2, sy + 2, this.player.size - 4, this.player.size - 4);
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

    for (const orb of this.pulseOrbs) {
      const sx = orb.x - this.camera.position.x;
      const sy = orb.y - this.camera.position.y;
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 8);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
      g.addColorStop(0, "#e0f2fe");
      g.addColorStop(0.5, "#7dd3fc");
      g.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const proj of this.playerProjectiles) {
      proj.draw(ctx, this.camera);
    }

    // Floating combat text — on top of everything
    const camX = this.camera.position.x;
    const camY = this.camera.position.y;
    for (const entry of this.floatingCombatText) {
      const age = this.time - entry.t;
      if (age > 0.8) continue;
      const yOffset = age * 80;
      const alpha = 1 - age / 0.8;
      const sx = entry.x - camX + entry.offsetX;
      const sy = entry.y - camY - yOffset;

      let color = "#fff";
      let size = 16;
      if (entry.type === "crit") {
        color = "#facc15";
        size = 22;
      } else if (entry.type === "skill") {
        color = "#fb923c";
        size = 16;
      } else if (entry.type === "dot") {
        color = "#4ade80";
        size = 12;
      } else if (entry.type === "playerDamage") {
        color = "#ef4444";
        size = 18;
      } else if (entry.type === "heal") {
        color = "#22c55e";
        size = 18;
      }
      if (entry.isKillingBlow) size = Math.round(size * 1.25);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${entry.isKillingBlow ? "bold " : ""}${size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(entry.text, sx, sy);
      ctx.restore();
    }

    ctx.restore();
  }

  handleLootPickup(lootItem) {
    if (lootItem.type === "Cube" && lootItem.cubeKey) {
      this.addCubeToInventory(lootItem.cubeKey);
      if (hasTalent("secureFooting")) this.secureFootingUntil = this.time + 1;
      if (this.hasUpgradeCard("secureFooting")) this.swiftFeetTimer = 2.0;
      this.updateInventoryUI();
      return;
    }

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
      baseStat: lootItem.baseStat || null,
      sockets: lootItem.sockets ?? 0
    };

    this.inventory.push(newItem);

    if (hasTalent("secureFooting")) this.secureFootingUntil = this.time + 1;
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
  }

  generateLegendaryEquipment(type) {
    const baseKey = EQUIPMENT_BASE_STAT[type];
    const range = EQUIPMENT_BASE_RANGES[type];
    const baseValue = Math.round(range.min + (range.max - range.min) * 0.9);
    const baseStat = { [baseKey]: baseValue };
    const sec = EQUIPMENT_SECONDARY_BASE[type];
    if (sec) {
      const secValue = Math.round(sec.range.min + (sec.range.max - sec.range.min) * 0.9);
      baseStat[sec.statKey] = secValue;
    }
    const modifiers = [];
    const legPool = [...LEGENDARY_CUBES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 2; i++) {
      const c = legPool[i];
      modifiers.push({ id: c.modifierId, label: c.modifierLabel, statKey: null, value: 0, addedAt: Date.now() });
    }
    const pool = getModifierPoolForType(type).sort(() => Math.random() - 0.5);
    const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
    for (let i = 0; i < 2; i++) {
      const m = pool[i];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(diff) : rollModifierValueForDifficulty(diff);
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
    }
    const baseNames = EQUIPMENT_BASE_NAMES[type];
    const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
    const name = `Legendary ${baseName}`;
    const stats = { ...baseStat };
    for (const m of modifiers) {
      if (LEGENDARY_MODIFIER_IDS.includes(m.id)) continue;
      if (m.id === "defenseStatScale") stats.defense = Math.round((stats.defense || 0) * (1 + m.value));
      else if (m.id === "maxHealthStatScale") stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + m.value));
      else if (m.statKey === "attackSpeed") stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
      else if (m.statKey === "cooldownRecovery") stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
      else if (m.statKey) {
        const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
        stats[key] = (stats[key] || 0) + m.value;
      }
    }
    return { type, name, rarity: "legendary", baseStat, modifiers, stats, sockets: 0 };
  }

  addCubeToInventory(cubeKey) {
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
  }

  tryDropCubeFromEnemy(enemy) {
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isFiery || enemy.isCursedChestGuardian);
    const isElite = !!(enemy.enemyTier === "elite" || enemy.isElite);
    let dropMult = this.hasBlessing("fortune") ? 2 : 1;
    if (hasTalent("cubeMagnet")) dropMult *= 1.2;

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
      this.lootSystem.spawnCubeAt(ex, ey, `${cube.id}T${tier}`);
    };

    if (isMiniBoss) {
      if (hasTalent("rarityRush") && this.difficulty >= 3 && Math.random() < 0.05) {
        const cube = LEGENDARY_CUBES[Math.floor(Math.random() * LEGENDARY_CUBES.length)];
        this.lootSystem.spawnCubeAt(ex, ey, cube.id);
      }
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
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    this.addFloatingText(px, py, `+${Math.round(amount)}`, "heal");
    this.updateStatsUI();
    this.updateHealthBar();
  }

  addFloatingText(worldX, worldY, text, type, isKillingBlow = false) {
    this.floatingCombatText.push({
      x: worldX,
      y: worldY,
      text: String(text),
      type: type || "normal",
      t: this.time,
      isKillingBlow: !!isKillingBlow,
      offsetX: (Math.random() - 0.5) * 24
    });
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
    return hasTalent(key);
  }

  hasAttackUpgrade(id) {
    return (this.runAttackUpgrades || []).some((u) => u.id === id);
  }

  getAttackUpgradeValue(id) {
    const u = (this.runAttackUpgrades || []).find((x) => x.id === id);
    if (!u || u.value === undefined) return 0;
    return u.percent ? u.value / 100 : u.value;
  }

  hasAttackPenalty(id) {
    return (this.runAttackPenalties || []).some((p) => p.id === id);
  }

  getAttackPenaltyValue(id) {
    const p = (this.runAttackPenalties || []).find((x) => x.id === id);
    if (!p || p.value === undefined) return 0;
    return p.percent ? p.value / 100 : p.value;
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
      if (this.hasUpgradeCard("homing")) proj.maxLifetime = 3;
      proj.piercing = !!this.hasUpgradeCard("piercing");
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

  isUpgradeCard(_item) {
    return false;
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

  equipUpgradeCardAtIndex(_index) {
    // Upgrade cards removed
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
    if (hasTalent("fortified")) stats.defense = Math.round((stats.defense || 0) * 1.2);
    if (hasTalent("bulwark")) stats.defense = Math.round((stats.defense || 0) * 1.1);
    if (hasTalent("thickSkin")) stats.defense = Math.round((stats.defense || 0) * 1.1);
    stats.maxHealth = Math.round(stats.maxHealth);
    stats.speed = Math.round(stats.speed);
    stats.attack = Math.round(stats.attack);
    if (hasTalent("ironFist")) stats.attack = Math.round(stats.attack * 1.1);
    if (hasTalent("synergyMaster")) {
      const sockets = getSkillModSockets();
      let count = 0;
      const slots = this.skills || [];
      for (let i = 0; i < slots.length; i++) {
        const skillId = slots[i];
        if (!skillId) continue;
        const arr = sockets[skillId];
        if (Array.isArray(arr) && arr.some((c) => c)) count++;
      }
      const filled = (this.skills || []).filter(Boolean).length;
      const allFour = filled >= 4 && count >= 4;
      const mult = 1 + count * (allFour ? 0.1 : 0.06);
      stats.attack = Math.round(stats.attack * mult);
    }
    if (hasTalent("grandSocketeer")) {
      const sockets = getSkillModSockets();
      let hasAny = false;
      for (const skillId of (this.skills || [])) {
        if (!skillId) continue;
        const arr = sockets[skillId];
        if (Array.isArray(arr) && arr.some((c) => c)) { hasAny = true; break; }
      }
      if (hasAny) stats.attack = Math.round(stats.attack * 1.5);
    }
    this.currentStats = stats;
    this.currentHealth = Math.min(this.currentHealth, stats.maxHealth);
    this.updateStatsUI();
    this.updateHealthBar();
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

  spawnUpgradeCardToInventory(_cardDef) {
    // Upgrade cards removed
  }

  handleDevGiveAllCards() {
    // Upgrade cards removed
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
    const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
    const def = generateEquipmentItem(type, lootQuality, 0.5, forceRarity, { difficulty: diff });
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
  const vault = [];

  // Conqueror / Eternal items
  for (let i = 0; i < conquerorItems.length; i++) {
    const entry = conquerorItems[i];
    vault.push({
      item: { ...entry.item },
      collectedBy: entry.collectedBy || "Unknown",
      source: "conqueror",
      conquerorIndex: i
    });
  }

  // Items from saved characters
  for (let charIndex = 0; charIndex < saved.length; charIndex++) {
    const char = saved[charIndex];
    const name = char.name || "Unknown";

    if (char.equipment) {
      for (const [slot, item] of Object.entries(char.equipment)) {
        if (!item) continue;
        vault.push({
          item: { ...item, type: item.type || slot },
          collectedBy: name,
          source: "character-equipment",
          charIndex,
          slot
        });
      }
    }

    if (Array.isArray(char.inventory)) {
      char.inventory.forEach((inv, invIndex) => {
        if (!inv) return;
        vault.push({
          item: { ...inv },
          collectedBy: name,
          source: "character-inventory",
          charIndex,
          invIndex
        });
      });
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
    if (m.id === "defenseStatScale") return `Defense of this item +${Math.round(m.value * 100)}%`;
    if (m.id === "maxHealthStatScale") return `Max Health of this item +${Math.round(m.value * 100)}%`;
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
          ${formatCards(char.activeUpgradeCards || [])}
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
  return hasTalent("vaultMaster") ? 8 : 3;
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

function deleteLegacySelectedItems() {
  if (legacySelectedIndices.size === 0) return;
  if (!confirm("Delete selected items from the Legacy Vault? This cannot be undone.")) return;

  const vault = buildLegacyVault();
  const saved = loadSavedCharacters();
  let conquerorVault = loadConquerorVault();

  const conquerorToDelete = new Set();
  const equipToClear = new Map();
  const cardsToDelete = new Map();
  const invToDelete = new Map();

  for (const idx of legacySelectedIndices) {
    const entry = vault[idx];
    if (!entry) continue;
    if (entry.source === "conqueror") {
      if (typeof entry.conquerorIndex === "number") {
        conquerorToDelete.add(entry.conquerorIndex);
      }
    } else if (entry.source === "character-equipment") {
      const key = entry.charIndex;
      if (key == null || !entry.slot) continue;
      let set = equipToClear.get(key);
      if (!set) {
        set = new Set();
        equipToClear.set(key, set);
      }
      set.add(entry.slot);
    } else if (entry.source === "character-card") {
      const key = entry.charIndex;
      if (key == null || typeof entry.cardIndex !== "number") continue;
      let set = cardsToDelete.get(key);
      if (!set) {
        set = new Set();
        cardsToDelete.set(key, set);
      }
      set.add(entry.cardIndex);
    } else if (entry.source === "character-inventory") {
      const key = entry.charIndex;
      if (key == null || typeof entry.invIndex !== "number") continue;
      let set = invToDelete.get(key);
      if (!set) {
        set = new Set();
        invToDelete.set(key, set);
      }
      set.add(entry.invIndex);
    }
  }

  // Apply deletions to saved characters
  for (const [charIndex, slots] of equipToClear.entries()) {
    const ch = saved[charIndex];
    if (!ch || !ch.equipment) continue;
    for (const slot of slots) {
      if (Object.prototype.hasOwnProperty.call(ch.equipment, slot)) {
        ch.equipment[slot] = null;
      }
    }
  }

  for (const [charIndex, indices] of cardsToDelete.entries()) {
    const ch = saved[charIndex];
    if (!ch || !Array.isArray(ch.activeUpgradeCards)) continue;
    ch.activeUpgradeCards = ch.activeUpgradeCards.filter((_, i) => !indices.has(i));
  }

  for (const [charIndex, indices] of invToDelete.entries()) {
    const ch = saved[charIndex];
    if (!ch || !Array.isArray(ch.inventory)) continue;
    ch.inventory = ch.inventory.filter((_, i) => !indices.has(i));
  }

  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));

  // Apply deletions to conqueror vault
  if (conquerorToDelete.size > 0) {
    conquerorVault = conquerorVault.filter((_, i) => !conquerorToDelete.has(i));
    localStorage.setItem(CONQUEROR_VAULT_KEY, JSON.stringify(conquerorVault));
  }

  legacySelectedIndices = new Set();
  renderLegacyVault();
}

function openLegacyVault() {
  renderLegacyVault();
  const overlay = document.getElementById("legacy-vault-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

function openSkillLibrary() {
  renderSkillLibrary();
  const overlay = document.getElementById("skill-library-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

function closeSkillLibrary() {
  const overlay = document.getElementById("skill-library-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.classList.remove("hidden");
}

function renderSkillLibraryCardsPanel() {
  const titleEl = document.getElementById("skill-library-cards-title");
  const listEl = document.getElementById("skill-library-cards-list");
  if (!titleEl || !listEl) return;

  const inv = getModCardInventory();
  const target = skillLibraryPickerTarget;

  if (target) {
    const def = SKILL_DEFS.find((s) => s.id === target.skillId);
    const skillName = def ? def.name : target.skillId;
    titleEl.textContent = `Choose card to socket → ${escapeHtml(skillName)} (slot ${target.slotIndex + 1})`;
  } else {
    titleEl.textContent = inv.length === 0 ? "Modification cards" : "Modification cards — click a + slot on a skill to socket";
  }

  listEl.innerHTML = "";
  inv.forEach((cardId, invIdx) => {
    const cardDef = MODIFICATION_CARD_DEFS.find((c) => c.id === cardId);
    if (!cardDef) return;
    if (target) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skill-library-picker-btn";
      btn.textContent = cardDef.name;
      btn.title = cardDef.desc;
      btn.addEventListener("click", () => {
        const socketsData = getSkillModSockets();
        if (!socketsData[target.skillId]) socketsData[target.skillId] = [];
        const slotCards = socketsData[target.skillId];
        removeModCardFromInventoryAtIndex(invIdx);
        while (slotCards.length <= target.slotIndex) slotCards.push(null);
        slotCards[target.slotIndex] = cardId;
        setSkillModSockets(socketsData);
        skillLibraryPickerTarget = null;
        renderSkillLibrary();
      });
      listEl.appendChild(btn);
    } else {
      const span = document.createElement("span");
      span.className = "skill-library-picker-btn";
      span.style.pointerEvents = "none";
      span.textContent = cardDef.name;
      span.title = cardDef.desc;
      listEl.appendChild(span);
    }
  });
}

function renderSkillLibrary() {
  const skillsPanel = document.getElementById("skill-library-skills-panel");
  const fluxEl = document.getElementById("skill-library-flux-value");
  if (fluxEl) fluxEl.textContent = getFlux();
  if (!skillsPanel) return;

  const levels = getSkillLevels();
  const sockets = getSkillModSockets();
  const skillIds = SKILL_DEFS.map((s) => s.id);

  let html = '<div class="skill-library-list">';
  for (const skillId of skillIds) {
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (!def) continue;
    const level = getSkillLevel(skillId);
    const xp = getSkillXp(skillId);
    const xpForCurrent = getXpForSkillLevel(level);
    const xpForNext = getXpForSkillLevel(level + 1);
    const xpInLevel = level >= SKILL_MAX_LEVEL ? 0 : xp - xpForCurrent;
    const xpNeeded = level >= SKILL_MAX_LEVEL ? 1 : xpForNext - xpForCurrent;
    const pct = level >= SKILL_MAX_LEVEL ? 1 : xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 0;

    const maxSlots = getModSlotsForSkillLevel(level);
    let slotCards = sockets[skillId];
    if (!Array.isArray(slotCards)) slotCards = [];
    while (slotCards.length < maxSlots) slotCards.push(null);
    slotCards = slotCards.slice(0, maxSlots);

    html += `<div class="skill-library-card" data-skill-id="${escapeHtml(skillId)}">
      <div class="skill-library-card-header">
        <span class="skill-library-card-icon">${escapeHtml(def.icon)}</span>
        <span class="skill-library-card-name">${escapeHtml(def.name)}</span>
        <span class="skill-library-card-level">Lv.${level}${level >= SKILL_MAX_LEVEL ? " (max)" : ""}</span>
      </div>
      <div class="skill-library-xp-label">${level >= SKILL_MAX_LEVEL ? "Max level" : `${xpInLevel} / ${xpNeeded} XP`}</div>
      <div class="skill-library-xp-bar"><div class="skill-library-xp-fill" style="width:${Math.round(pct * 100)}%"></div></div>
      <div class="skill-library-mods">`;

    for (let i = 0; i < maxSlots; i++) {
      const cardId = slotCards[i];
      const cardDef = cardId ? MODIFICATION_CARD_DEFS.find((c) => c.id === cardId) : null;
      const filled = !!cardId;
      html += `<div class="skill-library-mod-slot ${filled ? "filled" : ""}" data-skill-id="${escapeHtml(skillId)}" data-slot-index="${i}" title="${cardDef ? escapeHtml(cardDef.desc) : "Click to socket a modification card"}">${cardDef ? escapeHtml(cardDef.name) : "+"}</div>`;
    }
    html += "</div></div>";
  }
  html += "</div>";
  skillsPanel.innerHTML = html;

  skillsPanel.querySelectorAll(".skill-library-mod-slot").forEach((el) => {
    el.addEventListener("click", () => {
      const skillId = el.dataset.skillId;
      const slotIndex = parseInt(el.dataset.slotIndex, 10);
      const socketsData = getSkillModSockets();
      if (!socketsData[skillId]) socketsData[skillId] = [];
      const slotCards = socketsData[skillId];
      const cardId = slotCards[slotIndex];

      if (cardId) {
        if (getFlux() < 1) {
          return;
        }
        if (!confirm("Unsocket this card? Costs 1 Flux.")) return;
        addFlux(-1);
        slotCards[slotIndex] = null;
        addModCardToInventory(cardId);
        setSkillModSockets(socketsData);
        renderSkillLibrary();
        return;
      }

      const inv = getModCardInventory();
      if (inv.length === 0) return;
      if (inv.length === 1) {
        const cardId = inv[0];
        removeModCardFromInventoryAtIndex(0);
        while (slotCards.length <= slotIndex) slotCards.push(null);
        slotCards[slotIndex] = cardId;
        setSkillModSockets(socketsData);
        renderSkillLibrary();
        return;
      }
      showSkillLibraryCardPicker(skillId, slotIndex);
    });
  });

  renderSkillLibraryCardsPanel();
}

let skillLibraryPickerTarget = null;

function showSkillLibraryCardPicker(skillId, slotIndex) {
  skillLibraryPickerTarget = { skillId, slotIndex };
  renderSkillLibraryCardsPanel();
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
    if (branchName === "Warrior") {
      html += renderWarriorTalentBranch(nodes, purchased, lp);
    } else if (branchName === "Survivalist") {
      html += renderSurvivalistTalentBranch(nodes, purchased, lp);
    } else if (branchName === "Scavenger") {
      html += renderScavengerTalentBranch(nodes, purchased, lp);
    } else if (branchName === "Tinkerer") {
      html += renderTinkererTalentBranch(nodes, purchased, lp);
    } else {
      const genericPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
      html += `<div class="talent-tree-branch"><div class="talent-tree-branch-header"><div class="talent-tree-branch-title">${escapeHtml(branchName)}</div><button type="button" class="talent-tree-branch-refund-btn" data-branch="${escapeHtml(branchName)}" ${genericPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button></div><div class="talent-tree-nodes">`;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isPurchased = purchased.includes(node.id);
        const prevPurchased = i === 0 || purchased.includes(nodes[i - 1].id);
        const isAvailable = !isPurchased && prevPurchased && lp >= node.cost;
        const state = isPurchased ? "purchased" : isAvailable ? "available" : "locked";
        const canRefund = isPurchased && canRefundTalent(node.id, purchased);
        const tooltip = node.desc || "";
        const title = tooltip + (canRefund ? " Click to refund." : "");
        html += `<div class="talent-tree-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""}>
          <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
          <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
          <div class="talent-tree-node-cost">${isPurchased ? "✓ Purchased" : `${node.cost} LP`}</div>
        </div>`;
      }
      html += "</div></div>";
    }
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

  content.querySelectorAll(".talent-tree-node.purchased").forEach((el) => {
    const id = el.dataset.talentId;
    el.addEventListener("click", () => {
      if (refundTalent(id)) renderTalentTree();
    });
  });

  content.querySelectorAll(".talent-tree-branch-refund-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const branch = btn.dataset.branch;
      if (!branch) return;
      const nodes = TALENT_TREE[branch];
      const purchased = getPurchasedTalents();
      const count = nodes ? nodes.filter((n) => purchased.includes(n.id)).length : 0;
      if (count === 0) return;
      if (!confirm(`Refund all ${count} talent(s) in ${branch}? You will recover their LP.`)) return;
      refundBranch(branch);
      renderTalentTree();
    });
  });
}

function renderWarriorTalentBranch(nodes, purchased, lp) {
  // Predefined layout: 7-column grid, 4 tiers
  const position = {
    fierce: { row: 1, col: 2 },
    rapid: { row: 1, col: 4 },
    resilient: { row: 1, col: 6 },
    bloodthirst: { row: 3, col: 2 },
    predator: { row: 3, col: 3 },
    reflexes: { row: 3, col: 5 },
    ironWill: { row: 3, col: 6 },
    frenzy: { row: 5, col: 2 },
    executioner: { row: 5, col: 3 },
    battleScarred: { row: 5, col: 4 },
    endurance: { row: 5, col: 5 },
    fortress: { row: 5, col: 6 },
    berserkerRage: { row: 7, col: 2 },
    warlord: { row: 7, col: 3 },
    secondWind: { row: 7, col: 4 },
    immortal: { row: 7, col: 5 }
  };

  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;

  const maxRow = 7;
  const maxCol = 7;

  // Build node HTML
  let gridHtml = "";
  for (const node of nodes) {
    const pos = position[node.id];
    if (!pos) continue;
    const isPurchased = purchased.includes(node.id);
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const hasAll = parentsAll.length === 0 || parentsAll.every((p) => purchased.includes(p));
    const hasAny = parentsAny.length === 0 || parentsAny.some((p) => purchased.includes(p));
    const canUnlock = !isPurchased && hasAll && hasAny && lp >= node.cost;
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const tooltip = node.desc || "";
    const title = tooltip + (canRefund ? " Click to refund." : "");
    gridHtml += `<div class="talent-tree-node warrior-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""} style="grid-row:${pos.row};grid-column:${pos.col};">
      <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
      <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
      <div class="talent-tree-node-cost">${isPurchased ? "✓ Purchased" : `${node.cost} LP`}</div>
    </div>`;
  }

  // Build connection lines between parent and child nodes
  const edges = [];
  for (const node of nodes) {
    const id = node.id;
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const parents = [...parentsAll, ...parentsAny];
    for (const parentId of parents) {
      const parentPos = position[parentId];
      const childPos = position[id];
      if (!parentPos || !childPos) continue;
      const row = (parentPos.row + childPos.row) / 2;
      const colStart = Math.min(parentPos.col, childPos.col);
      const colEnd = Math.max(parentPos.col, childPos.col);
      edges.push({ row, colStart, colEnd });
    }
  }

  let connHtml = "";
  for (const e of edges) {
    connHtml += `<div class="warrior-connection" style="grid-row:${e.row};grid-column:${e.colStart} / ${e.colEnd + 1};"></div>`;
  }

  const warriorPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  return `<div class="talent-tree-branch warrior-branch">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">Warrior</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="Warrior" ${warriorPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="warrior-tree-grid">
      ${connHtml}
      ${gridHtml}
    </div>
  </div>`;
}

function renderSurvivalistTalentBranch(nodes, purchased, lp) {
  const position = {
    fortitude: { row: 1, col: 2 },
    bulwark: { row: 1, col: 4 },
    nimble: { row: 1, col: 6 },
    vitality: { row: 3, col: 2 },
    thickSkin: { row: 3, col: 3 },
    toughness: { row: 3, col: 5 },
    fleetFooted: { row: 3, col: 6 },
    lifebloom: { row: 5, col: 2 },
    secondBreath: { row: 5, col: 3 },
    retaliation: { row: 5, col: 4 },
    evasion: { row: 5, col: 5 },
    shadowStep: { row: 5, col: 6 },
    undyingResolve: { row: 7, col: 2 },
    livingFortress: { row: 7, col: 3 },
    ghostForm: { row: 7, col: 4 },
    untouchable: { row: 7, col: 5 }
  };

  let gridHtml = "";
  for (const node of nodes) {
    const pos = position[node.id];
    if (!pos) continue;
    const isPurchased = purchased.includes(node.id);
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const hasAll = parentsAll.length === 0 || parentsAll.every((p) => purchased.includes(p));
    const hasAny = parentsAny.length === 0 || parentsAny.some((p) => purchased.includes(p));
    const canUnlock = !isPurchased && hasAll && hasAny && lp >= node.cost;
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const tooltip = node.desc || "";
    const title = tooltip + (canRefund ? " Click to refund." : "");
    gridHtml += `<div class="talent-tree-node survivalist-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""} style="grid-row:${pos.row};grid-column:${pos.col};">
      <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
      <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
      <div class="talent-tree-node-cost">${isPurchased ? "✓ Purchased" : `${node.cost} LP`}</div>
    </div>`;
  }

  const edges = [];
  for (const node of nodes) {
    const id = node.id;
    const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
    for (const parentId of parents) {
      const parentPos = position[parentId];
      const childPos = position[id];
      if (!parentPos || !childPos) continue;
      const row = (parentPos.row + childPos.row) / 2;
      const colStart = Math.min(parentPos.col, childPos.col);
      const colEnd = Math.max(parentPos.col, childPos.col);
      edges.push({ row, colStart, colEnd });
    }
  }

  let connHtml = "";
  for (const e of edges) {
    connHtml += `<div class="warrior-connection" style="grid-row:${e.row};grid-column:${e.colStart} / ${e.colEnd + 1};"></div>`;
  }

  const survivalistPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  return `<div class="talent-tree-branch survivalist-branch">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">Survivalist</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="Survivalist" ${survivalistPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="warrior-tree-grid survivalist-tree-grid">
      ${connHtml}
      ${gridHtml}
    </div>
  </div>`;
}

function renderScavengerTalentBranch(nodes, purchased, lp) {
  const position = {
    arcaneEye: { row: 1, col: 2 },
    swiftExtraction: { row: 1, col: 5 },
    keenEye: { row: 1, col: 8 },
    cardHoarder: { row: 3, col: 1 },
    fluxFinder: { row: 3, col: 2 },
    luckyDraw: { row: 3, col: 4 },
    socketMastery: { row: 3, col: 5 },
    secureFooting: { row: 3, col: 6 },
    itemSense: { row: 3, col: 7 },
    modSpecialist: { row: 3, col: 8 },
    synergyMaster: { row: 5, col: 1 },
    cardSurge: { row: 5, col: 2 },
    ghostLooter: { row: 5, col: 3 },
    treasureSense: { row: 5, col: 4 },
    appraiser: { row: 5, col: 5 },
    cardTranscendence: { row: 7, col: 1 },
    phantomExtractor: { row: 7, col: 2 },
    vaultMaster: { row: 7, col: 3 },
    curator: { row: 7, col: 4 }
  };

  let gridHtml = "";
  for (const node of nodes) {
    const pos = position[node.id];
    if (!pos) continue;
    const isPurchased = purchased.includes(node.id);
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const hasAll = parentsAll.length === 0 || parentsAll.every((p) => purchased.includes(p));
    const hasAny = parentsAny.length === 0 || parentsAny.some((p) => purchased.includes(p));
    const canUnlock = !isPurchased && hasAll && hasAny && lp >= node.cost;
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const tooltip = node.desc || "";
    const title = tooltip + (canRefund ? " Click to refund." : "");
    gridHtml += `<div class="talent-tree-node scavenger-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""} style="grid-row:${pos.row};grid-column:${pos.col};">
      <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
      <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
      <div class="talent-tree-node-cost">${isPurchased ? "✓ Purchased" : `${node.cost} LP`}</div>
    </div>`;
  }

  const edges = [];
  for (const node of nodes) {
    const id = node.id;
    const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
    for (const parentId of parents) {
      const parentPos = position[parentId];
      const childPos = position[id];
      if (!parentPos || !childPos) continue;
      const row = (parentPos.row + childPos.row) / 2;
      const colStart = Math.min(parentPos.col, childPos.col);
      const colEnd = Math.max(parentPos.col, childPos.col);
      edges.push({ row, colStart, colEnd });
    }
  }

  let connHtml = "";
  for (const e of edges) {
    connHtml += `<div class="warrior-connection scavenger-connection" style="grid-row:${e.row};grid-column:${e.colStart} / ${e.colEnd + 1};"></div>`;
  }

  const scavengerPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  return `<div class="talent-tree-branch scavenger-branch">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">Scavenger</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="Scavenger" ${scavengerPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="warrior-tree-grid scavenger-tree-grid">
      ${connHtml}
      ${gridHtml}
    </div>
  </div>`;
}

function renderTinkererTalentBranch(nodes, purchased, lp) {
  const position = {
    cubeMagnet: { row: 1, col: 2 },
    socketSense: { row: 1, col: 4 },
    transmuter: { row: 1, col: 6 },
    cubeExpert: { row: 3, col: 1 },
    tinkerersEye: { row: 3, col: 3 },
    socketFinder: { row: 3, col: 5 },
    qualityEye: { row: 3, col: 7 },
    forgeMastery: { row: 5, col: 1 },
    cubeCascade: { row: 5, col: 2 },
    tinkererSocketMastery: { row: 5, col: 4 },
    rarityRush: { row: 5, col: 5 },
    transmutation: { row: 5, col: 7 },
    perfectCraft: { row: 7, col: 1 },
    grandSocketeer: { row: 7, col: 2 },
    livingItem: { row: 7, col: 4 },
    philosophersStone: { row: 7, col: 6 }
  };

  let gridHtml = "";
  for (const node of nodes) {
    const pos = position[node.id];
    if (!pos) continue;
    const isPurchased = purchased.includes(node.id);
    const parentsAll = node.parentsAll || [];
    const parentsAny = node.parentsAny || [];
    const hasAll = parentsAll.length === 0 || parentsAll.every((p) => purchased.includes(p));
    const hasAny = parentsAny.length === 0 || parentsAny.some((p) => purchased.includes(p));
    const canUnlock = !isPurchased && hasAll && hasAny && lp >= node.cost;
    const state = isPurchased ? "purchased" : canUnlock ? "available" : "locked";
    const canRefund = isPurchased && canRefundTalent(node.id, purchased);
    const tooltip = node.desc || "";
    const title = tooltip + (canRefund ? " Click to refund." : "");
    gridHtml += `<div class="talent-tree-node tinkerer-node ${state}" data-talent-id="${escapeHtml(node.id)}" data-cost="${node.cost}" title="${escapeHtml(title)}"${canRefund ? ' data-refundable="true"' : ""} style="grid-row:${pos.row};grid-column:${pos.col};">
      <div class="talent-tree-node-name">${escapeHtml(node.name)}</div>
      <div class="talent-tree-node-desc">${escapeHtml(node.desc)}</div>
      <div class="talent-tree-node-cost">${isPurchased ? "✓ Purchased" : `${node.cost} LP`}</div>
    </div>`;
  }

  const edges = [];
  for (const node of nodes) {
    const id = node.id;
    const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
    for (const parentId of parents) {
      const parentPos = position[parentId];
      const childPos = position[id];
      if (!parentPos || !childPos) continue;
      const row = (parentPos.row + childPos.row) / 2;
      const colStart = Math.min(parentPos.col, childPos.col);
      const colEnd = Math.max(parentPos.col, childPos.col);
      edges.push({ row, colStart, colEnd });
    }
  }

  let connHtml = "";
  for (const e of edges) {
    connHtml += `<div class="warrior-connection tinkerer-connection" style="grid-row:${e.row};grid-column:${e.colStart} / ${e.colEnd + 1};"></div>`;
  }

  const tinkererPurchased = nodes.filter((n) => purchased.includes(n.id)).length;
  return `<div class="talent-tree-branch tinkerer-branch">
    <div class="talent-tree-branch-header">
      <div class="talent-tree-branch-title">Tinkerer</div>
      <button type="button" class="talent-tree-branch-refund-btn" data-branch="Tinkerer" ${tinkererPurchased === 0 ? "disabled" : ""} title="Refund all talents in this branch">Refund all</button>
    </div>
    <div class="warrior-tree-grid tinkerer-tree-grid">
      ${connHtml}
      ${gridHtml}
    </div>
  </div>`;
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
let pendingAttackType = "projectile";

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
  const attackTypeEl = document.getElementById("skill-select-attack-type");
  const slotsEl = document.getElementById("skill-select-slots");
  const poolEl = document.getElementById("skill-select-pool");
  if (!slotsEl || !poolEl) return;

  if (attackTypeEl) {
    attackTypeEl.innerHTML = "";
    for (const atk of ATTACK_TYPES) {
      const btn = document.createElement("button");
      btn.className = "skill-select-attack-btn" + (pendingAttackType === atk.id ? " selected" : "");
      btn.dataset.attackType = atk.id;
      btn.innerHTML = `<span class="skill-select-attack-name">${escapeHtml(atk.name)}</span><span class="skill-select-attack-desc">${escapeHtml(atk.desc)}</span>`;
      btn.addEventListener("click", () => {
        pendingAttackType = atk.id;
        renderSkillSelectScreen();
      });
      attackTypeEl.appendChild(btn);
    }
  }

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
    skills,
    attackType: pendingAttackType
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

    const devAddLpBtn = document.getElementById("main-menu-dev-add-lp");
    const devLpAmountEl = document.getElementById("main-menu-dev-lp-amount");
    if (devAddLpBtn && devLpAmountEl) {
      devAddLpBtn.addEventListener("click", () => {
        const amount = parseInt(devLpAmountEl.value, 10) || 0;
        if (amount > 0) {
          addLegacyPoints(amount);
          refreshMainMenuLP();
        }
      });
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

    const skillLibraryBtn = document.getElementById("main-menu-skill-library");
    if (skillLibraryBtn) {
      skillLibraryBtn.addEventListener("click", openSkillLibrary);
    }
    const skillLibraryCloseBtn = document.getElementById("skill-library-close");
    if (skillLibraryCloseBtn) {
      skillLibraryCloseBtn.addEventListener("click", closeSkillLibrary);
    }

    const legacyDeleteBtn = document.getElementById("legacy-delete-selected");
    if (legacyDeleteBtn) {
      legacyDeleteBtn.addEventListener("click", deleteLegacySelectedItems);
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

