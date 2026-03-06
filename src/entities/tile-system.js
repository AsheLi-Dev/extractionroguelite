import { Vec2 } from '../utils.js';

// Shared tile atlas for all tiles
let tileAtlas = null;
let tileAtlasLoaded = false;

// Tile atlas dimensions
const TILE_SIZE = 32; // Actual tile size in pixels (32x32)
const ATLAS_WIDTH = 544; // Actual atlas width
const ATLAS_HEIGHT = 832; // Actual atlas height
const ATLAS_COLUMNS = Math.floor(ATLAS_WIDTH / TILE_SIZE); // 17 columns
const ATLAS_ROWS = Math.floor(ATLAS_HEIGHT / TILE_SIZE); // 26 rows

// Tile coordinate lookup table
// Format: { "row_col": { x, y, width, height } }
// This will be populated from tiles.txt
const TILE_COORDS = {};

// Load the tile atlas automatically when module loads
function loadTileAtlas() {
  if (tileAtlas) return tileAtlas;
  
  tileAtlas = new Image();
  tileAtlas.onload = () => {
    tileAtlasLoaded = true;
  };
  tileAtlas.onerror = () => {
    console.warn('Failed to load tile atlas');
    tileAtlasLoaded = false;
  };
  tileAtlas.src = 'assets/Environments/tiles.png';
  return tileAtlas;
}

// Parse tiles.txt to build coordinate lookup
async function parseTilesFile() {
  try {
    const response = await fetch('assets/Environments/tiles.txt');
    const text = await response.text();
    const lines = text.split('\n');
    
    let currentRow = 0;
    let currentCol = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      
      // Match pattern like "1.a. dirt wall (top)" or "7.b. floor stone 1"
      const match = trimmed.match(/^(\d+)\.([a-z])\.\s*(.+)$/i);
      if (match) {
        const row = parseInt(match[1]);
        const col = match[2].toLowerCase();
        const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0);
        
        // Calculate coordinates (assuming uniform 32x32 tiles starting at 0,0)
        const key = `${row}_${col}`;
        TILE_COORDS[key] = {
          x: colIndex * TILE_SIZE,
          y: (row - 1) * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
          name: match[3].trim(),
          row: row,
          col: col
        };
      }
    }
    
  } catch (error) {
    console.warn('Failed to parse tiles.txt:', error);
  }
}

// Get tile coordinates by row and column letter
export function getTileCoords(row, col) {
  const key = `${row}_${col}`;
  return TILE_COORDS[key] || null;
}

// Get tile coordinates by name (searches for partial match)
export function getTileCoordsByName(name) {
  for (const key in TILE_COORDS) {
    if (TILE_COORDS[key].name.toLowerCase().includes(name.toLowerCase())) {
      return TILE_COORDS[key];
    }
  }
  return null;
}

// Draw a single tile
export function drawTile(ctx, tileRow, tileCol, screenX, screenY, size = TILE_SIZE) {
  if (!tileAtlasLoaded || !tileAtlas || !tileAtlas.complete) {
    // Fallback: draw colored rectangle
    ctx.fillStyle = '#666';
    ctx.fillRect(screenX, screenY, size, size);
    return;
  }
  
  const coords = getTileCoords(tileRow, tileCol);
  if (!coords) {
    console.warn(`Tile not found: ${tileRow}.${tileCol}`);
    ctx.fillStyle = '#f00';
    ctx.fillRect(screenX, screenY, size, size);
    return;
  }
  
  ctx.save();
  ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering
  
  ctx.drawImage(
    tileAtlas,
    coords.x, coords.y, coords.width, coords.height,
    screenX, screenY, size, size
  );
  
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

// Draw a tile by name
export function drawTileByName(ctx, tileName, screenX, screenY, size = TILE_SIZE) {
  const coords = getTileCoordsByName(tileName);
  if (!coords) {
    console.warn(`Tile not found by name: ${tileName}`);
    ctx.fillStyle = '#f00';
    ctx.fillRect(screenX, screenY, size, size);
    return;
  }
  
  drawTile(ctx, coords.row, coords.col, screenX, screenY, size);
}

// Draw a tilemap (2D array of tile references)
export function drawTilemap(ctx, tilemap, tileSize, offsetX = 0, offsetY = 0) {
  if (!tileAtlasLoaded || !tileAtlas || !tileAtlas.complete) return;
  
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  
  for (let y = 0; y < tilemap.length; y++) {
    for (let x = 0; x < tilemap[y].length; x++) {
      const tile = tilemap[y][x];
      if (!tile) continue;
      
      let coords = null;
      if (typeof tile === 'string') {
        // Tile reference like "1.a" or "7.b"
        const match = tile.match(/^(\d+)\.([a-z])$/i);
        if (match) {
          coords = getTileCoords(parseInt(match[1]), match[2].toLowerCase());
        } else {
          // Try as name
          coords = getTileCoordsByName(tile);
        }
      } else if (tile.row && tile.col) {
        coords = getTileCoords(tile.row, tile.col);
      }
      
      if (coords) {
        const screenX = offsetX + x * tileSize;
        const screenY = offsetY + y * tileSize;
        
        ctx.drawImage(
          tileAtlas,
          coords.x, coords.y, coords.width, coords.height,
          screenX, screenY, tileSize, tileSize
        );
      }
    }
  }
  
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

// Initialize the tile system
export function initTileSystem() {
  loadTileAtlas();
  parseTilesFile();
}

// Export atlas status
export function isTileAtlasLoaded() {
  return tileAtlasLoaded && tileAtlas && tileAtlas.complete;
}

// Get the tile atlas image (for advanced usage)
export function getTileAtlas() {
  return tileAtlas;
}

// Initialize on module load
initTileSystem();
