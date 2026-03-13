import { getAllBlessings } from '../data/pillars.js';

const PILLAR_RUNTIME_REFRESH_EVENT = 'pillars:runtime-refreshed';

const pillarEffectRegistry = new Map();
const pillarEffectImplementationStatus = new Map();
const stubbedEffectKeys = new Set();
const MAX_TRACE_ENTRIES = 30;

// Modifier merge policy:
// - multipliers: multiplicative chaining (multiplyStat)
// - flats: additive chaining (addFlat)
// - flags/gates: OR semantics for enabling/locking booleans (setFlag)
// - overrides: last writer wins (setValue)
// - clamps: applied after all contributions (clampValue)
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
    infiniteDashCharges: false,
    npcSpawnCapMultiplier: 1,
    npcPriceMultiplier: 1,
    breakableDamageMultiplier: 1
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

function isEnemyMinionLike(enemy) {
  if (!enemy || typeof enemy !== 'object') {
    return false;
  }
  return !!(
    enemy.isAffixMinion
    || enemy.isMinion
    || enemy.enemyTier === 'minion'
    || enemy.spawnGroup === 'minion'
  );
}

function isEnemyEliteLike(enemy) {
  if (!enemy || typeof enemy !== 'object') {
    return false;
  }
  return !!(
    enemy.isElite
    || enemy.enemyTier === 'elite'
    || enemy.enemyTier === 'miniBoss'
  );
}

function isEnemyBossLike(enemy, game = null) {
  if (!enemy || typeof enemy !== 'object') {
    return false;
  }
  return !!(
    enemy.isBoss
    || enemy.enemyTier === 'boss'
    || enemy.enemyTier === 'miniBoss'
    || (game && enemy === game.enemySystem?.boss)
  );
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
    inspectors: [],
    allocationRuleModifiers: [],
    statModifierClamps: Object.create(null),
    statModifiers: createDefaultStatModifiers(),
    modifierContributions: []
  };
}

function pushRingBuffer(list, value, max = MAX_TRACE_ENTRIES) {
  if (!Array.isArray(list)) {
    return;
  }
  list.push(value);
  if (list.length > max) {
    list.splice(0, list.length - max);
  }
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const summary = {};
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) {
      summary[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      summary[key] = `[array:${value.length}]`;
      continue;
    }
    summary[key] = '[object]';
  }
  return summary;
}

function ensureTraceStore(game) {
  if (!game.__pillarTraceStore) {
    game.__pillarTraceStore = {
      enabled: false,
      refreshes: [],
      events: [],
      contributions: [],
      sanitization: []
    };
  }
  return game.__pillarTraceStore;
}

function logTrace(game, channel, payload) {
  const store = ensureTraceStore(game);
  if (!store.enabled && channel !== 'sanitization') {
    return;
  }
  const next = {
    at: Date.now(),
    ...payload
  };
  if (channel === 'refresh') {
    pushRingBuffer(store.refreshes, next);
    return;
  }
  if (channel === 'event') {
    pushRingBuffer(store.events, next);
    return;
  }
  if (channel === 'contribution') {
    pushRingBuffer(store.contributions, next);
    return;
  }
  if (channel === 'sanitization') {
    pushRingBuffer(store.sanitization, next);
  }
}

const DEFAULT_PROC_POLICY = Object.freeze({
  maxDepth: 10,
  maxPerFrame: 24
});

function ensureProcGuardState(game) {
  if (!game.__pillarProcGuardState) {
    game.__pillarProcGuardState = {
      frameIndex: -1,
      usedThisFrame: 0,
      depth: 0,
      activeKeys: new Set(),
      recent: [],
      recentBlocked: []
    };
  }
  if (!(game.__pillarProcGuardState.activeKeys instanceof Set)) {
    game.__pillarProcGuardState.activeKeys = new Set();
  }
  if (!Array.isArray(game.__pillarProcGuardState.recent)) {
    game.__pillarProcGuardState.recent = [];
  }
  if (!Array.isArray(game.__pillarProcGuardState.recentBlocked)) {
    game.__pillarProcGuardState.recentBlocked = [];
  }
  return game.__pillarProcGuardState;
}

function getProcFrameIndex(game) {
  return Math.floor(Math.max(0, toFiniteNumber(game?.time, 0)) * 60);
}

function acquireProcBudget(game, request = {}) {
  const state = ensureProcGuardState(game);
  const frameIndex = getProcFrameIndex(game);
  if (state.frameIndex !== frameIndex) {
    state.frameIndex = frameIndex;
    state.usedThisFrame = 0;
  }

  const maxDepth = Math.max(1, Math.floor(toFiniteNumber(request.maxDepth, DEFAULT_PROC_POLICY.maxDepth)));
  const maxPerFrame = Math.max(1, Math.floor(toFiniteNumber(request.maxPerFrame, DEFAULT_PROC_POLICY.maxPerFrame)));
  const source = String(request.source || 'unknown');
  const uniqueKey = request.uniqueKey ? String(request.uniqueKey) : null;
  const preventReentry = request.preventReentry !== false;
  let blockedReason = null;

  if (state.depth >= maxDepth) {
    blockedReason = 'max_depth';
  } else if (state.usedThisFrame >= maxPerFrame) {
    blockedReason = 'max_per_frame';
  } else if (preventReentry && uniqueKey && state.activeKeys.has(uniqueKey)) {
    blockedReason = 'reentry_guard';
  }

  const decision = {
    at: toFiniteNumber(game?.time, 0),
    source,
    uniqueKey,
    allowed: !blockedReason,
    blockedReason,
    depthBefore: state.depth,
    usedThisFrameBefore: state.usedThisFrame,
    maxDepth,
    maxPerFrame
  };

  if (blockedReason) {
    pushRingBuffer(state.recentBlocked, decision);
    return {
      allowed: false,
      blockedReason,
      decision,
      state
    };
  }

  state.depth += 1;
  state.usedThisFrame += 1;
  if (preventReentry && uniqueKey) {
    state.activeKeys.add(uniqueKey);
  }

  const token = {
    source,
    uniqueKey,
    preventReentry
  };
  pushRingBuffer(state.recent, {
    ...decision,
    depthAfter: state.depth,
    usedThisFrameAfter: state.usedThisFrame
  });

  return {
    allowed: true,
    token,
    decision,
    state
  };
}

function releaseProcBudget(game, token) {
  if (!token) {
    return;
  }
  const state = ensureProcGuardState(game);
  state.depth = Math.max(0, toFiniteNumber(state.depth, 0) - 1);
  if (token.preventReentry !== false && token.uniqueKey) {
    state.activeKeys.delete(token.uniqueKey);
  }
}

function getProcBudgetSummary(game) {
  const state = ensureProcGuardState(game);
  return {
    frameIndex: toFiniteNumber(state.frameIndex, -1),
    usedThisFrame: toFiniteNumber(state.usedThisFrame, 0),
    depth: toFiniteNumber(state.depth, 0),
    activeKeys: [...(state.activeKeys || [])],
    recent: [...(state.recent || [])],
    recentBlocked: [...(state.recentBlocked || [])]
  };
}

function runHookChain(runtimeState, hookName, payload, game) {
  const handlers = runtimeState?.hooks?.[hookName] || [];
  let nextPayload = payload;
  logTrace(game, 'event', {
    hookName,
    payload: summarizePayload(payload),
    handlerCount: handlers.length
  });
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
  const source = runtimeState.__activeSource || null;
  const sourceLabel = source
    ? `${source.effectKey || source.blessingId || 'unknown_effect'}`
    : 'unknown_effect';

  const traceContribution = (type, data = {}) => {
    const contribution = {
      type,
      source: sourceLabel,
      ...data
    };
    runtimeState.modifierContributions.push(contribution);
    logTrace(game, 'contribution', contribution);
  };

  return {
    addHook(hookName, handler) {
      if (!hookName || typeof handler !== 'function') {
        return;
      }
      runtimeState.hooks[hookName] = runtimeState.hooks[hookName] || [];
      runtimeState.hooks[hookName].push(handler);
      traceContribution('hook', { hookName });
    },

    multiplyStat(statKey, multiplier) {
      const current = toFiniteNumber(runtimeState.statModifiers[statKey], 1);
      runtimeState.statModifiers[statKey] = current * toPositiveMultiplier(multiplier, 1);
      traceContribution('multiplyStat', {
        statKey,
        value: runtimeState.statModifiers[statKey]
      });
    },

    addFlat(statKey, value) {
      const current = toFiniteNumber(runtimeState.statModifiers[statKey], 0);
      runtimeState.statModifiers[statKey] = current + toFiniteNumber(value, 0);
      traceContribution('addFlat', {
        statKey,
        value: runtimeState.statModifiers[statKey]
      });
    },

    setFlag(statKey, value) {
      const nextValue = !!value;
      runtimeState.statModifiers[statKey] = !!runtimeState.statModifiers[statKey] || nextValue;
      traceContribution('setFlag', {
        statKey,
        value: runtimeState.statModifiers[statKey]
      });
    },

    setValue(statKey, value) {
      runtimeState.statModifiers[statKey] = value;
      traceContribution('setValue', { statKey, value });
    },

    clampValue(statKey, minValue = null, maxValue = null) {
      runtimeState.statModifierClamps[statKey] = {
        min: minValue == null ? null : toFiniteNumber(minValue, null),
        max: maxValue == null ? null : toFiniteNumber(maxValue, null)
      };
      traceContribution('clampValue', {
        statKey,
        minValue,
        maxValue
      });
    },

    multiplyEquipmentType(typeKey, multiplier) {
      if (!typeKey) {
        return;
      }
      const key = String(typeKey);
      const existing = toFiniteNumber(runtimeState.statModifiers.equipmentTypeStatMultiplier[key], 1);
      runtimeState.statModifiers.equipmentTypeStatMultiplier[key] = existing * toPositiveMultiplier(multiplier, 1);
      traceContribution('multiplyEquipmentType', {
        typeKey: key,
        value: runtimeState.statModifiers.equipmentTypeStatMultiplier[key]
      });
    },

    addInspector(getInspectorEntry) {
      if (typeof getInspectorEntry !== 'function') {
        return;
      }
      runtimeState.inspectors.push(getInspectorEntry);
      traceContribution('addInspector');
    },

    addAllocationRuleModifier(modifier, sourceInfo = {}) {
      if (!modifier) {
        return;
      }
      runtimeState.allocationRuleModifiers.push({
        modifier,
        source: sourceInfo.source || sourceLabel,
        effectKey: sourceInfo.effectKey || source?.effectKey || null
      });
      traceContribution('addAllocationRuleModifier', {
        source: sourceInfo.source || sourceLabel
      });
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
      logTrace(game, 'contribution', {
        type: 'unresolved_effect_key',
        source: effectKey
      });
      continue;
    }

    runtimeState.__activeSource = {
      blessingId: blessing.id,
      effectKey
    };
    const builder = createRuntimeBuilder(game, runtimeState);
    installer(builder, {
      game,
      blessing,
      effectKey
    });
    if (stubbedEffectKeys.has(effectKey)) {
      logTrace(game, 'contribution', {
        type: 'stub_effect_allocated',
        source: effectKey
      });
    }
    runtimeState.__activeSource = null;
  }

  for (const statKey of Object.keys(runtimeState.statModifierClamps)) {
    const clamp = runtimeState.statModifierClamps[statKey];
    const value = toFiniteNumber(runtimeState.statModifiers[statKey], runtimeState.statModifiers[statKey]);
    let nextValue = value;
    if (clamp?.min != null) {
      nextValue = Math.max(clamp.min, nextValue);
    }
    if (clamp?.max != null) {
      nextValue = Math.min(clamp.max, nextValue);
    }
    runtimeState.statModifiers[statKey] = nextValue;
  }

  return runtimeState;
}

export function registerPillarEffect(effectKey, installer, options = {}) {
  if (!effectKey || typeof installer !== 'function') {
    return;
  }
  pillarEffectRegistry.set(effectKey, installer);
  const isStub = !!options.stub;
  pillarEffectImplementationStatus.set(effectKey, {
    implemented: !isStub,
    stub: isStub
  });
  if (isStub) {
    stubbedEffectKeys.add(effectKey);
  } else {
    stubbedEffectKeys.delete(effectKey);
  }
}

function registerStubEffect(effectKey, note) {
  registerPillarEffect(effectKey, (builder) => {
    builder.pushNote(`[Stub] ${effectKey}: ${note}`);
  }, { stub: true });
}

function registerBaseEffects() {
  registerPillarEffect('pillar.weapon_master.perfect_craft', (builder) => {
    builder.multiplyEquipmentType('Weapon', 1.25);
    builder.pushNote('Perfect Craft active: weapon stats are scaled by 1.25x before stat aggregation.');
  });

  registerPillarEffect('pillar.weapon_master.dual_technique', (builder) => {
    builder.addHook('resolveDualBasicAttackConfig', (payload, game) => {
      const primaryAttackType = String(payload?.primaryAttackType || game?.attackType || 'projectile');
      let secondaryAttackType = String(payload?.secondaryAttackType || game?.secondaryAttackType || primaryAttackType);
      if (!secondaryAttackType || secondaryAttackType === primaryAttackType) {
        const fallback = (Array.isArray(game?.runConfig?.attackTypePool) ? game.runConfig.attackTypePool : [])
          .map((entry) => String(entry || ''))
          .find((entry) => entry && entry !== primaryAttackType);
        secondaryAttackType = fallback || secondaryAttackType || primaryAttackType;
      }
      return {
        ...(payload || {}),
        enabled: true,
        primaryAttackType,
        secondaryAttackType,
        damageMultiplier: 0.4,
        effectKey: 'pillar.weapon_master.dual_technique',
        reason: 'dual_technique'
      };
    });
    builder.addInspector((game) => ({
      id: 'dual_technique',
      label: 'Dual Technique',
      active: true,
      primaryAttackType: game?.attackType || null,
      secondaryAttackType: game?.secondaryAttackType || null,
      damageMultiplier: 0.4,
      lastCast: game?.__pillarDualTechniqueLastCast || null
    }));
    builder.pushNote('Dual Technique active: one basic-attack input executes primary + secondary attacks at 40% damage scaling.');
  });

  registerPillarEffect('pillar.weapon_master.perfect_hybridization', (builder) => {
    builder.addHook('resolveHitClassification', (payload) => {
      return {
        ...(payload || {}),
        countsAsMelee: true,
        countsAsRanged: true,
        reason: 'perfect_hybridization'
      };
    });
    builder.addInspector(() => ({
      id: 'perfect_hybridization',
      label: 'Perfect Hybridization',
      mode: 'both_melee_and_ranged'
    }));
    builder.pushNote('Perfect Hybridization prep active: qualifying hits are treated as both melee and ranged through the central hit-classification pipeline.');
  });

  registerPillarEffect('pillar.weapon_master.living_arsenal', (builder) => {
    const countEquippedWeapons = (game) =>
      Object.values(game?.equipment || {}).filter((item) => item?.type === 'Weapon').length;

    builder.addHook('resolveEquipmentLayout', (payload) => {
      const layout = payload?.layout && typeof payload.layout === 'object'
        ? payload.layout
        : { slots: [], categoryCaps: {}, notes: [] };
      const slots = Array.isArray(layout.slots) ? layout.slots : [];
      const transformedSlots = slots.map((slot, index) => ({
        ...(slot || {}),
        label: `Weapon Slot ${index + 1}`,
        allowedItemTypes: ['Weapon'],
        tags: [...new Set([...(Array.isArray(slot?.tags) ? slot.tags : []), 'living_arsenal_transformed'])],
        transformedBy: 'pillar.weapon_master.living_arsenal',
        disabledReason: null
      }));
      const categoryCaps = {
        ...(layout.categoryCaps || {}),
        Weapon: Math.max(transformedSlots.length, 4),
        Helmet: 0,
        'Body Armour': 0,
        Boots: 0,
        Ring: 0
      };
      const notes = [
        ...(Array.isArray(layout.notes) ? layout.notes : []),
        'Living Arsenal active: all equipment slots are weapon-compatible.'
      ];
      return {
        ...(payload || {}),
        layout: {
          ...layout,
          slots: transformedSlots,
          categoryCaps,
          notes: [...new Set(notes)]
        }
      };
    });

    builder.addHook('resolveAttackRepeat', (payload, game) => {
      if (payload?.repeatAttack === true || payload?.sourceType === 'pillar_repeat' || payload?.isDot) {
        return payload;
      }
      if (payload?.sourceType && payload.sourceType !== 'player') {
        return payload;
      }
      const equippedWeapons = countEquippedWeapons(game);
      if (equippedWeapons < 4) {
        return payload;
      }
      return {
        ...(payload || {}),
        repeatCount: Math.max(toFiniteNumber(payload?.repeatCount, 0), 4),
        damageMultiplier: Math.max(toFiniteNumber(payload?.damageMultiplier, 0), 0.25),
        effectKey: 'pillar.weapon_master.living_arsenal',
        reason: 'living_arsenal_repeat'
      };
    });

    builder.addInspector((game) => {
      const equippedWeapons = countEquippedWeapons(game);
      return {
        id: 'living_arsenal',
        label: 'Living Arsenal',
        equippedWeapons,
        transformedSlotCount: Object.keys(game?.equipment || {}).length,
        activeRepeatCount: equippedWeapons >= 4 ? 4 : 0,
        repeatDamageMultiplier: equippedWeapons >= 4 ? 0.25 : 0
      };
    });

    builder.pushNote('Living Arsenal active: all equipment slots become weapon-compatible; with 4+ equipped weapons, attacks repeat 4 times for 25% damage.');
  });

  registerPillarEffect('pillar.limitless.endless_possibilities', (builder) => {
    builder.addFlat('levelUpRerollsPerLevel', 3);
    builder.pushNote('Endless Possibilities active: +3 level-up rerolls each level.');
  });

  registerPillarEffect('pillar.limitless.ascended_growth', (builder) => {
    builder.addHook('resolveLevelUpPickConfig', (payload) => {
      const existing = Array.isArray(payload?.effectiveness)
        ? payload.effectiveness.map((entry) => toPositiveMultiplier(entry, 1))
        : [1];
      return {
        ...(payload || {}),
        pickCount: Math.max(Math.floor(toFiniteNumber(payload?.pickCount, 1)), 3),
        effectiveness: [0.8, 0.5, 0.3, ...existing].slice(0, 6),
        reason: 'ascended_growth',
        effectKey: 'pillar.limitless.ascended_growth'
      };
    });
    builder.addInspector((game) => ({
      id: 'ascended_growth',
      label: 'Ascended Growth',
      active: true,
      pickState: game?.__pillarAscendedGrowthState || null
    }));
    builder.pushNote('Ascended Growth active: each level-up resolves 3 ordered picks at 80% / 50% / 30% effectiveness.');
  });

  registerPillarEffect('pillar.deep.two_heads', (builder) => {
    builder.addHook('resolveEquipmentLayout', (payload) => {
      const layout = payload?.layout && typeof payload.layout === 'object'
        ? payload.layout
        : { slots: [], categoryCaps: {}, notes: [] };
      const slots = Array.isArray(layout.slots) ? [...layout.slots] : [];
      const byKey = new Map(slots.map((slot) => [String(slot?.key || ''), slot]));
      const helmet2 = byKey.get('Helmet2');
      if (!helmet2) {
        const insertAt = slots.findIndex((slot) => String(slot?.key || '') === 'Helmet');
        const nextSlot = {
          key: 'Helmet2',
          label: 'Helmet Slot B',
          enabled: true,
          capacity: 1,
          allowedItemTypes: ['Helmet'],
          tags: ['helmet_slot', 'two_heads_slot'],
          transformedBy: 'pillar.deep.two_heads',
          disabledReason: null
        };
        if (insertAt >= 0) {
          slots.splice(insertAt + 1, 0, nextSlot);
        } else {
          slots.unshift(nextSlot);
        }
      } else {
        helmet2.label = helmet2.label || 'Helmet Slot B';
        helmet2.enabled = true;
        helmet2.capacity = 1;
        helmet2.allowedItemTypes = ['Helmet'];
        helmet2.tags = [...new Set([...(Array.isArray(helmet2.tags) ? helmet2.tags : []), 'helmet_slot', 'two_heads_slot'])];
        helmet2.transformedBy = 'pillar.deep.two_heads';
        helmet2.disabledReason = null;
      }
      const categoryCaps = {
        ...(layout.categoryCaps || {}),
        Helmet: Math.max(2, Math.floor(toFiniteNumber(layout?.categoryCaps?.Helmet, 1)))
      };
      const notes = [
        ...(Array.isArray(layout.notes) ? layout.notes : []),
        'Two Heads active: a second helmet slot is enabled and both helmets contribute stats.'
      ];
      return {
        ...(payload || {}),
        layout: {
          ...layout,
          slots,
          categoryCaps,
          notes: [...new Set(notes)]
        }
      };
    });
    builder.addInspector((game) => {
      const layout = typeof game.resolvePillarEquipmentLayout === 'function'
        ? game.resolvePillarEquipmentLayout({ source: 'two_heads_inspector' })
        : { slots: [] };
      const helmetSlots = (layout.slots || []).filter((slot) => (slot?.allowedItemTypes || []).includes('Helmet'));
      const equippedHelmets = Object.entries(game?.equipment || {})
        .filter(([_, item]) => item?.type === 'Helmet')
        .map(([slotKey, item]) => ({ slotKey, itemId: item?.id || null, name: item?.name || null }));
      return {
        id: 'two_heads',
        label: 'Two Heads',
        helmetSlotCount: helmetSlots.length,
        helmetSlots: helmetSlots.map((slot) => ({
          key: slot.key,
          enabled: slot.enabled !== false
        })),
        equippedHelmets
      };
    });
    builder.pushNote('Two Heads active: one additional helmet slot is enabled through the equipment layout pipeline.');
  });

  const installQuietHands = (builder) => {
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
  };
  registerPillarEffect('pillar.pacifier.quiet_hands', installQuietHands);
  registerPillarEffect('pillar.deep.quiet_hands', installQuietHands);

  registerPillarEffect('pillar.deep.tentacles', (builder) => {
    const MODIFIER_ADAPTERS = {
      swift: { portability: 'portable', moveSpeedMultiplier: 1.15 },
      evasive: { portability: 'portable', incomingDamageMultiplier: 0.9 },
      weakening: { portability: 'portable', outgoingDamageMultiplier: 1.1 },
      cursing: { portability: 'portable', triggerChanceMultiplier: 1.15 },
      erratic: { portability: 'portable', attackSpeedMultiplier: 1.1, moveSpeedMultiplier: 1.05 },
      orbiting: { portability: 'adaptable', outgoingDamageMultiplier: 1.08, adapterReason: 'mapped_to_orbit_damage_bonus' },
      phantom: { portability: 'adaptable', incomingDamageMultiplier: 0.92, adapterReason: 'mapped_to_damage_avoidance' }
    };

    const ROLL_INTERVAL = 20;
    const MODIFIER_DURATION = 20;
    const curatedPool = new Set(Object.keys(MODIFIER_ADAPTERS));

    const ensureState = (game) => {
      if (!game.__pillarTentaclesState) {
        game.__pillarTentaclesState = {
          activeModifierIds: [],
          activeModifierMeta: [],
          lastRejected: [],
          lastRollAt: 0,
          activeUntil: 0,
          nextRollAt: 0,
          rollCount: 0,
          regenAccumulator: 0,
          lastRegenAmount: 0,
          lastPoolSize: 0
        };
      }
      return game.__pillarTentaclesState;
    };

    const pickRandomUnique = (ids, count) => {
      const copy = [...ids];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.max(0, count));
    };

    const rollTentacleModifiers = (game, now) => {
      const state = ensureState(game);
      const portabilityCatalog = typeof game.getEnemyModifierPortabilityCatalog === 'function'
        ? game.getEnemyModifierPortabilityCatalog()
        : {};
      const safePool = [];
      const blocked = [];
      for (const [id, entry] of Object.entries(portabilityCatalog || {})) {
        if (!curatedPool.has(id)) {
          blocked.push({ id, reason: 'not_in_curated_pool' });
          continue;
        }
        if (!entry || (entry.portability !== 'portable' && entry.portability !== 'adaptable')) {
          blocked.push({ id, reason: entry?.reason || 'forbidden' });
          continue;
        }
        safePool.push(id);
      }
      state.lastPoolSize = safePool.length;
      const rolledIds = pickRandomUnique(safePool, 2);
      const portabilityResult = typeof game.applyPortableEnemyModifierPackage === 'function'
        ? game.applyPortableEnemyModifierPackage(null, rolledIds, {
          source: 'pillar.deep.tentacles',
          targetType: 'player',
          replace: true
        })
        : { applied: rolledIds.map((id) => ({ id, portability: 'portable', reason: 'fallback' })), rejected: [] };
      const applied = Array.isArray(portabilityResult?.applied) ? portabilityResult.applied : [];
      const rejected = Array.isArray(portabilityResult?.rejected) ? portabilityResult.rejected : [];
      state.activeModifierIds = applied.map((entry) => String(entry.id || '')).filter(Boolean);
      state.activeModifierMeta = state.activeModifierIds.map((id) => ({
        id,
        portability: MODIFIER_ADAPTERS[id]?.portability || 'portable',
        adapterReason: MODIFIER_ADAPTERS[id]?.adapterReason || null
      }));
      state.lastRejected = [...rejected, ...blocked].slice(0, 10);
      state.lastRollAt = now;
      state.activeUntil = now + MODIFIER_DURATION;
      state.nextRollAt = now + ROLL_INTERVAL;
      state.rollCount += 1;

      if (typeof game.pushPillarDebugEntry === 'function') {
        game.pushPillarDebugEntry('__pillarTentacleRollEvents', {
          at: now,
          activeModifierIds: [...state.activeModifierIds],
          rejected: [...state.lastRejected],
          poolSize: state.lastPoolSize
        });
      }
      logTrace(game, 'event', {
        hookName: 'tentacles_roll',
        payload: {
          activeModifierIds: [...state.activeModifierIds],
          rejectedCount: state.lastRejected.length,
          poolSize: state.lastPoolSize
        },
        handlerCount: 1
      });
    };

    const getModifierProfile = (game) => {
      const state = ensureState(game);
      const profile = {
        moveSpeedMultiplier: 1,
        attackSpeedMultiplier: 1,
        incomingDamageMultiplier: 1,
        outgoingDamageMultiplier: 1,
        triggerChanceMultiplier: 1,
        regenPercentPerSecond: 0
      };
      for (const id of state.activeModifierIds || []) {
        const adapter = MODIFIER_ADAPTERS[id];
        if (!adapter) continue;
        profile.moveSpeedMultiplier *= toPositiveMultiplier(adapter.moveSpeedMultiplier, 1);
        profile.attackSpeedMultiplier *= toPositiveMultiplier(adapter.attackSpeedMultiplier, 1);
        profile.incomingDamageMultiplier *= toPositiveMultiplier(adapter.incomingDamageMultiplier, 1);
        profile.outgoingDamageMultiplier *= toPositiveMultiplier(adapter.outgoingDamageMultiplier, 1);
        profile.triggerChanceMultiplier *= toPositiveMultiplier(adapter.triggerChanceMultiplier, 1);
        profile.regenPercentPerSecond += Math.max(0, toFiniteNumber(adapter.regenPercentPerSecond, 0));
      }
      return profile;
    };

    builder.addHook('resolveEquipmentLayout', (payload) => {
      const layout = payload?.layout && typeof payload.layout === 'object'
        ? payload.layout
        : { slots: [], categoryCaps: {}, notes: [] };
      const slots = (Array.isArray(layout.slots) ? layout.slots : []).map((slot) => {
        const isRingSlot = Array.isArray(slot?.allowedItemTypes)
          && slot.allowedItemTypes.includes('Ring');
        if (!isRingSlot) {
          return slot;
        }
        return {
          ...(slot || {}),
          enabled: false,
          capacity: 0,
          disabledReason: 'tentacles_ring_slots_disabled',
          transformedBy: 'pillar.deep.tentacles'
        };
      });
      const categoryCaps = {
        ...(layout.categoryCaps || {}),
        Ring: 0
      };
      return {
        ...(payload || {}),
        layout: {
          ...layout,
          slots,
          categoryCaps,
          notes: [...new Set([...(layout.notes || []), 'Tentacles active: all ring slots are disabled.'])]
        }
      };
    });

    builder.addHook('onTick', (payload, game) => {
      const dt = Math.max(0, toFiniteNumber(payload?.dt, 0));
      const now = toFiniteNumber(game.time, 0);
      const state = ensureState(game);
      if (!Number.isFinite(state.nextRollAt) || state.nextRollAt <= 0) {
        rollTentacleModifiers(game, now);
      } else if (now >= state.nextRollAt || now >= state.activeUntil) {
        rollTentacleModifiers(game, now);
      }

      if (dt > 0) {
        const profile = getModifierProfile(game);
        if (profile.regenPercentPerSecond > 0 && typeof game.healPlayer === 'function') {
          state.regenAccumulator = toFiniteNumber(state.regenAccumulator, 0) + dt;
          while (state.regenAccumulator >= 1) {
            state.regenAccumulator -= 1;
            const maxHp = Math.max(1, toFiniteNumber(game.currentStats?.maxHealth, 1));
            const healAmount = Math.max(1, Math.round(maxHp * profile.regenPercentPerSecond));
            state.lastRegenAmount = healAmount;
            game.healPlayer(healAmount);
          }
        }
      }
      return payload;
    });

    builder.addHook('getMoveSpeedMultiplier', (payload, game) => {
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1);
      const profile = getModifierProfile(game);
      return {
        ...(payload || {}),
        multiplier: multiplier * profile.moveSpeedMultiplier,
        reason: 'tentacles_modifier_set'
      };
    });

    builder.addHook('getAttackSpeedMultiplier', (payload, game) => {
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1);
      const profile = getModifierProfile(game);
      return {
        ...(payload || {}),
        multiplier: multiplier * profile.attackSpeedMultiplier,
        reason: 'tentacles_modifier_set'
      };
    });

    builder.addHook('beforeTakeDamage', (payload, game) => {
      const rawAmount = toFiniteNumber(payload?.rawAmount, 0);
      if (rawAmount <= 0) {
        return payload;
      }
      const profile = getModifierProfile(game);
      return {
        ...(payload || {}),
        rawAmount: Math.max(0, Math.round(rawAmount * profile.incomingDamageMultiplier)),
        reason: 'tentacles_modifier_set'
      };
    });

    builder.addHook('beforeDealDamage', (payload, game) => {
      const amount = toFiniteNumber(payload?.amount, 0);
      if (amount <= 0) {
        return payload;
      }
      const profile = getModifierProfile(game);
      return {
        ...(payload || {}),
        amount: Math.max(0, Math.round(amount * profile.outgoingDamageMultiplier)),
        reason: 'tentacles_modifier_set'
      };
    });

    builder.addHook('modifyTriggerChance', (payload, game) => {
      const chance = toFiniteNumber(payload?.chance, 0);
      if (chance <= 0) {
        return payload;
      }
      const profile = getModifierProfile(game);
      return {
        ...(payload || {}),
        chance: Math.max(0, Math.min(1, chance * profile.triggerChanceMultiplier)),
        reason: 'tentacles_modifier_set'
      };
    });

    builder.addInspector((game) => {
      const state = ensureState(game);
      return {
        id: 'tentacles',
        label: 'Tentacles',
        activeModifiers: [...(state.activeModifierMeta || [])],
        rollCount: toFiniteNumber(state.rollCount, 0),
        remainingDuration: Math.max(0, Math.round((toFiniteNumber(state.activeUntil, 0) - toFiniteNumber(game.time, 0)) * 100) / 100),
        nextRerollIn: Math.max(0, Math.round((toFiniteNumber(state.nextRollAt, 0) - toFiniteNumber(game.time, 0)) * 100) / 100),
        lastRejected: [...(state.lastRejected || [])],
        lastPoolSize: toFiniteNumber(state.lastPoolSize, 0),
        ringSlotsDisabled: true
      };
    });

    builder.pushNote('Tentacles active: ring slots are disabled and two random portable/adapted enemy modifiers rotate every 20 seconds.');
    builder.pushNote('Tentacles safety: only curated portable/adaptable modifiers are eligible; forbidden/enemy-only modifiers are rejected.');
  });

  registerPillarEffect('pillar.deep.twisted_belief', (builder) => {
    builder.addAllocationRuleModifier(
      {
        id: 'twisted_belief_proof_eldritch',
        effectKey: 'pillar.deep.twisted_belief',
        maxLevel1Delta: 3,
        maxLevel2Override: 1,
        maxBlessingsPerPillarOverride: 2,
        allowSamePillarDuplicates: true,
        enforceSiblingExclusion: false,
        blockLevel2Allocation: true
      },
      {
        source: 'twisted_belief',
        effectKey: 'pillar.deep.twisted_belief'
      }
    );
    builder.addInspector((game) => {
      const topology = typeof game.getPillarAllocationTopologySummary === 'function'
        ? game.getPillarAllocationTopologySummary()
        : null;
      return {
        id: 'twisted_belief',
        label: 'Twisted Belief',
        proofGranted: 'Proof of Eldritch',
        topology: topology?.rules || null
      };
    });
    builder.pushNote('Twisted Belief active: Proof of Eldritch topology applied (+3 L1, same-pillar duplicates allowed, level 2 allocation capped/blocked).');
  });

  registerPillarEffect('pillar.collector.merchant_instinct', (builder) => {
    builder.setFlag('allowSellOutsideCollector', true);
    builder.multiplyStat('equipmentCollectorQuoteMultiplier', 2);
    builder.pushNote('Merchant Instinct active: inventory selling is enabled outside collector, collector quotes are doubled.');
  });

  registerPillarEffect('pillar.collector.ring_vault', (builder) => {
    const getRingLabel = (index) => {
      if (index === 1) return 'Ring Slot A';
      if (index === 2) return 'Ring Slot B';
      return `Ring Slot ${index}`;
    };

    builder.addHook('resolveEquipmentLayout', (payload, game) => {
      const layout = payload?.layout && typeof payload.layout === 'object'
        ? payload.layout
        : { slots: [], categoryCaps: {}, notes: [] };
      const slots = Array.isArray(layout.slots) ? [...layout.slots] : [];
      const byKey = new Map(slots.map((slot) => [String(slot?.key || ''), slot]));
      const tentaclesActive = typeof game?.hasPillarEffect === 'function'
        ? game.hasPillarEffect('pillar.deep.tentacles')
        : false;

      for (let i = 1; i <= 10; i += 1) {
        const key = `Ring${i}`;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.transformedBy) {
            existing.label = getRingLabel(i);
            existing.allowedItemTypes = ['Ring'];
            existing.tags = [...new Set([...(Array.isArray(existing.tags) ? existing.tags : []), 'ring_slot'])];
            existing.enabled = tentaclesActive ? false : (existing.enabled !== false);
            existing.disabledReason = tentaclesActive ? 'tentacles_ring_slots_disabled' : (existing.disabledReason || null);
          }
          continue;
        }
        slots.push({
          key,
          label: getRingLabel(i),
          enabled: !tentaclesActive,
          capacity: tentaclesActive ? 0 : 1,
          allowedItemTypes: ['Ring'],
          tags: ['ring_slot'],
          transformedBy: null,
          disabledReason: tentaclesActive ? 'tentacles_ring_slots_disabled' : null
        });
      }

      const categoryCaps = {
        ...(layout.categoryCaps || {}),
        Ring: tentaclesActive ? 0 : Math.max(10, toFiniteNumber(layout?.categoryCaps?.Ring, 0))
      };
      const notes = [
        ...(Array.isArray(layout.notes) ? layout.notes : []),
        'Ring Vault active: up to 10 ring slots are available.'
      ];

      return {
        ...(payload || {}),
        layout: {
          ...layout,
          slots,
          categoryCaps,
          notes: [...new Set(notes)]
        }
      };
    });

    builder.addHook('resolveRingEffectMultiplier', (payload, game) => {
      const inventoryRingCount = (Array.isArray(game.inventory) ? game.inventory : []).filter((item) => item?.type === 'Ring').length;
      const equippedRingCount = Object.values(game?.equipment || {}).filter((item) => item?.type === 'Ring').length;
      const bonusPercent = Math.min(100, inventoryRingCount * 10);
      const netPercent = -90 + bonusPercent;
      const additivePercent = toFiniteNumber(payload?.additivePercent, 0) + netPercent;
      return {
        ...(payload || {}),
        additivePercent,
        reason: 'ring_vault',
        ringVault: {
          inventoryRingCount,
          equippedRingCount,
          bonusPercent,
          penaltyPercent: -90,
          netPercent
        }
      };
    });

    builder.addInspector((game) => {
      const inventoryRingCount = (Array.isArray(game.inventory) ? game.inventory : []).filter((item) => item?.type === 'Ring').length;
      const equippedRingCount = Object.values(game?.equipment || {}).filter((item) => item?.type === 'Ring').length;
      const bonusPercent = Math.min(100, inventoryRingCount * 10);
      const netPercent = -90 + bonusPercent;
      return {
        id: 'ring_vault',
        label: 'Ring Vault',
        inventoryRingCount,
        equippedRingCount,
        ringSlotCapacity: 10,
        bonusPercent,
        penaltyPercent: -90,
        netPercent,
        finalMultiplier: Math.max(0, 1 + netPercent / 100)
      };
    });

    builder.pushNote('Ring Vault active: ring effect scaling is additive (-90% base +10% per inventory ring up to +100%), and ring slot capacity increases to 10.');
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

    builder.addInspector((game) => {
      const now = toFiniteNumber(game.time, 0);
      const activeUntil = toFiniteNumber(game.__pillarMomentumOfRuinUntil, 0);
      return {
        id: 'momentum_of_ruin',
        label: 'Momentum of Ruin',
        active: activeUntil > now,
        remaining: Math.max(0, Math.round((activeUntil - now) * 100) / 100)
      };
    });

    builder.pushNote('Momentum of Ruin active: destroying an object grants temporary move/attack speed.');
  });

  registerPillarEffect('pillar.havoc.fury_of_havoc', (builder) => {
    const effectKey = 'pillar.havoc.fury_of_havoc';
    const ensureState = (game) => {
      if (!game.__pillarFuryOfHavocState) {
        game.__pillarFuryOfHavocState = {
          fury: 0,
          massDestroyActive: false,
          pendingDestroyQueue: [],
          blockedObjects: [],
          lastSelfDamage: 0,
          lastResetAt: 0,
          lastMassDestroyAt: 0,
          triggerCount: 0,
          processedInLastTick: 0
        };
      }
      return game.__pillarFuryOfHavocState;
    };
    const isMassDestroyPayload = (payload) => {
      if (!payload || typeof payload !== 'object') return false;
      if (payload.reason === 'fury_of_havoc_mass_destroy') return true;
      const tags = Array.isArray(payload.tags) ? payload.tags : [];
      return tags.includes('fury_of_havoc_mass_destroy');
    };
    const collectVisibleDestructibles = (game, state) => {
      const byRef = new Set();
      const out = [];
      const blocked = [];
      const cameraX = toFiniteNumber(game?.camera?.position?.x, 0);
      const cameraY = toFiniteNumber(game?.camera?.position?.y, 0);
      const viewW = Math.max(1, toFiniteNumber(game?.camera?.viewWidth, game?.canvas?.width || game?.world?.width || 640));
      const viewH = Math.max(1, toFiniteNumber(game?.camera?.viewHeight, game?.canvas?.height || game?.world?.height || 360));
      const minX = cameraX - 80;
      const minY = cameraY - 80;
      const maxX = cameraX + viewW + 80;
      const maxY = cameraY + viewH + 80;
      const pools = [
        Array.isArray(game?.breakables) ? game.breakables : [],
        Array.isArray(game?.obstacles) ? game.obstacles : [],
        Array.isArray(game?.searchableProps) ? game.searchableProps : [],
        Array.isArray(game?.mapInteractables) ? game.mapInteractables : []
      ];
      for (const list of pools) {
        for (const target of list) {
          if (!target || typeof target !== 'object' || byRef.has(target)) continue;
          byRef.add(target);
          if (typeof game.isWorldObjectDestroyed === 'function' && game.isWorldObjectDestroyed(target)) continue;
          const center = typeof game.getWorldObjectCenter === 'function'
            ? game.getWorldObjectCenter(target)
            : { x: toFiniteNumber(target?.x, 0), y: toFiniteNumber(target?.y, 0) };
          if (center.x < minX || center.x > maxX || center.y < minY || center.y > maxY) continue;
          const typeHint = typeof game.inferWorldObjectType === 'function'
            ? game.inferWorldObjectType(target)
            : null;
          const destructibility = typeof game.resolveWorldObjectDestructibility === 'function'
            ? game.resolveWorldObjectDestructibility(target, {
              typeHint,
              reason: 'fury_of_havoc_mass_destroy_scan'
            })
            : { destructible: !!target?.defId, objectType: typeHint || 'unknown' };
          if (!destructibility?.destructible) {
            blocked.push({
              id: String(target?.id || target?.type || target?.typeId || destructibility?.objectType || 'unknown'),
              objectType: destructibility?.objectType || typeHint || 'unknown',
              reason: destructibility?.protectedReason || destructibility?.unsupportedReason || 'not_destructible'
            });
            continue;
          }
          out.push({
            target,
            typeHint: destructibility?.objectType || typeHint || null
          });
        }
      }
      state.blockedObjects = blocked.slice(-25);
      return out;
    };
    const queueMassDestroy = (game, state) => {
      state.pendingDestroyQueue = collectVisibleDestructibles(game, state);
      state.massDestroyActive = state.pendingDestroyQueue.length > 0;
      state.lastMassDestroyAt = toFiniteNumber(game.time, 0);
      state.triggerCount = toFiniteNumber(state.triggerCount, 0) + 1;
      game.pushPillarDebugEntry?.('__pillarFuryOfHavocEvents', {
        at: game.time,
        action: 'mass_destroy_queued',
        queued: state.pendingDestroyQueue.length,
        blocked: state.blockedObjects.length
      }, 40);
    };
    const handleFuryGain = (payload, game) => {
      const state = ensureState(game);
      if (state.massDestroyActive || isMassDestroyPayload(payload)) {
        return payload;
      }
      const maxHp = Math.max(1, toFiniteNumber(game?.currentStats?.maxHealth, 1));
      const selfDamage = Math.max(1, Math.round(maxHp * 0.05));
      state.lastSelfDamage = selfDamage;
      if (typeof game.applySelfDamage === 'function') {
        game.applySelfDamage(selfDamage, {
          sourceType: 'pillar_fury_of_havoc',
          reason: 'fury_of_havoc_destroy_cost',
          effectKey,
          canKill: true,
          bypassMitigation: true,
          tags: ['fury_of_havoc']
        });
      }
      state.fury = Math.max(0, Math.floor(toFiniteNumber(state.fury, 0))) + 1;
      if (state.fury >= 10) {
        state.fury = 0;
        state.lastResetAt = toFiniteNumber(game.time, 0);
        queueMassDestroy(game, state);
      }
      game.pushPillarDebugEntry?.('__pillarFuryOfHavocEvents', {
        at: game.time,
        action: 'fury_increment',
        fury: state.fury,
        selfDamage
      }, 40);
      return payload;
    };

    builder.addHook('afterDestroyObject', (payload, game) => {
      return handleFuryGain(payload, game);
    });
    builder.addHook('afterKillEnemy', (payload, game) => handleFuryGain(payload, game));

    builder.addHook('onTick', (payload, game) => {
      const state = ensureState(game);
      if (!state.massDestroyActive || !Array.isArray(state.pendingDestroyQueue) || state.pendingDestroyQueue.length <= 0) {
        state.massDestroyActive = false;
        state.pendingDestroyQueue = [];
        state.processedInLastTick = 0;
        return payload;
      }
      const dt = Math.max(0, toFiniteNumber(payload?.dt, 0));
      const budget = Math.max(2, Math.min(50, Math.floor((dt > 0 ? dt : 1 / 60) * 180)));
      let processed = 0;
      while (processed < budget && state.pendingDestroyQueue.length > 0) {
        const next = state.pendingDestroyQueue.shift();
        processed += 1;
        if (!next?.target) continue;
        if (typeof game.isWorldObjectDestroyed === 'function' && game.isWorldObjectDestroyed(next.target)) continue;
        game.dealDamageToBreakable?.(next.target, 999999, {
          typeHint: next.typeHint || undefined,
          useDamageFacade: true,
          sourceType: 'pillar_fury_of_havoc',
          reason: 'fury_of_havoc_mass_destroy',
          effectKey,
          tags: ['fury_of_havoc', 'fury_of_havoc_mass_destroy']
        });
      }
      state.processedInLastTick = processed;
      if (state.pendingDestroyQueue.length <= 0) {
        state.massDestroyActive = false;
      }
      return payload;
    });

    builder.addInspector((game) => {
      const state = ensureState(game);
      return {
        id: 'fury_of_havoc',
        label: 'Fury of Havoc',
        fury: Math.max(0, Math.floor(toFiniteNumber(state.fury, 0))),
        threshold: 10,
        massDestroyActive: !!state.massDestroyActive,
        queuedObjects: Array.isArray(state.pendingDestroyQueue) ? state.pendingDestroyQueue.length : 0,
        processedInLastTick: Math.max(0, Math.floor(toFiniteNumber(state.processedInLastTick, 0))),
        lastSelfDamage: Math.max(0, Math.floor(toFiniteNumber(state.lastSelfDamage, 0))),
        lastResetAt: toFiniteNumber(state.lastResetAt, 0),
        lastMassDestroyAt: toFiniteNumber(state.lastMassDestroyAt, 0),
        triggerCount: Math.max(0, Math.floor(toFiniteNumber(state.triggerCount, 0))),
        blockedObjects: Array.isArray(state.blockedObjects) ? state.blockedObjects.slice(-8) : []
      };
    });

    builder.pushNote('Fury of Havoc active: each destroyed object costs 5% max HP and grants Fury; at 10 Fury, visible safe destructibles are mass-destroyed and Fury resets.');
  });

  registerPillarEffect('pillar.deep.polluting_presence', (builder) => {
    if (!builder.game.__pillarPollutingPresenceState) {
      builder.game.__pillarPollutingPresenceState = {
        tickAccumulator: 0,
        lastSelfDamage: 0,
        lastEnemyDamage: 0,
        lastTargetCount: 0,
        lastTickAt: 0
      };
    }

    builder.addHook('onTick', (payload, game) => {
      const dt = Math.max(0, toFiniteNumber(payload?.dt, 0));
      if (dt <= 0) {
        return payload;
      }
      const state = game.__pillarPollutingPresenceState || {
        tickAccumulator: 0,
        lastSelfDamage: 0,
        lastEnemyDamage: 0,
        lastTargetCount: 0,
        lastTickAt: 0
      };
      game.__pillarPollutingPresenceState = state;
      state.tickAccumulator += dt;
      let processed = false;

      while (state.tickAccumulator >= 1) {
        state.tickAccumulator -= 1;
        const maxHp = Math.max(1, toFiniteNumber(game.currentStats?.maxHealth, 1));
        const selfDamage = maxHp * 0.05;
        state.lastSelfDamage = selfDamage;
        state.lastEnemyDamage = selfDamage;
        state.lastTickAt = toFiniteNumber(game.time, 0);

        if (typeof game.applySelfDamage === 'function') {
          game.applySelfDamage(selfDamage, {
            sourceType: 'pillar',
            effectKey: 'pillar.deep.polluting_presence',
            reason: 'polluting_presence_tick',
            bypassMitigation: true,
            canKill: true,
            showFloatingText: false,
            playSfx: false,
            skipDamageFlash: true
          });
        }

        const px = toFiniteNumber(game.player?.position?.x, 0) + toFiniteNumber(game.player?.size, 0) / 2;
        const py = toFiniteNumber(game.player?.position?.y, 0) + toFiniteNumber(game.player?.size, 0) / 2;
        const targets = typeof game.enemiesInRadius === 'function'
          ? game.enemiesInRadius(px, py, 100)
          : [];
        const damagePerTarget = Math.max(1, Math.round(selfDamage));
        state.lastTargetCount = targets.length;
        for (const enemy of targets) {
          if (!enemy || enemy.isDead) {
            continue;
          }
          if (typeof game.applyDamage === 'function') {
            game.applyDamage({
              targetType: 'enemy',
              target: enemy,
              sourceEntity: game.player || null,
              sourceType: 'pillar',
              amount: damagePerTarget,
              reason: 'polluting_presence_enemy_tick',
              effectKey: 'pillar.deep.polluting_presence',
              damageClass: 'dot',
              tags: ['pillar', 'aura', 'polluting_presence'],
              opts: {
                isSkill: true,
                isDot: true,
                damageSource: 'pillar.deep.polluting_presence',
                useDamageFacade: true
              }
            });
          } else if (typeof game.dealDamageToEnemy === 'function') {
            game.dealDamageToEnemy(enemy, damagePerTarget, {
              isSkill: true,
              isDot: true,
              damageSource: 'pillar.deep.polluting_presence'
            });
          }
        }
        processed = true;
      }

      if (processed) {
        logTrace(game, 'event', {
          hookName: 'polluting_presence_tick',
          payload: {
            selfDamage: state.lastSelfDamage,
            enemyDamage: state.lastEnemyDamage,
            targetCount: state.lastTargetCount
          },
          handlerCount: 1
        });
      }
      return payload;
    });

    builder.addInspector((game) => {
      const state = game.__pillarPollutingPresenceState || null;
      if (!state) {
        return null;
      }
      return {
        id: 'polluting_presence',
        label: 'Polluting Presence',
        nextTickIn: Math.max(0, Math.round((1 - toFiniteNumber(state.tickAccumulator, 0)) * 100) / 100),
        lastSelfDamage: Math.round(toFiniteNumber(state.lastSelfDamage, 0) * 100) / 100,
        lastEnemyDamage: Math.round(toFiniteNumber(state.lastEnemyDamage, 0) * 100) / 100,
        lastTargetCount: toFiniteNumber(state.lastTargetCount, 0),
        lastTickAt: toFiniteNumber(state.lastTickAt, 0)
      };
    });

    builder.pushNote('Polluting Presence active: every second, lose 5% max HP and pulse equal damage to nearby enemies.');
  });

  registerPillarEffect('pillar.havoc.chain_detonation', (builder) => {
    if (!builder.game.__pillarChainDetonationState) {
      builder.game.__pillarChainDetonationState = {
        explosionCount: 0,
        lastExplosion: null
      };
    }

    const detonate = (game, centerX, centerY, sourceMaxHp, sourceType) => {
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
        return;
      }
      game.__pillarChainDetonationDepth = Math.max(0, Number(game.__pillarChainDetonationDepth) || 0);
      if (game.__pillarChainDetonationDepth > 6) {
        return;
      }
      const baseHp = Math.max(1, toFiniteNumber(sourceMaxHp, 50));
      const damage = Math.max(1, Math.round(baseHp * 0.2));
      const radius = 95;
      const state = game.__pillarChainDetonationState || {
        explosionCount: 0,
        lastExplosion: null
      };
      game.__pillarChainDetonationState = state;
      const targets = typeof game.enemiesInRadius === 'function'
        ? game.enemiesInRadius(centerX, centerY, radius)
        : [];
      game.__pillarChainDetonationDepth += 1;
      for (const enemy of targets) {
        if (!enemy || enemy.isDead) {
          continue;
        }
        if (typeof game.applyDamage === 'function') {
          game.applyDamage({
            targetType: 'enemy',
            target: enemy,
            sourceEntity: null,
            sourceType: 'pillar',
            amount: damage,
            reason: 'chain_detonation_explosion',
            effectKey: 'pillar.havoc.chain_detonation',
            damageClass: 'explosion',
            tags: ['pillar', 'explosion', 'chain_detonation'],
            opts: {
              isSkill: true,
              damageSource: 'pillar.havoc.chain_detonation',
              triggeredCast: true,
              allowTriggeredProcs: false,
              useDamageFacade: true
            }
          });
        } else if (typeof game.dealDamageToEnemy === 'function') {
          game.dealDamageToEnemy(enemy, damage, {
            isSkill: true,
            damageSource: 'pillar.havoc.chain_detonation',
            triggeredCast: true,
            allowTriggeredProcs: false
          });
        }
      }
      game.__pillarChainDetonationDepth -= 1;

      state.explosionCount += 1;
      state.lastExplosion = {
        at: toFiniteNumber(game.time, 0),
        sourceType,
        radius,
        damage,
        targetCount: targets.length
      };
      logTrace(game, 'event', {
        hookName: 'chain_detonation_explosion',
        payload: summarizePayload(state.lastExplosion),
        handlerCount: 1
      });
    };

    builder.addHook('afterKillEnemy', (payload, game) => {
      const enemy = payload?.enemy;
      if (!enemy || !enemy.position) {
        return payload;
      }
      const x = toFiniteNumber(enemy.position.x, 0) + toFiniteNumber(enemy.size, 0) / 2;
      const y = toFiniteNumber(enemy.position.y, 0) + toFiniteNumber(enemy.size, 0) / 2;
      detonate(game, x, y, enemy.maxHealth, 'enemy');
      return payload;
    });

    builder.addHook('afterDestroyObject', (payload, game) => {
      const object = payload?.object;
      if (!object) {
        return payload;
      }
      const ox = Number.isFinite(object.x) ? object.x : object?.position?.x;
      const oy = Number.isFinite(object.y) ? object.y : object?.position?.y;
      if (!Number.isFinite(ox) || !Number.isFinite(oy)) {
        return payload;
      }
      const x = toFiniteNumber(ox, 0) + toFiniteNumber(object.w ?? object.size?.w ?? object.size ?? object.width ?? 0, 0) / 2;
      const y = toFiniteNumber(oy, 0) + toFiniteNumber(object.h ?? object.size?.h ?? object.size ?? object.height ?? 0, 0) / 2;
      const fallbackMaxHp = payload?.finalDamage ? toFiniteNumber(payload.finalDamage, 1) * 5 : 50;
      detonate(game, x, y, object.maxHealth ?? fallbackMaxHp, 'breakable');
      return payload;
    });

    builder.addInspector((game) => {
      const state = game.__pillarChainDetonationState || null;
      if (!state) {
        return null;
      }
      return {
        id: 'chain_detonation',
        label: 'Chain Detonation',
        explosionCount: toFiniteNumber(state.explosionCount, 0),
        lastExplosion: state.lastExplosion || null
      };
    });

    builder.pushNote('Chain Detonation active: killed enemies and destroyed objects emit HP-scaled explosions.');
    builder.pushNote('TODO: if breakable max HP is unavailable in a source, fallback estimation is used for explosion damage.');
  });

  registerPillarEffect('pillar.havoc.unmake_the_world', (builder) => {
    const SUPPORTED_CLASSES = new Set(['breakable', 'obstacle', 'searchable_prop']);
    const PROTECTED_TYPES = new Set([
      'exit',
      'portal',
      'victoryPortal',
      'shop',
      'socketWorkshop',
      'foresightShrine',
      'perfectionWorkshop',
      'shrine'
    ]);

    const inferTypeHint = (target, fallbackType = 'unknown') => {
      if (!target || typeof target !== 'object') {
        return fallbackType;
      }
      if (target.defId) return 'breakable';
      if (target.typeDef && target.size?.w != null) return 'obstacle';
      if (target.typeId && target.width != null && target.height != null) return 'searchable_prop';
      if (target.type && target.w != null && target.h != null) return 'map_object';
      return fallbackType;
    };

    const resolveHiddenHp = (target, payload = {}) => {
      const directMax = toFiniteNumber(target?.__pillarDestructibleMaxHp ?? payload?.maxHp, 0);
      if (directMax > 0) {
        return {
          maxHp: directMax,
          hp: Math.max(0, toFiniteNumber(target?.__pillarDestructibleHp ?? payload?.hp, directMax)),
          source: 'cached'
        };
      }
      const width = Math.max(1, toFiniteNumber(target?.size?.w ?? target?.width ?? target?.w ?? target?.size, 32));
      const height = Math.max(1, toFiniteNumber(target?.size?.h ?? target?.height ?? target?.h ?? target?.size, 32));
      const area = width * height;
      const computedMaxHp = Math.max(20, Math.min(500, Math.round(area / 50)));
      return {
        maxHp: computedMaxHp,
        hp: computedMaxHp,
        source: 'computed_from_bounds'
      };
    };

    builder.addHook('resolveDestructibility', (payload) => {
      const target = payload?.target || null;
      const objectType = inferTypeHint(target, String(payload?.objectType || 'unknown'));
      const objectTypeName = String(target?.type || target?.typeId || objectType);
      const protectedByType = PROTECTED_TYPES.has(objectTypeName);
      const protectedByTag = !!(payload?.protected || payload?.protectedReason || target?.isCritical || target?.isExit || target?.isPortal || target?.isBoundary);
      if (protectedByType || protectedByTag) {
        return {
          ...(payload || {}),
          objectType,
          destructible: false,
          protected: true,
          protectedReason: payload?.protectedReason || (protectedByType ? 'protected_world_object_type' : 'critical_world_object'),
          unsupportedReason: null
        };
      }

      if (SUPPORTED_CLASSES.has(objectType)) {
        if (objectType === 'breakable') {
          return {
            ...(payload || {}),
            objectType,
            destructible: true,
            nativeDestructible: true,
            grantedByPillar: false,
            unsupportedReason: null
          };
        }
        const hiddenHp = resolveHiddenHp(target, payload);
        return {
          ...(payload || {}),
          objectType,
          destructible: true,
          nativeDestructible: !!payload?.nativeDestructible,
          grantedByPillar: true,
          hp: hiddenHp.hp,
          maxHp: hiddenHp.maxHp,
          hpSource: hiddenHp.source,
          unsupportedReason: null,
          reason: 'unmake_the_world_granted'
        };
      }

      return {
        ...(payload || {}),
        objectType,
        destructible: false,
        unsupportedReason: 'unsupported_object_class',
        reason: 'unmake_the_world_unsupported'
      };
    });

    builder.addInspector((game) => {
      const preview = typeof game.getPillarDestructibilityDebugSummary === 'function'
        ? game.getPillarDestructibilityDebugSummary()
        : null;
      const worldEvents = Array.isArray(game.__pillarWorldDestructionEvents)
        ? game.__pillarWorldDestructionEvents.slice(-6)
        : [];
      return {
        id: 'unmake_the_world',
        label: 'Unmake the World',
        stagedSupportedClasses: ['breakable', 'obstacle', 'searchable_prop'],
        protectedTypes: [...PROTECTED_TYPES],
        lastDestructibilityPreview: preview,
        recentWorldEvents: worldEvents
      };
    });

    builder.pushNote('Unmake the World active: supported world-object classes gain destructibility through the central resolver (with protected-object immunity).');
    builder.pushNote('Unmake safety: unsupported object classes fail safe and report explicit unsupported reasons through debug/inspector.');
  });

  registerPillarEffect('pillar.void.skill_singularity', (builder) => {
    builder.setFlag('basicAttackDisabled', true);
    builder.addHook('modifySkillCharges', (payload) => {
      const charges = Math.max(0, Math.floor(toFiniteNumber(payload?.charges, 0)));
      return {
        ...(payload || {}),
        charges: charges + 2,
        reason: 'skill_singularity'
      };
    });
    builder.pushNote('Skill Singularity active: basic attacks disabled, all skills gain +2 charges.');
  });

  registerPillarEffect('pillar.void.untouchable_dash', (builder) => {
    builder.addHook('beforeTakeDamage', (payload, game) => {
      const dashing = !!(game?.dashActive || game?.bladeDashActive);
      if (!dashing) {
        return payload;
      }
      return {
        ...(payload || {}),
        cancel: true,
        reason: 'untouchable_dash_invulnerability'
      };
    });

    builder.addHook('canEnemyTargetPlayer', (payload, game) => {
      const enemy = payload?.enemy || null;
      if (!enemy || isEnemyBossLike(enemy, game)) {
        return payload;
      }
      const dashing = !!(game?.dashActive || game?.bladeDashActive);
      if (!dashing) {
        return payload;
      }
      return {
        ...(payload || {}),
        allowed: false,
        reason: 'untouchable_dash_enemy_ignore'
      };
    });

    builder.addInspector((game) => ({
      id: 'untouchable_dash',
      label: 'Untouchable Dash',
      active: !!(game?.dashActive || game?.bladeDashActive)
    }));

    builder.pushNote('Untouchable Dash active: while dashing, damage is prevented and non-boss enemies cannot target you.');
  });

  registerPillarEffect('pillar.void.void_walker', (builder) => {
    builder.multiplyStat('maxHealthMultiplier', 0.5);
    builder.setFlag('infiniteDashCharges', true);

    builder.addHook('modifyDashCost', (payload) => {
      return {
        ...(payload || {}),
        cost: 0,
        reason: 'void_walker'
      };
    });

    builder.addHook('onDashStarted', (payload, game) => {
      const damage = 5;
      if (typeof game.applySelfDamage === 'function') {
        game.applySelfDamage(damage, {
          sourceType: 'pillar',
          effectKey: 'pillar.void.void_walker',
          reason: 'void_walker_dash_cost',
          bypassMitigation: true,
          canKill: true,
          showFloatingText: true,
          playSfx: false
        });
      } else if (typeof game.onPlayerDamaged === 'function') {
        game.onPlayerDamaged(damage, false, {
          sourceType: 'pillar',
          effectKey: 'pillar.void.void_walker',
          reason: 'void_walker_dash_cost_fallback'
        });
      }
      return payload;
    });

    builder.pushNote('Void Walker active: dash cost removed, max HP reduced by 50%, dashing inflicts 5 self-damage.');
  });

  registerPillarEffect('pillar.void.void_discrimination', (builder) => {
    builder.addHook('beforeTakeDamage', (payload, game) => {
      const rawAmount = toFiniteNumber(payload?.rawAmount, 0);
      if (rawAmount <= 0 || !payload?.fromEnemy) {
        return payload;
      }
      const sourceEntity = payload?.sourceEntity || null;
      if (!sourceEntity) {
        return payload;
      }
      if (isEnemyMinionLike(sourceEntity)) {
        return payload;
      }
      const nextAmount = Math.max(0, Math.round(rawAmount * 0.5));
      logTrace(game, 'contribution', {
        type: 'void_discrimination_incoming',
        from: rawAmount,
        to: nextAmount
      });
      return {
        ...(payload || {}),
        rawAmount: nextAmount,
        reason: 'void_discrimination_incoming_non_minion'
      };
    });

    builder.addHook('beforeDealDamage', (payload, game) => {
      const amount = toFiniteNumber(payload?.amount, 0);
      const enemy = payload?.enemy || null;
      if (amount <= 0 || !enemy || !isEnemyMinionLike(enemy)) {
        return payload;
      }
      const nextAmount = Math.max(0, Math.round(amount * 0.2));
      logTrace(game, 'contribution', {
        type: 'void_discrimination_outgoing',
        from: amount,
        to: nextAmount
      });
      return {
        ...(payload || {}),
        amount: nextAmount,
        reason: 'void_discrimination_outgoing_minion'
      };
    });

    builder.addInspector(() => ({
      id: 'void_discrimination',
      label: 'Void Discrimination',
      incomingNonMinionMultiplier: 0.5,
      outgoingMinionMultiplier: 0.2
    }));

    builder.pushNote('Void Discrimination active: incoming damage from non-minion enemies reduced to 50%; outgoing damage to minions reduced to 20%.');
    builder.pushNote('TODO: if enemy minion classification is missing in a source, the effect fails open and applies no modifier.');
  });

  registerPillarEffect('pillar.limitless.exponential_growth', (builder) => {
    builder.addHook('modifyStackGain', (payload) => {
      const gain = toFiniteNumber(payload?.gain ?? payload?.baseGain, 0);
      if (gain <= 0) {
        return payload;
      }
      return {
        ...(payload || {}),
        gain: gain * 2,
        reason: 'exponential_growth'
      };
    });
    builder.pushNote('Exponential Growth active: stack gains are doubled.');
  });

  registerPillarEffect('pillar.limitless.no_limits', (builder) => {
    builder.addHook('resolveStackCap', (payload) => {
      if (payload?.targetType !== 'player') {
        return payload;
      }
      const currentMax = toFiniteNumber(payload?.maxStacks, 0);
      return {
        ...(payload || {}),
        maxStacks: Math.max(999, currentMax),
        reason: 'no_limits_cap_override'
      };
    });

    builder.addInspector(() => ({
      id: 'no_limits',
      label: 'No Limits',
      active: true,
      playerStackCapOverride: 999
    }));

    builder.pushNote('No Limits active: player buff/debuff stack caps resolve to 999 through central stack cap rules.');
  });

  registerPillarEffect('pillar.pacifier.gentle_presence', (builder) => {
    if (!builder.game.__pillarGentlePresenceState) {
      builder.game.__pillarGentlePresenceState = {
        provokedEnemyIds: new Set(),
        lastProvokedEnemyId: null
      };
    }

    const getState = (game) => {
      if (!game.__pillarGentlePresenceState) {
        game.__pillarGentlePresenceState = {
          provokedEnemyIds: new Set(),
          lastProvokedEnemyId: null
        };
      }
      return game.__pillarGentlePresenceState;
    };

    builder.addHook('afterDealDamage', (payload, game) => {
      if (payload?.source !== 'player') {
        return payload;
      }
      const dealt = toFiniteNumber(payload?.finalDamage ?? payload?.damage, 0);
      const enemy = payload?.enemy || null;
      if (!enemy || dealt <= 0) {
        return payload;
      }
      const state = getState(game);
      if (enemy.id != null) {
        state.provokedEnemyIds.add(enemy.id);
        state.lastProvokedEnemyId = enemy.id;
      }
      return payload;
    });

    builder.addHook('canEnemyTargetPlayer', (payload, game) => {
      const enemy = payload?.enemy || null;
      if (!enemy || isEnemyBossLike(enemy, game)) {
        return payload;
      }
      const shouldIgnore = (isEnemyMinionLike(enemy) || isEnemyEliteLike(enemy))
        && !(getState(game).provokedEnemyIds.has(enemy.id));
      if (!shouldIgnore) {
        return payload;
      }
      return {
        ...(payload || {}),
        allowed: false,
        reason: 'gentle_presence_ignore_until_damaged'
      };
    });

    builder.addInspector((game) => {
      const state = getState(game);
      return {
        id: 'gentle_presence',
        label: 'Gentle Presence',
        provokedCount: state.provokedEnemyIds.size,
        lastProvokedEnemyId: state.lastProvokedEnemyId
      };
    });

    builder.pushNote('Gentle Presence active: minions/elites ignore player until damaged (bosses excluded).');
  });

  registerPillarEffect('pillar.pacifier.harmony_of_stillness', (builder) => {
    if (!builder.game.__pillarHarmonyOfStillnessState) {
      builder.game.__pillarHarmonyOfStillnessState = {
        lastDamageAt: toFiniteNumber(builder.game.time, 0),
        activeStacks: 0,
        activeBonus: 0
      };
    }

    const getState = (game) => {
      if (!game.__pillarHarmonyOfStillnessState) {
        game.__pillarHarmonyOfStillnessState = {
          lastDamageAt: toFiniteNumber(game.time, 0),
          activeStacks: 0,
          activeBonus: 0
        };
      }
      return game.__pillarHarmonyOfStillnessState;
    };

    const getIncreasedDamagePct = (game) => {
      const baseAttack = Math.max(1, toFiniteNumber(game.baseStats?.attack, 1));
      const currentAttack = Math.max(1, toFiniteNumber(game.currentStats?.attack, baseAttack));
      const pct = ((currentAttack / baseAttack) - 1) * 100;
      return Math.max(0, pct);
    };

    builder.addHook('afterDealDamage', (payload, game) => {
      const dealt = toFiniteNumber(payload?.finalDamage ?? payload?.damage, 0);
      if (payload?.source !== 'player' || dealt <= 0) {
        return payload;
      }
      const state = getState(game);
      state.lastDamageAt = toFiniteNumber(game.time, 0);
      if (state.activeStacks !== 0 || state.activeBonus !== 0) {
        state.activeStacks = 0;
        state.activeBonus = 0;
        if (typeof game.recalculateStats === 'function') {
          game.recalculateStats();
        }
      }
      return payload;
    });

    builder.addHook('onTick', (payload, game) => {
      const state = getState(game);
      const now = toFiniteNumber(game.time, 0);
      const idleFor = now - toFiniteNumber(state.lastDamageAt, now);
      let stacks = 0;
      if (idleFor >= 6) {
        const increasedDamagePct = getIncreasedDamagePct(game);
        stacks = Math.max(0, Math.floor(increasedDamagePct / 3));
      }
      const bonus = stacks * 0.01;
      if (stacks !== state.activeStacks || bonus !== state.activeBonus) {
        state.activeStacks = stacks;
        state.activeBonus = bonus;
        if (typeof game.recalculateStats === 'function') {
          game.recalculateStats();
        }
      }
      return payload;
    });

    builder.addHook('modifyPlayerStats', (payload, game) => {
      const state = getState(game);
      const bonus = toFiniteNumber(state.activeBonus, 0);
      if (bonus <= 0) {
        return payload;
      }
      const stats = { ...(payload?.stats || {}) };
      stats.maxHealth = Math.max(1, Math.round(toFiniteNumber(stats.maxHealth, 1) * (1 + bonus)));
      stats.defense = Math.max(0, Math.round(toFiniteNumber(stats.defense, 0) * (1 + bonus)));
      return {
        ...(payload || {}),
        stats
      };
    });

    builder.addHook('getMoveSpeedMultiplier', (payload, game) => {
      const state = getState(game);
      const bonus = toFiniteNumber(state.activeBonus, 0);
      if (bonus <= 0) {
        return payload;
      }
      const current = toPositiveMultiplier(payload?.multiplier, 1);
      return {
        ...(payload || {}),
        multiplier: current * (1 + bonus),
        reason: 'harmony_of_stillness_move_speed'
      };
    });

    builder.addHook('onChestOpened', (payload, game) => {
      if (typeof game.grantXP === 'function') {
        game.grantXP(10);
      }
      return payload;
    });

    builder.addInspector((game) => {
      const state = getState(game);
      const now = toFiniteNumber(game.time, 0);
      return {
        id: 'harmony_of_stillness',
        label: 'Harmony of Stillness',
        idleFor: Math.max(0, Math.round((now - toFiniteNumber(state.lastDamageAt, now)) * 100) / 100),
        activeStacks: state.activeStacks,
        activeBonusPct: Math.round(toFiniteNumber(state.activeBonus, 0) * 10000) / 100
      };
    });

    builder.pushNote('Harmony of Stillness active: after 6s without dealing damage, gain scaling move speed/defense/max HP and chest-open XP.');
  });

  registerPillarEffect('pillar.pacifier.false_peace', (builder) => {
    if (!builder.game.__pillarFalsePeaceState) {
      builder.game.__pillarFalsePeaceState = {
        state: 'waiting',
        lastDamageAt: toFiniteNumber(builder.game.time, 0),
        readyAt: 0,
        empoweredHitPending: false
      };
    }

    const getState = (game) => {
      if (!game.__pillarFalsePeaceState) {
        game.__pillarFalsePeaceState = {
          state: 'waiting',
          lastDamageAt: toFiniteNumber(game.time, 0),
          readyAt: 0,
          empoweredHitPending: false
        };
      }
      return game.__pillarFalsePeaceState;
    };

    builder.addHook('afterDealDamage', (payload, game) => {
      const dealt = toFiniteNumber(payload?.finalDamage ?? payload?.damage, 0);
      if (payload?.source !== 'player' || payload?.isDot || dealt <= 0) {
        return payload;
      }
      const state = getState(game);
      state.lastDamageAt = toFiniteNumber(game.time, 0);
      if (state.state !== 'waiting') {
        state.state = 'waiting';
        state.empoweredHitPending = false;
        state.readyAt = 0;
      }
      return payload;
    });

    builder.addHook('beforeDealDamage', (payload, game) => {
      if (payload?.source !== 'player' || payload?.isDot) {
        return payload;
      }
      const state = getState(game);
      if (!state.empoweredHitPending) {
        return payload;
      }
      const amount = Math.max(0, toFiniteNumber(payload?.amount, 0));
      state.empoweredHitPending = false;
      state.state = 'waiting';
      state.lastDamageAt = toFiniteNumber(game.time, 0);
      state.readyAt = 0;
      return {
        ...(payload || {}),
        amount: Math.max(1, Math.round(amount * 11)),
        reason: 'false_peace_empowered'
      };
    });

    builder.addHook('onTick', (payload, game) => {
      const state = getState(game);
      const now = toFiniteNumber(game.time, 0);
      if (state.state === 'ready') {
        return payload;
      }
      if (now - toFiniteNumber(state.lastDamageAt, now) < 6) {
        return payload;
      }
      state.state = 'ready';
      state.readyAt = now;
      state.empoweredHitPending = true;
      if (typeof game.refreshAllSkillCooldownsFromPillar === 'function') {
        game.refreshAllSkillCooldownsFromPillar('pillar.pacifier.false_peace');
      } else if (Array.isArray(game.skillCooldowns)) {
        game.skillCooldowns = game.skillCooldowns.map(() => 0);
      }
      if (typeof game.updateSkillUI === 'function') {
        game.updateSkillUI();
      }
      return payload;
    });

    builder.addInspector((game) => {
      const state = game.__pillarFalsePeaceState || null;
      if (!state) {
        return null;
      }
      const now = toFiniteNumber(game.time, 0);
      const waitRemaining = Math.max(0, Math.round((6 - (now - toFiniteNumber(state.lastDamageAt, now))) * 100) / 100);
      return {
        id: 'false_peace',
        label: 'False Peace',
        state: state.state,
        empoweredHitPending: !!state.empoweredHitPending,
        waitRemaining
      };
    });

    builder.pushNote('False Peace active: after 6s without dealing damage, cooldowns refresh and next hit deals +1000% damage.');
  });

  registerPillarEffect('pillar.collector.hoarders_arsenal', (builder) => {
    if (!builder.game.__pillarHoardersArsenalState) {
      builder.game.__pillarHoardersArsenalState = {
        armorGoldByItem: Object.create(null),
        pendingGoldFraction: 0,
        totalGrantedGold: 0
      };
    }

    const countInventoryByType = (game, type) =>
      (Array.isArray(game.inventory) ? game.inventory : []).filter((item) => item?.type === type).length;

    builder.addHook('modifyChestOpenSpeed', (payload, game) => {
      const helmets = countInventoryByType(game, 'Helmet');
      if (helmets <= 0) {
        return payload;
      }
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1) * (1 + helmets * 0.05);
      return {
        ...(payload || {}),
        multiplier,
        reason: 'hoarders_arsenal_helmet'
      };
    });

    builder.addHook('getMoveSpeedMultiplier', (payload, game) => {
      const boots = countInventoryByType(game, 'Boots');
      if (boots <= 0) {
        return payload;
      }
      const multiplier = toPositiveMultiplier(payload?.multiplier, 1) * (1 + boots * 0.01);
      return {
        ...(payload || {}),
        multiplier,
        reason: 'hoarders_arsenal_boots'
      };
    });

    builder.addHook('beforeDealObjectDamage', (payload, game) => {
      const weapons = countInventoryByType(game, 'Weapon');
      if (weapons <= 0) {
        return payload;
      }
      const amount = toFiniteNumber(payload?.amount, 0);
      return {
        ...(payload || {}),
        amount: Math.max(0, Math.round(amount * (1 + weapons * 0.05))),
        reason: 'hoarders_arsenal_weapon'
      };
    });

    builder.addHook('onTick', (payload, game) => {
      const dt = Math.max(0, toFiniteNumber(payload?.dt, 0));
      if (dt <= 0) {
        return payload;
      }
      const state = game.__pillarHoardersArsenalState || {
        armorGoldByItem: Object.create(null),
        pendingGoldFraction: 0,
        totalGrantedGold: 0
      };
      game.__pillarHoardersArsenalState = state;

      const inventory = Array.isArray(game.inventory) ? game.inventory : [];
      const bodyArmors = inventory.filter((item) => item?.type === 'Body Armour');
      let generatedGold = 0;
      for (let i = 0; i < bodyArmors.length; i++) {
        const armor = bodyArmors[i];
        const itemKey = String(armor?.id ?? `${armor?.name || 'armor'}_${i}`);
        const earned = toFiniteNumber(state.armorGoldByItem[itemKey], 0);
        if (earned >= 30) {
          continue;
        }
        const add = Math.min(30 - earned, dt);
        state.armorGoldByItem[itemKey] = earned + add;
        generatedGold += add;
      }
      state.pendingGoldFraction = toFiniteNumber(state.pendingGoldFraction, 0) + generatedGold;
      const wholeGold = Math.floor(state.pendingGoldFraction);
      if (wholeGold > 0) {
        state.pendingGoldFraction -= wholeGold;
        state.totalGrantedGold += wholeGold;
        game.gold = Math.max(0, toFiniteNumber(game.gold, 0) + wholeGold);
        if (typeof game.updateMapUI === 'function') {
          game.updateMapUI();
        }
      }
      return payload;
    });

    builder.addInspector((game) => {
      const inventory = Array.isArray(game.inventory) ? game.inventory : [];
      const state = game.__pillarHoardersArsenalState || null;
      return {
        id: 'hoarders_arsenal',
        label: 'Hoarderâ€™s Arsenal',
        counts: {
          helmets: inventory.filter((item) => item?.type === 'Helmet').length,
          bodyArmours: inventory.filter((item) => item?.type === 'Body Armour').length,
          weapons: inventory.filter((item) => item?.type === 'Weapon').length,
          boots: inventory.filter((item) => item?.type === 'Boots').length
        },
        totalGrantedGold: toFiniteNumber(state?.totalGrantedGold, 0),
        pendingGoldFraction: Math.round(toFiniteNumber(state?.pendingGoldFraction, 0) * 1000) / 1000
      };
    });

    builder.pushNote('Hoarderâ€™s Arsenal active: inventory categories grant chest speed, movement speed, breakable damage, and passive gold gain.');
  });

  registerPillarEffect('pillar.collector.grand_bazaar', (builder) => {
    builder.addHook('getPricingModifiers', (payload) => {
      const currentSpawnMult = toPositiveMultiplier(payload?.npcSpawnCapMultiplier, 1);
      const currentPriceMult = toPositiveMultiplier(payload?.npcPriceMultiplier, 1);
      const currentOverride = Number(payload?.npcSpawnCapOverride);
      return {
        ...(payload || {}),
        npcSpawnCapMultiplier: currentSpawnMult * 7.5,
        npcSpawnCapOverride: Number.isFinite(currentOverride)
          ? Math.max(15, Math.floor(currentOverride))
          : 15,
        npcPriceMultiplier: currentPriceMult * 2,
        reason: 'grand_bazaar'
      };
    });
    builder.addInspector((game) => {
      const pricing = typeof game.getPillarPricingModifiers === 'function'
        ? game.getPillarPricingModifiers()
        : { npcSpawnCapMultiplier: 1, npcPriceMultiplier: 1, npcSpawnCapOverride: null };
      const spawnDebug = game.__pillarNpcSpawnDebug || null;
      return {
        id: 'grand_bazaar',
        label: 'Grand Bazaar',
        effectiveNpcSpawnCap: Number.isFinite(Number(pricing?.npcSpawnCapOverride))
          ? Math.max(0, Math.floor(Number(pricing.npcSpawnCapOverride)))
          : Math.max(0, Math.floor(2 * toPositiveMultiplier(pricing?.npcSpawnCapMultiplier, 1))),
        npcPriceMultiplier: toPositiveMultiplier(pricing?.npcPriceMultiplier, 1),
        currentMapSpawnState: spawnDebug
      };
    });
    builder.pushNote('Grand Bazaar active: NPC spawn cap is raised to 15 and NPC service prices are doubled through central pricing modifiers.');
  });

  registerPillarEffect('pillar.cascade.amplified_triggers', (builder) => {
    builder.addHook('modifyTriggerChance', (payload) => {
      const chance = toFiniteNumber(payload?.chance, 0);
      if (chance <= 0) {
        return payload;
      }
      return {
        ...(payload || {}),
        chance: Math.max(0, Math.min(1, chance * 1.5)),
        reason: 'amplified_triggers'
      };
    });
    builder.pushNote('Amplified Triggers active: trigger chances are multiplied by 1.5x.');
  });

  registerPillarEffect('pillar.cascade.chain_reaction', (builder) => {
    if (!builder.game.__pillarCascadeChainState) {
      builder.game.__pillarCascadeChainState = {
        depth: 0,
        lastTrigger: null,
        triggerCount: 0,
        lastBlockedReason: null
      };
    }

    const mapping = {
      0: { nextSlot: 1, chance: 0.10 },
      1: { nextSlot: 2, chance: 0.05 },
      2: { nextSlot: 3, chance: 0.02 }
    };

    builder.addHook('onSkillCast', (payload, game) => {
      const slot = Number(payload?.slot);
      if (!Number.isFinite(slot) || payload?.triggeredCast !== true) {
        return payload;
      }
      if (payload?.options?.wildCascadeTriggered === true) {
        const state = game.__pillarCascadeChainState || {};
        state.lastBlockedReason = 'wild_cascade_guard';
        game.__pillarCascadeChainState = state;
        return payload;
      }
      const mapEntry = mapping[slot];
      if (!mapEntry) {
        return payload;
      }
      const state = game.__pillarCascadeChainState || {
        depth: 0,
        lastTrigger: null,
        triggerCount: 0,
        lastBlockedReason: null
      };
      game.__pillarCascadeChainState = state;
      const procGate = acquireProcBudget(game, {
        source: 'chain_reaction',
        uniqueKey: `chain_reaction_${slot}_${mapEntry.nextSlot}`,
        maxDepth: 8,
        maxPerFrame: 16,
        preventReentry: true
      });
      if (!procGate.allowed) {
        state.lastBlockedReason = `proc_${procGate.blockedReason}`;
        return payload;
      }
      const nextSkillId = game.skills?.[mapEntry.nextSlot];
      if (!nextSkillId) {
        state.lastBlockedReason = 'missing_next_skill';
        releaseProcBudget(game, procGate.token);
        return payload;
      }
      const chance = typeof game.resolvePillarTriggerChance === 'function'
        ? game.resolvePillarTriggerChance(mapEntry.chance, {
          triggerType: 'cascade_chain_reaction',
          sourceSlot: slot,
          targetSlot: mapEntry.nextSlot
        })
        : mapEntry.chance;
      if (Math.random() >= chance) {
        state.lastBlockedReason = 'chance_failed';
        releaseProcBudget(game, procGate.token);
        return payload;
      }
      state.depth = toFiniteNumber(procGate.state?.depth, 0);
      state.triggerCount += 1;
      state.lastBlockedReason = null;
      state.lastTrigger = {
        at: toFiniteNumber(game.time, 0),
        sourceSlot: slot,
        targetSlot: mapEntry.nextSlot,
        chance
      };
      if (typeof game.executeSkill === 'function') {
        try {
          game.executeSkill(nextSkillId, mapEntry.nextSlot, {
            noCooldown: true,
            triggered: true,
            allowTriggeredProcs: false,
            chainCast: true
          });
        } finally {
          releaseProcBudget(game, procGate.token);
          state.depth = toFiniteNumber(procGate.state?.depth, 0);
        }
      } else {
        releaseProcBudget(game, procGate.token);
        state.depth = toFiniteNumber(procGate.state?.depth, 0);
      }
      return payload;
    });

    builder.addInspector((game) => {
      const state = game.__pillarCascadeChainState || null;
      if (!state) return null;
      return {
        id: 'chain_reaction',
        label: 'Chain Reaction',
        depth: state.depth,
        triggerCount: state.triggerCount,
        lastTrigger: state.lastTrigger,
        lastBlockedReason: state.lastBlockedReason
      };
    });

    builder.pushNote('Chain Reaction active: triggered casts can chain into the next skill slot with diminishing chance.');
  });

  registerPillarEffect('pillar.cascade.wild_cascade', (builder) => {
    if (!builder.game.__pillarWildCascadeState) {
      builder.game.__pillarWildCascadeState = {
        triggerCount: 0,
        blockedCount: 0,
        lastBlockedReason: null,
        lastRoll: null,
        recentRolls: [],
        recentBlocks: []
      };
    }

    const getState = (game) => {
      if (!game.__pillarWildCascadeState) {
        game.__pillarWildCascadeState = {
          triggerCount: 0,
          blockedCount: 0,
          lastBlockedReason: null,
          lastRoll: null,
          recentRolls: [],
          recentBlocks: []
        };
      }
      return game.__pillarWildCascadeState;
    };

    builder.addHook('onSkillCast', (payload, game) => {
      if (payload?.triggeredCast !== true) {
        return payload;
      }
      const state = getState(game);
      if (payload?.options?.wildCascadeTriggered === true) {
        state.blockedCount += 1;
        state.lastBlockedReason = 'self_recursion_guard';
        pushRingBuffer(state.recentBlocks, {
          at: toFiniteNumber(game.time, 0),
          reason: 'self_recursion_guard',
          sourceSkillId: payload?.skillId || null
        });
        return payload;
      }

      const procGate = acquireProcBudget(game, {
        source: 'wild_cascade',
        uniqueKey: `wild_cascade_${payload?.skillId || 'unknown'}`,
        maxDepth: 7,
        maxPerFrame: 10,
        preventReentry: true
      });
      if (!procGate.allowed) {
        state.blockedCount += 1;
        state.lastBlockedReason = `proc_${procGate.blockedReason}`;
        pushRingBuffer(state.recentBlocks, {
          at: toFiniteNumber(game.time, 0),
          reason: state.lastBlockedReason,
          sourceSkillId: payload?.skillId || null
        });
        return payload;
      }

      const pool = typeof game.resolveRandomTriggerSkillPool === 'function'
        ? game.resolveRandomTriggerSkillPool({
          source: 'wild_cascade',
          sourceSkillId: payload?.skillId || null,
          avoidSourceSkill: true,
          requireUnlocked: true,
          allowAura: false,
          excludeSkillIds: payload?.skillId ? [payload.skillId] : []
        })
        : { eligible: [], excluded: [] };
      state.lastPoolSample = {
        eligibleCount: toFiniteNumber(pool?.eligibleCount, Array.isArray(pool?.eligible) ? pool.eligible.length : 0),
        excludedCount: toFiniteNumber(pool?.excludedCount, Array.isArray(pool?.excluded) ? pool.excluded.length : 0),
        excludedReasons: Array.isArray(pool?.excluded)
          ? pool.excluded.slice(0, 8).map((row) => ({
            id: row?.id || null,
            reasons: Array.isArray(row?.reasons) ? row.reasons.slice(0, 4) : []
          }))
          : []
      };
      const eligible = Array.isArray(pool?.eligible) ? pool.eligible : [];
      if (eligible.length <= 0) {
        releaseProcBudget(game, procGate.token);
        state.blockedCount += 1;
        state.lastBlockedReason = 'no_eligible_skills';
        pushRingBuffer(state.recentBlocks, {
          at: toFiniteNumber(game.time, 0),
          reason: state.lastBlockedReason,
          sourceSkillId: payload?.skillId || null
        });
        return payload;
      }

      const picked = eligible[Math.floor(Math.random() * eligible.length)] || null;
      const pickedSkillId = picked?.id ? String(picked.id) : null;
      if (!pickedSkillId) {
        releaseProcBudget(game, procGate.token);
        state.blockedCount += 1;
        state.lastBlockedReason = 'invalid_random_pick';
        return payload;
      }
      const fallbackSlot = Number(payload?.slot);
      const resolvedSlot = game.skills?.findIndex((id) => id === pickedSkillId);
      const castSlot = resolvedSlot >= 0
        ? resolvedSlot
        : (Number.isFinite(fallbackSlot) ? fallbackSlot : 0);

      state.triggerCount += 1;
      state.lastBlockedReason = null;
      state.lastRoll = {
        at: toFiniteNumber(game.time, 0),
        sourceSkillId: payload?.skillId || null,
        pickedSkillId,
        castSlot,
        eligibleCount: eligible.length,
        excludedCount: Array.isArray(pool?.excluded) ? pool.excluded.length : 0
      };
      pushRingBuffer(state.recentRolls, state.lastRoll);
      logTrace(game, 'event', {
        hookName: 'wild_cascade_roll',
        payload: summarizePayload(state.lastRoll),
        handlerCount: 1
      });

      try {
        if (typeof game.executeSkill === 'function') {
          game.executeSkill(pickedSkillId, castSlot, {
            noCooldown: true,
            triggered: true,
            allowTriggeredProcs: false,
            chainCast: true,
            wildCascadeTriggered: true
          });
        }
      } finally {
        releaseProcBudget(game, procGate.token);
      }
      return payload;
    });

    builder.addInspector((game) => {
      const state = getState(game);
      const pool = typeof game.getPillarRandomSkillPoolDebugSummary === 'function'
        ? game.getPillarRandomSkillPoolDebugSummary()
        : null;
      return {
        id: 'wild_cascade',
        label: 'Wild Cascade',
        triggerCount: toFiniteNumber(state.triggerCount, 0),
        blockedCount: toFiniteNumber(state.blockedCount, 0),
        lastBlockedReason: state.lastBlockedReason || null,
        lastRoll: state.lastRoll || null,
        recentRolls: [...(state.recentRolls || [])].slice(-6),
        recentBlocks: [...(state.recentBlocks || [])].slice(-6),
        eligiblePoolSize: toFiniteNumber(pool?.eligibleCount, 0),
        excludedPoolSize: toFiniteNumber(pool?.excludedCount, 0),
        excludedReasonSample: state.lastPoolSample?.excludedReasons || []
      };
    });

    builder.pushNote('Wild Cascade active: triggered skill casts roll an eligible random skill through the centralized random-skill pool resolver.');
    builder.pushNote('Wild Cascade safety: strict proc depth/per-frame budgets and recursion guards are enforced.');
  });

  registerPillarEffect('pillar.cascade.grand_finale', (builder) => {
    if (!builder.game.__pillarGrandFinaleState) {
      builder.game.__pillarGrandFinaleState = {
        triggeredSlots: new Set(),
        burstDepth: 0,
        burstCount: 0,
        lockUntil: 0,
        lastBurstAt: 0,
        recursionGuardHits: 0,
        lastBlockedReason: null
      };
    }

    const getState = (game) => {
      if (!game.__pillarGrandFinaleState) {
        game.__pillarGrandFinaleState = {
          triggeredSlots: new Set(),
          burstDepth: 0,
          burstCount: 0,
          lockUntil: 0,
          lastBurstAt: 0,
          recursionGuardHits: 0,
          lastBlockedReason: null
        };
      }
      return game.__pillarGrandFinaleState;
    };

    builder.addHook('onSkillCast', (payload, game) => {
      const slot = Number(payload?.slot);
      if (!Number.isFinite(slot) || slot < 0 || slot > 3 || payload?.triggeredCast !== true) {
        return payload;
      }
      if (payload?.options?.wildCascadeTriggered === true) {
        const state = getState(game);
        state.lastBlockedReason = 'wild_cascade_guard';
        return payload;
      }
      const state = getState(game);
      const now = toFiniteNumber(game.time, 0);
      if (state.burstDepth > 0 || now < toFiniteNumber(state.lockUntil, 0)) {
        state.lastBlockedReason = state.burstDepth > 0 ? 'burst_depth_guard' : 'lock_guard';
        state.recursionGuardHits = toFiniteNumber(state.recursionGuardHits, 0) + 1;
        return payload;
      }
      state.triggeredSlots.add(slot);
      if (state.triggeredSlots.size < 4) {
        return payload;
      }
      const procGate = acquireProcBudget(game, {
        source: 'grand_finale',
        uniqueKey: 'grand_finale_burst',
        maxDepth: 6,
        maxPerFrame: 8,
        preventReentry: true
      });
      if (!procGate.allowed) {
        state.lastBlockedReason = `proc_${procGate.blockedReason}`;
        state.recursionGuardHits = toFiniteNumber(state.recursionGuardHits, 0) + 1;
        return payload;
      }
      state.burstDepth += 1;
      state.burstCount += 1;
      state.lastBlockedReason = null;
      state.lastBurstAt = now;
      state.lockUntil = now + 0.2;
      try {
        for (const targetSlot of [0, 1, 2, 3]) {
          const skillId = game.skills?.[targetSlot];
          if (!skillId || typeof game.executeSkill !== 'function') {
            continue;
          }
          game.executeSkill(skillId, targetSlot, {
            noCooldown: true,
            triggered: true,
            allowTriggeredProcs: false,
            chainCast: true
          });
        }
      } finally {
        releaseProcBudget(game, procGate.token);
        state.burstDepth = Math.max(0, toFiniteNumber(state.burstDepth, 0) - 1);
      }
      state.triggeredSlots.clear();
      return payload;
    });

    builder.addInspector((game) => {
      const state = game.__pillarGrandFinaleState || null;
      if (!state) return null;
      return {
        id: 'grand_finale',
        label: 'Grand Finale',
        primedSlots: Array.from(state.triggeredSlots || []),
        burstDepth: state.burstDepth,
        burstCount: state.burstCount,
        recursionGuardHits: toFiniteNumber(state.recursionGuardHits, 0),
        lastBlockedReason: state.lastBlockedReason,
        lockRemaining: Math.max(0, Math.round((toFiniteNumber(state.lockUntil, 0) - toFiniteNumber(game.time, 0)) * 100) / 100),
        lastBurstAt: state.lastBurstAt
      };
    });

    builder.pushNote('Grand Finale active: after all four triggered slots are seen, all four skills are triggered again with recursion guards.');
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
  ensureTraceStore(game);
  game.pillarRuntimeState = createRuntimeState();

  game.refreshPillarRuntimeState = function refreshPillarRuntimeState(reason = 'manual') {
    game.pillarRuntimeState = buildRuntimeState(game);
    logTrace(game, 'refresh', {
      reason,
      activeBlessings: [...game.pillarRuntimeState.activeBlessingIds],
      activeEffectKeys: [...game.pillarRuntimeState.activeEffectKeys]
    });

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

  game.setPillarTraceEnabled = function setPillarTraceEnabled(enabled) {
    const traceStore = ensureTraceStore(game);
    traceStore.enabled = !!enabled;
    return traceStore.enabled;
  };

  game.isPillarTraceEnabled = function isPillarTraceEnabled() {
    return !!ensureTraceStore(game).enabled;
  };

  game.getPillarEffectImplementationStatus = function getPillarEffectImplementationStatus(effectKey) {
    const key = String(effectKey || '');
    if (!key) {
      return { implemented: false, stub: false, unknown: true };
    }
    const status = pillarEffectImplementationStatus.get(key);
    if (!status) {
      return { implemented: false, stub: false, unknown: true };
    }
    return { ...status, unknown: false };
  };

  game.recordPillarSanitizationReport = function recordPillarSanitizationReport(report) {
    if (!report || !Array.isArray(report.actions) || report.actions.length === 0) {
      return;
    }
    for (const action of report.actions) {
      logTrace(game, 'sanitization', action);
    }
    if (game.isPillarTraceEnabled()) {
      console.warn('[PillarRuntime] Pillar save sanitization actions:', report.actions);
    }
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

  game.getPillarBreakableDamageMultiplier = function getPillarBreakableDamageMultiplier(context = {}) {
    const base = toPositiveMultiplier(game.getPillarStatModifiers().breakableDamageMultiplier, 1);
    const payload = game.runPillarEvent('getBreakableDamageMultiplier', { multiplier: base, context });
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
      npcPriceMultiplier: toPositiveMultiplier(modifiers.npcPriceMultiplier, 1),
      npcSpawnCapOverride: Number.isFinite(Number(modifiers.npcSpawnCapOverride))
        ? Math.max(0, Math.floor(Number(modifiers.npcSpawnCapOverride)))
        : null
    });
    const capOverride = Number(payload?.npcSpawnCapOverride);

    return {
      npcSpawnCapMultiplier: toPositiveMultiplier(payload?.npcSpawnCapMultiplier, 1),
      npcPriceMultiplier: toPositiveMultiplier(payload?.npcPriceMultiplier, 1),
      npcSpawnCapOverride: Number.isFinite(capOverride) ? Math.max(0, Math.floor(capOverride)) : null
    };
  };

  game.resolvePillarNpcPrice = function resolvePillarNpcPrice(baseCost, context = {}) {
    const normalizedBase = Math.max(0, Math.round(toFiniteNumber(baseCost, 0)));
    const pricing = typeof game.getPillarPricingModifiers === 'function'
      ? game.getPillarPricingModifiers()
      : { npcPriceMultiplier: 1 };
    const multipliedCost = Math.max(0, Math.round(normalizedBase * toPositiveMultiplier(pricing?.npcPriceMultiplier, 1)));
    const payload = game.runPillarEvent('resolveNpcPrice', {
      baseCost: normalizedBase,
      cost: multipliedCost,
      context,
      pricing,
      time: game.time
    });
    const finalCost = Math.max(0, Math.round(toFiniteNumber(payload?.cost, multipliedCost)));
    game.pushPillarDebugEntry?.('__pillarNpcPricingEvents', {
      at: game.time,
      baseCost: normalizedBase,
      finalCost,
      context,
      priceMultiplier: toPositiveMultiplier(pricing?.npcPriceMultiplier, 1),
      reason: payload?.reason || null
    }, 40);
    return finalCost;
  };

  game.canSellInventoryAnytime = function canSellInventoryAnytime() {
    return !!game.getPillarStatModifiers().allowSellOutsideCollector;
  };

  game.getPillarLevelUpRerolls = function getPillarLevelUpRerolls() {
    return Math.max(0, Math.floor(toFiniteNumber(game.getPillarStatModifiers().levelUpRerollsPerLevel, 0)));
  };

  game.getPillarLevelUpPickConfig = function getPillarLevelUpPickConfig(context = {}) {
    const payload = game.runPillarEvent('resolveLevelUpPickConfig', {
      pickCount: 1,
      effectiveness: [1],
      context,
      time: game.time
    });
    const pickCount = Math.max(1, Math.floor(toFiniteNumber(payload?.pickCount, 1)));
    const effectiveness = Array.isArray(payload?.effectiveness)
      ? payload.effectiveness.map((entry) => toPositiveMultiplier(entry, 1)).filter((entry) => Number.isFinite(entry))
      : [1];
    while (effectiveness.length < pickCount) {
      effectiveness.push(1);
    }
    return {
      pickCount,
      effectiveness: effectiveness.slice(0, Math.max(pickCount, 1)),
      effectKey: payload?.effectKey || null,
      reason: payload?.reason || null
    };
  };

  game.getPillarDualBasicAttackConfig = function getPillarDualBasicAttackConfig(context = {}) {
    const payload = game.runPillarEvent('resolveDualBasicAttackConfig', {
      enabled: false,
      damageMultiplier: 1,
      primaryAttackType: String(context?.primaryAttackType || game.attackType || 'projectile'),
      secondaryAttackType: String(context?.secondaryAttackType || game.secondaryAttackType || game.attackType || 'projectile'),
      context,
      time: game.time
    });
    return {
      enabled: payload?.enabled === true,
      damageMultiplier: Math.max(0, toFiniteNumber(payload?.damageMultiplier, 1)),
      primaryAttackType: String(payload?.primaryAttackType || context?.primaryAttackType || game.attackType || 'projectile'),
      secondaryAttackType: String(payload?.secondaryAttackType || context?.secondaryAttackType || game.secondaryAttackType || game.attackType || 'projectile'),
      effectKey: payload?.effectKey || null,
      reason: payload?.reason || null
    };
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

  game.isPillarInfiniteDashCharges = function isPillarInfiniteDashCharges() {
    return !!game.getPillarStatModifiers().infiniteDashCharges;
  };

  game.getPillarRuntimeAllocationRuleModifiers = function getPillarRuntimeAllocationRuleModifiers() {
    return (game.getPillarRuntimeState().allocationRuleModifiers || []).map((entry) => entry?.modifier).filter(Boolean);
  };

  game.getPillarTemporaryBuffs = function getPillarTemporaryBuffs() {
    const inspectors = game.getPillarRuntimeState().inspectors || [];
    const rows = [];
    for (const getInspectorEntry of inspectors) {
      if (typeof getInspectorEntry !== 'function') {
        continue;
      }
      const next = getInspectorEntry(game);
      if (!next) {
        continue;
      }
      rows.push(next);
    }
    return rows;
  };

  game.getPillarProcGuardSummary = function getPillarProcGuardSummary() {
    return getProcBudgetSummary(game);
  };

  game.resolvePillarStackGain = function resolvePillarStackGain(payload = {}) {
    const baseGain = toFiniteNumber(payload?.baseGain ?? payload?.gain, 0);
    const eventPayload = game.runPillarEvent('modifyStackGain', {
      ...(payload || {}),
      gain: baseGain
    });
    return {
      ...eventPayload,
      gain: Math.max(0, toFiniteNumber(eventPayload?.gain, baseGain))
    };
  };

  game.refreshAllSkillCooldownsFromPillar = function refreshAllSkillCooldownsFromPillar(reason = 'pillar') {
    if (Array.isArray(game.skillCooldowns)) {
      game.skillCooldowns = game.skillCooldowns.map(() => 0);
    }
    if (typeof game.refillAllSkillCharges === 'function') {
      game.refillAllSkillCharges(reason);
    }
    if (typeof game.updateSkillUI === 'function') {
      game.updateSkillUI();
    }
  };

  game.getPillarRuntimeDebugSummary = function getPillarRuntimeDebugSummary() {
    const state = game.getPillarRuntimeState();
    const traceStore = ensureTraceStore(game);
    return {
      traceEnabled: !!traceStore.enabled,
      activeBlessings: [...state.activeBlessingIds],
      activeEffectKeys: [...state.activeEffectKeys],
      unresolvedEffectKeys: [...state.unresolvedEffectKeys],
      stubbedActiveEffects: [...state.activeEffectKeys].filter((effectKey) => stubbedEffectKeys.has(effectKey)),
      statModifiers: game.getPillarStatModifiers(),
      hooks: Object.keys(state.hooks || {}).reduce((acc, key) => {
        acc[key] = (state.hooks[key] || []).length;
        return acc;
      }, {}),
      temporaryBuffs: game.getPillarTemporaryBuffs(),
      allocationRuleModifiers: (state.allocationRuleModifiers || []).map((entry) => ({
        source: entry?.source || 'unknown',
        effectKey: entry?.effectKey || null
      })),
      allocationRules: typeof game.getPillarAllocationRules === 'function'
        ? game.getPillarAllocationRules()
        : null,
      allocationSnapshot: typeof game.getPillarAllocationSnapshot === 'function'
        ? game.getPillarAllocationSnapshot()
        : null,
      riteRegistry: typeof game.getRiteRegistryEntries === 'function'
        ? game.getRiteRegistryEntries()
        : [],
      riteProgress: typeof game.getRiteProgress === 'function'
        ? game.getRiteProgress()
        : null,
      riteRuntime: typeof game.getActiveRiteSummary === 'function'
        ? game.getActiveRiteSummary()
        : null,
      riteBlockedReasons: typeof game.getRiteRegistryEntries === 'function' && typeof game.canEnterRite === 'function'
        ? game.getRiteRegistryEntries().reduce((acc, rite) => {
          const validation = game.canEnterRite(rite.id);
          if (!validation?.allowed) {
            acc[rite.id] = validation?.reason || 'blocked';
          }
          return acc;
        }, {})
        : {},
      stackEvents: typeof game.getPillarStackEventLog === 'function'
        ? game.getPillarStackEventLog()
        : [],
      selfDamageEvents: typeof game.getPillarSelfDamageEventLog === 'function'
        ? game.getPillarSelfDamageEventLog()
        : [],
      damageEvents: typeof game.getPillarDamageEventLog === 'function'
        ? game.getPillarDamageEventLog()
        : [],
      stackSources: typeof game.getPillarStackSourceSummary === 'function'
        ? game.getPillarStackSourceSummary()
        : [],
      ringEffectLog: typeof game.getPillarRingEffectLog === 'function'
        ? game.getPillarRingEffectLog()
        : [],
      npcPricingEvents: typeof game.getPillarNpcPricingLog === 'function'
        ? game.getPillarNpcPricingLog()
        : [],
      attackRepeatEvents: typeof game.getPillarAttackRepeatLog === 'function'
        ? game.getPillarAttackRepeatLog()
        : [],
      equipmentSanitization: typeof game.getPillarEquipmentSanitizationLog === 'function'
        ? game.getPillarEquipmentSanitizationLog()
        : [],
      hitClassifications: typeof game.getPillarHitClassificationLog === 'function'
        ? game.getPillarHitClassificationLog()
        : [],
      equipmentLayout: typeof game.getEquipmentLayoutDebugSummary === 'function'
        ? game.getEquipmentLayoutDebugSummary()
        : null,
      allocationTopology: typeof game.getPillarAllocationTopologySummary === 'function'
        ? game.getPillarAllocationTopologySummary()
        : null,
      destructibilityPreview: typeof game.getPillarDestructibilityDebugSummary === 'function'
        ? game.getPillarDestructibilityDebugSummary()
        : null,
      enemyModifierPortability: typeof game.getEnemyModifierPortabilitySummary === 'function'
        ? game.getEnemyModifierPortabilitySummary()
        : null,
      randomSkillPool: typeof game.getPillarRandomSkillPoolDebugSummary === 'function'
        ? game.getPillarRandomSkillPoolDebugSummary()
        : null,
      procGuard: getProcBudgetSummary(game),
      tentacleRollEvents: Array.isArray(game.__pillarTentacleRollEvents)
        ? [...game.__pillarTentacleRollEvents]
        : [],
      worldDestructionEvents: typeof game.getPillarWorldDestructionEventLog === 'function'
        ? game.getPillarWorldDestructionEventLog()
        : (Array.isArray(game.__pillarWorldDestructionEvents) ? [...game.__pillarWorldDestructionEvents] : []),
      legacyDamageTodos: typeof game.getPillarLegacyDamageTodos === 'function'
        ? game.getPillarLegacyDamageTodos()
        : [],
      legacyDamageTodoCount: typeof game.getPillarLegacyDamageTodos === 'function'
        ? game.getPillarLegacyDamageTodos().length
        : 0,
      legacyStackSelfDamageTodos: typeof game.getPillarLegacyStackSelfDamageTodos === 'function'
        ? game.getPillarLegacyStackSelfDamageTodos()
        : [],
      legacyStackSelfDamageTodoCount: typeof game.getPillarLegacyStackSelfDamageTodos === 'function'
        ? game.getPillarLegacyStackSelfDamageTodos().length
        : 0,
      traces: {
        refreshes: [...traceStore.refreshes],
        events: [...traceStore.events],
        contributions: [...traceStore.contributions],
        sanitization: [...traceStore.sanitization]
      },
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

  game.debugSimulatePillarTick = function debugSimulatePillarTick(dt = 1 / 60) {
    return game.runPillarEvent('onTick', {
      dt: Math.max(0, toFiniteNumber(dt, 0)),
      time: toFiniteNumber(game.time, 0),
      source: 'debug'
    });
  };

  game.syncPillarBlessings = function syncPillarBlessings(reason = 'sync') {
    game.refreshPillarRuntimeState(reason);
    const sanitizeResult = typeof game.sanitizeEquipmentForCurrentLayout === 'function'
      ? game.sanitizeEquipmentForCurrentLayout({ source: 'pillar_sync', reason })
      : { movedCount: 0, moved: [] };
    if (sanitizeResult?.movedCount > 0) {
      logTrace(game, 'refresh', {
        reason: 'equipment_layout_sanitized',
        movedCount: sanitizeResult.movedCount
      });
      if (typeof game.updateInventoryUI === 'function') {
        game.updateInventoryUI();
      }
      if (typeof game.updateEquippedUI === 'function') {
        game.updateEquippedUI();
      }
      if (game.inventoryOverlayOpen && typeof game.populateInventoryOverlay === 'function') {
        game.populateInventoryOverlay();
      }
    }
    if (typeof game.recalculateStats === 'function') {
      game.recalculateStats();
    }
    return sanitizeResult;
  };

  game.refreshPillarRuntimeState('install');
}
