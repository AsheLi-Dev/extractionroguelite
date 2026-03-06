/**
 * Procedural "blocker rectangle" map generator.
 * Produces chunky corridor/room layouts with guaranteed start-to-exit connectivity.
 *
 * Tile types: WALL=1, FLOOR=0
 * Deterministic with seed (mulberry32).
 */

export const WALL = 1;
export const FLOOR = 0;

/** Minimum open space (in tiles) between two blocks (blockers or border). */
const MIN_GAP_BETWEEN_BLOCKS = 5;

const DEFAULT_CONFIG = {
  borderThickness: 1,
  corridorWidth: 9,
  waypointCount: 4,
  blockerCount: 12,
  blockerMinWFrac: 0.10,
  blockerMaxWFrac: 0.30,
  blockerMinHFrac: 0.10,
  blockerMaxHFrac: 0.35,
  maxAttemptsPerBlocker: 50,
  roomStampCount: 3,
  roomMinSize: 2,
  roomMaxSize: 5,
  fillDisconnectedPockets: true,
  debug: false,
};

/** Mulberry32 seeded RNG */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamp value to [min, max] */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Stamp a rectangle on the grid */
export function stampRect(grid, x, y, w, h, value) {
  const H = grid.length;
  const W = grid[0].length;
  for (let dy = 0; dy < h; dy++) {
    const gy = y + dy;
    if (gy < 0 || gy >= H) continue;
    for (let dx = 0; dx < w; dx++) {
      const gx = x + dx;
      if (gx < 0 || gx >= W) continue;
      grid[gy][gx] = value;
    }
  }
}

/** Stamp a corridor (thickened line) from (x0,y0) to (x1,y1) with given width */
export function stampCorridor(grid, x0, y0, x1, y1, width, value) {
  const half = Math.floor(width / 2);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const stepX = dx / len;
  const stepY = dy / len;

  for (let t = 0; t <= len; t += 0.5) {
    const cx = Math.floor(x0 + stepX * t);
    const cy = Math.floor(y0 + stepY * t);
    stampRect(grid, cx - half, cy - half, width, width, value);
  }
}

/** Flood fill from start through FLOOR tiles; returns visited 2D boolean array */
export function floodFillReachable(grid, start) {
  const H = grid.length;
  const W = grid[0].length;
  const visited = Array(H)
    .fill(null)
    .map(() => Array(W).fill(false));
  const queue = [{ x: start.x, y: start.y }];
  visited[start.y][start.x] = true;

  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && !visited[ny][nx] && grid[ny][nx] === FLOOR) {
        visited[ny][nx] = true;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return visited;
}

/** Check if exit is reachable from start via flood fill */
function isExitReachable(grid, start, exit) {
  const visited = floodFillReachable(grid, start);
  return visited[exit.y][exit.x];
}

/** Print ASCII map to console (debug) */
export function printAsciiMap(grid, start = null, exit = null) {
  const H = grid.length;
  const W = grid[0].length;
  let out = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (start && start.x === x && start.y === y) out += "S";
      else if (exit && exit.x === x && exit.y === y) out += "E";
      else out += grid[y][x] === WALL ? "#" : ".";
    }
    out += "\n";
  }
  console.log(out);
}

/**
 * Generate a procedural blocker map.
 * @param {Object} opts
 * @param {number} opts.W - Grid width (tiles)
 * @param {number} opts.H - Grid height (tiles)
 * @param {number} opts.seed - RNG seed
 * @param {Object} opts.config - Override config values
 * @returns {{ grid: number[][], start: {x,y}, exit: {x,y} }}
 */
export function generateBlockerMap({ W, H, seed = 12345, config = {} }) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rng = mulberry32(seed);

  // 1) Init grid to FLOOR
  const grid = Array(H)
    .fill(null)
    .map(() => Array(W).fill(FLOOR));

  const border = cfg.borderThickness;
  const corridorWidth = cfg.corridorWidth;

  // 2) Add border walls
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < border || x >= W - border || y < border || y >= H - border) {
        grid[y][x] = WALL;
      }
    }
  }

  // 3) Choose start and exit
  const startX = border;
  const startY = border + Math.floor(rng() * (H - 2 * border));
  const exitX = W - 1 - border;
  const exitY = border + Math.floor(rng() * (H - 2 * border));

  grid[startY][startX] = FLOOR;
  grid[exitY][exitX] = FLOOR;

  const start = { x: startX, y: startY };
  const exit = { x: exitX, y: exitY };

  // 4) Build guaranteed main path (protected floor)
  const protectedFloor = Array(H)
    .fill(null)
    .map(() => Array(W).fill(false));

  const waypointCount = clamp(cfg.waypointCount, 2, 10);
  const waypoints = [];
  const step = (exitX - startX) / (waypointCount + 1);
  for (let i = 1; i <= waypointCount; i++) {
    const wx = Math.floor(startX + step * i + (rng() - 0.5) * 4);
    const wy = border + Math.floor(rng() * (H - 2 * border));
    waypoints.push({
      x: clamp(wx, border, W - 1 - border),
      y: clamp(wy, border, H - 1 - border),
    });
  }

  const pathPoints = [start, ...waypoints, exit];
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    stampCorridor(grid, a.x, a.y, b.x, b.y, corridorWidth, FLOOR);
    // Mark protected
    for (let dy = -corridorWidth; dy <= corridorWidth; dy++) {
      for (let dx = -corridorWidth; dx <= corridorWidth; dx++) {
        const gx = a.x + dx;
        const gy = a.y + dy;
        if (gx >= 0 && gx < W && gy >= 0 && gy < H && grid[gy][gx] === FLOOR) {
          protectedFloor[gy][gx] = true;
        }
      }
    }
    for (let dy = -corridorWidth; dy <= corridorWidth; dy++) {
      for (let dx = -corridorWidth; dx <= corridorWidth; dx++) {
        const gx = b.x + dx;
        const gy = b.y + dy;
        if (gx >= 0 && gx < W && gy >= 0 && gy < H && grid[gy][gx] === FLOOR) {
          protectedFloor[gy][gx] = true;
        }
      }
    }
  }

  // 5) Place blocker rectangles
  const innerW = W - 2 * border;
  const innerH = H - 2 * border;
  const minGap = typeof cfg.minGapBetweenBlocks === 'number' ? cfg.minGapBetweenBlocks : MIN_GAP_BETWEEN_BLOCKS;
  let placed = 0;

  for (let i = 0; i < cfg.blockerCount; i++) {
    let ok = false;
    for (let attempt = 0; attempt < cfg.maxAttemptsPerBlocker && !ok; attempt++) {
      const bw = Math.max(
        2,
        Math.floor(
          innerW * (cfg.blockerMinWFrac + rng() * (cfg.blockerMaxWFrac - cfg.blockerMinWFrac))
        )
      );
      const bh = Math.max(
        2,
        Math.floor(
          innerH * (cfg.blockerMinHFrac + rng() * (cfg.blockerMaxHFrac - cfg.blockerMinHFrac))
        )
      );
      const bx = border + Math.floor(rng() * Math.max(1, innerW - bw));
      const by = border + Math.floor(rng() * Math.max(1, innerH - bh));

      // Reject if overlaps protected floor
      let overlapsProtected = false;
      for (let dy = 0; dy < bh && !overlapsProtected; dy++) {
        for (let dx = 0; dx < bw && !overlapsProtected; dx++) {
          const gx = bx + dx;
          const gy = by + dy;
          if (gx < W && gy < H && protectedFloor[gy][gx]) overlapsProtected = true;
        }
      }
      if (overlapsProtected) continue;

      // Reject if within minGap of any existing WALL (keeps space between blocks >= minGap tiles)
      const checkX0 = Math.max(0, bx - minGap);
      const checkY0 = Math.max(0, by - minGap);
      const checkX1 = Math.min(W, bx + bw + minGap);
      const checkY1 = Math.min(H, by + bh + minGap);
      let tooCloseToWall = false;
      for (let gy = checkY0; gy < checkY1 && !tooCloseToWall; gy++) {
        for (let gx = checkX0; gx < checkX1 && !tooCloseToWall; gx++) {
          if (grid[gy][gx] === WALL) tooCloseToWall = true;
        }
      }
      if (tooCloseToWall) continue;

      // Temporarily paint as WALL
      const backup = [];
      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          const gx = bx + dx;
          const gy = by + dy;
          if (gx < W && gy < H) {
            backup.push({ x: gx, y: gy, v: grid[gy][gx] });
            grid[gy][gx] = WALL;
          }
        }
      }

      if (isExitReachable(grid, start, exit)) {
        ok = true;
        placed++;
      } else {
        for (const b of backup) {
          grid[b.y][b.x] = b.v;
        }
      }
    }
  }

  // 6) Add room stamps
  const protectedTiles = [];
  for (let y = border; y < H - border; y++) {
    for (let x = border; x < W - border; x++) {
      if (protectedFloor[y][x]) protectedTiles.push({ x, y });
    }
  }

  const roomCount = clamp(cfg.roomStampCount, 0, 20);
  for (let i = 0; i < roomCount && protectedTiles.length > 0; i++) {
    const idx = Math.floor(rng() * protectedTiles.length);
    const pt = protectedTiles[idx];
    const rw =
      cfg.roomMinSize +
      Math.floor(rng() * (cfg.roomMaxSize - cfg.roomMinSize + 1));
    const rh =
      cfg.roomMinSize +
      Math.floor(rng() * (cfg.roomMaxSize - cfg.roomMinSize + 1));
    const rx = clamp(pt.x - Math.floor(rw / 2), border, W - border - rw);
    const ry = clamp(pt.y - Math.floor(rh / 2), border, H - border - rh);

    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        const gx = rx + dx;
        const gy = ry + dy;
        if (gx >= border && gx < W - border && gy >= border && gy < H - border) {
          grid[gy][gx] = FLOOR;
        }
      }
    }
  }

  // 7) Final cleanup - fill disconnected pockets
  if (cfg.fillDisconnectedPockets) {
    const visited = floodFillReachable(grid, start);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (grid[y][x] === FLOOR && !visited[y][x]) {
          grid[y][x] = WALL;
        }
      }
    }
  }

  if (cfg.debug) {
    printAsciiMap(grid, start, exit);
  }

  return { grid, start, exit };
}

// -------- Preset configs --------

export const PRESET_SMALL = {
  W: 60,
  H: 30,
  config: {
    borderThickness: 1,
    corridorWidth: 12,
    waypointCount: 3,
    blockerCount: 8,
    roomStampCount: 2,
    roomMinSize: 2,
    roomMaxSize: 4,
  },
};

export const PRESET_MEDIUM = {
  W: 100,
  H: 45,
  config: {
    borderThickness: 1,
    corridorWidth: 12,
    waypointCount: 4,
    blockerCount: 12,
    roomStampCount: 3,
    roomMinSize: 2,
    roomMaxSize: 5,
  },
};

export const PRESET_LARGE = {
  W: 140,
  H: 60,
  config: {
    borderThickness: 2,
    corridorWidth: 12,
    waypointCount: 6,
    blockerCount: 20,
    roomStampCount: 5,
    roomMinSize: 3,
    roomMaxSize: 6,
  },
};
