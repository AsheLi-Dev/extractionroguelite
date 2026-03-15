/**
 * AmbushSubArea theme definitions. Data-driven so new themes can be added without core changes.
 * Each theme: id, name, enemy list (typeId + min/max count), spawn pacing, optional weight for rarity.
 * Enemy typeIds match ENEMY_TYPES in enemy.js (e.g. m_5s_small_frog, m_11a_small_myconid, m_1c_goblin).
 */

/** Default spawn window: enemies spawn over this many seconds for chaotic feel. */
export const AMBUSH_SPAWN_WINDOW_MIN = 0.5;
export const AMBUSH_SPAWN_WINDOW_MAX = 1.5;

/** Anticipation delay (seconds) before first spawn. */
export const AMBUSH_ANTICIPATION_MIN = 0.3;
export const AMBUSH_ANTICIPATION_MAX = 0.6;

/** Reward: ~0.3–0.5 of miniboss. Gold burst count and quality. */
export const AMBUSH_REWARD_BURST_COUNT_MIN = 1;
export const AMBUSH_REWARD_BURST_COUNT_MAX = 2;
export const AMBUSH_REWARD_QUALITY = 0.4;

/**
 * Theme definition shape:
 * - id: string
 * - name: string (for debug/UI)
 * - weight: number (higher = more likely; rare themes use low weight)
 * - enemies: Array<{ typeId: string, min: number, max: number }>
 */
export const AMBUSH_THEMES = [
  {
    id: "frog_panic",
    name: "Frog Panic",
    weight: 1,
    enemies: [
      { typeId: "m_5s_small_frog", min: 10, max: 16 },
    ],
  },
  {
    id: "mushroom_burst",
    name: "Mushroom Burst",
    weight: 1,
    enemies: [
      { typeId: "m_11a_small_myconid", min: 8, max: 14 },
    ],
  },
  {
    id: "goblin_mob",
    name: "Goblin Mob",
    weight: 1,
    enemies: [
      { typeId: "m_1c_goblin", min: 8, max: 12 },
      { typeId: "m_1g_goblin_mage", min: 1, max: 2 },
    ],
  },
  {
    id: "dwarfette_stampede",
    name: "Dwarfette Stampede",
    weight: 1,
    enemies: [
      { typeId: "m_5l_medium_dwarfette", min: 6, max: 10 },
    ],
  },
  {
    id: "minotaur_escort",
    name: "Minotaur Escort",
    weight: 0.15,
    enemies: [
      { typeId: "m_8h_minotaur", min: 1, max: 1 },
      { typeId: "m_1c_goblin", min: 6, max: 6 },
    ],
  },
  {
    id: "lich_with_minions",
    name: "Lich With Terrible Minions",
    weight: 0.15,
    enemies: [
      { typeId: "m_5c_lich", min: 1, max: 1 },
      { typeId: "m_5s_small_frog", min: 10, max: 10 },
    ],
  },
];

/** Total weight for weighted random pick. */
const TOTAL_WEIGHT = AMBUSH_THEMES.reduce((s, t) => s + t.weight, 0);

/**
 * Pick a random theme by weight. Rare themes have lower weight.
 * @param {function(): number} rng - [0, 1)
 * @returns {typeof AMBUSH_THEMES[0]}
 */
export function pickAmbushTheme(rng = Math.random) {
  let v = rng() * TOTAL_WEIGHT;
  for (const theme of AMBUSH_THEMES) {
    v -= theme.weight;
    if (v <= 0) return theme;
  }
  return AMBUSH_THEMES[AMBUSH_THEMES.length - 1];
}

/**
 * Build the list of spawns for a theme: array of { typeId } (one per enemy to spawn).
 * @param {typeof AMBUSH_THEMES[0]} theme
 * @param {function(): number} rng
 * @returns {{ typeId: string }[]}
 */
export function buildAmbushSpawnList(theme, rng = Math.random) {
  const list = [];
  for (const entry of theme.enemies) {
    const count = entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
    for (let i = 0; i < count; i++) {
      list.push({ typeId: entry.typeId });
    }
  }
  return list;
}
