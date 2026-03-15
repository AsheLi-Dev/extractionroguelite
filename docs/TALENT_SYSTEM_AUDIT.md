# Talent System Audit: Global vs Per-Character

The talent tree was switched back to a **global** model (one shared tree, one localStorage key). This audit lists leftover per-character assumptions and their resolution.

---

## Audit Results (by file)

### `src/data/talents.js`

| Item | Classification | Notes |
|------|----------------|--------|
| `getTalentsForCharacter(char)` | **Legacy logic removed** | Ignored `char` and returned `getPurchasedTalents()`. Removed; callers use `getPurchasedTalents()` directly. |
| `hasAnyCharacterTalent(id)` | **Legacy logic removed** | Was alias for `hasTalent(id)`. Call sites (legacy-vault) now use `hasTalent`. |
| `purchaseTalentForCharacter(charIndex, id, cost)` | **Legacy logic removed** | Ignored `charIndex`; delegated to `purchaseTalent`. No callers; removed. |
| `refundTalentForCharacter(charIndex, talentId)` | **Legacy logic removed** | Same; no callers; removed. |
| `refundBranchForCharacter(charIndex, branchName)` | **Legacy logic removed** | Same; no callers; removed. |
| `getPurchasedTalents()` | **Correct as-is** | Single localStorage key `TALENTS_KEY`; JSDoc updated to state "global, not per-character". |

### `src/game/game.js`

| Item | Classification | Notes |
|------|----------------|--------|
| `this.characterTalents` | **Misleading name → fixed** | Renamed to `this.runTalents`. Still a snapshot of `getPurchasedTalents()` at run start so mid-run refunds don’t affect the current run. |
| `hasCharacterTalent(id)` | **Misleading name → fixed** | Renamed to `hasRunTalent(id)`. Semantics unchanged: "does this run have this talent?" |

### `src/ui/pre-run.js`

| Item | Classification | Notes |
|------|----------------|--------|
| `getTalentsForCharacter(preRunChar)` | **Legacy logic removed** | Result was stored in `preRunTalents` but never used. Removed; no replacement (pre-run doesn’t display talent list). |
| `preRunTalents` | **Legacy logic removed** | Dead variable; removed. |

### `src/ui/legacy-vault.js`

| Item | Classification | Notes |
|------|----------------|--------|
| `hasAnyCharacterTalent(id)` | **Misleading name only → fixed** | Under global model, "any character has" = "player has". Replaced with `hasTalent(id)`. |

### `src/ui/talent-tree-ui.js`

| Item | Classification | Notes |
|------|----------------|--------|
| `openTalentTreeForCharacter(_charIndex)` | **Legacy logic removed** | Only called `openTalentTree()`; `_charIndex` unused. No callers; removed. |

### Save/load paths

| Item | Classification | Notes |
|------|----------------|--------|
| `TALENTS_KEY` (localStorage) | **Correct as-is** | Single key; no per-character storage. |
| Character save `talents: []` in `game.js` / `game-victory.js` | **Legacy / harmless** | Saved character object still has `talents: []`. Unused for global tree; kept for schema compatibility. |

### Tests

| Item | Classification | Notes |
|------|----------------|--------|
| `characterTalents` in test state (talent-simulator, talent-test-helpers, talents.test.js) | **Correct as-is** | State key for "talents active this run"; same concept as `game.runTalents`. Name is historical; behavior correct. |
| `persistence.test.js` `char.talents` | **Legacy assumption** | Simulator builds run from `char.talents`; under global model run would use global list. Left as-is; test still valid for run state shape. |

---

## Clean Architecture: Global Talent Tree

- **Storage:** One list of purchased talent IDs in localStorage under `TALENTS_KEY` (`src/data/constants.js`). No per-character talent storage.
- **Data:** `src/data/talents.js` — `TALENT_TREE`, `getPurchasedTalents()`, `purchaseTalent()`, `refundTalent()`, `refundBranch()`, `hasTalent(id)`, `canPurchaseTalent` / `canRefundTalent`. Crystals (costs) in `src/data/crystals.js`.
- **UI:** `src/ui/talent-tree-ui.js` — `openTalentTree()`, `closeTalentTree()`, `renderTalentTree()`; uses `getPurchasedTalents()` and `purchaseTalent` / `refundTalent` / `refundBranch` only.
- **Runtime (in-run):** `Game` in `src/game/game.js` sets `this.runTalents = getPurchasedTalents()` in the constructor (snapshot for the run). All in-run checks use `this.hasRunTalent(id)`.
- **Out-of-run checks (menus, legacy vault):** Use `hasTalent(id)` from `src/data/talents.js` (reads current localStorage).
- **Character save:** Character objects may still include `talents: []` for compatibility; global tree does not read or write per-character talents.

No remaining per-character talent APIs or storage; naming and call sites are aligned with a single global tree.
