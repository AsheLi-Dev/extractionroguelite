# Talent Test Checklist

Use this checklist to verify each talent works as intended. For each talent: allocate it on a character, trigger the condition, and confirm the expected result.

## Brutality

| Talent | Trigger | Expected result | Pass |
|--------|---------|-----------------|------|
| Fierce | Start run | +10% attack (base) | |
| Rapid | Dash, then attack within 3s | +10% attack speed | |
| Heavy Hit | Every 4th basic attack | +40% damage, 1 dash charge consumed | |
| Dashing Attack | Complete a dash | Projectile fires in dash direction (30% damage) | |
| Predator | Hit enemy below 25% HP | +50% damage | |
| Bloodthirst | Kill an enemy | Heal 3% max HP | |
| Blood Rush | Kill an enemy | +15% move/attack speed for 3s | |
| Overkill | Killing blow with damage ≥ 1.5× enemy HP | 40% of excess damage to nearby enemies | |
| Frenzy | Every 4th non-skill hit | +30% attack speed for 3s | |
| Battle Scarred | Take damage | +10% attack for 5s, stacks up to 3 | |
| Retaliation | Take damage | +5% attack speed for 4s, stacks up to 5 | |
| Executioner | Hit low-HP enemy with skill | Extra damage (existing logic) | |
| Berserker's Rage | Health below 40% | +40% attack, +20% atk speed, +15% move | |
| Lucky Shot | Have Luck attributes, hit enemy | +10% damage per Luck point | |
| Assassin Step | First hit (stub) | No aggro on first hit (if wired to AI) | |
| Relentless | Kill an enemy | Dash cooldown −0.5s | |

## Agility

| Talent | Trigger | Expected result | Pass |
|--------|---------|-----------------|------|
| Nimble | Start run | +5% movement speed | |
| Reflexes | Start run | Dash cooldown −0.15s | |
| Fleet Footed | Health below 50% | +15% movement speed | |
| Swift Extraction | Start run / dash | Dash distance +25%, cooldown reduced | |
| Evasion | Dash | 20% chance decoy (not impl) | |
| Shadow Step | Dash | Toxic trail (not impl) | |
| Momentum | Complete a dash | +20% move speed for 2s | |
| Slipstream | Dash through enemy | Slow 40% for 1.5s (not impl) | |
| Ghost Form | Take damage | Untargetable 0.8s, 6s CD (not impl) | |
| Untouchable | Dash avoid damage | 1% DR per stack, cap 20% (not impl) | |
| Phantom Dash | Complete a dash | 0.1s invulnerability after dash | |
| Quick Recovery | Dodge during i-frames | −0.5s skill CDs (not impl) | |
| Windrunner | Have other move buffs | 50% more effective (not impl) | |
| Dance of Blades | Attack within 1s after dash | +30% damage | |
| Blink Assault | Dash through enemy | 80% attack damage (not impl) | |
| Perfect Flow | Two dashes in a row | +10% atk speed 2s (not impl) | |

## Vitality

| Talent | Trigger | Expected result | Pass |
|--------|---------|-----------------|------|
| Fortitude | Start run | +15% max health | |
| Bulwark | Start run | +15% defense | |
| Thick Skin | Start run | +10% max HP and +10% defense | |
| Resilient | Take damage | Next 2s: 10% less damage taken | |
| Lifebloom | Kill an enemy | Heal 5% of enemy max HP | |
| Vitality | Enter a new map (first visit) | Heal 20% max HP | |
| Second Breath | Health drops below 15% (once per map) | Heal 25% max HP | |
| Blood Ritual | Kill 10 enemies, then hit | Next hit heals 50% of damage, stacks reset | |
| Toughness | Take first 3 hits on a new map | Each hit 40% reduced | |
| Endurance | Start a dash | 30% DR for 1s | |
| Living Fortress | Time (every 8s) | Shield 5% max HP, cap 30% (not impl) | |
| Undying Resolve | Kill mini-boss | +10% max HP for run (not impl) | |
| Second Wind | Lethal hit (once per run) | Survive, heal 20% (existing) | |
| Immortal | Lethal hit (once per run) | Survive at 1 HP, brief immunity (existing) | |
| Stone Skin | Single hit > 20% max HP | That hit reduced by 30% | |
| Guardian Pulse | Shield breaks | Shockwave + stun (not impl) | |

## Luck

| Talent | Trigger | Expected result | Pass |
|--------|---------|-----------------|------|
| Arcane Eye | Open searchable | +20% loot from searchables | |
| Keen Eye | Kill enemy | +15% equipment drop chance | |
| Treasure Sense | In map | Arrows to searchables (existing) | |
| Scavenger's Instinct | Kill elite | +10% elite drop chance | |
| Loot Hoarder | Open searchable | +20% drop chance for 10s | |
| Item Sense | Pick up Magic item | Nearby enemies slowed 20% for 2s | |
| Card Surge | Pick up any loot | +20% move/attack speed for 3s | |
| Ghost Looter | Pick up loot | Untargetable 0.5s | |
| Cube Magnet | Kill enemy | +20% cube drop chance | |
| Cube Cascade | Cube drops | 10% chance to duplicate | |
| Transmutation | On extraction | Rare items 5% T1 modifier (existing) | |
| Curator | On extraction | Cube upgrades (existing) | |
| Loot Transcendence | On extraction | Item rarity upgrades (existing) | |
| Vault Master | Inventory | Secure up to 3 items (existing) | |
| Living Item | Run with chosen item | Modifiers per boss (existing) | |
| Philosopher's Stone | Kill mini-boss | 5% extra rare drop | |

## Notes

- **Not impl**: Effect not yet implemented in code; listed for completeness.
- **Existing**: Logic was already in the codebase; verify it still works with tree IDs.
- Reset between tests: refund talents or use a fresh character to avoid stacking from previous runs.
