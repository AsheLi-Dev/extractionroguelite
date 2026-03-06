const NPC_WORLD_SIZE = Object.freeze({ w: 56, h: 56 });

export const NPC_DEFS = {
  mysteriousOldWoman: {
    id: "mysteriousOldWoman",
    type: "npcOldWoman",
    name: "Mysterious Old Woman",
    // rogues.png uses non-uniform sprite placement; use explicit source rects.
    sprite: { atlas: "rogues", x: 96, y: 192, w: 32, h: 32 }, // 8.d
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 2, max: 4 }
  },
  mysteriousOldMan: {
    id: "mysteriousOldMan",
    type: "npcOldMan",
    name: "Mysterious Old Man",
    sprite: { atlas: "rogues", x: 128, y: 192, w: 32, h: 32 }, // 8.e
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 2, max: 4 }
  },
  priest: {
    id: "priest",
    type: "npcPriest",
    name: "Priest",
    sprite: { atlas: "rogues", x: 32, y: 64, w: 32, h: 32 }, // 3.b
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 1, max: 3 }
  },
  schemaMonk: {
    id: "schemaMonk",
    type: "npcSchemaMonk",
    name: "Schema Monk",
    sprite: { atlas: "rogues", x: 160, y: 64, w: 32, h: 32 }, // 3.f
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 2, max: 4 }
  },
  elderSchemaMonk: {
    id: "elderSchemaMonk",
    type: "npcElderSchemaMonk",
    name: "Elder Schema Monk",
    sprite: { atlas: "rogues", x: 192, y: 64, w: 32, h: 32 }, // 3.g
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 2, max: 4 }
  },
  equipmentCollector: {
    id: "equipmentCollector",
    type: "npcEquipmentCollector",
    name: "Equipment Collector",
    sprite: { atlas: "rogues", x: 0, y: 32, w: 32, h: 32 }, // 2.a
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 3, max: 4 }
  },
  blacksmith: {
    id: "blacksmith",
    type: "npcBlacksmith",
    name: "Blacksmith",
    sprite: { atlas: "rogues", x: 128, y: 192, w: 32, h: 32 }, // 7.e
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 3, max: 4 }
  },
  rogue: {
    id: "rogue",
    type: "npcRogue",
    name: "Rogue",
    sprite: { atlas: "rogues", x: 96, y: 0, w: 32, h: 32 }, // 1.d
    worldSize: NPC_WORLD_SIZE,
    spawn: { min: 3, max: 4 }
  }
};

export const SCHEMA_SACRIFICE_PCTS = [0.3, 0.5, 0.7];
