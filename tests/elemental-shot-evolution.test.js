"use strict";

const { beforeEach, describe, it } = require("node:test");
const assert = require("node:assert");

function createMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

beforeEach(() => {
  global.localStorage = createMemoryLocalStorage();
});

describe("Elemental Shot – evolution state / profile", () => {
  it("evolution state: first and second set formId", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const ctx = { elementalShotEvolutionFirst: "damage", elementalShotEvolutionSecond: "rhythm" };
    const state = evolution.getElementalShotEvolutionState(ctx);
    assert.strictEqual(state.first, "damage");
    assert.strictEqual(state.second, "rhythm");
    assert.strictEqual(state.formId, "damage_rhythm");
  });

  it("evolution state: accepts plain state object", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = evolution.getElementalShotEvolutionState({ first: "control", second: "elemental" });
    assert.strictEqual(state.first, "control");
    assert.strictEqual(state.second, "elemental");
    assert.strictEqual(state.formId, "control_elemental");
  });

  it("first evolution mapping: damage → Inferno Core (fire defaultElement)", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "damage", second: null, formId: "damage" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "fire");
    assert.strictEqual(profile.formId, "inferno_core");
    assert.strictEqual(profile.projectileMods.fireExplosionDamageRatio, 0.6);
    assert.strictEqual(profile.projectileMods.fireExplosionRadiusMult, 1.33);
    assert.strictEqual(profile.elementalInteractions.burnDamageMult, 2);
    assert.strictEqual(profile.elementalInteractions.burnStackLimit, 3);
  });

  it("first evolution mapping: rhythm → Storm Engine (lightning defaultElement)", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "rhythm", second: null, formId: "rhythm" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "fire");
    assert.strictEqual(profile.formId, "storm_engine");
    assert.strictEqual(profile.projectileMods.lightningChainCountBase, 4);
    assert.strictEqual(profile.projectileMods.lightningSpeedMult, 2);
    assert.strictEqual(profile.links.lightningFeedsCharge, true);
  });

  it("first evolution mapping: control → Tempest Arc (wind defaultElement)", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "control", second: null, formId: "control" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "fire");
    assert.strictEqual(profile.formId, "tempest_arc");
    assert.strictEqual(profile.projectileMods.windArcWidthMult, 1.5);
    assert.strictEqual(profile.links.windKnockbackForce, 150);
    assert.strictEqual(profile.links.windPullToCenter, true);
  });

  it("first evolution mapping: elemental → Prismatic Cycle (fire default)", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "elemental", second: null, formId: "elemental" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "fire");
    assert.strictEqual(profile.formId, "prismatic_cycle");
    assert.strictEqual(profile.surgeBehavior.durationSec, 4.5);
    assert.strictEqual(profile.elementalInteractions.burnConsumedOnDetonate, false);
    assert.strictEqual(profile.links.surgeStartFireExplosion, true);
    assert.strictEqual(profile.links.surgeStartWindPush, true);
    assert.strictEqual(profile.links.surgeStartLightningStrike, true);
  });

  it("damage_damage → meteor attackMode", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "damage", second: "damage", formId: "damage_damage" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.attackMode, "meteor");
    assert.strictEqual(profile.formId, "meteorfall");
    assert.strictEqual(profile.defaultElement, "fire");
  });

  it("rhythm_control → storm_circle flags (spawnStorm, stormSlow, burnDetonate)", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "rhythm", second: "control", formId: "rhythm_control" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.formId, "storm_circle");
    assert.strictEqual(profile.environment.spawnStorm, true);
    assert.strictEqual(profile.environment.stormSlow, true);
    assert.strictEqual(profile.elementalInteractions.burnDetonate, true);
    assert.strictEqual(profile.elementalInteractions.burnConsumedOnDetonate, true);
  });

  it("rhythm_elemental → defaultElement lightning + modifier surge behavior", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "rhythm", second: "elemental", formId: "rhythm_elemental" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "lightning");
    assert.strictEqual(profile.formId, "overcharged_core");
    assert.strictEqual(profile.surgeBehavior.type, "modifier");
    assert.ok(profile.links.windBuffsAttackSpeed === true);
  });

  it("control_rhythm → wind-only surge + stun + fire explosion linkage", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "control", second: "rhythm", formId: "control_rhythm" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.formId, "thunder_gale");
    assert.deepStrictEqual(profile.surgeBehavior.elements, ["fire", "wind"]);
    assert.strictEqual(profile.elementalInteractions.stunChance, 1);
    assert.strictEqual(profile.links.fireExplosionOnWindHit, true);
  });

  it("control_control → volley + bounce", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "control", second: "control", formId: "control_control" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.attackMode, "volley");
    assert.strictEqual(profile.formId, "razor_tempest");
    assert.ok(profile.projectileMods.razorTempestVolley === true);
  });

  it("control_elemental → wind default + swirl flags", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "control", second: "elemental", formId: "control_elemental" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "wind");
    assert.strictEqual(profile.formId, "elemental_cyclone");
    assert.strictEqual(profile.environment.spawnSwirl, true);
    assert.strictEqual(profile.environment.swirlFirestorm, true);
    assert.strictEqual(profile.environment.swirlLightningSplit, true);
  });

  it("elemental_elemental → multi surge + simultaneousElements", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "elemental", second: "elemental", formId: "elemental_elemental" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.formId, "prismatic_surge");
    assert.strictEqual(profile.surgeBehavior.type, "multi");
    assert.strictEqual(profile.elementalInteractions.simultaneousElements, true);
  });

  it("deep merge: nested fields from first + second both survive", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "control", second: "control", formId: "control_control" };
    const profile = evolution.getElementalShotProfile(state);
    assert.ok(profile.projectileMods.razorTempestVolley === true);
    assert.strictEqual(profile.defaultElement, "fire");
    assert.ok(profile.projectileMods.speedMult !== undefined);
    assert.ok(profile.environment.spawnStorm === false);
  });

  it("safe defaults: no evolution returns base profile without crashes", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: null, second: null };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.formId, "base");
    assert.strictEqual(profile.attackMode, "projectile");
    assert.strictEqual(profile.defaultElement, "fire");
    assert.strictEqual(profile.surgeBehavior.type, "normal");
    assert.deepStrictEqual(profile.surgeBehavior.elements, ["wind", "lightning"]);
    assert.strictEqual(profile.surgeBehavior.durationSec, 3);
    assert.ok(typeof profile.projectileMods === "object");
    assert.ok(typeof profile.elementalInteractions === "object");
    assert.ok(typeof profile.environment === "object");
    assert.ok(typeof profile.links === "object");
  });

  it("safe defaults: unknown first returns base", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "unknown", second: null };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.formId, "base");
    assert.strictEqual(profile.attackMode, "projectile");
  });

  it("getElementalShotEvolutionDebugInfo returns readable subset and first-evo fields", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const ctx = { first: "damage", second: "damage" };
    const info = evolution.getElementalShotEvolutionDebugInfo(ctx);
    assert.strictEqual(info.first, "damage");
    assert.strictEqual(info.second, "damage");
    assert.strictEqual(info.formId, "meteorfall");
    assert.strictEqual(info.attackMode, "meteor");
    assert.ok(info.surgeBehavior !== undefined);
    assert.ok(info.projectileMods !== undefined);
    assert.ok(info.elementalInteractions !== undefined);
    assert.ok(info.environment !== undefined);
    assert.ok(info.links !== undefined);
    assert.strictEqual(info.surgeDurationSec, 3);
    assert.ok(info.burnStackLimit !== undefined);
    assert.ok(info.lightningChainCountBase !== undefined);
    assert.ok(info.windArcWidthMult !== undefined);
  });

  it("getElementalShotEvolutionDebugInfo first-only shows firstEvolutionFormId and surge duration", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const ctx = { first: "elemental", second: null };
    const info = evolution.getElementalShotEvolutionDebugInfo(ctx);
    assert.strictEqual(info.first, "elemental");
    assert.strictEqual(info.second, null);
    assert.strictEqual(info.formId, "prismatic_cycle");
    assert.strictEqual(info.firstEvolutionFormId, "prismatic_cycle");
    assert.strictEqual(info.surgeDurationSec, 4.5);
    assert.strictEqual(info.burnStackLimit, 1);
  });

  it("getElementalShotEvolutionDebugInfo accepts game-like object", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const game = { elementalShotEvolutionFirst: "rhythm", elementalShotEvolutionSecond: "elemental" };
    const info = evolution.getElementalShotEvolutionDebugInfo(game);
    assert.strictEqual(info.first, "rhythm");
    assert.strictEqual(info.second, "elemental");
    assert.strictEqual(info.formId, "overcharged_core");
  });
});

describe("Elemental Shot – upgrade system (category counts, pool)", () => {
  it("getElementalShotUpgradeCategoryCounts returns zeros when not projectile", async () => {
    const levelUp = await import("../src/data/level-up-data.js");
    const game = { attackType: "soulSiphon", runAttackUpgrades: [{ id: "soul_pressure", category: "power", level: 1 }] };
    const counts = levelUp.getElementalShotUpgradeCategoryCounts(game);
    assert.strictEqual(counts.damage, 0);
    assert.strictEqual(counts.rhythm, 0);
    assert.strictEqual(counts.control, 0);
    assert.strictEqual(counts.elemental, 0);
  });

  it("getElementalShotUpgradeCategoryCounts sums stacks by category for projectile", async () => {
    const levelUp = await import("../src/data/level-up-data.js");
    const game = {
      attackType: "projectile",
      runAttackUpgrades: [
        { id: "elemental_damage", category: "damage", level: 2 },
        { id: "attack_speed", category: "rhythm", level: 1 },
        { id: "crit_chance", category: "elemental", level: 1 }
      ]
    };
    const counts = levelUp.getElementalShotUpgradeCategoryCounts(game);
    assert.strictEqual(counts.damage, 2);
    assert.strictEqual(counts.rhythm, 1);
    assert.strictEqual(counts.control, 0);
    assert.strictEqual(counts.elemental, 1);
  });

  it("getElementalShotDominantCategories returns first and second by count", async () => {
    const levelUp = await import("../src/data/level-up-data.js");
    const counts = { damage: 3, rhythm: 2, control: 1, elemental: 2 };
    const [first, second] = levelUp.getElementalShotDominantCategories(counts);
    assert.strictEqual(first, "damage");
    assert.strictEqual(second, "rhythm");
  });

  it("elementalShot pool has 23 standard upgrades with rarity and category", async () => {
    const levelUp = await import("../src/data/level-up-data.js");
    const defs = levelUp.ATTACK_UPGRADE_DEFS.elementalShot;
    const pool = defs?.standardUpgrades || [];
    assert.strictEqual(pool.length, 23);
    const ids = new Set(pool.map((u) => u.id));
    const required = [
      "elemental_damage", "burning_power", "burn_hunter", "attack_speed", "projectile_speed", "elemental_charge",
      "range_boost", "spread_reduction", "crit_chance", "lightning_conduction", "wind_bleed",
      "extra_projectile", "faster_charge", "fire_explosion", "detonation_boost", "wind_force", "seeking", "chain_lightning", "explosive_burn",
      "inferno", "elemental_overdrive", "storm_wind", "superstorm"
    ];
    for (const id of required) {
      assert.ok(ids.has(id), `missing upgrade: ${id}`);
    }
    for (const u of pool) {
      assert.ok(["common", "uncommon", "rare"].includes(u.rarity), `${u.id} has rarity ${u.rarity}`);
      assert.ok(["damage", "rhythm", "control", "elemental"].includes(u.category), `${u.id} has category ${u.category}`);
    }
  });

  it("getElementalShotDominantCategories tie-break: damage before rhythm when counts equal", async () => {
    const levelUp = await import("../src/data/level-up-data.js");
    const counts = { damage: 2, rhythm: 2, control: 0, elemental: 0 };
    const [first, second] = levelUp.getElementalShotDominantCategories(counts);
    assert.strictEqual(first, "damage");
    assert.strictEqual(second, "rhythm");
  });
});

describe("Elemental Shot – evolution state and profile wiring", () => {
  it("getElementalShotEvolutionState reads game elementalShotEvolutionFirst/Second", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const game = { elementalShotEvolutionFirst: "damage", elementalShotEvolutionSecond: "damage" };
    const state = evolution.getElementalShotEvolutionState(game);
    assert.strictEqual(state.first, "damage");
    assert.strictEqual(state.second, "damage");
    assert.strictEqual(state.formId, "damage_damage");
  });

  it("getElementalShotProfile damage_damage returns meteor attackMode", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "damage", second: "damage", formId: "damage_damage" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.attackMode, "meteor");
    assert.strictEqual(profile.formId, "meteorfall");
  });

  it("getElementalShotProfile control_rhythm returns wind-only surge and stun link", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "control", second: "rhythm", formId: "control_rhythm" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.defaultElement, "fire");
    assert.deepStrictEqual(profile.surgeBehavior.elements, ["fire", "wind"]);
    assert.strictEqual(profile.elementalInteractions.stunChance, 1);
    assert.strictEqual(profile.links.fireExplosionOnWindHit, true);
  });

  it("getElementalShotProfile elemental_elemental returns multi surge and simultaneousElements", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "elemental", second: "elemental", formId: "elemental_elemental" };
    const profile = evolution.getElementalShotProfile(state);
    assert.strictEqual(profile.surgeBehavior.type, "multi");
    assert.strictEqual(profile.elementalInteractions.simultaneousElements, true);
  });

  it("resolveElementalShotDominantCategories alias matches getElementalShotDominantCategories", async () => {
    const levelUp = await import("../src/data/level-up-data.js");
    const counts = { damage: 1, rhythm: 3, control: 2, elemental: 0 };
    const [f1, s1] = levelUp.getElementalShotDominantCategories(counts);
    const [f2, s2] = levelUp.resolveElementalShotDominantCategories(counts);
    assert.strictEqual(f1, f2);
    assert.strictEqual(s1, s2);
  });

  it("getElementalShotResolvedEvolutionState alias matches getElementalShotEvolutionState", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const game = { elementalShotEvolutionFirst: "control", elementalShotEvolutionSecond: "elemental" };
    const state1 = evolution.getElementalShotEvolutionState(game);
    const state2 = evolution.getElementalShotResolvedEvolutionState(game);
    assert.strictEqual(state1.first, state2.first);
    assert.strictEqual(state1.second, state2.second);
    assert.strictEqual(state1.formId, state2.formId);
  });

  it("evolution state is deterministic: same state yields same profile formId", async () => {
    const evolution = await import("../src/data/elemental-shot-evolution.js");
    const state = { first: "rhythm", second: "control", formId: "rhythm_control" };
    const p1 = evolution.getElementalShotProfile(state);
    const p2 = evolution.getElementalShotProfile(state);
    assert.strictEqual(p1.formId, p2.formId);
    assert.strictEqual(p1.formId, "storm_circle");
  });

  it("progression-backed projectile boards hydrate placed upgrades without evolution state", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const def = progression.getWeaponArtBoardDefinition("projectile");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(def.maxLevel));
    let state = progression.getWeaponArtBoardState("projectile");
    let unlockable = progression.getUnlockableBoardCells("projectile", state);
    while (unlockable.length > 0 && state.pendingUnlockCount > 0) {
      progression.unlockWeaponArtBoardCell("projectile", unlockable[0].key);
      state = progression.getWeaponArtBoardState("projectile");
      unlockable = progression.getUnlockableBoardCells("projectile", state);
    }
    const damageAnchor = def.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "elemental_damage", cellKey).ok);
    progression.placeWeaponArtUpgradePiece("projectile", "elemental_damage", damageAnchor);
    const burnAnchor = def.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "burning_power", cellKey).ok);
    if (burnAnchor) progression.placeWeaponArtUpgradePiece("projectile", "burning_power", burnAnchor);

    const runtime = progression.buildRunAttackStateFromProgress("projectile");
    assert.strictEqual(runtime.elementalShotEvolutionFirst, null);
    assert.strictEqual(runtime.elementalShotEvolutionSecond, null);
    assert.ok(runtime.categoryCounts.damage >= 1);
    assert.ok(runtime.runAttackUpgrades.some((upgrade) => upgrade.id === "elemental_damage"));
    if (burnAnchor) assert.ok(runtime.runAttackUpgrades.some((upgrade) => upgrade.id === "burning_power"));
  });
});
