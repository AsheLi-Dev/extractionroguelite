import { mulberry32 } from '../map-gen-blockers.js';
import {
  buildRockBorderFromBounds,
  ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS,
} from '../game/map-rock-border.js';
import { ROCK_BORDER_IMAGE_SRC, ROCK_BORDER_ATLAS } from '../data/terrain-rock-border-atlas.js';
import {
  buildIslandRow0UpperMaskRects,
  buildRow01BoundaryMidStripMaskRects,
  buildRow01TopSpriteBottomToRow1BottomClipRects,
  intersectRectWithHorizontalBandY,
  UPPER_CLIFF_MASK_DESIGN_ROW01_MIDSTRIP_DOWN_PX,
  UPPER_CLIFF_MID_STRIP_FILL_HEX,
} from '../game/upper-cliff-ground-mask.js';
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

/** Row 1 “core” playable columns (inclusive). Left/right wings of row 0–1 cliff use capped ends. */
const ROW1_PLAYABLE_MIN_COL = 1;
const ROW1_PLAYABLE_MAX_COL = 2;

const TOP_PREVIEW_IDS = new Set([
  'top_left',
  'top_right',
  'top_5',
  'top_6',
  'top_flat_8',
  'top_flat_9',
]);

const CLIFF_TOP_FLAT_IDS = new Set(['top_flat_8', 'top_flat_9']);
const CLIFF_TOP_SLOPE_DOWN_ID = 'top_5';
const CLIFF_TOP_SLOPE_UP_ID = 'top_6';
/** When RNG picks a slope: (656) × 3; flats do not advance `idx`. */
const ROW01_SLOPE_PATTERN_656x3 = [
  CLIFF_TOP_SLOPE_UP_ID,
  CLIFF_TOP_SLOPE_DOWN_ID,
  CLIFF_TOP_SLOPE_UP_ID,
  CLIFF_TOP_SLOPE_UP_ID,
  CLIFF_TOP_SLOPE_DOWN_ID,
  CLIFF_TOP_SLOPE_UP_ID,
  CLIFF_TOP_SLOPE_UP_ID,
  CLIFF_TOP_SLOPE_DOWN_ID,
  CLIFF_TOP_SLOPE_UP_ID,
];

const RANDOM_TOP_PLAYABLE_COL = Math.floor(Math.random() * MACRO_COLS);
/** Matches game `UPPER_CLIFF_LEFT_FIRST_TOP_INTO_PLAYABLE_COL_PX` (design px at 32 tile). */
const LEFT_FIRST_TOP_INTO_PLAYABLE_COL_PX = 160;

function isPlayableCell(row, col) {
  if (row === 2) return true;
  if (row === 1) return col >= ROW1_PLAYABLE_MIN_COL && col <= ROW1_PLAYABLE_MAX_COL;
  if (row === 0 && col === RANDOM_TOP_PLAYABLE_COL) return true;
  return false;
}

/** Same as game: center-X of rightmost row-0 island `bottom_right` piece. */
function rightWingStartXFromRow0IslandBottomRightPieceTest(seedBase = 9001) {
  const inset = 32;
  const minInner = Math.max(2 * inset, 64);
  let rightmostCenter = -Infinity;
  for (let col = 0; col < MACRO_COLS; col++) {
    if (!isPlayableCell(0, col)) continue;
    const islandBounds = {
      x: col * MACRO_CELL_PX + inset,
      y: inset,
      w: Math.max(minInner, MACRO_CELL_PX - 2 * inset),
      h: Math.max(minInner, MACRO_CELL_PX - 2 * inset),
    };
    const islandSeed = seedBase + col * 31;
    const rock = buildRockBorderFromBounds(islandBounds, islandSeed, ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS);
    for (const p of rock?.placements || []) {
      if (p.spriteId !== 'bottom_right') continue;
      rightmostCenter = Math.max(rightmostCenter, p.x + p.sw * 0.5);
    }
  }
  return rightmostCenter > -Infinity ? rightmostCenter : null;
}

/**
 * Same horizontal chaining as map-rock-border computeTopPlacements for top sprites only.
 */
function computeTopPlacementsLocal(sequenceIds) {
  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const byId = new Map([...top, ...topFlat].map((sp) => [sp.id, sp]));
  const placements = [];
  let x = 0;
  for (const id of sequenceIds) {
    const sprite = byId.get(id);
    if (!sprite) continue;
    let y = 0;
    if (placements.length) {
      const prev = placements[placements.length - 1];
      const prevId = prev.sprite.id;
      const prevBottom = prev.y + prev.sprite.h;
      const nextIsFlat = CLIFF_TOP_FLAT_IDS.has(sprite.id);
      const prevIsFlat = CLIFF_TOP_FLAT_IDS.has(prevId);
      if (sprite.id === CLIFF_TOP_SLOPE_DOWN_ID) y = prevBottom - sprite.h + 32;
      else if (prevId === CLIFF_TOP_SLOPE_DOWN_ID) y = prevBottom - sprite.h + 32;
      else if (sprite.id === CLIFF_TOP_SLOPE_UP_ID && prevIsFlat) y = prevBottom - sprite.h - 32;
      else if (prevId === CLIFF_TOP_SLOPE_UP_ID && nextIsFlat) y = prevBottom - sprite.h;
      else if (prevId === CLIFF_TOP_SLOPE_UP_ID && sprite.id === CLIFF_TOP_SLOPE_UP_ID) {
        y = prevBottom - sprite.h - 32;
      } else y = prevBottom - sprite.h;
    }
    placements.push({ sprite, x, y });
    x += sprite.w;
  }
  const minY = placements.length ? Math.min(...placements.map((p) => p.y)) : 0;
  return { placements, width: x, minY };
}

function chainToRockPlacements(chain, anchorX, yAlign) {
  return chain.placements.map((p) => ({
    spriteId: p.sprite.id,
    sx: p.sprite.x,
    sy: p.sprite.y,
    sw: p.sprite.w,
    sh: p.sprite.h,
    x: Math.round(anchorX + p.x),
    y: Math.round(yAlign + (p.y - chain.minY)),
  }));
}

function makePlacementFromSprite(sp, x, y) {
  return {
    spriteId: sp.id,
    sx: sp.x,
    sy: sp.y,
    sw: sp.w,
    sh: sp.h,
    x: Math.round(x),
    y: Math.round(y),
  };
}

/** Horizontal overlap with any playable macro cell in rows 0–1 (matches game `topPieceOverlapsPlayableMacroPx`). */
function topPieceOverlapsPlayableMacroPxTest(x0, x1) {
  const xl = Math.min(x0, x1);
  const xr = Math.max(x0, x1);
  for (let row = 0; row <= 1; row++) {
    for (let col = 0; col < MACRO_COLS; col++) {
      if (!isPlayableCell(row, col)) continue;
      const cl = col * MACRO_CELL_PX;
      const cr = (col + 1) * MACRO_CELL_PX;
      if (xr > cl && xl < cr) return true;
    }
  }
  return false;
}

function pickDifferentRandomIdRow01(ids, prevId, rng) {
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0] === prevId ? null : ids[0];
  let pick = ids[Math.floor(rng() * ids.length)];
  if (pick === prevId) {
    const alt = ids.filter((id) => id !== prevId);
    if (!alt.length) return null;
    pick = alt[Math.floor(rng() * alt.length)];
  }
  return pick;
}

/** Mirrors game `snapYLeftwardPiece` at 32px tile (fixed 32px offsets). */
function snapYLeftwardPieceTest(prevId, prevBottom, currentId, spriteH) {
  const off32 = 32;
  const isFlat = (id) => CLIFF_TOP_FLAT_IDS.has(id);
  if (prevId === CLIFF_TOP_SLOPE_UP_ID && currentId === CLIFF_TOP_SLOPE_DOWN_ID) {
    return prevBottom - spriteH;
  }
  if (prevId === CLIFF_TOP_SLOPE_UP_ID && currentId === CLIFF_TOP_SLOPE_UP_ID) {
    return prevBottom - spriteH + off32;
  }
  if (isFlat(prevId)) {
    if (isFlat(currentId)) return prevBottom - spriteH;
    if (currentId === CLIFF_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH - off32;
    if (currentId === CLIFF_TOP_SLOPE_UP_ID) return prevBottom - spriteH;
  }
  if (prevId === CLIFF_TOP_SLOPE_DOWN_ID) {
    return prevBottom - spriteH - off32;
  }
  if (prevId === CLIFF_TOP_SLOPE_UP_ID) {
    if (isFlat(currentId)) return prevBottom - spriteH + off32;
    if (currentId === CLIFF_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH;
  }
  return prevBottom - spriteH;
}

/** Matches rock-border-atlas-debug / `map-rock-border` `computeTopPlacements` (left → right). */
function snapYTopRightwardLikeAtlasTest(prevId, prevBottom, currentId, spriteH) {
  const off32 = 32;
  if (prevId === CLIFF_TOP_SLOPE_UP_ID && currentId === CLIFF_TOP_SLOPE_UP_ID) {
    return prevBottom - spriteH - off32;
  }
  const nextIsFlat = CLIFF_TOP_FLAT_IDS.has(currentId);
  const prevIsFlat = CLIFF_TOP_FLAT_IDS.has(prevId);
  if (currentId === CLIFF_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH + off32;
  if (prevId === CLIFF_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH + off32;
  if (currentId === CLIFF_TOP_SLOPE_UP_ID && prevIsFlat) return prevBottom - spriteH - off32;
  if (prevId === CLIFF_TOP_SLOPE_UP_ID && nextIsFlat) return prevBottom - spriteH;
  return prevBottom - spriteH;
}

function pickNextRow01TopId(prevId, flatIds, byId, rng, slopeState) {
  if (rng() < 0.32) {
    const id = ROW01_SLOPE_PATTERN_656x3[slopeState.idx % ROW01_SLOPE_PATTERN_656x3.length];
    if (byId.get(id)) {
      slopeState.idx = (slopeState.idx + 1) % ROW01_SLOPE_PATTERN_656x3.length;
      return id;
    }
  }
  return pickDifferentRandomIdRow01(flatIds, prevId, rng) || flatIds[0];
}

/**
 * One non-overlapping top strip: `top_left` → flats/slopes with local snap Y, then `top_right` when the next
 * piece would overlap playable rows 0–1 or leave `[spanMinX, spanMaxX]`. Same as game
 * `buildSequentialRow01TopStrip`.
 */
function buildSequentialRow01TopStripTest(spanMinX, spanMaxX, seed, yAlign, worldWidthPx, options = {}) {
  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const byId = new Map([...top, ...topFlat].map((sp) => [sp.id, sp]));
  const flatIds = (topFlat || []).map((s) => s.id).filter((id) => byId.has(id));
  const tl = byId.get('top_left');
  const tr = byId.get('top_right');
  if (!tl || !tr || !flatIds.length) return [];

  const spanW = spanMaxX - spanMinX;
  if (spanW < tl.w + tr.w - 0.5) return [];

  const cxOpt = options.firstTopLeftCenterWorldX;
  let anchorX =
    typeof cxOpt === 'number' && Number.isFinite(cxOpt) ? cxOpt - tl.w / 2 : spanMinX;
  anchorX = Math.max(spanMinX, Math.min(anchorX, spanMaxX - tl.w));

  const rng = mulberry32((seed ^ 0x5e77f019) >>> 0);
  const slopeState = { idx: 0 };
  /** @type {string[]} */
  let ids = ['top_left'];
  let guard = 0;
  while (ids[ids.length - 1] !== 'top_right' && guard++ < 600) {
    const plNow = chainToRockPlacements(computeTopPlacementsLocal(ids), anchorX, yAlign);
    const edgeNow = plNow.length ? Math.max(...plNow.map((p) => p.x + p.sw)) : anchorX;
    if (edgeNow + tr.w > spanMaxX + 0.5) {
      ids.push('top_right');
      break;
    }
    const prevId = ids[ids.length - 1];
    const nextId = pickNextRow01TopId(prevId, flatIds, byId, rng, slopeState);
    const testIds = [...ids, nextId];
    const testPl = chainToRockPlacements(computeTopPlacementsLocal(testIds), anchorX, yAlign);
    const last = testPl[testPl.length - 1];
    if (last.x + last.sw + tr.w > spanMaxX + 0.5) {
      ids.push('top_right');
      break;
    }
    if (topPieceOverlapsPlayableMacroPxTest(last.x, last.x + last.sw)) {
      ids.push('top_right');
      break;
    }
    ids = testIds;
  }
  if (ids[ids.length - 1] !== 'top_right') ids.push('top_right');
  return chainToRockPlacements(computeTopPlacementsLocal(ids), anchorX, yAlign);
}

/**
 * Row 0–1 wing: sequential top strip only (no overlapping chunk stitch).
 * @param {{ firstTopLeftCenterWorldX?: number }} [wingOpts]
 */
function buildWingPlacements(partLeft, partRight, cliffY, cliffH, seed, yAlign, wingOpts = {}) {
  void cliffY;
  void cliffH;
  return buildSequentialRow01TopStripTest(partLeft, partRight, seed, yAlign, WORLD_W, {
    firstTopLeftCenterWorldX: wingOpts.firstTopLeftCenterWorldX,
  });
}

/** Horizontal span of row-1 playable macro columns (world px), [x0, x1) at row0–row1 boundary. */
function getPlayableGridXSpan() {
  const x0 = ROW1_PLAYABLE_MIN_COL * MACRO_CELL_PX;
  const x1 = (ROW1_PLAYABLE_MAX_COL + 1) * MACRO_CELL_PX;
  return { x0, x1 };
}

/**
 * Build top cliff along row 0–1: left wing | middle | right wing (sequential top strip each; no overlap).
 */
function buildRow01BorderTriPart(cliffBounds, seed) {
  // Column 0: right-edge pair only (mirrors game). Col ≠ 0: left anchor + leftward chain; col ≠ 3: right pair.
  let row0Col = null;
  for (let col = 0; col < MACRO_COLS; col++) {
    if (isPlayableCell(0, col)) {
      row0Col = col;
      break;
    }
  }
  if (row0Col == null) return [];

  const cellLeft = row0Col * MACRO_CELL_PX;
  const cellBottom = MACRO_CELL_PX;
  /** Matches game `upperPx(world, 20)` at 32px tile reference. */
  const cornerRaisePx = 20;

  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const byId = new Map([...top, ...topFlat].map((sp) => [sp.id, sp]));
  const flatIds = (topFlat || []).map((s) => s.id).filter((id) => byId.has(id));
  const topRight = byId.get('top_right');
  const topLeft = byId.get('top_left');
  const flat = byId.get('top_flat_8') || topFlat[0];
  if (!flat || !flatIds.length) return [];

  const chain = [];

  if (row0Col !== 0) {
    if (!topRight) return [];
    const rightX = Math.max(cliffBounds.x, cellLeft);
    const rightY = cellBottom - cornerRaisePx;
    const flatX = rightX - flat.w;
    const flatY = rightY;
    chain.push(
      makePlacementFromSprite(flat, flatX, flatY),
      makePlacementFromSprite(topRight, rightX, rightY)
    );

    const rng = mulberry32((seed ^ (row0Col * 131)) >>> 0);
    const slopeState = { idx: 0 };
    let guard = 0;
    while (chain[0].x > 0 && guard++ < 600) {
      const prev = chain[0];
      const prevBottom = prev.y + prev.sh;
      let nextId = pickNextRow01TopId(prev.spriteId, flatIds, byId, rng, slopeState);
      const sp = byId.get(nextId);
      if (!sp) break;
      const nx = prev.x - sp.w;
      const ny = snapYLeftwardPieceTest(prev.spriteId, prevBottom, nextId, sp.h);
      chain.unshift(makePlacementFromSprite(sp, nx, ny));
    }
  }

  if (row0Col !== 3 && topLeft) {
    const cellRight = (row0Col + 1) * MACRO_CELL_PX;
    const tlx = cellRight - topLeft.w;
    const tly = cellBottom - cornerRaisePx;
    chain.push(makePlacementFromSprite(topLeft, tlx, tly));
    const flatAfterTopLeft = byId.get('top_flat_9') || flat;
    if (flatAfterTopLeft) {
      chain.push(
        makePlacementFromSprite(
          flatAfterTopLeft,
          tlx + topLeft.w,
          tly + topLeft.h - flatAfterTopLeft.h
        )
      );
    }

    let rightMost = chain[chain.length - 1];
    const rngRight = mulberry32((seed ^ 0xface ^ (row0Col * 17)) >>> 0);
    const slopeStateRight = { idx: 0 };
    let guardRight = 0;
    // Stop after 600 steps (no world-width cap).
    while (guardRight++ < 600) {
      const prevId = rightMost.spriteId;
      const prevBottom = rightMost.y + rightMost.sh;
      let nextId = pickNextRow01TopId(prevId, flatIds, byId, rngRight, slopeStateRight);
      const sp = byId.get(nextId);
      if (!sp) break;
      const nx = rightMost.x + rightMost.sw;
      const ny = snapYTopRightwardLikeAtlasTest(prevId, prevBottom, nextId, sp.h);
      chain.push(makePlacementFromSprite(sp, nx, ny));
      rightMost = chain[chain.length - 1];
    }
  }

  return chain;
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

  const cliffBounds = {
    x: 32,
    y: Math.max(0, MACRO_CELL_PX - TOP_CLIFF_RAISE_PX),
    w: WORLD_W - 64,
    h: WORLD_H - MACRO_CELL_PX - 32,
  };

  const topPlacements = buildRow01BorderTriPart(cliffBounds, 1337);

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
  const islandRock = buildRockBorderFromBounds(
    islandCliffBounds,
    9447 + RANDOM_TOP_PLAYABLE_COL,
    ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS
  );

  const atlasProbe = buildRockBorderFromBounds(cliffBounds, 1337);
  const img = atlasProbe?.image || new Image();
  if (!atlasProbe?.image) img.src = assetUrl(ROCK_BORDER_IMAGE_SRC);

  const draw = () => {
    drawMacroGrid(ctx);
    const row01MidStripRects = buildRow01BoundaryMidStripMaskRects(topPlacements);
    ctx.fillStyle = UPPER_CLIFF_MID_STRIP_FILL_HEX;
    for (const r of row01MidStripRects) {
      ctx.fillRect(
        Math.round(r.x * SCALE),
        Math.round(r.y * SCALE),
        Math.round(r.w * SCALE),
        Math.round(r.h * SCALE)
      );
    }
    const islandPl = islandRock?.placements || [];
    let cliffMinX = Infinity;
    let cliffMaxX = -Infinity;
    for (const p of topPlacements) {
      cliffMinX = Math.min(cliffMinX, p.x);
      cliffMaxX = Math.max(cliffMaxX, p.x + p.sw);
    }
    for (const p of islandPl) {
      cliffMinX = Math.min(cliffMinX, p.x);
      cliffMaxX = Math.max(cliffMaxX, p.x + p.sw);
    }
    const hasSpan = Number.isFinite(cliffMinX) && Number.isFinite(cliffMaxX);
    if (hasSpan) {
      const capX = Math.round(Math.max(cliffBounds.x, cliffMinX - GROUND_CAP_PAD_X_PX));
      const capRight = Math.round(Math.min(cliffBounds.x + cliffBounds.w, cliffMaxX + GROUND_CAP_PAD_X_PX));
      const capW = Math.max(1, capRight - capX);
      ctx.fillStyle = GROUND_CAP_COLOR;
      const bottoms = [
        ...topPlacements.map((p) => p.y + p.sh),
        ...islandPl.map((p) => p.y + p.sh),
      ];
      const baseBottom = bottoms.length ? Math.max(...bottoms) : cliffBounds.y;
      ctx.fillRect(
        Math.round(capX * SCALE),
        Math.round((baseBottom + GROUND_CAP_Y_OFFSET_PX) * SCALE),
        Math.round(capW * SCALE),
        Math.round((GROUND_CAP_HEIGHT_PX * 0.6) * SCALE)
      );
      for (const p of topPlacements) {
        const py = p.y + p.sh + GROUND_CAP_Y_OFFSET_PX;
        ctx.fillRect(
          Math.round((p.x - 2) * SCALE),
          Math.round(py * SCALE),
          Math.round((p.sw + 4) * SCALE),
          Math.round(GROUND_CAP_HEIGHT_PX * SCALE)
        );
      }
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

    /** Same as game `row01GroundMaskRects`: each top sprite → rect down to macro row-1 bottom. */
    const row01ToRow1BottomClipRects = buildRow01TopSpriteBottomToRow1BottomClipRects(
      [...topPlacements, ...islandPl],
      WORLD_H,
      MACRO_ROWS
    );
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#f59e0b';
    for (const r of row01ToRow1BottomClipRects) {
      ctx.fillRect(
        Math.round(r.x * SCALE),
        Math.round(r.y * SCALE),
        Math.round(r.w * SCALE),
        Math.round(r.h * SCALE)
      );
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const mask = buildIslandRow0UpperMaskRects(islandRock?.placements || [], islandCliffBounds);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#c026d3';
    ctx.beginPath();
    const row0Y1 = MACRO_CELL_PX;
    for (const r of mask.rects) {
      const c = intersectRectWithHorizontalBandY(r, 0, row0Y1);
      if (!c) continue;
      ctx.rect(
        Math.round(c.x * SCALE),
        Math.round(c.y * SCALE),
        Math.round(c.w * SCALE),
        Math.round(c.h * SCALE)
      );
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    if (mask.yHoriz != null && mask.lineX0 != null && mask.lineX1 != null) {
      ctx.strokeStyle = 'rgba(34,211,238,0.95)';
      ctx.lineWidth = Math.max(1, 2 * SCALE);
      ctx.beginPath();
      ctx.moveTo(Math.round(mask.lineX0 * SCALE), Math.round(mask.yHoriz * SCALE));
      ctx.lineTo(Math.round(mask.lineX1 * SCALE), Math.round(mask.yHoriz * SCALE));
      ctx.stroke();
    }
    const cross = Math.max(4, Math.round(6));
    for (const a of mask.anchorPoints || []) {
      const cx = Math.round(a.x * SCALE);
      const cy = Math.round(a.y * SCALE);
      const stroke =
        a.kind === 'top_left_center'
          ? '#fbbf24'
          : a.kind === 'slope_left_edge_mid'
            ? '#4ade80'
            : '#94a3b8';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - cross, cy);
      ctx.lineTo(cx + cross, cy);
      ctx.moveTo(cx, cy - cross);
      ctx.lineTo(cx, cy + cross);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
    if (status) {
      const { x0, x1 } = getPlayableGridXSpan();
      const nTop = topPlacements.length;
      const nIsl = islandPl.length;
      status.textContent =
        `Row 0–1 top strip: disabled (rebuild). Row0 island col ${RANDOM_TOP_PLAYABLE_COL}; placements top=${nTop} island=${nIsl}. Row1 cols ${ROW1_PLAYABLE_MIN_COL}–${ROW1_PLAYABLE_MAX_COL} span [${x0},${x1}). Mid-strip rects ${row01MidStripRects.length}. Ground clip row0–1 (amber, sprite bottom→row1 bottom): ${row01ToRow1BottomClipRects.length} rect(s). Island clip (magenta): ${mask.debug}`;
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
