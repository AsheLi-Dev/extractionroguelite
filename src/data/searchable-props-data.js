// -------- Searchable prop definitions --------
// Data-driven props the player can search (hold interact) for loot.

export const SEARCHABLE_PROP_DEFS = {
  locker: {
    id: "locker",
    sprite: "prop_locker",
    searchTime: 1.5,
    lootTable: "locker_basic",
    width: 48,
    height: 48,
    tileClosed: { row: 24, col: "d" }, // sarcophagus (closed)
    tileOpen: { row: 24, col: "e" }, // sarcophagus (ajar)
  },
  crate: {
    id: "crate",
    sprite: "prop_crate",
    searchTime: 1.0,
    lootTable: "crate_basic",
    width: 40,
    height: 40,
    tileClosed: { row: 18, col: "a" },
    tileOpen: { row: 18, col: "b" },
  },
  deadWarrior: {
    id: "deadWarrior",
    sprite: "prop_dead_warrior",
    searchTime: 1.2,
    lootTable: "dead_warrior",
    width: 32,
    height: 40,
    tileClosed: { row: 24, col: "d" }, // sarcophagus (closed)
    tileOpen: { row: 24, col: "e" }, // sarcophagus (ajar)
    keepVisibleWhenSearched: true,
  },
  chest: {
    id: "chest",
    sprite: "tile_chest",
    searchTime: 1.2,
    lootTable: "chest_basic",
    width: 32,
    height: 32,
    tileClosed: { row: 18, col: "a" },
    tileOpen: { row: 18, col: "b" },
  },
};
