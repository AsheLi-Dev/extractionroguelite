# Extract Da Panda

A browser-based top-down action roguelike built with **HTML**, **CSS**, and **vanilla JavaScript**.

Current playable features include:

- Main menu, tutorial flow, and pre-run setup
- Real-time combat with multiple attacks and skills
- Procedural maps, enemy spawns, loot, and inventory
- Level-ups, build upgrades, and weapon evolution
- Hub/meta systems including talents, pillars, friends, and persistence

## Running the game

From `c:\Users\2jonl\Extract-Da-Panda`:

```bash
npm install
npm run start
```

Open the printed `http://localhost:...` URL in your browser.

## Controls

- **Move**: `W/A/S/D` or Arrow keys
- **Attack**: mouse click
- **Dash**: `Space`
- **Interact**: `E`
- **Inventory**: `I`
- **Pause**: `Esc` or `P`

## Branch workflow

- `main`: active development branch
- `demo`: curated friend-facing branch for web builds and playtests

Branch-specific demo behavior is controlled from `src/data/constants.js` via `BUILD_CHANNEL`, `DEMO_BUILD`, and the dev visibility flags.
