"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("loot luck helpers", () => {
  it("luck can push a rarity roll into magic", async () => {
    const loot = await import("../src/data/loot-data.js");
    const originalRandom = Math.random;
    Math.random = () => 0.17;
    try {
      assert.strictEqual(loot.getRarityRoll(0, 0, 0), "common");
      assert.strictEqual(loot.getRarityRoll(0, 0, 10), "magic");
    } finally {
      Math.random = originalRandom;
    }
  });

  it("equipment drop tables use the lower minion equipment rate", async () => {
    const drops = await import("../src/data/equipment-drop-tables.js");
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.055;
      assert.ok(drops.rollEquipmentDropOutcome("minion", 0, 1, 1, 1));
      Math.random = () => 0.07;
      assert.strictEqual(drops.rollEquipmentDropOutcome("minion", 0, 1, 1, 1), null);
    } finally {
      Math.random = originalRandom;
    }
  });
});

describe("economy luck hooks", () => {
  it("gold gain respects luck scaling", async () => {
    const economy = await import("../src/game/economy.js");
    const game = {
      gold: 0,
      runCharacterAttributes: { luck: 10 }
    };

    economy.addGold(game, 10, "test");

    assert.strictEqual(game.gold, 11);
  });
});
