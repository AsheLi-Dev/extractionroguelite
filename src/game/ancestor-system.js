import {
  ANCESTOR_SPIRIT_DEFS,
  getAncestorSpiritDef,
  pickRandomAncestorSpiritDefId,
  pickRandomAncestorSpiritDefIdByRarity
} from "../data/ancestor-spirits-data.js";
import { CLAN_BONUSES } from "../data/clans-data.js";
import { matchesTagFilter, normalizeTags } from "./tag-matcher.js";
import { buildSkillContext } from "./skill-context.js";

const VESSEL_CAPS = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 2
};

const MELEE_TAGS = normalizeTags(["melee"]);

function makeSpiritItemId() {
  return `as_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureAncestorRuntime(game) {
  if (!game.ancestorRuntime) {
    game.ancestorRuntime = {
      activeSpirits: [],
      staticMods: [],
      tempMods: [],
      dynamicMods: [],
      clanCounts: {},
      clanBonusIds: [],
      hooks: {
        onEquip: [],
        onUnequip: [],
        onHit: [],
        onPlayerDamaged: [],
        onTick: []
      },
      berserkUntil: 0,
      hasBerserkHook: false,
      hasTyrantHook: false,
      activeHookIds: new Set(),
      swiftTempoStacks: 0,
      swiftTempoUntil: 0,
      bulwarkRegenDps: 0,
      bulwarkRegenUntil: 0,
      bulwarkRegenAccum: 0,
      bulwarkSecondWindIcdUntil: 0,
      skirmisherKargUntil: 0,
      huntmasterVelUntil: 0,
      battleShamanExpiries: [],
      conquerorGuardUntil: 0,
      wreckerUntil: 0,
      kestUntil: 0,
      handyExpiries: [],
      martyrUntil: 0,
      survivorUntil: 0,
      dravenIcdUntil: 0,
      chronomancerIcdUntil: 0,
      lastPlayerDamageTime: 0
    };
  }
  return game.ancestorRuntime;
}

export function getVesselCapForRarity(rarity) {
  const key = String(rarity || "common").toLowerCase();
  return VESSEL_CAPS[key] ?? 0;
}

export function ensureItemVessels(item) {
  if (!item || typeof item !== "object") return item;
  const cap = getVesselCapForRarity(item.rarity);
  let vesselsMax = Number.isFinite(item.vesselsMax) ? Math.floor(item.vesselsMax) : 0;
  vesselsMax = Math.max(0, Math.min(vesselsMax, cap));
  item.vesselsMax = vesselsMax;

  if (!Array.isArray(item.vessels)) item.vessels = [];
  if (item.vessels.length > vesselsMax) item.vessels = item.vessels.slice(0, vesselsMax);
  while (item.vessels.length < vesselsMax) item.vessels.push(null);
  for (let i = 0; i < item.vessels.length; i++) {
    const entry = item.vessels[i];
    if (!entry || typeof entry !== "object" || !entry.spiritId) {
      item.vessels[i] = null;
      continue;
    }
    item.vessels[i] = { spiritId: String(entry.spiritId) };
  }
  return item;
}

export function ensureRunInventoryState(game) {
  if (!game.runInventory || typeof game.runInventory !== "object") {
    game.runInventory = {};
  }
  if (!Array.isArray(game.runInventory.ancestorSpirits)) {
    game.runInventory.ancestorSpirits = [];
  }
  if (!game.runInventory.ancestorSpiritRegistry || typeof game.runInventory.ancestorSpiritRegistry !== "object") {
    game.runInventory.ancestorSpiritRegistry = {};
  }
  for (const spirit of game.runInventory.ancestorSpirits) {
    if (!spirit?.id) continue;
    game.runInventory.ancestorSpiritRegistry[spirit.id] = spirit;
  }
  return game.runInventory;
}

export function normalizeAllEquipmentVessels(game) {
  for (const slot of Object.keys(game?.equipment || {})) {
    const item = game.equipment[slot];
    if (!item) continue;
    ensureItemVessels(item);
  }
  for (const item of game?.inventory || []) {
    if (!item) continue;
    ensureItemVessels(item);
  }
}

export function createSpiritItem(defId) {
  const def = getAncestorSpiritDef(defId);
  if (!def) return null;
  return {
    id: makeSpiritItemId(),
    defId: def.id,
    rarity: def.rarity,
    clans: Array.isArray(def.clans) ? [...def.clans] : []
  };
}

function computeClanState(clanCounts) {
  const bonusIds = [];
  for (const [clanId, count] of Object.entries(clanCounts || {})) {
    const defs = CLAN_BONUSES[clanId] || [];
    for (const bonus of defs) {
      if ((count || 0) >= bonus.threshold) bonusIds.push(bonus.id);
    }
  }
  return bonusIds;
}

function getSwiftCount(game) {
  return game.activeClanCounts?.swift || 0;
}

function getArcanaCount(game) {
  return game.activeClanCounts?.arcana || 0;
}

function getHoarderCount(game) {
  return game.activeClanCounts?.hoarder || 0;
}

function getBulwarkCount(game) {
  return game.activeClanCounts?.bulwark || 0;
}

function hasActiveHook(runtime, hookId) {
  return !!runtime?.activeHookIds?.has(hookId);
}

function pruneExpiries(expiries, now) {
  if (!Array.isArray(expiries)) return [];
  return expiries.filter((t) => Number.isFinite(t) && t > now);
}

function addExpiryStack(expiries, now, duration, cap) {
  const next = pruneExpiries(expiries, now);
  next.push(now + duration);
  next.sort((a, b) => a - b);
  while (next.length > cap) next.shift();
  return next;
}

function randomOtherSkillSlot(game, excludedSlot = null) {
  const candidates = [];
  for (let i = 0; i < (game.skills || []).length; i++) {
    if (excludedSlot != null && i === excludedSlot) continue;
    if (!game.skills[i]) continue;
    candidates.push(i);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function maybeApplyChronomancerDashCooldown(game, amount) {
  if (!amount || amount <= 0) return;
  const runtime = ensureAncestorRuntime(game);
  if (!hasActiveHook(runtime, "chronomancer_ishtar_cdr_to_dash")) return;
  if ((runtime.chronomancerIcdUntil || 0) > game.time) return;
  runtime.chronomancerIcdUntil = game.time + 1;
  game.dashCooldown = Math.max(0, (game.dashCooldown || 0) - amount);
  if (typeof game.updateDashUI === "function") game.updateDashUI();
}

function reduceSkillCooldownByAmount(game, slot, amount) {
  if (slot == null || amount <= 0) return 0;
  const currentCd = Math.max(0, game.skillCooldowns?.[slot] || 0);
  const applied = Math.min(currentCd, amount);
  if (applied <= 0) return 0;
  game.skillCooldowns[slot] = Math.max(0, currentCd - amount);
  maybeApplyChronomancerDashCooldown(game, applied);
  return applied;
}

function reduceRandomSkillCooldown(game, amount, excludedSlot = null) {
  if (amount <= 0) return 0;
  const slot = randomOtherSkillSlot(game, excludedSlot);
  if (slot == null) return 0;
  return reduceSkillCooldownByAmount(game, slot, amount);
}

function applyOracleSelfDebuff(game, debuffId) {
  const runtime = ensureAncestorRuntime(game);
  if (!hasActiveHook(runtime, "cursed_oracle_nyssa_reflect_debuffs")) return;
  if (debuffId === "freeze" || debuffId === "stun") {
    game.applyStatusToEntity?.('player', 'stun', {
      duration: 0.2,
      sourceType: 'ancestor_debuff'
    });
  } else if (debuffId === "slow") {
    game.applyStatusToEntity?.('player', 'slow', {
      duration: 2,
      magnitude: 0.8,
      sourceType: 'ancestor_debuff'
    });
    if (game.playerDebuffVFX?.slow) {
      game.playerDebuffVFX.slow.active = true;
      game.playerDebuffVFX.slow.until = Math.max(game.playerDebuffVFX.slow.until || 0, game.time + 2);
    }
  } else if (debuffId === "burn") {
    game.applyStatusToEntity?.('player', 'burn', {
      duration: 2,
      magnitude: 4,
      sourceType: 'ancestor_debuff',
      data: {
        damageModel: 'per_tick',
        reason: 'player_burn_tick'
      }
    });
    if (game.playerDebuffVFX?.burn) {
      game.playerDebuffVFX.burn.active = true;
      game.playerDebuffVFX.burn.until = Math.max(game.playerDebuffVFX.burn.until || 0, game.time + 2);
    }
  } else if (debuffId === "toxic") {
    game.applyStatusToEntity?.('player', 'weaken', {
      duration: 2,
      magnitude: 0.8,
      sourceType: 'ancestor_debuff'
    });
    if (game.playerDebuffVFX?.weaken) {
      game.playerDebuffVFX.weaken.active = true;
      game.playerDebuffVFX.weaken.until = Math.max(game.playerDebuffVFX.weaken.until || 0, game.time + 2);
    }
  } else if (debuffId === "bleed" || debuffId === "vulnerability" || debuffId === "weaken" || debuffId === "void") {
    game.applyStatusToEntity?.('player', 'weakening', {
      duration: 2,
      magnitude: 0.9,
      sourceType: 'ancestor_debuff'
    });
    if (game.playerDebuffVFX?.weakening) {
      game.playerDebuffVFX.weakening.active = true;
      game.playerDebuffVFX.weakening.until = Math.max(game.playerDebuffVFX.weakening.until || 0, game.time + 2);
    }
  }

  if (hasActiveHook(runtime, "martyr_saint_varkos_on_debuff_gain_damage")) {
    runtime.martyrUntil = Math.max(runtime.martyrUntil || 0, game.time + 5);
    refreshDerivedSpiritModifiers(game);
  }
}

export function mirrorAncestorDebuffToPlayer(game, debuffId) {
  applyOracleSelfDebuff(game, debuffId);
}

function clearPlayerDebuffs(game) {
  let removed = 0;
  const now = game.time || 0;
  if ((game.playerWeakenUntil || 0) > now) {
    removed += 1;
    game.removeStatusFromEntity?.('player', 'weakening');
    if (game.playerDebuffVFX?.weakening) {
      game.playerDebuffVFX.weakening.active = false;
      game.playerDebuffVFX.weakening.until = 0;
    }
  }
  if ((game.playerSlowUntil || 0) > now) {
    removed += 1;
    game.removeStatusFromEntity?.('player', 'slow');
    if (game.playerDebuffVFX?.slow) {
      game.playerDebuffVFX.slow.active = false;
      game.playerDebuffVFX.slow.until = 0;
    }
  }
  if ((game.playerBurnUntil || 0) > now) {
    removed += 1;
    game.removeStatusFromEntity?.('player', 'burn');
    game.playerBurnAccum = 0;
    if (game.playerDebuffVFX?.burn) {
      game.playerDebuffVFX.burn.active = false;
      game.playerDebuffVFX.burn.until = 0;
      game.playerDebuffVFX.burn.emberTimer = 0;
    }
  }
  if ((game.playerCursedWeakenUntil || 0) > now) {
    removed += 1;
    game.removeStatusFromEntity?.('player', 'weaken');
    if (game.playerDebuffVFX?.weaken) {
      game.playerDebuffVFX.weaken.active = false;
      game.playerDebuffVFX.weaken.until = 0;
      game.playerDebuffVFX.weaken.crackTimer = 0;
    }
  }
  if (game.statusManager?.hasStatus?.('player', 'stun')) {
    removed += 1;
    game.removeStatusFromEntity?.('player', 'stun');
    if (game.playerDebuffVFX?.stun) {
      game.playerDebuffVFX.stun.active = false;
      game.playerDebuffVFX.stun.until = 0;
    }
  }
  return removed;
}

function estimateCurrentAttackSpeedBonus(game, runtime) {
  let bonus = 0;
  bonus += (game.equipmentAttackSpeedMult || 1) - 1;
  bonus += (game.talentAttackSpeedMult || 1) - 1;
  if (typeof game.getAttackUpgradeValue === "function") {
    bonus += game.getAttackUpgradeValue("attackSpeed") || 0;
  }
  if ((game.frenzyBuffUntil || 0) > game.time) bonus += 0.3;

  const allSpiritMods = [
    ...(runtime.staticMods || []),
    ...(runtime.tempMods || [])
  ];
  for (const mod of allSpiritMods) {
    if (!mod || mod.statKey !== "attackSpeed") continue;
    const value = Number(mod.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!mod.appliesTo || matchesTagFilter(MELEE_TAGS, mod.appliesTo)) bonus += value;
  }
  return Math.max(0, bonus);
}

function refreshDerivedSpiritModifiers(game) {
  const runtime = ensureAncestorRuntime(game);
  const tempMods = [];
  const dynamicMods = [];

  if (runtime.hasBerserkHook && runtime.berserkUntil > game.time) {
    tempMods.push({
      id: "ancestor_berserk_as",
      label: "Berserk Attack Speed",
      statKey: "attackSpeed",
      value: 0.20,
      appliesTo: { tagsAny: ["melee"] }
    });
  }

  if (runtime.hasTyrantHook) {
    const speedBonus = estimateCurrentAttackSpeedBonus(game, runtime);
    const steps = Math.floor((speedBonus * 100) / 2);
    const value = Math.max(0, steps / 100);
    if (value > 0) {
      dynamicMods.push({
        id: "attackDamagePct",
        label: "Attack Damage",
        statKey: "skillDamage",
        value
      });
    }
  }

  const swiftCount = getSwiftCount(game);
  if (swiftCount >= 2 && runtime.swiftTempoStacks > 0 && runtime.swiftTempoUntil > game.time) {
    tempMods.push({
      id: "swiftTempoAttackSpeedPct",
      label: "Swift Tempo",
      statKey: "attackSpeed",
      value: runtime.swiftTempoStacks * 0.02
    });
  }

  if (runtime.skirmisherKargUntil > game.time) {
    tempMods.push({
      id: "skirmisherKargMeleeDamagePct",
      label: "Skirmisher Karg",
      statKey: "skillDamage",
      value: 0.2,
      appliesTo: { tagsAny: ["melee"] }
    });
  }

  if (runtime.huntmasterVelUntil > game.time) {
    tempMods.push({
      id: "huntmasterVelRangedDamagePct",
      label: "Huntmaster Vel",
      statKey: "skillDamage",
      value: 0.2,
      appliesTo: { tagsAny: ["ranged"] }
    });
  }

  const battleShamanStacks = pruneExpiries(runtime.battleShamanExpiries, game.time).length;
  runtime.battleShamanExpiries = pruneExpiries(runtime.battleShamanExpiries, game.time);
  if (battleShamanStacks > 0) {
    tempMods.push({
      id: "battleShamanMeleeDamagePct",
      label: "Battle Shaman Gorr",
      statKey: "skillDamage",
      value: battleShamanStacks * 0.10,
      appliesTo: { tagsAny: ["melee"] }
    });
  }

  if (runtime.wreckerUntil > game.time) {
    tempMods.push({
      id: "wreckerDroganMeleeDamagePct",
      label: "Wrecker Drogan",
      statKey: "skillDamage",
      value: 0.15,
      appliesTo: { tagsAny: ["melee"] }
    });
  }

  if (runtime.kestUntil > game.time) {
    tempMods.push({
      id: "treasureHunterKestRangedDamagePct",
      label: "Treasure Hunter Kest",
      statKey: "skillDamage",
      value: 0.15,
      appliesTo: { tagsAny: ["ranged"] }
    });
  }

  if (runtime.martyrUntil > game.time) {
    tempMods.push({
      id: "attackDamagePct",
      label: "Martyr Saint Varkos",
      statKey: "skillDamage",
      value: 0.2
    });
  }

  if ((game.time - (runtime.lastPlayerDamageTime || 0)) >= 10) {
    if (hasActiveHook(runtime, "untouched_champion_ardyn_no_hit_buff")) {
      tempMods.push({
        id: "attackDamagePct",
        label: "Untouched Champion Ardyn",
        statKey: "skillDamage",
        value: 0.2
      });
    }
    if (hasActiveHook(runtime, "windrunner_selis_no_hit_speed_cdr")) {
      tempMods.push({
        id: "windrunnerSelisUtilityCdr",
        label: "Windrunner Selis",
        statKey: "cooldownRecovery",
        value: 0.1,
        appliesTo: { tagsAny: ["utility"] }
      });
    }
  }

  runtime.tempMods = tempMods;
  runtime.dynamicMods = dynamicMods;
  game.activeAncestorModifiers = [...(runtime.staticMods || []), ...tempMods, ...dynamicMods];
  game.activeSpiritModifiers = game.activeAncestorModifiers;
  game._skillMultiplierCacheTime = null;
  if (game._skillMultiplierCache?.clear) game._skillMultiplierCache.clear();
}

export function recomputeAncestorState(game) {
  ensureRunInventoryState(game);
  normalizeAllEquipmentVessels(game);
  const runtime = ensureAncestorRuntime(game);

  const activeSpirits = [];
  const clanCounts = {};
  const staticMods = [];
  const hooks = {
    onEquip: [],
    onUnequip: [],
    onHit: [],
    onPlayerDamaged: [],
    onTick: []
  };
  let hasBerserkHook = false;
  let hasTyrantHook = false;
  const activeHookIds = new Set();

  for (const slot of Object.keys(game?.equipment || {})) {
    const item = game.equipment[slot];
    if (!item) continue;
    ensureItemVessels(item);
    for (let i = 0; i < (item.vessels || []).length; i++) {
      const vessel = item.vessels[i];
      if (!vessel?.spiritId) continue;
      const spirit = game.runInventory.ancestorSpiritRegistry[vessel.spiritId];
      if (!spirit) {
        item.vessels[i] = null;
        continue;
      }
      const def = ANCESTOR_SPIRIT_DEFS[spirit.defId];
      if (!def) {
        item.vessels[i] = null;
        continue;
      }
      activeSpirits.push({ spirit, def, slot });
      for (const clan of def.clans || []) {
        clanCounts[clan] = (clanCounts[clan] || 0) + 1;
      }
      for (const mod of def.effects?.staticMods || []) {
        staticMods.push({ ...mod });
      }
      const spiritHooks = def.effects?.hooks || {};
      for (const key of Object.keys(hooks)) {
        if (!spiritHooks[key]) continue;
        activeHookIds.add(spiritHooks[key]);
        hooks[key].push({
          hookId: spiritHooks[key],
          spiritId: spirit.id,
          spiritDefId: def.id
        });
      }
      if (spiritHooks.onPlayerDamaged === "savage_berserk_on_player_damaged") hasBerserkHook = true;
      if (spiritHooks.onTick === "savage_tyrant_dynamic_attack_damage") hasTyrantHook = true;
    }
  }

  runtime.activeSpirits = activeSpirits;
  runtime.staticMods = staticMods;
  runtime.clanCounts = clanCounts;
  runtime.clanBonusIds = computeClanState(clanCounts);
  runtime.hooks = hooks;
  runtime.activeHookIds = activeHookIds;
  runtime.hasBerserkHook = hasBerserkHook;
  runtime.hasTyrantHook = hasTyrantHook;
  if (!hasBerserkHook) runtime.berserkUntil = 0;
  if (!hasActiveHook(runtime, "skirmisher_karg_ranged_hit_grants_melee_damage")) runtime.skirmisherKargUntil = 0;
  if (!hasActiveHook(runtime, "huntmaster_vel_melee_hit_grants_ranged_damage")) runtime.huntmasterVelUntil = 0;
  if (!hasActiveHook(runtime, "battle_shaman_gorr_skill_cast_melee_damage")) runtime.battleShamanExpiries = [];
  if (!hasActiveHook(runtime, "wrecker_drogan_break_melee_damage")) runtime.wreckerUntil = 0;
  if (!hasActiveHook(runtime, "treasure_hunter_kest_chest_ranged_damage")) runtime.kestUntil = 0;
  if (!hasActiveHook(runtime, "tinker_jack_handy_stacks")) runtime.handyExpiries = [];
  if (!hasActiveHook(runtime, "martyr_saint_varkos_on_debuff_gain_damage")) runtime.martyrUntil = 0;
  if (!hasActiveHook(runtime, "survivor_kade_on_damage_speed")) runtime.survivorUntil = 0;
  if (!hasActiveHook(runtime, "last_stand_warlord_draven_low_life_refresh")) runtime.dravenIcdUntil = 0;
  if (!hasActiveHook(runtime, "chronomancer_ishtar_cdr_to_dash")) runtime.chronomancerIcdUntil = 0;
  if (getSwiftCount(game) < 2) {
    runtime.swiftTempoStacks = 0;
    runtime.swiftTempoUntil = 0;
  }
  if (getBulwarkCount(game) < 2) {
    runtime.bulwarkRegenDps = 0;
    runtime.bulwarkRegenUntil = 0;
    runtime.bulwarkRegenAccum = 0;
    runtime.bulwarkSecondWindIcdUntil = 0;
  }

  game.activeAncestorSpirits = activeSpirits;
  game.activeClanCounts = { ...clanCounts };
  game.activeClanBonusIds = [...runtime.clanBonusIds];
  refreshDerivedSpiritModifiers(game);
}

export function tickAncestorSystem(game, dt) {
  const runtime = ensureAncestorRuntime(game);
  if (!runtime.activeSpirits?.length && !runtime.hasTyrantHook) return;
  let shouldRefresh = false;

  if (runtime.swiftTempoStacks > 0 && runtime.swiftTempoUntil <= game.time) {
    runtime.swiftTempoStacks = 0;
    runtime.swiftTempoUntil = 0;
    shouldRefresh = true;
  }

  if (runtime.bulwarkRegenUntil > game.time && runtime.bulwarkRegenDps > 0) {
    runtime.bulwarkRegenAccum = (runtime.bulwarkRegenAccum || 0) + dt;
    while (runtime.bulwarkRegenAccum >= 0.25 && runtime.bulwarkRegenUntil > game.time) {
      runtime.bulwarkRegenAccum -= 0.25;
      const heal = Math.max(1, Math.round(runtime.bulwarkRegenDps * 0.25));
      if (typeof game.healPlayer === "function") game.healPlayer(heal);
    }
  } else if (runtime.bulwarkRegenDps > 0 || runtime.bulwarkRegenUntil > 0) {
    runtime.bulwarkRegenDps = 0;
    runtime.bulwarkRegenUntil = 0;
    runtime.bulwarkRegenAccum = 0;
  }

  const beforeBattleStacks = runtime.battleShamanExpiries?.length || 0;
  runtime.battleShamanExpiries = pruneExpiries(runtime.battleShamanExpiries, game.time);
  if ((runtime.battleShamanExpiries?.length || 0) !== beforeBattleStacks) shouldRefresh = true;

  const beforeHandy = runtime.handyExpiries?.length || 0;
  runtime.handyExpiries = pruneExpiries(runtime.handyExpiries, game.time);
  if ((runtime.handyExpiries?.length || 0) !== beforeHandy) shouldRefresh = true;

  if (runtime.skirmisherKargUntil > 0 && runtime.skirmisherKargUntil <= game.time) shouldRefresh = true;
  if (runtime.huntmasterVelUntil > 0 && runtime.huntmasterVelUntil <= game.time) shouldRefresh = true;
  if (runtime.wreckerUntil > 0 && runtime.wreckerUntil <= game.time) shouldRefresh = true;
  if (runtime.kestUntil > 0 && runtime.kestUntil <= game.time) shouldRefresh = true;
  if (runtime.martyrUntil > 0 && runtime.martyrUntil <= game.time) shouldRefresh = true;

  if (hasActiveHook(runtime, "cursed_oracle_nyssa_debuff_expiry")) {
    const extra = dt * 0.5;
    if (game.playerWeakenUntil > game.time) game.adjustStatusDuration?.('player', 'weakening', -extra);
    if (game.playerSlowUntil > game.time) game.adjustStatusDuration?.('player', 'slow', -extra);
    if (game.playerBurnUntil > game.time) game.adjustStatusDuration?.('player', 'burn', -extra);
    if (game.playerCursedWeakenUntil > game.time) game.adjustStatusDuration?.('player', 'weaken', -extra);
    if (game.statusManager?.hasStatus?.('player', 'stun')) game.adjustStatusDuration?.('player', 'stun', -extra);
  }

  const hadBerserk = (runtime.tempMods || []).some((mod) => mod?.id === "ancestor_berserk_as");
  const shouldHaveBerserk = runtime.hasBerserkHook && runtime.berserkUntil > game.time;
  if (hadBerserk !== shouldHaveBerserk || runtime.hasTyrantHook || shouldRefresh) {
    refreshDerivedSpiritModifiers(game);
  }
}

export function handleAncestorOnPlayerDamaged(game, info = {}) {
  const runtime = ensureAncestorRuntime(game);
  if ((info.effectiveDamage || 0) <= 0) return;
  runtime.lastPlayerDamageTime = game.time;

  let shouldRefresh = false;
  if (runtime.hasBerserkHook) {
    runtime.berserkUntil = Math.max(runtime.berserkUntil || 0, game.time + 5);
    shouldRefresh = true;
  }

  const bulwarkCount = getBulwarkCount(game);
  if (bulwarkCount >= 2 && game.time >= (runtime.bulwarkSecondWindIcdUntil || 0)) {
    runtime.bulwarkSecondWindIcdUntil = game.time + 3;
    runtime.bulwarkRegenDps = Math.max(0, Number(info.effectiveDamage) * 0.10);
    runtime.bulwarkRegenUntil = game.time + 3;
    runtime.bulwarkRegenAccum = 0;
  }
  if (bulwarkCount >= 4) {
    const removedCount = clearPlayerDebuffs(game);
    if (removedCount > 0) {
      const heal = Math.max(1, Math.round((game.currentStats?.maxHealth || 0) * 0.10 * removedCount));
      if (typeof game.healPlayer === "function") game.healPlayer(heal);
    }
  }

  if (hasActiveHook(runtime, "survivor_kade_on_damage_speed")) {
    runtime.survivorUntil = game.time + 0.5;
  }

  if (hasActiveHook(runtime, "earthshaker_torv_on_damage_shockwave")) {
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const targets = game.enemiesInRadius(px, py, 120);
    for (const enemy of targets) {
      if (!enemy || enemy.isDead) continue;
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const dx = ex - px;
      const dy = ey - py;
      const dist = Math.hypot(dx, dy) || 1;
      const push = 45;
      enemy.position.x += (dx / dist) * push;
      enemy.position.y += (dy / dist) * push;
      game.applyStatusToEntity?.(enemy.id, 'stun', {
        duration: 0.2,
        sourceType: 'ancestor_effect'
      });
    }
  }

  if (hasActiveHook(runtime, "thornlord_bram_reflect") && info.fromEnemy && game.lastDamagingEnemy && !game.lastDamagingEnemy.isDead) {
    const thornDmg = Math.max(1, Math.round((game.currentStats?.maxHealth || 0) * 0.05));
    game.dealDamageToEnemy(game.lastDamagingEnemy, thornDmg, { isDot: true, isSkill: true });
  }

  if (hasActiveHook(runtime, "last_stand_warlord_draven_low_life_refresh")) {
    const projectedHp = Math.max(0, (game.currentHealth || 0) - (info.effectiveDamage || 0));
    const threshold = (game.currentStats?.maxHealth || 0) * 0.5;
    if (projectedHp <= threshold && (runtime.dravenIcdUntil || 0) <= game.time) {
      runtime.dravenIcdUntil = game.time + 40;
      game.dashCooldown = 0;
      for (let i = 0; i < (game.skillCooldowns || []).length; i++) game.skillCooldowns[i] = 0;
      if (typeof game.updateDashUI === "function") game.updateDashUI();
    }
  }

  if (shouldRefresh || hasActiveHook(runtime, "survivor_kade_on_damage_speed") || hasActiveHook(runtime, "last_stand_warlord_draven_low_life_refresh")) {
    refreshDerivedSpiritModifiers(game);
  }
}

function getSavageCount(game) {
  return game.activeClanCounts?.savage || 0;
}

function applyAncestorStackDelta(game, target, stackId, delta, options = {}) {
  if (!target) return null;
  if (typeof game?.applyStackDelta === "function") {
    return game.applyStackDelta(target, stackId, delta, options);
  }
  const stackKey = String(options.stackKey || stackId || "");
  if (!stackKey) return null;
  const mode = options.mode || "add";
  const min = Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
  const max = Number.isFinite(Number(options.max)) ? Number(options.max) : null;
  const before = Number(target[stackKey]) || 0;
  let next = before;
  if (mode === "set") {
    next = Number(delta) || 0;
  } else if (mode === "remove") {
    next = before - Math.abs(Number(delta) || 0);
  } else {
    next = before + (Number(delta) || 0);
  }
  next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  target[stackKey] = next;
  return { applied: true, before, after: next, deltaApplied: next - before };
}

function applySavageBleed(game, enemy, hitDamage) {
  if (!enemy || enemy.isDead) return false;
  const savageCount = getSavageCount(game);
  if (savageCount < 2) return false;

  const stackAllowed = savageCount >= 4;
  const perStackDps = Math.max(0, (0.20 * Math.max(0, hitDamage)) / 2);

  if (!stackAllowed) {
    applyAncestorStackDelta(game, enemy, "enemy.bleed", 1, {
      stackKey: "bleedStacks",
      targetType: "enemy",
      source: "ancestor_savage_bleed",
      reason: "savage_bleed_apply",
      mode: "set",
      min: 0,
      max: 1
    });
    enemy.bleedDps = perStackDps;
  } else {
    const stacks = Math.max(0, enemy.bleedStacks || 0);
    if (stacks < 100) {
      applyAncestorStackDelta(game, enemy, "enemy.bleed", 1, {
        stackKey: "bleedStacks",
        targetType: "enemy",
        source: "ancestor_savage_bleed",
        reason: "savage_bleed_stack",
        mode: "add",
        min: 0,
        max: 100
      });
      enemy.bleedDps = (enemy.bleedDps || 0) + perStackDps;
    } else {
      applyAncestorStackDelta(game, enemy, "enemy.bleed", 100, {
        stackKey: "bleedStacks",
        targetType: "enemy",
        source: "ancestor_savage_bleed",
        reason: "savage_bleed_cap",
        mode: "set",
        min: 0,
        max: 100
      });
      enemy.bleedDps = Math.max(enemy.bleedDps || 0, perStackDps * 100);
    }
  }

  enemy.bleedTimer = 2.0;
  enemy.bleedAccum = 0;
  return true;
}

export function handleAncestorOnMeleeHit(game, enemy, hitDamage) {
  applySavageBleed(game, enemy, hitDamage);
}

export function handleAncestorOnHit(game, info = {}) {
  const runtime = ensureAncestorRuntime(game);
  const enemy = info.enemy;
  const hitDamage = Math.max(0, Number(info.hitDamage) || 0);
  const isMeleeHit = !!info.isMeleeHit;
  const isRangedHit = info.isRangedHit != null ? !!info.isRangedHit : !isMeleeHit;
  const swiftCount = getSwiftCount(game);
  let changed = false;
  if (swiftCount >= 2) {
    const maxStacks = swiftCount >= 4 ? 30 : 10;
    const nextStacks = Math.min(maxStacks, (runtime.swiftTempoStacks || 0) + 1);
    if (nextStacks !== runtime.swiftTempoStacks || runtime.swiftTempoUntil <= game.time) changed = true;
    runtime.swiftTempoStacks = nextStacks;
    runtime.swiftTempoUntil = game.time + 2;
  }

  if (isRangedHit && hasActiveHook(runtime, "skirmisher_karg_ranged_hit_grants_melee_damage")) {
    runtime.skirmisherKargUntil = Math.max(runtime.skirmisherKargUntil || 0, game.time + 2);
    changed = true;
  }
  if (isMeleeHit && hasActiveHook(runtime, "huntmaster_vel_melee_hit_grants_ranged_damage")) {
    runtime.huntmasterVelUntil = Math.max(runtime.huntmasterVelUntil || 0, game.time + 3);
    changed = true;
  }
  if (isRangedHit && hasActiveHook(runtime, "frost_archer_lyra_ranged_freeze") && enemy && !enemy.isDead) {
    game.applyStatusToEntity?.(enemy.id, 'stun', {
      duration: 0.1,
      sourceType: 'ancestor_effect'
    });
  }
  if (isRangedHit && hasActiveHook(runtime, "warcaller_aresk_ranged_vulnerability") && enemy && !enemy.isDead) {
    applyAncestorStackDelta(game, enemy, "enemy.melee_vulnerability", 1, {
      stackKey: "meleeVulnStacks",
      targetType: "enemy",
      source: "ancestor_warcaller_aresk",
      reason: "ranged_vulnerability",
      mode: "add",
      min: 0,
      max: 15
    });
    enemy.meleeVulnUntil = game.time + 5;
  }
  if (isMeleeHit) {
    applySavageBleed(game, enemy, hitDamage);
  }
  if (changed) refreshDerivedSpiritModifiers(game);
}

export function handleAncestorOnSkillCast(game, slot) {
  const runtime = ensureAncestorRuntime(game);
  const arcanaCount = getArcanaCount(game);
  if (arcanaCount >= 2) {
    const reduction = arcanaCount >= 4 ? 0.6 : 0.3;
    reduceRandomSkillCooldown(game, reduction, slot);
    if (arcanaCount >= 4 && typeof game.healPlayer === "function") {
      game.healPlayer(5);
    }
  }

  if (hasActiveHook(runtime, "battle_shaman_gorr_skill_cast_melee_damage")) {
    runtime.battleShamanExpiries = addExpiryStack(runtime.battleShamanExpiries, game.time, 5, 3);
    refreshDerivedSpiritModifiers(game);
  }
}

export function tickEnemyBleed(game, enemy, dt) {
  if (!enemy || enemy.isDead) return;
  if (!Number.isFinite(enemy.bleedTimer) || enemy.bleedTimer <= 0 || !Number.isFinite(enemy.bleedDps) || enemy.bleedDps <= 0) {
    if (enemy.bleedTimer != null) {
      applyAncestorStackDelta(game, enemy, "enemy.bleed", 0, {
        stackKey: "bleedStacks",
        targetType: "enemy",
        source: "ancestor_bleed_tick",
        reason: "bleed_invalid_state_reset",
        mode: "set",
        min: 0,
        max: 100
      });
      enemy.bleedDps = 0;
      enemy.bleedTimer = 0;
      enemy.bleedAccum = 0;
    }
    return;
  }

  enemy.bleedTimer -= dt;
  enemy.bleedAccum = (enemy.bleedAccum || 0) + dt;
  while (enemy.bleedAccum >= 0.25 && enemy.bleedTimer > 0) {
    enemy.bleedAccum -= 0.25;
    const bleedDmg = Math.max(1, Math.round(enemy.bleedDps * 0.25));
    game.dealDamageToEnemy(enemy, bleedDmg, { isDot: true, isBleed: true });
  }

  if (enemy.bleedTimer <= 0) {
    applyAncestorStackDelta(game, enemy, "enemy.bleed", 0, {
      stackKey: "bleedStacks",
      targetType: "enemy",
      source: "ancestor_bleed_tick",
      reason: "bleed_expired_reset",
      mode: "set",
      min: 0,
      max: 100
    });
    enemy.bleedDps = 0;
    enemy.bleedTimer = 0;
    enemy.bleedAccum = 0;
  }
}

export function getAncestorMoveSpeedMult(game) {
  const runtime = ensureAncestorRuntime(game);
  let mult = 1;
  const swiftCount = getSwiftCount(game);
  if (swiftCount >= 4 && runtime.swiftTempoStacks > 0 && runtime.swiftTempoUntil > game.time) {
    mult *= 1 + runtime.swiftTempoStacks * 0.005;
  }
  if ((game.time - (runtime.lastPlayerDamageTime || 0)) >= 10) {
    if (hasActiveHook(runtime, "windrunner_selis_no_hit_speed_cdr")) mult *= 1.1;
    if (hasActiveHook(runtime, "survivor_kade_on_damage_speed") && runtime.survivorUntil > game.time) mult *= 1.4;
  } else if (hasActiveHook(runtime, "survivor_kade_on_damage_speed") && runtime.survivorUntil > game.time) {
    mult *= 1.4;
  }
  return mult;
}

export function getAncestorSearchSpeedMult(game, searchableProp) {
  const runtime = ensureAncestorRuntime(game);
  if (!searchableProp || searchableProp.typeId !== "chest") return 1;
  let mult = getHoarderCount(game) >= 2 ? 1.2 : 1;
  const handyStacks = pruneExpiries(runtime.handyExpiries, game.time).length;
  runtime.handyExpiries = pruneExpiries(runtime.handyExpiries, game.time);
  if (handyStacks > 0 && hasActiveHook(runtime, "tinker_jack_handy_stacks")) mult *= 1 + handyStacks * 0.01;
  if ((game.time - (runtime.lastPlayerDamageTime || 0)) >= 10 && hasActiveHook(runtime, "silent_thief_varro_no_hit_chest_speed")) {
    mult *= 1.3;
  }
  return mult;
}

export function getAncestorBreakableDamageMult(game) {
  return getHoarderCount(game) >= 4 ? 2 : 1;
}

export function getAncestorOutgoingDamageMult(game, enemy, info = {}) {
  const runtime = ensureAncestorRuntime(game);
  let mult = 1;
  if (hasActiveHook(runtime, "giant_slayer_rorn_vs_elites")) {
    const isEliteLike = !!(enemy?.enemyTier === "elite" || enemy?.enemyTier === "miniBoss" || enemy?.isElite || enemy?.isMiniBoss || enemy?.isBoss || enemy === game.enemySystem?.boss);
    if (isEliteLike) mult *= 1.2;
  }
  if (info.isMeleeHit && (enemy?.meleeVulnStacks || 0) > 0 && (enemy?.meleeVulnUntil || 0) > game.time) {
    mult *= 1 + (enemy.meleeVulnStacks * 0.01);
  }
  return mult;
}

export function getAncestorIncomingDamageMult(game) {
  const runtime = ensureAncestorRuntime(game);
  let mult = 1;
  if (runtime.conquerorGuardUntil > game.time && hasActiveHook(runtime, "conqueror_baelor_miniboss_kill_guard")) mult *= 0.8;
  if ((game.time - (runtime.lastPlayerDamageTime || 0)) >= 10 && hasActiveHook(runtime, "untouched_champion_ardyn_no_hit_buff")) mult *= 0.8;
  return mult;
}

export function handleAncestorOnEnemyKilled(game, enemy, info = {}) {
  const runtime = ensureAncestorRuntime(game);
  if (!enemy || !enemy.isDead) return;
  if (hasActiveHook(runtime, "conqueror_baelor_miniboss_kill_guard")) {
    const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian);
    if (isMiniBoss) runtime.conquerorGuardUntil = Math.max(runtime.conquerorGuardUntil || 0, game.time + 6);
  }
  if (hasActiveHook(runtime, "tinker_jack_handy_stacks")) {
    runtime.handyExpiries = addExpiryStack(runtime.handyExpiries, game.time, 10, 20);
  }
  if (hasActiveHook(runtime, "spell_reaver_talion_kill_cdr")) {
    reduceRandomSkillCooldown(game, 0.2, null);
  }
  if (hasActiveHook(runtime, "spirit_healer_alenya_skill_kill_heal") && info.isSkill && typeof game.healPlayer === "function") {
    const heal = Math.max(1, Math.round((game.currentStats?.maxHealth || 0) * 0.05));
    game.healPlayer(heal);
  }
  refreshDerivedSpiritModifiers(game);
}

export function handleAncestorOnLootPickup(game) {
  const runtime = ensureAncestorRuntime(game);
  if (hasActiveHook(runtime, "quartermaster_elra_loot_heal") && typeof game.healPlayer === "function") {
    const heal = Math.max(1, Math.round((game.currentStats?.maxHealth || 0) * 0.02));
    game.healPlayer(heal);
  }
  if (hasActiveHook(runtime, "scavenger_king_thalos_loot_shockwave")) {
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const dmg = Math.max(1, Math.round(game.currentStats?.attack || 1));
    const targets = game.enemiesInRadius(px, py, 110);
    for (const enemy of targets) {
      if (!enemy || enemy.isDead) continue;
      game.dealDamageToEnemy(enemy, dmg, { isSkill: true });
    }
  }
}

export function handleAncestorOnBreakableDestroyed(game) {
  const runtime = ensureAncestorRuntime(game);
  let changed = false;
  if (hasActiveHook(runtime, "wrecker_drogan_break_melee_damage")) {
    runtime.wreckerUntil = Math.max(runtime.wreckerUntil || 0, game.time + 5);
    changed = true;
  }
  if (hasActiveHook(runtime, "tomb_raider_myra_break_heal_dash")) {
    if (typeof game.healPlayer === "function") game.healPlayer(5);
    game.dashCooldown = 0;
    if (typeof game.updateDashUI === "function") game.updateDashUI();
  }
  if (changed) refreshDerivedSpiritModifiers(game);
}

export function handleAncestorOnChestOpened(game) {
  const runtime = ensureAncestorRuntime(game);
  let changed = false;
  if (hasActiveHook(runtime, "arcane_treasurer_solon_chest_cdr")) {
    reduceRandomSkillCooldown(game, 4, null);
  }
  if (hasActiveHook(runtime, "treasure_hunter_kest_chest_ranged_damage")) {
    runtime.kestUntil = Math.max(runtime.kestUntil || 0, game.time + 3);
    changed = true;
  }
  if (changed) refreshDerivedSpiritModifiers(game);
}

export function notifyAncestorDebuffApplied(game) {
  const runtime = ensureAncestorRuntime(game);
  if (!hasActiveHook(runtime, "martyr_saint_varkos_on_debuff_gain_damage")) return;
  runtime.martyrUntil = Math.max(runtime.martyrUntil || 0, game.time + 5);
  refreshDerivedSpiritModifiers(game);
}

export function getSkillFlatDamageBonus(game, skillId) {
  if (!skillId) return 0;
  const ctx = buildSkillContext(skillId);
  const allMods = [];
  for (const slot of Object.keys(game?.equipment || {})) {
    const item = game.equipment[slot];
    if (!item || !Array.isArray(item.modifiers)) continue;
    for (const mod of item.modifiers) allMods.push(mod);
  }
  for (const mod of game.activeAncestorModifiers || []) allMods.push(mod);
  for (const mod of game.activeSkillTagModifiers || []) allMods.push(mod);
  for (const mod of game.talentSkillTagModifiers || []) allMods.push(mod);
  for (const mod of game.enemySkillTagModifiers || []) allMods.push(mod);
  for (const mod of game.activeEnemySkillTagModifiers || []) allMods.push(mod);

  let total = 0;
  for (const mod of allMods) {
    if (!mod) continue;
    if (!(mod.id === "meleeFlatDamage" || mod.statKey === "flatDamage")) continue;
    const value = Number(mod.value);
    if (!Number.isFinite(value) || value === 0) continue;
    if (!matchesTagFilter(ctx.tagsSet, mod.appliesTo)) continue;
    total += value;
  }
  return total;
}

export function addVesselSlotToItem(item) {
  if (!item) return { ok: false, reason: "No item selected." };
  ensureItemVessels(item);
  const rarity = String(item.rarity || "common").toLowerCase();
  const cap = getVesselCapForRarity(rarity);
  if (cap <= 0) return { ok: false, reason: "Common items cannot have vessels." };
  if (item.vesselsMax >= cap) return { ok: false, reason: `Item is already at vessel cap (${cap}).` };
  item.vesselsMax += 1;
  item.vessels = item.vessels || [];
  item.vessels.push(null);
  return { ok: true, reason: "Vessel slot added." };
}

export function socketSpiritIntoItemVessel(game, item, vesselIndex, spiritId) {
  ensureRunInventoryState(game);
  ensureItemVessels(item);
  if (!item || !Array.isArray(item.vessels)) return { ok: false, reason: "Item has no vessel slots." };
  if (vesselIndex < 0 || vesselIndex >= item.vessels.length) return { ok: false, reason: "Invalid vessel slot." };
  if (item.vessels[vesselIndex]) return { ok: false, reason: "Vessel slot is already occupied." };

  const spirits = game.runInventory.ancestorSpirits || [];
  const idx = spirits.findIndex((s) => s?.id === spiritId);
  if (idx < 0) return { ok: false, reason: "Selected spirit is not in inventory." };
  const spirit = spirits[idx];
  spirits.splice(idx, 1);
  game.runInventory.ancestorSpiritRegistry[spirit.id] = spirit;
  item.vessels[vesselIndex] = { spiritId: spirit.id };
  recomputeAncestorState(game);
  return { ok: true, reason: "Spirit resonating." };
}

export function removeSpiritFromItemVessel(game, item, vesselIndex) {
  ensureRunInventoryState(game);
  ensureItemVessels(item);
  if (!item || !Array.isArray(item.vessels)) return { ok: false, reason: "Item has no vessel slots." };
  if (vesselIndex < 0 || vesselIndex >= item.vessels.length) return { ok: false, reason: "Invalid vessel slot." };
  const entry = item.vessels[vesselIndex];
  if (!entry?.spiritId) return { ok: false, reason: "Vessel slot is already empty." };
  const spirit = game.runInventory.ancestorSpiritRegistry[entry.spiritId];
  if (spirit) {
    game.runInventory.ancestorSpirits.push(spirit);
  }
  item.vessels[vesselIndex] = null;
  recomputeAncestorState(game);
  return { ok: true, reason: "Spirit removed." };
}

export function createAncestorSpiritLootDef(defId) {
  const def = getAncestorSpiritDef(defId);
  if (!def) return null;
  return {
    type: "Ancestor Spirit",
    name: def.name,
    rarity: def.rarity,
    spiritDefId: def.id,
    clans: [...(def.clans || [])],
    description: def.description || ""
  };
}

export function rollRandomAncestorSpiritLootDef(rng = Math.random) {
  const defId = pickRandomAncestorSpiritDefId(rng);
  if (!defId) return null;
  return createAncestorSpiritLootDef(defId);
}

export function rollRandomAncestorSpiritLootDefByRarity(rarity, rng = Math.random) {
  const defId = pickRandomAncestorSpiritDefIdByRarity(rarity, rng);
  if (!defId) return null;
  return createAncestorSpiritLootDef(defId);
}

export function grantSpirit(game, defId) {
  ensureRunInventoryState(game);
  const spirit = createSpiritItem(defId);
  if (!spirit) return null;
  game.runInventory.ancestorSpiritRegistry[spirit.id] = spirit;
  game.runInventory.ancestorSpirits.push(spirit);
  if (typeof game.populateInventoryOverlay === "function" && game.inventoryOverlayOpen) {
    game.populateInventoryOverlay();
  }
  return spirit;
}

export function grantVesselCube(game) {
  if (!game?.cubeInventory) game.cubeInventory = {};
  game.cubeInventory.vesselCubeT1 = (game.cubeInventory.vesselCubeT1 || 0) + 1;
  if (typeof game.populateInventoryOverlay === "function" && game.inventoryOverlayOpen) {
    game.populateInventoryOverlay();
  }
}

export function printActiveSpiritsAndClans(game) {
  const active = (game.activeAncestorSpirits || []).map((row) => ({
    spiritId: row.spirit.id,
    defId: row.spirit.defId,
    rarity: row.spirit.rarity,
    clans: (row.spirit.clans || []).join(", ")
  }));
  const summary = {
    activeSpirits: active,
    clanCounts: { ...(game.activeClanCounts || {}) },
    clanBonuses: [...(game.activeClanBonusIds || [])],
    activeModifiers: [...(game.activeAncestorModifiers || [])]
  };
  console.log("[AncestorSpirit]", summary);
  return summary;
}
