/**
 * Talent simulation harness for automated tests.
 * Mirrors in-game talent logic with mockable time and RNG.
 * No dependency on game bundle or browser.
 */

const FIERCE_STACK_CAP = 10;
const FIERCE_PCT_PER_STACK = 0.02;
const RAPID_DURATION = 3;
const RAPID_ATK_SPEED_MULT = 1.1;
const HEAVY_HIT_EVERY_N = 4;
const HEAVY_HIT_DAMAGE_MULT = 1.4;
const BLOOD_RITUAL_CAP = 10;
const BLOOD_RITUAL_HEAL_PCT = 0.5;
const LIVING_FORTRESS_INTERVAL = 8;
const LIVING_FORTRESS_PCT = 0.05;
const LIVING_FORTRESS_CAP_PCT = 0.3;
const PERFECT_FLOW_WINDOW = 0.5;
const PERFECT_FLOW_DURATION = 2;
const PERFECT_FLOW_ATK_SPEED_MULT = 1.1;
const CUBE_CASCADE_CHANCE = 0.1;
const TRANSMUTATION_CHANCE = 0.05;
const VAULT_MASTER_MAX_SECURED = 3;

function hasTalent(state, id) {
  return (state.characterTalents || []).includes(id);
}

/**
 * Create fresh simulation state.
 * @param {object} opts - { characterTalents: string[], maxHealth, time, random }
 */
function createTalentState(opts = {}) {
  const talents = opts.characterTalents || [];
  return {
    characterTalents: [...talents],
    time: opts.time ?? 0,
    maxHealth: opts.maxHealth ?? 100,
    currentHealth: opts.maxHealth ?? 100,
    // RNG: test can override. Next random() returns state._nextRandom (0..1).
    _nextRandom: undefined,
    _randomSequence: opts.randomSequence || null,

    // Fierce: +2% per stack, cap 10 (spec; game currently uses flat 10%)
    fierceStacks: 0,

    // Rapid: after dash, +10% atk speed for 3s
    rapidTalentUntil: 0,

    // Heavy Hit: every 4th attack consumes dash and 1.4x damage
    heavyHitAttackCount: 0,
    dashCharges: opts.dashCharges ?? 2,
    dashMaxCharges: opts.dashMaxCharges ?? 2,

    // Dashing Attack: on dash end, fire 30% projectile (we record that it fired)
    dashingAttackFired: false,

    // Blood Ritual: on kill +1 stack; at 10, next hit heals 50%
    bloodRitualStacks: 0,
    bloodRitualNextHitHeal: false,

    // Living Fortress: every 8s +5% shield, cap 30%
    livingFortressShield: 0,
    livingFortressLastTick: 0,

    // Dance of Blades: +30% damage for 1s after dash
    danceOfBladesUntil: 0,

    // Perfect Flow: two dashes within 0.5s -> +10% atk speed 2s
    lastDashTime: null,
    perfectFlowUntil: 0,

    // Cube Cascade: 10% not consume cube when using
    cubeCascadeProc: false,

    // Transmutation: per rare item 5% gain one T1 modifier; item.transmutationGranted
    // (handled in onExtract with items)

    // Vault Master: secured item ids (persist through death)
    vaultMasterSecuredIds: new Set(),
    vaultMasterTransferred: false,

    // Event log for assertions
    events: [],
  };
}

function random(state) {
  if (state._nextRandom !== undefined) {
    const v = state._nextRandom;
    state._nextRandom = undefined;
    return v;
  }
  if (state._randomSequence && state._randomSequence.length > 0) {
    return state._randomSequence.shift();
  }
  return Math.random();
}

function emit(state, name, payload = {}) {
  state.events.push({ name, time: state.time, ...payload });
}

/**
 * Advance time (for Living Fortress tick, buff expiry checks).
 */
function tick(state, dt) {
  state.time += dt;
  // Living Fortress: every 8s add 5% maxHP shield, cap 30%
  if (hasTalent(state, "livingFortress")) {
    const elapsed = state.time - state.livingFortressLastTick;
    if (elapsed >= LIVING_FORTRESS_INTERVAL) {
      const intervals = Math.floor(elapsed / LIVING_FORTRESS_INTERVAL);
      state.livingFortressLastTick = state.time;
      const maxShield = state.maxHealth * LIVING_FORTRESS_CAP_PCT;
      for (let i = 0; i < intervals; i++) {
        state.livingFortressShield = Math.min(
          maxShield,
          state.livingFortressShield + state.maxHealth * LIVING_FORTRESS_PCT
        );
      }
    }
  }
  return state;
}

/**
 * Simulate hitting an enemy (basic attack, not skill).
 * Returns { damageMult, consumedDash, fierceStacksAfter, bloodRitualHeal }.
 */
function onHitEnemy(state, opts = {}) {
  const result = { damageMult: 1, consumedDash: false, fierceStacksAfter: state.fierceStacks, bloodRitualHeal: 0 };

  // Fierce: +2% per stack (spec); cap 10
  if (hasTalent(state, "fierce")) {
    state.fierceStacks = Math.min(FIERCE_STACK_CAP, state.fierceStacks + 1);
    result.fierceStacksAfter = state.fierceStacks;
    result.damageMult = 1 + state.fierceStacks * FIERCE_PCT_PER_STACK;
  }

  // Heavy Hit: every 4th attack
  if (hasTalent(state, "heavyHit") && !opts.isSkill) {
    state.heavyHitAttackCount = (state.heavyHitAttackCount || 0) + 1;
    if (state.heavyHitAttackCount % HEAVY_HIT_EVERY_N === 0) {
      result.damageMult *= HEAVY_HIT_DAMAGE_MULT;
      if (state.dashCharges > 0) {
        state.dashCharges--;
        result.consumedDash = true;
      }
    }
  }

  // Dance of Blades: +30% if attack within 1s of dash (caller sets danceOfBladesUntil)
  if (hasTalent(state, "danceOfBlades") && state.danceOfBladesUntil > state.time && !opts.isSkill) {
    result.damageMult *= 1.3;
  }

  // Blood Ritual: at 10 stacks, next hit heals 50% of damage
  if (hasTalent(state, "bloodRitual") && state.bloodRitualNextHitHeal && opts.damageDealt != null) {
    result.bloodRitualHeal = Math.round(opts.damageDealt * BLOOD_RITUAL_HEAL_PCT);
    state.bloodRitualNextHitHeal = false;
    state.currentHealth = Math.min(state.maxHealth, state.currentHealth + result.bloodRitualHeal);
  }

  return result;
}

/**
 * Simulate killing an enemy.
 * Returns { bloodthirstHeal, bloodRush, relentless, lifebloomHeal, bloodRitualStacksAfter, bloodRitualNextHitHeal }.
 */
function onKillEnemy(state, enemy = {}) {
  const enemyMaxHp = enemy.maxHealth ?? 100;
  const result = {
    bloodthirstHeal: 0,
    bloodRush: false,
    relentless: false,
    lifebloomHeal: 0,
    bloodRitualStacksAfter: state.bloodRitualStacks,
    bloodRitualNextHitHeal: false,
  };

  if (hasTalent(state, "bloodthirst")) {
    result.bloodthirstHeal = Math.max(1, Math.round(state.maxHealth * 0.03));
    state.currentHealth = Math.min(state.maxHealth, state.currentHealth + result.bloodthirstHeal);
  }
  if (hasTalent(state, "bloodRush")) {
    state.bloodRushUntil = state.time + 3;
    result.bloodRush = true;
  }
  if (hasTalent(state, "relentless")) {
    result.relentless = true;
  }
  if (hasTalent(state, "lifebloom")) {
    result.lifebloomHeal = Math.max(1, Math.round(enemyMaxHp * 0.05));
    state.currentHealth = Math.min(state.maxHealth, state.currentHealth + result.lifebloomHeal);
  }
  if (hasTalent(state, "bloodRitual")) {
    state.bloodRitualStacks = (state.bloodRitualStacks || 0) + 1;
    if (state.bloodRitualStacks >= BLOOD_RITUAL_CAP) {
      state.bloodRitualStacks = 0;
      state.bloodRitualNextHitHeal = true;
      result.bloodRitualNextHitHeal = true;
    }
    result.bloodRitualStacksAfter = state.bloodRitualStacks;
  }

  emit(state, "onKillEnemy", { enemyMaxHp, ...result });
  return result;
}

/**
 * Simulate dash end (duration complete).
 * Returns { rapidActive, momentumActive, danceOfBladesActive, dashingAttackFired, perfectFlowActive }.
 */
function onDash(state) {
  const result = {
    rapidActive: false,
    momentumActive: false,
    danceOfBladesActive: false,
    dashingAttackFired: false,
    perfectFlowActive: false,
  };

  if (hasTalent(state, "rapid")) {
    state.rapidTalentUntil = state.time + RAPID_DURATION;
    result.rapidActive = true;
  }
  if (hasTalent(state, "momentum")) {
    state.momentumUntil = state.time + 2;
    result.momentumActive = true;
  }
  if (hasTalent(state, "danceOfBlades")) {
    state.danceOfBladesUntil = state.time + 1;
    result.danceOfBladesActive = true;
  }
  if (hasTalent(state, "dashingAttack")) {
    state.dashingAttackFired = true;
    result.dashingAttackFired = true;
  }

  // Perfect Flow: two dashes within 0.5s
  const now = state.time;
  const lastDash = state.lastDashTime;
  state.lastDashTime = now;
  if (lastDash != null && now - lastDash <= PERFECT_FLOW_WINDOW) {
    if (hasTalent(state, "perfectFlow")) {
      state.perfectFlowUntil = now + PERFECT_FLOW_DURATION;
      result.perfectFlowActive = true;
    }
  }

  emit(state, "onDash", result);
  return result;
}

/**
 * Simulate taking damage (for toughness, resilient, battleScarred, etc.).
 */
function onTakeDamage(state, amount) {
  const result = { finalAmount: amount, battleScarredStacks: state.battleScarredStacks, brutalityRetaliationStacks: state.brutalityRetaliationStacks };
  if (hasTalent(state, "battleScarred")) {
    state.battleScarredStacks = Math.min(3, (state.battleScarredStacks || 0) + 1);
    state.battleScarredUntil = state.time + 5;
    result.battleScarredStacks = state.battleScarredStacks;
  }
  if (hasTalent(state, "brutalityRetaliation")) {
    state.brutalityRetaliationStacks = Math.min(5, (state.brutalityRetaliationStacks || 0) + 1);
    state.brutalityRetaliationUntil = state.time + 4;
    result.brutalityRetaliationStacks = state.brutalityRetaliationStacks;
  }
  state.currentHealth = Math.max(0, state.currentHealth - amount);
  emit(state, "onTakeDamage", result);
  return result;
}

function onHeal(state, amount) {
  state.currentHealth = Math.min(state.maxHealth, state.currentHealth + amount);
  emit(state, "onHeal", { amount });
  return { amount };
}

/**
 * Simulate entering a new biome/map (vitality heal, toughness reset).
 */
function onEnterBiome(state) {
  const result = { vitalityHeal: 0, toughnessReset: false };
  if (hasTalent(state, "vitality")) {
    result.vitalityHeal = Math.round(state.maxHealth * 0.2);
    state.currentHealth = Math.min(state.maxHealth, state.currentHealth + result.vitalityHeal);
  }
  if (hasTalent(state, "toughness")) {
    state.toughnessHitsThisMap = 0;
    result.toughnessReset = true;
  }
  state.secondBreathUsedThisMap = false;
  emit(state, "onEnterBiome", result);
  return result;
}

/**
 * Simulate extraction: transmutation (5% per rare item, one modifier max per item).
 * items: array of { id, rarity, modifiers, transmutationGranted }.
 * Returns { transmutationGrants: { itemId: modifierId } }.
 */
function onExtract(state, equippedRareItems = []) {
  const result = { transmutationGrants: {} };
  if (!hasTalent(state, "transmutation")) return result;
  for (const item of equippedRareItems) {
    if (item.rarity !== "rare" || item.transmutationGranted) continue;
    if (random(state) < TRANSMUTATION_CHANCE) {
      item.transmutationGranted = true;
      result.transmutationGrants[item.id] = "t1_mod";
    }
  }
  emit(state, "onExtract", result);
  return result;
}

/**
 * Simulate using a cube (Cube Cascade: 10% not consume).
 * Set state._nextRandom to control (e.g. 0.05 to proc, 0.2 to not proc).
 * Returns { cubeConsumed: boolean }.
 */
function onUseCube(state) {
  const proc = hasTalent(state, "cubeCascade") && random(state) < CUBE_CASCADE_CHANCE;
  state.cubeCascadeProc = proc;
  const cubeConsumed = !proc;
  emit(state, "onUseCube", { cubeCascadeProc: proc, cubeConsumed });
  return { cubeConsumed };
}

/**
 * Vault Master: secure an item (by id). Max 3. Returns { secured: boolean }.
 */
function vaultMasterSecure(state, itemId) {
  if (!hasTalent(state, "vaultMaster")) return { secured: false };
  const set = state.vaultMasterSecuredIds || new Set();
  if (set.has(String(itemId))) {
    set.delete(String(itemId));
    return { secured: false, removed: true };
  }
  if (set.size >= VAULT_MASTER_MAX_SECURED) return { secured: false };
  set.add(String(itemId));
  state.vaultMasterSecuredIds = set;
  return { secured: true };
}

/**
 * Simulate death: secured items persist (we just record that transfer would happen).
 */
function onDeath(state) {
  state.vaultMasterTransferred = state.vaultMasterSecuredIds && state.vaultMasterSecuredIds.size > 0;
  emit(state, "onDeath", { securedCount: state.vaultMasterSecuredIds ? state.vaultMasterSecuredIds.size : 0 });
  return { securedItemsPersist: state.vaultMasterTransferred };
}

// --- Getters for assertions ---

function getAttackSpeedMult(state) {
  let mult = 1;
  if (hasTalent(state, "rapid") && state.rapidTalentUntil > state.time) mult *= RAPID_ATK_SPEED_MULT;
  if (hasTalent(state, "perfectFlow") && state.perfectFlowUntil > state.time) mult *= PERFECT_FLOW_ATK_SPEED_MULT;
  return mult;
}

function getAttackDamageMult(state) {
  if (!hasTalent(state, "fierce")) return 1;
  return 1 + Math.min(FIERCE_STACK_CAP, state.fierceStacks) * FIERCE_PCT_PER_STACK;
}

module.exports = {
  createTalentState,
  hasTalent,
  random,
  tick,
  onHitEnemy,
  onKillEnemy,
  onDash,
  onTakeDamage,
  onHeal,
  onEnterBiome,
  onExtract,
  onUseCube,
  vaultMasterSecure,
  onDeath,
  getAttackSpeedMult,
  getAttackDamageMult,
  FIERCE_STACK_CAP,
  RAPID_DURATION,
  BLOOD_RITUAL_CAP,
  LIVING_FORTRESS_INTERVAL,
  LIVING_FORTRESS_CAP_PCT,
  CUBE_CASCADE_CHANCE,
  TRANSMUTATION_CHANCE,
  VAULT_MASTER_MAX_SECURED,
};
