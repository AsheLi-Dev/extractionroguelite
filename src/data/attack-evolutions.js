export const ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER1 = "projectile_shot_tier1";
export const ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2 = "projectile_shot_tier2";

const BASE_WEAPON_ID = "ProjectileShot";

export const TIER1_EVOLUTION_BY_CATEGORY = {
  damage: "ProjectileCannon",
  rhythm: "MachineGun",
  control: "SniperShot",
  onhit: "ElementalShot"
};

export const TIER2_EVOLUTION_MATRIX = {
  ProjectileCannon: {
    damage: "NuclearCannon",
    rhythm: "RotaryCannon",
    control: "RailCannon",
    onhit: "FlamingCannon"
  },
  MachineGun: {
    damage: "ArmorPiercingGun",
    rhythm: "MinigunOverdrive",
    control: "SmartTrackingGun",
    onhit: "LightningBulletStorm"
  },
  SniperShot: {
    damage: "ExecutionerRail",
    rhythm: "RapidMarksman",
    control: "HyperRailBeam",
    onhit: "ColdKiller"
  },
  ElementalShot: {
    damage: "CataclysmShot",
    rhythm: "StormChannel",
    control: "ArcaneBeam",
    onhit: "ChaosElements"
  }
};

function createEvolution(def) {
  return {
    baseWeaponId: BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: `Transform_${def.id}`,
    transformName: def.name,
    ...def
  };
}

export const ATTACK_EVOLUTION_DEFS = [
  createEvolution({
    id: "ProjectileCannon",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER1,
    name: "Projectile Cannon",
    sourceCategory: "damage",
    summary: "Massive rounds with higher impact and reduced fire cadence.",
    overrides: {
      projectileScaleMult: 1.9,
      damageMult: 1.9,
      projectileSpeedMult: 0.8,
      attackSpeedMult: 0.85
    }
  }),
  createEvolution({
    id: "MachineGun",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER1,
    name: "Machine Gun",
    sourceCategory: "rhythm",
    summary: "Burst fire pattern with dense close-range bullet output.",
    overrides: {
      fireMode: "BURST",
      burstCount: 10,
      burstShotDamageMult: 0.15,
      burstIntervalSec: 0.08,
      spreadDeg: 15
    }
  }),
  createEvolution({
    id: "SniperShot",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER1,
    name: "Sniper Shot",
    sourceCategory: "control",
    summary: "Infinite-range piercing beam with strong precision scaling.",
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
  }),
  createEvolution({
    id: "ElementalShot",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER1,
    name: "Elemental Shot",
    sourceCategory: "onhit",
    summary: "Unstable infused shots with faster cadence and stronger impact.",
    overrides: {
      projectileScaleMult: 1.15,
      damageMult: 1.2,
      projectileSpeedMult: 1.05,
      attackSpeedMult: 1.1
    }
  }),
  createEvolution({
    id: "NuclearCannon",
    tier: 2,
    parentEvolutionId: "ProjectileCannon",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Nuclear Cannon",
    summary: "Extreme cannon payloads with maximum projectile mass.",
    overrides: {
      projectileScaleMult: 2.35,
      damageMult: 2.5,
      projectileSpeedMult: 0.72,
      attackSpeedMult: 0.72
    }
  }),
  createEvolution({
    id: "RotaryCannon",
    tier: 2,
    parentEvolutionId: "ProjectileCannon",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Rotary Cannon",
    summary: "Heavy projectiles with improved fire cadence.",
    overrides: {
      projectileScaleMult: 1.85,
      damageMult: 1.85,
      projectileSpeedMult: 0.9,
      attackSpeedMult: 1.15
    }
  }),
  createEvolution({
    id: "RailCannon",
    tier: 2,
    parentEvolutionId: "ProjectileCannon",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Rail Cannon",
    summary: "Cannon shells convert into long-range piercing rail blasts.",
    overrides: {
      projectileScaleMult: 1.6,
      damageMult: 2.1,
      projectileSpeedMult: 1.15,
      attackSpeedMult: 0.82,
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      sniperPierceFalloff: {
        factor: 0.9,
        floor: 0.7
      }
    }
  }),
  createEvolution({
    id: "FlamingCannon",
    tier: 2,
    parentEvolutionId: "ProjectileCannon",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Flaming Cannon",
    summary: "Large explosive shells with higher on-hit pressure.",
    overrides: {
      projectileScaleMult: 2.05,
      damageMult: 2.05,
      projectileSpeedMult: 0.84,
      attackSpeedMult: 0.92
    }
  }),
  createEvolution({
    id: "ArmorPiercingGun",
    tier: 2,
    parentEvolutionId: "MachineGun",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Armor Piercing Gun",
    summary: "Burst fire with fewer, harder-hitting piercing shots.",
    overrides: {
      fireMode: "BURST",
      burstCount: 8,
      burstShotDamageMult: 0.24,
      burstIntervalSec: 0.08,
      spreadDeg: 12,
      pierceEnabled: true,
      pierceMaxTargets: 6
    }
  }),
  createEvolution({
    id: "MinigunOverdrive",
    tier: 2,
    parentEvolutionId: "MachineGun",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Minigun Overdrive",
    summary: "Dense sustained burst patterns with extreme fire rate.",
    overrides: {
      fireMode: "BURST",
      burstCount: 16,
      burstShotDamageMult: 0.13,
      burstIntervalSec: 0.045,
      spreadDeg: 13
    }
  }),
  createEvolution({
    id: "SmartTrackingGun",
    tier: 2,
    parentEvolutionId: "MachineGun",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Smart Tracking Gun",
    summary: "Burst fire with tighter spread and target tracking.",
    overrides: {
      fireMode: "BURST",
      burstCount: 10,
      burstShotDamageMult: 0.17,
      burstIntervalSec: 0.07,
      spreadDeg: 7,
      projectileSpeedMult: 1.08
    }
  }),
  createEvolution({
    id: "LightningBulletStorm",
    tier: 2,
    parentEvolutionId: "MachineGun",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Lightning Bullet Storm",
    summary: "Burst fire accelerates into a wide storm of electrified rounds.",
    overrides: {
      fireMode: "BURST",
      burstCount: 14,
      burstShotDamageMult: 0.14,
      burstIntervalSec: 0.055,
      spreadDeg: 18
    }
  }),
  createEvolution({
    id: "ExecutionerRail",
    tier: 2,
    parentEvolutionId: "SniperShot",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Executioner Rail",
    summary: "High-damage rail beams with sharper falloff scaling.",
    overrides: {
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      damageMult: 1.8,
      sniperPierceFalloff: {
        factor: 0.9,
        floor: 0.75
      }
    }
  }),
  createEvolution({
    id: "RapidMarksman",
    tier: 2,
    parentEvolutionId: "SniperShot",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Rapid Marksman",
    summary: "Precision beams with a much faster firing rhythm.",
    overrides: {
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      attackSpeedMult: 1.5,
      sniperPierceFalloff: {
        factor: 0.82,
        floor: 0.55
      }
    }
  }),
  createEvolution({
    id: "HyperRailBeam",
    tier: 2,
    parentEvolutionId: "SniperShot",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Hyper Rail Beam",
    summary: "Ultra-stable rail beam with reduced falloff and larger shots.",
    overrides: {
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      projectileScaleMult: 1.4,
      damageMult: 1.35,
      sniperPierceFalloff: {
        factor: 0.94,
        floor: 0.82
      }
    }
  }),
  createEvolution({
    id: "ColdKiller",
    tier: 2,
    parentEvolutionId: "SniperShot",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Cold Killer",
    summary: "Lethal finishing beam with heavier impact per shot.",
    overrides: {
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      projectileScaleMult: 1.25,
      damageMult: 1.55,
      attackSpeedMult: 1.08,
      sniperPierceFalloff: {
        factor: 0.88,
        floor: 0.72
      }
    }
  }),
  createEvolution({
    id: "CataclysmShot",
    tier: 2,
    parentEvolutionId: "ElementalShot",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Cataclysm Shot",
    summary: "Elemental blasts swell into large high-damage detonations.",
    overrides: {
      projectileScaleMult: 1.55,
      damageMult: 1.75,
      projectileSpeedMult: 0.95,
      attackSpeedMult: 1.02
    }
  }),
  createEvolution({
    id: "StormChannel",
    tier: 2,
    parentEvolutionId: "ElementalShot",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Storm Channel",
    summary: "Elemental fire accelerates into a rapid storm cadence.",
    overrides: {
      projectileScaleMult: 1.12,
      damageMult: 1.2,
      projectileSpeedMult: 1.08,
      attackSpeedMult: 1.42
    }
  }),
  createEvolution({
    id: "ArcaneBeam",
    tier: 2,
    parentEvolutionId: "ElementalShot",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Arcane Beam",
    summary: "Elemental power condenses into a precise piercing beam.",
    overrides: {
      infiniteRange: true,
      pierceEnabled: true,
      pierceMaxTargets: 999999,
      canSteer: false,
      projectileScaleMult: 1.2,
      damageMult: 1.3,
      attackSpeedMult: 1.12,
      sniperPierceFalloff: {
        factor: 0.92,
        floor: 0.75
      }
    }
  }),
  createEvolution({
    id: "ChaosElements",
    tier: 2,
    parentEvolutionId: "ElementalShot",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2,
    name: "Chaos Elements",
    summary: "Volatile elemental shots surge with balanced all-round power.",
    overrides: {
      projectileScaleMult: 1.3,
      damageMult: 1.4,
      projectileSpeedMult: 1.12,
      attackSpeedMult: 1.22
    }
  })
];

export function getAttackEvolutionsForWeapon(baseWeaponId) {
  return ATTACK_EVOLUTION_DEFS.filter((evo) => evo.baseWeaponId === baseWeaponId);
}

export function getAttackEvolutionById(evolutionId) {
  return ATTACK_EVOLUTION_DEFS.find((evo) => evo.id === evolutionId) || null;
}

export function getTier1EvolutionIdByCategory(category) {
  return TIER1_EVOLUTION_BY_CATEGORY[category] || null;
}

export function getTier1EvolutionOptions(categories = [], baseWeaponId = BASE_WEAPON_ID) {
  return categories
    .map((category) => getTier1EvolutionIdByCategory(category))
    .map((id) => getAttackEvolutionById(id))
    .filter((def) => def && def.baseWeaponId === baseWeaponId);
}

export function getTier2EvolutionId(parentEvolutionId, category) {
  return TIER2_EVOLUTION_MATRIX[parentEvolutionId]?.[category] || null;
}

export function getTier2EvolutionOptions(parentEvolutionId, categories = [], baseWeaponId = BASE_WEAPON_ID) {
  return categories
    .map((category) => getTier2EvolutionId(parentEvolutionId, category))
    .map((id) => getAttackEvolutionById(id))
    .filter((def) => def && def.baseWeaponId === baseWeaponId);
}
