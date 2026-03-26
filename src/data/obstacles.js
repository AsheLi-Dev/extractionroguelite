export const OBSTACLE_TYPES = {
  largePond: {
    id: "largePond",
    name: "Large Pond",
    maps: [0, 1, 2, 3, 4], // All maps (safe default)
    blocksMovement: true,
    blocksProjectiles: false,
    // Ponds should not block melee/projectile hitboxes.
    blocksAttackHitboxes: false,
    // Size will be refined from atlas frame once loaded; this is a safe fallback.
    size: { w: 56, h: 35 },
    drawScale: 1,
    collisionScale: 0.9,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/1.First Layer/ponds.png",
      defsSrc: "assets/Environments/1. OpenWorld/1.First Layer/ponds.json",
      frameIds: ["pond_large_1", "pond_large_2"]
    },
    shadowColor: "rgba(0, 0, 0, 0.12)"
  },
  smallPonds: {
    id: "smallPonds",
    name: "Small Ponds (Decorative)",
    maps: [0, 1, 2, 3, 4], // All maps (safe default)
    blocksMovement: false,
    blocksProjectiles: false,
    blocksAttackHitboxes: false,
    // Fallback; replaced by chosen atlas frame size once loaded.
    size: { w: 17, h: 23 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/1.First Layer/ponds.png",
      defsSrc: "assets/Environments/1. OpenWorld/1.First Layer/ponds.json",
      frameIds: ["pond_5", "pond_9", "pond_10", "pond_11"]
    },
    shadowColor: "rgba(0, 0, 0, 0.06)"
  },
  magicPillarSmall: {
    id: "magicPillarSmall",
    name: "Magic Pillar (Small)",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    // Default hitbox blocking behaviour is fine (same as ruinPillar).
    size: { w: 49, h: 132 },
    placementSize: { w: 49, h: 132 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/2 Small Magic Pillars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/magicPillars_small.json",
      frameIds: ["magic_pillar_small_1", "magic_pillar_small_2"]
    },
    shadowColor: "rgba(0, 0, 0, 0.22)"
  },
  magicPillarMedium: {
    id: "magicPillarMedium",
    name: "Magic Pillar (Medium)",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 103, h: 165 },
    placementSize: { w: 103, h: 165 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/3 medium magic pillars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/magicPillars_medium.json",
      frameIds: ["magic_pillar_medium_1", "magic_pillar_medium_2", "magic_pillar_medium_3"]
    },
    shadowColor: "rgba(0, 0, 0, 0.24)"
  },
  magicPillarLarge: {
    id: "magicPillarLarge",
    name: "Magic Pillar (Large)",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 66, h: 289 },
    placementSize: { w: 66, h: 289 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/2 Large Magic Pillars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/magicPillars_large.json",
      frameIds: ["magic_pillar_large_1", "magic_pillar_large_2"]
    },
    shadowColor: "rgba(0, 0, 0, 0.26)"
  },
  darkPillarSmall: {
    id: "darkPillarSmall",
    name: "Dark Pillar (Small)",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 49, h: 132 },
    placementSize: { w: 49, h: 132 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/2 small dark pillars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/darkPillars_small.json",
      frameIds: ["dark_pillar_small_1", "dark_pillar_small_2"]
    },
    shadowColor: "rgba(0, 0, 0, 0.25)"
  },
  darkPillarMedium: {
    id: "darkPillarMedium",
    name: "Dark Pillar (Medium)",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 103, h: 165 },
    placementSize: { w: 103, h: 165 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/3 mediu dark pillars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/darkPillars_medium.json",
      frameIds: ["dark_pillar_medium_1", "dark_pillar_medium_2", "dark_pillar_medium_3"]
    },
    shadowColor: "rgba(0, 0, 0, 0.27)"
  },
  darkPillarLarge: {
    id: "darkPillarLarge",
    name: "Dark Pillar (Large)",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 66, h: 289 },
    placementSize: { w: 66, h: 289 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/2 large dark pillars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/darkPillars_large.json",
      frameIds: ["dark_pillar_large_1", "dark_pillar_large_2"]
    },
    shadowColor: "rgba(0, 0, 0, 0.29)"
  },
  magicAltar: {
    id: "magicAltar",
    name: "Magic Altar",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    // Only the lower 80% should block.
    collisionBottomRatio: 0.8,
    size: { w: 137, h: 100 },
    placementSize: { w: 137, h: 100 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/3 magic altars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/magicAltars.json",
      frameIds: ["magic_altar_1", "magic_altar_2", "magic_altar_3"]
    },
    shadowColor: "rgba(0, 0, 0, 0.22)"
  },
  darkAltar: {
    id: "darkAltar",
    name: "Dark Altar",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    // Only the lower 80% should block.
    collisionBottomRatio: 0.8,
    size: { w: 137, h: 100 },
    placementSize: { w: 137, h: 100 },
    drawScale: 1,
    atlas: {
      sheetSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/3 dark altars.png",
      defsSrc: "assets/Environments/1. OpenWorld/4.SingleObj/Special/darkAltars.json",
      frameIds: ["dark_altar_1", "dark_altar_2", "dark_altar_3"]
    },
    shadowColor: "rgba(0, 0, 0, 0.26)"
  },
  giantRock: {
    id: "giantRock",
    name: "Giant Rock",
    maps: [0, 1, 2, 3, 4], // All maps
    blocksMovement: true,
    blocksProjectiles: true,
    /** Draw + collision footprint vs natural PNG (rockAA_* 143×148 at 1.0). */
    worldScale: 0.5,
    size: { w: 72, h: 74 },
    placementSize: { w: 72, h: 74 },
    /** Hitbox = this fraction of sprite w/h, bottom-centered. */
    collisionScale: 0.7,
    spriteSources: [
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_01.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_02.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_03.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_04.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_05.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_06.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_07.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_08.png",
    ],
    color: "#4a5568",
    shadowColor: "rgba(0, 0, 0, 0.3)"
  },
  ancientTree: {
    id: "ancientTree",
    name: "Ancient Tree",
    maps: [0, 1], // Dungeon, Forest
    blocksMovement: true,
    blocksProjectiles: true,
    /** Draw + collision footprint vs natural PNG (treeBB_* 228×295 at 1.0). */
    worldScale: 0.5,
    size: { w: 114, h: 148 },
    placementSize: { w: 114, h: 148 },
    /** Hitbox = these fractions of sprite w/h, bottom-centered. */
    collisionWidthRatio: 0.3,
    collisionHeightRatio: 0.1,
    /** Nudge hitbox up from sprite bottom (world px). */
    collisionLiftPx: 32,
    /** World px: from player center, tree alpha lerps from `canopyFadeMinAlpha` to `canopyFadeMaxAlpha`. */
    canopyFadeRadius: 130,
    canopyFadeMinAlpha: 0.4,
    canopyFadeMaxAlpha: 1,
    /** Depth for Y-sort: `position.y + size.h * this` (may be >1 to push anchor below sprite foot). */
    ySortHeightRatio: 1.2,
    spriteSources: [
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_01.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_02.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_03.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_04.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_05.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_06.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_07.png",
      "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_08.png",
    ],
    color: "#2d5016",
    canopyColor: "#1a3d0a",
    shadowColor: "rgba(0, 0, 0, 0.4)"
  },
  lavaRock: {
    id: "lavaRock",
    name: "Lava Rock",
    maps: [4], // Wasteland
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 56, h: 56 },
    color: "#8b4513",
    glowColor: "#ff4500",
    burnDamage: 2,
    burnInterval: 0.5,
    shadowColor: "rgba(255, 69, 0, 0.4)"
  },
  iceBlock: {
    id: "iceBlock",
    name: "Ice Block",
    maps: [2], // Cave
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 48, h: 48 },
    color: "#b0e0e6",
    meltTime: 30,
    shadowColor: "rgba(0, 0, 0, 0.2)"
  },
  bonePile: {
    id: "bonePile",
    name: "Bone Pile",
    maps: [0], // Dungeon
    blocksMovement: false,
    blocksProjectiles: false,
    size: { w: 32, h: 24 },
    color: "#e2e8f0",
    spawnChance: 0.05,
    shadowColor: "rgba(0, 0, 0, 0.2)"
  },
  ruinPillar: {
    id: "ruinPillar",
    name: "Ruin Pillar",
    maps: [0, 1, 2, 3, 4],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 32, h: 96 },
    /** Used for overlap checks when placing so sprites (which load at natural size) don't overlap. */
    placementSize: { w: 104, h: 144 },
    color: "#5a5a6a",
    shadowColor: "rgba(0, 0, 0, 0.3)",
    spriteSources: [
      "assets/Environments/Forest Land/ruin pillars/ruin pillar.png",
      "assets/Environments/Forest Land/ruin pillars/ruin pillar (1).png",
      "assets/Environments/Forest Land/ruin pillars/ruin pillar (2).png",
      "assets/Environments/Forest Land/ruin pillars/ruin pillar (3).png",
      "assets/Environments/Forest Land/ruin pillars/ruin pillar (4).png",
      "assets/Environments/Forest Land/ruin pillars/ruin pillar (5).png",
      "assets/Environments/Forest Land/ruin pillars/ruin pillar (6).png"
    ]
  },
  knightStoneWall: {
    id: "knightStoneWall",
    name: "Stone Wall",
    maps: [],
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 96, h: 32 },
    color: "#94a3b8",
    glowColor: "rgba(226, 232, 240, 0.35)",
    shadowColor: "rgba(15, 23, 42, 0.35)"
  }
};
