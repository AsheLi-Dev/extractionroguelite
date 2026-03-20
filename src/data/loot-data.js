// -------- Loot & cards definitions --------

import {
  getRingDefsByItemRarity,
  getRingSpriteCell,
  RING_RARITY_TO_ITEM
} from "./rings-data.js";

// Rarity system: base stat by type, modifiers, names
export const EQUIPMENT_BASE_STAT = {
  Helmet: "maxHealth",
  Weapon: "attack",
  Boots: "speed",
  "Body Armour": "defense",
  Ring: null
};

export const EQUIPMENT_BASE_NAMES = {
  Helmet: ["Leather Cap", "Cloth Hood", "Hide Cap", "Iron Helmet", "Steel Helmet", "Battle Helm", "Knight's Helm", "Dragon Helm"],
  Boots: ["Leather Boots", "Iron Greaves", "Steel Greaves", "Wind Boots", "Swift Boots", "Shadow Striders"],
  "Body Armour": ["Leather Armour", "Hide Armour", "Chainmail Vest", "Scale Armour", "Plate Armour", "Battle Plate", "Fortress Armour"],
  Weapon: ["Wooden Staff", "Iron Sword", "Steel Sword", "Battle Axe", "War Hammer", "Legendary Blade"],
  Ring: ["Gold Band Ring", "Ruby Ring", "Sapphire Ring", "Onyx Ring", "Gold Signet Ring", "Jade Ring"]
};

export const EQUIPMENT_BASE_RANGES = {
  Helmet: { min: 3, max: 25 },
  Weapon: { min: 4, max: 22 },
  Boots: { min: 35, max: 130 },
  "Body Armour": { min: 2, max: 12 }
};

/** Secondary base stat: Helmet gets defense (lower than body), Body Armour gets maxHealth (lower than helmet). */
export const EQUIPMENT_SECONDARY_BASE = {
  Helmet: { statKey: "defense", range: { min: 1, max: 8 } },
  "Body Armour": { statKey: "maxHealth", range: { min: 1, max: 15 } }
};

export const WEIGHT_OPTIONS = {
  Helmet: ["light", "medium", "heavy"],
  "Body Armour": ["light", "medium", "heavy"],
  Boots: ["light", "medium", "heavy"],
  Weapon: ["light", "medium", "heavy"]
};

// Modifier rarity (quality) is independent of item rarity.
export const MODIFIER_RARITY = {
  NORMAL: "normal",
  MAGIC: "magic",
  RARE: "rare"
};

// Roll weights for selecting modifier rarity when generating an item.
// These are data-driven so additional rarities can be added later.
export const MODIFIER_RARITY_ROLL_WEIGHTS = {
  [MODIFIER_RARITY.NORMAL]: 0.75,
  [MODIFIER_RARITY.MAGIC]: 0.20,
  [MODIFIER_RARITY.RARE]: 0.05
};

export function rollModifierRarity() {
  const r = Math.random();
  let acc = 0;
  for (const [rarity, weight] of Object.entries(MODIFIER_RARITY_ROLL_WEIGHTS)) {
    const w = Number(weight) || 0;
    acc += w;
    if (r < acc) return rarity;
  }
  // Fallback in case of rounding/weights not summing to exactly 1.
  const last = Object.keys(MODIFIER_RARITY_ROLL_WEIGHTS).slice(-1)[0];
  return last || MODIFIER_RARITY.NORMAL;
}

/**
 * Rolls `modifierCount` unique modifier definitions from `pool`, where each selection:
 *  - rolls a rarity (NORMAL/MAGIC/RARE)
 *  - filters pool by that rarity
 *  - picks a random modifier from the filtered set
 * No duplicate modifier IDs are allowed within a single roll.
 */
export function rollUniqueModifierDefsByRarity(pool, modifierCount, usedModifierIds = null) {
  const used = usedModifierIds ?? new Set();
  const result = [];
  if (!Array.isArray(pool) || modifierCount <= 0) return result;
  const attemptsPerPick = 30;

  for (let i = 0; i < modifierCount; i++) {
    let picked = null;
    for (let attempt = 0; attempt < attemptsPerPick && !picked; attempt++) {
      const rolledRarity = rollModifierRarity();
      const candidates = pool.filter((m) => m && m.rarity === rolledRarity && !used.has(m.id));
      if (candidates.length > 0) {
        picked = candidates[Math.floor(Math.random() * candidates.length)];
        break;
      }
    }

    // If rarity-filtered candidates were exhausted, fall back to any remaining modifier
    // (prevents infinite loops when the pool doesn't contain enough unique ids at a rarity).
    if (!picked) {
      const remaining = pool.filter((m) => m && !used.has(m.id));
      if (remaining.length > 0) picked = remaining[Math.floor(Math.random() * remaining.length)];
    }

    if (!picked) break;
    used.add(picked.id);
    result.push(picked);
  }

  return result;
}

export const MODIFIER_POOL = [
  { id: "attackPercent", label: "Attack Damage", statKey: "attack", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"] },
  { id: "attackSpeedPercent", label: "Attack Speed", statKey: "attackSpeed", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"] },
  { id: "maxHealthPercent", label: "Max Health", statKey: "maxHealth", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet", "Body Armour"] },
  { id: "defensePercent", label: "Defense", statKey: "defense", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet", "Body Armour"] },
  { id: "speedPercent", label: "Movement Speed", statKey: "speed", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Boots"] },
  { id: "xpGainedPercent", label: "XP Gained", statKey: "xpGained", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet", "Boots"] },
  { id: "skillDamagePercent", label: "Skill Damage", statKey: "skillDamage", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"] },

  { id: "cooldownReductionPercent", label: "Cooldown Reduction", statKey: "cooldownRecovery", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots"] },
  { id: "projectileDamagePct", label: "Projectile Damage", statKey: "skillDamage", appliesTo: { tagsAny: ["projectile"] }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"] },
  { id: "meleeDamagePct", label: "Melee Damage", statKey: "skillDamage", appliesTo: { tagsAny: ["melee"] }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"] },
  { id: "areaDamagePct", label: "Area Damage", statKey: "skillDamage", appliesTo: { tagsAny: ["area"] }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"] },
  { id: "crowdControlPowerPct", label: "Crowd Control Power", statKey: "effectPower", appliesTo: { tagsAny: ["crowd_control"] }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"] },
  { id: "curseEffectPct", label: "Curse Effect", statKey: "effectPower", appliesTo: { tagsAny: ["curse"] }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"] },
  { id: "defensePowerPct", label: "Defense Power", statKey: "effectPower", appliesTo: { tagsAny: ["defense"] }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Helmet", "Body Armour"] },

  { id: "attackDamagePct", label: "Attack Damage", statKey: "skillDamage", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "attackSpeedPct", label: "Attack Speed", statKey: "attackSpeed", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon", "Boots"] },
  { id: "meleeAttackSpeedPct", label: "Melee Attack Speed", statKey: "attackSpeed", appliesTo: { tagsAny: ["melee"] }, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "meleeFlatDamage", label: "Melee Flat Damage", statKey: "flatDamage", appliesTo: { tagsAny: ["melee"] }, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },

  { id: "defenseStatScale", label: "+x% to the defense on this item", statKey: "defense", localStatScale: true, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Body Armour"] },
  { id: "maxHealthStatScale", label: "+x% to the max health on this item", statKey: "maxHealth", localStatScale: true, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Body Armour"] },

  // Normal trigger/passive utility
  { id: "flatMaxHealth", label: "Flat Max Health", statKey: null, passiveStatKey: "flatMaxHealth", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet", "Body Armour"] },
  { id: "restoreHpOnNewMapFlat", label: "Recover Life on New Map", statKey: null, trigger: "enter_new_map", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet"] },
  { id: "sprintSpeedBonus", label: "Sprint Speed", statKey: null, passiveStatKey: "sprintSpeedBonus", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Boots"] },
  { id: "critChance", label: "Critical Chance", statKey: null, passiveStatKey: "critChance", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"] },
  { id: "healOnKillChance", label: "Chance to Heal on Kill", statKey: null, trigger: "kill", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet", "Body Armour"], data: { healFlat: 5 } },
  { id: "restoreHpOnLevelUpFlat", label: "Recover Life on Level Up", statKey: null, trigger: "level_up", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Helmet"] },
  { id: "chanceToBleedOnHit", label: "Chance to Bleed on Hit", statKey: null, trigger: "basic_attack_hit", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"], data: { durationSec: 3, dpsMultOfHit: 0.05 } },
  { id: "chanceToBurnOnHit", label: "Chance to Burn on Hit", statKey: null, trigger: "basic_attack_hit", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"], data: { durationSec: 2.5, dpsMultOfHit: 0.12, maxStacks: 1 } },
  { id: "chanceToSlowOnHit", label: "Chance to Slow on Hit", statKey: null, trigger: "basic_attack_hit", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"], data: { durationSec: 1.5, slowMult: 0.85 } },
  { id: "chestOpenSpeedPercent", label: "Chest Open Speed", statKey: null, passiveStatKey: "chestOpenSpeedPercent", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Boots"] },
  { id: "critDamageBonus", label: "Critical Damage", statKey: null, passiveStatKey: "critDamageBonus", rarity: MODIFIER_RARITY.NORMAL, allowedSlots: ["Weapon"] },
  {
    id: "moveSpeedChestOpenHybrid",
    label: "Movement Speed + Chest Open Speed",
    statKey: null,
    rarity: MODIFIER_RARITY.NORMAL,
    allowedSlots: ["Boots", "Helmet"],
    statModsByDifficulty: {
      1: { speedPercent: { min: 0.05, max: 0.08 }, chestOpenSpeedPercent: { min: 0.03, max: 0.06 } },
      2: { speedPercent: { min: 0.07, max: 0.10 }, chestOpenSpeedPercent: { min: 0.04, max: 0.08 } },
      3: { speedPercent: { min: 0.08, max: 0.12 }, chestOpenSpeedPercent: { min: 0.05, max: 0.10 } },
      4: { speedPercent: { min: 0.10, max: 0.14 }, chestOpenSpeedPercent: { min: 0.06, max: 0.11 } },
      5: { speedPercent: { min: 0.12, max: 0.16 }, chestOpenSpeedPercent: { min: 0.08, max: 0.13 } }
    }
  },
  {
    id: "flatDefenseBonus",
    label: "Flat Defense",
    statKey: null,
    rarity: MODIFIER_RARITY.NORMAL,
    allowedSlots: ["Helmet", "Body Armour"],
    statModsByDifficulty: {
      1: { defense: { min: 3, max: 6 } },
      2: { defense: { min: 4, max: 8 } },
      3: { defense: { min: 5, max: 10 } },
      4: { defense: { min: 7, max: 12 } },
      5: { defense: { min: 9, max: 14 } }
    }
  },
  {
    id: "flatHpDefenseHybrid",
    label: "Flat Max Health + Flat Defense",
    statKey: null,
    rarity: MODIFIER_RARITY.NORMAL,
    allowedSlots: ["Helmet", "Body Armour"],
    statModsByDifficulty: {
      1: { maxHealth: { min: 3, max: 6 }, defense: { min: 1, max: 3 } },
      2: { maxHealth: { min: 4, max: 8 }, defense: { min: 2, max: 4 } },
      3: { maxHealth: { min: 5, max: 10 }, defense: { min: 3, max: 5 } },
      4: { maxHealth: { min: 7, max: 12 }, defense: { min: 4, max: 6 } },
      5: { maxHealth: { min: 9, max: 14 }, defense: { min: 5, max: 8 } }
    }
  },
  {
    id: "flatHpMoveSpeedHybrid",
    label: "Flat Max Health + Flat Movement Speed",
    statKey: null,
    rarity: MODIFIER_RARITY.NORMAL,
    allowedSlots: ["Boots", "Body Armour"],
    statModsByDifficulty: {
      1: { maxHealth: { min: 3, max: 6 }, speed: { min: 10, max: 16 } },
      2: { maxHealth: { min: 4, max: 8 }, speed: { min: 12, max: 20 } },
      3: { maxHealth: { min: 5, max: 10 }, speed: { min: 15, max: 25 } },
      4: { maxHealth: { min: 7, max: 12 }, speed: { min: 18, max: 30 } },
      5: { maxHealth: { min: 9, max: 14 }, speed: { min: 22, max: 36 } }
    }
  },
  {
    id: "moveAttackSpeedHybrid",
    label: "Movement Speed + Attack Speed",
    statKey: null,
    rarity: MODIFIER_RARITY.NORMAL,
    allowedSlots: ["Boots", "Weapon"],
    statModsByDifficulty: {
      1: { speedPercent: { min: 0.03, max: 0.04 }, attackSpeedPercent: { min: 0.03, max: 0.04 } },
      2: { speedPercent: { min: 0.04, max: 0.05 }, attackSpeedPercent: { min: 0.04, max: 0.05 } },
      3: { speedPercent: { min: 0.05, max: 0.06 }, attackSpeedPercent: { min: 0.05, max: 0.06 } },
      4: { speedPercent: { min: 0.06, max: 0.07 }, attackSpeedPercent: { min: 0.06, max: 0.07 } },
      5: { speedPercent: { min: 0.07, max: 0.08 }, attackSpeedPercent: { min: 0.07, max: 0.08 } }
    }
  },

  // Magic trigger/conditional effects
  { id: "repeatBasicAttackChance", label: "Chance to Repeat Basic Attack", statKey: null, trigger: "basic_attack_hit", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"], data: { damageMult: 0.5 } },
  { id: "goldPickupDamageBuff", label: "Gold Pickup Damage Boost", statKey: null, trigger: "gold_picked_up", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"], data: { durationSec: 4 } },
  { id: "critLifesteal", label: "Critical Hit Lifesteal", statKey: null, trigger: "critical_hit", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "damageToElites", label: "Damage to Elites", statKey: null, conditional: { type: "damage_vs_elites" }, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "chestCritChanceBuff", label: "Chest Open Crit Chance", statKey: null, trigger: "chest_opened", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots", "Helmet"], data: { critChance: 0.12, durationSec: 5 } },
  { id: "basicAttackExplosion", label: "Basic Attack Explosion", statKey: null, trigger: "basic_attack_hit", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"], data: { chance: 0.20, radius: 70, damageMult: 0.30 } },
  { id: "newMapGoldXpBuff", label: "Map Entry Gold/XP", statKey: null, trigger: "enter_new_map", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots", "Helmet"], data: { durationSec: 6 } },
  { id: "chestBonusXpFlat", label: "Bonus XP from Chests", statKey: null, trigger: "chest_opened", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Helmet"] },
  { id: "pickMagicItemMoveSpeedBuff", label: "Magic Pickup Move Speed", statKey: null, trigger: "item_picked_up", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots"], data: { moveSpeedPercent: 0.15, durationSec: 3 } },
  { id: "damageToSlowed", label: "Damage to Slowed Enemies", statKey: null, conditional: { type: "damage_vs_slowed" }, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "projectilePierce", label: "Projectiles pierce additional targets", statKey: null, passiveStatKey: "projectilePierce", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "projectileSpeedPct", label: "+20-30% Projectile Speed", statKey: null, passiveStatKey: "projectileSpeedPercent", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "areaOfEffectPct", label: "+10-15% Area of Effect", statKey: null, passiveStatKey: "areaOfEffectPercent", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Weapon"] },
  { id: "fullHpMoveSpeed", label: "At full Health: +20-30% Move Speed", statKey: null, conditional: { type: "player_full_hp", statKey: "speedPercent" }, rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots"] },
  { id: "dashDistancePct", label: "+20-40% Dash Distance", statKey: null, passiveStatKey: "dashDistancePercent", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots"] },
  { id: "movementSkillCooldownPct", label: "+10-20% Dash & Movement Cooldown Recovery", statKey: null, passiveStatKey: "movementCooldownRecovery", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Boots"] },
  { id: "enterMapGoldFlat", label: "Enter new area: Gain bonus Gold", statKey: null, trigger: "enter_new_map", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Helmet", "Body Armour"] },
  { id: "minibossGoldFlat", label: "Kill a Mini-boss: Gain 40-60 Gold", statKey: null, trigger: "kill_miniboss", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Helmet", "Body Armour"] },
  { id: "xpRequirementReduction", label: "-10-15% XP Required to Level Up", statKey: null, passiveStatKey: "xpRequiredReduction", rarity: MODIFIER_RARITY.MAGIC, allowedSlots: ["Helmet"] },

  // Rare trigger/conditional effects
  { id: "critAttackSpeedStacking", label: "Critical Attack Speed (Stacking)", statKey: null, trigger: "critical_hit", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { stackPercent: 0.04, maxStacks: 5, durationSec: 4 } },
  { id: "chestDamageStacking", label: "Chest Open Damage (Stacking)", statKey: null, trigger: "chest_opened", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { stackPercent: 0.05, maxStacks: 5, durationSec: 20 } },
  { id: "dashChargeBonus", label: "Extra Dash Charge", statKey: null, passiveStatKey: "dashChargesFlat", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Boots"], data: { flat: 1 } },
  { id: "dashMoveSpeedBuff", label: "Dash Move Speed Boost", statKey: null, trigger: "dash_used", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Boots"], data: { durationSec: 1 } },
  { id: "reactiveKnockbackHeal", label: "Reactive Knockback + Heal", statKey: null, trigger: "player_took_damage", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Body Armour"], data: { healFlat: 4, radius: 110, knockback: 140, icdSec: 1.5 } },
  { id: "dashFireball", label: "Dash Fireball", statKey: null, trigger: "dash_used", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { damageMult: 0.8 } },
  { id: "critChanceFromMoveSpeed", label: "Critical Chance from Move Speed", statKey: null, conditional: { type: "crit_from_move_speed", divisor: 100 }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Boots"] },
  { id: "miniBossKillMoveSpeedBuff", label: "Mini-Boss Kill Move Speed", statKey: null, trigger: "kill_miniboss", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Boots"], data: { durationSec: 20 } },
  { id: "critSummonSpirit", label: "Critical Hit Summon Spirit", statKey: null, trigger: "critical_hit", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { chance: 0.25, damageMult: 0.35 } },
  { id: "healingReceivedPercent", label: "Healing Received", statKey: null, passiveStatKey: "healingReceivedPercent", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Helmet", "Body Armour"] },
  { id: "critLightningChance", label: "Critical Hit Lightning", statKey: null, trigger: "critical_hit", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { chance: 0.2, damageMult: 0.45, radius: 160 } },
  { id: "newMapMoveSpeedBuff", label: "Map Entry Move Speed", statKey: null, trigger: "enter_new_map", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Boots"], data: { durationSec: 20 } },
  { id: "lowCritHighDamage", label: "+200% Critical Damage, Critical Chance capped at 30%", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], statMods: { critDamageBonus: 2.0, critChanceCap: 0.30 } },
  { id: "levelUpBonusAttributeChance", label: "Level up: chance to gain +1 Attribute", statKey: null, trigger: "level_up", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Helmet"], data: { attributeBonus: 1 } },
  { id: "orbitalArrows", label: "Every 2s: Fire arrows around you", statKey: null, trigger: "interval", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { interval: 2, damageMultiplier: 0.10 } },
  { id: "mapEntryGoldPercent", label: "Enter new area: Gain % of your Gold", statKey: null, trigger: "enter_new_map", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Helmet"] },
  { id: "levelUpAttackSpeedStack", label: "Level up: Gain +1-2% Attack Speed (permanent)", statKey: null, trigger: "level_up", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { stat: "attackSpeedPercent", stacking: true, permanent: true } },
  { id: "levelUpMaxHealthFlat", label: "Level up: Gain +3-5 Max Health", statKey: null, trigger: "level_up", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Helmet", "Body Armour"], data: { stat: "maxHealthFlat", stacking: true, permanent: true } },
  { id: "levelUpAttackDamageStack", label: "Level up: Gain +2-3% Attack Damage (permanent)", statKey: null, trigger: "level_up", rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { stat: "attackPercent", stacking: true, permanent: true } },
  { id: "burningEnemyAttackSpeed", label: "Nearby burning enemies: +10-30% Attack Speed", statKey: null, conditional: { type: "nearby_burning_enemies", statKey: "attackSpeedPercent" }, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"] },
  { id: "attackDamageVsHealth", label: "+30-50% Attack Damage, -10-20% Max Health", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], statMods: { attackPercent: { min: 0.30, max: 0.50 }, maxHealthPercent: { min: -0.20, max: -0.10 } }, statModsMode: "item_stats_only" },
  { id: "xpVsHealth", label: "+20-30% XP Gained, -10-20% Max Health", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Helmet"], statMods: { xpGainedPercent: { min: 0.20, max: 0.30 }, maxHealthPercent: { min: -0.20, max: -0.10 } }, statModsMode: "item_stats_only" },
  { id: "attackSpeedVsHealth", label: "+20-30% Attack Speed, -10-20% Max Health", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], statMods: { attackSpeedPercent: { min: 0.20, max: 0.30 }, maxHealthPercent: { min: -0.20, max: -0.10 } }, statModsMode: "item_stats_only" },
  { id: "healthVsMoveSpeed", label: "+10-20% Max Health, -10-20% Move Speed", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Body Armour"], statMods: { maxHealthPercent: { min: 0.10, max: 0.20 }, speedPercent: { min: -0.20, max: -0.10 } }, statModsMode: "item_stats_only" },
  { id: "critScalingDamage", label: "Gain +1% Critical Damage per 2% Critical Chance", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Weapon"], data: { critChanceStep: 0.02, critDamagePerStep: 0.01 } },
  { id: "doubleDashHeavyCooldown", label: "+2 Dash Charges, +100% Dash Cooldown", statKey: null, rarity: MODIFIER_RARITY.RARE, allowedSlots: ["Boots"], statMods: { dashChargesFlat: 2, dashCooldownMultiplier: 2.0 } }
];

export const ARMOUR_SLOT_TYPES = ["Helmet", "Body Armour"];
export const LOCAL_STAT_SCALE_MOD_IDS = ["defenseStatScale", "maxHealthStatScale"];

export function getModifierPoolForType(type) {
  if (type === "Ring") return [];
  const pool = MODIFIER_POOL.filter((m) => {
    if (!m) return false;
    if (!Array.isArray(m.allowedSlots) || m.allowedSlots.length === 0) return true;
    return m.allowedSlots.includes(type);
  });
  if (!ARMOUR_SLOT_TYPES.includes(type)) {
    return pool.filter((m) => !LOCAL_STAT_SCALE_MOD_IDS.includes(m.id));
  }
  return pool;
}

export function rollLocalStatScaleValue() {
  return 0.2 + Math.random() * 0.8;
}

/** Modifier value ranges by difficulty for dropped items (normal modifiers: 5-15% to 25-50%; local stat scale: 2). */
export const MODIFIER_ROLL_BY_DIFFICULTY = {
  1: { min: 0.05, max: 0.15 },
  2: { min: 0.10, max: 0.25 },
  3: { min: 0.15, max: 0.35 },
  4: { min: 0.20, max: 0.40 },
  5: { min: 0.25, max: 0.50 }
};

export const COOLDOWN_REDUCTION_ROLL_BY_DIFFICULTY = {
  1: { min: 0.02, max: 0.05 },
  2: { min: 0.03, max: 0.07 },
  3: { min: 0.05, max: 0.09 },
  4: { min: 0.06, max: 0.11 },
  5: { min: 0.07, max: 0.15 }
};

export const ATTACK_SPEED_ROLL_BY_DIFFICULTY = {
  1: { min: 0.06, max: 0.10 },
  2: { min: 0.08, max: 0.12 },
  3: { min: 0.10, max: 0.12 },
  4: { min: 0.12, max: 0.14 },
  5: { min: 0.10, max: 0.16 }
};

export const MELEE_ATTACK_SPEED_ROLL_BY_DIFFICULTY = {
  1: { min: 0.08, max: 0.12 },
  2: { min: 0.10, max: 0.14 },
  3: { min: 0.12, max: 0.16 },
  4: { min: 0.10, max: 0.18 },
  5: { min: 0.12, max: 0.20 }
};

export const ATTACK_DAMAGE_ROLL_BY_DIFFICULTY = {
  1: { min: 0.10, max: 0.16 },
  2: { min: 0.14, max: 0.20 },
  3: { min: 0.20, max: 0.28 },
  4: { min: 0.26, max: 0.32 },
  5: { min: 0.32, max: 0.42 }
};

export const XP_GAINED_ROLL_BY_DIFFICULTY = {
  1: { min: 0.10, max: 0.15 },
  2: { min: 0.14, max: 0.18 },
  3: { min: 0.16, max: 0.22 },
  4: { min: 0.18, max: 0.24 },
  5: { min: 0.20, max: 0.30 }
};

export const MAX_HEALTH_ROLL_BY_DIFFICULTY = {
  1: { min: 0.10, max: 0.15 },
  2: { min: 0.13, max: 0.18 },
  3: { min: 0.16, max: 0.21 },
  4: { min: 0.19, max: 0.24 },
  5: { min: 0.19, max: 0.30 }
};

export const LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY = {
  1: { min: 0.10, max: 0.30 },
  2: { min: 0.20, max: 0.50 },
  3: { min: 0.30, max: 0.70 },
  4: { min: 0.40, max: 0.80 },
  5: { min: 0.50, max: 1.0 }
};

const MODIFIER_ROLL_RANGE_BY_ID = {
  projectileSpeedPct: {
    1: { min: 0.20, max: 0.30 },
    2: { min: 0.20, max: 0.30 },
    3: { min: 0.20, max: 0.30 },
    4: { min: 0.20, max: 0.30 },
    5: { min: 0.20, max: 0.30 }
  },
  areaOfEffectPct: {
    1: { min: 0.10, max: 0.15 },
    2: { min: 0.10, max: 0.15 },
    3: { min: 0.10, max: 0.15 },
    4: { min: 0.10, max: 0.15 },
    5: { min: 0.10, max: 0.15 }
  },
  projectilePierce: {
    1: { min: 1, max: 2 },
    2: { min: 1, max: 2 },
    3: { min: 1, max: 2 },
    4: { min: 1, max: 2 },
    5: { min: 1, max: 2 }
  },
  fullHpMoveSpeed: {
    1: { min: 0.20, max: 0.30 },
    2: { min: 0.20, max: 0.30 },
    3: { min: 0.20, max: 0.30 },
    4: { min: 0.20, max: 0.30 },
    5: { min: 0.20, max: 0.30 }
  },
  dashDistancePct: {
    1: { min: 0.20, max: 0.40 },
    2: { min: 0.20, max: 0.40 },
    3: { min: 0.20, max: 0.40 },
    4: { min: 0.20, max: 0.40 },
    5: { min: 0.20, max: 0.40 }
  },
  movementSkillCooldownPct: {
    1: { min: 0.10, max: 0.20 },
    2: { min: 0.10, max: 0.20 },
    3: { min: 0.10, max: 0.20 },
    4: { min: 0.10, max: 0.20 },
    5: { min: 0.10, max: 0.20 }
  },
  enterMapGoldFlat: {
    1: { min: 120, max: 180 },
    2: { min: 150, max: 210 },
    3: { min: 180, max: 240 },
    4: { min: 210, max: 280 },
    5: { min: 250, max: 320 }
  },
  minibossGoldFlat: {
    1: { min: 30, max: 45 },
    2: { min: 40, max: 60 },
    3: { min: 50, max: 72 },
    4: { min: 60, max: 84 },
    5: { min: 70, max: 95 }
  },
  xpRequirementReduction: {
    1: { min: 0.10, max: 0.15 },
    2: { min: 0.10, max: 0.15 },
    3: { min: 0.10, max: 0.15 },
    4: { min: 0.10, max: 0.15 },
    5: { min: 0.10, max: 0.15 }
  },
  levelUpAttackSpeedStack: {
    1: { min: 0.008, max: 0.014 },
    2: { min: 0.010, max: 0.016 },
    3: { min: 0.012, max: 0.018 },
    4: { min: 0.014, max: 0.020 },
    5: { min: 0.016, max: 0.022 }
  },
  levelUpMaxHealthFlat: {
    1: { min: 2, max: 4 },
    2: { min: 3, max: 5 },
    3: { min: 4, max: 6 },
    4: { min: 5, max: 7 },
    5: { min: 6, max: 8 }
  },
  levelUpAttackDamageStack: {
    1: { min: 0.015, max: 0.024 },
    2: { min: 0.018, max: 0.027 },
    3: { min: 0.021, max: 0.030 },
    4: { min: 0.024, max: 0.033 },
    5: { min: 0.027, max: 0.036 }
  },
  burningEnemyAttackSpeed: {
    1: { min: 0.10, max: 0.30 },
    2: { min: 0.10, max: 0.30 },
    3: { min: 0.10, max: 0.30 },
    4: { min: 0.10, max: 0.30 },
    5: { min: 0.10, max: 0.30 }
  },
  orbitalArrows: {
    1: { min: 3, max: 6 },
    2: { min: 3, max: 6 },
    3: { min: 3, max: 6 },
    4: { min: 3, max: 6 },
    5: { min: 3, max: 6 }
  },
  mapEntryGoldPercent: {
    1: { min: 0.20, max: 0.30 },
    2: { min: 0.20, max: 0.30 },
    3: { min: 0.20, max: 0.30 },
    4: { min: 0.20, max: 0.30 },
    5: { min: 0.20, max: 0.30 }
  },
  levelUpBonusAttributeChance: {
    1: { min: 0.10, max: 0.20 },
    2: { min: 0.10, max: 0.20 },
    3: { min: 0.10, max: 0.20 },
    4: { min: 0.10, max: 0.20 },
    5: { min: 0.10, max: 0.20 }
  },
  restoreHpOnNewMapFlat: {
    1: { min: 10, max: 20 },
    2: { min: 10, max: 20 },
    3: { min: 10, max: 20 },
    4: { min: 10, max: 20 },
    5: { min: 10, max: 20 }
  },
  healOnKillChance: {
    1: { min: 0.10, max: 0.18 },
    2: { min: 0.10, max: 0.18 },
    3: { min: 0.10, max: 0.18 },
    4: { min: 0.10, max: 0.18 },
    5: { min: 0.10, max: 0.18 }
  },
  restoreHpOnLevelUpFlat: {
    1: { min: 4, max: 8 },
    2: { min: 4, max: 8 },
    3: { min: 4, max: 8 },
    4: { min: 4, max: 8 },
    5: { min: 4, max: 8 }
  },
  chanceToBleedOnHit: {
    1: { min: 0.06, max: 0.10 },
    2: { min: 0.08, max: 0.12 },
    3: { min: 0.10, max: 0.14 },
    4: { min: 0.12, max: 0.16 },
    5: { min: 0.14, max: 0.18 }
  },
  chanceToBurnOnHit: {
    1: { min: 0.05, max: 0.09 },
    2: { min: 0.07, max: 0.11 },
    3: { min: 0.09, max: 0.13 },
    4: { min: 0.11, max: 0.15 },
    5: { min: 0.13, max: 0.17 }
  },
  chanceToSlowOnHit: {
    1: { min: 0.08, max: 0.12 },
    2: { min: 0.10, max: 0.14 },
    3: { min: 0.12, max: 0.16 },
    4: { min: 0.14, max: 0.18 },
    5: { min: 0.16, max: 0.20 }
  },
  repeatBasicAttackChance: {
    1: { min: 0.10, max: 0.20 },
    2: { min: 0.10, max: 0.20 },
    3: { min: 0.10, max: 0.20 },
    4: { min: 0.10, max: 0.20 },
    5: { min: 0.10, max: 0.20 }
  },
  goldPickupDamageBuff: {
    1: { min: 0.20, max: 0.30 },
    2: { min: 0.20, max: 0.30 },
    3: { min: 0.20, max: 0.30 },
    4: { min: 0.20, max: 0.30 },
    5: { min: 0.20, max: 0.30 }
  },
  critLifesteal: {
    1: { min: 0.08, max: 0.12 },
    2: { min: 0.08, max: 0.12 },
    3: { min: 0.08, max: 0.12 },
    4: { min: 0.08, max: 0.12 },
    5: { min: 0.08, max: 0.12 }
  },
  newMapGoldXpBuff: {
    1: { min: 0.10, max: 0.20 },
    2: { min: 0.10, max: 0.20 },
    3: { min: 0.10, max: 0.20 },
    4: { min: 0.10, max: 0.20 },
    5: { min: 0.10, max: 0.20 }
  },
  chestBonusXpFlat: {
    1: { min: 4, max: 8 },
    2: { min: 4, max: 8 },
    3: { min: 4, max: 8 },
    4: { min: 4, max: 8 },
    5: { min: 4, max: 8 }
  },
  sprintSpeedBonus: {
    1: { min: 0.04, max: 0.07 },
    2: { min: 0.05, max: 0.08 },
    3: { min: 0.06, max: 0.10 },
    4: { min: 0.07, max: 0.11 },
    5: { min: 0.08, max: 0.12 }
  },
  critChance: {
    1: { min: 0.03, max: 0.05 },
    2: { min: 0.04, max: 0.06 },
    3: { min: 0.05, max: 0.07 },
    4: { min: 0.06, max: 0.08 },
    5: { min: 0.07, max: 0.10 }
  },
  critDamageBonus: {
    1: { min: 0.10, max: 0.16 },
    2: { min: 0.12, max: 0.18 },
    3: { min: 0.14, max: 0.22 },
    4: { min: 0.16, max: 0.26 },
    5: { min: 0.18, max: 0.30 }
  },
  chestOpenSpeedPercent: {
    1: { min: 0.08, max: 0.14 },
    2: { min: 0.10, max: 0.16 },
    3: { min: 0.12, max: 0.18 },
    4: { min: 0.14, max: 0.20 },
    5: { min: 0.16, max: 0.24 }
  },
  damageToElites: {
    1: { min: 0.08, max: 0.14 },
    2: { min: 0.10, max: 0.16 },
    3: { min: 0.12, max: 0.20 },
    4: { min: 0.14, max: 0.22 },
    5: { min: 0.16, max: 0.25 }
  },
  damageToSlowed: {
    1: { min: 0.08, max: 0.14 },
    2: { min: 0.10, max: 0.16 },
    3: { min: 0.12, max: 0.20 },
    4: { min: 0.14, max: 0.22 },
    5: { min: 0.16, max: 0.25 }
  },
  critChanceFromMoveSpeed: {
    1: { min: 0.006, max: 0.010 },
    2: { min: 0.007, max: 0.012 },
    3: { min: 0.008, max: 0.014 },
    4: { min: 0.010, max: 0.016 },
    5: { min: 0.012, max: 0.018 }
  },
  healingReceivedPercent: {
    1: { min: 0.08, max: 0.12 },
    2: { min: 0.10, max: 0.14 },
    3: { min: 0.12, max: 0.16 },
    4: { min: 0.14, max: 0.18 },
    5: { min: 0.16, max: 0.22 }
  },
  newMapMoveSpeedBuff: {
    1: { min: 0.50, max: 1.00 },
    2: { min: 0.50, max: 1.00 },
    3: { min: 0.50, max: 1.00 },
    4: { min: 0.50, max: 1.00 },
    5: { min: 0.50, max: 1.00 }
  },
  miniBossKillMoveSpeedBuff: {
    1: { min: 0.50, max: 0.80 },
    2: { min: 0.50, max: 0.80 },
    3: { min: 0.50, max: 0.80 },
    4: { min: 0.50, max: 0.80 },
    5: { min: 0.50, max: 0.80 }
  },
  dashMoveSpeedBuff: {
    1: { min: 0.20, max: 0.30 },
    2: { min: 0.20, max: 0.30 },
    3: { min: 0.20, max: 0.30 },
    4: { min: 0.20, max: 0.30 },
    5: { min: 0.20, max: 0.30 }
  }
};

export function getModifierRollRangeForDifficulty(difficulty, modifierId = null) {
  if (modifierId && MODIFIER_ROLL_RANGE_BY_ID[modifierId]) {
    return MODIFIER_ROLL_RANGE_BY_ID[modifierId][difficulty] || MODIFIER_ROLL_RANGE_BY_ID[modifierId][1];
  }
  if (modifierId === "cooldownReductionPercent") {
    return COOLDOWN_REDUCTION_ROLL_BY_DIFFICULTY[difficulty] || COOLDOWN_REDUCTION_ROLL_BY_DIFFICULTY[1];
  }
  if (modifierId === "attackPercent" || modifierId === "attackDamagePct") {
    return ATTACK_DAMAGE_ROLL_BY_DIFFICULTY[difficulty] || ATTACK_DAMAGE_ROLL_BY_DIFFICULTY[1];
  }
  if (modifierId === "xpGainedPercent") {
    return XP_GAINED_ROLL_BY_DIFFICULTY[difficulty] || XP_GAINED_ROLL_BY_DIFFICULTY[1];
  }
  if (modifierId === "maxHealthPercent") {
    return MAX_HEALTH_ROLL_BY_DIFFICULTY[difficulty] || MAX_HEALTH_ROLL_BY_DIFFICULTY[1];
  }
  if (modifierId === "meleeAttackSpeedPct") {
    return MELEE_ATTACK_SPEED_ROLL_BY_DIFFICULTY[difficulty] || MELEE_ATTACK_SPEED_ROLL_BY_DIFFICULTY[1];
  }
  if (modifierId === "attackSpeedPercent" || modifierId === "attackSpeedPct") {
    return ATTACK_SPEED_ROLL_BY_DIFFICULTY[difficulty] || ATTACK_SPEED_ROLL_BY_DIFFICULTY[1];
  }
  return MODIFIER_ROLL_BY_DIFFICULTY[difficulty];
}

export function rollModifierValueForDifficulty(difficulty, modifierId = null) {
  const r = getModifierRollRangeForDifficulty(difficulty, modifierId);
  if (!r) return rollModifierValue();
  return r.min + Math.random() * (r.max - r.min);
}

function rollValueFromRangeSpec(spec) {
  if (Number.isFinite(spec)) return Number(spec);
  if (!spec || typeof spec !== "object") return null;
  const min = Number(spec.min);
  const max = Number(spec.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function resolveStatModsSpecForDifficulty(definitionLike, difficulty = 3) {
  const d = Math.min(5, Math.max(1, Math.floor(Number(difficulty) || 3)));
  if (definitionLike?.statModsByDifficulty && typeof definitionLike.statModsByDifficulty === "object") {
    return definitionLike.statModsByDifficulty[d] || definitionLike.statModsByDifficulty[3] || definitionLike.statModsByDifficulty[1] || null;
  }
  return definitionLike?.statMods || null;
}

export function resolveModifierStatMods(definitionLike, difficulty = 3) {
  const statMods = resolveStatModsSpecForDifficulty(definitionLike, difficulty);
  if (!statMods || typeof statMods !== "object") return undefined;
  const out = {};
  for (const [key, spec] of Object.entries(statMods)) {
    const rolled = rollValueFromRangeSpec(spec);
    if (rolled == null || !Number.isFinite(rolled)) continue;
    out[key] = rolled;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function rollLocalStatScaleValueForDifficulty(difficulty) {
  const r = LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY[difficulty];
  if (!r) return rollLocalStatScaleValue();
  return r.min + Math.random() * (r.max - r.min);
}

export const NAME_PREFIXES = ["Twisted", "Cursed", "Blessed", "Ancient", "Rotten", "Void", "Storm", "Frost", "Flame", "Shadow"];
export const NAME_SUFFIXES = ["of the Fox", "of the Bear", "of Power", "of Swiftness", "of the Titan", "of the Wolf", "of the Owl", "of the Serpent"];

export const RARITY_COLORS = { common: "#e2e8f0", magic: "#60a5fa", rare: "#facc15", legendary: "#f97316" };

export const LOOT_DEFS = [
  { type: "Helmet", items: [] },
  { type: "Boots", items: [] },
  { type: "Body Armour", items: [] },
  { type: "Weapon", items: [] },
  { type: "Ring", items: [] },
];

export const LOOT_COLORS = {
  Helmet: "#38bdf8",
  Boots: "#f97316",
  "Body Armour": "#a855f7",
  Weapon: "#facc15",
  Ring: "#f59e0b",
  "Ancestor Spirit": "#14b8a6",
  Cube: "#a78bfa",
  Gold: "#fbbf24"
};

export const LOOT_ICONS = {
  Helmet: "",
  Boots: "",
  "Body Armour": "",
  Weapon: "",
  Ring: "",
  Cube: "",
  Gold: ""
};

const ITEMS_COL_TO_INDEX = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7, i: 8, j: 9, k: 10 };

function itemCell(row1Based, colLetter) {
  return { row: row1Based - 1, col: ITEMS_COL_TO_INDEX[colLetter] ?? 0 };
}

const EQUIPMENT_SPRITE_CELL_BY_NAME = {
  Helmet: {
    "Leather Cap": itemCell(16, "b"),
    "Cloth Hood": itemCell(16, "a"),
    "Hide Cap": itemCell(16, "c"),
    "Iron Helmet": itemCell(16, "e"),
    "Steel Helmet": itemCell(16, "f"),
    "Battle Helm": itemCell(16, "g"),
    "Knight's Helm": itemCell(16, "h"),
    "Dragon Helm": itemCell(16, "h")
  },
  Boots: {
    "Leather Boots": itemCell(15, "b"),
    "Iron Greaves": itemCell(15, "d"),
    "Steel Greaves": itemCell(15, "d"),
    "Wind Boots": itemCell(15, "c"),
    "Swift Boots": itemCell(15, "c"),
    "Shadow Striders": itemCell(15, "a")
  },
  "Body Armour": {
    "Leather Armour": itemCell(13, "b"),
    "Hide Armour": itemCell(13, "a"),
    "Chainmail Vest": itemCell(13, "d"),
    "Scale Armour": itemCell(13, "e"),
    "Plate Armour": itemCell(13, "f"),
    "Battle Plate": itemCell(13, "f"),
    "Fortress Armour": itemCell(13, "f")
  },
  Weapon: {
    "Wooden Staff": itemCell(11, "c"),
    "Iron Sword": itemCell(1, "c"),
    "Steel Sword": itemCell(1, "d"),
    "Battle Axe": itemCell(4, "b"),
    "War Hammer": itemCell(5, "d"),
    "Legendary Blade": itemCell(1, "k")
  },
  Ring: {
    "Gold Band Ring": itemCell(18, "b"),
    "Ruby Ring": itemCell(18, "d"),
    "Sapphire Ring": itemCell(18, "e"),
    "Onyx Ring": itemCell(18, "f"),
    "Gold Signet Ring": itemCell(19, "a"),
    "Jade Ring": itemCell(19, "c")
  }
};

const EQUIPMENT_SPRITE_FALLBACK_BY_TYPE = {
  Helmet: itemCell(16, "e"),
  Boots: itemCell(15, "b"),
  "Body Armour": itemCell(13, "d"),
  Weapon: itemCell(1, "d"),
  Ring: itemCell(18, "b")
};

export function getEquipmentSpriteCell(type, name, weight = null) {
  if (type === "Body Armour") {
    if (weight === "light") return itemCell(13, "a");
    if (weight === "medium") return itemCell(13, "b");
    if (weight === "heavy") return itemCell(13, "f");
  }
  if (type === "Helmet") {
    if (weight === "light") return itemCell(16, "c");
    if (weight === "medium") return itemCell(16, "e");
    if (weight === "heavy") return itemCell(16, "g");
  }
  if (type === "Weapon") {
    if (weight === "light") return itemCell(1, "h");
    if (weight === "medium") return itemCell(1, "k");
    if (weight === "heavy") return itemCell(1, "i");
  }
  const byName = EQUIPMENT_SPRITE_CELL_BY_NAME[type];
  if (byName && byName[name]) return byName[name];
  return EQUIPMENT_SPRITE_FALLBACK_BY_TYPE[type] || null;
}

// Mutable global luck value
export let GLOBAL_LUCK = 0;
export function setGlobalLuck(val) { GLOBAL_LUCK = val; }
export const LUCK_BIAS_PER_POINT = 0.02;

export function rollModifierValue() {
  return 0.1 + Math.random() * 0.4;
}

export function getRarityRoll(lootQuality, qualityBonus, luck = 0) {
  const roll = Math.random();
  const perCallLuckBias = Math.max(0, Number(luck) || 0) * LUCK_BIAS_PER_POINT;
  const bias = Math.min(1, lootQuality + GLOBAL_LUCK + qualityBonus + perCallLuckBias);
  if (roll < 0.02 + bias * 0.08) return "rare";
  if (roll < 0.15 + bias * 0.25) return "magic";
  return "common";
}

export function generateEquipmentItem(type, lootQuality, qualityBonus = 0, forceRarity = null, options = {}) {
  const rarity = forceRarity || getRarityRoll(lootQuality, qualityBonus, options.luck);
  if (type === "Ring") {
    const rollRange = (min, max) => min + Math.random() * (max - min);
    const pickRarity = String(rarity || "common");
    const pool = getRingDefsByItemRarity(pickRarity);
    const fallbackPool = pool.length > 0 ? pool : getRingDefsByItemRarity("common");
    const ringDef = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    const ringId = ringDef?.ringId || null;
    const modifiers = [];
    const stats = {};

    if (ringDef?.forgeLikeWeapon) {
      const weaponPool = getModifierPoolForType("Weapon");
      const localPool = [...weaponPool];
      const ringDifficulty = Math.min(5, Math.max(1, Number(options.difficulty ?? 5)));
      for (let i = 0; i < 4 && localPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * localPool.length);
        const m = localPool.splice(idx, 1)[0];
        const value = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id)
          ? rollLocalStatScaleValueForDifficulty(ringDifficulty)
          : rollModifierValueForDifficulty(ringDifficulty, m.id);
        modifiers.push({
          id: m.id,
          label: m.label,
          statKey: m.statKey,
          rarity: m.rarity || MODIFIER_RARITY.NORMAL,
          value,
          appliesTo: m.appliesTo,
          trigger: m.trigger,
          conditional: m.conditional,
          passiveStatKey: m.passiveStatKey,
          statMods: resolveModifierStatMods(m, ringDifficulty),
          data: m.data ? { ...m.data } : undefined,
          addedAt: Date.now()
        });
      }
    } else if (ringDef?.gamblerRolls) {
      const dmg = rollRange(0, 0.5);
      const hpLoss = rollRange(0.2, 0.5);
      modifiers.push(
        {
          id: "ring_gambler_damage",
          label: "Gambler Damage",
          statKey: "attack",
          value: dmg,
          isRingEffect: true,
          addedAt: Date.now()
        },
        {
          id: "ring_gambler_health_penalty",
          label: "Gambler Health Penalty",
          statKey: "maxHealth",
          value: -hpLoss,
          isRingEffect: true,
          addedAt: Date.now()
        }
      );
    }

    for (const m of modifiers) {
      if (m.statKey === "attackSpeed") {
        stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
      } else if (m.statKey === "cooldownRecovery") {
        stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
    } else if (!m.statKey) {
      continue;
      } else {
        const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
        stats[key] = (stats[key] || 0) + m.value;
      }
    }

    return {
      type: "Ring",
      name: ringDef?.name || "Ring",
      ringId,
      ringSpriteKey: ringDef?.sprite || "gold_band_ring",
      description: ringDef?.description || "",
      consumedOnTrigger: !!ringDef?.consumedOnTrigger,
      rarity: RING_RARITY_TO_ITEM[ringDef?.rarity] || "common",
      baseStat: {},
      weight: null,
      modifiers,
      rolledModifiers: modifiers,
      stats,
      sockets: options.forceSockets != null ? Number(options.forceSockets) : 0,
      vesselsMax: 0,
      vessels: [],
      spriteCell: getRingSpriteCell(ringDef?.sprite || "gold_band_ring")
    };
  }

  const baseKey = EQUIPMENT_BASE_STAT[type];
  const range = EQUIPMENT_BASE_RANGES[type];
  const scale = 0.4 + 0.6 * (0.5 + lootQuality / 2);
  const baseStat = {};
  if (baseKey && range) {
    const baseValue = Math.round(range.min + (range.max - range.min) * scale);
    baseStat[baseKey] = baseValue;
  }
  const sec = EQUIPMENT_SECONDARY_BASE[type];
  if (sec) {
    const secValue = Math.round(sec.range.min + (sec.range.max - sec.range.min) * scale);
    baseStat[sec.statKey] = secValue;
  }

  let weight = null;
  if (WEIGHT_OPTIONS[type]) {
    const opts = WEIGHT_OPTIONS[type];
    const forcedWeight = typeof options.weight === "string" ? options.weight.toLowerCase() : null;
    weight = opts.includes(forcedWeight) ? forcedWeight : opts[Math.floor(Math.random() * opts.length)];
  }

  const forceMinBaseStats = options.forceMinBaseStats === true;
  if (forceMinBaseStats) {
    if (baseKey && range) baseStat[baseKey] = range.min;
    if (sec) baseStat[sec.statKey] = sec.range.min;
    if (WEIGHT_OPTIONS[type]?.includes("medium")) weight = "medium";
  } else {
    // Apply armour/helmet weight-based stat multipliers.
    // Boots use a dedicated weight model below.
    const WEIGHT_STAT_MULTIPLIERS = { light: 0.85, medium: 1.0, heavy: 1.2 };
    if (ARMOUR_SLOT_TYPES.includes(type) && weight && WEIGHT_STAT_MULTIPLIERS[weight]) {
      const multiplier = WEIGHT_STAT_MULTIPLIERS[weight];
      for (const key of Object.keys(baseStat)) {
        baseStat[key] = Math.round(baseStat[key] * multiplier);
      }
    }

    // Boots weight model:
    // - light: base speed rolls at 120%
    // - medium: base speed rolls at 100%, +10-30 max health base
    // - heavy: base speed rolls at 80%, +20-40 max health base, +5-10 defense base
    if (type === "Boots" && weight) {
      if (weight === "light") {
        baseStat.speed = Math.round((baseStat.speed || 0) * 1.2);
      } else if (weight === "medium") {
        baseStat.speed = Math.round((baseStat.speed || 0) * 1.0);
        baseStat.maxHealth = 10 + Math.floor(Math.random() * 21);
      } else if (weight === "heavy") {
        baseStat.speed = Math.round((baseStat.speed || 0) * 0.8);
        baseStat.maxHealth = 20 + Math.floor(Math.random() * 21);
        baseStat.defense = 5 + Math.floor(Math.random() * 6);
      }
    }

    // Weapon weight model:
    // - light: base attack at 80%, +10-20% attack speed base
    // - medium: base attack at 100%, +5-10% attack speed base
    // - heavy: base attack at 140%, -20-30% attack speed base
    //
    // If a base attack-speed bonus already exists, apply weight multiplicatively
    // to that bonus component (delta from 1.0), not additively:
    // e.g. +10% with heavy -30% => +7% (1 + 0.10 * 0.70).
    if (type === "Weapon" && weight) {
      const WEAPON_ATTACK_MULT = { light: 0.8, medium: 1.0, heavy: 1.4 };
      baseStat.attack = Math.round((baseStat.attack || 0) * (WEAPON_ATTACK_MULT[weight] || 1.0));
      const existingAttackSpeedMult = Number(baseStat.attackSpeed);
      if (weight === "light") {
        const lightFactor = 1 + (0.10 + Math.random() * 0.10);
        if (Number.isFinite(existingAttackSpeedMult) && existingAttackSpeedMult > 0) {
          const existingBonus = existingAttackSpeedMult - 1;
          baseStat.attackSpeed = 1 + (existingBonus * lightFactor);
        } else {
          baseStat.attackSpeed = lightFactor;
        }
      } else if (weight === "medium") {
        const mediumFactor = 1 + (0.05 + Math.random() * 0.05);
        if (Number.isFinite(existingAttackSpeedMult) && existingAttackSpeedMult > 0) {
          const existingBonus = existingAttackSpeedMult - 1;
          baseStat.attackSpeed = 1 + (existingBonus * mediumFactor);
        } else {
          baseStat.attackSpeed = mediumFactor;
        }
      } else if (weight === "heavy") {
        const heavyFactor = 1 - (0.20 + Math.random() * 0.10);
        if (Number.isFinite(existingAttackSpeedMult) && existingAttackSpeedMult > 0) {
          const existingBonus = existingAttackSpeedMult - 1;
          baseStat.attackSpeed = 1 + (existingBonus * heavyFactor);
        } else {
          baseStat.attackSpeed = heavyFactor;
        }
      }
    }
  }

  const difficulty = options.difficulty != null ? options.difficulty : null;
  const rollNormal = difficulty != null
    ? (modifierId = null) => rollModifierValueForDifficulty(difficulty, modifierId)
    : rollModifierValue;
  const rollLocal = difficulty != null ? () => rollLocalStatScaleValueForDifficulty(difficulty) : rollLocalStatScaleValue;

  const modifiers = [];
  if (type === "Ring") {
    const pool = getModifierPoolForType(type);
    const countByRarity = { common: 1, magic: 2, rare: 3, legendary: 4 };
    const effectCount = Math.max(1, Math.min(pool.length, countByRarity[rarity] || 1));
    for (let i = 0; i < effectCount; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = (m.min ?? 0.1) + Math.random() * ((m.max ?? 0.2) - (m.min ?? 0.1));
      modifiers.push({
        id: m.id,
        label: m.label,
        statKey: m.statKey,
          rarity: m.rarity || MODIFIER_RARITY.NORMAL,
        value: val,
        appliesTo: m.appliesTo,
        trigger: m.trigger,
        conditional: m.conditional,
        passiveStatKey: m.passiveStatKey,
        statMods: resolveModifierStatMods(m, 3),
        data: m.data ? { ...m.data } : undefined,
        isRingEffect: true,
        addedAt: Date.now()
      });
    }
  } else {
    // Item rarity (NORMAL/MAGIC/RARE) now maps directly to modifier count (0/1/2).
    let modifierCount = 0;
    switch (rarity) {
      case "normal":
      case "common":
        modifierCount = 0;
        break;
      case "magic":
        modifierCount = 1;
        break;
      case "rare":
        modifierCount = 2;
        break;
      default:
        modifierCount = 0;
        break;
    }

    if (modifierCount > 0) {
      const pool = getModifierPoolForType(type);
      const chosen = rollUniqueModifierDefsByRarity(pool, modifierCount, new Set());
      for (const m of chosen) {
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocal() : rollNormal(m.id);
        modifiers.push({
          id: m.id,
          label: m.label,
          statKey: m.statKey,
          rarity: m.rarity || MODIFIER_RARITY.NORMAL,
          value: val,
          appliesTo: m.appliesTo,
          trigger: m.trigger,
          conditional: m.conditional,
          passiveStatKey: m.passiveStatKey,
          statMods: resolveModifierStatMods(m, difficulty != null ? difficulty : 3),
          data: m.data ? { ...m.data } : undefined,
          addedAt: Date.now()
        });
      }

      // Special generator tweak: Magic items can be biased to a higher roll once ("qualityEye").
      if (options.qualityEye && rarity === "magic" && modifiers.length > 0) {
        const idx = Math.floor(Math.random() * modifiers.length);
        const mod = modifiers[idx];
        if (mod.value < 0.3 && !LOCAL_STAT_SCALE_MOD_IDS.includes(mod.id)) {
          mod.value = 0.3 + Math.random() * 0.1;
          if (difficulty != null) {
            const r = getModifierRollRangeForDifficulty(difficulty, mod.id);
            if (r) mod.value = Math.min(mod.value, r.max);
          }
        }
      }
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
    } else if (!m.statKey) {
      if (m.statMods && typeof m.statMods === "object") {
        for (const [statKey, statValueRaw] of Object.entries(m.statMods)) {
          const statValue = Number(statValueRaw);
          if (!Number.isFinite(statValue)) continue;
          if (statKey === "attackSpeedPercent") {
            stats.attackSpeed = (stats.attackSpeed || 1) * (1 + statValue);
            continue;
          }
          if (statKey === "cooldownReductionPercent") {
            stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - statValue);
            continue;
          }
          if (statKey === "dashChargesFlat" || statKey === "maxHealthFlat") {
            const dst = statKey === "dashChargesFlat" ? "dashChargesFlat" : "maxHealth";
            stats[dst] = (stats[dst] || 0) + statValue;
            continue;
          }
          stats[statKey] = (stats[statKey] || 0) + statValue;
        }
      }
      continue;
    } else {
      const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
      stats[key] = (stats[key] || 0) + m.value;
    }
  }

  const result = {
    type,
    name,
    spriteCell: getEquipmentSpriteCell(type, name, weight),
    rarity,
    baseStat,
    weight,
    modifiers,
    stats,
    sockets: sockets,
    vesselsMax: 0,
    vessels: []
  };
  if (type === "Weapon" || type === "Helmet" || type === "Body Armour" || type === "Boots") {
    result.weaponUpgradeLevel = 0;
  }
  return result;
}
