# CSS File Organization

The main `styles.css` file (3058 lines) has been split into focused component files in the `styles/` directory.

## Structure

- `main.css` - Main stylesheet that imports all component stylesheets
- `base.css` - Base styles (reset, hidden, body, html)
- `game.css` - Game-specific styles (game-root, canvas, skill-bar, inventory-panel)
- `ui.css` - UI components (buttons, tooltips, health bars, etc.)
- `overlays.css` - Overlay styles (level-up, victory, game-over, event, shrine)
- `menus.css` - Menu screens (main-menu, talent-tree, skill-library, pre-run, legacy-vault)
- `inventory.css` - Inventory and crafting styles
- `dev.css` - Developer tools styles

## Status

Currently, only `base.css` and `main.css` have been created. The remaining CSS files need to have their respective sections extracted from the original `styles.css` file.

To complete the refactoring:
1. Read `styles.css` and identify sections by component
2. Extract each section into the appropriate file
3. Update `index.html` to use `styles/main.css` instead of `styles.css`
4. Remove or archive the original `styles.css` file

## Extraction Guide

- Lines 1-25: base.css (already extracted)
- Lines 27+: game.css (game-root, canvas-wrapper, skill-bar, inventory-panel, etc.)
- UI components: ui.css
- Overlays: overlays.css
- Menus: menus.css
- Inventory: inventory.css
- Dev tools: dev.css
