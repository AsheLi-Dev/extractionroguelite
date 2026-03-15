# Project Overview

**Extract-Da-Panda** is a **roguelike action game** (top-down room-based) built with a **custom JavaScript/HTML5 engine**. The player fights through procedurally generated maps, levels up, chooses upgrades and weapon evolutions, and ultimately faces the Wasteland Tyrant. The game features:

- Procedural map/room generation with biomes and corridors
- Real-time combat with basic attacks, skills, projectiles, and enemy AI
- Level-up system with upgrade cards and weapon evolution (tier 1/2)
- Run-based progression with talents, pillars, rites, and legacy items
- Home base / hub area separate from the main run
- Save system (localStorage) for characters, conqueror vault, and legacy cube stash

The codebase is **vanilla JavaScript** (ES modules), no React/Vue or game framework; rendering is **Canvas 2D** with a fixed design resolution (640×360) scaled to the window.

---

# Folder Structure

| Directory | Purpose |
|-----------|---------|
| **`src/`** | All game source code |
| **`src/game/`** | Core `Game` class and mixins (loop, map, UI, input, level-up, loot, collision, enemy attacks, etc.) |
| **`src/entities/`** | Player, enemies, boss, projectiles, obstacles, loot, hazards, totems, breakables, searchable props, tile system |
| **`src/data/`** | Static definitions: maps, enemies, attacks, level-up, evolutions, talents, skills, pillars, shrines, loot, economy |
| **`src/ui/`** | Menus, pre-run screen, talent tree, pillar UI, save system, minimap, tutorial, tooltips |
| **`src/vfx/`** | Particles, fan-strike VFX, magic projectile renderer, primitives |
| **`src/rites/`** | Rite modules (Fear, Monstrosity, Torment, Sovereign) installed at bootstrap |
| **`src/systems/`** | Pillar runtime, rite runtime, friends system |
| **`src/home-base/`** | Hub scene, layout, map loader, interactables, orbit camera |
| **`src/utils/`** | Particle utilities; root `utils.js` for Vec2, collision helpers |
| **`tests/`** | Test files (talents, persistence, economy, progression, quests) |
| **`assets/`** | Art, audio, and environment assets (see Assets section) |
| **`styles/`** | CSS for main menu and in-game UI |

---

# Core Game Systems

## Game loop

- **Entry:** `index.html` loads the app; `src/bootstrap.js` runs on `DOMContentLoaded` and calls `bootstrap()`.
- **Bootstrap** wires main menu, pre-run, options, talent tree, friends, pillars; then `startGame(legacyItems, runConfig)` creates `new Game(canvas, runConfig)` and calls `game.start()`.
- **Loop:** `src/game/game-core.js` defines `loop(timestamp)` (requestAnimationFrame). Each frame: `this.update(dt)` then `this.render()`. The loop is started in `Game.prototype.start()` in `src/game/game.js`.
- **State:** The main `Game` constructor and `update(dt)` live in `src/game/game.js`; mixins add methods to `Game.prototype`.

| What | Where |
|------|--------|
| **Game loop** | `src/game/game-core.js` — `loop()`, `update()` delegation, `render()` call; `game.js` — `start()` kicks the loop |
| **Update logic** | `src/game/game.js` — `update(dt)` (player, camera, enemies, projectiles, collisions, damage, level-up checks, etc.) |
| **Pause / restart / return to menu** | `src/game/game-core.js` |

## Rendering

- **Single canvas:** One main canvas at design size 640×360, scaled via CSS; optional minimap canvas.
- **Rendering entry:** `Game.prototype.render()` in `src/game/game.js` (around line ~11366). It clears the canvas, applies camera shake, sets scale, then draws in order:
  - `this.world.draw(ctx, this.camera)` — world/tiles
  - Hazard system, loot system
  - **Y-sorted actors** (player, enemies, etc.) via `drawWorldActorsYSorted()`
  - Martyr/guard effects, ambush/hazard debug, obstacle/player hitbox debug
  - Search progress, treasure sense arrows
  - Enemy projectiles, death VFX
  - Tutorial highlights
  - Victory portal, map interactables (vaults, NPCs), pause overlay, etc.
- **World drawing:** The `World` class in `src/data/maps.js` holds tile/chunk data and draws the procedural level; `src/entities/tile-system.js` provides tile atlas loading and `drawTile`/`drawTileByName` for the tile atlas (`assets/Environments/tiles.png`).
- **Camera:** `src/camera.js` — `Camera` class; position updated in `game.js` with `camera.follow(player, worldWidth, worldHeight, dt)`. All world drawing uses `(worldX - camera.position.x, worldY - camera.position.y)` for screen position.
- **Resolution/layout:** `game-core.js` — `resizeCanvas()`, design size constants; `game-ui.js` — `layoutUiForDesignResolution()` for HUD layout.

| What | Where |
|------|--------|
| **Rendering pipeline** | `src/game/game.js` — `render()`, `drawWorldActorsYSorted()` |
| **World/tiles** | `src/data/maps.js` — `World` class and `draw`; `src/entities/tile-system.js` — tile atlas, `drawTile` |
| **Camera** | `src/camera.js` — `Camera`; used in `game.js` update and in all draw calls |
| **VFX** | `src/vfx/` — particles, fan-strike, magic projectile renderer; invoked from `game.js` and entities |

## Map generation

- **Procedural world:** `src/data/maps.js` — `createProceduralWorld(preset, seed, mapDef)` returns `{ world, startPixel }`. Uses `src/map-gen-blockers.js` for blocker/corridor grid (WALL/FLOOR, deterministic with seed).
- **Map definitions:** `MAP_DEFS`, `BIOME_ARCHETYPE`, biome grid, presets (`PRESET_SMALL`, `PRESET_MEDIUM`, `PRESET_LARGE`, `PRESET_BIOME`), and helpers like `buildArchetypeGrid`, `buildAllSubareaGrids`, `applyCorridorCellLayouts`, `applyLostCampCellLayouts`, `applyVaultCellLayouts` live in `src/data/maps.js`.
- **Usage:** `game.js` constructor calls `createProceduralWorld(preset, seed, mapDef)` to build the current level; `game-map.js` uses it for map transitions and restoring saved map state. Obstacles, breakables, searchable props, shrines, NPCs, vaults, and enemy spawn zones are applied in `game-map.js` and related data files.

| What | Where |
|------|--------|
| **Map generation** | `src/data/maps.js` — `createProceduralWorld`, `World`, `MAP_DEFS`, biome/cell logic |
| **Blocker/corridor grid** | `src/map-gen-blockers.js` — `generateBlockerMap`, `mulberry32`, presets |
| **Map transitions / obstacles / spawns** | `src/game/game-map.js` — room exits, obstacles, breakables, NPCs, vaults, enemy state save/load |

## Player movement

- **Player class:** `src/player.js` — `Player` with `position`, `size`, `speed`, animation state, facing direction, attack state/combo.
- **Movement input:** `src/game/game-input.js` — mouse/keyboard; `src/input.js` — `Input` class (keys, mouse). Movement is applied in `game.js` in `update(dt)` (e.g. reading input and updating `player.position` with wall/collision checks).
- **Collision:** `src/game/game-collision.js` — wall and obstacle collision; `PLAYER_WALL_COLLISION_INSET` and helpers in `utils.js` (e.g. `obstacleIntersectsRect`, `getObstacleCollisionRect`).

| What | Where |
|------|--------|
| **Player state & movement** | `src/player.js` — `Player`; `src/game/game.js` — update of position from input |
| **Input** | `src/input.js`, `src/game/game-input.js` — `getWorldPositionFromClick`, `onCanvasMouseDown`, etc. |
| **Player–wall/obstacle collision** | `src/game/game-collision.js`, `src/utils.js` |

## Enemy logic

- **Enemy type definitions:** `src/entities/enemy.js` — `ENEMY_TYPES`, `UNDEAD_HERO_TYPES`, `AFFIX_DEFS`, `Enemy` class (health, position, affixes, tiers, status effects).
- **Enemy system:** `src/entities/enemy-system.js` — `EnemySystem` (enemies array, boss, projectiles, spawn pools). Handles `spawnInitial`, respawn queue, undead hero spawn; uses `EnemyAttackController` from `src/entities/attacks/`.
- **Enemy attacks:** `src/game/game-enemy-attacks.js` — mixin for enemy attack behavior; `src/entities/attacks/` — `EnemyAttackController`, attack kits, telegraph rendering.
- **Boss:** `src/entities/boss.js` — `Boss` class, `BOSS_MAX_HP`, `BOSS_ATTACK`, etc.
- **Damage:** In `game.js` — `dealDamageToEnemy(enemy, amount, opts)`, `applyDamage({ targetType, target, amount, ... })`; projectile and skill hits funnel through here.

| What | Where |
|------|--------|
| **Enemy types & state** | `src/entities/enemy.js` — `Enemy`, `ENEMY_TYPES`, `AFFIX_DEFS` |
| **Enemy spawn & list** | `src/entities/enemy-system.js` — `EnemySystem` |
| **Enemy AI / attacks** | `src/game/game-enemy-attacks.js`, `src/entities/attacks/` |
| **Boss** | `src/entities/boss.js` |
| **Damage application** | `src/game/game.js` — `dealDamageToEnemy`, `applyDamage` |

## UI

- **In-game HUD:** `src/game/game-ui.js` — mixin: `updateXpUI`, `updateMapUI`, `updateEnemyCountUI`, `updateSkillUI`, `layoutUiForDesignResolution`, pause overlay, level-up overlay wiring. DOM elements for health, XP, gold, map name, skill bar are in `index.html`.
- **Main menu / pre-run / modals:** `src/ui/main-menu.js`, `src/ui/pre-run.js`, `src/ui/talent-tree-ui.js`, `src/ui/pillar-ui.js`, `src/ui/legacy-vault.js`, `src/ui/skill-library.js`, `src/ui/friends-ui.js`. Pre-run and menu callbacks are set from `bootstrap.js`.
- **Level-up cards:** Built and shown in `game-levelup.js` and `game.js`; DOM overlay in `index.html`.
- **Minimap:** `src/ui/minimap.js` — `initMinimap`, `layoutMinimap`, `setMinimapWorld`, `renderMinimap`.
- **Tutorial:** `src/ui/tutorial.js` — `TutorialSystem`, rendered in `game.js` `render()`.
- **Tooltips:** `src/ui/tooltips.js`.

| What | Where |
|------|--------|
| **In-game HUD** | `src/game/game-ui.js`; DOM in `index.html` (skill bar, health, XP, gold, map name) |
| **Main menu / pre-run / modals** | `src/ui/main-menu.js`, `src/ui/pre-run.js`, `src/ui/talent-tree-ui.js`, `src/ui/pillar-ui.js`, etc. |
| **Level-up overlay** | `src/game/game-levelup.js`, `src/game/game.js`; HTML in `index.html` |
| **Minimap** | `src/ui/minimap.js` |
| **Tutorial** | `src/ui/tutorial.js` |

---

# Rendering Pipeline

1. **game-core.js** `loop()` → `this.update(dt)` then `this.render()`.
2. **game.js** `render()`: clear canvas, apply shake transform, set scale from design size to canvas size.
3. Draw **world**: `this.world.draw(ctx, this.camera)` (tiles/chunks from `maps.js` + tile-system).
4. Draw **hazards**, **loot**, then **Y-sorted actors** (player, enemies, etc. by `sortY`).
5. Draw overlays: martyr/guard, ambush/hazard debug, hitbox debug, search progress, treasure sense, enemy projectiles, death VFX.
6. Draw **tutorial**, **victory portal**, **map interactables** (vaults, NPCs).
7. Draw **pause overlay** and other UI overlays as needed; minimap is a separate canvas updated elsewhere.

All coordinates are world-space; drawing uses `(x - camera.position.x, y - camera.position.y)` for screen position.

---

# Map Generation

- **High-level:** `createProceduralWorld(preset, seed, mapDef)` in `src/data/maps.js` builds a `World` and start pixel. Presets and biomes control size and layout.
- **Grid:** `map-gen-blockers.js` produces a 2D grid (WALL/FLOOR) with corridors and rooms; deterministic via `mulberry32(seed)`.
- **World:** `World` in `maps.js` holds tile/chunk data, wall rects, and draws via the tile system. Map-specific logic (lost camp, vault, miniboss, etc.) is applied with functions like `applyLostCampCellLayouts`, `applyVaultCellLayouts`, `applyMinibossCellDecorations`.
- **Obstacles / props / spawns:** Placed in `game-map.js` using map def and world data; obstacle/breakable/searchable definitions in `data/obstacles.js`, `data/breakables-data.js`, `data/searchable-props-data.js`, etc.

---

# Assets

Important asset folders under `assets/`:

| Folder | Contents |
|--------|----------|
| **`assets/Audio/`** | BGM, SFX (damage, attacks, collect, etc.) |
| **`assets/Enemies/`** | Per-enemy sprite sheets (Idle, Move, ATK, Hit, etc.); subfolders by enemy name (Goblins, Minotaur, Undead Heroes, etc.) |
| **`assets/Environments/`** | Tiles, biomes (Forest Land, Desert Land), blocks, decorative props, vault entrance, chest/treasure sprites |
| **`assets/images/`** | Player (idle, run, main_attacks, dead), talent tree icons, items, clan images |
| **`assets/UI/`** | Skill icons, travel book, UI frames |
| **`assets/Hub;Base/`** | Hub-specific art (trees, shrubs, companions, etc.) |

Tile atlas for the procedural world: `assets/Environments/tiles.png` (and `tiles.txt` for tile names). Blocker chunks: `assets/Environments/blocks%20for%20empty%20grid.png`.

---

# Important Files

| File | Responsibility |
|------|----------------|
| **`index.html`** | App shell, main menu DOM, game root, canvas, skill bar, health/XP/gold HUD, overlays (level-up, pause, notifications) |
| **`src/bootstrap.js`** | App entry, main menu/pre-run/pillars/talent tree/friends wiring, `startGame`, scene transitions, home base vs run |
| **`src/main.js`** | Alternate/legacy entry if used; check which script is the actual entry in `index.html` |
| **`src/game/game.js`** | Main `Game` class: constructor, `start()`, `update(dt)`, `render()`, damage (dealDamageToEnemy, applyDamage), basic attack (tryBasicAttack, executeBasicAttackByType, firePlayerProjectile), level-up hooks, mixin application. Very large (~12k+ lines). |
| **`src/game/game-core.js`** | Mixin: `loop()`, `resizeCanvas()`, `togglePause()`, restart, returnToMainMenu |
| **`src/game/game-map.js`** | Mixin: map transitions, obstacles, breakables, searchables, shrines, NPCs, vaults, save/load map enemy state, procedural world creation on transition |
| **`src/game/game-ui.js`** | Mixin: XP/map/gold/enemy count/skill UI, layout for design resolution, pause/level-up overlay wiring |
| **`src/game/game-input.js`** | Mixin: getWorldPositionFromScreen/FromClick, onCanvasMouseDown (basic attack, pause buttons) |
| **`src/game/game-levelup.js`** | Mixin: grantXP, checkLevelUp, showLevelUpChoices, applyLevelUpChoice, evolution prompts, applyTransformChoice |
| **`src/game/game-collision.js`** | Mixin: player vs walls/obstacles |
| **`src/game/game-enemy-attacks.js`** | Mixin: enemy attack behavior |
| **`src/game/game-loot.js`** | Mixin: loot drops, gold, cubes |
| **`src/game/game-inventory.js`** | Mixin: equipment/inventory, rings |
| **`src/data/maps.js`** | MAP_DEFS, createProceduralWorld, World class, biome/cell helpers, tile/chunk drawing |
| **`src/map-gen-blockers.js`** | Procedural blocker grid (WALL/FLOOR), mulberry32, presets |
| **`src/player.js`** | Player class: position, size, speed, animation, attack state |
| **`src/entities/enemy.js`** | Enemy class, ENEMY_TYPES, AFFIX_DEFS, getXpForLevel |
| **`src/entities/enemy-system.js`** | EnemySystem: spawn, respawn, boss, projectiles |
| **`src/entities/boss.js`** | Boss class and boss constants |
| **`src/entities/projectile.js`** | PlayerProjectile, EnemyProjectile, Projectile |
| **`src/camera.js`** | Camera class: follow, snapTo |
| **`src/input.js`** | Input class for keyboard/mouse state |
| **`src/audio.js`** | BGM/SFX play, mute, preload |
| **`src/ui/save-system.js`** | localStorage: characters, conqueror vault, legacy cube stash, run state persistence |
| **`src/data/level-up-data.js`** | ATTACK_UPGRADE_DEFS, getBuildUpgradePoolForAttackType, rollUpgradeValue |
| **`src/data/attack-evolutions.js`** | ATTACK_EVOLUTION_DEFS, getTier1EvolutionOptions, getTier2EvolutionOptions, applyTransformChoice usage |
| **`src/data/conditions.js`** | RUN_CONDITIONS, ATTACK_TYPES, pickRandomConditions |
| **`src/entities/tile-system.js`** | Tile atlas load, drawTile, drawTileByName |

---

# Custom Engine Architecture

- **No framework:** The game uses vanilla JS (ES modules), HTML5 Canvas 2D, and DOM for UI. No Phaser, Unity, or React.
- **Single Game class + mixins:** The core object is `Game` in `game.js`. Behavior is split across many mixins (`applyGameCoreMixin`, `applyGameMapMixin`, `applyGameUIMixin`, `applyGameInputMixin`, `applyGameLevelUpMixin`, etc.) that attach methods to `Game.prototype`. This keeps concerns in separate files while still having one big `game.js` for constructor, `update`, and `render`.
- **Design resolution:** 640×360 internal; canvas is scaled to fit the window (or a resolution cap). UI is laid out relative to this and the canvas position (`layoutUiForDesignResolution`).
- **Run state on Game:** XP, level, runAttackUpgrades, runAttackPenalties, weaponEvolutionState, tier1EvolutionId, tier2EvolutionId, attackType, clearedMaps, mapEnemyStates, runConfig all live on the `Game` instance. Persistence is handled by `save-system.js` and bootstrap.
- **Data-driven content:** Enemies, attacks, upgrades, evolutions, maps, talents, skills, pillars, and loot are defined in `src/data/*.js` and referenced by ID or type. Changing content usually means editing the right data file and the code that reads it (often `game.js` or a mixin).
- **Large files:** `game.js` and `entities/enemy.js` are very large. When changing combat, level-up, or core loop behavior, expect to touch `game.js`; when changing enemy types or XP curve, expect to touch `entities/enemy.js` and possibly `game-levelup.js` / `data/level-up-data.js` / `data/attack-evolutions.js`.

For more detail on data flows (level-up, basic attack, damage, enemy death, upgrades), see **`ARCHITECTURE.md`** in the repository root.
