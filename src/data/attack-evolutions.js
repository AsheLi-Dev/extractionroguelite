export const ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT = "projectile_shot_evo";

export const ATTACK_EVOLUTION_DEFS = [
  {
    id: "ProjectileCannon",
    baseWeaponId: "ProjectileShot",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT,
    transformChoiceId: "Transform_ProjectileCannon",
    transformName: "Transform: Projectile Cannon",
    unlock: {
      stat: "attackDamagePct",
      requiredPct: 50,
      label: "Upgrade Damage"
    },
    summary: "Massive rounds: +90% size, +90% damage, -20% projectile speed, -15% attack speed.",
    overrides: {
      projectileScaleMult: 1.9,
      damageMult: 1.9,
      projectileSpeedMult: 0.8,
      attackSpeedMult: 0.85
    }
  },
  {
    id: "SniperShot",
    baseWeaponId: "ProjectileShot",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT,
    transformChoiceId: "Transform_SniperShot",
    transformName: "Transform: Sniper Shot",
    unlock: {
      stat: "projectileRangePct",
      requiredPct: 40,
      label: "Upgrade Range"
    },
    summary: "Infinite-range piercing beam. No steering. Piercing falloff: x0.85 each hit, floor 60%.",
    overrides: {
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      sniperPierceFalloff: {
        factor: 0.85,
        floor: 0.6
      }
    }
  },
  {
    id: "MachineGun",
    baseWeaponId: "ProjectileShot",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT,
    transformChoiceId: "Transform_MachineGun",
    transformName: "Transform: Machine Gun",
    unlock: {
      stat: "attackSpeedPct",
      requiredPct: 50,
      label: "Upgrade Attack Speed"
    },
    summary: "Burst fire: 10 shots at 15% damage each, 0.08s interval, 15 deg random spread cone.",
    overrides: {
      fireMode: "BURST",
      burstCount: 10,
      burstShotDamageMult: 0.15,
      burstIntervalSec: 0.08,
      spreadDeg: 15
    }
  }
];

export function getAttackEvolutionsForWeapon(baseWeaponId) {
  return ATTACK_EVOLUTION_DEFS.filter((evo) => evo.baseWeaponId === baseWeaponId);
}

export function getAttackEvolutionById(evolutionId) {
  return ATTACK_EVOLUTION_DEFS.find((evo) => evo.id === evolutionId) || null;
}

export function getEvolutionUnlockProgress(evoDef, upgradeOnlyStats) {
  const statKey = evoDef?.unlock?.stat;
  const required = evoDef?.unlock?.requiredPct ?? 0;
  const current = Number(upgradeOnlyStats?.[statKey] || 0);
  const unlocked = current >= required;
  return {
    statKey,
    requiredPct: required,
    currentPct: current,
    unlocked,
    label: evoDef?.unlock?.label || statKey
  };
}
