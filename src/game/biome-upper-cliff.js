/**
 * Upper-half cliff decoration driven by 4×4 macro playable cells (not tile walls).
 * Gameplay bounds stay on the procedural grid; this module is visual-only (+ optional coarse inset metadata).
 *
 * Phases 1–2: playable layout + boundary + layout targets (world.upperCliff.*)
 * Phases 3–5: placeholders and/or rock-border sprites along macro edges (upper half only)
 * Phases 6–7: hooks / TODOs (gameplay inset, backdrop) — see UPPER_CLIFF_* constants
 */

import {
  buildRockBorderFromBounds,
  drawRockBorder,
} from './map-rock-border.js';

/** Archetype id for non-playable macro cells (must match maps.js BIOME_ARCHETYPE.EMPTY). */
const MACRO_EMPTY = 'empty';

// --- Phase 8: centralized tuning (adjust here) ---
export const UPPER_CLIFF_DEBUG_BOUNDARY = false;
export const UPPER_CLIFF_DEBUG_TARGETS = false;
/** Phase 3: draw colored strips from layout targets instead of/in addition to sprites */
export const UPPER_CLIFF_PLACEHOLDER_VISUALS = false;
/** Phase 6: coarse inset (px) applied as metadata only until collision consumes it */
export const UPPER_CLIFF_GAMEPLAY_INSET_TOP_PX = 0;
export const UPPER_CLIFF_GAMEPLAY_INSET_SIDE_PX = 0;
/** Phase 4: slightly tighter overlap along top spans (multiplier on advance inside map-rock-border) */
export const UPPER_CLIFF_TOP_SPAN_LENGTH_SCALE = 1;
const UPPER_TOP_PREVIEW_IDS = new Set([
  'top_left', 'top_right', 'top_5', 'top_6', 'top_flat_8', 'top_flat_9',
]);
const UPPER_SIDE_PREVIEW_IDS = new Set([
  'left_5', 'right_5',
  'left_flat_1', 'left_flat_2', 'left_flat_3', 'left_flat_4',
  'right_flat_1', 'right_flat_2', 'right_flat_3', 'right_flat_4',
]);
const UPPER_FULL_PREVIEW_IDS = new Set([
  ...UPPER_TOP_PREVIEW_IDS,
  ...UPPER_SIDE_PREVIEW_IDS,
  'bottom_left', 'bottom_4', 'bottom_5', 'bottom_6', 'bottom_7',
  'bottom_8', 'bottom_9', 'bottom_10', 'bottom_11', 'bottom_right',
]);
const TOP_STITCH_TEMPLATE_W = 1100;
const TOP_CLIFF_RAISE_PX = 120;
const GROUND_CAP_COLOR = '#6f6a47';
const GROUND_CAP_HEIGHT_PX = 88;
const GROUND_CAP_Y_OFFSET_PX = -32;

function macroCellSizePx(world, cols, rows) {
  return {
    cellW: world.width / cols,
    cellH: world.height / rows,
  };
}

function isPlayableArchetype(archetype) {
  return archetype && archetype !== MACRO_EMPTY;
}

/**
 * Phase 1 — Playable macro layout (source of truth mirror; cells come from archetypeGrid).
 */
export function buildPlayableMacroCellLayout(world, archetypeGrid) {
  const grid = archetypeGrid?.grid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0])) return null;
  const rows = grid.length;
  const cols = grid[0].length;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const archetype = grid[row][col];
      cells.push({
        row,
        col,
        playable: isPlayableArchetype(archetype),
        archetype,
      });
    }
  }
  return {
    rows,
    cols,
    cells,
    worldWidthPx: world.width,
    worldHeightPx: world.height,
  };
}

function dedupeCorners(corners) {
  const seen = new Set();
  let w = 0;
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    const key = `${c.role}|${Math.round(c.x)}|${Math.round(c.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    corners[w++] = c;
  }
  corners.length = w;
}

function playableAt(layout, col, row) {
  if (row < 0 || col < 0 || row >= layout.rows || col >= layout.cols) return false;
  return layout.cells[row * layout.cols + col].playable;
}

/**
 * Phase 1 — Exposed edges for upper cliff only (north / west / east of playable macro cells
 * that lie in the upper half: rows 0–1). South edges omitted (lower boundary handled later).
 */
export function computeUpperCliffExposedBoundary(world, layout) {
  if (!layout) return null;
  const { cellW, cellH } = macroCellSizePx(world, layout.cols, layout.rows);
  const yMid = world.height * 0.5;
  const topSegments = [];
  const leftSegments = [];
  const rightSegments = [];
  const corners = [];

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (!playableAt(layout, col, row)) continue;
      if (row > 1) continue;

      const x0 = col * cellW;
      const y0 = row * cellH;
      const x1 = (col + 1) * cellW;
      const y1 = (row + 1) * cellH;

      const northExposed = !playableAt(layout, col, row - 1);
      if (northExposed && y0 < yMid) {
        topSegments.push({
          x0,
          y0,
          x1,
          y1: y0,
          cellRow: row,
          cellCol: col,
        });
      }

      const westExposed = !playableAt(layout, col - 1, row);
      if (westExposed && y0 < yMid) {
        leftSegments.push({
          x0,
          y0,
          x1: x0,
          y1,
          cellRow: row,
          cellCol: col,
        });
      }

      const eastExposed = !playableAt(layout, col + 1, row);
      if (eastExposed && y0 < yMid) {
        rightSegments.push({
          x0: x1,
          y0,
          x1: x1,
          y1,
          cellRow: row,
          cellCol: col,
        });
      }

      if (northExposed && westExposed && y0 < yMid) {
        corners.push({
          role: 'outerCornerTL',
          x: x0,
          y: y0,
          cellRow: row,
          cellCol: col,
        });
      }
      if (northExposed && eastExposed && y0 < yMid) {
        corners.push({
          role: 'outerCornerTR',
          x: x1,
          y: y0,
          cellRow: row,
          cellCol: col,
        });
      }
    }
  }

  dedupeCorners(corners);

  mergeHorizontalRuns(topSegments);
  mergeVerticalRuns(leftSegments);
  mergeVerticalRuns(rightSegments);

  return {
    topSegments,
    leftSegments,
    rightSegments,
    corners,
    cellW,
    cellH,
    yMid,
  };
}

function mergeHorizontalRuns(segs) {
  segs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const out = [];
  const eps = 0.5;
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (
      prev &&
      Math.abs(prev.y0 - s.y0) < eps &&
      s.x0 <= prev.x1 + eps
    ) {
      prev.x1 = Math.max(prev.x1, s.x1);
    } else {
      out.push({ ...s });
    }
  }
  segs.length = 0;
  for (const s of out) segs.push(s);
}

function mergeVerticalRuns(segs) {
  segs.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  const out = [];
  const eps = 0.5;
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (
      prev &&
      Math.abs(prev.x0 - s.x0) < eps &&
      s.y0 <= prev.y1 + eps
    ) {
      prev.y1 = Math.max(prev.y1, s.y1);
    } else {
      out.push({ ...s });
    }
  }
  segs.length = 0;
  for (const s of out) segs.push(s);
}

/**
 * Phase 2 — Layout targets for art placement (world px, macro span level).
 */
export function buildUpperCliffLayoutTargets(boundary) {
  if (!boundary) return [];
  const out = [];
  const eps = 0.5;
  for (const s of boundary.topSegments) {
    const len = s.x1 - s.x0;
    if (len > eps) {
      out.push({
        role: 'top',
        x: s.x0,
        y: s.y0,
        length: len,
        cellRow: s.cellRow,
        cellCol: s.cellCol,
        x1: s.x1,
        y1: s.y0,
      });
    }
  }
  for (const s of boundary.leftSegments) {
    const len = s.y1 - s.y0;
    if (len > eps) {
      out.push({
        role: 'left',
        x: s.x0,
        y: s.y0,
        length: len,
        cellRow: s.cellRow,
        cellCol: s.cellCol,
        x1: s.x0,
        y1: s.y1,
      });
    }
  }
  for (const s of boundary.rightSegments) {
    const len = s.y1 - s.y0;
    if (len > eps) {
      out.push({
        role: 'right',
        x: s.x0,
        y: s.y0,
        length: len,
        cellRow: s.cellRow,
        cellCol: s.cellCol,
        x1: s.x0,
        y1: s.y1,
      });
    }
  }
  for (const c of boundary.corners) {
    out.push({
      role: c.role,
      x: c.x,
      y: c.y,
      length: 0,
      cellRow: c.cellRow,
      cellCol: c.cellCol,
      x1: c.x,
      y1: c.y,
    });
  }
  return out;
}

function boundarySegmentsToRockPath(boundary, tileSize) {
  const pad = tileSize || 32;
  const segments = [];
  for (const s of boundary.topSegments) {
    const len = s.x1 - s.x0;
    if (len < 1) continue;
    let x0 = s.x0;
    let x1 = s.x1;
    if (UPPER_CLIFF_TOP_SPAN_LENGTH_SCALE !== 1) {
      const extra = (len * (UPPER_CLIFF_TOP_SPAN_LENGTH_SCALE - 1)) * 0.5;
      x0 -= extra;
      x1 += extra;
    }
    segments.push({ role: 'top', x0, y0: s.y0, x1, y1: s.y0 });
  }
  for (const s of boundary.leftSegments) {
    if (s.y1 - s.y0 < 1) continue;
    segments.push({ role: 'left', x0: s.x0, y0: s.y0, x1: s.x0, y1: s.y1 });
  }
  for (const s of boundary.rightSegments) {
    if (s.y1 - s.y0 < 1) continue;
    segments.push({ role: 'right', x0: s.x0, y0: s.y0, x1: s.x0, y1: s.y1 });
  }
  const corners = [];
  for (const c of boundary.corners) {
    let cx = c.x;
    let cy = c.y;
    if (c.role === 'outerCornerTL') {
      cx = c.x + pad;
      cy = c.y + pad;
    } else if (c.role === 'outerCornerTR') {
      cx = c.x - pad;
      cy = c.y + pad;
    }
    corners.push({
      role: c.role,
      cx,
      cy,
      tileKey: `macro-${c.cellCol},${c.cellRow}-${c.role}`,
    });
  }
  return { segments, corners };
}

function computeUpperCliffBoundsFromBoundary(world, boundary) {
  const xs = [];
  const ys = [];
  for (const s of boundary.topSegments) {
    xs.push(s.x0, s.x1);
    ys.push(s.y0);
  }
  for (const s of boundary.leftSegments) {
    xs.push(s.x0);
    ys.push(s.y0, s.y1);
  }
  for (const s of boundary.rightSegments) {
    xs.push(s.x0);
    ys.push(s.y0, s.y1);
  }
  if (!xs.length || !ys.length) return null;
  const minX = Math.max(0, Math.min(...xs));
  const maxX = Math.min(world.width, Math.max(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxY = Math.min(world.height * 0.5, Math.max(...ys));
  const w = Math.max(64, maxX - minX);
  const h = Math.max(96, maxY - minY);
  return { x: minX, y: minY, w, h };
}

function buildTopPlacementsAcrossSpan(world, yTop, xLeft, xRight, seedBase = 1337) {
  const out = [];
  let cursor = xLeft;
  let iter = 0;
  while (cursor < xRight && iter < 24) {
    const sampleBounds = {
      x: cursor,
      y: Math.max(0, yTop - TOP_CLIFF_RAISE_PX),
      w: TOP_STITCH_TEMPLATE_W,
      h: Math.max(96, world.height - yTop - 32),
    };
    const sample = buildRockBorderFromBounds(sampleBounds, seedBase + iter);
    // Top stitch must remain top-only; side pieces are reserved for full island cliffs.
    const tops = (sample?.placements || []).filter((p) => UPPER_TOP_PREVIEW_IDS.has(p.spriteId));
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
      if (x + p.sw < xLeft || x > xRight) continue;
      out.push({ ...p, x });
    }
    cursor += Math.max(220, span - 120);
    iter++;
  }
  return out;
}

function buildTopRowIslandCliffs(world, layout, seedBase = 9001) {
  const out = [];
  for (const c of layout.cells) {
    if (!c.playable || c.row !== 0) continue;
    const x = c.col * (world.width / layout.cols);
    const y = c.row * (world.height / layout.rows);
    const w = world.width / layout.cols;
    const h = world.height / layout.rows;
    const islandBounds = { x: x + 32, y: y + 32, w: Math.max(64, w - 64), h: Math.max(64, h - 64) };
    const rock = buildRockBorderFromBounds(islandBounds, seedBase + c.col * 31 + c.row * 7);
    for (const p of rock?.placements || []) {
      if (!UPPER_FULL_PREVIEW_IDS.has(p.spriteId)) continue;
      out.push(p);
    }
  }
  return out;
}

function buildUpperCapRects(topPlacements) {
  const rects = [];
  if (!topPlacements?.length) return rects;
  for (const p of topPlacements) {
    const y = p.y + p.sh + GROUND_CAP_Y_OFFSET_PX;
    rects.push({
      x: p.x - 2,
      y,
      w: p.sw + 4,
      h: GROUND_CAP_HEIGHT_PX,
      color: GROUND_CAP_COLOR,
    });
  }
  return rects;
}

function buildOccludeTilesFromPlacements(world, placements) {
  const set = new Set();
  const ts = world.tileSize || 32;
  for (const p of placements || []) {
    const gx0 = Math.floor(p.x / ts);
    const gy0 = Math.floor(p.y / ts);
    const gx1 = Math.floor((p.x + p.sw - 1) / ts);
    const gy1 = Math.floor((p.y + p.sh - 1) / ts);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (gx < 0 || gy < 0) continue;
        set.add(`${gx},${gy}`);
      }
    }
  }
  return set;
}

function drawPlaceholderTargets(ctx, ox, oy, camera, targets) {
  const vl = camera.position.x;
  const vt = camera.position.y;
  const vr = vl + camera.viewWidth;
  const vb = vt + camera.viewHeight;
  ctx.save();
  ctx.font = '10px system-ui,sans-serif';
  for (const t of targets) {
    if (t.x > vr + 200 || t.x + t.length < vl - 200) continue;
    if (t.role === 'top' && t.length > 0) {
      ctx.fillStyle = 'rgba(45, 35, 30, 0.85)';
      ctx.fillRect(ox + t.x, oy + t.y - 14, t.length, 18);
      ctx.strokeStyle = '#8b7355';
      ctx.strokeRect(ox + t.x, oy + t.y - 14, t.length, 18);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('top', ox + t.x + 2, oy + t.y - 16);
    } else if ((t.role === 'left' || t.role === 'right') && t.length > 0) {
      ctx.fillStyle =
        t.role === 'left' ? 'rgba(55, 48, 40, 0.88)' : 'rgba(48, 42, 55, 0.88)';
      const w = 16;
      ctx.fillRect(
        ox + (t.role === 'left' ? t.x - w : t.x),
        oy + t.y,
        w,
        t.length
      );
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(t.role[0], ox + t.x + (t.role === 'left' ? -w + 2 : 4), oy + t.y + 10);
    } else if (t.role?.startsWith('outerCorner')) {
      ctx.fillStyle = 'rgba(120, 60, 40, 0.95)';
      ctx.beginPath();
      ctx.arc(ox + t.x, oy + t.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('C', ox + t.x - 4, oy + t.y + 3);
    }
  }
  ctx.restore();
}

function drawDebugBoundary(ctx, ox, oy, camera, boundary) {
  if (!boundary) return;
  const { topSegments, leftSegments, rightSegments, corners } = boundary;
  ctx.save();
  ctx.lineWidth = 2;
  for (const s of topSegments) {
    ctx.strokeStyle = 'cyan';
    ctx.beginPath();
    ctx.moveTo(ox + s.x0, oy + s.y0);
    ctx.lineTo(ox + s.x1, oy + s.y1);
    ctx.stroke();
  }
  for (const s of leftSegments) {
    ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    ctx.moveTo(ox + s.x0, oy + s.y0);
    ctx.lineTo(ox + s.x1, oy + s.y1);
    ctx.stroke();
  }
  for (const s of rightSegments) {
    ctx.strokeStyle = 'orange';
    ctx.beginPath();
    ctx.moveTo(ox + s.x0, oy + s.y0);
    ctx.lineTo(ox + s.x1, oy + s.y1);
    ctx.stroke();
  }
  for (const c of corners) {
    ctx.fillStyle = 'magenta';
    ctx.fillRect(ox + c.x - 3, oy + c.y - 3, 6, 6);
  }
  ctx.restore();
}

function drawDebugTargets(ctx, ox, oy, camera, targets) {
  if (!targets?.length) return;
  ctx.save();
  ctx.font = '9px monospace';
  for (const t of targets) {
    ctx.strokeStyle = 'rgba(0,255,200,0.7)';
    ctx.strokeRect(ox + t.x - 1, oy + t.y - 1, Math.max(t.length, 4) + 2, 6);
    ctx.fillStyle = 'rgba(226,232,240,0.95)';
    ctx.fillText(`${t.role}`, ox + t.x, oy + t.y - 4);
  }
  ctx.restore();
}

/**
 * Phases 1–5: build all upper-cliff data and optional rock placements on world.upperCliff
 */
export function buildUpperCliffForBiomeWorld(world, seed, options = {}) {
  const ag = world?.archetypeGrid;
  const layout = buildPlayableMacroCellLayout(world, ag);
  if (!layout) {
    world.upperCliff = null;
    return null;
  }

  const boundary = computeUpperCliffExposedBoundary(world, layout);
  const layoutTargets = buildUpperCliffLayoutTargets(boundary);
  const useSprites = options.useSprites !== false;
  let rockBorder = null;
  let capRects = [];
  let occludeTiles = null;
  if (useSprites) {
    const topPlacements = [];
    for (const seg of boundary.topSegments) {
      // only stitch the playable-row-1 top boundary (row0 playable cells get full island cliffs)
      if (seg.cellRow !== 1) continue;
      topPlacements.push(...buildTopPlacementsAcrossSpan(world, seg.y0, seg.x0, seg.x1, (seed ^ 0x51f4c1) + seg.cellCol * 13));
    }
    const islandPlacements = buildTopRowIslandCliffs(world, layout, seed ^ 0x77ab);
    const placements = [...topPlacements, ...islandPlacements];
    if (placements.length) {
      rockBorder = {
        image: buildRockBorderFromBounds({ x: 0, y: 0, w: 64, h: 64 }, seed)?.image || null,
        placements,
        occludeTiles: null,
        debugPoints: [],
      };
      capRects = buildUpperCapRects(topPlacements);
      occludeTiles = buildOccludeTilesFromPlacements(world, placements);
    }
  }

  world.upperCliff = {
    enabled: true,
    playableLayout: layout,
    boundary,
    layoutTargets,
    rockBorder,
    capRects,
    occludeTiles,
    visualMode: useSprites && rockBorder?.placements?.length ? 'sprites' : 'none',
    gameplayInsetPx: {
      top: UPPER_CLIFF_GAMEPLAY_INSET_TOP_PX,
      left: UPPER_CLIFF_GAMEPLAY_INSET_SIDE_PX,
      right: UPPER_CLIFF_GAMEPLAY_INSET_SIDE_PX,
    },
  };

  return world.upperCliff;
}

/**
 * Draw upper cliff: optional debug, placeholders, then rock sprites (pass 0 / 1).
 */
export function drawUpperCliffDecor(ctx, world, ox, oy, camera) {
  const uc = world?.upperCliff;
  if (!uc?.enabled) return;

  if (UPPER_CLIFF_DEBUG_BOUNDARY) {
    drawDebugBoundary(ctx, ox, oy, camera, uc.boundary);
  }
  if (UPPER_CLIFF_DEBUG_TARGETS) {
    drawDebugTargets(ctx, ox, oy, camera, uc.layoutTargets);
  }

  if (UPPER_CLIFF_PLACEHOLDER_VISUALS && uc.layoutTargets?.length) {
    drawPlaceholderTargets(ctx, ox, oy, camera, uc.layoutTargets);
  }

  if (uc.rockBorder?.placements?.length) {
    drawRockBorder(ctx, { rockBorder: uc.rockBorder }, ox, oy, camera, 0);
    drawRockBorder(ctx, { rockBorder: uc.rockBorder }, ox, oy, camera, 1);
  }
}

/** Draw cap in an early world pass so it stays beneath all other visible layers. */
export function drawUpperCliffGroundCap(ctx, world, ox, oy) {
  const uc = world?.upperCliff;
  if (!uc?.enabled || !uc.capRects?.length) return;
  ctx.save();
  for (const r of uc.capRects) {
    ctx.fillStyle = r.color || GROUND_CAP_COLOR;
    ctx.fillRect(Math.round(ox + r.x), Math.round(oy + r.y), Math.round(r.w), Math.round(r.h));
  }
  ctx.restore();
}

export function shouldUseUpperCliffForMap(mapDef, world) {
  if (!mapDef || !world?.archetypeGrid?.grid) return false;
  if (mapDef.upperCliff === false) return false;
  if (mapDef.upperCliff === true) return true;
  return mapDef.floorPattern === 'grass';
}
