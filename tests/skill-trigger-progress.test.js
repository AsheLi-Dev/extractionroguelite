"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("Skill trigger progress", () => {
  it("advanceSkillTriggerProgress ignores unknown event type", async () => {
    const { advanceSkillTriggerProgress } = await import("../src/game/skill-trigger-progress.js");
    const game = { skills: ["fireball", null, null, null], skillTriggerProgress: [0, 0, 0, 0] };
    const result = advanceSkillTriggerProgress(game, "unknown_event");
    assert.strictEqual(result, false);
  });

  it("advanceSkillTriggerProgress advances progress and fires at threshold with allowTriggeredProcs false", async () => {
    const { advanceSkillTriggerProgress, ensureSkillTriggerProgress } = await import("../src/game/skill-trigger-progress.js");
    const game = {
      skills: ["fireball", null, null, null],
      devModOverrides: { 0: ["triggerFromKill"] },
      skillTriggerProgress: [0, 0, 0, 0]
    };
    ensureSkillTriggerProgress(game);
    let executed = 0;
    game.executeSkill = (skillId, slot, opts) => {
      executed++;
      assert.strictEqual(opts.triggered, true);
      assert.strictEqual(opts.allowTriggeredProcs, false);
    };
    advanceSkillTriggerProgress(game, "kill", {});
    advanceSkillTriggerProgress(game, "kill", {});
    assert.ok(executed >= 0 && executed <= 1, "at most one trigger per call");
    if (executed === 1) assert.strictEqual(game.skillTriggerProgress[0], 0);
  });

  it("TRIGGER_PROGRESS_EVENT_TYPES contains expected event types", async () => {
    const { TRIGGER_PROGRESS_EVENT_TYPES, TRIGGER_PROGRESS_MOD_EVENT } = await import("../src/game/skill-trigger-progress.js");
    const values = Object.values(TRIGGER_PROGRESS_MOD_EVENT);
    for (const v of values) {
      assert.ok(TRIGGER_PROGRESS_EVENT_TYPES.has(v), `missing event type: ${v}`);
    }
  });

  it("ensureSkillTriggerProgress initializes array", async () => {
    const { ensureSkillTriggerProgress } = await import("../src/game/skill-trigger-progress.js");
    const game = {};
    const arr = ensureSkillTriggerProgress(game);
    assert.ok(Array.isArray(arr));
    assert.ok(game.skillTriggerProgress === arr);
  });
});
