"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

if (typeof global.Image === "undefined") {
  global.Image = class FakeImage {
    constructor() {
      this.complete = true;
    }
    set onload(fn) {
      this._onload = fn;
    }
    set onerror(fn) {
      this._onerror = fn;
    }
    set src(_v) {
      if (typeof this._onload === "function") this._onload();
    }
  };
}

describe("Dark Mage hero", () => {
  it("registers the Dark Mage hero and hero-only skill data", async () => {
    const { getPlayableCharacter } = await import("../src/data/playable-characters.js");
    const { getSkillById } = await import("../src/data/skills.js");

    const hero = getPlayableCharacter("dark_mage");
    assert.ok(hero, "expected Dark Mage hero definition");
    assert.strictEqual(hero.uniqueSkill.skillId, "dark_mage_blood_refresh");
    assert.strictEqual(hero.passive.id, "dark_mage_blood_power");

    const skill = getSkillById("dark_mage_blood_refresh");
    assert.ok(skill, "expected Dark Mage skill definition");
    assert.strictEqual(skill.heroOnly, true);
    assert.strictEqual(skill.baseCd, 10);
  });

  it("tracks and expires Blood Power stacks", async () => {
    const { Game } = await import("../src/game/game.js");

    const game = {
      playableCharacterDef: { passive: { id: "dark_mage_blood_power" } },
      darkMageBloodPowerStacks: 0,
      darkMageBloodPowerUntil: 0,
      darkMageBloodPowerHpLossProgress: 0,
      time: 10,
      expireDarkMageBloodPowerIfNeeded: Game.prototype.expireDarkMageBloodPowerIfNeeded
    };

    Game.prototype.onDarkMageEnemyKill.call(game);
    Game.prototype.onDarkMageEnemyKill.call(game);
    Game.prototype.onDarkMageEnemyKill.call(game);

    assert.strictEqual(game.darkMageBloodPowerStacks, 3);
    assert.strictEqual(game.darkMageBloodPowerUntil, 15);
    assert.strictEqual(Game.prototype.getDarkMageDamageMultiplier.call(game), 1.03);

    game.darkMageBloodPowerStacks = 20;
    game.darkMageBloodPowerUntil = 15;
    assert.strictEqual(Game.prototype.getDarkMageMoveSpeedMultiplier.call(game), 1.2);

    game.time = 16;
    assert.strictEqual(Game.prototype.getDarkMageDamageMultiplier.call(game), 1);
    assert.strictEqual(game.darkMageBloodPowerStacks, 0);
  });

  it("gains Blood Power stacks from each 10 HP lost cumulatively", async () => {
    const { Game } = await import("../src/game/game.js");

    const game = {
      playableCharacterDef: { passive: { id: "dark_mage_blood_power" } },
      darkMageBloodPowerStacks: 0,
      darkMageBloodPowerUntil: 0,
      darkMageBloodPowerHpLossProgress: 0,
      time: 20
    };

    Game.prototype.onDarkMageHpLost.call(game, 9);
    assert.strictEqual(game.darkMageBloodPowerStacks, 0);
    assert.strictEqual(game.darkMageBloodPowerHpLossProgress, 9);

    Game.prototype.onDarkMageHpLost.call(game, 1);
    assert.strictEqual(game.darkMageBloodPowerStacks, 1);
    assert.strictEqual(game.darkMageBloodPowerHpLossProgress, 0);
    assert.strictEqual(game.darkMageBloodPowerUntil, 25);

    Game.prototype.onDarkMageHpLost.call(game, 21);
    assert.strictEqual(game.darkMageBloodPowerStacks, 3);
    assert.strictEqual(game.darkMageBloodPowerHpLossProgress, 1);
    assert.strictEqual(game.darkMageBloodPowerUntil, 25);
  });

  it("applies Blood Power to basic and skill damage", async () => {
    const { Game } = await import("../src/game/game.js");

    const game = {
      attackType: "projectile",
      currentStats: { attack: 100, maxHealth: 100 },
      currentHealth: 100,
      playableCharacterDef: { passive: { id: "dark_mage_blood_power" } },
      darkMageBloodPowerStacks: 5,
      darkMageBloodPowerUntil: 10,
      time: 5,
      statusManager: null,
      equipmentSkillDamageMult: 1,
      equipmentGoldDamageBuffUntil: 0,
      equipmentGoldDamageBuffMult: 1,
      equipmentChestDamageUntil: 0,
      equipmentChestDamageStacks: 0,
      equipmentChestDamagePerStack: 0,
      loadedDiceDamageUntil: 0,
      pandaFocusUntil: 0,
      ancestralShoutUntil: 0,
      ancestralShoutDamageMult: 1,
      _spiritDamageMult: 1,
      doubleStrikeCounter: 0,
      runCharacterAttributes: {},
      getAttackUpgradeValue: () => 0,
      getAttackPenaltyValue: () => 0,
      hasBlessing: () => false,
      hasUpgradeCard: () => false,
      hasRunTalent: () => false,
      logTalentTrigger() {},
      getEquipmentConditionalBonuses: () => null,
      getSkillMultipliersFor: () => ({ damageMult: 1 }),
      getDarkMageDamageMultiplier: Game.prototype.getDarkMageDamageMultiplier,
      expireDarkMageBloodPowerIfNeeded: Game.prototype.expireDarkMageBloodPowerIfNeeded
    };

    const basic = Game.prototype.computePlayerDamage.call(game, null);
    const skill = Game.prototype.computeSkillDamage.call(game, null, 1, null, { skillId: "fireball" });

    assert.strictEqual(basic, 105);
    assert.strictEqual(skill, 105);
  });

  it("finds only other cooling skills and refreshes charges on reset", async () => {
    const { Game } = await import("../src/game/game.js");

    const game = {
      time: 12,
      skills: ["dark_mage_blood_refresh", "fireball", "rapidFire", "healPulse"],
      skillCooldowns: [10, 0, 4, 7],
      skillCurrentCharges: [1, 1, 0, 0],
      skillMaxCharges: [1, 1, 2, 3],
      skillCascadeFlashUntil: {},
      inventory: [],
      requestPillarCooldownRefresh() {}
    };

    const candidates = Game.prototype.getDarkMageBloodRefreshCandidates.call(game, 0, "dark_mage_blood_refresh");
    assert.deepStrictEqual(
      candidates.map((entry) => entry.slot),
      [2, 3]
    );

    const refreshed = Game.prototype.refreshSkillCooldownSlot.call(game, 2, "rapidFire", "test_refresh");
    assert.strictEqual(refreshed, true);
    assert.strictEqual(game.skillCooldowns[2], 0);
    assert.strictEqual(game.skillCurrentCharges[2], 2);
    assert.ok(game.skillCascadeFlashUntil[2] > game.time);
  });
});
