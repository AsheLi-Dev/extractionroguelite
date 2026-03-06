import { getSkillModSockets, getSkillUnlocks } from './constants.js';
import { hasTalent } from './talents.js';

export const SKILL_CATEGORIES = { projectile: "Projectile", melee: "Melee", aura: "Aura" };

export const MODIFICATION_CARD_CATEGORIES = { delivery: "Delivery", trigger: "Trigger", element: "Element", self: "Self" };

export const MODIFICATION_CARD_DEFS = [
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

export const DELIVERY_TRIGGER_MOD_IDS = MODIFICATION_CARD_DEFS.filter(
  (c) => c.category === "delivery" || c.category === "trigger"
).map((c) => c.id);

export function getModsForSkillSlot(game, slot) {
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

export function getModEffectMult(game) {
  return hasTalent("grandSocketeer") ? 1.5 : 1;
}

export function applyElementDebuffsFromMods(game, enemy, mods, skillDamage, gameTime) {
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

export const SKILL_DEFS = [
  { id: "fireball", name: "Fireball", icon: "spr_skill_fireball", illustration: "assets/UI/Fireball.png", baseCd: 3, desc: "Slow projectile, explodes for area damage + burning ground 3s", unlock: "always", category: "projectile", tags: ["projectile", "ranged", "area"] },
  { id: "iceShard", name: "Ice Shard", icon: "spr_skill_iceShard", illustration: "assets/UI/Ice Shard.png", baseCd: 2, desc: "Fast piercing projectile, slows 30% for 2s", unlock: "always", category: "projectile", tags: ["projectile", "ranged"] },
  { id: "lightningBolt", name: "Lightning Bolt", icon: "spr_skill_lightningBolt", illustration: "assets/UI/Lightning Bolt.png", baseCd: 2.5, desc: "Instant strike, chains to 1 enemy for 50%", unlock: "always", category: "projectile", tags: ["ranged"] },
  { id: "rapidFire", name: "Rapid Fire", icon: "spr_skill_rapidFire", illustration: "assets/UI/Rapid Fire.png", baseCd: 8, desc: "3 projectiles/sec at nearest enemy for 3s", unlock: "always", category: "projectile", tags: ["projectile", "ranged"] },
  { id: "shieldBash", name: "Shield Bash", icon: "spr_skill_shieldBash", illustration: "assets/UI/Shield Bash.png", baseCd: 4, desc: "Cone knockback + stun 0.5s", unlock: "always", category: "projectile", tags: ["melee", "crowd_control"] },
  { id: "healPulse", name: "Heal Pulse", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 10, desc: "Restore 15% max health", unlock: "always", category: "projectile", tags: ["area", "defense", "utility"] },
  { id: "iceRain", name: "Ice Rain", icon: "spr_skill_iceRain", illustration: "assets/UI/Ice Rain.png", baseCd: 12, desc: "Ice storm 4s, continuous damage, slow 50%", unlock: "scavengerFull", category: "projectile", tags: ["area", "ranged"] },
  { id: "lightningSpear", name: "Lightning Spear", icon: "spr_skill_lightningSpear", illustration: "assets/UI/Lightning Spear.png", baseCd: 8, desc: "Charge 0.5s, piercing spear, stun 1s", unlock: "diff3", category: "projectile", tags: ["projectile", "ranged", "crowd_control"] },
  { id: "meteor", name: "Meteor", icon: "spr_skill_meteor", illustration: "assets/UI/Meteor.png", baseCd: 15, desc: "1s delay, massive area damage, burning 5s", unlock: "diff4", category: "projectile", tags: ["area", "ranged"] },
  { id: "voidRift", name: "Void Rift", icon: "spr_skill_voidRift", illustration: "assets/UI/Void Rift.png", baseCd: 14, desc: "Pull enemies 3s then explode", unlock: "diff5", category: "projectile", tags: ["area", "ranged", "crowd_control"] },
  { id: "timeWarp", name: "Time Warp", icon: "spr_skill_timeWarp", illustration: "assets/UI/Time Warp.png", baseCd: 20, desc: "Slow enemies 50% for 4s", unlock: "mastermind", category: "projectile", tags: ["utility", "crowd_control"] },
  { id: "phoenixStrike", name: "Phoenix Strike", icon: "spr_skill_phoenixStrike", illustration: "assets/UI/Phoenix Strike.png", baseCd: 25, desc: "Explosion + 3s invincibility", unlock: "secondWindUsed", category: "projectile", tags: ["area", "defense", "utility"] },
  { id: "chainFrost", name: "Chain Frost", icon: "spr_skill_chainFrost", illustration: "assets/UI/Chain Frost.png", baseCd: 18, desc: "Freeze all enemies 2s", unlock: "iceShard5", category: "projectile", tags: ["area", "crowd_control"] },
  { id: "stormCall", name: "Storm Call", icon: "spr_skill_stormCall", illustration: "assets/UI/Storm Call.png", baseCd: 20, desc: "Lightning storm 6s", unlock: "lightningOnlyRun", category: "projectile", tags: ["area", "ranged"] },
  { id: "bladeDash", name: "Blade Dash", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 5, desc: "Dash forward damaging all enemies in path", unlock: "always", category: "melee", tags: ["melee", "utility"] },
  { id: "whirlwind", name: "Whirlwind", icon: "spr_skill_whirlwind", illustration: "assets/UI/Whirlwind.png", baseCd: 10, desc: "Spin 2s hitting nearby enemies, move at half speed", unlock: "always", category: "melee", tags: ["melee", "area"] },
  { id: "groundSlam", name: "Ground Slam", icon: "spr_skill_groundSlam", illustration: "assets/UI/Ground Slam.png", baseCd: 6, desc: "Shockwave damaging and knocking back nearby enemies", unlock: "always", category: "melee", tags: ["melee", "area", "crowd_control"] },
  { id: "bladeStorm", name: "Blade Storm", icon: "spr_skill_bladeStorm", illustration: "assets/UI/Blade Storm.png", baseCd: 12, desc: "8 spinning blades bounce off walls, pierce enemies 3s", unlock: "diff2", category: "melee", tags: ["melee", "area"] },
  { id: "earthquake", name: "Earthquake", icon: "spr_skill_earthquake", illustration: "assets/UI/Earthquake.png", baseCd: 18, desc: "Map shake 3s, damage and slow all on screen", unlock: "diff4", category: "melee", tags: ["area", "crowd_control"] },
  { id: "frostAura", name: "Frost Aura", icon: "spr_skill_frostAura", illustration: "assets/UI/Frost Aura.png", baseCd: 0, desc: "Toggle: slow nearby 25%, 0.5% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.005, tags: ["aura", "crowd_control"] },
  { id: "flameAura", name: "Flame Aura", icon: "spr_skill_flameAura", illustration: "assets/UI/Flame Aura.png", baseCd: 0, desc: "Toggle: burn nearby enemies, 0.5% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.005, tags: ["aura", "area"] },
  { id: "thunderAura", name: "Thunder Aura", icon: "spr_skill_thunderAura", illustration: "assets/UI/Thunder Aura.png", baseCd: 0, desc: "Toggle: lightning to nearest every 1.5s, 1% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.01, tags: ["aura", "ranged"] },
  { id: "barrierAura", name: "Barrier Aura", icon: "spr_skill_barrierAura", illustration: "assets/UI/Barrier Aura.png", baseCd: 0, desc: "Toggle: -15% damage taken, 1.5% HP/s", unlock: "fortified", category: "aura", auraUpkeep: 0.015, tags: ["aura", "defense", "utility"] },
  { id: "soulAura", name: "Soul Aura", icon: "spr_skill_soulAura", illustration: "assets/UI/Soul Aura.png", baseCd: 0, desc: "Toggle: 50% damage to healing, 2% HP/s", unlock: "vampiric50", category: "aura", auraUpkeep: 0.02, tags: ["aura", "defense"] }
];

export function isSkillUnlocked(skillDef) {
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

export function getUnlockedSkills() {
  return SKILL_DEFS.filter((s) => isSkillUnlocked(s));
}
