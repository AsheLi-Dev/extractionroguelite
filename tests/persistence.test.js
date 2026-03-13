"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { createQuestState, startRun: startQuestRun, onEliteKill, onChestOpen, onExtraction: questExtraction, onDeath: questDeath, getPersistentSnapshot } = require("./quest-simulator.js");
const { vaultMasterSecure, onDeath: talentDeath } = require("./talent-simulator.js");

function makeQuestDefs() {
  return [
    { id: "q_kill_10_elites", scope: "lifetime", kind: "counter", event: "eliteKill", target: 10, reward: { orange: 1, green: 0, red: 0, yellow: 0 } },
    { id: "q_open_10_chests", scope: "lifetime", kind: "counter", event: "chestOpen", target: 10, reward: { orange: 0, green: 1, red: 0, yellow: 0 } },
    { id: "q_extract_3_streak", scope: "streak", kind: "counter", event: "extractionStreak", target: 3, reward: { orange: 0, green: 0, red: 1, yellow: 0 } },
  ];
}

// Minimal in-memory save store (no localStorage dependency).
function createSaveStore() {
  return {
    raw: null,
    save(obj) {
      this.raw = JSON.parse(JSON.stringify(obj));
    },
    load() {
      return this.raw ? JSON.parse(JSON.stringify(this.raw)) : null;
    },
  };
}

function createCharacter(overrides = {}) {
  return {
    id: overrides.id || "char_1",
    level: overrides.level ?? 1,
    xp: overrides.xp ?? 0,
    crystals: { orange: 0, green: 0, red: 0, yellow: 0, ...(overrides.crystals || {}) },
    talents: Array.isArray(overrides.talents) ? [...overrides.talents] : [],
    questProgress: overrides.questProgress || {},
    questStreaks: overrides.questStreaks || { extractionStreak: 0 },
    vault: {
      securedItemIds: Array.isArray(overrides.vault?.securedItemIds) ? [...overrides.vault.securedItemIds] : [],
      items: Array.isArray(overrides.vault?.items) ? [...overrides.vault.items] : [],
    },
  };
}

function startRun(char, opts = {}) {
  const run = {
    xpGained: 0,
    // Quest runtime state is per run but seeded with persistent progress/streaks.
    quest: createQuestState({
      questDefs: makeQuestDefs(),
      persistentProgress: char.questProgress,
      persistentStreaks: char.questStreaks,
      runIndex: opts.runIndex ?? 0,
    }),
    // Talent death transfer sim uses the talent-simulator Vault Master helpers.
    talentState: {
      characterTalents: [...(char.talents || [])],
      vaultMasterSecuredIds: new Set(char.vault.securedItemIds || []),
      events: [],
      time: 0,
    },
  };
  startQuestRun(run.quest);
  return run;
}

function extract(char, run) {
  // Apply XP and quest rewards on extraction.
  char.xp += run.xpGained;
  const r = questExtraction(run.quest);
  char.crystals.orange += r.crystalsEarnedThisRun.orange;
  char.crystals.green += r.crystalsEarnedThisRun.green;
  char.crystals.red += r.crystalsEarnedThisRun.red;
  char.crystals.yellow += r.crystalsEarnedThisRun.yellow;

  const snap = getPersistentSnapshot(run.quest);
  char.questProgress = snap.persistentProgress;
  char.questStreaks = snap.persistentStreaks;
  return char;
}

function die(char, run) {
  // Death: XP and quest rewards are not saved; streak resets.
  questDeath(run.quest);
  const snap = getPersistentSnapshot(run.quest);
  char.questProgress = snap.persistentProgress;
  char.questStreaks = snap.persistentStreaks;

  // Vault master secured items persist through death if talent active.
  talentDeath(run.talentState);
  char.vault.securedItemIds = [...(run.talentState.vaultMasterSecuredIds || new Set())];
  return char;
}

function saveCharacter(store, char) {
  store.save(char);
}

function loadCharacter(store) {
  return store.load();
}

describe("Character persistence across runs", () => {
  it("XP gained during run is saved after extraction", () => {
    const store = createSaveStore();
    const char = createCharacter({ xp: 10 });
    const run = startRun(char);
    run.xpGained = 42;
    extract(char, run);
    saveCharacter(store, char);
    const loaded = loadCharacter(store);
    assert.strictEqual(loaded.xp, 52);
  });

  it("crystals gained from quests are saved on extraction", () => {
    const store = createSaveStore();
    const char = createCharacter();
    const run = startRun(char);
    for (let i = 0; i < 10; i++) onEliteKill(run.quest);
    for (let i = 0; i < 10; i++) onChestOpen(run.quest);
    extract(char, run);
    saveCharacter(store, char);
    const loaded = loadCharacter(store);
    assert.deepStrictEqual(loaded.crystals, { orange: 1, green: 1, red: 0, yellow: 0 });
  });

  it("run progress is not saved on death (XP and run-earned crystals stay unchanged)", () => {
    const store = createSaveStore();
    const char = createCharacter({ xp: 10, crystals: { orange: 2, green: 0, red: 0, yellow: 0 } });
    const run = startRun(char);
    run.xpGained = 99;
    for (let i = 0; i < 10; i++) onEliteKill(run.quest); // would earn orange on extraction
    die(char, run);
    saveCharacter(store, char);
    const loaded = loadCharacter(store);
    assert.strictEqual(loaded.xp, 10);
    assert.deepStrictEqual(loaded.crystals, { orange: 2, green: 0, red: 0, yellow: 0 });
  });

  it("vault items persist correctly on death if Vault Master is active", () => {
    const store = createSaveStore();
    const char = createCharacter({ talents: ["vaultMaster"], vault: { securedItemIds: [], items: [{ id: "sword1" }] } });
    const run = startRun(char);
    // Secure an item id during run.
    vaultMasterSecure(run.talentState, "sword1");
    die(char, run);
    saveCharacter(store, char);
    const loaded = loadCharacter(store);
    assert.ok(loaded.vault.securedItemIds.includes("sword1"));
  });

  it("character loaded from save retains talents, crystals, and quest progress", () => {
    const store = createSaveStore();
    const char = createCharacter({ talents: ["rapid", "vaultMaster"], crystals: { orange: 1 } });
    const run = startRun(char);
    for (let i = 0; i < 3; i++) onEliteKill(run.quest);
    extract(char, run);
    saveCharacter(store, char);
    const loaded = loadCharacter(store);
    assert.deepStrictEqual(loaded.talents, ["rapid", "vaultMaster"]);
    assert.strictEqual(loaded.crystals.orange >= 1, true);
    assert.ok(loaded.questProgress.q_kill_10_elites);
    assert.strictEqual(loaded.questProgress.q_kill_10_elites.progress, 3);
  });

  it("saving and loading multiple times does not duplicate crystals or items", () => {
    const store = createSaveStore();
    const char = createCharacter({ crystals: { orange: 5 }, vault: { securedItemIds: ["a"], items: [{ id: "a" }] } });
    saveCharacter(store, char);
    const loaded1 = loadCharacter(store);
    saveCharacter(store, loaded1);
    const loaded2 = loadCharacter(store);
    assert.strictEqual(loaded2.crystals.orange, 5);
    assert.deepStrictEqual(loaded2.vault.securedItemIds, ["a"]);
    assert.deepStrictEqual(loaded2.vault.items, [{ id: "a" }]);
  });
});

