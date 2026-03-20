# Equipment Modifier System Completion Plan

## Goal
Finish the item/equipment modifier system so passive, conditional, and triggered effects are data-driven, consistently applied, and safe to balance.

## Phase 1 - Data & Coverage Audit (Low Risk)
- **Inventory current modifier definitions** in `src/data/loot-data.js` and map each to runtime support status.
- **Fill missing modifier defs** (IDs already planned) with:
  - `id`, `label`, `rarity`, `allowedSlots`
  - `trigger` and/or `conditional` metadata where relevant
  - `data` payload shape for duration/chance/stack limits when needed
- **Ensure item stat builders skip non-stat runtime modifiers** (no accidental `stats.null` keys).
- **Validation**
  - modifier pool loads
  - generation still enforces 0/1/2 rarity counts
  - slot restrictions still filter correctly

## Phase 2 - Runtime Handler Completion (Low/Medium Risk)
- Extend `src/game/equipment-modifier-runtime.js` handler map for remaining simple and medium effects:
  - passive helpers (if needed)
  - conditional helpers
  - trigger handlers (heal/xp/buff/chance/proc)
- Add small helper utilities for repeated behavior (timed buff set/stack/chance), keeping module lightweight.
- **Validation**
  - each handler runs without errors when equipped
  - no-op safety when modifiers are absent
  - timed buffs expire as expected

## Phase 3 - Event Dispatch Completion (Medium Risk)
- Audit and complete event emission points in game flow:
  - `kill`, `kill_miniboss`, `level_up`, `gold_picked_up`, `enter_new_map`, `chest_opened`, `dash_used`, `item_picked_up`
  - add `basic_attack_hit`, `critical_hit`, `player_took_damage` where missing
- Keep payloads minimal and stable.
- **Validation**
  - single dispatch per intended action
  - no duplicate spam from chained systems

## Phase 4 - Gameplay Integration for Remaining Effects (Medium/High Risk)
- Wire remaining effects to existing systems:
  - basic/projectile/skill/direct damage paths
  - movement/sprint/cooldown/healing paths
  - spawned effects via existing projectile/lightning/explosion primitives
- Implement stacking buffs with explicit rules:
  - `maxStacks`, refresh behavior, expiry handling
- **Validation**
  - effects work in intended path(s) only
  - no double-dipping between passive/conditional/triggered buffs

## Phase 5 - Debug/Balance Readiness & Final Audit (Low Risk)
- Keep/update dev overlay to surface active equipment-triggered buffs and key stack states.
- Final consistency pass:
  - passive vs conditional separation
  - trigger correctness and expiry
  - no generation/rarity regression
- **Validation**
  - targeted runtime checks and lint pass
  - spot checks for tooltips/debug readability

## Dependencies
- Phase 2 depends on Phase 1 definitions for IDs/metadata.
- Phase 3 depends on Phase 2 handlers existing for new events.
- Phase 4 depends on Phase 2+3 runtime/event plumbing.
- Phase 5 depends on all prior phases.

## Risk Notes
- **Low risk:** data additions, no-op handlers, debug text.
- **Medium risk:** event coverage additions and cooldown/sprint integration.
- **High risk:** combat-spawned effects and stacking interactions across multiple damage paths.

## Execution Order
1. Phase 1 data completion and safety fixes.
2. Phase 2 handler completion for all remaining simple effects.
3. Phase 3 missing event dispatch.
4. Phase 4 medium/flashy effects using existing combat systems.
5. Phase 5 final consistency audit and validation.
