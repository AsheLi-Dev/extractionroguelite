"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

// `src/entities/tile-system.js` initializes a shared tile atlas at module-load time
// using `new Image()`. Node doesn't provide `Image`, so we stub it to keep these
// unit tests focused on non-rendering logic.
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

describe("Self damage flash suppression", () => {
  it("suppresses damage flash when sourceType starts with skill", async () => {
    const { Game } = await import("../src/game/game.js");

    let captured = null;
    const gameLike = {
      time: 123,
      pushPillarDebugEntry() {},
      applyDamage(args) {
        captured = args;
        return { applied: true, effectiveDamage: args.amount };
      }
    };

    Game.prototype.applySelfDamage.call(gameLike, 10, { sourceType: "skill_cost" });
    assert.ok(captured, "expected applyDamage to be called");
    assert.strictEqual(captured.skipDamageFlash, true);
  });

  it("does not suppress damage flash for non-skill self-damage", async () => {
    const { Game } = await import("../src/game/game.js");

    let captured = null;
    const gameLike = {
      time: 123,
      pushPillarDebugEntry() {},
      applyDamage(args) {
        captured = args;
        return { applied: true, effectiveDamage: args.amount };
      }
    };

    Game.prototype.applySelfDamage.call(gameLike, 10, { sourceType: "self" });
    assert.ok(captured, "expected applyDamage to be called");
    assert.strictEqual(captured.skipDamageFlash, false);
  });

  it("still suppresses damage flash if caller passes skipDamageFlash: false", async () => {
    const { Game } = await import("../src/game/game.js");

    let captured = null;
    const gameLike = {
      time: 123,
      pushPillarDebugEntry() {},
      applyDamage(args) {
        captured = args;
        return { applied: true, effectiveDamage: args.amount };
      }
    };

    Game.prototype.applySelfDamage.call(gameLike, 10, { sourceType: "skill", skipDamageFlash: false });
    assert.ok(captured, "expected applyDamage to be called");
    assert.strictEqual(captured.skipDamageFlash, true);
  });
});

