/**
 * Quest simulation harness for automated tests.
 * Deterministic, lightweight, independent from browser/game engine code.
 *
 * The quest system is intentionally data-driven so new quests can be added
 * without much boilerplate in tests.
 */

const DEFAULT_CRYSTALS = Object.freeze({ orange: 0, green: 0, red: 0, yellow: 0 });

function cloneCrystals(c) {
  return {
    orange: Math.max(0, Number(c?.orange) || 0),
    green: Math.max(0, Number(c?.green) || 0),
    red: Math.max(0, Number(c?.red) || 0),
    yellow: Math.max(0, Number(c?.yellow) || 0),
  };
}

function addCrystals(a, b) {
  const out = cloneCrystals(a);
  const add = cloneCrystals(b);
  out.orange += add.orange;
  out.green += add.green;
  out.red += add.red;
  out.yellow += add.yellow;
  return out;
}

function createQuestProgressEntry(def) {
  return {
    id: def.id,
    progress: 0,
    completed: false,
    claimed: false,
    completedAtRunIndex: null,
  };
}

function normalizeQuestDefs(defs) {
  const out = [];
  const seen = new Set();
  for (const raw of defs || []) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: String(raw.name || id),
      // scope: lifetime | run | streak | boss | biome | chestStreak
      scope: String(raw.scope || "lifetime"),
      kind: String(raw.kind || "counter"), // counter | condition
      target: raw.target == null ? null : Number(raw.target),
      event: String(raw.event || ""), // e.g. eliteKill, chestOpen, goldPickup, extraction
      reward: cloneCrystals(raw.reward || DEFAULT_CRYSTALS),
      // Optional filters/conditions.
      enemyType: raw.enemyType ? String(raw.enemyType) : null,
      requires: raw.requires && typeof raw.requires === "object" ? { ...raw.requires } : null,
    });
  }
  return out;
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
  state.events.push({ name, runIndex: state.runIndex, ...payload });
}

/**
 * Create quest simulation state.
 * @param {object} opts
 * @param {Array<object>} opts.questDefs
 * @param {object} opts.persistentProgress - saved quest progress map (id -> entry-like)
 * @param {object} opts.persistentStreaks - saved streaks (e.g. extractionStreak)
 * @param {object} opts.randomSequence
 */
function createQuestState(opts = {}) {
  const questDefs = normalizeQuestDefs(opts.questDefs || []);

  const progressById = Object.create(null);
  for (const def of questDefs) {
    progressById[def.id] = createQuestProgressEntry(def);
  }

  // Hydrate persistent quest progress (per-character persistence).
  const persisted = opts.persistentProgress && typeof opts.persistentProgress === "object" ? opts.persistentProgress : null;
  if (persisted) {
    for (const def of questDefs) {
      const prev = persisted[def.id];
      if (!prev || typeof prev !== "object") continue;
      progressById[def.id].progress = Math.max(0, Number(prev.progress) || 0);
      progressById[def.id].completed = prev.completed === true;
      progressById[def.id].claimed = prev.claimed === true;
      progressById[def.id].completedAtRunIndex = prev.completedAtRunIndex ?? null;
    }
  }

  return {
    questDefs,
    progressById,
    runIndex: Number(opts.runIndex) || 0,

    // Deterministic RNG hooks (shared convention with talent simulator helpers)
    _nextRandom: undefined,
    _randomSequence: opts.randomSequence || null,

    // Run-scoped counters/flags
    run: {
      enemyKills: 0,
      eliteKills: 0,
      miniBossKills: 0,
      finalBossKills: 0,
      dashes: 0,
      playerHitsTaken: 0,
      chestsOpened: 0,
      goldPickedUp: 0,
      healedAmount: 0,
      biomeIndex: 0,
      biomeActive: false,
      bossFightActive: false,
      bossFightDashes: 0,
      bossFightHitTaken: false,
      chestStreak: 0,
      extracted: false,
      died: false,
    },

    // Persistent streaks (across runs)
    streaks: {
      extractionStreak: Math.max(0, Number(opts.persistentStreaks?.extractionStreak) || 0),
    },

    // Rewards earned during the current run
    crystalsEarnedThisRun: cloneCrystals(DEFAULT_CRYSTALS),
    questCompletionsThisRun: [],

    events: [],
  };
}

function getQuestProgress(state, questId) {
  return state.progressById[String(questId || "")] || null;
}

function isCompleted(entry) {
  return !!entry?.completed;
}

function shouldCountForDef(def, payload) {
  if (!def) return false;
  if (def.enemyType && payload?.enemyType && String(payload.enemyType) !== def.enemyType) return false;
  return true;
}

function checkRequires(state, def) {
  if (!def.requires) return true;
  const req = def.requires;
  // Boss fight conditions
  if (req.bossFightNoDash === true && state.run.bossFightDashes > 0) return false;
  if (req.bossFightNoHit === true && state.run.bossFightHitTaken) return false;
  return true;
}

function completeQuest(state, def, entry) {
  if (!def || !entry || entry.completed) return false;
  entry.completed = true;
  entry.completedAtRunIndex = state.runIndex;
  state.crystalsEarnedThisRun = addCrystals(state.crystalsEarnedThisRun, def.reward);
  state.questCompletionsThisRun.push(def.id);
  emit(state, "questCompleted", { questId: def.id, reward: { ...def.reward } });
  return true;
}

function incrementQuestCounter(state, def, amount = 1, payload = {}) {
  const entry = getQuestProgress(state, def.id);
  if (!entry || entry.completed) return;
  if (!shouldCountForDef(def, payload)) return;

  entry.progress += Math.max(0, Number(amount) || 0);
  emit(state, "questProgress", { questId: def.id, progress: entry.progress });
  if (def.target != null && entry.progress >= def.target && checkRequires(state, def)) {
    completeQuest(state, def, entry);
  }
}

function resetRunScopedProgress(state, scope) {
  for (const def of state.questDefs) {
    if (def.scope !== scope) continue;
    const entry = getQuestProgress(state, def.id);
    if (!entry) continue;
    entry.progress = 0;
    // Completion is persistent per-character; do not clear completed/claimed here.
  }
}

function startRun(state) {
  state.runIndex += 1;
  state.run = {
    enemyKills: 0,
    eliteKills: 0,
    miniBossKills: 0,
    finalBossKills: 0,
    dashes: 0,
    playerHitsTaken: 0,
    chestsOpened: 0,
    goldPickedUp: 0,
    healedAmount: 0,
    biomeIndex: 0,
    biomeActive: false,
    bossFightActive: false,
    bossFightDashes: 0,
    bossFightHitTaken: false,
    chestStreak: 0,
    extracted: false,
    died: false,
  };
  state.crystalsEarnedThisRun = cloneCrystals(DEFAULT_CRYSTALS);
  state.questCompletionsThisRun = [];

  // Reset progress counters for run-scoped quests (but keep completion persistent).
  resetRunScopedProgress(state, "run");
  resetRunScopedProgress(state, "boss");
  resetRunScopedProgress(state, "biome");
  resetRunScopedProgress(state, "chestStreak");

  emit(state, "startRun", {});
  return state;
}

// --- Events ---

function onEnemyKill(state, enemyType) {
  state.run.enemyKills += 1;
  emit(state, "onEnemyKill", { enemyType: enemyType ? String(enemyType) : null });
  for (const def of state.questDefs) {
    if (def.event !== "enemyKill") continue;
    incrementQuestCounter(state, def, 1, { enemyType });
  }
}

function onEliteKill(state) {
  state.run.eliteKills += 1;
  emit(state, "onEliteKill", {});
  for (const def of state.questDefs) {
    if (def.event !== "eliteKill") continue;
    incrementQuestCounter(state, def, 1, {});
  }
}

function onMiniBossKill(state) {
  state.run.miniBossKills += 1;
  emit(state, "onMiniBossKill", {});
  for (const def of state.questDefs) {
    if (def.event !== "miniBossKill") continue;
    incrementQuestCounter(state, def, 1, {});
  }
}

function onFinalBossKill(state) {
  state.run.finalBossKills += 1;
  emit(state, "onFinalBossKill", {});
  for (const def of state.questDefs) {
    if (def.event !== "finalBossKill") continue;
    incrementQuestCounter(state, def, 1, {});
  }
  // Boss fight condition quests typically complete when boss dies.
  for (const def of state.questDefs) {
    if (def.scope !== "boss") continue;
    const entry = getQuestProgress(state, def.id);
    if (!entry || entry.completed) continue;
    if (def.kind === "condition" && checkRequires(state, def)) {
      completeQuest(state, def, entry);
    }
  }
  state.run.bossFightActive = false;
}

function onDash(state) {
  state.run.dashes += 1;
  if (state.run.bossFightActive) state.run.bossFightDashes += 1;
  emit(state, "onDash", {});
  for (const def of state.questDefs) {
    if (def.event !== "dash") continue;
    incrementQuestCounter(state, def, 1, {});
  }
}

function onPlayerHit(state) {
  state.run.playerHitsTaken += 1;
  if (state.run.bossFightActive) state.run.bossFightHitTaken = true;
  // Chest streak resets on hit (explicit requirement).
  state.run.chestStreak = 0;
  emit(state, "onPlayerHit", {});
  for (const def of state.questDefs) {
    if (def.event !== "playerHit") continue;
    incrementQuestCounter(state, def, 1, {});
  }
}

function onChestOpen(state) {
  state.run.chestsOpened += 1;
  state.run.chestStreak += 1;
  emit(state, "onChestOpen", { chestStreak: state.run.chestStreak });
  for (const def of state.questDefs) {
    if (def.event === "chestOpen") {
      incrementQuestCounter(state, def, 1, {});
    }
    if (def.scope === "chestStreak" && def.event === "chestStreak") {
      // progress tracks current streak
      const entry = getQuestProgress(state, def.id);
      if (!entry || entry.completed) continue;
      entry.progress = state.run.chestStreak;
      if (def.target != null && entry.progress >= def.target) {
        completeQuest(state, def, entry);
      }
    }
  }
}

function onGoldPickup(state, amount) {
  const amt = Math.max(0, Number(amount) || 0);
  state.run.goldPickedUp += amt;
  emit(state, "onGoldPickup", { amount: amt });
  for (const def of state.questDefs) {
    if (def.event !== "goldPickup") continue;
    incrementQuestCounter(state, def, amt, {});
  }
}

function onHeal(state, amount) {
  const amt = Math.max(0, Number(amount) || 0);
  state.run.healedAmount += amt;
  emit(state, "onHeal", { amount: amt });
  for (const def of state.questDefs) {
    if (def.event !== "heal") continue;
    incrementQuestCounter(state, def, amt, {});
  }
}

function onBiomeStart(state) {
  state.run.biomeActive = true;
  state.run.biomeIndex += 1;
  emit(state, "onBiomeStart", { biomeIndex: state.run.biomeIndex });
  // Biome quests reset when leaving biome; we model that by clearing at biome start.
  resetRunScopedProgress(state, "biome");
}

function onBiomeClear(state) {
  emit(state, "onBiomeClear", { biomeIndex: state.run.biomeIndex });
  // Leaving biome resets biome-specific progress (explicit requirement).
  resetRunScopedProgress(state, "biome");
  state.run.biomeActive = false;
}

function onBossFightStart(state) {
  state.run.bossFightActive = true;
  state.run.bossFightDashes = 0;
  state.run.bossFightHitTaken = false;
  emit(state, "onBossFightStart", {});
}

function onExtraction(state) {
  state.run.extracted = true;
  state.streaks.extractionStreak += 1;
  emit(state, "onExtraction", { extractionStreak: state.streaks.extractionStreak });

  // Streak quests progress on extraction streak value.
  for (const def of state.questDefs) {
    if (def.scope !== "streak") continue;
    if (def.event !== "extractionStreak") continue;
    const entry = getQuestProgress(state, def.id);
    if (!entry || entry.completed) continue;
    entry.progress = state.streaks.extractionStreak;
    if (def.target != null && entry.progress >= def.target) {
      completeQuest(state, def, entry);
    }
  }

  return { crystalsEarnedThisRun: cloneCrystals(state.crystalsEarnedThisRun) };
}

function onDeath(state) {
  state.run.died = true;
  // Death resets extraction streak (explicit requirement).
  state.streaks.extractionStreak = 0;
  emit(state, "onDeath", {});
  return { extractionStreak: 0 };
}

function getPersistentSnapshot(state) {
  // Persist quest progress for ALL scopes (quests are one-time per character), plus streaks.
  const persistentProgress = {};
  for (const def of state.questDefs) {
    const entry = getQuestProgress(state, def.id);
    if (!entry) continue;
    persistentProgress[def.id] = {
      id: entry.id,
      progress: entry.progress,
      completed: entry.completed,
      claimed: entry.claimed,
      completedAtRunIndex: entry.completedAtRunIndex,
    };
  }
  return {
    persistentProgress,
    persistentStreaks: { ...state.streaks },
  };
}

module.exports = {
  DEFAULT_CRYSTALS,
  cloneCrystals,
  addCrystals,
  random,
  createQuestState,
  startRun,
  onEnemyKill,
  onEliteKill,
  onMiniBossKill,
  onFinalBossKill,
  onDash,
  onPlayerHit,
  onChestOpen,
  onGoldPickup,
  onHeal,
  onBiomeStart,
  onBiomeClear,
  onBossFightStart,
  onExtraction,
  onDeath,
  getQuestProgress,
  isCompleted,
  getPersistentSnapshot,
};

