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

export const MODIFIER_POOL = [
  { id: "attackPercent", label: "Attack Damage", statKey: "attack" },
  { id: "attackSpeedPercent", label: "Attack Speed", statKey: "attackSpeed" },
  { id: "maxHealthPercent", label: "Max Health", statKey: "maxHealth" },
  { id: "defensePercent", label: "Defense", statKey: "defense" },
  { id: "speedPercent", label: "Movement Speed", statKey: "speed" },
  { id: "xpGainedPercent", label: "XP Gained", statKey: "xpGained" },
  { id: "skillDamagePercent", label: "Skill Damage", statKey: "skillDamage" },
  { id: "cooldownReductionPercent", label: "Cooldown Reduction", statKey: "cooldownRecovery" },
  { id: "projectileDamagePct", label: "Projectile Damage", statKey: "skillDamage", appliesTo: { tagsAny: ["projectile"] } },
  { id: "meleeDamagePct", label: "Melee Damage", statKey: "skillDamage", appliesTo: { tagsAny: ["melee"] } },
  { id: "areaDamagePct", label: "Area Damage", statKey: "skillDamage", appliesTo: { tagsAny: ["area"] } },
  { id: "crowdControlPowerPct", label: "Crowd Control Power", statKey: "effectPower", appliesTo: { tagsAny: ["crowd_control"] } },
  { id: "curseEffectPct", label: "Curse Effect", statKey: "effectPower", appliesTo: { tagsAny: ["curse"] } },
  { id: "defensePowerPct", label: "Defense Power", statKey: "effectPower", appliesTo: { tagsAny: ["defense"] } },
  { id: "attackDamagePct", label: "Attack Damage", statKey: "skillDamage" },
  { id: "attackSpeedPct", label: "Attack Speed", statKey: "attackSpeed" },
  { id: "meleeAttackSpeedPct", label: "Melee Attack Speed", statKey: "attackSpeed", appliesTo: { tagsAny: ["melee"] } },
  { id: "meleeFlatDamage", label: "Melee Flat Damage", statKey: "flatDamage", appliesTo: { tagsAny: ["melee"] } },
  { id: "defenseStatScale", label: "+x% to the defense on this item", statKey: "defense", localStatScale: true },
  { id: "maxHealthStatScale", label: "+x% to the max health on this item", statKey: "maxHealth", localStatScale: true }
];

export const ARMOUR_SLOT_TYPES = ["Helmet", "Body Armour"];
export const LOCAL_STAT_SCALE_MOD_IDS = ["defenseStatScale", "maxHealthStatScale"];

export function getModifierPoolForType(type) {
  if (type === "Ring") return [];
  const pool = [...MODIFIER_POOL];
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

export function getModifierRollRangeForDifficulty(difficulty, modifierId = null) {
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

export function rollModifierValue() {
  return 0.1 + Math.random() * 0.4;
}

export function getRarityRoll(lootQuality, qualityBonus) {
  const roll = Math.random();
  const bias = Math.min(1, lootQuality + GLOBAL_LUCK + qualityBonus);
  if (roll < 0.02 + bias * 0.08) return "rare";
  if (roll < 0.15 + bias * 0.25) return "magic";
  return "common";
}

export function generateEquipmentItem(type, lootQuality, qualityBonus = 0, forceRarity = null, options = {}) {
  const rarity = forceRarity || getRarityRoll(lootQuality, qualityBonus);
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
          value,
          appliesTo: m.appliesTo,
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
    if (type === "Weapon" && weight) {
      const WEAPON_ATTACK_MULT = { light: 0.8, medium: 1.0, heavy: 1.4 };
      baseStat.attack = Math.round((baseStat.attack || 0) * (WEAPON_ATTACK_MULT[weight] || 1.0));
      if (weight === "light") {
        baseStat.attackSpeed = 1 + (0.10 + Math.random() * 0.10);
      } else if (weight === "medium") {
        baseStat.attackSpeed = 1 + (0.05 + Math.random() * 0.05);
      } else if (weight === "heavy") {
        baseStat.attackSpeed = 1 - (0.20 + Math.random() * 0.10);
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
        value: val,
        appliesTo: m.appliesTo,
        isRingEffect: true,
        addedAt: Date.now()
      });
    }
  } else if (rarity === "magic") {
    const pool = getModifierPoolForType(type);
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocal() : rollNormal(m.id);
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, appliesTo: m.appliesTo, addedAt: Date.now() });
    }
    if (options.qualityEye && modifiers.length > 0) {
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
  } else if (rarity === "rare") {
    const pool = getModifierPoolForType(type);
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const m = pool.splice(idx, 1)[0];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocal() : rollNormal(m.id);
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, appliesTo: m.appliesTo, addedAt: Date.now() });
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
