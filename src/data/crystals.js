// -------- Crystal currency for talents --------
// Global meta crystals are earned from successful extraction.
// Brutality -> Orange, Agility -> Green, Vitality -> Red, Luck -> Yellow.

import { TALENT_CRYSTALS_KEY } from './constants.js';

export const CRYSTAL_TYPES = [
  { id: "orange", name: "Orange", attributeId: "brutality", color: "#ea580c" },
  { id: "green", name: "Green", attributeId: "agility", color: "#16a34a" },
  { id: "red", name: "Red", attributeId: "vitality", color: "#dc2626" },
  { id: "yellow", name: "Yellow", attributeId: "luck", color: "#ca8a04" }
];

export const ATTRIBUTE_TO_CRYSTAL = Object.fromEntries(
  CRYSTAL_TYPES.map((entry) => [entry.attributeId, entry.id])
);

export function getEmptyCrystals() {
  return { orange: 0, green: 0, red: 0, yellow: 0 };
}

export function getGlobalTalentCrystals() {
  try {
    const raw = localStorage.getItem(TALENT_CRYSTALS_KEY);
    if (!raw) return getEmptyCrystals();
    const parsed = JSON.parse(raw);
    const out = getEmptyCrystals();
    for (const { id } of CRYSTAL_TYPES) {
      const value = Number(parsed?.[id]);
      if (!Number.isNaN(value) && value >= 0) out[id] = Math.floor(value);
    }
    return out;
  } catch {
    return getEmptyCrystals();
  }
}

export function setGlobalTalentCrystals(crystals) {
  const out = getEmptyCrystals();
  for (const { id } of CRYSTAL_TYPES) {
    const value = Number(crystals?.[id]);
    if (!Number.isNaN(value) && value >= 0) out[id] = Math.floor(value);
  }
  localStorage.setItem(TALENT_CRYSTALS_KEY, JSON.stringify(out));
  return out;
}

export function addGlobalTalentCrystal(crystalId, amount = 1) {
  const next = getGlobalTalentCrystals();
  if (!Object.prototype.hasOwnProperty.call(next, crystalId)) return next;
  next[crystalId] = Math.max(0, (next[crystalId] || 0) + Math.max(0, Math.floor(Number(amount) || 0)));
  return setGlobalTalentCrystals(next);
}

export function spendGlobalTalentCrystal(crystalId, amount = 1) {
  const next = getGlobalTalentCrystals();
  if (!Object.prototype.hasOwnProperty.call(next, crystalId)) return null;
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if ((next[crystalId] || 0) < cost) return null;
  next[crystalId] = Math.max(0, (next[crystalId] || 0) - cost);
  return setGlobalTalentCrystals(next);
}

export function getHighestAttributeCrystalReward(attributes) {
  if (!attributes || typeof attributes !== "object") return null;
  const ranked = CRYSTAL_TYPES.map((entry) => ({
    attributeId: entry.attributeId,
    crystalId: entry.id,
    value: Math.max(0, Number(attributes[entry.attributeId]) || 0)
  }));
  const maxValue = ranked.reduce((max, entry) => Math.max(max, entry.value), 0);
  const tied = ranked.filter((entry) => entry.value === maxValue);
  if (!tied.length) return null;
  return tied[Math.floor(Math.random() * tied.length)] || null;
}

// Compatibility helpers kept for older UI paths until they are migrated fully.
export function getCrystalsForCharacter(char) {
  const out = getEmptyCrystals();
  if (char?.crystals && typeof char.crystals === "object") {
    for (const { id } of CRYSTAL_TYPES) {
      const value = Number(char.crystals[id]);
      if (!Number.isNaN(value) && value >= 0) out[id] = Math.floor(value);
    }
    return out;
  }
  if (!char?.attributes || typeof char.attributes !== "object") return out;
  for (const { id, attributeId } of CRYSTAL_TYPES) {
    const att = Math.max(0, Number(char.attributes[attributeId]) || 0);
    out[id] = Math.floor(att / 2);
  }
  return out;
}

export function canAffordCrystalCost(char, cost) {
  if (!cost || typeof cost !== "object") return true;
  const have = getCrystalsForCharacter(char);
  for (const { id } of CRYSTAL_TYPES) {
    const need = Math.max(0, Number(cost[id]) || 0);
    if (have[id] < need) return false;
  }
  return true;
}
