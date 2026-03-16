import { STATUS_DEFS, STATUS_STACKING_MODES, getStatusDefinition } from '../data/status-definitions.js';

function cloneData(data) {
  if (!data || typeof data !== 'object') return data ?? null;
  return JSON.parse(JSON.stringify(data));
}

function clamp(value, min, max) {
  let out = Number.isFinite(value) ? value : min;
  out = Math.max(min, out);
  if (Number.isFinite(max)) out = Math.min(max, out);
  return out;
}

function cloneEntry(entry) {
  return {
    statusId: entry.statusId,
    remaining: entry.remaining,
    stacks: entry.stacks,
    magnitude: entry.magnitude,
    tickInterval: entry.tickInterval,
    tickTimer: entry.tickTimer,
    sourceId: entry.sourceId ?? null,
    sourceType: entry.sourceType ?? null,
    appliedAt: entry.appliedAt ?? 0,
    data: cloneData(entry.data)
  };
}

function compareStrength(definition, nextMagnitude, currentMagnitude) {
  const mode = definition?.compareMagnitude || 'higher';
  const next = Number(nextMagnitude);
  const current = Number(currentMagnitude);
  if (!Number.isFinite(next)) return 0;
  if (!Number.isFinite(current)) return 1;
  if (mode === 'lower') {
    if (next < current) return 1;
    if (next > current) return -1;
    return 0;
  }
  if (next > current) return 1;
  if (next < current) return -1;
  return 0;
}

function summarizeIndependent(definition, entries) {
  const sorted = [...entries].sort((a, b) => compareStrength(definition, b.magnitude, a.magnitude));
  const strongest = sorted[0];
  if (!strongest) return null;
  const summary = cloneEntry(strongest);
  summary.stacks = entries.reduce((sum, entry) => sum + Math.max(1, Number(entry.stacks) || 1), 0);
  summary.remaining = Math.max(...entries.map((entry) => Number(entry.remaining) || 0));
  summary.instances = entries.map((entry) => cloneEntry(entry));
  return summary;
}

export class StatusManager {
  constructor(definitions = STATUS_DEFS) {
    this.definitions = new Map(Object.values(definitions).map((definition) => [definition.id, definition]));
    this.activeByEntity = new Map();
  }

  getDefinition(statusId) {
    return this.definitions.get(statusId) || getStatusDefinition(statusId) || null;
  }

  _ensureEntityStore(entityId) {
    let entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) {
      entityStore = new Map();
      this.activeByEntity.set(entityId, entityStore);
    }
    return entityStore;
  }

  _getDuration(definition, statusData) {
    const duration = Number.isFinite(statusData.duration)
      ? Number(statusData.duration)
      : Number(definition.defaultDuration) || 0;
    return Math.max(0, duration);
  }

  _createEntry(definition, statusData, world) {
    const tickInterval = Number.isFinite(statusData.tickInterval)
      ? Math.max(0, Number(statusData.tickInterval))
      : Math.max(0, Number(definition.tickInterval) || 0);
    const explicitStacks = Number.isFinite(statusData.stacks) ? Number(statusData.stacks) : null;
    return {
      statusId: definition.id,
      remaining: this._getDuration(definition, statusData),
      stacks: clamp(explicitStacks ?? 1, 1, Number.isFinite(statusData.maxStacks) ? Number(statusData.maxStacks) : (Number(definition.maxStacks) || Number.MAX_SAFE_INTEGER)),
      magnitude: Number.isFinite(statusData.magnitude) ? Number(statusData.magnitude) : null,
      tickInterval,
      tickTimer: tickInterval > 0 ? tickInterval : 0,
      sourceId: statusData.sourceId ?? statusData.sourceEntityId ?? null,
      sourceType: statusData.sourceType ?? null,
      appliedAt: Number(world?.time) || 0,
      data: cloneData(statusData.data)
    };
  }

  _setStatus(entityId, statusId, value) {
    const entityStore = this._ensureEntityStore(entityId);
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      entityStore.delete(statusId);
      if (entityStore.size === 0) this.activeByEntity.delete(entityId);
      return;
    }
    entityStore.set(statusId, value);
  }

  _runHook(hookName, definition, entry, entityId, world) {
    const hook = definition?.[hookName];
    if (typeof hook !== 'function') return;
    hook(entry, {
      definition,
      entityId,
      manager: this,
      world
    });
  }

  applyStatus(entityId, statusData, world = null) {
    const statusId = statusData?.statusId || statusData?.id;
    if (!entityId || !statusId) return null;
    const definition = this.getDefinition(statusId);
    if (!definition) return null;

    const mode = statusData?.stackingMode || definition.stackingMode || STATUS_STACKING_MODES.REFRESH;
    const maxStacks = Number.isFinite(statusData?.maxStacks) ? Number(statusData.maxStacks) : (Number(definition.maxStacks) || Number.MAX_SAFE_INTEGER);
    const refreshOnReapply = statusData?.refreshOnReapply ?? definition.refreshOnReapply ?? true;
    const entityStore = this._ensureEntityStore(entityId);
    const current = entityStore.get(statusId);
    const nextEntry = this._createEntry(definition, statusData, world);
    const stackDelta = Number.isFinite(statusData?.stackDelta) ? Number(statusData.stackDelta) : 1;

    if (mode === STATUS_STACKING_MODES.INDEPENDENT) {
      const entries = Array.isArray(current) ? [...current] : [];
      if (entries.length >= maxStacks) {
        entries.sort((a, b) => a.remaining - b.remaining);
        entries.shift();
      }
      entries.push(nextEntry);
      this._setStatus(entityId, statusId, entries);
      this._runHook('onApply', definition, nextEntry, entityId, world);
      return this.getStatus(entityId, statusId);
    }

    if (!current || Array.isArray(current)) {
      this._setStatus(entityId, statusId, nextEntry);
      this._runHook('onApply', definition, nextEntry, entityId, world);
      return cloneEntry(nextEntry);
    }

    const explicitStacks = Number.isFinite(statusData?.stacks) ? Number(statusData.stacks) : null;
    const shouldRefresh = refreshOnReapply !== false;
    const strengthComparison = compareStrength(definition, nextEntry.magnitude, current.magnitude);

    switch (mode) {
      case STATUS_STACKING_MODES.STACK_REFRESH: {
        if (explicitStacks != null) {
          current.stacks = clamp(explicitStacks, 1, maxStacks);
        } else {
          current.stacks = clamp((Number(current.stacks) || 1) + stackDelta, 1, maxStacks);
        }
        if (shouldRefresh) current.remaining = nextEntry.remaining;
        if (strengthComparison >= 0 && nextEntry.magnitude != null) current.magnitude = nextEntry.magnitude;
        if (nextEntry.tickInterval > 0) {
          current.tickInterval = nextEntry.tickInterval;
          current.tickTimer = Math.min(current.tickTimer ?? nextEntry.tickInterval, nextEntry.tickInterval);
        }
        current.sourceId = nextEntry.sourceId ?? current.sourceId ?? null;
        current.sourceType = nextEntry.sourceType ?? current.sourceType ?? null;
        current.appliedAt = Number(world?.time) || current.appliedAt || 0;
        if (nextEntry.data != null) current.data = nextEntry.data;
        break;
      }
      case STATUS_STACKING_MODES.STRONGEST_WINS: {
        if (strengthComparison > 0) {
          current.magnitude = nextEntry.magnitude;
          current.remaining = nextEntry.remaining;
          current.appliedAt = Number(world?.time) || current.appliedAt || 0;
          current.sourceId = nextEntry.sourceId ?? current.sourceId ?? null;
          current.sourceType = nextEntry.sourceType ?? current.sourceType ?? null;
          if (nextEntry.data != null) current.data = nextEntry.data;
        } else if (strengthComparison === 0 && shouldRefresh) {
          current.remaining = Math.max(current.remaining, nextEntry.remaining);
        }
        break;
      }
      case STATUS_STACKING_MODES.REPLACE_IF_STRONGER: {
        if (strengthComparison > 0) {
          current.magnitude = nextEntry.magnitude;
          current.remaining = nextEntry.remaining;
          current.stacks = nextEntry.stacks;
          current.tickInterval = nextEntry.tickInterval;
          current.tickTimer = nextEntry.tickTimer;
          current.sourceId = nextEntry.sourceId ?? null;
          current.sourceType = nextEntry.sourceType ?? null;
          current.appliedAt = Number(world?.time) || current.appliedAt || 0;
          current.data = nextEntry.data;
        }
        break;
      }
      case STATUS_STACKING_MODES.REFRESH:
      default: {
        if (shouldRefresh) current.remaining = Math.max(current.remaining, nextEntry.remaining);
        if (strengthComparison >= 0 && nextEntry.magnitude != null) current.magnitude = nextEntry.magnitude;
        if (explicitStacks != null) current.stacks = clamp(explicitStacks, 1, maxStacks);
        current.sourceId = nextEntry.sourceId ?? current.sourceId ?? null;
        current.sourceType = nextEntry.sourceType ?? current.sourceType ?? null;
        current.appliedAt = Number(world?.time) || current.appliedAt || 0;
        if (nextEntry.data != null) current.data = nextEntry.data;
        break;
      }
    }

    this._setStatus(entityId, statusId, current);
    return cloneEntry(current);
  }

  removeStatus(entityId, statusId, world = null) {
    const entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) return false;
    const current = entityStore.get(statusId);
    if (!current) return false;
    const definition = this.getDefinition(statusId);
    if (Array.isArray(current)) {
      current.forEach((entry) => this._runHook('onExpire', definition, entry, entityId, world));
    } else {
      this._runHook('onExpire', definition, current, entityId, world);
    }
    entityStore.delete(statusId);
    if (entityStore.size === 0) this.activeByEntity.delete(entityId);
    return true;
  }

  clearStatuses(entityId, world = null) {
    const entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) return;
    for (const statusId of [...entityStore.keys()]) {
      this.removeStatus(entityId, statusId, world);
    }
  }

  hasStatus(entityId, statusId) {
    return this.getStatus(entityId, statusId) != null;
  }

  getStatus(entityId, statusId) {
    const entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) return null;
    const current = entityStore.get(statusId);
    if (!current) return null;
    const definition = this.getDefinition(statusId);
    if (Array.isArray(current)) return summarizeIndependent(definition, current);
    return cloneEntry(current);
  }

  getStatuses(entityId) {
    const entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) return [];
    const statuses = [];
    for (const statusId of entityStore.keys()) {
      const status = this.getStatus(entityId, statusId);
      if (status) statuses.push(status);
    }
    return statuses;
  }

  updateStatus(entityId, statusId, updater) {
    const entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) return null;
    const current = entityStore.get(statusId);
    if (!current || Array.isArray(current) || typeof updater !== 'function') return null;
    const next = updater(current, this.getDefinition(statusId)) || current;
    if (!next || (Number(next.remaining) || 0) <= 0 || (Number(next.stacks) || 0) <= 0) {
      this._setStatus(entityId, statusId, null);
      return null;
    }
    this._setStatus(entityId, statusId, next);
    return cloneEntry(next);
  }

  _updateEntry(definition, entry, entityId, dt, world) {
    const now = Number(world?.time) || 0;
    if (entry.appliedAt === now) return false;
    entry.remaining = Math.max(0, (Number(entry.remaining) || 0) - dt);
    if (entry.tickInterval > 0) {
      entry.tickTimer = (Number(entry.tickTimer) || entry.tickInterval) - dt;
      while (entry.tickTimer <= 0 && entry.remaining > 0) {
        this._runHook('onTick', definition, entry, entityId, world);
        entry.tickTimer += entry.tickInterval;
      }
    }
    return entry.remaining <= 0;
  }

  updateStatuses(dt, world) {
    if (!(dt > 0)) return;
    for (const [entityId, entityStore] of this.activeByEntity.entries()) {
      for (const [statusId, current] of entityStore.entries()) {
        const definition = this.getDefinition(statusId);
        if (Array.isArray(current)) {
          const remainingEntries = [];
          for (const entry of current) {
            const expired = this._updateEntry(definition, entry, entityId, dt, world);
            if (expired) {
              this._runHook('onExpire', definition, entry, entityId, world);
            } else {
              remainingEntries.push(entry);
            }
          }
          this._setStatus(entityId, statusId, remainingEntries);
          continue;
        }
        const expired = this._updateEntry(definition, current, entityId, dt, world);
        if (expired) {
          this._runHook('onExpire', definition, current, entityId, world);
          this._setStatus(entityId, statusId, null);
        }
      }
    }
  }

  isStunned(entityId) {
    return this.hasStatus(entityId, 'stun');
  }

  getMoveSpeedMultiplier(entityId) {
    let multiplier = 1;
    const slow = this.getStatus(entityId, 'slow');
    const haste = this.getStatus(entityId, 'haste');
    if (slow?.magnitude != null) multiplier *= slow.magnitude;
    if (haste?.magnitude != null) multiplier *= haste.magnitude;
    return multiplier;
  }

  getDefenseMultiplier(entityId) {
    const defenseDown = this.getStatus(entityId, 'void');
    return defenseDown?.magnitude != null ? defenseDown.magnitude : 1;
  }

  getAttackSpeedMultiplier(entityId) {
    const weakening = this.getStatus(entityId, 'weakening');
    return weakening?.magnitude != null ? weakening.magnitude : 1;
  }

  getOutgoingDamageMultiplier(entityId) {
    const weaken = this.getStatus(entityId, 'weaken');
    return weaken?.magnitude != null ? weaken.magnitude : 1;
  }

  getStatusStacks(entityId, statusId) {
    return this.getStatus(entityId, statusId)?.stacks || 0;
  }

  getStatusSnapshot(entityId) {
    return this.serializeEntity(entityId);
  }

  serializeEntity(entityId) {
    const entityStore = this.activeByEntity.get(entityId);
    if (!entityStore) return [];
    const serialized = [];
    for (const [statusId, current] of entityStore.entries()) {
      if (Array.isArray(current)) {
        serialized.push({
          statusId,
          mode: 'independent',
          entries: current.map((entry) => cloneEntry(entry))
        });
      } else {
        serialized.push(cloneEntry(current));
      }
    }
    return serialized;
  }

  restoreEntity(entityId, snapshot, world = null) {
    this.clearStatuses(entityId, world);
    if (!Array.isArray(snapshot) || snapshot.length === 0) return;
    const entityStore = this._ensureEntityStore(entityId);
    for (const entry of snapshot) {
      if (!entry?.statusId) continue;
      if (entry.mode === 'independent' && Array.isArray(entry.entries)) {
        entityStore.set(entry.statusId, entry.entries.map((instance) => cloneEntry(instance)));
        continue;
      }
      entityStore.set(entry.statusId, cloneEntry(entry));
    }
  }
}
