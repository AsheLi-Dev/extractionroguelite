/**
 * ENEMY_ATTACK_KITS - per-enemy attack definitions.
 * Keyed by enemy name (from ENEMY_TYPES).
 * base: available to all tiers
 * hidden: only when tier === "miniBoss"
 */

export const ENEMY_ATTACK_KITS = {
  Orc: {
    base: [
      {
        id: "orc_cleave",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.55, color: "heavy" },
        execute: { damage: 1, range: 300, arc: 90 },
        recover: 0.3,
        cooldown: 2.2,
        minRange: 30,
        maxRange: 100,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "orc_ground_slam",
        kind: "ring",
        telegraph: { shape: "ring", windup: 0.8, color: "heavy" },
        execute: { damage: 1.4, innerRadius: 40, outerRadius: 240 },
        recover: 0.4,
        cooldown: 4,
        minRange: 0,
        maxRange: 150,
        weight: 0.6,
        flags: { heavy: true }
      }
    ]
  },

  "Orc Wizard": {
    base: [
      {
        id: "orc_wizard_fireball",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 1, color: "magic" },
        execute: {
          damage: 0.9,
          speed: 220,
          volleyCount: 6,
          volleyBurstSize: 3,
          volleyBurstInterval: 0.3,
          randomSpreadDeg: 30,
          color: "#a855f7",
          size: 10,
          animatedSprite: { preset: "ghostOrb" },
          useHitbox: true
        },
        recover: 0.5,
        cooldown: 2.5,
        minRange: 80,
        maxRange: 400,
        weight: 1,
        flags: { magic: true }
      }
    ],
    hidden: [
      {
        id: "orc_wizard_orbiting_orbs",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.5, color: "magic" },
        execute: {
          damage: 0.6,
          speed: 180,
          count: 3,
          spread: 30,
          color: "#a855f7",
          duration: 6,
          magicStyle: { preset: "arcaneBolt" },
          useHitbox: true
        },
        recover: 0.2,
        cooldown: 12,
        minRange: 60,
        maxRange: 350,
        weight: 0.5,
        flags: { magic: true }
      },
      {
        id: "orc_wizard_teleport",
        kind: "teleport",
        telegraph: { shape: "circle", windup: 0.2, color: "magic" },
        execute: { backDist: 120, invulnDuration: 0.4 },
        recover: 0.15,
        cooldown: 15,
        minRange: 0,
        maxRange: 200,
        weight: 0.3,
        flags: { magic: true }
      }
    ]
  },

  Goblin: {
    base: [
      {
        id: "goblin_dash_stab",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.35, color: "fast" },
        execute: { damage: 1, dashDist: 180, dashSpeed: 450 },
        recover: 0.2,
        cooldown: 1.8,
        minRange: 20,
        maxRange: 120,
        weight: 1,
        flags: { fast: true }
      }
    ],
    hidden: [
      {
        id: "goblin_triple_dash",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.3, color: "fast" },
        execute: { damage: 0.7, dashDist: 140, dashSpeed: 500, comboCount: 3 },
        recover: 0.15,
        cooldown: 6,
        minRange: 25,
        maxRange: 100,
        weight: 0.6,
        flags: { fast: true }
      },
      {
        id: "goblin_poison_trail",
        kind: "projectile",
        telegraph: { shape: "line", windup: 0.25, color: "poison" },
        execute: { damage: 0.5, poisonTrail: true, trailDuration: 2 },
        recover: 0.2,
        cooldown: 5,
        minRange: 30,
        maxRange: 80,
        weight: 0.4,
        flags: { poison: true }
      }
    ]
  },

  "Goblin Archer": {
    base: [
      {
        id: "goblin_archer_arrow",
        kind: "projectile",
        telegraph: { shape: "line", windup: 0.5, color: "fast" },
        execute: {
          damage: 0.85,
          speed: 380,
          count: 1,
          comboShots: 3,
          color: "#94a3b8",
          size: 10,
          useHitbox: true,
          movementType: "zigzag"
        },
        recover: 1,
        cooldown: 2,
        minRange: 100,
        maxRange: 400,
        weight: 1,
        flags: { fast: true }
      }
    ],
    hidden: [
      {
        id: "goblin_archer_rain_volley",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.7, color: "heavy" },
        execute: { damage: 0.8, radius: 110, delayedCount: 3, delay: 0.25, atTarget: true },
        recover: 0.35,
        cooldown: 7,
        minRange: 150,
        maxRange: 350,
        weight: 0.5,
        flags: { heavy: true }
      },
      {
        id: "goblin_archer_backstep",
        kind: "teleport",
        telegraph: { shape: "circle", windup: 0.15, color: "fast" },
        execute: { backDist: 80, invulnDuration: 0.2 },
        recover: 0.1,
        cooldown: 4,
        minRange: 0,
        maxRange: 60,
        weight: 0.7,
        flags: { fast: true }
      }
    ]
  },

  "Goblin Mage": {
    base: [
      {
        id: "goblin_mage_dark_orb_burst",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.4, color: "magic" },
        execute: {
          damage: 0.75,
          speed: 220,
          count: 1,
          burstCount: 3,
          burstInterval: 0.2,
          retargetOnBurst: true,
          color: "#1b102c",
          size: 16,
          animatedSprite: { preset: "ghostOrb" },
          useHitbox: true
        },
        recover: 0.2,
        cooldown: 5,
        minRange: 80,
        maxRange: 420,
        weight: 1,
        flags: { magic: true }
      }
    ]
  },

  Troll: {
    base: [
      {
        id: "troll_heavy_smash",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.85, color: "heavy" },
        execute: { damage: 1.3, radius: 170 },
        recover: 0.45,
        cooldown: 3,
        minRange: 0,
        maxRange: 120,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "troll_regen_channel",
        kind: "regen_channel",
        telegraph: { shape: "circle", windup: 0.5, color: "magic" },
        execute: { duration: 2.5, regenRate: 15, breakDamage: 50 },
        recover: 0.2,
        cooldown: 20,
        minRange: 0,
        maxRange: 999,
        weight: 0.3,
        flags: { magic: true }
      },
      {
        id: "troll_boulder_throw",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.7, color: "heavy" },
        execute: { damage: 1.2, speed: 200, count: 1, color: "#78716c", size: 18, useHitbox: true },
        recover: 0.35,
        cooldown: 5,
        minRange: 100,
        maxRange: 350,
        weight: 0.6,
        flags: { heavy: true }
      }
    ]
  },

  Ettin: {
    base: [
      {
        id: "ettin_alternating_slam",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.6, color: "heavy" },
        execute: { damage: 1.1, radius: 140, staggeredCount: 2, staggerDelay: 0.3 },
        recover: 0.4,
        cooldown: 2.8,
        minRange: 0,
        maxRange: 110,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "ettin_twin_combo",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.75, color: "heavy" },
        execute: { damage: 1.4, radius: 190 },
        recover: 0.5,
        cooldown: 6,
        minRange: 0,
        maxRange: 130,
        weight: 0.5,
        flags: { heavy: true }
      },
      {
        id: "ettin_rock_throw",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.5, color: "heavy" },
        execute: { damage: 1, speed: 250, count: 1, color: "#78716c", size: 14, useHitbox: true },
        recover: 0.3,
        cooldown: 4,
        minRange: 80,
        maxRange: 300,
        weight: 0.5,
        flags: { heavy: true }
      }
    ]
  },

  "Big Slime": {
    base: [
      {
        id: "big_slime_jump_slam",
        kind: "jump_slam",
        telegraph: { shape: "circle", windup: 0.75, color: "heavy" },
        execute: { damage: 1.2, radius: 170 },
        recover: 0.4,
        cooldown: 3.5,
        minRange: 40,
        maxRange: 150,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "big_slime_split",
        kind: "summon",
        telegraph: { shape: "circle", windup: 0.4, color: "poison" },
        execute: { count: 3, spawnType: "m_3a_small_slime" },
        recover: 0.5,
        cooldown: 999,
        minRange: 0,
        maxRange: 999,
        weight: 0,
        flags: { summon: true }
      }
    ]
  },

  "Skeleton Archer": {
    base: [
      {
        id: "skeleton_archer_arrow",
        kind: "projectile",
        telegraph: { shape: "line", windup: 0.55, color: "fast" },
        execute: { damage: 0.9, speed: 350, count: 1, color: "#e2e8f0", size: 10, useHitbox: true },
        recover: 0.2,
        cooldown: 2.2,
        minRange: 100,
        maxRange: 400,
        weight: 1,
        flags: { fast: true }
      }
    ],
    hidden: [
      {
        id: "skeleton_archer_bone_barrage",
        kind: "projectile",
        telegraph: { shape: "cone", windup: 0.6, color: "magic" },
        execute: { damage: 0.6, speed: 320, count: 5, spread: 25, color: "#e2e8f0", size: 8, useHitbox: true },
        recover: 0.35,
        cooldown: 6,
        minRange: 120,
        maxRange: 350,
        weight: 0.5,
        flags: { magic: true }
      },
      {
        id: "skeleton_archer_summon",
        kind: "summon",
        telegraph: { shape: "circle", windup: 0.8, color: "magic" },
        execute: { count: 2, spawnType: "m_5a_skeleton" },
        recover: 0.4,
        cooldown: 18,
        minRange: 0,
        maxRange: 200,
        weight: 0.3,
        flags: { summon: true }
      }
    ]
  },

  Lich: {
    base: [
      {
        id: "lich_shadow_orb",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.6, color: "magic" },
        execute: {
          damage: 1.1,
          speed: 131,
          count: 1,
          color: "#7c3aed",
          size: 84,
          animatedSprite: { preset: "ghostOrb" },
          moveMode: "accelerating",
          maxSpeed: 300,
          accel: 169,
          lifetime: 1,
          lichOrbBurst: { count: 10, size: 8.4, speed: 200, delay: 0.1 },
          useHitbox: true
        },
        recover: 0.25,
        cooldown: 2.5,
        minRange: 100,
        maxRange: 400,
        weight: 1,
        flags: { magic: true }
      }
    ],
    hidden: [
      {
        id: "lich_death_circle",
        kind: "circle",
        telegraph: { shape: "circle", windup: 1, color: "magic" },
        execute: { damage: 1.5, radius: 280, delay: 0.3 },
        recover: 0.5,
        cooldown: 12,
        minRange: 80,
        maxRange: 250,
        weight: 0.4,
        flags: { magic: true }
      },
      {
        id: "lich_teleport_chain",
        kind: "teleport",
        telegraph: { shape: "circle", windup: 0.3, color: "magic" },
        execute: { backDist: 100, chainCount: 2, invulnDuration: 0.2 },
        recover: 0.2,
        cooldown: 10,
        minRange: 0,
        maxRange: 300,
        weight: 0.4,
        flags: { magic: true }
      }
    ]
  },

  Zombie: {
    base: [
      {
        id: "zombie_lunge_dash",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.7, color: "heavy" },
        execute: { damage: 1.0, dashDist: 220, dashSpeed: 320 },
        recover: 0.35,
        cooldown: 3.2,
        minRange: 30,
        maxRange: 180,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Small Dummy": {
    base: [
      {
        id: "small_dummy_lunge_dash",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.7, color: "heavy" },
        execute: { damage: 1.0, dashDist: 220, dashSpeed: 320 },
        recover: 0.35,
        cooldown: 3.2,
        minRange: 30,
        maxRange: 180,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Small Dwarfette": {
    base: [
      {
        id: "small_dwarfette_lunge_dash",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.7, color: "heavy" },
        execute: { damage: 1.0, dashDist: 220, dashSpeed: 320 },
        recover: 0.35,
        cooldown: 3.2,
        minRange: 30,
        maxRange: 180,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Medium Dwarfette": {
    base: [
      {
        id: "medium_dwarfette_rolling_attack",
        kind: "roll",
        telegraph: { shape: "line", windup: 0.65, color: "heavy" },
        execute: {
          damage: 1.2,
          speed: 420,
          duration: 5.0,
          hitInterval: 0.25,
          bounceHoming: 0.4,
          bounceHomingTurnRate: 2.8,
          postEndAnimDuration: 0.42,
          postCooldown: 5.0,
          length: 220,
          width: 44
        },
        recover: 0.2,
        cooldown: 5.0,
        minRange: 20,
        maxRange: 280,
        weight: 1,
        flags: { heavy: true, fast: true }
      }
    ]
  },

  "Strong Dwarfette": {
    base: [
      {
        id: "strong_dwarfette_rolling_attack",
        kind: "roll",
        telegraph: { shape: "line", windup: 0.65, color: "heavy" },
        execute: {
          damage: 1.2,
          speed: 360,
          duration: 5.0,
          hitInterval: 0.25,
          bounceHoming: 0.4,
          bounceHomingTurnRate: 2.8,
          postEndAnimDuration: 0.42,
          postCooldown: 5.0,
          length: 220,
          width: 44
        },
        recover: 0.2,
        cooldown: 5.0,
        minRange: 20,
        maxRange: 280,
        weight: 1,
        flags: { heavy: true, fast: true }
      }
    ]
  },

  "Large Dwarfette Ball": {
    base: [
      {
        id: "large_dwarfette_ball_rolling_attack",
        kind: "roll",
        telegraph: { shape: "line", windup: 0.65, color: "heavy" },
        execute: {
          damage: 1.2,
          speed: 300,
          duration: 5.0,
          hitInterval: 0.25,
          bounceHoming: 0.4,
          bounceHomingTurnRate: 2.8,
          postEndAnimDuration: 0.42,
          postCooldown: 5.0,
          length: 220,
          width: 44
        },
        recover: 0.2,
        cooldown: 5.0,
        minRange: 20,
        maxRange: 280,
        weight: 1,
        flags: { heavy: true, fast: true }
      }
    ]
  },

  "Medium Dummy": {
    base: [
      {
        id: "medium_dummy_spin_attack",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.6, color: "heavy" },
        execute: { damage: 1.1, radius: 100 },
        recover: 0.35,
        cooldown: 2.8,
        minRange: 0,
        maxRange: 130,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Advanced Dummy": {
    base: [
      {
        id: "advanced_dummy_spin_attack",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.6, color: "heavy" },
        execute: { damage: 1.1, radius: 100 },
        recover: 0.35,
        cooldown: 2.8,
        minRange: 0,
        maxRange: 130,
        weight: 1,
        flags: { heavy: true }
      },
      {
        id: "advanced_dummy_lunge_dash",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.7, color: "heavy" },
        execute: { damage: 1.0, dashDist: 220, dashSpeed: 320 },
        recover: 0.35,
        cooldown: 3.2,
        minRange: 30,
        maxRange: 180,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Large Dummy": {
    base: [
      {
        id: "large_dummy_charge",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.75, color: "heavy" },
        execute: {
          damage: 1.3,
          dashDist: 260,
          dashSpeed: 180,
          homingTurnRate: 1.2
        },
        recover: 0.4,
        cooldown: 3.6,
        minRange: 40,
        maxRange: 220,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Strong Mimic": {
    base: [
      {
        id: "strong_mimic_sword_thrust",
        kind: "line",
        telegraph: { shape: "line", windup: 0.45, color: "heavy" },
        execute: { damage: 1.15, length: 130, width: 34 },
        recover: 0.25,
        cooldown: 2.1,
        minRange: 20,
        maxRange: 150,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Large Mimic": {
    base: [
      {
        id: "large_mimic_slow_dash",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.8, color: "heavy" },
        execute: {
          damage: 1.25,
          dashDist: 280,
          dashSpeed: 200,
          homingTurnRate: 1.1
        },
        recover: 0.35,
        cooldown: 3.4,
        minRange: 40,
        maxRange: 260,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Large Frog": {
    base: [
      {
        id: "large_frog_burp_spit",
        kind: "burp_summon",
        telegraph: { shape: "line", windup: 0.45, color: "heavy" },
        execute: {
          damage: 0.95,
          flightDuration: 0.85,
          maxUses: 3
        },
        recover: 0.2,
        cooldown: 3.0,
        minRange: 70,
        maxRange: 420,
        weight: 1,
        flags: { heavy: true }
      },
      {
        id: "large_frog_jump_slam",
        kind: "jump_slam",
        telegraph: { shape: "circle", windup: 0.75, color: "heavy" },
        execute: { damage: 1.2, radius: 120 },
        recover: 0.35,
        cooldown: 3.2,
        minRange: 30,
        maxRange: 260,
        weight: 0.85,
        flags: { heavy: true }
      }
    ]
  },

  "Cyclop Archer": {
    base: [
      {
        id: "cyclop_archer_arrow",
        kind: "projectile",
        telegraph: { shape: "line", windup: 0.55, color: "heavy" },
        execute: {
          damage: 1.0,
          speed: 272,
          count: 1,
          burstCount: 2,
          burstInterval: 0.2,
          color: "#cbd5e1",
          size: 11,
          useHitbox: true
        },
        recover: 0.5,
        cooldown: 2.0,
        minRange: 90,
        maxRange: 430,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  Monsteryfly: {
    base: [
      {
        id: "monsteryfly_ground_slam",
        kind: "jump_slam",
        telegraph: { shape: "circle", windup: 0.7, color: "heavy" },
        execute: {
          damage: 1.15,
          radius: 130,
          duration: 0.36,
          jumpHeight: 28,
          recoverAnimDuration: 2.0
        },
        recover: 0.15,
        cooldown: 2.8,
        minRange: 30,
        maxRange: 300,
        weight: 1,
        flags: { heavy: true, fast: true }
      }
    ]
  },

  MonsterSlasher: {
    base: [
      {
        id: "monster_slasher_full_combo",
        kind: "timed_double_cone",
        telegraph: { shape: "cone", windup: 0, color: "heavy" },
        execute: {
          damage: 1.25,
          duration: 1.0,
          firstHitTime: 0.7,
          secondHitTime: 0.9,
          firstCone: { range: 170, arc: 42, angleOffsetDeg: -24 },
          secondCone: { range: 170, arc: 42, angleOffsetDeg: 24 }
        },
        recover: 0,
        cooldown: 2.7,
        minRange: 30,
        maxRange: 260,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Death Knight": {
    base: [
      {
        id: "death_knight_cleave",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.6, color: "heavy" },
        execute: { damage: 1.2, range: 360, arc: 100 },
        recover: 0.35,
        cooldown: 2.5,
        minRange: 40,
        maxRange: 120,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "death_knight_charge",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.7, color: "heavy" },
        execute: { damage: 1.5, dashDist: 560, dashSpeed: 550 },
        recover: 0.5,
        cooldown: 8,
        minRange: 100,
        maxRange: 350,
        weight: 0.5,
        flags: { heavy: true }
      },
      {
        id: "death_knight_raise_undead",
        kind: "summon",
        telegraph: { shape: "circle", windup: 0.9, color: "magic" },
        execute: { count: 2, spawnType: "m_5e_zombie" },
        recover: 0.5,
        cooldown: 20,
        minRange: 0,
        maxRange: 200,
        weight: 0.3,
        flags: { summon: true }
      }
    ]
  },

  DeathBringer: {
    base: [
      {
        id: "death_bringer_cleave",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.5, color: "heavy" },
        execute: { damage: 1, range: 280, arc: 100 },
        recover: 0.35,
        cooldown: 2.5,
        minRange: 40,
        maxRange: 100,
        weight: 1,
        flags: { heavy: true }
      },
      {
        id: "death_bringer_ground_spell",
        kind: "circle",
        telegraph: { shape: "circle", windup: 1.5, color: "magic", atTarget: true },
        execute: { damage: 1.2, radius: 100, delay: 0, atTarget: true },
        recover: 0.3,
        cooldown: 5,
        minRange: 120,
        maxRange: 400,
        weight: 0.7,
        flags: { magic: true }
      }
    ]
  },

  Banshee: {
    base: [
      {
        id: "banshee_scream",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.5, color: "magic" },
        execute: { damage: 0.7, range: 400, arc: 90, slow: 0.3, slowDuration: 1.5 },
        recover: 0.25,
        cooldown: 3,
        minRange: 50,
        maxRange: 150,
        weight: 1,
        flags: { magic: true }
      }
    ],
    hidden: [
      {
        id: "banshee_expanding_scream",
        kind: "ring",
        telegraph: { shape: "ring", windup: 0.6, color: "magic" },
        execute: { damage: 0.9, innerRadius: 60, outerRadius: 260, slow: 0.3, slowDuration: 1.5 },
        recover: 0.3,
        cooldown: 6,
        minRange: 40,
        maxRange: 180,
        weight: 0.5,
        flags: { magic: true }
      },
      {
        id: "banshee_phase",
        kind: "teleport",
        telegraph: { shape: "circle", windup: 0.1, color: "magic" },
        execute: { backDist: 60, invulnDuration: 0.6 },
        recover: 0.1,
        cooldown: 12,
        minRange: 0,
        maxRange: 150,
        weight: 0.4,
        flags: { magic: true }
      }
    ]
  },

  "Giant Spider": {
    base: [
      {
        id: "giant_spider_web_spit",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.5, color: "poison" },
        execute: {
          damage: 0,
          speed: 192,
          count: 6,
          arcSpreadDeg: 60,
          color: "#94a3b8",
          animatedSprite: { preset: "acidProjectile" },
          size: 12,
          slowZone: true,
          slowRadius: 50,
          slowDuration: 2,
          slowMult: 0.7,
          useHitbox: true
        },
        recover: 0.25,
        cooldown: 2.5,
        minRange: 80,
        maxRange: 350,
        weight: 1,
        flags: { poison: true }
      }
    ],
    hidden: [
      {
        id: "giant_spider_web_trap",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.6, color: "poison" },
        execute: { damage: 0.5, radius: 120, slowZone: true, slowDuration: 2, atTarget: true },
        recover: 0.35,
        cooldown: 8,
        minRange: 60,
        maxRange: 250,
        weight: 0.5,
        flags: { poison: true }
      },
      {
        id: "giant_spider_spiderlings",
        kind: "summon",
        telegraph: { shape: "circle", windup: 0.7, color: "poison" },
        execute: { count: 3, spawnType: "m_7j_lesser_giant_spider" },
        recover: 0.4,
        cooldown: 15,
        minRange: 0,
        maxRange: 150,
        weight: 0.4,
        flags: { summon: true }
      }
    ]
  },

  Manticore: {
    base: [
      {
        id: "manticore_tail_spike",
        kind: "projectile",
        telegraph: { shape: "line", windup: 0.45, color: "heavy" },
        execute: { damage: 1, speed: 640, count: 1, color: "#78716c", size: 12, homingTurnRate: 0.2, lifetime: 1.5, length: 128, useHitbox: true },
        recover: 0.25,
        cooldown: 2.2,
        minRange: 100,
        maxRange: 400,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "manticore_aerial_swoop",
        kind: "dash",
        telegraph: { shape: "line", windup: 0.6, color: "heavy" },
        execute: { damage: 1.3, dashDist: 360, dashSpeed: 500 },
        recover: 0.4,
        cooldown: 7,
        minRange: 80,
        maxRange: 250,
        weight: 0.5,
        flags: { heavy: true }
      },
      {
        id: "manticore_triple_spike",
        kind: "projectile",
        telegraph: { shape: "cone", windup: 0.5, color: "heavy" },
        execute: { damage: 0.8, speed: 300, count: 3, spread: 15, color: "#78716c", size: 10, useHitbox: true },
        recover: 0.3,
        cooldown: 5,
        minRange: 100,
        maxRange: 350,
        weight: 0.5,
        flags: { heavy: true }
      }
    ]
  },

  Dryad: {
    base: [
      {
        id: "dryad_root_projectile",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.5, color: "poison" },
        execute: {
          damage: 0.7,
          speed: 154,
          count: 5,
          arcSpreadDeg: 70,
          color: "#22c55e",
          animatedSprite: { preset: "acidProjectile" },
          size: 10.8,
          movementType: "zigzag",
          zigzagAmplitude: 18,
          zigzagFrequency: 6,
          zigzagPhaseStepRad: 1.5707963267948966,
          poisonOnHit: true,
          poisonDuration: 4,
          poisonDmgPerSec: 2,
          slowZone: true,
          slowRadius: 45,
          slowDuration: 2,
          slowMult: 0.8,
          useHitbox: true
        },
        recover: 0.25,
        cooldown: 2.5,
        minRange: 80,
        maxRange: 350,
        weight: 1,
        flags: { poison: true }
      }
    ],
    hidden: [
      {
        id: "dryad_root_cage",
        kind: "ring",
        telegraph: { shape: "ring", windup: 0.7, color: "poison" },
        execute: { damage: 0.6, innerRadius: 80, outerRadius: 180, slow: 0.4, slowDuration: 2, slowZone: true, atTarget: true },
        recover: 0.4,
        cooldown: 10,
        minRange: 60,
        maxRange: 200,
        weight: 0.5,
        flags: { poison: true }
      },
      {
        id: "dryad_summon_treants",
        kind: "summon",
        telegraph: { shape: "circle", windup: 0.9, color: "poison" },
        execute: { count: 2, spawnType: "m_8f_forest_spirit" },
        recover: 0.5,
        cooldown: 18,
        minRange: 0,
        maxRange: 180,
        weight: 0.3,
        flags: { summon: true }
      }
    ]
  },

  "Rock Golem": {
    base: [
      {
        id: "rock_golem_ground_punch",
        kind: "ring",
        telegraph: { shape: "ring", windup: 0.65, color: "heavy" },
        execute: { damage: 1.1, innerRadius: 50, outerRadius: 200 },
        recover: 0.35,
        cooldown: 2.8,
        minRange: 0,
        maxRange: 130,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "rock_golem_armor_phase",
        kind: "armor",
        telegraph: { shape: "circle", windup: 0.4, color: "heavy" },
        execute: { duration: 3, damageMult: 0.5 },
        recover: 0.2,
        cooldown: 15,
        minRange: 0,
        maxRange: 999,
        weight: 0.4,
        flags: { heavy: true }
      },
      {
        id: "rock_golem_rock_pillars",
        kind: "summon",
        telegraph: { shape: "circle", windup: 0.6, color: "heavy" },
        execute: { count: 2, spawnType: "m_11b_large_myconid" }, // TODO: spawn rock pillar obstacles when obstacle system supports it
        recover: 0.4,
        cooldown: 12,
        minRange: 80,
        maxRange: 250,
        weight: 0.4,
        flags: { heavy: true }
      }
    ]
  },

  Dragon: {
    base: [
      {
        id: "dragon_fire_breath",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.7, color: "heavy" },
        execute: { damage: 1.3, range: 520, arc: 75 },
        recover: 0.4,
        cooldown: 3.5,
        minRange: 60,
        maxRange: 180,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  "Drake / Lesser Dragon": {
    base: [
      {
        id: "drake_fire_breath",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.6, color: "heavy" },
        execute: { damage: 1.1, range: 480, arc: 70 },
        recover: 0.35,
        cooldown: 3,
        minRange: 50,
        maxRange: 150,
        weight: 1,
        flags: { heavy: true }
      }
    ],
    hidden: [
      {
        id: "drake_fire_rain",
        kind: "circle",
        telegraph: { shape: "circle", windup: 0.8, color: "heavy" },
        execute: { damage: 0.9, radius: 110, delayedCount: 4, delay: 0.2, atTarget: true },
        recover: 0.45,
        cooldown: 9,
        minRange: 100,
        maxRange: 300,
        weight: 0.5,
        flags: { heavy: true }
      },
      {
        id: "drake_tail_spin",
        kind: "ring",
        telegraph: { shape: "ring", windup: 0.55, color: "heavy" },
        execute: { damage: 1.2, innerRadius: 100, outerRadius: 220 },
        recover: 0.35,
        cooldown: 6,
        minRange: 0,
        maxRange: 140,
        weight: 0.5,
        flags: { heavy: true }
      }
    ]
  },

  "Small Myconid": {
    base: [
      {
        id: "small_myconid_spore_mist",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.8, color: "heavy" },
        execute: { damage: 0.8, range: 100, arc: 45 },
        recover: 0.2,
        cooldown: 3.2,
        minRange: 0,
        maxRange: 140,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  Cultist: {
    base: [
      {
        id: "cultist_dark_orb_burst",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.45, color: "magic" },
        execute: {
          damage: 0.7,
          speed: 210,
          count: 1,
          burstCount: 5,
          burstInterval: 0.2,
          retargetOnBurst: true,
          color: "#120a22",
          size: 14,
          animatedSprite: { preset: "ghostOrb" },
          useHitbox: true
        },
        recover: 0.2,
        cooldown: 7,
        minRange: 80,
        maxRange: 420,
        weight: 1,
        flags: { magic: true }
      }
    ]
  },

  "Human Archer": {
    base: [
      {
        id: "human_archer_shoot",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.25, color: "fast" },
        execute: { damage: 1, speed: 320, count: 1, color: "#78716c", size: 18, spritePath: "assets/Enemies/Arrow.png", useHitbox: true },
        recover: 0.2,
        cooldown: 1.8,
        minRange: 120,
        maxRange: 380,
        weight: 1,
        flags: { fast: true }
      }
    ]
  },
  "Vampire Archer": {
    base: [
      {
        id: "vampire_archer_burst_shot",
        kind: "projectile",
        telegraph: { shape: "circle", windup: 0.2, color: "fast" },
        execute: {
          damage: 0.95,
          speed: 340,
          count: 1,
          burstCount: 3,
          burstInterval: 0.12,
          color: "#b91c1c",
          size: 18,
          spritePath: "assets/Enemies/Arrow.png",
          useHitbox: true
        },
        recover: 0.18,
        cooldown: 2.2,
        minRange: 100,
        maxRange: 420,
        weight: 1,
        flags: { fast: true }
      }
    ]
  },
  Mercenary: {
    base: [
      {
        id: "mercenary_cyclone",
        kind: "cyclone",
        telegraph: { shape: "circle", windup: 0.5, color: "heavy" },
        execute: {
          duration: 3.0,
          radius: 160,
          dps: 1,
          moveSpeed: 90,
          hitInterval: 1.0,
          postEndAnimDuration: 0.5
        },
        recover: 0.2,
        cooldown: 4.2,
        minRange: 0,
        maxRange: 260,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },
  "Human Lancer": {
    base: [
      {
        id: "human_lancer_thrust",
        kind: "line",
        telegraph: { shape: "line", windup: 0.2, color: "heavy" },
        execute: { damage: 1.1, length: 280, width: 72 },
        recover: 0.15,
        cooldown: 2.0,
        minRange: 40,
        maxRange: 200,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },
  "Human Monk": {
    base: [
      {
        id: "human_monk_heal",
        kind: "heal",
        telegraph: { shape: "circle", windup: 0.35, color: "magic" },
        execute: { healAmount: 0.35, healRange: 240 },
        recover: 0.25,
        cooldown: 5.0,
        minRange: 0,
        maxRange: 500,
        weight: 1,
        flags: { magic: true }
      }
    ]
  },
  "Human Warrior": {
    base: [
      {
        id: "human_warrior_slash",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.28, color: "heavy" },
        execute: { damage: 1.2, range: 180, arc: 100 },
        recover: 0.22,
        cooldown: 1.6,
        minRange: 20,
        maxRange: 170,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  },

  RockGiant: {
    base: [
      {
        id: "rock_giant_falling_rocks",
        kind: "falling_rocks",
        telegraph: { shape: "falling_rocks", windup: 1, color: "heavy", count: 5, radius: 48, atTarget: true },
        execute: { damage: 1.1, radius: 48, count: 5, impactDelay: 0, atTarget: true },
        recover: 0.4,
        cooldown: 5,
        minRange: 60,
        maxRange: 320,
        weight: 1,
        flags: { heavy: true }
      },
      {
        id: "rock_giant_cone",
        kind: "cone",
        telegraph: { shape: "cone", windup: 0.5, color: "heavy" },
        execute: { damage: 1.2, range: 140, arc: 100 },
        recover: 0.35,
        cooldown: 2.5,
        minRange: 30,
        maxRange: 130,
        weight: 1,
        flags: { heavy: true }
      }
    ]
  }
};
