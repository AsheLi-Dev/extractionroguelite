# Game Architecture Overview

## Main Entry / Core Loop

- **Entry:** `index.html` loads the app; `src/bootstrap.js` runs on `DOMContentLoaded` via `bootstrap()`.
- **Bootstrap** (`src/bootstrap.js`): Wires main menu, pre-run, options, talent tree, friends, pillars; calls `startGame(legacyItems, runConfig)` to begin a run.
- **Game start:** `startGame` / `startGameImmediate` create `new Game(canvas, runConfig)` and call `game.start()`.
- **Main loop:** `src/game/game-core.js` defines `loop(timestamp)` (requestAnimationFrame). It calls `this.update(dt)` and `this.render()`. The loop is started in `Game.prototype.start()` in `src/game/game.js` (e.g. `requestAnimationFrame((t) => this.loop(t))`).
- **State updates / init:** `game.js` owns the main `update(dt)` and the bulk of game state initialization in the `Game` constructor. Initialization is centralized in the constructor; mixins add methods.

## Core Systems

| System | File(s) | Purpose | Notable exports / methods |
|--------|---------|---------|---------------------------|
| **Game loop / init** | `game-core.js`, `game.js` | Loop (loop, update, render), canvas resize, pause, restart, returnToMainMenu. Game constructor and `start()` live in `game.js`. | `applyGameCoreMixin`, `loop()`, `update(dt)`, `resizeCanvas()` |
| **Player state** | `player.js` | Player position, size, speed, animation, attack state, sprite sets. | `Player` class |
| **Enemy state / AI** | `enemy.js`, `enemy-system.js`, `game-enemy-attacks.js`, `entities/attacks/` | Enemy instances (health, position, affixes, tiers), spawn pools, attack controllers. Enemy types and per-type sprite sheets in `enemy.js`. | `Enemy`, `ENEMY_TYPES`, `AFFIX_DEFS`, `EnemySystem`, `EnemyAttackController`, `spawnEnemyProjectile`, `spawnEnemyMinion` |
| **Combat / damage** | `game.js` | Central damage path: `dealDamageToEnemy(enemy, amount, opts)`, `applyDamage({ targetType, target, amount, ... })`. Projectile–enemy and skill hits funnel here. | `dealDamageToEnemy`, `applyDamage` |
| **Weapons / basic attacks** | `game.js`, `projectile.js`, `ring-effects.js` | Basic attack: input → `tryBasicAttack` → `executeBasicAttackByType` → e.g. `firePlayerProjectile`. Projectile creation and movement in `projectile.js`. | `tryBasicAttack`, `executeBasicAttackByType`, `firePlayerProjectile`, `PlayerProjectile` |
| **Leveling / upgrades** | `game-levelup.js`, `game.js`, `level-up-data.js` | XP, level threshold, level-up choice UI. Upgrade cards (standard/penalty/unique) and application. `grantXP`, `checkLevelUp`, `showLevelUpChoices`, `buildLevelUpCards`, `applyLevelUpChoice` (both in `game.js` and overridden/extended in `game-levelup.js`). | `grantXP`, `checkLevelUp`, `showLevelUpChoices`, `applyLevelUpChoice`, `grantRandomSelectedUpgrade`, `ATTACK_UPGRADE_DEFS`, `getBuildUpgradePoolForAttackType` |
| **Weapon evolution** | `game-levelup.js`, `attack-evolutions.js` | Tier 1/2 evolutions for base weapon (e.g. ProjectileShot). Choice prompts and `applyTransformChoice`. | `getAttackEvolutionById`, `getTier1EvolutionOptions`, `getTier2EvolutionOptions`, `applyTransformChoice`, `ATTACK_EVOLUTION_DEFS` |
| **UI / HUD / menus** | `game-ui.js`, `main-menu.js`, `pre-run.js`, `talent-tree-ui.js`, `pillar-ui.js`, `index.html` | XP bar, level label, map name, gold, enemy count, skill bar, pause overlay, level-up overlay. Main menu and pre-run screens. | `updateXpUI`, `layoutUiForDesignResolution`; menu/open/close for pre-run, talent tree, pillars |
| **Map / rooms / spawning** | `game-map.js`, `data/maps.js`, `enemy-system.js` | Map definitions, procedural world, room/obstacle/spawn logic. Enemy spawn: `EnemySystem.spawnInitial`, per-map state save/restore. | `MAP_DEFS`, `createProceduralWorld`, `World`, `spawnObstacles`, `saveMapEnemyState`, `loadMapEnemyState` |
| **Save / run state** | `save-system.js`, `bootstrap.js`, `game.js` | localStorage: characters, conqueror vault, legacy cube stash, eternal items on defeat. Run state lives on `Game`: `xp`, `level`, `runAttackUpgrades`, `runAttackPenalties`, `weaponEvolutionState`, `clearedMaps`, `mapEnemyStates`, etc. | `loadConquerorVault`, `loadLegacyCubeStash`, `consumeLegacyCubeStash`, `loadSavedCharacters` |

## Important Data Flows

- **Player level up:** Enemy killed → `dropLootFromEnemy` (in update when pruning dead enemies) → `grantXPFromEnemy` → `grantXP` → `checkLevelUp` → if `xp >= getXpForLevel(level+1)` then `level++`, `showLevelUpChoices()` → overlay shows cards → `applyLevelUpChoice` applies upgrades/penalties and closes overlay.
- **Basic attack firing:** Mouse down (or held) → `onCanvasMouseDown` / repeat → `tryBasicAttack(targetX, targetY)` → `executeBasicAttackByType(attackType, targetX, targetY)` → e.g. for projectile: `firePlayerProjectile(targetX, targetY, damageMult, options)`. Projectiles updated in `updatePlayerProjectiles(dt)`; collision with enemies triggers damage.
- **Damage application:** Projectile/skill hits enemy → game calls `dealDamageToEnemy(enemy, amount, opts)`. That applies modifiers (rings, pillars, ancestor, etc.), then `enemy.takeDamage(dmg)`. Death handling (XP, loot, VFX, tutorial, pillars) runs after in the same path.
- **Enemy death:** Inside `dealDamageToEnemy`, when `enemy.isDead`: VFX, SFX, tutorial hooks, pillar `afterKillEnemy`, blessings (e.g. aftershock). Dead enemies are pruned in the main update loop; pruning calls `dropLootFromEnemy(enemy)` which calls `grantXPFromEnemy(enemy)` and spawns gold/loot/cubes.
- **Upgrade application:** Level-up card click → `applyLevelUpChoice(card, cardEl)` → push upgrades/penalties to `runAttackUpgrades` / `runAttackPenalties` → `recalculateStats()`, `updateXpUI()`, `checkLevelUp()`. Evolution choice → `applyTransformChoice(transformOption)` updates `weaponEvolutionState` and `tier1EvolutionId` / `tier2EvolutionId`.

## Key Globals / Registries / Config Objects

- **Weapon/attack:** `ATTACK_TYPES` (`data/conditions.js`). `ATTACK_UPGRADE_DEFS` per attack type (`data/level-up-data.js`). `ATTACK_EVOLUTION_DEFS`, `TIER1_EVOLUTION_BY_CATEGORY`, `TIER2_EVOLUTION_MATRIX` (`data/attack-evolutions.js`).
- **Enemies:** `ENEMY_TYPES`, `UNDEAD_HERO_TYPES`, `AFFIX_DEFS`, `NEW_ENEMY_DATA`-derived types, `getXpForLevel` (`entities/enemy.js`). Boss: `BOSS_MAX_HP`, `BOSS_ATTACK`, etc. (`entities/boss.js`).
- **Upgrades (level-up):** `ATTACK_UPGRADE_DEFS` (standard/unique upgrades and penalties per attack type), `getBuildUpgradePoolForAttackType`, `rollUpgradeValue` (`data/level-up-data.js`).
- **Evolution:** `getAttackEvolutionById`, `getTier1EvolutionOptions`, `getTier2EvolutionOptions` (`data/attack-evolutions.js`).
- **Run state (on Game):** `xp`, `level`, `runAttackUpgrades`, `runAttackPenalties`, `selectedUpgrades`, `categoryCounts`, `weaponEvolutionState`, `tier1EvolutionId`, `tier2EvolutionId`, `attackType`, `clearedMaps`, `mapEnemyStates`, `runConfig`.
- **Player state (on Game):** `player` (Player instance), `playerProjectiles`, `playerAttackCooldown`, `playerAttackTimer`; equipment/inventory in `game-inventory.js` mixin.
- **Save keys:** `SAVE_KEY`, `CONQUEROR_VAULT_KEY`, `LEGACY_CUBE_STASH_KEY`, etc. (`ui/save-system.js`).

## Current Upgrade / Evolution Hooks

- **Level-up logic:** `game-levelup.js` mixin provides `grantXP`, `checkLevelUp`, `showLevelUpChoices`, `applyLevelUpChoice`, `buildLevelUpCards` (overrides or extends same-named methods on Game). Evolution prompts: `openEvolutionPrompt`, `applyTransformChoice`, `getTier1EvolutionChoiceDefs`, `getTier2EvolutionChoiceDefs`. When to show evolution vs standard cards is driven from `checkLevelUp` in the same mixin (e.g. tier gates and category counts).
- **Weapon evolution application:** `applyTransformChoice` in `game-levelup.js` writes to `game.weaponEvolutionState`, `game.weaponEvolutions`, `game.tier1EvolutionId`, `game.tier2EvolutionId`. Actual attack behavior (e.g. projectile stats, burst fire) is read elsewhere in `game.js` (e.g. when building attack params for `firePlayerProjectile`) using these fields and `getAttackEvolutionById` / evolution overrides.

## Notes For Future Refactors

- **Leveling reworks:** Prefer editing `src/game/game-levelup.js` and `src/data/level-up-data.js`. Also touch `game.js` where `checkLevelUp`, `showLevelUpChoices`, `buildLevelUpCards`, or `grantXP` are defined if not fully overridden by the mixin. XP threshold comes from `getXpForLevel` in `entities/enemy.js`.
- **Weapon evolution reworks:** Prefer `src/data/attack-evolutions.js` for definitions and `src/game/game-levelup.js` for choice flow and `applyTransformChoice`. Attack execution (e.g. projectile count, damage mult, fire mode) is in `game.js` (e.g. around `executeBasicAttackByType` / `firePlayerProjectile`), which reads evolution state and applies overrides.
- **Risky coupling / large files:** `src/game/game.js` is a very large single file (order of ~11k+ lines) containing constructor, `update(dt)`, render paths, damage, attacks, level-up UI implementation, and many other systems. Much of the game logic is in this one file; mixins add methods but a lot remains in `game.js`. Changing combat or level-up behavior often requires editing this file. Enemy logic and sprite sheet helpers are in `entities/enemy.js`, which is also large (needs verification for exact line count). Pillar system (`game-pillar.js`) and rite modules add more behavior and hooks; refactors that touch damage or events may need to consider those as well.
