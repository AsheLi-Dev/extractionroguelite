/**
 * Progression / balance simulator.
 * Deterministic, lightweight, Node-only.
 *
 * Models:
 * - repeated runs for a persistent character
 * - extraction vs death
 * - XP, leveling
 * - quest rewards -> crystals
 * - crystal spending on talents with configurable strategies
 *
 * Notes / assumptions (kept explicit on purpose):
 * - Talent costs are paid in the *branch color* crystals:
 *   Brutality->orange, Agility->green, Vitality->red, Luck->yellow
 * - If you later add explicit per-talent crystal color costs, swap the cost resolver.
 */

const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");

const { createQuestState, startRun: startQuestRun, onExtraction: questExtraction, getPersistentSnapshot } = require("./quest-simulator.js");

const BRANCH_TO_CRYSTAL = Object.freeze({
  Brutality: "orange",
  Agility: "green",
  Vitality: "red",
  Luck: "yellow",
});

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

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function cloneCrystals(c) {
  return {
    orange: Math.max(0, Number(c?.orange) || 0),
    green: Math.max(0, Number(c?.green) || 0),
    red: Math.max(0, Number(c?.red) || 0),
    yellow: Math.max(0, Number(c?.yellow) || 0),
  };
}

function addCrystals(a, b) {
  return {
    orange: (a.orange || 0) + (b.orange || 0),
    green: (a.green || 0) + (b.green || 0),
    red: (a.red || 0) + (b.red || 0),
    yellow: (a.yellow || 0) + (b.yellow || 0),
  };
}

function sumCrystals(c) {
  return (c.orange || 0) + (c.green || 0) + (c.red || 0) + (c.yellow || 0);
}

/**
 * XP required to go from level to level+1.
 * Design curve: XP_to_next = 120 + 35·level + 4·level²
 * where "level" is the current level before leveling.
 */
function defaultXpToNextLevel(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return 120 + 35 * lv + 4 * lv * lv;
}

function applyXp(character, xpGained, xpToNextLevel = defaultXpToNextLevel) {
  character.xp = (character.xp || 0) + Math.max(0, Number(xpGained) || 0);
  character.level = Math.max(1, Math.floor(Number(character.level) || 1));
  const before = character.level;
  // Spend XP into levels.
  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level);
    character.level += 1;
  }
  return Math.max(0, character.level - before);
}

function loadTalentCatalogFromSource(repoRoot) {
  const talentsPath = path.join(repoRoot, "src", "data", "talents.js");
  const raw = fs.readFileSync(talentsPath, "utf8");
  const tree = extractTalentTreeObject(raw);

  const out = [];
  for (const [branch, nodes] of Object.entries(tree || {})) {
    const crystal = BRANCH_TO_CRYSTAL[branch];
    if (!crystal) continue;
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes) {
      const id = String(n?.id || "");
      if (!id) continue;
      const cost = Math.max(1, Math.floor(Number(n?.cost) || 1));
      const name = String(n?.name || id);
      out.push({ id, branch, crystal, cost, name });
    }
  }

  // Deduplicate by id.
  const byId = new Map();
  for (const t of out) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

function extractTalentTreeObject(sourceText) {
  // Extract `export const TALENT_TREE = { ... };` and evaluate only the object literal in a sandbox.
  const marker = "export const TALENT_TREE";
  const start = sourceText.indexOf(marker);
  if (start === -1) throw new Error("TALENT_TREE export not found in src/data/talents.js");

  const braceStart = sourceText.indexOf("{", start);
  if (braceStart === -1) throw new Error("TALENT_TREE object start not found");

  let i = braceStart;
  let depth = 0;
  let inStr = false;
  let strCh = null;
  let esc = false;
  let end = -1;

  for (; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === strCh) { inStr = false; strCh = null; }
      continue;
    }
    if (ch === "\"" || ch === "'") { inStr = true; strCh = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error("TALENT_TREE object end not found");
  const objText = sourceText.slice(braceStart, end);

  // Strip line comments to avoid surprises.
  const withoutLineComments = objText.replace(/\/\/.*$/gm, "");
  return vm.runInNewContext(`(${withoutLineComments})`, Object.create(null), { timeout: 50 });
}

function summarizeCatalog(catalog) {
  const byBranch = { Brutality: 0, Agility: 0, Vitality: 0, Luck: 0 };
  const byCost = Object.create(null);
  for (const t of catalog || []) {
    if (byBranch[t.branch] != null) byBranch[t.branch] += 1;
    const c = Math.max(1, Number(t.cost) || 1);
    byCost[c] = (byCost[c] || 0) + 1;
  }
  return { byBranch, byCost, total: (catalog || []).length };
}

function makeDefaultQuestDefs() {
  // Default “balance probe” quests (not necessarily matching game content yet).
  // These are intentionally simple and map to quest-simulator events.
  return [
    { id: "q_elites_20", scope: "run", kind: "counter", event: "eliteKill", target: 20, reward: { orange: 1, green: 0, red: 0, yellow: 0 }, bucket: "core" },
    { id: "q_chests_15", scope: "run", kind: "counter", event: "chestOpen", target: 15, reward: { orange: 0, green: 1, red: 0, yellow: 0 }, bucket: "core" },
    { id: "q_extract_3_streak", scope: "streak", kind: "counter", event: "extractionStreak", target: 3, reward: { orange: 0, green: 0, red: 1, yellow: 0 }, bucket: "tactical" },
    { id: "q_dashless_boss", scope: "boss", kind: "condition", event: "finalBossKill", requires: { bossFightNoDash: true }, reward: { orange: 0, green: 0, red: 0, yellow: 1 }, bucket: "mastery" },
    { id: "q_flawless_boss", scope: "boss", kind: "condition", event: "finalBossKill", requires: { bossFightNoHit: true }, reward: { orange: 0, green: 0, red: 1, yellow: 0 }, bucket: "mastery" },
  ];
}

const BEHAVIOR_PROFILES = Object.freeze(["passive", "balanced", "questFocused"]);

const DEFAULT_BIOME_RUN_CONFIG = Object.freeze({
  biomes: 4,
  biomeEnemiesMin: 70,
  biomeEnemiesMax: 100,
  // Ratios per biome (minions, elites, specials, miniBosses); must sum to 1
  ratioMinions: 0.70,
  ratioElites: 0.20,
  ratioSpecials: 0.08,
  ratioMiniBosses: 0.02,
  chestsPerBiomeMin: 5,
  chestsPerBiomeMax: 10,
});

/**
 * Generate run composition for 4 biomes + boss room (observed scale: ~280-400 enemies per full run).
 * @param {function} rng - 0..1 random
 * @param {object} config - optional overrides for biomeEnemiesMin/Max, ratio*, chestsPerBiome*
 * @param {object} overrides - optional { elitesScale, chestsScale } from behavior profile
 * @returns {{ totalEnemies, minions, elites, specials, miniBosses, chests, bossPresent, perBiome }}
 */
function generateBiomeRun(rng, config, overrides = {}) {
  const c = config?.biomeRun ?? DEFAULT_BIOME_RUN_CONFIG;
  const biomes = Math.max(1, Math.floor(Number(c.biomes) || 4));
  const minE = Math.max(0, Math.floor(Number(c.biomeEnemiesMin) ?? 70));
  const maxE = Math.max(minE, Math.floor(Number(c.biomeEnemiesMax) ?? 100));
  const rMin = Math.max(0, Number(c.ratioMinions) ?? 0.70);
  const rElite = Math.max(0, Number(c.ratioElites) ?? 0.20);
  const rSpec = Math.max(0, Number(c.ratioSpecials) ?? 0.08);
  const rMini = Math.max(0, Number(c.ratioMiniBosses) ?? 0.02);
  const chestMin = Math.max(0, Math.floor(Number(c.chestsPerBiomeMin) ?? 5));
  const chestMax = Math.max(chestMin, Math.floor(Number(c.chestsPerBiomeMax) ?? 10));

  let totalEnemies = 0;
  let minions = 0;
  let elites = 0;
  let specials = 0;
  let miniBosses = 0;
  let chests = 0;
  const perBiome = [];

  for (let b = 0; b < biomes; b++) {
    const biomeEnemies = minE + Math.floor(rng() * (maxE - minE + 1));
    const bMinions = Math.floor(biomeEnemies * rMin);
    const bElites = Math.floor(biomeEnemies * rElite);
    const bSpecials = Math.floor(biomeEnemies * rSpec);
    const bMini = Math.floor(biomeEnemies * rMini);
    const bChests = chestMin + Math.floor(rng() * (chestMax - chestMin + 1));
    totalEnemies += biomeEnemies;
    minions += bMinions;
    elites += bElites;
    specials += bSpecials;
    miniBosses += bMini;
    chests += bChests;
    perBiome.push({ totalEnemies: biomeEnemies, elites: bElites, specials: bSpecials, miniBosses: bMini, chests: bChests });
  }

  if (overrides.elitesScale != null) {
    elites = Math.max(0, Math.floor(elites * overrides.elitesScale));
  }
  if (overrides.chestsScale != null) {
    chests = Math.max(0, Math.floor(chests * overrides.chestsScale));
  }

  return {
    totalEnemies,
    minions,
    elites,
    specials,
    miniBosses,
    chests,
    bossPresent: true,
    perBiome,
  };
}

/**
 * Returns run parameter overrides based on behaviorProfile and optional quest state.
 * Used so questFocused can bias toward more elites/chests, lower boss dash/hit when chasing dashless/flawless, higher extract when streak is close.
 * @param {object} config - config with behaviorProfile and base rates
 * @param {object} [questState] - quest state with progressById, streaks
 * @returns {object} overrides: elitesScale?, chestsScale?, bossFightRate?, bossDashRate?, bossHitRate?, extractionSuccessRate?
 */
function getRunOverridesForProfile(config, questState) {
  const profile = config.behaviorProfile || "balanced";
  if (profile === "balanced") return {};

  const progressById = questState?.progressById || Object.create(null);
  const extractionStreak = Math.max(0, Number(questState?.streaks?.extractionStreak) || 0);

  if (profile === "passive") {
    return {
      elitesScale: 0.7,
      chestsScale: 0.7,
      bossFightRate: 0.6,
      extractionSuccessRate: 0.55,
    };
  }

  if (profile === "questFocused") {
    const dashlessIncomplete = !progressById["q_dashless_boss"]?.completed;
    const flawlessIncomplete = !progressById["q_flawless_boss"]?.completed;
    const streakTarget = 3;
    const streakClose = extractionStreak >= Math.max(0, streakTarget - 1);

    return {
      elitesScale: 1.4,
      chestsScale: 1.4,
      bossFightRate: 0.95,
      bossDashRate: dashlessIncomplete ? 0.15 : (config.bossDashRate ?? 0.35),
      bossHitRate: flawlessIncomplete ? 0.10 : (config.bossHitRate ?? 0.25),
      extractionSuccessRate: streakClose ? 0.85 : (config.extractionSuccessRate ?? 0.65),
    };
  }

  return {};
}

function canBuyTalent(character, talent) {
  const color = talent.crystal;
  const have = Number(character.crystals?.[color]) || 0;
  const cost = Math.max(1, Number(talent.cost) || 1);
  return have >= cost && !character.talents.has(talent.id);
}

function buyTalent(character, talent, counters) {
  const cost = Math.max(1, Number(talent.cost) || 1);
  const color = talent.crystal;
  if (!canBuyTalent(character, talent)) return false;
  character.crystals[color] -= cost;
  character.talents.add(talent.id);
  counters.spentCrystals += cost;
  counters.purchasedCostSum += cost;
  counters.purchasedCountsByBranch[talent.branch] = (counters.purchasedCountsByBranch[talent.branch] || 0) + 1;
  counters.purchasedCountsByCost[cost] = (counters.purchasedCountsByCost[cost] || 0) + 1;
  counters.purchasedFrequency[talent.id] = (counters.purchasedFrequency[talent.id] || 0) + 1;
  return true;
}

function pickNextTalentGreedyCheap(character, catalog) {
  return catalog
    .filter((t) => canBuyTalent(character, t))
    .slice()
    .sort((a, b) => (a.cost - b.cost) || a.branch.localeCompare(b.branch) || a.id.localeCompare(b.id))[0] || null;
}

function pickNextTalentKeystoneFocused(character, catalog) {
  const affordable = catalog.filter((t) => !character.talents.has(t.id));
  const maxCost = Math.max(1, ...affordable.map((t) => t.cost || 1));
  const targets = [3, 2, 1].filter((c) => c <= maxCost);
  for (const cost of targets) {
    const pick = affordable
      .filter((t) => (t.cost || 1) === cost && canBuyTalent(character, t))
      .slice()
      .sort((a, b) => a.branch.localeCompare(b.branch) || a.id.localeCompare(b.id))[0];
    if (pick) return pick;
  }
  return null;
}

function pickNextTalentBalanced(character, catalog, balanceState) {
  // Round-robin branches; choose cheapest available in that branch.
  const order = ["Brutality", "Agility", "Vitality", "Luck"];
  const start = balanceState.branchCursor % order.length;
  for (let i = 0; i < order.length; i++) {
    const branch = order[(start + i) % order.length];
    const pick = catalog
      .filter((t) => t.branch === branch && canBuyTalent(character, t))
      .slice()
      .sort((a, b) => (a.cost - b.cost) || a.id.localeCompare(b.id))[0];
    if (pick) {
      balanceState.branchCursor = (start + i + 1) % order.length;
      return pick;
    }
  }
  return null;
}

function runAutoBuy(character, catalog, strategyId, counters) {
  const balanceState = counters._balanceState || { branchCursor: 0 };
  counters._balanceState = balanceState;

  // Keep buying until no affordable talent remains.
  for (let safety = 0; safety < 10000; safety++) {
    let next = null;
    if (strategyId === "greedyCheap") next = pickNextTalentGreedyCheap(character, catalog);
    else if (strategyId === "balanced") next = pickNextTalentBalanced(character, catalog, balanceState);
    else if (strategyId === "keystoneFocused") next = pickNextTalentKeystoneFocused(character, catalog);
    else next = pickNextTalentGreedyCheap(character, catalog);

    if (!next) break;
    if (!buyTalent(character, next, counters)) break;
  }
}

function createCharacter() {
  return {
    level: 1,
    xp: 0,
    crystals: { orange: 0, green: 0, red: 0, yellow: 0 },
    talents: new Set(),
    questProgress: {},
    questStreaks: { extractionStreak: 0 },
    successfulExtractions: 0,
    // Crystal sources (lifetime totals)
    crystalsEarned: {
      base: { orange: 0, green: 0, red: 0, yellow: 0 },
      quests: { orange: 0, green: 0, red: 0, yellow: 0 },
      levelUps: { orange: 0, green: 0, red: 0, yellow: 0 },
    },
    // Attribute allocation model (lifetime totals)
    attributes: { brutality: 0, agility: 0, vitality: 0, luck: 0 },
    _attrAllocCursor: 0,
  };
}

function addCrystalSource(character, sourceKey, crystals) {
  const c = cloneCrystals(crystals);
  character.crystals = addCrystals(character.crystals, c);
  if (character.crystalsEarned?.[sourceKey]) {
    character.crystalsEarned[sourceKey] = addCrystals(character.crystalsEarned[sourceKey], c);
  }
}

function getLevelUpCrystals(levelUps, config) {
  const per = config?.levelUpCrystalsPerLevelUp;
  if (!per || typeof per !== "object" || levelUps <= 0) return { orange: 0, green: 0, red: 0, yellow: 0 };
  const one = cloneCrystals(per);
  return {
    orange: one.orange * levelUps,
    green: one.green * levelUps,
    red: one.red * levelUps,
    yellow: one.yellow * levelUps,
  };
}

function attributeIdForCrystalColor(color) {
  if (color === "orange") return "brutality";
  if (color === "green") return "agility";
  if (color === "red") return "vitality";
  if (color === "yellow") return "luck";
  return null;
}

function crystalsFromAttributesDelta(prevAttrs, nextAttrs) {
  const out = { orange: 0, green: 0, red: 0, yellow: 0 };
  const pairs = [
    ["brutality", "orange"],
    ["agility", "green"],
    ["vitality", "red"],
    ["luck", "yellow"],
  ];
  for (const [attr, color] of pairs) {
    const prev = Math.max(0, Number(prevAttrs?.[attr]) || 0);
    const next = Math.max(0, Number(nextAttrs?.[attr]) || 0);
    const prevCr = Math.floor(prev / 2);
    const nextCr = Math.floor(next / 2);
    out[color] = Math.max(0, nextCr - prevCr);
  }
  return out;
}

function allocateAttributePoints(character, points, policy) {
  const p = Math.max(0, Math.floor(Number(points) || 0));
  if (p <= 0) return;
  const prev = { ...character.attributes };

  const mode = policy?.mode || "balanced";
  const primary = policy?.primary || "vitality"; // default: survivability
  const order = ["brutality", "agility", "vitality", "luck"];

  for (let i = 0; i < p; i++) {
    if (mode === "primaryFocused") {
      character.attributes[primary] = (character.attributes[primary] || 0) + 1;
      continue;
    }
    // balanced / spread: round-robin through attributes
    const idx = character._attrAllocCursor % order.length;
    character._attrAllocCursor = (character._attrAllocCursor + 1) % order.length;
    const key = order[idx];
    character.attributes[key] = (character.attributes[key] || 0) + 1;
  }

  const delta = crystalsFromAttributesDelta(prev, character.attributes);
  addCrystalSource(character, "levelUps", delta);
}

function simulateSingleRun(rng, config, questState) {
  const overrides = config.behaviorProfile ? getRunOverridesForProfile(config, questState) : {};
  const bossFightRate = overrides.bossFightRate != null ? overrides.bossFightRate : (config.bossFightRate ?? 0.9);
  const bossDashRate = overrides.bossDashRate != null ? overrides.bossDashRate : (config.bossDashRate ?? 0.35);
  const bossHitRate = overrides.bossHitRate != null ? overrides.bossHitRate : (config.bossHitRate ?? 0.25);
  const extractionSuccessRate = overrides.extractionSuccessRate != null ? overrides.extractionSuccessRate : (config.extractionSuccessRate ?? 0.65);

  let runComposition = null;
  let elites = 0;
  let chests = 0;

  if (config.runModel === "biome") {
    runComposition = generateBiomeRun(rng, config, overrides);
    elites = runComposition.elites;
    chests = runComposition.chests;
    const qs = require("./quest-simulator.js");
    for (let i = 0; i < elites; i++) qs.onEliteKill(questState);
    for (let i = 0; i < chests; i++) qs.onChestOpen(questState);
    for (let i = 0; i < runComposition.miniBosses; i++) qs.onMiniBossKill(questState);
    if (questState.run) {
      questState.run.enemyKills = runComposition.totalEnemies;
    }
    if (rng() < clamp01(bossFightRate)) {
      qs.onBossFightStart(questState);
      if (rng() < clamp01(bossDashRate)) qs.onDash(questState);
      if (rng() < clamp01(bossHitRate)) qs.onPlayerHit(questState);
      qs.onFinalBossKill(questState);
    }
  } else if (typeof config.simulateQuestEvents === "function") {
    const enemies = config.enemyComposition || {};
    elites = Math.max(0, Math.floor((enemies.elitesAvg ?? 12) + (rng() - 0.5) * (enemies.elitesJitter ?? 6)));
    chests = Math.max(0, Math.floor((enemies.chestsAvg ?? 10) + (rng() - 0.5) * (enemies.chestsJitter ?? 6)));
    if (overrides.elitesScale != null) elites = Math.max(0, Math.floor(elites * overrides.elitesScale));
    if (overrides.chestsScale != null) chests = Math.max(0, Math.floor(chests * overrides.chestsScale));
    config.simulateQuestEvents({ rng, quest: questState, elites, chests });
  } else {
    const enemies = config.enemyComposition || {};
    elites = Math.max(0, Math.floor((enemies.elitesAvg ?? 12) + (rng() - 0.5) * (enemies.elitesJitter ?? 6)));
    chests = Math.max(0, Math.floor((enemies.chestsAvg ?? 10) + (rng() - 0.5) * (enemies.chestsJitter ?? 6)));
    if (overrides.elitesScale != null) elites = Math.max(0, Math.floor(elites * overrides.elitesScale));
    if (overrides.chestsScale != null) chests = Math.max(0, Math.floor(chests * overrides.chestsScale));
    const qs = require("./quest-simulator.js");
    for (let i = 0; i < elites; i++) qs.onEliteKill(questState);
    for (let i = 0; i < chests; i++) qs.onChestOpen(questState);
    const bossHappened = rng() < clamp01(bossFightRate);
    if (bossHappened) {
      qs.onBossFightStart(questState);
      if (rng() < clamp01(bossDashRate)) qs.onDash(questState);
      if (rng() < clamp01(bossHitRate)) qs.onPlayerHit(questState);
      qs.onFinalBossKill(questState);
    }
  }

  const extracted = rng() < clamp01(extractionSuccessRate);
  return { extracted, elites, chests, runComposition };
}

/**
 * Compute XP for a run. Uses runComposition when config.runModel === "biome", else quest.run counters.
 * @param {object} config
 * @param {object} questState
 * @param {object} [runComposition] - from simulateSingleRun when runModel === "biome"
 * @returns {number}
 */
function computeXpFromRun(config, questState, runComposition) {
  const xpModel = config.xpModel || {};
  if (config.runModel === "biome" && runComposition) {
    // Defaults aligned with game: enemy.js XP_BAND_MAP basic 10-20 (avg 15), elite_like 30-50 (avg 40); BOSS_XP 200; breakables 1-4 (avg 2)
    const base = Math.max(0, Number(xpModel.baseXpPerRun ?? 0));
    const perEnemy = Math.max(0, Number(xpModel.xpPerEnemy ?? 15));
    const perElite = Math.max(0, Number(xpModel.xpPerElite ?? 40));
    const perSpecial = Math.max(0, Number(xpModel.xpPerSpecial ?? 35));
    const perMiniBoss = Math.max(0, Number(xpModel.xpPerMiniBoss ?? 70));
    const perChest = Math.max(0, Number(xpModel.xpPerChest ?? 2));
    const bossXp = Math.max(0, Number(xpModel.bossBonusXp ?? 200));
    return (
      base +
      (runComposition.minions || 0) * perEnemy +
      (runComposition.elites || 0) * perElite +
      (runComposition.specials || 0) * perSpecial +
      (runComposition.miniBosses || 0) * perMiniBoss +
      (runComposition.chests || 0) * perChest +
      (runComposition.bossPresent ? bossXp : 0)
    );
  }
  const base = Math.max(0, Number(xpModel.baseXpPerRun ?? 20));
  const eliteXp = Math.max(0, Number(xpModel.xpPerElite ?? 2));
  const chestXp = Math.max(0, Number(xpModel.xpPerChest ?? 1));
  const bossXp = Math.max(0, Number(xpModel.bossBonusXp ?? 25));
  const elites = questState.run?.eliteKills || 0;
  const chests = questState.run?.chestsOpened || 0;
  const bosses = questState.run?.finalBossKills || 0;
  return base + elites * eliteXp + chests * chestXp + bosses * bossXp;
}

function simulateProgression(config) {
  const repoRoot = config.repoRoot;
  const rng = mulberry32(Number(config.seed) || 12345);
  const catalog = config.talentCatalog || loadTalentCatalogFromSource(repoRoot);
  const questDefs = config.questDefs || makeDefaultQuestDefs();
  const catalogSummary = summarizeCatalog(catalog);

  // Integrity checks on ingestion/normalization.
  if (catalogSummary.total <= 0) throw new Error("Talent catalog ingestion error: no talents found");
  const requireAllBranches = config.requireAllBranches !== false;
  if (requireAllBranches) {
    for (const [branch, count] of Object.entries(catalogSummary.byBranch)) {
      if (count <= 0) throw new Error(`Talent catalog ingestion error: branch ${branch} has 0 talents`);
    }
  }

  const strategyIds = config.strategies && config.strategies.length ? config.strategies : ["greedyCheap", "balanced", "keystoneFocused"];

  // Profile comparison: 20 runs per lifetime, one strategy, results keyed by behavior profile.
  if (config.profileComparison === true) {
    const resultsByProfile = Object.create(null);
    const profileLifetimes = Math.max(0, Math.floor(config.lifetimes ?? 100));
    const profileRunsPerLifetime = 20;
    const profileStrategyId = "greedyCheap";

    for (const profile of BEHAVIOR_PROFILES) {
      const profileConfig = {
        ...config,
        behaviorProfile: profile,
        runsPerLifetimeMin: profileRunsPerLifetime,
        runsPerLifetimeMax: profileRunsPerLifetime,
        singleRuns: 0,
      };
      const runAgg = { runs: 0, extracted: 0, totalXp: 0, totalCrystals: 0, totalQuestsCompleted: 0, totalLevelGained: 0 };
      const lifetimeAgg = {
        lifetimes: 0,
        milestones: { 5: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 }, 10: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 }, 15: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 }, 20: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 } },
        purchasedCountsByBranch: { Brutality: 0, Agility: 0, Vitality: 0, Luck: 0 },
        purchasedCountsByCost: { 1: 0, 2: 0, 3: 0 },
        spentCrystals: 0,
        purchasedCostSum: 0,
        unspentCrystals: 0,
        finalBuildSize: 0,
        purchasedFrequency: Object.create(null),
        questCrystalsSum: { orange: 0, green: 0, red: 0, yellow: 0 },
        baseCrystalsSum: { orange: 0, green: 0, red: 0, yellow: 0 },
        levelUpCrystalsSum: { orange: 0, green: 0, red: 0, yellow: 0 },
        totalCrystalsEarnedSum: { orange: 0, green: 0, red: 0, yellow: 0 },
        buildTargets: { 15: { hits: 0, samples: 0 }, 18: { hits: 0, samples: 0 }, 20: { hits: 0, samples: 0 } },
      };
      const questStats = Object.create(null);
      for (const q of questDefs) questStats[q.id] = { completed: 0, seen: 0 };

      for (let l = 0; l < profileLifetimes; l++) {
        const char = createCharacter();
        const lifetimeCounters = {
          spentCrystals: 0,
          purchasedCostSum: 0,
          purchasedCountsByBranch: { Brutality: 0, Agility: 0, Vitality: 0, Luck: 0 },
          purchasedCountsByCost: { 1: 0, 2: 0, 3: 0 },
          purchasedFrequency: lifetimeAgg.purchasedFrequency,
          _balanceState: { branchCursor: 0 },
        };
        const milestoneRecorded = { 5: false, 10: false, 15: false, 20: false };

        for (let r = 0; r < profileRunsPerLifetime; r++) {
          const quest = createQuestState({ questDefs, persistentProgress: char.questProgress, persistentStreaks: char.questStreaks, runIndex: r });
          startQuestRun(quest);

          const { extracted, runComposition } = simulateSingleRun(rng, profileConfig, quest);
          const xp = computeXpFromRun(profileConfig, quest, runComposition);

          let levelUpsThisRun = 0;
          if (extracted || profileConfig.xpPersistsOnDeath === true) {
            levelUpsThisRun = applyXp(char, xp, profileConfig.xpToNextLevel || defaultXpToNextLevel);
          }

          if (extracted) {
            const base = profileConfig.baseCrystalsPerExtraction || null;
            if (base && typeof base === "object") addCrystalSource(char, "base", base);
            const attrPolicy = profileConfig.attributeAllocationPolicy || { mode: "balanced" };
            allocateAttributePoints(char, levelUpsThisRun, attrPolicy);
            const out = questExtraction(quest);
            addCrystalSource(char, "quests", out.crystalsEarnedThisRun);
            char.successfulExtractions += 1;
          }

          const snap = getPersistentSnapshot(quest);
          char.questProgress = snap.persistentProgress;
          char.questStreaks = snap.persistentStreaks;

          runAutoBuy(char, catalog, profileStrategyId, lifetimeCounters);

          for (const n of [5, 10, 15, 20]) {
            if (!milestoneRecorded[n] && char.successfulExtractions >= n) {
              milestoneRecorded[n] = true;
              const bucket = lifetimeAgg.milestones[n];
              bucket.levelSum += char.level;
              bucket.crystalsSum += sumCrystals(char.crystals);
              bucket.talentsSum += char.talents.size;
              bucket.samples += 1;
            }
          }

          for (const q of questDefs) questStats[q.id].seen += 1;
          for (const qid of quest.questCompletionsThisRun || []) {
            if (questStats[qid]) questStats[qid].completed += 1;
          }
        }

        lifetimeAgg.lifetimes += 1;
        lifetimeAgg.finalBuildSize += char.talents.size;
        lifetimeAgg.unspentCrystals += sumCrystals(char.crystals);
        lifetimeAgg.spentCrystals += lifetimeCounters.spentCrystals;
        lifetimeAgg.purchasedCostSum += lifetimeCounters.purchasedCostSum;
        lifetimeAgg.questCrystalsSum = addCrystals(lifetimeAgg.questCrystalsSum, char.crystalsEarned.quests);
        lifetimeAgg.baseCrystalsSum = addCrystals(lifetimeAgg.baseCrystalsSum, char.crystalsEarned.base);
        lifetimeAgg.levelUpCrystalsSum = addCrystals(lifetimeAgg.levelUpCrystalsSum, char.crystalsEarned.levelUps);
        lifetimeAgg.totalCrystalsEarnedSum = addCrystals(
          lifetimeAgg.totalCrystalsEarnedSum,
          addCrystals(addCrystals(char.crystalsEarned.base, char.crystalsEarned.quests), char.crystalsEarned.levelUps)
        );
        for (const b of Object.keys(lifetimeCounters.purchasedCountsByBranch)) {
          lifetimeAgg.purchasedCountsByBranch[b] += lifetimeCounters.purchasedCountsByBranch[b] || 0;
        }
        for (const c of Object.keys(lifetimeCounters.purchasedCountsByCost)) {
          lifetimeAgg.purchasedCountsByCost[c] += lifetimeCounters.purchasedCountsByCost[c] || 0;
        }
        for (const target of [15, 18, 20]) {
          const bucket = lifetimeAgg.buildTargets[target];
          bucket.samples += 1;
          if (char.talents.size >= target) bucket.hits += 1;
        }
      }

      const bucketStats = { core: { completed: 0, seen: 0 }, tactical: { completed: 0, seen: 0 }, mastery: { completed: 0, seen: 0 } };
      for (const q of questDefs) {
        const b = q.bucket || "core";
        if (bucketStats[b]) {
          bucketStats[b].completed += questStats[q.id].completed;
          bucketStats[b].seen += questStats[q.id].seen;
        }
      }

      resultsByProfile[profile] = {
        profileId: profile,
        strategyId: profileStrategyId,
        talentCatalogSize: catalog.length,
        catalogSummary,
        questDefs,
        runAgg,
        lifetimeAgg,
        questStats,
        bucketStats,
      };
    }

    return { resultsByProfile };
  }

  const resultsByStrategy = {};

  for (const strategyId of strategyIds) {
    // Run-level aggregate (runCompositionSum used when runModel === "biome" for per-run averages)
    const runAgg = {
      runs: 0,
      extracted: 0,
      totalXp: 0,
      totalCrystals: 0,
      totalQuestsCompleted: 0,
      totalLevelGained: 0,
      runCompositionSum: {
        totalEnemies: 0,
        elites: 0,
        specials: 0,
        miniBosses: 0,
        chests: 0,
        bossPresent: 0,
        perBiomeSum: [{ totalEnemies: 0, elites: 0, specials: 0, miniBosses: 0, chests: 0 }, { totalEnemies: 0, elites: 0, specials: 0, miniBosses: 0, chests: 0 }, { totalEnemies: 0, elites: 0, specials: 0, miniBosses: 0, chests: 0 }, { totalEnemies: 0, elites: 0, specials: 0, miniBosses: 0, chests: 0 }],
      },
    };

    // Lifetime aggregate
    const lifetimeAgg = {
      lifetimes: 0,
      milestones: {
        5: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 },
        10: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 },
        15: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 },
        20: { levelSum: 0, crystalsSum: 0, talentsSum: 0, samples: 0 },
      },
      purchasedCountsByBranch: { Brutality: 0, Agility: 0, Vitality: 0, Luck: 0 },
      purchasedCountsByCost: { 1: 0, 2: 0, 3: 0 },
      spentCrystals: 0,
      purchasedCostSum: 0,
      unspentCrystals: 0,
      finalBuildSize: 0,
      purchasedFrequency: Object.create(null),
      // Crystal source accounting (per lifetime averages)
      questCrystalsSum: { orange: 0, green: 0, red: 0, yellow: 0 },
      baseCrystalsSum: { orange: 0, green: 0, red: 0, yellow: 0 },
      levelUpCrystalsSum: { orange: 0, green: 0, red: 0, yellow: 0 },
      totalCrystalsEarnedSum: { orange: 0, green: 0, red: 0, yellow: 0 },
      // Build target hit rates
      buildTargets: {
        15: { hits: 0, samples: 0 },
        18: { hits: 0, samples: 0 },
        20: { hits: 0, samples: 0 },
      },
    };

    // Quest completion rates
    const questStats = Object.create(null);
    for (const q of questDefs) {
      questStats[q.id] = { completed: 0, seen: 0 };
    }

    // 1) Run-level sim
    const singleRuns = Math.max(0, Math.floor(config.singleRuns ?? 1000));
    for (let i = 0; i < singleRuns; i++) {
      const quest = createQuestState({ questDefs, persistentProgress: {}, persistentStreaks: { extractionStreak: 0 }, runIndex: i });
      startQuestRun(quest);

      const levelBefore = 1;
      const { extracted, runComposition } = simulateSingleRun(rng, config, quest);
      const xp = computeXpFromRun(config, quest, runComposition);

      if (runComposition) {
        runAgg.runCompositionSum.totalEnemies += runComposition.totalEnemies || 0;
        runAgg.runCompositionSum.elites += runComposition.elites || 0;
        runAgg.runCompositionSum.specials += runComposition.specials || 0;
        runAgg.runCompositionSum.miniBosses += runComposition.miniBosses || 0;
        runAgg.runCompositionSum.chests += runComposition.chests || 0;
        if (runComposition.bossPresent) runAgg.runCompositionSum.bossPresent += 1;
        const perBiome = runComposition.perBiome;
        if (Array.isArray(perBiome) && runAgg.runCompositionSum.perBiomeSum) {
          for (let b = 0; b < Math.min(perBiome.length, runAgg.runCompositionSum.perBiomeSum.length); b++) {
            const slot = runAgg.runCompositionSum.perBiomeSum[b];
            const pb = perBiome[b];
            if (slot && pb) {
              slot.totalEnemies += pb.totalEnemies || 0;
              slot.elites += pb.elites || 0;
              slot.specials += pb.specials || 0;
              slot.miniBosses += pb.miniBosses || 0;
              slot.chests += pb.chests || 0;
            }
          }
        }
      } else {
        runAgg.runCompositionSum.elites += quest.run?.eliteKills || 0;
        runAgg.runCompositionSum.chests += quest.run?.chestsOpened || 0;
        if (quest.run?.finalBossKills) runAgg.runCompositionSum.bossPresent += 1;
      }

      runAgg.runs += 1;
      if (extracted) runAgg.extracted += 1;
      runAgg.totalXp += xp;

      // Reward crystals only matter on extraction (modeled that way in persistence tests).
      const crystals = extracted ? questExtraction(quest).crystalsEarnedThisRun : { orange: 0, green: 0, red: 0, yellow: 0 };
      runAgg.totalCrystals += sumCrystals(crystals);
      runAgg.totalQuestsCompleted += (quest.questCompletionsThisRun || []).length;

      // Level-gain proxy: compute from xp with a fresh character.
      const tmpChar = { level: 1, xp: 0 };
      applyXp(tmpChar, xp, config.xpToNextLevel || defaultXpToNextLevel);
      runAgg.totalLevelGained += tmpChar.level - levelBefore;

      // Quest completion stats (completed in this run)
      for (const q of questDefs) questStats[q.id].seen += 1;
      for (const qid of quest.questCompletionsThisRun || []) {
        if (questStats[qid]) questStats[qid].completed += 1;
      }
    }

    // 2) Lifetime sim
    const lifetimes = Math.max(0, Math.floor(config.lifetimes ?? 100));
    const runsPerLifetimeMin = Math.max(1, Math.floor(config.runsPerLifetimeMin ?? 20));
    const runsPerLifetimeMax = Math.max(runsPerLifetimeMin, Math.floor(config.runsPerLifetimeMax ?? 30));

    for (let l = 0; l < lifetimes; l++) {
      const char = createCharacter();
      const lifetimeCounters = {
        spentCrystals: 0,
        purchasedCostSum: 0,
        purchasedCountsByBranch: { Brutality: 0, Agility: 0, Vitality: 0, Luck: 0 },
        purchasedCountsByCost: { 1: 0, 2: 0, 3: 0 },
        purchasedFrequency: lifetimeAgg.purchasedFrequency,
        _balanceState: { branchCursor: 0 },
      };
      const milestoneRecorded = { 5: false, 10: false, 15: false, 20: false };

      const runCount = runsPerLifetimeMin + Math.floor(rng() * (runsPerLifetimeMax - runsPerLifetimeMin + 1));
      for (let r = 0; r < runCount; r++) {
        const quest = createQuestState({
          questDefs,
          persistentProgress: char.questProgress,
          persistentStreaks: char.questStreaks,
          runIndex: r,
        });
        startQuestRun(quest);

        const { extracted, runComposition } = simulateSingleRun(rng, config, quest);
        const xp = computeXpFromRun(config, quest, runComposition);

        // Real progression: level-ups during run convert to attribute points on extraction.
        // XP persists only on extraction unless xpPersistsOnDeath is set.
        let levelUpsThisRun = 0;
        if (extracted || config.xpPersistsOnDeath === true) {
          levelUpsThisRun = applyXp(char, xp, config.xpToNextLevel || defaultXpToNextLevel);
        }

        // Crystal income model:
        // - baseline injection (optional, for A/B/C comparisons)
        // - attribute crystals from run level-ups (real model)
        // - quest crystals on extraction (one-time per character)
        if (extracted) {
          const base = config.baseCrystalsPerExtraction || null;
          if (base && typeof base === "object") {
            addCrystalSource(char, "base", base);
          }
          // Attribute points: 1 point per level-up in the run (as per your design).
          // Crystals: 2 points in an attribute => 1 crystal of that color.
          const attrPolicy = config.attributeAllocationPolicy || { mode: "balanced" };
          allocateAttributePoints(char, levelUpsThisRun, attrPolicy);
          const out = questExtraction(quest);
          // Quest simulator now enforces one-time per character via persisted completion.
          // So this will naturally drop to 0 after a quest is completed once.
          addCrystalSource(char, "quests", out.crystalsEarnedThisRun);
          char.successfulExtractions += 1;
        }

        // Persist quest state (lifetime + streak)
        const snap = getPersistentSnapshot(quest);
        char.questProgress = snap.persistentProgress;
        char.questStreaks = snap.persistentStreaks;

        // Auto-buy talents after each run (if configured).
        runAutoBuy(char, catalog, strategyId, lifetimeCounters);

        // Stable milestone snapshots:
        // record immediately after reaching >= N successful extractions (first time only).
        for (const n of [5, 10, 15, 20]) {
          if (!milestoneRecorded[n] && char.successfulExtractions >= n) {
            milestoneRecorded[n] = true;
            const bucket = lifetimeAgg.milestones[n];
            bucket.levelSum += char.level;
            bucket.crystalsSum += sumCrystals(char.crystals);
            bucket.talentsSum += char.talents.size;
            bucket.samples += 1;
          }
        }
      }

      lifetimeAgg.lifetimes += 1;
      lifetimeAgg.finalBuildSize += char.talents.size;
      lifetimeAgg.unspentCrystals += sumCrystals(char.crystals);
      lifetimeAgg.spentCrystals += lifetimeCounters.spentCrystals;
      lifetimeAgg.purchasedCostSum += lifetimeCounters.purchasedCostSum;
      lifetimeAgg.questCrystalsSum = addCrystals(lifetimeAgg.questCrystalsSum, char.crystalsEarned.quests);
      lifetimeAgg.baseCrystalsSum = addCrystals(lifetimeAgg.baseCrystalsSum, char.crystalsEarned.base);
      lifetimeAgg.levelUpCrystalsSum = addCrystals(lifetimeAgg.levelUpCrystalsSum, char.crystalsEarned.levelUps);
      lifetimeAgg.totalCrystalsEarnedSum = addCrystals(
        lifetimeAgg.totalCrystalsEarnedSum,
        addCrystals(addCrystals(char.crystalsEarned.base, char.crystalsEarned.quests), char.crystalsEarned.levelUps)
      );
      for (const b of Object.keys(lifetimeCounters.purchasedCountsByBranch)) {
        lifetimeAgg.purchasedCountsByBranch[b] += lifetimeCounters.purchasedCountsByBranch[b] || 0;
      }
      for (const c of Object.keys(lifetimeCounters.purchasedCountsByCost)) {
        lifetimeAgg.purchasedCountsByCost[c] += lifetimeCounters.purchasedCountsByCost[c] || 0;
      }

      // Hard integrity: cost accounting must match.
      if (lifetimeCounters.spentCrystals !== lifetimeCounters.purchasedCostSum) {
        throw new Error(`Spent crystals mismatch: spent=${lifetimeCounters.spentCrystals} sum(costs)=${lifetimeCounters.purchasedCostSum}`);
      }

      // Build target analysis (final build size per lifetime).
      for (const target of [15, 18, 20]) {
        const bucket = lifetimeAgg.buildTargets[target];
        bucket.samples += 1;
        if (char.talents.size >= target) bucket.hits += 1;
      }
    }

    resultsByStrategy[strategyId] = {
      strategyId,
      talentCatalogSize: catalog.length,
      catalogSummary,
      questDefs,
      runAgg,
      lifetimeAgg,
      questStats,
    };
  }

  return resultsByStrategy;
}

function toTopNFrequencyMap(freqMap, n = 10) {
  const list = Object.entries(freqMap || {})
    .map(([id, count]) => ({ id, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, n);
  return list;
}

/**
 * From questStats (id -> { completed, seen }), return top N and bottom N quest IDs by completion rate.
 * @param {object} questStats
 * @param {number} n
 * @returns {{ top: Array<{id: string, rate: number}>, bottom: Array<{id: string, rate: number}> }}
 */
function questCompletionTopBottom(questStats, n = 3) {
  const list = Object.entries(questStats || {})
    .map(([id, s]) => ({ id, rate: (s.seen > 0 ? (s.completed || 0) / s.seen : 0) }))
    .sort((a, b) => b.rate - a.rate || a.id.localeCompare(b.id));
  return {
    top: list.slice(0, n),
    bottom: list.slice(-n).reverse(),
  };
}

function buildWarnings(report, thresholds) {
  const warnings = [];
  const t = thresholds || {};
  for (const [strategyId, r] of Object.entries(report)) {
    const runs = Math.max(1, r.runAgg.runs || 1);
    const avgCrystals = r.runAgg.totalCrystals / runs;
    const avgXp = r.runAgg.totalXp / runs;
    const extractionRate = r.runAgg.extracted / runs;
    const avgQuests = r.runAgg.totalQuestsCompleted / runs;

    const lifetimes = Math.max(1, r.lifetimeAgg.lifetimes || 1);
    const avgFinalBuild = r.lifetimeAgg.finalBuildSize / lifetimes;
    const avgCrystalsUnspent = r.lifetimeAgg.unspentCrystals / lifetimes;
    const avgQuestCrystals = sumCrystals(r.lifetimeAgg.questCrystalsSum || {}) / lifetimes;
    const avgTotalCrystalsEarned = sumCrystals(r.lifetimeAgg.totalCrystalsEarnedSum || {}) / lifetimes;
    const avgBaseCrystals = sumCrystals(r.lifetimeAgg.baseCrystalsSum || {}) / lifetimes;
    const avgLevelUpCrystals = sumCrystals(r.lifetimeAgg.levelUpCrystalsSum || {}) / lifetimes;

    if (avgCrystals < (t.minAvgCrystalsPerRun ?? 1)) warnings.push(`[${strategyId}] avg crystals/run low: ${avgCrystals.toFixed(2)}`);
    if (avgCrystals > (t.maxAvgCrystalsPerRun ?? 6)) warnings.push(`[${strategyId}] avg crystals/run high: ${avgCrystals.toFixed(2)}`);

    if (avgFinalBuild < (t.minAvgFinalBuildAfterLifetime ?? 12)) warnings.push(`[${strategyId}] avg final build size low: ${avgFinalBuild.toFixed(2)}`);
    if (avgFinalBuild > (t.maxAvgFinalBuildAfterLifetime ?? 25)) warnings.push(`[${strategyId}] avg final build size high: ${avgFinalBuild.toFixed(2)}`);

    // One-time quest pool warnings
    if (avgQuestCrystals < (t.minAvgQuestCrystalsPerLifetime ?? 3)) warnings.push(`[${strategyId}] quest crystal pool low: avg ${avgQuestCrystals.toFixed(2)} per lifetime`);
    if (avgQuestCrystals > (t.maxAvgQuestCrystalsPerLifetime ?? 60)) warnings.push(`[${strategyId}] quest crystal pool very high: avg ${avgQuestCrystals.toFixed(2)} per lifetime`);

    // Total crystal pool warnings (risk of near-full-tree)
    if (avgTotalCrystalsEarned > (t.maxAvgTotalCrystalsPerLifetime ?? 140)) warnings.push(`[${strategyId}] total crystal pool very high: avg ${avgTotalCrystalsEarned.toFixed(2)} per lifetime`);

    // Baseline dominance warnings (baseline should not dominate if modeling real progression)
    const denom = Math.max(1e-9, avgTotalCrystalsEarned);
    const baseRatio = avgBaseCrystals / denom;
    if (baseRatio > (t.maxBaselineDominanceRatio ?? 0.5)) warnings.push(`[${strategyId}] baseline crystals dominate: ${(baseRatio * 100).toFixed(1)}% of total crystals`);
    if (avgLevelUpCrystals < (t.minAvgLevelUpCrystalsPerLifetime ?? 5)) warnings.push(`[${strategyId}] level-up crystals negligible: avg ${avgLevelUpCrystals.toFixed(2)} per lifetime`);

    // After-10-extractions build size sanity (when sample exists)
    const b10 = r.lifetimeAgg.milestones?.[10] || r.lifetimeAgg.milestones?.["10"];
    if (b10 && Number(b10.samples) > 0) {
      const avgTalents10 = (Number(b10.talentsSum) || 0) / Math.max(1, Number(b10.samples) || 0);
      if (avgTalents10 > (t.maxTalentsAfter10Extractions ?? 25)) warnings.push(`[${strategyId}] too many talents by 10 extractions: avg ${avgTalents10.toFixed(2)}`);
    }

    // Quest completion rates (we still print these as event-based completions)
    for (const [qid, stat] of Object.entries(r.questStats || {})) {
      const seen = Math.max(1, stat.seen || 1);
      const rate = (stat.completed || 0) / seen;
      if (rate < (t.minQuestCompletionRate ?? 0.005)) warnings.push(`[${strategyId}] quest near-0% completion: ${qid} (${(rate * 100).toFixed(2)}%)`);
      if (rate > (t.maxQuestCompletionRate ?? 0.8)) warnings.push(`[${strategyId}] quest very high completion: ${qid} (${(rate * 100).toFixed(2)}%)`);
    }

    // Color imbalance (one color much more available than others)
    const q = r.lifetimeAgg.questCrystalsSum || {};
    const qAvg = {
      orange: (q.orange || 0) / lifetimes,
      green: (q.green || 0) / lifetimes,
      red: (q.red || 0) / lifetimes,
      yellow: (q.yellow || 0) / lifetimes,
    };
    const vals = Object.values(qAvg).filter((v) => Number.isFinite(v));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max - min > (t.maxQuestColorSpread ?? 10)) {
      warnings.push(`[${strategyId}] quest crystal color imbalance: avg {o:${qAvg.orange.toFixed(1)} g:${qAvg.green.toFixed(1)} r:${qAvg.red.toFixed(1)} y:${qAvg.yellow.toFixed(1)}}`);
    }

    // “one talent in >80% builds” proxy: frequency across lifetimes
    const top = toTopNFrequencyMap(r.lifetimeAgg.purchasedFrequency, 1)[0];
    if (top && lifetimes > 0) {
      const pct = top.count / lifetimes;
      if (pct > (t.maxTalentDominanceRate ?? 0.8)) warnings.push(`[${strategyId}] talent dominance: ${top.id} purchased in ${(pct * 100).toFixed(1)}% of builds`);
    }

    // Optional extra info for callers.
    void avgXp; void extractionRate; void avgQuests; void avgCrystalsUnspent;
  }
  return warnings;
}

/**
 * Sanity checks for run scale (biome model): total enemies too low, elites too low for quests, XP low for run size.
 * @param {object} report - resultsByStrategy
 * @param {object} [config] - optional runModel, thresholds
 * @returns {string[]}
 */
function buildRunScaleWarnings(report, config) {
  const warnings = [];
  const minTotalEnemies = config?.minAvgTotalEnemiesPerRun ?? 280;
  const minElitesPerRun = config?.minAvgElitesPerRun ?? 15;
  const minXpPerRunWhenLarge = config?.minAvgXpWhenRunLarge ?? 150;
  const largeRunEnemyThreshold = config?.largeRunEnemyThreshold ?? 280;

  for (const [strategyId, r] of Object.entries(report || {})) {
    const runAgg = r.runAgg || {};
    const runs = Math.max(1, runAgg.runs || 1);
    const comp = runAgg.runCompositionSum || {};
    const avgTotalEnemies = (comp.totalEnemies || 0) / runs;
    const avgElites = (comp.elites || 0) / runs;
    const avgXp = (runAgg.totalXp || 0) / runs;

    if (avgTotalEnemies > 0) {
      if (avgTotalEnemies < minTotalEnemies) {
        warnings.push(`[${strategyId}] full run enemy count far below observed scale: avg ${avgTotalEnemies.toFixed(0)} (expected ~280+)`);
      }
      if (avgElites < minElitesPerRun) {
        warnings.push(`[${strategyId}] elites per run too low to support elite quests: avg ${avgElites.toFixed(1)} (expected ${minElitesPerRun}+)`);
      }
      if (avgTotalEnemies >= largeRunEnemyThreshold && avgXp < minXpPerRunWhenLarge) {
        warnings.push(`[${strategyId}] XP per run too low for run size: avg ${avgXp.toFixed(0)} XP with ${avgTotalEnemies.toFixed(0)} enemies`);
      }
    }
  }
  return warnings;
}

/**
 * Warnings for profile comparison: questFocused below 60%/70%, passive completing too many mastery quests.
 * @param {object} resultsByProfile - map profileId -> { questStats, bucketStats }
 * @param {object} [thresholds]
 * @returns {string[]}
 */
function profileWarnings(resultsByProfile, thresholds) {
  const warnings = [];
  const t = thresholds || {};
  const min60 = t.questFocusedMinCompletion60 ?? 0.6;
  const min70 = t.questFocusedMinCompletion70 ?? 0.7;
  const passiveMaxMastery = t.passiveMaxMasteryCompletion ?? 0.3;

  for (const [profileId, r] of Object.entries(resultsByProfile || {})) {
    const questStats = r.questStats || {};
    const bucketStats = r.bucketStats || {};
    const numQuests = Object.keys(questStats).length;
    if (numQuests === 0) continue;
    let totalRate = 0;
    for (const stat of Object.values(questStats)) {
      const seen = Math.max(1, stat.seen || 1);
      totalRate += (stat.completed || 0) / seen;
    }
    const avgQuestCompletion = totalRate / numQuests;

    if (profileId === "questFocused") {
      if (avgQuestCompletion < min60) warnings.push("questFocused below 60% quest completion");
      if (avgQuestCompletion < min70) warnings.push("questFocused below 70% quest completion");
    }
    if (profileId === "passive") {
      const mastery = bucketStats.mastery;
      const masterySeen = Math.max(1, mastery?.seen || 1);
      const masteryRate = (mastery?.completed || 0) / masterySeen;
      if (masteryRate > passiveMaxMastery) warnings.push("passive completing too many mastery quests");
    }
  }
  return warnings;
}

/**
 * Summary for profile comparison: 70% achievable?, blocking quests, quest pool vs build size.
 * @param {object} resultsByProfile - map profileId -> { questStats, bucketStats, lifetimeAgg }
 * @param {object} [catalog] - talent catalog for cost estimate
 * @returns {{ seventyPercentAchievable: boolean, blockingQuestIds: string[], questPoolSupportsBuild: boolean, avgQuestCrystals: number, buildSizeTarget: number }}
 */
function buildProfileSummary(resultsByProfile, catalog) {
  const questFocused = resultsByProfile?.questFocused;
  if (!questFocused) {
    return { seventyPercentAchievable: false, blockingQuestIds: [], questPoolSupportsBuild: false, avgQuestCrystals: 0, buildSizeTarget: 15 };
  }
  const questStats = questFocused.questStats || {};
  const numQuests = Object.keys(questStats).length;
  let totalRate = 0;
  for (const stat of Object.values(questStats)) totalRate += (stat.seen > 0 ? (stat.completed || 0) / stat.seen : 0);
  const avgQuestCompletion = numQuests > 0 ? totalRate / numQuests : 0;
  const seventyPercentAchievable = avgQuestCompletion >= 0.7;

  const { bottom } = questCompletionTopBottom(questStats, 3);
  const blockingQuestIds = bottom.map((x) => x.id);

  const lifetimes = Math.max(1, questFocused.lifetimeAgg?.lifetimes || 1);
  const avgQuestCrystals = sumCrystals(questFocused.lifetimeAgg?.questCrystalsSum || {}) / lifetimes;
  const buildSizeTarget = 15;
  const avgCostPerTalent = 2;
  const crystalsNeeded = buildSizeTarget * avgCostPerTalent;
  const questPoolSupportsBuild = avgQuestCrystals >= crystalsNeeded * 0.5;

  return {
    seventyPercentAchievable,
    blockingQuestIds,
    questPoolSupportsBuild,
    avgQuestCrystals,
    buildSizeTarget,
  };
}

/**
 * Print per-profile section and summary when report contains resultsByProfile.
 * @param {{ resultsByProfile: object }} report - result of simulateProgression with profileComparison: true
 * @param {object} [catalog] - optional talent catalog for summary
 * @param {object} [thresholds] - for profileWarnings
 */
function printProfileComparisonReport(report, catalog, thresholds) {
  const byProfile = report.resultsByProfile || {};
  if (Object.keys(byProfile).length === 0) return;

  for (const [profileId, r] of Object.entries(byProfile)) {
    const lifetimes = Math.max(1, r.lifetimeAgg?.lifetimes || 1);
    const questStats = r.questStats || {};
    const numQuests = Object.keys(questStats).length;
    let totalRate = 0;
    for (const stat of Object.values(questStats)) {
      totalRate += (stat.seen > 0 ? (stat.completed || 0) / stat.seen : 0);
    }
    const avgQuestCompletionPct = numQuests > 0 ? (totalRate / numQuests) * 100 : 0;
    const bucketStats = r.bucketStats || {};
    const bucketRates = {};
    for (const [b, s] of Object.entries(bucketStats)) {
      bucketRates[b] = (s.seen > 0 ? ((s.completed || 0) / s.seen) * 100 : 0).toFixed(1);
    }
    const avgQuestCrystals = sumCrystals(r.lifetimeAgg?.questCrystalsSum || {}) / lifetimes;
    const avgLevelUpCrystals = sumCrystals(r.lifetimeAgg?.levelUpCrystalsSum || {}) / lifetimes;
    const avgTotalCrystals = sumCrystals(r.lifetimeAgg?.totalCrystalsEarnedSum || {}) / lifetimes;
    const avgFinalBuild = (r.lifetimeAgg?.finalBuildSize || 0) / lifetimes;
    const { top, bottom } = questCompletionTopBottom(questStats, 3);

    console.log("");
    console.log(`=== Profile: ${profileId} (20 runs per lifetime) ===`);
    console.log(`Avg quest completion: ${avgQuestCompletionPct.toFixed(1)}%`);
    console.log(`Completion by bucket: core ${bucketRates.core ?? "0"}% tactical ${bucketRates.tactical ?? "0"}% mastery ${bucketRates.mastery ?? "0"}%`);
    console.log(`Avg quest crystals: ${avgQuestCrystals.toFixed(2)} level-up: ${avgLevelUpCrystals.toFixed(2)} total: ${avgTotalCrystals.toFixed(2)}`);
    console.log(`Avg final build size (talents): ${avgFinalBuild.toFixed(2)}`);
    console.log("Top completed quests: " + top.map((x) => `${x.id} (${(x.rate * 100).toFixed(1)}%)`).join(", "));
    console.log("Least completed quests: " + bottom.map((x) => `${x.id} (${(x.rate * 100).toFixed(1)}%)`).join(", "));
  }

  const warnings = profileWarnings(byProfile, thresholds);
  if (warnings.length > 0) {
    console.log("");
    console.log("=== Profile warnings ===");
    for (const w of warnings) console.log(`- ${w}`);
  }

  const summary = buildProfileSummary(byProfile, catalog);
  console.log("");
  console.log("=== Summary ===");
  console.log(`70% quest completion in 20 runs achievable (questFocused): ${summary.seventyPercentAchievable ? "yes" : "no"}`);
  console.log(`Blocking quests (lowest completion): ${summary.blockingQuestIds.join(", ") || "n/a"}`);
  console.log(`Quest crystal pool supports ~${summary.buildSizeTarget} talent build: ${summary.questPoolSupportsBuild ? "yes" : "no"} (avg quest crystals: ${summary.avgQuestCrystals.toFixed(2)})`);
}

module.exports = {
  BRANCH_TO_CRYSTAL,
  BEHAVIOR_PROFILES,
  DEFAULT_BIOME_RUN_CONFIG,
  mulberry32,
  loadTalentCatalogFromSource,
  extractTalentTreeObject,
  summarizeCatalog,
  allocateAttributePoints,
  makeDefaultQuestDefs,
  getRunOverridesForProfile,
  generateBiomeRun,
  computeXpFromRun,
  simulateProgression,
  toTopNFrequencyMap,
  questCompletionTopBottom,
  buildWarnings,
  buildRunScaleWarnings,
  profileWarnings,
  buildProfileSummary,
  printProfileComparisonReport,
  defaultXpToNextLevel,
};

