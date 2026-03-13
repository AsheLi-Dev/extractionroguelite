// src/home-base/hub-map-loader.js
// Build floor (terrain) and Floor Details grids from a Tiled TMJ map. Both use raw GIDs; one tile per cell.
// Assumes the map's tileset matches mainlevbuild.png (50 cols, 32px tiles, firstgid 1).

const DEFAULT_TILE_SIZE = 32;
const DEFAULT_ATLAS_COLS = 50;

/** Tiled stores flip flags in the top bits of GID; strip them to get the actual tile index. */
const TILED_GID_MASK = 0x1fffffff;

/**
 * Strip Tiled flip/rotation flags from a GID so it can be used for atlas lookups.
 * @param {number} gid - Raw GID from layer data
 * @returns {number} GID with only the tile index (1-based)
 */
export function stripTiledFlipFlags(gid) {
  if (typeof gid !== "number") return 0;
  return gid & TILED_GID_MASK;
}

/**
 * Convert a Tiled GID to atlas tile coordinates (tx, ty) for drawing.
 * Flip flags are stripped so flipped tiles still resolve to the correct atlas cell.
 * @param {number} gid - Global tile ID from the layer data (may include Tiled flip bits)
 * @param {{ firstgid?: number }} [tileset] - firstgid (default 1)
 * @param {number} [atlasCols] - Tileset columns (default 50)
 * @returns {{ tx: number, ty: number } | null} tile coords or null if gid is empty/invalid
 */
export function gidToTileCoords(gid, tileset = {}, atlasCols = DEFAULT_ATLAS_COLS) {
  const firstgid = tileset.firstgid ?? 1;
  if (typeof gid !== "number" || gid < firstgid) return null;
  const rawId = stripTiledFlipFlags(gid);
  const localId = rawId - firstgid;
  return {
    tx: localId % atlasCols,
    ty: Math.floor(localId / atlasCols)
  };
}

/**
 * Build a raw GID grid from a tile layer (same dimensions as world in tiles). 0 = no tile.
 * @param {{ width: number, height: number }} world - World size in pixels
 * @param {{ data: number[], width: number, height: number }} layer - Tile layer
 * @param {number} tileSize - Tile size in pixels
 * @returns {number[][]} grid[gy][gx] = GID (0 = no tile)
 */
function buildDetailsGridFromLayer(world, layer, tileSize = DEFAULT_TILE_SIZE) {
  const cols = Math.ceil(world.width / tileSize);
  const rows = Math.ceil(world.height / tileSize);
  const mapWidth = layer.width ?? 64;
  const data = layer.data || [];
  const grid = [];
  for (let gy = 0; gy < rows; gy++) {
    const row = [];
    for (let gx = 0; gx < cols; gx++) {
      const index = gy * mapWidth + gx;
      const gid = data[index];
      row.push(typeof gid === "number" && gid !== 0 ? gid : 0);
    }
    grid.push(row);
  }
  return grid;
}

/** Fallback when .tsx fetch fails (optional). */
const EXTERNAL_TILESET_DEFAULTS = {
  "Props.tsx": { columns: 16, tilecount: 256 },
  "Extra Prop.tsx": { columns: 8, tilecount: 64 }
};

/**
 * Fetch a single .tsx and parse image source, columns, tilecount.
 * @param {string} tsxUrl - Full URL to the .tsx file
 * @returns {Promise<{ image: string, columns: number, tilecount: number } | null>}
 */
async function fetchTilesetFromTsx(tsxUrl) {
  try {
    const res = await fetch(tsxUrl);
    if (!res.ok) return null;
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const tileset = doc.querySelector("tileset");
    const imageEl = doc.querySelector("image");
    const image = imageEl?.getAttribute("source") ?? "";
    const columns = parseInt(tileset?.getAttribute("columns") ?? "0", 10) || 0;
    const tilecount = parseInt(tileset?.getAttribute("tilecount") ?? "0", 10) || 0;
    return { image, columns, tilecount };
  } catch {
    return null;
  }
}

/**
 * Resolve external tilesets by fetching each .tsx and filling image, columns, tilecount.
 * Mutates the given tileset objects in place. baseUrl should be the URL of the map directory (e.g. ending with /).
 * @param {object[]} tilesets - tmj.tilesets array (will be mutated)
 * @param {string} baseUrl - Base URL to resolve source filenames (e.g. same directory as HubMap)
 * @returns {Promise<void>}
 */
export async function resolveExternalTilesets(tilesets, baseUrl) {
  if (!Array.isArray(tilesets)) return;
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  await Promise.all(
    tilesets.map(async (ts) => {
      const source = ts.source;
      if (!source) return;
      const resolved = await fetchTilesetFromTsx(base + source);
      if (resolved) {
        if (resolved.image) ts.image = resolved.image;
        if (resolved.columns) ts.columns = resolved.columns;
        if (resolved.tilecount) ts.tilecount = resolved.tilecount;
      }
    })
  );
}

/**
 * Build tileset descriptors from TMJ for GID resolution and drawing.
 * For external tilesets (source only), uses columns/tilecount from .tsx (after resolve) or EXTERNAL_TILESET_DEFAULTS fallback.
 * @param {object[]} tilesets - tmj.tilesets array (prefer resolved via resolveExternalTilesets)
 * @returns {{ firstgid: number, columns: number, image: string, tilecount: number, source: string }[]}
 */
function parseTilesets(tilesets) {
  if (!Array.isArray(tilesets)) return [];
  return tilesets.map((ts) => {
    const ext = ts.source ? EXTERNAL_TILESET_DEFAULTS[ts.source] : null;
    return {
      firstgid: ts.firstgid ?? 1,
      columns: ts.columns ?? ext?.columns ?? DEFAULT_ATLAS_COLS,
      image: ts.image || "",
      tilecount: ts.tilecount ?? ext?.tilecount ?? 0,
      source: ts.source || ""
    };
  });
}

/**
 * Find which tileset a raw GID belongs to (by firstgid and tilecount).
 * @param {number} rawGid - GID with flip flags stripped
 * @param {{ firstgid: number, tilecount: number }[]} tilesets - sorted by firstgid ascending
 * @returns {{ firstgid: number, columns: number, image: string } | null}
 */
export function getTilesetForGid(rawGid, tilesets) {
  if (!tilesets?.length || typeof rawGid !== "number" || rawGid < 1) return null;
  const id = stripTiledFlipFlags(rawGid);
  for (let i = tilesets.length - 1; i >= 0; i--) {
    const ts = tilesets[i];
    const end = ts.firstgid + (ts.tilecount || 0);
    if (id >= ts.firstgid && (ts.tilecount === 0 || id < end)) return ts;
  }
  return null;
}

/**
 * Parse a TMJ map object and build terrain + all tile layers in Tiled order.
 * Returns terrainGrid and floorDetailsGrid for backward compatibility; tileLayers has every tile layer for drawing (first = back, last = front).
 * @param {object} tmj - Parsed Tiled JSON map (TMJ)
 * @param {{ width?: number, height?: number }} [world] - World size; default 2048×2048 (64×64 tiles)
 * @returns {{ terrainGrid: number[][], floorDetailsGrid?: number[][], tileLayers: { id: number, name: string, grid: number[][] }[], firstgid: number, atlasCols: number, tilesets: object[] } | null}
 */
export function buildTerrainGridFromHubMap(tmj, world = { width: 2048, height: 2048 }) {
  const w = world.width ?? 2048;
  const h = world.height ?? 2048;
  const worldSize = { width: w, height: h };
  const layers = tmj.layers || [];
  const floorLayer = layers.find((l) => l.type === "tilelayer" && (l.name === "Floor" || l.name === "floor"));
  if (!floorLayer || !Array.isArray(floorLayer.data)) return null;

  const tileSize = tmj.tilewidth || DEFAULT_TILE_SIZE;
  const terrainGrid = buildDetailsGridFromLayer(worldSize, floorLayer, tileSize);
  const tilesets = parseTilesets(tmj.tilesets);
  const firstTileset = tilesets[0] || {};
  const firstgid = firstTileset.firstgid ?? 1;
  const atlasCols = firstTileset.columns ?? DEFAULT_ATLAS_COLS;

  /** All tile layers in TMJ order (first = back, last = front). */
  const tileLayers = [];
  for (const layer of layers) {
    if (layer.type !== "tilelayer" || !Array.isArray(layer.data)) continue;
    tileLayers.push({
      id: layer.id,
      name: layer.name || "",
      grid: buildDetailsGridFromLayer(worldSize, layer, tileSize)
    });
  }

  const detailsLayer = layers.find(
    (l) => l.type === "tilelayer" && (l.name === "Floor Details" || l.name === "Floor details" || l.name === "floor_details")
  );
  const floorDetailsGrid =
    detailsLayer && Array.isArray(detailsLayer.data)
      ? buildDetailsGridFromLayer(worldSize, detailsLayer, tileSize)
      : undefined;

  return { terrainGrid, floorDetailsGrid, tileLayers, firstgid, atlasCols, tilesets };
}
