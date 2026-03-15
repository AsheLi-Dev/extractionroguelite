# Soul Siphon – Manual Test Checklist

Use this checklist to verify Soul Siphon and Cute Spirit behavior.

## Setup
- Start a run and choose **Soul Siphon** as your basic attack (pre-run skill select).
- Ensure you have at least one enemy type with low/medium/high HP to test size tiers.

## 1. Soul Siphon chain and damage
- [ ] Soul Siphon fires on basic attack (click/lmb) and hits nearest enemy in range (~240 px).
- [ ] Chain bounces to other nearby enemies (up to 8 bounces) and thin purple chain lines appear briefly.
- [ ] Enemies show normal hit flash; damage is applied (with mild decay per bounce).

## 2. Soul collection (Soul Siphon kills only)
- [ ] Killing **small** enemies (e.g. low HP) with Soul Siphon grants **+1 soul** (floating text and Souls counter).
- [ ] Killing **medium** enemies with Soul Siphon grants **+2 souls**.
- [ ] Killing **large** enemies with Soul Siphon grants **+4 souls**.
- [ ] Killing enemies with **other** attacks (e.g. skill, other basic) does **not** grant souls.

## 3. Spirit summon at 10 souls
- [ ] When total souls reach **10**, a **Cute Spirit** (purple glow) spawns near the player.
- [ ] Spirit floats and follows the player smoothly (no collision; stays in comfort radius).
- [ ] UI shows e.g. `Souls: 10 | Spirit S1 Charge: 0/3`.

## 4. Chain to Spirit and charging
- [ ] Soul Siphon can chain **to the Spirit** when it is in chain range (240 px).
- [ ] When the chain hits the Spirit, the Spirit **charges** (no damage); brief glow pulse.
- [ ] Chain can bounce **Enemy → Spirit → Enemy** (A→B→A allowed; no infinite loop).
- [ ] Charge counter in UI increases (e.g. `Charge: 1/3`, `2/3`, `3/3`).

## 5. Spirit assist actions and ICD
- [ ] At **3 charge** (or 2 at stage 3+), Spirit triggers **one** assist action and charge resets.
- [ ] Assist is random: **Ground spam** (small AoE pulses), **Ghost fireball** (projectile to nearest enemy), or **Speed buff** (+10% move speed 0.5 s).
- [ ] After trigger, Spirit cannot trigger again for **0.35 s** (ICD).
- [ ] Speed buff refreshes duration when re-applied; does not stack magnitude.

## 6. Spirit evolution
- [ ] At **25** total souls: Spirit stage 2 (stronger visuals; ghost fireball +20% damage).
- [ ] At **45** total souls: Spirit stage 3 (charge threshold **2**; triggers more often).
- [ ] At **70** total souls: Spirit stage 4 (triggers **two** assist actions with 0.12 s delay; ICD after second).

## 7. Debug UI
- [ ] **Souls: N** visible when souls > 0.
- [ ] When Spirit exists: **Spirit S\<stage\> Charge: \<current\>/\<threshold\>** visible.

## 8. Performance / edge cases
- [ ] No visible lag with many chain bounces (8) and several enemies.
- [ ] Spirit does not get stuck on walls or obstacles (no collision).
- [ ] Map transition: souls total and Spirit state persist (same run).
