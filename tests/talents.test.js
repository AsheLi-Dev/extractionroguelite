"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  createTalentState,
  hasTalent,
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
  VAULT_MASTER_MAX_SECURED,
} = require("./talent-simulator.js");
const {
  createMockPlayer,
  createMockEnemy,
  createRunState,
  mockRandom,
  setNextRandom,
} = require("./talent-test-helpers.js");

// --- 1. Trigger tests ---

describe("Talent trigger tests", () => {
  it("Fierce: hitting enemy adds damage stacks and increases damage mult", () => {
    const state = createRunState({ characterTalents: ["fierce"] });
    const r1 = onHitEnemy(state, {});
    assert.strictEqual(state.fierceStacks, 1);
    assert.ok(r1.damageMult > 1);
    const r2 = onHitEnemy(state, {});
    assert.strictEqual(state.fierceStacks, 2);
    assert.ok(r2.damageMult > r1.damageMult);
  });

  it("Rapid: dashing grants attack speed buff", () => {
    const state = createRunState({ characterTalents: ["rapid"] });
    assert.strictEqual(getAttackSpeedMult(state), 1);
    onDash(state);
    assert.ok(getAttackSpeedMult(state) > 1);
  });

  it("Heavy Hit: every 4th attack consumes dash and applies 1.4x damage", () => {
    const state = createRunState({ characterTalents: ["heavyHit"], dashCharges: 2 });
    for (let i = 0; i < 3; i++) {
      const r = onHitEnemy(state, {});
      assert.ok(!r.consumedDash);
    }
    const r4 = onHitEnemy(state, {});
    assert.ok(r4.consumedDash);
    assert.ok(r4.damageMult >= 1.4);
    assert.strictEqual(state.dashCharges, 1);
  });

  it("Dashing Attack: on dash, automatic attack fires", () => {
    const state = createRunState({ characterTalents: ["dashingAttack"] });
    assert.strictEqual(state.dashingAttackFired, false);
    onDash(state);
    assert.strictEqual(state.dashingAttackFired, true);
  });

  it("Blood Ritual: killing enemies builds stacks; at 10 next hit heals", () => {
    const state = createRunState({ characterTalents: ["bloodRitual"] });
    for (let i = 0; i < 9; i++) {
      onKillEnemy(state, {});
      assert.ok(state.bloodRitualStacks < BLOOD_RITUAL_CAP || state.bloodRitualNextHitHeal);
    }
    onKillEnemy(state, {});
    assert.strictEqual(state.bloodRitualStacks, 0);
    assert.strictEqual(state.bloodRitualNextHitHeal, true);
    const result = onHitEnemy(state, { damageDealt: 100 });
    assert.ok(result.bloodRitualHeal > 0);
  });

  it("Living Fortress: tick adds shield every 8s up to cap", () => {
    const state = createRunState({ characterTalents: ["livingFortress"], maxHealth: 100 });
    assert.strictEqual(state.livingFortressShield, 0);
    tick(state, LIVING_FORTRESS_INTERVAL);
    assert.ok(state.livingFortressShield > 0);
    assert.ok(state.livingFortressShield <= 100 * LIVING_FORTRESS_CAP_PCT);
  });

  it("Perfect Flow: two dashes within 0.5s grant attack speed buff", () => {
    const state = createRunState({ characterTalents: ["perfectFlow"] });
    onDash(state);
    assert.strictEqual(getAttackSpeedMult(state), 1);
    onDash(state);
    assert.ok(getAttackSpeedMult(state) > 1);
  });

  it("Cube Cascade: 10% chance not to consume cube when using (deterministic via RNG)", () => {
    const state = createRunState({ characterTalents: ["cubeCascade"] });
    setNextRandom(state, 0.05);
    const r = onUseCube(state);
    assert.strictEqual(r.cubeConsumed, false);
    setNextRandom(state, 0.5);
    const r2 = onUseCube(state);
    assert.strictEqual(r2.cubeConsumed, true);
  });

  it("Transmutation: on extract, rare items can gain one T1 modifier (5%, mock RNG)", () => {
    const state = createRunState({ characterTalents: ["transmutation"] });
    const item = { id: "helm1", rarity: "rare", modifiers: [], transmutationGranted: false };
    setNextRandom(state, 0.02);
    const out = onExtract(state, [item]);
    assert.ok(Object.keys(out.transmutationGrants).length === 1);
    assert.strictEqual(item.transmutationGranted, true);
  });

  it("Vault Master: secure item adds to secured set", () => {
    const state = createRunState({ characterTalents: ["vaultMaster"] });
    const r = vaultMasterSecure(state, "item1");
    assert.strictEqual(r.secured, true);
    assert.ok(state.vaultMasterSecuredIds.has("item1"));
  });
});

// --- 2. Non-trigger tests ---

describe("Talent non-trigger tests", () => {
  it("Fierce: no stacks when talent not equipped", () => {
    const state = createRunState({ characterTalents: [] });
    onHitEnemy(state, {});
    assert.strictEqual(state.fierceStacks, 0);
  });

  it("Rapid: no buff when talent not equipped", () => {
    const state = createRunState({ characterTalents: [] });
    onDash(state);
    assert.strictEqual(getAttackSpeedMult(state), 1);
  });

  it("Heavy Hit: no dash consume when talent not equipped", () => {
    const state = createRunState({ characterTalents: [], dashCharges: 2 });
    for (let i = 0; i < 5; i++) onHitEnemy(state, {});
    assert.strictEqual(state.dashCharges, 2);
  });

  it("Cube Cascade: always consume when talent not equipped", () => {
    const state = createRunState({ characterTalents: [] });
    setNextRandom(state, 0);
    const r = onUseCube(state);
    assert.strictEqual(r.cubeConsumed, true);
  });

  it("Transmutation: no grants when talent not equipped", () => {
    const state = createRunState({ characterTalents: [] });
    const item = { id: "x", rarity: "rare", transmutationGranted: false };
    const out = onExtract(state, [item]);
    assert.strictEqual(Object.keys(out.transmutationGrants).length, 0);
    assert.strictEqual(item.transmutationGranted, false);
  });

  it("Transmutation: item cannot gain more than one modifier this way", () => {
    const state = createRunState({ characterTalents: ["transmutation"] });
    const item = { id: "y", rarity: "rare", transmutationGranted: true };
    mockRandom(state, [0, 0, 0]);
    const out = onExtract(state, [item]);
    assert.strictEqual(Object.keys(out.transmutationGrants).length, 0);
  });
});

// --- 3. Stack / cap tests ---

describe("Stack and cap tests", () => {
  it("Fierce: stacks stop at 10", () => {
    const state = createRunState({ characterTalents: ["fierce"] });
    for (let i = 0; i < 15; i++) onHitEnemy(state, {});
    assert.strictEqual(state.fierceStacks, FIERCE_STACK_CAP);
    assert.strictEqual(getAttackDamageMult(state), 1 + FIERCE_STACK_CAP * 0.02);
  });

  it("Blood Ritual: stacks reset to 0 at 10 and trigger next-hit heal", () => {
    const state = createRunState({ characterTalents: ["bloodRitual"] });
    for (let i = 0; i < 10; i++) onKillEnemy(state, {});
    assert.strictEqual(state.bloodRitualStacks, 0);
    assert.strictEqual(state.bloodRitualNextHitHeal, true);
  });

  it("Vault Master: cannot secure more than 3 items", () => {
    const state = createRunState({ characterTalents: ["vaultMaster"] });
    for (let i = 0; i < VAULT_MASTER_MAX_SECURED; i++) {
      const r = vaultMasterSecure(state, `item${i}`);
      assert.strictEqual(r.secured, true);
    }
    const r = vaultMasterSecure(state, "itemX");
    assert.strictEqual(r.secured, false);
    assert.strictEqual(state.vaultMasterSecuredIds.size, VAULT_MASTER_MAX_SECURED);
  });
});

// --- 4. Duration / reset tests ---

describe("Duration and reset tests", () => {
  it("Rapid: buff expires after 3s", () => {
    const state = createRunState({ characterTalents: ["rapid"] });
    onDash(state);
    assert.ok(getAttackSpeedMult(state) > 1);
    tick(state, RAPID_DURATION + 0.1);
    assert.strictEqual(getAttackSpeedMult(state), 1);
  });

  it("Perfect Flow: buff expires after 2s", () => {
    const state = createRunState({ characterTalents: ["perfectFlow"] });
    onDash(state);
    onDash(state);
    assert.ok(getAttackSpeedMult(state) > 1);
    tick(state, 2.1);
    assert.strictEqual(getAttackSpeedMult(state), 1);
  });

  it("Living Fortress: shield does not exceed 30% cap", () => {
    const state = createRunState({ characterTalents: ["livingFortress"], maxHealth: 100 });
    for (let i = 0; i < 10; i++) tick(state, LIVING_FORTRESS_INTERVAL);
    assert.ok(state.livingFortressShield <= 100 * LIVING_FORTRESS_CAP_PCT);
  });
});

// --- 5. Persistence tests ---

describe("Persistence tests", () => {
  it("Vault Master: secured items persist through death (transfer flag)", () => {
    const state = createRunState({ characterTalents: ["vaultMaster"] });
    vaultMasterSecure(state, "a");
    vaultMasterSecure(state, "b");
    const death = onDeath(state);
    assert.strictEqual(death.securedItemsPersist, true);
    assert.strictEqual(state.vaultMasterSecuredIds.size, 2);
  });

  it("Vault Master: secure then remove by toggling same id", () => {
    const state = createRunState({ characterTalents: ["vaultMaster"] });
    vaultMasterSecure(state, "x");
    assert.ok(state.vaultMasterSecuredIds.has("x"));
    const r = vaultMasterSecure(state, "x");
    assert.ok(r.removed);
    assert.ok(!state.vaultMasterSecuredIds.has("x"));
  });
});

// --- 6. Multi-event simulation tests ---

describe("Multi-event simulation tests", () => {
  it("dash -> attack -> kill -> extract sequence", () => {
    const state = createRunState({
      characterTalents: ["rapid", "fierce", "bloodRitual", "transmutation"],
    });
    onDash(state);
    assert.ok(getAttackSpeedMult(state) > 1);
    onHitEnemy(state, {});
    assert.strictEqual(state.fierceStacks, 1);
    onKillEnemy(state, { maxHealth: 50 });
    assert.strictEqual(state.bloodRitualStacks, 1);
    const item = { id: "weapon1", rarity: "rare", transmutationGranted: false };
    setNextRandom(state, 0.01);
    const ext = onExtract(state, [item]);
    assert.ok(state.events.some((e) => e.name === "onDash"));
    assert.ok(state.events.some((e) => e.name === "onKillEnemy"));
    assert.ok(state.events.some((e) => e.name === "onExtract"));
  });

  it("Heavy Hit: dash -> 4 attacks consumes one dash", () => {
    const state = createRunState({ characterTalents: ["heavyHit"], dashCharges: 2 });
    onDash(state);
    let consumed = 0;
    for (let i = 0; i < 4; i++) {
      const r = onHitEnemy(state, {});
      if (r.consumedDash) consumed++;
    }
    assert.ok(consumed >= 1);
    assert.ok(state.dashCharges <= 1);
  });
});
