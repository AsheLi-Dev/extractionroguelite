/**
 * Totem encounter definitions for TotemSubArea.
 * Buff totems: affect enemies in radius (speed, damage, damage taken).
 * Skill totems: fire projectiles on a timer with telegraph and on-hit effects.
 * Stats tuned to ~40–60% of elite HP so they are focusable but not tanky.
 */

/** Buff radius in tiles; converted to pixels using world.tileSize (e.g. 32). */
export const TOTEM_BUFF_RADIUS_TILES = 20;

/** Base totem HP (roughly 40–60% of elite); no armor. */
export const TOTEM_BASE_HP = 48;

/** Totem collision size (world units). */
export const TOTEM_SIZE = 48;

/** Category: buff = auras for enemies, skill = periodic projectile attack. */
export const TOTEM_CATEGORY = { BUFF: "buff", SKILL: "skill" };

/**
 * Totem type definitions.
 * - category: "buff" | "skill"
 * - Buff: buffId (speed | war | protection), value (multiplier or reduction)
 * - Skill: cooldown, telegraphDuration, projectiles (count, spreadDeg, speed), onHit (slow | stun with params)
 */
export const TOTEM_DEFS = {
  speed_buff_totem: {
    id: "speed_buff_totem",
    name: "Speed Totem",
    category: TOTEM_CATEGORY.BUFF,
    buffId: "speed",
    /** Enemies in radius gain +30% movement speed. */
    speedMult: 1.3,
    auraColor: "rgba(34, 197, 94, 0.35)",
    auraBorderColor: "rgba(74, 222, 128, 0.6)",
  },
  war_buff_totem: {
    id: "war_buff_totem",
    name: "War Totem",
    category: TOTEM_CATEGORY.BUFF,
    buffId: "war",
    /** Enemies in radius gain +30% damage. */
    damageMult: 1.3,
    auraColor: "rgba(239, 68, 68, 0.35)",
    auraBorderColor: "rgba(248, 113, 113, 0.6)",
  },
  protection_buff_totem: {
    id: "protection_buff_totem",
    name: "Protection Totem",
    category: TOTEM_CATEGORY.BUFF,
    buffId: "protection",
    /** Enemies in radius take 40% less damage (0.6 taken). */
    damageTakenMult: 0.6,
    auraColor: "rgba(234, 179, 8, 0.35)",
    auraBorderColor: "rgba(250, 204, 21, 0.6)",
  },
  fire_skill_totem: {
    id: "fire_skill_totem",
    name: "Fire Totem",
    category: TOTEM_CATEGORY.SKILL,
    spriteSheetSrc: "assets/Enemies/Fire TotemSprite Sheet v1.1.png",
    cooldown: 4,
    telegraphDuration: 0.5,
    projectileCount: 7,
    spreadDeg: 50,
    projectileSpeed: 280,
    projectileDamage: 8,
    projectileSize: 14,
    color: "#f97316",
    auraColor: "rgba(249, 115, 22, 0.4)",
    auraBorderColor: "rgba(251, 146, 60, 0.65)",
    magicStyle: "fireOrb",
  },
  ice_skill_totem: {
    id: "ice_skill_totem",
    name: "Ice Totem",
    category: TOTEM_CATEGORY.SKILL,
    spriteSheetSrc: "assets/Enemies/Ice TotemSprite Sheet v1.1.png",
    cooldown: 4,
    telegraphDuration: 0.5,
    projectileCount: 5,
    spreadDeg: 35,
    projectileSpeed: 320,
    projectileDamage: 6,
    projectileSize: 12,
    color: "#38bdf8",
    auraColor: "rgba(56, 189, 248, 0.4)",
    auraBorderColor: "rgba(125, 211, 252, 0.65)",
    magicStyle: "frostOrb",
    onHitSlow: true,
    slowMult: 0.65,
    slowDuration: 1.5,
  },
  lightning_skill_totem: {
    id: "lightning_skill_totem",
    name: "Lightning Totem",
    category: TOTEM_CATEGORY.SKILL,
    spriteSheetSrc: "assets/Enemies/Lightning TotemSprite Sheet v1.1.png",
    cooldown: 4,
    telegraphDuration: 0.5,
    projectileCount: 1,
    spreadDeg: 0,
    projectileSpeed: 380,
    projectileDamage: 10,
    projectileSize: 16,
    color: "#a78bfa",
    auraColor: "rgba(167, 139, 250, 0.4)",
    auraBorderColor: "rgba(196, 181, 253, 0.65)",
    magicStyle: "lightningBolt",
    movementType: "zigzag",
    onHitStun: true,
    stunDuration: 0.35,
  },
};

/** All totem ids for random selection; weighted rarity can be added later. */
export const TOTEM_IDS = Object.keys(TOTEM_DEFS);

export function getTotemDef(id) {
  return TOTEM_DEFS[id] || null;
}

/**
 * Pick one random totem type from the pool. Centralized for future weighted rarity.
 * @param {function(): number} rng - [0, 1)
 */
export function pickRandomTotemType(rng = Math.random) {
  const idx = Math.floor(rng() * TOTEM_IDS.length);
  return TOTEM_IDS[idx] || TOTEM_IDS[0];
}
