# Elemental Shot evolution reference

Elemental Shot has **first evolution** (one of: damage, rhythm, control, elemental) and **second evolution** (same four options). First sets your element focus; second merges overrides that change attack mode, environment, links, and interactions.

---

## Base (no evolution)

- **formId:** `base`
- **attackMode:** `projectile` — single aimed projectile per attack
- **defaultElement:** `fire` — starting shot element; hitting with this element builds elemental charge
- **Surge:** normal, elements `["wind", "lightning"]`, 3s
- **projectileMods:** all 1/false/0 (no special mods)
- **environment:** no storm/swirl, no storm slow, no swirl firestorm/lightning split
- **links:** no wind explosion, no wind buffs
- **elementalInteractions:** no stun, no burn detonate, no simultaneous elements

---

## First evolution only (category → element focus)

First evolution only changes **defaultElement** (and formId). Surge and everything else stay base.

| First   | formId           | defaultElement | In-game effect |
|--------|------------------|----------------|----------------|
| damage | `fire_focus`     | fire           | Start on fire; fire hits build elemental charge faster (synergy with default element). |
| rhythm | `lightning_focus`| lightning      | Start on lightning; lightning hits build charge. |
| control| `wind_focus`     | wind           | Start on wind; wind hits build charge. |
| elemental | `elemental_cycle` | fire        | Start on fire (cycle theme; second evolution can add multi-element). |

---

## Second evolution (16 forms)

Below: **formId**, **attackMode**, **defaultElement**, then profile overrides and **exact in-game behavior**.

---

### Damage first (fire)

**damage + damage — Meteorfall**  
- **formId:** `meteorfall`  
- **attackMode:** `meteor`  
- **defaultElement:** fire  
- **projectileMods:** damageMult 1, explosionRadiusMult 1, explosionDamageMult 1 (placeholders; no numeric change)  
- **In-game:** Attack fires a **meteor** that falls on the target area instead of a direct projectile. No extra damage/radius from evolution (all mults = 1).

**damage + rhythm — Blazing Barrage**  
- **formId:** `blazing_barrage`  
- **attackMode:** `projectile`  
- **defaultElement:** fire  
- **projectileMods:** attackSpeedMult 1  
- **In-game:** Same as single projectile; attackSpeedMult 1 = no change. Effect is name-only unless you later set attackSpeedMult &gt; 1.

**damage + control — Wildfire**  
- **formId:** `wildfire`  
- **attackMode:** `projectile`  
- **defaultElement:** fire  
- **projectileMods:** explosionRadiusMult 1  
- **In-game:** Standard projectile; explosionRadiusMult 1 = no change. Name-only unless explosion radius is wired to this mult.

**damage + elemental — Primal Inferno**  
- **formId:** `primal_inferno`  
- **defaultElement:** fire  
- **links:** {}  
- **In-game:** Fire focus only; no extra links or mods. Purely fire default element.

---

### Rhythm first (lightning)

**rhythm + damage — Thunder Forge**  
- **formId:** `thunder_forge`  
- **defaultElement:** lightning  
- **elementalInteractions:** burnApply false  
- **links:** {}  
- **In-game:** Lightning default; burnApply false is already base. No extra gameplay effect.

**rhythm + rhythm — Storm Machine**  
- **formId:** `storm_machine`  
- **defaultElement:** lightning  
- **projectileMods:** attackSpeedMult 1  
- **In-game:** Lightning focus; attackSpeedMult 1 = no change. Name-only.

**rhythm + control — Storm Circle**  
- **formId:** `storm_circle`  
- **defaultElement:** lightning  
- **environment:** spawnStorm true, stormSlow true  
- **elementalInteractions:** burnDetonate true, burnConsumedOnDetonate true  
- **In-game:**  
  - **Lightning hits** can spawn **elemental storms** (up to cap); storms can have **stormSlow**.  
  - **Lightning on burning enemy:** triggers **burn detonate** (extra damage); if burnConsumedOnDetonate, burn is consumed on that detonate.

**rhythm + elemental — Overcharged Core**  
- **formId:** `overcharged_core`  
- **defaultElement:** lightning  
- **surgeBehavior:** type `"modifier"`, elements `["wind", "lightning", "fire"]`, 3s  
- **links:** windBuffsAttackSpeed true  
- **In-game:** During **wind** elemental surge, you get **+15% attack speed**. Surge element list includes wind/lightning/fire (modifier type may be used for UI/alternate behavior elsewhere).

---

### Control first (wind)

**control + damage — Firestorm**  
- **formId:** `firestorm`  
- **defaultElement:** wind  
- **links:** {}  
- **In-game:** Wind focus only; no extra links. Name-only.

**control + rhythm — Thunder Gale**  
- **formId:** `thunder_gale`  
- **defaultElement:** wind  
- **surgeBehavior:** elements `["wind"]` only, 3s  
- **elementalInteractions:** stunChance 1  
- **links:** fireExplosionOnWindHit true  
- **In-game:**  
  - **Wind projectiles** have **100% stun chance** (0.5s stun).  
  - **Wind hit on enemy:** causes a **fire explosion** (25% of base damage in small radius).

**control + control — Razor Tempest**  
- **formId:** `razor_tempest`  
- **attackMode:** `volley`  
- **defaultElement:** wind  
- **projectileMods:** bounceCount 2, volleyCount 1  
- **In-game:** Attack fires a **volley** (spread of projectiles). volleyCount 1 = single shot in volley mode; **bounceCount 2 is not implemented** for player projectiles (only the “bouncing” skill mod is used).

**control + elemental — Elemental Cyclone**  
- **formId:** `elemental_cyclone`  
- **defaultElement:** wind  
- **environment:** spawnSwirl true, swirlFirestorm true, swirlLightningSplit true  
- **In-game:**  
  - **Wind hits** can spawn **elemental swirls** (up to cap).  
  - **Fire projectile hitting a swirl** triggers **firestorm** (explosion).  
  - **Lightning projectile hitting a swirl** triggers **lightning split** (two projectiles).

---

### Elemental first (all)

**elemental + damage — Solar Flare**  
- **formId:** `solar_flare`  
- **defaultElement:** fire  
- **projectileMods:** {}  
- **In-game:** Fire default; no mods. Name-only.

**elemental + rhythm — Storm Prism**  
- **formId:** `storm_prism`  
- **defaultElement:** lightning  
- **projectileMods:** {}  
- **In-game:** Lightning default; no mods. Name-only.

**elemental + control — Prismatic Gale**  
- **formId:** `prismatic_gale`  
- **defaultElement:** wind  
- **projectileMods:** {}  
- **In-game:** Wind default; no mods. Name-only.

**elemental + elemental — Prismatic Surge**  
- **formId:** `prismatic_surge`  
- **surgeBehavior:** type `"multi"`, elements `["wind", "lightning", "fire"]`, 3s  
- **elementalInteractions:** simultaneousElements true  
- **In-game:** **Multi-element surge** (wind, lightning, fire) is used when type is `"multi"`; simultaneousElements can be used for applying multiple elements at once (implementation may vary).

---

## Profile fields → in-game summary

| Profile field | Where it’s used | Effect |
|---------------|-----------------|--------|
| **attackMode** | executeBasicAttackByType | `meteor` → meteor fall; `volley` → spread volley; `projectile` → single shot |
| **defaultElement** | Initial state, charge gain | Starting element; hits with this element build elemental charge |
| **surgeBehavior.elements** | Surge UI / next surge | Which elements appear in surge; `multi` = multi-element surge |
| **surgeBehavior.durationSec** | Surge duration | Override for surge length (e.g. 3s) |
| **projectileMods.damageMult** | firePlayerProjectile | Damage multiplier (1 = no change) |
| **projectileMods.attackSpeedMult** | Attack cooldown | Cooldown multiplier (1 = no change) |
| **projectileMods.volleyCount** | fireElementalShotVolley | Number of shots in volley (1 = single in volley mode) |
| **projectileMods.bounceCount** | — | **Not used** for player projectiles (bounce only from skill mod) |
| **elementalInteractions.stunChance** | Wind hit | 1 = 100% stun (0.5s) on wind hit |
| **elementalInteractions.burnDetonate** | Lightning vs burning | Lightning hit detonates burn for extra damage |
| **elementalInteractions.burnConsumedOnDetonate** | After detonate | Burn debuff is consumed |
| **elementalInteractions.simultaneousElements** | — | Flag for multi-element behavior (usage varies) |
| **environment.spawnStorm** | Lightning hit | Can spawn storm (capped) |
| **environment.spawnSwirl** | Wind hit | Can spawn swirl (capped) |
| **environment.stormSlow** | Storm tick | Storm applies slow |
| **environment.swirlFirestorm** | Fire → swirl | Fire hit on swirl causes explosion |
| **environment.swirlLightningSplit** | Lightning → swirl | Lightning hit on swirl spawns 2 projectiles |
| **links.fireExplosionOnWindHit** | Wind hit | Wind hit causes small fire explosion |
| **links.windBuffsAttackSpeed** | Wind surge | +15% attack speed during wind surge |
| **links.windBuffsMoveSpeed** | Wind surge | Move speed buff during wind surge |

---

## Forms with real, unique effects (current data)

- **Meteorfall** (damage + damage): meteor attack mode.  
- **Storm Circle** (rhythm + control): lightning spawns storms + storm slow, lightning detonates/consumes burn.  
- **Overcharged Core** (rhythm + elemental): wind surge buffs attack speed.  
- **Thunder Gale** (control + rhythm): wind stun + wind hit causes fire explosion.  
- **Razor Tempest** (control + control): volley attack mode (bounceCount not implemented).  
- **Elemental Cyclone** (control + elemental): wind spawns swirls, fire/lightning interact with swirls (firestorm, lightning split).  
- **Prismatic Surge** (elemental + elemental): multi-element surge + simultaneous elements.

All other second evolutions currently only change default element and/or formId; numeric mods are 1 or empty, so they behave like “name-only” variants unless you add non-1 values or new wiring.
