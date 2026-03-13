# Attack Test Harness (Phase 1 + Phase 2)

Lightweight, headless test harness for attack logic. No DOM, no canvas, no full game loop.

## What it covers

**Phase 1**
- **Soul Siphon**: derived stats (beam length/width/damage), damage modifiers, soul/kill economy, spirit interactions, Ground Slam constants, proc safety.
- **Deterministic runs**: seeded RNG (`createSeededRandom(seed)`).
- **Event log**: `beam_hit`, `enemy_killed`, `souls_gained`, `spirit_charged`, `healed`, etc.

**Phase 2**
- **Spirit projectile / assist**: Twin Fireball (max 2 projectiles), Spirit Overload (ICD), Lingering Souls (target present/absent), Ancestral Awakening (two assists), Spirit Reflex (cooldown 0.35s per stack).
- **XP / evolution / chest**: Ancient Spirit bonus XP, Spiritual Resonance evolution hook (8 souls per stack), Chest Spirits (12% per stack, source: chest).
- **Short scenarios**: Summon Spirit at 10 souls, beam charges Spirit, Focused Channel ramp, soul economy chain, Spirit support chain.
- **Proc safety**: Bounded event counts for Echoing Beam, Spirit Overload, Soul Burst, Soul Magnet, Ancestral Awakening.

## How to run tests

```bash
npm test
# or only Soul Siphon:
node --test tests/soul-siphon.test.js
```

## How to add a new attack test

1. Reuse **attack-event-log.js** and **attack-test-harness.js** (createHarnessContext, createMinimalEnemy, createSeededRandom).
2. For stat formulas: add a small stats module (or reuse existing) and call it from tests; optionally wire the real game to the same module so logic stays in one place.
3. Add a new `describe` in a test file (e.g. `tests/projectile-shot.test.js`) and use the harness context + event log + step simulator pattern.
4. For full-game integration (e.g. real `dealDamageToEnemy`), consider a thin adapter that runs in Node with mocks; Phase 1 does not require it.

## What is intentionally deferred (post–Phase 2)

- Full game loop or rendering.
- Real hitbox system / combat resolution (harness uses minimal beam-rect overlap and step simulator).
- Projectile Shot / Fan Strike test suites (harness is ready to extend).
- Full evolution/transform flow (only Spiritual Resonance hook and event are tested).
- Reaping Pulse (not in codebase).
- Echoing Beam recursive-echo behavior in harness (safety is bounded event count only).
- Full integration with game’s `dealDamageToEnemy` / `applyDamage` (harness applies damage in-step only).

## Files

| File | Purpose |
|------|--------|
| `attack-event-log.js` | Event log: `log(type, data)`, `getEvents()`, `getEventsByType(type)`. |
| `attack-test-harness.js` | Seeded RNG, minimal player/enemy, harness context, beam rect geometry, `stepSoulSiphonBeam` (beam hit, kill, souls, Lingering Souls, Soul Burst, Spirit Overload). |
| `soul-siphon-phase2-helpers.js` | `simulateSpiritAssist`, `simulateSpiritAssistAncestral`, `simulateChestOpen`, `fireEvolutionHookSoulSiphon`, `grantXp`, `wouldSummonSpirit`, `getNearestEnemy`. |
| `../soul-siphon.test.js` | Soul Siphon test suite (Phase 1 + Phase 2: stats, damage, souls, spirit, Ground Slam, safety, Spirit projectile/assist, XP/evolution/chest, scenarios, proc safety). |

Production code:

| File | Purpose |
|------|--------|
| `src/game/soul-siphon-stats.js` | Beam stats, attack speed mult, Soul Mastery CDR (used by game and tests). |
