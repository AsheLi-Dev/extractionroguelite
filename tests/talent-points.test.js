"use strict";

const { beforeEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");

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

describe("talent points and attribute requirements", () => {
  beforeEach(() => {
    global.localStorage = createMemoryStorage();
  });

  it("requires both talent points and attributes to purchase a talent", async () => {
    const save = await import("../src/ui/save-system.js");
    const talents = await import("../src/data/talents.js");

    save.saveGlobalPlayerProfile({
      level: 5,
      xp: 0,
      unspentAttributePoints: 0,
      unspentTalentPoints: 2,
      attributes: { brutality: 2, agility: 0, vitality: 0, luck: 0 }
    });

    assert.equal(talents.canPurchaseTalent("fierce"), true);
    assert.equal(talents.purchaseTalent("fierce"), true);
    assert.equal(talents.getTalentPointBalance(), 1);
    assert.equal(talents.canPurchaseTalent("heavyHit"), false);

    save.saveGlobalPlayerProfile({
      ...save.loadGlobalPlayerProfile(),
      unspentTalentPoints: 3,
      attributes: { brutality: 5, agility: 0, vitality: 0, luck: 0 }
    });

    assert.equal(talents.canPurchaseTalent("heavyHit"), true);
  });

  it("refunds spent talent points and validates attribute support for purchased talents", async () => {
    const save = await import("../src/ui/save-system.js");
    const talents = await import("../src/data/talents.js");

    save.saveGlobalPlayerProfile({
      level: 8,
      xp: 0,
      unspentAttributePoints: 0,
      unspentTalentPoints: 3,
      attributes: { brutality: 5, agility: 0, vitality: 0, luck: 0 }
    });

    assert.equal(talents.purchaseTalent("heavyHit"), true);
    assert.equal(talents.getTalentPointBalance(), 1);
    assert.equal(talents.canSupportPurchasedTalents({ brutality: 4, agility: 0, vitality: 0, luck: 0 }), false);
    assert.equal(talents.refundTalent("heavyHit"), true);
    assert.equal(talents.getTalentPointBalance(), 3);
  });
});
