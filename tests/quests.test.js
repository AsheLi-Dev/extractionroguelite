"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  createQuestState,
  startRun,
  onEnemyKill,
  onEliteKill,
  onFinalBossKill,
  onDash,
  onPlayerHit,
  onChestOpen,
  onBiomeStart,
  onBiomeClear,
  onBossFightStart,
  onExtraction,
  onDeath,
  getQuestProgress,
  getPersistentSnapshot,
} = require("./quest-simulator.js");

function makeQuestDefs() {
  return [
    {
      id: "q_kill_50_elites",
      name: "Kill 50 elites",
      scope: "lifetime",
      kind: "counter",
      event: "eliteKill",
      target: 50,
      reward: { orange: 3, green: 0, red: 0, yellow: 0 },
    },
    {
      id: "q_open_30_chests",
      name: "Open 30 chests",
      scope: "lifetime",
      kind: "counter",
      event: "chestOpen",
      target: 30,
      reward: { orange: 0, green: 3, red: 0, yellow: 0 },
    },
    {
      id: "q_extract_5_streak",
      name: "Extract 5 times in a row",
      scope: "streak",
      kind: "counter",
      event: "extractionStreak",
      target: 5,
      reward: { orange: 0, green: 0, red: 3, yellow: 0 },
    },
    {
      id: "q_dashless_boss",
      name: "Defeat the boss without dashing",
      scope: "boss",
      kind: "condition",
      event: "finalBossKill",
      target: null,
      requires: { bossFightNoDash: true },
      reward: { orange: 0, green: 0, red: 0, yellow: 5 },
    },
    {
      id: "q_flawless_boss",
      name: "Defeat the boss without being hit",
      scope: "boss",
      kind: "condition",
      event: "finalBossKill",
      target: null,
      requires: { bossFightNoHit: true },
      reward: { orange: 0, green: 0, red: 0, yellow: 2 },
    },
    {
      id: "q_biome_chests_5",
      name: "Open 5 chests in a biome",
      scope: "biome",
      kind: "counter",
      event: "chestOpen",
      target: 5,
      reward: { orange: 1, green: 1, red: 0, yellow: 0 },
    },
    {
      id: "q_chest_streak_10_no_hit",
      name: "Open 10 chests without being hit",
      scope: "chestStreak",
      kind: "counter",
      event: "chestStreak",
      target: 10,
      reward: { orange: 0, green: 0, red: 1, yellow: 1 },
    },
  ];
}

describe("Quest trigger tests", () => {
  it('killing 50 elites completes the "Kill 50 elites" quest', () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    for (let i = 0; i < 50; i++) onEliteKill(state);
    const q = getQuestProgress(state, "q_kill_50_elites");
    assert.strictEqual(q.completed, true);
    assert.ok(state.questCompletionsThisRun.includes("q_kill_50_elites"));
  });

  it("opening 30 chests completes the chest quest", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    for (let i = 0; i < 30; i++) onChestOpen(state);
    const q = getQuestProgress(state, "q_open_30_chests");
    assert.strictEqual(q.completed, true);
  });
});

describe("Quest non-trigger tests", () => {
  it("killing non-elites does not progress elite quests", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    for (let i = 0; i < 20; i++) onEnemyKill(state, "basic");
    const q = getQuestProgress(state, "q_kill_50_elites");
    assert.strictEqual(q.progress, 0);
    assert.strictEqual(q.completed, false);
  });
});

describe("Streak quest tests", () => {
  it("extracting 5 times in a row completes the streak quest", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    for (let i = 0; i < 5; i++) {
      startRun(state);
      onExtraction(state);
    }
    const q = getQuestProgress(state, "q_extract_5_streak");
    assert.strictEqual(q.completed, true);
    assert.strictEqual(q.progress, 5);
  });

  it("failing one run resets the streak", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    for (let i = 0; i < 3; i++) {
      startRun(state);
      onExtraction(state);
    }
    startRun(state);
    onDeath(state);
    startRun(state);
    onExtraction(state);
    const q = getQuestProgress(state, "q_extract_5_streak");
    assert.strictEqual(q.progress, 1);
    assert.strictEqual(q.completed, false);
  });
});

describe("Boss condition tests", () => {
  it("defeating the boss without dash completes the dashless quest", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    onBossFightStart(state);
    onFinalBossKill(state);
    const q = getQuestProgress(state, "q_dashless_boss");
    assert.strictEqual(q.completed, true);
  });

  it("getting hit during the boss fight prevents flawless completion", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    onBossFightStart(state);
    onPlayerHit(state);
    onFinalBossKill(state);
    const q = getQuestProgress(state, "q_flawless_boss");
    assert.strictEqual(q.completed, false);
  });
});

describe("Progress reset tests", () => {
  it("biome-specific quests reset after leaving the biome", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    onBiomeStart(state);
    for (let i = 0; i < 3; i++) onChestOpen(state);
    const q = getQuestProgress(state, "q_biome_chests_5");
    assert.strictEqual(q.progress, 3);
    onBiomeClear(state);
    assert.strictEqual(q.progress, 0);
    assert.strictEqual(q.completed, false);
  });

  it("chest streak resets when the player is hit", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    for (let i = 0; i < 6; i++) onChestOpen(state);
    onPlayerHit(state);
    for (let i = 0; i < 4; i++) onChestOpen(state);
    const q = getQuestProgress(state, "q_chest_streak_10_no_hit");
    assert.strictEqual(q.completed, false);
    assert.strictEqual(q.progress, 4);
  });
});

describe("Reward tests", () => {
  it("quest completion grants the correct crystal colors and quantities", () => {
    const questDefs = makeQuestDefs().filter((q) => q.id === "q_kill_50_elites" || q.id === "q_open_30_chests");
    const state = createQuestState({ questDefs });
    startRun(state);
    for (let i = 0; i < 50; i++) onEliteKill(state);
    for (let i = 0; i < 30; i++) onChestOpen(state);
    const earned = state.crystalsEarnedThisRun;
    assert.deepStrictEqual(earned, { orange: 3, green: 3, red: 0, yellow: 0 });
  });

  it("persistent snapshot includes lifetime quest progress and streaks", () => {
    const state = createQuestState({ questDefs: makeQuestDefs() });
    startRun(state);
    for (let i = 0; i < 10; i++) onEliteKill(state);
    onExtraction(state);
    const snap = getPersistentSnapshot(state);
    assert.ok(snap.persistentProgress.q_kill_50_elites);
    assert.strictEqual(snap.persistentProgress.q_kill_50_elites.progress, 10);
    assert.strictEqual(snap.persistentStreaks.extractionStreak, 1);
  });

  it("quests are one-time per character: completed boss quest does not re-award next run when persisted", () => {
    const questDefs = makeQuestDefs().filter((q) => q.id === "q_dashless_boss");
    const state1 = createQuestState({ questDefs });
    startRun(state1);
    onBossFightStart(state1);
    onFinalBossKill(state1);
    assert.strictEqual(getQuestProgress(state1, "q_dashless_boss").completed, true);
    const crystals1 = { ...state1.crystalsEarnedThisRun };

    const snap = getPersistentSnapshot(state1);
    const state2 = createQuestState({ questDefs, persistentProgress: snap.persistentProgress, persistentStreaks: snap.persistentStreaks });
    startRun(state2);
    onBossFightStart(state2);
    onFinalBossKill(state2);
    assert.strictEqual(getQuestProgress(state2, "q_dashless_boss").completed, true);
    // No additional reward should be granted on second completion attempt.
    assert.deepStrictEqual(state2.crystalsEarnedThisRun, { orange: 0, green: 0, red: 0, yellow: 0 });
    assert.ok(crystals1.yellow > 0);
  });
});

