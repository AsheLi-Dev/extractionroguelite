export const STATUS_STACKING_MODES = {
  REFRESH: 'refresh',
  STACK_REFRESH: 'stack_refresh',
  STRONGEST_WINS: 'strongest_wins',
  REPLACE_IF_STRONGER: 'replace_if_stronger',
  INDEPENDENT: 'independent'
};

function resolveStatusTickSource(world, sourceId) {
  if (!sourceId || typeof world?.getEntityById !== 'function') return null;
  return world.getEntityById(sourceId);
}

export const STATUS_DEFS = {
  burn: {
    id: 'burn',
    defaultDuration: 2,
    stackingMode: STATUS_STACKING_MODES.STACK_REFRESH,
    maxStacks: 99,
    refreshOnReapply: true,
    tickInterval: 0.5,
    tags: ['debuff', 'dot', 'fire'],
    onTick(entry, context) {
      const interval = Math.max(0.001, entry.tickInterval ?? context.definition.tickInterval ?? 0.5);
      const stacks = Math.max(1, Number(entry.stacks) || 1);
      const amountModel = entry.data?.damageModel === 'per_tick' ? 'per_tick' : 'dps';
      const baseAmount = Math.max(0, Number(entry.magnitude) || 0);
      const amount = amountModel === 'per_tick'
        ? Math.max(1, Math.round(baseAmount * stacks))
        : Math.max(1, Math.round(baseAmount * interval));
      if (amount <= 0 || typeof context.world?.applyStatusDamage !== 'function') return;
      context.world.applyStatusDamage(context.entityId, amount, {
        statusId: entry.statusId,
        sourceId: entry.sourceId ?? null,
        sourceEntity: resolveStatusTickSource(context.world, entry.sourceId),
        sourceType: entry.sourceType || 'status',
        reason: entry.data?.reason || 'status_burn_tick',
        effectKey: entry.data?.effectKey || null
      });
    }
  },
  slow: {
    id: 'slow',
    defaultDuration: 1,
    stackingMode: STATUS_STACKING_MODES.STRONGEST_WINS,
    compareMagnitude: 'lower',
    maxStacks: 1,
    refreshOnReapply: true,
    tags: ['debuff', 'movement']
  },
  stun: {
    id: 'stun',
    defaultDuration: 0.2,
    stackingMode: STATUS_STACKING_MODES.REFRESH,
    maxStacks: 1,
    refreshOnReapply: true,
    tags: ['debuff', 'control']
  },
  poison: {
    id: 'poison',
    defaultDuration: 3,
    stackingMode: STATUS_STACKING_MODES.STACK_REFRESH,
    maxStacks: 1,
    refreshOnReapply: true,
    tickInterval: 0.5,
    tags: ['debuff', 'dot'],
    onTick(entry, context) {
      const interval = Math.max(0.001, entry.tickInterval ?? context.definition.tickInterval ?? 0.5);
      const stacks = Math.max(1, Number(entry.stacks) || 1);
      const dps = Math.max(0, Number(entry.magnitude) || 0);
      const amount = Math.max(1, Math.round(dps * interval * stacks));
      if (amount <= 0 || typeof context.world?.applyStatusDamage !== 'function') return;
      context.world.applyStatusDamage(context.entityId, amount, {
        statusId: entry.statusId,
        sourceId: entry.sourceId ?? null,
        sourceEntity: resolveStatusTickSource(context.world, entry.sourceId),
        sourceType: entry.sourceType || 'status',
        reason: entry.data?.reason || 'status_poison_tick',
        effectKey: entry.data?.effectKey || null
      });
    }
  },
  void: {
    id: 'void',
    defaultDuration: 4,
    stackingMode: STATUS_STACKING_MODES.STRONGEST_WINS,
    compareMagnitude: 'lower',
    maxStacks: 1,
    refreshOnReapply: true,
    tags: ['debuff', 'defense']
  },
  weakening: {
    id: 'weakening',
    defaultDuration: 2,
    stackingMode: STATUS_STACKING_MODES.STRONGEST_WINS,
    compareMagnitude: 'lower',
    maxStacks: 1,
    refreshOnReapply: true,
    tags: ['debuff', 'attack_speed']
  },
  weaken: {
    id: 'weaken',
    defaultDuration: 2,
    stackingMode: STATUS_STACKING_MODES.STRONGEST_WINS,
    compareMagnitude: 'lower',
    maxStacks: 1,
    refreshOnReapply: true,
    tags: ['debuff', 'damage']
  },
  haste: {
    id: 'haste',
    defaultDuration: 2,
    stackingMode: STATUS_STACKING_MODES.STRONGEST_WINS,
    compareMagnitude: 'higher',
    maxStacks: 1,
    refreshOnReapply: true,
    tags: ['buff', 'movement']
  }
};

export function getStatusDefinition(statusId) {
  return STATUS_DEFS[statusId] || null;
}
