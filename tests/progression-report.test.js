"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  loadTalentCatalogFromSource,
  makeDefaultQuestDefs,
  getRunOverridesForProfile,
  BEHAVIOR_PROFILES,
  simulateProgression,
  toTopNFrequencyMap,
  buildWarnings,
  buildRunScaleWarnings,
  profileWarnings,
  buildProfileSummary,
  printProfileComparisonReport,
} = require("./progression-simulator.js");

function fmt(n, digits = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "NaN";
  return x.toFixed(digits);
}

function printStrategyReport(r) {
  const runs = Math.max(1, r.runAgg.runs || 1);
  const lifetimes = Math.max(1, r.lifetimeAgg.lifetimes || 1);

  const avgXp = r.runAgg.totalXp / runs;
  const avgCrystals = r.runAgg.totalCrystals / runs;
  const avgQuests = r.runAgg.totalQuestsCompleted / runs;
  const extractionRate = r.runAgg.extracted / runs;
  const avgLevelGained = r.runAgg.totalLevelGained / runs;

  const avgFinalBuild = r.lifetimeAgg.finalBuildSize / lifetimes;
  const avgSpent = r.lifetimeAgg.spentCrystals / lifetimes;
  const avgUnspent = r.lifetimeAgg.unspentCrystals / lifetimes;
  const avgQuestCrystals = (r.lifetimeAgg.questCrystalsSum ? (
    r.lifetimeAgg.questCrystalsSum.orange +
    r.lifetimeAgg.questCrystalsSum.green +
    r.lifetimeAgg.questCrystalsSum.red +
    r.lifetimeAgg.questCrystalsSum.yellow
  ) : 0) / lifetimes;
  const avgQuestByColor = {
    orange: (r.lifetimeAgg.questCrystalsSum?.orange || 0) / lifetimes,
    green: (r.lifetimeAgg.questCrystalsSum?.green || 0) / lifetimes,
    red: (r.lifetimeAgg.questCrystalsSum?.red || 0) / lifetimes,
    yellow: (r.lifetimeAgg.questCrystalsSum?.yellow || 0) / lifetimes,
  };
  const avgLevelUpCrystals = (r.lifetimeAgg.levelUpCrystalsSum ? (
    r.lifetimeAgg.levelUpCrystalsSum.orange +
    r.lifetimeAgg.levelUpCrystalsSum.green +
    r.lifetimeAgg.levelUpCrystalsSum.red +
    r.lifetimeAgg.levelUpCrystalsSum.yellow
  ) : 0) / lifetimes;
  const avgTotalEarned = (r.lifetimeAgg.totalCrystalsEarnedSum ? (
    r.lifetimeAgg.totalCrystalsEarnedSum.orange +
    r.lifetimeAgg.totalCrystalsEarnedSum.green +
    r.lifetimeAgg.totalCrystalsEarnedSum.red +
    r.lifetimeAgg.totalCrystalsEarnedSum.yellow
  ) : 0) / lifetimes;

  console.log("");
  console.log(`=== Strategy: ${r.strategyId} ===`);
  console.log(`Talents in catalog: ${r.talentCatalogSize}`);
  if (r.catalogSummary?.byBranch) {
    const b = r.catalogSummary.byBranch;
    console.log(`Talents per branch: Brutality=${b.Brutality} Agility=${b.Agility} Vitality=${b.Vitality} Luck=${b.Luck}`);
  }
  if (r.catalogSummary?.byCost) {
    const entries = Object.entries(r.catalogSummary.byCost).sort((a, b) => Number(a[0]) - Number(b[0]));
    console.log(`Talents per cost bucket: ${entries.map(([c, n]) => `cost${c}=${n}`).join(" ")}`);
  }
  console.log(`Run sims: ${runs}, Lifetime sims: ${lifetimes}`);
  const comp = r.runAgg.runCompositionSum;
  if (comp && (comp.totalEnemies > 0 || comp.elites > 0)) {
    const runsDenom = runs;
    const avgTotalEnemies = comp.totalEnemies / runsDenom;
    const avgElites = comp.elites / runsDenom;
    const avgSpecials = comp.specials / runsDenom;
    const avgMiniBosses = comp.miniBosses / runsDenom;
    const avgChests = comp.chests / runsDenom;
    const avgBossPresent = comp.bossPresent / runsDenom;
    const perBiomeSum = comp.perBiomeSum;
    if (Array.isArray(perBiomeSum) && perBiomeSum.length > 0) {
      let totalPerBiomeEnemies = 0;
      for (let b = 0; b < perBiomeSum.length; b++) totalPerBiomeEnemies += (perBiomeSum[b]?.totalEnemies || 0);
      if (totalPerBiomeEnemies > 0) {
        const nBiomes = perBiomeSum.length;
        let sumTe = 0, sumEl = 0, sumSp = 0, sumMb = 0, sumCh = 0;
        for (let b = 0; b < nBiomes; b++) {
          const s = perBiomeSum[b] || {};
          sumTe += (s.totalEnemies || 0) / runsDenom;
          sumEl += (s.elites || 0) / runsDenom;
          sumSp += (s.specials || 0) / runsDenom;
          sumMb += (s.miniBosses || 0) / runsDenom;
          sumCh += (s.chests || 0) / runsDenom;
        }
        console.log(`Run composition (avg per biome): totalEnemies=${fmt(sumTe / nBiomes, 0)} elites=${fmt(sumEl / nBiomes, 1)} specials=${fmt(sumSp / nBiomes, 1)} miniBosses=${fmt(sumMb / nBiomes, 1)} chests=${fmt(sumCh / nBiomes, 1)}`);
      }
    }
    console.log(`Run composition (avg per run): totalEnemies=${fmt(avgTotalEnemies, 0)} elites=${fmt(avgElites, 1)} specials=${fmt(avgSpecials, 1)} miniBosses=${fmt(avgMiniBosses, 1)} chests=${fmt(avgChests, 1)} bossPresent=${fmt(avgBossPresent, 2)}`);
  }
  console.log(`Run metrics: avgXP=${fmt(avgXp)} avgCrystals=${fmt(avgCrystals)} avgQuests=${fmt(avgQuests)} extractionRate=${fmt(extractionRate, 3)} avgLevelGain=${fmt(avgLevelGained)}`);
  console.log(`Lifetime metrics: avgFinalBuild=${fmt(avgFinalBuild)} avgCrystalsSpent=${fmt(avgSpent)} avgCrystalsUnspent=${fmt(avgUnspent)}`);
  console.log(`Lifetime quest crystals: avgTotal=${fmt(avgQuestCrystals)} avgByColor={o:${fmt(avgQuestByColor.orange,1)} g:${fmt(avgQuestByColor.green,1)} r:${fmt(avgQuestByColor.red,1)} y:${fmt(avgQuestByColor.yellow,1)}}`);
  console.log(`Lifetime level-up crystals: avgTotal=${fmt(avgLevelUpCrystals)}`);
  console.log(`Lifetime total crystals available (base+quests+levelUps): avgTotal=${fmt(avgTotalEarned)}`);

  // Milestones: averaged over lifetimes that reached the milestone (sample count printed)
  const ms = r.lifetimeAgg.milestones;
  for (const k of [5, 10, 15, 20]) {
    const bucket = ms[String(k)];
    const samples = Math.max(0, Number(bucket?.samples) || 0);
    const denom = Math.max(1, samples);
    console.log(
      `After ${k} successful extractions: avgLevel=${fmt((bucket.levelSum || 0) / denom)} avgCrystals=${fmt((bucket.crystalsSum || 0) / denom)} avgTalents=${fmt((bucket.talentsSum || 0) / denom)} (n=${samples})`
    );
  }

  const byAttr = r.lifetimeAgg.purchasedCountsByBranch;
  console.log(`Avg talents by attribute: Brutality=${fmt(byAttr.Brutality / lifetimes)} Agility=${fmt(byAttr.Agility / lifetimes)} Vitality=${fmt(byAttr.Vitality / lifetimes)} Luck=${fmt(byAttr.Luck / lifetimes)}`);

  const byCost = r.lifetimeAgg.purchasedCountsByCost;
  console.log(`Avg talents by cost: cost1=${fmt((byCost[1] || 0) / lifetimes)} cost2=${fmt((byCost[2] || 0) / lifetimes)} cost3=${fmt((byCost[3] || 0) / lifetimes)}`);

  console.log("Quest completion rates:");
  for (const q of r.questDefs) {
    const stat = r.questStats[q.id];
    const seen = Math.max(1, stat?.seen || 1);
    const rate = (stat?.completed || 0) / seen;
    console.log(`- ${q.id}: ${(rate * 100).toFixed(1)}%`);
  }

  const top10 = toTopNFrequencyMap(r.lifetimeAgg.purchasedFrequency, 10);
  console.log("Top 10 purchased talents (by #lifetimes containing the talent):");
  for (const t of top10) {
    const pct = (t.count / lifetimes) * 100;
    console.log(`- ${t.id}: ${t.count} (${pct.toFixed(1)}%)`);
  }

  // Build-target analysis
  const bt = r.lifetimeAgg.buildTargets || {};
  const hitRate = (n) => {
    const b = bt[String(n)] || bt[n];
    const samples = Number(b?.samples) || 0;
    const hits = Number(b?.hits) || 0;
    return samples > 0 ? (hits / samples) : 0;
  };
  console.log(`Build target hit rates (final talents): >=15=${(hitRate(15) * 100).toFixed(1)}% >=18=${(hitRate(18) * 100).toFixed(1)}% >=20=${(hitRate(20) * 100).toFixed(1)}%`);
}

describe("Progression balance report (deterministic)", () => {
  it("prints a readable summary and emits warnings/assertions", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const talentCatalog = loadTalentCatalogFromSource(repoRoot);
    const questDefs = makeDefaultQuestDefs();

    const common = {
      repoRoot,
      seed: 1337,
      singleRuns: 1000, // required
      lifetimes: 100, // required
      runsPerLifetimeMin: 20,
      runsPerLifetimeMax: 30,

      extractionSuccessRate: 0.65,
      bossFightRate: 0.9,
      bossDashRate: 0.35,
      bossHitRate: 0.25,

      enemyComposition: {
        elitesAvg: 14,
        elitesJitter: 8,
        chestsAvg: 12,
        chestsJitter: 8,
      },

      xpModel: {
        baseXpPerRun: 20,
        xpPerElite: 2,
        xpPerChest: 1,
        bossBonusXp: 25,
      },

      questDefs,
      talentCatalog,
      attributeAllocationPolicy: { mode: "balanced" },
      strategies: ["greedyCheap", "balanced", "keystoneFocused"],
    };

    const models = [
      {
        id: "Model A (baseline only)",
        cfg: { ...common, baseCrystalsPerExtraction: { orange: 1, green: 1, red: 1, yellow: 1 } },
      },
      {
        id: "Model B (level-ups only)",
        cfg: { ...common, baseCrystalsPerExtraction: { orange: 0, green: 0, red: 0, yellow: 0 } },
      },
      {
        id: "Model C (reduced baseline + level-ups)",
        cfg: { ...common, baseCrystalsPerExtraction: { orange: 0, green: 0, red: 0, yellow: 0 } },
      },
    ];

    for (const m of models) {
      console.log("");
      console.log(`############################`);
      console.log(`# ${m.id}`);
      console.log(`# attributeAllocationPolicy=${JSON.stringify(common.attributeAllocationPolicy)}`);
      console.log(`############################`);
      const report = simulateProgression(m.cfg);

      for (const r of Object.values(report)) {
        printStrategyReport(r);
      }

      const warnings = buildWarnings(report, {
      minAvgCrystalsPerRun: 1,
      maxAvgCrystalsPerRun: 6,
      minAvgFinalBuildAfterLifetime: 12,
      maxAvgFinalBuildAfterLifetime: 25,
      minAvgQuestCrystalsPerLifetime: 3,
      maxAvgQuestCrystalsPerLifetime: 80,
      maxAvgTotalCrystalsPerLifetime: 200,
      maxQuestColorSpread: 8,
      minQuestCompletionRate: 0.005,
      maxQuestCompletionRate: 0.8,
      maxTalentDominanceRate: 0.8,
      // new warnings:
      maxTalentsAfter10Extractions: 25,
      maxBaselineDominanceRatio: 0.5,
      minAvgLevelUpCrystalsPerLifetime: 5,
      });

      if (warnings.length > 0) {
        console.log("");
        console.log("=== Balance warnings ===");
        for (const w of warnings) console.log(`- ${w}`);
      }
      const runScaleWarnings = buildRunScaleWarnings(report, m.cfg);
      if (runScaleWarnings.length > 0) {
        console.log("");
        console.log("=== Run scale warnings ===");
        for (const w of runScaleWarnings) console.log(`- ${w}`);
      }

      // Assertions: keep these as “hard stops” for egregious issues.
      for (const r of Object.values(report)) {
        const runs = Math.max(1, r.runAgg.runs || 1);
        const avgCrystals = r.runAgg.totalCrystals / runs;
        assert.ok(avgCrystals >= 0, `[${r.strategyId}] avgCrystals/run invalid`);
        assert.ok(avgCrystals < 20, `[${r.strategyId}] avgCrystals/run excessively high: ${avgCrystals}`);
      }

      // Milestone monotonicity (only compare when both have samples).
      for (const r of Object.values(report)) {
        const ms = r.lifetimeAgg.milestones;
        const keys = [5, 10, 15, 20];
        const avgTalents = (k) => {
          const b = ms[String(k)];
          const n = Number(b?.samples) || 0;
          if (n <= 0) return null;
          return (Number(b.talentsSum) || 0) / n;
        };
        for (let i = 1; i < keys.length; i++) {
          const prev = avgTalents(keys[i - 1]);
          const cur = avgTalents(keys[i]);
          if (prev == null || cur == null) continue;
          // Allow small sampling variance at later milestones (fewer samples).
          assert.ok(cur >= prev - 0.5, `[${r.strategyId}] milestone talents not monotonic: ${keys[i - 1]}=${prev} ${keys[i]}=${cur}`);
        }
      }
    }
  });
});

describe("Profile comparison and run overrides", () => {
  it("getRunOverridesForProfile reduces bossDashRate for questFocused when dashless quest incomplete", () => {
    const config = { behaviorProfile: "questFocused", bossDashRate: 0.35, bossHitRate: 0.25 };
    const questStateIncomplete = {
      progressById: { q_dashless_boss: { completed: false }, q_flawless_boss: { completed: false } },
      streaks: { extractionStreak: 0 },
    };
    const overrides = getRunOverridesForProfile(config, questStateIncomplete);
    assert.strictEqual(overrides.bossDashRate, 0.15);
    assert.strictEqual(overrides.bossHitRate, 0.10);

    const questStateDashlessDone = {
      progressById: { q_dashless_boss: { completed: true }, q_flawless_boss: { completed: false } },
      streaks: { extractionStreak: 0 },
    };
    const overrides2 = getRunOverridesForProfile(config, questStateDashlessDone);
    assert.strictEqual(overrides2.bossDashRate, 0.35);
  });

  it("profile comparison returns resultsByProfile with passive, balanced, questFocused and bucket stats", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const report = simulateProgression({
      repoRoot,
      seed: 9999,
      profileComparison: true,
      lifetimes: 5,
      runsPerLifetimeMin: 20,
      runsPerLifetimeMax: 20,
      enemyComposition: { elitesAvg: 12, elitesJitter: 4, chestsAvg: 10, chestsJitter: 4 },
      extractionSuccessRate: 0.65,
      bossFightRate: 0.9,
      bossDashRate: 0.35,
      bossHitRate: 0.25,
      questDefs: makeDefaultQuestDefs(),
    });
    assert.ok(report.resultsByProfile, "resultsByProfile present");
    for (const profile of BEHAVIOR_PROFILES) {
      assert.ok(report.resultsByProfile[profile], `profile ${profile} present`);
      const r = report.resultsByProfile[profile];
      assert.ok(r.questStats && typeof r.questStats === "object", `${profile} has questStats`);
      assert.ok(r.bucketStats && r.bucketStats.core != null && r.bucketStats.mastery != null, `${profile} has bucketStats`);
      assert.ok(r.lifetimeAgg && r.lifetimeAgg.lifetimes === 5, `${profile} has lifetimeAgg with 5 lifetimes`);
    }
    const passive = report.resultsByProfile.passive;
    const questFocused = report.resultsByProfile.questFocused;
    let passiveRate = 0;
    let qfRate = 0;
    const n = Object.keys(passive.questStats).length;
    assert.ok(n > 0);
    for (const qid of Object.keys(passive.questStats)) {
      passiveRate += (passive.questStats[qid].seen > 0 ? passive.questStats[qid].completed / passive.questStats[qid].seen : 0);
      qfRate += (questFocused.questStats[qid].seen > 0 ? questFocused.questStats[qid].completed / questFocused.questStats[qid].seen : 0);
    }
    passiveRate /= n;
    qfRate /= n;
    assert.ok(qfRate >= passiveRate - 0.01, "questFocused avg completion should be >= passive (sanity)");
  });

  it("profileWarnings and buildProfileSummary run without throwing", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const report = simulateProgression({
      repoRoot,
      seed: 8888,
      profileComparison: true,
      lifetimes: 3,
      questDefs: makeDefaultQuestDefs(),
    });
    const warnings = profileWarnings(report.resultsByProfile, { questFocusedMinCompletion70: 0.7, passiveMaxMasteryCompletion: 0.3 });
    assert.ok(Array.isArray(warnings));
    const summary = buildProfileSummary(report.resultsByProfile);
    assert.ok(typeof summary.seventyPercentAchievable === "boolean");
    assert.ok(Array.isArray(summary.blockingQuestIds));
    assert.ok(typeof summary.questPoolSupportsBuild === "boolean");
  });
});

describe("Biome-scale progression (Models B and C)", () => {
  it("runs Models B and C with 4-biome run scale and prints progression metrics + summary", () => {
    const repoRoot = "c:\\Users\\2jonl\\Extract-Da-Panda";
    const talentCatalog = loadTalentCatalogFromSource(repoRoot);
    const questDefs = makeDefaultQuestDefs();

    const biomeCommon = {
      repoRoot,
      seed: 4242,
      singleRuns: 500,
      lifetimes: 80,
      runsPerLifetimeMin: 20,
      runsPerLifetimeMax: 25,
      runModel: "biome",
      biomeRun: {
        biomes: 4,
        biomeEnemiesMin: 70,
        biomeEnemiesMax: 100,
        ratioMinions: 0.70,
        ratioElites: 0.20,
        ratioSpecials: 0.08,
        ratioMiniBosses: 0.02,
        chestsPerBiomeMin: 5,
        chestsPerBiomeMax: 10,
      },
      xpModel: {
        baseXpPerRun: 0,
        xpPerEnemy: 15,
        xpPerElite: 40,
        xpPerSpecial: 35,
        xpPerMiniBoss: 70,
        xpPerChest: 2,
        bossBonusXp: 200,
      },
      extractionSuccessRate: 0.65,
      bossFightRate: 0.9,
      bossDashRate: 0.35,
      bossHitRate: 0.25,
      questDefs,
      talentCatalog,
      attributeAllocationPolicy: { mode: "balanced" },
      strategies: ["greedyCheap"],
    };

    const biomeModels = [
      { id: "Model B (biome scale, level-ups only)", cfg: { ...biomeCommon, baseCrystalsPerExtraction: { orange: 0, green: 0, red: 0, yellow: 0 } } },
      { id: "Model C (biome scale, no baseline)", cfg: { ...biomeCommon, baseCrystalsPerExtraction: { orange: 0, green: 0, red: 0, yellow: 0 } } },
    ];

    for (const m of biomeModels) {
      console.log("");
      console.log("############################");
      console.log(`# ${m.id}`);
      console.log("############################");
      const report = simulateProgression(m.cfg);
      const r = Object.values(report)[0];
      const runs = Math.max(1, r.runAgg.runs || 1);
      const lifetimes = Math.max(1, r.lifetimeAgg.lifetimes || 1);
      const comp = r.runAgg.runCompositionSum || {};

      console.log("");
      console.log("--- Run composition ---");
      const perBiomeSum = comp.perBiomeSum;
      if (Array.isArray(perBiomeSum) && perBiomeSum.length > 0) {
        const nBiomes = perBiomeSum.length;
        let sumTe = 0, sumEl = 0, sumSp = 0, sumMb = 0, sumCh = 0;
        for (let b = 0; b < nBiomes; b++) {
          const s = perBiomeSum[b] || {};
          sumTe += (s.totalEnemies || 0) / runs;
          sumEl += (s.elites || 0) / runs;
          sumSp += (s.specials || 0) / runs;
          sumMb += (s.miniBosses || 0) / runs;
          sumCh += (s.chests || 0) / runs;
        }
        console.log(`Avg per biome: totalEnemies=${fmt(sumTe / nBiomes, 0)} elites=${fmt(sumEl / nBiomes, 1)} specials=${fmt(sumSp / nBiomes, 1)} miniBosses=${fmt(sumMb / nBiomes, 1)} chests=${fmt(sumCh / nBiomes, 1)}`);
      }
      console.log(`Avg per run: totalEnemies=${fmt((comp.totalEnemies || 0) / runs, 0)} elites=${fmt((comp.elites || 0) / runs, 1)} specials=${fmt((comp.specials || 0) / runs, 1)} miniBosses=${fmt((comp.miniBosses || 0) / runs, 1)} chests=${fmt((comp.chests || 0) / runs, 1)} bossPresent=${fmt((comp.bossPresent || 0) / runs, 2)}`);
      console.log("");
      console.log("--- Progression ---");
      console.log(`avg XP per run: ${fmt(r.runAgg.totalXp / runs, 1)}`);
      const ms = r.lifetimeAgg.milestones;
      for (const k of [5, 10, 15, 20]) {
        const b = ms[String(k)];
        const n = Math.max(1, b?.samples || 0);
        console.log(`avg level after ${k} extractions: ${fmt((b?.levelSum || 0) / n, 2)} (n=${b?.samples ?? 0})`);
      }
      console.log(`avg crystals from levels (per lifetime): ${fmt((r.lifetimeAgg.levelUpCrystalsSum ? (r.lifetimeAgg.levelUpCrystalsSum.orange + r.lifetimeAgg.levelUpCrystalsSum.green + r.lifetimeAgg.levelUpCrystalsSum.red + r.lifetimeAgg.levelUpCrystalsSum.yellow) : 0) / lifetimes, 2)}`);
      console.log(`avg crystals from quests (per lifetime): ${fmt((r.lifetimeAgg.questCrystalsSum ? (r.lifetimeAgg.questCrystalsSum.orange + r.lifetimeAgg.questCrystalsSum.green + r.lifetimeAgg.questCrystalsSum.red + r.lifetimeAgg.questCrystalsSum.yellow) : 0) / lifetimes, 2)}`);
      console.log(`avg final build size (talents): ${fmt(r.lifetimeAgg.finalBuildSize / lifetimes, 2)}`);
      console.log(`avg total crystals available (per lifetime): ${fmt((r.lifetimeAgg.totalCrystalsEarnedSum ? (r.lifetimeAgg.totalCrystalsEarnedSum.orange + r.lifetimeAgg.totalCrystalsEarnedSum.green + r.lifetimeAgg.totalCrystalsEarnedSum.red + r.lifetimeAgg.totalCrystalsEarnedSum.yellow) : 0) / lifetimes, 2)}`);

      const runWarn = buildRunScaleWarnings(report, m.cfg);
      if (runWarn.length > 0) {
        console.log("");
        console.log("Run scale warnings:");
        runWarn.forEach((w) => console.log(`- ${w}`));
      }
    }

    console.log("");
    console.log("=== Summary (observed biome scale) ===");
    const reportB = simulateProgression({ ...biomeModels[0].cfg, seed: 4242 });
    const rB = Object.values(reportB)[0];
    const runsB = Math.max(1, rB.runAgg.runs);
    const compB = rB.runAgg.runCompositionSum || {};
    const perBiomeB = compB.perBiomeSum;
    const avgEnemiesPerRun = (compB.totalEnemies || 0) / runsB;
    const avgElites = (compB.elites || 0) / runsB;
    const avgChests = (compB.chests || 0) / runsB;
    let avgEnemiesPerBiome = 0;
    if (Array.isArray(perBiomeB) && perBiomeB.length > 0) {
      for (let b = 0; b < perBiomeB.length; b++) {
        avgEnemiesPerBiome += (perBiomeB[b]?.totalEnemies || 0) / runsB;
      }
      avgEnemiesPerBiome /= perBiomeB.length;
    }
    const avgFinalBuild = rB.lifetimeAgg.finalBuildSize / Math.max(1, rB.lifetimeAgg.lifetimes);
    console.log(`New average biome composition: ~${fmt(avgEnemiesPerBiome, 0)} enemies per biome (70-100 range).`);
    console.log(`New average full run composition: ~${fmt(avgEnemiesPerRun, 0)} total enemies, ~${fmt(avgElites, 0)} elites, ~${fmt(avgChests, 0)} chests (4 biomes + boss).`);
    console.log(`Elite/chest quests: q_elites_20 and q_chests_15 are ${avgElites >= 20 && avgChests >= 15 ? "achievable in a single run" : "within 1-2 runs"} at this scale.`);
    console.log(`Progression: avg XP/run=${fmt(rB.runAgg.totalXp / runsB, 0)}; avg final build (Model B)=${fmt(avgFinalBuild, 1)} talents.`);
    console.log(`15-20 talent target: ${avgFinalBuild >= 15 ? "met on average" : avgFinalBuild >= 12 ? "close; consider tuning XP or quest crystals" : "below target; progression may need economy tuning"} (avg ${fmt(avgFinalBuild, 1)} talents).`);
  });
});

