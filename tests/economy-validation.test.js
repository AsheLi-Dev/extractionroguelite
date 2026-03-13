"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  createQuestState,
  startRun,
  onEliteKill,
  onChestOpen,
  onBossFightStart,
  onFinalBossKill,
  onPlayerHit,
  onDash,
  onExtraction,
} = require("./quest-simulator.js");

// Deterministic PRNG (mulberry32) for fast reproducible simulations.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeQuestDefsForEconomy() {
  return [
    { id: "q_elites_20", scope: "run", kind: "counter", event: "eliteKill", target: 20, reward: { orange: 1, green: 0, red: 0, yellow: 0 } },
    { id: "q_chests_15", scope: "run", kind: "counter", event: "chestOpen", target: 15, reward: { orange: 0, green: 1, red: 0, yellow: 0 } },
    { id: "q_dashless_boss", scope: "boss", kind: "condition", event: "finalBossKill", requires: { bossFightNoDash: true }, reward: { orange: 0, green: 0, red: 0, yellow: 1 } },
    { id: "q_flawless_boss", scope: "boss", kind: "condition", event: "finalBossKill", requires: { bossFightNoHit: true }, reward: { orange: 0, green: 0, red: 1, yellow: 0 } },
  ];
}

describe("Economy validation (1000 deterministic mock runs)", () => {
  it("crystals/xp/quest completion averages stay within reasonable ranges", () => {
    const RUNS = 1000;
    const rng = mulberry32(0xC0FFEE);
    const questDefs = makeQuestDefsForEconomy();

    let totalXp = 0;
    let totalCrystals = 0;
    let totalQuestsCompleted = 0;

    for (let i = 0; i < RUNS; i++) {
      // Economy validation is per-run: use a fresh character quest state each run.
      const state = createQuestState({ questDefs, persistentProgress: {}, persistentStreaks: { extractionStreak: 0 }, runIndex: i });
      startRun(state);

      // Simulate XP as a simple function of events.
      // This is a validation harness only: we just want stable, non-zero outputs.
      let xp = 0;

      // Randomized but deterministic per run.
      const elites = 8 + Math.floor(rng() * 20); // 8..27
      const chests = 3 + Math.floor(rng() * 20); // 3..22
      const bossFightHappened = rng() < 0.9;

      for (let e = 0; e < elites; e++) {
        onEliteKill(state);
        xp += 2;
      }
      for (let c = 0; c < chests; c++) {
        onChestOpen(state);
        xp += 1;
      }

      if (bossFightHappened) {
        onBossFightStart(state);
        // In boss fight: sometimes dash/hit (affects boss condition quests)
        if (rng() < 0.35) onDash(state);
        if (rng() < 0.25) onPlayerHit(state);
        onFinalBossKill(state);
        xp += 25;
      }

      const out = onExtraction(state);
      const crystalsThisRun =
        out.crystalsEarnedThisRun.orange +
        out.crystalsEarnedThisRun.green +
        out.crystalsEarnedThisRun.red +
        out.crystalsEarnedThisRun.yellow;

      totalXp += xp;
      totalCrystals += crystalsThisRun;
      totalQuestsCompleted += state.questCompletionsThisRun.length;
    }

    const avgXp = totalXp / RUNS;
    const avgCrystals = totalCrystals / RUNS;
    const avgQuests = totalQuestsCompleted / RUNS;

    // Sanity assertions: non-zero and not wildly high.
    assert.ok(avgXp > 5, `avgXp too low: ${avgXp}`);
    assert.ok(avgXp < 200, `avgXp too high: ${avgXp}`);

    assert.ok(avgCrystals > 0, `avgCrystals should not be zero: ${avgCrystals}`);
    assert.ok(avgCrystals < 10, `avgCrystals excessively high: ${avgCrystals}`);

    assert.ok(avgQuests > 0.05, `avgQuests too low: ${avgQuests}`);
    assert.ok(avgQuests < 4, `avgQuests too high: ${avgQuests}`);
  });
});

