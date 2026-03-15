import { addLegacyVaultItem } from "../ui/save-system.js";
import { RING_BALANCE } from "../data/rings-data.js";
import { PlayerProjectile } from "../entities/projectile.js";

const WEIGHT_SLOTS = ["Helmet", "Body Armour", "Boots", "Weapon"];
const MIRROR_FANG_REPEAT_DELAY_SEC = 0.1;

function getRingSlotKeys(game) {
  if (typeof game?.getEffectiveEquipmentSlots === "function") {
    const slots = game.getEffectiveEquipmentSlots({ source: "ring_effects" }) || [];
    const keys = slots
      .filter((slot) => Array.isArray(slot?.allowedItemTypes) && slot.allowedItemTypes.includes("Ring"))
      .map((slot) => String(slot.key || ""))
      .filter(Boolean);
    if (keys.length > 0) {
      return keys;
    }
  }
  return Object.keys(game?.equipment || {}).filter((key) => {
    if (!key) return false;
    if (/^Ring\d+$/i.test(key)) return true;
    const item = game?.equipment?.[key];
    return item?.type === "Ring";
  });
}

function getRingItems(game) {
  const items = [];
  for (const slot of getRingSlotKeys(game)) {
    const item = game?.equipment?.[slot];
    if (item && !item._consumed) items.push(item);
  }
  return items;
}

function getRawRingCount(game, ringId) {
  if (!ringId) return 0;
  return getRingItems(game).filter((r) => r.ringId === ringId).length;
}

function getRingEffectMultiplier(game, ringId = null) {
  if (typeof game?.resolvePillarRingEffectMultiplier !== "function") {
    return 1;
  }
  const now = Number(game?.time) || 0;
  const signature = `${Array.isArray(game?.inventory) ? game.inventory.length : 0}|${Object.values(game?.equipment || {}).filter((item) => item?.type === "Ring").length}`;
  const cache = game.__ringEffectMultiplierCache;
  if (cache && cache.at === now && cache.signature === signature && Number.isFinite(cache.multiplier)) {
    return Math.max(0, cache.multiplier);
  }
  const resolved = game.resolvePillarRingEffectMultiplier({
    source: "ring_effects",
    ringId
  });
  const value = Number(resolved?.multiplier);
  const multiplier = Number.isFinite(value) ? Math.max(0, value) : 1;
  game.__ringEffectMultiplierCache = {
    at: now,
    signature,
    multiplier
  };
  return multiplier;
}

export function getRingCount(game, ringId) {
  const rawCount = getRawRingCount(game, ringId);
  if (rawCount <= 0) return 0;
  return rawCount * getRingEffectMultiplier(game, ringId);
}

export function hasRing(game, ringId) {
  return getRawRingCount(game, ringId) > 0;
}

export function getEquippedWeightTierState(game) {
  const weights = [];
  for (const slot of WEIGHT_SLOTS) {
    const item = game?.equipment?.[slot];
    if (!item || !item.weight) return "MIXED";
    weights.push(String(item.weight));
  }
  if (weights.every((w) => w === "light")) return "LIGHT_ONLY";
  if (weights.every((w) => w === "medium")) return "MEDIUM_ONLY";
  if (weights.every((w) => w === "heavy")) return "HEAVY_ONLY";
  return "MIXED";
}

export function ensureRingRuntime(game) {
  if (!game.ringRuntime) {
    game.ringRuntime = {
      trophyHunterUntil: 0,
      windstepUntil: 0,
      battleRhythmUntil: 0,
      momentumUntil: 0,
      sentinelActive: false,
      sentinelStillTime: 0,
      sentinelLastPos: null,
      renewalTimer: 0,
      conquerorKillCounter: 0,
      conquerorDefenseBonus: 0,
      ascendantStacks: 0,
      npcHealedIds: {},
      procLog: false,
      guardianTriggeredAt: 0,
      focusChargesSlot1: 1,
      focusChargesMaxSlot1: 1,
    };
  }
  return game.ringRuntime;
}

export function ringLog(game, message) {
  const state = ensureRingRuntime(game);
  if (!state.procLog) return;
  console.info(`[Ring] ${message}`);
}

export function setRingProcLogging(game, enabled) {
  const state = ensureRingRuntime(game);
  state.procLog = !!enabled;
}

export function consumeOneRing(game, ringId, reason = "") {
  for (const slot of getRingSlotKeys(game)) {
    const item = game?.equipment?.[slot];
    if (!item || item.ringId !== ringId) continue;
    game.equipment[slot] = null;
    ringLog(game, `Consumed ${item.name}${reason ? ` (${reason})` : ""}`);
    if (typeof game.recalculateStats === "function") game.recalculateStats();
    if (typeof game.updateEquippedUI === "function") game.updateEquippedUI();
    if (game.inventoryOverlayOpen && typeof game.populateInventoryOverlay === "function") game.populateInventoryOverlay();
    return item;
  }
  return null;
}

export function getRingDropRateMult(game) {
  const state = ensureRingRuntime(game);
  if (state.trophyHunterUntil > game.time) {
    return 1 + RING_BALANCE.TROPHY_HUNTER_BONUS * Math.max(0, getRingCount(game, "ring_trophy_hunter"));
  }
  return 1;
}

export function onRingLevelUp(game) {
  const state = ensureRingRuntime(game);
  const vitality = getRingCount(game, "ring_vitality");
  if (vitality > 0) {
    const heal = Math.round((game.currentStats.maxHealth || 0) * RING_BALANCE.LEVELUP_HEAL_PCT * vitality);
    if (heal > 0) game.healPlayer(heal);
    ringLog(game, `Vitality healed ${heal}`);
  }

  const ascendant = getRingCount(game, "ring_ascendant");
  if (ascendant > 0) {
    state.ascendantStacks += ascendant;
    ringLog(game, `Ascendant stacks: ${state.ascendantStacks}`);
  }

  const windstep = getRingCount(game, "ring_windstep");
  if (windstep > 0) {
    state.windstepUntil = Math.max(state.windstepUntil || 0, game.time + RING_BALANCE.LEVELUP_MS_DURATION);
    ringLog(game, "Windstep activated");
  }
}

export function onRingEnemyKilled(game, enemy) {
  const state = ensureRingRuntime(game);
  if (!enemy) return;
  const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isMiniBoss);
  if (isMiniBoss && hasRing(game, "ring_trophy_hunter")) {
    state.trophyHunterUntil = Math.max(state.trophyHunterUntil || 0, game.time + RING_BALANCE.TROPHY_HUNTER_DURATION);
    ringLog(game, "Trophy Hunter activated");
  }

  const conqueror = getRingCount(game, "ring_conqueror");
  if (conqueror > 0 && state.conquerorDefenseBonus < RING_BALANCE.CONQUEROR_DEF_MAX) {
    state.conquerorKillCounter += 1;
    while (
      state.conquerorKillCounter >= RING_BALANCE.CONQUEROR_KILLS_PER_DEF &&
      state.conquerorDefenseBonus < RING_BALANCE.CONQUEROR_DEF_MAX
    ) {
      state.conquerorKillCounter -= RING_BALANCE.CONQUEROR_KILLS_PER_DEF;
      state.conquerorDefenseBonus += 1;
      ringLog(game, `Conqueror defense bonus now +${state.conquerorDefenseBonus}`);
      if (typeof game.recalculateStats === "function") game.recalculateStats();
    }
  }
}

export function onRingBreakableDestroyed(game, breakable) {
  const shrapnel = getRingCount(game, "ring_shrapnel");
  if (shrapnel <= 0) return;
  const cx = game?.player?.position ? (game.player.position.x + game.player.size / 2) : (breakable.position.x + breakable.hitbox.w / 2);
  const cy = game?.player?.position ? (game.player.position.y + game.player.size / 2) : (breakable.position.y + breakable.hitbox.h / 2);
  const baseDamage = Math.max(1, Math.round((game.currentStats.attack || 1) * RING_BALANCE.SHRAPNEL_DAMAGE_MULT));
  const count = RING_BALANCE.SHRAPNEL_COUNT;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const tx = cx + Math.cos(angle) * 100;
    const ty = cy + Math.sin(angle) * 100;
    const proj = new PlayerProjectile(cx, cy, tx, ty, baseDamage, {
      speedMult: 1,
      maxDistMult: 0.45,
      piercesRemaining: 0,
      canSteer: false,
    });
    proj.maxLifetime = 0.7;
    game.playerProjectiles.push(proj);
  }
  ringLog(game, "Shrapnel burst triggered");
}

export function onRingNpcInteracted(game, obj) {
  const traveler = getRingCount(game, "ring_traveler");
  if (traveler <= 0 || !obj) return;
  const state = ensureRingRuntime(game);
  const id = String(obj.id ?? `${obj.type}:${obj.x}:${obj.y}`);
  if (state.npcHealedIds[id]) return;
  state.npcHealedIds[id] = true;
  game.healPlayer(20 * traveler);
  ringLog(game, `Traveler healed after NPC ${id}`);
}

export function onRingDashUsed(game) {
  const momentum = getRingCount(game, "ring_momentum");
  if (momentum > 0) {
    const state = ensureRingRuntime(game);
    state.momentumUntil = Math.max(state.momentumUntil || 0, game.time + RING_BALANCE.MOMENTUM_DURATION);
    ringLog(game, "Momentum activated");
  }
}

export function onRingSkillCooldownRestored(game, slot) {
  if (slot == null || slot < 0) return;
  const arcane = getRingCount(game, "ring_arcane_feedback");
  if (arcane > 0) {
    const other = [];
    for (let i = 0; i < (game.skillCooldowns?.length || 0); i++) {
      if (i !== slot && game.skills?.[i]) other.push(i);
    }
    if (other.length > 0) {
      const pick = other[Math.floor(Math.random() * other.length)];
      game.skillCooldowns[pick] = Math.max(0, (game.skillCooldowns[pick] || 0) - RING_BALANCE.COOLDOWN_FEEDBACK_REDUCTION * arcane);
      ringLog(game, `Arcane Feedback reduced slot ${pick + 1}`);
    }
  }

  const medics = getRingCount(game, "ring_medics");
  if (medics > 0) {
    game.healPlayer(RING_BALANCE.COOLDOWN_MEDIC_HEAL * medics);
    ringLog(game, `Medic healed ${RING_BALANCE.COOLDOWN_MEDIC_HEAL * medics}`);
  }
}

export function onRingExtraction(game) {
  if (!hasRing(game, "ring_archivist")) return;
  consumeOneRing(game, "ring_archivist", "extraction");
}

export function onRingDefeat(game) {
  if (!hasRing(game, "ring_heirloom")) return;
  let consumeSlot = null;
  for (const slot of getRingSlotKeys(game)) {
    if (game?.equipment?.[slot]?.ringId === "ring_heirloom") {
      consumeSlot = slot;
      break;
    }
  }
  const captured = [];
  for (const [slot, item] of Object.entries(game.equipment || {})) {
    if (!item) continue;
    if (slot === consumeSlot) continue;
    captured.push({ slot, item: JSON.parse(JSON.stringify(item)) });
  }

  for (const entry of captured) {
    addLegacyVaultItem(entry.item, "Heirloom Ring");
    game.equipment[entry.slot] = null;
  }

  if (consumeSlot) {
    game.equipment[consumeSlot] = null;
  } else {
    consumeOneRing(game, "ring_heirloom", "defeat");
  }
}

export function applyRingIncomingDamageMods(game, rawAmount, fromEnemy) {
  let dmg = Math.max(0, Number(rawAmount) || 0);
  const calming = getRingCount(game, "ring_calming");
  const sourceEnemy = game.lastDamagingEnemy;
  if (fromEnemy && calming > 0 && sourceEnemy && !sourceEnemy.isBoss && sourceEnemy.enemyTier !== "boss") {
    dmg *= Math.max(0, 1 - 0.2 * calming);
  }

  const stoneWard = getRingCount(game, "ring_stone_ward");
  if (stoneWard > 0) {
    dmg = Math.max(0, dmg - RING_BALANCE.STONE_WARD_FLAT_DR * stoneWard);
  }

  return Math.round(dmg);
}

export function onRingPlayerDamaged(game, effectiveDamage, fromEnemy = false) {
  if (effectiveDamage <= 0) return;

  if (hasRing(game, "ring_guardian")) {
    const hpPct = game.currentStats.maxHealth > 0 ? game.currentHealth / game.currentStats.maxHealth : 1;
    if (hpPct <= RING_BALANCE.GUARDIAN_THRESHOLD) {
      game.currentHealth = game.currentStats.maxHealth;
      consumeOneRing(game, "ring_guardian", "guardian trigger");
      ringLog(game, "Guardian restored to full");
      return;
    }
  }

  const thorn = getRingCount(game, "ring_thornbound");
  const sourceEnemy = game.lastDamagingEnemy;
  if (fromEnemy && thorn > 0 && sourceEnemy && !sourceEnemy.isDead) {
    const reflect = Math.max(1, Math.round((game.currentStats.attack || 1) * RING_BALANCE.REFLECT_MULT * thorn));
    game.dealDamageToEnemy(sourceEnemy, reflect, { isReflect: true, noRingProcs: true });
    ringLog(game, `Thornbound reflected ${reflect}`);
  }
}

export function tickRingEffects(game, dt) {
  const state = ensureRingRuntime(game);

  const renewal = getRingCount(game, "ring_renewal");
  if (renewal > 0) {
    state.renewalTimer += dt;
    if (state.renewalTimer >= RING_BALANCE.RENEWAL_INTERVAL) {
      state.renewalTimer = 0;
      const heal = Math.round((game.currentStats.maxHealth || 0) * RING_BALANCE.RENEWAL_HEAL_PCT * renewal);
      if (heal > 0) game.healPlayer(heal);
      ringLog(game, `Renewal healed ${heal}`);
    }
  } else {
    state.renewalTimer = 0;
  }

  const sentinelCount = getRingCount(game, "ring_sentinel");
  if (sentinelCount > 0) {
    const px = game.player.position.x;
    const py = game.player.position.y;
    const prev = state.sentinelLastPos || { x: px, y: py };
    const moved = Math.hypot(px - prev.x, py - prev.y) > 2;
    state.sentinelLastPos = { x: px, y: py };
    if (moved) {
      state.sentinelStillTime = 0;
      state.sentinelActive = false;
    } else {
      state.sentinelStillTime += dt;
      if (state.sentinelStillTime >= RING_BALANCE.STANDSTILL_TIME) {
        state.sentinelActive = true;
      }
    }
  } else {
    state.sentinelStillTime = 0;
    state.sentinelActive = false;
    state.sentinelLastPos = null;
  }
}

export function getRingTempBuffs(game) {
  const state = ensureRingRuntime(game);
  const buffs = [];
  if (state.trophyHunterUntil > game.time) buffs.push({ id: "ring_trophy_hunter", icon: "TH", name: "Trophy Hunter" });
  if (state.windstepUntil > game.time) buffs.push({ id: "ring_windstep", icon: "WS", name: "Windstep" });
  if (state.battleRhythmUntil > game.time) buffs.push({ id: "ring_battle_rhythm", icon: "BR", name: "Battle Rhythm" });
  if (state.sentinelActive) buffs.push({ id: "ring_sentinel", icon: "SE", name: "Sentinel" });
  if (state.momentumUntil > game.time) buffs.push({ id: "ring_momentum", icon: "MO", name: "Momentum" });
  return buffs;
}

export function getRingMoveSpeedMultiplier(game) {
  const state = ensureRingRuntime(game);
  let mult = 1;
  const windstep = getRingCount(game, "ring_windstep");
  if (state.windstepUntil > game.time && windstep > 0) mult *= 1 + RING_BALANCE.LEVELUP_MS_BONUS * windstep;
  const momentum = getRingCount(game, "ring_momentum");
  if (state.momentumUntil > game.time && momentum > 0) mult *= 1 + RING_BALANCE.MOMENTUM_MS_BONUS * momentum;
  const vanguard = getRingCount(game, "ring_vanguard");
  if (vanguard > 0 && getEquippedWeightTierState(game) === "MEDIUM_ONLY") mult *= 1 + 0.2 * vanguard;
  return mult;
}

export function getRingAttackSpeedMultiplier(game) {
  const state = ensureRingRuntime(game);
  let mult = 1;
  const battleRhythm = getRingCount(game, "ring_battle_rhythm");
  if (state.battleRhythmUntil > game.time && battleRhythm > 0) mult *= 1 + RING_BALANCE.BATTLE_RHYTHM_AS_BONUS * battleRhythm;
  const sentinel = getRingCount(game, "ring_sentinel");
  if (state.sentinelActive && sentinel > 0) mult *= 1 + RING_BALANCE.STANDSTILL_AS_BONUS * sentinel;
  const vanguard = getRingCount(game, "ring_vanguard");
  if (vanguard > 0 && getEquippedWeightTierState(game) === "MEDIUM_ONLY") mult *= 1 + 0.1 * vanguard;
  return mult;
}

export function getRingAttackDamageMultiplier(game) {
  const state = ensureRingRuntime(game);
  let mult = 1;
  if (state.ascendantStacks > 0) mult *= 1 + state.ascendantStacks * RING_BALANCE.LEVELUP_DAMAGE_BONUS;
  return mult;
}

export function getRingExtraDashCharges(game) {
  return Math.max(0, Math.floor(getRingCount(game, "ring_windrunner")));
}

export function getRingDashCooldownOffset(game) {
  const feather = getRingCount(game, "ring_featherstep");
  if (feather <= 0) return 0;
  if (getEquippedWeightTierState(game) !== "LIGHT_ONLY") return 0;
  return 0.2 * feather;
}

export function applyRingPassiveStatBonuses(game, stats) {
  const state = ensureRingRuntime(game);

  if (getRingCount(game, "ring_titan") > 0 && getEquippedWeightTierState(game) === "HEAVY_ONLY") {
    const titan = getRingCount(game, "ring_titan");
    stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + 0.4 * titan));
  }

  const bastion = getRingCount(game, "ring_bastion");
  if (bastion > 0) {
    const add = Math.floor((stats.defense || 0) / 3) * bastion;
    stats.attack = (stats.attack || 0) + add;
  }

  if (state.conquerorDefenseBonus > 0) {
    stats.defense = (stats.defense || 0) + state.conquerorDefenseBonus;
  }

  stats.attack = Math.round((stats.attack || 0) * getRingAttackDamageMultiplier(game));
}

export function tryProcBattleRhythm(game, isSkillHit) {
  if (!isSkillHit) return;
  const count = getRingCount(game, "ring_battle_rhythm");
  if (count <= 0) return;
  const whole = Math.floor(count);
  const fractional = count - whole;
  for (let i = 0; i < whole; i++) {
    if (Math.random() < RING_BALANCE.BATTLE_RHYTHM_PROC_CHANCE) {
      const state = ensureRingRuntime(game);
      state.battleRhythmUntil = Math.max(state.battleRhythmUntil || 0, game.time + RING_BALANCE.BATTLE_RHYTHM_DURATION);
      ringLog(game, "Battle Rhythm proc");
    }
  }
  if (fractional > 0 && Math.random() < fractional && Math.random() < RING_BALANCE.BATTLE_RHYTHM_PROC_CHANCE) {
    const state = ensureRingRuntime(game);
    state.battleRhythmUntil = Math.max(state.battleRhythmUntil || 0, game.time + RING_BALANCE.BATTLE_RHYTHM_DURATION);
    ringLog(game, "Battle Rhythm proc");
  }
}

export function getRingDamageMultiplierForHit(game, enemy, opts = {}) {
  let mult = 1;
  if (!enemy) return mult;
  const state = ensureRingRuntime(game);
  const sentinel = getRingCount(game, "ring_sentinel");
  if (state.sentinelActive && sentinel > 0) {
    mult *= 1 + RING_BALANCE.STANDSTILL_DMG_BONUS * sentinel;
  }

  const reaper = getRingCount(game, "ring_reaper");
  if (reaper > 0 && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= RING_BALANCE.REAPER_THRESHOLD) {
    mult *= Math.pow(RING_BALANCE.REAPER_DAMAGE_MULT, reaper);
  }

  const firstStrike = getRingCount(game, "ring_first_strike");
  if (firstStrike > 0 && enemy.health >= enemy.maxHealth) {
    mult *= Math.pow(RING_BALANCE.FIRST_STRIKE_DAMAGE_MULT, firstStrike);
  }

  if (!!opts.isDirectAttack && hasRing(game, "ring_executioner") && enemy.maxHealth > 0) {
    if ((enemy.health - (opts.previewDamage || 0)) / enemy.maxHealth <= RING_BALANCE.EXECUTE_THRESHOLD) {
      opts.forceExecute = true;
    }
  }

  return mult;
}

export function tryProcEchoEngine(game, enemy, opts = {}) {
  if (opts.noRingProcs || opts.isSkill || opts.isReflect || opts.echoProc) return;
  const count = getRingCount(game, "ring_echo_engine");
  if (count <= 0) return;
  const skillId = game.skills?.[0];
  if (!skillId) return;
  const whole = Math.floor(count);
  const fractional = count - whole;
  for (let i = 0; i < whole; i++) {
    if (Math.random() < RING_BALANCE.ECHO_ENGINE_PROC_CHANCE) {
      game.executeSkill(skillId, 0, {
        noCooldown: true,
        echoProc: true,
        ringProcDamageMult: RING_BALANCE.ECHO_ENGINE_DAMAGE_MULT
      });
      ringLog(game, "Echo Engine proc");
    }
  }
  if (fractional > 0 && Math.random() < fractional && Math.random() < RING_BALANCE.ECHO_ENGINE_PROC_CHANCE) {
    game.executeSkill(skillId, 0, {
      noCooldown: true,
      echoProc: true,
      ringProcDamageMult: RING_BALANCE.ECHO_ENGINE_DAMAGE_MULT
    });
    ringLog(game, "Echo Engine proc");
  }
}

export function tryProcMirrorFang(game, targetX, targetY, opts = {}) {
  if (opts.mirrorProc) return false;
  const count = getRingCount(game, "ring_mirror_fang");
  if (count <= 0) return false;
  let didProc = false;
  const whole = Math.floor(count);
  const fractional = count - whole;
  for (let i = 0; i < whole; i++) {
    if (Math.random() < RING_BALANCE.MIRROR_FANG_PROC) {
      game.delayedFireQueue = game.delayedFireQueue || [];
      game.delayedFireQueue.push({
        targetX,
        targetY,
        at: (game.time || 0) + MIRROR_FANG_REPEAT_DELAY_SEC,
        damageMult: opts.damageMult || 1,
        mirrorProc: true
      });
      didProc = true;
      ringLog(game, "Mirror Fang proc (delayed)");
    }
  }
  if (fractional > 0 && Math.random() < fractional && Math.random() < RING_BALANCE.MIRROR_FANG_PROC) {
    game.delayedFireQueue = game.delayedFireQueue || [];
    game.delayedFireQueue.push({
      targetX,
      targetY,
      at: (game.time || 0) + MIRROR_FANG_REPEAT_DELAY_SEC,
      damageMult: opts.damageMult || 1,
      mirrorProc: true
    });
    didProc = true;
    ringLog(game, "Mirror Fang proc (delayed)");
  }
  return didProc;
}

export function tryGuardianPreDeath(game) {
  if (!hasRing(game, "ring_guardian")) return false;
  consumeOneRing(game, "ring_guardian", "fatal damage");
  game.currentHealth = game.currentStats.maxHealth;
  return true;
}

export function syncFocusCharges(game) {
  const state = ensureRingRuntime(game);
  const extra = Math.floor(getRingCount(game, "ring_focus") * RING_BALANCE.FOCUS_EXTRA_CHARGE);
  const maxCharges = 1 + extra;
  state.focusChargesMaxSlot1 = maxCharges;
  if (!Number.isFinite(state.focusChargesSlot1) || state.focusChargesSlot1 > maxCharges) {
    state.focusChargesSlot1 = maxCharges;
  }
  if (state.focusChargesSlot1 < 1) state.focusChargesSlot1 = 1;
}

export function tryConsumeFocusCharge(game, slot) {
  if (slot !== 0) return false;
  const state = ensureRingRuntime(game);
  syncFocusCharges(game);
  if (state.focusChargesMaxSlot1 <= 1) return false;
  if (state.focusChargesSlot1 > 1) {
    state.focusChargesSlot1 -= 1;
    ringLog(game, `Focus charge consumed (${state.focusChargesSlot1}/${state.focusChargesMaxSlot1})`);
    return true;
  }
  return false;
}

export function onSkillReadyRefillFocus(game, slot) {
  if (slot !== 0) return;
  const state = ensureRingRuntime(game);
  syncFocusCharges(game);
  state.focusChargesSlot1 = state.focusChargesMaxSlot1;
}

export function handleHeirloomOnDefeat(game) {
  onRingDefeat(game);
}

export function handleArchivistOnExtraction(game) {
  onRingExtraction(game);
}

