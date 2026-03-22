import { Vec2 } from '../utils.js';
import { drawTile, drawTileByName, isTileAtlasLoaded } from '../entities/tile-system.js';
import { generateBlockerMap, WALL, PRESET_SMALL, PRESET_MEDIUM, PRESET_LARGE, PRESET_BIOME, generateCorridorCell, stampRect, mulberry32 } from '../map-gen-blockers.js';
import { drawOpenWorldGroundBase, drawOpenWorldGroundDetails } from './openworld-ground.js';
import {
  LOST_CAMP_TILE_DATA,
  LOST_CAMP_OBJECTS,
  LOST_CAMP_TILE_SIZE,
  LOST_CAMP_TILE_WIDTH,
  LOST_CAMP_TILE_HEIGHT,
  LOST_CAMP_TILESET,
} from './lost-camp-data.js';
import { pickHazardType } from './hazard-subarea-data.js';

/** chest_keys_treasure.png: 8×8 grid, 32px per cell; row index 5 = 6th row has 8 treasure sprites. */
const VAULT_TREASURE_SPRITE = 'assets/Environments/Forest Land/chest_keys_treasure.png';
const VAULT_TREASURE_ROW = 5;
const VAULT_TREASURE_SIZE = 32;

const MINIBOSS_FLOWER_SOURCES = [
  "assets/Environments/Desert Land/sprite (1).png",
  "assets/Environments/Desert Land/sprite (2).png",
  "assets/Environments/Desert Land/sprite (3).png",
  "assets/Environments/Desert Land/sprite (4).png",
  "assets/Environments/Desert Land/sprite (5).png",
  "assets/Environments/Desert Land/sprite (6).png",
  "assets/Environments/Desert Land/sprite (7).png",
  "assets/Environments/Desert Land/sprite (8).png",
  "assets/Environments/Desert Land/sprite (9).png",
  "assets/Environments/Desert Land/sprite (10).png",
  "assets/Environments/Desert Land/sprite.png",
];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { PRESET_SMALL, PRESET_MEDIUM, PRESET_LARGE, PRESET_BIOME };

export const MAP_WIDTH = 3600;
export const MAP_HEIGHT = 1350; // 900 * 1.5
export const WALL_THICKNESS = 32;
/** Collision margin for outer walls; can be smaller than WALL_THICKNESS so collision matches visible wall sprite. */
export const WALL_COLLISION_THICKNESS = 16;

/** Blocker chunk spritesheet: one horizontal row of 30×30-tile (960×960 px) chunks for 30×30 blocked spaces. */
const TILE_SIZE_BLOCKER = 32;
const CHUNK_TILES = 30;
const CHUNK_PX = TILE_SIZE_BLOCKER * CHUNK_TILES; // 960

export const BLOCKER_CHUNK_ATLAS_SRC = 'assets/Environments/blocks%20for%20empty%20grid.png';

/** Chunk frame definitions (atlas coordinates). Separate from placement logic. Nine chunks in one horizontal row. */
export const BLOCKER_CHUNKS = [
  { id: 'chunk_0', x: 0 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_1', x: 1 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_2', x: 2 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_3', x: 3 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_4', x: 4 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_5', x: 5 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_6', x: 6 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_7', x: 7 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
  { id: 'chunk_8', x: 8 * CHUNK_PX, y: 0, width: CHUNK_PX, height: CHUNK_PX },
];

/** Chunk groups: 0–3, 4–5, 6–8. Adjacent empty grids must use chunks from the same group. */
export const BLOCKER_CHUNK_GROUPS = [
  [0, 1, 2, 3],
  [4, 5],
  [6, 7, 8],
];

/** Deterministic index from cell coords and map seed for chunk selection. */
function seededHash(cellX, cellY, mapSeed) {
  const s = ((mapSeed || 0) ^ 0x9e37) + cellX * 31 + cellY;
  const rng = mulberry32(s >>> 0);
  return (rng() * 0x100000000) >>> 0;
}

/** Choose one chunk from a given group for a 30×30 blocked cell. Deterministic from mapSeed + cell. */
function chooseBlockerChunkInGroup(groupChunkIndices, cellX, cellY, mapSeed) {
  const r = seededHash(cellX, cellY, mapSeed);
  const idx = groupChunkIndices[r % groupChunkIndices.length];
  return BLOCKER_CHUNKS[idx];
}

/** Find connected components of blocker cells (4-adjacent: same row or col, distance 1). Returns array of arrays of { col, row }. */
function findBlockerCellComponents(cells) {
  const set = new Set(cells.map((c) => `${c.col},${c.row}`));
  const visited = new Set();
  const components = [];
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (const cell of cells) {
    const key = `${cell.col},${cell.row}`;
    if (visited.has(key)) continue;
    const stack = [cell];
    const component = [];
    visited.add(key);
    while (stack.length) {
      const { col, row } = stack.pop();
      component.push({ col, row });
      for (const [dc, dr] of dirs) {
        const ncol = col + dc;
        const nrow = row + dr;
        const nkey = `${ncol},${nrow}`;
        if (set.has(nkey) && !visited.has(nkey)) {
          visited.add(nkey);
          stack.push({ col: ncol, row: nrow });
        }
      }
    }
    components.push(component);
  }
  return components;
}

export const MAP_DEFS = [
  {
    id: 0,
    name: "Dungeon",
    number: 1,
    floorColor: "#1e1b2e",
    floorPattern: "bricks",
    wallColor: "#3d3a4a",
    wallAccent: "#5a5668",
    exits: [
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 1, spawnSide: "left" }
    ],
    enemyCount: 1.0,
    enemyScale: { hp: 1, attack: 1, speed: 1 },
    lootQuality: 0,
  },
  {
    id: 1,
    name: "Forest",
    number: 2,
    floorColor: "#0d2818",
    floorPattern: "grass",
    wallColor: "#2d4a2e",
    wallAccent: "#3d6b3e",
    exits: [
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 2, spawnSide: "left" }
    ],
    enemyCount: 1.2,
    enemyScale: { hp: 1.2, attack: 1.15, speed: 1.1 },
    lootQuality: 0.2,
  },
  {
    id: 2,
    name: "Cave",
    number: 3,
    floorColor: "#1a1a2e",
    floorPattern: "stone",
    wallColor: "#2a2a3e",
    wallAccent: "#3a3a4e",
    exits: [
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 3, spawnSide: "left" }
    ],
    enemyCount: 1.5,
    enemyScale: { hp: 1.5, attack: 1.3, speed: 1.2 },
    lootQuality: 0.4,
  },
  {
    id: 3,
    name: "Castle",
    number: 4,
    floorColor: "#2c2c3c",
    floorPattern: "tiles",
    wallColor: "#4a4a5a",
    wallAccent: "#6a6a7a",
    exits: [
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 4, spawnSide: "left" }
    ],
    enemyCount: 1.8,
    enemyScale: { hp: 2, attack: 1.5, speed: 1.3 },
    lootQuality: 0.6,
  },
  {
    id: 4,
    name: "Wasteland",
    number: 5,
    floorColor: "#2a2520",
    floorPattern: "cracked",
    wallColor: "#4a4035",
    wallAccent: "#6a5a45",
    exits: [],
    enemyCount: 16,
    enemyScale: { hp: 2.5, attack: 1.8, speed: 1.5 },
    lootQuality: 0.85,
  },
];

/** Biome map def for dev-mode 60x120 archetype grid (8 grids). */
export const BIOME_MAP_DEF = {
  id: 'biome',
  name: 'Forest Biome',
  number: 0,
  floorColor: '#0d2818',
  floorPattern: 'grass',
  wallColor: '#2d4a2e',
  wallAccent: '#3d6b3e',
  exits: [],
  enemyCount: 0,
  enemyScale: { hp: 1.2, attack: 1.15, speed: 1.1 },
  lootQuality: 0.3,
};

/** Deterministic forest-biome fixture used by browser bots and dev validation runs. */
export const FOREST_BIOME_TEST_MAP_DEF = {
  id: 'forest_biome_test',
  name: 'Forest Biome Test Map',
  number: 0,
  floorColor: '#0d2818',
  floorPattern: 'grass',
  wallColor: '#2d4a2e',
  wallAccent: '#3d6b3e',
  exits: [],
  enemyCount: 0,
  enemyScale: { hp: 1, attack: 1, speed: 1 },
  lootQuality: 0.3,
};

/** Test-map biome preset: 8x4 biome cells, each cell 30x30 tiles. */
export const PRESET_FOREST_BIOME_TEST = {
  W: 240,
  H: 120,
  config: {
    borderThickness: 1,
    corridorWidth: 10,
    waypointCount: 6,
    blockerCount: 0,
    roomStampCount: 0,
    roomMinSize: 2,
    roomMaxSize: 5,
    waypointYMin: 30,
    waypointYMax: 89,
  },
};

/** 4x4 biome grid: 4 columns, 4 rows. Middle two rows = 8 cells (start/exit/etc.); top/bottom rows = 1–2 random cells each, rest empty (walled). */
export const BIOME_GRID_COLS = 4;
export const BIOME_GRID_ROWS = 4;

export function getBiomeGridDimensions(world = null) {
  const grid = world?.archetypeGrid?.grid;
  if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0]) && grid[0].length > 0) {
    return {
      cols: grid[0].length,
      rows: grid.length,
    };
  }
  return {
    cols: BIOME_GRID_COLS,
    rows: BIOME_GRID_ROWS,
  };
}

/** Subarea system: 20×20 grid of sub-archetypes within a single 30×30 (tile) biome cell. Only one subarea per cell; some archetypes have none. */
export const SUBAREA_GRID_SIZE = 20;

/** Sub-archetype ids for the 20×20 subarea grid (used for diversified content within a cell). */
export const SUBAREA_ARCHETYPE = {
  DEFAULT: 0,
  DENSE: 1,
  OPEN: 2,
  FEATURE: 3,
  /** Totem encounter: one totem spawns in this sub-area (zones built via buildTotemZonesForWorld). */
  TOTEM: 4,
  /** Ambush encounter: swarm spawns when player enters (zones built via buildAmbushZonesForWorld). */
  AMBUSH: 5,
  /** Hazard encounter: environmental hazards (avalanche, earthquake, swamp, volcano, hurricane). */
  HAZARD: 6,
};

/** Archetype ids for biome cells. */
export const BIOME_ARCHETYPE = {
  START: 'start',
  EXIT: 'exit',
  MINIBOSS: 'miniboss',
  OPEN_SPACE: 'openSpace',
  CORRIDORS: 'corridors',
  LOST_CAMPS: 'lostCamps',
  RUINS: 'ruins',
  VAULT: 'vault',
  /** Woods: 30×30 cell with 15–20 trees and 4–6 chests. */
  WOODS: 'woods',
  /** Top/bottom row cells that are not chosen as additional; get walled off. */
  EMPTY: 'empty',
};

/** Biome archetypes that never have a subarea (start room, corridor, exit, empty). */
export const ARCHETYPES_WITHOUT_SUBAREA = [
  BIOME_ARCHETYPE.START,
  BIOME_ARCHETYPE.EXIT,
  BIOME_ARCHETYPE.CORRIDORS,
  BIOME_ARCHETYPE.EMPTY,
];

const BIOME_ARCHETYPE_POOL = [
  BIOME_ARCHETYPE.MINIBOSS,
  BIOME_ARCHETYPE.OPEN_SPACE,
  BIOME_ARCHETYPE.CORRIDORS,
  BIOME_ARCHETYPE.LOST_CAMPS,
  BIOME_ARCHETYPE.RUINS,
  BIOME_ARCHETYPE.VAULT,
  BIOME_ARCHETYPE.WOODS,
];

/**
 * Build 4x4 archetype grid. Middle two rows (1–2): start/exit/miniboss/corridors/vault/pool as before.
 * Top row (0) and bottom row (3): 1 or 2 cells randomly get OPEN_SPACE, rest EMPTY (walled later).
 * Start/exit are derived from world.startPixel/exitPixel (expected in middle rows).
 * Miniboss is always column 3 (fourth column), row 1 preferred else row 2 if that cell is start/exit.
 * Returns { grid, startCell, exitCell }. grid[row][col] = archetype id.
 */
export function buildArchetypeGrid(world) {
  const cols = BIOME_GRID_COLS;
  const rows = BIOME_GRID_ROWS;
  const cellPixelsX = world.width / cols;
  const cellPixelsY = world.height / rows;

  const startPixel = world.startPixel || { x: 0, y: 0 };
  const exitPixel = world.exitPixel || { x: world.width - cellPixelsX, y: 0 };

  let startCol = Math.floor(startPixel.x / cellPixelsX);
  let startRow = Math.floor(startPixel.y / cellPixelsY);
  startCol = Math.max(0, Math.min(cols - 1, startCol));
  startRow = Math.max(0, Math.min(rows - 1, startRow));

  let exitCol = Math.floor(exitPixel.x / cellPixelsX);
  let exitRow = Math.floor(exitPixel.y / cellPixelsY);
  exitCol = Math.max(0, Math.min(cols - 1, exitCol));
  exitRow = Math.max(0, Math.min(rows - 1, exitRow));

  // With 4 rows, force start/exit into middle two rows (1 and 2)
  if (rows === 4) {
    startRow = Math.max(1, Math.min(2, startRow));
    exitRow = Math.max(1, Math.min(2, exitRow));
  }

  const startCell = { col: startCol, row: startRow };
  const exitCell = { col: exitCol, row: exitRow };

  const rng = () => Math.random();

  // Top row (0) and bottom row (3): 1 or 2 random columns become active (OPEN_SPACE), rest EMPTY
  const pickActiveCols = () => {
    const count = Math.random() < 0.5 ? 1 : 2;
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, count);
  };
  const topActiveCols = pickActiveCols();
  const bottomActiveCols = pickActiveCols();

  // Miniboss: always column 3 (fourth column), row 1 or 2 — prefer row 1 unless start/exit occupies it.
  const MINIBOSS_COL = 3;
  let minibossPick = null;
  for (const row of [1, 2]) {
    if (startCol === MINIBOSS_COL && startRow === row) continue;
    if (exitCol === MINIBOSS_COL && exitRow === row) continue;
    minibossPick = { col: MINIBOSS_COL, row };
    break;
  }

  // Candidates for corridor/vault only in middle two rows (1, 2).
  const candidates = [];
  for (let row = 1; row <= 2; row++) {
    for (let col = 0; col < cols; col++) {
      if (col === startCol && row === startRow) continue;
      if (col === exitCol && row === exitRow) continue;
      if (minibossPick && minibossPick.col === col && minibossPick.row === row) continue;
      candidates.push({ row, col });
    }
  }
  const corridorPick = candidates.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : null;

  const vaultCandidates = candidates.filter(
    (c) => !corridorPick || c.row !== corridorPick.row || c.col !== corridorPick.col
  );
  const vaultPick = vaultCandidates.length
    ? vaultCandidates[Math.floor(rng() * vaultCandidates.length)]
    : null;

  const grid = [];
  const poolNoCorridorsMinibossVault = BIOME_ARCHETYPE_POOL.filter(
    (a) => a !== BIOME_ARCHETYPE.CORRIDORS && a !== BIOME_ARCHETYPE.MINIBOSS && a !== BIOME_ARCHETYPE.VAULT
  );
  const poolNoLostCamps = poolNoCorridorsMinibossVault.filter((a) => a !== BIOME_ARCHETYPE.LOST_CAMPS);
  const maxLostCamps = 2;
  let lostCampsCount = 0;
  for (let row = 0; row < rows; row++) {
    const r = [];
    for (let col = 0; col < cols; col++) {
      if (row === 0) {
        r.push(topActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      } else if (row === 3) {
        r.push(bottomActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      } else if (col === startCol && row === startRow) {
        r.push(BIOME_ARCHETYPE.START);
      } else if (col === exitCol && row === exitRow) {
        // Route mode no longer uses a dedicated exit-room archetype.
        // Keep this cell as a normal combat cell.
        r.push(BIOME_ARCHETYPE.OPEN_SPACE);
      } else if (minibossPick && minibossPick.row === row && minibossPick.col === col) {
        r.push(BIOME_ARCHETYPE.MINIBOSS);
      } else if (corridorPick && corridorPick.row === row && corridorPick.col === col) {
        r.push(BIOME_ARCHETYPE.CORRIDORS);
      } else if (vaultPick && vaultPick.row === row && vaultPick.col === col) {
        r.push(BIOME_ARCHETYPE.VAULT);
      } else {
        const pool = lostCampsCount >= maxLostCamps ? poolNoLostCamps : poolNoCorridorsMinibossVault;
        const choice = pool[Math.floor(rng() * pool.length)];
        if (choice === BIOME_ARCHETYPE.LOST_CAMPS) lostCampsCount++;
        r.push(choice);
      }
    }
    grid.push(r);
  }

  return { grid, startCell, exitCell };
}

export function buildForestBiomeTestArchetypeGrid(world) {
  void world;
  const cols = 8;
  const pickActiveCols = () => {
    const count = Math.random() < 0.5 ? 1 : 2;
    const indices = Array.from({ length: cols }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, count);
  };
  const topActiveCols = new Set(pickActiveCols());
  const bottomActiveCols = new Set(pickActiveCols());
  return {
    grid: [
      Array.from({ length: cols }, (_, col) => topActiveCols.has(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY),
      [BIOME_ARCHETYPE.START, BIOME_ARCHETYPE.OPEN_SPACE, BIOME_ARCHETYPE.WOODS, BIOME_ARCHETYPE.RUINS, BIOME_ARCHETYPE.OPEN_SPACE, BIOME_ARCHETYPE.WOODS, BIOME_ARCHETYPE.CORRIDORS, BIOME_ARCHETYPE.OPEN_SPACE],
      [BIOME_ARCHETYPE.EMPTY, BIOME_ARCHETYPE.RUINS, BIOME_ARCHETYPE.VAULT, BIOME_ARCHETYPE.WOODS, BIOME_ARCHETYPE.OPEN_SPACE, BIOME_ARCHETYPE.RUINS, BIOME_ARCHETYPE.MINIBOSS, BIOME_ARCHETYPE.EMPTY],
      Array.from({ length: cols }, (_, col) => bottomActiveCols.has(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY)
    ],
    startCell: { col: 0, row: 1 },
    exitCell: { col: 7, row: 1 }
  };
}

/**
 * Get cell (col, row) for a pixel position. col in [0, COLS-1], row in [0, ROWS-1].
 */
export function getBiomeCellAtPixel(world, x, y) {
  if (!world.archetypeGrid) return null;
  const { cols, rows } = getBiomeGridDimensions(world);
  const cellPixelsX = world.width / cols;
  const cellPixelsY = world.height / rows;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(x / cellPixelsX)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(y / cellPixelsY)));
  return { col, row };
}

/**
 * Get archetype id at pixel, or null if no biome grid.
 */
export function getArchetypeAtPixel(world, x, y) {
  const data = world.archetypeGrid;
  if (!data || !data.grid) return null;
  const cell = getBiomeCellAtPixel(world, x, y);
  if (!cell) return null;
  return data.grid[cell.row][cell.col];
}

/**
 * Get pixel bounds for a cell { col, row }: { x, y, w, h }.
 */
export function getBiomeCellBounds(world, col, row) {
  const { cols, rows } = getBiomeGridDimensions(world);
  const cellPixelsX = world.width / cols;
  const cellPixelsY = world.height / rows;
  return {
    x: col * cellPixelsX,
    y: row * cellPixelsY,
    w: cellPixelsX,
    h: cellPixelsY,
  };
}

const SUBAREA_ARCHETYPE_IDS = Object.values(SUBAREA_ARCHETYPE);

/**
 * Build a single 20×20 subarea grid for one biome cell, or null if this archetype has no subarea.
 * @param {string} archetype - Biome archetype id for the cell
 * @param {number} col - Cell column (for RNG seeding)
 * @param {number} row - Cell row (for RNG seeding)
 * @param {function(): number} rng - [0, 1)
 * @returns {{ grid: number[][] } | null}
 */
export function buildSubareaGridForCell(archetype, col, row, rng) {
  if (ARCHETYPES_WITHOUT_SUBAREA.includes(archetype)) return null;
  const size = SUBAREA_GRID_SIZE;
  const grid = [];
  for (let sy = 0; sy < size; sy++) {
    const r = [];
    for (let sx = 0; sx < size; sx++) {
      const idx = Math.floor(rng() * SUBAREA_ARCHETYPE_IDS.length);
      r.push(SUBAREA_ARCHETYPE_IDS[idx]);
    }
    grid.push(r);
  }
  return { grid };
}

/**
 * Build subarea grids for all biome cells that support them. Sets world.subareaGrids[key] = { grid }
 * where key is `${row}_${col}`. Cells with START, EXIT, CORRIDORS, EMPTY get no subarea.
 * @param {import('./maps.js').World} world
 * @param {{ grid: string[][] }} archetypeGrid
 * @param {function(): number} rng
 */
export function buildAllSubareaGrids(world, archetypeGrid, rng) {
  if (!archetypeGrid?.grid) return;
  world.subareaGrids = world.subareaGrids || {};
  for (let row = 0; row < archetypeGrid.grid.length; row++) {
    for (let col = 0; col < archetypeGrid.grid[row].length; col++) {
      const archetype = archetypeGrid.grid[row][col];
      const sub = buildSubareaGridForCell(archetype, col, row, rng);
      if (sub) world.subareaGrids[`${row}_${col}`] = sub;
    }
  }
}

/**
 * Get subarea info at a pixel: cell coords, sub-cell coords, and sub-archetype id.
 * @param {import('./maps.js').World} world
 * @param {number} x - Pixel x
 * @param {number} y - Pixel y
 * @returns {{ cellCol: number, cellRow: number, subCol: number, subRow: number, subArchetypeId: number } | null}
 */
export function getSubareaAtPixel(world, x, y) {
  const cell = getBiomeCellAtPixel(world, x, y);
  if (!cell) return null;
  const key = `${cell.row}_${cell.col}`;
  const sub = world.subareaGrids?.[key];
  if (!sub?.grid) return null;
  const bounds = getBiomeCellBounds(world, cell.col, cell.row);
  const relX = x - bounds.x;
  const relY = y - bounds.y;
  const size = SUBAREA_GRID_SIZE;
  const subCol = Math.max(0, Math.min(size - 1, Math.floor((relX / bounds.w) * size)));
  const subRow = Math.max(0, Math.min(size - 1, Math.floor((relY / bounds.h) * size)));
  return {
    cellCol: cell.col,
    cellRow: cell.row,
    subCol,
    subRow,
    subArchetypeId: sub.grid[subRow][subCol],
  };
}

/** Ambush zone size in tiles (zone is a square of this many tiles per side). */
export const AMBUSH_ZONE_TILES = 20;

/** Blood altar zone size in tiles (15×15). */
export const BLOOD_ALTAR_ZONE_TILES = 15;

/** Blood altar outcome types: heal (70%), elites (20%), miniboss (10%). */
export const BLOOD_ALTAR_TYPES = Object.freeze({ HEAL: 'heal', ELITES: 'elites', MINIBOSS: 'miniboss' });

export function pickBloodAltarType(rng) {
  const roll = rng();
  if (roll < 0.70) return BLOOD_ALTAR_TYPES.HEAL;
  if (roll < 0.90) return BLOOD_ALTAR_TYPES.ELITES;
  return BLOOD_ALTAR_TYPES.MINIBOSS;
}

/**
 * Build subarea zones for the biome in a single pass so each cell has at most one subarea.
 * Populates world.totemZones, world.ambushZones, world.hazardZones, world.bloodAltarZones. Call after buildAllSubareaGrids.
 * @param {Object} world
 * @param {{ grid: string[][] }} archetypeGrid
 * @param {function(): number} rng
 * @param {Object} [options]
 * @param {number} [options.chancePerCell=0.5] - Probability (0–1) that a cell gets any subarea
 * @param {number} [options.totemWeight=0.4] - Given a subarea is placed, probability it is totem
 * @param {number} [options.ambushWeight=0.4] - Given a subarea is placed, probability it is ambush
 * @param {number} [options.hazardWeight=0.1] - Probability it is hazard (else blood altar)
 * @param {number} [options.bloodAltarWeight=0.1] - Probability it is blood altar
 */
export function buildSubareaZonesForWorld(world, archetypeGrid, rng, options = {}) {
  const chancePerCell = options.chancePerCell ?? 0.5;
  const totemWeight = options.totemWeight ?? 0.4;
  const ambushWeight = options.ambushWeight ?? 0.4;
  const hazardWeight = options.hazardWeight ?? 0.1;
  const bloodAltarWeight = options.bloodAltarWeight ?? 0.1;
  if (!archetypeGrid?.grid || !world.subareaGrids) return;
  world.totemZones = world.totemZones || [];
  world.ambushZones = world.ambushZones || [];
  world.hazardZones = world.hazardZones || [];
  world.bloodAltarZones = world.bloodAltarZones || [];
  let totemId = 1;
  let ambushId = 1;
  let hazardId = 1;
  let bloodAltarId = 1;
  const size = SUBAREA_GRID_SIZE;
  const tileSize = world.tileSize || 32;
  const zoneW = AMBUSH_ZONE_TILES * tileSize;
  const zoneH = AMBUSH_ZONE_TILES * tileSize;
  const bloodAltarZoneSize = BLOOD_ALTAR_ZONE_TILES * tileSize;
  for (let row = 0; row < archetypeGrid.grid.length; row++) {
    for (let col = 0; col < archetypeGrid.grid[row].length; col++) {
      const archetype = archetypeGrid.grid[row][col];
      if (ARCHETYPES_WITHOUT_SUBAREA.includes(archetype)) continue;
      const key = `${row}_${col}`;
      if (!world.subareaGrids[key]) continue;
      if (rng() >= chancePerCell) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const roll = rng();
      if (roll < totemWeight) {
        const zoneW = bounds.w / size;
        const zoneH = bounds.h / size;
        const subCol = Math.floor(rng() * size);
        const subRow = Math.floor(rng() * size);
        world.totemZones.push({
          id: totemId++,
          cellCol: col,
          cellRow: row,
          bounds: {
            x: bounds.x + subCol * zoneW,
            y: bounds.y + subRow * zoneH,
            w: zoneW,
            h: zoneH,
          },
        });
      } else if (roll < totemWeight + ambushWeight) {
        const x = bounds.x + (bounds.w - zoneW) / 2;
        const y = bounds.y + (bounds.h - zoneH) / 2;
        world.ambushZones.push({
          id: ambushId++,
          cellCol: col,
          cellRow: row,
          bounds: { x, y, w: zoneW, h: zoneH },
        });
      } else if (roll < totemWeight + ambushWeight + hazardWeight) {
        const x = bounds.x + (bounds.w - zoneW) / 2;
        const y = bounds.y + (bounds.h - zoneH) / 2;
        world.hazardZones.push({
          id: hazardId++,
          cellCol: col,
          cellRow: row,
          bounds: { x, y, w: zoneW, h: zoneH },
          hazardType: pickHazardType(rng),
        });
      } else {
        const x = bounds.x + (bounds.w - bloodAltarZoneSize) / 2;
        const y = bounds.y + (bounds.h - bloodAltarZoneSize) / 2;
        world.bloodAltarZones.push({
          id: bloodAltarId++,
          cellCol: col,
          cellRow: row,
          bounds: { x, y, w: bloodAltarZoneSize, h: bloodAltarZoneSize },
          altarType: pickBloodAltarType(rng),
        });
      }
    }
  }
}

/**
 * Build totem encounter zones for the biome. One zone per cell at most.
 * Prefer buildSubareaZonesForWorld so each cell has at most one subarea (totem or ambush).
 */
export function buildTotemZonesForWorld(world, archetypeGrid, rng, chancePerCell = 0.4) {
  if (!archetypeGrid?.grid || !world.subareaGrids) return;
  world.totemZones = world.totemZones || [];
  let id = 1;
  const size = SUBAREA_GRID_SIZE;
  for (let row = 0; row < archetypeGrid.grid.length; row++) {
    for (let col = 0; col < archetypeGrid.grid[row].length; col++) {
      const archetype = archetypeGrid.grid[row][col];
      if (ARCHETYPES_WITHOUT_SUBAREA.includes(archetype)) continue;
      const key = `${row}_${col}`;
      if (!world.subareaGrids[key]) continue;
      if (rng() >= chancePerCell) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const subCol = Math.floor(rng() * size);
      const subRow = Math.floor(rng() * size);
      const zoneW = bounds.w / size;
      const zoneH = bounds.h / size;
      world.totemZones.push({
        id: id++,
        cellCol: col,
        cellRow: row,
        bounds: {
          x: bounds.x + subCol * zoneW,
          y: bounds.y + subRow * zoneH,
          w: zoneW,
          h: zoneH,
        },
      });
    }
  }
}

/**
 * Build ambush encounter zones for the biome. One zone per cell at most.
 * Prefer buildSubareaZonesForWorld so each cell has at most one subarea (totem or ambush).
 */
export function buildAmbushZonesForWorld(world, archetypeGrid, rng, chancePerCell = 0.35) {
  if (!archetypeGrid?.grid || !world.subareaGrids) return;
  world.ambushZones = world.ambushZones || [];
  let id = 1;
  const tileSize = world.tileSize || 32;
  const zoneW = AMBUSH_ZONE_TILES * tileSize;
  const zoneH = AMBUSH_ZONE_TILES * tileSize;
  for (let row = 0; row < archetypeGrid.grid.length; row++) {
    for (let col = 0; col < archetypeGrid.grid[row].length; col++) {
      const archetype = archetypeGrid.grid[row][col];
      if (ARCHETYPES_WITHOUT_SUBAREA.includes(archetype)) continue;
      const key = `${row}_${col}`;
      if (!world.subareaGrids[key]) continue;
      if (rng() >= chancePerCell) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const x = bounds.x + (bounds.w - zoneW) / 2;
      const y = bounds.y + (bounds.h - zoneH) / 2;
      world.ambushZones.push({
        id: id++,
        cellCol: col,
        cellRow: row,
        bounds: { x, y, w: zoneW, h: zoneH },
      });
    }
  }
}

/** Create a World from procedural blocker map. Returns { world, startPixel, exitPixel } */
export function createProceduralWorld(preset = PRESET_MEDIUM, seed = Date.now(), mapDef = null) {
  const { W, H, config } = typeof preset === 'object' ? preset : PRESET_MEDIUM;
  const tileSize = 32;
  const { grid, start, exit } = generateBlockerMap({ W, H, seed, config });

  const width = W * tileSize;
  const height = H * tileSize;

  const tileWallRects = [];
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      if (grid[gy][gx] === WALL) {
        tileWallRects.push({
          x: gx * tileSize,
          y: gy * tileSize,
          w: tileSize,
          h: tileSize,
        });
      }
    }
  }

  const world = new World(width, height);
  world.tileGrid = grid;
  world.tileSize = tileSize;
  world.tileWallRects = tileWallRects;
  world.startPixel = { x: start.x * tileSize, y: start.y * tileSize };
  world.exitPixel = { x: exit.x * tileSize, y: exit.y * tileSize };
  if (mapDef) {
    world.setTheme(mapDef);
    world.proceduralExitZones = (mapDef.exits || []).map((e) => {
      const isRight = e.x > (width / 2);
      const base = isRight ? world.exitPixel : world.startPixel;
      return {
        x: base.x - 32,
        y: base.y - 60,
        w: 96,
        h: 120,
        targetMapId: e.targetMapId,
        spawnSide: e.spawnSide,
      };
    });
  }
  return { world, startPixel: world.startPixel, exitPixel: world.exitPixel };
}

/**
 * For 4x4 biome: stamp WALL on tile grid for each EMPTY cell in top row (0) and bottom row (3).
 * Each such 30×30 space gets one large blocker chunk from the spritesheet (drawn instead of brick tiles).
 * Collision is unchanged (tileWallRects). Call after applyCorridorCellLayouts.
 * @param {number} [mapSeed] - Seed for deterministic chunk choice per cell.
 */
export function applyBiomeTopBottomWalls(world, archetypeGrid, mapSeed = 0) {
  const data = archetypeGrid;
  if (!data?.grid) return;
  const grid = world.tileGrid;
  if (!grid?.length) return;
  const W = grid[0].length;
  const H = grid.length;
  const { cols, rows } = getBiomeGridDimensions(world);
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rows);
  const tileSize = world.tileSize || 32;

  const blockerCells = [];
  for (const row of [0, 3]) {
    if (row >= data.grid.length) continue;
    for (let col = 0; col < cols; col++) {
      if (data.grid[row][col] !== BIOME_ARCHETYPE.EMPTY) continue;
      blockerCells.push({ col, row });
    }
  }

  const components = findBlockerCellComponents(blockerCells);
  const rngGroup = mulberry32((mapSeed || 0) ^ 0xb3a7);
  const cellToGroup = new Map();
  for (let i = 0; i < components.length; i++) {
    const groupIndex = Math.floor(rngGroup() * BLOCKER_CHUNK_GROUPS.length);
    const groupChunkIndices = BLOCKER_CHUNK_GROUPS[groupIndex];
    for (const cell of components[i]) {
      cellToGroup.set(`${cell.col},${cell.row}`, groupChunkIndices);
    }
  }

  world.blockerChunkSpaces = [];
  const blockerTileSet = new Set();
  for (const { col, row } of blockerCells) {
    const originGx = col * cellW;
    const originGy = row * cellH;
    stampRect(grid, originGx, originGy, cellW, cellH, WALL);
    const groupChunkIndices = cellToGroup.get(`${col},${row}`) || BLOCKER_CHUNK_GROUPS[0];
    const chunk = chooseBlockerChunkInGroup(groupChunkIndices, col, row, mapSeed);
    world.blockerChunkSpaces.push({
      col,
      row,
      originGx,
      originGy,
      worldX: originGx * tileSize,
      worldY: originGy * tileSize,
      chunk,
    });
    for (let dy = 0; dy < cellH; dy++) {
      for (let dx = 0; dx < cellW; dx++) {
        blockerTileSet.add(`${originGx + dx},${originGy + dy}`);
      }
    }
  }
  world.blockerChunkTileSet = blockerTileSet;
  if (!world.blockerChunkAtlas) {
    world.blockerChunkAtlas = new Image();
    world.blockerChunkAtlas.src = BLOCKER_CHUNK_ATLAS_SRC;
  }
  rebuildTileWallRectsFromGrid(world);
}

/** Cobblestone path: Forest Land decorative_props.png, 32×32 tiles. 15 variants. */
const COBBLE_ATLAS_SRC = 'assets/Environments/Forest Land/decorative_props.png';
const COBBLE_VARIANTS = [
  { sx: 256, sy: 0 }, { sx: 288, sy: 0 }, { sx: 320, sy: 0 }, { sx: 352, sy: 0 }, { sx: 384, sy: 0 }, { sx: 416, sy: 0 },
  { sx: 256, sy: 32 }, { sx: 288, sy: 32 }, { sx: 320, sy: 32 }, { sx: 352, sy: 32 }, { sx: 384, sy: 32 }, { sx: 416, sy: 32 },
  { sx: 352, sy: 64 }, { sx: 384, sy: 64 }, { sx: 416, sy: 64 },
];

/**
 * Build a 2-tile-wide cobblestone path from start room to exit room. Uses corridor middle points if present.
 * Sets world.cobblestonePathTiles (Map "gx,gy" -> variant 0..14), world.cobblestonePathAtlas, world.cobblestonePathVariants.
 */
export function buildCobblestonePath(world, archetypeGrid, rng = Math.random) {
  const grid = world?.tileGrid;
  const data = archetypeGrid?.grid;
  if (!grid?.length || !data?.length || !archetypeGrid.startCell || !archetypeGrid.exitCell) return;
  const W = grid[0].length;
  const H = grid.length;
  const tileSize = world.tileSize || 32;
  const { cols, rows } = getBiomeGridDimensions(world);
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rows);
  const startCell = archetypeGrid.startCell;
  const exitCell = archetypeGrid.exitCell;
  void rows;

  function cellCenterTile(col, row) {
    const gx = Math.floor(col * cellW + cellW / 2);
    const gy = Math.floor(row * cellH + cellH / 2);
    return { gx: Math.max(0, Math.min(W - 1, gx)), gy: Math.max(0, Math.min(H - 1, gy)) };
  }

  const waypoints = [];
  waypoints.push(cellCenterTile(startCell.col, startCell.row));
  const corridorPoints = world.corridorMiddlePoints || {};
  let corridorKey = null;
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      if (data[row][col] === BIOME_ARCHETYPE.CORRIDORS) {
        corridorKey = `${row}_${col}`;
        break;
      }
    }
    if (corridorKey) break;
  }
  if (corridorKey && corridorPoints[corridorKey]) {
    const [p1, p2] = corridorPoints[corridorKey];
    const start = waypoints[0];
    const d1 = (p1.gx - start.gx) ** 2 + (p1.gy - start.gy) ** 2;
    const d2 = (p2.gx - start.gx) ** 2 + (p2.gy - start.gy) ** 2;
    if (d1 <= d2) {
      waypoints.push(p1, p2);
    } else {
      waypoints.push(p2, p1);
    }
  }
  waypoints.push(cellCenterTile(exitCell.col, exitCell.row));

  const pathSet = new Set();
  const WALL = 1;

  function addTile(gx, gy) {
    if (gx >= 0 && gx < W && gy >= 0 && gy < H && grid[gy][gx] !== WALL) pathSet.add(`${gx},${gy}`);
  }

  for (let w = 0; w < waypoints.length - 1; w++) {
    const A = waypoints[w];
    const B = waypoints[w + 1];
    const steps = Math.max(1, Math.ceil(Math.sqrt((B.gx - A.gx) ** 2 + (B.gy - A.gy) ** 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gx = Math.round(A.gx + t * (B.gx - A.gx));
      const gy = Math.round(A.gy + t * (B.gy - A.gy));
      addTile(gx, gy);
    }
  }

  // Fill inside of corners: at each internal waypoint, add the diagonal tile that fills the turn.
  for (let w = 1; w < waypoints.length - 1; w++) {
    const C = waypoints[w];
    const prev = waypoints[w - 1];
    const next = waypoints[w + 1];
    const dx1 = Math.sign(C.gx - prev.gx);
    const dy1 = Math.sign(C.gy - prev.gy);
    const dx2 = Math.sign(next.gx - C.gx);
    const dy2 = Math.sign(next.gy - C.gy);
    if (dx1 === 0 && dy1 === 0) continue;
    if (dx2 === 0 && dy2 === 0) continue;
    addTile(C.gx - dx1, C.gy - dy2);
    addTile(C.gx - dx2, C.gy + dy1);
  }

  world.cobblestonePathTiles = new Map();
  for (const key of pathSet) {
    const variant = Math.floor(rng() * COBBLE_VARIANTS.length);
    world.cobblestonePathTiles.set(key, variant);
  }
  world.cobblestonePathVariants = COBBLE_VARIANTS;
  if (!world.cobblestonePathAtlas) {
    world.cobblestonePathAtlas = new Image();
    world.cobblestonePathAtlas.src = COBBLE_ATLAS_SRC;
  }
}

/** Rebuild world.tileWallRects from world.tileGrid (e.g. after editing grid for corridor cells). */
export function rebuildTileWallRectsFromGrid(world) {
  const grid = world.tileGrid;
  if (!grid || !grid.length) return;
  const tileSize = world.tileSize || 32;
  world.tileWallRects = [];
  const H = grid.length;
  const W = grid[0].length;
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      if (grid[gy][gx] === WALL) {
        world.tileWallRects.push({
          x: gx * tileSize,
          y: gy * tileSize,
          w: tileSize,
          h: tileSize,
        });
      }
    }
  }
}

/**
 * For each cell with archetype CORRIDORS, overwrite that cell's region with corridor layout,
 * then rebuild tileWallRects. rng() should return [0, 1) (e.g. mulberry32(seed)).
 */
export function applyCorridorCellLayouts(world, archetypeGrid, rng) {
  const data = archetypeGrid;
  if (!data?.grid) return;
  const grid = world.tileGrid;
  if (!grid?.length) return;
  world.corridorMiddlePoints = world.corridorMiddlePoints || {};
  const W = grid[0].length;
  const H = grid.length;
  const { cols, rows } = getBiomeGridDimensions(world);
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data.grid[row][col] !== BIOME_ARCHETYPE.CORRIDORS) continue;
      const originGx = col * cellW;
      const originGy = row * cellH;
      const points = generateCorridorCell(grid, originGx, originGy, cellW, cellH, rng);
      if (points) world.corridorMiddlePoints[`${row}_${col}`] = [points.p1, points.p2];
    }
  }
  rebuildTileWallRectsFromGrid(world);
}

/**
 * For each cell with archetype LOST_CAMPS, add collision rects from TMJ objects (ifCollision/isCollision),
 * chest spawn positions (template lostcampChest / isChest), and stamp data for drawing the 20×20 tile layer.
 * Does not spawn obstacles or breakables on the stamp; those are skipped in biome spawn logic.
 */
export function applyLostCampCellLayouts(world, archetypeGrid) {
  const data = archetypeGrid;
  if (!data?.grid) return;
  world.lostCampChestPositions = [];
  world.lostCampStamps = [];
  const tileSize = world.tileSize || 32;
  const stampW = LOST_CAMP_TILE_WIDTH * LOST_CAMP_TILE_SIZE;
  const stampH = LOST_CAMP_TILE_HEIGHT * LOST_CAMP_TILE_SIZE;
  const { cols, rows } = getBiomeGridDimensions(world);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data.grid[row][col] !== BIOME_ARCHETYPE.LOST_CAMPS) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const ox = bounds.x;
      const oy = bounds.y;
      for (const obj of LOST_CAMP_OBJECTS) {
        const isCollision = (obj.ifCollision || obj.isCollision) === 'yes';
        const isChest = (obj.template && String(obj.template).includes('lostcampChest')) || obj.isChest === 'yes';
        if (isCollision && obj.width != null && obj.height != null) {
          world.tileWallRects.push({
            x: ox + obj.x,
            y: oy + obj.y,
            w: Math.max(1, obj.width),
            h: Math.max(1, obj.height),
          });
        }
        if (isChest) {
          world.lostCampChestPositions.push({ x: ox + obj.x, y: oy + obj.y });
        }
      }
      world.lostCampStamps.push({
        bounds: { x: ox, y: oy, w: stampW, h: stampH },
        grid: LOST_CAMP_TILE_DATA.slice(),
        tileSize: LOST_CAMP_TILE_SIZE,
        firstgid: LOST_CAMP_TILESET.firstgid,
        columns: LOST_CAMP_TILESET.columns,
      });
    }
  }
}

const VAULT_CIRCLE_TILE_RADIUS = 5;

/**
 * For each cell with archetype VAULT, place one vault zone: a circle (5 tile radius) at a random
 * position within the cell. world.vaultZones is populated for the game to spawn interactables.
 */
export function applyVaultCellLayouts(world, archetypeGrid, rng = Math.random) {
  const data = archetypeGrid;
  if (!data?.grid) return;
  world.vaultZones = [];
  const tileSize = world.tileSize || 32;
  const radiusPx = VAULT_CIRCLE_TILE_RADIUS * tileSize;
  let id = 1;
  const { cols, rows } = getBiomeGridDimensions(world);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data.grid[row][col] !== BIOME_ARCHETYPE.VAULT) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const inset = radiusPx + tileSize;
      const minX = bounds.x + inset;
      const minY = bounds.y + inset;
      const maxX = bounds.x + bounds.w - inset;
      const maxY = bounds.y + bounds.h - inset;
      if (minX >= maxX || minY >= maxY) continue;
      const cx = minX + rng() * (maxX - minX);
      const cy = minY + rng() * (maxY - minY);
      world.vaultZones.push({ id: id++, cx, cy, radius: radiusPx });
    }
  }
}

/**
 * For each VAULT cell, scatter 6 clusters of treasure decorative tiles (4–5 per cluster)
 * from chest_keys_treasure.png row 6 (0-based row 5), 8 variants. Places outside vault circles.
 */
export function applyVaultTreasureDecorations(world, archetypeGrid, rng = Math.random) {
  const data = archetypeGrid;
  if (!data?.grid) return;
  world.vaultTreasureDecorations = [];
  if (!world.vaultTreasureImage) {
    world.vaultTreasureImage = new Image();
    world.vaultTreasureImage.src = VAULT_TREASURE_SPRITE;
  }
  const tileSize = world.tileSize || 32;
  const radiusPx = VAULT_CIRCLE_TILE_RADIUS * tileSize;
  const margin = radiusPx + tileSize * 2;
  const clusterSpread = tileSize * 2;

  const { cols, rows } = getBiomeGridDimensions(world);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data.grid[row][col] !== BIOME_ARCHETYPE.VAULT) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const inner = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        w: Math.max(0, bounds.w - margin * 2),
        h: Math.max(0, bounds.h - margin * 2),
      };
      if (inner.w < VAULT_TREASURE_SIZE || inner.h < VAULT_TREASURE_SIZE) continue;

      const numClusters = 6;
      for (let c = 0; c < numClusters; c++) {
        const cx = inner.x + rng() * (inner.w - VAULT_TREASURE_SIZE);
        const cy = inner.y + rng() * (inner.h - VAULT_TREASURE_SIZE);
        const count = 4 + Math.floor(rng() * 2);
        const clusterRects = [];
        for (let t = 0; t < count; t++) {
          let placed = false;
          for (let attempt = 0; attempt < 80 && !placed; attempt++) {
            const angle = rng() * Math.PI * 2;
            const dist = rng() * clusterSpread;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const rect = { x, y, w: VAULT_TREASURE_SIZE, h: VAULT_TREASURE_SIZE };
            if (clusterRects.some((r) => rectsOverlap(rect, r))) continue;
            const gx = Math.floor(x / tileSize);
            const gy = Math.floor(y / tileSize);
            const grid = world.tileGrid;
            if (grid && (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length || grid[gy][gx] === WALL)) continue;
            const inVaultCircle = (world.vaultZones || []).some(
              (z) => Math.hypot(x + VAULT_TREASURE_SIZE / 2 - z.cx, y + VAULT_TREASURE_SIZE / 2 - z.cy) <= z.radius + tileSize
            );
            if (inVaultCircle) continue;
            const spriteIndex = Math.floor(rng() * 8);
            world.vaultTreasureDecorations.push({ x, y, spriteIndex });
            clusterRects.push(rect);
            placed = true;
          }
        }
      }
    }
  }
}

/**
 * For MINIBOSS cell: scatter flower sprites for decoration.
 * Ensures flowers don't overlap each other. (Decor only; no collision.)
 */
export function applyMinibossCellDecorations(world, archetypeGrid, rng = Math.random) {
  const data = archetypeGrid;
  if (!data?.grid) return;
  world.minibossFlowerImages = world.minibossFlowerImages || MINIBOSS_FLOWER_SOURCES.map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
  world.minibossFlowers = [];
  const flowerSize = 32;

  const { cols, rows } = getBiomeGridDimensions(world);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data.grid[row][col] !== BIOME_ARCHETYPE.MINIBOSS) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const margin = (world.wallThickness || 32) + 40;
      const inner = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        w: Math.max(0, bounds.w - margin * 2),
        h: Math.max(0, bounds.h - margin * 2),
      };
      for (let i = 0; i < MINIBOSS_FLOWER_SOURCES.length; i++) {
        let placed = false;
        for (let attempt = 0; attempt < 80; attempt++) {
          const x = inner.x + rng() * Math.max(0, inner.w - flowerSize);
          const y = inner.y + rng() * Math.max(0, inner.h - flowerSize);
          const r = { x, y, w: flowerSize, h: flowerSize };
          if (world.minibossFlowers.some((f) => rectsOverlap(r, f.rect))) continue;
          // Avoid placing flowers on tile walls if a tile grid exists.
          const ts = world.tileSize || 32;
          const gx = Math.floor((x + flowerSize / 2) / ts);
          const gy = Math.floor((y + flowerSize / 2) / ts);
          const g = world.tileGrid;
          if (g && (gy < 0 || gy >= g.length || gx < 0 || gx >= g[0].length || g[gy][gx] === WALL)) continue;
          world.minibossFlowers.push({ imgIndex: i, rect: r });
          placed = true;
          break;
        }
        if (!placed) {
          // If we can't place after attempts, skip this flower.
        }
      }
    }
  }
}

export class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.wallThickness = WALL_THICKNESS;
    this.wallCollisionThickness = WALL_COLLISION_THICKNESS;
    this.wallColor = "#2d3748";
    this.floorColor = "#0f172a";
    this.theme = null;
    this.tileGrid = null;
    this.tileSize = 32;
    this.tileWallRects = null;
    this.cosmeticFloor = null;
    this._cropTileByGrid = null;
  }

  _getFloorScatterTile(gx, gy) {
    // Deterministic hash so decals stay fixed to world tiles.
    const themeSeed = this.theme?.id ?? 0;
    const hash = (gx * 73856093) ^ (gy * 19349663) ^ (themeSeed * 83492791) ^ ((this.width / this.tileSize) | 0);
    const normalized = Math.abs(hash % 1000) / 1000;
    if (normalized > 0.03) return null; // ~3% coverage

    const variants = [
      { row: 8, col: 'e' }, { row: 8, col: 'f' }, { row: 8, col: 'g' },
      { row: 9, col: 'e' }, { row: 9, col: 'f' }, { row: 9, col: 'g' },
      { row: 11, col: 'e' }, { row: 11, col: 'f' }, { row: 11, col: 'g' },
    ];
    const variantIndex = Math.abs(((hash >>> 3) + gx * 17 + gy * 31) % variants.length);
    return variants[variantIndex];
  }

  _isFloorCell(gx, gy) {
    if (!this.tileGrid) return true;
    if (gy < 0 || gx < 0 || gy >= this.tileGrid.length || gx >= this.tileGrid[0].length) return false;
    return this.tileGrid[gy][gx] !== 1;
  }

  _getGridBounds() {
    if (this.tileGrid && this.tileGrid.length > 0 && this.tileGrid[0].length > 0) {
      return { W: this.tileGrid[0].length, H: this.tileGrid.length };
    }
    return {
      W: Math.max(1, Math.floor(this.width / this.tileSize)),
      H: Math.max(1, Math.floor(this.height / this.tileSize)),
    };
  }

  _buildCropScatterMap() {
    if (this._cropTileByGrid) return;
    const { W, H } = this._getGridBounds();
    const crops = [
      { row: 20, col: 'a' }, { row: 20, col: 'b' }, { row: 20, col: 'c' }, { row: 20, col: 'd' },
      { row: 20, col: 'e' }, { row: 20, col: 'f' }, { row: 20, col: 'g' }, { row: 20, col: 'h' },
      { row: 20, col: 'i' }, { row: 20, col: 'j' }, { row: 20, col: 'k' }, { row: 20, col: 'l' },
      { row: 20, col: 'm' }, { row: 20, col: 'n' }, { row: 20, col: 'o' }, { row: 20, col: 'p' },
    ];

    // Deterministic LCG seeded by world/theme dimensions.
    let seed = (((this.theme?.id ?? 0) + 1) * 2654435761) ^ (W * 73856093) ^ (H * 19349663);
    seed >>>= 0;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const placed = new Map();
    const floorCount = this.tileGrid
      ? this.tileGrid.reduce((acc, row) => acc + row.reduce((rAcc, c) => rAcc + (c !== 1 ? 1 : 0), 0), 0)
      : W * H;
    const targetTiles = Math.max(0, Math.floor(floorCount * 0.03)); // ~3% clustered coverage
    let placedTiles = 0;

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ];

    const maxClusters = Math.max(12, Math.ceil(targetTiles / 4) * 3);
    let clusterAttempts = 0;
    let clustersMade = 0;
    while (placedTiles < targetTiles && clustersMade < maxClusters && clusterAttempts < maxClusters * 4) {
      clusterAttempts++;
      const cx = Math.floor(rand() * W);
      const cy = Math.floor(rand() * H);
      if (!this._isFloorCell(cx, cy)) continue;

      const groupSize = 4 + Math.floor(rand() * 5); // 4..8
      const crop = crops[Math.floor(rand() * crops.length)];
      const key = `${cx},${cy}`;
      if (placed.has(key)) continue;

      const queue = [[cx, cy]];
      const seen = new Set([key]);
      const groupTiles = [];

      while (queue.length > 0 && groupTiles.length < groupSize) {
        const [gx, gy] = queue.shift();
        const gk = `${gx},${gy}`;
        if (!this._isFloorCell(gx, gy) || placed.has(gk)) continue;
        groupTiles.push([gx, gy]);

        // Shuffle-like neighbor order from RNG for natural cluster shapes.
        const start = Math.floor(rand() * dirs.length);
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[(start + i) % dirs.length];
          const nx = gx + d[0];
          const ny = gy + d[1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nk = `${nx},${ny}`;
          if (seen.has(nk)) continue;
          seen.add(nk);
          if (rand() < 0.85) queue.push([nx, ny]);
        }
      }

      if (groupTiles.length < 4) continue;
      clustersMade++;
      for (const [gx, gy] of groupTiles) {
        const gk = `${gx},${gy}`;
        if (placed.has(gk)) continue;
        const direction = rand() < 0.5 ? -1 : 1;
        const magnitude = 1 + Math.floor(rand() * 4); // 1..4
        placed.set(gk, {
          tile: crop,
          xOffset: direction * magnitude,
        });
        placedTiles++;
      }
    }

    this._cropTileByGrid = placed;
  }

  _getCropScatterTile(gx, gy) {
    if (!this._cropTileByGrid) this._buildCropScatterMap();
    return this._cropTileByGrid.get(`${gx},${gy}`) || null;
  }

  setTheme(mapDef) {
    this.theme = mapDef;
    if (mapDef) {
      this.floorColor = mapDef.floorColor;
      this.wallColor = mapDef.wallColor;
    }
  }

  draw(ctx, camera) {
    const ox = -camera.position.x;
    const oy = -camera.position.y;
    const t = this.wallThickness;
    const tileSize = this.tileSize;

    // Procedural tile grid: draw from grid
    if (this.tileGrid) {
      this._drawTileGrid(ctx, ox, oy, camera, tileSize);
      if (this.lostCampStamps?.length && this.lostCampAtlas?.complete) {
        this._drawLostCampStamps(ctx, ox, oy, camera);
      }
      if (this.minibossFlowers?.length && this.minibossFlowerImages?.length) {
        this._drawMinibossFlowers(ctx, ox, oy, camera);
      }
      if (this.vaultTreasureDecorations?.length && this.vaultTreasureImage?.complete) {
        this._drawVaultTreasures(ctx, ox, oy, camera);
      }
      const exitZones = this.proceduralExitZones || [];
      if (exitZones.length > 0) {
        ctx.fillStyle = "rgba(30, 64, 175, 0.25)";
        for (const exit of exitZones) {
          ctx.fillRect(ox + exit.x, oy + exit.y, exit.w, exit.h);
        }
      }
      return;
    }

    // Draw floor with tiles if atlas is loaded
    if (isTileAtlasLoaded() && this.theme) {
      // Draw floor tiles based on theme
      const tileSize = 32; // Tiles are 32x32, not 16x16
      
      // Calculate which world tiles are visible based on camera position
      // Start from world coordinate 0, find first visible tile
      const worldStartX = Math.floor(camera.position.x / tileSize) * tileSize;
      const worldStartY = Math.floor(camera.position.y / tileSize) * tileSize;
      const worldEndX = Math.ceil((camera.position.x + camera.viewWidth) / tileSize) * tileSize;
      const worldEndY = Math.ceil((camera.position.y + camera.viewHeight) / tileSize) * tileSize;
      
      // Clamp to world bounds
      const clampedStartX = Math.max(0, worldStartX);
      const clampedStartY = Math.max(0, worldStartY);
      const clampedEndX = Math.min(this.width, worldEndX);
      const clampedEndY = Math.min(this.height, worldEndY);
      
      // Choose floor tile based on theme
      let floorTile = null;
      if (this.theme.floorPattern === "bricks") {
        floorTile = { row: 10, col: 'b' }; // stone floor 1
      } else if (this.theme.floorPattern === "grass") {
        floorTile = { row: 8, col: 'b' }; // grass 1
      } else if (this.theme.floorPattern === "stone") {
        floorTile = { row: 7, col: 'b' }; // floor stone 1
      } else if (this.theme.floorPattern === "tiles") {
        floorTile = { row: 7, col: 'b' }; // floor stone 1
      } else if (this.theme.floorPattern === "cracked") {
        floorTile = { row: 9, col: 'b' }; // dirt 1
      }
      
      if (floorTile) {
        // Iterate through world tile coordinates
        for (let worldY = clampedStartY; worldY < clampedEndY; worldY += tileSize) {
          for (let worldX = clampedStartX; worldX < clampedEndX; worldX += tileSize) {
            // Convert world coordinates to screen coordinates
            const screenX = worldX + ox;
            const screenY = worldY + oy;
            
            // Calculate variation based on world coordinates (not screen coordinates)
            // This ensures the pattern stays fixed in world space
            const tileX = worldX / tileSize;
            const tileY = worldY / tileSize;
            const variation = Math.floor((tileX + tileY) % 3);
            
            if (variation === 1 && floorTile.row) {
              drawTile(ctx, floorTile.row, String.fromCharCode(floorTile.col.charCodeAt(0) + 1), screenX, screenY, tileSize);
            } else if (variation === 2 && floorTile.row) {
              drawTile(ctx, floorTile.row, String.fromCharCode(floorTile.col.charCodeAt(0) + 2), screenX, screenY, tileSize);
            } else {
              drawTile(ctx, floorTile.row, floorTile.col, screenX, screenY, tileSize);
            }

            const scatter = this._getFloorScatterTile(tileX, tileY);
            if (scatter) {
              drawTile(ctx, scatter.row, scatter.col, screenX, screenY, tileSize);
            }
            const cropScatter = this._getCropScatterTile(tileX, tileY);
            if (cropScatter) {
              drawTile(ctx, cropScatter.tile.row, cropScatter.tile.col, screenX + cropScatter.xOffset, screenY - 5, tileSize);
            }
          }
        }
      }
    } else {
      // Fallback to solid color
      ctx.fillStyle = this.floorColor;
      ctx.fillRect(ox, oy, this.width, this.height);

      if (this.theme && this.theme.floorPattern) {
        ctx.fillStyle = this.theme.wallAccent || "#374151";
        ctx.globalAlpha = 0.15;
        const grid = 24;
        for (let gx = 0; gx < this.width + grid; gx += grid) {
          for (let gy = 0; gy < this.height + grid; gy += grid) {
            if ((gx + gy) % (grid * 2) === 0) {
              ctx.fillRect(ox + gx, oy + gy, grid, grid);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // Draw walls with tiles
    if (isTileAtlasLoaded()) {
      const tileSize = 32; // Tiles are 32x32, not 16x16
      // Choose wall tile based on theme
      let wallTopTile = { row: 1, col: 'a' }; // dirt wall top (default)
      let wallSideTile = { row: 1, col: 'b' }; // dirt wall side (default)
      
      if (this.theme) {
        // Map-specific wall tiles
        if (this.theme.name === "Dungeon") {
          wallTopTile = { row: 1, col: 'a' }; // dirt wall top
          wallSideTile = { row: 1, col: 'b' }; // dirt wall side
        } else if (this.theme.name === "Castle") {
          wallTopTile = { row: 3, col: 'a' }; // stone brick wall top
          wallSideTile = { row: 3, col: 'b' }; // stone brick wall side
        } else if (this.theme.name === "Cave") {
          wallTopTile = { row: 2, col: 'a' }; // rough stone wall top
          wallSideTile = { row: 2, col: 'b' }; // rough stone wall side
        } else if (this.theme.name === "Wasteland") {
          wallTopTile = { row: 6, col: 'a' }; // catacombs/skull wall top
          wallSideTile = { row: 6, col: 'b' }; // catacombs/skull wall side
        }
      }
      
      // Top wall - draw at fixed world Y position (0), convert to screen space
      const topWallWorldY = 0;
      const topWallScreenY = topWallWorldY + oy;
      for (let worldX = 0; worldX < this.width; worldX += tileSize) {
        const screenX = worldX + ox; // World X, convert to screen space
        drawTile(ctx, wallTopTile.row, wallTopTile.col, screenX, topWallScreenY, tileSize);
      }
      
      // Bottom wall - draw at fixed world Y position (height - thickness)
      const bottomWallWorldY = this.height - t;
      const bottomWallScreenY = bottomWallWorldY + oy;
      for (let worldX = 0; worldX < this.width; worldX += tileSize) {
        const screenX = worldX + ox;
        drawTile(ctx, wallTopTile.row, wallTopTile.col, screenX, bottomWallScreenY, tileSize);
      }
      
      // Left wall - draw at fixed world X position (0)
      const leftWallWorldX = 0;
      const leftWallScreenX = leftWallWorldX + ox;
      for (let worldY = 0; worldY < this.height; worldY += tileSize) {
        const screenY = worldY + oy; // World Y, convert to screen space
        drawTile(ctx, wallSideTile.row, wallSideTile.col, leftWallScreenX, screenY, tileSize);
      }
      
      // Right wall - draw at fixed world X position (width - thickness)
      const rightWallWorldX = this.width - t;
      const rightWallScreenX = rightWallWorldX + ox;
      for (let worldY = 0; worldY < this.height; worldY += tileSize) {
        const screenY = worldY + oy;
        drawTile(ctx, wallSideTile.row, wallSideTile.col, rightWallScreenX, screenY, tileSize);
      }
    } else {
      // Fallback to solid color walls
      ctx.fillStyle = this.wallColor;
      ctx.fillRect(ox, oy, this.width, t);
      ctx.fillRect(ox, oy + this.height - t, this.width, t);
      ctx.fillRect(ox, oy, t, this.height);
      ctx.fillRect(ox + this.width - t, oy, t, this.height);
    }

    // Wall accent (inner edge)
    if (this.theme && this.theme.wallAccent) {
      ctx.fillStyle = this.theme.wallAccent;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(ox + t, oy + t, this.width - t * 2, 2);
      ctx.fillRect(ox + t, oy + this.height - t - 2, this.width - t * 2, 2);
      ctx.fillRect(ox + t, oy + t, 2, this.height - t * 2);
      ctx.fillRect(ox + this.width - t - 2, oy + t, 2, this.height - t * 2);
      ctx.globalAlpha = 1;
    }

    // Exit zones (doorways - cut out or highlight)
    const exitZones = this.proceduralExitZones || (this.theme && this.theme.exits) || [];
    if (exitZones.length > 0) {
      ctx.fillStyle = "rgba(30, 64, 175, 0.25)";
      for (const exit of exitZones) {
        ctx.fillRect(ox + exit.x, oy + exit.y, exit.w, exit.h);
      }
    }
  }

  _drawTileGrid(ctx, ox, oy, camera, tileSize) {
    const W = this.tileGrid[0].length;
    const H = this.tileGrid.length;
    const worldStartX = Math.floor(camera.position.x / tileSize) * tileSize;
    const worldStartY = Math.floor(camera.position.y / tileSize) * tileSize;
    const worldEndX = Math.ceil((camera.position.x + camera.viewWidth) / tileSize) * tileSize;
    const worldEndY = Math.ceil((camera.position.y + camera.viewHeight) / tileSize) * tileSize;
    const startGx = Math.max(0, Math.floor(worldStartX / tileSize));
    const startGy = Math.max(0, Math.floor(worldStartY / tileSize));
    const endGx = Math.min(W, Math.ceil(worldEndX / tileSize));
    const endGy = Math.min(H, Math.ceil(worldEndY / tileSize));

    let floorTile = { row: 7, col: 'b' };
    let wallTopTile = { row: 1, col: 'a' };
    let wallSideTile = { row: 1, col: 'b' };
    if (this.theme) {
      if (this.theme.floorPattern === "bricks") floorTile = { row: 10, col: 'b' };
      else if (this.theme.floorPattern === "grass") floorTile = { row: 8, col: 'b' };
      else if (this.theme.floorPattern === "stone") floorTile = { row: 7, col: 'b' };
      else if (this.theme.floorPattern === "tiles") floorTile = { row: 7, col: 'b' };
      else if (this.theme.floorPattern === "cracked") floorTile = { row: 9, col: 'b' };
      if (this.theme.name === "Castle") { wallTopTile = { row: 3, col: 'a' }; wallSideTile = { row: 3, col: 'b' }; }
      else if (this.theme.name === "Cave") { wallTopTile = { row: 2, col: 'a' }; wallSideTile = { row: 2, col: 'b' }; }
      else if (this.theme.name === "Wasteland") { wallTopTile = { row: 6, col: 'a' }; wallSideTile = { row: 6, col: 'b' }; }
    }

    const viewLeft = camera.position.x;
    const viewTop = camera.position.y;
    const viewRight = viewLeft + camera.viewWidth;
    const viewBottom = viewTop + camera.viewHeight;
    const blockerAtlasReady = this.blockerChunkAtlas?.complete && this.blockerChunkAtlas?.naturalWidth > 0;
    const cosmeticGroundLayer = this.cosmeticFloor?.groundLayer || null;
    const canDrawCosmeticGroundBase = !!cosmeticGroundLayer?.baseCanvas;
    const canDrawTileAtlas = isTileAtlasLoaded();

    if (canDrawCosmeticGroundBase) {
      drawOpenWorldGroundBase(ctx, cosmeticGroundLayer, ox, oy, camera);
    }

    for (let gy = startGy; gy < endGy; gy++) {
      for (let gx = startGx; gx < endGx; gx++) {
        const worldX = gx * tileSize;
        const worldY = gy * tileSize;
        const screenX = Math.round(worldX + ox);
        const screenY = Math.round(worldY + oy);
        const isWall = this.tileGrid[gy][gx] === 1;
        const inBlockerChunk = blockerAtlasReady && this.blockerChunkTileSet && this.blockerChunkTileSet.has(`${gx},${gy}`);
        if (isWall && !inBlockerChunk) {
          const isTop = gy === 0 || (gy > 0 && this.tileGrid[gy - 1][gx] !== 1);
          if (canDrawTileAtlas) {
            drawTile(ctx, isTop ? wallTopTile.row : wallSideTile.row, isTop ? wallTopTile.col : wallSideTile.col, screenX, screenY, tileSize);
          } else {
            ctx.fillStyle = this.wallColor;
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
          }
        } else {
          if (canDrawCosmeticGroundBase) {
            // Base floor already drawn from the prerendered world-space canvas.
          } else if (canDrawTileAtlas) {
            const variation = Math.floor((gx + gy) % 3);
            const col = String.fromCharCode(floorTile.col.charCodeAt(0) + variation);
            drawTile(ctx, floorTile.row, col, screenX, screenY, tileSize);
          } else {
            ctx.fillStyle = this.floorColor;
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
          }
        }
      }
    }

    if (cosmeticGroundLayer?.detailCanvas) {
      drawOpenWorldGroundDetails(ctx, cosmeticGroundLayer, ox, oy, camera);
    }

    if (!canDrawCosmeticGroundBase) {
      for (let gy = startGy; gy < endGy; gy++) {
        for (let gx = startGx; gx < endGx; gx++) {
          const worldX = gx * tileSize;
          const worldY = gy * tileSize;
          const screenX = Math.round(worldX + ox);
          const screenY = Math.round(worldY + oy);
          const isWall = this.tileGrid[gy][gx] === 1;
          const inBlockerChunk = blockerAtlasReady && this.blockerChunkTileSet && this.blockerChunkTileSet.has(`${gx},${gy}`);
          if (isWall && !inBlockerChunk) continue;

          if (!inBlockerChunk && canDrawTileAtlas) {
            const scatter = this._getFloorScatterTile(gx, gy);
            if (scatter) {
              drawTile(ctx, scatter.row, scatter.col, screenX, screenY, tileSize);
            }
            const cropScatter = this._getCropScatterTile(gx, gy);
            if (cropScatter) {
              drawTile(ctx, cropScatter.tile.row, cropScatter.tile.col, screenX + cropScatter.xOffset, screenY - 5, tileSize);
            }
          }
          if (!inBlockerChunk && this.cobblestonePathTiles && this.cobblestonePathAtlas?.complete && this.cobblestonePathVariants?.length) {
              const variantIndex = this.cobblestonePathTiles.get(`${gx},${gy}`);
              if (variantIndex != null) {
                const v = this.cobblestonePathVariants[variantIndex] || this.cobblestonePathVariants[0];
                const drawSize = Math.round(tileSize * 0.75);
                const margin = (tileSize - drawSize) / 2;
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                  this.cobblestonePathAtlas,
                  v.sx, v.sy, 32, 32,
                  screenX + margin, screenY + margin, drawSize, drawSize
                );
                ctx.imageSmoothingEnabled = true;
                ctx.restore();
              }
          }
        }
      }
    }

    if (this.blockerChunkSpaces?.length && blockerAtlasReady) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (const space of this.blockerChunkSpaces) {
        const wx = space.worldX;
        const wy = space.worldY;
        if (wx + CHUNK_PX < viewLeft || wx > viewRight || wy + CHUNK_PX < viewTop || wy > viewBottom) continue;
        const ch = space.chunk;
        const dx = Math.round(ox + wx);
        const dy = Math.round(oy + wy);
        ctx.drawImage(
          this.blockerChunkAtlas,
          ch.x, ch.y, ch.width, ch.height,
          dx, dy, CHUNK_PX, CHUNK_PX
        );
      }
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    }
  }

  _drawLostCampStamps(ctx, ox, oy, camera) {
    const img = this.lostCampAtlas;
    if (!img || !img.complete) return;
    const viewLeft = camera.position.x;
    const viewTop = camera.position.y;
    const viewRight = viewLeft + camera.viewWidth;
    const viewBottom = viewTop + camera.viewHeight;
    for (const stamp of this.lostCampStamps) {
      const { bounds, grid, tileSize: ts, firstgid, columns } = stamp;
      if (bounds.x + bounds.w < viewLeft || bounds.x > viewRight || bounds.y + bounds.h < viewTop || bounds.y > viewBottom) continue;
      const W = LOST_CAMP_TILE_WIDTH;
      const H = LOST_CAMP_TILE_HEIGHT;
      const TILED_GID_MASK = 0x1fffffff;
      for (let gy = 0; gy < H; gy++) {
        for (let gx = 0; gx < W; gx++) {
          const gid = grid[gy * W + gx];
          if (!gid) continue;
          const raw = gid & TILED_GID_MASK;
          if (raw < firstgid) continue;
          const localId = raw - firstgid;
          if (localId >= columns * 16) continue;
          const tx = localId % columns;
          const ty = Math.floor(localId / columns);
          const worldX = bounds.x + gx * ts;
          const worldY = bounds.y + gy * ts;
          if (worldX + ts < viewLeft || worldX > viewRight || worldY + ts < viewTop || worldY > viewBottom) continue;
          ctx.drawImage(img, tx * ts, ty * ts, ts, ts, ox + worldX, oy + worldY, ts, ts);
        }
      }
    }
  }

  _drawMinibossFlowers(ctx, ox, oy, camera) {
    const viewLeft = camera.position.x;
    const viewTop = camera.position.y;
    const viewRight = viewLeft + camera.viewWidth;
    const viewBottom = viewTop + camera.viewHeight;
    for (const f of this.minibossFlowers || []) {
      const img = this.minibossFlowerImages?.[f.imgIndex];
      if (!img || !img.complete) continue;
      const r = f.rect;
      if (r.x + r.w < viewLeft || r.x > viewRight || r.y + r.h < viewTop || r.y > viewBottom) continue;
      ctx.drawImage(img, ox + r.x, oy + r.y, r.w, r.h);
    }
  }

  _drawVaultTreasures(ctx, ox, oy, camera) {
    const viewLeft = camera.position.x;
    const viewTop = camera.position.y;
    const viewRight = viewLeft + camera.viewWidth;
    const viewBottom = viewTop + camera.viewHeight;
    const img = this.vaultTreasureImage;
    const size = VAULT_TREASURE_SIZE;
    const row = VAULT_TREASURE_ROW;
    for (const d of this.vaultTreasureDecorations || []) {
      if (d.x + size < viewLeft || d.x > viewRight || d.y + size < viewTop || d.y > viewBottom) continue;
      const sx = d.spriteIndex * size;
      const sy = row * size;
      ctx.drawImage(img, sx, sy, size, size, ox + d.x, oy + d.y, size, size);
    }
  }
}
