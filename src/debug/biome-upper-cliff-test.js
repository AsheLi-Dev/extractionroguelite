import { buildRockBorderFromBounds } from '../game/map-rock-border.js';
import { ROCK_BORDER_IMAGE_SRC } from '../data/terrain-rock-border-atlas.js';
import { assetUrl } from '../utils.js';

const MACRO_COLS = 4;
const MACRO_ROWS = 4;
const MACRO_CELL_PX = 960; // 30 tiles * 32 px
const WORLD_W = MACRO_COLS * MACRO_CELL_PX;
const WORLD_H = MACRO_ROWS * MACRO_CELL_PX;
const SCALE = 0.2;
const TOP_CLIFF_RAISE_PX = 120;
const GROUND_CAP_COLOR = '#6f6a47';
const GROUND_CAP_HEIGHT_PX = 88;
const GROUND_CAP_PAD_X_PX = 32;
const GROUND_CAP_Y_OFFSET_PX = -32;

// Phase-1 target case requested:
// - only middle two macro rows are playable
// - first pass test: generate/display top cliff only
const PLAYABLE_ROWS = new Set([1, 2]);

const TOP_PREVIEW_IDS = new Set([
  'top_left',
  'top_right',
  'top_5',
  'top_6',
  'top_flat_8',
  'top_flat_9',
]);
const RANDOM_TOP_PLAYABLE_COL = Math.floor(Math.random() * MACRO_COLS);

function isPlayableCell(row, col) {
  if (PLAYABLE_ROWS.has(row)) return true;
  if (row === 0 && col === RANDOM_TOP_PLAYABLE_COL) return true;
  return false;
}

function buildTopPlacementsAcrossBoundary(cliffBounds, seedBase = 1337) {
  const out = [];
  const targetLeft = cliffBounds.x;
  const targetRight = cliffBounds.x + cliffBounds.w;
  const templateW = 1100;
  let cursor = targetLeft;
  let iter = 0;

  while (cursor < targetRight && iter < 16) {
    const sample = buildRockBorderFromBounds(
      { x: cursor, y: cliffBounds.y, w: templateW, h: cliffBounds.h },
      seedBase + iter
    );
    const tops = (sample?.placements || []).filter((p) => TOP_PREVIEW_IDS.has(p.spriteId));
    if (!tops.length) break;

    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of tops) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.sw);
    }
    const span = Math.max(1, maxX - minX);
    const shiftX = cursor - minX;

    for (const p of tops) {
      const x = p.x + shiftX;
      if (x + p.sw < targetLeft || x > targetRight) continue;
      out.push({ ...p, x });
    }

    // Keep chains stitched with mild overlap so seams are hidden.
    cursor += Math.max(220, span - 120);
    iter++;
  }

  return out;
}

function cutTopBoundaryForVerticalPlayableConnection(placements, col) {
  const cellLeft = col * MACRO_CELL_PX;
  const cellRight = (col + 1) * MACRO_CELL_PX;
  const pad = 48;
  const cutLeft = cellLeft + pad;
  const cutRight = cellRight - pad;
  return placements.filter((p) => {
    const px0 = p.x;
    const px1 = p.x + p.sw;
    // Remove any top piece that touches the connection window between row0 playable and row1 playable.
    return px1 <= cutLeft || px0 >= cutRight;
  });
}

function drawMacroGrid(ctx) {
  ctx.fillStyle = '#0f1f1a';
  ctx.fillRect(0, 0, WORLD_W * SCALE, WORLD_H * SCALE);

  for (let row = 0; row < MACRO_ROWS; row++) {
    for (let col = 0; col < MACRO_COLS; col++) {
      const x = col * MACRO_CELL_PX * SCALE;
      const y = row * MACRO_CELL_PX * SCALE;
      const w = MACRO_CELL_PX * SCALE;
      const h = MACRO_CELL_PX * SCALE;
      ctx.fillStyle = isPlayableCell(row, col) ? 'rgba(111,117,89,0.75)' : 'rgba(14,22,35,0.75)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }
}

function run() {
  const canvas = document.getElementById('biome-upper-cliff-test-canvas');
  const status = document.getElementById('biome-upper-cliff-test-status');
  if (!canvas) return;

  canvas.width = Math.round(WORLD_W * SCALE);
  canvas.height = Math.round(WORLD_H * SCALE);
  const ctx = canvas.getContext('2d');
  drawMacroGrid(ctx);

  // Top boundary of playable footprint (row 1 starts at y=960).
  const cliffBounds = {
    x: 32,
    y: Math.max(0, MACRO_CELL_PX - TOP_CLIFF_RAISE_PX),
    w: WORLD_W - 64,
    h: WORLD_H - MACRO_CELL_PX - 32,
  };

  const topPlacementsRaw = buildTopPlacementsAcrossBoundary(cliffBounds, 1337);
  const topPlacements = cutTopBoundaryForVerticalPlayableConnection(
    topPlacementsRaw,
    RANDOM_TOP_PLAYABLE_COL
  );
  if (!topPlacements.length) {
    if (status) status.textContent = 'No placements generated.';
    return;
  }

  const topCellBounds = {
    x: RANDOM_TOP_PLAYABLE_COL * MACRO_CELL_PX,
    y: 0,
    w: MACRO_CELL_PX,
    h: MACRO_CELL_PX,
  };
  const islandCliffBounds = {
    x: topCellBounds.x + 32,
    y: topCellBounds.y + 32,
    w: topCellBounds.w - 64,
    h: topCellBounds.h - 64,
  };
  const islandRock = buildRockBorderFromBounds(islandCliffBounds, 9447 + RANDOM_TOP_PLAYABLE_COL);

  const atlasProbe = buildRockBorderFromBounds(cliffBounds, 1337);
  const img = atlasProbe?.image || new Image();
  if (!atlasProbe?.image) img.src = assetUrl(ROCK_BORDER_IMAGE_SRC);

  const draw = () => {
    drawMacroGrid(ctx);
    // Dynamic ground cap under each top piece so it follows cliff contour.
    let cliffMinX = Infinity;
    let cliffMaxX = -Infinity;
    for (const p of topPlacements) {
      cliffMinX = Math.min(cliffMinX, p.x);
      cliffMaxX = Math.max(cliffMaxX, p.x + p.sw);
    }
    const capX = Math.round(Math.max(cliffBounds.x, cliffMinX - GROUND_CAP_PAD_X_PX));
    const capRight = Math.round(Math.min(cliffBounds.x + cliffBounds.w, cliffMaxX + GROUND_CAP_PAD_X_PX));
    const capW = Math.max(1, capRight - capX);
    ctx.fillStyle = GROUND_CAP_COLOR;
    // First paint a coarse base strip for full coverage.
    const baseBottom = Math.max(...topPlacements.map((p) => p.y + p.sh));
    ctx.fillRect(Math.round(capX * SCALE), Math.round((baseBottom + GROUND_CAP_Y_OFFSET_PX) * SCALE), Math.round(capW * SCALE), Math.round((GROUND_CAP_HEIGHT_PX * 0.6) * SCALE));
    // Then add per-piece cap columns that track each sprite's bottom.
    for (const p of topPlacements) {
      const py = p.y + p.sh + GROUND_CAP_Y_OFFSET_PX;
      ctx.fillRect(
        Math.round((p.x - 2) * SCALE),
        Math.round(py * SCALE),
        Math.round((p.sw + 4) * SCALE),
        Math.round(GROUND_CAP_HEIGHT_PX * SCALE)
      );
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const p of topPlacements) {
      ctx.drawImage(
        img,
        p.sx,
        p.sy,
        p.sw,
        p.sh,
        Math.round(p.x * SCALE),
        Math.round(p.y * SCALE),
        p.sw * SCALE,
        p.sh * SCALE
      );
    }
    // Full preview-style cliff around the random top-row playable cell.
    for (const p of islandRock?.placements || []) {
      ctx.drawImage(
        img,
        p.sx,
        p.sy,
        p.sw,
        p.sh,
        Math.round(p.x * SCALE),
        Math.round(p.y * SCALE),
        p.sw * SCALE,
        p.sh * SCALE
      );
    }
    ctx.restore();
    if (status) {
      status.textContent =
        `4x4 macro test: rows 1-2 playable + random top cell c${RANDOM_TOP_PLAYABLE_COL}; stitched top boundary and full preview cliff around that top cell.`;
    }
  };

  if (img.complete && img.naturalWidth > 0) draw();
  else {
    img.onload = draw;
    img.onerror = () => {
      if (status) status.textContent = `Failed to load atlas: ${ROCK_BORDER_IMAGE_SRC}`;
    };
  }
}

run();

