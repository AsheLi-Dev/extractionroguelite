"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("Skill stat scaling", () => {
  it("getSkillStatScalingMult returns 1 when no game or skillDef", async () => {
    const { getSkillStatScalingMult } = await import("../src/data/skills.js");
    assert.strictEqual(getSkillStatScalingMult(null, { scalingPrimary: "S" }), 1);
    assert.strictEqual(getSkillStatScalingMult({ runCharacterAttributes: {} }, null), 1);
  });

  it("getSkillStatScalingMult applies S tier (4% per point) from brutality", async () => {
    const { getSkillStatScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 25 } };
    const skillDef = { scalingPrimary: "S", scalingStat1: "brutality" };
    const mult = getSkillStatScalingMult(game, skillDef);
    assert.ok(mult >= 1);
    assert.strictEqual(mult, 1 + 25 * 0.04);
  });

  it("getSkillStatScalingMult applies A tier (2% per point)", async () => {
    const { getSkillStatScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 50 } };
    const skillDef = { scalingPrimary: "A" };
    const mult = getSkillStatScalingMult(game, skillDef);
    assert.strictEqual(mult, 1 + 50 * 0.02);
  });

  it("getSkillStatScalingMult applies B and C tiers", async () => {
    const { getSkillStatScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 100 } };
    assert.strictEqual(getSkillStatScalingMult(game, { scalingPrimary: "B" }), 1 + 100 * 0.01);
    assert.strictEqual(getSkillStatScalingMult(game, { scalingPrimary: "C" }), 1 + 100 * 0.005);
  });

  it("getSkillStatScalingMult uses secondary stat when scalingSecondary set", async () => {
    const { getSkillStatScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 10, agility: 20 } };
    const skillDef = { scalingPrimary: "A", scalingSecondary: "B", scalingStat1: "brutality", scalingStat2: "agility" };
    const mult = getSkillStatScalingMult(game, skillDef);
    assert.strictEqual(mult, 1 + 10 * 0.02 + 20 * 0.01);
  });
});
