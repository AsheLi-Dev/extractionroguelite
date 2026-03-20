# Run Route Grid (Overworld) Notes

This document describes the current node-based run route system.

## Scope

- A run creates a `4x4` **node grid**.
- Each node corresponds to one biome encounter instance.
- This replaces the old linear map progression behavior for route-enabled runs.
- Rest room code still exists but is intentionally not used in route mode.

## Data model

Primary generator: `src/game/run-route-grid.js`

- `GRID_SIZE = 4`
- `NODE_TYPES = { SAFE, ELITE, DANGER, BOSS }`
- `generateRunMap()` builds a 2D array of node objects:
  - `x`, `y`
  - `type`
  - `visited`

Game state fields (in `src/game/game.js`):

- `runMapNodes`
- `nodeX`, `nodeY` (current node coordinates)
- `enableRunRouteGraph`
- `runRouteOverlayVisible`
- `currentMapStateKey` (node-keyed state identity)

## Route mode behavior

Route mode is enabled when not tutorial and not biome-test run:

- `enableRunRouteGraph = !tutorialMode && !isForestBiomeTestMap`

Overlay visibility:

- Default is OFF (`runRouteOverlayVisible = false`)
- `Tab` toggles overlay on/off

## Node entry and biome loading

Entry flow:

1. `enterNode()`
2. mark node as visited
3. set `currentMapStateKey = node:x,y`
4. `loadBiomeForNode(node)`
5. `transitionToMap(...)` using existing biome systems

Each node keeps a stable biome template:

- `node.biomeMapId` is assigned on first entry and reused later

## Node isolation (important)

Node persistence uses `currentMapStateKey` (`node:x,y`) rather than plain map id.

This ensures separate node instances do not share:

- enemy state
- environment/interactable state
- visited markers
- cleared markers

## Progression condition

Progression is tied to **miniboss kill**, not full-map clear.

On miniboss kill (route mode):

- mark node cleared
- spawn node-exit portals
- do NOT spawn extraction portal

## Exit portal behavior

Portal spawner: `spawnExitPortals(force = false, anchor = null)`

- One portal per connected node
- Connected nodes are adjacent cardinal neighbors (left/right/up/down)
- Already visited nodes are filtered out
- Spawn anchor is miniboss kill position when triggered by miniboss death
- Placement performs collision-safe fallback (tile walls, obstacles, breakables)

Portal interaction:

- `type: "nodeExitPortal"`
- carries `targetNodeX`, `targetNodeY`
- on interact: update node coords, call `enterNode()`

## Transition overrides in route mode

`game-map` transition logic respects route mode by:

- skipping rest room insertion
- using route state key (`stateKey`) for save/restore/visited checks
- disabling boss extraction timer branch for route mode

## Overworld overlay

Renderer: `drawRunRouteMapOverlay(ctx)`

- centered on screen
- displays full 4x4 graph
- shows links, visited state, current node highlight
- includes legend
- hidden by default, toggled by `Tab`
