const MINIMAP_WIDTH = 176;
const MINIMAP_HEIGHT = 104;

let minimapCanvas = null;
let minimapCtx = null;
let worldRef = null;
let staticCanvas = null;
let staticCtx = null;

function ensureStaticCanvas() {
  if (!staticCanvas) {
    staticCanvas = document.createElement("canvas");
  }
  staticCanvas.width = MINIMAP_WIDTH;
  staticCanvas.height = MINIMAP_HEIGHT;
  staticCtx = staticCanvas.getContext("2d");
}

export function initMinimap() {
  minimapCanvas = document.getElementById("minimap-canvas");
  if (!minimapCanvas) return;
  minimapCanvas.width = MINIMAP_WIDTH;
  minimapCanvas.height = MINIMAP_HEIGHT;
  minimapCtx = minimapCanvas.getContext("2d");
}

export function layoutMinimap(canvasLeft, canvasTop, scale) {
  if (!minimapCanvas) return;
  const margin = 12;
  const displayWidth = MINIMAP_WIDTH * scale;
  const displayHeight = MINIMAP_HEIGHT * scale;
  minimapCanvas.style.position = "fixed";
  minimapCanvas.style.width = `${displayWidth}px`;
  minimapCanvas.style.height = `${displayHeight}px`;
  minimapCanvas.style.left = `${Math.round(canvasLeft + margin)}px`;
  minimapCanvas.style.top = `${Math.round(canvasTop + margin)}px`;
}

export function setMinimapWorld(world) {
  worldRef = world || null;
  if (!minimapCtx || !worldRef) return;

  ensureStaticCanvas();

  const ctx = staticCtx;
  ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  // Background
  ctx.fillStyle = "rgba(15, 23, 42, 1)";
  ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  const worldWidth = worldRef.width || 1;
  const worldHeight = worldRef.height || 1;

  // Prefer tileWallRects for walls; fallback to tileGrid if needed
  const walls = Array.isArray(worldRef.tileWallRects) && worldRef.tileWallRects.length > 0
    ? worldRef.tileWallRects
    : null;

  if (walls) {
    ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
    for (const w of walls) {
      const nx = (w.x || 0) / worldWidth;
      const ny = (w.y || 0) / worldHeight;
      const nw = (w.w || 0) / worldWidth;
      const nh = (w.h || 0) / worldHeight;
      if (nw <= 0 || nh <= 0) continue;
      const sx = nx * MINIMAP_WIDTH;
      const sy = ny * MINIMAP_HEIGHT;
      const sw = Math.max(1, nw * MINIMAP_WIDTH);
      const sh = Math.max(1, nh * MINIMAP_HEIGHT);
      ctx.fillRect(sx, sy, sw, sh);
    }
  } else if (Array.isArray(worldRef.tileGrid) && worldRef.tileGrid.length > 0) {
    const grid = worldRef.tileGrid;
    const rows = grid.length;
    const cols = grid[0].length || 1;
    ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (grid[gy][gx] !== 1) continue;
        const nx = gx / cols;
        const ny = gy / rows;
        const sx = nx * MINIMAP_WIDTH;
        const sy = ny * MINIMAP_HEIGHT;
        const sw = Math.max(1, MINIMAP_WIDTH / cols);
        const sh = Math.max(1, MINIMAP_HEIGHT / rows);
        ctx.fillRect(sx, sy, sw, sh);
      }
    }
  }
}

export function renderMinimap(player, camera, miniboss) {
  if (!minimapCtx || !worldRef) return;

  const ctx = minimapCtx;
  ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  if (staticCanvas) {
    ctx.drawImage(staticCanvas, 0, 0);
  }

  const worldWidth = worldRef.width || 1;
  const worldHeight = worldRef.height || 1;

  // Camera viewport rectangle (optional)
  if (camera && camera.viewWidth && camera.viewHeight) {
    const vx = (camera.position.x || 0) / worldWidth;
    const vy = (camera.position.y || 0) / worldHeight;
    const vw = camera.viewWidth / worldWidth;
    const vh = camera.viewHeight / worldHeight;
    ctx.strokeStyle = "rgba(34, 197, 94, 0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      vx * MINIMAP_WIDTH,
      vy * MINIMAP_HEIGHT,
      Math.max(1, vw * MINIMAP_WIDTH),
      Math.max(1, vh * MINIMAP_HEIGHT)
    );
  }

  // Miniboss marker (shown once revealed by game)
  if (miniboss && typeof miniboss.x === "number" && typeof miniboss.y === "number") {
    const mx = (miniboss.x / worldWidth) * MINIMAP_WIDTH;
    const my = (miniboss.y / worldHeight) * MINIMAP_HEIGHT;
    const r = 4;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#e11d48"; // pink/red diamond
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  // Player marker
  if (player && player.position) {
    const px = (player.position.x + (player.size || 0) / 2) / worldWidth;
    const py = (player.position.y + (player.size || 0) / 2) / worldHeight;
    const sx = Math.max(0, Math.min(1, px)) * MINIMAP_WIDTH;
    const sy = Math.max(0, Math.min(1, py)) * MINIMAP_HEIGHT;
    const r = 3;
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

