"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("Projectile interactions (orbs)", () => {
  it("does not consume when absorbableByOrb is false", async () => {
    const { tryInteractProjectileWithOrbs } = await import("../src/game/projectile-interactions.js");
    const consumed = tryInteractProjectileWithOrbs(
      {
        skillEffects: [{ type: "assimilativeOrb", x: 0, y: 0, t: 0, duration: 5, radius: 40, absorbedCount: 0, slot: 0, skillId: "assimilativeOrb", skillMults: {} }],
        playerProjectiles: [],
        getNearestEnemy() { return null; },
        computeSkillDamage() { return 1; }
      },
      { x: 0, y: 0, size: 10, absorbableByOrb: false },
      { radius: 5, positionIsCenter: true }
    );
    assert.strictEqual(consumed.consumed, false);
  });

  it("does not re-absorb projectiles marked _fromAssimilativeOrb", async () => {
    const { tryInteractProjectileWithOrbs } = await import("../src/game/projectile-interactions.js");
    const game = {
      skillEffects: [{ type: "assimilativeOrb", x: 0, y: 0, t: 0, duration: 5, radius: 40, absorbedCount: 0, slot: 0, skillId: "assimilativeOrb", skillMults: {} }],
      playerProjectiles: [],
      getNearestEnemy() { return null; },
      computeSkillDamage() { return 1; }
    };
    const result = tryInteractProjectileWithOrbs(game, { x: 0, y: 0, size: 10, _fromAssimilativeOrb: true }, { radius: 5, positionIsCenter: true });
    assert.strictEqual(result.consumed, false);
    assert.strictEqual(game.playerProjectiles.length, 0);
  });

  it("supports position.x/y and x/y shapes and returns the orb that consumed", async () => {
    const { tryInteractProjectileWithOrbs } = await import("../src/game/projectile-interactions.js");
    const orb = { type: "assimilativeOrb", x: 10, y: 20, t: 0, duration: 5, radius: 40, absorbedCount: 0, slot: 0, skillId: "assimilativeOrb", skillMults: {} };
    const game = {
      skillEffects: [orb],
      playerProjectiles: [],
      getNearestEnemy() { return null; },
      computeSkillDamage() { return 1; }
    };

    const resA = tryInteractProjectileWithOrbs(game, { x: 10, y: 20, size: 12 }, { radius: 6, positionIsCenter: true });
    assert.strictEqual(resA.consumed, true);
    assert.strictEqual(resA.orbEff, orb);

    const resB = tryInteractProjectileWithOrbs(game, { position: { x: 10, y: 20 }, size: 12 }, { radius: 6, positionIsCenter: false });
    assert.strictEqual(resB.consumed, true);
    assert.strictEqual(resB.orbEff, orb);
    assert.ok(game.playerProjectiles.length >= 2);
  });
});

