export const RUN_CONDITIONS = [
  { id: "enemyHp", category: "enemy", icon: "spr_condition_enemyHp", name: "Hardened Foes", desc: "All enemies have 15% more health" },
  { id: "enemyDmg", category: "enemy", icon: "spr_condition_enemyDmg", name: "Brutal Strikes", desc: "All enemies deal 15% more damage" },
  { id: "enemySpeed", category: "enemy", icon: "spr_condition_enemySpeed", name: "Swift Enemies", desc: "All enemies move 20% faster" },
  { id: "enemyRegen", category: "enemy", icon: "spr_condition_enemyRegen", name: "Regenerating Foes", desc: "Enemies regenerate health over time" },
  { id: "enemyResist", category: "enemy", icon: "spr_condition_enemyResist", name: "Hit Resistance", desc: "Enemies take 20% less damage" },
  { id: "eliteSpawn", category: "enemy", icon: "spr_condition_eliteSpawn", name: "Elite Invasion", desc: "Elite enemies spawn everywhere" },
  { id: "enemyExplode", category: "enemy", icon: "spr_condition_enemyExplode", name: "Death Explosions", desc: "Enemies explode on death" },
  { id: "bossHp", category: "enemy", icon: "spr_condition_bossHp", name: "Titan Boss", desc: "Boss has 30% more health" },
  { id: "frozenGround", category: "env", icon: "spr_condition_frozenGround", name: "Frozen Floor", desc: "Ground slows player movement" },
  { id: "toxicGround", category: "env", icon: "spr_condition_toxicGround", name: "Toxic Ground", desc: "Ground deals damage over time" },
  { id: "burningGround", category: "env", icon: "spr_condition_burningGround", name: "Burning Ground", desc: "Ground deals burst damage" },
  { id: "shockingGround", category: "env", icon: "spr_condition_shockingGround", name: "Shocking Ground", desc: "Ground can stun the player" },
  { id: "weakeningGround", category: "env", icon: "spr_condition_weakeningGround", name: "Weakening Ground", desc: "Ground reduces attack damage" },
  { id: "darkness", category: "env", icon: "spr_condition_darkness", name: "Darkness", desc: "Reduced vision radius" },
  { id: "startHealth", category: "player", icon: "spr_condition_startHealth", name: "Frail Start", desc: "Start with -30 max health" },
  { id: "startAttack", category: "player", icon: "spr_condition_startAttack", name: "Weakened Blows", desc: "Start with -20% attack damage" },
  { id: "startSpeed", category: "player", icon: "spr_condition_startSpeed", name: "Sluggish", desc: "Start with -20% movement speed" },
  { id: "vaultLocked", category: "player", icon: "spr_condition_vaultLocked", name: "Vault Locked", desc: "Legacy vault unavailable this run" },
  { id: "noHealthDrops", category: "player", icon: "spr_condition_noHealthDrops", name: "No Healing", desc: "No health drops from enemies" },
];

export const GROUND_CONDITION_IDS = new Set([
  "frozenGround",
  "toxicGround",
  "burningGround",
  "shockingGround",
  "weakeningGround"
]);

export const MAX_GROUND_CONDITIONS_PER_RUN = 2;

export const ATTACK_TYPES = [
  { id: "projectile", name: "Elemental Shot", illustration: "assets/UI/Projectile Shot.png", desc: "Fire elemental projectiles (Fire/Wind/Lightning). Build charge for surges that amplify or detonate burn.", tags: ["projectile", "ranged"] },
  { id: "fanStrike", name: "Fan Strike", illustration: "assets/UI/Fan Strike.png", desc: "Melee arc sweep in cursor direction. Hits all enemies in a 120 arc at short range.", tags: ["melee", "area"] },
  { id: "pulseShot", name: "Pulse Shot", illustration: "assets/UI/Pulse Shot.png", desc: "Call down an area strike at the cursor location. Damages all enemies in a small circle after a brief delay.", tags: ["ranged", "area"] },
  { id: "thrustStrike", name: "Thrust Strike", illustration: "assets/UI/Thrust Strike.png", desc: "Fast precise thrust in cursor direction. Hits only the first enemy in line for 60% increased damage.", tags: ["melee"] },
  { id: "dashStrike", name: "Dash Strike", illustration: "assets/UI/Dash Strike.png", desc: "Surge forward through enemies, then perform a quick 90 fan strike at your destination.", tags: ["melee", "utility"] },
  { id: "bladeBlast", name: "Blade & Blast", illustration: "assets/UI/Blade Storm.png", desc: "A hybrid blade style that chains cutting strikes into explosive follow-through. Evolves through damage, rhythm, control, and on-hit build paths.", tags: ["melee", "hybrid"] },
  { id: "soulSiphon", name: "Soul Siphon", illustration: "assets/UI/Projectile Shot.png", desc: "Channel a beam toward the cursor. Kills grant souls; at 10 souls, summon a Spirit that can be charged by the beam and assists you.", tags: ["ranged", "beam"] }
];

export function enforceConditionLimits(conditions = [], desiredCount = null) {
  const byId = new Map(RUN_CONDITIONS.map((c) => [c.id, c]));
  const requested = [];
  const seen = new Set();
  for (const c of conditions || []) {
    const id = c?.id;
    if (!id || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    requested.push(byId.get(id));
  }

  const out = [];
  let groundCount = 0;
  for (const c of requested) {
    const isGround = GROUND_CONDITION_IDS.has(c.id);
    if (isGround && groundCount >= MAX_GROUND_CONDITIONS_PER_RUN) continue;
    out.push(c);
    if (isGround) groundCount++;
  }

  const target = Math.max(0, Math.min(
    desiredCount ?? out.length,
    RUN_CONDITIONS.length - Math.max(0, GROUND_CONDITION_IDS.size - MAX_GROUND_CONDITIONS_PER_RUN)
  ));
  if (out.length >= target) return out.slice(0, target);

  const pool = [...RUN_CONDITIONS]
    .filter((c) => !out.some((x) => x.id === c.id))
    .sort(() => Math.random() - 0.5);
  for (const c of pool) {
    if (out.length >= target) break;
    const isGround = GROUND_CONDITION_IDS.has(c.id);
    if (isGround && groundCount >= MAX_GROUND_CONDITIONS_PER_RUN) continue;
    out.push(c);
    if (isGround) groundCount++;
  }
  return out;
}

export function pickRandomConditions(count) {
  const shuffled = [...RUN_CONDITIONS].sort(() => Math.random() - 0.5);
  return enforceConditionLimits(shuffled, count);
}
