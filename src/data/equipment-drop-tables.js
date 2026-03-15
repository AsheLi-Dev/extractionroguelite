const MINION_BASE = Object.freeze({
  chance: 0.061,
  qualityBonus: 0.08
});

const ELITE_BASE = Object.freeze({
  chance: 0.25,
  qualityBonus: 0.35
});

const SPECIAL_BASE = Object.freeze({
  chance: 0.35,
  qualityBonus: 0.55
});

const MINIBOSS_BASE = Object.freeze({
  chance: 1,
  qualityBonus: 0.8
});

export const MINIBOSS_EXTRA_BASE = Object.freeze({
  chance: 0.1,
  qualityBonus: 0.8
});

function getBaseTableForTier(tier) {
  if (tier === "miniBoss") return MINIBOSS_BASE;
  if (tier === "special") return SPECIAL_BASE;
  if (tier === "elite") return ELITE_BASE;
  return MINION_BASE;
}

export function getAdjustedProbs(tier, bias = 0, dropMult = 1, equipDropMult = 1, bandMult = 1) {
  const base = getBaseTableForTier(tier);
  const chanceMult = Math.max(0, Number(dropMult) || 0)
    * Math.max(0, Number(equipDropMult) || 0)
    * Math.max(0, Number(bandMult) || 0);
  return {
    chance: Math.max(0, Math.min(1, (base.chance || 0) * chanceMult)),
    qualityBonus: Math.max(0, Number(base.qualityBonus || 0) + Math.max(0, Number(bias) || 0))
  };
}

export function rollEquipmentDropOutcome(tier, bias = 0, dropMult = 1, equipDropMult = 1, bandMult = 1) {
  const probs = getAdjustedProbs(tier, bias, dropMult, equipDropMult, bandMult);
  if (probs.chance <= 0 || Math.random() >= probs.chance) return null;
  return {
    tier,
    qualityBonus: probs.qualityBonus
  };
}
