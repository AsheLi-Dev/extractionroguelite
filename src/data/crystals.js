// -------- Crystal currency for talents --------
// Characters earn crystals from allocated attributes: 1 crystal per 2 attributes.
// Brutality → Orange, Agility → Green, Vitality → Red, Luck → Yellow.
// Talents can require crystals (costCrystals) — design added later.

export const CRYSTAL_TYPES = [
  { id: "orange", name: "Orange", attributeId: "brutality", color: "#ea580c" },
  { id: "green", name: "Green", attributeId: "agility", color: "#16a34a" },
  { id: "red", name: "Red", attributeId: "vitality", color: "#dc2626" },
  { id: "yellow", name: "Yellow", attributeId: "luck", color: "#ca8a04" }
];

/** Attribute id → crystal id. */
export const ATTRIBUTE_TO_CRYSTAL = Object.fromEntries(
  CRYSTAL_TYPES.map((c) => [c.attributeId, c.id])
);

/** Default crystal counts (all zero). */
export function getEmptyCrystals() {
  return { orange: 0, green: 0, red: 0, yellow: 0 };
}

/**
 * Crystals available for a character: one per 2 allocated attributes (of that color).
 * If char.crystals is set (e.g. dev override), those values are used instead.
 * @param {object} char - Saved character with attributes: { brutality, agility, vitality, luck }
 * @returns {{ orange: number, green: number, red: number, yellow: number }}
 */
export function getCrystalsForCharacter(char) {
  const out = getEmptyCrystals();
  if (char?.crystals && typeof char.crystals === "object") {
    for (const { id } of CRYSTAL_TYPES) {
      const v = Number(char.crystals[id]);
      if (!Number.isNaN(v) && v >= 0) out[id] = Math.floor(v);
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

/**
 * Whether the character has at least the required crystals (for future talent costs).
 * cost is { orange?, green?, red?, yellow? } with non-negative numbers.
 */
export function canAffordCrystalCost(char, cost) {
  if (!cost || typeof cost !== "object") return true;
  const have = getCrystalsForCharacter(char);
  for (const { id } of CRYSTAL_TYPES) {
    const need = Math.max(0, Number(cost[id]) || 0);
    if (have[id] < need) return false;
  }
  return true;
}
