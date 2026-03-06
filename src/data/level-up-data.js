/** Perattack-type upgrade/penalty pools for level-up cards. Only projectile is populated; other types use empty arrays until implemented. */
export const ATTACK_UPGRADE_DEFS = {
  projectile: {
    standardUpgrades: [
      { id: "extraProjectile", name: "Extra Projectile", description: "Adds 1 to simultaneous projectiles fired.", valueRange: null },
      { id: "flatDamage", name: "Flat Damage", description: "Adds 1 to 2 flat damage to base attack.", valueRange: { min: 1, max: 2, integer: true } },
      { id: "damageBoost", name: "Damage Boost", description: "Increases attack damage by 5% to 10%.", valueRange: { min: 5, max: 10, percent: true } },
      { id: "attackSpeed", name: "Attack Speed", description: "Increases attack speed by 5% to 10%.", valueRange: { min: 5, max: 10, percent: true } },
      { id: "projectileSpeed", name: "Projectile Speed", description: "Increases projectile speed by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "rangeBoost", name: "Range Boost", description: "Increases projectile max range by 15% to 20%.", valueRange: { min: 15, max: 20, percent: true } },
      { id: "spreadReduction", name: "Spread Reduction", description: "Tightens projectile spread for more accuracy.", valueRange: { min: 15, max: 25, percent: true } },
      { id: "critChance", name: "Crit Chance", description: "5% chance for projectiles to deal 150% damage.", valueRange: { min: 5, max: 5, percent: true } }
    ],
    standardPenalties: [
      { id: "slowShot", name: "Slow Shot", description: "Reduces projectile speed by 10%.", valueRange: { min: 10, max: 10, percent: true } },
      { id: "damageReduction", name: "Damage Reduction", description: "Reduces attack damage by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "speedPenalty", name: "Speed Penalty", description: "Reduces attack speed by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "fewerProjectiles", name: "Fewer Projectiles", description: "Reduces simultaneous projectiles by 1 (minimum 1).", valueRange: { min: 1, max: 1 } },
      { id: "reducedRange", name: "Reduced Range", description: "Reduces projectile max range by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "widerSpread", name: "Wider Spread", description: "Increases projectile spread, making shots less accurate.", valueRange: { min: 15, max: 25, percent: true } },
      { id: "cooldown", name: "Cooldown", description: "Adds 0.1 seconds to attack cooldown.", valueRange: { min: 0.1, max: 0.1 } }
    ],
    uniqueUpgrades: [
      { id: "piercing", name: "Piercing", description: "Projectiles pierce up to 3 enemies (default is 2)." },
      { id: "splitting", name: "Splitting", description: "Projectiles that travel 1s without hitting split into 2, up to 4 times (max 16)." },
      { id: "momentum", name: "Momentum", description: "Projectile damage +10% per second in flight, up to +100%." },
      { id: "seeking", name: "Seeking", description: "Projectiles curve toward the nearest enemy after 0.5s in flight." },
      { id: "chainLightning", name: "Chain Lightning", description: "On hit, up to 3 nearby enemies take 33% of the attack damage." },
      { id: "explosive", name: "Explosive", description: "Projectiles explode on impact, dealing 60% damage in a small area." },
      { id: "ghostProjectile", name: "Ghost Projectile", description: "Projectiles pass through all obstacles and walls." },
      { id: "overdrive", name: "Overdrive", description: "Every 5th projectile deals 300% damage at 2x size." }
    ],
    uniquePenalties: [
      { id: "randomDirection", name: "Random Direction", description: "Fires projectiles in a completely random direction." },
      { id: "oppositeFire", name: "Opposite Fire", description: "Fires projectiles in the exact opposite direction of the cursor." },
      { id: "misfire", name: "Misfire", description: "10% chance to fire nothing, consuming the attack but dealing no damage." },
      { id: "shrinking", name: "Shrinking", description: "Projectile hitbox shrinks by 5% every 0.5s in flight." },
      { id: "redirect", name: "Redirect", description: "Projectile direction randomly changes after 0.8s in flight." },
      { id: "selfKnockback", name: "Self Knockback", description: "Propels the player slightly backward on each shot." },
      { id: "delayedFire", name: "Delayed Fire", description: "0.3s delay between clicking and the projectile firing." },
      { id: "reducedProjectiles", name: "Reduced Projectiles", description: "Reduces max simultaneous projectiles by 1 (minimum 1)." },
      { id: "fragileShot", name: "Fragile Shot", description: "Decreases projectile penetration targets by 3." }
    ]
  },
  fanStrike: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  pulseShot: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  thrustStrike: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  dashStrike: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  backfireShot: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] }
};

/** When offering unique card, avoid pairing these upgrade+penalty (e.g. Piercing + Fragile Shot). */
export const CONTRADICTORY_UPGRADE_PENALTY = {
  piercing: ["fragileShot"],
  fragileShot: ["piercing"]
};

/** Display description for level-up card showing the rolled value (e.g. "7% increased attack damage"). */
export function getUpgradeDisplayDescription(u) {
  if (u.value === undefined) return u.description || "";
  const v = u.value;
  const ids = {
    extraProjectile: () => "Adds 1 to simultaneous projectiles fired.",
    flatDamage: () => `Adds ${v} flat damage to base attack.`,
    damageBoost: () => `${v}% increased attack damage.`,
    attackSpeed: () => `${v}% increased attack speed.`,
    projectileSpeed: () => `${v}% increased projectile speed.`,
    rangeBoost: () => `${v}% increased projectile max range.`,
    spreadReduction: () => `${v}% tighter projectile spread.`,
    critChance: () => `${v}% chance for projectiles to deal 150% damage.`
  };
  return ids[u.id] ? ids[u.id]() : (u.description || "");
}

export function getPenaltyDisplayDescription(p) {
  if (p.value === undefined) return p.description || "";
  const v = p.value;
  const ids = {
    slowShot: () => `${v}% reduced projectile speed.`,
    damageReduction: () => `${v}% reduced attack damage.`,
    speedPenalty: () => `${v}% reduced attack speed.`,
    fewerProjectiles: () => `${v} fewer simultaneous projectile(s) (minimum 1).`,
    reducedRange: () => `${v}% reduced projectile max range.`,
    widerSpread: () => `${v}% wider projectile spread.`,
    fragileShot: () => "Decreases projectile penetration targets by 3.",
    cooldown: () => `${v}s added to attack cooldown.`,
    reducedProjectiles: () => `${v} fewer max simultaneous projectiles (minimum 1).`
  };
  return ids[p.id] ? ids[p.id]() : (p.description || "");
}

/** Effect text for an aggregated upgrade (same id taken multiple times, values summed). */
export function getAggregatedUpgradeEffect(agg) {
  const { id, name, description, value, count } = agg;
  if (value !== undefined && value !== null && id !== "extraProjectile") {
    return getUpgradeDisplayDescription({ id, name, description, value, percent: agg.percent });
  }
  const ids = {
    extraProjectile: () => `Adds ${count} to simultaneous projectiles fired.`
  };
  if (ids[id]) return ids[id]();
  const suffix = count > 1 ? ` (${count})` : "";
  return (description || "") + suffix;
}

/** Effect text for an aggregated penalty (same id taken multiple times, values summed). */
export function getAggregatedPenaltyEffect(agg) {
  const { id, name, description, value } = agg;
  if (value !== undefined && value !== null) {
    return getPenaltyDisplayDescription({ id, name, description, value, percent: agg.percent });
  }
  const suffix = agg.count > 1 ? ` (${agg.count})` : "";
  return (description || "") + suffix;
}

export function rollUpgradeValue(def) {
  if (!def.valueRange) return undefined;
  const r = def.valueRange;
  if (r.percent || r.integer) {
    return Math.floor(r.min + Math.random() * (r.max - r.min + 1));
  }
  return r.min + Math.random() * (r.max - r.min);
}
