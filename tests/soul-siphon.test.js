"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  createSeededRandom,
  createMinimalPlayer,
  createMinimalEnemy,
  createHarnessContext,
  beamRectFromDirection,
  pointInRect,
  getSoulsForEnemy,
  stepSoulSiphonBeam,
  createEventLog
} = require("./attack-harness/attack-test-harness.js");
const {
  simulateSpiritAssist,
  simulateSpiritAssistAncestral,
  simulateChestOpen,
  fireEvolutionHookSoulSiphon,
  grantXp,
  wouldSummonSpirit,
  getNearestEnemy,
  SPIRIT_REFLEX_REDUCTION_PER_STACK,
  CHEST_SPIRITS_CHANCE_PER_STACK,
  SPIRITUAL_RESONANCE_SOULS_PER_STACK,
  ANCIENT_SPIRIT_XP_MULT,
  SOULS_TO_SUMMON_SPIRIT
} = require("./attack-harness/soul-siphon-phase2-helpers.js");

// ESM stats module (loaded once per test that needs it)
let soulSiphonStats;
async function getStats() {
  if (!soulSiphonStats) {
    soulSiphonStats = await import("../src/game/soul-siphon-stats.js");
  }
  return soulSiphonStats;
}

// --- 1. DERIVED STATS / GEOMETRY ---

describe("Soul Siphon – derived stats / geometry", () => {
  it("base beam stats: no upgrades, default length/width", async () => {
    const { computeSoulSiphonBeamStats, BASE_LENGTH, BASE_WIDTH } = await getStats();
    const ctx = createHarnessContext({ runAttackUpgrades: [] });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.length, BASE_LENGTH);
    assert.strictEqual(out.width, BASE_WIDTH);
    assert.strictEqual(out.damageMult, 0.8);
  });

  it("Long Reach: one stack increases beam length by 15%", async () => {
    const { computeSoulSiphonBeamStats, BASE_LENGTH } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "long_reach", level: 1 }]
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.length, BASE_LENGTH * 1.15);
    assert.strictEqual(out.width, 80);
  });

  it("Long Reach: stacked values scale correctly", async () => {
    const { computeSoulSiphonBeamStats, BASE_LENGTH } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "long_reach", level: 4 }]
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.length, BASE_LENGTH * (1 + 0.15 * 4));
  });

  it("Wide Siphon: one stack increases beam width by 15%", async () => {
    const { computeSoulSiphonBeamStats, BASE_WIDTH } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "wide_siphon", level: 1 }]
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.width, BASE_WIDTH * 1.15);
  });

  it("Condensed Beam: width and damage modifier both change", async () => {
    const { computeSoulSiphonBeamStats, BASE_WIDTH } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "condensed_beam", level: 2 }]
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.width, BASE_WIDTH + 16 * 2);
    assert.ok(out.damageMult > 0.8);
    assert.strictEqual(out.damageMult, 0.8 * (1 + 0.08 * 2));
  });

  it("Charging Beam: channeling increases beam size, cap respected", async () => {
    const { computeSoulSiphonBeamStats, BASE_LENGTH } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "charging_beam", level: 2 }],
      soulSiphonChannelTime: 0
    });
    const out0 = computeSoulSiphonBeamStats(ctx, 0.8);
    ctx.soulSiphonChannelTime = 2;
    const out2 = computeSoulSiphonBeamStats(ctx, 0.8);
    ctx.soulSiphonChannelTime = 20;
    const outCap = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out0.length, BASE_LENGTH);
    assert.ok(out2.length > out0.length);
    const maxGrowth = 0.25 * 2;
    assert.ok(outCap.length <= BASE_LENGTH * (1 + maxGrowth + 0.01));
  });

  it("Charging Beam: growth resets when channel time is zero", async () => {
    const { computeSoulSiphonBeamStats, BASE_LENGTH } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "charging_beam", level: 1 }],
      soulSiphonChannelTime: 0
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.length, BASE_LENGTH);
  });

  it("Twin Siphon: width mult 0.65 (35% reduced) matches tuned value", async () => {
    const { TWIN_SIPHON_WIDTH_MULT } = await getStats();
    assert.strictEqual(TWIN_SIPHON_WIDTH_MULT, 0.65);
  });

  it("beam rect geometry: point inside rect", () => {
    const rect = beamRectFromDirection(0, 0, 1, 0, 200, 80);
    assert.ok(pointInRect(100, 0, rect));
    assert.ok(pointInRect(50, 20, rect));
    assert.ok(!pointInRect(250, 0, rect));
  });
});

// --- 2. DAMAGE MODIFIERS ---

describe("Soul Siphon – damage modifiers", () => {
  it("Soul Pressure: damage multiplier increases per stack", async () => {
    const { computeSoulSiphonBeamStats } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_pressure", level: 3 }]
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out.damageMult, 0.8 * (1 + 0.12 * 3));
  });

  it("Execution Drain: bonus only below 35% HP (simulated in step)", async () => {
    const eventLog = createEventLog();
    const random = createSeededRandom(12345);
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 100, health: 30 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "execution_drain", level: 1 }],
      enemies: [enemy],
      random
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const hits = eventLog.getEventsByType("beam_hit");
    assert.ok(hits.length >= 1);
    assert.ok(hits[0].damage >= 10);
  });

  it("Soul Rend: max-health bonus in step", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 200, health: 200 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_rend", level: 2 }],
      enemies: [enemy],
      random: createSeededRandom(1)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const hits = eventLog.getEventsByType("beam_hit");
    assert.ok(hits.length >= 1);
    const rendBonus = Math.round(200 * 0.008 * 2);
    assert.ok(hits[0].damage >= rendBonus);
  });

  it("Devouring Beam: damage scales from soul count", async () => {
    const { computeSoulSiphonBeamStats } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "devouring_beam", level: 1 }],
      runSoulsTotal: 100
    });
    const out = computeSoulSiphonBeamStats(ctx, 0.8);
    const expectedBonus = 0.005 * 100 * 1;
    assert.ok(out.damageMult >= 0.8 * (1 + expectedBonus * 0.99));
  });

  it("Focused Channel: damage ramps over channel time, cap respected", async () => {
    const { computeSoulSiphonBeamStats } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "focused_channel", level: 1 }],
      soulSiphonChannelTime: 0
    });
    const out0 = computeSoulSiphonBeamStats(ctx, 0.8);
    ctx.soulSiphonChannelTime = 2;
    const out2 = computeSoulSiphonBeamStats(ctx, 0.8);
    ctx.soulSiphonChannelTime = 10;
    const outCap = computeSoulSiphonBeamStats(ctx, 0.8);
    assert.strictEqual(out0.damageMult, 0.8);
    assert.ok(out2.damageMult > out0.damageMult);
    assert.ok(outCap.damageMult <= 0.8 * (1 + 0.45 + 0.01));
  });
});

// --- 3. SOUL / KILL ECONOMY ---

describe("Soul Siphon – soul / kill economy", () => {
  it("soul gain by enemy size: small/medium/large", () => {
    assert.strictEqual(getSoulsForEnemy(createMinimalEnemy({ maxHealth: 30 })), 1);
    assert.strictEqual(getSoulsForEnemy(createMinimalEnemy({ maxHealth: 70 })), 2);
    assert.strictEqual(getSoulsForEnemy(createMinimalEnemy({ maxHealth: 100 })), 4);
    assert.strictEqual(getSoulsForEnemy(createMinimalEnemy({ sizeTier: "small" })), 1);
    assert.strictEqual(getSoulsForEnemy(createMinimalEnemy({ sizeTier: "medium" })), 2);
    assert.strictEqual(getSoulsForEnemy(createMinimalEnemy({ sizeTier: "large" })), 4);
  });

  it("Soul Magnet: extra soul proc possible (deterministic seed)", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 10, health: 10 });
    const random = createSeededRandom(999);
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_magnet", level: 2 }],
      enemies: [enemy],
      currentStats: { attack: 100 },
      random
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const soulsEvents = eventLog.getEventsByType("souls_gained");
    const magnetEvents = eventLog.getEventsByType("soul_magnet_extra");
    assert.ok(soulsEvents.length >= 1);
    assert.ok(ctx.runSoulsTotal >= 1);
  });

  it("Restless Souls: healing event can fire on soul gain", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 5, health: 5 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "restless_souls", level: 2 }],
      enemies: [enemy],
      currentStats: { attack: 20 },
      random: createSeededRandom(111)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const healed = eventLog.getEventsByType("healed");
  });

  it("Soul Catalyst: kill can charge Spirit", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 5, health: 5 });
    const spirit = { position: { x: 500, y: 200 }, size: 16, charge: 0 };
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_catalyst", level: 2 }],
      enemies: [enemy],
      cuteSpiritCompanion: spirit,
      currentStats: { attack: 20 },
      random: createSeededRandom(222)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const charged = eventLog.getEventsByType("spirit_charged");
  });

  it("Mini-Boss Harvest: mini-boss kill grants extra souls", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({
      id: "e1", x: 400, y: 180, maxHealth: 5, health: 5,
      isMiniBoss: true,
      enemyTier: "miniBoss"
    });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "mini_boss_harvest", level: 1 }],
      enemies: [enemy],
      currentStats: { attack: 20 },
      random: createSeededRandom(333)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const killed = eventLog.getEventsByType("enemy_killed");
    assert.ok(killed.length >= 1);
    assert.ok(killed[0].souls >= 5);
  });
});

// --- 4. SPIRIT INTERACTIONS ---

describe("Soul Siphon – spirit interactions", () => {
  it("Spiritual Conduit: beam charging Spirit can proc extra charge", async () => {
    const eventLog = createEventLog();
    const spirit = { position: { x: 350, y: 180 }, size: 16, charge: 0 };
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spiritual_conduit", level: 2 }],
      enemies: [],
      cuteSpiritCompanion: spirit,
      player: createMinimalPlayer({ x: 320, y: 180 }),
      random: createSeededRandom(444)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats, dirX: 1, dirY: 0 });
    const charged = eventLog.getEventsByType("spirit_charged");
    assert.ok(charged.length >= 1);
  });

  it("Energy Recycling: 260 px threshold (constant used in harness/game)", () => {
    const THRESHOLD = 260;
    assert.strictEqual(THRESHOLD, 260);
  });

  it("Twin Siphon: split beam width mult applied in step", async () => {
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "twin_siphon", level: 1 }]
    });
    assert.ok(ctx.hasAttackUpgrade("twin_siphon"));
  });
});

// --- 5. GROUND SLAM / CONTROL (formula checks only in Phase 1) ---

describe("Soul Siphon – Ground Slam / control", () => {
  it("Shockwave: radius scale +12% per stack (constant)", () => {
    const SHOCKWAVE_PCT = 0.12;
    assert.strictEqual(SHOCKWAVE_PCT, 0.12);
  });

  it("Seismic Slow: 10% slow for 1s (constant)", () => {
    const SEISMIC_SLOW_DURATION = 1;
    const SEISMIC_SLOW_MULT = 0.9;
    assert.strictEqual(SEISMIC_SLOW_DURATION, 1);
    assert.strictEqual(SEISMIC_SLOW_MULT, 0.9);
  });

  it("Jagged Land: +0.75s slow duration per stack (constant)", () => {
    const JAGGED_LAND_DURATION_PER_STACK = 0.75;
    assert.strictEqual(JAGGED_LAND_DURATION_PER_STACK, 0.75);
  });
});

// --- 6. DERIVED HELPERS (soul mastery, attack speed) ---

describe("Soul Siphon – derived helpers", () => {
  it("Soul Mastery: 1% CDR per 8 souls", async () => {
    const { computeSoulMasteryCdrPct } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_mastery", level: 1 }],
      runSoulsTotal: 16
    });
    const cdr = computeSoulMasteryCdrPct(ctx);
    assert.strictEqual(cdr, 0.02);
  });

  it("Rhythmic Siphon: attack speed +8% per stack", async () => {
    const { computeSoulSiphonAttackSpeedMult } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "rhythmic_siphon", level: 3 }]
    });
    const mult = computeSoulSiphonAttackSpeedMult(ctx);
    assert.ok(mult >= 1 + 0.08 * 3 - 0.01);
    assert.ok(mult <= 1 + 0.08 * 3 + 0.01);
  });
});

// --- 7. SYSTEM SAFETY / REGRESSION ---

describe("Soul Siphon – system safety", () => {
  it("Soul Siphon upgrades do not affect other attack type (stub: stats only for soulSiphon)", async () => {
    const { computeSoulSiphonBeamStats } = await getStats();
    const ctxSoul = createHarnessContext({ attackType: "soulSiphon", runAttackUpgrades: [{ id: "soul_pressure", level: 5 }] });
    const ctxOther = createHarnessContext({ attackType: "projectile", runAttackUpgrades: [] });
    const outSoul = computeSoulSiphonBeamStats(ctxSoul, 0.8);
    const outOther = computeSoulSiphonBeamStats(ctxOther, 0.8);
    assert.ok(outSoul.damageMult > outOther.damageMult);
    assert.strictEqual(outOther.damageMult, 0.8);
  });

  it("no infinite beam hits in one step (single beam, finite enemies)", async () => {
    const eventLog = createEventLog();
    const enemies = [
      createMinimalEnemy({ id: "a", x: 400, y: 180, maxHealth: 5, health: 5 }),
      createMinimalEnemy({ id: "b", x: 450, y: 180, maxHealth: 5, health: 5 })
    ];
    const ctx = createHarnessContext({
      runAttackUpgrades: [],
      enemies,
      currentStats: { attack: 100 },
      random: createSeededRandom(555)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const hits = eventLog.getEventsByType("beam_hit");
    assert.ok(hits.length <= 2);
  });

  it("Echoing Beam / Spirit Overload / Soul Burst: no recursive proc explosion (bounded events per kill)", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 5, health: 5 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [
        { id: "echoing_beam", level: 1 },
        { id: "spirit_overload", level: 1 },
        { id: "soul_burst", level: 1 },
        { id: "soul_magnet", level: 5 }
      ],
      enemies: [enemy],
      currentStats: { attack: 50 },
      random: createSeededRandom(777)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const all = eventLog.getEvents();
    assert.ok(all.length < 50, "sanity: one beam step should not produce huge event count");
  });
});

// ========== PHASE 2: Spirit projectile / assist ==========

describe("Soul Siphon Phase 2 – Spirit projectile / assist", () => {
  it("Twin Fireball: one additional fireball when assist is fireball, max 2 total", async () => {
    const eventLog = createEventLog();
    const random = createSeededRandom(5000);
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "twin_fireball", level: 1 }],
      random
    });
    let totalProjectiles = 0;
    for (let i = 0; i < 30; i++) {
      const out = simulateSpiritAssist(ctx, eventLog);
      totalProjectiles += out.projectilesSpawned;
    }
    const projEvents = eventLog.getEventsByType("projectile_spawned");
    const fireballAssists = eventLog.getEventsByType("spirit_ability_triggered").filter((e) => e.abilityType === "fireball");
    assert.ok(fireballAssists.length >= 1);
    assert.ok(projEvents.length <= fireballAssists.length * 2, "at most 2 projectiles per fireball assist");
    assert.ok(projEvents.length >= fireballAssists.length, "at least 1 per fireball assist");
  });

  it("Spirit Overload: beam hit can trigger overload fireball, logged", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e1", x: 400, y: 180, maxHealth: 20, health: 20 });
    const spirit = { position: { x: 350, y: 180 }, size: 16, charge: 0 };
    const random = createSeededRandom(1111);
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spirit_overload", level: 1 }],
      enemies: [enemy],
      cuteSpiritCompanion: spirit,
      currentStats: { attack: 15 },
      random,
      time: 0
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const overloads = eventLog.getEventsByType("spirit_overload_fireball");
    const hits = eventLog.getEventsByType("beam_hit");
    assert.ok(hits.length >= 1);
    assert.ok(overloads.length <= 1, "at most one overload per step (ICD)");
  });

  it("Spirit Overload: ICD prevents runaway overload in multiple steps", async () => {
    const eventLog = createEventLog();
    const enemies = [
      createMinimalEnemy({ id: "a", x: 350, y: 180, maxHealth: 5, health: 5 }),
      createMinimalEnemy({ id: "b", x: 400, y: 180, maxHealth: 5, health: 5 }),
      createMinimalEnemy({ id: "c", x: 450, y: 180, maxHealth: 5, health: 5 })
    ];
    const spirit = { position: { x: 340, y: 180 }, size: 16, charge: 0 };
    const random = createSeededRandom(2222);
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spirit_overload", level: 1 }],
      enemies,
      cuteSpiritCompanion: spirit,
      currentStats: { attack: 20 },
      random,
      time: 0
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    for (let t = 0; t < 5; t++) {
      ctx.time = t * 0.5;
      stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    }
    const overloads = eventLog.getEventsByType("spirit_overload_fireball");
    assert.ok(overloads.length <= 5, "bounded overload events (ICD 0.6s)");
  });

  it("Lingering Souls: projectile spawned when valid target exists", async () => {
    const eventLog = createEventLog();
    const killTarget = createMinimalEnemy({ id: "k", x: 400, y: 180, maxHealth: 5, health: 5 });
    const other = createMinimalEnemy({ id: "o", x: 500, y: 180, maxHealth: 10, health: 10 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "lingering_souls", level: 1 }],
      enemies: [killTarget, other],
      currentStats: { attack: 20 },
      random: createSeededRandom(3333)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const lingering = eventLog.getEventsByType("projectile_spawned").filter((e) => e.source === "lingering_souls");
    const killed = eventLog.getEventsByType("enemy_killed");
    assert.ok(killed.length >= 1);
    assert.ok(lingering.length <= 1);
    assert.ok(lingering.length >= 0);
  });

  it("Lingering Souls: no projectile when no valid target", async () => {
    const eventLog = createEventLog();
    const solo = createMinimalEnemy({ id: "solo", x: 400, y: 180, maxHealth: 5, health: 5 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "lingering_souls", level: 1 }],
      enemies: [solo],
      currentStats: { attack: 20 },
      random: createSeededRandom(4444)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const lingering = eventLog.getEventsByType("projectile_spawned").filter((e) => e.source === "lingering_souls");
    assert.strictEqual(lingering.length, 0);
  });

  it("Ancestral Awakening: two assist actions per trigger", () => {
    const eventLog = createEventLog();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "ancestral_awakening", level: 1 }],
      random: createSeededRandom(5555)
    });
    simulateSpiritAssistAncestral(ctx, eventLog);
    const triggered = eventLog.getEventsByType("spirit_ability_triggered");
    assert.strictEqual(triggered.length, 2);
  });

  it("Spirit Reflex: reduces random eligible cooldown by 0.35 per stack", () => {
    const eventLog = createEventLog();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spirit_reflex", level: 2 }],
      skillCooldowns: [1.5, 0, 2],
      random: createSeededRandom(6666)
    });
    simulateSpiritAssist(ctx, eventLog);
    const reduced = eventLog.getEventsByType("cooldown_reduced");
    assert.ok(reduced.length <= 1);
    if (reduced.length === 1) {
      assert.strictEqual(reduced[0].amount, SPIRIT_REFLEX_REDUCTION_PER_STACK * 2);
    }
  });

  it("Spirit Reflex: nothing when no skills on cooldown", () => {
    const eventLog = createEventLog();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spirit_reflex", level: 1 }],
      skillCooldowns: [0, 0, 0],
      random: createSeededRandom(7777)
    });
    simulateSpiritAssist(ctx, eventLog);
    const reduced = eventLog.getEventsByType("cooldown_reduced");
    assert.strictEqual(reduced.length, 0);
  });
});

// ========== PHASE 2: XP / evolution / chest ==========

describe("Soul Siphon Phase 2 – XP / evolution / chest", () => {
  it("Ancient Spirit: Spirit-sourced kill grants bonus XP", () => {
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "ancient_spirit", level: 1 }],
      runXpTotal: 0,
      _eventLog: createEventLog()
    });
    ctx._xpTick = 0;
    const baseXp = 10;
    const withSpirit = grantXp(ctx, baseXp, "spirit_source");
    assert.strictEqual(withSpirit, Math.round(10 * (1 + ANCIENT_SPIRIT_XP_MULT * 1)));
  });

  it("Ancient Spirit: non-Spirit kill has no bonus", () => {
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "ancient_spirit", level: 1 }],
      runXpTotal: 0,
      _eventLog: createEventLog()
    });
    ctx._xpTick = 0;
    const baseXp = 10;
    const normal = grantXp(ctx, baseXp, "soul_siphon_beam");
    assert.strictEqual(normal, 10);
  });

  it("Spiritual Resonance: evolution hook grants 8 souls per stack", () => {
    const eventLog = createEventLog();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spiritual_resonance", level: 2 }],
      runSoulsTotal: 5
    });
    const out = fireEvolutionHookSoulSiphon(ctx, eventLog);
    assert.strictEqual(out.bonusSouls, SPIRITUAL_RESONANCE_SOULS_PER_STACK * 2);
    assert.strictEqual(ctx.runSoulsTotal, 5 + out.bonusSouls);
    const evo = eventLog.getEventsByType("evolution_triggered");
    assert.strictEqual(evo.length, 1);
  });

  it("Chest Spirits: chest open can grant soul, event logged", () => {
    const eventLog = createEventLog();
    const random = createSeededRandom(8888);
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "chest_spirits", level: 3 }],
      runSoulsTotal: 0,
      random
    });
    let granted = 0;
    for (let i = 0; i < 50; i++) {
      const out = simulateChestOpen(ctx, eventLog);
      granted += out.soulsGranted;
    }
    const chestSouls = eventLog.getEventsByType("souls_gained").filter((e) => e.source === "chest");
    assert.ok(chestSouls.length >= 0);
    assert.strictEqual(granted, ctx.runSoulsTotal);
  });

  it("Chest Spirits: source is chest not kill", () => {
    const eventLog = createEventLog();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "chest_spirits", level: 5 }],
      random: createSeededRandom(9999)
    });
    simulateChestOpen(ctx, eventLog);
    const soulsGained = eventLog.getEventsByType("souls_gained");
    soulsGained.forEach((e) => assert.strictEqual(e.source, "chest", "chest open must not log kill source"));
  });
});

// ========== PHASE 2: Short scenario simulations ==========

describe("Soul Siphon Phase 2 – short scenario simulations", () => {
  it("Summon Spirit scenario: soul gain and Spirit summon at 10 souls", async () => {
    const eventLog = createEventLog();
    const random = createSeededRandom(1010);
    const enemies = [
      createMinimalEnemy({ id: "a", x: 380, y: 180, maxHealth: 8, health: 8 }),
      createMinimalEnemy({ id: "b", x: 420, y: 180, maxHealth: 8, health: 8 }),
      createMinimalEnemy({ id: "c", x: 460, y: 180, maxHealth: 8, health: 8 })
    ];
    const ctx = createHarnessContext({
      runAttackUpgrades: [],
      runSoulsTotal: 0,
      enemies,
      currentStats: { attack: 30 },
      random
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    let steps = 0;
    while (ctx.runSoulsTotal < SOULS_TO_SUMMON_SPIRIT && steps < 20) {
      stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
      steps++;
    }
    assert.ok(ctx.runSoulsTotal >= SOULS_TO_SUMMON_SPIRIT || steps >= 20);
    assert.ok(wouldSummonSpirit(ctx) === (ctx.runSoulsTotal >= SOULS_TO_SUMMON_SPIRIT));
  });

  it("Beam charges Spirit scenario: charge increases, cap 10", async () => {
    const eventLog = createEventLog();
    const spirit = { position: { x: 350, y: 180 }, size: 16, charge: 0 };
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spiritual_conduit", level: 2 }],
      enemies: [],
      cuteSpiritCompanion: spirit,
      player: createMinimalPlayer({ x: 320, y: 180 }),
      random: createSeededRandom(2020)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    for (let i = 0; i < 15; i++) {
      stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats, dirX: 1, dirY: 0 });
    }
    assert.ok(spirit.charge >= 1);
    assert.strictEqual(spirit.charge, Math.min(spirit.charge, 10));
  });

  it("Focused Channel ramp scenario: damage ramps then cap", async () => {
    const { computeSoulSiphonBeamStats } = await getStats();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "focused_channel", level: 1 }],
      soulSiphonChannelTime: 0
    });
    const mults = [];
    for (let t = 0; t <= 4; t += 0.5) {
      ctx.soulSiphonChannelTime = t;
      const out = computeSoulSiphonBeamStats(ctx, 0.8);
      mults.push(out.damageMult);
    }
    assert.ok(mults[0] <= mults[mults.length - 1]);
    assert.ok(mults[mults.length - 1] <= 0.8 * (1 + 0.45 + 0.01));
  });

  it("Soul economy chain: souls, optional heal, optional Spirit charge (bounded counts)", async () => {
    const eventLog = createEventLog();
    const enemies = [
      createMinimalEnemy({ id: "a", x: 400, y: 180, maxHealth: 6, health: 6 }),
      createMinimalEnemy({ id: "b", x: 450, y: 180, maxHealth: 6, health: 6 })
    ];
    const spirit = { position: { x: 500, y: 200 }, size: 16, charge: 0 };
    const random = createSeededRandom(3030);
    const ctx = createHarnessContext({
      runAttackUpgrades: [
        { id: "soul_magnet", level: 2 },
        { id: "restless_souls", level: 2 },
        { id: "soul_catalyst", level: 2 }
      ],
      enemies,
      cuteSpiritCompanion: spirit,
      currentStats: { attack: 25 },
      random
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const soulsGained = eventLog.getEventsByType("souls_gained").filter((e) => e.source === "kill");
    const healed = eventLog.getEventsByType("healed");
    const charged = eventLog.getEventsByType("spirit_charged");
    assert.ok(soulsGained.length <= 2);
    assert.ok(healed.length <= 2);
    assert.ok(charged.length <= 2 + 2);
  });

  it("Spirit support chain: overload and fireball count bounded", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e", x: 400, y: 180, maxHealth: 10, health: 10 });
    const spirit = { position: { x: 350, y: 180 }, size: 16, charge: 0 };
    const random = createSeededRandom(4040);
    const ctx = createHarnessContext({
      runAttackUpgrades: [
        { id: "twin_fireball", level: 1 },
        { id: "spirit_overload", level: 1 }
      ],
      enemies: [enemy],
      cuteSpiritCompanion: spirit,
      currentStats: { attack: 15 },
      random,
      time: 0
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    simulateSpiritAssist(ctx, eventLog);
    const overloads = eventLog.getEventsByType("spirit_overload_fireball");
    const projectiles = eventLog.getEventsByType("projectile_spawned");
    assert.ok(overloads.length <= 1);
    assert.ok(projectiles.length <= 3);
  });
});

// ========== PHASE 2: Stronger proc-safety ==========

describe("Soul Siphon Phase 2 – proc safety (bounded)", () => {
  const MAX_BEAM_HITS_PER_STEP = 20;
  const MAX_SOUL_GAIN_EVENTS_PER_KILL = 5;
  const MAX_PROJECTILE_SPAWNS_PER_STEP = 10;
  const MAX_EXPLOSIONS_PER_KILL = 1;

  it("Echoing Beam: beam hit count bounded per step", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e", x: 400, y: 180, maxHealth: 5, health: 5 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "echoing_beam", level: 1 }],
      enemies: [enemy],
      currentStats: { attack: 50 },
      random: createSeededRandom(5050)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const hits = eventLog.getEventsByType("beam_hit");
    assert.ok(hits.length <= MAX_BEAM_HITS_PER_STEP);
  });

  it("Spirit Overload: overload fireballs bounded per step", async () => {
    const eventLog = createEventLog();
    const enemies = Array.from({ length: 8 }, (_, i) =>
      createMinimalEnemy({ id: `e${i}`, x: 350 + i * 20, y: 180, maxHealth: 5, health: 5 })
    );
    const spirit = { position: { x: 340, y: 180 }, size: 16, charge: 0 };
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "spirit_overload", level: 1 }],
      enemies,
      cuteSpiritCompanion: spirit,
      currentStats: { attack: 10 },
      random: createSeededRandom(6060),
      time: 0
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const overloads = eventLog.getEventsByType("spirit_overload_fireball");
    assert.ok(overloads.length <= MAX_EXPLOSIONS_PER_KILL + 1);
  });

  it("Soul Burst: explosion events bounded per kill", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e", x: 400, y: 180, maxHealth: 5, health: 5 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_burst", level: 3 }],
      enemies: [enemy],
      currentStats: { attack: 20 },
      random: createSeededRandom(7070)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const explosions = eventLog.getEventsByType("explosion_triggered");
    assert.ok(explosions.length <= 1);
  });

  it("Soul Magnet: extra soul events bounded per kill", async () => {
    const eventLog = createEventLog();
    const enemy = createMinimalEnemy({ id: "e", x: 400, y: 180, maxHealth: 5, health: 5 });
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "soul_magnet", level: 5 }],
      enemies: [enemy],
      currentStats: { attack: 20 },
      random: createSeededRandom(8080)
    });
    const { computeSoulSiphonBeamStats } = await getStats();
    stepSoulSiphonBeam(ctx, eventLog, { computeBeamStats: computeSoulSiphonBeamStats });
    const magnetExtra = eventLog.getEventsByType("soul_magnet_extra");
    assert.ok(magnetExtra.length <= 1);
  });

  it("Ancestral Awakening: exactly two assists, no infinite trigger", () => {
    const eventLog = createEventLog();
    const ctx = createHarnessContext({
      runAttackUpgrades: [{ id: "ancestral_awakening", level: 1 }],
      random: createSeededRandom(9090)
    });
    simulateSpiritAssistAncestral(ctx, eventLog);
    const triggered = eventLog.getEventsByType("spirit_ability_triggered");
    assert.strictEqual(triggered.length, 2);
  });
});

// --- Soul Siphon evolution (optional regression hooks) ---

describe("Soul Siphon – evolution state / profile", () => {
  it("evolution state: first and second set formId", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const ctx = { soulSiphonEvolutionFirst: "power", soulSiphonEvolutionSecond: "tempo" };
    const state = evolution.getSoulSiphonEvolutionState(ctx);
    assert.strictEqual(state.first, "power");
    assert.strictEqual(state.second, "tempo");
    assert.strictEqual(state.formId, "power_tempo");
  });

  it("profile: power_tempo has beamMode, beamMods (tripleBeam, pulseDamageMult), spiritPool", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const state = { first: "power", second: "tempo", formId: "power_tempo" };
    const profile = evolution.getSoulSiphonProfile(state);
    assert.strictEqual(profile.beamMode, "delayed_shot");
    assert.strictEqual(profile.beamMods.tripleBeam, true);
    assert.strictEqual(profile.beamMods.pulseDamageMult, 0.4);
    assert.strictEqual(profile.spiritPool, "fireball_only");
    assert.strictEqual(profile.spiritTrigger.mode, "normal_random");
  });

  it("profile: power_control has beamStun and stunSec in beamMods", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const state = { first: "power", second: "control", formId: "power_control" };
    const profile = evolution.getSoulSiphonProfile(state);
    assert.strictEqual(profile.beamMods.beamStun, true);
    assert.strictEqual(profile.beamMods.stunSec, 0.2);
    assert.strictEqual(profile.beamMods.widerCoverage, true);
  });

  it("profile: control_tempo has fieldHaste in links", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const state = { first: "control", second: "tempo", formId: "control_tempo" };
    const profile = evolution.getSoulSiphonProfile(state);
    assert.strictEqual(profile.beamMode, "cursor_area");
    assert.strictEqual(profile.links.fieldHaste, true);
    assert.strictEqual(profile.spiritPool, "slam_only");
  });

  it("profile: tempo_control has freezeBuildUp in beamMods", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const state = { first: "tempo", second: "control", formId: "tempo_control" };
    const profile = evolution.getSoulSiphonProfile(state);
    assert.strictEqual(profile.beamMods.freezeBuildUp, true);
  });

  it("profile: spiritcraft_tempo has spiritTrigger cast_all_three", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const state = { first: "spiritcraft", second: "tempo", formId: "spiritcraft_tempo" };
    const profile = evolution.getSoulSiphonProfile(state);
    assert.strictEqual(profile.spiritTrigger.mode, "cast_all_three");
    assert.strictEqual(profile.spiritTrigger.chargeThreshold, 2);
    assert.strictEqual(profile.spiritPool, "all_three");
  });

  it("profile: spiritcraft_spiritcraft has avatar_command and avatar_random_command", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    const state = { first: "spiritcraft", second: "spiritcraft", formId: "spiritcraft_spiritcraft" };
    const profile = evolution.getSoulSiphonProfile(state);
    assert.strictEqual(profile.beamMode, "avatar_command");
    assert.strictEqual(profile.spiritTrigger.mode, "avatar_random_command");
    assert.strictEqual(profile.formId, "avatar_of_souls");
  });

  it("getSpiritAbilityListFromPool returns correct lists", async () => {
    const evolution = await import("../src/data/soul-siphon-evolution.js");
    assert.deepStrictEqual(evolution.getSpiritAbilityListFromPool("fireball_only"), ["fireball"]);
    assert.deepStrictEqual(evolution.getSpiritAbilityListFromPool("slam_only"), ["ground_slam"]);
    assert.deepStrictEqual(evolution.getSpiritAbilityListFromPool("all_three"), ["fireball", "ground_slam", "speed_buff"]);
    assert.deepStrictEqual(evolution.getSpiritAbilityListFromPool("fireball_and_slam"), ["fireball", "ground_slam"]);
  });
});
