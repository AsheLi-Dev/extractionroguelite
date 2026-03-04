# Dev Log

## 2026-03-04

### Map identity and pacing pass

- **Files:** `src/game/game-map.js`, `src/entities/enemy-system.js`, `src/entities/hazard.js`
- Added map-specific obstacle density/composition to strengthen combat identity per zone.
- **Dungeon (id 0):** significantly increased blocker count and weighted toward `giantRock` + `ruinedPillar` for tighter pathing and ambush pressure.
- **Forest (id 1):** strongly increased obstacle count with heavy `ancientTree` weighting to increase mobility and kiting pressure.
- **Castle (id 3):** reworked initial composition to spawn 2 mini-boss groups, with at least 4 guaranteed elite groups and additional elite-biased groups after that.
- **Cave (id 2):** added moving boulder hazards that cross the map and deal **40** damage on collision with player cooldown gating.
- Cave boulder behavior updated so horizontal boulders no longer originate from the left side; they now always enter from the right side and move left.

### Spawn, loot, and inventory polish pass

- **Files:** `src/entities/enemy-system.js`, `src/game/game.js`, `src/entities/loot.js`, `src/game/game-inventory.js`, `src/data/conditions.js`, `styles/ui.css`, `styles/dev.css`
- Enemy spawn safety now uses a dynamic entry safe zone around the player, so enemies do not spawn on top of map-entry positions.
- Player dashes now pass through `ancientTree` obstacles while still colliding with other blocking geometry.
- Castle now always spawns a Human Squad near the map exit, and that squad is forced as elite (elite tier stats/affixes).
- Floor loot now displays item names above drops.
- Loot labels now run through anti-overlap layout so nearby item names stack instead of drawing over each other.
- Added a 1-second pickup delay for dropped loot before auto-pickup can occur.
- Inventory item presentation changed to sectioned lists: **Weapon**, **Helmet**, **Body Armour**, **Boots**, with rarity sorting inside each section.
- Inventory section headers were visually enhanced (larger and bold).
- Run condition rules now enforce a hard cap of **2 ground modifiers** per run (`frozenGround`, `toxicGround`, `burningGround`, `shockingGround`, `weakeningGround`).

## 2025-03-03

### Enemy melee range doubled

- **File:** `src/entities/attacks/enemy-attack-kits.js`
- Doubled range/radius/dash distance for all melee-style attacks so they’re easier to see and react to.
- **Cones (range):** orc_cleave (150→300), death_knight_cleave (180→360), banshee_scream (200→400), drake_fire_breath (240→480).
- **Rings (inner/outer):** orc_ground_slam, banshee_expanding_scream, dryad_root_cage, rock_golem_ground_punch, drake_tail_spin — all inner/outer radii doubled.
- **Circles (radius):** troll_heavy_smash, ettin_alternating_slam, ettin_twin_combo, big_slime_jump_slam, goblin_archer_rain_volley, lich_death_circle, giant_spider_web_trap, drake_fire_rain — all radii doubled.
- **Dashes (dashDist):** goblin_dash_stab (90→180), goblin_triple_dash (70→140), death_knight_charge (280→560), manticore_aerial_swoop (180→360).
- Projectile speeds, teleports, summons, and non-melee execute params were left unchanged.

### Rooted enemies can attack

- **Files:** `src/entities/attacks/enemy-attack-controller.js`, `src/entities/enemy.js`
- Rooted enemies were not using attack-kit abilities (cones, slams, projectiles, etc.); they only had contact damage.
- **Cause 1:** `EnemyAttackController.canAct()` returned false when the enemy had the `rooted` affix. Removed that check so rooted enemies are allowed to act for attacks.
- **Cause 2:** Rooted enemies hit an early `return` in `Enemy.update()` before any logic that sets `this.activated = true`. The attack controller only runs its “pick and execute attack” flow when `enemy.activated` is true, so rooted enemies never became valid to attack.
- **Fix:** In the rooted branch of `enemy.js`, before the early return we now compute distance to the player and set `this.activated = true` when the player is within `detectionRange`. Rooted enemies still do not move (early return unchanged) but now activate and can use their full attack kits.
