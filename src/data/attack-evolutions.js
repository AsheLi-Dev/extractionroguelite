export const ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER1 = "projectile_shot_tier1";
export const ATTACK_EVOLUTION_GROUP_PROJECTILE_SHOT_TIER2 = "projectile_shot_tier2";
export const ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER1 = "blade_blast_tier1";
export const ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2 = "blade_blast_tier2";

const BASE_WEAPON_ID = "ProjectileShot";
export const BLADE_BLAST_BASE_WEAPON_ID = "BladeBlast";

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

export const BLADE_BLAST_TIER1_EVOLUTION_BY_CATEGORY = {
  damage: "BladeStorm",
  rhythm: "TwinFang",
  control: "SkySplitter",
  onhit: "RunicDetonation"
};

export const BLADE_BLAST_TIER2_EVOLUTION_MATRIX = {
  BladeStorm: {
    damage: "RuinTempest",
    rhythm: "CycloneEdge",
    control: "ExecutionGrid",
    onhit: "EmberLattice"
  },
  TwinFang: {
    damage: "CrimsonDuet",
    rhythm: "ThousandCuts",
    control: "OrbitBreaker",
    onhit: "SparkBarrage"
  },
  SkySplitter: {
    damage: "GuillotineArc",
    rhythm: "StormSteps",
    control: "AstralLattice",
    onhit: "FrozenShards"
  },
  RunicDetonation: {
    damage: "CataclysmSigil",
    rhythm: "ChainBurst",
    control: "GravityBrand",
    onhit: "ChaosDetonation"
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
  }),
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_BladeStorm",
    transformName: "Blade Storm",
    id: "BladeStorm",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER1,
    name: "Blade Storm",
    sourceCategory: "damage",
    summary: "Heavier rotating blades with a higher-damage blast finish.",
    overrides: { damageMult: 1.25, bladeCount: 1, blastRadiusMult: 1.1 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_TwinFang",
    transformName: "Twin Fang",
    id: "TwinFang",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER1,
    name: "Twin Fang",
    sourceCategory: "rhythm",
    summary: "Faster chained blades with tighter recovery and follow-up timing.",
    overrides: { attackSpeedMult: 1.2, bladeCount: 2 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_SkySplitter",
    transformName: "Sky Splitter",
    id: "SkySplitter",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER1,
    name: "Sky Splitter",
    sourceCategory: "control",
    summary: "Longer reach and cleaner spacing control on each blast chain.",
    overrides: { rangeMult: 1.2, blastRadiusMult: 1.15 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_RunicDetonation",
    transformName: "Runic Detonation",
    id: "RunicDetonation",
    tier: 1,
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER1,
    name: "Runic Detonation",
    sourceCategory: "onhit",
    summary: "Blade hits prime targets for volatile explosive follow-up bursts.",
    overrides: { onHitBlastChance: 0.2, blastRadiusMult: 1.05 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_RuinTempest",
    transformName: "Ruin Tempest",
    id: "RuinTempest",
    tier: 2,
    parentEvolutionId: "BladeStorm",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Ruin Tempest",
    summary: "A brutal storm of oversized blades and crushing detonations.",
    overrides: { damageMult: 1.5, blastRadiusMult: 1.25 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_CycloneEdge",
    transformName: "Cyclone Edge",
    id: "CycloneEdge",
    tier: 2,
    parentEvolutionId: "BladeStorm",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Cyclone Edge",
    summary: "Damage-focused blades spin into a much faster cyclone cadence.",
    overrides: { damageMult: 1.3, attackSpeedMult: 1.2 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_ExecutionGrid",
    transformName: "Execution Grid",
    id: "ExecutionGrid",
    tier: 2,
    parentEvolutionId: "BladeStorm",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Execution Grid",
    summary: "Storm blades lock down wider lanes before the finishing blast.",
    overrides: { damageMult: 1.32, rangeMult: 1.18, blastRadiusMult: 1.2 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_EmberLattice",
    transformName: "Ember Lattice",
    id: "EmberLattice",
    tier: 2,
    parentEvolutionId: "BladeStorm",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Ember Lattice",
    summary: "Each blade impact can seed additional explosive marks.",
    overrides: { damageMult: 1.28, onHitBlastChance: 0.35 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_CrimsonDuet",
    transformName: "Crimson Duet",
    id: "CrimsonDuet",
    tier: 2,
    parentEvolutionId: "TwinFang",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Crimson Duet",
    summary: "Twin blades hit harder without losing their paired cadence.",
    overrides: { damageMult: 1.38, bladeCount: 2 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_ThousandCuts",
    transformName: "Thousand Cuts",
    id: "ThousandCuts",
    tier: 2,
    parentEvolutionId: "TwinFang",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Thousand Cuts",
    summary: "An extreme tempo form built around relentless blade output.",
    overrides: { attackSpeedMult: 1.4, bladeCount: 3 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_OrbitBreaker",
    transformName: "Orbit Breaker",
    id: "OrbitBreaker",
    tier: 2,
    parentEvolutionId: "TwinFang",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Orbit Breaker",
    summary: "Twin blades orbit with tighter formation and stronger crowd control.",
    overrides: { attackSpeedMult: 1.18, rangeMult: 1.15 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_SparkBarrage",
    transformName: "Spark Barrage",
    id: "SparkBarrage",
    tier: 2,
    parentEvolutionId: "TwinFang",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Spark Barrage",
    summary: "Twin hits chain into rapid bursts of smaller detonations.",
    overrides: { attackSpeedMult: 1.16, onHitBlastChance: 0.3 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_GuillotineArc",
    transformName: "Guillotine Arc",
    id: "GuillotineArc",
    tier: 2,
    parentEvolutionId: "SkySplitter",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Guillotine Arc",
    summary: "Long-range cuts slam down with a heavier finishing detonation.",
    overrides: { damageMult: 1.42, rangeMult: 1.2 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_StormSteps",
    transformName: "Storm Steps",
    id: "StormSteps",
    tier: 2,
    parentEvolutionId: "SkySplitter",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Storm Steps",
    summary: "Spacing-focused strikes speed up into a flowing multi-step pattern.",
    overrides: { attackSpeedMult: 1.26, rangeMult: 1.12 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_AstralLattice",
    transformName: "Astral Lattice",
    id: "AstralLattice",
    tier: 2,
    parentEvolutionId: "SkySplitter",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Astral Lattice",
    summary: "Precision control form with broader spacing and steadier blasts.",
    overrides: { rangeMult: 1.28, blastRadiusMult: 1.22 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_FrozenShards",
    transformName: "Frozen Shards",
    id: "FrozenShards",
    tier: 2,
    parentEvolutionId: "SkySplitter",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Frozen Shards",
    summary: "Controlled cuts scatter sharp impact bursts on hit.",
    overrides: { rangeMult: 1.18, onHitBlastChance: 0.28 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_CataclysmSigil",
    transformName: "Cataclysm Sigil",
    id: "CataclysmSigil",
    tier: 2,
    parentEvolutionId: "RunicDetonation",
    sourceCategory: "damage",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Cataclysm Sigil",
    summary: "Explosive runes erupt into large, high-damage finishing blasts.",
    overrides: { damageMult: 1.45, blastRadiusMult: 1.28, onHitBlastChance: 0.26 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_ChainBurst",
    transformName: "Chain Burst",
    id: "ChainBurst",
    tier: 2,
    parentEvolutionId: "RunicDetonation",
    sourceCategory: "rhythm",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Chain Burst",
    summary: "Volatile marks erupt more often and keep the chain moving.",
    overrides: { attackSpeedMult: 1.22, onHitBlastChance: 0.4 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_GravityBrand",
    transformName: "Gravity Brand",
    id: "GravityBrand",
    tier: 2,
    parentEvolutionId: "RunicDetonation",
    sourceCategory: "control",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Gravity Brand",
    summary: "Explosive marks tighten enemy spacing before they detonate.",
    overrides: { rangeMult: 1.12, blastRadiusMult: 1.24, onHitBlastChance: 0.32 }
  },
  {
    baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
    icon: null,
    transformChoiceId: "Transform_ChaosDetonation",
    transformName: "Chaos Detonation",
    id: "ChaosDetonation",
    tier: 2,
    parentEvolutionId: "RunicDetonation",
    sourceCategory: "onhit",
    groupId: ATTACK_EVOLUTION_GROUP_BLADE_BLAST_TIER2,
    name: "Chaos Detonation",
    summary: "Maximum on-hit volatility with frequent chained blasts.",
    overrides: { damageMult: 1.34, onHitBlastChance: 0.5, blastRadiusMult: 1.15 }
  }
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

export function getBladeBlastTier1EvolutionIdByCategory(category) {
  return BLADE_BLAST_TIER1_EVOLUTION_BY_CATEGORY[category] || null;
}

export function getBladeBlastTier1EvolutionOptions(categories = [], baseWeaponId = BLADE_BLAST_BASE_WEAPON_ID) {
  return categories
    .map((category) => getBladeBlastTier1EvolutionIdByCategory(category))
    .map((id) => getAttackEvolutionById(id))
    .filter((def) => def && def.baseWeaponId === baseWeaponId);
}

export function getBladeBlastTier2EvolutionId(parentEvolutionId, category) {
  return BLADE_BLAST_TIER2_EVOLUTION_MATRIX[parentEvolutionId]?.[category] || null;
}

export function getBladeBlastTier2EvolutionOptions(parentEvolutionId, categories = [], baseWeaponId = BLADE_BLAST_BASE_WEAPON_ID) {
  return categories
    .map((category) => getBladeBlastTier2EvolutionId(parentEvolutionId, category))
    .map((id) => getAttackEvolutionById(id))
    .filter((def) => def && def.baseWeaponId === baseWeaponId);
}
