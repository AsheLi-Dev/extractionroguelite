import { Vec2 } from '../utils.js';
import { drawTile, drawTileByName, isTileAtlasLoaded } from '../entities/tile-system.js';
import { generateBlockerMap, WALL, PRESET_SMALL, PRESET_MEDIUM, PRESET_LARGE } from '../map-gen-blockers.js';

export { PRESET_SMALL, PRESET_MEDIUM, PRESET_LARGE };

export const MAP_WIDTH = 3600;
export const MAP_HEIGHT = 1350; // 900 * 1.5
export const WALL_THICKNESS = 32;
/** Collision margin for outer walls; can be smaller than WALL_THICKNESS so collision matches visible wall sprite. */
export const WALL_COLLISION_THICKNESS = 16;

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
    enemyCount: 6,
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
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 0, spawnSide: "right" },
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 2, spawnSide: "left" }
    ],
    enemyCount: 8,
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
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 1, spawnSide: "right" },
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 3, spawnSide: "left" }
    ],
    enemyCount: 10,
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
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 2, spawnSide: "right" },
      { x: MAP_WIDTH - WALL_THICKNESS - 80, y: MAP_HEIGHT / 2 - 60, w: 80, h: 120, targetMapId: 4, spawnSide: "left" }
    ],
    enemyCount: 12,
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
    exits: [
      { x: 0, y: MAP_HEIGHT / 2 - 60, w: WALL_THICKNESS + 60, h: 120, targetMapId: 3, spawnSide: "right" }
    ],
    enemyCount: 16,
    enemyScale: { hp: 2.5, attack: 1.8, speed: 1.5 },
    lootQuality: 0.85,
  },
];

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

    for (let gy = startGy; gy < endGy; gy++) {
      for (let gx = startGx; gx < endGx; gx++) {
        const worldX = gx * tileSize;
        const worldY = gy * tileSize;
        const screenX = worldX + ox;
        const screenY = worldY + oy;
        const isWall = this.tileGrid[gy][gx] === 1;
        if (isWall) {
          const isTop = gy === 0 || (gy > 0 && this.tileGrid[gy - 1][gx] !== 1);
          if (isTileAtlasLoaded()) {
            drawTile(ctx, isTop ? wallTopTile.row : wallSideTile.row, isTop ? wallTopTile.col : wallSideTile.col, screenX, screenY, tileSize);
          } else {
            ctx.fillStyle = this.wallColor;
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
          }
        } else {
          if (isTileAtlasLoaded()) {
            const variation = Math.floor((gx + gy) % 3);
            const col = String.fromCharCode(floorTile.col.charCodeAt(0) + variation);
            drawTile(ctx, floorTile.row, col, screenX, screenY, tileSize);
            const scatter = this._getFloorScatterTile(gx, gy);
            if (scatter) {
              drawTile(ctx, scatter.row, scatter.col, screenX, screenY, tileSize);
            }
            const cropScatter = this._getCropScatterTile(gx, gy);
            if (cropScatter) {
              drawTile(ctx, cropScatter.tile.row, cropScatter.tile.col, screenX + cropScatter.xOffset, screenY - 5, tileSize);
            }
          } else {
            ctx.fillStyle = this.floorColor;
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
          }
        }
      }
    }
  }
}
