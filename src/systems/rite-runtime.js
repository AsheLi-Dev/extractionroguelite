import { getRiteById } from '../data/rites.js';

function nowMs() {
  return Date.now();
}

function cloneRuntime(runtime) {
  if (!runtime) return null;
  return {
    ...runtime,
    metadata: { ...(runtime.metadata || {}) }
  };
}

export class RiteRuntimeController {
  constructor(options = {}) {
    this.handlers = options.handlers && typeof options.handlers === 'object'
      ? options.handlers
      : {};
    this.state = this.createEmptyState();
    this.lastTransition = null;
  }

  createEmptyState() {
    return {
      activeRiteId: null,
      activeRiteState: 'idle',
      stageIndex: 0,
      stageState: 'idle',
      currentFloor: 0,
      floorDirection: 'none',
      floorTheme: '',
      floorObjective: '',
      objectiveText: '',
      success: false,
      failure: false,
      controllerKey: null,
      startedAt: 0,
      endedAt: 0,
      metadata: {}
    };
  }

  reset() {
    this.state = this.createEmptyState();
    this.lastTransition = null;
    return this.getActiveRiteSummary();
  }

  startRite(riteId, options = {}) {
    const rite = getRiteById(riteId);
    if (!rite) {
      return { success: false, reason: 'unknown_rite' };
    }
    this.state = {
      activeRiteId: rite.id,
      activeRiteState: 'running',
      stageIndex: Math.max(0, Number(options.stageIndex) || 0),
      stageState: String(options.stageState || 'stage_active'),
      currentFloor: Math.max(0, Number(options.currentFloor) || 0),
      floorDirection: String(options.floorDirection || 'none'),
      floorTheme: String(options.floorTheme || ''),
      floorObjective: String(options.floorObjective || ''),
      objectiveText: String(options.objectiveText || ''),
      success: false,
      failure: false,
      controllerKey: rite.controllerKey || null,
      startedAt: nowMs(),
      endedAt: 0,
      metadata: options.metadata && typeof options.metadata === 'object'
        ? { ...options.metadata }
        : {}
    };
    this.lastTransition = {
      type: 'start',
      riteId: rite.id,
      at: this.state.startedAt
    };
    return { success: true, summary: this.getActiveRiteSummary() };
  }

  updateRite(deltaTime, context = {}) {
    if (this.state.activeRiteState !== 'running') {
      return this.getActiveRiteSummary();
    }
    const handler = this.handlers[this.state.controllerKey];
    if (typeof handler?.update === 'function') {
      handler.update(deltaTime, this, context);
    }
    return this.getActiveRiteSummary();
  }

  setRiteObjective(text) {
    this.state.objectiveText = String(text || '');
    return this.getActiveRiteSummary();
  }

  advanceRiteStage(step = 1) {
    this.state.stageIndex = Math.max(0, this.state.stageIndex + Math.max(1, Number(step) || 1));
    this.state.stageState = 'stage_active';
    return this.getActiveRiteSummary();
  }

  setRiteStage(index, stageState = 'stage_active') {
    this.state.stageIndex = Math.max(0, Number(index) || 0);
    this.state.stageState = String(stageState || 'stage_active');
    return this.getActiveRiteSummary();
  }

  setStageState(stageState) {
    this.state.stageState = String(stageState || 'stage_active');
    return this.getActiveRiteSummary();
  }

  setRiteFloor(floorIndex, floorDirection = null, floorTheme = null) {
    this.state.currentFloor = Math.max(0, Number(floorIndex) || 0);
    if (floorDirection != null) {
      this.state.floorDirection = String(floorDirection || 'none');
    }
    if (floorTheme != null) {
      this.state.floorTheme = String(floorTheme || '');
    }
    return this.getActiveRiteSummary();
  }

  setFloorObjective(text) {
    this.state.floorObjective = String(text || '');
    return this.getActiveRiteSummary();
  }

  beginDescent(startFloor = null) {
    this.state.floorDirection = 'descent';
    if (startFloor != null) {
      this.state.currentFloor = Math.max(0, Number(startFloor) || 0);
    }
    return this.getActiveRiteSummary();
  }

  beginAscent(startFloor = null) {
    this.state.floorDirection = 'ascent';
    if (startFloor != null) {
      this.state.currentFloor = Math.max(0, Number(startFloor) || 0);
    }
    return this.getActiveRiteSummary();
  }

  endRiteSuccess(metadata = {}) {
    if (!this.state.activeRiteId) {
      return { success: false, reason: 'no_active_rite' };
    }
    this.state.activeRiteState = 'success';
    this.state.success = true;
    this.state.failure = false;
    this.state.endedAt = nowMs();
    this.state.metadata = {
      ...(this.state.metadata || {}),
      ...(metadata && typeof metadata === 'object' ? metadata : {})
    };
    this.lastTransition = {
      type: 'success',
      riteId: this.state.activeRiteId,
      at: this.state.endedAt
    };
    return { success: true, summary: this.getActiveRiteSummary() };
  }

  endRiteFailure(metadata = {}) {
    if (!this.state.activeRiteId) {
      return { success: false, reason: 'no_active_rite' };
    }
    this.state.activeRiteState = 'failure';
    this.state.success = false;
    this.state.failure = true;
    this.state.endedAt = nowMs();
    this.state.metadata = {
      ...(this.state.metadata || {}),
      ...(metadata && typeof metadata === 'object' ? metadata : {})
    };
    this.lastTransition = {
      type: 'failure',
      riteId: this.state.activeRiteId,
      at: this.state.endedAt
    };
    return { success: true, summary: this.getActiveRiteSummary() };
  }

  clearActiveRite() {
    const summary = this.getActiveRiteSummary();
    this.state = this.createEmptyState();
    this.lastTransition = {
      type: 'clear',
      riteId: summary.activeRiteId || null,
      at: nowMs()
    };
    return summary;
  }

  isActive() {
    return this.state.activeRiteState === 'running' && !!this.state.activeRiteId;
  }

  getActiveRiteSummary() {
    return {
      ...cloneRuntime(this.state),
      lastTransition: this.lastTransition ? { ...this.lastTransition } : null
    };
  }
}
