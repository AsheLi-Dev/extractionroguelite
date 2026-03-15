// -------- Meta character attributes (Hall of Champions) --------
// Characters gain 1 attribute point per level. Allocated in Hall of Champions.

export const META_ATTRIBUTES = [
  { id: "brutality", name: "Brutality" },
  { id: "agility", name: "Agility" },
  { id: "vitality", name: "Vitality" },
  { id: "luck", name: "Luck" }
];

/** Attribute points earned from level: 1 point per level. */
export function getAttributePointsForLevel(level) {
  return Math.max(0, Math.floor(Number(level)));
}

/** Default attribute allocation for a new saved character. */
export function getDefaultAttributes() {
  return { brutality: 0, agility: 0, vitality: 0, luck: 0 };
}

/** Total allocated points from a character's attributes object. */
export function getTotalAllocated(attributes) {
  if (!attributes || typeof attributes !== "object") return 0;
  return META_ATTRIBUTES.reduce((sum, a) => sum + (Number(attributes[a.id]) || 0), 0);
}

/** Available points for a character (from level minus allocated). */
export function getAvailableAttributePoints(character) {
  const level = Number(character?.level) || 1;
  const allocated = getTotalAllocated(character?.attributes);
  return Math.max(0, getAttributePointsForLevel(level) - allocated);
}

// -------- Wounds (permanent penalties when existing character is defeated) --------
export const WOUND_MAX_STACKS = 5;

/** Multipliers for speed, attack, maxHealth by wound stacks (1-5). Stacks 0 = no penalty. */
export function getWoundMultipliers(wounds) {
  const w = Math.max(0, Math.min(WOUND_MAX_STACKS, Number(wounds) || 0));
  if (w <= 0) return { speed: 1, attack: 1, maxHealth: 1 };
  const table = {
    1: { speed: 0.95, attack: 1, maxHealth: 1 },
    2: { speed: 0.90, attack: 0.95, maxHealth: 1 },
    3: { speed: 0.90, attack: 0.90, maxHealth: 1 },
    4: { speed: 0.90, attack: 0.90, maxHealth: 0.90 },
    5: { speed: 0.80, attack: 0.80, maxHealth: 0.80 }
  };
  return table[w] || { speed: 1, attack: 1, maxHealth: 1 };
}

export function isCharacterDead(character) {
  return !!character?.dead;
}
