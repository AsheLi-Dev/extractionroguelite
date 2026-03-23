export const OBSTACLE_TYPES = {
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
  barrel: {
    id: "barrel",
    name: "Barrel",
    maps: [0, 1, 2, 3, 4], // All maps
    blocksMovement: true,
    blocksProjectiles: false,
    size: { w: 40, h: 40 },
    color: "#8b4513",
    explosionDamage: 15,
    explosionRadius: 60,
    shadowColor: "rgba(0, 0, 0, 0.25)"
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
