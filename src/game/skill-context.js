import { SKILL_DEFS } from "../data/skills.js";
import { ATTACK_TYPES } from "../data/conditions.js";
import { matchesTagFilter, normalizeTags } from "./tag-matcher.js";

const CONTEXT_DEFS = new Map();
for (const def of SKILL_DEFS) CONTEXT_DEFS.set(def.id, def);
for (const def of ATTACK_TYPES) CONTEXT_DEFS.set(def.id, def);

function getModifierBucket(modifier) {
  const id = String(modifier?.id || "");
  const statKey = String(modifier?.statKey || "");
  const hasTagFilter = !!modifier?.appliesTo;

  if ((id === "cooldownReductionPercent" || statKey === "cooldownRecovery") && hasTagFilter) {
    return "cooldown";
  }

  if ((id === "attackSpeedPercent" || statKey === "attackSpeed") && hasTagFilter) {
    return "attackSpeed";
  }

  if (id === "attackSpeedPct" || id === "meleeAttackSpeedPct") {
    return "attackSpeed";
  }

  if (
    id === "crowdControlPowerPct" ||
    id === "curseEffectPct" ||
    id === "defensePowerPct" ||
    statKey === "effectPower"
  ) {
    return "effectPower";
  }

  if (
    id === "attackDamagePct" ||
    ((id === "skillDamagePercent" || statKey === "skillDamage") && hasTagFilter) ||
    id === "projectileDamagePct" ||
    id === "meleeDamagePct" ||
    id === "areaDamagePct"
  ) {
    return "damage";
  }

  return null;
}

function clampMult(mult) {
  if (!Number.isFinite(mult)) return 1;
  return Math.max(0.05, mult);
}

export function buildSkillContext(skillId) {
  const skillDef = CONTEXT_DEFS.get(skillId) || { id: skillId, tags: [] };
  const tagsSet = normalizeTags(skillDef.tags || []);
  return { skillDef, tagsSet };
}

export function collectAllPlayerModifiers(game) {
  const out = [];

  for (const slot of Object.keys(game?.equipment || {})) {
    const item = game.equipment[slot];
    if (!item || !Array.isArray(item.modifiers)) continue;
    for (const modifier of item.modifiers) {
      if (!modifier) continue;
      out.push(modifier);
    }
  }

  if (Number.isFinite(game?.companionSkillDamage) && game.companionSkillDamage !== 0) {
    out.push({
      id: "companionSkillDamagePct",
      statKey: "skillDamage",
      value: game.companionSkillDamage
    });
  }

  if (Number.isFinite(game?.companionSkillCooldownReduction) && game.companionSkillCooldownReduction !== 0) {
    out.push({
      id: "companionSkillCooldownReductionPct",
      statKey: "cooldownRecovery",
      value: game.companionSkillCooldownReduction
    });
  }

  if (Array.isArray(game?.activeSkillTagModifiers)) {
    for (const modifier of game.activeSkillTagModifiers) {
      if (!modifier) continue;
      out.push(modifier);
    }
  }

  if (Array.isArray(game?.talentSkillTagModifiers)) {
    for (const modifier of game.talentSkillTagModifiers) {
      if (!modifier) continue;
      out.push(modifier);
    }
  }

  if (Array.isArray(game?.enemySkillTagModifiers)) {
    for (const modifier of game.enemySkillTagModifiers) {
      if (!modifier) continue;
      out.push(modifier);
    }
  }

  if (Array.isArray(game?.activeEnemySkillTagModifiers)) {
    for (const modifier of game.activeEnemySkillTagModifiers) {
      if (!modifier) continue;
      out.push(modifier);
    }
  }

  if (Array.isArray(game?.activeAncestorModifiers)) {
    for (const modifier of game.activeAncestorModifiers) {
      if (!modifier) continue;
      out.push(modifier);
    }
  }

  return out;
}

export function computeSkillMultipliers(skillDef, _playerStats, allPlayerModifiers) {
  const tagsSet = normalizeTags(skillDef?.tags || []);
  const routeDamageToEffect =
    tagsSet.has("defense") || tagsSet.has("curse") || tagsSet.has("crowd_control");

  let damageMult = 1;
  let cooldownMult = 1;
  let attackSpeedMult = 1;
  let effectPowerMult = 1;

  for (const modifier of allPlayerModifiers || []) {
    if (!modifier) continue;
    if (!matchesTagFilter(tagsSet, modifier.appliesTo)) continue;
    const value = Number(modifier.value);
    if (!Number.isFinite(value)) continue;

    const bucket = getModifierBucket(modifier);
    if (!bucket) continue;

    if (bucket === "cooldown") {
      cooldownMult *= 1 - value;
      continue;
    }

    if (bucket === "attackSpeed") {
      attackSpeedMult *= 1 + value;
      continue;
    }

    if (bucket === "effectPower") {
      effectPowerMult *= 1 + value;
      continue;
    }

    if (bucket === "damage") {
      if (routeDamageToEffect) {
        effectPowerMult *= 1 + value;
      } else {
        damageMult *= 1 + value;
      }
    }
  }

  return {
    damageMult: clampMult(damageMult),
    cooldownMult: clampMult(cooldownMult),
    attackSpeedMult: clampMult(attackSpeedMult),
    effectPowerMult: clampMult(effectPowerMult)
  };
}
