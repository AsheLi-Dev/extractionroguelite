"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  loadTalentCatalogFromSource,
  summarizeCatalog,
  simulateProgression,
} = require("./progression-simulator.js");

describe("Progression simulator integrity", () => {
  it("parses the real talent catalog with expected branch counts", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const catalog = loadTalentCatalogFromSource(repoRoot);
    const summary = summarizeCatalog(catalog);

    // Current data: 4 branches * 16 talents = 64.
    assert.strictEqual(summary.total, 64);
    assert.strictEqual(summary.byBranch.Brutality, 16);
    assert.strictEqual(summary.byBranch.Agility, 16);
    assert.strictEqual(summary.byBranch.Vitality, 16);
    assert.strictEqual(summary.byBranch.Luck, 16);

    // Cost buckets should exist for whatever is in real data.
    assert.ok(summary.byCost[1] > 0);
  });

  it("spending respects cost-2 and cost-3 talents (synthetic catalog)", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const synthetic = [
      { id: "b1", name: "B1", branch: "Brutality", crystal: "orange", cost: 1 },
      { id: "b2", name: "B2", branch: "Brutality", crystal: "orange", cost: 2 },
      { id: "b3", name: "B3", branch: "Brutality", crystal: "orange", cost: 3 },
    ];

    const report = simulateProgression({
      repoRoot,
      seed: 1,
      singleRuns: 10,
      lifetimes: 5,
      runsPerLifetimeMin: 5,
      runsPerLifetimeMax: 5,
      extractionSuccessRate: 1,
      bossFightRate: 0,
      questDefs: [],
      talentCatalog: synthetic,
      requireAllBranches: false,
      baseCrystalsPerExtraction: { orange: 3, green: 0, red: 0, yellow: 0 },
      strategies: ["keystoneFocused"],
    });

    const r = report.keystoneFocused;
    // With 5 runs * 3 orange = 15 orange per lifetime, it should buy all 3 talents (total cost 6) easily.
    const lifetimes = r.lifetimeAgg.lifetimes;
    assert.strictEqual(lifetimes, 5);
    assert.strictEqual(r.lifetimeAgg.purchasedCountsByCost[1] + r.lifetimeAgg.purchasedCountsByCost[2] + r.lifetimeAgg.purchasedCountsByCost[3], 15);
    assert.strictEqual(r.lifetimeAgg.purchasedCountsByCost[2], 5);
    assert.strictEqual(r.lifetimeAgg.purchasedCountsByCost[3], 5);
  });

  it("milestone averages do not go backwards for talents when sample sizes exist", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const report = simulateProgression({
      repoRoot,
      seed: 999,
      singleRuns: 0,
      lifetimes: 50,
      runsPerLifetimeMin: 30,
      runsPerLifetimeMax: 30,
      extractionSuccessRate: 1,
      bossFightRate: 0,
      questDefs: [],
      baseCrystalsPerExtraction: { orange: 1, green: 1, red: 1, yellow: 1 },
      strategies: ["balanced"],
    });

    const ms = report.balanced.lifetimeAgg.milestones;
    const avg = (k) => {
      const b = ms[String(k)];
      const n = Number(b?.samples) || 0;
      if (n <= 0) return null;
      return (Number(b.talentsSum) || 0) / n;
    };
    const a5 = avg(5);
    const a10 = avg(10);
    const a15 = avg(15);
    const a20 = avg(20);
    if (a5 != null && a10 != null) assert.ok(a10 >= a5);
    if (a10 != null && a15 != null) assert.ok(a15 >= a10);
    if (a15 != null && a20 != null) assert.ok(a20 >= a15);
  });
});

