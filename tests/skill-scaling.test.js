"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("Skill stat scaling", () => {
  it("getSkillStatScalingMult (alias) returns 1 when no game or skillDef", async () => {
    const { getSkillStatScalingMult } = await import("../src/data/skills.js");
    assert.strictEqual(getSkillStatScalingMult(null, { scalingPrimary: "S" }), 1);
    assert.strictEqual(getSkillStatScalingMult({ runCharacterAttributes: {} }, null), 1);
  });

  it("getSkillDamageScalingMult applies S tier (30% per point) from brutality", async () => {
    const { getSkillDamageScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 25 } };
    const skillDef = { scalingPrimary: "S", scalingStat1: "brutality" };
    const mult = getSkillDamageScalingMult(game, skillDef);
    assert.strictEqual(mult, 1 + 25 * 0.3);
  });

  it("getSkillDamageScalingMult applies A tier (20% per point)", async () => {
    const { getSkillDamageScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 50 } };
    const skillDef = { scalingPrimary: "A", scalingStat1: "brutality" };
    const mult = getSkillDamageScalingMult(game, skillDef);
    assert.strictEqual(mult, 1 + 50 * 0.2);
  });

  it("getSkillDamageScalingMult applies B and C tiers", async () => {
    const { getSkillDamageScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 100 } };
    assert.strictEqual(getSkillDamageScalingMult(game, { scalingPrimary: "B", scalingStat1: "brutality" }), 1 + 100 * 0.1);
    assert.strictEqual(getSkillDamageScalingMult(game, { scalingPrimary: "C", scalingStat1: "brutality" }), 1 + 100 * 0.05);
  });

  it("getSkillDamageScalingMult uses secondary stat when scalingSecondary set", async () => {
    const { getSkillDamageScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { brutality: 10, agility: 20 } };
    const skillDef = { scalingPrimary: "A", scalingSecondary: "B", scalingStat1: "brutality", scalingStat2: "agility" };
    const mult = getSkillDamageScalingMult(game, skillDef);
    assert.strictEqual(mult, 1 + 10 * 0.2 + 20 * 0.1);
  });

  it("getSkillHealScalingMult returns 1 when no heal tiers", async () => {
    const { getSkillHealScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { vitality: 99 } };
    assert.strictEqual(getSkillHealScalingMult(game, { scalingPrimary: "S", scalingStat1: "brutality" }), 1);
  });

  it("getSkillHealScalingMult applies healScalingPrimary (e.g. healPulse-like)", async () => {
    const { getSkillHealScalingMult } = await import("../src/data/skills.js");
    const game = { runCharacterAttributes: { vitality: 20 } };
    const healPulseLike = { healScalingPrimary: "C", healScalingStat1: "vitality" };
    assert.strictEqual(getSkillHealScalingMult(game, healPulseLike), 1 + 20 * 0.05);
  });
});
