# Game Class Mixin Modules

The Game class has been split into a shell file (`game.js`) containing the constructor, and mixin modules that add methods to `Game.prototype`.

## Structure

- `game.js` - Contains the Game class constructor and property initialization
- `game-*.js` - Mixin modules that add methods to Game.prototype

## Pattern

Each mixin module exports a function that takes the Game class and adds methods to its prototype:

```javascript
export function applyGameXxxMixin(Game) {
  Object.assign(Game.prototype, {
    method1() { ... },
    method2() { ... },
    // etc
  });
}
```

Then in `game.js`, after the class definition:

```javascript
import { applyGameXxxMixin } from './game-xxx.js';
applyGameXxxMixin(Game);
```

## Mixin Modules (to be created/populated)

- `game-core.js` - Core methods (resizeCanvas, loop, togglePause, restartGame, returnToMainMenu, initDevUI, toggleDevPanel)
- `game-inventory.js` - Inventory and crafting methods
- `game-victory.js` - Game over and victory screens
- `game-update.js` - Main update loop and update methods
- `game-map.js` - Map transitions, spawning, sub-areas
- `game-events.js` - Event system
- `game-ui.js` - UI update methods
- `game-levelup.js` - Level up system
- `game-input.js` - Input handling
- `game-combat.js` - Combat, attacks, skills
- `game-collision.js` - Collision detection
- `game-render.js` - Rendering methods
- `game-loot.js` - Loot handling
- `game-shrines.js` - Shrine interactions
- `game-stats.js` - Stats calculation
- `game-dev.js` - Dev tools

## Status

Currently, only `game-core.js` has been populated with a few core methods as a demonstration. The remaining mixin modules need to have methods extracted from `main.js` and moved into them.

To complete the refactoring:
1. Read methods from `main.js` (starting around line 459)
2. Group them by functionality
3. Move them into the appropriate mixin module
4. Update `game.js` to import and apply each mixin
5. Remove the methods from `main.js`
6. Update `main.js` to import Game from `./game/game.js`
