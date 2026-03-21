"use strict";

const { beforeEach, describe, it } = require("node:test");
const assert = require("node:assert");

function createMemoryStorage() {
  const state = new Map();
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
    removeItem(key) {
      state.delete(key);
    }
  };
}

describe("global crystal bank", () => {
  beforeEach(() => {
    global.localStorage = createMemoryStorage();
  });

  it("maps attributes to crystal colors", async () => {
    const crystals = await import("../src/data/crystals.js");
    assert.strictEqual(crystals.ATTRIBUTE_TO_CRYSTAL.brutality, "orange");
    assert.strictEqual(crystals.ATTRIBUTE_TO_CRYSTAL.agility, "green");
    assert.strictEqual(crystals.ATTRIBUTE_TO_CRYSTAL.vitality, "red");
    assert.strictEqual(crystals.ATTRIBUTE_TO_CRYSTAL.luck, "yellow");
  });

  it("supports add/spend/remove behavior with floor at zero", async () => {
    const crystals = await import("../src/data/crystals.js");
    crystals.addGlobalTalentCrystal("orange", 2);
    const removed = crystals.removeGlobalTalentCrystal("orange", 1);
    assert.strictEqual(removed.orange, 1);
    const failed = crystals.removeGlobalTalentCrystal("orange", 2);
    assert.strictEqual(failed, null);
    const spent = crystals.spendGlobalTalentCrystal("orange", 1);
    assert.strictEqual(spent.orange, 0);
  });
});
