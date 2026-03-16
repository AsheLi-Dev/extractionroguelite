// -------- Skill modification cards (in-run drops) --------
// Defines mod definitions with rarity and compatibility tags for smart-loot and equipping.

import { MODIFICATION_CARD_DEFS } from './skills.js';
import { SKILL_DEFS, getSkillById } from './skills.js';

/** Rarity tiers for mod drops. */
export const MOD_RARITIES = ['common', 'rare', 'epic', 'legendary'];

/** Category -> compatibility tags (skills must have at least one matching tag). */
const CATEGORY_TAGS = {
  delivery: ['projectile', 'ranged'],
  trigger: ['projectile', 'ranged', 'melee', 'area'],
  element: ['projectile', 'ranged', 'melee', 'area'],
  self: ['projectile', 'ranged', 'melee', 'area', 'defense', 'utility', 'crowd_control']
};

/**
 * Build SKILL_MOD_DEFS from existing MODIFICATION_CARD_DEFS with rarity and tags.
 * MVP: common and rare only; epic/legendary can be added later.
 */
function buildSkillModDefs() {
  const defs = {};
  const rarityByCategory = { delivery: 'rare', trigger: 'rare', element: 'common', self: 'common' };
  for (const card of MODIFICATION_CARD_DEFS) {
    const category = card.category || 'self';
    defs[card.id] = {
      id: card.id,
      name: card.name,
      description: card.desc || card.description || '',
      rarity: card.rarity || rarityByCategory[category] || 'common',
      category,
      tags: card.tags || CATEGORY_TAGS[category] || CATEGORY_TAGS.self,
      effectType: 'legacy',
      desc: card.desc
    };
  }
  return defs;
}

export const SKILL_MOD_DEFS = buildSkillModDefs();

/**
 * Get all mod IDs that are compatible with a skill (skill has at least one tag in mod's tags).
 * @param {object} skillDef - Skill definition from SKILL_DEFS (must have .tags array).
 * @returns {string[]} Mod IDs that can be equipped on this skill.
 */
export function getModsCompatibleWithSkill(skillDef) {
  if (!skillDef || !Array.isArray(skillDef.tags)) return [];
  const skillTags = new Set(skillDef.tags);
  return Object.keys(SKILL_MOD_DEFS).filter((modId) => {
    const mod = SKILL_MOD_DEFS[modId];
    const modTags = mod.tags || [];
    return modTags.some((t) => skillTags.has(t));
  });
}

/**
 * Get equipped skill IDs for the current run (from game.skills).
 * @param {object} game - Game instance with .skills array.
 * @returns {string[]} Non-null skill IDs.
 */
export function getEquippedSkillIds(game) {
  const skills = game?.skills;
  if (!Array.isArray(skills)) return [];
  return skills.filter(Boolean);
}

/**
 * Get mod counts per equipped skill for weighting (under-served skills get higher weight).
 * @param {object} game - Game instance with .runSkillMods and .skills.
 * @returns {Record<string, number>} skillId -> number of mods equipped.
 */
export function getModCountsByEquippedSkill(game) {
  const runSkillMods = game?.runSkillMods || {};
  const equipped = getEquippedSkillIds(game);
  const counts = {};
  for (const skillId of equipped) {
    const slots = runSkillMods[skillId];
    counts[skillId] = Array.isArray(slots) ? slots.filter(Boolean).length : 0;
  }
  return counts;
}

/**
 * Pick a random mod ID with optional filters and smart-loot weighting.
 * @param {object} options - { game, rarity, compatibleWithSkillId, preferEquipped, preferUnderServed }
 * @returns {string|null} Mod ID or null.
 */
export function getRandomMod(options = {}) {
  const { game, rarity, compatibleWithSkillId, preferEquipped = true, preferUnderServed = true } = options;
  const pool = Object.keys(SKILL_MOD_DEFS);
  if (pool.length === 0) return null;

  let filtered = pool;
  if (rarity) {
    const r = String(rarity).toLowerCase();
    filtered = pool.filter((id) => (SKILL_MOD_DEFS[id].rarity || 'common') === r);
    if (filtered.length === 0) filtered = pool;
  }

  if (compatibleWithSkillId) {
    const skillDef = getSkillById(compatibleWithSkillId);
    const compatible = getModsCompatibleWithSkill(skillDef);
    if (compatible.length > 0) {
      filtered = filtered.filter((id) => compatible.includes(id));
      if (filtered.length === 0) filtered = pool;
    }
  }

  // Smart-loot: weight toward equipped skills and under-served skills
  const weights = [];
  const equipped = game ? getEquippedSkillIds(game) : [];
  const modCounts = game && preferUnderServed ? getModCountsByEquippedSkill(game) : {};

  for (const modId of filtered) {
    const mod = SKILL_MOD_DEFS[modId];
    let w = 1;
    if (preferEquipped && game && equipped.length > 0) {
      const compatibleSkillIds = SKILL_DEFS.filter((s) => getModsCompatibleWithSkill(s).includes(modId)).map((s) => s.id);
      const matchesEquipped = compatibleSkillIds.some((sid) => equipped.includes(sid));
      if (matchesEquipped) {
        w = 4;
        if (preferUnderServed) {
          const minCount = Math.min(...compatibleSkillIds.map((sid) => modCounts[sid] ?? 0));
          w += Math.max(0, 3 - minCount);
        }
      }
    }
    weights.push(w);
  }

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return filtered[Math.floor(Math.random() * filtered.length)];
  let r = Math.random() * total;
  for (let i = 0; i < filtered.length; i++) {
    r -= weights[i];
    if (r <= 0) return filtered[i];
  }
  return filtered[filtered.length - 1];
}

/**
 * Get mod definition by ID.
 * @param {string} modId
 * @returns {object|null}
 */
export function getSkillModById(modId) {
  return SKILL_MOD_DEFS[modId] || null;
}
