import { getSkillModSockets, getSkillUnlocks } from './constants.js';

export const SKILL_CATEGORIES = { projectile: "Projectile", melee: "Melee", aura: "Aura" };

/**
 * Damage scaling: +% of skill base damage per point in the listed stat.
 * S=30%, A=20%, B=10%, C=5% per attribute point.
 */
export const DAMAGE_SCALING_TIERS = { S: 0.3, A: 0.2, B: 0.1, C: 0.05 };

/** @deprecated Use DAMAGE_SCALING_TIERS */
export const SCALING_TIERS = DAMAGE_SCALING_TIERS;

/** Same numeric table as damage; used for heal amount scaling (separate skill fields). */
export const HEAL_SCALING_TIERS = DAMAGE_SCALING_TIERS;

function tierMultiplier(tierTable, tierLetter) {
  return tierLetter && tierTable[tierLetter] ? tierTable[tierLetter] : 0;
}

/**
 * Skill damage: uses scalingPrimary / scalingSecondary (tiers) and scalingStat1 / scalingStat2.
 */
export function getSkillDamageScalingMult(game, skillDef) {
  if (!skillDef || !game) return 1;
  const attrs = game.runCharacterAttributes || {};
  const t1 = tierMultiplier(DAMAGE_SCALING_TIERS, skillDef.scalingPrimary);
  const t2 = tierMultiplier(DAMAGE_SCALING_TIERS, skillDef.scalingSecondary);
  const statVal = (key) => Math.max(0, Number(attrs[key]) || 0);
  const stat1 = skillDef.scalingStat1 || "brutality";
  const stat2 = skillDef.scalingStat2 || "agility";
  const s1 = statVal(stat1);
  const s2 = statVal(stat2);
  const mult = 1 + s1 * t1 + s2 * t2;
  return Number.isFinite(mult) && mult > 0 ? mult : 1;
}

/**
 * Heal-only scaling: healScalingPrimary / healScalingSecondary and healScalingStat1 / healScalingStat2.
 * Returns 1 if no heal tier is set.
 */
export function getSkillHealScalingMult(game, skillDef) {
  if (!skillDef || !game) return 1;
  const t1 = tierMultiplier(HEAL_SCALING_TIERS, skillDef.healScalingPrimary);
  const t2 = tierMultiplier(HEAL_SCALING_TIERS, skillDef.healScalingSecondary);
  if (t1 === 0 && t2 === 0) return 1;
  const attrs = game.runCharacterAttributes || {};
  const statVal = (key) => Math.max(0, Number(attrs[key]) || 0);
  const stat1 = skillDef.healScalingStat1 || "vitality";
  const stat2 = skillDef.healScalingStat2 || "luck";
  const s1 = statVal(stat1);
  const s2 = statVal(stat2);
  const mult = 1 + s1 * t1 + s2 * t2;
  return Number.isFinite(mult) && mult > 0 ? mult : 1;
}

/**
 * Future: cooldown scaling from attributes (not used yet).
 * @returns {number} Always 1 until implemented.
 */
export function getSkillCooldownScalingMult(_game, _skillDef) {
  return 1;
}

/**
 * Future: crowd-control duration / potency scaling (not used yet).
 * @returns {number} Always 1 until implemented.
 */
export function getSkillCrowdControlScalingMult(_game, _skillDef) {
  return 1;
}

/** @deprecated Use getSkillDamageScalingMult — same behavior. */
export function getSkillStatScalingMult(game, skillDef) {
  return getSkillDamageScalingMult(game, skillDef);
}

/** Base attack used when estimating skill hit damage outside a run (matches Game `baseStats.attack` before gear). */
export const SKILL_LIBRARY_PREVIEW_BASE_ATTACK = 20;

/**
 * Estimated integer damage for a typical hit (multiplier 1, no gear/mods), using global attributes.
 * Returns null if the skill has no damage scaling tiers (e.g. heal-only).
 */
export function previewSkillLibraryHitDamage(skillDef, attributes) {
  if (!skillDef) return null;
  if (!skillDef.scalingPrimary && !skillDef.scalingSecondary) return null;
  const attrs = attributes || {};
  const game = {
    runCharacterAttributes: {
      brutality: Math.max(0, Number(attrs.brutality) || 0),
      agility: Math.max(0, Number(attrs.agility) || 0),
      vitality: Math.max(0, Number(attrs.vitality) || 0),
      luck: Math.max(0, Number(attrs.luck) || 0)
    }
  };
  const scalingMult = getSkillDamageScalingMult(game, skillDef);
  const attack = SKILL_LIBRARY_PREVIEW_BASE_ATTACK + game.runCharacterAttributes.brutality;
  return Math.round(attack * scalingMult);
}

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
  { id: "cooldownCascade", name: "Cooldown Cascade", category: "self", desc: "Reset cooldown if this skill kills an enemy." },
  { id: "extraChargesHpCost", name: "+2 Charges (10% HP)", category: "self", desc: "+2 charges; skill costs 10% max HP per use." },
  { id: "hpLostDamage", name: "Blood Price", category: "self", desc: "For every 10 HP lost, next use gains +1% damage." },
  { id: "recoverLostHpOnHit", name: "Vampiric Echo", category: "self", desc: "Recover 10% of lost HP on hit; cooldown +5s." },
  { id: "missingHpCdr", name: "Desperation", category: "self", desc: "For every 1% missing HP, gain 1% cooldown reduction." },
  { id: "triggerOtherSlot", name: "Wild Cascade", category: "trigger", desc: "On use, 10% chance to trigger skill in another slot." },
  { id: "triggerFromHpLoss", name: "Pain Trigger", category: "trigger", desc: "Trigger this skill from HP loss progress." },
  { id: "triggerFromBasicHit", name: "Strike Trigger", category: "trigger", desc: "Trigger this skill from basic attack hit progress." },
  { id: "triggerFromKill", name: "Kill Trigger", category: "trigger", desc: "Trigger this skill from kill progress." },
  { id: "triggerFromHpRecovery", name: "Heal Trigger", category: "trigger", desc: "Trigger this skill from HP recovery progress." },
  { id: "reviveLockTwo", name: "Last Stand", category: "self", desc: "Revive on death once, then lock this skill and another random." },
  { id: "triggerFromGold", name: "Greed Trigger", category: "trigger", desc: "Trigger this skill from gold collection progress." },
  { id: "triggerFromUrn", name: "Shatter Trigger", category: "trigger", desc: "Trigger this skill from urn/breakable destruction progress." },
  { id: "onChestOpenCdr", name: "Treasure Haste", category: "self", desc: "Opening a chest reduces this skill's cooldown by 1s." },
  { id: "onChestOpenNextDamage", name: "Chest Fury", category: "self", desc: "Opening a chest makes next use deal +30% damage." },
  { id: "cdrNearTree", name: "Forest Focus", category: "self", desc: "Gain 20% cooldown reduction near a tree." },
  { id: "autocast", name: "Autocast", category: "trigger", desc: "Autocast when cooldown ends." },
  { id: "projectilesStop1s", name: "Arrest", category: "delivery", desc: "Projectiles stop moving after 1s." },
  { id: "projectilesGrow", name: "Growing", category: "delivery", desc: "Projectiles grow in size while flying." },
  { id: "ancestralSpiritMelee", name: "Ancestral Strike", category: "trigger", desc: "Summon spirit that moves to target and uses this melee skill." },
  { id: "persistentAreaMoves", name: "Hunting Zone", category: "delivery", desc: "Persistent area slowly moves toward nearby enemies." },
  { id: "skillTriggersBasicAttack", name: "Follow-Through", category: "self", desc: "Using this skill also triggers a basic attack." },
  { id: "channelRepeat3", name: "Triple Cast", category: "trigger", desc: "Channel to repeat this skill up to 3 times." },
  { id: "damagePerSecondReady", name: "Patience", category: "self", desc: "Gain +1% damage per second after cooldown ready, up to 30%." },
  { id: "orbitInfinitePenetration2s", name: "Orbit Pierce", category: "delivery", desc: "Projectiles orbit player, infinite penetration, +2s lifetime." },
  { id: "summonAssassinSpirit", name: "Assassin Spirit", category: "trigger", desc: "Summon dormant assassin; triggers this melee skill at 300% when enemies approach." },
  { id: "summonGuardianSpirit", name: "Guardian Spirit", category: "trigger", desc: "Summon guardian that uses this skill at 20% effectiveness." }
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
  return 1;
}

export function applyElementDebuffsFromMods(game, enemy, mods, skillDamage, gameTime) {
  if (!mods || mods.length === 0) return;
  const mult = getModEffectMult(game);
  if (mods.includes("ignite")) {
    const dps = (0.15 * skillDamage) * mult;
    if (typeof game?.applyStatusToEntity === "function") {
      game.applyStatusToEntity(enemy.id, "burn", {
        duration: 3,
        magnitude: dps,
        stacks: Math.max(1, enemy.burnStacks || 1),
        sourceId: "player",
        sourceType: "skill_mod",
        data: {
          damageModel: "dps",
          reason: "enemy_burn_tick"
        }
      });
    } else {
      enemy.burnUntil = gameTime + 3;
      enemy.burnDps = Math.max(enemy.burnDps || 0, dps);
      enemy.burnAccum = 0;
    }
  }
  if (mods.includes("chill")) {
    const slowMult = 1 - 0.2 * mult;
    if (typeof game?.applyStatusToEntity === "function") {
      game.applyStatusToEntity(enemy.id, "slow", {
        duration: 2,
        magnitude: slowMult,
        sourceId: "player",
        sourceType: "skill_mod"
      });
    } else {
      enemy.slowUntil = Math.max(enemy.slowUntil || 0, gameTime + 2);
      enemy.slowMult = Math.min(enemy.slowMult ?? 1, slowMult);
    }
  }
  if (mods.includes("shock") && Math.random() < 0.25 * mult) {
    if (typeof game?.applyStatusToEntity === "function") {
      game.applyStatusToEntity(enemy.id, "stun", {
        duration: 0.5,
        sourceId: "player",
        sourceType: "skill_mod"
      });
    } else {
      enemy.stunUntil = Math.max(enemy.stunUntil || 0, gameTime + 0.5);
    }
  }
  if (mods.includes("toxic")) {
    if (typeof game?.applyStatusToEntity === "function") {
      game.applyStatusToEntity(enemy.id, "poison", {
        duration: 3,
        magnitude: enemy.maxHealth * 0.05,
        maxStacks: 3,
        stackDelta: 1,
        stackingMode: "stack_refresh",
        sourceId: "player",
        sourceType: "skill_mod",
        data: {
          reason: "skill_mod_toxic_tick"
        }
      });
    } else {
      enemy.toxicStacks = Math.min(3, (enemy.toxicStacks || 0) + 1);
      enemy.toxicUntil = gameTime + 3;
      enemy.toxicAccum = 0;
    }
  }
  if (mods.includes("void")) {
    const voidMult = 1 - 0.2 * mult;
    if (typeof game?.applyStatusToEntity === "function") {
      game.applyStatusToEntity(enemy.id, "void", {
        duration: 4,
        magnitude: voidMult,
        sourceId: "player",
        sourceType: "skill_mod"
      });
    } else {
      enemy.voidDefenseUntil = gameTime + 4;
      enemy.voidDefenseMult = voidMult;
    }
  }
}

export const SKILL_DEFS = [
  { id: "fireball", name: "Fireball", icon: "spr_skill_fireball", illustration: "assets/UI/Fireball.png", baseCd: 3, desc: "Slow projectile, explodes for area damage + burning ground 3s", unlock: "always", category: "projectile", tags: ["projectile", "ranged", "area"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "iceShard", name: "Ice Shard", icon: "spr_skill_iceShard", illustration: "assets/UI/Ice Shard.png", baseCd: 2, desc: "Fast piercing projectile, slows 30% for 2s", unlock: "always", category: "projectile", tags: ["projectile", "ranged"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "lightningBolt", name: "Lightning Bolt", icon: "spr_skill_lightningBolt", illustration: "assets/UI/Lightning Bolt.png", baseCd: 2.5, desc: "Instant strike, chains to 1 enemy for 50%", unlock: "always", category: "projectile", tags: ["ranged"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "rapidFire", name: "Rapid Fire", icon: "spr_skill_rapidFire", illustration: "assets/UI/Rapid Fire.png", baseCd: 8, desc: "3 projectiles/sec at nearest enemy for 3s", unlock: "always", category: "projectile", tags: ["projectile", "ranged"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "A", scalingStat2: "agility" },
  { id: "shieldBash", name: "Shield Bash", icon: "spr_skill_shieldBash", illustration: "assets/UI/Shield Bash.png", baseCd: 4, desc: "Cone knockback + stun 0.5s", unlock: "always", category: "projectile", tags: ["melee", "crowd_control"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "vitality" },
  { id: "healPulse", name: "Heal Pulse", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 10, desc: "Restore 15% max health", unlock: "always", category: "projectile", tags: ["area", "defense", "utility"], healScalingPrimary: "C", healScalingStat1: "vitality" },
  { id: "iceRain", name: "Ice Rain", icon: "spr_skill_iceRain", illustration: "assets/UI/Ice Rain.png", baseCd: 12, desc: "Ice storm 4s, continuous damage, slow 50%", unlock: "scavengerFull", category: "projectile", tags: ["area", "ranged"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "lightningSpear", name: "Lightning Spear", icon: "spr_skill_lightningSpear", illustration: "assets/UI/Lightning Spear.png", baseCd: 8, desc: "Charge 0.5s, piercing spear, stun 1s", unlock: "diff3", category: "projectile", tags: ["projectile", "ranged", "crowd_control"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "meteor", name: "Meteor", icon: "spr_skill_meteor", illustration: "assets/UI/Meteor.png", baseCd: 15, desc: "1s delay, massive area damage, burning 5s", unlock: "diff4", category: "projectile", tags: ["area", "ranged"], scalingPrimary: "S", scalingStat1: "brutality", scalingSecondary: "A", scalingStat2: "luck" },
  { id: "voidRift", name: "Void Rift", icon: "spr_skill_voidRift", illustration: "assets/UI/Void Rift.png", baseCd: 14, desc: "Pull enemies 3s then explode", unlock: "diff5", category: "projectile", tags: ["area", "ranged", "crowd_control"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "timeWarp", name: "Time Warp", icon: "spr_skill_timeWarp", illustration: "assets/UI/Time Warp.png", baseCd: 20, desc: "Slow enemies 50% for 4s", unlock: "mastermind", category: "projectile", tags: ["utility", "crowd_control"], scalingPrimary: "B", scalingStat1: "luck", scalingSecondary: "C", scalingStat2: "agility" },
  { id: "phoenixStrike", name: "Phoenix Strike", icon: "spr_skill_phoenixStrike", illustration: "assets/UI/Phoenix Strike.png", baseCd: 25, desc: "Explosion + 3s invincibility", unlock: "secondWindUsed", category: "projectile", tags: ["area", "defense", "utility"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "vitality" },
  { id: "chainFrost", name: "Chain Frost", icon: "spr_skill_chainFrost", illustration: "assets/UI/Chain Frost.png", baseCd: 18, desc: "Freeze all enemies 2s", unlock: "iceShard5", category: "projectile", tags: ["area", "crowd_control"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "stormCall", name: "Storm Call", icon: "spr_skill_stormCall", illustration: "assets/UI/Storm Call.png", baseCd: 20, desc: "Lightning storm 6s", unlock: "lightningOnlyRun", category: "projectile", tags: ["area", "ranged"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "bladeDash", name: "Blade Dash", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 5, desc: "Dash forward damaging all enemies in path", unlock: "always", category: "melee", tags: ["melee", "utility"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "A", scalingStat2: "agility" },
  { id: "whirlwind", name: "Whirlwind", icon: "spr_skill_whirlwind", illustration: "assets/UI/Whirlwind.png", baseCd: 10, desc: "Spin 2s hitting nearby enemies, move at half speed", unlock: "always", category: "melee", tags: ["melee", "area"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "groundSlam", name: "Ground Slam", icon: "spr_skill_groundSlam", illustration: "assets/UI/Ground Slam.png", baseCd: 6, desc: "Shockwave damaging and knocking back nearby enemies", unlock: "always", category: "melee", tags: ["melee", "area", "crowd_control"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "vitality" },
  { id: "bladeStorm", name: "Blade Storm", icon: "spr_skill_bladeStorm", illustration: "assets/UI/Blade Storm.png", baseCd: 12, desc: "8 spinning blades bounce off walls, pierce enemies 3s", unlock: "diff2", category: "melee", tags: ["melee", "area"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "earthquake", name: "Earthquake", icon: "spr_skill_earthquake", illustration: "assets/UI/Earthquake.png", baseCd: 18, desc: "Map shake 3s, damage and slow all on screen", unlock: "diff4", category: "melee", tags: ["area", "crowd_control"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "vitality" },
  { id: "frostAura", name: "Frost Aura", icon: "spr_skill_frostAura", illustration: "assets/UI/Frost Aura.png", baseCd: 0, desc: "Toggle: slow nearby 25%, 0.5% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.005, tags: ["aura", "crowd_control"], scalingPrimary: "B", scalingStat1: "vitality", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "flameAura", name: "Flame Aura", icon: "spr_skill_flameAura", illustration: "assets/UI/Flame Aura.png", baseCd: 0, desc: "Toggle: burn nearby enemies, 0.5% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.005, tags: ["aura", "area"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "thunderAura", name: "Thunder Aura", icon: "spr_skill_thunderAura", illustration: "assets/UI/Thunder Aura.png", baseCd: 0, desc: "Toggle: lightning to nearest every 1.5s, 1% HP/s", unlock: "always", category: "aura", auraUpkeep: 0.01, tags: ["aura", "ranged"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "A", scalingStat2: "luck" },
  { id: "barrierAura", name: "Barrier Aura", icon: "spr_skill_barrierAura", illustration: "assets/UI/Barrier Aura.png", baseCd: 0, desc: "Toggle: -15% damage taken, 1.5% HP/s", unlock: "fortified", category: "aura", auraUpkeep: 0.015, tags: ["aura", "defense", "utility"], scalingPrimary: "C", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "brutality" },
  { id: "soulAura", name: "Soul Aura", icon: "spr_skill_soulAura", illustration: "assets/UI/Soul Aura.png", baseCd: 0, desc: "Toggle: 50% damage to healing, 2% HP/s", unlock: "vampiric50", category: "aura", auraUpkeep: 0.02, tags: ["aura", "defense"], scalingPrimary: "B", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "brutality" },
  { id: "spinningScythe", name: "Spinning Scythe", icon: "spr_skill_bladeStorm", illustration: "assets/UI/Blade Storm.png", baseCd: 6, desc: "Throw scythe forward; returns, heals 10% of damage dealt", unlock: "always", category: "projectile", tags: ["projectile", "melee", "area"], scalingPrimary: "B", scalingStat1: "brutality", healScalingPrimary: "C", healScalingStat1: "vitality" },
  { id: "lumberjackAssault", name: "Lumberjack Assault", icon: "spr_skill_groundSlam", illustration: "assets/UI/Ground Slam.png", baseCd: 8, desc: "Overhead strike in circle; bonus vs large/miniboss; hitting tree spawns splinters", unlock: "always", category: "melee", tags: ["melee", "area"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "escapePlan", name: "Escape Plan", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 14, desc: "Random-direction teleport exactly 200px, damages nearby enemies; if enemies remain nearby, fully refunds cooldown", unlock: "always", category: "melee", tags: ["utility", "area"], scalingPrimary: "C", scalingStat1: "agility", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "meteorRain", name: "Meteor Rain", icon: "spr_skill_meteor", illustration: "assets/UI/Meteor.png", baseCd: 18, desc: "Charge up to 5s; meteor field around player, follows you", unlock: "diff4", category: "projectile", tags: ["area", "ranged"], scalingPrimary: "S", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "hauntingGhostCharges", name: "Haunting Ghost Charges", icon: "spr_skill_chainFrost", illustration: "assets/UI/Chain Frost.png", baseCd: 0, desc: "Gain charge per 5 kills; spend to summon ghost that slows and explodes after 2s", unlock: "always", category: "projectile", tags: ["area", "crowd_control"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "frenzyProtocol", name: "Frenzy Protocol", icon: "spr_skill_rapidFire", illustration: "assets/UI/Rapid Fire.png", baseCd: 15, desc: "Basic attack auto-fires 5s, +40% attack speed", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "C", scalingStat1: "agility", scalingSecondary: "C", scalingStat2: "brutality" },
  { id: "spiritBanner", name: "Spirit Banner", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 20, desc: "Summon spirit at location; move and attack speed nearby", unlock: "always", category: "projectile", tags: ["utility", "area"], scalingPrimary: "C", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "spiderTrap", name: "Spider Trap", icon: "spr_skill_iceShard", illustration: "assets/UI/Ice Shard.png", baseCd: 10, desc: "Dormant trap; spider bite 3s, resets if victim dies during bite", unlock: "always", category: "projectile", tags: ["crowd_control", "area"], scalingPrimary: "C", scalingStat1: "luck", scalingSecondary: "C", scalingStat2: "agility" },
  { id: "loyalDragons", name: "Loyal Dragons", icon: "spr_skill_phoenixStrike", illustration: "assets/UI/Phoenix Strike.png", baseCd: 22, desc: "2 orbiting dragons, contact damage; spit fireballs on your basic attack", unlock: "diff3", category: "melee", tags: ["melee", "area", "projectile"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "blackHole", name: "Black Hole", icon: "spr_skill_voidRift", illustration: "assets/UI/Void Rift.png", baseCd: 16, desc: "Pulls enemies and player", unlock: "diff5", category: "projectile", tags: ["area", "crowd_control"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "waveShield", name: "Wave Shield", icon: "spr_skill_shieldBash", illustration: "assets/UI/Shield Bash.png", baseCd: 8, desc: "Orbiting wave knocks back and heals you", unlock: "always", category: "projectile", tags: ["defense", "crowd_control"], scalingPrimary: "C", scalingStat1: "brutality", healScalingPrimary: "C", healScalingStat1: "vitality" },
  { id: "magicHand", name: "Magic Hand", icon: "spr_skill_voidRift", illustration: "assets/UI/Void Rift.png", baseCd: 12, desc: "Grab enemies in area, move them to location", unlock: "always", category: "projectile", tags: ["crowd_control", "area"], scalingPrimary: "C", scalingStat1: "luck", scalingSecondary: "C", scalingStat2: "vitality" },
  { id: "purifyingFire", name: "Purifying Fire", icon: "spr_skill_flameAura", illustration: "assets/UI/Flame Aura.png", baseCd: 18, desc: "Lose 5% HP/s 5s, same damage to nearby; then heal 50% of damage, cap 40% max HP", unlock: "always", category: "aura", tags: ["area", "defense"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "luck", healScalingPrimary: "B", healScalingStat1: "vitality" },
  { id: "hunterShot", name: "Hunter Shot", icon: "spr_skill_rapidFire", illustration: "assets/UI/Rapid Fire.png", baseCd: 5, desc: "Homing projectile; on hit gain attack speed; basic attacks reduce its CD 0.1s", unlock: "always", category: "projectile", tags: ["projectile", "ranged"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "A", scalingStat2: "agility" },
  { id: "assimilativeOrb", name: "Assimilative Orb", icon: "spr_skill_voidRift", illustration: "assets/UI/Void Rift.png", baseCd: 14, desc: "5s orb absorbs projectiles, fires on absorb; explodes on expiry", unlock: "diff4", category: "projectile", tags: ["area", "ranged"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "cruelFinisher", name: "Cruel Finisher", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 10, desc: "Usable after 5 basic attacks; massive damage from target missing HP", unlock: "always", category: "melee", tags: ["melee"], scalingPrimary: "S", scalingStat1: "brutality", scalingSecondary: "A", scalingStat2: "luck" },
  { id: "homingSkullCharges", name: "Homing Skull Charges", icon: "spr_skill_chainFrost", illustration: "assets/UI/Chain Frost.png", baseCd: 0, desc: "Fire homing skull; gain charge per 3 kills, max 3", unlock: "always", category: "projectile", tags: ["projectile", "ranged"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "bloodFrenzy", name: "Blood Frenzy", icon: "spr_skill_rapidFire", illustration: "assets/UI/Rapid Fire.png", baseCd: 12, desc: "Lose 20% HP, gain attack speed", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "bloodSacrifice", name: "Blood Sacrifice", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 20, desc: "Lose 20% HP, reduce cooldown of other skills", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "C", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "luck" },
  { id: "bloodPact", name: "Blood Pact", icon: "spr_skill_soulAura", illustration: "assets/UI/Soul Aura.png", baseCd: 15, desc: "Lose 20% HP, gain lifesteal", unlock: "always", category: "projectile", tags: ["defense", "utility"], scalingPrimary: "B", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "brutality" },
  { id: "bloodAmmo", name: "Blood Ammo", icon: "spr_skill_rapidFire", illustration: "assets/UI/Rapid Fire.png", baseCd: 0, desc: "Basic attacks cost HP and gain damage", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "A", scalingStat1: "brutality", scalingSecondary: "C", scalingStat2: "vitality" },
  { id: "bloodDebt", name: "Blood Debt", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 0, desc: "Blood-risk; kill to recover", unlock: "always", category: "projectile", tags: ["defense", "utility"], scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "vitality" },
  { id: "lockpick", name: "Lockpick", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 8, desc: "Instantly open nearby chest", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "C", scalingStat1: "luck", scalingSecondary: "C", scalingStat2: "agility" },
  { id: "shatterPulse", name: "Shatter Pulse", icon: "spr_skill_groundSlam", illustration: "assets/UI/Ground Slam.png", baseCd: 6, desc: "Break nearby urns/breakables", unlock: "always", category: "melee", tags: ["area", "utility"], scalingPrimary: "C", scalingStat1: "vitality", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "trickstersKit", name: "Trickster's Kit", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 12, desc: "Random: move speed, dash charge, mimic loot, or luck bomb", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "C", scalingStat1: "luck", scalingSecondary: "A", scalingStat2: "agility" },
  { id: "fortuneCollapse", name: "Fortune Collapse", icon: "spr_skill_voidRift", illustration: "assets/UI/Void Rift.png", baseCd: 25, desc: "Luck to 0 for 10s, gain shield from lost Luck; restore after", unlock: "always", category: "projectile", tags: ["defense", "utility"], scalingPrimary: "B", scalingStat1: "luck", scalingSecondary: "C", scalingStat2: "vitality" },
  { id: "shadowHeist", name: "Shadow Heist", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 18, desc: "Invisibility 5s; attacks break it; charge after 2 chests opened", unlock: "always", category: "melee", tags: ["utility"], scalingPrimary: "C", scalingStat1: "agility", scalingSecondary: "C", scalingStat2: "luck" },
  { id: "loadedDice", name: "Loaded Dice", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 30, desc: "Luck-gambling; random powerful effect", unlock: "always", category: "projectile", tags: ["utility"], scalingPrimary: "C", scalingStat1: "luck", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "ancestralShout", name: "Ancestral Shout", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 20, desc: "Nearby allies +10% damage per ancestral spirit", unlock: "always", category: "projectile", tags: ["utility", "area"], scalingPrimary: "B", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "luck" },
  // Hero-unique skills (only assigned via playable character; not in skill picker)
  { id: "reaper_scythe", name: "Reveal", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 20, desc: "Reveal and become hostile for 10s: +15% damage and attack speed, heal 1 on kill", unlock: "always", category: "melee", tags: ["melee", "utility"], heroOnly: true, scalingPrimary: "B", scalingStat1: "brutality", healScalingPrimary: "C", healScalingStat1: "vitality" },
  { id: "strider_gust", name: "Gust", icon: "spr_skill_iceShard", illustration: "assets/UI/Ice Shard.png", baseCd: 4, desc: "Wind burst at target location, damages and knocks back", unlock: "always", category: "projectile", tags: ["area", "crowd_control"], heroOnly: true, scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "panda_focus", name: "Focus", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 12, desc: "Gain +20% damage and +15% damage reduction for 4s", unlock: "always", category: "projectile", tags: ["defense", "utility"], heroOnly: true, scalingPrimary: "B", scalingStat1: "vitality", scalingSecondary: "B", scalingStat2: "brutality" },
  { id: "knight_slide", name: "Slide", icon: "spr_skill_bladeDash", illustration: "assets/UI/Blade Dash.png", baseCd: 7, desc: "Slide through enemies, damaging and stunning them", unlock: "always", category: "melee", tags: ["melee", "utility", "crowd_control"], heroOnly: true, scalingPrimary: "B", scalingStat1: "brutality", scalingSecondary: "B", scalingStat2: "agility" },
  { id: "scavenger_rush", name: "Rush", icon: "spr_skill_healPulse", illustration: "assets/UI/Heal Pulse.png", baseCd: 20, desc: "+20% movement and chest open speed for 10s", unlock: "always", category: "projectile", tags: ["utility"], heroOnly: true, scalingPrimary: "C", scalingStat1: "agility", scalingSecondary: "C", scalingStat2: "luck" }
];

export function isSkillUnlocked(skillDef, game) {
  const u = getSkillUnlocks();
  const hasT = game && game.hasRunTalent ? (id) => game.hasRunTalent(id) : () => false;
  if (skillDef.unlock === "always") return true;
  if (skillDef.unlock === "scavengerFull") {
    return ["lootTranscendence", "vaultMaster", "curator"].some((t) => hasT(t));
  }
  if (skillDef.unlock === "diff2") return !!u.diff2;
  if (skillDef.unlock === "diff3") return !!u.diff3;
  if (skillDef.unlock === "diff4") return !!u.diff4;
  if (skillDef.unlock === "diff5") return !!u.diff5;
  if (skillDef.unlock === "fortified") return hasT("fortified");
  if (skillDef.unlock === "vampiric50") return (u.vampiricTriggers || 0) >= 50;
  if (skillDef.unlock === "mastermind") return hasT("curator");
  if (skillDef.unlock === "secondWindUsed") return !!u.secondWindUsed;
  if (skillDef.unlock === "iceShard5") return !!u.iceShard5;
  if (skillDef.unlock === "lightningOnlyRun") return !!u.lightningOnlyRun;
  return false;
}

export function getUnlockedSkills(game) {
  return SKILL_DEFS.filter((s) => isSkillUnlocked(s, game) && !s.heroOnly);
}

export function getSkillById(skillId) {
  return SKILL_DEFS.find((s) => s.id === skillId) || null;
}
