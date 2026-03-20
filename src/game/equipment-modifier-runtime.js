// -------- Equipment Modifier Runtime --------
// Lightweight, data-driven runtime helpers for equipped-item modifiers.
import { addGold } from "./economy.js";

const PASSIVE_STAT_KEYS = [
  "attackPercent",
  "attackSpeedPercent",
  "skillDamagePercent",
  "maxHealthPercent",
  "defensePercent",
  "speedPercent",
  "critChance",
  "critDamageBonus",
  "cooldownReductionPercent",
  "sprintSpeedBonus",
  "healingReceivedPercent",
  "chestOpenSpeedPercent",
  "dashChargesFlat",
  "flatMaxHealth",
  "projectileSpeedPercent",
  "areaOfEffectPercent",
  "dashDistancePercent",
  "movementCooldownRecovery",
  "xpRequiredReduction",
  "dashCooldownMultiplier",
  "projectilePierce",
  "critChanceCap"
];

const PASSIVE_STAT_BY_MOD_ID = {
  attackPercent: "attackPercent",
  attackSpeedPercent: "attackSpeedPercent",
  attackSpeedPct: "attackSpeedPercent",
  skillDamagePercent: "skillDamagePercent",
  attackDamagePct: "skillDamagePercent",
  projectileDamagePct: "skillDamagePercent",
  meleeDamagePct: "skillDamagePercent",
  areaDamagePct: "skillDamagePercent",
  maxHealthPercent: "maxHealthPercent",
  defensePercent: "defensePercent",
  speedPercent: "speedPercent",
  cooldownReductionPercent: "cooldownReductionPercent"
  ,
  chestOpenSpeedPercent: "chestOpenSpeedPercent",
  dashChargeBonus: "dashChargesFlat",
  flatMaxHealth: "flatMaxHealth",
  projectileSpeedPct: "projectileSpeedPercent",
  areaOfEffectPct: "areaOfEffectPercent",
  dashDistancePct: "dashDistancePercent",
  movementSkillCooldownPct: "movementCooldownRecovery",
  xpRequirementReduction: "xpRequiredReduction",
  projectilePierce: "projectilePierce",
  lowCritHighDamage: "critDamageBonus"
};

function readNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getModData(mod) {
  return (mod && typeof mod.data === "object" && mod.data) || {};
}

function applyFlatHeal(game, amount) {
  const heal = Math.max(0, Math.round(readNumber(amount, 0)));
  if (heal <= 0) return;
  if (typeof game.healPlayer === "function") {
    game.healPlayer(heal);
    return;
  }
  const maxHp = Math.max(1, Number(game.currentStats?.maxHealth) || 1);
  game.currentHealth = Math.min(maxHp, (game.currentHealth || 0) + heal);
}

function grantFlatXp(game, amount) {
  const xp = Math.max(0, Math.round(readNumber(amount, 0)));
  if (xp <= 0) return;
  if (typeof game.grantXP === "function") {
    game.grantXP(xp);
    return;
  }
  game.xp = (game.xp || 0) + xp;
}

function applyTemporaryDamageBuff(game, amount, durationSec) {
  const mult = Math.max(1, 1 + readNumber(amount, 0));
  const duration = Math.max(0.1, readNumber(durationSec, 4));
  game.equipmentGoldDamageBuffMult = mult;
  game.equipmentGoldDamageBuffUntil = (game.time || 0) + duration;
}

function applyTemporaryMoveSpeedBuff(game, amount, durationSec) {
  const mult = Math.max(1, 1 + readNumber(amount, 0));
  const duration = Math.max(0.1, readNumber(durationSec, 2));
  game.equipmentDashMoveSpeedBuffMult = mult;
  game.equipmentDashMoveSpeedBuffUntil = (game.time || 0) + duration;
}

function rollChance(chance) {
  const c = Math.max(0, Math.min(1, readNumber(chance, 0)));
  if (c <= 0) return false;
  if (c >= 1) return true;
  return Math.random() < c;
}

function applyTemporaryCritChanceBuff(game, amount, durationSec) {
  const bonus = Math.max(0, readNumber(amount, 0));
  const duration = Math.max(0.1, readNumber(durationSec, 4));
  game.equipmentChestCritChanceBuff = bonus;
  game.equipmentChestCritChanceBuffUntil = (game.time || 0) + duration;
}

function applyTemporaryGoldXpBuff(game, amount, durationSec) {
  const mult = Math.max(1, 1 + readNumber(amount, 0));
  const duration = Math.max(0.1, readNumber(durationSec, 6));
  game.equipmentNewMapGoldXpBuffMult = mult;
  game.equipmentNewMapGoldXpBuffUntil = (game.time || 0) + duration;
}

function addTimedStacks(game, key, cfg = {}) {
  const now = Number(game.time) || 0;
  const currentUntil = Number(game[`${key}Until`]) || 0;
  const stillActive = currentUntil > now;
  const currentStacks = stillActive ? (Math.max(0, Number(game[`${key}Stacks`]) || 0)) : 0;
  const maxStacks = Math.max(1, Math.floor(readNumber(cfg.maxStacks, 5)));
  const add = Math.max(1, Math.floor(readNumber(cfg.add, 1)));
  const duration = Math.max(0.1, readNumber(cfg.durationSec, 4));
  const nextStacks = Math.min(maxStacks, currentStacks + add);
  game[`${key}Stacks`] = nextStacks;
  game[`${key}Until`] = now + duration;
  return nextStacks;
}

// Event handlers keyed by modifier id for trigger-based effects.
// Keep default behavior no-op unless a modifier explicitly opts into runtime triggers.
const TRIGGER_HANDLER_BY_MOD_ID = {
  restoreHpOnLevelUpFlat(game, { mod }) {
    const data = getModData(mod);
    const amount = data.healFlat ?? data.amount ?? mod.value;
    applyFlatHeal(game, amount);
  },
  goldPickupDamageBuff(game, { mod }) {
    const data = getModData(mod);
    const amount = data.damagePercent ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 4;
    applyTemporaryDamageBuff(game, amount, durationSec);
  },
  chestBonusXpFlat(game, { mod }) {
    const data = getModData(mod);
    const amount = data.xpFlat ?? data.amount ?? mod.value;
    grantFlatXp(game, amount);
  },
  dashMoveSpeedBuff(game, { mod }) {
    const data = getModData(mod);
    const amount = data.moveSpeedPercent ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 2;
    applyTemporaryMoveSpeedBuff(game, amount, durationSec);
  },
  restoreHpOnNewMapFlat(game, { mod }) {
    const data = getModData(mod);
    const amount = data.healFlat ?? data.amount ?? mod.value;
    applyFlatHeal(game, amount);
  },
  healOnKillChance(game, { mod }) {
    const data = getModData(mod);
    const chance = data.chance ?? data.procChance ?? mod.value;
    if (!rollChance(chance)) return;
    const amount = data.healFlat ?? data.healAmount ?? data.amount ?? 5;
    applyFlatHeal(game, amount);
  },
  chestCritChanceBuff(game, { mod }) {
    const data = getModData(mod);
    const amount = data.critChance ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 4;
    applyTemporaryCritChanceBuff(game, amount, durationSec);
  },
  newMapGoldXpBuff(game, { mod }) {
    const data = getModData(mod);
    const amount = data.multiplierPercent ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 6;
    applyTemporaryGoldXpBuff(game, amount, durationSec);
  },
  pickMagicItemMoveSpeedBuff(game, { mod, payload }) {
    const rarity = payload?.item?.rarity || payload?.rarity || null;
    if (rarity !== "magic") return;
    const data = getModData(mod);
    const amount = data.moveSpeedPercent ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 3;
    applyTemporaryMoveSpeedBuff(game, amount, durationSec);
  },
  newMapMoveSpeedBuff(game, { mod }) {
    const data = getModData(mod);
    const amount = data.moveSpeedPercent ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 5;
    applyTemporaryMoveSpeedBuff(game, amount, durationSec);
  },
  miniBossKillMoveSpeedBuff(game, { mod }) {
    const data = getModData(mod);
    const amount = data.moveSpeedPercent ?? data.amount ?? mod.value;
    const durationSec = data.durationSec ?? data.duration ?? 4;
    applyTemporaryMoveSpeedBuff(game, amount, durationSec);
  },
  enterMapGoldFlat(game, { mod }) {
    const data = getModData(mod);
    const amount = mod.value ?? data.goldFlat ?? data.amount ?? 200;
    addGold(game, Math.max(0, Math.round(readNumber(amount, 0))), "equipment_enter_map_gold", { modifierId: mod.id });
  },
  minibossGoldFlat(game, { mod }) {
    const data = getModData(mod);
    const amount = data.goldFlat ?? data.amount ?? mod.value;
    addGold(game, Math.max(0, Math.round(readNumber(amount, 0))), "equipment_miniboss_gold", { modifierId: mod.id });
  },
  mapEntryGoldPercent(game, { mod }) {
    const pct = Math.max(0, readNumber(mod.value, 0));
    const currentGold = Math.max(0, Math.floor(readNumber(game?.gold, 0)));
    if (pct <= 0 || currentGold <= 0) return;
    const bonus = Math.max(0, Math.floor(currentGold * pct));
    if (bonus <= 0) return;
    addGold(game, bonus, "equipment_map_entry_gold_percent", { modifierId: mod.id, percent: pct, sourceGold: currentGold });
  },
  levelUpBonusAttributeChance(game, { mod }) {
    const data = getModData(mod);
    const chance = Math.max(0, Math.min(1, readNumber(mod.value, 0)));
    if (!rollChance(chance)) return;
    const bonus = Math.max(1, Math.round(readNumber(data.attributeBonus, 1)));
    game.runAttributePoints = Math.max(0, Number(game.runAttributePoints) || 0) + bonus;
    if (typeof game.updateXpUI === "function") game.updateXpUI();
  },
  levelUpAttackSpeedStack(game, { mod }) {
    const val = Math.max(0, readNumber(mod.value, 0));
    game.equipmentPermanentAttackSpeedPercent = (Number(game.equipmentPermanentAttackSpeedPercent) || 0) + val;
  },
  repeatBasicAttackChance(game, { mod, payload }) {
    const enemy = payload?.enemy;
    if (!enemy || enemy.isDead) return;
    const data = getModData(mod);
    const chance = data.chance ?? mod.value;
    if (!rollChance(chance)) return;
    const damageMult = Math.max(0.05, readNumber(data.damageMult, 0.45));
    const srcDamage = Math.max(1, readNumber(payload?.dmg, 0));
    const repeatDmg = Math.max(1, Math.round(srcDamage * damageMult));
    if (typeof game.dealDamageToEnemy === "function") {
      game.dealDamageToEnemy(enemy, repeatDmg, { sourceType: "equipment_repeat_attack", repeatAttack: true, isSkill: false });
    }
  },
  chanceToBleedOnHit(game, { mod, payload }) {
    const enemy = payload?.enemy;
    if (!enemy || enemy.isDead) return;
    const data = getModData(mod);
    const chance = data.chance ?? mod.value;
    if (!rollChance(chance)) return;
    const durationSec = Math.max(0.1, readNumber(data.durationSec, 3));
    const srcDamage = Math.max(1, readNumber(payload?.dmg, 0));
    const dpsMult = Math.max(0, readNumber(data.dpsMultOfHit, 0.05));
    enemy.bleedTimer = Math.max(readNumber(enemy.bleedTimer, 0), durationSec);
    enemy.bleedDps = Math.max(readNumber(enemy.bleedDps, 0), srcDamage * dpsMult);
    enemy.bleedAccum = 0;
  },
  chanceToBurnOnHit(game, { mod, payload }) {
    const enemy = payload?.enemy;
    if (!enemy || enemy.isDead) return;
    const data = getModData(mod);
    const chance = data.chance ?? mod.value;
    if (!rollChance(chance)) return;
    const durationSec = Math.max(0.1, readNumber(data.durationSec, 2.5));
    const srcDamage = Math.max(1, readNumber(payload?.dmg, game.currentStats?.attack || 0));
    const dpsMult = Math.max(0, readNumber(data.dpsMultOfHit, 0.12));
    const magnitude = Math.max(0, srcDamage * dpsMult);
    const burnPayload = {
      duration: durationSec,
      magnitude,
      stacks: 1,
      maxStacks: Math.max(1, Math.floor(readNumber(data.maxStacks, 1))),
      tickInterval: 0.5,
      data: { reason: "enemy_burn_tick", sourceType: "equipment_modifier" }
    };
    if (typeof game.applyBurnToEntity === "function") {
      game.applyBurnToEntity(enemy, burnPayload);
      return;
    }
    if (typeof game.applyStatusToEntity === "function" && enemy.id != null) {
      game.applyStatusToEntity(enemy.id, "burn", burnPayload);
      return;
    }
    enemy.burnUntil = (game.time || 0) + durationSec;
    enemy.burnDps = Math.max(readNumber(enemy.burnDps, 0), magnitude);
    enemy.burnAccum = 0;
  },
  chanceToSlowOnHit(game, { mod, payload }) {
    const enemy = payload?.enemy;
    if (!enemy || enemy.isDead) return;
    const data = getModData(mod);
    const chance = data.chance ?? mod.value;
    if (!rollChance(chance)) return;
    const durationSec = Math.max(0.1, readNumber(data.durationSec, 1.5));
    const slowMult = Math.max(0.1, Math.min(1, readNumber(data.slowMult, 0.85)));
    if (typeof game.applyStatusToEntity === "function" && enemy.id != null) {
      game.applyStatusToEntity(enemy.id, "slow", {
        duration: durationSec,
        magnitude: slowMult,
        sourceType: "equipment_modifier"
      });
      return;
    }
    enemy.slowUntil = Math.max(readNumber(enemy.slowUntil, 0), (game.time || 0) + durationSec);
    enemy.slowMult = Math.min(readNumber(enemy.slowMult, 1), slowMult);
  },
  orbitalArrows(game, { mod }) {
    if (!game || typeof game.spawnEquipmentOrbitalArrows !== "function") return;
    const data = getModData(mod);
    const count = Math.max(1, Math.round(readNumber(mod.value, data.projectileCount ?? 3)));
    const damageMultiplier = Math.max(0.01, readNumber(data.damageMultiplier, 0.10));
    game.spawnEquipmentOrbitalArrows(count, damageMultiplier);
  },
  critLifesteal(game, { mod, payload }) {
    const dmg = Math.max(0, readNumber(payload?.damage, 0));
    if (dmg <= 0) return;
    const data = getModData(mod);
    const pct = Math.max(0, readNumber(data.lifestealPercent ?? mod.value, 0.1));
    applyFlatHeal(game, Math.max(1, Math.round(dmg * pct)));
  },
  basicAttackExplosion(game, { mod, payload }) {
    const data = getModData(mod);
    const chance = data.chance ?? 0.2;
    if (!rollChance(chance)) return;
    const enemy = payload?.enemy;
    if (!enemy || typeof game.enemiesInRadius !== "function") return;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const radius = Math.max(20, readNumber(data.radius, 70));
    const damageMult = Math.max(0.05, readNumber(data.damageMult, 0.3));
    const srcDamage = Math.max(1, readNumber(payload?.dmg, 1));
    const explosionDmg = Math.max(1, Math.round(srcDamage * damageMult));
    for (const e of game.enemiesInRadius(ex, ey, radius) || []) {
      if (!e || e.isDead || e === enemy) continue;
      game.dealDamageToEnemy?.(e, explosionDmg, { isSkill: true, sourceType: "equipment_basic_explosion" });
    }
  },
  critAttackSpeedStacking(game, { mod }) {
    const data = getModData(mod);
    addTimedStacks(game, "equipmentCritAttackSpeed", {
      add: 1,
      maxStacks: data.maxStacks ?? 5,
      durationSec: data.durationSec ?? 4
    });
    game.equipmentCritAttackSpeedPerStack = Math.max(0, readNumber(data.stackPercent ?? mod.value, 0.04));
  },
  chestDamageStacking(game, { mod }) {
    const data = getModData(mod);
    addTimedStacks(game, "equipmentChestDamage", {
      add: 1,
      maxStacks: data.maxStacks ?? 5,
      durationSec: data.durationSec ?? 20
    });
    game.equipmentChestDamagePerStack = Math.max(0, readNumber(data.stackPercent ?? mod.value, 0.05));
  },
  dashFireball(game, { mod }) {
    const data = getModData(mod);
    const dmgMult = Math.max(0.1, readNumber(data.damageMult ?? mod.value, 0.8));
    if (!game.player || typeof game.getNearestEnemy !== "function" || typeof game.firePlayerProjectile !== "function") return;
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const target = game.getNearestEnemy(px, py, 650, null);
    if (!target) return;
    const tx = target.position.x + target.size / 2;
    const ty = target.position.y + target.size / 2;
    game.firePlayerProjectile(tx, ty, dmgMult, { fromSkill: true, attackTypeOverride: "projectile" });
  },
  reactiveKnockbackHeal(game, { mod }) {
    const data = getModData(mod);
    const now = Number(game.time) || 0;
    const icdSec = Math.max(0, readNumber(data.icdSec, 1.5));
    if (now < (game.equipmentReactiveKnockbackHealIcdUntil || 0)) return;
    game.equipmentReactiveKnockbackHealIcdUntil = now + icdSec;
    applyFlatHeal(game, data.healFlat ?? mod.value ?? 4);
    if (!game.player || typeof game.enemiesInRadius !== "function") return;
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const radius = Math.max(20, readNumber(data.radius, 110));
    const knockback = Math.max(0, readNumber(data.knockback, 140));
    for (const enemy of game.enemiesInRadius(px, py, radius) || []) {
      if (!enemy || enemy.isDead || !enemy.position) continue;
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const dx = ex - px;
      const dy = ey - py;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.position.x += (dx / dist) * (knockback * 0.08);
      enemy.position.y += (dy / dist) * (knockback * 0.08);
    }
  },
  critSummonSpirit(game, { mod, payload }) {
    const data = getModData(mod);
    const chance = data.chance ?? 0.25;
    if (!rollChance(chance)) return;
    const enemy = payload?.enemy;
    if (!enemy || !game.player || typeof game.firePlayerProjectile !== "function") return;
    const tx = enemy.position.x + enemy.size / 2;
    const ty = enemy.position.y + enemy.size / 2;
    const dmgMult = Math.max(0.1, readNumber(data.damageMult, 0.35));
    game.firePlayerProjectile(tx, ty, dmgMult, { fromSkill: true, attackTypeOverride: "projectile" });
  },
  critLightningChance(game, { mod, payload }) {
    const data = getModData(mod);
    const chance = data.chance ?? 0.2;
    if (!rollChance(chance)) return;
    const enemy = payload?.enemy;
    if (!enemy || typeof game.enemiesInRadius !== "function" || typeof game.dealDamageToEnemy !== "function") return;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const radius = Math.max(20, readNumber(data.radius, 160));
    const dmgMult = Math.max(0.1, readNumber(data.damageMult, 0.45));
    const srcDamage = Math.max(1, readNumber(payload?.damage, game.currentStats?.attack || 1));
    const lightningDmg = Math.max(1, Math.round(srcDamage * dmgMult));
    const chainTargets = (game.enemiesInRadius(ex, ey, radius) || []).filter((e) => e && !e.isDead && e !== enemy).slice(0, 1);
    for (const t of chainTargets) {
      game.dealDamageToEnemy(t, lightningDmg, { isSkill: true, sourceType: "equipment_crit_lightning" });
    }
  }
};

function createEmptyPassiveStats() {
  const out = {};
  for (const key of PASSIVE_STAT_KEYS) out[key] = 0;
  return out;
}

function getEquippedItems(game) {
  if (!game || !game.equipment || typeof game.equipment !== "object") return [];
  return Object.values(game.equipment).filter((item) => !!item);
}

function getEquippedModifiers(game) {
  const mods = [];
  for (const item of getEquippedItems(game)) {
    if (!Array.isArray(item?.modifiers)) continue;
    for (const mod of item.modifiers) {
      if (!mod) continue;
      mods.push({ item, mod });
    }
  }
  return mods;
}

const ITEM_STATS_ONLY_STATMOD_IDS = new Set([
  "attackDamageVsHealth",
  "attackSpeedVsHealth",
  "healthVsMoveSpeed",
  "xpVsHealth"
]);

export function getEquippedModifierStats(game) {
  const totals = createEmptyPassiveStats();
  for (const { mod } of getEquippedModifiers(game)) {
    if (!ITEM_STATS_ONLY_STATMOD_IDS.has(String(mod?.id || "")) && mod?.statMods && typeof mod.statMods === "object") {
      for (const [k, vRaw] of Object.entries(mod.statMods)) {
        if (totals[k] == null) continue;
        const v = Number(vRaw);
        if (!Number.isFinite(v)) continue;
        totals[k] += v;
      }
      const cap = Number(mod.statMods.critChanceCap);
      if (Number.isFinite(cap)) {
        const prior = Number(totals.critChanceCap);
        totals.critChanceCap = Number.isFinite(prior) && prior > 0 ? Math.min(prior, cap) : cap;
      }
    }
    let value = Number(mod.value);
    if (!Number.isFinite(value)) continue;
    const statKey = PASSIVE_STAT_BY_MOD_ID[mod.id] || mod.passiveStatKey || null;
    if (!statKey || totals[statKey] == null) continue;
    if (statKey === "dashChargesFlat") {
      const dataFlat = Number(mod?.data?.flat);
      value = Number.isFinite(dataFlat) ? dataFlat : value;
    }
    totals[statKey] += value;
  }
  return totals;
}

export function triggerEquipmentModifiers(game, eventType, payload = {}) {
  if (!game || !eventType) return 0;
  let triggerCount = 0;
  for (const { item, mod } of getEquippedModifiers(game)) {
    const trigger = mod.trigger ?? mod.triggerEvent ?? mod.eventType;
    const matches = Array.isArray(trigger) ? trigger.includes(eventType) : trigger === eventType;
    if (!matches) continue;
    const handler = TRIGGER_HANDLER_BY_MOD_ID[mod.id] || null;
    if (typeof handler === "function") {
      handler(game, { eventType, payload, item, mod });
    }
    triggerCount++;
  }
  return triggerCount;
}

export function tickEquipmentModifierIntervals(game, dt = 0) {
  if (!game) return 0;
  const now = Number(game.time) || 0;
  let fired = 0;
  for (const { item, mod } of getEquippedModifiers(game)) {
    const trigger = mod.trigger ?? mod.triggerEvent ?? mod.eventType;
    if (trigger !== "interval") continue;
    const data = getModData(mod);
    const interval = Math.max(0.1, readNumber(data.interval, 1));
    const key = `equipmentIntervalNextAt_${mod.id}`;
    const currentNext = readNumber(mod[key], NaN);
    const nextAt = Number.isFinite(currentNext) ? currentNext : (now + interval);
    if (!Number.isFinite(currentNext)) {
      mod[key] = nextAt;
      continue;
    }
    if (now < nextAt) continue;
    const handler = TRIGGER_HANDLER_BY_MOD_ID[mod.id] || null;
    if (typeof handler === "function") {
      handler(game, { eventType: "interval", payload: { dt }, item, mod });
      fired++;
    }
    mod[key] = now + interval;
  }
  return fired;
}

export function getEquipmentConditionalBonuses(game, player = null, context = {}) {
  const out = {
    damageVsSlowedPercent: 0,
    damageVsElitesPercent: 0,
    critChanceFromMoveSpeed: 0,
    healingReceivedPercent: 0
  };
  const equippedStats = getEquippedModifierStats(game);
  out.healingReceivedPercent += equippedStats.healingReceivedPercent || 0;

  const moveSpeed = Number(context.moveSpeed ?? game?.currentStats?.speed ?? player?.speed ?? 0);
  const isTargetSlowed = !!context.isTargetSlowed;
  const isTargetElite = !!context.isTargetElite;

  for (const { mod } of getEquippedModifiers(game)) {
    const cond = mod.conditional || null;
    if (!cond || typeof cond !== "object") continue;
    const type = String(cond.type || "");
    const value = Number(cond.value ?? mod.value);
    if (!Number.isFinite(value)) continue;

    if (type === "damage_vs_slowed" && isTargetSlowed) out.damageVsSlowedPercent += value;
    if (type === "damage_vs_elites" && isTargetElite) out.damageVsElitesPercent += value;
    if (type === "crit_from_move_speed") {
      const ratio = Math.max(0, moveSpeed) / Math.max(1, Number(cond.divisor) || 100);
      out.critChanceFromMoveSpeed += ratio * value;
    }
    if (type === "healing_received") out.healingReceivedPercent += value;
  }

  return out;
}

export function getEquipmentDerivedBonuses(game, context = {}) {
  const out = {
    critDamageFromCritChance: 0
  };
  const critChanceInput = Math.max(0, readNumber(context.critChance, 0));
  for (const { mod } of getEquippedModifiers(game)) {
    if (mod?.id !== "critScalingDamage") continue;
    const data = getModData(mod);
    const critChanceStep = Math.max(0.0001, readNumber(data.critChanceStep, 0.02));
    const critDamagePerStep = Math.max(0, readNumber(data.critDamagePerStep, 0.01));
    const stacks = Math.floor(critChanceInput / critChanceStep);
    out.critDamageFromCritChance += stacks * critDamagePerStep;
  }
  return out;
}

