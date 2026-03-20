## Skill effect handler migration notes

This is a lightweight checklist to keep `src/game/game.js` migrations incremental and safe.

### Extracted update + draw
- `assimilativeOrb`
- `spiritBanner`
- `loyalDragons`
- `hunterShot`
- `homingSkull`

### Extracted update only
- `fireball`
- `iceShard`
- `iceRain`

### Still inline in `game.js`
- All other `skillEffects` types not listed above (see `Game.prototype.updateSkillEffects` and `Game.prototype.drawSkillEffects` in `src/game/game.js`).

