/**
 * Skill trigger progress: progress-based triggers (kill, basic hit, HP loss, etc.).
 * Threshold scales with skill cooldown; triggered skills do not recursively trigger.
 */

import { getModsForSkillSlot } from '../data/skills.js';
import { getSkillById } from '../data/skills.js';

/** Mod id -> event type that advances progress. */
export const TRIGGER_PROGRESS_MOD_EVENT = {
  triggerFromHpLoss: 'hp_loss',
  triggerFromBasicHit: 'basic_attack_hit',
  triggerFromKill: 'kill',
  triggerFromHpRecovery: 'hp_recovery',
  triggerFromGold: 'gold_collected',
  triggerFromUrn: 'urn_destroyed'
};

/** Event types that can advance progress. */
export const TRIGGER_PROGRESS_EVENT_TYPES = new Set(Object.values(TRIGGER_PROGRESS_MOD_EVENT));

/**
 * Progress per event = 1 / (1 + baseCd * k). Longer CD = more events needed to trigger.
 * Threshold = 1.0.
 */
const COOLDOWN_SCALE = 0.15;

function getProgressPerEvent(baseCd) {
  return 1 / (1 + (baseCd || 0) * COOLDOWN_SCALE);
}

/**
 * Ensure game has skillTriggerProgress array (per-slot progress 0..3).
 * @param {object} game
 */
export function ensureSkillTriggerProgress(game) {
  if (!game.skillTriggerProgress || !Array.isArray(game.skillTriggerProgress)) {
    game.skillTriggerProgress = [0, 0, 0, 0];
  }
  return game.skillTriggerProgress;
}

/**
 * Advance trigger progress for all slots that have a mod for this event type.
 * When a slot reaches threshold (1.0), fire that skill once with triggered: true, allowTriggeredProcs: false, then reset.
 * At most one slot fires per call to avoid multiple triggers from one event.
 * @param {object} game - Game instance
 * @param {string} eventType - One of TRIGGER_PROGRESS_EVENT_TYPES
 * @param {object} [payload] - Optional (e.g. amount for hp_loss, gold for gold_collected)
 * @returns {boolean} True if a skill was triggered
 */
export function advanceSkillTriggerProgress(game, eventType, payload = {}) {
  if (!TRIGGER_PROGRESS_EVENT_TYPES.has(eventType)) return false;
  const progress = ensureSkillTriggerProgress(game);
  const skills = game.skills;
  if (!Array.isArray(skills) || skills.length < 4) return false;

  const modToEvent = TRIGGER_PROGRESS_MOD_EVENT;
  const slotsToAdvance = [];
  for (let slot = 0; slot < 4; slot++) {
    const skillId = skills[slot];
    if (!skillId) continue;
    const mods = getModsForSkillSlot(game, slot);
    const modId = Object.keys(modToEvent).find((id) => modToEvent[id] === eventType && mods.includes(id));
    if (!modId) continue;
    const def = getSkillById(skillId);
    if (!def || def.category === 'aura') continue;
    const baseCd = def.baseCd || 0;
    const grant = getProgressPerEvent(baseCd);
    slotsToAdvance.push({ slot, skillId, grant, baseCd });
  }

  for (const { slot, grant } of slotsToAdvance) {
    progress[slot] = (progress[slot] || 0) + grant;
  }

  let fired = false;
  for (let slot = 0; slot < 4 && !fired; slot++) {
    if ((progress[slot] || 0) >= 1) {
      const skillId = skills[slot];
      if (!skillId) continue;
      const def = getSkillById(skillId);
      if (!def || def.category === 'aura') continue;
      progress[slot] = 0;
      if (typeof game.executeSkill === 'function') {
        game.executeSkill(skillId, slot, { triggered: true, allowTriggeredProcs: false, triggerProgress: true });
        fired = true;
      }
    }
  }
  return fired;
}
