# Branch Strategy: `main` + `demo`

## Purpose

Use a two-lane workflow:

- `main` for active development
- `demo` for the curated friend-facing build

This keeps the playable demo stable without splitting the project into two separate codebases.

## Branch roles

### `main`

- Ongoing feature work
- Experimental systems
- Larger refactors
- Balance work that is not ready for players

### `demo`

- Friend-facing polish
- UI cleanup and naming fixes
- Hiding dev/debug surfaces
- Hosting and deploy readiness
- Stability fixes that protect the first-play experience

## Rules

- Build and deploy the public browser demo from `demo` only.
- Merge from `main` into `demo` selectively, only after the changes are stable.
- If a fix made on `demo` is broadly useful, cherry-pick or merge it back into `main` in a focused follow-up.
- Avoid large new features on `demo`.

## Repo support

The codebase supports this split through build-channel flags in `src/data/constants.js`:

- `BUILD_CHANNEL`
- `DEMO_BUILD`
- `SHOW_DEV_CONTROLS`
- `SHOW_DEV_MENU`

Default value:

```js
export const BUILD_CHANNEL = "main";
```

For the `demo` branch, switch it to:

```js
export const BUILD_CHANNEL = "demo";
```

That keeps the demo build friend-safe without maintaining a second project copy.
