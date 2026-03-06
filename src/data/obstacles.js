export const OBSTACLE_TYPES = {
  giantRock: {
    id: "giantRock",
    name: "Giant Rock",
    maps: [0, 1, 2, 3, 4], // All maps
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 64, h: 64 },
    color: "#4a5568",
    shadowColor: "rgba(0, 0, 0, 0.3)"
  },
  ancientTree: {
    id: "ancientTree",
    name: "Ancient Tree",
    maps: [0, 1], // Dungeon, Forest
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 48, h: 80 },
    color: "#2d5016",
    canopyColor: "#1a3d0a",
    shadowColor: "rgba(0, 0, 0, 0.4)"
  },
  ruinedPillar: {
    id: "ruinedPillar",
    name: "Ruined Pillar",
    maps: [0, 3], // Dungeon, Castle
    blocksMovement: true,
    blocksProjectiles: true,
    size: { w: 32, h: 96 },
    color: "#5a5a6a",
    shadowColor: "rgba(0, 0, 0, 0.3)"
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
  }
};
