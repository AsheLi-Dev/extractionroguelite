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

describe("Weapon Art board progression store", () => {
  it("starts each art at level 1 with seeded unlocked cells and no pending unlocks", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    for (const attackType of ["projectile", "bladeBlast", "soulSiphon"]) {
      const progress = progression.getWeaponArtBoardState(attackType);
      const def = progression.getWeaponArtBoardDefinition(attackType);
      assert.equal(progress.attackType, attackType);
      assert.equal(progress.xp, 0);
      assert.equal(progress.level, 1);
      assert.equal(progress.pendingUnlockCount, 0);
      assert.deepEqual(progress.unlockedCells.sort(), [...def.seedKeys].sort());
      assert.deepEqual(progress.placedUpgrades, []);
    }
  });

  it("persists attack XP and converts levels gained into two unlock picks per level", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const xpToLevel4 = progression.getXpForBasicAttackLevel(4);
    const next = progression.addBasicAttackXp("projectile", xpToLevel4);

    assert.equal(next.level, 4);
    assert.equal(next.xp, xpToLevel4);
    assert.equal(next.pendingUnlockCount, 6);
    assert.equal(next.pendingPickCount, 6);

    const reloaded = progression.getWeaponArtBoardState("projectile");
    assert.equal(reloaded.level, 4);
    assert.equal(reloaded.pendingUnlockCount, 6);
  });

  it("migrates legacy purchased ranks into placed upgrades on a fully unlocked board", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const xpToLevel8 = progression.getXpForBasicAttackLevel(8);
    global.localStorage.setItem(progression.BASIC_ATTACK_PROGRESSION_KEY, JSON.stringify({
      projectile: {
        xp: xpToLevel8,
        level: 8,
        purchasedRanks: {
          "projectile:upgrade:elemental_damage": 2,
          "projectile:upgrade:burning_power": 1
        }
      }
    }));

    const migrated = progression.getWeaponArtBoardState("projectile");
    assert.equal(migrated.level, 8);
    assert.equal(migrated.placedUpgrades.length, 3);
    assert.equal(migrated.unlockedCells.length, progression.getWeaponArtBoardDefinition("projectile").maskKeys.length);
  });

  it("only exposes orthogonally adjacent cells as unlock candidates and spends pending unlocks", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    progression.addBasicAttackXp("projectile", progression.getXpForBasicAttackLevel(2));
    const before = progression.getWeaponArtBoardState("projectile");
    const unlockable = progression.getUnlockableBoardCells("projectile", before);
    assert.ok(unlockable.length > 0);

    const unlocked = progression.unlockWeaponArtBoardCell("projectile", unlockable[0].key);
    assert.equal(unlocked.pendingUnlockCount, 1);
    assert.ok(unlocked.unlockedCells.includes(unlockable[0].key));

    assert.equal(progression.unlockWeaponArtBoardCell("projectile", unlockable[0].key), null);
  });

  it("validates placement against unlocked cells, overlap, and max stack count", async () => {
    const progression = await import("../src/data/basic-attack-progression.js");
    const def = progression.getWeaponArtBoardDefinition("projectile");
    const fullUnlockXp = progression.getXpForBasicAttackLevel(def.maxLevel);
    progression.addBasicAttackXp("projectile", fullUnlockXp);

    let state = progression.getWeaponArtBoardState("projectile");
    let frontier = progression.getUnlockableBoardCells("projectile", state);
    while (frontier.length > 0 && state.pendingUnlockCount > 0) {
      progression.unlockWeaponArtBoardCell("projectile", frontier[0].key);
      state = progression.getWeaponArtBoardState("projectile");
      frontier = progression.getUnlockableBoardCells("projectile", state);
    }

    const firstAnchor = def.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "elemental_damage", cellKey).ok);
    assert.ok(firstAnchor);
    let placed = progression.placeWeaponArtUpgradePiece("projectile", "elemental_damage", firstAnchor);
    assert.ok(placed);

    assert.equal(progression.placeWeaponArtUpgradePiece("projectile", "elemental_damage", firstAnchor), null);

    const syntheticMaxedState = {
      ...progression.getWeaponArtBoardState("projectile"),
      placedUpgrades: Array.from({ length: 5 }, (_, index) => ({
        instanceId: `elemental_damage:${index}`,
        upgradeId: "elemental_damage",
        anchorCell: `${index},${index}`,
        cells: []
      }))
    };
    const maxedCheck = progression.canPlaceUpgradePiece("projectile", "elemental_damage", def.maskKeys[0], syntheticMaxedState);
    assert.equal(maxedCheck.ok, false);
    assert.equal(maxedCheck.error, "maxed");
  });

  it("rolls only currently placeable upgrades and precision limits rarity", async () => {
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

    const offers = progression.rollWeaponArtOffers("projectile", {}, { rng: () => 0, count: 3 });
    assert.equal(offers.length, 3);
    assert.ok(offers.every((offer) => offer.hasPlacement));

    progression.grantWeaponArtRunRewards({ victory: true, difficulty: 5 }, () => 0);
    const precision = progression.useWeaponArtToken("precision", {
      attackType: "projectile",
      offers: [],
      tokenUsed: false,
      offerCount: 3
    });
    assert.equal(precision.ok, true);
    assert.ok(precision.offers.every((offer) => offer.rarity === "common" || offer.rarity === "uncommon"));
  });

  it("hydrates placed upgrades into runtime runAttackUpgrades and category counts", async () => {
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
    const refreshedDef = progression.getWeaponArtBoardDefinition("projectile");
    const rhythmAnchor = refreshedDef.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "attack_speed", cellKey).ok);
    progression.placeWeaponArtUpgradePiece("projectile", "attack_speed", rhythmAnchor);

    const runtime = progression.buildRunAttackStateFromProgress("projectile");
    assert.ok(runtime.runAttackUpgrades.length >= 2);
    assert.ok(runtime.categoryCounts.damage >= 1);
    assert.ok(runtime.categoryCounts.rhythm >= 1);
    assert.equal(runtime.elementalShotEvolutionFirst, null);
  });

  it("can pick up and move a placed upgrade instance to a new valid anchor", async () => {
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

    const firstAnchor = def.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "elemental_damage", cellKey).ok);
    progression.placeWeaponArtUpgradePiece("projectile", "elemental_damage", firstAnchor);
    const placedState = progression.getWeaponArtBoardState("projectile");
    const placement = placedState.placedUpgrades.find((entry) => entry.upgradeId === "elemental_damage");
    assert.ok(placement);

    const nextAnchor = def.maskKeys.find((cellKey) => {
      if (cellKey === placement.anchorCell) return false;
      return progression.canMoveWeaponArtUpgradePiece("projectile", placement.instanceId, cellKey).ok;
    });
    assert.ok(nextAnchor);

    const moved = progression.moveWeaponArtUpgradePiece("projectile", placement.instanceId, nextAnchor);
    assert.ok(moved);
    const movedPlacement = moved.placedUpgrades.find((entry) => entry.instanceId === placement.instanceId);
    assert.equal(movedPlacement.anchorCell, nextAnchor);
  });

  it("can remove one placement and clear the whole board without losing unlock progress", async () => {
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

    const firstAnchor = def.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "elemental_damage", cellKey).ok);
    progression.placeWeaponArtUpgradePiece("projectile", "elemental_damage", firstAnchor);
    const secondAnchor = def.maskKeys.find((cellKey) => progression.canPlaceUpgradePiece("projectile", "attack_speed", cellKey).ok);
    progression.placeWeaponArtUpgradePiece("projectile", "attack_speed", secondAnchor);

    const withPlacements = progression.getWeaponArtBoardState("projectile");
    const initialUnlockedCount = withPlacements.unlockedCells.length;
    assert.ok(withPlacements.placedUpgrades.length >= 2);

    const removed = progression.removeWeaponArtUpgradePiece("projectile", withPlacements.placedUpgrades[0].instanceId);
    assert.ok(removed);
    assert.equal(removed.placedUpgrades.length, withPlacements.placedUpgrades.length - 1);
    assert.equal(removed.unlockedCells.length, initialUnlockedCount);

    const cleared = progression.clearWeaponArtBoardPlacements("projectile");
    assert.ok(cleared);
    assert.equal(cleared.placedUpgrades.length, 0);
    assert.equal(cleared.unlockedCells.length, initialUnlockedCount);
  });

  it("persists pending unlocks at run end and writes only once", async () => {
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

    const firstPersist = game.persistBasicAttackXpOnRunEnd({ victory: false, bossKill: false });
    assert.equal(firstPersist.level, 2);
    assert.equal(firstPersist.pendingUnlockCount, 2);

    const storedAfterFirstPersist = progression.getWeaponArtBoardState("projectile");
    game.runAttackXpEarned = progression.getXpForBasicAttackLevel(10);
    const secondPersist = game.persistBasicAttackXpOnRunEnd({ victory: true, bossKill: true });

    assert.equal(secondPersist, null);
    assert.deepEqual(progression.getWeaponArtBoardState("projectile"), storedAfterFirstPersist);
  });
});
