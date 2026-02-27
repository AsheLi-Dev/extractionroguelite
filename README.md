# Top-Down Room Game

A small extensible top-down browser game built with **HTML**, **CSS**, and **vanilla JavaScript**.

Features:

- Player square that moves smoothly with **WASD / arrow keys**
- Camera that follows the player inside a bordered room
- Randomly spawning **loot** with item types:
  - Helmet, Boots, Body Armour, Weapon, Upgrade Card
- **Equipment system** for gear slots (helmet, boots, body armour, weapon)
- **Stats system** (health, defense, speed, attack) that updates as you equip gear
- **Upgrade card system** with 10 passive powers (Swift Feet, Iron Skin, Vampiric, etc.)
- Simple **inventory panel**, **equipped slots**, and **upgrade card list**
- **Developer tools** overlay for spawning cards and maxing stats

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

- **Spawn** – add a specific upgrade card to your inventory
- **Give All Cards** – spawn all 10 upgrade cards
- **Max Stats** – boost stats heavily for testing
- **✕ (close)** – hide the dev overlay

To disable dev tools for a "release" build, open `src/main.js` and set:

```js
const DEV_MODE_ENABLED = false;
```

