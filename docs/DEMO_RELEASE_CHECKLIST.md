# Demo Release Checklist

## Before updating `demo`

- Merge or cherry-pick only stable changes from `main`
- Set `BUILD_CHANNEL = "demo"` in `src/data/constants.js`
- Run `npm test`

## Manual checks

- Main menu loads correctly
- Game name and subtitle are correct
- Tutorial starts and progresses cleanly
- New run starts from the menu
- Instructions match actual controls
- Level-up flow appears and resolves cleanly
- Inventory opens and renders
- Dev/debug UI is hidden
- Hosted/static build loads without broken assets

## Deploy

- Deploy from `demo` only
- Share the hosted browser link with friends
- After feedback, bring only generally useful fixes back to `main`
