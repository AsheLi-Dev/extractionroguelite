import { getAllBlessings } from '../data/pillars.js';

const PILLAR_RUNTIME_REFRESH_EVENT = 'pillars:runtime-refreshed';

const pillarEffectRegistry = new Map();

function createDefaultStatModifiers() {
  return {
    attackMultiplier: 1,
    attackFlat: 0,
    maxHealthMultiplier: 1,
    maxHealthFlat: 0,
    defenseMultiplier: 1,
    defenseFlat: 0,
    moveSpeedMultiplier: 1,
    moveSpeedFlat: 0,
    outgoingDamageMultiplier: 1,
    incomingDamageMultiplier: 1,
    equipmentTypeStatMultiplier: {},
    chestOpenSpeedMultiplier: 1,
    dashChargesFlat: 0,
    dashChargeOverride: null,
    allowSellOutsideCollector: false,
    sellPriceMultiplier: 1,
    equipmentCollectorQuoteMultiplier: 1,
    levelUpRerollsPerLevel: 0,
    basicAttackDisabled: false,
    npcSpawnCapMultiplier: 1,
    npcPriceMultiplier: 1
  };
}

function cloneStatModifiers(modifiers) {
  return {
    ...modifiers,
    equipmentTypeStatMultiplier: {
      ...(modifiers?.equipmentTypeStatMultiplier || {})
    }
  };
}

function toFiniteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toPositiveMultiplier(value, fallback = 1) {
  const next = toFiniteNumber(value, fallback);
  return next > 0 ? next : fallback;
}

function createRuntimeState() {
  return {
    builtAt: Date.now(),
    activeBlessingIds: [],
    activeEffectKeys: [],
    activeBlessings: [],
    unresolvedEffectKeys: [],
    notes: [],
    hooks: Object.create(null),
    statModifiers: createDefaultStatModifiers()
  };
}

function runHookChain(runtimeState, hookName, payload, game) {
  const handlers = runtimeState?.hooks?.[hookName] || [];
  let nextPayload = payload;
  for (const handler of handlers) {
    if (typeof handler !== 'function') {
      continue;
    }
    const result = handler(nextPayload, game);
    if (result !== undefined) {
      nextPayload = result;
    }
  }
  return nextPayload;
}

function createRuntimeBuilder(game, runtimeState) {
  return {
    addHook(hookName, handler) {
      if (!hookName || typeof handler !== 'function') {
        return;
      }
      runtimeState.hooks[hookName] = runtimeState.hooks[hookName] || [];
      runtimeState.hooks[hookName].push(handler);
    },

    multiplyStat(statKey, multiplier) {
      const current = toFiniteNumber(runtimeState.statModifiers[statKey], 1);
      runtimeState.statModifiers[statKey] = current * toPositiveMultiplier(multiplier, 1);
    },

    addFlat(statKey, value) {
      const current = toFiniteNumber(runtimeState.statModifiers[statKey], 0);
      runtimeState.statModifiers[statKey] = current + toFiniteNumber(value, 0);
    },

    setFlag(statKey, value) {
      runtimeState.statModifiers[statKey] = !!value;
    },

    setValue(statKey, value) {
      runtimeState.statModifiers[statKey] = value;
    },

    multiplyEquipmentType(typeKey, multiplier) {
      if (!typeKey) {
        return;
      }
      const key = String(typeKey);
      const existing = toFiniteNumber(runtimeState.statModifiers.equipmentTypeStatMultiplier[key], 1);
      runtimeState.statModifiers.equipmentTypeStatMultiplier[key] = existing * toPositiveMultiplier(multiplier, 1);
    },

    pushNote(text) {
      if (text) {
        runtimeState.notes.push(String(text));
      }
    },

    game
  };
}

function buildRuntimeState(game) {
  const runtimeState = createRuntimeState();
  const activeBlessings = typeof game.getActivePillarBlessings === 'function'
    ? game.getActivePillarBlessings()
    : [];
  const uniqueEffectKeys = new Set();

  runtimeState.activeBlessings = activeBlessings.filter(Boolean).map((blessing) => ({
    id: blessing.id,
    pillarId: blessing.pillarId,
    displayName: blessing.displayName,
    effectKey: blessing.effectKey || null
  }));
  runtimeState.activeBlessingIds = runtimeState.activeBlessings.map((blessing) => blessing.id);

  const builder = createRuntimeBuilder(game, runtimeState);
  for (const blessing of activeBlessings) {
    if (!blessing) {
      continue;
    }
    const effectKey = blessing.effectKey;
    if (!effectKey) {
      continue;
    }
    if (!uniqueEffectKeys.has(effectKey)) {
      uniqueEffectKeys.add(effectKey);
      runtimeState.activeEffectKeys.push(effectKey);
    }

    const installer = pillarEffectRegistry.get(effectKey);
    if (!installer) {
      runtimeState.unresolvedEffectKeys.push(effectKey);
      continue;
    }

    installer(builder, {
      game,
      blessing,
      effectKey
    });
  }

  return runtimeState;
}

export function registerPillarEffect(effectKey, installer) {
  if (!effectKey || typeof installer !== 'function') {
    return;
  }
  pillarEffectRegistry.set(effectKey, installer);
}

function registerStubEffect(effectKey, note) {
  registerPillarEffect(effectKey, (builder) => {
    builder.pushNote(`[Stub] ${effectKey}: ${note}`);
  });
}

function registerBaseEffects() {
  registerPillarEffect('pillar.weapon_master.perfect_craft', (builder) => {
    builder.multiplyEquipmentType('Weapon', 1.25);
    builder.pushNote('Perfect Craft active: weapon stats are scaled by 1.25x before stat aggregation.');
  });

  registerPillarEffect('pillar.limitless.endless_possibilities', (builder) => {
    builder.addFlat('levelUpRerollsPerLevel', 3);
    builder.pushNote('Endless Possibilities active: +3 level-up rerolls each level.');
  });

  registerPillarEffect('pillar.deep.quiet_hands', (builder) => {
    if (!Number.isFinite(builder.game.__pillarQuietHandsLastDamageAt)) {
      builder.game.__pillarQuietHandsLastDamageAt = toFiniteNumber(builder.game.time, 0);
    }

    builder.addHook('afterDealDamage', (payload, game) => {
      const dealt = toFiniteNumber(payload?.finalDamage ?? payload?.damage, 0);
      if (dealt > 0 && !payload?.isDot && payload?.source === 'player') {
        game.__pillarQuietHandsLastDamageAt = toFiniteNumber(game.time, 0);
      }
      return payload;
    });

    builder.addHook('modifyChestOpenSpeed', (payload, game) => {
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1);
      const now = toFiniteNumber(game.time, 0);
      const lastDamageAt = toFiniteNumber(game.__pillarQuietHandsLastDamageAt, now);
      if (now - lastDamageAt < 6) {
        return payload;
      }
      return {
        ...(payload || {}),
        multiplier: multiplier * 1.5,
        reason: 'quiet_hands'
      };
    });

    builder.pushNote('Quiet Hands active: chest open speed is increased by 50% after 6s without dealing damage.');
  });

  registerPillarEffect('pillar.collector.merchant_instinct', (builder) => {
    builder.setFlag('allowSellOutsideCollector', true);
    builder.multiplyStat('equipmentCollectorQuoteMultiplier', 2);
    builder.pushNote('Merchant Instinct active: inventory selling is enabled outside collector, collector quotes are doubled.');
  });

  registerPillarEffect('pillar.havoc.momentum_of_ruin', (builder) => {
    if (!Number.isFinite(builder.game.__pillarMomentumOfRuinUntil)) {
      builder.game.__pillarMomentumOfRuinUntil = 0;
    }

    builder.addHook('afterDestroyObject', (payload, game) => {
      const now = toFiniteNumber(game.time, 0);
      game.__pillarMomentumOfRuinUntil = Math.max(toFiniteNumber(game.__pillarMomentumOfRuinUntil, 0), now + 4);
      return payload;
    });

    builder.addHook('getMoveSpeedMultiplier', (payload, game) => {
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1);
      if (toFiniteNumber(game.__pillarMomentumOfRuinUntil, 0) <= toFiniteNumber(game.time, 0)) {
        return payload;
      }
      return {
        ...(payload || {}),
        multiplier: multiplier * 1.25,
        reason: 'momentum_of_ruin'
      };
    });

    builder.addHook('getAttackSpeedMultiplier', (payload, game) => {
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1);
      if (toFiniteNumber(game.__pillarMomentumOfRuinUntil, 0) <= toFiniteNumber(game.time, 0)) {
        return payload;
      }
      return {
        ...(payload || {}),
        multiplier: multiplier * 1.2,
        reason: 'momentum_of_ruin'
      };
    });

    builder.pushNote('Momentum of Ruin active: destroying an object grants temporary move/attack speed.');
  });

  for (const blessing of getAllBlessings()) {
    const effectKey = blessing?.effectKey;
    if (!effectKey || pillarEffectRegistry.has(effectKey)) {
      continue;
    }
    registerStubEffect(effectKey, 'Runtime behavior not implemented yet.');
  }
}

registerBaseEffects();

export function installPillarRuntime(game) {
  if (!game || game.__pillarRuntimeInstalled) {
    return;
  }

  game.__pillarRuntimeInstalled = true;
  game.pillarRuntimeState = createRuntimeState();

  game.refreshPillarRuntimeState = function refreshPillarRuntimeState(reason = 'manual') {
    game.pillarRuntimeState = buildRuntimeState(game);

    const event = new CustomEvent(PILLAR_RUNTIME_REFRESH_EVENT, {
      detail: {
        reason,
        activeBlessings: [...game.pillarRuntimeState.activeBlessingIds],
        activeEffectKeys: [...game.pillarRuntimeState.activeEffectKeys],
        unresolvedEffectKeys: [...game.pillarRuntimeState.unresolvedEffectKeys]
      }
    });
    window.dispatchEvent(event);

    return game.pillarRuntimeState;
  };

  game.getPillarRuntimeState = function getPillarRuntimeState() {
    return game.pillarRuntimeState || createRuntimeState();
  };

  game.runPillarEvent = function runPillarEvent(hookName, payload = {}) {
    return runHookChain(game.getPillarRuntimeState(), hookName, payload, game);
  };

  game.getPillarEventHandlers = function getPillarEventHandlers(hookName) {
    const hooks = game.getPillarRuntimeState().hooks || {};
    if (!hookName) {
      return hooks;
    }
    return hooks[hookName] || [];
  };

  game.getPillarStatModifiers = function getPillarStatModifiers() {
    return cloneStatModifiers(game.getPillarRuntimeState().statModifiers || createDefaultStatModifiers());
  };

  game.hasPillarEffect = function hasPillarEffect(effectKey) {
    if (!effectKey) {
      return false;
    }
    return game.getPillarRuntimeState().activeEffectKeys.includes(effectKey);
  };

  game.getPillarEquipmentStatMultiplier = function getPillarEquipmentStatMultiplier(item, slot) {
    const type = item?.type ? String(item.type) : '';
    const modifiers = game.getPillarStatModifiers();
    let multiplier = toPositiveMultiplier(modifiers.equipmentTypeStatMultiplier[type], 1);
    const eventPayload = game.runPillarEvent('getEquipmentStatMultiplier', {
      multiplier,
      item,
      slot
    });
    multiplier = toPositiveMultiplier(eventPayload?.multiplier, multiplier);
    return multiplier;
  };

  game.getPillarMoveSpeedMultiplier = function getPillarMoveSpeedMultiplier(context = {}) {
    const base = toPositiveMultiplier(game.getPillarStatModifiers().moveSpeedMultiplier, 1);
    const payload = game.runPillarEvent('getMoveSpeedMultiplier', { multiplier: base, context });
    return toPositiveMultiplier(payload?.multiplier, base);
  };

  game.getPillarAttackSpeedMultiplier = function getPillarAttackSpeedMultiplier(context = {}) {
    const payload = game.runPillarEvent('getAttackSpeedMultiplier', { multiplier: 1, context });
    return toPositiveMultiplier(payload?.multiplier, 1);
  };

  game.getPillarOutgoingDamageMultiplier = function getPillarOutgoingDamageMultiplier(context = {}) {
    const base = toPositiveMultiplier(game.getPillarStatModifiers().outgoingDamageMultiplier, 1);
    const payload = game.runPillarEvent('getOutgoingDamageMultiplier', { multiplier: base, context });
    return toPositiveMultiplier(payload?.multiplier, base);
  };

  game.getPillarIncomingDamageMultiplier = function getPillarIncomingDamageMultiplier(context = {}) {
    const base = toPositiveMultiplier(game.getPillarStatModifiers().incomingDamageMultiplier, 1);
    const payload = game.runPillarEvent('getIncomingDamageMultiplier', { multiplier: base, context });
    return toPositiveMultiplier(payload?.multiplier, base);
  };

  game.getPillarChestOpenSpeedMultiplier = function getPillarChestOpenSpeedMultiplier(prop) {
    const base = toPositiveMultiplier(game.getPillarStatModifiers().chestOpenSpeedMultiplier, 1);
    const payload = game.runPillarEvent('modifyChestOpenSpeed', { multiplier: base, prop });
    return toPositiveMultiplier(payload?.multiplier, base);
  };

  game.resolvePillarSellPrice = function resolvePillarSellPrice(price, item, context = {}) {
    const modifiers = game.getPillarStatModifiers();
    let finalPrice = toFiniteNumber(price, 0) * toPositiveMultiplier(modifiers.sellPriceMultiplier, 1);
    if (context.channel === 'equipmentCollector') {
      finalPrice *= toPositiveMultiplier(modifiers.equipmentCollectorQuoteMultiplier, 1);
    }

    const payload = game.runPillarEvent('resolveSellPrice', {
      price: finalPrice,
      item,
      context
    });

    return Math.max(0, Math.round(toFiniteNumber(payload?.price, finalPrice)));
  };

  game.getPillarPricingModifiers = function getPillarPricingModifiers() {
    const modifiers = game.getPillarStatModifiers();
    const payload = game.runPillarEvent('getPricingModifiers', {
      npcSpawnCapMultiplier: toPositiveMultiplier(modifiers.npcSpawnCapMultiplier, 1),
      npcPriceMultiplier: toPositiveMultiplier(modifiers.npcPriceMultiplier, 1)
    });

    return {
      npcSpawnCapMultiplier: toPositiveMultiplier(payload?.npcSpawnCapMultiplier, 1),
      npcPriceMultiplier: toPositiveMultiplier(payload?.npcPriceMultiplier, 1)
    };
  };

  game.canSellInventoryAnytime = function canSellInventoryAnytime() {
    return !!game.getPillarStatModifiers().allowSellOutsideCollector;
  };

  game.getPillarLevelUpRerolls = function getPillarLevelUpRerolls() {
    return Math.max(0, Math.floor(toFiniteNumber(game.getPillarStatModifiers().levelUpRerollsPerLevel, 0)));
  };

  game.getPillarSkillChargeConfig = function getPillarSkillChargeConfig(skillId, slot, baseCharges = 0) {
    const payload = game.runPillarEvent('modifySkillCharges', {
      skillId,
      slot,
      charges: toFiniteNumber(baseCharges, 0)
    });
    return {
      charges: Math.max(0, Math.floor(toFiniteNumber(payload?.charges, baseCharges)))
    };
  };

  game.requestPillarCooldownRefresh = function requestPillarCooldownRefresh(payload = {}) {
    return game.runPillarEvent('onCooldownRefreshRequest', {
      ...(payload || {}),
      time: toFiniteNumber(game.time, 0)
    });
  };

  game.isPillarBasicAttackAllowed = function isPillarBasicAttackAllowed(context = {}) {
    const modifiers = game.getPillarStatModifiers();
    if (modifiers.basicAttackDisabled) {
      return false;
    }
    const payload = game.runPillarEvent('canUseBasicAttack', { allowed: true, context });
    return payload?.allowed !== false;
  };

  game.canPillarDash = function canPillarDash(context = {}) {
    const payload = game.runPillarEvent('canDash', { allowed: true, context });
    return payload?.allowed !== false;
  };

  game.getPillarDashCost = function getPillarDashCost(baseCost = 1, context = {}) {
    const payload = game.runPillarEvent('modifyDashCost', { cost: toFiniteNumber(baseCost, 1), context });
    return Math.max(0, toFiniteNumber(payload?.cost, toFiniteNumber(baseCost, 1)));
  };

  game.getPillarDashChargeOverride = function getPillarDashChargeOverride() {
    const override = game.getPillarStatModifiers().dashChargeOverride;
    if (override == null) {
      return null;
    }
    const value = Math.max(0, Math.floor(toFiniteNumber(override, 0)));
    return Number.isFinite(value) ? value : null;
  };

  game.getPillarRuntimeDebugSummary = function getPillarRuntimeDebugSummary() {
    const state = game.getPillarRuntimeState();
    return {
      activeBlessings: [...state.activeBlessingIds],
      activeEffectKeys: [...state.activeEffectKeys],
      unresolvedEffectKeys: [...state.unresolvedEffectKeys],
      statModifiers: game.getPillarStatModifiers(),
      hooks: Object.keys(state.hooks || {}).reduce((acc, key) => {
        acc[key] = (state.hooks[key] || []).length;
        return acc;
      }, {}),
      notes: [...(state.notes || [])]
    };
  };

  game.debugPrintPillarRuntimeSummary = function debugPrintPillarRuntimeSummary() {
    const summary = game.getPillarRuntimeDebugSummary();
    console.log('[PillarRuntime] Active Blessings:', summary.activeBlessings);
    console.log('[PillarRuntime] Active Effects:', summary.activeEffectKeys);
    console.log('[PillarRuntime] Stat Modifiers:', summary.statModifiers);
    console.log('[PillarRuntime] Hook Counts:', summary.hooks);
    return summary;
  };

  game.simulatePillarChestOpen = function simulatePillarChestOpen() {
    return game.runPillarEvent('onChestOpened', {
      source: 'debug',
      time: toFiniteNumber(game.time, 0)
    });
  };

  game.simulatePillarDestroyEvent = function simulatePillarDestroyEvent() {
    return game.runPillarEvent('afterDestroyObject', {
      source: 'debug',
      time: toFiniteNumber(game.time, 0),
      object: { id: 'debug-breakable', type: 'debug' }
    });
  };

  game.syncPillarBlessings = function syncPillarBlessings(reason = 'sync') {
    game.refreshPillarRuntimeState(reason);
    if (typeof game.recalculateStats === 'function') {
      game.recalculateStats();
    }
  };

  game.refreshPillarRuntimeState('install');
}
