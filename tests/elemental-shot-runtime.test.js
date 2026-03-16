"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  createElementalShotTestContext,
  createTestDummy,
  createEventLog
} = require("./attack-harness/elemental-shot-harness.js");

const {
  syncProfile,
  setCharge,
  setNextSurgeElement,
  simulateProjectileHit,
  stepEnvironment,
  triggerSwirlInteraction
} = require("./attack-harness/elemental-shot-helpers.js");

const {
  ensureCombatRuntime,
  spawnProjectile,
  stepCombatRuntimeLite
} = require("./attack-harness/combat-runtime-lite.js");

// --- BASE CYCLE TESTS ---

describe("Elemental Shot – base cycle (charge/surge)", () => {
  it("fire hit grants charge when default element is fire", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 1, evolution: { first: null, second: null } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    ctx.enemies = [e];
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 10 });
    const ev = log.getEventsByType("elemental_charge_gained");
    assert.strictEqual(ev.length, 1);
    assert.strictEqual(ev[0].gained, 1);
  });

  it("elemental_charge upgrade adds +1 additional charge on default hits", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 2,
      runAttackUpgrades: [{ id: "elemental_charge", level: 2 }]
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 10 });
    const ev = log.getEventsByType("elemental_charge_gained");
    assert.strictEqual(ev[0].gained, 3);
  });

  it("faster_charge reduces max charge threshold by 2 per stack (min 2)", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 3,
      runAttackUpgrades: [{ id: "faster_charge", level: 2 }]
    });
    await syncProfile(ctx, log);
    assert.strictEqual(ctx._maxChargeEffective, 8);
  });

  it("surge starts when charge reaches threshold and rotates next surge element", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 4 });
    await syncProfile(ctx, log);
    setNextSurgeElement(ctx, "wind", log);
    setCharge(ctx, ctx._maxChargeEffective, log);
    const e = createTestDummy("e1");
    // next default hit will try to start surge (charge already full)
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 10 });
    const started = log.getEventsByType("elemental_surge_started");
    assert.strictEqual(started.length, 1);
    assert.strictEqual(started[0].element, "wind");
    assert.strictEqual(ctx.elementalState, "wind");
    assert.strictEqual(ctx.elementalCharge, 0);
    // base profile default surge elements are wind -> lightning -> ...
    assert.strictEqual(ctx.nextElementalSurge, "lightning");
  });

  it("surge ends and returns to default element", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 5 });
    await syncProfile(ctx, log);
    ctx.elementalState = "wind";
    ctx.elementalSurgeEndTime = (ctx.time || 0) + 0.2;
    stepEnvironment(ctx, log, 0.25);
    const ended = log.getEventsByType("elemental_surge_ended");
    assert.strictEqual(ended.length, 1);
    assert.strictEqual(ctx.elementalState, "fire");
  });
});

// --- UPGRADE TESTS (key derived/runtime effects) ---

describe("Elemental Shot – upgrade effects (deterministic)", () => {
  it("burning_power increases burn DPS via burnMult", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 10,
      runAttackUpgrades: [{ id: "burning_power", level: 1 }],
      currentStats: { attack: 80, maxHealth: 100 }
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 100 });
    const burn = log.getEventsByType("burn_applied")[0];
    // burn scales from the player's attack stat, not the on-hit base damage.
    assert.strictEqual(Math.round(burn.dps), Math.round(80 * 0.2 * 1.2));
  });

  it("wind_bleed can deterministically proc with seed (chance treated as value)", async () => {
    // wind_bleed is defined as 10% per stack in defs; harness derives percent => 0.10.
    // Use a seed that makes random() < 0.10 on first call after setup.
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 123, // chosen to be stable
      runAttackUpgrades: [{ id: "wind_bleed", level: 1 }]
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    // force proc by stubbing random for this test only
    ctx.random = () => 0.05;
    simulateProjectileHit(ctx, log, e, { element: "wind", baseDamage: 100 });
    assert.strictEqual(log.getEventsByType("enemy_bleeding").length, 1);
  });

  it("lightning_conduction can deterministically stun with stubbed RNG", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 124,
      runAttackUpgrades: [{ id: "lightning_conduction", level: 1 }]
    });
    await syncProfile(ctx, log);
    ctx.random = () => 0.05;
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "lightning", baseDamage: 10 });
    assert.strictEqual(log.getEventsByType("enemy_stunned").length, 1);
  });

  it("wind_force enables knockback log when taken", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 20,
      runAttackUpgrades: [{ id: "wind_force", level: 1 }]
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "wind", baseDamage: 10 });
    assert.strictEqual(log.getEventsByType("wind_knockback").length, 1);
  });

  it("wind prolongs active burn by 0.2s", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 21,
      currentStats: { attack: 50, maxHealth: 100 }
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 10 });
    const before = e.burnUntil;
    simulateProjectileHit(ctx, log, e, { element: "wind", baseDamage: 10 });
    assert.ok(Math.abs(e.burnUntil - (before + 0.2)) < 1e-9);
    const prolonged = log.getEventsByType("burn_prolonged")[0];
    assert.strictEqual(prolonged.seconds, 0.2);
  });
});

// --- EVOLUTION RUNTIME TESTS (first evolutions) ---

describe("Elemental Shot – first evolution runtime behavior (profile-driven)", () => {
  it("Inferno Core: burn stack limit = 3 and burn damage mult = 2", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 30,
      evolution: { first: "damage", second: null },
      currentStats: { attack: 75, maxHealth: 100 }
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 100 });
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 100 });
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 100 });
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 100 });
    assert.strictEqual(e.burnStacks, 3);
    // burnDamageMult=2 doubles burn DPS from attack stat.
    const burn = log.getEventsByType("burn_applied")[0];
    assert.strictEqual(Math.round(burn.dps), Math.round(75 * 0.2 * 2));
  });

  it("Storm Engine: lightning feeds charge", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 31, evolution: { first: "rhythm", second: null } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    // default is fire in repo right now; lightning should still feed charge via link
    simulateProjectileHit(ctx, log, e, { element: "lightning", baseDamage: 10 });
    const gained = log.getEventsByType("elemental_charge_gained");
    assert.ok(gained.length >= 1);
    assert.ok(gained[0].gained >= 1);
  });

  it("Tempest Arc: wind knockback/pull flags are present (logged)", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 32, evolution: { first: "control", second: null } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "wind", baseDamage: 10 });
    assert.strictEqual(log.getEventsByType("wind_pull").length, 1);
    assert.strictEqual(log.getEventsByType("wind_knockback").length, 1);
  });

  it("Prismatic Cycle: surge duration = 4.5 and charge requirement = 8", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 33, evolution: { first: "elemental", second: null } });
    await syncProfile(ctx, log);
    assert.strictEqual(ctx._maxChargeEffective, 8);
    setCharge(ctx, 8, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "fire", baseDamage: 10 });
    const started = log.getEventsByType("elemental_surge_started")[0];
    assert.strictEqual(started.durationSec, 4.5);
  });
});

// --- SECOND EVOLUTION KEY FORMS ---

describe("Elemental Shot – second evolution key forms (smoke tests)", () => {
  it("Meteorfall: surge profile exists and meteor attackMode set in profile (evolution test covers; runtime smoke)", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 40, evolution: { first: "damage", second: "damage" } });
    const profile = await syncProfile(ctx, log);
    assert.strictEqual(profile.formId, "meteorfall");
    assert.strictEqual(profile.attackMode, "meteor");
  });

  it("Storm Circle: storm spawns and ticks", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 41, evolution: { first: "rhythm", second: "control" } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    ctx.enemies = [e];
    simulateProjectileHit(ctx, log, e, { element: "lightning", baseDamage: 50 });
    assert.strictEqual(log.getEventsByType("storm_spawned").length, 1);
    stepEnvironment(ctx, log, 0.41);
    assert.strictEqual(log.getEventsByType("storm_tick").length, 1);
    // slow applied
    assert.ok(e.slowUntil > 0);
  });

  it("Storm Circle: lightning detonation consumes one burn stack", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 411,
      evolution: { first: "rhythm", second: "control" },
      currentStats: { attack: 80, maxHealth: 100 }
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    ctx.enemies = [e];
    e.burnUntil = (ctx.time || 0) + 2;
    e.burnDps = 32;
    e.burnStacks = 2;
    e.burnAccum = 0;
    const beforeDps = e.burnDps;
    assert.strictEqual(e.burnStacks, 2);
    simulateProjectileHit(ctx, log, e, { element: "lightning", baseDamage: 10 });
    assert.strictEqual(log.getEventsByType("burn_detonated").length, 1);
    assert.strictEqual(e.burnStacks, 1);
    assert.ok(e.burnUntil > 0);
    assert.ok(e.burnDps > 0);
    assert.ok(e.burnDps < beforeDps);
  });

  it("Overcharged Core: modifier surge behavior present", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 42, evolution: { first: "rhythm", second: "elemental" } });
    const profile = await syncProfile(ctx, log);
    assert.strictEqual(profile.formId, "overcharged_core");
    assert.strictEqual(profile.surgeBehavior.type, "modifier");
  });

  it("Thunder Gale: stunChance=1 makes wind stun", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 43, evolution: { first: "control", second: "rhythm" } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    simulateProjectileHit(ctx, log, e, { element: "wind", baseDamage: 10 });
    assert.strictEqual(log.getEventsByType("enemy_stunned").length, 1);
  });

  it("Razor Tempest: custom volley config is present (runtime implemented in game.js; harness verifies profile flag)", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 44, evolution: { first: "control", second: "control" } });
    const profile = await syncProfile(ctx, log);
    assert.strictEqual(profile.formId, "razor_tempest");
    assert.ok(profile.projectileMods.razorTempestVolley === true);
  });

  it("Elemental Cyclone: swirl triggers firestorm and lightning split without loops", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 45, evolution: { first: "control", second: "elemental" } });
    await syncProfile(ctx, log);
    // seed a swirl at 0,0
    ctx.elementalSwirls.push({ x: 0, y: 0, radius: 40, endTime: ctx.time + 10, consumed: false });
    const ok1 = triggerSwirlInteraction(ctx, log, "fire", 0, 0, 50);
    assert.strictEqual(ok1, true);
    // consumed; second trigger should fail
    const ok2 = triggerSwirlInteraction(ctx, log, "lightning", 0, 0, 50);
    assert.strictEqual(ok2, false);
    assert.strictEqual(log.getEventsByType("swirl_triggered").length, 1);
  });

  it("Prismatic Surge: multi surge behavior present in profile", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 46, evolution: { first: "elemental", second: "elemental" } });
    const profile = await syncProfile(ctx, log);
    assert.strictEqual(profile.formId, "prismatic_surge");
    assert.strictEqual(profile.surgeBehavior.type, "multi");
  });
});

// --- COMBAT-RUNTIME-LITE: projectile travel, hit, expiry ---

describe("Elemental Shot – combat-runtime-lite (projectile travel, hit, expiry)", () => {
  it("projectile advances over time and event log records movement and expiry", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 100 });
    await syncProfile(ctx, log);
    ensureCombatRuntime(ctx);
    ctx.enemies = [];
    await spawnProjectile(ctx, log, 0, 0, 1, 0, 10, { elementalState: "fire" });
    assert.strictEqual(ctx.projectiles.length, 1);
    assert.strictEqual(log.getEventsByType("projectile_spawned").length, 1);

    // Max dist 1400, speed 520 → ~2.7s to expire. Step until expired.
    for (let i = 0; i < 40; i++) await stepCombatRuntimeLite(ctx, 0.1, log);
    const moved = log.getEventsByType("projectile_moved");
    assert.ok(moved.length >= 1);
    const expired = log.getEventsByType("projectile_expired");
    assert.ok(expired.length >= 1);
    assert.strictEqual(expired[0].reason, "range_or_lifetime");
  });

  it("projectile hits enemy and applies damage and elemental on-hit", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 101 });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1", { x: 150, y: 0, health: 100 });
    ctx.enemies = [e];
    ensureCombatRuntime(ctx);
    await spawnProjectile(ctx, log, 0, 0, 200, 0, 25, { elementalState: "fire" });

    while (ctx.projectiles.length > 0 && (ctx.projectiles[0].position.x < 200)) {
      await stepCombatRuntimeLite(ctx, 0.05, log);
    }
    const hits = log.getEventsByType("projectile_hit");
    assert.ok(hits.length >= 1);
    assert.strictEqual(hits[0].targetId, "e1");
    assert.ok(e.health < 100);
    assert.ok(log.getEventsByType("burn_applied").length >= 1);
  });

  it("with seeking upgrade projectile direction shifts toward nearest enemy", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({
      seed: 102,
      runAttackUpgrades: [{ id: "seeking", level: 1 }]
    });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1", { x: 500, y: 80 });
    ctx.enemies = [e];
    ensureCombatRuntime(ctx);
    await spawnProjectile(ctx, log, 0, 0, 400, 0, 10, { elementalState: "fire" });

    const initialVy = ctx.projectiles[0].velocity.y;
    for (let i = 0; i < 10; i++) await stepCombatRuntimeLite(ctx, 0.1, log);
    const proj = ctx.projectiles[0];
    assert.ok(proj && !proj.isExpired(), "projectile should still be in flight");
    assert.ok(proj.velocity.y !== initialVy, "seeking should change velocity toward enemy");
  });

  it("volley spawns correct projectile count and pierce exhausts", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 103 });
    await syncProfile(ctx, log);
    ctx.enemies = [];
    ensureCombatRuntime(ctx);
    const count = 3;
    for (let i = 0; i < count; i++) {
      const angle = (i - 1) * 0.2;
      await spawnProjectile(ctx, log, 200, 200, 200 + Math.cos(angle) * 100, 200 + Math.sin(angle) * 100, 10, {
        elementalState: "wind",
        piercesRemaining: 1
      });
    }
    assert.strictEqual(ctx.projectiles.length, count);
    assert.strictEqual(log.getEventsByType("projectile_spawned").length, count);

    for (let i = 0; i < 50; i++) await stepCombatRuntimeLite(ctx, 0.1, log);
    const expired = log.getEventsByType("projectile_expired");
    assert.ok(expired.length >= count);
  });

  it("storm spawns from runtime projectile hit and ticks for bounded duration", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 104, evolution: { first: "rhythm", second: "control" } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1", { x: 120, y: 0, health: 200, size: 32 });
    ctx.enemies = [e];
    ensureCombatRuntime(ctx);
    await spawnProjectile(ctx, log, 0, 0, 200, 0, 30, { elementalState: "lightning" });

    while (ctx.projectiles.length > 0 && ctx.time < 2) await stepCombatRuntimeLite(ctx, 0.05, log);
    for (let i = 0; i < 15; i++) await stepCombatRuntimeLite(ctx, 0.1, log);
    assert.ok(log.getEventsByType("storm_spawned").length >= 1);
    const ticks = log.getEventsByType("storm_tick");
    assert.ok(ticks.length >= 1);
    assert.ok(ticks.length <= 10);
  });

  it("swirl + lightning produces split projectiles and consumes swirl", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 105, evolution: { first: "control", second: "elemental" } });
    await syncProfile(ctx, log);
    ctx.elementalSwirls.push({ x: 100, y: 50, radius: 40, endTime: ctx.time + 10, consumed: false });
    const e = createTestDummy("e1", { x: 250, y: 50, health: 100 });
    ctx.enemies = [e];
    ensureCombatRuntime(ctx);
    await spawnProjectile(ctx, log, 0, 50, 300, 50, 20, { elementalState: "lightning" });

    let steps = 0;
    while (ctx.projectiles.length > 0 && steps < 60) {
      await stepCombatRuntimeLite(ctx, 0.1, log);
      steps++;
    }
    const swirlEv = log.getEventsByType("swirl_triggered");
    const splitEv = log.getEventsByType("projectile_split");
    assert.ok(swirlEv.length >= 1);
    assert.ok(splitEv.length >= 1);
    assert.strictEqual(ctx.elementalSwirls.filter((s) => !s.consumed).length, 0);
  });
});

// --- SAFETY TESTS ---

describe("Elemental Shot – safety bounds", () => {
  it("storm ticks are bounded by duration and tick interval", async () => {
    const log = createEventLog();
    const ctx = await createElementalShotTestContext({ seed: 60, evolution: { first: "rhythm", second: "control" } });
    await syncProfile(ctx, log);
    const e = createTestDummy("e1");
    ctx.enemies = [e];
    simulateProjectileHit(ctx, log, e, { element: "lightning", baseDamage: 50 });
    // Simulate 10 seconds; storm lasts 3 sec, tick interval 0.4 => <= 8 ticks
    for (let i = 0; i < 40; i++) stepEnvironment(ctx, log, 0.25);
    assert.ok(log.getEventsByType("storm_tick").length <= 10);
  });
});
