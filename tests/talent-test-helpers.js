/**
 * Test helpers for talent simulation: mock player, enemy, run state, and RNG.
 */

const { createTalentState } = require("./talent-simulator.js");

/**
 * Create a mock player for tests (stats only; simulator holds talent state).
 */
function createMockPlayer(opts = {}) {
  return {
    maxHealth: opts.maxHealth ?? 100,
    currentHealth: opts.currentHealth ?? opts.maxHealth ?? 100,
    dashCharges: opts.dashCharges ?? 2,
    dashMaxCharges: opts.dashMaxCharges ?? 2,
    ...opts,
  };
}

/**
 * Create a mock enemy for onKillEnemy / lifebloom etc.
 */
function createMockEnemy(opts = {}) {
  return {
    maxHealth: opts.maxHealth ?? 100,
    ...opts,
  };
}

/**
 * Create a run state that holds talent state + optional run-level flags.
 */
function createRunState(opts = {}) {
  const talents = opts.characterTalents ?? [];
  const state = createTalentState({
    characterTalents: talents,
    maxHealth: opts.maxHealth ?? 100,
    time: opts.time ?? 0,
    dashCharges: opts.dashCharges ?? 2,
    dashMaxCharges: opts.dashMaxCharges ?? 2,
    ...opts,
  });
  return state;
}

/**
 * Mock RNG: provide a sequence of values in [0, 1]. Each random() consumes the next.
 * Use for deterministic Cube Cascade, Transmutation, etc.
 */
function mockRandom(state, sequence) {
  state._randomSequence = Array.isArray(sequence) ? [...sequence] : [sequence];
  state._nextRandom = undefined;
}

/**
 * Set a single next random value (one-shot).
 */
function setNextRandom(state, value) {
  state._nextRandom = value;
  state._randomSequence = null;
}

/**
 * Fire a sequence of events for multi-event tests. Each entry: { event, arg1?, arg2? }.
 * Returns the state after all events.
 */
function runEventSequence(state, events, opts = {}) {
  const tickBetween = opts.tickBetween ?? 0;
  for (const e of events) {
    if (e.tick != null) {
      const { tick } = require("./talent-simulator.js");
      tick(state, e.tick);
    }
    switch (e.event) {
      case "onHitEnemy":
        state.onHitEnemyResult = require("./talent-simulator.js").onHitEnemy(state, e.opts || {});
        if (e.opts?.damageDealt != null) state.onHitEnemyResult.damageDealt = e.opts.damageDealt;
        break;
      case "onKillEnemy":
        require("./talent-simulator.js").onKillEnemy(state, e.enemy ?? {});
        break;
      case "onDash":
        require("./talent-simulator.js").onDash(state);
        break;
      case "onTakeDamage":
        require("./talent-simulator.js").onTakeDamage(state, e.amount ?? 10);
        break;
      case "onHeal":
        require("./talent-simulator.js").onHeal(state, e.amount ?? 10);
        break;
      case "onEnterBiome":
        require("./talent-simulator.js").onEnterBiome(state);
        break;
      case "onExtract":
        require("./talent-simulator.js").onExtract(state, e.items ?? []);
        break;
      case "onUseCube":
        require("./talent-simulator.js").onUseCube(state);
        break;
      case "onDeath":
        require("./talent-simulator.js").onDeath(state);
        break;
      default:
        break;
    }
    if (tickBetween > 0) {
      const { tick } = require("./talent-simulator.js");
      tick(state, tickBetween);
    }
  }
  return state;
}

module.exports = {
  createMockPlayer,
  createMockEnemy,
  createRunState,
  mockRandom,
  setNextRandom,
  runEventSequence,
};
