import { MODIFIER_POOL, getModifierRollRangeForDifficulty } from './loot-data.js';

export const LEGENDARY_CUBES = [
  { id: "eternalCube", label: "Eternal Cube", modifierId: "eternal", modifierLabel: "Eternal" },
  { id: "generativeCube", label: "Generative Cube", modifierId: "generative", modifierLabel: "Generative" },
  { id: "blessedCube", label: "Blessed Cube", modifierId: "blessed", modifierLabel: "Blessed" }
];

export const LEGENDARY_MODIFIER_IDS = ["eternal", "generative", "blessed", "foresight"];
export const LEGENDARY_MODIFIER_EFFECTS = {
  eternal: "Returns to Legacy Vault on defeat.",
  generative: "Adds a T3 cube to Legacy Stash on boss kill.",
  blessed: "Grants random blessings on mini-boss kill."
};

export const BLESSING_DEFS = [
  { id: "berserking", name: "Berserking", icon: "spr_blessing_berserking", color: "#ef4444", desc: "+50% damage" },
  { id: "vitality", name: "Vitality", icon: "spr_blessing_vitality", color: "#22c55e", desc: "30 HP/s regen" },
  { id: "swiftness", name: "Swiftness", icon: "spr_blessing_swiftness", color: "#3b82f6", desc: "+50% speed" },
  { id: "fortune", name: "Fortune", icon: "spr_blessing_fortune", color: "#eab308", desc: "2 drop rates" },
  { id: "chaos", name: "Chaos", icon: "spr_blessing_chaos", color: "#a855f7", desc: "Random projectiles" },
  { id: "aftershock", name: "Aftershock", icon: "spr_blessing_aftershock", color: "#f97316", desc: "Enemies explode" }
];

// -------- Crafting Cubes --------

export const MODIFIER_CUBE_TIERS = [
  { min: 0.1, max: 0.25 },
  { min: 0.2, max: 0.35 },
  { min: 0.3, max: 0.45 }
];

export function getCubeDifficultyForTier(tier) {
  if (tier === 1) return 2;
  if (tier === 2) return 3;
  return 4;
}

export function getModifierRollRangeForTier(tier, modifierId = null) {
  const difficulty = getCubeDifficultyForTier(tier);
  const ranged = getModifierRollRangeForDifficulty(difficulty, modifierId);
  if (ranged) return ranged;
  const fallback = MODIFIER_CUBE_TIERS[Math.max(0, Math.min(2, (tier || 1) - 1))] || MODIFIER_CUBE_TIERS[0];
  return fallback;
}

export const MODIFIER_CUBES = [];

export const UPGRADE_CUBES = [
  { id: "magicCube", label: "Magic Cube", targetRarity: "common", newRarity: "magic", addsModifiers: 1 },
  { id: "rareCube", label: "Rare Cube", targetRarity: "magic", newRarity: "rare", addsModifiers: 1 },
  { id: "reforgeCube", label: "Reforge Cube", targetRarity: null, rerolls: true },
  { id: "vesselCube", label: "Vessel Cube", targetRarity: null, addsVessel: true }
];

export function getCubeLabel(cubeKey) {
  if (typeof cubeKey === "string") {
    cubeKey = cubeKey.replace(/^socketCube/, "vesselCube");
  }
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

export function rollModifierForTier(tier, modifierId = null) {
  const r = getModifierRollRangeForTier(tier, modifierId);
  return r.min + Math.random() * (r.max - r.min);
}

export function getModifierPoolEntry(modifierId) {
  return MODIFIER_POOL.find((m) => m.id === modifierId) || MODIFIER_POOL.find((m) => `${m.statKey}Percent` === modifierId);
}
