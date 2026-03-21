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

describe("global player profile", () => {
  beforeEach(() => {
    global.localStorage = createMemoryStorage();
  });

  it("loads defaults when profile is missing", async () => {
    const save = await import("../src/ui/save-system.js");
    const profile = save.loadGlobalPlayerProfile();
    assert.deepStrictEqual(profile, {
      level: 1,
      xp: 0,
      unspentAttributePoints: 0,
      unspentTalentPoints: 0,
      attributes: { brutality: 0, agility: 0, vitality: 0, luck: 0 }
    });
  });

  it("saves and updates profile with sanitized values", async () => {
    const save = await import("../src/ui/save-system.js");
    save.saveGlobalPlayerProfile({
      level: 12.9,
      xp: 987.8,
      unspentAttributePoints: 3.2,
      unspentTalentPoints: 4.9,
      attributes: { brutality: 5, agility: "4", vitality: -3, luck: 2.9 }
    });
    const updated = save.updateGlobalPlayerProfile({
      unspentTalentPoints: 7,
      unspentAttributePoints: 6,
      attributes: { luck: 7 }
    });
    assert.deepStrictEqual(updated, {
      level: 12,
      xp: 987,
      unspentAttributePoints: 6,
      unspentTalentPoints: 7,
      attributes: { brutality: 5, agility: 4, vitality: 0, luck: 7 }
    });
  });
});
