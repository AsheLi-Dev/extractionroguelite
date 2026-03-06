// -------- Breakable props definitions --------
// Data-driven breakable objects: crates, urns, chests, etc.

export const BREAKABLE_DEFS = {
  crate_basic: {
    spriteKey: "breakable_crate_basic",
    maxHealth: 25,
    hitbox: { w: 32, h: 32 },
    lootTable: "crateBasic",
    tile: { row: 18, col: "c" }, // jar (1)
  },
  urn_magic: {
    spriteKey: "breakable_urn_magic",
    maxHealth: 40,
    hitbox: { w: 24, h: 28 },
    lootTable: "urnMagic",
    tile: { row: 18, col: "d" }, // jar (2)
  },
  chest_rare: {
    spriteKey: "breakable_chest_rare",
    maxHealth: 120,
    hitbox: { w: 40, h: 32 },
    lootTable: "chestRare",
    tile: { row: 18, col: "f" }, // ore sack
  },
  jar_1: {
    spriteKey: "breakable_jar_1",
    maxHealth: 30,
    hitbox: { w: 32, h: 32 },
    lootTable: "urnMagic",
    tile: { row: 18, col: "c" }, // 18.c jar (1)
  },
  jar_2: {
    spriteKey: "breakable_jar_2",
    maxHealth: 34,
    hitbox: { w: 32, h: 32 },
    lootTable: "urnMagic",
    tile: { row: 18, col: "d" }, // 18.d jar (2)
  },
  ore_sack: {
    spriteKey: "breakable_ore_sack",
    maxHealth: 28,
    hitbox: { w: 32, h: 32 },
    lootTable: "crateBasic",
    tile: { row: 18, col: "f" }, // 18.f ore sack
  },
};
