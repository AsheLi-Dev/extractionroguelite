import { assetUrl } from '../utils.js';
import { ROCK_BORDER_ATLAS, ROCK_BORDER_IMAGE_SRC } from '../data/terrain-rock-border-atlas.js';

const CELL_PAD = 12;
const LABEL_GAP = 6;
const COL_GAP = 16;
const ROW_GAP = 14;
const MIN_CANVAS_W = 480;
const MAX_CANVAS_W = 1400;

/** Target span (px) for top width and each side stack height; snap by adding/removing pieces. */
const CLIFF_SPAN_MIN = 768;
const CLIFF_SPAN_MAX = 896;

const CLIFF_TOP_FLAT_IDS = new Set(['top_flat_8', 'top_flat_9']);
const CLIFF_TOP_SLOPE_DOWN_ID = 'top_5';
const CLIFF_TOP_SLOPE_UP_ID = 'top_6';
const CLIFF_LEFT_SLOPE_ID = 'left_5';
const CLIFF_RIGHT_SLOPE_ID = 'right_5';
const CLIFF_LEFT_BOTTOM_IDS = ['bottom_4', 'bottom_5', 'bottom_6'];
const CLIFF_LEFT_BOTTOM_WEIGHT = {
  bottom_4: 3,
  bottom_5: 1,
  bottom_6: 3,
};
const CLIFF_RIGHT_BOTTOM_IDS = ['bottom_9', 'bottom_10', 'bottom_11'];
const CLIFF_RIGHT_BOTTOM_WEIGHT = {
  bottom_9: 3,
  bottom_10: 1,
  bottom_11: 3,
};
const CLIFF_BOTTOM_DROP_BY_ID = {
  bottom_5: 32,
  bottom_10: 32,
};
const CLIFF_BOTTOM_7_8_GAP_MIN = 16;
const CLIFF_BOTTOM_7_8_GAP_MAX = 160;

const PREVIEW_BG = 'rgba(111, 117, 89, 1)';
const CLIFF_PREVIEW_WIDTH_SCALE = 2;

function flattenAtlasEntries() {
  const out = [];
  for (const role of Object.keys(ROCK_BORDER_ATLAS)) {
    const arr = ROCK_BORDER_ATLAS[role];
    if (!Array.isArray(arr)) continue;
    for (const sprite of arr) {
      out.push({ role, sprite });
    }
  }
  return out;
}

function layoutGrid(items, viewportMaxW) {
  if (!items.length) {
    return { placements: [], totalW: MIN_CANVAS_W, totalH: 120 };
  }

  let maxSpriteW = 0;
  let maxSpriteH = 0;
  for (const { sprite } of items) {
    maxSpriteW = Math.max(maxSpriteW, sprite.w);
    maxSpriteH = Math.max(maxSpriteH, sprite.h);
  }

  const labelBlock = LABEL_GAP + 14;
  const cellW = maxSpriteW + CELL_PAD * 2;
  const cellH = maxSpriteH + labelBlock + CELL_PAD * 2;

  const usableW = Math.max(MIN_CANVAS_W, Math.min(MAX_CANVAS_W, viewportMaxW - 32));
  const numCols = Math.max(1, Math.floor((usableW + COL_GAP) / (cellW + COL_GAP)));

  const placements = [];
  const numRows = Math.ceil(items.length / numCols);
  const totalW = numCols * cellW + (numCols - 1) * COL_GAP + CELL_PAD * 2;
  const totalH = numRows * cellH + (numRows - 1) * ROW_GAP + CELL_PAD * 2;

  for (let idx = 0; idx < items.length; idx++) {
    const col = idx % numCols;
    const row = Math.floor(idx / numCols);
    const { sprite } = items[idx];
    const cellX = CELL_PAD + col * (cellW + COL_GAP);
    const cellY = CELL_PAD + row * (cellH + ROW_GAP);
    const drawX = cellX + CELL_PAD + Math.floor((maxSpriteW - sprite.w) / 2);
    const drawY = cellY + CELL_PAD + Math.floor((maxSpriteH - sprite.h) / 2);
    placements.push({
      sprite,
      drawX,
      drawY,
      labelY: cellY + CELL_PAD + maxSpriteH + LABEL_GAP,
      cellX,
      cellY,
      cellW,
      cellH,
      labelCenterX: cellX + cellW / 2,
    });
  }

  return { placements, totalW, totalH };
}

function drawSprite1to1(ctx, img, sprite, dx, dy) {
  ctx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, Math.round(dx), Math.round(dy), sprite.w, sprite.h);
}

function pickWeightedId(weightsById) {
  const entries = Object.entries(weightsById).filter(([, w]) => Number.isFinite(w) && w > 0);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

function pickDifferentRandomId(ids, prevId) {
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0] === prevId ? null : ids[0];
  let pick = ids[Math.floor(Math.random() * ids.length)];
  if (pick === prevId) {
    const alternatives = ids.filter((id) => id !== prevId);
    if (!alternatives.length) return null;
    pick = alternatives[Math.floor(Math.random() * alternatives.length)];
  }
  return pick;
}

function pickDifferentWeightedId(weightsById, prevId) {
  const filtered = {};
  for (const [id, w] of Object.entries(weightsById)) {
    if (id === prevId) continue;
    filtered[id] = w;
  }
  const pick = pickWeightedId(filtered);
  if (pick) return pick;
  return pickWeightedId(weightsById);
}

function topWidthFromMiddle(middleIds, byId) {
  const tl = byId.get('top_left');
  const tr = byId.get('top_right');
  if (!tl || !tr) return 0;
  let w = tl.w + tr.w;
  for (const id of middleIds) {
    const sp = byId.get(id);
    if (sp) w += sp.w;
  }
  return w;
}

/** Last tile before `top_right` must be a top flat (never `top_5`/`top_6`). */
function ensureMiddleBeforeTopRightEndsWithTopFlat(middleIds, flatIds, byId) {
  const lastMid = middleIds[middleIds.length - 1];
  if (lastMid && CLIFF_TOP_FLAT_IDS.has(lastMid)) return;
  if (lastMid && !CLIFF_TOP_FLAT_IDS.has(lastMid)) middleIds.pop();
  let prevForPick = middleIds.length ? middleIds[middleIds.length - 1] : 'top_left';
  let fp = pickDifferentRandomId(flatIds, prevForPick) || flatIds[0];
  while (
    middleIds.length > 0 &&
    topWidthFromMiddle([...middleIds, fp], byId) > CLIFF_SPAN_MAX
  ) {
    middleIds.pop();
    prevForPick = middleIds.length ? middleIds[middleIds.length - 1] : 'top_left';
    fp = pickDifferentRandomId(flatIds, prevForPick) || flatIds[0];
  }
  middleIds.push(fp);
}

function computeTopPlacements(sequenceIds, byId) {
  const placements = [];
  const missing = [];
  let x = 0;
  for (const id of sequenceIds) {
    const sprite = byId.get(id);
    if (!sprite) {
      missing.push(id);
      continue;
    }
    let y = 0;
    if (placements.length) {
      const prev = placements[placements.length - 1];
      const prevId = prev.sprite.id;
      const prevBottom = prev.y + prev.sprite.h;
      const nextIsFlat = CLIFF_TOP_FLAT_IDS.has(sprite.id);
      const prevIsFlat = CLIFF_TOP_FLAT_IDS.has(prevId);

      if (sprite.id === CLIFF_TOP_SLOPE_DOWN_ID) {
        y = prevBottom - sprite.h + 32;
      } else if (prevId === CLIFF_TOP_SLOPE_DOWN_ID) {
        y = prevBottom - sprite.h + 32;
      } else if (sprite.id === CLIFF_TOP_SLOPE_UP_ID && prevIsFlat) {
        y = prevBottom - sprite.h - 32;
      } else if (prevId === CLIFF_TOP_SLOPE_UP_ID && nextIsFlat) {
        y = prevBottom - sprite.h;
      } else {
        y = prevBottom - sprite.h;
      }
    }
    placements.push({ sprite, x, y });
    x += sprite.w;
  }
  const minY = placements.length ? Math.min(...placements.map((p) => p.y)) : 0;
  const maxY = placements.length ? Math.max(...placements.map((p) => p.y + p.sprite.h)) : 0;
  return { placements, missing, minY, maxY, width: x };
}

/**
 * Grow top middle until width in [CLIFF_SPAN_MIN, CLIFF_SPAN_MAX] when possible; snap by trimming if over max.
 */
function buildCliffTopSequence(topSprites, topFlatSprites) {
  const byId = new Map([...topSprites, ...topFlatSprites].map((sp) => [sp.id, sp]));
  const missing = [];
  if (!byId.get('top_left')) missing.push('top_left');
  if (!byId.get('top_right')) missing.push('top_right');
  if (!topFlatSprites.length) missing.push('topFlat');

  const flatIds = topFlatSprites.map((sp) => sp.id);
  const middleIds = [];
  let prevId = 'top_left';

  const minFlatW = Math.min(...topFlatSprites.map((s) => s.w));

  while (topWidthFromMiddle(middleIds, byId) < CLIFF_SPAN_MIN && middleIds.length < 80) {
    if (middleIds.length > 0 && Math.random() < 0.35) {
      const slopePick = pickDifferentRandomId(
        [CLIFF_TOP_SLOPE_DOWN_ID, CLIFF_TOP_SLOPE_UP_ID],
        prevId
      );
      if (slopePick) {
        middleIds.push(slopePick);
        prevId = slopePick;
      }
    }
    const flatPick = pickDifferentRandomId(flatIds, prevId) || flatIds[0];
    middleIds.push(flatPick);
    prevId = flatPick;
  }

  while (topWidthFromMiddle(middleIds, byId) <= CLIFF_SPAN_MAX - minFlatW && Math.random() < 0.45) {
    if (Math.random() < 0.3) {
      const slopePick = pickDifferentRandomId(
        [CLIFF_TOP_SLOPE_DOWN_ID, CLIFF_TOP_SLOPE_UP_ID],
        prevId
      );
      if (slopePick && topWidthFromMiddle([...middleIds, slopePick], byId) <= CLIFF_SPAN_MAX) {
        middleIds.push(slopePick);
        prevId = slopePick;
      }
    }
    const flatPick = pickDifferentRandomId(flatIds, prevId) || flatIds[0];
    if (topWidthFromMiddle([...middleIds, flatPick], byId) > CLIFF_SPAN_MAX) break;
    middleIds.push(flatPick);
    prevId = flatPick;
  }

  while (topWidthFromMiddle(middleIds, byId) > CLIFF_SPAN_MAX && middleIds.length) {
    middleIds.pop();
    prevId = middleIds.length ? middleIds[middleIds.length - 1] : 'top_left';
  }

  if (flatIds.length) {
    ensureMiddleBeforeTopRightEndsWithTopFlat(middleIds, flatIds, byId);
  }

  const sequenceIds = ['top_left', ...middleIds, 'top_right'];
  const layout = computeTopPlacements(sequenceIds, byId);
  return { ...layout, missing: [...missing, ...layout.missing] };
}

function sideStackHeight(sprites) {
  return sprites.reduce((s, sp) => s + sp.h, 0);
}

function isLeftFlatId(id) {
  return id.startsWith('left_flat_');
}
function isRightFlatId(id) {
  return id.startsWith('right_flat_');
}

/**
 * Vertical stack: first and last are flat; target total height in [minSpan, maxSpan].
 * At most one slope (left_5 / right_5) per side — either none or a single instance.
 */
function buildSideVerticalBySpan(flatSprites, slopeSprite, label) {
  const sequence = [];
  const missing = [];
  if (!flatSprites.length) {
    missing.push(`${label}Flat`);
    return { sequence, missing };
  }
  const flatIds = flatSprites.map((sp) => sp.id);
  const slopeId = slopeSprite ? slopeSprite.id : null;

  let prevId = null;
  const firstId = pickDifferentRandomId(flatIds, null) || flatIds[0];
  sequence.push(flatSprites.find((s) => s.id === firstId) || flatSprites[0]);
  prevId = firstId;

  const minFlatH = Math.min(...flatSprites.map((s) => s.h));
  let slopePlaced = false;

  while (sideStackHeight(sequence) < CLIFF_SPAN_MIN && sequence.length < 80) {
    if (slopeId && !slopePlaced && Math.random() < 0.28) {
      const sid = pickDifferentRandomId([slopeId], prevId);
      if (sid) {
        sequence.push(slopeSprite);
        prevId = sid;
        slopePlaced = true;
      }
    }
    const fid = pickDifferentRandomId(flatIds, prevId) || flatIds[0];
    sequence.push(flatSprites.find((s) => s.id === fid) || flatSprites[0]);
    prevId = fid;
  }

  while (
    sideStackHeight(sequence) <= CLIFF_SPAN_MAX - minFlatH &&
    Math.random() < 0.42 &&
    sequence.length < 80
  ) {
    if (slopeId && !slopePlaced && Math.random() < 0.25) {
      const sid = pickDifferentRandomId([slopeId], prevId);
      if (sid && sideStackHeight([...sequence, slopeSprite]) <= CLIFF_SPAN_MAX) {
        sequence.push(slopeSprite);
        prevId = sid;
        slopePlaced = true;
        continue;
      }
    }
    const fid = pickDifferentRandomId(flatIds, prevId) || flatIds[0];
    const sp = flatSprites.find((s) => s.id === fid) || flatSprites[0];
    if (sideStackHeight([...sequence, sp]) > CLIFF_SPAN_MAX) break;
    sequence.push(sp);
    prevId = fid;
  }

  while (sideStackHeight(sequence) > CLIFF_SPAN_MAX && sequence.length > 2) {
    sequence.splice(sequence.length - 2, 1);
    prevId = sequence[sequence.length - 1].id;
  }

  const last = sequence[sequence.length - 1];
  if (!last || !last.id.startsWith(`${label}_flat_`)) {
    const fid = pickDifferentRandomId(flatIds, sequence.length ? sequence[sequence.length - 1].id : null);
    sequence.push(flatSprites.find((s) => s.id === (fid || flatIds[0])) || flatSprites[0]);
  }

  return { sequence, missing };
}

/** Bottom row: bottom_left → 1–3×4/5/6 → bottom_7 | gap | bottom_8 → 1–3×9/10/11 → bottom_right */
function buildCliffBottomSequence(bottomSprites) {
  const byId = new Map(bottomSprites.map((sp) => [sp.id, sp]));
  const sequence = [];
  const missing = [];

  function pushId(id) {
    const sp = byId.get(id);
    if (!sp) missing.push(id);
    else sequence.push(sp);
  }

  pushId('bottom_left');
  let prevLeft = 'bottom_left';
  const nLeft = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < nLeft; i++) {
    const pick =
      pickDifferentWeightedId(CLIFF_LEFT_BOTTOM_WEIGHT, prevLeft) || CLIFF_LEFT_BOTTOM_IDS[0];
    pushId(pick);
    prevLeft = pick;
  }
  pushId('bottom_7');

  pushId('bottom_8');
  let prevRight = 'bottom_8';
  const nRight = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < nRight; i++) {
    const pick =
      pickDifferentWeightedId(CLIFF_RIGHT_BOTTOM_WEIGHT, prevRight) || CLIFF_RIGHT_BOTTOM_IDS[0];
    pushId(pick);
    prevRight = pick;
  }
  pushId('bottom_right');

  return { sequence, missing };
}

/**
 * Flow: top (width 768–896) → left/right stacks (height 768–896 each) → bottom corners from last flats → bottom row.
 */
function layoutCliffPreview() {
  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const bottom = ROCK_BORDER_ATLAS.bottom || [];
  const left = ROCK_BORDER_ATLAS.left || [];
  const right = ROCK_BORDER_ATLAS.right || [];
  const leftFlat = ROCK_BORDER_ATLAS.leftFlat || [];
  const rightFlat = ROCK_BORDER_ATLAS.rightFlat || [];

  const topLayout = buildCliffTopSequence(top, topFlat);
  const tops = topLayout.placements;
  const missingTopIds = topLayout.missing;

  const leftSlope = left.find((sp) => sp.id === CLIFF_LEFT_SLOPE_ID) || null;
  const rightSlope = right.find((sp) => sp.id === CLIFF_RIGHT_SLOPE_ID) || null;
  const { sequence: lefts, missing: missingLeftIds } = buildSideVerticalBySpan(leftFlat, leftSlope, 'left');
  const { sequence: rights, missing: missingRightIds } = buildSideVerticalBySpan(
    rightFlat,
    rightSlope,
    'right'
  );

  const { sequence: bots, missing: missingBottomIds } = buildCliffBottomSequence(bottom);

  const Wtop = topLayout.width;
  const bottom78Gap =
    CLIFF_BOTTOM_7_8_GAP_MIN +
    Math.floor(Math.random() * (CLIFF_BOTTOM_7_8_GAP_MAX - CLIFF_BOTTOM_7_8_GAP_MIN + 1));

  const Htop = Math.max(0, topLayout.maxY - topLayout.minY);
  const topYOffset = -topLayout.minY;
  const Hbot = bots.length ? Math.max(...bots.map((s) => s.h)) : 0;
  const HleftStack = sideStackHeight(lefts);
  const HrightStack = sideStackHeight(rights);
  const midH = Math.max(HleftStack, HrightStack, 32);

  const maxBottomDrop = bots.reduce((m, sp) => Math.max(m, CLIFF_BOTTOM_DROP_BY_ID[sp.id] || 0), 0);
  const bottomBandY = Htop + midH;
  const canvasH = Htop + midH + Hbot + maxBottomDrop;

  const maxLW = lefts.length ? Math.max(...lefts.map((s) => s.w)) : 0;
  const maxRW = rights.length ? Math.max(...rights.map((s) => s.w)) : 0;

  const topX0 = 0;
  const draws = [];

  const topLeftPlaced = tops.find((p) => p.sprite.id === 'top_left');
  const topRightPlaced = tops.find((p) => p.sprite.id === 'top_right');
  const leftAnchorRightX = topLeftPlaced ? topX0 + topLeftPlaced.x + topLeftPlaced.sprite.w : maxLW;
  const rightAnchorLeftX = topRightPlaced ? topX0 + topRightPlaced.x : Wtop - maxRW;
  const leftAnchorBottomY = topLeftPlaced ? topLeftPlaced.y + topYOffset + topLeftPlaced.sprite.h : Htop;
  const rightAnchorBottomY = topRightPlaced ? topRightPlaced.y + topYOffset + topRightPlaced.sprite.h : Htop;

  let yL = leftAnchorBottomY;
  let xL = leftAnchorRightX - (lefts[0]?.w || 0);
  const leftPlaced = [];
  for (let i = 0; i < lefts.length; i++) {
    const sp = lefts[i];
    if (i === 0) {
      xL = leftAnchorRightX - sp.w;
    } else {
      const prev = lefts[i - 1];
      const prevRight = xL + prev.w;
      if (prev.id === CLIFF_LEFT_SLOPE_ID) {
        xL = prevRight - sp.w - 96;
      } else {
        xL = prevRight - sp.w;
      }
    }
    leftPlaced.push({ sprite: sp, x: xL, y: yL, pass: 2 });
    yL += sp.h;
  }

  let yR = rightAnchorBottomY;
  let xR = rightAnchorLeftX;
  const rightPlaced = [];
  for (let i = 0; i < rights.length; i++) {
    const sp = rights[i];
    if (i === 0) {
      xR = rightAnchorLeftX;
    } else {
      const prev = rights[i - 1];
      const prevLeft = xR;
      if (prev.id === CLIFF_RIGHT_SLOPE_ID) {
        xR = prevLeft + 96;
      } else {
        xR = prevLeft;
      }
    }
    rightPlaced.push({ sprite: sp, x: xR, y: yR, pass: 3 });
    yR += sp.h;
  }

  // When left/right stacks match height, nudge both so each last flat meets its bottom corner, then
  // shift the top band by max(delta) so top corners still meet the first side tiles. When heights
  // differ, skip that coupling: keep top↔side integrity and accept vertical slack at the shorter
  // side's bottom corner (do not tie the two sides together via bottom alignment).
  let deltaLeft = 0;
  let deltaRight = 0;
  const bottomLeftSpritePre = bots.find((s) => s.id === 'bottom_left');
  const bottomRightSpritePre = bots.find((s) => s.id === 'bottom_right');
  const alignBottomCornersToSides = HleftStack === HrightStack;

  if (alignBottomCornersToSides && bottomLeftSpritePre) {
    const topYBl =
      bottomBandY +
      (Hbot - bottomLeftSpritePre.h) +
      (CLIFF_BOTTOM_DROP_BY_ID.bottom_left || 0);
    const lastLf = [...leftPlaced].reverse().find((p) => isLeftFlatId(p.sprite.id));
    if (lastLf) {
      deltaLeft = topYBl - (lastLf.y + lastLf.sprite.h);
      for (const p of leftPlaced) p.y += deltaLeft;
    }
  }
  if (alignBottomCornersToSides && bottomRightSpritePre) {
    const topYBr =
      bottomBandY +
      (Hbot - bottomRightSpritePre.h) +
      (CLIFF_BOTTOM_DROP_BY_ID.bottom_right || 0);
    const lastRf = [...rightPlaced].reverse().find((p) => isRightFlatId(p.sprite.id));
    if (lastRf) {
      deltaRight = topYBr - (lastRf.y + lastRf.sprite.h);
      for (const p of rightPlaced) p.y += deltaRight;
    }
  }

  const topShift = alignBottomCornersToSides ? Math.max(0, deltaLeft, deltaRight) : 0;
  for (const placed of tops) {
    draws.push({ sprite: placed.sprite, x: topX0 + placed.x, y: placed.y + topYOffset + topShift, pass: 4 });
  }

  const lastLeftFlat = [...leftPlaced].reverse().find((p) => isLeftFlatId(p.sprite.id));
  const lastRightFlat = [...rightPlaced].reverse().find((p) => isRightFlatId(p.sprite.id));

  const bottomLeftSprite = bots.find((s) => s.id === 'bottom_left');
  const bottomRightSprite = bots.find((s) => s.id === 'bottom_right');

  let bottomLeftX = 0;
  if (lastLeftFlat && bottomLeftSprite) {
    const fr = lastLeftFlat.x + lastLeftFlat.sprite.w;
    bottomLeftX = fr + 32 - bottomLeftSprite.w;
  }

  // bottom_right: align its left edge to the last rightFlat's left edge, then shift 32px left.
  let bottomRightX = 0;
  if (lastRightFlat && bottomRightSprite) {
    bottomRightX = lastRightFlat.x - 32;
  }

  const idx8 = bots.findIndex((s) => s.id === 'bottom_8');
  const leftBottomSeg = idx8 >= 0 ? bots.slice(0, idx8) : bots;
  const rightBottomSeg = idx8 >= 0 ? bots.slice(idx8) : [];

  const bottomPlaced = [];
  let curX = bottomLeftX;
  for (const sp of leftBottomSeg) {
    const drop = CLIFF_BOTTOM_DROP_BY_ID[sp.id] || 0;
    const y0 = bottomBandY + (Hbot - sp.h) + drop;
    bottomPlaced.push({ sprite: sp, x: curX, y: y0, pass: 1 });
    curX += sp.w;
    if (sp.id === 'bottom_7') curX += bottom78Gap;
  }

  // Place L→R with shared edges: walk from the right edge of bottom_right leftward (reverse array order).
  // The old xRight -= w loop used each tile's x as the next tile's x, which only tiles if widths match.
  if (rightBottomSeg.length && bottomRightSprite) {
    let rightEdge = bottomRightX + bottomRightSprite.w;
    for (let i = rightBottomSeg.length - 1; i >= 0; i--) {
      const sp = rightBottomSeg[i];
      rightEdge -= sp.w;
      const drop = CLIFF_BOTTOM_DROP_BY_ID[sp.id] || 0;
      const y0 = bottomBandY + (Hbot - sp.h) + drop;
      bottomPlaced.push({ sprite: sp, x: rightEdge, y: y0, pass: 1 });
    }
  }

  for (const p of bottomPlaced) draws.push(p);
  for (const p of leftPlaced) draws.push(p);
  for (const p of rightPlaced) draws.push(p);

  draws.sort((a, b) => {
    if (a.pass !== b.pass) return a.pass - b.pass;
    if (a.pass === 1) return a.x - b.x;
    return 0;
  });

  let minX = Infinity;
  let maxX = -Infinity;
  for (const d of draws) {
    minX = Math.min(minX, d.x);
    maxX = Math.max(maxX, d.x + d.sprite.w);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = Wtop;
  }
  const shiftX = -minX;
  for (const d of draws) {
    d.x += shiftX;
  }

  const spanW = maxX - minX;
  const canvasW = Math.max(1, Math.ceil(spanW));

  const warnings = [];
  if (missingTopIds.length) warnings.push(`top missing: ${missingTopIds.join(', ')}`);
  if (missingBottomIds.length) warnings.push(`bottom missing: ${missingBottomIds.join(', ')}`);
  if (missingLeftIds.length) warnings.push(`left missing: ${missingLeftIds.join(', ')}`);
  if (missingRightIds.length) warnings.push(`right missing: ${missingRightIds.join(', ')}`);
  if (topLayout.width < CLIFF_SPAN_MIN) warnings.push(`top width ${topLayout.width} < ${CLIFF_SPAN_MIN}`);
  if (topLayout.width > CLIFF_SPAN_MAX) warnings.push(`top width ${topLayout.width} > ${CLIFF_SPAN_MAX}`);
  if (HleftStack < CLIFF_SPAN_MIN) warnings.push(`left stack ${HleftStack} < ${CLIFF_SPAN_MIN}`);
  if (HleftStack > CLIFF_SPAN_MAX) warnings.push(`left stack ${HleftStack} > ${CLIFF_SPAN_MAX}`);
  if (HrightStack < CLIFF_SPAN_MIN) warnings.push(`right stack ${HrightStack} < ${CLIFF_SPAN_MIN}`);
  if (HrightStack > CLIFF_SPAN_MAX) warnings.push(`right stack ${HrightStack} > ${CLIFF_SPAN_MAX}`);

  return {
    canvasW: Math.max(1, Math.ceil(canvasW)),
    canvasH: Math.max(1, Math.ceil(canvasH)),
    draws,
    topX0: topX0 + shiftX,
    botX0: shiftX,
    warnings,
  };
}

function drawCliffPreview(canvas, img) {
  const layout = layoutCliffPreview();
  canvas.width = Math.max(1, Math.ceil(layout.canvasW * CLIFF_PREVIEW_WIDTH_SCALE));
  canvas.height = layout.canvasH;
  const ctx = canvas.getContext('2d');
  const offsetX = Math.floor((canvas.width - layout.canvasW) * 0.5);

  ctx.fillStyle = PREVIEW_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = false;
  for (const d of layout.draws) {
    drawSprite1to1(ctx, img, d.sprite, d.x + offsetX, d.y);
  }
  ctx.imageSmoothingEnabled = true;

  const cliffStatus = document.getElementById('rock-border-cliff-status');
  if (cliffStatus) {
    const wtxt = layout.warnings.length ? ` · ${layout.warnings.join(' · ')}` : '';
    cliffStatus.textContent = `Cliff: top/sides target ${CLIFF_SPAN_MIN}–${CLIFF_SPAN_MAX}px · entrance bottom (7|gap|8)${wtxt}`;
  }
}

function drawAtlasGrid(canvas, img, items, maxW) {
  const { placements, totalW, totalH } = layoutGrid(items, maxW);
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PREVIEW_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of placements) {
    const { sprite } = p;
    ctx.fillStyle = '#252030';
    ctx.fillRect(p.cellX, p.cellY, p.cellW, p.cellH);
    ctx.strokeStyle = '#3d3550';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.cellX + 0.5, p.cellY + 0.5, p.cellW - 1, p.cellH - 1);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, p.drawX, p.drawY, sprite.w, sprite.h);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(sprite.id, p.labelCenterX, p.labelY);
  }

  const status = document.getElementById('rock-border-atlas-status');
  if (status) {
    status.textContent = `${items.length} sprites · ${placements.length} cells · sheet ${img.naturalWidth}×${img.naturalHeight}px`;
  }
}

function run() {
  const gridCanvas = document.getElementById('rock-border-atlas-canvas');
  const cliffCanvas = document.getElementById('rock-border-cliff-canvas');
  if (!gridCanvas) return;

  const items = flattenAtlasEntries();
  const maxW = Math.min(MAX_CANVAS_W, Math.max(MIN_CANVAS_W, window.innerWidth - 32));

  const img = new Image();
  img.onload = () => {
    drawAtlasGrid(gridCanvas, img, items, maxW);
    if (cliffCanvas) {
      drawCliffPreview(cliffCanvas, img);
    }
  };
  img.onerror = () => {
    const status = document.getElementById('rock-border-atlas-status');
    if (status) {
      status.textContent = `Failed to load image — serve repo root over HTTP so ${ROCK_BORDER_IMAGE_SRC} resolves.`;
    }
    const cliffStatus = document.getElementById('rock-border-cliff-status');
    if (cliffStatus) cliffStatus.textContent = 'Image not loaded — cliff preview skipped.';
  };
  img.src = assetUrl(ROCK_BORDER_IMAGE_SRC);
}

run();
