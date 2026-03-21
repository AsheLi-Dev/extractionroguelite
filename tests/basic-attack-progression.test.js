"use strict";

const { beforeEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");

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

describe("Weapon Art progression store", () => {
  it("starts each art at level 1 with no pending picks", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    for (const attackType of ["projectile", "bladeBlast", "soulSiphon"]) {
      const progress = progression.getBasicAttackProgress(attackType);
      assert.equal(progress.attackType, attackType);
      assert.equal(progress.xp, 0);
      assert.equal(progress.level, 1);
      assert.equal(progress.pendingPickCount, 0);
      assert.deepEqual(progress.purchasedRanks, {});
      assert.deepEqual(progress.selectedEvolutionIds, []);
    }
  });

  it("persists attack XP and converts levels gained into pending picks", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const xpToLevel4 = progression.getXpForBasicAttackLevel(4);
    const next = progression.addBasicAttackXp("projectile", xpToLevel4);

    assert.equal(next.level, 4);
    assert.equal(next.xp, xpToLevel4);
    assert.equal(next.pendingPickCount, 3);

    const reloaded = progression.getBasicAttackProgress("projectile");
    assert.equal(reloaded.level, 4);
    assert.equal(reloaded.pendingPickCount, 3);
  });

  it("migrates legacy saves by preserving earned levels and owned ranks", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const xpToLevel8 = progression.getXpForBasicAttackLevel(8);
    global.localStorage.setItem(progression.BASIC_ATTACK_PROGRESSION_KEY, JSON.stringify({
      projectile: {
        xp: xpToLevel8,
        level: 8,
        unspentPoints: 0,
        purchasedRanks: {
          "projectile:upgrade:elemental_damage": 5,
          "projectile:upgrade:burning_power": 2
        },
        selectedEvolutionIds: []
      }
    }));

    const migrated = progression.getBasicAttackProgress("projectile");
    assert.equal(migrated.level, 8);
    assert.equal(migrated.pendingPickCount, 0);
    assert.equal(migrated.purchasedRanks["projectile:upgrade:elemental_damage"], 5);
    assert.equal(migrated.purchasedRanks["projectile:upgrade:burning_power"], 2);
  });

  it("resolves draft choices one rank at a time and spends pending picks", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(3));

    const first = progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage");
    assert.equal(first.pendingPickCount, 1);
    assert.equal(first.purchasedRanks["projectile:upgrade:elemental_damage"], 1);

    const second = progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage");
    assert.equal(second.pendingPickCount, 0);
    assert.equal(second.purchasedRanks["projectile:upgrade:elemental_damage"], 2);

    assert.equal(
      progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage"),
      null
    );
  });

  it("keeps uncommon gated at 10 spent value and rare gated at 20 spent value", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(30));

    for (let i = 0; i < 5; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage");
    assert.equal(progression.canPurchaseBasicAttackNode("projectile", "projectile:upgrade:fire_explosion"), false);

    for (let i = 0; i < 4; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:burning_power");
    for (let i = 0; i < 4; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:burn_hunter");
    assert.equal(progression.getBasicAttackSpentValue("projectile"), 13);
    assert.equal(progression.canPurchaseBasicAttackNode("projectile", "projectile:upgrade:fire_explosion"), true);

    progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:fire_explosion");
    assert.equal(progression.canPurchaseBasicAttackNode("projectile", "projectile:evolution:first:damage"), false);

    for (let i = 0; i < 5; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:attack_speed");
    for (let i = 0; i < 2; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:projectile_speed");
    assert.equal(progression.getBasicAttackSpentValue("projectile"), 22);
    assert.equal(progression.canPurchaseBasicAttackNode("projectile", "projectile:evolution:first:damage"), true);
  });

  it("rolls only legal frontier offers and supports category-biased insight rerolls", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(20));
    progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage");

    const offers = progression.rollWeaponArtOffers("projectile", {}, {
      rng: () => 0,
      count: 3
    });
    assert.equal(offers.length, 3);
    assert.ok(offers.every((offer) => progression.canPurchaseBasicAttackNode("projectile", offer.id)));

    const initialChoiceState = {
      attackType: "projectile",
      offers: offers.map((offer) => offer.id),
      tokenUsed: false,
      offerCount: 3,
      recentSkippedNodeIds: [],
      rerolledAwayNodeIds: [],
      lastDraftedCategory: "damage"
    };
    progression.grantWeaponArtRunRewards({ victory: true, difficulty: 5 }, () => 0);
    const insight = progression.useWeaponArtToken("insight", initialChoiceState, {
      category: "damage",
      rng: () => 0
    });
    assert.equal(insight.ok, true);
    assert.equal(insight.choiceState.tokenUsed, true);
    assert.equal(insight.choiceState.tokenTypeUsed, "insight");
    assert.ok(insight.offers.every((offer) => progression.canPurchaseBasicAttackNode("projectile", offer.id)));
  });

  it("expansion shows six legal offers and precision only exposes common/uncommon nodes", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(30));
    for (let i = 0; i < 5; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage");
    for (let i = 0; i < 4; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:burning_power");
    for (let i = 0; i < 4; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:burn_hunter");
    progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:fire_explosion");
    for (let i = 0; i < 5; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:attack_speed");
    for (let i = 0; i < 2; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:projectile_speed");
    progression.grantWeaponArtRunRewards({ victory: true, difficulty: 5 }, () => 0);
    progression.grantWeaponArtRunRewards({ victory: true, difficulty: 5 }, () => 0);

    const baseChoiceState = {
      attackType: "projectile",
      offers: [],
      tokenUsed: false,
      offerCount: 3,
      recentSkippedNodeIds: [],
      rerolledAwayNodeIds: [],
      lastDraftedCategory: null
    };

    const expansion = progression.useWeaponArtToken("expansion", baseChoiceState, { rng: () => 0 });
    assert.equal(expansion.ok, true);
    assert.equal(expansion.offers.length, 6);
    assert.ok(expansion.offers.every((offer) => progression.canPurchaseBasicAttackNode("projectile", offer.id)));

    const precision = progression.useWeaponArtToken("precision", {
      ...baseChoiceState,
      tokenUsed: false
    });
    assert.equal(precision.ok, true);
    assert.ok(precision.offers.length > 0);
    assert.ok(precision.offers.every((offer) => offer.rarity === "common" || offer.rarity === "uncommon"));
  });

  it("hydrates permanent projectile purchases into runtime upgrades and evolutions", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(30));
    for (let i = 0; i < 5; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:elemental_damage");
    for (let i = 0; i < 4; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:burning_power");
    for (let i = 0; i < 4; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:burn_hunter");
    for (let i = 0; i < 5; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:attack_speed");
    for (let i = 0; i < 2; i += 1) progression.resolveWeaponArtDraftChoice("projectile", "projectile:upgrade:projectile_speed");
    progression.resolveWeaponArtDraftChoice("projectile", "projectile:evolution:first:damage");
    progression.resolveWeaponArtDraftChoice("projectile", "projectile:evolution:second:damage:damage");

    const runtime = progression.buildRunAttackStateFromProgress("projectile");
    assert.equal(runtime.elementalShotEvolutionFirst, "damage");
    assert.equal(runtime.elementalShotEvolutionSecond, "damage");
    assert.equal(runtime.categoryCounts.damage, 13);
    assert.equal(runtime.runAttackPenalties.length, 0);
  });

  it("persists pending picks at run end and writes only once", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const { applyGameVictoryMixin } = await import("../src/game/game-victory.js");

    class DummyGame {}
    applyGameVictoryMixin(DummyGame);

    const game = new DummyGame();
    game.attackType = "projectile";
    game.difficulty = 3;
    game.runAttackXpEarned = progression.getXpForBasicAttackLevel(2);
    game.visitedMaps = new Set([1, 2, 3]);
    game.enemiesKilled = 120;
    game._basicAttackXpPersisted = false;

    assert.equal(global.localStorage.getItem(progression.BASIC_ATTACK_PROGRESSION_KEY), null);

    const firstPersist = game.persistBasicAttackXpOnRunEnd({ victory: false, bossKill: false });
    assert.equal(firstPersist.level, 2);
    assert.equal(firstPersist.pendingPickCount, 1);

    const storedAfterFirstPersist = progression.getBasicAttackProgress("projectile");
    game.runAttackXpEarned = progression.getXpForBasicAttackLevel(10);
    const secondPersist = game.persistBasicAttackXpOnRunEnd({ victory: true, bossKill: true });

    assert.equal(secondPersist, null);
    assert.deepEqual(progression.getBasicAttackProgress("projectile"), storedAfterFirstPersist);
  });
});
