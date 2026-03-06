# Top-Down Room Game

A small extensible top-down browser game built with **HTML**, **CSS**, and **vanilla JavaScript**.

Features:

- Player square that moves smoothly with **WASD / arrow keys**
- Camera that follows the player inside a bordered room
- Randomly spawning **loot** with item types:
  - Helmet, Boots, Body Armour, Weapon
- **Equipment system** for gear slots (helmet, boots, body armour, weapon)
- **Stats system** (health, defense, speed, attack) that updates as you equip gear
- Simple **inventory panel** and **equipped slots**
- **Developer tools** overlay for spawning items and maxing stats

## Running the game

From `c:\Users\2jonl\Space-Shooter`:

```bash
npm install
npm run start
```

Open the printed `http://localhost:...` URL in your browser.

## Controls

- **Move**: W/A/S/D or Arrow keys
- **Open Dev Tools**: click the `DEV` button in the top-left corner

Inside the dev overlay:

- **Max Stats** – boost stats heavily for testing
- **✕ (close)** – hide the dev overlay

To disable dev tools for a "release" build, open `src/main.js` and set:

```js
const DEV_MODE_ENABLED = false;
```

