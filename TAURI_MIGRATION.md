# Tauri Migration

This project now uses Tauri v2 as the desktop shell in `src-tauri/`.

## Why this shape

The current game is a static web app rooted at the repository root:

- `index.html`
- `src/`
- `styles/`
- `assets/`

Tauri can embed a frontend directory directly via `frontendDist`. The config points to the repository root so the existing static layout can be loaded without introducing a bundler first.

Official references used:

- Tauri v2 config reference: https://v2.tauri.app/reference/config/
- Tauri frontend configuration overview: https://v2.tauri.app/start/frontend/

## Local prerequisites

Install Rust first if it is not already available, then install the Tauri CLI:

```powershell
winget install Rustlang.Rustup
cargo install tauri-cli --version "^2.0"
```

You will also need Microsoft WebView2 installed on Windows, which is standard on most current systems.

## Run

From the repository root:

```powershell
npm install
npm run tauri:dev
```

## Build

```powershell
npm run tauri:build
```

## Notes

- `tauri:dev` uses a plain static dev server via `npm run start:tauri-dev`. This is intentional because the earlier fallback dev serving path returned HTML for asset requests and broke sprite loading.
- The Tauri window is intentionally configured as a normal framed window first. This is a simple baseline for desktop testing.
- `csp` is set to `null` because the current app is a hand-authored static game and may rely on inline scripts/styles or patterns that would otherwise need a CSP cleanup pass.
- No Rust-side commands are exposed yet; Tauri is only acting as a desktop shell.
