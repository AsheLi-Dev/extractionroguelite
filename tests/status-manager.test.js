"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

let statusManagerModule;
let statusDefinitionsModule;
let skillsModule;

async function loadStatusModules() {
  if (!statusManagerModule) {
    statusManagerModule = await import("../src/systems/status-manager.js");
  }
  if (!statusDefinitionsModule) {
    statusDefinitionsModule = await import("../src/data/status-definitions.js");
  }
  if (!skillsModule) {
    skillsModule = await import("../src/data/skills.js");
  }
  return {
    ...statusManagerModule,
    ...statusDefinitionsModule,
    ...skillsModule
  };
}

describe("StatusManager", () => {
  it("refreshes stun duration on reapply", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 5 };
    manager.applyStatus("enemy-1", { statusId: "stun", duration: 0.2 }, world);
    world.time = 5.1;
    manager.updateStatuses(0.1, world);
    const before = manager.getStatus("enemy-1", "stun");
    manager.applyStatus("enemy-1", { statusId: "stun", duration: 0.2 }, world);
    const after = manager.getStatus("enemy-1", "stun");
    assert.ok(after.remaining > before.remaining);
    assert.ok(after.remaining >= 0.19);
  });

  it("keeps the strongest slow magnitude", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 1 };
    manager.applyStatus("enemy-1", { statusId: "slow", duration: 1, magnitude: 0.8 }, world);
    world.time = 1.1;
    manager.applyStatus("enemy-1", { statusId: "slow", duration: 1.5, magnitude: 0.6 }, world);
    manager.applyStatus("enemy-1", { statusId: "slow", duration: 2, magnitude: 0.9 }, world);
    const slow = manager.getStatus("enemy-1", "slow");
    assert.strictEqual(slow.magnitude, 0.6);
    assert.ok(slow.remaining >= 1.49);
  });

  it("caps stacked poison and refreshes duration", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 2 };
    for (let i = 0; i < 4; i++) {
      manager.applyStatus("enemy-1", {
        statusId: "poison",
        duration: 3,
        magnitude: 5,
        maxStacks: 3,
        stackDelta: 1
      }, world);
    }
    world.time = 2.5;
    manager.updateStatuses(0.5, world);
    manager.applyStatus("enemy-1", {
      statusId: "poison",
      duration: 3,
      magnitude: 5,
      maxStacks: 3,
      stackDelta: 1
    }, world);
    const poison = manager.getStatus("enemy-1", "poison");
    assert.strictEqual(poison.stacks, 3);
    assert.ok(poison.remaining >= 2.99);
  });

  it("supports replace-if-stronger overrides", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 3 };
    manager.applyStatus("enemy-1", {
      statusId: "poison",
      duration: 3,
      magnitude: 4,
      stackingMode: "replace_if_stronger"
    }, world);
    manager.applyStatus("enemy-1", {
      statusId: "poison",
      duration: 3,
      magnitude: 2,
      stackingMode: "replace_if_stronger"
    }, world);
    assert.strictEqual(manager.getStatus("enemy-1", "poison").magnitude, 4);
    manager.applyStatus("enemy-1", {
      statusId: "poison",
      duration: 3,
      magnitude: 7,
      stackingMode: "replace_if_stronger"
    }, world);
    assert.strictEqual(manager.getStatus("enemy-1", "poison").magnitude, 7);
  });

  it("removes expired statuses centrally", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 4 };
    manager.applyStatus("enemy-1", { statusId: "slow", duration: 0.1, magnitude: 0.8 }, world);
    world.time = 4.2;
    manager.updateStatuses(0.2, world);
    assert.strictEqual(manager.hasStatus("enemy-1", "slow"), false);
  });

  it("removes a status when updateStatus returns null", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 4 };
    manager.applyStatus("enemy-1", { statusId: "burn", duration: 2, magnitude: 5, stacks: 1 }, world);
    const updated = manager.updateStatus("enemy-1", "burn", () => null);
    assert.strictEqual(updated, null);
    assert.strictEqual(manager.hasStatus("enemy-1", "burn"), false);
  });

  it("exposes read helpers for move speed and stun", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 8 };
    manager.applyStatus("player", { statusId: "slow", duration: 2, magnitude: 0.75 }, world);
    manager.applyStatus("player", { statusId: "haste", duration: 2, magnitude: 1.2 }, world);
    manager.applyStatus("player", { statusId: "stun", duration: 0.2 }, world);
    assert.strictEqual(manager.isStunned("player"), true);
    assert.ok(Math.abs(manager.getMoveSpeedMultiplier("player") - 0.9) < 1e-9);
  });

  it("exposes the strongest defense debuff multiplier", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 8 };
    manager.applyStatus("enemy-1", { statusId: "void", duration: 4, magnitude: 0.8 }, world);
    manager.applyStatus("enemy-1", { statusId: "void", duration: 3, magnitude: 0.9 }, world);
    assert.strictEqual(manager.getDefenseMultiplier("enemy-1"), 0.8);
  });

  it("exposes player weaken read helpers", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 9 };
    manager.applyStatus("player", { statusId: "weakening", duration: 2, magnitude: 0.9 }, world);
    manager.applyStatus("player", { statusId: "weaken", duration: 2, magnitude: 0.8 }, world);
    assert.strictEqual(manager.getAttackSpeedMultiplier("player"), 0.9);
    assert.strictEqual(manager.getOutgoingDamageMultiplier("player"), 0.8);
  });

  it("routes poison ticks through the world damage adapter", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const calls = [];
    const world = {
      time: 0,
      getEntityById(id) {
        return { id };
      },
      applyStatusDamage(entityId, amount, meta) {
        calls.push({ entityId, amount, meta });
      }
    };
    manager.applyStatus("enemy-1", {
      statusId: "poison",
      duration: 3,
      magnitude: 6,
      maxStacks: 3,
      stacks: 2
    }, world);
    world.time = 0.5;
    manager.updateStatuses(0.5, world);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].entityId, "enemy-1");
    assert.strictEqual(calls[0].amount, 6);
    assert.strictEqual(calls[0].meta.statusId, "poison");
  });

  it("routes burn ticks through the world damage adapter", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const calls = [];
    const world = {
      time: 0,
      getEntityById(id) {
        return { id };
      },
      applyStatusDamage(entityId, amount, meta) {
        calls.push({ entityId, amount, meta });
      }
    };
    manager.applyStatus("player", {
      statusId: "burn",
      duration: 2,
      magnitude: 4,
      data: {
        damageModel: "per_tick",
        reason: "player_burn_tick"
      }
    }, world);
    world.time = 0.5;
    manager.updateStatuses(0.5, world);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].entityId, "player");
    assert.strictEqual(calls[0].amount, 4);
    assert.strictEqual(calls[0].meta.statusId, "burn");
    assert.strictEqual(calls[0].meta.reason, "player_burn_tick");
  });

  it("serializes and restores entity statuses", async () => {
    const { StatusManager, STATUS_DEFS } = await loadStatusModules();
    const manager = new StatusManager(STATUS_DEFS);
    const world = { time: 6 };
    manager.applyStatus("enemy-1", { statusId: "slow", duration: 2, magnitude: 0.7 }, world);
    manager.applyStatus("enemy-1", {
      statusId: "poison",
      duration: 3,
      magnitude: 5,
      maxStacks: 3,
      stacks: 2
    }, world);
    const snapshot = manager.serializeEntity("enemy-1");
    const restored = new StatusManager(STATUS_DEFS);
    restored.restoreEntity("enemy-1", snapshot, world);
    assert.deepStrictEqual(restored.getStatus("enemy-1", "slow"), manager.getStatus("enemy-1", "slow"));
    assert.deepStrictEqual(restored.getStatus("enemy-1", "poison"), manager.getStatus("enemy-1", "poison"));
  });
});

describe("Status integration", () => {
  it("applies ignite, chill, shock, toxic, and void through status calls", async () => {
    const { applyElementDebuffsFromMods } = await loadStatusModules();
    const applied = [];
    const enemy = { id: "enemy-1", maxHealth: 100 };
    const game = {
      applyStatusToEntity(entityId, statusId, statusData) {
        applied.push({ entityId, statusId, statusData });
      }
    };
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      applyElementDebuffsFromMods(game, enemy, ["ignite", "chill", "shock", "toxic", "void"], 20, 10);
    } finally {
      Math.random = originalRandom;
    }
    assert.deepStrictEqual(applied.map((entry) => entry.statusId), ["burn", "slow", "stun", "poison", "void"]);
    assert.strictEqual(applied[0].statusData.magnitude, 3);
    assert.strictEqual(applied[3].statusData.maxStacks, 3);
    assert.strictEqual(applied[3].statusData.magnitude, 5);
    assert.strictEqual(applied[4].statusData.magnitude, 0.8);
  });
});
